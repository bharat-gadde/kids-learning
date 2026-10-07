// src/app/screens/screens.test.tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Profile, Sticker } from '../../engine/progress/types';
import { pack } from '../pack';
import { Hello, lookOf } from './Hello';
import { islandSpots } from './islands';
import { Setup } from './Setup';
import { StickerBook } from './StickerBook';

const profile = (id: string, name: string, colour = 'pink', accessory = 'bow'): Profile => ({ id, name, level: 'lkg', buddy: { colour, name: 'Gajju', accessory }, createdAt: 1 });

describe('Setup', () => {
  it('needs the child\'s name, offers spoken names for Buddy, and hands over the choices', () => {
    const onDone = vi.fn();
    const spoken: string[] = [];
    render(<Setup onDone={onDone} speakText={(t) => spoken.push(t)} />);
    const go = screen.getByText("Let's play!") as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Child's name"), { target: { value: '  Asha ' } });
    fireEvent.click(screen.getByLabelText('green'));
    fireEvent.click(screen.getByText('Appu'));
    fireEvent.click(screen.getByText('glasses'));
    expect(spoken).toEqual(['Appu']);
    fireEvent.click(go);
    expect(onDone).toHaveBeenCalledWith({ name: 'Asha', buddy: { colour: 'green', name: 'Appu', accessory: 'glasses' } });
    expect(screen.getByText(/add Buddy to the home screen/)).toBeTruthy(); // spec §10: recommended on the first run
  });
});

describe('Hello', () => {
  it('one child: one big Buddy to tap; several: one each; the + is for a grown-up', () => {
    const onStart = vi.fn();
    const onAdd = vi.fn();
    const { unmount } = render(<Hello profiles={[profile('a', 'Asha')]} greeting={null} onStart={onStart} onAddChild={onAdd} />);
    fireEvent.click(screen.getByLabelText("Asha's Gajju"));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    fireEvent.click(screen.getByLabelText('Add a child (grown-ups)'));
    expect(onAdd).toHaveBeenCalledOnce();
    unmount();
    render(<Hello profiles={[profile('a', 'Asha'), profile('b', 'Ravi', 'blue', 'cap')]} greeting={null} onStart={onStart} onAddChild={onAdd} />);
    expect(screen.getAllByRole('button', { name: /Gajju/ })).toHaveLength(2);
  });

  it('uses a safe look for a profile saved with an unknown colour or accessory', () => {
    expect(lookOf(profile('x', 'X', 'teal', 'crown'))).toEqual({ colour: 'grey', accessory: 'cap' });
  });
});

describe('the Map\'s islands', () => {
  it('has five islands with two playable spots each in M1', () => {
    expect(islandSpots(pack).map((i) => `${i.subject}:${i.topics.length}`)).toEqual(['literacy:2', 'phonics:2', 'numeracy:2', 'awareness:2', 'wellness:2']);
  });
});

describe('StickerBook', () => {
  it('opens on the page of the latest sticker, shows each island\'s own, and empty places for more', () => {
    const stickers: Sticker[] = [
      { id: 1, profileId: 'a', at: 1, pictureId: 'objects/cat.svg', source: 'rhyming.match', shiny: false },
      { id: 2, profileId: 'a', at: 2, pictureId: 'feelings/happy.svg', source: 'feelings.tap', shiny: true },
    ];
    const { container } = render(<StickerBook pack={pack} stickers={stickers} onBack={() => {}} />);
    expect(screen.getByLabelText('Feelings Forest').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('.book__sticker.is-shiny')).toHaveLength(1);
    fireEvent.click(screen.getByLabelText('Sound Garden'));
    expect(container.querySelectorAll('.book__sticker:not(.is-empty)')).toHaveLength(1);
    expect(container.querySelectorAll('.book__sticker.is-empty')).toHaveLength(11);
  });
});
