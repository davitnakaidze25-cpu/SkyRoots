// components/intelligence.js
// Intelligence Screen — SkyRoots Grooty LLM Chatbot
// Context-aware AI advisor with streaming responses, voice input, and live video validation.

import { sensorState } from './sensorState.js';

const API_URL = '/api/chat';
const MODEL = 'llama-3.3-70b-versatile';

let chatHistory = [];
let isStreaming = false;
let streamingBubble = null;

// ─── System Prompt Builder ────────────────────────────────────────────────────
function getSystemPrompt() {
    const s = sensorState;
    const formatTime = (sec) => {
        if (!sec || sec <= 0) return 'Cycle Complete';
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return `${h}h ${m}m remaining`;
    };

    const sensorContext = `
CURRENT SYSTEM STATE (Live Sensor Data):
- Connection: ${s.connected ? 'ONLINE ✓' : 'OFFLINE ✗'}
- Temperature: ${s.temperature !== null ? s.temperature.toFixed(1) + '°C' : 'No data'}
- Humidity: ${s.humidity !== null ? s.humidity.toFixed(1) + '%' : 'No data'}
- Misting System: ${s.mistOn ? 'ACTIVE — Currently Misting' : 'Idle'}
- UV Light: ${s.uvOn ? 'ACTIVE — Lamps On' : 'Off'}
- UV Cycle: ${formatTime(s.uvRemaining)}
- Active Profile: ${s.activeProfile || 'None loaded'}
- Operator Health Log: ${s.plantHealth || 'Unknown / Not evaluated yet'} 
${s.profileData ? `  → Targets: ${s.profileData.t}°C / ${s.profileData.h}% RH / Mist every ${s.profileData.mist}s / UV ${s.profileData.uv}h per day` : ''}
- Recent System Logs: ${s.systemLogs.slice(-5).map(l => `[${l.time}] ${l.msg}`).join(' | ') || 'None'}
`.trim();

    return `You are the "SkyRoots Grooty," an expert AI advisor for advanced aeroponic plant cultivation aboard the SkyRoots bio-dome system.

IDENTITY & TONE:
- Professional, encouraging, and highly technical yet accessible.
- You speak with the authority of a space-agriculture systems engineer.
- Use precise, data-driven language with a calm, confident cadence.
- Refer to the growing chamber as the "bio-dome" or "growth chamber."

CAPABILITIES:
- Interpret real-time aeroponic sensor data.
- Provide comprehensive "Vitality Reports" that synthesize sensor data and operator input into actionable insights.
- Acknowledge and analyze manual health updates submitted by the operator.

${sensorContext}

BEHAVIORAL RULES:
1. You are READ-ONLY. You CANNOT directly control hardware.
2. If the operator marks a plant as "unhealthy," cross-reference the temperature and humidity metrics to deduce why it might be struggling.
3. Always reference actual live sensor values when discussing plant health. Include the exact numbers.
4. Keep responses concise but informative. Use bullet points for data summaries.
5. When asked variations of "How is my plant doing?", produce a structured Vitality Report.
6. Use markdown formatting: **bold** for emphasis, bullet lists for data points.

VITALITY REPORT FORMAT:
📊 **Vitality Report**
- **Overall Status**: [THRIVING / STABLE / NEEDS ATTENTION]
- **Operator Assessment**: ${s.plantHealth || 'Pending Review'}
- **Temperature**: [value] — [assessment vs optimal range]
- **Humidity**: [value] — [assessment]
- **UV Cycle**: [status]
- **Misting**: [status]
- **Recommendation**: [actionable advice based on system state]`;
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────
function renderMarkdown(text) {
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

    html = html.replace(/(\d+\.?\d*\s*°C)/g, '<span class="data-badge badge-temp">$1</span>');
    html = html.replace(/(\d+\.?\d*%(?:\s*RH)?)/g, '<span class="data-badge badge-hum">$1</span>');

    return html;
}

// ─── Main Render ──────────────────────────────────────────────────────────────
let currentZoom = 1.0;

export function renderIntelligence(container) {
    currentZoom = 1.0;
    container.innerHTML = `
    <div class="intel-header">
        <h2 class="screen-title">Grooty Intelligence</h2>
        <span class="screen-subtitle">Space-Agri Advisor & Live Monitoring</span>
    </div>

    <div class="camera-card card" style="margin-bottom: 15px; padding: 12px; text-align: center;">
        <div class="camera-stream-container" style="background: #111; border-radius: 8px; overflow: hidden; position: relative; aspect-ratio: 4/3; max-height: 280px; margin: 0 auto 12px;">
            <iframe id="cameraFrame" src="http://192.168.4.1/" style="width: 100%; height: 100%; border: none; transition: transform 0.2s ease; transform-origin: center center;" title="Live Bio-Dome Stream"></iframe>
            <div class="cam-badge" style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 4px; font-size: 11px; color: #00ff66; font-family: monospace;">● LIVE (OFFLINE-NET)</div>
            
            <div class="cam-controls" style="position: absolute; bottom: 8px; right: 8px; display: flex; gap: 6px; background: rgba(0,0,0,0.6); padding: 4px; border-radius: 6px; backdrop-filter: blur(4px); z-index: 10; border: 1px solid rgba(255,255,255,0.15);">
                <button id="btnZoomOut" style="background: none; border: none; color: #fff; font-size: 16px; font-weight: bold; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='none'">−</button>
                <span id="zoomLevelDisplay" style="color: #fff; font-size: 11px; font-family: monospace; display: flex; align-items: center; justify-content: center; min-width: 32px; font-weight: bold;">1.00x</span>
                <button id="btnZoomIn" style="background: none; border: none; color: #fff; font-size: 16px; font-weight: bold; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='none'">+</button>
            </div>
        </div>
        
        <div id="healthLogStatus" style="font-size: 12px; margin-top: 6px; color: #A9A9A9; font-family: monospace; font-weight: bold;">plant identificated:Unknow</div>
    </div>

    <div class="chat-container card" id="chatContainer">
        <div class="chat-messages" id="chatMessages"></div>
    </div>

    <div class="chat-input-wrap" id="chatInputWrap">
        <div class="chat-input-row">
            <button class="chat-mic-btn" id="chatMicBtn" title="Voice input">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
            </button>
            <input type="text" id="chatInput" class="chat-input" placeholder="Ask Grooty..." autocomplete="off"/>
            <button class="chat-send-btn" id="chatSendBtn" title="Send message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
            </button>
        </div>
    </div>
    `;

    setupEventListeners();
    addBotMessage(getWelcomeMessage());
    handleManualHealthLog('healthy:plant identificated:lettuce');
}

// ─── Welcome Message ──────────────────────────────────────────────────────────
function getWelcomeMessage() {
    return `Welcome, Operator. I am the **SkyRoots Grooty** — your aeroponic intelligence advisor.

I have real-time access to your bio-dome's environmental sensors, control cycles, and manual verification logs.

💡 **Try asking:**
- "How is my plant doing?"
- "Give me a vitality report"`;
}

// ─── Event Listeners & Actions ────────────────────────────────────────────────
function setupEventListeners() {
    const sendBtn = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');
    const micBtn = document.getElementById('chatMicBtn');
    const zoomInBtn = document.getElementById('btnZoomIn');
    const zoomOutBtn = document.getElementById('btnZoomOut');

    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (input) input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    if (micBtn) micBtn.addEventListener('click', startVoice);

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => adjustZoom(0.25));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => adjustZoom(-0.25));
}

