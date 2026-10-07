// src/app/testing/dom.ts
// Playing drag mechanics the tap way in tests (tap the item, then where it goes): jsdom has no layout to drag across.
import { fireEvent } from '@testing-library/react';

/** An item or target by its id (data-drag-id or data-drop-id). */
export const byId = (c: HTMLElement, id: string): HTMLElement | null =>
  c.querySelector(`[data-drag-id="${CSS.escape(id)}"], [data-drop-id="${CSS.escape(id)}"]`);

export const target = (c: HTMLElement, id: string): HTMLElement => {
  const el = c.querySelector<HTMLElement>(`[data-drop-id="${CSS.escape(id)}"]`);
  if (!el) throw new Error(`no target ${id}`);
  return el;
};

/** Tap an item, then a target. */
export function put(c: HTMLElement, itemId: string, targetId: string): void {
  const item = byId(c, itemId);
  if (!item) throw new Error(`no item ${itemId}`);
  fireEvent.click(item);
  fireEvent.click(target(c, targetId));
}
