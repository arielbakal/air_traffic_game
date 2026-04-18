# MECHANICS.md — Simulation Rules Reference

This document describes every rule the simulator enforces. It is the authoritative
spec for the game, the AI agent prompt in Phase 3, and the basis for any future test suite.

---

## 1. Separation Standards

Separation is evaluated between all **airborne** aircraft (status is not `landed` or `taxiing`).
The check runs every physics tick (10 Hz × speed multiplier).

### Thresholds

| Severity | Horizontal | Vertical | Action |
|----------|-----------|---------|--------|
| **Warning** | < 5 nm | < 1500 ft | Yellow conflict line; no score hit |
| **Critical** | < 3 nm | < 1000 ft | Red conflict line; −500 pts on first detection |
| **Collision** | < 1 nm | < 200 ft | Red conflict line; −2000 pts via collision event |

### Detection method

Each pair is evaluated twice:
1. **Current position** — instantaneous distance and altitude difference.
2. **Projected closest approach** — velocity vectors projected forward up to 120 seconds.

The higher-severity result of the two governs. This means two aircraft on a
collision course can trigger an alert before they are actually in violation.

### Eviction

A `seenConflicts` set tracks which pairs have already fired an event. On every tick
the set is pruned to only the pairs still active. When a conflict resolves and
re-develops later, a fresh event and score hit fire again.

---

## 2. Aircraft Lifecycle

```
departing ──────────────────────────────────────────────────► enroute
                 (speed ≥ max(160, minSpeed + 15))

arriving ──► (ILS capture) ──► approach ──► landing ──► taxiing ──► (removed after 45s)
                                                 └──► goAround ──► arriving
```

### Status meanings

| Status | Description |
|--------|-------------|
| `departing` | On ground, cleared for takeoff, accelerating |
| `enroute` | Airborne, following route waypoints |
| `arriving` | Inbound, following route waypoints, awaiting approach clearance |
| `approach` | ILS captured, descending on glideslope |
| `landing` | Crossing threshold, decelerating to ground |
| `taxiing` | On ground post-landing, 45-second hold before removal |
| `holding` | Flying a two-leg racetrack pattern |
| `goAround` | Climbing away from runway after aborted approach |

---

## 3. ILS Capture

An aircraft transitions from `arriving`/`enroute` to `approach` when **all three** conditions hold simultaneously:

| Condition | Value |
|-----------|-------|
| Distance to runway threshold | ≤ 18 nm |
| Heading error to runway heading | ≤ 30° |
| Altitude delta from glideslope | ≤ 1800 ft |

### Glideslope altitude

Target altitude at distance D (nm) from threshold:
```
targetAlt = runway.elevation + D × 318 ft/nm
```
This approximates a 3° glideslope (318 ft per nm ≈ tan 3° × 6076 ft/nm).

### Altitude warning

If distance and heading are within bounds but altitude exceeds the ±1800 ft band,
a one-time warning event fires: `"<callsign> too high for ILS at Xnm — descend below Yft"`.
The warning is suppressed after first emission (`approachAltWarnGiven` flag).

### Go-around recovery

After a go-around, both `commandRunway` and `assignedRunway` are cleared. The aircraft
climbs back to `arriving` status and must receive a new `app <runway>` command before
ILS capture can trigger again.

---

## 4. Heading Commands and Route Guidance

### Manual override

When a heading command is issued, `manualRouteUntil = simTime + 90s` is set.
Route waypoint guidance is suppressed while `simTime < manualRouteUntil`.

After 90 simulation-seconds, route guidance re-engages automatically using
`nearestRouteIndex` to find the closest forward waypoint (with a 5 nm penalty
applied to waypoints behind the current index, to prefer forward progress).

### Route heading blending

None. When manual override is active, `targetHeading` = player-commanded value.
When route guidance is active, `targetHeading` = bearing to next waypoint.
There is no blending between the two.

---

## 5. Holding Pattern

Issuing a `hold` command sets `status = "holding"` and records `holdFixHeading = aircraft.heading`
at the moment of the command.

The hold flies two legs of 60 simulation-seconds each:
- **Outbound leg**: heading = `holdFixHeading + 180°` (reciprocal)
- **Inbound leg**: heading = `holdFixHeading`

The aircraft turns toward the active leg heading using the normal `turnRate`.
The result is a racetrack oval. Standard rate turns are not enforced — turn
radius is determined by `turnRate` (deg/s) and current speed.

### Penalty

Holding aircraft accrue a penalty of `10/30 pts per aircraft per second` (≈ 0.33 pts/s).

### Exiting hold

Any non-hold command (heading, altitude, approach) exits the hold and returns
the aircraft to `arriving` status if it was in `holding`.

---

## 6. Aircraft Performance Profiles

