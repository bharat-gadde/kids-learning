// src/app/mechanics/Sequence.tsx
import { useRef, useState } from 'react';
import { cueClass, SHOW_MS, useRoundFlow } from '../game/useRoundFlow';
import { artUrl } from '../ui/art';
import { useLater, useViewport } from '../ui/hooks';
import { Picture } from '../ui/Picture';
import { tiltFor } from '../ui/tilt';
import { useDnd } from './dnd';
import type { MechanicProps } from './types';
import './mechanics.css';

const slotId = (i: number) => `slot:${i}`;

/**
 * Spec §6 #10: 3–5 cards into ordered slots. A card dropped on the wrong slot bounces back with a hint (its slot
 * glows); a second miss with that card and Buddy puts it in its place. The round's correctOrder is never reordered.
 */
export function Sequence({ round, deps, onEnd, onReact, quiet }: MechanicProps) {
  const p = round.payload;
  if (p.kind !== 'order') throw new Error(`sequence cannot play a ${p.kind} round`);
  const later = useLater();
  const { w, h } = useViewport();
  const filled = useRef<readonly string[]>([]); // card ids placed, in any order
  const [, redraw] = useState(0);
  const slotOf = (cardId: string) => p.correctOrder.indexOf(cardId);
  const nextEmpty = p.correctOrder.findIndex((id) => !filled.current.includes(id));
  const flow = useRoundFlow({
    deps, onEnd, onReact, quiet,
    targets: (key) => (key === null ? (nextEmpty >= 0 ? [p.correctOrder[nextEmpty] as string, slotId(nextEmpty)] : []) : [slotId(slotOf(key))]),
  });

  const place = (cardId: string) => {
    if (filled.current.includes(cardId)) return;
    filled.current = [...filled.current, cardId];
    redraw((n) => n + 1);
    if (filled.current.length === p.correctOrder.length) flow.done();
    else flow.step();
  };

  const dnd = useDnd({
    onDrop(cardId, target) {
      if (flow.ended || filled.current.includes(cardId) || !target.startsWith('slot:')) return;
      const slot = Number(target.slice(5));
      if (filled.current.includes(p.correctOrder[slot] ?? '')) return; // that slot is already done
      flow.touch();
      if (slotOf(cardId) === slot) place(cardId);
      else if (flow.miss(cardId, `${cardId}>${target}`) === 'show') later(() => place(cardId), SHOW_MS);
    },
    onPick: () => flow.touch(),
  });

  const n = p.correctOrder.length;
  const size = Math.round(Math.min((w - 160) / n - 70, h * 0.2, 150));
  const card = (id: string) => p.items.find((i) => i.id === id);
  return (
    <div className="stage">
      <div className="tray">
        {p.items.filter((i) => !filled.current.includes(i.id)).map((item) => (
          <button key={item.id} type="button" aria-label={item.label} {...dnd.itemProps(item.id, !flow.ended)}>
            <span className={`option ${cueClass(flow.cue, item.id)}`} style={{ width: size + 24, rotate: tiltFor(item.id) }}>
              <Picture asset={item.asset} label="" size={size} />
              <span className="option__label">{item.label}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 10 }}>
        {p.correctOrder.map((id, i) => {
          const done = filled.current.includes(id);
          const placedCard = done ? card(id) : undefined;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {i > 0 && <img src={artUrl('ui/back.svg')} alt="" style={{ width: 36, transform: 'scaleX(-1)', opacity: 0.6 }} />}
              <div className={`drop ${cueClass(flow.cue, slotId(i))}`} style={{ minWidth: size + 30, minHeight: size + 40 }} {...dnd.targetProps(slotId(i))} role="button" aria-label={`place ${i + 1}`}>
                <span className="drop__label">{i + 1}</span>
                {placedCard && <Picture asset={placedCard.asset} label={placedCard.label} size={size} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
