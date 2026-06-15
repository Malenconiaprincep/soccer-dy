type WaveType = OscillatorType;

interface ToneOptions {
  freq: number;
  duration: number;
  type?: WaveType;
  volume?: number;
  attack?: number;
  release?: number;
  detune?: number;
  delay?: number;
}

export type SoundName = 'tap' | 'confirm' | 'reveal' | 'select' | 'kickoff' | 'goal' | 'danger' | 'reward' | 'win' | 'lose';

type MiniAudioContext = {
  src?: string;
  volume?: number;
  obeyMuteSwitch?: boolean;
  currentTime?: number;
  play: () => void;
  stop?: () => void;
};

type MiniAudioApi = {
  tt?: {
    createInnerAudioContext?: () => MiniAudioContext;
  };
};

export class SoundFx {
  private context?: AudioContext;
  private master?: GainNode;
  private musicGain?: GainNode;
  private musicTimer?: number;
  private musicStep = 0;
  private unlocked = false;
  private miniTapAudio?: MiniAudioContext;

  installUnlock(target: HTMLElement) {
    const unlock = () => void this.unlock();
    target.addEventListener('pointerdown', unlock, { passive: true });
    target.addEventListener('touchstart', unlock, { passive: true });
  }

  play(name: SoundName) {
    if (!this.ensureContext()) {
      if (name === 'tap' || name === 'confirm' || name === 'select') this.playMiniTap();
      return;
    }
    const context = this.context;
    if (!context) return;
    if (context.state === 'suspended') void context.resume();
    if (this.unlocked) this.startMusic();

    if (name === 'tap') this.tap();
    if (name === 'confirm') this.confirm();
    if (name === 'reveal') this.reveal();
    if (name === 'select') this.select();
    if (name === 'kickoff') this.kickoff();
    if (name === 'goal') this.goal();
    if (name === 'danger') this.danger();
    if (name === 'reward') this.reward();
    if (name === 'win') this.win();
    if (name === 'lose') this.lose();
  }

  private async unlock() {
    if (!this.ensureContext()) return;
    const context = this.context;
    if (!context) return;
    if (this.unlocked) return;
    await context.resume();
    this.unlocked = true;
    this.tap(0.18);
    this.startMusic();
  }

  startMusic() {
    if (this.musicTimer || !this.ensureContext() || !this.context || !this.master) return;
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0.085;
    this.musicGain.connect(this.master);
    this.scheduleMusicPattern();
    this.musicTimer = window.setInterval(() => this.scheduleMusicPattern(), 1920);
  }

