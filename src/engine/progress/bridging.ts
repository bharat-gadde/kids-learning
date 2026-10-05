import type { Attempt } from './types';

/**
 * Spec §5.5 bridging. After a miss in a form that has never succeeded, return the most recently
 * successful *other* form so the next round can bridge back to it. Otherwise null.
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
