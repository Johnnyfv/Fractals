# Recursive Neon Morph

A dependency-free GitHub Pages app based on the supplied reference video.

## What changed in this rebuild

The reference is not switching between unrelated shape presets. It is one symmetric binary recursive tree whose **branch angle changes continuously** while the scale remains around **0.707**. Changing that one angle naturally produces the tree, spiral/hexagonal, tiled, and H-grid structures seen in the video.

This build therefore:

- starts at **28.3° / 0.707**, matching the supplied screenshot;
- continuously morphs the angle between **2° and 90°** and back without jumps;
- defaults to **3.5° per second**, close to the rate visible in the reference video;
- exposes a **Morph speed** slider (0.25–12°/s);
- keeps manual angle scrubbing, scale, depth, glow, and hue controls;
- collapses the controls when idle;
- batches recursion into one canvas path per depth, which is substantially faster on iOS Safari than stroking every branch individually;
- caps rendering density on high-DPI iPhones/iPads to reduce heat and Safari memory pressure.

## Publish on GitHub Pages

1. Put `index.html`, `style.css`, and `app.js` in the root of your GitHub repository.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**.
4. Select your default branch and `/ (root)`.
5. Save.

No packages, framework, or build step are required.
