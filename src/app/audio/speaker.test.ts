// src/app/audio/speaker.test.ts
import { describe, it, expect } from 'vitest';
import type { SpeakRequest } from '../../engine/audio/manager';
import { readPack } from '../../engine/content/readPackFromDisk';
import { generateSet } from '../../engine/generator/round';
import { EMPTY_HISTORY } from '../../engine/generator/types';
import { fillNames, Speaker, type Voice } from './speaker';
import { UI_LINES } from './uiLines';

const pack = readPack();

class FakeVoice implements Voice {
  said: SpeakRequest[] = [];
  stopped = 0;
  fail = false;
  async speak(req: SpeakRequest) {
    this.said.push(req);
    if (this.fail) throw new Error('no voice');
  }
  stop() { this.stopped += 1; }
}

function speaker(random = Math.random) {
  const voice = new FakeVoice();
  const s = new Speaker(voice, pack, random);
  s.names = { name: 'Asha', buddy: 'Gajju' };
  return { s, voice };
}

describe('fillNames', () => {
  it('fills the child\'s and Buddy\'s names, and says Buddy until one is chosen', () => {
    expect(fillNames('Hi {name}! {buddy} is hungry', { name: 'Asha', buddy: 'Gajju' })).toBe('Hi Asha! Gajju is hungry');
    expect(fillNames('{buddy} is hungry', { name: 'Asha', buddy: '' })).toBe('Buddy is hungry');
  });
});

describe('Speaker', () => {
  it('says a UI line with the names, never the same wording twice running', () => {
    const { s, voice } = speaker();
    const variants: number[] = [];
    for (let i = 0; i < 40; i++) {
      s.say('fb.correct');
      variants.push(voice.said.at(-1)!.variant!);
    }
    expect(new Set(variants).size).toBe(5); // fb.correct has five wordings, and every one comes up
    expect(variants.some((v, i) => i > 0 && v === variants[i - 1])).toBe(false);
    expect(voice.said[0]!.slots).toEqual({ name: 'Asha', buddy: 'Gajju' });
  });

  it('captions the wording it speaks, names filled', () => {
    const { s } = speaker(() => 0);
    expect(s.say('buddy.greet_morning').caption).toBe('Good morning, Asha!');
  });

  it('speaks a round\'s prompt in the generator\'s wording, and replays that prompt rather than the last cheer', async () => {
    const { s, voice } = speaker();
    const round = generateSet(pack, pack.templates.get('counting.give')!, { seed: 3, level: 1, history: EMPTY_HISTORY })[0]!;
    const said = s.prompt(round);
    expect(said.caption).not.toContain('{buddy}');
    expect(said.caption).toContain('Gajju');
    expect(voice.said[0]).toEqual({ lineId: round.prompt.lineId, variant: round.prompt.variant, slots: { ...round.prompt.slots, name: 'Asha', buddy: 'Gajju' } });
    s.say('fb.correct');
    await s.replayPrompt();
    expect(voice.said.at(-1)).toEqual(voice.said[0]);
  });

  it('narrates a scenario once: its narration ends with the prompt\'s question', () => {
    const { s, voice } = speaker();
    const round = generateSet(pack, pack.templates.get('feelings.scene')!, { seed: 1, level: 1, history: EMPTY_HISTORY })[0]!;
    if (round.payload.kind !== 'scenario') throw new Error('expected a scenario');
    const said = s.prompt(round);
    expect(voice.said).toEqual([{ lineId: round.payload.narrationLineId, variant: 0, slots: { name: 'Asha', buddy: 'Gajju' } }]);
    expect(said.caption).toBe('How does Gajju feel?');
  });

  it('has nothing to replay after clearPrompt, and a failed line neither rejects nor throws', async () => {
    const { s, voice } = speaker();
    s.clearPrompt();
    await s.replayPrompt();
    expect(voice.said).toEqual([]);
    voice.fail = true;
    await expect(s.say('fb.correct').done).resolves.toBeUndefined();
  });

  it('rejects an unknown line before speaking', () => {
    const { s, voice } = speaker();
    expect(() => s.say('fb.nope')).toThrow('unknown line fb.nope');
    expect(voice.said).toEqual([]);
  });
});

describe('UI_LINES', () => {
  it('names lines the content has', () => {
    for (const id of Object.values(UI_LINES)) expect(pack.lines.has(id), id).toBe(true);
  });
});
