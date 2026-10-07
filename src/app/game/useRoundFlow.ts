// src/app/game/useRoundFlow.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Outcome } from '../../engine/progress/types';
import type { Sfx } from '../audio/sfx';
import type { Speaker } from '../audio/speaker';
import { UI_LINES } from '../audio/uiLines';
import { FLOW_START, stepFlow, type FlowEvent, type FlowState } from './roundFlow';

/** Spec §4.4: after 8 s without input the prompt is repeated, then every 15 s with a hint (the answer wiggles). */
export const QUIET = { first: 8000, every: 15000 };
/** How long a hint or a demonstration stays on what it points at. */
export const CUE_MS = 1800;
/** How long a mechanic lets Buddy point at an answer before placing it or moving on. */
export const SHOW_MS = 1600;

/** What to wiggle (a hint) or point out (Buddy showing the answer). */
export interface Cue {
  readonly ids: readonly string[];
  readonly kind: 'hint' | 'show';
}

export type Reaction = 'cheer' | 'hmm' | 'point';

export interface FlowDeps {
  speaker: Pick<Speaker, 'say' | 'replayPrompt'>;
  sfx: Pick<Sfx, 'chime' | 'boop' | 'pop'>;
}

export interface FlowEnd {
  outcome: Outcome;
  hints: number;
  wrongIds: readonly string[];
}

export interface RoundFlow {
  readonly cue: Cue | null;
  readonly ended: boolean;
  /**
   * A wrong move. 'retry' after the first miss on `key` — a hint shows, and `line` (default "Hmm, try again") is said;
   * 'show' after the second — Buddy points at the answer: put it in place (or end the round) after SHOW_MS.
   */
  miss(key: string, wrongId: string, line?: string): 'retry' | 'show';
  /** A right move that is not the last (an item placed). */
  step(): void;
  /** The answer is complete: the round ends, with a cheer (`line`, default a random fb.correct) unless Buddy showed it. */
  done(line?: string): void;
  /** Any touch: the quiet-spell timer starts again. */
  touch(): void;
}

export interface RoundFlowOptions {
  deps: FlowDeps;
  /** what a hint for `key` points at; for null, what the quiet-spell wiggle points at */
  targets: (key: string | null) => readonly string[];
  onEnd: (end: FlowEnd) => void;
  onReact?: (reaction: Reaction) => void;
  quiet?: { first: number; every: number };
}

/** One round's feedback (spec §4.4), on the stepFlow rules: hints, demonstrations, cheers and the quiet-spell repeats. */
export function useRoundFlow(options: RoundFlowOptions): RoundFlow {
  const opts = useRef(options);
  opts.current = options;
  const state = useRef<FlowState>(FLOW_START);
  const [cue, setCue] = useState<Cue | null>(null);
  const [ended, setEnded] = useState(false);
  const quietTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cueTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const repeats = useRef(0);

  const dispatch = (event: FlowEvent) => {
    const r = stepFlow(state.current, event);
    state.current = r.state;
    return r.effect;
  };

  const point = useCallback((ids: readonly string[], kind: Cue['kind']) => {
    clearTimeout(cueTimer.current);
    setCue({ ids, kind });
    cueTimer.current = setTimeout(() => setCue(null), CUE_MS);
  }, []);

  const arm = useCallback(() => {
    clearTimeout(quietTimer.current);
    const quiet = opts.current.quiet ?? QUIET;
    quietTimer.current = setTimeout(() => {
      if (state.current.outcome !== null) return;
      const o = opts.current;
      void o.deps.speaker.replayPrompt();
      if (repeats.current > 0 && dispatch({ type: 'wiggle' }) === 'wiggle') {
        point(o.targets(null), 'hint');
        o.onReact?.('point');
      }
      repeats.current += 1;
      arm();
    }, repeats.current === 0 ? quiet.first : quiet.every);
  }, [point]);

  const touch = useCallback(() => {
    if (state.current.outcome !== null) return;
    repeats.current = 0;
    arm();
  }, [arm]);

  useEffect(() => {
    arm();
    return () => {
      clearTimeout(quietTimer.current);
      clearTimeout(cueTimer.current);
    };
  }, [arm]);

  const miss = useCallback((key: string, wrongId: string, line?: string): 'retry' | 'show' => {
    const effect = dispatch({ type: 'miss', key, wrongId });
    const o = opts.current;
    if (effect === 'hint') {
      touch();
      o.deps.sfx.boop();
      o.deps.speaker.say(line ?? UI_LINES.tryAgain);
      point(o.targets(key), 'hint');
      o.onReact?.('hmm');
      return 'retry';
    }
    if (effect === 'show') {
      touch();
      o.deps.speaker.say(UI_LINES.shown);
      point(o.targets(key), 'show');
      o.onReact?.('point');
      return 'show';
    }
    return 'retry';
  }, [point, touch]);

  const step = useCallback(() => {
    if (state.current.outcome !== null) return;
    opts.current.deps.sfx.pop();
    touch();
  }, [touch]);

  const done = useCallback((line?: string) => {
    if (dispatch({ type: 'done' }) !== 'end') return;
    clearTimeout(quietTimer.current);
    const { outcome, hints, wrongIds } = state.current;
    const o = opts.current;
    if (outcome !== 'shown') {
      o.deps.sfx.chime();
      o.deps.speaker.say(line ?? UI_LINES.correct);
      o.onReact?.('cheer');
    }
    setEnded(true);
    o.onEnd({ outcome: outcome as Outcome, hints, wrongIds });
  }, []);

  return { cue, ended, miss, step, done, touch };
}

/** Whether a cue points at this id, and how: for a className. */
export function cueClass(cue: Cue | null, id: string): string {
  return cue && cue.ids.includes(id) ? `cue-${cue.kind}` : '';
}
