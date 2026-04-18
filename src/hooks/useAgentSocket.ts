import { useEffect, useRef, useState } from "react";
import { useSimStore } from "../store/useSimStore";
import type { CommandType, Aircraft, ConflictPair, GameEvent, ScoreState, MissionState } from "@atc/core";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

export type ControllerMode = "human" | "ai" | "collaborative";

export interface AgentDecisionInfo {
  assessment: string;
  commands: unknown[];
  ts: number;
}

export interface AgentStatusInfo {
  mode: ControllerMode;
  model: string;
  ollamaHost: string;
  agentStatus: {
    state: string;
    decisionsTotal: number;
    rejectionsTotal: number;
    overridesTotal: number;
    meanLatencyMs: number;
  } | null;
  lastAssessment: string;
}

interface ServerGameState {
  aircraft: Aircraft[];
  conflicts: ConflictPair[];
  score: ScoreState;
  time: number;
  speed: 1 | 2 | 4;
  paused: boolean;
  activeRunways: string[];
  events: GameEvent[];
  mission: MissionState;
  controllerMode: ControllerMode;
}

export function useAgentSocket(mode: ControllerMode) {
  const ioRef = useRef<ReturnType<typeof createSocketIO> | null>(null);
  const [connected, setConnected] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatusInfo | null>(null);
  const [lastDecision, setLastDecision] = useState<AgentDecisionInfo | null>(null);
  const [overrideCount, setOverrideCount] = useState(0);

  const loadServerState = useSimStore(s => s.loadServerState);
  const issueCommandDirect = useRef<((callsign: string, cmd: CommandType) => void) | null>(null);

  useEffect(() => {
    if (mode === "human") {
      ioRef.current?.disconnect();
      ioRef.current = null;
      setConnected(false);
      return;
    }

    const io = createSocketIO(SERVER_URL);
    ioRef.current = io;

    io.on("connect", () => setConnected(true));
    io.on("disconnect", () => setConnected(false));

    io.on("game:state", (raw: unknown) => {
      const state = raw as ServerGameState;
      loadServerState({
        aircraft: new Map(state.aircraft.map(a => [a.id, a])),
        conflicts: state.conflicts,
        score: state.score,
        time: state.time,
        speed: state.speed,
        paused: state.paused,
        activeRunways: state.activeRunways,
        events: state.events,
        mission: state.mission,
      });
    });

    io.on("agent:status", (raw: unknown) => setAgentStatus(raw as AgentStatusInfo));
    io.on("agent:decision", (raw: unknown) => {
      const data = raw as { assessment: string; commands: unknown[] };
      setLastDecision({ assessment: data.assessment, commands: data.commands, ts: Date.now() });
    });
    io.on("agent:override", () => setOverrideCount(c => c + 1));

    issueCommandDirect.current = (callsign: string, cmd: CommandType) => {
      io.emit("game:command", { callsign, command: cmd });
    };

    return () => {
      io.disconnect();
      ioRef.current = null;
    };
  }, [mode, loadServerState]);

  const sendCommand = (callsign: string, cmd: CommandType) => {
    ioRef.current?.emit("game:command", { callsign, command: cmd });
  };

  const changeMode = (newMode: ControllerMode) => {
    ioRef.current?.emit("mode:change", newMode);
  };

  const setPaused = (paused: boolean) => {
    ioRef.current?.emit("game:pause", paused);
  };

  const setSpeed = (speed: 1 | 2 | 4) => {
    ioRef.current?.emit("game:speed", speed);
  };

  const restart = () => {
    ioRef.current?.emit("game:restart");
  };

  return { connected, agentStatus, lastDecision, overrideCount, sendCommand, changeMode, setPaused, setSpeed, restart };
}

// Minimal Socket.IO client without importing socket.io-client
// Uses the socket.io HTTP polling fallback for simplicity
function createSocketIO(url: string) {
  let eventHandlers = new Map<string, ((data: unknown) => void)[]>();
  let ws: WebSocket | null = null;
  let connected = false;
  const pendingEmits: Array<{ event: string; data: unknown }> = [];

  function connect() {
    try {
      const origin = url || window.location.origin;
      const wsUrl = origin.replace("http://", "ws://").replace("https://", "wss://") + "/socket.io/?EIO=4&transport=websocket";
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        connected = true;
        trigger("connect", undefined);
        pendingEmits.forEach(({ event, data }) => emit(event, data));
        pendingEmits.length = 0;
      };

      ws.onmessage = (evt) => {
        const raw = evt.data as string;
        if (raw === "2") { ws!.send("3"); return; } // ping/pong
        if (!raw.startsWith("42")) return;
        try {
          const [event, data] = JSON.parse(raw.slice(2)) as [string, unknown];
          trigger(event, data);
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        connected = false;
        trigger("disconnect", undefined);
        setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch { /* can't connect */ }
  }

  function emit(event: string, data?: unknown) {
    const msg = "42" + JSON.stringify([event, data]);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(msg);
    } else {
      pendingEmits.push({ event, data });
    }
  }

  function on(event: string, handler: (data: unknown) => void) {
    if (!eventHandlers.has(event)) eventHandlers.set(event, []);
    eventHandlers.get(event)!.push(handler);
  }

  function trigger(event: string, data: unknown) {
    eventHandlers.get(event)?.forEach(h => h(data));
  }

  function disconnect() {
    ws?.close();
    eventHandlers.clear();
  }

  connect();
  return { on, emit, disconnect, get connected() { return connected; } };
}
