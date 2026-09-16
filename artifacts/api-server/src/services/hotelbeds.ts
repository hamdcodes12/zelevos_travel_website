import crypto from "node:crypto";
import { logger } from "../lib/logger";

const DEFAULT_TIMEOUT_MS = 15_000;
export const HOTELBEDS_BOOKING_TIMEOUT_MS = 60_000;
const DEFAULT_BASE_URL = "https://api.test.hotelbeds.com";
export type HotelbedsEnvironment = "TEST" | "LIVE";

type RecordValue = Record<string, unknown>;

export type HotelbedsSearchInput = {
  checkIn: string;
  checkOut: string;
  destination?: string;
  hotelIds?: string[];
  rooms: Array<{ adults: number; children: number; childAges: number[] }>;
  sourceMarket?: string;
};

export type HotelbedsRate = {
  rateKey: string;
  rateType: "RECHECK" | "BOOKABLE" | string;
  hotelbedsHotelId: string;
  hotelName: string;
  category?: string;
  destination?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  images: string[];
  description?: string;
  facilities: string[];
  roomType?: string;
  boardType?: string;
  rooms: number;
  adults: number;
  children: number;
  childAges: number[];
  price: number;
  currency: string;
  cancellationPolicies: Array<RecordValue>;
  rateCommentsId?: string;
  rateComments?: string;
  refundable?: boolean;
  hotelCode?: string;
  provider: "HOTELBEDS";
  environment: HotelbedsEnvironment;
};

export type HotelbedsRateDetails = {
  rateKey?: string;
  rateType?: string;
  price?: number;
  currency?: string;
  boardType?: string;
  roomType?: string;
  cancellationPolicies: Array<RecordValue>;
  rateComments?: string;
  rateCommentsId?: string;
  refundable?: boolean;
};

export type HotelbedsContent = {
  provider: "HOTELBEDS";
  environment: HotelbedsEnvironment;
  hotelCode: string;
  name?: string;
  category?: string;
  address?: string;
  destination?: string;
  latitude?: number;
  longitude?: number;
  images: string[];
  description?: string;
  facilities: string[];
  rooms: Array<{ code?: string; name?: string; roomType?: string; facilities: string[] }>;
  boards: Array<{ code?: string; name?: string }>;
  pointsOfInterest: Array<{ name: string; distance?: number }>;
};

export type HotelbedsErrorCode = "not_configured" | "timeout" | "upstream" | "invalid_response";

export class HotelbedsError extends Error {
  readonly statusCode: number;
  readonly code: HotelbedsErrorCode;

  constructor(statusCode: number, code: HotelbedsErrorCode, message: string) {
    super(message);
    this.name = "HotelbedsError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function getHotelbedsConfig() {
  return {
    apiKey: process.env.HOTELBEDS_HOTEL_API_KEY?.trim() ?? "",
    secret: process.env.HOTELBEDS_HOTEL_SECRET?.trim() ?? "",
    baseUrl: (process.env.HOTELBEDS_HOTEL_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, ""),
  };
}

export function hotelbedsEnvironment(baseUrl = getHotelbedsConfig().baseUrl): HotelbedsEnvironment {
  return baseUrl === "https://api.hotelbeds.com" ? "LIVE" : "TEST";
}

export function hotelbedsSignature(apiKey: string, secret: string, timestampSeconds = Math.floor(Date.now() / 1000)): string {
  return crypto.createHash("sha256").update(`${apiKey}${secret}${timestampSeconds}`).digest("hex");
}

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : undefined;
}

