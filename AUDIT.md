# AUDIT.md — Phase 1 Simulation Review

> Read-only findings. No code changed. Scope: all files in `src/`.

---

## 1. Critical Bugs (break the game)

### 1.1 Scoring penalty drains points every tick — `updateScoreFromConflicts`

**File:** `src/core/scoring.ts:69`

```ts
export function updateScoreFromConflicts(score: ScoreState, conflicts: ConflictPair[]): ScoreState {
  const violations = conflicts.filter(hasSeparationViolation);
  return {
    ...score,
    separationViolations: score.separationViolations + violations.length,
    totalScore: score.totalScore - violations.length * 500,
  };
}
```

This function is called **every tick** (10 times per second) from `useSimStore.tick`. A single `critical` conflict pair persisting for 30 seconds costs `30 × 10 × 500 = 150,000 points`. A landing gives 200. The score will go deeply negative the moment any separation issue occurs and is effectively unrecoverable. The fix is to apply this penalty only when a conflict is *newly detected*, not continuously.

---

### 1.2 Heading commands are almost completely ignored — `manualRouteActive` is computed but never gates route guidance

**File:** `src/core/physics.ts:34–73`

```ts
const manualRouteActive =
  typeof aircraft.manualRouteUntil === "number" && simTime < aircraft.manualRouteUntil;
const routeGuidanceEnabled = routeCanGuide;   // ← manualRouteActive is NEVER used here
```

`routeGuidanceEnabled` ignores `manualRouteActive` completely. Route guidance runs every tick regardless. When a heading command is issued, `manualRouteUntil` is set, the blending tries to ease in: `routeWeight = 0.18 + progress * 0.82`. At `t=0` the route already has 18% weight; at `t=40s` the route has 100% weight. The aircraft barely turns before being pulled back to the route. Issuing `hdg 090` to a plane heading for its waypoint produces almost no visible turn. The route should be **completely suspended** while `manualRouteActive` is true, with a clean handoff back to route guidance at the end of the window.

---

## 2. Serious Bugs (wrong behaviour, confusing to players)

### 2.1 Departure heading computed from runway key string, not actual heading

**File:** `src/core/spawner.ts:179`

```ts
const departureHeading = assignedRunway
  ? Number(assignedRunway.split("-")[1]) * 10   // "SABE-13" → 13 * 10 = 130
  : routeHeading;
```

Runway 13 (SABE) has actual heading `131°` per constants. Runway `31` would give `310°` — correct. Runway `01` (SUMU) gives `10°` — actual `10°` OK. Runway `02` (SAAR) gives `20°` — actual `20°` OK. Runway `13` (SAZM) gives `130°` — actual `130°` OK. Only SABE-13 (131° vs 130°) is off by 1°, which is minor, but the *approach* is architecturally wrong: `resolveRunwayToken()` already exists and returns the authoritative heading. The spawner should use it.

---

### 2.2 `seenConflicts` never evicts resolved conflict keys

**File:** `src/store/useSimStore.ts:352–366`

```ts
const seenConflicts = new Set(state.seenConflicts);
for (const conflict of conflicts) {
  const key = conflictKey(conflict);
  if (!seenConflicts.has(key)) {
    seenConflicts.add(key);
    conflictEvents.push(...);
  }
}
```

Keys are added but never removed. A conflict that resolves and then re-occurs (e.g. two aircraft spiralling around each other) will fire the event only once, for the lifetime of the session. The set should be pruned each tick to only contain keys still present in the active `conflicts` array.

---

### 2.3 `separationViolations` counter increments every tick

**File:** `src/core/scoring.ts:69`  
Same call site as Bug 1.1. `score.separationViolations` increases by `violations.length` 10 times per second. A 10-second critical conflict registers as `100 violations`. The displayed "vio" counter is meaningless.

---

### 2.4 Approach ILS capture altitude window is very tight with no player feedback

**File:** `src/core/approach.ts:41`

