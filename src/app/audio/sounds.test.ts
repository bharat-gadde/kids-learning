// src/app/audio/sounds.test.ts
import { describe, it, expect, vi } from 'vitest';
import { fakeContext } from './fakeContext';
import { createMusic, LOOP_SECONDS } from './music';
import { createSfx, unlockOnEveryTap } from './sfx';
import { lazyContext } from './synth';

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

describe('unlockOnEveryTap', () => {
  it('resumes, on the next tap, a context iOS suspended mid-visit (a screen lock, a call)', async () => {
    const ctx = fakeContext();
    const sfx = createSfx(() => ctx);
    const doc = new EventTarget();
    const off = unlockOnEveryTap(sfx, doc);
    ctx.state = 'interrupted';
    sfx.chime();
    expect(ctx.started).toEqual([]);
    doc.dispatchEvent(new Event('pointerup'));
    await Promise.resolve();
    sfx.chime();
    expect(ctx.started).toHaveLength(2);
    off();
    ctx.state = 'suspended';
    doc.dispatchEvent(new Event('touchend'));
    expect(ctx.state).toBe('suspended');
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
    vi.useFakeTimers();
    try {
      const ctx = fakeContext();
      const music = createMusic(() => ctx);
      music.play('trunk-twirl');
      const twirl = ctx.started.length;
      music.play('elephant-stomp');
      const stomp = ctx.started.length - twirl;
      expect(ctx.cancelled).toBe(twirl); // none of the first dance's notes had started
      expect(ctx.disconnected).toBe(0); // the first is fading; it disconnects after its fade
      vi.advanceTimersByTime(7_100);
      expect(ctx.started.length).toBe(twirl + 2 * stomp); // only the stomp loops on
      expect(ctx.disconnected).toBe(1);
      music.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('calls setTimeout and clearTimeout as plain functions: browsers throw "Illegal invocation" for a method of another object', () => {
    vi.useFakeTimers();
    const set = vi.spyOn(globalThis, 'setTimeout');
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    try {
      const ctx = fakeContext();
      const music = createMusic(() => ctx);
      music.play('trunk-twirl');
      vi.advanceTimersByTime(7_100);
      music.stop();
      expect(set).toHaveBeenCalled();
      expect(clear).toHaveBeenCalled();
      for (const self of [...set.mock.contexts, ...clear.mock.contexts]) expect(self === undefined || self === globalThis).toBe(true);
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it('starts a late loop afresh rather than sounding its past notes at once', () => {
    vi.useFakeTimers();
    try {
      const ctx = fakeContext();
      const music = createMusic(() => ctx);
      music.play('trunk-twirl');
      const first = ctx.started.length;
      ctx.currentTime = 9.5; // the main thread was busy: the timer fires 2.45 s after the next loop was due to be queued
      vi.advanceTimersByTime(7_100);
      const second = ctx.started.slice(first);
      expect(second).toHaveLength(first);
      expect(Math.min(...second.map((n) => n.at))).toBeGreaterThanOrEqual(9.5);
      music.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels the queued loop on stop(), so its first beat never sounds under the fade', () => {
    vi.useFakeTimers();
    try {
      const ctx = fakeContext();
      const music = createMusic(() => ctx);
      music.play('elephant-stomp');
      const first = ctx.started.length;
      vi.advanceTimersByTime(7_100); // the second loop is queued, to start at 8.05 s
      ctx.currentTime = 8;
      music.stop();
      expect(ctx.cancelled).toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('lazyContext', () => {
  it('is null, not an exception, when the browser refuses a context', () => {
    vi.stubGlobal('window', { AudioContext: class { constructor() { throw new Error('NotSupportedError'); } } });
    try {
      expect(lazyContext()()).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
