import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, inArray, or } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-for-zelevos-auth-access-control";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app");
const { db, usersTable, bookingsTable } = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
const createdUserEmails: string[] = [];

before(() => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (createdUserEmails.length) {
    try {
      const users = await db.select().from(usersTable).where(inArray(usersTable.email, createdUserEmails));
      const userIds = users.map((u: { id: string }) => u.id);
      if (userIds.length) {
        await db.delete(bookingsTable).where(or(inArray(bookingsTable.ownerId, userIds), inArray(bookingsTable.customerId, userIds)));
        await db.delete(usersTable).where(inArray(usersTable.id, userIds));
      }
    } catch {
      // ignore
    }
  }
  server.close();
});

async function apiRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    redirect: "manual",
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    response,
    status: response.status,
    headers: response.headers,
    body,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}

describe("Zelevos Authentication & Access Control", () => {
  const testEmail = `auth_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@example.com`;
  createdUserEmails.push(testEmail);
  let sessionCookie = "";

  describe("1. Sign up Validation & Account Creation", () => {
    it("rejects sign up with password shorter than 8 characters", async () => {
      const res = await apiRequest("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Aarav Mehta",
          email: testEmail,
          password: "short",
          confirmPassword: "short",
        }),
      });
      assert.equal(res.status, 400);
      assert.match(String(res.body?.message || ""), /Password must be at least 8 characters/i);
    });

    it("rejects sign up when password and confirmPassword do not match", async () => {
      const res = await apiRequest("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Aarav Mehta",
          email: testEmail,
          password: "StrongPassword123!",
          confirmPassword: "DifferentPassword456!",
        }),
      });
      assert.equal(res.status, 400);
      assert.match(String(res.body?.message || ""), /Passwords do not match/i);
    });

    it("successfully creates a new account with fullName, email, and 8+ char password", async () => {
      const res = await apiRequest("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Aarav Mehta",
          email: testEmail,
          password: "StrongPassword123!",
          confirmPassword: "StrongPassword123!",
        }),
      });
      assert.equal(res.status, 201);
      assert.ok(res.body?.user);
      assert.equal(res.body.user.email, testEmail);
      assert.equal(res.body.user.fullName, "Aarav Mehta");
      assert.equal(res.body.user.authProvider, "email");
      assert.ok(res.cookie.length > 0, "Expected session cookie to be set");
      sessionCookie = res.cookie;
    });

    it("rejects duplicate registration with 409 Conflict", async () => {
      const res = await apiRequest("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Aarav Duplicate",
          email: testEmail,
          password: "AnotherPassword123!",
        }),
      });
      assert.equal(res.status, 409);
      assert.match(String(res.body?.message || ""), /already exists/i);
    });
  });

  describe("2. Log in & Session Verification", () => {
    it("rejects log in with invalid credentials", async () => {
      const res = await apiRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "WrongPassword999!",
        }),
      });
      assert.equal(res.status, 401);
      assert.match(String(res.body?.message || ""), /email or password/i);
    });

    it("successfully logs in with valid email and password", async () => {
      const res = await apiRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "StrongPassword123!",
        }),
      });
      assert.equal(res.status, 200);
      assert.ok(res.body?.user);
      assert.equal(res.body.user.email, testEmail);
      assert.equal(res.body.user.fullName, "Aarav Mehta");
      sessionCookie = res.cookie;
    });

    it("identifies authenticated user via GET /api/auth/user", async () => {
      const res = await apiRequest("/api/auth/user", {
        headers: { Cookie: sessionCookie },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body?.user?.email, testEmail);
      assert.equal(res.body?.user?.fullName, "Aarav Mehta");
    });
  });

  describe("3. Email/password-only authentication", () => {
    it("reports email/password as the only public provider", async () => {
      const res = await apiRequest("/api/auth/providers");
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { emailPassword: { enabled: true } });
    });

    it("rejects obsolete social authentication routes", async () => {
      const google = await apiRequest("/api/auth/google");
      const facebook = await apiRequest("/api/auth/facebook");
      assert.equal(google.status, 404);
      assert.equal(facebook.status, 404);
    });
  });

  // PARKED (Phase 1, 2026-09-19): Direct supplier flight booking tests parked per Wayora_PRD_Without_APIs.
  describe.skip("4. Flight Booking Access Control (PARKED - Phase 1: flight supplier parked)", () => {
    let flightOffer: any = null;

    it("allows anonymous / logged-out users to search flights", async () => {
      const res = await apiRequest("/api/flights/search?from=DEL&to=BOM&departure=2026-10-12&travellers=1");
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body?.results));
      assert.ok(res.body.results.length > 0, "Expected flight search results");
      flightOffer = res.body.results[0];
    });

    it("allows anonymous users to revalidate fare and lock price (Step 1)", async () => {
      const res = await apiRequest("/api/flights/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: flightOffer.id,
          expectedPrice: flightOffer.price,
        }),
      });
      assert.equal(res.status, 200);
      assert.ok(res.body?.valid);
    });

    it("rejects booking attempt from unauthenticated user with 401", async () => {
      const res = await apiRequest("/api/flights/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: flightOffer.id,
          passengers: [
            {
              type: "ADULT",
              title: "Mr",
              firstName: "Rahul",
              lastName: "Verma",
              dateOfBirth: "1990-01-01",
              gender: "MALE",
              nationality: "IN",
            },
          ],
          contact: {
            email: "rahul@example.com",
            phone: "+919876543210",
          },
          payment: {
            orderId: "order_test_anon",
            paymentId: "pay_test_anon_attempt",
            signature: "sig_test_valid",
          },
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      assert.equal(res.status, 401);
      assert.match(String(res.body?.message || ""), /log in/i);
    });

    it("allows authenticated user to successfully book flight and issues PNR", async () => {
      const res = await apiRequest("/api/flights/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          offerId: flightOffer.id,
          passengers: [
            {
              type: "ADULT",
              title: "Mr",
              firstName: "Aarav",
              lastName: "Mehta",
              dateOfBirth: "1990-01-01",
              gender: "MALE",
              nationality: "IN",
            },
          ],
          contact: {
            email: testEmail,
            phone: "+919876543210",
          },
          payment: {
            orderId: "order_test_auth",
            paymentId: "pay_test_auth_success",
            signature: "sig_test_valid",
          },
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      assert.equal(res.status, 201);
      assert.ok(res.body?.pnr, "Expected PNR in confirmation");
      assert.equal(res.body.booking?.status, "CONFIRMED");
    });
  });
});
