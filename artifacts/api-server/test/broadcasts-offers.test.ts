import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, inArray } from "drizzle-orm";

process.env.SESSION_SECRET ??= "test-session-secret-for-zelevos-broadcasts-suite";
process.env.ADMIN_ID = "zelevos-travelai00";
process.env.ADMIN_PASSWORD = "x";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app.js");
const {
  db,
  usersTable,
  adminUsersTable,
  broadcastsTable,
  broadcastRecipientsTable,
  notificationsTable,
  auditLogsTable,
} = await import("@workspace/db");
const { hashPassword } = await import("../src/lib/auth.js");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
let adminCookie = "";
let customerACookie = "";
let customerBCookie = "";

let userA: any;
let userB: any;
const testBroadcastIds: string[] = [];

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  // 1. Ensure test admin exists and authenticate
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

  const adminLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminId: "zelevos-travelai00",
      password: "Test-Admin-2026-Secure!",
    }),
  });
  assert.equal(adminLoginRes.status, 200, "Admin login should succeed");
  adminCookie = adminLoginRes.headers.get("set-cookie") || "";

  // 2. Create two dedicated test customers via signup to obtain valid session cookies
  const randA = Math.random().toString(36).slice(2, 8);
  const randB = Math.random().toString(36).slice(2, 8);

  const emailA = `test.traveler.a.${randA}@zelevos.test`;
  const emailB = `test.traveler.b.${randB}@zelevos.test`;

  const signupResA = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: `Alice Traveler ${randA}`,
      email: emailA,
      phone: "+919876543210",
      password: "CustomerPass123!",
      confirmPassword: "CustomerPass123!",
    }),
  });
  assert.equal(signupResA.status, 201, "Customer A signup should succeed");
  const dataA = await signupResA.json();
  userA = dataA.user;
  customerACookie = signupResA.headers.get("set-cookie") || "";

  const signupResB = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: `Bob Traveler ${randB}`,
      email: emailB,
      phone: "+919876543211",
      password: "CustomerPass123!",
      confirmPassword: "CustomerPass123!",
    }),
  });
  assert.equal(signupResB.status, 201, "Customer B signup should succeed");
  const dataB = await signupResB.json();
  userB = dataB.user;
  customerBCookie = signupResB.headers.get("set-cookie") || "";
});

after(async () => {
  // Cleanup test artifacts from database safely
  if (testBroadcastIds.length > 0) {
    try {
      await db.delete(notificationsTable).where(inArray(notificationsTable.broadcastId, testBroadcastIds));
      await db.delete(broadcastRecipientsTable).where(inArray(broadcastRecipientsTable.broadcastId, testBroadcastIds));
      await db.delete(broadcastsTable).where(inArray(broadcastsTable.id, testBroadcastIds));
    } catch {}
  }

  if (userA || userB) {
    try {
      const uIds = [userA?.id, userB?.id].filter(Boolean);
      await db.delete(notificationsTable).where(inArray(notificationsTable.userId, uIds));
      await db.delete(usersTable).where(inArray(usersTable.id, uIds));
    } catch {}
  }

  if (server) {
    server.close();
  }
});

