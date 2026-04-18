# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (Vite)
npm run build      # type-check + production build
npm run lint       # ESLint
npm run preview    # preview production build
```

No test suite is configured.

## Architecture

**Stack:** React 18 + TypeScript + Vite, Zustand for state, react-leaflet for the map, Tailwind CSS.

**Core simulation (`src/core/`)** — pure functions, no React:
- `types.ts` — all shared interfaces (`Aircraft`, `GameState`, `CommandType`, etc.)
- `constants.ts` — airport definitions (SABE, SUMU, SAAR, SAZM), runway tokens (`"SABE-13"`), flight templates, performance profiles by category, difficulty configs
- `physics.ts` — per-tick aircraft movement (heading/altitude/speed interpolation)
- `approach.ts` — ILS capture, localizer/glideslope logic, landing/go-around transitions
- `separation.ts` — conflict detection, returns `ConflictPair[]` with severity
- `scoring.ts` — score mutations driven by events and conflicts
- `commands.ts` — validates and applies `CommandType` to an aircraft
- `spawner.ts` — builds the initial mission scenario (fixed set of flights)
- `chatCommandParser.ts` — parses free-text ATC commands into `CommandType`
- `geo.ts` — bearing/distance helpers

**State (`src/store/useSimStore.ts`)** — single Zustand store (`SimStore extends GameState`). `aircraft` is a `Map<string, Aircraft>`. Key actions: `issueCommand`, `tick`, `restart`. Mission progress is tracked inside the store alongside score.

**Game loop (`src/hooks/useGameLoop.ts`)** — `requestAnimationFrame` loop at 10 Hz (`FIXED_DT = 0.1 s`), scaled by `speed` (1×/2×/4×). Calls `store.tick(dt)` each fixed step; stops when `mission.isComplete`.

**Map layer (`src/components/Map/`)** — Leaflet map centered on Buenos Aires TMA (`MAP_CENTER = {lat: -35.2, lng: -58.4}`, zoom 7). Overlays: `AircraftMarker`, `RunwayOverlay`, `AirspaceOverlay`, `SelectedRouteOverlay`, `ConflictAlert`.

**Panels (`src/components/Panels/`)** — `FlightStripRack` (list of active flights), `CommandPanel` (heading/altitude/speed inputs), `CommandChatPanel` (free-text ATC commands), `OperationsPanel`, `ScorePanel`, `SimControls`.

**HUD (`src/components/HUD/`)** — `StatusBar`, `EventLog`, `SimDock`, `MissionResultOverlay`.

## Key domain concepts

- **Runway token** — `"<ICAO>-<end>"` e.g. `"SABE-13"`. `resolveRunwayToken()` in `constants.ts` converts to heading/threshold.
- **Aircraft lifecycle** — `arriving → approach → landing → landed → taxiing`; departures go `departing → enroute`; `goAround` re-enters the approach sequence.
- **Mission** — fixed scenario from `spawner.ts`; each flight has two objectives: departure cleared + approach cleared. `MissionState.isComplete` pauses the sim.
- **Scoring** — `totalScore` accumulates from landing/departure bonuses, conflict penalties, and holding-time penalties. `deriveScoreMetrics` computes `efficiency` and `averageDelay` each tick.
