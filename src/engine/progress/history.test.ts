// src/engine/progress/history.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { readPack } from '../content/readPackFromDisk';
import { generateSet } from '../generator/round';
import { EMPTY_HISTORY, type Round } from '../generator/types';
import { hashString } from '../rng';
import { attemptsForGoal, attemptsForProfile, createDb, createProfile, recordAttempt, type BuddyDB } from './db';
import { attemptFromRound, buildGeneratorHistory, buildPickerHistory, generatorHistoryFrom, replayRound } from './history';
import type { Attempt, AttemptDetails } from './types';

const pack = readPack();
let db: BuddyDB;
let n = 0;
let profileId: string;
beforeEach(async () => {
  db = createDb(`hist-${++n}`);
  profileId = (await createProfile(db, { name: 'A', buddy: { colour: 'blue', name: 'Gaju', accessory: 'cap' } })).id;
});

describe('attemptFromRound', () => {
  it('copies identity, form, seed, level and the details the generator needs back', () => {
    const round = generateSet(pack, pack.templates.get('big-small.tap')!, { seed: 5, level: 2, history: EMPTY_HISTORY })[2]!;
    const a = attemptFromRound(round, { profileId, sessionIndex: 3, at: 123, outcome: 'correct', hints: 0, durationMs: 800 });
    expect(a).toMatchObject({ profileId, sessionIndex: 3, at: 123, templateId: 'big-small.tap', topicId: 'big-small', goalId: 'big-small.identify', mechanic: 'tap-the-one', form: 'tap-the-one:objects', seed: 5, level: 2, outcome: 'correct' });
    expect(a.details).toEqual({
      itemIds: round.itemIds, slot: round.correctSlot, sceneId: round.sceneId, lineId: round.prompt.lineId, lineVariant: round.prompt.variant,
      round: 2, payloadHash: hashString(JSON.stringify(round.payload)),
    });
  });
});

describe('attemptFromRound with wrong picks', () => {
  it('keeps what the child picked wrongly, and the round still replays', async () => {
    const round = generateSet(pack, pack.templates.get('letters.tap')!, { seed: 9, level: 2, history: EMPTY_HISTORY })[0]!;
    const p = round.payload;
    if (p.kind !== 'choose') throw new Error('expected choose');
    const wrong = p.options.find((o) => !p.correctIds.includes(o.id))!.id;
    const base = { profileId, sessionIndex: 1, at: 1, outcome: 'corrected' as const, hints: 1, durationMs: 900 };
    const a = attemptFromRound(round, { ...base, wrongIds: [wrong] });
    expect(a.details?.wrongIds).toEqual([wrong]);
    expect(attemptFromRound(round, { ...base, wrongIds: [] }).details).not.toHaveProperty('wrongIds');
    expect(attemptFromRound(round, base).details).not.toHaveProperty('wrongIds');
    await recordAttempt(db, a);
    const attempts = await attemptsForGoal(db, profileId, round.goalId);
    expect(replayRound(pack, attempts, attempts[0]!)).toEqual(round);
  });
});

