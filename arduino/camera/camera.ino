#include <Arduino.h>
#include <skyrooty_inferencing.h>
#include "edge-impulse-sdk/dsp/image/image.hpp"
#include "esp_camera.h"

#define CAM_UART_RX 14
#define CAM_UART_TX 15
#define UART_BAUD 460800
#define SYNC_BYTE_0 0xAA
#define SYNC_BYTE_1 0x55
#define TYPE_PREDICTIONS 'P'
#define TYPE_IMAGE 'I'
#define MAX_IMAGE_SIZE 48000
#define MAX_PREDICTION_SIZE 1024
#define CAMERA_SERIAL_ONLY 0

#define CAMERA_MODEL_AI_THINKER

#if defined(CAMERA_MODEL_ESP_EYE)
#define PWDN_GPIO_NUM -1
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 4
#define SIOD_GPIO_NUM 18
#define SIOC_GPIO_NUM 23
#define Y9_GPIO_NUM 36
#define Y8_GPIO_NUM 37
#define Y7_GPIO_NUM 38
#define Y6_GPIO_NUM 39
#define Y5_GPIO_NUM 35
#define Y4_GPIO_NUM 14
#define Y3_GPIO_NUM 13
#define Y2_GPIO_NUM 34
#define VSYNC_GPIO_NUM 5
#define HREF_GPIO_NUM 27
#define PCLK_GPIO_NUM 25
#elif defined(CAMERA_MODEL_AI_THINKER)
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22
#else
#error "Select a supported camera model"
#endif

#define CAMERA_WIDTH 320
#define CAMERA_HEIGHT 240
#define CAMERA_CHANNELS 3

static bool debug_nn = false;
static uint8_t* snapshot_buf = nullptr;
static bool firstInferenceReadLogged = false;

static camera_config_t camera_config = {
  .pin_pwdn = PWDN_GPIO_NUM,
  .pin_reset = RESET_GPIO_NUM,
  .pin_xclk = XCLK_GPIO_NUM,
  .pin_sscb_sda = SIOD_GPIO_NUM,
  .pin_sscb_scl = SIOC_GPIO_NUM,
  .pin_d7 = Y9_GPIO_NUM,
  .pin_d6 = Y8_GPIO_NUM,
  .pin_d5 = Y7_GPIO_NUM,
  .pin_d4 = Y6_GPIO_NUM,
  .pin_d3 = Y5_GPIO_NUM,
  .pin_d2 = Y4_GPIO_NUM,
  .pin_d1 = Y3_GPIO_NUM,
  .pin_d0 = Y2_GPIO_NUM,
  .pin_vsync = VSYNC_GPIO_NUM,
  .pin_href = HREF_GPIO_NUM,
  .pin_pclk = PCLK_GPIO_NUM,
  .xclk_freq_hz = 20000000,
  .ledc_timer = LEDC_TIMER_0,
  .ledc_channel = LEDC_CHANNEL_0,
  .pixel_format = PIXFORMAT_JPEG,
  .frame_size = FRAMESIZE_QVGA,
  .jpeg_quality = 18,
  .fb_count = 1,
  .fb_location = CAMERA_FB_IN_PSRAM,
  .grab_mode = CAMERA_GRAB_WHEN_EMPTY,
};

static void appendJsonString(String& json, const char* value) {
  json += '"';
  for (const char* cursor = value; *cursor != '\0'; cursor++) {
    const char character = *cursor;
    if (character == '"' || character == '\\') json += '\\';
    if ((uint8_t)character >= 0x20) json += character;
  }
  json += '"';
}

static bool sendUartPacket(uint8_t type, const uint8_t* payload, uint32_t length) {
  const uint32_t maxLength = type == TYPE_IMAGE ? MAX_IMAGE_SIZE : MAX_PREDICTION_SIZE;
  if (length == 0 || length > maxLength) return false;

  const uint8_t header[7] = {
    SYNC_BYTE_0,
    SYNC_BYTE_1,
    type,
    (uint8_t)(length & 0xFF),
    (uint8_t)((length >> 8) & 0xFF),
    (uint8_t)((length >> 16) & 0xFF),
    (uint8_t)((length >> 24) & 0xFF)
  };

  uint8_t checksum = 0;
  for (uint32_t i = 0; i < length; i++) checksum ^= payload[i];

  Serial1.write(header, sizeof(header));
  Serial1.write(payload, length);
  Serial1.write(checksum);
  Serial1.flush();
  return true;
}

