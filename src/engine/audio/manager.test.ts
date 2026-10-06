// src/engine/audio/manager.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from '../content/readPackFromDisk';
import { AudioManager, type ClipPlayer, type ClipSource, type HeartSource, type TtsEngine } from './manager';
import { ManifestClipSource } from './manifest';

const pack = readPack();

class FakeClips implements ClipSource {
  constructor(private ids: Set<string>) {}
  has(id: string) { return this.ids.has(id); }
  urlFor(id: string) { return `/audio/lines/${id}.mp3`; }
}
class FakePlayer implements ClipPlayer {
  played: string[] = [];
  stopped = 0;
  async play(url: string) { this.played.push(url); }
  stop() { this.stopped++; }
}
class FakeTts implements TtsEngine {
  spoken: string[] = [];
  cancelled = 0;
  constructor(private ok = true) {}
  available() { return this.ok; }
  async speak(text: string) { this.spoken.push(text); }
  cancel() { this.cancelled++; }
}
class FakeHeart implements HeartSource {
  constructor(private ids: Set<string>) {}
  async has(id: string) { return this.ids.has(id); }
  urlFor(id: string) { return `heart://${id}`; }
}

/** A clip or utterance still sounding: play()/speak() settle only when stopped or cancelled (never, with settle = false). */
class GatedPlayer implements ClipPlayer {
  played: string[] = [];
  private pending: (() => void)[] = [];
  constructor(private settle = true) {}
  play(url: string) { this.played.push(url); return new Promise<void>((r) => this.pending.push(r)); }
  stop() { if (this.settle) this.finish(); }
  finish() { this.pending.splice(0).forEach((r) => r()); }
}
class GatedTts implements TtsEngine {
  spoken: string[] = [];
  private pending: (() => void)[] = [];
  constructor(private settle = true) {}
  available() { return true; }
  speak(text: string) { this.spoken.push(text); return new Promise<void>((r) => this.pending.push(r)); }
  cancel() { if (this.settle) this.pending.splice(0).forEach((r) => r()); }
}
const flush = () => new Promise((r) => setTimeout(r, 0));
/** p's value, or 'pending' if it has not settled by the next macrotask */
const settled = <T>(p: Promise<T>) => Promise.race([p, new Promise<'pending'>((r) => setTimeout(() => r('pending'), 0))]);

const everyClip = new FakeClips(new Set([
  'prompt.tap_big.v0.s0', 'obj.elephant.v0.s0', 'glyph.num.1.v0.s0', 'glyph.num.3.v0.s0', 'obj.mango.v0.s0', 'obj.mango.plural',
  'fb.correct.v1.s0', 'prompt.give_n.v1.s0',
]));

