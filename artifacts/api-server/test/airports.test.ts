import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-airports-test";

const { default: app } = await import("../src/app");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.close();
});

async function api(path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

describe("Airport Autocomplete & Indian Routes Flight Search", () => {
  describe("1. Airport Autocomplete Endpoint (/api/flights/airports)", () => {
    it("returns top Indian airports when query is empty", async () => {
      const { response, body } = await api("/api/flights/airports");
      assert.equal(response.status, 200);
      assert.ok(Array.isArray(body.airports));
      assert.ok(body.airports.length > 5);
      const iatas = body.airports.map((a: any) => a.iata);
      assert.ok(iatas.includes("DEL"));
      assert.ok(iatas.includes("BOM"));
      assert.ok(iatas.includes("BLR"));
    });

    it("searches by city name ('delhi' -> DEL)", async () => {
      const { response, body } = await api("/api/flights/airports?q=delhi");
      assert.equal(response.status, 200);
      assert.ok(body.airports.length > 0);
      assert.equal(body.airports[0].iata, "DEL");
      assert.equal(body.airports[0].city, "Delhi");
      assert.equal(body.airports[0].country, "India");
    });

    it("searches by IATA code ('BLR' -> Kempegowda Bengaluru)", async () => {
      const { response, body } = await api("/api/flights/airports?q=blr");
      assert.equal(response.status, 200);
      assert.ok(body.airports.length > 0);
      assert.equal(body.airports[0].iata, "BLR");
      assert.equal(body.airports[0].city, "Bengaluru");
    });

    it("searches Goa returning both GOI and GOX", async () => {
      const { response, body } = await api("/api/flights/airports?q=goa");
      assert.equal(response.status, 200);
      assert.ok(body.airports.length >= 2);
      const iatas = body.airports.map((a: any) => a.iata);
      assert.ok(iatas.includes("GOI"), "Should include Dabolim GOI");
      assert.ok(iatas.includes("GOX"), "Should include Manohar GOX");
    });

    it("supports Tier 2/3 and regional Indian airports (SXR, IXC, JAI, ATQ, IXL)", async () => {
      const queries = [
        { q: "srinagar", expected: "SXR" },
        { q: "chandigarh", expected: "IXC" },
        { q: "jaipur", expected: "JAI" },
        { q: "amritsar", expected: "ATQ" },
        { q: "leh", expected: "IXL" },
        { q: "patna", expected: "PAT" },
        { q: "guwahati", expected: "GAU" },
      ];

      for (const { q, expected } of queries) {
        const { response, body } = await api(`/api/flights/airports?q=${q}`);
        assert.equal(response.status, 200);
        const match = body.airports.find((a: any) => a.iata === expected);
        assert.ok(match, `Expected ${expected} for query '${q}'`);
      }
    });

    it("supports international destinations (DXB, SIN, LHR)", async () => {
      const { response, body } = await api("/api/flights/airports?q=dubai");
      assert.equal(response.status, 200);
      assert.ok(body.airports.length > 0);
      assert.equal(body.airports[0].iata, "DXB");
    });

    it("excludes selected airport using 'exclude' query param", async () => {
      const { response, body } = await api("/api/flights/airports?q=delhi&exclude=DEL");
      assert.equal(response.status, 200);
      const match = body.airports.find((a: any) => a.iata === "DEL");
      assert.equal(match, undefined, "DEL should be excluded");
    });
  });

  // PARKED (Phase 1, 2026-09-19): Flight search tests parked per Wayora_PRD_Without_APIs.
  describe.skip("2. Route Validation (/api/flights/search) (PARKED - Phase 1: flight supplier parked)", () => {
    it("rejects identical origin and destination (DEL to DEL) with 400", async () => {
      const { response, body } = await api("/api/flights/search?from=DEL&to=DEL");
      assert.equal(response.status, 400);
      assert.match(body.message, /Origin and destination cannot be the same airport/i);
    });

    it("rejects missing origin or destination with 400", async () => {
      const { response } = await api("/api/flights/search?from=DEL&to=");
      assert.equal(response.status, 400);
    });
  });

  describe.skip("3. Comprehensive Indian Routes Flight Search (PARKED - Phase 1: flight supplier parked)", () => {
    const routesToTest = [
      { from: "DEL", to: "BOM", name: "Delhi to Mumbai" },
      { from: "BOM", to: "DEL", name: "Mumbai to Delhi" },
      { from: "DEL", to: "BLR", name: "Delhi to Bengaluru" },
      { from: "BOM", to: "GOI", name: "Mumbai to Goa" },
      { from: "DEL", to: "GOI", name: "Delhi to Goa (includes connecting)" },
      { from: "JAI", to: "DEL", name: "Jaipur to Delhi" },
      { from: "SXR", to: "DEL", name: "Srinagar to Delhi" },
      { from: "BLR", to: "HYD", name: "Bengaluru to Hyderabad" },
      { from: "IXC", to: "DEL", name: "Chandigarh to Delhi" },
    ];

    for (const route of routesToTest) {
      it(`searches flights for ${route.name} (${route.from} -> ${route.to})`, async () => {
        const { response, body } = await api(`/api/flights/search?from=${route.from}&to=${route.to}`);
        assert.equal(response.status, 200);
        assert.ok(Array.isArray(body.results));
        assert.ok(body.results.length >= 3, `Expected multiple flight options for ${route.from}->${route.to}`);

        for (const offer of body.results) {
          assert.equal(offer.from, route.from);
          assert.equal(offer.to, route.to);
          assert.ok(offer.airline, "Airline must be specified");
          assert.ok(offer.flightNumber, "Flight number must be specified");
          assert.ok(offer.price > 0, "Price must be greater than 0");
          assert.equal(offer.currency, "INR");
          assert.ok(offer.baggage, "Baggage allowance must be present");
          assert.ok(offer.cabin, "Cabin class must be present");
          assert.ok(Array.isArray(offer.segments), "Segments must be an array");
          assert.ok(offer.segments.length >= 1, "Must have at least one segment");

          // Validate segments match overall journey
          assert.equal(offer.segments[0].origin, route.from);
          assert.equal(offer.segments[offer.segments.length - 1].destination, route.to);
        }
      });
    }

    it("validates connecting flight segments (DEL -> BOM -> GOI)", async () => {
      const { response, body } = await api("/api/flights/search?from=DEL&to=GOI");
      assert.equal(response.status, 200);

      const connecting = body.results.find((f: any) => f.stops === 1);
      assert.ok(connecting, "Expected at least one 1-stop connecting flight offer");
      assert.equal(connecting.segments.length, 2, "1-stop flight must have exactly 2 segments");

      const [seg1, seg2] = connecting.segments;
      assert.equal(seg1.origin, "DEL");
      assert.equal(seg2.destination, "GOI");
      assert.equal(seg1.destination, seg2.origin, "Connecting layover airport must match between segments");
      assert.ok(seg1.flightNumber, "Segment 1 must have flight number");
      assert.ok(seg2.flightNumber, "Segment 2 must have flight number");
    });
  });
});
