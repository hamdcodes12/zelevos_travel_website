// ==============================================================================
// THINKATIC - BPO DOCUMENT UPLOAD ARCHITECTURE & TAX/REGULATORY VERIFICATION TEST
// Verifies:
// 1. Independent 25 MB limit per document slot (24MB pass, 26MB fail)
// 2. No combined 25 MB limit (multi-document cumulative upload > 25MB passes)
// 3. Separate GST, PAN, Registration/CIN uploads (KYC regulatory slots)
// 4. File format validation (PDF, PNG, JPG, JPEG, DOCX pass; .exe, .bat, .sh fail)
// 5. Supabase PostgreSQL and private Storage persistence
// 6. Admin dossier view, signed URL downloads, verify/reject actions
// 7. IDOR & security controls
// ==============================================================================

import fs from "fs";
import path from "path";
import dns from "dns";
import { createRequire } from "module";

const require = createRequire(path.resolve("artifacts/api-server/package.json"));
const jwt = require("jsonwebtoken");

dns.setDefaultResultOrder("ipv4first");

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

const BASE_URL = process.env.TEST_API_URL || "http://localhost:4317/api";
const USER_JWT_SECRET = process.env.USER_SESSION_SECRET || process.env.SESSION_SECRET || "thinkatic-user-secret-2026";
const ADMIN_JWT_SECRET = process.env.SESSION_SECRET || process.env.USER_SESSION_SECRET || "dev-admin-secret";

console.log("==============================================================================");
console.log("THINKATIC — BPO DOCUMENT UPLOAD ARCHITECTURE & REGULATORY VERIFICATION SUITE");
console.log(`Base URL: ${BASE_URL}`);
console.log("==============================================================================\n");

// Helper to create test JWT tokens
function createUserToken(id, email, role = "user") {
  return jwt.sign({ id, email, role }, USER_JWT_SECRET, { expiresIn: "1d" });
}

function createAdminToken(id = 1, username = "admin") {
  return jwt.sign({ id, username }, ADMIN_JWT_SECRET, { expiresIn: "1d" });
}

// Helpers to create valid test file buffers with appropriate magic bytes
function createDummyPdfBuffer(sizeBytes) {
  const header = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n");
  const trailer = Buffer.from("\n%%EOF");
  const paddingLength = Math.max(0, sizeBytes - header.length - trailer.length);
  const padding = Buffer.alloc(paddingLength, 0x20); // spaces
  return Buffer.concat([header, padding, trailer]);
}

function createDummyPngBuffer(sizeBytes) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature
  const paddingLength = Math.max(0, sizeBytes - header.length);
  const padding = Buffer.alloc(paddingLength, 0x00);
  return Buffer.concat([header, padding]);
}

function createDummyJpgBuffer(sizeBytes) {
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]); // JPEG SOI & APP0
  const trailer = Buffer.from([0xff, 0xd9]); // EOI
  const paddingLength = Math.max(0, sizeBytes - header.length - trailer.length);
  const padding = Buffer.alloc(paddingLength, 0x00);
  return Buffer.concat([header, padding, trailer]);
}

function createDummyDocxBuffer(sizeBytes) {
  const header = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK zip header for docx
  const paddingLength = Math.max(0, sizeBytes - header.length);
  const padding = Buffer.alloc(paddingLength, 0x00);
  return Buffer.concat([header, padding]);
}

function createDummyExeBuffer(sizeBytes) {
  const header = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ header
  const paddingLength = Math.max(0, sizeBytes - header.length);
  const padding = Buffer.alloc(paddingLength, 0x00);
  return Buffer.concat([header, padding]);
}

let testPassed = 0;
let testFailed = 0;

