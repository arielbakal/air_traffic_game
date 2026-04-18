import { PERFORMANCE_BY_CATEGORY } from "./constants";
import type { Aircraft, AircraftCategory } from "./types";

interface ScenarioAircraftDef {
  callsign: string;
  type: string;
  category: AircraftCategory;
  position: { lat: number; lng: number };
  heading: number;
  altitude: number;
  speed: number;
  status?: Aircraft["status"];
  assignedRunway?: string;
}

export interface Scenario {
  name: string;
  description: string;
  aircraft: ScenarioAircraftDef[];
}

function makeAircraft(def: ScenarioAircraftDef, index: number): Aircraft {
  const perf = PERFORMANCE_BY_CATEGORY[def.category];
  return {
    id: `scenario-${index}`,
    callsign: def.callsign,
    type: def.type,
    category: def.category,
    airline: "TEST",
    position: def.position,
    altitude: def.altitude,
    heading: def.heading,
    speed: def.speed,
    verticalSpeed: 0,
    targetAltitude: def.altitude,
    targetHeading: def.heading,
    targetSpeed: def.speed,
    origin: "TEST",
    destination: "TEST",
    status: def.status ?? "arriving",
    assignedRunway: def.assignedRunway ?? null,
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
    entryTime: 0,
    headingChanges: 0,
    routeDistanceNm: 0,
    directDistanceNm: 0,
    holdTime: 0,
    routeWaypoints: [],
    routeWaypointIndex: 0,
  };
}

export function buildScenarioAircraft(scenario: Scenario): Aircraft[] {
  return scenario.aircraft.map((def, i) => makeAircraft(def, i));
}

export const SCENARIOS: Record<string, Scenario> = {
  HEAD_ON_CONFLICT: {
    name: "Head-on conflict",
    description: "Two B738s converging on a direct collision course at FL080, 36nm apart.",
    aircraft: [
      {
        callsign: "TEST01",
        type: "B738",
        category: "medium",
        position: { lat: -34.5, lng: -59.0 },
        heading: 90,
        altitude: 8000,
        speed: 250,
      },
      {
        callsign: "TEST02",
        type: "B738",
        category: "medium",
        position: { lat: -34.5, lng: -57.5 },
        heading: 270,
        altitude: 8000,
        speed: 250,
      },
    ],
  },

  VERTICAL_CONFLICT: {
    name: "Vertical conflict",
    description: "Two aircraft at same position, 900ft apart — inside the 1000ft vertical minimum.",
    aircraft: [
      {
        callsign: "TEST03",
        type: "B738",
        category: "medium",
        position: { lat: -34.8, lng: -58.5 },
        heading: 90,
        altitude: 8000,
        speed: 200,
      },
      {
        callsign: "TEST04",
        type: "B738",
        category: "medium",
        position: { lat: -34.8, lng: -58.5 },
        heading: 270,
        altitude: 7100,
        speed: 200,
      },
    ],
  },

  APPROACH_SABE_13: {
    name: "Single arrival SABE-13",
    description: "One A320 at 5000ft, 15nm west of SABE threshold, heading east — ready for ILS SABE-13.",
    aircraft: [
      {
        callsign: "TEST05",
        type: "A320",
        category: "medium",
        position: { lat: -34.553, lng: -58.87 },
        heading: 110,
        altitude: 5000,
        speed: 200,
      },
    ],
  },

  HOLDING_TEST: {
    name: "Holding pattern test",
    description: "Single aircraft in holding — verifies the racetrack pattern.",
    aircraft: [
      {
        callsign: "TEST06",
        type: "B738",
        category: "medium",
        position: { lat: -34.5, lng: -58.5 },
        heading: 0,
        altitude: 6000,
        speed: 220,
        status: "holding",
      },
    ],
  },

  RUSH_HOUR: {
    name: "5 simultaneous arrivals",
    description: "Stress test: 5 aircraft inbound from different quadrants, all at FL070–090.",
    aircraft: [
      {
        callsign: "RUSH01",
        type: "B738",
        category: "medium",
        position: { lat: -33.8, lng: -58.4 },
        heading: 180,
        altitude: 9000,
        speed: 260,
      },
      {
        callsign: "RUSH02",
        type: "B738",
        category: "medium",
        position: { lat: -35.2, lng: -59.4 },
        heading: 60,
        altitude: 8000,
        speed: 250,
      },
      {
        callsign: "RUSH03",
        type: "A320",
        category: "medium",
        position: { lat: -35.2, lng: -57.4 },
        heading: 270,
        altitude: 7000,
        speed: 240,
      },
      {
        callsign: "RUSH04",
        type: "E190",
        category: "medium",
        position: { lat: -34.0, lng: -59.2 },
        heading: 120,
        altitude: 9500,
        speed: 230,
      },
      {
        callsign: "RUSH05",
        type: "B738",
        category: "medium",
        position: { lat: -35.8, lng: -58.2 },
        heading: 350,
        altitude: 8500,
        speed: 255,
      },
    ],
  },

  DEPARTURE_TEST: {
    name: "Departure test SABE-13",
    description: "Single aircraft on ground at SABE, ready for takeoff clearance on runway 13.",
    aircraft: [
      {
        callsign: "TEST07",
        type: "B738",
        category: "medium",
        position: { lat: -34.553, lng: -58.423 },
        heading: 131,
        altitude: 18,
        speed: 0,
        status: "departing",
        assignedRunway: "13",
      },
    ],
  },
};
