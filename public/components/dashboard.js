// components/dashboard.js
// Dashboard Screen — Bio-Dome Status, 3D Gauge Cluster, UV Timer, Hardware
// Indicators, Growth Timeline, Plant Wireframe, Sparkline Aura Charts.
// Pure presentation layer. All data arrives via updateDashboard(data).

import { sensorState, updateSensorState, setConnectedState, setProfileState } from './sensorState.js';
import { icon } from './icons.js';

const TEMP_MIN = 0, TEMP_MAX = 50;
const HUM_MIN = 0, HUM_MAX = 100;
let uvMaxSeconds = 0;

// Sparkline history buffers
const tempHistory = [];
const humHistory = [];
const MAX_HISTORY = 24;

// ─── Sensor Cards ─────────────────────────────────────────────────────────────
function buildSensor({ label, unit, valueId, sparkId, kind }) {
    return `<div class="sensor-card" id="${valueId}Card">
        <div class="sensor-heading">${icon(kind)}<span>${label}</span></div>
        <div class="sensor-reading"><span id="${valueId}">—</span><span class="sensor-unit">${unit}</span></div>
        <div class="sensor-footer"><span class="sensor-condition" id="${valueId}Status">No reading</span>
            <svg class="sparkline" id="${sparkId}" viewBox="0 0 120 28" preserveAspectRatio="none" aria-label="Recent readings">
                <polyline class="spark-area" points="" stroke="none"/><polyline class="spark-line" points="" fill="none" stroke-width="2"/>
            </svg>
        </div>
    </div>`;
}
function setSensorStatus(id, color) {
    document.getElementById(id + 'Card').dataset.state = color;
    document.getElementById(id + 'Status').textContent = color === 'ring-green' ? 'In range' : 'Check reading';
}

// ─── Hardware Indicator Builder ───────────────────────────────────────────────
function buildIndicator({ id, kind, label }) {
    return `
    <div class="hw-indicator" id="${id}">
        <div class="hw-dot-wrap">
            <span class="hw-dot"></span>
            <span class="hw-dot-ring"></span>
        </div>
        <div class="hw-info">
            <div class="hw-icon">${icon(kind)}</div>
            <div class="hw-label">${label}</div>
        </div>
        <div class="hw-status-text">Not connected</div>
    </div>`;
}

// ─── Plant Wireframe SVG ──────────────────────────────────────────────────────
function buildPlantWireframe() {
    return `
    <div class="plant-wireframe-wrap">
        <svg class="plant-wireframe" id="plantWireframe" viewBox="0 0 120 160">
            <!-- Pot -->
            <path class="plant-pot" d="M38 142 L42 122 L78 122 L82 142 Z"/>
            <ellipse class="plant-soil" cx="60" cy="122" rx="20" ry="3.5"/>
            <!-- Roots -->
            <path class="plant-roots" d="M50 126 Q44 134 40 142"/>
            <path class="plant-roots" d="M60 126 Q60 136 58 144"/>
            <path class="plant-roots" d="M70 126 Q76 134 80 142"/>
            <!-- Stem -->
            <path class="plant-stem" d="M60 122 Q58 102 60 72"/>
            <!-- Leaves -->
            <path class="plant-leaf" d="M60 100 Q38 88 26 72 Q40 82 60 92"/>
            <path class="plant-leaf" d="M60 88 Q82 74 94 58 Q80 70 60 80"/>
            <path class="plant-leaf" d="M60 78 Q36 64 24 48 Q38 58 60 70"/>
            <!-- Bud -->
            <circle class="plant-bud" cx="60" cy="66" r="9"/>
            <circle class="plant-bud-inner" cx="60" cy="66" r="4.5"/>
        </svg>
    </div>`;
}

// ─── Growth Timeline Builder ──────────────────────────────────────────────────
function buildTimeline() {
    const phases = ['SEED', 'SPROUT', 'GROWTH', 'HARVEST'];
    return `
    <div class="growth-timeline">
        <div class="timeline-track">
            <div class="timeline-progress" id="growthProgress"></div>
        </div>
        <div class="timeline-phases">
            ${phases.map((name, i) => `
                <div class="phase" data-phase="${name.toLowerCase()}">
                    <div class="phase-dot"></div>
                    <span>${name}</span>
                </div>
            `).join('')}
        </div>
    </div>`;
}

