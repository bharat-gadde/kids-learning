// scripts/fetch-art.ts
// Writes the OpenMoji pictures and compositions listed in art/openmoji.json into public/art/ (spec §12).
// Usage: npm run art [-- --force]   (without --force, pictures already in public/art are left alone)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeSvg, hexesOf, OPENMOJI_VERSION, openMojiUrl, parseSources } from './art/compose';

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== '--force');
if (unknown.length > 0) {
  console.error(`Unknown argument ${unknown.join(' ')}\nUsage: npm run art [-- --force]`);
  process.exit(2);
}
const force = args.includes('--force');

const sources = parseSources(JSON.parse(readFileSync(new URL('../art/openmoji.json', import.meta.url), 'utf8')));
const ART = fileURLToPath(new URL('../public/art/', import.meta.url));

const pictures = new Map<string, string>();
async function fetchPicture(hex: string, path: string): Promise<void> {
  if (pictures.has(hex)) return;
  const url = openMojiUrl(hex);
  let svg: string;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) }); // the timeout covers reading the body too
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    svg = await res.text();
  } catch (e) {
    throw new Error(`OpenMoji ${hex} for ${path}: ${(e as Error).message} (behind a proxy, set NODE_USE_ENV_PROXY=1)`, { cause: e });
  }
  pictures.set(hex, svg);
}

let written = 0;
for (const [path, source] of Object.entries(sources)) {
  const file = ART + path;
  if (existsSync(file) && !force) continue;
  for (const hex of hexesOf(source)) await fetchPicture(hex, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof source === 'string' ? (pictures.get(source) as string) : composeSvg(source, pictures));
  written += 1;
}
const kept = Object.keys(sources).length - written;
console.log(`${written} pictures written to public/art from OpenMoji ${OPENMOJI_VERSION} (CC BY-SA 4.0)${kept ? `; ${kept} already there` : ''}`);
