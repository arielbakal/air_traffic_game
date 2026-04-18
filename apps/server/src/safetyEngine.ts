import { detectConflicts } from "@atc/core";
import type { Aircraft } from "@atc/core";
import type { SafetyOverride } from "./types.ts";

const EMERGENCY_CLIMB_FT = 1000;
const COLLISION_TIME_THRESHOLD_S = 60;

export function runSafetyEngine(
  aircraftList: Aircraft[],
  simTime: number,
): { overrides: SafetyOverride[]; patches: Map<string, Partial<Aircraft>> } {
  const overrides: SafetyOverride[] = [];
  const patches = new Map<string, Partial<Aircraft>>();

  const airborne = aircraftList.filter(a => a.status !== "landed" && a.status !== "taxiing");
  const conflicts = detectConflicts(airborne);

  for (const conflict of conflicts) {
    if (conflict.severity !== "collision") continue;
    if (conflict.timeToClosest > COLLISION_TIME_THRESHOLD_S) continue;

    const a = airborne.find(x => x.callsign === conflict.aircraft1);
    const b = airborne.find(x => x.callsign === conflict.aircraft2);
    if (!a || !b) continue;

    // Climb the higher-altitude aircraft by EMERGENCY_CLIMB_FT, descend the lower
    const higher = a.altitude >= b.altitude ? a : b;
    const lower = a.altitude >= b.altitude ? b : a;

    if (!patches.has(higher.id)) {
      const newAlt = higher.targetAltitude + EMERGENCY_CLIMB_FT;
      patches.set(higher.id, { targetAltitude: Math.min(newAlt, higher.maxSpeed > 400 ? 45000 : 18000) });
      overrides.push({
        timestamp: simTime,
        callsign: higher.callsign,
        action: `TCAS RA: climb to ${Math.round(higher.targetAltitude + EMERGENCY_CLIMB_FT)}ft`,
        reason: `Collision imminent with ${lower.callsign} in ${Math.round(conflict.timeToClosest)}s`,
      });
    }
    if (!patches.has(lower.id)) {
      const newAlt = lower.targetAltitude - EMERGENCY_CLIMB_FT;
      patches.set(lower.id, { targetAltitude: Math.max(newAlt, 2000) });
      overrides.push({
        timestamp: simTime,
        callsign: lower.callsign,
        action: `TCAS RA: descend to ${Math.round(lower.targetAltitude - EMERGENCY_CLIMB_FT)}ft`,
        reason: `Collision imminent with ${higher.callsign} in ${Math.round(conflict.timeToClosest)}s`,
      });
    }
  }

  return { overrides, patches };
}
