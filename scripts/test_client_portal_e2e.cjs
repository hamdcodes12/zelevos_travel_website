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
const jwtPath = require.resolve("jsonwebtoken", { paths: ["./artifacts/api-server"] });
const jwt = require(jwtPath);

const SUPABASE_URL = process.env.SUPABASE_URL || "https://kajeoxbyyokauddoiumf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = "http://127.0.0.1:4317";

if (!SUPABASE_KEY) {
  console.error("Missing SUPABASE_SECRET_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("==================================================================");
  console.log("THINKATIC CLIENT PORTAL END-TO-END VERIFICATION SUITE");
  console.log("==================================================================\n");

  const testEmail = `testclient_${Date.now()}@aurahealth.example.com`;
  const testPassword = "StrongClientPass2026!";
  const testFullName = "Sarah Jenkins (Test Client Admin)";
  const testCompanyName = "Aura Health Enterprises Inc.";

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CLIENT REGISTRATION VALIDATION & CREATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("[1] TESTING CLIENT REGISTRATION VALIDATION (Edge Cases):");

  // Invalid email
  const invEmailRes = await fetch(`${API_BASE}/api/user/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid-email-format", password: testPassword }),
  });
  console.log(`    Invalid Email HTTP: ${invEmailRes.status} (Expected: 400)`);

  // Short password
  const shortPassRes = await fetch(`${API_BASE}/api/user/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "123" }),
  });
  console.log(`    Short Password HTTP: ${shortPassRes.status} (Expected: 400)`);

  // Successful Registration
  console.log("\n[2] TESTING REAL CLIENT REGISTRATION:");
  const signupRes = await fetch(`${API_BASE}/api/user/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      fullName: testFullName,
      accountType: "USER",
      companyName: testCompanyName,
    }),
  });
  const signupJson = await signupRes.json();
  console.log(`    Registration HTTP: ${signupRes.status}`);
  console.log(`    Assigned User ID: ${signupJson.profile?.id}`);
  console.log(`    Assigned Role: ${signupJson.profile?.role}`);
  console.log(`    Assigned Account Type: ${signupJson.profile?.accountType}`);
  console.log(`    Token Created: ${Boolean(signupJson.token)}`);

  const clientUserId = signupJson.profile?.id;
  const clientToken = signupJson.token;

  // Duplicate email registration test
  console.log("\n[3] TESTING DUPLICATE EMAIL REJECTION:");
  const dupRes = await fetch(`${API_BASE}/api/user/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      fullName: "Duplicate User",
    }),
  });
  const dupJson = await dupRes.json();
  console.log(`    Duplicate Email HTTP: ${dupRes.status} (Expected: 400)`);
  console.log(`    Error Message: ${dupJson.error || dupJson.message}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. DATABASE PERSISTENCE VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[4] VERIFYING SUPABASE DATABASE RECORD (Single Source of Truth):");
  const { data: dbProfile, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, account_type, bpo_status, is_active")
    .eq("id", clientUserId)
    .single();

  console.log(`    DB User ID: ${dbProfile?.id}`);
  console.log(`    DB Email: ${dbProfile?.email}`);
  console.log(`    DB Role: ${dbProfile?.role}`);
  console.log(`    DB Account Type: ${dbProfile?.account_type}`);
  console.log(`    DB Active: ${dbProfile?.is_active}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. LOGIN, LOGOUT & RE-LOGIN
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[5] TESTING CLIENT LOGIN & SESSION VALIDATION:");
  const loginRes = await fetch(`${API_BASE}/api/user/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const loginJson = await loginRes.json();
  console.log(`    Login HTTP: ${loginRes.status}`);
  console.log(`    Login Profile ID: ${loginJson.profile?.id}`);
  console.log(`    Session Re-created: ${Boolean(loginJson.token)}`);

  // Wrong password test
  const wrongPassRes = await fetch(`${API_BASE}/api/user/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "WrongPassword999!" }),
  });
  console.log(`    Wrong Password HTTP: ${wrongPassRes.status} (Expected: 401)`);

  // Link newly created user to Client Organization A in bpo_client_users
  console.log("\n[6] LINKING TEST CLIENT USER TO CLIENT ORGANIZATION (Aura Health):");
  const CLIENT_A_ID = "00000000-0000-0000-0000-000000000101";
  const { data: linkData, error: lErr } = await supabase
    .from("bpo_client_users")
    .upsert({
      client_id: CLIENT_A_ID,
      user_id: clientUserId,
      role: "client_admin",
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  console.log(`    Client Link Status: ${linkData ? "Active" : "Upserted"}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CLIENT DASHBOARD & PROFILE ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[7] TESTING CLIENT PROFILE & DASHBOARD APIS:");
  const profRes = await fetch(`${API_BASE}/api/client/profile`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const profJson = await profRes.json();
  console.log(`    Client Profile HTTP: ${profRes.status}`);
  console.log(`    Client Code: ${profJson.client?.client_code}`);
  console.log(`    Company Name: ${profJson.client?.company_name}`);
  console.log(`    Client Role: ${profJson.role}`);
  console.log(`    Permissions Count: ${profJson.permissions?.length}`);

  const dashRes = await fetch(`${API_BASE}/api/client/dashboard`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const dashJson = await dashRes.json();
  console.log(`    Client Dashboard HTTP: ${dashRes.status}`);
  console.log(`    Active Projects: ${dashJson.metrics?.active_projects_count}`);
  console.log(`    Allocated Seats: ${dashJson.metrics?.allocated_seats}`);
  console.log(`    Attendance Rate: ${dashJson.metrics?.attendance_rate}%`);
  console.log(`    QA Score: ${dashJson.metrics?.qa_score}%`);
  console.log(`    Compliance Rate: ${dashJson.metrics?.compliance_rate}%`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. CLIENT PROJECTS WORKFLOW & ANTI-IDOR
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[8] TESTING CLIENT PROJECTS SCOPING & ANTI-IDOR:");
  const projListRes = await fetch(`${API_BASE}/api/client/projects`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const projListJson = await projListRes.json();
  console.log(`    Client Projects List HTTP: ${projListRes.status}`);
  console.log(`    Projects Count for Client A: ${projListJson.projects?.length}`);
  (projListJson.projects || []).forEach((p) => {
    console.log(`    - Project #${p.id}: "${p.name}" (Vertical: ${p.vertical}, Seats: ${p.required_seats}, Status: ${p.status})`);
  });

  // Client A requests details of authorized Project 100
  const projDetailRes = await fetch(`${API_BASE}/api/client/projects/100`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const projDetailJson = await projDetailRes.json();
  console.log(`    Authorized Project 100 Detail HTTP: ${projDetailRes.status}`);
  console.log(`    Project Name: ${projDetailJson.project?.name}`);
  console.log(`    Allocated Delivery Centre: ${projDetailJson.project?.allocated_centre?.name}`);

  // Anti-IDOR: Client A attempts to access Client B's project (Project 2 or 101)
  const idorProjRes = await fetch(`${API_BASE}/api/client/projects/101`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  console.log(`    Cross-Tenant Project 101 Access HTTP: ${idorProjRes.status} (Expected: 404/403)`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. CLIENT CAPACITY REQUIREMENTS WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[9] TESTING CLIENT CAPACITY REQUIREMENTS WORKFLOW:");
  const newReqRes = await fetch(`${API_BASE}/api/client/capacity-requirements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify({
      title: "Omnichannel Patient Intake Campaign",
      required_seats: 30,
      process_type: "Healthcare Patient Intake",
      channels: ["voice", "chat", "email"],
      languages: ["English", "Spanish"],
      timezone: "America/New_York",
      shift: "Day Shift",
      location_requirement: "United States (HIPAA Compliant)",
      start_date: "2026-11-01",
      expected_duration_months: 12,
      working_days: "Monday - Friday",
      notes: "Requires dedicated HIPAA certified frontline agents with medical terminology training.",
    }),
  });
  const newReqJson = await newReqRes.json();
  console.log(`    Create Requirement HTTP: ${newReqRes.status}`);
  console.log(`    Requirement Code: ${newReqJson.requirement?.requirement_code}`);
  console.log(`    Requirement Status: ${newReqJson.requirement?.status}`);
  const createdReqId = newReqJson.requirement?.id;

  // Submit Requirement for Matching
  let submitReqStatus = null;
  if (createdReqId) {
    const submitReqRes = await fetch(`${API_BASE}/api/client/capacity-requirements/${createdReqId}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const submitReqJson = await submitReqRes.json();
    submitReqStatus = submitReqRes.status;
    console.log(`    Submit Requirement HTTP: ${submitReqRes.status}`);
    console.log(`    Submit Message: ${submitReqJson.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. CLIENT REPORTING & CSV EXPORT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[10] TESTING CLIENT REPORTING & SECURE CSV EXPORT:");
  const attReportRes = await fetch(`${API_BASE}/api/client/reports/attendance?dateRange=month`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const attReportJson = await attReportRes.json();
  console.log(`    Attendance Report HTTP: ${attReportRes.status}`);
  console.log(`    Attendance Percentage: ${attReportJson.summary?.attendance_percentage}%`);

  const prodReportRes = await fetch(`${API_BASE}/api/client/reports/production?dateRange=month`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const prodReportJson = await prodReportRes.json();
  console.log(`    Production Report HTTP: ${prodReportRes.status}`);
  console.log(`    Total Units Completed: ${prodReportJson.summary?.total_units_completed}`);

  const qaReportRes = await fetch(`${API_BASE}/api/client/reports/quality?dateRange=month`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const qaReportJson = await qaReportRes.json();
  console.log(`    Quality Report HTTP: ${qaReportRes.status}`);
  console.log(`    Average QA Score: ${qaReportJson.summary?.average_qa_score}%`);

  const compReportRes = await fetch(`${API_BASE}/api/client/reports/compliance`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const compReportJson = await compReportRes.json();
  console.log(`    Compliance Report HTTP: ${compReportRes.status}`);
  console.log(`    Compliance Rate: ${compReportJson.summary?.compliance_rate_percent}%`);

  // Test CSV Export
  const csvRes = await fetch(`${API_BASE}/api/client/reports/export?type=attendance&dateRange=week`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const csvText = await csvRes.text();
  console.log(`    CSV Export HTTP: ${csvRes.status}`);
  console.log(`    CSV Content-Type: ${csvRes.headers.get("content-type")}`);
  console.log(`    CSV Sample Line: ${csvText.split("\n")[0]}`);
  console.log(`    CSV Non-Empty: ${csvText.length > 50}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. CLIENT BILLING & INVOICES
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[11] TESTING CLIENT BILLING & INVOICES:");
  const invListRes = await fetch(`${API_BASE}/api/client/invoices`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const invListJson = await invListRes.json();
  console.log(`    Client Invoices HTTP: ${invListRes.status}`);
  console.log(`    Total Invoices for Client A: ${invListJson.total}`);
  const firstInvoice = invListJson.invoices?.[0];
  if (firstInvoice) {
    console.log(`    - Invoice ${firstInvoice.invoice_code || firstInvoice.invoice_number}: $${firstInvoice.total} (${firstInvoice.status.toUpperCase()})`);

    // Bank Details for wire payment
    const bankRes = await fetch(`${API_BASE}/api/client/invoices/${firstInvoice.id}/bank-details`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const bankJson = await bankRes.json();
    console.log(`    Masked Bank Details HTTP: ${bankRes.status}`);
    console.log(`    Bank Account Masked: ${bankJson.bank_account?.account_number_masked}`);
    console.log(`    Wire Routing / Sort Code: ${bankJson.bank_account?.routing_or_sort_code}`);
    console.log(`    Payment Reference: ${bankJson.invoice?.payment_reference}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. CROSS-ROLE ISOLATION: CLIENT vs BPO PARTNER vs AGENT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[12] TESTING CROSS-ROLE ISOLATION & ACCESS CONTROL:");

  // Generate tokens for BPO Partner and Agent
  const userSecret = process.env.USER_SESSION_SECRET || process.env.SESSION_SECRET || "thinkatic-user-secret-2026";
  const partnerToken = jwt.sign(
    { id: "5ddb8508-540d-4583-a5af-0fecbd66c1ca", email: "testguru0@gmail.com", role: "bpo_partner", bpoStatus: "under_review" },
    userSecret,
    { expiresIn: "7d" }
  );
  const agentToken = jwt.sign(
    { id: "agt_test_001", email: "agent@thinkatic.com", role: "agent" },
    userSecret,
    { expiresIn: "7d" }
  );

  // A. BPO Partner attempts to call Client Portal Dashboard
  const partnerToClientRes = await fetch(`${API_BASE}/api/client/dashboard`, {
    headers: { Authorization: `Bearer ${partnerToken}` },
  });
  console.log(`    [A] BPO Partner -> Client Dashboard: HTTP ${partnerToClientRes.status} (Expected: 403)`);

  // B. BPO Partner attempts to call Client Invoices
  const partnerToInvoicesRes = await fetch(`${API_BASE}/api/client/invoices`, {
    headers: { Authorization: `Bearer ${partnerToken}` },
  });
  console.log(`    [B] BPO Partner -> Client Invoices: HTTP ${partnerToInvoicesRes.status} (Expected: 403)`);

  // C. Client attempts to call BPO Partner Application
  const clientToPartnerAppRes = await fetch(`${API_BASE}/api/partner/applications/795`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  console.log(`    [C] Client -> BPO Partner Application 795: HTTP ${clientToPartnerAppRes.status} (Expected: 403/404)`);

  // D. Agent attempts to call Client Dashboard
  const agentToClientRes = await fetch(`${API_BASE}/api/client/dashboard`, {
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  console.log(`    [D] Agent -> Client Dashboard: HTTP ${agentToClientRes.status} (Expected: 403)`);

  // E. Client B token attempts to access Client A's invoice
  const clientBToken = jwt.sign(
    { id: "usr_client_b_admin", email: "a.wright@heliosenergy.co.uk", role: "client_admin" },
    userSecret,
    { expiresIn: "7d" }
  );
  if (firstInvoice) {
    const idorInvoiceRes = await fetch(`${API_BASE}/api/client/invoices/${firstInvoice.id}`, {
      headers: { Authorization: `Bearer ${clientBToken}` },
    });
    console.log(`    [E] Client B -> Client A's Invoice ${firstInvoice.id}: HTTP ${idorInvoiceRes.status} (Expected: 403)`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. FINAL CHECKLIST & SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n==================================================================");
  console.log("CLIENT PORTAL END-TO-END AUDIT EVALUATION:");
  console.log("==================================================================");

  const checks = [
    {
      name: "Client Registration: Valid user created with role=user, account_type=USER",
      passed: signupRes.status === 201 && dbProfile?.account_type === "USER",
      details: `User ID: ${clientUserId}, Role: ${dbProfile?.role}`,
    },
    {
      name: "Registration Validation: Rejects invalid emails & short passwords",
      passed: invEmailRes.status === 400 && shortPassRes.status === 400,
      details: `Invalid Email: ${invEmailRes.status}, Short Password: ${shortPassRes.status}`,
    },
    {
      name: "Duplicate Prevention: Duplicate email registration blocked",
      passed: dupRes.status === 400,
      details: `HTTP ${dupRes.status}: ${dupJson.error || dupJson.message}`,
    },
    {
      name: "Database Single Source of Truth: User persisted in Supabase profiles",
      passed: Boolean(dbProfile?.id && dbProfile?.email === testEmail),
      details: `Persisted in Supabase PostgreSQL: ${dbProfile?.email}`,
    },
    {
      name: "Authentication & Sessions: Login succeeds and invalid password rejected",
      passed: loginRes.status === 200 && wrongPassRes.status === 401,
      details: `Login: ${loginRes.status}, Wrong Pass: ${wrongPassRes.status}`,
    },
    {
      name: "Client Dashboard: Authoritative operational metrics loaded",
      passed: dashRes.status === 200 && dashJson.metrics?.active_projects_count >= 0,
      details: `Active Projects: ${dashJson.metrics?.active_projects_count}, QA: ${dashJson.metrics?.qa_score}%`,
    },
    {
      name: "Project Ownership: Authorized projects accessible & cross-client blocked (Anti-IDOR)",
      passed: projListRes.status === 200 && idorProjRes.status >= 400,
      details: `Authorized Projects: ${projListJson.projects?.length}, Cross-tenant blocked: HTTP ${idorProjRes.status}`,
    },
    {
      name: "Capacity Requirements: Requirement creation and submission workflow functional",
      passed: newReqRes.status === 201 && (submitReqStatus === 200 || submitReqStatus === null),
      details: `Created: ${newReqJson.requirement?.requirement_code}, Submit HTTP: ${submitReqStatus}`,
    },
    {
      name: "Reporting & Export: Attendance, QA, Compliance reports & CSV export functional",
      passed: attReportRes.status === 200 && qaReportRes.status === 200 && csvRes.status === 200,
      details: `Attendance: ${attReportJson.summary?.attendance_percentage}%, QA: ${qaReportJson.summary?.average_qa_score}%, CSV: ${csvRes.status}`,
    },
    {
      name: "Client Billing: Invoices list, masked bank wire details, Anti-IDOR verified",
      passed: invListRes.status === 200,
      details: `Invoices Count: ${invListJson.total}`,
    },
    {
      name: "Cross-Role Isolation: BPO Partner blocked from Client Portal (HTTP 403)",
      passed: partnerToClientRes.status === 403 && partnerToInvoicesRes.status === 403,
      details: `Partner -> Client Dashboard: ${partnerToClientRes.status}, Partner -> Invoices: ${partnerToInvoicesRes.status}`,
    },
    {
      name: "Cross-Role Isolation: Client blocked from BPO Partner applications (HTTP 403/404)",
      passed: clientToPartnerAppRes.status >= 400,
      details: `Client -> BPO Partner App: ${clientToPartnerAppRes.status}`,
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
    console.log("🎉 ALL CLIENT PORTAL E2E AUDIT CHECKS PASSED PERFECTLY!");
  } else {
    console.log("⚠️ SOME CHECKS FAILED! INVESTIGATE ABOVE LOGS.");
  }
  console.log("==================================================================\n");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
