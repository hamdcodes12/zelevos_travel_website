/**
 * FOCUSED FINAL VERIFICATION SUITE: 3 TARGETED ITEMS ONLY
 * 
 * 1. Stage 9 Role/Status Consistency
 * 2. Complete Office Photo Requirement
 * 3. Authoritative Agreement PDF (23 Pages)
 */

import { createRequire } from "module";
import fs from "fs";
import path from "path";
import crypto from "crypto";

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

const pdfLibPath = require.resolve("pdf-lib", { paths: ["./artifacts/api-server"] });
const { PDFDocument } = require(pdfLibPath);

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:4317";

let passed = 0;
let failed = 0;
const results = {
  item1_role_status: { pass: false, details: [] },
  item2_office_photos: { pass: false, details: [] },
  item3_authoritative_pdf: { pass: false, details: [] },
};

function assert(condition, message) {
  if (!condition) {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  }
}

// Valid 1x1 JPEG buffer
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x03, 0x03, 0x03, 0x04,
  0x06, 0x04, 0x04, 0x04, 0x04, 0x04, 0x08, 0x06, 0x06, 0x05, 0x06, 0x09,
  0x08, 0x0a, 0x0a, 0x09, 0x08, 0x09, 0x09, 0x0a, 0x0c, 0x0f, 0x0c, 0x0a,
  0x0b, 0x0e, 0x0b, 0x09, 0x09, 0x0d, 0x11, 0x0d, 0x0e, 0x0f, 0x10, 0x10,
  0x11, 0x10, 0x0a, 0x0c, 0x12, 0x13, 0x12, 0x10, 0x13, 0x0f, 0x10, 0x10,
  0x10, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01,
  0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff,
  0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf, 0x00, 0xff, 0xd9,
]);

// Valid minimal WebM Video
const VALID_WEBM_VIDEO_BUFFER = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81,
  0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84,
  0x77, 0x65, 0x62, 0x6d, 0x42, 0x87, 0x81, 0x02, 0x42, 0x85, 0x81, 0x02,
  0x18, 0x53, 0x80, 0x67, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20,
  0x15, 0x49, 0xa9, 0x66, 0x99, 0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40,
  0x4d, 0x80, 0x84, 0x44, 0x6f, 0x63, 0x73, 0x57, 0x41, 0x84, 0x76, 0x70,
  0x38, 0x30, 0x1f, 0x43, 0xb6, 0x75, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x10, 0xe7, 0x81, 0x00, 0xa3, 0x81, 0x01, 0x80,
]);

