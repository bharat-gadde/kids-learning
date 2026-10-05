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
/** n correct answers taking turns over forms a, b and c */
const correctIn3Forms = (n: number) => Array.from({ length: n }, (_, i) => attempt('abc'[i % 3]!, 'correct'));

describe('goalStatus', () => {
  it('is new with fewer than 4 attempts', () => {
    expect(goalStatus([])).toBe('new');
    expect(goalStatus(many(3, 'a', 'correct'))).toBe('new');
    expect(goalStatus([...correctIn3Forms(3), attempt('a', 'shown')])).toBe('shaky'); // 4 attempts are judged
  });

  it('is mastered from exactly 80% correct, with correct answers in 3 distinct forms', () => {
    expect(goalStatus([...correctIn3Forms(8), ...many(2, 'a', 'shown')])).toBe('mastered'); // 8 of 10
    expect(goalStatus([...correctIn3Forms(7), ...many(2, 'a', 'shown')])).toBe('shaky'); // 7 of 9, the nearest below 80%
    expect(goalStatus([...many(10, 'a', 'correct'), attempt('b', 'correct'), attempt('c', 'correct')])).toBe('mastered');
    expect(goalStatus([...many(6, 'a', 'correct'), ...many(6, 'b', 'correct')])).toBe('shaky'); // 2 forms
  });

  it('is needs-practice below 50% correct', () => {
    expect(goalStatus([...many(5, 'a', 'correct'), ...many(6, 'b', 'shown')])).toBe('needs-practice'); // 5 of 11, the nearest below 50%
    expect(goalStatus([...many(6, 'a', 'correct'), ...many(6, 'b', 'shown')])).toBe('shaky'); // exactly half
  });

  it('does not count a corrected answer as correct: it came after a hint', () => {
    expect(goalStatus(many(4, 'a', 'corrected'))).toBe('needs-practice');
    expect(goalStatus([...many(5, 'a', 'correct'), ...many(6, 'b', 'corrected')])).toBe('needs-practice');
    expect(goalStatus([...correctIn3Forms(9), ...many(3, 'a', 'corrected')])).toBe('shaky'); // 9 of 12
    // a form whose answers were all corrected is not a form with a correct answer
    expect(goalStatus([...many(5, 'a', 'correct'), ...many(5, 'b', 'correct'), ...many(2, 'c', 'corrected')])).toBe('shaky');
  });

  it('only looks at the last 12 attempts', () => {
    expect(goalStatus([attempt('a', 'shown'), ...correctIn3Forms(10), ...many(2, 'a', 'shown')])).toBe('mastered'); // the 13th from last is out
    expect(goalStatus([attempt('a', 'shown'), ...correctIn3Forms(9), ...many(2, 'a', 'shown')])).toBe('shaky'); // the 12th from last is in
    expect(goalStatus([attempt('c', 'correct'), ...many(6, 'a', 'correct'), ...many(6, 'b', 'correct')])).toBe('shaky'); // so is form c's answer
  });

  it('takes the last 12 by time, in whatever order they are given, and leaves the array as it was', () => {
    const old = many(12, 'a', 'shown');
    const recent = correctIn3Forms(12);
    const given = [...recent, ...old];
    expect(goalStatus(given)).toBe('mastered');
    expect(given).toEqual([...recent, ...old]);
  });
});

describe('formSummary', () => {
  it('counts attempts and correct answers per form, most attempted first', () => {
    const attempts = [...many(2, 'b', 'corrected'), ...many(3, 'a', 'correct'), attempt('a', 'shown')];
    expect(formSummary(attempts)).toEqual([
      { form: 'a', attempts: 4, correct: 3 },
      { form: 'b', attempts: 2, correct: 0 },
    ]);
  });

  it('lists forms with as many attempts in key order', () => {
    expect(formSummary([attempt('b', 'correct'), attempt('a', 'shown')]).map((row) => row.form)).toEqual(['a', 'b']);
  });
});
