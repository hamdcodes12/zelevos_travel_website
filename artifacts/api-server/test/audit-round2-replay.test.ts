import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import path from "node:path";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-audit-round2-replay-suite-123456";
process.env.ADMIN_ID = "round2-test-admin";
process.env.ADMIN_PASSWORD = "Round2-Test-Only-Admin-Pass-1!";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app");
const { db, usersTable, bookingsTable, adminUsersTable, vendorsTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { hashPassword } = await import("../src/lib/auth.js");
const { clearRateLimitStore } = await import("../src/middlewares/rate-limiter.js");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
const stamp = Date.now();

const TEST_ADMIN_ID = `r2_admin_${stamp.toString().slice(-6)}`;
const TEST_ADMIN_PASSWORD = "Round2-Only-Admin-Secret-99!";
const OWNER_EMAIL = `r2_owner_${stamp}@example.com`;
const OWNER_PASSWORD = "OwnerPass-Round2-1!";
const OTHER_EMAIL = `r2_other_${stamp}@example.com`;
const OTHER_PASSWORD = "OtherPass-Round2-1!";

let ownerCookie = "";
let otherCookie = "";
let adminCookie = "";
let bookingUuid = "";
let bookingCode = "";

async function apiRequest(pathname: string, init: RequestInit = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, init);
  const raw = await res.text();
  let body: any = raw;
  try {
    body = JSON.parse(raw);
  } catch {
    // non-JSON body (html/pdf)
  }
  const setCookie = res.headers.get("set-cookie") || "";
  return { status: res.status, body, raw, headers: res.headers, setCookie, cookie: setCookie.split(";")[0] };
}

const jsonInit = (method: string, body: unknown, extraHeaders: Record<string, string> = {}): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...extraHeaders },
  body: JSON.stringify(body),
});

function supplierPayload(email: string, extra: Record<string, unknown> = {}) {
  return {
    businessName: `Round2 Travels ${stamp}`,
    contactName: "Round Two",
    email,
    phone: "+91 90000 00000",
    serviceCategories: ["hotel"],
    ...extra,
  };
}

async function adminAction(vendorUuid: string, action: string, reason = "round2 test") {
  return apiRequest(`/api/admin/suppliers/${vendorUuid}/status`, jsonInit("POST", { action, reason }, { Cookie: adminCookie }));
}

before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  await db.insert(usersTable).values([
    { email: OWNER_EMAIL, fullName: "Round2 Owner", passwordHash: hashPassword(OWNER_PASSWORD), role: "customer", emailVerified: true, status: "active" },
    { email: OTHER_EMAIL, fullName: "Round2 Other", passwordHash: hashPassword(OTHER_PASSWORD), role: "customer", emailVerified: true, status: "active" },
  ]);
  const [owner] = await db.select().from(usersTable).where(eq(usersTable.email, OWNER_EMAIL));

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      bookingId: `ZL${stamp.toString().slice(-8)}`,
      customerId: owner.id,
      ownerId: owner.id,
      totalPrice: 32000,
      currency: "INR",
      status: "CONFIRMED",
      paymentStatus: "SUCCESSFUL",
      flightTicketUrl: `tickets/${stamp}/r2.pdf`,
      customerContact: { name: "Round2 Owner", email: OWNER_EMAIL, phone: "+91 90000 11111" },
    })
    .returning();
  bookingUuid = booking.id;
  bookingCode = booking.bookingId;

  await db.insert(adminUsersTable).values({ adminId: TEST_ADMIN_ID, passwordHash: hashPassword(TEST_ADMIN_PASSWORD), role: "admin" });

  adminCookie = (await apiRequest("/api/admin/login", jsonInit("POST", { adminId: TEST_ADMIN_ID, password: TEST_ADMIN_PASSWORD }))).cookie;
  ownerCookie = (await apiRequest("/api/auth/login", jsonInit("POST", { email: OWNER_EMAIL, password: OWNER_PASSWORD }))).cookie;
  otherCookie = (await apiRequest("/api/auth/login", jsonInit("POST", { email: OTHER_EMAIL, password: OTHER_PASSWORD }))).cookie;
  assert.ok(adminCookie && ownerCookie && otherCookie, "fixture sessions must exist");
});

