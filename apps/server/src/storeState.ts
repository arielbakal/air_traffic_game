import {
  DEFAULT_ACTIVE_RUNWAYS, DIFFICULTY_CONFIG,
  createInitialScore, initialMissionScenario, resolveRunwayToken,
  applyCommand, updateAircraftPhysicsAtTime, updateApproaches,
  detectConflicts, hasSeparationViolation,
  applyHoldingPenalty, deriveScoreMetrics, updateScoreFromEvents,
} from "@atc/core";
import type { Aircraft, GameState, CommandType, GameEvent, ConflictPair, DifficultyLevel, MissionFlightState, MissionState, ScoreState } from "@atc/core";
import type { ControllerMode } from "./types.ts";

const MAX_EVENTS = 180;

function seededRandom(seed: number): { value: number; nextSeed: number } {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, nextSeed: t >>> 0 };
}

function toMap(items: Aircraft[]): Map<string, Aircraft> {
  return new Map(items.map(a => [a.id, a]));
}

function conflictKey(c: ConflictPair): string {
  const s = [c.aircraft1, c.aircraft2].sort();
  return `${s[0]}-${s[1]}-${c.severity}`;
}

function summarizeMission(flights: MissionFlightState[], prev?: MissionState): MissionState {
  const completedObjectives = flights.reduce((s, f) => s + (f.departureCleared ? 1 : 0) + (f.approachCleared ? 1 : 0), 0);
  const completedFlights = flights.filter(f => f.completed).length;
  const failedFlights = prev?.failedFlights ?? 0;
  const totalFlights = flights.length;
  const totalObjectives = totalFlights * 2;
  const isComplete = completedObjectives >= totalObjectives || completedFlights + failedFlights >= totalFlights;
  return { flights, totalFlights, totalObjectives, completedFlights, completedObjectives, failedFlights, isComplete, success: isComplete && failedFlights === 0 && completedObjectives >= totalObjectives };
}

function syncScoreWithMission(score: ScoreState, mission: MissionState): ScoreState {
  return { ...score, departures: mission.flights.filter(f => f.departureCleared).length, landings: mission.flights.filter(f => f.approachCleared).length, flightsHandled: mission.completedFlights };
}

function initialState(seed = 20260415, difficulty: DifficultyLevel = "junior"): GameState {
  const activeRunways = [...DEFAULT_ACTIVE_RUNWAYS];
  let nextSeed = seed;
  const random = () => { const g = seededRandom(nextSeed); nextSeed = g.nextSeed; return g.value; };
  const { startCount } = DIFFICULTY_CONFIG[difficulty];
  const scenario = initialMissionScenario(activeRunways, 0, random, startCount);
  const mission = summarizeMission(scenario.missionFlights);
  return { aircraft: toMap(scenario.aircraft), conflicts: [], score: createInitialScore(), time: 0, speed: 1, paused: false, wind: { direction: 140, speed: 11 }, activeRunways, events: scenario.aircraft.map(a => ({ timestamp: 0, type: "spawn" as const, severity: "info" as const, message: `${a.callsign} entered` })).reverse(), difficulty, nextSpawnIn: Infinity, mission };
}

export interface ServerStore {
  game: GameState;
  seed: number;
  seenConflicts: Set<string>;
  controllerMode: ControllerMode;
  pendingCommands: Array<{ callsign: string; command: CommandType; reasoning: string }>;
}

export function createServerStore(difficulty: DifficultyLevel = "junior"): ServerStore {
  return { game: initialState(20260415, difficulty), seed: 20260415, seenConflicts: new Set(), controllerMode: "ai", pendingCommands: [] };
}

export function serverTick(store: ServerStore, dt: number): { events: GameEvent[]; overriddenAircraft: string[] } {
  const { game } = store;
  const now = game.time + dt;

  let working = Array.from(game.aircraft.values()).map(a => updateAircraftPhysicsAtTime(a, dt, now));
  const approachResult = updateApproaches(working, now);
  working = approachResult.aircraftList;

  const airborne = working.filter(a => a.status !== "landed" && a.status !== "taxiing");
  const conflicts = detectConflicts(airborne);
  const conflictCallsigns = new Set(conflicts.flatMap(c => [c.aircraft1, c.aircraft2]));

  working = working
    .filter(a => a.removeAt === undefined || a.removeAt > now)
    .map(a => ({ ...a, hasConflict: conflictCallsigns.has(a.callsign) }));

  const newEvents: GameEvent[] = [...approachResult.events];
  const activeKeys = new Set(conflicts.map(conflictKey));
  store.seenConflicts = new Set([...store.seenConflicts].filter(k => activeKeys.has(k)));

  let newViolations = 0, violationPenalty = 0;
  for (const c of conflicts) {
    const key = conflictKey(c);
    if (!store.seenConflicts.has(key)) {
      store.seenConflicts.add(key);
      newEvents.push({ timestamp: now, type: c.severity === "collision" ? "collision" : "conflict", severity: c.severity === "warning" ? "warning" : "critical", message: `${c.aircraft1}/${c.aircraft2} ${c.severity} ${c.distance.toFixed(1)}nm/${Math.round(c.altDiff)}ft` });
      if (hasSeparationViolation(c)) { newViolations++; violationPenalty += 500; }
    }
  }

  const byCallsign = new Map(working.map(a => [a.callsign, a]));
  let score = updateScoreFromEvents(game.score, newEvents, byCallsign);
  if (newViolations > 0) score = { ...score, separationViolations: score.separationViolations + newViolations, totalScore: score.totalScore - violationPenalty };
  score = applyHoldingPenalty(score, working, dt);
  score = deriveScoreMetrics(score, working);
  score = syncScoreWithMission(score, game.mission);

  store.game = { ...game, aircraft: toMap(working), conflicts, time: now, score, events: [...newEvents, ...game.events].slice(0, MAX_EVENTS) };
  return { events: newEvents, overriddenAircraft: [] };
}

export function serverIssueCommand(store: ServerStore, callsign: string, command: CommandType): { ok: boolean; message: string } {
  const aircraft = Array.from(store.game.aircraft.values()).find(a => a.callsign === callsign);
  if (!aircraft) return { ok: false, message: `${callsign} not found` };
  const result = applyCommand(aircraft, command, store.game.activeRunways, store.game.time);
  if (result.result.ok) {
    const newAircraft = new Map(store.game.aircraft);
    newAircraft.set(aircraft.id, result.aircraft);
    store.game = { ...store.game, aircraft: newAircraft };
  }
  return result.result;
}

export function serverRestart(store: ServerStore): void {
  store.game = initialState(20260415, store.game.difficulty);
  store.seenConflicts = new Set();
  store.pendingCommands = [];
}

export function listRunwayOptions(store: ServerStore): string[] {
  return store.game.activeRunways.map(t => resolveRunwayToken(t)).filter(Boolean).map(r => r!.runwayId);
}
