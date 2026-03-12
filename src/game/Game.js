/* ============================================================
   CRISPY BARNACLE — Game.js
   Master game coordinator. Owns the Board, GameLoop, HUD,
   and GPU rendering pipelines for the gameplay scene.
   Wires every system together and manages game state.
   ============================================================ */

import { Board, BOARD_COLS, BOARD_ROWS }     from './Board.js';
import { GameLoop }                           from './GameLoop.js';
import { BagRandomizer, Piece, TETROMINOES } from './Pieces.js';
import { HUD }                                from '../menu/HUD.js';
import { RaymarchPipeline }                   from '../gpu/pipelines/RaymarchPipeline.js';
import { PostProcessPipeline }                from '../gpu/pipelines/PostProcessPipeline.js';

// ── Board rendering constants ─────────────────────────────
const CELL_SIZE    = 32;    // pixels per cell
const BOARD_WIDTH  = BOARD_COLS * CELL_SIZE;
const BOARD_HEIGHT = BOARD_ROWS * CELL_SIZE;

export class Game {
  constructor({ gpuContext, audio, onGameOver, onMenu }) {
    this.gpu        = gpuContext;
    this.audio      = audio;
    this.onGameOver = onGameOver;
    this.onMenu     = onMenu;

    // Core systems
    this.board      = null;
    this.gameLoop   = null;
    this.randomizer = null;
    this.hud        = null;

    // GPU pipelines
    this.raymarch   = null;
    this.post       = null;

    // Canvas 2D overlay for board rendering
    this.boardCanvas = null;
    this.boardCtx    = null;

    // Game state
    this.running  = false;
    this.time     = 0;
    this.level    = 1;
    this.warp     = 0;
    this.visible  = false;

    // Listen for resume event from HUD
    this._onResume = () => this._handleResume();
    window.addEventListener('crispy:resume', this._onResume);
  }

  // ── Initialize ────────────────────────────────────────────
  async init() {
    // GPU background pipelines
    this.raymarch = new RaymarchPipeline(this.gpu);
    this.post     = new PostProcessPipeline(this.gpu);
    await this.raymarch.init();
    await this.post.init();

    // Board canvas — 2D overlay rendered on top of WebGPU
    this._createBoardCanvas();

    // Board logic
    this.board = new Board({
      onScore:     (score, delta) => this._onScore(score, delta),
      onLevelUp:   (level)        => this._onLevelUp(level),
      onGameOver:  ()             => this._onGameOver(),
      onLineClear: (count)        => this._onLineClear(count),
      onTetris:    ()             => this._onTetris(),
    });

    // Piece randomizer
    this.randomizer = new BagRandomizer();

    // Input / timing
    this.gameLoop = new GameLoop({
      board:   this.board,
      audio:   this.audio,
      onPause: () => this._handlePause(),
    });

    // HUD
    this.hud = new HUD({
      audio:     this.audio,
      onMenu:    () => this.onMenu(),
      onRestart: () => this._restart(),
    });
    this.hud.init();

    console.log('[Game] Initialized.');
  }

  // ── Create board canvas overlay ───────────────────────────
  _createBoardCanvas() {
    this.boardCanvas        = document.createElement('canvas');
    this.boardCanvas.id     = 'board-canvas';
    this.boardCanvas.width  = BOARD_WIDTH;
    this.boardCanvas.height = BOARD_HEIGHT;

    this.boardCanvas.style.cssText = `
      position: fixed;
      top:  50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 5;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 4px;
      box-shadow:
        0 0 60px rgba(80, 130, 255, 0.15),
        0 0 120px rgba(60, 100, 255, 0.08);
      display: none;
    `;

    document.body.appendChild(this.boardCanvas);
    this.boardCtx = this.boardCanvas.getContext('2d');
  }

  // ── Start a new game ──────────────────────────────────────
  start() {
    this.board.reset();
    this.randomizer = new BagRandomizer();
    this.time       = 0;
    this.level      = 1;
    this.warp       = 0;
    this.running    = true;

    // Spawn first piece
    this._spawnNext();

    // Start input
    this.gameLoop.start();

    // Show UI
    this.boardCanvas.style.display = 'block';
    this.hud.show();
    this.hud.reset();
    this.visible = true;

    // Update next piece preview
    this._updateNextPreview();

    console.log('[Game] Started.');
  }

