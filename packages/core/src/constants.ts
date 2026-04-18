import type {
  Airport,
  DifficultyConfig,
  FlightTemplate,
  Gate,
  Sector,
  DifficultyLevel,
  AircraftCategory,
} from "./types";

interface PerformanceProfile {
  maxSpeed: number;
  minSpeed: number;
  approachSpeed: number;
  climbRate: number;
  descentRate: number;
  turnRate: number;
}

export const AIRPORTS: Record<string, Airport> = {
  SABE: {
    name: "Aeroparque Jorge Newbery",
    icao: "SABE",
    iata: "AEP",
    position: { lat: -34.5594, lng: -58.4155 },
    elevation: 18,
    runways: [
      {
        id: "13/31",
        length: 7710,
        width: 148,
        ends: [
          {
            key: "13",
            heading: 131,
            threshold: { lat: -34.553, lng: -58.423 },
            ils: true,
          },
          {
            key: "31",
            heading: 311,
            threshold: { lat: -34.566, lng: -58.408 },
            ils: false,
          },
        ],
      },
    ],
    frequencies: {
      tower: "118.85",
      ground: "121.90",
      approach: "128.85",
      atis: "127.6",
    },
  },
  SUMU: {
    name: "Montevideo Carrasco",
    icao: "SUMU",
    iata: "MVD",
    position: { lat: -34.8384, lng: -56.0308 },
    elevation: 105,
    runways: [
      {
        id: "01/19",
        length: 10499,
        width: 148,
        ends: [
          {
            key: "01",
            heading: 10,
            threshold: { lat: -34.8445, lng: -56.0378 },
            ils: true,
          },
          {
            key: "19",
            heading: 190,
            threshold: { lat: -34.8289, lng: -56.0233 },
            ils: true,
          },
        ],
      },
    ],
    frequencies: {
      tower: "118.10",
      ground: "121.70",
      approach: "119.20",
      atis: "127.85",
    },
  },
  SAAR: {
    name: "Rosario Islas Malvinas",
    icao: "SAAR",
    iata: "ROS",
    position: { lat: -32.9036, lng: -60.785 },
    elevation: 86,
    runways: [
      {
        id: "02/20",
        length: 9843,
        width: 148,
        ends: [
          {
            key: "02",
            heading: 20,
            threshold: { lat: -32.9115, lng: -60.7905 },
            ils: true,
          },
          {
            key: "20",
            heading: 200,
            threshold: { lat: -32.8958, lng: -60.7792 },
            ils: true,
          },
        ],
      },
    ],
    frequencies: {
      tower: "118.50",
      ground: "121.90",
      approach: "119.80",
    },
  },
  SAZM: {
    name: "Mar del Plata Astor Piazzolla",
    icao: "SAZM",
    iata: "MDQ",
    position: { lat: -37.9342, lng: -57.5733 },
    elevation: 72,
    runways: [
      {
        id: "13/31",
        length: 7218,
        width: 148,
        ends: [
          {
            key: "13",
            heading: 130,
            threshold: { lat: -37.9395, lng: -57.5825 },
            ils: true,
          },
          {
            key: "31",
            heading: 310,
            threshold: { lat: -37.9285, lng: -57.5642 },
            ils: true,
          },
        ],
      },
    ],
    frequencies: {
      tower: "118.70",
      ground: "121.80",
      approach: "120.30",
    },
  },
};

export const ATC_SECTORS: Record<string, Sector> = {
  EZEIZA_NORTE: {
    name: "Ezeiza Norte",
    frequency: "124.5",
    color: "#4488ff",
  },
  EZEIZA_SUR: {
    name: "Ezeiza Sur",
    frequency: "125.2",
    color: "#44ff88",
  },
  BAIRES_CONTROL: {
    name: "Baires Control",
    frequency: "125.9",
    color: "#ff8844",
  },
};

export const TMA = {
  center: { lat: -35.2, lng: -58.4 },
  radius: 210,
  ceiling: 30000,
  floor: 0,
};

export const GATES: Gate[] = [
  { id: "NORTH", name: "NORTE", position: { lat: -33.8, lng: -58.5 }, heading: 180 },
  { id: "NORTHEAST", name: "NORESTE", position: { lat: -33.95, lng: -57.8 }, heading: 220 },
  { id: "EAST", name: "ESTE", position: { lat: -34.6, lng: -57.6 }, heading: 270 },
  { id: "SOUTHEAST", name: "SURESTE", position: { lat: -35.4, lng: -57.9 }, heading: 310 },
  { id: "SOUTH", name: "SUR", position: { lat: -35.5, lng: -58.5 }, heading: 0 },
  { id: "SOUTHWEST", name: "SUROESTE", position: { lat: -35.3, lng: -59.2 }, heading: 30 },
  { id: "WEST", name: "OESTE", position: { lat: -34.7, lng: -59.5 }, heading: 90 },
  { id: "NORTHWEST", name: "NOROESTE", position: { lat: -34, lng: -59.3 }, heading: 130 },
];

