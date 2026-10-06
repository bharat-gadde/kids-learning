// src/engine/generator/rules.ts
import type { ContentPack } from '../content/load';
import type { Bin, Difficulty, Glyph, Template } from '../content/schema';
import { pick, shuffle, type Rng } from '../rng';
import { categoryOf, glyphCandidate, objectCandidate, pluralOf, queryItems, tagOf, toRoundItem, type Candidate } from './items';
import { pickDistractors, sampleWithoutRecent } from './sampling';
import { chooseSlot, placeAt } from './slots';
import type { Level, Payload, RoundBin, RoundItem } from './types';

export class GenerationError extends Error {
  override name = 'GenerationError';
}

export interface RuleContext {
  pack: ContentPack;
  template: Template;
  rng: Rng;
  level: Level;
  difficulty: Difficulty;
  /** key item ids to avoid as correct answers: recent history (in no particular order), then this set's earlier rounds, oldest first */
  avoid: readonly string[];
  /** earlier correct slots, oldest first: the previous set's last slot (if known), then this set's */
  recentSlots: readonly number[];
  slotCounts: readonly number[];
}

export interface RuleResult {
  payload: Payload;
  /** slot name → item id (or literal) for the prompt */
  slots: Record<string, string>;
  /** key item ids used, fed back into history */
  itemIds: string[];
  correctSlot: number | null;
  /** overrides the template prompt (sequences carry their own) */
  promptLineId?: string;
}

const SIZE_SCALES: Record<number, number[]> = {
  2: [0.55, 1],
  3: [0.55, 0.78, 1],
  4: [0.45, 0.63, 0.81, 1],
};

/** The difficulty parameters for a level (the tuple index is level − 1). */
export function difficultyAt(template: Template, level: Level): Difficulty {
  return template.difficulty[level - 1] as Difficulty;
}

function toRoundBin(b: Bin): RoundBin {
  return { id: b.id, label: b.label, lineId: b.lineId, ...(b.asset ? { asset: b.asset } : {}) };
}

function candidates(ctx: RuleContext): Candidate[] {
  if (!ctx.template.query) throw new GenerationError(`template ${ctx.template.id} has no query`);
  return queryItems(ctx.pack, ctx.template.query);
}

function requireBins(ctx: RuleContext): Bin[] {
  if (!ctx.template.bins?.length) throw new GenerationError(`template ${ctx.template.id} needs bins`);
  return ctx.template.bins;
}

function one<T>(items: T[], what: string): T {
  const first = items[0];
  if (first === undefined) throw new GenerationError(`no ${what} available`);
  return first;
}

function numberGlyph(pack: ContentPack, n: number): Glyph {
  const g = [...pack.glyphs.values()].find((x) => x.kind === 'number' && x.value === n);
  if (!g) throw new GenerationError(`no number glyph for ${n}`);
  return g;
}

