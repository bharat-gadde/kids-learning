// src/app/mechanics/match.test.tsx
// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUIET, SHOW_MS } from '../game/useRoundFlow';
import { target } from '../testing/dom';
import { mechanicProps, roundOf } from '../testing/fakes';
import { DragToMatch } from './DragToMatch';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
});

type Pair = readonly [string, string];

/** A board to play by pointer: jsdom has no layout, so `over` names the card the pointer is let go on. */
function board(container: HTMLElement) {
  let over: string | null = null;
  document.elementsFromPoint = () => (over ? [target(container, over)] : []);
  const press = (id: string, pointerId = 1) => fireEvent.pointerDown(target(container, id), { pointerId, clientX: 10, clientY: 10 });
  const move = (id: string, pointerId = 1, clientX = 80) => fireEvent.pointerMove(target(container, id), { pointerId, clientX, clientY: 10 });
  /** let go of the press that began on `id`, over `to` (its pointer is captured: the up comes to `id`) */
  const lift = (id: string, to: string | null, pointerId = 1) => {
    over = to;
    fireEvent.pointerUp(target(container, id), { pointerId, clientX: 80, clientY: 10 });
  };
  return {
    press, move, lift,
    /** the system takes the touch (a gesture, a call) while it is over `to` */
    cancel(id: string, to: string) {
      over = to;
      fireEvent.pointerCancel(target(container, id), { pointerId: 1, clientX: 80, clientY: 10 });
    },
    drag(from: string, to: string | null) {
      press(from);
      move(from);
      lift(from, to);
      fireEvent.click(target(container, from)); // a mouse clicks after its drag: no tap
    },
    tap(id: string) {
      press(id, 7);
      fireEvent.pointerUp(target(container, id), { pointerId: 7, clientX: 10, clientY: 10 });
      fireEvent.click(target(container, id));
    },
    lines: () => container.querySelectorAll('line:not([stroke-dasharray])').length,
    band: () => container.querySelector('line[stroke-dasharray]'),
  };
}

