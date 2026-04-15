import { moveAlongHeading, normalizeHeading, shortestHeadingDelta } from "./geo";
import type { Aircraft } from "./types";

const SPEED_RATE_KTS_PER_SEC = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function updateAircraftPhysics(aircraft: Aircraft, dt: number): Aircraft {
  let heading = aircraft.heading;

  if (aircraft.status === "holding") {
    heading = normalizeHeading(heading + aircraft.turnRate * dt);
  } else {
    const delta = shortestHeadingDelta(heading, aircraft.targetHeading);
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

  return {
    ...aircraft,
    heading,
    altitude,
    speed,
    verticalSpeed,
    position,
    routeDistanceNm: aircraft.routeDistanceNm + distNm,
    holdTime: aircraft.status === "holding" ? aircraft.holdTime + dt : aircraft.holdTime,
  };
}

export function projectPosition(aircraft: Aircraft, seconds: number): { lat: number; lng: number } {
  const distNm = (aircraft.speed / 3600) * seconds;
  return moveAlongHeading(aircraft.position, aircraft.heading, distNm);
}
