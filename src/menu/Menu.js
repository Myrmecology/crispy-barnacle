/* ============================================================
   CRISPY BARNACLE — Menu.js
   The main menu. Owns the UI layer, button interactions,
   glass morphism HUD, and coordinates the GPU background.
   ============================================================ */

import { RaymarchPipeline } from '../gpu/pipelines/RaymarchPipeline.js';
import { PostProcessPipeline } from '../gpu/pipelines/PostProcessPipeline.js';

export class Menu {
  constructor({ gpuContext, audio, onPlay, onQuit }) {
    this.gpu       = gpuContext;
    this.audio     = audio;
    this.onPlay    = onPlay;
    this.onQuit    = onQuit;

    this.raymarch  = null;
    this.post      = null;
    this.uiRoot    = null;
    this.visible   = false;
    this.time      = 0;
    this.warp      = 0;

    // Menu DOM elements
    this.el        = null;
    this.buttons   = [];
  }

  // ── Initialize ────────────────────────────────────────────
  async init() {
    this.uiRoot   = document.getElementById('ui-root');

    // Boot GPU pipelines
    this.raymarch = new RaymarchPipeline(this.gpu);
    this.post     = new PostProcessPipeline(this.gpu);

    await this.raymarch.init();
    await this.post.init();

    this._buildDOM();
    this._bindEvents();

    console.log('[Menu] Initialized.');
  }

  // ── Build DOM ─────────────────────────────────────────────
  _buildDOM() {
    this.el = document.createElement('div');
    this.el.id = 'menu-root';
    this.el.style.cssText = `
      position: absolute;
      inset: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 10;
    `;

    this.el.innerHTML = `
      <div id="menu-container">

        <!-- Title block -->
        <div id="menu-title-block">
          <div id="menu-eyebrow">MULTIVERSE EDITION</div>
          <h1 id="menu-title">CRISPY<br/>BARNACLE</h1>
          <div id="menu-subtitle">A JOURNEY THROUGH FRACTURED DIMENSIONS</div>
        </div>

        <!-- Buttons -->
        <nav id="menu-nav" role="navigation" aria-label="Main Menu">
          <button class="menu-btn" id="btn-play"     data-action="play">
            <span class="btn-icon">▶</span>
            <span class="btn-label">PLAY</span>
          </button>
          <button class="menu-btn" id="btn-settings" data-action="settings">
            <span class="btn-icon">⚙</span>
            <span class="btn-label">SETTINGS</span>
          </button>
          <button class="menu-btn" id="btn-quit"     data-action="quit">
            <span class="btn-icon">✕</span>
            <span class="btn-label">QUIT</span>
          </button>
        </nav>

        <!-- Footer -->
        <div id="menu-footer">
          <span>WebGPU • Web Audio API • WGSL</span>
          <span id="menu-version">v1.0.0</span>
        </div>

      </div>

      <!-- Settings panel (hidden by default) -->
      <div id="settings-panel" aria-hidden="true">
        <h2 class="settings-title">SETTINGS</h2>

        <div class="settings-row">
          <label class="settings-label">MASTER VOL</label>
          <input type="range" id="vol-master" min="0" max="1"
                 step="0.01" value="1.0" class="settings-slider"/>
        </div>

        <div class="settings-row">
          <label class="settings-label">MUSIC VOL</label>
          <input type="range" id="vol-music" min="0" max="1"
                 step="0.01" value="0.8" class="settings-slider"/>
        </div>

        <div class="settings-row">
          <label class="settings-label">SFX VOL</label>
          <input type="range" id="vol-sfx" min="0" max="1"
                 step="0.01" value="0.9" class="settings-slider"/>
        </div>

        <button class="menu-btn" id="btn-close-settings">
          <span class="btn-icon">←</span>
          <span class="btn-label">BACK</span>
        </button>
      </div>
    `;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = this._css();
    document.head.appendChild(style);

    this.uiRoot.appendChild(this.el);

    // Cache button refs
    this.buttons = Array.from(this.el.querySelectorAll('.menu-btn'));
  }

