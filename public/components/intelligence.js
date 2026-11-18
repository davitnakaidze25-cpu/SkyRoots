// components/intelligence.js
// Intelligence Screen — SkyRoots Grooty LLM Chatbot
// Context-aware AI advisor with streaming responses and voice input.
// READ-ONLY: cannot control hardware directly.

import { sensorState } from './sensorState.js';
import { attachGrooty } from './grooty.js';

const API_URL = '/api/chat';

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
- Latest camera prediction: ${s.cameraPrediction || 'Waiting for a result'}
- Active Profile: ${s.activeProfile || 'None loaded'}
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
- Interpret real-time aeroponic sensor data (temperature, humidity, UV light cycles, misting intervals).
- Provide comprehensive "Vitality Reports" that synthesize all sensor data into actionable insights.
- Explain system decisions, environmental conditions, and optimal ranges for different crops.
- Guide users through troubleshooting, optimization, and harvest timing.

${sensorContext}

BEHAVIORAL RULES:
1. You are READ-ONLY. You CANNOT directly control hardware (relays, misting, UV lights).
2. If a user asks you to change settings, direct them to the "Profiles" tab in the app.
3. Always reference actual live sensor values when discussing plant health. Include the exact numbers.
4. When conditions are outside optimal ranges, explain WHY and what the automated system is doing to correct it.
5. Keep responses concise but informative. Use bullet points for data summaries.
6. When asked variations of "How is my plant doing?", produce a structured Vitality Report.
7. If the system is offline (not connected), let the user know you're working with no live data.
8. Use markdown formatting: **bold** for emphasis, bullet lists for data points.

VITALITY REPORT FORMAT (use when asked about plant health):
📊 **Vitality Report**
- **Overall Status**: [THRIVING / STABLE / NEEDS ATTENTION]
- **Temperature**: [value] — [assessment vs optimal range]
- **Humidity**: [value] — [assessment]
- **UV Cycle**: [status] — [assessment]
- **Misting**: [status]
- **Recommendation**: [actionable advice]`;
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

    // Data badges — temperature
    html = html.replace(/(\d+\.?\d*\s*°C)/g, '<span class="data-badge badge-temp">$1</span>');
    // Data badges — humidity
    html = html.replace(/(\d+\.?\d*%(?:\s*RH)?)/g, '<span class="data-badge badge-hum">$1</span>');

    return html;
}

// ─── Main Render ──────────────────────────────────────────────────────────────
export function renderIntelligence(container) {
    container.innerHTML = `
    <div class="intel-header">
        <h2 class="screen-title">Grooty</h2>
        <span class="screen-subtitle">Growing assistant</span>
    </div>

    <!-- Chat Messages Area -->
    <div class="chat-container card" id="chatContainer">
        <div class="chat-messages" id="chatMessages">
            <div class="chat-bubble-wrap bot chat-welcome">
                <button type="button" class="chat-avatar grooty-character" aria-label="Grooty, your leafy robot assistant" disabled>
                    <img class="grooty-poster" src="assets/images/grooty-idle.png" alt="">
                </button>
                <div class="chat-bubble bot">
                    <strong class="chat-welcome-title">Hi, I’m Grooty.</strong>
                    <span>Ask me about your crops or chamber readings.</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Input Area -->
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
            <input type="text" id="chatInput" class="chat-input" aria-label="Message Grooty" placeholder="Ask Grooty…" autocomplete="off"/>
            <button class="chat-send-btn" id="chatSendBtn" title="Send message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
            </button>
        </div>
    </div>
    `;

    attachGrooty(container.querySelector('.grooty-character'));
    setupEventListeners();
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function setupEventListeners() {
    const sendBtn = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');
    const micBtn = document.getElementById('chatMicBtn');

    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (input) input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    if (micBtn) micBtn.addEventListener('click', startVoice);
}





// ─── Chat Message Rendering ──────────────────────────────────────────────────
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

    const avatar = container.querySelector('.grooty-character');
    if (avatar) {
        const portrait = avatar.querySelector('.grooty-poster').cloneNode(false);
        portrait.className = 'chat-avatar grooty-history-portrait';
        avatar.replaceWith(portrait);
        wrapper.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot streaming';
    bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

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
        await streamChat();
    } catch (err) {
        console.error('Grooty error:', err);
        if (streamingBubble) {
            updateStreamingBubble(streamingBubble, `⚠️ Communication error: ${err.message}. Please try again in a moment.`);
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
async function streamChat() {
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
        updateStreamingBubble(createStreamingBubble(), 'Voice input is unavailable in this browser. You can still type your message.');
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

    recognition.onerror = () => {
        if (micBtn) micBtn.classList.remove('listening');
    };

    recognition.onend = () => {
        if (micBtn) micBtn.classList.remove('listening');
    };

    recognition.start();
}
