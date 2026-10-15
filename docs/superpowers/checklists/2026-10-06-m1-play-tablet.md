# M1 play — tablet and playtest checklist

For the parent, before and during the first playtests of Plan 1B (spec §14: devices and playtests, a manual checklist per milestone). Use the published address, or `npm run dev:tablet` on the same Wi-Fi for everything but Install and Offline (the development server has no service worker).

## On the tablet (iPad Safari, then an Android tablet in Chrome)

- [ ] **Install.** Before setting Buddy up, Share → Add to Home Screen, and set up in the app it adds (on an iPad it keeps its own data, apart from Safari's): the icon shows Buddy; it opens full screen.
- [ ] **No zoom.** A two-finger pinch on the Map or in a game doesn't zoom the app.
- [ ] **First run.** The setup screen takes the child's name with the on-screen keyboard; the Buddy beside it changes colour and accessory as you choose; a suggested name is spoken when tapped; Return on the keyboard closes it without starting.
- [ ] **Hello.** Tapping Buddy says the whole greeting out loud, from its first word ("Good morning, <name>!") to its last, before Buddy's suggestion on the Map; on the Android tablet, try it right after opening the app too. If it is silent: the volume, the mute switch, then Safari's console (via a Mac) — it logs `speech voice: …`, the voice the device chose. `pickVoice` prefers the device's own voices: a novelty voice (Albert, Bad News…) means its language preferences need a look, and a network voice means the tablet has no English voice of its own (add one in its settings).
- [ ] **The next day.** Leave Buddy open on the home screen overnight, then open it again: does Hello greet the child again? If not, Buddy should go back to Hello after a long time away (Plan 1C).
- [ ] **The Map.** Five islands scroll sideways; Buddy points at one spot and says so; any spot can be tapped; the sticker book opens from its number too.
- [ ] **Every game.** Each of the ten spots plays a set to the celebration. In each: the prompt is spoken and 🔊 repeats it; a wrong answer gives "try again" and a wiggle; a second gives "It's this one!" and the answer; after 8 quiet seconds the prompt repeats. In the kindness scenes, Buddy's reaction ("That was kind! …") is heard to the end before the next scene starts.
- [ ] **Dragging.** Items follow the finger smoothly, without the page scrolling; tapping an item then its place works too, even a slow, slightly wobbly tap; matching draws a line that stays.
- [ ] **Letters.** In *Capital ↔ small*, capital **I** and small **l** look different; **a** and **g** are the single-storey shapes the school uses.
- [ ] **Celebration.** Confetti, the sticker flies into the book in the corner with a whoosh you can hear, Buddy dances to music, all smoothly; every second or third set Buddy says "Your turn!" and counts to three, each number appearing as he says it, cheers, then asks "Again?" as its button appears — once. Tapping Buddy skips it.
- [ ] **Sticker book.** Each sticker is on its island's page; shiny ones glow.
- [ ] **Leaving.** The 🏠 button mid-set goes back to the Map. Locking the screen mid-prompt stops the voice.
- [ ] **Sound after a lock.** Lock the screen mid-set, unlock, answer: the chime still sounds, Buddy's voice says the next prompt, and the next dance has its music. The stomp's thump can be heard on the tablet's own speaker.
- [ ] **Offline.** After one full visit, turn on airplane mode, close the app and open it again from the home screen: it starts and plays.
- [ ] **Layout.** Nothing is cut off or overlapping in landscape, and the small Buddy in the bottom-left corner never covers an answer. Watch *Good habits & manners* as its games grow (each steps up after two good sets): tapping the clean things with eight cards, and the first place of a four-step routine. Portrait and a phone are usable, if cramped (the phone pass is M4).

## Playtest with the child (spec §1.2, §14)

- [ ] Starts a visit alone: taps Buddy, then a spot.
- [ ] Understands the prompts without reading. Note any game where the child waits for the repeat, or taps at random.
- [ ] Plays a game again willingly; note favourites and ones avoided.
- [ ] "Your turn" lands: does the child copy Buddy?
- [ ] Frustration points: a game, a picture nobody recognises, a word said unclearly. Pictures to watch: *share* (two hands with a biscuit — may read as "please"), *roti* (a striped disc), *crayons* (one crayon); of those drawn for Buddy, *nail cutter*, *handkerchief*, and *mat* (rolled up) and *rug* (fringed), which can meet in a rhyming game.
- [ ] Levels: how many sets a game takes to move up (it needs a set and the one before it at 85% together). Note any game that never rises, or rises too soon.
- [ ] When the child is stuck tapping every clean thing (*Good habits*) or filling Buddy's plate (*Fruits, vegetables & healthy food*), the first hint wiggles every answer still to find: does that give the round away?
- [ ] Does the child use 🔊? Tapped a few seconds after a prompt, it can be cut off by the 8-second repeat, and the prompt starts again. If that happens in play, 🔊 should restart the 8 seconds.
- [ ] Matching capital and small letters: picking a letter says its name, and both halves of a pair have the same name, so a round can be matched by ear alone. Does the child look at the letters? If not, Buddy should say the name only once the pair is joined.
- [ ] Counting groups of seven to ten (level 3) draw each picture small: can the child still count them?
- [ ] Matching by tapping: does the child tap a picked card again, to hear its word or to count a group? That puts it down, so the next tap picks a card instead of joining the pair. If this keeps happening, a tap on the picked card should keep it picked.
- [ ] Giving a number: does the child count Buddy's copies by touching them? A touch takes a copy back; if this keeps happening, taking back should become a drag.
- [ ] Buddy's faces in the feelings scenes: can the child say which is sad, scared and angry?
- [ ] Stickers from the feelings game can be a sad, angry or scared face: does the child mind such a reward?
- [ ] Answering by elimination in the kindness scenes ("laugh at them", "push to the front" are always wrong): does the child choose the kind answer, or just avoid the odd one?
- [ ] An unkind choice makes the friend's face sadder: in *one biscuit* and *friend crying* the friend then sobs (😭). Is that too much for the child? If so, those scenes should start from a calmer face.
- [ ] While a feelings scene plays, Buddy keeps his usual small smile, even as his ice cream falls: does the child answer "happy" from his face?
- [ ] The kindness choices are pictures with their names written under them, never said: does the child know what each one shows? If not, Buddy should name each choice as it appears.
- [ ] Buddy says his suggestion each time the Map opens, even back from the sticker book: does the child follow it, or tire of it?

Note anything odd with the time and the game: every round can be replayed from its record (`replayRound`, spec §14).
