SkyRoots is a mobile-first system for real-time plant monitoring using low-cost IoT hardware and AI. An ESP32 device collects plant data and sends it via Bluetooth to a mobile app, where AI analyzes conditions and gives simple, actionable insights.

🚀 Overview:
Plant care is usually reactive—issues like nutrient deficiency or disease are noticed too late. SkyRoots makes it proactive.
The ESP32 gathers environmental data and sends it to the mobile app, which becomes the core control center: tracking plant health, sending alerts, and guiding users with clear recommendations.

🧠 Key Features:
📡 Real-time monitoring (temperature, humidity, moisture)
🔵 Bluetooth (BLE) connection — no internet required
🤖 AI diagnostics for early problem detection
📊 Smart, simple care recommendations
🔔 Alerts before issues become critical

🏗️ System Flow:
Sensors → ESP32 → Bluetooth → Mobile App → AI → Insights

📱 Mobile App:
Live plant health dashboard
AI-based status and suggestions
Notifications for problems
Simple control and monitoring in one place

🔬 Why It’s Different:
Mobile-first experience (app is the brain)
Low-cost and accessible hardware (ESP32)
Works offline via Bluetooth
Focus on early detection, not reaction

🌍 Use Cases:
Home gardening
Urban farming
Education & sustainability

🛠️ Tech Stack:
ESP32
Bluetooth Low Energy (BLE)
Mobile app (Flutter / React Native)
AI models / API

🔧 Setup:
Flash ESP32
Connect sensors
Pair with mobile app
Start monitoring

🔮 Future:
Camera-based plant analysis
Disease detection
Multi-plant tracking
Cloud analytics

📌 Status:
🚧 Early-stage prototype, actively developing

## Groq API setup

Grooty calls Groq from the server-side `/api/chat` function. Keep the API key out of frontend code and source control.

For Vercel:

1. Create an API key in the Groq console.
2. In the Vercel project, open **Settings > Environment Variables** and add `GROQ_API_KEY` with the key value. Enable it for the deployment environments you use, then redeploy.
3. Optionally add `GROQ_MODEL` to select a model available to your Groq account. The default is `llama-3.3-70b-versatile`.

For local API testing, install the Vercel CLI, run `vercel env pull .env.local`, then run `vercel dev`. The `.env.local` file is ignored by Git. `python main.py` serves the static frontend only and does not run the `/api/chat` function.

An API key identifies your account; it does not increase the provider's quota by itself. Before the demo, check Groq's current account limits and billing, and confirm that the selected model has enough available usage for your expected traffic. Never put the key in browser JavaScript or commit it to the repository.
