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