  // ── CSS ───────────────────────────────────────────────────
  _css() {
    return `
      /* ── Menu root ── */
      #menu-root {
        font-family: "Inter", "Segoe UI", sans-serif;
      }

      /* ── Outer container ── */
      #menu-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 48px;
        pointer-events: auto;
      }

      /* ── Title block ── */
      #menu-title-block {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }

      #menu-eyebrow {
        font-size: 11px;
        letter-spacing: 6px;
        color: rgba(150, 180, 255, 0.7);
        text-transform: uppercase;
      }

      #menu-title {
        font-size: clamp(52px, 10vw, 110px);
        font-weight: 100;
        letter-spacing: 12px;
        line-height: 1.0;
        text-align: center;
        color: #ffffff;
        text-shadow:
          0 0 40px rgba(100, 160, 255, 0.6),
          0 0 80px rgba(80, 120, 255, 0.3),
          0 0 120px rgba(60, 100, 255, 0.15);
        margin: 0;
        animation: titlePulse 4s ease-in-out infinite;
      }

      @keyframes titlePulse {
        0%, 100% { text-shadow:
          0 0 40px rgba(100, 160, 255, 0.6),
          0 0 80px rgba(80, 120, 255, 0.3); }
        50% { text-shadow:
          0 0 60px rgba(140, 180, 255, 0.9),
          0 0 120px rgba(100, 150, 255, 0.5),
          0 0 200px rgba(80, 120, 255, 0.2); }
      }

      #menu-subtitle {
        font-size: 11px;
        letter-spacing: 4px;
        color: rgba(255, 255, 255, 0.35);
        text-transform: uppercase;
      }

      /* ── Nav ── */
      #menu-nav {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        width: 280px;
      }

      /* ── Buttons ── */
      .menu-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 16px 32px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 12px;
        color: rgba(255, 255, 255, 0.85);
        font-size: 13px;
        font-weight: 300;
        letter-spacing: 4px;
        text-transform: uppercase;
        cursor: pointer;
        transition:
          background 0.2s ease,
          border-color 0.2s ease,
          transform 0.15s ease,
          box-shadow 0.2s ease;
        outline: none;
        pointer-events: auto;
      }

      .menu-btn:hover {
        background: rgba(100, 160, 255, 0.12);
        border-color: rgba(100, 160, 255, 0.4);
        transform: translateY(-2px);
        box-shadow:
          0 8px 32px rgba(80, 130, 255, 0.2),
          0 0 0 1px rgba(100, 160, 255, 0.1);
        color: #ffffff;
      }

      .menu-btn:active {
        transform: translateY(0px) scale(0.98);
      }

      .menu-btn:focus-visible {
        border-color: rgba(100, 160, 255, 0.8);
        box-shadow: 0 0 0 2px rgba(100, 160, 255, 0.4);
      }

      .btn-icon {
        font-size: 14px;
        opacity: 0.7;
      }

      .btn-label {
        flex: 1;
        text-align: center;
      }

      /* ── Footer ── */
      #menu-footer {
        display: flex;
        gap: 24px;
        font-size: 10px;
        letter-spacing: 2px;
        color: rgba(255, 255, 255, 0.2);
        text-transform: uppercase;
      }

      /* ── Settings panel ── */
      #settings-panel {
        display: none;
        flex-direction: column;
        align-items: center;
        gap: 24px;
        width: 320px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border-radius: 20px;
        padding: 40px 36px;
        pointer-events: auto;
      }

      #settings-panel.visible {
        display: flex;
      }

      .settings-title {
        font-size: 13px;
        font-weight: 300;
        letter-spacing: 6px;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
      }

      .settings-row {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .settings-label {
        font-size: 10px;
        letter-spacing: 3px;
        color: rgba(255, 255, 255, 0.4);
        text-transform: uppercase;
      }

      .settings-slider {
        width: 100%;
        appearance: none;
        -webkit-appearance: none;
        height: 2px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 2px;
        outline: none;
        cursor: pointer;
      }

      .settings-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: rgba(100, 160, 255, 0.9);
        cursor: pointer;
        box-shadow: 0 0 8px rgba(100, 160, 255, 0.6);
      }

      /* ── Entry animation ── */
      @keyframes menuFadeIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0px);
        }
      }

      .menu-animate-in {
        animation: menuFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
    `;
  }

