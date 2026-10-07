// src/app/ui/ui.test.tsx
// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLater } from './hooks';
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

  it('follows a project site’s base path (GitHub Pages serves under /<repo>/)', () => {
    vi.stubEnv('BASE_URL', '/buddy/');
    try {
      render(<Picture asset="objects/apple.svg" label="apple" size={100} />);
      expect(screen.getByAltText('apple').getAttribute('src')).toBe('/buddy/art/objects/apple.svg');
    } finally {
      vi.unstubAllEnvs();
    }
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

  it('tries a new picture on the same instance (a vignette’s friend changes face)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(<Picture asset="parts/face-gone.svg" label="your friend" size={80} />);
    fireEvent.error(screen.getByAltText('your friend'));
    rerender(<Picture asset="parts/face-happy.svg" label="your friend" size={80} />);
    expect(screen.getByAltText('your friend').getAttribute('src')).toBe('/art/parts/face-happy.svg');
    warn.mockRestore();
  });
});

describe('ItemView', () => {
  it('draws a counted group as that many copies, in rows that are easy to count', () => {
    render(<ItemView item={{ id: 'applex5', label: '5 apples', lineId: 'obj.apple', asset: 'objects/apple.svg', count: 5 }} size={150} />);
    expect(screen.getByRole('img', { name: '5 apples' }).querySelectorAll('img')).toHaveLength(5);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(groupColumns)).toEqual([1, 2, 3, 2, 3, 3, 4, 4, 3, 4]);
  });

  it('fits a group to its box: square by default, or as wide and tall as the caller gives', () => {
    const ten = { id: 'applex10', label: '10 apples', lineId: 'obj.apple', asset: 'objects/apple.svg', count: 10 };
    const each = () => (screen.getByRole('img', { name: '10 apples' }).querySelector('img') as HTMLImageElement).style.width;
    const { unmount } = render(<ItemView item={ten} size={150} />);
    expect(each()).toBe('33px'); // 4 columns × 3 rows in 150 × 150: floor(150 / 4) − 4, as before `height`
    unmount();
    render(<ItemView item={ten} size={200} height={120} />);
    expect(each()).toBe('36px'); // in 200 × 120 the 3 rows bind: floor(120 / 3) − 4
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
    const button = screen.getByLabelText('Hear it again');
    fireEvent.click(button);
    expect(replay).toHaveBeenCalledOnce();
    expect(button.nextElementSibling).toBe(screen.getByText('Tap the letter b')); // immediately to its left (spec §4.4)
  });

  it('fills one dot per round played, whatever its outcome', () => {
    const { container } = render(<ProgressDots total={6} done={2} />);
    expect(container.querySelectorAll('.is-done')).toHaveLength(2);
    expect(container.querySelectorAll('.progress-dots__dot')).toHaveLength(6);
  });

  it('tilts a card a little, the same way every time', () => {
    expect(tiltFor('apple')).toBe(tiltFor('apple'));
    expect(tiltFor('apple')).toMatch(/^-?[0-2]deg$/);
  });
});

describe('useLater', () => {
  it('drops what it scheduled when the component goes (the child left mid-round)', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const { result, unmount } = renderHook(() => useLater());
      act(() => result.current(fn, 1000));
      unmount();
      vi.advanceTimersByTime(2000);
      expect(fn).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
