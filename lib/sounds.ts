"use client";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume: number = 0.15) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume: number = 0.05) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  source.start();
}

export const sounds = {
  bidPlaced() {
    playTone(880, 0.12, "sine", 0.1);
    setTimeout(() => playTone(1100, 0.08, "sine", 0.08), 60);
  },
  playerSold() {
    playTone(523, 0.15, "sine", 0.12);
    setTimeout(() => playTone(659, 0.15, "sine", 0.12), 100);
    setTimeout(() => playTone(784, 0.2, "sine", 0.15), 200);
    setTimeout(() => playNoise(0.1, 0.08), 350);
  },
  playerPassed() {
    playTone(330, 0.2, "sawtooth", 0.06);
    setTimeout(() => playTone(277, 0.3, "sawtooth", 0.04), 150);
  },
  rivalBid() {
    playTone(660, 0.08, "square", 0.06);
    setTimeout(() => playTone(770, 0.1, "square", 0.05), 80);
  },
  finalCall() {
    playTone(440, 0.15, "sine", 0.1);
    setTimeout(() => playTone(440, 0.15, "sine", 0.1), 200);
    setTimeout(() => playTone(440, 0.3, "sine", 0.12), 400);
  },
  tick() {
    playTone(1200, 0.03, "sine", 0.05);
  },
  error() {
    playTone(200, 0.3, "sawtooth", 0.08);
  }
};
