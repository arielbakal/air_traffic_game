# FIXES.md — Ordered Fix Plan

Derived from `AUDIT.md` (Stage 1 checklist + Stage 2 feel assessment).  
Each fix is scoped to one PR-sized change. Ordered within each tier by impact.

---

## CRITICAL — Game is unplayable or produces wrong results

---

### FIX-01 — Conflict score penalty fires every tick

**Files:** `src/core/scoring.ts`, `src/store/useSimStore.ts`

**Bug:** `updateScoreFromConflicts` subtracts `violations × 500` points on every physics tick (10 Hz). A 30-second separation conflict costs 150,000 points; a landing gives 200. The score is unrecoverable after any conflict. `score.separationViolations` also increments 10× per second, making the counter meaningless.

**Fix:** Move the penalty to the conflict-event path, not the continuous tick. In `useSimStore.tick`, the `seenConflicts` set already tracks first-detection. Apply a one-time score deduction (`−500` per newly detected critical/collision pair) inside the `if (!seenConflicts.has(key))` block alongside the event push. Remove `updateScoreFromConflicts` from the tick's scoring chain entirely. The `separationViolations` counter should increment only on new detections (same block), not continuously.

**Verify:** Start game, let two aircraft come within 3nm. Score should drop by exactly 500 once. Leave them in conflict for 30 more seconds — score should not change further. Separate the aircraft and bring them together again — score drops another 500 (new detection after the key was evicted; see FIX-04).

---

### FIX-02 — Heading commands are ignored; route guidance overrides every turn

**Files:** `src/core/physics.ts`

**Bug:** `manualRouteActive` is computed at line 39 but `routeGuidanceEnabled` at line 41 is set to `routeCanGuide` with no reference to it. Route waypoint guidance runs unconditionally. The blending code (lines 62–69) starts at 18% route weight at `t=0` and reaches 100% at `t=40s`, meaning a `hdg 090` command is almost immediately overridden by the pre-planned route.

**Fix:** Gate route guidance on `!manualRouteActive`:
```ts
const routeGuidanceEnabled = routeCanGuide && !manualRouteActive;
```
Remove the blending block entirely (lines 62–69). When manual override is active, `nextTargetHeading` stays as the player-commanded heading. When `manualRouteUntil` expires, `routeGuidanceEnabled` becomes true again and the route resumes naturally on the next tick. `MANUAL_ROUTE_OVERRIDE_SECONDS` (40s) should be raised to ~90s so the player has time to see the commanded turn take effect before route guidance re-engages.

**Verify:** Select an en-route aircraft heading 090°. Issue `hdg 270`. Aircraft should immediately begin a left turn to 270° and hold that heading for ~90 seconds before drifting back toward its next waypoint. The on-screen vector line should match the new heading within 1–2 seconds.

---

### FIX-03 — Takeoff "takeoff" event type is never emitted; departure bonus is dead code

**Files:** `src/store/useSimStore.ts`, `src/core/scoring.ts`

**Bug:** In `issueCommand`, when a takeoff succeeds the store pushes a `type: "command"` event and a `type: "info"` departure message — never `type: "takeoff"`. The `+100` departure bonus in `updateScoreFromEvents` (line 49) checks `event.type === "takeoff"` and therefore never fires. The `score.departures` counter from events never increments either.

**Fix:** In `useSimStore.issueCommand`, change the second pushed event's type from `"info"` to `"takeoff"` when `command.type === "takeoff"` and `applied.result.ok` is true. Verify that `updateScoreFromEvents` handles it correctly (it already does — the condition is correct, the emitter was wrong).

**Verify:** Select a taxiing aircraft and issue `takeoff SABE-13`. Score should increase by 100. The `departures` counter in the ops panel should increment by 1. The event log should show the departure entry.

---

### FIX-04 — `seenConflicts` never evicts resolved keys; recurring conflicts produce no alert

**Files:** `src/store/useSimStore.ts`

**Bug:** In `tick`, the `seenConflicts` set only grows — keys are added but never removed. A conflict that resolves (aircraft separate) and later re-develops produces no second event, no visual re-alert, and no audio cue. The player's only signal is the conflict line disappearing and reappearing on the map.

