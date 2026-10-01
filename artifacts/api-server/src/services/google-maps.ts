export type GooglePlaceSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

export type GoogleRouteResult = {
  origin: string;
  destination: string;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  encodedPolyline: string;
  mapsUrl: string;
};

export class GoogleMapsUnavailableError extends Error {
  constructor(message = "Google Maps is not configured or unavailable.") {
    super(message);
    this.name = "GoogleMapsUnavailableError";
  }
}

// --------------------------------------------------------------------------
// Bounded TTL cache (round-2 fix, P3): identical lookups within the window reuse the last successful
// result instead of paying Google again. Only successful lookups are ever stored; a failure is never cached.
// --------------------------------------------------------------------------
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

class TtlCache<V> {
  private readonly store = new Map<string, { value: V; expiresAt: number }>();

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // refresh recency
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.store.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  clear(): void {
    this.store.clear();
  }
}

/** Case/whitespace-insensitive cache key: "Goa Beach" and " goa  BEACH " must hit the same entry. */
export function normalizeMapsQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const autocompleteCache = new TtlCache<GooglePlaceSuggestion[]>();
const routeCache = new TtlCache<GoogleRouteResult>();
const staticMapCache = new TtlCache<Buffer>();

export function clearMapsCaches(): void {
  // Test-only helper: keeps suites independent of each other's cached lookups.
  autocompleteCache.clear();
  routeCache.clear();
  staticMapCache.clear();
}

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    throw new GoogleMapsUnavailableError("Google Maps is not configured.");
  }
  return key;
}

async function getJson<T>(url: URL): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json() as T & { status?: string; error_message?: string };
  if (!response.ok || (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS")) {
    throw new GoogleMapsUnavailableError(payload.error_message || `Google Maps returned HTTP ${response.status}.`);
  }
  return payload;
}

export async function autocompletePlaces(input: string, sessionToken?: string): Promise<GooglePlaceSuggestion[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  // The key check happens before any cache read: an unconfigured key must always fail closed, even for a
  // query a previous, differently-configured call happened to cache.
  const apiKey = getApiKey();

  // A session token intentionally makes every call unique to Google's billing, so those calls bypass the cache.
  const cacheKey = sessionToken ? undefined : normalizeMapsQuery(trimmed);
  if (cacheKey) {
    const cached = autocompleteCache.get(cacheKey);
    if (cached) return cached;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", trimmed);
  url.searchParams.set("components", "country:in");
  url.searchParams.set("types", "establishment|geocode");
  if (sessionToken) url.searchParams.set("sessiontoken", sessionToken);
  url.searchParams.set("key", apiKey);

  const payload = await getJson<{
    predictions?: Array<{
      place_id: string;
      description: string;
      structured_formatting?: { main_text?: string; secondary_text?: string };
    }>;
  }>(url);

  const results = (payload.predictions || []).slice(0, 8).map((prediction) => ({
    placeId: prediction.place_id,
    description: prediction.description,
    mainText: prediction.structured_formatting?.main_text || prediction.description,
    secondaryText: prediction.structured_formatting?.secondary_text || "",
  }));
  if (cacheKey) autocompleteCache.set(cacheKey, results);
  return results;
}

function routeCacheKey(origin: string, destination: string): string {
  return `${normalizeMapsQuery(origin)}|${normalizeMapsQuery(destination)}`;
}

export async function getRoute(origin: string, destination: string): Promise<GoogleRouteResult> {
  const cleanOrigin = origin.trim();
  const cleanDestination = destination.trim();
  if (!cleanOrigin || !cleanDestination) {
    throw new GoogleMapsUnavailableError("Both route locations are required.");
  }

  const apiKey = getApiKey();

  const cacheKey = routeCacheKey(cleanOrigin, cleanDestination);
  const cachedRoute = routeCache.get(cacheKey);
  if (cachedRoute) return cachedRoute;

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", cleanOrigin);
  url.searchParams.set("destination", cleanDestination);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("region", "in");
  url.searchParams.set("key", apiKey);

  const payload = await getJson<{
    routes?: Array<{
      overview_polyline?: { points?: string };
      legs?: Array<{
        distance?: { value?: number; text?: string };
        duration?: { value?: number; text?: string };
      }>;
    }>;
  }>(url);

  const route = payload.routes?.[0];
  const leg = route?.legs?.[0];
  if (!route || !leg) {
    throw new GoogleMapsUnavailableError("Google Maps could not find a route for those locations.");
  }

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(cleanOrigin)}&destination=${encodeURIComponent(cleanDestination)}`;
  const result: GoogleRouteResult = {
    origin: cleanOrigin,
    destination: cleanDestination,
    distanceMeters: leg.distance?.value || 0,
    distanceText: leg.distance?.text || "Distance unavailable",
    durationSeconds: leg.duration?.value || 0,
    durationText: leg.duration?.text || "Travel time unavailable",
    encodedPolyline: route.overview_polyline?.points || "",
    mapsUrl,
  };
  routeCache.set(cacheKey, result);
  return result;
}

export async function fetchStaticRouteMap(route: GoogleRouteResult): Promise<Buffer> {
  const apiKey = getApiKey();

  const cacheKey = routeCacheKey(route.origin, route.destination);
  const cachedImage = staticMapCache.get(cacheKey);
  if (cachedImage) return cachedImage;

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("size", "900x420");
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("markers", `color:0x214ecf|label:A|${route.origin}`);
  url.searchParams.append("markers", `color:0x0f766e|label:B|${route.destination}`);
  if (route.encodedPolyline) {
    url.searchParams.set("path", `color:0x214ecf|weight:5|enc:${route.encodedPolyline}`);
  }
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new GoogleMapsUnavailableError(`Google Maps image request failed with HTTP ${response.status}.`);
  }
  const image = Buffer.from(await response.arrayBuffer());
  staticMapCache.set(cacheKey, image);
  return image;
}