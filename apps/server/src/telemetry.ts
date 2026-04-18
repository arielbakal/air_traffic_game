import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { AgentDecision, RejectionRecord, SafetyOverride } from "./types.ts";

const LOG_DIR = "logs";
mkdirSync(LOG_DIR, { recursive: true });

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function logPath(name: string): string {
  return join(LOG_DIR, `${name}-${dateStamp()}.jsonl`);
}

function write(path: string, data: unknown): void {
  try {
    appendFileSync(path, JSON.stringify(data) + "\n", "utf8");
  } catch {
    // non-fatal
  }
}

export function logDecision(decision: AgentDecision): void {
  write(logPath("agent"), { event: "decision", ...decision });
}

export function logRejection(record: RejectionRecord): void {
  write(logPath("agent"), { event: "rejection", ...record });
}

export function logSafetyOverride(override: SafetyOverride): void {
  write(logPath("agent"), { event: "safety_override", ...override });
  console.warn(`[SAFETY] ${override.callsign}: ${override.action} — ${override.reason}`);
}

export function logError(context: string, err: unknown): void {
  write(logPath("agent"), { event: "error", context, message: String(err) });
  console.error(`[ERROR] ${context}:`, err);
}

export function logSessionStart(seed: number, difficulty: string, model: string): void {
  write(logPath("agent"), { event: "session_start", seed, difficulty, model, ts: Date.now() });
}
