// src/app/mechanics/tap.test.tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mechanicProps, roundOf } from '../testing/fakes';
import { SHOW_MS } from '../game/useRoundFlow';
import { TapAll } from './TapAll';
import { TapTheOne } from './TapTheOne';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** The option buttons, in screen order, with the round's own ids. */
function options(round: ReturnType<typeof roundOf>) {
  if (round.payload.kind !== 'choose') throw new Error('expected choose');
  const buttons = screen.getAllByRole('button');
  return round.payload.options.map((o, i) => ({ id: o.id, right: round.payload.kind === 'choose' && round.payload.correctIds.includes(o.id), button: buttons[i]! }));
}

describe('TapTheOne', () => {
  it('draws every option, and the right tap ends the round correct', () => {
    const round = roundOf('letters.tap', 3, 2);
    const { props, rec } = mechanicProps(round);
    render(<TapTheOne {...props} />);
    const opts = options(round);
    expect(opts).toHaveLength(3);
    fireEvent.click(opts.find((o) => o.right)!.button);
    expect(rec.ends).toEqual([{ outcome: 'correct', hints: 0, wrongIds: [] }]);
    expect(rec.sounds).toEqual(['chime']);
  });

  it('a wrong tap: try again and a hint; a second: Buddy shows the answer and the round ends shown', () => {
    const round = roundOf('big-small.tap', 5, 3);
    const { props, rec } = mechanicProps(round);
    render(<TapTheOne {...props} />);
    const opts = options(round);
    const wrong = opts.filter((o) => !o.right);
    fireEvent.click(wrong[0]!.button);
    expect(rec.said).toEqual(['fb.try_again']);
    expect(rec.ends).toEqual([]);
    expect(opts.find((o) => o.right)!.button.className).toContain('cue-hint');
    fireEvent.click(wrong[1]!.button);
    expect(rec.said).toEqual(['fb.try_again', 'fb.shown']);
    act(() => vi.advanceTimersByTime(SHOW_MS));
    expect(rec.ends).toEqual([{ outcome: 'shown', hints: 1, wrongIds: [wrong[0]!.id, wrong[1]!.id] }]);
  });

  it('ignores taps once the round has ended', () => {
    const round = roundOf('feelings.tap', 2, 1);
    const { props, rec } = mechanicProps(round);
    render(<TapTheOne {...props} />);
    const opts = options(round);
    fireEvent.click(opts.find((o) => o.right)!.button);
    fireEvent.click(opts.find((o) => !o.right)!.button);
    expect(rec.ends).toHaveLength(1);
    expect(rec.said).toEqual(['fb.correct']);
  });

  it('shows the same object bigger and smaller for a size round', () => {
    const round = roundOf('big-small.tap', 5, 3);
    render(<TapTheOne {...mechanicProps(round).props} />);
    const widths = screen.getAllByRole('img').map((img) => Number((img as HTMLImageElement).style.width.replace('px', '')));
    expect(new Set(widths).size).toBe(4); // four sizes of one object
  });
});

describe('TapAll', () => {
  it('ticks each right one; the round ends correct when all are ticked', () => {
    const round = roundOf('good-habits.clean', 4, 2);
    const { props, rec } = mechanicProps(round);
    render(<TapAll {...props} />);
    const right = options(round).filter((o) => o.right);
    expect(right).toHaveLength(3);
    right.forEach((o) => fireEvent.click(o.button));
    fireEvent.click(right[0]!.button); // a second tap on a ticked one changes nothing
    expect(rec.sounds).toEqual(['pop', 'pop', 'chime']);
    expect(rec.ends).toEqual([{ outcome: 'correct', hints: 0, wrongIds: [] }]);
  });

  it('after two wrong taps Buddy ticks the rest and the round is shown', () => {
    const round = roundOf('good-habits.clean', 4, 2);
    const { props, rec } = mechanicProps(round);
    render(<TapAll {...props} />);
    const opts = options(round);
    fireEvent.click(opts.find((o) => o.right)!.button);
    const wrong = opts.filter((o) => !o.right);
    fireEvent.click(wrong[0]!.button);
    fireEvent.click(wrong[1]!.button);
    act(() => vi.advanceTimersByTime(SHOW_MS + 3 * 450));
    expect(rec.ends).toEqual([{ outcome: 'shown', hints: 1, wrongIds: [wrong[0]!.id, wrong[1]!.id] }]);
    expect(opts.filter((o) => o.right).every((o) => o.button.getAttribute('aria-pressed') === 'true')).toBe(true);
  });
});
