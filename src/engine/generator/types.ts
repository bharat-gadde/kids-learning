// src/engine/generator/types.ts
import type { MechanicId } from '../content/schema';

/** One thing the child can see and touch in a round. */
export interface RoundItem {
  /** unique among the round's items; the object or glyph id, except for size copies, counted groups and give-count copies */
  readonly id: string;
  readonly label: string;
  readonly lineId: string;
  /** vector asset path, or `glyph:<char>` for letters and numbers rendered as text */
  readonly asset: string;
  /** relative size for size rules (1 = full size) */
  readonly scale?: number;
  /** how many copies to draw for count rules */
  readonly count?: number;
}

export interface RoundBin {
  readonly id: string;
  readonly label: string;
  readonly lineId: string;
  readonly asset?: string;
}

export type Payload =
  | { readonly kind: 'choose'; readonly options: readonly RoundItem[]; readonly correctIds: readonly string[]; readonly stimulus?: RoundItem }
  | { readonly kind: 'pairs'; readonly left: readonly RoundItem[]; readonly right: readonly RoundItem[]; readonly pairs: ReadonlyArray<readonly [string, string]> }
  | { readonly kind: 'bins'; readonly bins: readonly RoundBin[]; readonly items: ReadonlyArray<RoundItem & { readonly binId: string }> }
  /**
   * Drag items onto `target`. Without `count`, the `correctIds` items are the ones to give.
   * With `count` (give-count), the items are interchangeable copies: any `count` of them is right, and
   * `correctIds` is just one valid choice (for the hint and the demonstration).
   */
  | { readonly kind: 'give'; readonly target: RoundBin; readonly items: readonly RoundItem[]; readonly correctIds: readonly string[]; readonly count?: number }
  | { readonly kind: 'order'; readonly items: readonly RoundItem[]; readonly correctOrder: readonly string[] }
  | {
      readonly kind: 'scenario';
      readonly scenarioId: string;
      readonly vignette: string;
      readonly narrationLineId: string;
      readonly choices: ReadonlyArray<RoundItem & { readonly correct: boolean; readonly reactionLineId?: string }>;
    };

/** Difficulty level 1–3, the index into `Template.difficulty` (not the school level `LevelId`). */
export type Level = 1 | 2 | 3;

export interface RoundPrompt {
  readonly lineId: string;
  readonly variant: number;
  /** caption text with slots rendered as labels */
  readonly text: string;
  /** slot name → item id or literal (the audio manager resolves ids to clips) */
  readonly slots: Readonly<Record<string, string>>;
}

export interface Round {
  readonly templateId: string;
  readonly topicId: string;
  readonly goalId: string;
  readonly mechanic: MechanicId;
  /** mastery form key: `${mechanic}:${itemClass}` */
  readonly form: string;
  /**
   * The set's seed (what generateSet was given) and this round's place in the set, from 0. With the level and the
   * history the set was generated with, `generateSet(pack, template, { seed, level, history })[index]` is this round
   * again (spec §5.4); seed and index together identify it.
   */
  readonly seed: number;
  readonly index: number;
  readonly level: Level;
  readonly sceneId: string;
  readonly prompt: RoundPrompt;
  readonly payload: Payload;
  /**
   * Where the slot rule put the answer in `choose` options or `scenario` choices (a scenario with two right answers
   * reports the one it placed; tap-all, which shuffles its several answers, reports the first); null for every other payload.
   */
  readonly correctSlot: number | null;
  /**
   * The keys recent-repeat avoidance compares, fed back as history: the sampled object or glyph ids (for size and
   * count rules the object itself, not its copies or the numeral, plus `n:<value>` for each count asked about),
   * the rhyme group or pair key for pair rules, and the sequence or scenario id for those rules.
   */
  readonly itemIds: readonly string[];
}

/** Read-only: one history (and the shared EMPTY_HISTORY) can be handed to many generateSet calls. */
export interface GeneratorHistory {
  /** item ids used for this goal in the last 3 sessions, oldest first */
  readonly recentItemIds: readonly string[];
  readonly lastSlot: number | null;
  readonly lastSceneId: string | null;
  /** lineId → variant index used last time */
  readonly lastVariantByLine: Readonly<Record<string, number>>;
}

export const EMPTY_HISTORY: GeneratorHistory = Object.freeze({
  recentItemIds: Object.freeze([]),
  lastSlot: null,
  lastSceneId: null,
  lastVariantByLine: Object.freeze({}),
});
