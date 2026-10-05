// src/engine/generator/slots.ts
import { pick, type Rng } from '../rng';

/** The answer may sit in one slot for at most this many rounds running. */
const MAX_RUN = 2;

/**
 * Slot for the correct option (variation rule 2), so a child can't win by position.
 * `recent` holds the earlier correct slots, oldest → newest: the previous set's last slot (if known), then this set's.
 * `counts` tallies this set's slots only, and may be sparse.
 * The same slot may hold the answer twice running but never three times: "never twice" would make "anywhere but
 * last time" pay, and with two options it is strict left-right alternation. The answer only goes to a slot at most one
 * use ahead of the least-used (so no slot ends more than two ahead), rather than always to the least-used: that would
 * decide every second two-option round, and the last round of a cycle.
 */
export function chooseSlot(rng: Rng, optionCount: number, recent: readonly number[], counts: readonly number[]): number {
  if (optionCount <= 0) throw new Error('optionCount must be positive');
  if (optionCount === 1) return 0;
  const last = recent[recent.length - 1];
  let run = 0;
  while (run < recent.length && recent[recent.length - 1 - run] === last) run++;
  const allowed = Array.from({ length: optionCount }, (_, i) => i).filter((s) => s !== last || run < MAX_RUN);
  const least = Math.min(...allowed.map((s) => counts[s] ?? 0));
  return pick(rng, allowed.filter((s) => (counts[s] ?? 0) <= least + 1));
}

/** Insert `correct` into `others` at `slot` (clamped to the end). Keeps the others' order: shuffle them first. */
export function placeAt<T>(correct: T, others: readonly T[], slot: number): T[] {
  const out = [...others];
  out.splice(Math.min(slot, out.length), 0, correct);
  return out;
}
