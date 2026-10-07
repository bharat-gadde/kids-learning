// src/app/screens/celebration.test.tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Celebration, CHEER_MS, DANCE_MS, DEMO_MS, PARTY_MS, STICKER_MS, YOUR_TURN_MS } from './Celebration';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(yourTurn: boolean) {
  const said: string[] = [];
  const music: string[] = [];
  const onDone = vi.fn();
  const services = {
    speaker: { say: (id: string) => { said.push(id); return { caption: id, done: Promise.resolve() }; } },
    sfx: { chime() {}, sparkle() {}, whoosh() {} },
    music: { play: (d: string) => music.push(d), stop: () => music.push('stop') },
    random: () => 0,
  } as never;
  render(<Celebration services={services} look={{ colour: 'blue', accessory: 'cap' }} sticker={{ pictureId: 'objects/cat.svg', shiny: true }} dances={['trunk-twirl', 'elephant-stomp']} yourTurn={yourTurn} onDone={onDone} />);
  const buddyClass = () => screen.getByRole('img', { name: 'Buddy' }).getAttribute('class') ?? '';
  return { said, music, onDone, buddyClass };
}

describe('Celebration', () => {
  it('cheers, flies the sticker to the book, dances its 8-second loop, and is done', () => {
    const t = setup(false);
    expect(t.said).toEqual(['fb.set_done']);
    act(() => vi.advanceTimersByTime(PARTY_MS + STICKER_MS));
    expect(t.music).toEqual(['trunk-twirl']);
    expect(t.buddyClass()).toContain('buddy--trunk-twirl');
    act(() => vi.advanceTimersByTime(DANCE_MS));
    expect(t.onDone).toHaveBeenCalledOnce();
  });

  it('a tap during the dance moves on; nothing fires twice after it', () => {
    const t = setup(false);
    act(() => vi.advanceTimersByTime(PARTY_MS + STICKER_MS + 1000));
    fireEvent.click(screen.getByRole('button', { name: 'Buddy' }));
    act(() => vi.advanceTimersByTime(60_000));
    expect(t.onDone).toHaveBeenCalledOnce();
  });

  it('your turn: Buddy shows an action, asks the child to copy it, cheers, and offers "Again?" once', () => {
    const t = setup(true);
    act(() => vi.advanceTimersByTime(PARTY_MS + STICKER_MS + DANCE_MS));
    expect(t.buddyClass()).toContain('buddy--jump');
    act(() => vi.advanceTimersByTime(DEMO_MS));
    expect(t.said).toEqual(['fb.set_done', 'fb.your_turn']);
    act(() => vi.advanceTimersByTime(YOUR_TURN_MS));
    expect(t.said.at(-1)).toBe('fb.your_turn_cheer');
    fireEvent.click(screen.getByLabelText('Again'));
    expect(screen.queryByLabelText('Again')).toBeNull();
    act(() => vi.advanceTimersByTime(DEMO_MS + YOUR_TURN_MS));
    expect(screen.queryByLabelText('Again')).toBeNull(); // only once
    act(() => vi.advanceTimersByTime(CHEER_MS));
    expect(t.onDone).toHaveBeenCalledOnce();
  });

  it('tapping Buddy skips "your turn"', () => {
    const t = setup(true);
    act(() => vi.advanceTimersByTime(PARTY_MS + STICKER_MS + DANCE_MS + DEMO_MS));
    fireEvent.click(screen.getByRole('button', { name: 'Buddy' }));
    expect(t.onDone).toHaveBeenCalledOnce();
  });
});
