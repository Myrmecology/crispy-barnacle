/* ============================================================
   CRISPY BARNACLE — Board.js
   The game board. Owns the cell grid, collision detection,
   piece locking, line clearing, and ghost piece calculation.
   ============================================================ */

import { Piece, getKickData, calculateScore, linesForLevel, fallSpeed } from './Pieces.js';

// ── Board dimensions ──────────────────────────────────────
export const BOARD_COLS = 10;
export const BOARD_ROWS = 20;
// 2 hidden rows above the visible board for spawn buffer
export const BOARD_BUFFER = 2;
export const BOARD_TOTAL_ROWS = BOARD_ROWS + BOARD_BUFFER;

/* ============================================================
   CELL
   Each cell on the board stores color and glow data
   so the renderer can draw it independently.
   ============================================================ */

export class Cell {
  constructor(color = null, glow = null, pieceId = null) {
    this.color   = color;
    this.glow    = glow;
    this.pieceId = pieceId;

    // Morph animation state — set when piece locks
    this.morphPhase  = Math.random() * Math.PI * 2;
    this.morphSpeed  = 0.4 + Math.random() * 0.3;
    this.glowPulse   = 0;
    this.lockFlash   = 0;    // 0–1, flashes white on lock
    this.clearFlash  = 0;    // 0–1, flashes on line clear
  }

  isEmpty() {
    return this.color === null;
  }

  update(delta) {
    this.morphPhase += delta * this.morphSpeed;
    this.glowPulse   = (Math.sin(this.morphPhase) + 1) * 0.5;
    this.lockFlash   = Math.max(0, this.lockFlash  - delta * 4.0);
    this.clearFlash  = Math.max(0, this.clearFlash - delta * 3.0);
  }
}

/* ============================================================
   BOARD CLASS
   ============================================================ */

export class Board {
  constructor({ onScore, onLevelUp, onGameOver, onLineClear, onTetris }) {
    // Callbacks to Game.js
    this.onScore     = onScore;
    this.onLevelUp   = onLevelUp;
    this.onGameOver  = onGameOver;
    this.onLineClear = onLineClear;
    this.onTetris    = onTetris;

    // Grid — array of rows, each row is array of Cells
    this.grid        = [];

    // Game state
    this.activePiece  = null;
    this.ghostPiece   = null;
    this.score        = 0;
    this.level        = 1;
    this.lines        = 0;
    this.fallTimer    = 0;
    this.lockTimer    = 0;
    this.lockDelay    = 0.5;   // seconds before piece locks after landing
    this.isLocking    = false;
    this.gameOver     = false;
    this.clearing     = false; // true during line clear animation
    this.clearTimer   = 0;
    this.clearRows    = [];    // row indices being cleared
    this.combo        = 0;     // consecutive line clears
  }

  // ── Initialize / reset ────────────────────────────────────
  reset() {
    this.grid = [];
    for (let r = 0; r < BOARD_TOTAL_ROWS; r++) {
      this.grid.push(this._emptyRow());
    }

    this.activePiece  = null;
    this.ghostPiece   = null;
    this.score        = 0;
    this.level        = 1;
    this.lines        = 0;
    this.fallTimer    = 0;
    this.lockTimer    = 0;
    this.isLocking    = false;
    this.gameOver     = false;
    this.clearing     = false;
    this.clearTimer   = 0;
    this.clearRows    = [];
    this.combo        = 0;

    console.log('[Board] Reset.');
  }

  // ── Create an empty row ───────────────────────────────────
  _emptyRow() {
    return Array.from({ length: BOARD_COLS }, () => new Cell());
  }

  // ── Spawn a new piece ─────────────────────────────────────
  spawnPiece(piece) {
    this.activePiece = piece;
    this.isLocking   = false;
    this.lockTimer   = 0;

    // Check for game over — if spawn position is blocked
    if (!this._isValid(piece, piece.x, piece.y)) {
      // Try one row up
      if (!this._isValid(piece, piece.x, piece.y - 1)) {
        this.gameOver = true;
        this.onGameOver();
        return false;
      }
      piece.y -= 1;
    }

    this._updateGhost();
    return true;
  }

