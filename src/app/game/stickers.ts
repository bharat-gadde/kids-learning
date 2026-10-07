// src/app/game/stickers.ts
import type { ContentPack } from '../../engine/content/load';
import type { SubjectId } from '../../engine/content/schema';
import type { Payload, Round, RoundItem } from '../../engine/generator/types';
import type { Sticker } from '../../engine/progress/types';

/** Spec §4.6: rare shiny stickers, about one in fifteen. */
export const SHINY_CHANCE = 1 / 15;

/** The pictures a set's answers showed: what the child matched, sorted, gave or chose. */
function answerItems(p: Payload): readonly RoundItem[] {
  switch (p.kind) {
    case 'choose': return p.options.filter((o) => p.correctIds.includes(o.id));
    case 'pairs': return p.left;
    case 'bins': return p.items;
    case 'give': return p.items.filter((i) => p.correctIds.includes(i.id));
    case 'order': return p.items;
    case 'scenario': return p.choices.filter((c) => c.correct);
  }
}

/** Spec §4.6: each sticker is a topic-themed picture from the set just played (a letter is drawn as a letter). */
export function stickerPicture(rounds: readonly Round[], random: () => number): string {
  const pictures = [...new Set(rounds.flatMap((r) => answerItems(r.payload)).map((i) => i.asset))];
  return pictures[Math.floor(random() * pictures.length)] ?? 'ui/shiny.svg';
}

export function newSticker(profileId: string, at: number, templateId: string, rounds: readonly Round[], random: () => number): Omit<Sticker, 'id'> {
  return { profileId, at, pictureId: stickerPicture(rounds, random), source: templateId, shiny: random() < SHINY_CHANCE };
}

/** The sticker book's page for a sticker (spec §4.6: one page per island, plus Home for routine stickers, Plan 1C). */
export function pageOf(pack: ContentPack, sticker: Pick<Sticker, 'source'>): SubjectId | 'home' {
  const topicId = pack.templates.get(sticker.source)?.topicId;
  return (topicId && pack.topics.get(topicId)?.subject) || 'home';
}
