// src/app/mechanics/scene.test.tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHOW_MS } from '../game/useRoundFlow';
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

describe('SceneThenChoose', () => {
  it('plays the vignette, then offers the choices; a right feeling: Buddy acts it out and cheers', () => {
    const round = scenario('feelings.scene', 'sc.ice-cream-fell');
    const { props, rec } = mechanicProps(round);
    render(<SceneThenChoose {...props} />);
    expect(screen.queryByLabelText('sad')).toBeNull();
    act(() => vi.advanceTimersByTime(WATCH_MS));
    fireEvent.click(screen.getByLabelText('sad'));
    expect(screen.getAllByRole('img').some((el) => el.getAttribute('class')?.includes('buddy--sad'))).toBe(true);
    expect(rec.said).toEqual(['fb.correct']);
    expect(rec.ends).toEqual([{ outcome: 'correct', hints: 0, wrongIds: [] }]);
  });

  it('kindness: an unkind choice says its reaction and shows the friend sad; the kind one, its reaction, and the friend smiles', () => {
    const round = scenario('kind-fair.scene', 'sc.friend-crying');
    const { props, rec } = mechanicProps(round);
    render(<SceneThenChoose {...props} />);
    act(() => vi.advanceTimersByTime(WATCH_MS));
    fireEvent.click(screen.getByLabelText('laugh at them'));
    expect(rec.said).toEqual(['react.unkind']);
    expect((screen.getByAltText('your friend') as HTMLImageElement).src).toContain('face-sad');
    expect(screen.getAllByRole('img').some((el) => el.getAttribute('class')?.includes('buddy--sad'))).toBe(false); // Buddy never acts it out
    fireEvent.click(screen.getByLabelText('give a hug'));
    expect(rec.said).toEqual(['react.unkind', 'react.kind']);
    expect((screen.getByAltText('your friend') as HTMLImageElement).src).toContain('face-happy');
    expect(rec.ends).toEqual([{ outcome: 'corrected', hints: 1, wrongIds: ['laugh'] }]);
  });

  it('accepts either right answer when a scene has two (a broken toy: angry or sad)', () => {
    const round = scenario('feelings.scene', 'sc.toy-broken');
    const { props, rec } = mechanicProps(round);
    render(<SceneThenChoose {...props} />);
    act(() => vi.advanceTimersByTime(WATCH_MS));
    fireEvent.click(screen.getByLabelText('angry'));
    expect(rec.ends[0]?.outcome).toBe('correct');
  });

  it('after two misses Buddy shows the answer and the round is shown', () => {
    const round = scenario('feelings.scene', 'sc.loud-thunder');
    const { props, rec } = mechanicProps(round);
    render(<SceneThenChoose {...props} />);
    act(() => vi.advanceTimersByTime(WATCH_MS));
    fireEvent.click(screen.getByLabelText('happy'));
    fireEvent.click(screen.getByLabelText('sleepy'));
    act(() => vi.advanceTimersByTime(SHOW_MS));
    expect(rec.ends).toEqual([{ outcome: 'shown', hints: 1, wrongIds: ['happy', 'sleepy'] }]);
  });
});

describe('the M1 mechanics', () => {
  it('every scenario has a vignette', () => {
    for (const s of pack.scenarios.values()) expect(VIGNETTES[s.vignette], s.id).toBeDefined();
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
});
