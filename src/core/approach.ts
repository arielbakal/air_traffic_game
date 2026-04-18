import { resolveRunwayToken } from "./constants";
import { haversineNm, shortestHeadingDelta } from "./geo";
import type { Aircraft, GameEvent } from "./types";

function toApproachState(
  aircraft: Aircraft,
  runway: {
    runwayId: string;
    heading: number;
    threshold: { lat: number; lng: number };
    elevation: number;
  },
): Aircraft {
  return {
    ...aircraft,
    onApproach: true,
    status: "approach",
    assignedRunway: runway.runwayId,
  };
}

export function updateApproaches(
  aircraftList: Aircraft[],
  time: number,
): { aircraftList: Aircraft[]; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const updated: Aircraft[] = [];

  for (const aircraft of aircraftList) {
    let next = aircraft;

    const runwayToken = aircraft.commandRunway ?? aircraft.assignedRunway;
    const runway = runwayToken ? resolveRunwayToken(runwayToken) : null;

    if (runway && !aircraft.goingAround && (aircraft.status === "arriving" || aircraft.status === "enroute")) {
      const distanceNm = haversineNm(aircraft.position, runway.threshold);
      const headingError = Math.abs(shortestHeadingDelta(aircraft.heading, runway.heading));
      const targetAlt = runway.elevation + distanceNm * 318;
      const altitudeDelta = Math.abs(aircraft.altitude - targetAlt);

      if (distanceNm <= 18 && headingError <= 30 && altitudeDelta <= 1800) {
        next = toApproachState(next, runway);
        events.push({
          timestamp: time,
          type: "handoff",
          severity: "info",
          message: `${aircraft.callsign} captured ILS ${runway.runwayId}`,
        });
      } else if (
        aircraft.commandRunway &&
        !aircraft.approachAltWarnGiven &&
        distanceNm <= 18 &&
        headingError <= 30 &&
        altitudeDelta > 1800
      ) {
        const maxAlt = Math.round(targetAlt + 1800);
        events.push({
          timestamp: time,
          type: "info",
          severity: "warning",
          message: `${aircraft.callsign} too high for ILS ${runway.runwayId} — descend below ${maxAlt}ft`,
        });
        next = { ...next, approachAltWarnGiven: true };
      }
    }

    if (runway && next.status === "approach") {
      const distanceNm = haversineNm(next.position, runway.threshold);
      const glideslopeAltitude = runway.elevation + distanceNm * 318;
      const unstable = Math.abs(shortestHeadingDelta(next.heading, runway.heading)) > 40;

      next = {
        ...next,
        targetHeading: runway.heading,
        targetAltitude: Math.max(runway.elevation + 20, glideslopeAltitude),
        targetSpeed: next.approachSpeed,
        onApproach: true,
        assignedRunway: runway.runwayId,
      };

      if (unstable && distanceNm < 8) {
        next = {
          ...next,
          goingAround: true,
          onApproach: false,
          status: "goAround",
          targetAltitude: 3000,
          targetSpeed: Math.min(220, next.maxSpeed),
        };
        events.push({
          timestamp: time,
          type: "goAround",
          severity: "warning",
          message: `${next.callsign} unstable approach, going around`,
        });
      } else if (next.altitude <= runway.elevation + 500) {
        next = {
          ...next,
          status: "landing",
        };
      }
    }

    if (runway && next.status === "landing") {
      next = {
        ...next,
        targetHeading: runway.heading,
        targetSpeed: Math.max(next.approachSpeed - 15, next.minSpeed),
      };

      if (next.altitude <= runway.elevation + 50) {
        next = {
          ...next,
          status: "landed",
          speed: 0,
          targetSpeed: 0,
          altitude: runway.elevation,
          targetAltitude: runway.elevation,
          removeAt: time + 10,
          onApproach: false,
        };

        events.push({
          timestamp: time,
          type: "landing",
          severity: "info",
          message: `${next.callsign} landed ${runway.runwayId}`,
        });
      }
    }

    if (runway && next.status === "goAround") {
      next = {
        ...next,
        targetHeading: runway.heading,
        targetAltitude: 3000,
        targetSpeed: Math.min(220, next.maxSpeed),
      };

      if (next.altitude >= 2950) {
        next = {
          ...next,
          status: "arriving",
          goingAround: false,
          onApproach: false,
          commandRunway: undefined,
          assignedRunway: null,
        };
      }
    }

    updated.push(next);
  }

  return { aircraftList: updated, events };
}
