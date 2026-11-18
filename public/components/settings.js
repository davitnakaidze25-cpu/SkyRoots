
let _onConnect    = null;
let _onDisconnect = null;
let logEl = null;

// ─── Main Render ──────────────────────────────────────────────────────────────
export function renderSettings(container, onConnect, onDisconnect) {
    _onConnect    = onConnect;
    _onDisconnect = onDisconnect;

    container.innerHTML = `
    <div class="settings-header">
        <h2 class="screen-title">Device</h2>
    </div>

    <!-- BLE Instructions Card -->
    <div class="card card-ble">
        <div class="ble-icon-wrap">
            <svg class="ble-icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
            </svg>
        </div>
        <div class="ble-info">
            <div class="ble-title">AeroGrow</div>
            <div class="ble-desc">Power on your tower to connect.</div>
        </div>
    </div>

    <!-- Action Buttons -->
    <div class="ble-btn-group">
        <button class="btn-scan" id="btnScan" onclick="window._connectDevice()">
            <span class="scan-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
            </span>
            <span class="scan-label">Connect chamber</span>
            <span class="scan-ripple"></span>
        </button>

        <button class="btn-disconnect" id="btnDisconnect" onclick="window._disconnectDevice()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Disconnect
        </button>
    </div>

    <!-- Connection Log -->
    <details class="card card-log">
        <summary>Connection log</summary>
        <div class="log-area" id="logArea">
            <span class="log-placeholder">No activity yet.</span>
        </div>
    </details>

    <!-- Device Info -->
    <details class="card card-device-info">
        <summary>Device details</summary>
        <p class="device-help">On Android, enable Location Services if the tower isn’t found.</p>
        <div class="device-info-row">
            <span class="device-key">Name</span>
            <span class="device-val">AeroGrow_ESP32</span>
        </div>
        <div class="device-info-row">
            <span class="device-key">Service UUID</span>
            <span class="device-val mono">4fafc201…914b</span>
        </div>
        <div class="device-info-row">
            <span class="device-key">Protocol</span>
            <span class="device-val">BLE / GATT Notify + Write</span>
        </div>
        <div class="device-info-row">
            <span class="device-key">Data Rate</span>
            <span class="device-val">~1 packet / sec</span>
        </div>
    </details>
    `;

    logEl = document.getElementById('logArea');
}

// ─── Log Append ───────────────────────────────────────────────────────────────
export function appendLog(msg) {
    if (!logEl) logEl = document.getElementById('logArea');
    if (!logEl) return;
    const placeholder = logEl.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();

    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = 'log-line';
    const timestamp = document.createElement('span');
    timestamp.className = 'log-time';
    timestamp.textContent = `[${time}]`;
    const message = document.createElement('span');
    message.className = 'log-msg';
    message.textContent = msg;
    line.append(timestamp, ' ', message);
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
}

// ─── Scan Animation Helpers ───────────────────────────────────────────────────
export function setScanState(scanning) {
    const btn = document.getElementById('btnScan');
    if (!btn) return;
    if (scanning) {
        btn.classList.add('scanning');
        btn.querySelector('.scan-label').textContent = 'Scanning…';
    } else {
        btn.classList.remove('scanning');
        btn.querySelector('.scan-label').textContent = 'Connect chamber';
    }
}
