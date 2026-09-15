// Lightweight procedural SFX/music using the WebAudio API — no external
// asset pipeline required. Sounds are short synthesized blips/noise bursts.
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicIntensity = 0; // 0 = calm, 1 = full combat
    this._musicNodes = [];
    this.enabled = true;
  }

  _ensureCtx() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.ctx.destination);
  }

  resume() {
    this._ensureCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this._musicStarted) this._startMusic();
  }

  _tone(freq, duration, type = 'sine', gain = 0.4, detune = 0) {
    if (!this.enabled) return;
    this._ensureCtx();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  _noise(duration, gain = 0.3, filterFreq = 2000) {
    if (!this.enabled) return;
    this._ensureCtx();
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  // Directional pan for off-screen threat cues (angle in radians relative to camera forward).
  _panned(freq, duration, angle, type = 'sine', gain = 0.4) {
    if (!this.enabled) return;
    this._ensureCtx();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(g);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, Math.sin(angle)));
      g.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      g.connect(this.sfxGain);
    }
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  sfx = {
    meleeSwing: () => this._tone(180, 0.12, 'sawtooth', 0.25),
    meleeHit: () => this._noise(0.08, 0.35, 3000),
    rangedShot: () => this._tone(700, 0.08, 'square', 0.2),
    towerShot: () => this._tone(500, 0.06, 'triangle', 0.15),
    explosion: () => this._noise(0.4, 0.5, 800),
    abilityCast: () => this._tone(340, 0.25, 'sine', 0.3, 8),
    goldPickup: () => this._tone(1200, 0.08, 'sine', 0.2),
    towerPlace: () => this._tone(220, 0.15, 'square', 0.25),
    towerUpgrade: () => this._tone(440, 0.2, 'sine', 0.3),
    enemyDeath: () => this._tone(140, 0.15, 'sawtooth', 0.2),
    playerHurt: () => this._tone(90, 0.2, 'square', 0.3),
    baseAlert: (angle = 0) => this._panned(160, 0.5, angle, 'square', 0.35),
    towerDamagedAlert: (angle = 0) => this._panned(300, 0.3, angle, 'triangle', 0.25),
    waveStart: () => this._tone(260, 0.5, 'sawtooth', 0.3),
    bossRoar: () => this._noise(0.8, 0.6, 300),
    levelUp: () => this._tone(880, 0.4, 'sine', 0.35),
    dash: () => this._tone(900, 0.1, 'sine', 0.2)
  };

  _startMusic() {
    this._musicStarted = true;
    const step = () => {
      if (!this.enabled || !this.ctx) return;
      const base = 110 + this.musicIntensity * 40;
      this._tone(base, 0.6, 'sine', 0.05 + this.musicIntensity * 0.05);
      if (this.musicIntensity > 0.5) this._tone(base * 1.5, 0.3, 'triangle', 0.04);
      this._musicTimer = setTimeout(step, this.musicIntensity > 0.5 ? 500 : 1400);
    };
    step();
  }

  setIntensity(v) { this.musicIntensity = Math.max(0, Math.min(1, v)); }
}
