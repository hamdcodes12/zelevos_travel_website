import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, or } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-for-zelevos-self-onboarding-suite";
process.env.ADMIN_ID = "zelevos-travelai00";
process.env.ADMIN_PASSWORD = "x";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app");
const {
  db,
  vendorsTable,
  vendorDocumentsTable,
  vendorServicesTable,
  usersTable,
  adminUsersTable,
  bookingServicesTable,
  bookingsTable,
  auditLogsTable,
  notificationsTable,
} = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
let adminCookie = "";

const uniqueId = Date.now().toString().slice(-6);
const testSupplierEmail = `test-supplier-${uniqueId}@himalayanadventures.com`;
const testSupplierPassword = "SecurePartnerPass2026!";

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  const { hashPassword } = await import("../src/lib/auth.js");
  const [existing] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.adminId, "zelevos-travelai00"))
    .limit(1);

  if (existing) {
    await db
      .update(adminUsersTable)
      .set({
        passwordHash: hashPassword("ZT002121"),
        totpEnabled: false,
        totpSecret: null,
      })
      .where(eq(adminUsersTable.id, existing.id));
  } else {
    await db.insert(adminUsersTable).values({
      adminId: "zelevos-travelai00",
      passwordHash: hashPassword("ZT002121"),
      role: "admin",
    });
  }

  // Admin login to acquire session cookie
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

