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
  });

  it('caps at level 3', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6), set(2, 6), set(3, 6), set(3, 6)])).toBe(3);
  });

  it('drops a level after a set at ≤50%, never below 1', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 3)])).toBe(1);
    expect(levelFor([set(1, 2)])).toBe(1);
  });

  it('ignores a set left before its first answer', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 0, 0)])).toBe(2);
  });

  it('a middling set breaks the streak', () => {
    expect(levelFor([set(1, 6), set(1, 4), set(1, 6)])).toBe(1);
  });
});