// ─── Main Render ──────────────────────────────────────────────────────────────
export function renderDashboard(container) {
    container.innerHTML = `
    <div class="dashboard-heading"><h2 class="screen-title">Your garden</h2></div>
    <section class="garden-hero card">
        <div class="hero-copy"><span class="hero-kicker">FOGPONICS</span><h3>Your<br>tower.</h3><a href="#settings" class="hero-link" id="towerAction"><span id="towerActionLabel">Connect tower</span><span aria-hidden="true">↗</span></a></div>
        <div class="tower-scene" id="dashboardTower" role="img">
            <img class="hero-tower" src="assets/images/fogponics-tower-clean.png" width="1024" height="1536" alt="">
            <picture>
                <source media="(prefers-reduced-motion: no-preference)" srcset="assets/images/fogponics-tower-growing.svg#drift">
                <img class="tower-growing" src="assets/images/fogponics-tower-growing.svg" width="1024" height="1536" alt="" hidden>
            </picture>
        </div>
        <div class="biodome-header"><span class="biodome-word" id="bioDomeStatus">Ready to connect</span></div>
    </section>
    <div class="section-heading"><h3>Environment</h3></div>
    <!-- UV Cycle Timer Card -->
    <div class="card card-timer">
        <div class="card-header-row">
            <span class="card-eyebrow">UV time left</span>
            <div class="connection-badge" id="db-conn-badge">
                <span class="conn-dot" id="db-conn-dot"></span>
                <span id="db-conn-label">Offline</span>
            </div>
        </div>

        <div class="light-readout">${icon('sun')}<span id="uvTimer">—</span><span class="light-unit">remaining</span></div>
        <svg class="light-progress" viewBox="0 0 100 3" preserveAspectRatio="none" aria-hidden="true"><line class="ring-track" x1="0" y1="1.5" x2="100" y2="1.5" stroke-width="3"/><line class="ring-fill" id="ringUV" x1="0" y1="1.5" x2="100" y2="1.5" stroke-width="3" stroke-dasharray="100" stroke-dashoffset="100"/></svg>

        <div class="hw-row">
            ${buildIndicator({ id: 'chipMist', kind: 'mist', label: 'Root mist' })}
            ${buildIndicator({ id: 'chipUV', kind: 'sun', label: 'UV Light' })}
        </div>
    </div>

    <!-- Sensor 3D Gauge Cluster -->
    <div class="sensor-ring-grid">
        ${buildSensor({ label: 'Temperature', unit: '°C', valueId: 'valTemp', sparkId: 'sparkTemp', kind: 'temperature' })}
        ${buildSensor({ label: 'Humidity', unit: '%', valueId: 'valHum', sparkId: 'sparkHum', kind: 'mist' })}
    </div>

    <!-- Growth Timeline -->
    <div class="card card-timeline" id="growthCard" hidden>
        <div class="card-eyebrow" style="margin-bottom:4px">Growth</div>
        ${buildTimeline()}
    </div>

    <!-- Plant Wireframe + Active Profile -->
    <div class="card card-profile">
        <a class="crop-edit-link" href="#profiles" aria-label="Change active crop">Change <span aria-hidden="true">↗</span></a>
        <div class="profile-plant-row">
            ${buildPlantWireframe()}
            <div class="profile-info-section">
                <div class="card-eyebrow" style="margin-bottom:8px">Active crop</div>
                <div class="profile-active-row">
                    <div class="profile-active-info">
                        <div class="profile-active-name" id="activeProfileName">No crop selected</div>
                        <div class="profile-active-detail" id="activeProfileDetails">Choose a crop to get started</div>
                        <div class="profile-health-row" id="plantHealthRow" hidden>
                            <span class="ph-label">Health:</span>
                            <span class="ph-value" id="healthValue">Unknown</span>
                        </div>
                    </div>
                </div>
                <div class="profile-stats-row" id="profileStatsRow" style="display:none">
                    <div class="profile-stat"><span class="ps-val" id="psTemp">--</span><span class="ps-label">Target °C</span></div>
                    <div class="profile-stat"><span class="ps-val" id="psHum">--</span><span class="ps-label">Target %</span></div>
                    <div class="profile-stat"><span class="ps-val" id="psMist">--</span><span class="ps-label">Mist (s)</span></div>
                    <div class="profile-stat"><span class="ps-val" id="psUV">--</span><span class="ps-label">UV (hrs)</span></div>
                </div>
            </div>
        </div>
    </div>
    `;
    showTowerStage(container.querySelector('.tower-scene'), sensorState.connected);
}

