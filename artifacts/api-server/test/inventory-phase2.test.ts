import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-inventory";
process.env.CLIENT_BOOKING_EMAIL ??= "operations@zelevos.travel";
process.env.EMAIL_PROVIDER ??= "test";
process.env.PAYMENT_PROVIDER = "test";

const { default: app } = await import("../src/app");
const {
  db,
  usersTable,
  adminUsersTable,
  destinationsTable,
  packagesTable,
  packageDaysTable,
  hotelsTable,
  transfersTable,
  activitiesTable,
  auditLogsTable,
  vendorsTable,
} = await import("@workspace/db");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";

let adminCookie = "";
let customerCookie = "";
let customerEmail = "";
let testDestinationId = "";
let testDestinationSlug = "";
let testPackageId = "";
let testPackageSlug = "";
let testVendorId = "";

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  // 1. Create Admin
  const adminId = `ADM-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const adminPass = "AdminSecret123!";
  await db
    .insert(adminUsersTable)
    .values({
      adminId,
      passwordHash: hashPassword(adminPass),
      role: "admin",
    });

  const adminLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminId, password: adminPass }),
  });
  const adminSessionCookie = adminLoginRes.headers.get("set-cookie")?.split(";")[0] ?? "";

  const adminUserEmail = `superadmin-${crypto.randomUUID().slice(0, 6)}@zelevos.travel`;
  const admUserRes = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminUserEmail, password: "AdminPass123!" }),
  });
  const admUserCookie = admUserRes.headers.get("set-cookie")?.split(";")[0] ?? "";
  const admUserData = (await admUserRes.json()) as any;
  await db
    .update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.id, admUserData.user.id));

  adminCookie = `${adminSessionCookie}; ${admUserCookie}`;

  // 2. Create Regular Customer
  customerEmail = `customer-${crypto.randomUUID().slice(0, 6)}@example.com`;
  const custRes = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: customerEmail, password: "CustomerPass123!" }),
  });
  customerCookie = custRes.headers.get("set-cookie")?.split(";")[0] ?? "";

  // 3. Create a Contracted Vendor for Confidence Score calculations
  testVendorId = `VND-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  await db.insert(vendorsTable).values({
    vendorId: testVendorId,
    businessName: "Himalayan Luxury Tours & Logistics",
    contactName: "Tariq Ahmad",
    email: `vendor-${crypto.randomUUID().slice(0, 6)}@supplier.com`,
    phone: "+91 9900112233",
    acceptanceRate: "98",
    avgResponseMinutes: "20",
    cancellationRate: "0",
    approvalStatus: "approved",
  });

  // 4. Create Seed Destination
  testDestinationSlug = `kashmir-${crypto.randomUUID().slice(0, 6)}`;
  const [dest] = await db
    .insert(destinationsTable)
    .values({
      name: "Kashmir Paradise",
      slug: testDestinationSlug,
      country: "India",
      state: "Jammu & Kashmir",
      overview: "Experience breathtaking valleys, snow peaks, and iconic Dal Lake houseboats.",
      bestTravelPeriod: "April to October and December to February for skiing",
      heroImage: "/kashmir-dawn.jpg",
      status: "active",
    })
    .returning();

  testDestinationId = dest.id;
});

after(() => {
  server?.close();
});

async function api(path: string, options: RequestInit = {}, cookie?: string) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (cookie) {
    headers.set("Cookie", cookie);
  }
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
}