describe("Supplier Self-Onboarding & Real Vendor Management Production Flow", () => {
  let registeredVendorId: string;
  let registeredVendorUuid: string;
  let vendorCookie = "";
  let createdServiceId: string;
  let uploadedDocFileUrl = "";

  it("1. Rejects invalid registration payload (missing businessName / invalid email)", async () => {
    const res = await fetch(`${baseUrl}/api/suppliers/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: "",
        contactName: "John Doe",
        email: "not-an-email",
        phone: "+91 99999 11111",
        serviceCategories: [],
      }),
    });

    assert.equal(res.status, 400, "Should return 400 Bad Request");
    const json = await res.json();
    assert.equal(json.status, "invalid_request");
    assert.ok(json.errors.length > 0, "Validation errors should be reported");
  });

  it("2. Real document upload via multipart/form-data stores file and returns fileUrl", async () => {
    const formData = new FormData();
    const dummyPdfContent = "%PDF-1.4 ... Fake test document content for Zelevos verification ...";
    const fileBlob = new Blob([dummyPdfContent], { type: "application/pdf" });
    formData.append("document", fileBlob, "himalaya_gst_certificate.pdf");
    formData.append("documentType", "gst_certificate");
    formData.append("title", "Himalaya Expeditions GST Certificate");

    const res = await fetch(`${baseUrl}/api/suppliers/upload-document`, {
      method: "POST",
      body: formData,
    });

    assert.equal(res.status, 201, "Document upload should succeed with HTTP 201");
    const json = await res.json();
    assert.equal(json.status, "success");
    assert.ok(json.fileUrl, "Should return fileUrl");
    assert.ok(json.fileName.endsWith(".pdf"), "Should preserve or assign PDF filename");
    uploadedDocFileUrl = json.fileUrl;
  });

  it("3. Supplier successfully self-registers with real business details and attached document", async () => {
    const res = await fetch(`${baseUrl}/api/suppliers/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: `Himalaya Heights Expeditions ${uniqueId}`,
        businessType: "Private Limited",
        contactName: "Tenzing Norgay",
        email: testSupplierEmail,
        phone: "+91 98160 55443",
        website: "https://himalayaheights.in",
        address: "Naggar Road, Prini",
        city: "Manali",
        state: "Himachal Pradesh",
        country: "India",
        registrationNumber: `REG-HP-${uniqueId}`,
        taxId: `02AAACH${uniqueId}A1Z5`,
        description: "Specialized in luxury alpine chalets and high-altitude 4x4 transfers",
        serviceCategories: ["Hotel / Accommodation", "Cab / Transfer", "Activity"],
        operatingLocations: ["Manali", "Solang", "Rohtang", "Spiti"],
        temporaryPassword: testSupplierPassword,
        documents: [
          {
            title: "Incorporation Certificate",
            documentType: "business_registration",
            fileUrl: uploadedDocFileUrl,
            fileName: "himalaya_incorporation.pdf",
          },
        ],
      }),
    });

    assert.equal(res.status, 201, "Supplier registration should return HTTP 201 Created");
    const json = await res.json();
    assert.equal(json.status, "success");
    assert.ok(json.vendor.vendorId.startsWith("SUP-") || json.vendor.vendorId.startsWith("VND-"), "Vendor ID should have SUP- or VND- prefix");
    assert.equal(json.vendor.status, "PENDING_APPROVAL", "Initial status should be PENDING_APPROVAL");
    assert.equal(json.vendor.approvalStatus, "pending", "Initial approvalStatus should be pending");

    registeredVendorId = json.vendor.vendorId;
    registeredVendorUuid = json.vendor.id;

    // Verify DB record existence in PostgreSQL
    const [dbVendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, registeredVendorUuid));
    assert.ok(dbVendor, "Vendor must persist in vendorsTable");
    assert.equal(dbVendor.email, testSupplierEmail);

    // Verify audit log creation
    const [auditLog] = await db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.resourceId, registeredVendorUuid))
      .limit(1);
    assert.ok(auditLog, "Audit log record must be created for registration");
    assert.equal(auditLog.action, "SUPPLIER_APPLICATION_SUBMITTED");
  });

  it("4. Prevents duplicate registration with the same email (HTTP 409 Conflict)", async () => {
    const res = await fetch(`${baseUrl}/api/suppliers/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: "Duplicate Attempt Co",
        contactName: "Different Person",
        email: testSupplierEmail, // Same email
        phone: "+91 99999 22222",
        serviceCategories: ["Hotel / Accommodation"],
      }),
    });

    assert.equal(res.status, 409, "Duplicate email registration must return 409 Conflict");
    const json = await res.json();
    assert.equal(json.status, "conflict");
  });

  it("5. Supplier checks live application status using email or vendorId", async () => {
    // 5a. Check by email
    const resByEmail = await fetch(
      `${baseUrl}/api/suppliers/application-status?email=${encodeURIComponent(testSupplierEmail)}`
    );
    assert.equal(resByEmail.status, 200, "Status query by email should succeed");
    const jsonByEmail = await resByEmail.json();
    assert.equal(jsonByEmail.status, "success");
    assert.equal(jsonByEmail.application.vendorId, registeredVendorId);
    assert.equal(jsonByEmail.application.status, "PENDING_APPROVAL");
    assert.ok(jsonByEmail.application.documents.length >= 1, "Should include attached documents");

    // 5b. Check by vendorId
    const resById = await fetch(
      `${baseUrl}/api/suppliers/application-status?vendorId=${encodeURIComponent(registeredVendorId)}`
    );
    assert.equal(resById.status, 200, "Status query by vendorId should succeed");
    const jsonById = await resById.json();
    assert.equal(jsonById.application.email, testSupplierEmail);

    // 5c. Unknown email returns 404
    const resNotFound = await fetch(`${baseUrl}/api/suppliers/application-status?email=nonexistent@nowhere.com`);
    assert.equal(resNotFound.status, 404, "Unknown applicant query should return 404");
  });

  it("6. Admin requests changes from applicant with review feedback notes", async () => {
    const res = await fetch(`${baseUrl}/api/admin/suppliers/${registeredVendorUuid}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        action: "request_changes",
        reason: "Please upload official Himachal Tourism Registration Certificate and update contact phone.",
      }),
    });

    assert.equal(res.status, 200, "Admin request_changes should succeed");
    const json = await res.json();
    assert.equal(json.status, "success");
    assert.equal(json.supplier.status, "CHANGES_REQUESTED");

    // Verify DB update
    const [updatedVendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, registeredVendorUuid));
    assert.equal(updatedVendor.status, "CHANGES_REQUESTED");
    assert.ok(updatedVendor.disciplinaryNotes?.includes("Himachal Tourism Registration Certificate"));
  });

  it("7. Supplier resubmits application with requested changes, setting status to UNDER_REVIEW", async () => {
    const res = await fetch(`${baseUrl}/api/suppliers/application/${registeredVendorUuid}/resubmit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resubmissionNotes: "Attached official Himachal Tourism License Certificate #HP-TOUR-2026-881.",
        documents: [
          {
            title: "Himachal Tourism License",
            documentType: "tourism_license",
            fileUrl: uploadedDocFileUrl,
            fileName: "himachal_tourism_license.pdf",
          },
        ],
      }),
    });

    assert.equal(res.status, 200, "Resubmission should return 200 OK");
    const json = await res.json();
    assert.equal(json.status, "success");
    assert.equal(json.application.status, "UNDER_REVIEW");

    // Verify DB update
    const [dbResubmitted] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, registeredVendorUuid));
    assert.equal(dbResubmitted.status, "UNDER_REVIEW");
  });

  it("8. Admin approves supplier, activating their vendor account and provisioning user login", async () => {
    const res = await fetch(`${baseUrl}/api/admin/suppliers/${registeredVendorUuid}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        action: "approve",
        reason: "Compliance documentation verified and approved for fulfillment.",
      }),
    });

    assert.equal(res.status, 200, "Approval should return HTTP 200");
    const json = await res.json();
    assert.equal(json.status, "success");
    assert.equal(json.supplier.status, "APPROVED");
    assert.equal(json.supplier.kycStatus, "verified");

    // Verify User record was provisioned with role 'vendor'
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, testSupplierEmail.toLowerCase()));
    assert.ok(user, "User account must be created in usersTable");
    assert.equal(user.role, "vendor", "User role must be vendor");
    assert.equal(user.vendorId, registeredVendorUuid, "User must link to vendor ID");
  });

  it("9. Approved vendor logs into the real Vendor Portal with their password", async () => {
    // 9a. Incorrect password fails
    const badLoginRes = await fetch(`${baseUrl}/api/vendor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testSupplierEmail, password: "WrongPassword999!" }),
    });
    assert.equal(badLoginRes.status, 401, "Invalid password should return 401 Unauthorized");

    // 9b. Correct password succeeds
    const loginRes = await fetch(`${baseUrl}/api/vendor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testSupplierEmail, password: testSupplierPassword }),
    });

    assert.equal(loginRes.status, 200, "Vendor login should succeed with HTTP 200");
    const loginData = await loginRes.json();
    assert.equal(loginData.status, "success");
    assert.equal(loginData.vendor.email, testSupplierEmail);

    vendorCookie = loginRes.headers.get("set-cookie")?.split(";")[0] || "";
    assert.ok(vendorCookie.length > 0, "Session cookie must be issued for vendor");
  });

  it("10. Authenticated vendor views their dashboard and isolated business records", async () => {
    const res = await fetch(`${baseUrl}/api/vendor/portal/dashboard`, {
      headers: { Cookie: vendorCookie },
    });

    assert.equal(res.status, 200, "Vendor portal dashboard access should succeed");
    const json = await res.json();
    assert.equal(json.status, "success");
    assert.equal(json.vendor.id, registeredVendorUuid);
    assert.equal(json.vendor.businessName, `Himalaya Heights Expeditions ${uniqueId}`);
    assert.ok(json.stats, "Dashboard statistics should be present");
  });

  it("11. Vendor creates and manages a real service catalog entry", async () => {
    const res = await fetch(`${baseUrl}/api/vendor/portal/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: vendorCookie,
      },
      body: JSON.stringify({
        serviceType: "Hotel",
        title: "Pine Haven Alpine Suite",
        location: "Solang Valley, Manali",
        rate: 5500,
        capacity: 3,
        availability: "Available Year-Round",
        description: "Panoramic pine mountain view with heated floors and fireplace",
      }),
    });

    assert.equal(res.status, 201, "Service creation should return HTTP 201");
    const json = await res.json();
    assert.equal(json.status, "success");
    assert.equal(json.service.title, "Pine Haven Alpine Suite");
    assert.equal(json.service.rate, 5500);

    createdServiceId = json.service.id;

    // Verify service in list
    const listRes = await fetch(`${baseUrl}/api/vendor/portal/services`, {
      headers: { Cookie: vendorCookie },
    });
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    assert.ok(listJson.services.some((s: any) => s.id === createdServiceId));
  });

  it("12. Operations assigns booking service -> Vendor accepts task -> uploads voucher", async () => {
    // 1. Create a real booking record in DB
    const [testBooking] = await db
      .insert(bookingsTable)
      .values({
        bookingId: `ZL-TEST-${uniqueId}`,
        travelDate: "2026-10-15",
        totalPrice: 18500,
        status: "CONFIRMED",
        paymentStatus: "SUCCESSFUL",
        customerContact: { name: "Arjun Verma", email: "arjun.verma@example.com", phone: "+91 98888 77777" },
        clientEmail: "arjun.verma@example.com",
      })
      .returning();

    // 2. Create a booking service assigned to this vendor
    const [bookingService] = await db
      .insert(bookingServicesTable)
      .values({
        bookingId: testBooking.id,
        serviceType: "Hotel",
        title: "Pine Haven Alpine Suite",
        assignedVendorId: registeredVendorUuid,
        status: "REQUESTED",
        supplierNetCost: 5500,
      })
      .returning();

    // 3. Vendor sees the request in their portal inbox
    const reqsRes = await fetch(`${baseUrl}/api/vendor/portal/requests`, {
      headers: { Cookie: vendorCookie },
    });
    assert.equal(reqsRes.status, 200);
    const reqsData = await reqsRes.json();
    const foundTask = reqsData.requests.find((r: any) => (r.id || r.task?.id) === bookingService.id);
    assert.ok(foundTask, "Vendor should see assigned task in portal inbox");

    // 4. Vendor accepts the booking task with confirmation ref
    const acceptRes = await fetch(`${baseUrl}/api/vendor/portal/requests/${bookingService.id}/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: vendorCookie,
      },
      body: JSON.stringify({ confirmationReference: `HML-CONF-${uniqueId}` }),
    });
    assert.equal(acceptRes.status, 200, "Accepting request should succeed");
    const acceptJson = await acceptRes.json();
    assert.equal(acceptJson.task.status, "ACCEPTED");
    assert.equal(acceptJson.task.supplierConfirmationRef, `HML-CONF-${uniqueId}`);

    // 5. Vendor uploads voucher and confirmation document
    const voucherRes = await fetch(`${baseUrl}/api/vendor/portal/requests/${bookingService.id}/voucher`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: vendorCookie,
      },
      body: JSON.stringify({
        voucherUrl: uploadedDocFileUrl,
        supplierConfirmationRef: `HML-CONF-${uniqueId}`,
      }),
    });
    assert.equal(voucherRes.status, 200, "Voucher upload should succeed");
    const voucherJson = await voucherRes.json();
    assert.equal(voucherJson.task.voucherUrl, uploadedDocFileUrl);

    // 6. Verify in DB
    const [dbService] = await db
      .select()
      .from(bookingServicesTable)
      .where(eq(bookingServicesTable.id, bookingService.id));
    assert.equal(dbService.status, "ACCEPTED");
    assert.equal(dbService.supplierConfirmationRef, `HML-CONF-${uniqueId}`);
  });

  it("13. Vendor submits real fulfillment invoice for finance settlement", async () => {
    const res = await fetch(`${baseUrl}/api/vendor/portal/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: vendorCookie,
      },
      body: JSON.stringify({
        invoiceNumber: `INV-HML-${uniqueId}`,
        amount: 5500,
        notes: "Completed fulfillment for pine alpine room",
      }),
    });

    assert.equal(res.status, 201, "Invoice creation should return HTTP 201");
    const json = await res.json();
    assert.equal(json.status, "success");
    assert.equal(json.invoice.invoiceNumber, `INV-HML-${uniqueId}`);
    assert.equal(json.invoice.amount, 5500);

    // Verify invoice list
    const invRes = await fetch(`${baseUrl}/api/vendor/portal/invoices`, {
      headers: { Cookie: vendorCookie },
    });
    assert.equal(invRes.status, 200);
    const invJson = await invRes.json();
    assert.ok(invJson.invoices.some((i: any) => i.invoiceNumber === `INV-HML-${uniqueId}`));
  });

  it("14. Security & RBAC: Unauthenticated access is rejected with 401/403", async () => {
    // Unauthenticated request to vendor portal dashboard
    const noAuthRes = await fetch(`${baseUrl}/api/vendor/portal/dashboard`);
    assert.equal(noAuthRes.status, 401, "Unauthenticated portal access must be blocked");

    // Vendor trying to access admin endpoint
    const vendorAdminRes = await fetch(`${baseUrl}/api/admin/suppliers`, {
      headers: { Cookie: vendorCookie },
    });
    assert.equal(vendorAdminRes.status, 403, "Vendor should be forbidden from accessing Admin API");
  });
});
