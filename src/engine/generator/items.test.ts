import { describe, it, expect } from 'vitest';
import { loadPack } from '../content/load';
import { queryItems, toRoundItem, categoryOf, tagOf, pluralOf } from './items';

const pack = loadPack({
  topics: [],
  objects: [
    { id: 'apple', name: 'apple', lineId: 'obj.apple', asset: 'objects/apple.svg', category: 'fruit', tags: { sizePair: true, countable: true } },
    { id: 'carrot', name: 'carrot', lineId: 'obj.carrot', asset: 'objects/carrot.svg', category: 'vegetable', tags: { sizePair: true } },
    { id: 'cat', name: 'cat', lineId: 'obj.cat', asset: 'objects/cat.svg', category: 'animal', tags: { cvc: true, rhymeGroup: 'at' } },
    { id: 'bus', name: 'bus', plural: 'buses', lineId: 'obj.bus', asset: 'objects/bus.svg', category: 'thing', tags: { cvc: true } },
  ],
  glyphs: [
    { id: 'A', char: 'A', kind: 'letter', case: 'upper', pairKey: 'a', lineId: 'glyph.letter.a' },
    { id: 'a', char: 'a', kind: 'letter', case: 'lower', pairKey: 'a', lineId: 'glyph.letter.a' },
    { id: 'n3', char: '3', kind: 'number', pairKey: 'n3', value: 3, lineId: 'glyph.num.3' },
  ],
  scenes: [], lines: [], scenarios: [], sequences: [], templates: [],
});

describe('queryItems', () => {
  it('filters objects by category', () => {
    expect(queryItems(pack, { pool: 'objects', category: ['fruit', 'vegetable'] }).map((c) => c.item.id)).toEqual(['apple', 'carrot']);
  });

  it('filters objects by tag value and by tag presence', () => {
    expect(queryItems(pack, { pool: 'objects', tags: { countable: true } }).map((c) => c.item.id)).toEqual(['apple']);
    expect(queryItems(pack, { pool: 'objects', hasTags: ['rhymeGroup'] }).map((c) => c.item.id)).toEqual(['cat']);
  });

  it('filters glyphs by kind, case and value range', () => {
    expect(queryItems(pack, { pool: 'glyphs', glyph: { kind: 'letter', case: 'lower' } }).map((c) => c.item.id)).toEqual(['a']);
    expect(queryItems(pack, { pool: 'glyphs', glyph: { kind: 'number', min: 1, max: 5 } }).map((c) => c.item.id)).toEqual(['n3']);
  });

  it('filters by explicit ids and exposes the id at the top level', () => {
    const found = queryItems(pack, { pool: 'objects', ids: ['bus'] });
    expect(found.map((c) => c.item.id)).toEqual(['bus']);
    expect(found[0]?.id).toBe('bus');
  });
});

describe('conversion helpers', () => {
  it('converts objects and glyphs to round items', () => {
    const [apple] = queryItems(pack, { pool: 'objects', ids: ['apple'] });
    const [A] = queryItems(pack, { pool: 'glyphs', ids: ['A'] });
    expect(toRoundItem(apple!)).toEqual({ id: 'apple', label: 'apple', lineId: 'obj.apple', asset: 'objects/apple.svg' });
    expect(toRoundItem(A!)).toEqual({ id: 'A', label: 'A', lineId: 'glyph.letter.a', asset: 'glyph:A' });
  });

  it('reports category and tags uniformly', () => {
    const [cat] = queryItems(pack, { pool: 'objects', ids: ['cat'] });
    const [A] = queryItems(pack, { pool: 'glyphs', ids: ['A'] });
    expect(categoryOf(cat!)).toBe('animal');
    expect(categoryOf(A!)).toBe('glyph-letter-upper');
    expect(tagOf(cat!, 'rhymeGroup')).toBe('at');
    expect(tagOf(A!, 'rhymeGroup')).toBeUndefined();
  });

  it('pluralises with an override or a default s', () => {
    expect(pluralOf(pack.objects.get('bus')!)).toBe('buses');
    expect(pluralOf(pack.objects.get('apple')!)).toBe('apples');
  });
});
