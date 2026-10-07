// src/app/screens/islands.ts
import type { ContentPack } from '../../engine/content/load';
import { SUBJECTS, type SubjectId, type Topic } from '../../engine/content/schema';
import { isPlayable } from '../mechanics/Mechanic';

/** Spec §4.3: the five islands of the Play Map, one per subject. */
export const ISLANDS: Readonly<Record<SubjectId, { title: string; icon: string; colour: string }>> = {
  literacy: { title: 'Letter Land', icon: 'islands/literacy.svg', colour: 'var(--literacy)' },
  phonics: { title: 'Sound Garden', icon: 'islands/phonics.svg', colour: 'var(--phonics)' },
  numeracy: { title: 'Number Hill', icon: 'islands/numeracy.svg', colour: 'var(--numeracy)' },
  awareness: { title: 'Our World', icon: 'islands/awareness.svg', colour: 'var(--awareness)' },
  wellness: { title: 'Feelings Forest', icon: 'islands/wellness.svg', colour: 'var(--wellness)' },
};

/** Each island's topic spots: topics with at least one game the app can play, in pack order. */
export function islandSpots(pack: ContentPack): Array<{ subject: SubjectId; topics: Topic[] }> {
  return SUBJECTS.map((subject) => ({
    subject,
    topics: [...pack.topics.values()].filter((t) => t.subject === subject && (pack.templatesByTopic.get(t.id) ?? []).some((tpl) => isPlayable(tpl.mechanic))),
  }));
}
