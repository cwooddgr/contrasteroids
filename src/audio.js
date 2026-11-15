// All sound is synthesized with WebAudio; there are no audio files.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // Browsers only allow audio after a user gesture; call this from a keydown.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Continuous voices, gated by gain.
    this.thrustGain = this.loopNoise(380, 0);
    this.skiffVoice = this.loopTone('sawtooth', 140, 7, 18, 0);
    this.hunterVoice = this.loopTone('square', 520, 13, 60, 0);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  loopNoise(cutoff, level) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    return g;
  }

  loopTone(type, freq, lfoRate, lfoDepth, level) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = lfoDepth;
    lfo.connect(lfoGain).connect(osc.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(f).connect(g).connect(this.master);
    osc.start();
    lfo.start();
    return g;
  }

  setLevel(gainNode, level) {
    if (!this.ctx || !gainNode) return;
    gainNode.gain.setTargetAtTime(level, this.ctx.currentTime, 0.03);
  }

  thrust(on) { this.setLevel(this.thrustGain, on ? 0.35 : 0); }
  skiff(on) { this.setLevel(this.skiffVoice, on ? 0.06 : 0); }
  hunter(on) { this.setLevel(this.hunterVoice, on ? 0.025 : 0); }

  silenceLoops() {
    this.thrust(false);
    this.skiff(false);
    this.hunter(false);
  }

  tone(type, f0, f1, dur, level, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  burst(cutoff0, cutoff1, dur, level) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff0, t);
    f.frequency.exponentialRampToValueAtTime(cutoff1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  shot() { this.tone('square', 1100, 180, 0.11, 0.08); }
  enemyShot() { this.tone('triangle', 700, 300, 0.18, 0.12); }
  explode(size) { this.burst(400 + 2400 / size, 60, 0.25 + size * 0.22, 0.5); }
  beat(high) { this.tone('triangle', high ? 62 : 52, high ? 58 : 48, 0.13, 0.45); }
  mineBeep() { this.tone('sine', 1600, 1500, 0.06, 0.05); }
  hyperspace() { this.tone('sine', 180, 1400, 0.35, 0.12); }
  extraLife() {
    [660, 880, 1100, 1320].forEach((f, i) => this.tone('square', f, f, 0.09, 0.06, i * 0.08));
  }
}
