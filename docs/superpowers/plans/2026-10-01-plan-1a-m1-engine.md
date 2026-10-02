# Plan 1A — M1 Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the framework-free engine of the Buddy learning game — content schemas and validator, the seeded round generator with every variation rule, mastery-by-form with bridging, the template picker, on-device progress storage, the three-layer audio manager, the Azure voice-generation script — plus the M1 content pack, all proven by automated tests and two CLIs.

**Architecture:** Pure TypeScript modules under `src/engine/` with no React or DOM dependency (the UI in Plan 1B consumes them). Content is JSON under `content/`, parsed by Zod schemas into an indexed `ContentPack`. The generator is deterministic from `(template, seed, history)`. Progress lives in IndexedDB via Dexie, tested with `fake-indexeddb`. Audio resolution (Heart → AI clip → device TTS) is an interface-driven class with fakes in tests; the Howler and Web Speech implementations are thin adapters.

**Tech Stack:** Node 26, npm, TypeScript 7 (strict), Vite 8 + Vitest 5, Zod 4, Dexie 4, fast-check, fake-indexeddb, tsx (for scripts), Azure Speech REST API. (Howler.js is consumed through an injected constructor here and installed by Plan 1B.)

**Spec:** `docs/superpowers/specs/2026-10-01-buddy-learning-game-design.md` — this plan implements §5 (content model), §5.4–5.6 (variation, mastery, levels), §7 (audio), §10 (data entities, storage), §13 (engine units), §14 (engine tests), and the engine half of §15 M1. Screens, Buddy's rig, mechanics' UI and Home scenes are Plan 1B.

---

## Conventions used throughout

- Repository root: `/Users/bharat.gadde/Developer/others/Kids Learning` (note the space — always quote paths).
- Work happens on branch `plan-1a-engine`; never commit to `main`.
- npm's cache is redirected to `.npm-cache/` (gitignored) by `npm_config_cache` in `.claude/settings.local.json`, because the sandbox blocks writes to `~/.npm`. If npm still reports EPERM/EACCES under `~/.npm`, add `--cache "$TMPDIR/npm-cache"` to the command.
- Versions current when this plan was written: TypeScript 7, Vite 8, Vitest 5, Zod 4.6, Dexie 4.4, fast-check 4.10, fake-indexeddb 6, tsx 4. If `tsc` rejects a `tsconfig.json` option as removed or deprecated, adjust that option minimally and say so in the report.
- Tests live next to the code as `*.test.ts` and run with `npm test` (Vitest, Node environment).
- Every task ends with a commit. Commit messages are imperative, lower-case prefix (`feat:`, `test:`, `chore:`, `content:`), and end with a `Co-Authored-By` trailer naming the model that actually made the commit: each agent uses the trailer its own harness specifies. The commit steps below show the controller's trailer as an example; a different model name there is expected, not a deviation.
- Zod 4 API: `z.prettifyError`, `schema.keyof()`, `z.discriminatedUnion('kind', [...])`.
- `noUncheckedIndexedAccess` is on: index results are `T | undefined`; use `!` only when a prior check guarantees presence.

## File structure

```
package.json · tsconfig.json · vite.config.ts · .gitignore · .env.example
content/
  topics.json          subjects → topics → goals
  objects.json         the object pool (tagged pictures with spoken names)
  glyphs.json          letters a–z/A–Z and numbers 0–10 with confusables
  scenes.json          backgrounds
  lines.json           every spoken line, with wording variants and {slots}
  scenarios.json       vignettes for scene-then-choose
  sequences.json       ordered step sets for sequence
  templates/*.json     one file per topic, an array of templates
src/engine/
  rng.ts                        seeded PRNG, hashing, shuffle, pick
  content/schema.ts             Zod schemas + inferred types (the single source of truth for shapes)
  content/load.ts               raw JSON → indexed ContentPack
  content/readPackFromDisk.ts   Node-only reader used by scripts and tests
  content/validate.ts           cross-reference and compatibility checks → Issue[]
  generator/types.ts            Round, Payload, RoundItem, histories
  generator/items.ts            pool queries and RoundItem conversion
  generator/sampling.ts         sample-without-recent, distractor picking
  generator/slots.ts            correct-answer slot placement
  generator/rules.ts            one builder per rule kind → payload
  generator/round.ts            generateRound / generateSet (wording + scene variation)
  progress/types.ts             Attempt, SetResult, Profile, Session, Settings
  progress/mastery.ts           goalStatus
  progress/difficulty.ts        levelFor
  progress/bridging.ts          preferredForm
  progress/picker.ts            pickTemplate, suggestTopic
  progress/db.ts                Dexie database + repository functions
  progress/history.ts           db → GeneratorHistory / PickerHistory
  audio/lines.ts                segmentation, clip ids, rendering
  audio/manager.ts              AudioManager (Heart → clip → TTS)
  audio/manifest.ts             ManifestClipSource
  audio/tts.ts                  WebSpeechTts
  audio/howlerPlayer.ts         HowlerClipPlayer
  time.ts                       blockFor (morning / afternoon / evening)
scripts/
  validate-content.ts           CLI: npm run validate
  inspect-round.ts              CLI: npm run inspect -- <templateId>
  gen-voice.ts                  CLI: npm run voice (Azure)
  voice/azure.ts                SSML builder + REST call
  voice/plan.ts                 which clips are new / stale / orphaned
public/audio/manifest.json      generated by gen-voice (committed)
public/audio/lines/*.mp3        generated clips (committed)
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Initialise the package and install dependencies**

Run from the repository root:

```bash
cd "/Users/bharat.gadde/Developer/others/Kids Learning"
npm init -y >/dev/null
npm pkg set name=buddy type=module version=0.1.0
npm pkg set private=true --json
npm install zod dexie
npm install -D typescript vite vitest fast-check fake-indexeddb tsx @types/node
```

Expected: `package.json` lists the dependencies; `node_modules/` exists.

- [ ] **Step 2: Set the npm scripts**

```bash
npm pkg set scripts.test="vitest run" scripts.test:watch="vitest" scripts.typecheck="tsc --noEmit" scripts.validate="tsx scripts/validate-content.ts" scripts.inspect="tsx scripts/inspect-round.ts" scripts.voice="tsx scripts/gen-voice.ts" scripts.check="npm run typecheck && npm run test && npm run validate"
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "scripts", "vite.config.ts"]
}
```

- [ ] **Step 4: Write `vite.config.ts` (test configuration only for now)**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Extend `.gitignore` and add `.env.example`**

Append to `.gitignore`:

```
# Node
node_modules/
dist/
.env
.env.local
```

Create `.env.example`:

```
# Azure Speech (used by: npm run voice)
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=centralindia
```

- [ ] **Step 6: Verify the toolchain runs**

Run: `npx tsc --noEmit && npx vitest run`
Expected: `tsc` prints nothing; Vitest reports `No test files found` and exits 0 (or 1 with "no tests" — either is fine at this point).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .gitignore .env.example
git commit -m "chore: scaffold TypeScript, Vitest and scripts for the engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Seeded random number generator

**Files:**
- Create: `src/engine/rng.ts`
- Test: `src/engine/rng.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/rng.test.ts
import { describe, it, expect } from 'vitest';
import { mulberry32, hashString, deriveSeed, randInt, pick, shuffle } from './rng';

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('differs for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('stays within [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 2000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hashString / deriveSeed', () => {
  it('is stable and sensitive to input', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });

  it('deriveSeed changes with the salt', () => {
    expect(deriveSeed(5, 'round0')).not.toBe(deriveSeed(5, 'round1'));
    expect(deriveSeed(5, 'round0')).toBe(deriveSeed(5, 'round0'));
  });
});

