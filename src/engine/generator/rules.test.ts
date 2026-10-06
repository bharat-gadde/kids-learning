// src/engine/generator/rules.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from '../content/readPackFromDisk';
import { mulberry32 } from '../rng';
import { buildPayload, difficultyAt, type RuleContext } from './rules';
import type { Level } from './types';

const pack = readPack();

function ctx(templateId: string, seed = 1, level: Level = 1, avoid: string[] = []): RuleContext {
  const template = pack.templates.get(templateId)!;
  return { pack, template, rng: mulberry32(seed), level, difficulty: difficultyAt(template, level), avoid, recentSlots: [], slotCounts: [] };
}

describe('named', () => {
  it('builds a choose payload with one correct option at the chosen slot', () => {
    const r = buildPayload(ctx('letters.tap', 3, 3));
    expect(r.payload.kind).toBe('choose');
    if (r.payload.kind !== 'choose') return;
    expect(r.payload.options.length).toBe(4);
    expect(r.payload.correctIds.length).toBe(1);
    const correct = r.payload.options[r.correctSlot!]!;
    expect(correct.id).toBe(r.payload.correctIds[0]);
    expect(r.payload.options.filter((o) => o.lineId === correct.lineId)).toHaveLength(1); // never "B" beside "b"
    expect(r.slots.target).toBe(r.payload.correctIds[0]);
    expect(r.itemIds).toEqual(r.payload.correctIds);
  });

  it('avoids recent targets', () => {
    const recent = [...pack.glyphs.values()].filter((g) => g.kind === 'letter').map((g) => g.id).slice(0, 50);
    const r = buildPayload(ctx('letters.tap', 7, 1, recent));
    expect(recent.includes(r.itemIds[0]!)).toBe(false);
  });
});

describe('size', () => {
  it('tap-the-one: same object at several scales, the largest is correct', () => {
    const p = buildPayload(ctx('big-small.tap', 11, 2)).payload;
    if (p.kind !== 'choose') throw new Error('expected choose');
    const scales = p.options.map((o) => o.scale!);
    expect(scales.length).toBe(3);
    expect(new Set(p.options.map((o) => o.id.split('@')[0])).size).toBe(1);
    const correct = p.options.find((o) => o.id === p.correctIds[0])!;
    expect(correct.scale).toBe(Math.max(...scales));
  });

  it('sort-into-bins: items are small or large copies and go to the matching bin', () => {
    const r = buildPayload(ctx('big-small.sort', 2, 1));
    if (r.payload.kind !== 'bins') throw new Error('expected bins');
    expect(r.payload.items.length).toBe(4);
    for (const item of r.payload.items) {
      expect(item.binId).toBe(item.scale === 1 ? 'big' : 'small');
    }
    expect(r.payload.bins.map((b) => b.id)).toEqual(['big', 'small']);
  });
});

describe('tag', () => {
  it('tap-all-that-match: correctCount correct items among the options', () => {
    const r = buildPayload(ctx('good-habits.clean', 4, 2));
    if (r.payload.kind !== 'choose') throw new Error('expected choose');
    expect(r.payload.options.length).toBe(6);
    expect(r.payload.correctIds.length).toBe(3);
    for (const id of r.payload.correctIds) expect(pack.objects.get(id)!.tags.neatAndClean).toBe(true);
  });

  it('give-to-buddy: healthy items are the correct ones', () => {
    const r = buildPayload(ctx('healthy-food.plate', 4, 1));
    if (r.payload.kind !== 'give') throw new Error('expected give');
    expect(r.payload.target.id).toBe('plate');
    expect(r.payload.items.length).toBe(4);
    expect(r.payload.correctIds.length).toBe(2);
    for (const id of r.payload.correctIds) expect(pack.objects.get(id)!.tags.healthy).toBe(true);
  });
});

describe('category', () => {
  it('sort-into-bins: each item goes to the bin matching its category', () => {
    const r = buildPayload(ctx('healthy-food.sort', 9, 3));
    if (r.payload.kind !== 'bins') throw new Error('expected bins');
    expect(r.payload.items.length).toBe(8);
    for (const item of r.payload.items) expect(item.binId).toBe(pack.objects.get(item.id)!.category);
  });
});

