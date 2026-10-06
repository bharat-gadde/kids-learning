// src/app/pack.ts
import { loadPack, type ContentPack } from '../engine/content/load';
import topics from '../../content/topics.json';
import objects from '../../content/objects.json';
import glyphs from '../../content/glyphs.json';
import scenes from '../../content/scenes.json';
import lines from '../../content/lines.json';
import scenarios from '../../content/scenarios.json';
import sequences from '../../content/sequences.json';

// `import: 'default'` makes each value the file's array (a module object would fail the schema).
const templateFiles = import.meta.glob<unknown[]>('/content/templates/*.json', { eager: true, import: 'default' });

/**
 * The same shape readRawPack builds from disk, templates in the same order: sorted here by code unit, as readRawPack
 * sorts its file names, so seeded picks never depend on the order a bundler hands a glob over in (Vite's dev server
 * and its production build glob differently).
 */
export const rawPack = {
  topics, objects, glyphs, scenes, lines, scenarios, sequences,
  templates: Object.entries(templateFiles).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).flatMap(([, list]) => list),
};

/** The content pack, parsed and indexed once; a ContentError here means the shipped content failed its schema. */
export const pack: ContentPack = loadPack(rawPack);
