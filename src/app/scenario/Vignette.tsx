// src/app/scenario/Vignette.tsx
import { Buddy, type BuddyExpression } from '../buddy/Buddy';
import type { BuddyLook } from '../mechanics/types';
import { Picture } from '../ui/Picture';
import { FRIEND_FACES, VIGNETTES, type FriendMood } from './vignettes';
import './vignette.css';

/** A vignette, full frame: Buddy with the given expression, the friend with the given mood. */
export function VignetteView({ vignette, look, buddy, friend, height }: { vignette: string; look: BuddyLook; buddy: BuddyExpression; friend?: FriendMood; height: number }) {
  const v = VIGNETTES[vignette];
  if (!v) throw new Error(`no vignette ${vignette}`);
  return (
    <div className={`vignette vignette--${v.backdrop} card`} style={{ height, width: height * 1.6 }}>
      {v.actors.map((a, i) => {
        const px = (height * a.size) / 100;
        const style = { left: `${a.x}%`, top: `${a.y}%`, height: px, animationDelay: `${a.delay ?? 0}s` };
        const anim = a.anim ? `vignette__actor--${a.anim}` : '';
        if (a.who === 'buddy') {
          return <div key={i} className={`vignette__actor ${anim}`} style={style}><Buddy {...look} expression={buddy} size={px} /></div>;
        }
        const asset = a.who === 'friend' ? FRIEND_FACES[friend ?? v.friend ?? 'happy'] : (a.asset as string);
        return <div key={i} className={`vignette__actor ${anim}`} style={style}><Picture asset={asset} label={a.who === 'friend' ? 'your friend' : ''} size={px} /></div>;
      })}
    </div>
  );
}
