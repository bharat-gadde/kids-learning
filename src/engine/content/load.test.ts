// src/engine/content/load.test.ts
import { describe, it, expect } from 'vitest';
import { loadPack, ContentError } from './load';

const base = {
  topics: [{ id: 't1', subject: 'numeracy', title: 'T', goals: [{ id: 'g1', title: 'G' }] }],
  objects: [{ id: 'apple', name: 'apple', lineId: 'obj.apple', asset: 'objects/apple.svg', category: 'fruit' }],
  glyphs: [],
  scenes: [{ id: 'garden', asset: 'scenes/garden.svg', theme: 'garden' }],
  lines: [{ id: 'obj.apple', variants: ['apple'] }],
  scenarios: [],
  sequences: [],
  templates: [],
};

describe('loadPack', () => {
  it('indexes collections by id and goals by id with their topic', () => {
    const pack = loadPack(base);
    expect(pack.objects.get('apple')?.category).toBe('fruit');
    expect(pack.goals.get('g1')?.topicId).toBe('t1');
    expect(pack.templatesByTopic.get('t1')).toEqual([]);
  });

  it('throws a ContentError with a readable message on schema errors', () => {
    expect(() => loadPack({ ...base, objects: [{ id: 'x' }] })).toThrow(ContentError);
  });

  it('rejects duplicate ids', () => {
    expect(() => loadPack({ ...base, objects: [base.objects[0], base.objects[0]] })).toThrow(/duplicate object id: apple/);
  });
});