```ts
if (distanceNm <= 18 && headingError <= 30 && altitudeDelta <= 1800) {
```

At 18nm, the glideslope altitude is `elevation + 18 × 318 ≈ 5724ft` (sea-level runway). An en-route aircraft at FL80 is `~2276ft` above glideslope — capture fails silently. The plane continues to track its route, the player sees nothing happen after issuing `app SABE-13`, and there is no event or UI feedback explaining *why* capture didn't occur. Correct ATC would require the aircraft to be at or below ~7500ft at 18nm. Neither the panel nor the chat parser tells the player this constraint exists.

---

### 2.5 `useKeyboard` recreates the handler on every pause/resume toggle

**File:** `src/hooks/useKeyboard.ts:23`

```ts
useEffect(() => {
  const onKeyDown = (event: KeyboardEvent) => { ... };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [paused, selectAircraft, setPaused, setSpeed]);
```

`paused` is in the dependency array so the listener is torn down and re-added every time space is pressed. During the brief gap between remove and re-add, a rapid double-tap can fire both. The `paused` value should be accessed via a ref inside the effect to remove the dependency.

---

### 2.6 `CommandPanel` `approachRunway` initialises from the first active runway and never resyncs

**File:** `src/components/Panels/CommandPanel.tsx:18`

```ts
const selectedRunway = useMemo(() => activeRunways[0] ?? "", [activeRunways]);
const [approachRunway, setApproachRunway] = useState(selectedRunway);
```

`useState` runs only once; `selectedRunway` from `useMemo` is not fed back into the state on subsequent renders. If the player selects an aircraft at SUMU but the runway list opens on `SABE-13`, the takeoff button sends the wrong runway token, which the engine correctly rejects — but silently, so the player is confused. Note: `CommandPanel` is currently **dead code** (not imported by `App.tsx`), so this is not live. But if the component is ever revived it will misbehave immediately.

---

## 3. Logic / Design Weaknesses

### 3.1 Holding pattern is a continuous left spiral, not a racetrack

**File:** `src/core/physics.ts:77`

```ts
if (aircraft.status === "holding") {
  heading = normalizeHeading(heading + aircraft.turnRate * dt);
}
```

The aircraft turns indefinitely at `turnRate deg/s` while also advancing along its current heading. The result is a shrinking spiral, not the standard racetrack oval. Fine for Phase 1 but will need proper inbound/outbound leg tracking before holding has any strategic value.

---

### 3.2 Holding penalty accrues fractional points every tick

**File:** `src/core/scoring.ts:82`

```ts
const penaltyPerSecond = (10 / 30) * activeHolding;
return { ...score, totalScore: score.totalScore - penaltyPerSecond * dt };
```

`dt = 0.1s` → `penaltyPerSecond × 0.1 ≈ 0.033 pts/tick`. The score becomes a non-integer float displayed as `Math.round()`. This works numerically but `totalScore` is never an integer mid-session. Consider accumulating the penalty and applying it in whole-point increments to keep the display clean.

---

### 3.3 `deriveScoreMetrics` — efficiency approaches 100% when all aircraft have equal route vs direct distance

**File:** `src/core/scoring.ts:96`

```ts
const efficiency = Math.max(0, Math.min(100, safeDiv(routeDirect, routeActual) * 100));
```

`routeDistanceNm` starts at 0 and only grows — `directDistanceNm` is the origin-to-destination great-circle distance fixed at spawn time. For aircraft still taxiing (speed = 0, position = airport), both values are 0 and `safeDiv` returns 0. Efficiency jumps between 0 and 100 depending on whether any aircraft have moved yet. The metric stabilises once all aircraft are airborne but is misleading at mission start.

---

### 3.4 `nearestRouteIndex` scans forward-only, can miss a behind-aircraft waypoint

**File:** `src/core/physics.ts:10`

