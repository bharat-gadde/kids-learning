// src/app/mechanics/dnd.test.tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dropTargetAt, useDnd } from './dnd';

interface BoardProps {
  onDrop: (item: string, target: string) => void;
  onPick?: (item: string) => void;
  enabled?: boolean;
  items?: readonly string[];
}

function Board({ onDrop, onPick, enabled, items = ['apple', 'pear'] }: BoardProps) {
  const dnd = useDnd({ onDrop, onPick });
  return (
    <div>
      {items.map((id) => <button key={id} type="button" {...dnd.itemProps(id, enabled)}>{id}</button>)}
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
    fireEvent.click(screen.getByText('pear'));
    document.elementsFromPoint = () => [screen.getByText('basket')];
    fireEvent.pointerDown(item, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(item, { pointerId: 1, clientX: 60, clientY: 90 });
    expect(item.style.transform).toContain('translate(50px, 80px)');
    expect(item.className).toContain('is-dragging');
    expect(screen.getByText('pear').className).not.toContain('is-selected'); // a drag puts down what a tap picked
    fireEvent.pointerUp(item, { pointerId: 1, clientX: 60, clientY: 90 });
    expect(onDrop).toHaveBeenCalledWith('apple', 'basket');
    expect(item.style.transform).toBe(''); // glides back to its place; the mechanic moves it if the drop was right
    expect(item.className).not.toContain('is-dragging'); // and takes taps again
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
    fireEvent.click(screen.getByText('basket')); // put down: a second tap on a target drops nothing
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it('a tap picks the item once; a click with no press before it (the keyboard) picks it too', () => {
    const onPick = vi.fn();
    render(<Board onDrop={vi.fn()} onPick={onPick} />);
    const item = screen.getByText('apple');
    fireEvent.pointerDown(item, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(item, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.click(item);
    expect(onPick).toHaveBeenCalledTimes(1); // matching words says the name once, not cut off and started again
    expect(item.className).toContain('is-selected');
    fireEvent.click(item);
    expect(onPick).toHaveBeenCalledTimes(2);
  });

  it('a second finger or a palm while an item is dragged changes nothing, and no lift leaves an item stuck', () => {
    const onDrop = vi.fn();
    const onPick = vi.fn();
    render(<Board onDrop={onDrop} onPick={onPick} />);
    const apple = screen.getByText('apple');
    const pear = screen.getByText('pear');
    document.elementsFromPoint = () => [screen.getByText('basket')];
    fireEvent.pointerDown(apple, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(apple, { pointerId: 1, clientX: 60, clientY: 90 });
    fireEvent.pointerDown(pear, { pointerId: 2, clientX: 300, clientY: 10 });
    fireEvent.pointerMove(pear, { pointerId: 2, clientX: 350, clientY: 90 });
    expect(apple.style.transform).toContain('translate(50px, 80px)');
    fireEvent.pointerUp(pear, { pointerId: 2, clientX: 350, clientY: 90 });
    expect(pear.className).not.toContain('is-dragging');
    expect(onPick).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(apple, { pointerId: 1, clientX: 80, clientY: 120 });
    expect(apple.style.transform).toContain('translate(70px, 110px)');
    fireEvent.pointerUp(apple, { pointerId: 1, clientX: 80, clientY: 120 });
    expect(onDrop.mock.calls).toEqual([['apple', 'basket']]);
    expect(apple.className).not.toContain('is-dragging');
    expect(apple.style.transform).toBe('');
  });

  it('a press takes over from a finger resting on another item, or from a drag whose item went (Buddy put it in)', () => {
    const onDrop = vi.fn();
    const { rerender } = render(<Board onDrop={onDrop} />);
    document.elementsFromPoint = () => [screen.getByText('basket')];
    const apple = screen.getByText('apple');
    const pear = screen.getByText('pear');
    fireEvent.pointerDown(apple, { pointerId: 1, clientX: 10, clientY: 10 }); // resting, not moving
    fireEvent.pointerDown(pear, { pointerId: 2, clientX: 300, clientY: 10 });
    fireEvent.pointerMove(pear, { pointerId: 2, clientX: 350, clientY: 90 });
    fireEvent.pointerUp(apple, { pointerId: 1, clientX: 10, clientY: 10 }); // the resting finger lifts first
    fireEvent.pointerUp(pear, { pointerId: 2, clientX: 350, clientY: 90 });
    expect(onDrop.mock.calls).toEqual([['pear', 'basket']]);
    expect(pear.className).not.toContain('is-dragging');
    fireEvent.pointerDown(apple, { pointerId: 3, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(apple, { pointerId: 3, clientX: 60, clientY: 90 });
    rerender(<Board onDrop={onDrop} items={['pear']} />); // apple goes mid-drag
    fireEvent.pointerDown(pear, { pointerId: 4, clientX: 300, clientY: 10 });
    fireEvent.pointerMove(pear, { pointerId: 4, clientX: 350, clientY: 90 });
    fireEvent.pointerUp(pear, { pointerId: 4, clientX: 350, clientY: 90 });
    expect(onDrop.mock.calls).toEqual([['pear', 'basket'], ['pear', 'basket']]);
  });

  it('a cancelled drag (the tablet took the touch) goes back and drops nothing', () => {
    const onDrop = vi.fn();
    render(<Board onDrop={onDrop} />);
    const item = screen.getByText('apple');
    document.elementsFromPoint = () => [screen.getByText('basket')];
    fireEvent.pointerDown(item, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(item, { pointerId: 1, clientX: 60, clientY: 90 });
    fireEvent.pointerCancel(item, { pointerId: 1, clientX: 60, clientY: 90 });
    expect(onDrop).not.toHaveBeenCalled();
    expect(item.className).not.toContain('is-dragging');
    expect(item.style.transform).toBe('');
  });

  it("an item that is not enabled cannot be picked, dragged or tapped, and a mouse's other buttons do not drag", () => {
    const onDrop = vi.fn();
    const onPick = vi.fn();
    const { rerender } = render(<Board onDrop={onDrop} onPick={onPick} enabled={false} />);
    const item = screen.getByText('apple');
    document.elementsFromPoint = () => [screen.getByText('basket')];
    fireEvent.pointerDown(item, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(item, { pointerId: 1, clientX: 60, clientY: 90 });
    expect(item.className).not.toContain('is-dragging');
    fireEvent.pointerUp(item, { pointerId: 1, clientX: 60, clientY: 90 });
    fireEvent.click(item);
    fireEvent.click(screen.getByText('basket'));
    expect(item.className).not.toContain('is-selected');
    expect(onPick).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
    rerender(<Board onDrop={onDrop} onPick={onPick} />);
    fireEvent.pointerDown(item, { pointerId: 2, button: 2, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(item, { pointerId: 2, clientX: 60, clientY: 90 });
    expect(item.className).not.toContain('is-dragging');
  });

  it('finds the nearest marked target under a point', () => {
    render(<div data-drop-id="bin"><span>inside</span></div>);
    document.elementsFromPoint = () => [screen.getByText('inside')];
    expect(dropTargetAt(5, 5)).toBe('bin');
  });
});
