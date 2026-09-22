import "server-only";

/**
 * Mapping seam — geocoding, routing, ETA.
 *
 * No provider is connected, and per the brief we do not draw a fake map. The
 * UI asks `isMapAvailable()` and renders an honest unconfigured state instead
 * of invented pins. Implement MapboxProvider/GoogleProvider against this
 * interface and the map component starts working with no UI changes.
 */
export type LatLng = { lat: number; lng: number };
export type RouteLeg = { fromId: string; toId: string; meters: number; seconds: number };

export interface MapsProvider {
  readonly name: string;
  geocode(address: string): Promise<LatLng | null>;
  /** Travel time between stops, for the schedule's travel-buffer calculations. */
  route(stops: Array<{ id: string; at: LatLng }>): Promise<RouteLeg[]>;
  staticMapUrl(center: LatLng, markers: LatLng[], zoom?: number): string | null;
}

class UnconfiguredMaps implements MapsProvider {
  readonly name = "unconfigured";
  async geocode() { return null; }
  async route() { return []; }
  staticMapUrl() { return null; }
}

export function isMapAvailable(): boolean {
  return Boolean(process.env.MAPBOX_TOKEN || process.env.GOOGLE_MAPS_KEY);
}

let maps: MapsProvider | null = null;
export function getMaps(): MapsProvider {
  if (!maps) maps = new UnconfiguredMaps();
  return maps;
}
