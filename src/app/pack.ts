// src/app/pack.ts
import { loadPack, type ContentPack } from '../engine/content/load';
import topics from '../../content/topics.json';
import objects from '../../content/objects.json';
import glyphs from '../../content/glyphs.json';
import scenes from '../../content/scenes.json';
import lines from '../../content/lines.json';
import scenarios from '../../content/scenarios.json';
import sequences from '../../content/sequences.json';

// Vite sorts the files in the same code-unit order as readRawPack, so template order — and seeded picks — match Node.
// `import: 'default'` makes each value the file's array (a module object would fail the schema).
const templateFiles = import.meta.glob<unknown[]>('/content/templates/*.json', { eager: true, import: 'default' });

/** The same shape readRawPack builds from disk. */
export const rawPack = { topics, objects, glyphs, scenes, lines, scenarios, sequences, templates: Object.values(templateFiles).flat() };

/** The content pack, parsed and indexed once; a ContentError here means the shipped content failed its schema. */
export const pack: ContentPack = loadPack(rawPack);
