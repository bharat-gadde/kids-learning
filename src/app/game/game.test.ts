// src/app/game/game.test.ts
import { describe, it, expect, vi } from 'vitest';
import { monotonicClock } from './clock';
import { createStorageHealth, guarded, STORAGE_WAIT_MS, WriteQueue } from './storage';

describe('monotonicClock', () => {
  it('follows the wall clock, but never goes back or repeats, and starts after the last record', () => {
    let wall = 1000;
    const clock = monotonicClock(5000, () => wall);
    expect(clock.now()).toBe(5001);
    wall = 9000;
    expect(clock.now()).toBe(9000);
    expect(clock.now()).toBe(9001);
    wall = 100; // the clock was set back
    expect(clock.now()).toBe(9002);
  });
});

describe('storage', () => {
  it('counts a failed write instead of throwing it', async () => {
    const health = createStorageHealth();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await guarded(health, async () => { throw new Error('quota'); })).toBeUndefined();
    expect(await guarded(health, async () => 7)).toBe(7);
    expect(health.failures).toBe(1);
    vi.restoreAllMocks();
  });

  it('runs writes in order, goes on after a failure, and is idle once all are tried', async () => {
    const health = createStorageHealth();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const done: number[] = [];
    const q = new WriteQueue(health);
    q.add(async () => { await new Promise((r) => setTimeout(r, 5)); done.push(1); });
    q.add(async () => { throw new Error('quota'); });
    q.add(async () => { done.push(3); });
    await q.idle();
    expect(done).toEqual([1, 3]);
    expect(health.failures).toBe(1);
    vi.restoreAllMocks();
  });

  it('moves on from a write that never answers: it counts as failed, the next still runs, and idle() comes', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const health = createStorageHealth();
      const done: number[] = [];
      const q = new WriteQueue(health);
      q.add(() => new Promise(() => {}));
      q.add(async () => { done.push(2); });
      let idle = false;
      void q.idle().then(() => { idle = true; });
      await vi.advanceTimersByTimeAsync(STORAGE_WAIT_MS - 1);
      expect(idle).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(idle).toBe(true);
      expect(done).toEqual([2]);
      expect(health.failures).toBe(1);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });
});
