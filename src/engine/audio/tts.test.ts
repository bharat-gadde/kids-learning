// src/engine/audio/tts.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { pickVoice, WebSpeechTts, type SynthLike, type UtteranceLike, type VoiceLike } from './tts';

const voices: VoiceLike[] = [{ lang: 'en-US', name: 'Samantha' }, { lang: 'en-GB', name: 'Daniel' }, { lang: 'en_IN', name: 'Rishi' }];

describe('pickVoice', () => {
  it('prefers en-IN, then en-GB, then en-US (tolerating underscores)', () => {
    expect(pickVoice(voices, ['en-IN', 'en-GB', 'en-US'])?.name).toBe('Rishi');
    expect(pickVoice(voices.slice(0, 2), ['en-IN', 'en-GB', 'en-US'])?.name).toBe('Daniel');
    expect(pickVoice([], ['en-IN'])).toBeNull();
    expect(pickVoice([{ lang: 'hi-IN', name: 'Lekha' }], ['en-IN', 'en-GB', 'en-US'])).toBeNull(); // never a non-English voice
  });
});

class FakeSynth implements SynthLike {
  spoken: UtteranceLike[] = [];
  cancelled = 0;
  /** What the engine fires after speak(): end, an error code, or nothing (iOS drops speech started outside a tap). */
  fires: 'end' | 'nothing' | { error: string } = 'end';
  constructor(private voices: VoiceLike[]) {}
  getVoices() { return this.voices; }
  speak(u: UtteranceLike) {
    this.spoken.push(u);
    const fires = this.fires;
    if (fires !== 'nothing') setTimeout(() => (fires === 'end' ? u.onend?.() : u.onerror?.(fires)), 0);
  }
  cancel() { this.cancelled++; }
}
const makeUtterance = (text: string): UtteranceLike => ({ text, lang: '', rate: 1, voice: null, onend: null, onerror: null });

afterEach(() => {
  vi.useRealTimers();
});

describe('WebSpeechTts', () => {
  it('speaks slowly with the preferred voice and resolves when the utterance ends', async () => {
    const synth = new FakeSynth(voices);
    const tts = new WebSpeechTts(synth, makeUtterance);
    expect(tts.available()).toBe(true);
    await tts.speak('Hello');
    expect(synth.spoken[0]).toMatchObject({ text: 'Hello', rate: 0.9, lang: 'en-IN', voice: { name: 'Rishi' } });
    tts.cancel();
    expect(synth.cancelled).toBe(1);
  });

  it('falls back to any English voice, and to an en-IN lang while Chrome still lists no voices', async () => {
    const listed = new FakeSynth([{ lang: 'hi-IN', name: 'Lekha' }, { lang: 'en-AU', name: 'Karen' }]);
    await new WebSpeechTts(listed, makeUtterance).speak('Hi');
    expect(listed.spoken[0]).toMatchObject({ lang: 'en-AU', voice: { name: 'Karen' } });
    const none = new FakeSynth([]);
    await new WebSpeechTts(none, makeUtterance).speak('Hi');
    expect(none.spoken[0]).toMatchObject({ lang: 'en-IN', voice: null });
  });

  it('rejects when the engine fails (the chain reports the line silent) but resolves when cancel() interrupts it', async () => {
    const synth = new FakeSynth(voices);
    const tts = new WebSpeechTts(synth, makeUtterance);
    synth.fires = { error: 'synthesis-failed' };
    await expect(tts.speak('Hello')).rejects.toThrow('synthesis-failed');
    synth.fires = { error: 'not-allowed' };
    await expect(tts.speak('Hello')).rejects.toThrow('not-allowed');
    synth.fires = { error: 'interrupted' };
    await expect(tts.speak('Hello')).resolves.toBeUndefined();
    synth.fires = { error: 'canceled' };
    await expect(tts.speak('Hello')).resolves.toBeUndefined();
  });

  it('resolves even when the engine fires neither end nor error, but not before the line could have been spoken', async () => {
    vi.useFakeTimers();
    const synth = new FakeSynth(voices);
    synth.fires = 'nothing';
    let settled = false;
    const done = new WebSpeechTts(synth, makeUtterance).speak('Hello').then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(2500);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    await done;
    expect(settled).toBe(true);
  });

  it('is unavailable without a synthesiser and resolves speak() immediately', async () => {
    const tts = new WebSpeechTts(null, null);
    expect(tts.available()).toBe(false);
    await expect(tts.speak('x')).resolves.toBeUndefined();
  });
});
