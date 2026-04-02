/**
 * UX LAB — heatmap.js
 * ─────────────────────────────────────────────────────────────
 * Renders click and mouse movement data as a heatmap overlay
 * on an HTML5 Canvas element using a Gaussian radial gradient
 * kernel — the same technique used by Hotjar and FullStory.
 * ─────────────────────────────────────────────────────────────
 */

class HeatmapRenderer {
  constructor(canvasId) {
    this.canvas  = document.getElementById(canvasId);
    this.ctx     = this.canvas.getContext('2d');
    this.points  = [];
    this.radius  = 18;
    this.opacity = 0.85;
  }

  // ────────────────────────────────────────────────────────────
  //  RESIZE
  //  Match canvas pixel dimensions to its CSS display size.
  //  Critical for sharp rendering on high-DPI screens.
  // ────────────────────────────────────────────────────────────

  resize() {
    const rect         = this.canvas.getBoundingClientRect();
    const dpr          = window.devicePixelRatio || 1;
    this.canvas.width  = rect.width  * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this._displayW = rect.width;
    this._displayH = rect.height;
  }

  // ────────────────────────────────────────────────────────────
  //  LOAD DATA
  //  Accepts normalized points from the /heatmap/{page} API.
  //  x_pct and y_pct are percentages (0-100) of viewport size.
  // ────────────────────────────────────────────────────────────

  loadPoints(points, showClicks = true, showMoves = true) {
    this.points = points.filter(p => {
      if (p.event_type === 'click'     && showClicks) return true;
      if (p.event_type === 'mousemove' && showMoves)  return true;
      return false;
    });
  }

  // ────────────────────────────────────────────────────────────
  //  RENDER
  //  Two-pass technique:
  //  Pass 1 — draw radial Gaussian "heat" blobs in greyscale
  //  Pass 2 — colorize using a heatmap gradient palette
  // ────────────────────────────────────────────────────────────

