// src/engine/content/readPackFromDisk.ts
// Node-only: used by scripts and tests. The browser app loads JSON through Vite (Plan 1B).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentError, loadPack, type ContentPack } from './load';

export const CONTENT_DIR = fileURLToPath(new URL('../../../content/', import.meta.url));

export function readRawPack(dir: string = CONTENT_DIR): unknown {
  // A JSON syntax error names its file; file-system errors (ENOENT …) already carry the full path.
  const json = (rel: string): unknown => {
    const text = readFileSync(join(dir, rel), 'utf8');
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new ContentError(`${rel}: ${(e as Error).message}`, { cause: e });
    }
  };
  const templateDir = join(dir, 'templates');
  // The same files, in the same code-unit order, as Vite's import.meta.glob (which skips dotfiles).
  const templates = readdirSync(templateDir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('.'))
    .sort()
    .flatMap((f) => {
      const rel = join('templates', f);
      const list = json(rel);
      if (!Array.isArray(list)) throw new ContentError(`${rel}: expected an array of templates`);
      return list as unknown[];
    });
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