  // ── Reset for replay ──────────────────────────────────────
  reset() {
    this.gameLoop.stop();
    this.start();
  }

  // ── Spawn next piece from bag ─────────────────────────────
  _spawnNext() {
    const id    = this.randomizer.next();
    const piece = new Piece(id);
    this.board.spawnPiece(piece);
    this._updateNextPreview();
  }

  // ── Update HUD next piece preview ────────────────────────
  _updateNextPreview() {
    const nextId  = this.randomizer.peek();
    const nextDef = TETROMINOES[nextId];
    this.hud.drawNextPiece({
      shape: nextDef.shapes[0],
      color: nextDef.color,
    });
  }

  // ── Board callbacks ───────────────────────────────────────
  _onScore(score, delta) {
    this.hud.setScore(score, delta);
  }

  _onLevelUp(level) {
    this.level = level;
    this.hud.setLevel(level);
    this.audio.playLevelUp();
  }

  _onLineClear(count) {
    this.hud.setLines(this.board.lines);
    this.audio.playLineClear();
  }

  _onTetris() {
    this.hud.setLines(this.board.lines);
    this.audio.playTetris();
  }

  _onGameOver() {
    this.running = false;
    this.gameLoop.stop();
    this.audio.playGameOver();
    this.hud.showGameOver(
      this.board.score,
      this.board.level,
      this.board.lines,
    );
    this.onGameOver();
  }

  // ── Pause ─────────────────────────────────────────────────
  _handlePause() {
    if (!this.running) return;
    this.running = false;
    this.gameLoop.lock();
    this.hud.showPause();
    this.audio.pauseMusic();
  }

  // ── Resume ────────────────────────────────────────────────
  _handleResume() {
    if (this.running) return;
    this.running = true;
    this.gameLoop.unlock();
    this.hud.hidePause();
    this.audio.resumeMusic();
  }

  // ── Restart ───────────────────────────────────────────────
  _restart() {
    this.audio.stopMusic();
    this.audio.startMusic();
    this.reset();
  }

  // ── Update — called every frame ───────────────────────────
  update(delta, timestamp) {
    this.time += delta;
    this.warp  = Math.sin(this.time * 0.15) * 0.5 + 0.5;

    // Update audio analyser every frame
    this.audio.update();

    // Update GPU pipelines
    this.raymarch.update({
      time:       this.time,
      audioLevel: this.audio.audioLevel,
      warp:       this.warp,
      level:      this.board ? this.board.level : 1,
    });

    this.post.update({
      time:       this.time,
      audioLevel: this.audio.audioLevel,
      warp:       this.warp,
      level:      this.board ? this.board.level : 1,
    });

    // Update HUD
    this.hud.update(delta, null);

    if (!this.running) return;

    // Update board logic
    this.board.update(delta);

    // Update input
    this.gameLoop.update(delta);

    // Check if active piece was consumed — spawn next
    if (!this.board.activePiece && !this.board.gameOver && !this.board.clearing) {
      this._spawnNext();
    }
  }

  // ── Render — called every frame ───────────────────────────
  render() {
    // Pass 1 + 2: WebGPU fractal background
    const encoder = this.gpu.device.createCommandEncoder({
      label: 'game-encoder',
    });
    this.raymarch.render(encoder);
    this.post.render(encoder);
    this.gpu.submit(encoder);

    // Pass 3: 2D board on canvas overlay
    this._renderBoard();
  }

  // ── Render the 2D board ───────────────────────────────────
  _renderBoard() {
    const ctx = this.boardCtx;
    const W   = BOARD_WIDTH;
    const H   = BOARD_HEIGHT;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Background — semi-transparent so fractal bleeds through
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    this._renderGrid(ctx);

    // Locked cells
    const locked = this.board.getLockedCells();
    for (const { col, row, cell } of locked) {
      this._renderCell(
        ctx, col, row,
        cell.color, cell.glow,
        cell.glowPulse, cell.lockFlash, cell.clearFlash
      );
    }

    // Ghost piece
    const ghost = this.board.getGhostCells();
    for (const { col, row } of ghost) {
      this._renderGhostCell(ctx, col, row);
    }

    // Active piece
    const active = this.board.getActiveCells();
    for (const { col, row, piece } of active) {
      this._renderCell(
        ctx, col, row,
        piece.color, piece.glow,
        piece.glowPulse, 0, 0
      );
    }

    // Board border glow
    this._renderBorderGlow(ctx, W, H);
  }

