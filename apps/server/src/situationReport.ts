import { bearingFromTo, haversineNm } from "@atc/core";
import type { Aircraft, GameState } from "@atc/core";

const REFERENCE = { lat: -34.5594, lng: -58.4155 }; // SABE

function bearingLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600).toString().padStart(2, "0");
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${h}:${m}:${ss}`;
}

function aircraftRow(a: Aircraft): string {
  const dist = haversineNm(a.position, REFERENCE);
  const brg = Math.round(bearingFromTo(REFERENCE, a.position));
  const fl = Math.round(a.altitude / 100).toString().padStart(3, "0");
  const loc = `${dist.toFixed(0)}nm/${bearingLabel(brg)}`;
  const assigned = a.assignedRunway ?? a.commandRunway ?? "-";
  return `| ${a.callsign.padEnd(8)} | ${a.type.padEnd(4)} | ${loc.padEnd(10)} | FL${fl} | ${String(Math.round(a.heading)).padEnd(3)} | ${String(Math.round(a.speed)).padEnd(3)} | ${a.status.padEnd(10)} | ${assigned} |`;
}

function pendingDecisions(aircraftList: Aircraft[], conflicts: GameState["conflicts"]): string[] {
  const decisions: string[] = [];

  for (const a of aircraftList) {
    if ((a.status === "arriving" || a.status === "enroute") && !a.commandRunway && !a.assignedRunway) {
      const dist = haversineNm(a.position, REFERENCE);
      if (dist < 25) {
        decisions.push(`${a.callsign} needs approach clearance (${dist.toFixed(0)}nm from SABE, FL${Math.round(a.altitude / 100).toString().padStart(3, "0")})`);
      }
    }
    if (a.status === "taxiing" || (a.status === "departing" && a.speed < 5)) {
      decisions.push(`${a.callsign} awaiting takeoff clearance`);
    }
  }

  if (conflicts.length === 0) {
    decisions.push("No active conflicts");
  }

  return decisions;
}

export function buildSituationReport(state: GameState): string {
  const aircraftList = Array.from(state.aircraft.values());
  const header = `CURRENT TIME: T+${fmtTime(state.time)}
ACTIVE RUNWAYS: ${state.activeRunways.join(", ")}
SPEED MULTIPLIER: ${state.speed}x

TRAFFIC (${aircraftList.length} aircraft):
| Callsign | Type | Pos (SABE)  | Alt   | Hdg | Spd | Status     | Runway |
|----------|------|-------------|-------|-----|-----|------------|--------|
${aircraftList.map(aircraftRow).join("\n")}`;

  const conflictSection = state.conflicts.length > 0
    ? `\nCONFLICTS — RESOLVE IMMEDIATELY:\n${state.conflicts.map(c =>
        `- ${c.aircraft1} / ${c.aircraft2}: ${c.distance.toFixed(1)}nm apart, ${Math.round(c.altDiff)}ft vertical, severity=${c.severity.toUpperCase()}, closest in ${Math.round(c.timeToClosest)}s`
      ).join("\n")}`
    : "\nCONFLICTS: None currently";

  const decisions = pendingDecisions(aircraftList, state.conflicts);
  const decisionSection = `\nPENDING DECISIONS:\n${decisions.map(d => `- ${d}`).join("\n")}`;

  return `${header}${conflictSection}${decisionSection}\n\nIssue commands as needed. If nothing needs doing, reply with noop.`;
}
