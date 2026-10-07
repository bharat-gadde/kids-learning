// src/app/mechanics/DragToMatch.tsx
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cueClass, SHOW_MS, useRoundFlow } from '../game/useRoundFlow';
import { useLater, useViewport } from '../ui/hooks';
import { ItemView } from '../ui/ItemView';
import { tiltFor } from '../ui/tilt';
import { DRAG_PX, dropTargetAt } from './dnd';
import type { MechanicProps } from './types';
import './mechanics.css';

interface Line { x1: number; y1: number; x2: number; y2: number }

/**
 * Spec §6 #7: two columns, 2–4 pairs. Drag from an item to its partner (either side) and a line is drawn, which stays;
 * or tap one, then the other. A wrong partner gives a hint (the right one glows); a second miss from the same item and
 * Buddy draws its line. Matching words (rhymes, letters) says each picture's name as it is picked up.
 */
export function DragToMatch({ round, deps, onEnd, onReact, quiet }: MechanicProps) {
  const p = round.payload;
  if (p.kind !== 'pairs') throw new Error(`drag-to-match cannot play a ${p.kind} round`);
  const later = useLater();
  const { w, h } = useViewport();
  const matched = useRef<readonly string[]>([]); // left ids
  // a pair Buddy is showing waits for him to draw its line (no third miss, no race with his hand); the others stay free
  const showing = useRef<readonly string[]>([]); // left ids
  const [, redraw] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [band, setBand] = useState<Line | null>(null);
  const [lines, setLines] = useState<readonly Line[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const drag = useRef<{ id: string; pointerId: number; x0: number; y0: number; moved: boolean } | null>(null);
  // how the last press went: the click that follows it is that same press, its word said (a drag is no tap)
  const press = useRef<'tap' | 'drag' | null>(null);

  const isLeft = (id: string) => p.left.some((i) => i.id === id);
  const partner = (id: string) => {
    const pair = p.pairs.find(([a, b]) => a === id || b === id);
    return pair ? (pair[0] === id ? pair[1] : pair[0]) : '';
  };
  const leftOf = (id: string) => (isLeft(id) ? id : partner(id));
  const done = (id: string) => matched.current.includes(leftOf(id));
  // matched, or about to be drawn by Buddy: neither end takes a press or a line
  const busy = (id: string) => done(id) || showing.current.includes(leftOf(id));
  const speaksNames = p.left.every((i) => i.count === undefined);
  const firstOpen = p.left.find((i) => !matched.current.includes(i.id));
  const flow = useRoundFlow({
    deps, onEnd, onReact, quiet,
    targets: (key) => (key === null ? (firstOpen ? [firstOpen.id, partner(firstOpen.id)] : []) : [partner(key)]),
  });

  const match = (leftId: string) => {
    if (matched.current.includes(leftId)) return;
    matched.current = [...matched.current, leftId];
    redraw((n) => n + 1);
    if (matched.current.length === p.pairs.length) flow.done();
    else flow.step();
  };

  const connect = (from: string, to: string) => {
    if (flow.ended || busy(from) || busy(to) || isLeft(from) === isLeft(to)) return;
    flow.touch();
    if (partner(from) === to) match(leftOf(from));
    else if (flow.miss(from, `${from}>${to}`) === 'show') {
      showing.current = [...showing.current, leftOf(from)];
      redraw((n) => n + 1);
      later(() => match(leftOf(from)), SHOW_MS);
    }
  };

  const centre = (id: string, side: 'left' | 'right'): { x: number; y: number } | null => {
    const el = els.current.get(id);
    const origin = box.current?.getBoundingClientRect();
    if (!el || !origin) return null;
    const r = el.getBoundingClientRect();
    return { x: (side === 'left' ? r.right : r.left) - origin.left, y: r.top + r.height / 2 - origin.top };
  };

  // the matched pairs' lines, measured after every render (a match, a resize); state changes only when they move
  useLayoutEffect(() => {
    const next = matched.current.flatMap((l) => {
      const a = centre(l, 'left');
      const b = centre(partner(l), 'right');
      return a && b ? [{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }] : [];
    });
    setLines((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  });

  const pick = (id: string, wordToo: boolean) => {
    flow.touch();
    if (wordToo && speaksNames) void deps.speaker.word((p.left.find((i) => i.id === id) ?? p.right.find((i) => i.id === id))?.lineId ?? '');
  };

  // a press ends with its own pointer: another finger or a palm lifting leaves it alone
  const release = (e: ReactPointerEvent<HTMLElement>, drop: boolean) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return; // another finger's: this press goes on
    drag.current = null;
    setBand(null);
    if (!d.moved) return;
    press.current = 'drag';
    const target = drop ? dropTargetAt(e.clientX, e.clientY) : null;
    if (target && target !== d.id) connect(d.id, target);
  };

  const pointer = (id: string) => ({
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (flow.ended || busy(id) || e.button !== 0) return; // a finger, a pen, a mouse's main button
      if (drag.current?.moved) return; // a palm or another finger while a line is drawn: the drag goes on
      e.currentTarget.setPointerCapture?.(e.pointerId);
      drag.current = { id, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
      press.current = 'tap';
      pick(id, true);
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      const d = drag.current;
      const origin = box.current?.getBoundingClientRect();
      if (!d || d.pointerId !== e.pointerId || !origin) return;
      if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_PX) return; // a tiny wobble is a tap
      const from = centre(d.id, isLeft(d.id) ? 'left' : 'right');
      if (!from) return;
      if (!d.moved) setSelected(null); // a drag puts down what a tap picked
      d.moved = true;
      setBand({ x1: from.x, y1: from.y, x2: e.clientX - origin.left, y2: e.clientY - origin.top });
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => release(e, true),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => release(e, false),
    onClick() {
      const pressed = press.current;
      press.current = null;
      if (pressed === 'drag' || flow.ended || busy(id)) return;
      if (selected && isLeft(selected) !== isLeft(id)) {
        setSelected(null);
        connect(selected, id);
        return;
      }
      if (pressed === null) pick(id, true); // a click with no press before it: the keyboard, tests
      setSelected((s) => (s === id ? null : id));
    },
  });

  const rows = Math.max(p.left.length, p.right.length);
  const size = Math.round(Math.max(48, Math.min((h - 220) / rows - 30, w * 0.16, 150)));
  const column = (items: typeof p.left, side: 'left' | 'right') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: side === 'left' ? 'flex-end' : 'flex-start' }}>
      {items.map((item) => (
        <button
          key={item.id}
          ref={(el) => { if (el) els.current.set(item.id, el); else els.current.delete(item.id); }}
          type="button"
          data-drop-id={item.id}
          aria-label={item.label}
          aria-pressed={done(item.id)}
          className={`option draggable ${cueClass(flow.cue, item.id)} ${done(item.id) ? 'is-right' : ''} ${selected === item.id ? 'is-selected' : ''}`}
          style={{ width: size + 24, height: size + 24, rotate: tiltFor(item.id), touchAction: 'none' }}
          {...pointer(item.id)}
        >
          <ItemView item={item} size={size} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="stage">
      <div ref={box} style={{ position: 'relative', display: 'flex', gap: 'clamp(90px, 22vw, 320px)' }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
          {lines.map((l, i) => <line key={i} {...l} stroke="#5c9e31" strokeWidth={8} strokeLinecap="round" />)}
          {band && <line {...band} stroke="#3d2f27" strokeWidth={6} strokeDasharray="2 14" strokeLinecap="round" />}
        </svg>
        {column(p.left, 'left')}
        {column(p.right, 'right')}
      </div>
    </div>
  );
}
