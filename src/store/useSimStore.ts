import { create } from "zustand";
import { applyCommand } from "../core/commands";
import { DEFAULT_ACTIVE_RUNWAYS, DIFFICULTY_CONFIG, resolveRunwayToken } from "../core/constants";
import { updateApproaches } from "../core/approach";
import { updateAircraftPhysics } from "../core/physics";
import { detectConflicts } from "../core/separation";
import {
  applyHoldingPenalty,
  createInitialScore,
  deriveScoreMetrics,
  updateScoreFromConflicts,
  updateScoreFromEvents,
} from "../core/scoring";
import { initialTraffic, nextSpawnInterval, spawnTraffic } from "../core/spawner";
import type {
  Aircraft,
  CommandType,
  ConflictPair,
  DifficultyLevel,
  GameEvent,
  GameState,
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

function initialGameState(seed = 20260415): GameState {
  const difficulty: DifficultyLevel = "junior";
  const activeRunways = [...DEFAULT_ACTIVE_RUNWAYS];

  let nextSeed = seed;
  const random = () => {
    const generated = seededRandom(nextSeed);
    nextSeed = generated.nextSeed;
    return generated.value;
  };

  const initialAircraft = initialTraffic(
    DIFFICULTY_CONFIG[difficulty].startCount,
    activeRunways,
    0,
    random,
  );

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
    nextSpawnIn: nextSpawnInterval(difficulty, random),
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
    set({ difficulty, nextSpawnIn: DIFFICULTY_CONFIG[difficulty].spawnMin + 1 });
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

      const applied = applyCommand(target, command, state.activeRunways);
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

      const byCallsign = new Map(Array.from(aircraft.values()).map((a) => [a.callsign, a]));
      const score = updateScoreFromEvents(state.score, events, byCallsign);

      return {
        aircraft,
        score,
        events: pushEvents(state.events, events),
      };
    });
  },

  tick: (dt) => {
    set((state) => {
      const now = state.time + dt;
      let seed = state.seed;
      const random = () => {
        const generated = seededRandom(seed);
        seed = generated.nextSeed;
        return generated.value;
      };

      let working = Array.from(state.aircraft.values()).map((aircraft) => updateAircraftPhysics(aircraft, dt));

      const approachStep = updateApproaches(working, now);
      working = approachStep.aircraftList;

      const conflicts = detectConflicts(working.filter((aircraft) => aircraft.status !== "landed"));
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
      const seenConflicts = new Set(state.seenConflicts);
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
        }
      }

      let nextSpawnIn = state.nextSpawnIn - dt;
      const spawnEvents: GameEvent[] = [];
      let flightIndex = state.flightIndex;

      while (nextSpawnIn <= 0) {
        flightIndex += 1;
        const spawned = spawnTraffic(state.difficulty, state.activeRunways, now, flightIndex, random);
        working.push(spawned);
        spawnEvents.push(createSpawnEvent(now, spawned));
        nextSpawnIn += nextSpawnInterval(state.difficulty, random);
      }

      const allEvents = [...approachStep.events, ...conflictEvents, ...spawnEvents];
      const byCallsign = new Map(working.map((aircraft) => [aircraft.callsign, aircraft]));

      let score: ScoreState = updateScoreFromEvents(state.score, allEvents, byCallsign);
      score = updateScoreFromConflicts(score, conflicts);
      score = applyHoldingPenalty(score, working, dt);
      score = deriveScoreMetrics(score, working);

      return {
        aircraft: toMap(working),
        conflicts,
        time: now,
        score,
        events: pushEvents(state.events, allEvents),
        nextSpawnIn,
        seed,
        flightIndex,
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
