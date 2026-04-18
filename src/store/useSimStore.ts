import { create } from "zustand";
import { applyCommand } from "../core/commands";
import { DEFAULT_ACTIVE_RUNWAYS, resolveRunwayToken } from "../core/constants";
import { updateApproaches } from "../core/approach";
import { updateAircraftPhysicsAtTime } from "../core/physics";
import { detectConflicts, hasSeparationViolation } from "../core/separation";
import {
  applyHoldingPenalty,
  createInitialScore,
  deriveScoreMetrics,
  updateScoreFromEvents,
} from "../core/scoring";
import { initialMissionScenario } from "../core/spawner";
import type {
  Aircraft,
  CommandType,
  ConflictPair,
  DifficultyLevel,
  GameEvent,
  GameState,
  MissionFlightState,
  MissionState,
  ScoreState,
} from "../core/types";

const MAX_EVENTS = 180;

function seededRandom(seed: number): { value: number; nextSeed: number } {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextSeed: t >>> 0 };
}

function pushEvents(current: GameEvent[], incoming: GameEvent[]): GameEvent[] {
  if (incoming.length === 0) {
    return current;
  }
  return [...incoming, ...current].slice(0, MAX_EVENTS);
}

function toMap(items: Aircraft[]): Map<string, Aircraft> {
  return new Map(items.map((aircraft) => [aircraft.id, aircraft]));
}

function conflictKey(conflict: ConflictPair): string {
  const sorted = [conflict.aircraft1, conflict.aircraft2].sort();
  return `${sorted[0]}-${sorted[1]}-${conflict.severity}`;
}

function createSpawnEvent(time: number, aircraft: Aircraft): GameEvent {
  const fl = Math.round(aircraft.altitude / 100);
  return {
    timestamp: time,
    type: "spawn",
    severity: "info",
    message: `${aircraft.callsign} entered from ${aircraft.origin} at FL${fl.toString().padStart(3, "0")}`,
  };
}

function summarizeMission(flights: MissionFlightState[], previous?: MissionState): MissionState {
  const completedObjectives = flights.reduce(
    (sum, flight) => sum + (flight.departureCleared ? 1 : 0) + (flight.approachCleared ? 1 : 0),
    0,
  );
  const completedFlights = flights.filter((flight) => flight.completed).length;
  const failedFlights = previous?.failedFlights ?? 0;
  const totalFlights = flights.length;
  const totalObjectives = totalFlights * 2;
  const isComplete = completedObjectives >= totalObjectives || completedFlights + failedFlights >= totalFlights;
  const success = isComplete && failedFlights === 0 && completedObjectives >= totalObjectives;

  return {
    flights,
    totalFlights,
    totalObjectives,
    completedFlights,
    completedObjectives,
    failedFlights,
    isComplete,
    success,
  };
}

function syncScoreWithMission(score: ScoreState, mission: MissionState): ScoreState {
  const departures = mission.flights.filter((flight) => flight.departureCleared).length;
  const arrivals = mission.flights.filter((flight) => flight.approachCleared).length;

  return {
    ...score,
    departures,
    landings: arrivals,
    flightsHandled: mission.completedFlights,
  };
}

