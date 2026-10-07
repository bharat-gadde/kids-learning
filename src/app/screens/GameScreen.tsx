// src/app/screens/GameScreen.tsx
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { addSticker } from '../../engine/progress/db';
import type { Sticker } from '../../engine/progress/types';
import type { Names } from '../audio/speaker';
import { UI_LINES } from '../audio/uiLines';
import { Buddy, type BuddyExpression, type BuddyMove } from '../buddy/Buddy';
import { finishSet, prepareSet, recordRound, type PlayContext, type PlaySet, type RoundResult } from '../game/setRunner';
import { newSticker } from '../game/stickers';
import type { FlowEnd, Reaction } from '../game/useRoundFlow';
import { Mechanic } from '../mechanics/Mechanic';
import type { BuddyLook } from '../mechanics/types';
import { VIGNETTES } from '../scenario/vignettes';
import type { Services } from '../services';
import { artUrl } from '../ui/art';
import { useLater } from '../ui/hooks';
import { IconButton } from '../ui/IconButton';
import { ProgressDots } from '../ui/ProgressDots';
import { PromptBar } from '../ui/PromptBar';
import { Celebration } from './Celebration';
import './game.css';

/** Spec §13: an exception inside a mechanic ends the set gracefully and goes back to the Map (stickers kept). */
class MechanicBoundary extends Component<{ onError: (error: unknown) => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface GameProps {
  services: Services;
  play: PlayContext;
  look: BuddyLook;
  names: Names;
  topicId: string;
  /** the dances Buddy knows (Unlocks.dances) */
  dances: readonly string[];
  /** whether this set ends with "your turn" (spec §4.5: every 2nd–3rd set) */
  yourTurn: boolean;
  /** the Home button, or a failure: back to the Map; the set stays unfinished */
  onLeave: () => void;
  /** the set and its celebration are over */
  onFinished: () => void;
  quiet?: { first: number; every: number };
}

/** Pause after a round's feedback before the next round. */
export const NEXT_MS = 1600;
/**
 * The pause after a kindness scene answered kindly: its reaction ("That was kind! Look, your friend is smiling now",
 * about 4.2 s at the voice's 0.9 rate) is heard to the end while the friend smiles; the next narration would cut it.
 */
export const REACTION_NEXT_MS = 4500;
/** The longest the first prompt waits for the bridge line: a stalled clip or speech engine may never settle. */
export const BRIDGE_MAX_MS = 8000;

/**
 * One set (spec §4.4): the prompt bar with 🔊, progress dots, the Home button, Buddy in the corner, the round's
 * mechanic on the set's scene. Each round's attempt is recorded as it ends; a finished set records its result and
 * earns a sticker, then celebrates.
 */
export function GameScreen({ services, play, look, names, topicId, dances, yourTurn, onLeave, onFinished, quiet }: GameProps) {
  const later = useLater();
  const [set, setSet] = useState<PlaySet | null>(null);
  const [index, setIndex] = useState(0);
  // the first round's mechanic waits for its prompt: while the bridge line plays it is neither tappable nor timing a quiet spell
  const [begun, setBegun] = useState(false);
  const [caption, setCaption] = useState('');
  const [roundsDone, setRoundsDone] = useState(0);
  const [sticker, setSticker] = useState<Omit<Sticker, 'id'> | null>(null);
  // `beat` counts reactions: it keys Buddy, so the same move plays again, and only the latest one goes back to idle
  const [buddy, setBuddy] = useState<{ move: BuddyMove; expression: BuddyExpression; beat: number }>({ move: 'idle', expression: 'neutral', beat: 0 });
  const beat = useRef(0);
  const results = useRef<RoundResult[]>([]);
  const startedAt = useRef(0);

  const begin = (s: PlaySet, i: number) => {
    const round = s.rounds[i];
    if (!round) return;
    setIndex(i);
    setBegun(true);
    setCaption(services.speaker.prompt(round).caption);
    startedAt.current = services.now();
  };

  useEffect(() => {
    let live = true;
    prepareSet(play, topicId).then(
      async (s) => {
        if (!live) return;
        setSet(s);
        if (s.bridgeFrom) {
          // spec §5.5: Buddy links the forms aloud first, its words in the caption meanwhile
          const said = services.speaker.say(UI_LINES.bridge);
          setCaption(said.caption);
          await new Promise<void>((resolve) => {
            void said.done.then(resolve);
            later(resolve, BRIDGE_MAX_MS);
          });
        }
        if (live) begin(s, 0);
      },
      (e: unknown) => {
        console.error('could not start the set', e);
        if (live) onLeave();
      },
    );
    return () => {
      live = false;
      services.speaker.stop();
      services.speaker.clearPrompt(); // the next set's 🔊 must not replay this one's prompt
    };
    // a GameScreen plays one set: it starts once
  }, []);

  const leave = () => {
    services.speaker.stop();
    services.music.stop();
    onLeave();
  };

  const react = (r: Reaction) => {
    const mine = ++beat.current;
    setBuddy({ ...(r === 'cheer' ? { move: 'cheer', expression: 'happy' } : r === 'hmm' ? { move: 'hmm', expression: 'thinking' } : { move: 'point', expression: 'neutral' }), beat: mine });
    later(() => {
      if (beat.current === mine) setBuddy({ move: 'idle', expression: 'neutral', beat: mine });
    }, 1500);
  };

  const onEnd = (end: FlowEnd) => {
    if (!set) return;
    const round = set.rounds[index];
    if (!round) return;
    const result: RoundResult = { ...end, durationMs: services.now() - startedAt.current };
    recordRound(play, round, result);
    results.current = [...results.current, result];
    setRoundsDone(results.current.length);
    const p = round.payload;
    // a kind answer is said with its reaction; one Buddy showed is not
    const reaction = p.kind === 'scenario' && p.choices.some((c) => c.correct && c.reactionLineId);
    later(() => {
      if (index + 1 < set.rounds.length) {
        begin(set, index + 1);
        return;
      }
      finishSet(play, set, results.current);
      const earned = newSticker(play.profileId, play.clock.now(), set.template.id, set.rounds, services.random);
      play.writes.add(() => addSticker(play.db, earned));
      services.speaker.clearPrompt();
      setSticker(earned);
    }, end.outcome === 'shown' ? NEXT_MS - 400 : reaction ? REACTION_NEXT_MS : NEXT_MS);
  };

  if (sticker) return <Celebration services={services} look={look} sticker={sticker} dances={dances} yourTurn={yourTurn} onDone={onFinished} />;

  const round = set?.rounds[index];
  const scene = round ? services.pack.scenes.get(round.sceneId) : undefined;
  const payload = round?.payload;
  // Buddy is on stage once the round's mechanic is: while the bridge line plays, Buddy says it from the corner
  const buddyOnStage = begun && (round?.mechanic === 'give-to-buddy' || (payload?.kind === 'scenario' && VIGNETTES[payload.vignette]?.actors.some((a) => a.who === 'buddy')));
  return (
    <div className="screen game">
      {scene && <img className="game__scene" src={artUrl(scene.asset)} alt="" />}
      <header className="game__bar">
        <IconButton icon="ui/home.svg" label="Home" onClick={leave} />
        <PromptBar caption={caption} onReplay={() => void services.speaker.replayPrompt()} />
        {set && <ProgressDots total={set.rounds.length} done={roundsDone} />}
      </header>
      {round && begun && (
        <MechanicBoundary key={`${round.seed}:${round.index}`} onError={(e) => { console.error('a mechanic failed', e); leave(); }}>
          <Mechanic
            round={round}
            deps={{ speaker: services.speaker, sfx: services.sfx }}
            names={names}
            look={look}
            onEnd={onEnd}
            onReact={react}
            {...(quiet ? { quiet } : {})}
          />
        </MechanicBoundary>
      )}
      {!buddyOnStage && <div className="game__buddy"><Buddy key={buddy.beat} {...look} move={buddy.move} expression={buddy.expression} size={150} /></div>}
    </div>
  );
}
