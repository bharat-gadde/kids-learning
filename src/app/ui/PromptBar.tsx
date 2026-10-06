// src/app/ui/PromptBar.tsx
import { artUrl } from './art';
import './promptBar.css';

/** Spec §4.4: the spoken prompt's caption, with the 🔊 button immediately to its left (it replays the line). */
export function PromptBar({ caption, onReplay }: { caption: string; onReplay: () => void }) {
  return (
    <div className="prompt-bar card">
      <button type="button" className="icon-button prompt-bar__replay" aria-label="Hear it again" onClick={onReplay}>
        <img src={artUrl('ui/speaker.svg')} alt="" />
      </button>
      <p className="prompt-bar__caption">{caption}</p>
    </div>
  );
}
