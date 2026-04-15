import { divIcon } from "leaflet";
import { Marker, Polyline, Tooltip } from "react-leaflet";
import { projectPosition } from "../../core/physics";
import type { Aircraft } from "../../core/types";

interface AircraftMarkerProps {
  aircraft: Aircraft;
  severity: "none" | "warning" | "critical" | "collision";
  onSelect: (id: string) => void;
}

function markerTone(severity: AircraftMarkerProps["severity"], selected: boolean): string {
  if (selected) {
    return "selected";
  }
  if (severity === "collision" || severity === "critical") {
    return "danger";
  }
  if (severity === "warning") {
    return "warning";
  }
  return "normal";
}

function markerShape(severity: AircraftMarkerProps["severity"]): string {
  if (severity === "critical" || severity === "collision") {
    return "diamond";
  }
  if (severity === "warning") {
    return "triangle";
  }
  return "circle";
}

function createAircraftIcon(aircraft: Aircraft, severity: AircraftMarkerProps["severity"]) {
  const tone = markerTone(severity, aircraft.isSelected);
  const shape = markerShape(severity);

  return divIcon({
    className: "aircraft-div-icon",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div class="aircraft-icon ${tone} ${shape}" style="transform: rotate(${aircraft.heading}deg)"></div>`,
  });
}

export function AircraftMarker({ aircraft, severity, onSelect }: AircraftMarkerProps) {
  const projected = projectPosition(aircraft, 60);

  return (
    <>
      <Polyline
        positions={[
          [aircraft.position.lat, aircraft.position.lng],
          [projected.lat, projected.lng],
        ]}
        pathOptions={{
          color: aircraft.isSelected ? "#4488ff" : "#2adf90",
          weight: 1,
          opacity: 0.55,
          dashArray: "4 4",
        }}
      />
      <Marker
        position={[aircraft.position.lat, aircraft.position.lng]}
        icon={createAircraftIcon(aircraft, severity)}
        eventHandlers={{ click: () => onSelect(aircraft.id) }}
      >
        <Tooltip direction="bottom" permanent offset={[0, 16]} className="aircraft-tooltip">
          {aircraft.callsign} FL{Math.round(aircraft.altitude / 100).toString().padStart(3, "0")}
        </Tooltip>
      </Marker>
    </>
  );
}
