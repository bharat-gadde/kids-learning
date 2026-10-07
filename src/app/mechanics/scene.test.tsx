// src/app/mechanics/scene.test.tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isExpression } from '../buddy/Buddy';
import { QUIET, SETTLE_MS, SHOW_MS } from '../game/useRoundFlow';
import { VIGNETTES, WATCH_MS } from '../scenario/vignettes';
import { mechanicProps, pack, roundOf } from '../testing/fakes';
import { isPlayable, Mechanic } from './Mechanic';
import { SceneThenChoose } from './SceneThenChoose';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A scenario round of the topic whose scenario has this id, from some seed. */
function scenario(templateId: string, scenarioId: string) {
  for (let seed = 0; seed < 200; seed++) {
    const round = roundOf(templateId, seed);
    if (round.payload.kind === 'scenario' && round.payload.scenarioId === scenarioId) return round;
  }
  throw new Error(`no seed draws ${scenarioId}`);
}

/** The friend's face now: `face-sad` for parts/face-sad.svg. */
const friendFace = () => (screen.getByAltText('your friend') as HTMLImageElement).src.replace(/^.*\/(face-[a-z]+)\.svg$/, '$1');
/** Buddy's expression in the vignette, from his class. */
const vignetteBuddy = () => /buddy--(neutral|happy|thinking|sad|scared|angry)\b/.exec(document.querySelector('.vignette .buddy')?.getAttribute('class') ?? '')?.[1];

