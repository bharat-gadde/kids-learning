// src/engine/rng.test.ts
import { describe, it, expect } from 'vitest';
import { mulberry32, hashString, deriveSeed, randInt, pick, shuffle } from './rng';

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
  it('randInt is inclusive of both bounds', () => {
    const r = mulberry32(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randInt(r, 2, 4));
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });

  it('pick throws on an empty array', () => {
    expect(() => pick(mulberry32(1), [])).toThrow('pick from empty array');
  });

  it('shuffle keeps every element exactly once', () => {
    const out = shuffle(mulberry32(9), [1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
