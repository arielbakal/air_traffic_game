import type { Aircraft } from "../../core/types";

interface FlightStripRackProps {
  aircraft: Aircraft[];
  selectedAircraftId: string | null;
  onSelect: (id: string) => void;
}

export function FlightStripRack({ aircraft, selectedAircraftId, onSelect }: FlightStripRackProps) {
  return (
    <div className="panel strip-rack">
      <h3>Active Strips</h3>
      <div className="strip-list">
        {aircraft.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`strip-item ${selectedAircraftId === item.id ? "active" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="callsign">{item.callsign}</span>
            <span>{item.status}</span>
            <span>FL{Math.round(item.altitude / 100).toString().padStart(3, "0")}</span>
            <span>{Math.round(item.speed)}kt</span>
            <span className={item.hasConflict ? "warn" : "ok"}>{item.hasConflict ? "ALERT" : "SAFE"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
