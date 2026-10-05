// src/engine/progress/history.ts
import type { ContentPack } from '../content/load';
import type { MechanicId } from '../content/schema';
import { generateSet } from '../generator/round';
import type { GeneratorHistory, Round } from '../generator/types';
import { hashString } from '../rng';
import { attemptsForGoal, attemptsForProfile, type BuddyDB } from './db';
import type { PickerHistory } from './picker';
import type { Attempt, AttemptDetails, Outcome } from './types';

/** What a round records about itself in its attempt (a mechanic that records more adds a named field to AttemptDetails). */
function roundDetails(round: Round): AttemptDetails {
  return {
    itemIds: [...round.itemIds], // the attempt's own array: the round's is frozen
    slot: round.correctSlot,
    sceneId: round.sceneId,
    lineId: round.prompt.lineId,
    lineVariant: round.prompt.variant,
    round: round.index,
    payloadHash: hashString(JSON.stringify(round.payload)), // the options and their places, which the rest leaves out
  };
}

/** Build the attempt record for a round the child just finished. */
export function attemptFromRound(
  round: Round,
  result: { profileId: string; sessionIndex: number; at: number; outcome: Outcome; hints: number; durationMs: number },
): Omit<Attempt, 'id'> {
  return {
    profileId: result.profileId,
    at: result.at,
    sessionIndex: result.sessionIndex,
    templateId: round.templateId,
    topicId: round.topicId,
    goalId: round.goalId,
    mechanic: round.mechanic,
    form: round.form,
    seed: round.seed,
    level: round.level,
    outcome: result.outcome,
    hints: result.hints,
    durationMs: result.durationMs,
    details: roundDetails(round),
  };
}

/**
 * What the generator needs to vary the next set for a goal, from that goal's attempts.
 * Pure, so a replay can rebuild the history a set was generated with from the attempts before it.
 */
export function generatorHistoryFrom(goalAttempts: readonly Attempt[], sessionIndex: number): GeneratorHistory {
  const attempts = [...goalAttempts].sort((a, b) => a.at - b.at);
  const recent = attempts.filter((a) => a.sessionIndex >= sessionIndex - 3);
  const last = attempts[attempts.length - 1];
  const lastVariantByLine: Record<string, number> = {};
  for (const a of attempts.slice(-20)) {
    if (a.details?.lineId && a.details.lineVariant !== undefined) lastVariantByLine[a.details.lineId] = a.details.lineVariant;
  }
  return {
    recentItemIds: recent.flatMap((a) => a.details?.itemIds ?? []),
    lastSlot: last?.details?.slot ?? null,
    lastSceneId: last?.details?.sceneId ?? null,
    lastVariantByLine,
  };
}

/** What the generator needs to vary the next set for this goal. */
export async function buildGeneratorHistory(db: BuddyDB, profileId: string, goalId: string, sessionIndex: number): Promise<GeneratorHistory> {
  return generatorHistoryFrom(await attemptsForGoal(db, profileId, goalId), sessionIndex);
}

/**
 * Spec §5.4 / §14: the round an attempt recorded, generated again — from its set's seed and level, and the history
 * rebuilt from the goal's attempts before that set's first one. Undefined unless it matches what the attempt recorded:
 * after a content update, or for a set not played as generateSet made it, there is no round rather than a different one.
 */
export function replayRound(pack: ContentPack, goalAttempts: readonly Attempt[], attempt: Attempt): Round | undefined {
  const template = pack.templates.get(attempt.templateId);
  const recorded = attempt.details;
  if (!template || recorded?.round === undefined) return undefined;
  const sameSet = goalAttempts.filter((a) => a.templateId === attempt.templateId && a.seed === attempt.seed && a.sessionIndex === attempt.sessionIndex);
  const start = Math.min(attempt.at, ...sameSet.map((a) => a.at));
  const history = generatorHistoryFrom(goalAttempts.filter((a) => a.goalId === attempt.goalId && a.at < start), attempt.sessionIndex);
  const round = generateSet(pack, template, { seed: attempt.seed, level: attempt.level, history })[recorded.round];
  const same = round !== undefined && Object.entries(roundDetails(round)).every(([key, value]) => JSON.stringify(value) === JSON.stringify(recorded[key as keyof AttemptDetails]));
  return same ? round : undefined;
}

/** What the picker needs to choose the next template and suggest a topic. */
export async function buildPickerHistory(db: BuddyDB, profileId: string, sessionIndex: number): Promise<PickerHistory> {
  const attempts = await attemptsForProfile(db, profileId);
  const lastPlayedSession: Record<string, number> = {};
  const lastMechanicByTopic: Record<string, MechanicId> = {};
  const attemptsByGoal: Record<string, Attempt[]> = {};
  for (const a of attempts) {
    lastPlayedSession[a.templateId] = Math.max(lastPlayedSession[a.templateId] ?? 0, a.sessionIndex);
    lastMechanicByTopic[a.topicId] = a.mechanic;
    (attemptsByGoal[a.goalId] ??= []).push(a);
  }
  return {
    sessionIndex,
    lastPlayedSession,
    lastMechanicByTopic,
    attemptsByGoal,
    lastTopicId: attempts[attempts.length - 1]?.topicId ?? null,
  };
}
