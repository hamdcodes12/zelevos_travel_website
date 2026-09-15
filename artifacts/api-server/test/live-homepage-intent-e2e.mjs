import assert from "node:assert/strict";
import { detectHomepageIntent, normalizeCityOrCode } from "../../wayora/src/lib/intent.ts";

async function main() {
  console.log("=== Testing Wayora Homepage Flight Intent & Search Flow ===\n");

  // CASE 1: User types "Flight"
  console.log("Testing Case 1: User types 'Flight'...");
  const intent1 = detectHomepageIntent("Flight");
  assert.equal(intent1.type, "flight", "Case 1 must detect flight intent");
  assert.equal(intent1.origin, undefined, "Case 1 origin should be empty/undefined");
  assert.equal(intent1.destination, undefined, "Case 1 destination should be empty/undefined");
  console.log("✓ Case 1 Passed: Detected flight intent without prefilled origin/dest (ready for empty input)\n");

  // CASE 2: User types "Delhi to Mumbai flight"
  console.log("Testing Case 2: User types 'Delhi to Mumbai flight'...");
  const intent2 = detectHomepageIntent("Delhi to Mumbai flight");
  assert.equal(intent2.type, "flight", "Case 2 must detect flight intent");
  assert.equal(intent2.origin, "DEL", "Case 2 origin must be DEL");
  assert.equal(intent2.destination, "BOM", "Case 2 destination must be BOM");
  console.log("✓ Case 2 Passed: Detected flight intent with origin=DEL, destination=BOM\n");

  // CASE 3: User types "Flight from Delhi to Mumbai tomorrow"
  console.log("Testing Case 3: User types 'Flight from Delhi to Mumbai tomorrow'...");
  const intent3 = detectHomepageIntent("Flight from Delhi to Mumbai tomorrow");
  assert.equal(intent3.type, "flight");
  assert.equal(intent3.origin, "DEL");
  assert.equal(intent3.destination, "BOM");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  assert.equal(intent3.departureDate, tomorrow.toISOString().split("T")[0]);
  console.log(`✓ Case 3 Passed: Detected flight intent with tomorrow's date (${intent3.departureDate})\n`);

  // CASE 4: User types "Delhi Mumbai flight for 2 people"
  console.log("Testing Case 4: User types 'Delhi Mumbai flight for 2 people'...");
  const intent4 = detectHomepageIntent("Delhi Mumbai flight for 2 people");
  assert.equal(intent4.type, "flight");
  assert.equal(intent4.origin, "DEL");
  assert.equal(intent4.destination, "BOM");
  assert.equal(intent4.passengers, 2);
  console.log("✓ Case 4 Passed: Detected flight intent with passengers=2\n");

  // Additional Flight Queries
  console.log("Testing variations: 'book a flight', 'find flights', 'search flights'...");
  for (const q of ["book a flight", "find flights", "search flights"]) {
    const it = detectHomepageIntent(q);
    assert.equal(it.type, "flight", `${q} must detect flight intent`);
  }
  console.log("✓ Variations Passed\n");

  // CASE 5: User types normal trip request: "Plan my honeymoon in Goa for 5 days"
  console.log("Testing Case 5: Normal trip 'Plan my honeymoon in Goa for 5 days'...");
  const intent5 = detectHomepageIntent("Plan my honeymoon in Goa for 5 days");
  assert.equal(intent5.type, "planner", "Case 5 must remain AI planner intent");
  console.log("✓ Case 5 Passed: Maintained AI planner intent\n");

  // CASE 8: User types "Plan a trip to Kashmir including flights and hotels"
  console.log("Testing Case 8: 'Plan a trip to Kashmir including flights and hotels'...");
  const intent8 = detectHomepageIntent("Plan a trip to Kashmir including flights and hotels");
  assert.equal(intent8.type, "planner", "Case 8 must remain AI planner intent");
  console.log("✓ Case 8 Passed: Maintained AI planner intent\n");

  // Itinerary with activities
  console.log("Testing 'I want to plan a trip and include flights, hotels and activities'...");
  const intentItinerary = detectHomepageIntent("I want to plan a trip and include flights, hotels and activities");
  assert.equal(intentItinerary.type, "planner", "Must remain AI planner intent");
  console.log("✓ Itinerary query Passed\n");

  // FLIGHT SEARCH API CALL (GET /api/flights/search)
  console.log("Testing Flight Search API: GET /api/flights/search...");
  const searchUrl = "http://localhost:8080/api/flights/search?from=DEL&to=BOM&departure=2026-10-12&travellers=2&cabin=Economy";
  const searchRes = await fetch(searchUrl);
  assert.equal(searchRes.status, 200, `Search endpoint returned ${searchRes.status}`);
  const searchData = await searchRes.json();
  assert.ok(Array.isArray(searchData.results), "Search results must be an array");
  assert.ok(searchData.results.length > 0, "Search results must return flight offers");
  console.log(`✓ Flight Search API returned ${searchData.results.length} offers (Provider: ${searchData.provider}, Mode: ${searchData.mode})`);

  const firstOffer = searchData.results[0];
  console.log(`  Sample flight: ${firstOffer.airline} ${firstOffer.flightNumber} (${firstOffer.from} -> ${firstOffer.to}), Price: ₹${firstOffer.price}`);
  assert.ok(firstOffer.id, "Flight offer must have an id");
  assert.ok(firstOffer.price > 0, "Flight offer price must be > 0");

  console.log("\nALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
