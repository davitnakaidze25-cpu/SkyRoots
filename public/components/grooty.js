// Only the active Grooty owns the WebGL canvas. Earlier replies keep their transparent portraits.
const modelUrl = new URL('../assets/models/grooty.glb', import.meta.url);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let host = null;
let stage = null;
let loading = null;
let unavailable = false;
let visible = false;
let frame = 0;
let previousTime = 0;
let width = 0;
let height = 0;
let pointerX = 0;
let pointerY = 0;
let greetingStart = -10;

function allowGreeting(enabled) {
  if (!host || host.disabled === !enabled) return;
  host.disabled = !enabled;
  host.setAttribute('aria-label', enabled ? 'Greet Grooty' : 'Grooty, your leafy robot assistant');
}

function canDraw() {
  return host?.isConnected && visible && !document.hidden && width > 0 && height > 0;
}

function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
  previousTime = 0;
}

function wake() {
  if (!canDraw()) {
    stop();
    return;
  }
  if (unavailable || stage?.lost) return;
  if (!stage) {
    if (!loading) loading = createStage().catch(reportFailure);
    return;
  }
  if (stage.canvas.parentNode !== host) host.append(stage.canvas);
  if (!frame) frame = requestAnimationFrame(draw);
}

function reportFailure(error) {
  unavailable = true;
  stop();
  host?.classList.remove('grooty-ready');
  allowGreeting(false);
  console.warn('Grooty is using the still portrait.', error);
}

function measure() {
  width = host?.clientWidth || 0;
  height = host?.clientHeight || 0;
  if (stage) stage.resize(width, height);
  wake();
}

const intersections = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.target === host) visible = entry.isIntersecting;
  }
  wake();
});
const sizes = new ResizeObserver(measure);
document.addEventListener('visibilitychange', wake);
reducedMotion.addEventListener('change', () => {
  stop();
  if (reducedMotion.matches) allowGreeting(false);
  if (stage) greetingStart = -10;
  wake();
});

function trackPointer(event) {
  if (reducedMotion.matches || event.pointerType === 'touch') return;
  const rect = host.getBoundingClientRect();
  pointerX = Math.max(-1, Math.min(1, 2 * (event.clientX - rect.left) / rect.width - 1));
  pointerY = Math.max(-1, Math.min(1, 2 * (event.clientY - rect.top) / rect.height - 1));
}

function resetPointer() {
  pointerX = pointerY = 0;
}

function greet() {
  if (stage && !reducedMotion.matches) greetingStart = stage.age;
}

export function attachGrooty(nextHost) {
  if (nextHost === host) return;
  stop();
  if (host) {
    host.classList.remove('grooty-ready');
    allowGreeting(false);
    host.removeEventListener('pointermove', trackPointer);
    host.removeEventListener('pointerleave', resetPointer);
    host.removeEventListener('click', greet);
    intersections.unobserve(host);
    sizes.unobserve(host);
  }
  stage?.canvas.remove();
  host = nextHost;
  visible = false;
  resetPointer();
  greetingStart = -10;
  if (!host) return;
  allowGreeting(false);
  host.addEventListener('pointermove', trackPointer, { passive: true });
  host.addEventListener('pointerleave', resetPointer);
  host.addEventListener('click', greet);
  intersections.observe(host);
  sizes.observe(host);
  measure();
}

function draw(now) {
  frame = 0;
  if (!canDraw() || stage.lost || unavailable) return;
  const elapsed = previousTime ? now - previousTime : 0;
  if (reducedMotion.matches || !previousTime || elapsed >= 1000 / 30 - 1) {
    previousTime = now;
    try {
      stage.pose(reducedMotion.matches ? 0 : Math.min(elapsed, 100) / 1000);
      stage.renderer.render(stage.scene, stage.camera);
      if (!stage.renderer.getContext().isContextLost()) {
        host.classList.add('grooty-ready');
        allowGreeting(!reducedMotion.matches);
      }
    } catch (error) {
      reportFailure(error);
      return;
    }
  }
  if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
}

