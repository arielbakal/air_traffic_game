import type { Aircraft, MissionState, ScoreState } from "@atc/core";

interface OperationsPanelProps {
  score: ScoreState;
  mission: MissionState;
  aircraft: Aircraft[];
  selectedAircraftId: string | null;
  onSelect: (id: string) => void;
}

export function OperationsPanel({ score, mission, aircraft, selectedAircraftId, onSelect }: OperationsPanelProps) {
  return (
    <div className="panel operations-panel">
      <h3>Operations</h3>

      <div className="ops-topline">
        <span className="ops-pill">{Math.round(score.totalScore)} pts</span>
        <span className="ops-pill">
          Obj {mission.completedObjectives}/{mission.totalObjectives}
        </span>
        <span className="ops-pill">
          Flights {mission.completedFlights}/{mission.totalFlights}
        </span>
        <span className="ops-pill">{score.efficiency !== null ? `${Math.round(score.efficiency)}% eff` : "— eff"}</span>
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
            <span>{item.origin}-{item.destination}</span>
            <span>FL{Math.round(item.altitude / 100).toString().padStart(3, "0")}</span>
            <span className={item.hasConflict ? "warn" : "ok"}>{item.hasConflict ? "ALERT" : "OK"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