  // ── Render subtle grid lines ──────────────────────────────
  _renderGrid(ctx) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth   = 0.5;

    for (let c = 0; c <= BOARD_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_SIZE, 0);
      ctx.lineTo(c * CELL_SIZE, BOARD_HEIGHT);
      ctx.stroke();
    }

    for (let r = 0; r <= BOARD_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_SIZE);
      ctx.lineTo(BOARD_WIDTH, r * CELL_SIZE);
      ctx.stroke();
    }
  }

  // ── Render a single filled cell ───────────────────────────
  _renderCell(ctx, col, row, color, glow, glowPulse, lockFlash, clearFlash) {
    const x   = col * CELL_SIZE;
    const y   = row * CELL_SIZE;
    const s   = CELL_SIZE - 1;
    const pad = 1;

    // Glow shadow — pulsing
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 10 + glowPulse * 8;

    // Base fill
    ctx.fillStyle = color;
    ctx.fillRect(x + pad, y + pad, s - pad, s - pad);

    // Lock flash — white overlay
    if (lockFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${lockFlash * 0.7})`;
      ctx.fillRect(x + pad, y + pad, s - pad, s - pad);
    }

    // Clear flash — bright white
    if (clearFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${clearFlash * 0.9})`;
      ctx.fillRect(x + pad, y + pad, s - pad, s - pad);
    }

    ctx.shadowBlur = 0;

    // Top-left highlight edge
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + glowPulse * 0.15})`;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x + pad,           y + pad);
    ctx.lineTo(x + pad + s - pad, y + pad);
    ctx.moveTo(x + pad,           y + pad);
    ctx.lineTo(x + pad,           y + pad + s - pad);
    ctx.stroke();

    // Bottom-right shadow edge
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.moveTo(x + s,  y + pad);
    ctx.lineTo(x + s,  y + s);
    ctx.lineTo(x + pad, y + s);
    ctx.stroke();
  }

  // ── Render ghost cell ─────────────────────────────────────
  _renderGhostCell(ctx, col, row) {
    const x   = col * CELL_SIZE;
    const y   = row * CELL_SIZE;
    const s   = CELL_SIZE - 1;
    const pad = 1;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(x + pad, y + pad, s - pad, s - pad);
  }

  // ── Render board border glow ──────────────────────────────
  _renderBorderGlow(ctx, W, H) {
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    const a    = 0.06 + this.audio.audioLevel * 0.12;
    grad.addColorStop(0,   `rgba(80, 130, 255, ${a})`);
    grad.addColorStop(0.5, `rgba(140, 80, 255, ${a * 0.5})`);
    grad.addColorStop(1,   `rgba(80, 130, 255, ${a})`);

    ctx.strokeStyle = grad;
    ctx.lineWidth   = 2;
    ctx.strokeRect(0, 0, W, H);
  }

  // ── Show / hide ───────────────────────────────────────────
  show() {
    this.boardCanvas.style.display = 'block';
    this.hud.show();
    this.visible = true;
  }

  hide() {
    this.boardCanvas.style.display = 'none';
    this.hud.hide();
    this.visible  = false;
    this.running  = false;
    this.gameLoop.stop();
  }

  // ── Show game over ────────────────────────────────────────
  showGameOver() {
    this.hud.showGameOver(
      this.board.score,
      this.board.level,
      this.board.lines,
    );
  }

  // ── Handle resize ─────────────────────────────────────────
  handleResize() {
    this.post.handleResize();
    this.raymarch.handleResize();
    // Board canvas is centered via CSS transform — no recalc needed
  }

  // ── Destroy ───────────────────────────────────────────────
  destroy() {
    this.gameLoop.destroy();
    this.raymarch.destroy();
    this.post.destroy();
    this.boardCanvas?.remove();
    this.hud?.hide();
    window.removeEventListener('crispy:resume', this._onResume);
    console.log('[Game] Destroyed.');
  }
}