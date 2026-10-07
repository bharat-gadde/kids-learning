// src/app/buddy/Buddy.tsx
import type { ReactElement } from 'react';
import './buddy.css';

/** Spec §4.7: six body colours to choose from; each is a fill and a shade. */
export const BUDDY_COLOURS = {
  grey: { fill: '#aebccb', shade: '#8f9fb1' },
  blue: { fill: '#94cdf2', shade: '#68acd9' },
  pink: { fill: '#f5adc5', shade: '#e386a6' },
  purple: { fill: '#c8ace6', shade: '#a487c9' },
  green: { fill: '#a3dbae', shade: '#74c085' },
  yellow: { fill: '#f6d87c', shade: '#e2b852' },
} as const;
export type BuddyColour = keyof typeof BUDDY_COLOURS;
export const isBuddyColour = (c: string): c is BuddyColour => Object.hasOwn(BUDDY_COLOURS, c);

/** Spec §4.7: one accessory. */
export const ACCESSORIES = ['bow', 'cap', 'scarf', 'glasses'] as const;
export type Accessory = (typeof ACCESSORIES)[number];
export const isAccessory = (a: string): a is Accessory => (ACCESSORIES as readonly string[]).includes(a);

/** M1's five expressions (spec §15), besides the resting face: what the feelings scenes need Buddy to act out. */
export const EXPRESSIONS = ['neutral', 'happy', 'thinking', 'sad', 'scared', 'angry'] as const;
export type BuddyExpression = (typeof EXPRESSIONS)[number];
export const isExpression = (e: string): e is BuddyExpression => (EXPRESSIONS as readonly string[]).includes(e);

/**
 * What Buddy is doing. idle loops (blink, breathe, trunk and ears); the dances loop until the move changes; the
 * rest play once. M1 has two dances and two actions (spec §15); cheer, hmm, point, wave, yum and yuck are reactions.
 */
export type BuddyMove =
  | 'idle' | 'cheer' | 'hmm' | 'point' | 'wave' | 'yum' | 'yuck'
  | 'trunk-twirl' | 'elephant-stomp'
  | 'jump' | 'clap';

export const DANCES = ['trunk-twirl', 'elephant-stomp'] as const;
export type DanceId = (typeof DANCES)[number];
export const ACTIONS = ['jump', 'clap'] as const;
export type ActionId = (typeof ACTIONS)[number];

export interface BuddyProps {
  colour: BuddyColour;
  accessory: Accessory;
  expression?: BuddyExpression;
  /** plays when it changes; to play the same move again, give <Buddy> a new `key` */
  move?: BuddyMove;
  /** rendered height in px; the width follows (5 : 6) */
  size?: number;
  className?: string;
  label?: string;
  onClick?: () => void;
}

const INK = '#3d2f27';

function Eyes({ expression }: { expression: BuddyExpression }) {
  if (expression === 'happy') {
    return (
      <g className="b-eyes" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round">
        <path d="M70 88q10-12 20 0M110 88q10-12 20 0" />
      </g>
    );
  }
  const r = expression === 'scared' ? 11 : 9;
  const look = expression === 'thinking' ? -4 : 0;
  return (
    <g className="b-eyes">
      {expression === 'scared' && <path d="M66 86a14 15 0 1 0 28 0a14 15 0 1 0-28 0M106 86a14 15 0 1 0 28 0a14 15 0 1 0-28 0" fill="#fff" stroke={INK} strokeWidth="2.5" />}
      <ellipse cx="80" cy={86 + look} rx={r * 0.8} ry={r} fill={INK} />
      <ellipse cx="120" cy={86 + look} rx={r * 0.8} ry={r} fill={INK} />
      <circle cx="83" cy={82 + look} r="2.8" fill="#fff" />
      <circle cx="123" cy={82 + look} r="2.8" fill="#fff" />
    </g>
  );
}

const BROWS: Record<BuddyExpression, string> = {
  neutral: 'M70 68q10-5 20 0M110 68q10-5 20 0',
  happy: 'M70 66q10-6 20 0M110 66q10-6 20 0',
  thinking: 'M70 70q10-2 20 0M110 62q10-6 20 0',
  sad: 'M70 70q12-2 20-8M130 70q-12-2-20-8',
  scared: 'M68 60q12-8 22-2M132 60q-12-8-22-2',
  angry: 'M70 64q12 2 20 10M130 64q-12 2-20 10',
};

const MOUTHS: Record<BuddyExpression, ReactElement> = {
  neutral: <path d="M72 124q8 8 16 2" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />,
  happy: <path d="M68 120q10 18 24 4z" fill="#b5413c" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />,
  thinking: <circle cx="80" cy="126" r="4" fill="none" stroke={INK} strokeWidth="3.5" />,
  sad: <path d="M70 130q10-10 20-2" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />,
  scared: <path d="M70 128q3-5 6 0t6 0t6 0" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />,
  angry: <path d="M70 129q10-6 20 0" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />,
};

