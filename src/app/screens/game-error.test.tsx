// src/app/screens/game-error.test.tsx
// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { playContextFor, settle, useAppTimers } from '../testing/play';
import { testServices } from '../testing/services';
import { GameScreen } from './GameScreen';

vi.mock('../mechanics/Mechanic', () => ({
  Mechanic: () => {
    throw new Error('a mechanic broke');
  },
}));

beforeEach(() => { useAppTimers(); });
afterEach(() => vi.useRealTimers());

it('a mechanic that throws ends the set and goes back to the Map (spec §13)', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const services = testServices();
  const play = await playContextFor(services);
  const onLeave = vi.fn();
  render(<GameScreen services={services} play={play} look={{ colour: 'grey', accessory: 'cap' }} names={{ name: 'Asha', buddy: '' }} topicId="letters" dances={[]} yourTurn={false} onLeave={onLeave} onFinished={() => {}} />);
  await settle();
  expect(onLeave).toHaveBeenCalledOnce();
  errors.mockRestore();
});