describe('SceneThenChoose', () => {
  it('plays the vignette, then offers the choices; a right feeling: Buddy acts it out and cheers', () => {
    const round = scenario('feelings.scene', 'sc.ice-cream-fell');
    const { props, rec } = mechanicProps(round);
    render(<SceneThenChoose {...props} />);
    act(() => vi.advanceTimersByTime(WATCH_MS - 1));
    expect(screen.queryByLabelText('sad')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    fireEvent.click(screen.getByLabelText('sad'));
    expect(vignetteBuddy()).toBe('sad');
    expect(screen.getByLabelText('sad').className).toContain('is-right');
    expect(rec.said).toEqual(['fb.correct']);
    expect(rec.ends).toEqual([{ outcome: 'correct', hints: 0, wrongIds: [] }]);
  });

  it('kindness: an unkind choice says its reaction and makes the friend sadder; the kind one, its reaction, and the friend smiles', () => {
    const round = scenario('kind-fair.scene', 'sc.friend-crying');
    const { props, rec } = mechanicProps(round);
    render(<SceneThenChoose {...props} />);
    act(() => vi.advanceTimersByTime(WATCH_MS));
    expect(friendFace()).toBe('face-sad');
    fireEvent.click(screen.getByLabelText('laugh at them'));
    expect(rec.said).toEqual(['react.unkind']);
    expect(friendFace()).toBe('face-crying');
    fireEvent.click(screen.getByLabelText('give a hug'));
    expect(rec.said).toEqual(['react.unkind', 'react.kind']);
    expect(friendFace()).toBe('face-happy');
    expect(rec.ends).toEqual([{ outcome: 'corrected', hints: 1, wrongIds: ['laugh'] }]);
  });

  it('in every kindness scene an unkind choice visibly saddens the friend (spec §6 #22: the sad face is the lesson)', () => {
    const sadness = ['face-happy', 'face-hurt', 'face-sad', 'face-crying'];
    const scenes = [...pack.scenarios.values()].filter((s) => s.topicId === 'kind-fair');
    expect(scenes.length).toBeGreaterThan(0);
    for (const s of scenes) {
      const round = scenario('kind-fair.scene', s.id);
      if (round.payload.kind !== 'scenario') throw new Error('scenario');
      const unkind = round.payload.choices.find((c) => !c.correct);
      if (!unkind) throw new Error(`${s.id} has no unkind choice`);
      const { unmount } = render(<SceneThenChoose {...mechanicProps(round).props} />);
      act(() => vi.advanceTimersByTime(WATCH_MS));
      const before = friendFace();
      fireEvent.click(screen.getByLabelText(unkind.label));
      expect(sadness.indexOf(friendFace()), `${s.id}: ${before} -> ${friendFace()}`).toBeGreaterThan(sadness.indexOf(before));
      unmount();
    }
  });

  it('accepts either right answer when a scene has two (a broken toy: angry or sad), and Buddy acts out the one chosen', () => {
    const round = scenario('feelings.scene', 'sc.toy-broken');
    for (const answer of ['angry', 'sad']) { // the slot rule places angry: sad is the one a slot-judge would refuse
      const { props, rec } = mechanicProps(round);
      const { unmount } = render(<SceneThenChoose {...props} />);
      act(() => vi.advanceTimersByTime(WATCH_MS));
      fireEvent.click(screen.getByLabelText(answer));
      expect(rec.ends, answer).toEqual([{ outcome: 'correct', hints: 0, wrongIds: [] }]);
      expect(vignetteBuddy(), answer).toBe(answer);
      unmount();
    }
  });

  it('never acts out a wrong feeling: Buddy is not sad at a wrong answer (spec §4.7)', () => {
    const round = scenario('feelings.scene', 'sc.birthday-gift'); // happy is right
    const { props, rec } = mechanicProps(round);
    render(<SceneThenChoose {...props} />);
    act(() => vi.advanceTimersByTime(WATCH_MS));
    fireEvent.click(screen.getByLabelText('sad'));
    expect(rec.said).toEqual(['fb.try_again']);
    expect(vignetteBuddy()).toBe('neutral');
    expect(['happy', 'sad', 'scared'].filter((f) => screen.getByLabelText(f).className.includes('cue-hint'))).toEqual(['happy']); // the hint: the right one wiggles
  });

  it('after two misses Buddy shows the answer and the round is shown; a bounce counts once, and nothing is taken while Buddy shows', () => {
    const round = scenario('feelings.scene', 'sc.loud-thunder'); // scared is right
    const { props, rec } = mechanicProps(round);
    render(<SceneThenChoose {...props} />);
    act(() => vi.advanceTimersByTime(WATCH_MS));
    fireEvent.click(screen.getByLabelText('happy'));
    fireEvent.click(screen.getByLabelText('happy')); // a bounce on the card that just shook: the same answer again
    expect(rec.said).toEqual(['fb.try_again']);
    act(() => vi.advanceTimersByTime(SETTLE_MS));
    fireEvent.click(screen.getByLabelText('sleepy'));
    fireEvent.click(screen.getByLabelText('scared')); // Buddy is showing: too late to answer
    act(() => vi.advanceTimersByTime(SHOW_MS - 1));
    expect(rec.ends).toEqual([]);
    act(() => vi.advanceTimersByTime(1));
    expect(rec.ends).toEqual([{ outcome: 'shown', hints: 1, wrongIds: ['happy', 'sleepy'] }]);
    expect(vignetteBuddy()).toBe('scared');
  });

  it('times the quiet spell from when the choices appear, not while the scene plays', () => {
    const round = scenario('feelings.scene', 'sc.loud-thunder');
    const { props, rec } = mechanicProps(round);
    render(<SceneThenChoose {...props} />);
    act(() => vi.advanceTimersByTime(QUIET.first));
    expect(rec.replays).toBe(0);
    act(() => vi.advanceTimersByTime(WATCH_MS));
    expect(rec.replays).toBe(1);
  });
});

describe('the M1 mechanics', () => {
  it('every scenario has a vignette, and Buddy can act out every feeling a scene asks for', () => {
    for (const s of pack.scenarios.values()) {
      const v = VIGNETTES[s.vignette];
      expect(v, s.id).toBeDefined();
      if (!v?.actors.some((a) => a.who === 'buddy')) continue;
      for (const c of s.choices.filter((ch) => ch.correct)) expect(isExpression(c.objectId), `${s.id}: ${c.objectId}`).toBe(true);
    }
  });

  it('play every M1 template\'s rounds at every level without throwing', () => {
    for (const template of pack.templates.values()) {
      expect(isPlayable(template.mechanic), template.id).toBe(true);
      for (const level of [1, 2, 3] as const) {
        const round = roundOf(template.id, 7, level, template.rounds - 1);
        const { unmount } = render(<Mechanic {...mechanicProps(round).props} />);
        act(() => vi.advanceTimersByTime(WATCH_MS));
        unmount();
      }
    }
  });

  it('a mechanic not built yet is not playable, and throws (the game\'s error boundary ends the set)', () => {
    expect(isPlayable('scrub')).toBe(false);
    const round = { ...roundOf('feelings.tap', 1), mechanic: 'scrub' as const };
    expect(() => Mechanic(mechanicProps(round).props)).toThrow('mechanic scrub is not built yet');
  });
});