**Fix:** At the start of each tick, rebuild `seenConflicts` as the intersection of the previous set and the current active conflict keys. Keys no longer present in `conflicts` are dropped:
```ts
const activeKeys = new Set(conflicts.map(conflictKey));
const seenConflicts = new Set(
  [...state.seenConflicts].filter((key) => activeKeys.has(key))
);
```
Then proceed with the existing `if (!seenConflicts.has(key))` detection loop. This ensures that when a conflict clears and re-develops, the second occurrence fires a fresh event and triggers a new score deduction (via FIX-01).

**Verify:** Create a conflict, observe the alert. Separate the aircraft (issue altitude command). Observe the conflict line disappear. Re-converge the aircraft. A new conflict event should appear in the event log and the score should take another hit.

---

### FIX-05 — Tab backgrounding causes a multi-second physics jump on return

**Files:** `src/hooks/useGameLoop.ts`

**Bug:** On line 21, `delta = (now - lastTime.current) / 1000` is unbounded. Chrome throttles background tabs to ~1Hz. Returning after 10 seconds away causes `accumulator += 10 * speed`, triggering up to 400 sequential physics ticks before the next render. The browser freezes briefly and simulation time jumps by the full away-duration.

**Fix:** Clamp `delta` before accumulating:
```ts
const delta = Math.min((now - lastTime.current) / 1000, 0.25);
```
`0.25s` allows two and a half physics ticks at 1× — enough to not lose real-time fidelity on a slow frame — while preventing runaway accumulation on tab re-focus.

**Verify:** Open the game, switch to another browser tab for 15 seconds, return. The simulation should resume smoothly from where it left off, with at most 0.25 seconds of simulated time having passed during the background period. Aircraft should not jump positions.

---

### FIX-06 — Go-around auto-recaptures ILS without a new approach clearance

**Files:** `src/core/approach.ts`

**Bug:** In the go-around recovery block (line 125), `commandRunway` is cleared but `assignedRunway` is not. After the aircraft climbs back to `"arriving"` status, `updateApproaches` resolves `runwayToken = commandRunway ?? assignedRunway`, finds a non-null runway, and immediately re-enters the ILS capture check. If geometry conditions are met, the plane auto-captures ILS without any player action.

**Fix:** Clear `assignedRunway` alongside `commandRunway` in the go-around recovery transition:
```ts
next = {
  ...next,
  status: "arriving",
  goingAround: false,
  onApproach: false,
  commandRunway: undefined,
  assignedRunway: null,      // ← add this
};
```
The player must re-issue `app SABE-13` explicitly after every go-around, which is correct procedure.

**Verify:** Vector an aircraft onto ILS. Let it trigger an unstable go-around (or issue the `ga` command manually). After the aircraft climbs back to ~3000ft and `status` returns to `"arriving"`, it should fly level and not descend toward the runway. Issuing `app SABE-13` again should re-trigger the capture sequence.

---

## HIGH — Degrades experience noticeably

---

### FIX-07 — ILS capture fails silently when aircraft is above glideslope

**Files:** `src/core/approach.ts`, `src/components/Panels/CommandChatPanel.tsx`

**Bug:** The ILS capture condition at line 41 checks `altitudeDelta <= 1800ft`. At 18nm, the glideslope altitude is ~5724ft AGL; an aircraft at FL080 (common cruise) has `altDiff = 2276ft > 1800ft`, so capture fails. No event is emitted, no UI message appears, and the aircraft silently continues on its route. The player has no idea why `app SABE-13` produced no result.

**Fix:** Two parts. (1) In `approach.ts`, when the capture condition is evaluated and fails *only due to altitude* (distance and heading are fine), push a one-time "info" event: `"AR1901 too high for ILS at Xnm — descend below Yft"`. Gate this on a new `approachAltWarnedAt` field to avoid spamming. (2) In `CommandChatPanel`, after dispatching an approach command successfully, show a system hint: `"Cleared ILS SABE-13 — aircraft must be below ~7500ft within 18nm"`.

