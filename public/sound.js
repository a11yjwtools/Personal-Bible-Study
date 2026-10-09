// Motor de Audio Procedural Web Audio API para Saber y Ganar y El Rosco
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.musicPlaying = false;
    this.musicInterval = null;
    this.volume = 0.5;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && this.musicPlaying) {
      this.stopBackgroundMusic();
      this.musicPlaying = true;
    } else if (!this.muted && this.musicPlaying) {
      this.startBackgroundMusic();
    }
    return this.muted;
  }

  playClick() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(this.volume * 0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  // Sonido de "Pasapalabra": tono ágil doble
  playPass() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;

    [600, 750].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(this.volume * 0.25, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.09);
    });
  }

  playCorrect() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(this.volume * 0.35, now + idx * 0.07 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.65);
    });
  }

  playWrong() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';

    osc1.frequency.setValueAtTime(180, now);
    osc1.frequency.linearRampToValueAtTime(130, now + 0.4);

    osc2.frequency.setValueAtTime(185, now);
    osc2.frequency.linearRampToValueAtTime(125, now + 0.4);

    gain.gain.setValueAtTime(this.volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  }

  // Sonido de tiempo agotado
  playTimeUp() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.8);

    gain.gain.setValueAtTime(this.volume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.85);
  }

  playVictory() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const sequence = [
      { f: 392.00, t: 0, d: 0.15 },
      { f: 523.25, t: 0.18, d: 0.15 },
      { f: 659.25, t: 0.36, d: 0.18 },
      { f: 783.99, t: 0.56, d: 0.25 },
      { f: 659.25, t: 0.85, d: 0.15 },
      { f: 1046.50, t: 1.05, d: 0.8 }
    ];

    sequence.forEach(item => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(item.f, now + item.t);

      gain.gain.setValueAtTime(0, now + item.t);
      gain.gain.linearRampToValueAtTime(this.volume * 0.4, now + item.t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + item.t + item.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + item.t);
      osc.stop(now + item.t + item.d + 0.05);
    });
  }

  startBackgroundMusic() {
    if (this.musicPlaying) return;
    this.init();
    this.musicPlaying = true;
    let step = 0;
    const bassScale = [110, 110, 130.81, 123.47];

    this.musicInterval = setInterval(() => {
      if (this.muted || !this.musicPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;

      if (step % 2 === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        const freq = bassScale[Math.floor(step / 4) % bassScale.length];

        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(freq, now);

        bassGain.gain.setValueAtTime(this.volume * 0.12, now);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.25);
      }

      const tickOsc = this.ctx.createOscillator();
      const tickGain = this.ctx.createGain();
      tickOsc.type = 'triangle';
      tickOsc.frequency.setValueAtTime(step % 4 === 0 ? 800 : 600, now);

      tickGain.gain.setValueAtTime(this.volume * 0.03, now);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      tickOsc.connect(tickGain);
      tickGain.connect(this.ctx.destination);
      tickOsc.start(now);
      tickOsc.stop(now + 0.04);

      step = (step + 1) % 16;
    }, 280);
  }

  stopBackgroundMusic() {
    this.musicPlaying = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

window.soundEngine = new SoundEngine();
