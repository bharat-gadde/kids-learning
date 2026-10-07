// src/app/game/setRunner.ts
import type { ContentPack } from '../../engine/content/load';
import type { Template } from '../../engine/content/schema';
import { generateSet } from '../../engine/generator/round';
import { EMPTY_HISTORY, type Level, type Round } from '../../engine/generator/types';
import { recordAttempt, recordSetResult, setResultsForTemplate, type BuddyDB } from '../../engine/progress/db';
import { levelFor } from '../../engine/progress/difficulty';
import { attemptFromRound, buildGeneratorHistory, buildPickerHistory } from '../../engine/progress/history';
import { EMPTY_PICKER_HISTORY, pickTemplate, suggestTopic, type PickerHistory } from '../../engine/progress/picker';
import type { Outcome } from '../../engine/progress/types';
import type { Clock } from './clock';
import { within, type StorageHealth, type WriteQueue } from './storage';

/** One visit's player and record keeping: who plays, in which session, and where the record goes. */
export interface PlayContext {
  pack: ContentPack;
  db: BuddyDB;
  profileId: string;
  sessionIndex: number;
  sessionStartedAt: number;
  /** record times (`at`) */
  clock: Clock;
  /** the wall clock, for the session's length */
  now: () => number;
  writes: WriteQueue;
  storage: StorageHealth;
  random: () => number;
  /** a fresh random 32-bit seed per set */
  newSeed: () => number;
}

export interface PlaySet {
  template: Template;
  level: Level;
  seed: number;
  /** the rounds to play: the whole generated set, or its first five once the session has passed 10 minutes */
  rounds: readonly Round[];
  /** the form the child just missed, when the set bridges back to a familiar one (Buddy says so before the first prompt) */
  bridgeFrom: string | null;
}

export interface RoundResult {
  outcome: Outcome;
  hints: number;
  durationMs: number;
  wrongIds: readonly string[];
}

/** Spec §4.4: a set is 6 rounds by default, 5 once the session has passed 10 minutes — a prefix of the set, so it replays. */
export function roundsToPlay(generated: number, sessionMs: number): number {
  return sessionMs > 10 * 60_000 && generated > 5 ? 5 : generated;
}

/**
 * A failed read, or one with no answer within STORAGE_WAIT_MS, gives the empty history: the child plays on, with less
 * variation, and the failure is counted.
 */
async function readOr<T>(ctx: PlayContext, read: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await within(read());
  } catch (e) {
    ctx.storage.failures += 1;
    ctx.storage.lastError = e;
    console.error('storage read failed', e);
    return empty;
  }
}

async function pickerHistory(ctx: PlayContext): Promise<PickerHistory> {
  await ctx.writes.idle();
  return readOr(ctx, () => buildPickerHistory(ctx.db, ctx.profileId, ctx.sessionIndex), { ...EMPTY_PICKER_HISTORY, sessionIndex: ctx.sessionIndex });
}

/**
 * The next set for a topic (spec §5.4–5.5): the picker chooses the template (mechanic rotation, bridging), levelFor its
 * level from every set result, and the goal's attempts its history — read after every earlier write has landed.
 */
export async function prepareSet(ctx: PlayContext, topicId: string): Promise<PlaySet> {
  const { template, bridgeFrom } = pickTemplate(ctx.pack, topicId, await pickerHistory(ctx), ctx.random);
  const level = levelFor(await readOr(ctx, () => setResultsForTemplate(ctx.db, ctx.profileId, template.id), []));
  const history = await readOr(ctx, () => buildGeneratorHistory(ctx.db, ctx.profileId, template.goalId, ctx.sessionIndex), EMPTY_HISTORY);
  const seed = ctx.newSeed();
  const rounds = generateSet(ctx.pack, template, { seed, level, history });
  return { template, level, seed, bridgeFrom, rounds: rounds.slice(0, roundsToPlay(rounds.length, ctx.now() - ctx.sessionStartedAt)) };
}

/** Queue the attempt for a round the child just finished, under the session its set's history was built for. */
export function recordRound(ctx: PlayContext, round: Round, result: RoundResult): void {
  const attempt = attemptFromRound(round, { profileId: ctx.profileId, sessionIndex: ctx.sessionIndex, at: ctx.clock.now(), ...result });
  ctx.writes.add(() => recordAttempt(ctx.db, attempt));
}

/**
 * A finished set's result (spec §5.4 rule 7): only when its last round has ended — a set left early keeps its attempts
 * and stickers but has none. `correct` counts the rounds right before any hint.
 */
export function finishSet(ctx: PlayContext, set: PlaySet, results: readonly RoundResult[]): void {
  const result = {
    profileId: ctx.profileId, at: ctx.clock.now(), sessionIndex: ctx.sessionIndex, templateId: set.template.id, goalId: set.template.goalId,
    level: set.level, correct: results.filter((r) => r.outcome === 'correct').length, total: results.length,
  };
  ctx.writes.add(() => recordSetResult(ctx.db, result));
}

/** Buddy's suggested next spot (spec §5.4 rule 6), from a history that includes everything just played. */
export async function suggestNext(ctx: PlayContext): Promise<string> {
  return suggestTopic(ctx.pack, await pickerHistory(ctx), ctx.random);
}
