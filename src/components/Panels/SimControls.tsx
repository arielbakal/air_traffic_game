import { useState } from "react";
import { AIRPORTS } from "../../core/constants";
import type { DifficultyLevel } from "../../core/types";

interface SimControlsProps {
  paused: boolean;
  speed: 1 | 2 | 4;
  difficulty: DifficultyLevel;
  activeRunways: string[];
  onPauseToggle: () => void;
  onSpeedChange: (speed: 1 | 2 | 4) => void;
  onRestart: () => void;
  onDifficultyChange: (difficulty: DifficultyLevel) => void;
  onActiveRunwaysChange: (runways: string[]) => void;
}

const DIFFICULTIES: DifficultyLevel[] = ["student", "junior", "controller", "senior", "chief"];

function allRunwayTokens(): string[] {
  const tokens: string[] = [];

  for (const airport of Object.values(AIRPORTS)) {
    for (const runway of airport.runways) {
      for (const end of runway.ends) {
        tokens.push(`${airport.icao}-${end.key}`);
      }
    }
  }

  return tokens;
}

export function SimControls({
  paused,
  speed,
  difficulty,
  activeRunways,
  onPauseToggle,
  onSpeedChange,
  onRestart,
  onDifficultyChange,
  onActiveRunwaysChange,
}: SimControlsProps) {
  const [showRunwayEditor, setShowRunwayEditor] = useState(false);
  const runwayTokens = allRunwayTokens();

  const toggleRunway = (token: string) => {
    if (activeRunways.includes(token)) {
      onActiveRunwaysChange(activeRunways.filter((item) => item !== token));
      return;
    }

    onActiveRunwaysChange([...activeRunways, token]);
  };

  return (
    <div className="panel sim-controls">
      <h3>Simulation</h3>

      <div className="button-row">
        <button type="button" onClick={onPauseToggle}>
          {paused ? "Play" : "Pause"}
        </button>
        <button type="button" onClick={onRestart}>
          Restart
        </button>
      </div>

      <div className="button-row">
        <button type="button" className={speed === 1 ? "active" : ""} onClick={() => onSpeedChange(1)}>
          1x
        </button>
        <button type="button" className={speed === 2 ? "active" : ""} onClick={() => onSpeedChange(2)}>
          2x
        </button>
        <button type="button" className={speed === 4 ? "active" : ""} onClick={() => onSpeedChange(4)}>
          4x
        </button>
      </div>

      <div className="command-block">
        <label htmlFor="difficulty-select">Difficulty</label>
        <select id="difficulty-select" value={difficulty} onChange={(event) => onDifficultyChange(event.target.value as DifficultyLevel)}>
          {DIFFICULTIES.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>

      <div className="runway-summary-row">
        <span>{activeRunways.length} active runway ends</span>
        <button type="button" onClick={() => setShowRunwayEditor((prev) => !prev)}>
          {showRunwayEditor ? "Hide" : "Edit"}
        </button>
      </div>

      {showRunwayEditor && (
        <div className="command-block compact-block">
          <label>Active runways</label>
          <div className="runway-grid">
            {runwayTokens.map((token) => (
              <label key={token} className="runway-toggle">
                <input
                  type="checkbox"
                  checked={activeRunways.includes(token)}
                  onChange={() => toggleRunway(token)}
                />
                {token}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