function showTowerStage(scene, connected) {
    scene.querySelector('.tower-growing').hidden = !connected;
    scene.setAttribute('aria-label', connected
        ? 'SkyRoots growing-stage illustration with leafy plants in six cups and mist inside the tower'
        : 'SkyRoots tower with three blue growing tiers and six empty planting cups');
}

// ─── Ring Update Helpers ──────────────────────────────────────────────────────
function setRing(ringId, percent, colorClass) {
    const el = document.getElementById(ringId);
    if (!el) return;
    const circ = parseFloat(el.getAttribute('stroke-dasharray'));
    el.style.strokeDashoffset = circ * (1 - Math.max(0, Math.min(1, percent)));
    el.classList.remove('ring-green', 'ring-amber', 'ring-danger', 'ring-accent');
    el.classList.add(colorClass);
}

function getTempColor(t) {
    if (t < 10 || t > 35) return 'ring-danger';
    if (t < 18 || t > 28) return 'ring-amber';
    return 'ring-green';
}

function getHumColor(h) {
    if (h < 30) return 'ring-danger';
    if (h < 50) return 'ring-amber';
    return 'ring-green';
}

// ─── Bio-Dome Status ──────────────────────────────────────────────────────────
function getBioDomeStatus(t, h) {
    if (isNaN(t) || isNaN(h)) return { text: 'AWAITING', cls: 'status-await' };
    const tOk = t >= 18 && t <= 30;
    const hOk = h >= 45 && h <= 85;
    if (tOk && hOk) return { text: 'THRIVING', cls: 'status-thriving' };
    if (tOk || hOk) return { text: 'STABLE', cls: 'status-stable' };
    return { text: 'EVOLVING', cls: 'status-evolving' };
}

