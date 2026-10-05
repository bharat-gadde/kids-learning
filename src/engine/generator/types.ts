// src/engine/generator/types.ts
import type { MechanicId } from '../content/schema';

/** One thing the child can see and touch in a round. */
export interface RoundItem {
  /** unique among the round's items; the object or glyph id, except for size copies, counted groups and give-count copies */
  id: string;
  label: string;
  lineId: string;
  /** vector asset path, or `glyph:<char>` for letters and numbers rendered as text */
  asset: string;
  /** relative size for size rules (1 = full size) */
  scale?: number;
  /** how many copies to draw for count rules */
  count?: number;
}

export interface RoundBin {
  id: string;
  label: string;
  lineId: string;
  asset?: string;
}

export type Payload =
  | { kind: 'choose'; options: RoundItem[]; correctIds: string[]; stimulus?: RoundItem }
  | { kind: 'pairs'; left: RoundItem[]; right: RoundItem[]; pairs: Array<[string, string]> }
  | { kind: 'bins'; bins: RoundBin[]; items: Array<RoundItem & { binId: string }> }
  /**
   * Drag items onto `target`. Without `count`, the `correctIds` items are the ones to give.
   * With `count` (give-count), the items are interchangeable copies: any `count` of them is right, and
   * `correctIds` is just one valid choice (for the hint and the demonstration).
   */
  | { kind: 'give'; target: RoundBin; items: RoundItem[]; correctIds: string[]; count?: number }
  | { kind: 'order'; items: RoundItem[]; correctOrder: string[] }
  | {
      kind: 'scenario';
      scenarioId: string;
      vignette: string;
      narrationLineId: string;
      choices: Array<RoundItem & { correct: boolean; reactionLineId?: string }>;
    };

/** Difficulty level 1–3, the index into `Template.difficulty` (not the school level `LevelId`). */
export type Level = 1 | 2 | 3;

export interface RoundPrompt {
  lineId: string;
  variant: number;
  /** caption text with slots rendered as labels */
  text: string;
  /** slot name → item id or literal (the audio manager resolves ids to clips) */
  slots: Record<string, string>;
}

export interface Round {
  templateId: string;
  topicId: string;
  goalId: string;
  mechanic: MechanicId;
  /** mastery form key: `${mechanic}:${itemClass}` */
  form: string;
  seed: number;
  level: Level;
  sceneId: string;
  prompt: RoundPrompt;
  payload: Payload;
  /** index of the (first) correct entry in `choose` options or `scenario` choices; null for every other payload */
  correctSlot: number | null;
  /**
   * The keys recent-repeat avoidance compares, fed back as history: the sampled object or glyph ids (for size and
   * count rules the object itself, not its copies or the numeral), the rhyme group or pair key for pair rules,
   * and the sequence or scenario id for those rules.
   */
  itemIds: string[];
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