function numberValue(value: unknown): number | undefined {
  const result = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(result) ? result : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function explicitBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeCancellationPolicies(value: unknown): Array<RecordValue> {
  return asArray(value).map(record).filter((policy) => Object.keys(policy).length > 0);
}

function normalizeRateDetails(value: unknown): HotelbedsRateDetails {
  const rate = record(value);
  const cancellationPolicies = normalizeCancellationPolicies(rate.cancellationPolicies);
  const explicitNonRefundable = explicitBoolean(rate.nonRefundable);
  const explicitRefundable = explicitBoolean(rate.refundable);
  return {
    rateKey: stringValue(rate.rateKey),
    rateType: stringValue(rate.rateType),
    price: numberValue(rate.net) ?? numberValue(rate.sellingRate),
    currency: stringValue(rate.currency),
    boardType: stringValue(rate.boardName) || stringValue(rate.boardCode),
    roomType: stringValue(rate.roomName) || stringValue(rate.roomCode),
    cancellationPolicies,
    rateCommentsId: stringValue(rate.rateCommentsId),
    rateComments: stringValue(rate.rateComments),
    refundable: explicitNonRefundable === undefined ? explicitRefundable : !explicitNonRefundable,
  };
}

function requestSummary(path: string, method: string, body?: RecordValue) {
  const rooms = Array.isArray(body?.rooms) ? body.rooms as RecordValue[] : [];
  return {
    endpoint: path,
    method,
    bodyKeys: body ? Object.keys(body).sort() : [],
    rateKeyPresent: rooms.some((room) => typeof room.rateKey === "string"),
    roomCount: rooms.length,
    paxCount: rooms.reduce((count, room) => count + (Array.isArray(room.paxes) ? room.paxes.length : 0), 0),
    clientReferenceLength: typeof body?.clientReference === "string" ? body.clientReference.length : undefined,
  };
}

function responseSummary(payload: unknown) {
  const body = record(payload);
  const error = record(body.error);
  return {
    bodyKeys: Object.keys(body).sort(),
    errorCode: stringValue(error.code),
    errorMessage: stringValue(error.message),
    bookingStatus: stringValue(record(body.booking).status),
  };
}

function durationNights(checkIn: string, checkOut: string): number {
  return Math.max(1, Math.ceil((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000));
}

function normalizeRate(hotel: RecordValue, room: RecordValue, rate: RecordValue, input: HotelbedsSearchInput): HotelbedsRate | null {
  const hotelCode = stringValue(hotel.code) || stringValue(hotel.hotelCode);
  const rateKey = stringValue(rate.rateKey);
  const price = numberValue(rate.net) ?? numberValue(rate.sellingRate);
  if (!hotelCode || !rateKey || price === undefined) return null;
  const occupancies = input.rooms.reduce((totals, roomInput) => ({
    adults: totals.adults + roomInput.adults,
    children: totals.children + roomInput.children,
    childAges: [...totals.childAges, ...roomInput.childAges],
  }), { adults: 0, children: 0, childAges: [] as number[] });
  const details = normalizeRateDetails(rate);
  return {
    rateKey,
    rateType: stringValue(rate.rateType) || "BOOKABLE",
    hotelbedsHotelId: hotelCode,
    hotelName: stringValue(hotel.name) || `Hotel ${hotelCode}`,
    category: stringValue(hotel.categoryName) || stringValue(hotel.categoryCode),
    destination: stringValue(hotel.destinationName) || stringValue(hotel.destinationCode),
    address: stringValue(hotel.address),
    latitude: numberValue(hotel.latitude),
    longitude: numberValue(hotel.longitude),
    images: asArray(hotel.images).map((image) => stringValue(record(image).path)).filter((image): image is string => Boolean(image)),
    description: stringValue(hotel.description?.toString?.()) || stringValue(hotel.description),
    facilities: asArray(hotel.facilities).map((facility) => stringValue(record(facility).description) || stringValue(record(facility).name)).filter((item): item is string => Boolean(item)),
    roomType: stringValue(room.name) || stringValue(room.code),
    boardType: stringValue(rate.boardName) || stringValue(rate.boardCode),
    rooms: input.rooms.length,
    adults: occupancies.adults,
    children: occupancies.children,
    childAges: occupancies.childAges,
    price,
    currency: stringValue(rate.currency) || "EUR",
    cancellationPolicies: details.cancellationPolicies,
    rateCommentsId: details.rateCommentsId,
    rateComments: details.rateComments,
    refundable: details.refundable,
    hotelCode,
    provider: "HOTELBEDS",
    environment: hotelbedsEnvironment(),
  };
}

function descriptionContent(value: unknown): string | undefined {
  const item = record(value);
  return stringValue(item.content) || stringValue(value);
}

function contentImageUrl(value: unknown): string | undefined {
  const path = stringValue(value);
  if (!path) return undefined;
  return /^https?:\/\//i.test(path) ? path : `https://photos.hotelbeds.com/giata/${path.replace(/^\/+/, "")}`;
}

function normalizeContent(payload: unknown, hotelCode: string): HotelbedsContent {
  const body = record(payload);
  const raw = record(body.hotel);
  const hotel = Object.keys(raw).length ? raw : record(asArray(body.hotels)[0]);
  return {
    provider: "HOTELBEDS",
    environment: hotelbedsEnvironment(),
    hotelCode: stringValue(hotel.code) || hotelCode,
    name: descriptionContent(hotel.name),
    category: descriptionContent(record(hotel.category).description) || stringValue(hotel.categoryCode),
    address: descriptionContent(hotel.address),
    destination: descriptionContent(record(hotel.destination).name) || stringValue(hotel.destinationCode),
    latitude: numberValue(record(hotel.coordinates).latitude),
    longitude: numberValue(record(hotel.coordinates).longitude),
    images: asArray(hotel.images).map((image) => contentImageUrl(record(image).path)).filter((item): item is string => Boolean(item)),
    description: descriptionContent(hotel.description),
    facilities: asArray(hotel.facilities).map((item) => stringValue(record(item).facilityName) || descriptionContent(record(item).description)).filter((item): item is string => Boolean(item)),
    rooms: asArray(hotel.rooms).map((item) => {
      const room = record(item);
      return { code: stringValue(room.roomCode), name: stringValue(room.description), roomType: stringValue(room.roomType), facilities: asArray(room.roomFacilities).map((facility) => descriptionContent(record(facility).description)).filter((value): value is string => Boolean(value)) };
    }),
    boards: asArray(hotel.boards).map((item) => ({ code: stringValue(record(item).code), name: descriptionContent(record(item).description) })).filter((item) => Boolean(item.code || item.name)),
    pointsOfInterest: asArray(hotel.interestPoints).map((item) => ({ name: stringValue(record(item).poiName) || "", distance: numberValue(record(item).distance) })).filter((item) => Boolean(item.name)),
  };
}

function normalizeAvailability(payload: unknown, input: HotelbedsSearchInput): HotelbedsRate[] {
  const body = record(payload);
  const hotelsContainer = record(body.hotels);
  const hotels = asArray(hotelsContainer.hotels || body.hotels || body.hotel).map(record);
  const rates: HotelbedsRate[] = [];
  for (const hotel of hotels) {
    for (const room of asArray(hotel.rooms).map(record)) {
      for (const rate of asArray(room.rates).map(record)) {
        const normalized = normalizeRate(hotel, room, rate, input);
        if (normalized) rates.push(normalized);
      }
    }
  }
  return rates;
}

export class HotelbedsProvider {
  readonly name = "HOTELBEDS" as const;
  private readonly config = getHotelbedsConfig();
  readonly environment = hotelbedsEnvironment(this.config.baseUrl);

  constructor(private readonly fetchImpl: typeof fetch = fetch) {
    if (!this.config.apiKey || !this.config.secret) {
      throw new HotelbedsError(503, "not_configured", `Hotelbeds ${this.environment} credentials are not configured.`);
    }
  }

  private async request(path: string, method: "GET" | "POST" | "DELETE", body?: RecordValue, apiRoot = "hotel-api/1.0", timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const summary = requestSummary(path, method, body);
    const headers = {
      "Api-key": this.config.apiKey,
      "X-Signature": hotelbedsSignature(this.config.apiKey, this.config.secret),
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "Content-Type": "application/json",
    };
    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}/${apiRoot}${path}`, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      const text = await response.text();
      let payload: unknown = {};
      try { payload = text ? JSON.parse(text) : {}; } catch {
        logger.warn({ ...summary, status: response.status, ok: response.ok, responseHeaders: { contentType: response.headers.get("content-type"), contentLength: response.headers.get("content-length") }, responseBody: "<malformed-json>" }, "Hotelbeds response was malformed");
        throw new HotelbedsError(502, "invalid_response", "Hotelbeds returned malformed JSON.");
      }
      const safeResponse = responseSummary(payload);
      if (!response.ok) {
        logger.warn({ ...summary, status: response.status, ok: false, responseHeaders: { contentType: response.headers.get("content-type"), contentLength: response.headers.get("content-length"), server: response.headers.get("server") }, responseBody: safeResponse }, "Hotelbeds TEST request failed");
        throw new HotelbedsError(502, "upstream", `Hotelbeds ${this.environment} API request failed.`);
      }
      logger.info({ ...summary, status: response.status, ok: true, responseBody: safeResponse }, `Hotelbeds ${this.environment} request succeeded`);
      return payload;
    } catch (error) {
      if (error instanceof HotelbedsError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw new HotelbedsError(504, "timeout", `Hotelbeds ${this.environment} API request timed out.`);
      throw new HotelbedsError(502, "upstream", `Hotelbeds ${this.environment} API could not be reached.`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async health() {
    await this.request("/hotels", "POST", { stay: { checkIn: "2026-11-10", checkOut: "2026-11-11" }, destination: { code: "LON" }, occupancies: [{ rooms: 1, adults: 1, children: 0 }] });
    return { connected: true as const, provider: "HOTELBEDS" as const, environment: this.environment };
  }

  async availability(input: HotelbedsSearchInput) {
    const body: RecordValue = {
      stay: { checkIn: input.checkIn, checkOut: input.checkOut },
      occupancies: input.rooms.map((room) => ({ rooms: 1, adults: room.adults, children: room.children, ...(room.childAges.length ? { paxes: room.childAges.map((age) => ({ type: "CH", age })) } : {}) })),
      ...(input.destination ? { destination: { code: input.destination } } : {}),
      ...(input.hotelIds?.length ? { hotels: { hotel: input.hotelIds.map(Number).filter(Number.isFinite) } } : {}),
      ...(input.sourceMarket ? { sourceMarket: input.sourceMarket } : {}),
    };
    const payload = await this.request("/hotels", "POST", body, "hotel-api/1.0", 5_000);
    return normalizeAvailability(payload, input);
  }

  async checkRate(rateKey: string) {
    const payload = await this.request("/checkrates", "POST", { rooms: [{ rateKey }] }, "hotel-api/1.0", 15_000);
    const body = record(payload);
    const rawRate = record(body.rate);
    return { ...body, rate: { ...rawRate, ...normalizeRateDetails(rawRate), rateKey: stringValue(rawRate.rateKey) || rateKey } };
  }

  async booking(input: { rateKey: string; clientReference: string; holder: { name: string; surname: string; email?: string; phone?: string }; rooms: Array<{ roomId?: number; paxes: Array<{ roomId?: number; name: string; surname: string; type?: "AD" | "CH"; age?: number }> }>; remark?: string }) {
    const rooms = input.rooms.map((room, roomIndex) => ({ rateKey: input.rateKey, ...room, paxes: room.paxes.map((pax) => ({ ...pax, roomId: room.roomId || roomIndex + 1 })) }));
    return this.request("/bookings", "POST", { clientReference: input.clientReference, holder: input.holder, rooms, remark: input.remark, tolerance: 2 }, "hotel-api/1.0", HOTELBEDS_BOOKING_TIMEOUT_MS);
  }

  async bookingDetails(reference: string) {
    return this.request(`/bookings/${encodeURIComponent(reference)}`, "GET", undefined, "hotel-api/1.0", 60_000);
  }

  async cancel(reference: string) {
    return this.request(`/bookings/${encodeURIComponent(reference)}`, "DELETE", undefined, "hotel-api/1.0", 60_000);
  }

  async content(hotelCode: string) {
    const payload = await this.request(`/hotels/${encodeURIComponent(hotelCode)}/details?language=ENG&useSecondaryLanguage=true`, "GET", undefined, "hotel-content-api/1.0", 15_000);
    return normalizeContent(payload, hotelCode);
  }

  async rateCommentDetails(rateCommentsId: string, date: string) {
    return this.request(`/types/ratecommentdetails?code=${encodeURIComponent(rateCommentsId)}&date=${encodeURIComponent(date)}&language=ENG&useSecondaryLanguage=true`, "GET", undefined, "hotel-content-api/1.0", 15_000);
  }
}

export function hotelbedsVoucher(booking: RecordValue) {
  return {
    provider: "HOTELBEDS",
    environment: hotelbedsEnvironment(),
    hotelName: booking.hotelName,
    hotelCategory: booking.hotelCategory,
    hotelAddress: booking.hotelAddress,
    destination: booking.destination,
    leadGuest: booking.leadGuest,
    guests: booking.guests,
    childrenAges: booking.childrenAges,
    hotelbedsReference: booking.hotelbedsReference,
    zelevosReference: booking.zelevosReference,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    roomType: booking.roomType,
    boardType: booking.boardType,
    rateComments: booking.rateComments,
    cancellationPolicies: booking.cancellationPolicies,
    rooms: booking.rooms,
  };
}

function pdfText(value: unknown): string {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
}

export function hotelbedsVoucherPdf(booking: RecordValue): Buffer {
  const guests = asArray(booking.guests).map((guest, index) => {
    const item = record(guest);
    return `Guest ${index + 1}: ${String(item.name || "")} ${String(item.surname || "")} (${String(item.type || "AD")}${item.age !== undefined ? `, age ${String(item.age)}` : ""})`;
  });
  const policies = asArray(booking.cancellationPolicies).map((policy) => JSON.stringify(record(policy)));
  const lines = [
    "ZELEVOS HOTEL VOUCHER",
    `Status: ${booking.status || "CONFIRMED"}`,
    `Hotel: ${booking.hotelName || ""}`,
    `Category: ${booking.hotelCategory || ""}`,
    `Address: ${booking.hotelAddress || ""}`,
    `Destination: ${booking.destination || ""}`,
    `Hotelbeds reference: ${booking.hotelbedsReference || ""}`,
    `Zelevos reference: ${booking.zelevosReference || ""}`,
    `Lead guest: ${record(booking.holder).name || ""} ${record(booking.holder).surname || ""}`,
    ...guests,
    `Check-in: ${booking.checkIn || ""}`,
    `Check-out: ${booking.checkOut || ""}`,
    `Room type: ${booking.roomType || ""}`,
    `Board type: ${booking.boardType || ""}`,
    `Rate comments: ${booking.rateComments || ""}`,
    `Cancellation: ${policies.join(" | ")}`,
  ];
  const stream = ["BT", "/F1 11 Tf", "50 760 Td", ...lines.flatMap((line) => [`(${pdfText(line)}) Tj`, "0 -16 Td"]), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "ascii");
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

export { durationNights };