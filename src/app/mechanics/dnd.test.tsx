// src/app/mechanics/dnd.test.tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dropTargetAt, useDnd } from './dnd';

function Board({ onDrop }: { onDrop: (item: string, target: string) => void }) {
  const dnd = useDnd({ onDrop });
  return (
    <div>
      <button type="button" {...dnd.itemProps('apple')}>apple</button>
      <div {...dnd.targetProps('basket')}>basket</div>
    </div>
  );
}

afterEach(() => {
  delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
});

describe('useDnd', () => {
  it('a drag follows the finger and drops on the target under it', () => {
    const onDrop = vi.fn();
    render(<Board onDrop={onDrop} />);
    const item = screen.getByText('apple');
    document.elementsFromPoint = () => [screen.getByText('basket')];
    fireEvent.pointerDown(item, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(item, { pointerId: 1, clientX: 60, clientY: 90 });
    expect(item.style.transform).toContain('translate(50px, 80px)');
    expect(item.className).toContain('is-dragging');
    fireEvent.pointerUp(item, { pointerId: 1, clientX: 60, clientY: 90 });
    expect(onDrop).toHaveBeenCalledWith('apple', 'basket');
    expect(item.style.transform).toBe(''); // glides back to its place; the mechanic moves it if the drop was right
    fireEvent.click(item); // the click that ends a drag is not a tap
    expect(item.className).not.toContain('is-selected');
  });

  it('a tiny wobble is a tap, not a drag; let go over nothing and nothing is dropped', () => {
    const onDrop = vi.fn();
    render(<Board onDrop={onDrop} />);
    const item = screen.getByText('apple');
    document.elementsFromPoint = () => [];
    fireEvent.pointerDown(item, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(item, { pointerId: 1, clientX: 14, clientY: 12 });
    expect(item.className).not.toContain('is-dragging');
    fireEvent.pointerMove(item, { pointerId: 1, clientX: 200, clientY: 10 });
    fireEvent.pointerUp(item, { pointerId: 1, clientX: 200, clientY: 10 });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('tap the item, then the target (a second tap on the item puts it down)', () => {
    const onDrop = vi.fn();
    render(<Board onDrop={onDrop} />);
    const item = screen.getByText('apple');
    fireEvent.click(item);
    expect(item.className).toContain('is-selected');
    fireEvent.click(item);
    expect(item.className).not.toContain('is-selected');
    fireEvent.click(screen.getByText('basket'));
    expect(onDrop).not.toHaveBeenCalled();
    fireEvent.click(item);
    fireEvent.click(screen.getByText('basket'));
    expect(onDrop).toHaveBeenCalledWith('apple', 'basket');
  });

  it('finds the nearest marked target under a point', () => {
    render(<div data-drop-id="bin"><span>inside</span></div>);
    document.elementsFromPoint = () => [screen.getByText('inside')];
    expect(dropTargetAt(5, 5)).toBe('bin');
  });
});
