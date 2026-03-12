/* ============================================================
   CRISPY BARNACLE — HUD.js
   In-game overlay. Displays score, level, lines cleared,
   next piece preview, and game state overlays
   (pause screen, game over screen).
   ============================================================ */

export class HUD {
  constructor({ audio, onMenu, onRestart }) {
    this.audio     = audio;
    this.onMenu    = onMenu;
    this.onRestart = onRestart;

    this.uiRoot    = null;
    this.el        = null;
    this.visible   = false;

    // Cached DOM refs
    this.els = {
      score:          null,
      scoreDelta:     null,
      level:          null,
      lines:          null,
      nextCanvas:     null,
      pauseOverlay:   null,
      gameOverOverlay: null,
      gameOverScore:  null,
      gameOverLevel:  null,
      gameOverLines:  null,
    };

    // Score animation state
    this.displayedScore  = 0;
    this.targetScore     = 0;
    this.scoreAnimTimer  = 0;
  }

  // ── Initialize ────────────────────────────────────────────
  init() {
    this.uiRoot = document.getElementById('ui-root');
    this._buildDOM();
    this._cacheRefs();
    this._injectStyles();
    console.log('[HUD] Initialized.');
  }

  // ── Build DOM ─────────────────────────────────────────────
  _buildDOM() {
    this.el = document.createElement('div');
    this.el.id = 'hud-root';
    this.el.style.cssText = `
      position: absolute;
      inset: 0;
      display: none;
      pointer-events: none;
      z-index: 15;
    `;

    this.el.innerHTML = `

      <!-- ── Left panel: Score / Level / Lines ── -->
      <div class="hud-panel" id="hud-left">

        <div class="hud-block">
          <div class="hud-label">SCORE</div>
          <div class="hud-value" id="hud-score">0</div>
          <div class="hud-score-delta" id="hud-score-delta"></div>
        </div>

        <div class="hud-block">
          <div class="hud-label">LEVEL</div>
          <div class="hud-value" id="hud-level">1</div>
        </div>

        <div class="hud-block">
          <div class="hud-label">LINES</div>
          <div class="hud-value" id="hud-lines">0</div>
        </div>

      </div>

      <!-- ── Right panel: Next piece ── -->
      <div class="hud-panel" id="hud-right">
        <div class="hud-block">
          <div class="hud-label">NEXT</div>
          <canvas id="hud-next-canvas" width="120" height="120"></canvas>
        </div>

        <div class="hud-block" id="hud-controls-block">
          <div class="hud-label">CONTROLS</div>
          <div class="hud-controls">
            <div class="ctrl-row"><span class="ctrl-key">←→</span><span class="ctrl-desc">MOVE</span></div>
            <div class="ctrl-row"><span class="ctrl-key">↑</span><span class="ctrl-desc">ROTATE</span></div>
            <div class="ctrl-row"><span class="ctrl-key">↓</span><span class="ctrl-desc">SOFT DROP</span></div>
            <div class="ctrl-row"><span class="ctrl-key">SPC</span><span class="ctrl-desc">HARD DROP</span></div>
            <div class="ctrl-row"><span class="ctrl-key">ESC</span><span class="ctrl-desc">PAUSE</span></div>
          </div>
        </div>
      </div>

      <!-- ── Pause overlay ── -->
      <div id="hud-pause-overlay" aria-hidden="true">
        <div class="overlay-box">
          <div class="overlay-eyebrow">GAME PAUSED</div>
          <h2 class="overlay-title">DIMENSIONS<br/>SUSPENDED</h2>
          <div class="overlay-hint">PRESS ESC TO RESUME</div>
          <div class="overlay-actions">
            <button class="hud-btn" id="btn-resume"
                    pointer-events="auto">
              <span class="btn-icon">▶</span>
              <span class="btn-label">RESUME</span>
            </button>
            <button class="hud-btn" id="btn-pause-menu"
                    pointer-events="auto">
              <span class="btn-icon">⌂</span>
              <span class="btn-label">MAIN MENU</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Game over overlay ── -->
      <div id="hud-gameover-overlay" aria-hidden="true">
        <div class="overlay-box">
          <div class="overlay-eyebrow">DIMENSION COLLAPSED</div>
          <h2 class="overlay-title">GAME<br/>OVER</h2>

          <div class="gameover-stats">
            <div class="go-stat-row">
              <span class="go-stat-label">SCORE</span>
              <span class="go-stat-value" id="go-final-score">0</span>
            </div>
            <div class="go-stat-row">
              <span class="go-stat-label">LEVEL</span>
              <span class="go-stat-value" id="go-final-level">0</span>
            </div>
            <div class="go-stat-row">
              <span class="go-stat-label">LINES</span>
              <span class="go-stat-value" id="go-final-lines">0</span>
            </div>
          </div>

          <div class="overlay-actions">
            <button class="hud-btn" id="btn-restart"
                    pointer-events="auto">
              <span class="btn-icon">↺</span>
              <span class="btn-label">PLAY AGAIN</span>
            </button>
            <button class="hud-btn" id="btn-gameover-menu"
                    pointer-events="auto">
              <span class="btn-icon">⌂</span>
              <span class="btn-label">MAIN MENU</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.uiRoot.appendChild(this.el);
  }

  // ── Cache DOM refs ────────────────────────────────────────
  _cacheRefs() {
    const q = (id) => this.el.querySelector(id);

    this.els.score            = q('#hud-score');
    this.els.scoreDelta       = q('#hud-score-delta');
    this.els.level            = q('#hud-level');
    this.els.lines            = q('#hud-lines');
    this.els.nextCanvas       = q('#hud-next-canvas');
    this.els.pauseOverlay     = q('#hud-pause-overlay');
    this.els.gameOverOverlay  = q('#hud-gameover-overlay');
    this.els.gameOverScore    = q('#go-final-score');
    this.els.gameOverLevel    = q('#go-final-level');
    this.els.gameOverLines    = q('#go-final-lines');

    // Wire overlay buttons
    q('#btn-resume').addEventListener('click', () => {
      this.audio.playMenuClick();
      this.hidePause();
      // Signal main.js via custom event
      window.dispatchEvent(new CustomEvent('crispy:resume'));
    });

    q('#btn-pause-menu').addEventListener('click', () => {
      this.audio.playMenuClick();
      this.hidePause();
      this.onMenu();
    });

    q('#btn-restart').addEventListener('click', () => {
      this.audio.playMenuClick();
      this.hideGameOver();
      this.onRestart();
    });

    q('#btn-gameover-menu').addEventListener('click', () => {
      this.audio.playMenuClick();
      this.hideGameOver();
      this.onMenu();
    });
  }

  // ── Inject styles ─────────────────────────────────────────
  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `

      /* ── HUD panels ── */
      .hud-panel {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 24px;
        pointer-events: none;
      }

      #hud-left  { left: 32px;  }
      #hud-right { right: 32px; }

      /* ── HUD block ── */
      .hud-block {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: 14px;
        padding: 16px 20px;
        min-width: 110px;
      }

      .hud-label {
        font-size: 9px;
        letter-spacing: 4px;
        color: rgba(255, 255, 255, 0.35);
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .hud-value {
        font-size: 28px;
        font-weight: 100;
        letter-spacing: 2px;
        color: #ffffff;
        text-shadow: 0 0 20px rgba(100, 160, 255, 0.5);
        transition: color 0.2s ease;
      }

      /* ── Score delta (floating +points) ── */
      .hud-score-delta {
        font-size: 13px;
        font-weight: 300;
        letter-spacing: 2px;
        color: rgba(100, 220, 160, 0.9);
        height: 20px;
        transition: opacity 0.3s ease;
      }

      /* ── Next piece canvas ── */
      #hud-next-canvas {
        display: block;
        width: 100px;
        height: 100px;
        margin-top: 8px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.3);
      }

