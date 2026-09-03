"use client";

let audioCtx: AudioContext | null = null;
let enabled = true;
let initialized = false;
let speechQueue: Array<{ text: string; voice: "male" | "female"; priority: boolean }> = [];
let speaking = false;
let speechEndCallback: (() => void) | null = null;

let ambienceNodes: {
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
} | null = null;

let tensionOsc: OscillatorNode | null = null;
let tensionGain: GainNode | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function ensureCtx(): AudioContext | null {
  const c = ctx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
  return c;
}

function formatCrore(amount: number): string {
  if (amount >= 100) return `${amount} crore`;
  if (amount >= 1) return `${amount} crore`;
  return `${Math.round(amount * 100)} lakh`;
}

function findVoice(lang: string, preferGender?: "male" | "female"): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined") return undefined;
  const synth = window.speechSynthesis;
  if (!synth) return undefined;
  const voices = synth.getVoices();
  const candidates = voices.filter((v) => v.lang.startsWith(lang));
  if (candidates.length === 0) return undefined;
  if (preferGender) {
    const match = candidates.find((v) =>
      v.name.toLowerCase().includes(preferGender)
    );
    if (match) return match;
  }
  return candidates[0];
}

function speakQueued(): void {
  if (speaking || speechQueue.length === 0) return;
  speaking = true;

  const { text, voice, priority } = speechQueue.shift()!;
  const synth = window.speechSynthesis;
  if (!synth) { speaking = false; return; }

  synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);

  if (voice === "male") {
    const v = findVoice("en", "male") || findVoice("en");
    if (v) utter.voice = v;
    utter.rate = 1.08;
    utter.pitch = 0.92;
    utter.volume = 1.0;
    utter.lang = "en-IN";
  } else {
    const v = findVoice("hi") || findVoice("en", "female");
    if (v) utter.voice = v;
    utter.rate = 1.02;
    utter.pitch = 1.15;
    utter.volume = 0.95;
    utter.lang = v?.lang || "hi-IN";
  }

  utter.onend = () => {
    speaking = false;
    setTimeout(speakQueued, 80);
  };

  utter.onerror = () => {
    speaking = false;
    setTimeout(speakQueued, 80);
  };

  synth.speak(utter);
}

