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
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

const API_BASE = "http://localhost:4317";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://kajeoxbyyokauddoiumf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log("=================================================================");
console.log("  THINKATIC BPO PLATFORM - AGENT CENTRE ASSIGNMENT TEST SUITE");
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
    const token = loginData.token;
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // 2. Fetch Partner Delivery Centres
    console.log("\n--- TEST 2: Fetch Authoritative Delivery Centres ---");
    const centresRes = await fetch(`${API_BASE}/api/bpo/centres`, {
      headers: authHeaders,
    });
    const centres = await centresRes.json();
    assert(centresRes.status === 200, `GET /api/bpo/centres returned 200`);
    assert(Array.isArray(centres) && centres.length > 0, `Returned ${centres.length} authorized centre(s)`);
    console.log("  Authoritative Centres:", JSON.stringify(centres, null, 2));

    const authorizedCentre = centres[0];
    assert(authorizedCentre && authorizedCentre.id, `Authorized centre has ID: ${authorizedCentre?.id}`);
    assert(authorizedCentre && authorizedCentre.name, `Authorized centre has Name: ${authorizedCentre?.name}`);
    assert(authorizedCentre && authorizedCentre.centre_id, `Authorized centre has Canonical Centre ID: ${authorizedCentre?.centre_id}`);

    // Also check /api/partner/centres
    const partnerCentresRes = await fetch(`${API_BASE}/api/partner/centres`, {
      headers: authHeaders,
    });
    const partnerCentres = await partnerCentresRes.json();
    assert(partnerCentresRes.status === 200, `GET /api/partner/centres returned 200`);
    assert(Array.isArray(partnerCentres) && partnerCentres.length > 0, `Returned ${partnerCentres.length} centre(s) from partner endpoint`);

    // 3. Security / Anti-IDOR Test: Attempt to assign agent to foreign/unauthorized centre
    console.log("\n--- TEST 3: Anti-IDOR & Cross-Tenant Security Verification ---");
    const unauthorizedPayload = {
      firstName: "TestSecurity",
      lastName: "Agent",
      employeeId: `SEC-${Date.now().toString().slice(-4)}`,
      designation: "Security Tester",
      department: "Risk Management",
      employmentType: "Full-Time",
      supervisor: "Security Lead",
      centreId: 999999, // Unauthorized foreign centre ID
      processType: "Inbound Voice",
      shiftPreference: "US Day (EST)",
      timezone: "America/New_York (EST)",
      isDraft: false,
      documents: [
        { document_type: "id_proof", document_name: "test_id.pdf", file_url: "https://example.com/id.pdf" },
        { document_type: "nda", document_name: "test_nda.pdf", file_url: "https://example.com/nda.pdf" },
      ],
    };

    const idorRes = await fetch(`${API_BASE}/api/bpo/agents`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(unauthorizedPayload),
    });
    const idorBody = await idorRes.json();
    assert(
      idorRes.status === 403,
      `Cross-tenant/unauthorized centre assignment rejected with 403 Forbidden (got ${idorRes.status}: ${idorBody.error})`
    );

    // 4. Create Agent under Authorized Centre
    console.log("\n--- TEST 4: Create Operational Agent Under Authorized Centre ---");
    const empId = `EMP-${Date.now().toString().slice(-4)}`;
    const validPayload = {
      firstName: "Sarah",
      lastName: "Connor",
      email: `sarah.connor.${Date.now()}@example.com`,
      phone: "+1 555-019-2834",
      employeeId: empId,
      designation: "Customer Support Specialist",
      department: "Customer Service",
      employmentType: "Full-Time",
      supervisor: "Operations Lead NY",
      centreId: authorizedCentre.id,
      processType: "Inbound Voice",
      shiftPreference: "US Day (EST)",
      timezone: "America/New_York (EST)",
      isDraft: false,
      documents: [
        { document_type: "id_proof", document_name: "national_id.pdf", file_url: "https://example.com/id.pdf" },
        { document_type: "nda", document_name: "signed_nda.pdf", file_url: "https://example.com/nda.pdf" },
      ],
    };

    const createRes = await fetch(`${API_BASE}/api/bpo/agents`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(validPayload),
    });
    const createData = await createRes.json();
    assert(createRes.status === 201, `Agent created with status 201 (got ${createRes.status})`);
    assert(createData.agent_code, `Agent code generated: ${createData.agent_code}`);
    assert(createData.id, `Agent ID created: ${createData.id}`);
    createdAgentId = createData.id;

    assert(
      Number(createData.centre_id) === Number(authorizedCentre.id),
      `Agent centre_id matches authorized centre: ${createData.centre_id}`
    );
    assert(
      createData.centre_name === authorizedCentre.name,
      `Agent centre_name enriched correctly: "${createData.centre_name}"`
    );
    assert(
      createData.canonical_centre_id === authorizedCentre.centre_id,
      `Agent canonical_centre_id enriched correctly: "${createData.canonical_centre_id}"`
    );
    assert(
      createData.assigned_by,
      `Agent assigned_by recorded: ${createData.assigned_by}`
    );
    assert(
      createData.assigned_by_name,
      `Agent assigned_by_name recorded: "${createData.assigned_by_name}"`
    );

    // 5. Verify Supabase Database Persistence
    console.log("\n--- TEST 5: Verify Authoritative Supabase Database Persistence ---");
    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/bpo_agents?id=eq.${createdAgentId}&select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    const dbAgents = await supabaseRes.json();
    const dbAgent = Array.isArray(dbAgents) ? dbAgents[0] : null;

    assert(supabaseRes.status === 200, `Supabase query executed successfully with 200 OK`);
    assert(dbAgent !== null, `Agent record found in Supabase bpo_agents table`);
    if (dbAgent) {
      assert(
        Number(dbAgent.centre_id) === Number(authorizedCentre.id),
        `Supabase column 'centre_id' persisted: ${dbAgent.centre_id}`
      );
      assert(
        dbAgent.partner_id === "77c7a735-6d71-492a-9eeb-6853f567f432",
        `Supabase column 'partner_id' persisted: ${dbAgent.partner_id}`
      );
      assert(
        dbAgent.assigned_by || dbAgent.metadata?.assigned_by,
        `Supabase assigned_by identity persisted: ${dbAgent.assigned_by || dbAgent.metadata?.assigned_by}`
      );
      assert(
        dbAgent.metadata?.assigned_by_name,
        `Supabase metadata.assigned_by_name persisted: "${dbAgent.metadata?.assigned_by_name}"`
      );
      assert(
        dbAgent.metadata?.canonical_centre_id === authorizedCentre.centre_id,
        `Supabase metadata.canonical_centre_id persisted: "${dbAgent.metadata?.canonical_centre_id}"`
      );
    }

    // 6. Verify Agent Roster Retrieval (/api/bpo/agents)
    console.log("\n--- TEST 6: Verify Agent Directory Roster Enrichment ---");
    const rosterRes = await fetch(`${API_BASE}/api/bpo/agents`, {
      headers: authHeaders,
    });
    const rosterData = await rosterRes.json();
    assert(rosterRes.status === 200, `GET /api/bpo/agents returned 200`);
    const agentsList = Array.isArray(rosterData) ? rosterData : (rosterData.agents || []);
    const foundInRoster = agentsList.find((a) => a.id === createdAgentId);
    assert(foundInRoster !== undefined, `Created agent found in directory roster`);
    if (foundInRoster) {
      assert(
        foundInRoster.centre_name === authorizedCentre.name,
        `Roster centre_name matches: "${foundInRoster.centre_name}"`
      );
      assert(
        foundInRoster.canonical_centre_id === authorizedCentre.centre_id,
        `Roster canonical_centre_id matches: "${foundInRoster.canonical_centre_id}"`
      );
      assert(
        foundInRoster.assigned_by_name,
        `Roster assigned_by_name present: "${foundInRoster.assigned_by_name}"`
      );
    }

    // 7. Verify Agent Dossier by ID (/api/bpo/agents/:id)
    console.log("\n--- TEST 7: Verify Agent Detail Dossier Enrichment ---");
    const detailRes = await fetch(`${API_BASE}/api/bpo/agents/${createdAgentId}`, {
      headers: authHeaders,
    });
    const detailData = await detailRes.json();
    assert(detailRes.status === 200, `GET /api/bpo/agents/:id returned 200`);
    assert(
      detailData.centre_name === authorizedCentre.name,
      `Detail dossier centre_name matches: "${detailData.centre_name}"`
    );
    assert(
      detailData.canonical_centre_id === authorizedCentre.centre_id,
      `Detail dossier canonical_centre_id matches: "${detailData.canonical_centre_id}"`
    );
    assert(
      detailData.assigned_by_name,
      `Detail dossier assigned_by_name present: "${detailData.assigned_by_name}"`
    );

    // 8. Security / Anti-IDOR Test on PATCH: Attempt to reassign agent to unauthorized centre
    console.log("\n--- TEST 8: Anti-IDOR on Agent Update/Reassignment ---");
    const patchUnauthorized = await fetch(`${API_BASE}/api/bpo/agents/${createdAgentId}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        centreId: 888888,
      }),
    });
    const patchBody = await patchUnauthorized.json();
    assert(
      patchUnauthorized.status === 403,
      `Unauthorized centre reassignment blocked with 403 Forbidden (got ${patchUnauthorized.status}: ${patchBody.error})`
    );

    // 9. Cleanup
    console.log("\n--- CLEANUP ---");
    if (createdAgentId) {
      await fetch(`${SUPABASE_URL}/rest/v1/bpo_agents?id=eq.${createdAgentId}`, {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      });
      console.log(`  Cleaned up test agent #${createdAgentId} from Supabase.`);
    }

  } catch (err) {
    console.error("Test execution exception:", err);
    failed++;
  }

  console.log("\n=================================================================");
  console.log(`  FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
