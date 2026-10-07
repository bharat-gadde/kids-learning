// src/app/mechanics/dnd.ts
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** The drop target under a point: the nearest element marked data-drop-id (the dragged item ignores the pointer). */
export function dropTargetAt(x: number, y: number): string | null {
  const els = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : [];
  for (const el of els) {
    const target = el.closest('[data-drop-id]');
    if (target) return target.getAttribute('data-drop-id');
  }
  return null;
}

/** A pointer that moves this far is a drag, not a tap. */
export const DRAG_PX = 10;

export interface Dnd {
  /** the item picked by a tap, waiting for a tap on a target */
  selected: string | null;
  itemProps(id: string, enabled?: boolean): {
    'data-drag-id': string;
    className: string;
    onPointerDown(e: ReactPointerEvent<HTMLElement>): void;
    onPointerMove(e: ReactPointerEvent<HTMLElement>): void;
    onPointerUp(e: ReactPointerEvent<HTMLElement>): void;
    onPointerCancel(e: ReactPointerEvent<HTMLElement>): void;
    onClick(): void;
  };
  targetProps(id: string): { 'data-drop-id': string; onClick(): void };
}

/**
 * Drag an item onto a target, or tap the item and then the target (spec §11: tap and drag only). While dragged the
 * item follows the finger; let go anywhere else and it glides back (draggable's transition in mechanics.css).
 */
export function useDnd(options: { onDrop: (itemId: string, targetId: string) => void; onPick?: (itemId: string) => void }): Dnd {
  const opts = useRef(options);
  opts.current = options;
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ id: string; el: HTMLElement; x0: number; y0: number; moved: boolean; pointerId: number } | null>(null);
  // how the last press on an item went: the click that follows it is that same press, already picked (a drag is no tap)
  const press = useRef<'tap' | 'drag' | null>(null);

  const release = (drop: boolean, e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return; // another finger's: this press goes on
    drag.current = null;
    const target = drop && d.moved ? dropTargetAt(e.clientX, e.clientY) : null; // while the item still ignores the pointer
    d.el.classList.remove('is-dragging');
    d.el.style.transform = '';
    if (!d.moved) return;
    press.current = 'drag';
    if (target) opts.current.onDrop(d.id, target);
  };

  return {
    selected,
    itemProps: (id, enabled = true) => ({
      'data-drag-id': id,
      className: `draggable${selected === id ? ' is-selected' : ''}`,
      onPointerDown(e) {
        if (!enabled || e.button !== 0) return; // a finger, a pen, a mouse's main button
        const d = drag.current;
        if (d?.moved && d.el.isConnected) return; // a palm or another finger while an item is dragged: the drag goes on
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { id, el: e.currentTarget, x0: e.clientX, y0: e.clientY, moved: false, pointerId: e.pointerId };
        press.current = 'tap';
        opts.current.onPick?.(id);
      },
      onPointerMove(e) {
        const d = drag.current;
        if (!d || d.pointerId !== e.pointerId) return;
        const dx = e.clientX - d.x0;
        const dy = e.clientY - d.y0;
        if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return;
        if (!d.moved) setSelected(null);
        d.moved = true;
        d.el.classList.add('is-dragging');
        d.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
      },
      onPointerUp: (e) => release(true, e),
      onPointerCancel: (e) => release(false, e),
      onClick() {
        const pressed = press.current;
        press.current = null;
        if (pressed === 'drag' || !enabled) return;
        if (pressed === null) opts.current.onPick?.(id); // a click with no press before it: the keyboard, tests
        setSelected((s) => (s === id ? null : id));
      },
    }),
    targetProps: (id) => ({
      'data-drop-id': id,
      onClick() {
        if (selected === null) return;
        setSelected(null);
        opts.current.onDrop(selected, id);
      },
    }),
  };
}
