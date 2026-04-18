import { bearingFromTo, haversineNm, moveAlongHeading, normalizeHeading, shortestHeadingDelta } from "./geo";
import type { Aircraft } from "./types";

const SPEED_RATE_KTS_PER_SEC = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nearestRouteIndex(aircraft: Aircraft, fromIndex: number): number {
  let bestIndex = fromIndex;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = fromIndex; i < aircraft.routeWaypoints.length; i += 1) {
    const distance = haversineNm(aircraft.position, aircraft.routeWaypoints[i]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export function updateAircraftPhysics(aircraft: Aircraft, dt: number): Aircraft {
  return updateAircraftPhysicsAtTime(aircraft, dt, Number.POSITIVE_INFINITY);
}

export function updateAircraftPhysicsAtTime(aircraft: Aircraft, dt: number, simTime: number): Aircraft {
  let nextWaypointIndex = aircraft.routeWaypointIndex;
  let nextTargetHeading = aircraft.targetHeading;
  let routeHeading: number | null = null;

  const routeCanGuide =
    aircraft.status === "departing" ||
    aircraft.status === "enroute" ||
    aircraft.status === "arriving";

  const manualRouteActive =
    typeof aircraft.manualRouteUntil === "number" && simTime < aircraft.manualRouteUntil;
  const routeGuidanceEnabled = routeCanGuide;

  if (routeGuidanceEnabled && aircraft.routeWaypoints.length > 0) {
    nextWaypointIndex = nearestRouteIndex(aircraft, nextWaypointIndex);

    const activeWaypoint = aircraft.routeWaypoints[nextWaypointIndex];
    if (activeWaypoint) {
      const distanceToWaypoint = haversineNm(aircraft.position, activeWaypoint);
      const captureRadiusNm = clamp(aircraft.speed / 130, 1.2, 3.1);
      if (distanceToWaypoint <= captureRadiusNm) {
        nextWaypointIndex = Math.min(nextWaypointIndex + 1, aircraft.routeWaypoints.length - 1);
      }
    }

    const nextWaypoint = aircraft.routeWaypoints[nextWaypointIndex];
    if (nextWaypoint) {
      routeHeading = bearingFromTo(aircraft.position, nextWaypoint);
    }
  }

  if (routeHeading !== null) {
    if (manualRouteActive && typeof aircraft.manualRouteIssuedAt === "number" && typeof aircraft.manualRouteUntil === "number") {
      const manualHeading = aircraft.targetHeading;
      const totalWindow = Math.max(1, aircraft.manualRouteUntil - aircraft.manualRouteIssuedAt);
      const elapsed = Math.max(0, simTime - aircraft.manualRouteIssuedAt);
      const progress = clamp(elapsed / totalWindow, 0, 1);
      const routeWeight = 0.18 + progress * 0.82;
      const blendedDelta = shortestHeadingDelta(manualHeading, routeHeading) * routeWeight;
      nextTargetHeading = normalizeHeading(manualHeading + blendedDelta);
    } else {
      nextTargetHeading = routeHeading;
    }
  }

  let heading = aircraft.heading;

  if (aircraft.status === "holding") {
    heading = normalizeHeading(heading + aircraft.turnRate * dt);
  } else {
    const delta = shortestHeadingDelta(heading, nextTargetHeading);
    const turn = clamp(delta, -aircraft.turnRate * dt, aircraft.turnRate * dt);
    heading = normalizeHeading(heading + turn);
  }

  const altitudeDelta = aircraft.targetAltitude - aircraft.altitude;
  let altitude = aircraft.altitude;
  let verticalSpeed = 0;

  if (Math.abs(altitudeDelta) > 5) {
    const climb = altitudeDelta > 0;
    const rate = climb ? aircraft.climbRate : aircraft.descentRate;
    const step = (rate / 60) * dt;
    const applied = clamp(altitudeDelta, -step, step);
    altitude += applied;
    verticalSpeed = (applied / dt) * 60;
  }

  const speedDelta = aircraft.targetSpeed - aircraft.speed;
  const speedStep = clamp(speedDelta, -SPEED_RATE_KTS_PER_SEC * dt, SPEED_RATE_KTS_PER_SEC * dt);
  const speed = clamp(aircraft.speed + speedStep, aircraft.minSpeed, aircraft.maxSpeed);

  const distNm = (speed / 3600) * dt;
  const position = moveAlongHeading(aircraft.position, heading, distNm);

  const status =
    aircraft.status === "departing" && speed >= Math.max(160, aircraft.minSpeed + 15)
      ? "enroute"
      : aircraft.status;

  return {
    ...aircraft,
    status,
    heading,
    altitude,
    speed,
    verticalSpeed,
    position,
    targetHeading: nextTargetHeading,
    routeWaypointIndex: nextWaypointIndex,
    manualRouteUntil: manualRouteActive ? aircraft.manualRouteUntil : undefined,
    manualRouteIssuedAt: manualRouteActive ? aircraft.manualRouteIssuedAt : undefined,
    routeDistanceNm: aircraft.routeDistanceNm + distNm,
    holdTime: aircraft.status === "holding" ? aircraft.holdTime + dt : aircraft.holdTime,
  };
}

export function projectPosition(aircraft: Aircraft, seconds: number): { lat: number; lng: number } {
  const distNm = (aircraft.speed / 3600) * seconds;
  return moveAlongHeading(aircraft.position, aircraft.heading, distNm);
}
