// src/engine/content/load.test.ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { loadPack, ContentError } from './load';
import { readRawPack } from './readPackFromDisk';

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
const t2 = { id: 't2', subject: 'literacy', title: 'T2', goals: [{ id: 'g2', title: 'G2' }] };
const tpl = (id: string, topicId: string) => ({
  id, topicId, goalId: topicId === 't1' ? 'g1' : 'g2', mechanic: 'tap-the-one', itemClass: 'objects',
  query: { pool: 'objects' }, rule: { kind: 'named' }, rounds: 2,
  difficulty: [{ options: 2, distractorSimilarity: 'low' }, { options: 3, distractorSimilarity: 'medium' }, { options: 4, distractorSimilarity: 'high' }],
  flavour: { scenes: ['garden'], promptLineId: 'obj.apple' }, level: 'lkg',
});

describe('loadPack', () => {
  it('indexes collections by id and goals by id with their topic', () => {
    const pack = loadPack(base);
    expect(pack.objects.get('apple')?.category).toBe('fruit');
    expect(pack.goals.get('g1')?.topicId).toBe('t1');
    expect(pack.templatesByTopic.get('t1')).toEqual([]);
  });

  it('throws a ContentError whose message names the path and the item', () => {
    const bad = { ...base, objects: [{ id: 'x' }] };
    expect(() => loadPack(bad)).toThrow(ContentError);
    expect(() => loadPack(bad)).toThrow(/→ at objects\[0\]\.name/);
    expect(() => loadPack(bad)).toThrow(/\(in objects "x"\)/);
  });

  it('rejects duplicate ids', () => {
    expect(() => loadPack({ ...base, objects: [base.objects[0], base.objects[0]] })).toThrow(/duplicate object id: apple/);
  });

  it('rejects a goal id reused by another topic', () => {
    expect(() => loadPack({ ...base, topics: [...base.topics, { ...t2, goals: [{ id: 'g1', title: 'again' }] }] }))
      .toThrow(/duplicate goal id: g1/);
  });

  it('groups templates by topic, keeping pack order within each topic', () => {
    const pack = loadPack({ ...base, topics: [...base.topics, t2], templates: [tpl('z', 't2'), tpl('m', 't1'), tpl('a', 't2'), tpl('b', 't1')] });
    expect(pack.templatesByTopic.get('t1')?.map((t) => t.id)).toEqual(['m', 'b']);
    expect(pack.templatesByTopic.get('t2')?.map((t) => t.id)).toEqual(['z', 'a']);
  });
});

describe('readRawPack', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  /** A content folder with empty pools and the given template files. */
  function fixture(templateFiles: Record<string, string>): void {
    dir = mkdtempSync(join(tmpdir(), 'buddy-pack-'));
    mkdirSync(join(dir, 'templates'));
    for (const f of ['topics', 'objects', 'glyphs', 'scenes', 'lines', 'scenarios', 'sequences']) writeFileSync(join(dir, `${f}.json`), '[]');
    for (const [name, body] of Object.entries(templateFiles)) writeFileSync(join(dir, 'templates', name), body);
  }

  it('flattens template files in file-name order, skipping non-JSON files and dotfiles', () => {
    fixture({
      'b.json': JSON.stringify([{ id: 'b1' }, { id: 'b2' }]),
      'a.json': JSON.stringify([{ id: 'a1' }]),
      'notes.txt': 'not json',
      '._a.json': 'macOS resource-fork junk',
    });
    const raw = readRawPack(dir) as { templates: Array<{ id: string }> };
    expect(raw.templates.map((t) => t.id)).toEqual(['a1', 'b1', 'b2']);
  });

  it('names the file in a JSON syntax error', () => {
    fixture({ 'letters.json': '[{ "id": "x" },]' });
    expect(() => readRawPack(dir)).toThrow(ContentError);
    expect(() => readRawPack(dir)).toThrow(/^templates\/letters\.json: /);
  });

  it('rejects a template file that is not an array', () => {
    fixture({ 'one.json': JSON.stringify({ id: 'solo' }) });
    expect(() => readRawPack(dir)).toThrow('templates/one.json: expected an array of templates');
  });
});
