// src/app/screens/Setup.tsx
import { useState, type KeyboardEvent } from 'react';
import { ACCESSORIES, Buddy, BUDDY_COLOURS, type Accessory, type BuddyColour } from '../buddy/Buddy';
import { useViewport } from '../ui/hooks';
import './setup.css';

export interface NewChild {
  name: string;
  buddy: { colour: BuddyColour; name: string; accessory: Accessory };
}

/** Names to offer for Buddy, each spoken when tapped (spec §4.7: typed by the parent or chosen from spoken suggestions). */
export const NAME_IDEAS = ['Gajju', 'Appu', 'Motu', 'Bubbles', 'Coco', 'Peanut'] as const;

/** Return on the tablet's keyboard closes it: it must not submit the form before Buddy's colour, name and accessory are chosen. */
function closeKeyboardOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
  e.preventDefault();
  e.currentTarget.blur();
}

/**
 * For a grown-up (spec §4.7): the child's name, then Buddy's colour, name and accessory, with Buddy shown as chosen.
 * Buddy is called "Buddy" until named; the child's name is needed (lines greet the child by it).
 */
export function Setup({ onDone, onCancel, speakText }: { onDone: (child: NewChild) => void; onCancel?: () => void; speakText: (text: string) => void }) {
  const [name, setName] = useState('');
  const [colour, setColour] = useState<BuddyColour>('grey');
  const [buddyName, setBuddyName] = useState('');
  const [accessory, setAccessory] = useState<Accessory>('cap');
  const { h } = useViewport();
  const childName = name.trim();
  return (
    <div className="screen setup">
      <form
        className="setup__form card"
        onSubmit={(e) => {
          e.preventDefault();
          if (childName) onDone({ name: childName, buddy: { colour, name: buddyName.trim(), accessory } });
        }}
      >
        <h1>Set up Buddy</h1>
        <label className="setup__field">
          <span>Child's name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={24} required enterKeyHint="done" onKeyDown={closeKeyboardOnEnter} />
        </label>
        <fieldset className="setup__field">
          <legend>Buddy's colour</legend>
          <div className="setup__choices">
            {(Object.keys(BUDDY_COLOURS) as BuddyColour[]).map((c) => (
              <button key={c} type="button" className={`setup__swatch ${c === colour ? 'is-on' : ''}`} style={{ background: BUDDY_COLOURS[c].fill }} aria-label={c} aria-pressed={c === colour} onClick={() => setColour(c)} />
            ))}
          </div>
        </fieldset>
        <label className="setup__field">
          <span>Buddy's name</span>
          <input value={buddyName} onChange={(e) => setBuddyName(e.target.value)} placeholder="Buddy" autoComplete="off" maxLength={20} enterKeyHint="done" onKeyDown={closeKeyboardOnEnter} />
        </label>
        <div className="setup__choices">
          {NAME_IDEAS.map((idea) => (
            <button key={idea} type="button" className={`setup__chip ${idea === buddyName ? 'is-on' : ''}`} aria-pressed={idea === buddyName} onClick={() => { setBuddyName(idea); speakText(idea); }}>{idea}</button>
          ))}
        </div>
        <fieldset className="setup__field">
          <legend>Accessory</legend>
          <div className="setup__choices">
            {ACCESSORIES.map((a) => (
              <button key={a} type="button" className={`setup__chip ${a === accessory ? 'is-on' : ''}`} aria-pressed={a === accessory} onClick={() => setAccessory(a)}>{a}</button>
            ))}
          </div>
        </fieldset>
        <div className="setup__actions">
          {onCancel && <button type="button" className="setup__secondary" onClick={onCancel}>Cancel</button>}
          <button type="submit" className="setup__go" disabled={!childName}>Let's play!</button>
        </div>
        <p className="setup__tip">Tip: add Buddy to the home screen (in Safari: Share → Add to Home Screen). It then opens full screen, works offline, and the browser will not clear the child's progress.</p>
        <p className="setup__credits">
          Pictures: <a href="https://openmoji.org" target="_blank" rel="noreferrer">OpenMoji</a>, the open-source emoji project, some combined or redrawn for Buddy, and drawings in its style — <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>.
        </p>
      </form>
      <div className="setup__preview"><Buddy colour={colour} accessory={accessory} size={Math.min(h * 0.6, 420)} /></div>
    </div>
  );
}
