(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = id => document.getElementById(id);

  const state = {
    mode: 'tree', angle: 28.3, scale: 0.707, depth: 9, glow: 16, hue: 105,
    playing: true, t: 0, dpr: 1
  };

  let width = 0, height = 0, last = performance.now(), idleTimer;

  const controls = $('controls'), reveal = $('reveal');
  function showControls() {
    controls.classList.remove('is-hidden');
    reveal.classList.remove('is-visible');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(hideControls, 2500);
  }
  function hideControls() {
    controls.classList.add('is-hidden');
    reveal.classList.add('is-visible');
  }

  function resize() {
    state.dpr = Math.min(devicePixelRatio || 1, 2);
    width = innerWidth; height = innerHeight;
    canvas.width = Math.floor(width * state.dpr);
    canvas.height = Math.floor(height * state.dpr);
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  const color = (depth, a = 1) => {
    const h = (185 + depth * state.hue / Math.max(1, state.depth) + state.t * 6) % 360;
    return `hsla(${h}, 92%, ${58 + Math.sin(depth * 1.7) * 8}%, ${a})`;
  };

  function beginStroke(depth, alpha = .9, widthPx = 1) {
    ctx.strokeStyle = color(depth, alpha);
    ctx.lineWidth = widthPx;
    ctx.shadowBlur = state.glow;
    ctx.shadowColor = color(depth, .75);
  }

  function branch(x, y, len, heading, depth) {
    if (depth <= 0 || len < .8) return;
    const x2 = x + Math.cos(heading) * len;
    const y2 = y + Math.sin(heading) * len;
    beginStroke(depth, .62 + depth / state.depth * .22, Math.max(.55, depth / state.depth * 1.35));
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    const a = state.angle * Math.PI / 180;
    branch(x2, y2, len * state.scale, heading - a, depth - 1);
    branch(x2, y2, len * state.scale, heading + a, depth - 1);
  }

  function drawTree() {
    const a = state.angle * Math.PI / 180;
    const pulse = .94 + Math.sin(state.t * .75) * .025;
    const len = Math.min(width, height) * .23 * pulse;
    const d = state.depth;
    branch(width / 2, height / 2, len, -Math.PI / 2, d);
    branch(width / 2, height / 2, len, Math.PI / 2, d);
    // Side copies recreate the clipped, kaleidoscopic feel from the reference.
    if (width > height * .7) {
      branch(0, height / 2, len * .72, 0, Math.max(3, d - 1));
      branch(width, height / 2, len * .72, Math.PI, Math.max(3, d - 1));
    }
  }

  function hexPath(x, y, r, rotation = 0) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = rotation + i * Math.PI / 3;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function recursiveHex(x, y, r, depth, rot) {
    if (depth <= 0 || r < 3) return;
    beginStroke(depth, .72, Math.max(.5, depth / state.depth));
    hexPath(x, y, r, rot); ctx.stroke();
    const child = r * state.scale * .52;
    const travel = r * (1 - state.scale * .13);
    const a0 = state.angle * Math.PI / 180 + rot;
    for (let i = 0; i < 6; i++) {
      const a = a0 + i * Math.PI / 3;
      recursiveHex(x + Math.cos(a) * travel, y + Math.sin(a) * travel, child, depth - 1, rot + .03);
    }
  }

  function drawHex() {
    const r = Math.min(width, height) * .18;
    const cols = Math.ceil(width / (r * 2.4)) + 2;
    const rows = Math.ceil(height / (r * 2.05)) + 2;
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const x = col * r * 2.3 + (row % 2) * r * 1.15;
        const y = row * r * 2.0;
        recursiveHex(x, y, r, Math.min(state.depth, 5), state.t * .012);
      }
    }
  }

  function drawWeave() {
    const spacing = Math.max(15, Math.min(width, height) * (.035 + (1 - state.scale) * .05));
    const tilt = state.angle * Math.PI / 180;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(Math.sin(state.t * .08) * .01);
    const span = Math.hypot(width, height) * .8;
    for (let i = -Math.ceil(span / spacing); i <= Math.ceil(span / spacing); i++) {
      const o = i * spacing;
      beginStroke(Math.abs(i) % state.depth + 1, .36, .72);
      ctx.beginPath();
      ctx.moveTo(-span, o - Math.tan(tilt) * span * .08);
      ctx.lineTo(span, o + Math.tan(tilt) * span * .08);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(o - Math.tan(tilt) * span * .08, -span);
      ctx.lineTo(o + Math.tan(tilt) * span * .08, span);
      ctx.stroke();
    }
    // Short perpendicular ticks produce the ladder-like reference texture.
    ctx.shadowBlur = state.glow * .45;
    for (let y = -span; y < span; y += spacing * 2) {
      for (let x = -span; x < span; x += spacing * 2) {
        beginStroke(((x + y) / spacing | 0) % state.depth + state.depth, .28, .6);
        ctx.beginPath();
        ctx.moveTo(x - spacing * .28, y); ctx.lineTo(x + spacing * .28, y); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function render(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (state.playing) state.t += dt;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (state.mode === 'hex') drawHex(); else if (state.mode === 'weave') drawWeave(); else drawTree();
    ctx.shadowBlur = 0;
    requestAnimationFrame(render);
  }

  function sync() {
    $('angleOut').textContent = state.angle.toFixed(1) + '°';
    $('scaleOut').textContent = state.scale.toFixed(3);
    $('depthOut').textContent = state.depth;
    $('glowOut').textContent = state.glow;
    $('hueOut').textContent = state.hue + '°';
    $('hudAngle').textContent = state.angle.toFixed(3);
    $('hudScale').textContent = state.scale.toFixed(3);
  }

  const binds = [
    ['mode', v => state.mode = v],
    ['angle', v => state.angle = +v], ['scale', v => state.scale = +v],
    ['depth', v => state.depth = +v], ['glow', v => state.glow = +v], ['hue', v => state.hue = +v]
  ];
  binds.forEach(([id, set]) => $(id).addEventListener('input', e => { set(e.target.value); sync(); showControls(); }));

  $('randomize').addEventListener('click', () => {
    state.angle = 12 + Math.random() * 64;
    state.scale = .56 + Math.random() * .20;
    state.depth = 6 + Math.floor(Math.random() * 6);
    state.hue = Math.floor(45 + Math.random() * 180);
    ['angle','scale','depth','hue'].forEach(id => $(id).value = state[id]);
    sync(); showControls();
  });
  $('animate').addEventListener('click', e => {
    state.playing = !state.playing;
    e.currentTarget.textContent = state.playing ? 'Pause' : 'Play';
    e.currentTarget.setAttribute('aria-pressed', String(state.playing));
    showControls();
  });
  $('collapse').addEventListener('click', hideControls);
  reveal.addEventListener('click', showControls);
  addEventListener('resize', resize);
  ['pointermove','pointerdown','touchstart'].forEach(evt => addEventListener(evt, showControls, {passive:true}));
  addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'c') controls.classList.contains('is-hidden') ? showControls() : hideControls();
    else showControls();
  });

  resize(); sync(); showControls(); requestAnimationFrame(render);
})();
