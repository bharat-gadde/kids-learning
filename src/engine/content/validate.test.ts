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

describe('validatePack: content that passes generates correct rounds', () => {
  const withTemplate = (over: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    ({ ...good, ...extra, templates: [{ ...good.templates[0], ...over }] });
  const sortPrompt = { scenes: ['garden'], promptLineId: 'prompt.sort' };
  const withSortLine = { lines: [...good.lines, line('prompt.sort', 'Sort them')] };
  const bin = (match: string | boolean) => ({ id: String(match), label: String(match), lineId: 'obj.apple', match });
  const letters = (...chars: string[]) => ({
    glyphs: chars.map((char) => ({
      id: char, char, kind: 'letter', case: char === char.toUpperCase() ? 'upper' : 'lower', pairKey: char.toLowerCase(), lineId: `glyph.${char.toLowerCase()}`,
    })),
    lines: [...good.lines, line('prompt.match', 'Match them'), ...[...new Set(chars.map((c) => c.toLowerCase()))].map((l) => line(`glyph.${l}`, l))],
  });

  it('counts caseMate pairs only for letters queried in both cases', () => {
    const raw = withTemplate(
      { mechanic: 'drag-to-match', rule: { kind: 'pair', by: 'caseMate' }, query: { pool: 'glyphs', glyph: { kind: 'letter' } }, flavour: { scenes: ['garden'], promptLineId: 'prompt.match' } },
      letters('A', 'B', 'C', 'D', 'a', 'b', 'c'),
    );
    expect(errorsOf(raw)).toEqual(['caseMate pairs: 3 letters queried in both cases, level 3 needs 4']);
  });

  it('flags a queried category that no sort bin accepts', () => {
    const raw = withTemplate({ mechanic: 'sort-into-bins', rule: { kind: 'category', values: ['thing'] }, bins: [bin('thing'), bin('fruit')], flavour: sortPrompt }, withSortLine);
    expect(errorsOf(raw)).toEqual(['no bin matches queried category animal']);
  });

  it('flags tag bins that would sort an item into the wrong bin', () => {
    const coloured = {
      objects: [obj('apple', 'fruit', { colour: 'red' }), obj('cherry', 'fruit', { colour: 'red' }), obj('ball', 'thing', { colour: 'blue' }), obj('bus', 'thing', { colour: 'yellow' })],
      lines: [...good.lines, line('obj.cherry', 'cherry'), line('prompt.sort', 'Sort them')],
    };
    const sortBy = (...matches: string[]) => withTemplate({
      mechanic: 'sort-into-bins', rule: { kind: 'tag', tag: 'colour', value: 'red' }, query: { pool: 'objects', hasTags: ['colour'] }, bins: matches.map(bin), flavour: sortPrompt,
    }, coloured);
    expect(errorsOf(sortBy('blue', 'yellow'))).toEqual(['no bin has match "red", so the matching items have no bin']);
    expect(errorsOf(sortBy('red', 'blue', 'green'))).toEqual(['items with colour yellow have no bin: add bins for them, or keep exactly one bin besides "red"']);
    expect(errorsOf(sortBy('red', 'other'))).toEqual([]); // one catch-all bin takes blue and yellow
  });

  it('flags a level that shows more items than the query has', () => {
    // level 3 of tap-all-that-match shows 3 things and 1 other item, but only ball and bus are things
    const raw = withTemplate({
      mechanic: 'tap-all-that-match', rule: { kind: 'category', values: ['thing'] },
      difficulty: [{ options: 2, distractorSimilarity: 'low' }, { options: 3, correctCount: 2, distractorSimilarity: 'medium' }, { options: 4, correctCount: 3, distractorSimilarity: 'high' }],
    });
    expect(errorsOf(raw)).toEqual(['level 3 needs 3 matching (thing) and 1 other items; the query has 2 and 2']);
    // with nothing else queried, every tap-the-one round would offer one option, and it is correct
    const single = withTemplate({ rule: { kind: 'category', values: ['thing'] }, query: { pool: 'objects', category: ['thing'] } });
    expect(errorsOf(single)).toContain('level 1 needs 1 matching (thing) and 1 other items; the query has 2 and 0');
  });

  it("does not count an answer's same-line twin among its options", () => {
    // "B" and "b" share a line, so beside "b" only "D" and "d" can be shown
    const raw = withTemplate({ itemClass: 'letters', rule: { kind: 'named' }, query: { pool: 'glyphs', ids: ['B', 'b', 'D', 'd'] } }, letters('B', 'b', 'D', 'd'));
    expect(errorsOf(raw)).toEqual(['an answer is never shown beside an item spoken the same (like "B" and "b"), so only 3 options fit; level 3 needs 4']);
  });

  it('leaves {name} and {buddy} to the UI', () => {
    const raw = withTemplate({ flavour: { scenes: ['garden'], promptLineId: 'prompt.hello' } }, { lines: [...good.lines, line('prompt.hello', 'Hi {name}! Help {buddy} find the biggest {target}')] });
    expect(errorsOf(raw)).toEqual([]);
  });

  it('flags a prompt slot that the rule never fills', () => {
    const raw = withTemplate({ mechanic: 'sort-into-bins', bins: [bin('large'), bin('small')] });
    expect(errorsOf(raw)).toEqual(['prompt line prompt.tap_big uses {target}, which sort-into-bins with a size rule never fills']);
  });

  it('flags repeated scenario choices, bins and scenes, and a give-count range from 0', () => {
    const scenario = {
      lines: [...good.lines, line('sc.x', 'What now?')],
      scenarios: [{ id: 'sc.x', topicId: 'big-small', narrationLineId: 'sc.x', vignette: 'v.svg', choices: [{ objectId: 'apple', correct: true }, { objectId: 'apple', correct: false }] }],
    };
    expect(errorsOf({ ...good, ...scenario })).toEqual(['choices repeat an object']);
    const repeated = withTemplate({ mechanic: 'sort-into-bins', bins: [{ ...bin('large'), id: 'big' }, { ...bin('small'), id: 'big' }], flavour: { ...sortPrompt, scenes: ['garden', 'garden'] } }, withSortLine);
    expect(errorsOf(repeated)).toEqual(['scenes repeat a scene', 'bins repeat an id']);
    const giveZero = withTemplate({
      mechanic: 'give-to-buddy', rule: { kind: 'give-count' }, bins: [bin('buddy')], flavour: { scenes: ['garden'], promptLineId: 'prompt.give' },
      difficulty: [{ options: 2, distractorSimilarity: 'low', range: [0, 2] }, { options: 3, distractorSimilarity: 'medium', range: [1, 3] }, { options: 4, distractorSimilarity: 'high', range: [1, 4] }],
    }, { objects: good.objects.map((o) => ({ ...o, tags: { ...o.tags, countable: true } })), lines: [...good.lines, line('prompt.give', 'Give Buddy {n} {targets}')] });
    expect(errorsOf(giveZero)).toEqual(['difficulty level 1: a give-count range starts at 1 (Buddy cannot be given 0)']);
  });
});
