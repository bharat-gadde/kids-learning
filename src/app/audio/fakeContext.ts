// src/app/audio/fakeContext.ts
// A stand-in AudioContext for tests: records the notes started on it.
import type { SynthContext } from './synth';

export interface FakeContext extends SynthContext {
  /** a test moves the clock by hand */
  currentTime: number;
  started: Array<{ freq: number; at: number }>;
  /** notes stopped before they started */
  cancelled: number;
  disconnected: number;
  state: string;
}

export function fakeContext(state = 'running'): FakeContext {
  const param = () => ({ value: 0, setValueAtTime() { return this; }, exponentialRampToValueAtTime() { return this; }, setTargetAtTime() { return this; } });
  const ctx = {
    currentTime: 0,
    destination: {} as AudioNode,
    state,
    started: [] as Array<{ freq: number; at: number }>,
    cancelled: 0,
    disconnected: 0,
    createOscillator() {
      let freq = 0;
      let startedAt = 0;
      return {
        type: 'sine',
        frequency: { ...param(), setValueAtTime(v: number) { freq = v; return this; } },
        connect() {},
        start(at: number) { startedAt = at; ctx.started.push({ freq, at }); },
        stop(at: number) { if (at < startedAt) ctx.cancelled += 1; },
      } as unknown as OscillatorNode;
    },
    createGain() {
      return { gain: param(), connect() {}, disconnect() { ctx.disconnected += 1; } } as unknown as GainNode;
    },
    async resume() { ctx.state = 'running'; },
  };
  return ctx;
}
