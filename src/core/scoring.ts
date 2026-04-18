import type { Aircraft, GameEvent, ScoreState } from "./types";

const LANDING_BONUS = {
  heavy: 300,
  medium: 200,
  light: 100,
} as const;

function safeDiv(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

export function createInitialScore(): ScoreState {
  return {
    totalScore: 0,
    landings: 0,
    departures: 0,
    collisions: 0,
    separationViolations: 0,
    goArounds: 0,
    flightsHandled: 0,
    averageDelay: 0,
    efficiency: 100,
  };
}

export function updateScoreFromEvents(
  score: ScoreState,
  events: GameEvent[],
  aircraftByCallsign: Map<string, Aircraft>,
): ScoreState {
  const next = { ...score };

  for (const event of events) {
    if (event.type === "landing") {
      const callsign = event.message.split(" ")[0];
      const aircraft = aircraftByCallsign.get(callsign);
      const landingPoints = aircraft ? LANDING_BONUS[aircraft.category] : 150;
      next.landings += 1;
      next.flightsHandled += 1;
      next.totalScore += landingPoints;

      if (aircraft && aircraft.headingChanges <= 2) {
        next.totalScore += 50;
      }
    }

    if (event.type === "takeoff") {
      next.departures += 1;
      next.flightsHandled += 1;
      next.totalScore += 100;
    }

    if (event.type === "goAround") {
      next.goArounds += 1;
      next.totalScore -= 150;
    }

    if (event.type === "collision") {
      next.collisions += 1;
      next.totalScore -= 2000;
    }
  }

  return next;
}

export function applyHoldingPenalty(score: ScoreState, aircraftList: Aircraft[], dt: number): ScoreState {
  const activeHolding = aircraftList.filter((a) => a.status === "holding").length;
  if (activeHolding === 0) {
    return score;
  }

  const penaltyPerSecond = (10 / 30) * activeHolding;
  return {
    ...score,
    totalScore: score.totalScore - penaltyPerSecond * dt,
  };
}

export function deriveScoreMetrics(score: ScoreState, aircraftList: Aircraft[]): ScoreState {
  const totalDelay = aircraftList.reduce((sum, a) => sum + a.holdTime, 0);
  const routeActual = aircraftList.reduce((sum, a) => sum + Math.max(a.routeDistanceNm, 0.1), 0);
  const routeDirect = aircraftList.reduce((sum, a) => sum + Math.max(a.directDistanceNm, 0.1), 0);

  const efficiency = Math.max(0, Math.min(100, safeDiv(routeDirect, routeActual) * 100));
  const averageDelay = safeDiv(totalDelay, Math.max(aircraftList.length, 1));

  return {
    ...score,
    averageDelay,
    efficiency,
  };
}
