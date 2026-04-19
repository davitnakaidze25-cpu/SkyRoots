// components/profiles.js
// Profiles Screen — Crop Selector + Config Preview
// renderProfiles() builds the UI; selectProfile() handles card selection state.

let _onSelect = null;
let _onUpload = null;

// ─── Main Render ──────────────────────────────────────────────────────────────
export function renderProfiles(container, profiles, onSelect, onUpload) {
    _onSelect = onSelect;
    _onUpload = onUpload;

    container.innerHTML = `
    <div class="profiles-header">
        <h2 class="screen-title">Select Crop</h2>
        <span class="screen-subtitle">Choose a profile to sync with your chamber</span>
    </div>

    <div class="profile-scroll" id="profileScrollContainer"></div>

    <div class="card card-preview" id="previewCard" style="display:none;">
        <div class="card-eyebrow" style="margin-bottom:16px">CONFIGURATION PREVIEW</div>
        <div class="preview-hero">
            <span class="preview-icon" id="prv-icon">🌱</span>
            <div class="preview-name" id="prv-name">—</div>
        </div>
        <div class="preview-stats-grid">
            <div class="preview-stat">
                <div class="ps-label">MIST INTERVAL</div>
                <div class="ps-val" id="preMist">—</div>
                <div class="ps-unit">seconds</div>
            </div>
            <div class="preview-stat">
                <div class="ps-label">UV DURATION</div>
                <div class="ps-val" id="preUV">—</div>
                <div class="ps-unit">hours / day</div>
            </div>
            <div class="preview-stat">
                <div class="ps-label">TARGET TEMP</div>
                <div class="ps-val" id="preTemp">—</div>
                <div class="ps-unit">°C</div>
            </div>
            <div class="preview-stat">
                <div class="ps-label">TARGET HUMIDITY</div>
                <div class="ps-val" id="preHum">—</div>
                <div class="ps-unit">% RH</div>
            </div>
        </div>
        <button class="btn-upload" id="uploadBtn" onclick="window._uploadProfile()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            UPLOAD TO ESP32
        </button>
    </div>
    `;

    populateCards(profiles);
}

// ─── Populate Profile Cards ───────────────────────────────────────────────────
function populateCards(profiles) {
    const scroll = document.getElementById('profileScrollContainer');
    if (!scroll) return;
    scroll.innerHTML = '';

    for (const [name, data] of Object.entries(profiles)) {
        const card = document.createElement('div');
        card.className = 'profile-card';
        card.dataset.name = name;
        card.innerHTML = `
            <div class="profile-card-glow"></div>
            <div class="profile-img">${data.icon}</div>
            <div class="profile-name">${name}</div>
            <div class="profile-meta">
                <span class="profile-meta-chip">💧 ${data.mist}s</span>
                <span class="profile-meta-chip">☀️ ${data.uv}h</span>
            </div>
        `;
        card.addEventListener('click', () => {
            document.querySelectorAll('.profile-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            if (_onSelect) _onSelect(name);
        });
        scroll.appendChild(card);
    }
}

// ─── Preview Panel ────────────────────────────────────────────────────────────
export function showPreview(name, data) {
    const card = document.getElementById('previewCard');
    if (!card) return;

    document.getElementById('prv-icon').textContent  = data.icon;
    document.getElementById('prv-name').textContent  = name;
    document.getElementById('preMist').textContent   = data.mist;
    document.getElementById('preUV').textContent     = data.uv;
    document.getElementById('preTemp').textContent   = data.t;
    document.getElementById('preHum').textContent    = data.h;

    card.style.display = 'block';
    setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);

    const btn = document.getElementById('uploadBtn');
    if (btn) btn.classList.remove('sending');
}

// ─── Upload Animation Feedback ────────────────────────────────────────────────
export function triggerUploadAnimation() {
    const btn = document.getElementById('uploadBtn');
    if (!btn) return;
    btn.classList.add('sending');
    btn.textContent = '✓ UPLOADED!';
    setTimeout(() => {
        btn.classList.remove('sending');
        btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        UPLOAD TO ESP32`;
    }, 2500);
}