static int ei_camera_get_data(size_t offset, size_t length, float* out_ptr) {
  const size_t inputPixelCount = (size_t)EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT;
  if (snapshot_buf == nullptr || offset > inputPixelCount || length > inputPixelCount - offset) {
    Serial.printf("[CAM] Invalid inference image read: offset=%u length=%u pixels=%u\n",
                  (unsigned int)offset,
                  (unsigned int)length,
                  (unsigned int)inputPixelCount);
    return -1;
  }

  if (!firstInferenceReadLogged) {
    firstInferenceReadLogged = true;
    Serial.printf("[CAM] Inference image callback active (%u pixels)\n", (unsigned int)inputPixelCount);
  }

  size_t pixelIndex = offset * CAMERA_CHANNELS;
  for (size_t outputIndex = 0; outputIndex < length; outputIndex++, pixelIndex += CAMERA_CHANNELS) {
    const uint32_t red = (uint32_t)snapshot_buf[pixelIndex + 2] << 16;
    const uint32_t green = (uint32_t)snapshot_buf[pixelIndex + 1] << 8;
    const uint32_t blue = (uint32_t)snapshot_buf[pixelIndex];
    out_ptr[outputIndex] = (float)(red | green | blue);
  }
  return 0;
}

static String buildPredictionsJson(const ei_impulse_result_t& result) {
  String json = "{";
#if EI_CLASSIFIER_OBJECT_DETECTION == 1
  uint32_t bestBoxIndex = result.bounding_boxes_count;
  float bestBoxValue = 0.0f;
  for (uint32_t i = 0; i < result.bounding_boxes_count; i++) {
    if (result.bounding_boxes[i].value > bestBoxValue) {
      bestBoxIndex = i;
      bestBoxValue = result.bounding_boxes[i].value;
    }
  }
  appendJsonString(json, bestBoxIndex == result.bounding_boxes_count
      ? "no_detection"
      : result.bounding_boxes[bestBoxIndex].label);
  json += ':';
  json += String(bestBoxValue, 5);
#else
  uint16_t bestIndex = 0;
  for (uint16_t i = 1; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
    if (result.classification[i].value > result.classification[bestIndex].value) bestIndex = i;
  }
  appendJsonString(json, ei_classifier_inferencing_categories[bestIndex]);
  json += ':';
  json += String(result.classification[bestIndex].value, 5);
#endif
  json += '}';
  return json;
}

static bool ei_camera_init() {
  const esp_err_t error = esp_camera_init(&camera_config);
  if (error != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", error);
    return false;
  }

  sensor_t* sensor = esp_camera_sensor_get();
  if (sensor != nullptr && sensor->id.PID == OV3660_PID) {
    sensor->set_vflip(sensor, 1);
    sensor->set_brightness(sensor, 1);
    sensor->set_saturation(sensor, 0);
  }
  return true;
}

void setup() {
  Serial.begin(115200);
  Serial1.begin(UART_BAUD, SERIAL_8N1, CAM_UART_RX, CAM_UART_TX);

  if (!ei_camera_init()) {
    Serial.println("Camera unavailable; stopping");
    while (true) delay(1000);
  }

  const size_t rawSize = CAMERA_WIDTH * CAMERA_HEIGHT * CAMERA_CHANNELS;
  snapshot_buf = (uint8_t*)malloc(rawSize);
  if (snapshot_buf == nullptr) {
    Serial.println("Image buffer allocation failed");
    while (true) delay(1000);
  }

  Serial.println("Camera inference and UART link ready");
  Serial.printf("UART RX=%d TX=%d at %lu baud\n", CAM_UART_RX, CAM_UART_TX, (unsigned long)UART_BAUD);
  ei_sleep(2000);
}

