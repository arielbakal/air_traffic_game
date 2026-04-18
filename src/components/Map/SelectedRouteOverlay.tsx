import { CircleMarker, Polyline } from "react-leaflet";
import type { Aircraft, Position } from "@atc/core";

interface SelectedRouteOverlayProps {
  aircraft: Aircraft | null;
}

function dedupeSequential(points: Position[]): Position[] {
  if (points.length <= 1) {
    return points;
  }

  const deduped: Position[] = [points[0]];

  for (let i = 1; i < points.length; i += 1) {
    const prev = deduped[deduped.length - 1];
    const next = points[i];
    const latDiff = Math.abs(prev.lat - next.lat);
    const lngDiff = Math.abs(prev.lng - next.lng);

    if (latDiff > 0.0001 || lngDiff > 0.0001) {
      deduped.push(next);
    }
  }

  return deduped;
}

export function SelectedRouteOverlay({ aircraft }: SelectedRouteOverlayProps) {
  if (!aircraft || aircraft.routeWaypoints.length < 2) {
    return null;
  }

  const routePoints = dedupeSequential(aircraft.routeWaypoints);
  if (routePoints.length < 2) {
    return null;
  }

  const currentIndex = Math.min(
    Math.max(0, aircraft.routeWaypointIndex),
    Math.max(0, routePoints.length - 1),
  );

  const flownPoints = dedupeSequential([...routePoints.slice(0, currentIndex + 1), aircraft.position]);
  const remainingPoints = dedupeSequential([aircraft.position, ...routePoints.slice(currentIndex)]);

  return (
    <>
      <Polyline
        positions={routePoints.map((point) => [point.lat, point.lng] as [number, number])}
        pathOptions={{
          color: "#7a94aa",
          weight: 2,
          opacity: 0.35,
          dashArray: "10 8",
        }}
      />

      {flownPoints.length >= 2 && (
        <Polyline
          positions={flownPoints.map((point) => [point.lat, point.lng] as [number, number])}
          pathOptions={{
            color: "#4dbf92",
            weight: 2.4,
            opacity: 0.55,
          }}
        />
      )}

      <Polyline
        positions={remainingPoints.map((point) => [point.lat, point.lng] as [number, number])}
        pathOptions={{
          color: "#2e6da0",
          weight: 6,
          opacity: 0.2,
        }}
      />
      <Polyline
        positions={remainingPoints.map((point) => [point.lat, point.lng] as [number, number])}
        pathOptions={{
          color: "#76c4ff",
          weight: 3,
          opacity: 0.9,
        }}
      />

      {routePoints.map((point, index) => {
        const nextLeg = index >= currentIndex;
        return (
          <CircleMarker
            key={`route-point-${point.lat}-${point.lng}-${index}`}
            center={[point.lat, point.lng]}
            radius={nextLeg ? 2.8 : 2.2}
            pathOptions={{
              color: nextLeg ? "#86ceff" : "#5a7388",
              weight: 1,
              fillColor: nextLeg ? "#86ceff" : "#5a7388",
              fillOpacity: nextLeg ? 0.95 : 0.55,
            }}
          />
        );
      })}
    </>
  );
}
