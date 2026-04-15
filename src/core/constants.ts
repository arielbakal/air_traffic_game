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
  SAEZ: {
    name: "Ezeiza - Ministro Pistarini",
    icao: "SAEZ",
    iata: "EZE",
    position: { lat: -34.8222, lng: -58.5358 },
    elevation: 67,
    runways: [
      {
        id: "11/29",
        length: 10827,
        width: 197,
        ends: [
          {
            key: "11",
            heading: 110,
            threshold: { lat: -34.8175, lng: -58.5465 },
            ils: true,
          },
          {
            key: "29",
            heading: 290,
            threshold: { lat: -34.827, lng: -58.525 },
            ils: true,
          },
        ],
      },
      {
        id: "17/35",
        length: 10187,
        width: 148,
        ends: [
          {
            key: "17",
            heading: 170,
            threshold: { lat: -34.814, lng: -58.537 },
            ils: true,
          },
          {
            key: "35",
            heading: 350,
            threshold: { lat: -34.831, lng: -58.5345 },
            ils: true,
          },
        ],
      },
    ],
    frequencies: {
      tower: "118.05",
      ground: "121.75",
      approach: "119.9",
      atis: "127.8",
    },
  },
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
  SADF: {
    name: "San Fernando",
    icao: "SADF",
    iata: "FDO",
    position: { lat: -34.4532, lng: -58.5896 },
    elevation: 10,
    runways: [
      {
        id: "05/23",
        length: 5577,
        width: 98,
        ends: [
          {
            key: "05",
            heading: 50,
            threshold: { lat: -34.457, lng: -58.595 },
            ils: false,
          },
          {
            key: "23",
            heading: 230,
            threshold: { lat: -34.4495, lng: -58.584 },
            ils: false,
          },
        ],
      },
    ],
    frequencies: {
      tower: "120.05",
      ground: "121.65",
    },
  },
  SADP: {
    name: "El Palomar",
    icao: "SADP",
    iata: "EPA",
    position: { lat: -34.6099, lng: -58.6126 },
    elevation: 59,
    runways: [
      {
        id: "17/35",
        length: 6890,
        width: 148,
        ends: [
          {
            key: "17",
            heading: 170,
            threshold: { lat: -34.603, lng: -58.613 },
            ils: false,
          },
          {
            key: "35",
            heading: 350,
            threshold: { lat: -34.617, lng: -58.612 },
            ils: false,
          },
        ],
      },
    ],
    frequencies: {
      tower: "120.30",
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
  center: { lat: -34.69, lng: -58.47 },
  radius: 50,
  ceiling: 24500,
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
    airline: "Aerol\u00edneas Argentinas",
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
    airline: "Aerol\u00edneas Argentinas",
    origin: "NORTH",
    destination: "SABE",
    kind: "arrival",
    weight: 8,
  },
  {
    callsignPrefix: "FO",
    flightNumber: "5201",
    type: "B738",
    category: "medium",
    airline: "Flybondi",
    origin: "SABE",
    destination: "SOUTH",
    kind: "departure",
    weight: 7,
  },
  {
    callsignPrefix: "JA",
    flightNumber: "3010",
    type: "A320",
    category: "medium",
    airline: "JetSMART",
    origin: "WEST",
    destination: "SABE",
    kind: "arrival",
    weight: 7,
  },
  {
    callsignPrefix: "AR",
    flightNumber: "2345",
    type: "E190",
    category: "medium",
    airline: "Aerol\u00edneas Argentinas",
    origin: "SABE",
    destination: "NORTHWEST",
    kind: "departure",
    weight: 6,
  },
  {
    callsignPrefix: "AR",
    flightNumber: "1000",
    type: "B772",
    category: "heavy",
    airline: "Aerol\u00edneas Argentinas",
    origin: "NORTHEAST",
    destination: "SAEZ",
    kind: "arrival",
    weight: 8,
  },
  {
    callsignPrefix: "LA",
    flightNumber: "8050",
    type: "B789",
    category: "heavy",
    airline: "LATAM",
    origin: "NORTH",
    destination: "SAEZ",
    kind: "arrival",
    weight: 7,
  },
  {
    callsignPrefix: "AA",
    flightNumber: "988",
    type: "B772",
    category: "heavy",
    airline: "American Airlines",
    origin: "NORTHWEST",
    destination: "SAEZ",
    kind: "arrival",
    weight: 6,
  },
  {
    callsignPrefix: "IB",
    flightNumber: "6841",
    type: "A340",
    category: "heavy",
    airline: "Iberia",
    origin: "EAST",
    destination: "SAEZ",
    kind: "arrival",
    weight: 6,
  },
  {
    callsignPrefix: "AF",
    flightNumber: "228",
    type: "A332",
    category: "heavy",
    airline: "Air France",
    origin: "NORTHEAST",
    destination: "SAEZ",
    kind: "arrival",
    weight: 5,
  },
  {
    callsignPrefix: "AR",
    flightNumber: "1101",
    type: "A330",
    category: "heavy",
    airline: "Aerol\u00edneas Argentinas",
    origin: "SAEZ",
    destination: "NORTHEAST",
    kind: "departure",
    weight: 6,
  },
  {
    callsignPrefix: "UA",
    flightNumber: "846",
    type: "B763",
    category: "heavy",
    airline: "United",
    origin: "SAEZ",
    destination: "NORTHWEST",
    kind: "departure",
    weight: 5,
  },
  {
    callsignPrefix: "LV",
    flightNumber: "XXX",
    type: "C172",
    category: "light",
    airline: "General Aviation",
    origin: "SADF",
    destination: "SOUTH",
    kind: "departure",
    weight: 5,
  },
  {
    callsignPrefix: "LV",
    flightNumber: "YYY",
    type: "PA28",
    category: "light",
    airline: "General Aviation",
    origin: "SOUTHWEST",
    destination: "SADF",
    kind: "arrival",
    weight: 5,
  },
  {
    callsignPrefix: "FO",
    flightNumber: "7500",
    type: "B738",
    category: "medium",
    airline: "Flybondi",
    origin: "SADP",
    destination: "SOUTH",
    kind: "departure",
    weight: 4,
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

export const DEFAULT_ACTIVE_RUNWAYS = ["SAEZ-11", "SAEZ-17", "SABE-13", "SADF-05", "SADP-17"];

export const MAP_CENTER = { lat: -34.69, lng: -58.47 };
export const MAP_ZOOM = 9;

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
