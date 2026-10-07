// src/app/screens/StickerBook.tsx
import { useState } from 'react';
import type { ContentPack } from '../../engine/content/load';
import type { SubjectId } from '../../engine/content/schema';
import type { Sticker } from '../../engine/progress/types';
import { pageOf } from '../game/stickers';
import { artUrl } from '../ui/art';
import { IconButton } from '../ui/IconButton';
import { Picture } from '../ui/Picture';
import { ISLANDS } from './islands';
import './stickers.css';

/** Empty places shown on every page, so a page is never a bare "nothing here". */
const PAGE_SLOTS = 12;

/** Spec §4.6: the sticker book, one page per island (Home's page arrives with Home, Plan 1C). Nothing is ever removed. */
export function StickerBook({ pack, stickers, onBack }: { pack: ContentPack; stickers: readonly Sticker[]; onBack: () => void }) {
  const pages = Object.keys(ISLANDS) as SubjectId[];
  const [page, setPage] = useState<SubjectId>(() => {
    const latest = stickers.at(-1);
    const p = latest ? pageOf(pack, latest) : 'literacy';
    return p === 'home' ? 'literacy' : p;
  });
  const onPage = stickers.filter((s) => pageOf(pack, s) === page);
  return (
    <div className="screen book">
      <header className="book__bar">
        <IconButton icon="ui/back.svg" label="Back to the map" onClick={onBack} />
        <nav className="book__tabs">
          {pages.map((p) => (
            <button key={p} type="button" className={`book__tab ${p === page ? 'is-on' : ''}`} style={{ background: ISLANDS[p].colour }} aria-label={ISLANDS[p].title} aria-pressed={p === page} onClick={() => setPage(p)}>
              <img src={artUrl(ISLANDS[p].icon)} alt="" />
            </button>
          ))}
        </nav>
      </header>
      <div className="book__page card">
        {onPage.map((s, i) => (
          <span key={s.id ?? i} className={`book__sticker ${s.shiny ? 'is-shiny' : ''}`} style={{ transform: `rotate(${((i * 7) % 9) - 4}deg)` }}>
            <Picture asset={s.pictureId} label="sticker" size={92} />
          </span>
        ))}
        {Array.from({ length: Math.max(0, PAGE_SLOTS - onPage.length) }, (_, i) => <span key={`empty${i}`} className="book__sticker is-empty" />)}
      </div>
    </div>
  );
}
