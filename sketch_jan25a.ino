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

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_NOTIFY_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_WRITE_UUID     "826a2d07-2831-411f-9988-3a9d91f2d658"

DHT dht(DHTPIN, DHTTYPE);
Adafruit_NeoPixel pixels(NUMPIXELS, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristicNotify = NULL;
bool deviceConnected = false;

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

void setUVColor(bool on) {
  uint32_t color = on ? pixels.Color(150, 0, 255) : pixels.Color(0, 0, 0); 
  for(int i=0; i<NUMPIXELS; i++) {
    pixels.setPixelColor(i, color);
  }
  pixels.show();
}

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) { deviceConnected = true; };
    void onDisconnect(BLEServer* pServer) { 
      deviceConnected = false;
      BLEDevice::startAdvertising();
    }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue().c_str(); 
      if (rxValue.length() > 0) {
        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, rxValue.c_str());
        if (!error) {
          sysState.plantName = doc["plant"].as<String>();
          sysState.mistInterval = doc["mist_int"];
          sysState.uvHours = doc["uv_hrs"];
          if(doc.containsKey("t_target")) sysState.targetTemp = doc["t_target"];
          sysState.uvStartTime = millis(); 
          Serial.println("Profile Updated: " + sysState.plantName);
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_MIST, OUTPUT); 
  pinMode(RELAY_TEMP, OUTPUT);

  digitalWrite(RELAY_MIST, HIGH); 
  sysState.mistOn = true;
  sysState.lastMistTime = millis();
  
  digitalWrite(RELAY_TEMP, LOW);

  dht.begin();
  pixels.begin();
  pixels.setBrightness(30); 
  setUVColor(true); 

  BLEDevice::init("AeroGrow_ESP32");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristicNotify = pService->createCharacteristic(CHAR_NOTIFY_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristicNotify->addDescriptor(new BLE2902());

  BLECharacteristic *pCharacteristicWrite = pService->createCharacteristic(CHAR_WRITE_UUID, BLECharacteristic::PROPERTY_WRITE);
  pCharacteristicWrite->setCallbacks(new MyCallbacks());

  pService->start();
  BLEDevice::startAdvertising();
  
  sysState.uvStartTime = millis();
  Serial.println("AeroGrow Online. Instant 5m Mist Active.");
}

void loop() {
  unsigned long now = millis();
  static unsigned long lastNotify = 0;
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  //Heater
  if (!isnan(t)) {
    if (t < sysState.targetTemp) { 
      digitalWrite(RELAY_TEMP, HIGH); 
      sysState.tempRelayOn = true;
    } else {
      digitalWrite(RELAY_TEMP, LOW); 
      sysState.tempRelayOn = false;
    }
  }

  //UV
  unsigned long runTime = now - sysState.uvStartTime;
  unsigned long targetUV = (unsigned long)sysState.uvHours * 3600 * 1000;
  if (runTime < targetUV) {
    sysState.uvOn = true;
    sysState.uvRemaining = (targetUV - runTime) / 1000;
  } else {
    sysState.uvOn = false;
    sysState.uvRemaining = 0;
  }
  setUVColor(sysState.uvOn);

  //MIST
  if (sysState.mistOn) {
    if (now - sysState.lastMistTime > 300000) {
       digitalWrite(RELAY_MIST, LOW); 
       sysState.mistOn = false; 
       sysState.lastMistTime = now;
    }
  } else {
    if (now - sysState.lastMistTime > (unsigned long)sysState.mistInterval * 1000) {
       digitalWrite(RELAY_MIST, HIGH); 
       sysState.mistOn = true; 
       sysState.lastMistTime = now;
    }
  }

  if (deviceConnected && (now - lastNotify > 1000)) {
    lastNotify = now;
    StaticJsonDocument<256> doc;
    doc["t"] = isnan(t) ? 0 : t;
    doc["h"] = isnan(h) ? 0 : h;
    doc["m"] = sysState.mistOn;
    doc["u"] = sysState.uvOn;
    doc["r"] = sysState.uvRemaining;
    doc["tr"] = sysState.tempRelayOn; 
    
    char buffer[256];
    serializeJson(doc, buffer);
    pCharacteristicNotify->setValue(buffer);
    pCharacteristicNotify->notify();
  }
}