// components/sensorState.js
// Shared sensor state bridge — updated by dashboard.js, read by intelligence.js
// This is a presentation-layer data store; it does NOT alter any backend logic.

export const sensorState = {
    temperature: null,
    humidity: null,
    uvOn: false,
    mistOn: false,
    uvRemaining: 0,
    connected: false,
    activeProfile: null,
    profileData: null,
    systemLogs: [],
};

export function updateSensorState(data) {
    if (data.t !== undefined) sensorState.temperature = parseFloat(data.t);
    if (data.h !== undefined) sensorState.humidity = parseFloat(data.h);
    if (data.m !== undefined) sensorState.mistOn = !!data.m;
    if (data.u !== undefined) sensorState.uvOn = !!data.u;
    if (data.r !== undefined) sensorState.uvRemaining = parseInt(data.r);
}

export function setConnectedState(connected) {
    sensorState.connected = connected;
}

export function setProfileState(name, data) {
    sensorState.activeProfile = name;
    sensorState.profileData = data;
}

export function addLogEntry(msg) {
    sensorState.systemLogs.push({ time: new Date().toLocaleTimeString(), msg });
    if (sensorState.systemLogs.length > 50) sensorState.systemLogs.shift();
}
