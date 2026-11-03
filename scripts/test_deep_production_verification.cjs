// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM
// Deep Production Verification Test Suite:
// 1. Admin Login & Session Validation
// 2. Admin Leads Analytics KPIs & Date Filters (today, 7d, 30d, 90d, custom ISO, custom DD/MM/YYYY)
// 3. Accreditation Summary & Dynamic Stage Counts
// 4. Document Download Authentication Protection & Authorized Signed Access
// 5. BPO Application Dossier Data Connection & Sanitization (No "None", No "+1 800")
// 6. Pre-Approval Server-Side Validation
// 7. Suspension / Hold Flow with Reason, Audit Log & Dedicated Under Review Status
// 8. Restore Access Flow with Audit Log & Operational Re-activation
// ==============================================================================

const path = require('path');
const fs = require('fs');
const jwt = require(path.resolve(__dirname, '../artifacts/api-server/node_modules/jsonwebtoken'));

const BASE_URL = 'http://localhost:4317';
let adminToken = '';
const testPartnerId = '929290f3-98a6-4edb-ac69-43db5d504faa'; // Guru
const partnerToken = jwt.sign(
  { id: testPartnerId, email: 'testguru@gmail.com', role: 'BPO' },
  'thinkatic-user-secret-2026',
  { expiresIn: '2h' }
);

