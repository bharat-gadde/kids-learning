// src/engine/progress/picker.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from '../content/readPackFromDisk';
import { loadPack } from '../content/load';
import { mulberry32 } from '../rng';
import { pickTemplate, suggestTopic, EMPTY_PICKER_HISTORY, type PickerHistory } from './picker';
import type { Attempt, Outcome } from './types';

const pack = readPack();

let t = 0;
const attempt = (goalId: string, topicId: string, form: string, outcome: Outcome, templateId = 'x'): Attempt => ({
  profileId: 'p', at: ++t, sessionIndex: 1, templateId, topicId, goalId, mechanic: 'tap-the-one',
  form, seed: 0, level: 1, outcome, hints: 0, durationMs: 1,
});

describe('pickTemplate', () => {
  it('throws for a topic without templates', () => {
    expect(() => pickTemplate(pack, 'nope', EMPTY_PICKER_HISTORY, mulberry32(1))).toThrow(/no templates/);
  });

  it('rotates the mechanic when the topic was played with another one last time', () => {
    const history: PickerHistory = { ...EMPTY_PICKER_HISTORY, lastMechanicByTopic: { 'big-small': 'tap-the-one' } };
    for (let s = 0; s < 20; s++) expect(pickTemplate(pack, 'big-small', history, mulberry32(s)).template.id).toBe('big-small.sort');
  });

  it('favours templates whose goal needs practice', () => {
    // feelings has two goals: naming a face (feelings.tap) and reading a scene (feelings.scene)
    const weak = Array.from({ length: 6 }, () => attempt('feelings.read', 'feelings', 'scene-then-choose:scenes', 'shown'));
    const strong = [
      ...Array.from({ length: 4 }, () => attempt('feelings.name', 'feelings', 'tap-the-one:faces', 'correct')),
      ...Array.from({ length: 4 }, () => attempt('feelings.name', 'feelings', 'give-to-buddy:faces', 'correct')),
      ...Array.from({ length: 4 }, () => attempt('feelings.name', 'feelings', 'sort-into-bins:faces', 'correct')),
    ];
    const history: PickerHistory = { ...EMPTY_PICKER_HISTORY, attemptsByGoal: { 'feelings.read': weak, 'feelings.name': strong } };
    let scenes = 0;
    for (let s = 0; s < 200; s++) if (pickTemplate(pack, 'feelings', history, mulberry32(s)).template.id === 'feelings.scene') scenes++;
    expect(scenes).toBeGreaterThan(140);
  });

  it('bridges between the big/small games, which share a goal', () => {
    const tap = pack.templates.get('big-small.tap')!;
    const sort = pack.templates.get('big-small.sort')!;
    const played = [
      attempt(tap.goalId, 'big-small', 'tap-the-one:objects', 'correct', tap.id),
      attempt(tap.goalId, 'big-small', 'tap-the-one:objects', 'correct', tap.id),
      attempt(sort.goalId, 'big-small', 'sort-into-bins:objects', 'shown', sort.id),
    ];
    const attemptsByGoal: Record<string, Attempt[]> = {};
    for (const a of played) (attemptsByGoal[a.goalId] ??= []).push(a);
    const history: PickerHistory = { ...EMPTY_PICKER_HISTORY, attemptsByGoal, lastMechanicByTopic: { 'big-small': 'sort-into-bins' } };
    const pick = pickTemplate(pack, 'big-small', history, mulberry32(1));
    expect(pick.template.id).toBe('big-small.tap');
    expect(pick.bridgeFrom).toBe('sort-into-bins:objects');
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
  it('never suggests the topic just played', () => {
    for (let s = 0; s < 30; s++) expect(suggestTopic(pack, { ...EMPTY_PICKER_HISTORY, lastTopicId: 'feelings' }, mulberry32(s))).not.toBe('feelings');
  });

  it('leans toward a different subject than the last suggestion', () => {
    let numeracy = 0;
    for (let s = 0; s < 200; s++) {
      const topic = pack.topics.get(suggestTopic(pack, { ...EMPTY_PICKER_HISTORY, lastSuggestedSubject: 'numeracy' }, mulberry32(s)))!;
      if (topic.subject === 'numeracy') numeracy++;
    }
    expect(numeracy).toBeLessThan(40); // 2 of 10 topics are numeracy; with the ×2 boost on others they should land well under 20%
  });
});
