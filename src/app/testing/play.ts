// src/app/testing/play.ts
// Helpers for screen and app tests: wait for storage and timers, and a child who taps anything.
import { act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { createProfile, startSession } from '../../engine/progress/db';
import { monotonicClock } from '../game/clock';
import type { PlayContext } from '../game/setRunner';
import type { Services } from '../services';

/** The fake timers app tests use: IndexedDB's own scheduling (setImmediate) stays real. */
export const useAppTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });

/** Let storage and React catch up: Dexie and fake-indexeddb schedule on timers too, so each pass moves them on by 5 ms. */
export async function settle(times = 20): Promise<void> {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      vi.advanceTimersByTime(5);
      await new Promise((r) => setImmediate(r));
    });
  }
}

export async function wait(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await settle();
}

/** A child who taps whatever the round offers, until the set is over: Buddy shows whatever is missed. */
export async function playAnyhow(maxSteps = 300): Promise<boolean> {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)] as T;
  for (let i = 0; i < maxSteps; i++) {
    if (document.querySelector('.celebration')) return true;
    const stage = document.querySelector('.stage');
    if (stage) {
      const drags = [...stage.querySelectorAll<HTMLElement>('[data-drag-id]')];
      const drops = [...stage.querySelectorAll<HTMLElement>('[data-drop-id]')].filter((d) => !d.matches('[data-drag-id]'));
      const done = stage.querySelector<HTMLElement>('.done-button');
      const unmatched = [...stage.querySelectorAll<HTMLElement>('button[data-drop-id][aria-pressed=false]')];
      const options = [...stage.querySelectorAll<HTMLElement>('button.option')];
      if (done && Math.random() < 0.4) fireEvent.click(done);
      else if (drags.length > 0) {
        fireEvent.click(pick(drags));
        fireEvent.click(pick(drops));
      } else if (unmatched.length > 1) {
        const a = pick(unmatched);
        fireEvent.click(a);
        fireEvent.click(pick(unmatched.filter((x) => x !== a)));
      } else if (options.length > 0) fireEvent.click(pick(options));
    }
    await wait(1000);
  }
  return false;
}

/** A profile, its first session and the play context a set needs. */
export async function playContextFor(services: Services): Promise<PlayContext> {
  const profile = await createProfile(services.db, { name: 'Asha', buddy: { colour: 'pink', name: 'Gajju', accessory: 'bow' } });
  const session = await startSession(services.db, profile.id);
  return {
    pack: services.pack, db: services.db, profileId: profile.id, sessionIndex: session.index, sessionStartedAt: session.startedAt,
    clock: monotonicClock(0), now: services.now, writes: services.writes, storage: services.storage, random: services.random, newSeed: services.newSeed,
  };
}
