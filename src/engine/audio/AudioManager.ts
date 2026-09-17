/**
 * AudioManager — Web Audio API engine for LithoDrop.
 *
 * Architecture:
 *   - Single AudioContext shared across all audio (unlocked on first user gesture)
 *   - Master gain → SFX bus → individual sources
 *   - Music bus (procedurally generated ambient drone using OscillatorNodes)
 *   - All sounds are programmatic (no external .mp3/.ogg files required)
 *     so the game ships as pure code with zero audio assets.
 *
 * Sounds:
 *   - Thruster: bandpass-filtered white noise with LFO pitch modulation
 *   - RCS: short burst of filtered noise
 *   - Impact: percussive decay with pitch-swept sine
 *   - LandingSuccess: triumphant 3-note chord arpeggio
 *   - ModuleSnap: satisfying "clunk" with short reverb tail
 *   - PowerUp: ascending sine sweep
 *   - Alarm: repeating sawtooth pulse for bankruptcy/critical damage
 *   - BuildAmbient: low frequency drone with slow filter sweep
 *
 * Usage:
 *   const audio = new AudioManager();
 *   audio.unlock(); // call from a click/tap handler
 *   audio.playThruster(throttle); // call each frame while thrusting
 *   audio.stopThruster();
 *   audio.playImpact(velocityMs);
 */

type BusName = "sfx" | "music" | "ui";

interface AudioBus {
  gain: GainNode;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private buses: Partial<Record<BusName, AudioBus>> = {};
  private masterGain: GainNode | null = null;

  // Persistent nodes for looping sounds
  private thrusterNodes: {
    noise: AudioBufferSourceNode;
    filter: BiquadFilterNode;
    gain: GainNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
  } | null = null;

  private alarmNodes: {
    osc: OscillatorNode;
    gain: GainNode;
  } | null = null;

  private buildAmbientNodes: {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    filter: BiquadFilterNode;
    gain: GainNode;
  } | null = null;

  private _unlocked = false;

  get isUnlocked(): boolean {
    return this._unlocked;
  }

  /**
   * Unlock AudioContext on first user gesture.
   * Must be called from a click/pointerdown/keydown handler.
   */
  unlock(): void {
    if (this._unlocked) return;

    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);

    this.createBus("sfx", 0.9);
    this.createBus("music", 0.35);
    this.createBus("ui", 0.75);

    this._unlocked = true;

