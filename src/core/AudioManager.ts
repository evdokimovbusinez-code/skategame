import { gameEvents } from "./GameEvents";

/**
 * Lightweight procedural SFX via WebAudio — no asset files. Each effect is a couple of
 * oscillator/noise nodes with an envelope, tuned to read as arcade feedback rather than
 * realism (period-appropriate for the PS2 vibe).
 *
 * TODO(audio-assets): when real recorded SFX land in public/assets/audio, swap these
 * synth calls for buffered samples behind the same play* methods — call sites stay put.
 *
 * The AudioContext is created lazily on first user gesture (browser autoplay policy);
 * until then every play call is a safe no-op.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private grindNoise: AudioBufferSourceNode | null = null;
  private grindGain: GainNode | null = null;
  private rollGain: GainNode | null = null;
  private sprayNoise: AudioBufferSourceNode | null = null;

  constructor() {
    const unlock = () => {
      if (!this.ctx) {
        try {
          this.ctx = new AudioContext();
        } catch {
          this.ctx = null; // audio unavailable — every play call stays a no-op
        }
      }
      this.ctx?.resume();
    };
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("pointerdown", unlock, { once: true });

    gameEvents.on("trick", ({ name }) => {
      if (name === "OLLIE") this.playPop();
      if (name === "KICKFLIP") this.playPop(1.4);
    });
    gameEvents.on("cleanLanding", ({ hard }) => this.playThud(hard ? 1 : 0.55));
    gameEvents.on("bail", () => this.playBail());
    gameEvents.on("grindStart", () => this.startGrindLoop());
    gameEvents.on("grindEnd", () => this.stopGrindLoop());
    gameEvents.on("missionComplete", () => this.playMissionComplete());
    gameEvents.on("ui", ({ kind }) => {
      if (kind === "click") this.playClick();
      if (kind === "spray-start") this.startSpray();
      if (kind === "spray-stop") this.stopSpray();
    });
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private blip(freq: number, duration: number, type: OscillatorType, volume: number, freqEnd?: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private burst(duration: number, volume: number, filterFreq: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }

  playPop(pitchMul = 1): void {
    this.blip(420 * pitchMul, 0.09, "square", 0.12, 720 * pitchMul);
  }

  playThud(strength: number): void {
    this.blip(120, 0.12, "sine", 0.22 * strength, 45);
    this.burst(0.08, 0.1 * strength, 500);
  }

  playBail(): void {
    this.blip(90, 0.3, "sawtooth", 0.2, 30);
    this.burst(0.25, 0.18, 800);
  }

  playClick(): void {
    this.blip(900, 0.04, "square", 0.07);
  }

  playMissionComplete(): void {
    if (!this.ctx) return;
    [440, 554, 659, 880].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.16, "triangle", 0.12), i * 110);
    });
  }

  private startGrindLoop(): void {
    if (!this.ctx || this.grindNoise) return;
    const ctx = this.ctx;
    this.grindNoise = ctx.createBufferSource();
    this.grindNoise.buffer = this.noiseBuffer(1);
    this.grindNoise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2600;
    this.grindGain = ctx.createGain();
    this.grindGain.gain.value = 0.06;
    this.grindNoise.connect(filter).connect(this.grindGain).connect(ctx.destination);
    this.grindNoise.start();
  }

  private stopGrindLoop(): void {
    this.grindNoise?.stop();
    this.grindNoise = null;
    this.grindGain = null;
  }

  private startSpray(): void {
    if (!this.ctx || this.sprayNoise) return;
    const ctx = this.ctx;
    this.sprayNoise = ctx.createBufferSource();
    this.sprayNoise.buffer = this.noiseBuffer(1);
    this.sprayNoise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 3500;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    this.sprayNoise.connect(filter).connect(gain).connect(ctx.destination);
    this.sprayNoise.start();
  }

  private stopSpray(): void {
    this.sprayNoise?.stop();
    this.sprayNoise = null;
  }

  /** Skate roll loop volume follows ground speed; call every frame. */
  setRollIntensity(frac: number): void {
    if (!this.ctx) return;
    if (!this.rollGain) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(1);
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 300;
      this.rollGain = ctx.createGain();
      this.rollGain.gain.value = 0;
      src.connect(filter).connect(this.rollGain).connect(ctx.destination);
      src.start();
    }
    this.rollGain.gain.value = 0.09 * frac;
  }
}
