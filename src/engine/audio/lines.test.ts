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

  it('strips the punctuation that ended the sentence before a slot, and keeps digits', () => {
    expect(segmentLine('x', 0, 'Which face is {target}? Tap it')).toEqual([
      { kind: 'text', text: 'Which face is', clipId: 'x.v0.s0' },
      { kind: 'slot', name: 'target' },
      { kind: 'text', text: 'Tap it', clipId: 'x.v0.s1' },
    ]);
    expect(segmentLine('x', 0, '{n} + 2')).toEqual([{ kind: 'slot', name: 'n' }, { kind: 'text', text: '+ 2', clipId: 'x.v0.s0' }]);
    expect(segmentLine('x', 0, 'Say "{target}"')).toEqual([{ kind: 'text', text: 'Say "', clipId: 'x.v0.s0' }, { kind: 'slot', name: 'target' }]);
  });
});

describe('ids', () => {
  it('are stable and readable', () => {
    expect(clipIdFor('obj.apple', 0, 0)).toBe('obj.apple.v0.s0');
    expect(pluralClipId('obj.mango')).toBe('obj.mango.plural');
  });
});

describe('allTextClips', () => {
  const pack = readPack();
  const clips = allTextClips(pack);
  const ids = new Set(clips.map((c) => c.clipId));
  const has = (id: string) => expect(ids.has(id), id).toBe(true);

  it('lists every text segment of every variant once, plus plural clips for countable objects', () => {
    has('prompt.tap_big.v0.s0');
    has('prompt.tap_letter.v1.s0'); // a later variant
    has('prompt.tap_big.v1.s1'); // a segment after a slot
    has('obj.apple.v0.s0');
    expect(clips.find((c) => c.clipId === 'obj.apple.plural')?.text).toBe('apples'); // regular plural
    expect(clips.find((c) => c.clipId === 'obj.mango.plural')?.text).toBe('mangoes'); // irregular plural
    expect(ids.has('obj.milk.plural')).toBe(false); // not countable: no rule fills {targets} with it
    expect(ids.size).toBe(clips.length);
    expect(clips.every((c) => pack.lines.has(c.lineId))).toBe(true);
  });

  it('covers every clip AudioManager can ask for', () => {
    for (const line of pack.lines.values()) {
      line.variants.forEach((text, v) => {
        for (const seg of segmentLine(line.id, v, text)) if (seg.kind === 'text') has(seg.clipId);
      });
    }
    for (const item of [...pack.objects.values(), ...pack.glyphs.values()]) has(clipIdFor(item.lineId, 0, 0));
    for (const o of pack.objects.values()) if (o.tags.countable) has(pluralClipId(o.lineId));
  });
});
