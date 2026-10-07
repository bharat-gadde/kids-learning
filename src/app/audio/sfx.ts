// src/app/audio/sfx.ts
import { tone, type SynthContext } from './synth';

/** Sound effects (spec §7): one gentle set, synthesised, so there are no files to license or load. */
export interface Sfx {
  /** Resume the audio context: call it inside a tap, the child's first (spec §7 unlock) and every one after (unlockOnEveryTap). */
  unlock(): void;
  /** a correct answer */
  chime(): void;
  /** a miss: a soft "hmm", never a buzzer (spec §4.4) */
  boop(): void;
  /** an item placed, a tap that counts */
  pop(): void;
  /** a sticker flying to the book */
  whoosh(): void;
  /** confetti */
  sparkle(): void;
}

export function createSfx(context: () => SynthContext | null): Sfx {
  const play = (draw: (ctx: SynthContext, now: number) => void) => {
    const ctx = context();
    if (!ctx || ctx.state !== 'running') return;
    draw(ctx, ctx.currentTime);
  };
  return {
    unlock() {
      const ctx = context();
      if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
    },
    chime: () => play((ctx, now) => {
      tone(ctx, ctx.destination, now, { freq: 1046.5, dur: 0.35, gain: 0.16 });
      tone(ctx, ctx.destination, now, { freq: 1318.5, start: 0.09, dur: 0.45, gain: 0.16 });
    }),
    boop: () => play((ctx, now) => tone(ctx, ctx.destination, now, { freq: 330, to: 262, attack: 0.05, dur: 0.45, gain: 0.1, type: 'triangle' })),
    pop: () => play((ctx, now) => tone(ctx, ctx.destination, now, { freq: 620, to: 920, dur: 0.09, gain: 0.12 })),
    whoosh: () => play((ctx, now) => tone(ctx, ctx.destination, now, { freq: 260, to: 1300, attack: 0.25, dur: 0.45, gain: 0.05, type: 'triangle' })),
    sparkle: () => play((ctx, now) => {
      [1568, 2093, 1760, 2349, 1976, 2637].forEach((f, i) => tone(ctx, ctx.destination, now, { freq: f, start: i * 0.08, dur: 0.18, gain: 0.05 }));
    }),
  };
}

/** What counts as a tap for starting audio: pointerup and touchend on a touch screen, keydown on a keyboard. */
const TAPS = ['pointerup', 'touchend', 'keydown'] as const;

/**
 * Unlock again inside every tap: after a screen lock, an app switch or a call, iOS can leave the context suspended or
 * 'interrupted', and nothing else resumes it. A no-op while the context runs. Returns the unsubscribe.
 */
export function unlockOnEveryTap(sfx: Pick<Sfx, 'unlock'>, doc: EventTarget = document): () => void {
  const unlock = () => sfx.unlock();
  for (const type of TAPS) doc.addEventListener(type, unlock, { capture: true, passive: true });
  return () => {
    for (const type of TAPS) doc.removeEventListener(type, unlock, { capture: true });
  };
}
