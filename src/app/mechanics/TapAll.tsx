// src/app/mechanics/TapAll.tsx
import { useState } from 'react';
import { cueClass, SHOW_MS, useRoundFlow } from '../game/useRoundFlow';
import { artUrl } from '../ui/art';
import { useLater, useViewport } from '../ui/hooks';
import { ItemView } from '../ui/ItemView';
import { tiltFor } from '../ui/tilt';
import type { MechanicProps } from './types';
import './mechanics.css';

/**
 * Spec §6 #2: 4–8 options, several right; done when every right one is tapped. A wrong tap shakes and counts as a
 * miss (a hint: the ones left wiggle); a second, and Buddy ticks the rest.
 */
export function TapAll({ round, deps, onEnd, onReact, quiet }: MechanicProps) {
  const p = round.payload;
  if (p.kind !== 'choose') throw new Error(`tap-all-that-match cannot play a ${p.kind} round`);
  const later = useLater();
  const { w, h } = useViewport();
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [shake, setShake] = useState<{ id: string; n: number } | null>(null);
  const left = p.correctIds.filter((id) => !ticked.includes(id));
  const flow = useRoundFlow({ deps, targets: () => left, onEnd, onReact, quiet });
  const cols = Math.ceil(p.options.length / 2);
  const size = Math.round(Math.min((w - 120) / cols - 60, (h - 260) / 2 - 40, 200));

  const tap = (id: string) => {
    if (flow.ended || ticked.includes(id)) return;
    flow.touch();
    if (p.correctIds.includes(id)) {
      const next = [...ticked, id];
      setTicked(next);
      if (next.length === p.correctIds.length) flow.done();
      else flow.step();
      return;
    }
    setShake((s) => ({ id, n: (s?.n ?? 0) + 1 }));
    if (flow.miss('round', id) === 'show') {
      left.forEach((rest, i) => later(() => setTicked((t) => [...t, rest]), SHOW_MS + i * 450));
      later(() => flow.done(), SHOW_MS + left.length * 450);
    }
  };

  return (
    <div className="stage">
      <div className="row" style={{ maxWidth: cols * (size + 90) }}>
        {p.options.map((o) => (
          <button
            key={shake?.id === o.id ? `${o.id}:${shake.n}` : o.id}
            type="button"
            className={`option ${cueClass(flow.cue, o.id)} ${ticked.includes(o.id) ? 'is-right' : ''} ${shake?.id === o.id ? 'shake' : ''}`}
            style={{ width: size + 24, height: size + 24, rotate: tiltFor(o.id) }}
            aria-label={o.label}
            aria-pressed={ticked.includes(o.id)}
            onClick={() => tap(o.id)}
          >
            <ItemView item={o} size={size} />
            {ticked.includes(o.id) && <img className="option__mark" src={artUrl('ui/done.svg')} alt="" />}
          </button>
        ))}
      </div>
    </div>
  );
}
