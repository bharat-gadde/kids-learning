// src/app/audio/music.ts
import type { DanceId } from '../buddy/Buddy';
import { hz, tone, type SynthContext, type Tone } from './synth';

/** Spec §4.5: each dance has its own 8-second music loop. */
export const LOOP_SECONDS = 8;

interface Pattern {
  /** seconds per step */
  step: number;
  /** one MIDI note (or null for a rest) per step, 16 steps = 8 s */
  melody: ReadonlyArray<number | null>;
  bass: ReadonlyArray<number | null>;
  /** a sine is warm on headphones; a triangle's overtones carry on a tablet's small speaker */
  bassType: OscillatorType;
  /** a soft low thump on these steps */
  thumps: readonly number[];
}

const PATTERNS: Record<DanceId, Pattern> = {
  'trunk-twirl': {
    step: 0.5,
    melody: [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 74, null],
    bass: [48, null, null, null, 53, null, null, null, 55, null, null, null, 48, null, null, null],
    bassType: 'sine',
    thumps: [],
  },
  'elephant-stomp': {
    step: 0.5,
    melody: [67, null, 67, 70, 72, null, 70, 67, 65, null, 65, 67, 70, 67, 65, null],
    bass: [55, null, 55, null, 58, null, 58, null, 53, null, 53, null, 55, null, 55, null],
    bassType: 'triangle',
    thumps: [0, 2, 4, 6, 8, 10, 12, 14],
  },
};

export interface Music {
  /** Start a dance's loop (stopping any other). */
  play(dance: DanceId): void;
  stop(): void;
}

/** Dance music, synthesised and looped every 8 s; stop() fades it out at once. */
export function createMusic(context: () => SynthContext | null): Music {
  let master: GainNode | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** notes not yet started: stop() cancels them, so a queued loop never starts under the fade */
  let queued: Array<{ osc: OscillatorNode; at: number }> = [];

  const schedule = (ctx: SynthContext, out: GainNode, p: Pattern, at: number) => {
    const note = (t: Tone) => queued.push({ osc: tone(ctx, out, at, t), at: at + (t.start ?? 0) });
    p.melody.forEach((n, i) => n !== null && note({ freq: hz(n), start: i * p.step, dur: p.step * 0.9, gain: 0.07, type: 'triangle' }));
    p.bass.forEach((n, i) => n !== null && note({ freq: hz(n), start: i * p.step, dur: p.step * 1.8, gain: 0.08, type: p.bassType }));
    p.thumps.forEach((i) => note({ freq: 220, to: 90, start: i * p.step, dur: 0.2, gain: 0.14, type: 'triangle' })); // low enough to thump, high enough for a tablet's speaker
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
        // A late timer (a busy main thread) starts the loop afresh: notes already due would all sound at once.
        at = Math.max(at, ctx.currentTime + 0.05);
        queued = queued.filter((n) => n.at > ctx.currentTime);
        schedule(ctx, out, p, at);
        at += LOOP_SECONDS;
        // Plain calls: as a method of another object, setTimeout throws in browsers ("Illegal invocation").
        timer = setTimeout(loop, (at - ctx.currentTime - 1) * 1000); // queue the next loop a second before this one ends
      };
      loop();
    },
    stop() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      const out = master;
      const notes = queued;
      master = null;
      queued = [];
      if (!out) return;
      const ctx = context();
      if (ctx) {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        for (const n of notes) {
          if (n.at <= ctx.currentTime) continue;
          try {
            n.osc.stop(ctx.currentTime); // the queued loop never starts
          } catch {
            // an older engine allows one stop() per note: that note fades out with the rest
          }
        }
      }
      setTimeout(() => out.disconnect(), 1000); // once the notes still sounding have ended (the bass, 0.95 s)
    },
  };
  return music;
}
