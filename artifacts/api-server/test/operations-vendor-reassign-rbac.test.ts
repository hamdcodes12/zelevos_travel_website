import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-for-zelevos-ops-reassign-rbac";
process.env.ADMIN_ID = "zelevos-travelai00";
process.env.ADMIN_PASSWORD = "ZT002121";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app");
const {
  db,
  bookingsTable,
  bookingServicesTable,
  vendorsTable,
  packagesTable,
  destinationsTable,
  adminUsersTable,
} = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
let adminCookie = "";

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Ensure admin credentials
  const { hashPassword } = await import("../src/lib/auth.js");
  const [existing] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.adminId, "zelevos-travelai00")).limit(1);
  if (existing) {
    await db.update(adminUsersTable).set({
      passwordHash: hashPassword("ZT002121"),
      totpEnabled: false,
    }).where(eq(adminUsersTable.id, existing.id));
  } else {
    await db.insert(adminUsersTable).values({
      adminId: "zelevos-travelai00",
      passwordHash: hashPassword("ZT002121"),
      role: "admin",
    });
  }

  // Admin login
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminId: "zelevos-travelai00", password: "ZT002121" }),
  });
  adminCookie = loginRes.headers.get("set-cookie") || "";
});

after(() => {
  server.close();
});

describe("Operations & Vendor: Reject-and-Reassign Flow + Vendor RBAC Isolation", () => {
  let vendorAId: string;
  let vendorBId: string;
  let bookingDbId: string;
  let bookingCode: string;
  let hotelTaskId: string;

  it("1. Sets up test vendors, package, and initial booking with tasks", async () => {
    // Ensure destination
    const [dest] = await db
      .insert(destinationsTable)
      .values({
        slug: "rajasthan-reassign-test",
        name: "Rajasthan Reassign Test",
        country: "India",
        state: "Rajasthan",
        city: "Jaipur",
        overview: "Royal palaces, vibrant deserts, and cultural heritage.",
        bestTravelPeriod: "October to March",
        heroImage: "/rajasthan.jpg",
        status: "active",
      })
      .onConflictDoUpdate({
        target: destinationsTable.slug,
        set: { name: "Rajasthan Reassign Test" },
      })
      .returning();

    // Vendor A
    const [vA] = await db
      .insert(vendorsTable)
      .values({
        vendorId: "VND-TEST-A",
        businessName: "Vendor Alpha Hotels",
        contactName: "Alpha Manager",
        email: "alpha@vendor.test",
        phone: "+91 99999 11111",
        approvalStatus: "approved",
      })
      .onConflictDoUpdate({
        target: vendorsTable.vendorId,
        set: { businessName: "Vendor Alpha Hotels" },
      })
      .returning();
    vendorAId = vA.id;

    // Vendor B
    const [vB] = await db
      .insert(vendorsTable)
      .values({
        vendorId: "VND-TEST-B",
        businessName: "Vendor Beta Resorts",
        contactName: "Beta Manager",
        email: "beta@vendor.test",
        phone: "+91 99999 22222",
        approvalStatus: "approved",
      })
      .onConflictDoUpdate({
        target: vendorsTable.vendorId,
        set: { businessName: "Vendor Beta Resorts" },
      })
      .returning();
    vendorBId = vB.id;

    // Package
    const [pkg] = await db
      .insert(packagesTable)
      .values({
        packageId: "ZL-TEST-REASSIGN-01",
        slug: "rajasthan-reassign-test-package",
        title: "Rajasthan Heritage Reassign Test",
        destinationId: dest.id,
        durationDays: 4,
        durationNights: 3,
        theme: "cultural",
        baseCost: 30000,
        sellingPrice: 40000,
        status: "active",
      })
      .onConflictDoUpdate({
        target: packagesTable.packageId,
        set: { title: "Rajasthan Heritage Reassign Test", status: "active" },
      })
      .returning();

    // Booking
    bookingCode = `ZL${Date.now().toString().slice(-8)}`;
    const [b] = await db
      .insert(bookingsTable)
      .values({
        bookingId: bookingCode,
        packageId: pkg.id,
        status: "PROCESSING",
        totalPrice: 40000,
        totalBaseCost: 30000,
        totalMarkup: 10000,
        contactName: "Aditya Roy",
        contactEmail: "aditya@example.com",
        contactPhone: "+91 98888 77777",
        paymentStatus: "captured",
      })
      .returning();
    bookingDbId = b.id;

    // Hotel task initially assigned to Vendor A
    const [task] = await db
      .insert(bookingServicesTable)
      .values({
        bookingId: bookingDbId,
        serviceType: "hotel",
        title: "Heritage Hotel Deluxe Room",
        assignedVendorId: vendorAId,
        status: "REQUESTED",
        deadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
      })
      .returning();
    hotelTaskId = task.id;

    assert.ok(hotelTaskId);
    assert.equal(task.assignedVendorId, vendorAId);
  });

  it("2. Vendor RBAC Isolation: Vendor B cannot accept Vendor A's assigned task", async () => {
    // Attempt by Vendor B to accept task assigned to Vendor A
    const res = await fetch(`${baseUrl}/api/vendor/portal/requests/${hotelTaskId}/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vendor-Id": vendorBId,
      },
      body: JSON.stringify({ confirmationRef: "INVALID-B-REF" }),
    });

    const body = await res.json();
    assert.equal(res.status, 403);
    assert.equal(body.status, "forbidden");
    assert.equal(body.message, "Not authorized to access tasks assigned to another vendor.");

    // Verify task is still in REQUESTED state
    const [taskBefore] = await db.select().from(bookingServicesTable).where(eq(bookingServicesTable.id, hotelTaskId));
    assert.equal(taskBefore.status, "REQUESTED");
  });

  it("3. Vendor A rejects the task with a reason (Sold out)", async () => {
    const res = await fetch(`${baseUrl}/api/vendor/portal/requests/${hotelTaskId}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vendor-Id": vendorAId,
      },
      body: JSON.stringify({ reason: "No deluxe room capacity available on travel date" }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "success");
    assert.equal(body.task.status, "REJECTED");
    assert.equal(body.task.rejectionReason, "No deluxe room capacity available on travel date");

    // Verify in database
    const [task] = await db.select().from(bookingServicesTable).where(eq(bookingServicesTable.id, hotelTaskId));
    assert.equal(task.status, "REJECTED");
  });

  it("4. Operations reassigns the rejected task to Vendor B with a fresh SLA deadline", async () => {
    const res = await fetch(`${baseUrl}/api/operations/tasks/${hotelTaskId}/reassign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        vendorId: vendorBId,
        notes: "Reassigned to Vendor Beta Resorts after Vendor Alpha reported no capacity.",
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "success");
    assert.equal(body.task.assignedVendorId, vendorBId);
    assert.equal(body.task.status, "REQUESTED");
    assert.ok(body.task.deadline);

    // Verify in database
    const [task] = await db.select().from(bookingServicesTable).where(eq(bookingServicesTable.id, hotelTaskId));
    assert.equal(task.assignedVendorId, vendorBId);
    assert.equal(task.status, "REQUESTED");
  });

  it("5. Vendor B accepts the reassigned task and uploads a confirmation voucher", async () => {
    // Vendor B accepts
    const acceptRes = await fetch(`${baseUrl}/api/vendor/portal/requests/${hotelTaskId}/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vendor-Id": vendorBId,
      },
      body: JSON.stringify({
        confirmationRef: "BETA-CONF-9876",
        notes: "Vendor Beta confirmed room availability.",
      }),
    });

    assert.equal(acceptRes.status, 200);
    const acceptBody = await acceptRes.json();
    assert.equal(acceptBody.task.status, "ACCEPTED");
    assert.equal(acceptBody.task.supplierConfirmationRef, "BETA-CONF-9876");

    // Vendor B uploads voucher
    const uploadRes = await fetch(`${baseUrl}/api/vendor/portal/requests/${hotelTaskId}/upload-document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vendor-Id": vendorBId,
      },
      body: JSON.stringify({
        documentType: "confirmation_voucher",
        documentUrl: "https://vouchers.zelevos.com/beta/BETA-CONF-9876.pdf",
        confirmationRef: "BETA-CONF-9876",
      }),
    });

    assert.equal(uploadRes.status, 200);
    const uploadBody = await uploadRes.json();
    assert.equal(uploadBody.task.voucherUrl, "https://vouchers.zelevos.com/beta/BETA-CONF-9876.pdf");
  });

  it("6. Operations verifies the task and booking resolves to CONFIRMED", async () => {
    const verifyRes = await fetch(`${baseUrl}/api/operations/tasks/${hotelTaskId}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        confirmationRef: "BETA-CONF-9876",
        voucherUrl: "https://vouchers.zelevos.com/beta/BETA-CONF-9876.pdf",
        notes: "Operations verified Vendor Beta voucher against itinerary schedule.",
      }),
    });

    assert.equal(verifyRes.status, 200);
    const verifyBody = await verifyRes.json();
    assert.equal(verifyBody.task.status, "VERIFIED");
    assert.equal(verifyBody.task.customerFacingVerified, true);

    // Master booking status reevaluation: all tasks for this booking are now verified!
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingDbId));
    assert.equal(booking.status, "CONFIRMED");
  });
});