  private ensureContext() {
    if (this.context) return true;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return false;
    this.context = new AudioCtor();
    this.master = this.context.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.context.destination);
    return true;
  }

  private scheduleMusicPattern() {
    if (!this.context || !this.musicGain) return;
    const start = this.context.currentTime + 0.08;
    const root = 196;
    const chords = [
      [root, root * 1.5, root * 2],
      [164.81, 246.94, 329.63],
      [174.61, 261.63, 349.23],
      [146.83, 220, 293.66]
    ];
    const chord = chords[this.musicStep % chords.length];

    this.musicTone(chord[0] / 2, 0.42, 0.12, start, 'sine');
    this.musicTone(chord[0] / 2, 0.24, 0.08, start + 0.96, 'sine');
    chord.forEach((freq, index) => {
      this.musicTone(freq, 1.55, 0.035, start + index * 0.018, 'triangle');
      this.musicTone(freq * 2, 0.16, 0.026, start + 0.48 + index * 0.045, 'sine');
    });

    for (let beat = 0; beat < 4; beat += 1) {
      const t = start + beat * 0.48;
      this.musicKick(t, beat % 2 === 0 ? 0.2 : 0.13);
      this.musicHat(t + 0.24, 0.035);
    }
    this.musicCrowd(start + 0.1);
    this.musicStep += 1;
  }

  private musicTone(freq: number, duration: number, volume: number, start: number, type: WaveType) {
    if (!this.context || !this.musicGain) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(type === 'sine' ? 420 : 1400, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private musicKick(start: number, volume: number) {
    if (!this.context || !this.musicGain) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, start);
    osc.frequency.exponentialRampToValueAtTime(46, start + 0.16);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(start);
    osc.stop(start + 0.22);
  }

  private musicHat(start: number, volume: number) {
    if (!this.context || !this.musicGain) return;
    const sampleCount = Math.floor(this.context.sampleRate * 0.05);
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 3800;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    source.start(start);
  }

  private musicCrowd(start: number) {
    if (!this.context || !this.musicGain) return;
    const duration = 1.5;
    const sampleCount = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.18;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.6;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.018, start + 0.35);
    gain.gain.linearRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    source.start(start);
  }

  private tap(volume = 0.26) {
    if (this.playMiniTap()) return;
    this.tone({ freq: 620, duration: 0.045, type: 'triangle', volume, release: 0.035 });
    this.noise(0.035, 0.035, 1200, 0);
  }

  private playMiniTap() {
    const tt = (globalThis as typeof globalThis & MiniAudioApi).tt;
    if (!tt?.createInnerAudioContext) return false;
    try {
      const audio = this.miniTapAudio ?? tt.createInnerAudioContext();
      this.miniTapAudio = audio;
      audio.src = 'assets/audio/button-click.wav';
      audio.volume = 0.55;
      audio.obeyMuteSwitch = true;
      if (typeof audio.currentTime === 'number') audio.currentTime = 0;
      audio.stop?.();
      audio.play();
      return true;
    } catch {
      // Audio is a nice-to-have; never block gameplay on platform audio quirks.
      return false;
    }
  }

  private confirm() {
    this.sequence([
      { freq: 440, duration: 0.055, type: 'triangle', volume: 0.22 },
      { freq: 660, duration: 0.07, type: 'triangle', volume: 0.24, delay: 0.055 }
    ]);
  }

  private reveal() {
    this.gliss(220, 980, 0.42, 0.2, 'sine');
    this.sequence([
      { freq: 740, duration: 0.08, type: 'triangle', volume: 0.18, delay: 0.18 },
      { freq: 1110, duration: 0.12, type: 'triangle', volume: 0.18, delay: 0.28 }
    ]);
    this.noise(0.28, 0.05, 5000, 0.08);
  }

  private select() {
    this.sequence([
      { freq: 520, duration: 0.06, type: 'square', volume: 0.16 },
      { freq: 780, duration: 0.07, type: 'triangle', volume: 0.22, delay: 0.065 },
      { freq: 1040, duration: 0.1, type: 'triangle', volume: 0.18, delay: 0.14 }
    ]);
  }

  private kickoff() {
    this.tone({ freq: 130, duration: 0.11, type: 'sine', volume: 0.32, release: 0.09 });
    this.noise(0.08, 0.045, 180, 0.02);
  }

  private goal() {
    this.sequence([
      { freq: 392, duration: 0.1, type: 'triangle', volume: 0.22 },
      { freq: 523, duration: 0.1, type: 'triangle', volume: 0.24, delay: 0.09 },
      { freq: 659, duration: 0.13, type: 'triangle', volume: 0.26, delay: 0.18 },
      { freq: 784, duration: 0.22, type: 'triangle', volume: 0.25, delay: 0.29 }
    ]);
    this.noise(0.46, 0.075, 3600, 0.08);
  }

  private danger() {
    this.sequence([
      { freq: 180, duration: 0.12, type: 'sawtooth', volume: 0.17 },
      { freq: 140, duration: 0.16, type: 'sawtooth', volume: 0.2, delay: 0.14 }
    ]);
  }

  private reward() {
    this.sequence([
      { freq: 880, duration: 0.07, type: 'triangle', volume: 0.18 },
      { freq: 1175, duration: 0.08, type: 'triangle', volume: 0.16, delay: 0.08 },
      { freq: 1568, duration: 0.16, type: 'triangle', volume: 0.14, delay: 0.16 }
    ]);
  }

  private win() {
    this.sequence([
      { freq: 523, duration: 0.11, type: 'triangle', volume: 0.2 },
      { freq: 659, duration: 0.11, type: 'triangle', volume: 0.2, delay: 0.11 },
      { freq: 784, duration: 0.14, type: 'triangle', volume: 0.22, delay: 0.22 },
      { freq: 1047, duration: 0.32, type: 'triangle', volume: 0.2, delay: 0.36 }
    ]);
    this.noise(0.4, 0.04, 4200, 0.2);
  }

  private lose() {
    this.sequence([
      { freq: 330, duration: 0.16, type: 'triangle', volume: 0.18 },
      { freq: 247, duration: 0.28, type: 'triangle', volume: 0.18, delay: 0.16 }
    ]);
  }

  private sequence(tones: ToneOptions[]) {
    tones.forEach((tone) => this.tone(tone));
  }

  private tone(options: ToneOptions) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime + (options.delay ?? 0);
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(options.freq, now);
    if (options.detune) osc.detune.setValueAtTime(options.detune, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.2, now + (options.attack ?? 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration + (options.release ?? 0.08));
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + options.duration + (options.release ?? 0.1) + 0.02);
  }

  private gliss(from: number, to: number, duration: number, volume: number, type: WaveType) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  private noise(duration: number, volume: number, cutoff: number, delay: number) {
    if (!this.context || !this.master) return;
    const sampleCount = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }

    const now = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
