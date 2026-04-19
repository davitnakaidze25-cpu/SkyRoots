// components/ocean.js
// Deep Abyss Theme — Calm Caustics, Slow Rising Bubbles, Bioluminescent Fish

export function initOcean(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'ocean-canvas';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: false });
    let w, h, time = 0;

    // ─── Calm Bubble System ────────────────────────────────────────────────────
    // Very slow, gentle rise — like deep ocean at 3000m depth
    const bubbles = [];
    function makeBubble(y) {
        return {
            x: Math.random() * (w || 400),
            y: y !== undefined ? y : (h || 800) + Math.random() * 200,
            r: Math.random() * 10 + 3,           // 3–13px
            speedY: Math.random() * 0.15 + 0.05, // calm: 0.05–0.20px/frame
            wobbleAmp: Math.random() * 8 + 2,    // gentle sway 2–10px
            wobbleFreq: Math.random() * 0.008 + 0.003,
            wobblePhase: Math.random() * Math.PI * 2,
            opacity: Math.random() * 0.22 + 0.06,
            shimmerPhase: Math.random() * Math.PI * 2
        };
    }
    // Bottom zone — normal upward risers
    for (let i = 0; i < 25; i++) {
        const b = makeBubble(Math.random() * (window.innerHeight || 800) * 0.35 + (window.innerHeight || 800) * 0.65);
        bubbles.push(b);
    }
    // Mid-screen zone — many more bubbles centered vertically (30% to 70%)
    for (let i = 0; i < 35; i++) {
        const b = makeBubble(Math.random() * (window.innerHeight || 800) * 0.4 + (window.innerHeight || 800) * 0.3);
        b.r = Math.random() * 8 + 2;
        bubbles.push(b);
    }
    // Upper zone — sparse risers
    for (let i = 0; i < 15; i++) {
        const b = makeBubble(Math.random() * (window.innerHeight || 800) * 0.3);
        b.r = Math.random() * 5 + 1.5;
        b.opacity = Math.random() * 0.12 + 0.04;
        bubbles.push(b);
    }


    // ─── Light Ray System ──────────────────────────────────────────────────────
    const rays = Array.from({ length: 6 }, (_, i) => ({
        phase: (i / 6) * Math.PI * 2,
        width: 55 + Math.random() * 80,
        sweepSpeed: 0.00015 + Math.random() * 0.0001,  // very slow sweep
        opacity: 0.008 + Math.random() * 0.008
    }));

    // ─── Bioluminescent Fish ───────────────────────────────────────────────────
    const fish = [];
    let nextFishTime = 35000 + Math.random() * 55000;

    function makeFish() {
        const goRight = Math.random() > 0.5;
        return {
            x: goRight ? -250 : (w || 400) + 250,
            y: (h || 800) * (0.15 + Math.random() * 0.55),
            dir: goRight ? 1 : -1,
            speed: 0.45 + Math.random() * 0.4,
            scale: 0.5 + Math.random() * 0.9,
            opacity: 0,
            done: false,
            age: 0,
            color: Math.random() > 0.5 ? [0, 234, 211] : [0, 160, 255]
        };
    }

    // ─── Resize ────────────────────────────────────────────────────────────────
    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // ─── Fish renderer ─────────────────────────────────────────────────────────
    function drawFish(f) {
        const [r, g, b] = f.color;
        ctx.save();
        ctx.translate(f.x, f.y + Math.sin(time * 0.0015 + f.age * 0.04) * 6);
        ctx.scale(f.dir * f.scale, f.scale);
        ctx.globalAlpha = f.opacity;

        // Soft glow halo
        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 70);
        halo.addColorStop(0, `rgba(${r},${g},${b},0.18)`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.ellipse(0, 0, 75, 38, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = `rgba(${r},${g},${b},0.13)`;
        ctx.beginPath();
        ctx.moveTo(62, 0);
        ctx.bezierCurveTo(42, -20, -18, -14, -65, 0);
        ctx.bezierCurveTo(-18, 14, 42, 20, 62, 0);
        ctx.fill();

        // Tail flap
        const flap = Math.sin(time * 0.005 + f.age * 0.08) * 10;
        ctx.fillStyle = `rgba(${r},${g},${b},0.10)`;
        ctx.beginPath();
        ctx.moveTo(-65, 0);
        ctx.lineTo(-92, -20 + flap);
        ctx.lineTo(-80, 0);
        ctx.lineTo(-92, 20 - flap);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    // ─── Main draw ─────────────────────────────────────────────────────────────
    function draw() {
        // Deep ocean gradient base
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0,   '#001220');
        bg.addColorStop(0.5, '#000c16');
        bg.addColorStop(1,   '#000408');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Caustic light rays — gentle, slow sweeping columns
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (const ray of rays) {
            const xPos = w * 0.5 + Math.sin(time * ray.sweepSpeed + ray.phase) * w * 0.42;
            const rayGrad = ctx.createLinearGradient(xPos, 0, xPos, h);
            rayGrad.addColorStop(0,   `rgba(0, 195, 255, ${ray.opacity * 3})`);
            rayGrad.addColorStop(0.35, `rgba(0, 195, 255, ${ray.opacity})`);
            rayGrad.addColorStop(1,   'rgba(0,195,255,0)');
            ctx.fillStyle = rayGrad;
            ctx.beginPath();
            ctx.moveTo(xPos - ray.width * 0.4, 0);
            ctx.lineTo(xPos + ray.width * 0.4, 0);
            ctx.lineTo(xPos + ray.width * 1.6, h);
            ctx.lineTo(xPos - ray.width * 1.6, h);
            ctx.closePath();
            ctx.fill();
        }
        // Subtle caustic shimmer lines at top third
        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = 'rgba(0, 234, 211, 1)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            for (let x = 0; x <= w; x += 12) {
                const y = h * 0.28 +
                    Math.sin((x * 0.006) + time * 0.0005 + i * 1.2) * 65 *
                    Math.cos(time * 0.0003 + i);
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();

        // Bubbles — calm, slow, gentle
        for (const b of bubbles) {
            b.y -= b.speedY;
            const wx = b.x + Math.sin(time * b.wobbleFreq + b.wobblePhase) * b.wobbleAmp;

            if (b.y < -b.r - 10) {
                Object.assign(b, makeBubble());
            }

            const alpha = b.opacity * (0.75 + Math.sin(time * 0.003 + b.shimmerPhase) * 0.25);

            ctx.save();
            ctx.globalAlpha = alpha;

            // Outer ring
            ctx.beginPath();
            ctx.arc(wx, b.y, b.r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 234, 211, 0.5)';
            ctx.lineWidth = 0.7;
            ctx.stroke();

            // Very subtle inner fill
            ctx.fillStyle = 'rgba(100, 200, 255, 0.04)';
            ctx.fill();

            // Tiny specular highlight
            ctx.beginPath();
            ctx.arc(wx - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.22, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();
            ctx.restore();
        }

        // Fish
        if (time > nextFishTime && fish.length < 2) {
            fish.push(makeFish());
            nextFishTime = time + 35000 + Math.random() * 55000;
        }
        for (let i = fish.length - 1; i >= 0; i--) {
            const f = fish[i];
            f.age++;
            f.x += f.dir * f.speed;
            if (!f.done) f.opacity = Math.min(0.65, f.opacity + 0.006);
            if (f.x < -350 || f.x > w + 350) { fish.splice(i, 1); continue; }
            drawFish(f);
        }

        time += 16;
        requestAnimationFrame(draw);
    }
    draw();
}
