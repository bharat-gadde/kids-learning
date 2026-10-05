// src/engine/progress/picker.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from '../content/readPackFromDisk';
import { loadPack, type ContentPack } from '../content/load';
import type { MechanicId, SubjectId } from '../content/schema';
import { mulberry32, type Rng } from '../rng';
import { goalStatus } from './mastery';
import { pickTemplate, suggestTopic, EMPTY_PICKER_HISTORY, type PickerHistory } from './picker';
import type { Attempt, GoalStatus, Outcome } from './types';

const pack = readPack();

let t = 0;
const attempt = (goalId: string, topicId: string, form: string, outcome: Outcome, templateId = 'x'): Attempt => ({
  profileId: 'p', at: ++t, sessionIndex: 1, templateId, topicId, goalId, mechanic: form.split(':')[0] as MechanicId,
  form, seed: 0, level: 1, outcome, hints: 0, durationMs: 1,
});
const formOf = (x: { mechanic: string; itemClass: string }) => `${x.mechanic}:${x.itemClass}`;

/** Attempts that give a goal the status asked for. The forms are made up: goalStatus reads only the attempts. */
function attemptsWithStatus(goalId: string, status: GoalStatus): Attempt[] {
  const times = (n: number, form: string, outcome: Outcome) => Array.from({ length: n }, () => attempt(goalId, 'tp', form, outcome));
  const attempts =
    status === 'new' ? [] :
    status === 'needs-practice' ? times(4, 'tap-the-one:a', 'shown') :
    status === 'shaky' ? [...times(2, 'tap-the-one:a', 'correct'), ...times(2, 'tap-the-one:a', 'shown')] :
    ['a', 'b', 'c'].flatMap((c) => times(4, `tap-the-one:${c}`, 'correct'));
  expect(goalStatus(attempts)).toBe(status);
  return attempts;
}

/** The real pools with only these topics and templates: loadPack parses and indexes, and asks no more of a template. */
function packWith(
  topics: Array<{ id: string; subject: SubjectId; goals: string[] }>,
  templates: Array<{ id: string; topicId: string; goalId: string; mechanic: MechanicId; itemClass?: string }>,
): ContentPack {
  const base = pack.templates.get('big-small.tap')!;
  return loadPack({
    ...pack.raw,
    topics: topics.map((tp) => ({ ...tp, title: tp.id, goals: tp.goals.map((id) => ({ id, title: id })) })),
    templates: templates.map((tpl) => ({ ...structuredClone(base), ...tpl })),
  });
}

