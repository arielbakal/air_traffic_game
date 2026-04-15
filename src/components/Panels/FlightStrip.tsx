import type { Aircraft } from "../../core/types";

interface FlightStripProps {
  aircraft: Aircraft | null;
  simTime: number;
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

export function FlightStrip({ aircraft, simTime }: FlightStripProps) {
  if (!aircraft) {
    return (
      <div className="panel flight-strip">
        <h3>Selected Flight</h3>
        <p className="text-slate">Click an aircraft marker or strip to begin issuing commands.</p>
      </div>
    );
  }

  const timeInSector = Math.max(0, simTime - aircraft.entryTime);

  return (
    <div className="panel flight-strip">
      <h3>{aircraft.callsign}</h3>
      <div className="grid two-col">
        <span>Type</span>
        <span>{aircraft.type}</span>
        <span>Airline</span>
        <span>{aircraft.airline}</span>
        <span>Route</span>
        <span>
          {aircraft.origin} - {aircraft.destination}
        </span>
        <span>Status</span>
        <span>{aircraft.status}</span>
        <span>Runway</span>
        <span>{aircraft.assignedRunway ?? aircraft.commandRunway ?? "-"}</span>
        <span>Current</span>
        <span>
          ALT {Math.round(aircraft.altitude)} / HDG {Math.round(aircraft.heading).toString().padStart(3, "0")} /
          SPD {Math.round(aircraft.speed)}
        </span>
        <span>Target</span>
        <span>
          ALT {Math.round(aircraft.targetAltitude)} / HDG {Math.round(aircraft.targetHeading).toString().padStart(3, "0")} /
          SPD {Math.round(aircraft.targetSpeed)}
        </span>
        <span>Time in sector</span>
        <span>{formatElapsed(timeInSector)}</span>
      </div>
    </div>
  );
}
