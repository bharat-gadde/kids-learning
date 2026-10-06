// scripts/validate-content.ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPack } from '../src/engine/content/readPackFromDisk';
import { assetPaths } from '../src/engine/content/assets';
import { ContentError, type ContentPack } from '../src/engine/content/load';
import { validatePack } from '../src/engine/content/validate';
import type { ClipManifest } from '../src/engine/audio/manifest';
import { staleClips } from './voice/plan';

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== '--strict');
if (unknown.length > 0) {
  console.error(`Unknown argument ${unknown.join(' ')}\nUsage: npm run validate [-- --strict]`);
  process.exit(2);
}
const strict = args.includes('--strict');

function loadOrExit(): ContentPack {
  try {
    return readPack();
  } catch (e) {
    if (e instanceof ContentError) {
      console.error(`Content could not be loaded:\n${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

const pack = loadOrExit();

const issues = validatePack(pack);
// spec §7: clips whose line was edited after `npm run voice` (the app falls back to TTS for them until regenerated)
const MANIFEST = fileURLToPath(new URL('../public/audio/manifest.json', import.meta.url));
if (existsSync(MANIFEST)) {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as ClipManifest;
  for (const id of staleClips(pack, manifest)) issues.push({ level: 'warning', where: `clip ${id}`, message: 'its line changed since the clip was generated; run npm run voice' });
}
// spec §14: every picture the content refers to is in public/art (a missing one would show a blank stand-in).
// Names are matched exactly against a listing: macOS's file system ignores case, GitHub Pages does not.
const ART = fileURLToPath(new URL('../public/art/', import.meta.url));
const artFiles = new Set(existsSync(ART) ? readdirSync(ART, { recursive: true, encoding: 'utf8' }).map((p) => p.split(sep).join('/')) : []);
const openmoji = JSON.parse(readFileSync(fileURLToPath(new URL('../art/openmoji.json', import.meta.url)), 'utf8')) as Record<string, unknown>;
for (const asset of assetPaths(pack)) {
  if (artFiles.has(asset)) continue;
  const fix = Object.hasOwn(openmoji, asset) ? 'npm run art fetches it' : 'draw it, or list its OpenMoji code in art/openmoji.json: see art/README.md';
  issues.push({ level: 'error', where: `picture ${asset}`, message: `no such file in public/art (${fix})` });
}
const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');
for (const i of issues) console.log(`${i.level === 'error' ? '✖' : '▲'} ${i.where}: ${i.message}`);
console.log(
  `\n${pack.templates.size} templates · ${pack.topics.size} topics · ${pack.objects.size} objects · ${pack.glyphs.size} glyphs · ${pack.lines.size} lines · ${errors.length} errors · ${warnings.length} warnings`,
);
// exitCode (not exit()) lets piped stdout drain before the process ends
process.exitCode = errors.length > 0 || (strict && warnings.length > 0) ? 1 : 0;
