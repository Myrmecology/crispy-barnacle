/* ============================================================
   CRISPY BARNACLE — GameLoop.js
   Handles all keyboard input, DAS/ARR timing,
   and input routing to the Board.
   ============================================================ */

export class GameLoop {
  constructor({ board, audio, onPause }) {
    this.board   = board;
    this.audio   = audio;
    this.onPause = onPause;

    // ── Input state ────────────────────────────────────────
    this.keys = {
      left:      false,
      right:     false,
      down:      false,
      up:        false,
      space:     false,
      escape:    false,
    };

    // ── DAS / ARR ──────────────────────────────────────────
    // DAS — Delayed Auto Shift
    // How long you hold a direction before auto-repeat begins
    this.DAS_DELAY  = 0.150; // 150ms — standard Tetris guideline

    // ARR — Auto Repeat Rate
    // How fast the piece moves while held after DAS kicks in
    this.ARR_RATE   = 0.033; // ~30 moves per second

    this.dasLeft    = 0;
    this.dasRight   = 0;
    this.arrLeft    = 0;
    this.arrRight   = 0;
    this.dasActive  = { left: false, right: false };

    // ── Soft drop repeat ───────────────────────────────────
    this.SOFT_DROP_RATE = 0.05; // 20 rows per second when held
    this.softDropTimer  = 0;

    // ── Input lock ─────────────────────────────────────────
    // Prevents input during line clear animation
    this.inputLocked = false;

    // ── Key handlers (stored for removal on destroy) ───────
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp   = this._handleKeyUp.bind(this);
  }

  // ── Start listening ───────────────────────────────────────
  start() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
    console.log('[GameLoop] Input listening started.');
  }

  // ── Stop listening ────────────────────────────────────────
  stop() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
    this._clearKeys();
    console.log('[GameLoop] Input listening stopped.');
  }

  // ── Clear all key state ───────────────────────────────────
  _clearKeys() {
    Object.keys(this.keys).forEach(k => this.keys[k] = false);
    this.dasLeft   = 0;
    this.dasRight  = 0;
    this.arrLeft   = 0;
    this.arrRight  = 0;
    this.dasActive = { left: false, right: false };
    this.softDropTimer = 0;
  }

  // ── Key down handler ──────────────────────────────────────
  _handleKeyDown(e) {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        if (!this.keys.left) {
          this.keys.left  = true;
          this.dasLeft    = 0;
          this.arrLeft    = 0;
          this.dasActive.left = false;
          // Immediate move on first press
          this._moveLeft();
        }
        break;

      case 'ArrowRight':
      case 'KeyD':
        if (!this.keys.right) {
          this.keys.right  = true;
          this.dasRight    = 0;
          this.arrRight    = 0;
          this.dasActive.right = false;
          // Immediate move on first press
          this._moveRight();
        }
        break;

      case 'ArrowDown':
      case 'KeyS':
        if (!this.keys.down) {
          this.keys.down     = true;
          this.softDropTimer = 0;
          this._softDrop();
        }
        break;

      case 'ArrowUp':
      case 'KeyW':
        if (!this.keys.up) {
          this.keys.up = true;
          this._rotate(1);
        }
        break;

      case 'KeyZ':
        // Counter-clockwise rotate
        this._rotate(-1);
        break;

      case 'KeyX':
        // Clockwise rotate (alternate)
        this._rotate(1);
        break;

      case 'Space':
        if (!this.keys.space) {
          this.keys.space = true;
          this._hardDrop();
        }
        break;

      case 'Escape':
        if (!this.keys.escape) {
          this.keys.escape = true;
          this.onPause();
        }
        break;
    }
  }

  // ── Key up handler ────────────────────────────────────────
  _handleKeyUp(e) {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.keys.left      = false;
        this.dasLeft        = 0;
        this.dasActive.left = false;
        break;

      case 'ArrowRight':
      case 'KeyD':
        this.keys.right      = false;
        this.dasRight        = 0;
        this.dasActive.right = false;
        break;

      case 'ArrowDown':
      case 'KeyS':
        this.keys.down     = false;
        this.softDropTimer = 0;
        break;

      case 'ArrowUp':
      case 'KeyW':
        this.keys.up = false;
        break;

      case 'Space':
        this.keys.space = false;
        break;

      case 'Escape':
        this.keys.escape = false;
        break;
    }
  }

  // ── Update — called every frame ───────────────────────────
  update(delta) {
    // Sync input lock with board clearing state
    this.inputLocked = this.board.clearing;
    if (this.inputLocked) return;

    // ── DAS / ARR — Left ────────────────────────────────
    if (this.keys.left) {
      this.dasLeft += delta;

      if (!this.dasActive.left && this.dasLeft >= this.DAS_DELAY) {
        this.dasActive.left = true;
        this.arrLeft        = this.ARR_RATE; // trigger immediately
      }

      if (this.dasActive.left) {
        this.arrLeft += delta;
        while (this.arrLeft >= this.ARR_RATE) {
          this.arrLeft -= this.ARR_RATE;
          this._moveLeft();
        }
      }
    }

    // ── DAS / ARR — Right ───────────────────────────────
    if (this.keys.right) {
      this.dasRight += delta;

      if (!this.dasActive.right && this.dasRight >= this.DAS_DELAY) {
        this.dasActive.right = true;
        this.arrRight        = this.ARR_RATE;
      }

      if (this.dasActive.right) {
        this.arrRight += delta;
        while (this.arrRight >= this.ARR_RATE) {
          this.arrRight -= this.ARR_RATE;
          this._moveRight();
        }
      }
    }

    // ── Soft drop hold ───────────────────────────────────
    if (this.keys.down) {
      this.softDropTimer += delta;
      while (this.softDropTimer >= this.SOFT_DROP_RATE) {
        this.softDropTimer -= this.SOFT_DROP_RATE;
        this._softDrop();
      }
    }
  }

  // ── Actions ───────────────────────────────────────────────
  _moveLeft() {
    if (this.inputLocked) return;
    const moved = this.board.moveLeft();
    if (moved) this.audio.playMove();
  }

  _moveRight() {
    if (this.inputLocked) return;
    const moved = this.board.moveRight();
    if (moved) this.audio.playMove();
  }

  _rotate(dir) {
    if (this.inputLocked) return;
    const rotated = this.board.rotate(dir);
    if (rotated) this.audio.playRotate();
  }

  _softDrop() {
    if (this.inputLocked) return;
    const dropped = this.board.softDrop();
    if (dropped) this.audio.playSoftDrop();
  }

  _hardDrop() {
    if (this.inputLocked) return;
    this.audio.playHardDrop();
    this.board.hardDrop();
  }

  // ── Lock / unlock input externally ────────────────────────
  lock()   { this.inputLocked = true;  }
  unlock() { this.inputLocked = false; }

  // ── Destroy ───────────────────────────────────────────────
  destroy() {
    this.stop();
    console.log('[GameLoop] Destroyed.');
  }
}