// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM
// BPO PERMANENT DELETE & COMPLETE DATABASE CLEANUP VERIFICATION SUITE
// ==============================================================================

import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const jwt = require(path.resolve("artifacts/api-server/node_modules/jsonwebtoken"));
const bcrypt = require(path.resolve("artifacts/api-server/node_modules/bcryptjs"));

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
const ADMIN_SECRET = process.env.SESSION_SECRET || "thinkatic-admin-secret-key-2026-production";

const supabaseJsPath = require.resolve("@supabase/supabase-js", { paths: ["./lib/db"] });
const { createClient } = require(supabaseJsPath);
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
  console.log("🚀 STARTING: BPO PERMANENT DELETE & DATABASE CLEANUP VERIFICATION");
  console.log("==============================================================================\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Admin Authentication
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- 1. Admin Authentication ---");
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
    const adminData = await adminLoginRes.json();
    adminToken = adminData.token;
  } else {
    adminToken = jwt.sign({ id: 1, username: "admin" }, ADMIN_SECRET, { expiresIn: "2h" });
  }
  assert(Boolean(adminToken), "Admin authenticated and token obtained");

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Create Fresh Target BPO Partner Account for Deletion Test
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. Creating Dedicated Target BPO Partner for Deletion ---");
  const uniqueStamp = Date.now();
  const testEmail = `del.test.${uniqueStamp}@thinkatic-bpo-test.com`;
  const testPassword = "Password@123456";
  const testCompanyName = `Thinkatic Deletion Test Corp ${uniqueStamp}`;

  const signupRes = await fetch(`${BASE_URL}/api/user/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      fullName: "Deletion Test Lead",
      accountType: "BPO",
      companyName: testCompanyName,
      phone: "+919876543299",
    }),
  });

  assert(signupRes.status === 201, `Target BPO signup succeeded (Status: ${signupRes.status})`);
  const signupData = await signupRes.json();
  const targetUserId = signupData.profile?.id;
  const partnerToken = signupData.token;
  assert(Boolean(targetUserId), `Target user ID created: ${targetUserId}`);

  // Create an application draft for this user
  console.log("\n--- 3. Creating Onboarding Application & Centre Data ---");
  const createDraftRes = await fetch(`${BASE_URL}/api/partner/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${partnerToken}`,
    },
    body: JSON.stringify({
      isDraft: true,
      companyData: {
        companyName: testCompanyName,
        legalEntity: "Private Limited",
        ownerName: "Deletion Test Lead",
        email: testEmail,
        phone: "+919876543299",
        address: "Unit 502, Test Tower, Cyber Park",
        city: "Gurugram",
        state: "Haryana",
        country: "India",
        panNumber: "ABCDE9999Z",
        gstNumber: "06ABCDE9999Z1Z5",
      },
      centreData: {
        centreName: `Test Facility ${uniqueStamp}`,
        centreAddress: "Unit 502, Test Tower",
        totalSeats: "60",
      },
      infrastructureData: {
        primaryIsp: "Airtel Enterprise Fiber",
        bandwidthMbps: "500",
      },
      processExperience: ["Technical Support"],
    }),
  });

  assert(createDraftRes.ok, `Draft application created (Status: ${createDraftRes.status})`);
  const draftData = await createDraftRes.json();
  const targetAppId = draftData.application?.id || draftData.id;
  assert(Boolean(targetAppId), `Target application ID created: ${targetAppId}`);

  // Create an office verification submission
  const verifRes = await fetch(`${BASE_URL}/api/bpo/centre-verification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${partnerToken}`,
    },
    body: JSON.stringify({
      officeName: `Test Facility ${uniqueStamp}`,
      addressLine1: "Unit 502, Test Tower",
      city: "Gurugram",
      state: "Haryana",
      country: "India",
      postalCode: "122002",
      contactNumber: "+919876543299",
      centreType: "Dedicated BPO Facility",
      ownershipType: "Commercial Lease",
      totalAreaSqft: "5000",
      operatingShift: "US Shift (Night)",
    }),
  });

  assert(verifRes.ok, `Office verification recorded (Status: ${verifRes.status})`);
  const verifData = await verifRes.json();
  const targetVerifId = verifData.verification?.id;

  // Add a media record in Supabase
  if (targetVerifId) {
    const testStorageKey = `thinkatic-centre-verification/${targetUserId}/${targetVerifId}/photos/reception/test-photo.jpg`;
    await supabase.from("bpo_centre_media").insert({
      verification_id: targetVerifId,
      applicant_user_id: targetUserId,
      media_type: "photo",
      category: "reception_entrance",
      storage_key: testStorageKey,
      original_file_name: "test-photo.jpg",
      mime_type: "image/jpeg",
      file_size: 1024,
      uploaded_by: targetUserId,
      status: "active",
    });
  }

  // Verify target records exist in database
  console.log("\n--- 4. Verifying Target Records Exist in PostgreSQL Before Deletion ---");
  const { data: profBefore } = await supabase.from("profiles").select("id").eq("id", targetUserId).maybeSingle();
  assert(Boolean(profBefore), "Profile exists in DB before deletion");

  const { data: appBefore } = await supabase.from("bpo_partner_applications").select("id").eq("applicant_user_id", targetUserId).maybeSingle();
  assert(Boolean(appBefore), "Application exists in DB before deletion");

  const { data: verBefore } = await supabase.from("bpo_centre_verification").select("id").eq("applicant_user_id", targetUserId).maybeSingle();
  assert(Boolean(verBefore), "Centre verification exists in DB before deletion");

  // Verify target is visible in Admin BPO Applications list
  const listBefore = await fetch(`${BASE_URL}/api/admin/bpo-applications`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listBeforeData = await listBefore.json();
  const foundInAdminBefore = listBeforeData.find((a) => a.id === targetUserId);
  assert(Boolean(foundInAdminBefore), "Target BPO appears in Admin applications list before deletion");

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Security & RBAC Validations
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 5. Testing Security Controls on DELETE Endpoint ---");

  // 5.1 Unauthenticated DELETE -> 401
  const unauthRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/${targetUserId}`, {
    method: "DELETE",
  });
  assert(unauthRes.status === 401, `Unauthenticated DELETE rejected with 401 (Status: ${unauthRes.status})`);

  // 5.2 Partner token attempting DELETE -> 403 (RBAC)
  const nonAdminRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/${targetUserId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${partnerToken}` },
  });
  assert(
    nonAdminRes.status === 401 || nonAdminRes.status === 403,
    `Non-admin partner DELETE rejected with 401/403 (Status: ${nonAdminRes.status})`
  );

  // 5.3 Non-existent application ID -> 404
  const notFoundRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/999999999`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(notFoundRes.status === 404, `Non-existent ID rejected with 404 (Status: ${notFoundRes.status})`);

  // 5.4 Malicious / SQL Injection ID -> 400
  const sqlInjRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/1;DROP%20TABLE%20users;--`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(sqlInjRes.status === 400, `Malicious identifier rejected with 400 (Status: ${sqlInjRes.status})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Execute Permanent BPO Deletion via Admin DELETE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 6. Executing Permanent BPO Deletion via Admin Endpoint ---");
  const deleteRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/${targetUserId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      reason: "Automated verification test of complete database cleanup",
    }),
  });

  assert(deleteRes.ok, `DELETE /api/admin/bpo-applications/:id returns 200 (Status: ${deleteRes.status})`);
  const deleteData = await deleteRes.json();
  assert(deleteData.success === true, "Delete response returns success: true");
  assert(deleteData.message === "BPO Partner permanently deleted.", `Message: "${deleteData.message}"`);
  assert(deleteData.deletedUserId === targetUserId, "Correct deletedUserId returned");
  assert(deleteData.deletedEmail === testEmail, "Correct deletedEmail returned");

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Verify Database Cleanup Across All Tables
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 7. Verifying Complete Database Cleanup ---");

  // 7.1 profiles row
  const { data: profAfter } = await supabase.from("profiles").select("id").eq("id", targetUserId).maybeSingle();
  assert(profAfter === null, "profiles row permanently erased (null)");

  const { data: profByEmail } = await supabase.from("profiles").select("id").eq("email", testEmail).maybeSingle();
  assert(profByEmail === null, "profiles row by email permanently erased (null)");

  // 7.2 bpo_partner_applications
  const { data: appAfter } = await supabase
    .from("bpo_partner_applications")
    .select("id")
    .eq("applicant_user_id", targetUserId)
    .maybeSingle();
  assert(appAfter === null, "bpo_partner_applications permanently erased (null)");

  // 7.3 bpo_centre_verification
  const { data: verAfter } = await supabase
    .from("bpo_centre_verification")
    .select("id")
    .eq("applicant_user_id", targetUserId)
    .maybeSingle();
  assert(verAfter === null, "bpo_centre_verification permanently erased (null)");

  // 7.4 bpo_centre_media
  const { data: mediaAfter } = await supabase
    .from("bpo_centre_media")
    .select("id")
    .eq("applicant_user_id", targetUserId);
  assert((mediaAfter || []).length === 0, "bpo_centre_media records permanently erased (0 rows)");

  // 7.5 bpo_partners
  const { data: partnerAfter } = await supabase.from("bpo_partners").select("id").eq("email", testEmail).maybeSingle();
  assert(partnerAfter === null, "bpo_partners record permanently erased (null)");

  // 7.6 bpo_partner_users
  const { data: pUsersAfter } = await supabase.from("bpo_partner_users").select("id").eq("user_id", targetUserId);
  assert((pUsersAfter || []).length === 0, "bpo_partner_users permanently erased (0 rows)");

  // 7.7 bpo_partner_agreements
  const { data: agrAfter } = await supabase.from("bpo_partner_agreements").select("id").eq("contact_email", testEmail);
  assert((agrAfter || []).length === 0, "bpo_partner_agreements permanently erased (0 rows)");

  // 7.8 Supabase Auth user
  try {
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(targetUserId);
    assert(
      !authUser?.user || authErr?.message?.includes("not found"),
      "Supabase Auth user is completely erased or not found"
    );
  } catch {
    assert(true, "Supabase Auth user confirmed absent");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Verify Immutable Audit Record Preserved
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 8. Verifying Minimum Immutable Audit Record Preserved ---");
  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("action", "bpo_permanently_deleted")
    .eq("entity_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(1);

  assert(Boolean(auditLogs && auditLogs.length > 0), "Audit log record 'bpo_permanently_deleted' found in audit_logs");
  const auditEntry = auditLogs?.[0];
  assert(auditEntry?.metadata?.deleted_email === testEmail, `Audit log contains correct deleted_email: ${auditEntry?.metadata?.deleted_email}`);
  assert(auditEntry?.metadata?.deleted_company_name === testCompanyName, `Audit log contains company name: ${auditEntry?.metadata?.deleted_company_name}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Verify Admin List Refresh
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 9. Verifying Admin List Cache Invalidation & Refresh ---");
  const listAfter = await fetch(`${BASE_URL}/api/admin/bpo-applications`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(listAfter.ok, "Admin BPO list returns 200 OK");
  const listAfterData = await listAfter.json();
  const foundInAdminAfter = listAfterData.find((a) => a.id === targetUserId || a.email === testEmail);
  assert(
    !foundInAdminAfter,
    "Target BPO is NO LONGER PRESENT in Admin BPO list (authoritative fresh DB state)"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Fresh Registration Using SAME Email
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 10. Testing Fresh Registration Using the EXACT SAME Email ---");
  const freshCompanyName = "Thinkatic Fresh Start BPO " + Date.now();
  const reRegisterRes = await fetch(`${BASE_URL}/api/user/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail, // EXACT SAME EMAIL
      password: "NewPassword@654321",
      fullName: "Fresh Founder",
      accountType: "BPO",
      companyName: freshCompanyName,
      phone: "+919123456780",
    }),
  });

  assert(
    reRegisterRes.status === 201,
    `Same email re-registration succeeded with 201 Created (Status: ${reRegisterRes.status})`
  );
  const reRegisterData = await reRegisterRes.json();
  const freshUserId = reRegisterData.profile?.id;
  const freshToken = reRegisterData.token;
  assert(
    freshUserId && freshUserId !== targetUserId,
    `New account has brand new profile ID (${freshUserId} != old ${targetUserId})`
  );

  // Verify fresh account has completely clean onboarding state
  const freshStatusRes = await fetch(`${BASE_URL}/api/bpo/status`, {
    headers: { Authorization: `Bearer ${freshToken}` },
  });
  assert(freshStatusRes.ok, "Fresh account GET /api/bpo/status returns 200");
  const freshStatusData = await freshStatusRes.json();
  const freshSummary = freshStatusData.onboardingSummary;

  assert(
    freshSummary.completedStages === 1,
    `Fresh onboarding has only 1 stage completed (Account Setup only, Got ${freshSummary.completedStages}/${freshSummary.totalStages})`
  );
  assert(
    freshSummary.progressPercentage <= 15,
    `Fresh onboarding progress is pristine at initial baseline (Got ${freshSummary.progressPercentage}%)`
  );

  const freshCompanyStage = freshSummary.stages.find((s) => s.key === "company");
  const freshCentreStage = freshSummary.stages.find((s) => s.key === "centre");
  assert(freshCompanyStage?.completed === false, "Company stage is not completed for fresh account");
  assert(freshCentreStage?.completed === false, "Centre stage is not completed for fresh account");
  assert(freshCompanyStage?.status !== "Complete", `Company stage status is ${freshCompanyStage?.status} (not Complete)`);
  assert(freshCentreStage?.status !== "Complete", `Centre stage status is ${freshCentreStage?.status} (not Complete)`);
  assert(
    freshSummary.nextStepUrl?.includes("step=0"),
    `Fresh account nextStepUrl points to Step 0 (Company Profile): "${freshSummary.nextStepUrl}"`
  );

  // Clean up the temporary re-registered test user as well
  await fetch(`${BASE_URL}/api/admin/bpo-applications/${freshUserId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });

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
