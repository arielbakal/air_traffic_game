import type { MissionState, Wind } from "../../core/types";

interface StatusBarProps {
  simTime: number;
  wind: Wind;
  activeRunways: string[];
  mission: MissionState;
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

function formatRunwaySummary(activeRunways: string[]): string {
  if (activeRunways.length === 0) {
    return "None";
  }

  if (activeRunways.length <= 3) {
    return activeRunways.join(", ");
  }

  return `${activeRunways.slice(0, 3).join(", ")} +${activeRunways.length - 3}`;
}

export function StatusBar({ simTime, wind, activeRunways, mission }: StatusBarProps) {
  return (
    <header className="status-bar panel">
      <div className="status-item">
        <span className="label">Sim Time</span>
        <span>{formatClock(simTime)}</span>
      </div>
      <div className="status-item">
        <span className="label">Wind</span>
        <span>
          {Math.round(wind.direction).toString().padStart(3, "0")} / {Math.round(wind.speed)}kt
        </span>
      </div>
      <div className="status-item wide">
        <span className="label">Active RWY</span>
        <span>{formatRunwaySummary(activeRunways)}</span>
      </div>
      <div className="status-item">
        <span className="label">Mission</span>
        <span>
          {mission.completedObjectives}/{mission.totalObjectives}
        </span>
      </div>
    </header>
  );
}
