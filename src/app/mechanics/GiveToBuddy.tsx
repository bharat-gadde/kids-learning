// src/app/mechanics/GiveToBuddy.tsx
import { useRef, useState } from 'react';
import { fillNames } from '../audio/speaker';
import { Buddy, type BuddyMove } from '../buddy/Buddy';
import { cueClass, SETTLE_MS, SHOW_MS, useRoundFlow } from '../game/useRoundFlow';
import { artUrl } from '../ui/art';
import { useLater, useViewport } from '../ui/hooks';
import { ItemView } from '../ui/ItemView';
import { Picture } from '../ui/Picture';
import { useDnd } from './dnd';
import type { MechanicProps } from './types';
import './mechanics.css';

const TARGET = 'target';

/**
 * Spec §6 #9: drag items onto Buddy or onto a target (the plate); Buddy reacts to each (yum / yuck).
 * Without `count`, the correctIds items are the ones to give, and it ends when all are given.
 * With `count` (give-count), the items are copies and any `count` of them is right: the child gives, can take one
 * back with a tap, and taps ✓ — a wrong count is a miss, and the hint numbers the ones given (count with me).
 */
export function GiveToBuddy({ round, deps, names, look, onEnd, onReact, quiet }: MechanicProps) {
  const p = round.payload;
  if (p.kind !== 'give') throw new Error(`give-to-buddy cannot play a ${p.kind} round`);
  const later = useLater();
  const { w, h } = useViewport();
  const given = useRef<readonly string[]>([]);
  const [, redraw] = useState(0);
  // `beat` counts reactions: it keys Buddy, so a second yum plays again, and only the latest one goes back to idle
  const [buddy, setBuddy] = useState<{ move: BuddyMove; beat: number }>({ move: 'idle', beat: 0 });
  const beat = useRef(0);
  const buddyMove = buddy.move;
  const [numbered, setNumbered] = useState(false);
  // once Buddy shows the answer the round is decided: drops, take-backs and ✓ wait for it to end
  const showing = useRef(false);
  // ✓ again at once with the same count is the same answer (a bounce, a double tap), not a second miss
  const settling = useRef<string | null>(null);
  const counting = p.count !== undefined;
  const left = p.correctIds.filter((id) => !given.current.includes(id));
  const flow = useRoundFlow({
    deps, onEnd, onReact, quiet,
    targets: (key) => (counting ? (key === null ? [TARGET] : [...given.current]) : left),
  });

  const react = (move: BuddyMove) => {
    const mine = ++beat.current;
    setBuddy({ move, beat: mine });
    later(() => {
      if (beat.current === mine) setBuddy({ move: 'idle', beat: mine });
    }, 1200);
  };
  const setGiven = (next: readonly string[]) => {
    given.current = next;
    redraw((n) => n + 1);
  };

  const give = (itemId: string) => {
    if (given.current.includes(itemId)) return;
    setGiven([...given.current, itemId]);
    react('yum');
    if (!counting && p.correctIds.every((id) => given.current.includes(id))) flow.done();
    else flow.step();
  };

  const dnd = useDnd({
    onDrop(itemId, target) {
      if (flow.ended || showing.current || target !== TARGET || given.current.includes(itemId)) return;
      flow.touch();
      if (counting || p.correctIds.includes(itemId)) {
        give(itemId);
        return;
      }
      react('yuck');
      if (flow.miss('round', itemId) === 'show') {
        showing.current = true;
        left.forEach((id, i) => later(() => give(id), SHOW_MS + i * 450));
      }
    },
    onPick: () => flow.touch(),
  });

  const takeBack = (itemId: string) => {
    if (flow.ended || showing.current || !counting) return;
    flow.touch();
    setGiven(given.current.filter((id) => id !== itemId));
  };

  const check = () => {
    const answer = `n:${given.current.length}`;
    if (flow.ended || showing.current || settling.current === answer || p.count === undefined) return;
    flow.touch();
    if (given.current.length === p.count) {
      flow.done();
      return;
    }
    setNumbered(true);
    settling.current = answer;
    later(() => {
      if (settling.current === answer) settling.current = null;
    }, SETTLE_MS);
    if (flow.miss('round', answer) === 'show') {
      showing.current = true;
      later(() => setGiven(p.items.slice(0, p.count).map((i) => i.id)), SHOW_MS);
      later(() => flow.done(), SHOW_MS + 900);
    }
  };

  const size = Math.round(Math.min((w - 200) / Math.min(p.items.length, 6) - 34, h * 0.17, 130));
  const targetSize = Math.round(Math.min(h * 0.36, 280));
  const item = (id: string) => p.items.find((i) => i.id === id);
  return (
    <div className="stage">
      <div className="tray">
        {p.items.filter((i) => !given.current.includes(i.id)).map((it) => (
          <button key={it.id} type="button" aria-label={it.label} {...dnd.itemProps(it.id, !flow.ended)}>
            <span className={`option ${cueClass(flow.cue, it.id)}`} style={{ width: size + 18, height: size + 18 }}>
              <ItemView item={it} size={size} />
            </span>
          </button>
        ))}
      </div>
      <div className="row">
        <div className={`drop ${cueClass(flow.cue, TARGET)}`} {...dnd.targetProps(TARGET)} role="button" aria-label={fillNames(p.target.label, names)} style={{ flexDirection: 'row', gap: 16 }}>
          {p.target.asset
            ? <><Buddy key={buddy.beat} {...look} move={buddyMove} expression={buddyMove === 'yum' ? 'happy' : 'neutral'} size={targetSize * 0.8} /><Picture asset={p.target.asset} label="" size={targetSize * 0.7} /></>
            : <Buddy key={buddy.beat} {...look} move={buddyMove} expression={buddyMove === 'yum' ? 'happy' : 'neutral'} size={targetSize} />}
          <div className="drop__inside" style={{ maxWidth: 220 }}>
            {given.current.map((id, i) => {
              const it = item(id);
              return it && (
                <button key={id} type="button" className={`option ${cueClass(flow.cue, id)}`} style={{ padding: 4, position: 'relative' }} aria-label={it.label} onClick={() => takeBack(id)}>
                  {numbered && <span className="badge">{i + 1}</span>}
                  <ItemView item={it} size={56} />
                </button>
              );
            })}
          </div>
        </div>
        {counting && given.current.length > 0 && (
          <button type="button" className="done-button" aria-label="Done" onClick={check}>
            <img src={artUrl('ui/done.svg')} alt="" />
          </button>
        )}
      </div>
    </div>
  );
}
