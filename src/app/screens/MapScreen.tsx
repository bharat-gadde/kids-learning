// src/app/screens/MapScreen.tsx
import { useEffect, useRef, useState } from 'react';
import { UI_LINES } from '../audio/uiLines';
import { Buddy, type BuddyMove } from '../buddy/Buddy';
import { suggestNext, type PlayContext } from '../game/setRunner';
import type { BuddyLook } from '../mechanics/types';
import type { Services } from '../services';
import { artUrl } from '../ui/art';
import { useLater } from '../ui/hooks';
import { IconButton } from '../ui/IconButton';
import { Picture } from '../ui/Picture';
import { ISLANDS, islandSpots } from './islands';
import './map.css';

/**
 * Spec §4.3: five islands on one scrolling map, every spot open. Buddy points at a suggested spot — never on the
 * island or topic just played (spec §5.4 rule 6) — and says so; the child may tap any spot.
 */
export function MapScreen({ services, play, look, stickers, onPlay, onStickers }: {
  services: Services;
  play: PlayContext;
  look: BuddyLook;
  stickers: number;
  onPlay: (topicId: string) => void;
  onStickers: () => void;
}) {
  const later = useLater();
  const [suggested, setSuggested] = useState<string | null>(null);
  const [move, setMove] = useState<BuddyMove>('idle');
  const spots = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    let live = true;
    suggestNext(play).then((topicId) => {
      if (!live) return;
      setSuggested(topicId);
      spots.current.get(topicId)?.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      services.speaker.say(UI_LINES.suggest);
      setMove('point');
      later(() => setMove('idle'), 1800);
    }, (e: unknown) => console.error('no suggestion', e));
    return () => {
      live = false;
    };
  }, [later, play, services]);

  return (
    <div className="screen map">
      <div className="map__sea" role="list">
        {islandSpots(services.pack).map(({ subject, topics }) => {
          const island = ISLANDS[subject];
          return (
            <section key={subject} className="island" style={{ background: island.colour }} role="listitem" aria-label={island.title}>
              <header className="island__title">
                <img src={artUrl(island.icon)} alt="" />
                <span>{island.title}</span>
              </header>
              <div className="island__spots">
                {topics.map((t) => (
                  <button
                    key={t.id}
                    ref={(el) => { if (el) spots.current.set(t.id, el); }}
                    type="button"
                    className={`spot ${suggested === t.id ? 'is-suggested' : ''}`}
                    aria-label={t.title}
                    onClick={() => onPlay(t.id)}
                  >
                    {suggested === t.id && <img className="spot__arrow" src={artUrl('ui/point.svg')} alt="" />}
                    <Picture asset={t.asset ?? island.icon} label="" size={110} />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <div className="map__stickers">
        <IconButton icon="ui/stickers.svg" label="Sticker book" onClick={onStickers} />
        {stickers > 0 && <span className="map__count">{stickers}</span>}
      </div>
      <div className="map__buddy"><Buddy {...look} move={move} size={170} /></div>
    </div>
  );
}
