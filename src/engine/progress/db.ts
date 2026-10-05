// src/engine/progress/db.ts
import Dexie, { type EntityTable } from 'dexie';
import {
  defaultSettings,
  type Attempt, type CheckIn, type PaperResult, type Profile, type RoutineEvent, type Session, type SetResult,
  type Settings, type Sticker, type Unlocks, type WritingSample,
} from './types';

export class BuddyDB extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  attempts!: EntityTable<Attempt, 'id'>;
  setResults!: EntityTable<SetResult, 'id'>;
  routineEvents!: EntityTable<RoutineEvent, 'id'>;
  checkIns!: EntityTable<CheckIn, 'id'>;
  stickers!: EntityTable<Sticker, 'id'>;
  unlocks!: EntityTable<Unlocks, 'profileId'>;
  writingSamples!: EntityTable<WritingSample, 'id'>;
  paperResults!: EntityTable<PaperResult, 'id'>;
  settings!: EntityTable<Settings, 'profileId'>;

  constructor(name = 'buddy') {
    super(name);
    this.version(1).stores({
      profiles: 'id, createdAt',
      sessions: '++id, profileId, [profileId+index]',
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

export const STARTER_DANCES = ['trunk-twirl', 'elephant-stomp'];

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

export async function startSession(db: BuddyDB, profileId: string): Promise<Session> {
  const last = await db.sessions.where('[profileId+index]').between([profileId, Dexie.minKey], [profileId, Dexie.maxKey]).last();
  const session: Session = { profileId, index: (last?.index ?? 0) + 1, startedAt: Date.now() };
  session.id = await db.sessions.add(session);
  return session;
}

/** Resolves to the auto-incremented id (Dexie types it as possibly undefined because `id` is optional). */
export async function recordAttempt(db: BuddyDB, attempt: Omit<Attempt, 'id'>): Promise<number | undefined> {
  return db.attempts.add(attempt as Attempt);
}

export async function recordSetResult(db: BuddyDB, result: Omit<SetResult, 'id'>): Promise<number | undefined> {
  return db.setResults.add(result as SetResult);
}

export async function attemptsForGoal(db: BuddyDB, profileId: string, goalId: string): Promise<Attempt[]> {
  const rows = await db.attempts.where('[profileId+goalId]').equals([profileId, goalId]).toArray();
  return rows.sort((a, b) => a.at - b.at);
}

export async function attemptsForProfile(db: BuddyDB, profileId: string): Promise<Attempt[]> {
  const rows = await db.attempts.where('profileId').equals(profileId).toArray();
  return rows.sort((a, b) => a.at - b.at);
}

export async function setResultsForTemplate(db: BuddyDB, profileId: string, templateId: string): Promise<SetResult[]> {
  const rows = await db.setResults.where('[profileId+templateId]').equals([profileId, templateId]).toArray();
  return rows.sort((a, b) => a.at - b.at);
}

export async function getSettings(db: BuddyDB, profileId: string): Promise<Settings> {
  // a field added to Settings later has its default for profiles saved before it
  return { ...defaultSettings(profileId), ...(await db.settings.get(profileId)) };
}

export async function saveSettings(db: BuddyDB, settings: Settings): Promise<void> {
  await db.settings.put(settings);
}
