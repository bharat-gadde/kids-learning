// src/engine/progress/difficulty.test.ts
import { describe, it, expect } from 'vitest';
import { levelFor } from './difficulty';
import type { SetResult } from './types';
import type { Level } from '../generator/types';

let t = 0;
const set = (level: Level, correct: number, total = 6): SetResult => ({
  profileId: 'p', at: ++t, sessionIndex: 1, templateId: 'x', goalId: 'g', level, correct, total,
});

describe('levelFor', () => {
  it('starts at level 1', () => {
    expect(levelFor([])).toBe(1);
  });

  it('goes up when a set and the one before it reach ≥85% together', () => {
    expect(levelFor([set(1, 6)])).toBe(1); // one set is never enough
    expect(levelFor([set(1, 6), set(1, 6)])).toBe(2);
    expect(levelFor([set(1, 6), set(1, 5)])).toBe(2); // 11 of 12: one slip across two six-round sets
    expect(levelFor([set(1, 5), set(1, 6)])).toBe(2);
    expect(levelFor([set(1, 5), set(1, 5)])).toBe(1); // 10 of 12
    expect(levelFor([set(1, 3, 4), set(1, 4, 4)])).toBe(2); // 7 of 8
    expect(levelFor([set(1, 3, 4), set(1, 3, 4)])).toBe(1); // 6 of 8
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6), set(2, 6)])).toBe(3);
  });

  it('rises at exactly 85% and not just below it', () => {
    expect(levelFor([set(1, 8, 10), set(1, 9, 10)])).toBe(2); // 17 of 20
    expect(levelFor([set(1, 6, 7), set(1, 5, 6)])).toBe(1); // 11 of 13, 84.6%
  });

  it('counts rounds, not the two sets\' percentages', () => {
    expect(levelFor([set(1, 2, 2), set(1, 8, 10)])).toBe(1); // 10 of 12 (the percentages average 90%)
  });

  it('caps at level 3', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6), set(2, 6), set(3, 6), set(3, 6)])).toBe(3);
  });

  it('drops a level after a set at ≤50%, never below 1, even when the two sets together would rise', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 3)])).toBe(1);
    expect(levelFor([set(1, 2)])).toBe(1);
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6), set(2, 6), set(3, 3)])).toBe(2); // one level at a time
    expect(levelFor([set(1, 6), set(1, 6), set(2, 5, 9)])).toBe(2); // 56% does not drop
    expect(levelFor([set(1, 6), set(1, 6), set(2, 10, 10), set(2, 1, 2)])).toBe(1); // 11 of 12 together, but 1 of 2
  });

  it('starts afresh after a rise and after a fall', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6)])).toBe(2); // the rise used both sets
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6), set(2, 2), set(1, 6)])).toBe(1); // one set after the fall
  });

  it('ignores a set with no rounds played', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 0, 0)])).toBe(2);
    expect(levelFor([set(1, 6), set(1, 0, 0), set(1, 6)])).toBe(2); // it does not separate the two sets either
  });

  it('judges a middling set together with the next one', () => {
    expect(levelFor([set(1, 6), set(1, 4), set(1, 6)])).toBe(1); // 10 of 12, then 10 of 12
    expect(levelFor([set(1, 4), set(1, 6), set(1, 6)])).toBe(2); // the last two: 12 of 12
  });

  it('skips a set recorded at another level than the replay has reached, and starts afresh', () => {
    expect(levelFor([set(2, 6), set(2, 6)])).toBe(1); // the replay never reached level 2
    expect(levelFor([set(1, 6), set(3, 6), set(1, 6)])).toBe(1); // a higher one
    expect(levelFor([set(1, 6), set(1, 6), set(1, 6), set(2, 6)])).toBe(2); // a lower one
  });

  it('replays the sets by time, in whatever order they are given, and leaves the array as it was', () => {
    const [first, middling, last] = [set(1, 6), set(1, 4), set(1, 6)];
    const given = [first, last, middling];
    expect(levelFor(given)).toBe(1); // in time order the middling set comes between the two good ones
    expect(given).toEqual([first, last, middling]);
  });
});
