// src/engine/generator/slots.ts
import { pick, type Rng } from '../rng';

/** Slot for the correct option: never the last slot, and the least-used slot so far in the set. */
export function chooseSlot(rng: Rng, optionCount: number, lastSlot: number | null, counts: readonly number[]): number {
  if (optionCount <= 0) throw new Error('optionCount must be positive');
  if (optionCount === 1) return 0;
  const candidates = Array.from({ length: optionCount }, (_, i) => i).filter((s) => s !== lastSlot);
  const minCount = Math.min(...candidates.map((s) => counts[s] ?? 0));
  return pick(rng, candidates.filter((s) => (counts[s] ?? 0) === minCount));
}

/** Insert `correct` into `others` at `slot` (clamped to the end). */
export function placeAt<T>(correct: T, others: readonly T[], slot: number): T[] {
  const out = [...others];
  out.splice(Math.min(slot, out.length), 0, correct);
  return out;
}
