// src/app/App.test.tsx
// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, AppBoundary, GREETING_MAX_MS, GREETING_MS, yourTurnDue } from './App';
import { UI_LINES } from './audio/uiLines';
import { STORAGE_WAIT_MS } from './game/storage';
import { DANCE_MS, PARTY_MS, STICKER_MS } from './screens/Celebration';
import { playAnyhow, settle, useAppTimers, wait } from './testing/play';
import { testServices } from './testing/services';

beforeEach(() => { useAppTimers(); });
afterEach(() => vi.useRealTimers());

async function setUp(services = testServices()) {
  render(<App services={services} />);
  await settle();
  fireEvent.change(screen.getByLabelText("Child's name"), { target: { value: 'Asha' } });
  fireEvent.click(screen.getByLabelText('pink'));
  fireEvent.click(screen.getByText('Gajju'));
  fireEvent.click(screen.getByText("Let's play!"));
  await settle();
  return services;
}

async function setUpAndStart() {
  const services = await setUp();
  fireEvent.click(screen.getByLabelText("Asha's Gajju"));
  await wait(GREETING_MS);
  return services;
}

describe('App', () => {
  it('first run: set up Buddy, say hello, and the Map opens with a suggestion', async () => {
    const persist = vi.fn(async () => true);
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true }); // jsdom has none
    const services = testServices();
    const unlock = vi.spyOn(services, 'unlockAudio');
    try {
      await setUp(services);
    } finally {
      delete (navigator as { storage?: unknown }).storage;
    }
    expect(persist).toHaveBeenCalledOnce(); // spec §10
    fireEvent.click(screen.getByLabelText("Asha's Gajju"));
    expect(unlock).toHaveBeenCalledOnce(); // inside the tap, before any await (spec §7)
    await wait(GREETING_MS);
    expect(services.voice.said[0]).toMatchObject({ lineId: expect.stringMatching(/^buddy\.greet_/), slots: { name: 'Asha', buddy: 'Gajju' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(document.querySelectorAll('.spot')).toHaveLength(10);
    expect(document.querySelector('.spot.is-suggested')).not.toBeNull();
    expect(services.voice.said.some((r) => r.lineId === 'buddy.suggest')).toBe(true);
  });

  it('a double tap on "Let\'s play!" adds the child once', async () => {
    const services = testServices();
    render(<App services={services} />);
    await settle();
    fireEvent.change(screen.getByLabelText("Child's name"), { target: { value: 'Asha' } });
    fireEvent.click(screen.getByText("Let's play!"));
    fireEvent.click(screen.getByText("Let's play!"));
    await settle();
    expect(await services.db.profiles.count()).toBe(1);
    expect(screen.getAllByRole('button', { name: /^Asha's/ })).toHaveLength(1);
  });

  it('storage with no answer at start-up: a way to try again, not a blank screen, and not setup', async () => {
    const services = testServices();
    vi.spyOn(services.db.profiles, 'orderBy').mockReturnValue({ toArray: () => new Promise(() => {}) } as never);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<App services={services} />);
    await wait(STORAGE_WAIT_MS);
    expect(screen.getByLabelText('Try again')).toBeTruthy();
    expect(screen.queryByLabelText("Child's name")).toBeNull();
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });

  it('storage that fails or gives no answer as the visit opens: the child still reaches the Map, the failures counted (spec §13)', async () => {
    const services = await setUp();
    vi.spyOn(services.db, 'transaction').mockReturnValue(new Promise(() => {}) as never); // the new session: no answer
    vi.spyOn(services.db.unlocks, 'get').mockRejectedValue(new Error('broken')); // the dances Buddy knows
    fireEvent.click(screen.getByLabelText("Asha's Gajju"));
    await wait(STORAGE_WAIT_MS);
    expect(document.querySelector('.map')).not.toBeNull();
    expect(services.storage.failures).toBeGreaterThanOrEqual(2);
  });

  it('the Map opens once the greeting has been heard (its suggestion would cut it off), but waits no longer than GREETING_MAX_MS', async () => {
    const services = await setUp();
    services.voice.hold = true; // the greeting goes on sounding
    fireEvent.click(screen.getByLabelText("Asha's Gajju"));
    await wait(GREETING_MS);
    expect(document.querySelector('.hello')).not.toBeNull();
    await wait(GREETING_MAX_MS - GREETING_MS);
    expect(document.querySelector('.map')).not.toBeNull();
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
    // spec §4.5, every 2nd–3rd set: never fewer than every third, never more than every second
    const turns = services.voice.said.filter((r) => r.lineId === UI_LINES.yourTurn).length;
    expect(turns).toBeGreaterThanOrEqual(Math.floor(topics.length / 3));
    expect(turns).toBeLessThanOrEqual(Math.floor(topics.length / 2));
  }, 120_000);
});

describe('AppBoundary', () => {
  it('a render error anywhere shows a way to try again, not a blank page', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Broken = () => {
      throw new Error('broken');
    };
    render(<AppBoundary><Broken /></AppBoundary>);
    expect(screen.getByLabelText('Try again')).toBeTruthy();
    logged.mockRestore();
  });
});

describe('yourTurnDue', () => {
  it('never on the first set since the last, sometimes on the second, always by the third (spec §4.5)', () => {
    expect(yourTurnDue(1, () => 0)).toBe(false);
    expect(yourTurnDue(2, () => 0.4)).toBe(true);
    expect(yourTurnDue(2, () => 0.6)).toBe(false);
    expect(yourTurnDue(3, () => 0.99)).toBe(true);
  });
});
