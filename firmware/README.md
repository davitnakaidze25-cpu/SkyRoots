# SkyRoots Firmware

Open and upload each sketch from its own folder:

- `firmware/mainboard/mainboard.ino` runs the BLE sensor board and receives the camera UART packets.
- `firmware/camera/camera.ino` runs the AI Thinker ESP32-CAM and sends inference results and JPEG frames.

Install the ESP32 Arduino board package and the sketch libraries: ESP32 BLE, DHT sensor library, ArduinoJson, Adafruit NeoPixel, and the generated `skyrooty_inferencing` Edge Impulse library. Select an AI Thinker ESP32-CAM board with PSRAM for the camera sketch and Adafruit Feather ESP32-S3 for the main-board sketch.

Connect camera GPIO 15 (TX) to Feather D5/GPIO 5 (RX), camera GPIO 14 (RX) to Feather D6/GPIO 6 (TX), and connect the board grounds. UART is 460800 baud, 8-N-1, at 3.3 V logic. Do not connect UART pins to 5 V.

The image relay uses a 247-byte BLE MTU with 180-byte notification payloads. The connected BLE central must negotiate that MTU for image chunks to fit. Prediction JSON is sent as one notification and must fit the negotiated notification payload.

