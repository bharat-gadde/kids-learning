// src/app/App.test.tsx
// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, GREETING_MS, yourTurnDue } from './App';
import { DANCE_MS, PARTY_MS, STICKER_MS } from './screens/Celebration';
import { playAnyhow, settle, useAppTimers, wait } from './testing/play';
import { testServices } from './testing/services';

beforeEach(() => { useAppTimers(); });
afterEach(() => vi.useRealTimers());

async function setUpAndStart() {
  const services = testServices();
  render(<App services={services} />);
  await settle();
  fireEvent.change(screen.getByLabelText("Child's name"), { target: { value: 'Asha' } });
  fireEvent.click(screen.getByLabelText('pink'));
  fireEvent.click(screen.getByText('Gajju'));
  fireEvent.click(screen.getByText("Let's play!"));
  await settle();
  fireEvent.click(screen.getByLabelText("Asha's Gajju"));
  await wait(GREETING_MS);
  return services;
}

describe('App', () => {
  it('first run: set up Buddy, say hello, and the Map opens with a suggestion', async () => {
    const services = await setUpAndStart();
    expect(services.voice.said[0]).toMatchObject({ lineId: expect.stringMatching(/^buddy\.greet_/), slots: { name: 'Asha', buddy: 'Gajju' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(document.querySelectorAll('.spot')).toHaveLength(10);
    expect(document.querySelector('.spot.is-suggested')).not.toBeNull();
    expect(services.voice.said.some((r) => r.lineId === 'buddy.suggest')).toBe(true);
  });

  it('plays a whole set: every round recorded, the set\'s result, a sticker, a dance, then the Map again', async () => {
    const services = await setUpAndStart();
    fireEvent.click(screen.getByLabelText('Feelings'));
    await settle();
    expect(await playAnyhow()).toBe(true);
    await wait(PARTY_MS + STICKER_MS + DANCE_MS + 1000);
    expect(document.querySelector('.map')).not.toBeNull();
    expect(document.querySelector('.map__count')?.textContent).toBe('1');
    expect(services.danced).toHaveLength(1);
    const attempts = await services.db.attempts.toArray();
    const sets = await services.db.setResults.toArray();
    expect(attempts.length).toBe(sets[0]!.total);
    expect(sets).toHaveLength(1);
    expect(sets[0]!.correct).toBe(attempts.filter((a) => a.outcome === 'correct').length);
    expect(await services.db.stickers.count()).toBe(1);
  }, 30_000);

  it('the Home button leaves a set: its rounds stay recorded, but it has no result and earns no sticker', async () => {
    const services = await setUpAndStart();
    fireEvent.click(screen.getByLabelText('Letters A–Z'));
    await settle();
    const right = () => [...document.querySelectorAll<HTMLElement>('.stage button.option')];
    for (let i = 0; i < 6 && (await services.db.attempts.count()) < 1; i++) {
      fireEvent.click(right()[0]!);
      await wait(1800);
    }
    fireEvent.click(screen.getByLabelText('Home'));
    await settle();
    expect(document.querySelector('.map')).not.toBeNull();
    expect(await services.db.attempts.count()).toBeGreaterThan(0);
    expect(await services.db.setResults.count()).toBe(0);
    expect(await services.db.stickers.count()).toBe(0);
  }, 30_000);

  it('plays every topic on the Map to the end', async () => {
    const services = await setUpAndStart();
    const topics = [...services.pack.topics.values()];
    for (const topic of topics) {
      fireEvent.click(screen.getByLabelText(topic.title));
      await settle();
      expect(await playAnyhow(), topic.id).toBe(true);
      await wait(PARTY_MS + STICKER_MS + DANCE_MS + 20_000); // "your turn" may follow the dance
      expect(document.querySelector('.map'), topic.id).not.toBeNull();
    }
    expect(await services.db.setResults.count()).toBe(topics.length);
    expect(await services.db.stickers.count()).toBe(topics.length);
  }, 120_000);
});

describe('yourTurnDue', () => {
  it('never on the first set since the last, sometimes on the second, always by the third (spec §4.5)', () => {
    expect(yourTurnDue(1, () => 0)).toBe(false);
    expect(yourTurnDue(2, () => 0.4)).toBe(true);
    expect(yourTurnDue(2, () => 0.6)).toBe(false);
    expect(yourTurnDue(3, () => 0.99)).toBe(true);
  });
});
