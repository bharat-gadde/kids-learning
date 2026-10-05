// src/engine/progress/bridging.test.ts
import { describe, it, expect } from 'vitest';
import { preferredForm } from './bridging';
import type { Attempt, Outcome } from './types';

let t = 0;
const attempt = (form: string, outcome: Outcome): Attempt => ({
  profileId: 'p', at: ++t, sessionIndex: 1, templateId: 'x', topicId: 'tp', goalId: 'g', mechanic: 'tap-the-one',
  form, seed: 0, level: 1, outcome, hints: 0, durationMs: 1,
});

describe('preferredForm', () => {
  it('is null when the last attempt was correct', () => {
    expect(preferredForm([attempt('a', 'shown'), attempt('b', 'correct')])).toBeNull();
    expect(preferredForm([attempt('a', 'correct'), attempt('b', 'correct')])).toBeNull(); // a first success in a new form
  });

  it('is null when the failed form already had a success (not a "new form" miss)', () => {
    expect(preferredForm([attempt('b', 'correct'), attempt('b', 'shown')])).toBeNull();
    expect(preferredForm([attempt('a', 'correct'), attempt('b', 'correct'), attempt('b', 'shown')])).toBeNull(); // even with another form to go back to
  });

  it('returns the most recently successful other form after a miss on a new form', () => {
    expect(preferredForm([attempt('a', 'correct'), attempt('c', 'correct'), attempt('b', 'shown')])).toBe('c');
    expect(preferredForm([attempt('a', 'correct'), attempt('c', 'correct'), attempt('b', 'corrected')])).toBe('c');
  });

  it('does not count a corrected answer as a success: a hint pointed at it', () => {
    expect(preferredForm([attempt('a', 'correct'), attempt('b', 'corrected'), attempt('b', 'shown')])).toBe('a'); // b has no success yet
    expect(preferredForm([attempt('a', 'correct'), attempt('c', 'corrected'), attempt('b', 'shown')])).toBe('a'); // c is no form to go back to
  });

  it('is null when nothing has ever succeeded', () => {
    expect(preferredForm([attempt('b', 'shown')])).toBeNull();
    expect(preferredForm([])).toBeNull();
  });

  it('goes by time, in whatever order the attempts are given, and leaves the array as it was', () => {
    const [a, c, b] = [attempt('a', 'correct'), attempt('c', 'correct'), attempt('b', 'shown')];
    const given = [b, c, a];
    expect(preferredForm(given)).toBe('c');
    expect(given).toEqual([b, c, a]);
  });
});
