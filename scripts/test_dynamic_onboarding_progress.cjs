const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('C:\\Users\\Gurpreet Singh\\.gemini\\antigravity-ide\\brain\\f68c479e-7e18-4113-abb6-ff871d7ce06e\\e2e_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let passedCount = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  passedCount++;
  console.log(`✓ PASSED: ${message}`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  console.log('================================================================');
  console.log('🚀 RUNNING ALL 12 VERIFICATION TESTS: DYNAMIC PROGRESS & RESUME');
  console.log('================================================================');

  const timestamp = Date.now();
  const testEmail = `bpo_dyn_${timestamp}@thinkatic.com`;
  const testPassword = 'DynamicPass123!';
  const companyName = `Apex Global BPO ${timestamp.toString().slice(-4)}`;

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Only account created
  // Expected: Progress reflects only account completion (1/9 = 11%). Continue -> Company.
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 1: Only account created ---');
  const signupRes = await fetch('http://localhost:4317/api/user/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Vikram Malhotra',
      email: testEmail,
      password: testPassword,
      accountType: 'BPO',
    }),
  });
  const signupData = await signupRes.json();
  assert(signupRes.ok, 'Signup API call succeeded');
  const token = signupData.token;
  const userId = signupData.profile?.id;

  const statusRes1 = await fetch('http://localhost:4317/api/bpo/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status1 = await statusRes1.json();

  assert(status1.onboardingSummary.completedStages === 1, `TEST 1: completedStages === 1 (got ${status1.onboardingSummary.completedStages})`);
  assert(status1.onboardingSummary.totalStages === 9, `TEST 1: totalStages === 9 (got ${status1.onboardingSummary.totalStages})`);
  assert(status1.onboardingSummary.progressPercent === 11, `TEST 1: progressPercent === 11% (NOT 15%, got ${status1.onboardingSummary.progressPercent}%)`);
  assert(status1.onboardingSummary.nextActionStage === 'company', `TEST 1: nextActionStage === 'company' (got ${status1.onboardingSummary.nextActionStage})`);
  assert(status1.onboardingSummary.nextStepUrl.includes('step=0'), `TEST 1: nextStepUrl opens Company form /partner/apply?step=0 (got ${status1.onboardingSummary.nextStepUrl})`);
  assert(status1.navAction.label === 'Continue Onboarding', 'TEST 1: navAction label is Continue Onboarding');
  assert(status1.onboardingSummary.stages[0].status === 'Complete', 'TEST 1: Account stage is Complete');
  assert(status1.onboardingSummary.stages[1].status === 'Required', 'TEST 1: Company stage is Required');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Company complete
  // Expected: Continue -> Office (2/9 = 22%).
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Company complete ---');
  const appCreateRes = await fetch('http://localhost:4317/api/partner/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      companyData: {
        companyName,
        legalEntity: 'Private Limited',
        ownerName: 'Vikram Malhotra',
        email: testEmail,
        phone: '+91 98112 34567',
        address: 'Tower 4, Level 6, Cyber Park, Sector 62',
        city: 'Noida',
        state: 'Uttar Pradesh',
        country: 'India',
        gstNumber: '07AAACA1234B1Z5',
        panNumber: 'AAACA1234B',
      },
      isDraft: true,
    }),
  });
  const appData = await appCreateRes.json();
  assert(appCreateRes.ok, 'Application draft created with company data');
  const appId = appData.application.id;

  const statusRes2 = await fetch('http://localhost:4317/api/bpo/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status2 = await statusRes2.json();

  assert(status2.onboardingSummary.completedStages === 2, `TEST 2: completedStages === 2 (got ${status2.onboardingSummary.completedStages})`);
  assert(status2.onboardingSummary.progressPercent === 22, `TEST 2: progressPercent === 22% (got ${status2.onboardingSummary.progressPercent}%)`);
  assert(status2.onboardingSummary.nextActionStage === 'centre', `TEST 2: nextActionStage === 'centre' (got ${status2.onboardingSummary.nextActionStage})`);
  assert(status2.onboardingSummary.nextStepUrl.includes('step=1'), `TEST 2: nextStepUrl opens Office / Centre step=1 (got ${status2.onboardingSummary.nextStepUrl})`);
  assert(status2.onboardingSummary.stages[1].status === 'Complete', 'TEST 2: Company stage is Complete');
  assert(status2.onboardingSummary.stages[2].status === 'Required', 'TEST 2: Centre stage is Required');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3 & 4: Company + Office complete, Documents incomplete
  // Expected: Continue -> Documents (3/9 = 33%).
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3 & 4: Company + Office complete, Documents incomplete ---');
  await fetch(`http://localhost:4317/api/partner/applications/${appId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      centreData: {
        centreName: `${companyName} Centre 1`,
        centreAddress: 'Tower 4, Level 6, Cyber Park, Sector 62, Noida, UP',
        totalSeats: '120',
        availableSeats: '45',
        activeAgents: '75',
        numberOfFloors: '2',
        workingHours: '24/7',
        languagesSupported: ['English', 'Hindi'],
        usExperience: true,
        ukExperience: true,
        domesticExperience: true,
      },
    }),
  });

  const statusRes3 = await fetch('http://localhost:4317/api/bpo/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status3 = await statusRes3.json();

  assert(status3.onboardingSummary.completedStages === 3, `TEST 3: completedStages === 3 (got ${status3.onboardingSummary.completedStages})`);
  assert(status3.onboardingSummary.progressPercent === 33, `TEST 3: progressPercent === 33% (got ${status3.onboardingSummary.progressPercent}%)`);
  assert(status3.onboardingSummary.nextActionStage === 'documents', `TEST 4: Documents incomplete -> nextActionStage === 'documents' (got ${status3.onboardingSummary.nextActionStage})`);
  assert(status3.onboardingSummary.nextStepUrl.includes('step=2'), `TEST 4: nextStepUrl opens Documents step=2 (got ${status3.onboardingSummary.nextStepUrl})`);
  assert(status3.onboardingSummary.stages[2].status === 'Complete', 'TEST 3: Centre stage is Complete');
  assert(status3.onboardingSummary.stages[5].status === 'Required', 'TEST 4: Documents stage is Required');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Office Verification = Needs Correction
  // Expected: Continue -> Office Verification. Correction reason visible.
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Office Verification = Needs Correction ---');
  // First upload 3 documents so documents become complete
  const samplePdfBase64 = Buffer.from('%PDF-1.4\n%âãÏÓ\nSimulated KYC Document Content\n%%EOF').toString('base64');
  for (const docType of ['incorporation_certificate', 'gst_certificate', 'pan_card']) {
    await fetch(`http://localhost:4317/api/partner/applications/${appId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        documentType: docType,
        fileName: `${docType}.pdf`,
        fileData: `data:application/pdf;base64,${samplePdfBase64}`,
        fileSizeBytes: 1024,
      }),
    });
  }

  // Trigger Needs Correction on verification
  const verifRes = await fetch('http://localhost:4317/api/bpo/centre-verification/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const verifData = await verifRes.json();
  const verifId = verifData.verification.id;

  // Admin marks verification with rejection/resubmission_required
  const adminSecret = process.env.SESSION_SECRET || 'thinkatic-admin-secret-key-2026-production';
  const jwt = require(path.resolve('artifacts/api-server/node_modules/jsonwebtoken'));
  const adminToken = jwt.sign({ id: 1, username: 'admin' }, adminSecret, { expiresIn: '1h' });

  const rejectRes = await fetch(`http://localhost:4317/api/admin/bpo/centre-verifications/${verifId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      rejectionReason: 'Server room photo is blurry and does not show rack serial tags clearly. Please re-upload.',
      notes: 'Requested clearer photograph of primary rack.',
    }),
  });
  const rejectData = await rejectRes.json();
  assert(rejectRes.ok, `Verification rejection succeeded: ${rejectData.message || ''}`);

  const statusRes5 = await fetch('http://localhost:4317/api/bpo/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status5 = await statusRes5.json();

  assert(status5.accountState === 'BPO_RESUBMISSION_REQUIRED', `TEST 5: accountState === 'BPO_RESUBMISSION_REQUIRED' (got ${status5.accountState})`);
  assert(status5.onboardingSummary.primaryCorrection !== null, 'TEST 5: primaryCorrection object is present');
  assert(status5.onboardingSummary.primaryCorrection.stage === 'verification', 'TEST 5: primaryCorrection stage is verification');
  assert(status5.onboardingSummary.primaryCorrection.reason.includes('blurry'), `TEST 5: Correction reason is visible (got ${status5.onboardingSummary.primaryCorrection.reason})`);
  assert(status5.onboardingSummary.nextActionStage === 'verification', `TEST 5: Priority action is verification (got ${status5.onboardingSummary.nextActionStage})`);
  assert(status5.onboardingSummary.nextStepUrl === '/partner?tab=verification', `TEST 5: nextStepUrl opens verification tab (got ${status5.onboardingSummary.nextStepUrl})`);
  assert(status5.onboardingSummary.stages[6].status === 'Needs Correction', 'TEST 5: Verification stage status is Needs Correction');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Capacity complete
  // Expected: Continue -> Agreement
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Capacity complete ---');
  // Admin approves verification to clear correction
  const approveVerifRes = await fetch(`http://localhost:4317/api/admin/bpo/centre-verifications/${verifId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ reviewNotes: 'All verification media verified and approved.' }),
  });
  const approveVerifData = await approveVerifRes.json();
  assert(approveVerifRes.ok, `Verification approval succeeded: ${approveVerifData.message || ''}`);

  // Save Infrastructure and Experience / Capacity
  await fetch(`http://localhost:4317/api/partner/applications/${appId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      infrastructureData: {
        internetBandwidth: '1 Gbps Leased Line (1:1)',
        backupInternet: '500 Mbps Secondary Fiber',
        powerBackup: 'Online UPS 30 kVA + 125 kVA DG Set',
        computers: 'i7 16GB RAM SSD',
      },
      processExperience: ['Customer Support', 'Telecalling', 'Technical Support'],
    }),
  });

  const statusRes6 = await fetch('http://localhost:4317/api/bpo/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status6 = await statusRes6.json();

  assert(status6.onboardingSummary.stages[3].status === 'Complete', 'TEST 6: Infrastructure is Complete');
  assert(status6.onboardingSummary.stages[4].status === 'Complete', 'TEST 6: Experience is Complete');
  assert(status6.onboardingSummary.stages[6].status === 'Complete', 'TEST 6: Verification is Complete');
  assert(status6.onboardingSummary.nextActionStage === 'agreement', `TEST 6: nextActionStage === 'agreement' (got ${status6.onboardingSummary.nextActionStage})`);
  assert(status6.onboardingSummary.nextStepUrl.includes('agreement'), `TEST 6: nextStepUrl points to Agreement (got ${status6.onboardingSummary.nextStepUrl})`);

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Signed Agreement uploaded
  // Expected: Continue -> Review (8/9 = 89%)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Signed Agreement uploaded ---');
  const uploadAgreementRes = await fetch('http://localhost:4317/api/bpo/agreement/upload-signed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      fileName: 'Signed_Partner_Agreement.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 2048,
      fileData: `data:application/pdf;base64,${samplePdfBase64}`,
    }),
  });
  const uploadAgrData = await uploadAgreementRes.json();
  assert(uploadAgreementRes.ok, `Agreement upload succeeded: ${uploadAgrData.message || ''}`);

  const statusRes7 = await fetch('http://localhost:4317/api/bpo/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status7 = await statusRes7.json();

  assert(status7.onboardingSummary.completedStages === 8, `TEST 7: completedStages === 8 (got ${status7.onboardingSummary.completedStages})`);
  assert(status7.onboardingSummary.progressPercent === 89, `TEST 7: progressPercent === 89% (got ${status7.onboardingSummary.progressPercent}%)`);
  assert(status7.onboardingSummary.stages[7].status === 'Complete', 'TEST 7: Agreement stage is Complete');
  assert(status7.onboardingSummary.nextStepUrl.includes('step=6'), `TEST 7: nextStepUrl points to Review Step 6 (got ${status7.onboardingSummary.nextStepUrl})`);

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: Final submission completed
  // Expected: Dashboard -> Under Operations Review. Estimated review: Within 24 Hours.
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8: Final submission completed ---');
  const submitRes = await fetch(`http://localhost:4317/api/partner/applications/${appId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  assert(submitRes.ok, 'Final application submission succeeded');

  const statusRes8 = await fetch('http://localhost:4317/api/bpo/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status8 = await statusRes8.json();

  assert(status8.onboardingSummary.isUnder24HourReview === true, 'TEST 8: isUnder24HourReview === true');
  assert(status8.accountState === 'FINAL_REVIEW', `TEST 8: accountState === 'FINAL_REVIEW' (got ${status8.accountState})`);
  assert(status8.onboardingSummary.reviewNotice.includes('24 hours'), 'TEST 8: Review notice specifies 24 hours');
  assert(status8.onboardingSummary.nextStepUrl === '/partner', 'TEST 8: nextStepUrl points to partner dashboard (waiting state, no redirect to earlier forms)');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 9: Admin approves
  // Expected: Partner dashboard -> final approved/activated state (100% progress)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 9: Admin approves ---');
  const adminApproveRes = await fetch(`http://localhost:4317/api/admin/partner-applications/${appId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ notes: 'Accreditation verified. Approved for full partner portal access.' }),
  });
  const adminApproveData = await adminApproveRes.json();
  assert(adminApproveRes.ok, `Admin approval API succeeded: ${adminApproveData.message || ''}`);

  const statusRes9 = await fetch('http://localhost:4317/api/bpo/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status9 = await statusRes9.json();

  assert(status9.canEnterPortal === true, 'TEST 9: canEnterPortal === true');
  assert(status9.accountState === 'BPO_ACTIVE', `TEST 9: accountState === 'BPO_ACTIVE' (got ${status9.accountState})`);
  assert(status9.onboardingSummary.completedStages === 9, `TEST 9: completedStages === 9 (got ${status9.onboardingSummary.completedStages})`);
  assert(status9.onboardingSummary.progressPercent === 100, `TEST 9: progressPercent === 100% (got ${status9.onboardingSummary.progressPercent}%)`);
  assert(status9.onboardingSummary.stages.every(s => s.completed), 'TEST 9: All 9 stages are Complete');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10 & 11: Refresh and Logout/Login Persistence
  // Expected: Same persisted progress from Supabase without client state
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 10 & 11: Refresh and Logout/Login Persistence ---');
  // Log in again fresh with credentials
  const loginRes = await fetch('http://localhost:4317/api/user/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.ok, 'Re-login succeeded');

  const statusRes10 = await fetch('http://localhost:4317/api/bpo/status', {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  const status10 = await statusRes10.json();

  assert(status10.onboardingSummary.progressPercent === 100, 'TEST 10: Progress 100% preserved after re-login');
  assert(status10.canEnterPortal === true, 'TEST 10: canEnterPortal preserved after re-login');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 12: Puppeteer UI Dashboard Verification (Desktop & Mobile)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 12: Puppeteer UI Dashboard Verification ---');
  // Create another partner at 33% progress (Company + Centre complete) to test the live Incomplete Card in UI
  const midEmail = `bpo_mid_${Date.now()}@thinkatic.com`;
  const midSignup = await fetch('http://localhost:4317/api/user/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Ananya Sharma',
      email: midEmail,
      password: testPassword,
      accountType: 'BPO',
    }),
  });
  const midData = await midSignup.json();
  const midToken = midData.token;

  await fetch('http://localhost:4317/api/partner/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${midToken}` },
    body: JSON.stringify({
      companyData: {
        companyName: 'Apex Cloud Solutions',
        legalEntity: 'Private Limited',
        ownerName: 'Ananya Sharma',
        email: midEmail,
        phone: '+91 98765 43210',
        address: 'Sector 62, Electronic City',
      },
      centreData: {
        centreName: 'Apex Cloud Centre',
        centreAddress: 'Sector 62, Electronic City',
        totalSeats: '80',
      },
      isDraft: true,
    }),
  });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument((tok, user) => {
    localStorage.setItem('user_token', tok);
    localStorage.setItem('thinkatic_user_token', tok);
    localStorage.setItem('user_profile', JSON.stringify(user));
    localStorage.setItem('thinkatic_cookie_consent', JSON.stringify({ necessary: true }));
  }, midToken, midData.profile);

  await page.goto('http://localhost:5000/partner', { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="onboarding-progress-percent"]', { timeout: 15000 });
  await sleep(500);

  // Take screenshot of Desktop Dashboard
  const desktopCardShot = path.join(SCREENSHOT_DIR, 'dashboard_dynamic_progress_desktop.png');
  await page.screenshot({ path: desktopCardShot, fullPage: false });
  console.log(`  Screenshot saved: ${desktopCardShot}`);

  // Verify displayed progress percentage is NOT 15% and matches 33%
  const displayedPercent = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="onboarding-progress-percent"]');
    return el ? el.innerText.trim() : null;
  });
  assert(displayedPercent === '33%', `TEST 12: Displayed progress in UI is '33%' (got '${displayedPercent}', NOT hardcoded 15%)`);

  // Verify Continue Onboarding button
  const continueBtnText = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="continue-onboarding-button"]');
    return btn ? btn.innerText.trim() : null;
  });
  assert(continueBtnText?.includes('Continue Onboarding'), 'TEST 12: Continue Onboarding button exists in UI');

  // Test Mobile view
  await page.setViewport({ width: 375, height: 812, isMobile: true });
  await page.waitForSelector('[data-testid="continue-onboarding-button"]', { timeout: 15000 });
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="continue-onboarding-button"]');
    btn?.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await sleep(500);

  const mobileCardShot = path.join(SCREENSHOT_DIR, 'dashboard_dynamic_progress_mobile_375px.png');
  await page.screenshot({ path: mobileCardShot, fullPage: false });
  console.log(`  Screenshot saved: ${mobileCardShot}`);

  // Click Continue Onboarding in Mobile View
  await page.click('[data-testid="continue-onboarding-button"]');
  await sleep(2000);
  const currentUrl = page.url();
  console.log(`  -> Continue Onboarding navigated to: ${currentUrl}`);
  assert(currentUrl.includes('/partner/apply?step=2'), `TEST 12: Continue Onboarding opened first incomplete step (Documents step=2): ${currentUrl}`);

  await browser.close();

  console.log('\n================================================================');
  console.log(`🎉 ALL 12 TESTS PASSED PERFECTLY! (${passedCount} checks verified)`);
  console.log('================================================================\n');
})().catch(err => {
  console.error('\n❌ TEST RUNNER ERROR:', err);
  process.exit(1);
});
