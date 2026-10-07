// src/app/audio/uiLines.ts
/**
 * Every line the UI says besides a round's own prompt, a scenario's narration and its reactions — all in
 * content/lines.json, so a renamed line fails a test instead of falling silent. Greetings: engine/time.ts.
 */
export const UI_LINES = {
  /** spec §4.4: a random short cheer */
  correct: 'fb.correct',
  tryAgain: 'fb.try_again',
  shown: 'fb.shown',
  setDone: 'fb.set_done',
  yourTurn: 'fb.your_turn',
  yourTurnCheer: 'fb.your_turn_cheer',
  yourTurnAgain: 'fb.your_turn_again',
  /** spec §5.5: Buddy links the familiar form to the new one */
  bridge: 'buddy.bridge',
  /** spec §4.3: Buddy's suggested spot */
  suggest: 'buddy.suggest',
} as const;