      /* ── Controls ── */
      .hud-controls {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 8px;
      }

      .ctrl-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .ctrl-key {
        font-size: 9px;
        letter-spacing: 1px;
        color: rgba(100, 160, 255, 0.8);
        background: rgba(100, 160, 255, 0.08);
        border: 1px solid rgba(100, 160, 255, 0.2);
        border-radius: 4px;
        padding: 2px 6px;
        min-width: 36px;
        text-align: center;
      }

      .ctrl-desc {
        font-size: 9px;
        letter-spacing: 2px;
        color: rgba(255, 255, 255, 0.3);
        text-transform: uppercase;
      }

      /* ── Overlays ── */
      #hud-pause-overlay,
      #hud-gameover-overlay {
        position: absolute;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        pointer-events: auto;
        z-index: 20;
      }

      #hud-pause-overlay.visible,
      #hud-gameover-overlay.visible {
        display: flex;
      }

      .overlay-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border-radius: 24px;
        padding: 48px 56px;
        text-align: center;
        animation: overlayIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes overlayIn {
        from { opacity: 0; transform: scale(0.95) translateY(10px); }
        to   { opacity: 1; transform: scale(1.0)  translateY(0px);  }
      }

      .overlay-eyebrow {
        font-size: 10px;
        letter-spacing: 5px;
        color: rgba(150, 180, 255, 0.6);
        text-transform: uppercase;
      }

      .overlay-title {
        font-size: clamp(36px, 6vw, 64px);
        font-weight: 100;
        letter-spacing: 8px;
        color: #ffffff;
        margin: 0;
        line-height: 1.1;
        text-shadow:
          0 0 40px rgba(100, 160, 255, 0.5),
          0 0 80px rgba(80, 120, 255, 0.2);
      }

      .overlay-hint {
        font-size: 10px;
        letter-spacing: 4px;
        color: rgba(255, 255, 255, 0.25);
        text-transform: uppercase;
      }

      .overlay-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 220px;
        margin-top: 8px;
      }

      /* ── HUD buttons (pause/gameover overlays) ── */
      .hud-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 14px 28px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(16px);
        border-radius: 10px;
        color: rgba(255, 255, 255, 0.85);
        font-size: 12px;
        font-weight: 300;
        letter-spacing: 3px;
        text-transform: uppercase;
        cursor: pointer;
        transition:
          background 0.2s ease,
          border-color 0.2s ease,
          transform 0.15s ease;
        outline: none;
      }

      .hud-btn:hover {
        background: rgba(100, 160, 255, 0.12);
        border-color: rgba(100, 160, 255, 0.4);
        transform: translateY(-2px);
        color: #ffffff;
      }

      .hud-btn:active {
        transform: scale(0.98);
      }

      /* ── Game over stats ── */
      .gameover-stats {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 12px;
        padding: 20px 28px;
      }

      .go-stat-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .go-stat-label {
        font-size: 10px;
        letter-spacing: 3px;
        color: rgba(255, 255, 255, 0.35);
        text-transform: uppercase;
      }

      .go-stat-value {
        font-size: 20px;
        font-weight: 100;
        letter-spacing: 2px;
        color: #ffffff;
        text-shadow: 0 0 16px rgba(100, 160, 255, 0.4);
      }
    `;
    document.head.appendChild(style);
  }

  // ── Update — called every frame ───────────────────────────
  update(delta, gameState) {
    if (!this.visible) return;

    // Animate score counting up
    if (this.displayedScore < this.targetScore) {
      const step = Math.ceil((this.targetScore - this.displayedScore) * 0.15);
      this.displayedScore = Math.min(
        this.displayedScore + step,
        this.targetScore
      );
      this.els.score.textContent = this.displayedScore.toLocaleString();
    }

    // Fade out score delta
    this.scoreAnimTimer = Math.max(0, this.scoreAnimTimer - delta);
    if (this.scoreAnimTimer <= 0) {
      this.els.scoreDelta.style.opacity = '0';
    }
  }

  // ── Set score ─────────────────────────────────────────────
  setScore(score, delta = 0) {
    this.targetScore = score;

    if (delta > 0) {
      this.els.scoreDelta.textContent  = `+${delta}`;
      this.els.scoreDelta.style.opacity = '1';
      this.scoreAnimTimer              = 1.2;
    }
  }

  // ── Set level ─────────────────────────────────────────────
  setLevel(level) {
    this.els.level.textContent = level;

    // Flash the level value
    this.els.level.style.color = 'rgba(100, 220, 160, 1.0)';
    setTimeout(() => {
      this.els.level.style.color = '#ffffff';
    }, 600);
  }

  // ── Set lines ─────────────────────────────────────────────
  setLines(lines) {
    this.els.lines.textContent = lines;
  }

  // ── Draw next piece preview ───────────────────────────────
  drawNextPiece(piece) {
    const canvas  = this.els.nextCanvas;
    const ctx     = canvas.getContext('2d');
    const size    = 20;
    const padding = 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!piece) return;

    const shape  = piece.shape;
    const color  = piece.color;
    const cols   = shape[0].length;
    const rows   = shape.length;

    const offsetX = (canvas.width  - cols * size) / 2;
    const offsetY = (canvas.height - rows * size) / 2;

    shape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!cell) return;

        const x = offsetX + c * size + padding * 0.5;
        const y = offsetY + r * size + padding * 0.5;
        const w = size - 2;
        const h = size - 2;

        // Block fill
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);

        // Glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur  = 12;
        ctx.fillRect(x, y, w, h);
        ctx.shadowBlur  = 0;

        // Highlight edge
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth   = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      });
    });
  }

  // ── Show / hide ───────────────────────────────────────────
  show() {
    this.el.style.display = 'block';
    this.visible          = true;
  }

  hide() {
    this.el.style.display = 'none';
    this.visible          = false;
    this.hidePause();
    this.hideGameOver();
  }

  // ── Pause overlay ─────────────────────────────────────────
  showPause() {
    const el = this.els.pauseOverlay;
    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
  }

  hidePause() {
    const el = this.els.pauseOverlay;
    el.classList.remove('visible');
    el.setAttribute('aria-hidden', 'true');
  }

  // ── Game over overlay ─────────────────────────────────────
  showGameOver(score, level, lines) {
    this.els.gameOverScore.textContent = score.toLocaleString();
    this.els.gameOverLevel.textContent = level;
    this.els.gameOverLines.textContent = lines;

    const el = this.els.gameOverOverlay;
    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
  }

  hideGameOver() {
    const el = this.els.gameOverOverlay;
    el.classList.remove('visible');
    el.setAttribute('aria-hidden', 'true');
  }

  // ── Reset for new game ────────────────────────────────────
  reset() {
    this.displayedScore = 0;
    this.targetScore    = 0;
    this.scoreAnimTimer = 0;

    this.els.score.textContent      = '0';
    this.els.scoreDelta.textContent = '';
    this.els.level.textContent      = '1';
    this.els.lines.textContent      = '0';

    const ctx = this.els.nextCanvas.getContext('2d');
    ctx.clearRect(0, 0, 120, 120);

    this.hidePause();
    this.hideGameOver();
  }

  // ── Handle resize ─────────────────────────────────────────
  handleResize() {
    // Panels reflow via CSS — nothing to recalculate manually
  }
}