/** How many of 1000 evenly spaced values of the picker's one draw give each result: the weights' odds, per mille. */
function odds(pickOnce: (rng: Rng) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < 1000; i++) {
    const key = pickOnce(() => (i + 0.5) / 1000);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/** Each status is clearly likelier than the next (a ratio, so grid rounding cannot pass a tie). */
const expectDescending = (o: Record<string, number>, keys: readonly string[]) =>
  keys.slice(1).forEach((key, i) => expect(o[keys[i]!] ?? 0).toBeGreaterThan(1.2 * (o[key] ?? 0)));

const STATUSES: readonly GoalStatus[] = ['needs-practice', 'shaky', 'new', 'mastered'];

describe('pickTemplate', () => {
  it('throws for a topic without templates', () => {
    expect(() => pickTemplate(pack, 'nope', EMPTY_PICKER_HISTORY, mulberry32(1))).toThrow(/no templates/);
  });

  it('rotates the mechanic when the topic was played with another one last time', () => {
    const history: PickerHistory = { ...EMPTY_PICKER_HISTORY, lastMechanicByTopic: { 'big-small': 'tap-the-one' } };
    for (let s = 0; s < 20; s++) expect(pickTemplate(pack, 'big-small', history, mulberry32(s)).template.id).toBe('big-small.sort');
  });

  it('plays a template with the last mechanic when every template of the topic has it', () => {
    const same = packWith([{ id: 'tp', subject: 'literacy', goals: ['g'] }], [
      { id: 'tp.small', topicId: 'tp', goalId: 'g', mechanic: 'tap-the-one', itemClass: 'letters' },
      { id: 'tp.capital', topicId: 'tp', goalId: 'g', mechanic: 'tap-the-one', itemClass: 'capitals' },
    ]);
    const history: PickerHistory = { ...EMPTY_PICKER_HISTORY, lastMechanicByTopic: { tp: 'tap-the-one' } };
    expect(Object.keys(odds((rng) => pickTemplate(same, 'tp', history, rng).template.id)).sort()).toEqual(['tp.capital', 'tp.small']);
  });

  it('prefers a weaker goal: needs practice, then shaky, then new, then mastered', () => {
    const mechanics: MechanicId[] = ['tap-the-one', 'sort-into-bins', 'drag-to-match', 'give-to-buddy'];
    const four = packWith(
      [{ id: 'tp', subject: 'wellness', goals: [...STATUSES] }],
      STATUSES.map((status, i) => ({ id: status, topicId: 'tp', goalId: status, mechanic: mechanics[i]! })),
    );
    const history: PickerHistory = { ...EMPTY_PICKER_HISTORY, attemptsByGoal: Object.fromEntries(STATUSES.map((s) => [s, attemptsWithStatus(s, s)])) };
    expectDescending(odds((rng) => pickTemplate(four, 'tp', history, rng).template.id), STATUSES);
  });

  it('prefers a template not played lately: in this session or the 3 before it', () => {
    const two = packWith([{ id: 'tp', subject: 'numeracy', goals: ['g'] }], [
      { id: 'a', topicId: 'tp', goalId: 'g', mechanic: 'tap-the-one' },
      { id: 'b', topicId: 'tp', goalId: 'g', mechanic: 'sort-into-bins' },
    ]);
    const oddsOfA = (lastPlayedSession: Record<string, number>) =>
      odds((rng) => pickTemplate(two, 'tp', { ...EMPTY_PICKER_HISTORY, sessionIndex: 10, lastPlayedSession }, rng).template.id).a ?? 0;
    expect(oddsOfA({})).toBe(500);
    expect(oddsOfA({ a: 10 })).toBeLessThan(500);
    expect(oddsOfA({ a: 7 })).toBeLessThan(500);
    expect(oddsOfA({ a: 6 })).toBe(500);
    expect(oddsOfA({ a: 6, b: 9 })).toBeGreaterThan(500);
  });

  it('bridges back to the form that worked after a miss on a new form, both ways round, before rule 5', () => {
    let pairs = 0;
    for (const [topicId, templates] of pack.templatesByTopic) {
      for (const missed of templates) for (const known of templates) {
        if (missed === known || missed.goalId !== known.goalId) continue;
        pairs++;
        const played = [
          attempt(known.goalId, topicId, formOf(known), 'correct', known.id),
          attempt(known.goalId, topicId, formOf(known), 'correct', known.id),
          attempt(known.goalId, topicId, formOf(missed), 'shown', missed.id),
        ].reverse(); // the picker goes by `at`, not by place in the list
        // last mechanic = the missed game's: rule 5 agrees with the bridge. = the known game's (in a richer topic, another
        // goal's game of that mechanic played since): rule 5 would refuse the bridge, and the bridge still wins
        for (const lastMechanic of [missed.mechanic, known.mechanic]) {
          const history: PickerHistory = { ...EMPTY_PICKER_HISTORY, attemptsByGoal: { [known.goalId]: played }, lastMechanicByTopic: { [topicId]: lastMechanic } };
          expect(pickTemplate(pack, topicId, history, mulberry32(1))).toEqual({ template: known, bridgeFrom: formOf(missed) });
        }
      }
    }
    expect(pairs).toBeGreaterThan(0); // big/small tap and sort, counting match and give, each way round
  });

  it('bridges to a known-good form after a miss on a new form of the same goal', () => {
    const mini = loadPack({
      topics: [{ id: 'tp', subject: 'numeracy', title: 'T', goals: [{ id: 'g', title: 'G' }] }],
      objects: [
        { id: 'apple', name: 'apple', lineId: 'obj.apple', asset: 'a.svg', category: 'fruit', tags: { sizePair: true } },
        { id: 'ball', name: 'ball', lineId: 'obj.ball', asset: 'b.svg', category: 'thing', tags: { sizePair: true } },
        { id: 'car', name: 'car', lineId: 'obj.car', asset: 'c.svg', category: 'thing', tags: { sizePair: true } },
        { id: 'cat', name: 'cat', lineId: 'obj.cat', asset: 'd.svg', category: 'animal', tags: { sizePair: true } },
      ],
      glyphs: [], scenes: [{ id: 's', asset: 's.svg', theme: 's' }],
      lines: [{ id: 'obj.apple', variants: ['apple'] }, { id: 'obj.ball', variants: ['ball'] }, { id: 'obj.car', variants: ['car'] }, { id: 'obj.cat', variants: ['cat'] }, { id: 'p', variants: ['Tap the big {target}'] }, { id: 'bin.big', variants: ['big'] }, { id: 'bin.small', variants: ['small'] }],
      scenarios: [], sequences: [],
      templates: [
        { id: 'tap', topicId: 'tp', goalId: 'g', mechanic: 'tap-the-one', itemClass: 'objects', query: { pool: 'objects' }, rule: { kind: 'size', target: 'larger' }, rounds: 2,
          difficulty: [{ options: 2, distractorSimilarity: 'low' }, { options: 3, distractorSimilarity: 'medium' }, { options: 4, distractorSimilarity: 'high' }],
          flavour: { scenes: ['s'], promptLineId: 'p' }, level: 'lkg' },
        { id: 'sort', topicId: 'tp', goalId: 'g', mechanic: 'sort-into-bins', itemClass: 'objects', query: { pool: 'objects' }, rule: { kind: 'size', target: 'larger' }, rounds: 2,
          difficulty: [{ options: 4, distractorSimilarity: 'low' }, { options: 6, distractorSimilarity: 'medium' }, { options: 8, distractorSimilarity: 'high' }],
          bins: [{ id: 'big', label: 'big', lineId: 'bin.big', match: 'large' }, { id: 'small', label: 'small', lineId: 'bin.small', match: 'small' }],
          flavour: { scenes: ['s'], promptLineId: 'p' }, level: 'lkg' },
      ],
    });
    const attempts = [
      attempt('g', 'tp', 'tap-the-one:objects', 'correct', 'tap'),
      attempt('g', 'tp', 'tap-the-one:objects', 'correct', 'tap'),
      attempt('g', 'tp', 'sort-into-bins:objects', 'shown', 'sort'),
    ];
    const history: PickerHistory = { ...EMPTY_PICKER_HISTORY, attemptsByGoal: { g: attempts }, lastMechanicByTopic: { tp: 'sort-into-bins' } };
    const pick = pickTemplate(mini, 'tp', history, mulberry32(1));
    expect(pick.template.id).toBe('tap');
    expect(pick.bridgeFrom).toBe('sort-into-bins:objects');
  });
});

describe('pickTemplate after a bridge', () => {
  it('brings the missed form back next (spec §5.5): rule 5 does it while the topic has two templates', () => {
    let pairs = 0;
    for (const [topicId, templates] of pack.templatesByTopic) {
      for (const missed of templates) for (const known of templates) {
        if (missed === known || missed.goalId !== known.goalId) continue;
        pairs++;
        const form = (x: typeof known) => `${x.mechanic}:${x.itemClass}`;
        const attemptsByGoal = { [known.goalId]: [
          attempt(known.goalId, topicId, form(known), 'correct', known.id),
          attempt(known.goalId, topicId, form(missed), 'shown', missed.id),
          attempt(known.goalId, topicId, form(known), 'correct', known.id), // the bridge set
        ] };
        const history: PickerHistory = { ...EMPTY_PICKER_HISTORY, attemptsByGoal, lastMechanicByTopic: { [topicId]: known.mechanic } };
        for (let s = 0; s < 20; s++) expect(pickTemplate(pack, topicId, history, mulberry32(s))).toEqual({ template: missed, bridgeFrom: null });
      }
    }
    expect(pairs).toBeGreaterThan(0); // big/small tap and sort, counting match and give, each way round
  });
});

describe('suggestTopic', () => {
  it('suggests any spot on the other islands, and none on the island just played (spec §5.4 rule 6)', () => {
    for (const last of pack.topics.values()) {
      const suggested = Object.keys(odds((rng) => suggestTopic(pack, { ...EMPTY_PICKER_HISTORY, lastTopicId: last.id }, rng)));
      const otherIslands = [...pack.topics.values()].filter((tp) => tp.subject !== last.subject).map((tp) => tp.id);
      expect(suggested.sort()).toEqual(otherIslands.sort());
    }
  });

  it('never suggests the topic just played while there is another, even on the same island', () => {
    const templateOf = (topicId: string) => ({ id: `t.${topicId}`, topicId, goalId: `g.${topicId}`, mechanic: 'tap-the-one' as const });
    const island = packWith([{ id: 'a', subject: 'numeracy', goals: ['g.a'] }, { id: 'b', subject: 'numeracy', goals: ['g.b'] }], [templateOf('a'), templateOf('b')]);
    expect(odds((rng) => suggestTopic(island, { ...EMPTY_PICKER_HISTORY, lastTopicId: 'a' }, rng))).toEqual({ b: 1000 });
    const alone = packWith([{ id: 'a', subject: 'numeracy', goals: ['g.a'] }], [templateOf('a')]);
    expect(suggestTopic(alone, { ...EMPTY_PICKER_HISTORY, lastTopicId: 'a' }, mulberry32(1))).toBe('a');
  });

  it('suggests only topics with templates, and throws when there are none', () => {
    const topics = [{ id: 'a', subject: 'numeracy' as const, goals: ['g.a'] }, { id: 'b', subject: 'literacy' as const, goals: ['g.b'] }];
    const half = packWith(topics, [{ id: 't.a', topicId: 'a', goalId: 'g.a', mechanic: 'tap-the-one' }]);
    expect(odds((rng) => suggestTopic(half, EMPTY_PICKER_HISTORY, rng))).toEqual({ a: 1000 });
    expect(() => suggestTopic(packWith(topics, []), EMPTY_PICKER_HISTORY, mulberry32(1))).toThrow(/no topic has templates/);
  });

  it('prefers a topic by its weakest goal: needs practice, then shaky, then new, then mastered', () => {
    const subjects: SubjectId[] = ['wellness', 'awareness', 'literacy', 'phonics'];
    // each topic on its own island; the needs-practice topic's second goal is mastered: the weaker goal counts
    const topics = STATUSES.map((status, i) => ({ id: status, subject: subjects[i]!, goals: status === 'needs-practice' ? [status, 'other'] : [status] }));
    const four = packWith(topics, STATUSES.map((status) => ({ id: `t.${status}`, topicId: status, goalId: status, mechanic: 'tap-the-one' as const })));
    const attemptsByGoal = { ...Object.fromEntries(STATUSES.map((s) => [s, attemptsWithStatus(s, s)])), other: attemptsWithStatus('other', 'mastered') };
    expectDescending(odds((rng) => suggestTopic(four, { ...EMPTY_PICKER_HISTORY, attemptsByGoal }, rng)), STATUSES);
  });
});
