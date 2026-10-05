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
  });

  it('is null when the failed form already had a success (not a "new form" miss)', () => {
    expect(preferredForm([attempt('b', 'correct'), attempt('b', 'shown')])).toBeNull();
  });

  it('returns the most recently successful other form after a miss on a new form', () => {
    expect(preferredForm([attempt('a', 'correct'), attempt('c', 'correct'), attempt('b', 'shown')])).toBe('c');
    expect(preferredForm([attempt('a', 'correct'), attempt('c', 'correct'), attempt('b', 'corrected')])).toBe('c');
  });

  it('is null when nothing has ever succeeded', () => {
    expect(preferredForm([attempt('b', 'shown')])).toBeNull();
    expect(preferredForm([])).toBeNull();
  });
});
