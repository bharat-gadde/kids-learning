// src/engine/generator/sampling.ts
import { shuffle, type Rng } from '../rng';
import type { Difficulty } from '../content/schema';
import { categoryOf, tagOf, type Candidate } from './items';

/**
 * Pick `n` distinct entries (none when `n` ≤ 0), preferring ones whose id is not in `recent`.
 * `recent` is ordered oldest → newest; when fresh entries run out, the least recently used fill in.
 * That fallback draws nothing: stale entries come back in `recent`'s order, so a caller whose ids are
 * equally old (all from the last 3 sessions, say) shuffles them first, or a small pool repeats its order.
 */
export function sampleWithoutRecent<T extends { id: string }>(
  rng: Rng,
  pool: readonly T[],
  n: number,
  recent: readonly string[],
): T[] {
  if (n <= 0) return [];
  const recency = new Map<string, number>();
  recent.forEach((id, i) => recency.set(id, i));
  const fresh = shuffle(rng, pool.filter((p) => !recency.has(p.id)));
  if (fresh.length >= n) return fresh.slice(0, n);
  const stale = pool
    .filter((p) => recency.has(p.id))
    .sort((a, b) => (recency.get(a.id) ?? 0) - (recency.get(b.id) ?? 0));
  return [...fresh, ...stale].slice(0, n);
}

function isConfusable(a: Candidate, b: Candidate): boolean {
  if (a.kind === 'glyph' && b.kind === 'glyph') return a.item.confusables.includes(b.item.char);
  if (a.kind === 'object' && b.kind === 'object') {
    const colour = tagOf(a, 'colour');
    return colour !== undefined && colour === tagOf(b, 'colour');
  }
  return false;
}

/**
 * Distractors for `correct`, chosen by similarity to its first entry:
 * low → other categories first; medium → same category first;
 * high → confusables (glyph list / shared colour) first, then same category, then the rest.
 * Never a correct entry, nor anything spoken like one. Returned in that order of preference,
 * so a caller laying them out shuffles them first.
 */
export function pickDistractors(
  rng: Rng,
  pool: readonly Candidate[],
  correct: readonly Candidate[],
  n: number,
  similarity: Difficulty['distractorSimilarity'],
): Candidate[] {
  const first = correct[0];
  // Never offer the answer itself, or anything *spoken* the same (the letters "B" and "b" share one line).
  const excludeIds = new Set(correct.map((c) => c.id));
  const excludeLines = new Set(correct.map((c) => c.item.lineId));
  const rest = pool.filter((c) => !excludeIds.has(c.id) && !excludeLines.has(c.item.lineId));
  if (!first || rest.length === 0 || n <= 0) return [];

  const sameCategory = rest.filter((c) => categoryOf(c) === categoryOf(first));
  const otherCategory = rest.filter((c) => categoryOf(c) !== categoryOf(first));
  let buckets: Candidate[][];
  if (similarity === 'low') buckets = [otherCategory, sameCategory];
  else if (similarity === 'medium') buckets = [sameCategory, otherCategory];
  else {
    const confusable = rest.filter((c) => isConfusable(first, c));
    const confusableIds = new Set(confusable.map((c) => c.id));
    buckets = [confusable, sameCategory.filter((c) => !confusableIds.has(c.id)), otherCategory.filter((c) => !confusableIds.has(c.id))];
  }

  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const bucket of buckets) {
    for (const c of shuffle(rng, bucket)) {
      if (out.length >= n) return out;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}
