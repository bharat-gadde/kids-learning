// src/engine/audio/tts.ts
import type { TtsEngine } from './manager';

export interface VoiceLike {
  lang: string;
  name: string;
}
export interface UtteranceLike {
  text: string;
  lang: string;
  rate: number;
  voice: VoiceLike | null;
  onend: ((event?: unknown) => void) | null;
  onerror: ((event?: unknown) => void) | null;
}
export interface SynthLike {
  getVoices(): VoiceLike[];
  speak(utterance: UtteranceLike): void;
  cancel(): void;
}

/** First voice whose language matches a preferred prefix, in preference order. */
export function pickVoice(voices: readonly VoiceLike[], preferred: readonly string[]): VoiceLike | null {
  for (const lang of preferred) {
    const want = lang.toLowerCase();
    const voice = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(want));
    if (voice) return voice;
  }
  return null;
}

/** Ample time for a short line at rate 0.9; an engine that fires neither end nor error is given up on after this. */
const speechTimeoutMs = (text: string) => 3000 + 150 * text.length;

/** Device text-to-speech — the last layer of the chain (spec §7). */
export class WebSpeechTts implements TtsEngine {
  constructor(
    private readonly synth: SynthLike | null,
    private readonly makeUtterance: ((text: string) => UtteranceLike) | null,
    private readonly preferred: readonly string[] = ['en-IN', 'en-GB', 'en-US', 'en'],
    private readonly rate = 0.9,
  ) {}

  available(): boolean {
    return this.synth !== null && this.makeUtterance !== null;
  }

  /**
   * Resolves when the line ends or cancel() interrupts it; rejects when the engine fails, so the chain reports the line
   * silent. Resolves anyway after speechTimeoutMs: iOS drops speech started outside a tap without firing end or error.
   */
  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth || !this.makeUtterance) return resolve();
      const utterance = this.makeUtterance(text);
      const voice = pickVoice(this.synth.getVoices(), this.preferred);
      utterance.rate = this.rate;
      utterance.voice = voice;
      // Chrome lists no voices until voiceschanged; the lang still steers it to an English voice
      utterance.lang = voice ? voice.lang.replace('_', '-') : (this.preferred[0] ?? 'en');
      const timer = setTimeout(() => resolve(), speechTimeoutMs(text));
      utterance.onend = () => {
        clearTimeout(timer);
        resolve();
      };
      utterance.onerror = (event) => {
        clearTimeout(timer);
        const code = (event as { error?: unknown } | undefined)?.error;
        if (code === 'interrupted' || code === 'canceled') resolve(); // cancel(): stopped, not failed
        else reject(new Error(`Speech failed: ${String(code)}`));
      };
      this.synth.speak(utterance);
    });
  }

  cancel(): void {
    this.synth?.cancel();
  }
}

/** Wire the browser's speech synthesis, or an unavailable engine outside a browser. */
export function createWebSpeechTts(): WebSpeechTts {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return new WebSpeechTts(null, null);
  return new WebSpeechTts(
    window.speechSynthesis as unknown as SynthLike,
    (text) => new SpeechSynthesisUtterance(text) as unknown as UtteranceLike,
  );
}
