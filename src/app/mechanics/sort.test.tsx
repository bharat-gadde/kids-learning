// src/app/mechanics/sort.test.tsx
// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHOW_MS } from '../game/useRoundFlow';
import { byId, put, target } from '../testing/dom';
import { mechanicProps, roundOf } from '../testing/fakes';
import { Sequence } from './Sequence';
import { SortIntoBins } from './SortIntoBins';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SortIntoBins', () => {
  it('puts each item in its bin; the round ends correct with every item sorted', () => {
    const round = roundOf('healthy-food.sort', 9, 2);
    if (round.payload.kind !== 'bins') throw new Error('bins');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<SortIntoBins {...props} />);
    for (const i of round.payload.items) put(container, i.id, i.binId);
    expect(container.querySelectorAll('[data-drag-id]')).toHaveLength(0);
    expect(rec.ends).toEqual([{ outcome: 'correct', hints: 0, wrongIds: [] }]);
  });

  it('a wrong bin bounces the item back and its bin glows; a second miss with it and Buddy puts it in (shown)', () => {
    const round = roundOf('big-small.sort', 2, 1);
    if (round.payload.kind !== 'bins') throw new Error('bins');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<SortIntoBins {...props} />);
    const [first, ...rest] = round.payload.items;
    const wrongBin = first!.binId === 'big' ? 'small' : 'big';
    put(container, first!.id, wrongBin);
    expect(byId(container, first!.id)).not.toBeNull();
    expect(target(container, first!.binId).className).toContain('cue-hint');
    put(container, first!.id, wrongBin);
    act(() => vi.advanceTimersByTime(SHOW_MS));
    expect(byId(container, first!.id)).toBeNull(); // Buddy put it in
    for (const i of rest) put(container, i.id, i.binId);
    expect(rec.ends).toEqual([{ outcome: 'shown', hints: 1, wrongIds: [`${first!.id}>${wrongBin}`, `${first!.id}>${wrongBin}`] }]); // which item went where
  });
});

describe('Sequence', () => {
  it('fills the slots in order; a card on the wrong slot gets a hint, and the round is corrected', () => {
    const round = roundOf('good-habits.order', 1, 2);
    if (round.payload.kind !== 'order') throw new Error('order');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<Sequence {...props} />);
    const order = round.payload.correctOrder;
    put(container, order[1]!, 'slot:0');
    expect(target(container, 'slot:1').className).toContain('cue-hint');
    order.forEach((id, i) => put(container, id, `slot:${i}`));
    expect(rec.ends).toEqual([{ outcome: 'corrected', hints: 1, wrongIds: [`${order[1]}>slot:0`] }]);
    expect([...round.payload.correctOrder]).toEqual(order); // the frozen round is untouched
  });
});
