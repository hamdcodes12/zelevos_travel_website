import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, or } from "drizzle-orm";

process.env.SESSION_SECRET ??= "test-session-secret-for-zelevos-customer-archive-suite";
process.env.ADMIN_ID = "zelevos-travelai00";
process.env.ADMIN_PASSWORD = "x";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app.js");
const {
  db,
  usersTable,
  adminUsersTable,
  bookingsTable,
  paymentTransactionsTable,
  supportTicketsTable,
  auditLogsTable,
  sessionsTable,
} = await import("@workspace/db");
const { hashPassword } = await import("../src/lib/auth.js");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
let adminCookie = "";
let testUser: any = null;
let testBooking: any = null;
let testTransaction: any = null;
let testTicket: any = null;

const testCustomerEmail = `archive.test.${Date.now()}@zelevos.test`;
const testCustomerId = `ZLV-CUS-ARCH${Date.now().toString().slice(-6)}`;
const testPassword = "Password123!Secure";

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  // 1. Ensure test admin exists
  const [existingAdmin] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.adminId, "zelevos-travelai00"))
    .limit(1);

  if (existingAdmin) {
    await db
      .update(adminUsersTable)
      .set({
        passwordHash: hashPassword("Test-Admin-2026-Secure!"),
        totpEnabled: false,
        totpSecret: null,
      })
      .where(eq(adminUsersTable.id, existingAdmin.id));
  } else {
    await db.insert(adminUsersTable).values({
      adminId: "zelevos-travelai00",
      passwordHash: hashPassword("Test-Admin-2026-Secure!"),
      role: "admin",
    });
  }

  // Admin login
  const adminLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminId: "zelevos-travelai00",
      password: "Test-Admin-2026-Secure!",
    }),
  });
  assert.equal(adminLoginRes.status, 200, "Admin login must succeed");
  const rawSetCookie = adminLoginRes.headers.get("set-cookie") || "";
  adminCookie = rawSetCookie.split(";")[0];
  assert.ok(adminCookie, "Admin session cookie required");

  // 2. Create test customer with bookings, payments, and tickets
  const [createdUser] = await db
    .insert(usersTable)
    .values({
      email: testCustomerEmail,
      customerId: testCustomerId,
      fullName: "Archive Verification User",
      phone: "+919876500001",
      passwordHash: hashPassword(testPassword),
      emailVerified: true,
      status: "active",
      isArchived: false,
    })
    .returning();
  testUser = createdUser;

  // Add historical booking
  const [createdBooking] = await db
    .insert(bookingsTable)
    .values({
      ownerId: testUser.id,
      customerId: testUser.id,
      kind: "FLIGHT",
      bookingReference: `BK-TEST-${Date.now().toString().slice(-5)}`,
      pnr: "PNR-ARC1",
      amount: 14500,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      contactName: "Archive Verification User",
      contactEmail: testCustomerEmail,
      contactPhone: "+919876500001",
    })
    .returning();
  testBooking = createdBooking;

  // Add historical payment transaction
  const [createdTx] = await db
    .insert(paymentTransactionsTable)
    .values({
      bookingId: testBooking.id,
      userId: testUser.id,
      amount: 14500,
      currency: "INR",
      requestedAmount: 14500,
      capturedAmount: 14500,
      provider: "TEST",
      providerOrderId: `order_arc_${Date.now()}`,
      status: "CAPTURED",
    })
    .returning();
  testTransaction = createdTx;

  // Add historical support ticket
  const [createdTicket] = await db
    .insert(supportTicketsTable)
    .values({
      userId: testUser.id,
      email: testCustomerEmail,
      name: "Archive Verification User",
      subject: "Test enquiry for archive verification",
      description: "Please ensure this support ticket remains intact upon archiving.",
      status: "OPEN",
      priority: "MEDIUM",
      ticketNumber: `TKT-ARC-${Date.now().toString().slice(-4)}`,
    })
    .returning();
  testTicket = createdTicket;
});

after(async () => {
  // Clean up test data
  if (testUser?.id) {
    await db.delete(supportTicketsTable).where(eq(supportTicketsTable.userId, testUser.id));
    await db.delete(paymentTransactionsTable).where(eq(paymentTransactionsTable.userId, testUser.id));
    await db.delete(bookingsTable).where(or(eq(bookingsTable.ownerId, testUser.id), eq(bookingsTable.customerId, testUser.id)));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, testUser.id));
    await db.delete(auditLogsTable).where(or(eq(auditLogsTable.actorUserId, testUser.id), eq(auditLogsTable.resourceId, testUser.id)));
    await db.delete(usersTable).where(eq(usersTable.id, testUser.id));
  }
  if (server) {
    server.close();
  }
});