function AccessoryPart({ accessory }: { accessory: Accessory }) {
  switch (accessory) {
    case 'bow':
      return (
        <g className="b-accessory b-accessory--bow" stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M126 44l-18-12v24zM126 44l18-12v24z" fill="#ea5a47" />
          <circle cx="126" cy="44" r="6" fill="#d22f27" />
        </g>
      );
    case 'cap':
      return (
        <g className="b-accessory b-accessory--cap" stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M60 52q4-36 40-36t40 36z" fill="#61b2e4" />
          <path d="M100 52h54q-2 9-16 9h-38z" fill="#1e50a0" />
          <circle cx="100" cy="17" r="5" fill="#fcea2b" />
        </g>
      );
    case 'scarf':
      return (
        <g className="b-accessory b-accessory--scarf" stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M62 142q38 16 76 0v12q-38 16-76 0z" fill="#ea5a47" />
          <path d="M120 150l6 30 14-4-6-28z" fill="#d22f27" />
          <path d="M70 146v12M84 150v12M98 151v12M112 150v12" stroke="#fcea2b" strokeWidth="3" />
        </g>
      );
    case 'glasses':
      return (
        <g className="b-accessory b-accessory--glasses" fill="rgba(255,255,255,.25)" stroke={INK} strokeWidth="3.5">
          <circle cx="80" cy="86" r="15" />
          <circle cx="120" cy="86" r="15" />
          <path d="M95 86h10M65 84l-12-4M135 84l12-4" fill="none" />
        </g>
      );
  }
}

/** Buddy, the baby elephant (spec §4.7): a layered SVG whose parts the moves in buddy.css animate. */
export function Buddy({ colour, accessory, expression = 'neutral', move = 'idle', size = 240, className = '', label = 'Buddy', onClick }: BuddyProps) {
  const { fill, shade } = BUDDY_COLOURS[colour];
  const body = { fill, stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' as const };
  return (
    <svg
      className={`buddy buddy--${move} buddy--${expression} ${className}`}
      viewBox="0 0 200 240"
      width={(size * 5) / 6}
      height={size}
      role="img"
      aria-label={label}
      onClick={onClick}
    >
      <g className="b-all">
        <g className="b-legs">
          <g className="b-leg b-leg--l">
            <path d="M68 196h26v30q0 8-8 8H76q-8 0-8-8z" {...body} />
            <path d="M74 230h4M82 230h4" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g className="b-leg b-leg--r">
            <path d="M106 196h26v30q0 8-8 8h-10q-8 0-8-8z" {...body} />
            <path d="M112 230h4M120 230h4" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
        <g className="b-arm b-arm--l"><path d="M62 150q-16 14-16 40a9 9 0 0 0 18 0q0-16 10-28z" {...body} /></g>
        <g className="b-arm b-arm--r"><path d="M138 150q16 14 16 40a9 9 0 0 1-18 0q0-16-10-28z" {...body} /></g>
        <g className="b-torso">
          <ellipse cx="100" cy="182" rx="42" ry="38" {...body} />
          <ellipse cx="100" cy="190" rx="26" ry="24" fill="#fff" opacity=".45" />
        </g>
        <g className="b-head">
          <g className="b-ear b-ear--l">
            <ellipse cx="46" cy="90" rx="34" ry="42" {...body} />
            <ellipse cx="50" cy="92" rx="22" ry="30" fill={shade} />
          </g>
          <g className="b-ear b-ear--r">
            <ellipse cx="154" cy="90" rx="34" ry="42" {...body} />
            <ellipse cx="150" cy="92" rx="22" ry="30" fill={shade} />
          </g>
          <circle cx="100" cy="92" r="54" {...body} />
          <circle cx="64" cy="110" r="9" fill="#f08a8a" opacity={expression === 'angry' ? 0.8 : 0.45} />
          <circle cx="136" cy="110" r="9" fill="#f08a8a" opacity={expression === 'angry' ? 0.8 : 0.45} />
          <path className="b-brows" d={BROWS[expression]} fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
          <Eyes expression={expression} />
          <g className="b-mouth">{MOUTHS[expression]}</g>
          <g className="b-trunk">
            <path d="M92 100q-4 30 6 50q8 14 22 8q8-4 6-12q-6 4-11 1q-6-4-7-18q-1-14 2-29z" {...body} />
            <path d="M96 118h10M97 130h10" stroke={shade} strokeWidth="3" strokeLinecap="round" />
          </g>
          {expression === 'sad' && <path className="b-tear" d="M131 102q7 10 0 16q-7-6 0-16z" fill="#61b2e4" stroke={INK} strokeWidth="2" />}
          <AccessoryPart accessory={accessory} />
        </g>
      </g>
    </svg>
  );
}
