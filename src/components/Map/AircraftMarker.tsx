import { divIcon } from "leaflet";
import { Marker, Polyline, Tooltip } from "react-leaflet";
import { projectPosition } from "@atc/core";
import { moveAlongHeading } from "@atc/core";
import type { Aircraft } from "@atc/core";

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
  const headingDiff = Math.abs(((aircraft.targetHeading - aircraft.heading) + 540) % 360 - 180);
  const showTargetVector = headingDiff > 5;
  const targetProjected = showTargetVector
    ? moveAlongHeading(aircraft.position, aircraft.targetHeading, (aircraft.speed / 3600) * 90)
    : null;

  return (
    <>
      <Polyline
        positions={[
          [aircraft.position.lat, aircraft.position.lng],
          [projected.lat, projected.lng],
        ]}
        className="aircraft-vector-line"
        pathOptions={{
          color: aircraft.isSelected ? "#4488ff" : "#2adf90",
          weight: 1,
          opacity: aircraft.isSelected ? 0.26 : 0.55,
          dashArray: "4 4",
        }}
      />
      {showTargetVector && targetProjected && (
        <Polyline
          positions={[
            [aircraft.position.lat, aircraft.position.lng],
            [targetProjected.lat, targetProjected.lng],
          ]}
          pathOptions={{
            color: "#88aaff",
            weight: 1,
            opacity: 0.4,
            dashArray: "2 6",
          }}
        />
      )}
      <Marker
        position={[aircraft.position.lat, aircraft.position.lng]}
        icon={createAircraftIcon(aircraft, severity)}
        eventHandlers={{ click: (e) => { e.originalEvent.stopPropagation(); onSelect(aircraft.id); } }}
      >
        <Tooltip direction="bottom" permanent offset={[0, 16]} className="aircraft-tooltip">
          {aircraft.callsign} FL{Math.round(aircraft.altitude / 100).toString().padStart(3, "0")}
        </Tooltip>
      </Marker>
    </>
  );
}
