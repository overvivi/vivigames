const MUTE_KEY = 'solitaireMute_v1';

class AudioEngine {
  ctx: AudioContext | null = null;
  // 置き場の他のゲームと揃えて、音の入切を覚えておく
  muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();

  setMuted(v: boolean) {
    this.muted = v;
    try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch { /* 保存できなくても遊べる */ }
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playSlide(freqStart: number, freqEnd: number, duration: number, vol = 0.05) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Sine wave for a very soft, smooth sound
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);

    // Gentle attack and fade out to avoid clicks
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + duration * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playChime(freq: number, duration: number, vol = 0.05) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Triangle wave for a soft bell-like tone
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    // Quick attack, long fade
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Gentle, soft UI sounds
  deal() { this.playSlide(180, 120, 0.12, 0.04); }
  move() { this.playSlide(140, 90, 0.1, 0.06); }
  error() { this.playSlide(120, 110, 0.15, 0.03); } // Very soft, dull thud
  score() { this.playChime(700, 0.4, 0.04); }
  win() {
    this.playChime(400, 0.5, 0.05);
    setTimeout(() => this.playChime(500, 0.5, 0.05), 150);
    setTimeout(() => this.playChime(600, 0.6, 0.05), 300);
    setTimeout(() => this.playChime(800, 1.2, 0.06), 450);
  }
}

export const audio = new AudioEngine();
