import type { FlightOffer, FlightSearchParams, FlightSegment, FlightProvider, FlightRevalidationResult, FlightBookingParams, FlightBookingConfirmation, FlightCancellationResult } from "./flight-provider";

const API_ROOT = "https://ignav.com/api";
const DEFAULT_TIMEOUT_MS = 15_000;

type IgnavRecord = Record<string, unknown>;

type IgnavResponse = (IgnavRecord & {
  data?: unknown;
  results?: unknown;
  fares?: unknown;
  itineraries?: unknown;
  error?: unknown;
  message?: unknown;
}) | IgnavRecord[];

export type IgnavFlexibleSlice = {
  origin: string;
  destination: string;
  departure: string;
};

export class IgnavError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "IgnavError";
    this.statusCode = statusCode;
  }
}

export function getIgnavConfig() {
  return { apiKey: process.env.IGNAV_API_KEY?.trim() ?? "" };
}

function asRecord(value: unknown): IgnavRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as IgnavRecord : null;
}

function firstString(record: IgnavRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function firstNumber(record: IgnavRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

function collectItems(payload: IgnavResponse): IgnavRecord[] {
  if (Array.isArray(payload)) return payload.map(asRecord).filter((value): value is IgnavRecord => Boolean(value));
  const candidates = [payload.data, payload.results, payload.fares, payload.itineraries];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.map(asRecord).filter((value): value is IgnavRecord => Boolean(value));
    const record = asRecord(candidate);
    if (record) {
      const nested = [record.results, record.fares, record.itineraries, record.items].find(Array.isArray);
      if (Array.isArray(nested)) return nested.map(asRecord).filter((value): value is IgnavRecord => Boolean(value));
      return [record];
    }
  }
  return [];
}

function normalizeSegment(record: IgnavRecord, params: FlightSearchParams): FlightSegment {
  const origin = firstString(record, ["origin", "from", "departure_airport", "departureAirport"]) || params.from.toUpperCase();
  const destination = firstString(record, ["destination", "to", "arrival_airport", "arrivalAirport"]) || params.to.toUpperCase();
  return {
    carrier: firstString(record, ["airline", "carrier", "marketing_airline", "marketingAirline", "operating_carrier_name"]) || firstString(record, ["marketing_carrier_code"]) || "",
    flightNumber: firstString(record, ["flight_number", "flightNumber", "number"]) || "",
    origin,
    destination,
    departureTime: firstString(record, ["departure", "departure_at", "departureAt", "depart_at", "departure_time_local"]) || "",
    arrivalTime: firstString(record, ["arrival", "arrival_at", "arrivalAt", "arrive_at", "arrival_time_local"]) || "",
    duration: firstString(record, ["duration", "duration_minutes", "durationMinutes"]) || "",
    cabin: firstString(record, ["cabin", "cabin_class", "cabinClass"]) || params.cabin || "Economy",
    aircraft: firstString(record, ["aircraft", "aircraft_type", "aircraftType"]),
  };
}

function normalizeSegmentFromSlice(record: IgnavRecord, origin: string, destination: string, cabin: string): FlightSegment {
  return {
    carrier: firstString(record, ["airline", "carrier", "marketing_airline", "marketingAirline"]) || "",
    flightNumber: firstString(record, ["flight_number", "flightNumber", "number"]) || "",
    origin: firstString(record, ["origin", "from", "departure_airport", "departureAirport"]) || origin,
    destination: firstString(record, ["destination", "to", "arrival_airport", "arrivalAirport"]) || destination,
    departureTime: firstString(record, ["departure", "departure_at", "departureAt", "depart_at"]) || "",
    arrivalTime: firstString(record, ["arrival", "arrival_at", "arrivalAt", "arrive_at"]) || "",
    duration: firstString(record, ["duration", "duration_minutes", "durationMinutes"]) || "",
    cabin: firstString(record, ["cabin", "cabin_class", "cabinClass"]) || cabin || "Economy",
    aircraft: firstString(record, ["aircraft", "aircraft_type", "aircraftType"]),
  };
}

function normalizeFare(item: IgnavRecord, params: FlightSearchParams): FlightOffer | null {
  const nested = asRecord(item.itinerary) || asRecord(item.flight) || item;
  const outbound = asRecord(nested.outbound);
  const segmentsValue = outbound && Array.isArray(outbound.segments) ? outbound.segments
    : Array.isArray(nested.segments) ? nested.segments : Array.isArray(nested.legs) ? nested.legs : [nested];
  const segments = segmentsValue.map(asRecord).filter((value): value is IgnavRecord => Boolean(value)).map((value) => normalizeSegment(value, params));
  const first = segments[0];
  const last = segments[segments.length - 1];
  const priceRecord = asRecord(nested.price);
  const price = firstNumber(priceRecord || nested, ["amount", "price", "total_price", "totalPrice", "fare"]);
  const ignavId = firstString(item, ["ignav_id", "ignavId", "id"]) || firstString(nested, ["ignav_id", "ignavId", "id"]);
  if (!ignavId || price === undefined || !first || !last) return null;

  const bookingUrl = firstString(item, ["booking_url", "bookingUrl", "deep_link", "deepLink"])
    || firstString(nested, ["booking_url", "bookingUrl", "deep_link", "deepLink"]);

  // Only set baggage when Ignav actually returns it — do not show "unavailable" for live data
  const baggageRaw = firstString(nested, ["baggage", "baggage_allowance", "baggageAllowance"]);

  return {
    id: `ignav:${ignavId}`,
    ignavId,
    airline: firstString(outbound || nested, ["airline", "carrier"]) || first.carrier,
    flightNumber: first.flightNumber,
    from: first.origin,
    to: last.destination,
    departure: first.departureTime ? new Date(first.departureTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
    arrival: last.arrivalTime ? new Date(last.arrivalTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
    duration: firstString(outbound || nested, ["duration", "duration_minutes", "durationMinutes"]) || first.duration,
    stops: Math.max(0, segments.length - 1),
    // Only set baggage when Ignav returns it; leave undefined so UI can omit it
    baggage: baggageRaw ?? "",
    price,
    baseFare: firstNumber(nested, ["base_fare", "baseFare"]) || price,
    taxes: firstNumber(nested, ["taxes", "tax", "taxAmount"]) || 0,
    currency: (firstString(priceRecord || nested, ["currency", "currency_code", "currencyCode"]) || "INR") as "INR",
    provider: "Ignav Flight API",
    mode: "LIVE",
    refundable: typeof nested.refundable === "boolean" ? nested.refundable : undefined,
    cabin: first.cabin,
    cabinClass: first.cabin,
    segments,
    fareRules: undefined,
    externalBookingUrl: bookingUrl,
    externalBooking: true,
  };
}

function normalizeFareFromFlexible(item: IgnavRecord, slices: IgnavFlexibleSlice[]): FlightOffer | null {
  const nested = asRecord(item.itinerary) || asRecord(item.flight) || item;
  const cabin = firstString(nested, ["cabin", "cabin_class", "cabinClass"]) || "Economy";
  const firstSlice = slices[0];
  const lastSlice = slices[slices.length - 1];

  const legs = Array.isArray(nested.legs) ? nested.legs : [];
  const segmentsValue = legs.length ? legs.flatMap((leg) => {
    const legRecord = asRecord(leg);
    return legRecord && Array.isArray(legRecord.segments) ? legRecord.segments : [];
  }) : Array.isArray(nested.segments) ? nested.segments : [nested];
  const segments = segmentsValue.map(asRecord).filter((v): v is IgnavRecord => Boolean(v))
    .map((v) => normalizeSegmentFromSlice(v, firstSlice?.origin || "", lastSlice?.destination || "", cabin));

  const priceRecord = asRecord(nested.price);
  const price = firstNumber(priceRecord || nested, ["amount", "price", "total_price", "totalPrice", "fare"]);
  const ignavId = firstString(item, ["ignav_id", "ignavId", "id"]) || firstString(nested, ["ignav_id", "ignavId", "id"]);
  if (!ignavId || price === undefined || !segments.length) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const bookingUrl = firstString(item, ["booking_url", "bookingUrl", "deep_link", "deepLink"])
    || firstString(nested, ["booking_url", "bookingUrl", "deep_link", "deepLink"]);
  const baggageRaw = firstString(nested, ["baggage", "baggage_allowance", "baggageAllowance"]);

  return {
    id: `ignav:${ignavId}`,
    ignavId,
    airline: firstString(nested, ["airline", "carrier", "marketing_airline", "marketingAirline"]) || first.carrier,
    flightNumber: first.flightNumber,
    from: first.origin,
    to: last.destination,
    departure: first.departureTime ? new Date(first.departureTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
    arrival: last.arrivalTime ? new Date(last.arrivalTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
    duration: first.duration,
    stops: Math.max(0, segments.length - 1),
    baggage: baggageRaw ?? "",
    price,
    baseFare: firstNumber(nested, ["base_fare", "baseFare"]) || price,
    taxes: firstNumber(nested, ["taxes", "tax", "taxAmount"]) || 0,
    currency: (firstString(priceRecord || nested, ["currency", "currency_code", "currencyCode"]) || "INR") as "INR",
    provider: "Ignav Flight API",
    mode: "LIVE",
    refundable: typeof nested.refundable === "boolean" ? nested.refundable : undefined,
    cabin,
    cabinClass: cabin,
    segments,
    fareRules: undefined,
    externalBookingUrl: bookingUrl,
    externalBooking: true,
  };
}

export class IgnavFlightProvider implements FlightProvider {
  readonly name = "Ignav Flight API";
  readonly mode = "LIVE" as const;
  private readonly apiKey: string;

  constructor(apiKey = getIgnavConfig().apiKey) {
    this.apiKey = apiKey.trim();
    if (!this.apiKey) throw new IgnavError(503, "Ignav is not configured.");
  }

  private async request(path: string, body?: IgnavRecord): Promise<IgnavResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_ROOT}${path}`, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": this.apiKey },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      const payload = await response.json() as IgnavResponse;
      if (!response.ok) {
        const statusCode = response.status === 401 || response.status === 403 ? 401 : 502;
        throw new IgnavError(statusCode, "Ignav API request failed.");
      }
      return payload;
    } catch (error) {
      if (error instanceof IgnavError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw new IgnavError(504, "Ignav API request timed out.");
      throw new IgnavError(502, "Ignav API could not be reached.");
    } finally {
      clearTimeout(timeout);
    }
  }

  async health() {
    await this.request("/health");
    return { connected: true as const, provider: "ignav" as const, service: "flight-api" as const };
  }

  async airports(query?: string) {
    if (!query?.trim()) throw new IgnavError(400, "An airport search query is required.");
    const path = `/airports?q=${encodeURIComponent(query.trim())}`;
    const payload = await this.request(path);
    return collectItems(payload);
  }

  async search(params: FlightSearchParams): Promise<FlightOffer[]> {
    const body = {
      origin: params.from.toUpperCase(),
      destination: params.to.toUpperCase(),
      departure_date: params.departure,
      ...(params.returnDate ? { return_date: params.returnDate } : {}),
      adults: params.adults || params.travellers || 1,
      cabin_class: (params.cabin || "Economy").toLowerCase().replace(/ /g, "_"),
    };
    const endpoint = params.returnDate ? "/fares/round-trip" : "/fares/one-way";
    const payload = await this.request(endpoint, body);
    return collectItems(payload).map((item) => normalizeFare(item, params)).filter((value): value is FlightOffer => Boolean(value));
  }

  /**
   * Flexible / multi-city fare search using POST /fares/search.
   * Each slice is { origin, destination, departure }.
   */
  async flexibleSearch(slices: IgnavFlexibleSlice[], options: { travellers?: number; cabin?: string } = {}): Promise<FlightOffer[]> {
    const body = {
      legs: slices.map((slice) => ({
        origin: slice.origin,
        destination: slice.destination,
        departure_date: slice.departure,
      })),
      adults: options.travellers || 1,
      cabin_class: (options.cabin || "Economy").toLowerCase().replace(/ /g, "_"),
    };
    const payload = await this.request("/fares/search", body);
    return collectItems(payload).map((item) => normalizeFareFromFlexible(item, slices)).filter((value): value is FlightOffer => Boolean(value));
  }

  async bookingLink(ignavId: string) {
    const payload = await this.request("/fares/booking-links", { ignav_id: ignavId });
    const options = asRecord(payload)?.booking_options;
    const links = Array.isArray(options) ? options.flatMap((option) => {
      const optionRecord = asRecord(option);
      return optionRecord && Array.isArray(optionRecord.links) ? optionRecord.links : [];
    }) : [];
    const firstLink = asRecord(links[0]);
    const url = firstString(firstLink || {}, ["url", "booking_url", "bookingUrl", "link"]);
    if (!url) throw new IgnavError(502, "Ignav returned no external booking URL.");
    return { url, ignavId };
  }

  async revalidate(offerId: string, expectedPrice = 0): Promise<FlightRevalidationResult> {
    return { valid: false, priceChanged: false, oldPrice: expectedPrice, newPrice: expectedPrice, soldOut: true, currency: "INR", offerId, message: "Ignav fares are external booking data and cannot be revalidated by Zelevos." };
  }

  async createBooking(_params: FlightBookingParams): Promise<FlightBookingConfirmation> {
    throw new IgnavError(501, "Ignav does not issue bookings, PNRs, or tickets through Zelevos.");
  }

  async cancelBooking(_pnr: string): Promise<FlightCancellationResult> {
    return { success: false, cancellationReference: "", refundAmount: 0, cancellationFee: 0, status: "REFUND_PENDING", message: "Ignav external bookings must be cancelled with the airline or OTA." };
  }

  async getBooking(_pnr: string): Promise<FlightBookingConfirmation | null> {
    return null;
  }
}