void loop() {
  ei_sleep(5000);
  Serial.printf("[CAM] Capture start; free heap=%u, free PSRAM=%u\n",
                (unsigned int)ESP.getFreeHeap(),
                (unsigned int)ESP.getFreePsram());

  camera_fb_t* frame = esp_camera_fb_get();
  if (frame == nullptr) {
    Serial.println("Camera capture failed");
    return;
  }
  Serial.printf("[CAM] Captured JPEG: %u bytes\n", (unsigned int)frame->len);

  bool converted = fmt2rgb888(frame->buf, frame->len, PIXFORMAT_JPEG, snapshot_buf);
  if (!converted) {
    Serial.println("JPEG to RGB conversion failed");
    esp_camera_fb_return(frame);
    return;
  }
  Serial.println("[CAM] JPEG to RGB conversion complete");

  esp_camera_fb_return(frame);

  if (EI_CLASSIFIER_INPUT_WIDTH != CAMERA_WIDTH || EI_CLASSIFIER_INPUT_HEIGHT != CAMERA_HEIGHT) {
    Serial.printf("[CAM] Resize RGB %ux%u -> %ux%u\n",
                  (unsigned int)CAMERA_WIDTH,
                  (unsigned int)CAMERA_HEIGHT,
                  (unsigned int)EI_CLASSIFIER_INPUT_WIDTH,
                  (unsigned int)EI_CLASSIFIER_INPUT_HEIGHT);
    ei::image::processing::crop_and_interpolate_rgb888(
      snapshot_buf,
      CAMERA_WIDTH,
      CAMERA_HEIGHT,
      snapshot_buf,
      EI_CLASSIFIER_INPUT_WIDTH,
      EI_CLASSIFIER_INPUT_HEIGHT);
  }
  Serial.println("[CAM] RGB input ready");

  ei::signal_t signal;
  signal.total_length = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT;
  signal.get_data = &ei_camera_get_data;

  ei_impulse_result_t result = { 0 };
  Serial.printf("[CAM] Before classifier: heap=%u, largest block=%u, PSRAM=%u\n",
                (unsigned int)ESP.getFreeHeap(),
                (unsigned int)ESP.getMaxAllocHeap(),
                (unsigned int)ESP.getFreePsram());
  Serial.println("[CAM] Edge Impulse inference start");
  const EI_IMPULSE_ERROR inferenceError = run_classifier(&signal, &result, debug_nn);
  if (inferenceError != EI_IMPULSE_OK) {
    Serial.printf("Classifier failed with error %d\n", inferenceError);
    return;
  }
  Serial.println("[CAM] Edge Impulse inference complete");

  const String predictions = buildPredictionsJson(result);
  Serial.printf("ML GUESS: %s\n", predictions.c_str());

  if (!CAMERA_SERIAL_ONLY) {
    if (!sendUartPacket(TYPE_PREDICTIONS, (const uint8_t*)predictions.c_str(), predictions.length())) {
      Serial.println("Prediction packet rejected: payload too large");
    }

    ei_sleep(50);
    camera_fb_t* transmitFrame = esp_camera_fb_get();
    if (transmitFrame == nullptr) {
      Serial.println("Could not capture JPEG frame for UART transfer");
    } else if (transmitFrame->len <= MAX_IMAGE_SIZE) {
      Serial.printf("Sending JPEG frame: %u bytes\n", (unsigned int)transmitFrame->len);
      if (!sendUartPacket(TYPE_IMAGE, transmitFrame->buf, transmitFrame->len)) {
        Serial.println("Image packet could not be sent");
      }
    } else {
      Serial.printf("JPEG too large (%u bytes; limit %u)\n",
                    (unsigned int)transmitFrame->len,
                    (unsigned int)MAX_IMAGE_SIZE);
    }
    if (transmitFrame != nullptr) esp_camera_fb_return(transmitFrame);
  }

}

#if !defined(EI_CLASSIFIER_SENSOR) || EI_CLASSIFIER_SENSOR != EI_CLASSIFIER_SENSOR_CAMERA
#error "The selected Edge Impulse model must use a camera sensor"
#endif

