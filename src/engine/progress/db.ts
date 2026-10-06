// src/engine/progress/db.ts
import Dexie, { type EntityTable, type Table } from 'dexie';
import {
  defaultSettings,
  type Attempt, type CheckIn, type PaperResult, type Profile, type RoutineEvent, type Session, type SetResult,
  type Settings, type Sticker, type Unlocks, type WritingSample,
} from './types';

export class BuddyDB extends Dexie {
  // Table, not EntityTable, where the app supplies the key: EntityTable makes the key optional on insert (it is for ++id)
  profiles!: Table<Profile, string>;
  sessions!: EntityTable<Session, 'id'>;
  attempts!: EntityTable<Attempt, 'id'>;
  setResults!: EntityTable<SetResult, 'id'>;
  routineEvents!: EntityTable<RoutineEvent, 'id'>;
  checkIns!: EntityTable<CheckIn, 'id'>;
  stickers!: EntityTable<Sticker, 'id'>;
  unlocks!: Table<Unlocks, string>;
  writingSamples!: EntityTable<WritingSample, 'id'>;
  paperResults!: EntityTable<PaperResult, 'id'>;
  settings!: Table<Settings, string>;

  constructor(name = 'buddy') {
    super(name);
    this.version(1).stores({
      profiles: 'id, createdAt',
      sessions: '++id, profileId, &[profileId+index]', // unique: one session per profile and number
      attempts: '++id, profileId, at, [profileId+goalId], [profileId+templateId], [profileId+sessionIndex]',
      setResults: '++id, profileId, at, [profileId+templateId]',
      routineEvents: '++id, profileId, at',
      checkIns: '++id, profileId, at',
      stickers: '++id, profileId, at',
      unlocks: 'profileId',
      writingSamples: '++id, profileId, at, [profileId+glyph]',
      paperResults: '++id, profileId, at',
      settings: 'profileId',
    });
  }
}

export function createDb(name?: string): BuddyDB {
  return new BuddyDB(name);
}

/** Spec §4.7: the two dances a new Buddy knows. */
export const STARTER_DANCES: readonly string[] = Object.freeze(['trunk-twirl', 'elephant-stomp']);

export async function createProfile(
  db: BuddyDB,
  input: { name: string; buddy: Profile['buddy']; level?: Profile['level'] },
): Promise<Profile> {
  const profile: Profile = { id: crypto.randomUUID(), name: input.name, level: input.level ?? 'lkg', buddy: input.buddy, createdAt: Date.now() };
  await db.transaction('rw', [db.profiles, db.settings, db.unlocks], async () => {
    await db.profiles.add(profile);
    await db.settings.put(defaultSettings(profile.id));
    await db.unlocks.put({ profileId: profile.id, dances: [...STARTER_DANCES], accessories: [], roomItems: [], stories: [], roomLayout: {} });
  });
  return profile;
}

export async function listProfiles(db: BuddyDB): Promise<Profile[]> {
  return db.profiles.orderBy('createdAt').toArray();
}

/**
 * The profile's next session: 1, 2, 3… Reads the last number and adds the next in one transaction, so calls made
 * together (a double tap, an effect run twice) queue instead of both taking the same number.
 */
export async function startSession(db: BuddyDB, profileId: string): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const last = await db.sessions.where('[profileId+index]').between([profileId, Dexie.minKey], [profileId, Dexie.maxKey]).last();
    const session: Session = { profileId, index: (last?.index ?? 0) + 1, startedAt: Date.now() };
    session.id = await db.sessions.add(session);
    return session;
  });
}

/** Resolves to the auto-incremented id (Dexie types it as possibly undefined because `id` is optional). */
export async function recordAttempt(db: BuddyDB, attempt: Omit<Attempt, 'id'>): Promise<number | undefined> {
  return db.attempts.add(attempt);
}

export async function recordSetResult(db: BuddyDB, result: Omit<SetResult, 'id'>): Promise<number | undefined> {
  return db.setResults.add(result);
}

/** One goal's attempts by this profile, oldest first (by `at`). */
export async function attemptsForGoal(db: BuddyDB, profileId: string, goalId: string): Promise<Attempt[]> {
  const rows = await db.attempts.where('[profileId+goalId]').equals([profileId, goalId]).toArray();
  return rows.sort((a, b) => a.at - b.at);
}

/** Every attempt by this profile, oldest first (by `at`): buildPickerHistory reads the last one as the latest. */
export async function attemptsForProfile(db: BuddyDB, profileId: string): Promise<Attempt[]> {
  const rows = await db.attempts.where('profileId').equals(profileId).toArray();
  return rows.sort((a, b) => a.at - b.at);
}

/** One template's set results for this profile, oldest first (by `at`). */
export async function setResultsForTemplate(db: BuddyDB, profileId: string, templateId: string): Promise<SetResult[]> {
  const rows = await db.setResults.where('[profileId+templateId]').equals([profileId, templateId]).toArray();
  return rows.sort((a, b) => a.at - b.at);
}

/** Spec §4.6: a sticker earned; nothing ever removes one. */
export async function addSticker(db: BuddyDB, sticker: Omit<Sticker, 'id'>): Promise<number | undefined> {
  return db.stickers.add(sticker);
}

/** Every sticker this profile has earned, oldest first (by `at`): the order they went into the book. */
export async function stickersForProfile(db: BuddyDB, profileId: string): Promise<Sticker[]> {
  const rows = await db.stickers.where('profileId').equals(profileId).toArray();
  return rows.sort((a, b) => a.at - b.at);
}

/** The latest `at` recorded for this profile (attempts and set results), or 0: a new session's clock starts after it. */
export async function lastRecordedAt(db: BuddyDB, profileId: string): Promise<number> {
  const mine = (row: { profileId: string }) => row.profileId === profileId;
  const [attempt, set] = await Promise.all([
    db.attempts.orderBy('at').reverse().filter(mine).first(),
    db.setResults.orderBy('at').reverse().filter(mine).first(),
  ]);
  return Math.max(attempt?.at ?? 0, set?.at ?? 0);
}

export async function getSettings(db: BuddyDB, profileId: string): Promise<Settings> {
  // a field added to Settings later has its default for profiles saved before it
  return { ...defaultSettings(profileId), ...(await db.settings.get(profileId)) };
}

export async function saveSettings(db: BuddyDB, settings: Settings): Promise<void> {
  await db.settings.put(settings);
}
