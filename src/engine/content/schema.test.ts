// src/engine/content/schema.test.ts
import { describe, it, expect } from 'vitest';
import { ObjectItemSchema, TemplateSchema, LineSchema, RawPackSchema, MECHANICS } from './schema';

const template = {
  id: 'big-small.tap',
  topicId: 'big-small',
  goalId: 'big-small.identify',
  mechanic: 'tap-the-one',
  itemClass: 'objects',
  query: { pool: 'objects', tags: { sizePair: true } },
  rule: { kind: 'size', target: 'larger' },
  rounds: 6,
  difficulty: [
    { options: 2, distractorSimilarity: 'low' },
    { options: 3, distractorSimilarity: 'medium' },
    { options: 4, distractorSimilarity: 'high' },
  ],
  flavour: { scenes: ['garden'], promptLineId: 'prompt.tap_big' },
  level: 'lkg',
};

describe('ObjectItemSchema', () => {
  it('accepts a minimal object and defaults tags', () => {
    const r = ObjectItemSchema.safeParse({ id: 'apple', name: 'apple', lineId: 'obj.apple', asset: 'objects/apple.svg', category: 'fruit' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tags).toEqual({});
  });

  it('rejects an unknown tag', () => {
    const r = ObjectItemSchema.safeParse({ id: 'apple', name: 'apple', lineId: 'obj.apple', asset: 'a.svg', category: 'fruit', tags: { shiny: true } });
    expect(r.success).toBe(false);
  });
});

describe('TemplateSchema', () => {
  it('accepts a valid template', () => {
    expect(TemplateSchema.safeParse(template).success).toBe(true);
  });

  it('rejects an unknown mechanic', () => {
    expect(TemplateSchema.safeParse({ ...template, mechanic: 'juggle' }).success).toBe(false);
  });

  it('requires exactly three difficulty levels', () => {
    expect(TemplateSchema.safeParse({ ...template, difficulty: template.difficulty.slice(0, 2) }).success).toBe(false);
  });

  it('rejects a rule with the wrong shape', () => {
    expect(TemplateSchema.safeParse({ ...template, rule: { kind: 'size' } }).success).toBe(false);
  });
});

describe('LineSchema', () => {
  it('requires at least one variant', () => {
    expect(LineSchema.safeParse({ id: 'x', variants: [] }).success).toBe(false);
    expect(LineSchema.safeParse({ id: 'x', variants: ['Tap the {target}'] }).success).toBe(true);
  });
});

describe('RawPackSchema', () => {
  it('accepts an empty pack with all collections present', () => {
    const r = RawPackSchema.safeParse({ topics: [], objects: [], glyphs: [], scenes: [], lines: [], scenarios: [], sequences: [], templates: [] });
    expect(r.success).toBe(true);
  });

  it('lists 23 mechanics', () => {
    expect(MECHANICS.length).toBe(23);
  });
});
