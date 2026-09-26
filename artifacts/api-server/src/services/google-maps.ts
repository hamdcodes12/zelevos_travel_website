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

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", trimmed);
  url.searchParams.set("components", "country:in");
  url.searchParams.set("types", "establishment|geocode");
  if (sessionToken) url.searchParams.set("sessiontoken", sessionToken);
  url.searchParams.set("key", getApiKey());

  const payload = await getJson<{
    predictions?: Array<{
      place_id: string;
      description: string;
      structured_formatting?: { main_text?: string; secondary_text?: string };
    }>;
  }>(url);

  return (payload.predictions || []).slice(0, 8).map((prediction) => ({
    placeId: prediction.place_id,
    description: prediction.description,
    mainText: prediction.structured_formatting?.main_text || prediction.description,
    secondaryText: prediction.structured_formatting?.secondary_text || "",
  }));
}

export async function getRoute(origin: string, destination: string): Promise<GoogleRouteResult> {
  const cleanOrigin = origin.trim();
  const cleanDestination = destination.trim();
  if (!cleanOrigin || !cleanDestination) {
    throw new GoogleMapsUnavailableError("Both route locations are required.");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", cleanOrigin);
  url.searchParams.set("destination", cleanDestination);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("region", "in");
  url.searchParams.set("key", getApiKey());

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
  return {
    origin: cleanOrigin,
    destination: cleanDestination,
    distanceMeters: leg.distance?.value || 0,
    distanceText: leg.distance?.text || "Distance unavailable",
    durationSeconds: leg.duration?.value || 0,
    durationText: leg.duration?.text || "Travel time unavailable",
    encodedPolyline: route.overview_polyline?.points || "",
    mapsUrl,
  };
}

export async function fetchStaticRouteMap(route: GoogleRouteResult): Promise<Buffer> {
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("size", "900x420");
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("markers", `color:0x214ecf|label:A|${route.origin}`);
  url.searchParams.append("markers", `color:0x0f766e|label:B|${route.destination}`);
  if (route.encodedPolyline) {
    url.searchParams.set("path", `color:0x214ecf|weight:5|enc:${route.encodedPolyline}`);
  }
  url.searchParams.set("key", getApiKey());

  const response = await fetch(url);
  if (!response.ok) {
    throw new GoogleMapsUnavailableError(`Google Maps image request failed with HTTP ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}