**Verify:** Select an aircraft at FL100 and issue `app SABE-13`. The chat panel should show the altitude hint. As the plane approaches within 18nm, the event log should explain why capture hasn't occurred yet. After descending to ~6000ft the ILS-captured event should appear.

---

### FIX-08 — Taxiing and stationary aircraft included in separation detection

**Files:** `src/store/useSimStore.ts`

**Bug:** The conflict filter at line 340 only excludes `status === "landed"`. Aircraft with `status === "taxiing"` (speed=0, at ground elevation) remain in the conflict check. During the early departure climb, a just-departed aircraft at ~800ft within 3nm of its origin airport can generate false warnings against an unrelated taxiing aircraft that shares the same surface area.

**Fix:** Extend the exclusion filter:
```ts
const airborne = working.filter(
  (a) => a.status !== "landed" && a.status !== "taxiing"
);
const conflicts = detectConflicts(airborne);
```
Surface aircraft are tracked in the UI but don't participate in airborne separation.

**Verify:** Spawn a flight and clear it for takeoff. While it climbs through 1000ft still near the airport, no conflict alert should appear against the other taxiing flights at the same airport. Confirm that two airborne aircraft at 3nm / 800ft vertical still produce a critical conflict.

---

### FIX-09 — Departure initial heading uses `runway_key × 10` instead of the authoritative runway heading

**Files:** `src/core/spawner.ts`

**Bug:** Line 179: `Number(assignedRunway.split("-")[1]) * 10`. For `"SABE-13"` this gives `130°` but the actual runway heading from `constants.ts` is `131°`. The method is fragile (breaks for three-character runway ends or non-numeric keys) and bypasses the `resolveRunwayToken` function that already returns the correct heading.

**Fix:** Use `resolveRunwayToken(assignedRunway)?.heading` to retrieve the authoritative heading. If resolution fails, fall back to `routeHeading`:
```ts
const departureHeading = 
  (assignedRunway && resolveRunwayToken(assignedRunway)?.heading) ?? routeHeading;
```

**Verify:** Log or inspect the initial `heading` of each spawned aircraft. For `SABE-13` the value should be `131`, not `130`. For `SUMU-01` it should be `10`. Confirm the aircraft faces the correct runway direction on the map at session start.

---

### FIX-10 — Difficulty level setting has no effect on gameplay

**Files:** `src/store/useSimStore.ts`, `src/core/constants.ts`, `src/core/spawner.ts`

**Bug:** `DIFFICULTY_CONFIG` in `constants.ts:377` defines `spawnMin`, `spawnMax`, and `startCount` per difficulty level, but `setDifficulty` in the store only writes the `difficulty` field. Nothing reads `DIFFICULTY_CONFIG` to change spawn intervals or starting aircraft count. All five difficulty levels behave identically.

**Fix:** In `tick`, when dynamic spawning is implemented (or as a preparatory step), read `DIFFICULTY_CONFIG[state.difficulty]` to determine the spawn interval. For now, at minimum wire `startCount` into `initialMissionScenario` so that `student` starts with 3 aircraft and `chief` with 5. Update `initialGameState` to pass the current difficulty's `startCount` to the spawner.

**Verify:** Set difficulty to `"student"` and restart — 3 aircraft should spawn. Set to `"chief"` — 5 aircraft. The difficulty picker in `SimDock` should visibly change the starting state.

---

## MEDIUM — Polish issues and missing affordances

---

### FIX-11 — Wind displayed in status bar but has no effect on physics

**Files:** `src/components/HUD/StatusBar.tsx`

**Bug:** `wind: { direction: 140, speed: 11 }` is shown in the status bar. It has zero effect on aircraft physics, approach paths, or fuel calculations. Players who see `140/11kt` alongside an aircraft on final for runway 13 (heading 131°) will expect a tailwind effect and issue compensating commands that do nothing, eroding trust in all displays.

**Fix:** Remove the wind display from `StatusBar` until wind physics are implemented. Replace the slot with mission progress (`Obj 2/8`) which is currently only shown as a small text entry. Alternatively, add a `(decorative)` note in the README and disable the field — but removal is cleaner and more honest.

