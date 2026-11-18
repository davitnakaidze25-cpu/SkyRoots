# SkyRoots

SkyRoots is a tabletop fogponics prototype for growing fresh food in a small space. The mobile web app connects to the tower over Bluetooth Low Energy. It shows chamber readings, sends crop profiles to the controller, and displays camera images and plant-classification results when the ESP32-CAM is attached.

[Open the mobile app](https://sky-roots-rose.vercel.app/) · [See the prototype photos](images/prototypes/) · [Set up the Arduino boards](arduino/README.md)

## Using the tower

1. Power on the tower and open the app in a browser that supports Web Bluetooth. Use HTTPS for a hosted copy or localhost for development.
2. Choose **Connect tower**, then **Connect chamber** and select **AeroGrow_ESP32**. Once connected, the dashboard illustration shows plants in the six cups and mist inside the tower. The illustration returns to its empty state on disconnect.
3. Open **Crops** to select a profile and send it to the controller. **Home** shows readings from the mainboard. **Camera** shows the latest received JPEG and prediction. **Grooty** can answer questions about the selected crop and chamber readings.

## Repository layout

| Folder | Contents |
| --- | --- |
| [public/](public/) | Mobile app entry point, styles, JavaScript and web manifest |
| [public/components/](public/components/) | Dashboard, crop profiles, camera, device connection and Grooty chat |
| [public/assets/](public/assets/) | App images and icons, the Grooty 3D model, and its bundled renderer |
| [api/](api/) | Server-side chat function and Python dependencies |
| [arduino/](arduino/) | Mainboard and ESP32-CAM sketches, wiring and library instructions |
| [images/](images/) | Prototype photographs, design references and the STEM fair award |
| [docs/](docs/) | Camera UART and Bluetooth protocol reference |

## Local preview

From the repository root, run `python main.py` and open [localhost:8000](http://localhost:8000). This serves the contents of `public/`. The static preview supports the dashboard and hardware connection. To run the chat function locally, start `vercel dev` from the repository root with `GROQ_API_KEY` available to the function.

## Chat and deployment

The browser sends Grooty messages to `/api/chat`. The Python function reads `GROQ_API_KEY` from its environment. Set it in the Vercel project’s environment variables for the environments you deploy and redeploy after changing it. The optional `GROQ_MODEL` setting overrides the default `llama-3.1-8b-instant`. The variable names are in [.env.example](.env.example).

Vercel uses the repository root as the project directory, serves static files from `public/`, and runs the Python function in [api/chat.py](api/chat.py). Bluetooth sensor reads and crop writes go directly between the browser and the tower. Chat requires an internet connection.
