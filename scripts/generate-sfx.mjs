import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sampleRate = 44100;
const outputDir = resolve('public/assets/audio');
let seed = 0x51f15e;

const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff;
};

const envelope = (time, duration, attack = 0.008, release = 0.08) => {
  const rise = Math.min(1, time / Math.max(0.001, attack));
  const fall = Math.min(1, (duration - time) / Math.max(0.001, release));
  return Math.max(0, Math.min(rise, fall));
};

const wave = (phase, type) => {
  if (type === 'square') return Math.sin(phase) >= 0 ? 1 : -1;
  if (type === 'saw') return 2 * ((phase / (Math.PI * 2)) % 1) - 1;
  if (type === 'triangle') return 2 * Math.asin(Math.sin(phase)) / Math.PI;
  return Math.sin(phase);
};

function render(duration, layers) {
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  for (const layer of layers) {
    const start = Math.floor((layer.start ?? 0) * sampleRate);
    const length = Math.floor(layer.duration * sampleRate);
    let filteredNoise = 0;
    for (let i = 0; i < length && start + i < samples.length; i += 1) {
      const time = i / sampleRate;
      const progress = time / layer.duration;
      const gain = (layer.gain ?? 0.25) * envelope(time, layer.duration, layer.attack, layer.release);
      let value;
      if (layer.type === 'noise') {
        const raw = random() * 2 - 1;
        const smoothing = layer.smoothing ?? 0.12;
        filteredNoise += (raw - filteredNoise) * smoothing;
        value = filteredNoise;
      } else {
        const from = layer.freq ?? 440;
        const to = layer.toFreq ?? from;
        const frequency = from * Math.pow(Math.max(0.001, to / from), progress);
        value = wave(Math.PI * 2 * frequency * time + (layer.phase ?? 0), layer.type ?? 'sine');
      }
      samples[start + i] += value * gain;
    }
  }
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const scale = peak > 0.92 ? 0.92 / peak : 1;
  const pcm = Buffer.alloc(samples.length * 2);
  samples.forEach((value, index) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value * scale)) * 32767), index * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const tone = (start, freq, duration, gain = 0.25, type = 'triangle', extra = {}) => ({ start, freq, duration, gain, type, ...extra });
const noise = (start, duration, gain = 0.12, smoothing = 0.12, extra = {}) => ({ start, duration, gain, smoothing, type: 'noise', ...extra });

const bgmDuration = 15.36;
const bgmLayers = [noise(0, bgmDuration, 0.025, 0.018, { attack: 0.7, release: 0.7 })];
const chords = [
  [98, 196, 246.94, 293.66],
  [82.41, 164.81, 196, 246.94],
  [87.31, 174.61, 220, 261.63],
  [73.42, 146.83, 196, 220]
];
for (let bar = 0; bar < 8; bar += 1) {
  const start = bar * 1.92;
  const chord = chords[bar % chords.length];
  chord.slice(1).forEach((frequency, index) => {
    bgmLayers.push(tone(start + index * 0.018, frequency, 1.72, 0.038, 'triangle', { attack: 0.08, release: 0.28 }));
  });
  for (let beat = 0; beat < 4; beat += 1) {
    const beatStart = start + beat * 0.48;
    bgmLayers.push(tone(beatStart, 112, 0.2, beat % 2 === 0 ? 0.14 : 0.09, 'sine', { toFreq: 46, attack: 0.002, release: 0.16 }));
    bgmLayers.push(tone(beatStart, chord[0], 0.3, 0.075, 'sine', { release: 0.18 }));
    bgmLayers.push(noise(beatStart + 0.24, 0.055, 0.035, 0.5, { release: 0.04 }));
    const note = chord[1 + ((beat + bar) % 3)] * 2;
    bgmLayers.push(tone(beatStart + 0.12, note, 0.17, 0.04, 'triangle', { attack: 0.015, release: 0.1 }));
  }
}

const sounds = {
  tap: [0.09, [tone(0, 760, 0.055, 0.28, 'triangle', { release: 0.04 }), noise(0, 0.035, 0.05, 0.35)]],
  confirm: [0.22, [tone(0, 440, 0.09, 0.22), tone(0.075, 660, 0.12, 0.25)]],
  select: [0.28, [tone(0, 520, 0.08, 0.18, 'square'), tone(0.07, 780, 0.1, 0.22), tone(0.15, 1040, 0.12, 0.18)]],
  reveal: [0.72, [tone(0, 210, 0.48, 0.2, 'sine', { toFreq: 1280, release: 0.12 }), noise(0.08, 0.34, 0.07, 0.2), tone(0.4, 880, 0.12, 0.2), tone(0.52, 1320, 0.18, 0.2)]],
  kickoff: [0.28, [tone(0, 145, 0.18, 0.42, 'sine', { toFreq: 48, release: 0.12 }), noise(0.01, 0.1, 0.14, 0.1)]],
  goal: [1.35, [tone(0, 392, 0.18, 0.2), tone(0.14, 523, 0.18, 0.22), tone(0.28, 659, 0.2, 0.24), tone(0.43, 784, 0.46, 0.27), noise(0.12, 1.1, 0.1, 0.025, { attack: 0.12, release: 0.35 })]],
  danger: [0.48, [tone(0, 190, 0.2, 0.2, 'saw', { toFreq: 145 }), tone(0.22, 145, 0.24, 0.23, 'saw', { toFreq: 112 })]],
  save: [0.55, [noise(0, 0.18, 0.18, 0.32), tone(0.03, 330, 0.2, 0.2, 'sine', { toFreq: 95 }), tone(0.22, 720, 0.2, 0.18, 'triangle')]],
  card: [0.38, [tone(0, 210, 0.12, 0.24, 'square'), tone(0.13, 170, 0.2, 0.25, 'square'), noise(0, 0.05, 0.05, 0.45)]],
  reward: [0.58, [tone(0, 880, 0.1, 0.2), tone(0.1, 1175, 0.12, 0.18), tone(0.22, 1568, 0.26, 0.17), noise(0.16, 0.3, 0.04, 0.4)]],
  win: [1.2, [tone(0, 523, 0.18, 0.2), tone(0.18, 659, 0.18, 0.21), tone(0.36, 784, 0.2, 0.23), tone(0.56, 1047, 0.52, 0.24), noise(0.3, 0.8, 0.06, 0.03)]],
  lose: [0.88, [tone(0, 330, 0.28, 0.2), tone(0.25, 247, 0.5, 0.2, 'triangle', { toFreq: 196 })]],
  whistle: [0.72, [tone(0, 2350, 0.25, 0.18, 'sine', { phase: 0.3 }), tone(0.02, 2480, 0.23, 0.12, 'sine'), tone(0.36, 2300, 0.28, 0.2, 'sine'), noise(0, 0.65, 0.025, 0.5)]],
  bgm: [bgmDuration, bgmLayers]
};

await mkdir(outputDir, { recursive: true });
for (const [name, [duration, layers]] of Object.entries(sounds)) {
  await writeFile(resolve(outputDir, `${name}.wav`), render(duration, layers));
}
console.info(`[audio] generated ${Object.keys(sounds).length} sound effects in ${outputDir}`);
