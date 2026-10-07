// src/app/game/clock.ts
/**
 * Record times that never go back or repeat: mastery, bridging, the picker, levelFor and replayRound all order a
 * profile's records by `at`, and one step back (a clock change, two writes in one millisecond) reorders them.
 */
export interface Clock {
  now(): number;
}

/** Starts after `last` (lastRecordedAt) and moves on by at least 1 ms per reading. */
export function monotonicClock(last: number, wall: () => number = Date.now): Clock {
  let prev = last;
  return {
    now() {
      prev = Math.max(wall(), prev + 1);
      return prev;
    },
  };
}