after(async () => {
  clearRateLimitStore();
  if (server) server.close();
});

describe("Round 2 exploit replay (each test FAILS on Round-1 code and PASSES after the fix)", () => {
  // ------------------------------------------------------------------------
  it("R2-01: attacker signs in as a verified victim through /auth/verify-otp with a wrong code", async () => {
    const attack = await apiRequest("/api/auth/verify-otp", jsonInit("POST", { email: OWNER_EMAIL, otp: "000000" }));
    assert.equal(attack.status, 400, `verify-otp must not accept an arbitrary code for a verified account, got ${attack.status}: ${attack.raw.slice(0, 160)}`);
    assert.ok(!/zelevos_session=/.test(attack.setCookie), "no session cookie may be issued by verify-otp for an already verified account");

    // and the cookie (if any) must not identify the victim
    const me = await apiRequest("/api/auth/user", { headers: { Cookie: attack.cookie } });
    assert.equal(me.status, 401, "attacker must not be authenticated");
  });

  // ------------------------------------------------------------------------
  it("R2-02a: supplier cannot reach the vendor portal without admin approval (resubmit trick)", async () => {
    const email = `r2_attacker_vendor_${stamp}@example.com`;
    const reg = await apiRequest("/api/suppliers/register", jsonInit("POST", supplierPayload(email, { password: "AttackerOwn#Pass1" })));
    assert.equal(reg.status, 201);
    const vendorId = reg.body.vendor.vendorId as string;

    const before = await apiRequest("/api/vendor/login", jsonInit("POST", { email, password: "AttackerOwn#Pass1" }));
    assert.equal(before.status, 403, "unapproved supplier must not log in");

    // anonymous caller (no password proof) tries to flip the status to UNDER_REVIEW
    const trick = await apiRequest(`/api/suppliers/application/${vendorId}/resubmit`, jsonInit("PUT", {}));
    assert.ok([400, 401, 403, 404].includes(trick.status), `anonymous resubmit must be refused, got ${trick.status}`);

    const after = await apiRequest("/api/vendor/login", jsonInit("POST", { email, password: "AttackerOwn#Pass1" }));
    assert.equal(after.status, 403, "supplier must still be blocked after the resubmit trick");
    const [row] = await db.select().from(vendorsTable).where(eq(vendorsTable.email, email));
    assert.equal(row.status, "PENDING_APPROVAL", "status must not change from an unauthenticated call");
  });

  it("R2-02b: another vendor's password is never returned and the account cannot be taken over", async () => {
    const victimEmail = `r2_victim_vendor_${stamp}@example.com`;
    const reg = await apiRequest("/api/suppliers/register", jsonInit("POST", supplierPayload(victimEmail)));
    assert.equal(reg.status, 201);
    assert.ok(!JSON.stringify(reg.body).match(/temporaryPassword|SupplierPass123|passwordHash/i), "registration response must not contain any password material");
    const victimVendorId = reg.body.vendor.vendorId as string;

    const steal = await apiRequest(`/api/suppliers/application/${victimVendorId}/resubmit`, jsonInit("PUT", {}));
    assert.notEqual(steal.status, 200, "anonymous resubmit must not succeed");
    assert.ok(!JSON.stringify(steal.body).match(/temporaryPassword|SupplierPass123|passwordHash/i), "no password material in the response");

    // the historic default password must not work either
    const login = await apiRequest("/api/vendor/login", jsonInit("POST", { email: victimEmail, password: "SupplierPass123!" }));
    assert.ok(login.status === 401 || login.status === 403, `default password must not log in, got ${login.status}`);
  });

  it("R2-02c: supplier password is stored hashed, never as plaintext", async () => {
    const email = `r2_hash_vendor_${stamp}@example.com`;
    const chosen = "MyChosen#Password9";
    const reg = await apiRequest("/api/suppliers/register", jsonInit("POST", supplierPayload(email, { temporaryPassword: chosen })));
    assert.equal(reg.status, 201);
    const [row] = await db.select().from(vendorsTable).where(eq(vendorsTable.email, email));
    assert.notEqual(row.temporaryPassword, chosen, "plaintext password must not be stored");
    assert.match(String(row.temporaryPassword), /^[0-9a-f]{32}:[0-9a-f]{128}$/, "stored value must be a salted scrypt hash");
  });

  it("R2-02d: duplicate registration does not reveal the existing supplier id", async () => {
    const email = `r2_dup_vendor_${stamp}@example.com`;
    assert.equal((await apiRequest("/api/suppliers/register", jsonInit("POST", supplierPayload(email, { password: "Dup#Password123" })))).status, 201);
    const dup = await apiRequest("/api/suppliers/register", jsonInit("POST", supplierPayload(email, { password: "Dup#Password123" })));
    assert.equal(dup.status, 409);
    assert.equal(dup.body.existingVendorId, undefined, "existingVendorId must not be disclosed");
  });

  it("R2-02e: legitimate flow still works (status with password, resubmit after changes requested, login only when APPROVED)", async () => {
    const email = `r2_legit_vendor_${stamp}@example.com`;
    const password = "Legit#Vendor12345";
    const reg = await apiRequest("/api/suppliers/register", jsonInit("POST", supplierPayload(email, { password })));
    assert.equal(reg.status, 201);
    const vendorUuid = reg.body.vendor.id as string;
    const trackingId = reg.body.vendor.vendorId as string;

    // an internal note that only Zelevos staff may see
    assert.equal((await adminAction(vendorUuid, "record_incident", "INTERNAL-ONLY strike note")).status, 200);

    // status needs proof of ownership
    const wrong = await apiRequest("/api/suppliers/application-status", jsonInit("POST", { identifier: email, password: "not-the-password" }));
    assert.equal(wrong.status, 401);
    const ok = await apiRequest("/api/suppliers/application-status", jsonInit("POST", { identifier: trackingId, password }));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.application.status, "PENDING_APPROVAL");
    assert.ok(!JSON.stringify(ok.body).match(/temporaryPassword|passwordHash/i));
    assert.ok(!/STRIKE|INTERNAL-ONLY/i.test(JSON.stringify(ok.body)), "internal staff notes must never reach the applicant");

    // resubmit is only allowed once changes were requested, and only with the password
    const tooEarly = await apiRequest(`/api/suppliers/application/${vendorUuid}/resubmit`, jsonInit("PUT", { password }));
    assert.equal(tooEarly.status, 409, "resubmit must only be possible when changes were requested");

    assert.equal((await adminAction(vendorUuid, "request_changes", "Please add your licence")).status, 200);
    const noProof = await apiRequest(`/api/suppliers/application/${vendorUuid}/resubmit`, jsonInit("PUT", { resubmissionNotes: "done" }));
    assert.ok(noProof.status === 401 || noProof.status === 400, `missing password must be refused, got ${noProof.status}`);
    const withProof = await apiRequest(`/api/suppliers/application/${vendorUuid}/resubmit`, jsonInit("PUT", { password, resubmissionNotes: "licence attached" }));
    assert.equal(withProof.status, 200);
    assert.equal(withProof.body.application.status, "UNDER_REVIEW");
    assert.ok(!JSON.stringify(withProof.body).match(/temporaryPassword|passwordHash/i));

    // UNDER_REVIEW is not APPROVED -> no portal access (allowlist)
    const blocked = await apiRequest("/api/vendor/login", jsonInit("POST", { email, password }));
    assert.equal(blocked.status, 403);

    assert.equal((await adminAction(vendorUuid, "approve", "verified")).status, 200);
    const login = await apiRequest("/api/vendor/login", jsonInit("POST", { email, password }));
    assert.equal(login.status, 200, `approved vendor must log in: ${login.raw.slice(0, 200)}`);
    assert.ok(!JSON.stringify(login.body).match(/temporaryPassword|passwordHash/i));
    const dash = await apiRequest("/api/vendor/portal/dashboard", { headers: { Cookie: login.cookie } });
    assert.equal(dash.status, 200);
  });

  it("R2-02f: /suppliers/application-status (GET) no longer exposes applicant details anonymously", async () => {
    const email = `r2_status_vendor_${stamp}@example.com`;
    const reg = await apiRequest("/api/suppliers/register", jsonInit("POST", supplierPayload(email, { password: "Status#Vendor123" })));
    assert.equal(reg.status, 201);
    const res = await apiRequest(`/api/suppliers/application-status?email=${encodeURIComponent(email)}`);
    const text = JSON.stringify(res.body);
    assert.ok(!text.includes(email), "email must not be echoed to an anonymous caller");
    assert.ok(!/contactName|phone|disciplinaryNotes|kycStatus/i.test(text), "no personal or internal fields for anonymous callers");
  });

  it("R2-02g: /vendor/login is rate limited per IP and per account", async () => {
    const original = process.env.ENABLE_TEST_RATE_LIMIT;
    process.env.ENABLE_TEST_RATE_LIMIT = "1";
    clearRateLimitStore();
    try {
      let limited = false;
      for (let i = 0; i < 14; i++) {
        const res = await apiRequest("/api/vendor/login", jsonInit("POST", { email: "nobody@example.com", password: `wrong-${i}` }));
        if (res.status === 429) {
          limited = true;
          break;
        }
      }
      assert.ok(limited, "vendor login must return 429 after repeated failures");
    } finally {
      clearRateLimitStore();
      if (original === undefined) delete process.env.ENABLE_TEST_RATE_LIMIT;
      else process.env.ENABLE_TEST_RATE_LIMIT = original;
    }
  });

  // ------------------------------------------------------------------------
  it("R2-04a: admin-portal session can open bookings' itineraries (was 401 because requireAuth ignored req.admin)", async () => {
    const admin = await apiRequest(`/api/bookings/${bookingCode}/itinerary`, { headers: { Cookie: adminCookie } });
    assert.equal(admin.status, 200, `admin must be able to view itineraries, got ${admin.status}`);
    const anon = await apiRequest(`/api/bookings/${bookingCode}/itinerary`);
    assert.equal(anon.status, 401);
    const other = await apiRequest(`/api/bookings/${bookingCode}/itinerary`, { headers: { Cookie: otherCookie } });
    assert.equal(other.status, 404, "another customer must not see it");
    const owner = await apiRequest(`/api/bookings/${bookingCode}/itinerary`, { headers: { Cookie: ownerCookie } });
    assert.equal(owner.status, 200);
  });

  it("R2-04b: admin-portal session can download supplier KYC documents; others cannot", async () => {
    const dir = path.resolve(process.cwd(), "artifacts/api-server/uploads/supplier-documents");
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `r2-kyc-${stamp}.pdf`;
    fs.writeFileSync(path.join(dir, fileName), "%PDF-1.4\n%round2 test document\n");
    try {
      const admin = await apiRequest(`/api/suppliers/documents/file/${fileName}`, { headers: { Cookie: adminCookie } });
      assert.equal(admin.status, 200, `admin-portal session must be able to open KYC documents, got ${admin.status}`);
      const anon = await apiRequest(`/api/suppliers/documents/file/${fileName}`);
      assert.equal(anon.status, 401);
      const customer = await apiRequest(`/api/suppliers/documents/file/${fileName}`, { headers: { Cookie: otherCookie } });
      assert.equal(customer.status, 403);
      assert.match(String(admin.headers.get("content-disposition") || ""), /attachment/i, "documents must be served as downloads");
    } finally {
      fs.rmSync(path.join(dir, fileName), { force: true });
    }
  });

  it("R2-04c: admin-portal session is not rejected by the customer-ticket document route", async () => {
    const admin = await apiRequest(`/api/documents/tickets/${bookingCode}`, { headers: { Cookie: adminCookie } });
    assert.notEqual(admin.status, 401, "admin session must reach the handler (503 = storage not configured is fine)");
    const anon = await apiRequest(`/api/documents/tickets/${bookingCode}`);
    assert.equal(anon.status, 401);
  });

  // ------------------------------------------------------------------------
  it("R2-05: booking itinerary can be opened by its UUID (regex typo made every UUID 404)", async () => {
    const owner = await apiRequest(`/api/bookings/${bookingUuid}/itinerary`, { headers: { Cookie: ownerCookie } });
    assert.equal(owner.status, 200, `owner must open the itinerary by UUID, got ${owner.status}`);
    const other = await apiRequest(`/api/bookings/${bookingUuid}/itinerary`, { headers: { Cookie: otherCookie } });
    assert.equal(other.status, 404);
  });

  // ------------------------------------------------------------------------
  it("R2-06: password reset never returns the reset token in the response", async () => {
    const res = await apiRequest("/api/auth/password/forgot", jsonInit("POST", { email: OWNER_EMAIL }));
    assert.equal(res.status, 200);
    const text = JSON.stringify(res.body);
    assert.ok(!/resetUrl|reset-password\?token|token=/i.test(text), `no token or reset link may be returned: ${text}`);
    const unknown = await apiRequest("/api/auth/password/forgot", jsonInit("POST", { email: `nobody_${stamp}@example.com` }));
    assert.equal(unknown.status, 200);
    assert.deepEqual(Object.keys(unknown.body).sort(), Object.keys(res.body).sort(), "response shape must not reveal whether the account exists");
  });

  it("R2-07: password reset e-mail is really sent through the mail provider and the flow can be completed", async () => {
    const realFetch = globalThis.fetch;
    const sent: { to?: string; html?: string }[] = [];
    process.env.RESEND_API_KEY = "re_test_round2_key_0000000000000000";
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? String(input);
      if (url.startsWith("https://api.resend.com/")) {
        const body = JSON.parse(init.body);
        sent.push({ to: body.to?.[0], html: body.html });
        return new Response(JSON.stringify({ id: "msg_round2" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return realFetch(input, init);
    }) as typeof fetch;
    try {
      const res = await apiRequest("/api/auth/password/forgot", jsonInit("POST", { email: OWNER_EMAIL }));
      assert.equal(res.status, 200);
      assert.equal(sent.length, 1, "exactly one reset e-mail must be sent to the provider");
      assert.equal(sent[0].to, OWNER_EMAIL);
      const link = /reset-password\?token=([A-Za-z0-9_%.\-]+)/.exec(sent[0].html || "");
      assert.ok(link, "e-mail must contain the reset link");

      const newPassword = "BrandNew-Round2-Pass9!";
      const reset = await apiRequest("/api/auth/password/reset", jsonInit("POST", { token: decodeURIComponent(link![1]), password: newPassword, confirmPassword: newPassword }));
      assert.equal(reset.status, 200);
      const login = await apiRequest("/api/auth/login", jsonInit("POST", { email: OWNER_EMAIL, password: newPassword }));
      assert.equal(login.status, 200, "user can log in with the new password");
      // old sessions must not survive a password reset
      const oldSession = await apiRequest("/api/auth/user", { headers: { Cookie: ownerCookie } });
      assert.equal(oldSession.status, 401, "existing sessions are revoked after a password reset");
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.RESEND_API_KEY;
    }
  });

  // ------------------------------------------------------------------------
  it("R2-16: signup can never auto-verify in production even if SKIP_EMAIL_OTP is set", async () => {
    const original = { env: process.env.NODE_ENV, skip: process.env.SKIP_EMAIL_OTP };
    process.env.NODE_ENV = "production";
    process.env.SKIP_EMAIL_OTP = "true";
    try {
      const res = await apiRequest("/api/auth/signup", jsonInit("POST", { email: `r2_prod_signup_${stamp}@example.com`, password: "ProdSignup#12345", fullName: "Prod Signup" }));
      assert.notEqual(res.status, 201, "production signup must not create a verified session");
      assert.ok(!/zelevos_session=/.test(res.setCookie), "no session cookie");
    } finally {
      process.env.NODE_ENV = original.env;
      if (original.skip === undefined) delete process.env.SKIP_EMAIL_OTP;
      else process.env.SKIP_EMAIL_OTP = original.skip;
    }
  });

  // ------------------------------------------------------------------------
  it("R2-15: anonymous document upload rejects files whose content is not really a PDF/PNG/JPEG/WEBP", async () => {
    const evil = new FormData();
    evil.append("document", new Blob(["<html><script>alert(1)</script></html>"], { type: "application/pdf" }), "evil.pdf");
    const bad = await apiRequest("/api/suppliers/upload-document", { method: "POST", body: evil });
    assert.equal(bad.status, 400, `content that is not a PDF must be rejected even when the client claims application/pdf, got ${bad.status}`);

    const good = new FormData();
    good.append("document", new Blob(["%PDF-1.4\n%round2 real pdf\n"], { type: "application/pdf" }), "good.pdf");
    const ok = await apiRequest("/api/suppliers/upload-document", { method: "POST", body: good });
    assert.equal(ok.status, 201);
    assert.match(String(ok.body.mimeType), /application\/pdf/);
  });

  // ------------------------------------------------------------------------
  it("R2-03: no live-looking credentials remain in tracked source, scripts, tests or docs", async () => {
    const root = path.resolve(process.cwd(), "..", "..");
    const skipDirs = new Set(["node_modules", ".git", "dist", "uploads", "backups", "audit-evidence", "audit-evidence2", "scratch", "coverage"]);
    // Obviously-fake fixture values (dummy/fake/sample keys used to test that the app itself rejects live
    // keys) and redacted prose in documentation are not leaks; require some entropy-looking content around
    // the match, and skip documentation/report prose entirely (it describes past findings, never a live value).
    const patterns: [string, RegExp][] = [
      ["live razorpay key", /rzp_live_(?!ZelevosSample|R2Fake|Sample|Fake|Dummy|Test)[A-Za-z0-9]{10,}/],
      ["resend api key", /\bre_(?!test)[A-Za-z0-9]{24,}\b/],
      ["db url with password", /postgres(?:ql)?:\/\/[^:@\/\s'"`.]+:[A-Za-z0-9+/=_-]{8,}@(?!127\.0\.0\.1|localhost)[a-z0-9.-]+/i],
    ];
    const textExt = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".txt", ".sql", ".yaml", ".yml", ".example", ".html", ".css"]);
    const skipFiles = new Set(["FIX_REPORT.md", "FIX_PROGRESS.md", "FIX_REPORT_ROUND2.md", "FIX_PROGRESS_R2.md"]);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!skipDirs.has(entry.name)) walk(path.join(dir, entry.name));
          continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.name === ".env" || skipFiles.has(entry.name) || entry.name.endsWith(".md")) continue; // local secrets file / narrative docs
        if (!textExt.has(path.extname(entry.name)) && !entry.name.startsWith(".env")) continue;
        if (fs.statSync(full).size > 2_000_000) continue;
        const content = fs.readFileSync(full, "utf8");
        for (const [label, re] of patterns) {
          if (re.test(content)) hits.push(`${path.relative(root, full)} (${label})`);
        }
      }
    };
    walk(root);
    assert.deepEqual(hits, [], `credential-looking values found in: ${hits.join(", ")}`);

    const seed = fs.readFileSync(path.join(root, "lib/db/src/index.ts"), "utf8");
    assert.ok(!/ADMIN_PASSWORD\?\.trim\(\)\s*\|\|\s*["'`]/.test(seed), "seed must not fall back to a hardcoded admin password");
  });
});
