import { normalizeHeading, shortestHeadingDelta } from "./geo";
import type { Aircraft, CommandResult, CommandType } from "./types";

const MANUAL_ROUTE_OVERRIDE_SECONDS = 90;

function success(message: string): CommandResult {
  return { ok: true, message };
}

function error(message: string): CommandResult {
  return { ok: false, message };
}

export function applyCommand(
  aircraft: Aircraft,
  command: CommandType,
  activeRunways: string[],
  simTime: number,
): { aircraft: Aircraft; result: CommandResult } {
  switch (command.type) {
    case "heading": {
      const heading = normalizeHeading(command.value);
      const changes =
        Math.abs(shortestHeadingDelta(aircraft.targetHeading, heading)) >= 10
          ? aircraft.headingChanges + 1
          : aircraft.headingChanges;
      return {
        aircraft: {
          ...aircraft,
          targetHeading: heading,
          headingChanges: changes,
          status: aircraft.status === "holding" ? "arriving" : aircraft.status,
          manualRouteIssuedAt: simTime,
          manualRouteUntil: simTime + MANUAL_ROUTE_OVERRIDE_SECONDS,
        },
        result: success(`${aircraft.callsign} turn heading ${Math.round(heading).toString().padStart(3, "0")}`),
      };
    }
    case "altitude": {
      if (command.value < 0 || command.value > 45000) {
        return { aircraft, result: error("Altitude out of range") };
      }
      return {
        aircraft: {
          ...aircraft,
          targetAltitude: Math.round(command.value / 100) * 100,
          manualRouteIssuedAt: undefined,
          manualRouteUntil: undefined,
        },
        result: success(`${aircraft.callsign} climb/descend ${Math.round(command.value)} ft`),
      };
    }
    case "speed": {
      if (command.value < aircraft.minSpeed || command.value > aircraft.maxSpeed) {
        return {
          aircraft,
          result: error(`Speed must be between ${aircraft.minSpeed} and ${aircraft.maxSpeed} kt`),
        };
      }
      return {
        aircraft: {
          ...aircraft,
          targetSpeed: command.value,
          manualRouteIssuedAt: undefined,
          manualRouteUntil: undefined,
        },
        result: success(`${aircraft.callsign} speed ${Math.round(command.value)} kt`),
      };
    }
    case "approach": {
      if (!activeRunways.includes(command.runway)) {
        return { aircraft, result: error(`Runway ${command.runway} is not active`) };
      }
      if (aircraft.status === "taxiing" || aircraft.status === "landed" || aircraft.status === "landing") {
        return { aircraft, result: error("Approach clearance requires an airborne aircraft") };
      }
      if (aircraft.destination && !command.runway.startsWith(`${aircraft.destination}-`)) {
        return {
          aircraft,
          result: error(`Approach runway must belong to destination ${aircraft.destination}`),
        };
      }
      return {
        aircraft: {
          ...aircraft,
          commandRunway: command.runway,
          onApproach: false,
          status: "arriving",
          manualRouteIssuedAt: undefined,
          manualRouteUntil: undefined,
          approachAltWarnGiven: false,
        },
        result: success(`${aircraft.callsign} cleared ILS approach ${command.runway}`),
      };
    }
    case "hold": {
      return {
        aircraft: {
          ...aircraft,
          status: "holding",
          manualRouteIssuedAt: undefined,
          manualRouteUntil: undefined,
          holdFixHeading: aircraft.heading,
          holdLeg: "outbound" as const,
          holdLegTimer: 0,
        },
        result: success(`${aircraft.callsign} hold present position`),
      };
    }
    case "goAround": {
      return {
        aircraft: {
          ...aircraft,
          goingAround: true,
          onApproach: false,
          status: "goAround",
          targetAltitude: 3000,
          targetSpeed: Math.min(220, aircraft.maxSpeed),
          manualRouteIssuedAt: undefined,
          manualRouteUntil: undefined,
        },
        result: success(`${aircraft.callsign} go around, climb 3000`),
      };
    }
    case "takeoff": {
      if (!activeRunways.includes(command.runway)) {
        return { aircraft, result: error(`Runway ${command.runway} is not active`) };
      }
      if (!command.runway.startsWith(`${aircraft.origin}-`)) {
        return {
          aircraft,
          result: error(`Takeoff runway must belong to origin ${aircraft.origin}`),
        };
      }
      if (aircraft.status !== "taxiing") {
        return { aircraft, result: error("Aircraft is not ready for takeoff") };
      }
      return {
        aircraft: {
          ...aircraft,
          assignedRunway: command.runway,
          status: "departing",
          targetSpeed: Math.min(250, aircraft.maxSpeed),
          targetAltitude: 5000,
          manualRouteIssuedAt: undefined,
          manualRouteUntil: undefined,
        },
        result: success(`${aircraft.callsign} cleared takeoff ${command.runway}`),
      };
    }
    default: {
      return { aircraft, result: error("Unknown command") };
    }
  }
}
