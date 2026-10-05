// src/engine/content/validate.ts
import type { ContentPack } from './load';
import { UI_SLOTS, type Difficulty, type MechanicId, type RuleKind, type SubjectId, type Template } from './schema';
import { queryItems, tagOf, categoryOf } from '../generator/items';

export interface Issue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

/**
 * Which rule kinds each mechanic can be driven by — only the combinations Plan 1A's generator builds a correct
 * payload for. Later plans add the rest (odd-one-out, stack-by-size, write, …) together with their builders.
 */
export const RULES_FOR_MECHANIC: Record<MechanicId, readonly RuleKind[]> = {
  'tap-the-one': ['named', 'size', 'tag', 'category', 'count'],
  'tap-all-that-match': ['tag', 'category'],
  'pop-the-right-ones': ['tag', 'category'],
  'find-in-scene': ['named', 'tag'],
  'odd-one-out': [],
  'spot-the-difference': [],
  'drag-to-match': ['pair', 'count'],
  'sort-into-bins': ['tag', 'category', 'size'],
  'give-to-buddy': ['tag', 'give-count'],
  'sequence': ['sequence'],
  'assemble': [],
  'pattern-next': [],
  'shape-fit': [],
  'stack-by-size': [],
  'write': [],
  'dot-to-dot': [],
  'colour-in': [],
  'maze': [],
  'scrub': [],
  'breathe-along': [],
  'listen-and-find': ['named'],
  'scene-then-choose': ['scenario'],
  'memory-flip': ['pair'],
};

const BINS_REQUIRED: readonly MechanicId[] = ['sort-into-bins', 'give-to-buddy'];
const KNOWN_SLOTS = new Set(['target', 'targets', 'n', ...UI_SLOTS]);

export const DEFAULT_MIN_TEMPLATES: Record<SubjectId, number> = {
  literacy: 2, phonics: 2, numeracy: 2, awareness: 4, wellness: 4,
};

/** The prompt slots the generator fills for a template (each builder's `slots` in generator/rules.ts); UI_SLOTS are the UI's. */
export function slotsFilled(t: Template): ReadonlySet<string> {
  switch (t.rule.kind) {
    case 'give-count': return new Set(['n', 'targets']);
    case 'count': return new Set(t.mechanic === 'drag-to-match' ? [] : ['n', 'target']);
    case 'pair': case 'sequence': case 'scenario': return new Set();
    default: return new Set(t.mechanic === 'sort-into-bins' ? [] : ['target']); // named, size, tag, category
  }
}

/** How many matching and other items one level of a tag or category rule shows (buildMatching in generator/rules.ts). */
function matchingShown(mechanic: MechanicId, d: Difficulty): [yes: number, no: number] {
  if (mechanic === 'sort-into-bins') return [Math.ceil(d.options / 2), Math.floor(d.options / 2)];
  const yes = mechanic === 'tap-the-one' ? 1 : Math.min(d.correctCount ?? 1, d.options - 1);
  return [yes, d.options - yes];
}

type Report = (where: string, message: string) => void;

