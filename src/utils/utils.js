/* ============================================================
   CRISPY BARNACLE — utils.js
   Shared utility functions. Math helpers, easing,
   color tools, DOM helpers, and debug utilities.
   ============================================================ */

/* ============================================================
   MATH
   ============================================================ */

// Linear interpolation
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Clamp a value between min and max
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Map a value from one range to another
export function map(val, inMin, inMax, outMin, outMax) {
  return outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);
}

// Map and clamp in one step
export function mapClamp(val, inMin, inMax, outMin, outMax) {
  return clamp(map(val, inMin, inMax, outMin, outMax), outMin, outMax);
}

// Normalize a value to 0–1 within a range
export function normalize(val, min, max) {
  return (val - min) / (max - min);
}

// Degrees to radians
export function degToRad(deg) {
  return deg * (Math.PI / 180);
}

// Radians to degrees
export function radToDeg(rad) {
  return rad * (180 / Math.PI);
}

// Modulo that handles negative numbers correctly
export function mod(n, m) {
  return ((n % m) + m) % m;
}

// Random float between min and max
export function randFloat(min, max) {
  return min + Math.random() * (max - min);
}

// Random integer between min and max (inclusive)
export function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

// Round to N decimal places
export function roundTo(val, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/* ============================================================
   EASING FUNCTIONS
   All take t in [0, 1] and return eased t in [0, 1]
   ============================================================ */

export const Ease = {

  linear: (t) => t,

  inQuad:    (t) => t * t,
  outQuad:   (t) => t * (2 - t),
  inOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  inCubic:    (t) => t * t * t,
  outCubic:   (t) => (--t) * t * t + 1,
  inOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  inQuart:    (t) => t * t * t * t,
  outQuart:   (t) => 1 - (--t) * t * t * t,
  inOutQuart: (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,

  inExpo:    (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  outExpo:   (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inOutExpo: (t) => {
    if (t === 0 || t === 1) return t;
    return t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },

  inBack:    (t) => 2.70158 * t * t * t - 1.70158 * t * t,
  outBack:   (t) => 1 + 2.70158 * (--t) * t * t + 1.70158 * t * t,
  inOutBack: (t) => {
    const c = 1.70158 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
  },

  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t)
         * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
  },

  outBounce: (t) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d)       return n * t * t;
    if (t < 2 / d)       return n * (t -= 1.5   / d) * t + 0.75;
    if (t < 2.5 / d)     return n * (t -= 2.25  / d) * t + 0.9375;
    return               n * (t -= 2.625 / d) * t + 0.984375;
  },

};

/* ============================================================
   COLOR UTILITIES
   ============================================================ */

// Parse hex color to {r, g, b} (0–255)
export function hexToRGB(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

// RGB (0–255) to hex string
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
    .join('');
}

// Interpolate between two hex colors
export function lerpColor(hexA, hexB, t) {
  const a = hexToRGB(hexA);
  const b = hexToRGB(hexB);
  return rgbToHex(
    lerp(a.r, b.r, t),
    lerp(a.g, b.g, t),
    lerp(a.b, b.b, t),
  );
}

// Hex color to rgba() string with alpha
export function hexToRGBA(hex, alpha = 1.0) {
  const { r, g, b } = hexToRGB(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Hex color to normalized Float32Array [r, g, b, a] for WebGPU
export function hexToFloat4(hex, alpha = 1.0) {
  const { r, g, b } = hexToRGB(hex);
  return new Float32Array([r / 255, g / 255, b / 255, alpha]);
}

/* ============================================================
   TIMING
   ============================================================ */

// Promise-based sleep
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Debounce — delays execution until after wait ms have passed
export function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

// Throttle — executes at most once per interval ms
export function throttle(fn, interval) {
  let last = 0;
  return (...args) => {
    const now = performance.now();
    if (now - last >= interval) {
      last = now;
      fn(...args);
    }
  };
}

// Simple stopwatch
export class Stopwatch {
  constructor() {
    this.startTime  = 0;
    this.elapsed    = 0;
    this.running    = false;
  }

  start() {
    if (this.running) return;
    this.startTime = performance.now() - this.elapsed;
    this.running   = true;
  }

  stop() {
    if (!this.running) return;
    this.elapsed = performance.now() - this.startTime;
    this.running = false;
  }

  reset() {
    this.elapsed = 0;
    this.running = false;
  }

  getSeconds() {
    if (this.running) {
      return (performance.now() - this.startTime) / 1000;
    }
    return this.elapsed / 1000;
  }
}

/* ============================================================
   DOM HELPERS
   ============================================================ */

// Safe querySelector — returns null without throwing
export function qs(selector, root = document) {
  return root.querySelector(selector);
}

// Safe querySelectorAll — returns array
export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

// Create element with optional attributes and text
export function createElement(tag, attrs = {}, text = '') {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (text) el.textContent = text;
  return el;
}

// Add multiple event listeners at once
export function on(el, events, handler) {
  events.split(' ').forEach(evt => el.addEventListener(evt, handler));
}

// Remove multiple event listeners at once
export function off(el, events, handler) {
  events.split(' ').forEach(evt => el.removeEventListener(evt, handler));
}

/* ============================================================
   NUMBER FORMATTING
   ============================================================ */

// Format a score with commas: 1234567 → "1,234,567"
export function formatScore(n) {
  return n.toLocaleString();
}

// Format seconds as MM:SS
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Pad a number with leading zeros
export function zeroPad(n, width) {
  return String(n).padStart(width, '0');
}

/* ============================================================
   PERFORMANCE / DEBUG
   ============================================================ */

// Simple FPS counter
export class FPSCounter {
  constructor() {
    this.frames    = 0;
    this.fps       = 0;
    this.lastTime  = performance.now();
    this.interval  = 500; // update every 500ms
    this.elapsed   = 0;
  }

  update(delta) {
    this.frames++;
    this.elapsed += delta * 1000;

    if (this.elapsed >= this.interval) {
      this.fps     = Math.round(this.frames / (this.elapsed / 1000));
      this.frames  = 0;
      this.elapsed = 0;
    }
  }

  getFPS() {
    return this.fps;
  }
}

// Lightweight performance marker
export class PerfMarker {
  constructor(label) {
    this.label = label;
    this.start = 0;
  }

  begin() {
    this.start = performance.now();
  }

  end() {
    const ms = performance.now() - this.start;
    console.debug(`[Perf:${this.label}] ${ms.toFixed(2)}ms`);
    return ms;
  }
}

/* ============================================================
   WEBGPU HELPERS
   ============================================================ */

// Align a byte size to the nearest multiple of alignment
export function alignTo(size, alignment) {
  return Math.ceil(size / alignment) * alignment;
}

// Align to 16 bytes — most common WebGPU uniform requirement
export function align16(size) {
  return alignTo(size, 16);
}

// Align to 256 bytes — required for dynamic uniform offsets
export function align256(size) {
  return alignTo(size, 256);
}

// Check if WebGPU is available
export function isWebGPUSupported() {
  return !!navigator.gpu;
}

// Check if the browser supports the preferred canvas format
export async function getPreferredFormat() {
  if (!navigator.gpu) return null;
  return navigator.gpu.getPreferredCanvasFormat();
}