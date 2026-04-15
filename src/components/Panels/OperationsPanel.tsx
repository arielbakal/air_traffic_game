import type { Aircraft, ScoreState } from "../../core/types";

interface OperationsPanelProps {
  score: ScoreState;
  aircraft: Aircraft[];
  selectedAircraftId: string | null;
  onSelect: (id: string) => void;
}

export function OperationsPanel({ score, aircraft, selectedAircraftId, onSelect }: OperationsPanelProps) {
  return (
    <div className="panel operations-panel">
      <h3>Operations</h3>

      <div className="ops-topline">
        <span className="ops-pill">{Math.round(score.totalScore)} pts</span>
        <span className="ops-pill">{score.flightsHandled} handled</span>
        <span className="ops-pill">{Math.round(score.efficiency)}% eff</span>
        <span className="ops-pill warn">{score.separationViolations} vio</span>
      </div>

      <details className="ops-metrics-more">
        <summary>More metrics</summary>
        <div className="ops-metrics-grid">
          <span>Land</span>
          <span>{score.landings}</span>
          <span>Dep</span>
          <span>{score.departures}</span>
          <span>Collisions</span>
          <span>{score.collisions}</span>
          <span>Go-around</span>
          <span>{score.goArounds}</span>
          <span>Delay</span>
          <span>{Math.round(score.averageDelay)}s</span>
        </div>
      </details>

      <div className="ops-strip-list">
        {aircraft.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`ops-strip-item ${selectedAircraftId === item.id ? "active" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="callsign">{item.callsign}</span>
            <span>{item.status}</span>
            <span>FL{Math.round(item.altitude / 100).toString().padStart(3, "0")}</span>
            <span className={item.hasConflict ? "warn" : "ok"}>{item.hasConflict ? "ALERT" : "OK"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
