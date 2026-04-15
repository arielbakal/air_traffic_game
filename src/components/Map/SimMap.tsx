import { useMemo } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { MAP_CENTER, MAP_ZOOM, TMA } from "../../core/constants";
import type { Aircraft, ConflictPair } from "../../core/types";
import { AircraftMarker } from "./AircraftMarker";
import { AirspaceOverlay } from "./AirspaceOverlay";
import { ConflictAlert } from "./ConflictAlert";
import { RunwayOverlay } from "./RunwayOverlay";

interface SimMapProps {
  aircraft: Aircraft[];
  conflicts: ConflictPair[];
  onSelectAircraft: (id: string | null) => void;
}

function MapClickCapture({ onClearSelection }: { onClearSelection: () => void }) {
  useMapEvents({
    click: () => onClearSelection(),
  });
  return null;
}

function maxSeverity(
  current: "none" | "warning" | "critical" | "collision",
  next: "warning" | "critical" | "collision",
): "none" | "warning" | "critical" | "collision" {
  const rank = {
    none: 0,
    warning: 1,
    critical: 2,
    collision: 3,
  } as const;

  return rank[next] > rank[current] ? next : current;
}

export function SimMap({ aircraft, conflicts, onSelectAircraft }: SimMapProps) {
  const severityByCallsign = useMemo(() => {
    const result = new Map<string, "none" | "warning" | "critical" | "collision">();

    for (const item of conflicts) {
      const currentA = result.get(item.aircraft1) ?? "none";
      const currentB = result.get(item.aircraft2) ?? "none";
      result.set(item.aircraft1, maxSeverity(currentA, item.severity));
      result.set(item.aircraft2, maxSeverity(currentB, item.severity));
    }

    return result;
  }, [conflicts]);

  const maxBounds: [[number, number], [number, number]] = [
    [TMA.center.lat - 2.1, TMA.center.lng - 2.25],
    [TMA.center.lat + 2.1, TMA.center.lng + 2.25],
  ];

  return (
    <MapContainer
      center={[MAP_CENTER.lat, MAP_CENTER.lng]}
      zoom={MAP_ZOOM}
      minZoom={7}
      maxZoom={12}
      maxBounds={maxBounds}
      maxBoundsViscosity={0.7}
      zoomControl={false}
      preferCanvas
      className="sim-map"
    >
      <MapClickCapture onClearSelection={() => onSelectAircraft(null)} />

      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
      />

      <AirspaceOverlay />
      <RunwayOverlay />
      <ConflictAlert conflicts={conflicts} aircraft={aircraft} />

      {aircraft.map((item) => (
        <AircraftMarker
          key={item.id}
          aircraft={item}
          severity={severityByCallsign.get(item.callsign) ?? "none"}
          onSelect={onSelectAircraft}
        />
      ))}
    </MapContainer>
  );
}
