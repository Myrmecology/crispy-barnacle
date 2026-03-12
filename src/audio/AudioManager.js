/* ============================================================
   CRISPY BARNACLE — AudioManager.js
   Owns the AudioContext, loads the game music file,
   exposes analyser data for GPU audio reactivity,
   and delegates sound effects to SoundEffects.js
   ============================================================ */

import { SoundEffects } from './SoundEffects.js';

export class AudioManager {
  constructor() {
    this.ctx            = null;   // AudioContext
    this.masterGain     = null;   // Master volume node
    this.musicGain      = null;   // Music volume node
    this.sfxGain        = null;   // SFX volume node
    this.analyser       = null;   // Analyser for GPU reactivity
    this.analyserData   = null;   // Uint8Array frequency data
    this.musicBuffer    = null;   // Decoded music AudioBuffer
    this.musicSource    = null;   // Current BufferSourceNode
    this.sfx            = null;   // SoundEffects instance
    this.musicLoaded    = false;
    this.musicPlaying   = false;
    this.musicPaused    = false;
    this.pauseOffset    = 0;      // Track playback position for pause/resume
    this.startTime      = 0;
    this.audioLevel     = 0;      // Normalized 0–1 for GPU shader
    this.MUSIC_PATH     = 'assets/music/crispy-barnacle.mp3';
  }

  // ── Initialize audio graph ────────────────────────────────
  async init() {
    try {
      this._createContext();
      this._buildAudioGraph();
      this.sfx = new SoundEffects(this.ctx, this.sfxGain);
      await this._loadMusic();
    } catch (err) {
      console.warn('[AudioManager] Init warning:', err.message);
      // Audio failure is non-fatal — game still runs silently
    }
  }

  // ── Create AudioContext ───────────────────────────────────
  _createContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx({ sampleRate: 44100 });

    // Browsers suspend AudioContext until user gesture
    // We resume on first user interaction
    const resume = () => {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('click',   resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('click',   resume);
    window.addEventListener('keydown', resume);
  }

  // ── Build audio routing graph ─────────────────────────────
  _buildAudioGraph() {
    // Master gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);

    // Music gain
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.8;
    this.musicGain.connect(this.masterGain);

    // SFX gain
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.masterGain);

    // Analyser — feeds GPU shader with frequency data
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize            = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.connect(this.masterGain);

    this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);
  }

  // ── Load music file ───────────────────────────────────────
  async _loadMusic() {
    try {
      const response = await fetch(this.MUSIC_PATH);

      if (!response.ok) {
        console.warn('[AudioManager] Music file not found at:', this.MUSIC_PATH);
        console.warn('[AudioManager] Drop your file into assets/music/ and name it crispy-barnacle.mp3');
        return;
      }

      const arrayBuffer  = await response.arrayBuffer();
      this.musicBuffer   = await this.ctx.decodeAudioData(arrayBuffer);
      this.musicLoaded   = true;

      console.log('[AudioManager] Music loaded successfully.');
    } catch (err) {
      console.warn('[AudioManager] Could not load music:', err.message);
    }
  }

  // ── Start music playback ──────────────────────────────────
  startMusic() {
    if (!this.musicLoaded || this.musicPlaying) return;

    this._playMusicFrom(this.pauseOffset);
    this.musicPlaying = true;
    this.musicPaused  = false;

    console.log('[AudioManager] Music started.');
  }

  // ── Internal: play from offset ────────────────────────────
  _playMusicFrom(offset = 0) {
    if (!this.musicBuffer) return;

    // Disconnect previous source if any
    if (this.musicSource) {
      this.musicSource.disconnect();
      this.musicSource = null;
    }

    this.musicSource        = this.ctx.createBufferSource();
    this.musicSource.buffer = this.musicBuffer;
    this.musicSource.loop   = true;

    // Route: source → analyser → musicGain → masterGain → destination
    this.musicSource.connect(this.analyser);
    this.musicSource.connect(this.musicGain);

    this.musicSource.start(0, offset);
    this.startTime = this.ctx.currentTime - offset;

    // Handle natural end (if loop is ever disabled)
    this.musicSource.onended = () => {
      if (this.musicPlaying) {
        this.musicPlaying = false;
        this.pauseOffset  = 0;
      }
    };
  }

  // ── Stop music ────────────────────────────────────────────
  stopMusic() {
    if (!this.musicSource) return;

    try {
      this.musicSource.stop();
      this.musicSource.disconnect();
    } catch (_) {}

    this.musicSource  = null;
    this.musicPlaying = false;
    this.musicPaused  = false;
    this.pauseOffset  = 0;

    console.log('[AudioManager] Music stopped.');
  }

  // ── Pause music ───────────────────────────────────────────
  pauseMusic() {
    if (!this.musicPlaying || this.musicPaused) return;

    this.pauseOffset  = this.ctx.currentTime - this.startTime;
    this.musicPaused  = true;
    this.musicPlaying = false;

    try {
      this.musicSource.stop();
      this.musicSource.disconnect();
    } catch (_) {}

    this.musicSource = null;
    console.log('[AudioManager] Music paused at:', this.pauseOffset.toFixed(2), 's');
  }

  // ── Resume music ──────────────────────────────────────────
  resumeMusic() {
    if (!this.musicPaused) return;

    this._playMusicFrom(this.pauseOffset);
    this.musicPlaying = true;
    this.musicPaused  = false;

    console.log('[AudioManager] Music resumed from:', this.pauseOffset.toFixed(2), 's');
  }

  // ── Update — called every frame ───────────────────────────
  // Computes normalized audio level for the GPU shader
  update() {
    if (!this.analyser) return;

    this.analyser.getByteFrequencyData(this.analyserData);

    let sum = 0;
    for (let i = 0; i < this.analyserData.length; i++) {
      sum += this.analyserData[i];
    }

    const raw        = sum / this.analyserData.length / 255;
    // Smooth the value to avoid jitter in the shader
    this.audioLevel  = this.audioLevel * 0.85 + raw * 0.15;
  }

  // ── Volume controls ───────────────────────────────────────
  setMasterVolume(val) {
    if (!this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, val)),
      this.ctx.currentTime,
      0.05
    );
  }

  setMusicVolume(val) {
    if (!this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, val)),
      this.ctx.currentTime,
      0.05
    );
  }

  setSFXVolume(val) {
    if (!this.sfxGain) return;
    this.sfxGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, val)),
      this.ctx.currentTime,
      0.05
    );
  }

  // ── SFX passthroughs ─────────────────────────────────────
  playMove()      { this.sfx?.playMove();      }
  playRotate()    { this.sfx?.playRotate();    }
  playSoftDrop()  { this.sfx?.playSoftDrop();  }
  playHardDrop()  { this.sfx?.playHardDrop();  }
  playLineClear() { this.sfx?.playLineClear(); }
  playTetris()    { this.sfx?.playTetris();    }
  playLevelUp()   { this.sfx?.playLevelUp();   }
  playGameOver()  { this.sfx?.playGameOver();  }
  playMenuClick() { this.sfx?.playMenuClick(); }
  playMenuHover() { this.sfx?.playMenuHover(); }

  // ── Shutdown ──────────────────────────────────────────────
  shutdown() {
    this.stopMusic();
    this.ctx?.close();
    console.log('[AudioManager] Shutdown complete.');
  }
}