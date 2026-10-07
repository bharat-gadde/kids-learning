// src/app/mechanics/give.test.tsx
// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUE_MS, QUIET, SETTLE_MS, SHOW_MS } from '../game/useRoundFlow';
import { put, target } from '../testing/dom';
import { mechanicProps, roundOf } from '../testing/fakes';
import { GiveToBuddy } from './GiveToBuddy';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const buddyClass = (c: HTMLElement) => c.querySelector('svg.buddy')!.getAttribute('class') ?? '';
const inTray = (c: HTMLElement, id: string) => c.querySelector(`.tray [data-drag-id="${CSS.escape(id)}"]`) !== null;
const givenCopies = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('.drop__inside button')];
const done = (c: HTMLElement) => c.querySelector<HTMLElement>('[aria-label="Done"]')!;
/** the tray items and given copies a cue points at, by id or position */
const cuedTray = (c: HTMLElement, kind: string) =>
  [...c.querySelectorAll(`.tray .cue-${kind}`)].map((el) => el.closest('[data-drag-id]')!.getAttribute('data-drag-id'));
const cuedGiven = (c: HTMLElement, kind: string) => givenCopies(c).map((b) => b.classList.contains(`cue-${kind}`));

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

  it('healthy plate: junk is a "yuck", never a sad face, and stays off; a second, and Buddy puts the healthy ones on', () => {
    const round = roundOf('healthy-food.plate', 4, 1);
    const p = round.payload;
    if (p.kind !== 'give') throw new Error('give');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<GiveToBuddy {...props} />);
    const [chips, drink] = p.items.filter((i) => !p.correctIds.includes(i.id));
    put(container, chips!.id, 'target');
    expect(buddyClass(container)).toContain('buddy--yuck');
    expect(buddyClass(container)).toContain('buddy--neutral'); // spec §4.7: a reaction to the food, never sadness
    expect(inTray(container, chips!.id)).toBe(true); // the wrong one is not taken away, nor put on
    expect(cuedTray(container, 'hint').sort()).toEqual([...p.correctIds].sort()); // the healthy ones wiggle
    act(() => vi.advanceTimersByTime(CUE_MS));
    put(container, drink!.id, 'target'); // another junk food: the round's second miss
    expect(rec.said).toEqual(['fb.try_again', 'fb.shown']);
    expect(buddyClass(container)).toContain('buddy--yuck'); // each junk food gets its "yuck"
    expect(cuedTray(container, 'show').sort()).toEqual([...p.correctIds].sort());
    put(container, chips!.id, 'target'); // while Buddy shows, nothing more counts
    act(() => vi.advanceTimersByTime(SHOW_MS + 450 * p.correctIds.length));
    expect(rec.ends).toEqual([{ outcome: 'shown', hints: 1, wrongIds: [chips!.id, drink!.id] }]);
    const plate = target(container, 'target').querySelector(`img[src$="${p.target.asset!}"]`)!.parentElement!;
    expect(plate.querySelector('svg.buddy')).toBeNull(); // the plate's own box, not the whole drop
    for (const id of p.correctIds) {
      const food = p.items.find((i) => i.id === id)!;
      expect(plate.querySelector(`img[alt="${food.label}"]`)).not.toBeNull(); // on the plate, not beside it
    }
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

  it('give-count: a ✓ bounce is one miss; a second wrong count and Buddy keeps n of the copies given, numbered', () => {
    const round = roundOf('counting.give', 8, 1);
    const p = round.payload;
    if (p.kind !== 'give') throw new Error('give');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<GiveToBuddy {...props} />);
    const n = p.count!;
    const mine = p.items.map((i) => i.id).reverse().slice(0, n + 2); // n + 2, from the end of the tray
    mine.forEach((id) => put(container, id, 'target'));
    fireEvent.click(done(container));
    fireEvent.click(done(container)); // a double tap: the same answer
    expect(rec.said).toEqual(['fb.try_again']);
    expect(cuedGiven(container, 'hint')).toEqual(mine.map(() => true)); // count with me: all of them wiggle
    act(() => vi.advanceTimersByTime(SETTLE_MS + CUE_MS));
    fireEvent.click(done(container)); // the same wrong count again, later: the second miss
    expect(rec.said).toEqual(['fb.try_again', 'fb.shown']);
    expect(cuedGiven(container, 'show')).toEqual(mine.map((_, i) => i < n)); // Buddy points at n of them, not at the wrong count
    fireEvent.click(givenCopies(container)[0]!); // while Buddy shows, no take-back and no ✓
    fireEvent.click(done(container));
    act(() => vi.advanceTimersByTime(SHOW_MS));
    expect(givenCopies(container).map((b) => b.querySelector('.badge')?.textContent)).toEqual(mine.slice(0, n).map((_, i) => String(i + 1)));
    expect(mine.slice(n).every((id) => inTray(container, id))).toBe(true); // the extra ones went back
    expect(rec.ends).toEqual([]);
    act(() => vi.advanceTimersByTime(900));
    expect(rec.ends).toEqual([{ outcome: 'shown', hints: 1, wrongIds: [`n:${n + 2}`, `n:${n + 2}`] }]);
    expect(rec.said).toEqual(['fb.try_again', 'fb.shown']);
  });

  it('give-count: tapping where the copies are, with one picked up, gives it', () => {
    const round = roundOf('counting.give', 8, 1);
    if (round.payload.kind !== 'give') throw new Error('give');
    const { props } = mechanicProps(round);
    const { container, queryByRole } = render(<GiveToBuddy {...props} />);
    const [a, b, c] = round.payload.items;
    expect(queryByRole('button', { name: 'Done' })).toBeNull(); // ✓ comes with the first copy
    put(container, a!.id, 'target');
    expect(queryByRole('button', { name: 'Done' })).not.toBeNull();
    put(container, b!.id, 'target');
    fireEvent.click(container.querySelector(`[data-drag-id="${CSS.escape(c!.id)}"]`)!); // pick one up
    fireEvent.click(givenCopies(container)[0]!); // and tap the pile on Buddy's side
    expect(givenCopies(container)).toHaveLength(3);
    expect([a, b, c].some((i) => inTray(container, i!.id))).toBe(false);
  });

  it('Buddy on the stage cheers a right answer and thinks over a wrong count (the game hides the corner one)', () => {
    const round = roundOf('counting.give', 8, 1);
    const p = round.payload;
    if (p.kind !== 'give') throw new Error('give');
    const { props, rec } = mechanicProps(round);
    const { container } = render(<GiveToBuddy {...props} />);
    p.items.slice(0, p.count! + 1).forEach((i) => put(container, i.id, 'target'));
    act(() => vi.advanceTimersByTime(1300));
    fireEvent.click(done(container));
    expect(buddyClass(container)).toContain('buddy--hmm');
    expect(buddyClass(container)).toContain('buddy--thinking');
    fireEvent.click(givenCopies(container)[0]!);
    act(() => vi.advanceTimersByTime(SETTLE_MS));
    fireEvent.click(done(container));
    expect(buddyClass(container)).toContain('buddy--cheer');
    expect(buddyClass(container)).toContain('buddy--happy');
    expect(rec.reactions).toEqual(['hmm', 'cheer']); // and the game hears them too

    const plate = roundOf('healthy-food.plate', 4, 1);
    if (plate.payload.kind !== 'give') throw new Error('give');
    const view = render(<GiveToBuddy {...mechanicProps(plate).props} />);
    plate.payload.correctIds.forEach((id) => put(view.container, id, 'target'));
    expect(buddyClass(view.container)).toContain('buddy--cheer');
  });

  it('a quiet spell wiggles the healthy foods left; in give-count, Buddy until something is given, then ✓', () => {
    const plate = roundOf('healthy-food.plate', 4, 1);
    if (plate.payload.kind !== 'give') throw new Error('give');
    const [first, ...rest] = plate.payload.correctIds;
    const a = render(<GiveToBuddy {...mechanicProps(plate).props} />);
    put(a.container, first!, 'target');
    act(() => vi.advanceTimersByTime(QUIET.first + QUIET.every));
    expect(cuedTray(a.container, 'hint')).toEqual(rest);
    a.unmount();

    const round = roundOf('counting.give', 8, 1);
    if (round.payload.kind !== 'give') throw new Error('give');
    const { container } = render(<GiveToBuddy {...mechanicProps(round).props} />);
    act(() => vi.advanceTimersByTime(QUIET.first + QUIET.every));
    expect(target(container, 'target').className).toContain('cue-hint');
    act(() => vi.advanceTimersByTime(CUE_MS));
    put(container, round.payload.items[0]!.id, 'target');
    act(() => vi.advanceTimersByTime(QUIET.first + QUIET.every));
    expect(done(container).className).toContain('cue-hint');
    expect(target(container, 'target').className).not.toContain('cue-hint');
  });
});
