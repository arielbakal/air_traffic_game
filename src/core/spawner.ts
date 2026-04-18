import { AIRPORTS, GATES, PERFORMANCE_BY_CATEGORY, resolveRunwayToken } from "./constants";
import { bearingFromTo, haversineNm } from "./geo";
import type { Aircraft, MissionFlightState, Position } from "./types";

interface MissionSeedFlight {
  callsignPrefix: string;
  flightNumber: string;
  type: string;
  category: Aircraft["category"];
  airline: string;
  origin: string;
}

interface MissionScenario {
  aircraft: Aircraft[];
  missionFlights: MissionFlightState[];
}

const FIX_POINTS: Record<string, Position> = {
  TIGRE: { lat: -34.4, lng: -58.58 },
  SANPEDRO: { lat: -33.78, lng: -59.65 },
  PARANA: { lat: -32.45, lng: -60.3 },
  COLONIA: { lat: -34.48, lng: -57.85 },
  GUALEGUAY: { lat: -33.2, lng: -59.26 },
  LA_PLATA: { lat: -34.93, lng: -57.95 },
  PINAMAR: { lat: -37.11, lng: -56.86 },
  DOLORES: { lat: -36.32, lng: -57.68 },
  AZUL: { lat: -36.75, lng: -59.86 },
  ATLANTIC_W: { lat: -35.1, lng: -57.45 },
  RIO_W: { lat: -34.66, lng: -57.7 },
  RIO_E: { lat: -34.74, lng: -56.84 },
};

const DIRECT_ROUTE_FIXES: Record<string, string[]> = {
  "SABE-SUMU": ["RIO_W", "RIO_E"],
  "SABE-SAAR": ["TIGRE", "SANPEDRO", "PARANA"],
  "SABE-SAZM": ["LA_PLATA", "DOLORES", "PINAMAR"],
  "SUMU-SAAR": ["COLONIA", "GUALEGUAY", "PARANA"],
  "SUMU-SAZM": ["RIO_E", "ATLANTIC_W", "PINAMAR"],
  "SAAR-SAZM": ["SANPEDRO", "AZUL", "DOLORES"],
};

const MISSION_SEED_FLIGHTS: MissionSeedFlight[] = [
  {
    callsignPrefix: "AR",
    flightNumber: "1901",
    type: "B738",
    category: "medium",
    airline: "Aerolineas Argentinas",
    origin: "SABE",
  },
  {
    callsignPrefix: "UY",
    flightNumber: "2102",
    type: "E190",
    category: "medium",
    airline: "Amaszonas Uruguay",
    origin: "SUMU",
  },
  {
    callsignPrefix: "LA",
    flightNumber: "4303",
    type: "A320",
    category: "medium",
    airline: "LATAM",
    origin: "SAAR",
  },
  {
    callsignPrefix: "FO",
    flightNumber: "7604",
    type: "B738",
    category: "medium",
    airline: "Flybondi",
    origin: "SAZM",
  },
];

const AIRPORT_ORDER = MISSION_SEED_FLIGHTS.map((item) => item.origin);

const DEPARTURE_GATES: Record<string, string> = {
  SABE: "NORTH",
  SUMU: "EAST",
  SAAR: "NORTHWEST",
  SAZM: "SOUTH",
};

const ARRIVAL_GATES: Record<string, string> = {
  SABE: "NORTHEAST",
  SUMU: "EAST",
  SAAR: "WEST",
  SAZM: "SOUTHEAST",
};

function getNodePosition(nodeId: string): Position {
  if (AIRPORTS[nodeId]) {
    return AIRPORTS[nodeId].position;
  }

  if (FIX_POINTS[nodeId]) {
    return FIX_POINTS[nodeId];
  }

  const gate = GATES.find((item) => item.id === nodeId);
  if (gate) {
    return gate.position;
  }

  return { lat: -34.69, lng: -58.47 };
}

function runwayForAirport(airportIcao: string, activeRunways: string[]): string | null {
  const firstActive = activeRunways.find((value) => value.startsWith(`${airportIcao}-`));
  if (firstActive) {
    return firstActive;
  }

  const airport = AIRPORTS[airportIcao];
  if (!airport) {
    return null;
  }
  const fallback = airport.runways[0]?.ends[0]?.key;
  return fallback ? `${airportIcao}-${fallback}` : null;
}

