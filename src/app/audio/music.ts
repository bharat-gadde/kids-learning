// src/app/audio/music.ts
import type { DanceId } from '../buddy/Buddy';
import { hz, tone, type SynthContext } from './synth';

/** Spec §4.5: each dance has its own 8-second music loop. */
export const LOOP_SECONDS = 8;

interface Pattern {
  /** seconds per step */
  step: number;
  /** one MIDI note (or null for a rest) per step, 16 steps = 8 s */
  melody: ReadonlyArray<number | null>;
  bass: ReadonlyArray<number | null>;
  /** a soft low thump on these steps */
  thumps: readonly number[];
}

const PATTERNS: Record<DanceId, Pattern> = {
  'trunk-twirl': {
    step: 0.5,
    melody: [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 74, null],
    bass: [48, null, null, null, 53, null, null, null, 55, null, null, null, 48, null, null, null],
    thumps: [],
  },
  'elephant-stomp': {
    step: 0.5,
    melody: [67, null, 67, 70, 72, null, 70, 67, 65, null, 65, 67, 70, 67, 65, null],
    bass: [43, null, 43, null, 46, null, 46, null, 41, null, 41, null, 43, null, 43, null],
    thumps: [0, 2, 4, 6, 8, 10, 12, 14],
  },
};

export interface Music {
  /** Start a dance's loop (stopping any other). */
  play(dance: DanceId): void;
  stop(): void;
}

/** Dance music, synthesised and looped every 8 s; stop() fades it out at once. */
export function createMusic(context: () => SynthContext | null, timers: { set: typeof setTimeout; clear: typeof clearTimeout } = { set: setTimeout, clear: clearTimeout }): Music {
  let master: GainNode | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (ctx: SynthContext, out: GainNode, p: Pattern, at: number) => {
    p.melody.forEach((n, i) => n !== null && tone(ctx, out, at, { freq: hz(n), start: i * p.step, dur: p.step * 0.9, gain: 0.07, type: 'triangle' }));
    p.bass.forEach((n, i) => n !== null && tone(ctx, out, at, { freq: hz(n), start: i * p.step, dur: p.step * 1.8, gain: 0.08 }));
    p.thumps.forEach((i) => tone(ctx, out, at, { freq: 90, to: 50, start: i * p.step, dur: 0.25, gain: 0.18 }));
  };

  const music: Music = {
    play(dance) {
      music.stop();
      const ctx = context();
      if (!ctx || ctx.state !== 'running') return;
      const out = ctx.createGain();
      out.gain.setValueAtTime(1, ctx.currentTime);
      out.connect(ctx.destination);
      master = out;
      const p = PATTERNS[dance];
      let at = ctx.currentTime + 0.05;
      const loop = () => {
        schedule(ctx, out, p, at);
        at += LOOP_SECONDS;
        timer = timers.set(loop, (at - ctx.currentTime - 1) * 1000); // queue the next loop a second before this one ends
      };
      loop();
    },
    stop() {
      if (timer !== null) timers.clear(timer);
      timer = null;
      const out = master;
      master = null;
      if (out) {
        const ctx = context();
        if (ctx) out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        timers.set(() => out.disconnect(), 300);
      }
    },
  };
  return music;
}
