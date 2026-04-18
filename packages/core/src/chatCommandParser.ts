import type { CommandType } from "./types";

interface ParseOk {
  ok: true;
  command: CommandType;
}

interface ParseError {
  ok: false;
  error: string;
}

export type ChatParseResult = ParseOk | ParseError;

interface ParseContext {
  takeoffAirport?: string;
  approachAirport?: string;
}

function parseAltitudeValue(token: string): number | null {
  const clean = token.trim().toLowerCase();
  if (!clean) {
    return null;
  }

  if (clean.startsWith("fl")) {
    const fl = Number(clean.slice(2));
    if (!Number.isFinite(fl)) {
      return null;
    }
    return fl * 100;
  }

  const raw = Number(clean);
  return Number.isFinite(raw) ? raw : null;
}

function resolveRunway(raw: string, activeRunways: string[], preferredAirport?: string): string | null {
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned) {
    if (!preferredAirport) {
      return null;
    }
    return activeRunways.find((runway) => runway.startsWith(`${preferredAirport}-`)) ?? null;
  }

  const exact = activeRunways.find((runway) => runway.toUpperCase() === cleaned);
  if (exact) {
    return exact;
  }

  // Allow shorthand like "13" by matching runway-end suffix in tokens like "SABE-13".
  const preferredSuffix = preferredAirport
    ? activeRunways.find(
        (runway) => runway.startsWith(`${preferredAirport}-`) && runway.toUpperCase().endsWith(`-${cleaned}`),
      )
    : null;
  if (preferredSuffix) {
    return preferredSuffix;
  }

  const suffix = activeRunways.find((runway) => runway.toUpperCase().endsWith(`-${cleaned}`));
  return suffix ?? null;
}

export function parseChatCommand(input: string, activeRunways: string[], context?: ParseContext): ChatParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a command." };
  }

  const normalized = trimmed.replace(/\s+/g, " ").toLowerCase();
  const tokens = normalized.split(" ");
  const first = tokens[0];

  if (first === "hold") {
    return { ok: true, command: { type: "hold" } };
  }

  if (normalized === "ga" || normalized === "go around" || normalized === "goaround") {
    return { ok: true, command: { type: "goAround" } };
  }

  if (first === "hdg" || first === "heading" || first === "turn") {
    const value = Number(tokens[1]);
    if (!Number.isFinite(value)) {
      return { ok: false, error: "Heading format: hdg 180" };
    }
    return { ok: true, command: { type: "heading", value } };
  }

  if (first === "alt" || first === "altitude" || first === "climb" || first === "descend") {
    const value = parseAltitudeValue(tokens[1] ?? "");
    if (value === null) {
      return { ok: false, error: "Altitude format: alt 5000 or alt FL120" };
    }
    return { ok: true, command: { type: "altitude", value } };
  }

  if (first === "spd" || first === "speed") {
    const value = Number(tokens[1]);
    if (!Number.isFinite(value)) {
      return { ok: false, error: "Speed format: spd 220" };
    }
    return { ok: true, command: { type: "speed", value } };
  }

  if (first === "app" || first === "approach" || first === "ils") {
    const runwayHint = tokens[1] ?? "";
    const runwayToken = resolveRunway(runwayHint, activeRunways, context?.approachAirport);
    if (!runwayToken) {
      return { ok: false, error: "Approach format: app SABE-13 (or app 13)." };
    }
    return { ok: true, command: { type: "approach", runway: runwayToken } };
  }

  if (first === "tko" || first === "takeoff") {
    const runwayToken =
      resolveRunway(tokens[1] ?? "", activeRunways, context?.takeoffAirport) ?? activeRunways[0] ?? "";
    if (!runwayToken) {
      return { ok: false, error: "No active runway available for takeoff." };
    }
    return { ok: true, command: { type: "takeoff", runway: runwayToken } };
  }

  return {
    ok: false,
    error:
      "Unknown command. Try: hdg 180, alt 5000, spd 220, app SABE-13, hold, ga, takeoff SABE-13",
  };
}
