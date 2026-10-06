// src/app/ui/tilt.ts
import { hashString } from '../../engine/rng';

/** A card's slight, steady rotation (spec §12, Storybook: "slight rotation … on cards"), the same for the same id. */
export function tiltFor(id: string): string {
  return `rotate(${(hashString(id) % 5) - 2}deg)`;
}
