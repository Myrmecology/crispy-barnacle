/* ============================================================
   CRISPY BARNACLE — Pieces.js
   All seven classic tetrominoes.
   Rotation system (SRS — Super Rotation System).
   Color palette tuned for the psychedelic WebGPU aesthetic.
   Kick tables for wall and floor kicks.
   ============================================================ */

// ── Tetromino shape definitions ───────────────────────────
// Each piece defined in its spawn orientation (rotation 0).
// 1 = filled cell, 0 = empty cell.

export const TETROMINOES = {

  I: {
    id:    'I',
    color: '#00f5ff',
    glow:  'rgba(0, 245, 255, 0.8)',
    shapes: [
      // Rotation 0
      [[0,0,0,0],
       [1,1,1,1],
       [0,0,0,0],
       [0,0,0,0]],
      // Rotation 1
      [[0,0,1,0],
       [0,0,1,0],
       [0,0,1,0],
       [0,0,1,0]],
      // Rotation 2
      [[0,0,0,0],
       [0,0,0,0],
       [1,1,1,1],
       [0,0,0,0]],
      // Rotation 3
      [[0,1,0,0],
       [0,1,0,0],
       [0,1,0,0],
       [0,1,0,0]],
    ],
  },

  O: {
    id:    'O',
    color: '#ffe600',
    glow:  'rgba(255, 230, 0, 0.8)',
    shapes: [
      // All rotations identical for O piece
      [[1,1],
       [1,1]],
      [[1,1],
       [1,1]],
      [[1,1],
       [1,1]],
      [[1,1],
       [1,1]],
    ],
  },

  T: {
    id:    'T',
    color: '#cc44ff',
    glow:  'rgba(204, 68, 255, 0.8)',
    shapes: [
      // Rotation 0
      [[0,1,0],
       [1,1,1],
       [0,0,0]],
      // Rotation 1
      [[0,1,0],
       [0,1,1],
       [0,1,0]],
      // Rotation 2
      [[0,0,0],
       [1,1,1],
       [0,1,0]],
      // Rotation 3
      [[0,1,0],
       [1,1,0],
       [0,1,0]],
    ],
  },

  S: {
    id:    'S',
    color: '#00ff88',
    glow:  'rgba(0, 255, 136, 0.8)',
    shapes: [
      // Rotation 0
      [[0,1,1],
       [1,1,0],
       [0,0,0]],
      // Rotation 1
      [[0,1,0],
       [0,1,1],
       [0,0,1]],
      // Rotation 2
      [[0,0,0],
       [0,1,1],
       [1,1,0]],
      // Rotation 3
      [[1,0,0],
       [1,1,0],
       [0,1,0]],
    ],
  },

  Z: {
    id:    'Z',
    color: '#ff3366',
    glow:  'rgba(255, 51, 102, 0.8)',
    shapes: [
      // Rotation 0
      [[1,1,0],
       [0,1,1],
       [0,0,0]],
      // Rotation 1
      [[0,0,1],
       [0,1,1],
       [0,1,0]],
      // Rotation 2
      [[0,0,0],
       [1,1,0],
       [0,1,1]],
      // Rotation 3
      [[0,1,0],
       [1,1,0],
       [1,0,0]],
    ],
  },

  J: {
    id:    'J',
    color: '#ff8800',
    glow:  'rgba(255, 136, 0, 0.8)',
    shapes: [
      // Rotation 0
      [[1,0,0],
       [1,1,1],
       [0,0,0]],
      // Rotation 1
      [[0,1,1],
       [0,1,0],
       [0,1,0]],
      // Rotation 2
      [[0,0,0],
       [1,1,1],
       [0,0,1]],
      // Rotation 3
      [[0,1,0],
       [0,1,0],
       [1,1,0]],
    ],
  },

  L: {
    id:    'L',
    color: '#4488ff',
    glow:  'rgba(68, 136, 255, 0.8)',
    shapes: [
      // Rotation 0
      [[0,0,1],
       [1,1,1],
       [0,0,0]],
      // Rotation 1
      [[0,1,0],
       [0,1,0],
       [0,1,1]],
      // Rotation 2
      [[0,0,0],
       [1,1,1],
       [1,0,0]],
      // Rotation 3
      [[1,1,0],
       [0,1,0],
       [0,1,0]],
    ],
  },
};

// ── Piece ID list for bag randomizer ─────────────────────
export const PIECE_IDS = ['I','O','T','S','Z','J','L'];

/* ============================================================
   SRS WALL KICK DATA
   Offsets to try when a rotation is blocked.
   Standard kick table used by modern Tetris games.
   ============================================================ */

