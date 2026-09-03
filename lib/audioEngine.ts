"use client";

let audioCtx: AudioContext | null = null;
let enabled = true;
let initialized = false;

let ambienceNodes: {
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
} | null = null;

let tensionOsc: OscillatorNode | null = null;
let tensionGain: GainNode | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function ensureCtx(): AudioContext | null {
  const c = ctx();
  if (c && c.state === "suspended") {
    c.resume().catch(() => {});
  }
  return c;
}

function formatCrore(amount: number): string {
  if (amount >= 100) return `${amount} crore`;
  if (amount >= 1) return `${amount} crore`;
  return `${Math.round(amount * 100)} lakh`;
}

function speak(text: string): void {
  if (!enabled || typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.05;
    utter.pitch = 1.1;
    utter.volume = 0.9;
    const voices = synth.getVoices();
    const english = voices.find(
      (v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("male")
    );
    if (english) utter.voice = english;
    else {
      const fallback = voices.find((v) => v.lang.startsWith("en"));
      if (fallback) utter.voice = fallback;
    }
    synth.cancel();
    synth.speak(utter);
  } catch {
    // SpeechSynthesis unavailable
  }
}

function speakAsync(text: string): Promise<void> {
  if (!enabled || typeof window === "undefined") return Promise.resolve();
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.05;
      utter.pitch = 1.1;
      utter.volume = 0.9;
      const voices = synth.getVoices();
      const fallback = voices.find((v) => v.lang.startsWith("en"));
      if (fallback) utter.voice = fallback;
      synth.cancel();
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      synth.speak(utter);
      setTimeout(resolve, 8000);
    } catch {
      resolve();
    }
  });
}

function createNoiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
  }
  return buf;
}

function playTone(
  c: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  volume: number = 0.15,
  delay: number = 0
) {
  if (!enabled) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + delay);
  gain.gain.setValueAtTime(volume, c.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    c.currentTime + delay + duration
  );
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + duration + 0.01);
}

function playNoiseBurst(
  c: AudioContext,
  duration: number,
  volume: number = 0.08,
  filterFreq: number = 2000,
  delay: number = 0
) {
  if (!enabled) return;
  const len = c.sampleRate * duration;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = 1 - i / len;
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    c.currentTime + delay + duration
  );
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(c.currentTime + delay);
}

