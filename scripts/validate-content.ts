// scripts/validate-content.ts
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readPack } from '../src/engine/content/readPackFromDisk';
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
const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');
for (const i of issues) console.log(`${i.level === 'error' ? '✖' : '▲'} ${i.where}: ${i.message}`);
console.log(
  `\n${pack.templates.size} templates · ${pack.topics.size} topics · ${pack.objects.size} objects · ${pack.glyphs.size} glyphs · ${pack.lines.size} lines · ${errors.length} errors · ${warnings.length} warnings`,
);
// exitCode (not exit()) lets piped stdout drain before the process ends
process.exitCode = errors.length > 0 || (strict && warnings.length > 0) ? 1 : 0;
