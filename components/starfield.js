// components/starfield.js
// GPU-accelerated canvas starfield with twinkling, shooting stars, and parallax.
// Self-initializing — no imports needed from app.js.

const STAR_COUNT = 180;
const SHOOT_INTERVAL_MIN = 9000;  // ms
const SHOOT_INTERVAL_MAX = 22000; // ms

function initStarfield(canvas) {
    const ctx = canvas.getContext('2d');
    const stars = [];
    const shootingStars = [];
    const bubbles = [];
    let w, h;
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    let nextShootTime = performance.now() + 4000 + Math.random() * 6000;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }

    function createStars() {
        stars.length = 0;
        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() * 1.4 + 0.4,
                speed: Math.random() * 0.015 + 0.004,
                phase: Math.random() * Math.PI * 2,
                depth: Math.random() * 3 + 1,
            });
        }
        bubbles.length = 0;
        for (let j = 0; j < 6; j++) {
            bubbles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() * 20 + 8,
                speedY: Math.random() * -0.5 - 0.2, // Drifting slowly upward
                speedX: Math.random() * 0.4 - 0.2,
                opacity: Math.random() * 0.05 + 0.01
            });
        }
    }

    function draw(time) {
        ctx.clearRect(0, 0, w, h);

        // Smooth parallax interpolation
        mouseX += (targetX - mouseX) * 0.04;
        mouseY += (targetY - mouseY) * 0.04;

        // Draw stars
        for (const star of stars) {
            const twinkle = Math.sin(time * star.speed + star.phase) * 0.5 + 0.5;
            const alpha = twinkle * 0.75 + 0.15;

            const px = star.x + mouseX * star.depth * 0.015;
            const py = star.y + mouseY * star.depth * 0.015;

            ctx.beginPath();
            ctx.arc(px, py, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(190, 210, 240, ${alpha})`;
            ctx.fill();

            // Soft glow for brighter stars
            if (star.size > 1.1) {
                ctx.beginPath();
                ctx.arc(px, py, star.size * 3.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(140, 180, 240, ${alpha * 0.06})`;
                ctx.fill();
            }
        }

        // Shooting stars
        maybeSpawnShootingStar(time);
        drawShootingStars(time);

        // Moving Space Bubbles
        for (const b of bubbles) {
            b.y += b.speedY;
            b.x += b.speedX + Math.sin(time * 0.001) * 0.2;
            
            if (b.y < -50) {
                b.y = h + 50;
                b.x = Math.random() * w;
            }

            const bx = b.x + mouseX * 0.03;
            const by = b.y + mouseY * 0.03;

            ctx.beginPath();
            ctx.arc(bx, by, b.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 255, 136, ${b.opacity})`; // Neon green tint space bubbles
            ctx.fill();
        }

        requestAnimationFrame(draw);
    }

    function maybeSpawnShootingStar(time) {
        if (time > nextShootTime) {
            nextShootTime = time + SHOOT_INTERVAL_MIN + Math.random() * (SHOOT_INTERVAL_MAX - SHOOT_INTERVAL_MIN);
            const startX = Math.random() * w * 0.7;
            const startY = Math.random() * h * 0.4;
            shootingStars.push({
                x: startX,
                y: startY,
                angle: Math.PI / 5 + Math.random() * Math.PI / 5,
                speed: 5 + Math.random() * 4,
                life: 1,
                length: 50 + Math.random() * 70,
            });
        }
    }

    function drawShootingStars() {
        for (let i = shootingStars.length - 1; i >= 0; i--) {
            const s = shootingStars[i];
            s.x += Math.cos(s.angle) * s.speed;
            s.y += Math.sin(s.angle) * s.speed;
            s.life -= 0.018;

            if (s.life <= 0) {
                shootingStars.splice(i, 1);
                continue;
            }

            const tailLen = s.length * s.life;
            const tailX = s.x - Math.cos(s.angle) * tailLen;
            const tailY = s.y - Math.sin(s.angle) * tailLen;

            const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
            grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
            grad.addColorStop(0.7, `rgba(200, 220, 255, ${s.life * 0.5})`);
            grad.addColorStop(1, `rgba(255, 255, 255, ${s.life * 0.9})`);

            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(s.x, s.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Bright head dot
            ctx.beginPath();
            ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${s.life * 0.8})`;
            ctx.fill();
        }
    }

    // Event listeners
    window.addEventListener('resize', () => {
        resize();
        createStars();
    });

    window.addEventListener('mousemove', (e) => {
        targetX = e.clientX - w / 2;
        targetY = e.clientY - h / 2;
    });

    // Gyroscope parallax for mobile
    window.addEventListener('deviceorientation', (e) => {
        if (e.gamma !== null) targetX = e.gamma * 6;
        if (e.beta !== null) targetY = (e.beta - 45) * 6;
    }, { passive: true });

    resize();
    createStars();
    requestAnimationFrame(draw);
}

// Self-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('starfield');
    if (canvas) initStarfield(canvas);
});