export const FLIGHT_TEMPLATES: FlightTemplate[] = [
  {
    callsignPrefix: "AR",
    flightNumber: "1234",
    type: "B738",
    category: "medium",
    airline: "Aerolineas Argentinas",
    origin: "SABE",
    destination: "NORTH",
    kind: "departure",
    weight: 8,
  },
  {
    callsignPrefix: "AR",
    flightNumber: "1567",
    type: "B738",
    category: "medium",
    airline: "Aerolineas Argentinas",
    origin: "NORTH",
    destination: "SABE",
    kind: "arrival",
    weight: 8,
  },
  {
    callsignPrefix: "UY",
    flightNumber: "1002",
    type: "E190",
    category: "medium",
    airline: "Amaszonas Uruguay",
    origin: "SUMU",
    destination: "EAST",
    kind: "departure",
    weight: 7,
  },
  {
    callsignPrefix: "AR",
    flightNumber: "2208",
    type: "B738",
    category: "medium",
    airline: "Aerolineas Argentinas",
    origin: "WEST",
    destination: "SUMU",
    kind: "arrival",
    weight: 7,
  },
  {
    callsignPrefix: "LA",
    flightNumber: "4021",
    type: "E190",
    category: "medium",
    airline: "LATAM",
    origin: "SAAR",
    destination: "NORTHWEST",
    kind: "departure",
    weight: 6,
  },
  {
    callsignPrefix: "AR",
    flightNumber: "4022",
    type: "E190",
    category: "medium",
    airline: "Aerolineas Argentinas",
    origin: "NORTH",
    destination: "SAAR",
    kind: "arrival",
    weight: 8,
  },
  {
    callsignPrefix: "AR",
    flightNumber: "5610",
    type: "B738",
    category: "medium",
    airline: "Aerolineas Argentinas",
    origin: "SAZM",
    destination: "NORTHEAST",
    kind: "departure",
    weight: 7,
  },
  {
    callsignPrefix: "AR",
    flightNumber: "5611",
    type: "B738",
    category: "medium",
    airline: "Aerolineas Argentinas",
    origin: "SOUTH",
    destination: "SAZM",
    kind: "arrival",
    weight: 6,
  },
  {
    callsignPrefix: "AR",
    flightNumber: "7030",
    type: "B738",
    category: "medium",
    airline: "Aerolineas Argentinas",
    origin: "SABE",
    destination: "SUMU",
    kind: "departure",
    weight: 6,
  },
  {
    callsignPrefix: "AR",
    flightNumber: "7031",
    type: "B738",
    category: "medium",
    airline: "Aerolineas Argentinas",
    origin: "SUMU",
    destination: "SABE",
    kind: "arrival",
    weight: 7,
  },
  {
    callsignPrefix: "AR",
    flightNumber: "8240",
    type: "B738",
    category: "medium",
    airline: "Aerolineas Argentinas",
    origin: "SABE",
    destination: "SAAR",
    kind: "departure",
    weight: 6,
  },
  {
    callsignPrefix: "AR",
    flightNumber: "8241",
    type: "B738",
    category: "medium",
    airline: "Aerolineas Argentinas",
    origin: "SAAR",
    destination: "SABE",
    kind: "arrival",
    weight: 6,
  },
  {
    callsignPrefix: "FO",
    flightNumber: "7600",
    type: "B738",
    category: "medium",
    airline: "Flybondi",
    origin: "SABE",
    destination: "SAZM",
    kind: "departure",
    weight: 5,
  },
  {
    callsignPrefix: "FO",
    flightNumber: "7601",
    type: "B738",
    category: "medium",
    airline: "Flybondi",
    origin: "SAZM",
    destination: "SABE",
    kind: "arrival",
    weight: 5,
  },
];

export const PERFORMANCE_BY_CATEGORY: Record<AircraftCategory, PerformanceProfile> = {
  heavy: {
    maxSpeed: 500,
    minSpeed: 160,
    approachSpeed: 150,
    climbRate: 2000,
    descentRate: 1800,
    turnRate: 1.5,
  },
  medium: {
    maxSpeed: 450,
    minSpeed: 140,
    approachSpeed: 140,
    climbRate: 2500,
    descentRate: 2000,
    turnRate: 2,
  },
  light: {
    maxSpeed: 140,
    minSpeed: 60,
    approachSpeed: 70,
    climbRate: 700,
    descentRate: 500,
    turnRate: 3,
  },
};

export const DIFFICULTY_CONFIG: Record<DifficultyLevel, DifficultyConfig> = {
  student: { level: "student", spawnMin: 75, spawnMax: 120, startCount: 3 },
  junior: { level: "junior", spawnMin: 60, spawnMax: 100, startCount: 4 },
  controller: { level: "controller", spawnMin: 45, spawnMax: 85, startCount: 5 },
  senior: { level: "senior", spawnMin: 35, spawnMax: 70, startCount: 5 },
  chief: { level: "chief", spawnMin: 30, spawnMax: 60, startCount: 5 },
};

export const DEFAULT_ACTIVE_RUNWAYS = ["SABE-13", "SUMU-01", "SAAR-02", "SAZM-13"];

export const MAP_CENTER = { lat: -35.2, lng: -58.4 };
export const MAP_ZOOM = 7;

export function resolveRunwayToken(token: string):
  | {
      airportIcao: string;
      runwayId: string;
      heading: number;
      threshold: { lat: number; lng: number };
      elevation: number;
    }
  | null {
  const [airportIcao, runwayEnd] = token.split("-");
  if (!airportIcao || !runwayEnd) {
    return null;
  }

  const airport = AIRPORTS[airportIcao];
  if (!airport) {
    return null;
  }

  for (const runway of airport.runways) {
    const end = runway.ends.find((item) => item.key === runwayEnd);
    if (end) {
      return {
        airportIcao,
        runwayId: token,
        heading: end.heading,
        threshold: end.threshold,
        elevation: airport.elevation,
      };
    }
  }

  return null;
}