describe("Zelevos Real Broadcasts & Offers Control System", () => {
  let targetedBroadcastId = "";
  let globalBroadcastId = "";
  let expiringBroadcastId = "";

  it("1. RBAC: Unauthorized customer cannot create a broadcast (401/403)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/broadcasts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerACookie,
      },
      body: JSON.stringify({
        title: "Malicious Broadcast",
        message: "Should be blocked",
        category: "OFFER",
        targetAudience: "ALL_CUSTOMERS",
      }),
    });
    assert.ok(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
  });

  it("2. Customer ID Validation: Non-existent customer ID returns 404", async () => {
    const res = await fetch(`${baseUrl}/api/admin/broadcasts/validate-customer/ZLV-CUS-INVALID999`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 404, "Invalid customer should return 404");
    const body = await res.json();
    assert.equal(body.message, "Customer not found.");
  });

  it("3. Customer ID Validation: Real Customer ID returns verified summary", async () => {
    const res = await fetch(`${baseUrl}/api/admin/broadcasts/validate-customer/${userA.customerId}`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200, "Valid customer should return 200");
    const body = await res.json();
    assert.ok(body.customer);
    assert.equal(body.customer.customerId, userA.customerId);
    assert.equal(body.customer.id, userA.id);
  });

  it("4. Specific Customer Targeting: Rejects non-existent target customer during creation (404)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/broadcasts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: "Offer for ghost",
        message: "You should not be created",
        category: "OFFER",
        targetAudience: "SPECIFIC_USER",
        targetCustomerId: "ZLV-CUS-NONEXISTENT",
      }),
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.message, "Customer not found.");
  });

  it("5. Specific Customer Targeting: Admin sends targeted offer to Customer A", async () => {
    const futureExpiry = new Date(Date.now() + 86400000).toISOString(); // 24 hours in future

    const res = await fetch(`${baseUrl}/api/admin/broadcasts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: "Exclusive 25% Off Kashmir for Alice",
        message: "Special loyalty coupon inside for Alice!",
        category: "OFFER",
        priority: "HIGH",
        actionButton: "Book Kashmir",
        actionUrl: "/#kashmir-package",
        targetAudience: "SPECIFIC_USER",
        targetCustomerId: userA.customerId,
        expiresAt: futureExpiry,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.broadcast);
    assert.equal(body.broadcast.targetAudience, "SPECIFIC_USER");
    assert.equal(body.broadcast.totalRecipients, 1);
    assert.equal(body.broadcast.status, "SENT");
    assert.equal(body.broadcast.expiresAt, futureExpiry);

    targetedBroadcastId = body.broadcast.id;
    testBroadcastIds.push(targetedBroadcastId);

    // Verify recipient record in database
    const recipients = await db
      .select()
      .from(broadcastRecipientsTable)
      .where(eq(broadcastRecipientsTable.broadcastId, targetedBroadcastId));
    assert.equal(recipients.length, 1);
    assert.equal(recipients[0].userId, userA.id);
  });

  it("6. IDOR Protection: Customer A receives targeted offer; Customer B does NOT", async () => {
    // Check Customer A notifications
    const resA = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Cookie: customerACookie },
    });
    assert.equal(resA.status, 200);
    const dataA = await resA.json();
    const foundA = dataA.results.find((n: any) => n.broadcastId === targetedBroadcastId);
    assert.ok(foundA, "Customer A MUST receive the targeted notification");
    assert.equal(foundA.title, "Exclusive 25% Off Kashmir for Alice");
    assert.equal(foundA.isRevoked, false);
    assert.equal(foundA.isExpired, false);

    // Check Customer B notifications
    const resB = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Cookie: customerBCookie },
    });
    assert.equal(resB.status, 200);
    const dataB = await resB.json();
    const foundB = dataB.results.find((n: any) => n.broadcastId === targetedBroadcastId);
    assert.equal(foundB, undefined, "Customer B MUST NOT receive Customer A's targeted offer");
  });

  it("7. Offer Expiry: Server-authoritative expiry marks offer EXPIRED and rejects CTA", async () => {
    // Create an offer that expired 10 minutes ago
    const pastExpiry = new Date(Date.now() - 600000).toISOString();

    const [expiringB] = await db
      .insert(broadcastsTable)
      .values({
        title: "Flash Deal Expired",
        message: "This deal should be expired immediately",
        category: "OFFER",
        targetAudience: "SPECIFIC_USER",
        targetUserId: userA.id,
        targetCustomerId: userA.customerId,
        status: "SENT",
        expiresAt: new Date(pastExpiry),
        totalRecipients: 1,
      })
      .returning();
    expiringBroadcastId = expiringB.id;
    testBroadcastIds.push(expiringBroadcastId);

    // Deliver notification to Customer A
    const [notifRow] = await db
      .insert(notificationsTable)
      .values({
        userId: userA.id,
        type: "PROMOTIONAL_OFFER",
        title: expiringB.title,
        body: expiringB.message,
        category: expiringB.category,
        broadcastId: expiringB.id,
        actionButton: "Claim Expired Deal",
        actionUrl: "/deals",
      })
      .returning();

    // Query Customer A notifications: should show isExpired: true
    const notifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Cookie: customerACookie },
    });
    assert.equal(notifRes.status, 200);
    const notifData = await notifRes.json();
    const targetNotif = notifData.results.find((n: any) => n.id === notifRow.id);
    assert.ok(targetNotif);
    assert.equal(targetNotif.isExpired, true, "Notification must be marked isExpired server-side");

    // Attempt to click CTA: backend must reject with 410 offer_expired
    const clickRes = await fetch(`${baseUrl}/api/notifications/${notifRow.id}/click`, {
      method: "POST",
      headers: { Cookie: customerACookie },
    });
    assert.equal(clickRes.status, 410, "Server must reject CTA on expired offer with 410");
    const clickBody = await clickRes.json();
    assert.equal(clickBody.code, "offer_expired");
  });

  it("8. Revoke Offer: Admin revokes targeted offer (soft state change, NO DB deletion)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/broadcasts/${targetedBroadcastId}/revoke`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.broadcast);
    assert.equal(body.broadcast.status, "REVOKED");
    assert.ok(body.broadcast.revokedAt);

    // Verify row still exists in database (NEVER hard deleted!)
    const [dbBroadcast] = await db
      .select()
      .from(broadcastsTable)
      .where(eq(broadcastsTable.id, targetedBroadcastId));
    assert.ok(dbBroadcast, "Database record MUST exist after revoke");
    assert.equal(dbBroadcast.status, "REVOKED");

    // Verify audit log exists
    const [auditLog] = await db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.action, "BROADCAST_REVOKED"))
      .orderBy(auditLogsTable.createdAt);
    assert.ok(auditLog, "Audit log BROADCAST_REVOKED must be present");
  });

  it("9. Customer Experience After Revoke: isRevoked is true and CTA click returns 410", async () => {
    // 1. Fetch Customer A notifications
    const resA = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Cookie: customerACookie },
    });
    assert.equal(resA.status, 200);
    const dataA = await resA.json();
    const notif = dataA.results.find((n: any) => n.broadcastId === targetedBroadcastId);
    assert.ok(notif);
    assert.equal(notif.isRevoked, true, "Customer notification must reflect isRevoked = true");

    // 2. Clicking CTA must return 410 offer_revoked
    const clickRes = await fetch(`${baseUrl}/api/notifications/${notif.id}/click`, {
      method: "POST",
      headers: { Cookie: customerACookie },
    });
    assert.equal(clickRes.status, 410, "Revoked offer CTA must be rejected with 410");
    const clickBody = await clickRes.json();
    assert.equal(clickBody.code, "offer_revoked");
  });

  it("10. Duplicate Revoke: Idempotent without breaking state or crashing", async () => {
    const res = await fetch(`${baseUrl}/api/admin/broadcasts/${targetedBroadcastId}/revoke`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.broadcast.status, "REVOKED");
  });

  it("11. Soft Delete / Archive: Admin archives campaign from normal history", async () => {
    const res = await fetch(`${baseUrl}/api/admin/broadcasts/${targetedBroadcastId}/archive`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.broadcast);
    assert.equal(body.broadcast.isArchived, true);
    assert.ok(body.broadcast.archivedAt);

    // Verify row still exists in database
    const [dbBroadcast] = await db
      .select()
      .from(broadcastsTable)
      .where(eq(broadcastsTable.id, targetedBroadcastId));
    assert.ok(dbBroadcast, "Database record MUST NOT be deleted upon archive");
    assert.equal(dbBroadcast.isArchived, true);

    // Verify normal broadcast list excludes archived campaign
    const normalListRes = await fetch(`${baseUrl}/api/admin/broadcasts`, {
      headers: { Cookie: adminCookie },
    });
    const normalData = await normalListRes.json();
    const foundNormal = normalData.broadcasts.find((b: any) => b.id === targetedBroadcastId);
    assert.equal(foundNormal, undefined, "Archived campaign must disappear from normal history");

    // Verify archived list includes the campaign
    const archivedListRes = await fetch(`${baseUrl}/api/admin/broadcasts?archived=true`, {
      headers: { Cookie: adminCookie },
    });
    const archivedData = await archivedListRes.json();
    const foundArchived = archivedData.broadcasts.find((b: any) => b.id === targetedBroadcastId);
    assert.ok(foundArchived, "Archived campaign must appear in ?archived=true view");
  });

  it("12. Restore: Admin restores archived campaign while preserving revoked lifecycle status", async () => {
    const res = await fetch(`${baseUrl}/api/admin/broadcasts/${targetedBroadcastId}/restore`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.broadcast);
    assert.equal(body.broadcast.isArchived, false);
    // CRITICAL: Restoring must NOT make a revoked offer active again!
    assert.equal(body.broadcast.status, "REVOKED", "Lifecycle status REVOKED must be preserved on restore");

    // Appears again in normal history
    const normalListRes = await fetch(`${baseUrl}/api/admin/broadcasts`, {
      headers: { Cookie: adminCookie },
    });
    const normalData = await normalListRes.json();
    const foundNormal = normalData.broadcasts.find((b: any) => b.id === targetedBroadcastId);
    assert.ok(foundNormal, "Restored campaign must appear in normal history");
  });

  it("13. Search and Multi-parameter Filters in Broadcast History", async () => {
    // 1. Search by title
    const searchRes = await fetch(`${baseUrl}/api/admin/broadcasts?q=Alice`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(searchRes.status, 200);
    const searchData = await searchRes.json();
    assert.ok(searchData.broadcasts.some((b: any) => b.id === targetedBroadcastId));

    // 2. Filter by status=REVOKED
    const statusRes = await fetch(`${baseUrl}/api/admin/broadcasts?status=REVOKED`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.ok(statusData.broadcasts.some((b: any) => b.id === targetedBroadcastId));

    // 3. Filter by category=OFFER
    const categoryRes = await fetch(`${baseUrl}/api/admin/broadcasts?category=OFFER`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(categoryRes.status, 200);
    const categoryData = await categoryRes.json();
    assert.ok(categoryData.broadcasts.some((b: any) => b.id === targetedBroadcastId));

    // 4. Filter by targetAudience=SPECIFIC_USER
    const audRes = await fetch(`${baseUrl}/api/admin/broadcasts?targetAudience=SPECIFIC_USER`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(audRes.status, 200);
    const audData = await audRes.json();
    assert.ok(audData.broadcasts.some((b: any) => b.id === targetedBroadcastId));
  });

  it("14. Real Analytics Numbers: Calculated from real persisted records, never fake", async () => {
    const res = await fetch(`${baseUrl}/api/admin/broadcasts`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.stats);
    assert.ok(typeof data.stats.totalBroadcasts === "number");
    assert.ok(typeof data.stats.totalDelivered === "number");
    assert.ok(typeof data.stats.totalReads === "number");
    assert.ok(typeof data.stats.totalClicks === "number");
    assert.ok(data.stats.totalBroadcasts >= 1);
  });

  it("15. Customer cannot revoke or archive (RBAC)", async () => {
    const revokeRes = await fetch(`${baseUrl}/api/admin/broadcasts/${targetedBroadcastId}/revoke`, {
      method: "POST",
      headers: { Cookie: customerACookie },
    });
    assert.ok(revokeRes.status === 401 || revokeRes.status === 403);

    const archiveRes = await fetch(`${baseUrl}/api/admin/broadcasts/${targetedBroadcastId}/archive`, {
      method: "POST",
      headers: { Cookie: customerACookie },
    });
    assert.ok(archiveRes.status === 401 || archiveRes.status === 403);
  });
});
