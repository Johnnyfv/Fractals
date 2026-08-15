# Recursive Neon Morph+

A dependency-free GitHub Pages app rebuilt from the supplied videos and screenshots.

## What changed in this rebuild

This version replaces the old **bounce** loop with a **continuously increasing phase**.

That single phase now drives multiple behaviors at once:

- the recursive branch angle continuously advances from **0° to 360°** and wraps cleanly;
- the scale gently drifts around the base value instead of staying perfectly static;
- the color field slowly shifts over time;
- an optional kaleidoscopic background layer adds the circular / ring-like structure inspired by the latest reference montage.

The result is a loop that keeps morphing forward instead of reversing back on itself.

## Controls

- **Morph speed** — degrees per second for the continuously advancing phase
- **Angle phase** — manual scrub of the current morph position
- **Base scale** — center value for the slow scale drift
- **Depth / Glow / Hue spread** — visual tuning
- **Kaleido layer** — toggle the background layer on/off
- **Layer intensity** — strength of that layer
- **Pause morph** — pause / resume
- Controls auto-hide after inactivity and can be restored with touch/mouse movement or **C**.

## iOS notes

The app keeps the existing iPhone/iPad Safari optimizations:

- safe-area support
- dynamic viewport handling
- touch-friendly controls
- prevention of accidental page pan/zoom on the canvas
- capped internal rendering density to reduce heat and memory pressure
- lower-resolution processing for the background layer on iOS

## Publish on GitHub Pages

1. Put `index.html`, `style.css`, and `app.js` in the root of your GitHub repository.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**.
4. Select your default branch and `/ (root)`.
5. Save.

No framework, packages, or build step are required.
