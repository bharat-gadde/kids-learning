// src/app/mechanics/match.test.tsx
// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHOW_MS } from '../game/useRoundFlow';
import { target } from '../testing/dom';
import { mechanicProps, roundOf } from '../testing/fakes';
import { DragToMatch } from './DragToMatch';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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
});
