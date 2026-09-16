/** Hotelbeds TEST API adapter and workflow tests. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.HOTELBEDS_HOTEL_API_KEY = "hotelbeds-test-key";
process.env.HOTELBEDS_HOTEL_SECRET = "hotelbeds-test-secret";
process.env.HOTELBEDS_HOTEL_BASE_URL = "https://api.test.hotelbeds.com";

const { HOTELBEDS_BOOKING_TIMEOUT_MS, HotelbedsError, HotelbedsProvider, hotelbedsSignature, hotelbedsVoucher, hotelbedsVoucherPdf } = await import("../src/services/hotelbeds");

const searchInput = {
  checkIn: "2030-01-10",
  checkOut: "2030-01-12",
  destination: "LON",
  rooms: [{ adults: 2, children: 1, childAges: [8] }],
  sourceMarket: "GB",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Hotelbeds TEST adapter", () => {
  it("generates the documented SHA256 signature", () => {
    assert.equal(hotelbedsSignature("key", "secret", 1700000000), "278d74471a3b5267e27221967122169ad26fac349e0fb6a94779cdf050a0d038");
  });

  it("sends Api-key, X-Signature, gzip and JSON headers without leaking credentials", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const provider = new HotelbedsProvider(async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return response({ hotels: [] });
    });
    await provider.availability(searchInput);
    const headers = new Headers(requestInit?.headers);
    assert.equal(requestUrl.includes("hotelbeds-test-key"), false);
    assert.equal(headers.get("Api-key"), "hotelbeds-test-key");
    assert.ok(headers.get("X-Signature"));
    assert.equal(headers.get("Accept"), "application/json");
    assert.equal(headers.get("Accept-Encoding"), "gzip");
    assert.equal(String(requestInit?.body).includes("hotelbeds-test-secret"), false);
  });

  it("maps one room and multiple rooms with independent child ages to Availability", async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    const provider = new HotelbedsProvider(async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return response({ hotels: [] });
    });
    await provider.availability({ ...searchInput, rooms: [{ adults: 2, children: 0, childAges: [] }] });
    await provider.availability({ ...searchInput, rooms: [
      { adults: 2, children: 0, childAges: [] },
      { adults: 2, children: 2, childAges: [7, 12] },
    ] });
    assert.deepEqual(requestBodies[0].occupancies, [{ rooms: 1, adults: 2, children: 0 }]);
    assert.deepEqual(requestBodies[1].occupancies, [
      { rooms: 1, adults: 2, children: 0 },
      { rooms: 1, adults: 2, children: 2, paxes: [{ type: "CH", age: 7 }, { type: "CH", age: 12 }] },
    ]);
  });

  it("normalizes availability hotels, rooms, rates, cancellation and children", async () => {
    const provider = new HotelbedsProvider(async () => response({ hotels: [{ code: 100, name: "Test Hotel", categoryName: "4 stars", destinationName: "London", address: "1 Test Street", rooms: [{ name: "Double Room", rates: [{ rateKey: "rate-recheck", rateType: "RECHECK", net: "240.00", boardName: "Breakfast", rateComments: "Test rate", cancellationPolicies: [{ amount: "20", currency: "EUR", from: "2030-01-09T00:00:00", to: "2030-01-10T00:00:00" }] }] }] }] }));
    const results = await provider.availability(searchInput);
    assert.equal(results.length, 1);
    assert.equal(results[0].provider, "HOTELBEDS");
    assert.equal(results[0].environment, "TEST");
    assert.equal(results[0].rateType, "RECHECK");
    assert.equal(results[0].rateKey, "rate-recheck");
    assert.equal(results[0].children, 1);
    assert.deepEqual(results[0].childAges, [8]);
    assert.equal(results[0].price, 240);
    assert.equal(results[0].cancellationPolicies[0].to, "2030-01-10T00:00:00");
    assert.equal(results[0].refundable, undefined);
    assert.equal(results[0].rateComments, "Test rate");
  });

  it("calls CheckRate explicitly for a RECHECK rate and supports BOOKABLE without it", async () => {
    const paths: string[] = [];
    const provider = new HotelbedsProvider(async (input) => { paths.push(String(input)); return response({ rate: { rateKey: "rate-bookable", rateType: "BOOKABLE", net: "199.50", currency: "INR", nonRefundable: true, cancellationPolicies: [{ amount: "100", from: "2030-01-09T00:00:00", to: "2030-01-10T00:00:00" }], rateComments: "Supplier warning" } }); });
    const checked = await provider.checkRate("rate-recheck");
    assert.equal((checked as any).rate.rateKey, "rate-bookable");
    assert.equal((checked as any).rate.price, 199.5);
    assert.equal((checked as any).rate.currency, "INR");
    assert.equal((checked as any).rate.refundable, false);
    assert.equal((checked as any).rate.cancellationPolicies[0].amount, "100");
    assert.equal((checked as any).rate.rateComments, "Supplier warning");
    assert.equal(paths.length, 1);
    assert.ok(paths[0].endsWith("/checkrates"));
  });

  it("normalizes official Content API details and resolves rate comments", async () => {
    const provider = new HotelbedsProvider(async (input) => {
      const url = String(input);
      if (url.includes("ratecommentdetails")) return response({ rateComments: [{ dateStart: "2030-01-01", dateEnd: "2030-12-31", description: "Non-refundable rate." }] });
      return response({ hotel: { code: 100, name: { content: "Test Hotel" }, category: { description: { content: "4 STARS" } }, address: { content: "1 Test Street" }, destination: { name: { content: "London" } }, coordinates: { latitude: "51.5", longitude: "-0.1" }, images: [{ path: "100/test.jpg" }], description: { content: "Real content" }, facilities: [{ facilityName: "Pool" }], rooms: [{ roomCode: "DBL.ST", description: "Double Standard", roomFacilities: [] }], boards: [{ code: "BB", description: { content: "Bed and Breakfast" } }], interestPoints: [{ poiName: "Museum", distance: 1200 }] } });
    });
    const content = await provider.content("100");
    assert.equal(content.name, "Test Hotel");
    assert.equal(content.images[0], "https://photos.hotelbeds.com/giata/100/test.jpg");
    assert.equal(content.facilities[0], "Pool");
    assert.equal(content.rooms[0].name, "Double Standard");
    assert.equal(content.boards[0].name, "Bed and Breakfast");
    assert.equal(content.pointsOfInterest[0].name, "Museum");
    const comments = await provider.rateCommentDetails("100%7C200", "2030-01-10");
    assert.equal((comments as any).rateComments[0].description, "Non-refundable rate.");
  });

  it("returns empty optional content and policy collections without inventing data", async () => {
    const provider = new HotelbedsProvider(async (input) => String(input).includes("/details") ? response({ hotel: { code: 100 } }) : response({ hotels: [{ code: 100, rooms: [{ rates: [{ rateKey: "rate-empty", net: "10" }] }] }] }));
    const content = await provider.content("100");
    assert.deepEqual(content.images, []);
    assert.deepEqual(content.facilities, []);
    assert.deepEqual(content.rooms, []);
    assert.deepEqual(content.boards, []);
    assert.deepEqual(content.pointsOfInterest, []);
    const [rate] = await provider.availability(searchInput);
    assert.deepEqual(rate.cancellationPolicies, []);
    assert.equal(rate.rateComments, undefined);
  });

  it("books with the supplied valid rate key and returns supplier response", async () => {
    let body: Record<string, unknown> | undefined;
    const provider = new HotelbedsProvider(async (_input, init) => { body = JSON.parse(String(init?.body)); return response({ booking: { reference: "HB-TEST-123", status: "CONFIRMED" } }); });
    const result = await provider.booking({ rateKey: "rate-bookable", clientReference: "WAY-HB-TEST-1", holder: { name: "Test", surname: "Guest", email: "test@example.com", phone: "0000000000" }, rooms: [{ paxes: [{ name: "Test", surname: "Guest", type: "AD" }] }] });
    assert.equal((result as any).booking.reference, "HB-TEST-123");
    assert.equal((body?.rooms as any[])[0].rateKey, "rate-bookable");
    assert.equal((body?.rooms as any[])[0].paxes[0].roomId, 1);
    assert.equal((body?.rooms as any[])[0].paxes[0].type, "AD");
  });

  it("keeps every booking pax in its containing room and uses the certification timeout", async () => {
    let body: Record<string, unknown> | undefined;
    const provider = new HotelbedsProvider(async (_input, init) => { body = JSON.parse(String(init?.body)); return response({ booking: { reference: "HB-ROOMS", status: "CONFIRMED" } }); });
    await provider.booking({ rateKey: "rate-bookable", clientReference: "WAY-HB-ROOMS", holder: { name: "Lead", surname: "Guest" }, rooms: [
      { paxes: [{ name: "Adult", surname: "One", type: "AD" }, { name: "Child", surname: "One", type: "CH", age: 7, roomId: 99 }] },
      { paxes: [{ name: "Adult", surname: "Two", type: "AD" }, { name: "Child", surname: "Two", type: "CH", age: 12 }] },
    ] });
    const rooms = body?.rooms as Array<{ paxes: Array<{ roomId: number; age?: number }> }>;
    assert.deepEqual(rooms.map((room) => room.paxes.map((pax) => pax.roomId)), [[1, 1], [2, 2]]);
    assert.deepEqual(rooms[0].paxes.map((pax) => pax.age), [undefined, 7]);
    assert.equal(HOTELBEDS_BOOKING_TIMEOUT_MS >= 60_000, true);
  });

  it("calls booking cancellation and generates a credential-free voucher", async () => {
    const provider = new HotelbedsProvider(async (input) => response({ path: String(input) }));
    const cancelled = await provider.cancel("HB-TEST-123");
    assert.match(String((cancelled as any).path), /HB-TEST-123/);
    const voucher = hotelbedsVoucher({ provider: "HOTELBEDS", environment: "TEST", hotelbedsReference: "HB-TEST-123", zelevosReference: "WAY-HB-TEST-1", hotelName: "Test Hotel", guests: [{ name: "Test" }] });
    assert.equal(voucher.hotelbedsReference, "HB-TEST-123");
    assert.equal(JSON.stringify(voucher).includes("hotelbeds-test-secret"), false);
  });

  it("generates an openable PDF voucher with stored booking data and no credentials", () => {
    const pdf = hotelbedsVoucherPdf({
      status: "CONFIRMED", hotelName: "Test Hotel", hotelCategory: "4 stars", hotelAddress: "1 Test Street", destination: "London",
      hotelbedsReference: "HB-TEST-123", zelevosReference: "WAY-HB-TEST-1", holder: { name: "Lead", surname: "Guest" },
      guests: [{ name: "Lead", surname: "Guest", type: "AD" }, { name: "Child", surname: "Guest", type: "CH", age: 7 }],
      checkIn: "2030-01-10", checkOut: "2030-01-12", roomType: "Family Room", boardType: "Breakfast",
      rateComments: "Supplier remark", cancellationPolicies: [{ amount: "20", from: "2030-01-09T00:00:00" }],
    });
    const text = pdf.toString("ascii");
    assert.equal(text.startsWith("%PDF-1.4"), true);
    assert.match(text, /Test Hotel/);
    assert.match(text, /HB-TEST-123/);
    assert.match(text, /age 7/);
    assert.equal(text.includes("hotelbeds-test-secret"), false);
    assert.match(text, /%%EOF/);
  });

  it("maps timeout, supplier errors and malformed JSON safely", async () => {
    const timeoutProvider = new HotelbedsProvider(async (_input, init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))));
    await assert.rejects(() => timeoutProvider.availability(searchInput), (error: unknown) => error instanceof HotelbedsError && error.code === "timeout");
    const errorProvider = new HotelbedsProvider(async () => response({ error: "denied" }, 401));
    await assert.rejects(() => errorProvider.availability(searchInput), (error: unknown) => error instanceof HotelbedsError && error.code === "upstream");
    const malformedProvider = new HotelbedsProvider(async () => new Response("not-json", { status: 200 }));
    await assert.rejects(() => malformedProvider.availability(searchInput), (error: unknown) => error instanceof HotelbedsError && error.code === "invalid_response");
  });
});
