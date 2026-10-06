# Buddy — Interactive learning game for Lower KG

**Design specification · 2026-10-01 · status: approved by the parent, pending written review**

"Buddy" is the working title. The game is a touch-first web app in which a child aged 4–5 looks after a baby elephant through its day (habits, manners, feelings) and plays with it on a map of mini-games that cover the full *My First Steps with Cambridge* Lower KG syllabus.

---

## 1. Purpose and context

### 1.1 Who it is for

- **The player:** the author's child, currently in Lower KG (EY2) at DPS Vijayawada, age 4–5. English-medium school.
- **What the parent sees:** the child is weaker in **Awareness** (general awareness, good habits) and **Wellness** (feelings, social skills) than in Literacy and Numeracy, which still need practice.
- **A specific learning need:** the child sometimes shows rote behaviour — can do a task when it is presented exactly as before, and may fail when the *same concept* appears in a different form. The game therefore treats **variation as the point**: no two rounds alike, and a concept counts as mastered only across different forms (see §5.5).
- **Audience decision (B):** built for this child first, but with per-child profiles and local progress from day one so other children can use the same device later. No accounts, servers or monetisation in v1.

### 1.2 What success looks like

1. The child starts a session alone, understands every prompt without reading, and willingly plays 10–20 minutes a day.
2. Over a term, the parent corner shows Awareness and Wellness goals moving from "new/shaky" to "mastered across forms", and the habit self-reports trend up.
3. Formats the school uses on paper (the DPS term papers) feel familiar to the child before the exam.
4. The child never experiences the game as a test: no fail state, nothing is ever taken away.

### 1.3 Source material

- **Syllabus map:** the parent's worksheet collection (`~/Documents/Worksheets/LKG Practice Worksheets`, 1,346 printable sheets) organised into the 5 subjects and 38 topics of the *My First Steps with Cambridge* Lower KG kit. Appendix B lists the folder map. The worksheets define *what* is taught and the question formats the school uses; the game does not reproduce worksheets.
- **School paper:** the DPS Vijayawada EY2 Term 1 Numeracy examination (11 questions, 50 marks). Its formats are reproduced exactly in exam-prep mode (Appendix A).
- **Reference app:** *Kids Games: For Toddlers 3-5* (RV AppStudios, "Lucas & Friends") — a flat grid of ~55 mini-games with a glossy cartoon style. Its catalogue validated our mechanic library; it has no routine/habits layer, which is the gap this game fills.

---

## 2. Design principles

1. **Habits are lived, not quizzed.** Brushing, dressing, eating well, tidying, saying thank you and naming feelings happen *with Buddy at Home* as things the child does, every visit.
2. **No two rounds alike.** Items, positions, counts, wording, scenes and even the mechanic change between rounds. The correct answer never sits in the same slot three times running, and no slot is favoured across a set: a child can't win by position ("never twice" was dropped on 2026-10-05 — with two options it is strict alternation, which a child can learn). Topics are interleaved, never drilled.
3. **Mastery means generalisation.** A goal is mastered only when the child succeeds across several *different* forms. A miss on a new form bridges back to a familiar one rather than repeating the failed one.
4. **Spoken, never read.** Every prompt and every piece of feedback is voiced. Text is shown only as a short caption with a 🔊 button beside it.
5. **No fail state.** Wrong → hint. Wrong again → Buddy shows the answer and moves on. Never a sad face for a wrong answer.
6. **Nothing is ever taken away.** No streaks, coins, shop, timers on rewards, or losing stickers.
7. **Real strokes.** What the child writes is shown exactly as written. Never auto-corrected, never snapped to a guide.
8. **The tablet never says no.** Sessions end because Buddy has somewhere to be (school, nap, bed), on a timer the parent sets.
9. **Content is data.** Adding a game, a pool item, a story or a random event is adding a file, not code.
10. **On-device and private.** Nothing leaves the tablet. No accounts, no analytics.

---

## 3. Decision log

| # | Decision | Choice |
|---|---|---|
| 1 | Audience | Own child first; multi-profile ready; no backend |
| 2 | Device | Tablet-first (iPad/Android), touch; web app installable to home screen; also runs on phones and laptops |
| 3 | Scope of v1 | All five subjects, thin, with depth in Awareness and Wellness |
| 4 | Structure | Hybrid: **Buddy's Home** (routines, habits, feelings) + **Play Map** (islands of mini-games) |
| 5 | Voice | Three layers, strict fallback: **Heart** (parent recording, later) → **AI-generated clip** → **device TTS**; English only |
| 6 | Parent corner v1 | Progress by topic, session timer, exam-prep mode; "today's focus" right after v1 |
| 7 | Variants per topic | 4–6 for Awareness and Wellness; 2–3 for Literacy, Phonics, Numeracy (more for the giant topics) |
| 8 | Art direction | **Storybook** (paper & crayon) default; **Soft Flat** switchable; one vector illustration set, styles applied as skins; glossy style excluded |
| 9 | Art sourcing | AI-generated, style-locked, vectorised and reviewed + open-licence packs for common objects |
| 10 | Buddy | One baby elephant, personalised (colour, name, accessory); 6 dances, 5 actions, "your turn" copy-me moments |
| 11 | Build approach | Hybrid: data-driven engine for Map games; hand-crafted scenes for Home routines, celebrations and exam-prep |
| 12 | Randomisation | Mandatory, as a core principle (§2.2, §5.4) |
| 13 | Routine gating | The due Home routine must be completed before the door to the Map opens |
| 14 | Writing | Four-line guide always; never auto-correct; mostly free-write; random letter and case; placement-aware scoring; ghost animation on a poor score; Apple Pencil support |
| 15 | Prompt replay | 🔊 button adjacent to every prompt's text; auto-repeat after 8 s of inactivity |

---

## 4. The experience

### 4.1 One visit, start to finish

```
Hello → Home routine (due steps) → Feelings check-in at the door
      → Play Map ⇄ Set ⇄ Celebrate (loops) → Wind-down
```