describe("PHASE 2 — INVENTORY: Comprehensive Subsystem Verification", () => {
  // --------------------------------------------------------------------------
  // 1. Destination Management
  // --------------------------------------------------------------------------
  it("1. Public destinations endpoint returns active destinations with package count", async () => {
    const res = await api("/api/destinations");
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(Array.isArray(body.results), "Must return results array");
    const found = body.results.find((d: any) => d.slug === testDestinationSlug);
    assert.ok(found, "Created destination must be present in public catalog");
    assert.equal(typeof found.packageCount, "number");
  });

  it("2. Admin can create, update, and list all destinations via admin endpoints", async () => {
    // Admin list all
    const listRes = await api("/api/admin/destinations", {}, adminCookie);
    assert.equal(listRes.status, 200);
    const listBody = (await listRes.json()) as any;
    assert.ok(Array.isArray(listBody.results));

    // Admin create new destination
    const newSlug = `ladakh-plateau-${crypto.randomUUID().slice(0, 6)}`;
    const createRes = await api(
      "/api/admin/destinations",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Ladakh High Altitude",
          slug: newSlug,
          country: "India",
          state: "Ladakh",
          overview: "Rugged desert mountains, high passes, and Buddhist monasteries.",
          bestTravelPeriod: "May to September",
          heroImage: "/ladakh-road.jpg",
          status: "active",
        }),
      },
      adminCookie
    );
    assert.equal(createRes.status, 201);
    const createBody = (await createRes.json()) as any;
    assert.ok(createBody.destination.id);
    assert.equal(createBody.destination.slug, newSlug);

    // Admin update destination
    const updateRes = await api(
      `/api/admin/destinations/${createBody.destination.id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          overview: "Updated high altitude trans-Himalayan region.",
        }),
      },
      adminCookie
    );
    assert.equal(updateRes.status, 200);
    const updateBody = (await updateRes.json()) as any;
    assert.equal(updateBody.destination.overview, "Updated high altitude trans-Himalayan region.");
  });

  // --------------------------------------------------------------------------
  // 2. Package CRUD with Day-by-Day Itinerary & Components
  // --------------------------------------------------------------------------
  it("3. Admin creates package with full Section 8 fields, itinerary days, hotels, transfers, and activities", async () => {
    testPackageSlug = `kashmir-alpine-${crypto.randomUUID().slice(0, 6)}`;
    const pkgPayload = {
      packageId: `ZL-KASH-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
      title: "Kashmir Alpine Luxury & Gondola Adventure",
      slug: testPackageSlug,
      destinationId: testDestinationId,
      locations: ["Srinagar", "Gulmarg", "Pahalgam"],
      durationDays: 6,
      durationNights: 5,
      theme: "adventure",
      travellerSuitability: "Suitable for couples, adventure enthusiasts and small families",
      baseCost: 35000,
      sellingPrice: 49500,
      markupType: "fixed",
      markupValue: 14500,
      serviceFee: 1500,
      inventory: 12,
      inclusions: [
        "5 Nights 4-Star Heated Accommodation",
        "Daily Gourmet Breakfast & Dinner",
        "Private 4x4 Chauffeur Vehicle Throughout",
        "Gulmarg Gondola Phase 1 & 2 Passes",
      ],
      exclusions: [
        "Flight Tickets (Available via Manual Flight Desk)",
        "Personal Camera Fees & Gratuities",
      ],
      policies: {
        cancellation: "Free cancellation up to 7 days before departure.",
        modification: "One free date modification allowed up to 48 hours before departure.",
        child: "Children below 5 years complimentary without extra bed.",
        payment: "100% advance payment required for confirmed voucher generation.",
      },
      media: {
        heroImage: "/kashmir-dawn.jpg",
        gallery: ["/kashmir-dawn.jpg", "/ladakh-road.jpg"],
      },
      status: "draft", // Start as DRAFT to verify publishing workflow
      assignedVendorIds: [testVendorId],
      featured: true,
      days: [
        {
          dayNumber: 1,
          title: "Srinagar Arrival & Dal Lake Houseboat",
          description: "Chauffeur airport pickup and transfer to luxury cedar-wood houseboat with evening Shikara ride.",
          mealsIncluded: "Dinner",
          hotelDetails: "Luxury Houseboat Srinagar",
        },
        {
          dayNumber: 2,
          title: "Ascent to Gulmarg Pine Valley",
          description: "Ascend through Tangmarg pine forests to Gulmarg. Check in to mountain resort.",
          mealsIncluded: "Breakfast & Dinner",
          hotelDetails: "Mountain Resort Gulmarg",
        },
      ],
      hotels: [
        {
          name: "Mascot Deluxe Houseboat",
          starRating: 4,
          roomType: "Super Deluxe Lake Front",
          mealPlan: "MAP (Breakfast & Dinner)",
          address: "Ghat 1, Dal Lake",
          city: "Srinagar",
          baseCostPerNight: 5000,
          sellingPricePerNight: 7500,
        },
        {
          name: "Khyber Himalayan Resort",
          starRating: 5,
          roomType: "Premier Pine View",
          mealPlan: "CP (Breakfast)",
          address: "Gondola Road",
          city: "Gulmarg",
          baseCostPerNight: 15000,
          sellingPricePerNight: 21000,
        },
      ],
      transfers: [
        {
          transferType: "private",
          vehicleType: "4x4 Toyota Scorpio / Innova",
          pickupLocation: "Srinagar Airport (SXR)",
          dropLocation: "Dal Lake / Gulmarg Circuit",
          durationMinutes: 90,
          luggageCapacity: "4 Large Bags",
          baseCost: 10000,
          sellingPrice: 14000,
        },
      ],
      activities: [
        {
          name: "Private Shikara Sunset Ride",
          durationHours: 2.0,
          difficultyLevel: "Easy",
          meetingPoint: "Dal Lake Ghat No 1",
          baseCost: 700,
          sellingPrice: 1200,
        },
        {
          name: "Gulmarg Gondola Phase 1 & 2 Passes",
          durationHours: 3.5,
          difficultyLevel: "Moderate",
          meetingPoint: "Gondola Terminal Gulmarg",
          baseCost: 2000,
          sellingPrice: 2800,
        },
      ],
    };

    const res = await api("/api/admin/packages", {
      method: "POST",
      body: JSON.stringify(pkgPayload),
    }, adminCookie);

    assert.equal(res.status, 201, "Package creation must return 201 Created");
    const body = (await res.json()) as any;
    assert.ok(body.package.id, "Package UUID must be generated");
    assert.equal(body.package.status, "draft", "Initial status must be draft");
    assert.equal(body.package.baseCost, 35000);
    assert.equal(body.package.sellingPrice, 49500);
    assert.equal(body.days.length, 2, "2 itinerary days must be stored");
    assert.equal(body.hotels.length, 2, "2 hotels must be stored");
    assert.equal(body.transfers.length, 1, "1 transfer must be stored");
    assert.equal(body.activities.length, 2, "2 activities must be stored");

    testPackageId = body.package.id;

    // Verify DB records directly
    const dbDays = await db.select().from(packageDaysTable).where(eq(packageDaysTable.packageId, testPackageId));
    assert.equal(dbDays.length, 2);

    const dbHotels = await db.select().from(hotelsTable).where(eq(hotelsTable.packageId, testPackageId));
    assert.equal(dbHotels.length, 2);

    const dbTransfers = await db.select().from(transfersTable).where(eq(transfersTable.packageId, testPackageId));
    assert.equal(dbTransfers.length, 1);

    const dbActivities = await db.select().from(activitiesTable).where(eq(activitiesTable.packageId, testPackageId));
    assert.equal(dbActivities.length, 2);
  });

  it("4. Admin package list (/api/admin/packages) shows draft packages and component counts", async () => {
    const res = await api("/api/admin/packages", {}, adminCookie);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(Array.isArray(body.results));
    const found = body.results.find((p: any) => p.id === testPackageId);
    assert.ok(found, "Draft package must appear in admin package listing");
    assert.equal(found.daysCount, 2);
    assert.equal(found.hotelsCount, 2);
    assert.equal(found.transfersCount, 1);
    assert.equal(found.activitiesCount, 2);
  });

  // --------------------------------------------------------------------------
  // 3. Status Lifecycle Transitions: DRAFT -> ACTIVE -> PAUSED -> ACTIVE -> ARCHIVED
  // --------------------------------------------------------------------------
  it("5. Customer catalog hides DRAFT packages", async () => {
    const res = await api("/api/packages");
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    const found = body.results.find((p: any) => p.id === testPackageId);
    assert.equal(found, undefined, "DRAFT package must NOT appear in public customer catalog");
  });

  it("6. Admin publishes package: DRAFT -> ACTIVE", async () => {
    const res = await api(`/api/admin/packages/${testPackageId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    }, adminCookie);

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.package.status, "active", "Package status must now be active");

    // Public catalog now displays active package
    const pubRes = await api("/api/packages");
    const pubBody = (await pubRes.json()) as any;
    const found = pubBody.results.find((p: any) => p.id === testPackageId);
    assert.ok(found, "ACTIVE package must now appear in public customer catalog");
  });

  it("7. Public package detail returns days, components, policies, and dynamic confidence score", async () => {
    const res = await api(`/api/packages/${testPackageSlug}`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(body.package);
    assert.equal(body.package.id, testPackageId);
    assert.ok(body.package.tripConfidenceScore);
    assert.ok(body.package.tripConfidenceScore.score >= 90, "Trip Confidence score must be high based on vendor metrics");
    assert.equal(body.package.days.length, 2);
    assert.equal(body.package.components.hotels.length, 2);
    assert.equal(body.package.components.transfers.length, 1);
    assert.equal(body.package.components.activities.length, 2);
    assert.ok(body.package.policies.cancellation);
  });

  it("8. Admin pauses package: ACTIVE -> PAUSED", async () => {
    const res = await api(`/api/admin/packages/${testPackageId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paused" }),
    }, adminCookie);

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.package.status, "paused");

    // Paused package is hidden from public catalog
    const pubRes = await api("/api/packages");
    const pubBody = (await pubRes.json()) as any;
    const found = pubBody.results.find((p: any) => p.id === testPackageId);
    assert.equal(found, undefined, "PAUSED package must be hidden from customer catalog");
  });

  it("9. Admin resumes package: PAUSED -> ACTIVE", async () => {
    const res = await api(`/api/admin/packages/${testPackageId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    }, adminCookie);

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.package.status, "active");

    // Verified back in public catalog
    const pubRes = await api("/api/packages");
    const pubBody = (await pubRes.json()) as any;
    const found = pubBody.results.find((p: any) => p.id === testPackageId);
    assert.ok(found, "Resumed package must be visible again");
  });

  it("10. Admin archives package: ACTIVE -> ARCHIVED and invalid transition is rejected", async () => {
    // Archive
    const res = await api(`/api/admin/packages/${testPackageId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" }),
    }, adminCookie);

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.package.status, "archived");

    // Attempt invalid transition: ARCHIVED -> ACTIVE should return 400
    const invalidRes = await api(`/api/admin/packages/${testPackageId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    }, adminCookie);

    assert.equal(invalidRes.status, 400, "Archived packages cannot be transitioned back to active directly");
  });

  // --------------------------------------------------------------------------
  // 4. Search and Filter Engine
  // --------------------------------------------------------------------------
  it("11. Search and filter queries behave correctly", async () => {
    // Create an active test package for filter assertions
    const searchSlug = `filter-test-${crypto.randomUUID().slice(0, 6)}`;
    const createRes = await api("/api/admin/packages", {
      method: "POST",
      body: JSON.stringify({
        packageId: `ZL-FLT-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
        title: "Unique Searchable Himalayas Expedition",
        slug: searchSlug,
        destinationId: testDestinationId,
        durationDays: 8,
        durationNights: 7,
        theme: "family",
        baseCost: 20000,
        sellingPrice: 32000,
        status: "active",
        days: [{ dayNumber: 1, title: "Day 1", description: "Desc" }],
      }),
    }, adminCookie);
    assert.equal(createRes.status, 201);

    // Filter by destination slug
    const destRes = await api(`/api/packages?destination=${testDestinationSlug}`);
    const destBody = (await destRes.json()) as any;
    assert.ok(destBody.results.length > 0);

    // Filter by theme
    const themeRes = await api("/api/packages?theme=family");
    const themeBody = (await themeRes.json()) as any;
    assert.ok(themeBody.results.some((p: any) => p.slug === searchSlug));

    // Filter by maxPrice
    const priceRes = await api("/api/packages?maxPrice=35000");
    const priceBody = (await priceRes.json()) as any;
    assert.ok(priceBody.results.some((p: any) => p.slug === searchSlug));

    // Filter by search keyword
    const kwRes = await api("/api/packages?search=Unique Searchable");
    const kwBody = (await kwRes.json()) as any;
    assert.ok(kwBody.results.some((p: any) => p.slug === searchSlug));
  });

  // --------------------------------------------------------------------------
  // 5. Security & RBAC Enforcement
  // --------------------------------------------------------------------------
  it("12. Customer and unauthenticated requests cannot mutate inventory (RBAC)", async () => {
    const mutationPayload = {
      packageId: "ZL-HACK-001",
      title: "Hacked Package",
      slug: "hacked-pkg",
      destinationId: testDestinationId,
      durationDays: 3,
      durationNights: 2,
      theme: "budget",
      baseCost: 1000,
      sellingPrice: 2000,
      status: "active",
    };

    // Unauthenticated
    const unauthRes = await api("/api/admin/packages", {
      method: "POST",
      body: JSON.stringify(mutationPayload),
    });
    assert.equal(unauthRes.status, 401, "Unauthenticated request must return 401");

    // Customer role
    const custRes = await api("/api/admin/packages", {
      method: "POST",
      body: JSON.stringify(mutationPayload),
    }, customerCookie);
    assert.equal(custRes.status, 403, "Customer user must return 403 Forbidden");

    // Customer cannot change status
    const statusRes = await api(`/api/admin/packages/${testPackageId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    }, customerCookie);
    assert.equal(statusRes.status, 403, "Customer cannot update status");
  });

  // --------------------------------------------------------------------------
  // 6. Input Validation
  // --------------------------------------------------------------------------
  it("13. Package creation rejects invalid inputs", async () => {
    // Missing required title
    const res1 = await api("/api/admin/packages", {
      method: "POST",
      body: JSON.stringify({
        packageId: "ZL-INV-001",
        slug: "invalid-pkg-1",
        destinationId: testDestinationId,
        durationDays: 3,
        durationNights: 2,
        theme: "adventure",
        baseCost: 10000,
        sellingPrice: 15000,
      }),
    }, adminCookie);
    assert.equal(res1.status, 400);

    // Negative selling price
    const res2 = await api("/api/admin/packages", {
      method: "POST",
      body: JSON.stringify({
        packageId: "ZL-INV-002",
        title: "Negative Price Package",
        slug: "invalid-pkg-2",
        destinationId: testDestinationId,
        durationDays: 3,
        durationNights: 2,
        theme: "adventure",
        baseCost: 10000,
        sellingPrice: -500,
      }),
    }, adminCookie);
    assert.equal(res2.status, 400);
  });

  // --------------------------------------------------------------------------
  // 7. Audit Logging
  // --------------------------------------------------------------------------
  it("14. Admin mutations generate immutable audit logs", async () => {
    const logs = await db
      .select()
      .from(auditLogsTable)
      .where(sql`${auditLogsTable.resourceId} = ${testPackageId}`);

    assert.ok(logs.length >= 2, "At least PACKAGE_CREATED and status transitions must be logged in audit_logs");
    const actions = logs.map((l: any) => l.action);
    assert.ok(actions.includes("PACKAGE_CREATED"), "PACKAGE_CREATED must be recorded");
    assert.ok(actions.includes("PACKAGE_STATUS_CHANGED"), "PACKAGE_STATUS_CHANGED must be recorded");
  });
});