  // ── Collision detection ───────────────────────────────────
  _isValid(piece, testX, testY, testRotation = null) {
    const shape = testRotation !== null
      ? piece.shapes[testRotation]
      : piece.getShape();

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;

        const boardX = testX + c;
        const boardY = testY + r;

        // Left / right wall
        if (boardX < 0 || boardX >= BOARD_COLS) return false;
        // Floor
        if (boardY >= BOARD_TOTAL_ROWS) return false;
        // Skip above the grid
        if (boardY < 0) continue;
        // Cell occupied
        if (!this.grid[boardY][boardX].isEmpty()) return false;
      }
    }
    return true;
  }

  // ── Move left / right ─────────────────────────────────────
  moveLeft() {
    if (!this.activePiece || this.gameOver || this.clearing) return false;
    if (this._isValid(this.activePiece, this.activePiece.x - 1, this.activePiece.y)) {
      this.activePiece.move(-1, 0);
      this._resetLockDelay();
      this._updateGhost();
      return true;
    }
    return false;
  }

  moveRight() {
    if (!this.activePiece || this.gameOver || this.clearing) return false;
    if (this._isValid(this.activePiece, this.activePiece.x + 1, this.activePiece.y)) {
      this.activePiece.move(1, 0);
      this._resetLockDelay();
      this._updateGhost();
      return true;
    }
    return false;
  }

  // ── Rotate with SRS kicks ─────────────────────────────────
  rotate(dir = 1) {
    if (!this.activePiece || this.gameOver || this.clearing) return false;

    const piece   = this.activePiece;
    const fromRot = piece.rotation;
    const toRot   = piece.getNextRotation(dir);
    const kicks   = getKickData(piece.id, fromRot, toRot);

    for (const [kx, ky] of kicks) {
      const testX = piece.x + kx;
      const testY = piece.y - ky; // WGSL Y is down, kicks are up-positive

      if (this._isValid(piece, testX, testY, toRot)) {
        piece.applyRotation(toRot, testX, testY);
        this._resetLockDelay();
        this._updateGhost();
        return true;
      }
    }
    return false;
  }

  // ── Soft drop ─────────────────────────────────────────────
  softDrop() {
    if (!this.activePiece || this.gameOver || this.clearing) return false;
    if (this._isValid(this.activePiece, this.activePiece.x, this.activePiece.y + 1)) {
      this.activePiece.move(0, 1);
      this.fallTimer = 0;
      // Soft drop awards 1 point per row
      this._addScore(1, false);
      return true;
    }
    return false;
  }

  // ── Hard drop ─────────────────────────────────────────────
  hardDrop() {
    if (!this.activePiece || this.gameOver || this.clearing) return false;

    let rows = 0;
    while (this._isValid(this.activePiece, this.activePiece.x, this.activePiece.y + 1)) {
      this.activePiece.move(0, 1);
      rows++;
    }

    // Hard drop awards 2 points per row
    this._addScore(rows * 2, false);
    this._lockPiece();
    return true;
  }

  // ── Update — called every frame ───────────────────────────
  update(delta) {
    if (this.gameOver) return;

    // Update all cell animations
    for (let r = 0; r < BOARD_TOTAL_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        this.grid[r][c].update(delta);
      }
    }

    // Update active piece morph animation
    if (this.activePiece) {
      this.activePiece.update(delta);
    }

    // Line clear animation in progress
    if (this.clearing) {
      this.clearTimer -= delta;
      if (this.clearTimer <= 0) {
        this._finalizeClear();
      }
      return;
    }

    if (!this.activePiece) return;

    // Gravity
    this.fallTimer += delta;
    const speed = fallSpeed(this.level);

    if (this.fallTimer >= speed) {
      this.fallTimer = 0;
      if (this._isValid(this.activePiece, this.activePiece.x, this.activePiece.y + 1)) {
        this.activePiece.move(0, 1);
        this.isLocking = false;
        this.lockTimer = 0;
      } else {
        // Piece has landed
        this.isLocking = true;
      }
    }

    // Lock delay
    if (this.isLocking) {
      this.lockTimer += delta;
      if (this.lockTimer >= this.lockDelay) {
        this._lockPiece();
      }
    }
  }

  // ── Lock piece to the board ───────────────────────────────
  _lockPiece() {
    const piece = this.activePiece;
    if (!piece) return;

    const shape = piece.getShape();

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;

        const boardY = piece.y + r;
        const boardX = piece.x + c;

        if (boardY < 0) {
          // Piece locked above visible board — game over
          this.gameOver = true;
          this.onGameOver();
          return;
        }

        const cell        = this.grid[boardY][boardX];
        cell.color        = piece.color;
        cell.glow         = piece.glow;
        cell.pieceId      = piece.id;
        cell.lockFlash    = 1.0;
        cell.morphPhase   = piece.morphPhase;
      }
    }

    this.activePiece = null;
    this.ghostPiece  = null;
    this.isLocking   = false;
    this.lockTimer   = 0;

    // Check for line clears
    this._checkLines();
  }

  // ── Check and begin line clear ────────────────────────────
  _checkLines() {
    const fullRows = [];

    for (let r = 0; r < BOARD_TOTAL_ROWS; r++) {
      if (this.grid[r].every(cell => !cell.isEmpty())) {
        fullRows.push(r);
      }
    }

    if (fullRows.length === 0) {
      this.combo = 0;
      return;
    }

    // Flag rows for clear animation
    this.clearRows  = fullRows;
    this.clearing   = true;
    this.clearTimer = 0.35; // 350ms clear animation

    // Flash cells in clearing rows
    for (const r of fullRows) {
      for (let c = 0; c < BOARD_COLS; c++) {
        this.grid[r][c].clearFlash = 1.0;
      }
    }

    // Fire callbacks immediately for audio/visual feedback
    if (fullRows.length === 4) {
      this.onTetris();
    } else {
      this.onLineClear(fullRows.length);
    }

    // Score
    const scored = calculateScore(fullRows.length, this.level);
    const bonus  = fullRows.length === 4 ? 1200 * this.level : 0;
    this._addScore(scored + bonus, true);

    // Combo bonus
    if (this.combo > 0) {
      this._addScore(50 * this.combo * this.level, true);
    }
    this.combo++;
  }

  // ── Finalize line clear after animation ───────────────────
  _finalizeClear() {
    this.clearing = false;

    // Remove cleared rows and add empty rows at top
    for (const r of this.clearRows.sort((a, b) => b - a)) {
      this.grid.splice(r, 1);
      this.grid.unshift(this._emptyRow());
    }

    const count    = this.clearRows.length;
    this.clearRows = [];
    this.lines    += count;

    // Level up check
    const needed = linesForLevel(this.level);
    if (this.lines >= needed) {
      this.level++;
      this.onLevelUp(this.level);
    }
  }

  // ── Add score ─────────────────────────────────────────────
  _addScore(amount, notify = true) {
    this.score += amount;
    if (notify && amount > 0) {
      this.onScore(this.score, amount);
    }
  }

  // ── Reset lock delay on successful move/rotate ────────────
  // Allows the player to keep adjusting a piece that has landed
  _resetLockDelay() {
    if (this.isLocking) {
      this.lockTimer = Math.min(this.lockTimer, this.lockDelay * 0.5);
    }
  }

  // ── Ghost piece — shows where piece will land ─────────────
  _updateGhost() {
    if (!this.activePiece) {
      this.ghostPiece = null;
      return;
    }

    const ghost = this.activePiece.clone();

    while (this._isValid(ghost, ghost.x, ghost.y + 1)) {
      ghost.y++;
    }

    // Only show ghost if it is below the active piece
    this.ghostPiece = ghost.y > this.activePiece.y ? ghost : null;
  }

  // ── Get visible grid (strips buffer rows) ─────────────────
  getVisibleGrid() {
    return this.grid.slice(BOARD_BUFFER);
  }

  // ── Get all occupied cells with world position ────────────
  getLockedCells() {
    const cells = [];
    for (let r = BOARD_BUFFER; r < BOARD_TOTAL_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const cell = this.grid[r][c];
        if (!cell.isEmpty()) {
          cells.push({
            col:  c,
            row:  r - BOARD_BUFFER,
            cell,
          });
        }
      }
    }
    return cells;
  }

  // ── Get active piece cells with world position ────────────
  getActiveCells() {
    if (!this.activePiece) return [];
    const cells = [];
    const shape = this.activePiece.getShape();

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const boardY = this.activePiece.y + r - BOARD_BUFFER;
        const boardX = this.activePiece.x + c;
        if (boardY < 0) continue;
        cells.push({
          col:   boardX,
          row:   boardY,
          piece: this.activePiece,
        });
      }
    }
    return cells;
  }

  // ── Get ghost cells with world position ───────────────────
  getGhostCells() {
    if (!this.ghostPiece) return [];
    const cells = [];
    const shape = this.ghostPiece.getShape();

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const boardY = this.ghostPiece.y + r - BOARD_BUFFER;
        const boardX = this.ghostPiece.x + c;
        if (boardY < 0) continue;
        cells.push({
          col: boardX,
          row: boardY,
        });
      }
    }
    return cells;
  }
}