The function scans from `fromIndex` to end, never backward. If a heading command pulls an aircraft behind its current waypoint (e.g. a U-turn), the nearest-index search will skip the closest waypoint and the aircraft will pursue one further ahead, creating a wide looping detour once manual override expires.

---

### 3.5 `moveAlongHeading` uses equirectangular longitude approximation

**File:** `src/core/geo.ts:57`

```ts
const dLng = (distanceNm * Math.sin(headingRad)) / (60 * Math.cos(latRad));
```

This is the equirectangular approximation. At 35°S, `cos(35°) ≈ 0.819`. For a 300nm flight purely east–west the accumulated longitude error is ~18%. Positions drift visibly from the route polyline on longer legs. `haversineNm` uses proper spherical math for distance checks, so separation detection is correct, but rendered position diverges from the true great-circle path.

---

### 3.6 Wind is displayed but has zero effect on any aircraft

**File:** `README.md`, `src/core/physics.ts` (no wind term anywhere)

The `Wind` object (`{direction: 140, speed: 11}`) is stored in state, rendered in `StatusBar`, and passed nowhere to physics. The README documents this as intentional for Phase 1 — flagged here because it must be resolved before approaches can be realistic (headwind/tailwind changes approach speed and landing distance).

---

## 4. Dead / Unused Code

These components are defined and individually functional but are **not imported anywhere** in the live app:

| File | Status |
|------|--------|
| `src/components/Panels/CommandPanel.tsx` | Replaced by `CommandChatPanel` |
| `src/components/Panels/FlightStrip.tsx` | Replaced by `OperationsPanel` inline strips |
| `src/components/Panels/FlightStripRack.tsx` | Same |
| `src/components/Panels/ScorePanel.tsx` | Score shown inline in `OperationsPanel` |
| `src/components/Panels/SimControls.tsx` | Replaced by `SimDock` |

`src/App.tsx` (root) also exists alongside `src/components/App.tsx`; only the latter is actually used (imported from `src/main.tsx` via `src/components/App.tsx`). The root `src/App.tsx` is an empty dead file.

---

## 5. Minor / Cosmetic Issues

| # | Location | Issue |
|---|----------|-------|
| M1 | `EventLog.tsx:29` | React key is `${timestamp}-${index}` — index-based part is unstable when events prepend |
| M2 | `approach.ts:104` | `removeAt = time + 10` — aircraft disappear 10s after landing, too fast for any post-landing feedback |
| M3 | `useKeyboard.ts` | Key `3` maps to speed 4× (label mismatch: "3 or 4 → 4x", but UI shows no 4x label for key 3) |
| M4 | `separation.ts:57` | `vv` for closest-approach projection uses only x/y velocity components; `t` is 2D-optimal but alt projection reuses it — minor inaccuracy for steep climbs |
| M5 | `SimMap.tsx` | `onSelectAircraft` passed as both `MapClickCapture` and individual `AircraftMarker` with no `stopPropagation` — clicking a marker fires both handlers (clear then immediately reselect depending on event order) |

---

## 6. Summary Priority List

| Priority | ID | Bug |
|----------|----|-----|
| P0 | 1.1 | Conflict penalty runs every tick → score destroyed in seconds |
| P0 | 1.2 | Heading command override doesn't actually suppress route guidance |
| P1 | 2.2 | `seenConflicts` never evicts → repeat conflicts never re-alert |
| P1 | 2.3 | `separationViolations` counter increments 10×/sec |
| P1 | 2.4 | ILS capture fails silently when aircraft is above glideslope |
| P2 | 3.1 | Holding is a spiral, not racetrack |
| P2 | 3.4 | `nearestRouteIndex` can't look backward past a waypoint |
| P2 | M5 | Map click fires both clear and select simultaneously |
| P3 | 4.x | 5 dead components + dead `src/App.tsx` |
| P3 | 2.1 | Departure heading uses `key × 10` instead of `resolveRunwayToken` |
| P3 | M2 | Aircraft removed 10s after landing |

---

## 2. Weak Mechanics Assessment

