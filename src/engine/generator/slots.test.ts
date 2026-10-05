// src/engine/generator/slots.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mulberry32 } from '../rng';
import { chooseSlot, placeAt } from './slots';

describe('chooseSlot', () => {
  it('never repeats the previous slot when there is a choice', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 2, max: 8 }), fc.integer({ min: 0, max: 7 }), (seed, count, last) => {
        const slot = chooseSlot(mulberry32(seed), count, last % count, []);
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThan(count);
        expect(slot).not.toBe(last % count);
      }),
    );
  });

  it('prefers the least-used slot', () => {
    // slots 0 and 2 used twice, slot 1 once; last was 0 → must pick 1
    expect(chooseSlot(mulberry32(1), 3, 0, [2, 1, 2])).toBe(1);
  });

  it('returns 0 for a single option', () => {
    expect(chooseSlot(mulberry32(1), 1, 0, [])).toBe(0);
  });
});

describe('placeAt', () => {
  it('inserts the correct item at the slot and keeps the others in order', () => {
    expect(placeAt('C', ['a', 'b', 'c'], 0)).toEqual(['C', 'a', 'b', 'c']);
    expect(placeAt('C', ['a', 'b', 'c'], 2)).toEqual(['a', 'b', 'C', 'c']);
    expect(placeAt('C', ['a', 'b', 'c'], 3)).toEqual(['a', 'b', 'c', 'C']);
  });
});
