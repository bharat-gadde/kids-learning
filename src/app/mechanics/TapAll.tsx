// src/app/mechanics/TapAll.tsx
import { useRef, useState } from 'react';
import { cueClass, SETTLE_MS, SHOW_MS, useRoundFlow } from '../game/useRoundFlow';
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
  // one tap, one answer: the card that just shook takes no second miss at once, and once Buddy ticks the rest, the round is decided
  const settling = useRef<string | null>(null);
  const showing = useRef(false);
  const left = p.correctIds.filter((id) => !ticked.includes(id));
  const flow = useRoundFlow({ deps, targets: () => left, onEnd, onReact, quiet });
  const cols = Math.ceil(p.options.length / 2);
  // never below 48 px, so a picture never vanishes or goes negative on a phone (the phone layout is M4's)
  const size = Math.round(Math.max(48, Math.min((w - 120) / cols - 60, (h - 260) / 2 - 40, 200)));

  const tap = (id: string) => {
    if (flow.ended || showing.current || settling.current === id || ticked.includes(id)) return;
    flow.touch();
    if (p.correctIds.includes(id)) {
      const next = [...ticked, id];
      setTicked(next);
      if (next.length === p.correctIds.length) flow.done();
      else flow.step();
      return;
    }
    setShake((s) => ({ id, n: (s?.n ?? 0) + 1 }));
    settling.current = id;
    later(() => {
      if (settling.current === id) settling.current = null;
    }, SETTLE_MS);
    if (flow.miss('round', id) === 'show') {
      showing.current = true;
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
            style={{ width: size + 30, height: size + 30, rotate: tiltFor(o.id) }}
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
