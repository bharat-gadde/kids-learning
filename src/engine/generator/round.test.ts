// src/engine/generator/round.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readPack } from '../content/readPackFromDisk';
import { slotsFilled } from '../content/validate';
import { generateSet, renderCaption, pickVariant, pickScene } from './round';
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

  it('avoids the last scene and the last wording variant', () => {
    const t = pack.templates.get('big-small.tap')!;
    for (let seed = 0; seed < 30; seed++) {
      const rounds = generateSet(pack, t, { seed, level: 1, history: { ...EMPTY_HISTORY, lastSceneId: 'garden', lastVariantByLine: { 'prompt.tap_big': 0 } } });
      expect(rounds[0]!.sceneId).not.toBe('garden');
      expect(rounds[0]!.prompt.variant).not.toBe(0);
    }
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
    expect(renderCaption(pack, 'Tap the letter {target}', { target: 'b' })).toBe('Tap the letter b');
    expect(renderCaption(pack, 'Count to {target}', { target: 'n10' })).toBe('Count to 10');
  });
});
