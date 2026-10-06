// src/engine/audio/howlerPlayer.test.ts
import { describe, it, expect } from 'vitest';
import { HowlerClipPlayer, type HowlLike, type HowlOptions } from './howlerPlayer';

class FakeHowl implements HowlLike {
  static instances: FakeHowl[] = [];
  playing = false;
  unloaded = false;
  /** Howler queues stop() until a sound has loaded (and unload() drops the queue), so a loading sound fires no onstop. */
  loading = false;
  constructor(public opts: HowlOptions) { FakeHowl.instances.push(this); }
  play() { this.playing = true; }
  stop() { this.playing = false; if (!this.loading) this.opts.onstop?.(); }
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

  it('rejects when the clip cannot load or play', async () => {
    FakeHowl.instances = [];
    const player = new HowlerClipPlayer(FakeHowl);
    const done = player.play('/c.mp3');
    FakeHowl.instances[0]!.opts.onloaderror?.(1, 'boom');
    await expect(done).rejects.toThrow('Could not load /c.mp3: boom');
    const locked = player.play('/d.mp3'); // mobile autoplay lock: the chain falls through to TTS
    FakeHowl.instances[1]!.opts.onplayerror?.(1, 'not allowed');
    await expect(locked).rejects.toThrow('Could not play /d.mp3: not allowed');
  });

  it('a new clip stops and unloads the one still playing, and settles its promise', async () => {
    FakeHowl.instances = [];
    const player = new HowlerClipPlayer(FakeHowl);
    const first = player.play('/a.mp3');
    const second = player.play('/b.mp3');
    expect(FakeHowl.instances[0]).toMatchObject({ playing: false, unloaded: true });
    expect(FakeHowl.instances[1]!.playing).toBe(true);
    await expect(first).resolves.toBeUndefined();
    FakeHowl.instances[1]!.opts.onend?.();
    await expect(second).resolves.toBeUndefined();
  });

  it('stop() settles a clip that is still loading, though Howler fires no onstop for it', async () => {
    FakeHowl.instances = [];
    const player = new HowlerClipPlayer(FakeHowl);
    const done = player.play('/e.mp3');
    const howl = FakeHowl.instances[0]!;
    howl.loading = true;
    player.stop();
    howl.opts.onplayerror?.(1, 'AbortError'); // unload() aborting a pending html5 play() must not turn the stop into a failure
    await expect(done).resolves.toBeUndefined();
  });
});
