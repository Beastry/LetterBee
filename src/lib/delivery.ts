export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type DeliveryWindow = {
  minMinutes: number;
  maxMinutes: number;
  label: string;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceKm(from: GeoPoint, to: GeoPoint): number {
  const latitudeDistance = toRadians(to.latitude - from.latitude);
  const longitudeDistance = toRadians(to.longitude - from.longitude);

  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDistance / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export function calculateDeliveryWindow({
  distanceKm,
}: {
  distanceKm: number;
}): DeliveryWindow {
  if (distanceKm <= 30) {
    return { minMinutes: 10, maxMinutes: 60, label: "同城邮路" };
  }

  if (distanceKm <= 500) {
    return { minMinutes: 60, maxMinutes: 6 * 60, label: "同省/邻近邮路" };
  }

  if (distanceKm <= 3000) {
    return { minMinutes: 6 * 60, maxMinutes: 24 * 60, label: "跨省邮路" };
  }

  return { minMinutes: 24 * 60, maxMinutes: 3 * 24 * 60, label: "国际邮路" };
}
