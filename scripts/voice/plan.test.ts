// scripts/voice/plan.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from '../../src/engine/content/readPackFromDisk';
import { EMPTY_MANIFEST, type ClipManifest } from '../../src/engine/audio/manifest';
import { clipHash, planClips, staleClips } from './plan';

const pack = readPack();
const VOICE = 'en-IN-NeerjaNeural';

describe('clipHash', () => {
  it('changes with text and with voice', () => {
    expect(clipHash(VOICE, 'apple')).toBe(clipHash(VOICE, 'apple'));
    expect(clipHash(VOICE, 'apple')).not.toBe(clipHash(VOICE, 'apples'));
    expect(clipHash(VOICE, 'apple')).not.toBe(clipHash('en-GB-SoniaNeural', 'apple'));
  });
});

describe('planClips', () => {
  it('needs everything for an empty manifest and nothing is orphaned', () => {
    const plan = planClips(pack, EMPTY_MANIFEST, VOICE);
    expect(plan.needed.length).toBeGreaterThan(200);
    expect(plan.unchanged).toEqual([]);
    expect(plan.orphans).toEqual([]);
    expect(plan.needed.find((c) => c.clipId === 'obj.apple.v0.s0')).toMatchObject({ text: 'apple', file: 'obj.apple.v0.s0.mp3' });
  });

  it('skips unchanged clips, regenerates changed text and reports orphans', () => {
    const manifest: ClipManifest = {
      version: 1,
      voice: VOICE,
      clips: {
        'obj.apple.v0.s0': { text: 'apple', hash: clipHash(VOICE, 'apple'), file: 'obj.apple.v0.s0.mp3' },
        'obj.banana.v0.s0': { text: 'bananas', hash: clipHash(VOICE, 'bananas'), file: 'obj.banana.v0.s0.mp3' },
        'old.line.v0.s0': { text: 'gone', hash: 'x', file: 'old.line.v0.s0.mp3' },
      },
    };
    const plan = planClips(pack, manifest, VOICE);
    expect(plan.unchanged.map((c) => c.clipId)).toEqual(['obj.apple.v0.s0']);
    expect(plan.needed.some((c) => c.clipId === 'obj.banana.v0.s0')).toBe(true);
    expect(plan.orphans).toEqual(['old.line.v0.s0']);
  });
});

describe('staleClips', () => {
  it('lists clips whose text changed since generation, not new, unchanged or orphaned ones', () => {
    const manifest: ClipManifest = {
      version: 1,
      voice: VOICE,
      clips: {
        'obj.apple.v0.s0': { text: 'apple', hash: 'h', file: 'obj.apple.v0.s0.mp3' },
        'obj.banana.v0.s0': { text: 'bananas', hash: 'h', file: 'obj.banana.v0.s0.mp3' },
        'old.line.v0.s0': { text: 'gone', hash: 'h', file: 'old.line.v0.s0.mp3' },
      },
    };
    expect(staleClips(pack, manifest)).toEqual(['obj.banana.v0.s0']);
  });
});