describe('replayRound', () => {
  it('generates every recorded round again from its attempt and the attempts before its set (spec §5.4, §14)', async () => {
    const template = pack.templates.get('big-small.tap')!;
    const faces = pack.templates.get('feelings.tap')!; // another goal, played in between
    const played: Round[] = [];
    let at = 0;
    const record = async (rounds: Round[], session: number) => {
      for (const r of rounds) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: session, at: ++at, outcome: 'correct', hints: 0, durationMs: 1 }));
    };
    for (let session = 1; session <= 5; session++) {
      const rounds = generateSet(pack, template, { seed: 1000 + session, level: 2, history: await buildGeneratorHistory(db, profileId, template.goalId, session) });
      await record(rounds, session);
      played.push(...rounds);
      await record(generateSet(pack, faces, { seed: session, level: 1, history: await buildGeneratorHistory(db, profileId, faces.goalId, session) }), session);
    }
    const attempts = await attemptsForGoal(db, profileId, template.goalId);
    expect(attempts.map((a) => replayRound(pack, attempts, a))).toEqual(played);
    const everything = await attemptsForProfile(db, profileId); // a debug view may hand over every attempt
    expect(attempts.map((a) => replayRound(pack, everything, a))).toEqual(played);
  });

  it('rebuilds a set\'s history from every game of its goal: the big/small games share one', async () => {
    const tap = pack.templates.get('big-small.tap')!;
    const sort = pack.templates.get('big-small.sort')!;
    expect(sort.goalId).toBe(tap.goalId);
    const played: Round[] = [];
    let at = 0;
    for (let session = 1; session <= 3; session++) {
      for (const template of [tap, sort]) {
        const history = await buildGeneratorHistory(db, profileId, template.goalId, session);
        const rounds = generateSet(pack, template, { seed: 3000 + session * 10 + (template === tap ? 1 : 2), level: 1, history });
        for (const r of rounds) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: session, at: ++at, outcome: 'correct', hints: 0, durationMs: 1 }));
        played.push(...rounds);
      }
    }
    const attempts = await attemptsForGoal(db, profileId, tap.goalId);
    expect(attempts.map((a) => replayRound(pack, attempts, a))).toEqual(played);
  });

  it('gives no round, never a different one, once the pack has changed', async () => {
    const template = pack.templates.get('big-small.tap')!;
    const played: Round[] = [];
    let at = 0;
    for (let session = 1; session <= 3; session++) {
      const rounds = generateSet(pack, template, { seed: 2000 + session, level: 2, history: await buildGeneratorHistory(db, profileId, template.goalId, session) });
      for (const r of rounds) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: session, at: ++at, outcome: 'correct', hints: 0, durationMs: 1 }));
      played.push(...rounds);
    }
    const attempts = await attemptsForGoal(db, profileId, template.goalId);
    const line = pack.lines.get('prompt.tap_big')!;
    const updates = [ // a phrasing, an object and a scene added: each changes some recorded rounds and not others
      { ...pack, lines: new Map(pack.lines).set(line.id, { ...line, variants: [...line.variants, 'Show me the biggest {target}'] }) },
      { ...pack, objects: new Map(pack.objects).set('kettle', { id: 'kettle', name: 'kettle', lineId: 'obj.kettle', asset: 'objects/kettle.svg', category: 'thing', tags: { sizePair: true } }) },
      { ...pack, templates: new Map(pack.templates).set(template.id, { ...template, flavour: { ...template.flavour, scenes: [...template.flavour.scenes, 'kitchen'] } }) },
    ];
    for (const updated of updates) {
      const replays = attempts.map((a) => replayRound(updated, attempts, a));
      expect(replays).toContain(undefined);
      replays.forEach((r, i) => r && expect(r).toEqual(played[i]));
    }
    // one fewer option at the level played: target, slot, scene and wording can all still match, the options never do
    const [d1, d2, d3] = template.difficulty;
    const fewer = { ...pack, templates: new Map(pack.templates).set(template.id, { ...template, difficulty: [d1, { ...d2, options: d2.options - 1 }, d3] as typeof template.difficulty }) };
    expect(attempts.map((a) => replayRound(fewer, attempts, a)).filter(Boolean)).toEqual([]);
  });
});

describe('buildGeneratorHistory', () => {
  it('collects recent item ids (last 3 sessions), the last slot, scene and wording variants', async () => {
    const template = pack.templates.get('big-small.tap')!;
    const oldRounds = generateSet(pack, template, { seed: 1, level: 1, history: EMPTY_HISTORY });
    const newRounds = generateSet(pack, template, { seed: 2, level: 1, history: EMPTY_HISTORY });
    let at = 0;
    for (const r of oldRounds) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: 1, at: ++at, outcome: 'correct', hints: 0, durationMs: 1 }));
    for (const r of newRounds) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: 5, at: ++at, outcome: 'correct', hints: 0, durationMs: 1 }));

    const h = await buildGeneratorHistory(db, profileId, 'big-small.identify', 6);
    expect(h.recentItemIds).toEqual(newRounds.flatMap((r) => r.itemIds)); // session 1 is older than 3 sessions
    const last = newRounds[newRounds.length - 1]!;
    expect(h.lastSlot).toBe(last.correctSlot);
    expect(h.lastSceneId).toBe(last.sceneId);
    expect(h.lastVariantByLine['prompt.tap_big']).toBe(last.prompt.variant);
  });

  it('is empty for a goal never played', async () => {
    expect(await buildGeneratorHistory(db, profileId, 'nothing', 1)).toEqual(EMPTY_HISTORY);
  });
});