1. **Hello.** If more than one profile exists, a child picks their Buddy (big portraits, no text needed). Buddy greets the child by name, aware of the real time of day: morning (05:00–11:59), afternoon (12:00–16:59), evening (17:00–04:59). The grown-up gate to the parent corner is a small lock icon in the corner of this screen.
2. **Home routine.** The routine strip shows today's steps for this time of day (§4.2). 2–3 steps are marked *due*; the rest are optional. One random event may be injected. **The door to the Map opens only when the due steps are done.** Each completed step earns a sticker.
3. **Feelings check-in.** At the door: "How are you feeling today?" — six faces. Buddy responds in kind. If the answer is sad, angry or scared, Buddy offers a balloon breath (the breathe-along mechanic, §6.20) before going out. The answer is logged for the parent.
4. **Play Map.** Five islands (§4.3), all open — no star-gating. Buddy comes along, small in a corner, pointing at a suggested spot. The child taps any spot.
5. **A set.** The chosen topic's template picker (§5.4) selects a game the child has not seen lately and generates a fresh round. A set is 5–8 rounds for tap/drag mechanics, fewer for finger mechanics (§6). Feedback rules in §4.4.
6. **Celebrate.** Buddy performs a dance or action; a sticker flies into the book. Every 2nd–3rd set (random) Buddy adds "Your turn!" (§4.5). Back to the Map.
7. **Wind-down.** At T−2 min of the parent-set session length, Buddy yawns and the music softens. At T, Buddy *has to go*: in the morning "time for school" (Buddy picks up the bag and leaves through the door), in the afternoon "nap time", in the evening the bedtime routine (bath → change into shorts → story → lamp off). A "Buddy is at school / asleep" screen then shows until the next session is allowed (next time-of-day block, or the parent overrides from the parent corner).

### 4.2 Buddy's Home

Home is a single room with a window (weather), a wardrobe, a bathroom door, a kitchen corner, a toy box, a bookshelf, a bed, a wall calendar, and a door to the Map. The **routine strip** across the top shows the day's steps as circles: done (green), due (ringed), optional (faded).

**Time-of-day routine sets**

| Block | Steps (in order) | Due (2–3) |
|---|---|---|
| ☀️ Morning | Wake up & wash · Brush teeth · Get dressed · Meal (breakfast) · Pack the bag | Brush, Dress, plus one rotating among Wake up & wash, Meal, Pack the bag |
| 🌤️ Afternoon | Meal (lunch) · Tidy up · (free play) | Meal, Tidy |
| 🌙 Evening | Meal (dinner) · Bath · Get dressed (night shorts) · Story & bed | Bath, Story, plus Meal or Dress |

**The nine hand-crafted scenes.** Each is a scripted scene using one or two mechanics, with its own art, lines and small animations. Each ends with a **transfer nudge** — Buddy asks the child about their *own* routine (Yes / Not yet), self-reported, logged for the parent, never enforced or nagged.

