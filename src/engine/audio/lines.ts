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
    const trimmed = raw.replace(/^[\s.,;:!?]+/, '').trim(); // "? Tap it" → "Tap it": the "?" ended the sentence before the slot
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
  // Only count and give-count rules fill {targets}, and they draw countable objects alone (generator/rules.ts).
  for (const o of pack.objects.values()) {
    if (o.tags.countable) clips.push({ clipId: pluralClipId(o.lineId), text: pluralOf(o), lineId: o.lineId });
  }
  return clips;
}