describe('AudioManager.speak', () => {
  it('plays text segments and object slots as clips, in order', async () => {
    const player = new FakePlayer();
    const tts = new FakeTts();
    const am = new AudioManager({ pack, clips: everyClip, player, tts });
    const parts = await am.speak({ lineId: 'prompt.tap_big', variant: 0, slots: { target: 'elephant' } });
    expect(parts).toEqual([{ source: 'clip', text: 'Tap the biggest' }, { source: 'clip', text: 'elephant' }]);
    expect(player.played).toEqual(['/audio/lines/prompt.tap_big.v0.s0.mp3', '/audio/lines/obj.elephant.v0.s0.mp3']);
    expect(tts.spoken).toEqual([]);
  });

  it('falls back to TTS only for the segment whose clip is missing', async () => {
    const player = new FakePlayer();
    const tts = new FakeTts();
    const am = new AudioManager({ pack, clips: new FakeClips(new Set(['prompt.tap_big.v0.s0'])), player, tts });
    const parts = await am.speak({ lineId: 'prompt.tap_big', variant: 0, slots: { target: 'elephant' } });
    expect(parts.map((p) => p.source)).toEqual(['clip', 'tts']);
    expect(tts.spoken).toEqual(['elephant']);
  });

  it('prefers a Heart recording over the AI clip', async () => {
    const player = new FakePlayer();
    const am = new AudioManager({ pack, clips: everyClip, player, tts: new FakeTts(), heart: new FakeHeart(new Set(['fb.correct.v1.s0'])) });
    const parts = await am.speak({ lineId: 'fb.correct', variant: 1 });
    expect(parts).toEqual([{ source: 'heart', text: 'Well done!' }]);
    expect(player.played).toEqual(['heart://fb.correct.v1.s0']);
  });

  it("speaks numbers and plurals through their clips, and Buddy's chosen name with TTS", async () => {
    const player = new FakePlayer();
    const am = new AudioManager({ pack, clips: everyClip, player, tts: new FakeTts() });
    const parts = await am.speak({ lineId: 'prompt.give_n', variant: 1, slots: { n: '3', targets: 'mango', buddy: 'Gajju' } });
    expect(parts).toEqual([
      { source: 'clip', text: 'Can you give' },
      { source: 'tts', text: 'Gajju' },
      { source: 'clip', text: 'three' },
      { source: 'clip', text: 'mangoes' },
    ]);
    expect(player.played.at(-1)).toBe('/audio/lines/obj.mango.plural.mp3');
  });

  it('speaks a chosen name as typed, even when it is also an object id', async () => {
    const tts = new FakeTts();
    const am = new AudioManager({ pack, clips: new FakeClips(new Set()), player: new FakePlayer(), tts });
    await am.speak({ lineId: 'prompt.scene_feeling', variant: 0, slots: { buddy: 'teddy' } });
    expect(tts.spoken).toEqual(['How does', 'teddy', 'feel?']);
  });

  it('says the singular after a count of one', async () => {
    const am = new AudioManager({ pack, clips: everyClip, player: new FakePlayer(), tts: new FakeTts() });
    const parts = await am.speak({ lineId: 'prompt.give_n', variant: 1, slots: { n: '1', targets: 'mango', buddy: 'Gajju' } });
    expect(parts.slice(2)).toEqual([{ source: 'clip', text: 'one' }, { source: 'clip', text: 'mango' }]);
  });

  it("speaks the child's name with TTS", async () => {
    const tts = new FakeTts();
    const am = new AudioManager({ pack, clips: everyClip, player: new FakePlayer(), tts });
    const parts = await am.speak({ lineId: 'buddy.greet_morning', variant: 0, slots: { name: 'Anika' } });
    expect(parts.map((p) => p.source)).toEqual(['tts', 'tts']);
    expect(tts.spoken).toEqual(['Good morning,', 'Anika']);
  });

  it('is silent (but still returns parts) when no clip exists and TTS is unavailable', async () => {
    const am = new AudioManager({ pack, clips: new FakeClips(new Set()), player: new FakePlayer(), tts: new FakeTts(false) });
    const parts = await am.speak({ lineId: 'fb.shown', variant: 0 });
    expect(parts).toEqual([{ source: 'silent', text: "It's this one!" }]);
  });

  it('skips a slot with no value, or an empty one', async () => {
    const tts = new FakeTts();
    const am = new AudioManager({ pack, clips: new FakeClips(new Set()), player: new FakePlayer(), tts });
    await am.speak({ lineId: 'buddy.greet_morning', variant: 0 });
    await am.speak({ lineId: 'buddy.greet_morning', variant: 0, slots: { name: '' } });
    expect(tts.spoken).toEqual(['Good morning,', 'Good morning,']);
  });

  it('clamps the variant into range', async () => {
    const am = new AudioManager({ pack, clips: new FakeClips(new Set()), player: new FakePlayer(), tts: new FakeTts() });
    const say = async (variant: number) => (await am.speak({ lineId: 'fb.correct', variant }))[0]?.text;
    const v = pack.lines.get('fb.correct')?.variants ?? [];
    expect([await say(99), await say(-1), await say(NaN), await say(0.5)]).toEqual([v.at(-1), v[0], v[0], v[0]]);
  });

  it('falls through to TTS when a clip fails to load or play, and the line goes on', async () => {
    const tts = new FakeTts();
    const player: ClipPlayer = { play: () => Promise.reject(new Error('404')), stop: () => {} };
    const am = new AudioManager({ pack, clips: everyClip, player, tts });
    const parts = await am.speak({ lineId: 'prompt.tap_big', variant: 0, slots: { target: 'elephant' } });
    expect(parts.map((p) => p.source)).toEqual(['tts', 'tts']);
    expect(tts.spoken).toEqual(['Tap the biggest', 'elephant']);
    const broken: TtsEngine = { available: () => true, speak: () => Promise.reject(new Error('synthesis-failed')), cancel: () => {} };
    const am2 = new AudioManager({ pack, clips: everyClip, player, tts: broken });
    expect(await am2.speak({ lineId: 'fb.shown', variant: 0 })).toEqual([{ source: 'silent', text: "It's this one!" }]);
  });

  it('throws for an unknown line', async () => {
    const am = new AudioManager({ pack, clips: everyClip, player: new FakePlayer(), tts: new FakeTts() });
    await expect(am.speak({ lineId: 'nope' })).rejects.toThrow('unknown line nope');
  });
});