function speakAsync(text: string, voice: "male" | "female", priority: boolean = false): Promise<void> {
  if (!enabled || typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    speechQueue.push({ text, voice, priority });
    const checkDone = setInterval(() => {
      if (!speaking && speechQueue.length === 0) {
        clearInterval(checkDone);
        resolve();
      }
    }, 100);
    speakQueued();
    setTimeout(resolve, 15000);
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
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
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
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
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
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis?.getVoices();
        };
      } catch {}
    }
  },

  setEnabled(on: boolean): void {
    enabled = on;
    if (!on) {
      speechQueue = [];
      speaking = false;
      this.stopAmbience();
      try { window.speechSynthesis?.cancel(); } catch {}
    }
  },

  isEnabled(): boolean {
    return enabled;
  },

  clearSpeechQueue(): void {
    speechQueue = [];
    speaking = false;
    try { window.speechSynthesis?.cancel(); } catch {}
  },

  // ── AUCTIONEER (English Male) ──────────────────────────────

  auctioneerSay(text: string): Promise<void> {
    return speakAsync(text, "male");
  },

  async auctionIntro(): Promise<void> {
    const lines = [
      "Welcome to the IPL 2027 Mega Auction!",
      "Ladies and gentlemen, good evening and welcome to the biggest sporting auction event of the year.",
      "Ten franchises, over 160 players, and a total purse of 125 crore each. This is where champions are made.",
      "The rules are simple. Each franchise can field up to 25 players, with a maximum of 8 overseas stars.",
      "We begin with the marquee set. Let the bidding wars begin!",
    ];
    for (const line of lines) {
      await speakAsync(line, "male");
      await new Promise((r) => setTimeout(r, 600));
    }
  },

  async announcePlayer(name: string, nationality: string, role: string, basePrice: number): Promise<void> {
    const roleMap: Record<string, string> = {
      BAT: "batsman",
      BOWL: "bowler",
      AR: "all-rounder",
      WK: "wicketkeeper-batsman",
    };
    const roleLabel = roleMap[role] || role;
    const amt = formatCrore(basePrice);
    await speakAsync(
      `Next up on the block, from ${nationality}, the ${roleLabel} — ${name}! Base price set at ${amt} crore. Who wants to start the bidding?`,
      "male"
    );
  },

  async announceBidStart(teamName: string, amount: number): Promise<void> {
    await speakAsync(`${teamName} opens at ${formatCrore(amount)}!`, "male");
  },

  async announceBid(teamName: string, amount: number): Promise<void> {
    await speakAsync(`${teamName} at ${formatCrore(amount)}!`, "male");
  },

  async announceCounterBid(teamName: string, amount: number): Promise<void> {
    await speakAsync(`${teamName} counters! ${formatCrore(amount)}!`, "male");
  },

  async announceGoingOnce(amount: number): Promise<void> {
    await speakAsync(`Going once... ${formatCrore(amount)}`, "male");
    await new Promise((r) => setTimeout(r, 1500));
  },

  async announceGoingTwice(amount: number): Promise<void> {
    await speakAsync(`Going twice... ${formatCrore(amount)}`, "male");
    await new Promise((r) => setTimeout(r, 1200));
  },

  async announceSold(playerName: string, teamName: string, amount: number): Promise<void> {
    this.playGavel();
    await speakAsync(`SOLD! ${playerName} goes to ${teamName} for ${formatCrore(amount)}!`, "male", true);
  },

  async announcePassed(playerName: string): Promise<void> {
    await speakAsync(`And that's it. ${playerName} goes unsold this time.`, "male", true);
  },

  // ── COMMENTATOR (Hindi Female) ─────────────────────────────

  commentatorSay(text: string): Promise<void> {
    return speakAsync(text, "female");
  },

  async commentatorIntro(): Promise<void> {
    const lines = [
      "Namaskar dosto! Main aapki commentary host hoon. Bohot exciting auction hone wala hai aaj.",
      "Dekhte hain kaunsi team kis player ke liye kitni badi rakam lagati hai. Bohot interesting hoga!",
    ];
    for (const line of lines) {
      await speakAsync(line, "female");
      await new Promise((r) => setTimeout(r, 800));
    }
  },

  async commentatorPlayerIntro(name: string, role: string, stats: string): Promise<void> {
    await speakAsync(
      `${name} bohot achhe ${role === "BAT" ? "batsman" : role === "BOWL" ? "bowler" : role === "WK" ? "wicketkeeper" : "all-rounder"} hain. ${stats}`,
      "female"
    );
  },

  async commentatorBiddingWar(team1: string, team2: string, amount: number): Promise<void> {
    const lines = [
      `Kya baat hai! ${team1} aur ${team2} ke beech zordaar takkar chal rahi hai! ${formatCrore(amount)} tak pahunch gayi bid!`,
      `Dekhiye dosto, ${team1} aur ${team2} dono piche hatne ko tayyar nahi! Bohot intense scene hai auction room mein!`,
      `Wow! Ye toh bohot exciting ho gaya! ${formatCrore(amount)} ki bid par dono teams lad rahi hain!`,
    ];
    const line = lines[Math.floor(Math.random() * lines.length)];
    await speakAsync(line, "female");
  },

  async commentatorBigBid(teamName: string, amount: number): Promise<void> {
    const lines = [
      `${teamName} ne badi bid lagayi hai! ${formatCrore(amount)}! Bohot daring move hai ye!`,
      `Oho! ${formatCrore(amount)} ki bid! ${teamName} ko ye player chahiye, koi shak nahi!`,
    ];
    const line = lines[Math.floor(Math.random() * lines.length)];
    await speakAsync(line, "female");
  },

  async commentatorSold(playerName: string, teamName: string, amount: number): Promise<void> {
    const lines = [
      `Bohot badhiya! ${playerName} ${teamName} ke paas gaye ${formatCrore(amount)} mein! Shandaar pickup hai ye!`,
      `And finally! ${playerName} ${teamName} ka ho gaya! ${formatCrore(amount)} mein ek shandaar player mil gaya unhe!`,
    ];
    const line = lines[Math.floor(Math.random() * lines.length)];
    await speakAsync(line, "female");
  },

  async commentatorUnsold(playerName: string): Promise<void> {
    const lines = [
      `Afsos! ${playerName} unsold rahe. Bohot surprising hai ye.`,
      `${playerName} ko koi nahi chahiye tha aaj? Bohot badi disappointment hai ye toh!`,
    ];
    const line = lines[Math.floor(Math.random() * lines.length)];
    await speakAsync(line, "female");
  },

  async commentatorBudgetAlert(teamName: string, remaining: number): Promise<void> {
    await speakAsync(
      `Dhyan dein dosto! ${teamName} ke paas ab sirf ${formatCrore(remaining)} bache hain purse mein. Bohot soch samajh ke chalna hoga!`,
      "female"
    );
  },

  async commentatorSquadFull(teamName: string): Promise<void> {
    await speakAsync(
      `${teamName} ki squad bhar chuki hai! Ab unhe sirf overseas slots ke liye dekhna hoga.`,
      "female"
    );
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
    gain.gain.value = 0.012;

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
    bp.type = "bandpass";
    bp.frequency.value = 1200;
    bp.Q.value = 0.5;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.22, c.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0.15, c.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.8);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(c.destination);
    src.start();
    src.stop(c.currentTime + 1.8);

    playTone(c, 600, 0.35, "sine", 0.05, 0.1);
    playTone(c, 750, 0.3, "sine", 0.04, 0.2);
    playTone(c, 900, 0.25, "sine", 0.03, 0.3);
    playTone(c, 1100, 0.2, "sine", 0.02, 0.35);
  },

  crowdMurmur(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;

    const buf = createNoiseBuffer(c, 2.5);
    const src = c.createBufferSource();
    src.buffer = buf;

    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 300;
    filter.Q.value = 0.6;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0.06, c.currentTime + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 2.5);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start();
    src.stop(c.currentTime + 2.5);
  },

  crowdGasp(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;

    const buf = createNoiseBuffer(c, 0.8);
    const src = c.createBufferSource();
    src.buffer = buf;

    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 800;
    bp.Q.value = 1.2;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.14, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.8);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(c.destination);
    src.start();
    src.stop(c.currentTime + 0.8);

    playTone(c, 250, 0.5, "sine", 0.06, 0);
  },

  setTension(level: number): void {
    const clamped = Math.max(0, Math.min(100, level));
    const c = ensureCtx();
    if (!c) return;

    if (clamped === 0) {
      if (tensionOsc) {
        try { tensionOsc.stop(); } catch {}
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

  playGavel(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    playTone(c, 1800, 0.04, "sine", 0.3, 0);
    playTone(c, 900, 0.06, "sine", 0.2, 0.01);
    playNoiseBurst(c, 0.05, 0.18, 3000, 0);
    playTone(c, 400, 0.12, "sine", 0.1, 0.03);
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

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    const durations = [0.12, 0.12, 0.12, 0.15, 0.15, 0.3];
    let time = 0;
    for (let i = 0; i < notes.length; i++) {
      playTone(c, notes[i], durations[i], "sine", 0.12, time);
      playTone(c, notes[i] * 0.5, durations[i], "triangle", 0.06, time);
      time += durations[i] * 0.7;
    }
    playNoiseBurst(c, 0.8, 0.08, 2500, 0.1);
    playTone(c, 523.25, 0.4, "sine", 0.14, time + 0.05);
    playTone(c, 659.25, 0.4, "sine", 0.12, time + 0.05);
    playTone(c, 783.99, 0.4, "sine", 0.12, time + 0.05);
  },

  playNewPlayerAlert(): void {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    playTone(c, 523, 0.1, "sine", 0.15, 0);
    playTone(c, 659, 0.1, "sine", 0.15, 0.12);
    playTone(c, 784, 0.15, "sine", 0.18, 0.24);
  },
};
