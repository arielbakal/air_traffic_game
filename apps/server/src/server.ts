import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { applyCommand } from "@atc/core";
import type { CommandType, Aircraft } from "@atc/core";
import type { ControllerMode } from "./types.ts";
import { createServerStore, serverTick, serverIssueCommand, serverRestart } from "./storeState.ts";
import { runSafetyEngine } from "./safetyEngine.ts";
import { AgentController } from "./agent.ts";
import { logSafetyOverride, logSessionStart } from "./telemetry.ts";
import { createReplaySession, saveReplay } from "./replay.ts";
import { getModelName, getOllamaHost } from "./ollama.ts";

const PORT = parseInt(process.env.PORT ?? "3001");
const FIXED_DT = 0.1;
const TICK_MS = 100;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

const store = createServerStore();
const replay = createReplaySession(store.game);
const tickRef = { current: 0 };

let lastAgentAssessment = "";
let lastAgentCommands: unknown[] = [];
let agentController: AgentController | null = null;

function serializeAircraft(aircraft: Map<string, Aircraft>): Aircraft[] {
  return Array.from(aircraft.values());
}

function broadcastState(): void {
  const { game } = store;
  io.emit("game:state", {
    aircraft: serializeAircraft(game.aircraft),
    conflicts: game.conflicts,
    score: game.score,
    time: game.time,
    speed: game.speed,
    paused: game.paused,
    activeRunways: game.activeRunways,
    events: game.events.slice(0, 40),
    mission: game.mission,
    controllerMode: store.controllerMode,
    pendingCommands: store.pendingCommands,
  });
}

// Physics loop
setInterval(() => {
  if (store.game.paused || store.game.mission.isComplete) return;

  tickRef.current++;
  serverTick(store, FIXED_DT);

  // Safety engine (Layer 1 — runs every tick, overrides LLM if needed)
  const aircraftList = Array.from(store.game.aircraft.values());
  const { overrides, patches } = runSafetyEngine(aircraftList, store.game.time);

  if (patches.size > 0) {
    const newAircraftMap = new Map(store.game.aircraft);
    for (const [id, patch] of patches) {
      const existing = newAircraftMap.get(id);
      if (existing) newAircraftMap.set(id, { ...existing, ...patch });
    }
    store.game = { ...store.game, aircraft: newAircraftMap };
    for (const override of overrides) {
      logSafetyOverride(override);
      if (agentController) agentController.status.overridesTotal++;
      io.emit("agent:override", override);
    }
  }

  broadcastState();
}, TICK_MS);

// Agent lifecycle
function startAgent(): void {
  if (agentController) agentController.stop();
  agentController = new AgentController(
    () => store.game,
    (callsign, updatedAircraft) => {
      const newMap = new Map(store.game.aircraft);
      newMap.set(updatedAircraft.id, updatedAircraft);
      store.game = { ...store.game, aircraft: newMap };
    },
    (assessment, cmds) => {
      lastAgentAssessment = assessment;
      lastAgentCommands = cmds;
      io.emit("agent:decision", { assessment, commands: cmds, status: agentController?.status });
    },
    replay,
    tickRef,
  );
  agentController.start();
  console.log(`[Agent] Started — model: ${getModelName()} @ ${getOllamaHost()}`);
}

function stopAgent(): void {
  agentController?.stop();
  agentController = null;
}

if (store.controllerMode === "ai" || store.controllerMode === "collaborative") {
  startAgent();
}

// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Send initial state immediately
  broadcastState();
  socket.emit("agent:status", {
    mode: store.controllerMode,
    model: getModelName(),
    ollamaHost: getOllamaHost(),
    agentStatus: agentController?.status ?? null,
    lastAssessment: lastAgentAssessment,
  });

  socket.on("game:command", (data: { callsign: string; command: CommandType }) => {
    if (store.controllerMode === "ai") return; // ignore human commands in AI mode
    const result = serverIssueCommand(store, data.callsign, data.command);
    socket.emit("command:result", result);
  });

  socket.on("game:pause", (paused: boolean) => {
    store.game = { ...store.game, paused };
  });

  socket.on("game:speed", (speed: 1 | 2 | 4) => {
    store.game = { ...store.game, speed };
  });

  socket.on("game:restart", () => {
    stopAgent();
    serverRestart(store);
    if (store.controllerMode !== "human") startAgent();
    logSessionStart(20260415, store.game.difficulty, getModelName());
    broadcastState();
  });

  socket.on("mode:change", (mode: ControllerMode) => {
    store.controllerMode = mode;
    if (mode === "human") {
      stopAgent();
    } else if (!agentController) {
      startAgent();
    }
    io.emit("agent:status", { mode, model: getModelName(), agentStatus: agentController?.status ?? null });
    console.log(`[Mode] Switched to ${mode}`);
  });

  socket.on("command:approve", (index: number) => {
    if (store.controllerMode !== "collaborative") return;
    const pending = store.pendingCommands[index];
    if (!pending) return;
    serverIssueCommand(store, pending.callsign, pending.command);
    store.pendingCommands.splice(index, 1);
  });

  socket.on("command:reject", (index: number) => {
    if (store.controllerMode !== "collaborative") return;
    store.pendingCommands.splice(index, 1);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Debug/telemetry HTTP endpoints
app.get("/api/status", (_req, res) => {
  res.json({
    mode: store.controllerMode,
    model: getModelName(),
    ollamaHost: getOllamaHost(),
    simTime: store.game.time,
    aircraft: store.game.aircraft.size,
    conflicts: store.game.conflicts.length,
    score: store.game.score.totalScore,
    agent: agentController?.status ?? null,
    lastAssessment: lastAgentAssessment,
    lastCommands: lastAgentCommands,
  });
});

app.get("/api/replay/save", (_req, res) => {
  saveReplay(replay);
  res.json({ ok: true, entries: replay.entries.length });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Server] Shutting down...");
  saveReplay(replay);
  stopAgent();
  process.exit(0);
});

httpServer.listen(PORT, () => {
  logSessionStart(20260415, store.game.difficulty, getModelName());
  console.log(`[Server] ATC backend running on http://localhost:${PORT}`);
  console.log(`[Server] Ollama: ${getOllamaHost()} | Model: ${getModelName()}`);
  console.log(`[Server] Controller mode: ${store.controllerMode}`);
});
