// src/engine/audio/manager.ts
import type { ContentPack } from '../content/load';
import { pluralOf } from '../generator/items';
import { UI_SLOTS } from '../content/schema';
import { pluralClipId, segmentLine } from './lines';

export interface ClipSource {
  /** False for a clip generated from other text (stale: its line was edited), so the line falls back to TTS. */
  has(clipId: string, text: string): boolean;
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
/** Parent recordings (spec §7 "Heart"); arrives in Plan 4, the chain is ready for it now. A recording counts only for the text it was recorded for. */
export interface HeartSource {
  has(clipId: string, text: string): Promise<boolean>;
  urlFor(clipId: string): string;
}

export interface SpeakRequest {
  lineId: string;
  variant?: number;
  /** slot name → object/glyph id, a number as text, or a literal such as the child's name */
  slots?: Readonly<Record<string, string>>;
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
        if (value !== undefined) parts.push(await this.speakSlot(seg.name, value, req.slots?.n));
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

  /** {targets} is spoken in the plural except after an {n} of 1 ("one apple"); UI_SLOTS ({name}, {buddy}) go to TTS. */
  private async speakSlot(name: string, value: string, n?: string): Promise<SpokenPart> {
    if (UI_SLOTS.has(name)) return this.tts(value); // a name from the profile, never an object or glyph id
    const { pack } = this.deps;
    const object = pack.objects.get(value);
    if (object) {
      if (name === 'targets' && n !== '1') return this.clipOrTts(pluralClipId(object.lineId), pluralOf(object));
      return this.nameClip(object.lineId, object.name);
    }
    const glyph =
      pack.glyphs.get(value) ??
      (/^\d+$/.test(value) ? [...pack.glyphs.values()].find((g) => g.kind === 'number' && g.value === Number(value)) : undefined);
    if (glyph) return this.nameClip(glyph.lineId, glyph.char);
    return this.tts(value);
  }

  /** An object's or glyph's name: its line's first text segment, with the id and text allTextClips generated. */
  private async nameClip(lineId: string, fallback: string): Promise<SpokenPart> {
    const variant = this.deps.pack.lines.get(lineId)?.variants[0];
    const seg = variant === undefined ? undefined : segmentLine(lineId, 0, variant)[0];
    return seg?.kind === 'text' ? this.clipOrTts(seg.clipId, seg.text) : this.tts(fallback);
  }

  private async clipOrTts(clipId: string, text: string): Promise<SpokenPart> {
    const { heart, clips, player } = this.deps;
    if (heart && (await heart.has(clipId, text))) {
      await player.play(heart.urlFor(clipId));
      return { source: 'heart', text };
    }
    if (clips.has(clipId, text)) {
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
