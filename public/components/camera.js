// Read-only JPEG/prediction notifications from the existing AeroGrow BLE service.
// Wire format is documented in docs/esp32-camera-protocol.txt.
import { sensorState } from './sensorState.js';

const PREDICTIONS_UUID = "c1d92f43-2b1e-4a10-9f2e-1a2b3c4d5e01";
const META_UUID = "c1d92f43-2b1e-4a10-9f2e-1a2b3c4d5e02";
const CHUNK_UUID = "c1d92f43-2b1e-4a10-9f2e-1a2b3c4d5e03";
const MAX_IMAGE_SIZE = 48000;
let session = 0;
let subscriptions = [];
let transfer = null;
let transferTimer = null;
let frameUrl = null;
let frameNumber = 0;
let zoom = 1;
const pendingUrls = new Set();

const element = (id) => document.getElementById(id);

function status(label, message) {
  if (element("cameraBadge")) element("cameraBadge").textContent = label;
  if (element("cameraStatus")) element("cameraStatus").textContent = message;
}

function clearTransfer() {
  clearTimeout(transferTimer);
  transferTimer = null;
  transfer = null;
}

function discardTransfer(message) {
  clearTransfer();
  status("Waiting", message);
}

function updateZoom() {
  const image = element("cameraFrame");
  if (image) image.style.transform = `scale(${zoom})`;
  if (element("cameraZoom"))
    element("cameraZoom").textContent = `${zoom.toFixed(2)}×`;
  if (element("cameraZoomOut"))
    element("cameraZoomOut").disabled = !frameUrl || zoom <= 1;
  if (element("cameraZoomIn"))
    element("cameraZoomIn").disabled = !frameUrl || zoom >= 3;
}

export function renderCamera(container) {
  container.innerHTML = `
    <div class="camera-heading"><h2 class="screen-title">Camera</h2><span class="camera-device">ESP32-CAM</span></div>
    <div class="card camera-card">
        <div class="camera-view">
            <img id="cameraFrame" class="camera-frame" alt="Latest image from the tower’s ESP32 camera" hidden>
            <div id="cameraPlaceholder" class="camera-placeholder">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 5 9.5 3h5L16 5h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="12" r="4"/></svg>
                <span>No frame yet</span>
            </div>
            <span id="cameraBadge" class="camera-badge">Offline</span>
        </div>
        <div class="camera-toolbar" aria-label="Image zoom">
            <span id="cameraTimestamp" class="camera-timestamp">Latest frame: —</span>
            <button type="button" id="cameraZoomOut" aria-label="Zoom out" disabled>−</button>
            <span id="cameraZoom">1.00×</span>
            <button type="button" id="cameraZoomIn" aria-label="Zoom in" disabled>+</button>
        </div>
        <p id="cameraStatus" class="camera-status" role="status">Connect your tower to receive images.</p>
        <a href="#settings" class="camera-connect">Connect tower <span aria-hidden="true">↗</span></a>
    </div>
    <div class="card camera-prediction">
        <span class="card-eyebrow">Camera prediction</span>
        <p id="cameraPrediction">Waiting for a result</p>
        <span id="cameraPredictionTime" class="camera-timestamp"></span>
    </div>`;
  element("cameraZoomOut").addEventListener("click", () => {
    zoom = Math.max(1, zoom - 0.25);
    updateZoom();
  });
  element("cameraZoomIn").addEventListener("click", () => {
    zoom = Math.min(3, zoom + 0.25);
    updateZoom();
  });
}

export function resetCamera() {
  sensorState.cameraPrediction = null;
  session++;
  frameNumber++;
  for (const { characteristic, listener } of subscriptions) {
    characteristic.removeEventListener("characteristicvaluechanged", listener);
  }
  subscriptions = [];
  clearTransfer();
  for (const url of pendingUrls) URL.revokeObjectURL(url);
  pendingUrls.clear();
  if (frameUrl) URL.revokeObjectURL(frameUrl);
  frameUrl = null;
  zoom = 1;
  const image = element("cameraFrame");
  if (image) {
    image.hidden = true;
    image.removeAttribute("src");
  }
  if (element("cameraPlaceholder")) element("cameraPlaceholder").hidden = false;
  if (element("cameraTimestamp"))
    element("cameraTimestamp").textContent = "Latest frame: —";
  if (element("cameraPrediction"))
    element("cameraPrediction").textContent = "Waiting for a result";
  if (element("cameraPredictionTime"))
    element("cameraPredictionTime").textContent = "";
  updateZoom();
  status("Offline", "Connect your tower to receive images.");
}

