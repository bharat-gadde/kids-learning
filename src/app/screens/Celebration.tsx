// src/app/screens/Celebration.tsx
import { useEffect, useRef, useState } from 'react';
import type { Sticker } from '../../engine/progress/types';
import { UI_LINES } from '../audio/uiLines';
import { ACTIONS, Buddy, DANCES, type ActionId, type BuddyMove, type DanceId } from '../buddy/Buddy';
import type { BuddyLook } from '../mechanics/types';
import type { Services } from '../services';
import { artUrl } from '../ui/art';
import { useLater, useViewport } from '../ui/hooks';
import { Picture } from '../ui/Picture';
import './celebration.css';

type Phase = 'party' | 'sticker' | 'dance' | 'demo' | 'your-turn' | 'cheer';

/** Spec §4.5: each dance has an 8-second loop. */
export const DANCE_MS = 8000;
export const PARTY_MS = 1600;
export const STICKER_MS = 1600;
export const DEMO_MS = 1800;
export const YOUR_TURN_MS = 6000;
export const CHEER_MS = 6000;

/**
 * Spec §4.5: after a finished set — confetti and a cheer, the sticker flies to the book, Buddy dances to its 8-second
 * loop (a tap moves on). When `yourTurn`, Buddy then shows an action and asks the child to copy it (1… 2… 3!), cheers
 * whatever happened, and offers "Again?" once; tapping Buddy skips it. There is no camera: nothing is judged.
 */
export function Celebration({ services, look, sticker, dances, yourTurn, onDone }: {
  services: Pick<Services, 'speaker' | 'sfx' | 'music' | 'random'>;
  look: BuddyLook;
  sticker: Pick<Sticker, 'pictureId' | 'shiny'>;
  dances: readonly string[];
  yourTurn: boolean;
  onDone: () => void;
}) {
  const later = useLater();
  const { h } = useViewport();
  const [phase, setPhase] = useState<Phase>('party');
  const [againUsed, setAgainUsed] = useState(false);
  const step = useRef(0);
  const finished = useRef(false);
  const [{ dance, action }] = useState(() => {
    const known = dances.filter((d): d is DanceId => (DANCES as readonly string[]).includes(d));
    const pool = known.length > 0 ? known : [...DANCES];
    return {
      dance: pool[Math.floor(services.random() * pool.length)] as DanceId,
      action: ACTIONS[Math.floor(services.random() * ACTIONS.length)] as ActionId,
    };
  });

  /** Enter a phase; anything scheduled for an earlier phase is dropped. */
  const go = (next: Phase) => {
    step.current += 1;
    setPhase(next);
  };
  const at = (ms: number, fn: () => void) => {
    const mine = step.current;
    later(() => {
      if (step.current === mine) fn();
    }, ms);
  };
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    step.current += 1;
    services.music.stop();
    onDone();
  };
  const yourTurnNow = (offerAgain: boolean) => {
    go('demo');
    at(DEMO_MS, () => {
      go('your-turn');
      services.speaker.say(UI_LINES.yourTurn);
      at(YOUR_TURN_MS, () => {
        go('cheer');
        services.sfx.chime();
        const cheer = services.speaker.say(UI_LINES.yourTurnCheer);
        // "Again?" is the offer: asked as its button appears, once the cheer has been heard — nothing if the child moved on
        if (offerAgain) {
          const mine = step.current;
          void cheer.done.then(() => {
            if (step.current === mine) services.speaker.say(UI_LINES.yourTurnAgain);
          });
        }
        at(CHEER_MS, finish);
      });
    });
  };
  const afterDance = () => {
    services.music.stop();
    if (yourTurn) yourTurnNow(true);
    else finish();
  };

  useEffect(() => {
    services.sfx.sparkle();
    services.speaker.say(UI_LINES.setDone);
    at(PARTY_MS, () => {
      go('sticker');
      services.sfx.whoosh();
      at(STICKER_MS, () => {
        go('dance');
        services.music.play(dance);
        at(DANCE_MS, afterDance);
      });
    });
    return () => {
      step.current += 1; // gone: the "Again?" offer waiting on the cheer is dropped too
      services.music.stop();
    };
    // once, on arrival
  }, []);

  const tapBuddy = () => {
    if (phase === 'dance') afterDance();
    // not while Buddy shows the move: the second tap of a double tap that ended the dance must not skip "your turn"
    else if (phase === 'your-turn' || phase === 'cheer') finish();
  };
  const again = () => {
    setAgainUsed(true);
    yourTurnNow(false);
  };

  const move: BuddyMove = phase === 'dance' ? dance : phase === 'demo' ? action : phase === 'cheer' || phase === 'party' ? 'cheer' : 'idle';
  return (
    <div className="celebration screen" onClick={phase === 'dance' ? afterDance : undefined}>
      {phase === 'party' && (
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 36 }, (_, i) => (
            <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 0.07}s`, background: ['#ea5a47', '#fcea2b', '#61b2e4', '#b1cc33', '#f4aa41', '#b399c8'][i % 6] }} />
          ))}
        </div>
      )}
      <span className="icon-button celebration__book" aria-hidden="true"><img src={artUrl('ui/stickers.svg')} alt="" /></span>
      <div className={`celebration__sticker ${phase === 'party' ? '' : 'is-flying'} ${sticker.shiny ? 'is-shiny' : ''}`}>
        <Picture asset={sticker.pictureId} label="your sticker" size={Math.round(Math.min(140, h * 0.17))} />
      </div>
      <button type="button" className="celebration__buddy" aria-label="Buddy" onClick={(e) => { e.stopPropagation(); tapBuddy(); }}>
        <Buddy {...look} move={move} expression={phase === 'your-turn' ? 'neutral' : 'happy'} size={Math.min(h * 0.62, 460)} />
      </button>
      {phase === 'your-turn' && <div className="celebration__count" aria-hidden="true"><b>1</b><b>2</b><b>3</b></div>}
      {phase === 'cheer' && !againUsed && (
        <button type="button" className="icon-button celebration__again" aria-label="Again" onClick={(e) => { e.stopPropagation(); again(); }}>
          <img src={artUrl('ui/again.svg')} alt="" />
        </button>
      )}
    </div>
  );
}
