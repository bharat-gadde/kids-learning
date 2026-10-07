// src/app/App.tsx
import { useEffect, useRef, useState } from 'react';
import { createProfile, lastRecordedAt, listProfiles, STARTER_DANCES, startSession, stickersForProfile } from '../engine/progress/db';
import type { Profile, Session, Sticker } from '../engine/progress/types';
import { blockFor, greetingLineFor } from '../engine/time';
import type { Names } from './audio/speaker';
import type { BuddyExpression, BuddyMove } from './buddy/Buddy';
import { monotonicClock } from './game/clock';
import { within } from './game/storage';
import type { PlayContext } from './game/setRunner';
import type { BuddyLook } from './mechanics/types';
import { GameScreen } from './screens/GameScreen';
import { Hello, lookOf } from './screens/Hello';
import { MapScreen } from './screens/MapScreen';
import { Setup, type NewChild } from './screens/Setup';
import { StickerBook } from './screens/StickerBook';
import type { Services } from './services';

type Screen =
  | { name: 'boot' }
  | { name: 'setup' }
  | { name: 'hello' }
  | { name: 'map' }
  | { name: 'game'; topicId: string; yourTurn: boolean }
  | { name: 'stickers' };

/** One child's visit: who plays, and the record-keeping context for their sets. */
interface Visit {
  profile: Profile;
  look: BuddyLook;
  names: Names;
  dances: readonly string[];
  play: PlayContext;
}

/** How long Buddy's greeting has before the Map opens. */
export const GREETING_MS = 2800;

/** Spec §4.5: "your turn" every 2nd–3rd set, at random; `sets` counts the sets since the last one, this one included. */
export function yourTurnDue(sets: number, random: () => number): boolean {
  return sets >= 3 || (sets === 2 && random() < 0.5);
}

/** The app (spec §4.1, Plan 1B's part): Setup on first run, Hello, the Map, a set, the sticker book. */
export function App({ services }: { services: Services }) {
  const [screen, setScreen] = useState<Screen>({ name: 'boot' });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [greeting, setGreeting] = useState<{ profileId: string; move: BuddyMove; expression: BuddyExpression } | null>(null);
  const [stickers, setStickers] = useState<readonly Sticker[]>([]);
  const setsSinceYourTurn = useRef(0);

  useEffect(() => {
    listProfiles(services.db).then(
      (ps) => {
        setProfiles(ps);
        setScreen(ps.length > 0 ? { name: 'hello' } : { name: 'setup' });
      },
      (e: unknown) => {
        console.error('could not read profiles', e);
        setScreen({ name: 'setup' });
      },
    );
  }, [services]);

  const addChild = async (child: NewChild) => {
    const profile = await createProfile(services.db, child);
    // spec §10: ask the browser to keep this data (installed apps are exempt from clean-up anyway)
    void navigator.storage?.persist?.().catch(() => false);
    setProfiles((ps) => [...ps, profile]);
    setScreen({ name: 'hello' });
  };

  /** The visit's session and clock; on a storage failure the child still plays, the record kept in memory. */
  const openVisit = async (profile: Profile): Promise<Visit> => {
    const now = services.now();
    const read = async <T,>(r: () => Promise<T>, fallback: T) => within(r()).catch((e: unknown) => {
      services.storage.failures += 1;
      services.storage.lastError = e;
      return fallback;
    });
    const [session, last, unlocks, earned] = await Promise.all([
      read<Session>(() => startSession(services.db, profile.id), { profileId: profile.id, index: 1, startedAt: now }),
      read(() => lastRecordedAt(services.db, profile.id), 0),
      read(() => services.db.unlocks.get(profile.id), undefined),
      read(() => stickersForProfile(services.db, profile.id), [] as Sticker[]),
    ]);
    setStickers(earned);
    return {
      profile,
      look: lookOf(profile),
      names: { name: profile.name, buddy: profile.buddy.name },
      dances: unlocks?.dances ?? STARTER_DANCES,
      play: {
        pack: services.pack, db: services.db, profileId: profile.id, sessionIndex: session.index, sessionStartedAt: session.startedAt,
        clock: monotonicClock(last), now: services.now, writes: services.writes, storage: services.storage,
        random: services.random, newSeed: services.newSeed,
      },
    };
  };

  const start = (profile: Profile) => {
    services.unlockAudio(); // inside the tap, before any await (spec §7)
    services.speaker.names = { name: profile.name, buddy: profile.buddy.name };
    setGreeting({ profileId: profile.id, move: 'wave', expression: 'happy' });
    services.speaker.say(greetingLineFor(blockFor(new Date(services.now()))));
    void Promise.all([openVisit(profile), new Promise((r) => setTimeout(r, GREETING_MS))]).then(([v]) => {
      setVisit(v);
      setGreeting(null);
      setScreen({ name: 'map' });
    });
  };

  const finished = (yourTurn: boolean) => {
    setsSinceYourTurn.current = yourTurn ? 0 : setsSinceYourTurn.current + 1;
    setScreen({ name: 'map' });
    if (visit) void services.writes.idle().then(() => stickersForProfile(services.db, visit.profile.id)).then(setStickers, () => {});
  };

  switch (screen.name) {
    case 'boot':
      return <div className="screen" />;
    case 'setup':
      return <Setup onDone={(c) => void addChild(c).catch((e: unknown) => console.error('could not save the profile', e))} {...(profiles.length > 0 ? { onCancel: () => setScreen({ name: 'hello' }) } : {})} speakText={services.speakText} />;
    case 'hello':
      return <Hello profiles={profiles} greeting={greeting} onStart={start} onAddChild={() => setScreen({ name: 'setup' })} />;
    case 'map':
      return visit && (
        <MapScreen
          services={services}
          play={visit.play}
          look={visit.look}
          stickers={stickers.length}
          onPlay={(topicId) => setScreen({ name: 'game', topicId, yourTurn: yourTurnDue(setsSinceYourTurn.current + 1, services.random) })}
          onStickers={() => setScreen({ name: 'stickers' })}
        />
      );
    case 'game':
      return visit && (
        <GameScreen
          services={services}
          play={visit.play}
          look={visit.look}
          names={visit.names}
          topicId={screen.topicId}
          dances={visit.dances}
          yourTurn={screen.yourTurn}
          onLeave={() => setScreen({ name: 'map' })}
          onFinished={() => finished(screen.yourTurn)}
        />
      );
    case 'stickers':
      return <StickerBook pack={services.pack} stickers={stickers} onBack={() => setScreen({ name: 'map' })} />;
  }
}
