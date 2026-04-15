import { Fragment } from "react";
import { Polyline, Tooltip } from "react-leaflet";
import { AIRPORTS } from "../../core/constants";

export function RunwayOverlay() {
  return (
    <>
      {Object.values(AIRPORTS).map((airport) =>
        airport.runways.map((runway) => {
          const [endA, endB] = runway.ends;
          const center: [number, number] = [
            (endA.threshold.lat + endB.threshold.lat) / 2,
            (endA.threshold.lng + endB.threshold.lng) / 2,
          ];

          return (
            <Fragment key={`${airport.icao}-${runway.id}`}>
              <Polyline
                positions={[
                  [endA.threshold.lat, endA.threshold.lng],
                  [endB.threshold.lat, endB.threshold.lng],
                ]}
                pathOptions={{
                  color: "#445566",
                  weight: 4,
                  opacity: 0.8,
                }}
              />
              <Tooltip
                direction="center"
                permanent
                interactive={false}
                position={center}
                className="runway-tooltip"
              >
                {airport.icao} {runway.id}
              </Tooltip>
            </Fragment>
          );
        }),
      )}
    </>
  );
}