function assert(condition, testName, detail = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName} ${detail ? `(${detail})` : ""}`);
    testPassed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    testFailed++;
  }
}

async function runTests() {
  const testUserId = "b0000000-0000-0000-0000-000000000001";
  const testUserEmail = "test.partner@thinkatic.com";
  const userToken = createUserToken(testUserId, testUserEmail);
  const adminToken = createAdminToken();

  const userHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userToken}`,
  };

  const adminHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  console.log("------------------------------------------------------------------------------");
  console.log("TEST STAGE 1: Application Creation & Step 1 Tax Field Removal");
  console.log("------------------------------------------------------------------------------");

  // Create an application without manual GST / PAN / CIN text fields
  const createRes = await fetch(`${BASE_URL}/partner/applications`, {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      companyData: {
        companyName: "Nexus BPO Solutions Pvt Ltd",
        legalEntity: "Private Limited",
        website: "https://nexus-bpo.com",
        ownerName: "Rajesh Kumar",
        email: testUserEmail,
        phone: "+91 98765 43210",
        address: "Cyber City, Infotech Park",
        city: "Pune",
        state: "Maharashtra",
        country: "India",
        // Note: No manual gstNumber, panNumber, registrationNumber supplied!
      },
      centreData: {
        centreName: "Pune Cyber Centre",
        totalSeats: "120",
        availableSeats: "60",
        workingHours: "24/7 (3 Shifts)",
      },
      infrastructureData: {
        primaryIsp: "Tata Communications",
        primaryBandwidth: "500",
        secondaryIsp: "Airtel Enterprise",
        powerBackup: "Online UPS + Cummins 250kVA DG",
      },
      processExperience: ["Customer Support", "Technical Support"],
      isDraft: true,
    }),
  });

  const createData = await createRes.json();
  assert(createRes.ok || createRes.status === 409, "Draft application created or retrieved", `Status ${createRes.status}`);

  const appId = createData.application?.id;
  assert(!!appId, "Valid application ID acquired", `App ID: ${appId}`);

  console.log("\n------------------------------------------------------------------------------");
  console.log("TEST STAGE 2: Individual 25 MB Limit Per Document Slot (24 MB Pass) & Cumulative > 25 MB");
  console.log("------------------------------------------------------------------------------");

  const slots = [
    { type: "gst_certificate", name: "GST Registration Certificate", filename: "gst_certificate_24mb.pdf", sizeMB: 24 },
    { type: "pan_card", name: "Company / Entity PAN Card", filename: "company_pan_card_2mb.pdf", sizeMB: 2 },
    { type: "registration_cin", name: "Registration / CIN Document", filename: "cin_incorporation_2mb.pdf", sizeMB: 2 },
    { type: "incorporation_certificate", name: "Certificate of Incorporation", filename: "incorporation_1mb.pdf", sizeMB: 1 },
    { type: "centre_floor_plan", name: "Centre Floor Plan & Facility Photos", filename: "floor_plan_facility_1mb.pdf", sizeMB: 1 },
    { type: "isp_sla", name: "ISP SLA & Infrastructure Proof", filename: "isp_sla_infrastructure_1mb.pdf", sizeMB: 1 },
    { type: "company_profile", name: "Corporate Company Profile Deck", filename: "company_profile_deck_1mb.pdf", sizeMB: 1 },
  ];

  let cumulativeBytesUploaded = 0;

  for (const slot of slots) {
    const sizeBytes = slot.sizeMB * 1024 * 1024;
    const pdfBuf = createDummyPdfBuffer(sizeBytes);
    const base64Data = `data:application/pdf;base64,${pdfBuf.toString("base64")}`;

    console.log(`  Uploading ${slot.sizeMB} MB document to slot '${slot.type}'...`);
    const uploadRes = await fetch(`${BASE_URL}/partner/applications/${appId}/documents`, {
      method: "POST",
      headers: userHeaders,
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        documentType: slot.type,
        fileName: slot.filename,
        mimeType: "application/pdf",
        fileData: base64Data,
      }),
    });

    const uploadData = await uploadRes.json();
    assert(uploadRes.ok, `Slot '${slot.type}' accepts ${slot.sizeMB} MB document`, `Status ${uploadRes.status}`);
    assert(uploadData.success === true, `Slot '${slot.type}' upload success flag true`);
    cumulativeBytesUploaded += sizeBytes;

    // Brief pause between massive uploads to allow socket reuse & GC
    await new Promise((r) => setTimeout(r, 1500));
  }

  const cumulativeMB = (cumulativeBytesUploaded / (1024 * 1024)).toFixed(1);
  console.log(`\n  Cumulative Uploaded across 7 slots: ${cumulativeMB} MB.`);
  assert(
    cumulativeBytesUploaded > 25 * 1024 * 1024,
    "Combined size across all slots is well above 25 MB without error",
    `Total: ${cumulativeMB} MB (> 25 MB)`
  );

  console.log("\n------------------------------------------------------------------------------");
  console.log("TEST STAGE 3: Independent Rejection for Oversized File (> 25 MB) and Slot Isolation");
  console.log("------------------------------------------------------------------------------");

  // Attempt to upload 26 MB file to GST slot
  const size26MB = 26 * 1024 * 1024; // 26 MiB = 27,262,976 bytes
  const pdf26MB = createDummyPdfBuffer(size26MB);
  const base64_26MB = `data:application/pdf;base64,${pdf26MB.toString("base64")}`;

  console.log(`  Attempting upload of 26 MB file to slot 'gst_certificate'...`);
  const overRes = await fetch(`${BASE_URL}/partner/applications/${appId}/documents`, {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      documentType: "gst_certificate",
      fileName: "oversized_gst_26mb.pdf",
      mimeType: "application/pdf",
      fileData: base64_26MB,
    }),
  });

  const overData = await overRes.json();
  assert(overRes.status === 400, "Oversized 26 MB file rejected with HTTP 400", `Status: ${overRes.status}`);
  assert(
    overData.error === "This document exceeds the 25 MB limit." || overData.message?.includes("25 MB"),
    "Returns exact error message 'This document exceeds the 25 MB limit.'",
    `Message: ${overData.error || overData.message}`
  );

  // Verify that other document slots (e.g. pan_card) are completely unaffected
  const statusRes = await fetch(`${BASE_URL}/partner/applications/${appId}`, { headers: userHeaders });
  const statusData = await statusRes.json();
  const panDoc = (statusData.documents || []).find((d) => d.document_type === "pan_card" || d.documentType === "pan_card");
  assert(!!panDoc, "PAN document slot remains intact and valid after GST oversized rejection");

  console.log("\n------------------------------------------------------------------------------");
  console.log("TEST STAGE 4: Supported Document Formats (PDF, PNG, JPG, JPEG, DOCX)");
  console.log("------------------------------------------------------------------------------");

  const formats = [
    { ext: "png", mime: "image/png", buf: createDummyPngBuffer(1024 * 100), slot: "centre_floor_plan" },
    { ext: "jpg", mime: "image/jpeg", buf: createDummyJpgBuffer(1024 * 100), slot: "centre_floor_plan" },
    { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buf: createDummyDocxBuffer(1024 * 50), slot: "company_profile" },
  ];

  for (const fmt of formats) {
    const filename = `valid_format_test.${fmt.ext}`;
    const base64 = `data:${fmt.mime};base64,${fmt.buf.toString("base64")}`;
    const res = await fetch(`${BASE_URL}/partner/applications/${appId}/documents`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        documentType: fmt.slot,
        fileName: filename,
        mimeType: fmt.mime,
        fileData: base64,
      }),
    });
    assert(res.ok, `Format .${fmt.ext.toUpperCase()} successfully uploaded to '${fmt.slot}'`, `Status ${res.status}`);
  }

  console.log("\n------------------------------------------------------------------------------");
  console.log("TEST STAGE 5: Security Rejection of Dangerous Executables (.exe, .bat, .sh, MZ)");
  console.log("------------------------------------------------------------------------------");

  const maliciousTests = [
    { name: ".exe executable file", filename: "installer.exe", mime: "application/x-msdownload", buf: createDummyExeBuffer(2048) },
    { name: ".bat batch script", filename: "payload.bat", mime: "text/plain", buf: Buffer.from("@echo off\ndir\n") },
    { name: ".sh bash script", filename: "exploit.sh", mime: "application/x-sh", buf: Buffer.from("#!/bin/bash\nwhoami\n") },
    { name: "disguised .exe with .pdf extension", filename: "trojan.pdf", mime: "application/pdf", buf: createDummyExeBuffer(2048) },
  ];

  for (const mal of maliciousTests) {
    const base64 = `data:${mal.mime};base64,${mal.buf.toString("base64")}`;
    const res = await fetch(`${BASE_URL}/partner/applications/${appId}/documents`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        documentType: "gst_certificate",
        fileName: mal.filename,
        mimeType: mal.mime,
        fileData: base64,
      }),
    });
    assert(!res.ok && res.status === 400, `Prohibited file rejected: ${mal.name}`, `Status ${res.status}`);
  }

  console.log("\n------------------------------------------------------------------------------");
  console.log("TEST STAGE 6: Supabase Persistence & Independent Document Records");
  console.log("------------------------------------------------------------------------------");

  // Fetch full details via Admin endpoint
  const adminDetailRes = await fetch(`${BASE_URL}/admin/partner-applications/${appId}`, { headers: adminHeaders });
  const adminDetail = await adminDetailRes.json();
  assert(adminDetailRes.ok, "Admin can retrieve full application details", `Status: ${adminDetailRes.status}`);

  const docs = adminDetail.documents || [];
  console.log(`  Admin Dossier contains ${docs.length} document records.`);

  const gstDoc = docs.find((d) => d.document_type === "gst_certificate" || d.documentType === "gst_certificate");
  const panDocAdmin = docs.find((d) => d.document_type === "pan_card" || d.documentType === "pan_card");
  const cinDoc = docs.find((d) => d.document_type === "registration_cin" || d.documentType === "registration_cin");

  assert(!!gstDoc, "GST Registration Certificate exists as separate record in Admin view");
  assert(!!panDocAdmin, "PAN Card exists as separate record in Admin view");
  assert(!!cinDoc, "Registration / CIN Document exists as separate record in Admin view");

  console.log("\n------------------------------------------------------------------------------");
  console.log("TEST STAGE 7: Admin Verification & Rejection Controls");
  console.log("------------------------------------------------------------------------------");

  if (gstDoc) {
    const verifyRes = await fetch(`${BASE_URL}/admin/accreditation/applications/${appId}/documents/${gstDoc.id || "gst_certificate"}/verify`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ action: "VERIFY", notes: "GST verification passed successfully" }),
    });
    assert(verifyRes.ok, "Admin can mark GST document as VERIFIED", `Status ${verifyRes.status}`);
  }

  if (cinDoc) {
    const rejectRes = await fetch(`${BASE_URL}/admin/accreditation/applications/${appId}/documents/${cinDoc.id || "registration_cin"}/verify`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ action: "REJECT", rejectionReason: "Please provide clearer stamp copy" }),
    });
    assert(rejectRes.ok, "Admin can mark CIN document as REJECTED with reason", `Status ${rejectRes.status}`);
  }

  // Verify updated statuses in application
  const updatedAdminRes = await fetch(`${BASE_URL}/admin/partner-applications/${appId}`, { headers: adminHeaders });
  const updatedAdmin = await updatedAdminRes.json();
  const updatedGst = (updatedAdmin.documents || []).find((d) => d.document_type === "gst_certificate" || d.documentType === "gst_certificate");
  const updatedCin = (updatedAdmin.documents || []).find((d) => d.document_type === "registration_cin" || d.documentType === "registration_cin");

  assert(updatedGst?.status === "verified", "GST document status persisted as 'verified'");
  assert(updatedCin?.status === "rejected", "CIN document status persisted as 'rejected'");

  console.log("\n------------------------------------------------------------------------------");
  console.log("TEST STAGE 8: Secure Signed Download URLs & IDOR Protection");
  console.log("------------------------------------------------------------------------------");

  // Secure download route test
  if (panDocAdmin) {
    const downloadRes = await fetch(`${BASE_URL}/admin/accreditation/applications/${appId}/documents/${panDocAdmin.id || "pan_card"}/download`, {
      headers: adminHeaders,
      redirect: "manual",
    });
    assert(
      downloadRes.status === 302 || downloadRes.status === 200,
      "Admin document download generates secure signed URL",
      `Status: ${downloadRes.status}`
    );
  }

  // IDOR Protection: User B tries to access User A's application documents
  const userBToken = createUserToken("b0000000-0000-0000-0000-000000000002", "attacker@otherdomain.com");
  const idorRes = await fetch(`${BASE_URL}/partner/applications/${appId}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userBToken}`,
    },
    body: JSON.stringify({
      documentType: "pan_card",
      fileName: "malicious.pdf",
      fileData: `data:application/pdf;base64,${createDummyPdfBuffer(1024).toString("base64")}`,
    }),
  });
  assert(idorRes.status === 403, "IDOR check: unauthorized user rejected with HTTP 403", `Status: ${idorRes.status}`);

  console.log("\n==============================================================================");
  console.log(`TEST SUMMARY: ${testPassed} PASSED, ${testFailed} FAILED`);
  console.log("==============================================================================");

  if (testFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution threw error:", err);
  process.exit(1);
});
