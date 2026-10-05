// scripts/validate-content.ts
import { readPack } from '../src/engine/content/readPackFromDisk';
import { ContentError, type ContentPack } from '../src/engine/content/load';
import { validatePack } from '../src/engine/content/validate';

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
const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');
for (const i of issues) console.log(`${i.level === 'error' ? '✖' : '▲'} ${i.where}: ${i.message}`);
console.log(
  `\n${pack.templates.size} templates · ${pack.topics.size} topics · ${pack.objects.size} objects · ${pack.glyphs.size} glyphs · ${pack.lines.size} lines · ${errors.length} errors · ${warnings.length} warnings`,
);
// exitCode (not exit()) lets piped stdout drain before the process ends
process.exitCode = errors.length > 0 || (strict && warnings.length > 0) ? 1 : 0;
