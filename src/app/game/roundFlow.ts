// src/app/game/roundFlow.ts
import type { Outcome } from '../../engine/progress/types';

/**
 * Spec §4.4's feedback rules for one round, as data. Misses are counted per key: 'round' where the round has one answer
 * or one set of answers (tap, tap-all, give, scenes), the item where each item has its own place (sort, match,
 * sequence). The first miss on a key brings a hint; the second, Buddy showing the answer.
 */
export interface FlowState {
  readonly misses: Readonly<Record<string, number>>;
  /** hints shown: one per first miss, one per wiggle after a quiet spell (a repeated prompt is not a hint) */
  readonly hints: number;
  /** a hint has pointed at an answer, so what follows is `corrected` at best */
  readonly hinted: boolean;
  /** Buddy has shown an answer, so the round is `shown` */
  readonly shown: boolean;
  /** what the child picked wrongly, in order */
  readonly wrongIds: readonly string[];
  /** set when the round ends */
  readonly outcome: Outcome | null;
}

export const FLOW_START: FlowState = Object.freeze({ misses: Object.freeze({}), hints: 0, hinted: false, shown: false, wrongIds: Object.freeze([]), outcome: null });

export type FlowEvent =
  | { type: 'miss'; key: string; wrongId: string }
  | { type: 'wiggle' }
  | { type: 'done' };

/** What an event calls for: a hint, a demonstration, a quiet-spell wiggle, the round's end — or nothing, once it has ended. */
export type FlowEffect = 'hint' | 'show' | 'wiggle' | 'end' | 'none';

export function stepFlow(state: FlowState, event: FlowEvent): { state: FlowState; effect: FlowEffect } {
  if (state.outcome !== null) return { state, effect: 'none' };
  switch (event.type) {
    case 'miss': {
      const n = (state.misses[event.key] ?? 0) + 1;
      const next = { ...state, misses: { ...state.misses, [event.key]: n }, wrongIds: [...state.wrongIds, event.wrongId] };
      return n === 1
        ? { state: { ...next, hints: state.hints + 1, hinted: true }, effect: 'hint' }
        : { state: { ...next, shown: true }, effect: 'show' };
    }
    case 'wiggle':
      return { state: { ...state, hints: state.hints + 1, hinted: true }, effect: 'wiggle' };
    case 'done':
      return { state: { ...state, outcome: state.shown ? 'shown' : state.hinted ? 'corrected' : 'correct' }, effect: 'end' };
  }
}
