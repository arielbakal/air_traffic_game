export interface Position {
  lat: number;
  lng: number;
}

export type AircraftCategory = "heavy" | "medium" | "light";

export type AircraftStatus =
  | "arriving"
  | "approach"
  | "landing"
  | "landed"
  | "taxiing"
  | "departing"
  | "enroute"
  | "holding"
  | "goAround";

export type DifficultyLevel = "student" | "junior" | "controller" | "senior" | "chief";

export interface RunwayEnd {
  key: string;
  heading: number;
  threshold: Position;
  ils: boolean;
}

export interface Runway {
  id: string;
  length: number;
  width: number;
  ends: [RunwayEnd, RunwayEnd];
}

export interface Airport {
  name: string;
  icao: string;
  iata: string;
  position: Position;
  elevation: number;
  runways: Runway[];
  frequencies: Partial<{
    tower: string;
    ground: string;
    approach: string;
    atis: string;
  }>;
}

export interface Sector {
  name: string;
  frequency: string;
  color: string;
}

export interface Gate {
  id: string;
  name: string;
  position: Position;
  heading: number;
}

export interface Aircraft {
  id: string;
  callsign: string;
  type: string;
  category: AircraftCategory;
  airline: string;
  position: Position;
  altitude: number;
  heading: number;
  speed: number;
  verticalSpeed: number;
  targetAltitude: number;
  targetHeading: number;
  targetSpeed: number;
  origin: string;
  destination: string;
  status: AircraftStatus;
  assignedRunway: string | null;
  maxSpeed: number;
  minSpeed: number;
  approachSpeed: number;
  climbRate: number;
  descentRate: number;
  turnRate: number;
  isSelected: boolean;
  hasConflict: boolean;
  onApproach: boolean;
  goingAround: boolean;
  commandRunway?: string;
  entryTime: number;
  headingChanges: number;
  routeDistanceNm: number;
  directDistanceNm: number;
  holdTime: number;
  removeAt?: number;
}

export type CommandType =
  | { type: "heading"; value: number }
  | { type: "altitude"; value: number }
  | { type: "speed"; value: number }
  | { type: "approach"; runway: string }
  | { type: "hold" }
  | { type: "goAround" }
  | { type: "takeoff"; runway: string };

export interface ConflictPair {
  aircraft1: string;
  aircraft2: string;
  distance: number;
  altDiff: number;
  timeToClosest: number;
  severity: "warning" | "critical" | "collision";
}

export interface ScoreState {
  totalScore: number;
  landings: number;
  departures: number;
  collisions: number;
  separationViolations: number;
  goArounds: number;
  flightsHandled: number;
  averageDelay: number;
  efficiency: number;
}

export interface Wind {
  direction: number;
  speed: number;
}

export type GameEventType =
  | "landing"
  | "takeoff"
  | "conflict"
  | "collision"
  | "goAround"
  | "handoff"
  | "spawn"
  | "command"
  | "info";

export interface GameEvent {
  timestamp: number;
  type: GameEventType;
  message: string;
  severity: "info" | "warning" | "critical";
}

export interface DifficultyConfig {
  level: DifficultyLevel;
  spawnMin: number;
  spawnMax: number;
  startCount: number;
}

export interface GameState {
  aircraft: Map<string, Aircraft>;
  conflicts: ConflictPair[];
  score: ScoreState;
  time: number;
  speed: 1 | 2 | 4;
  paused: boolean;
  wind: Wind;
  activeRunways: string[];
  events: GameEvent[];
  difficulty: DifficultyLevel;
  nextSpawnIn: number;
}

export interface FlightTemplate {
  callsignPrefix: string;
  flightNumber: string;
  type: string;
  category: AircraftCategory;
  airline: string;
  origin: string;
  destination: string;
  kind: "arrival" | "departure";
  weight: number;
}

export interface CommandResult {
  ok: boolean;
  message: string;
}
