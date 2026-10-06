// src/app/pack.test.ts
import { describe, it, expect } from 'vitest';
import { readRawPack } from '../engine/content/readPackFromDisk';
import { pack, rawPack } from './pack';

describe('the browser content pack', () => {
  it('is the pack Node reads from disk, templates in the same order', () => {
    expect(rawPack).toEqual(readRawPack());
    expect([...pack.templates.keys()]).toEqual((readRawPack() as { templates: Array<{ id: string }> }).templates.map((t) => t.id));
  });
});
