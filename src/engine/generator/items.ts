// src/engine/generator/items.ts
import type { ContentPack } from '../content/load';
import type { Glyph, ObjectItem, ObjectTags, Query } from '../content/schema';
import type { RoundItem } from './types';

/** A pool entry. `id` mirrors `item.id` so candidates can be sampled (and de-duplicated) by id. */
export type Candidate =
  | { kind: 'object'; id: string; item: ObjectItem }
  | { kind: 'glyph'; id: string; item: Glyph };

export const objectCandidate = (item: ObjectItem): Candidate => ({ kind: 'object', id: item.id, item });
export const glyphCandidate = (item: Glyph): Candidate => ({ kind: 'glyph', id: item.id, item });

/** Every filter must hold, for either pool: a glyph has no tags, and an object never passes a glyph filter. */
function matches(c: Candidate, q: Query): boolean {
  if (q.ids && !q.ids.includes(c.id)) return false;
  if (q.category && !q.category.includes(categoryOf(c))) return false;
  if (q.tags) {
    for (const [key, value] of Object.entries(q.tags)) {
      if (value !== undefined && tagOf(c, key as keyof ObjectTags) !== value) return false;
    }
  }
  if (q.hasTags) {
    for (const key of q.hasTags) if (tagOf(c, key) === undefined) return false;
  }
  const f = q.glyph;
  if (f) {
    if (c.kind !== 'glyph') return false;
    const g = c.item;
    if (f.kind && g.kind !== f.kind) return false;
    if (f.case && g.case !== f.case) return false;
    if (f.min !== undefined && (g.value === undefined || g.value < f.min)) return false;
    if (f.max !== undefined && (g.value === undefined || g.value > f.max)) return false;
  }
  return true;
}

/** All pool entries matching a template query, in pack order (deterministic). */
export function queryItems(pack: ContentPack, q: Query): Candidate[] {
  const pool = q.pool === 'objects' ? [...pack.objects.values()].map(objectCandidate) : [...pack.glyphs.values()].map(glyphCandidate);
  return pool.filter((c) => matches(c, q));
}

export function toRoundItem(c: Candidate): RoundItem {
  if (c.kind === 'object') return { id: c.item.id, label: c.item.name, lineId: c.item.lineId, asset: c.item.asset };
  return { id: c.item.id, label: c.item.char, lineId: c.item.lineId, asset: `glyph:${c.item.char}` };
}

export function categoryOf(c: Candidate): string {
  if (c.kind === 'object') return c.item.category;
  return c.item.case ? `glyph-${c.item.kind}-${c.item.case}` : `glyph-${c.item.kind}`;
}

export function tagOf<K extends keyof ObjectTags>(c: Candidate, tag: K): ObjectTags[K] {
  return c.kind === 'object' ? c.item.tags[tag] : undefined;
}

export function pluralOf(o: ObjectItem): string {
  return o.plural ?? `${o.name}s`;
}
