// src/engine/audio/howlerPlayer.ts
import type { ClipPlayer } from './manager';

export interface HowlOptions {
  src: string[];
  html5?: boolean;
  onend?: () => void;
  onstop?: () => void;
  onloaderror?: (id: number, error: unknown) => void;
  onplayerror?: (id: number, error: unknown) => void;
}
export interface HowlLike {
  play(): unknown;
  stop(): unknown;
  unload(): unknown;
}
export type HowlCtor = new (options: HowlOptions) => HowlLike;

/**
 * Plays one clip at a time through Howler (Plan 1B passes the real `Howl` class).
 * html5: true streams from the network and keeps iOS Safari happy with many small files.
 */
export class HowlerClipPlayer implements ClipPlayer {
  private current: { howl: HowlLike; finish: () => void } | null = null;

  constructor(private readonly Howl: HowlCtor) {}

  play(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stop();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        reject(new Error(message));
      };
      const howl = new this.Howl({
        src: [url],
        html5: true,
        onend: finish,
        onstop: finish,
        onloaderror: (_id, error) => fail(`Could not load ${url}: ${String(error)}`),
        onplayerror: (_id, error) => fail(`Could not play ${url}: ${String(error)}`),
      });
      this.current = { howl, finish };
      howl.play();
    });
  }

  /**
   * Settles the clip's promise itself: Howler queues stop() while a sound is still loading and unload() drops that
   * queue, so no onstop arrives; and unloading during an html5 play() makes Howler fire onplayerror instead.
   */
  stop(): void {
    const current = this.current;
    this.current = null;
    if (current) {
      current.finish();
      current.howl.stop();
      current.howl.unload();
    }
  }
}
