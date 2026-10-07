# Buddy — an interactive learning game for Lower KG

A touch-first web app for a child aged 4–5: look after Buddy the baby elephant through the day (habits, manners, feelings) and play mini-games together on a map covering the *My First Steps with Cambridge* Lower KG syllabus.

- **Design specification:** [docs/superpowers/specs/2026-10-01-buddy-learning-game-design.md](docs/superpowers/specs/2026-10-01-buddy-learning-game-design.md)
- **Plans:** [the engine (1A)](docs/superpowers/plans/2026-10-01-plan-1a-m1-engine.md) · [play (1B)](docs/superpowers/plans/2026-10-06-plan-1b-m1-play.md)
- **Status:** the engine (Plan 1A) and the playable Map — all fifteen M1 games, Buddy, celebrations and stickers (Plan 1B) — are built; Buddy's Home, the feelings check-in, the session timer and the parent corner (Plan 1C) are next.

## Engine (Plan 1A)

Framework-free TypeScript under `src/engine/`; content as JSON under `content/`.

| Command | What it does |
|---|---|
| `npm test` | every test (Vitest) |
| `npm run typecheck` | `tsc --noEmit`, then the app alone without Node types (`tsconfig.app.json`) |
| `npm run validate` | cross-reference and rule checks on the content pack, and every picture it names (`--strict` fails on warnings) |
| `npm run inspect -- <templateId> [--seed N] [--level 1\|2\|3]` | print the set a seed and level make with no history (a goal's first set) |
| `npm run voice -- [--dry-run] [--prune]` | generate voice clips with Azure Speech (needs `.env`) |
| `npm run check` | typecheck + tests + validate |

Content lives in `content/*.json` and `content/templates/*.json`; adding a game is adding a template and, if needed, pool items and lines. Run `npm run validate` after every content change.

## The app (Plan 1B)

React under `src/app/`, on the engine: an installable web app that works offline after its first load.

| Command | What it does |
|---|---|
| `npm run dev` | the app at http://localhost:5173 |
| `npm run dev:tablet` | the app over https on the local network, for trying it on the tablet (accept the self-signed certificate once); it does not install or work offline — the published build does |
| `npm run build` / `npm run preview` | the production build in `dist/`, and serving it |
| `npm run art` | fetch the OpenMoji pictures listed in `art/openmoji.json` into `public/art/` (see `art/README.md`) |
| `npm run icons` | render the app icons from `public/icons/*.svg` |

Buddy speaks every line with the device's voice until the voice clips are generated (`npm run voice`).

### Publishing on GitHub Pages

The workflow `.github/workflows/deploy.yml` checks, builds and publishes the app on every push to `main`.

1. Decide what the repository shows. Its `docs/` describe the child (age, school, how they learn), and every commit shows your git email. Either keep the repository private — GitHub Pages from a private repository needs a paid GitHub plan, and the site itself is public either way (the child's data stays on the tablet) — or publish a new repository whose history never held `docs/`: deleting them in a commit leaves them in every commit before it. A public repository is also when to decide whether to name yourself as the licensor of the drawn pictures (`art/README.md`).
2. Create the repository on GitHub, add it as the `origin` remote, and push `main`.
3. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The run that step 2's push started fails at `configure-pages` until then; the next push (or **Actions → Deploy to GitHub Pages → Run workflow**) publishes `https://<user>.github.io/<repository>/`.
4. On the tablet, open that address and add it to the home screen (Safari: **Share → Add to Home Screen**) before setting Buddy up: on an iPad the home-screen app keeps its own data, apart from Safari's. Open it from the home screen once while online (it saves itself for offline then) and set the child up there. It opens full screen and works offline.
5. After a push, the tablet picks up the new version in two steps: open Buddy once while online, then close it (swipe it away) and open it again.

Nothing in the app leaves the device (spec §10): no accounts, no analytics, no requests except the app's own files. One caution: if a device's speech voice is an online one, as some of Chrome's are, the lines it speaks (the child's name among them) go to that voice's provider; the iPad's voices are on the device.

The pictures are OpenMoji and drawings in its style, under CC BY-SA 4.0 ([art/README.md](art/README.md)); the rest of the repository is not licensed for reuse (`UNLICENSED`).
