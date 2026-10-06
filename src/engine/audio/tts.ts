// src/engine/audio/tts.ts
import type { TtsEngine } from './manager';

export interface VoiceLike {
  lang: string;
  name: string;
}
export interface UtteranceLike {
  text: string;
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

/** Device text-to-speech — the last layer of the chain (spec §7). */
export class WebSpeechTts implements TtsEngine {
  constructor(
    private readonly synth: SynthLike | null,
    private readonly makeUtterance: ((text: string) => UtteranceLike) | null,
    private readonly preferred: readonly string[] = ['en-IN', 'en-GB', 'en-US'],
    private readonly rate = 0.9,
  ) {}

  available(): boolean {
    return this.synth !== null && this.makeUtterance !== null;
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth || !this.makeUtterance) return resolve();
      const utterance = this.makeUtterance(text);
      utterance.rate = this.rate;
      utterance.voice = pickVoice(this.synth.getVoices(), this.preferred);
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
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
