// src/app/App.tsx
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { IconButton } from './ui/IconButton';

type Screen =
  | { name: 'boot' }
  | { name: 'setup' }
  | { name: 'hello' }
  | { name: 'map' }
  | { name: 'game'; topicId: string; yourTurn: boolean }
  | { name: 'stickers' }
  | { name: 'trouble' };

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
/**
 * The longest the Map waits for the greeting to end, as its suggestion would cut it off: the longest greeting, its name
 * spliced in by the device voice, took 3.2 s in Chrome on a Mac. A greeting that never ends holds Hello this long.
 */
export const GREETING_MAX_MS = 5000;

/** Spec §4.5: "your turn" every 2nd–3rd set, at random; `sets` counts the sets since the last one, this one included. */
export function yourTurnDue(sets: number, random: () => number): boolean {
  return sets >= 3 || (sets === 2 && random() < 0.5);
}

/** Spec §10: ask the browser to keep the data — at every start, as a browser may say no before the app is installed. */
function keepData(): void {
  void navigator.storage?.persist?.().catch(() => false);
}

/** For a grown-up, when Buddy can't go on (storage gave no answer, or start-up failed): reloading is the cure. */
export function Trouble() {
  return (
    <div className="screen" style={{ alignItems: 'center', justifyContent: 'center', gap: 24, padding: 40, textAlign: 'center' }}>
      <p>Buddy could not start. Tap to try again.</p>
      <IconButton icon="ui/again.svg" label="Try again" onClick={() => location.reload()} />
    </div>
  );
}

/** A render error anywhere would leave a blank page, and an app on the home screen has no reload: show Trouble instead. */
export class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error('Buddy stopped', error);
  }
  override render() {
    return this.state.failed ? <Trouble /> : this.props.children;
  }
}

/** The app (spec §4.1, Plan 1B's part): Setup on first run, Hello, the Map, a set, the sticker book. */
export function App({ services }: { services: Services }) {
  const [screen, setScreen] = useState<Screen>({ name: 'boot' });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [greeting, setGreeting] = useState<{ profileId: string; move: BuddyMove; expression: BuddyExpression } | null>(null);
  const [stickers, setStickers] = useState<readonly Sticker[]>([]);
  const setsSinceYourTurn = useRef(0);
  const saving = useRef(false);

  useEffect(() => {
    // capped: a stalled database (Safari, after an update or a resume) would leave the blank boot screen for good
    within(listProfiles(services.db)).then(
      (ps) => {
        setProfiles(ps);
        setScreen(ps.length > 0 ? { name: 'hello' } : { name: 'setup' });
        if (ps.length > 0) keepData();
      },
      (e: unknown) => {
        // not setup: storage that can't be read can't save a child either, and one that answers late would hold two
        console.error('could not read profiles', e);
        setScreen({ name: 'trouble' });
      },
    );
  }, [services]);

  const addChild = async (child: NewChild) => {
    if (saving.current) return; // a second tap on "Let's play!" while the first saves would add the child twice
    saving.current = true;
    try {
      const profile = await within(createProfile(services.db, child));
      keepData();
      setProfiles((ps) => [...ps, profile]);
      setScreen({ name: 'hello' });
    } catch (e) {
      console.error('could not save the profile', e);
      setScreen({ name: 'trouble' });
    } finally {
      saving.current = false;
    }
  };

  /** The visit's session and record clock; on a storage failure the child still plays, and what can't be stored is dropped (counted in services.storage). */
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
    const greeted = services.speaker.say(greetingLineFor(blockFor(new Date(services.now()))));
    const after = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    void Promise.all([openVisit(profile), after(GREETING_MS), Promise.race([greeted.done, after(GREETING_MAX_MS)])]).then(
      ([v]) => {
        setVisit(v);
        setGreeting(null);
        setScreen({ name: 'map' });
      },
      (e: unknown) => {
        console.error('could not open the visit', e); // not left on Hello with every Buddy disabled
        setGreeting(null);
        setScreen({ name: 'trouble' });
      },
    );
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
      return <Setup onDone={(c) => void addChild(c)} {...(profiles.length > 0 ? { onCancel: () => setScreen({ name: 'hello' }) } : {})} speakText={services.speakText} />;
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
    case 'trouble':
      return <Trouble />;
  }
}
