const c = document.querySelector('#canvas');
const ctx = c.getContext('2d', { alpha: false, desynchronized: true });
const $ = id => document.getElementById(id);

const defaults = {
  branches: 6, depth: 6, spread: 58, scale: 66, twist: 14,
  speed: 34, width: 11, color: '#f5f5f5', glow: true
};

let s = { ...defaults };
let playing = true;
let phase = 0;
let rot = 0;
let zoom = 1;
let drag = false;
let lastX = 0;
let lastDist = 0;
let lastTap = 0;
let lastNow = performance.now();
let lastFps = lastNow;
let frames = 0;
let shapeDirty = true;
let viewDirty = true;
let path = new Path2D();
let segmentCount = 0;

// iPhone performance rule: geometry is compiled only when shape controls change.
// Animation never recurses. It only transforms and strokes the cached Path2D.
const SEGMENT_BUDGET = 2400;
const DPR_CAP = 1; // Retina 3x is unnecessary for animated line art and costs ~9x fill work.

const ids = ['branches','depth','spread','scale','twist','speed','width'];
const shapeIds = new Set(['branches','depth','spread','scale','twist']);

function sync() {
  ids.forEach(id => {
    $(id).value = s[id];
    $(id + 'Out').value = id === 'scale' ? s[id] + '%' :
      (id === 'spread' || id === 'twist') ? s[id] + '°' : s[id];
  });
  $('color').value = s.color;
  $('glow').checked = s.glow;
  viewDirty = true;
}

ids.forEach(id => $(id).addEventListener('input', e => {
  s[id] = +e.target.value;
  if (shapeIds.has(id)) shapeDirty = true;
  viewDirty = true;
}));

$('color').oninput = e => { s.color = e.target.value; viewDirty = true; };
$('glow').onchange = e => { s.glow = e.target.checked; viewDirty = true; };
$('play').onclick = () => {
  playing = !playing;
  $('play').textContent = playing ? 'Pause' : 'Play';
  viewDirty = true;
};
$('reset').onclick = () => {
  s = { ...defaults }; rot = 0; zoom = 1; shapeDirty = true; sync();
};
$('random').onclick = () => {
  s.branches = 3 + Math.floor(Math.random() * 5);
  s.depth = 3 + Math.floor(Math.random() * 4);
  s.spread = 25 + Math.floor(Math.random() * 105);
  s.scale = 52 + Math.floor(Math.random() * 22);
  s.twist = -42 + Math.floor(Math.random() * 84);
  s.speed = 10 + Math.floor(Math.random() * 55);
  s.width = 6 + Math.floor(Math.random() * 14);
  shapeDirty = true; sync();
};
$('fullscreen').onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
};

function resize() {
  const d = Math.min(devicePixelRatio || 1, DPR_CAP);
  const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
  c.width = Math.round(w * d);
  c.height = Math.round(h * d);
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  ctx.setTransform(d, 0, 0, d, 0, 0);
  shapeDirty = true;
  viewDirty = true;
}
addEventListener('resize', resize, { passive: true });
resize();

function compilePath() {
  const p = new Path2D();
  segmentCount = 0;
  const branches = Math.max(2, s.branches | 0);
  const maxDepth = Math.max(1, s.depth | 0);
  const spread = s.spread * Math.PI / 180;
  const twist = s.twist * Math.PI / 180;
  const sc = s.scale / 100;
  const base = Math.min(innerWidth, innerHeight) * 0.19;

  function addTree(x, y, angle, len, depth) {
    if (depth <= 0 || len < 1 || segmentCount >= SEGMENT_BUDGET) return;
    const x2 = x + Math.sin(angle) * len;
    const y2 = y - Math.cos(angle) * len;
    p.moveTo(x, y); p.lineTo(x2, y2);
    segmentCount++;
    if (depth === 1) return;

    // Iteration stays bounded; budget prevents pathological branch/depth combinations.
    for (let i = 0; i < branches && segmentCount < SEGMENT_BUDGET; i++) {
      const normalized = branches === 1 ? 0 : (i / (branches - 1) - 0.5);
      const a = angle + normalized * spread + twist;
      addTree(x2, y2, a, len * sc, depth - 1);
    }
  }

  for (let i = 0; i < branches && segmentCount < SEGMENT_BUDGET; i++) {
    addTree(0, 0, i * Math.PI * 2 / branches, base, maxDepth);
  }

  path = p;
  shapeDirty = false;
  viewDirty = true;
}

function render() {
  if (shapeDirty) compilePath();

  const w = innerWidth, h = innerHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, c.width, c.height);

  // DPR is capped at 1, so CSS pixel coordinates equal canvas coordinates.
  ctx.setTransform(1, 0, 0, 1, w * 0.5, h * 0.46);
  const pulse = 1 + Math.sin(phase * 1.7) * 0.018;
  ctx.scale(zoom * pulse, zoom * pulse);
  ctx.rotate(rot + phase * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Cheap glow: re-stroke cached path. No shadowBlur, filters, compositing layers, or recursion.
  if (s.glow) {
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(2.3, s.width * 0.28);
    ctx.stroke(path);
  }

  ctx.globalAlpha = 0.92;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = Math.max(0.55, s.width * 0.095);
  ctx.stroke(path);
  ctx.globalAlpha = 1;
  viewDirty = false;
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(50, now - lastNow);
  lastNow = now;

  // 30fps animation is intentional on iPhone: stable frame pacing beats 60fps spikes.
  // While paused, there is zero redraw work unless the user changes something.
  if (playing) {
    if (now - loop.lastPaint < 33) return;
    loop.lastPaint = now;
    phase += dt * 0.00022 * Math.max(0, s.speed);
    viewDirty = true;
  }

  if (viewDirty) render();

  frames++;
  if (now - lastFps >= 1000) {
    $('fps').textContent = Math.round(frames * 1000 / (now - lastFps)) + ' FPS · ' + segmentCount + ' lines';
    frames = 0; lastFps = now;
  }
}
loop.lastPaint = 0;

function dist(ts) {
  return Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
}

c.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    drag = true; lastX = e.touches[0].clientX;
    const n = Date.now();
    if (n - lastTap < 300) { rot = 0; zoom = 1; viewDirty = true; }
    lastTap = n;
  } else if (e.touches.length === 2) {
    drag = false; lastDist = dist(e.touches);
  }
}, { passive: true });

c.addEventListener('touchmove', e => {
  if (e.touches.length === 1 && drag) {
    const x = e.touches[0].clientX;
    rot += (x - lastX) * 0.008;
    lastX = x; viewDirty = true;
  } else if (e.touches.length === 2) {
    const d = dist(e.touches);
    if (lastDist) {
      zoom = Math.max(0.45, Math.min(2.5, zoom * d / lastDist));
      viewDirty = true;
    }
    lastDist = d;
  }
}, { passive: true });

c.addEventListener('touchend', e => {
  drag = false;
  if (e.touches.length < 2) lastDist = 0;
}, { passive: true });

c.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') { drag = true; lastX = e.clientX; }
});
addEventListener('pointermove', e => {
  if (drag && e.pointerType === 'mouse') {
    rot += (e.clientX - lastX) * 0.008; lastX = e.clientX; viewDirty = true;
  }
});
addEventListener('pointerup', () => drag = false);

sync();
shapeDirty = true;
requestAnimationFrame(loop);
