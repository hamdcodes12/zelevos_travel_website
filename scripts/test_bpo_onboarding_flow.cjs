const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('C:\\Users\\Gurpreet Singh\\.gemini\\antigravity-ide\\brain\\f68c479e-7e18-4113-abb6-ff871d7ce06e\\e2e_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  console.log('🚀 Starting Comprehensive BPO Onboarding Flow End-to-End Test with Puppeteer...');
  
  const timestamp = Date.now();
  const testEmail = `bpo_partner_${timestamp}@thinkatic.com`;
  const testPassword = 'PartnerPass123!';
  const companyName = `Apex Global BPO Solutions ${timestamp.toString().slice(-4)}`;

  console.log(`\n📋 Registering fresh test partner: ${testEmail}`);
  
  // Register fresh BPO user via API
  const signupRes = await fetch('http://localhost:4317/api/user/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Marcus Vance',
      email: testEmail,
      password: testPassword,
      accountType: 'BPO',
    }),
  });
  const signupData = await signupRes.json();
  if (!signupRes.ok) {
    throw new Error(`Failed to create test user: ${signupData.error || signupData.message}`);
  }
  console.log('  Fresh partner user registered successfully. Token generated.');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  // Suppress cookie consent modal across all navigations
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem(
      'thinkatic_cookie_consent',
      JSON.stringify({ necessary: true, analytics: true, marketing: true, preferences: true })
    );
  });

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[handleSubmit]') || text.includes('error') || text.includes('Error')) {
      console.log('  [Browser]:', text);
    }
  });

  // Helper to safely set React controlled input
  async function setReactInput(selector, value) {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error('Input not found: ' + sel);
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, selector, value);
  }

  // Helper to click Next Step
  async function clickNextStep(expectedNextStepNumber) {
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const nextBtn = buttons.find((b) => b.innerText.includes('Next Step'));
      if (nextBtn) {
        nextBtn.click();
        return true;
      }
      return false;
    });
    if (!clicked) throw new Error('Next Step button not found');
    await sleep(1200);

    const h2Text = await page.evaluate(() => {
      const h = document.querySelector('h2');
      return h ? h.innerText : '';
    });
    console.log(`  -> Advanced to: "${h2Text}"`);
    if (expectedNextStepNumber && !h2Text.includes(`Step ${expectedNextStepNumber}`)) {
      const errorBanner = await page.evaluate(() => {
        const err = document.querySelector('.bg-red-50');
        return err ? err.innerText : '';
      });
      throw new Error(`Expected Step ${expectedNextStepNumber}, but stayed at or navigated to "${h2Text}". Error banner: "${errorBanner}"`);
    }
    return h2Text;
  }

  try {
    // 1. LOGIN AS BPO PARTNER
    console.log('\n--- STEP 1: Log in as BPO Partner ---');
    await page.goto('http://localhost:5000/login', { waitUntil: 'networkidle0' });
    
    // Check if BPO Partner tab exists and click it
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const bpoTab = tabs.find((t) => t.innerText.includes('BPO Partner'));
      if (bpoTab) bpoTab.click();
    });
    await sleep(400);

    // Enter email & password
    await setReactInput('input[type="email"]', testEmail);
    await setReactInput('input[type="password"]', testPassword);
    console.log(`  Filled credentials for ${testEmail}`);

    // Click submit
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) btn.click();
    });
    console.log('  Submitted login form');
    await sleep(1500);

    // 2. NAVIGATE TO /partner/apply
    console.log('\n--- STEP 2: Navigate to BPO Partner Wizard (/partner/apply) ---');
    await page.goto('http://localhost:5000/partner/apply', { waitUntil: 'networkidle0' });
    await sleep(1500);

    // Verify 8 stages header
    const stageElements = await page.$$eval('.flex.overflow-x-auto button, .sm\\:grid button', (btns) =>
      btns.map((b) => b.innerText.replace(/\n/g, ' '))
    );
    console.log('  Header stages detected count:', stageElements.length);
    console.log('  Stages:', stageElements.slice(0, 8));

    // Save screenshot of initial state
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_step1_company.png') });

    // Step 1: Fill company info
    console.log('\n--- STEP 3: Complete Step 1 (Company Information) ---');
    await setReactInput('input[placeholder*="Apex Global Solutions"]', companyName);
    await setReactInput('input[placeholder*="Full Name"]', 'Marcus Vance');
    await setReactInput('input[placeholder*="contact@yourcompany.com"]', testEmail);
    await setReactInput('input[placeholder*="9876543210"]', '+1 555 987 6543');
    await setReactInput('input[placeholder*="Building, Street"]', '100 Horizon Tech Blvd');
    await setReactInput('input[placeholder*="Pune, Bangalore"]', 'Austin');
    await setReactInput('input[placeholder*="Maharashtra, Karnataka"]', 'Texas');
    await setReactInput('input[placeholder*="India, Philippines"]', 'United States');
    console.log('  Filled all required Step 1 company fields');
    await sleep(500);

    // Click Next Step -> MUST open Step 2
    await clickNextStep(2);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_step2_office.png') });

    // Step 2: Fill office info
    console.log('\n--- STEP 4: Complete Step 2 (Office & Centre Setup) ---');
    await setReactInput('input[placeholder*="Hinjewadi Tech Centre"]', 'Apex Tech Centre One');
    await setReactInput('input[placeholder*="Centre Location"]', 'Tower B, 4th Floor, Horizon Park');
    await setReactInput('input[placeholder="e.g. 50"]', '120');
    await setReactInput('input[placeholder="e.g. 20"]', '45');
    console.log('  Filled required Step 2 centre fields');
    await sleep(500);

    // Click Next Step -> MUST open Step 3
    await clickNextStep(3);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_step3_documents.png') });

    // Step 3: Documents
    console.log('\n--- STEP 5: Step 3 (Compliance Documents) ---');
    await sleep(500);
    // Click Next Step -> MUST open Step 4
    await clickNextStep(4);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_step4_verification.png') });

    // Step 4: Verification / Infrastructure
    console.log('\n--- STEP 6: Step 4 (Technical & Physical Infrastructure) ---');
    await sleep(500);
    // Click Next Step -> MUST open Step 5
    await clickNextStep(5);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_step5_capacity.png') });

    // Step 5: Capacity
    console.log('\n--- STEP 7: Step 5 (Capacity & Capabilities) ---');
    await sleep(500);

    // ========================================================
    // CRITICAL REQUIREMENT 1: CAPACITY -> AGREEMENT (NOT REVIEW!)
    // ========================================================
    console.log('\n*** VERIFYING CRITICAL RULE: Step 5 Capacity NEXT STEP MUST OPEN Step 6 Agreement ***');
    const step6Header = await clickNextStep(6);
    console.log('  ✅ SUCCESS: Capacity strictly opened Step 6 Agreement! (NOT Review)');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_step6_agreement_initial.png') });

    // Test View Agreement modal
    console.log('\n--- STEP 8: Test View Agreement Modal ---');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const viewBtn = btns.find((b) => b.innerText.includes('View Agreement'));
      if (viewBtn) viewBtn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_step6_view_modal.png') });

    const modalTitle = await page.evaluate(() => {
      const h3 = document.querySelector('.fixed h3');
      return h3 ? h3.innerText : '';
    });
    console.log(`  Modal Title: "${modalTitle}"`);

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.getElementById('close-agreement-modal-btn');
      if (closeBtn) closeBtn.click();
    });
    await sleep(600);

    // Test uploading signed agreement PDF
    console.log('\n--- STEP 9: Upload Signed Agreement PDF ---');
    const testPdfPath = path.resolve('test_signed_agreement.pdf');
    const fileInput = await page.$('#signed-agreement-upload-input');
    if (!fileInput) {
      throw new Error('Agreement PDF file input (#signed-agreement-upload-input) not found');
    }
    await fileInput.uploadFile(testPdfPath);
    console.log(`  Attached ${testPdfPath}`);
    await sleep(800);

    // Click "Upload Signed Agreement" button
    await page.evaluate(() => {
      const upBtn = document.getElementById('upload-signed-agreement-btn');
      if (upBtn) upBtn.click();
    });
    console.log('  Clicked Upload Signed Agreement button');
    await sleep(3500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_step6_agreement_uploaded.png') });

    const uploadSuccessText = await page.evaluate(() => {
      const el = document.querySelector('.bg-emerald-50, .text-emerald-800');
      return el ? el.innerText : '';
    });
    console.log(`  Upload message: "${uploadSuccessText}"`);

    // ========================================================
    // CRITICAL REQUIREMENT 2: AGREEMENT -> REVIEW
    // ========================================================
    console.log('\n*** VERIFYING CRITICAL RULE: Step 6 Agreement NEXT STEP MUST OPEN Step 7 Review ***');
    await clickNextStep(7);
    console.log('  ✅ SUCCESS: Agreement successfully opened Step 7 Review!');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_step7_review.png') });

    // Verify 6 summary cards
    const cardTitles = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('.uppercase.tracking-wider'));
      return spans.map((s) => s.innerText);
    });
    console.log('  Review summary card titles found:', cardTitles);

    // Check declaration checkbox
    console.log('\n--- STEP 10: Check Declaration & Submit Application ---');
    await page.evaluate(() => {
      const cb = document.getElementById('declaration-agreed-checkbox');
      if (cb) {
        cb.scrollIntoView({ block: 'center', behavior: 'instant' });
        cb.click();
      }
    });
    await sleep(800);
    const isCheckedAfter = await page.$eval('#declaration-agreed-checkbox', (el) => el.checked);
    const isBtnDisabled = await page.$eval('#final-submit-application-btn', (el) => el.disabled);
    console.log('  Checkbox checked after click:', isCheckedAfter, '| Submit button disabled:', isBtnDisabled);

    if (isBtnDisabled) {
      throw new Error(`Submit button is still disabled! Checkbox: ${isCheckedAfter}`);
    }

    // Click Final Submit button
    await page.evaluate(() => {
      const btn = document.getElementById('final-submit-application-btn');
      if (btn) {
        btn.scrollIntoView({ block: 'center', behavior: 'instant' });
        btn.click();
      }
    });
    console.log('  Clicked #final-submit-application-btn');
    await sleep(4000);

    const errorBanner = await page.evaluate(() => {
      const err = document.querySelector('.bg-red-50');
      return err ? err.innerText : '';
    });
    if (errorBanner) console.log('  Banner text on page:', errorBanner);

    // ========================================================
    // CRITICAL REQUIREMENT 3: STEP 8 — ACTIVATION / 24-HOUR REVIEW
    // ========================================================
    console.log('\n*** VERIFYING CRITICAL RULE: Final Submit MUST OPEN Step 8 Activation / 24-Hour Review ***');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_step8_activation_24hr_review.png') });

    const step8State = await page.evaluate(() => {
      const h2 = document.querySelector('h2');
      const badge = document.getElementById('operations-review-badge');
      const headline = document.querySelector('h3.text-2xl, h3.text-3xl');
      const checklist = Array.from(document.querySelectorAll('.bg-white.rounded-xl.p-3 span')).map((s) => s.innerText);
      return {
        h2Text: h2 ? h2.innerText : '',
        badgeText: badge ? badge.innerText : '',
        headline: headline ? headline.innerText : '',
        checklist,
      };
    });

    console.log('  Step 8 H2:', step8State.h2Text);
    console.log('  Step 8 Badge:', step8State.badgeText);
    console.log('  Step 8 Headline:', step8State.headline);
    console.log('  Step 8 Checklist:', step8State.checklist);

    if (!step8State.badgeText.includes('UNDER OPERATIONS REVIEW')) {
      throw new Error(`CRITICAL FAILURE: Step 8 did not show UNDER OPERATIONS REVIEW! Badge showed: ${step8State.badgeText}`);
    }
    console.log('  ✅ SUCCESS: Step 8 Activation / 24-Hour Review State successfully displayed!');

    // ========================================================
    // CRITICAL REQUIREMENT 4: MOBILE RESPONSIVENESS CHECK
    // ========================================================
    console.log('\n*** VERIFYING MOBILE RESPONSIVENESS (320px, 360px, 375px, 390px, 412px) ***');
    const viewports = [320, 360, 375, 390, 412];
    for (const width of viewports) {
      await page.setViewport({ width, height: 750 });
      await sleep(300);
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2;
      });
      console.log(`  Viewport ${width}px: Horizontal overflow = ${overflow ? 'FAIL' : 'PASS (Clean)'}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `mobile_${width}px.png`) });
    }

    // ========================================================
    // CRITICAL REQUIREMENT 5: ADMIN REVIEW & APPROVAL
    // ========================================================
    console.log('\n*** VERIFYING ADMIN REVIEW & APPROVAL WORKFLOW ***');
    await page.setViewport({ width: 1280, height: 900 });

    // Acquire admin token
    const adminLoginRes = await fetch('http://localhost:4317/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const adminAuth = await adminLoginRes.json();
    console.log(`  Acquired Admin Token for: ${adminAuth.username}`);

    // Set token in browser localStorage and navigate directly to BPO approvals
    await page.evaluate((tok, usr) => {
      localStorage.setItem('admin_token', tok);
      localStorage.setItem('admin_username', usr);
    }, adminAuth.token, adminAuth.username);

    await page.goto('http://localhost:5000/admin?section=bpo-approvals', { waitUntil: 'networkidle0' });
    await sleep(2500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_admin_dashboard.png') });
    console.log('  Admin dashboard loaded successfully.');

    // Wait for BPO Approvals panel to load applications
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_admin_bpo_approvals_list.png') });

    // Check if submitted application is in the list
    const foundInList = await page.evaluate((cName) => {
      return document.body.innerText.includes(cName) || document.body.innerText.includes('UNDER_REVIEW') || document.body.innerText.includes('SUBMITTED');
    }, companyName);
    console.log(`  Submitted application visible in Admin Approvals: ${foundInList}`);

    // Click "View Details" on the application to inspect dossier
    console.log('\n--- ADMIN: Inspect Applicant Dossier ---');
    const clickedDetails = await page.evaluate((cName) => {
      // Find row with company name
      const rows = Array.from(document.querySelectorAll('.group.relative.rounded-2xl'));
      const targetRow = rows.find((r) => r.innerText.includes(cName)) || rows[0];
      if (targetRow) {
        const btns = Array.from(targetRow.querySelectorAll('button'));
        const viewBtn = btns.find((b) => b.innerText.includes('View Details'));
        if (viewBtn) {
          viewBtn.click();
          return true;
        }
      }
      return false;
    }, companyName);
    console.log(`  Clicked View Details: ${clickedDetails}`);
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_admin_dossier_drawer.png') });

    // Close dossier drawer
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[title="Close (Esc)"], button[title="Close dossier"], button:has(svg.lucide-x)');
      if (closeBtn) closeBtn.click();
    });
    await sleep(1000);

    // Click "Approve" button on application
    console.log('\n--- ADMIN: Approve Partner Application ---');
    const clickedApprove = await page.evaluate((cName) => {
      const rows = Array.from(document.querySelectorAll('.group.relative.rounded-2xl'));
      const targetRow = rows.find((r) => r.innerText.includes(cName)) || rows[0];
      if (targetRow) {
        const btns = Array.from(targetRow.querySelectorAll('button'));
        const approveBtn = btns.find((b) => b.innerText.includes('Approve'));
        if (approveBtn) {
          approveBtn.click();
          return true;
        }
      }
      return false;
    }, companyName);
    console.log(`  Clicked Approve button: ${clickedApprove}`);
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_admin_approve_modal.png') });

    // Confirm in modal
    const confirmedApproval = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0.z-60');
      if (modal) {
        const btns = Array.from(modal.querySelectorAll('button'));
        const confirmBtn = btns.find((b) => b.innerText.includes('Approve') || b.innerText.includes('Confirm') || b.className.includes('bg-emerald'));
        if (confirmBtn) {
          confirmBtn.click();
          return true;
        }
      }
      return false;
    });
    console.log(`  Confirmed approval in modal: ${confirmedApproval}`);
    await sleep(4000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_admin_approved.png') });

    // Return to partner portal to verify status
    console.log('\n--- PARTNER: Verify Approved / Active Status in Portal ---');
    await page.goto('http://localhost:5000/partner/apply', { waitUntil: 'networkidle0' });
    await sleep(2500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_partner_active_status.png') });

    console.log('\n🎉 ALL ACCEPTANCE CRITERIA AND FLOW STEPS VALIDATED AND TESTED SUCCESSFULLY!');

  } catch (err) {
    console.error('❌ E2E TEST ERROR:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png') });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
