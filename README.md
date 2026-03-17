# MILTON Reconstruction

Static browser reconstruction of the MILTON dialogue flow from the `.dlg` dump in `chats/`.

## What it does

- Reads the original `.dlg` files directly in the browser.
- Replays the authored MILTON flow as a state machine instead of using open-ended AI chat.
- Persists flags, transcript, and progress in `localStorage`, so refresh resumes the journey.
- Keeps archive texts contextual by exposing only a small reference library when a branch makes them relevant.

## Files

- [index.html](/Users/sai/Downloads/ComputerTerminalDialogs/index.html)
- [styles.css](/Users/sai/Downloads/ComputerTerminalDialogs/assets/styles.css)
- [engine.js](/Users/sai/Downloads/ComputerTerminalDialogs/assets/engine.js)
- [app.js](/Users/sai/Downloads/ComputerTerminalDialogs/assets/app.js)

## Local preview

Because the app fetches `.dlg` files, open it through a local HTTP server instead of `file://`.

Examples:

```bash
python3 -m http.server
```

Or:

```bash
npx serve .
```

Then open `http://localhost:8000` or the URL reported by your server.

## GitHub Pages

This project is already static. Push the directory contents to a GitHub repository and enable GitHub Pages for the branch/folder you want to publish.

No build step is required.
