// src/app/screens/Hello.tsx
import type { Profile } from '../../engine/progress/types';
import { Buddy, isAccessory, isBuddyColour, type BuddyExpression, type BuddyMove } from '../buddy/Buddy';
import type { BuddyLook } from '../mechanics/types';
import { artUrl } from '../ui/art';
import { IconButton } from '../ui/IconButton';
import './hello.css';

/** A profile's Buddy, falling back to grey and a cap if a stored value is unknown. */
export function lookOf(p: Profile): BuddyLook {
  return { colour: isBuddyColour(p.buddy.colour) ? p.buddy.colour : 'grey', accessory: isAccessory(p.buddy.accessory) ? p.buddy.accessory : 'cap' };
}

/**
 * Spec §4.1 Hello: one child, one big Buddy to tap (the tap that unlocks audio, spec §7); several, their Buddies side by
 * side, no reading needed. The small + is for a grown-up adding a child.
 */
export function Hello({ profiles, greeting, onStart, onAddChild }: {
  profiles: readonly Profile[];
  /** while Buddy greets the child who tapped */
  greeting: { profileId: string; move: BuddyMove; expression: BuddyExpression } | null;
  onStart: (profile: Profile) => void;
  onAddChild: () => void;
}) {
  const one = profiles.length === 1;
  return (
    <div className="screen hello">
      <div className="hello__buddies">
        {profiles.map((p) => {
          const greeted = greeting?.profileId === p.id;
          return (
            <button key={p.id} type="button" className="hello__buddy" aria-label={`${p.name}'s ${p.buddy.name || 'Buddy'}`} onClick={() => onStart(p)} disabled={greeting !== null}>
              <Buddy {...lookOf(p)} size={one ? Math.min(window.innerHeight * 0.62, 460) : Math.min(window.innerHeight * 0.42, 300)} move={greeted ? greeting.move : 'idle'} expression={greeted ? greeting.expression : 'neutral'} />
              <span className="hello__name">{p.name}</span>
              {one && !greeting && <img className="hello__tap" src={artUrl('ui/point.svg')} alt="" />}
            </button>
          );
        })}
      </div>
      <IconButton className="hello__add" icon="ui/add.svg" label="Add a child (grown-ups)" onClick={onAddChild} />
    </div>
  );
}
