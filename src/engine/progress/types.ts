// src/engine/progress/types.ts
import type { LevelId, MechanicId } from '../content/schema';
import type { Level } from '../generator/types';

export type Outcome = 'correct' | 'corrected' | 'shown';

/** What a mechanic records about the round it just ran; the history builders read these back. */
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
  [key: string]: unknown;
}

export interface Attempt {
  id?: number;
  profileId: string;
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
  level: Level;
  outcome: Outcome;
  hints: number;
  durationMs: number;
  details?: AttemptDetails;
}

export interface SetResult {
  id?: number;
  profileId: string;
  at: number;
  sessionIndex: number;
  templateId: string;
  goalId: string;
  level: Level;
  correct: number;
  total: number;
}

export interface Profile {
  id: string;
  name: string;
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