function applyMissionObjectives(
  mission: MissionState,
  flightId: string,
  command: CommandType,
  time: number,
): { mission: MissionState; bonusScore: number; events: GameEvent[]; missionCompletedNow: boolean } {
  if (command.type !== "takeoff" && command.type !== "approach") {
    return { mission, bonusScore: 0, events: [], missionCompletedNow: false };
  }

  const index = mission.flights.findIndex((flight) => flight.flightId === flightId);
  if (index < 0) {
    return { mission, bonusScore: 0, events: [], missionCompletedNow: false };
  }

  const existing = mission.flights[index];
  let objectiveGain = 0;
  let flightCompletionBonus = 0;
  const events: GameEvent[] = [];

  let updated: MissionFlightState = existing;

  if (command.type === "takeoff" && !existing.departureCleared) {
    updated = { ...updated, departureCleared: true };
    objectiveGain += 1;
    events.push({
      timestamp: time,
      type: "info",
      severity: "info",
      message: `Mission: ${existing.callsign} departure objective complete`,
    });
  }

  if (command.type === "approach" && !existing.approachCleared) {
    updated = { ...updated, approachCleared: true };
    objectiveGain += 1;
    events.push({
      timestamp: time,
      type: "info",
      severity: "info",
      message: `Mission: ${existing.callsign} arrival objective complete`,
    });
  }

  if (!existing.completed && updated.departureCleared && updated.approachCleared) {
    updated = { ...updated, completed: true };
    flightCompletionBonus = 1;
    events.push({
      timestamp: time,
      type: "info",
      severity: "info",
      message: `Mission: ${existing.callsign} fully completed`,
    });
  }

  if (updated === existing) {
    return { mission, bonusScore: 0, events: [], missionCompletedNow: false };
  }

  const flights = [...mission.flights];
  flights[index] = updated;
  const nextMission = summarizeMission(flights, mission);

  const missionCompletedNow = nextMission.isComplete && !mission.isComplete;
  if (missionCompletedNow) {
    events.push({
      timestamp: time,
      type: "info",
      severity: "info",
      message: nextMission.success ? "Mission complete: all objectives resolved" : "Mission ended",
    });
  }

  return {
    mission: nextMission,
    bonusScore: objectiveGain * 220 + flightCompletionBonus * 300,
    events,
    missionCompletedNow,
  };
}

function initialGameState(seed = 20260415): GameState {
  const difficulty: DifficultyLevel = "junior";
  const activeRunways = [...DEFAULT_ACTIVE_RUNWAYS];

  let nextSeed = seed;
  const random = () => {
    const generated = seededRandom(nextSeed);
    nextSeed = generated.nextSeed;
    return generated.value;
  };

  const missionScenario = initialMissionScenario(activeRunways, 0, random);
  const mission = summarizeMission(missionScenario.missionFlights);
  const initialAircraft = missionScenario.aircraft;

  return {
    aircraft: toMap(initialAircraft),
    conflicts: [],
    score: createInitialScore(),
    time: 0,
    speed: 1,
    paused: false,
    wind: { direction: 140, speed: 11 },
    activeRunways,
    events: initialAircraft.map((item) => createSpawnEvent(0, item)).reverse(),
    difficulty,
    nextSpawnIn: Number.POSITIVE_INFINITY,
    mission,
  };
}

export interface SimStore extends GameState {
  selectedAircraftId: string | null;
  seed: number;
  flightIndex: number;
  seenConflicts: Set<string>;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: 1 | 2 | 4) => void;
  setDifficulty: (difficulty: DifficultyLevel) => void;
  setActiveRunways: (runways: string[]) => void;
  selectAircraft: (id: string | null) => void;
  issueCommand: (command: CommandType) => void;
  tick: (dt: number) => void;
  restart: () => void;
}

const base = initialGameState();