  render(radius = 18) {
    this.radius = radius;
    if (!this._displayW) this.resize();

    const ctx = this.ctx;
    const W   = this._displayW;
    const H   = this._displayH;

    ctx.clearRect(0, 0, W, H);

    if (this.points.length === 0) return;

    // ── Pass 1: Draw alpha blobs on a black background ──
    // Each point gets a radial gradient from white (center)
    // to transparent (edge). Overlapping blobs stack their
    // alpha values, creating brighter "hotter" areas.

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.15;

    this.points.forEach(p => {
      const x = (p.x_pct / 100) * W;
      const y = (p.y_pct / 100) * H;

      // Clicks get a larger, more intense blob
      const r = p.event_type === 'click' ? this.radius * 1.8 : this.radius;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0,   'rgba(255,255,255,1)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
      grad.addColorStop(1,   'rgba(255,255,255,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── Pass 2: Colorize ──
    // Read each pixel's alpha value from Pass 1.
    // Map alpha → heatmap color (blue → green → yellow → red).
    // This is exactly how production heatmap libraries work.

    ctx.globalAlpha    = 1;
    ctx.globalCompositeOperation = 'source-in';

    const gradient = ctx.createLinearGradient(0, 0, W, 0);
    gradient.addColorStop(0.0,  '#0000ff');  // cold  — blue
    gradient.addColorStop(0.25, '#00ffff');  // cool  — cyan
    gradient.addColorStop(0.5,  '#00ff00');  // warm  — green
    gradient.addColorStop(0.75, '#ffff00');  // hot   — yellow
    gradient.addColorStop(1.0,  '#ff0000');  // fire  — red

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // ── Reset composite mode ──
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = this.opacity;

    // ── Re-draw colorized layer with correct opacity ──
    const imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    ctx.clearRect(0, 0, W, H);

    // Density-based colorization pass
    this._densityPass(W, H);
  }

  // ────────────────────────────────────────────────────────────
  //  DENSITY PASS
  //  More accurate two-pass approach:
  //  1. Draw all heat blobs to an offscreen canvas
  //  2. Read pixel alpha values
  //  3. Map alpha to color using the heatmap palette
  //  4. Draw final colorized result onto the main canvas
  // ────────────────────────────────────────────────────────────

  _densityPass(W, H) {
    // Offscreen canvas for alpha accumulation
    const offscreen    = document.createElement('canvas');
    offscreen.width    = this.canvas.width;
    offscreen.height   = this.canvas.height;
    const offCtx       = offscreen.getContext('2d');
    const dpr          = window.devicePixelRatio || 1;

    offCtx.scale(dpr, dpr);
    offCtx.globalCompositeOperation = 'source-over';

    // Draw all blobs
    this.points.forEach(p => {
      const x = (p.x_pct / 100) * W;
      const y = (p.y_pct / 100) * H;
      const r = p.event_type === 'click' ? this.radius * 2.0 : this.radius;
      const alpha = p.event_type === 'click' ? 0.25 : 0.10;

      const grad = offCtx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0,   `rgba(255,255,255,${alpha})`);
      grad.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.5})`);
      grad.addColorStop(1,   'rgba(255,255,255,0)');

      offCtx.fillStyle = grad;
      offCtx.beginPath();
      offCtx.arc(x, y, r, 0, Math.PI * 2);
      offCtx.fill();
    });

    // Read pixel data from offscreen canvas
    const imgData  = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data     = imgData.data;
    const palette  = this._buildPalette();

    // Map alpha → color
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha === 0) continue;

      const intensity = Math.min(alpha / 255, 1);
      const color     = palette[Math.floor(intensity * 255)];

      data[i]     = color[0];  // R
      data[i + 1] = color[1];  // G
      data[i + 2] = color[2];  // B
      data[i + 3] = Math.floor(intensity * 220);
    }

    offCtx.putImageData(imgData, 0, 0);

    // Draw final result onto main canvas
    this.ctx.globalAlpha = this.opacity;
    this.ctx.drawImage(offscreen, 0, 0, W, H);
    this.ctx.globalAlpha = 1;
  }

  // ────────────────────────────────────────────────────────────
  //  PALETTE BUILDER
  //  Generates a 256-entry color lookup table.
  //  Maps intensity 0→255 to the classic heatmap gradient:
  //  transparent → blue → cyan → green → yellow → red
  // ────────────────────────────────────────────────────────────

  _buildPalette() {
    const canvas  = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 1;
    const ctx     = canvas.getContext('2d');
    const grad    = ctx.createLinearGradient(0, 0, 256, 0);

    grad.addColorStop(0.0,  '#00000000');  // transparent
    grad.addColorStop(0.15, '#0000ff');    // blue
    grad.addColorStop(0.35, '#00ffff');    // cyan
    grad.addColorStop(0.55, '#00ff00');    // green
    grad.addColorStop(0.75, '#ffff00');    // yellow
    grad.addColorStop(1.0,  '#ff0000');    // red

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 1);

    const imgData = ctx.getImageData(0, 0, 256, 1).data;
    const palette = [];

    for (let i = 0; i < 256; i++) {
      palette.push([
        imgData[i * 4],
        imgData[i * 4 + 1],
        imgData[i * 4 + 2],
      ]);
    }

    return palette;
  }

  // ────────────────────────────────────────────────────────────
  //  CLEAR
  // ────────────────────────────────────────────────────────────

  clear() {
    if (this._displayW) {
      this.ctx.clearRect(0, 0, this._displayW, this._displayH);
    }
    this.points = [];
  }

  // ────────────────────────────────────────────────────────────
  //  SCROLL DEPTH ANALYSIS
  //  Takes raw scroll events and returns the average max
  //  scroll depth as a percentage — used for the progress bar.
  // ────────────────────────────────────────────────────────────

  static analyzeScrollDepth(events) {
    const scrollEvents = events.filter(e => e.event_type === 'scroll');
    if (scrollEvents.length === 0) return 0;
    const depths = scrollEvents.map(e => e.scroll_pct || 0);
    const avg    = depths.reduce((a, b) => a + b, 0) / depths.length;
    return Math.round(avg);
  }

  // ────────────────────────────────────────────────────────────
  //  CLICK ANALYSIS
  //  Returns total click count for a set of events.
  // ────────────────────────────────────────────────────────────

  static countClicks(events) {
    return events.filter(e => e.event_type === 'click').length;
  }
}

// Export for use in app.js
window.HeatmapRenderer = HeatmapRenderer;