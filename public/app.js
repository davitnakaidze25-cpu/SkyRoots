// SkyRoots navigation, Bluetooth connection lifecycle, and crop profiles.

import { renderDashboard, updateDashboard, setConnectionStatus, setActiveProfile } from './components/dashboard.js';
import { renderProfiles, showPreview, triggerUploadAnimation } from './components/profiles.js';
import { renderSettings, appendLog, setScanState } from './components/settings.js';
import { renderIntelligence } from './components/intelligence.js';
import { addLogEntry } from './components/sensorState.js';
import { renderCamera, subscribeCamera, resetCamera } from './components/camera.js';

// ─── CONSTANTS (UNCHANGED) ────────────────────────────────────────────────────
const SERVICE_UUID      = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHAR_NOTIFY_UUID  = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const CHAR_WRITE_UUID   = "826a2d07-2831-411f-9988-3a9d91f2d658";

const PROFILES = {
    "Cucumber":    { mist: 180, uv: 12, t: 24, h: 75, icon: "🥒" },
    "Tomato":      { mist: 300, uv: 14, t: 22, h: 65, icon: "🍅" },
    "Lettuce":     { mist: 600, uv: 10, t: 22, h: 60, icon: "🥬" },
    "Cauliflower": { mist: 450, uv: 12, t: 20, h: 70, icon: "🥦" },
    "Clover":      { mist: 120, uv: 10, t: 21, h: 72, icon: "🍀" }
};

let connection = null;
let selectedProfile = null;

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function nav(screenId, navEl, updateHistory = true) {
    const screen = document.getElementById('screen-' + screenId);
    if (!screen || !navEl) return;
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.toggle('active', s === screen);
        s.hidden = s !== screen;
    });
    document.querySelectorAll('.nav-item, .header-status').forEach(n => {
        n.classList.toggle('active', n === navEl);
        if (n === navEl) n.setAttribute('aria-current', 'page');
        else n.removeAttribute('aria-current');
    });
    if (updateHistory && location.hash !== '#' + screenId) history.pushState(null, '', '#' + screenId);
    window.scrollTo({ top: 0, behavior: 'instant' });
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

function isConnected(session) {
    return session != null && connection === session && session.device?.gatt?.connected === true;
}

function endConnection(session) {
    if (connection !== session) return;
    connection = null;
    clearTimeout(session.redirect);
    session.device?.removeEventListener('gattserverdisconnected', session.onDisconnect);
    session.notify?.removeEventListener('characteristicvaluechanged', handleNotifications);
    if (session.device?.gatt?.connected) session.device.gatt.disconnect();
    resetCamera();
    document.getElementById('connectionDot').classList.remove('connected');
    setConnectionStatus(false);
    setScanState(false);
}

async function connectDevice() {
    if (connection) return;
    const session = {};
    connection = session;
    try {
        setScanState(true);
        log("Scanning for AeroGrow...");
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'AeroGrow_ESP32' }],
            optionalServices: [SERVICE_UUID]
        });
        if (connection !== session) return;
        session.device = device;
        session.onDisconnect = () => {
            if (connection !== session || device.gatt.connected) return;
            endConnection(session);
            log("Device disconnected");
        };
        device.addEventListener('gattserverdisconnected', session.onDisconnect);

        log("Connecting to GATT...");
        const server = await device.gatt.connect();
        if (connection !== session) {
            if (connection?.device !== device && server.connected) server.disconnect();
            return;
        }

        log("Getting service and characteristics...");
        const service = await server.getPrimaryService(SERVICE_UUID);
        session.write = await service.getCharacteristic(CHAR_WRITE_UUID);
        session.notify = await service.getCharacteristic(CHAR_NOTIFY_UUID);
        if (connection !== session) return;
        await session.notify.startNotifications();
        if (connection !== session) return;
        if (!server.connected) throw new Error('The tower disconnected during setup.');
        session.notify.addEventListener('characteristicvaluechanged', handleNotifications);
        session.ready = true;

        document.getElementById('connectionDot').classList.add('connected');
        setConnectionStatus(true);
        setScanState(false);
        log("Connected to AeroGrow.");
        // A board without camera notifications can still supply live sensor data.
        void subscribeCamera(service);
        scheduleDashboard(session, '#settings', 1000);
    } catch (error) {
        if (connection !== session) return;
        endConnection(session);
        log("Error: " + error);
        console.error(error);
    }
}

function scheduleDashboard(session, fromRoute, delay) {
    clearTimeout(session.redirect);
    session.redirect = setTimeout(() => {
        if (isConnected(session) && location.hash === fromRoute) {
            nav('dashboard', document.getElementById('nav-dashboard'));
        }
    }, delay);
}

function disconnectDevice() {
    if (!connection) return;
    endConnection(connection);
    log("Device disconnected");
}

// ─── DATA HANDLING (UNCHANGED PARSING LOGIC) ──────────────────────────────────
function handleNotifications(event) {
    if (!isConnected(connection) || event.target !== connection.notify) return;
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
    const session = connection;
    if (!isConnected(session) || !session.ready) {
        alert("Please connect to AeroGrow first!");
        return;
    }

    const name = selectedProfile;
    const p = PROFILES[name];
    const payload = {
        plant:    name,
        mist_int: p.mist,
        uv_hrs:   p.uv,
        t_target: p.t,
        h_target: p.h
    };

    const encoder = new TextEncoder();
    try {
        await session.write.writeValue(encoder.encode(JSON.stringify(payload)));
    } catch (error) {
        if (isConnected(session)) log('Profile upload failed: ' + error);
        return;
    }
    if (!isConnected(session)) return;

    // Visual feedback
    triggerUploadAnimation();
    setActiveProfile(name, p);

    log(`Profile "${name}" uploaded to AeroGrow.`);

    // Navigate back to dashboard
    scheduleDashboard(session, '#profiles', 1200);
}

// ─── EXPOSE GLOBALS FOR INLINE ONCLICK HANDLERS ───────────────────────────────
// Profiles and Settings components use window._* references to avoid import
// complexity in dynamically-rendered HTML onclick attributes.
window._connectDevice    = connectDevice;
window._disconnectDevice = disconnectDevice;
window._uploadProfile    = uploadProfile;

// ─── INITIALIZE APP ───────────────────────────────────────────────────────────
async function init() {

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

    renderCamera(document.getElementById('screen-camera'));

    // Route by ID so adding camera does not change existing destinations.
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => nav(item.id.replace('nav-', ''), item));
    });

    // 3. Active nav item start state
    const restoreRoute = () => {
        const route = location.hash.slice(1);
        const id = ['dashboard', 'profiles', 'camera', 'intelligence', 'settings'].includes(route) ? route : 'dashboard';
        nav(id, document.getElementById('nav-' + id), false);
    };
    window.addEventListener('popstate', restoreRoute);
    window.addEventListener('hashchange', restoreRoute);
    restoreRoute();
}

// Run after DOM is ready
document.addEventListener('DOMContentLoaded', init);
