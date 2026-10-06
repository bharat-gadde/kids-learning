// scripts/fetch-art.ts
// Writes the OpenMoji pictures and compositions listed in art/openmoji.json into public/art/ (spec §12).
// Usage: npm run art [-- --force]   (without --force, pictures already in public/art are left alone)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeSvg, hexesOf, OPENMOJI_VERSION, openMojiUrl, type ArtSource } from './art/compose';

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== '--force');
if (unknown.length > 0) {
  console.error(`Unknown argument ${unknown.join(' ')}\nUsage: npm run art [-- --force]`);
  process.exit(2);
}
const force = args.includes('--force');

const sources = JSON.parse(readFileSync(new URL('../art/openmoji.json', import.meta.url), 'utf8')) as Record<string, ArtSource>;
const ART = fileURLToPath(new URL('../public/art/', import.meta.url));

const pictures = new Map<string, string>();
async function fetchPicture(hex: string): Promise<void> {
  if (pictures.has(hex)) return;
  const res = await fetch(openMojiUrl(hex));
  if (!res.ok) throw new Error(`OpenMoji ${hex}: HTTP ${res.status} from ${openMojiUrl(hex)}`);
  pictures.set(hex, await res.text());
}

let written = 0;
for (const [path, source] of Object.entries(sources)) {
  const file = ART + path;
  if (existsSync(file) && !force) continue;
  for (const hex of hexesOf(source)) await fetchPicture(hex);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof source === 'string' ? (pictures.get(source) as string) : composeSvg(source, pictures));
  written += 1;
}
const kept = Object.keys(sources).length - written;
console.log(`${written} pictures written to public/art from OpenMoji ${OPENMOJI_VERSION} (CC BY-SA 4.0)${kept ? `; ${kept} already there` : ''}`);
