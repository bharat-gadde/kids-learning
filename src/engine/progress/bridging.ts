// src/engine/progress/bridging.ts
import type { Attempt } from './types';

/**
 * Spec §5.5 bridging, between sets: a set plays one template, so one form. Takes one goal's attempts. When the last
 * ended `shown` or `corrected` in a form with no earlier `correct`, returns the form of the most recent `correct`
 * attempt in another form, so the goal's next set can bridge back to it. Otherwise null.
 */
export function preferredForm(attempts: readonly Attempt[]): string | null {
  const sorted = [...attempts].sort((a, b) => a.at - b.at);
  const last = sorted[sorted.length - 1];
  if (!last || last.outcome === 'correct') return null;
  const earlier = sorted.slice(0, -1);
  if (earlier.some((a) => a.form === last.form && a.outcome === 'correct')) return null;
  const known = earlier.filter((a) => a.outcome === 'correct' && a.form !== last.form);
  const bridge = known[known.length - 1];
  return bridge ? bridge.form : null;
}
