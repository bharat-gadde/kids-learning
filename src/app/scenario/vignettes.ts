// src/app/scenario/vignettes.ts
/**
 * The scene-then-choose vignettes (spec §6 #22), keyed by the scenario's `vignette`. They are composed here rather than
 * drawn as files because Buddy acts in them, in the colour and accessory the child chose. Each fills the whole frame
 * (the set's background could contradict it: thunder over a sunny playground).
 */

/** The friend in the kindness scenes: a face whose mood follows the child's choice (sad after an unkind one). */
export type FriendMood = 'happy' | 'sad' | 'crying' | 'hurt';

export const FRIEND_FACES: Record<FriendMood, string> = {
  happy: 'parts/face-happy.svg',
  sad: 'parts/face-sad.svg',
  crying: 'parts/face-crying.svg',
  hurt: 'parts/face-hurt.svg',
};

export interface Actor {
  /** Buddy (the child's), the friend's face, or a picture */
  who: 'buddy' | 'friend' | 'art';
  asset?: string;
  /** centre, in % of the frame's width and height */
  x: number;
  y: number;
  /** height, in % of the frame's height */
  size: number;
  /** a short animation, from vignette.css */
  anim?: 'fall' | 'pop' | 'shake' | 'flash' | 'bob' | 'float' | 'tip';
  /** seconds before it starts */
  delay?: number;
}

export interface Vignette {
  backdrop: 'park' | 'party' | 'storm' | 'room';
  /** the friend's mood before the child chooses */
  friend?: FriendMood;
  actors: readonly Actor[];
}

/** How long the vignette plays before the choices appear. */
export const WATCH_MS = 4500;

export const VIGNETTES: Readonly<Record<string, Vignette>> = {
  'vignettes/ice-cream-fell.svg': {
    backdrop: 'park',
    actors: [
      { who: 'art', asset: 'parts/tree.svg', x: 12, y: 46, size: 60 },
      { who: 'buddy', x: 42, y: 56, size: 76 },
      { who: 'art', asset: 'objects/ice-cream.svg', x: 64, y: 84, size: 22, anim: 'fall', delay: 0.8 },
    ],
  },
  'vignettes/birthday-gift.svg': {
    backdrop: 'party',
    actors: [
      { who: 'art', asset: 'parts/balloon.svg', x: 12, y: 30, size: 34, anim: 'float' },
      { who: 'art', asset: 'parts/balloon.svg', x: 88, y: 26, size: 30, anim: 'float', delay: 0.6 },
      { who: 'buddy', x: 38, y: 56, size: 76 },
      { who: 'art', asset: 'parts/cake.svg', x: 82, y: 74, size: 26 },
      { who: 'art', asset: 'parts/gift.svg', x: 64, y: 72, size: 34, anim: 'pop', delay: 0.8 },
    ],
  },
  'vignettes/loud-thunder.svg': {
    backdrop: 'storm',
    actors: [
      { who: 'art', asset: 'parts/storm.svg', x: 70, y: 24, size: 38, anim: 'shake' },
      { who: 'art', asset: 'parts/lightning.svg', x: 74, y: 52, size: 26, anim: 'flash', delay: 0.6 },
      { who: 'buddy', x: 36, y: 58, size: 76 },
    ],
  },
  'vignettes/toy-broken.svg': {
    backdrop: 'room',
    actors: [
      { who: 'buddy', x: 30, y: 56, size: 76 },
      { who: 'art', asset: 'objects/toy-car.svg', x: 60, y: 80, size: 20, anim: 'tip', delay: 0.8 },
      { who: 'art', asset: 'parts/person.svg', x: 82, y: 56, size: 66 },
    ],
  },
  'vignettes/friend-crying.svg': {
    backdrop: 'park',
    friend: 'crying',
    actors: [
      { who: 'art', asset: 'parts/slide.svg', x: 20, y: 56, size: 58 },
      { who: 'friend', x: 62, y: 54, size: 44, anim: 'bob' },
    ],
  },
  'vignettes/one-biscuit.svg': {
    backdrop: 'room',
    friend: 'sad',
    actors: [
      { who: 'art', asset: 'parts/cookie.svg', x: 32, y: 60, size: 26, anim: 'pop', delay: 0.5 },
      { who: 'friend', x: 70, y: 52, size: 40 },
    ],
  },
  'vignettes/slide-queue.svg': {
    backdrop: 'park',
    friend: 'happy',
    actors: [
      { who: 'art', asset: 'parts/slide.svg', x: 82, y: 54, size: 60 },
      { who: 'art', asset: 'parts/person.svg', x: 58, y: 60, size: 52 },
      { who: 'art', asset: 'parts/person.svg', x: 44, y: 60, size: 52 },
      { who: 'friend', x: 28, y: 56, size: 30 },
    ],
  },
  'vignettes/friend-fell.svg': {
    backdrop: 'park',
    friend: 'hurt',
    actors: [
      { who: 'art', asset: 'parts/tree.svg', x: 16, y: 46, size: 60 },
      { who: 'friend', x: 56, y: 66, size: 40, anim: 'tip', delay: 0.6 },
    ],
  },
};