// For J, L, S, T, Z pieces
const KICKS_JLSTZ = {
  '0->1': [[ 0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
  '1->0': [[ 0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
  '1->2': [[ 0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
  '2->1': [[ 0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
  '2->3': [[ 0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],
  '3->2': [[ 0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
  '3->0': [[ 0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
  '0->3': [[ 0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],
};

// For I piece — different kick table
const KICKS_I = {
  '0->1': [[ 0,0],[-2,0],[ 1,0],[-2,-1],[ 1, 2]],
  '1->0': [[ 0,0],[ 2,0],[-1,0],[ 2, 1],[-1,-2]],
  '1->2': [[ 0,0],[-1,0],[ 2,0],[-1, 2],[ 2,-1]],
  '2->1': [[ 0,0],[ 1,0],[-2,0],[ 1,-2],[-2, 1]],
  '2->3': [[ 0,0],[ 2,0],[-1,0],[ 2, 1],[-1,-2]],
  '3->2': [[ 0,0],[-2,0],[ 1,0],[-2,-1],[ 1, 2]],
  '3->0': [[ 0,0],[ 1,0],[-2,0],[ 1,-2],[-2, 1]],
  '0->3': [[ 0,0],[-1,0],[ 2,0],[-1, 2],[ 2,-1]],
};

// O piece never needs kicks
const KICKS_O = {
  '0->1': [[0,0]], '1->0': [[0,0]],
  '1->2': [[0,0]], '2->1': [[0,0]],
  '2->3': [[0,0]], '3->2': [[0,0]],
  '3->0': [[0,0]], '0->3': [[0,0]],
};

export function getKickData(pieceId, fromRot, toRot) {
  const key = `${fromRot}->${toRot}`;
  if (pieceId === 'I') return KICKS_I[key]  ?? [[0,0]];
  if (pieceId === 'O') return KICKS_O[key]  ?? [[0,0]];
  return KICKS_JLSTZ[key] ?? [[0,0]];
}

/* ============================================================
   PIECE CLASS
   A live tetromino on the board.
   ============================================================ */

export class Piece {
  constructor(id) {
    const def       = TETROMINOES[id];
    this.id         = def.id;
    this.color      = def.color;
    this.glow       = def.glow;
    this.shapes     = def.shapes;
    this.rotation   = 0;
    this.shape      = this.shapes[0];

    // Spawn position — centered at top of board
    // Standard Tetris board is 10 wide
    this.x          = Math.floor((10 - this.shape[0].length) / 2);
    this.y          = 0;

    // 3D morph state — drives WebGPU visual effects
    this.morphPhase = Math.random() * Math.PI * 2;
    this.morphSpeed = 0.8 + Math.random() * 0.6;
    this.glowPulse  = 0;
  }

  // ── Get current shape matrix ──────────────────────────────
  getShape() {
    return this.shapes[this.rotation];
  }

  // ── Rotate — returns new rotation index, does not mutate ──
  getNextRotation(dir = 1) {
    return ((this.rotation + dir) + 4) % 4;
  }

  // ── Apply rotation ────────────────────────────────────────
  applyRotation(newRot, newX, newY) {
    this.rotation = newRot;
    this.shape    = this.shapes[newRot];
    this.x        = newX;
    this.y        = newY;
  }

  // ── Move ──────────────────────────────────────────────────
  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  // ── Update morph animation state ──────────────────────────
  update(delta) {
    this.morphPhase += delta * this.morphSpeed;
    this.glowPulse   = (Math.sin(this.morphPhase) + 1) * 0.5;
  }

  // ── Clone — for ghost piece calculation ───────────────────
  clone() {
    const p       = new Piece(this.id);
    p.rotation    = this.rotation;
    p.shape       = this.shapes[this.rotation];
    p.x           = this.x;
    p.y           = this.y;
    p.morphPhase  = this.morphPhase;
    p.glowPulse   = this.glowPulse;
    return p;
  }
}

/* ============================================================
   BAG RANDOMIZER
   7-bag system — guarantees every piece appears once
   per bag before any repeats. Standard modern Tetris.
   ============================================================ */

export class BagRandomizer {
  constructor() {
    this.bag = [];
  }

  // ── Fill and shuffle a new bag ────────────────────────────
  _refill() {
    this.bag = [...PIECE_IDS];
    // Fisher-Yates shuffle
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j      = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }

  // ── Get next piece ID ─────────────────────────────────────
  next() {
    if (this.bag.length === 0) this._refill();
    return this.bag.pop();
  }

  // ── Peek at next piece without consuming it ───────────────
  peek() {
    if (this.bag.length === 0) this._refill();
    return this.bag[this.bag.length - 1];
  }
}

/* ============================================================
   SCORING SYSTEM
   Classic Tetris scoring with level multiplier.
   ============================================================ */

export const SCORE_TABLE = {
  1: 100,   // Single
  2: 300,   // Double
  3: 500,   // Triple
  4: 800,   // Tetris
};

export const TETRIS_BONUS = 1200;  // 4-line clear bonus on top

export function calculateScore(linesCleared, level) {
  const base = SCORE_TABLE[linesCleared] ?? 0;
  return base * level;
}

// Lines needed to advance each level
export function linesForLevel(level) {
  return level * 10;
}

// Fall speed in seconds per row — gets faster each level
export function fallSpeed(level) {
  return Math.max(0.05, 0.8 - (level - 1) * 0.045);
}