  // ── Bind events ───────────────────────────────────────────
  _bindEvents() {
    // Button hover sound
    this.buttons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        this.audio.playMenuHover();
      });
    });

    // Play
    this.el.querySelector('#btn-play').addEventListener('click', () => {
      this.audio.playMenuClick();
      this.onPlay();
    });

    // Settings
    this.el.querySelector('#btn-settings').addEventListener('click', () => {
      this.audio.playMenuClick();
      this._showSettings();
    });

    // Close settings
    this.el.querySelector('#btn-close-settings').addEventListener('click', () => {
      this.audio.playMenuClick();
      this._hideSettings();
    });

    // Quit
    this.el.querySelector('#btn-quit').addEventListener('click', () => {
      this.audio.playMenuClick();
      this.onQuit();
    });

    // Volume sliders
    this.el.querySelector('#vol-master').addEventListener('input', (e) => {
      this.audio.setMasterVolume(parseFloat(e.target.value));
    });

    this.el.querySelector('#vol-music').addEventListener('input', (e) => {
      this.audio.setMusicVolume(parseFloat(e.target.value));
    });

    this.el.querySelector('#vol-sfx').addEventListener('input', (e) => {
      this.audio.setSFXVolume(parseFloat(e.target.value));
    });
  }

  // ── Show settings panel ───────────────────────────────────
  _showSettings() {
    this.el.querySelector('#menu-container').style.display = 'none';
    const panel = this.el.querySelector('#settings-panel');
    panel.classList.add('visible');
    panel.setAttribute('aria-hidden', 'false');
  }

  // ── Hide settings panel ───────────────────────────────────
  _hideSettings() {
    this.el.querySelector('#menu-container').style.display = 'flex';
    const panel = this.el.querySelector('#settings-panel');
    panel.classList.remove('visible');
    panel.setAttribute('aria-hidden', 'true');
  }

  // ── Show menu ─────────────────────────────────────────────
  show() {
    this.el.style.display     = 'flex';
    this.visible              = true;
    this.el.querySelector('#menu-container')
       .classList.add('menu-animate-in');
  }

  // ── Hide menu ─────────────────────────────────────────────
  hide() {
    this.el.style.display = 'none';
    this.visible          = false;
  }

  // ── Update — called every frame ───────────────────────────
  update(delta, timestamp) {
    this.time += delta;
    this.warp  = Math.sin(this.time * 0.15) * 0.5 + 0.5;

    // Update audio analyser
    this.audio.update();

    // Push to pipelines
    this.raymarch.update({
      time:       this.time,
      audioLevel: this.audio.audioLevel,
      warp:       this.warp,
      level:      1,
    });

    this.post.update({
      time:       this.time,
      audioLevel: this.audio.audioLevel,
      warp:       this.warp,
      level:      1,
    });
  }

  // ── Render — called every frame ───────────────────────────
  render() {
    const encoder = this.gpu.device.createCommandEncoder({
      label: 'menu-encoder',
    });

    this.raymarch.render(encoder);
    this.post.render(encoder);

    this.gpu.submit(encoder);
  }

  // ── Handle resize ─────────────────────────────────────────
  handleResize() {
    this.post.handleResize();
    this.raymarch.handleResize();
  }

  // ── Destroy ───────────────────────────────────────────────
  destroy() {
    this.raymarch.destroy();
    this.post.destroy();
    this.el?.remove();
  }
}