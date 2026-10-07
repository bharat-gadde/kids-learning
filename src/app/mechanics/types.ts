// src/app/mechanics/types.ts
import type { Round } from '../../engine/generator/types';
import type { Names, Speaker } from '../audio/speaker';
import type { Accessory, BuddyColour } from '../buddy/Buddy';
import type { FlowDeps, FlowEnd, Reaction } from '../game/useRoundFlow';

export interface BuddyLook {
  colour: BuddyColour;
  accessory: Accessory;
}

export interface MechanicDeps extends FlowDeps {
  speaker: Pick<Speaker, 'say' | 'replayPrompt' | 'word'>;
}

/** What every mechanic gets: the round (frozen — copy before reordering), what it needs to speak, and where to report. */
export interface MechanicProps {
  round: Round;
  deps: MechanicDeps;
  names: Names;
  look: BuddyLook;
  /** the round ended: its outcome, hints and wrong picks */
  onEnd: (end: FlowEnd) => void;
  /** Buddy in the corner reacts: a cheer, a "hmm", pointing */
  onReact: (reaction: Reaction) => void;
  quiet?: { first: number; every: number };
}
