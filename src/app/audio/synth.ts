// src/app/audio/synth.ts
/** The parts of an AudioContext the synthesised sounds use (a fake in tests). */
export interface SynthContext {
  readonly currentTime: number;
  readonly destination: AudioNode;
  readonly state: string;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  resume(): Promise<void>;
}

export interface Tone {
  /** Hz at the start, and optionally at the end (a slide); above 0: an exponential ramp cannot reach 0 */
  freq: number;
  to?: number;
  /** seconds after `at` */
  start?: number;
  /** seconds to the peak: 12 ms unless a sound swells (a soft "hmm", a whoosh) */
  attack?: number;
  /** seconds, longer than the attack */
  dur: number;
  /** the peak, above 0 */
  gain: number;
  type?: OscillatorType;
}

/** One soft note with a quick attack and a gentle fade (nothing startling, spec §7). */
export function tone(ctx: SynthContext, out: AudioNode, at: number, t: Tone): OscillatorNode {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const t0 = at + (t.start ?? 0);
  osc.type = t.type ?? 'sine';
  osc.frequency.setValueAtTime(t.freq, t0);
  if (t.to !== undefined) osc.frequency.exponentialRampToValueAtTime(t.to, t0 + t.dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(t.gain, t0 + (t.attack ?? 0.012));
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + t.dur);
  osc.connect(env);
  env.connect(out);
  osc.start(t0);
  osc.stop(t0 + t.dur + 0.05);
  return osc;
}

/** MIDI note number → Hz. */
export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** The page's AudioContext, made on first use; null where there is none (tests, old browsers). */
export function lazyContext(): () => SynthContext | null {
  let ctx: SynthContext | null | undefined;
  return () => {
    if (ctx === undefined) {
      const Ctor = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
      try {
        ctx = Ctor ? new Ctor() : null;
      } catch {
        ctx = null; // the browser refused one: the game goes on without effects and music (spec §13)
      }
    }
    return ctx;
  };
}
