import type { ScoreState } from "../../core/types";

interface ScorePanelProps {
  score: ScoreState;
}

export function ScorePanel({ score }: ScorePanelProps) {
  return (
    <div className="panel score-panel">
      <h3>Score</h3>
      <div className="score-total">{Math.round(score.totalScore)} pts</div>
      <div className="grid two-col compact">
        <span>Landings</span>
        <span>{score.landings}</span>
        <span>Departures</span>
        <span>{score.departures}</span>
        <span>Collisions</span>
        <span>{score.collisions}</span>
        <span>Violations</span>
        <span>{score.separationViolations}</span>
        <span>Go-arounds</span>
        <span>{score.goArounds}</span>
        <span>Flights handled</span>
        <span>{score.flightsHandled}</span>
        <span>Avg delay</span>
        <span>{Math.round(score.averageDelay)}s</span>
        <span>Efficiency</span>
        <span>{score.efficiency !== null ? `${Math.round(score.efficiency)}%` : "—"}</span>
      </div>
    </div>
  );
}