// Called after the existing sensor subscription succeeds. Camera failures are
// isolated so an older board can still provide temperature/humidity readings.
export async function subscribeCamera(service) {
  resetCamera();
  const token = session;
  const acquired = [];
  status("Connecting", "Opening camera channels…");
  try {
    // Subscribe to chunks before metadata so no partial frame is displayed.
    for (const [uuid, handler] of [
      [CHUNK_UUID, onChunk],
      [META_UUID, onMetadata],
      [PREDICTIONS_UUID, onPrediction],
    ]) {
      const characteristic = await service.getCharacteristic(uuid);
      if (token !== session) return;
      const listener = (event) => {
        if (token === session) handler(event.target.value);
      };
      const entry = { characteristic, listener };
      acquired.push(entry);
      subscriptions.push(entry);
      characteristic.addEventListener("characteristicvaluechanged", listener);
      await characteristic.startNotifications();
      if (token !== session) {
        characteristic.removeEventListener(
          "characteristicvaluechanged",
          listener,
        );
        return;
      }
    }
    if (!frameUrl && !transfer)
      status("Waiting", "Connected. Waiting for a camera frame.");
  } catch (error) {
    if (token !== session) return;
    resetCamera();
    status(
      "Unavailable",
      "Camera channels unavailable. Reconnect from Device to retry.",
    );
    // Remove partial subscriptions without affecting the sensor channel.
    for (const { characteristic } of acquired) {
      try {
        await characteristic.stopNotifications();
      } catch {
        /* disconnected */
      }
    }
    console.warn("ESP32 camera notification setup failed:", error);
  }
}

function onMetadata(view) {
  clearTransfer();
  if (view.byteLength !== 4) {
    discardTransfer("Invalid frame header. Waiting for the next image.");
    return;
  }
  const size = view.getUint32(0, true);
  if (size < 4 || size > MAX_IMAGE_SIZE) {
    discardTransfer("Invalid frame size. Waiting for the next image.");
    return;
  }
  transfer = { data: new Uint8Array(size), received: 0 };
  status("Receiving", "Receiving a new image…");
  transferTimer = setTimeout(
    () => discardTransfer("Frame incomplete. Waiting for the next image."),
    12000,
  );
}

function onChunk(view) {
  if (!transfer) return;
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  if (
    !bytes.length ||
    transfer.received + bytes.length > transfer.data.length
  ) {
    discardTransfer("Frame interrupted. Waiting for the next image.");
    return;
  }
  // Copy now: the Bluetooth event's backing buffer may be reused.
  transfer.data.set(bytes, transfer.received);
  transfer.received += bytes.length;
  if (transfer.received === transfer.data.length) {
    const data = transfer.data;
    clearTransfer();
    displayFrame(data);
  }
}

function displayFrame(data) {
  if (
    data[0] !== 0xff ||
    data[1] !== 0xd8 ||
    data[data.length - 2] !== 0xff ||
    data[data.length - 1] !== 0xd9
  ) {
    discardTransfer("Invalid image. Waiting for the next frame.");
    return;
  }
  const token = session;
  const number = ++frameNumber;
  const url = URL.createObjectURL(new Blob([data], { type: "image/jpeg" }));
  pendingUrls.add(url);
  const preload = new Image();
  const release = () => {
    pendingUrls.delete(url);
    URL.revokeObjectURL(url);
  };
  preload.onload = () => {
    if (
      token !== session ||
      number !== frameNumber ||
      !element("cameraFrame")
    ) {
      release();
      return;
    }
    pendingUrls.delete(url);
    const previous = frameUrl;
    frameUrl = url;
    const image = element("cameraFrame");
    image.src = url;
    image.hidden = false;
    element("cameraPlaceholder").hidden = true;
    element("cameraTimestamp").textContent =
      `Received ${new Date().toLocaleTimeString()}`;
    if (previous) URL.revokeObjectURL(previous);
    updateZoom();
    status("Latest image", "Images update automatically while connected.");
  };
  preload.onerror = () => {
    release();
    if (token === session && number === frameNumber)
      status(
        "Waiting",
        "Image could not be decoded. Waiting for the next frame.",
      );
  };
  preload.src = url;
}

function onPrediction(view) {
  try {
    const predictions = JSON.parse(new TextDecoder().decode(view));
    if (
      !predictions ||
      Array.isArray(predictions) ||
      typeof predictions !== "object"
    )
      return;
    const best = Object.entries(predictions)
      .filter(
        ([, value]) =>
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 1,
      )
      .sort((a, b) => b[1] - a[1])[0];
    if (!best) return;
    sensorState.cameraPrediction = `${best[0]} · ${(best[1] * 100).toFixed(1)}% confidence`;
    element("cameraPrediction").textContent = sensorState.cameraPrediction;
    element("cameraPredictionTime").textContent =
      `Received ${new Date().toLocaleTimeString()}`;
  } catch {
    /* Ignore incomplete or malformed prediction notifications. */
  }
}
