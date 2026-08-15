(() => {
  'use strict';

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const fxCanvas = document.createElement('canvas');
  const fxCtx = fxCanvas.getContext('2d', { alpha: false, desynchronized: true });
  const $ = id => document.getElementById(id);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isTouch = matchMedia('(pointer: coarse)').matches;

  const state = {
    phase: 28.3,
    baseScale: 0.707,
    depth: 11,
    glow: 14,
    hue: 120,
    morphSpeed: 7.5,
    layerEnabled: true,
    layerIntensity: 0.62,
    playing: true,
    dpr: 1
  };

  const derived = {
    angle: 28.3,
    scale: 0.707,
    colorDrift: 0,
    layerRotation: 0,
    ringPulse: 0
  };

  let width = 0;
  let height = 0;
  let fxWidth = 0;
  let fxHeight = 0;
  let lastFrame = performance.now();
  let lastUiSync = 0;
  let idleTimer = 0;
  let lastActivity = 0;
  let frameParity = 0;
  let layerFrameParity = 0;

  const controls = $('controls');
  const reveal = $('reveal');

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function wrapDegrees(v) {
    v %= 360;
    return v < 0 ? v + 360 : v;
  }

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

    const fxScale = isIOS ? 0.52 : 0.62;
    fxWidth = Math.max(220, Math.floor(width * fxScale));
    fxHeight = Math.max(220, Math.floor(height * fxScale));
    fxCanvas.width = fxWidth;
    fxCanvas.height = fxHeight;
  }

  function syncDerived() {
    const phaseRad = state.phase * Math.PI / 180;
    derived.angle = wrapDegrees(state.phase);
    derived.scale = clamp(
      state.baseScale + Math.sin(phaseRad * 0.73 + 0.9) * 0.018 + Math.sin(phaseRad * 1.91 - 0.35) * 0.008,
      0.56,
      0.78
    );
    derived.colorDrift = wrapDegrees(phaseRad * 36 * 180 / Math.PI);
    derived.layerRotation = phaseRad * 0.24 + Math.sin(phaseRad * 0.47) * 0.55;
    derived.ringPulse = 0.5 + 0.5 * Math.sin(phaseRad * 0.61 - 0.8);
  }

  function colorForDepth(level, depth, alpha = 1, hueOffset = 0) {
    const normalized = level / Math.max(1, depth);
    const hue = wrapDegrees(185 + normalized * state.hue + hueOffset);
    const lightness = 54 + normalized * 5;
    return `hsla(${hue}, 96%, ${lightness}%, ${alpha})`;
  }

  function effectiveDepth() {
    if (isIOS && width * height > 1_050_000) return Math.min(state.depth, 11);
    return Math.min(state.depth, 12);
  }

  function buildTreePaths(opts) {
    const {
      w,
      h,
      depth,
      angleDeg,
      scale,
      rotation = 0,
      centerX = w * 0.5,
      centerY = h * 0.5,
      branchLength = Math.min(w * 0.245, h * 0.185)
    } = opts;

    const paths = Array.from({ length: depth + 1 }, () => new Path2D());
    const turn = angleDeg * Math.PI / 180;

    function trace(x, y, len, heading, level) {
      if (level <= 0 || len < 0.42) return;
      const x2 = x + Math.cos(heading) * len;
      const y2 = y + Math.sin(heading) * len;
      const path = paths[level];
      path.moveTo(x, y);
      path.lineTo(x2, y2);
      const nextLength = len * scale;
      trace(x2, y2, nextLength, heading - turn, level - 1);
      trace(x2, y2, nextLength, heading + turn, level - 1);
    }

    trace(centerX, centerY, branchLength, -Math.PI / 2 + rotation, depth);
    trace(centerX, centerY, branchLength, Math.PI / 2 + rotation, depth);
    return paths;
  }

  function strokeTree(context, paths, depth, options = {}) {
    const {
      alphaBoost = 1,
      lineScale = 1,
      glowScale = 1,
      hueOffset = 0,
      blurClamp = state.glow,
      composite = 'source-over'
    } = options;

    context.globalCompositeOperation = composite;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    for (let level = 1; level <= depth; level++) {
      const strength = level / depth;
      const alpha = (0.46 + strength * 0.44) * alphaBoost;
      context.strokeStyle = colorForDepth(level, depth, clamp(alpha, 0, 1), hueOffset);
      context.shadowColor = colorForDepth(level, depth, 0.68 * alphaBoost, hueOffset);
      context.shadowBlur = Math.min(blurClamp, state.glow * glowScale);
      context.lineWidth = (0.48 + strength * 1.08) * lineScale;
      context.stroke(paths[level]);
    }

    context.shadowBlur = 0;
    context.globalCompositeOperation = 'source-over';
  }

  function drawForegroundTree() {
    const depth = effectiveDepth();
    const branchLength = Math.min(width * 0.245, height * 0.185);
    const paths = buildTreePaths({
      w: width,
      h: height,
      depth,
      angleDeg: derived.angle,
      scale: derived.scale,
      branchLength
    });

    strokeTree(ctx, paths, depth, {
      alphaBoost: 1,
      lineScale: 1,
      glowScale: isIOS ? 0.72 : 0.9,
      hueOffset: derived.colorDrift * 0.15,
      blurClamp: isIOS ? 18 : 24
    });
  }

  function drawLayerField() {
    if (!state.layerEnabled || state.layerIntensity <= 0.001) return;

    const redrawLayer = !isIOS || layerFrameParity === 0 || !state.playing;
    layerFrameParity ^= 1;

    if (redrawLayer) {
      fxCtx.setTransform(1, 0, 0, 1, 0, 0);
      fxCtx.fillStyle = '#000';
      fxCtx.fillRect(0, 0, fxWidth, fxHeight);

      const depth = Math.max(7, effectiveDepth() - 1);
      const branchLength = Math.min(fxWidth * 0.22, fxHeight * 0.165);
      const baseOpts = {
        w: fxWidth,
        h: fxHeight,
        depth,
        angleDeg: wrapDegrees(derived.angle * 0.94 + 18),
        scale: clamp(derived.scale * 0.985, 0.56, 0.79),
        branchLength
      };

      const pathsA = buildTreePaths({
        ...baseOpts,
        rotation: derived.layerRotation * 0.6
      });
      strokeTree(fxCtx, pathsA, depth, {
        alphaBoost: 0.74,
        lineScale: 1.1,
        glowScale: 0.6,
        hueOffset: derived.colorDrift * 0.5,
        blurClamp: 10,
        composite: 'screen'
      });

      const pathsB = buildTreePaths({
        ...baseOpts,
        angleDeg: wrapDegrees(derived.angle * 0.62 + 54),
        scale: clamp(derived.scale * 0.965, 0.55, 0.78),
        rotation: Math.PI / 2 + derived.layerRotation * 0.35
      });
      strokeTree(fxCtx, pathsB, depth, {
        alphaBoost: 0.58,
        lineScale: 0.95,
        glowScale: 0.5,
        hueOffset: 120 + derived.colorDrift * 0.28,
        blurClamp: 9,
        composite: 'lighter'
      });

      fxCtx.globalCompositeOperation = 'lighter';
      fxCtx.globalAlpha = 0.06 + state.layerIntensity * 0.12;
      const gradient = fxCtx.createRadialGradient(
        fxWidth * 0.5,
        fxHeight * 0.5,
        0,
        fxWidth * 0.5,
        fxHeight * 0.5,
        Math.max(fxWidth, fxHeight) * 0.55
      );
      gradient.addColorStop(0, `hsla(${wrapDegrees(derived.colorDrift + 300)}, 100%, 62%, 0.75)`);
      gradient.addColorStop(0.45, `hsla(${wrapDegrees(derived.colorDrift + 120)}, 100%, 58%, 0.35)`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      fxCtx.fillStyle = gradient;
      fxCtx.fillRect(0, 0, fxWidth, fxHeight);
      fxCtx.globalAlpha = 1;
      fxCtx.globalCompositeOperation = 'source-over';
    }

    const a = state.layerIntensity;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.32 + a * 0.2;
    ctx.drawImage(fxCanvas, 0, 0, width, height);

    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.globalAlpha = 0.18 + a * 0.18;
    ctx.drawImage(fxCanvas, 0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.rotate(derived.layerRotation);
    const zoom = 1.02 + derived.ringPulse * 0.14;
    ctx.scale(zoom, zoom);
    ctx.globalAlpha = 0.12 + a * 0.16;
    ctx.drawImage(fxCanvas, -width * 0.5, -height * 0.5, width, height);
    ctx.restore();
    ctx.restore();

    drawRingOverlay(a);
  }

  function drawRingOverlay(intensity) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.98)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.min(width, height) * (0.06 + intensity * 0.035);

    const radius = Math.min(width, height) * (0.14 + intensity * 0.05);
    const midX = width * 0.5;
    const centers = [height * 0.16, height * 0.5, height * 0.84];

    for (const cy of centers) {
      ctx.beginPath();
      ctx.arc(midX, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    const sideRadius = Math.min(width, height) * 0.28;
    const sideY = height * 0.5;
    ctx.beginPath();
    ctx.arc(-sideRadius * 0.18, sideY, sideRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width + sideRadius * 0.18, sideY, sideRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function advanceMorph(dt) {
    if (!state.playing || state.morphSpeed <= 0) return;
    state.phase = wrapDegrees(state.phase + state.morphSpeed * dt);
  }

  function syncStaticUi() {
    $('baseScaleOut').textContent = state.baseScale.toFixed(3);
    $('depthOut').textContent = String(state.depth);
    $('glowOut').textContent = String(state.glow);
    $('hueOut').textContent = state.hue.toFixed(0) + '°';
    $('speedOut').textContent = state.morphSpeed.toFixed(2) + '°/s';
    $('layerOut').textContent = state.layerIntensity.toFixed(2);
    $('layerToggle').textContent = state.layerEnabled ? 'On' : 'Off';
    $('layerToggle').classList.toggle('is-on', state.layerEnabled);
    $('layerToggle').setAttribute('aria-pressed', String(state.layerEnabled));
  }

  function syncLiveUi(force = false, now = performance.now()) {
    if (!force && now - lastUiSync < 80) return;
    lastUiSync = now;
    $('angle').value = derived.angle.toFixed(1);
    $('angleOut').textContent = derived.angle.toFixed(1) + '°';
    $('hudAngle').textContent = derived.angle.toFixed(3);
    $('hudScale').textContent = derived.scale.toFixed(3);
  }

  function render(now) {
    const dt = Math.min(0.08, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;

    advanceMorph(dt);
    syncDerived();
    syncLiveUi(false, now);

    frameParity ^= 1;
    const drawThisFrame = !isIOS || state.dpr < 1.82 || frameParity === 0 || !state.playing;
    if (drawThisFrame) {
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      drawLayerField();
      drawForegroundTree();
    }

    requestAnimationFrame(render);
  }

  $('morphSpeed').addEventListener('input', e => {
    state.morphSpeed = Number(e.target.value);
    syncStaticUi();
    showControls();
  });

  $('angle').addEventListener('input', e => {
    state.phase = Number(e.target.value);
    syncDerived();
    syncLiveUi(true);
    showControls();
  });

  $('baseScale').addEventListener('input', e => {
    state.baseScale = Number(e.target.value);
    syncDerived();
    syncStaticUi();
    syncLiveUi(true);
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

  $('layerIntensity').addEventListener('input', e => {
    state.layerIntensity = Number(e.target.value);
    syncStaticUi();
    showControls();
  });

  $('layerToggle').addEventListener('click', () => {
    state.layerEnabled = !state.layerEnabled;
    syncStaticUi();
    showControls();
  });

  $('reset').addEventListener('click', () => {
    Object.assign(state, {
      phase: 28.3,
      baseScale: 0.707,
      depth: 11,
      glow: 14,
      hue: 120,
      morphSpeed: 7.5,
      layerEnabled: true,
      layerIntensity: 0.62,
      playing: true
    });

    $('morphSpeed').value = state.morphSpeed;
    $('angle').value = state.phase;
    $('baseScale').value = state.baseScale;
    $('depth').value = state.depth;
    $('glow').value = state.glow;
    $('hue').value = state.hue;
    $('layerIntensity').value = state.layerIntensity;
    $('animate').textContent = 'Pause morph';
    $('animate').setAttribute('aria-pressed', 'true');
    syncDerived();
    syncStaticUi();
    syncLiveUi(true);
    lastFrame = performance.now();
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
  syncDerived();
  syncStaticUi();
  syncLiveUi(true);
  showControls();
  requestAnimationFrame(render);
})();