describe('DragToMatch', () => {
  it('matches each pair, says the words of a rhyme round, and ends correct', () => {
    const round = roundOf('rhyming.match', 6, 2);
    if (round.payload.kind !== 'pairs') throw new Error('pairs');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<DragToMatch {...props} />);
    for (const [a, b] of round.payload.pairs) {
      fireEvent.click(target(container, b)); // either side first
      fireEvent.click(target(container, a));
    }
    expect(rec.words.length).toBe(round.payload.pairs.length);
    expect(rec.ends).toEqual([{ outcome: 'correct', hints: 0, wrongIds: [] }]);
  });

  it('a wrong partner lights the right one; a second miss from that item and Buddy draws its line', () => {
    const round = roundOf('capital-small.match', 2, 3);
    if (round.payload.kind !== 'pairs') throw new Error('pairs');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<DragToMatch {...props} />);
    const [[a, b], [, other]] = round.payload.pairs as [readonly [string, string], readonly [string, string]];
    fireEvent.click(target(container, a));
    fireEvent.click(target(container, other));
    expect(target(container, b).className).toContain('cue-hint');
    fireEvent.click(target(container, a));
    fireEvent.click(target(container, other));
    act(() => vi.advanceTimersByTime(SHOW_MS));
    expect(target(container, a).getAttribute('aria-pressed')).toBe('true');
    for (const [l, r] of round.payload.pairs.slice(1)) {
      fireEvent.click(target(container, l));
      fireEvent.click(target(container, r));
    }
    expect(rec.ends).toEqual([{ outcome: 'shown', hints: 1, wrongIds: [`${a}>${other}`, `${a}>${other}`] }]);
  });

  it('a tap on a picture says its name once', () => {
    const round = roundOf('rhyming.match', 6, 2);
    if (round.payload.kind !== 'pairs') throw new Error('pairs');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<DragToMatch {...props} />);
    const item = target(container, round.payload.pairs[0]![0]);
    fireEvent.pointerDown(item, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(item, { pointerId: 1, clientX: 13, clientY: 12 }); // a wobble is still a tap
    fireEvent.pointerUp(item, { pointerId: 1, clientX: 13, clientY: 12 });
    fireEvent.click(item);
    expect(rec.words.length).toBe(1);
    expect(item.className).toContain('is-selected');
  });

  it('says no words for counted groups', () => {
    const round = roundOf('counting.match', 5, 2);
    const { props, rec } = mechanicProps(round);
    const { container } = render(<DragToMatch {...props} />);
    if (round.payload.kind !== 'pairs') throw new Error('pairs');
    fireEvent.click(target(container, round.payload.pairs[0]![0]));
    expect(rec.words).toEqual([]);
  });

  it('a drag from either side draws a line that stays; let go anywhere else and nothing is drawn', () => {
    const round = roundOf('rhyming.match', 6, 2);
    if (round.payload.kind !== 'pairs') throw new Error('pairs');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<DragToMatch {...props} />);
    const b = board(container);
    const [[a1, b1], [a2, b2], [a3, b3]] = round.payload.pairs as [Pair, Pair, Pair];
    b.press(a1);
    b.move(a1);
    expect(b.band()).not.toBeNull(); // the line follows the finger
    b.lift(a1, null); // let go over nothing
    b.press(a1);
    b.move(a1);
    b.cancel(a1, b1); // the system took the touch
    b.drag(a1, a2); // on the same column
    b.drag(b1, b1); // on itself
    expect([b.lines(), b.band()]).toEqual([0, null]);
    expect(target(container, b1).className).not.toContain('is-selected'); // the click after a drag is no tap
    b.drag(a1, b1); // from the left
    b.drag(b2, a2); // from the right
    expect(b.lines()).toBe(2);
    expect(target(container, a2).className).toContain('is-right');
    b.tap(a3);
    b.tap(b3);
    expect(b.lines()).toBe(3); // the first two stay
    expect(rec.ends).toEqual([{ outcome: 'correct', hints: 0, wrongIds: [] }]);
  });

  it('a pair Buddy is showing takes no press, tap or line until he draws it after SHOW_MS; the others stay free', () => {
    const round = roundOf('rhyming.match', 6, 3);
    if (round.payload.kind !== 'pairs') throw new Error('pairs');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<DragToMatch {...props} />);
    const b = board(container);
    const [[a, x], [c, d], [e, f]] = round.payload.pairs as [Pair, Pair, Pair];
    b.drag(a, d);
    b.drag(a, d); // the second miss from a: Buddy shows a's line
    expect(target(container, x).className).toContain('cue-show');
    const words = rec.words.length;
    b.tap(a);
    b.tap(x);
    b.drag(a, x);
    b.drag(c, x);
    expect([rec.words.length - words, b.lines(), container.querySelectorAll('.is-selected').length]).toEqual([1, 0, 0]); // only c spoke
    b.drag(e, f); // the rest of the round goes on
    act(() => vi.advanceTimersByTime(SHOW_MS - 1));
    expect(target(container, a).getAttribute('aria-pressed')).toBe('false'); // he takes his time
    act(() => vi.advanceTimersByTime(1));
    expect([target(container, a).getAttribute('aria-pressed'), b.lines()]).toEqual(['true', 2]);
    expect(rec.said).toEqual(['fb.try_again', 'fb.shown']);
  });

  it('a second finger or a palm neither takes over a drag nor ends it; only the main button presses', () => {
    const round = roundOf('rhyming.match', 6, 2);
    if (round.payload.kind !== 'pairs') throw new Error('pairs');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<DragToMatch {...props} />);
    const b = board(container);
    const [[a1, b1], [a2, b2], [a3, b3]] = round.payload.pairs as [Pair, Pair, Pair];
    b.press(a1, 1);
    b.move(a1, 1);
    b.press(a2, 2); // a palm lands on another card and shifts
    b.move(a2, 2, 300);
    expect(b.band()!.getAttribute('x2')).toBe('80'); // the line still follows the finger
    b.lift(a1, b1, 1); // the finger lets go on a1's partner first
    b.lift(a2, b3, 2);
    b.press(a2, 1);
    b.move(a2, 1);
    b.press(a3, 2);
    b.move(a3, 2);
    b.lift(a3, b2, 2); // the palm lifts first, over a2's partner
    expect(b.band()).not.toBeNull(); // the drag goes on
    b.lift(a2, b2, 1);
    expect([b.lines(), b.band(), rec.said, rec.words.length]).toEqual([2, null, [], 2]); // the palms said nothing either
    fireEvent.pointerDown(target(container, a3), { pointerId: 1, button: 2 });
    expect(rec.words.length).toBe(2);
  });

  it('a drag puts down what a tap picked', () => {
    const round = roundOf('rhyming.match', 6, 2);
    if (round.payload.kind !== 'pairs') throw new Error('pairs');
    const { props } = mechanicProps(round);
    const { container } = render(<DragToMatch {...props} />);
    const b = board(container);
    const [[a1, b1], [, b2]] = round.payload.pairs as [Pair, Pair];
    b.tap(a1);
    b.drag(a1, b1);
    expect(target(container, a1).className).not.toContain('is-selected');
    b.tap(b2); // picked, not swallowed by a1
    expect(target(container, b2).className).toContain('is-selected');
  });

  it('a touch starts the quiet spell again; after one, the first open pair wiggles', () => {
    const round = roundOf('capital-small.match', 2, 3);
    if (round.payload.kind !== 'pairs') throw new Error('pairs');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<DragToMatch {...props} />);
    const [[a, x], [c, d]] = round.payload.pairs as [Pair, Pair];
    const b = board(container);
    act(() => vi.advanceTimersByTime(QUIET.first - 1));
    b.tap(c); // picked: the prompt is not repeated over it
    act(() => vi.advanceTimersByTime(1));
    expect(rec.replays).toBe(0);
    b.drag(a, x);
    act(() => vi.advanceTimersByTime(QUIET.first + QUIET.every));
    expect([c, d].map((id) => target(container, id).className.includes('cue-hint'))).toEqual([true, true]);
  });
});
