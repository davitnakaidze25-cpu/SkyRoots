#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <Adafruit_NeoPixel.h>

#define DHTPIN 23
#define DHTTYPE DHT22
#define PIN_NEOPIXEL 21
#define RELAY_TEMP 22
#define RELAY_MIST 25
#define NUMPIXELS 30

#define SERVICE_UUID             "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_NOTIFY_UUID         "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_WRITE_UUID          "826a2d07-2831-411f-9988-3a9d91f2d658"
#define CHAR_PREDICTIONS_UUID    "c1d92f43-2b1e-4a10-9f2e-1a2b3c4d5e01"
#define CHAR_IMAGE_META_UUID     "c1d92f43-2b1e-4a10-9f2e-1a2b3c4d5e02"
#define CHAR_IMAGE_CHUNK_UUID    "c1d92f43-2b1e-4a10-9f2e-1a2b3c4d5e03"

// Adafruit Feather ESP32-S3 D5/D6 are GPIO 5/GPIO 6.
#define UART_RX_PIN 5
#define UART_TX_PIN 6
#define UART_BAUD 460800

#define SYNC_BYTE_0 0xAA
#define SYNC_BYTE_1 0x55
#define TYPE_PREDICTIONS 'P'
#define TYPE_IMAGE 'I'

#define BLE_MTU 247
#define IMAGE_CHUNK_SIZE 180
#define MAX_IMAGE_SIZE 48000
#define MAX_PREDICTION_SIZE 1024

DHT dht(DHTPIN, DHTTYPE);
Adafruit_NeoPixel pixels(NUMPIXELS, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);

BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristicNotify = nullptr;
BLECharacteristic* predictionsChar = nullptr;
BLECharacteristic* imageMetaChar = nullptr;
BLECharacteristic* imageChunkChar = nullptr;
bool deviceConnected = false;
String latestMLGuess = "blank";

struct State {
  String plantName = "Default";
  int mistInterval = 300;
  int uvHours = 12;
  float targetTemp = 25.0;
  unsigned long lastMistTime = 0;
  bool mistOn = true;
  unsigned long uvStartTime = 0;
  bool uvOn = true;
  bool tempRelayOn = false;
  long uvRemaining = 0;
} sysState;

enum RxState { WAIT_SYNC0, WAIT_SYNC1, WAIT_TYPE, WAIT_LEN, WAIT_PAYLOAD, WAIT_CHECKSUM };
RxState rxState = WAIT_SYNC0;
uint8_t rxType = 0;
uint32_t rxLen = 0;
uint8_t rxLenBuf[4];
uint8_t rxLenBytesRead = 0;
uint8_t* rxPayload = nullptr;
uint32_t rxPayloadIndex = 0;
uint8_t rxChecksum = 0;
uint8_t imageBuffer[MAX_IMAGE_SIZE];
uint32_t uartBytesReceived = 0;
uint32_t uartPacketsReceived = 0;

void handleCompletePacket(uint8_t type, uint8_t* payload, uint32_t len);
void sendImageOverBle(uint8_t* data, uint32_t len);
void pollUartForPacket();

void resetUartParser() {
  if (rxPayload != nullptr && rxPayload != imageBuffer) {
    free(rxPayload);
  }
  rxPayload = nullptr;
  rxPayloadIndex = 0;
  rxLenBytesRead = 0;
  rxLen = 0;
  rxChecksum = 0;
  rxState = WAIT_SYNC0;
}

void setUVColor(bool on) {
  const uint32_t color = on ? pixels.Color(150, 0, 255) : pixels.Color(0, 0, 0);
  for (int i = 0; i < NUMPIXELS; i++) {
    pixels.setPixelColor(i, color);
  }
  pixels.show();
}

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {
    deviceConnected = true;
    Serial.println("[BLE] Mobile app connected");
  }

  void onDisconnect(BLEServer*) override {
    deviceConnected = false;
    Serial.println("[BLE] Mobile app disconnected; advertising restarted");
    BLEDevice::startAdvertising();
  }
};

class MyCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    const String rxValue = characteristic->getValue().c_str();
    if (rxValue.length() == 0) return;

    StaticJsonDocument<256> doc;
    const DeserializationError error = deserializeJson(doc, rxValue);
    if (error) {
      Serial.printf("[BLE Config] Invalid profile JSON: %s\n", error.c_str());
      return;
    }

    if (doc.containsKey("plant")) sysState.plantName = doc["plant"].as<String>();
    if (doc.containsKey("mist_int")) sysState.mistInterval = doc["mist_int"];
    if (doc.containsKey("uv_hrs")) sysState.uvHours = doc["uv_hrs"];
    if (doc.containsKey("t_target")) sysState.targetTemp = doc["t_target"];
    sysState.uvStartTime = millis();
    Serial.println("[BLE Config] Profile updated: " + sysState.plantName);
  }
};

