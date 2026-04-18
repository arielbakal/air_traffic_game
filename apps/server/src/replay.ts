import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { Aircraft, GameState } from "@atc/core";
import type { ReplayEntry } from "./types.ts";

const REPLAY_DIR = "logs/replays";
mkdirSync(REPLAY_DIR, { recursive: true });

export interface ReplaySession {
  sessionId: string;
  startedAt: number;
  initialState: SerializedGameState;
  entries: ReplayEntry[];
  tick: number;
}

export interface SerializedGameState {
  aircraft: Aircraft[];
  time: number;
  speed: number;
  activeRunways: string[];
  difficulty: string;
}

function serializeState(state: GameState): SerializedGameState {
  return {
    aircraft: Array.from(state.aircraft.values()),
    time: state.time,
    speed: state.speed,
    activeRunways: state.activeRunways,
    difficulty: state.difficulty,
  };
}

export function createReplaySession(state: GameState): ReplaySession {
  return {
    sessionId: `${Date.now()}`,
    startedAt: Date.now(),
    initialState: serializeState(state),
    entries: [],
    tick: 0,
  };
}

export function recordReplayEntry(session: ReplaySession, entry: ReplayEntry): void {
  session.entries.push(entry);
  session.tick = entry.tick;
}

export function saveReplay(session: ReplaySession): void {
  const filename = join(REPLAY_DIR, `replay-${session.sessionId}.json`);
  try {
    writeFileSync(filename, JSON.stringify(session, null, 2), "utf8");
    console.log(`[Replay] Saved to ${filename} (${session.entries.length} commands)`);
  } catch (err) {
    console.error("[Replay] Failed to save:", err);
  }
}
