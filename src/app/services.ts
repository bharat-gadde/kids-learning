// src/app/services.ts
import { createDb, type BuddyDB } from '../engine/progress/db';
import type { ContentPack } from '../engine/content/load';
import { createWebSpeechTts } from '../engine/audio/tts';
import { createMusic, type Music } from './audio/music';
import { createAudioManager, loadManifest, primeHowler, primeVoices, stopWhenHidden, unlockSpeech } from './audio/setup';
import { createSfx, unlockOnEveryTap, type Sfx } from './audio/sfx';
import { Speaker } from './audio/speaker';
import { lazyContext } from './audio/synth';
import { createStorageHealth, WriteQueue, type StorageHealth } from './game/storage';
import { pack } from './pack';

/** Everything the screens use from outside React: content, storage, sound. One per app; fakes in tests. */
export interface Services {
  pack: ContentPack;
  db: BuddyDB;
  speaker: Speaker;
  sfx: Sfx;
  music: Music;
  storage: StorageHealth;
  writes: WriteQueue;
  /** Call synchronously inside the child's first tap, before any await (spec §7: audio starts after a tap). */
  unlockAudio(): void;
  /** Say any text with the device voice: the setup screen's name suggestions, which have no lines. */
  speakText(text: string): void;
  random(): number;
  /** a fresh random 32-bit seed (crypto, which also works outside https) */
  newSeed(): number;
  now(): number;
}

export async function createServices(): Promise<Services> {
  const baseUrl = import.meta.env.BASE_URL;
  const audio = createAudioManager(pack, await loadManifest(baseUrl), baseUrl);
  const context = lazyContext();
  const music = createMusic(context);
  const sfx = createSfx(context);
  unlockOnEveryTap(sfx); // iOS can suspend the context mid-visit (a lock, a call): the next tap resumes it
  const storage = createStorageHealth();
  const tts = createWebSpeechTts();
  primeHowler();
  primeVoices();
  stopWhenHidden(() => {
    audio.stop();
    music.stop();
  });
  return {
    pack,
    db: createDb(),
    speaker: new Speaker(audio, pack),
    sfx,
    music,
    storage,
    writes: new WriteQueue(storage),
    unlockAudio() {
      unlockSpeech();
      sfx.unlock();
    },
    speakText(text) {
      audio.stop();
      void tts.speak(text).catch(() => {});
    },
    random: Math.random,
    newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0] as number,
    now: Date.now,
  };
}
