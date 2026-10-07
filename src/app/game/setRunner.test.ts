// src/app/game/setRunner.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readPack } from '../../engine/content/readPackFromDisk';
import { generateSet } from '../../engine/generator/round';
import { attemptsForGoal, createDb, createProfile, startSession, type BuddyDB } from '../../engine/progress/db';
import { replayRound } from '../../engine/progress/history';
import { monotonicClock } from './clock';
import { finishSet, prepareSet, recordRound, roundsToPlay, suggestNext, type PlayContext, type RoundResult } from './setRunner';
import { newSticker, pageOf, stickerPicture } from './stickers';
import { createStorageHealth, STORAGE_WAIT_MS, WriteQueue } from './storage';

const pack = readPack();
let db: BuddyDB;
let n = 0;
let ctx: PlayContext;

beforeEach(async () => {
  db = createDb(`runner-${++n}`);
  const profile = await createProfile(db, { name: 'Asha', buddy: { colour: 'blue', name: 'Gajju', accessory: 'cap' } });
  const session = await startSession(db, profile.id);
  const storage = createStorageHealth();
  let seed = 100;
  ctx = {
    pack, db, profileId: profile.id, sessionIndex: session.index, sessionStartedAt: 0, clock: monotonicClock(0), now: () => 60_000,
    writes: new WriteQueue(storage), storage, random: () => 0.5, newSeed: () => ++seed,
  };
});

const right: RoundResult = { outcome: 'correct', hints: 0, durationMs: 1000, wrongIds: [] };

describe('roundsToPlay', () => {
  it('plays the whole set, and five rounds once the session has passed 10 minutes', () => {
    expect(roundsToPlay(6, 9 * 60_000)).toBe(6);
    expect(roundsToPlay(6, 10 * 60_000 + 1)).toBe(5);
    expect(roundsToPlay(4, 30 * 60_000)).toBe(4);
  });
});

describe('a set, start to finish', () => {
  it('generates from the picked template at its level, and records rounds that replay', async () => {
    const set = await prepareSet(ctx, 'big-small');
    expect(set.template.topicId).toBe('big-small');
    expect(set.level).toBe(1);
    expect(set.rounds).toEqual(generateSet(pack, set.template, { seed: set.seed, level: 1, history: { recentItemIds: [], lastSlot: null, lastSceneId: null, lastVariantByLine: {} } }));
    for (const round of set.rounds) recordRound(ctx, round, { ...right, wrongIds: ['x'] });
    finishSet(ctx, set, set.rounds.map(() => right));
    await ctx.writes.idle();
    const attempts = await attemptsForGoal(db, ctx.profileId, set.template.goalId);
    expect(attempts.map((a) => replayRound(pack, attempts, a))).toEqual([...set.rounds]);
    expect(attempts[0]!.details?.wrongIds).toEqual(['x']);
  });

  it('rotates the game when the topic is played again, and raises each game\'s level after two good sets of it', async () => {
    const played: string[] = [];
    for (let i = 0; i < 6; i++) {
      const set = await prepareSet(ctx, 'big-small');
      played.push(`${set.template.id}@${set.level}`);
      for (const round of set.rounds) recordRound(ctx, round, right);
      finishSet(ctx, set, set.rounds.map(() => right));
    }
    expect(played).toEqual(['big-small.tap@1', 'big-small.sort@1', 'big-small.tap@1', 'big-small.sort@1', 'big-small.tap@2', 'big-small.sort@2']);
  });

  it('cuts a set to five rounds after 10 minutes, and the shorter set still replays', async () => {
    ctx.now = () => 11 * 60_000;
    const set = await prepareSet(ctx, 'letters');
    expect(set.rounds).toHaveLength(5);
    for (const round of set.rounds) recordRound(ctx, round, right);
    await ctx.writes.idle();
    const attempts = await attemptsForGoal(db, ctx.profileId, set.template.goalId);
    expect(attempts.map((a) => replayRound(pack, attempts, a))).toEqual([...set.rounds]);
  });

  it('suggests a topic on another island than the one just played', async () => {
    const set = await prepareSet(ctx, 'letters');
    recordRound(ctx, set.rounds[0]!, right);
    const next = await suggestNext(ctx);
    expect(pack.topics.get(next)!.subject).not.toBe('literacy');
  });

  it('plays on from empty histories when storage cannot be read', async () => {
    ctx.db = { ...db, attempts: undefined } as unknown as BuddyDB;
    const errors = console.error;
    console.error = () => {};
    try {
      const set = await prepareSet(ctx, 'feelings');
      expect(set.rounds.length).toBeGreaterThan(0);
      expect(ctx.storage.failures).toBeGreaterThan(0);
    } finally {
      console.error = errors;
    }
  });
});

describe('a stalled storage', () => {
  it('never holds the next set up for good: a write or read with no answer is given up after STORAGE_WAIT_MS', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const stalled = { where: () => ({ equals: () => ({ toArray: () => new Promise(() => {}) }) }) };
      ctx.writes.add(() => new Promise(() => {}));
      ctx.db = { ...db, attempts: stalled, setResults: stalled } as unknown as BuddyDB;
      let set: Awaited<ReturnType<typeof prepareSet>> | undefined;
      void prepareSet(ctx, 'feelings').then((s) => { set = s; });
      await vi.advanceTimersByTimeAsync(4 * STORAGE_WAIT_MS); // the write, then the picker's, the levels' and the goal's reads
      expect(set?.rounds.length).toBeGreaterThan(0);
      expect(ctx.storage.failures).toBe(4);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });
});

describe('stickers', () => {
  it('take a picture from the set\'s answers', () => {
    const rounds = generateSet(pack, pack.templates.get('healthy-food.plate')!, { seed: 4, level: 1, history: { recentItemIds: [], lastSlot: null, lastSceneId: null, lastVariantByLine: {} } });
    const healthy = new Set([...pack.objects.values()].filter((o) => o.tags.healthy).map((o) => o.asset));
    for (const r of [0, 0.3, 0.99]) expect(healthy.has(stickerPicture(rounds, () => r))).toBe(true);
    const letters = generateSet(pack, pack.templates.get('letters.tap')!, { seed: 4, level: 1, history: { recentItemIds: [], lastSlot: null, lastSceneId: null, lastVariantByLine: {} } });
    expect(stickerPicture(letters, () => 0)).toMatch(/^glyph:/);
  });

  it('are shiny about one time in fifteen, and go on their island\'s page', () => {
    const rounds = generateSet(pack, pack.templates.get('feelings.tap')!, { seed: 4, level: 1, history: { recentItemIds: [], lastSlot: null, lastSceneId: null, lastVariantByLine: {} } });
    expect(newSticker('p', 1, 'feelings.tap', rounds, () => 0.05).shiny).toBe(true);
    expect(newSticker('p', 1, 'feelings.tap', rounds, () => 0.07).shiny).toBe(false);
    expect(pageOf(pack, { source: 'feelings.tap' })).toBe('wellness');
    expect(pageOf(pack, { source: 'brush-teeth' })).toBe('home');
  });
});