describe("Customer Soft Delete / Archive + Restore Endpoints & Security", () => {
  it("enforces admin authentication on archive and restore endpoints (RBAC/IDOR)", async () => {
    // Unauthenticated archive
    const unauthArchive = await fetch(`${baseUrl}/api/admin/customers/${testUser.id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Unauthorized attempt" }),
    });
    assert.equal(unauthArchive.status, 401, "Must require admin authentication");

    // Unauthenticated restore
    const unauthRestore = await fetch(`${baseUrl}/api/admin/customers/${testUser.id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(unauthRestore.status, 401, "Must require admin authentication");
  });

  it("verifies active customer appears in default active customer list", async () => {
    const res = await fetch(`${baseUrl}/api/admin/customers?search=${testCustomerId}`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    const found = data.customers?.find((c: any) => c.id === testUser.id);
    assert.ok(found, "Customer must be visible in default active list");
    assert.equal(found.isArchived, false);
    assert.equal(found.status, "active");
    assert.equal(found.customerId, testCustomerId);
    assert.equal(found.bookingCount, 1);
    assert.equal(found.totalBookingValue, 14500);
  });

  it("validates archive reason input (rejects empty or too short reasons)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/customers/${testUser.id}/archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ reason: "no" }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.status, "invalid_input");
  });

  it("archives customer without deleting customer or history (soft delete)", async () => {
    const archiveRes = await fetch(`${baseUrl}/api/admin/customers/${testUser.id}/archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        reason: "Customer Requested Account Closure",
        note: "Verified via customer email ticket #1029",
      }),
    });

    assert.equal(archiveRes.status, 200);
    const archiveData = await archiveRes.json();
    assert.equal(archiveData.status, "success");
    assert.equal(archiveData.customer.isArchived, true);
    assert.equal(archiveData.customer.status, "archived");
    assert.equal(archiveData.customer.customerId, testCustomerId, "Customer ID must be unchanged");

    // 1. Verify in database: row STILL exists (NO hard delete)
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, testUser.id)).limit(1);
    assert.ok(dbUser, "User row MUST remain in database");
    assert.equal(dbUser.isArchived, true);
    assert.equal(dbUser.status, "archived");
    assert.equal(dbUser.customerId, testCustomerId);
    assert.equal(dbUser.archiveReason, "Customer Requested Account Closure");
    assert.equal(dbUser.archiveNote, "Verified via customer email ticket #1029");
    assert.ok(dbUser.archivedAt, "archivedAt timestamp must be recorded");

    // 2. Verify all historical relations are 100% intact
    const [dbBooking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, testBooking.id));
    assert.ok(dbBooking, "Booking must not be deleted");
    assert.equal(dbBooking.status, "CONFIRMED");

    const [dbTx] = await db.select().from(paymentTransactionsTable).where(eq(paymentTransactionsTable.id, testTransaction.id));
    assert.ok(dbTx, "Payment transaction must not be deleted");
    assert.equal(dbTx.amount, 14500);

    const [dbTicket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, testTicket.id));
    assert.ok(dbTicket, "Support ticket must not be deleted");
  });

  it("prevents archiving an already archived customer", async () => {
    const res = await fetch(`${baseUrl}/api/admin/customers/${testUser.id}/archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ reason: "Duplicate Account" }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.status, "already_archived");
  });

  it("hides archived customer from default active list, shows in archived view", async () => {
    // 1. Default list (status=all): customer must be hidden
    const defaultRes = await fetch(`${baseUrl}/api/admin/customers?search=${testCustomerId}`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(defaultRes.status, 200);
    const defaultData = await defaultRes.json();
    const inDefault = defaultData.customers?.find((c: any) => c.id === testUser.id);
    assert.equal(inDefault, undefined, "Archived customer must NOT appear in normal active list");

    // 2. Archived list (status=archived): customer MUST appear
    const archivedRes = await fetch(`${baseUrl}/api/admin/customers?status=archived&search=${testCustomerId}`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(archivedRes.status, 200);
    const archivedData = await archivedRes.json();
    const inArchived = archivedData.customers?.find((c: any) => c.id === testUser.id);
    assert.ok(inArchived, "Customer MUST appear in archived list");
    assert.equal(inArchived.isArchived, true);
    assert.equal(inArchived.status, "archived");
    assert.equal(inArchived.archiveReason, "Customer Requested Account Closure");
    assert.equal(inArchived.archivedByName, "zelevos-travelai00");
    assert.equal(inArchived.bookingCount, 1);
    assert.equal(inArchived.totalBookingValue, 14500);
  });

  it("rejects login for archived customer with safe message", async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: testPassword,
      }),
    });

    assert.equal(loginRes.status, 403, "Archived customer login must be rejected");
    const loginData = await loginRes.json();
    assert.equal(loginData.status, "account_unavailable");
    assert.equal(loginData.message, "Your account is currently unavailable. Please contact Zelevos Support.");
  });

  it("allows authorized Admin to access complete historical dossier of archived customer", async () => {
    const dossierRes = await fetch(`${baseUrl}/api/admin/users/${testUser.id}/dossier`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(dossierRes.status, 200);
    const dossier = await dossierRes.json();

    assert.equal(dossier.user.id, testUser.id);
    assert.equal(dossier.user.customerId, testCustomerId);
    assert.equal(dossier.user.isArchived, true);
    assert.equal(dossier.user.status, "archived");
    assert.equal(dossier.user.archivedByName, "zelevos-travelai00");
    assert.equal(dossier.user.archiveReason, "Customer Requested Account Closure");

    // History is completely preserved
    assert.equal(dossier.bookings.length, 1);
    assert.equal(dossier.bookings[0].id, testBooking.id);
    assert.equal(dossier.payments.length, 1);
    assert.equal(dossier.supportTickets.length, 1);
    assert.equal(dossier.invoices.length, 1);

    // Timeline includes CUSTOMER_ARCHIVED event
    const archiveEvent = dossier.activityTimeline?.find((e: any) => e.eventType === "CUSTOMER_ARCHIVED");
    assert.ok(archiveEvent, "CUSTOMER_ARCHIVED timeline event must exist");
  });

  it("restores customer to active status while preserving permanent Customer ID and history", async () => {
    const restoreRes = await fetch(`${baseUrl}/api/admin/customers/${testUser.id}/restore`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({}),
    });

    assert.equal(restoreRes.status, 200);
    const restoreData = await restoreRes.json();
    assert.equal(restoreData.status, "success");
    assert.equal(restoreData.customer.isArchived, false);
    assert.equal(restoreData.customer.status, "active");
    assert.equal(restoreData.customer.customerId, testCustomerId, "Permanent Customer ID must remain unchanged");

    // Verify in database
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, testUser.id)).limit(1);
    assert.equal(dbUser.isArchived, false);
    assert.equal(dbUser.status, "active");
    assert.equal(dbUser.customerId, testCustomerId);
    assert.equal(dbUser.archivedAt, null);
    assert.equal(dbUser.archivedBy, null);
    assert.equal(dbUser.archiveReason, null);

    // Reappears in default active customer list
    const activeListRes = await fetch(`${baseUrl}/api/admin/customers?search=${testCustomerId}`, {
      headers: { Cookie: adminCookie },
    });
    const activeListData = await activeListRes.json();
    const inActive = activeListData.customers?.find((c: any) => c.id === testUser.id);
    assert.ok(inActive, "Restored customer must be visible in active list");

    // Disappears from archived customer list
    const archivedListRes = await fetch(`${baseUrl}/api/admin/customers?status=archived&search=${testCustomerId}`, {
      headers: { Cookie: adminCookie },
    });
    const archivedListData = await archivedListRes.json();
    const inArchived = archivedListData.customers?.find((c: any) => c.id === testUser.id);
    assert.equal(inArchived, undefined, "Restored customer must NOT appear in archived list");

    // Cannot restore again (not archived)
    const restoreAgainRes = await fetch(`${baseUrl}/api/admin/customers/${testUser.id}/restore`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({}),
    });
    assert.equal(restoreAgainRes.status, 400);
    const againData = await restoreAgainRes.json();
    assert.equal(againData.status, "not_archived");
  });

  it("allows restored customer to authenticate again", async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: testPassword,
      }),
    });

    assert.equal(loginRes.status, 200, "Restored customer must be able to log in");
    const loginData = await loginRes.json();
    assert.equal(loginData.user.customerId, testCustomerId);
    assert.equal(loginData.user.email, testCustomerEmail);
  });

  it("verifies audit log entries were recorded for both archive and restore", async () => {
    const auditLogs = await db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.resourceId, testUser.id));

    const archiveAudit = auditLogs.find((l: any) => l.action === "CUSTOMER_ARCHIVED");
    assert.ok(archiveAudit, "CUSTOMER_ARCHIVED audit log must be recorded");
    assert.equal(archiveAudit.resourceType, "user");
    assert.equal((archiveAudit.metadata as any)?.customerId, testCustomerId);
    assert.equal((archiveAudit.metadata as any)?.reason, "Customer Requested Account Closure");

    const restoreAudit = auditLogs.find((l: any) => l.action === "CUSTOMER_RESTORED");
    assert.ok(restoreAudit, "CUSTOMER_RESTORED audit log must be recorded");
    assert.equal(restoreAudit.resourceType, "user");
    assert.equal((restoreAudit.metadata as any)?.customerId, testCustomerId);
  });
});
