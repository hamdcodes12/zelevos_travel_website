const API_ROOT = "https://api.travelpayouts.com/aviasales/v3";
const DEFAULT_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

type TravelpayoutsResponse = {
  success?: boolean;
  data?: unknown;
  error?: string | null;
};

export type TravelpayoutsFlightData = {
  origin: string;
  destination: string;
  origin_airport?: string;
  destination_airport?: string;
  price?: number;
  currency?: string;
  airline?: string;
  flight_number?: string | number;
  departure_at?: string;
  return_at?: string;
  transfers?: number;
  return_transfers?: number;
  duration?: number;
  duration_to?: number;
  duration_back?: number;
  link?: string;
};

export type TravelpayoutsFlightDataQuery = {
  origin: string;
  destination: string;
  departureAt: string;
  returnAt?: string;
  currency?: string;
};

const flightDataCache = new Map<string, { expiresAt: number; data: TravelpayoutsFlightData[] }>();

export type TravelpayoutsFailureCode =
  | "missing_secret"
  | "authentication_failed"
  | "api_failure"
  | "network_failure"
  | "malformed_response";

export class TravelpayoutsError extends Error {
  readonly code: TravelpayoutsFailureCode;
  readonly statusCode: number;

  constructor(code: TravelpayoutsFailureCode, statusCode: number, message: string) {
    super(message);
    this.name = "TravelpayoutsError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function getTravelpayoutsConfig() {
  return {
    apiToken: process.env.TRAVELPAYOUTS_API_TOKEN?.trim() ?? "",
  };
}

function buildPricesForDatesUrl(query: TravelpayoutsFlightDataQuery) {
  const url = new URL(`${API_ROOT}/prices_for_dates`);
  url.searchParams.set("origin", query.origin);
  url.searchParams.set("destination", query.destination);
  url.searchParams.set("departure_at", query.departureAt);
  if (query.returnAt) url.searchParams.set("return_at", query.returnAt);
  url.searchParams.set("one_way", query.returnAt ? "false" : "true");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("direct", "false");
  url.searchParams.set("currency", query.currency || "INR");
  url.searchParams.set("limit", "30");
  url.searchParams.set("page", "1");
  return url;
}

export async function getTravelpayoutsFlightData(
  query: TravelpayoutsFlightDataQuery,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const { apiToken } = getTravelpayoutsConfig();
  if (!apiToken) {
    throw new TravelpayoutsError("missing_secret", 503, "Travelpayouts is not configured.");
  }

  const cacheKey = JSON.stringify(query);
  const cached = flightDataCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data, cached: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(buildPricesForDatesUrl(query), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "X-Access-Token": apiToken,
      },
      signal: controller.signal,
    });
    const payload = (await response.json()) as TravelpayoutsResponse;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new TravelpayoutsError("authentication_failed", 502, "Travelpayouts authentication failed.");
      }
      throw new TravelpayoutsError("api_failure", 502, "Travelpayouts API request failed.");
    }
    if (payload.success !== true || !Array.isArray(payload.data)) {
      throw new TravelpayoutsError("malformed_response", 502, "Travelpayouts returned no usable flight data.");
    }

    const data = payload.data as TravelpayoutsFlightData[];
    flightDataCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return { data, cached: false };
  } catch (error) {
    if (error instanceof TravelpayoutsError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new TravelpayoutsError("network_failure", 504, "Travelpayouts API took too long to respond.");
    }
    throw new TravelpayoutsError("network_failure", 502, "Travelpayouts API could not be reached.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkTravelpayoutsConnection(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const { apiToken } = getTravelpayoutsConfig();
  if (!apiToken) {
    throw new TravelpayoutsError("missing_secret", 503, "Travelpayouts is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL(`${API_ROOT}/get_popular_directions`);
    url.searchParams.set("destination", "DEL");
    url.searchParams.set("locale", "en");
    url.searchParams.set("currency", "INR");
    url.searchParams.set("limit", "1");
    url.searchParams.set("page", "1");

    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "X-Access-Token": apiToken,
      },
      signal: controller.signal,
    });
    const payload = (await response.json()) as TravelpayoutsResponse;

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new TravelpayoutsError("authentication_failed", 502, "Travelpayouts authentication failed.");
      }
      throw new TravelpayoutsError("api_failure", 502, "Travelpayouts API request failed.");
    }
    if (payload.success !== true) {
      throw new TravelpayoutsError("api_failure", 502, "Travelpayouts API returned an unsuccessful response.");
    }

    return { connected: true as const, provider: "travelpayouts" as const, service: "aviasales-data-api" as const };
  } catch (error) {
    if (error instanceof TravelpayoutsError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new TravelpayoutsError("network_failure", 504, "Travelpayouts API took too long to respond.");
    }
    throw new TravelpayoutsError("network_failure", 502, "Travelpayouts API could not be reached.");
  } finally {
    clearTimeout(timeout);
  }
}
