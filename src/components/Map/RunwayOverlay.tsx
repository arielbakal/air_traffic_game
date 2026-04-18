import { Fragment } from "react";
import { Polyline, Tooltip } from "react-leaflet";
import { AIRPORTS } from "@atc/core";
import { moveAlongHeading } from "@atc/core";

const ILS_CENTRELINE_NM = 15;

interface RunwayOverlayProps {
  activeRunways: string[];
}

export function RunwayOverlay({ activeRunways }: RunwayOverlayProps) {
  return (
    <>
      {Object.values(AIRPORTS).map((airport) =>
        airport.runways.map((runway) => {
          const [endA, endB] = runway.ends;
          const center: [number, number] = [
            (endA.threshold.lat + endB.threshold.lat) / 2,
            (endA.threshold.lng + endB.threshold.lng) / 2,
          ];

          const tokenA = `${airport.icao}-${endA.key}`;
          const tokenB = `${airport.icao}-${endB.key}`;
          const activeA = activeRunways.includes(tokenA);
          const activeB = activeRunways.includes(tokenB);
          const isActive = activeA || activeB;
          const runwayColor = isActive ? "#2adf90" : "#445566";

          const inboundHeadingA = (endA.heading + 180) % 360;
          const inboundHeadingB = (endB.heading + 180) % 360;
          const farA = moveAlongHeading(endA.threshold, inboundHeadingA, ILS_CENTRELINE_NM);
          const farB = moveAlongHeading(endB.threshold, inboundHeadingB, ILS_CENTRELINE_NM);

          return (
            <Fragment key={`${airport.icao}-${runway.id}`}>
              <Polyline
                positions={[
                  [endA.threshold.lat, endA.threshold.lng],
                  [endB.threshold.lat, endB.threshold.lng],
                ]}
                pathOptions={{ color: runwayColor, weight: 4, opacity: 0.8 }}
              />
              {activeA && (
                <Polyline
                  positions={[
                    [endA.threshold.lat, endA.threshold.lng],
                    [farA.lat, farA.lng],
                  ]}
                  pathOptions={{ color: "#2adf90", weight: 1, opacity: 0.5, dashArray: "4 6" }}
                />
              )}
              {activeB && (
                <Polyline
                  positions={[
                    [endB.threshold.lat, endB.threshold.lng],
                    [farB.lat, farB.lng],
                  ]}
                  pathOptions={{ color: "#2adf90", weight: 1, opacity: 0.5, dashArray: "4 6" }}
                />
              )}
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
