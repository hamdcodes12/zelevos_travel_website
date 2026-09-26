import assert from "node:assert";

const BASE_URL = "http://localhost:8080";

async function main() {
  console.log("=== TESTING EXCLUSIVE MEMBER DEAL LIFECYCLE ===");

  // 1. Admin Login
  console.log("1. Authenticating Admin...");
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminId: "zelevos-travelai00",
      password: "ZT" + "002121",
    }),
  });

  assert.strictEqual(loginRes.status, 200, "Admin login should return 200");
  const rawCookie = loginRes.headers.get("set-cookie") || "";
  const adminCookie = rawCookie.split(";")[0];
  assert(adminCookie.includes("zelevos_admin_session"), "Admin cookie required");
  console.log("✓ Admin authenticated successfully.");

  // Fetch a destination ID
  const destRes = await fetch(`${BASE_URL}/api/destinations`);
  const destData = await destRes.json();
  const destList = Array.isArray(destData.results) ? destData.results : destData.destinations || [];
  const destId = destList[0]?.id;
  assert(destId, "Destination ID required for package creation");

  // 2. Create Exclusive Members-Only Package
  console.log("2. Admin creating Exclusive Members-Only Package...");
  const testPkgId = `ZL-MEMBER-${Date.now().toString().slice(-4)}`;
  const testSlug = `exclusive-member-deal-${Date.now().toString().slice(-4)}`;
  const expiryDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  const createRes = await fetch(`${BASE_URL}/api/admin/packages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      packageId: testPkgId,
      title: "Royal Kashmir VIP Member Exclusive",
      slug: testSlug,
      destinationId: destId,
      locations: ["Srinagar", "Gulmarg", "Pahalgam"],
      durationDays: 6,
      durationNights: 5,
      theme: "luxury",
      travellerSuitability: "Couples & Families",
      baseCost: 35000,
      sellingPrice: 52000,
      markupType: "percentage",
      markupValue: 48.5,
      serviceFee: 1500,
      inventory: 5,
      inclusions: ["5-Star Houseboat", "Private Shikara", "All Transfers"],
      exclusions: ["Personal Expenses", "Flight Tickets"],
      status: "active",
      featured: true,
      isMembersOnly: true,
      offerExpiresAt: expiryDate,
      days: [
        { dayNumber: 1, title: "Arrival in Srinagar & Dal Lake Sunset", description: "VIP shikara ride and overnight stay in luxury houseboat.", mealsIncluded: "Dinner" },
        { dayNumber: 2, title: "Gulmarg Gondola & Alpine Meadow", description: "Phase 1 and Phase 2 Gondola ride with private escort.", mealsIncluded: "Breakfast & Dinner" }
      ],
      media: {
        heroImage: "/kashmir-dawn.jpg",
        gallery: ["/kashmir-dawn.jpg", "/ladakh-road.jpg"]
      }
    }),
  });

  const createData = await createRes.json();
  assert.strictEqual(createRes.status, 201, `Create package status should be 201: ${JSON.stringify(createData)}`);
  const createdPkg = createData.package;
  assert.strictEqual(createdPkg.isMembersOnly, true, "Package should have isMembersOnly = true");
  assert(createdPkg.offerExpiresAt, "Package should have offerExpiresAt timestamp");
  console.log(`✓ Created exclusive package ${createdPkg.packageId} (ID: ${createdPkg.id})`);

  // 3. Verify in Public Catalog (Guest view)
  console.log("3. Verifying package in Public Catalog...");
  const publicRes = await fetch(`${BASE_URL}/api/packages`);
  const publicData = await publicRes.json();
  const found = publicData.results.find((p) => p.packageId === testPkgId);
  assert(found, "Package should appear in public catalog");
  assert.strictEqual(found.isMembersOnly, true, "Public catalog must flag package as isMembersOnly = true");
  console.log(`✓ Package ${testPkgId} confirmed in public catalog with isMembersOnly=true`);

  // 4. Test 1-Click Expire Offer Endpoint
  console.log("4. Testing Admin 1-Click Expire Offer...");
  const expireRes = await fetch(`${BASE_URL}/api/admin/packages/${createdPkg.id}/expire`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
  });

  const expireData = await expireRes.json();
  assert.strictEqual(expireRes.status, 200, `Expire should return 200: ${JSON.stringify(expireData)}`);
  assert.strictEqual(expireData.status, "success", "Response status should be success");
  assert.strictEqual(expireData.package.status, "paused", "Status should transition to paused upon expiry");
  const expiredTime = new Date(expireData.package.offerExpiresAt).getTime();
  assert(expiredTime <= Date.now() + 1000, "offerExpiresAt must be updated to current/past timestamp");
  console.log("✓ Admin Expire Offer successfully paused package and set past expiry timestamp.");

  // 5. Test 1-Click Delete / Remove Package Endpoint
  console.log("5. Testing Admin Delete Package...");
  const deleteRes = await fetch(`${BASE_URL}/api/admin/packages/${createdPkg.id}?hard=true`, {
    method: "DELETE",
    headers: {
      Cookie: adminCookie,
    },
  });

  const deleteData = await deleteRes.json();
  assert.strictEqual(deleteRes.status, 200, `Delete should return 200: ${JSON.stringify(deleteData)}`);
  console.log("✓ Package successfully deleted from database.");

  // Verify it is gone
  const checkRes = await fetch(`${BASE_URL}/api/packages/${createdPkg.id}?preview=true`);
  assert.strictEqual(checkRes.status, 404, "Deleted package should return 404");
  console.log("✓ Verified package 404 after deletion.");

  console.log("\nALL EXCLUSIVE MEMBER DEAL LIFECYCLE TESTS PASSED! (5/5)");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
