import { AIRPORTS, DIFFICULTY_CONFIG, FLIGHT_TEMPLATES, GATES, PERFORMANCE_BY_CATEGORY } from "./constants";
import { bearingFromTo, haversineNm } from "./geo";
import type { Aircraft, DifficultyLevel, FlightTemplate, Position } from "./types";

function randomInt(min: number, max: number, random: () => number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function getNodePosition(nodeId: string): Position {
  if (AIRPORTS[nodeId]) {
    return AIRPORTS[nodeId].position;
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

function chooseTemplate(random: () => number, arrivalsWeight = 0.7): FlightTemplate {
  const arrivals = FLIGHT_TEMPLATES.filter((template) => template.kind === "arrival");
  const departures = FLIGHT_TEMPLATES.filter((template) => template.kind === "departure");

  const pool = random() < arrivalsWeight ? arrivals : departures;
  const totalWeight = pool.reduce((sum, template) => sum + template.weight, 0);
  let roll = random() * totalWeight;

  for (const template of pool) {
    roll -= template.weight;
    if (roll <= 0) {
      return template;
    }
  }

  return pool[pool.length - 1];
}

function createSquawk(index: number): string {
  const base = 1000 + (index % 7777);
  return base.toString().padStart(4, "0");
}

function spawnFromTemplate(
  template: FlightTemplate,
  index: number,
  activeRunways: string[],
  time: number,
  random: () => number,
): Aircraft {
  const originPos = getNodePosition(template.origin);
  const destinationPos = getNodePosition(template.destination);
  const heading = bearingFromTo(originPos, destinationPos);

  const perf = PERFORMANCE_BY_CATEGORY[template.category];
  const isArrival = template.kind === "arrival";
  const isDepartureFromAirport = Boolean(AIRPORTS[template.origin]);

  const initialAltitude = isArrival
    ? randomInt(7000, 18000, random)
    : AIRPORTS[template.origin]
      ? AIRPORTS[template.origin].elevation
      : randomInt(3000, 9000, random);

  const initialSpeed = isArrival ? randomInt(220, 320, random) : isDepartureFromAirport ? 0 : randomInt(160, 230, random);

  const assignedRunway = isArrival
    ? AIRPORTS[template.destination]
      ? runwayForAirport(template.destination, activeRunways)
      : null
    : AIRPORTS[template.origin]
      ? runwayForAirport(template.origin, activeRunways)
      : null;

  return {
    id: `${template.callsignPrefix}${template.flightNumber}-${createSquawk(index)}`,
    callsign: `${template.callsignPrefix}${template.flightNumber}`,
    type: template.type,
    category: template.category,
    airline: template.airline,
    position: originPos,
    altitude: initialAltitude,
    heading: isDepartureFromAirport && assignedRunway ? Number(assignedRunway.split("-")[1]) * 10 : heading,
    speed: initialSpeed,
    verticalSpeed: 0,
    targetAltitude: isArrival ? 5000 : isDepartureFromAirport ? 5000 : initialAltitude,
    targetHeading: heading,
    targetSpeed: isArrival ? initialSpeed : Math.min(250, perf.maxSpeed),
    origin: template.origin,
    destination: template.destination,
    status: isArrival ? "arriving" : isDepartureFromAirport ? "taxiing" : "enroute",
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
  };
}

export function initialTraffic(
  count: number,
  activeRunways: string[],
  time: number,
  random: () => number,
): Aircraft[] {
  const items: Aircraft[] = [];
  for (let i = 0; i < count; i += 1) {
    const template = chooseTemplate(random, 0.7);
    items.push(spawnFromTemplate(template, i + 1, activeRunways, time, random));
  }
  return items;
}

export function spawnTraffic(
  difficulty: DifficultyLevel,
  activeRunways: string[],
  time: number,
  index: number,
  random: () => number,
): Aircraft {
  const arrivalBias = difficulty === "student" ? 0.75 : difficulty === "chief" ? 0.65 : 0.7;
  const template = chooseTemplate(random, arrivalBias);
  return spawnFromTemplate(template, index, activeRunways, time, random);
}

export function nextSpawnInterval(difficulty: DifficultyLevel, random: () => number): number {
  const config = DIFFICULTY_CONFIG[difficulty];
  const burst = random() > 0.82;
  if (burst) {
    return randomInt(15, 35, random);
  }
  return randomInt(config.spawnMin, config.spawnMax, random);
}
