// src/app/mechanics/SortIntoBins.tsx
import { useRef, useState } from 'react';
import { fillNames } from '../audio/speaker';
import { cueClass, SHOW_MS, useRoundFlow } from '../game/useRoundFlow';
import { useLater, useViewport } from '../ui/hooks';
import { ItemView } from '../ui/ItemView';
import { Picture } from '../ui/Picture';
import { useDnd } from './dnd';
import type { MechanicProps } from './types';
import './mechanics.css';

/**
 * Spec §6 #8: 2–3 bins, 4–8 items. A wrong bin bounces the item back with a hint (its bin glows); a second miss on the
 * same item and Buddy puts it in. Misses count per item.
 */
export function SortIntoBins({ round, deps, names, onEnd, onReact, quiet }: MechanicProps) {
  const p = round.payload;
  if (p.kind !== 'bins') throw new Error(`sort-into-bins cannot play a ${p.kind} round`);
  const later = useLater();
  const { w, h } = useViewport();
  const placed = useRef<Readonly<Record<string, string>>>({});
  const [, redraw] = useState(0);
  const waiting = p.items.filter((i) => !(i.id in placed.current));
  const binOf = (itemId: string) => p.items.find((i) => i.id === itemId)?.binId ?? '';
  const flow = useRoundFlow({
    deps, onEnd, onReact, quiet,
    targets: (key) => (key === null ? (waiting[0] ? [waiting[0].id, waiting[0].binId] : []) : [binOf(key)]),
  });

  const place = (itemId: string) => {
    if (itemId in placed.current) return;
    placed.current = { ...placed.current, [itemId]: binOf(itemId) };
    redraw((n) => n + 1);
    if (Object.keys(placed.current).length === p.items.length) flow.done();
    else flow.step();
  };

  const dnd = useDnd({
    onDrop(itemId, binId) {
      if (flow.ended || itemId in placed.current || !p.bins.some((b) => b.id === binId)) return;
      flow.touch();
      if (binOf(itemId) === binId) place(itemId);
      else if (flow.miss(itemId, `${itemId}>${binId}`) === 'show') later(() => place(itemId), SHOW_MS);
    },
    onPick: () => flow.touch(),
  });

  const size = Math.round(Math.min((w - 160) / Math.min(p.items.length, 6) - 36, h * 0.2, 150));
  const binSize = Math.round(Math.min(h * 0.22, 170));
  return (
    <div className="stage">
      <div className="tray">
        {waiting.map((item) => (
          <button key={item.id} type="button" aria-label={item.label} {...dnd.itemProps(item.id, !flow.ended)}>
            <span className={`option ${cueClass(flow.cue, item.id)}`} style={{ width: size + 20, height: size + 20 }}>
              <ItemView item={item} size={size} />
            </span>
          </button>
        ))}
      </div>
      <div className="row">
        {p.bins.map((bin) => (
          <div key={bin.id} className={`drop ${cueClass(flow.cue, bin.id)}`} {...dnd.targetProps(bin.id)} role="button" aria-label={fillNames(bin.label, names)}>
            {bin.asset && <Picture asset={bin.asset} label="" size={binSize} />}
            <span className="drop__label">{fillNames(bin.label, names)}</span>
            <div className="drop__inside">
              {p.items.filter((i) => placed.current[i.id] === bin.id).map((i) => <ItemView key={i.id} item={i} size={48} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