### 2.1 Feel-check Questions

#### Is it obvious what's happening?

**No, not for a new player.** Several information layers are invisible or require expert knowledge:

- **Aircraft icons have no directional shape for the normal state.** The CSS icon for a non-conflicting aircraft is a 16×16px filled green circle (`clip-path: none`). A circle has no heading direction. The only directional cue is the dashed 60-second vector line — which is very thin and easy to miss. Warning-state aircraft use an upward triangle (`.triangle { clip-path: polygon(50% 0%, 100% 100%, 0% 100%) }`) which at least rotates visibly, but normal aircraft look like blinking dots. A player watching four green circles has no intuitive sense of which way any plane is going.

- **All aircraft start stationary.** The mission spawns four `taxiing` flights at zero speed. The map shows four motionless dots. Nothing is labeled "you must clear these for takeoff". A new player will wait for something to happen and nothing will.

- **Command syntax is undiscoverable.** The chat panel opens with one help line: `Examples: hdg 180 | alt 5000 | alt FL120 | spd 220 | app SABE-13 | hold | ga | takeoff SABE-13`. The `app SABE-13` format requires knowing ICAO codes and runway end numbers. Typing `approach runway 13` or `land SABE` produces an error with no suggestion. The `ga` abbreviation for go-around is opaque.

- **Conflict reason is not shown in the strip list.** When `AR1901` shows `ALERT`, the strip provides no information about *which* aircraft it's conflicting with or how far away. The event log has the detail, but it's below the fold and written in jargon (`AR1901 and UY2102 warning 4.2nm/800ft`).

- **The map uses `dark_nolabels` tiles.** There are zero place names, street names, or geographic labels. The Río de la Plata is visible as a dark body of water but has no label. ICAO codes (SABE, SUMU) label airports, but a player who doesn't know Argentine aviation geography sees four anonymous dots on a dark map.

#### Is there downtime?

**Yes — severe downtime in the middle third of each session.** The flow is:
1. Session opens: 4 stationary dots, nothing happening, player must figure out what to do (dead time: ~30–120 seconds until first takeoff).
2. After clearing all 4 takeoffs: planes fly their routes. SABE→SAZM is ~290nm, roughly 9 minutes at 250kt, 2.25 minutes at 4×. During this time no new aircraft spawn (`nextSpawnIn = Infinity`), no events occur, the score doesn't change. There is nothing to do except watch.
3. Approach phase: planes need to be descended and vectored onto ILS. This is the only interesting period, but the heading command override bug (`manualRouteActive` not gating route guidance) means commands barely work and the player can't reliably vector aircraft.

At 1× speed a full session involves roughly 18–24 minutes of real time, of which perhaps 2–3 minutes are active. That is 90% downtime.

#### Is there panic?

**Almost never at 1×, guaranteed score destruction at 4×.** The four mission aircraft start at airports 150–290nm apart. Their routes cross different fixes at different altitudes. The `projectClosestApproach` 120-second lookahead occasionally flags warning states, but conflicts rarely escalate to critical because the planes have plenty of altitude separation during cruise. When conflicts *do* occur, the per-tick scoring penalty (`−500 × violations × 10 per second`) destroys the score within seconds, which is frustrating rather than tense. There is no gradual pressure — only a sudden score collapse that can't be recovered from.

#### Is death instant or gradual?

**Gradual visually, but instant in score terms.** The three severity tiers (warning→critical→collision) with distinct shapes and colours give visual escalation. `projectClosestApproach` predicts 120 seconds ahead, so there *is* a lookahead window. However:

- The per-tick penalty means the player's score begins collapsing at the *warning* stage, long before any visual collision. By the time the red diamond appears, the score is already −50,000 or worse.
- The `seenConflicts` set uses severity in the key, so warning→critical does fire a second alert event. This is actually good. But the continuous score drain makes the distinction meaningless.
- Collisions in the current mission are unlikely from normal gameplay because all aircraft start at separate airports. If a collision does occur it would feel random (two planes whose routes happened to cross at the same altitude/time) rather than earned.

