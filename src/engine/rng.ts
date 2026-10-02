// src/engine/rng.ts
/** A random source returning numbers in [0, 1). */
export type Rng = () => number;

/**
 * Mulberry32 — small, fast, good enough for shuffling game content.
 * The seed is an integer in [0, 2^32); other numbers are coerced with `>>> 0`.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a 32-bit hash of a string.
 * Hashes over UTF-16 code units via charCodeAt, which equals standard FNV-1a for ASCII.
 */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A new seed derived from a parent seed and a label (e.g. "round3").
 * Hashes `${seed}:${salt}`, i.e. the seed's decimal string.
 * Sibling salts give related hashes; mulberry32's mixing is what keeps the derived streams independent.
 */
export function deriveSeed(seed: number, salt: string): number {
  return hashString(`${seed}:${salt}`);
}

/** A uniformly chosen element; throws on an empty array. Consumes one draw. */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick from empty array');
  return arr[Math.floor(rng() * arr.length)] as T;
}

/**
 * Fisher–Yates; returns a new array and leaves the input untouched.
 * Consumes n − 1 draws.
 */
export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}
