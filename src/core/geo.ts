import type { Position } from "./types";

const EARTH_RADIUS_NM = 3440.065;

export function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

export function normalizeHeading(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function shortestHeadingDelta(from: number, to: number): number {
  const delta = normalizeHeading(to) - normalizeHeading(from);
  if (delta > 180) {
    return delta - 360;
  }
  if (delta < -180) {
    return delta + 360;
  }
  return delta;
}

export function haversineNm(a: Position, b: Position): number {
  const lat1 = degToRad(a.lat);
  const lat2 = degToRad(b.lat);
  const dLat = degToRad(b.lat - a.lat);
  const dLng = degToRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_NM * c;
}

export function bearingFromTo(a: Position, b: Position): number {
  const lat1 = degToRad(a.lat);
  const lat2 = degToRad(b.lat);
  const dLng = degToRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return normalizeHeading(radToDeg(Math.atan2(y, x)));
}

export function moveAlongHeading(position: Position, heading: number, distanceNm: number): Position {
  const headingRad = degToRad(heading);
  const latRad = degToRad(position.lat);

  const dLat = (distanceNm * Math.cos(headingRad)) / 60;
  const dLng = (distanceNm * Math.sin(headingRad)) / (60 * Math.cos(latRad));

  return {
    lat: position.lat + dLat,
    lng: position.lng + dLng,
  };
}

export function positionToLocalNm(center: Position, point: Position): { x: number; y: number } {
  const dLatNm = (point.lat - center.lat) * 60;
  const cosLat = Math.cos(degToRad(center.lat));
  const dLngNm = (point.lng - center.lng) * 60 * cosLat;
  return { x: dLngNm, y: dLatNm };
}

export function localNmToPosition(center: Position, vector: { x: number; y: number }): Position {
  const cosLat = Math.cos(degToRad(center.lat));
  return {
    lat: center.lat + vector.y / 60,
    lng: center.lng + vector.x / (60 * cosLat),
  };
}
