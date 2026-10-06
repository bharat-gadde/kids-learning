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
  /** Settles when the clip ends or is stopped; rejects when it cannot load or play (the chain then falls through to the next layer). */
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
  /** Settles the running speak() when stop() interrupts it, even if the player or TTS never settle theirs. */
  private interrupted: Promise<void> = Promise.resolve();
  private interrupt: () => void = () => {};

  constructor(private readonly deps: AudioDeps) {}

  async speak(req: SpeakRequest): Promise<SpokenPart[]> {
    const line = this.deps.pack.lines.get(req.lineId);
    if (!line) throw new Error(`unknown line ${req.lineId}`); // before stop(): a bad request neither cuts the voice off nor becomes replay()'s
    this.stop();
    const myToken = this.token;
    this.interrupted = new Promise((resolve) => (this.interrupt = () => resolve()));
    this.last = req;
    const asked = Number.isInteger(req.variant) ? (req.variant as number) : 0;
    const variant = Math.max(0, Math.min(asked, line.variants.length - 1));
    const parts: SpokenPart[] = [];
    for (const seg of segmentLine(req.lineId, variant, line.variants[variant] as string)) {
      if (this.token !== myToken) break; // interrupted by a newer speak() or stop()
      if (seg.kind === 'text') {
        parts.push(await this.clipOrTts(myToken, seg.clipId, seg.text));
      } else {
        const value = req.slots?.[seg.name];
        if (value) parts.push(await this.speakSlot(myToken, seg.name, value, req.slots?.n)); // a slot with no value (or '') is skipped
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
    this.interrupt();
    this.deps.player.stop();
    this.deps.tts.cancel();
  }

  /** {targets} is spoken in the plural except after an {n} of 1 ("one apple"); UI_SLOTS ({name}, {buddy}) go to TTS. */
  private async speakSlot(myToken: number, name: string, value: string, n?: string): Promise<SpokenPart> {
    if (UI_SLOTS.has(name)) return this.tts(myToken, value); // a name from the profile, never an object or glyph id
    const { pack } = this.deps;
    const object = pack.objects.get(value);
    if (object) {
      if (name === 'targets' && n !== '1') return this.clipOrTts(myToken, pluralClipId(object.lineId), pluralOf(object));
      return this.nameClip(myToken, object.lineId, object.name);
    }
    const glyph =
      pack.glyphs.get(value) ??
      (/^\d+$/.test(value) ? [...pack.glyphs.values()].find((g) => g.kind === 'number' && g.value === Number(value)) : undefined);
    if (glyph) return this.nameClip(myToken, glyph.lineId, glyph.char);
    return this.tts(myToken, value);
  }

  /** An object's or glyph's name: its line's first text segment, with the id and text allTextClips generated. */
  private async nameClip(myToken: number, lineId: string, fallback: string): Promise<SpokenPart> {
    const variant = this.deps.pack.lines.get(lineId)?.variants[0];
    const seg = variant === undefined ? undefined : segmentLine(lineId, 0, variant)[0];
    return seg?.kind === 'text' ? this.clipOrTts(myToken, seg.clipId, seg.text) : this.tts(myToken, fallback);
  }

  /** A layer that fails to load or play falls through to the next (spec §13: a missing clip falls through the chain). */
  private async clipOrTts(myToken: number, clipId: string, text: string): Promise<SpokenPart> {
    const { heart, clips, player } = this.deps;
    if (heart && (await heart.has(clipId, text)) && (await this.play(myToken, () => player.play(heart.urlFor(clipId))))) {
      return { source: 'heart', text };
    }
    if (clips.has(clipId, text) && (await this.play(myToken, () => player.play(clips.urlFor(clipId))))) {
      return { source: 'clip', text };
    }
    return this.tts(myToken, text);
  }

  private async tts(myToken: number, text: string): Promise<SpokenPart> {
    if (!this.deps.tts.available()) return { source: 'silent', text };
    return (await this.play(myToken, () => this.deps.tts.speak(text))) ? { source: 'tts', text } : { source: 'silent', text };
  }

  /**
   * Start one sound for the speak() holding myToken: nothing once a newer speak() or stop() has taken over (a Heart
   * lookup can resolve after that). Settles when the sound ends or is interrupted; false when it failed to play.
   */
  private async play(myToken: number, start: () => Promise<void>): Promise<boolean> {
    if (this.token !== myToken) return true;
    try {
      await Promise.race([start(), this.interrupted]);
      return true;
    } catch {
      return false;
    }
  }
}
