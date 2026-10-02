// src/engine/rng.test.ts
import { describe, it, expect } from 'vitest';
import { mulberry32, hashString, deriveSeed, pick, shuffle } from './rng';

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('differs for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('stays within [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 2000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hashString / deriveSeed', () => {
  it('is stable and sensitive to input', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });

  it('deriveSeed changes with the salt', () => {
    expect(deriveSeed(5, 'round0')).not.toBe(deriveSeed(5, 'round1'));
    expect(deriveSeed(5, 'round0')).toBe(deriveSeed(5, 'round0'));
  });
});

describe('helpers', () => {
  it('pick throws on an empty array', () => {
    expect(() => pick(mulberry32(1), [])).toThrow('pick from empty array');
  });

  it('shuffle keeps every element exactly once', () => {
    const out = shuffle(mulberry32(9), [1, 2, 3, 4, 5]);
    expect([...out].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('stream stability (stored seeds must replay identically)', () => {
  it('pins known outputs', () => {
    const r = mulberry32(42);
    expect([r(), r(), r()]).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
    expect(hashString('')).toBe(0x811c9dc5); // FNV-1a published vectors
    expect(hashString('foobar')).toBe(0xbf9cf968);
    expect(deriveSeed(5, 'round0')).toBe(1496804098);
    expect(shuffle(mulberry32(9), [1, 2, 3, 4, 5])).toEqual([3, 2, 5, 4, 1]);
  });

  it('pick reaches every element', () => {
    const r = mulberry32(1);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pick(r, ['a', 'b', 'c', 'd']));
    expect(seen.size).toBe(4);
  });
});
