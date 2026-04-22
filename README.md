SkyRoots is a mobile-first AI system that monitors plant health in real time using low-cost IoT hardware and intelligent diagnostics. By combining an ESP32-based sensor node, Bluetooth communication, and AI-driven analysis, SkyRoots helps users detect plant stress early and take precise action.

🚀 Overview

Plant care is often reactive—problems like nutrient deficiencies, overwatering, or disease are only noticed when visible damage occurs. SkyRoots shifts this paradigm to proactive, data-driven plant care.

Our system continuously gathers environmental and plant-level data through an ESP32 device and transmits it via Bluetooth to a mobile application. The app analyzes this data and provides actionable insights, early warnings, and AI-assisted recommendations.

🧠 Key Features
📡 Real-time Monitoring
Continuous tracking of plant conditions (humidity, temperature, soil moisture, etc.)
🔵 Bluetooth Low Energy (BLE) Integration
Seamless communication between ESP32 and mobile app without internet dependency
🤖 AI-Powered Diagnostics
Detects early signs of plant stress and disease using intelligent models
📊 Smart Recommendations
Provides personalized care suggestions based on plant type and conditions
🔔 Proactive Alerts
Notifies users before issues become critical
🏗️ System Architecture
[Plant + Sensors]
        ↓
   ESP32 Module
        ↓ (BLE)
   Mobile App
        ↓
   AI Processing Layer
        ↓
 Insights & Notifications
Components:
Hardware Layer
ESP32 microcontroller with connected sensors (soil moisture, temperature, humidity)
Communication Layer
Bluetooth Low Energy (BLE) for efficient, low-power data transfer
Mobile Application
User interface for monitoring, alerts, and interaction
AI Layer
Processes incoming data to detect anomalies and recommend actions
📱 Mobile App Capabilities
Live dashboard of plant vitals
Historical data visualization
AI-generated health status
Care suggestions tailored to species
Notification system for urgent issues
🔬 Innovation

SkyRoots stands out by integrating:

Edge + AI synergy
Lightweight sensing on-device, intelligent reasoning on mobile
Accessibility-first design
Uses affordable, widely available hardware (ESP32)
Offline-first capability
Bluetooth-based communication avoids reliance on cloud infrastructure
Preventive plant care model
Focuses on early detection rather than reactive treatment
🌍 Impact

SkyRoots has potential applications across:

Home gardening — helping individuals maintain healthy plants effortlessly
Urban agriculture — optimizing small-scale food production
Education — teaching biology, sustainability, and IoT integration
Sustainability — reducing plant loss and resource waste
🛠️ Tech Stack
Hardware: ESP32
Communication: Bluetooth Low Energy (BLE)
Mobile: (e.g., Flutter / React Native — customizable)
AI Layer: Lightweight ML models / API-based intelligence
Backend (optional): Cloud sync & analytics
🔧 Setup (Conceptual)
Flash firmware to ESP32
Connect sensors to ESP32 pins
Pair device with mobile app via Bluetooth
Start monitoring plant data in real time
🔮 Future Development
Computer vision (leaf analysis via camera)
Disease classification models
Multi-plant ecosystem tracking
Cloud-based analytics dashboard
Integration with automated irrigation systems
🤝 Why SkyRoots?

SkyRoots is more than a plant monitoring tool—it is a step toward intelligent, sustainable interaction with living systems.

By merging AI with real-world sensing, we aim to make plant care:

Predictive
Personalized
Effortless
📌 Project Status

🚧 Prototype / Early-stage development
Actively evolving toward a scalable, production-ready system