async function runTests() {
  console.log('==============================================================================');
  console.log('🚀 RUNNING DEEP PRODUCTION VERIFICATION TEST SUITE');
  console.log('==============================================================================\n');

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

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Admin Authentication
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('1. Testing Admin Authentication...');
  try {
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bpo.test@thinkatic.com',
        password: '256b2#bpo',
      }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.ok && loginData.token, 'Admin login succeeded and returned JWT');
    adminToken = loginData.token;
  } catch (err) {
    assert(false, `Admin login threw error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Leads Analytics KPIs & Date Filtering (Parts 1, 2, 25)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n2. Testing Admin Leads Analytics KPIs & Date Filters...');
  const dateRanges = [
    { key: 'today' },
    { key: '7d' },
    { key: '30d' },
    { key: '90d' },
    { key: 'custom', start: '2026-09-01', end: '2026-09-30' },
    { key: 'custom_eu', start: '01/09/2026', end: '30/09/2026' },
  ];

  for (const r of dateRanges) {
    try {
      let url = `${BASE_URL}/api/admin/leads/analytics?range=${r.key === 'custom_eu' ? 'custom' : r.key}`;
      if (r.start) url += `&start=${encodeURIComponent(r.start)}&end=${encodeURIComponent(r.end)}`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();

      assert(res.ok && data.kpis, `Date filter range="${r.key}" returned HTTP 200 with kpis object`);
      assert(typeof data.kpis.totalLeads === 'number', `Range "${r.key}" totalLeads=${data.kpis.totalLeads} is numeric`);
      assert(typeof data.kpis.newToday === 'number', `Range "${r.key}" newToday=${data.kpis.newToday} is numeric`);
      assert(typeof data.kpis.thisWeek === 'number', `Range "${r.key}" thisWeek=${data.kpis.thisWeek} is numeric`);
      assert(Array.isArray(data.timeline), `Range "${r.key}" timeline is an array (${data.timeline.length} points)`);
      assert(Array.isArray(data.recentInquiries), `Range "${r.key}" recentInquiries is an array (${data.recentInquiries.length} items)`);
      assert(Array.isArray(data.pipeline) && data.pipeline.length > 0, `Range "${r.key}" pipeline statuses computed`);
    } catch (err) {
      assert(false, `Leads analytics range="${r.key}" failed: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Accreditation Summary & Dynamic Stage Counts (Parts 6, 7, 16)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n3. Testing Accreditation Summary & Counts...');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/accreditation/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert(res.ok && data.counts, 'Accreditation summary returned valid counts object');
    assert(typeof data.counts.total === 'number' && data.counts.total > 0, `Total applications count is positive (${data.counts.total})`);
    assert(typeof data.counts.under_review === 'number', `Under review count is present (${data.counts.under_review})`);
    assert(typeof data.counts.awaiting_documents === 'number', `Awaiting documents count is present (${data.counts.awaiting_documents})`);
    assert(typeof data.counts.activated_centres === 'number', `Activated centres count is present (${data.counts.activated_centres})`);
  } catch (err) {
    assert(false, `Accreditation summary check failed: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Document Download Authentication Protection & Secure Access (Parts 4, 5, 21, 26)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n4. Testing Document Download Authentication & Authorization...');
  try {
    // 4a. Unauthenticated request without token must fail with 401
    const unauthRes = await fetch(`${BASE_URL}/api/admin/accreditation/applications/1/documents/1/download`);
    assert(unauthRes.status === 401, `Unauthenticated download returned HTTP 401 (${unauthRes.status})`);
    const unauthData = await unauthRes.json();
    assert(unauthData.error && unauthData.error.toLowerCase().includes('authentication'), 'Error message specifies "Authentication required"');

    // 4b. Invalid token must fail with 401
    const invalidRes = await fetch(`${BASE_URL}/api/admin/accreditation/applications/1/documents/1/download?token=fake_invalid_token`);
    assert(invalidRes.status === 401, `Invalid token download returned HTTP 401 (${invalidRes.status})`);

    // 4c. Authenticated Admin with token query param
    const authRes = await fetch(`${BASE_URL}/api/admin/accreditation/applications/1/documents/1/download?token=${encodeURIComponent(adminToken)}`, {
      redirect: 'manual',
    });
    // Either 302/307 redirect to signed URL, 200 stream, or 404 if document 1 doesn't exist in Supabase storage, but NOT 401
    assert(authRes.status !== 401, `Authorized admin download accepted without 401 (HTTP ${authRes.status})`);
  } catch (err) {
    assert(false, `Document download test threw error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. BPO Application Dossier Data Connection & Sanitization (Parts 8, 9)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n5. Testing BPO Application Dossier Data Connection...');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/bpo-applications/${testPartnerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert(res.ok && data.id === testPartnerId, `Dossier loaded for partner ${testPartnerId}`);
    
    // Check company name sanitization
    const compName = data.companyName || data.formalApplication?.company_data?.companyName;
    assert(compName && compName.toLowerCase() !== 'none', `Company name is properly populated and NOT "None" (${compName})`);
    
    // Check phone sanitization
    const phone = data.contactPhone || data.formalApplication?.company_data?.phone;
    assert(phone !== '+1 (800) 555-0199', `Contact phone is NOT the dummy "+1 (800) 555-0199" (${phone || 'properly empty/null'})`);
  } catch (err) {
    assert(false, `BPO dossier check failed: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Pre-Approval Server-Side Validation (Part 10, 15, 17)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n6. Testing Pre-Approval Server-Side Validation...');
  try {
    // Attempting to approve non-existent applicant
    const fakeRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/00000000-0000-0000-0000-000000000000/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    assert(fakeRes.status === 404, `Approving non-existent applicant safely returns 404 (${fakeRes.status})`);
  } catch (err) {
    assert(false, `Pre-approval validation test failed: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Suspension / Hold Flow (Parts 12, 13)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n7. Testing Partner Suspension / Hold Flow...');
  const testSuspensionReason = 'Quality audit discrepancy - infrastructure re-inspection required';
  try {
    const suspendRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/${testPartnerId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'SUSPENDED',
        reason: testSuspensionReason,
      }),
    });
    assert(suspendRes.ok, `Admin suspended partner successfully (HTTP ${suspendRes.status})`);

    // Verify dossier reflects suspended state
    const dossierRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/${testPartnerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dossierData = await dossierRes.json();
    assert(dossierData.bpo_status === 'SUSPENDED' || dossierData.status === 'SUSPENDED', `Dossier effective status is SUSPENDED (${dossierData.bpo_status})`);
    assert(dossierData.is_active === false, 'Partner is_active is false during suspension');
    assert(dossierData.applicationDetails?.suspended === true, 'Partner applicationDetails.suspended is true');
    assert(dossierData.applicationDetails?.suspensionReason === testSuspensionReason, 'Suspension reason correctly saved in metadata');

    // Verify status endpoint for the partner reflects suspension
    const statusRes = await fetch(`${BASE_URL}/api/bpo/status`, {
      headers: { Authorization: `Bearer ${partnerToken}` },
    });
    assert(statusRes.ok, `Partner status request succeeded (HTTP ${statusRes.status})`);
    const statusData = await statusRes.json();
    assert(statusData.accountState === 'BPO_SUSPENDED', `Partner status endpoint reports accountState=BPO_SUSPENDED (${statusData.accountState})`);
    assert(statusData.isSuspended === true, 'Partner status endpoint reports isSuspended=true');
    assert(statusData.status === 'UNDER_REVIEW', `Partner status endpoint reports status=UNDER_REVIEW (${statusData.status})`);
    assert(statusData.suspensionReason === testSuspensionReason, 'Partner receives the admin suspension reason');
  } catch (err) {
    assert(false, `Suspension flow test threw error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Restore Access Flow (Part 14)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n8. Testing Partner Restore Access Flow...');
  try {
    const restoreRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/${testPartnerId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'APPROVED',
      }),
    });
    assert(restoreRes.ok, `Admin restored partner access successfully (HTTP ${restoreRes.status})`);

    // Verify dossier reflects restored active state
    const dossierRes = await fetch(`${BASE_URL}/api/admin/bpo-applications/${testPartnerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dossierData = await dossierRes.json();
    assert(dossierData.bpo_status === 'APPROVED' || dossierData.status === 'APPROVED', `Dossier status restored to APPROVED (${dossierData.bpo_status})`);
    assert(dossierData.is_active === true, 'Partner is_active restored to true');
    assert(dossierData.applicationDetails?.suspended === false, 'Partner applicationDetails.suspended is false');

    // Verify status endpoint for the partner reflects restored active access
    const statusRes = await fetch(`${BASE_URL}/api/bpo/status`, {
      headers: { Authorization: `Bearer ${partnerToken}` },
    });
    assert(statusRes.ok, `Partner status request succeeded (HTTP ${statusRes.status})`);
    const statusData = await statusRes.json();
    assert(statusData.isSuspended === false, 'Partner status endpoint reports isSuspended=false');
    assert(statusData.accountState === 'BPO_APPROVED' || statusData.accountState === 'BPO_ACTIVE', `Partner status endpoint reports active state (${statusData.accountState})`);
  } catch (err) {
    assert(false, `Restore access flow test threw error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Final Summary
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n==============================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('==============================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
