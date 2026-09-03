"use client";

let audioCtx: AudioContext | null = null;
let enabled = true;
let initialized = false;

let ambienceNodes: {
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
} | null = null;

let tensionOsc: OscillatorNode | null = null;
let tensionGain: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch { return null; }
  }
  return audioCtx;
}

function ensureCtx(): AudioContext | null {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
  return c;
}

function formatCrore(amount: number): string {
  if (amount >= 100) return `${amount} crore`;
  if (amount >= 1) return `${amount} crore`;
  return `${Math.round(amount * 100)} lakh`;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pickVoice(preferred: "male" | "female"): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined") return undefined;
  const voices = window.speechSynthesis?.getVoices() ?? [];

  if (preferred === "male") {
    return voices.find((v) => v.lang.startsWith("en-IN"))
      || voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("google uk english male"))
      || voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("daniel"))
      || voices.find((v) => v.lang.startsWith("en"))
      || voices[0];
  }

  return voices.find((v) => v.lang.startsWith("hi"))
    || voices.find((v) => v.lang.startsWith("en-IN") && v.name.toLowerCase().includes("female"))
    || voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female"))
    || voices.find((v) => v.lang.startsWith("en"))
    || voices[0];
}

function speakNow(text: string, voiceType: "male" | "female", opts?: { rate?: number; pitch?: number; volume?: number }): Promise<void> {
  if (!enabled || typeof window === "undefined") return Promise.resolve();
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve();

  return new Promise((resolve) => {
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(voiceType);
    if (voice) utter.voice = voice;

    if (voiceType === "male") {
      utter.rate = opts?.rate ?? 1.0;
      utter.pitch = opts?.pitch ?? 1.0;
      utter.volume = opts?.volume ?? 1.0;
      utter.lang = "en-IN";
    } else {
      utter.rate = opts?.rate ?? 0.95;
      utter.pitch = opts?.pitch ?? 1.1;
      utter.volume = opts?.volume ?? 0.9;
      utter.lang = voice?.lang || "hi-IN";
    }

    let resolved = false;
    const finish = () => { if (!resolved) { resolved = true; resolve(); } };
    utter.onend = finish;
    utter.onerror = finish;
    synth.speak(utter);
    setTimeout(finish, 12000);
  });
}

function playTone(c: AudioContext, freq: number, duration: number, type: OscillatorType = "sine", volume: number = 0.15, delaySec: number = 0) {
  if (!enabled) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + delaySec);
  gain.gain.setValueAtTime(volume, c.currentTime + delaySec);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delaySec + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + delaySec);
  osc.stop(c.currentTime + delaySec + duration + 0.01);
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

