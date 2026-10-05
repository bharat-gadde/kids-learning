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
