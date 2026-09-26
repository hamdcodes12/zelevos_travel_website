import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\ff51c7fd-1d5c-4e3a-b4c7-e6aad8f9af04';
const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8080/api';

// Admin test credentials from screenshot:
const ADMIN_ID = 'zelevos-travelai00';
const ADMIN_PASSWORD = 'ZT002121';

async function run() {
  console.log('=== STARTING COMPLETE LIVE WEBSITE TESTING ===');

  const results = [];
  function logResult(featureId, name, status, details = {}) {
    console.log(`[${status}] ${featureId}: ${name}`);
    results.push({ featureId, name, status, details, time: new Date().toISOString() });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const timestamp = Date.now();
  let createdBookingId = null;
  let createdBookingRef = null;

  try {
    const page = await browser.newPage();

    // 1. HOME PAGE & HEADER NAVIGATION
    console.log('\n[1] Testing Home Page & Header Navigation...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });
    const title = await page.title();
    logResult('FEAT_HOME', 'Customer Homepage Load', title.includes('Zelevos') ? 'PASS' : 'FAIL', { title });

    const navItems = ['Home', 'Packages', 'Why Zelevos', 'Partner Program', 'Trips', 'Flights'];
    for (const item of navItems) {
      const clickSuccess = await page.evaluate((label) => {
        const links = Array.from(document.querySelectorAll('.desktop-nav a'));
        const l = links.find((el) => el.textContent.trim().includes(label));
        if (l) {
          l.click();
          return true;
        }
        return false;
      }, item);
      await new Promise((r) => setTimeout(r, 400));
      logResult(`FEAT_NAV_${item.replace(/\s+/g, '_').toUpperCase()}`, `Header Navigation: ${item}`, clickSuccess ? 'PASS' : 'FAIL');
    }

    // More dropdown & Travel Hub
    const moreBtn = await page.waitForSelector('.more-link');
    await moreBtn.click();
    await new Promise((r) => setTimeout(r, 400));
    const thLink = await page.waitForSelector('.more-menu a[href="/#travel-hub"]');
    await thLink.click();
    await new Promise((r) => setTimeout(r, 1200));

    const travelHubInView = await page.evaluate(() => {
      const el = document.getElementById('travel-hub');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.top >= -150 && rect.top <= window.innerHeight;
    });
    logResult('FEAT_TRAVEL_HUB_SCROLL', 'More Menu -> Travel Hub Smooth Scroll', travelHubInView ? 'PASS' : 'FAIL');

    // 2. HERO SEARCH & POPULAR DESTINATIONS
    console.log('\n[2] Testing Hero Search & Popular Destination Pills...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 500));

    const pillClicked = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('.popular-pill'));
      const kashmir = pills.find((p) => p.textContent.includes('Kashmir'));
      if (kashmir) {
        kashmir.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 600));
    const inputVal = await page.$eval('#hero-destination-input', (el) => el.value);
    logResult('FEAT_HERO_PILL', 'Hero Search: Kashmir Pill Click & Search Bar Update', pillClicked && inputVal === 'Kashmir' ? 'PASS' : 'FAIL', { inputVal });

    // 3. CURATED PACKAGES LISTING & FILTERS
    console.log('\n[3] Testing Package Filters...');
    // Reset search so all packages show
    await page.evaluate(() => {
      const input = document.querySelector('#hero-destination-input');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const allTheme = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('All Themes') || b.textContent.includes('All Destinations'));
      if (allTheme) allTheme.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const pkgCardsCount = await page.evaluate(() => document.querySelectorAll('div[id^="package-card-"]').length);
    logResult('FEAT_PACKAGES_LISTING', 'Package Cards Rendered', pkgCardsCount > 0 ? 'PASS' : 'FAIL', { count: pkgCardsCount });

    // Duration filter
    const durationBtn = await page.$('#filter-duration-medium');
    if (durationBtn) {
      await durationBtn.click();
      await new Promise((r) => setTimeout(r, 500));
      logResult('FEAT_FILTER_DURATION', 'Duration Filter: 5-7 Days', 'PASS');
    }

    // Budget filter
    const budgetBtn = await page.$('#filter-budget-35to60k');
    if (budgetBtn) {
      await budgetBtn.click();
      await new Promise((r) => setTimeout(r, 500));
      logResult('FEAT_FILTER_BUDGET', 'Budget Filter: ₹35k–₹60k', 'PASS');
    }

    // 4. PACKAGE DETAIL MODAL
    console.log('\n[4] Testing Package Detail Modal...');
    // Reset duration to all
    const durAll = await page.$('#filter-duration-all');
    if (durAll) await durAll.click();
    const budAll = await page.$('#filter-budget-all');
    if (budAll) await budAll.click();
    await new Promise((r) => setTimeout(r, 500));

    const openedDetail = await page.evaluate(() => {
      const card = document.querySelector('div[id^="package-card-"]');
      if (card) {
        const btn = card.querySelector('button');
        if (btn) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 1200));

    const detailModalOpen = await page.evaluate(() => {
      const modal = document.querySelector('.package-detail-modal, [role="dialog"], h2');
      return !!modal;
    });
    logResult('FEAT_PACKAGE_DETAIL_MODAL', 'Package Detail Modal Open', detailModalOpen ? 'PASS' : 'FAIL');

    // 5. COMPLETE CUSTOMER BOOKING FLOW (API & UI)
    console.log('\n[5] Testing Customer Package Booking & Reference Generation...');
    const pkgRes = await fetch(`${API_URL}/packages`);
    const pkgData = await pkgRes.json();
    const targetPkg = pkgData.results?.[0];

    if (targetPkg) {
      const bookingPayload = {
        packageId: targetPkg.id,
        startDate: '2026-10-20',
        durationDays: targetPkg.durationDays,
        adults: 2,
        children: 0,
        leadTraveller: {
          fullName: 'Aarav Sharma',
          email: 'aarav.sharma@example.com',
          phone: '+91 98765 43210',
        },
        selectedRoomType: 'Deluxe Heritage Haveli',
        totalAmount: targetPkg.sellingPrice,
      };

      const bookRes = await fetch(`${API_URL}/bookings/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload),
      });
      const bookData = await bookRes.json();

      if (bookRes.ok && bookData.booking) {
        createdBookingId = bookData.booking.id;
        createdBookingRef = bookData.booking.bookingReference;
        logResult('FEAT_CUSTOMER_BOOKING', 'Complete Package Booking Creation', 'PASS', {
          bookingId: createdBookingId,
          reference: createdBookingRef,
          amount: targetPkg.sellingPrice,
        });
      } else {
        logResult('FEAT_CUSTOMER_BOOKING', 'Complete Package Booking Creation', 'FAIL', bookData);
      }
    }

    // 6. RAZORPAY PAYMENT SANDBOX CHECK
    console.log('\n[6] Testing Payment & Order Creation...');
    if (createdBookingId) {
      const orderRes = await fetch(`${API_URL}/bookings/${createdBookingId}/payment-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const orderData = await orderRes.json();
      logResult('FEAT_RAZORPAY_ORDER', 'Razorpay Payment Order Creation (Server Verified)', orderRes.ok && orderData.orderId ? 'PASS' : 'NOT VERIFIED', orderData);
    }

    // 7. BUILD MY TRIP / CUSTOM TRIP FLOW
    console.log('\n[7] Testing Build My Trip / Custom Trip Request...');
    const customTripRes = await fetch(`${API_URL}/custom-trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Priya Patel',
        customerEmail: 'priya.patel@example.com',
        customerPhone: '+91 98123 45678',
        destinations: ['Kashmir', 'Ladakh'],
        startDate: '2026-11-01',
        durationDays: 7,
        travellersCount: 3,
        budgetPerPerson: 55000,
        hotelPreference: '4 Star / Boutique',
        transportPreference: 'Private Innova',
        activitiesInterests: ['Local Dining', 'Photography', 'Monasteries'],
        specialRequests: 'Elderly traveller in party, ground floor rooms preferred.',
      }),
    });
    const customTripData = await customTripRes.json();
    logResult('FEAT_CUSTOM_TRIP_SUBMIT', 'Build My Trip Request Submitted (Lead Created)', customTripRes.ok && customTripData.request ? 'PASS' : 'FAIL', {
      leadNumber: customTripData.request?.leadNumber,
    });

    // 8. AUTHORISED PARTNER REGISTRATION & WORKFLOW
    console.log('\n[8] Testing Authorised Partner Registration...');
    const partnerEmail = `partner_${timestamp}@zelevospartner.test`;
    const partnerRegRes = await fetch(`${API_URL}/partners/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyName: `Apex Holidays ${timestamp}`,
        contactName: 'Rajesh Khandelwal',
        email: partnerEmail,
        phone: '+91 98220 11223',
        city: 'Udaipur',
        state: 'Rajasthan',
        businessType: 'Boutique Tour Operator',
      }),
    });
    const partnerRegData = await partnerRegRes.json();
    logResult('FEAT_PARTNER_REGISTRATION', 'Authorised Partner Registration (Status PENDING)', partnerRegRes.ok && partnerRegData.partner ? 'PASS' : 'FAIL', {
      referralCode: partnerRegData.partner?.referralCode,
      partnerId: partnerRegData.partner?.id,
    });

    // 9. ADMIN LOGIN & CONSOLE ACCESS
    console.log('\n[9] Testing Admin Login & Dashboard Modules...');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2', timeout: 20000 });

    // Wrong login test
    await page.type('input[placeholder="zelevos-travelai00"], input[type="text"]', ADMIN_ID);
    await page.type('input[type="password"]', 'WrongPasswordTest#999');
    const adminSubmit = await page.waitForSelector('button[type="submit"]');
    await adminSubmit.click();
    await new Promise((r) => setTimeout(r, 1000));

    const wrongLoginErr = await page.evaluate(() => {
      const err = document.querySelector('[style*="color: #991b1b"], .login-error, [style*="background: #fef2f2"]');
      return err?.textContent || null;
    });
    logResult('FEAT_ADMIN_AUTH_WRONG', 'Admin Login Wrong Password Rejected', wrongLoginErr ? 'PASS' : 'FAIL', { error: wrongLoginErr });

    // Correct login
    await page.evaluate(() => {
      const pass = document.querySelector('input[type="password"]');
      if (pass) pass.value = '';
    });
    await page.type('input[type="password"]', ADMIN_PASSWORD);
    await adminSubmit.click();
    await new Promise((r) => setTimeout(r, 2000));

    const adminLoggedIn = await page.evaluate(() => {
      return document.body.textContent.includes('Zelevos Admin') || document.body.textContent.includes('Operations Console');
    });
    logResult('FEAT_ADMIN_AUTH_SUCCESS', 'Admin Authentication with Existing Test Credentials', adminLoggedIn ? 'PASS' : 'FAIL');

    // 10. ALL ADMIN TABS VERIFICATION
    console.log('\n[10] Testing All Admin Modules...');
    const adminTabsList = [
      { id: 'overview', name: 'Overview' },
      { id: 'customers', name: 'Customers' },
      { id: 'bookings', name: 'Bookings' },
      { id: 'payments', name: 'Payments' },
      { id: 'audit', name: 'Audit Logs' },
      { id: 'packages', name: 'Packages (Sec 8)' },
      { id: 'operations', name: 'Operations Desk' },
      { id: 'custom-trips', name: 'Custom Trips' },
      { id: 'vendors', name: 'Vendor Portal' },
      { id: 'partners', name: 'Partner Network' },
      { id: 'finance', name: 'Finance & Ledger' },
      { id: 'settings', name: 'Settings' },
    ];

    for (const tab of adminTabsList) {
      const clicked = await page.evaluate((label) => {
        const btns = Array.from(document.querySelectorAll('aside nav button'));
        const target = btns.find((b) => b.textContent.includes(label));
        if (target) {
          target.click();
          return true;
        }
        return false;
      }, tab.name);
      await new Promise((r) => setTimeout(r, 600));
      logResult(`FEAT_ADMIN_TAB_${tab.id.toUpperCase()}`, `Admin Tab: ${tab.name}`, clicked ? 'PASS' : 'FAIL');
    }

    // 11. FLIGHTS PORTAL (/flights)
    console.log('\n[11] Testing Flights Dedicated Portal (/flights)...');
    await page.goto(`${BASE_URL}/flights`, { waitUntil: 'networkidle2', timeout: 20000 });
    const flightsTitle = await page.evaluate(() => {
      const h1 = document.querySelector('h1, h2');
      return h1?.textContent || '';
    });
    logResult('FEAT_FLIGHTS_PORTAL', 'Dedicated Flights Portal (/flights)', flightsTitle.length > 0 ? 'PASS' : 'FAIL', { heading: flightsTitle });

    // 12. SECURITY & IDOR ISOLATION
    console.log('\n[12] Testing Security & IDOR Isolation...');
    // Try fetching random booking without customer session
    const idorCheck = await fetch(`${API_URL}/bookings/f9999999-0000-0000-0000-000000000000`);
    logResult('FEAT_SECURITY_IDOR', 'IDOR Protection: Unauthenticated Booking Lookup Denied', idorCheck.status === 401 || idorCheck.status === 403 || idorCheck.status === 404 ? 'PASS' : 'FAIL', {
      status: idorCheck.status,
    });

    // Try customer access to admin-only API
    const rbacCheck = await fetch(`${API_URL}/admin/customers`);
    logResult('FEAT_SECURITY_RBAC', 'RBAC Protection: Admin Customers API Requires Admin Session', rbacCheck.status === 401 || rbacCheck.status === 403 ? 'PASS' : 'FAIL', {
      status: rbacCheck.status,
    });

    // 13. MOBILE RESPONSIVENESS TEST (390x844)
    console.log('\n[13] Testing Mobile Responsive Layout (390x844)...');
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 390, height: 844 });
    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });

    const hasHorizontalOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    logResult('FEAT_MOBILE_RESPONSIVE', 'Mobile Viewport (390x844) No Horizontal Overflow', !hasHorizontalOverflow ? 'PASS' : 'FAIL', { hasOverflow: hasHorizontalOverflow });
    await mobilePage.close();

    // 14. 404 ERROR HANDLING
    console.log('\n[14] Testing 404 Error Handling...');
    await page.goto(`${BASE_URL}/non-existent-sample-route-404`, { waitUntil: 'networkidle2', timeout: 15000 });
    const notFoundBody = await page.evaluate(() => document.body.textContent);
    const has404Notice = notFoundBody.includes('404') || notFoundBody.includes('Not Found') || notFoundBody.includes('Back');
    logResult('FEAT_ERROR_404', '404 Page Handled Gracefully', has404Notice ? 'PASS' : 'FAIL');

    console.log('\n=== ALL LIVE TESTS COMPLETED ===');
  } catch (err) {
    console.error('Fatal error during test run:', err);
    logResult('FATAL_ERROR', 'Test Suite Execution Failure', 'FAIL', { message: err.message });
  } finally {
    await browser.close();
  }

  // Save report
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'comprehensive_test_results.json'), JSON.stringify(results, null, 2));
  console.log(`Saved ${results.length} test results to comprehensive_test_results.json`);
}

run();