export const audioEngine = {
  init(): void {
    if (initialized) return;
    initialized = true;
    ensureCtx();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis?.getVoices();
    }
  },

  setEnabled(on: boolean): void {
    enabled = on;
    if (!on) {
      this.stopAmbience();
      try { window.speechSynthesis?.cancel(); } catch {}
    }
  },

  isEnabled(): boolean { return enabled; },

  // ── AUCTIONEER (English Male) ──────────────────────────────

  async auctionIntro(): Promise<void> {
    await speakNow("Welcome to the IPL 2027 Mega Auction!", "male", { rate: 0.95 });
    await delay(800);
    await speakNow("Ladies and gentlemen, good evening. Ten franchises, over 160 players, and a total purse of 125 crore each.", "male", { rate: 0.92 });
    await delay(600);
    await speakNow("This is where champions are made. Let the bidding wars begin!", "male", { rate: 0.95 });
  },

  async announcePlayer(name: string, nationality: string, role: string, basePrice: number): Promise<void> {
    const roleMap: Record<string, string> = { BAT: "batsman", BOWL: "bowler", AR: "all-rounder", WK: "wicketkeeper" };
    const roleLabel = roleMap[role] || role;
    await speakNow(`${nationality}'s finest ${roleLabel}, ${name}. Base price, ${formatCrore(basePrice)}.`, "male", { rate: 0.93 });
  },

  async announceOpenBid(teamName: string, amount: number): Promise<void> {
    await speakNow(`${teamName} opens at ${formatCrore(amount)}!`, "male", { rate: 1.0 });
  },

  async announceBid(teamName: string, amount: number): Promise<void> {
    await speakNow(`${teamName} at ${formatCrore(amount)}!`, "male", { rate: 1.0 });
  },

  async announceCounterBid(teamName: string, amount: number): Promise<void> {
    await speakNow(`${teamName} counters! ${formatCrore(amount)}!`, "male", { rate: 1.02 });
  },

  async announceGoingOnce(amount: number): Promise<void> {
    await speakNow(`Going once. ${formatCrore(amount)}.`, "male", { rate: 0.88 });
    await delay(1400);
  },

  async announceGoingTwice(amount: number): Promise<void> {
    await speakNow(`Going twice. ${formatCrore(amount)}.`, "male", { rate: 0.85 });
    await delay(1100);
  },

  async announceSold(playerName: string, teamName: string, amount: number): Promise<void> {
    this.playGavel();
    await delay(300);
    await speakNow(`Sold! ${playerName} goes to ${teamName} for ${formatCrore(amount)}!`, "male", { rate: 0.92, volume: 1.0 });
  },

  async announcePassed(playerName: string): Promise<void> {
    await speakNow(`${playerName} goes unsold.`, "male", { rate: 0.9 });
  },

  // ── COMMENTATOR (Hindi Female) ─────────────────────────────

  async commentatorSay(text: string): Promise<void> {
    await speakNow(text, "female", { rate: 0.92 });
  },

  async commentatorIntro(): Promise<void> {
    await speakNow("Namaskar dosto! Bohot exciting auction hone wala hai aaj.", "female", { rate: 0.9 });
    await delay(600);
    await speakNow("Dekhte hain kaunsi team kis player ke liye kitni badi rakam lagati hai.", "female", { rate: 0.9 });
  },

  async commentatorPlayerContext(name: string, role: string, stats: string): Promise<void> {
    const roleHindi = role === "BAT" ? "batsman" : role === "BOWL" ? "bowler" : role === "WK" ? "wicketkeeper" : "all-rounder";
    await speakNow(`${name} bohot achhe ${roleHindi} hain. ${stats}.`, "female", { rate: 0.9 });
  },

  async commentatorBidWar(team1: string, team2: string): Promise<void> {
    const lines = [
      `${team1} aur ${team2} ke beech zordaar takkar chal rahi hai!`,
      `Dekhiye dosto, ${team1} aur ${team2} dono piche hatne ko tayyar nahi!`,
      `Wow! ${team1} aur ${team2} lad rahi hain, bohot exciting hai!`,
    ];
    await speakNow(lines[Math.floor(Math.random() * lines.length)], "female", { rate: 0.92 });
  },

  async commentatorSoldReaction(playerName: string, teamName: string, amount: number): Promise<void> {
    const lines = [
      `Shandaar pickup! ${playerName} ${teamName} ke paas gaye ${formatCrore(amount)} mein!`,
      `Bohot badhiya! ${teamName} ko mila ek champion player!`,
    ];
    await speakNow(lines[Math.floor(Math.random() * lines.length)], "female", { rate: 0.9 });
  },

  async commentatorUnsoldReaction(playerName: string): Promise<void> {
    await speakNow(`Afsos! ${playerName} unsold rahe. Bohot surprising hai ye.`, "female", { rate: 0.9 });
  },

  async commentatorBudgetAlert(teamName: string, remaining: number): Promise<void> {
    await speakNow(`${teamName} ke paas ab sirf ${formatCrore(remaining)} bache hain purse mein.`, "female", { rate: 0.9 });
  },

  // ── SFX ───────────────────────────────────────────────────

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
    gain.gain.value = 0.01;

    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    source.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    source.start();

    ambienceNodes = { source, gain, filter, lfo };
  },

  stopAmbience(): void {
    if (ambienceNodes) {
      try { ambienceNodes.source.stop(); } catch {}
      try { ambienceNodes.lfo.stop(); } catch {}
      ambienceNodes = null;
    }
  },

  crowdCheer(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const buf = createNoiseBuffer(c, 1.8);
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1200; bp.Q.value = 0.5;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, c.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0.14, c.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.8);
    src.connect(bp); bp.connect(gain); gain.connect(c.destination);
    src.start(); src.stop(c.currentTime + 1.8);
    playTone(c, 600, 0.3, "sine", 0.04, 0.1);
    playTone(c, 800, 0.25, "sine", 0.03, 0.2);
  },

  crowdMurmur(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const buf = createNoiseBuffer(c, 2);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass"; filter.frequency.value = 300; filter.Q.value = 0.6;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, c.currentTime + 0.4);
    gain.gain.linearRampToValueAtTime(0.05, c.currentTime + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 2);
    src.connect(filter); filter.connect(gain); gain.connect(c.destination);
    src.start(); src.stop(c.currentTime + 2);
  },

  crowdGasp(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const buf = createNoiseBuffer(c, 0.6);
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 800; bp.Q.value = 1.2;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
    src.connect(bp); bp.connect(gain); gain.connect(c.destination);
    src.start(); src.stop(c.currentTime + 0.6);
  },

  setTension(level: number): void {
    const clamped = Math.max(0, Math.min(100, level));
    const c = ensureCtx();
    if (!c) return;
    if (clamped === 0) {
      if (tensionOsc) { try { tensionOsc.stop(); } catch {} tensionOsc = null; tensionGain = null; }
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
    tensionGain!.gain.linearRampToValueAtTime((clamped / 100) * 0.06, c.currentTime + 0.3);
    tensionOsc!.frequency.linearRampToValueAtTime(55 + (clamped / 100) * 25, c.currentTime + 0.3);
  },

  playGavel(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    playTone(c, 1800, 0.04, "sine", 0.25, 0);
    playTone(c, 900, 0.06, "sine", 0.15, 0.01);
    playTone(c, 400, 0.12, "sine", 0.08, 0.03);
  },

  playBidConfirm(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    playTone(c, 880, 0.06, "sine", 0.1, 0);
    playTone(c, 1320, 0.05, "sine", 0.08, 0.04);
  },

  playClockTick(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    playTone(c, 1200, 0.02, "sine", 0.05, 0);
  },

  playDramaticRumble(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(40, c.currentTime);
    osc.frequency.linearRampToValueAtTime(60, c.currentTime + 0.7);
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.9);
    const filter = c.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 120;
    osc.connect(filter); filter.connect(gain); gain.connect(c.destination);
    osc.start(c.currentTime); osc.stop(c.currentTime + 0.9);
  },

  playSoldFanfare(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    let time = 0;
    for (let i = 0; i < notes.length; i++) {
      playTone(c, notes[i], 0.12, "sine", 0.1, time);
      time += 0.1;
    }
    playTone(c, 523.25, 0.35, "sine", 0.12, time + 0.05);
    playTone(c, 659.25, 0.35, "sine", 0.1, time + 0.05);
    playTone(c, 783.99, 0.35, "sine", 0.1, time + 0.05);
  },

  playNewPlayerAlert(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    playTone(c, 523, 0.08, "sine", 0.12, 0);
    playTone(c, 659, 0.08, "sine", 0.12, 0.1);
    playTone(c, 784, 0.12, "sine", 0.15, 0.2);
  },
};
