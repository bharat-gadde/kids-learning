// src/app/game/useRoundFlow.test.ts
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cueClass, QUIET, useRoundFlow, type FlowEnd, type Reaction } from './useRoundFlow';

function setup() {
  const said: string[] = [];
  const sounds: string[] = [];
  const reactions: Reaction[] = [];
  const ends: FlowEnd[] = [];
  let replays = 0;
  const deps = {
    speaker: { say: (id: string) => { said.push(id); return { caption: id, done: Promise.resolve() }; }, replayPrompt: async () => { replays += 1; } },
    sfx: { chime: () => sounds.push('chime'), boop: () => sounds.push('boop'), pop: () => sounds.push('pop') },
  };
  const hook = renderHook(() => useRoundFlow({
    deps,
    targets: (key) => (key === null ? ['answer'] : [`hint-for-${key}`]),
    onEnd: (e) => ends.push(e),
    onReact: (r) => reactions.push(r),
  }));
  return { hook, said, sounds, reactions, ends, replays: () => replays };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useRoundFlow', () => {
  it('right first time: a chime, a cheer, and the round ends correct', () => {
    const t = setup();
    act(() => t.hook.result.current.done());
    expect(t.sounds).toEqual(['chime']);
    expect(t.said).toEqual(['fb.correct']);
    expect(t.reactions).toEqual(['cheer']);
    expect(t.ends).toEqual([{ outcome: 'correct', hints: 0, wrongIds: [] }]);
    expect(t.hook.result.current.ended).toBe(true);
  });

  it('a first miss: a soft sound, "try again" and a hint on the answer; then right is corrected', () => {
    const t = setup();
    let next = '';
    act(() => { next = t.hook.result.current.miss('round', 'b'); });
    expect(next).toBe('retry');
    expect(t.sounds).toEqual(['boop']);
    expect(t.said).toEqual(['fb.try_again']);
    expect(t.hook.result.current.cue).toEqual({ ids: ['hint-for-round'], kind: 'hint' });
    expect(cueClass(t.hook.result.current.cue, 'hint-for-round')).toBe('cue-hint');
    act(() => vi.advanceTimersByTime(2000));
    expect(t.hook.result.current.cue).toBeNull(); // a hint is brief
    act(() => t.hook.result.current.done());
    expect(t.ends).toEqual([{ outcome: 'corrected', hints: 1, wrongIds: ['b'] }]);
  });

  it('a second miss on the same key: "it\'s this one", Buddy points, and the round is shown without a cheer', () => {
    const t = setup();
    act(() => { t.hook.result.current.miss('round', 'b'); });
    let next = '';
    act(() => { next = t.hook.result.current.miss('round', 'd', 'react.unkind'); });
    expect(next).toBe('show');
    expect(t.said).toEqual(['fb.try_again', 'fb.shown']);
    expect(t.hook.result.current.cue).toEqual({ ids: ['hint-for-round'], kind: 'show' });
    act(() => t.hook.result.current.done());
    expect(t.sounds).toEqual(['boop']);
    expect(t.reactions).toEqual(['hmm', 'point']);
    expect(t.ends).toEqual([{ outcome: 'shown', hints: 1, wrongIds: ['b', 'd'] }]);
  });

  it('says a mechanic\'s own line for a hint and for the cheer (a kindness scene\'s reactions)', () => {
    const t = setup();
    act(() => { t.hook.result.current.miss('round', 'laugh', 'react.unkind'); });
    act(() => t.hook.result.current.done('react.kind'));
    expect(t.said).toEqual(['react.unkind', 'react.kind']);
  });

  it('after a quiet 8 s repeats the prompt; every 15 s after, repeats it with a wiggle, which is a hint', () => {
    const t = setup();
    act(() => vi.advanceTimersByTime(QUIET.first));
    expect(t.replays()).toBe(1);
    expect(t.hook.result.current.cue).toBeNull(); // the first repeat is not a hint
    act(() => vi.advanceTimersByTime(QUIET.every));
    expect(t.replays()).toBe(2);
    expect(t.hook.result.current.cue).toEqual({ ids: ['answer'], kind: 'hint' });
    expect(t.reactions).toEqual(['point']);
    act(() => t.hook.result.current.done());
    expect(t.ends[0]).toMatchObject({ outcome: 'corrected', hints: 1 });
  });

  it('a touch starts the quiet spell again, and nothing repeats after the round ends', () => {
    const t = setup();
    act(() => vi.advanceTimersByTime(QUIET.first - 1000));
    act(() => t.hook.result.current.touch());
    act(() => vi.advanceTimersByTime(QUIET.first - 1000));
    expect(t.replays()).toBe(0);
    act(() => t.hook.result.current.step());
    expect(t.sounds).toEqual(['pop']);
    act(() => t.hook.result.current.done());
    act(() => vi.advanceTimersByTime(60_000));
    expect(t.replays()).toBe(0);
  });

  it('ends once: a second done, a late miss or a step change nothing', () => {
    const t = setup();
    act(() => t.hook.result.current.done());
    act(() => { t.hook.result.current.done(); t.hook.result.current.miss('round', 'x'); t.hook.result.current.step(); });
    expect(t.ends).toHaveLength(1);
    expect(t.sounds).toEqual(['chime']);
  });

  it('stops its timers when the round goes away (the Home button)', () => {
    const t = setup();
    t.hook.unmount();
    act(() => vi.advanceTimersByTime(60_000));
    expect(t.replays()).toBe(0);
  });
});