#### Are landings satisfying?

**No.** The landing event is:
1. A single event log entry: `AR1901 landed SABE-13`.
2. Score increases by 200 points.
3. After 10 seconds (`removeAt = time + 10`), the aircraft marker vanishes.

There is no visual touchdown cue, no colour change on landing, no rolling-out animation, no audio. The marker just disappears while still in the air or at ground level (the physics sets `altitude = runway.elevation`, `speed = 0`, but the icon remains a standard circle until removal). The 10-second window is too short to register as a meaningful "debrief" moment; it reads as the plane glitching out.

---

### 2.2 Common Weak Mechanics

#### No preview of target-heading track

**Present but insufficient.** `AircraftMarker.tsx:48` draws a 60-second projected vector: `const projected = projectPosition(aircraft, 60)`. This shows where the plane will be on its *current* heading — not on its *target* heading. After issuing `hdg 270`, the vector still shows the old heading until the turn is complete. The player has no way to see whether the commanded heading will clear the conflict before the plane actually turns. This is compounded by the heading-override bug (the plane barely responds anyway).

A second dotted line from current position along `aircraft.targetHeading` for 60 seconds would make command outcomes visible immediately.

#### Conflict alerts come too late **for re-occurring conflicts**

The 5nm warning threshold with 120-second lookahead is reasonable for first detection. However, the `seenConflicts` set is never pruned (`useSimStore.ts:353`). Once a conflict key is recorded, it is never removed — even if the aircraft separate and later re-converge. The second approach generates no event, no colour change re-trigger, and no audio. The player sees the conflict line appear on the map but receives no alert. This makes recurring conflicts invisible.

#### Runway management is invisible on the map

`RunwayOverlay.tsx:22-31` — all runways render with identical styling (`color: "#445566"`, weight 4). There is no visual difference between an active runway (`SABE-13`) and an inactive one (`SABE-31`). The only indication of active runways is the text string in `StatusBar`: `SABE-13, SUMU-01 +2`. A player trying to understand why `app SABE-31` was rejected (`Runway SABE-31 is not active`) has no map affordance to explain it. Active runways should have a distinct colour (green) on the map overlay.

The approach path/ILS cone is also invisible. There is no extended centreline drawn from the runway threshold showing the inbound track. Players cannot see where the ILS capture zone begins or which direction aircraft should intercept from.

#### Aircraft performance is identical in practice

`constants.ts:350-375` — three performance tiers (`heavy`, `medium`, `light`) with meaningfully different speeds, climb rates, and turn rates. However, all four mission aircraft are category `"medium"`. The differentiation exists in the code but is untested in the mission. A heavy B747 and a light Cessna would handle completely differently, but the player never encounters this. There is no variety in the current mission to demonstrate that the performance system works.

#### Score doesn't communicate progress

The score display (`OperationsPanel.tsx`) shows:
- A raw point total that is almost certainly negative after any conflict.
- `N vio` — a violations counter that inflates at 10×/second (see Stage 1 finding).
- `efficiency %` — stuck at 100% for most of the session (formula issue, Stage 1).

There is no: trend indicator, best-score comparison, per-session breakdown, or post-mission grade. The number going up when a plane lands is the only positive feedback, and it's swamped by the negative drift from the per-tick penalty.

#### No sense of location

The `dark_nolabels` tile eliminates all geographic context. Key missing elements:
- No city labels (Buenos Aires, Montevideo, Rosario are the three major urban centres the airports serve — their names never appear).
- The Río de la Plata estuary is the dominant geographic feature and a natural landmark for orientation. It appears as a shape on the dark tile but is unlabelled.
- No compass rose. The map convention is north=up, but this is never stated.
- Airport labels are ICAO codes only (`SABE`, `SUMU`). The full name only appears in `FlightStrip`, which is dead code.
- The `AirspaceOverlay` TMA circle is labelled `REGIONAL TMA 210NM / FL300` — meaningful to pilots, opaque to general players.

