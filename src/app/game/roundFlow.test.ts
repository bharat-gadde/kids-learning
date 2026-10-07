// src/app/game/roundFlow.test.ts
import { describe, it, expect } from 'vitest';
import { FLOW_START, stepFlow, type FlowEvent, type FlowState } from './roundFlow';

const run = (...events: FlowEvent[]) => events.reduce<{ state: FlowState; effects: string[] }>((acc, e) => {
  const { state, effect } = stepFlow(acc.state, e);
  return { state, effects: [...acc.effects, effect] };
}, { state: FLOW_START, effects: [] });

const miss = (key: string, wrongId = key): FlowEvent => ({ type: 'miss', key, wrongId });
const done: FlowEvent = { type: 'done' };

describe('stepFlow (spec §4.4)', () => {
  it('right before any hint is correct', () => {
    expect(run(done).state).toMatchObject({ outcome: 'correct', hints: 0, wrongIds: [] });
  });

  it('a first miss brings a hint, and right after it is corrected', () => {
    const r = run(miss('round', 'b'), done);
    expect(r.effects).toEqual(['hint', 'end']);
    expect(r.state).toMatchObject({ outcome: 'corrected', hints: 1, wrongIds: ['b'] });
  });

  it('a second miss on the same key: Buddy shows the answer, and the round is shown', () => {
    const r = run(miss('round', 'b'), miss('round', 'p'), done);
    expect(r.effects).toEqual(['hint', 'show', 'end']);
    expect(r.state).toMatchObject({ outcome: 'shown', hints: 1, wrongIds: ['b', 'p'] });
  });

  it('counts misses per item: one miss each on two items is two hints, not a demonstration', () => {
    const r = run(miss('apple@l', 'small'), miss('pear@s', 'big'), done);
    expect(r.effects).toEqual(['hint', 'hint', 'end']);
    expect(r.state).toMatchObject({ outcome: 'corrected', hints: 2 });
  });

  it('counts every key from nought, even a name Object.prototype has', () => {
    expect(run(miss('constructor'), miss('toString'), miss('__proto__')).effects).toEqual(['hint', 'hint', 'hint']);
  });

  it('a wiggle after a quiet spell is a hint: right after it is corrected', () => {
    const r = run({ type: 'wiggle' }, { type: 'wiggle' }, done);
    expect(r.effects).toEqual(['wiggle', 'wiggle', 'end']);
    expect(r.state).toMatchObject({ outcome: 'corrected', hints: 2 });
  });

  it('a wiggle is a hint but not a miss, and never undoes a demonstration; a third miss shows again', () => {
    const wiggle: FlowEvent = { type: 'wiggle' };
    const r = run(wiggle, miss('round', 'b'), wiggle, miss('round', 'p'), miss('round', 'q'), wiggle, done);
    expect(r.effects).toEqual(['wiggle', 'hint', 'wiggle', 'show', 'show', 'wiggle', 'end']);
    expect(r.state).toMatchObject({ outcome: 'shown', hints: 4, wrongIds: ['b', 'p', 'q'] });
  });

  it('ignores everything once the round has ended', () => {
    const r = run(done, miss('round'), { type: 'wiggle' }, done);
    expect(r.effects).toEqual(['end', 'none', 'none', 'none']);
    expect(r.state).toMatchObject({ outcome: 'correct', hints: 0, wrongIds: [] });
  });

  it('never changes the state it is given', () => {
    const before = run(miss('round')).state;
    const copy = JSON.parse(JSON.stringify(before));
    stepFlow(before, miss('round'));
    expect(before).toEqual(copy);
  });
});
