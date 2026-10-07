// src/engine/progress/types.ts
import type { LevelId, MechanicId } from '../content/schema';
import type { Level } from '../generator/types';

/**
 * How a round ended (spec §4.4). Every hint points at the answer, so only `correct` counts as correct: in goalStatus,
 * formSummary, bridging and SetResult.correct.
 * - correct: right before any hint was shown
 * - corrected: right after a hint: the one after a first wrong try, or the wiggle after a long wait
 * - shown: wrong twice, so Buddy showed the answer
 */
export type Outcome = 'correct' | 'corrected' | 'shown';

/**
 * What a mechanic records about the round it just ran; the history builders read these back.
 * A mechanic that records more adds a named field here.
 */
export interface AttemptDetails {
  itemIds?: string[];
  slot?: number | null;
  sceneId?: string;
  lineId?: string;
  lineVariant?: number;
  /** the round's place in its set (Round.index); with Attempt.seed it names the round to replay */
  round?: number;
  /** hash of the round's payload (what was on screen), so a replay is told apart from a round that only shares its target */
  payloadHash?: number;
  /**
   * What the child picked or placed wrongly, in order: an option's or item's id, `item>target` for an item put in the
   * wrong place (a bin, a slot, a partner), or `n:<count>` for a wrong count. Absent when there was none. The parent
   * corner's named confusions (spec §5.5, §8: b/d, 6/9, a tomato in the fruit basket) read it, with the attempt's mechanic.
   */
  wrongIds?: string[];
}

export interface Attempt {
  id?: number;
  profileId: string;
  /** ms since the epoch, from a clock that never goes back or repeats: mastery, bridging, the picker and replay order by it */
  at: number;
  sessionIndex: number;
  templateId: string;
  topicId: string;
  goalId: string;
  mechanic: MechanicId;
  /** `${mechanic}:${itemClass}` — the unit of generalisation */
  form: string;
  /** the set's seed (Round.seed); `details.round` says which of its rounds this was */
  seed: number;
  /** the difficulty the set was made at (not the school level, Profile.level) */
  level: Level;
  outcome: Outcome;
  /** hints shown in the round: the one after a first wrong try, and each wiggle after a wait (a repeated prompt is not one) */
  hints: number;
  durationMs: number;
  details?: AttemptDetails;
}

/** A finished set: its last round ended. A set left early keeps its attempts but has no SetResult (see levelFor). */
export interface SetResult {
  id?: number;
  profileId: string;
  at: number;
  sessionIndex: number;
  templateId: string;
  goalId: string;
  level: Level;
  /** rounds whose outcome was `correct`: the "% correct" of the difficulty ramp (spec §5.4 rule 7), as mastery counts it */
  correct: number;
  /** rounds played in the set */
  total: number;
}

export interface Profile {
  id: string;
  name: string;
  /** the school level (spec §5.6), not a difficulty Level */
  level: LevelId;
  buddy: { colour: string; name: string; accessory: string };
  createdAt: number;
}

export interface Session {
  id?: number;
  profileId: string;
  /** 1-based, increases on every visit */
  index: number;
  startedAt: number;
}

export interface Settings {
  profileId: string;
  timerMinutes: 10 | 15 | 20 | 30;
  theme: 'storybook' | 'soft-flat';
  music: boolean;
  ttsFallback: boolean;
  leftHanded: boolean;
  reducedMotion: boolean;
}

export const defaultSettings = (profileId: string): Settings => ({
  profileId, timerMinutes: 15, theme: 'storybook', music: true, ttsFallback: true, leftHanded: false, reducedMotion: false,
});

export interface RoutineEvent {
  id?: number;
  profileId: string;
  at: number;
  sessionIndex: number;
  sceneId: string;
  completed: boolean;
  selfReport?: 'yes' | 'not-yet' | 'skipped';
  randomEventId?: string;
}

export interface CheckIn {
  id?: number;
  profileId: string;
  at: number;
  sessionIndex: number;
  feeling: string;
  breathTaken: boolean;
}

export interface Sticker {
  id?: number;
  profileId: string;
  at: number;
  pictureId: string;
  /** templateId or sceneId that earned it */
  source: string;
  shiny: boolean;
}

export interface Unlocks {
  profileId: string;
  dances: string[];
  accessories: string[];
  roomItems: string[];
  stories: string[];
  roomLayout: Record<string, { x: number; y: number }>;
}

export interface WritingSample {
  id?: number;
  profileId: string;
  at: number;
  glyph: string;
  mode: 'free' | 'faded' | 'guided';
  /**
   * One array per stroke, as drawn. x and y are fractions of the writing box (0–1 from its top left), so a sample draws
   * the same on another screen, after a restore too; p is the pointer's pressure (0–1); t is ms since the first point.
   */
  strokes: Array<Array<{ x: number; y: number; p: number; t: number }>>;
  scores: { shape: number; placement: number; size: number; strokes: number };
  outcome: 'great' | 'nearly' | 'watch';
}

export interface PaperResult {
  id?: number;
  profileId: string;
  at: number;
  paperId: string;
  seed: number;
  marks: Array<{ question: number; got: number; max: number }>;
}

export type GoalStatus = 'new' | 'mastered' | 'shaky' | 'needs-practice';
