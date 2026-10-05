// src/engine/progress/mastery.ts
import type { Attempt, GoalStatus, Outcome } from './types';

const WEIGHT: Record<Outcome, number> = { correct: 1, corrected: 0.5, shown: 0 };

/**
 * Spec §5.5. Over the last `window` attempts of one goal:
 * new (<4) · mastered (≥80% and ≥3 distinct forms with a fully correct answer) · needs-practice (<50%) · shaky.
 */
export function goalStatus(attempts: readonly Attempt[], window = 12): GoalStatus {
  const recent = [...attempts].sort((a, b) => a.at - b.at).slice(-window);
  if (recent.length < 4) return 'new';
  const rate = recent.reduce((sum, a) => sum + WEIGHT[a.outcome], 0) / recent.length;
  const formsWithCorrect = new Set(recent.filter((a) => a.outcome === 'correct').map((a) => a.form));
  if (rate >= 0.8 && formsWithCorrect.size >= 3) return 'mastered';
  if (rate < 0.5) return 'needs-practice';
  return 'shaky';
}

/** Per-form counts for the parent corner ("forms attempted"). */
export function formSummary(attempts: readonly Attempt[]): Array<{ form: string; attempts: number; correct: number }> {
  const byForm = new Map<string, { form: string; attempts: number; correct: number }>();
  for (const a of attempts) {
    const row = byForm.get(a.form) ?? { form: a.form, attempts: 0, correct: 0 };
    row.attempts += 1;
    if (a.outcome === 'correct') row.correct += 1;
    byForm.set(a.form, row);
  }
  return [...byForm.values()].sort((x, y) => y.attempts - x.attempts || x.form.localeCompare(y.form));
}
