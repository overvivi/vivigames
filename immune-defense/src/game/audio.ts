const MUTE_KEY = 'immuneDefenseMute_v1';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = false;
  // 置き場の他のゲームと揃えて、音の入切を覚えておく
  muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();

  setMuted(v: boolean) {
    this.muted = v;
    try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch { /* 保存できなくても遊べる */ }
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.enabled = true;
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1, slideFreq?: number) {
    if (!this.enabled || !this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playNoise(duration: number, vol = 0.1) {
    if (!this.enabled || !this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    // Filter noise
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  shoot() {
    this.playTone(600, 'square', 0.1, 0.05, 300);
  }

  hit() {
    this.playNoise(0.05, 0.1);
  }

  die() {
    this.playNoise(0.2, 0.2);
    this.playTone(100, 'sawtooth', 0.2, 0.1, 50);
  }

  baseHit() {
    this.playTone(200, 'square', 0.5, 0.3, 50);
    this.playNoise(0.4, 0.2);
  }

  build() {
    this.playTone(400, 'sine', 0.1, 0.1, 600);
    setTimeout(() => this.playTone(600, 'sine', 0.2, 0.1, 800), 50);
  }

  upgrade() {
    this.playTone(500, 'square', 0.1, 0.1, 800);
    setTimeout(() => this.playTone(800, 'square', 0.1, 0.1, 1200), 100);
    setTimeout(() => this.playTone(1200, 'square', 0.2, 0.1, 1600), 200);
  }
}

export const soundManager = new SoundManager();
