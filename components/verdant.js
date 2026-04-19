// components/verdant.js
// Verdant Earth Theme — Sky with Drifting Clouds, Rolling Hills, Birds, Pollen
// Optimized for clarity and "Earthy" feel without any "dirt" soil chunks.

export function initVerdant(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'verdant-canvas';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: false });
    let w, h, time = 0;

    // ─── Cloud System ───────────────────────────────────────────────────────────
    // Soft, large puffy clouds drifting slowly left to right
    const clouds = [];
    function makeCloud(startLeft = false) {
        const size = 100 + Math.random() * 160;
        return {
            x: startLeft ? -(size * 3) : Math.random() * (w || 500),
            y: (0.02 + Math.random() * 0.45) * (h || 800),
            size,
            speed: 0.15 + Math.random() * 0.22,
            opacity: 0.45 + Math.random() * 0.35,
            puffs: Array.from({ length: 6 + Math.floor(Math.random() * 5) }, () => ({
                ox: (Math.random() - 0.5) * size * 1.5,
                oy: (Math.random() - 0.5) * size * 0.6,
                r: size * (0.35 + Math.random() * 0.55)
            }))
        };
    }
    for (let i = 0; i < 9; i++) clouds.push(makeCloud(false));

    // ─── Bird Flock System ──────────────────────────────────────────────────────
    const flocks = [];
    let nextFlockTime = 5000 + Math.random() * 12000;

    function makeFlock() {
        const count = 3 + Math.floor(Math.random() * 4);
        const startY = (h || 800) * (0.05 + Math.random() * 0.35);
        return {
            x: -(w || 500) * 0.2,
            y: startY,
            speed: 0.9 + Math.random() * 0.7,
            birds: Array.from({ length: count }, (_, i) => ({
                ox: (i % 2 === 0 ? 1 : -1) * Math.floor((i + 1) / 2) * 25,
                oy: Math.floor((i + 1) / 2) * 12,
                wingPhase: Math.random() * Math.PI * 2
            })),
            done: false
        };
    }

    // ─── Pollen Motes (Small & Glowing, not dirt) ───────────────────────────────
    const motes = [];
    function makeMote() {
        return {
            x: Math.random() * (w || 500),
            y: Math.random() * (h || 800),
            r: Math.random() * 2 + 0.3,
            speedX: (Math.random() - 0.4) * 0.4,
            speedY: -(Math.random() * 0.3 + 0.08),
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.015 + Math.random() * 0.015,
            opacity: Math.random() * 0.35 + 0.1,
            color: Math.random() > 0.5
                ? 'rgba(255, 250, 200,' // glowing gold
                : 'rgba(255, 255, 255,' // pure white
        };
    }
    for (let i = 0; i < 40; i++) motes.push(makeMote());

    // ─── Resize ─────────────────────────────────────────────────────────────────
    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // ─── Cloud Renderer ──────────────────────────────────────────────────────────
    function drawCloud(c) {
        ctx.save();
        ctx.globalAlpha = c.opacity;
        for (const p of c.puffs) {
            const grd = ctx.createRadialGradient(
                c.x + p.ox, c.y + p.oy, 0,
                c.x + p.ox, c.y + p.oy, p.r
            );
            grd.addColorStop(0, 'rgba(255,255,255,0.9)');
            grd.addColorStop(0.6, 'rgba(240,248,255,0.4)');
            grd.addColorStop(1, 'rgba(240,245,245,0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(c.x + p.ox, c.y + p.oy, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // ─── Bird Renderer ───────────────────────────────────────────────────────────
    function drawBird(x, y, wingPhase) {
        const flap = Math.sin(time * 0.01 + wingPhase) * 6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x - 10, y - flap, x - 18, y - 2);
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 10, y - flap, x + 18, y - 2);
        ctx.strokeStyle = 'rgba(45, 80, 50, 0.4)';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    // ─── Main draw loop ──────────────────────────────────────────────────────────
    function draw() {
        // Sky gradient
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0,    '#bce5f3'); 
        sky.addColorStop(0.4,  '#d6f0e6'); 
        sky.addColorStop(0.7,  '#e4f3dd'); 
        sky.addColorStop(1,    '#cde8c2'); 
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        // Sun
        const sun = ctx.createRadialGradient(w * 0.85, h * 0.05, 0, w * 0.85, h * 0.05, h * 0.6);
        sun.addColorStop(0, 'rgba(255, 250, 210, 0.45)');
        sun.addColorStop(0.4, 'rgba(255, 250, 210, 0.15)');
        sun.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sun;
        ctx.fillRect(0, 0, w, h);

        // Rolling hills — deeper green for better grounding
        ctx.fillStyle = 'rgba(120, 180, 120, 0.35)'; // Far
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 10) {
            const y = h * 0.7 + Math.sin(x * 0.0025 + 0.8) * h * 0.08 + Math.sin(x * 0.006) * h * 0.035;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.fill();

        ctx.fillStyle = 'rgba(80, 150, 95, 0.4)'; // Mid
        ctx.beginPath();
        for (let x = 0; x <= w; x += 10) {
            const y = h * 0.78 + Math.sin(x * 0.0035 + 1.5) * h * 0.07 + Math.sin(x * 0.008 + 0.4) * h * 0.03;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.fill();

        ctx.fillStyle = 'rgba(55, 120, 65, 0.45)'; // Near
        ctx.beginPath();
        for (let x = 0; x <= w; x += 10) {
            const y = h * 0.86 + Math.sin(x * 0.0045 + 2.4) * h * 0.065 + Math.cos(x * 0.01) * h * 0.025;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.fill();

        // Clouds
        for (const c of clouds) {
            c.x += c.speed;
            if (c.x > w + c.size * 3) Object.assign(c, makeCloud(true));
            drawCloud(c);
        }

        // Birds
        if (time > nextFlockTime && flocks.length < 4) {
            flocks.push(makeFlock());
            nextFlockTime = time + 6000 + Math.random() * 15000;
        }
        for (let i = flocks.length - 1; i >= 0; i--) {
            const flock = flocks[i];
            flock.x += flock.speed;
            if (flock.x > w + 250) { flocks.splice(i, 1); continue; }
            for (const bird of flock.birds) {
                drawBird(flock.x + bird.ox, flock.y + bird.oy, bird.wingPhase);
            }
        }

        // Pollen
        for (const m of motes) {
            m.wobble += m.wobbleSpeed;
            m.x += m.speedX + Math.sin(m.wobble) * 0.4;
            m.y += m.speedY;
            if (m.y < -10 || m.x < -10 || m.x > w + 10) Object.assign(m, makeMote());
            const a = m.opacity * (0.6 + Math.sin(m.wobble * 2) * 0.4);
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
            ctx.fillStyle = m.color + a + ')';
            ctx.fill();
        }

        time += 16;
        requestAnimationFrame(draw);
    }
    draw();
}
