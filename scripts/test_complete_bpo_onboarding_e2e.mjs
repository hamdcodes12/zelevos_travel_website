/**
 * FINAL END-TO-END BPO ONBOARDING VERIFICATION TEST SUITE
 * 
 * Verifies the complete real flow from Partner Portal -> Supabase -> Admin BPO Approval:
 * 1. Fresh Primary BPO test account + Secondary BPO account (Multi-tenant IDOR attack testing)
 * 2. Stage-by-stage real persistence in PostgreSQL (Supabase)
 * 3. Authoritative progress calculation (no dummy counters, no localStorage)
 * 4. Browser refresh / re-login simulation after EVERY stage
 * 5. Admin Panel receives identical real data in Approvals list and dossier
 * 6. Document downloads: Unauthenticated (401), Authorized Admin (200/302), Authorized Partner (200/302), Anti-IDOR (403)
 * 7. Office photos & live walkthrough video streaming from private storage + Anti-IDOR
 * 8. Admin Verification: Rejections require reasons (400), approvals update DB
 * 9. Final Approval: Database status updates first, partner portal unlocks at 100% (canEnterPortal: true)
 * 10. Security: Anti-IDOR, executable upload rejection, path traversal rejection, magic byte enforcement
 * 11. Complete Cleanup: Full deletion of test tenancies from DB
 */

import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);

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

const supabaseJsPath = require.resolve("@supabase/supabase-js", { paths: ["./lib/db"] });
const { createClient } = require(supabaseJsPath);
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:4317";

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
    results.push({ status: "PASS", message });
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
    results.push({ status: "FAIL", message });
  }
}

// Minimal valid PDF binary buffer with "%PDF-1.4" magic bytes
const VALID_PDF_BUFFER = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000120 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
);

// Minimal valid JPEG binary buffer with FFD8FF magic bytes
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08,
  0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x37, 0xff, 0xd9,
]);

// Minimal valid WebM video header buffer (EBML ID: 1A 45 DF A3)
const VALID_WEBM_VIDEO_BUFFER = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81,
  0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, 0x42, 0x87, 0x81, 0x02,
  0x42, 0x85, 0x81, 0x02, 0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
]);

