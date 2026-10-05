// src/engine/generator/round.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readPack } from '../content/readPackFromDisk';
import { slotsFilled } from '../content/validate';
import { generateSet, renderCaption, pickVariant, pickScene } from './round';
import { GenerationError } from './rules';
import { EMPTY_HISTORY, type Level, type Payload } from './types';
import { mulberry32 } from '../rng';

const pack = readPack();
const templateIds = [...pack.templates.keys()];

const EXPECTED_KIND: Record<string, Payload['kind']> = {
  'tap-the-one': 'choose', 'tap-all-that-match': 'choose', 'drag-to-match': 'pairs', 'sort-into-bins': 'bins',
  'give-to-buddy': 'give', 'sequence': 'order', 'scene-then-choose': 'scenario',
};

describe('generateSet', () => {
  it('is deterministic for the same seed', () => {
    const a = generateSet(pack, pack.templates.get('big-small.tap')!, { seed: 99, level: 1, history: EMPTY_HISTORY });
    const b = generateSet(pack, pack.templates.get('big-small.tap')!, { seed: 99, level: 1, history: EMPTY_HISTORY });
    expect(a).toEqual(b);
    expect(a.map((r) => [r.seed, r.index])).toEqual(a.map((_, i) => [99, i])); // what an attempt stores to replay it
  });

  it('names the template, set seed, level and round when a round cannot be built', () => {
    const t = pack.templates.get('letters.tap')!;
    const thrown = (template: typeof t) => {
      try {
        generateSet(pack, template, { seed: 7, level: 2, history: EMPTY_HISTORY });
      } catch (e) {
        return e;
      }
      return undefined;
    };
    const noTarget = thrown({ ...t, query: { pool: 'glyphs', ids: ['no-such-glyph'] } });
    expect(noTarget).toBeInstanceOf(GenerationError);
    expect((noTarget as Error).message).toBe('letters.tap (seed 7, level 2, round 1): no named target available');
    expect((noTarget as Error).cause).toBeInstanceOf(GenerationError);
    expect((thrown({ ...t, flavour: { ...t.flavour, promptLineId: 'prompt.none' } }) as Error).message).toBe('letters.tap (seed 7, level 2, round 1): missing line prompt.none');
  });

  it('produces the right number of rounds with the right payload kind for every template, level and seed', () => {
    fc.assert(
      fc.property(fc.constantFrom(...templateIds), fc.constantFrom<Level>(1, 2, 3), fc.integer({ min: 0, max: 500 }), (id, level, seed) => {
        const t = pack.templates.get(id)!;
        const rounds = generateSet(pack, t, { seed, level, history: EMPTY_HISTORY });
        expect(rounds.length).toBe(t.rounds);
        for (const r of rounds) {
          expect(r.payload.kind).toBe(EXPECTED_KIND[t.mechanic]);
          expect(r.form).toBe(`${t.mechanic}:${t.itemClass}`);
          expect(r.level).toBe(level);
          expect(t.flavour.scenes).toContain(r.sceneId);
          expect(r.prompt.text.length).toBeGreaterThan(0);
          expect(Object.keys(r.prompt.slots).sort()).toEqual([...slotsFilled(t)].sort()); // the validator's slot table matches the builders
          const p = r.payload;
          const ids = p.kind === 'choose' ? p.options : p.kind === 'pairs' ? [...p.left, ...p.right] : p.kind === 'scenario' ? p.choices : p.items;
          expect(new Set(ids.map((i) => i.id)).size).toBe(ids.length); // renderers key items by id
        }
      }),
      { numRuns: 300 },
    );
  });

  it('never puts the answer in one slot three times running, and does not just alternate', () => {
    let alternating = 0;
    for (const id of ['letters.tap', 'big-small.tap', 'cvc.hear', 'feelings.tap']) {
      for (const level of [1, 2, 3] as const) {
        for (let seed = 0; seed < 50; seed++) {
          const slots = generateSet(pack, pack.templates.get(id)!, { seed, level, history: { ...EMPTY_HISTORY, lastSlot: 0 } }).map((r) => r.correctSlot);
          const run = [0, ...slots]; // the last set ended in slot 0
          for (let i = 2; i < run.length; i++) expect(run[i] === run[i - 1] && run[i] === run[i - 2]).toBe(false);
          if (level === 1 && run.every((s, i) => i === 0 || s !== run[i - 1])) alternating++;
        }
      }
    }
    expect(alternating).toBeLessThan(100); // of 200 two-option sets; "never twice running" alternates in every one
  });

  it('places each answer only in a slot at most one use ahead of the least-used', () => {
    for (const id of ['letters.tap', 'big-small.tap', 'cvc.hear', 'feelings.tap', 'feelings.scene', 'kind-fair.scene']) {
      for (const level of [1, 2, 3] as const) {
        for (let seed = 0; seed < 50; seed++) {
          const counts: number[] = [];
          for (const r of generateSet(pack, pack.templates.get(id)!, { seed, level, history: EMPTY_HISTORY })) {
            const shown = r.payload.kind === 'choose' ? r.payload.options.length : r.payload.kind === 'scenario' ? r.payload.choices.length : 0;
            const least = Math.min(...Array.from({ length: shown }, (_, s) => counts[s] ?? 0));
            const slot = r.correctSlot!;
            expect(counts[slot] ?? 0).toBeLessThanOrEqual(least + 1);
            counts[slot] = (counts[slot] ?? 0) + 1;
          }
        }
      }
    }
  });

  it('applies the same slot rule to scene-then-choose answers', () => {
    for (const id of ['feelings.scene', 'kind-fair.scene']) {
      for (let seed = 0; seed < 200; seed++) {
        const slots = generateSet(pack, pack.templates.get(id)!, { seed, level: 1, history: { ...EMPTY_HISTORY, lastSlot: 0 } }).map((r) => r.correctSlot);
        const run = [0, ...slots];
        for (let i = 2; i < run.length; i++) expect(run[i] === run[i - 1] && run[i] === run[i - 2]).toBe(false);
      }
    }
  });

  it('does not replay the last set in the same order when history covers a small pool', () => {
    const t = pack.templates.get('feelings.tap')!; // 6 rounds over 6 faces
    let replays = 0;
    for (let seed = 0; seed < 40; seed++) {
      const last = generateSet(pack, t, { seed, level: 1, history: EMPTY_HISTORY }).map((r) => r.itemIds[0]!);
      const next = generateSet(pack, t, { seed: seed + 1000, level: 1, history: { ...EMPTY_HISTORY, recentItemIds: last } }).map((r) => r.itemIds[0]!);
      expect(new Set(next).size).toBe(next.length); // still no repeat within the set
      if (next.join() === last.join()) replays++;
    }
    expect(replays).toBeLessThan(5);
  });

  it('does not repeat a correct item within a set when the pool is big enough', () => {
    for (let seed = 0; seed < 40; seed++) {
      const rounds = generateSet(pack, pack.templates.get('letters.tap')!, { seed, level: 1, history: EMPTY_HISTORY });
      const targets = rounds.map((r) => r.itemIds[0]);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  it('prefers key items the last three sessions did not use', () => {
    const t = pack.templates.get('letters.tap')!; // 6 rounds
    const letters = [...pack.glyphs.values()].filter((g) => g.kind === 'letter').map((g) => g.id);
    const recentItemIds = letters.slice(0, -8); // all but 8 letters
    for (let seed = 0; seed < 40; seed++) {
      const targets = generateSet(pack, t, { seed, level: 1, history: { ...EMPTY_HISTORY, recentItemIds } }).map((r) => r.itemIds[0]!);
      expect(targets.filter((id) => recentItemIds.includes(id))).toEqual([]);
    }
  });

  it('captions a sequence with its own prompt line', () => {
    const t = pack.templates.get('good-habits.order')!; // morning and bedtime sequences share one template
    const lines = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      for (const r of generateSet(pack, t, { seed, level: 1, history: EMPTY_HISTORY })) {
        expect(r.prompt.lineId).toBe(pack.sequences.get(r.itemIds[0]!)!.promptLineId);
        lines.add(r.prompt.lineId);
      }
    }
    expect([...lines].sort()).toEqual(['prompt.order_bedtime', 'prompt.order_morning']);
  });

  it("avoids the last scene, and the last wording on each line: the history's, then this set's", () => {
    for (const t of pack.templates.values()) {
      for (let seed = 0; seed < 30; seed++) {
        const lastSceneId = t.flavour.scenes[seed % t.flavour.scenes.length]!;
        const lastVariantByLine = Object.fromEntries([...pack.lines.values()].map((l) => [l.id, seed % l.variants.length]));
        const rounds = generateSet(pack, t, { seed, level: 1, history: { ...EMPTY_HISTORY, lastSceneId, lastVariantByLine } });
        if (t.flavour.scenes.length > 1) expect(rounds[0]!.sceneId).not.toBe(lastSceneId);
        const last: Record<string, number> = { ...lastVariantByLine };
        for (const r of rounds) {
          if (pack.lines.get(r.prompt.lineId)!.variants.length > 1) expect(r.prompt.variant).not.toBe(last[r.prompt.lineId]);
          last[r.prompt.lineId] = r.prompt.variant;
        }
      }
    }
  });

  it('hands out read-only rounds, and leaves the pack writable', () => {
    for (const t of pack.templates.values()) {
      const [r] = generateSet(pack, t, { seed: 1, level: 1, history: EMPTY_HISTORY });
      expect(Object.isFrozen(r!.payload)).toBe(true);
    }
    const order = generateSet(pack, pack.templates.get('good-habits.order')!, { seed: 1, level: 1, history: EMPTY_HISTORY })[0]!;
    const p = order.payload;
    if (p.kind !== 'order') throw new Error('expected order');
    expect(() => p.items.reverse()).toThrow(TypeError); // a renderer copies before dragging cards about
    expect(Object.isFrozen(pack.sequences.get(order.itemIds[0]!)!.steps)).toBe(false);
  });

  it('renders the target label into the caption', () => {
    const rounds = generateSet(pack, pack.templates.get('big-small.tap')!, { seed: 4, level: 1, history: EMPTY_HISTORY });
    const r = rounds[0]!;
    expect(r.prompt.text).toContain(pack.objects.get(r.prompt.slots.target!)!.name);
  });
});

describe('helpers', () => {
  it('pickVariant avoids the last variant when there is more than one', () => {
    for (let s = 0; s < 20; s++) expect(pickVariant(mulberry32(s), 3, 1)).not.toBe(1);
    expect(pickVariant(mulberry32(1), 1, 0)).toBe(0);
  });

  it('pickScene avoids the last scene when there is more than one', () => {
    for (let s = 0; s < 20; s++) expect(pickScene(mulberry32(s), ['a', 'b', 'c'], 'b')).not.toBe('b');
    expect(pickScene(mulberry32(1), ['a'], 'a')).toBe('a');
  });

  it('renderCaption fills slots with labels and leaves {name} and {buddy} for the UI', () => {
    expect(renderCaption(pack, 'Give {buddy} {n} {targets}, {name}!', { n: '3', targets: 'mango' })).toBe('Give {buddy} 3 mangoes, {name}!');
    expect(renderCaption(pack, 'Give {buddy} {n} {targets}', { n: '1', targets: 'mango' })).toBe('Give {buddy} 1 mango');
    expect(renderCaption(pack, 'Give {buddy} {n} {targets}', { n: '10', targets: 'mango' })).toBe('Give {buddy} 10 mangoes');
    expect(renderCaption(pack, 'Tap the letter {target}', { target: 'b' })).toBe('Tap the letter b');
    expect(renderCaption(pack, 'Count to {target}', { target: 'n10' })).toBe('Count to 10');
  });
});
