/* ============================================================
   CRISPY BARNACLE — main.js
   Master entry point. Boots the engine, manages state,
   orchestrates all systems.
   ============================================================ */

import { GPUContext } from './gpu/GPUContext.js';
import { AudioManager } from './audio/AudioManager.js';
import { Menu } from './menu/Menu.js';
import { Game } from './game/Game.js';
import { sleep } from './utils/utils.js';

// ── App States ──────────────────────────────────────────────
export const STATE = {
  LOADING:  'LOADING',
  MENU:     'MENU',
  PLAYING:  'PLAYING',
  PAUSED:   'PAUSED',
  GAMEOVER: 'GAMEOVER',
};

// ── Loading UI helpers ───────────────────────────────────────
const loadingScreen = document.getElementById('loading-screen');
const loadingBar    = document.getElementById('loading-bar');
const loadingLabel  = document.getElementById('loading-label');
const noWebGPU      = document.getElementById('no-webgpu');

function setLoadingProgress(pct, label) {
  loadingBar.style.width = `${pct}%`;
  loadingLabel.textContent = label;
}

function hideLoadingScreen() {
  loadingScreen.style.opacity = '0';
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 800);
}

// ── WebGPU support check ─────────────────────────────────────
function checkWebGPUSupport() {
  if (!navigator.gpu) {
    loadingScreen.style.display = 'none';
    noWebGPU.style.display = 'flex';
    return false;
  }
  return true;
}

// ── App Class ────────────────────────────────────────────────
class CrispyBarnacle {
  constructor() {
    this.state       = STATE.LOADING;
    this.gpuContext  = null;
    this.audio       = null;
    this.menu        = null;
    this.game        = null;
    this.lastTime    = 0;
    this.rafId       = null;
  }

  // ── Boot sequence ─────────────────────────────────────────
  async boot() {
    try {

      // Step 1 — WebGPU check
      setLoadingProgress(5, 'CHECKING WEBGPU');
      if (!checkWebGPUSupport()) return;
      await sleep(200);

      // Step 2 — Init GPU
      setLoadingProgress(20, 'INITIALIZING GPU');
      this.gpuContext = new GPUContext();
      await this.gpuContext.init();
      await sleep(200);

      // Step 3 — Init Audio
      setLoadingProgress(45, 'LOADING AUDIO ENGINE');
      this.audio = new AudioManager();
      await this.audio.init();
      await sleep(200);

      // Step 4 — Init Menu
      setLoadingProgress(65, 'BUILDING MENU');
      this.menu = new Menu({
        gpuContext: this.gpuContext,
        audio:      this.audio,
        onPlay:     () => this.startGame(),
        onQuit:     () => this.quit(),
      });
      await this.menu.init();
      await sleep(200);

      // Step 5 — Final prep
      setLoadingProgress(90, 'ENTERING MULTIVERSE');
      await sleep(400);

      // Step 6 — Done
      setLoadingProgress(100, 'READY');
      await sleep(300);

      // Hide loader, show menu
      hideLoadingScreen();
      this.state = STATE.MENU;
      this.menu.show();

      // Start main loop
      this.loop(performance.now());

    } catch (err) {
      console.error('[CrispyBarnacle] Boot failed:', err);
      loadingLabel.textContent = 'ERROR — SEE CONSOLE';
      loadingLabel.style.color = '#ff4444';
    }
  }

  // ── Main render / update loop ────────────────────────────
  loop(timestamp) {
    this.rafId = requestAnimationFrame((ts) => this.loop(ts));

    const delta = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    switch (this.state) {

      case STATE.MENU:
        this.menu.update(delta, timestamp);
        this.menu.render();
        break;

      case STATE.PLAYING:
        this.game.update(delta, timestamp);
        this.game.render();
        break;

      case STATE.PAUSED:
        // Still render, don't update game logic
        this.game.render();
        break;

      case STATE.GAMEOVER:
        this.game.render();
        break;
    }
  }

  // ── Start game ───────────────────────────────────────────
  async startGame() {
    this.menu.hide();

    if (!this.game) {
      this.game = new Game({
        gpuContext: this.gpuContext,
        audio:      this.audio,
        onGameOver: () => this.handleGameOver(),
        onMenu:     () => this.returnToMenu(),
      });
      await this.game.init();
    } else {
      this.game.reset();
    }

    this.audio.startMusic();
    this.state = STATE.PLAYING;
    this.game.start();
  }

  // ── Game over ────────────────────────────────────────────
  handleGameOver() {
    this.state = STATE.GAMEOVER;
    this.audio.stopMusic();
    this.game.showGameOver();
  }

  // ── Return to menu ───────────────────────────────────────
  returnToMenu() {
    this.state = STATE.MENU;
    this.audio.stopMusic();
    this.game.hide();
    this.menu.show();
  }

  // ── Pause toggle ─────────────────────────────────────────
  togglePause() {
    if (this.state === STATE.PLAYING) {
      this.state = STATE.PAUSED;
      this.audio.pauseMusic();
    } else if (this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
      this.audio.resumeMusic();
    }
  }

  // ── Quit ─────────────────────────────────────────────────
  quit() {
    cancelAnimationFrame(this.rafId);
    this.audio.shutdown();
    console.log('[CrispyBarnacle] Shutdown complete.');
  }
}

// ── Helpers ──────────────────────────────────────────────────


// ── Global keyboard handler ───────────────────────────────
function setupGlobalInput(app) {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (app.state === STATE.PLAYING || app.state === STATE.PAUSED) {
        app.togglePause();
      }
    }
  });

  // Prevent arrow keys from scrolling the page
  window.addEventListener('keydown', (e) => {
    const blocked = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '];
    if (blocked.includes(e.key)) e.preventDefault();
  }, { passive: false });
}

// ── Handle window resize ─────────────────────────────────────
function setupResize(app) {
  window.addEventListener('resize', () => {
    if (app.gpuContext) {
      app.gpuContext.handleResize();
    }
    if (app.state === STATE.MENU && app.menu) {
      app.menu.handleResize();
    }
    if ((app.state === STATE.PLAYING || app.state === STATE.PAUSED) && app.game) {
      app.game.handleResize();
    }
  });
}

// ── Launch ───────────────────────────────────────────────────
const app = new CrispyBarnacle();
setupGlobalInput(app);
setupResize(app);
app.boot();