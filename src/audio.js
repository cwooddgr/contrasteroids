// All sound is synthesized with WebAudio; there are no audio files.
//
// Signal path: voices -> bus -> (dry + reverb send) -> compressor -> out.
// Sub-bass layers (roughly 25-60 Hz) carry the weight; a system with a
// subwoofer and bass management routes them to it (a browser can't address
// the LFE channel directly).
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // Browsers only allow audio after a user gesture; call this from a keydown,
  // or for touch from pointerup/touchend (pointerdown doesn't count as a
  // gesture for touch).
  unlock() {
    // Safari's default audio session is "ambient", which the iPhone's silent
    // switch mutes. A game should play like media.
    if (navigator.audioSession && navigator.audioSession.type !== 'playback') {
      try { navigator.audioSession.type = 'playback'; } catch {}
    }
    if (this.ctx) {
      // iOS can also leave the context "interrupted" (calls, Siri, backgrounding).
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 6;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    comp.connect(this.master).connect(ctx.destination);

    this.bus = ctx.createGain();
    this.bus.connect(comp);
    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(2.8, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    this.bus.connect(reverb).connect(wet).connect(comp);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.drive = ctx.createWaveShaper();
    this.drive.curve = this.driveCurve(3);
    this.drive.connect(this.bus);

    // Continuous voices, gated by gain.
    this.thrustGain = this.loopNoise(420, 0);
    this.thrustSub = this.loopNoise(95, 0);
    this.skiffVoice = this.loopTone('sawtooth', 140, 7, 18, 0);
    this.hunterVoice = this.loopTone('square', 520, 13, 60, 0);
    this.buildDrone();
  }

  // The haunting bed under play: a low fifth plus a slow-filtered saw, and a
  // thin high whistle that only surfaces as the wave nears its end.
  buildDrone() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.bus);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 6;
    filter.connect(out);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 120;
    lfo.connect(lfoDepth).connect(filter.frequency);
    lfo.start();
    for (const [type, freq, det, lvl] of [['sine', 41.2, 0, 0.7], ['sine', 61.7, 4, 0.35], ['sawtooth', 82.4, -6, 0.18], ['sawtooth', 82.4, 7, 0.18]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      const g = ctx.createGain();
      g.gain.value = lvl;
      o.connect(g).connect(filter);
      o.start();
    }
    const whistle = ctx.createOscillator();
    whistle.frequency.value = 1318.5;
    const vib = ctx.createOscillator();
    vib.frequency.value = 0.3;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = 9;
    vib.connect(vibDepth).connect(whistle.frequency);
    const whistleGain = ctx.createGain();
    whistleGain.gain.value = 0;
    whistle.connect(whistleGain).connect(this.bus);
    whistle.start();
    vib.start();
    this.droneParts = { out, filter, lfo, lfoDepth, whistleGain };
  }

  drone(on) {
    if (!this.droneParts || on === this.droneOn) return;
    this.droneOn = on;
    this.setLevel(this.droneParts.out, on ? 0.16 : 0, 0.6);
  }

  // t: 0 at the start of a wave, 1 when nearly cleared.
  tension(t) {
    const d = this.droneParts;
    if (!d || Math.abs(t - (this.lastTension ?? -1)) < 0.01) return;
    this.lastTension = t;
    const now = this.ctx.currentTime;
    d.filter.frequency.setTargetAtTime(220 + t * 700, now, 0.5);
    d.lfo.frequency.setTargetAtTime(0.08 + t * 0.7, now, 0.5);
    d.lfoDepth.gain.setTargetAtTime(120 + t * 300, now, 0.5);
    d.whistleGain.gain.setTargetAtTime(Math.max(0, t - 0.5) * 0.03, now, 0.8);
  }

  impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
    return buf;
  }

  driveCurve(k) {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return curve;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
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
    src.connect(f).connect(g).connect(this.bus);
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
    osc.connect(f).connect(g).connect(this.bus);
    osc.start();
    lfo.start();
    return g;
  }

  setLevel(gainNode, level, smooth = 0.03) {
    if (!this.ctx || !gainNode) return;
    gainNode.gain.setTargetAtTime(level, this.ctx.currentTime, smooth);
  }

  thrust(on) {
    this.setLevel(this.thrustGain, on ? 0.4 : 0);
    this.setLevel(this.thrustSub, on ? 1.0 : 0);
  }
  skiff(on) { this.setLevel(this.skiffVoice, on ? 0.06 : 0); }
  hunter(on) { this.setLevel(this.hunterVoice, on ? 0.025 : 0); }

  silenceLoops() {
    this.thrust(false);
    this.skiff(false);
    this.hunter(false);
    this.drone(false);
    if (this.droneParts) this.setLevel(this.droneParts.whistleGain, 0, 0.3);
  }

  // A pitched voice with an exponential sweep and decay. `out` defaults to the bus.
  tone(type, f0, f1, dur, level, delay = 0, out = this.bus, attack = 0.003) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // Filtered noise with a cutoff sweep and decay.
  burst(type, cutoff0, cutoff1, dur, level, delay = 0, q = 0.7, attack = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(cutoff0, t);
    f.frequency.exponentialRampToValueAtTime(cutoff1, t + dur);
    const g = ctx.createGain();
    if (attack > 0) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + attack);
    } else {
      g.gain.setValueAtTime(level, t);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  shot() {
    this.tone('square', 1500, 160, 0.12, 0.07);
    this.burst('highpass', 4000, 2000, 0.03, 0.12);
    this.tone('sine', 140, 50, 0.09, 0.35); // low kick so every shot has weight
  }

  enemyShot() {
    this.tone('sawtooth', 900, 200, 0.22, 0.07);
    this.tone('triangle', 450, 110, 0.22, 0.1);
  }

  // size: 1 small, 2 medium, 3 large (fractional is fine)
  explode(size) {
    const jitter = 0.9 + Math.random() * 0.2;
    this.burst('highpass', 3000, 1500, 0.05, 0.35); // crack
    this.burst('lowpass', (500 + 2000 / size) * jitter, 50, 0.4 + size * 0.35, 0.7); // body
    this.burst('bandpass', 900 * jitter, 120, 0.25 + size * 0.5, 0.25, 0.04, 1.5); // debris rattle
    this.tone('sine', (120 - size * 18) * jitter, 24, 0.5 + size * 0.45, 0.55 + size * 0.15); // sub boom
    this.tone('sine', (90 - size * 10) * jitter, 35, 0.25 + size * 0.2, 0.5, 0, this.drive); // driven thud
  }

  // Rocks thud and boom rather than bang: no high crack, a soft attack, and
  // everything pitched lower as the rock gets bigger. size: 1, 2, or 3.
  rockBreak(size) {
    const j = 0.9 + Math.random() * 0.2;
    const cutoff = [0, 700, 380, 200][size] * j;
    const subFrom = [0, 95, 68, 50][size] * j;
    const subTo = [0, 42, 30, 22][size];
    const len = [0, 0.45, 0.8, 1.3][size];
    this.burst('lowpass', cutoff, 40, len, 0.9, 0, 1.2, 0.012); // dull body
    this.tone('sine', subFrom, subTo, len * 1.1, 0.7 + size * 0.1, 0, this.bus, 0.008); // sub boom
    this.tone('sine', subFrom * 1.5, subTo * 1.2, len * 0.5, 0.35, 0, this.drive, 0.006); // thud you can hear on small speakers
  }

  alienDeath() {
    this.explode(2.2);
    // Metallic ring: inharmonic partials that hang in the reverb.
    [523, 811, 1307, 1907].forEach((f, i) => this.tone('sine', f, f * 0.97, 0.9 - i * 0.12, 0.07));
  }

  playerDeath() {
    this.explode(3.5);
    this.tone('sawtooth', 420, 30, 1.8, 0.16, 0.05, this.drive);
    this.burst('lowpass', 300, 30, 2.6, 0.7, 0.1); // long rumble
    this.tone('sine', 55, 22, 2.2, 0.8, 0.08); // sub tail
  }

  // The pulse walks a creeping four-note figure: E, E, G, F#.
  beat(step) {
    const f = [41.2, 41.2, 49, 46.25][step % 4];
    this.tone('sine', f * 1.6, f, 0.32, 0.95, 0, this.bus, 0.004);
    this.tone('sine', f * 1.2, f * 0.9, 0.18, 0.35, 0, this.drive); // overtone so small speakers hear it
  }

  waveStart() {
    // A slow low swell: detuned saws through an opening filter.
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(80, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 1.0);
    f.frequency.exponentialRampToValueAtTime(120, t + 2.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    f.connect(g).connect(this.bus);
    for (const [freq, det] of [[55, -8], [55, 8], [82.4, 0], [110, 5]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + 2.5);
    }
    this.tone('sine', 41, 41, 2.2, 0.6, 0, this.bus, 0.8);
  }

  mineBeep() { this.tone('sine', 1600, 1500, 0.06, 0.05); }

  hyperspace() {
    this.tone('sine', 120, 2400, 0.45, 0.14);
    this.burst('bandpass', 300, 6000, 0.45, 0.35, 0, 4);
    this.tone('sine', 70, 30, 0.4, 0.5);
  }

  extraLife() {
    [660, 880, 1100, 1320].forEach((f, i) => this.tone('square', f, f, 0.12, 0.06, i * 0.08));
  }
}
