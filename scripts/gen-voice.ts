// scripts/gen-voice.ts
// Usage: npm run voice [-- --dry-run] [-- --prune]
// Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (in .env or the environment).
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPack } from '../src/engine/content/readPackFromDisk';
import { validatePack } from '../src/engine/content/validate';
import { EMPTY_MANIFEST, type ClipManifest } from '../src/engine/audio/manifest';
import { planClips } from './voice/plan';
import { OUTPUT_FORMAT, synthesizeWithRetry } from './voice/azure';

try {
  process.loadEnvFile?.('.env');
} catch {
  /* no .env — fine, the environment may carry the variables */
}

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const AUDIO_DIR = join(ROOT, 'public', 'audio');
const LINES_DIR = join(AUDIO_DIR, 'lines');
const MANIFEST_PATH = join(AUDIO_DIR, 'manifest.json');
const VOICE = process.env.AZURE_SPEECH_VOICE ?? 'en-IN-NeerjaNeural';
const RATE = process.env.AZURE_SPEECH_RATE ?? '-10%';
const dryRun = process.argv.includes('--dry-run');
const prune = process.argv.includes('--prune');

const pack = readPack();
// Never spend API calls on content that is known to be broken.
const contentErrors = validatePack(pack).filter((i) => i.level === 'error');
if (contentErrors.length > 0) {
  for (const i of contentErrors) console.error(`✖ ${i.where}: ${i.message}`);
  console.error(`${contentErrors.length} content error(s); fix them first (npm run validate).`);
  process.exit(1);
}
const manifest: ClipManifest = existsSync(MANIFEST_PATH) ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ClipManifest) : { ...EMPTY_MANIFEST, voice: VOICE, clips: {} }; // own clips object: EMPTY_MANIFEST's is shared
if (manifest.voice && manifest.voice !== VOICE) console.log(`Voice changed ${manifest.voice} → ${VOICE}: every clip will be regenerated.`);
manifest.voice = VOICE;
// A clip whose file is gone (deleted by hand, partial checkout) is made again, not reported as up to date.
for (const [id, entry] of Object.entries(manifest.clips)) if (!existsSync(join(LINES_DIR, entry.file))) delete manifest.clips[id];

const plan = planClips(pack, manifest, `${VOICE}|${RATE}|${OUTPUT_FORMAT}`); // the rate and the format change the audio too, so they are part of each clip's hash
console.log(`${plan.unchanged.length} clips up to date · ${plan.needed.length} to generate · ${plan.orphans.length} orphaned`);

if (dryRun) {
  for (const c of plan.needed) console.log(`  + ${c.clipId}  "${c.text}"`);
  for (const id of plan.orphans) console.log(`  − ${id}`);
  process.exit(0);
}

const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
if (!key || !region) {
  console.error('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (see .env.example). Use --dry-run to list clips without a key.');
  process.exit(1);
}

mkdirSync(LINES_DIR, { recursive: true });
const save = () => writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

let done = 0;
for (const clip of plan.needed) {
  let bytes: Uint8Array;
  try {
    // Retries 429 (F0 allows 20 calls a minute, and Azure throttles while it scales up) and 5xx, with backoff.
    bytes = await synthesizeWithRetry(clip.text, { key, region, voice: VOICE, rate: RATE }, {
      onRetry: ({ attempt, delayMs, error }) => console.warn(`  … ${clip.clipId}: ${error instanceof Error ? error.message : String(error)}; retry ${attempt} in ${Math.round(delayMs / 1000)} s`),
    });
  } catch (error) {
    console.error(`✖ ${clip.clipId}: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`${done} clip(s) saved. Run npm run voice again to resume.`);
    process.exit(1);
  }
  writeFileSync(join(LINES_DIR, clip.file), bytes);
  manifest.clips[clip.clipId] = { text: clip.text, hash: clip.hash, file: clip.file };
  save(); // resume-safe: a crash keeps what was generated
  done += 1;
  console.log(`[${done}/${plan.needed.length}] ${clip.clipId}  "${clip.text}"`);
  await new Promise((r) => setTimeout(r, 150));
}

if (prune) {
  for (const id of plan.orphans) {
    const file = manifest.clips[id]?.file;
    if (file && existsSync(join(LINES_DIR, file))) unlinkSync(join(LINES_DIR, file));
    delete manifest.clips[id];
  }
  save();
  console.log(`Pruned ${plan.orphans.length} orphaned clips.`);
}
console.log('Done.');