async function run() {
  console.log("===============================================================================");
  console.log("      FOCUSED FINAL VERIFICATION SUITE: 3 TARGETED ITEMS ONLY                  ");
  console.log("===============================================================================\n");

  const timestamp = Date.now();
  const primaryEmail = `test_focus_primary_${timestamp}@thinkatic-test.com`;
  const competitorEmail = `test_focus_competitor_${timestamp}@thinkatic-test.com`;
  const adminEmail = process.env.ADMIN_EMAIL || "admin@thinkatic.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminPass123!";
  const testPassword = "Password123!@#Secure";

  let primaryToken = "";
  let primaryUserId = "";
  let primaryAppId = 0;
  let primaryPartnerId = "";
  let primaryVerifId = 0;
  let primaryAgreementId = 0;

  let competitorToken = "";
  let competitorUserId = "";
  let competitorAppId = 0;

  let adminToken = "";

  try {
    // -------------------------------------------------------------------------
    // 0. ADMIN AUTHENTICATION
    // -------------------------------------------------------------------------
    console.log(">>> [Setup] Authenticating Admin...");
    const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: process.env.ADMIN_PASSWORD || "256b2#bpo" }),
    });
    assert(adminLoginRes.ok, `Admin login successful (Status: ${adminLoginRes.status})`);
    const adminData = await adminLoginRes.json();
    adminToken = adminData.token;
    assert(Boolean(adminToken), "Admin JWT token acquired");

    // =========================================================================
    // ITEM 1: VERIFY STAGE 9 ROLE/STATUS CONSISTENCY
    // =========================================================================
    console.log("\n===========================================================================");
    console.log("ITEM 1: VERIFY STAGE 9 ROLE/STATUS CONSISTENCY");
    console.log("===========================================================================");

    console.log("--- 1.1 Register Primary BPO Applicant (Stage 1) ---");
    const regRes = await fetch(`${BASE_URL}/api/user/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: primaryEmail,
        password: testPassword,
        fullName: "Harpreet Focus Partner",
        companyName: "Focus Apex Solutions LLP",
        accountType: "BPO",
        phone: "+919876543210",
      }),
    });
    assert(regRes.ok, `Primary BPO registration OK (Status: ${regRes.status})`);
    const regData = await regRes.json();
    primaryToken = regData.token;
    primaryUserId = regData.profile?.id || regData.user?.id;
    assert(Boolean(primaryUserId), `Primary User ID established: ${primaryUserId}`);

    console.log("--- 1.2 Inspect PostgreSQL State Immediately After Registration (Stage 1) ---");
    const { data: stage1Profile, error: p1Err } = await supabase
      .from("profiles")
      .select("id, email, role, account_type, bpo_status, is_active, approved_at")
      .eq("id", primaryUserId)
      .single();
    assert(!p1Err && stage1Profile, `Fetched stage 1 profile for ${primaryUserId}`);

    console.log("Live Stage 1 Profile State:", {
      role: stage1Profile.role,
      account_type: stage1Profile.account_type,
      bpo_status: stage1Profile.bpo_status,
      is_active: stage1Profile.is_active,
    });

    assert(stage1Profile.role === "bpo_partner", `CONFIRMED: profiles.role is ALREADY 'bpo_partner' from Stage 1 registration (Got: '${stage1Profile.role}')`);
    assert(stage1Profile.account_type === "BPO", `CONFIRMED: profiles.account_type is 'BPO' (Got: '${stage1Profile.account_type}')`);
    assert(stage1Profile.bpo_status === "PENDING", `CONFIRMED: profiles.bpo_status is 'PENDING' at registration (Got: '${stage1Profile.bpo_status}')`);
    assert(stage1Profile.is_active === true, `CONFIRMED: profiles.is_active is true (Got: ${stage1Profile.is_active})`);
    assert(stage1Profile.approved_at === null, `CONFIRMED: profiles.approved_at is null at registration`);

    const { data: stage1Partner, error: partner1Err } = await supabase
      .from("bpo_partners")
      .select("id, partner_code, name, status, email")
      .eq("email", primaryEmail)
      .maybeSingle();
    assert(!partner1Err && stage1Partner, `bpo_partners table has initial record for ${primaryEmail}`);
    primaryPartnerId = stage1Partner.id;
    console.log("Stage 1 bpo_partners row:", { id: stage1Partner.id, partner_code: stage1Partner.partner_code, status: stage1Partner.status });
    assert(stage1Partner.status === "active", `bpo_partners status is 'active'`);

    const { data: stage1Membership, error: mem1Err } = await supabase
      .from("bpo_partner_users")
      .select("id, partner_id, user_id, role, status")
      .eq("user_id", primaryUserId)
      .maybeSingle();
    assert(!mem1Err && stage1Membership, `bpo_partner_users has initial membership for user ${primaryUserId}`);
    console.log("Stage 1 bpo_partner_users row:", { role: stage1Membership.role, status: stage1Membership.status });
    assert(stage1Membership.role === "partner_admin", `bpo_partner_users role is 'partner_admin'`);

    // Register Competitor Account for IDOR tests
    const compRegRes = await fetch(`${BASE_URL}/api/user/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: competitorEmail,
        password: testPassword,
        fullName: "Competitor Attacker",
        companyName: "Rival Infotech Ltd",
        accountType: "BPO",
        phone: "+919999999999",
      }),
    });
    assert(compRegRes.ok, "Competitor BPO registered");
    const compRegData = await compRegRes.json();
    competitorToken = compRegData.token;
    competitorUserId = compRegData.profile?.id || compRegData.user?.id;

    // Advance through Stages 2-8
    console.log("\n--- Advancing Through Onboarding Stages 2 to 8 ---");
    // Stage 2: Company Details
    const compRes = await fetch(`${BASE_URL}/api/partner/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryToken}` },
      body: JSON.stringify({
        companyData: {
          companyName: "Focus Apex Solutions LLP",
          legalEntity: "Limited Liability Partnership",
          ownerName: "Harpreet Focus Partner",
          email: primaryEmail,
          phone: "+919876543210",
          address: "Plot 42, Tech Park, Andheri East",
          city: "Mumbai",
          state: "Maharashtra",
          country: "India",
          panNumber: "AAAFB1234F",
          gstNumber: "27AAAFB1234F1Z5",
          gstApplicable: true,
          website: "https://focusapex.example.com",
        },
        isDraft: true,
      }),
    });
    assert(compRes.ok, `Stage 2 Company details submitted (Status: ${compRes.status})`);
    const compData = await compRes.json();
    primaryAppId = compData.application?.id;
    assert(Boolean(primaryAppId), `Primary application ID confirmed: ${primaryAppId}`);

    // Stage 3: Centre Details
    const ctrRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryToken}` },
      body: JSON.stringify({
        centreData: {
          centreName: "Mumbai Prime Delivery Centre",
          centreAddress: "Plot 42, Tech Park, Andheri East",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          totalSeats: 85,
          activeAgents: 0,
          shiftsPerDay: 3,
        },
      }),
    });
    assert(ctrRes.ok, `Stage 3 Centre details submitted (Status: ${ctrRes.status})`);

    // Stage 4: Infrastructure
    const infRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryToken}` },
      body: JSON.stringify({
        infrastructureData: {
          primaryIsp: "Tata Communications",
          internetBandwidth: "1 Gbps Dedicated Fiber",
          backupInternet: "Airtel 500 Mbps Secondary",
          powerBackup: "100% DG Set + Online UPS",
          computers: "85 Core i7 Workstations",
        },
      }),
    });
    assert(infRes.ok, `Stage 4 Infrastructure submitted (Status: ${infRes.status})`);

    // Stage 5: Experience
    const expRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryToken}` },
      body: JSON.stringify({
        processExperience: [
          "Inbound Technical Support",
          "Customer Care & Retention",
          "Back Office Document Verification",
        ],
        centreData: {
          activeAgents: 55,
        },
      }),
    });
    assert(expRes.ok, `Stage 5 Experience submitted (Status: ${expRes.status})`);

    // Stage 6: Documents
    const docsToUpload = [
      { type: "pan_card", name: "Company_PAN_Card.pdf", pan: "AAAFB1234F" },
      { type: "gst_certificate", name: "GST_Certificate.pdf", gst: "27AAAFB1234F1Z5", gstApplicable: true },
      { type: "incorporation_certificate", name: "Incorporation_Certificate.pdf" },
    ];
    for (const doc of docsToUpload) {
      const docRes = await fetch(`${BASE_URL}/api/partner/applications/${primaryAppId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryToken}` },
        body: JSON.stringify({
          documentType: doc.type,
          fileName: doc.name,
          mimeType: "application/pdf",
          fileData: `data:application/pdf;base64,${Buffer.from("%PDF-1.4\n%Doc\n%%EOF").toString("base64")}`,
          fileSizeBytes: 20,
          panNumber: doc.pan,
          gstNumber: doc.gst,
          gstApplicable: doc.gstApplicable ?? true,
        }),
      });
      assert(docRes.ok, `Stage 6 Doc '${doc.type}' uploaded (Status: ${docRes.status})`);
    }

    // Intermediate Check: verify role is STILL bpo_partner and status is STILL PENDING
    const { data: intermediateProf } = await supabase
      .from("profiles")
      .select("role, account_type, bpo_status")
      .eq("id", primaryUserId)
      .single();
    assert(intermediateProf.role === "bpo_partner", `Intermediate check: profiles.role remains 'bpo_partner' (Got: '${intermediateProf.role}')`);
    assert(intermediateProf.bpo_status === "PENDING", `Intermediate check: profiles.bpo_status remains 'PENDING' (Got: '${intermediateProf.bpo_status}')`);

    // =========================================================================
    // ITEM 2: VERIFY COMPLETE OFFICE PHOTO REQUIREMENT
    // =========================================================================
    console.log("\n===========================================================================");
    console.log("ITEM 2: VERIFY COMPLETE OFFICE PHOTO REQUIREMENT");
    console.log("===========================================================================");

    console.log("--- 2.1 Establishing Centre Verification Record ---");
    const initVerifRes = await fetch(`${BASE_URL}/api/bpo/centre-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryToken}` },
      body: JSON.stringify({
        officeName: "Focus Apex Headquarters",
        addressLine1: "Plot 42, Tech Park, Andheri East",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        contactNumber: "+91-9876543210",
        totalAreaSqft: "6500",
        workstationCount: "75",
        conferenceRoomCount: "2",
        cafeteriaAvailable: true,
      }),
    });
    assert(initVerifRes.ok, `Centre verification record established (Status: ${initVerifRes.status})`);
    const initVerifData = await initVerifRes.json();
    primaryVerifId = initVerifData.verification?.id;
    assert(Boolean(primaryVerifId), `Verification ID: ${primaryVerifId}`);

    console.log("--- 2.2 Uploading & Verifying ALL Photo Categories (6 Mandatory + 2 Optional) ---");
    const ALL_PHOTO_CATEGORIES = [
      { id: "reception_entrance", mandatory: true, label: "Reception / Entrance" },
      { id: "workstation_area", mandatory: true, label: "Workstation Area" },
      { id: "operations_area", mandatory: true, label: "Operations Area" },
      { id: "infrastructure_equipment", mandatory: true, label: "Infrastructure / Equipment" },
      { id: "network_setup", mandatory: true, label: "Network Setup" },
      { id: "power_backup", mandatory: true, label: "Power Backup" },
      { id: "management_area", mandatory: false, label: "Management / Supervisor Area (Optional)" },
      { id: "security_access", mandatory: false, label: "Security & Access (Optional)" },
    ];

    const uploadedMediaList = [];

    for (const cat of ALL_PHOTO_CATEGORIES) {
      console.log(`\n  * Testing Category: ${cat.id} (${cat.mandatory ? "MANDATORY" : "OPTIONAL"})`);
      // a) accepted by backend
      const photoUploadRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryToken}` },
        body: JSON.stringify({
          category: cat.id,
          fileName: `${cat.id}_evidence.jpg`,
          mimeType: "image/jpeg",
          fileData: `data:image/jpeg;base64,${VALID_JPEG_BUFFER.toString("base64")}`,
          applicationId: primaryAppId,
        }),
      });
      assert(photoUploadRes.ok, `a) Backend accepted category '${cat.id}' (Status: ${photoUploadRes.status})`);
      const pData = await photoUploadRes.json();
      assert(pData.success === true && pData.media?.id, `Upload response contains media ID`);
      const mediaId = pData.media.id;
      uploadedMediaList.push({ mediaId, category: cat.id, isMandatory: cat.mandatory });

      // b) securely stored in private storage
      assert(pData.media.storageBucket === "thinkatic-centre-verification", `b) Saved to private bucket: ${pData.media.storageBucket}`);
      assert(pData.media.storagePath.includes(cat.id), `b) Storage path correctly partitioned: ${pData.media.storagePath}`);

      // c) represented in PostgreSQL metadata
      const { data: dbMedia, error: dbMediaErr } = await supabase
        .from("bpo_centre_media")
        .select("id, verification_id, category, storage_key, mime_type, file_size, status")
        .eq("id", mediaId)
        .maybeSingle();
      assert(!dbMediaErr && dbMedia, `c) PostgreSQL bpo_centre_media row verified for ID ${mediaId}`);
      assert(dbMedia.category === cat.id, `c) DB category matches '${cat.id}'`);
      assert(dbMedia.status === "active", `c) DB media status is 'active'`);

      // d) visible to authorized Admin
      const adminMediaRes = await fetch(`${BASE_URL}/api/admin/bpo/centre-verifications/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(adminMediaRes.ok, `d) Authorized Admin stream OK for ${cat.id} (Status: ${adminMediaRes.status})`);
      const adminBuf = await adminMediaRes.arrayBuffer();
      assert(adminBuf.byteLength > 0, `d) Admin received valid binary bytes (${adminBuf.byteLength} bytes)`);

      // e) accessible to owning BPO partner only
      const partnerMediaRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${primaryToken}` },
      });
      assert(partnerMediaRes.ok, `e) Owning Partner stream OK for ${cat.id} (Status: ${partnerMediaRes.status})`);
      const partnerBuf = await partnerMediaRes.arrayBuffer();
      assert(partnerBuf.byteLength > 0, `e) Owning Partner received valid binary bytes (${partnerBuf.byteLength} bytes)`);

      // f) blocked for unauthorized tenants (Anti-IDOR)
      const compMediaRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${competitorToken}` },
      });
      assert(compMediaRes.status === 403, `f) Unauthorized tenant blocked with 403 Forbidden for ${cat.id} (Status: ${compMediaRes.status})`);
    }

    console.log("\n--- 2.3 Uploading Live Walkthrough Video ---");
    const videoUploadRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/video`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryToken}` },
      body: JSON.stringify({
        fileName: "live_walkthrough_recorded.webm",
        mimeType: "video/webm",
        fileData: `data:video/webm;base64,${VALID_WEBM_VIDEO_BUFFER.toString("base64")}`,
        confirmed: true,
        durationSeconds: 40,
        applicationId: primaryAppId,
      }),
    });
    assert(videoUploadRes.ok, `Live walkthrough video accepted (Status: ${videoUploadRes.status})`);
    const vData = await videoUploadRes.json();
    const videoMediaId = vData.media?.id;
    assert(Boolean(videoMediaId), `Walkthrough video media ID: ${videoMediaId}`);

    // Verify video admin, partner, and competitor IDOR
    const adminVidRes = await fetch(`${BASE_URL}/api/admin/bpo/centre-verifications/media/${videoMediaId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminVidRes.ok, "Admin stream OK for walkthrough video");

    const partnerVidRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/media/${videoMediaId}`, {
      headers: { Authorization: `Bearer ${primaryToken}` },
    });
    assert(partnerVidRes.ok, "Owning partner stream OK for walkthrough video");

    const compVidRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/media/${videoMediaId}`, {
      headers: { Authorization: `Bearer ${competitorToken}` },
    });
    assert(compVidRes.status === 403, `Competitor blocked with 403 Forbidden for walkthrough video (Status: ${compVidRes.status})`);

    console.log("\n--- 2.4 Verifying g) Preservation After Refresh and Re-login ---");
    // Re-login with fresh credentials
    const reAuthRes = await fetch(`${BASE_URL}/api/user/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: primaryEmail, password: testPassword }),
    });
    assert(reAuthRes.ok, "Partner re-authenticated with fresh login");
    const freshData = await reAuthRes.json();
    const freshToken = freshData.token;

    // Fetch centre verification with new token
    const verifCheckRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/me`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    });
    assert(verifCheckRes.ok, "Fetched verification state after re-login");
    const verifCheckData = await verifCheckRes.json();
    const activeMedia = verifCheckData.verification?.media?.filter(m => m.status === "active") || [];
    assert(activeMedia.length >= 9, `All media preserved across refresh/re-login (Found ${activeMedia.length} active items: 8 photos + 1 video)`);

    // Check completion breakdown
    const compCheckRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/completion`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    });
    assert(compCheckRes.ok, "Fetched evidence completion metrics");
    const compCheckData = await compCheckRes.json();
    console.log("Evidence Completion Metrics:", compCheckData.completion);
    assert(compCheckData.completion?.isComplete === true, `All 6 mandatory categories + video completed (isComplete: true)`);
    assert(compCheckData.completion?.completedRequired >= 7, `Mandatory evidence count >= 7`);

    // Submit Centre Verification
    const submitVerifRes = await fetch(`${BASE_URL}/api/bpo/centre-verification/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshToken}` },
      body: JSON.stringify({
        verificationId: primaryVerifId,
        confirmationNotes: "All 8 photo categories and video verified for audit.",
      }),
    });
    assert(submitVerifRes.ok, "Centre verification submitted for admin review");

    // Admin reviews and approves Centre Verification
    const adminApproveVerifRes = await fetch(`${BASE_URL}/api/admin/bpo/centre-verifications/${primaryVerifId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        notes: "Approved: Complete 8 photo categories and walkthrough video verified physically.",
        reviewedBy: "Admin Inspector",
      }),
    });
    assert(adminApproveVerifRes.ok, `Admin approved centre verification (Status: ${adminApproveVerifRes.status})`);
    results.item2_office_photos.pass = true;

    // =========================================================================
    // ITEM 3: VERIFY AUTHORITATIVE AGREEMENT PDF (23 PAGES)
    // =========================================================================
    console.log("\n===========================================================================");
    console.log("ITEM 3: VERIFY AUTHORITATIVE AGREEMENT PDF (23 PAGES)");
    console.log("===========================================================================");

    console.log("--- 3.1 Inspecting Source Template Files ---");
    const templateCandidates = [
      "Agreement/Agreement.pdf",
      "Agreement/BPO Agreement.pdf",
    ];

    for (const tPath of templateCandidates) {
      assert(fs.existsSync(tPath), `Source template exists: ${tPath}`);
      const tBytes = fs.readFileSync(tPath);
      assert(tBytes.length === 188208, `Template exact size matches 188,208 bytes (Got: ${tBytes.length})`);
      const hash = crypto.createHash("sha256").update(tBytes).digest("hex");
      assert(hash === "de307ca7b6fd98127feed0e87b0960cf4c36455122f9f2cc35b4fe1dc422e1fb", `SHA256 authoritative hash verified: ${hash}`);

      const pdfDoc = await PDFDocument.load(tBytes);
      const pageCount = pdfDoc.getPageCount();
      assert(pageCount === 23, `Source template ${tPath} strictly contains 23 pages (Got: ${pageCount})`);
    }

    console.log("\n--- 3.2 Generating / Downloading Partner-Specific Master Agreement ---");
    // Ensure agreement is created/retrieved for this partner
    const getAgrRes = await fetch(`${BASE_URL}/api/bpo/agreement`, {
      headers: { Authorization: `Bearer ${primaryToken}` },
    });
    assert(getAgrRes.ok, "Fetched/issued Partner Agreement");
    const agrData = await getAgrRes.json();
    primaryAgreementId = agrData.agreement?.id;
    assert(Boolean(primaryAgreementId), `Agreement ID established: ${primaryAgreementId}`);

    // Download generated partner agreement binary
    const downloadMasterRes = await fetch(`${BASE_URL}/api/bpo/agreement/download`, {
      headers: { Authorization: `Bearer ${primaryToken}` },
    });
    assert(downloadMasterRes.ok, `Downloaded partner master agreement (Status: ${downloadMasterRes.status})`);
    const masterBuf = Buffer.from(await downloadMasterRes.arrayBuffer());
    assert(masterBuf.length > 100000, `Downloaded generated PDF size: ${masterBuf.length} bytes`);

    // Verify generated agreement retains EXACTLY 23 pages and source template structure
    const generatedPdfDoc = await PDFDocument.load(masterBuf);
    const generatedPages = generatedPdfDoc.getPageCount();
    assert(generatedPages === 23, `CONFIRMED: Generated Agreement PDF strictly preserves 23 pages (Got: ${generatedPages})`);
    assert(masterBuf.slice(0, 5).toString("ascii") === "%PDF-", "Generated agreement contains valid PDF header");

    console.log("\n--- 3.3 Uploading Signed Agreement PDF ---");
    // Create authentic 23-page signed PDF to upload (or valid PDF buffer)
    const validSignedPdfBuffer = Buffer.from(
      `%PDF-1.4\n%Authentic Signed Global Delivery Partner Agreement\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000063 00000 n \n0000000114 00000 n \n0000000171 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n245\n%%EOF`
    );

    const uploadSignedRes = await fetch(`${BASE_URL}/api/bpo/agreement/upload-signed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryToken}` },
      body: JSON.stringify({
        fileName: "Signed_Global_Delivery_Agreement.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: validSignedPdfBuffer.length,
        fileData: `data:application/pdf;base64,${validSignedPdfBuffer.toString("base64")}`,
      }),
    });
    assert(uploadSignedRes.ok, `Signed agreement upload successful (Status: ${uploadSignedRes.status})`);
    const uploadSignedData = await uploadSignedRes.json();
    assert(uploadSignedData.status === "signed_agreement_submitted", `Agreement status transitioned to 'signed_agreement_submitted'`);

    console.log("\n--- 3.4 Verifying PostgreSQL Metadata & Storage ---");
    const { data: dbAgreement, error: dbAgrErr } = await supabase
      .from("bpo_partner_agreements")
      .select("id, status, signed_document_file_name, is_immutable, template_data")
      .eq("id", primaryAgreementId)
      .single();
    assert(!dbAgrErr && dbAgreement, `Fetched bpo_partner_agreements row from PostgreSQL: ${dbAgrErr?.message || ""}`);
    console.log("bpo_partner_agreements row:", {
      id: dbAgreement.id,
      status: dbAgreement.status,
      signed_document_file_name: dbAgreement.signed_document_file_name,
      is_immutable: dbAgreement.is_immutable,
      template_path: dbAgreement.template_data?.templatePath,
      master_document_reference: dbAgreement.template_data?.master_document_reference,
    });
    assert(dbAgreement.status === "signed_agreement_submitted", "PostgreSQL status is 'signed_agreement_submitted'");
    assert(dbAgreement.signed_document_file_name === "Signed_Global_Delivery_Agreement.pdf", "PostgreSQL records signed document file name");
    assert(dbAgreement.is_immutable === false, "Agreement is not yet immutable prior to admin approval");

    console.log("\n--- 3.5 Verifying Access Control & Anti-IDOR for Agreement Documents ---");
    // Admin view signed
    const adminViewSignedRes = await fetch(`${BASE_URL}/api/admin/agreements/${primaryAgreementId}/view-signed`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminViewSignedRes.ok, `Admin view signed PDF OK (Status: ${adminViewSignedRes.status})`);

    // Admin download signed
    const adminDownloadSignedRes = await fetch(`${BASE_URL}/api/admin/agreements/${primaryAgreementId}/download-signed`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminDownloadSignedRes.ok, `Admin download signed PDF OK (Status: ${adminDownloadSignedRes.status})`);

    // Partner view signed
    const partnerViewSignedRes = await fetch(`${BASE_URL}/api/bpo/agreement/view-signed`, {
      headers: { Authorization: `Bearer ${primaryToken}` },
    });
    assert(partnerViewSignedRes.ok, `Partner view signed PDF OK (Status: ${partnerViewSignedRes.status})`);

    // Partner download signed
    const partnerDownloadSignedRes = await fetch(`${BASE_URL}/api/bpo/agreement/download-signed`, {
      headers: { Authorization: `Bearer ${primaryToken}` },
    });
    assert(partnerDownloadSignedRes.ok, `Partner download signed PDF OK (Status: ${partnerDownloadSignedRes.status})`);

    // Competitor cannot call Admin view-signed
    const compAdminViewRes = await fetch(`${BASE_URL}/api/admin/agreements/${primaryAgreementId}/view-signed`, {
      headers: { Authorization: `Bearer ${competitorToken}` },
    });
    assert(compAdminViewRes.status === 401 || compAdminViewRes.status === 403, `Competitor blocked from Admin agreement endpoint (Status: ${compAdminViewRes.status})`);

    console.log("\n--- 3.6 Admin Approval & Immutability Lock ---");
    const approveAgrRes = await fetch(`${BASE_URL}/api/admin/agreements/${primaryAgreementId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ notes: "Legal review complete. Approved." }),
    });
    assert(approveAgrRes.ok, `Admin approved signed agreement (Status: ${approveAgrRes.status})`);

    // Verify Immutability in PostgreSQL
    const { data: approvedDbAgr } = await supabase
      .from("bpo_partner_agreements")
      .select("status, is_immutable, approved_at, approved_by_admin_name")
      .eq("id", primaryAgreementId)
      .single();
    assert(approvedDbAgr.status === "approved", "bpo_partner_agreements.status === 'approved'");
    assert(approvedDbAgr.is_immutable === true, "bpo_partner_agreements.is_immutable === true (LOCKED)");
    console.log("Approved Agreement DB Record:", approvedDbAgr);

    // Verify Immutability Rejection on re-upload
    const reuploadRes = await fetch(`${BASE_URL}/api/bpo/agreement/upload-signed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${primaryToken}` },
      body: JSON.stringify({
        fileName: "Malicious_Replacement_Agreement.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: validSignedPdfBuffer.length,
        fileData: `data:application/pdf;base64,${validSignedPdfBuffer.toString("base64")}`,
      }),
    });
    assert(reuploadRes.ok, "Re-upload request handled");
    const reuploadData = await reuploadRes.json();
    assert(
      reuploadData.message?.includes("already been approved and is legally verified"),
      `Overwriting locked agreement rejected: "${reuploadData.message}"`
    );
    results.item3_authoritative_pdf.pass = true;

    // =========================================================================
    // ITEM 1 (CONTINUED): STAGE 9 FINAL APPROVAL & CONSISTENCY CHECK
    // =========================================================================
    console.log("\n===========================================================================");
    console.log("ITEM 1 (COMPLETION): FINAL SUBMISSION, ACCREDITATION & ROLE/STATUS PROOF");
    console.log("===========================================================================");

    // Stage 9: Admin Final Approval
    console.log("Admin executing final accreditation approval...");
    const adminApproveAppRes = await fetch(`${BASE_URL}/api/admin/partner-applications/${primaryAppId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        notes: "Full BPO onboarding verification complete and accredited.",
      }),
    });
    assert(adminApproveAppRes.ok, `Stage 9 Admin Final Approval executed (Status: ${adminApproveAppRes.status})`);
    const adminApproveData = await adminApproveAppRes.json();
    console.log("Admin Final Approval result:", { centreId: adminApproveData.centreId, status: adminApproveData.application?.status });

    console.log("\n--- Querying Live PostgreSQL State After Stage 9 Final Approval ---");
    // 1. Check profiles
    const { data: finalProfile, error: fpErr } = await supabase
      .from("profiles")
      .select("id, email, role, account_type, bpo_status, is_active, approved_at")
      .eq("id", primaryUserId)
      .single();
    assert(!fpErr && finalProfile, "Fetched final profile row");
    console.log("Final profiles State:", finalProfile);

    assert(finalProfile.role === "bpo_partner", `CONFIRMED: profiles.role is 'bpo_partner' (Got: '${finalProfile.role}')`);
    assert(finalProfile.account_type === "BPO", `CONFIRMED: profiles.account_type is 'BPO' (Got: '${finalProfile.account_type}')`);
    assert(finalProfile.bpo_status === "APPROVED", `CONFIRMED: profiles.bpo_status transitioned from 'PENDING' to 'APPROVED' (Got: '${finalProfile.bpo_status}')`);
    assert(finalProfile.is_active === true, `CONFIRMED: profiles.is_active is true (Got: ${finalProfile.is_active})`);
    assert(Boolean(finalProfile.approved_at), `CONFIRMED: profiles.approved_at timestamp recorded: ${finalProfile.approved_at}`);

    // 2. Check bpo_partners
    const { data: finalPartner, error: fPartErr } = await supabase
      .from("bpo_partners")
      .select("id, partner_code, name, status, email")
      .eq("email", primaryEmail)
      .maybeSingle();
    assert(!fPartErr && finalPartner, "Fetched final bpo_partners row");
    console.log("Final bpo_partners State:", finalPartner);
    assert(finalPartner.status === "active", `bpo_partners.status is 'active'`);
    assert(Boolean(finalPartner.partner_code), `bpo_partners.partner_code is linked (${finalPartner.partner_code})`);

    // 3. Check bpo_partner_users
    const { data: finalMembership, error: fMemErr } = await supabase
      .from("bpo_partner_users")
      .select("id, partner_id, user_id, role, status")
      .eq("user_id", primaryUserId)
      .maybeSingle();
    assert(!fMemErr && finalMembership, "Fetched final bpo_partner_users row");
    console.log("Final bpo_partner_users State:", finalMembership);
    assert(finalMembership.role === "partner_admin", `bpo_partner_users.role is 'partner_admin'`);
    assert(finalMembership.status === "active", `bpo_partner_users.status is 'active'`);

    // 4. Check Partner Portal unlock via API
    const statusRes = await fetch(`${BASE_URL}/api/bpo/status`, {
      headers: { Authorization: `Bearer ${primaryToken}` },
    });
    assert(statusRes.ok, "Fetched BPO status endpoint");
    const statusData = await statusRes.json();
    console.log("BPO Status Endpoint:", {
      canEnterPortal: statusData.canEnterPortal,
      accountState: statusData.accountState,
      bpoStatus: statusData.bpoStatus,
    });
    assert(statusData.canEnterPortal === true, "CONFIRMED: canEnterPortal is true");
    assert(statusData.bpoStatus === "APPROVED" || statusData.status === "APPROVED", "CONFIRMED: bpoStatus is 'APPROVED'");

    results.item1_role_status.pass = true;

    console.log("\n===========================================================================");
    console.log("ALL 3 FOCUS ITEMS VERIFIED WITH REAL POSTGRESQL & STORAGE EVIDENCE!");
    console.log("===========================================================================");
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP TEST USERS & DATA
    // -------------------------------------------------------------------------
    console.log("\n>>> [Cleanup] Purging temporary test accounts...");
    try {
      const bpoCleanupPath = path.resolve("artifacts/api-server/src/lib/bpoCleanupService.ts");
      if (fs.existsSync(bpoCleanupPath)) {
        // Call cleanup for primary user and competitor user
        for (const uId of [primaryUserId, competitorUserId]) {
          if (uId) {
            // Cleanup from DB
            await supabase.from("bpo_partner_user_permissions").delete().in("partner_user_id", (
              await supabase.from("bpo_partner_users").select("id").eq("user_id", uId)
            ).data?.map(m => m.id) || []);
            await supabase.from("bpo_partner_users").delete().eq("user_id", uId);
            await supabase.from("bpo_centre_media").delete().eq("applicant_user_id", uId);
            await supabase.from("bpo_centre_verification_history").delete().in("verification_id", (
              await supabase.from("bpo_centre_verification").select("id").eq("applicant_user_id", uId)
            ).data?.map(v => v.id) || []);
            await supabase.from("bpo_centre_verification").delete().eq("applicant_user_id", uId);
            await supabase.from("bpo_application_documents").delete().eq("user_id", uId);
            await supabase.from("bpo_partner_agreements").delete().eq("user_id", uId);
            await supabase.from("bpo_partner_applications").delete().eq("applicant_user_id", uId);
            await supabase.from("bpo_partners").delete().eq("email", primaryEmail);
            await supabase.from("bpo_partners").delete().eq("email", competitorEmail);
            await supabase.from("profiles").delete().eq("id", uId);
            await supabase.auth.admin.deleteUser(uId).catch(() => {});
          }
        }
        console.log("Purged test data cleanly.");
      }
    } catch (cleanErr) {
      console.warn("Notice during cleanup:", cleanErr?.message);
    }
  }

  console.log(`\n===========================================================================`);
  console.log(`SUMMARY OF 3 FOCUSED CHECKS:`);
  console.log(`- Item 1: Stage 9 Role/Status Consistency:   ${results.item1_role_status.pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`- Item 2: Complete Office Photo Requirement: ${results.item2_office_photos.pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`- Item 3: Authoritative Agreement PDF:       ${results.item3_authoritative_pdf.pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Assertions Passed: ${passed} | Failed: ${failed}`);
  console.log(`===========================================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Unhandled error in verification suite:", err);
  process.exit(1);
});
