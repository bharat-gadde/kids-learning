// scripts/inspect-round.ts
// Usage: npm run inspect -- <templateId> [--seed 42] [--level 2]
// Lists the set generateSet makes with no history: a goal's first set, and every set the tests make. A later set in
// the app also depends on the goal's history, so its seed and level alone do not list it (replayRound rebuilds that).
import { readPack } from '../src/engine/content/readPackFromDisk';
import { generateSet } from '../src/engine/generator/round';
import { EMPTY_HISTORY, type Level, type Payload, type RoundItem } from '../src/engine/generator/types';

const USAGE = 'Usage: npm run inspect -- <templateId> [--seed N] [--level 1|2|3]   (the set made with no history)';

// The template id and two flags, in any order; anything else stops rather than listing a set nobody asked for.
const args = process.argv.slice(2);
let templateId: string | undefined;
let seed = Date.now() % 100000;
let level: Level = 1;
for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  const value = args[i + 1] ?? '';
  if (arg === '--seed' && /^-?\d+$/.test(value)) seed = Number(args[++i]);
  else if (arg === '--level' && ['1', '2', '3'].includes(value)) level = Number(args[++i]) as Level;
  else if (!arg.startsWith('-') && templateId === undefined) templateId = arg;
  else {
    console.error(`Unexpected argument ${arg}\n${USAGE}`);
    process.exit(2);
  }
}

const pack = readPack();
const template = templateId === undefined ? undefined : pack.templates.get(templateId);
if (!template) {
  console.error(`${USAGE}\nTemplates:\n  ${[...pack.templates.keys()].join('\n  ')}`);
  process.exit(2);
}

const label = (i: RoundItem) => `${i.label}${i.scale !== undefined ? ` (×${i.scale})` : ''}${i.count !== undefined ? ` [${i.count}]` : ''}`;

function describe(p: Payload): string[] {
  switch (p.kind) {
    case 'choose':
      return [...(p.stimulus ? [`  stimulus: ${label(p.stimulus)}`] : []), ...p.options.map((o) => `  ${p.correctIds.includes(o.id) ? '✓' : ' '} ${label(o)}`)];
    case 'pairs':
      return [`  shown: ${p.left.map((i) => i.label).join(' · ')}  |  ${p.right.map((i) => i.label).join(' · ')}`, ...p.pairs.map(([a, b]) => `  ${p.left.find((l) => l.id === a)?.label} ↔ ${p.right.find((r) => r.id === b)?.label}`)];
    case 'bins':
      return [`  shown: ${p.items.map(label).join(' · ')}`, ...p.bins.map((b) => `  ${b.label}: ${p.items.filter((i) => i.binId === b.id).map(label).join(', ')}`)];
    case 'give':
      return [`  → ${p.target.label}${p.count !== undefined ? ` (give ${p.count})` : ''}`, ...p.items.map((i) => `  ${p.correctIds.includes(i.id) ? '✓' : ' '} ${label(i)}`)];
    case 'order':
      return [`  shown: ${p.items.map((i) => i.label).join(' · ')}`, `  answer: ${p.correctOrder.map((id) => p.items.find((i) => i.id === id)?.label).join(' → ')}`];
    case 'scenario':
      return [`  ${pack.lines.get(p.narrationLineId)?.variants[0]}`, ...p.choices.map((c) => `  ${c.correct ? '✓' : ' '} ${c.label}`)];
  }
}

const rounds = generateSet(pack, template, { seed, level, history: EMPTY_HISTORY });
console.log(`${templateId} · seed ${seed} · level ${level} · scene ${rounds[0]?.sceneId}\n`);
rounds.forEach((r, i) => {
  console.log(`#${i + 1} "${r.prompt.text}"  (${r.prompt.lineId} v${r.prompt.variant}${r.correctSlot !== null ? `, slot ${r.correctSlot}` : ''})`);
  for (const line of describe(r.payload)) console.log(line);
  console.log();
});
