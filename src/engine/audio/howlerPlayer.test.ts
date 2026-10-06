// src/engine/audio/howlerPlayer.test.ts
import { describe, it, expect } from 'vitest';
import { HowlerClipPlayer, type HowlLike, type HowlOptions } from './howlerPlayer';

class FakeHowl implements HowlLike {
  static instances: FakeHowl[] = [];
  playing = false;
  unloaded = false;
  constructor(public opts: HowlOptions) { FakeHowl.instances.push(this); }
  play() { this.playing = true; }
  stop() { this.playing = false; this.opts.onstop?.(); }
  unload() { this.unloaded = true; }
}

describe('HowlerClipPlayer', () => {
  it('plays a url with html5 audio and resolves on end', async () => {
    FakeHowl.instances = [];
    const player = new HowlerClipPlayer(FakeHowl);
    const done = player.play('/a.mp3');
    const howl = FakeHowl.instances[0]!;
    expect(howl.opts.src).toEqual(['/a.mp3']);
    expect(howl.opts.html5).toBe(true);
    expect(howl.playing).toBe(true);
    howl.opts.onend?.();
    await expect(done).resolves.toBeUndefined();
  });

  it('stop() stops and unloads the current sound and resolves its promise', async () => {
    FakeHowl.instances = [];
    const player = new HowlerClipPlayer(FakeHowl);
    const done = player.play('/b.mp3');
    player.stop();
    expect(FakeHowl.instances[0]!.unloaded).toBe(true);
    await expect(done).resolves.toBeUndefined();
  });

  it('rejects when the clip cannot load', async () => {
    FakeHowl.instances = [];
    const player = new HowlerClipPlayer(FakeHowl);
    const done = player.play('/c.mp3');
    FakeHowl.instances[0]!.opts.onloaderror?.(1, 'boom');
    await expect(done).rejects.toThrow('Could not load /c.mp3: boom');
  });
});
