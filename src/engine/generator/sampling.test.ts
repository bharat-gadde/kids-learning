// src/engine/generator/sampling.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mulberry32 } from '../rng';
import { sampleWithoutRecent, pickDistractors } from './sampling';
import { glyphCandidate, objectCandidate, type Candidate } from './items';

const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}` }));
/** Fixed seeds: a claim checked on one seed can pass by luck. */
const SEEDS = Array.from({ length: 50 }, (_, i) => i);

describe('sampleWithoutRecent', () => {
  it('takes fresh items first, then the least recently used, and never more than asked', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 12 }),
        fc.integer({ min: 0, max: 15 }),
        fc.integer(),
        fc.array(fc.nat({ max: 14 }), { maxLength: 24 }), // ids may repeat, and i12–i14 may be outside the pool
        (poolSize, n, seed, recentIdx) => {
          const recent = recentIdx.map((i) => `i${i}`);
          const out = sampleWithoutRecent(mulberry32(seed), ids(poolSize), n, recent).map((o) => o.id);
          expect(out.length).toBe(Math.min(n, poolSize));
          expect(new Set(out).size).toBe(out.length);
          const lastUse = (id: string) => recent.lastIndexOf(id); // −1 = fresh; a repeated id counts from its latest use
          const all = ids(poolSize).map((p) => p.id);
          const fresh = all.filter((id) => lastUse(id) < 0).length;
          const leastRecent = all.filter((id) => lastUse(id) >= 0).sort((a, b) => lastUse(a) - lastUse(b));
          expect(out.slice(0, fresh).every((id) => lastUse(id) < 0)).toBe(true);
          expect(out.slice(fresh)).toEqual(leastRecent.slice(0, Math.max(0, out.length - fresh)));
        },
      ),
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
    // only as many stale items as needed
    expect(sampleWithoutRecent(mulberry32(1), ids(4), 2, ['i3', 'i0', 'i1']).map((o) => o.id)).toEqual(['i2', 'i3']);
    // a repeated id counts from its latest use, as when this set's rounds follow the history
    expect(sampleWithoutRecent(mulberry32(1), pool, 3, ['i0', 'i1', 'i2', 'i0']).map((o) => o.id)).toEqual(['i1', 'i2', 'i0']);
  });

  it('varies its picks with the seed', () => {
    const firsts = new Set(Array.from({ length: 200 }, (_, seed) => sampleWithoutRecent(mulberry32(seed), ids(10), 1, [])[0]!.id));
    expect(firsts.size).toBe(10);
  });

  it('returns nothing when asked for none', () => {
    expect(sampleWithoutRecent(mulberry32(1), ids(5), 0, [])).toEqual([]);
    expect(sampleWithoutRecent(mulberry32(1), ids(5), -1, [])).toEqual([]);
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
// Number glyph ids differ from their characters ("n6" draws "6"), exactly as in content/glyphs.json.
const numeral = (value: number, confusables: string[]): Candidate =>
  glyphCandidate({ id: `n${value}`, char: String(value), kind: 'number', pairKey: `n${value}`, value, lineId: `glyph.num.${value}`, confusables });

describe('pickDistractors', () => {
  const pool = [obj('apple', 'fruit', 'red'), obj('tomato', 'vegetable', 'red'), obj('banana', 'fruit', 'yellow'), obj('car', 'thing'), obj('bus', 'thing'), obj('mango', 'fruit')];

  it('never returns a correct item and never repeats', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 0, max: 6 }), fc.constantFrom('low', 'medium', 'high'), fc.subarray(pool, { minLength: 1 }), (seed, n, sim, correct) => {
        const out = pickDistractors(mulberry32(seed), pool, correct, n, sim as 'low' | 'medium' | 'high');
        expect(out.some((c) => correct.some((k) => k.id === c.id))).toBe(false);
        expect(new Set(out.map((c) => c.id)).size).toBe(out.length);
        expect(out.length).toBe(Math.min(n, pool.length - correct.length));
      }),
    );
    for (const seed of SEEDS) {
      const out = pickDistractors(mulberry32(seed), pool, [pool[0]!, pool[2]!], 4, 'low'); // apple and banana are both right
      expect(out.map((c) => c.id).sort()).toEqual(['bus', 'car', 'mango', 'tomato']);
    }
  });

  it('low similarity prefers other categories, medium prefers the same', () => {
    for (const seed of SEEDS) {
      const low = pickDistractors(mulberry32(seed), pool, [pool[0]!], 2, 'low');
      expect(low.every((c) => (c.kind === 'object' ? c.item.category !== 'fruit' : false))).toBe(true);
      const medium = pickDistractors(mulberry32(seed), pool, [pool[0]!], 2, 'medium');
      expect(medium.every((c) => (c.kind === 'object' ? c.item.category === 'fruit' : false))).toBe(true);
    }
  });

  it('picks at random within a bucket', () => {
    const firsts = new Set(SEEDS.map((seed) => pickDistractors(mulberry32(seed), pool, [pool[0]!], 1, 'low')[0]!.id));
    expect([...firsts].sort()).toEqual(['bus', 'car', 'tomato']);
  });

  it('high similarity puts confusable glyphs first', () => {
    const letters = [glyph('b', ['d', 'p']), glyph('d', ['b']), glyph('p', ['b']), glyph('x', []), glyph('o', [])];
    for (const seed of SEEDS) {
      const out = pickDistractors(mulberry32(seed), letters, [letters[0]!], 2, 'high');
      expect(out.map((c) => c.id).sort()).toEqual(['d', 'p']);
    }
  });

  it('matches confusables by the character drawn, not the id', () => {
    const numbers = [numeral(6, ['9', '0']), numeral(9, ['6']), numeral(0, ['6']), numeral(3, []), numeral(4, [])];
    for (const seed of SEEDS) {
      const out = pickDistractors(mulberry32(seed), numbers, [numbers[0]!], 2, 'high');
      expect(out.map((c) => c.id).sort()).toEqual(['n0', 'n9']);
    }
  });

  it('high similarity prefers a shared colour, then the same category, then the rest', () => {
    for (const seed of SEEDS) {
      expect(pickDistractors(mulberry32(seed), pool, [pool[0]!], 1, 'high').map((c) => c.id)).toEqual(['tomato']);
      const three = pickDistractors(mulberry32(seed), pool, [pool[0]!], 3, 'high');
      expect(three.map((c) => c.id).sort()).toEqual(['banana', 'mango', 'tomato']);
    }
  });

  it('never offers a distractor spoken the same as the answer', () => {
    const letters = [glyph('B', ['b']), glyph('b', ['d']), glyph('d', []), glyph('x', [])];
    for (let seed = 0; seed < 30; seed++) {
      const out = pickDistractors(mulberry32(seed), letters, [letters[0]!], 3, 'high');
      expect(out.map((c) => c.id).sort()).toEqual(['d', 'x']);
    }
  });
});
