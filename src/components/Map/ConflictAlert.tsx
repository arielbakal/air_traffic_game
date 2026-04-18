import { Polyline, Tooltip } from "react-leaflet";
import type { Aircraft, ConflictPair } from "@atc/core";

interface ConflictAlertProps {
  conflicts: ConflictPair[];
  aircraft: Aircraft[];
}

function conflictColor(severity: ConflictPair["severity"]): string {
  if (severity === "collision") {
    return "#ff3344";
  }
  if (severity === "critical") {
    return "#ff5566";
  }
  return "#ffaa00";
}

export function ConflictAlert({ conflicts, aircraft }: ConflictAlertProps) {
  const byCallsign = new Map(aircraft.map((item) => [item.callsign, item]));

  return (
    <>
      {conflicts.map((conflict) => {
        const a = byCallsign.get(conflict.aircraft1);
        const b = byCallsign.get(conflict.aircraft2);
        if (!a || !b) {
          return null;
        }

        return (
          <Polyline
            key={`${conflict.aircraft1}-${conflict.aircraft2}-${conflict.severity}`}
            positions={[
              [a.position.lat, a.position.lng],
              [b.position.lat, b.position.lng],
            ]}
            className="conflict-line"
            pathOptions={{
              color: conflictColor(conflict.severity),
              weight: 2,
              opacity: 0.9,
              dashArray: conflict.severity === "warning" ? "6 8" : undefined,
            }}
          >
            <Tooltip sticky>
              {conflict.aircraft1} / {conflict.aircraft2} ({conflict.distance.toFixed(1)}nm,
              {" "}
              {Math.round(conflict.altDiff)}ft)
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
}
