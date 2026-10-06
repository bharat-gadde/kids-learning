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
export type LevelId = (typeof LEVELS)[number];

/** Line slots the UI fills from the profile — the child's name and the name the child gave Buddy — never the generator. */
export const UI_SLOTS: ReadonlySet<string> = new Set(['name', 'buddy']);

// Every content object is strict: content ships inside the app, so an unknown key is always a typo.
const id = z.string().min(1);
/** Line ids — and every reference to one — become clip file names and URL path segments (gen-voice, audio/manifest). */
const lineId = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, 'line ids use lowercase letters, digits, ".", "_" and "-"');
/** what is drawn: one character, or "10" */
const glyphChar = z.string().min(1).max(2);

export const ObjectTagsSchema = z.strictObject({
  sizePair: z.boolean().optional(),
  colour: z.string().min(1).optional(),
  countable: z.boolean().optional(),
  beginsWith: z.string().length(1).optional(),
  vowelSound: z.enum(['a', 'e', 'i', 'o', 'u']).optional(),
  rhymeGroup: z.string().min(1).optional(),
  cvc: z.boolean().optional(),
  habitat: z.string().min(1).optional(),
  season: z.string().min(1).optional(),
  transportMode: z.enum(['land', 'water', 'air']).optional(),
  sense: z.string().min(1).optional(),
  room: z.string().min(1).optional(),
  healthy: z.boolean().optional(),
  teethFriendly: z.boolean().optional(),
  neatAndClean: z.boolean().optional(),
  sound: z.string().min(1).optional(),
});
export type ObjectTags = z.infer<typeof ObjectTagsSchema>;
export const TagKeySchema = ObjectTagsSchema.keyof();

export const ObjectItemSchema = z.strictObject({
  id,
  name: z.string().min(1),
  plural: z.string().min(1).optional(),
  lineId,
  asset: z.string().min(1),
  category: z.string().min(1),
  tags: ObjectTagsSchema.default({}),
});
export type ObjectItem = z.infer<typeof ObjectItemSchema>;

export const GlyphSchema = z.strictObject({
  id,
  /** what is drawn: one character, or "10" */
  char: glyphChar,
  kind: z.enum(['letter', 'number']),
  case: z.enum(['upper', 'lower']).optional(),
  pairKey: z.string().min(1),
  value: z.number().int().min(0).optional(),
  lineId,
  confusables: z.array(glyphChar).default([]),
})
  .refine((g) => g.kind !== 'number' || g.value !== undefined, { path: ['value'], error: 'a number glyph needs a value' })
  .refine((g) => g.kind !== 'letter' || g.case !== undefined, { path: ['case'], error: 'a letter glyph needs a case' });
export type Glyph = z.infer<typeof GlyphSchema>;

export const SceneSchema = z.strictObject({ id, asset: z.string().min(1), theme: z.string().min(1) });
export type Scene = z.infer<typeof SceneSchema>;

export const LineSchema = z.strictObject({ id: lineId, variants: z.array(z.string().min(1)).min(1) });
export type Line = z.infer<typeof LineSchema>;

export const GoalSchema = z.strictObject({ id, title: z.string().min(1) });
export type Goal = z.infer<typeof GoalSchema>;

export const TopicSchema = z.strictObject({
  id,
  subject: z.enum(SUBJECTS),
  title: z.string().min(1),
  goals: z.array(GoalSchema).min(1),
  /** the topic's signpost on the Map: a picture path, or `glyph:<text>` drawn as letters */
  asset: z.string().min(1).optional(),
});
export type Topic = z.infer<typeof TopicSchema>;

export const ScenarioSchema = z.strictObject({
  id,
  topicId: id,
  narrationLineId: lineId,
  vignette: z.string().min(1),
  /** spec §6 #22: scene-then-choose offers two or three choices */
  choices: z.array(z.strictObject({ objectId: id, correct: z.boolean(), reactionLineId: lineId.optional() })).min(2).max(3),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const SequenceSchema = z.strictObject({
  id,
  topicId: id,
  promptLineId: lineId,
  steps: z.array(id).min(3).max(5),
});
export type Sequence = z.infer<typeof SequenceSchema>;

export const QuerySchema = z.strictObject({
  pool: z.enum(['objects', 'glyphs']),
  category: z.array(id).min(1).optional(),
  ids: z.array(id).min(1).optional(),
  // every tag is optional, so the tags schema doubles as the query's partial filter — never .refine() it, or the refinement would constrain queries too
  tags: ObjectTagsSchema.optional(),
  hasTags: z.array(TagKeySchema).optional(),
  glyph: z.strictObject({
    kind: z.enum(['letter', 'number']).optional(),
    case: z.enum(['upper', 'lower']).optional(),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
  }).optional(),
});
export type Query = z.infer<typeof QuerySchema>;

export const RuleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('named') }),
  z.strictObject({ kind: z.literal('size'), target: z.enum(['larger', 'smaller']) }),
  z.strictObject({ kind: z.literal('tag'), tag: TagKeySchema, value: z.union([z.string(), z.boolean()]) }),
  z.strictObject({ kind: z.literal('category'), values: z.array(z.string().min(1)).min(1).max(3) }),
  z.strictObject({ kind: z.literal('count') }),
  z.strictObject({ kind: z.literal('give-count') }),
  z.strictObject({ kind: z.literal('pair'), by: z.enum(['rhymeGroup', 'caseMate']) }),
  z.strictObject({ kind: z.literal('sequence') }),
  z.strictObject({ kind: z.literal('scenario') }),
]);
export type Rule = z.infer<typeof RuleSchema>;
export type RuleKind = Rule['kind'];

export const DifficultySchema = z.strictObject({
  /** number of options / items shown */
  options: z.number().int().min(2).max(8),
  /** for tap-all and bins: how many are correct (defaults handled by the generator) */
  correctCount: z.number().int().min(1).optional(),
  distractorSimilarity: z.enum(['low', 'medium', 'high']),
  /** numeric range for count rules */
  range: z.tuple([z.number().int().min(0), z.number().int().max(20)])
    .refine(([lo, hi]) => lo <= hi, 'range must be [low, high] with low <= high')
    .optional(),
});
export type Difficulty = z.infer<typeof DifficultySchema>;

export const BinSchema = z.strictObject({
  id,
  label: z.string().min(1),
  lineId,
  asset: z.string().min(1).optional(),
  /** the tag / category / size value this bin accepts */
  match: z.union([z.string().min(1), z.boolean()]).optional(),
});
export type Bin = z.infer<typeof BinSchema>;

export const TemplateSchema = z.strictObject({
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
  flavour: z.strictObject({
    scenes: z.array(id).min(1),
    promptLineId: lineId,
    music: z.string().min(1).optional(),
  }),
  bins: z.array(BinSchema).min(1).optional(),
  examFormat: z.string().min(1).optional(),
  level: z.enum(LEVELS),
});
export type Template = z.infer<typeof TemplateSchema>;

export const RawPackSchema = z.strictObject({
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
