// src/app/screens/map.test.tsx
// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playContextFor, settle, useAppTimers } from '../testing/play';
import { testServices } from '../testing/services';
import { MapScreen } from './MapScreen';

beforeEach(() => { useAppTimers(); });
afterEach(() => vi.useRealTimers());

describe('MapScreen', () => {
  it('shows every island and spot, points at a suggestion and says so, and plays the spot tapped', async () => {
    const services = testServices();
    const play = await playContextFor(services);
    const onPlay = vi.fn();
    const onStickers = vi.fn();
    render(<MapScreen services={services} play={play} look={{ colour: 'pink', accessory: 'bow' }} stickers={3} onPlay={onPlay} onStickers={onStickers} />);
    await settle();
    expect(screen.getAllByRole('listitem').map((el) => el.getAttribute('aria-label'))).toEqual(['Letter Land', 'Sound Garden', 'Number Hill', 'Our World', 'Feelings Forest']);
    expect(document.querySelectorAll('.spot')).toHaveLength(10);
    expect(document.querySelectorAll('.spot.is-suggested')).toHaveLength(1);
    expect(services.voice.said.map((r) => r.lineId)).toEqual(['buddy.suggest']);
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Counting'));
    expect(onPlay).toHaveBeenCalledWith('counting');
    fireEvent.click(screen.getByLabelText('Sticker book'));
    expect(onStickers).toHaveBeenCalledOnce();
  });
});
