import { haversineNm, positionToLocalNm } from "./geo";
import type { Aircraft, ConflictPair, Position } from "./types";

const WARNING_DISTANCE_NM = 5;
const WARNING_ALT_FT = 1500;
const CONFLICT_DISTANCE_NM = 3;
const CONFLICT_ALT_FT = 1000;
const COLLISION_DISTANCE_NM = 1;
const COLLISION_ALT_FT = 200;

function classifySeverity(distance: number, altDiff: number): ConflictPair["severity"] | null {
  if (distance < COLLISION_DISTANCE_NM && altDiff < COLLISION_ALT_FT) {
    return "collision";
  }
  if (distance < CONFLICT_DISTANCE_NM && altDiff < CONFLICT_ALT_FT) {
    return "critical";
  }
  if (distance < WARNING_DISTANCE_NM && altDiff < WARNING_ALT_FT) {
    return "warning";
  }
  return null;
}

function velocityVectorNmPerSec(aircraft: Aircraft): { x: number; y: number; z: number } {
  const speedNmS = aircraft.speed / 3600;
  const headingRad = (aircraft.heading * Math.PI) / 180;
  return {
    x: speedNmS * Math.sin(headingRad),
    y: speedNmS * Math.cos(headingRad),
    z: aircraft.verticalSpeed / 60,
  };
}

function projectClosestApproach(a: Aircraft, b: Aircraft): { distance: number; altDiff: number; timeToClosest: number } {
  const center: Position = {
    lat: (a.position.lat + b.position.lat) / 2,
    lng: (a.position.lng + b.position.lng) / 2,
  };

  const aLocal = positionToLocalNm(center, a.position);
  const bLocal = positionToLocalNm(center, b.position);

  const relPos = {
    x: bLocal.x - aLocal.x,
    y: bLocal.y - aLocal.y,
    z: b.altitude - a.altitude,
  };

  const va = velocityVectorNmPerSec(a);
  const vb = velocityVectorNmPerSec(b);
  const relVel = {
    x: vb.x - va.x,
    y: vb.y - va.y,
    z: vb.z - va.z,
  };

  const vv = relVel.x * relVel.x + relVel.y * relVel.y;
  let t = 0;

  if (vv > 1e-6) {
    t = -((relPos.x * relVel.x + relPos.y * relVel.y) / vv);
    t = Math.max(0, Math.min(120, t));
  }

  const future = {
    x: relPos.x + relVel.x * t,
    y: relPos.y + relVel.y * t,
    z: relPos.z + relVel.z * t,
  };

  return {
    distance: Math.hypot(future.x, future.y),
    altDiff: Math.abs(future.z),
    timeToClosest: t,
  };
}

export function detectConflicts(aircraftList: Aircraft[]): ConflictPair[] {
  const conflicts: ConflictPair[] = [];

  for (let i = 0; i < aircraftList.length; i += 1) {
    for (let j = i + 1; j < aircraftList.length; j += 1) {
      const a = aircraftList[i];
      const b = aircraftList[j];

      const distance = haversineNm(a.position, b.position);
      const altDiff = Math.abs(a.altitude - b.altitude);
      const directSeverity = classifySeverity(distance, altDiff);

      const projected = projectClosestApproach(a, b);
      const projectedSeverity = classifySeverity(projected.distance, projected.altDiff);

      const severity = directSeverity ?? projectedSeverity;
      if (!severity) {
        continue;
      }

      conflicts.push({
        aircraft1: a.callsign,
        aircraft2: b.callsign,
        distance,
        altDiff,
        timeToClosest: projected.timeToClosest,
        severity,
      });
    }
  }

  return conflicts;
}

export function hasSeparationViolation(conflict: ConflictPair): boolean {
  return conflict.severity === "critical" || conflict.severity === "collision";
}
