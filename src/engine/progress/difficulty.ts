// src/engine/progress/difficulty.ts
import type { Level } from '../generator/types';
import type { SetResult } from './types';

/**
 * Spec §5.4 rule 7: the level for a template's next set. Replays all of the template's set results in time order from
 * level 1, so pass every one of them (setResultsForTemplate), not the latest few:
 * a set at ≤50% lowers the level (min 1); otherwise, when this set and the one before it at this level reach ≥85%
 * together — their correct rounds over their rounds — the level rises (max 3). A rise or a fall starts afresh.
 * Judged together because M1's sets are 2–6 rounds, where "each of two sets at ≥85%" meant two perfect sets; together,
 * one slip across two 4–6-round sets still rises (parent decision, 2026-10-06).
 * A set recorded at another level than the replay has reached (under other rules, say) is skipped and starts afresh;
 * a set with no rounds played is skipped.
 */
export function levelFor(results: readonly SetResult[]): Level {
  let level: Level = 1;
  let previous: SetResult | null = null;
  for (const r of [...results].sort((a, b) => a.at - b.at)) {
    if (r.total === 0) continue; // no rounds played: nothing to judge
    if (r.level !== level) {
      previous = null;
      continue;
    }
    if (r.correct / r.total <= 0.5) {
      if (level > 1) level = (level - 1) as Level;
      previous = null;
    } else if (previous && level < 3 && (previous.correct + r.correct) / (previous.total + r.total) >= 0.85) {
      level = (level + 1) as Level;
      previous = null;
    } else {
      previous = r;
    }
  }
  return level;
}
