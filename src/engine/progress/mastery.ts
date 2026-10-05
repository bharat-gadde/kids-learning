// src/engine/progress/mastery.ts
import type { Attempt, GoalStatus } from './types';

/** Spec §5.5: a goal's status looks at its last 12 attempts. */
const WINDOW = 12;

/**
 * Spec §5.5. Over the last 12 attempts of one goal, by `at`:
 * new (<4) · mastered (≥80% correct and ≥3 distinct forms with a correct answer) · needs-practice (<50% correct) · shaky.
 * Only the `correct` outcome counts as correct: a `corrected` answer came after a hint pointed at it (see Outcome).
 */
export function goalStatus(attempts: readonly Attempt[]): GoalStatus {
  const recent = [...attempts].sort((a, b) => a.at - b.at).slice(-WINDOW);
  if (recent.length < 4) return 'new';
  const correct = recent.filter((a) => a.outcome === 'correct');
  const rate = correct.length / recent.length;
  const forms = new Set(correct.map((a) => a.form)).size;
  if (rate >= 0.8 && forms >= 3) return 'mastered';
  if (rate < 0.5) return 'needs-practice';
  return 'shaky';
}

/** One form's row in the parent corner's "forms attempted" (spec §8). */
export interface FormSummaryRow {
  form: string;
  attempts: number;
  /** attempts whose outcome was `correct` */
  correct: number;
}

/** Per-form counts over the attempts given: most attempted first, then by form key. */
export function formSummary(attempts: readonly Attempt[]): FormSummaryRow[] {
  const byForm = new Map<string, FormSummaryRow>();
  for (const a of attempts) {
    const row = byForm.get(a.form) ?? { form: a.form, attempts: 0, correct: 0 };
    row.attempts += 1;
    if (a.outcome === 'correct') row.correct += 1;
    byForm.set(a.form, row);
  }
  return [...byForm.values()].sort((x, y) => y.attempts - x.attempts || (x.form < y.form ? -1 : x.form > y.form ? 1 : 0));
}
