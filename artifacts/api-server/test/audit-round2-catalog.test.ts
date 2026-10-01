import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "test-session-secret-audit-round2-catalog-123456";
process.env.PAYMENT_PROVIDER = "test";
process.env.EMAIL_PROVIDER ??= "test";

const { default: app } = await import("../src/app");
const { hashPassword } = await import("../src/lib/auth");
const {
  db,
  usersTable,
  adminUsersTable,
  vendorsTable,
  destinationsTable,
  packagesTable,
  packageDaysTable,
  hotelsTable,
  transfersTable,
  activitiesTable,
  bookingsTable,
  supportTicketsTable,
} = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");

// ---------------------------------------------------------------------------
// Sentinels: distinctive internal values. None of them may ever appear in a public response.
// ---------------------------------------------------------------------------
const SECRET = {
  baseCost: 918273,
  markupValue: "31.37",
  inventory: 4242,
  hotelBasePerNight: 4173,
  transferBase: 6291,
  activityBase: 811,
  vendorName: "Confidential Supplier QX9 Pvt Ltd",
};
const MEMBER_PRICE = 77777;
const MEMBER_CHEAP_PRICE = 900;
const MEMBER_ITINERARY_SECRET = "Members-only secret itinerary sentinel";
const MEMBER_INCLUSION_SECRET = "Members-only secret inclusion sentinel";
const MEMBER_HOTEL_SECRET = "Members Only Secret Palace Hotel";
const DRAFT_DESTINATION_SECRET = "Unpublished destination overview sentinel";

/** Keys that identify supplier cost, markup, vendor assignment or inventory internals. */
const FORBIDDEN_KEYS = [
  "baseCost",
  "baseCostPerNight",
  "markupType",
  "markupValue",
  "assignedVendorIds",
  "assignedVendors",
  "inventory",
  "serviceId",
];

const CARD_KEYS = [
  "durationDays",
  "durationNights",
  "destinationName",
  "destinationSlug",
  "featured",
  "id",
  "isMembersOnly",
  "locations",
  "locked",
  "media",
  "offerExpiresAt",
  "packageId",
  "sellingPrice",
  "slug",
  "theme",
  "title",
  "travellerSuitability",
  "tripConfidenceScore",
].sort();
const LOCKED_CARD_KEYS = CARD_KEYS.filter((key) => key !== "sellingPrice");

const DETAIL_KEYS = [
  "components",
  "days",
  "destination",
  "durationDays",
  "durationNights",
  "exclusions",
  "featured",
  "id",
  "inclusions",
  "isMembersOnly",
  "locations",
  "locked",
  "media",
  "offerExpiresAt",
  "packageId",
  "policies",
  "sellingPrice",
  "serviceFee",
  "slug",
  "theme",
  "title",
  "travellerSuitability",
  "tripConfidenceScore",
].sort();
const LOCKED_DETAIL_KEYS = [
  "destination",
  "durationDays",
  "durationNights",
  "featured",
  "id",
  "isMembersOnly",
  "locations",
  "locked",
  "media",
  "offerExpiresAt",
  "packageId",
  "slug",
  "theme",
  "title",
  "travellerSuitability",
  "tripConfidenceScore",
].sort();

const DESTINATION_KEYS = [
  "bestTravelPeriod",
  "city",
  "country",
  "faqs",
  "gallery",
  "heroImage",
  "highlights",
  "id",
  "name",
  "overview",
  "slug",
  "state",
].sort();

// ---------------------------------------------------------------------------
// Response shapes used by assertions
// ---------------------------------------------------------------------------
interface PublicCard {
  id: string;
  packageId: string;
  slug: string;
  title: string;
  sellingPrice?: number;
  isMembersOnly: boolean;
  locked: boolean;
  [key: string]: unknown;
}
interface PublicDetail extends PublicCard {
  serviceFee?: number;
  days?: Array<Record<string, unknown>>;
  components?: {
    hotels: Array<Record<string, unknown>>;
    transfers: Array<Record<string, unknown>>;
    activities: Array<Record<string, unknown>>;
  };
  destination: Record<string, unknown> | null;
}
interface ListResponse {
  results: PublicCard[];
}
interface DetailResponse {
  package: PublicDetail;
}
interface DestinationCard {
  id: string;
  slug: string;
  packageCount: number;
  [key: string]: unknown;
}
interface TicketCreateResponse {
  status: string;
  ticketNumber: string;
  message: string;
  ticket: { id: string; ticketNumber: string; status: string };
}
interface AdminTicket {
  id: string;
  ticketNumber: string;
  bookingId: string | null;
  userId: string | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let server: ReturnType<typeof app.listen>;
let baseUrl = "";
const runId = crypto.randomUUID().slice(0, 8);

let adminCookie = "";
let ownerCookie = "";
let otherCookie = "";

interface Fixture {
  id: string;
  packageId: string;
  slug: string;
}
const fx = {} as {
  destinationId: string;
  destinationSlug: string;
  draftDestinationId: string;
  draftDestinationSlug: string;
  vendorRowId: string;
  vendorCode: string;
  ownerUserId: string;
  otherUserId: string;
  adminRowId: string;
  publicPkg: Fixture;
  draftPkg: Fixture;
  archivedPkg: Fixture;
  pausedPkg: Fixture;
  expiredOfferPkg: Fixture;
  memberPkg: Fixture;
  memberCheapPkg: Fixture;
  underDraftDestPkg: Fixture;
  // Bookings: victim data for the C2 tests
  bookingOwnerOnly: { id: string; bookingId: string };
  bookingCustomerOnly: { id: string; bookingId: string };
};
const createdTicketNumbers: string[] = [];

async function api<T = unknown>(path: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, redirect: "manual" });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, headers: response.headers, text, body: parsed as T };
}

