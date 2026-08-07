// Pure WebAudio synth feedback — no external audio assets, per the brief.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, startOffset: number, duration: number, type: OscillatorType, gainPeak: number) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const startTime = audio.currentTime + startOffset;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export const sound = {
  xpGain() {
    tone(660, 0, 0.12, "triangle", 0.18);
    tone(880, 0.05, 0.15, "triangle", 0.14);
  },
  levelUp() {
    [523, 659, 784, 1047].forEach((freq, i) => tone(freq, i * 0.08, 0.25, "square", 0.16));
  },
  bossHit() {
    tone(140, 0, 0.15, "sawtooth", 0.2);
    tone(90, 0.03, 0.2, "square", 0.18);
  },
  bossVictory() {
    [392, 523, 659, 784, 1047].forEach((freq, i) => tone(freq, i * 0.1, 0.3, "triangle", 0.18));
  },
  achievement() {
    tone(784, 0, 0.1, "sine", 0.16);
    tone(988, 0.07, 0.1, "sine", 0.16);
    tone(1319, 0.14, 0.2, "sine", 0.18);
  },
  taskDone() {
    tone(440, 0, 0.1, "triangle", 0.14);
  },
};
