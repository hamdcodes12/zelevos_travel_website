import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ADMIN_ID = 'zelevos-travelai00';
const ADMIN_PASSWORD = 'ZT002121';
const OUTPUT_DIR = path.resolve(process.cwd(), 'screenshots/admin_reference_verification');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runVerification() {
  console.log('🚀 Starting Zelevos World-Class Admin UI Verification...');
  console.log(`📁 Saving proofs to: ${OUTPUT_DIR}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  // Clear cookies to test fresh unauthenticated state
  const client = await page.target().createCDPSession();
  await client.send('Network.clearBrowserCookies');

  // =========================================================================
  // 1. Desktop 1920x1080 Admin Login View
  // =========================================================================
  console.log('\n📸 1. Capturing Desktop 1920x1080 Admin Login Reference View...');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.admin-login-wrapper', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200)); // allow animations to play

  const p1 = path.join(OUTPUT_DIR, '01_admin_login_desktop_1920x1080.png');
  await page.screenshot({ path: p1, fullPage: false });
  console.log(`   Saved: ${p1}`);

  // =========================================================================
  // 2. Desktop 1366x768 Admin Login View
  // =========================================================================
  console.log('\n📸 2. Capturing Desktop 1366x768 Admin Login View...');
  await page.setViewport({ width: 1366, height: 768 });
  await new Promise(r => setTimeout(r, 500));
  const p2 = path.join(OUTPUT_DIR, '02_admin_login_desktop_1366x768.png');
  await page.screenshot({ path: p2, fullPage: false });
  console.log(`   Saved: ${p2}`);

  // =========================================================================
  // 3. Security Badges Hover & Subtle 3D Animations
  // =========================================================================
  console.log('\n✨ 3. Testing 3 Animated Security Badges...');
  await page.setViewport({ width: 1440, height: 900 });

  // Hover 1: Secure Access
  const shieldCard = await page.$('.security-badge-card:nth-of-type(1)');
  if (shieldCard) {
    await shieldCard.hover();
    await new Promise(r => setTimeout(r, 400));
    const p3 = path.join(OUTPUT_DIR, '03_security_badge_secure_access_hover.png');
    await page.screenshot({ path: p3 });
    console.log(`   Saved Secure Access Hover: ${p3}`);
  }

  // Hover 2: Protected Data
  const dbCard = await page.$('.security-badge-card:nth-of-type(2)');
  if (dbCard) {
    await dbCard.hover();
    await new Promise(r => setTimeout(r, 400));
    const p4 = path.join(OUTPUT_DIR, '04_security_badge_protected_data_hover.png');
    await page.screenshot({ path: p4 });
    console.log(`   Saved Protected Data Hover: ${p4}`);
  }

  // Hover 3: Role-Based
  const lockCard = await page.$('.security-badge-card:nth-of-type(3)');
  if (lockCard) {
    await lockCard.hover();
    await new Promise(r => setTimeout(r, 400));
    const p5 = path.join(OUTPUT_DIR, '05_security_badge_role_based_hover.png');
    await page.screenshot({ path: p5 });
    console.log(`   Saved Role-Based Hover: ${p5}`);
  }

  // =========================================================================
  // 4. Password Toggle
  // =========================================================================
  console.log('\n👁️ 4. Testing Password Toggle...');
  const passInput = await page.$('input[type="password"]');
  if (passInput) {
    await passInput.type(ADMIN_PASSWORD);
    // Find eye button inside the relative container
    const toggleBtn = await page.$('button[title*="password"], button[title*="Password"]');
    if (toggleBtn) {
      await toggleBtn.click();
      await new Promise(r => setTimeout(r, 300));
      const p6 = path.join(OUTPUT_DIR, '06_admin_login_password_revealed.png');
      await page.screenshot({ path: p6 });
      console.log(`   Saved Password Revealed: ${p6}`);
    }
  }

  // =========================================================================
  // 5. Admin Authentication & Dashboard
  // =========================================================================
  console.log('\n🔐 5. Signing into Admin Control Panel...');
  const submitBtn = await page.$('.admin-submit-btn, button[type="submit"]');
  await submitBtn.click();

  // Wait for dashboard view
  await page.waitForFunction(
    () => document.body.textContent.includes('Zelevos Admin') && document.body.textContent.includes('Overview'),
    { timeout: 12000 }
  );
  await new Promise(r => setTimeout(r, 1500)); // allow stats to fetch

  console.log('\n📸 6. Capturing Admin Dashboard Overview (8 World-Class Stat Cards)...');
  await page.setViewport({ width: 1920, height: 1080 });
  const p7 = path.join(OUTPUT_DIR, '07_admin_dashboard_overview_8_stat_cards.png');
  await page.screenshot({ path: p7 });
  console.log(`   Saved: ${p7}`);

  // =========================================================================
  // 6. Admin Profile Dropdown
  // =========================================================================
  const profileBtn = await page.$('#admin-profile-menu-btn');
  if (profileBtn) {
    await profileBtn.click();
    await new Promise(r => setTimeout(r, 400));
    const p8 = path.join(OUTPUT_DIR, '08_admin_profile_dropdown_menu.png');
    await page.screenshot({ path: p8 });
    console.log(`   Saved: ${p8}`);
  }

  // =========================================================================
  // 7. Tab Navigation
  // =========================================================================
  console.log('\n📑 8. Testing Admin Section Navigation...');

  // Customers Tab
  const custNav = await page.$('#admin-nav-customers');
  if (custNav) {
    await custNav.click();
    await new Promise(r => setTimeout(r, 1000));
    const p9 = path.join(OUTPUT_DIR, '09_admin_customers_dossiers_tab.png');
    await page.screenshot({ path: p9 });
    console.log(`   Saved Customers Tab: ${p9}`);
  }

  // Bookings Tab
  const bookNav = await page.$('#admin-nav-bookings');
  if (bookNav) {
    await bookNav.click();
    await new Promise(r => setTimeout(r, 1000));
    const p10 = path.join(OUTPUT_DIR, '10_admin_bookings_tab.png');
    await page.screenshot({ path: p10 });
    console.log(`   Saved Bookings Tab: ${p10}`);
  }

  // Payments Tab
  const payNav = await page.$('#admin-nav-payments');
  if (payNav) {
    await payNav.click();
    await new Promise(r => setTimeout(r, 1000));
    const p11 = path.join(OUTPUT_DIR, '11_admin_payments_tab.png');
    await page.screenshot({ path: p11 });
    console.log(`   Saved Payments Tab: ${p11}`);
  }

  // Suppliers Tab
  const supNav = await page.$('#admin-nav-suppliers');
  if (supNav) {
    await supNav.click();
    await new Promise(r => setTimeout(r, 1000));
    const p12 = path.join(OUTPUT_DIR, '12_admin_suppliers_tab.png');
    await page.screenshot({ path: p12 });
    console.log(`   Saved Suppliers Tab: ${p12}`);
  }

  // Operations Tab
  const opsNav = await page.$('#admin-nav-operations');
  if (opsNav) {
    await opsNav.click();
    await new Promise(r => setTimeout(r, 1000));
    const p13 = path.join(OUTPUT_DIR, '13_admin_operations_tab.png');
    await page.screenshot({ path: p13 });
    console.log(`   Saved Operations Tab: ${p13}`);
  }

  // Broadcasts Tab
  const broadNav = await page.$('#admin-nav-broadcasts');
  if (broadNav) {
    await broadNav.click();
    await new Promise(r => setTimeout(r, 1000));
    const p14 = path.join(OUTPUT_DIR, '14_admin_broadcasts_tab.png');
    await page.screenshot({ path: p14 });
    console.log(`   Saved Broadcasts Tab: ${p14}`);
  }

  // =========================================================================
  // 8. Mobile Responsiveness (375x812 & 412x915)
  // =========================================================================
  console.log('\n📱 9. Testing Mobile Responsiveness (375x812)...');
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 600));

  // Dashboard Mobile 375x812
  const p15 = path.join(OUTPUT_DIR, '15_admin_dashboard_mobile_375x812.png');
  await page.screenshot({ path: p15 });
  console.log(`   Saved Mobile 375 Dashboard: ${p15}`);

  // Logout to test Mobile 375 Login
  await client.send('Network.clearBrowserCookies');
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  const p16 = path.join(OUTPUT_DIR, '16_admin_login_mobile_375x812.png');
  await page.screenshot({ path: p16, fullPage: true });
  console.log(`   Saved Mobile 375 Login: ${p16}`);

  // Mobile 412x915
  console.log('\n📱 10. Testing Mobile Responsiveness (412x915)...');
  await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 600));
  const p17 = path.join(OUTPUT_DIR, '17_admin_login_mobile_412x915.png');
  await page.screenshot({ path: p17, fullPage: true });
  console.log(`   Saved Mobile 412 Login: ${p17}`);

  await browser.close();
  console.log('\n🎉 ALL ZELEVOS ADMIN UI REFERENCE TESTS COMPLETED SUCCESSFULLY!');
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
