// src/app/ui/ui.test.tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { groupColumns, ItemView } from './ItemView';
import { Picture } from './Picture';
import { ProgressDots } from './ProgressDots';
import { PromptBar } from './PromptBar';
import { tiltFor } from './tilt';

describe('Picture', () => {
  it('loads a picture from the art folder under the base path', () => {
    render(<Picture asset="objects/apple.svg" label="apple" size={100} />);
    const img = screen.getByAltText('apple') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/art/objects/apple.svg');
    expect(img.style.width).toBe('100px');
  });

  it('draws a glyph as text (letters and numbers are never pictures)', () => {
    render(<Picture asset="glyph:b" label="b" size={100} />);
    expect(screen.getByRole('img', { name: 'b' }).textContent).toBe('b');
  });

  it('shows a plain stand-in for a missing picture, and says which, once (spec §13)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<><Picture asset="objects/gone.svg" label="gone" size={80} /><Picture asset="objects/gone.svg" label="gone again" size={80} /></>);
    fireEvent.error(screen.getByAltText('gone'));
    fireEvent.error(screen.getByAltText('gone again'));
    expect(screen.getByRole('img', { name: 'gone' }).className).toContain('picture--missing');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('ItemView', () => {
  it('draws a counted group as that many copies, in rows that are easy to count', () => {
    render(<ItemView item={{ id: 'applex5', label: '5 apples', lineId: 'obj.apple', asset: 'objects/apple.svg', count: 5 }} size={150} />);
    expect(screen.getByRole('img', { name: '5 apples' }).querySelectorAll('img')).toHaveLength(5);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 10].map(groupColumns)).toEqual([1, 2, 3, 2, 3, 3, 4, 4, 4]);
  });

  it('scales a size copy', () => {
    render(<ItemView item={{ id: 'apple@0', label: 'apple', lineId: 'obj.apple', asset: 'objects/apple.svg', scale: 0.5 }} size={200} />);
    expect((screen.getByAltText('apple') as HTMLImageElement).style.width).toBe('100px');
  });
});

describe('the prompt bar and progress dots', () => {
  it('replays the prompt from the 🔊 button beside the caption', () => {
    const replay = vi.fn();
    render(<PromptBar caption="Tap the letter b" onReplay={replay} />);
    fireEvent.click(screen.getByLabelText('Hear it again'));
    expect(replay).toHaveBeenCalledOnce();
    expect(screen.getByText('Tap the letter b')).toBeTruthy();
  });

  it('fills one dot per round played, whatever its outcome', () => {
    const { container } = render(<ProgressDots total={6} done={2} />);
    expect(container.querySelectorAll('.is-done')).toHaveLength(2);
    expect(container.querySelectorAll('.progress-dots__dot')).toHaveLength(6);
  });

  it('tilts a card a little, the same way every time', () => {
    expect(tiltFor('apple')).toBe(tiltFor('apple'));
    expect(tiltFor('apple')).toMatch(/^rotate\(-?[0-2]deg\)$/);
  });
});
