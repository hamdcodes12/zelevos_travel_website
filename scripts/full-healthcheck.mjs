import assert from "node:assert/strict";

const API_BASE = "http://localhost:8080";
const WEB_BASE = "http://localhost:3000";

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;

async function check(name, fn) {
  process.stdout.write(`• Checking: ${name}... `);
  try {
    await fn();
    console.log(colors.green("PASSED"));
    passed++;
  } catch (err) {
    console.log(colors.red("FAILED"));
    console.error("  Error details:", err.message);
    failed++;
  }
}

async function run() {
  console.log(colors.bold("\n=========================================="));
  console.log(colors.bold("ZELEVOS FULL-STACK HEALTH CHECK (LOCALHOST)"));
  console.log(colors.bold("==========================================\n"));

  // 1. Web Frontend routes on localhost:3000
  await check("Frontend Home page (http://localhost:3000/)", async () => {
    const res = await fetch(`${WEB_BASE}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Zelevos") || html.includes("<div id=\"root\">"));
  });

  await check("Frontend Flights page (http://localhost:3000/flights)", async () => {
    const res = await fetch(`${WEB_BASE}/flights`);
    assert.equal(res.status, 200);
  });

  await check("Frontend Admin Portal page (http://localhost:3000/admin)", async () => {
    const res = await fetch(`${WEB_BASE}/admin`);
    assert.equal(res.status, 200);
  });

  await check("Favicon brand icon (http://localhost:3000/icon_zelevos.png)", async () => {
    const res = await fetch(`${WEB_BASE}/icon_zelevos.png`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/png");
  });

  // 2. Backend API routes on localhost:8080
  await check("Backend AI health API (/api/ai/health)", async () => {
    const res = await fetch(`${API_BASE}/api/ai/health`);
    // Returns 200 if key configured, or 503 with { configured: false } if no key
    assert.ok(res.status === 200 || res.status === 503);
    const data = await res.json();
    assert.ok(data.provider === "gemini");
  });

  await check("Backend Provider status API (/api/providers/status)", async () => {
    const res = await fetch(`${API_BASE}/api/providers/status`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.status && data.status.payments);
    assert.ok(data.status && data.status.flights);
  });

  // 3. Customer Authentication & Profile Flow
  const testEmail = `healthcheck_${Date.now()}@example.com`;
  const testPassword = "Password123!";
  const testPhone = "+91 98765 43210";
  let customerCookie = "";
  let customerId = "";

  await check("Customer Signup with customerId & phone (/api/auth/signup)", async () => {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Healthcheck Tester",
        email: testEmail,
        phone: testPhone,
        password: testPassword,
      }),
    });
    assert.equal(res.status, 201);
    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie && setCookie.includes("zelevos_session="));
    customerCookie = setCookie.split(";")[0];

    const data = await res.json();
    assert.ok(data.user);
    assert.equal(data.user.email, testEmail);
    assert.equal(data.user.phone, testPhone);
    assert.equal(data.user.status, "active");
    assert.ok(data.user.customerId && data.user.customerId.startsWith("CUST-"));
    assert.equal(data.user.passwordHash, undefined, "Password hash MUST NOT be exposed!");
    customerId = data.user.customerId;
  });

  await check("Customer Current User session verification (/api/auth/user)", async () => {
    const res = await fetch(`${API_BASE}/api/auth/user`, {
      headers: { Cookie: customerCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.email, testEmail);
    assert.equal(data.user.customerId, customerId);
    assert.equal(data.user.passwordHash, undefined);
  });

  await check("Customer Login with lastLoginAt update (/api/auth/login)", async () => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.user.lastLoginAt);
  });

  // 4. Admin Security & Admin Portal Flow
  let adminCookie = "";

  await check("Admin authorization boundary: blocks unauthenticated requests (401)", async () => {
    const res = await fetch(`${API_BASE}/api/admin/stats`);
    assert.equal(res.status, 401);
  });

  await check("Admin authorization boundary: blocks ordinary customer sessions (401)", async () => {
    const res = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: { Cookie: customerCookie },
    });
    assert.equal(res.status, 401);
  });

  await check("Admin Login with seeded credentials (zelevos-travelai00 / ZT002121)", async () => {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminId: "zelevos-travelai00",
        password: "ZT002121",
      }),
    });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie && setCookie.includes("zelevos_admin_session="));
    adminCookie = setCookie.split(";")[0];
    const data = await res.json();
    assert.equal(data.admin.adminId, "zelevos-travelai00");
    assert.equal(data.admin.passwordHash, undefined, "Admin password hash MUST NOT be exposed!");
  });

  await check("Admin Me profile verification (/api/admin/me)", async () => {
    const res = await fetch(`${API_BASE}/api/admin/me`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.admin.adminId, "zelevos-travelai00");
  });

  await check("Admin Stats KPI aggregation (/api/admin/stats)", async () => {
    const res = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.metrics);
    assert.equal(typeof data.metrics.totalCustomers, "number");
    assert.equal(typeof data.metrics.totalFlightBookings, "number");
    assert.ok(Array.isArray(data.recentBookings));
    assert.ok(Array.isArray(data.recentCustomers));
  });

  await check("Admin Customers listing & search (/api/admin/customers)", async () => {
    const res = await fetch(`${API_BASE}/api/admin/customers?search=${testEmail}`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.customers));
    const found = data.customers.find((c) => c.email === testEmail);
    assert.ok(found, "Newly created customer should be found in admin search");
    assert.equal(found.customerId, customerId);
  });

  await check("Admin Customer Details modal API (/api/admin/customers/:id)", async () => {
    const res = await fetch(`${API_BASE}/api/admin/customers/${customerId}`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.customer.customerId, customerId);
    assert.ok(Array.isArray(data.bookings));
  });

  // 5. Flight Search, Payment & Booking flow
  let sampleFlight = null;

  await check("Flight Search for DEL -> BOM (/api/flights/search)", async () => {
    const res = await fetch(`${API_BASE}/api/flights/search?from=DEL&to=BOM&departure=2026-10-15`);
    assert.equal(res.status, 200);
    const data = await res.json();
    const flights = data.flights || data.results || [];
    assert.ok(Array.isArray(flights));
    assert.ok(flights.length > 0);
    sampleFlight = flights[0];
  });

  await check("Payment Order Creation & Configuration Check (/api/payments/order)", async () => {
    const res = await fetch(`${API_BASE}/api/payments/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerCookie,
      },
      body: JSON.stringify({
        amount: 5499,
        currency: "INR",
        notes: { flight: sampleFlight?.flightNumber || "6E-201" },
      }),
    });
    // If PAYMENT_PROVIDER=razorpay without keys in .env, server safely guards with 500 error message.
    // If keys are present, server returns 201 with orderId.
    if (res.status === 201) {
      const data = await res.json();
      assert.ok(data.orderId);
      assert.equal(data.amount, 549900);
    } else {
      assert.equal(res.status, 500);
      const data = await res.json();
      assert.ok(data.message.includes("PAYMENT_PROVIDER is set to 'razorpay'"));
    }
  });

  await check("Admin Payments Audit Ledger (/api/admin/payments)", async () => {
    const res = await fetch(`${API_BASE}/api/admin/payments`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.payments));
  });

  // 7. Cleanup & Logout
  await check("Admin Logout (/api/admin/logout)", async () => {
    const res = await fetch(`${API_BASE}/api/admin/logout`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.ok(res.status === 204 || res.status === 200);
  });

  await check("Customer Logout (/api/auth/logout)", async () => {
    const res = await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: customerCookie },
    });
    assert.ok(res.status === 204 || res.status === 200);
  });

  console.log(colors.bold("\n------------------------------------------"));
  console.log(colors.bold(`RESULTS: ${colors.green(`${passed} PASSED`)}, ${failed === 0 ? colors.green("0 FAILED") : colors.red(`${failed} FAILED`)}`));
  console.log(colors.bold("------------------------------------------\n"));

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Unhandled exception:", err);
  process.exit(1);
});
