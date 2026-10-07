// src/app/mechanics/give.test.tsx
// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { put } from '../testing/dom';
import { mechanicProps, roundOf } from '../testing/fakes';
import { GiveToBuddy } from './GiveToBuddy';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('GiveToBuddy', () => {
  it('healthy plate: the healthy foods go on, junk gets a "yuck" and a hint', () => {
    const round = roundOf('healthy-food.plate', 4, 1);
    const p = round.payload;
    if (p.kind !== 'give') throw new Error('give');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<GiveToBuddy {...props} />);
    const junk = p.items.find((i) => !p.correctIds.includes(i.id))!;
    put(container, junk.id, 'target');
    expect(rec.said).toEqual(['fb.try_again']);
    for (const id of p.correctIds) put(container, id, 'target');
    expect(rec.ends).toEqual([{ outcome: 'corrected', hints: 1, wrongIds: [junk.id] }]);
  });

  it('a second give soon after the first gets its own yum, kept until 1.2 s after it', () => {
    const round = roundOf('counting.give', 8, 1);
    if (round.payload.kind !== 'give') throw new Error('give');
    const { props } = mechanicProps(round);
    const { container } = render(<GiveToBuddy {...props} />);
    const [a, b] = round.payload.items;
    put(container, a!.id, 'target');
    const first = container.querySelector('svg.buddy');
    act(() => vi.advanceTimersByTime(800));
    put(container, b!.id, 'target');
    const second = container.querySelector('svg.buddy');
    expect(second).not.toBe(first); // a new Buddy: the nod plays again
    act(() => vi.advanceTimersByTime(600)); // past the first give's 1.2 s
    expect(container.querySelector('svg.buddy')!.getAttribute('class')).toContain('buddy--yum');
    act(() => vi.advanceTimersByTime(700));
    expect(container.querySelector('svg.buddy')!.getAttribute('class')).toContain('buddy--idle');
  });

  it('give-count: any n copies and ✓ is right first time', () => {
    const round = roundOf('counting.give', 8, 1);
    if (round.payload.kind !== 'give') throw new Error('give');
    const { props, rec } = mechanicProps(round);
    const { container, getByLabelText } = render(<GiveToBuddy {...props} />);
    const n = round.payload.count!;
    round.payload.items.slice(-n).forEach((i) => put(container, i.id, 'target')); // not the ids correctIds suggests
    fireEvent.click(getByLabelText('Done'));
    expect(rec.ends).toEqual([{ outcome: 'correct', hints: 0, wrongIds: [] }]);
  });

  it('give-count: a wrong count is a miss that numbers what was given; taking one back fixes it', () => {
    const round = roundOf('counting.give', 8, 1);
    if (round.payload.kind !== 'give') throw new Error('give');
    const { props, rec } = mechanicProps(round);
    const { container, getByLabelText } = render(<GiveToBuddy {...props} />);
    const n = round.payload.count!;
    const extra = round.payload.items.slice(0, n + 1);
    extra.forEach((i) => put(container, i.id, 'target'));
    fireEvent.click(getByLabelText('Done'));
    expect(rec.said).toEqual(['fb.try_again']);
    expect(container.querySelectorAll('.badge')).toHaveLength(n + 1);
    fireEvent.click(container.querySelector('.drop__inside button')!); // take one back
    fireEvent.click(getByLabelText('Done'));
    expect(rec.ends).toEqual([{ outcome: 'corrected', hints: 1, wrongIds: [`n:${n + 1}`] }]);
  });
});
