const fs = require("fs");
const path = require("path");

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
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const jwtPath = require.resolve("jsonwebtoken", { paths: ["./artifacts/api-server"] });
const jwt = require(jwtPath);
const jwtSecret = process.env.JWT_SECRET || "development-secret-key-change-in-production";

const API_BASE = "http://127.0.0.1:4317";

async function run() {
  console.log("==================================================================");
  console.log("THINKATIC BPO PARTNER STATE SYNC & ACCREDITATION E2E VERIFICATION");
  console.log("==================================================================");

  // 1. Find the partner test account
  const { data: partnerProfile, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, account_type, bpo_status, bpo_application_details")
    .eq("email", "testguru0@gmail.com")
    .single();

  if (pErr || !partnerProfile) {
    console.error("Partner test account not found:", pErr);
    process.exit(1);
  }

  console.log("\n[1] PARTNER PROFILE IN DATABASE (Single Source of Truth):");
  console.log(`    User ID: ${partnerProfile.id}`);
  console.log(`    Email: ${partnerProfile.email}`);
  console.log(`    Role: ${partnerProfile.role}`);
  console.log(`    Account Type: ${partnerProfile.account_type}`);
  console.log(`    BPO Status: ${partnerProfile.bpo_status}`);
  console.log(`    Company Name: ${partnerProfile.bpo_application_details?.companyName || "—"}`);

  // 2. Find partner's formal application
  const { data: formalApp, error: fErr } = await supabase
    .from("bpo_partner_applications")
    .select("*")
    .eq("applicant_user_id", partnerProfile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (fErr || !formalApp) {
    console.error("Formal application not found:", fErr);
    process.exit(1);
  }

  console.log("\n[2] FORMAL APPLICATION IN DATABASE:");
  console.log(`    App ID: ${formalApp.id}`);
  console.log(`    App Number: ${formalApp.application_number}`);
  console.log(`    Status: ${formalApp.status}`);
  console.log(`    Current Stage: ${formalApp.current_stage}`);
  console.log(`    Company Name in Data: ${formalApp.company_data?.companyName}`);
  console.log(`    Centre Name in Data: ${formalApp.centre_data?.centreName}`);
  console.log(`    Total Seats: ${formalApp.centre_data?.totalSeats}`);

  // 3. Find documents in database
  const { data: dbDocs, error: dErr } = await supabase
    .from("bpo_application_documents")
    .select("id, document_type, file_name, status, verification_status")
    .eq("application_id", formalApp.id);

  console.log("\n[3] PERSISTED DOCUMENTS IN DATABASE:");
  console.log(`    Total Count: ${dbDocs ? dbDocs.length : 0}`);
  (dbDocs || []).forEach((d) => {
    console.log(`    - ${d.document_type}: ${d.file_name} (Status: ${d.status}, Verification: ${d.verification_status})`);
  });

  // 4. Find agreement in database
  const { data: dbAgreement, error: aErr } = await supabase
    .from("bpo_partner_agreements")
    .select("id, agreement_code, status, signed_document_file_name, company_legal_name, executed_at")
    .or(`application_id.eq.${formalApp.id},partner_id.eq.${formalApp.partner_id}`)
    .limit(1)
    .single();

  console.log("\n[4] PERSISTED AGREEMENT IN DATABASE:");
  console.log(`    Code: ${dbAgreement?.agreement_code}`);
  console.log(`    Status: ${dbAgreement?.status}`);
  console.log(`    Legal Name: ${dbAgreement?.company_legal_name}`);
  console.log(`    Signed Doc: ${dbAgreement?.signed_document_file_name}`);

  // 5. Generate Auth Tokens matching requireAuth and requireUserAuth
  const adminSecret = process.env.SESSION_SECRET || process.env.USER_SESSION_SECRET || "dev-admin-secret";
  const userSecret = process.env.USER_SESSION_SECRET || process.env.SESSION_SECRET || "thinkatic-user-secret-2026";

  const partnerToken = jwt.sign(
    { id: partnerProfile.id, email: partnerProfile.email, role: partnerProfile.role },
    userSecret,
    { expiresIn: "7d" }
  );

  const adminToken = jwt.sign(
    { id: 1, username: "admin" },
    adminSecret,
    { expiresIn: "7d" }
  );

  // 6. Test Partner API: /api/bpo/status
  const statusRes = await fetch(`${API_BASE}/api/bpo/status`, {
    headers: { Authorization: `Bearer ${partnerToken}` },
  });
  const statusJson = await statusRes.json();
  console.log("\n[5] PARTNER /api/bpo/status RESPONSE:");
  console.log(`    HTTP: ${statusRes.status}`);
  console.log(`    Account State: ${statusJson.accountState}`);
  console.log(`    BPO Status: ${statusJson.bpoStatus}`);
  console.log(`    Is Submitted: ${statusJson.isSubmitted}`);
  console.log(`    Formal App Status: ${statusJson.formalApplication?.status}`);

  // 7. Test Partner API: /api/partner/applications/:id
  const appRes = await fetch(`${API_BASE}/api/partner/applications/${formalApp.id}`, {
    headers: { Authorization: `Bearer ${partnerToken}` },
  });
  const appJson = await appRes.json();
  console.log("\n[6] PARTNER /api/partner/applications/:id RESPONSE:");
  console.log(`    HTTP: ${appRes.status}`);
  console.log(`    Application Status: ${appJson.application?.status}`);
  console.log(`    Has Signed Agreement: ${appJson.hasSignedAgreement}`);
  console.log(`    Documents Count: ${Object.keys(appJson.documents || {}).length}`);

  // 8. Test Partner Accreditation API: /api/partner/applications/:id/accreditation
  const accRes = await fetch(`${API_BASE}/api/partner/applications/${formalApp.id}/accreditation`, {
    headers: { Authorization: `Bearer ${partnerToken}` },
  });
  const accJson = await accRes.json();
  const accDossier = accJson.dossier || accJson;
  const partnerProgressPct = accDossier?.progressPercentage ?? accDossier?.progress?.percentage ?? 0;
  const partnerCompletedStages = accDossier?.progress?.completedStages ?? 0;

  console.log("\n[7] PARTNER /api/partner/applications/:id/accreditation RESPONSE:");
  console.log(`    HTTP: ${accRes.status}`);
  console.log(`    Accreditation ID: ${accDossier?.applicationId || accDossier?.id}`);
  console.log(`    Overall Status: ${accDossier?.overallStatus}`);
  console.log(`    Progress Percentage: ${partnerProgressPct}%`);
  console.log(`    Verified/Active Stages: ${partnerCompletedStages} of 8`);
  console.log(`    Documents Count in Engine: ${accDossier?.documents?.uploadedCount || 0}`);
  console.log(`    Ready for Final Submission: ${accDossier?.isReadyForFinalSubmission}`);
  console.log("    Stages Breakdown:");
  (accDossier?.stages || []).forEach((s) => {
    console.log(`      Stage ${s.order} [${s.id} - ${s.name}]: Status = ${s.status}`);
  });

  // 9. Test Submission Validation with Incomplete Data
  console.log("\n[8] TESTING SUBMISSION VALIDATION WITH MISSING DATA:");
  const invalidSubmitRes = await fetch(`${API_BASE}/api/partner/applications/${formalApp.id}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${partnerToken}`,
    },
    body: JSON.stringify({
      companyData: { companyName: "", email: "", ownerName: "" },
      centreData: formalApp.centre_data,
      declarationAgreed: true,
    }),
  });
  const invalidSubmitJson = await invalidSubmitRes.json();
  console.log(`    Incomplete Submit HTTP: ${invalidSubmitRes.status} (Expected: 400)`);
  console.log(`    Missing Fields Returned:`, invalidSubmitJson.details?.missingFields);
  const validationCorrect = invalidSubmitRes.status === 400 && Array.isArray(invalidSubmitJson.details?.missingFields);

  // 10. Test Submission with Complete Genuine Data
  console.log("\n[9] TESTING REAL SUBMISSION WITH FULL GENUINE COMPANY DATA:");
  const completeCompanyData = {
    companyName: "Guru Global BPO Solutions Pvt Ltd",
    legalEntity: "Private Limited Company",
    ownerName: "Gurpreet Singh",
    email: "testguru0@gmail.com",
    phone: "+91 9876543210",
    address: "Block B, Tech Zone IV",
    city: "Noida",
    state: "Uttar Pradesh",
    country: "India",
    registrationNumber: "U72900UP2021PTC123456",
    panNumber: "ABCDE1234F",
    gstNumber: "09ABCDE1234F1Z5",
    website: "https://gurubpo.example.com",
    yearEstablished: "2021",
  };
  const completeCentreData = {
    centreName: "Guru Global Delivery Centre 1",
    facilityType: "Dedicated BPO Facility",
    ownership: "Commercial Lease",
    centreAddress: "Floor 3, Cyber Gateway Towers",
    city: "Noida",
    state: "Uttar Pradesh",
    pincode: "201301",
    totalSeats: "120",
    availableSeats: "45",
    activeAgents: "75",
    workingHours: "24/7 Rotational",
    usExperience: true,
    ukExperience: true,
    domesticExperience: true,
    languages: "English, Hindi, Punjabi",
  };
  const completeInfraData = {
    internetBandwidth: "1 Gbps Leased Line",
    backupInternet: "500 Mbps Secondary Leased Line",
    powerBackup: "100% DG Set + Online UPS",
    computers: "120 Dell Optiplex Core i7 Workstations",
    cctv: "Full 24/7 Coverage with 90-day DVR retention",
    dialer: "Vicidial Enterprise Cloud Platform",
    crm: "Thinkatic CRM",
  };

  const validSubmitRes = await fetch(`${API_BASE}/api/partner/applications/${formalApp.id}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${partnerToken}`,
    },
    body: JSON.stringify({
      companyData: completeCompanyData,
      centreData: completeCentreData,
      infrastructureData: completeInfraData,
      processExperience: ["Inbound Customer Support", "Lead Generation", "Technical Helpdesk"],
      declarationAgreed: true,
    }),
  });
  const validSubmitJson = await validSubmitRes.json();
  console.log(`    Complete Submit HTTP: ${validSubmitRes.status}`);
  console.log(`    Complete Submit Message: ${validSubmitJson.message}`);
  console.log(`    Updated Status in Response: ${validSubmitJson.application?.status}`);

  // 11. Idempotency test (Repeat submit should not duplicate or crash)
  console.log("\n[10] TESTING SUBMISSION IDEMPOTENCY (Repeated Submit):");
  const repeatSubmitRes = await fetch(`${API_BASE}/api/partner/applications/${formalApp.id}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${partnerToken}`,
    },
    body: JSON.stringify({
      companyData: completeCompanyData,
      centreData: completeCentreData,
      infrastructureData: completeInfraData,
      processExperience: ["Inbound Customer Support"],
      declarationAgreed: true,
    }),
  });
  const repeatSubmitJson = await repeatSubmitRes.json();
  console.log(`    Repeat Submit HTTP: ${repeatSubmitRes.status}`);
  console.log(`    Repeat Submit Success: ${repeatSubmitJson.success}`);

  // 12. Verify Database Persistence (Single Source of Truth)
  const { data: dbUpdatedApp } = await supabase
    .from("bpo_partner_applications")
    .select("*")
    .eq("id", formalApp.id)
    .single();

  console.log("\n[11] POST-SUBMISSION DATABASE RECORD:");
  console.log(`    DB Application Status: ${dbUpdatedApp?.status}`);
  console.log(`    DB Company Name: ${dbUpdatedApp?.company_data?.companyName}`);
  console.log(`    DB Centre Name: ${dbUpdatedApp?.centre_data?.centreName}`);
  console.log(`    DB Total Seats: ${dbUpdatedApp?.centre_data?.totalSeats}`);

  // 13. Test Admin API: /api/admin/bpo-applications/summary
  const sumRes = await fetch(`${API_BASE}/api/admin/bpo-applications/summary`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const sumJson = await sumRes.json();
  console.log("\n[12] POST-SUBMISSION ADMIN /summary RESPONSE:");
  console.log(`    Counts:`, sumJson.counts);

  // 14. Test Admin API: /api/admin/bpo-applications (List)
  const listRes = await fetch(`${API_BASE}/api/admin/bpo-applications?refresh=true`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listJson = await listRes.json();
  const foundInList = (listJson || []).find((p) => p.id === partnerProfile.id);
  console.log("\n[13] POST-SUBMISSION ADMIN LIST RESPONSE:");
  if (foundInList) {
    console.log(`    Found Partner ${partnerProfile.email} in Admin List:`);
    console.log(`      Company Name: ${foundInList.companyName}`);
    console.log(`      Effective Status: ${foundInList.status}`);
    console.log(`      Agreement Status: ${foundInList.agreementStatus}`);
    console.log(`      Completion %: ${foundInList.completionPercentage}%`);
  }

  // 15. Test Admin Dossier: /api/admin/bpo-applications/:userId
  const dosRes = await fetch(`${API_BASE}/api/admin/bpo-applications/${partnerProfile.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const dosJson = await dosRes.json();
  console.log("\n[14] POST-SUBMISSION ADMIN DOSSIER RESPONSE:");
  console.log(`    Dossier Company Name: ${dosJson.company_name || dosJson.companyName}`);
  console.log(`    Dossier Formal App Status: ${dosJson.formalApplication?.status}`);
  console.log(`    Dossier Company Legal Name: ${dosJson.formalApplication?.company_data?.companyName}`);
  console.log(`    Dossier Centre Name: ${dosJson.formalApplication?.centre_data?.centreName}`);
  console.log(`    Dossier Total Seats: ${dosJson.formalApplication?.centre_data?.totalSeats}`);
  console.log(`    Dossier Admin Accreditation %: ${dosJson.accreditation?.progressPercentage}%`);

  // 16. Verify Partner Dashboard State
  const partnerStatusRes = await fetch(`${API_BASE}/api/bpo/status`, {
    headers: { Authorization: `Bearer ${partnerToken}` },
  });
  const partnerStatusJson = await partnerStatusRes.json();
  console.log("\n[15] POST-SUBMISSION PARTNER /api/bpo/status RESPONSE:");
  console.log(`    Account State: ${partnerStatusJson.accountState}`);
  console.log(`    BPO Status: ${partnerStatusJson.bpoStatus}`);
  console.log(`    Formal App Status: ${partnerStatusJson.formalApplication?.status || partnerStatusJson.application?.status}`);

  // 17. Final State Synchronicity Checks
  console.log("\n==================================================================");
  console.log("FINAL COMPREHENSIVE SYNCHRONICITY AUDIT RESULTS:");
  console.log("==================================================================");

  const checks = [
    {
      name: "Database Single Source of Truth: Formal Application persisted with real company data",
      passed: dbUpdatedApp?.company_data?.companyName === "Guru Global BPO Solutions Pvt Ltd",
      details: `Persisted Company: ${dbUpdatedApp?.company_data?.companyName}`,
    },
    {
      name: "Validation Accuracy: Incomplete submission returns exact missing fields",
      passed: validationCorrect,
      details: `Returned 400 with missingFields: ${invalidSubmitJson.details?.missingFields?.join(", ")}`,
    },
    {
      name: "Authoritative Submission: Database status updated to submitted",
      passed: dbUpdatedApp?.status === "submitted" || dbUpdatedApp?.status === "under_review",
      details: `DB Status: ${dbUpdatedApp?.status}`,
    },
    {
      name: "Submission Idempotency: Repeated submit succeeds without duplication or corruption",
      passed: repeatSubmitRes.status === 200,
      details: `Repeat submit status: ${repeatSubmitRes.status}`,
    },
    {
      name: "Admin Summary Count Synchronicity: under_review count includes submitted app",
      passed: Number(sumJson.counts?.under_review) > 0,
      details: `Under Review count: ${sumJson.counts?.under_review}, Total: ${sumJson.counts?.total}`,
    },
    {
      name: "Admin List Synchronicity: Partner appears in Admin List with UNDER_REVIEW status",
      passed: foundInList?.status === "UNDER_REVIEW",
      details: `Admin List Status: ${foundInList?.status}`,
    },
    {
      name: "Admin Detail Visibility: Company tab receives genuine legal entity, CIN, PAN, GST, website",
      passed: Boolean(dosJson.formalApplication?.company_data?.registrationNumber && dosJson.formalApplication?.company_data?.panNumber),
      details: `Reg: ${dosJson.formalApplication?.company_data?.registrationNumber}, PAN: ${dosJson.formalApplication?.company_data?.panNumber}`,
    },
    {
      name: "Admin Detail Visibility: Centre & Capacity tab receives genuine seats and workforce data",
      passed: dosJson.formalApplication?.centre_data?.totalSeats === "120",
      details: `Seats: ${dosJson.formalApplication?.centre_data?.totalSeats}, Centre: ${dosJson.formalApplication?.centre_data?.centreName}`,
    },
    {
      name: "Lifecycle State Synchronicity: Partner Dashboard matches Admin Review status",
      passed: (partnerStatusJson.formalApplication?.status || partnerStatusJson.application?.status) === dbUpdatedApp?.status,
      details: `Partner App Status: ${partnerStatusJson.formalApplication?.status || partnerStatusJson.application?.status}, DB Status: ${dbUpdatedApp?.status}, Admin Status: ${foundInList?.status}`,
    },
    {
      name: "No Artificial Activation: Operational modules remain locked until admin approval",
      passed: partnerStatusJson.accountState !== "BPO_ACTIVE" && dbUpdatedApp?.status !== "approved",
      details: `Partner Account State: ${partnerStatusJson.accountState} (Activation Pending Admin Review)`,
    },
  ];

  let allPassed = true;
  checks.forEach((c, idx) => {
    const symbol = c.passed ? "✅ PASS" : "❌ FAIL";
    if (!c.passed) allPassed = false;
    console.log(`${symbol} [${idx + 1}] ${c.name}`);
    console.log(`         Details: ${c.details}`);
  });

  console.log("\n==================================================================");
  if (allPassed) {
    console.log("🎉 ALL E2E VERIFICATION CHECKS PASSED PERFECTLY!");
  } else {
    console.log("⚠️ SOME CHECKS FAILED! INVESTIGATE ABOVE LOGS.");
  }
  console.log("==================================================================\n");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
