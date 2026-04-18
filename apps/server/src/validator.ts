import { detectConflicts, applyCommand } from "@atc/core";
import type { Aircraft, GameState } from "@atc/core";
import type { ATCCommand } from "./schema.ts";
import type { CommandValidationResult } from "./types.ts";

function findAircraft(state: GameState, callsign: string): Aircraft | undefined {
  return Array.from(state.aircraft.values()).find(a => a.callsign === callsign);
}

function normalize(callsign: string): string {
  return callsign.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function fuzzyFind(state: GameState, rawCallsign: string): Aircraft | undefined {
  const norm = normalize(rawCallsign);
  return Array.from(state.aircraft.values()).find(
    a => normalize(a.callsign) === norm
  );
}

export function validateCommand(cmd: ATCCommand, state: GameState): CommandValidationResult {
  if (cmd.type === "noop") return { ok: true };

  const aircraft = fuzzyFind(state, cmd.callsign!);
  if (!aircraft) {
    return { ok: false, reason: `Callsign "${cmd.callsign}" not found in active traffic` };
  }

  if (cmd.type === "heading" || cmd.type === "altitude" || cmd.type === "speed") {
    if (aircraft.status === "approach" || aircraft.status === "landing") {
      return { ok: false, reason: `Cannot issue ${cmd.type} to ${aircraft.callsign} — established on approach` };
    }
    if (cmd.type === "altitude" && cmd.value !== undefined && cmd.value % 100 !== 0) {
      return { ok: false, reason: `Altitude must be a multiple of 100ft` };
    }
    if (cmd.type === "speed" && cmd.value !== undefined) {
      if (cmd.value < aircraft.minSpeed || cmd.value > aircraft.maxSpeed) {
        return { ok: false, reason: `Speed ${cmd.value} outside aircraft limits [${aircraft.minSpeed}–${aircraft.maxSpeed}]` };
      }
    }
  }

  if (cmd.type === "approach") {
    if (!state.activeRunways.some(r => r.endsWith(cmd.runway!.split("-")[1] ?? cmd.runway!))) {
      return { ok: false, reason: `Runway ${cmd.runway} is not active` };
    }
    if (aircraft.status === "departing" || aircraft.status === "taxiing") {
      return { ok: false, reason: `Cannot clear ${aircraft.callsign} for approach — not airborne` };
    }
  }

  if (cmd.type === "takeoff") {
    if (aircraft.status !== "departing" && aircraft.status !== "taxiing") {
      return { ok: false, reason: `${aircraft.callsign} is not on the ground (status: ${aircraft.status})` };
    }
  }

  if (cmd.type === "goAround") {
    if (aircraft.status !== "approach" && aircraft.status !== "landing") {
      return { ok: false, reason: `${aircraft.callsign} is not on approach (status: ${aircraft.status})` };
    }
  }

  // Safety check: simulate the command and test for immediate separation violation
  if (cmd.type === "heading" || cmd.type === "altitude" || cmd.type === "speed") {
    const commandType = cmd.type === "heading"
      ? { type: "heading" as const, value: cmd.value! }
      : cmd.type === "altitude"
        ? { type: "altitude" as const, value: cmd.value! }
        : { type: "speed" as const, value: cmd.value! };

    const result = applyCommand(aircraft, commandType, state.activeRunways, state.time);
    if (result.result.ok) {
      const simulated = new Map(state.aircraft);
      simulated.set(aircraft.id, result.aircraft);
      const airborne = Array.from(simulated.values()).filter(
        a => a.status !== "landed" && a.status !== "taxiing"
      );
      const conflicts = detectConflicts(airborne);
      const immediateCollision = conflicts.some(c =>
        (c.aircraft1 === aircraft.callsign || c.aircraft2 === aircraft.callsign) &&
        c.severity === "collision" &&
        c.timeToClosest < 30
      );
      if (immediateCollision) {
        return { ok: false, reason: `Command would put ${aircraft.callsign} into imminent collision` };
      }
    }
  }

  return { ok: true };
}

export function deduplicateCommands(cmds: ATCCommand[], state: GameState): ATCCommand[] {
  const seen = new Set<string>();
  return cmds.filter(cmd => {
    if (cmd.type === "noop") return true;
    const aircraft = fuzzyFind(state, cmd.callsign!);
    if (!aircraft) return true;

    // Drop exact duplicate target values
    if (cmd.type === "heading" && Math.abs(aircraft.targetHeading - cmd.value!) < 2) return false;
    if (cmd.type === "altitude" && Math.abs(aircraft.targetAltitude - cmd.value!) < 50) return false;
    if (cmd.type === "speed" && Math.abs(aircraft.targetSpeed - cmd.value!) < 5) return false;

    const key = cmd.callsign ?? "noop";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