async function login(path: string, payload: Record<string, string>): Promise<string> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200, `login through ${path} must succeed`);
  const cookie = response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  assert.ok(cookie, `login through ${path} must issue a session cookie`);
  return cookie;
}

function collectKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      collectKeys(child, into);
    }
  }
  return into;
}

function collectLeaves(value: unknown, into: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    for (const item of value) collectLeaves(item, into);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectLeaves(child, into);
  } else {
    into.push(value);
  }
  return into;
}

/** Recursively proves that no supplier-cost / markup / vendor / inventory data is present, by key and by value. */
function assertNoInternalData(label: string, body: unknown) {
  const keys = collectKeys(body);
  for (const forbidden of FORBIDDEN_KEYS) {
    assert.ok(!keys.has(forbidden), `${label}: response must not contain the internal key "${forbidden}"`);
  }
  const leaves = collectLeaves(body);
  for (const numeric of [
    SECRET.baseCost,
    SECRET.inventory,
    SECRET.hotelBasePerNight,
    SECRET.transferBase,
    SECRET.activityBase,
  ]) {
    assert.ok(!leaves.includes(numeric), `${label}: internal value ${numeric} must not be present under any key`);
  }
  assert.ok(!leaves.includes(SECRET.markupValue), `${label}: internal markup value must not be present under any key`);
  assert.ok(!leaves.includes(fx.vendorCode), `${label}: assigned vendor code must not be present under any key`);
  assert.ok(
    !leaves.some((leaf) => typeof leaf === "string" && leaf.includes(SECRET.vendorName)),
    `${label}: supplier business name must not be present`,
  );
}

function assertKeys(label: string, actual: Record<string, unknown>, expected: string[]) {
  assert.deepEqual(Object.keys(actual).sort(), expected, `${label}: unexpected public field set`);
}

function pathOf(value: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object") return (current as Record<string, unknown>)[segment];
    return undefined;
  }, value);
}

function assertPresent(label: string, value: unknown, fields: Array<[string, "string" | "number" | "boolean" | "array" | "object"]>) {
  for (const [dotted, type] of fields) {
    const found = pathOf(value, dotted);
    if (type === "array") {
      assert.ok(Array.isArray(found), `${label}: the customer UI reads "${dotted}" (array) but it is missing`);
    } else if (type === "object") {
      assert.ok(found !== null && typeof found === "object", `${label}: the customer UI reads "${dotted}" (object) but it is missing`);
    } else {
      assert.equal(typeof found, type, `${label}: the customer UI reads "${dotted}" (${type}) but it is missing`);
    }
  }
}

const nowPlus = (ms: number) => new Date(Date.now() + ms);

async function seedPackage(input: {
  name: string;
  status?: string;
  destinationId?: string;
  sellingPrice?: number;
  serviceFee?: number;
  isMembersOnly?: boolean;
  featured?: boolean;
  offerExpiresAt?: Date | null;
  createdAt?: Date;
  withComponents?: boolean;
  itinerarySecret?: string;
  inclusionSecret?: string;
  hotelName?: string;
}): Promise<Fixture> {
  const slug = `r2-${input.name}-${runId}`;
  const packageId = `R2-${input.name.toUpperCase()}-${runId.toUpperCase()}`;
  const [pkg] = await db
    .insert(packagesTable)
    .values({
      packageId,
      title: `Round2 ${input.name} package`,
      slug,
      destinationId: input.destinationId ?? fx.destinationId,
      locations: ["Srinagar", "Gulmarg"],
      durationDays: 5,
      durationNights: 4,
      theme: "adventure",
      travellerSuitability: "Couples and families",
      baseCost: SECRET.baseCost,
      sellingPrice: input.sellingPrice ?? 20000,
      markupType: "percentage",
      markupValue: SECRET.markupValue,
      serviceFee: input.serviceFee ?? 500,
      inventory: SECRET.inventory,
      inclusions: [input.inclusionSecret ?? "Breakfast and dinner", "Private transfers"],
      exclusions: ["Flights", "Personal expenses"],
      policies: {
        cancellation: "Free cancellation up to 7 days before departure.",
        modification: "One free date change.",
        child: "Children below 5 travel free.",
        payment: "100% advance payment.",
      },
      media: { heroImage: "/round2-hero.jpg", gallery: ["/round2-hero.jpg"] },
      status: input.status ?? "active",
      assignedVendorIds: [fx.vendorCode],
      featured: input.featured ?? false,
      isMembersOnly: input.isMembersOnly ?? false,
      offerExpiresAt: input.offerExpiresAt ?? null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    })
    .returning();

  if (input.withComponents !== false) {
    await db.insert(packageDaysTable).values([
      {
        packageId: pkg.id,
        dayNumber: 1,
        title: "Arrival",
        description: input.itinerarySecret ?? "Airport pickup and houseboat check-in.",
        mealsIncluded: "Dinner",
      },
      { packageId: pkg.id, dayNumber: 2, title: "Gulmarg", description: "Gondola day.", mealsIncluded: "Breakfast" },
    ]);
    await db.insert(hotelsTable).values({
      packageId: pkg.id,
      name: input.hotelName ?? "Round2 Public Hotel",
      starRating: "4",
      roomType: "Deluxe Lake View",
      mealPlan: "MAP",
      address: "Ghat 1, Dal Lake",
      city: "Srinagar",
      baseCostPerNight: SECRET.hotelBasePerNight,
      sellingPricePerNight: 5200,
    });
    await db.insert(transfersTable).values({
      packageId: pkg.id,
      vehicleType: "SUV",
      pickupLocation: "Srinagar Airport",
      dropLocation: "Dal Lake",
      baseCost: SECRET.transferBase,
      sellingPrice: 7400,
    });
    await db.insert(activitiesTable).values({
      packageId: pkg.id,
      name: "Shikara sunset ride",
      durationHours: "2.5",
      meetingPoint: "Ghat 1",
      baseCost: SECRET.activityBase,
      sellingPrice: 1300,
    });
  }
  return { id: pkg.id, packageId, slug };
}

