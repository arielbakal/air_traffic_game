import type { CommandType } from "@atc/core";

export type ControllerMode = "human" | "ai" | "collaborative";

export interface AgentCommand {
  type: string;
  callsign?: string;
  value?: number;
  runway?: string;
  reasoning: string;
}

export interface AgentDecision {
  timestamp: number;
  situationAssessment: string;
  commands: AgentCommand[];
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  accepted: number;
  rejected: number;
}

export interface RejectionRecord {
  command: AgentCommand;
  reason: string;
  timestamp: number;
}

export interface SafetyOverride {
  timestamp: number;
  callsign: string;
  action: string;
  reason: string;
}

export interface ReplayEntry {
  tick: number;
  simTime: number;
  source: "human" | "agent" | "safety";
  callsign: string;
  command: CommandType;
}

export interface CommandValidationResult {
  ok: boolean;
  reason?: string;
}

export interface AgentStatus {
  state: "idle" | "thinking" | "applying";
  lastDecisionAt: number;
  nextDecisionIn: number;
  decisionsTotal: number;
  rejectionsTotal: number;
  overridesTotal: number;
  meanLatencyMs: number;
}
