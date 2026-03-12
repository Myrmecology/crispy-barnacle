/* ============================================================
   CRISPY BARNACLE — SoundEffects.js
   All game sound effects synthesized via Web Audio API.
   No external files. No dependencies. Pure code audio.
   ============================================================ */

export class SoundEffects {
  constructor(ctx, outputNode) {
    this.ctx        = ctx;        // Shared AudioContext
    this.output     = outputNode; // Routes to sfxGain
  }

  // ── Internal: create a gain node connected to output ──────
  _gain(value = 1.0) {
    const g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(this.output);
    return g;
  }

  // ── Internal: create and start an oscillator ──────────────
  _osc(type, frequency, gainNode) {
    const osc = this.ctx.createOscillator();
    osc.type      = type;
    osc.frequency.value = frequency;
    osc.connect(gainNode);
    return osc;
  }

  // ── Internal: schedule gain envelope ─────────────────────
  _envelope(gainNode, peak, attack, decay, sustain, release) {
    const now = this.ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(peak,    now + attack);
    gainNode.gain.linearRampToValueAtTime(sustain, now + attack + decay);
    gainNode.gain.linearRampToValueAtTime(0,       now + attack + decay + release);
  }

  // ── Internal: white noise burst ───────────────────────────
  _noise(duration, gainNode) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer     = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data       = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    return source;
  }

  // ============================================================
  // PIECE MOVE — soft lateral click
  // ============================================================
  playMove() {
    try {
      const g   = this._gain(0.0);
      const osc = this._osc('sine', 320, g);
      this._envelope(g, 0.12, 0.002, 0.03, 0.0, 0.04);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (_) {}
  }

  // ============================================================
  // PIECE ROTATE — quick airy swoosh
  // ============================================================
  playRotate() {
    try {
      const g   = this._gain(0.0);
      const osc = this._osc('sine', 480, g);
      osc.frequency.linearRampToValueAtTime(
        260,
        this.ctx.currentTime + 0.07
      );
      this._envelope(g, 0.15, 0.002, 0.06, 0.0, 0.04);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (_) {}
  }

  // ============================================================
  // SOFT DROP — low thud
  // ============================================================
  playSoftDrop() {
    try {
      const g   = this._gain(0.0);
      const osc = this._osc('triangle', 140, g);
      osc.frequency.linearRampToValueAtTime(
        80,
        this.ctx.currentTime + 0.06
      );
      this._envelope(g, 0.2, 0.002, 0.05, 0.0, 0.06);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (_) {}
  }

  // ============================================================
  // HARD DROP — sharp deep impact
  // ============================================================
  playHardDrop() {
    try {
      // Low thud
      const g1   = this._gain(0.0);
      const osc1 = this._osc('sawtooth', 100, g1);
      osc1.frequency.exponentialRampToValueAtTime(
        40,
        this.ctx.currentTime + 0.1
      );
      this._envelope(g1, 0.35, 0.001, 0.08, 0.0, 0.1);
      osc1.start();
      osc1.stop(this.ctx.currentTime + 0.2);

      // Noise crack
      const g2 = this._gain(0.0);
      this._envelope(g2, 0.18, 0.001, 0.04, 0.0, 0.08);
      const noise = this._noise(0.2, g2);
      noise.start();
      noise.stop(this.ctx.currentTime + 0.15);
    } catch (_) {}
  }

  // ============================================================
  // LINE CLEAR — harmonic chime sweep
  // ============================================================
  playLineClear() {
    try {
      const freqs = [523, 659, 784, 1047]; // C5 E5 G5 C6

      freqs.forEach((freq, i) => {
        const delay = i * 0.055;
        const g     = this._gain(0.0);
        const osc   = this._osc('sine', freq, g);

        const now = this.ctx.currentTime + delay;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.22, now + 0.01);
        g.gain.linearRampToValueAtTime(0.0,  now + 0.35);

        osc.start(now);
        osc.stop(now + 0.4);
      });
    } catch (_) {}
  }

  // ============================================================
  // TETRIS (4 lines) — cosmic dimensional collapse
  // ============================================================
  playTetris() {
    try {
      // Rising harmonic sweep
      const freqs = [261, 329, 392, 523, 659, 784, 1047];

      freqs.forEach((freq, i) => {
        const delay = i * 0.07;
        const g     = this._gain(0.0);
        const osc   = this._osc('sine', freq, g);

        // Add slight detune for cosmic feel
        const osc2 = this._osc('sine', freq * 1.005, g);

        const now = this.ctx.currentTime + delay;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.18, now + 0.02);
        g.gain.linearRampToValueAtTime(0.0,  now + 0.5);

        osc.start(now);
        osc.stop(now + 0.55);
        osc2.start(now);
        osc2.stop(now + 0.55);
      });

      // Deep bass punch
      const bg  = this._gain(0.0);
      const bas = this._osc('sawtooth', 55, bg);
      this._envelope(bg, 0.4, 0.005, 0.1, 0.1, 0.4);
      bas.start();
      bas.stop(this.ctx.currentTime + 0.6);

      // Noise shimmer
      const ng = this._gain(0.0);
      this._envelope(ng, 0.12, 0.01, 0.1, 0.0, 0.4);
      const ns = this._noise(0.6, ng);
      ns.start();
      ns.stop(this.ctx.currentTime + 0.6);

    } catch (_) {}
  }

  // ============================================================
  // LEVEL UP — ascending dimensional tone sweep
  // ============================================================
  playLevelUp() {
    try {
      const steps = [261, 329, 392, 523, 659, 880];

      steps.forEach((freq, i) => {
        const delay = i * 0.09;
        const g     = this._gain(0.0);
        const osc   = this._osc('triangle', freq, g);

        const now = this.ctx.currentTime + delay;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.2,  now + 0.02);
        g.gain.linearRampToValueAtTime(0.12, now + 0.15);
        g.gain.linearRampToValueAtTime(0.0,  now + 0.4);

        osc.start(now);
        osc.stop(now + 0.45);
      });

      // Shimmer top layer
      const g2   = this._gain(0.0);
      const osc2 = this._osc('sine', 1760, g2);
      osc2.frequency.linearRampToValueAtTime(
        2200,
        this.ctx.currentTime + 0.5
      );
      this._envelope(g2, 0.08, 0.05, 0.2, 0.05, 0.3);
      osc2.start();
      osc2.stop(this.ctx.currentTime + 0.6);

    } catch (_) {}
  }

  // ============================================================
  // GAME OVER — deep dimensional collapse
  // ============================================================
  playGameOver() {
    try {
      // Descending tone
      const g1   = this._gain(0.0);
      const osc1 = this._osc('sawtooth', 440, g1);
      osc1.frequency.exponentialRampToValueAtTime(
        55,
        this.ctx.currentTime + 1.2
      );
      this._envelope(g1, 0.3, 0.01, 0.3, 0.15, 0.8);
      osc1.start();
      osc1.stop(this.ctx.currentTime + 1.4);

      // Low rumble
      const g2   = this._gain(0.0);
      const osc2 = this._osc('sine', 60, g2);
      osc2.frequency.linearRampToValueAtTime(
        30,
        this.ctx.currentTime + 1.0
      );
      this._envelope(g2, 0.4, 0.02, 0.4, 0.1, 0.6);
      osc2.start();
      osc2.stop(this.ctx.currentTime + 1.2);

      // Noise decay
      const g3 = this._gain(0.0);
      this._envelope(g3, 0.15, 0.01, 0.2, 0.05, 1.0);
      const ns = this._noise(1.5, g3);
      ns.start();
      ns.stop(this.ctx.currentTime + 1.5);

    } catch (_) {}
  }

  // ============================================================
  // MENU CLICK — clean UI tap
  // ============================================================
  playMenuClick() {
    try {
      const g   = this._gain(0.0);
      const osc = this._osc('sine', 600, g);
      this._envelope(g, 0.15, 0.002, 0.04, 0.0, 0.06);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (_) {}
  }

  // ============================================================
  // MENU HOVER — subtle high tick
  // ============================================================
  playMenuHover() {
    try {
      const g   = this._gain(0.0);
      const osc = this._osc('sine', 900, g);
      this._envelope(g, 0.07, 0.001, 0.02, 0.0, 0.03);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (_) {}
  }
}