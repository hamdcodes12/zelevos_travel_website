import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, or } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-for-zelevos-suppliers-test-suite";
process.env.ADMIN_ID = "zelevos-travelai00";
process.env.ADMIN_PASSWORD = "x";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app");
const { db, vendorsTable, vendorDocumentsTable, vendorServicesTable, usersTable, adminUsersTable } = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
let adminCookie = "";

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  const { hashPassword } = await import("../src/lib/auth.js");
  const [existing] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.adminId, "zelevos-travelai00")).limit(1);
  if (existing) {
    await db.update(adminUsersTable).set({
      passwordHash: hashPassword("ZT002121"),
      totpEnabled: false,
      totpSecret: null,
    }).where(eq(adminUsersTable.id, existing.id));
  } else {
    await db.insert(adminUsersTable).values({
      adminId: "zelevos-travelai00",
      passwordHash: hashPassword("ZT002121"),
      role: "admin",
    });
  }

  // Admin login to get session cookie
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminId: "zelevos-travelai00", password: "ZT002121" }),
  });
  assert.equal(loginRes.status, 200, "Admin login should succeed");
  adminCookie = loginRes.headers.get("set-cookie")?.split(";")[0] || "";
});

after(async () => {
  if (server) {
    server.close();
  }
});

describe("Supplier & Vendor Management Complete Lifecycle Suite", () => {
  let createdSupplierId: string;
  let createdSupplierUuid: string;
  let testDocId: string;
  let testServiceId: string;
  const testEmail = `supplier.test.${Date.now()}@zelevos-partner.com`;
  const tempPassword = "CustomSupplierPass99!";

  it("1. Admin creates a new supplier with basic, business, multi-services and initial docs", async () => {
    const res = await fetch(`${baseUrl}/api/admin/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        businessName: "Himalayan Ridge Expeditions & Luxury Stays",
        contactName: "Anand Verma",
        email: testEmail,
        phone: "+91 98160 55443",
        address: "74, Old Manali Road",
        city: "Manali",
        state: "Himachal Pradesh",
        country: "India",
        registrationNumber: "REG-HP-2024-8841",
        taxId: "02AABCH8899A1Z1",
        description: "Premier luxury mountain stays and high-altitude transport fleet.",
        serviceCategories: ["Hotel", "Cab / Transfer", "Activity", "Guide"],
        temporaryPassword: tempPassword,
        documents: [
          {
            title: "GST Certificate",
            documentType: "gst_certificate",
            fileName: "gst_certificate.pdf",
            fileUrl: "/documents/sample-gst.pdf",
          },
        ],
      }),
    });

    assert.equal(res.status, 201, "Supplier creation must return 201 Created");
    const body = (await res.json()) as any;
    assert.ok(body.supplier, "Response must include supplier payload");
    assert.equal(body.supplier.businessName, "Himalayan Ridge Expeditions & Luxury Stays");
    assert.equal(body.supplier.status, "PENDING_APPROVAL", "New supplier must be PENDING_APPROVAL");

    createdSupplierUuid = body.supplier.id;
    createdSupplierId = body.supplier.vendorId;
  });

  it("2. Filters suppliers by PENDING_APPROVAL status and search query", async () => {
    const res = await fetch(`${baseUrl}/api/admin/suppliers?status=PENDING_APPROVAL&search=Himalayan`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(Array.isArray(body.suppliers));
    const match = body.suppliers.find((s: any) => s.id === createdSupplierUuid);
    assert.ok(match, "Created supplier must be present in search & pending results");
  });

  it("3. Fetches full supplier dossier (details, documents, services, financials)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(body.supplier);
    assert.equal(body.supplier.email, testEmail);
    assert.ok(Array.isArray(body.supplier.documents));
    assert.equal(body.supplier.documents.length, 1);
    assert.equal(body.supplier.documents[0].documentType, "gst_certificate");
    testDocId = body.supplier.documents[0].id;
    assert.ok(body.supplier.finance);
    assert.equal(body.supplier.finance.totalInvoiced, 0);
  });

  it("4. Updates supplier basic details and logs audit trail", async () => {
    const res = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        contactName: "Anand K. Verma (Director)",
        city: "Manali & Kullu",
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.supplier.contactName, "Anand K. Verma (Director)");
  });

  it("5. Admin verifies and rejects compliance documents", async () => {
    // Verify initial doc
    const verifyRes = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}/documents/${testDocId}/verify`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(verifyRes.status, 200);
    const verifyBody = (await verifyRes.json()) as any;
    assert.equal(verifyBody.document.status, "verified");

    // Upload second doc and reject it with reason
    const addDocRes = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        title: "Expired Insurance Proof",
        documentType: "insurance",
        fileName: "insurance_old.pdf",
        fileUrl: "/documents/insurance_old.pdf",
      }),
    });
    assert.equal(addDocRes.status, 201);
    const addDocBody = (await addDocRes.json()) as any;
    const doc2Id = addDocBody.document.id;

    const rejectDocRes = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}/documents/${doc2Id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ reason: "Policy expired on 2025-12-31" }),
    });
    assert.equal(rejectDocRes.status, 200);
    const rejectDocBody = (await rejectDocRes.json()) as any;
    assert.equal(rejectDocBody.document.status, "rejected");
    assert.equal(rejectDocBody.document.rejectionReason, "Policy expired on 2025-12-31");
  });

  it("6. Adds services and verifies they do NOT appear in package builder until supplier is approved", async () => {
    const addSvcRes = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        serviceType: "Hotel",
        title: "Cedar Forest Panoramic Villa",
        location: "Old Manali, HP",
        rate: 4200,
        capacity: 3,
        availability: "Available Year-Round",
      }),
    });
    assert.equal(addSvcRes.status, 201);
    const addSvcBody = (await addSvcRes.json()) as any;
    testServiceId = addSvcBody.service.id;

    // Check approved services list for package builder: Must NOT contain unapproved supplier services
    const approvedRes = await fetch(`${baseUrl}/api/admin/supplier-services/approved`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(approvedRes.status, 200);
    const approvedBody = (await approvedRes.json()) as any;
    const found = approvedBody.services.find((s: any) => s.service.id === testServiceId);
    assert.equal(found, undefined, "Services of PENDING_APPROVAL supplier must not be exposed for packages");
  });

  it("7. State Machine Guard: Rejects invalid transition (suspending a pending supplier)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ action: "suspend" }),
    });
    assert.equal(res.status, 400, "Suspending pending supplier must return 400");
  });

  it("8. Pending supplier is blocked from vendor portal login", async () => {
    const res = await fetch(`${baseUrl}/api/vendor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: tempPassword }),
    });
    assert.equal(res.status, 403, "Pending supplier login must be forbidden");
    const body = (await res.json()) as any;
    assert.equal(body.status, "pending_approval");
  });

  it("9. Admin approves supplier: provisions vendor user credentials and unlocks package builder", async () => {
    const res = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ action: "approve" }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.supplier.status, "APPROVED");

    // Package builder approved services now includes this service
    const approvedRes = await fetch(`${baseUrl}/api/admin/supplier-services/approved`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(approvedRes.status, 200);
    const approvedBody = (await approvedRes.json()) as any;
    const found = approvedBody.services.find((s: any) => s.service.id === testServiceId);
    assert.ok(found, "Approved supplier services must now be available for package builder");
  });

  it("10. Approved supplier logs in successfully to vendor portal", async () => {
    const res = await fetch(`${baseUrl}/api/vendor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: tempPassword }),
    });
    assert.equal(res.status, 200, "Approved supplier should log in successfully");
    const body = (await res.json()) as any;
    assert.equal(body.status, "success");
    assert.ok(body.user);
    assert.equal(body.user.role, "vendor");
    assert.equal(body.user.vendorId, createdSupplierUuid);
  });

  it("11. State Machine Transitions: Suspend and Reactivate", async () => {
    // Suspend
    const suspRes = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ action: "suspend", reason: "Seasonal maintenance" }),
    });
    assert.equal(suspRes.status, 200);
    const suspBody = (await suspRes.json()) as any;
    assert.equal(suspBody.supplier.status, "SUSPENDED");

    // Suspended supplier cannot log in
    const loginRes = await fetch(`${baseUrl}/api/vendor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: tempPassword }),
    });
    assert.equal(loginRes.status, 403);

    // Reactivate
    const reactRes = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ action: "reactivate" }),
    });
    assert.equal(reactRes.status, 200);
    const reactBody = (await reactRes.json()) as any;
    assert.equal(reactBody.supplier.status, "APPROVED");
  });

  it("12. Tenant Isolation & IDOR Protection: Vendor cannot access or edit other vendors' services", async () => {
    // Login as our vendor to get session cookie
    const loginRes = await fetch(`${baseUrl}/api/vendor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: tempPassword }),
    });
    const vendorCookie = loginRes.headers.get("set-cookie") || "";

    // Vendor accesses own services
    const ownRes = await fetch(`${baseUrl}/api/vendor/portal/services`, {
      headers: { Cookie: vendorCookie },
    });
    assert.equal(ownRes.status, 200);
    const ownBody = (await ownRes.json()) as any;
    assert.ok(ownBody.services.some((s: any) => s.id === testServiceId));

    // Create a foreign vendor with a service
    const [foreignVendor] = await db
      .insert(vendorsTable)
      .values({
        vendorId: `SUP-FOREIGN-${Date.now().toString().slice(-4)}`,
        businessName: "Foreign Desert Safari",
        contactName: "Desert Guide",
        email: `foreign.${Date.now()}@example.com`,
        phone: "+91 99999 11111",
        serviceCategories: ["Activity"],
        status: "APPROVED",
        approvalStatus: "approved",
      })
      .returning();

    const [foreignService] = await db
      .insert(vendorServicesTable)
      .values({
        vendorId: foreignVendor.id,
        serviceType: "Activity",
        title: "Private Dune Bashing",
        location: "Jaisalmer",
        rate: 3000,
        status: "active",
      })
      .returning();

    // Attacker (our vendor) attempts to edit foreign vendor's service via PUT /api/vendor/portal/services/:id
    const attackRes = await fetch(`${baseUrl}/api/vendor/portal/services/${foreignService.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: vendorCookie,
      },
      body: JSON.stringify({ title: "Hacked Service Title" }),
    });
    assert.equal(attackRes.status, 403, "Cross-tenant service modification must be rejected with 403 Forbidden");

    // Attacker attempts to spoof x-vendor-id header
    const spoofRes = await fetch(`${baseUrl}/api/vendor/portal/services`, {
      headers: {
        Cookie: vendorCookie,
        "x-vendor-id": foreignVendor.id,
      },
    });
    // Strict resolveCurrentVendor blocks cross-tenant spoofing when authenticated as vendor
    assert.equal(spoofRes.status, 403, "Spoofing x-vendor-id header must be rejected");
  });

  it("13. Temporary Suspension: Sets duration, reason, notes, and informs vendor during login", async () => {
    const tempRes = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        action: "temporary_suspend",
        durationDays: 14,
        reason: "Late response SLA violations on customer check-ins",
        notes: "Second warning issued. 14 days cool-off period.",
      }),
    });
    assert.equal(tempRes.status, 200);
    const body = (await tempRes.json()) as any;
    assert.equal(body.supplier.status, "SUSPENDED");
    assert.equal(body.supplier.suspensionType, "TEMPORARY");
    assert.ok(body.supplier.suspensionUntil, "Suspension until date must be set");
    assert.equal(body.supplier.suspensionReason, "Late response SLA violations on customer check-ins");

    // Vendor login receives rich temporary suspension message
    const loginRes = await fetch(`${baseUrl}/api/vendor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: tempPassword }),
    });
    assert.equal(loginRes.status, 403);
    const loginBody = (await loginRes.json()) as any;
    assert.equal(loginBody.status, "account_suspended");
    assert.equal(loginBody.suspensionType, "TEMPORARY");
    assert.ok(loginBody.message.includes("temporarily suspended"));
  });

  it("14. Misbehavior Strikes: Increments strikes and records audit trail", async () => {
    const strikeRes = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        action: "record_incident",
        incidentType: "GUEST_MISBEHAVIOR",
        reason: "Driver demanded unauthorized Rs 1000 cash surcharge at airport pickup",
      }),
    });
    assert.equal(strikeRes.status, 200);
    const body = (await strikeRes.json()) as any;
    assert.equal(body.supplier.misbehaviorStrikes, 1, "Misbehavior strikes counter must be incremented to 1");
    assert.ok(body.supplier.disciplinaryNotes.includes("STRIKE #1"), "Disciplinary notes must record strike");
  });

  it("15. Permanent Blacklist: Permanently locks vendor out from platform", async () => {
    const permRes = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        action: "permanent_suspend",
        reason: "Unethical practices and repeated customer extortion",
        notes: "Full committee review completed. Irreversible permanent blacklist.",
      }),
    });
    assert.equal(permRes.status, 200);
    const body = (await permRes.json()) as any;
    assert.equal(body.supplier.status, "SUSPENDED");
    assert.equal(body.supplier.suspensionType, "PERMANENT");
    assert.equal(body.supplier.suspensionUntil, null);

    // Vendor login receives permanent ban message
    const loginRes = await fetch(`${baseUrl}/api/vendor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: tempPassword }),
    });
    assert.equal(loginRes.status, 403);
    const loginBody = (await loginRes.json()) as any;
    assert.equal(loginBody.status, "account_suspended");
    assert.equal(loginBody.suspensionType, "PERMANENT");
    assert.ok(loginBody.message.includes("permanently suspended or blacklisted"));
  });

  it("16. Admin can safely remove / offboard vendor via DELETE", async () => {
    const delRes = await fetch(`${baseUrl}/api/admin/suppliers/${createdSupplierUuid}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert.equal(delRes.status, 200);
    const body = (await delRes.json()) as any;
    assert.equal(body.status, "success");
    assert.equal(body.supplier.status, "REMOVED");
  });
});
