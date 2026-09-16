/**
 * Ignav Flight API — Automated Tests
 *
 * All Ignav HTTP calls are mocked via globalThis.fetch so no real network
 * requests are made. The IGNAV_API_KEY is set to a safe test value and
 * verified never to appear in any response body.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";

// Prevent any database connection attempt in the test environment
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-ignav-test";

// Import BEFORE setting IGNAV_API_KEY so we can test the "missing key" path
const {
  IgnavError,
  IgnavFlightProvider,
  getIgnavConfig,
} = await import("../src/services/ignav");
const { default: app } = await import("../src/app");

const TEST_KEY = "ignav_test_key_SAFE_NOT_REAL";
const originalFetch = globalThis.fetch;
let server: ReturnType<typeof app.listen>;
let baseUrl = "";

before(() => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server.close();
  globalThis.fetch = originalFetch;
  delete process.env.IGNAV_API_KEY;
});

// ---------------------------------------------------------------------------
// Helper: build a minimal valid Ignav fare response
// ---------------------------------------------------------------------------
function makeIgnavFare(override: Record<string, unknown> = {}) {
  return {
    ignav_id: "fare_abc123",
    price: 12500,
    currency: "INR",
    airline: "IndiGo",
    flight_number: "6E-2187",
    cabin: "Economy",
    departure: "2026-11-01T06:10:00+05:30",
    arrival: "2026-11-01T08:35:00+05:30",
    duration: "2h 25m",
    origin: "DEL",
    destination: "BOM",
    ...override,
  };
}

// ---------------------------------------------------------------------------
// Mocked fetch factory
// ---------------------------------------------------------------------------
function mockIgnavFetch(
  path: string,
  responseBody: unknown,
  statusCode = 200,
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.startsWith("https://ignav.com/api")) {
      // Verify the key is in the header, not the URL
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("x-api-key"), TEST_KEY, "API key must be in x-api-key header");
      assert.equal(url.includes(TEST_KEY), false, "API key must not appear in the URL");
      if (url.endsWith(path) || url.includes(path)) {
        return new Response(JSON.stringify(responseBody), {
          status: statusCode,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return originalFetch(input, init);
  };
}

// ===========================================================================
// UNIT TESTS — IgnavFlightProvider (direct, no HTTP server)
// ===========================================================================
describe("IgnavFlightProvider unit tests", () => {
  it("throws IgnavError(503) when IGNAV_API_KEY is missing", () => {
    delete process.env.IGNAV_API_KEY;
    assert.throws(
      () => new IgnavFlightProvider(""),
      (error: unknown) => error instanceof IgnavError && error.statusCode === 503,
    );
  });

  it("getIgnavConfig() returns empty string when key is absent", () => {
    delete process.env.IGNAV_API_KEY;
    const config = getIgnavConfig();
    assert.equal(config.apiKey, "");
  });

  it("getIgnavConfig() returns trimmed key from env", () => {
    process.env.IGNAV_API_KEY = `  ${TEST_KEY}  `;
    const config = getIgnavConfig();
    assert.equal(config.apiKey, TEST_KEY);
    delete process.env.IGNAV_API_KEY;
  });

  it("airports() normalizes items from payload.data array", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    const payload = {
      data: [
        { iata: "DEL", name: "Indira Gandhi International", city: "Delhi" },
        { iata: "BOM", name: "Chhatrapati Shivaji Maharaj", city: "Mumbai" },
      ],
    };
    globalThis.fetch = mockIgnavFetch("/airports", payload);
    const provider = new IgnavFlightProvider(TEST_KEY);
    const airports = await provider.airports("del");
    assert.equal(airports.length, 2);
    assert.equal((airports[0] as Record<string, unknown>).iata, "DEL");
    globalThis.fetch = originalFetch;
  });

  it("airports() accepts a search query in the URL", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    let capturedUrl = "";
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      capturedUrl = String(input);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("x-api-key"), TEST_KEY);
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    };
    const provider = new IgnavFlightProvider(TEST_KEY);
    await provider.airports("delhi");
    assert.ok(capturedUrl.includes("q=delhi"), "query param should be in URL");
    assert.equal(capturedUrl.includes(TEST_KEY), false, "key must not be in URL");
    globalThis.fetch = originalFetch;
  });

  it("search() calls /fares/one-way for one-way trips and normalizes results", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    let capturedPath = "";
    let capturedBody: unknown;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      capturedPath = String(input);
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("x-api-key"), TEST_KEY);
      return new Response(JSON.stringify({ data: [makeIgnavFare()] }), { status: 200 });
    };
    const provider = new IgnavFlightProvider(TEST_KEY);
    const results = await provider.search({ from: "DEL", to: "BOM", departure: "2026-11-01", travellers: 1, cabin: "Economy" });
    assert.ok(capturedPath.endsWith("/fares/one-way"), "should use /fares/one-way endpoint");
    assert.equal((capturedBody as Record<string, unknown>)?.origin, "DEL");
    assert.equal(results.length, 1);
    const first = results[0];
    assert.equal(first.ignavId, "fare_abc123");
    assert.equal(first.id, "ignav:fare_abc123");
    assert.equal(first.price, 12500);
    assert.equal(first.airline, "IndiGo");
    assert.equal(first.currency, "INR");
    assert.equal(first.mode, "LIVE");
    assert.equal(first.externalBooking, true);
    assert.equal(first.provider, "Ignav Flight API");
    // Key must not leak in serialized offer
    assert.equal(JSON.stringify(first).includes(TEST_KEY), false);
    globalThis.fetch = originalFetch;
  });

  it("search() calls /fares/round-trip when returnDate is provided", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    let capturedPath = "";
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      capturedPath = String(input);
      return new Response(JSON.stringify({ data: [makeIgnavFare()] }), { status: 200 });
    };
    const provider = new IgnavFlightProvider(TEST_KEY);
    await provider.search({ from: "DEL", to: "BOM", departure: "2026-11-01", returnDate: "2026-11-08", travellers: 1 });
    assert.ok(capturedPath.endsWith("/fares/round-trip"), "should use /fares/round-trip endpoint");
    globalThis.fetch = originalFetch;
  });

  it("flexibleSearch() calls /fares/search and normalizes results", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    let capturedPath = "";
    let capturedBody: unknown;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      capturedPath = String(input);
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(JSON.stringify({ data: [makeIgnavFare({ origin: "DEL", destination: "SIN" })] }), { status: 200 });
    };
    const provider = new IgnavFlightProvider(TEST_KEY);
    const slices = [
      { origin: "DEL", destination: "SIN", departure: "2026-11-01" },
      { origin: "SIN", destination: "SYD", departure: "2026-11-05" },
    ];
    const results = await provider.flexibleSearch(slices, { travellers: 2, cabin: "Business" });
    assert.ok(capturedPath.endsWith("/fares/search"), "should use /fares/search endpoint");
    assert.deepEqual((capturedBody as Record<string, unknown>)?.legs, slices.map((slice) => ({ origin: slice.origin, destination: slice.destination, departure_date: slice.departure })));
    assert.equal((capturedBody as Record<string, unknown>)?.adults, 2);
    assert.equal(results.length, 1);
    assert.equal(results[0].mode, "LIVE");
    globalThis.fetch = originalFetch;
  });

  it("bookingLink() returns url and ignavId", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    globalThis.fetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ itinerary: {}, booking_options: [{ legs: ["outbound"], links: [{ provider_name: "Example Airline", provider_type: "airline", url: "https://airline.com/book/fare_abc123" }] }] }), { status: 200 });
    const provider = new IgnavFlightProvider(TEST_KEY);
    const result = await provider.bookingLink("fare_abc123");
    assert.equal(result.ignavId, "fare_abc123");
    assert.ok(result.url.startsWith("https://"), "URL should be a real external URL");
    globalThis.fetch = originalFetch;
  });

  it("throws IgnavError(502) when Ignav returns no booking URL", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    globalThis.fetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ itinerary: {}, booking_options: [] }), { status: 200 });
    const provider = new IgnavFlightProvider(TEST_KEY);
    await assert.rejects(
      () => provider.bookingLink("fare_abc123"),
      (error: unknown) => error instanceof IgnavError && error.statusCode === 502,
    );
    globalThis.fetch = originalFetch;
  });

  it("maps AbortError to IgnavError(504) timeout", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    };
    const provider = new IgnavFlightProvider(TEST_KEY);
    await assert.rejects(
      () => provider.airports("del"),
      (error: unknown) => error instanceof IgnavError && error.statusCode === 504,
    );
    globalThis.fetch = originalFetch;
  });

  it("maps upstream 500 to IgnavError(502) bad gateway", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    globalThis.fetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    const provider = new IgnavFlightProvider(TEST_KEY);
    await assert.rejects(
      () => provider.airports("del"),
      (error: unknown) => error instanceof IgnavError && error.statusCode === 502,
    );
    globalThis.fetch = originalFetch;
  });

  it("normalizeFare omits baggage when Ignav does not return it", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    const fareWithoutBaggage = makeIgnavFare();
    delete (fareWithoutBaggage as Record<string, unknown>).baggage;
    globalThis.fetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ data: [fareWithoutBaggage] }), { status: 200 });
    const provider = new IgnavFlightProvider(TEST_KEY);
    const results = await provider.search({ from: "DEL", to: "BOM", departure: "2026-11-01" });
    // baggage should be empty string (falsy), not "Baggage details unavailable"
    assert.ok(results.length === 1);
    assert.notEqual(results[0].baggage, "Baggage details unavailable");
    globalThis.fetch = originalFetch;
  });

  it("normalizeFare includes baggage when Ignav returns it", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    const fareWithBaggage = makeIgnavFare({ baggage: "20 kg check-in included" });
    globalThis.fetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ data: [fareWithBaggage] }), { status: 200 });
    const provider = new IgnavFlightProvider(TEST_KEY);
    const results = await provider.search({ from: "DEL", to: "BOM", departure: "2026-11-01" });
    assert.equal(results[0].baggage, "20 kg check-in included");
    globalThis.fetch = originalFetch;
  });

  it("revalidate always returns not-valid for Ignav fares (external booking only)", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    const provider = new IgnavFlightProvider(TEST_KEY);
    const result = await provider.revalidate("ignav:fare_abc123", 12500);
    assert.equal(result.valid, false);
    assert.ok(result.message && result.message.length > 0);
  });

  it("createBooking throws IgnavError(501) — Ignav does not issue tickets", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    const provider = new IgnavFlightProvider(TEST_KEY);
    await assert.rejects(
      () => provider.createBooking({
        offerId: "ignav:fare_abc123",
        passengers: [],
        contact: { email: "test@example.com", phone: "9876543210" },
        idempotencyKey: "test-key",
      }),
      (error: unknown) => error instanceof IgnavError && error.statusCode === 501,
    );
  });
});

// ===========================================================================
// INTEGRATION TESTS — HTTP API endpoints via Express
// ===========================================================================
describe("Ignav HTTP API endpoints", () => {
  it("GET /api/ignav/health → 503 when key is missing", async () => {
    delete process.env.IGNAV_API_KEY;
    const res = await originalFetch(`${baseUrl}/api/ignav/health`);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(res.status, 503);
    assert.equal(body.connected, false);
    assert.equal(body.provider, "ignav");
  });

  it("GET /api/ignav/health → 200 connected when key is set and Ignav responds", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.startsWith("https://ignav.com/api")) {
        assert.equal(new Headers(init?.headers).get("x-api-key"), TEST_KEY);
        assert.equal(url.includes(TEST_KEY), false, "Key must not appear in URL");
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return originalFetch(input, init);
    };
    const res = await originalFetch(`${baseUrl}/api/ignav/health`);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(res.status, 200);
    assert.equal(body.connected, true);
    assert.equal(body.provider, "ignav");
    assert.equal(JSON.stringify(body).includes(TEST_KEY), false, "Key must not appear in response");
    globalThis.fetch = originalFetch;
  });

  it("GET /api/ignav/airports → returns normalized airport list", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.startsWith("https://ignav.com/api")) {
        assert.equal(new Headers(init?.headers).get("x-api-key"), TEST_KEY);
        return new Response(JSON.stringify({
          data: [{ iata: "DEL", name: "Indira Gandhi International", city: "Delhi" }],
        }), { status: 200 });
      }
      return originalFetch(input, init);
    };
    const res = await originalFetch(`${baseUrl}/api/ignav/airports?q=delhi`);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(res.status, 200);
    assert.equal(body.provider, "ignav");
    assert.ok(Array.isArray(body.airports));
    assert.equal((body.airports as unknown[]).length, 1);
    assert.equal(JSON.stringify(body).includes(TEST_KEY), false, "Key must not appear in response");
    globalThis.fetch = originalFetch;
  });

  it("POST /api/ignav/search (one-way) → returns LIVE_FARE_DATA results", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.startsWith("https://ignav.com/api")) {
        assert.ok(url.endsWith("/fares/one-way"), "Should call /fares/one-way");
        return new Response(JSON.stringify({ data: [makeIgnavFare()] }), { status: 200 });
      }
      return originalFetch(input, init);
    };
    const res = await originalFetch(`${baseUrl}/api/ignav/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripType: "one-way", from: "DEL", to: "BOM", departure: "2026-11-01", travellers: 1, cabin: "Economy" }),
    });
    const body = await res.json() as Record<string, unknown>;
    assert.equal(res.status, 200);
    assert.equal(body.provider, "Ignav Flight API");
    assert.equal(body.mode, "LIVE");
    assert.equal(body.dataSource, "LIVE_FARE_DATA");
    assert.equal(body.bookingType, "EXTERNAL_BOOKING");
    assert.ok(Array.isArray(body.results));
    const results = body.results as Record<string, unknown>[];
    assert.equal(results.length, 1);
    assert.equal(results[0].ignavId, "fare_abc123");
    assert.equal(results[0].externalBooking, true);
    assert.equal(results[0].mode, "LIVE");
    assert.equal(JSON.stringify(body).includes(TEST_KEY), false, "Key must not appear in response");
    globalThis.fetch = originalFetch;
  });

  it("POST /api/ignav/search (round-trip) → calls /fares/round-trip", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    let calledPath = "";
    globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.startsWith("https://ignav.com/api")) {
        calledPath = url;
        return new Response(JSON.stringify({ data: [makeIgnavFare()] }), { status: 200 });
      }
      return originalFetch(input, _init);
    };
    const res = await originalFetch(`${baseUrl}/api/ignav/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripType: "round-trip", from: "DEL", to: "BOM", departure: "2026-11-01", returnDate: "2026-11-08", travellers: 2, cabin: "Business" }),
    });
    assert.equal(res.status, 200);
    assert.ok(calledPath.endsWith("/fares/round-trip"), "Should call /fares/round-trip");
    globalThis.fetch = originalFetch;
  });

  it("POST /api/ignav/search (flexible) → calls /fares/search", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    let calledPath = "";
    globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.startsWith("https://ignav.com/api")) {
        calledPath = url;
        return new Response(JSON.stringify({ data: [makeIgnavFare({ origin: "DEL", destination: "SIN" })] }), { status: 200 });
      }
      return originalFetch(input, _init);
    };
    const res = await originalFetch(`${baseUrl}/api/ignav/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripType: "flexible",
        slices: [{ origin: "DEL", destination: "SIN", departure: "2026-11-01" }, { origin: "SIN", destination: "SYD", departure: "2026-11-05" }],
        travellers: 1,
        cabin: "Economy",
      }),
    });
    assert.equal(res.status, 200);
    assert.ok(calledPath.endsWith("/fares/search"), "Should call /fares/search");
    globalThis.fetch = originalFetch;
  });

  it("POST /api/ignav/search → 400 for invalid request body", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    const res = await originalFetch(`${baseUrl}/api/ignav/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripType: "one-way" }), // missing required fields
    });
    assert.equal(res.status, 400);
  });

  it("POST /api/ignav/booking-links → returns booking URL and notice", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.startsWith("https://ignav.com/api")) {
        assert.equal(new Headers(init?.headers).get("x-api-key"), TEST_KEY);
        return new Response(JSON.stringify({ itinerary: {}, booking_options: [{ legs: ["outbound"], links: [{ provider_name: "Example Airline", provider_type: "airline", url: "https://airline.com/book/fare_abc123" }] }] }), { status: 200 });
      }
      return originalFetch(input, init);
    };
    const res = await originalFetch(`${baseUrl}/api/ignav/booking-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ignavId: "fare_abc123" }),
    });
    const body = await res.json() as Record<string, unknown>;
    assert.equal(res.status, 200);
    assert.equal(body.provider, "ignav");
    assert.equal(body.mode, "EXTERNAL_BOOKING");
    assert.ok(typeof body.url === "string" && body.url.startsWith("https://"), "Must return external URL");
    assert.ok(typeof body.notice === "string", "Must include external booking notice");
    assert.equal(JSON.stringify(body).includes(TEST_KEY), false, "Key must not appear in response");
    globalThis.fetch = originalFetch;
  });

  it("POST /api/ignav/booking-links → 400 when ignavId is missing", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    const res = await originalFetch(`${baseUrl}/api/ignav/booking-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  it("GET /api/ignav/health → 503 when upstream returns 401", async () => {
    process.env.IGNAV_API_KEY = TEST_KEY;
    globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.startsWith("https://ignav.com/api")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      return originalFetch(input, _init);
    };
    const res = await originalFetch(`${baseUrl}/api/ignav/health`);
    const body = await res.json() as Record<string, unknown>;
    // Should return non-200 status
    assert.notEqual(res.status, 200);
    assert.equal(body.connected, false);
    globalThis.fetch = originalFetch;
  });
});
