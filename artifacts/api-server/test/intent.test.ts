import test from "node:test";
import assert from "node:assert/strict";
import { detectHomepageIntent, normalizeCityOrCode } from "../../wayora/src/lib/intent";

test("Intent Routing — Case 1: 'Flight' input opens flight search with no prefilled route", () => {
  const intent = detectHomepageIntent("Flight");
  assert.equal(intent.type, "flight");
  if (intent.type === "flight") {
    assert.equal(intent.origin, undefined);
    assert.equal(intent.destination, undefined);
  }
});

test("Intent Routing — Case 2: 'book a flight' and 'find flights' and 'search flights'", () => {
  for (const query of ["book a flight", "find flights", "search flights", "flights"]) {
    const intent = detectHomepageIntent(query);
    assert.equal(intent.type, "flight", `Expected ${query} to be flight intent`);
  }
});

test("Intent Routing — Case 3: 'Delhi to Mumbai flight' parses origin and destination", () => {
  const intent = detectHomepageIntent("Delhi to Mumbai flight");
  assert.equal(intent.type, "flight");
  if (intent.type === "flight") {
    assert.equal(intent.origin, "DEL");
    assert.equal(intent.destination, "BOM");
  }
});

test("Intent Routing — Case 4: 'Delhi to Mumbai flight tomorrow' parses relative date", () => {
  const intent = detectHomepageIntent("Delhi to Mumbai flight tomorrow");
  assert.equal(intent.type, "flight");
  if (intent.type === "flight") {
    assert.equal(intent.origin, "DEL");
    assert.equal(intent.destination, "BOM");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expectedDate = tomorrow.toISOString().split("T")[0];
    assert.equal(intent.departureDate, expectedDate);
  }
});

test("Intent Routing — Case 5: 'flight from Delhi to Mumbai for 2 people' parses passenger count", () => {
  const intent = detectHomepageIntent("flight from Delhi to Mumbai for 2 people");
  assert.equal(intent.type, "flight");
  if (intent.type === "flight") {
    assert.equal(intent.origin, "DEL");
    assert.equal(intent.destination, "BOM");
    assert.equal(intent.passengers, 2);
  }
});

test("Intent Routing — Case 6: 'Delhi Mumbai flight for 2 people' two-word city format", () => {
  const intent = detectHomepageIntent("Delhi Mumbai flight for 2 people");
  assert.equal(intent.type, "flight");
  if (intent.type === "flight") {
    assert.equal(intent.origin, "DEL");
    assert.equal(intent.destination, "BOM");
    assert.equal(intent.passengers, 2);
  }
});

test("Intent Routing — Case 7: 'Plan my honeymoon in Goa for 5 days' remains AI Planner intent", () => {
  const intent = detectHomepageIntent("Plan my honeymoon in Goa for 5 days");
  assert.equal(intent.type, "planner");
});

test("Intent Routing — Case 8: 'Plan a trip to Kashmir including flights and hotels' remains AI Planner intent", () => {
  const intent = detectHomepageIntent("Plan a trip to Kashmir including flights and hotels");
  assert.equal(intent.type, "planner");
});

test("Intent Routing — Case 9: 'I want to plan a trip and include flights, hotels and activities' remains AI Planner intent", () => {
  const intent = detectHomepageIntent("I want to plan a trip and include flights, hotels and activities");
  assert.equal(intent.type, "planner");
});

test("City normalization maps known Indian cities to IATA and preserves 3-letter codes", () => {
  assert.equal(normalizeCityOrCode("delhi"), "DEL");
  assert.equal(normalizeCityOrCode("mumbai"), "BOM");
  assert.equal(normalizeCityOrCode("bangalore"), "BLR");
  assert.equal(normalizeCityOrCode("srinagar"), "SXR");
  assert.equal(normalizeCityOrCode("kashmir"), "SXR");
  assert.equal(normalizeCityOrCode("DEL"), "DEL");
  assert.equal(normalizeCityOrCode("BOM"), "BOM");
  assert.equal(normalizeCityOrCode("Dehradun"), "DED");
  assert.equal(normalizeCityOrCode("unknown city"), "Unknown City");
});
