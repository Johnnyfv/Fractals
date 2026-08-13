# Fractal Lab — iPhone performance build v3

Static GitHub Pages app. No build tools or dependencies.

## What changed in v3
- Fractal geometry is compiled into a cached `Path2D` only when shape controls change.
- Animation performs no recursion and allocates no geometry per frame.
- Geometry is capped at 2,400 line segments.
- Canvas DPR is capped at 1 for predictable iPhone GPU cost.
- Glow uses a second cached stroke instead of `shadowBlur`.
- Animation is frame-paced at 30 FPS; paused mode performs no redraw work.
- FPS display also shows the current line count.

## Deploy
Upload these files to a GitHub repository and enable GitHub Pages from the repository settings.