describe('replay and stop', () => {
  it('replay speaks the last request again; stop cancels the player and TTS', async () => {
    const player = new FakePlayer();
    const tts = new FakeTts();
    const am = new AudioManager({ pack, clips: everyClip, player, tts });
    expect(await am.replay()).toEqual([]);
    await am.speak({ lineId: 'fb.correct', variant: 1 });
    await am.replay();
    expect(player.played).toEqual(['/audio/lines/fb.correct.v1.s0.mp3', '/audio/lines/fb.correct.v1.s0.mp3']);
    am.stop();
    expect(player.stopped).toBeGreaterThan(0);
    expect(tts.cancelled).toBeGreaterThan(0);
  });
});

describe('interruption', () => {
  it('a newer speak() stops the earlier one, which settles and starts nothing more', async () => {
    const player = new GatedPlayer();
    const am = new AudioManager({ pack, clips: everyClip, player, tts: new FakeTts() });
    const first = am.speak({ lineId: 'prompt.tap_big', variant: 0, slots: { target: 'elephant' } });
    await flush();
    const second = am.speak({ lineId: 'fb.correct', variant: 1 });
    expect(await settled(first)).toEqual([{ source: 'clip', text: 'Tap the biggest' }]);
    player.finish();
    expect(await settled(second)).toEqual([{ source: 'clip', text: 'Well done!' }]);
    expect(player.played).toEqual(['/audio/lines/prompt.tap_big.v0.s0.mp3', '/audio/lines/fb.correct.v1.s0.mp3']);
  });

  it('stop() settles the speak even when the player or TTS never settle theirs', async () => {
    const am = new AudioManager({ pack, clips: everyClip, player: new GatedPlayer(false), tts: new GatedTts(false) });
    const clip = am.speak({ lineId: 'fb.correct', variant: 1 });
    await flush();
    am.stop();
    expect(await settled(clip)).toEqual([{ source: 'clip', text: 'Well done!' }]);
    const tts = am.speak({ lineId: 'fb.shown', variant: 0 });
    await flush();
    am.stop();
    expect(await settled(tts)).toEqual([{ source: 'tts', text: "It's this one!" }]);
  });

  it('starts nothing for an interrupted line whose Heart lookup resolves late', async () => {
    let found = (_yes: boolean) => {};
    const heart: HeartSource = {
      has: (id) => (id === 'fb.correct.v1.s0' ? new Promise<boolean>((r) => (found = r)) : Promise.resolve(false)),
      urlFor: (id) => `heart://${id}`,
    };
    const player = new GatedPlayer();
    const tts = new GatedTts();
    const am = new AudioManager({ pack, clips: everyClip, player, tts, heart });
    void am.speak({ lineId: 'fb.correct', variant: 1 });
    await flush();
    void am.speak({ lineId: 'fb.shown', variant: 0 });
    await flush();
    found(true);
    await flush();
    expect(player.played).toEqual([]);
    expect(tts.spoken).toEqual(["It's this one!"]);
  });

  it('an unknown line leaves replay() with the last good request', async () => {
    const player = new FakePlayer();
    const am = new AudioManager({ pack, clips: everyClip, player, tts: new FakeTts() });
    await am.speak({ lineId: 'fb.correct', variant: 1 });
    await expect(am.speak({ lineId: 'nope' })).rejects.toThrow('unknown line nope');
    await am.replay();
    expect(player.played).toEqual(['/audio/lines/fb.correct.v1.s0.mp3', '/audio/lines/fb.correct.v1.s0.mp3']);
  });
});

describe('ManifestClipSource', () => {
  it('serves a clip only for the text it was generated from, so an edited line falls back to TTS', async () => {
    const clips = new ManifestClipSource({ version: 1, voice: 'v', clips: {
      'fb.correct.v1.s0': { text: 'Well done!', hash: 'h', file: 'fb.correct.v1.s0.mp3' },
      'fb.correct.v0.s0': { text: 'text from before an edit', hash: 'h', file: 'fb.correct.v0.s0.mp3' },
      'obj.mango.v0.s0': { text: 'mango', hash: 'h', file: 'obj.mango.v0.s0.mp3' },
    } }, '/audio/lines');
    expect(clips.urlFor('fb.correct.v1.s0')).toBe('/audio/lines/fb.correct.v1.s0.mp3');
    const am = new AudioManager({ pack, clips, player: new FakePlayer(), tts: new FakeTts() });
    expect((await am.speak({ lineId: 'fb.correct', variant: 1 })).map((p) => p.source)).toEqual(['clip']);
    expect((await am.speak({ lineId: 'fb.correct', variant: 0 })).map((p) => p.source)).toEqual(['tts']);
    expect((await am.speak({ lineId: 'prompt.give_n', variant: 1, slots: { n: '1', targets: 'mango' } })).at(-1)).toEqual({ source: 'clip', text: 'mango' });
  });
});
