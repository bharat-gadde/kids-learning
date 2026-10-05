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

  it('goes up after two consecutive sets at ≥85%', () => {
    expect(levelFor([set(1, 6)])).toBe(1);
    expect(levelFor([set(1, 6), set(1, 6)])).toBe(2);
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6), set(2, 6)])).toBe(3);
    expect(levelFor([set(1, 6, 7), set(1, 6, 7)])).toBe(2); // 86%, the nearest above 85% a set of up to 10 rounds allows
    expect(levelFor([set(1, 5), set(1, 5)])).toBe(1); // 83%, the nearest below
  });

  it('caps at level 3', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6), set(2, 6), set(3, 6), set(3, 6)])).toBe(3);
  });

  it('drops a level after a set at ≤50%, never below 1', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 3)])).toBe(1);
    expect(levelFor([set(1, 2)])).toBe(1);
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6), set(2, 6), set(3, 3)])).toBe(2); // one level at a time
    expect(levelFor([set(1, 6), set(1, 6), set(2, 5, 9)])).toBe(2); // 56%, the nearest above 50% a set of up to 10 rounds allows
  });

  it('starts a new streak after a rise and after a fall', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6)])).toBe(2); // the rise used both sets
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6), set(2, 2), set(1, 6)])).toBe(1); // the fall ended the level-2 streak
  });

  it('ignores a set with no rounds played', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 0, 0)])).toBe(2);
    expect(levelFor([set(1, 6), set(1, 0, 0), set(1, 6)])).toBe(2); // it does not break a streak either
  });

  it('a middling set breaks the streak', () => {
    expect(levelFor([set(1, 6), set(1, 4), set(1, 6)])).toBe(1);
  });

  it('skips a set recorded at another level than the replay has reached, and breaks the streak', () => {
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
