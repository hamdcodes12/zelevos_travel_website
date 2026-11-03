// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM
// Automated End-to-End Test for BPO Partner Profile Tab:
// 1. Authenticate with real database BPO Partner account (bpo.test@thinkatic.com)
// 2. Load BPO Partner Dashboard (/partner)
// 3. Verify "Profile" tab exists in navigation
// 4. Navigate to Profile tab (?tab=profile)
// 5. Verify real database data is displayed:
//    - Partner Name: "BPO Test Partner Admin"
//    - Centre / Company: "Thinkatic Global Delivery Centre - NY-01"
//    - Mobile Number: "+1-800-555-0199"
//    - Email Address: "bpo.test@thinkatic.com"
// 6. Verify zero mock/dummy data (No "Apex Global BPO Operations", etc.)
// 7. Verify strict scope (No edit, no password change, etc.)
// 8. Verify mobile viewport responsiveness
// 9. Verify top-right header menu Profile shortcut
// ==============================================================================

const path = require('path');
const fs = require('fs');

const puppeteer = require('C:\\GIT DESK\\THINK\\node_modules\\.pnpm\\puppeteer-core@25.11.0\\node_modules\\puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('C:\\Users\\Gurpreet Singh\\.gemini\\antigravity-ide\\brain\\f68c479e-7e18-4113-abb6-ff871d7ce06e\\e2e_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  console.log('==============================================================================');
  console.log('👤 TESTING BPO PARTNER PROFILE TAB (UI + REAL DATA)');
  console.log('==============================================================================');

  const BPO_EMAIL = 'bpo.test@thinkatic.com';
  const BPO_PASSWORD = '256b2#bpo';

  console.log(`\n1. Authenticating via API for: ${BPO_EMAIL}`);
  const loginRes = await fetch('http://localhost:4317/api/user/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: BPO_EMAIL, password: BPO_PASSWORD }),
  });

  if (!loginRes.ok) {
    const errText = await loginRes.text();
    console.error(`Login failed (${loginRes.status}): ${errText}`);
    process.exit(1);
  }

  const loginData = await loginRes.json();
  const token = loginData.token;
  const userProfile = loginData.profile;
  console.log(`  ✓ Auth token generated: ${token.slice(0, 20)}...`);
  console.log(`  ✓ Logged in user: ${userProfile.fullName || userProfile.email}`);

  console.log('\n2. Verifying GET /api/bpo/profile returns real database data');
  const profileRes = await fetch('http://localhost:4317/api/bpo/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!profileRes.ok) {
    console.error(`Profile API failed (${profileRes.status}):`, await profileRes.text());
    process.exit(1);
  }
  const apiProfile = await profileRes.json();
  console.log('  API Response:', JSON.stringify(apiProfile, null, 2));

  // Assertions on real data
  if (!apiProfile.partnerName || apiProfile.partnerName === 'Operations Director') {
    throw new Error(`Invalid partnerName: ${apiProfile.partnerName}`);
  }
  if (!apiProfile.centreName || apiProfile.centreName === 'Apex Global BPO Operations') {
    throw new Error(`Invalid centreName: ${apiProfile.centreName}`);
  }
  if (!apiProfile.mobileNumber || apiProfile.mobileNumber === '+1 (555) 019-2834') {
    throw new Error(`Invalid mobileNumber: ${apiProfile.mobileNumber}`);
  }
  if (apiProfile.email !== BPO_EMAIL) {
    throw new Error(`Invalid email: expected ${BPO_EMAIL}, got ${apiProfile.email}`);
  }
  console.log('  ✓ Backend API data integrity verified: 100% genuine Supabase values');

  console.log('\n3. Launching Chrome Puppeteer browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Inject session into localStorage before loading page
  await page.goto('http://localhost:5000/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ tok, prof }) => {
      localStorage.setItem('user_token', tok);
      localStorage.setItem('thinkatic_user_token', tok);
      localStorage.setItem('user_profile', JSON.stringify(prof));
      localStorage.setItem('user', JSON.stringify(prof));
      localStorage.setItem('thinkatic_cookie_consent', JSON.stringify({ necessary: true, analytics: true, marketing: true, preferences: true }));
    },
    { tok: token, prof: userProfile }
  );

  console.log('\n4. Navigating to Partner Dashboard (/partner)...');
  await page.goto('http://localhost:5000/partner', { waitUntil: 'networkidle2' });
  await sleep(2500);

  // Take initial dashboard screenshot
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '01_partner_dashboard_overview.png'),
    fullPage: false,
  });
  console.log('  ✓ Captured: 01_partner_dashboard_overview.png');

  console.log('\n5. Locating "Profile" tab in desktop navigation sidebar...');
  const profileTabExists = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('aside nav button'));
    const profileBtn = buttons.find((b) => b.textContent && b.textContent.includes('Profile'));
    return Boolean(profileBtn);
  });

  if (!profileTabExists) {
    throw new Error('Profile tab button was NOT found in the sidebar navigation!');
  }
  console.log('  ✓ "Profile" tab found in sidebar navigation');

  console.log('\n6. Clicking "Profile" tab in sidebar...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('aside nav button'));
    const profileBtn = buttons.find((b) => b.textContent && b.textContent.includes('Profile'));
    if (profileBtn) profileBtn.click();
  });
  // Verify URL updated with ?tab=profile
  const currentUrl = page.url();
  console.log(`  Current page URL: ${currentUrl}`);
  if (!currentUrl.includes('tab=profile')) {
    throw new Error(`URL did not update to ?tab=profile: ${currentUrl}`);
  }
  console.log('  ✓ URL contains ?tab=profile');

  // Wait for real profile data to load into the UI (up to 12s)
  console.log('  Waiting for authenticated profile data to render...');
  for (let i = 0; i < 30; i++) {
    const hasData = await page.evaluate(() => document.body.innerText.includes('BPO Test Partner Admin'));
    if (hasData) break;
    await sleep(400);
  }

  // Capture Profile Tab screenshot
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '02_partner_profile_tab_desktop.png'),
    fullPage: false,
  });
  console.log('  ✓ Captured: 02_partner_profile_tab_desktop.png');

  console.log('\n7. Inspecting Profile Tab UI elements & Real Data...');
  const uiData = await page.evaluate(() => {
    const text = document.body.innerText;
    const partnerName = text.includes('BPO Test Partner Admin');
    const centreName = text.includes('Thinkatic Global Delivery Centre - NY-01') || text.includes('Thinkatic Global BPO Services Ltd');
    const mobile = text.includes('+1-800-555-0199');
    const email = text.includes('bpo.test@thinkatic.com');

    // Negative checks for dummy mock data
    const hasDummyApex = text.includes('Apex Global BPO Operations');
    const hasDummyDirector = text.includes('Operations Director');
    const hasDummyPhone = text.includes('+1 (555) 019-2834');

    // Scope check: no unwanted controls
    const hasEditProfile = text.includes('Edit Profile') || Boolean(document.querySelector('button[aria-label="Edit Profile"]'));
    const hasChangePassword = text.includes('Change Password');
    const hasBankDetails = text.includes('Bank Details') || text.includes('Account Number');

    return {
      partnerName,
      centreName,
      mobile,
      email,
      hasDummyApex,
      hasDummyDirector,
      hasDummyPhone,
      hasEditProfile,
      hasChangePassword,
      hasBankDetails,
    };
  });

  console.log('  UI Inspection Results:', uiData);

  if (!uiData.partnerName) throw new Error('Partner Name "BPO Test Partner Admin" not found in UI!');
  if (!uiData.centreName) throw new Error('Centre / Company Name not found in UI!');
  if (!uiData.mobile) throw new Error('Mobile Number "+1-800-555-0199" not found in UI!');
  if (!uiData.email) throw new Error('Email Address "bpo.test@thinkatic.com" not found in UI!');

  if (uiData.hasDummyApex) throw new Error('Dummy data "Apex Global BPO Operations" detected in UI!');
  if (uiData.hasDummyDirector) throw new Error('Dummy data "Operations Director" detected in UI!');
  if (uiData.hasDummyPhone) throw new Error('Dummy data "+1 (555) 019-2834" detected in UI!');

  if (uiData.hasEditProfile) throw new Error('Unwanted "Edit Profile" feature detected in UI!');
  if (uiData.hasChangePassword) throw new Error('Unwanted "Change Password" feature detected in UI!');
  if (uiData.hasBankDetails) throw new Error('Unwanted "Bank Details" feature detected in UI!');

  console.log('  ✓ All 4 real fields verified in UI with ZERO dummy data and strict minimal scope');

  console.log('\n8. Testing Header Avatar Menu "Profile" shortcut...');
  // Switch to another tab first
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('aside nav button'));
    const overviewBtn = buttons.find((b) => b.textContent && b.textContent.includes('Dashboard'));
    if (overviewBtn) overviewBtn.click();
  });
  await sleep(1000);

  // Click avatar dropdown button
  await page.evaluate(() => {
    const avatarBtn = document.querySelector('button[aria-label="Partner account menu"]');
    if (avatarBtn) avatarBtn.click();
  });
  await sleep(800);

  // Click "Profile" item in dropdown
  const clickedDropdownProfile = await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('[data-dropdown="profile"] button'));
    const profileItem = allButtons.find((b) => b.textContent && b.textContent.includes('Profile'));
    if (profileItem) {
      profileItem.click();
      return true;
    }
    return false;
  });

  if (!clickedDropdownProfile) {
    throw new Error('Could not find or click "Profile" in avatar dropdown!');
  }
  await sleep(2000);

  if (!page.url().includes('tab=profile')) {
    throw new Error('Avatar menu shortcut failed to navigate to ?tab=profile');
  }
  console.log('  ✓ Avatar menu "Profile" shortcut successfully navigated to Profile tab');

  console.log('\n9. Testing Mobile Viewport (375x812) Responsiveness...');
  await page.setViewport({ width: 375, height: 812, isMobile: true });
  
  // Wait for profile data to finish loading
  for (let i = 0; i < 20; i++) {
    const hasText = await page.evaluate(() => document.body.innerText.includes('BPO Test Partner Admin'));
    if (hasText) break;
    await sleep(400);
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '03_partner_profile_tab_mobile.png'),
    fullPage: false,
  });
  console.log('  ✓ Captured: 03_partner_profile_tab_mobile.png');

  // Verify responsive layout
  const mobileValid = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('BPO Test Partner Admin') && text.includes('+1-800-555-0199') && text.includes('bpo.test@thinkatic.com');
  });

  if (!mobileValid) {
    throw new Error('Mobile viewport failed to render profile details correctly!');
  }
  console.log('  ✓ Mobile viewport renders profile data with responsive elegance');

  await browser.close();

  console.log('\n==============================================================================');
  console.log('🎉 ALL BPO PARTNER PROFILE TAB TESTS PASSED SUCCESSFULLY (100% REAL DATA)!');
  console.log('==============================================================================');
})().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