describe('count', () => {
  it('drag-to-match: groups pair with their numerals', () => {
    const r = buildPayload(ctx('counting.match', 5, 2));
    if (r.payload.kind !== 'pairs') throw new Error('expected pairs');
    expect(r.payload.left.length).toBe(3);
    for (const [groupId, glyphId] of r.payload.pairs) {
      const group = r.payload.left.find((l) => l.id === groupId)!;
      expect(pack.glyphs.get(glyphId)!.value).toBe(group.count);
      expect(group.count).toBeGreaterThanOrEqual(1);
      expect(group.count).toBeLessThanOrEqual(8);
    }
  });

  it('tap-the-one: one numeral is the group\'s count, and its rank among the numerals varies', () => {
    const tap = { ...pack.templates.get('counting.match')!, mechanic: 'tap-the-one' as const }; // no M1 template yet (DPS 8)
    const ranks = new Set<number>();
    for (let seed = 0; seed < 60; seed++) {
      const r = buildPayload({ ...ctx('counting.match', seed, 2), template: tap }); // 3 numerals, medium similarity
      if (r.payload.kind !== 'choose') throw new Error('expected choose');
      const values = r.payload.options.map((o) => pack.glyphs.get(o.id)!.value!);
      expect(new Set(values).size).toBe(3);
      expect(values[r.correctSlot!]).toBe(r.payload.stimulus!.count);
      expect(r.payload.correctIds).toEqual([r.payload.options[r.correctSlot!]!.id]);
      expect(r.slots).toEqual({ targets: r.itemIds[0] }); // never {n}: it is the answer
      ranks.add([...values].sort((a, b) => a - b).indexOf(r.payload.stimulus!.count!));
    }
    expect(ranks.size).toBe(3); // "tap the middle number" does not always win
  });
});

describe('give-count', () => {
  it('asks for n of one object and marks n of the copies correct', () => {
    const r = buildPayload(ctx('counting.give', 8, 1));
    if (r.payload.kind !== 'give') throw new Error('expected give');
    expect(r.payload.count).toBe(Number(r.slots.n));
    expect(r.payload.correctIds.length).toBe(r.payload.count);
    expect(r.payload.items.length).toBeGreaterThanOrEqual(r.payload.count! + 2);
    expect(new Set(r.payload.items.map((i) => i.id.split('#')[0])).size).toBe(1);
  });

  it('asks every count in the range, then again in a new order, never the same n twice running', () => {
    const replayed = new Set<boolean>();
    for (let seed = 0; seed < 50; seed++) {
      const avoid: string[] = [];
      const ns = Array.from({ length: 6 }, (_, i) => {
        const r = buildPayload(ctx('counting.give', seed * 10 + i, 1, [...avoid]));
        avoid.push(...r.itemIds);
        return Number(r.slots.n);
      });
      expect(ns.slice(0, 3).sort((a, b) => a - b)).toEqual([1, 2, 3]); // level 1 asks for 1–3
      expect(ns.slice(3).sort((a, b) => a - b)).toEqual([1, 2, 3]);
      expect(ns.some((n, i) => i > 0 && n === ns[i - 1])).toBe(false);
      replayed.add(ns.slice(3).join() === ns.slice(0, 3).join());
    }
    expect(replayed).toEqual(new Set([true, false])); // least recently used would replay the first pass every time
  });
});

describe('pair', () => {
  it('caseMate: left are capitals, right their small letters, shuffled', () => {
    const r = buildPayload(ctx('capital-small.match', 2, 3));
    if (r.payload.kind !== 'pairs') throw new Error('expected pairs');
    expect(r.payload.left.every((l) => pack.glyphs.get(l.id)!.case === 'upper')).toBe(true);
    for (const [a, b] of r.payload.pairs) expect(pack.glyphs.get(a)!.pairKey).toBe(pack.glyphs.get(b)!.pairKey);
    expect(r.payload.pairs.length).toBe(4);
  });

  it('rhymeGroup: each pair shares a rhyme group and groups do not repeat', () => {
    const r = buildPayload(ctx('rhyming.match', 6, 3));
    if (r.payload.kind !== 'pairs') throw new Error('expected pairs');
    const groups = r.payload.pairs.map(([a, b]) => {
      const ga = pack.objects.get(a)!.tags.rhymeGroup;
      expect(pack.objects.get(b)!.tags.rhymeGroup).toBe(ga);
      return ga;
    });
    expect(new Set(groups).size).toBe(4);
    expect(r.itemIds.sort()).toEqual([...groups].sort());
  });

  it('rhymeGroup at level 1: no two groups end alike, so the vowel alone never tells the pairs apart', () => {
    const all = [...new Set([...pack.objects.values()].map((o) => o.tags.rhymeGroup).filter((g) => g !== undefined))];
    for (let seed = 0; seed < 200; seed++) {
      for (const avoid of [[], all]) { // fresh groups, and the stale fallback once every group was used lately
        const endings = buildPayload(ctx('rhyming.match', seed, 1, avoid)).itemIds.map((g) => g.at(-1));
        expect(endings).toHaveLength(2);
        expect(new Set(endings).size).toBe(2);
      }
    }
  });
});

