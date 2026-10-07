// src/app/buddy/buddy.test.tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ACCESSORIES, Buddy, BUDDY_COLOURS, EXPRESSIONS, isAccessory, isBuddyColour, isExpression } from './Buddy';

describe('Buddy', () => {
  it('wears the chosen colour, and each expression and move is a class the stylesheet animates', () => {
    render(<Buddy colour="pink" accessory="bow" expression="sad" move="trunk-twirl" size={240} />);
    const svg = screen.getByRole('img', { name: 'Buddy' });
    expect(svg.getAttribute('class')).toContain('buddy--sad');
    expect(svg.getAttribute('class')).toContain('buddy--trunk-twirl');
    expect(svg.getAttribute('height')).toBe('240');
    expect(svg.innerHTML).toContain(BUDDY_COLOURS.pink.fill);
    expect(svg.querySelector('.b-tear')).not.toBeNull(); // only the sad face cries
  });

  it('draws every expression and accessory, and only the chosen accessory', () => {
    for (const expression of EXPRESSIONS) {
      for (const accessory of ACCESSORIES) {
        const { container, unmount } = render(<Buddy colour="grey" accessory={accessory} expression={expression} />);
        expect(container.querySelectorAll('.b-accessory')).toHaveLength(1);
        expect(container.querySelector(`.b-accessory--${accessory}`)).not.toBeNull();
        unmount();
      }
    }
  });

  it('can be tapped', () => {
    const tap = vi.fn();
    render(<Buddy colour="blue" accessory="cap" onClick={tap} />);
    fireEvent.click(screen.getByRole('img', { name: 'Buddy' }));
    expect(tap).toHaveBeenCalledOnce();
  });

  it('knows its colours, accessories and expressions by name', () => {
    expect([isBuddyColour('pink'), isBuddyColour('red'), isBuddyColour('toString'), isAccessory('cap'), isAccessory('crown'), isExpression('angry'), isExpression('sleepy')])
      .toEqual([true, false, false, true, false, true, false]);
  });
});
