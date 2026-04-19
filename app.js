// app.js — Core Application Logic
// All BLE constants, UUIDs, PROFILES, and hardware communication are UNCHANGED.
// This file is a verbatim migration of the original inline <script>, now wired
// to the modular component layer.

import { renderDashboard, updateDashboard, setConnectionStatus, setActiveProfile } from './components/dashboard.js';
import { renderProfiles, showPreview, triggerUploadAnimation } from './components/profiles.js';
import { renderSettings, appendLog, setScanState } from './components/settings.js';
import { renderIntelligence } from './components/intelligence.js';
import { addLogEntry } from './components/sensorState.js';
import { initThemeManager } from './components/themeManager.js';

// ─── CONSTANTS (UNCHANGED) ────────────────────────────────────────────────────
const SERVICE_UUID      = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHAR_NOTIFY_UUID  = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const CHAR_WRITE_UUID   = "826a2d07-2831-411f-9988-3a9d91f2d658";

const PROFILES = {
    "Cucumber":    { mist: 180, uv: 12, t: 24, h: 75, icon: "🥒" },
    "Tomato":      { mist: 300, uv: 14, t: 22, h: 65, icon: "🍅" },
    "Lettuce":     { mist: 600, uv: 10, t: 18, h: 60, icon: "🥬" },
    "Cauliflower": { mist: 450, uv: 12, t: 20, h: 70, icon: "🥦" },
    "Clover":      { mist: 120, uv: 10, t: 21, h: 72, icon: "🍀" }
};

// ─── GLOBAL VARIABLES (UNCHANGED) ────────────────────────────────────────────
let bluetoothDevice;
let gattServer;
let writeCharacteristic;
let selectedProfile = null;

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function nav(screenId, navEl) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screenId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    navEl.classList.add('active');
}

// ─── LOG (UNCHANGED SIGNATURE) ────────────────────────────────────────────────
function log(msg) {
    addLogEntry(msg);
    // Also forward to legacy logArea fallback if settings not rendered
    appendLog(msg);
    const legacyLog = document.getElementById('logArea');
    if (legacyLog && !legacyLog.closest('#screen-settings')) {
        // skip double-writing; settings component owns logArea
    }
}

// ─── BLUETOOTH CONNECTION (UNCHANGED LOGIC) ───────────────────────────────────
async function connectDevice() {
    try {
        setScanState(true);
        log("Scanning for AeroGrow...");
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'AeroGrow_ESP32' }],
            optionalServices: [SERVICE_UUID]
        });

        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        log("Connecting to GATT...");
        gattServer = await bluetoothDevice.gatt.connect();

        log("Getting Service...");
        const service = await gattServer.getPrimaryService(SERVICE_UUID);

        log("Getting Characteristics...");
        writeCharacteristic = await service.getCharacteristic(CHAR_WRITE_UUID);
        const notifyCharacteristic = await service.getCharacteristic(CHAR_NOTIFY_UUID);

        await notifyCharacteristic.startNotifications();
        notifyCharacteristic.addEventListener('characteristicvaluechanged', handleNotifications);

        // UI: mark connected
        const dot = document.getElementById('connectionDot');
        if (dot) dot.classList.add('connected');
        setConnectionStatus(true);
        setScanState(false);
        log("Connected! Redirecting to dashboard...");

        // Auto-switch to dashboard
        setTimeout(() => {
            nav('dashboard', document.querySelectorAll('.nav-item')[0]);
        }, 1000);

    } catch (error) {
        log("Error: " + error);
        setScanState(false);
        console.error(error);
    }
}

// ─── DISCONNECT (UNCHANGED) ───────────────────────────────────────────────────
function disconnectDevice() {
    if (gattServer && gattServer.connected) {
        gattServer.disconnect();
    }
}

function onDisconnected() {
    const dot = document.getElementById('connectionDot');
    if (dot) dot.classList.remove('connected');
    setConnectionStatus(false);
    log("Device Disconnected");
}

// ─── DATA HANDLING (UNCHANGED PARSING LOGIC) ──────────────────────────────────
function handleNotifications(event) {
    const value   = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const jsonStr = decoder.decode(value);

    try {
        const data = JSON.parse(jsonStr);
        // Push data to dashboard component — all DOM writes happen there
        updateDashboard(data);
    } catch (e) {
        console.error("Parse error", e);
    }
}

// ─── PROFILE SELECTION ────────────────────────────────────────────────────────
function onProfileSelected(name) {
    selectedProfile = name;
    showPreview(name, PROFILES[name]);
}

// ─── UPLOAD PROFILE (UNCHANGED BLE WRITE LOGIC) ───────────────────────────────
async function uploadProfile() {
    if (!gattServer || !gattServer.connected) {
        alert("Please connect to AeroGrow first!");
        return;
    }

    const p = PROFILES[selectedProfile];
    const payload = {
        plant:    selectedProfile,
        mist_int: p.mist,
        uv_hrs:   p.uv,
        t_target: p.t,
        h_target: p.h
    };

    const encoder = new TextEncoder();
    await writeCharacteristic.writeValue(encoder.encode(JSON.stringify(payload)));

    // Visual feedback
    triggerUploadAnimation();
    setActiveProfile(selectedProfile, p);

    log(`Profile "${selectedProfile}" uploaded to AeroGrow.`);

    // Navigate back to dashboard
    setTimeout(() => {
        nav('dashboard', document.querySelectorAll('.nav-item')[0]);
    }, 1200);
}

// ─── EXPOSE GLOBALS FOR INLINE ONCLICK HANDLERS ───────────────────────────────
// Profiles and Settings components use window._* references to avoid import
// complexity in dynamically-rendered HTML onclick attributes.
window._connectDevice    = connectDevice;
window._disconnectDevice = disconnectDevice;
window._uploadProfile    = uploadProfile;

// ─── INITIALIZE APP ───────────────────────────────────────────────────────────
async function init() {
    // Initialize Theme Engine
    await initThemeManager();

    // 1. Render each screen into its container
    renderDashboard(document.getElementById('screen-dashboard'));
    renderProfiles(
        document.getElementById('screen-profiles'),
        PROFILES,
        onProfileSelected,
        uploadProfile
    );
    renderSettings(
        document.getElementById('screen-settings'),
        connectDevice,
        disconnectDevice
    );
    renderIntelligence(
        document.getElementById('screen-intelligence')
    );

    // 2. Wire up bottom nav
    const navItems = document.querySelectorAll('.nav-item');
    navItems[0].addEventListener('click', () => nav('dashboard',     navItems[0]));
    navItems[1].addEventListener('click', () => nav('profiles',      navItems[1]));
    navItems[2].addEventListener('click', () => nav('intelligence',  navItems[2]));
    navItems[3].addEventListener('click', () => nav('settings',      navItems[3]));

    // 3. Active nav item start state
    navItems[0].classList.add('active');
}

// Run after DOM is ready
document.addEventListener('DOMContentLoaded', init);
