// src/engine/content/schema.test.ts
import { describe, it, expect } from 'vitest';
import {
  DifficultySchema, GlyphSchema, LineSchema, MECHANICS, ObjectItemSchema, QuerySchema, RawPackSchema, ScenarioSchema,
  TemplateSchema, TopicSchema,
} from './schema';

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
    expect(TemplateSchema.safeParse({ ...template, difficulty: [...template.difficulty, template.difficulty[2]] }).success).toBe(false);
  });

  it('rejects a rule with the wrong shape', () => {
    expect(TemplateSchema.safeParse({ ...template, rule: { kind: 'size' } }).success).toBe(false);
  });

  it('rejects a misspelled optional key anywhere in a template', () => {
    const [d1, d2, d3] = template.difficulty;
    expect(TemplateSchema.safeParse({ ...template, difficulty: [d1, d2, { ...d3, correctcount: 4 }] }).success).toBe(false);
    expect(TemplateSchema.safeParse({ ...template, flavour: { ...template.flavour, musik: 'calm' } }).success).toBe(false);
  });
});

describe('QuerySchema', () => {
  it('rejects misspelled keys, including inside tags and the glyph filter', () => {
    expect(QuerySchema.safeParse({ pool: 'objects', categroy: ['feeling'] }).success).toBe(false);
    expect(QuerySchema.safeParse({ pool: 'objects', tags: { shinny: true } }).success).toBe(false);
    expect(QuerySchema.safeParse({ pool: 'glyphs', glyph: { knd: 'letter' } }).success).toBe(false);
    expect(QuerySchema.safeParse({ pool: 'objects', category: ['feeling'], tags: { healthy: true } }).success).toBe(true);
  });
});

describe('DifficultySchema', () => {
  it('rejects an inverted range', () => {
    expect(DifficultySchema.safeParse({ options: 3, distractorSimilarity: 'low', range: [5, 1] }).success).toBe(false);
    expect(DifficultySchema.safeParse({ options: 3, distractorSimilarity: 'low', range: [1, 5] }).success).toBe(true);
  });
});

describe('GlyphSchema', () => {
  const ten = { id: 'n10', char: '10', kind: 'number', pairKey: 'n10', value: 10, lineId: 'glyph.num.10' };

  it('accepts a two-character numeral and defaults confusables', () => {
    const r = GlyphSchema.safeParse(ten);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.confusables).toEqual([]);
  });

  it('requires a value for numbers and a case for letters', () => {
    const { value: _value, ...noValue } = ten;
    expect(GlyphSchema.safeParse(noValue).success).toBe(false);
    const b = { id: 'b', char: 'b', kind: 'letter', pairKey: 'b', lineId: 'glyph.letter.b' };
    expect(GlyphSchema.safeParse(b).success).toBe(false);
    expect(GlyphSchema.safeParse({ ...b, case: 'lower' }).success).toBe(true);
  });
});

describe('TopicSchema', () => {
  it('takes a picture or one or two letters as its signpost, or none', () => {
    const topic = { id: 't', subject: 'literacy', title: 'T', goals: [{ id: 'g', title: 'G' }] };
    for (const asset of [undefined, 'topics/rhyming.svg', 'glyph:A', 'glyph:Aa']) expect(TopicSchema.safeParse({ ...topic, asset }).success, asset).toBe(true);
    for (const asset of ['', 'glyph:', 'glyph:Letters']) expect(TopicSchema.safeParse({ ...topic, asset }).success, asset).toBe(false);
  });
});

describe('ScenarioSchema', () => {
  it('allows two or three choices', () => {
    const choice = (objectId: string, correct: boolean) => ({ objectId, correct });
    const sc = { id: 'sc', topicId: 't', narrationLineId: 'sc', vignette: 'v.svg' };
    expect(ScenarioSchema.safeParse({ ...sc, choices: [choice('a', true)] }).success).toBe(false);
    expect(ScenarioSchema.safeParse({ ...sc, choices: [choice('a', true), choice('b', false)] }).success).toBe(true);
    expect(ScenarioSchema.safeParse({ ...sc, choices: [choice('a', true), choice('b', false), choice('c', false)] }).success).toBe(true);
    expect(ScenarioSchema.safeParse({ ...sc, choices: [choice('a', true), choice('b', false), choice('c', false), choice('d', false)] }).success).toBe(false);
  });
});

describe('LineSchema', () => {
  it('requires at least one variant', () => {
    expect(LineSchema.safeParse({ id: 'x', variants: [] }).success).toBe(false);
    expect(LineSchema.safeParse({ id: 'x', variants: ['Tap the {target}'] }).success).toBe(true);
  });

  it('restricts ids to lowercase file-name-safe characters', () => {
    expect(LineSchema.safeParse({ id: 'obj.ice-cream', variants: ['ice cream'] }).success).toBe(true);
    expect(LineSchema.safeParse({ id: 'obj/ice cream#1', variants: ['ice cream'] }).success).toBe(false);
    expect(LineSchema.safeParse({ id: 'Obj.Apple', variants: ['apple'] }).success).toBe(false);
  });

  it('applies the same rule to every reference to a line', () => {
    const apple = { id: 'apple', name: 'apple', asset: 'objects/apple.svg', category: 'fruit' };
    expect(ObjectItemSchema.safeParse({ ...apple, lineId: 'obj.apple' }).success).toBe(true);
    expect(ObjectItemSchema.safeParse({ ...apple, lineId: '../../escape' }).success).toBe(false);
    expect(ObjectItemSchema.safeParse({ ...apple, lineId: 'obj/apple' }).success).toBe(false);
  });
});

describe('RawPackSchema', () => {
  it('accepts an empty pack with all collections present', () => {
    const r = RawPackSchema.safeParse({ topics: [], objects: [], glyphs: [], scenes: [], lines: [], scenarios: [], sequences: [], templates: [] });
    expect(r.success).toBe(true);
  });
});

describe('MECHANICS', () => {
  it('lists 23 distinct mechanics', () => {
    expect(MECHANICS.length).toBe(23);
    expect(new Set(MECHANICS).size).toBe(23);
  });
});
