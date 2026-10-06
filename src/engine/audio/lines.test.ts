// src/engine/audio/lines.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from '../content/readPackFromDisk';
import { segmentLine, clipIdFor, pluralClipId, allTextClips } from './lines';

describe('segmentLine', () => {
  it('splits text around slots and drops punctuation-only fragments', () => {
    expect(segmentLine('prompt.give_n', 1, 'Can you give Buddy {n} {targets}?')).toEqual([
      { kind: 'text', text: 'Can you give Buddy', clipId: 'prompt.give_n.v1.s0' },
      { kind: 'slot', name: 'n' },
      { kind: 'slot', name: 'targets' },
    ]);
  });

  it('numbers text segments independently of slots', () => {
    expect(segmentLine('x', 0, 'Which {target} is big? Tap it')).toEqual([
      { kind: 'text', text: 'Which', clipId: 'x.v0.s0' },
      { kind: 'slot', name: 'target' },
      { kind: 'text', text: 'is big? Tap it', clipId: 'x.v0.s1' },
    ]);
  });

  it('returns a single text segment for a plain line', () => {
    expect(segmentLine('fb.correct', 2, 'Well done!')).toEqual([{ kind: 'text', text: 'Well done!', clipId: 'fb.correct.v2.s0' }]);
  });
});

describe('ids', () => {
  it('are stable and readable', () => {
    expect(clipIdFor('obj.apple', 0, 0)).toBe('obj.apple.v0.s0');
    expect(pluralClipId('obj.mango')).toBe('obj.mango.plural');
  });
});

describe('allTextClips', () => {
  it('lists every text segment of every variant plus plural clips for countable or irregular objects', () => {
    const pack = readPack();
    const clips = allTextClips(pack);
    const ids = new Set(clips.map((c) => c.clipId));
    expect(ids.has('prompt.tap_big.v0.s0')).toBe(true);
    expect(ids.has('obj.apple.v0.s0')).toBe(true);
    expect(ids.has('obj.mango.plural')).toBe(true);
    expect(clips.find((c) => c.clipId === 'obj.mango.plural')?.text).toBe('mangoes');
    expect(ids.has('obj.soap.plural')).toBe(false); // not countable, no irregular plural
    expect(ids.size).toBe(clips.length);
  });
});
