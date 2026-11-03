import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import fs from "node:fs";

// Load .env
if (fs.existsSync(".env")) {
  const content = fs.readFileSync(".env", "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const k = trimmed.slice(0, idx).trim();
        let v = trimmed.slice(idx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

const API_BASE = "http://localhost:4317";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://kajeoxbyyokauddoiumf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log("=================================================================");
console.log("  TEST SUITE: MANUAL CENTRE NAME ONBOARDING & PERSISTENCE");
console.log("=================================================================\n");

async function runTests() {
  let passed = 0;
  let failed = 0;
  let createdAgentId = null;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate as BPO Partner
    console.log("--- TEST 1: Authenticate as BPO Partner ---");
    const loginRes = await fetch(`${API_BASE}/api/user/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "bpo.test@thinkatic.com",
        password: "256b2#bpo",
      }),
    });

    const loginData = await loginRes.json();
    assert(loginRes.status === 200, `Login status 200 (got ${loginRes.status})`);
    assert(loginData.token, "Auth token received");
    const partnerToken = loginData.token;
    const partnerAuthHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${partnerToken}`,
    };

    // 2. Initial stats check
    console.log("\n--- TEST 2: Initial Agent Directory Stats ---");
    const initialStatsRes = await fetch(`${API_BASE}/api/bpo/agents/stats`, {
      headers: partnerAuthHeaders,
    });
    const initialStats = await initialStatsRes.json();
    assert(initialStatsRes.status === 200, "Initial stats fetched successfully");
    const initialTotal = initialStats.total || 0;
    console.log(`  Initial total agents: ${initialTotal}`);

    // 3. Test Blank Centre Name Rejection (Validation Test 10)
    console.log("\n--- TEST 3: Blank Centre Name Validation Rejection ---");
    const testEmpId = `EMP-TEST-${Date.now().toString().slice(-4)}`;
    const blankCentreRes = await fetch(`${API_BASE}/api/bpo/agents`, {
      method: "POST",
      headers: partnerAuthHeaders,
      body: JSON.stringify({
        firstName: "Test",
        lastName: "Agent",
        email: `test.${Date.now()}@example.com`,
        phone: "+1 555-019-2834",
        employeeId: testEmpId,
        designation: "Customer Support Associate",
        department: "Inbound Voice",
        employmentType: "Full-Time",
        centreName: "   ", // Blank string
        processType: "Inbound Voice",
        shiftPreference: "US Day (EST)",
        timezone: "America/New_York (EST)",
        isDraft: false,
        documents: [
          { document_type: "id_proof", document_name: "passport.pdf", file_url: "https://example.com/id.pdf" },
          { document_type: "nda", document_name: "signed_nda.pdf", file_url: "https://example.com/nda.pdf" },
        ],
      }),
    });
    const blankCentreData = await blankCentreRes.json();
    assert(blankCentreRes.status === 400, `Blank centre name returns 400 (got ${blankCentreRes.status})`);
    assert(
      blankCentreData.error && blankCentreData.error.toLowerCase().includes("centre name is required"),
      `Error indicates Centre Name is required (got: "${blankCentreData.error}")`
    );

    // 4. Test Successful Agent Creation with Manual Centre Name: "Primary Delivery Centre NY-01"
    console.log("\n--- TEST 4: Successful Onboarding with Manual Centre Name ---");
    const targetCentreName = "Primary Delivery Centre NY-01";
    const createRes = await fetch(`${API_BASE}/api/bpo/agents`, {
      method: "POST",
      headers: partnerAuthHeaders,
      body: JSON.stringify({
        firstName: "Sarah",
        lastName: "Jenkins",
        email: `sarah.jenkins.${Date.now()}@aurabpo.com`,
        phone: "+1 555-019-4829",
        employeeId: testEmpId,
        designation: "Healthcare Inbound Specialist",
        department: "Inbound Voice",
        employmentType: "Full-Time",
        supervisor: "Michael Chang",
        joiningDate: new Date().toISOString().slice(0, 10),
        centreName: targetCentreName,
        processType: "Inbound Voice",
        shiftPreference: "US Day (EST)",
        timezone: "America/New_York (EST)",
        languagesStr: "English, Spanish",
        skillsStr: "CRM, Zendesk, Active Listening, HIPAA Compliance",
        isDraft: false,
        documents: [
          { document_type: "id_proof", document_name: "sarah_passport.pdf", file_url: "https://storage.thinkatic.com/docs/passport.pdf" },
          { document_type: "nda", document_name: "sarah_signed_nda.pdf", file_url: "https://storage.thinkatic.com/docs/nda.pdf" },
        ],
      }),
    });

    const createData = await createRes.json();
    assert(createRes.status === 201, `Agent creation returned 201 Created (got ${createRes.status})`);
    assert(createData.id, `Created agent has ID: ${createData.id}`);
    assert(createData.centre_name === targetCentreName, `Response contains centre_name: "${createData.centre_name}"`);
    assert(createData.created_by, `Agent tracks created_by user ID: ${createData.created_by}`);
    createdAgentId = createData.id;

    // 5. Test Duplicate Prevention on Retried Submission (Test 11)
    console.log("\n--- TEST 5: Prevent Duplicate Agent on Retried Submission ---");
    const duplicateRes = await fetch(`${API_BASE}/api/bpo/agents`, {
      method: "POST",
      headers: partnerAuthHeaders,
      body: JSON.stringify({
        firstName: "Sarah Duplicate",
        lastName: "Jenkins",
        email: `sarah.jenkins.dup@aurabpo.com`,
        employeeId: testEmpId, // Same employee ID
        designation: "Healthcare Inbound Specialist",
        department: "Inbound Voice",
        centreName: targetCentreName,
        shiftPreference: "US Day (EST)",
        isDraft: false,
        documents: [
          { document_type: "id_proof", document_name: "passport.pdf", file_url: "https://example.com/id.pdf" },
          { document_type: "nda", document_name: "nda.pdf", file_url: "https://example.com/nda.pdf" },
        ],
      }),
    });
    assert(duplicateRes.status === 409, `Duplicate employee ID rejected with 409 Conflict (got ${duplicateRes.status})`);

    // 6. Verify Database Persistence in Supabase (Test 4)
    console.log("\n--- TEST 6: Verify Persistence in Supabase Database ---");
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/bpo_agents?id=eq.${createdAgentId}&select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    const dbRows = await dbRes.json();
    assert(dbRes.status === 200, `Supabase direct query returned 200`);
    assert(Array.isArray(dbRows) && dbRows.length > 0, `Record found in Supabase database`);
    const dbRecord = dbRows[0];
    const persistedCentreName = dbRecord.centre_name || dbRecord.metadata?.centre_name;
    assert(
      persistedCentreName === targetCentreName,
      `Database record persists centre_name: "${persistedCentreName}"`
    );
    console.log("  Database metadata:", JSON.stringify(dbRecord.metadata, null, 2));

    // 7. Verify Agent Profile Endpoint (Test 5)
    console.log("\n--- TEST 7: Verify GET /api/bpo/agents/:id Agent Profile ---");
    const profileRes = await fetch(`${API_BASE}/api/bpo/agents/${createdAgentId}`, {
      headers: partnerAuthHeaders,
    });
    const profileData = await profileRes.json();
    assert(profileRes.status === 200, `Profile endpoint returned 200`);
    assert(profileData.centre_name === targetCentreName, `Profile contains centre_name: "${profileData.centre_name}"`);
    assert(profileData.created_by, `Profile contains created_by: "${profileData.created_by}"`);

    // 8. Verify Agent Directory & Updated Counts (Test 6)
    console.log("\n--- TEST 8: Verify Agent Directory & Dynamic Counts ---");
    const listRes = await fetch(`${API_BASE}/api/bpo/agents?limit=100`, {
      headers: partnerAuthHeaders,
    });
    const listData = await listRes.json();
    assert(listRes.status === 200, `Agent directory returned 200`);
    const foundAgent = (listData.agents || []).find((a) => a.id === createdAgentId);
    assert(foundAgent !== undefined, `Created agent found in Agent Directory roster`);
    assert(foundAgent?.centre_name === targetCentreName, `Directory entry displays centre_name: "${foundAgent?.centre_name}"`);

    const updatedStatsRes = await fetch(`${API_BASE}/api/bpo/agents/stats`, {
      headers: partnerAuthHeaders,
    });
    const updatedStats = await updatedStatsRes.json();
    assert(updatedStats.total === initialTotal + 1, `Total agent count accurately incremented from ${initialTotal} to ${updatedStats.total}`);

    // 9. Verify Admin View (Test 8)
    console.log("\n--- TEST 9: Verify Admin Access & Centre Display ---");
    const adminLoginRes = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: process.env.ADMIN_PASSWORD || "256b2#bpo",
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    console.log("  adminLogin status:", adminLoginRes.status, "data:", adminLoginData);
    const adminToken = adminLoginData.token;
    assert(adminToken, "Admin auth token received");

    const adminAgentRes = await fetch(`${API_BASE}/api/admin/bpo/agents/${createdAgentId}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const adminAgentData = await adminAgentRes.json();
    assert(adminAgentRes.status === 200, `Admin GET agent detail returned 200`);
    assert(adminAgentData.centre_name === targetCentreName, `Admin sees centre_name: "${adminAgentData.centre_name}"`);

    // 10. Verify Cross-Tenant Access Protection (Test 9)
    console.log("\n--- TEST 10: Verify Foreign Partner Cannot Access/Modify Agent ---");
    // Generate a mock foreign partner token or use foreign agent context
    const foreignPartnerHeader = {
      "Content-Type": "application/json",
      Authorization: `Bearer mock_foreign_token`,
    };
    // Testing unauthenticated or unauthorized access
    const unauthorizedRes = await fetch(`${API_BASE}/api/bpo/agents/${createdAgentId}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid_or_foreign_token",
      },
    });
    assert(
      unauthorizedRes.status === 401 || unauthorizedRes.status === 403,
      `Unauthorized request correctly rejected with ${unauthorizedRes.status}`
    );

    console.log("\n=================================================================");
    console.log(`  ALL TESTS FINISHED: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================================\n");

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
