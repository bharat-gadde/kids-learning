# Buddy — an interactive learning game for Lower KG

A touch-first web app for a child aged 4–5: look after Buddy the baby elephant through the day (habits, manners, feelings) and play mini-games together on a map covering the *My First Steps with Cambridge* Lower KG syllabus.

- **Design specification:** [docs/superpowers/specs/2026-10-01-buddy-learning-game-design.md](docs/superpowers/specs/2026-10-01-buddy-learning-game-design.md)
- **Engine plan:** [docs/superpowers/plans/2026-10-01-plan-1a-m1-engine.md](docs/superpowers/plans/2026-10-01-plan-1a-m1-engine.md)
- **Status:** the engine (Plan 1A) is built; the playable M1 app (Plan 1B) is next.

## Engine (Plan 1A)

Framework-free TypeScript under `src/engine/`; content as JSON under `content/`.

| Command | What it does |
|---|---|
| `npm test` | all engine tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run validate` | cross-reference and rule checks on the content pack (`--strict` fails on warnings) |
| `npm run inspect -- <templateId> [--seed N] [--level 1\|2\|3]` | print the set a seed and level make with no history (a goal's first set) |
| `npm run voice -- [--dry-run] [--prune]` | generate voice clips with Azure Speech (needs `.env`) |
| `npm run check` | typecheck + tests + validate |

Content lives in `content/*.json` and `content/templates/*.json`; adding a game is adding a template and, if needed, pool items and lines. Run `npm run validate` after every content change.
