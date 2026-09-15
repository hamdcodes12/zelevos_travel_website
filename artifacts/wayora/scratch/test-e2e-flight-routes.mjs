import assert from "node:assert/strict";

const API_BASE = "http://127.0.0.1:8080";
const VITE_BASE = "http://127.0.0.1:3000";

async function main() {
  console.log("=== WAYORA FLIGHT SEARCH & AIRPORT AUTOCOMPLETE E2E VERIFICATION ===");

  // 1. Vite frontend health
  const viteRes = await fetch(VITE_BASE);
  assert.equal(viteRes.status, 200, "Vite frontend should respond with 200");
  const viteHtml = await viteRes.text();
  assert.ok(viteHtml.includes("<div id=\"root\">"), "Vite should serve React root");
  console.log("✔ 1. Vite frontend is alive and serving index.html at http://localhost:3000");

  // 2. Provider status
  const provRes = await fetch(`${API_BASE}/api/providers/status`);
  assert.equal(provRes.status, 200);
  const provData = await provRes.json();
  console.log(`✔ 2. Provider status: flights=${provData.status.flights}, mode=${provData.mode.flights}`);

  // 3. Airport Autocomplete Endpoint
  const queries = [
    { q: "del", expectedIata: "DEL", expectedCity: "Delhi" },
    { q: "mum", expectedIata: "BOM", expectedCity: "Mumbai" },
    { q: "bangalore", expectedIata: "BLR", expectedCity: "Bengaluru" },
    { q: "goa", expectedIata: "GOI", expectedCount: 2 }, // GOI & GOX
    { q: "srinagar", expectedIata: "SXR", expectedCity: "Srinagar" },
    { q: "chandigarh", expectedIata: "IXC", expectedCity: "Chandigarh" },
    { q: "jaipur", expectedIata: "JAI", expectedCity: "Jaipur" },
    { q: "amritsar", expectedIata: "ATQ", expectedCity: "Amritsar" },
    { q: "leh", expectedIata: "IXL", expectedCity: "Leh" },
    { q: "guwahati", expectedIata: "GAU", expectedCity: "Guwahati" },
    { q: "dubai", expectedIata: "DXB", expectedCity: "Dubai" },
    { q: "london", expectedIata: "LHR", expectedCity: "London" },
    { q: "singapore", expectedIata: "SIN", expectedCity: "Singapore" },
  ];

  for (const { q, expectedIata, expectedCity, expectedCount } of queries) {
    const res = await fetch(`${API_BASE}/api/flights/airports?q=${encodeURIComponent(q)}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.results), `Results must be an array for query ${q}`);
    assert.ok(data.results.length > 0, `Results must not be empty for query ${q}`);
    const match = data.results.find((a) => a.iata === expectedIata);
    assert.ok(match, `Airport ${expectedIata} must be present in search results for query '${q}'`);
    if (expectedCity) {
      assert.ok(match.city.includes(expectedCity), `Expected ${match.city} to include ${expectedCity}`);
    }
    if (expectedCount) {
      assert.ok(data.results.length >= expectedCount, `Expected at least ${expectedCount} airports for query '${q}'`);
    }
    console.log(`✔ Airport query '${q}' -> matched ${match.city} (${match.iata}) - ${match.name}`);
  }

  // 4. Exclude parameter in Autocomplete
  const excludeRes = await fetch(`${API_BASE}/api/flights/airports?q=delhi&exclude=DEL`);
  const excludeData = await excludeRes.json();
  const foundDel = excludeData.results.find((a) => a.iata === "DEL");
  assert.equal(foundDel, undefined, "DEL must be excluded when exclude=DEL");
  console.log("✔ Exclude filter correctly omits origin airport from destination dropdown");

  // 5. Duplicate route rejection (DEL -> DEL)
  const dupRes = await fetch(`${API_BASE}/api/flights/search?from=DEL&to=DEL`);
  assert.equal(dupRes.status, 400);
  const dupData = await dupRes.json();
  assert.match(dupData.message, /Origin and destination cannot be the same airport/i);
  console.log(`✔ Same origin/destination rejection: 400 '${dupData.message}'`);

  // 6. Real Indian route flight searches
  const routes = [
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

  for (const route of routes) {
    const res = await fetch(`${API_BASE}/api/flights/search?from=${route.from}&to=${route.to}&cabin=Economy&travellers=1`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.results), "Results must be an array");
    assert.ok(data.results.length >= 3, `Expected multiple flight options for ${route.name}`);

    for (const offer of data.results) {
      assert.equal(offer.from, route.from);
      assert.equal(offer.to, route.to);
      assert.ok(offer.airline);
      assert.ok(offer.flightNumber);
      assert.ok(offer.price > 0);
      assert.equal(offer.currency, "INR");
      assert.ok(offer.baggage);
      assert.ok(offer.cabin || offer.cabinClass);
      assert.ok(Array.isArray(offer.segments));
      assert.ok(offer.segments.length >= 1);
      assert.equal(offer.segments[0].origin, route.from);
      assert.equal(offer.segments[offer.segments.length - 1].destination, route.to);
    }
    console.log(`✔ Route ${route.name} (${route.from} -> ${route.to}): found ${data.results.length} offers (cheapest: ₹${Math.min(...data.results.map(o => o.price)).toLocaleString("en-IN")})`);
  }

  // 7. Connecting flight segment breakdown (DEL -> BOM -> GOI)
  const connectingRes = await fetch(`${API_BASE}/api/flights/search?from=DEL&to=GOI`);
  const connectingData = await connectingRes.json();
  const connectingOffer = connectingData.results.find((o) => o.stops === 1);
  assert.ok(connectingOffer, "Should include a 1-stop connecting flight offer");
  assert.equal(connectingOffer.segments.length, 2, "Connecting flight must have 2 segments");
  const [seg1, seg2] = connectingOffer.segments;
  assert.equal(seg1.origin, "DEL");
  assert.equal(seg2.destination, "GOI");
  assert.equal(seg1.destination, seg2.origin, "Segment 1 destination must match Segment 2 origin");
  console.log(`✔ Connecting flight verification: ${seg1.carrier} ${seg1.flightNumber} (${seg1.origin} -> ${seg1.destination}) connecting to ${seg2.flightNumber} (${seg2.origin} -> ${seg2.destination})`);

  console.log("\n=======================================================");
  console.log("ALL FLIGHT SEARCH & AIRPORT AUTOCOMPLETE E2E TESTS PASSED!");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("E2E Verification Failed:", err);
  process.exit(1);
});
