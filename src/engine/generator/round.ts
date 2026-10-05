// src/engine/generator/round.ts
import type { ContentPack } from '../content/load';
import { UI_SLOTS, type Template } from '../content/schema';
import { deriveSeed, mulberry32, pick, shuffle, type Rng } from '../rng';
import { pluralOf } from './items';
import { buildPayload, difficultyAt, GenerationError, type RuleResult } from './rules';
import type { GeneratorHistory, Level, Round } from './types';

export interface GenerateOptions {
  seed: number;
  level: Level;
  history: GeneratorHistory;
}

/** Variation rule 3: a different wording than last time, when the line has more than one. */
export function pickVariant(rng: Rng, count: number, last: number | undefined): number {
  if (count <= 1) return 0;
  return pick(rng, Array.from({ length: count }, (_, i) => i).filter((i) => i !== last));
}

/** Variation rule 4: a different scene than last set, when the template has more than one. */
export function pickScene(rng: Rng, scenes: readonly string[], last: string | null): string {
  if (scenes.length === 1) return scenes[0] as string;
  return pick(rng, scenes.filter((s) => s !== last));
}

/** Resolve a slot value to the text shown in the caption. */
export function slotLabel(pack: ContentPack, slot: string, value: string): string {
  const object = pack.objects.get(value);
  if (object) return slot === 'targets' ? pluralOf(object) : object.name;
  const glyph = pack.glyphs.get(value);
  if (glyph) return glyph.kind === 'number' && glyph.value !== undefined ? String(glyph.value) : glyph.char;
  return value;
}

/**
 * Fill a caption's slots. UI_SLOTS ({name}, {buddy}) are left for the UI to fill from the profile.
 * "{n} {targets}" uses the singular when n is 1: "Give Buddy 1 apple".
 */
export function renderCaption(pack: ContentPack, text: string, slots: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, slot: string) => {
    if (UI_SLOTS.has(slot)) return whole;
    const value = slots[slot];
    if (value === undefined) return whole;
    return slotLabel(pack, slot === 'targets' && slots.n === '1' ? 'target' : slot, value);
  });
}

interface RoundOptions {
  seed: number;
  level: Level;
  sceneId: string;
  avoid: readonly string[];
  recentSlots: readonly number[];
  slotCounts: readonly number[];
  lastVariantByLine: Readonly<Record<string, number>>;
}

export function generateRound(pack: ContentPack, template: Template, opts: RoundOptions): Round {
  const rng = mulberry32(opts.seed);
  const difficulty = difficultyAt(template, opts.level);
  let result: RuleResult;
  try {
    result = buildPayload({ pack, template, rng, level: opts.level, difficulty, avoid: opts.avoid, recentSlots: opts.recentSlots, slotCounts: opts.slotCounts });
  } catch (e) {
    // name what replays it: "no countable object available" alone does not say which template, seed or level
    if (e instanceof GenerationError) throw new GenerationError(`${template.id} (seed ${opts.seed}, level ${opts.level}): ${e.message}`, { cause: e });
    throw e;
  }
  const lineId = result.promptLineId ?? template.flavour.promptLineId;
  const line = pack.lines.get(lineId);
  if (!line) throw new GenerationError(`missing line ${lineId}`);
  const variant = pickVariant(rng, line.variants.length, opts.lastVariantByLine[lineId]);
  const text = renderCaption(pack, line.variants[variant] as string, result.slots);
  return {
    templateId: template.id,
    topicId: template.topicId,
    goalId: template.goalId,
    mechanic: template.mechanic,
    form: `${template.mechanic}:${template.itemClass}`,
    seed: opts.seed,
    level: opts.level,
    sceneId: opts.sceneId,
    prompt: { lineId, variant, text, slots: result.slots },
    payload: result.payload,
    correctSlot: result.correctSlot,
    itemIds: result.itemIds,
  };
}

/** A whole set: one scene, no repeated key items, balanced slots, rotating wording. */
export function generateSet(pack: ContentPack, template: Template, opts: GenerateOptions): Round[] {
  const setRng = mulberry32(deriveSeed(opts.seed, 'set'));
  const sceneId = pickScene(setRng, template.flavour.scenes, opts.history.lastSceneId);
  // Rule 1 prefers what the last 3 sessions did not use; among what they did, no order is preferred.
  // Shuffled, so a pool the history covers (feelings: 6 faces, 6 rounds) is not replayed in last set's order.
  const recent = shuffle(setRng, [...new Set(opts.history.recentItemIds)]);
  const used: string[] = [];
  const slotCounts: number[] = [];
  const lastVariantByLine: Record<string, number> = { ...opts.history.lastVariantByLine };
  const recentSlots: number[] = opts.history.lastSlot === null ? [] : [opts.history.lastSlot];
  const rounds: Round[] = [];
  for (let i = 0; i < template.rounds; i++) {
    const round = generateRound(pack, template, {
      seed: deriveSeed(opts.seed, `round${i}`),
      level: opts.level,
      sceneId,
      avoid: [...recent, ...used],
      recentSlots: [...recentSlots],
      slotCounts,
      lastVariantByLine,
    });
    rounds.push(round);
    used.push(...round.itemIds);
    if (round.correctSlot !== null) {
      recentSlots.push(round.correctSlot);
      slotCounts[round.correctSlot] = (slotCounts[round.correctSlot] ?? 0) + 1;
    }
    lastVariantByLine[round.prompt.lineId] = round.prompt.variant;
  }
  return rounds;
}
