# Pictures

Every picture the content names lives in `public/art/`, and `npm run validate` fails if one is missing.

- **OpenMoji** — most objects, the faces, routine and kindness cards, baskets, topic signposts, island and UI icons, and the scenes, as listed in `openmoji.json`: an OpenMoji code (the file as published) or a composition of several on plain shapes. `npm run art` writes the missing ones (`-- --force` rewrites all) from OpenMoji 17.0.0. OpenMoji is by HfG Schwäbisch Gmünd (https://openmoji.org) under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); the compositions are adaptations under the same licence. The setup screen credits it.
- **Drawn for Buddy** — what OpenMoji lacks or shows unclearly for a four-year-old, drawn by hand in its style (a 72 × 72 box, 2-unit black outline, its palette), also [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/): `public/art/objects/` ball, blocks, bun, cabbage, chips, comb, dal, fan, handkerchief, mat, milk, mug, nail-cutter, pan, pot, rug, toothpaste, towel. Edit these by hand; `npm run art` never touches them.
- **Buddy** is code (`src/app/buddy/Buddy.tsx`), and so are the scene-then-choose vignettes (`src/app/scenario/vignettes.ts`), because Buddy appears in the colours the child chose.
- **App icons**: `public/icons/icon.svg` and `maskable.svg`; `npm run icons` renders the PNGs.

Spec §12's AI-generated Storybook set can replace any picture later at the same path, with no code change.
