import test from "node:test";
import assert from "node:assert/strict";
import { detectHomepageIntent } from "../../wayora/src/lib/intent";

test("Flight Search Params — Direct visit to /flights parses clean empty form state", () => {
  // Simulate URLSearchParams on a fresh /flights visit
  const params = new URLSearchParams("");

  const from = params.get("from")?.trim().toUpperCase() || "";
  const to = params.get("to")?.trim().toUpperCase() || "";
  const departure = params.get("departure")?.trim() || "";
  const returnDate = params.get("return")?.trim() || "";
  const travellers = params.get("travellers")?.trim() || "1";
  const cabin = params.get("cabin")?.trim() || "Economy";
  const hasReturn = Boolean(params.get("return")?.trim());

  assert.equal(from, "", "From should start empty");
  assert.equal(to, "", "To should start empty");
  assert.equal(departure, "", "Departure should start empty");
  assert.equal(returnDate, "", "Return date should start empty");
  assert.equal(travellers, "1", "Travellers should default to 1");
  assert.equal(cabin, "Economy", "Cabin should default to Economy");
  assert.equal(hasReturn, false, "Return field should not be active");

  // Verify that automatic search should NOT trigger when from/to are missing
  const shouldAutoSearch = Boolean(from && to);
  assert.equal(shouldAutoSearch, false, "Automatic search must not trigger on a fresh visit");
});

test("Flight Search Params — Explicit AI URL deep-link populates fields and triggers search", () => {
  // Simulate URLSearchParams from an intentional AI deep-link: /flights?from=DEL&to=BOM&departure=2026-10-12&travellers=2
  const params = new URLSearchParams("from=DEL&to=BOM&departure=2026-10-12&travellers=2&cabin=Business");

  const from = params.get("from")?.trim().toUpperCase() || "";
  const to = params.get("to")?.trim().toUpperCase() || "";
  const departure = params.get("departure")?.trim() || "";
  const returnDate = params.get("return")?.trim() || "";
  const travellers = params.get("travellers")?.trim() || "1";
  const cabin = params.get("cabin")?.trim() || "Economy";

  assert.equal(from, "DEL");
  assert.equal(to, "BOM");
  assert.equal(departure, "2026-10-12");
  assert.equal(returnDate, "");
  assert.equal(travellers, "2");
  assert.equal(cabin, "Business");

  const shouldAutoSearch = Boolean(from && to);
  assert.equal(shouldAutoSearch, true, "Automatic search should trigger for valid deep-link");
});

test("Flight Search Params — Homepage AI search 'Delhi to Mumbai flight tomorrow' generates deep-link with route and date", () => {
  const intent = detectHomepageIntent("Delhi to Mumbai flight tomorrow");
  assert.equal(intent.type, "flight");

  if (intent.type === "flight") {
    const params = new URLSearchParams();
    if (intent.origin) params.set("from", intent.origin);
    if (intent.destination) params.set("to", intent.destination);
    if (intent.departureDate) params.set("departure", intent.departureDate);
    if (intent.passengers) params.set("travellers", String(intent.passengers));

    const searchUrl = `/flights?${params.toString()}`;
    assert.match(searchUrl, /from=DEL/);
    assert.match(searchUrl, /to=BOM/);
    assert.match(searchUrl, /departure=\d{4}-\d{2}-\d{2}/);

    // Verify recipient page will auto-populate and run search
    const parsedParams = new URLSearchParams(params.toString());
    assert.equal(parsedParams.get("from"), "DEL");
    assert.equal(parsedParams.get("to"), "BOM");
    assert.ok(parsedParams.get("departure"));
  }
});

test("Flight Search Params — Homepage search 'Flight' creates clean /flights without prefilled parameters", () => {
  const intent = detectHomepageIntent("Flight");
  assert.equal(intent.type, "flight");

  if (intent.type === "flight") {
    const params = new URLSearchParams();
    if (intent.origin) params.set("from", intent.origin);
    if (intent.destination) params.set("to", intent.destination);
    if (intent.departureDate) params.set("departure", intent.departureDate);
    if (intent.passengers) params.set("travellers", String(intent.passengers));

    const targetUrl = params.toString() ? `/flights?${params.toString()}` : "/flights";
    assert.equal(targetUrl, "/flights", "Should route to clean /flights without prefilled params");
  }
});
