// src/engine/content/readPackFromDisk.ts
// Node-only: used by scripts and tests. The browser app loads JSON through Vite (Plan 1B).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPack, type ContentPack } from './load';

export const CONTENT_DIR = fileURLToPath(new URL('../../../content/', import.meta.url));

export function readRawPack(dir: string = CONTENT_DIR): unknown {
  const json = (rel: string): unknown => JSON.parse(readFileSync(join(dir, rel), 'utf8'));
  const templateDir = join(dir, 'templates');
  const templates = readdirSync(templateDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => json(join('templates', f)) as unknown[]);
  return {
    topics: json('topics.json'),
    objects: json('objects.json'),
    glyphs: json('glyphs.json'),
    scenes: json('scenes.json'),
    lines: json('lines.json'),
    scenarios: json('scenarios.json'),
    sequences: json('sequences.json'),
    templates,
  };
}

export function readPack(dir: string = CONTENT_DIR): ContentPack {
  return loadPack(readRawPack(dir));
}
