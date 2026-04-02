# CRISPY BARNACLE

A two-project creative portfolio living in one repo.

**Project 1 — Crispy Barnacle Tetris**
A psychedelic WebGPU Tetris game with real-time fractal raymarching,
audio-reactive visuals, and synthesized sound effects. Built with vanilla
JavaScript, WebGPU, WGSL shaders, and the Web Audio API.
No frameworks. No dependencies. No build step.

**Project 2 — UX LAB**
A behavioral analytics platform built from scratch. Tracks mouse movements,
clicks, and scroll depth on a live demo site. Renders heatmap overlays using
the HTML5 Canvas API and replays full user sessions using rrweb — mirroring
how commercial tools like Hotjar and FullStory work under the hood.
Backend powered by FastAPI and SQLite.

Both projects are connected. The Tetris home screen contains a TEST button
that launches UX LAB. You can return to the game at any time from within
the UX LAB interface.

---

## REQUIREMENTS

**For the Tetris game:**
- Google Chrome 113+ or Microsoft Edge 113+
- WebGPU must be enabled (it is by default in current versions)
- A local development server (browsers block ES modules opened as files)

**For UX LAB:**
- Python 3.8+
- pip

---

## QUICK START — FULL SETUP

This repo requires two servers running simultaneously.
Open two separate terminals in VS Code before you begin.

---

### TERMINAL 1 — File Server (serves all HTML to the browser)

Start this from the **project root**:
```bash
python -m http.server 8080
```

Or using Node:
```bash
npx serve .
```

Or using VS Code Live Server:
Right-click `index.html` → Open with Live Server

Then open your browser to:
```
http://localhost:8080
```

---

### TERMINAL 2 — UX LAB Backend (FastAPI + SQLite)

**First time only — install dependencies:**
```bash
pip install -r ux-lab/requirements.txt --break-system-packages
```

**Start the backend** (run this from the project root):
```bash
cd ux-lab/backend && python main.py
```

You should see:
```
╔══════════════════════════════════════╗
║       UX LAB — Backend Online        ║
║   http://localhost:8000              ║
║   /docs  →  API Explorer             ║
╚══════════════════════════════════════╝
```

The backend runs on port 8000. Keep this terminal open the entire session.

---

### EVERY TIME YOU WORK ON THIS PROJECT

| Step | Terminal | Command |
|------|----------|---------|
| 1 | Terminal 1 (project root) | `python -m http.server 8080` |
| 2 | Terminal 2 (project root) | `cd ux-lab/backend && python main.py` |
| 3 | Browser | `http://localhost:8080` |

---

## HOW TO USE UX LAB

1. Open `http://localhost:8080` in Chrome or Edge
2. On the Tetris home screen click the **TEST** button
3. You are now on the UX LAB hub page
4. Click **Demo Site** — browse all three Justin UX LAB pages naturally
5. Click around, scroll, fill out the contact form
6. Return to the UX LAB hub and click **Dashboard**
7. Select a page from the dropdown and click **Render Heatmap**
8. Switch to **Session Replay** tab to watch your session played back

---

## API EXPLORER

While the backend is running, visit:
```
http://localhost:8000/docs
```

This is FastAPI's auto-generated interactive API explorer. You can fire
live requests against every endpoint directly from the browser.

---

## PROJECT STRUCTURE
```
crispy-barnacle/
├── index.html                    # Tetris home screen (contains TEST button)
├── assets/
│   └── music/                    # Drop crispy-barnacle.mp3 here
├── src/                          # All Tetris source code
│   ├── main.js
│   ├── audio/
│   │   ├── AudioManager.js
│   │   └── SoundEffects.js
│   ├── game/
│   │   ├── Game.js
│   │   ├── Board.js
│   │   ├── Pieces.js
│   │   └── GameLoop.js
│   ├── gpu/
│   │   ├── GPUContext.js
│   │   ├── pipelines/
│   │   │   ├── RaymarchPipeline.js
│   │   │   └── PostProcessPipeline.js
│   │   └── shaders/
│   │       ├── raymarch.wgsl
│   │       ├── postprocess.wgsl
│   │       └── tetris.wgsl
│   ├── menu/
│   │   ├── Menu.js
│   │   └── HUD.js
│   └── utils/
│       └── utils.js
├── wasm/                         # Reserved for future Rust/WASM physics
└── ux-lab/                       # UX LAB behavioral analytics platform
    ├── index.html                # UX LAB hub (linked from TEST button)
    ├── requirements.txt          # Python dependencies
    ├── backend/
    │   ├── main.py               # FastAPI server — all API routes
    │   ├── database.py           # SQLite connection and queries
    │   └── models.py             # Pydantic request/response models
    ├── tracker/
    │   └── tracker.js            # Tracking snippet injected into demo site
    ├── demo-site/                # Justin UX LAB — the site being analyzed
    │   ├── index.html            # Home page
    │   ├── about.html            # About page
    │   ├── contact.html          # Contact page (form + FAQ)
    │   ├── css/
    │   │   └── style.css
    │   └── js/
    │       └── main.js
    ├── dashboard/                # Analytics dashboard
    │   ├── index.html
    │   ├── css/
    │   │   └── dashboard.css
    │   └── js/
    │       ├── heatmap.js        # Canvas heatmap renderer
    │       ├── replay.js         # rrweb session replay controller
    │       └── app.js            # Main dashboard controller
    └── data/
        └── uxlab.db              # SQLite database (auto-created on first run)
```

---

## TETRIS CONTROLS

| Key | Action |
|-----|--------|
| ← → or A D | Move |
| ↑ or W | Rotate clockwise |
| Z | Rotate counter-clockwise |
| ↓ or S | Soft drop |
| Space | Hard drop |
| Escape | Pause |

---

## DASHBOARD KEYBOARD SHORTCUTS

| Key | Action |
|-----|--------|
| R | Render heatmap |
| Space | Play / Pause replay |
| 1 | Switch to Heatmap tab |
| 2 | Switch to Session Replay tab |

---

## TECH STACK

### Tetris
| Layer | Technology |
|-------|-----------|
| Rendering | WebGPU + WGSL |
| Game logic | Vanilla JavaScript (ES Modules) |
| Audio | Web Audio API |
| UI | HTML + CSS (no framework) |
| Future physics | Rust + WASM (seam is ready) |

### UX LAB
| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python) |
| Database | SQLite |
| Tracking | Vanilla JavaScript (IIFE) |
| Session recording | rrweb |
| Heatmap rendering | HTML5 Canvas API |
| Dashboard UI | HTML + CSS + Vanilla JS |

---

## NOTES

- Music is gitignored by default — use Git LFS if you want to track it
- Sound effects are fully synthesized in code, no audio files needed
- WebGPU is not supported in Firefox or Safari at this time
- The UX LAB database (`uxlab.db`) is gitignored — each clone starts fresh
- Both servers must be running simultaneously to use the full project
- The tracker fails silently if the backend is offline — it never alerts users