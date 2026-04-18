import { useMemo, useState } from "react";
import { AIRPORTS } from "../../core/constants";
import { SCENARIOS, buildScenarioAircraft } from "../../core/scenarios";
import type { Aircraft } from "../../core/types";

interface SimDockProps {
  paused: boolean;
  speed: 1 | 2 | 4;
  activeRunways: string[];
  onPauseToggle: () => void;
  onSpeedChange: (speed: 1 | 2 | 4) => void;
  onRestart: () => void;
  onActiveRunwaysChange: (runways: string[]) => void;
  onLoadScenario?: (aircraft: Aircraft[]) => void;
}

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

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5v11l9-5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h4v12H7zM13 6h4v12h-4z" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5a7 7 0 1 0 6.7 9h-2.2A5 5 0 1 1 12 7c1.4 0 2.6.5 3.5 1.4L13 11h7V4l-2.8 2.8A9 9 0 0 0 12 5z" />
    </svg>
  );
}

function SpeedOneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6.5v11l9-5.5z" />
    </svg>
  );
}

function SpeedTwoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6.5v11l7-5.5zM12 6.5v11l7-5.5z" />
    </svg>
  );
}

function SpeedFourIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6.5v11l5-5.5zM9 6.5v11l5-5.5zM15 6.5v11l5-5.5z" />
    </svg>
  );
}

function FlaskIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3v8L5 19a1 1 0 0 0 .9 1.5h12.2A1 1 0 0 0 19 19l-4-8V3zM9 3h6" />
    </svg>
  );
}

function RunwayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 3h4v3h2v2h-2v3h2v2h-2v8h-4v-8H8v-2h2V8H8V6h2z" />
    </svg>
  );
}

export function SimDock({
  paused,
  speed,
  activeRunways,
  onPauseToggle,
  onSpeedChange,
  onRestart,
  onActiveRunwaysChange,
  onLoadScenario,
}: SimDockProps) {
  const [showRunwayEditor, setShowRunwayEditor] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);

  const runwayTokens = useMemo(() => allRunwayTokens(), []);

  const toggleRunway = (token: string) => {
    if (activeRunways.includes(token)) {
      onActiveRunwaysChange(activeRunways.filter((item) => item !== token));
      return;
    }

    onActiveRunwaysChange([...activeRunways, token]);
  };

  return (
    <div className="sim-dock-wrapper">
      {showScenarios && onLoadScenario && (
        <div className="sim-dock-popover" role="group" aria-label="Test scenarios">
          <div className="sim-dock-popover-head">
            <span>Dev Scenarios</span>
            <span style={{ fontSize: "0.65rem", color: "#556" }}>dev only</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "4px 0" }}>
            {Object.entries(SCENARIOS).map(([key, scenario]) => (
              <button
                type="button"
                key={key}
                style={{
                  background: "none",
                  border: "1px solid #1a4a3a",
                  color: "#8ecfb0",
                  cursor: "pointer",
                  padding: "4px 8px",
                  textAlign: "left",
                  fontSize: "0.72rem",
                  borderRadius: 3,
                }}
                title={scenario.description}
                onClick={() => {
                  onLoadScenario(buildScenarioAircraft(scenario));
                  setShowScenarios(false);
                }}
              >
                {scenario.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showRunwayEditor && (
        <div className="sim-dock-popover" role="group" aria-label="Runway selection">
          <div className="sim-dock-popover-head">
            <span>Runways</span>
            <span>{activeRunways.length} active</span>
          </div>
          <div className="sim-dock-runway-grid">
            {runwayTokens.map((token) => {
              const active = activeRunways.includes(token);
              return (
                <button
                  type="button"
                  key={token}
                  className={`sim-dock-runway ${active ? "active" : ""}`}
                  aria-pressed={active}
                  onClick={() => toggleRunway(token)}
                >
                  {token}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="sim-dock" role="toolbar" aria-label="Simulation controls">
        <button
          type="button"
          className="sim-dock-btn"
          onClick={onPauseToggle}
          title={paused ? "Resume simulation" : "Pause simulation"}
          aria-label={paused ? "Resume simulation" : "Pause simulation"}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>

        <button
          type="button"
          className="sim-dock-btn"
          onClick={onRestart}
          title="Restart simulation"
          aria-label="Restart simulation"
        >
          <RestartIcon />
        </button>

        <button
          type="button"
          className={`sim-dock-btn ${speed === 1 ? "active" : ""}`}
          onClick={() => onSpeedChange(1)}
          title="Simulation speed 1x"
          aria-label="Simulation speed 1x"
        >
          <SpeedOneIcon />
        </button>

        <button
          type="button"
          className={`sim-dock-btn ${speed === 2 ? "active" : ""}`}
          onClick={() => onSpeedChange(2)}
          title="Simulation speed 2x"
          aria-label="Simulation speed 2x"
        >
          <SpeedTwoIcon />
        </button>

        <button
          type="button"
          className={`sim-dock-btn ${speed === 4 ? "active" : ""}`
          }
          onClick={() => onSpeedChange(4)}
          title="Simulation speed 4x"
          aria-label="Simulation speed 4x"
        >
          <SpeedFourIcon />
        </button>

        <button
          type="button"
          className={`sim-dock-btn ${showRunwayEditor ? "active" : ""}`}
          onClick={() => setShowRunwayEditor((value) => !value)}
          title="Toggle runway editor"
          aria-label="Toggle runway editor"
        >
          <RunwayIcon />
        </button>

        {import.meta.env.DEV && onLoadScenario && (
          <button
            type="button"
            className={`sim-dock-btn ${showScenarios ? "active" : ""}`}
            onClick={() => setShowScenarios((v) => !v)}
            title="Load test scenario"
            aria-label="Load test scenario"
          >
            <FlaskIcon />
          </button>
        )}
      </div>
    </div>
  );
}
