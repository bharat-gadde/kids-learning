// src/engine/audio/tts.test.ts
import { describe, it, expect } from 'vitest';
import { pickVoice, WebSpeechTts, type SynthLike, type UtteranceLike, type VoiceLike } from './tts';

const voices: VoiceLike[] = [{ lang: 'en-US', name: 'Samantha' }, { lang: 'en-GB', name: 'Daniel' }, { lang: 'en_IN', name: 'Rishi' }];

describe('pickVoice', () => {
  it('prefers en-IN, then en-GB, then en-US (tolerating underscores)', () => {
    expect(pickVoice(voices, ['en-IN', 'en-GB', 'en-US'])?.name).toBe('Rishi');
    expect(pickVoice(voices.slice(0, 2), ['en-IN', 'en-GB', 'en-US'])?.name).toBe('Daniel');
    expect(pickVoice([], ['en-IN'])).toBeNull();
  });
});

class FakeSynth implements SynthLike {
  spoken: UtteranceLike[] = [];
  cancelled = 0;
  constructor(private voices: VoiceLike[]) {}
  getVoices() { return this.voices; }
  speak(u: UtteranceLike) { this.spoken.push(u); setTimeout(() => u.onend?.(), 0); }
  cancel() { this.cancelled++; }
}
const makeUtterance = (text: string): UtteranceLike => ({ text, rate: 1, voice: null, onend: null, onerror: null });

describe('WebSpeechTts', () => {
  it('speaks slowly with the preferred voice and resolves when the utterance ends', async () => {
    const synth = new FakeSynth(voices);
    const tts = new WebSpeechTts(synth, makeUtterance);
    expect(tts.available()).toBe(true);
    await tts.speak('Hello');
    expect(synth.spoken[0]).toMatchObject({ text: 'Hello', rate: 0.9, voice: { name: 'Rishi' } });
    tts.cancel();
    expect(synth.cancelled).toBe(1);
  });

  it('is unavailable without a synthesiser and resolves speak() immediately', async () => {
    const tts = new WebSpeechTts(null, null);
    expect(tts.available()).toBe(false);
    await expect(tts.speak('x')).resolves.toBeUndefined();
  });
});