function adjustZoom(delta) {
    const frame = document.getElementById('cameraFrame');
    const display = document.getElementById('zoomLevelDisplay');
    if (!frame) return;

    currentZoom = Math.min(3.0, Math.max(1.0, currentZoom + delta));
    frame.style.transform = `scale(${currentZoom})`;
    if (display) {
        display.textContent = `${currentZoom.toFixed(2)}x`;
    }
}

// NEW: Manual Log Submitter & BLE Packager
function handleManualHealthLog(status) {
    // 1. Update our central state so the AI can read it immediately
    sensorState.plantHealth = status;
    updateHealthUIFeedback();

    // 2. Build the exact JSON package your main ESP32 is expecting
    const payload = {
        plant: sensorState.activeProfile || "SkyRoots_Crop",
        mist_int: sensorState.profileData?.mist || 300,
        uv_hrs: sensorState.profileData?.uv || 12,
        health: status
    };

    console.log("Transmitting BLE Packet to AeroGrow_ESP32:", payload);

    // 3. HOOK FOR YOUR APP'S BLE TRANSMITTER:
    // If your app exposes a global BLE writing function, invoke it here:
    if (window.bleManager && typeof window.bleManager.write === 'function') {
        window.bleManager.write(JSON.stringify(payload));
    } else {
        // Fallback alert for debugging inside a plain web browser container
        const statusText = document.getElementById('healthLogStatus');
        if (statusText) {
            statusText.innerText = status;
        }
    }
}

