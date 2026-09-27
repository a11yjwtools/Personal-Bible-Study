# Estudio Personal

A personal Bible-study notebook: daily-text journals by month, event and talk notes, AI proofreading, scripture insertion, and review games (Saber y Ganar, Rosco A–Z, Kings & Prophets memorizer).

It runs **entirely in the browser on GitHub Pages**. No server is needed.

- **Works offline.** Each device keeps a full copy of your notes in the browser (IndexedDB). You can write anywhere, with or without internet.
- **Syncs through GitHub.** Changes are saved as commits in a **private** repository (`estudio-notas`), one JSON file per note, so you get the complete history for free.
- **No lost edits.** If the same note is edited on two devices, the other version is kept as a "(conflicto)" copy. Monthly documents merge day by day.
- **AI on your device.** Google Gemini is called directly from the browser with your key, or the built-in local engine is used.
- **Installable (PWA).** Clean light/dark interface that works on phone, tablet and desktop.

**Set-up guide:** [docs/GITHUB-SETUP.md](docs/GITHUB-SETUP.md)

## How it's built

```
public/                 The app (published to GitHub Pages)
  js/offline.js         Local database, full /api emulation, GitHub sync engine
  js/engine.js          AI + scripture services bundled for the browser (generated)
  js/notes.js …         Notebook and game UI
  sw.js                 Service worker: the app opens without internet
services/               Original Node services (source for engine.js; also used by server.js)
tools/build-engine.js   Regenerates public/js/engine.js from services/
server.js               Optional: run locally with `npm install && npm start`
.github/workflows/pages.yml   Builds and publishes public/ to GitHub Pages
```

### Notes repository layout

```
estudio-notas/
  notes/<note-id>.json        one file per note
  questions/<note-id>.json    quiz questions for that note
  meta.json                   folders, years, game settings, history
```

### Sync algorithm (per sync)

1. Read the branch head and, if it moved, the tree (`git/trees?recursive=1`).
2. Download only the blobs whose SHA changed and apply them. If a local note is also pending, resolve it: month documents merge, other notes keep the newest version and save a conflict copy.
3. Write every pending change as **one commit** (`git/trees` → `git/commits` → fast-forward `git/refs`). If another device pushed in between, repeat.
