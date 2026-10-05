import type { Level } from '../generator/types';
import type { SetResult } from './types';

/**
 * Spec §5.4 rule 7. Replays a template's set results in time order:
 * two consecutive sets at ≥85% raise the level (max 3); a set at ≤50% lowers it (min 1); anything else resets the streak;
 * a set with no rounds played is skipped.
 */
export function levelFor(results: readonly SetResult[]): Level {
  let level: Level = 1;
  let streak = 0;
  for (const r of [...results].sort((a, b) => a.at - b.at)) {
    if (r.total === 0) continue; // a set left before its first answer says nothing about the level
    if (r.level !== level) {
      streak = 0;
      continue;
    }
    const rate = r.correct / r.total;
    if (rate >= 0.85) {
      streak += 1;
      if (streak >= 2 && level < 3) {
        level = (level + 1) as Level;
        streak = 0;
      }
    } else if (rate <= 0.5) {
      if (level > 1) level = (level - 1) as Level;
      streak = 0;
    } else {
      streak = 0;
    }
  }
  return level;
}
