import type { MissionState, ScoreState } from "../../core/types";

interface MissionResultOverlayProps {
  mission: MissionState;
  score: ScoreState;
  simTime: number;
  onRestart: () => void;
}

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function MissionResultOverlay({ mission, score, simTime, onRestart }: MissionResultOverlayProps) {
  if (!mission.isComplete) {
    return null;
  }

  return (
    <div className="mission-overlay" role="dialog" aria-modal="true" aria-label="Mission result">
      <div className="mission-overlay-card panel">
        <h2>{mission.success ? "Mission Complete" : "Mission Ended"}</h2>
        <p className="mission-overlay-subtitle">
          {mission.completedObjectives}/{mission.totalObjectives} objectives in {formatClock(simTime)}
        </p>

        <div className="mission-overlay-metrics">
          <span className="ops-pill">Score {Math.round(score.totalScore)}</span>
          <span className="ops-pill">
            Flights {mission.completedFlights}/{mission.totalFlights}
          </span>
          <span className="ops-pill">Violations {score.separationViolations}</span>
          <span className="ops-pill">Collisions {score.collisions}</span>
        </div>

        <button type="button" className="mission-overlay-cta" onClick={onRestart}>
          Replay Mission
        </button>
      </div>
    </div>
  );
}
