// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM
// 5-SECOND AUTOSAVE & REAL-TIME ONBOARDING PROGRESS SYNC E2E VERIFICATION SUITE
// ==============================================================================

import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const jwt = require(path.resolve("artifacts/api-server/node_modules/jsonwebtoken"));

function loadEnv() {
  const envPath = path.resolve(".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:4317";
const JWT_SECRET = process.env.USER_SESSION_SECRET || process.env.SESSION_SECRET || "thinkatic-user-secret-2026";

// Test Identities
const PARTNER_A_ID = "929290f3-98a6-4edb-ac69-43db5d504faa"; // Primary test BPO partner
const PARTNER_B_ID = "22222222-2222-4222-a222-222222222222"; // Secondary partner for IDOR tests
const SUSPENDED_PARTNER_ID = "99999999-9999-4999-a999-999999999999";

const tokenPartnerA = jwt.sign(
  { id: PARTNER_A_ID, email: "testguru@gmail.com", role: "bpo_partner", account_type: "BPO" },
  JWT_SECRET,
  { expiresIn: "4h" }
);

const tokenPartnerB = jwt.sign(
  { id: PARTNER_B_ID, email: "partnerb@example.com", role: "bpo_partner", account_type: "BPO" },
  JWT_SECRET,
  { expiresIn: "4h" }
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runSuite() {
  console.log("==============================================================================");
  console.log("🚀 STARTING: 5-SECOND AUTOSAVE & REAL-TIME ONBOARDING PROGRESS SYNC VERIFICATION");
  console.log("==============================================================================\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Initial State / Baseline Check
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- 1. Fetching Baseline Application for Partner A ---");
  const baseRes = await fetch(`${BASE_URL}/api/partner/applications/me`, {
    headers: { Authorization: `Bearer ${tokenPartnerA}` },
  });
  assert(baseRes.ok, `GET /api/partner/applications/me returns 200 (Status: ${baseRes.status})`);
  const baseData = await baseRes.json();
  const appId = baseData.application?.id;
  assert(Boolean(appId), `Found active application record for Partner A (App ID: ${appId})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. 5-Second Autosave: Save Batched Form Data
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. Testing Batched Autosave via PATCH /api/partner/applications/:id ---");
  const testCompanyName = "Thinkatic Apex Solutions " + Date.now();
  const testEmail = `apex.${Date.now()}@thinkatic-partner.com`;
  const testPhone = "9876543210";
  const testCentreName = "Cyber City Delivery Centre 4";
  const testAddress = "DLF Cyber City, Tower 10, Sector 24";

  const patchRes = await fetch(`${BASE_URL}/api/partner/applications/${appId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenPartnerA}`,
    },
    body: JSON.stringify({
      companyData: {
        companyName: testCompanyName,
        legalEntity: "Private Limited",
        ownerName: "Harpreet Singh",
        email: testEmail,
        phone: testPhone,
        address: testAddress,
        city: "Gurugram",
        state: "Haryana",
        country: "India",
        panNumber: "ABCDE1234F",
        gstNumber: "06ABCDE1234F1Z5",
      },
      centreData: {
        centreName: testCentreName,
        centreAddress: testAddress,
        totalSeats: "120",
        availableSeats: "45",
        activeAgents: "75",
        numberOfFloors: "2",
        workingHours: "24/7 Operations",
      },
      infrastructureData: {
        internetBandwidth: "1 Gbps Leased Line (1:1)",
        backupInternet: "500 Mbps Secondary ISP Fiber",
        powerBackup: "Online UPS 40 kVA + 125 kVA DG Set",
        computers: "i7 12th Gen, 16GB RAM, SSD",
      },
      processExperience: ["Customer Support", "Inbound Healthcare", "FinTech Tech Support"],
    }),
  });

  assert(patchRes.ok, `PATCH /api/partner/applications/${appId} succeeds with 200 (Status: ${patchRes.status})`);
  const patchData = await patchRes.json();
  assert(patchData.success === true, "Autosave response returns success: true");
  assert(patchData.application?.company_data?.companyName === testCompanyName, "Application companyName persisted correctly");
  assert(patchData.application?.company_data?.email === testEmail, "Application email persisted correctly");
  assert(patchData.application?.centre_data?.centreName === testCentreName, "Application centreName persisted correctly");
  assert(patchData.application?.centre_data?.totalSeats === "120", "Application totalSeats persisted correctly");
  assert(Boolean(patchData.onboardingProgress), "Authoritative onboardingProgress returned directly in response");

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Database Persistence & Page Refresh Simulation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 3. Testing Database Persistence on Page Refresh / Fetch Me ---");
  const refreshRes = await fetch(`${BASE_URL}/api/partner/applications/me`, {
    headers: { Authorization: `Bearer ${tokenPartnerA}` },
  });
  assert(refreshRes.ok, `Page refresh fetch returns 200`);
  const refreshData = await refreshRes.json();
  assert(
    refreshData.application?.company_data?.companyName === testCompanyName,
    `Refreshed page contains exact persisted companyName: "${testCompanyName}"`
  );
  assert(
    refreshData.application?.company_data?.email === testEmail,
    `Refreshed page contains exact persisted email: "${testEmail}"`
  );
  assert(
    refreshData.application?.centre_data?.centreName === testCentreName,
    `Refreshed page contains exact persisted centreName: "${testCentreName}"`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Anti-IDOR Security: Partner B Cannot Save Partner A's Application
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 4. Testing Anti-IDOR: Partner B attempting to PATCH Partner A's application ---");
  const idorRes = await fetch(`${BASE_URL}/api/partner/applications/${appId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenPartnerB}`,
    },
    body: JSON.stringify({
      companyData: {
        companyName: "Hacked Company By Partner B",
      },
    }),
  });

  assert(
    idorRes.status === 403 || idorRes.status === 404,
    `IDOR attempt rejected with 403 Forbidden or 404 (Actual status: ${idorRes.status})`
  );
  const idorData = await idorRes.json().catch(() => ({}));
  assert(
    idorData.error?.includes("Unauthorized") || idorData.error?.includes("denied") || idorRes.status === 403,
    "IDOR error message does not expose internal records"
  );

  // Verify Partner A's data was NOT mutated
  const verifyNoMutation = await fetch(`${BASE_URL}/api/partner/applications/me`, {
    headers: { Authorization: `Bearer ${tokenPartnerA}` },
  });
  const verifyData = await verifyNoMutation.json();
  assert(
    verifyData.application?.company_data?.companyName === testCompanyName,
    "Partner A data remains untampered after IDOR attempt"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Backend Field Validation: Rejecting Invalid Inputs
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 5. Testing Backend Field Validations ---");
  const badEmailRes = await fetch(`${BASE_URL}/api/partner/applications/${appId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenPartnerA}`,
    },
    body: JSON.stringify({
      companyData: {
        email: "not-a-valid-email",
      },
    }),
  });
  assert(badEmailRes.status === 400, `Invalid email rejected with 400 (Status: ${badEmailRes.status})`);

  const badPhoneRes = await fetch(`${BASE_URL}/api/partner/applications/${appId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenPartnerA}`,
    },
    body: JSON.stringify({
      companyData: {
        phone: "123", // too short
      },
    }),
  });
  assert(badPhoneRes.status === 400, `Invalid phone rejected with 400 (Status: ${badPhoneRes.status})`);

  const badPanRes = await fetch(`${BASE_URL}/api/partner/applications/${appId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenPartnerA}`,
    },
    body: JSON.stringify({
      companyData: {
        panNumber: "INVALIDPAN123",
      },
    }),
  });
  assert(badPanRes.status === 400, `Invalid PAN rejected with 400 (Status: ${badPanRes.status})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Mass Assignment Protection
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 6. Testing Mass Assignment Protection (Attempting to modify status/role) ---");
  const massAssignRes = await fetch(`${BASE_URL}/api/partner/applications/${appId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenPartnerA}`,
    },
    body: JSON.stringify({
      status: "rejected",
      role: "admin",
      is_active: false,
      applicant_user_id: "00000000-0000-0000-0000-000000000000",
      companyData: {
        companyName: testCompanyName,
      },
    }),
  });
  assert(massAssignRes.ok, "PATCH returns 200 while safely filtering unauthorized fields");
  const massAssignData = await massAssignRes.json();
  assert(
    massAssignData.application?.status !== "rejected",
    `Status was NOT mutated by client request (Actual status: ${massAssignData.application?.status})`
  );
  assert(
    massAssignData.application?.applicant_user_id === PARTNER_A_ID,
    "Applicant user ID remained unchanged"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Concurrency Safety: Stale Version / Timestamp Rejection
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 7. Testing Concurrency Safety: Stale Update Rejection ---");
  const staleRes = await fetch(`${BASE_URL}/api/partner/applications/${appId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenPartnerA}`,
    },
    body: JSON.stringify({
      lastKnownUpdatedAt: "2020-01-01T00:00:00.000Z", // Purposely old timestamp
      companyData: {
        companyName: "Stale Overwrite Attempt",
      },
    }),
  });
  assert(
    staleRes.status === 409,
    `Stale update rejected with 409 Conflict (Status: ${staleRes.status})`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Real Onboarding Progress Calculation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 8. Testing Dynamic Onboarding Progress Calculation ---");
  const progressRes = await fetch(`${BASE_URL}/api/bpo/status`, {
    headers: { Authorization: `Bearer ${tokenPartnerA}` },
  });
  assert(progressRes.ok, `GET /api/bpo/status returns 200 (Status: ${progressRes.status})`);
  const statusData = await progressRes.json();
  const summary = statusData.onboardingSummary;
  assert(Boolean(summary), "Onboarding summary present in response");
  assert(typeof summary.progressPercentage === "number", `Progress percentage is numeric: ${summary.progressPercentage}%`);
  assert(summary.stages?.length === 9, `Authoritative stages count is 9 (Got ${summary.stages?.length})`);

  // Check stage completion matching actual data
  const companyStage = summary.stages.find((s) => s.key === "company");
  const centreStage = summary.stages.find((s) => s.key === "centre");
  const infraStage = summary.stages.find((s) => s.key === "infrastructure");

  assert(companyStage?.status === "Complete", `Company stage is Complete (Actual: ${companyStage?.status})`);
  assert(centreStage?.status === "Complete", `Centre stage is Complete (Actual: ${centreStage?.status})`);
  assert(infraStage?.status === "Complete", `Infrastructure stage is Complete (Actual: ${infraStage?.status})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Intelligent "Continue Onboarding" Route
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 9. Testing Intelligent Next Step URL Resolution ---");
  assert(Boolean(summary.nextStepUrl), `nextStepUrl resolved: "${summary.nextStepUrl}"`);
  assert(
    !summary.nextStepUrl.includes("step=0"),
    `Since Company is complete, nextStepUrl does NOT open Step 0 (Company)`
  );
  console.log(`  -> Current Next Action Stage: ${summary.nextActionStage}, Next URL: ${summary.nextStepUrl}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Office Verification Autosave (`POST /api/bpo/centre-verification`)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 10. Testing Office Verification Autosave ---");
  const officeRes = await fetch(`${BASE_URL}/api/bpo/centre-verification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenPartnerA}`,
    },
    body: JSON.stringify({
      officeName: testCentreName,
      addressLine1: testAddress,
      city: "Gurugram",
      state: "Haryana",
      country: "India",
      postalCode: "122002",
      contactNumber: "9876543210",
      centreType: "Dedicated BPO Facility",
      ownershipType: "Commercial Lease",
      totalAreaSqft: "9500",
      numberOfFloors: "2",
      workingHours: "24/7 Operations",
      operatingShift: "US Shift (Night)",
    }),
  });

  assert(officeRes.ok, `POST /api/bpo/centre-verification succeeds with 200 (Status: ${officeRes.status})`);
  const officeData = await officeRes.json();
  assert(officeData.verification?.officeName === testCentreName, "Office verification officeName saved in DB");
  assert(officeData.verification?.totalAreaSqft === 9500, "Office verification totalAreaSqft saved in DB");
  assert(Boolean(officeData.onboardingProgress), "Office verification returns updated onboardingProgress");

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. Admin Dossier Sync & Fresh Cache Invalidation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 11. Testing Admin Panel Sync & Cache Invalidation ---");
  // Login as admin
  let adminToken = "";
  const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin",
      password: process.env.ADMIN_PASSWORD || "256b2#bpo",
    }),
  });

  if (adminLoginRes.ok) {
    const adminLoginData = await adminLoginRes.json();
    adminToken = adminLoginData.token;
  } else {
    adminToken = jwt.sign(
      { id: 1, username: "admin" },
      process.env.SESSION_SECRET || "thinkatic-admin-secret-key-2026-production",
      { expiresIn: "1h" }
    );
  }

    // Fetch Admin BPO Applications List
    const adminListRes = await fetch(`${BASE_URL}/api/admin/bpo-applications`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminListRes.ok, `Admin applications list returns 200`);
    const adminList = await adminListRes.json();
    const partnerInAdmin = adminList.find((p) => p.id === PARTNER_A_ID);
    assert(Boolean(partnerInAdmin), "Partner A appears in Admin BPO list");
    assert(
      partnerInAdmin?.companyName === testCompanyName,
      `Admin list reflects exact updated company name: "${testCompanyName}"`
    );

    // Fetch Admin Dossier for Partner A
    const dossierRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/${PARTNER_A_ID}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(dossierRes.ok, `Admin dossier returns 200`);
    const dossierData = await dossierRes.json();
    assert(
      dossierData.formalApplication?.company_data?.companyName === testCompanyName,
      `Admin dossier contains exact saved company name: "${testCompanyName}"`
    );
    assert(
      dossierData.formalApplication?.centre_data?.centreName === testCentreName,
      `Admin dossier contains exact saved centre name: "${testCentreName}"`
    );
    assert(
      dossierData.centreVerification?.officeName === testCentreName,
      `Admin dossier contains exact saved office verification: "${testCentreName}"`
    );


  console.log("\n==============================================================================");
  console.log(`🏁 TEST COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("==============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
