// src/engine/content/validate.test.ts
import { describe, it, expect } from 'vitest';
import { loadPack } from './load';
import { validatePack } from './validate';

const obj = (id: string, category: string, tags: Record<string, unknown> = {}) => ({
  id, name: id, lineId: `obj.${id}`, asset: `objects/${id}.svg`, category, tags,
});
const line = (id: string, ...variants: string[]) => ({ id, variants });

const good = {
  topics: [{ id: 'big-small', subject: 'numeracy', title: 'Big & small', goals: [{ id: 'big-small.identify', title: 'Identify bigger' }] }],
  objects: [obj('apple', 'fruit', { sizePair: true }), obj('ball', 'thing', { sizePair: true }), obj('cat', 'animal', { sizePair: true }), obj('bus', 'thing', { sizePair: true })],
  glyphs: [],
  scenes: [{ id: 'garden', asset: 'scenes/garden.svg', theme: 'garden' }],
  lines: [line('obj.apple', 'apple'), line('obj.ball', 'ball'), line('obj.cat', 'cat'), line('obj.bus', 'bus'), line('prompt.tap_big', 'Tap the BIG {target}', 'Which {target} is big?')],
  scenarios: [],
  sequences: [],
  templates: [{
    id: 'big-small.tap', topicId: 'big-small', goalId: 'big-small.identify', mechanic: 'tap-the-one', itemClass: 'objects',
    query: { pool: 'objects', tags: { sizePair: true } }, rule: { kind: 'size', target: 'larger' }, rounds: 6,
    difficulty: [{ options: 2, distractorSimilarity: 'low' }, { options: 3, distractorSimilarity: 'medium' }, { options: 4, distractorSimilarity: 'high' }],
    flavour: { scenes: ['garden'], promptLineId: 'prompt.tap_big' }, level: 'lkg',
  }],
};

const errorsOf = (raw: unknown) => validatePack(loadPack(raw)).filter((i) => i.level === 'error').map((i) => i.message);

describe('validatePack', () => {
  it('passes a consistent pack with only the per-topic minimum warning', () => {
    const issues = validatePack(loadPack(good));
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(issues.map((i) => i.message)).toEqual(['1 templates, spec minimum for numeracy is 2']);
  });

  it('flags unknown slots in lines', () => {
    const raw = { ...good, lines: [...good.lines, line('x', 'Hello {planet}')] };
    expect(errorsOf(raw)).toContain('unknown slot {planet}');
  });

  it('flags a missing object line', () => {
    const raw = { ...good, objects: [...good.objects, obj('kite', 'toy')] };
    expect(errorsOf(raw)).toContain('missing line obj.kite');
  });

  it('flags a rule that the mechanic does not support', () => {
    const raw = { ...good, templates: [{ ...good.templates[0], rule: { kind: 'sequence' } }] };
    expect(errorsOf(raw).some((m) => m.startsWith('rule sequence is not valid for tap-the-one'))).toBe(true);
  });

  it('flags missing bins for sort-into-bins', () => {
    const raw = { ...good, templates: [{ ...good.templates[0], mechanic: 'sort-into-bins' }] };
    expect(errorsOf(raw)).toContain('sort-into-bins needs bins');
  });

  it('flags a goal that is not in the topic', () => {
    const raw = { ...good, templates: [{ ...good.templates[0], goalId: 'other.goal' }] };
    expect(errorsOf(raw)).toContain('goal other.goal is not in topic big-small');
  });

  it('flags a query that cannot fill level 3', () => {
    const raw = { ...good, templates: [{ ...good.templates[0], rule: { kind: 'named' }, query: { pool: 'objects', ids: ['apple', 'ball'] } }] };
    expect(errorsOf(raw)).toContain('query yields 2 items; level 3 needs 4');
  });

  it('flags query ids that are not in the pool', () => {
    const raw = { ...good, templates: [{ ...good.templates[0], query: { pool: 'objects', ids: ['apple', 'ball', 'cat', 'bus', 'aple'] } }] };
    expect(errorsOf(raw)).toEqual(['query names unknown object aple']);
  });

  it('flags a scenario without a correct choice', () => {
    const raw = {
      ...good,
      lines: [...good.lines, line('sc.x', 'What now?')],
      scenarios: [{ id: 'sc.x', topicId: 'big-small', narrationLineId: 'sc.x', vignette: 'v.svg', choices: [{ objectId: 'apple', correct: false }, { objectId: 'ball', correct: false }] }],
    };
    expect(errorsOf(raw)).toContain('no correct choice');
  });

  it('flags size bins that are not "large" and "small"', () => {
    const raw = {
      ...good,
      lines: [...good.lines, line('bin.big', 'big basket'), line('bin.small', 'small basket')],
      templates: [{
        ...good.templates[0], mechanic: 'sort-into-bins',
        bins: [{ id: 'big', label: 'big basket', lineId: 'bin.big', match: 'big' }, { id: 'small', label: 'small basket', lineId: 'bin.small', match: 'small' }],
      }],
    };
    expect(errorsOf(raw)).toContain('size bins need match values "large" and "small"');
  });

  it('flags a count rule whose numbers have no numeral glyphs', () => {
    const raw = {
      ...good,
      objects: good.objects.map((o) => ({ ...o, tags: { ...o.tags, countable: true } })),
      templates: [{
        ...good.templates[0], mechanic: 'drag-to-match', rule: { kind: 'count' },
        difficulty: [
          { options: 2, distractorSimilarity: 'low', range: [1, 3] },
          { options: 3, distractorSimilarity: 'medium', range: [1, 5] },
          { options: 4, distractorSimilarity: 'high', range: [1, 12] },
        ],
      }],
    };
    expect(errorsOf(raw)).toContain('count rule needs number glyphs for 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12');
  });
});
