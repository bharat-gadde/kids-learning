// src/app/audio/sounds.test.ts
import { describe, it, expect, vi } from 'vitest';
import { fakeContext } from './fakeContext';
import { createMusic, LOOP_SECONDS } from './music';
import { createSfx } from './sfx';

describe('createSfx', () => {
  it('plays each effect as soft notes once the context runs, and nothing before the first tap', async () => {
    const ctx = fakeContext('suspended');
    const sfx = createSfx(() => ctx);
    sfx.chime();
    expect(ctx.started).toEqual([]); // suspended until the first tap
    sfx.unlock();
    await Promise.resolve();
    sfx.chime();
    expect(ctx.started.map((n) => n.freq)).toEqual([1046.5, 1318.5]);
    for (const play of [sfx.boop, sfx.pop, sfx.whoosh, sfx.sparkle]) play();
    expect(ctx.started.length).toBe(2 + 1 + 1 + 1 + 6);
  });

  it('is silent where there is no audio context', () => {
    const sfx = createSfx(() => null);
    expect(() => { sfx.unlock(); sfx.chime(); sfx.sparkle(); }).not.toThrow();
  });
});

describe('createMusic', () => {
  it('schedules a dance one 8-second loop at a time, and stop() ends it', () => {
    vi.useFakeTimers();
    try {
      const ctx = fakeContext();
      const music = createMusic(() => ctx);
      music.play('elephant-stomp');
      const first = ctx.started.length;
      expect(first).toBeGreaterThan(20);
      expect(Math.max(...ctx.started.map((n) => n.at))).toBeLessThan(LOOP_SECONDS + 0.05);
      vi.advanceTimersByTime(7_100); // the next loop is queued a second before this one ends
      expect(ctx.started.length).toBe(first * 2);
      music.stop();
      vi.advanceTimersByTime(60_000);
      expect(ctx.started.length).toBe(first * 2);
      expect(ctx.disconnected).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('plays one dance at a time', () => {
    const ctx = fakeContext();
    const music = createMusic(() => ctx);
    music.play('trunk-twirl');
    music.play('elephant-stomp');
    expect(ctx.disconnected).toBe(0); // the first is fading; it disconnects after its fade
    music.stop();
  });
});
