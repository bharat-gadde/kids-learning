// src/engine/content/validate.ts
import type { ContentPack } from './load';
import type { MechanicId, RuleKind, SubjectId, Template } from './schema';
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
const KNOWN_SLOTS = new Set(['target', 'targets', 'n', 'name']);

export const DEFAULT_MIN_TEMPLATES: Record<SubjectId, number> = {
  literacy: 2, phonics: 2, numeracy: 2, awareness: 4, wellness: 4,
};

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
  if (!topic) {
    err(where, `unknown topic ${t.topicId}`);
    return;
  }
  if (!topic.goals.some((g) => g.id === t.goalId)) err(where, `goal ${t.goalId} is not in topic ${t.topicId}`);
  if (!pack.lines.has(t.flavour.promptLineId)) err(where, `missing prompt line ${t.flavour.promptLineId}`);
  for (const s of t.flavour.scenes) if (!pack.scenes.has(s)) err(where, `missing scene ${s}`);

  const allowed = RULES_FOR_MECHANIC[t.mechanic];
  if (!allowed.includes(t.rule.kind)) {
    err(where, `rule ${t.rule.kind} is not valid for ${t.mechanic} (allowed: ${allowed.join(', ') || 'none yet'})`);
  }
  if (BINS_REQUIRED.includes(t.mechanic)) {
    if (!t.bins) err(where, `${t.mechanic} needs bins`);
    else for (const b of t.bins) if (!pack.lines.has(b.lineId)) err(where, `bin ${b.id} missing line ${b.lineId}`);
  }

  const maxOptions = Math.max(...t.difficulty.map((d) => d.options));
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
    case 'named':
      if (cands.length < maxOptions) err(where, `query yields ${cands.length} items; level 3 needs ${maxOptions}`);
      break;
    case 'size': {
      const ok = cands.filter((c) => tagOf(c, 'sizePair') === true);
      if (ok.length < 1) err(where, 'size rule needs items tagged sizePair');
      else if (ok.length < cands.length) warn(where, `${cands.length - ok.length} queried items lack sizePair and will be ignored`);
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
      if (t.bins) for (const b of t.bins) if (b.match === undefined) err(where, `bin ${b.id} needs a match value`);
      break;
    }
    case 'category': {
      for (const v of t.rule.values) if (!cands.some((c) => categoryOf(c) === v)) err(where, `no queried items in category ${v}`);
      if (t.bins) for (const b of t.bins) if (b.match === undefined) err(where, `bin ${b.id} needs a match value`);
      break;
    }
    case 'count':
    case 'give-count': {
      if (!cands.some((c) => tagOf(c, 'countable') === true)) err(where, 'count rules need countable objects');
      t.difficulty.forEach((d, i) => {
        if (!d.range) err(where, `difficulty level ${i + 1} needs a range for ${t.rule.kind}`);
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
        if (usable < maxOptions) err(where, `rhymeGroup pairs: ${usable} usable groups, level 3 needs ${maxOptions}`);
      } else {
        const keys = new Set(cands.filter((c) => c.kind === 'glyph').map((c) => (c.kind === 'glyph' ? c.item.pairKey : '')));
        if (keys.size < maxOptions) err(where, `caseMate pairs: ${keys.size} pair keys, level 3 needs ${maxOptions}`);
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
