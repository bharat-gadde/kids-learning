// src/engine/time.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from './content/readPackFromDisk';
import { blockFor, greetingLineFor, type DayBlock } from './time';

const at = (h: number, m = 0) => new Date(2026, 9, 1, h, m);

describe('blockFor', () => {
  it('maps hours to morning / afternoon / evening per spec §4.1', () => {
    expect(blockFor(at(5))).toBe('morning');
    expect(blockFor(at(11, 59))).toBe('morning');
    expect(blockFor(at(12))).toBe('afternoon');
    expect(blockFor(at(16, 59))).toBe('afternoon');
    expect(blockFor(at(17))).toBe('evening');
    expect(blockFor(at(23))).toBe('evening');
    expect(blockFor(at(4, 59))).toBe('evening');
  });
});

describe('greetingLineFor', () => {
  it('names the greeting line for a block', () => {
    expect(greetingLineFor('morning')).toBe('buddy.greet_morning');
    expect(greetingLineFor('evening')).toBe('buddy.greet_evening');
  });

  it('names a line the content pack has, for every block', () => {
    const pack = readPack();
    for (const block of ['morning', 'afternoon', 'evening'] as const satisfies readonly DayBlock[]) {
      expect(pack.lines.has(greetingLineFor(block)), block).toBe(true);
    }
  });
});
