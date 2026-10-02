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

export interface ContentPack {
  raw: RawPack;
  topics: Map<string, Topic>;
  goals: Map<string, Goal & { topicId: string }>;
  objects: Map<string, ObjectItem>;
  glyphs: Map<string, Glyph>;
  scenes: Map<string, Scene>;
  lines: Map<string, Line>;
  scenarios: Map<string, Scenario>;
  sequences: Map<string, Sequence>;
  templates: Map<string, Template>;
  templatesByTopic: Map<string, Template[]>;
}

function indexById<T extends { id: string }>(items: readonly T[], what: string): Map<string, T> {
  const m = new Map<string, T>();
  for (const item of items) {
    if (m.has(item.id)) throw new ContentError(`duplicate ${what} id: ${item.id}`);
    m.set(item.id, item);
  }
  return m;
}

/** Parse raw JSON into an indexed pack. Throws ContentError on schema errors or duplicate ids. */
export function loadPack(input: unknown): ContentPack {
  const parsed = RawPackSchema.safeParse(input);
  if (!parsed.success) throw new ContentError(z.prettifyError(parsed.error));
  const raw = parsed.data;

  const topics = indexById(raw.topics, 'topic');
  const goals = new Map<string, Goal & { topicId: string }>();
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
