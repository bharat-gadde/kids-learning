// src/app/mechanics/Mechanic.tsx
import type { MechanicId } from '../../engine/content/schema';
import { DragToMatch } from './DragToMatch';
import { GiveToBuddy } from './GiveToBuddy';
import { SceneThenChoose } from './SceneThenChoose';
import { Sequence } from './Sequence';
import { SortIntoBins } from './SortIntoBins';
import { TapAll } from './TapAll';
import { TapTheOne } from './TapTheOne';
import type { MechanicProps } from './types';

/** The M1 mechanics (spec §15) by id; scrub and dress-buddy come with Buddy's Home (Plan 1C). */
const MECHANICS: Partial<Record<MechanicId, (props: MechanicProps) => React.JSX.Element>> = {
  'tap-the-one': TapTheOne,
  'tap-all-that-match': TapAll,
  'sort-into-bins': SortIntoBins,
  'drag-to-match': DragToMatch,
  'give-to-buddy': GiveToBuddy,
  'sequence': Sequence,
  'scene-then-choose': SceneThenChoose,
};

export const isPlayable = (mechanic: MechanicId): boolean => mechanic in MECHANICS;

/** The round's mechanic. One that is not built yet throws, and the game's error boundary ends the set gracefully. */
export function Mechanic(props: MechanicProps) {
  const Component = MECHANICS[props.round.mechanic];
  if (!Component) throw new Error(`mechanic ${props.round.mechanic} is not built yet`);
  return <Component {...props} />;
}
