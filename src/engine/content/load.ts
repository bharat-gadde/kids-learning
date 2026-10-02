// src/engine/content/load.ts
import { z } from 'zod';
import {
  RawPackSchema,
  type RawPack, type Topic, type Goal, type ObjectItem, type Glyph, type Scene, type Line,
  type Scenario, type Sequence, type Template,
} from './schema';

export class ContentError extends Error {
  override name = 'ContentError';
}

export type PackGoal = Goal & { readonly topicId: string };

export interface ContentPack {
  readonly raw: RawPack;
  readonly topics: ReadonlyMap<string, Topic>;
  readonly goals: ReadonlyMap<string, PackGoal>;
  readonly objects: ReadonlyMap<string, ObjectItem>;
  readonly glyphs: ReadonlyMap<string, Glyph>;
  readonly scenes: ReadonlyMap<string, Scene>;
  readonly lines: ReadonlyMap<string, Line>;
  readonly scenarios: ReadonlyMap<string, Scenario>;
  readonly sequences: ReadonlyMap<string, Sequence>;
  readonly templates: ReadonlyMap<string, Template>;
  /** templates per topic, in pack order (files sorted by name, then file order) — the picker's seeded choices depend on it */
  readonly templatesByTopic: ReadonlyMap<string, readonly Template[]>;
}

function indexById<T extends { id: string }>(items: readonly T[], what: string): Map<string, T> {
  const m = new Map<string, T>();
  for (const item of items) {
    if (m.has(item.id)) throw new ContentError(`duplicate ${what} id: ${item.id}`);
    m.set(item.id, item);
  }
  return m;
}

/** The `id` of the collection element an issue points into, so a message names the item rather than only its index. */
function idAt(input: unknown, path: readonly PropertyKey[]): string | undefined {
  const [collection, index] = path;
  if (typeof collection !== 'string' || typeof index !== 'number') return undefined;
  const list = (input as Record<string, unknown> | null | undefined)?.[collection];
  const id = Array.isArray(list) ? (list[index] as { id?: unknown } | null | undefined)?.id : undefined;
  return typeof id === 'string' ? id : undefined;
}

/** Parse raw JSON into an indexed pack. Throws ContentError on schema errors or duplicate ids. */
export function loadPack(input: unknown): ContentPack {
  const parsed = RawPackSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const id = idAt(input, issue.path);
      return id === undefined ? issue : { ...issue, message: `${issue.message} (in ${String(issue.path[0])} "${id}")` };
    });
    throw new ContentError(z.prettifyError({ issues }));
  }
  const raw = parsed.data;

  const topics = indexById(raw.topics, 'topic');
  const goals = new Map<string, PackGoal>();
  for (const t of raw.topics) {
    for (const g of t.goals) {
      if (goals.has(g.id)) throw new ContentError(`duplicate goal id: ${g.id}`);
      goals.set(g.id, { ...g, topicId: t.id });
    }
  }
  const templates = indexById(raw.templates, 'template');
  const templatesByTopic = new Map<string, Template[]>();
  for (const t of raw.topics) templatesByTopic.set(t.id, []);
  for (const tpl of raw.templates) {
    const list = templatesByTopic.get(tpl.topicId) ?? [];
    list.push(tpl);
    templatesByTopic.set(tpl.topicId, list);
  }

  return {
    raw,
    topics,
    goals,
    objects: indexById(raw.objects, 'object'),
    glyphs: indexById(raw.glyphs, 'glyph'),
    scenes: indexById(raw.scenes, 'scene'),
    lines: indexById(raw.lines, 'line'),
    scenarios: indexById(raw.scenarios, 'scenario'),
    sequences: indexById(raw.sequences, 'sequence'),
    templates,
    templatesByTopic,
  };
}