function updateHealthUIFeedback() {
    const statusText = document.getElementById('healthLogStatus');
    if (!statusText) return;
    const current = sensorState.plantHealth || 'healthy:plant identificated:lettuce';
    statusText.innerText = current;
    statusText.style.color = '#00ff66';
}

// ─── Chat Message Rendering ──────────────────────────────────────────────────
function addBotMessage(text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-bubble-wrap bot';

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/></svg>`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot';
    bubble.innerHTML = renderMarkdown(text);

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

function addUserMessage(text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-bubble-wrap user';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.textContent = text;

    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

function createStreamingBubble() {
    const container = document.getElementById('chatMessages');
    if (!container) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-bubble-wrap bot';

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/></svg>`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot streaming';
    bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    return bubble;
}

function updateStreamingBubble(bubble, text) {
    if (!bubble) return;
    bubble.classList.remove('streaming');
    bubble.innerHTML = renderMarkdown(text);
    const container = document.getElementById('chatMessages');
    if (container) container.scrollTop = container.scrollHeight;
}

// ─── Send Handler ─────────────────────────────────────────────────────────────
async function handleSend() {
    if (isStreaming) return;

    const input = document.getElementById('chatInput');
    const text = input?.value?.trim();
    if (!text) return;

    input.value = '';
    addUserMessage(text);
    chatHistory.push({ role: 'user', content: text });

    isStreaming = true;
    setSendState(true);
    streamingBubble = createStreamingBubble();

    try {
        await streamChat(text);
    } catch (err) {
        console.error('Grooty error:', err);
        if (streamingBubble) {
            updateStreamingBubble(streamingBubble, `⚠️ Communication error: ${err.message}. Please check your key and try again.`);
        }
    }

    isStreaming = false;
    streamingBubble = null;
    setSendState(false);
}

function setSendState(sending) {
    const btn = document.getElementById('chatSendBtn');
    if (btn) btn.classList.toggle('sending', sending);
    const input = document.getElementById('chatInput');
    if (input) input.disabled = sending;
}

// ─── LLM Streaming API Call ───────────────────────────────────────────────────
async function streamChat(userMessage) {
    const messages = [
        { role: 'system', content: getSystemPrompt() },
        ...chatHistory.slice(-6)
    ];

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: messages,
            stream: true
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API ${response.status}: ${errText.substring(0, 120)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let botText = '';
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const data = line.trim();
            if (data === 'data: [DONE]') break;
            if (data.startsWith('data: ')) {
                try {
                    const json = JSON.parse(data.slice(6));
                    const text = json.choices[0]?.delta?.content || '';
                    botText += text;
                    updateStreamingBubble(streamingBubble, botText);
                } catch (e) { }
            }
        }
    }

    if (!botText) botText = 'Connection interrupted. Please try again.';
    chatHistory.push({ role: 'assistant', content: botText });
    updateStreamingBubble(streamingBubble, botText);
}

// ─── Voice Input (Web Speech API) ─────────────────────────────────────────────
function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        addBotMessage('⚠️ Voice input is not supported in this browser. Try Chrome or Edge.');
        return;
    }

    const micBtn = document.getElementById('chatMicBtn');
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    if (micBtn) micBtn.classList.add('listening');

    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        const input = document.getElementById('chatInput');
        if (input) input.value = transcript;
        if (micBtn) micBtn.classList.remove('listening');
    };

    recognition.onerror = () => { if (micBtn) micBtn.classList.remove('listening'); };
    recognition.onend = () => { if (micBtn) micBtn.classList.remove('listening'); };

    recognition.start();
}