describe('generatorHistoryFrom', () => {
  const played = (sessionIndex: number, at: number, details: AttemptDetails): Attempt => ({
    profileId: 'p', at, sessionIndex, templateId: 'big-small.tap', topicId: 'big-small', goalId: 'big-small.identify',
    mechanic: 'tap-the-one', form: 'tap-the-one:objects', seed: 1, level: 1, outcome: 'correct', hints: 0, durationMs: 1, details,
  });

  it('remembers the items of this session and the 3 before it (spec §5.4 rule 1)', () => {
    const attempts = [1, 2, 3, 4, 5].map((s) => played(s, s, { itemIds: [`s${s}`] }));
    expect(generatorHistoryFrom(attempts, 5).recentItemIds).toEqual(['s2', 's3', 's4', 's5']);
  });

  it('takes the last slot, scene and each line\'s wording from the latest attempts by time, in whatever order they are given', () => {
    const first = played(1, 1, { slot: 0, sceneId: 'garden', lineId: 'prompt.a', lineVariant: 0 });
    const second = played(1, 2, { slot: 2, sceneId: 'farm', lineId: 'prompt.b', lineVariant: 1 });
    const third = played(1, 3, { slot: 1, sceneId: 'kitchen', lineId: 'prompt.a', lineVariant: 2 });
    const h = generatorHistoryFrom([third, first, second], 2);
    expect([h.lastSlot, h.lastSceneId]).toEqual([1, 'kitchen']);
    expect(h.lastVariantByLine).toEqual({ 'prompt.a': 2, 'prompt.b': 1 }); // each line's own latest, not only the latest attempt's line
  });
});

describe('buildPickerHistory', () => {
  it('aggregates last played session, last mechanic per topic, attempts per goal and the last topic', async () => {
    const tap = generateSet(pack, pack.templates.get('big-small.tap')!, { seed: 1, level: 1, history: EMPTY_HISTORY });
    const sort = generateSet(pack, pack.templates.get('big-small.sort')!, { seed: 1, level: 1, history: EMPTY_HISTORY });
    const faces = generateSet(pack, pack.templates.get('feelings.tap')!, { seed: 1, level: 1, history: EMPTY_HISTORY });
    let at = 0;
    for (const r of tap) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: 1, at: ++at, outcome: 'correct', hints: 0, durationMs: 1 }));
    for (const r of faces) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: 2, at: ++at, outcome: 'shown', hints: 1, durationMs: 1 }));
    for (const r of sort) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: 2, at: ++at, outcome: 'correct', hints: 0, durationMs: 1 }));

    const h = await buildPickerHistory(db, profileId, 3);
    expect(h.sessionIndex).toBe(3);
    expect(h.lastPlayedSession).toEqual({ 'big-small.tap': 1, 'feelings.tap': 2, 'big-small.sort': 2 });
    expect(h.lastMechanicByTopic).toEqual({ 'big-small': 'sort-into-bins', feelings: 'tap-the-one' });
    expect(Object.keys(h.attemptsByGoal).sort()).toEqual(['big-small.identify', 'feelings.name']); // both big/small games share a goal
    expect(h.attemptsByGoal['big-small.identify']).toHaveLength(tap.length + sort.length);
    expect(h.lastTopicId).toBe('big-small');
  });

  it('takes the last topic from the latest attempt by time, not the first stored', async () => {
    const faces = generateSet(pack, pack.templates.get('feelings.tap')!, { seed: 1, level: 1, history: EMPTY_HISTORY });
    const tap = generateSet(pack, pack.templates.get('big-small.tap')!, { seed: 1, level: 1, history: EMPTY_HISTORY });
    await recordAttempt(db, attemptFromRound(faces[0]!, { profileId, sessionIndex: 1, at: 20, outcome: 'correct', hints: 0, durationMs: 1 }));
    await recordAttempt(db, attemptFromRound(tap[0]!, { profileId, sessionIndex: 1, at: 10, outcome: 'correct', hints: 0, durationMs: 1 }));
    expect((await buildPickerHistory(db, profileId, 2)).lastTopicId).toBe('feelings');
  });
});
