// src/app/mechanics/TapTheOne.tsx
import { useRef, useState } from 'react';
import { cueClass, SETTLE_MS, SHOW_MS, useRoundFlow } from '../game/useRoundFlow';
import { useLater, useViewport } from '../ui/hooks';
import { ItemView } from '../ui/ItemView';
import { tiltFor } from '../ui/tilt';
import type { MechanicProps } from './types';
import './mechanics.css';

/**
 * Spec §6 #1: 2–4 options, one right (letters, CVC pictures, the biggest of one object, feelings). Judged by
 * correctIds, never by slot. A wrong tap shakes and gives a hint; the second, Buddy shows the answer.
 */
export function TapTheOne({ round, deps, onEnd, onReact, quiet }: MechanicProps) {
  const p = round.payload;
  if (p.kind !== 'choose') throw new Error(`tap-the-one cannot play a ${p.kind} round`);
  const later = useLater();
  const { w, h } = useViewport();
  const [right, setRight] = useState<string | null>(null);
  const [shake, setShake] = useState<{ id: string; n: number } | null>(null);
  // one tap, one answer: the card that just shook takes no second miss at once, and once Buddy shows, the round is decided
  const settling = useRef<string | null>(null);
  const showing = useRef(false);
  const flow = useRoundFlow({ deps, targets: () => p.correctIds, onEnd, onReact, quiet });
  // never below 48 px, so a picture never vanishes or goes negative on a phone (the phone layout is M4's)
  const size = Math.round(Math.max(48, Math.min((w - 120) / p.options.length - 70, h * (p.stimulus ? 0.28 : 0.4), 250)));

  const tap = (id: string) => {
    if (flow.ended || right !== null || showing.current || settling.current === id) return;
    flow.touch();
    if (p.correctIds.includes(id)) {
      setRight(id);
      flow.done();
      return;
    }
    setShake((s) => ({ id, n: (s?.n ?? 0) + 1 }));
    settling.current = id;
    later(() => {
      if (settling.current === id) settling.current = null;
    }, SETTLE_MS);
    if (flow.miss('round', id) === 'show') {
      showing.current = true;
      later(() => {
        setRight(p.correctIds[0] ?? null);
        flow.done();
      }, SHOW_MS);
    }
  };

  return (
    <div className="stage">
      {p.stimulus && <div className="card stimulus"><ItemView item={p.stimulus} size={Math.round(h * 0.26)} /></div>}
      <div className="row">
        {p.options.map((o) => (
          <button
            key={shake?.id === o.id ? `${o.id}:${shake.n}` : o.id}
            type="button"
            className={`option ${cueClass(flow.cue, o.id)} ${right === o.id ? 'is-right' : ''} ${shake?.id === o.id ? 'shake' : ''}`}
            style={{ width: size + 30, height: size + 30, rotate: tiltFor(o.id) }}
            aria-label={o.label}
            onClick={() => tap(o.id)}
          >
            <ItemView item={o} size={size} />
          </button>
        ))}
      </div>
    </div>
  );
}
