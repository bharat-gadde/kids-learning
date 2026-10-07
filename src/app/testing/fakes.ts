// src/app/testing/fakes.ts
// Test doubles for the app: a speaker and sound effects that record what they were asked to do, and seeded rounds.
import { generateSet } from '../../engine/generator/round';
import { EMPTY_HISTORY, type Level, type Round } from '../../engine/generator/types';
import type { FlowEnd, Reaction } from '../game/useRoundFlow';
import type { MechanicProps } from '../mechanics/types';
import { pack } from '../pack';

export { pack };

/** Round `index` of a template's set made with no history. */
export function roundOf(templateId: string, seed = 1, level: Level = 1, index = 0): Round {
  const template = pack.templates.get(templateId);
  if (!template) throw new Error(`no template ${templateId}`);
  const round = generateSet(pack, template, { seed, level, history: EMPTY_HISTORY })[index];
  if (!round) throw new Error(`no round ${index}`);
  return round;
}

export interface Recorder {
  said: string[];
  words: string[];
  sounds: string[];
  reactions: Reaction[];
  ends: FlowEnd[];
  replays: number;
}

/** Speech that never ends, as a stalled clip or speech engine (nothing may wait on it to take input). */
const stalled = (): Promise<void> => new Promise<void>(() => {});

/** Props for a mechanic under test, and what it did. */
export function mechanicProps(round: Round): { props: MechanicProps; rec: Recorder } {
  const rec: Recorder = { said: [], words: [], sounds: [], reactions: [], ends: [], replays: 0 };
  const props: MechanicProps = {
    round,
    deps: {
      speaker: {
        say: (id) => {
          if (!pack.lines.has(id)) throw new Error(`unknown line ${id}`); // as Speaker.say
          rec.said.push(id);
          return { caption: id, done: stalled() };
        },
        replayPrompt: () => { rec.replays += 1; return stalled(); },
        word: (id) => { rec.words.push(id); return stalled(); },
      },
      sfx: { chime: () => rec.sounds.push('chime'), boop: () => rec.sounds.push('boop'), pop: () => rec.sounds.push('pop') },
    },
    names: { name: 'Asha', buddy: 'Gajju' },
    look: { colour: 'blue', accessory: 'cap' },
    onEnd: (e) => rec.ends.push(e),
    onReact: (r) => rec.reactions.push(r),
  };
  return { props, rec };
}
