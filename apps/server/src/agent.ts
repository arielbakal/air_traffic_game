import { applyCommand } from "@atc/core";
import type { GameState } from "@atc/core";
import { SYSTEM_PROMPT } from "./prompts.ts";
import { buildSituationReport } from "./situationReport.ts";
import { queryOllama, getModelName } from "./ollama.ts";
import { validateCommand, deduplicateCommands } from "./validator.ts";
import { logDecision, logRejection, logError } from "./telemetry.ts";
import { recordReplayEntry } from "./replay.ts";
import type { ReplaySession } from "./replay.ts";
import type { AgentStatus } from "./types.ts";

const AGENT_TICK_MS = 7000;
const COOLDOWN_PER_AIRCRAFT_MS = 15_000;

export class AgentController {
  private busy = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastCommandAt = new Map<string, number>();
  private latencies: number[] = [];

  readonly status: AgentStatus = {
    state: "idle",
    lastDecisionAt: 0,
    nextDecisionIn: AGENT_TICK_MS / 1000,
    decisionsTotal: 0,
    rejectionsTotal: 0,
    overridesTotal: 0,
    meanLatencyMs: 0,
  };

  constructor(
    private getState: () => GameState,
    private applyCommandToState: (callsign: string, cmd: ReturnType<typeof applyCommand>["aircraft"]) => void,
    private onDecision: (assessment: string, cmds: unknown[]) => void,
    private replay: ReplaySession | null,
    private tickRef: { current: number },
  ) {}

  start(): void {
    this.timer = setInterval(() => this.tick(), AGENT_TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    const state = this.getState();
    if (state.paused || state.mission.isComplete) return;
    if (state.aircraft.size === 0) return;

    this.busy = true;
    this.status.state = "thinking";

    try {
      const report = buildSituationReport(state);
      const { response, tokensIn, tokensOut, latencyMs } = await queryOllama(SYSTEM_PROMPT, report);

      this.latencies.push(latencyMs);
      if (this.latencies.length > 20) this.latencies.shift();
      this.status.meanLatencyMs = Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length);
      this.status.state = "applying";

      const dedupedCmds = deduplicateCommands(response.commands, state);
      let accepted = 0, rejected = 0;

      for (const cmd of dedupedCmds) {
        if (cmd.type === "noop") continue;

        const now = Date.now();
        const lastCmd = this.lastCommandAt.get(cmd.callsign ?? "");
        if (lastCmd && now - lastCmd < COOLDOWN_PER_AIRCRAFT_MS) {
          logRejection({ command: cmd, reason: "Cooldown period active for this aircraft", timestamp: state.time });
          rejected++;
          continue;
        }

        const validation = validateCommand(cmd, state);
        if (!validation.ok) {
          logRejection({ command: cmd, reason: validation.reason ?? "Unknown", timestamp: state.time });
          this.status.rejectionsTotal++;
          rejected++;
          continue;
        }

        // Map ATCCommand → CommandType and apply
        let commandType: Parameters<typeof applyCommand>[1] | null = null;
        if (cmd.type === "heading") commandType = { type: "heading", value: cmd.value! };
        else if (cmd.type === "altitude") commandType = { type: "altitude", value: cmd.value! };
        else if (cmd.type === "speed") commandType = { type: "speed", value: cmd.value! };
        else if (cmd.type === "approach") commandType = { type: "approach", runway: cmd.runway! };
        else if (cmd.type === "hold") commandType = { type: "hold" };
        else if (cmd.type === "goAround") commandType = { type: "goAround" };
        else if (cmd.type === "takeoff") commandType = { type: "takeoff", runway: cmd.runway! };

        if (!commandType) continue;

        const aircraft = Array.from(state.aircraft.values()).find(a => a.callsign === cmd.callsign);
        if (!aircraft) continue;

        const applied = applyCommand(aircraft, commandType, state.activeRunways, state.time);
        if (applied.result.ok) {
          this.applyCommandToState(cmd.callsign!, applied.aircraft);
          this.lastCommandAt.set(cmd.callsign!, Date.now());
          accepted++;

          if (this.replay) {
            recordReplayEntry(this.replay, {
              tick: this.tickRef.current,
              simTime: state.time,
              source: "agent",
              callsign: cmd.callsign!,
              command: commandType,
            });
          }
        }
      }

      const decision = {
        timestamp: state.time,
        situationAssessment: response.situation_assessment,
        commands: response.commands,
        latencyMs,
        tokensIn,
        tokensOut,
        accepted,
        rejected,
      };
      logDecision(decision);
      this.onDecision(response.situation_assessment, response.commands);
      this.status.decisionsTotal++;
      this.status.lastDecisionAt = Date.now();
    } catch (err) {
      logError("agent tick", err);
    } finally {
      this.busy = false;
      this.status.state = "idle";
      this.status.nextDecisionIn = AGENT_TICK_MS / 1000;
    }
  }
}