export function validatePack(
  pack: ContentPack,
  opts: { minTemplates?: Partial<Record<SubjectId, number>> } = {},
): Issue[] {
  const issues: Issue[] = [];
  const err: Report = (where, message) => issues.push({ level: 'error', where, message });
  const warn: Report = (where, message) => issues.push({ level: 'warning', where, message });

  for (const line of pack.lines.values()) {
    line.variants.forEach((v, i) => {
      for (const m of v.matchAll(/\{(\w+)\}/g)) {
        const slot = m[1] as string;
        if (!KNOWN_SLOTS.has(slot)) err(`line ${line.id} v${i}`, `unknown slot {${slot}}`);
      }
    });
  }
  for (const o of pack.objects.values()) if (!pack.lines.has(o.lineId)) err(`object ${o.id}`, `missing line ${o.lineId}`);
  for (const g of pack.glyphs.values()) if (!pack.lines.has(g.lineId)) err(`glyph ${g.id}`, `missing line ${g.lineId}`);

  for (const s of pack.scenarios.values()) {
    const where = `scenario ${s.id}`;
    if (!pack.topics.has(s.topicId)) err(where, `unknown topic ${s.topicId}`);
    if (!pack.lines.has(s.narrationLineId)) err(where, `missing line ${s.narrationLineId}`);
    for (const c of s.choices) {
      if (!pack.objects.has(c.objectId)) err(where, `unknown object ${c.objectId}`);
      if (c.reactionLineId && !pack.lines.has(c.reactionLineId)) err(where, `missing line ${c.reactionLineId}`);
    }
    if (!s.choices.some((c) => c.correct)) err(where, 'no correct choice');
    if (new Set(s.choices.map((c) => c.objectId)).size !== s.choices.length) err(where, 'choices repeat an object');
  }

  for (const s of pack.sequences.values()) {
    const where = `sequence ${s.id}`;
    if (!pack.topics.has(s.topicId)) err(where, `unknown topic ${s.topicId}`);
    if (!pack.lines.has(s.promptLineId)) err(where, `missing line ${s.promptLineId}`);
    for (const step of s.steps) if (!pack.objects.has(step)) err(where, `unknown object ${step}`);
    if (new Set(s.steps).size !== s.steps.length) err(where, 'steps repeat an object');
  }

  for (const t of pack.templates.values()) validateTemplate(pack, t, err, warn);

  const min = { ...DEFAULT_MIN_TEMPLATES, ...opts.minTemplates };
  for (const topic of pack.topics.values()) {
    const n = pack.templatesByTopic.get(topic.id)?.length ?? 0;
    const need = min[topic.subject];
    if (n < need) warn(`topic ${topic.id}`, `${n} templates, spec minimum for ${topic.subject} is ${need}`);
  }
  return issues;
}

