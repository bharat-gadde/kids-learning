// src/engine/progress/picker.ts
import type { ContentPack } from '../content/load';
import type { MechanicId, Template, Topic } from '../content/schema';
import type { Rng } from '../rng';
import { preferredForm } from './bridging';
import { goalStatus } from './mastery';
import type { Attempt, GoalStatus } from './types';

/** Read-only: one history (and the shared EMPTY_PICKER_HISTORY) can be handed to many picker calls. */
export interface PickerHistory {
  readonly sessionIndex: number;
  /** templateId → the session index it was last played in */
  readonly lastPlayedSession: Readonly<Record<string, number>>;
  /** topicId → mechanic used the last time this topic was played */
  readonly lastMechanicByTopic: Readonly<Record<string, MechanicId>>;
  readonly attemptsByGoal: Readonly<Record<string, readonly Attempt[]>>;
  /** the topic of the latest attempt, whether Buddy suggested it or the child chose it */
  readonly lastTopicId: string | null;
}

export const EMPTY_PICKER_HISTORY: PickerHistory = Object.freeze({
  sessionIndex: 1,
  lastPlayedSession: Object.freeze({}),
  lastMechanicByTopic: Object.freeze({}),
  attemptsByGoal: Object.freeze({}),
  lastTopicId: null,
});

export interface TemplatePick {
  template: Template;
  /** the form the child just missed, when this pick is a bridge back to a familiar form */
  bridgeFrom: string | null;
}

/** How strongly a goal's status draws the picker and Buddy's suggestion: weakest first, mastered last. */
const STATUS_WEIGHT: Record<GoalStatus, number> = { 'needs-practice': 3, shaky: 2, new: 1.5, mastered: 0.25 };

/** One draw of `rng`; each item's chance is its weight over the total. */
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

/** Spec §5.4 rule 5 and §5.5 bridging: choose which template of a topic to play now. */
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

  // Rule 5: not the mechanic of this topic's last play, if another is left. After any earlier play, not only on
  // consecutive days: that is what brings the missed form back the set after a bridge (§5.5).
  let candidates = all;
  const lastMechanic = history.lastMechanicByTopic[topicId];
  if (lastMechanic && all.length > 1) {
    const rotated = all.filter((t) => t.mechanic !== lastMechanic);
    if (rotated.length > 0) candidates = rotated;
  }

  const template = weightedPick(rng, candidates, (t) => {
    let w = 1;
    const lastSession = history.lastPlayedSession[t.id];
    // not played lately: not in this session or the 3 before it, the window of the generator's item history (Task 16)
    if (lastSession === undefined || history.sessionIndex - lastSession > 3) w += 2;
    return w * STATUS_WEIGHT[goalStatus(history.attemptsByGoal[t.goalId] ?? [])];
  });
  return { template, bridgeFrom: null };
}

/**
 * Spec §5.4 rule 6: Buddy's suggested next spot. Not the topic just played while another has templates, and not its
 * island while another island has one. Among the rest, one draw weighted by each topic's weakest goal: needs-practice
 * and shaky topics come up more often than new ones, mastered ones least. A preference, not §4.3's "chosen from goals
 * that are shaky": as a filter, Buddy would point only at the first topics played. "Just played" is the latest
 * attempt's topic, whether Buddy suggested it or the child chose it.
 */
export function suggestTopic(pack: ContentPack, history: PickerHistory, rng: Rng): string {
  const playable = [...pack.topics.values()].filter((t) => (pack.templatesByTopic.get(t.id)?.length ?? 0) > 0);
  if (playable.length === 0) throw new Error('no topic has templates');
  const last = history.lastTopicId === null ? undefined : pack.topics.get(history.lastTopicId);
  const otherTopics = playable.filter((t) => t.id !== last?.id);
  const otherIslands = otherTopics.filter((t) => t.subject !== last?.subject);
  const pool = otherIslands.length > 0 ? otherIslands : otherTopics.length > 0 ? otherTopics : playable;
  const weakestGoal = (t: Topic) => Math.max(...t.goals.map((g) => STATUS_WEIGHT[goalStatus(history.attemptsByGoal[g.id] ?? [])]));
  return weightedPick(rng, pool, weakestGoal).id;
}