async function verifyRefreshAndReauth(email, password, stageName, expectedCompleted, expectedPct, completedKeys = []) {
  console.log(`  🔄 Simulating browser refresh & fresh login after Stage ${stageName}...`);
  const reauthRes = await fetch(`${BASE_URL}/api/user/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert(reauthRes.ok, `Re-login succeeded after Stage ${stageName}`);
  const freshToken = (await reauthRes.json()).token;

  const statusRes = await fetch(`${BASE_URL}/api/bpo/status`, {
    headers: { Authorization: `Bearer ${freshToken}` },
  });
  assert(statusRes.ok, `GET /api/bpo/status after re-login returned 200`);
  const summary = (await statusRes.json()).onboardingSummary;

  assert(
    summary.completedStages === expectedCompleted,
    `Progress remains intact at ${expectedCompleted}/9 after refresh (Got: ${summary.completedStages})`
  );
  assert(
    summary.progressPercentage === expectedPct,
    `Progress percentage remains intact at ${expectedPct}% after refresh (Got: ${summary.progressPercentage}%)`
  );

  for (const k of completedKeys) {
    const stage = summary.stages.find((s) => s.key === k);
    assert(stage?.completed === true, `Previously completed stage '${k}' remains Complete without reset or relocking`);
  }
  return freshToken;
}

async function runSuite() {
  console.log("==============================================================================");
  console.log("🚀 STARTING FINAL END-TO-END BPO ONBOARDING VERIFICATION SUITE");
  console.log("   Authoritative PostgreSQL + Full Partner Flow + Admin Approval + Security");
  console.log("==============================================================================\n");

  const timestamp = Date.now();
  const primaryBpoEmail = `e2e.bpo.${timestamp}@thinkatic-e2e.test`;
  const primaryBpoPassword = `E2ePass#${timestamp}!`;
  let primaryUserId = "";
  let primaryUserToken = "";
  let primaryAppId = 0;
  let primaryVerifId = 0;
  let primaryAgreementId = 0;

  // Secondary BPO account (attacker / competitor for anti-IDOR tests)
  const secondaryBpoEmail = `attacker.bpo.${timestamp}@thinkatic-e2e.test`;
  const secondaryBpoPassword = `AttackerPass#${timestamp}!`;
  let secondaryUserId = "";
  let secondaryUserToken = "";

  // Admin token
  let adminToken = "";

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SETUP: ADMIN AUTH & FRESH USER ACCOUNTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- 1. Authenticating Admin & Provisioning Test Accounts ---");

  // Admin Login
  const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: process.env.ADMIN_PASSWORD || "256b2#bpo" }),
  });
  assert(adminLoginRes.ok, `Admin login succeeded (Status: ${adminLoginRes.status})`);
  const adminLoginData = await adminLoginRes.json();
  adminToken = adminLoginData.token;
  assert(Boolean(adminToken), "Admin JWT token acquired");

  // Register Primary BPO Account
  const primaryRegRes = await fetch(`${BASE_URL}/api/user/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Vikram Malhotra",
      email: primaryBpoEmail,
      password: primaryBpoPassword,
      accountType: "BPO",
      companyName: "Nexus Global Delivery Pvt Ltd",
      phone: "+919811122233",
    }),
  });
  assert(primaryRegRes.ok, `Primary BPO registration succeeded (Status: ${primaryRegRes.status})`);
  const primaryRegData = await primaryRegRes.json();
  primaryUserId = primaryRegData.profile?.id || primaryRegData.user?.id;
  primaryUserToken = primaryRegData.token;
  assert(Boolean(primaryUserId), `Primary BPO User ID created: ${primaryUserId}`);
  assert(Boolean(primaryUserToken), "Primary BPO User JWT token acquired");

  // Register Secondary BPO Account (for Multi-Tenant IDOR Attack Testing)
  const secondaryRegRes = await fetch(`${BASE_URL}/api/user/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Rival Competitor",
      email: secondaryBpoEmail,
      password: secondaryBpoPassword,
      accountType: "BPO",
      companyName: "Rival Operations Inc",
      phone: "+919899988877",
    }),
  });
  assert(secondaryRegRes.ok, `Secondary BPO registration succeeded (Status: ${secondaryRegRes.status})`);
  const secondaryRegData = await secondaryRegRes.json();
  secondaryUserId = secondaryRegData.profile?.id || secondaryRegData.user?.id;
  secondaryUserToken = secondaryRegData.token;
  assert(Boolean(secondaryUserId), `Secondary BPO User ID created: ${secondaryUserId}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. AUTHORITATIVE DATABASE PERSISTENCE CHECK (BASELINE)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. Verifying Baseline Database State in Supabase PostgreSQL ---");

  const { data: dbProfilePrimary, error: dbErr1 } = await supabase
    .from("profiles")
    .select("id, email, full_name, account_type, bpo_status, is_active")
    .eq("id", primaryUserId)
    .maybeSingle();

  assert(!dbErr1 && dbProfilePrimary !== null, "Primary user profile persisted in PostgreSQL 'profiles'");
  assert(dbProfilePrimary?.account_type === "BPO", "Profile account_type is 'BPO'");
  assert(dbProfilePrimary?.bpo_status === "PENDING" || dbProfilePrimary?.bpo_status === "DRAFT", `Profile bpo_status initialized (Got: ${dbProfilePrimary?.bpo_status})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. STAGE 1: BASELINE ONBOARDING PROGRESS (1/9, 11%)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 3. Verifying Stage 1: Account Setup Baseline Progress (1/9) ---");

  const initStatusRes = await fetch(`${BASE_URL}/api/bpo/status`, {
    headers: { Authorization: `Bearer ${primaryUserToken}` },
  });
  assert(initStatusRes.ok, `GET /api/bpo/status succeeded (Status: ${initStatusRes.status})`);
  const initStatusData = await initStatusRes.json();
  const initSummary = initStatusData.onboardingSummary;

  assert(initSummary.completedStages === 1, `Initial completed stages is exactly 1/9 (Got ${initSummary.completedStages})`);
  assert(initSummary.totalStages === 9, `Total stages is exactly 9 (Got ${initSummary.totalStages})`);
  assert(initSummary.progressPercentage === 11, `Initial progress percentage is 11% (Got ${initSummary.progressPercentage}%)`);

  const stageAccount = initSummary.stages.find((s) => s.key === "account");
  const stageCompany = initSummary.stages.find((s) => s.key === "company");
  const stageCentre = initSummary.stages.find((s) => s.key === "centre");

  assert(stageAccount?.completed === true, "Stage 1 (Account Setup) is Complete");
  assert(stageCompany?.completed === false && stageCompany?.status === "Required", "Stage 2 (Company) is Required");
  assert(stageCentre?.completed === false && stageCentre?.isLocked === true, "Stage 3 (Centre) is Locked initially");
  assert(initSummary.canEnterPortal === false, "Portal access is locked at baseline");

  // Re-auth / Refresh Simulation Stage 1
  primaryUserToken = await verifyRefreshAndReauth(primaryBpoEmail, primaryBpoPassword, "1 (Account Setup)", 1, 11, ["account"]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. STAGE 2: COMPANY INFORMATION (2/9, 22%)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 4. Completing Stage 2: Company Information ---");
  const companyPayload = {
    companyData: {
      companyName: "Nexus Global Delivery Pvt Ltd",
      legalEntity: "Private Limited Company",
      ownerName: "Vikram Malhotra",
      email: primaryBpoEmail,
      phone: "+919811122233",
      address: "Building 4, DLF Cyber City, Sector 24, Gurugram, HR 122002",
      city: "Gurugram",
      state: "Haryana",
      country: "India",
      panNumber: "ABCDE1234F",
      gstNumber: "27AABCU9603R1ZM",
      gstApplicable: true,
      website: "https://nexusglobalbpo.example.com",
    },
    isDraft: true,
  };

  const companyRes = await fetch(`${BASE_URL}/api/partner/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
    body: JSON.stringify(companyPayload),
  });
  assert(companyRes.status === 200 || companyRes.status === 201, `Company info submitted (Status: ${companyRes.status})`);
  const companyData = await companyRes.json();
  primaryAppId = companyData.application?.id;
  assert(Boolean(primaryAppId), `Primary application ID confirmed: ${primaryAppId}`);

  // Authoritative Database Check in Supabase PostgreSQL
  const { data: dbAppCompany } = await supabase
    .from("bpo_partner_applications")
    .select("company_data")
    .eq("id", primaryAppId)
    .maybeSingle();
  assert(
    dbAppCompany?.company_data?.companyName === "Nexus Global Delivery Pvt Ltd",
    "PostgreSQL bpo_partner_applications has persisted companyName"
  );
  assert(
    dbAppCompany?.company_data?.panNumber === "ABCDE1234F",
    "PostgreSQL bpo_partner_applications has persisted PAN number"
  );

  // Check Progress: Should be 2/9, 22%
  const statusAfterCompanyRes = await fetch(`${BASE_URL}/api/bpo/status`, {
    headers: { Authorization: `Bearer ${primaryUserToken}` },
  });
  const statusAfterCompany = (await statusAfterCompanyRes.json()).onboardingSummary;
  assert(statusAfterCompany.completedStages === 2, `Completed stages increased to 2/9 (Got ${statusAfterCompany.completedStages})`);
  assert(statusAfterCompany.progressPercentage === 22, `Progress increased to 22% (Got ${statusAfterCompany.progressPercentage}%)`);
  assert(statusAfterCompany.stages.find((s) => s.key === "company")?.completed === true, "Stage 2 (Company) is marked Complete");
  assert(statusAfterCompany.stages.find((s) => s.key === "centre")?.isLocked === false, "Stage 3 (Centre) is now Unlocked (Required)");

  // Re-auth / Refresh Simulation Stage 2
  primaryUserToken = await verifyRefreshAndReauth(primaryBpoEmail, primaryBpoPassword, "2 (Company)", 2, 22, ["account", "company"]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. STAGE 3: CENTRE / OFFICE INFORMATION (3/9, 33%)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 5. Completing Stage 3: Centre / Office Information ---");
  const centrePayload = {
    centreData: {
      centreName: "Cyber City Delivery Centre 1",
      centreAddress: "Floor 4, Tower B, DLF Cyber City",
      city: "Gurugram",
      state: "Haryana",
      postalCode: "122002",
      totalSeats: 85,
      activeAgents: 0, // Keep 0 so Stage 5 (Experience) is unlocked strictly when Stage 5 is completed
      shiftsPerDay: 3,
    },
  };

  const patchCentreRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
    body: JSON.stringify(centrePayload),
  });
  assert(patchCentreRes.ok, `PATCH centreData succeeded (Status: ${patchCentreRes.status})`);

  // Authoritative Database Check
  const { data: dbAppCentre } = await supabase
    .from("bpo_partner_applications")
    .select("centre_data")
    .eq("id", primaryAppId)
    .maybeSingle();
  assert(
    Number(dbAppCentre?.centre_data?.totalSeats) === 85,
    "PostgreSQL bpo_partner_applications has persisted totalSeats (85)"
  );

  // Check Progress: Should be 3/9, 33%
  const statusAfterCentre = (await (await fetch(`${BASE_URL}/api/bpo/status`, { headers: { Authorization: `Bearer ${primaryUserToken}` } })).json()).onboardingSummary;
  assert(statusAfterCentre.completedStages === 3, `Completed stages increased to 3/9 (Got ${statusAfterCentre.completedStages})`);
  assert(statusAfterCentre.progressPercentage === 33, `Progress increased to 33% (Got ${statusAfterCentre.progressPercentage}%)`);
  assert(statusAfterCentre.stages.find((s) => s.key === "centre")?.completed === true, "Stage 3 (Centre) is marked Complete");
  assert(statusAfterCentre.stages.find((s) => s.key === "infrastructure")?.isLocked === false, "Stage 4 (Infrastructure) is now Unlocked");

  // Re-auth / Refresh Simulation Stage 3
  primaryUserToken = await verifyRefreshAndReauth(primaryBpoEmail, primaryBpoPassword, "3 (Centre)", 3, 33, ["account", "company", "centre"]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. STAGE 4: INFRASTRUCTURE SPECIFICATIONS (4/9, 44%)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 6. Completing Stage 4: Infrastructure Specifications ---");
  const infraPayload = {
    infrastructureData: {
      primaryIsp: "Tata Communications",
      internetBandwidth: "1 Gbps Dedicated Fiber Leased Line",
      backupInternet: "Airtel 500 Mbps Secondary Redundant Fiber",
      powerBackup: "100% DG Set + Online Emerson UPS 40 kVA",
      computers: "85 Dell OptiPlex Core i7 Workstations with Dual Monitors",
    },
  };

  const patchInfraRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
    body: JSON.stringify(infraPayload),
  });
  assert(patchInfraRes.ok, `PATCH infrastructureData succeeded (Status: ${patchInfraRes.status})`);

  // Authoritative Database Check
  const { data: dbAppInfra } = await supabase
    .from("bpo_partner_applications")
    .select("infrastructure_data")
    .eq("id", primaryAppId)
    .maybeSingle();
  assert(
    dbAppInfra?.infrastructure_data?.primaryIsp === "Tata Communications",
    "PostgreSQL bpo_partner_applications has persisted primaryIsp"
  );

  // Check Progress: Should be exactly 4/9, 44%
  const statusAfterInfra = (await (await fetch(`${BASE_URL}/api/bpo/status`, { headers: { Authorization: `Bearer ${primaryUserToken}` } })).json()).onboardingSummary;
  assert(statusAfterInfra.completedStages === 4, `Completed stages increased to 4/9 (Got ${statusAfterInfra.completedStages})`);
  assert(statusAfterInfra.progressPercentage === 44, `Progress increased to 44% (Got ${statusAfterInfra.progressPercentage}%)`);
  assert(statusAfterInfra.stages.find((s) => s.key === "infrastructure")?.completed === true, "Stage 4 (Infrastructure) is marked Complete");
  assert(statusAfterInfra.stages.find((s) => s.key === "experience")?.isLocked === false, "Stage 5 (Experience) is now Unlocked");

  // Re-auth / Refresh Simulation Stage 4
  primaryUserToken = await verifyRefreshAndReauth(primaryBpoEmail, primaryBpoPassword, "4 (Infrastructure)", 4, 44, ["account", "company", "centre", "infrastructure"]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. STAGE 5: PROCESS EXPERIENCE & CAPACITY (5/9, 56%)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 7. Completing Stage 5: Process Experience & Capacity ---");
  const expPayload = {
    processExperience: [
      "Inbound Technical Support L1/L2",
      "Customer Care & Retention Inbound",
      "Back Office KYC Document Verification",
      "Healthcare Process Automation",
    ],
    centreData: {
      activeAgents: 55,
    },
  };

  const patchExpRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
    body: JSON.stringify(expPayload),
  });
  assert(patchExpRes.ok, `PATCH processExperience succeeded (Status: ${patchExpRes.status})`);

  // Authoritative Database Check
  const { data: dbAppExp } = await supabase
    .from("bpo_partner_applications")
    .select("process_experience")
    .eq("id", primaryAppId)
    .maybeSingle();
  assert(
    Array.isArray(dbAppExp?.process_experience) && dbAppExp.process_experience.length >= 4,
    "PostgreSQL bpo_partner_applications has persisted process_experience array"
  );

  // Check Progress: Should be 5/9, 56%
  const statusAfterExp = (await (await fetch(`${BASE_URL}/api/bpo/status`, { headers: { Authorization: `Bearer ${primaryUserToken}` } })).json()).onboardingSummary;
  assert(statusAfterExp.completedStages === 5, `Completed stages increased to 5/9 (Got ${statusAfterExp.completedStages})`);
  assert(statusAfterExp.progressPercentage === 56, `Progress increased to 56% (Got ${statusAfterExp.progressPercentage}%)`);
  assert(statusAfterExp.stages.find((s) => s.key === "experience")?.completed === true, "Stage 5 (Experience) is marked Complete");
  assert(statusAfterExp.stages.find((s) => s.key === "documents")?.isLocked === false, "Stage 6 (Documents) is now Unlocked");

  // Re-auth / Refresh Simulation Stage 5
  primaryUserToken = await verifyRefreshAndReauth(primaryBpoEmail, primaryBpoPassword, "5 (Experience)", 5, 56, ["account", "company", "centre", "infrastructure", "experience"]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. STAGE 6: DOCUMENTS / KYC UPLOAD (6/9, 67%)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 8. Completing Stage 6: Uploading Required Compliance Documents ---");
  const docsToUpload = [
    { type: "pan_card", name: "Company_PAN_Card.pdf", pan: "ABCDE1234F" },
    { type: "gst_certificate", name: "GST_Certificate.pdf", gst: "27AABCU9603R1ZM", gstApplicable: true },
    { type: "incorporation_certificate", name: "Incorporation_Certificate.pdf" },
  ];

  for (const doc of docsToUpload) {
    const uploadRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
      body: JSON.stringify({
        documentType: doc.type,
        fileName: doc.name,
        mimeType: "application/pdf",
        fileData: `data:application/pdf;base64,${VALID_PDF_BUFFER.toString("base64")}`,
        fileSizeBytes: VALID_PDF_BUFFER.length,
        panNumber: doc.pan,
        gstNumber: doc.gst,
        gstApplicable: doc.gstApplicable ?? true,
      }),
    });
    assert(uploadRes.ok, `Document upload '${doc.type}' succeeded (Status: ${uploadRes.status})`);
  }

  // Authoritative Database Check in bpo_application_documents
  const { data: dbDocs } = await supabase
    .from("bpo_application_documents")
    .select("document_type, status")
    .eq("application_id", primaryAppId);
  assert(
    Array.isArray(dbDocs) && dbDocs.length >= 3,
    `PostgreSQL bpo_application_documents has at least 3 persisted document records (Found: ${dbDocs?.length})`
  );

  // Check Progress: Should be 6/9, 67%
  const statusAfterDocs = (await (await fetch(`${BASE_URL}/api/bpo/status`, { headers: { Authorization: `Bearer ${primaryUserToken}` } })).json()).onboardingSummary;
  assert(statusAfterDocs.completedStages === 6, `Completed stages increased to 6/9 (Got ${statusAfterDocs.completedStages})`);
  assert(statusAfterDocs.progressPercentage === 67, `Progress increased to 67% (Got ${statusAfterDocs.progressPercentage}%)`);
  assert(statusAfterDocs.stages.find((s) => s.key === "documents")?.completed === true, "Stage 6 (Documents) is marked Complete");
  assert(statusAfterDocs.stages.find((s) => s.key === "verification")?.isLocked === false, "Stage 7 (Verification) is now Unlocked");

  // Re-auth / Refresh Simulation Stage 6
  primaryUserToken = await verifyRefreshAndReauth(primaryBpoEmail, primaryBpoPassword, "6 (Documents)", 6, 67, ["account", "company", "centre", "infrastructure", "experience", "documents"]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. STAGE 7: OFFICE / CENTRE VERIFICATION & MEDIA EVIDENCE (7/9, 78%)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 9. Completing Stage 7: Office Verification & Media Evidence ---");

  // Save mandatory office details
  const officeDetailsRes = await fetch(`${BASE_URL}/api/bpo/centre-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
    body: JSON.stringify({
      officeName: "Nexus Cyber City Main Centre",
      addressLine1: "Tower B, Level 4, DLF Cyber City",
      city: "Gurugram",
      state: "Haryana",
      country: "India",
      postalCode: "122002",
      contactNumber: "+919811122233",
      centreType: "Dedicated Facility",
      ownershipType: "Leased",
      operatingSince: "2021",
      totalAreaSqft: 7500,
      numberOfFloors: 1,
    }),
  });
  assert(officeDetailsRes.ok, `Office details submitted (Status: ${officeDetailsRes.status})`);
  const officeDetailsData = await officeDetailsRes.json();
  primaryVerifId = officeDetailsData.verification?.id;
  assert(Boolean(primaryVerifId), `Office verification ID established: ${primaryVerifId}`);

  // Upload 6 mandatory photo categories
  const requiredPhotoCats = [
    "reception_entrance",
    "workstation_area",
    "operations_area",
    "infrastructure_equipment",
    "network_setup",
    "power_backup",
  ];

  let uploadedMediaId = 0;
  for (const cat of requiredPhotoCats) {
    const photoRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
      body: JSON.stringify({
        category: cat,
        fileName: `${cat}_evidence.jpg`,
        mimeType: "image/jpeg",
        fileData: `data:image/jpeg;base64,${VALID_JPEG_BUFFER.toString("base64")}`,
        applicationId: primaryAppId,
      }),
    });
    assert(photoRes.ok, `Office photo '${cat}' uploaded (Status: ${photoRes.status})`);
    const pData = await photoRes.json();
    if (pData.media?.id) uploadedMediaId = pData.media.id;
  }

  // Upload Live Walkthrough Video
  const videoRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/video`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
    body: JSON.stringify({
      fileName: "live_walkthrough_recorded.webm",
      mimeType: "video/webm",
      fileData: `data:video/webm;base64,${VALID_WEBM_VIDEO_BUFFER.toString("base64")}`,
      confirmed: true,
      durationSeconds: 45,
      applicationId: primaryAppId,
    }),
  });
  assert(videoRes.ok, `Live walkthrough video uploaded (Status: ${videoRes.status})`);
  const videoData = await videoRes.json();
  const uploadedVideoMediaId = videoData.media?.id;
  assert(Boolean(uploadedVideoMediaId), `Walkthrough video media ID: ${uploadedVideoMediaId}`);

  // Submit Centre Verification
  const verifSubmitRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
    body: JSON.stringify({ applicationId: primaryAppId }),
  });
  assert(verifSubmitRes.ok, `Office verification submitted (Status: ${verifSubmitRes.status})`);

  // Authoritative Database Check in Supabase PostgreSQL
  const { data: dbVerif } = await supabase
    .from("bpo_centre_verification")
    .select("status, office_name")
    .eq("id", primaryVerifId)
    .maybeSingle();
  assert(
    dbVerif?.status === "UNDER_REVIEW" || dbVerif?.status === "SUBMITTED",
    `PostgreSQL bpo_centre_verification status is UNDER_REVIEW / SUBMITTED (Got: ${dbVerif?.status})`
  );

  // Admin Reviews and Approves Centre Verification
  console.log("  🛡️ Admin Review of Office Verification...");
  const adminGetVerifRes = await fetch(`${BASE_URL}/api/admin/bpo/centre-verifications/${primaryVerifId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminGetVerifRes.ok, "Admin loaded office verification dossier");

  // Test: Rejection without mandatory reason MUST FAIL with 400
  const adminRejectNoReasonRes = await fetch(`${BASE_URL}/api/admin/bpo/centre-verifications/${primaryVerifId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ reason: "" }),
  });
  assert(adminRejectNoReasonRes.status === 400, "Rejecting office verification without reason rejected with 400");

  // Admin Approves Office Verification
  const adminApproveVerifRes = await fetch(`${BASE_URL}/api/admin/bpo/centre-verifications/${primaryVerifId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
  });
  assert(adminApproveVerifRes.ok, "Admin approved office verification");

  // Authoritative Database Check: Status is APPROVED
  const { data: dbVerifApproved } = await supabase
    .from("bpo_centre_verification")
    .select("status")
    .eq("id", primaryVerifId)
    .maybeSingle();
  assert(dbVerifApproved?.status === "APPROVED", "PostgreSQL bpo_centre_verification status is now APPROVED");

  // Check Progress: Should be 7/9, 78%
  const statusAfterVerif = (await (await fetch(`${BASE_URL}/api/bpo/status`, { headers: { Authorization: `Bearer ${primaryUserToken}` } })).json()).onboardingSummary;
  assert(statusAfterVerif.completedStages === 7, `Completed stages increased to 7/9 (Got ${statusAfterVerif.completedStages})`);
  assert(statusAfterVerif.progressPercentage === 78, `Progress increased to 78% (Got ${statusAfterVerif.progressPercentage}%)`);
  assert(statusAfterVerif.stages.find((s) => s.key === "verification")?.completed === true, "Stage 7 (Verification) is marked Complete");
  assert(statusAfterVerif.stages.find((s) => s.key === "agreement")?.isLocked === false, "Stage 8 (Agreement) is now Unlocked");

  // Re-auth / Refresh Simulation Stage 7
  primaryUserToken = await verifyRefreshAndReauth(primaryBpoEmail, primaryBpoPassword, "7 (Office Verification)", 7, 78, ["account", "company", "centre", "infrastructure", "experience", "documents", "verification"]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. STAGE 8: GLOBAL DELIVERY PARTNER AGREEMENT WORKFLOW (8/9, 89%)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 10. Completing Stage 8: Master Agreement Issuance, Signing & Approval ---");

  // Partner checks agreement status (triggers auto-issuance)
  const agreementGetRes = await fetch(`${BASE_URL}/api/bpo/agreement`, {
    headers: { Authorization: `Bearer ${primaryUserToken}` },
  });
  assert(agreementGetRes.ok, `GET /api/bpo/agreement returns 200 (Status: ${agreementGetRes.status})`);
  const agreementGetData = await agreementGetRes.json();
  primaryAgreementId = agreementGetData.agreement?.id;
  assert(Boolean(primaryAgreementId), `Agreement ID resolved: ${primaryAgreementId} (Code: ${agreementGetData.agreement?.agreementCode})`);

  // Partner uploads signed agreement PDF
  const uploadSignedRes = await fetch(`${BASE_URL}/api/bpo/agreement/upload-signed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
    body: JSON.stringify({
      fileName: "Signed_Global_Delivery_Agreement.pdf",
      mimeType: "application/pdf",
      fileData: `data:application/pdf;base64,${VALID_PDF_BUFFER.toString("base64")}`,
      fileSizeBytes: VALID_PDF_BUFFER.length,
    }),
  });
  assert(uploadSignedRes.ok, `Signed agreement uploaded successfully (Status: ${uploadSignedRes.status})`);

  // Partner submits agreement for Admin Review
  const submitAgrRes = await fetch(`${BASE_URL}/api/bpo/agreement/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
  });
  assert(submitAgrRes.ok, `Signed agreement submitted for review (Status: ${submitAgrRes.status})`);

  // Authoritative Database Check in Supabase PostgreSQL
  const { data: dbAgreement } = await supabase
    .from("bpo_partner_agreements")
    .select("status, signed_document_file_name, signed_document_url")
    .or(`application_id.eq.${primaryAppId},agreement_code.eq.${agreementGetData.agreement?.agreementCode}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assert(Boolean(dbAgreement?.signed_document_file_name || dbAgreement?.signed_document_url), "PostgreSQL bpo_partner_agreements has stored signed document reference");

  // Admin Reviews and Approves Agreement
  console.log("  🛡️ Admin Review of Master Agreement...");
  // Test: Rejection without mandatory reason MUST FAIL with 400
  const adminRejectAgrNoReasonRes = await fetch(`${BASE_URL}/api/admin/agreements/${primaryAgreementId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ reason: "" }),
  });
  assert(adminRejectAgrNoReasonRes.status === 400, "Rejecting agreement without reason rejected with 400");

  // Admin Approves Agreement
  const adminApproveAgrRes = await fetch(`${BASE_URL}/api/admin/agreements/${primaryAgreementId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
  });
  assert(adminApproveAgrRes.ok, "Admin approved signed agreement");

  // Authoritative Database Check: Status is approved
  const { data: dbAgreementApproved } = await supabase
    .from("bpo_partner_agreements")
    .select("status")
    .or(`application_id.eq.${primaryAppId},agreement_code.eq.${agreementGetData.agreement?.agreementCode}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assert(dbAgreementApproved?.status === "approved", "PostgreSQL bpo_partner_agreements status is approved");

  // Check Progress: Should be 8/9, 89%
  const statusAfterAgr = (await (await fetch(`${BASE_URL}/api/bpo/status`, { headers: { Authorization: `Bearer ${primaryUserToken}` } })).json()).onboardingSummary;
  assert(statusAfterAgr.completedStages === 8, `Completed stages increased to 8/9 (Got ${statusAfterAgr.completedStages})`);
  assert(statusAfterAgr.progressPercentage === 89, `Progress increased to 89% (Got ${statusAfterAgr.progressPercentage}%)`);
  assert(statusAfterAgr.stages.find((s) => s.key === "agreement")?.completed === true, "Stage 8 (Agreement) is marked Complete");

  // Re-auth / Refresh Simulation Stage 8
  primaryUserToken = await verifyRefreshAndReauth(primaryBpoEmail, primaryBpoPassword, "8 (Agreement)", 8, 89, ["account", "company", "centre", "infrastructure", "experience", "documents", "verification", "agreement"]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. STAGE 9: FORMAL SUBMISSION & ADMIN FINAL APPROVAL (100% PORTAL ACTIVATION)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 11. Completing Stage 9: Formal Application Submission & Admin Approval ---");

  // Partner formally submits the complete application package
  const finalSubmitRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
  });
  assert(finalSubmitRes.ok, `Formal application submitted (Status: ${finalSubmitRes.status})`);

  // Authoritative Database Check: bpo_partner_applications is under_review / submitted
  const { data: dbAppUnderReview } = await supabase
    .from("bpo_partner_applications")
    .select("status")
    .eq("id", primaryAppId)
    .maybeSingle();
  assert(
    dbAppUnderReview?.status === "under_review" || dbAppUnderReview?.status === "submitted",
    `PostgreSQL bpo_partner_applications status is under_review / submitted (Got: ${dbAppUnderReview?.status})`
  );

  const { data: dbProfileUnderReview } = await supabase
    .from("profiles")
    .select("bpo_status, bpo_application_details")
    .eq("id", primaryUserId)
    .maybeSingle();
  assert(
    dbProfileUnderReview?.bpo_status === "PENDING" || dbProfileUnderReview?.bpo_status === "UNDER_REVIEW",
    `PostgreSQL profiles bpo_status is PENDING / UNDER_REVIEW (Got: ${dbProfileUnderReview?.bpo_status})`
  );

  // Admin verifies the application appears in Admin Approvals list with real data
  console.log("  🛡️ Admin Verification: Inspecting Application in BPO Approvals...");
  const adminBpoListRes = await fetch(`${BASE_URL}/api/admin/bpo-applications?status=all&refresh=true`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminBpoListRes.ok, "Admin fetched BPO applications list");
  const adminBpoListData = await adminBpoListRes.json();
  const appsList = Array.isArray(adminBpoListData)
    ? adminBpoListData
    : (adminBpoListData.applications || adminBpoListData.data || []);
  const listedApp = appsList.find((a) => a.id === primaryUserId || a.email === primaryBpoEmail);

  assert(Boolean(listedApp), "Target BPO application appears in Admin BPO Approvals table");
  assert(listedApp?.companyName === "Nexus Global Delivery Pvt Ltd", "Admin receives correct company name");
  assert(listedApp?.name === "Vikram Malhotra", "Admin receives correct applicant name");
  assert(listedApp?.email === primaryBpoEmail, "Admin receives correct applicant email");
  assert(listedApp?.centreVerificationStatus === "APPROVED", "Admin receives correct office verification status (APPROVED)");
  assert(listedApp?.agreementStatus === "approved" || listedApp?.agreementStatus === "signed", `Admin receives correct agreement status (Got: ${listedApp?.agreementStatus})`);

  // Admin executes Final Approval
  const adminApproveAppRes = await fetch(`${BASE_URL}/api/admin/partner-applications/${primaryAppId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
  });
  assert(adminApproveAppRes.ok, `Admin final approval succeeded (Status: ${adminApproveAppRes.status})`);

  // Authoritative Database Check in PostgreSQL: Profile APPROVED, Role bpo_partner, bpo_partners created
  const { data: dbFinalProfile } = await supabase
    .from("profiles")
    .select("bpo_status, role, is_active")
    .eq("id", primaryUserId)
    .maybeSingle();
  assert(dbFinalProfile?.bpo_status === "APPROVED", "PostgreSQL profiles bpo_status is APPROVED");
  assert(dbFinalProfile?.role === "bpo_partner", "PostgreSQL profiles role is bpo_partner");
  assert(dbFinalProfile?.is_active === true, "PostgreSQL profiles is_active is true");

  const { data: dbPartnerOrg } = await supabase
    .from("bpo_partners")
    .select("id, partner_code, status")
    .eq("email", primaryBpoEmail)
    .maybeSingle();
  assert(Boolean(dbPartnerOrg?.id), "PostgreSQL bpo_partners row created and accredited");
  assert(dbPartnerOrg?.status === "active", "PostgreSQL bpo_partners status is active");

  // Partner checks status: 9/9 stages complete, 100%, canEnterPortal: true
  console.log("  🔓 Verifying Partner Portal Unlock & 100% Progress...");
  const finalStatusRes = await fetch(`${BASE_URL}/api/bpo/status`, {
    headers: { Authorization: `Bearer ${primaryUserToken}` },
  });
  assert(finalStatusRes.ok, "GET /api/bpo/status returns 200");
  const finalStatusSummary = (await finalStatusRes.json()).onboardingSummary;

  assert(finalStatusSummary.completedStages === 9, `Completed stages is exactly 9/9 (Got ${finalStatusSummary.completedStages})`);
  assert(finalStatusSummary.progressPercentage === 100, `Progress is exactly 100% (Got ${finalStatusSummary.progressPercentage}%)`);
  assert(finalStatusSummary.canEnterPortal === true, "Portal access is now fully unlocked (canEnterPortal: true)");
  assert(finalStatusSummary.stages.every((s) => s.completed === true), "All 9 onboarding stages are marked Complete");

  // Re-auth / Refresh Simulation Stage 9
  primaryUserToken = await verifyRefreshAndReauth(primaryBpoEmail, primaryBpoPassword, "9 (Final Approval & Unlock)", 9, 100, [
    "account", "company", "centre", "infrastructure", "experience", "documents", "verification", "agreement", "approval"
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. DOCUMENT DOWNLOAD & MEDIA STREAMING VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 12. Verifying Document Download & Private Media Streaming ---");

  // 12.1 Unauthenticated document download
  const unauthDocRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}/documents/pan_card/download`);
  assert(unauthDocRes.status === 401 || unauthDocRes.status === 403, `Unauthenticated document download rejected with 401/403 (Got: ${unauthDocRes.status})`);

  // 12.2 Authorized Admin document download
  const adminDocRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}/documents/pan_card/download`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminDocRes.status === 200 || adminDocRes.status === 302, `Admin document download succeeded (Status: ${adminDocRes.status})`);

  // 12.3 Authorized Partner document download
  const partnerDocRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}/documents/pan_card/download`, {
    headers: { Authorization: `Bearer ${primaryUserToken}` },
  });
  assert(partnerDocRes.status === 200 || partnerDocRes.status === 302, `Owner partner document download succeeded (Status: ${partnerDocRes.status})`);

  // 12.4 Unauthenticated media streaming
  const unauthMediaRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/media/${uploadedMediaId}`);
  assert(unauthMediaRes.status === 401 || unauthMediaRes.status === 403, `Unauthenticated media access rejected with 401/403 (Got: ${unauthMediaRes.status})`);

  // 12.5 Authorized Admin media streaming
  const adminMediaRes = await fetch(`${BASE_URL}/api/admin/bpo/centre-verifications/media/${uploadedMediaId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminMediaRes.ok || adminMediaRes.status === 302, `Admin media streaming succeeded (Status: ${adminMediaRes.status})`);

  // 12.6 Authorized Partner media streaming
  const partnerMediaRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/media/${uploadedMediaId}`, {
    headers: { Authorization: `Bearer ${primaryUserToken}` },
  });
  assert(partnerMediaRes.ok || partnerMediaRes.status === 302, `Owner partner media streaming succeeded (Status: ${partnerMediaRes.status})`);

  // 12.7 Authorized Partner live walkthrough video streaming
  const partnerVideoRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/media/${uploadedVideoMediaId}`, {
    headers: { Authorization: `Bearer ${primaryUserToken}` },
  });
  assert(partnerVideoRes.ok || partnerVideoRes.status === 302, `Owner partner walkthrough video streaming succeeded (Status: ${partnerVideoRes.status})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. SECURITY & ANTI-IDOR ATTACK TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 13. Running Rigorous Anti-IDOR & Multi-Tenant Attack Tests ---");

  // Attack 1: User B attempts to download User A's private document
  const idorDocRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}/documents/pan_card/download`, {
    headers: { Authorization: `Bearer ${secondaryUserToken}` },
  });
  assert(idorDocRes.status === 403, `IDOR document access by competitor B rejected with 403 (Status: ${idorDocRes.status})`);

  // Attack 2: User B attempts to access User A's private office photos
  const idorPhotoRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/media/${uploadedMediaId}`, {
    headers: { Authorization: `Bearer ${secondaryUserToken}` },
  });
  assert(idorPhotoRes.status === 403, `IDOR photo access by competitor B rejected with 403 (Status: ${idorPhotoRes.status})`);

  // Attack 3: User B attempts to access User A's live walkthrough video
  const idorVideoRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/media/${uploadedVideoMediaId}`, {
    headers: { Authorization: `Bearer ${secondaryUserToken}` },
  });
  assert(idorVideoRes.status === 403, `IDOR video access by competitor B rejected with 403 (Status: ${idorVideoRes.status})`);

  // Attack 4: User B attempts to PATCH / modify User A's application
  const idorPatchRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secondaryUserToken}` },
    body: JSON.stringify({ companyData: { companyName: "Hijacked by Competitor" } }),
  });
  assert(idorPatchRes.status === 403, `IDOR application modification attempt rejected with 403 (Status: ${idorPatchRes.status})`);

  // Attack 5: User B attempts to submit User A's application
  const idorSubmitRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secondaryUserToken}` },
  });
  assert(idorSubmitRes.status === 403, `IDOR application submit attempt rejected with 403 (Status: ${idorSubmitRes.status})`);

  // Attack 6: User B attempts to upload document into User A's application
  const idorUploadRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secondaryUserToken}` },
    body: JSON.stringify({
      documentType: "pan_card",
      fileName: "malicious.pdf",
      fileData: `data:application/pdf;base64,${VALID_PDF_BUFFER.toString("base64")}`,
    }),
  });
  assert(idorUploadRes.status === 403, `IDOR document upload attempt rejected with 403 (Status: ${idorUploadRes.status})`);

  // Attack 7: Regular partner attempts to call Admin approval endpoint
  const nonAdminApproveRes = await fetch(`${BASE_URL}/api/admin/partner-applications/${primaryAppId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
  });
  assert(
    nonAdminApproveRes.status === 401 || nonAdminApproveRes.status === 403,
    `Non-admin calling Admin approve endpoint rejected with 401/403 (Status: ${nonAdminApproveRes.status})`
  );

  // Attack 8: Uploading executable file (.exe) masquerading as document
  const maliciousExeRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
    body: JSON.stringify({
      documentType: "pan_card",
      fileName: "payload.exe",
      mimeType: "application/x-msdownload",
      fileData: `data:application/x-msdownload;base64,TVqQAAMAAAAEAAAA`,
    }),
  });
  assert(maliciousExeRes.status === 400, `Malicious executable upload rejected with 400 (Status: ${maliciousExeRes.status})`);

  // Attack 9: Directory traversal in document filename
  const pathTraversalRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryUserToken}` },
    body: JSON.stringify({
      documentType: "pan_card",
      fileName: "../../etc/passwd.pdf",
      mimeType: "application/pdf",
      fileData: `data:application/pdf;base64,${VALID_PDF_BUFFER.toString("base64")}`,
    }),
  });
  assert(pathTraversalRes.status === 400, `Path traversal in filename rejected with 400 (Status: ${pathTraversalRes.status})`);

  // Attack 10: Agreement upload with invalid header (non-PDF binary)
  // Ensure secondary partner has draft application to issue agreement
  await fetch(`${BASE_URL}/api/partner/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secondaryUserToken}` },
    body: JSON.stringify({ companyData: { companyName: "Rival Operations Inc", ownerName: "Rival" }, isDraft: true }),
  });
  await fetch(`${BASE_URL}/api/bpo/agreement`, { headers: { Authorization: `Bearer ${secondaryUserToken}` } });
  const invalidAgreementRes = await fetch(`${BASE_URL}/api/bpo/agreement/upload-signed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secondaryUserToken}` },
    body: JSON.stringify({
      fileName: "FakeAgreement.pdf",
      mimeType: "application/pdf",
      fileData: "data:application/pdf;base64,Tk9UX0FfUERGX0ZJTEU=", // "NOT_A_PDF_FILE"
      fileSizeBytes: 15,
    }),
  });
  assert(invalidAgreementRes.status === 400, `Agreement upload with invalid magic bytes rejected with 400 (Status: ${invalidAgreementRes.status})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. CLEANUP: Permanent Deletion of All Test Tenancies
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 14. Executing Complete Cleanup of Test Tenancies ---");

  // Clean Primary BPO test tenancy
  const cleanPrimaryRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/${primaryUserId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(cleanPrimaryRes.ok, `Primary BPO test tenancy permanently purged (Status: ${cleanPrimaryRes.status})`);

  // Clean Secondary BPO test tenancy
  const cleanSecondaryRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/${secondaryUserId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(cleanSecondaryRes.ok, `Secondary BPO test tenancy permanently purged (Status: ${cleanSecondaryRes.status})`);

  // Verify DB Cleanliness: No orphaned profiles or applications remain
  const { data: checkPrimaryProfile } = await supabase.from("profiles").select("id").eq("id", primaryUserId).maybeSingle();
  const { data: checkSecondaryProfile } = await supabase.from("profiles").select("id").eq("id", secondaryUserId).maybeSingle();
  assert(checkPrimaryProfile === null, "Primary BPO profile permanently eradicated from PostgreSQL");
  assert(checkSecondaryProfile === null, "Secondary BPO profile permanently eradicated from PostgreSQL");

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
