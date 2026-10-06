// src/app/ui/ItemView.tsx
import type { RoundItem } from '../../engine/generator/types';
import { Picture } from './Picture';

/** Columns for a counted group: easy to count at a glance (1–3 in a row, then 2 or 3 rows). */
export function groupColumns(count: number): number {
  if (count <= 3) return count;
  if (count === 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

/**
 * What a round item looks like: its picture, scaled for size rules (spec §6.1: the same object at several sizes), or
 * `count` copies for count rules. `size` is the full-size picture's width in px.
 */
export function ItemView({ item, size }: { item: RoundItem; size: number }) {
  if (item.count !== undefined) {
    const cols = groupColumns(item.count);
    const rows = Math.ceil(item.count / cols);
    const each = Math.floor(size / Math.max(cols, rows)) - 4;
    return (
      <span className="group" style={{ gridTemplateColumns: `repeat(${cols}, ${each}px)` }} role="img" aria-label={item.label}>
        {Array.from({ length: item.count }, (_, i) => <Picture key={i} asset={item.asset} label="" size={each} />)}
      </span>
    );
  }
  return <Picture asset={item.asset} label={item.label} size={Math.round(size * (item.scale ?? 1))} />;
}