async function createStage() {
  const T = await import('../assets/vendor/grooty-three.js');
  const canvas = document.createElement('canvas');
  canvas.className = 'grooty-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  let character;
  try {
    character = (await new T.GLTFLoader().loadAsync(modelUrl.href)).scene;
  } catch (error) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
  renderer.setClearColor(0, 0);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(27, 1, 0.05, 30);
  scene.environmentIntensity = 0.155;
  // These softboxes produce moving reflections, but never appear behind the character.
  let reflection;
  function lightStudio() {
    const room = new T.RoomEnvironment();
    for (const panel of room.children) {
      if (!panel.material?.emissiveIntensity || panel.material.emissiveIntensity <= 1) continue;
      panel.material.emissive.set(panel.position.x < -5 ? 0xffc599 : 0xe3f1ff);
    }
    const generator = new T.PMREMGenerator(renderer);
    reflection?.dispose();
    reflection = generator.fromScene(room, 0.02, 0.1, 100, { size: 128 });
    scene.environment = reflection.texture;
    generator.dispose();
    room.dispose();
  }
  lightStudio();
  const key = new T.DirectionalLight(0xf2f8ff, 3.5);
  key.position.set(4.1, 3.4, 1.45);
  const rim = new T.DirectionalLight(0xe6efdf, 0.64);
  rim.position.set(-1.4, 2.1, -3.5);
  const warm = new T.DirectionalLight(0xf4a274, 0.27);
  warm.position.set(-3.4, 0.15, 0.85);
  const bounce = new T.HemisphereLight(0xe5f3ff, 0xe9aa7e, 0.07);
  scene.add(key, rim, warm, bounce);

  const bounds = new T.Box3().setFromObject(character, true);
  const dimensions = bounds.getSize(new T.Vector3());
  const center = bounds.getCenter(new T.Vector3());
  const normalized = new T.Group();
  normalized.scale.setScalar(1 / dimensions.y);
  normalized.position.copy(center).multiplyScalar(-1 / dimensions.y);
  normalized.add(character);
  // A little amber spill from each cheek LED falls onto the curved shell.
  for (const side of [-1, 1]) {
    const cheek = new T.PointLight(0xff6325, 0.0024, 0.14);
    cheek.position.set(side * 0.371, 0.823, 0.396);
    normalized.add(cheek);
  }
  const pivot = new T.Group();
  pivot.add(normalized);
  scene.add(pivot);

  const parts = new Map();
  character.traverse(node => parts.set(node.name.replace(/[._]/g, ''), node));
  const eyes = ['EyeL', 'EyeR'].map(name => parts.get(name)).filter(Boolean)
    .map(node => ({ node, open: node.scale.y }));
  const sprout = parts.get('Sprout');
  const leftArm = parts.get('ArmL');
  const rightArm = parts.get('ArmR');
  const sproutRoll = sprout?.rotation.z || 0;
  const leftRest = leftArm?.rotation.z || 0;
  const rightRest = rightArm?.rotation.z || 0;
  let lookX = 0;
  let lookY = 0;
  let nextBlink = 2.9;
  let blinkCount = 0;

  function resize(w, h) {
    if (!w || !h) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const margin = h < 85 ? 1.045 : 1.085;
    const span = Math.max(1, dimensions.x / dimensions.y / camera.aspect) * margin;
    camera.position.z = span / (2 * Math.tan(camera.fov * Math.PI / 360)) + 0.38 * dimensions.z / dimensions.y;
    camera.updateProjectionMatrix();
  }

  function pose(dt) {
    const moving = !reducedMotion.matches;
    stage.age += dt;
    const t = moving ? stage.age : 0;
    const gazeEase = 1 - Math.exp(-dt * 8);
    lookX = moving ? lookX + (pointerX - lookX) * gazeEase : 0;
    lookY = moving ? lookY + (pointerY - lookY) * gazeEase : 0;
    const greetAge = t - greetingStart;
    const greeting = moving && greetAge >= 0 && greetAge < 1.05
      ? Math.sin(Math.PI * greetAge / 1.05) ** 2 : 0;
    const breath = moving ? Math.sin(t * 1.95) : 0;
    pivot.position.y = 0.012 * breath + 0.017 * greeting;
    pivot.rotation.set(
      0.017 + 0.105 * lookY + 0.008 * breath + 0.14 * greeting,
      -0.065 + (moving ? 0.082 * Math.sin(t * 0.79) : 0) + 0.27 * lookX,
      (moving ? 0.017 * Math.sin(t * 1.14) : 0) - 0.038 * greeting
    );
    if (sprout) sprout.rotation.z = sproutRoll + (moving ? 0.042 * Math.sin(t * 1.95 - 0.47) : 0) - 0.11 * greeting;
    if (leftArm) leftArm.rotation.z = leftRest - 0.042 * breath - 0.08 * greeting;
    if (rightArm) rightArm.rotation.z = rightRest + 0.052 * breath + 0.53 * greeting;
    const sinceBlink = t - nextBlink;
    const closure = sinceBlink >= 0 && sinceBlink < 0.21
      ? Math.sin(Math.PI * sinceBlink / 0.21) ** 2 : 0;
    for (const eye of eyes) eye.node.scale.y = eye.open * (1 - 0.91 * closure);
    if (sinceBlink >= 0.21) {
      ++blinkCount;
      nextBlink = blinkCount % 5 === 0 ? t + 0.20 : t + 3.1 + Math.sin(blinkCount * 1.7) * 0.86;
    }
  }

  stage = { canvas, renderer, scene, camera, pose, resize, age: 0, lost: false };
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    stage.lost = true;
    host?.classList.remove('grooty-ready');
    allowGreeting(false);
    stop();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      lightStudio();
      stage.lost = false;
      measure();
    } catch (error) {
      reportFailure(error);
    }
  });
  measure();
}
