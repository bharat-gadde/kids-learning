// src/engine/progress/db.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createDb, createProfile, listProfiles, startSession, recordAttempt, recordSetResult,
  attemptsForGoal, attemptsForProfile, setResultsForTemplate, getSettings, saveSettings, type BuddyDB,
} from './db';
import { defaultSettings, type Attempt, type Settings } from './types';

let db: BuddyDB;
let n = 0;
beforeEach(() => {
  db = createDb(`test-${++n}`);
});

const buddy = { colour: 'blue', name: 'Gaju', accessory: 'cap' };
const attempt = (profileId: string, at: number, more: Partial<Attempt> = {}): Omit<Attempt, 'id'> => ({
  profileId, at, sessionIndex: 1, templateId: 'big-small.tap', topicId: 'big-small', goalId: 'big-small.identify', mechanic: 'tap-the-one',
  form: 'tap-the-one:objects', seed: 1, level: 1, outcome: 'correct', hints: 0, durationMs: 900, ...more,
});

describe('profiles and sessions', () => {
  it('creates a profile with default settings and starter unlocks', async () => {
    const p = await createProfile(db, { name: 'Anika', buddy });
    expect(p.level).toBe('lkg');
    expect(await listProfiles(db)).toEqual([p]);
    expect(await db.settings.get(p.id)).toEqual(defaultSettings(p.id)); // a stored row, not getSettings' fallback
    expect((await db.unlocks.get(p.id))?.dances).toEqual(['trunk-twirl', 'elephant-stomp']);
  });

  it('lists profiles oldest first', async () => {
    // ids sort the other way, so only createdAt can give this order (portraits keep their places on the Hello screen)
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('ffffffff-0000-4000-8000-000000000000').mockReturnValueOnce('00000000-0000-4000-8000-000000000000');
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const first = await createProfile(db, { name: 'A', buddy });
    now.mockReturnValue(2000);
    const second = await createProfile(db, { name: 'B', buddy });
    vi.restoreAllMocks();
    expect((await listProfiles(db)).map((p) => p.id)).toEqual([first.id, second.id]);
  });

  it('creates nothing when one of its writes fails', async () => {
    vi.spyOn(db.unlocks, 'put').mockRejectedValueOnce(new Error('disk full'));
    await expect(createProfile(db, { name: 'A', buddy })).rejects.toThrow('disk full');
    expect([await db.profiles.count(), await db.settings.count(), await db.unlocks.count()]).toEqual([0, 0, 0]);
  });

  it('numbers sessions per profile from 1', async () => {
    const a = await createProfile(db, { name: 'A', buddy });
    const b = await createProfile(db, { name: 'B', buddy });
    expect((await startSession(db, a.id)).index).toBe(1);
    expect((await startSession(db, a.id)).index).toBe(2);
    expect((await startSession(db, b.id)).index).toBe(1);
  });

  it('numbers sessions started together one after another', async () => {
    const a = await createProfile(db, { name: 'A', buddy });
    const started = await Promise.all([1, 2, 3].map(() => startSession(db, a.id))); // a double tap, an effect run twice
    expect(started.map((s) => s.index)).toEqual([1, 2, 3]);
    await expect(db.sessions.add({ profileId: a.id, index: 2, startedAt: 0 })).rejects.toMatchObject({ name: 'ConstraintError' }); // one session per number
  });
});

describe('attempts and set results', () => {
  it('stores and reads back attempts for a goal in time order', async () => {
    const p = await createProfile(db, { name: 'A', buddy });
    const base = { profileId: p.id, sessionIndex: 1, templateId: 'big-small.tap', topicId: 'big-small', goalId: 'big-small.identify', mechanic: 'tap-the-one' as const, form: 'tap-the-one:objects', seed: 1, level: 1 as const, hints: 0, durationMs: 900 };
    await recordAttempt(db, { ...base, at: 20, outcome: 'shown' });
    await recordAttempt(db, { ...base, at: 10, outcome: 'correct' });
    await recordAttempt(db, { ...base, at: 30, goalId: 'other', outcome: 'correct' });
    const got = await attemptsForGoal(db, p.id, 'big-small.identify');
    expect(got.map((a) => a.at)).toEqual([10, 20]);
  });

  it("reads back a profile's attempts in time order, and no other profile's", async () => {
    const a = await createProfile(db, { name: 'A', buddy });
    const b = await createProfile(db, { name: 'B', buddy });
    // stored out of time order (a restore, a write retried later): buildPickerHistory reads the last row as the latest
    await recordAttempt(db, attempt(a.id, 30, { topicId: 'feelings', goalId: 'feelings.name' }));
    await recordAttempt(db, attempt(b.id, 20));
    await recordAttempt(db, attempt(a.id, 10));
    expect((await attemptsForProfile(db, a.id)).map((x) => x.at)).toEqual([10, 30]);
    expect((await attemptsForGoal(db, b.id, 'big-small.identify')).map((x) => x.at)).toEqual([20]);
  });

  it('stores set results per template', async () => {
    const p = await createProfile(db, { name: 'A', buddy });
    await recordSetResult(db, { profileId: p.id, at: 1, sessionIndex: 1, templateId: 'x', goalId: 'g', level: 1, correct: 5, total: 6 });
    await recordSetResult(db, { profileId: p.id, at: 2, sessionIndex: 1, templateId: 'y', goalId: 'g', level: 1, correct: 2, total: 6 });
    expect((await setResultsForTemplate(db, p.id, 'x')).map((r) => r.correct)).toEqual([5]);
  });

  it("reads back a template's set results in time order, and no other profile's", async () => {
    const a = await createProfile(db, { name: 'A', buddy });
    const b = await createProfile(db, { name: 'B', buddy });
    const result = { sessionIndex: 1, templateId: 'x', goalId: 'g', level: 1 as const, total: 6 };
    await recordSetResult(db, { ...result, profileId: a.id, at: 2, correct: 2 });
    await recordSetResult(db, { ...result, profileId: b.id, at: 3, correct: 6 });
    await recordSetResult(db, { ...result, profileId: a.id, at: 1, correct: 1 });
    expect((await setResultsForTemplate(db, a.id, 'x')).map((r) => r.correct)).toEqual([1, 2]);
  });
});

describe('settings', () => {
  it('returns defaults for an unknown profile and persists changes', async () => {
    expect((await getSettings(db, 'ghost')).theme).toBe('storybook');
    const p = await createProfile(db, { name: 'A', buddy });
    await saveSettings(db, { ...(await getSettings(db, p.id)), timerMinutes: 20, theme: 'soft-flat' });
    const s = await getSettings(db, p.id);
    expect(s.timerMinutes).toBe(20);
    expect(s.theme).toBe('soft-flat');
  });

  it('gives a setting added after a row was saved its default', async () => {
    const p = await createProfile(db, { name: 'A', buddy });
    const { reducedMotion: _, ...older } = { ...defaultSettings(p.id), timerMinutes: 30 as const }; // saved before reducedMotion existed
    await db.settings.put(older as Settings);
    expect(await getSettings(db, p.id)).toEqual({ ...defaultSettings(p.id), timerMinutes: 30 });
  });
});
