// src/engine/progress/db.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDb, createProfile, listProfiles, startSession, recordAttempt, recordSetResult,
  attemptsForGoal, setResultsForTemplate, getSettings, saveSettings, type BuddyDB,
} from './db';

let db: BuddyDB;
let n = 0;
beforeEach(() => {
  db = createDb(`test-${++n}`);
});

const buddy = { colour: 'blue', name: 'Gaju', accessory: 'cap' };

describe('profiles and sessions', () => {
  it('creates a profile with default settings and starter unlocks', async () => {
    const p = await createProfile(db, { name: 'Anika', buddy });
    expect((await listProfiles(db)).map((x) => x.id)).toEqual([p.id]);
    expect((await getSettings(db, p.id)).timerMinutes).toBe(15);
    expect((await db.unlocks.get(p.id))?.dances).toEqual(['trunk-twirl', 'elephant-stomp']);
  });

  it('numbers sessions per profile from 1', async () => {
    const a = await createProfile(db, { name: 'A', buddy });
    const b = await createProfile(db, { name: 'B', buddy });
    expect((await startSession(db, a.id)).index).toBe(1);
    expect((await startSession(db, a.id)).index).toBe(2);
    expect((await startSession(db, b.id)).index).toBe(1);
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

  it('stores set results per template', async () => {
    const p = await createProfile(db, { name: 'A', buddy });
    await recordSetResult(db, { profileId: p.id, at: 1, sessionIndex: 1, templateId: 'x', goalId: 'g', level: 1, correct: 5, total: 6 });
    await recordSetResult(db, { profileId: p.id, at: 2, sessionIndex: 1, templateId: 'y', goalId: 'g', level: 1, correct: 2, total: 6 });
    expect((await setResultsForTemplate(db, p.id, 'x')).map((r) => r.correct)).toEqual([5]);
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
});
