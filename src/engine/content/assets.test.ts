// src/engine/content/assets.test.ts
import { describe, it, expect } from 'vitest';
import { assetPaths, isGlyphAsset } from './assets';
import { readPack } from './readPackFromDisk';

const pack = readPack();

describe('isGlyphAsset', () => {
  it('tells glyph text from a picture path', () => {
    expect([isGlyphAsset('glyph:A'), isGlyphAsset('glyph:Aa'), isGlyphAsset('objects/apple.svg')]).toEqual([true, true, false]);
  });
});

describe('assetPaths', () => {
  it('lists every topic, object, scene and bin picture once, and no glyph text', () => {
    const paths = assetPaths(pack);
    expect(paths).toContain('topics/rhyming.svg'); // a topic signpost
    expect(paths).toContain('objects/cool-drink.svg');
    expect(paths).toContain('scenes/road.svg'); // every scene, used by a template or not
    expect(paths).toContain('bins/plate.svg');
    expect(paths.filter((p) => p.startsWith('glyph:'))).toEqual([]); // letters: glyph:A
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.some((p) => p.startsWith('vignettes/'))).toBe(false); // composed by the app
  });

  it('misses no picture the content names anywhere, except the vignettes the app composes', () => {
    const paths = new Set(assetPaths(pack));
    const named: string[] = [];
    const walk = (value: unknown, key: string): void => {
      if (typeof value === 'string') {
        if (key !== 'vignette' && !isGlyphAsset(value) && (key === 'asset' || value.endsWith('.svg'))) named.push(value);
      } else if (Array.isArray(value)) {
        for (const v of value) walk(v, key);
      } else if (value !== null && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) walk(v, k);
      }
    };
    walk(pack.raw, '');
    expect(named.length).toBeGreaterThan(100);
    for (const p of named) expect(paths.has(p), p).toBe(true);
  });
});
