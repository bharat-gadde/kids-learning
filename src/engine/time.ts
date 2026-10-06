// src/engine/time.ts
export type DayBlock = 'morning' | 'afternoon' | 'evening';

/** Spec §4.1: morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–04:59. */
export function blockFor(date: Date): DayBlock {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  return 'evening';
}

export function greetingLineFor(block: DayBlock): string {
  return `buddy.greet_${block}`;
}