describe('sequence', () => {
  it('shuffles the steps and keeps the correct order', () => {
    const r = buildPayload(ctx('good-habits.order', 1, 3));
    if (r.payload.kind !== 'order') throw new Error('expected order');
    expect(r.payload.items.map((i) => i.id)).not.toEqual(r.payload.correctOrder);
    expect([...r.payload.items.map((i) => i.id)].sort()).toEqual([...r.payload.correctOrder].sort());
    expect(r.promptLineId).toMatch(/^prompt\.order_/);
  });

  it('hands out its own correctOrder, so reordering it cannot reorder the pack', () => {
    const r = buildPayload(ctx('good-habits.order', 1, 3));
    if (r.payload.kind !== 'order') throw new Error('expected order');
    expect(r.payload.correctOrder).not.toBe(pack.sequences.get(r.itemIds[0]!)!.steps);
  });
});

describe('scenario', () => {
  it('returns the vignette, narration and shuffled choices with at least one correct', () => {
    const r = buildPayload(ctx('kind-fair.scene', 1, 1));
    if (r.payload.kind !== 'scenario') throw new Error('expected scenario');
    expect(pack.scenarios.has(r.payload.scenarioId)).toBe(true);
    expect(r.payload.choices.some((c) => c.correct)).toBe(true);
    expect(r.payload.choices[r.correctSlot!]!.correct).toBe(true);
    expect(r.itemIds).toEqual([r.payload.scenarioId]);
  });

  it('places the answer by the slot rule: never a third time running in one slot', () => {
    for (const id of ['kind-fair.scene', 'feelings.scene']) {
      for (let seed = 0; seed < 50; seed++) {
        const r = buildPayload({ ...ctx(id, seed), recentSlots: [1, 1] });
        if (r.payload.kind !== 'scenario') throw new Error('expected scenario');
        expect(r.correctSlot).not.toBe(1);
        expect(r.payload.choices[r.correctSlot!]!.correct).toBe(true);
      }
    }
  });
});

describe('every M1 template', () => {
  it('builds a self-consistent payload at every level, the same way twice', () => {
    for (const template of pack.templates.values()) {
      for (const level of [1, 2, 3] as const) {
        for (let seed = 0; seed < 40; seed++) {
          const r = buildPayload(ctx(template.id, seed, level));
          expect(buildPayload(ctx(template.id, seed, level))).toEqual(r);
          const p = r.payload;
          if (p.kind === 'choose') {
            expect(p.options).toHaveLength(difficultyAt(template, level).options);
            expect(p.correctIds.every((id) => p.options.some((o) => o.id === id))).toBe(true);
            expect(p.correctIds).toContain(p.options[r.correctSlot!]!.id);
          } else if (p.kind === 'scenario') {
            expect(p.choices[r.correctSlot!]!.correct).toBe(true);
          } else {
            expect(r.correctSlot).toBeNull();
          }
          if (p.kind === 'give') expect(p.correctIds.every((id) => p.items.some((i) => i.id === id))).toBe(true);
          if (p.kind === 'bins') expect(p.items.every((i) => p.bins.some((b) => b.id === i.binId))).toBe(true);
          if (p.kind === 'pairs') for (const [a, b] of p.pairs) expect([p.left.some((l) => l.id === a), p.right.some((x) => x.id === b)]).toEqual([true, true]);
          if (p.kind === 'order') expect(p.items.map((i) => i.id)).not.toEqual(p.correctOrder);
        }
      }
    }
  });
});
