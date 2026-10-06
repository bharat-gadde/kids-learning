// scripts/art/pictures.test.ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSources } from './compose';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ART = join(ROOT, 'public/art');
const sources = parseSources(JSON.parse(readFileSync(join(ROOT, 'art/openmoji.json'), 'utf8')));

function svgFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? svgFiles(path) : name.endsWith('.svg') ? [path] : [];
  });
}

describe('the pictures in public/art', () => {
  it('include every one art/openmoji.json lists, each composition placed as its layers say', () => {
    // an edited composition is only rewritten when its file is missing: delete it, then npm run art
    for (const [path, source] of Object.entries(sources)) {
      const file = join(ART, path);
      expect(existsSync(file), path).toBe(true);
      if (typeof source === 'string') continue;
      const boxes = [...readFileSync(file, 'utf8').matchAll(/<svg x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)].map((m) => m.slice(1).map(Number));
      expect(boxes, path).toEqual(source.layers.map((l) => [l.x, l.y, l.size, l.size]));
    }
  });

  it('are drawings only: no script, event handler, embedded document, link or entity', () => {
    // GitHub Pages serves them from the app's own origin, where the child's progress lives
    const files = svgFiles(ART);
    expect(files.length).toBeGreaterThan(100);
    for (const file of files) expect(readFileSync(file, 'utf8'), file).not.toMatch(/<script|\son[a-z]+\s*=|<foreignObject|href\s*=|<!ENTITY|<!DOCTYPE/i);
  });
});
