// GPS Zone definitions for Beppu area
// APU Campus: Ritsumeikan Asia Pacific University main campus
// Downtown Beppu: Station area, shopping district, and residential areas

export interface LocationZone {
  id: string;
  name: string;
  nameLang: {
    en: string;
    ja: string;
    zh: string;
    my: string;
    ko: string;
    id: string;
  };
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export const LOCATION_ZONES: LocationZone[] = [
  {
    id: 'apu_campus',
    name: 'APU Campus',
    nameLang: {
      en: 'APU Campus',
      ja: 'APU キャンパス',
      zh: 'APU 校园',
      my: 'APU ကျောင်း',
      ko: 'APU 캠퍼스',
      id: 'Kampus APU',
    },
    latitude: 33.1599,
    longitude: 131.6046,
    radiusMeters: 800, // Covers main campus and AP House dormitories
  },
  {
    id: 'downtown_beppu',
    name: 'Downtown Beppu',
    nameLang: {
      en: 'Downtown Beppu',
      ja: '別府駅周辺',
      zh: '别府市区',
      my: 'Beppu မြို့လယ်',
      ko: '벳푸 시내',
      id: 'Pusat Kota Beppu',
    },
    latitude: 33.2847,
    longitude: 131.4913,
    radiusMeters: 1500, // Covers station area, shopping district, and nearby residential
  },
];

// Calculate distance between two GPS coordinates using Haversine formula
function getDistanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Detect which zone the user is in based on GPS coordinates
export function detectLocationZone(
  latitude: number,
  longitude: number
): LocationZone | null {
  for (const zone of LOCATION_ZONES) {
    const distance = getDistanceInMeters(
      latitude,
      longitude,
      zone.latitude,
      zone.longitude
    );
    if (distance <= zone.radiusMeters) {
      return zone;
    }
  }
  return null;
}

// Get zone by ID
export function getZoneById(zoneId: string): LocationZone | undefined {
  return LOCATION_ZONES.find((z) => z.id === zoneId);
}

// Check if user is in Beppu area (broader check)
export function isInBeppuArea(latitude: number, longitude: number): boolean {
  // Beppu city bounds
  const minLat = 33.2;
  const maxLat = 33.4;
  const minLng = 131.4;
  const maxLng = 131.6;

  return (
    latitude >= minLat &&
    latitude <= maxLat &&
    longitude >= minLng &&
    longitude <= maxLng
  );
}
