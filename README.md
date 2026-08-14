# Recursive Neon — iOS Optimized

A dependency-free generative art app recreated from the supplied reference video and tuned for iPhone/iPad Safari and GitHub Pages.

## iOS improvements

- Handles iPhone notches, Dynamic Island, and Home Indicator using safe-area insets.
- Uses `visualViewport`, `100dvh`, and `-webkit-fill-available` to handle Safari's collapsing address bar.
- Touch targets are at least 44px and sliders have larger iOS-friendly thumbs.
- Canvas gestures do not accidentally scroll or zoom the page.
- Retina rendering is capped intelligently to reduce heat, battery drain, and Safari canvas memory pressure.
- Expensive effects are reduced slightly on iOS and high-density devices can gracefully render near 30fps.
- Controls auto-collapse on touch and remain easy to reveal.
- Landscape layout is compact for iPhone.
- Includes Apple Home Screen web-app metadata.

## Run locally

Serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Upload `index.html`, `style.css`, and `app.js` to the repository root.
3. In **Settings → Pages**, choose **Deploy from a branch**.
4. Select `main` and `/ (root)`, then save.
5. Open the Pages URL in Safari on iPhone/iPad.

### Add to Home Screen on iOS

In Safari, open the Share sheet and choose **Add to Home Screen**. The page is configured to launch with a black translucent status-bar treatment and an app-like full-screen viewport.

## Interaction

- Controls auto-hide after inactivity.
- Tap the artwork or the menu button to restore them.
- Press `C` on a hardware keyboard to toggle the panel.
- Three visual modes: Recursive tree, Hex recursion, and Infinite weave.
- Use Randomize for quick variations.

No frameworks, packages, build tools, or external assets are required.