void setup() {
  Serial.begin(115200);
  Serial2.begin(UART_BAUD, SERIAL_8N1, UART_RX_PIN, UART_TX_PIN);

  pinMode(RELAY_MIST, OUTPUT);
  pinMode(RELAY_TEMP, OUTPUT);
  digitalWrite(RELAY_MIST, HIGH);
  digitalWrite(RELAY_TEMP, LOW);
  sysState.mistOn = true;
  sysState.lastMistTime = millis();

  dht.begin();
  pixels.begin();
  pixels.setBrightness(30);
  setUVColor(true);

  BLEDevice::init("AeroGrow_ESP32");
  BLEDevice::setMTU(BLE_MTU);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService* service = pServer->createService(SERVICE_UUID);
  pCharacteristicNotify = service->createCharacteristic(CHAR_NOTIFY_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristicNotify->addDescriptor(new BLE2902());

  BLECharacteristic* writeCharacteristic = service->createCharacteristic(CHAR_WRITE_UUID, BLECharacteristic::PROPERTY_WRITE);
  writeCharacteristic->setCallbacks(new MyCallbacks());

  predictionsChar = service->createCharacteristic(CHAR_PREDICTIONS_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  predictionsChar->addDescriptor(new BLE2902());
  imageMetaChar = service->createCharacteristic(CHAR_IMAGE_META_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  imageMetaChar->addDescriptor(new BLE2902());
  imageChunkChar = service->createCharacteristic(CHAR_IMAGE_CHUNK_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  imageChunkChar->addDescriptor(new BLE2902());

  service->start();
  BLEDevice::startAdvertising();

  sysState.uvStartTime = millis();
  Serial.println("AeroGrow main board online; UART camera receiver ready");
  Serial.printf("Camera UART RX=%d TX=%d at %lu baud\n", UART_RX_PIN, UART_TX_PIN, (unsigned long)UART_BAUD);
}

void loop() {
  const unsigned long now = millis();
  static unsigned long lastNotify = 0;
  static unsigned long lastStatus = 0;

  const float humidity = dht.readHumidity();
  const float temperature = dht.readTemperature();

  if (!isnan(temperature)) {
    sysState.tempRelayOn = temperature < sysState.targetTemp;
    digitalWrite(RELAY_TEMP, sysState.tempRelayOn ? HIGH : LOW);
  }

  const unsigned long targetUV = (unsigned long)sysState.uvHours * 3600000UL;
  const unsigned long uvElapsed = now - sysState.uvStartTime;
  sysState.uvOn = uvElapsed < targetUV;
  sysState.uvRemaining = sysState.uvOn ? (targetUV - uvElapsed) / 1000UL : 0;
  setUVColor(sysState.uvOn);

  if (sysState.mistOn) {
    if (now - sysState.lastMistTime > 300000UL) {
      digitalWrite(RELAY_MIST, LOW);
      sysState.mistOn = false;
      sysState.lastMistTime = now;
    }
  } else if (now - sysState.lastMistTime > (unsigned long)sysState.mistInterval * 1000UL) {
    digitalWrite(RELAY_MIST, HIGH);
    sysState.mistOn = true;
    sysState.lastMistTime = now;
  }

  if (deviceConnected && now - lastNotify >= 1000UL) {
    lastNotify = now;
    StaticJsonDocument<256> doc;
    doc["t"] = isnan(temperature) ? 0 : temperature;
    doc["h"] = isnan(humidity) ? 0 : humidity;
    doc["m"] = sysState.mistOn;
    doc["u"] = sysState.uvOn;
    doc["r"] = sysState.uvRemaining;
    doc["tr"] = sysState.tempRelayOn;

    char buffer[256];
    const size_t length = serializeJson(doc, buffer, sizeof(buffer));
    pCharacteristicNotify->setValue((uint8_t*)buffer, length);
    pCharacteristicNotify->notify();
  }

  if (now - lastStatus >= 2000UL) {
    lastStatus = now;
    Serial.printf("STATUS | Temp: %.1f C | Humidity: %.1f%% | UV: %s | Mist: %s | ML: %s\n",
                  isnan(temperature) ? 0.0 : temperature,
                  isnan(humidity) ? 0.0 : humidity,
            sysState.uvOn ? "ON" : "OFF",
            sysState.mistOn ? "ON" : "OFF",
            latestMLGuess.c_str());
    Serial.printf("App %s | UART camera: %lu bytes total, %lu valid packets, parser state %u\n",
            deviceConnected ? "connected" : "disconnected",
            (unsigned long)uartBytesReceived,
            (unsigned long)uartPacketsReceived,
            (unsigned int)rxState);
  }

  pollUartForPacket();
}

void pollUartForPacket() {
  while (Serial2.available() > 0) {
    const uint8_t byteValue = (uint8_t)Serial2.read();
    uartBytesReceived++;

    switch (rxState) {
      case WAIT_SYNC0:
        if (byteValue == SYNC_BYTE_0) rxState = WAIT_SYNC1;
        break;

      case WAIT_SYNC1:
        if (byteValue == SYNC_BYTE_1) rxState = WAIT_TYPE;
        else rxState = byteValue == SYNC_BYTE_0 ? WAIT_SYNC1 : WAIT_SYNC0;
        break;

      case WAIT_TYPE:
        if (byteValue != TYPE_PREDICTIONS && byteValue != TYPE_IMAGE) {
          resetUartParser();
          break;
        }
        rxType = byteValue;
        rxLenBytesRead = 0;
        rxState = WAIT_LEN;
        break;

      case WAIT_LEN:
        rxLenBuf[rxLenBytesRead++] = byteValue;
        if (rxLenBytesRead == sizeof(rxLenBuf)) {
          rxLen = (uint32_t)rxLenBuf[0]
                | ((uint32_t)rxLenBuf[1] << 8)
                | ((uint32_t)rxLenBuf[2] << 16)
                | ((uint32_t)rxLenBuf[3] << 24);

          const uint32_t maxLength = rxType == TYPE_IMAGE ? MAX_IMAGE_SIZE : MAX_PREDICTION_SIZE;
          if (rxLen == 0 || rxLen > maxLength) {
            Serial.printf("[UART Error] Invalid packet length: %lu\n", (unsigned long)rxLen);
            resetUartParser();
            break;
          }

          rxPayload = rxType == TYPE_IMAGE ? imageBuffer : (uint8_t*)malloc(rxLen + 1);
          if (rxPayload == nullptr) {
            Serial.println("[UART Error] Payload allocation failed");
            resetUartParser();
            break;
          }
          rxPayloadIndex = 0;
          rxChecksum = 0;
          rxState = WAIT_PAYLOAD;
        }
        break;

      case WAIT_PAYLOAD:
        if (rxPayloadIndex >= rxLen) {
          resetUartParser();
          break;
        }
        rxPayload[rxPayloadIndex++] = byteValue;
        rxChecksum ^= byteValue;
        if (rxPayloadIndex == rxLen) rxState = WAIT_CHECKSUM;
        break;

      case WAIT_CHECKSUM:
        if (byteValue == rxChecksum) {
          uartPacketsReceived++;
          handleCompletePacket(rxType, rxPayload, rxLen);
        } else {
          Serial.println("[UART Error] Checksum mismatch; packet dropped");
        }
        resetUartParser();
        break;
    }
  }
}

void handleCompletePacket(uint8_t type, uint8_t* payload, uint32_t len) {
  if (type == TYPE_PREDICTIONS) {
    payload[len] = '\0';
    latestMLGuess = (char*)payload;
    if (deviceConnected) {
      predictionsChar->setValue(payload, len);
      predictionsChar->notify();
    }
    return;
  }

  if (type == TYPE_IMAGE) {
    Serial.printf("[CAMERA IMAGE] %lu bytes\n", (unsigned long)len);
    if (deviceConnected) sendImageOverBle(payload, len);
    else Serial.println("[BLE] App disconnected; image was not forwarded");
  }
}

void sendImageOverBle(uint8_t* data, uint32_t len) {
  uint8_t metadata[4] = {
    (uint8_t)(len & 0xFF),
    (uint8_t)((len >> 8) & 0xFF),
    (uint8_t)((len >> 16) & 0xFF),
    (uint8_t)((len >> 24) & 0xFF)
  };
  imageMetaChar->setValue(metadata, sizeof(metadata));
  imageMetaChar->notify();
  delay(20);

  uint32_t offset = 0;
  while (offset < len && deviceConnected) {
    const uint32_t chunkLength = min((uint32_t)IMAGE_CHUNK_SIZE, len - offset);
    imageChunkChar->setValue(data + offset, chunkLength);
    imageChunkChar->notify();
    offset += chunkLength;
    delay(15);
  }
}

