// src/engine/generator/types.ts
import type { MechanicId } from '../content/schema';

/** One thing the child can see and touch in a round. */
export interface RoundItem {
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
  | { kind: 'choose'; options: RoundItem[]; correctIds: string[] }
  | { kind: 'pairs'; left: RoundItem[]; right: RoundItem[]; pairs: Array<[string, string]> }
  | { kind: 'bins'; bins: RoundBin[]; items: Array<RoundItem & { binId: string }> }
  | { kind: 'give'; target: RoundBin; items: RoundItem[]; correctIds: string[]; count?: number }
  | { kind: 'order'; items: RoundItem[]; correctOrder: string[] }
  | {
      kind: 'scenario';
      scenarioId: string;
      vignette: string;
      narrationLineId: string;
      choices: Array<RoundItem & { correct: boolean; reactionLineId?: string }>;
    };

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
  /** index of the (first) correct option for choose/give payloads, else null */
  correctSlot: number | null;
  /** ids of the "key" items used (correct answers, sequence/scenario ids) — fed back as recent history */
  itemIds: string[];
}

export interface GeneratorHistory {
  /** item ids used for this goal in the last 3 sessions, oldest first */
  recentItemIds: string[];
  lastSlot: number | null;
  lastSceneId: string | null;
  /** lineId → variant index used last time */
  lastVariantByLine: Record<string, number>;
}

export const EMPTY_HISTORY: GeneratorHistory = {
  recentItemIds: [],
  lastSlot: null,
  lastSceneId: null,
  lastVariantByLine: {},
};
