import { EARTH_RADIUS_KM } from './constants.js';

/** Haversine distance in km between two lat/lng points. */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Check if a point is within a radius of a center point. */
export function isWithinRadius(
  pointLat: number,
  pointLng: number,
  centerLat: number,
  centerLng: number,
  radiusKm: number,
): boolean {
  return haversineDistanceKm(pointLat, pointLng, centerLat, centerLng) <= radiusKm;
}
