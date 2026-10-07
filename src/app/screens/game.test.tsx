// src/app/screens/game.test.tsx
// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSet } from '../../engine/generator/round';
import { EMPTY_HISTORY } from '../../engine/generator/types';
import { recordAttempt } from '../../engine/progress/db';
import { attemptFromRound } from '../../engine/progress/history';
import { WATCH_MS } from '../scenario/vignettes';
import { playAnyhow, playContextFor, settle, useAppTimers, wait } from '../testing/play';
import { testServices } from '../testing/services';
import { DANCE_MS, PARTY_MS, STICKER_MS } from './Celebration';
import { BRIDGE_MAX_MS, GameScreen, NEXT_MS, REACTION_NEXT_MS } from './GameScreen';

beforeEach(() => { useAppTimers(); });
afterEach(() => vi.useRealTimers());

async function setup(topicId: string, before?: (play: Awaited<ReturnType<typeof playContextFor>>) => Promise<void>, holdVoice = false) {
  const services = testServices();
  const play = await playContextFor(services);
  await before?.(play);
  services.voice.hold = holdVoice;
  const onFinished = vi.fn();
  const onLeave = vi.fn();
  const { unmount } = render(<GameScreen services={services} play={play} look={{ colour: 'pink', accessory: 'bow' }} names={{ name: 'Asha', buddy: 'Gajju' }} topicId={topicId} dances={['elephant-stomp']} yourTurn={false} onLeave={onLeave} onFinished={onFinished} />);
  await settle();
  return { services, play, onFinished, onLeave, unmount };
}

describe('GameScreen', () => {
  it('plays a set to the end: each round recorded, the set\'s result, a sticker, the celebration', async () => {
    const t = await setup('good-habits');
    expect(screen.getByLabelText('Hear it again')).toBeTruthy();
    expect(await playAnyhow()).toBe(true);
    await wait(PARTY_MS + STICKER_MS + DANCE_MS + 500);
    expect(t.onFinished).toHaveBeenCalledOnce();
    await t.services.writes.idle();
    const sets = await t.services.db.setResults.toArray();
    expect(sets).toHaveLength(1);
    expect(await t.services.db.attempts.count()).toBe(sets[0]!.total);
    expect(await t.services.db.stickers.count()).toBe(1);
    expect(t.services.danced).toEqual(['elephant-stomp']);
  }, 30_000);

  it('fills a progress dot as each round ends', async () => {
    await setup('letters');
    const dots = () => document.querySelectorAll('.progress-dots__dot.is-done').length;
    expect(dots()).toBe(0);
    const right = [...document.querySelectorAll<HTMLElement>('.stage button.option')];
    for (const b of right) fireEvent.click(b); // one of them is right; the round ends either way within two misses
    await wait(2000);
    expect(dots()).toBe(1);
  });

  it('says the bridge line, captioned, before the first prompt when the set bridges back to a familiar game (spec §5.5)', async () => {
    const t = await setup('big-small', async (play) => {
      const tap = generateSet(play.pack, play.pack.templates.get('big-small.tap')!, { seed: 1, level: 1, history: EMPTY_HISTORY })[0]!;
      const sort = generateSet(play.pack, play.pack.templates.get('big-small.sort')!, { seed: 2, level: 1, history: EMPTY_HISTORY })[0]!;
      const base = { profileId: play.profileId, sessionIndex: play.sessionIndex, hints: 0, durationMs: 1 };
      await recordAttempt(play.db, attemptFromRound(tap, { ...base, at: 1, outcome: 'correct' }));
      await recordAttempt(play.db, attemptFromRound(sort, { ...base, at: 2, outcome: 'shown' }));
    }, true);
    expect(t.services.voice.said.map((r) => r.lineId)).toEqual(['buddy.bridge']); // the prompt waits for it
    expect(screen.getByText("Remember how you did this before? Let's do it that way again!")).toBeTruthy();
    act(() => t.services.voice.release());
    await settle();
    expect(t.services.voice.said[1]?.lineId).toBe('prompt.tap_big');
  });

  it('starts the first round anyway when the bridge line never ends (a stalled voice)', async () => {
    const t = await setup('big-small', async (play) => {
      const tap = generateSet(play.pack, play.pack.templates.get('big-small.tap')!, { seed: 1, level: 1, history: EMPTY_HISTORY })[0]!;
      const sort = generateSet(play.pack, play.pack.templates.get('big-small.sort')!, { seed: 2, level: 1, history: EMPTY_HISTORY })[0]!;
      const base = { profileId: play.profileId, sessionIndex: play.sessionIndex, hints: 0, durationMs: 1 };
      await recordAttempt(play.db, attemptFromRound(tap, { ...base, at: 1, outcome: 'correct' }));
      await recordAttempt(play.db, attemptFromRound(sort, { ...base, at: 2, outcome: 'shown' }));
    }, true);
    expect(t.services.voice.said.map((r) => r.lineId)).toEqual(['buddy.bridge']);
    expect(document.querySelectorAll('.option')).toHaveLength(0); // nothing to tap while Buddy bridges
    await wait(BRIDGE_MAX_MS);
    expect(t.services.voice.said[1]?.lineId).toBe('prompt.tap_big');
    expect(document.querySelectorAll('.option').length).toBeGreaterThan(0); // the options come with the first prompt
  });

  it('forgets its prompt when it goes, so the next set\'s 🔊 has nothing stale to replay', async () => {
    const t = await setup('letters');
    const said = t.services.voice.said.length;
    expect(said).toBeGreaterThan(0);
    t.unmount();
    await t.services.speaker.replayPrompt();
    expect(t.services.voice.said).toHaveLength(said);
  });

  it('after a kindness scene, lets its reaction be heard before the next scene\'s narration', async () => {
    const t = await setup('kind-fair');
    const lines = () => t.services.voice.said.map((r) => r.lineId);
    const scene = [...t.services.pack.scenarios.values()].find((s) => s.narrationLineId === lines()[0]);
    const kind = t.services.pack.objects.get(scene?.choices.find((c) => c.correct)?.objectId ?? '');
    if (!kind) throw new Error(`no kind choice for ${lines()[0]}`);
    await wait(WATCH_MS);
    fireEvent.click(screen.getByLabelText(kind.name));
    expect(lines().at(-1)).toBe('react.kind');
    await wait(NEXT_MS + 400);
    expect(lines().at(-1)).toBe('react.kind'); // not cut off by the next narration
    await wait(REACTION_NEXT_MS - NEXT_MS);
    expect(lines().at(-1)).toMatch(/^sc\./); // the next scene
  });

  it('the Home button leaves: the rounds played stay recorded, with no result and no sticker', async () => {
    const t = await setup('feelings');
    expect(await t.services.db.setResults.count()).toBe(0);
    fireEvent.click(screen.getByLabelText('Home'));
    expect(t.onLeave).toHaveBeenCalledOnce();
    await t.services.writes.idle();
    expect(await t.services.db.setResults.count()).toBe(0);
    expect(await t.services.db.stickers.count()).toBe(0);
  });
});
