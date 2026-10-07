// src/app/mechanics/SceneThenChoose.tsx
import { useEffect, useRef, useState } from 'react';
import { isExpression, type BuddyExpression } from '../buddy/Buddy';
import { cueClass, SETTLE_MS, SHOW_MS, useRoundFlow } from '../game/useRoundFlow';
import { VignetteView } from '../scenario/Vignette';
import { SADDER, VIGNETTES, WATCH_MS, type FriendMood } from '../scenario/vignettes';
import { useLater, useViewport } from '../ui/hooks';
import { Picture } from '../ui/Picture';
import { tiltFor } from '../ui/tilt';
import type { MechanicProps } from './types';
import './mechanics.css';

type Choice = { id: string; label: string; asset: string; correct: boolean; reactionLineId?: string };

/**
 * Spec §6 #22: a short vignette (narrated, ending with the question), then 2–3 choices. A feeling chosen right, Buddy
 * acts it out. In the kindness scenes an unkind choice says its reaction line and makes the friend's face sadder —
 * never Buddy acting it out; a kind one makes the friend smile. Judged by `correct`, never by slot (a scene can have
 * two right answers).
 */
export function SceneThenChoose({ round, deps, look, onEnd, onReact, quiet }: MechanicProps) {
  const p = round.payload;
  if (p.kind !== 'scenario') throw new Error(`scene-then-choose cannot play a ${p.kind} round`);
  const later = useLater();
  const { w, h } = useViewport();
  const [watching, setWatching] = useState(true);
  const [buddy, setBuddy] = useState<BuddyExpression>('neutral');
  const [friend, setFriend] = useState<FriendMood | undefined>(VIGNETTES[p.vignette]?.friend);
  const [picked, setPicked] = useState<string | null>(null);
  const [shake, setShake] = useState<{ id: string; n: number } | null>(null);
  // one tap, one answer (as tap-the-one): no second miss at once on the card that just shook, nothing while Buddy shows
  const settling = useRef<string | null>(null);
  const showing = useRef(false);
  const right = p.choices.filter((c) => c.correct);
  const flow = useRoundFlow({ deps, targets: () => right.map((c) => c.id), onEnd, onReact, quiet });

  // the quiet spell runs from when the child can choose, not while the scene plays
  useEffect(() => later(() => { setWatching(false); flow.touch(); }, WATCH_MS), [later]);

  const actOut = (c: Choice) => {
    if (isExpression(c.id)) setBuddy(c.id);
    else setFriend('happy');
  };

  const tap = (c: Choice) => {
    if (flow.ended || picked !== null || showing.current || settling.current === c.id) return;
    flow.touch();
    if (c.correct) {
      setPicked(c.id);
      actOut(c);
      flow.done(c.reactionLineId);
      return;
    }
    setShake((s) => ({ id: c.id, n: (s?.n ?? 0) + 1 }));
    if (c.reactionLineId) setFriend((f) => SADDER[f ?? 'happy']);
    settling.current = c.id;
    later(() => {
      if (settling.current === c.id) settling.current = null;
    }, SETTLE_MS);
    if (flow.miss('round', c.id, c.reactionLineId) === 'show') {
      showing.current = true;
      later(() => {
        const answer = right[0] as Choice;
        setPicked(answer.id);
        actOut(answer);
        flow.done();
      }, SHOW_MS);
    }
  };

  const size = Math.round(Math.max(48, Math.min(h * 0.18, (w - 160) / p.choices.length - 60, 150)));
  // with the choices, the frame shares the stage (h - 128) with them (a picture and its name on up to two lines, size + 92,
  // and the 2vh gap): on a short screen (a phone) it gives way, so no choice runs off the bottom
  const frame = Math.round(Math.min(watching ? h * 0.62 : Math.min(h * 0.42, h * 0.98 - 220 - size), (w - 80) / 1.6));
  return (
    <div className="stage">
      <VignetteView vignette={p.vignette} look={look} buddy={buddy} {...(friend ? { friend } : {})} height={frame} />
      {!watching && (
        <div className="row">
          {p.choices.map((c) => (
            <button
              key={shake?.id === c.id ? `${c.id}:${shake.n}` : c.id}
              type="button"
              className={`option ${cueClass(flow.cue, c.id)} ${picked === c.id ? 'is-right' : ''} ${shake?.id === c.id ? 'shake' : ''}`}
              style={{ width: size + 40, rotate: tiltFor(c.id) }}
              aria-label={c.label}
              onClick={() => tap(c)}
            >
              <Picture asset={c.asset} label="" size={size} />
              <span className="option__label">{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