before(async () => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Users: the booking owner and an unrelated customer
  const ownerPassword = "OwnerPass123!";
  const otherPassword = "OtherPass123!";
  const [owner] = await db
    .insert(usersTable)
    .values({
      email: `r2_owner_${runId}@example.com`,
      fullName: "Round2 Owner",
      passwordHash: hashPassword(ownerPassword),
      role: "customer",
      emailVerified: true,
      status: "active",
    })
    .returning();
  const [other] = await db
    .insert(usersTable)
    .values({
      email: `r2_other_${runId}@example.com`,
      fullName: "Round2 Other Customer",
      passwordHash: hashPassword(otherPassword),
      role: "customer",
      emailVerified: true,
      status: "active",
    })
    .returning();
  fx.ownerUserId = owner.id;
  fx.otherUserId = other.id;

  // Admin
  const adminId = `r2adm_${runId}`;
  const adminPassword = "AdminRound2Secret123!";
  const [adminRow] = await db
    .insert(adminUsersTable)
    .values({ adminId, passwordHash: hashPassword(adminPassword), role: "admin" })
    .returning();
  fx.adminRowId = adminRow.id;

  adminCookie = await login("/api/admin/login", { adminId, password: adminPassword });
  ownerCookie = await login("/api/auth/login", { email: owner.email, password: ownerPassword });
  otherCookie = await login("/api/auth/login", { email: other.email, password: otherPassword });

  // Supplier with a recognisable business name
  fx.vendorCode = `VND-R2-${runId.toUpperCase()}`;
  const [vendor] = await db
    .insert(vendorsTable)
    .values({
      vendorId: fx.vendorCode,
      businessName: SECRET.vendorName,
      contactName: "Round2 Vendor",
      email: `r2_vendor_${runId}@supplier.example`,
      phone: "+91 90000 00000",
      acceptanceRate: "98",
      avgResponseMinutes: "20",
      cancellationRate: "0",
      approvalStatus: "approved",
    })
    .returning();
  fx.vendorRowId = vendor.id;

  // Destinations: one published, one draft
  fx.destinationSlug = `r2-kashmir-${runId}`;
  const [dest] = await db
    .insert(destinationsTable)
    .values({
      name: "Round2 Kashmir",
      slug: fx.destinationSlug,
      country: "India",
      state: "Jammu & Kashmir",
      overview: "Published destination overview.",
      bestTravelPeriod: "April to October",
      heroImage: "/round2-dest.jpg",
      status: "active",
    })
    .returning();
  fx.destinationId = dest.id;

  fx.draftDestinationSlug = `r2-draft-dest-${runId}`;
  const [draftDest] = await db
    .insert(destinationsTable)
    .values({
      name: "Round2 Unreleased Destination",
      slug: fx.draftDestinationSlug,
      country: "India",
      state: "Ladakh",
      overview: DRAFT_DESTINATION_SECRET,
      bestTravelPeriod: "May to September",
      heroImage: "/round2-draft-dest.jpg",
      status: "draft",
    })
    .returning();
  fx.draftDestinationId = draftDest.id;

  // Packages
  fx.publicPkg = await seedPackage({ name: "public", featured: true });
  fx.draftPkg = await seedPackage({ name: "draft", status: "draft" });
  fx.archivedPkg = await seedPackage({ name: "archived", status: "archived" });
  fx.pausedPkg = await seedPackage({ name: "paused", status: "paused", offerExpiresAt: nowPlus(-60_000) });
  fx.expiredOfferPkg = await seedPackage({ name: "expiredoffer", status: "active", offerExpiresAt: nowPlus(-3_600_000) });
  fx.memberPkg = await seedPackage({
    name: "member",
    isMembersOnly: true,
    sellingPrice: MEMBER_PRICE,
    serviceFee: 1234,
    offerExpiresAt: nowPlus(7 * 24 * 3_600_000),
    createdAt: nowPlus(-120_000),
    itinerarySecret: MEMBER_ITINERARY_SECRET,
    inclusionSecret: MEMBER_INCLUSION_SECRET,
    hotelName: MEMBER_HOTEL_SECRET,
  });
  fx.memberCheapPkg = await seedPackage({
    name: "membercheap",
    isMembersOnly: true,
    sellingPrice: MEMBER_CHEAP_PRICE,
    createdAt: nowPlus(-60_000),
  });
  fx.underDraftDestPkg = await seedPackage({ name: "underdraftdest", destinationId: fx.draftDestinationId });

  // Bookings owned by the owner user through each of the two ownership columns
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const seq = () => String(Math.floor(1000 + Math.random() * 9000));
  const contact = { name: "Round2 Owner", email: owner.email, phone: "+91 91111 22222" };
  const [ownerOnly] = await db
    .insert(bookingsTable)
    .values({
      bookingId: `ZL${stamp}${seq()}`,
      ownerId: owner.id,
      totalPrice: 45000,
      status: "CONFIRMED",
      paymentStatus: "SUCCESSFUL",
      customerContact: contact,
    })
    .returning();
  const [customerOnly] = await db
    .insert(bookingsTable)
    .values({
      bookingId: `ZL${stamp}${seq()}`,
      customerId: owner.id,
      totalPrice: 52000,
      status: "CONFIRMED",
      paymentStatus: "SUCCESSFUL",
      customerContact: contact,
    })
    .returning();
  fx.bookingOwnerOnly = { id: ownerOnly.id, bookingId: ownerOnly.bookingId };
  fx.bookingCustomerOnly = { id: customerOnly.id, bookingId: customerOnly.bookingId };
});

