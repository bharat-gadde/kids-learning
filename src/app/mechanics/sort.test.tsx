// src/app/mechanics/sort.test.tsx
// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUIET, SHOW_MS } from '../game/useRoundFlow';
import { byId, put, target } from '../testing/dom';
import { mechanicProps, roundOf } from '../testing/fakes';
import { Sequence } from './Sequence';
import { SortIntoBins } from './SortIntoBins';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** The pictures drawn inside a bin or a slot (alt text = the item's label). */
const inside = (c: HTMLElement, id: string) => [...target(c, id).querySelectorAll('img')].map((i) => i.alt).filter(Boolean);

describe('SortIntoBins', () => {
  it('puts each item in its bin; the round ends correct with every item sorted', () => {
    const round = roundOf('healthy-food.sort', 9, 2);
    if (round.payload.kind !== 'bins') throw new Error('bins');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<SortIntoBins {...props} />);
    for (const i of round.payload.items) put(container, i.id, i.binId);
    expect(container.querySelectorAll('[data-drag-id]')).toHaveLength(0);
    for (const b of round.payload.bins) expect(inside(container, b.id)).toEqual(round.payload.items.filter((i) => i.binId === b.id).map((i) => i.label));
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
    put(container, first!.id, wrongBin); // while Buddy shows, the item is his: no third miss
    put(container, first!.id, first!.binId); // nor a race with his hand
    expect(rec.said).toEqual(['fb.try_again', 'fb.shown']);
    act(() => vi.advanceTimersByTime(SHOW_MS));
    expect(byId(container, first!.id)).toBeNull(); // Buddy put it in
    expect(rec.ends).toEqual([]); // and the child carries on
    for (const i of rest) put(container, i.id, i.binId);
    expect(rec.ends).toEqual([{ outcome: 'shown', hints: 1, wrongIds: [`${first!.id}>${wrongBin}`, `${first!.id}>${wrongBin}`] }]); // which item went where
  });

  it('misses count per item: one slip each on two items is two hints, not a demonstration', () => {
    const round = roundOf('healthy-food.sort', 9, 2);
    if (round.payload.kind !== 'bins') throw new Error('bins');
    const p = round.payload;
    const { props, rec } = mechanicProps(round);
    const { container } = render(<SortIntoBins {...props} />);
    const other = (binId: string) => p.bins.find((b) => b.id !== binId)!.id;
    const [a, b] = p.items;
    put(container, a!.id, other(a!.binId));
    put(container, b!.id, other(b!.binId));
    expect(target(container, b!.binId).className).toContain('cue-hint'); // each hint glows that item's bin
    expect(rec.said).toEqual(['fb.try_again', 'fb.try_again']);
    for (const i of p.items) put(container, i.id, i.binId);
    expect(rec.ends).toEqual([{ outcome: 'corrected', hints: 2, wrongIds: [`${a!.id}>${other(a!.binId)}`, `${b!.id}>${other(b!.binId)}`] }]);
  });
});

describe('Sequence', () => {
  it('fills the slots in order; a card on the wrong slot gets a hint, and the round is corrected', () => {
    const round = roundOf('good-habits.order', 1, 2);
    const p = round.payload;
    if (p.kind !== 'order') throw new Error('order');
    const order = [...p.correctOrder]; // a copy: the round must come out as it went in
    const { props, rec } = mechanicProps(round);
    const { container } = render(<Sequence {...props} />);
    put(container, order[1]!, 'slot:0');
    expect(target(container, 'slot:1').className).toContain('cue-hint');
    order.forEach((id, i) => put(container, id, `slot:${i}`));
    order.forEach((id, i) => expect(inside(container, `slot:${i}`)).toEqual([p.items.find((it) => it.id === id)!.label]));
    expect(rec.ends).toEqual([{ outcome: 'corrected', hints: 1, wrongIds: [`${order[1]}>slot:0`] }]);
    expect(p.correctOrder).toEqual(order); // the frozen round is untouched
  });

  it('a second miss with a card and Buddy puts it in its slot, and the child carries on; a filled slot takes no miss', () => {
    const round = roundOf('good-habits.order', 1, 2);
    if (round.payload.kind !== 'order') throw new Error('order');
    const order = round.payload.correctOrder;
    const { props, rec } = mechanicProps(round);
    const { container } = render(<Sequence {...props} />);
    put(container, order[0]!, 'slot:0');
    put(container, order[2]!, 'slot:0'); // taken: the card just goes back
    expect(rec.said).toEqual([]);
    put(container, order[2]!, 'slot:1');
    put(container, order[2]!, 'slot:1');
    put(container, order[2]!, 'slot:1'); // while Buddy shows, the card is his
    expect(rec.said).toEqual(['fb.try_again', 'fb.shown']);
    expect(target(container, 'slot:2').className).toContain('cue-show');
    act(() => vi.advanceTimersByTime(SHOW_MS));
    expect(byId(container, order[2]!)).toBeNull(); // Buddy put it in
    expect(rec.ends).toEqual([]);
    put(container, order[1]!, 'slot:1');
    expect(rec.ends).toEqual([{ outcome: 'shown', hints: 1, wrongIds: [`${order[2]}>slot:1`, `${order[2]}>slot:1`] }]);
  });
});

it('after a quiet spell, the next item and where it goes wiggle (sort: the first waiting item and its bin; sequence: the first empty slot and its card)', () => {
  const bins = roundOf('healthy-food.sort', 9, 2);
  if (bins.payload.kind !== 'bins') throw new Error('bins');
  const sort = render(<SortIntoBins {...mechanicProps(bins).props} />);
  const [first, second] = bins.payload.items;
  put(sort.container, first!.id, first!.binId);
  act(() => vi.advanceTimersByTime(QUIET.first + QUIET.every));
  expect(byId(sort.container, second!.id)!.querySelector('.option')!.className).toContain('cue-hint');
  expect(target(sort.container, second!.binId).className).toContain('cue-hint');
  sort.unmount();

  const steps = roundOf('good-habits.order', 1, 2);
  if (steps.payload.kind !== 'order') throw new Error('order');
  const seq = render(<Sequence {...mechanicProps(steps).props} />);
  const order = steps.payload.correctOrder;
  put(seq.container, order[0]!, 'slot:0');
  act(() => vi.advanceTimersByTime(QUIET.first + QUIET.every));
  expect(byId(seq.container, order[1]!)!.querySelector('.option')!.className).toContain('cue-hint');
  expect(target(seq.container, 'slot:1').className).toContain('cue-hint');
});
