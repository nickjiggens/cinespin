// Synthesized Web Audio API sound effects for realistic ticks, whooshes, and victory chimes
// Zero external asset dependencies - works instantly, reliably, and offline

class SoundController {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('cinespin_muted') === 'true';
    this.lastTickTime = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('cinespin_muted', this.isMuted);
    return this.isMuted;
  }

  // Satisfying mechanical wheel peg tick
  playTick(frequencyMultiplier = 1) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Debounce very high frequency ticks to prevent distortion
    if (now - this.lastTickTime < 0.02) return;
    this.lastTickTime = now;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      // Crisp mechanical snap pitch
      const freq = 680 * frequencyMultiplier + Math.random() * 80;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      // AudioContext policy safe fallback
    }
  }

  // Dramatic spin start whoosh
  playSpinStart() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.35);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.46);
    } catch (e) {}
  }

  // Grand celebration win chord & sparkle
  playWinnerFanfare() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // Majestic chord: C5, E5, G5, C6 (523Hz, 659Hz, 784Hz, 1046Hz)
      const chord = [523.25, 659.25, 783.99, 1046.50];

      chord.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        const startTime = now + i * 0.08;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.18, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 1.25);
      });

      // Shimmer sparkles
      for (let s = 0; s < 5; s++) {
        const sparkleOsc = this.ctx.createOscillator();
        const sparkleGain = this.ctx.createGain();
        const sTime = now + 0.35 + s * 0.09;

        sparkleOsc.type = 'triangle';
        sparkleOsc.frequency.setValueAtTime(1200 + s * 220, sTime);

        sparkleGain.gain.setValueAtTime(0.08, sTime);
        sparkleGain.gain.exponentialRampToValueAtTime(0.001, sTime + 0.25);

        sparkleOsc.connect(sparkleGain);
        sparkleGain.connect(this.ctx.destination);

        sparkleOsc.start(sTime);
        sparkleOsc.stop(sTime + 0.26);
      }
    } catch (e) {}
  }
}

export const sounds = new SoundController();