function validateTemplate(pack: ContentPack, t: Template, err: Report, warn: Report): void {
  const where = `template ${t.id}`;
  const topic = pack.topics.get(t.topicId);
  if (!topic) err(where, `unknown topic ${t.topicId}`);
  else if (!topic.goals.some((g) => g.id === t.goalId)) err(where, `goal ${t.goalId} is not in topic ${t.topicId}`);
  if (!pack.lines.has(t.flavour.promptLineId)) err(where, `missing prompt line ${t.flavour.promptLineId}`);
  for (const s of t.flavour.scenes) if (!pack.scenes.has(s)) err(where, `missing scene ${s}`);
  // pickScene avoids last set's scene, so ["garden", "garden"] leaves nothing to pick after a garden set
  if (new Set(t.flavour.scenes).size !== t.flavour.scenes.length) err(where, 'scenes repeat a scene');

  // a slot the rule never fills stays raw in the caption ("Give Buddy {n} …") and is skipped when spoken
  const filled = slotsFilled(t);
  const promptLineIds = t.rule.kind === 'sequence' // a sequence carries its own prompt line
    ? [...pack.sequences.values()].filter((s) => s.topicId === t.topicId).map((s) => s.promptLineId)
    : [t.flavour.promptLineId];
  for (const id of new Set(promptLineIds)) {
    const used = new Set(pack.lines.get(id)?.variants.flatMap((v) => [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string)));
    for (const slot of used) {
      if (KNOWN_SLOTS.has(slot) && !UI_SLOTS.has(slot) && !filled.has(slot)) {
        err(where, `prompt line ${id} uses {${slot}}, which ${t.mechanic} with a ${t.rule.kind} rule never fills`);
      }
    }
  }

  const allowed = RULES_FOR_MECHANIC[t.mechanic];
  if (!allowed.includes(t.rule.kind)) {
    err(where, `rule ${t.rule.kind} is not valid for ${t.mechanic} (allowed: ${allowed.join(', ') || 'none yet'})`);
  }
  if (BINS_REQUIRED.includes(t.mechanic)) {
    if (!t.bins) err(where, `${t.mechanic} needs bins`);
    else for (const b of t.bins) if (!pack.lines.has(b.lineId)) err(where, `bin ${b.id} missing line ${b.lineId}`);
  }
  if (t.bins && new Set(t.bins.map((b) => b.id)).size !== t.bins.length) err(where, 'bins repeat an id');

  const maxOptions = Math.max(...t.difficulty.map((d) => d.options));
  const maxLevel = `level ${t.difficulty.map((d) => d.options).lastIndexOf(maxOptions) + 1}`;
  // buildMatching shows matchingShown() items at each level, and silently shows fewer when the query runs short
  const levelsFit = (yes: number, no: number, what: string) => t.difficulty.forEach((d, i) => {
    const [needYes, needNo] = matchingShown(t.mechanic, d);
    if (yes < needYes || no < needNo) err(where, `level ${i + 1} needs ${needYes} matching (${what}) and ${needNo} other items; the query has ${yes} and ${no}`);
  });
  const needsQuery = t.rule.kind !== 'sequence' && t.rule.kind !== 'scenario';
  if (needsQuery && !t.query) {
    err(where, `rule ${t.rule.kind} needs a query`);
    return;
  }
  const cands = t.query ? queryItems(pack, t.query) : [];
  if (t.query?.ids) {
    const pool: ReadonlyMap<string, unknown> = t.query.pool === 'objects' ? pack.objects : pack.glyphs;
    for (const id of t.query.ids) if (!pool.has(id)) err(where, `query names unknown ${t.query.pool === 'objects' ? 'object' : 'glyph'} ${id}`);
  }

  switch (t.rule.kind) {
    case 'named': {
      if (cands.length < maxOptions) err(where, `query yields ${cands.length} items; ${maxLevel} needs ${maxOptions}`);
      // an answer is never shown beside an item spoken the same, so its line-mates ("B" for "b") cannot fill options
      const fit = cands.length - Math.max(0, ...cands.map((c) => cands.filter((o) => o.item.lineId === c.item.lineId).length)) + 1;
      if (cands.length >= maxOptions && fit < maxOptions) {
        err(where, `an answer is never shown beside an item spoken the same (like "B" and "b"), so only ${fit} options fit; ${maxLevel} needs ${maxOptions}`);
      }
      break;
    }
    case 'size': {
      const ok = cands.filter((c) => tagOf(c, 'sizePair') === true);
      if (ok.length < 1) err(where, 'size rule needs items tagged sizePair');
      else if (ok.length < cands.length) warn(where, `${cands.length - ok.length} queried items lack sizePair and will be ignored`);
      // sort-into-bins shows a small and a large copy of ⌈options / 2⌉ objects
      if (t.mechanic === 'sort-into-bins' && ok.length > 0) t.difficulty.forEach((d, i) => {
        const need = Math.ceil(d.options / 2);
        if (ok.length < need) err(where, `level ${i + 1} sorts ${need} sizePair objects (a big and a small copy of each); the query has ${ok.length}`);
      });
      if (t.bins) {
        const matches = new Set(t.bins.map((b) => b.match));
        if (!matches.has('large') || !matches.has('small')) err(where, 'size bins need match values "large" and "small"');
      }
      break;
    }
    case 'tag': {
      const rule = t.rule;
      const yes = cands.filter((c) => tagOf(c, rule.tag) === rule.value).length;
      const no = cands.length - yes;
      if (yes < 2 || no < 2) err(where, `tag rule needs ≥2 matching and ≥2 non-matching items (has ${yes}/${no})`);
      else levelsFit(yes, no, `${rule.tag} = ${String(rule.value)}`);
      if (t.mechanic === 'sort-into-bins' && t.bins) {
        const bins = t.bins;
        for (const b of bins) if (b.match === undefined) err(where, `bin ${b.id} needs a match value`);
        if (!bins.some((b) => b.match === rule.value)) err(where, `no bin has match ${JSON.stringify(rule.value)}, so the matching items have no bin`);
        // an other item whose value no bin names goes to the first bin not matching rule.value: right only if that bin is the one catch-all
        const unbinned = cands.filter((c) => tagOf(c, rule.tag) !== rule.value && !bins.some((b) => b.match === tagOf(c, rule.tag)));
        if (unbinned.length > 0 && bins.filter((b) => b.match !== rule.value).length !== 1) {
          const values = [...new Set(unbinned.map((c) => String(tagOf(c, rule.tag) ?? '(unset)')))];
          err(where, `items with ${rule.tag} ${values.join(' / ')} have no bin: add bins for them, or keep exactly one bin besides ${JSON.stringify(rule.value)}`);
        }
      }
      break;
    }
    case 'category': {
      const rule = t.rule;
      for (const v of rule.values) if (!cands.some((c) => categoryOf(c) === v)) err(where, `no queried items in category ${v}`);
      const yes = cands.filter((c) => categoryOf(c) === rule.values[0]).length;
      if (yes > 0) levelsFit(yes, cands.length - yes, rule.values[0] as string);
      if (t.mechanic === 'sort-into-bins' && t.bins) {
        for (const b of t.bins) if (b.match === undefined) err(where, `bin ${b.id} needs a match value`);
        const matches = new Set(t.bins.map((b) => b.match));
        const unbinned = [...new Set(cands.map(categoryOf))].filter((c) => !matches.has(c));
        if (unbinned.length > 0) err(where, `no bin matches queried category ${unbinned.join(', ')}`);
      }
      break;
    }
    case 'count':
    case 'give-count': {
      if (!cands.some((c) => tagOf(c, 'countable') === true)) err(where, 'count rules need countable objects');
      t.difficulty.forEach((d, i) => {
        if (!d.range) err(where, `difficulty level ${i + 1} needs a range for ${t.rule.kind}`);
        else if (t.rule.kind === 'give-count' && d.range[0] < 1) err(where, `difficulty level ${i + 1}: a give-count range starts at 1 (Buddy cannot be given 0)`);
        else if (t.mechanic === 'drag-to-match' && d.range[1] - d.range[0] + 1 < d.options) {
          err(where, `difficulty level ${i + 1} matches ${d.options} groups, but its range has ${d.range[1] - d.range[0] + 1} numbers`);
        }
      });
      if (t.rule.kind === 'count') {
        // numerals are drawn for every number in a level's range and for nearby distractors (0–10)
        const have = new Set([...pack.glyphs.values()].filter((g) => g.kind === 'number').map((g) => g.value));
        const need = new Set<number>(Array.from({ length: 11 }, (_, n) => n));
        for (const d of t.difficulty) if (d.range) for (let n = d.range[0]; n <= d.range[1]; n++) need.add(n);
        const missing = [...need].filter((n) => !have.has(n)).sort((a, b) => a - b);
        if (missing.length > 0) err(where, `count rule needs number glyphs for ${missing.join(', ')}`);
      }
      break;
    }
    case 'pair': {
      if (t.rule.by === 'rhymeGroup') {
        const groups = new Map<string, number>();
        for (const c of cands) {
          const g = tagOf(c, 'rhymeGroup');
          if (typeof g === 'string') groups.set(g, (groups.get(g) ?? 0) + 1);
        }
        const usable = [...groups.values()].filter((n) => n >= 2).length;
        if (usable < maxOptions) err(where, `rhymeGroup pairs: ${usable} usable groups, ${maxLevel} needs ${maxOptions}`);
      } else {
        // buildPair pairs an upper- and a lower-case glyph sharing a pairKey; a key missing either case yields no pair
        const upper = new Set(cands.flatMap((c) => (c.kind === 'glyph' && c.item.case === 'upper' ? [c.item.pairKey] : [])));
        const pairs = new Set(cands.flatMap((c) => (c.kind === 'glyph' && c.item.case === 'lower' && upper.has(c.item.pairKey) ? [c.item.pairKey] : []))).size;
        if (pairs < maxOptions) err(where, `caseMate pairs: ${pairs} letters queried in both cases, ${maxLevel} needs ${maxOptions}`);
      }
      break;
    }
    case 'sequence': {
      const n = [...pack.sequences.values()].filter((s) => s.topicId === t.topicId).length;
      if (n < 1) err(where, `no sequences for topic ${t.topicId}`);
      break;
    }
    case 'scenario': {
      const n = [...pack.scenarios.values()].filter((s) => s.topicId === t.topicId).length;
      if (n < 1) err(where, `no scenarios for topic ${t.topicId}`);
      break;
    }
  }
}
