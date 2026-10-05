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
});

describe('sequence', () => {
  it('shuffles the steps and keeps the correct order', () => {
    const r = buildPayload(ctx('good-habits.order', 1, 3));
    if (r.payload.kind !== 'order') throw new Error('expected order');
    expect(r.payload.items.map((i) => i.id)).not.toEqual(r.payload.correctOrder);
    expect([...r.payload.items.map((i) => i.id)].sort()).toEqual([...r.payload.correctOrder].sort());
    expect(r.promptLineId).toMatch(/^prompt\.order_/);
  });
});

describe('scenario', () => {
  it('returns the vignette, narration and shuffled choices with at least one correct', () => {
    const r = buildPayload(ctx('kind-fair.scene', 1, 1));
    if (r.payload.kind !== 'scenario') throw new Error('expected scenario');
    expect(pack.scenarios.has(r.payload.scenarioId)).toBe(true);
    expect(r.payload.choices.some((c) => c.correct)).toBe(true);
    expect(r.correctSlot).toBe(r.payload.choices.findIndex((c) => c.correct));
    expect(r.itemIds).toEqual([r.payload.scenarioId]);
  });
});