**Verify:** The status bar should not show a wind readout. No regression to other state displays (sim time, active runways, mission counter).

---

### FIX-12 — Active and inactive runways are visually identical on the map

**Files:** `src/components/Map/RunwayOverlay.tsx`, `src/index.css`

**Bug:** All runway polylines render with `color: "#445566"` regardless of whether they are in `activeRunways`. A player who deactivates `SABE-31` cannot see that it's inactive without reading the status bar text. When their approach clearance to an inactive runway is rejected, the map offers no explanation.

**Fix:** Pass `activeRunways: string[]` as a prop to `RunwayOverlay`. For each runway end, check if `${airport.icao}-${end.key}` is in `activeRunways`. Active runway ends render in bright green (`#2adf90`); inactive in the existing muted grey (`#445566`). Additionally, draw an extended centreline (thin dashed line, ~15nm) from each active runway threshold in the landing direction to show the ILS inbound track.

**Verify:** Start game with default active runways. SABE-13, SUMU-01, SAAR-02, SAZM-13 should be green on the map. Deactivate SABE-13 via the dock — that runway should turn grey immediately. The centreline should extend from SABE-13 threshold pointing ~311° (the inbound heading for runway 13).

---

### FIX-13 — No target-heading preview line after issuing a heading command

**Files:** `src/components/Map/AircraftMarker.tsx`

**Bug:** The dashed 60-second vector line always projects along `aircraft.heading` (current), not `aircraft.targetHeading` (commanded). After issuing `hdg 270`, the vector still shows the old heading until the turn is complete. Players cannot preview whether the commanded heading will clear a conflict before the aircraft moves.

**Fix:** Draw a second, dimmer dashed polyline from `aircraft.position` along `aircraft.targetHeading` for 90 seconds (using `projectPosition` with a heading override or an inline calculation). Style it distinctly from the current-heading vector — e.g., blue/dimmer, shorter dash pattern — so the two are visually distinguishable. Show only when `targetHeading` differs from `heading` by more than 5°.

**Verify:** Select an aircraft heading 090°. Issue `hdg 180`. A second dimmer line should appear pointing south from the aircraft's position immediately, before the aircraft has turned at all. As the aircraft turns, the current-heading vector rotates to match it; once the turn is complete the second line disappears.

---

### FIX-14 — Normal-state aircraft icon (circle) has no directional shape

**Files:** `src/index.css`

**Bug:** The CSS for a non-conflicting aircraft is a plain filled circle. Rotation is applied but a circle has no visible orientation. The only directional cue is the thin dashed vector line, which is hard to read at zoom level 7 with multiple aircraft on screen.

**Fix:** Replace the circle with an arrowhead or chevron shape using `clip-path`. A simple upward-pointing chevron: `clip-path: polygon(50% 0%, 80% 100%, 50% 75%, 20% 100%)`. This makes heading immediately readable from icon shape. Warning (triangle) and danger (diamond) shapes are already correct — only the normal state needs this change.

**Verify:** All non-conflicting aircraft should show a chevron/arrowhead pointing in their direction of travel. Heading 090° should point right; heading 180° should point down. Conflicting aircraft (triangle/diamond) shapes should be unchanged.

---

### FIX-15 — `radarPulse` CSS animation fires on every Leaflet path equally

**Files:** `src/index.css`

**Bug:** `.leaflet-overlay-pane path { animation: radarPulse 2.8s ... }` applies the pulse to all paths: static runway lines, TMA circle, aircraft vectors, route overlays, AND conflict alert lines. Static infrastructure (runways, TMA boundary) should not pulse. Conflict lines pulsing at the same rate as runway lines means the animation carries no urgency signal.

