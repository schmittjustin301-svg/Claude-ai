// Web Speech API wrappers for the JARVIS voice mode.
//
// Recognition (speech-to-text) is Chrome/Edge/Safari only and is
// webkit-prefixed on Safari — Firefox has no support, so callers must check
// isRecognitionSupported() and fall back to typing.
// Synthesis (text-to-speech) is available in every modern browser.
//
// Both run entirely in the browser: no API key, no proxy, no cost.

/* ---------------------------------------------------------------- types */

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((e: Event) => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((e: Event) => void) | null;
}

type SpeechRecognitionCtor = new () => ISpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function isSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export const LANG = "de-DE";

/* ---------------------------------------------------- speech-to-text */

export interface ListenHandlers {
  /** Fired repeatedly while the user is still speaking. */
  onInterim?: (text: string) => void;
  /** Fired once with the finished sentence. */
  onFinal: (text: string) => void;
  /** Human-readable German error message. */
  onError?: (message: string) => void;
  /** Always fired when the session ends, for either reason. */
  onEnd?: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Kein Mikrofon-Zugriff. Erlaube den Zugriff in den Browser-Einstellungen.",
  "service-not-allowed": "Spracherkennung wurde vom Browser blockiert.",
  "no-speech": "Nichts gehört — probier's nochmal.",
  network: "Netzwerkfehler bei der Spracherkennung.",
  aborted: "",
};

/**
 * Starts one listening turn. Resolves to a stop function.
 * Uses continuous=false so a natural pause ends the turn — that gives
 * clean back-and-forth conversation instead of one endless stream.
 */
export function startListening(handlers: ListenHandlers): (() => void) | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    handlers.onError?.("Dein Browser unterstützt keine Spracherkennung. Nutze Chrome oder Safari.");
    handlers.onEnd?.();
    return null;
  }

  const recognition = new Ctor();
  recognition.lang = LANG;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = "";

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0]?.transcript ?? "";
      if (result.isFinal) {
        finalText += transcript;
      } else {
        interim += transcript;
      }
    }
    if (interim) handlers.onInterim?.(interim);
  };

  recognition.onerror = (event) => {
    const message = ERROR_MESSAGES[event.error] ?? `Spracherkennung fehlgeschlagen (${event.error}).`;
    if (message) handlers.onError?.(message);
  };

  recognition.onend = () => {
    const text = finalText.trim();
    if (text) handlers.onFinal(text);
    handlers.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    // start() throws if a previous session is still tearing down.
    handlers.onError?.("Spracherkennung läuft bereits.");
    handlers.onEnd?.();
    return null;
  }

  return () => recognition.stop();
}

/* ---------------------------------------------------- text-to-speech */

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickGermanVoice(): SpeechSynthesisVoice | null {
  if (!isSynthesisSupported()) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  cachedVoice =
    voices.find((v) => v.lang === LANG && v.localService) ??
    voices.find((v) => v.lang === LANG) ??
    voices.find((v) => v.lang.startsWith("de")) ??
    null;
  return cachedVoice;
}

if (isSynthesisSupported()) {
  // Voice list populates asynchronously in most browsers.
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    pickGermanVoice();
  };
}

/**
 * iOS/Safari refuse to speak unless synthesis was first triggered inside a
 * user gesture. Call this from the mic button's click handler once.
 */
export function unlockSynthesis(): void {
  if (!isSynthesisSupported()) return;
  const warmup = new SpeechSynthesisUtterance("");
  warmup.volume = 0;
  window.speechSynthesis.speak(warmup);
}

/** Rough spoken duration, used to bound the safety timeout below. */
function estimateSpeechMs(text: string): number {
  const perCharMs = 75;
  return Math.min(45_000, 2_500 + text.length * perCharMs);
}

export function speak(text: string, onDone?: () => void): void {
  if (!isSynthesisSupported() || !text.trim()) {
    onDone?.();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG;
  utterance.rate = 1.05;
  utterance.pitch = 1;
  const voice = pickGermanVoice();
  if (voice) utterance.voice = voice;

  let finished = false;
  let watchdog: ReturnType<typeof setTimeout>;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    onDone?.();
  };

  utterance.onend = finish;
  utterance.onerror = finish;

  // speechSynthesis is unreliable: with no installed voices, on a backgrounded
  // tab, or after an iOS audio interruption it can fire neither onend nor
  // onerror. Without this the caller's state machine would hang forever.
  watchdog = setTimeout(finish, estimateSpeechMs(text));

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (isSynthesisSupported()) window.speechSynthesis.cancel();
}
