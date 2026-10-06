// src/engine/content/assets.test.ts
import { describe, it, expect } from 'vitest';
import { assetPaths, isGlyphAsset } from './assets';
import { readPack } from './readPackFromDisk';

const pack = readPack();

describe('assetPaths', () => {
  it('lists every topic, object, scene and bin picture once, and no glyph text', () => {
    const paths = assetPaths(pack);
    expect(paths).toContain('topics/rhyming.svg'); // a topic signpost
    expect(paths).toContain('objects/cool-drink.svg');
    expect(paths).toContain('scenes/road.svg'); // every scene, used by a template or not
    expect(paths).toContain('bins/plate.svg');
    expect(paths.some(isGlyphAsset)).toBe(false); // letters: glyph:A
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.some((p) => p.startsWith('vignettes/'))).toBe(false); // composed by the app
  });

  it('counts each source: every object has a picture, and so does every scene', () => {
    const paths = new Set(assetPaths(pack));
    for (const o of pack.objects.values()) expect(paths.has(o.asset)).toBe(true);
    for (const s of pack.scenes.values()) expect(paths.has(s.asset)).toBe(true);
  });
});
