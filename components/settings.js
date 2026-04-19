import { setTheme } from './themeManager.js';

let _onConnect    = null;
let _onDisconnect = null;
let logEl = null;

// ─── Main Render ──────────────────────────────────────────────────────────────
export function renderSettings(container, onConnect, onDisconnect) {
    _onConnect    = onConnect;
    _onDisconnect = onDisconnect;

    container.innerHTML = `
    <div class="settings-header">
        <h2 class="screen-title">Connection</h2>
        <span class="screen-subtitle">Pair with your AeroGrow ESP32 chamber</span>
    </div>

    <!-- BLE Instructions Card -->
    <div class="card card-ble">
        <div class="ble-icon-wrap">
            <svg class="ble-icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
            </svg>
        </div>
        <div class="ble-info">
            <div class="ble-title">Bluetooth Low Energy</div>
            <div class="ble-desc">Ensure your ESP32 is powered. Android users must enable Location Services for BLE scanning.</div>
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
            <span class="scan-label">SCAN & CONNECT</span>
            <span class="scan-ripple"></span>
        </button>

        <button class="btn-disconnect" id="btnDisconnect" onclick="window._disconnectDevice()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            DISCONNECT
        </button>
    </div>

    <!-- Connection Log -->
    <div class="card card-log">
        <div class="card-eyebrow" style="margin-bottom:10px">SYSTEM LOG</div>
        <div class="log-area" id="logArea">
            <span class="log-placeholder">[ Awaiting connection... ]</span>
        </div>
    </div>

    <!-- Theme Selection — High-Definition Environment Cards -->
    <div class="card card-theme-select" style="margin-top: 24px;">
        <div class="card-eyebrow" style="margin-bottom:16px">ENVIRONMENT</div>

        <!-- SPACE -->
        <div class="theme-card" id="theme-space" onclick="window._setTheme('space')">
            <div class="theme-card-preview theme-preview-space">
                <div class="tp-star tp-s1"></div><div class="tp-star tp-s2"></div><div class="tp-star tp-s3"></div>
                <div class="tp-star tp-s4"></div><div class="tp-star tp-s5"></div><div class="tp-star tp-s6"></div>
                <div class="tp-nebula"></div>
                <div class="tp-label-inner">DEEP SPACE</div>
            </div>
            <div class="theme-card-info">
                <div class="theme-card-name">Deep Space</div>
                <div class="theme-card-desc">Neon bioluminescent • Parallax stars • Shooting comets</div>
                <div class="theme-card-badge">
                    <span class="tc-dot" style="background:#00ff88;box-shadow:0 0 8px #00ff88"></span>
                    <span class="tc-dot" style="background:#00d2ff;box-shadow:0 0 8px #00d2ff"></span>
                    <span class="tc-dot" style="background:#b44cff;box-shadow:0 0 8px #b44cff"></span>
                </div>
            </div>
            <div class="theme-card-check" id="check-space">✓</div>
        </div>

        <!-- OCEAN -->
        <div class="theme-card" id="theme-ocean" onclick="window._setTheme('ocean')">
            <div class="theme-card-preview theme-preview-ocean">
                <div class="tp-bubble tp-b1"></div><div class="tp-bubble tp-b2"></div>
                <div class="tp-bubble tp-b3"></div><div class="tp-bubble tp-b4"></div>
                <div class="tp-ray tp-r1"></div><div class="tp-ray tp-r2"></div>
                <div class="tp-label-inner" style="color:#d4f5f0">ABYSSAL OCEAN</div>
            </div>
            <div class="theme-card-info">
                <div class="theme-card-name">Abyssal Ocean</div>
                <div class="theme-card-desc">Liquid caustics • Rising bubbles • Bioluminescent fish</div>
                <div class="theme-card-badge">
                    <span class="tc-dot" style="background:#00ead3;box-shadow:0 0 8px rgba(0,234,211,0.8)"></span>
                    <span class="tc-dot" style="background:#00c3ff;box-shadow:0 0 8px rgba(0,195,255,0.8)"></span>
                    <span class="tc-dot" style="background:#ff7b92;box-shadow:0 0 6px rgba(255,123,146,0.6)"></span>
                </div>
            </div>
            <div class="theme-card-check" id="check-ocean">✓</div>
        </div>

        <!-- VERDANT -->
        <div class="theme-card" id="theme-verdant" onclick="window._setTheme('verdant')">
            <div class="theme-card-preview theme-preview-verdant">
                <div class="tp-leaf tp-l1"></div><div class="tp-leaf tp-l2"></div><div class="tp-leaf tp-l3"></div>
                <div class="tp-mote tp-m1"></div><div class="tp-mote tp-m2"></div><div class="tp-mote tp-m3"></div>
                <div class="tp-label-inner" style="color:#1b4332">VERDANT EARTH</div>
            </div>
            <div class="theme-card-info">
                <div class="theme-card-name">Verdant Earth</div>
                <div class="theme-card-desc">Cloud sweeps • Pollen motes • Organic breezy feel</div>
                <div class="theme-card-badge">
                    <span class="tc-dot" style="background:#2d6a4f"></span>
                    <span class="tc-dot" style="background:#9c6644"></span>
                    <span class="tc-dot" style="background:#b5834a"></span>
                </div>
            </div>
            <div class="theme-card-check" id="check-verdant">✓</div>
        </div>
    </div>

    <!-- Device Info -->
    <div class="card card-device-info">
        <div class="card-eyebrow" style="margin-bottom:12px">TARGET DEVICE</div>
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
    </div>
    `;

    logEl = document.getElementById('logArea');
    window._setTheme = handleThemeSelect;
    
    // Highlight currently active theme
    const active = localStorage.getItem('skyroots_theme_preference') || 'space';
    highlightTheme(active);
}

function handleThemeSelect(themeName) {
    setTheme(themeName);
    highlightTheme(themeName);
}

function highlightTheme(themeName) {
    document.querySelectorAll('.theme-card').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.theme-card-check').forEach(el => el.style.opacity = '0');
    const target = document.getElementById('theme-' + themeName);
    if (target) {
        target.classList.add('active');
        const check = target.querySelector('.theme-card-check');
        if (check) check.style.opacity = '1';
    }
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
    line.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg">${msg}</span>`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
}

// ─── Scan Animation Helpers ───────────────────────────────────────────────────
export function setScanState(scanning) {
    const btn = document.getElementById('btnScan');
    if (!btn) return;
    if (scanning) {
        btn.classList.add('scanning');
        btn.querySelector('.scan-label').textContent = 'SCANNING…';
    } else {
        btn.classList.remove('scanning');
        btn.querySelector('.scan-label').textContent = 'SCAN & CONNECT';
    }
}
