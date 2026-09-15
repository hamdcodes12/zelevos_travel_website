import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, inArray } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret";

const { default: app } = await import("../src/app");
const { db, generatedTripsTable, usersTable } = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
const testEmailA = `wayora-a-${crypto.randomUUID()}@example.com`;
const testEmailB = `wayora-b-${crypto.randomUUID()}@example.com`;
let userIds: string[] = [];

before(() => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (userIds.length) {
    await db.delete(generatedTripsTable).where(inArray(generatedTripsTable.ownerId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  server.close();
});

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  return {
    response,
    body: text ? JSON.parse(text) as Record<string, unknown> | Array<Record<string, unknown>> : null,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}

const credentials = (email: string) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "correct horse battery staple" }),
});

const trip = {
  destination: "Kashmir",
  dates: "October 2026",
  durationDays: 5,
  travellers: 2,
  budget: "₹70,000",
  preferences: ["Nature"],
  itinerary: [{ day: 1, title: "Arrive softly", activities: ["Dal Lake shikara"] }],
  estimatedCosts: { total: "₹70,000" },
  transportInfo: { arrival: "Fly into Srinagar" },
  hotelInfo: { recommendation: "Stay near Dal Lake" },
  reasoning: "A calm route with a light first day.",
};

describe("account-backed trip ownership", () => {
  it("supports signup, login, session lookup, and logout", async () => {
    const signup = await request("/api/auth/signup", credentials(testEmailA));
    assert.equal(signup.response.status, 201);
    assert.ok(signup.cookie);
    assert.equal(JSON.stringify(signup.body).includes("password"), false);
    const signupUser = (signup.body as { user: { id: string } }).user;
    userIds.push(signupUser.id);

    const current = await request("/api/auth/user", { headers: { Cookie: signup.cookie } });
    assert.equal(current.response.status, 200);
    assert.equal((current.body as { user: { email: string } }).user.email, testEmailA);

    const logout = await request("/api/auth/logout", { method: "POST", headers: { Cookie: signup.cookie } });
    assert.equal(logout.response.status, 204);
    const afterLogout = await request("/api/auth/user", { headers: { Cookie: signup.cookie } });
    assert.equal(afterLogout.response.status, 401);

    const login = await request("/api/auth/login", credentials(testEmailA));
    assert.equal(login.response.status, 200);
    assert.ok(login.cookie);
  });

  it("keeps every trip operation scoped to the authenticated account", async () => {
    const a = await request("/api/auth/login", credentials(testEmailA));
    const b = await request("/api/auth/signup", credentials(testEmailB));
    assert.equal(a.response.status, 200);
    assert.equal(b.response.status, 201);
    userIds.push((b.body as { user: { id: string } }).user.id);

    const created = await request("/api/trips", {
      method: "POST",
      headers: { Cookie: a.cookie, "Content-Type": "application/json" },
      body: JSON.stringify(trip),
    });
    assert.equal(created.response.status, 201);
    const tripId = (created.body as { id: string }).id;

    const aTrips = await request("/api/trips", { headers: { Cookie: a.cookie } });
    assert.equal(aTrips.response.status, 200);
    assert.equal((aTrips.body as Array<{ id: string }>).some((item) => item.id === tripId), true);

    const bTrips = await request("/api/trips", { headers: { Cookie: b.cookie } });
    assert.equal(bTrips.response.status, 200);
    assert.equal((bTrips.body as Array<{ id: string }>).some((item) => item.id === tripId), false);

    const bGet = await request(`/api/trips/${tripId}`, { headers: { Cookie: b.cookie } });
    assert.equal(bGet.response.status, 404);
    const bUpdate = await request(`/api/trips/${tripId}`, {
      method: "PUT",
      headers: { Cookie: b.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ destination: "Leh" }),
    });
    assert.equal(bUpdate.response.status, 404);
    const bDelete = await request(`/api/trips/${tripId}`, { method: "DELETE", headers: { Cookie: b.cookie } });
    assert.equal(bDelete.response.status, 404);

    const aGet = await request(`/api/trips/${tripId}`, { headers: { Cookie: a.cookie } });
    assert.equal(aGet.response.status, 200);
    const aUpdate = await request(`/api/trips/${tripId}`, {
      method: "PUT",
      headers: { Cookie: a.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ destination: "Gulmarg" }),
    });
    assert.equal(aUpdate.response.status, 200);
    assert.equal((aUpdate.body as { destination: string }).destination, "Gulmarg");

    const aDelete = await request(`/api/trips/${tripId}`, { method: "DELETE", headers: { Cookie: a.cookie } });
    assert.equal(aDelete.response.status, 204);
  });

  it("rejects trip creation without an authenticated session", async () => {
    const response = await request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trip),
    });
    assert.equal(response.response.status, 401);
  });
});