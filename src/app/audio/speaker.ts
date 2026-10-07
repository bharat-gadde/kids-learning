// src/app/audio/speaker.ts
import type { SpeakRequest } from '../../engine/audio/manager';
import type { ContentPack } from '../../engine/content/load';
import { pickVariant, renderCaption } from '../../engine/generator/round';
import type { Round } from '../../engine/generator/types';

/** What the speaker needs of the AudioManager. */
export interface Voice {
  speak(req: SpeakRequest): Promise<unknown>;
  stop(): void;
}

/** The names the UI fills into lines: the child's, and the one the child gave Buddy. */
export interface Names {
  name: string;
  buddy: string;
}

/**
 * Fill the slots captions keep for the profile (spec §4.7); Buddy is "Buddy" until named. One pass, with a function:
 * a typed name is inserted as it is ("$&" or "{buddy}" in it stay literal).
 */
export function fillNames(text: string, names: Names): string {
  return text.replace(/\{(name|buddy)\}/g, (_, slot: string) => (slot === 'name' ? names.name : names.buddy || 'Buddy'));
}

export interface Said {
  /** the words on screen for what is being said */
  caption: string;
  /** settles when the line ends or is cut off; never rejects, and nothing should wait on it to accept input */
  done: Promise<void>;
}

/**
 * Speaks lines with the names filled in. A UI line (a cheer, a greeting, Buddy's suggestion) takes a different wording
 * than last time — speak() alone always says variant 0, and spec §4.4 asks for a random short cheer. A round's prompt
 * keeps the wording the generator chose, and is what the 🔊 button replays: never the last cheer.
 */
export class Speaker {
  names: Names = { name: '', buddy: 'Buddy' };
  private readonly lastVariant: Record<string, number> = {};
  private promptRequest: SpeakRequest | null = null;

  constructor(private readonly voice: Voice, private readonly pack: ContentPack, private readonly random: () => number = Math.random) {}

  /** A UI line in a fresh wording. */
  say(lineId: string, slots: Readonly<Record<string, string>> = {}): Said {
    const line = this.pack.lines.get(lineId);
    if (!line) throw new Error(`unknown line ${lineId}`);
    const variant = pickVariant(this.random, line.variants.length, this.lastVariant[lineId]);
    this.lastVariant[lineId] = variant;
    const caption = fillNames(renderCaption(this.pack, line.variants[variant] as string, slots), this.names);
    return { caption, done: this.speak({ lineId, variant, slots: this.withNames(slots) }) };
  }

  /** A round's prompt — for a scenario, its narration, which ends with the prompt's question (said once). */
  prompt(round: Round): Said {
    const p = round.payload;
    const req: SpeakRequest = p.kind === 'scenario'
      ? { lineId: p.narrationLineId, variant: 0, slots: this.withNames({}) }
      : { lineId: round.prompt.lineId, variant: round.prompt.variant, slots: this.withNames(round.prompt.slots) };
    this.promptRequest = req;
    return { caption: fillNames(round.prompt.text, this.names), done: this.speak(req) };
  }

  /** The 🔊 button and the repeat after a quiet spell: the current prompt again. */
  replayPrompt(): Promise<void> {
    return this.promptRequest ? this.speak(this.promptRequest) : Promise.resolve();
  }

  /** Forget the prompt (between sets), so 🔊 has nothing stale to replay. */
  clearPrompt(): void {
    this.promptRequest = null;
  }

  /** A word on its own, e.g. a picture's name as the child picks it up. */
  word(lineId: string): Promise<void> {
    return this.speak({ lineId, variant: 0 });
  }

  stop(): void {
    this.voice.stop();
  }

  private withNames(slots: Readonly<Record<string, string>>): Record<string, string> {
    return { ...slots, name: this.names.name, buddy: this.names.buddy || 'Buddy' };
  }

  private speak(req: SpeakRequest): Promise<void> {
    return this.voice.speak(req).then(
      () => undefined,
      (e: unknown) => console.warn(`could not speak ${req.lineId}`, e),
    );
  }
}
