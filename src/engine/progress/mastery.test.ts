// src/engine/progress/mastery.test.ts
import { describe, it, expect } from 'vitest';
import { goalStatus, formSummary } from './mastery';
import type { Attempt, Outcome } from './types';

let t = 0;
const attempt = (form: string, outcome: Outcome): Attempt => ({
  profileId: 'p', at: ++t, sessionIndex: 1, templateId: 'x', topicId: 'big-small', goalId: 'g', mechanic: 'tap-the-one',
  form, seed: 0, level: 1, outcome, hints: 0, durationMs: 1000,
});
const many = (n: number, form: string, outcome: Outcome) => Array.from({ length: n }, () => attempt(form, outcome));

describe('goalStatus', () => {
  it('is new with fewer than 4 attempts', () => {
    expect(goalStatus([])).toBe('new');
    expect(goalStatus(many(3, 'a', 'correct'))).toBe('new');
  });

  it('is mastered only with ≥80% and ≥3 distinct successful forms', () => {
    expect(goalStatus([...many(3, 'a', 'correct'), ...many(3, 'b', 'correct'), ...many(3, 'c', 'correct')])).toBe('mastered');
    expect(goalStatus([...many(5, 'a', 'correct'), ...many(5, 'b', 'correct')])).toBe('shaky');
  });

  it('is needs-practice below 50%', () => {
    expect(goalStatus([...many(2, 'a', 'correct'), ...many(4, 'b', 'shown')])).toBe('needs-practice');
  });

  it('weighs corrected answers as half', () => {
    // 4 corrected = 2.0 / 4 = 50% → shaky, not needs-practice
    expect(goalStatus(many(4, 'a', 'corrected'))).toBe('shaky');
  });

  it('only looks at the last 12 attempts', () => {
    const old = many(12, 'a', 'shown');
    const recent = [...many(4, 'a', 'correct'), ...many(4, 'b', 'correct'), ...many(4, 'c', 'correct')];
    expect(goalStatus([...old, ...recent])).toBe('mastered');
  });
});

describe('formSummary', () => {
  it('counts attempts and correct answers per form, most attempted first', () => {
    const attempts = [...many(3, 'a', 'correct'), attempt('a', 'shown'), ...many(2, 'b', 'corrected')];
    expect(formSummary(attempts)).toEqual([
      { form: 'a', attempts: 4, correct: 3 },
      { form: 'b', attempts: 2, correct: 0 },
    ]);
  });
});
