// src/engine/generator/sampling.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mulberry32 } from '../rng';
import { sampleWithoutRecent, pickDistractors } from './sampling';
import { glyphCandidate, objectCandidate, type Candidate } from './items';

const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}` }));

describe('sampleWithoutRecent', () => {
  it('returns distinct items and never more than the pool', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 0, max: 15 }), fc.integer(), (poolSize, n, seed) => {
        const out = sampleWithoutRecent(mulberry32(seed), ids(poolSize), n, []);
        expect(out.length).toBe(Math.min(n, poolSize));
        expect(new Set(out.map((o) => o.id)).size).toBe(out.length);
      }),
    );
  });

  it('avoids recent items whenever enough fresh ones exist', () => {
    const pool = ids(10);
    const recent = ['i0', 'i1', 'i2'];
    for (let seed = 0; seed < 50; seed++) {
      const out = sampleWithoutRecent(mulberry32(seed), pool, 7, recent);
      expect(out.some((o) => recent.includes(o.id))).toBe(false);
    }
  });

  it('falls back to the least recently used when fresh items run out', () => {
    const pool = ids(3);
    const out = sampleWithoutRecent(mulberry32(1), pool, 3, ['i2', 'i0']); // i2 oldest, i0 newest
    expect(out.map((o) => o.id)).toEqual(['i1', 'i2', 'i0']);
  });
});

const obj = (id: string, category: string, colour?: string): Candidate =>
  objectCandidate({ id, name: id, lineId: `obj.${id}`, asset: `${id}.svg`, category, tags: colour ? { colour } : {} });
// Upper and lower case of a letter share one spoken line, exactly as in content/glyphs.json.
const glyph = (char: string, confusables: string[]): Candidate =>
  glyphCandidate({
    id: char, char, kind: 'letter', case: char === char.toLowerCase() ? 'lower' : 'upper',
    pairKey: char.toLowerCase(), lineId: `glyph.letter.${char.toLowerCase()}`, confusables,
  });

describe('pickDistractors', () => {
  const pool = [obj('apple', 'fruit', 'red'), obj('tomato', 'vegetable', 'red'), obj('banana', 'fruit', 'yellow'), obj('car', 'thing'), obj('bus', 'thing'), obj('mango', 'fruit')];

  it('never returns the correct item and never repeats', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 0, max: 6 }), fc.constantFrom('low', 'medium', 'high'), (seed, n, sim) => {
        const out = pickDistractors(mulberry32(seed), pool, [pool[0]!], n, sim as 'low' | 'medium' | 'high');
        expect(out.some((c) => c.item.id === 'apple')).toBe(false);
        expect(new Set(out.map((c) => c.item.id)).size).toBe(out.length);
        expect(out.length).toBe(Math.min(n, pool.length - 1));
      }),
    );
  });

  it('low similarity prefers other categories, medium prefers the same', () => {
    const low = pickDistractors(mulberry32(3), pool, [pool[0]!], 2, 'low');
    expect(low.every((c) => (c.kind === 'object' ? c.item.category !== 'fruit' : false))).toBe(true);
    const medium = pickDistractors(mulberry32(3), pool, [pool[0]!], 2, 'medium');
    expect(medium.every((c) => (c.kind === 'object' ? c.item.category === 'fruit' : false))).toBe(true);
  });

  it('high similarity puts confusable glyphs first', () => {
    const letters = [glyph('b', ['d', 'p']), glyph('d', ['b']), glyph('p', ['b']), glyph('x', []), glyph('o', [])];
    const out = pickDistractors(mulberry32(5), letters, [letters[0]!], 2, 'high');
    expect(out.map((c) => c.item.id).sort()).toEqual(['d', 'p']);
  });

  it('high similarity prefers objects sharing a colour', () => {
    const out = pickDistractors(mulberry32(5), pool, [pool[0]!], 1, 'high');
    expect(out[0]?.item.id).toBe('tomato');
  });

  it('never offers a distractor spoken the same as the answer', () => {
    const letters = [glyph('B', ['b']), glyph('b', ['d']), glyph('d', []), glyph('x', [])];
    for (let seed = 0; seed < 30; seed++) {
      const out = pickDistractors(mulberry32(seed), letters, [letters[0]!], 3, 'high');
      expect(out.map((c) => c.id).sort()).toEqual(['d', 'x']);
    }
  });
});