function rangeInts(range: readonly [number, number] | undefined, what: string): number[] {
  if (!range) throw new GenerationError(`${what} needs a difficulty range`);
  const [lo, hi] = range;
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/** Lay out one correct item among distractors, honouring the slot rules. */
function chooseLayout<T extends RoundItem>(ctx: RuleContext, correct: T, others: readonly T[]): { options: T[]; slot: number } {
  const slot = chooseSlot(ctx.rng, others.length + 1, ctx.recentSlots, ctx.slotCounts);
  // placeAt keeps the others' order, and builders pass them sorted (similarity buckets, number distance).
  return { options: placeAt(correct, shuffle(ctx.rng, others), slot), slot };
}

function buildNamed(ctx: RuleContext): RuleResult {
  const pool = candidates(ctx);
  const correct = one(sampleWithoutRecent(ctx.rng, pool, 1, ctx.avoid), 'named target');
  const distractors = pickDistractors(ctx.rng, pool, [correct], ctx.difficulty.options - 1, ctx.difficulty.distractorSimilarity);
  const { options, slot } = chooseLayout(ctx, toRoundItem(correct), distractors.map(toRoundItem));
  return {
    payload: { kind: 'choose', options, correctIds: [correct.item.id] },
    slots: { target: correct.item.id },
    itemIds: [correct.item.id],
    correctSlot: slot,
  };
}

function buildSize(ctx: RuleContext): RuleResult {
  const rule = ctx.template.rule;
  if (rule.kind !== 'size') throw new GenerationError('not a size rule');
  const pool = candidates(ctx).filter((c) => tagOf(c, 'sizePair') === true);

  if (ctx.template.mechanic === 'sort-into-bins') {
    const bins = requireBins(ctx);
    const bigBin = bins.find((b) => b.match === 'large');
    const smallBin = bins.find((b) => b.match === 'small');
    if (!bigBin || !smallBin) throw new GenerationError('size bins need match values "large" and "small"');
    const objects = sampleWithoutRecent(ctx.rng, pool, Math.ceil(ctx.difficulty.options / 2), ctx.avoid);
    const items = objects.flatMap((c) => {
      const base = toRoundItem(c);
      return [
        { ...base, id: `${base.id}@s`, scale: 0.55, binId: smallBin.id },
        { ...base, id: `${base.id}@l`, scale: 1, binId: bigBin.id },
      ];
    });
    return {
      payload: { kind: 'bins', bins: bins.map(toRoundBin), items: shuffle(ctx.rng, items) },
      slots: {},
      itemIds: objects.map((c) => c.item.id),
      correctSlot: null,
    };
  }

  const correctCand = one(sampleWithoutRecent(ctx.rng, pool, 1, ctx.avoid), 'sizePair object');
  const scales = SIZE_SCALES[Math.min(4, Math.max(2, ctx.difficulty.options))] as number[];
  const base = toRoundItem(correctCand);
  const copies = scales.map((scale, i) => ({ ...base, id: `${base.id}@${i}`, scale }));
  const correctIndex = rule.target === 'larger' ? copies.length - 1 : 0;
  const correct = copies[correctIndex] as RoundItem;
  const { options, slot } = chooseLayout(ctx, correct, copies.filter((_, i) => i !== correctIndex));
  return {
    payload: { kind: 'choose', options, correctIds: [correct.id] },
    slots: { target: correctCand.item.id },
    itemIds: [correctCand.item.id],
    correctSlot: slot,
  };
}

/** Shared by tag and category rules: a predicate decides which candidates are "matching". */
function buildMatching(ctx: RuleContext, matches: (c: Candidate) => boolean, binFor: (c: Candidate, bins: Bin[]) => Bin | undefined): RuleResult {
  const pool = candidates(ctx);
  const yes = pool.filter(matches);
  const no = pool.filter((c) => !matches(c));
  const mechanic = ctx.template.mechanic;

  if (mechanic === 'sort-into-bins') {
    const bins = requireBins(ctx);
    const half = Math.ceil(ctx.difficulty.options / 2);
    const chosen = [...sampleWithoutRecent(ctx.rng, yes, half, ctx.avoid), ...sampleWithoutRecent(ctx.rng, no, ctx.difficulty.options - half, ctx.avoid)];
    const items = chosen.map((c) => {
      const bin = binFor(c, bins);
      if (!bin) throw new GenerationError(`no bin accepts ${c.item.id} in ${ctx.template.id}`);
      return { ...toRoundItem(c), binId: bin.id };
    });
    return { payload: { kind: 'bins', bins: bins.map(toRoundBin), items: shuffle(ctx.rng, items) }, slots: {}, itemIds: chosen.map((c) => c.item.id), correctSlot: null };
  }

  const wanted = mechanic === 'tap-the-one' ? 1 : Math.min(ctx.difficulty.correctCount ?? 1, yes.length, ctx.difficulty.options - 1);
  const correct = sampleWithoutRecent(ctx.rng, yes, wanted, ctx.avoid);
  const distractors = pickDistractors(ctx.rng, no, correct, ctx.difficulty.options - correct.length, ctx.difficulty.distractorSimilarity);
  const correctIds = correct.map((c) => c.item.id);
  const first = one(correct, 'matching item');

  if (mechanic === 'give-to-buddy') {
    const target = one(requireBins(ctx), 'bin');
    const items = shuffle(ctx.rng, [...correct, ...distractors].map(toRoundItem));
    return { payload: { kind: 'give', target: toRoundBin(target), items, correctIds }, slots: { target: first.item.id }, itemIds: correctIds, correctSlot: null };
  }

  if (mechanic === 'tap-the-one') {
    const { options, slot } = chooseLayout(ctx, toRoundItem(first), distractors.map(toRoundItem));
    return { payload: { kind: 'choose', options, correctIds }, slots: { target: first.item.id }, itemIds: correctIds, correctSlot: slot };
  }

  const options = shuffle(ctx.rng, [...correct, ...distractors].map(toRoundItem));
  return {
    payload: { kind: 'choose', options, correctIds },
    slots: { target: first.item.id },
    itemIds: correctIds,
    correctSlot: options.findIndex((o) => correctIds.includes(o.id)),
  };
}

function buildTag(ctx: RuleContext): RuleResult {
  const rule = ctx.template.rule;
  if (rule.kind !== 'tag') throw new GenerationError('not a tag rule');
  return buildMatching(
    ctx,
    (c) => tagOf(c, rule.tag) === rule.value,
    (c, bins) => bins.find((b) => b.match === tagOf(c, rule.tag)) ?? bins.find((b) => b.match !== rule.value),
  );
}

function buildCategory(ctx: RuleContext): RuleResult {
  const rule = ctx.template.rule;
  if (rule.kind !== 'category') throw new GenerationError('not a category rule');
  const target = rule.values[0] as string;
  return buildMatching(
    ctx,
    (c) => categoryOf(c) === target,
    (c, bins) => bins.find((b) => b.match === categoryOf(c)),
  );
}

function groupItem(c: Candidate, n: number): RoundItem {
  const base = toRoundItem(c);
  const noun = c.kind === 'object' ? (n === 1 ? c.item.name : pluralOf(c.item)) : base.label;
  return { ...base, id: `${base.id}x${n}`, label: `${n} ${noun}`, count: n };
}

/** The history key for a count a round asked about, kept in `itemIds` beside the object. */
const countKey = (n: number) => `n:${n}`;

/**
 * `k` counts from the range. Counts change between rounds (spec §2.2), and they are asked in passes: a pass asks
 * every count in the range once, in a fresh order, and the next pass never opens with the last round's counts; a
 * round that needs more counts than its pass has left (drag-to-match) tops up with the pass's earliest.
 * (Least recently used would also cover the range, but it replays a set's own order once a small range runs out: 1 3 2 1 3.)
 */
function sampleCounts(ctx: RuleContext, numbers: readonly number[], k: number): number[] {
  const pool = numbers.map((n) => ({ id: countKey(n), n }));
  const asked = ctx.avoid.filter((id) => pool.some((c) => c.id === id));
  const pass = new Set<string>();
  for (const id of asked) {
    pass.add(id);
    if (pass.size === pool.length) pass.clear();
  }
  return sampleWithoutRecent(ctx.rng, pool, k, [...pass, ...asked.slice(-k)]).map((c) => c.n);
}

/**
 * The other numerals for "count, then tap the number", chosen so that n's rank among the numerals shown is random:
 * neither "tap the biggest" nor "tap the middle one" pays. Low similarity: other numbers from the level's range, drawn
 * like n itself (so its rank is uniform), and the nearest outside the range only when it is too narrow. Medium and
 * high: the nearest numerals, with how many sit below n drawn first. validate.ts guarantees numerals for 0–10 and the range.
 */
function countDistractors(ctx: RuleContext, n: number, numbers: readonly number[]): number[] {
  const k = ctx.difficulty.options - 1;
  const others = Array.from({ length: Math.max(10, ...numbers) + 1 }, (_, x) => x).filter((x) => x !== n);
  const nearest = (xs: number[]) => xs.sort((a, b) => Math.abs(a - n) - Math.abs(b - n));
  if (ctx.difficulty.distractorSimilarity === 'low') {
    return [...shuffle(ctx.rng, others.filter((x) => numbers.includes(x))), ...nearest(others.filter((x) => !numbers.includes(x)))].slice(0, k);
  }
  const below = nearest(others.filter((x) => x < n));
  const above = nearest(others.filter((x) => x > n));
  const fromBelow = Math.max(k - above.length, Math.min(below.length, pick(ctx.rng, Array.from({ length: k + 1 }, (_, i) => i))));
  return [...below.slice(0, fromBelow), ...above.slice(0, k - fromBelow)];
}

function buildCount(ctx: RuleContext): RuleResult {
  const pool = candidates(ctx).filter((c) => tagOf(c, 'countable') === true);
  const obj = one(sampleWithoutRecent(ctx.rng, pool, 1, ctx.avoid), 'countable object');
  const numbers = rangeInts(ctx.difficulty.range, 'count');

  if (ctx.template.mechanic === 'drag-to-match') {
    const ns = shuffle(ctx.rng, sampleCounts(ctx, numbers, ctx.difficulty.options));
    const left = ns.map((n) => groupItem(obj, n));
    const right = shuffle(ctx.rng, ns.map((n) => toRoundItem(glyphCandidate(numberGlyph(ctx.pack, n)))));
    const pairs = ns.map((n): [string, string] => [`${obj.item.id}x${n}`, numberGlyph(ctx.pack, n).id]);
    return { payload: { kind: 'pairs', left, right, pairs }, slots: {}, itemIds: [obj.item.id, ...ns.map(countKey)], correctSlot: null };
  }

  const n = one(sampleCounts(ctx, numbers, 1), 'count');
  const correct = toRoundItem(glyphCandidate(numberGlyph(ctx.pack, n)));
  const others = countDistractors(ctx, n, numbers).map((d) => toRoundItem(glyphCandidate(numberGlyph(ctx.pack, d))));
  const { options, slot } = chooseLayout(ctx, correct, others);
  return {
    payload: { kind: 'choose', options, correctIds: [correct.id], stimulus: groupItem(obj, n) },
    slots: { targets: obj.item.id }, // never n: it is the answer ("How many {targets} can you see?")
    itemIds: [obj.item.id, countKey(n)],
    correctSlot: slot,
  };
}

function buildGiveCount(ctx: RuleContext): RuleResult {
  const pool = candidates(ctx).filter((c) => tagOf(c, 'countable') === true);
  const obj = one(sampleWithoutRecent(ctx.rng, pool, 1, ctx.avoid), 'countable object');
  const n = one(sampleCounts(ctx, rangeInts(ctx.difficulty.range, 'give-count'), 1), 'count');
  const total = Math.max(ctx.difficulty.options, n + 2);
  const base = toRoundItem(obj);
  const items = Array.from({ length: total }, (_, i) => ({ ...base, id: `${base.id}#${i}` }));
  const target = one(requireBins(ctx), 'bin');
  return {
    payload: { kind: 'give', target: toRoundBin(target), items, correctIds: items.slice(0, n).map((i) => i.id), count: n },
    slots: { n: String(n), targets: obj.item.id },
    itemIds: [obj.item.id, countKey(n)],
    correctSlot: null,
  };
}

/**
 * Rhyme groups for a low-similarity level (spec §5.4 rule 7: obvious distractors first): no two end in the same letter,
 * so level 1 never sets -an beside -en, or -og beside -ug, where only the vowel tells the pairs apart (a rhymeGroup is
 * spelled as its rime). One at a time, each still preferring groups the recent rounds left out; when every group left
 * shares an ending with one already chosen, any unused group fills in.
 */
function sampleUnlikeRhymes<T extends { id: string }>(ctx: RuleContext, usable: readonly T[], k: number): T[] {
  const chosen: T[] = [];
  for (let i = 0; i < k; i++) {
    const unused = usable.filter((g) => !chosen.includes(g));
    const unlike = unused.filter((g) => !chosen.some((c) => c.id.at(-1) === g.id.at(-1)));
    chosen.push(...sampleWithoutRecent(ctx.rng, unlike.length > 0 ? unlike : unused, 1, ctx.avoid));
  }
  return chosen;
}

function buildPair(ctx: RuleContext): RuleResult {
  const rule = ctx.template.rule;
  if (rule.kind !== 'pair') throw new GenerationError('not a pair rule');
  const pool = candidates(ctx);
  const k = ctx.difficulty.options;

  if (rule.by === 'rhymeGroup') {
    const groups = new Map<string, Candidate[]>();
    for (const c of pool) {
      const g = tagOf(c, 'rhymeGroup');
      if (typeof g === 'string') groups.set(g, [...(groups.get(g) ?? []), c]);
    }
    const usable = [...groups.entries()].filter(([, members]) => members.length >= 2).map(([id, members]) => ({ id, members }));
    const chosen = ctx.difficulty.distractorSimilarity === 'low' ? sampleUnlikeRhymes(ctx, usable, k) : sampleWithoutRecent(ctx.rng, usable, k, ctx.avoid);
    const left: RoundItem[] = [];
    const right: RoundItem[] = [];
    const pairs: Array<[string, string]> = [];
    for (const group of chosen) {
      const [a, b] = shuffle(ctx.rng, group.members);
      if (!a || !b) continue;
      left.push(toRoundItem(a));
      right.push(toRoundItem(b));
      pairs.push([a.item.id, b.item.id]);
    }
    return { payload: { kind: 'pairs', left, right: shuffle(ctx.rng, right), pairs }, slots: {}, itemIds: chosen.map((g) => g.id), correctSlot: null };
  }

  const byKey = new Map<string, { upper?: Glyph; lower?: Glyph }>();
  for (const c of pool) {
    if (c.kind !== 'glyph') continue;
    const entry = byKey.get(c.item.pairKey) ?? {};
    if (c.item.case === 'upper') entry.upper = c.item;
    if (c.item.case === 'lower') entry.lower = c.item;
    byKey.set(c.item.pairKey, entry);
  }
  const complete = [...byKey.entries()].filter(([, e]) => e.upper && e.lower).map(([id, e]) => ({ id, upper: e.upper as Glyph, lower: e.lower as Glyph }));
  const chosen = sampleWithoutRecent(ctx.rng, complete, k, ctx.avoid);
  const left = chosen.map((p) => toRoundItem(glyphCandidate(p.upper)));
  const right = shuffle(ctx.rng, chosen.map((p) => toRoundItem(glyphCandidate(p.lower))));
  const pairs = chosen.map((p): [string, string] => [p.upper.id, p.lower.id]);
  return { payload: { kind: 'pairs', left, right, pairs }, slots: {}, itemIds: chosen.map((p) => p.id), correctSlot: null };
}

function buildSequence(ctx: RuleContext): RuleResult {
  const all = [...ctx.pack.sequences.values()].filter((s) => s.topicId === ctx.template.topicId);
  const fitting = all.filter((s) => s.steps.length <= ctx.difficulty.options);
  const seq = one(sampleWithoutRecent(ctx.rng, fitting.length ? fitting : all, 1, ctx.avoid), 'sequence');
  const ordered = seq.steps.map((id) => {
    const o = ctx.pack.objects.get(id);
    if (!o) throw new GenerationError(`sequence ${seq.id} references unknown object ${id}`);
    return toRoundItem(objectCandidate(o));
  });
  let items = shuffle(ctx.rng, ordered);
  for (let tries = 0; tries < 10 && items.every((it, i) => it.id === ordered[i]?.id); tries++) items = shuffle(ctx.rng, ordered);
  return {
    payload: { kind: 'order', items, correctOrder: [...seq.steps] }, // a copy: a renderer reordering it must not reorder the pack
    slots: {},
    itemIds: [seq.id],
    correctSlot: null,
    promptLineId: seq.promptLineId,
  };
}

function buildScenario(ctx: RuleContext): RuleResult {
  const all = [...ctx.pack.scenarios.values()].filter((s) => s.topicId === ctx.template.topicId);
  const sc = one(sampleWithoutRecent(ctx.rng, all, 1, ctx.avoid), 'scenario');
  const choices = sc.choices.map((ch) => {
    const o = ctx.pack.objects.get(ch.objectId);
    if (!o) throw new GenerationError(`scenario ${sc.id} references unknown object ${ch.objectId}`);
    return { ...toRoundItem(objectCandidate(o)), correct: ch.correct, ...(ch.reactionLineId ? { reactionLineId: ch.reactionLineId } : {}) };
  });
  // The slot rule places the first correct choice; a second correct one (toy-broken: angry or sad) is shuffled in with the rest.
  const answer = one(choices.filter((c) => c.correct), `correct choice in ${sc.id}`);
  const { options, slot } = chooseLayout(ctx, answer, choices.filter((c) => c !== answer));
  return {
    payload: { kind: 'scenario', scenarioId: sc.id, vignette: sc.vignette, narrationLineId: sc.narrationLineId, choices: options },
    slots: {},
    itemIds: [sc.id],
    correctSlot: slot,
  };
}

/** Build the payload for a template at the given difficulty. Deterministic given ctx.rng. */
export function buildPayload(ctx: RuleContext): RuleResult {
  switch (ctx.template.rule.kind) {
    case 'named': return buildNamed(ctx);
    case 'size': return buildSize(ctx);
    case 'tag': return buildTag(ctx);
    case 'category': return buildCategory(ctx);
    case 'count': return buildCount(ctx);
    case 'give-count': return buildGiveCount(ctx);
    case 'pair': return buildPair(ctx);
    case 'sequence': return buildSequence(ctx);
    case 'scenario': return buildScenario(ctx);
  }
}
