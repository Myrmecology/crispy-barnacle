# CRISPY BARNACLE

A psychedelic WebGPU Tetris game with real-time fractal raymarching,
audio-reactive visuals, and synthesized sound effects.

Built with vanilla JavaScript, WebGPU, WGSL shaders, and the Web Audio API.
No frameworks. No dependencies. No build step.

---

## REQUIREMENTS

- Google Chrome 113+ or Microsoft Edge 113+
- WebGPU must be enabled (it is by default in current versions)
- A local development server (browsers block ES modules opened as files)

---

## QUICK START

**1. Clone the repo**
```bash
git clone https://github.com/Myrmecology/crispy-barnacle.git
cd crispy-barnacle
```

**2. Add your music file**

Drop your music file into `assets/music/` and name it:
```
crispy-barnacle.mp3
```

**3. Start a local server**

Using Python:
```bash
python -m http.server 8080
```

Using Node (if you have npx):
```bash
npx serve .
```

Using the VS Code Live Server extension:
Right-click `index.html` → Open with Live Server

**4. Open in Chrome or Edge**
```
http://localhost:8080
```

---

## PROJECT STRUCTURE
```
crispy-barnacle/
├── index.html
├── assets/
│   └── music/          # Drop crispy-barnacle.mp3 here
├── src/
│   ├── main.js          # App entry point and state machine
│   ├── audio/
│   │   ├── AudioManager.js    # Music, analyser, volume control
│   │   └── SoundEffects.js    # All SFX synthesized in code
│   ├── game/
│   │   ├── Game.js            # Game coordinator
│   │   ├── Board.js           # Grid, collision, line clearing
│   │   ├── Pieces.js          # Tetrominoes, SRS, bag randomizer
│   │   └── GameLoop.js        # Input, DAS/ARR timing
│   ├── gpu/
│   │   ├── GPUContext.js      # WebGPU device and swap chain
│   │   ├── pipelines/
│   │   │   ├── RaymarchPipeline.js
│   │   │   └── PostProcessPipeline.js
│   │   └── shaders/
│   │       ├── raymarch.wgsl  # Fractal raymarcher
│   │       ├── postprocess.wgsl
│   │       └── tetris.wgsl
│   ├── menu/
│   │   ├── Menu.js            # Main menu UI and GPU background
│   │   └── HUD.js             # In-game overlay
│   └── utils/
│       └── utils.js           # Shared math, easing, color tools
└── wasm/                      # Reserved for future Rust/WASM physics
```

---

## CONTROLS

| Key | Action |
|-----|--------|
| ← → or A D | Move |
| ↑ or W | Rotate clockwise |
| Z | Rotate counter-clockwise |
| ↓ or S | Soft drop |
| Space | Hard drop |
| Escape | Pause |

---

## TECH STACK

| Layer | Technology |
|-------|-----------|
| Rendering | WebGPU + WGSL |
| Game logic | Vanilla JavaScript (ES Modules) |
| Audio | Web Audio API |
| UI | HTML + CSS (no framework) |
| Future physics | Rust + WASM (seam is ready) |

---

## NOTES

- Music is gitignored by default — use Git LFS if you want to track it
- Sound effects are fully synthesized in code, no audio files needed
- WebGPU is not supported in Firefox or Safari at this time