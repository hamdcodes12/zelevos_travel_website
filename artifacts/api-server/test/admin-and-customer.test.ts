import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, inArray } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-for-wayora-admin-test-suite";
process.env.ADMIN_ID = "zelevos-travelai00";
process.env.ADMIN_PASSWORD = "ZT002121";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app");
const { db, usersTable, bookingsTable, adminUsersTable } = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
const createdEmails: string[] = [];

before(() => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (createdEmails.length) {
    try {
      const users = await db.select().from(usersTable).where(inArray(usersTable.email, createdEmails));
      const userIds = users.map((u) => u.id);
      if (userIds.length) {
        await db.delete(bookingsTable).where(inArray(bookingsTable.ownerId, userIds));
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

describe("Wayora Customer Management & Admin Control Panel", () => {
  const customerEmailA = `cust_a_${Date.now()}@example.com`;
  const customerEmailB = `cust_b_${Date.now()}@example.com`;
  const passwordA = "SecurePass1234!";
  const passwordB = "AnotherPass5678!";
  createdEmails.push(customerEmailA, customerEmailB);

  let sessionCookieA = "";
  let sessionCookieB = "";
  let customerIdA = "";
  let customerIdB = "";
  let userRecordIdA = "";
  let adminSessionCookie = "";
  let bookingIdA = "";

  describe("1. Customer Signup & Data Storage", () => {
    it("creates a customer saving full name, email, phone, customerId, and hashed password", async () => {
      const res = await apiRequest("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Aarav Sharma",
          email: customerEmailA,
          phone: "+91 98765 43210",
          password: passwordA,
          confirmPassword: passwordA,
        }),
      });

      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.ok(res.body.user);
      assert.equal(res.body.user.email, customerEmailA);
      assert.equal(res.body.user.fullName, "Aarav Sharma");
      assert.equal(res.body.user.phone, "+91 98765 43210");
      assert.ok(res.body.user.customerId?.startsWith("CUST-"));
      assert.equal(res.body.user.status, "active");
      assert.ok(res.body.user.lastLoginAt);
      assert.equal(res.body.user.passwordHash, undefined, "Password hash must NEVER be in response");

      customerIdA = res.body.user.customerId;
      userRecordIdA = res.body.user.id;
      sessionCookieA = res.cookie;
      assert.ok(sessionCookieA.includes("wayora_session="));

      // Verify in DB directly that password is saved as scrypt hash
      const [savedInDb] = await db.select().from(usersTable).where(eq(usersTable.email, customerEmailA));
      assert.ok(savedInDb);
      assert.ok(savedInDb.passwordHash?.includes(":"), "Password must be saved in salt:hash scrypt format");
      assert.notEqual(savedInDb.passwordHash, passwordA, "Plaintext password must NEVER be in DB");
    });

    it("prevents duplicate email registration", async () => {
      const res = await apiRequest("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Imposter Aarav",
          email: customerEmailA,
          password: "AnotherPassword123!",
        }),
      });

      assert.equal(res.status, 409);
      assert.equal(res.body.status, "email_taken");
    });

    it("creates second customer without phone number", async () => {
      const res = await apiRequest("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Priya Patel",
          email: customerEmailB,
          password: passwordB,
        }),
      });

      assert.equal(res.status, 201);
      assert.ok(res.body.user.customerId?.startsWith("CUST-"));
      assert.equal(res.body.user.phone, null);
      customerIdB = res.body.user.customerId;
      sessionCookieB = res.cookie;
    });
  });

  describe("2. Customer Login & Session Lifecycle", () => {
    it("rejects invalid password with friendly error", async () => {
      const res = await apiRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customerEmailA,
          password: "WrongPassword!",
        }),
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.status, "invalid_credentials");
    });

    it("authenticates against saved account and updates lastLoginAt", async () => {
      const beforeLoginTime = Date.now();
      const res = await apiRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customerEmailA,
          password: passwordA,
        }),
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.user);
      assert.equal(res.body.user.email, customerEmailA);
      assert.equal(res.body.user.customerId, customerIdA);
      assert.ok(res.body.user.lastLoginAt);
      const loginTime = new Date(res.body.user.lastLoginAt).getTime();
      assert.ok(loginTime >= beforeLoginTime - 5000);

      sessionCookieA = res.cookie;
    });

    it("persists session across page refresh via /api/auth/user", async () => {
      const res = await apiRequest("/api/auth/user", {
        headers: { Cookie: sessionCookieA },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, customerEmailA);
      assert.equal(res.body.user.customerId, customerIdA);
    });

    it("destroys session on logout", async () => {
      const logoutRes = await apiRequest("/api/auth/logout", {
        method: "POST",
        headers: { Cookie: sessionCookieA },
      });

      assert.equal(logoutRes.status, 204);

      // Verify session cookie is cleared and subsequent /auth/user fails
      const checkRes = await apiRequest("/api/auth/user", {
        headers: { Cookie: sessionCookieA },
      });
      assert.equal(checkRes.status, 401);

      // Re-login Customer A for subsequent tests
      const loginRes = await apiRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: customerEmailA, password: passwordA }),
      });
      sessionCookieA = loginRes.cookie;
    });
  });

  describe("3. Flight Booking Linking & Customer Isolation", () => {
    it("creates a flight booking linked to Customer A", async () => {
      // 1. Search flight to get valid offer
      const searchRes = await apiRequest("/api/flights/search?from=DEL&to=BOM");
      assert.equal(searchRes.status, 200);
      assert.ok(searchRes.body.results.length > 0);
      const offer = searchRes.body.results[0];

      // 2. Create and capture the test payment so the booking is represented in the payment audit.
      const paymentId = `pay_test_${Date.now()}`;
      const paymentOrderRes = await apiRequest("/api/payments/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookieA,
        },
        body: JSON.stringify({
          amount: 1000,
          currency: "INR",
          receipt: `receipt_test_${Date.now()}`,
          idempotencyKey: `payment_idemp_${Date.now()}`,
        }),
      });

      assert.equal(paymentOrderRes.status, 201);
      assert.ok(paymentOrderRes.body.orderId);

      const paymentVerifyRes = await apiRequest("/api/payments/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookieA,
        },
        body: JSON.stringify({
          orderId: paymentOrderRes.body.orderId,
          paymentId,
          signature: "sig_test_valid",
        }),
      });

      assert.equal(paymentVerifyRes.status, 200);
      assert.equal(paymentVerifyRes.body.verified, true);

      // 3. Book flight
      const bookingPayload = {
        offerId: offer.id,
        passengers: [
          {
            type: "ADULT",
            title: "Mr",
            firstName: "Aarav",
            lastName: "Sharma",
            dateOfBirth: "1990-05-15",
            gender: "MALE",
            nationality: "IN",
          },
        ],
        contact: {
          email: customerEmailA,
          phone: "9876543210",
        },
        addons: { extraBaggageKg: 0 },
        payment: {
          orderId: paymentOrderRes.body.orderId,
          paymentId,
          signature: "sig_test_valid",
        },
        idempotencyKey: `idemp_${Date.now()}`,
      };

      const res = await apiRequest("/api/flights/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookieA,
        },
        body: JSON.stringify(bookingPayload),
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.booking);
      assert.ok(res.body.booking.id);
      assert.ok(res.body.pnr);
      assert.equal(res.body.booking.status, "CONFIRMED");

      bookingIdA = res.body.booking.id;
    });

    it("Customer A sees only their own booking in /api/bookings", async () => {
      const res = await apiRequest("/api/bookings", {
        headers: { Cookie: sessionCookieA },
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.bookings));
      assert.equal(res.body.bookings.length, 1);
      assert.equal(res.body.bookings[0].id, bookingIdA);
    });

    it("Customer B CANNOT see Customer A's booking in their bookings list", async () => {
      const res = await apiRequest("/api/bookings", {
        headers: { Cookie: sessionCookieB },
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.bookings));
      assert.equal(res.body.bookings.length, 0, "Customer B must not see Customer A's booking");
    });

    it("Customer B CANNOT access Customer A's booking by direct ID", async () => {
      const res = await apiRequest(`/api/bookings/${bookingIdA}`, {
        headers: { Cookie: sessionCookieB },
      });

      assert.equal(res.status, 404);
    });
  });

  describe("4. Admin Authentication & Security Boundary", () => {
    it("strictly blocks unauthenticated requests to /api/admin/*", async () => {
      const res = await apiRequest("/api/admin/stats");
      assert.equal(res.status, 401);
      assert.equal(res.body.status, "unauthorized");
    });

    it("strictly blocks ordinary customers from accessing /api/admin/*", async () => {
      const res = await apiRequest("/api/admin/stats", {
        headers: { Cookie: sessionCookieA },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.status, "unauthorized");
    });

    it("rejects admin login with incorrect password", async () => {
      const res = await apiRequest("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: "zelevos-travelai00",
          password: "WrongAdminPassword!",
        }),
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.status, "invalid_credentials");
    });

    it("authenticates configured admin (zelevos-travelai00 / ZT002121) and returns session cookie", async () => {
      const res = await apiRequest("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: "zelevos-travelai00",
          password: "ZT002121",
        }),
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.admin);
      assert.equal(res.body.admin.adminId, "zelevos-travelai00");
      assert.equal(res.body.admin.passwordHash, undefined, "Admin password hash must never be returned");

      adminSessionCookie = res.cookie;
      assert.ok(adminSessionCookie.includes("wayora_admin_session="));
    });

    it("allows authenticated admin to view /api/admin/me", async () => {
      const res = await apiRequest("/api/admin/me", {
        headers: { Cookie: adminSessionCookie },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.admin.adminId, "zelevos-travelai00");
    });
  });

  describe("5. Admin Dashboard APIs (Stats, Customers, Bookings, Payments)", () => {
    it("returns accurate platform overview KPIs and recent items", async () => {
      const res = await apiRequest("/api/admin/stats", {
        headers: { Cookie: adminSessionCookie },
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.metrics);
      assert.ok(res.body.metrics.totalCustomers >= 2);
      assert.ok(res.body.metrics.totalFlightBookings >= 1);
      assert.ok(res.body.metrics.confirmedBookings >= 1);
      assert.ok(res.body.metrics.totalPaymentAmount > 0);
      assert.ok(Array.isArray(res.body.recentBookings));
      assert.ok(Array.isArray(res.body.recentCustomers));
    });

    it("lists customers with spend and booking count", async () => {
      const res = await apiRequest("/api/admin/customers", {
        headers: { Cookie: adminSessionCookie },
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.customers));

      const custA = res.body.customers.find((c: any) => c.email === customerEmailA);
      assert.ok(custA);
      assert.equal(custA.fullName, "Aarav Sharma");
      assert.equal(custA.phone, "+91 98765 43210");
      assert.equal(custA.customerId, customerIdA);
      assert.equal(custA.bookingCount, 1);
      assert.ok(custA.totalBookingValue > 0);
      assert.equal(custA.passwordHash, undefined);
    });

    it("filters and searches customers by name or customerId", async () => {
      const searchRes = await apiRequest(`/api/admin/customers?search=${encodeURIComponent("Aarav")}`, {
        headers: { Cookie: adminSessionCookie },
      });

      assert.equal(searchRes.status, 200);
      assert.equal(searchRes.body.customers.length, 1);
      assert.equal(searchRes.body.customers[0].email, customerEmailA);
    });

    it("returns full non-sensitive customer details and booking history", async () => {
      const res = await apiRequest(`/api/admin/customers/${customerIdA}`, {
        headers: { Cookie: adminSessionCookie },
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.customer);
      assert.equal(res.body.customer.customerId, customerIdA);
      assert.equal(res.body.customer.passwordHash, undefined);
      assert.ok(Array.isArray(res.body.bookings));
      assert.equal(res.body.bookings.length, 1);
      assert.ok(res.body.bookings[0].pnr);
      assert.ok(res.body.bookings[0].amount > 0);
    });

    it("lists all platform bookings with customer details", async () => {
      const res = await apiRequest("/api/admin/bookings", {
        headers: { Cookie: adminSessionCookie },
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.bookings));
      const booking = res.body.bookings.find((b: any) => b.id === bookingIdA);
      assert.ok(booking);
      assert.ok(booking.pnr);
      assert.equal(booking.customer.email, customerEmailA);
      assert.equal(booking.status, "CONFIRMED");
    });

    it("lists payments audit records without exposing secrets", async () => {
      const res = await apiRequest("/api/admin/payments", {
        headers: { Cookie: adminSessionCookie },
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.payments));
      assert.ok(res.body.payments.length >= 1);

      const payment = res.body.payments.find((p: any) => p.bookingId === bookingIdA);
      assert.ok(payment);
      assert.ok(payment.amount > 0);
      assert.equal(payment.status, "CAPTURED");
      assert.equal(payment.customer.email, customerEmailA);

      // Verify no Razorpay secrets anywhere in output
      const rawJson = JSON.stringify(res.body);
      assert.equal(rawJson.includes("rzp_live_secret"), false);
      assert.equal(rawJson.includes("key_secret"), false);
      assert.equal(rawJson.includes("passwordHash"), false);
    });
  });

  describe("6. Admin Change Password & Logout", () => {
    const newAdminPass = "NewZTSecret2026!";

    it("verifies current password and updates admin password hash", async () => {
      const res = await apiRequest("/api/admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminSessionCookie,
        },
        body: JSON.stringify({
          currentPassword: "ZT002121",
          newPassword: newAdminPass,
          confirmNewPassword: newAdminPass,
        }),
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    it("authenticates successfully with the newly set password", async () => {
      const res = await apiRequest("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: "zelevos-travelai00",
          password: newAdminPass,
        }),
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.admin);
      adminSessionCookie = res.cookie;
    });

    it("destroys admin session on logout", async () => {
      const logoutRes = await apiRequest("/api/admin/logout", {
        method: "POST",
        headers: { Cookie: adminSessionCookie },
      });

      assert.equal(logoutRes.status, 204);

      // Verify subsequent access is barred with 401
      const checkRes = await apiRequest("/api/admin/stats", {
        headers: { Cookie: adminSessionCookie },
      });
      assert.equal(checkRes.status, 401);
    });
  });
});