describe('helpers', () => {
  it('randInt is inclusive of both bounds', () => {
    const r = mulberry32(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randInt(r, 2, 4));
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });

  it('pick throws on an empty array', () => {
    expect(() => pick(mulberry32(1), [])).toThrow('pick from empty array');
  });

  it('shuffle keeps every element exactly once', () => {
    const out = shuffle(mulberry32(9), [1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: FAIL — `Cannot find module './rng'`.

- [ ] **Step 3: Implement `src/engine/rng.ts`**

```ts
// src/engine/rng.ts
/** A random source returning numbers in [0, 1). */
export type Rng = () => number;

/** Mulberry32 — small, fast, good enough for shuffling game content. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A new seed derived from a parent seed and a label (e.g. "round3"). */
export function deriveSeed(seed: number, salt: string): number {
  return hashString(`${seed}:${salt}`);
}

/** Integer in [min, max], both inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick from empty array');
  return arr[Math.floor(rng() * arr.length)] as T;
}

/** Fisher–Yates; returns a new array. */
export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rng.ts src/engine/rng.test.ts
git commit -m "feat(engine): seeded rng with hashing, shuffle and pick helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Content schemas

**Files:**
- Create: `src/engine/content/schema.ts`
- Test: `src/engine/content/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/content/schema.test.ts
import { describe, it, expect } from 'vitest';
import { ObjectItemSchema, TemplateSchema, LineSchema, RawPackSchema, MECHANICS } from './schema';

const template = {
  id: 'big-small.tap',
  topicId: 'big-small',
  goalId: 'big-small.identify',
  mechanic: 'tap-the-one',
  itemClass: 'objects',
  query: { pool: 'objects', tags: { sizePair: true } },
  rule: { kind: 'size', target: 'larger' },
  rounds: 6,
  difficulty: [
    { options: 2, distractorSimilarity: 'low' },
    { options: 3, distractorSimilarity: 'medium' },
    { options: 4, distractorSimilarity: 'high' },
  ],
  flavour: { scenes: ['garden'], promptLineId: 'prompt.tap_big' },
  level: 'lkg',
};

describe('ObjectItemSchema', () => {
  it('accepts a minimal object and defaults tags', () => {
    const r = ObjectItemSchema.safeParse({ id: 'apple', name: 'apple', lineId: 'obj.apple', asset: 'objects/apple.svg', category: 'fruit' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tags).toEqual({});
  });

  it('rejects an unknown tag', () => {
    const r = ObjectItemSchema.safeParse({ id: 'apple', name: 'apple', lineId: 'obj.apple', asset: 'a.svg', category: 'fruit', tags: { shiny: true } });
    expect(r.success).toBe(false);
  });
});

describe('TemplateSchema', () => {
  it('accepts a valid template', () => {
    expect(TemplateSchema.safeParse(template).success).toBe(true);
  });

  it('rejects an unknown mechanic', () => {
    expect(TemplateSchema.safeParse({ ...template, mechanic: 'juggle' }).success).toBe(false);
  });

  it('requires exactly three difficulty levels', () => {
    expect(TemplateSchema.safeParse({ ...template, difficulty: template.difficulty.slice(0, 2) }).success).toBe(false);
  });

  it('rejects a rule with the wrong shape', () => {
    expect(TemplateSchema.safeParse({ ...template, rule: { kind: 'size' } }).success).toBe(false);
  });
});

describe('LineSchema', () => {
  it('requires at least one variant', () => {
    expect(LineSchema.safeParse({ id: 'x', variants: [] }).success).toBe(false);
    expect(LineSchema.safeParse({ id: 'x', variants: ['Tap the {target}'] }).success).toBe(true);
  });
});

describe('RawPackSchema', () => {
  it('accepts an empty pack with all collections present', () => {
    const r = RawPackSchema.safeParse({ topics: [], objects: [], glyphs: [], scenes: [], lines: [], scenarios: [], sequences: [], templates: [] });
    expect(r.success).toBe(true);
  });

  it('lists 23 mechanics', () => {
    expect(MECHANICS.length).toBe(23);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/content/schema.test.ts`
Expected: FAIL — `Cannot find module './schema'`.

- [ ] **Step 3: Implement `src/engine/content/schema.ts`**

```ts
// src/engine/content/schema.ts
import { z } from 'zod';

export const SUBJECTS = ['literacy', 'phonics', 'numeracy', 'awareness', 'wellness'] as const;
export type SubjectId = (typeof SUBJECTS)[number];

/** The 23 mechanics of the spec (§6). give-to-buddy also covers dress-buddy. */
export const MECHANICS = [
  'tap-the-one', 'tap-all-that-match', 'pop-the-right-ones', 'find-in-scene', 'odd-one-out', 'spot-the-difference',
  'drag-to-match', 'sort-into-bins', 'give-to-buddy', 'sequence', 'assemble', 'pattern-next', 'shape-fit', 'stack-by-size',
  'write', 'dot-to-dot', 'colour-in', 'maze', 'scrub', 'breathe-along',
  'listen-and-find', 'scene-then-choose', 'memory-flip',
] as const;
export type MechanicId = (typeof MECHANICS)[number];

export const LEVELS = ['nursery', 'lkg', 'ukg'] as const;

const id = z.string().min(1);

export const ObjectTagsSchema = z.object({
  sizePair: z.boolean().optional(),
  colour: z.string().optional(),
  countable: z.boolean().optional(),
  beginsWith: z.string().length(1).optional(),
  vowelSound: z.enum(['a', 'e', 'i', 'o', 'u']).optional(),
  rhymeGroup: z.string().optional(),
  cvc: z.boolean().optional(),
  habitat: z.string().optional(),
  season: z.string().optional(),
  transportMode: z.enum(['land', 'water', 'air']).optional(),
  sense: z.string().optional(),
  room: z.string().optional(),
  healthy: z.boolean().optional(),
  teethFriendly: z.boolean().optional(),
  neatAndClean: z.boolean().optional(),
  sound: z.string().optional(),
}).strict();
export type ObjectTags = z.infer<typeof ObjectTagsSchema>;
export const TAG_KEYS = ObjectTagsSchema.keyof();

export const ObjectItemSchema = z.object({
  id,
  name: z.string().min(1),
  plural: z.string().min(1).optional(),
  lineId: id,
  asset: z.string().min(1),
  category: z.string().min(1),
  tags: ObjectTagsSchema.default({}),
});
export type ObjectItem = z.infer<typeof ObjectItemSchema>;

export const GlyphSchema = z.object({
  id,
  /** what is drawn: one character, or "10" */
  char: z.string().min(1).max(2),
  kind: z.enum(['letter', 'number']),
  case: z.enum(['upper', 'lower']).optional(),
  pairKey: z.string().min(1),
  value: z.number().int().min(0).optional(),
  lineId: id,
  confusables: z.array(z.string().length(1)).default([]),
});
export type Glyph = z.infer<typeof GlyphSchema>;

export const SceneSchema = z.object({ id, asset: z.string().min(1), theme: z.string().min(1) });
export type Scene = z.infer<typeof SceneSchema>;

export const LineSchema = z.object({ id, variants: z.array(z.string().min(1)).min(1) });
export type Line = z.infer<typeof LineSchema>;

export const GoalSchema = z.object({ id, title: z.string().min(1) });
export type Goal = z.infer<typeof GoalSchema>;

export const TopicSchema = z.object({
  id,
  subject: z.enum(SUBJECTS),
  title: z.string().min(1),
  goals: z.array(GoalSchema).min(1),
});
export type Topic = z.infer<typeof TopicSchema>;

export const ScenarioSchema = z.object({
  id,
  topicId: id,
  narrationLineId: id,
  vignette: z.string().min(1),
  choices: z.array(z.object({ objectId: id, correct: z.boolean(), reactionLineId: id.optional() })).min(2).max(4),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const SequenceSchema = z.object({
  id,
  topicId: id,
  promptLineId: id,
  steps: z.array(id).min(3).max(5),
});
export type Sequence = z.infer<typeof SequenceSchema>;

export const QuerySchema = z.object({
  pool: z.enum(['objects', 'glyphs']),
  category: z.array(z.string()).optional(),
  ids: z.array(z.string()).optional(),
  tags: ObjectTagsSchema.partial().optional(),
  hasTags: z.array(TAG_KEYS).optional(),
  glyph: z.object({
    kind: z.enum(['letter', 'number']).optional(),
    case: z.enum(['upper', 'lower']).optional(),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
  }).optional(),
});
export type Query = z.infer<typeof QuerySchema>;

export const RuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('named') }),
  z.object({ kind: z.literal('size'), target: z.enum(['larger', 'smaller']) }),
  z.object({ kind: z.literal('tag'), tag: TAG_KEYS, value: z.union([z.string(), z.boolean()]) }),
  z.object({ kind: z.literal('category'), values: z.array(z.string().min(1)).min(1).max(3) }),
  z.object({ kind: z.literal('count') }),
  z.object({ kind: z.literal('give-count') }),
  z.object({ kind: z.literal('pair'), by: z.enum(['rhymeGroup', 'caseMate']) }),
  z.object({ kind: z.literal('sequence') }),
  z.object({ kind: z.literal('scenario') }),
]);
export type Rule = z.infer<typeof RuleSchema>;
export type RuleKind = Rule['kind'];

export const DifficultySchema = z.object({
  /** number of options / items shown */
  options: z.number().int().min(2).max(8),
  /** for tap-all and bins: how many are correct (defaults handled by the generator) */
  correctCount: z.number().int().min(1).optional(),
  distractorSimilarity: z.enum(['low', 'medium', 'high']),
  /** numeric range for count rules */
  range: z.tuple([z.number().int().min(0), z.number().int().max(20)]).optional(),
});
export type Difficulty = z.infer<typeof DifficultySchema>;

export const BinSchema = z.object({
  id,
  label: z.string().min(1),
  lineId: id,
  asset: z.string().optional(),
  /** the tag / category / size value this bin accepts */
  match: z.union([z.string(), z.boolean()]).optional(),
});
export type Bin = z.infer<typeof BinSchema>;

export const TemplateSchema = z.object({
  id,
  topicId: id,
  goalId: id,
  mechanic: z.enum(MECHANICS),
  /** second half of the mastery "form" key: mechanic:itemClass */
  itemClass: z.string().min(1),
  query: QuerySchema.optional(),
  rule: RuleSchema,
  rounds: z.number().int().min(1).max(10),
  difficulty: z.tuple([DifficultySchema, DifficultySchema, DifficultySchema]),
  flavour: z.object({
    scenes: z.array(id).min(1),
    promptLineId: id,
    music: z.string().optional(),
  }),
  bins: z.array(BinSchema).min(1).optional(),
  examFormat: z.string().optional(),
  level: z.enum(LEVELS),
});
export type Template = z.infer<typeof TemplateSchema>;

export const RawPackSchema = z.object({
  topics: z.array(TopicSchema),
  objects: z.array(ObjectItemSchema),
  glyphs: z.array(GlyphSchema),
  scenes: z.array(SceneSchema),
  lines: z.array(LineSchema),
  scenarios: z.array(ScenarioSchema),
  sequences: z.array(SequenceSchema),
  templates: z.array(TemplateSchema),
});
export type RawPack = z.infer<typeof RawPackSchema>;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/content/schema.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/content/schema.ts src/engine/content/schema.test.ts
git commit -m "feat(content): zod schemas for pools, templates, rules and the raw pack

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pack loader and disk reader

**Files:**
- Create: `src/engine/content/load.ts`, `src/engine/content/readPackFromDisk.ts`
- Test: `src/engine/content/load.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/content/load.test.ts
import { describe, it, expect } from 'vitest';
import { loadPack, ContentError } from './load';

const base = {
  topics: [{ id: 't1', subject: 'numeracy', title: 'T', goals: [{ id: 'g1', title: 'G' }] }],
  objects: [{ id: 'apple', name: 'apple', lineId: 'obj.apple', asset: 'objects/apple.svg', category: 'fruit' }],
  glyphs: [],
  scenes: [{ id: 'garden', asset: 'scenes/garden.svg', theme: 'garden' }],
  lines: [{ id: 'obj.apple', variants: ['apple'] }],
  scenarios: [],
  sequences: [],
  templates: [],
};

describe('loadPack', () => {
  it('indexes collections by id and goals by id with their topic', () => {
    const pack = loadPack(base);
    expect(pack.objects.get('apple')?.category).toBe('fruit');
    expect(pack.goals.get('g1')?.topicId).toBe('t1');
    expect(pack.templatesByTopic.get('t1')).toEqual([]);
  });

  it('throws a ContentError with a readable message on schema errors', () => {
    expect(() => loadPack({ ...base, objects: [{ id: 'x' }] })).toThrow(ContentError);
  });

  it('rejects duplicate ids', () => {
    expect(() => loadPack({ ...base, objects: [base.objects[0], base.objects[0]] })).toThrow(/duplicate object id: apple/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/content/load.test.ts`
Expected: FAIL — `Cannot find module './load'`.

- [ ] **Step 3: Implement `src/engine/content/load.ts`**

```ts
// src/engine/content/load.ts
import { z } from 'zod';
import {
  RawPackSchema,
  type RawPack, type Topic, type Goal, type ObjectItem, type Glyph, type Scene, type Line,
  type Scenario, type Sequence, type Template,
} from './schema';

export class ContentError extends Error {
  override name = 'ContentError';
}

export interface ContentPack {
  raw: RawPack;
  topics: Map<string, Topic>;
  goals: Map<string, Goal & { topicId: string }>;
  objects: Map<string, ObjectItem>;
  glyphs: Map<string, Glyph>;
  scenes: Map<string, Scene>;
  lines: Map<string, Line>;
  scenarios: Map<string, Scenario>;
  sequences: Map<string, Sequence>;
  templates: Map<string, Template>;
  templatesByTopic: Map<string, Template[]>;
}

function indexById<T extends { id: string }>(items: readonly T[], what: string): Map<string, T> {
  const m = new Map<string, T>();
  for (const item of items) {
    if (m.has(item.id)) throw new ContentError(`duplicate ${what} id: ${item.id}`);
    m.set(item.id, item);
  }
  return m;
}

/** Parse raw JSON into an indexed pack. Throws ContentError on schema errors or duplicate ids. */
export function loadPack(input: unknown): ContentPack {
  const parsed = RawPackSchema.safeParse(input);
  if (!parsed.success) throw new ContentError(z.prettifyError(parsed.error));
  const raw = parsed.data;

  const topics = indexById(raw.topics, 'topic');
  const goals = new Map<string, Goal & { topicId: string }>();
  for (const t of raw.topics) {
    for (const g of t.goals) {
      if (goals.has(g.id)) throw new ContentError(`duplicate goal id: ${g.id}`);
      goals.set(g.id, { ...g, topicId: t.id });
    }
  }
  const templates = indexById(raw.templates, 'template');
  const templatesByTopic = new Map<string, Template[]>();
  for (const t of raw.topics) templatesByTopic.set(t.id, []);
  for (const tpl of raw.templates) {
    const list = templatesByTopic.get(tpl.topicId) ?? [];
    list.push(tpl);
    templatesByTopic.set(tpl.topicId, list);
  }

  return {
    raw,
    topics,
    goals,
    objects: indexById(raw.objects, 'object'),
    glyphs: indexById(raw.glyphs, 'glyph'),
    scenes: indexById(raw.scenes, 'scene'),
    lines: indexById(raw.lines, 'line'),
    scenarios: indexById(raw.scenarios, 'scenario'),
    sequences: indexById(raw.sequences, 'sequence'),
    templates,
    templatesByTopic,
  };
}
```

- [ ] **Step 4: Implement `src/engine/content/readPackFromDisk.ts` (Node only)**

```ts
// src/engine/content/readPackFromDisk.ts
// Node-only: used by scripts and tests. The browser app loads JSON through Vite (Plan 1B).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPack, type ContentPack } from './load';

export const CONTENT_DIR = fileURLToPath(new URL('../../../content/', import.meta.url));

export function readRawPack(dir: string = CONTENT_DIR): unknown {
  const json = (rel: string): unknown => JSON.parse(readFileSync(join(dir, rel), 'utf8'));
  const templateDir = join(dir, 'templates');
  const templates = readdirSync(templateDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => json(join('templates', f)) as unknown[]);
  return {
    topics: json('topics.json'),
    objects: json('objects.json'),
    glyphs: json('glyphs.json'),
    scenes: json('scenes.json'),
    lines: json('lines.json'),
    scenarios: json('scenarios.json'),
    sequences: json('sequences.json'),
    templates,
  };
}

export function readPack(dir: string = CONTENT_DIR): ContentPack {
  return loadPack(readRawPack(dir));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/engine/content/load.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/content/load.ts src/engine/content/readPackFromDisk.ts src/engine/content/load.test.ts
git commit -m "feat(content): indexed pack loader and node disk reader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Round types and pool queries

**Files:**
- Create: `src/engine/generator/types.ts`, `src/engine/generator/items.ts`
- Test: `src/engine/generator/items.test.ts`

- [ ] **Step 1: Write `src/engine/generator/types.ts` (types only — no test needed)**

```ts
// src/engine/generator/types.ts
import type { MechanicId } from '../content/schema';

/** One thing the child can see and touch in a round. */
export interface RoundItem {
  id: string;
  label: string;
  lineId: string;
  /** vector asset path, or `glyph:<char>` for letters and numbers rendered as text */
  asset: string;
  /** relative size for size rules (1 = full size) */
  scale?: number;
  /** how many copies to draw for count rules */
  count?: number;
}

export interface RoundBin {
  id: string;
  label: string;
  lineId: string;
  asset?: string;
}

export type Payload =
  | { kind: 'choose'; options: RoundItem[]; correctIds: string[] }
  | { kind: 'pairs'; left: RoundItem[]; right: RoundItem[]; pairs: Array<[string, string]> }
  | { kind: 'bins'; bins: RoundBin[]; items: Array<RoundItem & { binId: string }> }
  | { kind: 'give'; target: RoundBin; items: RoundItem[]; correctIds: string[]; count?: number }
  | { kind: 'order'; items: RoundItem[]; correctOrder: string[] }
  | {
      kind: 'scenario';
      scenarioId: string;
      vignette: string;
      narrationLineId: string;
      choices: Array<RoundItem & { correct: boolean; reactionLineId?: string }>;
    };

export type Level = 1 | 2 | 3;

export interface RoundPrompt {
  lineId: string;
  variant: number;
  /** caption text with slots rendered as labels */
  text: string;
  /** slot name → item id or literal (the audio manager resolves ids to clips) */
  slots: Record<string, string>;
}

export interface Round {
  templateId: string;
  topicId: string;
  goalId: string;
  mechanic: MechanicId;
  /** mastery form key: `${mechanic}:${itemClass}` */
  form: string;
  seed: number;
  level: Level;
  sceneId: string;
  prompt: RoundPrompt;
  payload: Payload;
  /** index of the (first) correct option for choose/give payloads, else null */
  correctSlot: number | null;
  /** ids of the "key" items used (correct answers, sequence/scenario ids) — fed back as recent history */
  itemIds: string[];
}

export interface GeneratorHistory {
  /** item ids used for this goal in the last 3 sessions, oldest first */
  recentItemIds: string[];
  lastSlot: number | null;
  lastSceneId: string | null;
  /** lineId → variant index used last time */
  lastVariantByLine: Record<string, number>;
}

export const EMPTY_HISTORY: GeneratorHistory = {
  recentItemIds: [],
  lastSlot: null,
  lastSceneId: null,
  lastVariantByLine: {},
};
```

- [ ] **Step 2: Write the failing tests for queries**

```ts
// src/engine/generator/items.test.ts
import { describe, it, expect } from 'vitest';
import { loadPack } from '../content/load';
import { queryItems, toRoundItem, categoryOf, tagOf, pluralOf } from './items';

const pack = loadPack({
  topics: [],
  objects: [
    { id: 'apple', name: 'apple', lineId: 'obj.apple', asset: 'objects/apple.svg', category: 'fruit', tags: { sizePair: true, countable: true } },
    { id: 'carrot', name: 'carrot', lineId: 'obj.carrot', asset: 'objects/carrot.svg', category: 'vegetable', tags: { sizePair: true } },
    { id: 'cat', name: 'cat', lineId: 'obj.cat', asset: 'objects/cat.svg', category: 'animal', tags: { cvc: true, rhymeGroup: 'at' } },
    { id: 'bus', name: 'bus', plural: 'buses', lineId: 'obj.bus', asset: 'objects/bus.svg', category: 'thing', tags: { cvc: true } },
  ],
  glyphs: [
    { id: 'A', char: 'A', kind: 'letter', case: 'upper', pairKey: 'a', lineId: 'glyph.letter.a' },
    { id: 'a', char: 'a', kind: 'letter', case: 'lower', pairKey: 'a', lineId: 'glyph.letter.a' },
    { id: 'n3', char: '3', kind: 'number', pairKey: 'n3', value: 3, lineId: 'glyph.num.3' },
  ],
  scenes: [], lines: [], scenarios: [], sequences: [], templates: [],
});

describe('queryItems', () => {
  it('filters objects by category', () => {
    expect(queryItems(pack, { pool: 'objects', category: ['fruit', 'vegetable'] }).map((c) => c.item.id)).toEqual(['apple', 'carrot']);
  });

  it('filters objects by tag value and by tag presence', () => {
    expect(queryItems(pack, { pool: 'objects', tags: { countable: true } }).map((c) => c.item.id)).toEqual(['apple']);
    expect(queryItems(pack, { pool: 'objects', hasTags: ['rhymeGroup'] }).map((c) => c.item.id)).toEqual(['cat']);
  });

  it('filters glyphs by kind, case and value range', () => {
    expect(queryItems(pack, { pool: 'glyphs', glyph: { kind: 'letter', case: 'lower' } }).map((c) => c.item.id)).toEqual(['a']);
    expect(queryItems(pack, { pool: 'glyphs', glyph: { kind: 'number', min: 1, max: 5 } }).map((c) => c.item.id)).toEqual(['n3']);
  });

  it('filters by explicit ids and exposes the id at the top level', () => {
    const found = queryItems(pack, { pool: 'objects', ids: ['bus'] });
    expect(found.map((c) => c.item.id)).toEqual(['bus']);
    expect(found[0]?.id).toBe('bus');
  });
});

describe('conversion helpers', () => {
  it('converts objects and glyphs to round items', () => {
    const [apple] = queryItems(pack, { pool: 'objects', ids: ['apple'] });
    const [A] = queryItems(pack, { pool: 'glyphs', ids: ['A'] });
    expect(toRoundItem(apple!)).toEqual({ id: 'apple', label: 'apple', lineId: 'obj.apple', asset: 'objects/apple.svg' });
    expect(toRoundItem(A!)).toEqual({ id: 'A', label: 'A', lineId: 'glyph.letter.a', asset: 'glyph:A' });
  });

  it('reports category and tags uniformly', () => {
    const [cat] = queryItems(pack, { pool: 'objects', ids: ['cat'] });
    const [A] = queryItems(pack, { pool: 'glyphs', ids: ['A'] });
    expect(categoryOf(cat!)).toBe('animal');
    expect(categoryOf(A!)).toBe('glyph-letter-upper');
    expect(tagOf(cat!, 'rhymeGroup')).toBe('at');
    expect(tagOf(A!, 'rhymeGroup')).toBeUndefined();
  });

  it('pluralises with an override or a default s', () => {
    expect(pluralOf(pack.objects.get('bus')!)).toBe('buses');
    expect(pluralOf(pack.objects.get('apple')!)).toBe('apples');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/engine/generator/items.test.ts`
Expected: FAIL — `Cannot find module './items'`.

- [ ] **Step 4: Implement `src/engine/generator/items.ts`**

```ts
// src/engine/generator/items.ts
import type { ContentPack } from '../content/load';
import type { Glyph, ObjectItem, ObjectTags, Query } from '../content/schema';
import type { RoundItem } from './types';

/** A pool entry. `id` mirrors `item.id` so candidates can be sampled (and de-duplicated) by id. */
export type Candidate =
  | { kind: 'object'; id: string; item: ObjectItem }
  | { kind: 'glyph'; id: string; item: Glyph };

export const objectCandidate = (item: ObjectItem): Candidate => ({ kind: 'object', id: item.id, item });
export const glyphCandidate = (item: Glyph): Candidate => ({ kind: 'glyph', id: item.id, item });

function matchesObject(o: ObjectItem, q: Query): boolean {
  if (q.ids && !q.ids.includes(o.id)) return false;
  if (q.category && !q.category.includes(o.category)) return false;
  if (q.tags) {
    for (const [key, value] of Object.entries(q.tags)) {
      if (value !== undefined && o.tags[key as keyof ObjectTags] !== value) return false;
    }
  }
  if (q.hasTags) {
    for (const key of q.hasTags) if (o.tags[key] === undefined) return false;
  }
  return true;
}

function matchesGlyph(g: Glyph, q: Query): boolean {
  if (q.ids && !q.ids.includes(g.id)) return false;
  const f = q.glyph;
  if (!f) return true;
  if (f.kind && g.kind !== f.kind) return false;
  if (f.case && g.case !== f.case) return false;
  if (f.min !== undefined && (g.value === undefined || g.value < f.min)) return false;
  if (f.max !== undefined && (g.value === undefined || g.value > f.max)) return false;
  return true;
}

/** All pool entries matching a template query, in pack order (deterministic). */
export function queryItems(pack: ContentPack, q: Query): Candidate[] {
  if (q.pool === 'objects') return [...pack.objects.values()].filter((o) => matchesObject(o, q)).map((o) => objectCandidate(o));
  return [...pack.glyphs.values()].filter((g) => matchesGlyph(g, q)).map((g) => glyphCandidate(g));
}

export function toRoundItem(c: Candidate): RoundItem {
  if (c.kind === 'object') return { id: c.item.id, label: c.item.name, lineId: c.item.lineId, asset: c.item.asset };
  return { id: c.item.id, label: c.item.char, lineId: c.item.lineId, asset: `glyph:${c.item.char}` };
}

export function categoryOf(c: Candidate): string {
  if (c.kind === 'object') return c.item.category;
  return c.item.case ? `glyph-${c.item.kind}-${c.item.case}` : `glyph-${c.item.kind}`;
}

export function tagOf(c: Candidate, tag: keyof ObjectTags): unknown {
  return c.kind === 'object' ? c.item.tags[tag] : undefined;
}

export function pluralOf(o: ObjectItem): string {
  return o.plural ?? `${o.name}s`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/engine/generator/items.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/generator/types.ts src/engine/generator/items.ts src/engine/generator/items.test.ts
git commit -m "feat(generator): round types and pool queries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Content validator

**Files:**
- Create: `src/engine/content/validate.ts`
- Test: `src/engine/content/validate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/content/validate.test.ts
import { describe, it, expect } from 'vitest';
import { loadPack } from './load';
import { validatePack } from './validate';

const obj = (id: string, category: string, tags: Record<string, unknown> = {}) => ({
  id, name: id, lineId: `obj.${id}`, asset: `objects/${id}.svg`, category, tags,
});
const line = (id: string, ...variants: string[]) => ({ id, variants });

const good = {
  topics: [{ id: 'big-small', subject: 'numeracy', title: 'Big & small', goals: [{ id: 'big-small.identify', title: 'Identify bigger' }] }],
  objects: [obj('apple', 'fruit', { sizePair: true }), obj('ball', 'thing', { sizePair: true }), obj('cat', 'animal', { sizePair: true }), obj('bus', 'thing', { sizePair: true })],
  glyphs: [],
  scenes: [{ id: 'garden', asset: 'scenes/garden.svg', theme: 'garden' }],
  lines: [line('obj.apple', 'apple'), line('obj.ball', 'ball'), line('obj.cat', 'cat'), line('obj.bus', 'bus'), line('prompt.tap_big', 'Tap the BIG {target}', 'Which {target} is big?')],
  scenarios: [],
  sequences: [],
  templates: [{
    id: 'big-small.tap', topicId: 'big-small', goalId: 'big-small.identify', mechanic: 'tap-the-one', itemClass: 'objects',
    query: { pool: 'objects', tags: { sizePair: true } }, rule: { kind: 'size', target: 'larger' }, rounds: 6,
    difficulty: [{ options: 2, distractorSimilarity: 'low' }, { options: 3, distractorSimilarity: 'medium' }, { options: 4, distractorSimilarity: 'high' }],
    flavour: { scenes: ['garden'], promptLineId: 'prompt.tap_big' }, level: 'lkg',
  }],
};

const errorsOf = (raw: unknown) => validatePack(loadPack(raw)).filter((i) => i.level === 'error').map((i) => i.message);

describe('validatePack', () => {
  it('passes a consistent pack with only the per-topic minimum warning', () => {
    const issues = validatePack(loadPack(good));
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(issues.map((i) => i.message)).toEqual(['1 templates, spec minimum for numeracy is 2']);
  });

  it('flags unknown slots in lines', () => {
    const raw = { ...good, lines: [...good.lines, line('x', 'Hello {planet}')] };
    expect(errorsOf(raw)).toContain('unknown slot {planet}');
  });

  it('flags a missing object line', () => {
    const raw = { ...good, objects: [...good.objects, obj('kite', 'toy')] };
    expect(errorsOf(raw)).toContain('missing line obj.kite');
  });

  it('flags a rule that the mechanic does not support', () => {
    const raw = { ...good, templates: [{ ...good.templates[0], rule: { kind: 'sequence' } }] };
    expect(errorsOf(raw).some((m) => m.startsWith('rule sequence is not valid for tap-the-one'))).toBe(true);
  });

  it('flags missing bins for sort-into-bins', () => {
    const raw = { ...good, templates: [{ ...good.templates[0], mechanic: 'sort-into-bins' }] };
    expect(errorsOf(raw)).toContain('sort-into-bins needs bins');
  });

  it('flags a goal that is not in the topic', () => {
    const raw = { ...good, templates: [{ ...good.templates[0], goalId: 'other.goal' }] };
    expect(errorsOf(raw)).toContain('goal other.goal is not in topic big-small');
  });

  it('flags a query that cannot fill level 3', () => {
    const raw = { ...good, templates: [{ ...good.templates[0], rule: { kind: 'named' }, query: { pool: 'objects', ids: ['apple', 'ball'] } }] };
    expect(errorsOf(raw)).toContain('query yields 2 items; level 3 needs 4');
  });

  it('flags a scenario without a correct choice', () => {
    const raw = {
      ...good,
      lines: [...good.lines, line('sc.x', 'What now?')],
      scenarios: [{ id: 'sc.x', topicId: 'big-small', narrationLineId: 'sc.x', vignette: 'v.svg', choices: [{ objectId: 'apple', correct: false }, { objectId: 'ball', correct: false }] }],
    };
    expect(errorsOf(raw)).toContain('no correct choice');
  });

  it('flags size bins that are not "large" and "small"', () => {
    const raw = {
      ...good,
      lines: [...good.lines, line('bin.big', 'big basket'), line('bin.small', 'small basket')],
      templates: [{
        ...good.templates[0], mechanic: 'sort-into-bins',
        bins: [{ id: 'big', label: 'big basket', lineId: 'bin.big', match: 'big' }, { id: 'small', label: 'small basket', lineId: 'bin.small', match: 'small' }],
      }],
    };
    expect(errorsOf(raw)).toContain('size bins need match values "large" and "small"');
  });

  it('flags a count rule whose numbers have no numeral glyphs', () => {
    const raw = {
      ...good,
      objects: good.objects.map((o) => ({ ...o, tags: { ...o.tags, countable: true } })),
      templates: [{
        ...good.templates[0], mechanic: 'drag-to-match', rule: { kind: 'count' },
        difficulty: [
          { options: 2, distractorSimilarity: 'low', range: [1, 3] },
          { options: 3, distractorSimilarity: 'medium', range: [1, 5] },
          { options: 4, distractorSimilarity: 'high', range: [1, 12] },
        ],
      }],
    };
    expect(errorsOf(raw)).toContain('count rule needs number glyphs for 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/content/validate.test.ts`
Expected: FAIL — `Cannot find module './validate'`.

- [ ] **Step 3: Implement `src/engine/content/validate.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/content/validate.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/content/validate.ts src/engine/content/validate.test.ts
git commit -m "feat(content): cross-reference and rule/mechanic validator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The M1 content pack and the validate CLI

The pack below is the complete M1 content (spec §15, M1 table): 10 topics, 15 templates, ~80 objects, 63 glyphs, 8 scenes, every spoken line they need. Asset paths point at files that Plan 1B imports from OpenMoji; nothing here checks that the files exist yet.

**Files:**
- Create: `content/topics.json`, `content/objects.json`, `content/glyphs.json`, `content/scenes.json`, `content/lines.json`, `content/scenarios.json`, `content/sequences.json`, `content/templates/*.json`, `scripts/validate-content.ts`
- Test: `src/engine/content/pack.test.ts`

- [ ] **Step 1: Write the failing test that loads and validates the real pack**

```ts
// src/engine/content/pack.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from './readPackFromDisk';
import { validatePack } from './validate';

describe('the M1 content pack', () => {
  it('loads, validates with no errors, and covers the M1 topics', () => {
    const pack = readPack();
    const issues = validatePack(pack);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect([...pack.topics.keys()].sort()).toEqual([
      'big-small', 'capital-small', 'counting', 'cvc', 'feelings', 'good-habits', 'healthy-food', 'kind-fair', 'letters', 'rhyming',
    ]);
    expect(pack.templates.size).toBe(15);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/content/pack.test.ts`
Expected: FAIL — `ENOENT ... content/topics.json`.

- [ ] **Step 3: Write `content/topics.json`**

```json
[
  { "id": "letters", "subject": "literacy", "title": "Letters A–Z",
    "goals": [{ "id": "letters.recognise", "title": "Recognise a named letter, upper or lower case" }] },
  { "id": "capital-small", "subject": "literacy", "title": "Capital ↔ small letters",
    "goals": [{ "id": "capital-small.match", "title": "Match a capital letter to its small letter" }] },
  { "id": "rhyming", "subject": "phonics", "title": "Rhyming words",
    "goals": [{ "id": "rhyming.match", "title": "Match words that rhyme" }] },
  { "id": "cvc", "subject": "phonics", "title": "Short vowels & CVC words",
    "goals": [{ "id": "cvc.hear", "title": "Hear a CVC word and find its picture" }] },
  { "id": "big-small", "subject": "numeracy", "title": "Big & small",
    "goals": [{ "id": "big-small.identify", "title": "Identify the bigger of two or more" },
              { "id": "big-small.sort", "title": "Sort things into big and small" }] },
  { "id": "counting", "subject": "numeracy", "title": "Counting",
    "goals": [{ "id": "counting.match", "title": "Count a group and match it to its numeral" },
              { "id": "counting.give", "title": "Give exactly n things" }] },
  { "id": "good-habits", "subject": "awareness", "title": "Good habits & manners",
    "goals": [{ "id": "good-habits.routine", "title": "Order the steps of a daily routine" },
              { "id": "good-habits.clean", "title": "Know what keeps you neat and clean" }] },
  { "id": "healthy-food", "subject": "awareness", "title": "Fruits, vegetables & healthy food",
    "goals": [{ "id": "healthy-food.sort", "title": "Tell fruits from vegetables" },
              { "id": "healthy-food.choose", "title": "Choose healthy food over junk" }] },
  { "id": "feelings", "subject": "wellness", "title": "Feelings",
    "goals": [{ "id": "feelings.name", "title": "Recognise a named feeling" },
              { "id": "feelings.read", "title": "Read a feeling from a situation" }] },
  { "id": "kind-fair", "subject": "wellness", "title": "Kind & fair",
    "goals": [{ "id": "kind-fair.choose", "title": "Choose the kind action" }] }
]
```

- [ ] **Step 4: Write `content/objects.json`**

Every object: `lineId` is `obj.<id>`, `asset` is `objects/<id>.svg`. `sizePair` marks things that make sense drawn big and small; `countable` marks things that make sense in groups; `cvc` + `rhymeGroup` drive the phonics templates.

```json
[
  { "id": "apple", "name": "apple", "lineId": "obj.apple", "asset": "objects/apple.svg", "category": "fruit", "tags": { "sizePair": true, "countable": true, "healthy": true, "colour": "red" } },
  { "id": "banana", "name": "banana", "lineId": "obj.banana", "asset": "objects/banana.svg", "category": "fruit", "tags": { "sizePair": true, "countable": true, "healthy": true, "colour": "yellow" } },
  { "id": "mango", "name": "mango", "plural": "mangoes", "lineId": "obj.mango", "asset": "objects/mango.svg", "category": "fruit", "tags": { "sizePair": true, "countable": true, "healthy": true, "colour": "yellow" } },
  { "id": "grapes", "name": "grapes", "plural": "bunches of grapes", "lineId": "obj.grapes", "asset": "objects/grapes.svg", "category": "fruit", "tags": { "sizePair": true, "healthy": true, "colour": "purple" } },
  { "id": "orange", "name": "orange", "lineId": "obj.orange", "asset": "objects/orange.svg", "category": "fruit", "tags": { "sizePair": true, "countable": true, "healthy": true, "colour": "orange" } },
  { "id": "watermelon", "name": "watermelon", "lineId": "obj.watermelon", "asset": "objects/watermelon.svg", "category": "fruit", "tags": { "sizePair": true, "healthy": true, "colour": "green" } },
  { "id": "carrot", "name": "carrot", "lineId": "obj.carrot", "asset": "objects/carrot.svg", "category": "vegetable", "tags": { "sizePair": true, "countable": true, "healthy": true, "colour": "orange" } },
  { "id": "tomato", "name": "tomato", "plural": "tomatoes", "lineId": "obj.tomato", "asset": "objects/tomato.svg", "category": "vegetable", "tags": { "sizePair": true, "countable": true, "healthy": true, "colour": "red" } },
  { "id": "potato", "name": "potato", "plural": "potatoes", "lineId": "obj.potato", "asset": "objects/potato.svg", "category": "vegetable", "tags": { "sizePair": true, "countable": true, "healthy": true, "colour": "brown" } },
  { "id": "brinjal", "name": "brinjal", "lineId": "obj.brinjal", "asset": "objects/brinjal.svg", "category": "vegetable", "tags": { "sizePair": true, "healthy": true, "colour": "purple" } },
  { "id": "onion", "name": "onion", "lineId": "obj.onion", "asset": "objects/onion.svg", "category": "vegetable", "tags": { "sizePair": true, "countable": true, "healthy": true } },
  { "id": "cabbage", "name": "cabbage", "lineId": "obj.cabbage", "asset": "objects/cabbage.svg", "category": "vegetable", "tags": { "sizePair": true, "healthy": true, "colour": "green" } },
  { "id": "milk", "name": "glass of milk", "plural": "glasses of milk", "lineId": "obj.milk", "asset": "objects/milk.svg", "category": "meal", "tags": { "healthy": true } },
  { "id": "egg", "name": "egg", "lineId": "obj.egg", "asset": "objects/egg.svg", "category": "meal", "tags": { "countable": true, "healthy": true } },
  { "id": "roti", "name": "roti", "lineId": "obj.roti", "asset": "objects/roti.svg", "category": "meal", "tags": { "countable": true, "healthy": true } },
  { "id": "rice", "name": "bowl of rice", "plural": "bowls of rice", "lineId": "obj.rice", "asset": "objects/rice.svg", "category": "meal", "tags": { "healthy": true } },
  { "id": "dal", "name": "bowl of dal", "plural": "bowls of dal", "lineId": "obj.dal", "asset": "objects/dal.svg", "category": "meal", "tags": { "healthy": true } },
  { "id": "chocolate", "name": "chocolate", "lineId": "obj.chocolate", "asset": "objects/chocolate.svg", "category": "junk", "tags": { "healthy": false, "teethFriendly": false } },
  { "id": "chips", "name": "packet of chips", "plural": "packets of chips", "lineId": "obj.chips", "asset": "objects/chips.svg", "category": "junk", "tags": { "healthy": false } },
  { "id": "candy", "name": "candy", "plural": "candies", "lineId": "obj.candy", "asset": "objects/candy.svg", "category": "junk", "tags": { "healthy": false, "teethFriendly": false, "countable": true } },
  { "id": "cola", "name": "cola", "lineId": "obj.cola", "asset": "objects/cola.svg", "category": "junk", "tags": { "healthy": false, "teethFriendly": false } },
  { "id": "ice-cream", "name": "ice cream", "lineId": "obj.ice-cream", "asset": "objects/ice-cream.svg", "category": "junk", "tags": { "healthy": false } },
  { "id": "dog", "name": "dog", "lineId": "obj.dog", "asset": "objects/dog.svg", "category": "animal", "tags": { "sizePair": true, "countable": true, "cvc": true, "rhymeGroup": "og", "sound": "sfx/dog.mp3" } },
  { "id": "cat", "name": "cat", "lineId": "obj.cat", "asset": "objects/cat.svg", "category": "animal", "tags": { "sizePair": true, "countable": true, "cvc": true, "rhymeGroup": "at", "sound": "sfx/cat.mp3" } },
  { "id": "cow", "name": "cow", "lineId": "obj.cow", "asset": "objects/cow.svg", "category": "animal", "tags": { "sizePair": true, "countable": true, "sound": "sfx/cow.mp3" } },
  { "id": "hen", "name": "hen", "lineId": "obj.hen", "asset": "objects/hen.svg", "category": "animal", "tags": { "sizePair": true, "countable": true, "cvc": true, "rhymeGroup": "en" } },
  { "id": "elephant", "name": "elephant", "lineId": "obj.elephant", "asset": "objects/elephant.svg", "category": "animal", "tags": { "sizePair": true, "countable": true } },
  { "id": "lion", "name": "lion", "lineId": "obj.lion", "asset": "objects/lion.svg", "category": "animal", "tags": { "sizePair": true, "countable": true } },
  { "id": "fish", "name": "fish", "plural": "fish", "lineId": "obj.fish", "asset": "objects/fish.svg", "category": "animal", "tags": { "sizePair": true, "countable": true } },
  { "id": "frog", "name": "frog", "lineId": "obj.frog", "asset": "objects/frog.svg", "category": "animal", "tags": { "sizePair": true, "countable": true, "rhymeGroup": "og" } },
  { "id": "pig", "name": "pig", "lineId": "obj.pig", "asset": "objects/pig.svg", "category": "animal", "tags": { "sizePair": true, "countable": true, "cvc": true } },
  { "id": "bat", "name": "bat", "lineId": "obj.bat", "asset": "objects/bat.svg", "category": "animal", "tags": { "sizePair": true, "cvc": true, "rhymeGroup": "at" } },
  { "id": "fox", "name": "fox", "plural": "foxes", "lineId": "obj.fox", "asset": "objects/fox.svg", "category": "animal", "tags": { "sizePair": true, "cvc": true, "rhymeGroup": "ox" } },
  { "id": "bug", "name": "bug", "lineId": "obj.bug", "asset": "objects/bug.svg", "category": "animal", "tags": { "sizePair": true, "countable": true, "cvc": true, "rhymeGroup": "ug" } },
  { "id": "ball", "name": "ball", "lineId": "obj.ball", "asset": "objects/ball.svg", "category": "thing", "tags": { "sizePair": true, "countable": true, "colour": "red" } },
  { "id": "hat", "name": "hat", "lineId": "obj.hat", "asset": "objects/hat.svg", "category": "thing", "tags": { "sizePair": true, "countable": true, "cvc": true, "rhymeGroup": "at" } },
  { "id": "mat", "name": "mat", "lineId": "obj.mat", "asset": "objects/mat.svg", "category": "thing", "tags": { "sizePair": true, "cvc": true, "rhymeGroup": "at" } },
  { "id": "cup", "name": "cup", "lineId": "obj.cup", "asset": "objects/cup.svg", "category": "thing", "tags": { "sizePair": true, "countable": true, "cvc": true } },
  { "id": "bus", "name": "bus", "plural": "buses", "lineId": "obj.bus", "asset": "objects/bus.svg", "category": "thing", "tags": { "sizePair": true, "countable": true, "cvc": true, "transportMode": "land" } },
  { "id": "car", "name": "car", "lineId": "obj.car", "asset": "objects/car.svg", "category": "thing", "tags": { "sizePair": true, "countable": true, "transportMode": "land" } },
  { "id": "bed", "name": "bed", "lineId": "obj.bed", "asset": "objects/bed.svg", "category": "thing", "tags": { "sizePair": true, "cvc": true } },
  { "id": "sun", "name": "sun", "lineId": "obj.sun", "asset": "objects/sun.svg", "category": "thing", "tags": { "cvc": true, "rhymeGroup": "un" } },
  { "id": "bun", "name": "bun", "lineId": "obj.bun", "asset": "objects/bun.svg", "category": "thing", "tags": { "sizePair": true, "countable": true, "cvc": true, "rhymeGroup": "un" } },
  { "id": "pen", "name": "pen", "lineId": "obj.pen", "asset": "objects/pen.svg", "category": "stationery", "tags": { "sizePair": true, "countable": true, "cvc": true, "rhymeGroup": "en", "neatAndClean": false } },
  { "id": "fan", "name": "fan", "lineId": "obj.fan", "asset": "objects/fan.svg", "category": "thing", "tags": { "sizePair": true, "cvc": true, "rhymeGroup": "an" } },
  { "id": "van", "name": "van", "lineId": "obj.van", "asset": "objects/van.svg", "category": "thing", "tags": { "sizePair": true, "countable": true, "cvc": true, "rhymeGroup": "an", "transportMode": "land" } },
  { "id": "pan", "name": "pan", "lineId": "obj.pan", "asset": "objects/pan.svg", "category": "thing", "tags": { "sizePair": true, "cvc": true, "rhymeGroup": "an" } },
  { "id": "box", "name": "box", "plural": "boxes", "lineId": "obj.box", "asset": "objects/box.svg", "category": "thing", "tags": { "sizePair": true, "countable": true, "cvc": true, "rhymeGroup": "ox" } },
  { "id": "log", "name": "log", "lineId": "obj.log", "asset": "objects/log.svg", "category": "thing", "tags": { "sizePair": true, "cvc": true, "rhymeGroup": "og" } },
  { "id": "mug", "name": "mug", "lineId": "obj.mug", "asset": "objects/mug.svg", "category": "thing", "tags": { "sizePair": true, "countable": true, "cvc": true, "rhymeGroup": "ug" } },
  { "id": "rug", "name": "rug", "lineId": "obj.rug", "asset": "objects/rug.svg", "category": "thing", "tags": { "sizePair": true, "cvc": true, "rhymeGroup": "ug" } },
  { "id": "pot", "name": "pot", "lineId": "obj.pot", "asset": "objects/pot.svg", "category": "thing", "tags": { "sizePair": true, "cvc": true } },
  { "id": "star", "name": "star", "lineId": "obj.star", "asset": "objects/star.svg", "category": "thing", "tags": { "sizePair": true, "countable": true, "colour": "yellow" } },
  { "id": "soap", "name": "soap", "lineId": "obj.soap", "asset": "objects/soap.svg", "category": "hygiene", "tags": { "neatAndClean": true } },
  { "id": "towel", "name": "towel", "lineId": "obj.towel", "asset": "objects/towel.svg", "category": "hygiene", "tags": { "neatAndClean": true } },
  { "id": "toothbrush", "name": "toothbrush", "plural": "toothbrushes", "lineId": "obj.toothbrush", "asset": "objects/toothbrush.svg", "category": "hygiene", "tags": { "neatAndClean": true } },
  { "id": "toothpaste", "name": "toothpaste", "lineId": "obj.toothpaste", "asset": "objects/toothpaste.svg", "category": "hygiene", "tags": { "neatAndClean": true } },
  { "id": "comb", "name": "comb", "lineId": "obj.comb", "asset": "objects/comb.svg", "category": "hygiene", "tags": { "neatAndClean": true } },
  { "id": "nail-cutter", "name": "nail cutter", "lineId": "obj.nail-cutter", "asset": "objects/nail-cutter.svg", "category": "hygiene", "tags": { "neatAndClean": true } },
  { "id": "handkerchief", "name": "handkerchief", "lineId": "obj.handkerchief", "asset": "objects/handkerchief.svg", "category": "hygiene", "tags": { "neatAndClean": true } },
  { "id": "shampoo", "name": "shampoo", "lineId": "obj.shampoo", "asset": "objects/shampoo.svg", "category": "hygiene", "tags": { "neatAndClean": true } },
  { "id": "teddy", "name": "teddy bear", "lineId": "obj.teddy", "asset": "objects/teddy.svg", "category": "toy", "tags": { "sizePair": true, "countable": true, "neatAndClean": false } },
  { "id": "toy-car", "name": "toy car", "lineId": "obj.toy-car", "asset": "objects/toy-car.svg", "category": "toy", "tags": { "sizePair": true, "countable": true, "neatAndClean": false } },
  { "id": "blocks", "name": "blocks", "plural": "blocks", "lineId": "obj.blocks", "asset": "objects/blocks.svg", "category": "toy", "tags": { "neatAndClean": false } },
  { "id": "kite", "name": "kite", "lineId": "obj.kite", "asset": "objects/kite.svg", "category": "toy", "tags": { "sizePair": true, "countable": true, "neatAndClean": false } },
  { "id": "book", "name": "book", "lineId": "obj.book", "asset": "objects/book.svg", "category": "stationery", "tags": { "sizePair": true, "countable": true, "neatAndClean": false } },
  { "id": "bag", "name": "school bag", "lineId": "obj.bag", "asset": "objects/bag.svg", "category": "stationery", "tags": { "sizePair": true, "neatAndClean": false } },
  { "id": "pencil", "name": "pencil", "lineId": "obj.pencil", "asset": "objects/pencil.svg", "category": "stationery", "tags": { "sizePair": true, "countable": true, "neatAndClean": false } },
  { "id": "crayons", "name": "crayons", "plural": "crayons", "lineId": "obj.crayons", "asset": "objects/crayons.svg", "category": "stationery", "tags": { "neatAndClean": false } },
  { "id": "happy", "name": "happy", "lineId": "obj.happy", "asset": "feelings/happy.svg", "category": "feeling" },
  { "id": "sad", "name": "sad", "lineId": "obj.sad", "asset": "feelings/sad.svg", "category": "feeling" },
  { "id": "angry", "name": "angry", "lineId": "obj.angry", "asset": "feelings/angry.svg", "category": "feeling" },
  { "id": "scared", "name": "scared", "lineId": "obj.scared", "asset": "feelings/scared.svg", "category": "feeling" },
  { "id": "surprised", "name": "surprised", "lineId": "obj.surprised", "asset": "feelings/surprised.svg", "category": "feeling" },
  { "id": "sleepy", "name": "sleepy", "lineId": "obj.sleepy", "asset": "feelings/sleepy.svg", "category": "feeling" },
  { "id": "wake-up", "name": "wake up", "lineId": "obj.wake-up", "asset": "routine/wake-up.svg", "category": "routine" },
  { "id": "brush-teeth", "name": "brush teeth", "lineId": "obj.brush-teeth", "asset": "routine/brush-teeth.svg", "category": "routine" },
  { "id": "take-bath", "name": "take a bath", "lineId": "obj.take-bath", "asset": "routine/take-bath.svg", "category": "routine" },
  { "id": "eat-breakfast", "name": "eat breakfast", "lineId": "obj.eat-breakfast", "asset": "routine/eat-breakfast.svg", "category": "routine" },
  { "id": "pack-bag", "name": "pack the bag", "lineId": "obj.pack-bag", "asset": "routine/pack-bag.svg", "category": "routine" },
  { "id": "eat-dinner", "name": "eat dinner", "lineId": "obj.eat-dinner", "asset": "routine/eat-dinner.svg", "category": "routine" },
  { "id": "wear-pyjamas", "name": "wear pyjamas", "lineId": "obj.wear-pyjamas", "asset": "routine/wear-pyjamas.svg", "category": "routine" },
  { "id": "read-story", "name": "read a story", "lineId": "obj.read-story", "asset": "routine/read-story.svg", "category": "routine" },
  { "id": "go-to-sleep", "name": "go to sleep", "lineId": "obj.go-to-sleep", "asset": "routine/go-to-sleep.svg", "category": "routine" },
  { "id": "hug", "name": "give a hug", "lineId": "obj.hug", "asset": "actions/hug.svg", "category": "action" },
  { "id": "laugh", "name": "laugh at them", "lineId": "obj.laugh", "asset": "actions/laugh.svg", "category": "action" },
  { "id": "walk-away", "name": "walk away", "lineId": "obj.walk-away", "asset": "actions/walk-away.svg", "category": "action" },
  { "id": "share", "name": "share", "lineId": "obj.share", "asset": "actions/share.svg", "category": "action" },
  { "id": "eat-alone", "name": "eat it all alone", "lineId": "obj.eat-alone", "asset": "actions/eat-alone.svg", "category": "action" },
  { "id": "wait-turn", "name": "wait for your turn", "lineId": "obj.wait-turn", "asset": "actions/wait-turn.svg", "category": "action" },
  { "id": "push", "name": "push to the front", "lineId": "obj.push", "asset": "actions/push.svg", "category": "action" },
  { "id": "help-up", "name": "help them up", "lineId": "obj.help-up", "asset": "actions/help-up.svg", "category": "action" }
]
```

- [ ] **Step 5: Write `content/glyphs.json`**

Letters share one spoken line per pair (`glyph.letter.a` says "A"); `confusables` feed high-difficulty distractors.

```json
[
  { "id": "A", "char": "A", "kind": "letter", "case": "upper", "pairKey": "a", "lineId": "glyph.letter.a", "confusables": ["V", "H"] },
  { "id": "B", "char": "B", "kind": "letter", "case": "upper", "pairKey": "b", "lineId": "glyph.letter.b", "confusables": ["D", "P", "R"] },
  { "id": "C", "char": "C", "kind": "letter", "case": "upper", "pairKey": "c", "lineId": "glyph.letter.c", "confusables": ["G", "O"] },
  { "id": "D", "char": "D", "kind": "letter", "case": "upper", "pairKey": "d", "lineId": "glyph.letter.d", "confusables": ["B", "O", "P"] },
  { "id": "E", "char": "E", "kind": "letter", "case": "upper", "pairKey": "e", "lineId": "glyph.letter.e", "confusables": ["F"] },
  { "id": "F", "char": "F", "kind": "letter", "case": "upper", "pairKey": "f", "lineId": "glyph.letter.f", "confusables": ["E"] },
  { "id": "G", "char": "G", "kind": "letter", "case": "upper", "pairKey": "g", "lineId": "glyph.letter.g", "confusables": ["C", "O", "Q"] },
  { "id": "H", "char": "H", "kind": "letter", "case": "upper", "pairKey": "h", "lineId": "glyph.letter.h", "confusables": ["N", "A"] },
  { "id": "I", "char": "I", "kind": "letter", "case": "upper", "pairKey": "i", "lineId": "glyph.letter.i", "confusables": ["T", "L", "J"] },
  { "id": "J", "char": "J", "kind": "letter", "case": "upper", "pairKey": "j", "lineId": "glyph.letter.j", "confusables": ["I"] },
  { "id": "K", "char": "K", "kind": "letter", "case": "upper", "pairKey": "k", "lineId": "glyph.letter.k", "confusables": ["R", "X"] },
  { "id": "L", "char": "L", "kind": "letter", "case": "upper", "pairKey": "l", "lineId": "glyph.letter.l", "confusables": ["I"] },
  { "id": "M", "char": "M", "kind": "letter", "case": "upper", "pairKey": "m", "lineId": "glyph.letter.m", "confusables": ["N", "W"] },
  { "id": "N", "char": "N", "kind": "letter", "case": "upper", "pairKey": "n", "lineId": "glyph.letter.n", "confusables": ["M", "Z"] },
  { "id": "O", "char": "O", "kind": "letter", "case": "upper", "pairKey": "o", "lineId": "glyph.letter.o", "confusables": ["Q", "C", "D"] },
  { "id": "P", "char": "P", "kind": "letter", "case": "upper", "pairKey": "p", "lineId": "glyph.letter.p", "confusables": ["B", "R", "D"] },
  { "id": "Q", "char": "Q", "kind": "letter", "case": "upper", "pairKey": "q", "lineId": "glyph.letter.q", "confusables": ["O", "G"] },
  { "id": "R", "char": "R", "kind": "letter", "case": "upper", "pairKey": "r", "lineId": "glyph.letter.r", "confusables": ["B", "P", "K"] },
  { "id": "S", "char": "S", "kind": "letter", "case": "upper", "pairKey": "s", "lineId": "glyph.letter.s", "confusables": ["Z"] },
  { "id": "T", "char": "T", "kind": "letter", "case": "upper", "pairKey": "t", "lineId": "glyph.letter.t", "confusables": ["Y", "I"] },
  { "id": "U", "char": "U", "kind": "letter", "case": "upper", "pairKey": "u", "lineId": "glyph.letter.u", "confusables": ["V"] },
  { "id": "V", "char": "V", "kind": "letter", "case": "upper", "pairKey": "v", "lineId": "glyph.letter.v", "confusables": ["W", "U", "Y"] },
  { "id": "W", "char": "W", "kind": "letter", "case": "upper", "pairKey": "w", "lineId": "glyph.letter.w", "confusables": ["M", "V"] },
  { "id": "X", "char": "X", "kind": "letter", "case": "upper", "pairKey": "x", "lineId": "glyph.letter.x", "confusables": ["K"] },
  { "id": "Y", "char": "Y", "kind": "letter", "case": "upper", "pairKey": "y", "lineId": "glyph.letter.y", "confusables": ["V", "T"] },
  { "id": "Z", "char": "Z", "kind": "letter", "case": "upper", "pairKey": "z", "lineId": "glyph.letter.z", "confusables": ["S", "N"] },
  { "id": "a", "char": "a", "kind": "letter", "case": "lower", "pairKey": "a", "lineId": "glyph.letter.a", "confusables": ["o"] },
  { "id": "b", "char": "b", "kind": "letter", "case": "lower", "pairKey": "b", "lineId": "glyph.letter.b", "confusables": ["d", "p", "q"] },
  { "id": "c", "char": "c", "kind": "letter", "case": "lower", "pairKey": "c", "lineId": "glyph.letter.c", "confusables": ["e", "o"] },
  { "id": "d", "char": "d", "kind": "letter", "case": "lower", "pairKey": "d", "lineId": "glyph.letter.d", "confusables": ["b", "p", "q"] },
  { "id": "e", "char": "e", "kind": "letter", "case": "lower", "pairKey": "e", "lineId": "glyph.letter.e", "confusables": ["c", "o"] },
  { "id": "f", "char": "f", "kind": "letter", "case": "lower", "pairKey": "f", "lineId": "glyph.letter.f", "confusables": ["t"] },
  { "id": "g", "char": "g", "kind": "letter", "case": "lower", "pairKey": "g", "lineId": "glyph.letter.g", "confusables": ["q", "y"] },
  { "id": "h", "char": "h", "kind": "letter", "case": "lower", "pairKey": "h", "lineId": "glyph.letter.h", "confusables": ["k", "n"] },
  { "id": "i", "char": "i", "kind": "letter", "case": "lower", "pairKey": "i", "lineId": "glyph.letter.i", "confusables": ["l", "j"] },
  { "id": "j", "char": "j", "kind": "letter", "case": "lower", "pairKey": "j", "lineId": "glyph.letter.j", "confusables": ["i"] },
  { "id": "k", "char": "k", "kind": "letter", "case": "lower", "pairKey": "k", "lineId": "glyph.letter.k", "confusables": ["h"] },
  { "id": "l", "char": "l", "kind": "letter", "case": "lower", "pairKey": "l", "lineId": "glyph.letter.l", "confusables": ["i", "t"] },
  { "id": "m", "char": "m", "kind": "letter", "case": "lower", "pairKey": "m", "lineId": "glyph.letter.m", "confusables": ["n", "w"] },
  { "id": "n", "char": "n", "kind": "letter", "case": "lower", "pairKey": "n", "lineId": "glyph.letter.n", "confusables": ["m", "u", "h"] },
  { "id": "o", "char": "o", "kind": "letter", "case": "lower", "pairKey": "o", "lineId": "glyph.letter.o", "confusables": ["c", "e", "a"] },
  { "id": "p", "char": "p", "kind": "letter", "case": "lower", "pairKey": "p", "lineId": "glyph.letter.p", "confusables": ["b", "d", "q"] },
  { "id": "q", "char": "q", "kind": "letter", "case": "lower", "pairKey": "q", "lineId": "glyph.letter.q", "confusables": ["b", "d", "p"] },
  { "id": "r", "char": "r", "kind": "letter", "case": "lower", "pairKey": "r", "lineId": "glyph.letter.r", "confusables": ["n"] },
  { "id": "s", "char": "s", "kind": "letter", "case": "lower", "pairKey": "s", "lineId": "glyph.letter.s", "confusables": ["z"] },
  { "id": "t", "char": "t", "kind": "letter", "case": "lower", "pairKey": "t", "lineId": "glyph.letter.t", "confusables": ["l", "f"] },
  { "id": "u", "char": "u", "kind": "letter", "case": "lower", "pairKey": "u", "lineId": "glyph.letter.u", "confusables": ["n", "v"] },
  { "id": "v", "char": "v", "kind": "letter", "case": "lower", "pairKey": "v", "lineId": "glyph.letter.v", "confusables": ["u", "w"] },
  { "id": "w", "char": "w", "kind": "letter", "case": "lower", "pairKey": "w", "lineId": "glyph.letter.w", "confusables": ["v", "m"] },
  { "id": "x", "char": "x", "kind": "letter", "case": "lower", "pairKey": "x", "lineId": "glyph.letter.x", "confusables": ["k"] },
  { "id": "y", "char": "y", "kind": "letter", "case": "lower", "pairKey": "y", "lineId": "glyph.letter.y", "confusables": ["g", "v"] },
  { "id": "z", "char": "z", "kind": "letter", "case": "lower", "pairKey": "z", "lineId": "glyph.letter.z", "confusables": ["s"] },
  { "id": "n0", "char": "0", "kind": "number", "pairKey": "n0", "value": 0, "lineId": "glyph.num.0", "confusables": ["6"] },
  { "id": "n1", "char": "1", "kind": "number", "pairKey": "n1", "value": 1, "lineId": "glyph.num.1", "confusables": ["7"] },
  { "id": "n2", "char": "2", "kind": "number", "pairKey": "n2", "value": 2, "lineId": "glyph.num.2", "confusables": ["5"] },
  { "id": "n3", "char": "3", "kind": "number", "pairKey": "n3", "value": 3, "lineId": "glyph.num.3", "confusables": ["8"] },
  { "id": "n4", "char": "4", "kind": "number", "pairKey": "n4", "value": 4, "lineId": "glyph.num.4", "confusables": ["9"] },
  { "id": "n5", "char": "5", "kind": "number", "pairKey": "n5", "value": 5, "lineId": "glyph.num.5", "confusables": ["2"] },
  { "id": "n6", "char": "6", "kind": "number", "pairKey": "n6", "value": 6, "lineId": "glyph.num.6", "confusables": ["9", "0"] },
  { "id": "n7", "char": "7", "kind": "number", "pairKey": "n7", "value": 7, "lineId": "glyph.num.7", "confusables": ["1"] },
  { "id": "n8", "char": "8", "kind": "number", "pairKey": "n8", "value": 8, "lineId": "glyph.num.8", "confusables": ["3"] },
  { "id": "n9", "char": "9", "kind": "number", "pairKey": "n9", "value": 9, "lineId": "glyph.num.9", "confusables": ["6"] },
  { "id": "n10", "char": "10", "kind": "number", "pairKey": "n10", "value": 10, "lineId": "glyph.num.10", "confusables": [] }
]
```

- [ ] **Step 6: Write `content/scenes.json`**

```json
[
  { "id": "garden", "asset": "scenes/garden.svg", "theme": "garden" },
  { "id": "kitchen", "asset": "scenes/kitchen.svg", "theme": "kitchen" },
  { "id": "playground", "asset": "scenes/playground.svg", "theme": "playground" },
  { "id": "classroom", "asset": "scenes/classroom.svg", "theme": "classroom" },
  { "id": "bathroom", "asset": "scenes/bathroom.svg", "theme": "bathroom" },
  { "id": "bedroom", "asset": "scenes/bedroom.svg", "theme": "bedroom" },
  { "id": "road", "asset": "scenes/road.svg", "theme": "road" },
  { "id": "farm", "asset": "scenes/farm.svg", "theme": "farm" }
]
```

- [ ] **Step 7: Write `content/lines.json`**

Object and glyph name lines are one variant each (they are spliced into prompts). Prompt lines have 2–4 wordings that keep the key word.

```json
[
  { "id": "obj.apple", "variants": ["apple"] }, { "id": "obj.banana", "variants": ["banana"] }, { "id": "obj.mango", "variants": ["mango"] },
  { "id": "obj.grapes", "variants": ["grapes"] }, { "id": "obj.orange", "variants": ["orange"] }, { "id": "obj.watermelon", "variants": ["watermelon"] },
  { "id": "obj.carrot", "variants": ["carrot"] }, { "id": "obj.tomato", "variants": ["tomato"] }, { "id": "obj.potato", "variants": ["potato"] },
  { "id": "obj.brinjal", "variants": ["brinjal"] }, { "id": "obj.onion", "variants": ["onion"] }, { "id": "obj.cabbage", "variants": ["cabbage"] },
  { "id": "obj.milk", "variants": ["glass of milk"] }, { "id": "obj.egg", "variants": ["egg"] }, { "id": "obj.roti", "variants": ["roti"] },
  { "id": "obj.rice", "variants": ["bowl of rice"] }, { "id": "obj.dal", "variants": ["bowl of dal"] }, { "id": "obj.chocolate", "variants": ["chocolate"] },
  { "id": "obj.chips", "variants": ["packet of chips"] }, { "id": "obj.candy", "variants": ["candy"] }, { "id": "obj.cola", "variants": ["cola"] },
  { "id": "obj.ice-cream", "variants": ["ice cream"] },
  { "id": "obj.dog", "variants": ["dog"] }, { "id": "obj.cat", "variants": ["cat"] }, { "id": "obj.cow", "variants": ["cow"] }, { "id": "obj.hen", "variants": ["hen"] },
  { "id": "obj.elephant", "variants": ["elephant"] }, { "id": "obj.lion", "variants": ["lion"] }, { "id": "obj.fish", "variants": ["fish"] },
  { "id": "obj.frog", "variants": ["frog"] }, { "id": "obj.pig", "variants": ["pig"] }, { "id": "obj.bat", "variants": ["bat"] }, { "id": "obj.fox", "variants": ["fox"] },
  { "id": "obj.bug", "variants": ["bug"] }, { "id": "obj.ball", "variants": ["ball"] }, { "id": "obj.hat", "variants": ["hat"] }, { "id": "obj.mat", "variants": ["mat"] },
  { "id": "obj.cup", "variants": ["cup"] }, { "id": "obj.bus", "variants": ["bus"] }, { "id": "obj.car", "variants": ["car"] }, { "id": "obj.bed", "variants": ["bed"] },
  { "id": "obj.sun", "variants": ["sun"] }, { "id": "obj.bun", "variants": ["bun"] }, { "id": "obj.pen", "variants": ["pen"] }, { "id": "obj.fan", "variants": ["fan"] },
  { "id": "obj.van", "variants": ["van"] }, { "id": "obj.pan", "variants": ["pan"] }, { "id": "obj.box", "variants": ["box"] }, { "id": "obj.log", "variants": ["log"] },
  { "id": "obj.mug", "variants": ["mug"] }, { "id": "obj.rug", "variants": ["rug"] }, { "id": "obj.pot", "variants": ["pot"] }, { "id": "obj.star", "variants": ["star"] },
  { "id": "obj.soap", "variants": ["soap"] }, { "id": "obj.towel", "variants": ["towel"] }, { "id": "obj.toothbrush", "variants": ["toothbrush"] },
  { "id": "obj.toothpaste", "variants": ["toothpaste"] }, { "id": "obj.comb", "variants": ["comb"] }, { "id": "obj.nail-cutter", "variants": ["nail cutter"] },
  { "id": "obj.handkerchief", "variants": ["handkerchief"] }, { "id": "obj.shampoo", "variants": ["shampoo"] },
  { "id": "obj.teddy", "variants": ["teddy bear"] }, { "id": "obj.toy-car", "variants": ["toy car"] }, { "id": "obj.blocks", "variants": ["blocks"] }, { "id": "obj.kite", "variants": ["kite"] },
  { "id": "obj.book", "variants": ["book"] }, { "id": "obj.bag", "variants": ["school bag"] }, { "id": "obj.pencil", "variants": ["pencil"] }, { "id": "obj.crayons", "variants": ["crayons"] },
  { "id": "obj.happy", "variants": ["happy"] }, { "id": "obj.sad", "variants": ["sad"] }, { "id": "obj.angry", "variants": ["angry"] },
  { "id": "obj.scared", "variants": ["scared"] }, { "id": "obj.surprised", "variants": ["surprised"] }, { "id": "obj.sleepy", "variants": ["sleepy"] },
  { "id": "obj.wake-up", "variants": ["wake up"] }, { "id": "obj.brush-teeth", "variants": ["brush teeth"] }, { "id": "obj.take-bath", "variants": ["take a bath"] },
  { "id": "obj.eat-breakfast", "variants": ["eat breakfast"] }, { "id": "obj.pack-bag", "variants": ["pack the bag"] }, { "id": "obj.eat-dinner", "variants": ["eat dinner"] },
  { "id": "obj.wear-pyjamas", "variants": ["wear pyjamas"] }, { "id": "obj.read-story", "variants": ["read a story"] }, { "id": "obj.go-to-sleep", "variants": ["go to sleep"] },
  { "id": "obj.hug", "variants": ["give a hug"] }, { "id": "obj.laugh", "variants": ["laugh at them"] }, { "id": "obj.walk-away", "variants": ["walk away"] },
  { "id": "obj.share", "variants": ["share"] }, { "id": "obj.eat-alone", "variants": ["eat it all alone"] }, { "id": "obj.wait-turn", "variants": ["wait for your turn"] },
  { "id": "obj.push", "variants": ["push to the front"] }, { "id": "obj.help-up", "variants": ["help them up"] },

  { "id": "glyph.letter.a", "variants": ["A"] }, { "id": "glyph.letter.b", "variants": ["B"] }, { "id": "glyph.letter.c", "variants": ["C"] }, { "id": "glyph.letter.d", "variants": ["D"] },
  { "id": "glyph.letter.e", "variants": ["E"] }, { "id": "glyph.letter.f", "variants": ["F"] }, { "id": "glyph.letter.g", "variants": ["G"] }, { "id": "glyph.letter.h", "variants": ["H"] },
  { "id": "glyph.letter.i", "variants": ["I"] }, { "id": "glyph.letter.j", "variants": ["J"] }, { "id": "glyph.letter.k", "variants": ["K"] }, { "id": "glyph.letter.l", "variants": ["L"] },
  { "id": "glyph.letter.m", "variants": ["M"] }, { "id": "glyph.letter.n", "variants": ["N"] }, { "id": "glyph.letter.o", "variants": ["O"] }, { "id": "glyph.letter.p", "variants": ["P"] },
  { "id": "glyph.letter.q", "variants": ["Q"] }, { "id": "glyph.letter.r", "variants": ["R"] }, { "id": "glyph.letter.s", "variants": ["S"] }, { "id": "glyph.letter.t", "variants": ["T"] },
  { "id": "glyph.letter.u", "variants": ["U"] }, { "id": "glyph.letter.v", "variants": ["V"] }, { "id": "glyph.letter.w", "variants": ["W"] }, { "id": "glyph.letter.x", "variants": ["X"] },
  { "id": "glyph.letter.y", "variants": ["Y"] }, { "id": "glyph.letter.z", "variants": ["Z"] },
  { "id": "glyph.num.0", "variants": ["zero"] }, { "id": "glyph.num.1", "variants": ["one"] }, { "id": "glyph.num.2", "variants": ["two"] }, { "id": "glyph.num.3", "variants": ["three"] },
  { "id": "glyph.num.4", "variants": ["four"] }, { "id": "glyph.num.5", "variants": ["five"] }, { "id": "glyph.num.6", "variants": ["six"] }, { "id": "glyph.num.7", "variants": ["seven"] },
  { "id": "glyph.num.8", "variants": ["eight"] }, { "id": "glyph.num.9", "variants": ["nine"] }, { "id": "glyph.num.10", "variants": ["ten"] },

  { "id": "prompt.tap_letter", "variants": ["Tap the letter {target}", "Find the letter {target}", "Where is the letter {target}?"] },
  { "id": "prompt.case_match", "variants": ["Match each big letter with its small letter", "Drag the big letter to its small letter"] },
  { "id": "prompt.rhyme_match", "variants": ["Match the words that rhyme", "Which words sound the same at the end? Match them"] },
  { "id": "prompt.find_word", "variants": ["Find the {target}", "Tap the {target}", "Where is the {target}?"] },
  { "id": "prompt.tap_big", "variants": ["Tap the BIG {target}", "Which {target} is big? Tap it", "Find the big {target}"] },
  { "id": "prompt.sort_size", "variants": ["Big things go in the big basket, small things go in the small basket", "Sort them: big basket or small basket?"] },
  { "id": "prompt.count_match", "variants": ["Count each group and match it with the right number", "How many are there? Drag each group to its number"] },
  { "id": "prompt.give_n", "variants": ["Buddy is hungry! Give Buddy {n} {targets}", "Can you give Buddy {n} {targets}?", "Buddy wants {n} {targets}. Drag them to Buddy"] },
  { "id": "prompt.order_morning", "variants": ["Put Buddy's morning in the right order", "What comes first in the morning? Put the cards in order"] },
  { "id": "prompt.order_bedtime", "variants": ["Put Buddy's bedtime in the right order", "What does Buddy do first at night? Put the cards in order"] },
  { "id": "prompt.tap_all_clean", "variants": ["Tap all the things that keep you neat and clean", "Which of these keep you clean? Tap them all"] },
  { "id": "prompt.sort_food", "variants": ["Fruits go in the fruit basket, vegetables go in the vegetable basket", "Is it a fruit or a vegetable? Sort them"] },
  { "id": "prompt.healthy_plate", "variants": ["Buddy is hungry! Put the healthy food on Buddy's plate", "Which foods are good for Buddy? Put them on the plate"] },
  { "id": "prompt.tap_feeling", "variants": ["Which face is {target}? Tap it", "Tap the {target} face", "Find the {target} face"] },
  { "id": "prompt.scene_feeling", "variants": ["How does Buddy feel?"] },
  { "id": "prompt.scene_kind", "variants": ["What would you do?"] },

  { "id": "bin.big", "variants": ["big basket"] }, { "id": "bin.small", "variants": ["small basket"] },
  { "id": "bin.fruit", "variants": ["fruit basket"] }, { "id": "bin.vegetable", "variants": ["vegetable basket"] },
  { "id": "bin.buddy", "variants": ["Buddy"] }, { "id": "bin.plate", "variants": ["Buddy's plate"] },

  { "id": "sc.ice-cream-fell", "variants": ["Oh no! Buddy's ice cream fell on the ground. How does Buddy feel?"] },
  { "id": "sc.birthday-gift", "variants": ["It's Buddy's birthday and he got a big present! How does Buddy feel?"] },
  { "id": "sc.loud-thunder", "variants": ["BOOM! There is loud thunder outside. How does Buddy feel?"] },
  { "id": "sc.toy-broken", "variants": ["Buddy's friend broke his favourite toy car. How does Buddy feel?"] },
  { "id": "sc.friend-crying", "variants": ["Mia is crying in the playground. What would you do?"] },
  { "id": "sc.one-biscuit", "variants": ["Buddy has one biscuit and his friend has none. What should Buddy do?"] },
  { "id": "sc.slide-queue", "variants": ["Everyone is waiting in line for the slide. What should Buddy do?"] },
  { "id": "sc.friend-fell", "variants": ["Buddy's friend fell down and hurt his knee. What would you do?"] },
  { "id": "react.kind", "variants": ["That was kind! Look, Mia is smiling now", "What a kind friend you are!"] },
  { "id": "react.unkind", "variants": ["Hmm, that made Mia feel sad. Let's try a kind one", "That doesn't look kind. Shall we try again?"] },

  { "id": "fb.correct", "variants": ["Yes!", "Well done!", "That's it!", "Super!", "You got it!"] },
  { "id": "fb.try_again", "variants": ["Hmm, try again", "Not that one. Try again!", "Almost! Have another go"] },
  { "id": "fb.shown", "variants": ["It's this one!", "Look, this is the one"] },
  { "id": "fb.set_done", "variants": ["You did it! Time to dance!", "All done! Let's celebrate!", "Hooray! That was great!"] },
  { "id": "fb.your_turn", "variants": ["Your turn! Can you do it like me? One, two, three!"] },
  { "id": "fb.your_turn_cheer", "variants": ["Wow! That was amazing!", "Look at you go!"] },
  { "id": "buddy.greet_morning", "variants": ["Good morning, {name}!", "Rise and shine, {name}!"] },
  { "id": "buddy.greet_afternoon", "variants": ["Hello, {name}! Good afternoon!"] },
  { "id": "buddy.greet_evening", "variants": ["Good evening, {name}!", "Hi {name}! It's nearly bedtime"] },
  { "id": "buddy.replay_hint", "variants": ["Tap the speaker to hear it again"] },
  { "id": "buddy.bridge", "variants": ["Remember how you found the big one before? Now let's try it this way"] }
]
```

- [ ] **Step 8: Write `content/scenarios.json` and `content/sequences.json`**

```json
[
  { "id": "sc.ice-cream-fell", "topicId": "feelings", "narrationLineId": "sc.ice-cream-fell", "vignette": "vignettes/ice-cream-fell.svg",
    "choices": [{ "objectId": "sad", "correct": true }, { "objectId": "happy", "correct": false }, { "objectId": "angry", "correct": false }] },
  { "id": "sc.birthday-gift", "topicId": "feelings", "narrationLineId": "sc.birthday-gift", "vignette": "vignettes/birthday-gift.svg",
    "choices": [{ "objectId": "happy", "correct": true }, { "objectId": "sad", "correct": false }, { "objectId": "scared", "correct": false }] },
  { "id": "sc.loud-thunder", "topicId": "feelings", "narrationLineId": "sc.loud-thunder", "vignette": "vignettes/loud-thunder.svg",
    "choices": [{ "objectId": "scared", "correct": true }, { "objectId": "happy", "correct": false }, { "objectId": "sleepy", "correct": false }] },
  { "id": "sc.toy-broken", "topicId": "feelings", "narrationLineId": "sc.toy-broken", "vignette": "vignettes/toy-broken.svg",
    "choices": [{ "objectId": "angry", "correct": true }, { "objectId": "sad", "correct": true }, { "objectId": "happy", "correct": false }] },
  { "id": "sc.friend-crying", "topicId": "kind-fair", "narrationLineId": "sc.friend-crying", "vignette": "vignettes/friend-crying.svg",
    "choices": [{ "objectId": "hug", "correct": true, "reactionLineId": "react.kind" }, { "objectId": "laugh", "correct": false, "reactionLineId": "react.unkind" }, { "objectId": "walk-away", "correct": false, "reactionLineId": "react.unkind" }] },
  { "id": "sc.one-biscuit", "topicId": "kind-fair", "narrationLineId": "sc.one-biscuit", "vignette": "vignettes/one-biscuit.svg",
    "choices": [{ "objectId": "share", "correct": true, "reactionLineId": "react.kind" }, { "objectId": "eat-alone", "correct": false, "reactionLineId": "react.unkind" }] },
  { "id": "sc.slide-queue", "topicId": "kind-fair", "narrationLineId": "sc.slide-queue", "vignette": "vignettes/slide-queue.svg",
    "choices": [{ "objectId": "wait-turn", "correct": true, "reactionLineId": "react.kind" }, { "objectId": "push", "correct": false, "reactionLineId": "react.unkind" }] },
  { "id": "sc.friend-fell", "topicId": "kind-fair", "narrationLineId": "sc.friend-fell", "vignette": "vignettes/friend-fell.svg",
    "choices": [{ "objectId": "help-up", "correct": true, "reactionLineId": "react.kind" }, { "objectId": "laugh", "correct": false, "reactionLineId": "react.unkind" }, { "objectId": "walk-away", "correct": false, "reactionLineId": "react.unkind" }] }
]
```

```json
[
  { "id": "seq.morning", "topicId": "good-habits", "promptLineId": "prompt.order_morning", "steps": ["wake-up", "brush-teeth", "take-bath", "eat-breakfast", "pack-bag"] },
  { "id": "seq.morning-short", "topicId": "good-habits", "promptLineId": "prompt.order_morning", "steps": ["wake-up", "brush-teeth", "eat-breakfast"] },
  { "id": "seq.bedtime", "topicId": "good-habits", "promptLineId": "prompt.order_bedtime", "steps": ["eat-dinner", "brush-teeth", "wear-pyjamas", "read-story", "go-to-sleep"] },
  { "id": "seq.bedtime-short", "topicId": "good-habits", "promptLineId": "prompt.order_bedtime", "steps": ["wear-pyjamas", "read-story", "go-to-sleep"] }
]
```

- [ ] **Step 9: Write the template files under `content/templates/`**

`content/templates/letters.json`:

```json
[
  { "id": "letters.tap", "topicId": "letters", "goalId": "letters.recognise", "mechanic": "tap-the-one", "itemClass": "letters",
    "query": { "pool": "glyphs", "glyph": { "kind": "letter" } }, "rule": { "kind": "named" }, "rounds": 6,
    "difficulty": [{ "options": 2, "distractorSimilarity": "low" }, { "options": 3, "distractorSimilarity": "medium" }, { "options": 4, "distractorSimilarity": "high" }],
    "flavour": { "scenes": ["classroom", "garden"], "promptLineId": "prompt.tap_letter" }, "level": "lkg" }
]
```

`content/templates/capital-small.json`:

```json
[
  { "id": "capital-small.match", "topicId": "capital-small", "goalId": "capital-small.match", "mechanic": "drag-to-match", "itemClass": "letters",
    "query": { "pool": "glyphs", "glyph": { "kind": "letter" } }, "rule": { "kind": "pair", "by": "caseMate" }, "rounds": 4,
    "difficulty": [{ "options": 2, "distractorSimilarity": "low" }, { "options": 3, "distractorSimilarity": "medium" }, { "options": 4, "distractorSimilarity": "high" }],
    "flavour": { "scenes": ["classroom"], "promptLineId": "prompt.case_match" }, "level": "lkg" }
]
```

`content/templates/rhyming.json`:

```json
[
  { "id": "rhyming.match", "topicId": "rhyming", "goalId": "rhyming.match", "mechanic": "drag-to-match", "itemClass": "rhymes",
    "query": { "pool": "objects", "hasTags": ["rhymeGroup"] }, "rule": { "kind": "pair", "by": "rhymeGroup" }, "rounds": 4,
    "difficulty": [{ "options": 2, "distractorSimilarity": "low" }, { "options": 3, "distractorSimilarity": "medium" }, { "options": 4, "distractorSimilarity": "high" }],
    "flavour": { "scenes": ["garden", "farm"], "promptLineId": "prompt.rhyme_match" }, "level": "lkg" }
]
```

`content/templates/cvc.json`:

```json
[
  { "id": "cvc.hear", "topicId": "cvc", "goalId": "cvc.hear", "mechanic": "tap-the-one", "itemClass": "cvc-pictures",
    "query": { "pool": "objects", "tags": { "cvc": true } }, "rule": { "kind": "named" }, "rounds": 6,
    "difficulty": [{ "options": 2, "distractorSimilarity": "low" }, { "options": 3, "distractorSimilarity": "medium" }, { "options": 4, "distractorSimilarity": "high" }],
    "flavour": { "scenes": ["farm", "bedroom", "kitchen"], "promptLineId": "prompt.find_word" }, "level": "lkg" }
]
```

`content/templates/big-small.json`:

```json
[
  { "id": "big-small.tap", "topicId": "big-small", "goalId": "big-small.identify", "mechanic": "tap-the-one", "itemClass": "objects",
    "query": { "pool": "objects", "tags": { "sizePair": true } }, "rule": { "kind": "size", "target": "larger" }, "rounds": 6, "examFormat": "dps-numeracy-3",
    "difficulty": [{ "options": 2, "distractorSimilarity": "low" }, { "options": 3, "distractorSimilarity": "medium" }, { "options": 4, "distractorSimilarity": "high" }],
    "flavour": { "scenes": ["garden", "playground", "farm"], "promptLineId": "prompt.tap_big" }, "level": "lkg" },
  { "id": "big-small.sort", "topicId": "big-small", "goalId": "big-small.sort", "mechanic": "sort-into-bins", "itemClass": "objects",
    "query": { "pool": "objects", "tags": { "sizePair": true } }, "rule": { "kind": "size", "target": "larger" }, "rounds": 3,
    "difficulty": [{ "options": 4, "distractorSimilarity": "low" }, { "options": 6, "distractorSimilarity": "medium" }, { "options": 8, "distractorSimilarity": "high" }],
    "bins": [{ "id": "big", "label": "big basket", "lineId": "bin.big", "asset": "bins/basket-big.svg", "match": "large" },
             { "id": "small", "label": "small basket", "lineId": "bin.small", "asset": "bins/basket-small.svg", "match": "small" }],
    "flavour": { "scenes": ["kitchen", "garden"], "promptLineId": "prompt.sort_size" }, "level": "lkg" }
]
```

`content/templates/counting.json`:

```json
[
  { "id": "counting.match", "topicId": "counting", "goalId": "counting.match", "mechanic": "drag-to-match", "itemClass": "groups",
    "query": { "pool": "objects", "tags": { "countable": true } }, "rule": { "kind": "count" }, "rounds": 4, "examFormat": "dps-numeracy-7",
    "difficulty": [{ "options": 2, "distractorSimilarity": "low", "range": [1, 5] }, { "options": 3, "distractorSimilarity": "medium", "range": [1, 8] }, { "options": 4, "distractorSimilarity": "high", "range": [1, 10] }],
    "flavour": { "scenes": ["farm", "garden", "kitchen"], "promptLineId": "prompt.count_match" }, "level": "lkg" },
  { "id": "counting.give", "topicId": "counting", "goalId": "counting.give", "mechanic": "give-to-buddy", "itemClass": "groups",
    "query": { "pool": "objects", "tags": { "countable": true, "healthy": true } }, "rule": { "kind": "give-count" }, "rounds": 5,
    "difficulty": [{ "options": 5, "distractorSimilarity": "low", "range": [1, 3] }, { "options": 7, "distractorSimilarity": "medium", "range": [2, 5] }, { "options": 8, "distractorSimilarity": "high", "range": [3, 7] }],
    "bins": [{ "id": "buddy", "label": "Buddy", "lineId": "bin.buddy" }],
    "flavour": { "scenes": ["kitchen", "garden"], "promptLineId": "prompt.give_n" }, "level": "lkg" }
]
```

`content/templates/good-habits.json`:

```json
[
  { "id": "good-habits.order", "topicId": "good-habits", "goalId": "good-habits.routine", "mechanic": "sequence", "itemClass": "routine",
    "rule": { "kind": "sequence" }, "rounds": 2,
    "difficulty": [{ "options": 3, "distractorSimilarity": "low" }, { "options": 4, "distractorSimilarity": "medium" }, { "options": 5, "distractorSimilarity": "high" }],
    "flavour": { "scenes": ["bedroom", "bathroom"], "promptLineId": "prompt.order_morning" }, "level": "lkg" },
  { "id": "good-habits.clean", "topicId": "good-habits", "goalId": "good-habits.clean", "mechanic": "tap-all-that-match", "itemClass": "hygiene",
    "query": { "pool": "objects", "category": ["hygiene", "toy", "stationery"] }, "rule": { "kind": "tag", "tag": "neatAndClean", "value": true }, "rounds": 4,
    "difficulty": [{ "options": 4, "correctCount": 2, "distractorSimilarity": "low" }, { "options": 6, "correctCount": 3, "distractorSimilarity": "medium" }, { "options": 8, "correctCount": 4, "distractorSimilarity": "high" }],
    "flavour": { "scenes": ["bathroom", "bedroom"], "promptLineId": "prompt.tap_all_clean" }, "level": "lkg" }
]
```

`content/templates/healthy-food.json`:

```json
[
  { "id": "healthy-food.sort", "topicId": "healthy-food", "goalId": "healthy-food.sort", "mechanic": "sort-into-bins", "itemClass": "food",
    "query": { "pool": "objects", "category": ["fruit", "vegetable"] }, "rule": { "kind": "category", "values": ["fruit", "vegetable"] }, "rounds": 3,
    "difficulty": [{ "options": 4, "distractorSimilarity": "low" }, { "options": 6, "distractorSimilarity": "medium" }, { "options": 8, "distractorSimilarity": "high" }],
    "bins": [{ "id": "fruit", "label": "fruit basket", "lineId": "bin.fruit", "asset": "bins/basket-fruit.svg", "match": "fruit" },
             { "id": "vegetable", "label": "vegetable basket", "lineId": "bin.vegetable", "asset": "bins/basket-vegetable.svg", "match": "vegetable" }],
    "flavour": { "scenes": ["kitchen", "farm"], "promptLineId": "prompt.sort_food" }, "level": "lkg" },
  { "id": "healthy-food.plate", "topicId": "healthy-food", "goalId": "healthy-food.choose", "mechanic": "give-to-buddy", "itemClass": "food",
    "query": { "pool": "objects", "category": ["fruit", "vegetable", "meal", "junk"] }, "rule": { "kind": "tag", "tag": "healthy", "value": true }, "rounds": 4,
    "difficulty": [{ "options": 4, "correctCount": 2, "distractorSimilarity": "low" }, { "options": 6, "correctCount": 3, "distractorSimilarity": "medium" }, { "options": 8, "correctCount": 4, "distractorSimilarity": "high" }],
    "bins": [{ "id": "plate", "label": "Buddy's plate", "lineId": "bin.plate", "asset": "bins/plate.svg", "match": true }],
    "flavour": { "scenes": ["kitchen"], "promptLineId": "prompt.healthy_plate" }, "level": "lkg" }
]
```

`content/templates/feelings.json`:

```json
[
  { "id": "feelings.tap", "topicId": "feelings", "goalId": "feelings.name", "mechanic": "tap-the-one", "itemClass": "faces",
    "query": { "pool": "objects", "category": ["feeling"] }, "rule": { "kind": "named" }, "rounds": 6,
    "difficulty": [{ "options": 2, "distractorSimilarity": "low" }, { "options": 3, "distractorSimilarity": "medium" }, { "options": 4, "distractorSimilarity": "high" }],
    "flavour": { "scenes": ["playground", "classroom"], "promptLineId": "prompt.tap_feeling" }, "level": "lkg" },
  { "id": "feelings.scene", "topicId": "feelings", "goalId": "feelings.read", "mechanic": "scene-then-choose", "itemClass": "scenes",
    "rule": { "kind": "scenario" }, "rounds": 3,
    "difficulty": [{ "options": 3, "distractorSimilarity": "low" }, { "options": 3, "distractorSimilarity": "medium" }, { "options": 3, "distractorSimilarity": "high" }],
    "flavour": { "scenes": ["playground"], "promptLineId": "prompt.scene_feeling" }, "level": "lkg" }
]
```

`content/templates/kind-fair.json`:

```json
[
  { "id": "kind-fair.scene", "topicId": "kind-fair", "goalId": "kind-fair.choose", "mechanic": "scene-then-choose", "itemClass": "scenes",
    "rule": { "kind": "scenario" }, "rounds": 3,
    "difficulty": [{ "options": 3, "distractorSimilarity": "low" }, { "options": 3, "distractorSimilarity": "medium" }, { "options": 3, "distractorSimilarity": "high" }],
    "flavour": { "scenes": ["playground"], "promptLineId": "prompt.scene_kind" }, "level": "lkg" }
]
```

- [ ] **Step 10: Write `scripts/validate-content.ts`**

```ts
// scripts/validate-content.ts
import { readPack } from '../src/engine/content/readPackFromDisk';
import { ContentError, type ContentPack } from '../src/engine/content/load';
import { validatePack } from '../src/engine/content/validate';

const strict = process.argv.includes('--strict');

function loadOrExit(): ContentPack {
  try {
    return readPack();
  } catch (e) {
    if (e instanceof ContentError) {
      console.error(`Content does not match the schema:\n${e.message}`);
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
process.exit(errors.length > 0 || (strict && warnings.length > 0) ? 1 : 0);
```

- [ ] **Step 11: Run the pack test and the CLI**

Run: `npx vitest run src/engine/content/pack.test.ts && npm run validate`
Expected: the test passes; the CLI prints only `▲` warnings (8 topics below the spec minimum — expected for M1) and ends with `15 templates · 10 topics · 92 objects · 63 glyphs · 172 lines · 0 errors · 8 warnings`, exit code 0.

- [ ] **Step 12: Commit**

```bash
git add content scripts/validate-content.ts src/engine/content/pack.test.ts
git commit -m "content: M1 pack (10 topics, 15 templates) and validate CLI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Sampling and slot placement (variation rules 1 and 2)

**Files:**
- Create: `src/engine/generator/sampling.ts`, `src/engine/generator/slots.ts`
- Test: `src/engine/generator/sampling.test.ts`, `src/engine/generator/slots.test.ts`

- [ ] **Step 1: Write the failing property tests for sampling**

```ts
// src/engine/generator/sampling.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mulberry32 } from '../rng';
import { sampleWithoutRecent, pickDistractors } from './sampling';
import { glyphCandidate, objectCandidate, type Candidate } from './items';

const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}` }));

describe('sampleWithoutRecent', () => {
  it('returns distinct items and never more than the pool', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 0, max: 15 }), fc.integer(), (poolSize, n, seed) => {
        const out = sampleWithoutRecent(mulberry32(seed), ids(poolSize), n, []);
        expect(out.length).toBe(Math.min(n, poolSize));
        expect(new Set(out.map((o) => o.id)).size).toBe(out.length);
      }),
    );
  });

  it('avoids recent items whenever enough fresh ones exist', () => {
    const pool = ids(10);
    const recent = ['i0', 'i1', 'i2'];
    for (let seed = 0; seed < 50; seed++) {
      const out = sampleWithoutRecent(mulberry32(seed), pool, 7, recent);
      expect(out.some((o) => recent.includes(o.id))).toBe(false);
    }
  });

  it('falls back to the least recently used when fresh items run out', () => {
    const pool = ids(3);
    const out = sampleWithoutRecent(mulberry32(1), pool, 3, ['i2', 'i0']); // i2 oldest, i0 newest
    expect(out.map((o) => o.id)).toEqual(['i1', 'i2', 'i0']);
  });
});

const obj = (id: string, category: string, colour?: string): Candidate =>
  objectCandidate({ id, name: id, lineId: `obj.${id}`, asset: `${id}.svg`, category, tags: colour ? { colour } : {} });
// Upper and lower case of a letter share one spoken line, exactly as in content/glyphs.json.
const glyph = (char: string, confusables: string[]): Candidate =>
  glyphCandidate({
    id: char, char, kind: 'letter', case: char === char.toLowerCase() ? 'lower' : 'upper',
    pairKey: char.toLowerCase(), lineId: `glyph.letter.${char.toLowerCase()}`, confusables,
  });

describe('pickDistractors', () => {
  const pool = [obj('apple', 'fruit', 'red'), obj('tomato', 'vegetable', 'red'), obj('banana', 'fruit', 'yellow'), obj('car', 'thing'), obj('bus', 'thing'), obj('mango', 'fruit')];

  it('never returns the correct item and never repeats', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 0, max: 6 }), fc.constantFrom('low', 'medium', 'high'), (seed, n, sim) => {
        const out = pickDistractors(mulberry32(seed), pool, [pool[0]!], n, sim as 'low' | 'medium' | 'high');
        expect(out.some((c) => c.item.id === 'apple')).toBe(false);
        expect(new Set(out.map((c) => c.item.id)).size).toBe(out.length);
        expect(out.length).toBe(Math.min(n, pool.length - 1));
      }),
    );
  });

  it('low similarity prefers other categories, medium prefers the same', () => {
    const low = pickDistractors(mulberry32(3), pool, [pool[0]!], 2, 'low');
    expect(low.every((c) => (c.kind === 'object' ? c.item.category !== 'fruit' : false))).toBe(true);
    const medium = pickDistractors(mulberry32(3), pool, [pool[0]!], 2, 'medium');
    expect(medium.every((c) => (c.kind === 'object' ? c.item.category === 'fruit' : false))).toBe(true);
  });

  it('high similarity puts confusable glyphs first', () => {
    const letters = [glyph('b', ['d', 'p']), glyph('d', ['b']), glyph('p', ['b']), glyph('x', []), glyph('o', [])];
    const out = pickDistractors(mulberry32(5), letters, [letters[0]!], 2, 'high');
    expect(out.map((c) => c.item.id).sort()).toEqual(['d', 'p']);
  });

  it('high similarity prefers objects sharing a colour', () => {
    const out = pickDistractors(mulberry32(5), pool, [pool[0]!], 1, 'high');
    expect(out[0]?.item.id).toBe('tomato');
  });

  it('never offers a distractor spoken the same as the answer', () => {
    const letters = [glyph('B', ['b']), glyph('b', ['d']), glyph('d', []), glyph('x', [])];
    for (let seed = 0; seed < 30; seed++) {
      const out = pickDistractors(mulberry32(seed), letters, [letters[0]!], 3, 'high');
      expect(out.map((c) => c.id).sort()).toEqual(['d', 'x']);
    }
  });
});
```

- [ ] **Step 2: Write the failing property tests for slots**

```ts
// src/engine/generator/slots.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mulberry32 } from '../rng';
import { chooseSlot, placeAt } from './slots';

describe('chooseSlot', () => {
  it('never repeats the previous slot when there is a choice', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 2, max: 8 }), fc.integer({ min: 0, max: 7 }), (seed, count, last) => {
        const slot = chooseSlot(mulberry32(seed), count, last % count, []);
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThan(count);
        expect(slot).not.toBe(last % count);
      }),
    );
  });

  it('prefers the least-used slot', () => {
    // slots 0 and 2 used twice, slot 1 once; last was 0 → must pick 1
    expect(chooseSlot(mulberry32(1), 3, 0, [2, 1, 2])).toBe(1);
  });

  it('returns 0 for a single option', () => {
    expect(chooseSlot(mulberry32(1), 1, 0, [])).toBe(0);
  });
});

describe('placeAt', () => {
  it('inserts the correct item at the slot and keeps the others in order', () => {
    expect(placeAt('C', ['a', 'b', 'c'], 0)).toEqual(['C', 'a', 'b', 'c']);
    expect(placeAt('C', ['a', 'b', 'c'], 2)).toEqual(['a', 'b', 'C', 'c']);
    expect(placeAt('C', ['a', 'b', 'c'], 3)).toEqual(['a', 'b', 'c', 'C']);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/engine/generator/sampling.test.ts src/engine/generator/slots.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/engine/generator/sampling.ts`**

```ts
// src/engine/generator/sampling.ts
import { shuffle, type Rng } from '../rng';
import type { Difficulty } from '../content/schema';
import { categoryOf, tagOf, type Candidate } from './items';

/**
 * Pick `n` distinct entries, preferring ones whose id is not in `recent`.
 * `recent` is ordered oldest → newest; when fresh entries run out, the least recently used fill in.
 */
export function sampleWithoutRecent<T extends { id: string }>(
  rng: Rng,
  pool: readonly T[],
  n: number,
  recent: readonly string[],
): T[] {
  const recency = new Map<string, number>();
  recent.forEach((id, i) => recency.set(id, i));
  const fresh = shuffle(rng, pool.filter((p) => !recency.has(p.id)));
  if (fresh.length >= n) return fresh.slice(0, n);
  const stale = pool
    .filter((p) => recency.has(p.id))
    .sort((a, b) => (recency.get(a.id) ?? 0) - (recency.get(b.id) ?? 0));
  return [...fresh, ...stale].slice(0, n);
}

function isConfusable(a: Candidate, b: Candidate): boolean {
  if (a.kind === 'glyph' && b.kind === 'glyph') return a.item.confusables.includes(b.item.char);
  if (a.kind === 'object' && b.kind === 'object') {
    const colour = tagOf(a, 'colour');
    return colour !== undefined && colour === tagOf(b, 'colour');
  }
  return false;
}

/**
 * Distractors for `correct`, chosen by similarity:
 * low → other categories first; medium → same category first;
 * high → confusables (glyph list / shared colour) first, then same category, then the rest.
 */
export function pickDistractors(
  rng: Rng,
  pool: readonly Candidate[],
  correct: readonly Candidate[],
  n: number,
  similarity: Difficulty['distractorSimilarity'],
): Candidate[] {
  const first = correct[0];
  // Never offer the answer itself, or anything *spoken* the same (the letters "B" and "b" share one line).
  const excludeIds = new Set(correct.map((c) => c.id));
  const excludeLines = new Set(correct.map((c) => c.item.lineId));
  const rest = pool.filter((c) => !excludeIds.has(c.id) && !excludeLines.has(c.item.lineId));
  if (!first || rest.length === 0 || n <= 0) return [];

  const sameCategory = rest.filter((c) => categoryOf(c) === categoryOf(first));
  const otherCategory = rest.filter((c) => categoryOf(c) !== categoryOf(first));
  let buckets: Candidate[][];
  if (similarity === 'low') buckets = [otherCategory, sameCategory];
  else if (similarity === 'medium') buckets = [sameCategory, otherCategory];
  else {
    const confusable = rest.filter((c) => isConfusable(first, c));
    const confusableIds = new Set(confusable.map((c) => c.item.id));
    buckets = [confusable, sameCategory.filter((c) => !confusableIds.has(c.item.id)), otherCategory.filter((c) => !confusableIds.has(c.item.id))];
  }

  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const bucket of buckets) {
    for (const c of shuffle(rng, bucket)) {
      if (out.length >= n) return out;
      if (seen.has(c.item.id)) continue;
      seen.add(c.item.id);
      out.push(c);
    }
  }
  return out;
}
```

- [ ] **Step 5: Implement `src/engine/generator/slots.ts`**

```ts
// src/engine/generator/slots.ts
import { pick, type Rng } from '../rng';

/** Slot for the correct option: never the last slot, and the least-used slot so far in the set. */
export function chooseSlot(rng: Rng, optionCount: number, lastSlot: number | null, counts: readonly number[]): number {
  if (optionCount <= 0) throw new Error('optionCount must be positive');
  if (optionCount === 1) return 0;
  const candidates = Array.from({ length: optionCount }, (_, i) => i).filter((s) => s !== lastSlot);
  const minCount = Math.min(...candidates.map((s) => counts[s] ?? 0));
  return pick(rng, candidates.filter((s) => (counts[s] ?? 0) === minCount));
}

/** Insert `correct` into `others` at `slot` (clamped to the end). */
export function placeAt<T>(correct: T, others: readonly T[], slot: number): T[] {
  const out = [...others];
  out.splice(Math.min(slot, out.length), 0, correct);
  return out;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/engine/generator/sampling.test.ts src/engine/generator/slots.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 7: Commit**

```bash
git add src/engine/generator/sampling.ts src/engine/generator/slots.ts src/engine/generator/sampling.test.ts src/engine/generator/slots.test.ts
git commit -m "feat(generator): sampling without recent repeats, similarity distractors, slot placement

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Rule builders (payloads for every M1 rule)

**Files:**
- Create: `src/engine/generator/rules.ts`
- Modify: `src/engine/generator/types.ts` (add `stimulus` to the choose payload)
- Test: `src/engine/generator/rules.test.ts`

- [ ] **Step 1: Add the optional stimulus to the choose payload in `types.ts`**

Replace the `choose` line of `Payload` with:

```ts
  | { kind: 'choose'; options: RoundItem[]; correctIds: string[]; stimulus?: RoundItem }
```

(`stimulus` is the group of `count` objects shown above numeral options for "count and circle the number".)

- [ ] **Step 2: Write the failing tests (they use the real M1 pack)**

```ts
// src/engine/generator/rules.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from '../content/readPackFromDisk';
import { mulberry32 } from '../rng';
import { buildPayload, difficultyAt, type RuleContext } from './rules';
import type { Level } from './types';

const pack = readPack();

function ctx(templateId: string, seed = 1, level: Level = 1, avoid: string[] = []): RuleContext {
  const template = pack.templates.get(templateId)!;
  return { pack, template, rng: mulberry32(seed), level, difficulty: difficultyAt(template, level), avoid, lastSlot: null, slotCounts: [] };
}

describe('named', () => {
  it('builds a choose payload with one correct option at the chosen slot', () => {
    const r = buildPayload(ctx('letters.tap', 3, 3));
    expect(r.payload.kind).toBe('choose');
    if (r.payload.kind !== 'choose') return;
    expect(r.payload.options.length).toBe(4);
    expect(r.payload.correctIds.length).toBe(1);
    const correct = r.payload.options[r.correctSlot!]!;
    expect(correct.id).toBe(r.payload.correctIds[0]);
    expect(r.payload.options.filter((o) => o.lineId === correct.lineId)).toHaveLength(1); // never "B" beside "b"
    expect(r.slots.target).toBe(r.payload.correctIds[0]);
    expect(r.itemIds).toEqual(r.payload.correctIds);
  });

  it('avoids recent targets', () => {
    const recent = [...pack.glyphs.values()].filter((g) => g.kind === 'letter').map((g) => g.id).slice(0, 50);
    const r = buildPayload(ctx('letters.tap', 7, 1, recent));
    expect(recent.includes(r.itemIds[0]!)).toBe(false);
  });
});

describe('size', () => {
  it('tap-the-one: same object at several scales, the largest is correct', () => {
    const p = buildPayload(ctx('big-small.tap', 11, 2)).payload;
    if (p.kind !== 'choose') throw new Error('expected choose');
    const scales = p.options.map((o) => o.scale!);
    expect(scales.length).toBe(3);
    expect(new Set(p.options.map((o) => o.id.split('@')[0])).size).toBe(1);
    const correct = p.options.find((o) => o.id === p.correctIds[0])!;
    expect(correct.scale).toBe(Math.max(...scales));
  });

  it('sort-into-bins: items are small or large copies and go to the matching bin', () => {
    const r = buildPayload(ctx('big-small.sort', 2, 1));
    if (r.payload.kind !== 'bins') throw new Error('expected bins');
    expect(r.payload.items.length).toBe(4);
    for (const item of r.payload.items) {
      expect(item.binId).toBe(item.scale === 1 ? 'big' : 'small');
    }
    expect(r.payload.bins.map((b) => b.id)).toEqual(['big', 'small']);
  });
});

describe('tag', () => {
  it('tap-all-that-match: correctCount correct items among the options', () => {
    const r = buildPayload(ctx('good-habits.clean', 4, 2));
    if (r.payload.kind !== 'choose') throw new Error('expected choose');
    expect(r.payload.options.length).toBe(6);
    expect(r.payload.correctIds.length).toBe(3);
    for (const id of r.payload.correctIds) expect(pack.objects.get(id)!.tags.neatAndClean).toBe(true);
  });

  it('give-to-buddy: healthy items are the correct ones', () => {
    const r = buildPayload(ctx('healthy-food.plate', 4, 1));
    if (r.payload.kind !== 'give') throw new Error('expected give');
    expect(r.payload.target.id).toBe('plate');
    expect(r.payload.items.length).toBe(4);
    expect(r.payload.correctIds.length).toBe(2);
    for (const id of r.payload.correctIds) expect(pack.objects.get(id)!.tags.healthy).toBe(true);
  });
});

describe('category', () => {
  it('sort-into-bins: each item goes to the bin matching its category', () => {
    const r = buildPayload(ctx('healthy-food.sort', 9, 3));
    if (r.payload.kind !== 'bins') throw new Error('expected bins');
    expect(r.payload.items.length).toBe(8);
    for (const item of r.payload.items) expect(item.binId).toBe(pack.objects.get(item.id)!.category);
  });
});

describe('count', () => {
  it('drag-to-match: groups pair with their numerals', () => {
    const r = buildPayload(ctx('counting.match', 5, 2));
    if (r.payload.kind !== 'pairs') throw new Error('expected pairs');
    expect(r.payload.left.length).toBe(3);
    for (const [groupId, glyphId] of r.payload.pairs) {
      const group = r.payload.left.find((l) => l.id === groupId)!;
      expect(pack.glyphs.get(glyphId)!.value).toBe(group.count);
      expect(group.count).toBeGreaterThanOrEqual(1);
      expect(group.count).toBeLessThanOrEqual(8);
    }
  });
});

describe('give-count', () => {
  it('asks for n of one object and marks n of the copies correct', () => {
    const r = buildPayload(ctx('counting.give', 8, 1));
    if (r.payload.kind !== 'give') throw new Error('expected give');
    expect(r.payload.count).toBe(Number(r.slots.n));
    expect(r.payload.correctIds.length).toBe(r.payload.count);
    expect(r.payload.items.length).toBeGreaterThanOrEqual(r.payload.count! + 2);
    expect(new Set(r.payload.items.map((i) => i.id.split('#')[0])).size).toBe(1);
  });
});

describe('pair', () => {
  it('caseMate: left are capitals, right their small letters, shuffled', () => {
    const r = buildPayload(ctx('capital-small.match', 2, 3));
    if (r.payload.kind !== 'pairs') throw new Error('expected pairs');
    expect(r.payload.left.every((l) => pack.glyphs.get(l.id)!.case === 'upper')).toBe(true);
    for (const [a, b] of r.payload.pairs) expect(pack.glyphs.get(a)!.pairKey).toBe(pack.glyphs.get(b)!.pairKey);
    expect(r.payload.pairs.length).toBe(4);
  });

  it('rhymeGroup: each pair shares a rhyme group and groups do not repeat', () => {
    const r = buildPayload(ctx('rhyming.match', 6, 3));
    if (r.payload.kind !== 'pairs') throw new Error('expected pairs');
    const groups = r.payload.pairs.map(([a, b]) => {
      const ga = pack.objects.get(a)!.tags.rhymeGroup;
      expect(pack.objects.get(b)!.tags.rhymeGroup).toBe(ga);
      return ga;
    });
    expect(new Set(groups).size).toBe(4);
    expect(r.itemIds.sort()).toEqual([...groups].sort());
  });
});

describe('sequence', () => {
  it('shuffles the steps and keeps the correct order', () => {
    const r = buildPayload(ctx('good-habits.order', 1, 3));
    if (r.payload.kind !== 'order') throw new Error('expected order');
    expect(r.payload.items.map((i) => i.id)).not.toEqual(r.payload.correctOrder);
    expect([...r.payload.items.map((i) => i.id)].sort()).toEqual([...r.payload.correctOrder].sort());
    expect(r.promptLineId).toMatch(/^prompt\.order_/);
  });
});

describe('scenario', () => {
  it('returns the vignette, narration and shuffled choices with at least one correct', () => {
    const r = buildPayload(ctx('kind-fair.scene', 1, 1));
    if (r.payload.kind !== 'scenario') throw new Error('expected scenario');
    expect(pack.scenarios.has(r.payload.scenarioId)).toBe(true);
    expect(r.payload.choices.some((c) => c.correct)).toBe(true);
    expect(r.correctSlot).toBe(r.payload.choices.findIndex((c) => c.correct));
    expect(r.itemIds).toEqual([r.payload.scenarioId]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/engine/generator/rules.test.ts`
Expected: FAIL — `Cannot find module './rules'`.

- [ ] **Step 4: Implement `src/engine/generator/rules.ts`**

```ts
// src/engine/generator/rules.ts
import type { ContentPack } from '../content/load';
import type { Bin, Difficulty, Glyph, Template } from '../content/schema';
import { shuffle, type Rng } from '../rng';
import { categoryOf, glyphCandidate, objectCandidate, pluralOf, queryItems, tagOf, toRoundItem, type Candidate } from './items';
import { pickDistractors, sampleWithoutRecent } from './sampling';
import { chooseSlot, placeAt } from './slots';
import type { Level, Payload, RoundBin, RoundItem } from './types';

export class GenerationError extends Error {
  override name = 'GenerationError';
}

export interface RuleContext {
  pack: ContentPack;
  template: Template;
  rng: Rng;
  level: Level;
  difficulty: Difficulty;
  /** key item ids to avoid as correct answers (recent history + earlier rounds of this set), oldest first */
  avoid: readonly string[];
  lastSlot: number | null;
  slotCounts: readonly number[];
}

export interface RuleResult {
  payload: Payload;
  /** slot name → item id (or literal) for the prompt */
  slots: Record<string, string>;
  /** key item ids used, fed back into history */
  itemIds: string[];
  correctSlot: number | null;
  /** overrides the template prompt (sequences carry their own) */
  promptLineId?: string;
}

const SIZE_SCALES: Record<number, number[]> = {
  2: [0.55, 1],
  3: [0.55, 0.78, 1],
  4: [0.45, 0.63, 0.81, 1],
};

/** The difficulty parameters for a level (the tuple index is level − 1). */
export function difficultyAt(template: Template, level: Level): Difficulty {
  return template.difficulty[level - 1] as Difficulty;
}

function toRoundBin(b: Bin): RoundBin {
  return { id: b.id, label: b.label, lineId: b.lineId, ...(b.asset ? { asset: b.asset } : {}) };
}

function candidates(ctx: RuleContext): Candidate[] {
  if (!ctx.template.query) throw new GenerationError(`template ${ctx.template.id} has no query`);
  return queryItems(ctx.pack, ctx.template.query);
}

function requireBins(ctx: RuleContext): Bin[] {
  if (!ctx.template.bins?.length) throw new GenerationError(`template ${ctx.template.id} needs bins`);
  return ctx.template.bins;
}

function one<T>(items: T[], what: string): T {
  const first = items[0];
  if (first === undefined) throw new GenerationError(`no ${what} available`);
  return first;
}

function numberGlyph(pack: ContentPack, n: number): Glyph {
  const g = [...pack.glyphs.values()].find((x) => x.kind === 'number' && x.value === n);
  if (!g) throw new GenerationError(`no number glyph for ${n}`);
  return g;
}

function rangeInts(range: readonly [number, number] | undefined, what: string): number[] {
  if (!range) throw new GenerationError(`${what} needs a difficulty range`);
  const [lo, hi] = range;
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/** Lay out one correct item among distractors, honouring the slot rules. */
function chooseLayout(ctx: RuleContext, correct: RoundItem, others: RoundItem[]): { options: RoundItem[]; slot: number } {
  const slot = chooseSlot(ctx.rng, others.length + 1, ctx.lastSlot, ctx.slotCounts);
  return { options: placeAt(correct, others, slot), slot };
}

function buildNamed(ctx: RuleContext): RuleResult {
  const pool = candidates(ctx);
  const correct = one(sampleWithoutRecent(ctx.rng, pool, 1, ctx.avoid), 'named target');
  const distractors = pickDistractors(ctx.rng, pool, [correct], ctx.difficulty.options - 1, ctx.difficulty.distractorSimilarity);
  const { options, slot } = chooseLayout(ctx, toRoundItem(correct), distractors.map(toRoundItem));
  return {
    payload: { kind: 'choose', options, correctIds: [correct.item.id] },
    slots: { target: correct.item.id },
    itemIds: [correct.item.id],
    correctSlot: slot,
  };
}

function buildSize(ctx: RuleContext): RuleResult {
  const rule = ctx.template.rule;
  if (rule.kind !== 'size') throw new GenerationError('not a size rule');
  const pool = candidates(ctx).filter((c) => tagOf(c, 'sizePair') === true);

  if (ctx.template.mechanic === 'sort-into-bins') {
    const bins = requireBins(ctx);
    const bigBin = bins.find((b) => b.match === 'large');
    const smallBin = bins.find((b) => b.match === 'small');
    if (!bigBin || !smallBin) throw new GenerationError('size bins need match values "large" and "small"');
    const objects = sampleWithoutRecent(ctx.rng, pool, Math.ceil(ctx.difficulty.options / 2), ctx.avoid);
    const items = objects.flatMap((c) => {
      const base = toRoundItem(c);
      return [
        { ...base, id: `${base.id}@s`, scale: 0.55, binId: smallBin.id },
        { ...base, id: `${base.id}@l`, scale: 1, binId: bigBin.id },
      ];
    });
    return {
      payload: { kind: 'bins', bins: bins.map(toRoundBin), items: shuffle(ctx.rng, items) },
      slots: {},
      itemIds: objects.map((c) => c.item.id),
      correctSlot: null,
    };
  }

  const correctCand = one(sampleWithoutRecent(ctx.rng, pool, 1, ctx.avoid), 'sizePair object');
  const scales = SIZE_SCALES[Math.min(4, Math.max(2, ctx.difficulty.options))] as number[];
  const base = toRoundItem(correctCand);
  const copies = scales.map((scale, i) => ({ ...base, id: `${base.id}@${i}`, scale }));
  const correctIndex = rule.target === 'larger' ? copies.length - 1 : 0;
  const correct = copies[correctIndex] as RoundItem;
  const others = shuffle(ctx.rng, copies.filter((_, i) => i !== correctIndex));
  const { options, slot } = chooseLayout(ctx, correct, others);
  return {
    payload: { kind: 'choose', options, correctIds: [correct.id] },
    slots: { target: correctCand.item.id },
    itemIds: [correctCand.item.id],
    correctSlot: slot,
  };
}

/** Shared by tag and category rules: a predicate decides which candidates are "matching". */
function buildMatching(ctx: RuleContext, matches: (c: Candidate) => boolean, binFor: (c: Candidate, bins: Bin[]) => Bin | undefined): RuleResult {
  const pool = candidates(ctx);
  const yes = pool.filter(matches);
  const no = pool.filter((c) => !matches(c));
  const mechanic = ctx.template.mechanic;

  if (mechanic === 'sort-into-bins') {
    const bins = requireBins(ctx);
    const half = Math.ceil(ctx.difficulty.options / 2);
    const chosen = [...sampleWithoutRecent(ctx.rng, yes, half, ctx.avoid), ...sampleWithoutRecent(ctx.rng, no, ctx.difficulty.options - half, ctx.avoid)];
    const items = chosen.map((c) => {
      const bin = binFor(c, bins);
      if (!bin) throw new GenerationError(`no bin accepts ${c.item.id} in ${ctx.template.id}`);
      return { ...toRoundItem(c), binId: bin.id };
    });
    return { payload: { kind: 'bins', bins: bins.map(toRoundBin), items: shuffle(ctx.rng, items) }, slots: {}, itemIds: chosen.map((c) => c.item.id), correctSlot: null };
  }

  const wanted = mechanic === 'tap-the-one' ? 1 : Math.min(ctx.difficulty.correctCount ?? 1, yes.length, ctx.difficulty.options - 1);
  const correct = sampleWithoutRecent(ctx.rng, yes, wanted, ctx.avoid);
  const distractors = pickDistractors(ctx.rng, no, correct, ctx.difficulty.options - correct.length, ctx.difficulty.distractorSimilarity);
  const correctIds = correct.map((c) => c.item.id);
  const first = one(correct, 'matching item');

  if (mechanic === 'give-to-buddy') {
    const [target] = requireBins(ctx);
    const items = shuffle(ctx.rng, [...correct, ...distractors].map(toRoundItem));
    return { payload: { kind: 'give', target: toRoundBin(target as Bin), items, correctIds }, slots: { target: first.item.id }, itemIds: correctIds, correctSlot: null };
  }

  if (mechanic === 'tap-the-one') {
    const { options, slot } = chooseLayout(ctx, toRoundItem(first), distractors.map(toRoundItem));
    return { payload: { kind: 'choose', options, correctIds }, slots: { target: first.item.id }, itemIds: correctIds, correctSlot: slot };
  }

  const options = shuffle(ctx.rng, [...correct, ...distractors].map(toRoundItem));
  return {
    payload: { kind: 'choose', options, correctIds },
    slots: { target: first.item.id },
    itemIds: correctIds,
    correctSlot: options.findIndex((o) => correctIds.includes(o.id)),
  };
}

function buildTag(ctx: RuleContext): RuleResult {
  const rule = ctx.template.rule;
  if (rule.kind !== 'tag') throw new GenerationError('not a tag rule');
  return buildMatching(
    ctx,
    (c) => tagOf(c, rule.tag) === rule.value,
    (c, bins) => bins.find((b) => b.match === tagOf(c, rule.tag)) ?? bins.find((b) => b.match !== rule.value),
  );
}

function buildCategory(ctx: RuleContext): RuleResult {
  const rule = ctx.template.rule;
  if (rule.kind !== 'category') throw new GenerationError('not a category rule');
  const target = rule.values[0] as string;
  return buildMatching(
    ctx,
    (c) => categoryOf(c) === target,
    (c, bins) => bins.find((b) => b.match === categoryOf(c)),
  );
}

function groupItem(c: Candidate, n: number): RoundItem {
  const base = toRoundItem(c);
  const noun = c.kind === 'object' ? (n === 1 ? c.item.name : pluralOf(c.item)) : base.label;
  return { ...base, id: `${base.id}x${n}`, label: `${n} ${noun}`, count: n };
}

function buildCount(ctx: RuleContext): RuleResult {
  const pool = candidates(ctx).filter((c) => tagOf(c, 'countable') === true);
  const obj = one(sampleWithoutRecent(ctx.rng, pool, 1, ctx.avoid), 'countable object');
  const numbers = rangeInts(ctx.difficulty.range, 'count');

  if (ctx.template.mechanic === 'drag-to-match') {
    const ns = shuffle(ctx.rng, numbers).slice(0, ctx.difficulty.options);
    const left = ns.map((n) => groupItem(obj, n));
    const right = shuffle(ctx.rng, ns.map((n) => toRoundItem(glyphCandidate(numberGlyph(ctx.pack, n)))));
    const pairs = ns.map((n): [string, string] => [`${obj.item.id}x${n}`, numberGlyph(ctx.pack, n).id]);
    return { payload: { kind: 'pairs', left, right, pairs }, slots: {}, itemIds: [obj.item.id], correctSlot: null };
  }

  const n = numbers[Math.floor(ctx.rng() * numbers.length)] as number;
  const near = (d: number) => [n - d, n + d].filter((x) => x >= 0 && x <= 10 && x !== n);
  const byDistance = [...near(1), ...near(2), ...near(3), ...shuffle(ctx.rng, numbers.filter((x) => x !== n))];
  const ordered = ctx.difficulty.distractorSimilarity === 'low' ? shuffle(ctx.rng, byDistance) : byDistance;
  const distractorNs = [...new Set(ordered)].slice(0, ctx.difficulty.options - 1);
  const correct = toRoundItem(glyphCandidate(numberGlyph(ctx.pack, n)));
  const others = distractorNs.map((d) => toRoundItem(glyphCandidate(numberGlyph(ctx.pack, d))));
  const { options, slot } = chooseLayout(ctx, correct, others);
  return {
    payload: { kind: 'choose', options, correctIds: [correct.id], stimulus: groupItem(obj, n) },
    slots: { n: String(n), target: obj.item.id },
    itemIds: [obj.item.id],
    correctSlot: slot,
  };
}

function buildGiveCount(ctx: RuleContext): RuleResult {
  const pool = candidates(ctx).filter((c) => tagOf(c, 'countable') === true);
  const obj = one(sampleWithoutRecent(ctx.rng, pool, 1, ctx.avoid), 'countable object');
  const numbers = rangeInts(ctx.difficulty.range, 'give-count');
  const n = numbers[Math.floor(ctx.rng() * numbers.length)] as number;
  const total = Math.max(ctx.difficulty.options, n + 2);
  const base = toRoundItem(obj);
  const items = Array.from({ length: total }, (_, i) => ({ ...base, id: `${base.id}#${i}` }));
  const [target] = requireBins(ctx);
  return {
    payload: { kind: 'give', target: toRoundBin(target as Bin), items, correctIds: items.slice(0, n).map((i) => i.id), count: n },
    slots: { n: String(n), targets: obj.item.id },
    itemIds: [obj.item.id],
    correctSlot: null,
  };
}

function buildPair(ctx: RuleContext): RuleResult {
  const rule = ctx.template.rule;
  if (rule.kind !== 'pair') throw new GenerationError('not a pair rule');
  const pool = candidates(ctx);
  const k = ctx.difficulty.options;

  if (rule.by === 'rhymeGroup') {
    const groups = new Map<string, Candidate[]>();
    for (const c of pool) {
      const g = tagOf(c, 'rhymeGroup');
      if (typeof g === 'string') groups.set(g, [...(groups.get(g) ?? []), c]);
    }
    const usable = [...groups.entries()].filter(([, members]) => members.length >= 2).map(([id, members]) => ({ id, members }));
    const chosen = sampleWithoutRecent(ctx.rng, usable, k, ctx.avoid);
    const left: RoundItem[] = [];
    const right: RoundItem[] = [];
    const pairs: Array<[string, string]> = [];
    for (const group of chosen) {
      const [a, b] = shuffle(ctx.rng, group.members);
      if (!a || !b) continue;
      left.push(toRoundItem(a));
      right.push(toRoundItem(b));
      pairs.push([a.item.id, b.item.id]);
    }
    return { payload: { kind: 'pairs', left, right: shuffle(ctx.rng, right), pairs }, slots: {}, itemIds: chosen.map((g) => g.id), correctSlot: null };
  }

  const byKey = new Map<string, { upper?: Glyph; lower?: Glyph }>();
  for (const c of pool) {
    if (c.kind !== 'glyph') continue;
    const entry = byKey.get(c.item.pairKey) ?? {};
    if (c.item.case === 'upper') entry.upper = c.item;
    if (c.item.case === 'lower') entry.lower = c.item;
    byKey.set(c.item.pairKey, entry);
  }
  const complete = [...byKey.entries()].filter(([, e]) => e.upper && e.lower).map(([id, e]) => ({ id, upper: e.upper as Glyph, lower: e.lower as Glyph }));
  const chosen = sampleWithoutRecent(ctx.rng, complete, k, ctx.avoid);
  const left = chosen.map((p) => toRoundItem(glyphCandidate(p.upper)));
  const right = shuffle(ctx.rng, chosen.map((p) => toRoundItem(glyphCandidate(p.lower))));
  const pairs = chosen.map((p): [string, string] => [p.upper.id, p.lower.id]);
  return { payload: { kind: 'pairs', left, right, pairs }, slots: {}, itemIds: chosen.map((p) => p.id), correctSlot: null };
}

function buildSequence(ctx: RuleContext): RuleResult {
  const all = [...ctx.pack.sequences.values()].filter((s) => s.topicId === ctx.template.topicId);
  const fitting = all.filter((s) => s.steps.length <= ctx.difficulty.options);
  const seq = one(sampleWithoutRecent(ctx.rng, fitting.length ? fitting : all, 1, ctx.avoid), 'sequence');
  const ordered = seq.steps.map((id) => {
    const o = ctx.pack.objects.get(id);
    if (!o) throw new GenerationError(`sequence ${seq.id} references unknown object ${id}`);
    return toRoundItem(objectCandidate(o));
  });
  let items = shuffle(ctx.rng, ordered);
  for (let tries = 0; tries < 10 && items.every((it, i) => it.id === ordered[i]?.id); tries++) items = shuffle(ctx.rng, ordered);
  return {
    payload: { kind: 'order', items, correctOrder: seq.steps },
    slots: {},
    itemIds: [seq.id],
    correctSlot: null,
    promptLineId: seq.promptLineId,
  };
}

function buildScenario(ctx: RuleContext): RuleResult {
  const all = [...ctx.pack.scenarios.values()].filter((s) => s.topicId === ctx.template.topicId);
  const sc = one(sampleWithoutRecent(ctx.rng, all, 1, ctx.avoid), 'scenario');
  const choices = shuffle(ctx.rng, sc.choices).map((ch) => {
    const o = ctx.pack.objects.get(ch.objectId);
    if (!o) throw new GenerationError(`scenario ${sc.id} references unknown object ${ch.objectId}`);
    return { ...toRoundItem(objectCandidate(o)), correct: ch.correct, ...(ch.reactionLineId ? { reactionLineId: ch.reactionLineId } : {}) };
  });
  return {
    payload: { kind: 'scenario', scenarioId: sc.id, vignette: sc.vignette, narrationLineId: sc.narrationLineId, choices },
    slots: {},
    itemIds: [sc.id],
    correctSlot: choices.findIndex((c) => c.correct),
  };
}

/** Build the payload for a template at the given difficulty. Deterministic given ctx.rng. */
export function buildPayload(ctx: RuleContext): RuleResult {
  switch (ctx.template.rule.kind) {
    case 'named': return buildNamed(ctx);
    case 'size': return buildSize(ctx);
    case 'tag': return buildTag(ctx);
    case 'category': return buildCategory(ctx);
    case 'count': return buildCount(ctx);
    case 'give-count': return buildGiveCount(ctx);
    case 'pair': return buildPair(ctx);
    case 'sequence': return buildSequence(ctx);
    case 'scenario': return buildScenario(ctx);
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/engine/generator/rules.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/generator/rules.ts src/engine/generator/types.ts src/engine/generator/rules.test.ts
git commit -m "feat(generator): payload builders for named, size, tag, category, count, pair, sequence and scenario rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Rounds and sets (wording, scene and within-set variation)

**Files:**
- Create: `src/engine/generator/round.ts`
- Test: `src/engine/generator/round.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/generator/round.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readPack } from '../content/readPackFromDisk';
import { generateSet, renderCaption, pickVariant, pickScene } from './round';
import { EMPTY_HISTORY, type Level, type Payload } from './types';
import { mulberry32 } from '../rng';

const pack = readPack();
const templateIds = [...pack.templates.keys()];

const EXPECTED_KIND: Record<string, Payload['kind']> = {
  'tap-the-one': 'choose', 'tap-all-that-match': 'choose', 'drag-to-match': 'pairs', 'sort-into-bins': 'bins',
  'give-to-buddy': 'give', 'sequence': 'order', 'scene-then-choose': 'scenario',
};

describe('generateSet', () => {
  it('is deterministic for the same seed', () => {
    const a = generateSet(pack, pack.templates.get('big-small.tap')!, { seed: 99, level: 1, history: EMPTY_HISTORY });
    const b = generateSet(pack, pack.templates.get('big-small.tap')!, { seed: 99, level: 1, history: EMPTY_HISTORY });
    expect(a).toEqual(b);
  });

  it('produces the right number of rounds with the right payload kind for every template, level and seed', () => {
    fc.assert(
      fc.property(fc.constantFrom(...templateIds), fc.constantFrom<Level>(1, 2, 3), fc.integer({ min: 0, max: 500 }), (id, level, seed) => {
        const t = pack.templates.get(id)!;
        const rounds = generateSet(pack, t, { seed, level, history: EMPTY_HISTORY });
        expect(rounds.length).toBe(t.rounds);
        for (const r of rounds) {
          expect(r.payload.kind).toBe(EXPECTED_KIND[t.mechanic]);
          expect(r.form).toBe(`${t.mechanic}:${t.itemClass}`);
          expect(r.level).toBe(level);
          expect(t.flavour.scenes).toContain(r.sceneId);
          expect(r.prompt.text.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('never puts the correct answer in the same slot twice running', () => {
    fc.assert(
      fc.property(fc.constantFrom('letters.tap', 'big-small.tap', 'cvc.hear', 'feelings.tap'), fc.integer({ min: 0, max: 300 }), (id, seed) => {
        const rounds = generateSet(pack, pack.templates.get(id)!, { seed, level: 3, history: { ...EMPTY_HISTORY, lastSlot: 0 } });
        let last: number | null = 0;
        for (const r of rounds) {
          expect(r.correctSlot).not.toBe(last);
          last = r.correctSlot;
        }
      }),
    );
  });

  it('does not repeat a correct item within a set when the pool is big enough', () => {
    for (let seed = 0; seed < 40; seed++) {
      const rounds = generateSet(pack, pack.templates.get('letters.tap')!, { seed, level: 1, history: EMPTY_HISTORY });
      const targets = rounds.map((r) => r.itemIds[0]);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  it('avoids the last scene and the last wording variant', () => {
    const t = pack.templates.get('big-small.tap')!;
    for (let seed = 0; seed < 30; seed++) {
      const rounds = generateSet(pack, t, { seed, level: 1, history: { ...EMPTY_HISTORY, lastSceneId: 'garden', lastVariantByLine: { 'prompt.tap_big': 0 } } });
      expect(rounds[0]!.sceneId).not.toBe('garden');
      expect(rounds[0]!.prompt.variant).not.toBe(0);
    }
  });

  it('renders the target label into the caption', () => {
    const rounds = generateSet(pack, pack.templates.get('big-small.tap')!, { seed: 4, level: 1, history: EMPTY_HISTORY });
    const r = rounds[0]!;
    expect(r.prompt.text).toContain(pack.objects.get(r.prompt.slots.target!)!.name);
  });
});

describe('helpers', () => {
  it('pickVariant avoids the last variant when there is more than one', () => {
    for (let s = 0; s < 20; s++) expect(pickVariant(mulberry32(s), 3, 1)).not.toBe(1);
    expect(pickVariant(mulberry32(1), 1, 0)).toBe(0);
  });

  it('pickScene avoids the last scene when there is more than one', () => {
    for (let s = 0; s < 20; s++) expect(pickScene(mulberry32(s), ['a', 'b', 'c'], 'b')).not.toBe('b');
    expect(pickScene(mulberry32(1), ['a'], 'a')).toBe('a');
  });

  it('renderCaption fills slots with labels and leaves {name} for the UI', () => {
    expect(renderCaption(pack, 'Give Buddy {n} {targets}, {name}!', { n: '3', targets: 'mango' })).toBe('Give Buddy 3 mangoes, {name}!');
    expect(renderCaption(pack, 'Tap the letter {target}', { target: 'b' })).toBe('Tap the letter b');
    expect(renderCaption(pack, 'Count to {target}', { target: 'n10' })).toBe('Count to 10');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/generator/round.test.ts`
Expected: FAIL — `Cannot find module './round'`.

- [ ] **Step 3: Implement `src/engine/generator/round.ts`**

```ts
// src/engine/generator/round.ts
import type { ContentPack } from '../content/load';
import type { Template } from '../content/schema';
import { deriveSeed, mulberry32, pick, type Rng } from '../rng';
import { pluralOf } from './items';
import { buildPayload, difficultyAt, GenerationError } from './rules';
import type { GeneratorHistory, Level, Round } from './types';

export interface GenerateOptions {
  seed: number;
  level: Level;
  history: GeneratorHistory;
}

/** Variation rule 3: a different wording than last time, when the line has more than one. */
export function pickVariant(rng: Rng, count: number, last: number | undefined): number {
  if (count <= 1) return 0;
  return pick(rng, Array.from({ length: count }, (_, i) => i).filter((i) => i !== last));
}

/** Variation rule 4: a different scene than last set, when the template has more than one. */
export function pickScene(rng: Rng, scenes: readonly string[], last: string | null): string {
  if (scenes.length === 1) return scenes[0] as string;
  return pick(rng, scenes.filter((s) => s !== last));
}

/** Resolve a slot value to the text shown in the caption. {name} is left for the UI (it is the child's name). */
export function slotLabel(pack: ContentPack, slot: string, value: string): string {
  const object = pack.objects.get(value);
  if (object) return slot === 'targets' ? pluralOf(object) : object.name;
  const glyph = pack.glyphs.get(value);
  if (glyph) return glyph.kind === 'number' && glyph.value !== undefined ? String(glyph.value) : glyph.char;
  return value;
}

export function renderCaption(pack: ContentPack, text: string, slots: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, slot: string) => {
    if (slot === 'name') return whole;
    const value = slots[slot];
    return value === undefined ? whole : slotLabel(pack, slot, value);
  });
}

interface RoundOptions {
  seed: number;
  level: Level;
  sceneId: string;
  avoid: readonly string[];
  lastSlot: number | null;
  slotCounts: readonly number[];
  lastVariantByLine: Readonly<Record<string, number>>;
}

export function generateRound(pack: ContentPack, template: Template, opts: RoundOptions): Round {
  const rng = mulberry32(opts.seed);
  const difficulty = difficultyAt(template, opts.level);
  const result = buildPayload({ pack, template, rng, level: opts.level, difficulty, avoid: opts.avoid, lastSlot: opts.lastSlot, slotCounts: opts.slotCounts });
  const lineId = result.promptLineId ?? template.flavour.promptLineId;
  const line = pack.lines.get(lineId);
  if (!line) throw new GenerationError(`missing line ${lineId}`);
  const variant = pickVariant(rng, line.variants.length, opts.lastVariantByLine[lineId]);
  const text = renderCaption(pack, line.variants[variant] as string, result.slots);
  return {
    templateId: template.id,
    topicId: template.topicId,
    goalId: template.goalId,
    mechanic: template.mechanic,
    form: `${template.mechanic}:${template.itemClass}`,
    seed: opts.seed,
    level: opts.level,
    sceneId: opts.sceneId,
    prompt: { lineId, variant, text, slots: result.slots },
    payload: result.payload,
    correctSlot: result.correctSlot,
    itemIds: result.itemIds,
  };
}

/** A whole set: one scene, no repeated key items, balanced slots, rotating wording. */
export function generateSet(pack: ContentPack, template: Template, opts: GenerateOptions): Round[] {
  const setRng = mulberry32(deriveSeed(opts.seed, 'set'));
  const sceneId = pickScene(setRng, template.flavour.scenes, opts.history.lastSceneId);
  const used: string[] = [];
  const slotCounts: number[] = [];
  const lastVariantByLine: Record<string, number> = { ...opts.history.lastVariantByLine };
  let lastSlot = opts.history.lastSlot;
  const rounds: Round[] = [];
  for (let i = 0; i < template.rounds; i++) {
    const round = generateRound(pack, template, {
      seed: deriveSeed(opts.seed, `round${i}`),
      level: opts.level,
      sceneId,
      avoid: [...opts.history.recentItemIds, ...used],
      lastSlot,
      slotCounts,
      lastVariantByLine,
    });
    rounds.push(round);
    used.push(...round.itemIds);
    if (round.correctSlot !== null) {
      lastSlot = round.correctSlot;
      slotCounts[round.correctSlot] = (slotCounts[round.correctSlot] ?? 0) + 1;
    }
    lastVariantByLine[round.prompt.lineId] = round.prompt.variant;
  }
  return rounds;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/generator/round.test.ts`
Expected: PASS (9 tests). If the property test reports a failing seed, the shrunk counter-example names the template, level and seed — reproduce it with the inspect CLI from Task 11.

- [ ] **Step 5: Commit**

```bash
git add src/engine/generator/round.ts src/engine/generator/round.test.ts
git commit -m "feat(generator): deterministic rounds and sets with wording, scene and slot variation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The inspect-round CLI

**Files:**
- Create: `scripts/inspect-round.ts`

- [ ] **Step 1: Write the script**

```ts
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
```

- [ ] **Step 2: Run it for three templates**

Run: `npm run inspect -- big-small.tap --seed 7 --level 2 && npm run inspect -- counting.give --seed 3 && npm run inspect -- kind-fair.scene --seed 1`
Expected: readable listings; in `big-small.tap` the ✓ moves between slots across the six rounds and no object repeats; `counting.give` shows "Give Buddy N …" with N ✓ copies; `kind-fair.scene` shows the narration and the kind choice ticked.

- [ ] **Step 3: Commit**

```bash
git add scripts/inspect-round.ts
git commit -m "feat(scripts): inspect-round CLI to print generated sets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Progress types and mastery by form

**Files:**
- Create: `src/engine/progress/types.ts`, `src/engine/progress/mastery.ts`
- Test: `src/engine/progress/mastery.test.ts`

- [ ] **Step 1: Write `src/engine/progress/types.ts` (the on-device records of spec §10)**

```ts
// src/engine/progress/types.ts
import type { LevelId, MechanicId } from '../content/schema';
import type { Level } from '../generator/types';

export type Outcome = 'correct' | 'corrected' | 'shown';

/** What a mechanic records about the round it just ran; the history builders read these back. */
export interface AttemptDetails {
  itemIds?: string[];
  slot?: number | null;
  sceneId?: string;
  lineId?: string;
  lineVariant?: number;
  [key: string]: unknown;
}

export interface Attempt {
  id?: number;
  profileId: string;
  at: number;
  sessionIndex: number;
  templateId: string;
  topicId: string;
  goalId: string;
  mechanic: MechanicId;
  /** `${mechanic}:${itemClass}` — the unit of generalisation */
  form: string;
  seed: number;
  level: Level;
  outcome: Outcome;
  hints: number;
  durationMs: number;
  details?: AttemptDetails;
}

export interface SetResult {
  id?: number;
  profileId: string;
  at: number;
  sessionIndex: number;
  templateId: string;
  goalId: string;
  level: Level;
  correct: number;
  total: number;
}

export interface Profile {
  id: string;
  name: string;
  level: LevelId;
  buddy: { colour: string; name: string; accessory: string };
  createdAt: number;
}

export interface Session {
  id?: number;
  profileId: string;
  /** 1-based, increases on every visit */
  index: number;
  startedAt: number;
}

export interface Settings {
  profileId: string;
  timerMinutes: 10 | 15 | 20 | 30;
  theme: 'storybook' | 'soft-flat';
  music: boolean;
  ttsFallback: boolean;
  leftHanded: boolean;
  reducedMotion: boolean;
}

export const defaultSettings = (profileId: string): Settings => ({
  profileId, timerMinutes: 15, theme: 'storybook', music: true, ttsFallback: true, leftHanded: false, reducedMotion: false,
});

export interface RoutineEvent {
  id?: number;
  profileId: string;
  at: number;
  sessionIndex: number;
  sceneId: string;
  completed: boolean;
  selfReport?: 'yes' | 'not-yet' | 'skipped';
  randomEventId?: string;
}

export interface CheckIn {
  id?: number;
  profileId: string;
  at: number;
  sessionIndex: number;
  feeling: string;
  breathTaken: boolean;
}

export interface Sticker {
  id?: number;
  profileId: string;
  at: number;
  pictureId: string;
  /** templateId or sceneId that earned it */
  source: string;
  shiny: boolean;
}

export interface Unlocks {
  profileId: string;
  dances: string[];
  accessories: string[];
  roomItems: string[];
  stories: string[];
  roomLayout: Record<string, { x: number; y: number }>;
}

export interface WritingSample {
  id?: number;
  profileId: string;
  at: number;
  glyph: string;
  mode: 'free' | 'faded' | 'guided';
  strokes: Array<Array<{ x: number; y: number; p: number; t: number }>>;
  scores: { shape: number; placement: number; size: number; strokes: number };
  outcome: 'great' | 'nearly' | 'watch';
}

export interface PaperResult {
  id?: number;
  profileId: string;
  at: number;
  paperId: string;
  seed: number;
  marks: Array<{ question: number; got: number; max: number }>;
}

export type GoalStatus = 'new' | 'mastered' | 'shaky' | 'needs-practice';
```

- [ ] **Step 2: Write the failing tests for mastery**

```ts
// src/engine/progress/mastery.test.ts
import { describe, it, expect } from 'vitest';
import { goalStatus, formSummary } from './mastery';
import type { Attempt, Outcome } from './types';

let t = 0;
const attempt = (form: string, outcome: Outcome): Attempt => ({
  profileId: 'p', at: ++t, sessionIndex: 1, templateId: 'x', topicId: 'big-small', goalId: 'g', mechanic: 'tap-the-one',
  form, seed: 0, level: 1, outcome, hints: 0, durationMs: 1000,
});
const many = (n: number, form: string, outcome: Outcome) => Array.from({ length: n }, () => attempt(form, outcome));

describe('goalStatus', () => {
  it('is new with fewer than 4 attempts', () => {
    expect(goalStatus([])).toBe('new');
    expect(goalStatus(many(3, 'a', 'correct'))).toBe('new');
  });

  it('is mastered only with ≥80% and ≥3 distinct successful forms', () => {
    expect(goalStatus([...many(3, 'a', 'correct'), ...many(3, 'b', 'correct'), ...many(3, 'c', 'correct')])).toBe('mastered');
    expect(goalStatus([...many(5, 'a', 'correct'), ...many(5, 'b', 'correct')])).toBe('shaky');
  });

  it('is needs-practice below 50%', () => {
    expect(goalStatus([...many(2, 'a', 'correct'), ...many(4, 'b', 'shown')])).toBe('needs-practice');
  });

  it('weighs corrected answers as half', () => {
    // 4 corrected = 2.0 / 4 = 50% → shaky, not needs-practice
    expect(goalStatus(many(4, 'a', 'corrected'))).toBe('shaky');
  });

  it('only looks at the last 12 attempts', () => {
    const old = many(12, 'a', 'shown');
    const recent = [...many(4, 'a', 'correct'), ...many(4, 'b', 'correct'), ...many(4, 'c', 'correct')];
    expect(goalStatus([...old, ...recent])).toBe('mastered');
  });
});

describe('formSummary', () => {
  it('counts attempts and correct answers per form, most attempted first', () => {
    const attempts = [...many(3, 'a', 'correct'), attempt('a', 'shown'), ...many(2, 'b', 'corrected')];
    expect(formSummary(attempts)).toEqual([
      { form: 'a', attempts: 4, correct: 3 },
      { form: 'b', attempts: 2, correct: 0 },
    ]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/engine/progress/mastery.test.ts`
Expected: FAIL — `Cannot find module './mastery'`.

- [ ] **Step 4: Implement `src/engine/progress/mastery.ts`**

```ts
// src/engine/progress/mastery.ts
import type { Attempt, GoalStatus, Outcome } from './types';

const WEIGHT: Record<Outcome, number> = { correct: 1, corrected: 0.5, shown: 0 };

/**
 * Spec §5.5. Over the last `window` attempts of one goal:
 * new (<4) · mastered (≥80% and ≥3 distinct forms with a fully correct answer) · needs-practice (<50%) · shaky.
 */
export function goalStatus(attempts: readonly Attempt[], window = 12): GoalStatus {
  const recent = [...attempts].sort((a, b) => a.at - b.at).slice(-window);
  if (recent.length < 4) return 'new';
  const rate = recent.reduce((sum, a) => sum + WEIGHT[a.outcome], 0) / recent.length;
  const formsWithCorrect = new Set(recent.filter((a) => a.outcome === 'correct').map((a) => a.form));
  if (rate >= 0.8 && formsWithCorrect.size >= 3) return 'mastered';
  if (rate < 0.5) return 'needs-practice';
  return 'shaky';
}

/** Per-form counts for the parent corner ("forms attempted"). */
export function formSummary(attempts: readonly Attempt[]): Array<{ form: string; attempts: number; correct: number }> {
  const byForm = new Map<string, { form: string; attempts: number; correct: number }>();
  for (const a of attempts) {
    const row = byForm.get(a.form) ?? { form: a.form, attempts: 0, correct: 0 };
    row.attempts += 1;
    if (a.outcome === 'correct') row.correct += 1;
    byForm.set(a.form, row);
  }
  return [...byForm.values()].sort((x, y) => y.attempts - x.attempts || x.form.localeCompare(y.form));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/engine/progress/mastery.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/progress/types.ts src/engine/progress/mastery.ts src/engine/progress/mastery.test.ts
git commit -m "feat(progress): record types and mastery-by-form status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Difficulty ramp and bridging

**Files:**
- Create: `src/engine/progress/difficulty.ts`, `src/engine/progress/bridging.ts`
- Test: `src/engine/progress/difficulty.test.ts`, `src/engine/progress/bridging.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/progress/difficulty.test.ts
import { describe, it, expect } from 'vitest';
import { levelFor } from './difficulty';
import type { SetResult } from './types';
import type { Level } from '../generator/types';

let t = 0;
const set = (level: Level, correct: number, total = 6): SetResult => ({
  profileId: 'p', at: ++t, sessionIndex: 1, templateId: 'x', goalId: 'g', level, correct, total,
});

describe('levelFor', () => {
  it('starts at level 1', () => {
    expect(levelFor([])).toBe(1);
  });

  it('goes up after two consecutive sets at ≥85%', () => {
    expect(levelFor([set(1, 6)])).toBe(1);
    expect(levelFor([set(1, 6), set(1, 6)])).toBe(2);
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6), set(2, 6)])).toBe(3);
  });

  it('caps at level 3', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 6), set(2, 6), set(3, 6), set(3, 6)])).toBe(3);
  });

  it('drops a level after a set at ≤50%, never below 1', () => {
    expect(levelFor([set(1, 6), set(1, 6), set(2, 3)])).toBe(1);
    expect(levelFor([set(1, 2)])).toBe(1);
  });

  it('a middling set breaks the streak', () => {
    expect(levelFor([set(1, 6), set(1, 4), set(1, 6)])).toBe(1);
  });
});
```

```ts
// src/engine/progress/bridging.test.ts
import { describe, it, expect } from 'vitest';
import { preferredForm } from './bridging';
import type { Attempt, Outcome } from './types';

let t = 0;
const attempt = (form: string, outcome: Outcome): Attempt => ({
  profileId: 'p', at: ++t, sessionIndex: 1, templateId: 'x', topicId: 'tp', goalId: 'g', mechanic: 'tap-the-one',
  form, seed: 0, level: 1, outcome, hints: 0, durationMs: 1,
});

describe('preferredForm', () => {
  it('is null when the last attempt was correct', () => {
    expect(preferredForm([attempt('a', 'shown'), attempt('b', 'correct')])).toBeNull();
  });

  it('is null when the failed form already had a success (not a "new form" miss)', () => {
    expect(preferredForm([attempt('b', 'correct'), attempt('b', 'shown')])).toBeNull();
  });

  it('returns the most recently successful other form after a miss on a new form', () => {
    expect(preferredForm([attempt('a', 'correct'), attempt('c', 'correct'), attempt('b', 'shown')])).toBe('c');
    expect(preferredForm([attempt('a', 'correct'), attempt('c', 'correct'), attempt('b', 'corrected')])).toBe('c');
  });

  it('is null when nothing has ever succeeded', () => {
    expect(preferredForm([attempt('b', 'shown')])).toBeNull();
    expect(preferredForm([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/progress/difficulty.test.ts src/engine/progress/bridging.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both modules**

```ts
// src/engine/progress/difficulty.ts
import type { Level } from '../generator/types';
import type { SetResult } from './types';

/**
 * Spec §5.4 rule 7. Replays a template's set results in time order:
 * two consecutive sets at ≥85% raise the level (max 3); a set at ≤50% lowers it (min 1); anything else resets the streak.
 */
export function levelFor(results: readonly SetResult[]): Level {
  let level: Level = 1;
  let streak = 0;
  for (const r of [...results].sort((a, b) => a.at - b.at)) {
    if (r.level !== level) {
      streak = 0;
      continue;
    }
    const rate = r.total === 0 ? 0 : r.correct / r.total;
    if (rate >= 0.85) {
      streak += 1;
      if (streak >= 2 && level < 3) {
        level = (level + 1) as Level;
        streak = 0;
      }
    } else if (rate <= 0.5) {
      if (level > 1) level = (level - 1) as Level;
      streak = 0;
    } else {
      streak = 0;
    }
  }
  return level;
}
```

```ts
// src/engine/progress/bridging.ts
import type { Attempt } from './types';

/**
 * Spec §5.5 bridging. After a miss in a form that has never succeeded, return the most recently
 * successful *other* form so the next round can bridge back to it. Otherwise null.
 */
export function preferredForm(attempts: readonly Attempt[]): string | null {
  const sorted = [...attempts].sort((a, b) => a.at - b.at);
  const last = sorted[sorted.length - 1];
  if (!last || last.outcome === 'correct') return null;
  const earlier = sorted.slice(0, -1);
  if (earlier.some((a) => a.form === last.form && a.outcome === 'correct')) return null;
  const known = earlier.filter((a) => a.outcome === 'correct' && a.form !== last.form);
  const bridge = known[known.length - 1];
  return bridge ? bridge.form : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/progress/difficulty.test.ts src/engine/progress/bridging.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/progress/difficulty.ts src/engine/progress/bridging.ts src/engine/progress/difficulty.test.ts src/engine/progress/bridging.test.ts
git commit -m "feat(progress): difficulty ramp and bridging form preference

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Template picker and topic suggestion (variation rules 5 and 6)

**Files:**
- Create: `src/engine/progress/picker.ts`
- Test: `src/engine/progress/picker.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/progress/picker.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from '../content/readPackFromDisk';
import { loadPack } from '../content/load';
import { mulberry32 } from '../rng';
import { pickTemplate, suggestTopic, EMPTY_PICKER_HISTORY, type PickerHistory } from './picker';
import type { Attempt, Outcome } from './types';

const pack = readPack();

let t = 0;
const attempt = (goalId: string, topicId: string, form: string, outcome: Outcome, templateId = 'x'): Attempt => ({
  profileId: 'p', at: ++t, sessionIndex: 1, templateId, topicId, goalId, mechanic: 'tap-the-one',
  form, seed: 0, level: 1, outcome, hints: 0, durationMs: 1,
});

describe('pickTemplate', () => {
  it('throws for a topic without templates', () => {
    expect(() => pickTemplate(pack, 'nope', EMPTY_PICKER_HISTORY, mulberry32(1))).toThrow(/no templates/);
  });

  it('rotates the mechanic when the topic was played with another one last time', () => {
    const history: PickerHistory = { ...EMPTY_PICKER_HISTORY, lastMechanicByTopic: { 'big-small': 'tap-the-one' } };
    for (let s = 0; s < 20; s++) expect(pickTemplate(pack, 'big-small', history, mulberry32(s)).template.id).toBe('big-small.sort');
  });

  it('favours templates whose goal needs practice', () => {
    const weak = Array.from({ length: 6 }, () => attempt('big-small.sort', 'big-small', 'sort-into-bins:objects', 'shown'));
    const strong = [
      ...Array.from({ length: 4 }, () => attempt('big-small.identify', 'big-small', 'tap-the-one:objects', 'correct')),
      ...Array.from({ length: 4 }, () => attempt('big-small.identify', 'big-small', 'give-to-buddy:objects', 'correct')),
      ...Array.from({ length: 4 }, () => attempt('big-small.identify', 'big-small', 'stack-by-size:objects', 'correct')),
    ];
    const history: PickerHistory = { ...EMPTY_PICKER_HISTORY, attemptsByGoal: { 'big-small.sort': weak, 'big-small.identify': strong } };
    let sorts = 0;
    for (let s = 0; s < 200; s++) if (pickTemplate(pack, 'big-small', history, mulberry32(s)).template.id === 'big-small.sort') sorts++;
    expect(sorts).toBeGreaterThan(140);
  });

  it('bridges to a known-good form after a miss on a new form of the same goal', () => {
    const mini = loadPack({
      topics: [{ id: 'tp', subject: 'numeracy', title: 'T', goals: [{ id: 'g', title: 'G' }] }],
      objects: [
        { id: 'apple', name: 'apple', lineId: 'obj.apple', asset: 'a.svg', category: 'fruit', tags: { sizePair: true } },
        { id: 'ball', name: 'ball', lineId: 'obj.ball', asset: 'b.svg', category: 'thing', tags: { sizePair: true } },
        { id: 'car', name: 'car', lineId: 'obj.car', asset: 'c.svg', category: 'thing', tags: { sizePair: true } },
        { id: 'cat', name: 'cat', lineId: 'obj.cat', asset: 'd.svg', category: 'animal', tags: { sizePair: true } },
      ],
      glyphs: [], scenes: [{ id: 's', asset: 's.svg', theme: 's' }],
      lines: [{ id: 'obj.apple', variants: ['apple'] }, { id: 'obj.ball', variants: ['ball'] }, { id: 'obj.car', variants: ['car'] }, { id: 'obj.cat', variants: ['cat'] }, { id: 'p', variants: ['Tap the big {target}'] }, { id: 'bin.big', variants: ['big'] }, { id: 'bin.small', variants: ['small'] }],
      scenarios: [], sequences: [],
      templates: [
        { id: 'tap', topicId: 'tp', goalId: 'g', mechanic: 'tap-the-one', itemClass: 'objects', query: { pool: 'objects' }, rule: { kind: 'size', target: 'larger' }, rounds: 2,
          difficulty: [{ options: 2, distractorSimilarity: 'low' }, { options: 3, distractorSimilarity: 'medium' }, { options: 4, distractorSimilarity: 'high' }],
          flavour: { scenes: ['s'], promptLineId: 'p' }, level: 'lkg' },
        { id: 'sort', topicId: 'tp', goalId: 'g', mechanic: 'sort-into-bins', itemClass: 'objects', query: { pool: 'objects' }, rule: { kind: 'size', target: 'larger' }, rounds: 2,
          difficulty: [{ options: 4, distractorSimilarity: 'low' }, { options: 6, distractorSimilarity: 'medium' }, { options: 8, distractorSimilarity: 'high' }],
          bins: [{ id: 'big', label: 'big', lineId: 'bin.big', match: 'large' }, { id: 'small', label: 'small', lineId: 'bin.small', match: 'small' }],
          flavour: { scenes: ['s'], promptLineId: 'p' }, level: 'lkg' },
      ],
    });
    const attempts = [
      attempt('g', 'tp', 'tap-the-one:objects', 'correct', 'tap'),
      attempt('g', 'tp', 'tap-the-one:objects', 'correct', 'tap'),
      attempt('g', 'tp', 'sort-into-bins:objects', 'shown', 'sort'),
    ];
    const history: PickerHistory = { ...EMPTY_PICKER_HISTORY, attemptsByGoal: { g: attempts }, lastMechanicByTopic: { tp: 'sort-into-bins' } };
    const pick = pickTemplate(mini, 'tp', history, mulberry32(1));
    expect(pick.template.id).toBe('tap');
    expect(pick.bridgeFrom).toBe('sort-into-bins:objects');
  });
});

describe('suggestTopic', () => {
  it('never suggests the topic just played', () => {
    for (let s = 0; s < 30; s++) expect(suggestTopic(pack, { ...EMPTY_PICKER_HISTORY, lastTopicId: 'feelings' }, mulberry32(s))).not.toBe('feelings');
  });

  it('leans toward a different subject than the last suggestion', () => {
    let numeracy = 0;
    for (let s = 0; s < 200; s++) {
      const topic = pack.topics.get(suggestTopic(pack, { ...EMPTY_PICKER_HISTORY, lastSuggestedSubject: 'numeracy' }, mulberry32(s)))!;
      if (topic.subject === 'numeracy') numeracy++;
    }
    expect(numeracy).toBeLessThan(40); // 2 of 10 topics are numeracy; with the ×2 boost on others they should land well under 20%
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/progress/picker.test.ts`
Expected: FAIL — `Cannot find module './picker'`.

- [ ] **Step 3: Implement `src/engine/progress/picker.ts`**

```ts
// src/engine/progress/picker.ts
import type { ContentPack } from '../content/load';
import type { MechanicId, SubjectId, Template } from '../content/schema';
import type { Rng } from '../rng';
import { preferredForm } from './bridging';
import { goalStatus } from './mastery';
import type { Attempt, GoalStatus } from './types';

export interface PickerHistory {
  sessionIndex: number;
  /** templateId → the session index it was last played in */
  lastPlayedSession: Record<string, number>;
  /** topicId → mechanic used the last time this topic was played */
  lastMechanicByTopic: Record<string, MechanicId>;
  attemptsByGoal: Record<string, Attempt[]>;
  lastTopicId: string | null;
  lastSuggestedSubject: SubjectId | null;
}

export const EMPTY_PICKER_HISTORY: PickerHistory = {
  sessionIndex: 1,
  lastPlayedSession: {},
  lastMechanicByTopic: {},
  attemptsByGoal: {},
  lastTopicId: null,
  lastSuggestedSubject: null,
};

export interface TemplatePick {
  template: Template;
  /** the form the child just missed, when this pick is a bridge back to a familiar form */
  bridgeFrom: string | null;
}

const STATUS_WEIGHT: Record<GoalStatus, number> = { 'needs-practice': 3, shaky: 2, new: 1.5, mastered: 0.25 };

function weightedPick<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T {
  const weights = items.map((i) => Math.max(0, weight(i)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] as number;
    if (r <= 0) return items[i] as T;
  }
  return items[items.length - 1] as T;
}

const formOf = (t: Template) => `${t.mechanic}:${t.itemClass}`;

/** Spec §5.4 rules 5–7 and §5.5 bridging: choose which template of a topic to play now. */
export function pickTemplate(pack: ContentPack, topicId: string, history: PickerHistory, rng: Rng): TemplatePick {
  const all = pack.templatesByTopic.get(topicId) ?? [];
  if (all.length === 0) throw new Error(`topic ${topicId} has no templates`);

  // Bridging first: a miss on a never-successful form sends the child back to a form that worked.
  for (const template of all) {
    const attempts = history.attemptsByGoal[template.goalId] ?? [];
    const wanted = preferredForm(attempts);
    if (!wanted) continue;
    const bridge = all.find((t) => t.goalId === template.goalId && formOf(t) === wanted);
    const last = [...attempts].sort((a, b) => a.at - b.at).at(-1);
    if (bridge && last) return { template: bridge, bridgeFrom: last.form };
  }

  // Rule 5: rotate mechanics across days.
  let candidates = all;
  const lastMechanic = history.lastMechanicByTopic[topicId];
  if (lastMechanic && all.length > 1) {
    const rotated = all.filter((t) => t.mechanic !== lastMechanic);
    if (rotated.length > 0) candidates = rotated;
  }

  const template = weightedPick(rng, candidates, (t) => {
    let w = 1;
    const lastSession = history.lastPlayedSession[t.id];
    if (lastSession === undefined || history.sessionIndex - lastSession >= 3) w += 2;
    return w * STATUS_WEIGHT[goalStatus(history.attemptsByGoal[t.goalId] ?? [])];
  });
  return { template, bridgeFrom: null };
}

/** Rule 6: Buddy's suggested next spot — shaky goals first, alternating subjects, never the topic just played. */
export function suggestTopic(pack: ContentPack, history: PickerHistory, rng: Rng): string {
  const playable = [...pack.topics.values()].filter((t) => (pack.templatesByTopic.get(t.id)?.length ?? 0) > 0);
  const eligible = playable.filter((t) => t.id !== history.lastTopicId);
  const pool = eligible.length > 0 ? eligible : playable;
  const chosen = weightedPick(rng, pool, (t) => {
    const worst = Math.max(...t.goals.map((g) => STATUS_WEIGHT[goalStatus(history.attemptsByGoal[g.id] ?? [])]));
    const subjectBoost = t.subject !== history.lastSuggestedSubject ? 2 : 1;
    return worst * subjectBoost;
  });
  return chosen.id;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/progress/picker.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/progress/picker.ts src/engine/progress/picker.test.ts
git commit -m "feat(progress): template picker with rotation, bridging and shaky-goal weighting; topic suggestion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: On-device database (Dexie) and repository functions

**Files:**
- Create: `src/engine/progress/db.ts`
- Test: `src/engine/progress/db.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/progress/db.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDb, createProfile, listProfiles, startSession, recordAttempt, recordSetResult,
  attemptsForGoal, setResultsForTemplate, getSettings, saveSettings, type BuddyDB,
} from './db';

let db: BuddyDB;
let n = 0;
beforeEach(() => {
  db = createDb(`test-${++n}`);
});

const buddy = { colour: 'blue', name: 'Gaju', accessory: 'cap' };

describe('profiles and sessions', () => {
  it('creates a profile with default settings and starter unlocks', async () => {
    const p = await createProfile(db, { name: 'Anika', buddy });
    expect((await listProfiles(db)).map((x) => x.id)).toEqual([p.id]);
    expect((await getSettings(db, p.id)).timerMinutes).toBe(15);
    expect((await db.unlocks.get(p.id))?.dances).toEqual(['trunk-twirl', 'elephant-stomp']);
  });

  it('numbers sessions per profile from 1', async () => {
    const a = await createProfile(db, { name: 'A', buddy });
    const b = await createProfile(db, { name: 'B', buddy });
    expect((await startSession(db, a.id)).index).toBe(1);
    expect((await startSession(db, a.id)).index).toBe(2);
    expect((await startSession(db, b.id)).index).toBe(1);
  });
});

describe('attempts and set results', () => {
  it('stores and reads back attempts for a goal in time order', async () => {
    const p = await createProfile(db, { name: 'A', buddy });
    const base = { profileId: p.id, sessionIndex: 1, templateId: 'big-small.tap', topicId: 'big-small', goalId: 'big-small.identify', mechanic: 'tap-the-one' as const, form: 'tap-the-one:objects', seed: 1, level: 1 as const, hints: 0, durationMs: 900 };
    await recordAttempt(db, { ...base, at: 20, outcome: 'shown' });
    await recordAttempt(db, { ...base, at: 10, outcome: 'correct' });
    await recordAttempt(db, { ...base, at: 30, goalId: 'other', outcome: 'correct' });
    const got = await attemptsForGoal(db, p.id, 'big-small.identify');
    expect(got.map((a) => a.at)).toEqual([10, 20]);
  });

  it('stores set results per template', async () => {
    const p = await createProfile(db, { name: 'A', buddy });
    await recordSetResult(db, { profileId: p.id, at: 1, sessionIndex: 1, templateId: 'x', goalId: 'g', level: 1, correct: 5, total: 6 });
    await recordSetResult(db, { profileId: p.id, at: 2, sessionIndex: 1, templateId: 'y', goalId: 'g', level: 1, correct: 2, total: 6 });
    expect((await setResultsForTemplate(db, p.id, 'x')).map((r) => r.correct)).toEqual([5]);
  });
});

describe('settings', () => {
  it('returns defaults for an unknown profile and persists changes', async () => {
    expect((await getSettings(db, 'ghost')).theme).toBe('storybook');
    const p = await createProfile(db, { name: 'A', buddy });
    await saveSettings(db, { ...(await getSettings(db, p.id)), timerMinutes: 20, theme: 'soft-flat' });
    const s = await getSettings(db, p.id);
    expect(s.timerMinutes).toBe(20);
    expect(s.theme).toBe('soft-flat');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/progress/db.test.ts`
Expected: FAIL — `Cannot find module './db'`.

- [ ] **Step 3: Implement `src/engine/progress/db.ts`**

```ts
// src/engine/progress/db.ts
import Dexie, { type EntityTable } from 'dexie';
import {
  defaultSettings,
  type Attempt, type CheckIn, type PaperResult, type Profile, type RoutineEvent, type Session, type SetResult,
  type Settings, type Sticker, type Unlocks, type WritingSample,
} from './types';

export class BuddyDB extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  attempts!: EntityTable<Attempt, 'id'>;
  setResults!: EntityTable<SetResult, 'id'>;
  routineEvents!: EntityTable<RoutineEvent, 'id'>;
  checkIns!: EntityTable<CheckIn, 'id'>;
  stickers!: EntityTable<Sticker, 'id'>;
  unlocks!: EntityTable<Unlocks, 'profileId'>;
  writingSamples!: EntityTable<WritingSample, 'id'>;
  paperResults!: EntityTable<PaperResult, 'id'>;
  settings!: EntityTable<Settings, 'profileId'>;

  constructor(name = 'buddy') {
    super(name);
    this.version(1).stores({
      profiles: 'id, createdAt',
      sessions: '++id, profileId, [profileId+index]',
      attempts: '++id, profileId, at, [profileId+goalId], [profileId+templateId], [profileId+sessionIndex]',
      setResults: '++id, profileId, at, [profileId+templateId]',
      routineEvents: '++id, profileId, at',
      checkIns: '++id, profileId, at',
      stickers: '++id, profileId, at',
      unlocks: 'profileId',
      writingSamples: '++id, profileId, at, [profileId+glyph]',
      paperResults: '++id, profileId, at',
      settings: 'profileId',
    });
  }
}

export function createDb(name?: string): BuddyDB {
  return new BuddyDB(name);
}

export const STARTER_DANCES = ['trunk-twirl', 'elephant-stomp'];

export async function createProfile(
  db: BuddyDB,
  input: { name: string; buddy: Profile['buddy']; level?: Profile['level'] },
): Promise<Profile> {
  const profile: Profile = { id: crypto.randomUUID(), name: input.name, level: input.level ?? 'lkg', buddy: input.buddy, createdAt: Date.now() };
  await db.transaction('rw', [db.profiles, db.settings, db.unlocks], async () => {
    await db.profiles.add(profile);
    await db.settings.put(defaultSettings(profile.id));
    await db.unlocks.put({ profileId: profile.id, dances: [...STARTER_DANCES], accessories: [], roomItems: [], stories: [], roomLayout: {} });
  });
  return profile;
}

export async function listProfiles(db: BuddyDB): Promise<Profile[]> {
  return db.profiles.orderBy('createdAt').toArray();
}

export async function startSession(db: BuddyDB, profileId: string): Promise<Session> {
  const last = await db.sessions.where('[profileId+index]').between([profileId, Dexie.minKey], [profileId, Dexie.maxKey]).last();
  const session: Session = { profileId, index: (last?.index ?? 0) + 1, startedAt: Date.now() };
  session.id = await db.sessions.add(session);
  return session;
}

/** Resolves to the auto-incremented id (Dexie types it as possibly undefined because `id` is optional). */
export async function recordAttempt(db: BuddyDB, attempt: Omit<Attempt, 'id'>): Promise<number | undefined> {
  return db.attempts.add(attempt as Attempt);
}

export async function recordSetResult(db: BuddyDB, result: Omit<SetResult, 'id'>): Promise<number | undefined> {
  return db.setResults.add(result as SetResult);
}

export async function attemptsForGoal(db: BuddyDB, profileId: string, goalId: string): Promise<Attempt[]> {
  const rows = await db.attempts.where('[profileId+goalId]').equals([profileId, goalId]).toArray();
  return rows.sort((a, b) => a.at - b.at);
}

export async function attemptsForProfile(db: BuddyDB, profileId: string): Promise<Attempt[]> {
  const rows = await db.attempts.where('profileId').equals(profileId).toArray();
  return rows.sort((a, b) => a.at - b.at);
}

export async function setResultsForTemplate(db: BuddyDB, profileId: string, templateId: string): Promise<SetResult[]> {
  const rows = await db.setResults.where('[profileId+templateId]').equals([profileId, templateId]).toArray();
  return rows.sort((a, b) => a.at - b.at);
}

export async function getSettings(db: BuddyDB, profileId: string): Promise<Settings> {
  return (await db.settings.get(profileId)) ?? defaultSettings(profileId);
}

export async function saveSettings(db: BuddyDB, settings: Settings): Promise<void> {
  await db.settings.put(settings);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/progress/db.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/progress/db.ts src/engine/progress/db.test.ts
git commit -m "feat(progress): dexie database with profiles, sessions, attempts, set results and settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: History builders (database → generator and picker inputs)

**Files:**
- Create: `src/engine/progress/history.ts`
- Test: `src/engine/progress/history.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/progress/history.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { readPack } from '../content/readPackFromDisk';
import { generateSet } from '../generator/round';
import { EMPTY_HISTORY } from '../generator/types';
import { createDb, createProfile, recordAttempt, type BuddyDB } from './db';
import { attemptFromRound, buildGeneratorHistory, buildPickerHistory } from './history';

const pack = readPack();
let db: BuddyDB;
let n = 0;
let profileId: string;
beforeEach(async () => {
  db = createDb(`hist-${++n}`);
  profileId = (await createProfile(db, { name: 'A', buddy: { colour: 'blue', name: 'Gaju', accessory: 'cap' } })).id;
});

describe('attemptFromRound', () => {
  it('copies identity, form, seed, level and the details the generator needs back', () => {
    const [round] = generateSet(pack, pack.templates.get('big-small.tap')!, { seed: 5, level: 2, history: EMPTY_HISTORY });
    const a = attemptFromRound(round!, { profileId, sessionIndex: 3, at: 123, outcome: 'correct', hints: 0, durationMs: 800 });
    expect(a).toMatchObject({ profileId, sessionIndex: 3, at: 123, templateId: 'big-small.tap', topicId: 'big-small', goalId: 'big-small.identify', mechanic: 'tap-the-one', form: 'tap-the-one:objects', level: 2, outcome: 'correct' });
    expect(a.details).toEqual({ itemIds: round!.itemIds, slot: round!.correctSlot, sceneId: round!.sceneId, lineId: round!.prompt.lineId, lineVariant: round!.prompt.variant });
  });
});

describe('buildGeneratorHistory', () => {
  it('collects recent item ids (last 3 sessions), the last slot, scene and wording variants', async () => {
    const template = pack.templates.get('big-small.tap')!;
    const oldRounds = generateSet(pack, template, { seed: 1, level: 1, history: EMPTY_HISTORY });
    const newRounds = generateSet(pack, template, { seed: 2, level: 1, history: EMPTY_HISTORY });
    let at = 0;
    for (const r of oldRounds) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: 1, at: ++at, outcome: 'correct', hints: 0, durationMs: 1 }));
    for (const r of newRounds) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: 5, at: ++at, outcome: 'correct', hints: 0, durationMs: 1 }));

    const h = await buildGeneratorHistory(db, profileId, 'big-small.identify', 6);
    expect(h.recentItemIds).toEqual(newRounds.flatMap((r) => r.itemIds)); // session 1 is older than 3 sessions
    const last = newRounds[newRounds.length - 1]!;
    expect(h.lastSlot).toBe(last.correctSlot);
    expect(h.lastSceneId).toBe(last.sceneId);
    expect(h.lastVariantByLine['prompt.tap_big']).toBe(last.prompt.variant);
  });

  it('is empty for a goal never played', async () => {
    expect(await buildGeneratorHistory(db, profileId, 'nothing', 1)).toEqual(EMPTY_HISTORY);
  });
});

describe('buildPickerHistory', () => {
  it('aggregates last played session, last mechanic per topic, attempts per goal and the last topic', async () => {
    const tap = generateSet(pack, pack.templates.get('big-small.tap')!, { seed: 1, level: 1, history: EMPTY_HISTORY });
    const sort = generateSet(pack, pack.templates.get('big-small.sort')!, { seed: 1, level: 1, history: EMPTY_HISTORY });
    const faces = generateSet(pack, pack.templates.get('feelings.tap')!, { seed: 1, level: 1, history: EMPTY_HISTORY });
    let at = 0;
    for (const r of tap) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: 1, at: ++at, outcome: 'correct', hints: 0, durationMs: 1 }));
    for (const r of faces) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: 2, at: ++at, outcome: 'shown', hints: 1, durationMs: 1 }));
    for (const r of sort) await recordAttempt(db, attemptFromRound(r, { profileId, sessionIndex: 2, at: ++at, outcome: 'correct', hints: 0, durationMs: 1 }));

    const h = await buildPickerHistory(db, profileId, 3);
    expect(h.sessionIndex).toBe(3);
    expect(h.lastPlayedSession).toEqual({ 'big-small.tap': 1, 'feelings.tap': 2, 'big-small.sort': 2 });
    expect(h.lastMechanicByTopic).toEqual({ 'big-small': 'sort-into-bins', feelings: 'tap-the-one' });
    expect(Object.keys(h.attemptsByGoal).sort()).toEqual(['big-small.identify', 'big-small.sort', 'feelings.name']);
    expect(h.lastTopicId).toBe('big-small');
    expect(h.lastSuggestedSubject).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/progress/history.test.ts`
Expected: FAIL — `Cannot find module './history'`.

- [ ] **Step 3: Implement `src/engine/progress/history.ts`**

```ts
// src/engine/progress/history.ts
import type { GeneratorHistory, Round } from '../generator/types';
import { attemptsForGoal, attemptsForProfile, type BuddyDB } from './db';
import type { PickerHistory } from './picker';
import type { Attempt, Outcome } from './types';

/** Build the attempt record for a round the child just finished. */
export function attemptFromRound(
  round: Round,
  result: { profileId: string; sessionIndex: number; at: number; outcome: Outcome; hints: number; durationMs: number },
): Omit<Attempt, 'id'> {
  return {
    profileId: result.profileId,
    at: result.at,
    sessionIndex: result.sessionIndex,
    templateId: round.templateId,
    topicId: round.topicId,
    goalId: round.goalId,
    mechanic: round.mechanic,
    form: round.form,
    seed: round.seed,
    level: round.level,
    outcome: result.outcome,
    hints: result.hints,
    durationMs: result.durationMs,
    details: {
      itemIds: round.itemIds,
      slot: round.correctSlot,
      sceneId: round.sceneId,
      lineId: round.prompt.lineId,
      lineVariant: round.prompt.variant,
    },
  };
}

/** What the generator needs to vary the next set for this goal. */
export async function buildGeneratorHistory(db: BuddyDB, profileId: string, goalId: string, sessionIndex: number): Promise<GeneratorHistory> {
  const attempts = await attemptsForGoal(db, profileId, goalId);
  const recent = attempts.filter((a) => a.sessionIndex >= sessionIndex - 3);
  const last = attempts[attempts.length - 1];
  const lastVariantByLine: Record<string, number> = {};
  for (const a of attempts.slice(-20)) {
    if (a.details?.lineId && a.details.lineVariant !== undefined) lastVariantByLine[a.details.lineId] = a.details.lineVariant;
  }
  return {
    recentItemIds: recent.flatMap((a) => a.details?.itemIds ?? []),
    lastSlot: last?.details?.slot ?? null,
    lastSceneId: last?.details?.sceneId ?? null,
    lastVariantByLine,
  };
}

/** What the picker needs to choose the next template and suggest a topic. */
export async function buildPickerHistory(db: BuddyDB, profileId: string, sessionIndex: number): Promise<PickerHistory> {
  const attempts = await attemptsForProfile(db, profileId);
  const lastPlayedSession: Record<string, number> = {};
  const lastMechanicByTopic: PickerHistory['lastMechanicByTopic'] = {};
  const attemptsByGoal: Record<string, Attempt[]> = {};
  for (const a of attempts) {
    lastPlayedSession[a.templateId] = Math.max(lastPlayedSession[a.templateId] ?? 0, a.sessionIndex);
    lastMechanicByTopic[a.topicId] = a.mechanic;
    (attemptsByGoal[a.goalId] ??= []).push(a);
  }
  return {
    sessionIndex,
    lastPlayedSession,
    lastMechanicByTopic,
    attemptsByGoal,
    lastTopicId: attempts[attempts.length - 1]?.topicId ?? null,
    lastSuggestedSubject: null,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/progress/history.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/progress/history.ts src/engine/progress/history.test.ts
git commit -m "feat(progress): attempt records from rounds and history builders for generator and picker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Line segmentation and clip ids

**Files:**
- Create: `src/engine/audio/lines.ts`
- Test: `src/engine/audio/lines.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/audio/lines.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from '../content/readPackFromDisk';
import { segmentLine, clipIdFor, pluralClipId, allTextClips } from './lines';

describe('segmentLine', () => {
  it('splits text around slots and drops punctuation-only fragments', () => {
    expect(segmentLine('prompt.give_n', 1, 'Can you give Buddy {n} {targets}?')).toEqual([
      { kind: 'text', text: 'Can you give Buddy', clipId: 'prompt.give_n.v1.s0' },
      { kind: 'slot', name: 'n' },
      { kind: 'slot', name: 'targets' },
    ]);
  });

  it('numbers text segments independently of slots', () => {
    expect(segmentLine('x', 0, 'Which {target} is big? Tap it')).toEqual([
      { kind: 'text', text: 'Which', clipId: 'x.v0.s0' },
      { kind: 'slot', name: 'target' },
      { kind: 'text', text: 'is big? Tap it', clipId: 'x.v0.s1' },
    ]);
  });

  it('returns a single text segment for a plain line', () => {
    expect(segmentLine('fb.correct', 2, 'Well done!')).toEqual([{ kind: 'text', text: 'Well done!', clipId: 'fb.correct.v2.s0' }]);
  });
});

describe('ids', () => {
  it('are stable and readable', () => {
    expect(clipIdFor('obj.apple', 0, 0)).toBe('obj.apple.v0.s0');
    expect(pluralClipId('obj.mango')).toBe('obj.mango.plural');
  });
});

describe('allTextClips', () => {
  it('lists every text segment of every variant plus plural clips for countable or irregular objects', () => {
    const pack = readPack();
    const clips = allTextClips(pack);
    const ids = new Set(clips.map((c) => c.clipId));
    expect(ids.has('prompt.tap_big.v0.s0')).toBe(true);
    expect(ids.has('obj.apple.v0.s0')).toBe(true);
    expect(ids.has('obj.mango.plural')).toBe(true);
    expect(clips.find((c) => c.clipId === 'obj.mango.plural')?.text).toBe('mangoes');
    expect(ids.has('obj.soap.plural')).toBe(false); // not countable, no irregular plural
    expect(ids.size).toBe(clips.length);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/audio/lines.test.ts`
Expected: FAIL — `Cannot find module './lines'`.

- [ ] **Step 3: Implement `src/engine/audio/lines.ts`**

```ts
// src/engine/audio/lines.ts
import type { ContentPack } from '../content/load';
import { pluralOf } from '../generator/items';

export type Segment = { kind: 'text'; text: string; clipId: string } | { kind: 'slot'; name: string };

export function clipIdFor(lineId: string, variant: number, segmentIndex: number): string {
  return `${lineId}.v${variant}.s${segmentIndex}`;
}

export function pluralClipId(lineId: string): string {
  return `${lineId}.plural`;
}

const HAS_WORDS = /[\p{L}\p{N}]/u;

/** Split a line variant into spoken text segments (each gets a clip id) and slots (filled at play time). */
export function segmentLine(lineId: string, variant: number, text: string): Segment[] {
  const out: Segment[] = [];
  let textIndex = 0;
  let cursor = 0;
  const pushText = (raw: string) => {
    const trimmed = raw.trim();
    if (!HAS_WORDS.test(trimmed)) return;
    out.push({ kind: 'text', text: trimmed, clipId: clipIdFor(lineId, variant, textIndex++) });
  };
  for (const match of text.matchAll(/\{(\w+)\}/g)) {
    pushText(text.slice(cursor, match.index));
    out.push({ kind: 'slot', name: match[1] as string });
    cursor = (match.index ?? 0) + match[0].length;
  }
  pushText(text.slice(cursor));
  return out;
}

export interface TextClip {
  clipId: string;
  text: string;
  lineId: string;
}

/** Every clip the voice generator must produce for a pack. */
export function allTextClips(pack: ContentPack): TextClip[] {
  const clips: TextClip[] = [];
  for (const line of pack.lines.values()) {
    line.variants.forEach((variant, v) => {
      for (const seg of segmentLine(line.id, v, variant)) {
        if (seg.kind === 'text') clips.push({ clipId: seg.clipId, text: seg.text, lineId: line.id });
      }
    });
  }
  for (const o of pack.objects.values()) {
    if (o.plural || o.tags.countable) clips.push({ clipId: pluralClipId(o.lineId), text: pluralOf(o), lineId: o.lineId });
  }
  return clips;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/audio/lines.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/audio/lines.ts src/engine/audio/lines.test.ts
git commit -m "feat(audio): line segmentation and clip ids

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: AudioManager — Heart → clip → TTS

**Files:**
- Create: `src/engine/audio/manager.ts`, `src/engine/audio/manifest.ts`
- Test: `src/engine/audio/manager.test.ts`

- [ ] **Step 1: Write the failing tests (with fakes for every dependency)**

```ts
// src/engine/audio/manager.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from '../content/readPackFromDisk';
import { AudioManager, type ClipPlayer, type ClipSource, type HeartSource, type TtsEngine } from './manager';

const pack = readPack();

class FakeClips implements ClipSource {
  constructor(private ids: Set<string>) {}
  has(id: string) { return this.ids.has(id); }
  urlFor(id: string) { return `/audio/lines/${id}.mp3`; }
}
class FakePlayer implements ClipPlayer {
  played: string[] = [];
  stopped = 0;
  async play(url: string) { this.played.push(url); }
  stop() { this.stopped++; }
}
class FakeTts implements TtsEngine {
  spoken: string[] = [];
  cancelled = 0;
  constructor(private ok = true) {}
  available() { return this.ok; }
  async speak(text: string) { this.spoken.push(text); }
  cancel() { this.cancelled++; }
}
class FakeHeart implements HeartSource {
  constructor(private ids: Set<string>) {}
  async has(id: string) { return this.ids.has(id); }
  urlFor(id: string) { return `heart://${id}`; }
}

const everyClip = new FakeClips(new Set(['prompt.tap_big.v0.s0', 'obj.elephant.v0.s0', 'glyph.num.3.v0.s0', 'obj.mango.plural', 'fb.correct.v1.s0', 'prompt.give_n.v1.s0']));

describe('AudioManager.speak', () => {
  it('plays text segments and object slots as clips, in order', async () => {
    const player = new FakePlayer();
    const tts = new FakeTts();
    const am = new AudioManager({ pack, clips: everyClip, player, tts });
    const parts = await am.speak({ lineId: 'prompt.tap_big', variant: 0, slots: { target: 'elephant' } });
    expect(parts).toEqual([{ source: 'clip', text: 'Tap the BIG' }, { source: 'clip', text: 'elephant' }]);
    expect(player.played).toEqual(['/audio/lines/prompt.tap_big.v0.s0.mp3', '/audio/lines/obj.elephant.v0.s0.mp3']);
    expect(tts.spoken).toEqual([]);
  });

  it('falls back to TTS only for the segment whose clip is missing', async () => {
    const player = new FakePlayer();
    const tts = new FakeTts();
    const am = new AudioManager({ pack, clips: new FakeClips(new Set(['prompt.tap_big.v0.s0'])), player, tts });
    const parts = await am.speak({ lineId: 'prompt.tap_big', variant: 0, slots: { target: 'elephant' } });
    expect(parts.map((p) => p.source)).toEqual(['clip', 'tts']);
    expect(tts.spoken).toEqual(['elephant']);
  });

  it('prefers a Heart recording over the AI clip', async () => {
    const player = new FakePlayer();
    const am = new AudioManager({ pack, clips: everyClip, player, tts: new FakeTts(), heart: new FakeHeart(new Set(['fb.correct.v1.s0'])) });
    const parts = await am.speak({ lineId: 'fb.correct', variant: 1 });
    expect(parts).toEqual([{ source: 'heart', text: 'Well done!' }]);
    expect(player.played).toEqual(['heart://fb.correct.v1.s0']);
  });

  it('speaks numbers through their glyph clip and plurals through the plural clip', async () => {
    const player = new FakePlayer();
    const am = new AudioManager({ pack, clips: everyClip, player, tts: new FakeTts() });
    const parts = await am.speak({ lineId: 'prompt.give_n', variant: 1, slots: { n: '3', targets: 'mango' } });
    expect(parts).toEqual([
      { source: 'clip', text: 'Can you give Buddy' },
      { source: 'clip', text: 'three' },
      { source: 'clip', text: 'mangoes' },
    ]);
  });

  it("speaks the child's name with TTS", async () => {
    const tts = new FakeTts();
    const am = new AudioManager({ pack, clips: everyClip, player: new FakePlayer(), tts });
    const parts = await am.speak({ lineId: 'buddy.greet_morning', variant: 0, slots: { name: 'Anika' } });
    expect(parts.map((p) => p.source)).toEqual(['tts', 'tts']);
    expect(tts.spoken).toEqual(['Good morning,', 'Anika']);
  });

  it('is silent (but still returns parts) when no clip exists and TTS is unavailable', async () => {
    const am = new AudioManager({ pack, clips: new FakeClips(new Set()), player: new FakePlayer(), tts: new FakeTts(false) });
    const parts = await am.speak({ lineId: 'fb.shown', variant: 0 });
    expect(parts).toEqual([{ source: 'silent', text: "It's this one!" }]);
  });

  it('throws for an unknown line', async () => {
    const am = new AudioManager({ pack, clips: everyClip, player: new FakePlayer(), tts: new FakeTts() });
    await expect(am.speak({ lineId: 'nope' })).rejects.toThrow('unknown line nope');
  });
});

describe('replay and stop', () => {
  it('replay speaks the last request again; stop cancels the player and TTS', async () => {
    const player = new FakePlayer();
    const tts = new FakeTts();
    const am = new AudioManager({ pack, clips: everyClip, player, tts });
    expect(await am.replay()).toEqual([]);
    await am.speak({ lineId: 'fb.correct', variant: 1 });
    await am.replay();
    expect(player.played).toEqual(['/audio/lines/fb.correct.v1.s0.mp3', '/audio/lines/fb.correct.v1.s0.mp3']);
    am.stop();
    expect(player.stopped).toBeGreaterThan(0);
    expect(tts.cancelled).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/audio/manager.test.ts`
Expected: FAIL — `Cannot find module './manager'`.

- [ ] **Step 3: Implement `src/engine/audio/manifest.ts`**

```ts
// src/engine/audio/manifest.ts
import type { ClipSource } from './manager';

export interface ClipManifest {
  version: 1;
  voice: string;
  clips: Record<string, { text: string; hash: string; file: string }>;
}

export const EMPTY_MANIFEST: ClipManifest = { version: 1, voice: '', clips: {} };

/** Clips generated by scripts/gen-voice.ts and listed in public/audio/manifest.json. */
export class ManifestClipSource implements ClipSource {
  constructor(private readonly manifest: ClipManifest, private readonly baseUrl: string) {}
  has(clipId: string): boolean {
    return clipId in this.manifest.clips;
  }
  urlFor(clipId: string): string {
    const entry = this.manifest.clips[clipId];
    if (!entry) throw new Error(`no clip ${clipId}`);
    return `${this.baseUrl}/${entry.file}`;
  }
}
```

- [ ] **Step 4: Implement `src/engine/audio/manager.ts`**

```ts
// src/engine/audio/manager.ts
import type { ContentPack } from '../content/load';
import { pluralOf } from '../generator/items';
import { clipIdFor, pluralClipId, segmentLine } from './lines';

export interface ClipSource {
  has(clipId: string): boolean;
  urlFor(clipId: string): string;
}
export interface ClipPlayer {
  play(url: string): Promise<void>;
  stop(): void;
}
export interface TtsEngine {
  available(): boolean;
  speak(text: string): Promise<void>;
  cancel(): void;
}
/** Parent recordings (spec §7 "Heart"); arrives in Plan 4, the chain is ready for it now. */
export interface HeartSource {
  has(clipId: string): Promise<boolean>;
  urlFor(clipId: string): string;
}

export interface SpeakRequest {
  lineId: string;
  variant?: number;
  /** slot name → object/glyph id, a number as text, or a literal such as the child's name */
  slots?: Record<string, string>;
}

export interface SpokenPart {
  source: 'heart' | 'clip' | 'tts' | 'silent';
  text: string;
}

export interface AudioDeps {
  pack: ContentPack;
  clips: ClipSource;
  player: ClipPlayer;
  tts: TtsEngine;
  heart?: HeartSource;
}

/** Resolves every spoken line through Heart → AI clip → device TTS (spec §7). */
export class AudioManager {
  private last: SpeakRequest | null = null;
  private token = 0;

  constructor(private readonly deps: AudioDeps) {}

  async speak(req: SpeakRequest): Promise<SpokenPart[]> {
    this.stop();
    const myToken = this.token;
    this.last = req;
    const line = this.deps.pack.lines.get(req.lineId);
    if (!line) throw new Error(`unknown line ${req.lineId}`);
    const variant = Math.min(req.variant ?? 0, line.variants.length - 1);
    const parts: SpokenPart[] = [];
    for (const seg of segmentLine(req.lineId, variant, line.variants[variant] as string)) {
      if (this.token !== myToken) break; // interrupted by a newer speak() or stop()
      if (seg.kind === 'text') {
        parts.push(await this.clipOrTts(seg.clipId, seg.text));
      } else {
        const value = req.slots?.[seg.name];
        if (value !== undefined) parts.push(await this.speakSlot(seg.name, value));
      }
    }
    return parts;
  }

  /** Speak the most recent request again (the 🔊 button and the 8-second auto-repeat). */
  async replay(): Promise<SpokenPart[]> {
    return this.last ? this.speak(this.last) : [];
  }

  stop(): void {
    this.token += 1;
    this.deps.player.stop();
    this.deps.tts.cancel();
  }

  private async speakSlot(name: string, value: string): Promise<SpokenPart> {
    const { pack } = this.deps;
    const object = pack.objects.get(value);
    if (object) {
      if (name === 'targets') return this.clipOrTts(pluralClipId(object.lineId), pluralOf(object));
      return this.clipOrTts(clipIdFor(object.lineId, 0, 0), pack.lines.get(object.lineId)?.variants[0] ?? object.name);
    }
    const glyph =
      pack.glyphs.get(value) ??
      (/^\d+$/.test(value) ? [...pack.glyphs.values()].find((g) => g.kind === 'number' && g.value === Number(value)) : undefined);
    if (glyph) return this.clipOrTts(clipIdFor(glyph.lineId, 0, 0), pack.lines.get(glyph.lineId)?.variants[0] ?? glyph.char);
    return this.tts(value);
  }

  private async clipOrTts(clipId: string, text: string): Promise<SpokenPart> {
    const { heart, clips, player } = this.deps;
    if (heart && (await heart.has(clipId))) {
      await player.play(heart.urlFor(clipId));
      return { source: 'heart', text };
    }
    if (clips.has(clipId)) {
      await player.play(clips.urlFor(clipId));
      return { source: 'clip', text };
    }
    return this.tts(text);
  }

  private async tts(text: string): Promise<SpokenPart> {
    if (!this.deps.tts.available()) return { source: 'silent', text };
    await this.deps.tts.speak(text);
    return { source: 'tts', text };
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/engine/audio/manager.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/audio/manager.ts src/engine/audio/manifest.ts src/engine/audio/manager.test.ts
git commit -m "feat(audio): AudioManager with Heart → clip → TTS resolution, replay and stop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Device TTS and Howler player adapters

**Files:**
- Create: `src/engine/audio/tts.ts`, `src/engine/audio/howlerPlayer.ts`
- Test: `src/engine/audio/tts.test.ts`, `src/engine/audio/howlerPlayer.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/audio/tts.test.ts
import { describe, it, expect } from 'vitest';
import { pickVoice, WebSpeechTts, type SynthLike, type UtteranceLike, type VoiceLike } from './tts';

const voices: VoiceLike[] = [{ lang: 'en-US', name: 'Samantha' }, { lang: 'en-GB', name: 'Daniel' }, { lang: 'en_IN', name: 'Rishi' }];

describe('pickVoice', () => {
  it('prefers en-IN, then en-GB, then en-US (tolerating underscores)', () => {
    expect(pickVoice(voices, ['en-IN', 'en-GB', 'en-US'])?.name).toBe('Rishi');
    expect(pickVoice(voices.slice(0, 2), ['en-IN', 'en-GB', 'en-US'])?.name).toBe('Daniel');
    expect(pickVoice([], ['en-IN'])).toBeNull();
  });
});

class FakeSynth implements SynthLike {
  spoken: UtteranceLike[] = [];
  cancelled = 0;
  constructor(private voices: VoiceLike[]) {}
  getVoices() { return this.voices; }
  speak(u: UtteranceLike) { this.spoken.push(u); setTimeout(() => u.onend?.(), 0); }
  cancel() { this.cancelled++; }
}
const makeUtterance = (text: string): UtteranceLike => ({ text, rate: 1, voice: null, onend: null, onerror: null });

describe('WebSpeechTts', () => {
  it('speaks slowly with the preferred voice and resolves when the utterance ends', async () => {
    const synth = new FakeSynth(voices);
    const tts = new WebSpeechTts(synth, makeUtterance);
    expect(tts.available()).toBe(true);
    await tts.speak('Hello');
    expect(synth.spoken[0]).toMatchObject({ text: 'Hello', rate: 0.9, voice: { name: 'Rishi' } });
    tts.cancel();
    expect(synth.cancelled).toBe(1);
  });

  it('is unavailable without a synthesiser and resolves speak() immediately', async () => {
    const tts = new WebSpeechTts(null, null);
    expect(tts.available()).toBe(false);
    await expect(tts.speak('x')).resolves.toBeUndefined();
  });
});
```

```ts
// src/engine/audio/howlerPlayer.test.ts
import { describe, it, expect } from 'vitest';
import { HowlerClipPlayer, type HowlLike, type HowlOptions } from './howlerPlayer';

class FakeHowl implements HowlLike {
  static instances: FakeHowl[] = [];
  playing = false;
  unloaded = false;
  constructor(public opts: HowlOptions) { FakeHowl.instances.push(this); }
  play() { this.playing = true; }
  stop() { this.playing = false; this.opts.onstop?.(); }
  unload() { this.unloaded = true; }
}

describe('HowlerClipPlayer', () => {
  it('plays a url with html5 audio and resolves on end', async () => {
    FakeHowl.instances = [];
    const player = new HowlerClipPlayer(FakeHowl);
    const done = player.play('/a.mp3');
    const howl = FakeHowl.instances[0]!;
    expect(howl.opts.src).toEqual(['/a.mp3']);
    expect(howl.opts.html5).toBe(true);
    expect(howl.playing).toBe(true);
    howl.opts.onend?.();
    await expect(done).resolves.toBeUndefined();
  });

  it('stop() stops and unloads the current sound and resolves its promise', async () => {
    FakeHowl.instances = [];
    const player = new HowlerClipPlayer(FakeHowl);
    const done = player.play('/b.mp3');
    player.stop();
    expect(FakeHowl.instances[0]!.unloaded).toBe(true);
    await expect(done).resolves.toBeUndefined();
  });

  it('rejects when the clip cannot load', async () => {
    FakeHowl.instances = [];
    const player = new HowlerClipPlayer(FakeHowl);
    const done = player.play('/c.mp3');
    FakeHowl.instances[0]!.opts.onloaderror?.(1, 'boom');
    await expect(done).rejects.toThrow('Could not load /c.mp3: boom');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/audio/tts.test.ts src/engine/audio/howlerPlayer.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/engine/audio/tts.ts`**

```ts
// src/engine/audio/tts.ts
import type { TtsEngine } from './manager';

export interface VoiceLike {
  lang: string;
  name: string;
}
export interface UtteranceLike {
  text: string;
  rate: number;
  voice: VoiceLike | null;
  onend: ((event?: unknown) => void) | null;
  onerror: ((event?: unknown) => void) | null;
}
export interface SynthLike {
  getVoices(): VoiceLike[];
  speak(utterance: UtteranceLike): void;
  cancel(): void;
}

/** First voice whose language matches a preferred prefix, in preference order. */
export function pickVoice(voices: readonly VoiceLike[], preferred: readonly string[]): VoiceLike | null {
  for (const lang of preferred) {
    const want = lang.toLowerCase();
    const voice = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(want));
    if (voice) return voice;
  }
  return null;
}

/** Device text-to-speech — the last layer of the chain (spec §7). */
export class WebSpeechTts implements TtsEngine {
  constructor(
    private readonly synth: SynthLike | null,
    private readonly makeUtterance: ((text: string) => UtteranceLike) | null,
    private readonly preferred: readonly string[] = ['en-IN', 'en-GB', 'en-US'],
    private readonly rate = 0.9,
  ) {}

  available(): boolean {
    return this.synth !== null && this.makeUtterance !== null;
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth || !this.makeUtterance) return resolve();
      const utterance = this.makeUtterance(text);
      utterance.rate = this.rate;
      utterance.voice = pickVoice(this.synth.getVoices(), this.preferred);
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      this.synth.speak(utterance);
    });
  }

  cancel(): void {
    this.synth?.cancel();
  }
}

/** Wire the browser's speech synthesis, or an unavailable engine outside a browser. */
export function createWebSpeechTts(): WebSpeechTts {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return new WebSpeechTts(null, null);
  return new WebSpeechTts(
    window.speechSynthesis as unknown as SynthLike,
    (text) => new SpeechSynthesisUtterance(text) as unknown as UtteranceLike,
  );
}
```

- [ ] **Step 4: Implement `src/engine/audio/howlerPlayer.ts`**

```ts
// src/engine/audio/howlerPlayer.ts
import type { ClipPlayer } from './manager';

export interface HowlOptions {
  src: string[];
  html5?: boolean;
  onend?: () => void;
  onstop?: () => void;
  onloaderror?: (id: number, error: unknown) => void;
  onplayerror?: (id: number, error: unknown) => void;
}
export interface HowlLike {
  play(): unknown;
  stop(): unknown;
  unload(): unknown;
}
export type HowlCtor = new (options: HowlOptions) => HowlLike;

/**
 * Plays one clip at a time through Howler (Plan 1B passes the real `Howl` class).
 * html5: true streams from the network and keeps iOS Safari happy with many small files.
 */
export class HowlerClipPlayer implements ClipPlayer {
  private current: HowlLike | null = null;

  constructor(private readonly Howl: HowlCtor) {}

  play(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stop();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        reject(new Error(message));
      };
      const howl = new this.Howl({
        src: [url],
        html5: true,
        onend: finish,
        onstop: finish,
        onloaderror: (_id, error) => fail(`Could not load ${url}: ${String(error)}`),
        onplayerror: (_id, error) => fail(`Could not play ${url}: ${String(error)}`),
      });
      this.current = howl;
      howl.play();
    });
  }

  stop(): void {
    const current = this.current;
    this.current = null;
    if (current) {
      current.stop();
      current.unload();
    }
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/engine/audio/tts.test.ts src/engine/audio/howlerPlayer.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/audio/tts.ts src/engine/audio/howlerPlayer.ts src/engine/audio/tts.test.ts src/engine/audio/howlerPlayer.test.ts
git commit -m "feat(audio): web speech TTS and Howler clip player adapters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Time of day

**Files:**
- Create: `src/engine/time.ts`
- Test: `src/engine/time.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/time.test.ts
import { describe, it, expect } from 'vitest';
import { blockFor, greetingLineFor } from './time';

const at = (h: number, m = 0) => new Date(2026, 9, 1, h, m);

describe('blockFor', () => {
  it('maps hours to morning / afternoon / evening per spec §4.1', () => {
    expect(blockFor(at(5))).toBe('morning');
    expect(blockFor(at(11, 59))).toBe('morning');
    expect(blockFor(at(12))).toBe('afternoon');
    expect(blockFor(at(16, 59))).toBe('afternoon');
    expect(blockFor(at(17))).toBe('evening');
    expect(blockFor(at(23))).toBe('evening');
    expect(blockFor(at(4, 59))).toBe('evening');
  });
});

describe('greetingLineFor', () => {
  it('names the greeting line for a block', () => {
    expect(greetingLineFor('morning')).toBe('buddy.greet_morning');
    expect(greetingLineFor('evening')).toBe('buddy.greet_evening');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/time.test.ts`
Expected: FAIL — `Cannot find module './time'`.

- [ ] **Step 3: Implement `src/engine/time.ts`**

```ts
// src/engine/time.ts
export type DayBlock = 'morning' | 'afternoon' | 'evening';

/** Spec §4.1: morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–04:59. */
export function blockFor(date: Date): DayBlock {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  return 'evening';
}

export function greetingLineFor(block: DayBlock): string {
  return `buddy.greet_${block}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/time.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/time.ts src/engine/time.test.ts
git commit -m "feat(engine): time-of-day blocks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: Voice generation — planning and the Azure adapter

**Files:**
- Create: `scripts/voice/plan.ts`, `scripts/voice/azure.ts`
- Test: `scripts/voice/plan.test.ts`, `scripts/voice/azure.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// scripts/voice/plan.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from '../../src/engine/content/readPackFromDisk';
import { EMPTY_MANIFEST, type ClipManifest } from '../../src/engine/audio/manifest';
import { clipHash, planClips } from './plan';

const pack = readPack();
const VOICE = 'en-IN-NeerjaNeural';

describe('clipHash', () => {
  it('changes with text and with voice', () => {
    expect(clipHash(VOICE, 'apple')).toBe(clipHash(VOICE, 'apple'));
    expect(clipHash(VOICE, 'apple')).not.toBe(clipHash(VOICE, 'apples'));
    expect(clipHash(VOICE, 'apple')).not.toBe(clipHash('en-GB-SoniaNeural', 'apple'));
  });
});

describe('planClips', () => {
  it('needs everything for an empty manifest and nothing is orphaned', () => {
    const plan = planClips(pack, EMPTY_MANIFEST, VOICE);
    expect(plan.needed.length).toBeGreaterThan(200);
    expect(plan.unchanged).toEqual([]);
    expect(plan.orphans).toEqual([]);
    expect(plan.needed.find((c) => c.clipId === 'obj.apple.v0.s0')).toMatchObject({ text: 'apple', file: 'obj.apple.v0.s0.mp3' });
  });

  it('skips unchanged clips, regenerates changed text and reports orphans', () => {
    const manifest: ClipManifest = {
      version: 1,
      voice: VOICE,
      clips: {
        'obj.apple.v0.s0': { text: 'apple', hash: clipHash(VOICE, 'apple'), file: 'obj.apple.v0.s0.mp3' },
        'obj.banana.v0.s0': { text: 'bananas', hash: clipHash(VOICE, 'bananas'), file: 'obj.banana.v0.s0.mp3' },
        'old.line.v0.s0': { text: 'gone', hash: 'x', file: 'old.line.v0.s0.mp3' },
      },
    };
    const plan = planClips(pack, manifest, VOICE);
    expect(plan.unchanged.map((c) => c.clipId)).toEqual(['obj.apple.v0.s0']);
    expect(plan.needed.some((c) => c.clipId === 'obj.banana.v0.s0')).toBe(true);
    expect(plan.orphans).toEqual(['old.line.v0.s0']);
  });
});
```

```ts
// scripts/voice/azure.test.ts
import { describe, it, expect } from 'vitest';
import { buildSsml, synthesize } from './azure';

describe('buildSsml', () => {
  it('wraps escaped text in the voice and prosody tags', () => {
    const ssml = buildSsml("Tom & Jerry's <big> day", 'en-IN-NeerjaNeural', '-10%');
    expect(ssml).toContain('<voice name="en-IN-NeerjaNeural">');
    expect(ssml).toContain('<prosody rate="-10%">Tom &amp; Jerry&apos;s &lt;big&gt; day</prosody>');
    expect(ssml.startsWith('<speak')).toBe(true);
  });
});

describe('synthesize', () => {
  const cfg = { key: 'k', region: 'centralindia', voice: 'en-IN-NeerjaNeural', rate: '-10%' };

  it('posts SSML to the regional endpoint with the right headers and returns bytes', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    };
    const bytes = await synthesize('hello', cfg, fakeFetch);
    expect([...bytes]).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://centralindia.tts.speech.microsoft.com/cognitiveservices/v1');
    const headers = call.init.headers as Record<string, string>;
    expect(headers['Ocp-Apim-Subscription-Key']).toBe('k');
    expect(headers['X-Microsoft-OutputFormat']).toBe('audio-24khz-48kbitrate-mono-mp3');
    expect(headers['Content-Type']).toBe('application/ssml+xml');
    expect(String(call.init.body)).toContain('hello');
  });

  it('throws with the status and body on failure', async () => {
    const fakeFetch: typeof fetch = async () => new Response('bad key', { status: 401 });
    await expect(synthesize('x', cfg, fakeFetch)).rejects.toThrow('Azure TTS 401: bad key');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/voice`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `scripts/voice/plan.ts`**

```ts
// scripts/voice/plan.ts
import { createHash } from 'node:crypto';
import type { ContentPack } from '../../src/engine/content/load';
import { allTextClips } from '../../src/engine/audio/lines';
import type { ClipManifest } from '../../src/engine/audio/manifest';

export function clipHash(voice: string, text: string): string {
  return createHash('sha256').update(`${voice}|${text}`).digest('hex').slice(0, 16);
}

export interface PlannedClip {
  clipId: string;
  text: string;
  hash: string;
  file: string;
}

export interface ClipPlan {
  needed: PlannedClip[];
  unchanged: PlannedClip[];
  /** manifest entries no line needs any more */
  orphans: string[];
}

/** Compare what the pack needs with what the manifest already has. Pure; no network. */
export function planClips(pack: ContentPack, manifest: ClipManifest, voice: string): ClipPlan {
  const wanted = allTextClips(pack).map((c): PlannedClip => ({ clipId: c.clipId, text: c.text, hash: clipHash(voice, c.text), file: `${c.clipId}.mp3` }));
  const needed: PlannedClip[] = [];
  const unchanged: PlannedClip[] = [];
  for (const clip of wanted) {
    const existing = manifest.clips[clip.clipId];
    if (existing && existing.hash === clip.hash) unchanged.push(clip);
    else needed.push(clip);
  }
  const wantedIds = new Set(wanted.map((c) => c.clipId));
  const orphans = Object.keys(manifest.clips).filter((id) => !wantedIds.has(id));
  return { needed, unchanged, orphans };
}
```

- [ ] **Step 4: Implement `scripts/voice/azure.ts`**

```ts
// scripts/voice/azure.ts
export interface AzureConfig {
  key: string;
  region: string;
  voice: string;
  /** SSML prosody rate, e.g. "-10%" — slightly slower than default for a 4-year-old */
  rate: string;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function buildSsml(text: string, voice: string, rate: string): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-IN">` +
    `<voice name="${voice}"><prosody rate="${rate}">${escapeXml(text)}</prosody></voice></speak>`
  );
}

/** One call to the Azure Speech REST API; returns MP3 bytes. */
export async function synthesize(text: string, cfg: AzureConfig, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  const response = await fetchImpl(`https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': cfg.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'buddy-voice',
    },
    body: buildSsml(text, cfg.voice, cfg.rate),
  });
  if (!response.ok) throw new Error(`Azure TTS ${response.status}: ${await response.text()}`);
  return new Uint8Array(await response.arrayBuffer());
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run scripts/voice`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/voice/plan.ts scripts/voice/azure.ts scripts/voice/plan.test.ts scripts/voice/azure.test.ts
git commit -m "feat(voice): clip planning against the manifest and the Azure TTS adapter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 22: The gen-voice CLI and the initial manifest

**Files:**
- Create: `scripts/gen-voice.ts`, `public/audio/manifest.json`

- [ ] **Step 1: Write the script**

```ts
// scripts/gen-voice.ts
// Usage: npm run voice [-- --dry-run] [-- --prune]
// Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (in .env or the environment).
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPack } from '../src/engine/content/readPackFromDisk';
import { EMPTY_MANIFEST, type ClipManifest } from '../src/engine/audio/manifest';
import { planClips } from './voice/plan';
import { synthesize } from './voice/azure';

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
const manifest: ClipManifest = existsSync(MANIFEST_PATH) ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ClipManifest) : { ...EMPTY_MANIFEST, voice: VOICE };
if (manifest.voice && manifest.voice !== VOICE) console.log(`Voice changed ${manifest.voice} → ${VOICE}: every clip will be regenerated.`);
manifest.voice = VOICE;

const plan = planClips(pack, manifest, VOICE);
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
  const bytes = await synthesize(clip.text, { key, region, voice: VOICE, rate: RATE });
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
```

- [ ] **Step 2: Create the initial (empty) manifest so the app can load before any clip exists**

`public/audio/manifest.json`:

```json
{
  "version": 1,
  "voice": "en-IN-NeerjaNeural",
  "clips": {}
}
```

- [ ] **Step 3: Dry-run it**

Run: `npm run voice -- --dry-run`
Expected: `0 clips up to date · N to generate · 0 orphaned` with N > 200, followed by one `+` line per clip, exit 0. (The real run happens in Plan 1B once the Azure key is in `.env`; the clips and the manifest are then committed — they are small and the build needs them.)

- [ ] **Step 4: Commit**

```bash
git add scripts/gen-voice.ts public/audio/manifest.json
git commit -m "feat(voice): gen-voice CLI (Azure, resume-safe, dry-run, prune) and empty manifest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 23: Wrap-up — README, full check, hand-off notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the engine section to `README.md`**

Append:

```markdown
## Engine (Plan 1A)

Framework-free TypeScript under `src/engine/`; content as JSON under `content/`.

| Command | What it does |
|---|---|
| `npm test` | all engine tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run validate` | cross-reference and rule checks on the content pack (`--strict` fails on warnings) |
| `npm run inspect -- <templateId> [--seed N] [--level 1\|2\|3]` | print a generated set |
| `npm run voice -- [--dry-run] [--prune]` | generate voice clips with Azure Speech (needs `.env`) |
| `npm run check` | typecheck + tests + validate |

Content lives in `content/*.json` and `content/templates/*.json`; adding a game is adding a template and, if needed, pool items and lines. Run `npm run validate` after every content change.
```

- [ ] **Step 2: Run the full check**

Run: `npm run check`
Expected: typecheck clean; all test files pass (rng, schema, load, validate, pack, items, sampling, slots, rules, round, mastery, difficulty, bridging, picker, db, history, lines, manager, tts, howlerPlayer, time, voice/plan, voice/azure); validate ends with `0 errors · 8 warnings`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: engine commands in README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Hand-off — what Plan 1B builds on**

Plan 1B (M1 playable) consumes these interfaces unchanged:

- `readPack` is Node-only; 1B adds a Vite JSON loader that produces the same `RawPack` shape and calls `loadPack`.
- `generateSet(pack, template, { seed, level, history })` → `Round[]`; mechanics render `round.payload` by `kind` and record results with `attemptFromRound`.
- `pickTemplate` / `suggestTopic` with `buildPickerHistory`; `levelFor(setResultsForTemplate(...))` chooses the level; `buildGeneratorHistory` feeds the generator.
- `AudioManager` with `ManifestClipSource(manifest, '/audio/lines')`, `new HowlerClipPlayer(Howl)` and `createWebSpeechTts()`; the 🔊 button calls `replay()`.
- `BuddyDB` tables for routine events, check-ins, stickers, unlocks, writing samples and paper results are already declared; 1B adds their repository functions as it needs them.
- `blockFor(new Date())` selects the Home routine set and the greeting line.

---

## Spec coverage check (run after writing)

| Spec section | Where it lands |
|---|---|
| §5.1–5.3 hierarchy, pools, template fields | Tasks 3, 4, 7 |
| §5.4 variation rules 1–4 (recent repeats, slots, wording, scene) | Tasks 8, 10 |
| §5.4 rules 5–6 (mechanic rotation, interleaving) and 7 (difficulty ramp) | Tasks 14, 13 |
| §5.5 mastery by form and bridging | Tasks 12, 13, 14 |
| §5.6 levels field | Task 3 (`level`) |
| §5.7 catalogue — M1 subset (15 templates) | Task 7 |
| §6 mechanics — payload contracts for the 8 M1 mechanics | Tasks 5, 9 |
| §7 audio chain, line ids, name splicing, replay, TTS | Tasks 17–19 |
| §10 entities and storage | Tasks 12, 15 |
| §13 engine units and error handling (`ContentError`, `GenerationError`, graceful audio fallback) | Tasks 4, 9, 18 |
| §14 engine tests (property tests on seeded rounds, content validation, audio chain) | Tasks 6–10, 18 |
| §15 M1 engine half; voice generation | Tasks 21–22 |

Not in this plan by design: everything visual (screens, Buddy rig, mechanic components, Home scenes, celebrations, timer UI, parent corner views, PWA shell, deploy) — Plan 1B.

---

## Execution notes (deviations from the task text, recorded as tasks complete)

The task text above is kept as written; where execution differed, the change is listed here and the code on branch `plan-1a-engine` is authoritative.

**Before execution**
- Pool candidates carry a top-level `id` (`objectCandidate` / `glyphCandidate`) so recent-repeat avoidance works; distractors never share the answer's spoken line (`B` vs `b`).
- `counting.give` level 3 uses 8 options (the schema caps options at 8); `recordAttempt` / `recordSetResult` return Dexie's `Promise<number | undefined>`.

**Task 1 — scaffold**
- `validate`, `inspect`, `voice` run as `node --import tsx scripts/<file>.ts`: the tsx CLI opens a Unix socket the sandbox forbids; the loader does not.
- `tsconfig.json` adds `"isolatedModules": true` (tsx/Vitest/Vite compile per file; `tsc` must catch what they can't).
- `.gitignore` ignores `.env`, `.env.*`, keeps `!.env.example`; `.env.example` lists the optional `AZURE_SPEECH_VOICE` / `AZURE_SPEECH_RATE`.
- `package.json`: `license: UNLICENSED`, `engines.node` = Vitest 5's range, plain description; `main`, `directories`, empty `keywords` / `author` removed.

**Task 2 — rng**
- `randInt` removed (no planned caller). Tests pin the generator's output stream (`mulberry32`, FNV-1a vectors, `deriveSeed`, `shuffle`) so stored seeds keep replaying the same rounds; doc comments record seed coercion and how many draws `pick` / `shuffle` consume.

**Task 3 — schemas**
- Every content object is `z.strictObject`, so a misspelled optional key is an error instead of being dropped. `range` is refined to `low <= high`; number glyphs need `value` and letters need `case`; scenario choices are capped at 3 (spec §6); `LevelId` is exported; query `category` / `ids` must be non-empty; optional strings have `.min(1)`; line ids match `^[a-z0-9][a-z0-9._-]*$` (they become clip file names); `TAG_KEYS` is renamed `TagKeySchema`. 16 tests instead of 9.

**Plan text changed for later tasks** (already in the task text above — not deviations)
- Task 6: `RULES_FOR_MECHANIC` lists only the rule/mechanic pairs the generator builds a correct payload for; size-rule bins must match `large` and `small`; count rules need numeral glyphs for 0–10 and every value in each level's range; two more tests.
- Task 12: `Profile.level` is typed `LevelId`.
