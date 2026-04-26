# Contributing to ATC Simulator

Thanks for your interest in contributing. This guide covers everything you need to go from zero to a merged pull request.

---

## Prerequisites

- **Node.js 20+** and **npm 10+**
- **Ollama** with `qwen3:8b` — only required for AI and Collaborative controller modes

---

## Local setup

### Frontend only (Human mode — no backend needed)

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The full simulation runs in-browser.

### Full stack (AI / Collaborative modes)

```bash
npm install
cd apps/server && npm install && cd ../..
cp .env.example apps/server/.env   # edit if needed
cd apps/server && npm start &      # backend on :3001
npm run dev                        # frontend on :5173
```

---

## Understanding the codebase

Before making any change, read the relevant documentation:

- **[CLAUDE.md](./CLAUDE.md)** — architecture overview, state management, game loop
- **[MECHANICS.md](./MECHANICS.md)** — full simulation rules (ILS, separation, scoring, holding)
- **[AGENT.md](./AGENT.md)** — AI agent design, LLM interface, Socket.IO event schema

### Where to look for what

| I want to change… | Look at… |
|---|---|
| Aircraft physics / movement | `packages/core/src/physics.ts`, `approach.ts` |
| Scoring or mission rules | `packages/core/src/scoring.ts` |
| Available ATC commands | `packages/core/src/commands.ts`, `constants.ts` |
| Flight templates / airports | `packages/core/src/constants.ts` |
| AI agent decisions | `apps/server/src/agent.ts`, `prompts.ts` |
| Safety overrides | `apps/server/src/safetyEngine.ts` |
| Radar map display | `src/components/Map/` |
| HUD / overlays | `src/components/HUD/` |
| Command panels | `src/components/Panels/` |
| Game state and actions | `src/store/useSimStore.ts` — read MECHANICS.md first |
| Game loop timing | `src/hooks/useGameLoop.ts` |

---

## Making changes

### Good first issues

Low-risk changes that are great entry points:

- **Add a flight template** — new entry in `packages/core/src/constants.ts` under `FLIGHT_TEMPLATES`. No logic changes; immediate visual feedback in the sim.
- **Add a keyboard shortcut** — `src/hooks/useKeyboard.ts` and the relevant Zustand action.
- **Improve a map overlay** — new component in `src/components/Map/`, registered in `SimMap.tsx`.
- **Improve documentation** — corrections or additions to MECHANICS.md or AGENT.md.

### Changes that need a discussion issue first

Open a GitHub Issue before writing code if your change touches:

- The physics tick loop (`physics.ts`, `useSimStore.tick`)
- The Socket.IO event schema between frontend and backend
- The AI prompt or JSON output schema in `apps/server/src/prompts.ts`
- Separation thresholds or scoring formulas

These have downstream effects that are easy to miss from a single file.

---

## Commit messages

Use the conventional commit format with a scope that mirrors the package structure:

```
feat(core): add wake turbulence category to separation thresholds
fix(store): deselect aircraft correctly on restart
fix(server): handle Ollama timeout without crashing
docs(mechanics): clarify glideslope intercept altitude formula
chore(ci): pin Node to 20.x in workflow
```

Scopes: `core`, `store`, `server`, `ui`, `docs`, `ci`.

---

## Before opening a pull request

Run both gates locally — CI will enforce them:

```bash
npm run lint    # ESLint across all packages
npm run build   # tsc -b type-check + Vite production build
```

Fix all errors before pushing. The build runs `tsc -b` which type-checks `packages/core`, `apps/server`, and the frontend in dependency order — a type error in core will block the whole build.

---

## Pull request expectations

- One logical change per PR. Bug fix + refactor = two PRs.
- For simulation behavior changes: include the seed value, difficulty, and command sequence that demonstrates the change (visible in the debug overlay — press `` ` ``).
- For new public functions in `packages/core`: add JSDoc.
- No `console.log` statements in submitted code.

---

## Questions?

Open a GitHub Issue with the `question` label, or start a Discussion.
