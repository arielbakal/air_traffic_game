import { Circle, CircleMarker, Tooltip } from "react-leaflet";
import { AIRPORTS, TMA } from "../../core/constants";

export function AirspaceOverlay() {
  return (
    <>
      <Circle
        center={[TMA.center.lat, TMA.center.lng]}
        radius={TMA.radius * 1852}
        pathOptions={{
          color: "#2f8753",
          weight: 2,
          fillColor: "#10381f",
          fillOpacity: 0.08,
          dashArray: "8 10",
        }}
      >
        <Tooltip direction="center" permanent className="tma-tooltip">
          BAIRES TMA 50NM / FL245
        </Tooltip>
      </Circle>

      {Object.values(AIRPORTS).map((airport) => (
        <CircleMarker
          key={airport.icao}
          center={[airport.position.lat, airport.position.lng]}
          radius={4}
          pathOptions={{ color: "#88aacc", weight: 1, fillColor: "#88aacc", fillOpacity: 0.9 }}
        >
          <Tooltip direction="top" permanent className="airport-tooltip">
            {airport.icao}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
