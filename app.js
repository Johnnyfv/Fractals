(() => {
  'use strict';

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const $ = id => document.getElementById(id);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isTouch = matchMedia('(pointer: coarse)').matches;

  const MORPH_MIN = 2;
  const MORPH_MAX = 90;

  const state = {
    angle: 28.3,
    scale: 0.707,
    depth: 11,
    glow: 14,
    hue: 105,
    morphSpeed: 3.5,
    direction: 1,
    playing: true,
    dpr: 1
  };

  let width = 0;
  let height = 0;
  let lastFrame = performance.now();
  let lastUiSync = 0;
  let idleTimer = 0;
  let lastActivity = 0;
  let frameParity = 0;

  const controls = $('controls');
  const reveal = $('reveal');

  function scheduleHide() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(hideControls, isTouch ? 3300 : 2600);
  }

  function showControls() {
    controls.classList.remove('is-hidden');
    reveal.classList.remove('is-visible');
    scheduleHide();
  }

  function hideControls() {
    controls.classList.add('is-hidden');
    reveal.classList.add('is-visible');
  }

  function viewportSize() {
    const vv = window.visualViewport;
    return {
      w: Math.round(vv?.width || document.documentElement.clientWidth || innerWidth),
      h: Math.round(vv?.height || document.documentElement.clientHeight || innerHeight)
    };
  }

  function resize() {
    const { w, h } = viewportSize();
    width = Math.max(1, w);
    height = Math.max(1, h);

    const rawDpr = window.devicePixelRatio || 1;
    const maxPixels = isIOS ? 4_500_000 : 6_500_000;
    const pixelLimitedDpr = Math.sqrt(maxPixels / (width * height));
    state.dpr = Math.max(1, Math.min(rawDpr, pixelLimitedDpr, isIOS ? 2 : 2.25));

    canvas.width = Math.max(1, Math.floor(width * state.dpr));
    canvas.height = Math.max(1, Math.floor(height * state.dpr));
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function colorForDepth(depth, alpha = 1) {
    // Root starts magenta; the finest tips migrate toward electric blue/cyan.
    const normalized = depth / Math.max(1, state.depth);
    const hue = (185 + normalized * state.hue) % 360;
    const lightness = 55 + normalized * 4;
    return `hsla(${hue}, 94%, ${lightness}%, ${alpha})`;
  }

  function effectiveDepth() {
    // With batched Path2D strokes, 11-12 levels remain practical on iOS.
    // Very large iPads get one less level to avoid sustained thermal throttling.
    if (isIOS && width * height > 1_050_000) return Math.min(state.depth, 11);
    return Math.min(state.depth, 12);
  }

  function buildTreePaths(depth, branchLength) {
    const paths = Array.from({ length: depth + 1 }, () => new Path2D());
    const turn = state.angle * Math.PI / 180;
    const scale = state.scale;

    function trace(x, y, len, heading, level) {
      if (level <= 0 || len < 0.45) return;

      const x2 = x + Math.cos(heading) * len;
      const y2 = y + Math.sin(heading) * len;
      const path = paths[level];
      path.moveTo(x, y);
      path.lineTo(x2, y2);

      const nextLength = len * scale;
      trace(x2, y2, nextLength, heading - turn, level - 1);
      trace(x2, y2, nextLength, heading + turn, level - 1);
    }

    const cx = width * 0.5;
    const cy = height * 0.5;
    trace(cx, cy, branchLength, -Math.PI / 2, depth);
    trace(cx, cy, branchLength, Math.PI / 2, depth);
    return paths;
  }

  function drawMorphTree() {
    const depth = effectiveDepth();
    // Width-driven sizing closely matches the portrait reference and remains stable
    // as Safari's browser chrome expands/collapses.
    const branchLength = Math.min(width * 0.245, height * 0.185);
    const paths = buildTreePaths(depth, branchLength);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let level = 1; level <= depth; level++) {
      const strength = level / depth;
      const alpha = 0.48 + strength * 0.42;
      ctx.strokeStyle = colorForDepth(level, alpha);
      ctx.shadowColor = colorForDepth(level, 0.72);
      ctx.shadowBlur = state.glow * (isIOS ? 0.72 : 0.88);
      ctx.lineWidth = 0.48 + strength * 1.05;
      ctx.stroke(paths[level]);
    }

    ctx.shadowBlur = 0;
  }

  function advanceMorph(dt) {
    if (!state.playing || state.morphSpeed <= 0) return;

    let next = state.angle + state.direction * state.morphSpeed * dt;

    // Ping-pong without a visual jump. The loop also handles a long frame after
    // Safari returns from the background.
    while (next > MORPH_MAX || next < MORPH_MIN) {
      if (next > MORPH_MAX) {
        next = MORPH_MAX - (next - MORPH_MAX);
        state.direction = -1;
      } else if (next < MORPH_MIN) {
        next = MORPH_MIN + (MORPH_MIN - next);
        state.direction = 1;
      }
    }

    state.angle = next;
  }

  function syncStaticUi() {
    $('scaleOut').textContent = state.scale.toFixed(3);
    $('depthOut').textContent = String(state.depth);
    $('glowOut').textContent = String(state.glow);
    $('hueOut').textContent = state.hue.toFixed(0) + '°';
    $('speedOut').textContent = state.morphSpeed.toFixed(2) + '°/s';
    $('hudScale').textContent = state.scale.toFixed(3);
  }

  function syncAngleUi(force = false, now = performance.now()) {
    // DOM writes are throttled; the canvas still morphs every rendered frame.
    if (!force && now - lastUiSync < 80) return;
    lastUiSync = now;
    $('angle').value = state.angle.toFixed(1);
    $('angleOut').textContent = state.angle.toFixed(1) + '°';
    $('hudAngle').textContent = state.angle.toFixed(3);
  }

  function render(now) {
    const dt = Math.min(0.08, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;

    advanceMorph(dt);
    syncAngleUi(false, now);

    // Cap only the hottest/highest-density iOS cases around 30 fps. Animation
    // state still advances every RAF, so speed remains correct.
    frameParity ^= 1;
    const drawThisFrame = !isIOS || state.dpr < 1.82 || frameParity === 0 || !state.playing;

    if (drawThisFrame) {
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      drawMorphTree();
    }

    requestAnimationFrame(render);
  }

  $('morphSpeed').addEventListener('input', e => {
    state.morphSpeed = Number(e.target.value);
    syncStaticUi();
    showControls();
  });

  $('angle').addEventListener('input', e => {
    state.angle = Number(e.target.value);
    // Continue in the direction that has the most room after manual scrubbing.
    if (state.angle >= MORPH_MAX - 0.1) state.direction = -1;
    if (state.angle <= MORPH_MIN + 0.1) state.direction = 1;
    syncAngleUi(true);
    showControls();
  });

  $('scale').addEventListener('input', e => {
    state.scale = Number(e.target.value);
    syncStaticUi();
    showControls();
  });

  $('depth').addEventListener('input', e => {
    state.depth = Number(e.target.value);
    syncStaticUi();
    showControls();
  });

  $('glow').addEventListener('input', e => {
    state.glow = Number(e.target.value);
    syncStaticUi();
    showControls();
  });

  $('hue').addEventListener('input', e => {
    state.hue = Number(e.target.value);
    syncStaticUi();
    showControls();
  });

  $('reset').addEventListener('click', () => {
    Object.assign(state, {
      angle: 28.3,
      scale: 0.707,
      depth: 11,
      glow: 14,
      hue: 105,
      morphSpeed: 3.5,
      direction: 1,
      playing: true
    });

    $('morphSpeed').value = state.morphSpeed;
    $('angle').value = state.angle;
    $('scale').value = state.scale;
    $('depth').value = state.depth;
    $('glow').value = state.glow;
    $('hue').value = state.hue;
    $('animate').textContent = 'Pause morph';
    $('animate').setAttribute('aria-pressed', 'true');
    syncStaticUi();
    syncAngleUi(true);
    showControls();
  });

  $('animate').addEventListener('click', e => {
    state.playing = !state.playing;
    e.currentTarget.textContent = state.playing ? 'Pause morph' : 'Resume morph';
    e.currentTarget.setAttribute('aria-pressed', String(state.playing));
    lastFrame = performance.now();
    showControls();
  });

  $('collapse').addEventListener('click', hideControls);
  reveal.addEventListener('click', showControls);

  function activity() {
    const now = performance.now();
    if (now - lastActivity < 120) return;
    lastActivity = now;
    showControls();
  }

  addEventListener('resize', resize, { passive: true });
  addEventListener('orientationchange', () => setTimeout(resize, 140), { passive: true });
  window.visualViewport?.addEventListener('resize', resize, { passive: true });

  if (isTouch) {
    addEventListener('pointerdown', activity, { passive: true });
  } else {
    addEventListener('pointermove', activity, { passive: true });
    addEventListener('pointerdown', activity, { passive: true });
  }

  addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'c') {
      controls.classList.contains('is-hidden') ? showControls() : hideControls();
    } else if (e.code === 'Space') {
      e.preventDefault();
      $('animate').click();
    } else {
      showControls();
    }
  });

  // Keep the canvas feeling native on iOS Safari instead of panning/zooming the page.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(type => {
    document.addEventListener(type, e => e.preventDefault(), { passive: false });
  });
  document.addEventListener('touchmove', e => {
    if (e.target === canvas) e.preventDefault();
  }, { passive: false });

  document.addEventListener('visibilitychange', () => {
    lastFrame = performance.now();
    if (!document.hidden) resize();
  });

  resize();
  syncStaticUi();
  syncAngleUi(true);
  showControls();
  requestAnimationFrame(render);
})();