---

### 2.3 Hidden Complexity

#### Magnetic vs true heading

**True heading used throughout, consistently.** `bearingFromTo` in `geo.ts:43` computes geodesic (true) bearing. All commands (`hdg 270`) are interpreted as true heading. No magnetic variation is applied. Buenos Aires magnetic variation is approximately 9°W, so a real controller would issue `hdg 261` for a true-west track. This is correct for a game — true heading is simpler and more predictable. It just needs a comment in the codebase confirming the choice so future contributors don't introduce magnetic offsets.

#### Wind is decorative and actively misleading

`useSimStore.ts:204` — `wind: { direction: 140, speed: 11 }` is a static hardcoded value. It is displayed in `StatusBar` as `140 / 11kt`. It has no effect on aircraft physics, approach paths, landing distances, or fuel burn.

This is worse than omitting wind entirely. Players who see "140/11kt" alongside an aircraft on final approach for runway 13 (heading 131°) will notice the nearly direct tailwind and wonder why the aircraft isn't being pushed off course. When they issue commands to compensate and nothing happens, they will distrust the entire display. Either apply wind drift to `moveAlongHeading` or remove the wind display entirely.

#### Time compression does not break ILS physics

At 4× speed, 40 physics ticks fire per real second (each still `FIXED_DT = 0.1s`). The glideslope target is recalculated each tick from `elevation + distanceNm * 318`. Per tick at approach speed 140kt:
- Distance covered: `(140/3600) × 0.1 = 0.00389nm`
- Glideslope drop: `0.00389 × 318 = 1.24ft`
- Aircraft max descent step: `(2000fpm / 60) × 0.1s = 3.33ft`

The aircraft can descend 3.33ft to follow a 1.24ft glideslope drop — easily. ILS guidance is position-based, not wall-time-based, so 4× speed does not destabilise it. ✅

However, at 4× speed the **player** has 25% of normal reaction time to issue approach clearances before aircraft overshoot the destination. This is a game design concern worth acknowledging but is not a physics bug.

#### Separation comparisons use raw feet, not flight levels

`separation.ts:87` — `Math.abs(a.altitude - b.altitude)`. Altitudes are stored as floating-point feet throughout. No FL integer arithmetic anywhere. ✅

---

### 2.4 Additional Design Observations

#### The `radarPulse` animation is applied to every Leaflet path

`index.css:679-682`:
```css
.leaflet-overlay-pane path {
  animation: radarPulse 2.8s ease-in-out infinite;
}
```
This animation fires on *all* paths: runway lines, TMA circle, aircraft vectors, route overlays, and conflict alert lines. The result is that a red conflict line and a grey runway line have identical animation behaviour. The pulse is a strong signal that loses meaning when everything pulses. Conflict lines should pulse rapidly; static infrastructure should not pulse at all.

#### The approach command requires exact ICAO-runway token knowledge

`chatCommandParser.ts:108-115` — `app SABE-13` works; `app 13` works if the destination airport can be inferred from context; `approach runway 13` fails. The `resolveRunway` function does partial matching on runway suffix but only when `preferredAirport` is available. Since `approachAirport` is passed as `aircraft.destination`, partial matching works correctly *if* an aircraft is selected. But the error message when full matching fails (`"Approach format: app SABE-13 (or app 13)."`) is the only hint that shorter forms are accepted. The help text in `HELP_TEXT` shows only the long form `app SABE-13`.

#### The `ops-metrics-grid` has a 10-column layout that will overflow

`index.css:621` — `grid-template-columns: auto auto auto auto auto auto auto auto auto auto` (10 columns). The metrics shown are 5 label+value pairs rendered as 10 cells in a single row. On a 430px sidebar this is approximately 43px per cell for labels like "Collisions" and "Go-around". These will either overflow or truncate on any display narrower than ~600px for the sidebar.
