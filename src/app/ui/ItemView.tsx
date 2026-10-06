// src/app/ui/ItemView.tsx
import type { RoundItem } from '../../engine/generator/types';
import { Picture } from './Picture';

/**
 * Columns for a counted group, in rows that are easy to count: 1–3 in one row; 4–8 as LKG worksheets draw them (2+2,
 * 3+2, 3+3, 4+3, 4+4); 9 as 3×3, whose pictures are over a third bigger than 4+4+1's, with no straggler; 10 as 4+4+2
 * (a ten-frame's 5+5 would shrink them further).
 */
export function groupColumns(count: number): number {
  if (count <= 3) return count;
  if (count === 4) return 2;
  if (count <= 6 || count === 9) return 3;
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