| Scene | Block | Mechanics | What happens | Transfer nudge |
|---|---|---|---|---|
| Wake up & wash | ☀️ | drag, scrub | Open curtains (reveals weather); wash face and hands with soap until clean; dry with towel | "Did you wash your face today?" |
| Brush teeth | ☀️ | scrub | Sugar bugs on top and bottom teeth, front and back; brush until gone; rinse, spit. Morning only for now (parent's choice, 2026-10-05); a night variant can be added later | "Did you brush yours too?" |
| Get dressed | ☀️ 🌙 | dress-buddy | Look out of the window (today's weather, random with seasonal weighting); choose from the wardrobe; wrong choices get a reaction (shivers, sweats, gets wet) not a block; shoes last. Night variant: night shorts (the child wears shorts, not pyjamas) | "What did you wear today?" |
| Meal time | ☀️ 🌤️ 🌙 | scrub, give-to-buddy | Wash hands first; build a plate from the fridge — fruits, vegetables, roti/rice, milk, eggs; sweets and chips are present and tempt; Buddy's tummy reacts; "thank you" at the end | "Did you eat a fruit today?" |
| Pack the bag | ☀️ | give-to-buddy, sort | Lunchbox, water bottle, books, pencil box go in; toys and sweets stay out. Buddy is then ready for school (the door is still the door) | "Do you have your water bottle?" |
| Tidy up | 🌤️ | sort-into-bins | Room is randomly messy (3–8 items): toys → box, books → shelf, clothes → basket; Buddy admires the clean room | "Can you tidy one thing in your room?" |
| Bath time | 🌙 | scrub | Soap, rinse, hair wash, towel dry; muddy-boots days are extra foamy | "Did you have your bath?" |
| Story & bed | 🌙 | story (tap to turn pages), tap | A 4-page narrated picture story about a feeling or a kind act, from a rotating pool (3 at launch; more unlockable); tap the lamp; goodnight. Ends the evening session | — |
| Feelings check-in | every visit | tap-the-one, breathe-along | Six faces at the door; Buddy mirrors the feeling; sad/angry/scared → optional balloon breath | — |

**Random events.** At most one per visit, drawn without recent repeats from a pool that grows over time. Launch pool: it's raining (umbrella); extra sugar bugs; muddy boots (clean up); Buddy sneezes (tissue, cover mouth); a friend visits (share the snack); Buddy is sad (what helps?); hot day (water bottle and cap); lost toy (find it); birthday (say thank you); spilled milk (it's okay, wipe it); Buddy feels ill (who helps? — the doctor).

**Free-play corners at Home** (always available, no stickers): the dance floor (replay any unlocked dance; Buddy invites "your turn"), the sticker book, the wardrobe (change accessory), room decorating (place unlocked items), and the wall calendar (a sun on each day played — blank days are just blank).

### 4.3 The Play Map

Five islands on one scrolling map. Each island has topic spots (a signpost with a picture, no reading needed). Everything is open from the first visit.

| Island | Subject | Topics |
|---|---|---|
| 🔤 Letter Land | Literacy | Pre-writing strokes · Letters A–Z · Alphabet order & missing letters · Capital ↔ small · Beginning sounds |
| 🔊 Sound Garden | Phonics | Short vowels & CVC words · Rhyming words |
| 🔢 Number Hill | Numeracy | 20 topics (§5.7) |
| 🌍 Our World | Awareness | Body & senses · Me, family & home · My school · Fruits, veg & healthy food · Animals · Plants & flowers · Seasons, weather & clothes · Transport · Community helpers & places · Good habits & manners |
| 💗 Feelings Forest | Wellness | Feelings · Kind & fair · Calm & me |

**Suggestion, not gating.** Buddy points at a suggested spot on a different island from the last one played whenever another island has a spot, preferring goals that are "shaky" or need practice (§5.5). The child may tap anywhere. (The parent's "today's focus" feature, after v1, restricts which spots are open.)

### 4.4 Sets, rounds and feedback

- **Set length:** tap/drag mechanics 5–8 rounds (6 by default; 5 once the session has passed 10 minutes); write 4–6 glyphs; dot-to-dot, colour-in, maze, scrub, story, memory-flip and breathe-along are one scene each.
- **Prompt presentation:** Buddy speaks the prompt; a short caption appears with a **🔊 button immediately to its left** (≥ 64 px). Tapping replays the line. After **8 seconds** with no input, Buddy repeats the prompt once, then every 15 seconds with a small hint (the target wiggles).
- **Correct:** chime, Buddy cheers (random short line), the progress dot fills.
- **First wrong:** gentle "Hmm, try again" + a hint (the correct option wiggles briefly, or the right bin glows). The wrong option is not removed.
- **Second wrong:** Buddy says "It's this one!" and demonstrates with a short animation; the round ends and counts as *shown* for mastery. The set continues.
- **Never:** blocking, a sad Buddy, a buzzer, a red cross, or showing a score to the child.
- **Exit:** a Home button is always visible; leaving mid-set keeps the stickers already earned.

### 4.5 Celebrations and "your turn"

- **After every completed set or routine step:** confetti, a cheer line, a sticker flies to the book, and Buddy performs a random move from those unlocked (dances and actions). Each dance has its own 8-second music loop.
- **"Your turn!" — every 2nd–3rd set, at random:** Buddy demonstrates an action or dance, then says "Your turn! Can you jump like me? 1… 2… 3!" with music. There is no camera or sensor; after the count Buddy cheers whatever happened ("Wow, what a jump!") and offers "Again?" once. The child can skip by tapping Buddy.
- **Unlock ceremony — every 10 stickers:** bigger confetti, Buddy demonstrates the new move / item / story, and the child can try it immediately.

### 4.6 Rewards

- **Stickers:** one per completed set and one per completed routine step. Each sticker is a topic-themed picture from the object pool (the animal you matched, the fruit you sorted). They live in the sticker book, one page per island plus a Home page. Rare "shiny" stickers appear at random (≈1 in 15).
- **The ladder (every 10 stickers):** 10 → dance 3 (wiggle) · 20 → dance 4 (spin) · 30 → dance 5 (bhangra bounce) · 40 → dance 6 (disco) · 50 → wardrobe accessory · 60 → room item · 70 → new bedtime story · then repeating accessory → room item → story → surprise (a seasonal sticker page or a new random event).
- **Rules:** nothing is removed, ever; no streaks; the calendar shows blank days without comment; the parent corner cannot deduct stickers.

### 4.7 Buddy

- **Personalised once, at first launch:** body colour (6 options), a name (typed by the parent or chosen from spoken suggestions), one accessory (bow, cap, scarf, glasses). Changeable later in the wardrobe.
- **Buddy's chosen name is spoken everywhere Buddy is mentioned** (parent's choice, 2026-10-05): lines carry a `{buddy}` slot that the UI fills from the profile and the device-TTS layer speaks, exactly like the child's own `{name}`. Lines never use a possessive after the slot ("the plate", not "{buddy}'s plate") and never give Buddy a gendered pronoun.
- **10 expressions:** happy · excited · proud · surprised · thinking · sleepy · sad · scared · angry · calm. The last four are also the feelings vocabulary used in Feelings Forest and the check-in.
- **Idle life:** blink, breathe, trunk sway, occasional sneeze or yawn, looks toward where the child last tapped.
- **6 dances:** trunk twirl · elephant stomp · wiggle · spin · bhangra bounce · disco. Two unlocked at start (trunk twirl, elephant stomp).
- **5 actions:** jump · arm roll · clap · stretch · peek-a-boo. All unlocked at start. Each has a "your turn" variant with a 3-count.
- **In games:** small in a corner; cheers, "hmm", demonstrates answers; never sad about a wrong answer. In Feelings Forest Buddy *acts out* feelings on purpose.
- **At Home:** full size; reacts to weather, food, cleanliness, bedtime.

---

## 5. Content model

### 5.1 Hierarchy

```
Subject (5) → Topic (40) → Goal (1–4 per topic) → Template (163) → Round (generated)
```

- A **goal** is a single learning objective, e.g. *Big & small → "identify the bigger of two"* and *"order three by size"*. Mastery is tracked per goal.
- A **template** is a game definition: one goal, one mechanic, a pool query, flavour, difficulty parameters, an optional exam-format tag, and a level.
- A **round** is one generated instance, from a template and a seed.

### 5.2 Shared pools

| Pool | Size at v1 | What each entry carries |
|---|---|---|
| `objects` | ~300 | id · display name · spoken name (line id) · picture (vector asset id) · category (animal, fruit, vegetable, vehicle, clothing, body part, school thing, home thing, helper, tool, shape, …) · tags: `sizePair` (has a small/large rendering), `colour`, `countable`, `beginsWith` (letter), `vowelSound`, `rhymeGroup`, `habitat`, `season`, `transportMode`, `sense`, `room`, `healthy`, `teethFriendly`, `neatAndClean`, `sound` (audio id) |
| `scenes` | ~30 | background art · theme (bathroom, kitchen, playground, classroom, garden, farm, jungle, sea, road, town, bedroom, …) · anchor points for placing objects |
| `pairs` | ~50 | scenario doodle pairs with a state: clean/dirty shirt, tidy/messy room, washed/unwashed hands, combed/messy hair, cut/long nails, healthy/junk plate, wet/dry, full/empty cup, happy/sad child, … |
| `lines` | hundreds | spoken-line templates with slots, e.g. `tap_big {target}` → "Tap the biggest {target}". Each line id resolves through the audio chain (§7). |
| `glyphs` | 52 + 21 | letters a–z, A–Z, numbers 0–20 with reference stroke paths, stroke order, and zone rules (ascender/body/descender) |
| `stories` | 3 at launch | 4-page narrated picture stories (feelings, kindness) |
| `events` | 11 at launch | Home random events |

### 5.3 Template definition

Every template is one data file with these fields:

| Field | Meaning |
|---|---|
| `id`, `topic`, `goal` | identity and what it teaches |
| `mechanic` | one of the 23 mechanics (§6) |
| `query` | how to draw items from pools, e.g. `objects where sizePair and category in [animal, vehicle, fruit]` |
| `targetRule` | what makes an item correct for this round (e.g. `larger`, `count == n`, `beginsWith == letter`) |
| `distractorRule` | how distractors are chosen; similarity rises with difficulty |
| `rounds` | rounds per set (or `scene` for one-scene mechanics) |
| `difficulty` | parameters by level 1–3: option count, item count, distractor similarity, pattern length, number range |
| `flavour` | allowed scenes, Buddy line variants, music set |
| `examFormat` | optional: which DPS question format it mirrors (Appendix A) |
| `level` | `LKG` (v1); `Nursery`/`UKG` reserved |
| `forms` | the form key the template contributes to mastery (`mechanic:itemClass`) |

### 5.4 Round generation and variation rules (mandatory)

The generator is deterministic from `(template, seed, level, profile history)` so any round can be replayed.

1. **Sampling without recent repeats:** items not used for this goal in this session or the 3 before it are preferred; distractors likewise (not yet: Plan 1A applies the rule to the key items only).
2. **Position shuffle:** the correct answer's slot may repeat once but never three times running, and it only goes to a slot at most one use ahead of the least-used (always taking the least-used slot would make every second two-option round predictable).
3. **Wording variants:** each line has 2–4 phrasings sharing the key word ("Tap the biggest car" / "Which car is the biggest?" / "Find the biggest car").
4. **Scene variants:** each set's background differs from the last set of the same goal (a set of another game may share it).
5. **Mechanic rotation:** whenever a topic is played again, a different template (mechanic) is chosen than last time, if the topic has more than one.
6. **Interleaving:** Buddy's suggestion is never on the island just played (while another island has a spot) nor the topic just played, and prefers shaky goals.
7. **Difficulty ramp:** per template, the level rises when a set and the one before it at that level reach ≥ 85% correct together — their rounds answered right before any hint, over all their rounds, so one slip across two sets of 4 or more rounds still rises, while 2- and 3-round games still need every round right (parent's choice, 2026-10-06; "each of two sets" meant two perfect sets at M1's 2–6 rounds) — and falls after a set at ≤ 50%, which is never paired with another. Level changes also change the *kind* of variation (2 → 3 → 4 options; obvious → subtle distractors; counts 1–5 → 1–10; pattern unit 2 → 3).

### 5.5 Mastery by form, and bridging

- Every attempt is logged with its **form** = `mechanic : itemClass` (e.g. `sort-into-bins:animals`, `tap-the-one:vehicles`).
- Per goal, over the last 12 attempts:
  - **new** — fewer than 4 attempts
  - **mastered** — ≥ 80% correct *and* ≥ 3 distinct forms, each with at least one correct
  - **shaky** — otherwise
  - **needs practice** — < 50% correct over ≥ 4 attempts
- **Bridging:** when an attempt in a form with no prior success ends as *shown* or *corrected*, the next set for that goal uses a form with prior success (if any) and Buddy links them aloud ("Remember the big elephant? Now find the big ball!"), then the new form returns the set after (a set plays one template, so one form).
- The parent corner shows status, forms attempted, and the specific confusions (e.g. b/d, 6/9, tall vs big).

### 5.6 Levels

All v1 content is tagged `LKG`. The schema reserves `Nursery` and `UKG`; difficulty level 3 in several templates already reaches early UKG (numbers to 50, CVC building). Adding UKG content later is adding templates and pool items, not changing the engine.

### 5.7 Catalogue (v1 templates)

**DPS n** marks a template that mirrors question *n* of the Term 1 Numeracy paper. **home** marks a mechanic also used by a hand-crafted Home scene.

**🔤 Literacy — Letter Land (17)**

| Topic | Templates | # |
|---|---|---|
| Pre-writing strokes | write (guided: standing, sleeping, slanting, curved) · maze (follow the curvy path) · dot-to-dot (stroke shapes) | 3 |
| Letters A–Z | write (free/faded/guided, random case) · tap-the-one (find the letter) · pop-the-right-ones (pop all the B/b) · listen-and-find (hear the sound, tap the letter) · colour-in (letter picture) | 5 |
| Alphabet order & missing letters | sequence (letter cards) · dot-to-dot (a→z picture) · tap-the-one (which letter is missing) | 3 |
| Capital ↔ small | drag-to-match · memory-flip (A/a pairs) · pop-the-right-ones (pop the small 'a' when you see 'A') | 3 |
| Beginning sounds | listen-and-find (hear the sound, tap the picture) · sort-into-bins (b-things / d-things) · drag-to-match (picture → letter) | 3 |

**🔊 Phonics — Sound Garden (6)**

| Topic | Templates | # |
|---|---|---|
| Short vowels & CVC words | listen-and-find (hear "cat", tap the picture) · assemble (build c-a-t from letters) · tap-the-one (which word says "pig") | 3 |
| Rhyming words | drag-to-match (rhyme pairs) · odd-one-out (which doesn't rhyme) · memory-flip (rhyming pairs) | 3 |

**🔢 Numeracy — Number Hill (65)**

| Topic | Templates | # |
|---|---|---|
| Same & different | drag-to-match (match the same) **DPS 1** · tap-the-one (find the different one) **DPS 2** · spot-the-difference | 3 |
| Big & small | tap-the-one **DPS 3** · sort-into-bins · stack-by-size · give-to-buddy (give the big one) | 4 |
| Tall & short | tap-the-one · stack-by-size (order by height) · sort-into-bins | 3 |
| Long & short | tap-the-one · sequence (short → long) · drag-to-match (long things → long box) | 3 |
| Heavy & light | tap-the-one · sort-into-bins · scene-then-choose (seesaw: which side goes down?) | 3 |
| Full & empty | tap-all-that-match (circle the full ones) **DPS 4** · sort-into-bins · give-to-buddy (fill the cup) | 3 |
| More & less | tap-the-one (which group has more) · give-to-buddy (give Buddy more) · pop-the-right-ones (pop the group with less) | 3 |
| Inside / outside / above / below | tap-all-that-match (tick the animals outside) **DPS 5** · give-to-buddy (put the cat inside the box) · find-in-scene (what is above the table?) | 3 |
| Near & far | tap-the-one · drag (move the ball far from Buddy) | 2 |
| Before / after / between | sequence (number cards) · tap-the-one (what comes after 5?) · drag (put 4 between 3 and 5) | 3 |
| Opposites | drag-to-match · memory-flip · tap-the-one | 3 |
| Sorting & odd one out | sort-into-bins · odd-one-out · tap-all-that-match (things that go together) | 3 |
| Patterns | pattern-next **DPS 10** · sequence (rebuild the pattern) · pop-the-right-ones (pop what comes next) | 3 |
| Shapes | drag-to-match (picture → shape) **DPS 6** · shape-fit · write (draw the shape) · find-in-scene (find the circles) · colour-in (colour the triangles) | 5 |
| Colours | tap-all-that-match (all the red things) · sort-into-bins · colour-by-number · dress-buddy (dress Buddy in blue) | 4 |
| Numbers 1–10 | write (random number) **DPS 9** · tap-the-one (find the 7) · pop-the-right-ones (pop all the 3s) · listen-and-find (hear "six", tap 6) · colour-by-number | 5 |
| Numbers 11–20 | write · tap-the-one · sequence | 3 |
| Numbers up to 50 | dot-to-dot (to 30 / 50) · sequence (chart fill) · pop-the-right-ones | 3 |
| Counting | drag-to-match (count and match) **DPS 7** · tap-the-one (count and circle the number) **DPS 8** · give-to-buddy (give Buddy 4 apples) · pop-the-right-ones (pop 5 balloons) · tap-all-that-match (count by crossing out) | 5 |
| Missing numbers & order | sequence (fill the missing numbers) **DPS 9** · dot-to-dot (join the numbers) **DPS 11** · tap-the-one (which number is missing) · maze (follow the 1-2-3 path) | 4 |

**🌍 Awareness — Our World (57)**

| Topic | Templates | # |
|---|---|---|
| My body & senses | assemble (build the body) · find-in-scene (tap Buddy's ears) · drag-to-match (sense → organ) · listen-and-find (sounds → ear) · tap-all-that-match (things you can smell) · scene-then-choose (can you taste it?) | 6 |
| Me, my family & my home | sort-into-bins (which room?) · find-in-scene (kitchen things) · drag-to-match (family members) · assemble (my house) · scene-then-choose (who helps you at home?) | 5 |
| My school | find-in-scene (classroom objects) · give-to-buddy (pack the bag) **home** · sort-into-bins (school things / home things) · sequence (getting ready for school) | 4 |
| Fruits, veg & healthy food | sort-into-bins (fruit / vegetable; healthy / junk) · give-to-buddy (healthy plate) **home** · tap-all-that-match (all the fruits) · memory-flip · scene-then-choose (Buddy is hungry — what should he eat?) · colour-in | 6 |
| Animals | drag-to-match (mother → baby · animal → home · animal → sound) · listen-and-find (animal sounds) · sort-into-bins (farm / wild / water; fur / feathers; legs / wings) · find-in-scene (jungle) · memory-flip · assemble (build the animal) | 6 |
| Plants & flowers | assemble (parts of a plant) · sequence (seed → sprout → plant → flower) · tap-all-that-match (what plants need) · colour-in · find-in-scene (garden) | 5 |
| Seasons, weather & clothes | dress-buddy (dress for the weather) **home** · sort-into-bins (summer / winter clothes) · drag-to-match (weather → activity) · scene-then-choose (it's raining — what do you take?) · sequence (the seasons) · tap-the-one | 6 |
| Transport | sort-into-bins (land / water / air) · drag-to-match (vehicle → where it goes) · listen-and-find (vehicle sounds) · maze (drive the car home) · find-in-scene (road) · memory-flip | 6 |
| Community helpers & places | drag-to-match (helper → tool; helper → place) · scene-then-choose (Buddy is sick — who helps?) · find-in-scene (town) · sort-into-bins (what does a nurse use?) · dress-buddy (dress as a helper) · memory-flip | 6 |
| Good habits & manners | scrub (brush · wash · bath) **home** · sequence (routine order) · tap-all-that-match (neat & clean things) · tap-the-one (clean vs stained shirt; washed vs dirty hands — `pairs` pool) · scene-then-choose (what do you say when…?) · find-in-scene (what did Buddy forget?) · sort-into-bins (good habit / not-so-good) | 7 |

**💗 Wellness — Feelings Forest (15)**

| Topic | Templates | # |
|---|---|---|
| Feelings | tap-the-one (find the feeling) · scene-then-choose (how does Buddy feel?) · assemble (build the face) · drag-to-match (feeling → situation) · listen-and-find (voice tone → face) · memory-flip (faces) | 6 |
| Kind & fair (sharing, turns, helping, sorry) | scene-then-choose (what's kind?) · give-to-buddy (share half) · sequence (how to say sorry) · tap-the-one (who needs help?) · scene-then-choose (taking turns) | 5 |
| Calm & me (likes, calming down, my body is mine) | breathe-along (balloon breath with Buddy) · sort-into-bins (likes / dislikes — no wrong answer) · assemble (my favourite things) · scene-then-choose (what helps when I'm angry?) | 4 |

**Totals:** Literacy 17 · Phonics 6 · Numeracy 68 · Awareness 57 · Wellness 15 = **163 templates**, plus 9 Home scenes and the exam-prep set.

---

## 6. Mechanic library (23)

Each mechanic is one reusable, tested component with a small set of parameters. Templates supply content; mechanics supply interaction. Common to all: spoken prompt + caption + 🔊; hint on first miss; demonstration on second miss; progress dots; Home button; ≥ 64 px targets.

**Tap**

1. **tap-the-one** — 2–4 options, exactly one correct. Layouts: row, grid, or placed in a scene. Mirrors tick/circle-one formats (DPS 2, 3, 8).
2. **tap-all-that-match** — 4–8 options, 1–4 correct. Done when all correct are tapped; a wrong tap shakes and counts as a miss. Mirrors circle-all formats (DPS 4, 5).
3. **pop-the-right-ones** — balloons/bubbles drift across; pop only the matching ones. Parameters: speed, count, duration. A missed correct balloon simply floats back later; wrong pops count as misses.
4. **find-in-scene** — a busy scene; tap the named target(s). After 8 s the target wiggles.
5. **odd-one-out** — 3–4 items, one doesn't belong (category, colour, size, rhyme).
6. **spot-the-difference** — two scenes, 1–3 differences; tap each difference on the right-hand scene.

**Drag**

7. **drag-to-match** — two columns, 2–4 pairs; dragging from one item to its partner draws a line (lines stay). Mirrors "match" formats (DPS 1, 6, 7).
8. **sort-into-bins** — 2–3 bins, 4–8 items; a wrong bin bounces the item back with a hint.
9. **give-to-buddy / dress-buddy** — drag items onto Buddy or onto a target (plate, bag, cup). Buddy reacts to each item (yum/yuck, warm/cold, too big).
10. **sequence** — 3–5 cards into ordered slots (routine, seasons, growth, numbers, letters, pattern rebuild).
11. **assemble** — drag parts onto a silhouette: body parts, plant parts, face parts (feelings), letters into a word, a house.
12. **pattern-next** — a repeating pattern with a blank; drag the right piece from 3 choices. Unit length 2 → 3 with difficulty. Mirrors DPS 10.
13. **shape-fit** — drop shapes into matching holes; no rotation required at LKG.
14. **stack-by-size** — rings or boxes onto a pole/stack in size or height order.

**Finger**

15. **write** — see §6.1.
16. **dot-to-dot** — numbered or lettered dots; drag from dot to dot in order; a wrong dot pulses and draws nothing; completion reveals the picture and offers colour-in. Mirrors DPS 11.
17. **colour-in / colour-by-number** — a palette and tap-to-fill regions. Colour-by-number shows a key and expects matching colours; free colour-in has no wrong answers and celebrates at ≥ 80% filled.
18. **maze** — a generated grid maze (4×4 to 7×7); drag Buddy from start to goal; walls block the finger.
19. **scrub** — rub a dirty area until clean (coverage ≥ 90%); bubbles show progress; works with pencil and finger.
20. **breathe-along** — a circle slowly expands (4 s) and contracts (4 s) for 3–5 breaths while Buddy's belly rises and falls; the child follows with a finger or just watches. No scoring.

**Listen & story**

21. **listen-and-find** — a sound or word plays (no text); tap the matching picture or letter from 2–4.
22. **scene-then-choose** — a 3–6 s animated vignette, then 2–3 choices (faces or actions). Buddy acts out the choice. In "what's kind" rounds an unkind choice shows the other character's sad face and Buddy gently suggests trying a kind one — the only place a sad face is a consequence, because that *is* the lesson.
23. **memory-flip** — 2×2 to 3×4 face-down cards; find pairs (same, capital/small, rhymes, mother/baby, faces).

### 6.1 The write mechanic (letters, numbers, strokes, shapes)

**Surface.** Always the Indian four-line copybook guide: red top line, two blue lines, red bottom line. Zones: ascender (top red → upper blue), body (between the blues), descender (lower blue → bottom red). The box is large (body zone ≥ 1/5 of screen height) with the model glyph shown to the left in the same four lines.

**Modes** (chosen per glyph):

| Mode | What is shown | Share |
|---|---|---|
| free | model beside an empty box | ~70% |
| faded | a very light ghost of the glyph in the box | ~20% |
| guided | dotted path with a start dot and direction arrows | ~10%, and always the bridge after two poor attempts on a glyph |

Pre-writing strokes use guided as their main mode.

**Selection.** Each set samples 4–6 glyphs from all 52 letters (upper and lower mixed) or from 0–20, weighted toward lower-mastery glyphs. Never in A–Z or 1–20 order. Order appears only in alphabet-order and number-order templates (sequence, dot-to-dot).

**Ink.** The child's strokes are rendered exactly as drawn, on their own layer. Never snapped, smoothed into the reference, or re-drawn. Pressure (pencil) varies stroke width 0.6×–1.4×.

**Scoring** (lenient thresholds for age 4–5), components stored with every sample:

- *shape* — similarity of the resampled stroke set to the reference path (normalised), 0–1
- *placement* — body letters inside the body zone; ascenders reach the top red; descenders reach the bottom red; capitals and numbers span top red → lower blue
- *size* — the glyph fills its zone (not tiny, not overflowing)
- *strokes* — count and direction versus the reference, recorded softly (shown to the parent, never penalised beyond a nudge)

Outcome: **great** (shape and placement above threshold) · **nearly** (one component short) · **let's watch** (otherwise).

**Remediation.** On *let's watch* (and on the second *nearly* for the same glyph): Buddy says "Let's watch how it's written"; an animated stroke plays on the same four lines — a moving dot with a direction arrow — as a faint ghost. The child's box clears and they write again with the ghost animation looping behind their ink. After a *great*/*nearly* or two retries, move on. Every attempt is kept as a writing sample.

**Input.** Pointer events. When a pen pointer (Apple Pencil, Android stylus) is active, touch pointers on the writing surface are ignored (palm rejection), and for 500 ms after the pen lifts. Finger and mouse use the same path. Coalesced pointer events are used for smooth ink.

---

## 7. Audio system

- **Line IDs.** Every spoken line in the game has an id in the `lines` pool. The audio player resolves an id through the chain **Heart → AI clip → device TTS** and plays the first available. Lines with slots are spliced segment by segment: the text and any object or number name from their clips, the child's and Buddy's names by TTS; a missing or stale clip falls back to TTS for its segment alone.
- **Heart layer (after v1):** the parent records short lines in the parent corner; stored on device per profile.
- **AI clip layer:** every line generated once in a warm, slow, clear, neutral-English child-friendly voice; shipped as small compressed clips; regenerated when a line's text changes (the content validator flags stale clips).
- **Device TTS layer:** the platform speech engine; English voice; rate slightly slower than default. Also the only layer that can speak unforeseen text.
- **Replay:** 🔊 beside every caption; auto-repeat after 8 s of inactivity.
- **Sound effects:** taps, correct chime, "hmm", pops, confetti, bubbles, page turn — one consistent set, normalised volume, nothing startling.
- **Music:** calm loop at Home, livelier loop on the Map, one 8-second loop per dance; music ducks under voice; the parent can mute music or all audio.
- **Unlock:** audio starts after the child's first tap (platform rule); the Hello screen's "tap Buddy" is that tap.

---

## 8. Parent corner

**Gate:** hold the lock icon for 3 seconds, then answer a sum (e.g. 7 + 5) by typing digits.

| Area | Contents |
|---|---|
| Progress | Traffic-light status per topic and per goal (new / shaky / needs practice / mastered), number of forms attempted, last played; tap a goal → every attempt, which form, outcome, hints used, and named confusions (b/d, 6/9, tall vs big) |
| Feelings | Check-ins by day; whether a balloon breath followed |
| Habits | Transfer-nudge self-reports per routine (e.g. brushed 5/7, tidied 2/7) and routine completions |
| Writing gallery | Real stroke samples per glyph over time, with the score components |
| Session | Timer 10 / 15 / 20 / 30 minutes; wind-down behaviour; allow another session now (override) |
| Exam-prep | Launch a practice paper; past papers with marks per question |
| Settings | Theme (Storybook / Soft Flat), music, TTS fallback on/off, left-handed layout, reduced motion, Buddy reset, profiles (add / rename / remove), **Backup** and **Restore** |
| Right after v1 | "Today's focus": choose which islands, topics and routines are open this week |

**Tone rules:** no streak shaming, no comparison with other children, no "behind" language. Only things a parent can act on.

---

## 9. Exam-prep mode

- A **practice paper**: white sheet, numbered questions, the school's exact wording as caption with 🔊, untimed, Buddy quiet (small, in the margin). Marks per question as on the real paper; shown only in the parent corner. The child receives the normal celebration at the end.
- **Question types = the school's formats.** Content is generated fresh each time from the same pools and variation rules.
- **Papers at v1:** Numeracy (Appendix A). Literacy is added when the parent provides the school's paper; the format pool is designed to grow.
- Interactions map to paper actions: tick → tap-the-one; circle → tap-the-one / tap-all; match → drag-to-match (lines); colour → colour-in; trace and write → write in four-line boxes; complete the pattern → pattern-next; join the numbers → dot-to-dot.

---

## 10. Profiles and data

**Entities (per device):**

| Entity | Fields |
|---|---|
| Profile | id · name · level · Buddy (colour, name, accessory) · createdAt · settings overrides |
| Session | profileId · index (1, 2, 3… per profile; the session window of §5.4 rule 1) · startedAt |
| Attempt | profileId · timestamp · session index · templateId · topicId · goalId · mechanic · form · seed (the set's) · level · outcome (correct / corrected / shown) · hints · duration · details (the round's place in its set, item ids, slot, scene, wording, payload hash; e.g. write score components) |
| SetResult | profileId · timestamp · session index · templateId · goalId · level · correct · total (a finished set; the difficulty ramp of §5.4 rule 7) |
| RoutineEvent | profileId · timestamp · sceneId · completed · selfReport (yes / not yet / skipped) · randomEventId |
| CheckIn | profileId · timestamp · feeling · breathTaken |
| Sticker | profileId · timestamp · pictureId · source (templateId or sceneId) · shiny |
| Unlocks | profileId · dances · accessories · roomItems · stories · roomLayout |
| WritingSample | profileId · timestamp · glyph · mode · strokes (points, pressure, timing) · scores · outcome |
| PaperResult | profileId · timestamp · paperId · per-question marks · seed |
| Settings | timer · theme · music · tts · leftHanded · reducedMotion |

**Storage:** on-device browser storage (structured, indexed). Installed-to-home-screen use is recommended on the first run (full screen, and exempt from the browser's periodic storage clean-up).

**Backup / restore:** one versioned file containing all entities for all profiles (writing samples included), exported via the share sheet and imported on another device. A gentle reminder in the parent corner once a month.

**Privacy:** nothing is transmitted; no accounts; no analytics; no third-party scripts at runtime.

---

## 11. Platform

- **Delivery:** a web app, installable to the home screen (full screen, icon, offline). Runs on iPad and Android tablets (primary), iPhone and Android phones (responsive layout: larger targets, fewer items per round, two bins instead of three, portrait supported), and laptops (mouse/trackpad). Native app-store wrapping is possible later from the same code; not v1.
- **Orientation:** landscape primary on tablets.
- **Offline:** the app shell and the current profile's recently used island packs are cached; island assets load on demand (each island pack ≤ 10 MB; shell ≤ 5 MB).
- **Input:** pointer events everywhere; pen support with palm rejection and pressure (§6.1); hover-free design; no gestures beyond tap, drag and draw (no pinch, no long-press for children — long-press is reserved for the grown-up gate).
- **Performance:** smooth animation on a 2019-era iPad and a comparable Android tablet; first interaction within 3 s of launch when cached.
- **Accessibility for 4–5-year-olds:** tap targets ≥ 64 px; no reliance on reading; high contrast in both themes; reduced-motion option; left-handed layout (mirrors fixed controls); haptic tick on supported devices; captions in a rounded, friendly sans-serif with clear a/g forms.

---

## 12. Art and theming

**Asset classes**

| Class | Count | Source | Notes |
|---|---|---|---|
| Core vector set | ~300 objects, 30 scenes, UI | AI-generated under one style prompt, vectorised, cleaned, reviewed; open-licence vector packs for common objects (licences recorded in the asset manifest) | Fully themeable |
| Scenario doodle pairs | ~50 | AI-generated in a consistent doodle style (3 px line, limited palette), vectorised, reviewed | Look right on paper and flat backgrounds |
| Procedural pictures | unlimited | mazes generated; dot-to-dot and colour-in derived from the vector set's outlines and closed regions | No extra drawing |
| Buddy | 1 rig | layered vector rig (head, trunk, ears, eyes, brows, mouth, body, arms, legs, accessory) | 10 expressions, idle loop, 6 dances, 5 actions, "your turn" variants, reactions |

**Style guide (Storybook):** warm paper background, crayon-stroke outlines, muted warm palette, slight rotation and paper grain on cards. **Soft Flat:** flat pastel fills, no texture, rounded geometry, calm motion. Both share the same shapes; a theme is a token file (colours, radii, type, textures, motion durations, sound set) plus a rendering filter for outlines and grain.

**Review step:** every generated asset passes a quick checklist (recognisable at 120 px; consistent line weight; no text baked in; transparent background; tagged) before it enters a pool.

---

## 13. Architecture overview

Units and boundaries (technology choices are made in the implementation plan, within these constraints):

| Unit | Responsibility | Depends on |
|---|---|---|
| App shell | routing (Hello, Home, Map, Game, Parent), install/offline, theme loading, time-of-day | Theme, Profile store |
| Content packs | static data: pools, templates, scenes, lines, stories, events, glyphs; validated at build time | — |
| Round generator | template + seed + history → round (items, slots, wording, scene, difficulty) | Content packs, Progress store |
| Mechanics | 23 interactive components; each takes a round and emits attempt events | Audio, Theme |
| Home scenes | 9 scripted scenes composing mechanics with bespoke art and lines | Mechanics, Audio, Buddy |
| Buddy animator | rig, expressions, idle, moves, reactions; a single API (`express`, `say`, `perform`, `react`) | Audio, Theme |
| Audio manager | line resolution chain, clips, TTS, SFX, music ducking, replay, unlock | Content packs |
| Progress store | sessions, attempts, set results, routine events, check-ins, stickers, unlocks, writing samples; mastery-by-form; template picker inputs | Storage |
| Rewards | sticker awarding, ladder, unlock ceremonies | Progress store, Buddy |
| Parent corner | gate, views, settings, exam-prep launcher, backup/restore | Progress store, Content packs |
| Exam-prep | paper definitions, paper rendering, marking | Mechanics, Round generator |
| Storage | on-device persistence, export/import, schema versioning | — |

**Data flow for one round:** Map tap → template picker (progress store) → round generator → mechanic renders and voices the prompt → child input → mechanic emits `attempt` → progress store updates mastery → rewards decide sticker/celebration → Buddy performs → back to Map.

**Error handling:** a missing picture renders a neutral placeholder and logs the asset id (never blocks a round); a missing clip falls through the audio chain; a storage write failure keeps the session in memory and shows a quiet warning in the parent corner; a template that fails validation is excluded at build time, not at play time; any runtime exception inside a mechanic ends the round gracefully (sticker kept) and returns to the Map.

---

## 14. Testing strategy

| Layer | What is verified | How |
|---|---|---|
| Round generator & variation rules | the correct answer never sits in one slot three times running, and only goes to a slot at most one use ahead of the least-used; no item repeats within 3 sessions for a goal; mechanic rotation whenever a topic is played again; difficulty ramps up/down as specified; determinism from seed, level and history (every recorded round replays) | automated tests on seeded rounds, including property-style checks over thousands of generated rounds |
| Mastery & bridging | status transitions; ≥ 3 forms required; bridging picks a known-good form after a miss on a new form | automated tests over synthetic histories |
| Audio chain | every line id resolves; name splicing; fallback order; stale-clip detection | automated tests + content validation |
| Content validation | every template references existing pools, assets, lines; each topic meets its variant minimum; every glyph has a reference path and zone rule; every line has a clip or TTS text | runs on every change; the build fails on errors |
| Mechanics | each component with simulated taps, drags and pen strokes; feedback sequence (hint → show); exit mid-set keeps stickers | component tests |
| Write scorer | a "golden strokes" set per glyph: great / nearly / poor samples, including placement errors (body letter written in the ascender zone; descender not reaching the bottom red) | automated tests against the golden set |
| Devices | iPad Safari: pencil, palm rejection, pressure, audio unlock, home-screen install, offline launch; Android Chrome tablet; one phone layout pass | manual checklist per milestone |
| Performance | smooth animation on the reference tablets; island pack size limits | automated size checks; manual frame checks |
| Playtest with the child | can start alone; understands prompts without reading; replays a game willingly; "your turn" lands; frustration points; routine completion without help | short checklist per milestone; `replayRound` regenerates any round she struggled with from its stored attempt |

---

## 15. Phasing

Four milestones, each a playable vertical slice, in priority order. Durations are decided in the implementation plan.

**M1 — First visit.** App shell with install and offline; profiles; Storybook theme; audio manager with AI clips and TTS fallback; round generator with all variation rules and mastery logging; 8 mechanics (tap-the-one, tap-all-that-match, drag-to-match, sort-into-bins, sequence, give-to-buddy/dress-buddy, scrub, scene-then-choose); Buddy with 5 expressions, idle, 2 dances, 2 actions, celebrations and "your turn"; stickers; timer wind-down; Home with Brush teeth, Get dressed and Meal time; feelings check-in (the balloon breath arrives with breathe-along in M2); Map with all five islands and two topics each:

| Island | M1 topics (templates) |
|---|---|
| Letter Land | Letters A–Z (tap-the-one) · Capital ↔ small (drag-to-match) |
| Sound Garden | Rhyming words (drag-to-match) · Short vowels & CVC (tap-the-one with spoken word) |
| Number Hill | Big & small (tap-the-one, sort-into-bins) · Counting (drag-to-match, give-to-buddy) |
| Our World | Good habits & manners (sequence, tap-all-that-match) · Fruits, veg & healthy food (sort-into-bins, give-to-buddy) |
| Feelings Forest | Feelings (tap-the-one, scene-then-choose) · Kind & fair (scene-then-choose) |

Parent corner: gate, timer, basic progress list. **Spikes done in M1:** pencil + palm rejection in Safari, audio unlock, home-screen install, storage persistence.

**M2 — Habits & feelings depth.** The other six Home scenes; the random-event pool; Story & bed with 3 stories; all Awareness and Wellness templates (72); the mechanics they need (find-in-scene, assemble, listen-and-find, memory-flip, breathe-along, odd-one-out, maze, colour-in, tap-the-one with `pairs`); Buddy's full 10 expressions, 6 dances, 5 actions; the reward ladder and unlock ceremonies; free-play corners; feelings and habits views in the parent corner.

**M3 — Letters, numbers & exam-prep.** All Literacy, Phonics and Numeracy templates (91); the full write mechanic (four lines, modes, placement scoring, ghost animation, pencil); dot-to-dot → colour-in, colour-by-number, pattern-next, shape-fit, stack-by-size, spot-the-difference, pop-the-right-ones; exam-prep mode with the DPS Numeracy paper; progress-by-form and the writing gallery complete; difficulty ramps tuned.

**M4 — Polish & second skin.** Soft Flat theme; left-handed layout; reduced motion; backup and restore; "today's focus"; phone layout pass; Heart-lines recording in the parent corner; UKG level tagging; content tooling (pool editor, asset review checklist, line/clip regeneration).

---

## 16. Out of scope for v1

Accounts or cloud sync · in-app AI content generation · Telugu or Hindi · native app-store builds · multiplayer · speech recognition for phonics (a later candidate) · teacher or school features · Nursery and UKG content (the model supports levels; content later) · live weather · ads or purchases (never) · camera or sensors for "your turn".

---

## 17. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Art-pipeline consistency across hundreds of assets | one style prompt and guide; small batches; the review checklist before an asset enters a pool; procedural pictures reduce the count |
| Pencil / palm-rejection quirks in iPad Safari | spiked in M1 with a throwaway page before the write mechanic is built |
| Hundreds of voice lines to generate and keep in sync | lines are a table; clips generated in batches; the validator flags stale clips |
| iOS evicting web storage | home-screen install recommended on first run; monthly backup nudge; restore flow tested in M4 |
| Games feeling same-y despite variation | flavour layer (scenes, lines, music), pool audits for breadth, Buddy's reactions, and the child's playtests each milestone |
| The child disengages from the routine gate | due steps are short (under a minute each) and fun first; the parent can lower the number of due steps; playtest in M1 |
| Scope growth | the catalogue is the v1 list; new ideas go to a backlog section in the plan, not into M1–M3 |

---

## Appendix A — DPS Vijayawada EY2 Term 1 Numeracy paper (formats mirrored)

| Q | Wording | Marks | Mechanic in exam-prep |
|---|---|---|---|
| 1 | Match the same fruit | 2 | drag-to-match |
| 2 | Colour the different picture among the given pictures | 2 | tap-the-one (then colour-in) |
| 3 | Look at the pictures and tick the big one | 2 | tap-the-one |
| 4 | Circle the pictures which are full | 2 | tap-all-that-match |
| 5 | Tick the animals which are outside | 2 | tap-all-that-match |
| 6 | Match the picture with the correct shape | 5 | drag-to-match |
| 7 | Count and match with the correct number | 6 | drag-to-match |
| 8 | Count seeds and circle the correct number | 6 | tap-the-one |
| 9 | Trace and write the missing numbers | 5 | write (four lines) + sequence |
| 10 | Complete the pattern by drawing the next shape | 10 | pattern-next |
| 11 | Join the numbers in a sequence by drawing the line | 8 | dot-to-dot |

## Appendix B — Source worksheet folder map (syllabus)

`~/Documents/Worksheets/LKG Practice Worksheets` — 1,346 PDFs, matched to the *My First Steps with Cambridge* Lower KG syllabus and to the DPS EY2 Term 1 papers.

| Subject | Topics (worksheet count) |
|---|---|
| 1 Literacy (459) | Pre-writing strokes (9) · Letters A–Z (359: colour, learn, trace, write, letter sound, words) · Alphabet & missing letters (36) · Capital & small (8) · Beginning sounds (47) |
| 2 Phonics (59) | Short vowels & CVC words (37) · Rhyming words (22) |
| 3 Numeracy (593) | Same/different (12) · Big/small (12) · Tall/short (13) · Long/short (9) · Heavy/light (8) · Full/empty (6) · More/less (20) · Inside/outside/above/below (27) · Near/far (2) · Before/after/between (19) · Opposites (12) · Sorting & odd one out (29) · Patterns (24) · Shapes (55) · Colours (23) · Numbers 1–10 (144) · Numbers 11–20 (31) · Numbers up to 50 (6) · Counting (102) · Missing numbers & order (39) |
| 4 Awareness (213) | Body & senses (29) · Me, family & home (17) · My school (9) · Fruits, veg & healthy food (24) · Animals (56) · Plants & flowers (13) · Seasons, weather & clothes (24) · Transport (8) · Community helpers & places (19) · Good habits & manners (14) |
| 5 Wellness (22) | Feelings & me (22) — split in this design into Feelings · Kind & fair · Calm & me |