**Fix:** Remove the blanket `path` selector. Add `radarPulse` only to aircraft marker paths (`.aircraft-vector-line`) and conflict alert lines (add a class `conflict-line` to `ConflictAlert`'s `<Polyline>`). Give conflict lines a faster pulse (1.2s) vs aircraft vectors (2.8s). Static overlays (RunwayOverlay, AirspaceOverlay) should not animate.

**Verify:** Runway polylines and the TMA boundary circle should be fully static. Aircraft vector lines should pulse at ~2.8s. Conflict lines should pulse faster at ~1.2s. The visual urgency hierarchy should be: conflict lines > aircraft vectors > static overlays.

---

### FIX-16 — Efficiency metric is meaningless during active flight

**Files:** `src/core/scoring.ts`

**Bug:** `efficiency = safeDiv(routeDirect, routeActual) × 100`. While `routeActual < routeDirect` (mid-flight, before the aircraft has flown the equivalent of its direct distance), the formula yields `> 1.0`, clamped to 100%. The metric reads "100%" from spawn until the aircraft has been vectored longer than its direct route, which never happens on a well-flown session. It only starts dropping when the player is actively wasting distance.

**Fix:** Track a per-flight completion flag or compute efficiency only over completed flights. For active aircraft, compute efficiency as `actualNmFlown / directNmTotal` to show progress rather than overhead. For the aggregate metric, use only the `landed` or `departed` aircraft whose full `routeDistanceNm` is known. If no aircraft have completed yet, show `—` instead of `100%`.

**Verify:** At session start the efficiency display should show `—`. After the first landing, it should show a real percentage reflecting how direct that aircraft's route was. Excessive vectoring should cause the metric to decrease visibly.

---

### FIX-17 — Map has no geographic context (no place names, no river label)

**Files:** `src/components/Map/AirspaceOverlay.tsx`, or consider switching tile layer

**Bug:** The `dark_nolabels` CARTO tile set strips all text. Airport labels are ICAO codes only. The Río de la Plata — the dominant geographic feature and the primary mental landmark for Buenos Aires airspace — is visible but unnamed. New players have no geographic grounding.

**Fix:** Option A (simpler): Switch the tile layer URL from `dark_nolabels` to `dark_all` (CARTO dark with labels). This adds city and country names at appropriate zoom levels with no code changes beyond the URL string in `SimMap.tsx:69`. Option B (cleaner): Keep `dark_nolabels` and add `<Tooltip permanent>` annotations in `AirspaceOverlay` for "Río de la Plata", "Buenos Aires", and "Montevideo" at fixed positions. Option A is preferred since CARTO's label styling matches the dark theme.

**Verify:** Zoom to level 8. "Buenos Aires", "Montevideo", and "Rosario" city labels should be visible. The broad estuary should be identifiable as "Río de la Plata". Airport ICAO labels should still appear (they're drawn by `AirspaceOverlay`, not the tile layer).

---

### FIX-18 — Map click fires both "deselect" and "select" simultaneously

**Files:** `src/components/Map/SimMap.tsx`

**Bug:** `MapClickCapture` intercepts all clicks and calls `onClearSelection()`. Aircraft markers also have `eventHandlers: { click: () => onSelect(aircraft.id) }`. Clicking an aircraft marker fires both in the same event bubble, potentially clearing the selection and then immediately reselecting — or clearing it without reselecting, depending on Leaflet event propagation order.

**Fix:** In `AircraftMarker`, call `e.stopPropagation()` in the click handler to prevent the event from reaching `MapClickCapture`:
```tsx
eventHandlers={{
  click: (e) => {
    e.originalEvent.stopPropagation();
    onSelect(aircraft.id);
  }
}}
```
`MapClickCapture` then only fires on genuine background map clicks, not on aircraft marker clicks.

**Verify:** Click an aircraft marker — it should become selected and no other aircraft should deselect it. Click the background map — the selection should clear. Click a second aircraft — the first should deselect, the second should select.

---

### FIX-19 — `useKeyboard` recreates the event listener on every pause toggle

**Files:** `src/hooks/useKeyboard.ts`

**Bug:** `paused` is in the `useEffect` dependency array. Every space bar press (pause/resume) tears down and re-registers the `keydown` listener. During the brief gap, a rapid second keypress can fire after remove but before re-add, or be missed entirely.

**Fix:** Read `paused` from a ref inside the effect rather than closing over the state value. This removes `paused` from the dependency array:
```ts
const pausedRef = useRef(paused);
useEffect(() => { pausedRef.current = paused; }, [paused]);

useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === " ") setPaused(!pausedRef.current);
    // ...
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [selectAircraft, setPaused, setSpeed]);
```

**Verify:** Rapidly press space 10 times in quick succession. The simulation should toggle cleanly — odd presses pause, even presses resume. No double-toggles or missed toggles.

---

### FIX-20 — `ops-metrics-grid` uses a 10-column layout that overflows on a 430px sidebar

**Files:** `src/index.css`, `src/components/Panels/OperationsPanel.tsx`

**Bug:** `grid-template-columns: auto auto auto auto auto auto auto auto auto auto` (10 columns) renders 5 label+value pairs across a single row in a 430px sidebar — approximately 43px per cell. Labels like "Go-around" and "Collisions" wrap or overflow. On smaller sidebars this is unreadable.

**Fix:** Change the grid to two columns (`auto 1fr`) and use row-flow, allowing each metric to occupy a full row. Alternatively, render a `<dl>` with `display: flex; flex-wrap: wrap` and constrain each `dt`+`dd` pair to ~50% width. This is a CSS-only change.

**Verify:** Resize the browser to 1200px width (sidebar ~430px). All metric labels and values should be legible without overflow or wrapping inside individual cells. Labels "Go-around" and "Avg delay" should be fully visible.

---

## LOW — Nice-to-haves

---

### FIX-21 — Five dead components and a dead root `App.tsx`

**Files:** `src/components/Panels/CommandPanel.tsx`, `src/components/Panels/FlightStrip.tsx`, `src/components/Panels/FlightStripRack.tsx`, `src/components/Panels/ScorePanel.tsx`, `src/components/Panels/SimControls.tsx`, `src/App.tsx`

**Bug:** None of these six files are imported anywhere in the live application. They add ~10KB to the repository, increase cognitive overhead when searching for components, and `CommandPanel` contains a known bug (FIX reference: `approachRunway` stale initialisation) that would surface if it were ever re-added.

**Fix:** Delete all six files. Run `npm run build` to confirm no import errors. If any are wanted for future reference, the git history preserves them.

**Verify:** `npm run build` succeeds. `npm run lint` produces no unused-import warnings. The live application is visually unchanged.

---

### FIX-22 — Landed aircraft disappear 10 seconds after touchdown with no feedback window

**Files:** `src/core/approach.ts`

**Bug:** `removeAt = time + 10` (line 104). An aircraft that just landed vanishes from the map in 10 real-world seconds at 1× speed (2.5 seconds at 4×). There is no post-landing visual (e.g. slowing rollout, taxiing icon), no animation, and no time for the player to register the landing before the strip disappears.

**Fix:** Extend `removeAt` to `time + 45` (45 sim-seconds, ~11 real-seconds at 4×). Set `status: "taxiing"` on touchdown rather than keeping it `"landed"`, so the strip shows the aircraft is on the ground. This gives the player a brief moment to see the landing result before the aircraft exits the board.

**Verify:** Land an aircraft. It should remain visible on the map and in the strip rack for ~45 simulation seconds after touchdown. The strip status should read "taxiing", not "landed". After 45 seconds it should disappear.

---

### FIX-23 — `nearestRouteIndex` scans forward-only; U-turns create wide detours

**Files:** `src/core/physics.ts`

**Bug:** `nearestRouteIndex` iterates from `fromIndex` to the end of the waypoints array. If a heading command pulls the aircraft behind its current waypoint, the scan misses the closest waypoint and locks onto a further one. When manual override expires, the aircraft takes a wide arc back around to re-intercept the skipped waypoint.

**Fix:** Search the full waypoints array (start from index 0) but bias toward waypoints at or ahead of `fromIndex` by adding a small penalty to behind-aircraft candidates:
```ts
for (let i = 0; i < aircraft.routeWaypoints.length; i++) {
  const dist = haversineNm(aircraft.position, aircraft.routeWaypoints[i]);
  const biased = i < fromIndex ? dist + 5 : dist;  // 5nm penalty for backtrack
  if (biased < bestDistance) { ... }
}
```
This allows recovery from U-turns while still preferring forward progress.

**Verify:** Issue `hdg 180` to an aircraft heading north toward its next waypoint. After override expires (~90s), the aircraft should resume toward its original waypoint cleanly, not fly past it and loop back.

---

### FIX-24 — Holding pattern is a spiral, not a standard racetrack

**Files:** `src/core/physics.ts`

**Bug:** The holding logic (line 77) only rotates the heading: `heading += turnRate * dt`. The aircraft also moves forward every tick via `moveAlongHeading`. The result is a continuous left-turning spiral that closes in on itself rather than a standard oval racetrack with inbound/outbound legs.

**Fix:** Implement a minimal two-state hold: track a `holdLeg: "inbound" | "outbound"` flag (add to `Aircraft` type or use a derived field from heading). On the outbound leg, fly the reciprocal of the holding fix heading for 60 sim-seconds. On the inbound leg, fly the fix heading for 60 sim-seconds. Switch legs when the leg timer expires. This creates a recognisable oval and makes "hold" a useful traffic management tool.

**Verify:** Issue `hold` to an en-route aircraft. It should trace an oval pattern on the map — two straight legs connected by turns. Resuming any non-hold command should exit the hold cleanly.

---

### FIX-25 — `EventLog` uses array index in React key, causing flicker on prepend

**Files:** `src/components/HUD/EventLog.tsx`

**Bug:** Line 29: `key={${event.timestamp}-${index}}`. Events are prepended (`[...incoming, ...current]`), so the `index` portion of every existing event changes on every new event. React re-renders all event rows even when their content is unchanged.

**Fix:** Remove the index from the key. Use only `${event.timestamp}-${event.message.slice(0, 20)}` as the key. Since multiple events can share the same timestamp (same tick), append the message prefix to ensure uniqueness:
```tsx
key={`${event.timestamp}-${event.type}-${event.message.slice(0, 16)}`}
```

**Verify:** Open React DevTools Profiler. Trigger one new event. Only the new event row should highlight as updated; existing rows should not re-render.

---

## Summary Table

| ID | Severity | Area | File(s) |
|----|----------|------|---------|
| FIX-01 | Critical | Scoring | `scoring.ts`, `useSimStore.ts` |
| FIX-02 | Critical | Physics | `physics.ts` |
| FIX-03 | Critical | Events / Scoring | `useSimStore.ts` |
| FIX-04 | Critical | State | `useSimStore.ts` |
| FIX-05 | Critical | Game loop | `useGameLoop.ts` |
| FIX-06 | Critical | Approach | `approach.ts` |
| FIX-07 | High | Approach / UX | `approach.ts`, `CommandChatPanel.tsx` |
| FIX-08 | High | Separation | `useSimStore.ts` |
| FIX-09 | High | Spawner | `spawner.ts` |
| FIX-10 | High | Difficulty | `useSimStore.ts`, `constants.ts`, `spawner.ts` |
| FIX-11 | Medium | UX | `StatusBar.tsx` |
| FIX-12 | Medium | Map | `RunwayOverlay.tsx`, `index.css` |
| FIX-13 | Medium | Map | `AircraftMarker.tsx` |
| FIX-14 | Medium | Map | `index.css` |
| FIX-15 | Medium | Rendering | `index.css` |
| FIX-16 | Medium | Scoring | `scoring.ts` |
| FIX-17 | Medium | Map | `AirspaceOverlay.tsx` or `SimMap.tsx` |
| FIX-18 | Medium | Map | `SimMap.tsx` |
| FIX-19 | Medium | Input | `useKeyboard.ts` |
| FIX-20 | Medium | UI | `index.css`, `OperationsPanel.tsx` |
| FIX-21 | Low | Cleanup | 6 dead files |
| FIX-22 | Low | UX | `approach.ts` |
| FIX-23 | Low | Physics | `physics.ts` |
| FIX-24 | Low | Physics | `physics.ts` |
| FIX-25 | Low | React | `EventLog.tsx` |