// ─── Sparkline Updater ────────────────────────────────────────────────────────
function updateSparkline(svgId, history, value, min, max, colorClass) {
    if (isNaN(value)) return;
    history.push(value);
    if (history.length > MAX_HISTORY) history.shift();

    const svg = document.getElementById(svgId);
    if (!svg) return;

    const line = svg.querySelector('.spark-line');
    const area = svg.querySelector('.spark-area');
    if (!line) return;

    const w = 120, h = 28, pad = 3;

    const points = history.map((v, i) => {
        const x = (i / (MAX_HISTORY - 1)) * w;
        const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    line.setAttribute('points', points);

    // Sparkline color class
    line.classList.remove('spark-amber', 'spark-danger');
    if (area) area.classList.remove('spark-amber', 'spark-danger');
    if (colorClass === 'ring-amber') {
        line.classList.add('spark-amber');
        if (area) area.classList.add('spark-amber');
    } else if (colorClass === 'ring-danger') {
        line.classList.add('spark-danger');
        if (area) area.classList.add('spark-danger');
    }

    if (area && history.length > 1) {
        const lastX = (w * (history.length - 1) / (MAX_HISTORY - 1)).toFixed(1);
        area.setAttribute('points', `0,${h} ${points} ${lastX},${h}`);
    }
}

// ─── Plant Wireframe Color ────────────────────────────────────────────────────
function updatePlantColor(t, h) {
    const plantEl = document.getElementById('plantWireframe');
    if (!plantEl) return;
    const tOk = t >= 18 && t <= 30;
    const hOk = h >= 45 && h <= 85;
    if (tOk && hOk) {
        plantEl.style.setProperty('--plant-color', 'var(--primary)');
    } else if (tOk || hOk) {
        plantEl.style.setProperty('--plant-color', 'var(--amber)');
    } else {
        plantEl.style.setProperty('--plant-color', 'var(--danger)');
    }
}

// ─── Data Update Entry Point (called by app.js handleNotifications) ───────────
export function updateDashboard(data) {
    updateSensorState(data);
    // Temperature
    const t = parseFloat(data.t);
    if (!isNaN(t)) {
        document.getElementById('valTemp').textContent = t.toFixed(1);
        const tColor = getTempColor(t);
        setSensorStatus('valTemp', tColor);
        updateSparkline('sparkTemp', tempHistory, t, TEMP_MIN, TEMP_MAX, tColor);

        const tempCard = document.querySelector('.sensor-ring-grid');
        if (tempCard) {
            tempCard.style.setProperty('--temp-health',
                tColor === 'ring-green' ? 'var(--primary)' :
                    tColor === 'ring-amber' ? 'var(--amber)' : 'var(--danger)');
        }
    }

    // Humidity
    const h = parseFloat(data.h);
    if (!isNaN(h)) {
        document.getElementById('valHum').textContent = h.toFixed(1);
        const hColor = getHumColor(h);
        setSensorStatus('valHum', hColor);
        updateSparkline('sparkHum', humHistory, h, HUM_MIN, HUM_MAX, hColor);
    }

    // Hardware indicators
    updateIndicator('chipMist', data.m, 'Misting', 'Idle');
    updateIndicator('chipUV', data.u, 'On', 'Standby');

    // UV Timer + ring
    const r = parseInt(data.r);
    if (!isNaN(r)) {
        if (r > 0) {
            if (r > uvMaxSeconds) uvMaxSeconds = r;
            const hh = Math.floor(r / 3600);
            const mm = Math.floor((r % 3600) / 60);
            const ss = r % 60;
            document.getElementById('uvTimer').textContent =
                `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
            const uvPct = uvMaxSeconds > 0 ? r / uvMaxSeconds : 0;
            setRing('ringUV', uvPct, 'ring-accent');
        } else {
            document.getElementById('uvTimer').textContent = 'OFF';
            setRing('ringUV', 0, 'ring-accent');
        }
    }

    // Dynamic background based on UV state


    // Bio-Dome status
    const status = getBioDomeStatus(t, h);
    const statusEl = document.getElementById('bioDomeStatus');
    if (statusEl) {
        statusEl.textContent = status.text.charAt(0) + status.text.slice(1).toLowerCase();
        statusEl.className = 'biodome-word ' + status.cls;
    }

    const health = document.getElementById('healthValue');
    document.getElementById('plantHealthRow').hidden = !(Number.isFinite(t) && Number.isFinite(h));
    if (health) health.textContent = Number.isFinite(t) && Number.isFinite(h) ? 'Conditions ' + status.text.toLowerCase() : 'Awaiting readings';
    // Plant wireframe color
    updatePlantColor(t, h);

    // Aether Mode — activate when hardware is optimizing

}

function updateIndicator(id, isActive, activeLabel, idleLabel) {
    const el = document.getElementById(id);
    if (!el || isActive == null) return;
    el.dataset.reported = '';
    el.classList.toggle('active', Boolean(isActive));
    el.querySelector('.hw-status-text').textContent = isActive ? activeLabel : idleLabel;
}

// ─── Connection Status ────────────────────────────────────────────────────────
export function setConnectionStatus(connected) {
    setConnectedState(connected);
    const badge = document.getElementById('db-conn-badge');
    const dot = document.getElementById('db-conn-dot');
    const label = document.getElementById('db-conn-label');
    if (!badge) return;
    showTowerStage(document.getElementById('dashboardTower'), connected);
    document.querySelectorAll('.hw-indicator').forEach(indicator => {
        // A first notification can arrive while the remaining BLE channels are opening.
        if (connected && indicator.hasAttribute('data-reported')) return;
        delete indicator.dataset.reported;
        indicator.classList.remove('active');
        indicator.querySelector('.hw-status-text').textContent = connected ? 'Awaiting reading' : 'Not connected';
    });
    document.getElementById('towerAction').href = connected ? '#camera' : '#settings';
    document.getElementById('towerActionLabel').textContent = connected ? 'View camera' : 'Connect tower';
    if (connected) {
        badge.classList.add('connected');
        if (dot) dot.classList.add('connected');
        if (label) label.textContent = 'Live';
        if (document.getElementById('bioDomeStatus').textContent === 'Ready to connect') {
            document.getElementById('bioDomeStatus').textContent = 'Connected';
        }

        const healthVal = document.getElementById('healthValue');
        if (healthVal) {
            healthVal.textContent = 'Awaiting readings';
            healthVal.classList.add('status-healthy');
        }
    } else {
        badge.classList.remove('connected');
        if (dot) dot.classList.remove('connected');
        if (label) label.textContent = 'Offline';

        const healthVal = document.getElementById('healthValue');
        if (healthVal) {
            healthVal.textContent = 'Unknown';
            healthVal.classList.remove('status-healthy');
        }
        // Reset rings
        ['ringTemp', 'ringHum', 'ringUV'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.strokeDashoffset = el.getAttribute('stroke-dasharray');
        });
        const tEl = document.getElementById('valTemp');
        const hEl = document.getElementById('valHum');
        const uEl = document.getElementById('uvTimer');
        if (tEl) tEl.textContent = '—';
        if (hEl) hEl.textContent = '—';
        if (uEl) uEl.textContent = '—';

        // Reset bio-dome status
        const statusEl = document.getElementById('bioDomeStatus');
        if (statusEl) {
            statusEl.textContent = 'Ready to connect';
            statusEl.className = 'biodome-word status-await';
        }

        document.getElementById('plantHealthRow').hidden = true;
        tempHistory.length = 0;
        humHistory.length = 0;
        uvMaxSeconds = 0;
        ['valTemp', 'valHum'].forEach(id => {
            document.getElementById(id + 'Status').textContent = 'No reading';
            delete document.getElementById(id + 'Card').dataset.state;
        });
        document.querySelectorAll('.sparkline polyline').forEach(line => line.setAttribute('points', ''));
    }
}

// ─── Active Profile Display ───────────────────────────────────────────────────
export function setActiveProfile(name, data) {
    setProfileState(name, data);
    const nameEl = document.getElementById('activeProfileName');
    const detailEl = document.getElementById('activeProfileDetails');
    const iconEl = document.getElementById('activeProfileIcon');
    const statsRow = document.getElementById('profileStatsRow');

    if (nameEl) nameEl.textContent = name;
    if (detailEl) detailEl.textContent = `Optimal ${data.t}°C · ${data.h}% RH`;
    if (iconEl) iconEl.textContent = data.icon;

    if (statsRow) {
        statsRow.style.display = 'grid';
        document.getElementById('psTemp').textContent = data.t;
        document.getElementById('psHum').textContent = data.h;
        document.getElementById('psMist').textContent = data.mist;
        document.getElementById('psUV').textContent = data.uv;
    }

    document.getElementById('growthCard').hidden = false;
    // Update growth timeline to "SPROUT" phase
    updateGrowthTimeline(1);
}

// ─── Growth Timeline Updates ──────────────────────────────────────────────────
function updateGrowthTimeline(activeIndex) {
    const phases = document.querySelectorAll('.phase');
    const progress = document.getElementById('growthProgress');
    phases.forEach((phase, i) => {
        phase.classList.remove('active', 'completed');
        if (i < activeIndex) phase.classList.add('completed');
        if (i === activeIndex) phase.classList.add('active');
    });
    if (progress) {
        const pct = (activeIndex / (phases.length - 1)) * 100;
        progress.style.width = pct + '%';
    }
}