    // Start ambient drone for build phase
    // this.startBuildAmbient(); // uncomment when in build phase
  }

  private createBus(name: BusName, gainValue: number): void {
    if (!this.ctx || !this.masterGain) return;
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    gain.connect(this.masterGain);
    this.buses[name] = { gain };
  }

  private get sfxBus(): GainNode | null {
    return this.buses.sfx?.gain ?? null;
  }
  private get musicBus(): GainNode | null {
    return this.buses.music?.gain ?? null;
  }
  private get uiBus(): GainNode | null {
    return this.buses.ui?.gain ?? null;
  }

  // ─── Thruster ─────────────────────────────────────────────────────────────

  /**
   * Start or update the thruster sound.
   * @param throttle - [0–1] throttle level; adjusts filter cutoff and LFO rate
   */
  playThruster(throttle: number): void {
    if (!this.ctx || !this.sfxBus) return;

    if (!this.thrusterNodes) {
      this.thrusterNodes = this.createThrusterNodes();
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { filter, gain, lfo } = this.thrusterNodes!;

    // Throttle → filter cutoff: idle=200Hz, full=2000Hz
    const cutoff = 200 + throttle * 1800;
    filter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.05);

    // Throttle → volume: idle=0.05, full=0.4
    gain.gain.setTargetAtTime(0.05 + throttle * 0.35, this.ctx.currentTime, 0.05);

    // LFO rate increases with throttle (engine roughness)
    lfo.frequency.setTargetAtTime(4 + throttle * 12, this.ctx.currentTime, 0.1);
  }

  stopThruster(): void {
    if (!this.ctx || !this.thrusterNodes) return;
    const { gain } = this.thrusterNodes;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
  }

  private createThrusterNodes(): typeof this.thrusterNodes {
    const ctx = this.ctx!;
    const bus = this.sfxBus!;

    // White noise buffer (2 seconds, looped)
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 200;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    // LFO for engine rumble modulation
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 4;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 80; // modulates filter cutoff ±80Hz

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(bus);

    noise.start();
    lfo.start();

    return { noise, filter, gain, lfo, lfoGain };
  }

  // ─── RCS Burst ────────────────────────────────────────────────────────────

  playRCS(): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;

    const bufferSize = ctx.sampleRate * 0.06;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.value = 0.15;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.start();
  }

  // ─── Impact ───────────────────────────────────────────────────────────────

  /**
   * Play impact sound scaled by impact velocity.
   * Soft landing = low thud; fatal impact = loud crash.
   */
  playImpact(velocityMs: number, survived: boolean): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;

    const intensity = Math.min(velocityMs / 20, 1); // 0–1

    // Low thud: sine with fast decay
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 120 - intensity * 80; // 40–120 Hz

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.5 + intensity * 0.4, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3 + intensity * 0.4);

    // Noise burst component
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 400 + intensity * 1600;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.3 * intensity;

    osc.connect(oscGain);
    oscGain.connect(this.sfxBus);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxBus);

    osc.start();
    osc.stop(ctx.currentTime + 0.8);
    noiseSrc.start();

    // If survived, add a little triumph "ting" after 300ms
    if (survived && intensity < 0.7) {
      setTimeout(() => this.playModuleSnap(), 300);
    }
  }

  // ─── Module Snap ──────────────────────────────────────────────────────────

  playModuleSnap(): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;

    // Two-tone "clunk" — metallic snap
    const freqs = [440, 660];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25 - i * 0.05, ctx.currentTime + i * 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15 + i * 0.02);

      osc.connect(gain);
      gain.connect(this.sfxBus!);
      osc.start(ctx.currentTime + i * 0.01);
      osc.stop(ctx.currentTime + 0.2);
    });
  }

  // ─── Landing Success ──────────────────────────────────────────────────────

  playLandingSuccess(): void {
    if (!this.ctx || !this.uiBus) return;
    const ctx = this.ctx;

    // C major arpeggio: C5 E5 G5 C6
    const notes = [523.25, 659.25, 784.0, 1046.5];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.uiBus!);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  // ─── Power Up ─────────────────────────────────────────────────────────────

  playPowerUp(): void {
    if (!this.ctx || !this.uiBus) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.uiBus);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  // ─── Alarm (Bankruptcy / Critical Damage) ─────────────────────────────────

  startAlarm(): void {
    if (!this.ctx || !this.uiBus || this.alarmNodes) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 220;

    const gain = ctx.createGain();
    // Pulsing: on/off at 2Hz
    const now = ctx.currentTime;
    for (let i = 0; i < 20; i++) {
      gain.gain.setValueAtTime(0.25, now + i * 0.5);
      gain.gain.setValueAtTime(0, now + i * 0.5 + 0.2);
    }

    osc.connect(gain);
    gain.connect(this.uiBus);
    osc.start();

    this.alarmNodes = { osc, gain };
  }

  stopAlarm(): void {
    if (!this.alarmNodes) return;
    this.alarmNodes.osc.stop();
    this.alarmNodes = null;
  }

  // ─── Build Phase Ambient ──────────────────────────────────────────────────

  startBuildAmbient(): void {
    if (!this.ctx || !this.musicBus || this.buildAmbientNodes) return;
    const ctx = this.ctx;

    // Two detuned oscillators create a beating effect
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 55; // A1

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 55.8; // Slightly detuned

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;

    // Slow filter sweep (10-second cycle)
    filter.frequency.setValueAtTime(100, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(400, ctx.currentTime + 10);
    filter.frequency.linearRampToValueAtTime(100, ctx.currentTime + 20);

    const gain = ctx.createGain();
    gain.gain.value = 0.4;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);

    osc1.start();
    osc2.start();

    this.buildAmbientNodes = { osc1, osc2, filter, gain };
  }

  stopBuildAmbient(): void {
    if (!this.buildAmbientNodes || !this.ctx) return;
    const { osc1, osc2, gain } = this.buildAmbientNodes;
    const t = this.ctx.currentTime;
    gain.gain.setTargetAtTime(0, t, 0.5);
    setTimeout(() => {
      osc1.stop();
      osc2.stop();
      this.buildAmbientNodes = null;
    }, 2000);
  }

  // ─── UI Click ─────────────────────────────────────────────────────────────

  playUIClick(): void {
    if (!this.ctx || !this.uiBus) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 600;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.uiBus);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  // ─── Tax Escalation ───────────────────────────────────────────────────────

  playTaxEscalation(): void {
    if (!this.ctx || !this.uiBus) return;
    const ctx = this.ctx;

    // Descending 3-note motif (ominous)
    const notes = [440, 330, 220];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.15;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.uiBus!);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  // ─── Volume Control ───────────────────────────────────────────────────────

  setMasterVolume(value: number): void {
    if (!this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.ctx!.currentTime, 0.05);
  }

  setSFXVolume(value: number): void {
    if (!this.sfxBus) return;
    this.sfxBus.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.ctx!.currentTime, 0.05);
  }

  setMusicVolume(value: number): void {
    if (!this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.ctx!.currentTime, 0.05);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.stopThruster();
    this.stopAlarm();
    this.stopBuildAmbient();
    if (this.thrusterNodes) {
      this.thrusterNodes.noise.stop();
      this.thrusterNodes.lfo.stop();
      this.thrusterNodes = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

// Singleton — shared across the whole app
export const audioManager = new AudioManager();