Performance is fixed by category at spawn and does not change.

| Category | Max speed | Min speed | Approach speed | Climb rate | Descent rate | Turn rate |
|----------|-----------|-----------|----------------|------------|--------------|-----------|
| Heavy | 500 kt | 160 kt | 150 kt | 2000 fpm | 1800 fpm | 1.5 °/s |
| Medium | 450 kt | 140 kt | 140 kt | 2500 fpm | 2000 fpm | 2.0 °/s |
| Light | 140 kt | 60 kt | 70 kt | 700 fpm | 500 fpm | 3.0 °/s |

Speed changes at 5 kt/s. Altitude changes at the category's climb/descent rate.
Heading changes at `turnRate` deg/s toward `targetHeading` via shortest path.

---

## 7. Scoring Formula

All score changes are one-time events, not continuous.

| Event | Points |
|-------|--------|
| Landing — heavy | +300 |
| Landing — medium | +200 |
| Landing — light | +100 |
| Efficient arrival (≤ 2 heading changes) | +50 bonus |
| Departure cleared | +100 |
| Mission objective (approach or departure cleared) | +220 |
| Full flight completed (both objectives) | +300 bonus |
| Separation violation (critical or collision detected) | −500 |
| Collision event | −2000 |
| Go-around | −150 |
| Holding penalty | −0.33 pts/s per aircraft holding |

### Efficiency metric

Computed only when at least one flight has completed (`status === "landed"`, `"taxiing"`, or `"enroute"`).
```
efficiency = (sum of directDistanceNm across completed flights)
           / (sum of routeDistanceNm across completed flights) × 100
```
Clamped to [0, 100]. Shows `—` until first completion.

### Average delay

```
averageDelay = (sum of holdTime across all active aircraft) / aircraft count
```
Updated every tick.

---

## 8. Spawning and Difficulty

The initial mission scenario is seeded (seed `20260415` by default) and deterministic.

| Difficulty | Start count | Spawn interval |
|------------|-------------|----------------|
| student | 3 | 75–120 s |
| junior | 4 | 60–100 s |
| controller | 5 | 45–85 s |
| senior | 5 | 35–70 s |
| chief | 5 | 30–60 s |

Dynamic in-session spawning is not yet implemented (`nextSpawnIn = Infinity`).
All aircraft are drawn from `FLIGHT_TEMPLATES` in `constants.ts` using weighted
random selection.

---

## 9. Airports

| ICAO | Name | Elevation | Active runway(s) |
|------|------|-----------|-----------------|
| SABE | Aeroparque Jorge Newbery | 18 ft | 13 (hdg 131°, ILS), 31 (hdg 311°, no ILS) |
| SUMU | Montevideo Carrasco | 105 ft | 01, 19 |
| SAAR | Rosario Islas Malvinas | 85 ft | 02, 20 |
| SAZM | Mendoza El Plumerillo | 2313 ft | 13, 31 |

Default active runways: `SABE-13`, `SUMU-01`, `SAAR-02`, `SAZM-13`.

---

## 10. Map and Geography

- Center: `{ lat: -35.2, lng: -58.4 }`, zoom 7
- TMA boundary: displayed as an informational circle
- Tile layer: CARTO Dark All (includes city and geographic labels)
- Aircraft vector line: 60-second projection along current heading
- Target heading preview: 90-second projection along commanded heading (shown when heading delta > 5°)
- Conflict lines pulse at 1.2 s; aircraft vectors pulse at 2.8 s; static overlays do not pulse

---

## 11. Game Loop

- Fixed timestep: `FIXED_DT = 0.1 s` (10 Hz)
- Frame delta clamped to `0.25 s` to prevent tab-return physics jumps
- Scaled by speed multiplier (1×, 2×, 4×)
- Loop stops when `mission.isComplete` is true

---

## 12. Known Simplifications vs Real ATC

| Real-world rule | Simulator behaviour |
|-----------------|---------------------|
| Wind affects approach path, groundspeed, fuel | Wind field exists but has zero physics effect |
| Wake turbulence separation (heavy behind heavy) | Not modelled — all pairs use identical thresholds |
| True vs magnetic heading | True heading used throughout |
| RNAV/STAR/SID routing | Simplified waypoint lists, no published procedures |
| Speed restrictions below FL100 (250 kt) | Not enforced — player can set any speed within category limits |
| Transition altitude / flight levels | Altitude always in feet MSL, no FL/QNH distinction |
| Fuel state / divert capability | No fuel model |
| Radio communication delay | Commands applied instantly |
| Radar update rate | Continuous position updates at tick rate |
| Terrain and obstacle clearance | Not modelled |
| Weather / SIGMET | Not modelled |
| Multiple sectors / handoffs | Single-sector TMA, no inter-sector coordination |
