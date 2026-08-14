# Recursive Neon

A dependency-free generative art app recreated from the supplied reference video. It is designed to run directly on GitHub Pages.

## Run locally

Open `index.html` in a browser. For the most consistent behavior, serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `style.css`, and `app.js` to the repository root.
3. In **Settings → Pages**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)`, then save.
5. GitHub will provide the public Pages URL.

## Interaction

- Controls auto-hide after 2.5 seconds of inactivity.
- Move the pointer, tap, or press any key to restore them.
- Press `C` to toggle the control panel manually.
- Three visual modes are included: Recursive tree, Hex recursion, and Infinite weave.
- Use Randomize for quick variations.

No frameworks, packages, build tools, or external assets are required.
