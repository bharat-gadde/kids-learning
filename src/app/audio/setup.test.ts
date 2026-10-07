// src/app/audio/setup.test.ts
// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { pack } from '../pack';
import { createAudioManager, loadManifest, primeHowler, primeVoices, stopWhenHidden, unlockSpeech } from './setup';

type HowlOpts = { src: string[]; html5?: boolean; preload?: boolean; onend?: () => void; onloaderror?: (id: number, error: unknown) => void };
const howler = vi.hoisted(() => ({ made: [] as HowlOpts[], loads: true, throws: false }));
vi.mock('howler', () => ({
  Howl: class {
    constructor(private readonly o: HowlOpts) {
      if (howler.throws) throw new TypeError("Cannot read properties of null (reading 'createBuffer')");
      howler.made.push(o);
    }
    play() {
      if (howler.loads) this.o.onend?.();
      else this.o.onloaderror?.(1, 'Failed loading audio file');
    }
    stop() {}
    unload() {}
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const respond = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
const clip = { 'fb.correct.v0.s0': { text: 'Yes!', hash: 'h', file: 'fb.correct.v0.s0.mp3' } };

describe('loadManifest', () => {
  it('fetches the manifest from under the base path', async () => {
    let asked = '';
    const manifest = { version: 1, voice: 'en-IN-NeerjaNeural', clips: clip };
    const fetchFn = (async (url: string) => { asked = url; return { ok: true, json: async () => manifest }; }) as unknown as typeof fetch;
    expect(await loadManifest('/buddy/', fetchFn)).toEqual(manifest);
    expect(asked).toBe('/buddy/audio/manifest.json');
  });

  it('falls back to no clips (every line by TTS) when the manifest is missing, broken, unreachable or slow', async () => {
    const empty = { version: 1, voice: '', clips: {} };
    const notJson = (async () => ({ ok: true, json: async () => { throw new SyntaxError("Unexpected token '<'"); } })) as unknown as typeof fetch;
    const stalled = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch;
    expect(await loadManifest('/', respond(null, false))).toEqual(empty);
    expect(await loadManifest('/', respond({ version: 2, clips: {} }))).toEqual(empty);
    expect(await loadManifest('/', respond({ version: 1, clips: null }))).toEqual(empty);
    expect(await loadManifest('/', notJson)).toEqual(empty);
    expect(await loadManifest('/', (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toEqual(empty);
    expect(await loadManifest('/', stalled, 5)).toEqual(empty);
  });
});

describe('createAudioManager', () => {
  it('plays clips from under the base path, and a clip that will not load falls through to the device voice', async () => {
    const audio = createAudioManager(pack, { version: 1, voice: 'v', clips: clip }, '/buddy/');
    expect(await audio.speak({ lineId: 'fb.correct', variant: 0 })).toEqual([{ source: 'clip', text: 'Yes!' }]);
    expect(howler.made.at(-1)?.src).toEqual(['/buddy/audio/lines/fb.correct.v0.s0.mp3']);
    howler.loads = false;
    expect(await audio.speak({ lineId: 'fb.correct', variant: 0 })).toEqual([{ source: 'silent', text: 'Yes!' }]); // jsdom has no speech
    howler.loads = true;
  });
});

describe('primeHowler', () => {
  it('builds one Howl that never loads, and a Howler that fails does not stop the app starting', () => {
    const before = howler.made.length;
    primeHowler();
    expect(howler.made.slice(before)).toMatchObject([{ html5: true, preload: false }]);
    howler.throws = true;
    expect(() => primeHowler()).not.toThrow();
    howler.throws = false;
  });
});

describe('unlockSpeech', () => {
  it('speaks one silent utterance at once, inside the tap, and does nothing without device speech', () => {
    expect(() => unlockSpeech()).not.toThrow(); // jsdom has no speechSynthesis
    const spoken: Array<{ text: string; volume: number }> = [];
    vi.stubGlobal('SpeechSynthesisUtterance', class { volume = 1; constructor(readonly text: string) {} });
    vi.stubGlobal('speechSynthesis', { speak: (u: { text: string; volume: number }) => spoken.push(u) });
    unlockSpeech();
    expect(spoken).toEqual([expect.objectContaining({ text: '', volume: 0 })]); // already spoken: no await came first
  });
});

describe('primeVoices', () => {
  it('logs the voice speech will use, waiting for voiceschanged while none are listed (Chrome)', () => {
    let voices: Array<{ lang: string; name: string }> = [];
    let changed = () => {};
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => voices,
      addEventListener: (type: string, fn: () => void) => { if (type === 'voiceschanged') changed = fn; },
    });
    const logs: string[] = [];
    primeVoices((m) => logs.push(m));
    expect(logs).toEqual([]);
    voices = [{ lang: 'en-US', name: 'Samantha' }, { lang: 'en_IN', name: 'Rishi' }];
    changed();
    voices = [{ lang: 'fr-FR', name: 'Thomas' }];
    primeVoices((m) => logs.push(m));
    expect(logs).toEqual(['speech voice: Rishi', 'speech voice: none in English']);
  });
});

describe('stopWhenHidden', () => {
  it('stops the voice when the page is hidden, until unsubscribed', () => {
    let stops = 0;
    let state = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    const off = stopWhenHidden(() => { stops += 1; });
    document.dispatchEvent(new Event('visibilitychange'));
    state = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    off();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(stops).toBe(1);
  });
});