export const audioEngine = {
  init(): void {
    if (initialized) return;
    initialized = true;
    ensureCtx();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.getVoices();
      } catch {
        // voices may not load immediately
      }
    }
  },

  setEnabled(on: boolean): void {
    enabled = on;
    if (!on) {
      this.stopAmbience();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
    }
  },

  isEnabled(): boolean {
    return enabled;
  },

  // ── Auctioneer Voice ────────────────────────────────────────

  announcePlayer(name: string, role: string): void {
    const roleMap: Record<string, string> = {
      BAT: "batsman",
      BOWL: "bowler",
      AR: "all-rounder",
      WK: "wicketkeeper-batsman",
    };
    const roleLabel = roleMap[role] || role;
    speak(`Now on the block, ${name}, the ${roleLabel}!`);
  },

  announceBid(amount: number, teamShortName?: string): void {
    const amt = formatCrore(amount);
    if (teamShortName) {
      speak(`${teamShortName} at ${amt}!`);
    } else {
      speak(`We have a bid of ${amt}!`);
    }
  },

  async announceCountdown(): Promise<void> {
    await speakAsync("Going once...");
    await new Promise((r) => setTimeout(r, 1200));
    await speakAsync("Going twice...");
    await new Promise((r) => setTimeout(r, 1000));
    await speakAsync("SOLD!");
  },

  announceSold(playerName: string, teamName: string, amount: number): void {
    speak(
      `${playerName} is SOLD to ${teamName} for ${formatCrore(amount)}!`
    );
  },

  announcePassed(playerName: string): void {
    speak(`Going... going... passed. ${playerName} goes unsold.`);
  },

  announceRivalBid(teamName: string, amount: number): void {
    speak(`${teamName} enters at ${formatCrore(amount)}!`);
  },

  // ── Crowd Ambience ─────────────────────────────────────────

  startAmbience(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    this.stopAmbience();

    const buffer = createNoiseBuffer(c, 8);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 400;
    filter.Q.value = 0.7;

    const gain = c.createGain();
    gain.gain.value = 0.012;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    source.start();

    ambienceNodes = { source, gain, filter };

    // Modulate the filter slightly for realism
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    (ambienceNodes as unknown as { lfo: OscillatorNode }).lfo = lfo;
  },

  stopAmbience(): void {
    if (ambienceNodes) {
      try {
        ambienceNodes.source.stop();
      } catch {
        // already stopped
      }
      try {
        (ambienceNodes as unknown as { lfo: OscillatorNode }).lfo?.stop();
      } catch {
        // ignore
      }
      ambienceNodes = null;
    }
  },

  crowdCheer(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;

    const buf = createNoiseBuffer(c, 1.5);
    const src = c.createBufferSource();
    src.buffer = buf;

    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1200;
    bp.Q.value = 0.5;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, c.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0.12, c.currentTime + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.5);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(c.destination);
    src.start();
    src.stop(c.currentTime + 1.5);

    // Add some tonal "woo" sounds
    playTone(c, 600, 0.3, "sine", 0.04, 0.1);
    playTone(c, 750, 0.25, "sine", 0.03, 0.2);
    playTone(c, 900, 0.2, "sine", 0.02, 0.3);
  },

  crowdMurmur(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;

    const buf = createNoiseBuffer(c, 2);
    const src = c.createBufferSource();
    src.buffer = buf;

    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 300;
    filter.Q.value = 0.6;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0.06, c.currentTime + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 2);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start();
    src.stop(c.currentTime + 2);
  },

  crowdGasp(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;

    const buf = createNoiseBuffer(c, 0.6);
    const src = c.createBufferSource();
    src.buffer = buf;

    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 800;
    bp.Q.value = 1.2;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(c.destination);
    src.start();
    src.stop(c.currentTime + 0.6);

    playTone(c, 250, 0.4, "sine", 0.05, 0);
  },

  setTension(level: number): void {
    const clamped = Math.max(0, Math.min(100, level));
    const c = ensureCtx();
    if (!c) return;

    if (clamped === 0) {
      if (tensionOsc) {
        try {
          tensionOsc.stop();
        } catch {
          // ignore
        }
        tensionOsc = null;
        tensionGain = null;
      }
      return;
    }

    if (!tensionOsc) {
      tensionOsc = c.createOscillator();
      tensionGain = c.createGain();
      tensionOsc.type = "sine";
      tensionOsc.frequency.value = 55;
      tensionGain.gain.value = 0;
      tensionOsc.connect(tensionGain);
      tensionGain.connect(c.destination);
      tensionOsc.start();
    }

    const vol = (clamped / 100) * 0.07;
    tensionGain!.gain.linearRampToValueAtTime(vol, c.currentTime + 0.3);

    const freq = 55 + (clamped / 100) * 25;
    tensionOsc!.frequency.linearRampToValueAtTime(freq, c.currentTime + 0.3);
  },

  // ── Effects ────────────────────────────────────────────────

  playGavel(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;

    playTone(c, 1800, 0.04, "sine", 0.25, 0);
    playTone(c, 900, 0.06, "sine", 0.15, 0.01);
    playNoiseBurst(c, 0.05, 0.15, 3000, 0);

    // Decay tail
    playTone(c, 400, 0.12, "sine", 0.08, 0.03);
  },

  playBidConfirm(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;

    playTone(c, 880, 0.08, "sine", 0.12, 0);
    playTone(c, 1320, 0.06, "sine", 0.1, 0.05);
  },

  playClockTick(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;

    playTone(c, 1200, 0.025, "sine", 0.06, 0);
    playTone(c, 900, 0.015, "sine", 0.04, 0.01);
  },

  playDramaticRumble(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(40, c.currentTime);
    osc.frequency.linearRampToValueAtTime(60, c.currentTime + 0.8);
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, c.currentTime + 0.4);
    gain.gain.linearRampToValueAtTime(0.14, c.currentTime + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.0);

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 120;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 1.0);
  },

  playSoldFanfare(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;

    // Ascending major chord arpeggio: C E G C E G
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    const durations = [0.12, 0.12, 0.12, 0.15, 0.15, 0.3];
    let time = 0;
    for (let i = 0; i < notes.length; i++) {
      playTone(c, notes[i], durations[i], "sine", 0.1, time);
      playTone(c, notes[i] * 0.5, durations[i], "triangle", 0.05, time);
      time += durations[i] * 0.7;
    }

    // Cheer burst on top
    playNoiseBurst(c, 0.8, 0.06, 2500, 0.1);

    // Final resolution chord
    playTone(c, 523.25, 0.4, "sine", 0.12, time + 0.05);
    playTone(c, 659.25, 0.4, "sine", 0.1, time + 0.05);
    playTone(c, 783.99, 0.4, "sine", 0.1, time + 0.05);
  },
};
