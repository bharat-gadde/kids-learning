// src/app/testing/services.ts
// Services for app-level tests: a fresh fake-IndexedDB database, a voice that records, silent sounds.
import type { SpeakRequest } from '../../engine/audio/manager';
import { createDb } from '../../engine/progress/db';
import { Speaker, type Voice } from '../audio/speaker';
import { createStorageHealth, WriteQueue } from '../game/storage';
import { pack } from '../pack';
import type { Services } from '../services';

export class RecordingVoice implements Voice {
  said: SpeakRequest[] = [];
  /** while true, each line goes on "sounding" until release() */
  hold = false;
  private sounding: Array<() => void> = [];
  speak(req: SpeakRequest): Promise<void> {
    this.said.push(req);
    return this.hold ? new Promise<void>((resolve) => this.sounding.push(resolve)) : Promise.resolve();
  }
  release() {
    this.hold = false;
    this.sounding.splice(0).forEach((resolve) => resolve());
  }
  stop() {}
}

let n = 0;

/** Needs fake-indexeddb loaded (import 'fake-indexeddb/auto'). */
export function testServices(): Services & { voice: RecordingVoice; danced: string[] } {
  const voice = new RecordingVoice();
  const storage = createStorageHealth();
  const danced: string[] = [];
  let seed = 1000;
  return {
    voice,
    danced,
    pack,
    db: createDb(`app-test-${++n}`),
    speaker: new Speaker(voice, pack),
    sfx: { unlock() {}, chime() {}, boop() {}, pop() {}, whoosh() {}, sparkle() {} },
    music: { play: (d) => { danced.push(d); }, stop() {} },
    storage,
    writes: new WriteQueue(storage),
    unlockAudio() {},
    speakText() {},
    random: Math.random,
    newSeed: () => ++seed,
    now: () => Date.now(),
  };
}
