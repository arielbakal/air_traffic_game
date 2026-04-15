import { useMemo, useState } from "react";
import type { Aircraft, CommandType } from "../../core/types";

interface CommandPanelProps {
  aircraft: Aircraft | null;
  activeRunways: string[];
  onIssueCommand: (command: CommandType) => void;
}

const ALTITUDE_PRESETS = [3000, 5000, 8000, 10000, 15000];
const SPEED_PRESETS = [160, 200, 250, 300];

export function CommandPanel({ aircraft, activeRunways, onIssueCommand }: CommandPanelProps) {
  const [headingInput, setHeadingInput] = useState("180");
  const [altitudeInput, setAltitudeInput] = useState("5000");
  const [speedInput, setSpeedInput] = useState("220");

  const selectedRunway = useMemo(() => activeRunways[0] ?? "", [activeRunways]);
  const [approachRunway, setApproachRunway] = useState(selectedRunway);

  const disabled = !aircraft;

  const send = (command: CommandType) => {
    if (!aircraft) {
      return;
    }
    onIssueCommand(command);
  };

  return (
    <div className="panel command-panel">
      <h3>ATC Commands</h3>

      <div className="command-block">
        <label htmlFor="heading-input">Heading</label>
        <div className="inline-controls">
          <input
            id="heading-input"
            type="number"
            min={0}
            max={360}
            value={headingInput}
            onChange={(event) => setHeadingInput(event.target.value)}
            disabled={disabled}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => send({ type: "heading", value: Number(headingInput) })}
          >
            Turn
          </button>
        </div>
      </div>

      <div className="command-block">
        <label>Altitude</label>
        <div className="button-row">
          {ALTITUDE_PRESETS.map((value) => (
            <button key={value} type="button" disabled={disabled} onClick={() => send({ type: "altitude", value })}>
              {value >= 10000 ? `FL${value / 100}` : value}
            </button>
          ))}
        </div>
        <div className="inline-controls">
          <input
            type="number"
            min={0}
            max={45000}
            value={altitudeInput}
            onChange={(event) => setAltitudeInput(event.target.value)}
            disabled={disabled}
          />
          <button type="button" disabled={disabled} onClick={() => send({ type: "altitude", value: Number(altitudeInput) })}>
            Set ALT
          </button>
        </div>
      </div>

      <div className="command-block">
        <label>Speed</label>
        <div className="button-row">
          {SPEED_PRESETS.map((value) => (
            <button key={value} type="button" disabled={disabled} onClick={() => send({ type: "speed", value })}>
              {value} kt
            </button>
          ))}
        </div>
        <div className="inline-controls">
          <input
            type="number"
            min={0}
            max={500}
            value={speedInput}
            onChange={(event) => setSpeedInput(event.target.value)}
            disabled={disabled}
          />
          <button type="button" disabled={disabled} onClick={() => send({ type: "speed", value: Number(speedInput) })}>
            Set SPD
          </button>
        </div>
      </div>

      <div className="command-block">
        <label htmlFor="approach-runway">Approach</label>
        <div className="inline-controls">
          <select
            id="approach-runway"
            value={approachRunway}
            onChange={(event) => setApproachRunway(event.target.value)}
            disabled={disabled}
          >
            {activeRunways.map((runway) => (
              <option key={runway} value={runway}>
                {runway}
              </option>
            ))}
          </select>
          <button type="button" disabled={disabled || !approachRunway} onClick={() => send({ type: "approach", runway: approachRunway })}>
            Cleared ILS
          </button>
        </div>
      </div>

      <div className="button-row">
        <button type="button" disabled={disabled} onClick={() => send({ type: "hold" })}>
          Hold
        </button>
        <button type="button" disabled={disabled} onClick={() => send({ type: "goAround" })}>
          Go Around
        </button>
        <button
          type="button"
          disabled={disabled || aircraft?.status !== "taxiing"}
          onClick={() => send({ type: "takeoff", runway: approachRunway })}
        >
          Takeoff
        </button>
      </div>
    </div>
  );
}
