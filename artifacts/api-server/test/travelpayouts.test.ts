import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";

const {
  TravelpayoutsError,
  checkTravelpayoutsConnection,
  getTravelpayoutsFlightData,
} = await import("../src/services/travelpayouts");
const { default: app } = await import("../src/app");

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
  delete process.env.TRAVELPAYOUTS_API_TOKEN;
});

describe("Travelpayouts / Aviasales Data API", () => {
  it("fails safely when the token is missing", async () => {
    delete process.env.TRAVELPAYOUTS_API_TOKEN;

    await assert.rejects(
      () => checkTravelpayoutsConnection(),
      (error: unknown) => error instanceof TravelpayoutsError && error.code === "missing_secret" && error.statusCode === 503,
    );
  });

  it("uses the configured token in the documented header", async () => {
    process.env.TRAVELPAYOUTS_API_TOKEN = "test-travelpayouts-token";
    let requestUrl = "";
    let requestInit: RequestInit | undefined;

    const result = await checkTravelpayoutsConnection(async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
    });

    assert.deepEqual(result, {
      connected: true,
      provider: "travelpayouts",
      service: "aviasales-data-api",
    });
    assert.equal(requestUrl.includes("test-travelpayouts-token"), false);
    assert.equal(new Headers(requestInit?.headers).get("X-Access-Token"), "test-travelpayouts-token");
  });

  it("reports upstream API failures without exposing the token", async () => {
    process.env.TRAVELPAYOUTS_API_TOKEN = "test-travelpayouts-token";

    await assert.rejects(
      () => checkTravelpayoutsConnection(async () => new Response(JSON.stringify({ success: false, error: "denied" }), { status: 200 })),
      (error: unknown) => error instanceof TravelpayoutsError && error.code === "api_failure",
    );
  });

  it("requests documented prices_for_dates fields and caches the result", async () => {
    process.env.TRAVELPAYOUTS_API_TOKEN = "test-travelpayouts-token";
    let calls = 0;
    let requestUrl = "";
    const fetchMock = async (input: RequestInfo | URL) => {
      calls += 1;
      requestUrl = String(input);
      return new Response(JSON.stringify({
        success: true,
        data: [{ origin: "DEL", destination: "BOM", price: 4200, currency: "INR", airline: "AI", flight_number: "101", departure_at: "2026-10-12T08:00:00Z", transfers: 0 }],
      }), { status: 200 });
    };

    const query = { origin: "DEL", destination: "BOM", departureAt: "2026-10-12", currency: "INR" };
    const first = await getTravelpayoutsFlightData(query, fetchMock);
    const second = await getTravelpayoutsFlightData(query, fetchMock);

    assert.equal(calls, 1);
    assert.equal(new URL(requestUrl).pathname, "/aviasales/v3/prices_for_dates");
    assert.equal(new URL(requestUrl).searchParams.get("origin"), "DEL");
    assert.equal(new URL(requestUrl).searchParams.get("destination"), "BOM");
    assert.equal(new URL(requestUrl).searchParams.get("departure_at"), "2026-10-12");
    assert.equal(first.data[0].airline, "AI");
    assert.equal(second.cached, true);
  });

  it("maps an aborted request to a safe timeout failure", async () => {
    process.env.TRAVELPAYOUTS_API_TOKEN = "test-travelpayouts-token";

    await assert.rejects(
      () => checkTravelpayoutsConnection(async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }), 5),
      (error: unknown) => error instanceof TravelpayoutsError && error.code === "network_failure" && error.statusCode === 504,
    );
  });

  it("returns only safe health data from the API endpoint", async () => {
    process.env.TRAVELPAYOUTS_API_TOKEN = "test-travelpayouts-token";
    globalThis.fetch = async (input, init) => {
      if (String(input).startsWith("https://api.travelpayouts.com/")) {
        assert.equal(new Headers(init?.headers).get("X-Access-Token"), "test-travelpayouts-token");
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }
      return originalFetch(input, init);
    };

    const response = await originalFetch(`${baseUrl}/api/travelpayouts/health`);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      connected: true,
      provider: "travelpayouts",
      service: "aviasales-data-api",
    });
    assert.equal(JSON.stringify(body).includes("test-travelpayouts-token"), false);
  });

  it("returns safe data-only flight results from the API endpoint", async () => {
    process.env.TRAVELPAYOUTS_API_TOKEN = "test-travelpayouts-token";
    globalThis.fetch = async (input, init) => {
      if (String(input).startsWith("https://api.travelpayouts.com/")) {
        assert.equal(new Headers(init?.headers).get("X-Access-Token"), "test-travelpayouts-token");
        return new Response(JSON.stringify({ success: true, data: [{ origin: "DEL", destination: "BOM", price: 4200 }] }), { status: 200 });
      }
      return originalFetch(input, init);
    };

    const response = await originalFetch(`${baseUrl}/api/flights/data?from=DEL&to=BOM&departure=2026-11-12`);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(body.mode, "DATA");
    assert.equal(body.provider, "travelpayouts");
    assert.deepEqual(body.data, [{ origin: "DEL", destination: "BOM", price: 4200 }]);
    assert.equal(JSON.stringify(body).includes("test-travelpayouts-token"), false);
  });
});
