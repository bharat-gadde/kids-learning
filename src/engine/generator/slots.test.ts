// src/engine/generator/slots.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mulberry32 } from '../rng';
import { chooseSlot, placeAt } from './slots';

const SEEDS = Array.from({ length: 50 }, (_, i) => i);
/** Every slot chooseSlot returns over the fixed seeds, sorted. */
const outcomes = (f: (seed: number) => number) => [...new Set(SEEDS.map(f))].sort();

describe('chooseSlot', () => {
  it('never puts the answer in one slot three times running, nor in a slot more than one use ahead of the least-used', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 2, max: 8 }),
        fc.array(fc.nat({ max: 9 }), { maxLength: 5 }), // earlier slots may lie past this round's options
        fc.array(fc.nat({ max: 3 }), { maxLength: 8 }),
        (seed, count, recent, counts) => {
          const slot = chooseSlot(mulberry32(seed), count, recent, counts);
          expect(slot).toBeGreaterThanOrEqual(0);
          expect(slot).toBeLessThan(count);
          const last = recent[recent.length - 1];
          const blocked = recent.length >= 2 && recent[recent.length - 2] === last ? last : undefined;
          expect(slot).not.toBe(blocked);
          const open = Array.from({ length: count }, (_, i) => i).filter((s) => s !== blocked);
          expect(counts[slot] ?? 0).toBeLessThanOrEqual(Math.min(...open.map((s) => counts[s] ?? 0)) + 1);
        },
      ),
    );
  });

  it('never a third time running, whatever the counts', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 2, max: 8 }), fc.nat({ max: 7 }), fc.array(fc.nat({ max: 3 }), { maxLength: 8 }), (seed, count, s, counts) => {
        const last = s % count;
        expect(chooseSlot(mulberry32(seed), count, [last, last], counts)).not.toBe(last);
      }),
    );
  });

  it('may repeat the last slot once, but not twice', () => {
    expect(outcomes((seed) => chooseSlot(mulberry32(seed), 2, [0], [1]))).toEqual([0, 1]);
    expect(outcomes((seed) => chooseSlot(mulberry32(seed), 3, [2], [0, 0, 1]))).toEqual([0, 1, 2]);
    // the last set ended in this slot and round 1 repeated it: balance alone would allow a third
    expect(outcomes((seed) => chooseSlot(mulberry32(seed), 2, [1, 1], [0, 1]))).toEqual([0]);
    expect(outcomes((seed) => chooseSlot(mulberry32(seed), 3, [2, 2], [0, 0, 1]))).toEqual([0, 1]);
  });

  it('measures the least-used over the slots it may still take', () => {
    // slot 0 is out (twice running) though least used, so balance compares slots 1 and 2 only
    expect(outcomes((seed) => chooseSlot(mulberry32(seed), 3, [0, 0], [0, 2, 1]))).toEqual([1, 2]);
  });

  it('does not force the last slot of a cycle', () => {
    // slots 0 and 1 used once, 2 not yet: forcing the least-used slot would make this round predictable
    expect(outcomes((seed) => chooseSlot(mulberry32(seed), 3, [0, 1], [1, 1]))).toEqual([0, 1, 2]);
  });

  it('waits with a slot that is more than one use ahead of the least-used', () => {
    // slot 0 used twice, 1 once, 2 not yet → 0 waits until slot 2 catches up, though it was not the last slot
    expect(outcomes((seed) => chooseSlot(mulberry32(seed), 3, [0, 0, 1], [2, 1, 0]))).toEqual([1, 2]);
  });

  it('breaks ties at random', () => {
    expect(outcomes((seed) => chooseSlot(mulberry32(seed), 4, [], []))).toEqual([0, 1, 2, 3]);
  });

  it('returns 0 for a single option', () => {
    expect(chooseSlot(mulberry32(1), 1, [0, 0], [2])).toBe(0);
  });
});

describe('placeAt', () => {
  it('inserts the correct item at the slot and keeps the others in order', () => {
    expect(placeAt('C', ['a', 'b', 'c'], 0)).toEqual(['C', 'a', 'b', 'c']);
    expect(placeAt('C', ['a', 'b', 'c'], 2)).toEqual(['a', 'b', 'C', 'c']);
    expect(placeAt('C', ['a', 'b', 'c'], 3)).toEqual(['a', 'b', 'c', 'C']);
  });
});
