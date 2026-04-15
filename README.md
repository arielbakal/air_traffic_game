# Buenos Aires AI ATC Simulator (Phase 1)

Deterministic air traffic control simulator for Buenos Aires TMA using React, TypeScript, Leaflet, and Zustand.

## Included in this phase

- Real airport data for SAEZ, SABE, SADF, SADP (coordinates, runways, frequencies)
- TMA overlay and runway drawing on dark radar map tiles
- Deterministic simulation tick loop (10 Hz physics + RAF rendering)
- ATC commands: heading, altitude, speed, approach, hold, go-around, takeoff
- Separation and collision detection with projected closest approach alerts
- Approach capture, glideslope guidance, landing and go-around logic
- Weighted traffic spawning using the requested flight templates
- Event-driven score tracking, efficiency metric, and event log
- Keyboard shortcuts and responsive panel/map layout

## Stack

- React 18 + TypeScript + Vite
- Zustand for state and game actions
- Leaflet / react-leaflet for map rendering
- Tailwind configured + custom radar theme CSS

## Run

```bash
npm install
npm run dev
```

Build and lint:

```bash
npm run build
npm run lint
```

## Controls

- `Space`: pause / resume
- `1`: speed 1x
- `2`: speed 2x
- `3` or `4`: speed 4x
- `Esc`: clear selected aircraft

## Project layout

- `src/core`: pure deterministic simulation modules
- `src/store/useSimStore.ts`: Zustand single source of truth
- `src/hooks`: game loop and keyboard wiring
- `src/components`: map overlays, HUD, and control panels

## Notes

- No backend is used in this phase.
- Wind is displayed for immersion but does not currently affect flight dynamics.
- The engine is designed to stay pure and portable for future AI and multiplayer phases.
