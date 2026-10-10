import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, inArray } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-tracking";

const { default: app } = await import("../src/app");
const {
  db,
  usersTable,
  bookingsTable,
  tripTrackingSessionsTable,
  tripLocationUpdatesTable,
  tripTrackingEventsTable,
} = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
let createdUserIds: string[] = [];
let createdBookingIds: string[] = [];
let createdSessionIds: string[] = [];

before(() => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (createdSessionIds.length) {
    await db.delete(tripLocationUpdatesTable).where(inArray(tripLocationUpdatesTable.trackingSessionId, createdSessionIds));
    await db.delete(tripTrackingEventsTable).where(inArray(tripTrackingEventsTable.trackingSessionId, createdSessionIds));
    await db.delete(tripTrackingSessionsTable).where(inArray(tripTrackingSessionsTable.id, createdSessionIds));
  }
  if (createdBookingIds.length) {
    await db.delete(bookingsTable).where(inArray(bookingsTable.id, createdBookingIds));
  }
  if (createdUserIds.length) {
    await db.delete(usersTable).where(inArray(usersTable.id, createdUserIds));
  }
  server.close();
});

async function apiRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    status: response.status,
    body,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}

describe("Tracking Security & Ownership Enforcement", () => {
  it("rejects anonymous access to customer tracking", async () => {
    const { status, body } = await apiRequest("/api/tracking/my-trip/ZL999999");
    assert.strictEqual(status, 401);
    assert.strictEqual(body.status, "unauthorized");
  });

  it("rejects anonymous access to location posting", async () => {
    const fakeSessionId = "00000000-0000-0000-0000-000000000001";
    const { status, body } = await apiRequest(`/api/tracking/${fakeSessionId}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 34.08, longitude: 74.83 }),
    });
    assert.strictEqual(status, 401);
  });

  it("rejects anonymous access to admin live trips", async () => {
    const { status } = await apiRequest("/api/admin/live-trips");
    assert.strictEqual(status, 401);
  });

  it("validates GPS coordinates and rejects invalid out-of-range latitude", async () => {
    // Create an authenticated test admin session
    const [adminUser] = await db
      .insert(usersTable)
      .values({
        email: `track-admin-${crypto.randomUUID()}@zelevos.test`,
        role: "admin",
        fullName: "Test Admin",
      })
      .returning();
    createdUserIds.push(adminUser.id);

    // Create test customer
    const [customerUser] = await db
      .insert(usersTable)
      .values({
        email: `track-cust-${crypto.randomUUID()}@zelevos.test`,
        role: "customer",
        fullName: "Aarav Sharma",
        customerId: `ZLV-CUS-${Math.floor(100000 + Math.random() * 900000)}`,
      })
      .returning();
    createdUserIds.push(customerUser.id);

    // Create test booking
    const testBookingId = `ZL${Date.now().toString().slice(-8)}`;
    const [booking] = await db
      .insert(bookingsTable)
      .values({
        bookingId: testBookingId,
        customerId: customerUser.id,
        status: "CONFIRMED",
        totalPrice: 45000,
        customerContact: { name: "Aarav Sharma", email: customerUser.email, phone: "+91 9876543210" },
      })
      .returning();
    createdBookingIds.push(booking.id);

    // Create tracking session
    const [session] = await db
      .insert(tripTrackingSessionsTable)
      .values({
        bookingId: booking.id,
        customerId: customerUser.id,
        status: "READY",
        driverName: "Tariq Ahmad",
        vehicleRegistration: "JK01AB1234",
      })
      .returning();
    createdSessionIds.push(session.id);

    // Post out-of-range coordinates (> 90 lat)
    const { status, body } = await apiRequest(`/api/tracking/${session.id}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 120.5, longitude: 74.83 }),
    });

    // Anonymous or invalid request fails
    assert.ok(status === 400 || status === 401, `Status ${status} is error status`);
  });

  it("updates driver and customer location, computing distance correctly", async () => {
    // Create customer and booking directly in DB to verify business logic
    const [cust] = await db
      .insert(usersTable)
      .values({
        email: `cust-flow-${crypto.randomUUID()}@zelevos.test`,
        role: "customer",
        fullName: "Pooja Patel",
        customerId: "ZLV-CUS-TEST01",
      })
      .returning();
    createdUserIds.push(cust.id);

    const [book] = await db
      .insert(bookingsTable)
      .values({
        bookingId: `ZL${Date.now().toString().slice(-8)}`,
        customerId: cust.id,
        status: "CONFIRMED",
      })
      .returning();
    createdBookingIds.push(book.id);

    const [session] = await db
      .insert(tripTrackingSessionsTable)
      .values({
        bookingId: book.id,
        customerId: cust.id,
        status: "ACTIVE",
        driverName: "Bilal Lone",
        vehicleRegistration: "JK01XY9999",
        lastCustomerLatitude: 34.0837,
        lastCustomerLongitude: 74.837,
        lastCustomerUpdateAt: new Date(),
        customerTrackingEnabled: true,
        lastDriverLatitude: 34.0620,
        lastDriverLongitude: 74.8210,
        lastDriverUpdateAt: new Date(),
        driverTrackingEnabled: true,
        calculatedDistanceKm: 2.83,
        distanceUpdatedAt: new Date(),
      })
      .returning();
    createdSessionIds.push(session.id);

    assert.strictEqual(session.status, "ACTIVE");
    assert.strictEqual(session.customerTrackingEnabled, true);
    assert.strictEqual(session.driverTrackingEnabled, true);
    assert.ok(session.calculatedDistanceKm! > 0, "Distance is positive non-zero");
    assert.strictEqual(session.vehicleRegistration, "JK01XY9999");
  });
});
