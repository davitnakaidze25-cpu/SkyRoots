#include <SkyRoots-Lettuce_inferencing.h>

#include <WiFi.h>
#include <WebServer.h>
#include <WiFiClient.h>
#include "edge-impulse-sdk/dsp/image/image.hpp"
#include "esp_camera.h"

// ─── Wi-Fi Access Point Configuration ─────────────────────────────────────
// The ESP32-CAM will broadcast this Wi-Fi network for your app to connect to
const char *ssid = "SkyRoots_BioDome";
const char *password = "lettuce123";

WebServer server(80);

// Select camera model - AI-THINKER has PSRAM
#define CAMERA_MODEL_AI_THINKER

#if defined(CAMERA_MODEL_AI_THINKER)
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22
#else
#error "Camera model not selected"
#endif

/* Constant defines -------------------------------------------------------- */
#define EI_CAMERA_RAW_FRAME_BUFFER_COLS          320
#define EI_CAMERA_RAW_FRAME_BUFFER_ROWS          240
#define EI_CAMERA_FRAME_BYTE_SIZE                3

static bool debug_nn = false;
static bool is_initialised = false;
uint8_t *snapshot_buf;

// Latest ML Inference results stored globally to serve via web API
String latestPredictionJson = "{\"status\":\"initializing\"}";

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
    .jpeg_quality = 12,
    .fb_count = 1,
    .fb_location = CAMERA_FB_IN_PSRAM,
    .grab_mode = CAMERA_GRAB_WHEN_EMPTY,
};

bool ei_camera_init(void);
bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf);

// ─── Web Server Handlers ──────────────────────────────────────────────────
void handleRoot() {
    String html = "<html><head><title>SkyRoots Bio-Dome</title></head><body style='font-family:sans-serif;text-align:center;background:#111;color:#eee;'>";
    html += "<h2>SkyRoots ESP32-CAM Live Feed</h2>";
    html += "<img src='/stream' style='width:320px;height:240px;border:2px solid #00ff66;border-radius:8px;'><br>";
    html += "<h3>ML Predictions:</h3><pre id='preds' style='color:#00ff66;font-size:16px;'></pre>";
    html += "<script>setInterval(async()=>{let r=await fetch('/preds');let j=await r.text();document.getElementById('preds').innerText=j;},1000);</script>";
    html += "</body></html>";
    server.send(200, "text/html", html);
}

void handlePredictions() {
    server.send(200, "application/json", latestPredictionJson);
}

void handleStream() {
    WiFiClient client = server.client();
    String response = "HTTP/1.1 200 OK\r\n";
    response += "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n";
    client.print(response);

    while (client.connected()) {
        camera_fb_t *fb = esp_camera_fb_get();
        if (!fb) {
            delay(10);
            continue;
        }
        client.print("--frame\r\n");
        client.print("Content-Type: image/jpeg\r\n");
        client.print("Content-Length: " + String(fb->len) + "\r\n\r\n");
        client.write(fb->buf, fb->len);
        client.print("\r\n");
        esp_camera_fb_return(fb);
        if (!client.connected()) break;
    }
}

// ─── Setup ────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    
    if (ei_camera_init() == false) {
        Serial.println("Failed to initialize Camera!");
    } else {
        Serial.println("Camera initialized successfully");
    }

    // Start Wi-Fi Access Point
    WiFi.softAP(ssid, password);
    IPAddress IP = WiFi.softAPIP();
    Serial.print("AP IP address: ");
    Serial.println(IP);

    // Setup Web Server Routes
    server.on("/", HTTP_GET, handleRoot);
    server.on("/stream", HTTP_GET, handleStream);
    server.on("/preds", HTTP_GET, handlePredictions);
    server.begin();
    Serial.println("HTTP server started");
}

static int ei_camera_get_data(size_t offset, size_t length, float *out_ptr) {
    size_t pixel_ix = offset * 3;
    size_t pixels_left = length;
    size_t out_ptr_ix = 0;

    while (pixels_left != 0) {
        out_ptr[out_ptr_ix] = (snapshot_buf[pixel_ix + 2] << 16) + (snapshot_buf[pixel_ix + 1] << 8) + snapshot_buf[pixel_ix];
        out_ptr_ix++;
        pixel_ix += 3;
        pixels_left--;
    }
    return 0;
}

// ─── Loop (Inference Engine) ──────────────────────────────────────────────
void loop() {
    server.handleClient(); // Handle incoming web/app requests

    snapshot_buf = (uint8_t*)malloc(EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS * EI_CAMERA_FRAME_BYTE_SIZE);
    if(snapshot_buf == nullptr) {
        delay(100);
        return;
    }

    ei::signal_t signal;
    signal.total_length = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT;
    signal.get_data = &ei_camera_get_data;

    if (ei_camera_capture((size_t)EI_CLASSIFIER_INPUT_WIDTH, (size_t)EI_CLASSIFIER_INPUT_HEIGHT, snapshot_buf) == false) {
        free(snapshot_buf);
        delay(100);
        return;
    }

    ei_impulse_result_t result = { 0 };
    EI_IMPULSE_ERROR err = run_classifier(&signal, &result, debug_nn);
    
    if (err == EI_IMPULSE_OK) {
        // Build JSON string of predictions to feed back to your app
        String json = "{";
        for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
            json += "\"" + String(ei_classifier_inferencing_categories[i]) + "\":" + String(result.classification[i].value, 4);
            if (i < EI_CLASSIFIER_LABEL_COUNT - 1) json += ",";
        }
        json += "}";
        latestPredictionJson = json;
    }

    free(snapshot_buf);
    delay(50); // Yield slightly for the web server to handle client frames smoothly
}

bool ei_camera_init(void) {
    if (is_initialised) return true;
    esp_err_t err = esp_camera_init(&camera_config);
    if (err != ESP_OK) return false;
    is_initialised = true;
    return true;
}

bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf) {
    if (!is_initialised) return false;
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) return false;
    bool converted = fmt2rgb888(fb->buf, fb->len, PIXFORMAT_JPEG, snapshot_buf);
    esp_camera_fb_return(fb);
    if (!converted) return false;

    if ((img_width != EI_CAMERA_RAW_FRAME_BUFFER_COLS) || (img_height != EI_CAMERA_RAW_FRAME_BUFFER_ROWS)) {
        ei::image::processing::crop_and_interpolate_rgb888(
            out_buf, EI_CAMERA_RAW_FRAME_BUFFER_COLS, EI_CAMERA_RAW_FRAME_BUFFER_ROWS,
            out_buf, img_width, img_height);
    }
    return true;
}