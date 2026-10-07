// src/app/audio/setup.test.ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { loadManifest, stopWhenHidden } from './setup';

const respond = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

describe('loadManifest', () => {
  it('fetches the manifest from under the base path', async () => {
    let asked = '';
    const manifest = { version: 1, voice: 'en-IN-NeerjaNeural', clips: { 'fb.correct.v0.s0': { text: 'Yes!', hash: 'h', file: 'fb.correct.v0.s0.mp3' } } };
    const fetchFn = (async (url: string) => { asked = url; return { ok: true, json: async () => manifest }; }) as unknown as typeof fetch;
    expect(await loadManifest('/buddy/', fetchFn)).toEqual(manifest);
    expect(asked).toBe('/buddy/audio/manifest.json');
  });

  it('falls back to no clips (every line by TTS) when the manifest is missing, broken or unreachable', async () => {
    const empty = { version: 1, voice: '', clips: {} };
    expect(await loadManifest('/', respond(null, false))).toEqual(empty);
    expect(await loadManifest('/', respond({ version: 2, clips: {} }))).toEqual(empty);
    expect(await loadManifest('/', (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toEqual(empty);
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