after(async () => {
  try {
    const packageIds = [
      fx.publicPkg,
      fx.draftPkg,
      fx.archivedPkg,
      fx.pausedPkg,
      fx.expiredOfferPkg,
      fx.memberPkg,
      fx.memberCheapPkg,
      fx.underDraftDestPkg,
    ]
      .filter(Boolean)
      .map((pkg) => pkg.id);
    if (createdTicketNumbers.length) {
      await db.delete(supportTicketsTable).where(inArray(supportTicketsTable.ticketNumber, createdTicketNumbers));
    }
    const bookingIds = [fx.bookingOwnerOnly?.id, fx.bookingCustomerOnly?.id].filter(Boolean);
    if (bookingIds.length) await db.delete(bookingsTable).where(inArray(bookingsTable.id, bookingIds));
    if (packageIds.length) await db.delete(packagesTable).where(inArray(packagesTable.id, packageIds));
    const destinationIds = [fx.destinationId, fx.draftDestinationId].filter(Boolean);
    if (destinationIds.length) await db.delete(destinationsTable).where(inArray(destinationsTable.id, destinationIds));
    if (fx.vendorRowId) await db.delete(vendorsTable).where(eq(vendorsTable.id, fx.vendorRowId));
    const userIds = [fx.ownerUserId, fx.otherUserId].filter(Boolean);
    if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    if (fx.adminRowId) await db.delete(adminUsersTable).where(eq(adminUsersTable.id, fx.adminRowId));
  } catch {
    // best-effort cleanup; the default test database is an in-memory PGlite instance
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("Round 2 audit C1: public catalog serves explicit DTOs, not raw database rows", () => {
  it("C1-1: anonymous GET /api/packages exposes only the public allowlist (no cost, markup, vendor or inventory data, recursively)", async () => {
    const res = await api<ListResponse>("/api/packages");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.results));

    const card = res.body.results.find((entry) => entry.id === fx.publicPkg.id);
    assert.ok(card, "the published package must be listed");

    assertNoInternalData("GET /api/packages", res.body);
    assertKeys("public list card", card, CARD_KEYS);
    assert.match(res.headers.get("vary") ?? "", /cookie/i, "the list varies by session and must say so to caches");
  });

  it("C1-2: the public list still carries every field the customer UI reads (curated grid and global search)", async () => {
    const res = await api<ListResponse>("/api/packages");
    const card = res.body.results.find((entry) => entry.id === fx.publicPkg.id);
    assert.ok(card);
    assertPresent("list card", card, [
      ["id", "string"],
      ["packageId", "string"],
      ["slug", "string"],
      ["title", "string"],
      ["destinationName", "string"],
      ["destinationSlug", "string"],
      ["locations", "array"],
      ["theme", "string"],
      ["durationDays", "number"],
      ["durationNights", "number"],
      ["sellingPrice", "number"],
      ["isMembersOnly", "boolean"],
      ["media", "object"],
      ["media.heroImage", "string"],
      ["tripConfidenceScore", "object"],
      ["tripConfidenceScore.score", "number"],
      ["tripConfidenceScore.label", "string"],
    ]);
    assert.equal(card.sellingPrice, 20000);
    assert.equal(card.isMembersOnly, false);
    assert.equal(card.offerExpiresAt, null);
  });

  it("C1-3: anonymous GET /api/packages/:idOrSlug returns only the public detail allowlist (no cost, markup, vendor or inventory data, recursively)", async () => {
    for (const identifier of [fx.publicPkg.slug, fx.publicPkg.id, fx.publicPkg.packageId]) {
      const res = await api<DetailResponse>(`/api/packages/${identifier}`);
      assert.equal(res.status, 200, `detail by ${identifier}`);
      assertNoInternalData(`GET /api/packages/${identifier}`, res.body);
      assertKeys("public detail", res.body.package, DETAIL_KEYS);
      assert.match(res.headers.get("vary") ?? "", /cookie/i);
    }
  });

  it("C1-4: the public detail still carries every field the customer UI reads (detail modal and checkout)", async () => {
    const res = await api<DetailResponse>(`/api/packages/${fx.publicPkg.slug}`);
    assert.equal(res.status, 200);
    const detail = res.body.package;
    assertPresent("detail", detail, [
      ["id", "string"],
      ["packageId", "string"],
      ["title", "string"],
      ["slug", "string"],
      ["locations", "array"],
      ["durationDays", "number"],
      ["durationNights", "number"],
      ["theme", "string"],
      ["travellerSuitability", "string"],
      ["sellingPrice", "number"],
      ["serviceFee", "number"],
      ["inclusions", "array"],
      ["exclusions", "array"],
      ["isMembersOnly", "boolean"],
      ["media.heroImage", "string"],
      ["destination.name", "string"],
      ["destination.state", "string"],
      ["destination.overview", "string"],
      ["days", "array"],
      ["components.hotels", "array"],
      ["components.transfers", "array"],
      ["components.activities", "array"],
      ["policies.cancellation", "string"],
      ["policies.modification", "string"],
      ["policies.child", "string"],
      ["policies.payment", "string"],
      ["tripConfidenceScore.score", "number"],
      ["tripConfidenceScore.label", "string"],
      ["tripConfidenceScore.breakdown.acceptanceRate", "number"],
      ["tripConfidenceScore.breakdown.avgResponseMinutes", "number"],
      ["tripConfidenceScore.breakdown.cancellationRate", "number"],
    ]);
    assert.equal(detail.sellingPrice, 20000);
    assert.equal(detail.serviceFee, 500);
    assert.equal(detail.days?.length, 2);
    assertPresent("day", detail.days?.[0], [
      ["dayNumber", "number"],
      ["title", "string"],
      ["description", "string"],
      ["mealsIncluded", "string"],
    ]);
    assertPresent("hotel", detail.components?.hotels[0], [
      ["name", "string"],
      ["starRating", "string"],
      ["roomType", "string"],
      ["mealPlan", "string"],
    ]);
    assertPresent("transfer", detail.components?.transfers[0], [
      ["vehicleType", "string"],
      ["pickupLocation", "string"],
      ["dropLocation", "string"],
    ]);
    assertPresent("activity", detail.components?.activities[0], [
      ["name", "string"],
      ["durationHours", "string"],
      ["meetingPoint", "string"],
    ]);
  });

  it("C1-5: draft, archived, paused and offer-expired packages are unlisted and 404 by slug, UUID and package code (anonymous and customer)", async () => {
    const list = await api<ListResponse>("/api/packages");
    const hidden = [
      ["draft", fx.draftPkg],
      ["archived", fx.archivedPkg],
      ["paused", fx.pausedPkg],
      ["offer-expired", fx.expiredOfferPkg],
    ] as const;

    for (const [label, pkg] of hidden) {
      assert.ok(!list.body.results.some((entry) => entry.id === pkg.id), `${label} package must not be listed publicly`);
      for (const identifier of [pkg.slug, pkg.id, pkg.packageId]) {
        const res = await api(`/api/packages/${identifier}`);
        assert.equal(res.status, 404, `${label} package must 404 anonymously by ${identifier}`);
      }
      const asCustomer = await api(`/api/packages/${pkg.slug}`, {}, ownerCookie);
      assert.equal(asCustomer.status, 404, `${label} package must 404 for a signed-in customer`);
      const previewFlagOnly = await api(`/api/packages/${pkg.slug}?preview=true`);
      assert.equal(previewFlagOnly.status, 404, `${label}: ?preview=true alone must not unlock a non-public package`);
      const customerPreview = await api(`/api/packages/${pkg.slug}?preview=true`, {}, ownerCookie);
      assert.equal(customerPreview.status, 404, `${label}: ?preview=true must not unlock it for a customer either`);
    }
  });

  it("C1-6: an admin session can still open non-public packages in full (admin edit and preview UI keep working)", async () => {
    const cases = [
      [fx.draftPkg, "draft"],
      [fx.archivedPkg, "archived"],
      [fx.pausedPkg, "paused"],
    ] as const;
    for (const [pkg, status] of cases) {
      const res = await api<{ package: Record<string, unknown> & { components: Record<string, Array<Record<string, unknown>>> } }>(
        `/api/packages/${pkg.id}?preview=true`,
        {},
        adminCookie,
      );
      assert.equal(res.status, 200, `admin must see the ${status} package`);
      assert.equal(res.body.package.status, status);
      // The admin edit modal round-trips these values; losing them would zero out supplier costs on save.
      assert.equal(res.body.package.baseCost, SECRET.baseCost);
      assert.equal(res.body.package.markupValue, SECRET.markupValue);
      assert.equal(res.body.package.components.hotels[0].baseCostPerNight, SECRET.hotelBasePerNight);
      assert.equal(res.body.package.components.transfers[0].baseCost, SECRET.transferBase);
      assert.equal(res.body.package.components.activities[0].baseCost, SECRET.activityBase);
    }

    const noFlag = await api(`/api/packages/${fx.draftPkg.slug}`, {}, adminCookie);
    assert.equal(noFlag.status, 200, "an admin session opens a draft package by slug");

    const adminList = await api<{ results: Array<{ id: string; status: string }> }>("/api/admin/packages?status=draft", {}, adminCookie);
    assert.equal(adminList.status, 200);
    assert.ok(adminList.body.results.some((entry) => entry.id === fx.draftPkg.id), "admin package list still shows drafts");
  });

  it("C1-7: members-only deal is a locked teaser for anonymous callers and fully available to a signed-in customer", async () => {
    // Anonymous list: teaser card only
    const anonList = await api<ListResponse>("/api/packages");
    const teaser = anonList.body.results.find((entry) => entry.id === fx.memberPkg.id);
    assert.ok(teaser, "the members-only deal must still be listed as a teaser");
    assertKeys("locked list card", teaser, LOCKED_CARD_KEYS);
    assert.equal(teaser.isMembersOnly, true);
    assert.equal(teaser.locked, true);
    assert.equal(teaser.sellingPrice, undefined);
    assert.ok(!collectLeaves(anonList.body).includes(MEMBER_PRICE), "members-only price must not be present anywhere in the anonymous list");

    // Anonymous detail: teaser only, no itinerary, components, inclusions, policies or pricing
    const anonDetail = await api<DetailResponse>(`/api/packages/${fx.memberPkg.slug}`);
    assert.equal(anonDetail.status, 200);
    assertKeys("locked detail", anonDetail.body.package, LOCKED_DETAIL_KEYS);
    assert.equal(anonDetail.body.package.locked, true);
    assert.equal(anonDetail.body.package.isMembersOnly, true);
    assertNoInternalData("anonymous members-only detail", anonDetail.body);
    for (const secret of [
      String(MEMBER_PRICE),
      MEMBER_ITINERARY_SECRET,
      MEMBER_INCLUSION_SECRET,
      MEMBER_HOTEL_SECRET,
      "1234",
    ]) {
      const leaked = collectLeaves(anonDetail.body).some((leaf) => String(leaf) === secret || (typeof leaf === "string" && leaf.includes(secret)));
      assert.ok(!leaked, `locked detail must not leak "${secret}"`);
    }

    // Signed-in customer: unlocked
    const memberList = await api<ListResponse>("/api/packages", {}, ownerCookie);
    const unlockedCard = memberList.body.results.find((entry) => entry.id === fx.memberPkg.id);
    assert.ok(unlockedCard);
    assertKeys("unlocked list card", unlockedCard, CARD_KEYS);
    assert.equal(unlockedCard.locked, false);
    assert.equal(unlockedCard.sellingPrice, MEMBER_PRICE);

    for (const identifier of [fx.memberPkg.slug, fx.memberPkg.id]) {
      const memberDetail = await api<DetailResponse>(`/api/packages/${identifier}`, {}, ownerCookie);
      assert.equal(memberDetail.status, 200);
      assertKeys("unlocked members-only detail", memberDetail.body.package, DETAIL_KEYS);
      assert.equal(memberDetail.body.package.locked, false);
      assert.equal(memberDetail.body.package.sellingPrice, MEMBER_PRICE);
      assert.equal(memberDetail.body.package.serviceFee, 1234);
      assert.equal(memberDetail.body.package.days?.length, 2);
      assert.equal(memberDetail.body.package.days?.[0].description, MEMBER_ITINERARY_SECRET);
      assert.equal(memberDetail.body.package.components?.hotels[0].name, MEMBER_HOTEL_SECRET);
      assertNoInternalData("signed-in members-only detail", memberDetail.body);
    }

    // The published, non-members deal stays fully public
    const publicDetail = await api<DetailResponse>(`/api/packages/${fx.publicPkg.slug}`);
    assert.equal(publicDetail.body.package.locked, false);
    assert.equal(publicDetail.body.package.sellingPrice, 20000);
  });

  it("C1-8: anonymous price filters and price sorting cannot be used to probe locked members-only prices", async () => {
    const exactAnon = await api<ListResponse>(`/api/packages?minPrice=${MEMBER_PRICE}&maxPrice=${MEMBER_PRICE}`);
    assert.ok(
      !exactAnon.body.results.some((entry) => entry.id === fx.memberPkg.id),
      "an exact-price filter must not confirm a locked price for an anonymous caller",
    );
    const cheapAnon = await api<ListResponse>(`/api/packages?maxPrice=${MEMBER_CHEAP_PRICE}`);
    assert.ok(!cheapAnon.body.results.some((entry) => entry.id === fx.memberCheapPkg.id));

    const exactMember = await api<ListResponse>(`/api/packages?minPrice=${MEMBER_PRICE}&maxPrice=${MEMBER_PRICE}`, {}, ownerCookie);
    assert.ok(
      exactMember.body.results.some((entry) => entry.id === fx.memberPkg.id),
      "a signed-in customer keeps working price filters",
    );

    const anonAsc = await api<ListResponse>("/api/packages?sort=price_asc");
    const anonIds = anonAsc.body.results.map((entry) => entry.id);
    const cheapAnonIndex = anonIds.indexOf(fx.memberCheapPkg.id);
    assert.ok(cheapAnonIndex >= 0);
    for (const entry of anonAsc.body.results.filter((row) => !row.locked)) {
      assert.ok(
        anonIds.indexOf(entry.id) < cheapAnonIndex,
        "price sorting must not reveal that a locked deal is cheaper than public packages",
      );
    }

    const memberAsc = await api<ListResponse>("/api/packages?sort=price_asc", {}, ownerCookie);
    const memberIds = memberAsc.body.results.map((entry) => entry.id);
    assert.ok(
      memberIds.indexOf(fx.memberCheapPkg.id) < memberIds.indexOf(fx.publicPkg.id),
      "a signed-in customer still gets a real price-ascending order",
    );
  });

  it("C1-9: public destinations expose only the destination allowlist and only publicly listed packages", async () => {
    const res = await api<{ results: DestinationCard[] }>("/api/destinations");
    assert.equal(res.status, 200);
    const dest = res.body.results.find((entry) => entry.id === fx.destinationId);
    assert.ok(dest, "the published destination must be listed");
    assertKeys("public destination card", dest, [...DESTINATION_KEYS, "packageCount"].sort());
    assert.equal(dest.packageCount, 3, "only the published, unexpired packages (public + two members-only teasers) are counted");
    assert.ok(!res.body.results.some((entry) => entry.id === fx.draftDestinationId), "draft destination must not be listed");
    assertNoInternalData("GET /api/destinations", res.body);
    assert.ok(!res.text.includes(DRAFT_DESTINATION_SECRET));
  });

  it("C1-10: public destination detail returns package DTOs (no internals, no unlisted packages, locked members-only teasers) and 404s a draft destination", async () => {
    const res = await api<{ destination: Record<string, unknown> & { packages: PublicCard[] } }>(`/api/destinations/${fx.destinationSlug}`);
    assert.equal(res.status, 200);
    const { packages, ...destinationFields } = res.body.destination;
    assertKeys("destination detail", destinationFields, DESTINATION_KEYS);
    assertNoInternalData("GET /api/destinations/:slug", res.body);
    assert.match(res.headers.get("vary") ?? "", /cookie/i);

    const ids = packages.map((entry) => entry.id);
    assert.deepEqual(new Set(ids), new Set([fx.publicPkg.id, fx.memberPkg.id, fx.memberCheapPkg.id]));
    const publicEntry = packages.find((entry) => entry.id === fx.publicPkg.id);
    assert.ok(publicEntry);
    assertKeys("destination package card", publicEntry, CARD_KEYS);
    const lockedEntry = packages.find((entry) => entry.id === fx.memberPkg.id);
    assert.ok(lockedEntry);
    assertKeys("destination locked package card", lockedEntry, LOCKED_CARD_KEYS);
    assert.ok(!collectLeaves(res.body).includes(MEMBER_PRICE));

    // Locked prices must not leak through ordering either: the featured public package leads, then the newest teaser
    assert.deepEqual(ids, [fx.publicPkg.id, fx.memberCheapPkg.id, fx.memberPkg.id]);

    const asMember = await api<{ destination: { packages: PublicCard[] } }>(`/api/destinations/${fx.destinationSlug}`, {}, ownerCookie);
    assert.deepEqual(
      asMember.body.destination.packages.map((entry) => entry.id),
      [fx.publicPkg.id, fx.memberPkg.id, fx.memberCheapPkg.id],
      "a signed-in customer keeps the price-descending order",
    );
    assert.equal(asMember.body.destination.packages[1].sellingPrice, MEMBER_PRICE);

    const draft = await api(`/api/destinations/${fx.draftDestinationSlug}`);
    assert.equal(draft.status, 404, "an unpublished destination must not be readable publicly");
  });

  it("C1-11: unpublished destination content does not leak through a published package", async () => {
    const list = await api<ListResponse>("/api/packages");
    assert.ok(list.body.results.some((entry) => entry.id === fx.underDraftDestPkg.id), "the package itself is published");
    assert.ok(!list.text.includes(DRAFT_DESTINATION_SECRET));
    assert.ok(!list.text.includes("Round2 Unreleased Destination"));

    const detail = await api<DetailResponse>(`/api/packages/${fx.underDraftDestPkg.slug}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.package.destination, null);
    assert.ok(!detail.text.includes(DRAFT_DESTINATION_SECRET));
  });

  it("C1-12: admin package and destination endpoints keep returning full rows", async () => {
    const anon = await api("/api/admin/packages");
    assert.equal(anon.status, 401);

    const packages = await api<{ results: Array<Record<string, unknown>> }>("/api/admin/packages", {}, adminCookie);
    assert.equal(packages.status, 200);
    const row = packages.body.results.find((entry) => entry.id === fx.publicPkg.id);
    assert.ok(row);
    assert.equal(row.baseCost, SECRET.baseCost);
    assert.equal(row.markupType, "percentage");
    assert.equal(row.markupValue, SECRET.markupValue);
    assert.equal(row.inventory, SECRET.inventory);
    assert.deepEqual(row.assignedVendorIds, [fx.vendorCode]);
    assert.equal(row.status, "active");
    assert.equal(row.daysCount, 2);
    for (const hiddenPkg of [fx.draftPkg, fx.archivedPkg, fx.pausedPkg, fx.expiredOfferPkg]) {
      assert.ok(packages.body.results.some((entry) => entry.id === hiddenPkg.id), "admin list keeps every status");
    }

    const destinations = await api<{ results: Array<Record<string, unknown>> }>("/api/admin/destinations", {}, adminCookie);
    assert.equal(destinations.status, 200);
    const draftDest = destinations.body.results.find((entry) => entry.id === fx.draftDestinationId);
    assert.ok(draftDest, "admin destination list keeps drafts");
    assert.equal(draftDest.status, "draft");
    assert.ok(draftDest.createdAt);
    assert.ok(draftDest.updatedAt);
    assert.equal(typeof draftDest.packageCount, "number");
  });
});

describe("Round 2 audit C2: support tickets cannot be attached to somebody else's booking", () => {
  const ticketBody = (label: string, bookingId?: string) => ({
    name: `Round2 Caller ${label}`,
    email: `r2_${label}_${runId}@example.com`,
    subject: `Round2 support request ${label}`,
    description: "Please help with my itinerary.",
    priority: "MEDIUM",
    ...(bookingId !== undefined ? { bookingId } : {}),
  });

  async function createTicket(label: string, bookingId: string | undefined, cookie?: string) {
    const res = await api<TicketCreateResponse>(
      "/api/support/tickets",
      { method: "POST", body: JSON.stringify(ticketBody(label, bookingId)) },
      cookie,
    );
    assert.equal(res.status, 201, `ticket ${label} must be created: ${res.text}`);
    createdTicketNumbers.push(res.body.ticketNumber);
    const [row] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.ticketNumber, res.body.ticketNumber));
    assert.ok(row, `ticket ${label} must exist in the database`);
    return { res, row };
  }

  /** Minimal public response: no booking data, no user data, no echo of the submitted booking reference. */
  function assertMinimalTicketResponse(label: string, res: { body: TicketCreateResponse; text: string }, row: { id: string; ticketNumber: string }) {
    assertKeys(`${label} response`, res.body as unknown as Record<string, unknown>, ["message", "status", "ticket", "ticketNumber"]);
    assertKeys(`${label} response.ticket`, res.body.ticket, ["id", "status", "ticketNumber"]);
    assert.equal(res.body.status, "success");
    assert.equal(res.body.ticket.status, "OPEN");
    assert.equal(res.body.ticket.ticketNumber, res.body.ticketNumber);
    assert.match(res.body.ticketNumber, /^TCK-/);
    assert.ok(res.body.message.includes(res.body.ticketNumber));
    // The only identifier returned is the new ticket's own id, never a booking or user id.
    assert.equal(res.body.ticket.id, row.id);

    const keys = collectKeys(res.body);
    for (const forbidden of ["bookingId", "booking", "userId", "customerId", "ownerId", "email", "name", "subject", "description"]) {
      assert.ok(!keys.has(forbidden), `${label}: response must not contain "${forbidden}"`);
    }
    for (const victim of [fx.bookingOwnerOnly, fx.bookingCustomerOnly]) {
      assert.ok(!res.text.includes(victim.id), `${label}: response must not contain a booking UUID`);
      assert.ok(!res.text.includes(victim.bookingId), `${label}: response must not echo a booking reference`);
    }
  }

  const normalise = (body: TicketCreateResponse) =>
    JSON.stringify(body)
      .split(body.ticketNumber)
      .join("<TICKET-NUMBER>")
      .split(body.ticket.id)
      .join("<TICKET-ID>");

  it("C2-1: anonymous ticket citing someone else's booking reference or UUID is stored unlinked and leaks nothing", async () => {
    const byReference = await createTicket("anonref", fx.bookingCustomerOnly.bookingId);
    assert.equal(byReference.row.bookingId, null, "the booking must not be linked for an anonymous caller");
    assert.equal(byReference.row.userId, null);
    assertMinimalTicketResponse("anonymous by reference", byReference.res, byReference.row);

    const byUuid = await createTicket("anonuuid", fx.bookingOwnerOnly.id);
    assert.equal(byUuid.row.bookingId, null, "a booking UUID must not link for an anonymous caller either");
    assertMinimalTicketResponse("anonymous by UUID", byUuid.res, byUuid.row);

    // A UUID that matches no booking used to fail with a 500 (foreign key), which made the form an existence oracle.
    const unknownUuid = await createTicket("anonunknown", crypto.randomUUID());
    assert.equal(unknownUuid.row.bookingId, null);
    assertMinimalTicketResponse("anonymous unknown UUID", unknownUuid.res, unknownUuid.row);

    const noBooking = await createTicket("anonnone", undefined);
    assert.equal(noBooking.row.bookingId, null);
    assertMinimalTicketResponse("anonymous without booking", noBooking.res, noBooking.row);

    // Existing, missing and absent booking references are indistinguishable to the caller.
    const baseline = normalise(noBooking.res.body);
    assert.equal(normalise(byReference.res.body), baseline);
    assert.equal(normalise(byUuid.res.body), baseline);
    assert.equal(normalise(unknownUuid.res.body), baseline);
  });

  it("C2-2: an authenticated owner's ticket is linked to their own booking (reference or UUID, ownerId or customerId)", async () => {
    const ownerOnlyByReference = await createTicket("ownerref", fx.bookingOwnerOnly.bookingId, ownerCookie);
    assert.equal(ownerOnlyByReference.row.bookingId, fx.bookingOwnerOnly.id, "owner-column booking must link");
    assert.equal(ownerOnlyByReference.row.userId, fx.ownerUserId);
    assertMinimalTicketResponse("owner by reference", ownerOnlyByReference.res, ownerOnlyByReference.row);

    const customerOnlyByUuid = await createTicket("owneruuid", fx.bookingCustomerOnly.id, ownerCookie);
    assert.equal(customerOnlyByUuid.row.bookingId, fx.bookingCustomerOnly.id, "customer-column booking must link");
    assert.equal(customerOnlyByUuid.row.userId, fx.ownerUserId);
    assertMinimalTicketResponse("owner by UUID", customerOnlyByUuid.res, customerOnlyByUuid.row);
  });

  it("C2-3: an authenticated non-owner's ticket is stored unlinked with a response indistinguishable from the no-booking case", async () => {
    const byReference = await createTicket("otherref", fx.bookingCustomerOnly.bookingId, otherCookie);
    assert.equal(byReference.row.bookingId, null, "a non-owner must not be able to link the booking");
    assert.equal(byReference.row.userId, fx.otherUserId, "the ticket is still attributed to the caller");
    assertMinimalTicketResponse("non-owner by reference", byReference.res, byReference.row);

    const noBooking = await createTicket("othernone", undefined, otherCookie);
    assert.equal(noBooking.row.bookingId, null);
    assert.equal(byReference.res.status, noBooking.res.status);
    assert.equal(normalise(byReference.res.body), normalise(noBooking.res.body));
  });

  it("C2-4: staff list and resolve keep working and staff still see the link on legitimately linked tickets", async () => {
    const anon = await api("/api/support/tickets");
    assert.equal(anon.status, 401);
    const asCustomer = await api("/api/support/tickets", {}, ownerCookie);
    assert.equal(asCustomer.status, 403);

    const list = await api<{ tickets: AdminTicket[] }>("/api/support/tickets", {}, adminCookie);
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.tickets));

    const linked = list.body.tickets.find((entry) => entry.bookingId === fx.bookingOwnerOnly.id);
    assert.ok(linked, "staff must see the ticket linked to the owner's booking");
    assert.equal(linked.userId, fx.ownerUserId);
    const victimLinks = list.body.tickets.filter(
      (entry) => entry.bookingId === fx.bookingCustomerOnly.id && entry.userId !== fx.ownerUserId,
    );
    assert.equal(victimLinks.length, 0, "no ticket from anonymous or non-owner callers may be linked to the victim's booking");

    const resolve = await api<{ ticket: { status: string } }>(
      `/api/support/tickets/${linked.id}/resolve`,
      { method: "POST", body: JSON.stringify({ notes: "Resolved during round 2 catalog test." }) },
      adminCookie,
    );
    assert.equal(resolve.status, 200);
    assert.equal(resolve.body.ticket.status, "RESOLVED");
  });
});
