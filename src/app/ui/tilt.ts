// src/app/ui/tilt.ts
import { hashString } from '../../engine/rng';

/**
 * A card's slight, steady rotation (spec §12, Storybook: "slight rotation … on cards"), the same for the same id. A value
 * for the `rotate` property, not `transform`: it then composes with the cue, shake and press transforms instead of
 * hiding them (an inline transform beats `.option:active`).
 */
export function tiltFor(id: string): string {
  return `${(hashString(id) % 5) - 2}deg`;
}