function pickDestination(origin: string, random: () => number): string {
  const candidates = AIRPORT_ORDER.filter((icao) => icao !== origin);
  const index = Math.floor(random() * candidates.length);
  return candidates[index] ?? candidates[0];
}

function createSquawk(index: number): string {
  const base = 1000 + (index % 7777);
  return base.toString().padStart(4, "0");
}

function corridorFixes(origin: string, destination: string): string[] {
  const directKey = `${origin}-${destination}`;
  if (DIRECT_ROUTE_FIXES[directKey]) {
    return DIRECT_ROUTE_FIXES[directKey];
  }

  const reverseKey = `${destination}-${origin}`;
  if (DIRECT_ROUTE_FIXES[reverseKey]) {
    return [...DIRECT_ROUTE_FIXES[reverseKey]].reverse();
  }

  return [DEPARTURE_GATES[origin] ?? "NORTH", ARRIVAL_GATES[destination] ?? "SOUTH"];
}

function createRouteWaypoints(origin: string, destination: string): Position[] {
  const routeNodes = [origin, ...corridorFixes(origin, destination), destination];

  const deduped: string[] = [];
  for (const node of routeNodes) {
    if (deduped[deduped.length - 1] !== node) {
      deduped.push(node);
    }
  }

  return deduped.map((node) => getNodePosition(node));
}

function spawnMissionFlight(
  template: MissionSeedFlight,
  destination: string,
  index: number,
  activeRunways: string[],
  time: number,
): Aircraft {
  const originPos = AIRPORTS[template.origin]?.position ?? getNodePosition(template.origin);
  const destinationPos = AIRPORTS[destination]?.position ?? getNodePosition(destination);
  const routeWaypoints = createRouteWaypoints(template.origin, destination);
  const routeWaypointIndex = Math.min(1, routeWaypoints.length - 1);
  const nextWaypoint = routeWaypoints[routeWaypointIndex] ?? destinationPos;
  const routeHeading = bearingFromTo(originPos, nextWaypoint);

  const perf = PERFORMANCE_BY_CATEGORY[template.category];
  const assignedRunway = runwayForAirport(template.origin, activeRunways);
  const departureHeading = (assignedRunway ? resolveRunwayToken(assignedRunway)?.heading : undefined) ?? routeHeading;

  return {
    id: `${template.callsignPrefix}${template.flightNumber}-${createSquawk(index)}`,
    callsign: `${template.callsignPrefix}${template.flightNumber}`,
    type: template.type,
    category: template.category,
    airline: template.airline,
    position: originPos,
    altitude: AIRPORTS[template.origin]?.elevation ?? 0,
    heading: departureHeading,
    speed: 0,
    verticalSpeed: 0,
    targetAltitude: 6000,
    targetHeading: routeHeading,
    targetSpeed: Math.min(250, perf.maxSpeed),
    origin: template.origin,
    destination,
    status: "taxiing",
    assignedRunway,
    maxSpeed: perf.maxSpeed,
    minSpeed: perf.minSpeed,
    approachSpeed: perf.approachSpeed,
    climbRate: perf.climbRate,
    descentRate: perf.descentRate,
    turnRate: perf.turnRate,
    isSelected: false,
    hasConflict: false,
    onApproach: false,
    goingAround: false,
    entryTime: time,
    headingChanges: 0,
    routeDistanceNm: 0,
    directDistanceNm: haversineNm(originPos, destinationPos),
    holdTime: 0,
    routeWaypoints,
    routeWaypointIndex,
  };
}

export function initialMissionScenario(
  activeRunways: string[],
  time: number,
  random: () => number,
): MissionScenario {
  const aircraft: Aircraft[] = [];
  const missionFlights: MissionFlightState[] = [];

  for (let index = 0; index < MISSION_SEED_FLIGHTS.length; index += 1) {
    const template = MISSION_SEED_FLIGHTS[index];
    const destination = pickDestination(template.origin, random);
    const flight = spawnMissionFlight(template, destination, index + 1, activeRunways, time);

    aircraft.push(flight);
    missionFlights.push({
      flightId: flight.id,
      callsign: flight.callsign,
      origin: template.origin,
      destination,
      departureCleared: false,
      approachCleared: false,
      completed: false,
    });
  }

  return { aircraft, missionFlights };
}