export const useSimStore = create<SimStore>((set) => ({
  ...base,
  selectedAircraftId: null,
  seed: 20260415,
  flightIndex: base.aircraft.size,
  seenConflicts: new Set<string>(),

  setPaused: (paused) => set({ paused }),

  setSpeed: (speed) => set({ speed }),

  setDifficulty: (difficulty) => {
    set({ difficulty });
  },

  setActiveRunways: (runways) => {
    set({ activeRunways: runways });
  },

  selectAircraft: (id) => {
    set((state) => {
      const aircraft = new Map(state.aircraft);
      for (const [key, value] of aircraft) {
        aircraft.set(key, {
          ...value,
          isSelected: key === id,
        });
      }
      return {
        selectedAircraftId: id,
        aircraft,
      };
    });
  },

  issueCommand: (command) => {
    set((state) => {
      if (!state.selectedAircraftId) {
        return state;
      }

      const target = state.aircraft.get(state.selectedAircraftId);
      if (!target) {
        return state;
      }

      const applied = applyCommand(target, command, state.activeRunways, state.time);
      const aircraft = new Map(state.aircraft);
      aircraft.set(target.id, applied.aircraft);

      const severity = applied.result.ok ? "info" : "warning";
      const commandEvent: GameEvent = {
        timestamp: state.time,
        type: applied.result.ok ? "command" : "info",
        severity,
        message: applied.result.message,
      };

      const events: GameEvent[] = [commandEvent];
      if (applied.result.ok && command.type === "takeoff") {
        events.push({
          timestamp: state.time,
          type: "takeoff",
          severity: "info",
          message: `${target.callsign} departed ${command.runway}`,
        });
      }

      let mission = state.mission;
      let bonusScore = 0;
      let missionCompletedNow = false;

      if (applied.result.ok) {
        const missionStep = applyMissionObjectives(state.mission, target.id, command, state.time);
        mission = missionStep.mission;
        bonusScore = missionStep.bonusScore;
        missionCompletedNow = missionStep.missionCompletedNow;
        events.push(...missionStep.events);
      }

      const byCallsign = new Map(Array.from(aircraft.values()).map((a) => [a.callsign, a]));
      let score = updateScoreFromEvents(state.score, events, byCallsign);
      if (bonusScore > 0) {
        score = {
          ...score,
          totalScore: score.totalScore + bonusScore,
        };
      }
      score = syncScoreWithMission(score, mission);

      return {
        aircraft,
        mission,
        score,
        events: pushEvents(state.events, events),
        paused: missionCompletedNow ? true : state.paused,
      };
    });
  },

  tick: (dt) => {
    set((state) => {
      const now = state.time + dt;
      const seed = state.seed;

      let working = Array.from(state.aircraft.values()).map((aircraft) =>
        updateAircraftPhysicsAtTime(aircraft, dt, now),
      );

      const approachStep = updateApproaches(working, now);
      working = approachStep.aircraftList;

      const conflicts = detectConflicts(
        working.filter((aircraft) => aircraft.status !== "landed" && aircraft.status !== "taxiing"),
      );
      const callsignsInConflict = new Set(
        conflicts.flatMap((conflict) => [conflict.aircraft1, conflict.aircraft2]),
      );

      working = working
        .filter((aircraft) => aircraft.removeAt === undefined || aircraft.removeAt > now)
        .map((aircraft) => ({
          ...aircraft,
          hasConflict: callsignsInConflict.has(aircraft.callsign),
        }));

      const conflictEvents: GameEvent[] = [];
      const activeConflictKeys = new Set(conflicts.map(conflictKey));
      const seenConflicts = new Set(
        [...state.seenConflicts].filter((key) => activeConflictKeys.has(key)),
      );
      let newViolationCount = 0;
      let newViolationPenalty = 0;
      for (const conflict of conflicts) {
        const key = conflictKey(conflict);
        if (!seenConflicts.has(key)) {
          seenConflicts.add(key);
          conflictEvents.push({
            timestamp: now,
            type: conflict.severity === "collision" ? "collision" : "conflict",
            severity: conflict.severity === "warning" ? "warning" : "critical",
            message: `${conflict.aircraft1} and ${conflict.aircraft2} ${conflict.severity} ${conflict.distance.toFixed(1)}nm/${Math.round(conflict.altDiff)}ft`,
          });
          if (hasSeparationViolation(conflict)) {
            newViolationCount += 1;
            newViolationPenalty += 500;
          }
        }
      }

      const allEvents = [...approachStep.events, ...conflictEvents];
      const byCallsign = new Map(working.map((aircraft) => [aircraft.callsign, aircraft]));

      let score: ScoreState = updateScoreFromEvents(state.score, allEvents, byCallsign);
      if (newViolationCount > 0) {
        score = {
          ...score,
          separationViolations: score.separationViolations + newViolationCount,
          totalScore: score.totalScore - newViolationPenalty,
        };
      }
      score = applyHoldingPenalty(score, working, dt);
      score = deriveScoreMetrics(score, working);
      score = syncScoreWithMission(score, state.mission);

      const selectedAircraftId =
        state.selectedAircraftId && working.some((aircraft) => aircraft.id === state.selectedAircraftId)
          ? state.selectedAircraftId
          : null;

      return {
        aircraft: toMap(working),
        conflicts,
        time: now,
        score,
        events: pushEvents(state.events, allEvents),
        nextSpawnIn: Number.POSITIVE_INFINITY,
        seed,
        selectedAircraftId,
        seenConflicts,
      };
    });
  },

  restart: () => {
    const resetState = initialGameState(20260415);
    set({
      ...resetState,
      selectedAircraftId: null,
      seed: 20260415,
      flightIndex: resetState.aircraft.size,
      seenConflicts: new Set<string>(),
    });
  },
}));

export function listRunwayOptions(activeRunways: string[]): string[] {
  return activeRunways
    .map((token) => resolveRunwayToken(token))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => item.runwayId);
}
