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
    act(() => vi.advanceTimersByTime(PARTY_MS));
    expect(document.querySelector('.celebration__sticker')?.className).toContain('is-flying');
    expect(document.querySelector('.celebration__book img')?.getAttribute('src')).toContain('ui/stickers.svg'); // into the book
    act(() => vi.advanceTimersByTime(STICKER_MS));
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

  it('your turn: Buddy shows an action, asks the child to copy it, cheers, and offers "Again?" once', async () => {
    const t = setup(true);
    act(() => vi.advanceTimersByTime(PARTY_MS + STICKER_MS + DANCE_MS));
    expect(t.buddyClass()).toContain('buddy--jump');
    act(() => vi.advanceTimersByTime(DEMO_MS));
    expect(t.said).toEqual(['fb.set_done', 'fb.your_turn']);
    await act(async () => { vi.advanceTimersByTime(YOUR_TURN_MS); });
    expect(t.said.slice(2)).toEqual(['fb.your_turn_cheer', 'fb.your_turn_again']); // asked as the button appears
    fireEvent.click(screen.getByLabelText('Again'));
    expect(screen.queryByLabelText('Again')).toBeNull();
    expect(t.said).toHaveLength(4); // the tap answers it: nothing more is said until Buddy shows the move
    await act(async () => { vi.advanceTimersByTime(DEMO_MS + YOUR_TURN_MS); });
    expect(t.said.slice(4)).toEqual(['fb.your_turn', 'fb.your_turn_cheer']); // no second offer
    expect(screen.queryByLabelText('Again')).toBeNull(); // only once
    act(() => vi.advanceTimersByTime(CHEER_MS));
    expect(t.onDone).toHaveBeenCalledOnce();
  });

  it('a double tap that ends the dance does not skip "your turn"', () => {
    const t = setup(true);
    act(() => vi.advanceTimersByTime(PARTY_MS + STICKER_MS + 1000));
    const buddy = screen.getByRole('button', { name: 'Buddy' });
    fireEvent.click(buddy);
    fireEvent.click(buddy); // lands while Buddy shows the move
    act(() => vi.advanceTimersByTime(DEMO_MS));
    expect(t.said.at(-1)).toBe('fb.your_turn');
    expect(t.onDone).not.toHaveBeenCalled();
  });

  it('tapping Buddy skips "your turn"', () => {
    const t = setup(true);
    act(() => vi.advanceTimersByTime(PARTY_MS + STICKER_MS + DANCE_MS + DEMO_MS));
    fireEvent.click(screen.getByRole('button', { name: 'Buddy' }));
    expect(t.onDone).toHaveBeenCalledOnce();
  });
});
