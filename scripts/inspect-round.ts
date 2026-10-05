// scripts/inspect-round.ts
// Usage: npm run inspect -- <templateId> [--seed 42] [--level 2]
import { readPack } from '../src/engine/content/readPackFromDisk';
import { generateSet } from '../src/engine/generator/round';
import { EMPTY_HISTORY, type Level, type Payload, type RoundItem } from '../src/engine/generator/types';

const args = process.argv.slice(2);
const templateId = args.find((a) => !a.startsWith('--'));
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const seed = flag('seed', Date.now() % 100000);
const level = Math.min(3, Math.max(1, flag('level', 1))) as Level;

const pack = readPack();
if (!templateId || !pack.templates.has(templateId)) {
  console.error(`Usage: npm run inspect -- <templateId> [--seed N] [--level 1|2|3]\nTemplates:\n  ${[...pack.templates.keys()].join('\n  ')}`);
  process.exit(1);
}

const label = (i: RoundItem) => `${i.label}${i.scale !== undefined ? ` (×${i.scale})` : ''}${i.count !== undefined ? ` [${i.count}]` : ''}`;

function describe(p: Payload): string[] {
  switch (p.kind) {
    case 'choose':
      return [...(p.stimulus ? [`  stimulus: ${label(p.stimulus)}`] : []), ...p.options.map((o) => `  ${p.correctIds.includes(o.id) ? '✓' : ' '} ${label(o)}`)];
    case 'pairs':
      return p.pairs.map(([a, b]) => `  ${p.left.find((l) => l.id === a)?.label} ↔ ${p.right.find((r) => r.id === b)?.label}`);
    case 'bins':
      return p.bins.map((b) => `  ${b.label}: ${p.items.filter((i) => i.binId === b.id).map(label).join(', ')}`);
    case 'give':
      return [`  → ${p.target.label}${p.count !== undefined ? ` (give ${p.count})` : ''}`, ...p.items.map((i) => `  ${p.correctIds.includes(i.id) ? '✓' : ' '} ${label(i)}`)];
    case 'order':
      return [`  shown: ${p.items.map((i) => i.label).join(' · ')}`, `  answer: ${p.correctOrder.map((id) => p.items.find((i) => i.id === id)?.label).join(' → ')}`];
    case 'scenario':
      return [`  ${pack.lines.get(p.narrationLineId)?.variants[0]}`, ...p.choices.map((c) => `  ${c.correct ? '✓' : ' '} ${c.label}`)];
  }
}

const rounds = generateSet(pack, pack.templates.get(templateId)!, { seed, level, history: EMPTY_HISTORY });
console.log(`${templateId} · seed ${seed} · level ${level} · scene ${rounds[0]?.sceneId}\n`);
rounds.forEach((r, i) => {
  console.log(`#${i + 1} "${r.prompt.text}"  (${r.prompt.lineId} v${r.prompt.variant}${r.correctSlot !== null ? `, slot ${r.correctSlot}` : ''})`);
  for (const line of describe(r.payload)) console.log(line);
  console.log();
});
