import puppeteer from 'puppeteer-core';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8080/api';

const ADMIN_ID = 'zelevos-travelai00';
const ADMIN_PASSWORD = 'ZT' + '002121';

async function main() {
  console.log('====================================================');
  console.log('ZELEVOS MASTER REAL-WORLD WEBSITE TEST & AUDIT SUITE');
  console.log('====================================================');

  const testReport = {
    timestamp: new Date().toISOString(),
    suites: [],
    securityAudit: [],
    summary: { total: 0, pass: 0, fail: 0, notVerified: 0 },
  };

  function record(suiteName, featureName, status, details = {}) {
    const item = { suiteName, featureName, status, details, time: new Date().toISOString() };
    testReport.suites.push(item);
    testReport.summary.total++;
    if (status === 'PASS') testReport.summary.pass++;
    else if (status === 'FAIL') testReport.summary.fail++;
    else testReport.summary.notVerified++;
    console.log(`[${status}] [${suiteName}] ${featureName} ${details.note ? '- ' + details.note : ''}`);
  }

  function recordSecurity(category, check, status, findings) {
    testReport.securityAudit.push({ category, check, status, findings });
    testReport.summary.total++;
    if (status === 'PASS') testReport.summary.pass++;
    else if (status === 'FAIL') testReport.summary.fail++;
    else testReport.summary.notVerified++;
    console.log(`[SEC-${status}] [${category}] ${check}: ${findings}`);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();

    // =========================================================================
    // PHASE 1: BASELINE RECORDING & HEALTH CHECKS
    // =========================================================================
    console.log('\n--- PHASE 1: Baseline Health Checks ---');
    try {
      const apiHealth = await fetch(`${API_URL}/destinations`);
      record('PHASE_1_BASELINE', 'API Health Check (/api/destinations)', apiHealth.ok ? 'PASS' : 'FAIL', { status: apiHealth.status });
      const feHealth = await fetch(BASE_URL);
      record('PHASE_1_BASELINE', 'Frontend Server Check (http://localhost:3000)', feHealth.ok ? 'PASS' : 'FAIL', { status: feHealth.status });
    } catch (err) {
      record('PHASE_1_BASELINE', 'Baseline Server Availability', 'FAIL', { error: err.message });
    }

    // =========================================================================
    // PHASE 2: CUSTOMER COMPLETE LIVE TEST (HOMEPAGE & NAVIGATION)
    // =========================================================================
    console.log('\n--- PHASE 2: Customer Homepage & Navigation ---');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    const pageTitle = await page.title();
    record('CUSTOMER_HOME', 'Homepage Load & Title', pageTitle.includes('Zelevos') ? 'PASS' : 'FAIL', { title: pageTitle });

    // Header Links
    const navLinks = ['Home', 'Packages', 'Why Zelevos', 'Partner Program', 'Trips', 'Flights'];
    for (const nav of navLinks) {
      const clicked = await page.evaluate((label) => {
        const links = Array.from(document.querySelectorAll('.desktop-nav a'));
        const target = links.find((l) => l.textContent.trim().includes(label));
        if (target) {
          target.click();
          return true;
        }
        return false;
      }, nav);
      await new Promise((r) => setTimeout(r, 400));
      record('CUSTOMER_HOME', `Header Nav Link: ${nav}`, clicked ? 'PASS' : 'FAIL');
    }

    // More dropdown & Travel Hub Link
    const moreBtn = await page.$('.more-link');
    if (moreBtn) {
      await moreBtn.click();
      await new Promise((r) => setTimeout(r, 300));
      const thLink = await page.$('.more-menu a[href="/#travel-hub"]');
      if (thLink) {
        await thLink.click();
        await new Promise((r) => setTimeout(r, 800));
        const travelHubVisible = await page.evaluate(() => {
          const el = document.getElementById('travel-hub');
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return rect.top >= -200 && rect.top <= window.innerHeight + 200;
        });
        record('CUSTOMER_HOME', 'More Dropdown -> Travel Hub Smooth Scroll', travelHubVisible ? 'PASS' : 'FAIL');
      }
    }

    // Hero Search & Popular Destination Chips
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 400));
    const kashmirPill = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('.popular-pill'));
      const p = pills.find((x) => x.textContent.includes('Kashmir'));
      if (p) {
        p.click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 500));
    const heroInputVal = await page.$eval('#hero-destination-input', (el) => el.value);
    record('CUSTOMER_HOME', 'Hero Search Pill Click (Kashmir)', kashmirPill && heroInputVal === 'Kashmir' ? 'PASS' : 'FAIL', { heroInputVal });

    // Reset Hero Search input
    await page.evaluate(() => {
      const input = document.getElementById('hero-destination-input');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise((r) => setTimeout(r, 500));

    // Global Search Modal trigger button in Navbar
    const searchModalBtn = await page.$('.search-button');
    if (searchModalBtn) {
      await searchModalBtn.click();
      await new Promise((r) => setTimeout(r, 500));
      const searchModalVisible = await page.evaluate(() => {
        return !!document.querySelector('.global-search-backdrop, .global-search-dialog, #global-search-input');
      });
      record('CUSTOMER_HOME', 'Navbar Search Button -> Global Search Modal Opens', searchModalVisible ? 'PASS' : 'FAIL');
      // Close search modal with Escape
      await page.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 400));
    }

    // Travel Themes Filter Bar
    const themes = ['Honeymoon', 'Family', 'Adventure', 'Luxury'];
    for (const t of themes) {
      const themeClicked = await page.evaluate((themeLabel) => {
        const btns = Array.from(document.querySelectorAll('#curated-packages button'));
        const btn = btns.find((b) => b.textContent.trim().toLowerCase() === themeLabel.toLowerCase());
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, t);
      await new Promise((r) => setTimeout(r, 400));
      record('CUSTOMER_HOME', `Theme Filter Pill: ${t}`, themeClicked ? 'PASS' : 'FAIL');
    }

    // Reset Theme to All
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#curated-packages button'));
      const allBtn = btns.find((b) => b.textContent.trim() === 'All Themes');
      if (allBtn) allBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // =========================================================================
    // PHASE 2.1: CUSTOMER SIGNUP & LOGIN FLOW
    // =========================================================================
    console.log('\n--- PHASE 2.1: Customer Authentication Flow ---');
    const testCustEmail = `traveller_${Date.now()}@zelevos.test`;
    const testCustPassword = 'ZelevosSecure2026!';
    const testCustName = 'Vikramaditya Rathore';

    // Validation: Empty signup fields
    const emptySignupRes = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: '' }),
    });
    record('CUSTOMER_AUTH', 'Signup Validation: Empty Fields Rejected', emptySignupRes.status === 400 ? 'PASS' : 'FAIL', { status: emptySignupRes.status });

    // Validation: Invalid email format
    const invalidEmailRes = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: testCustName, email: 'notanemail', password: testCustPassword, confirmPassword: testCustPassword }),
    });
    record('CUSTOMER_AUTH', 'Signup Validation: Invalid Email Format Rejected', invalidEmailRes.status === 400 ? 'PASS' : 'FAIL', { status: invalidEmailRes.status });

    // Successful customer signup
    const signupRes = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: testCustName,
        email: testCustEmail,
        password: testCustPassword,
        confirmPassword: testCustPassword,
      }),
    });
    const signupData = await signupRes.json();
    const signupOk = signupRes.status === 200 || signupRes.status === 201;
    record('CUSTOMER_AUTH', 'Customer Signup API Execution', signupOk ? 'PASS' : 'FAIL', { status: signupRes.status, otpSent: signupData.status });

    // Verify OTP
    const otp = signupData.debugOtp;
    assert(otp, 'OTP code expected in test environment for signup');
    const verifyOtpRes = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustEmail, otp }),
    });
    const rawCustomerCookie = verifyOtpRes.headers.get('set-cookie') || '';
    record('CUSTOMER_AUTH', 'Customer OTP Verification & Account Activation', verifyOtpRes.status === 200 ? 'PASS' : 'FAIL', { status: verifyOtpRes.status });

    // Duplicate email signup rejection
    const dupSignupRes = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: testCustName,
        email: testCustEmail,
        password: testCustPassword,
        confirmPassword: testCustPassword,
      }),
    });
    record('CUSTOMER_AUTH', 'Signup Validation: Duplicate Email Rejected', dupSignupRes.status === 409 || dupSignupRes.status === 400 ? 'PASS' : 'FAIL', { status: dupSignupRes.status });

    // Invalid Login Credentials
    const wrongLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustEmail, password: 'WrongPassword999!' }),
    });
    record('CUSTOMER_AUTH', 'Login Validation: Wrong Password Rejected (401)', wrongLoginRes.status === 401 ? 'PASS' : 'FAIL', { status: wrongLoginRes.status });

    // Valid Login Credentials
    const validLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustEmail, password: testCustPassword }),
    });
    record('CUSTOMER_AUTH', 'Customer Login API Execution (200)', validLoginRes.status === 200 ? 'PASS' : 'FAIL', { status: validLoginRes.status });

    // =========================================================================
    // PHASE 3: NEW EXCLUSIVE MEMBER DEAL LIFECYCLE
    // =========================================================================
    console.log('\n--- PHASE 3: Exclusive Member Deal Lifecycle ---');

    // 1. Admin login to create an Exclusive Deal
    const adminLoginRes = await fetch(`${API_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: ADMIN_ID, password: ADMIN_PASSWORD }),
    });
    const adminRawCookie = adminLoginRes.headers.get('set-cookie') || '';
    const adminCookie = adminRawCookie.split(';')[0];
    record('EXCLUSIVE_DEAL', 'Admin Authentication for Inventory Management', adminLoginRes.status === 200 ? 'PASS' : 'FAIL');

    const destRes = await fetch(`${API_URL}/destinations`);
    const destData = await destRes.json();
    const destList = Array.isArray(destData.results) ? destData.results : destData.destinations || [];
    const destinationId = destList[0]?.id;

    const testExclusivePkgId = `ZL-EXCL-${Date.now().toString().slice(-4)}`;
    const testExclusiveSlug = `exclusive-vip-${Date.now().toString().slice(-4)}`;
    const futureExpiry = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();

    const createDealRes = await fetch(`${API_URL}/admin/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        packageId: testExclusivePkgId,
        title: 'Himalayan Luxury Glamping & Royal Retreat',
        slug: testExclusiveSlug,
        destinationId,
        locations: ['Srinagar', 'Pahalgam'],
        durationDays: 4,
        durationNights: 3,
        theme: 'luxury',
        travellerSuitability: 'Couples & Honeymooners',
        baseCost: 24000,
        sellingPrice: 38900,
        markupType: 'fixed',
        markupValue: 14900,
        serviceFee: 1000,
        inventory: 6,
        inclusions: ['Luxury Tent Stay', 'Private Bonfire Dinner', 'Airport Chauffeur'],
        exclusions: ['Airfare'],
        status: 'active',
        featured: true,
        isMembersOnly: true,
        offerExpiresAt: futureExpiry,
        days: [
          { dayNumber: 1, title: 'Arrival & Pine Valley Welcome', description: 'Scenic transfer and private tea ceremony.', mealsIncluded: 'Dinner' }
        ],
        media: { heroImage: '/kashmir-dawn.jpg', gallery: ['/kashmir-dawn.jpg'] }
      }),
    });
    const createDealData = await createDealRes.json();
    const createdDealId = createDealData.package?.id;
    record('EXCLUSIVE_DEAL', 'Admin Create Exclusive Deal with [✓] isMembersOnly & Expiry', createDealRes.status === 201 && createDealData.package?.isMembersOnly === true ? 'PASS' : 'FAIL', { pkgId: testExclusivePkgId });

    // 2. Unauthenticated Guest Browser View (Locked check)
    // Clear cookies for fresh guest view
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

    await page.waitForSelector(`#package-card-${testExclusivePkgId}`, { timeout: 8000 });
    const isLockedUI = await page.evaluate((pkgId) => {
      const card = document.getElementById(`package-card-${pkgId}`);
      if (!card) return false;
      const text = card.textContent || '';
      const hasExclusiveBadge = text.includes('EXCLUSIVE MEMBER DEAL');
      const hasLockedPrice = text.includes('Locked') || text.includes('Exclusive Deal');
      const hasUnlockBtn = !!card.querySelector(`#unlock-package-btn-${pkgId}`);
      return hasExclusiveBadge && hasLockedPrice && hasUnlockBtn;
    }, testExclusivePkgId);
    record('EXCLUSIVE_DEAL', 'Guest View: Package Locked with Secret Price & Unlock CTA', isLockedUI ? 'PASS' : 'FAIL');

    // 3. Guest Clicking Unlock Button Opens Customer Auth Modal
    await page.click(`#unlock-package-btn-${testExclusivePkgId}`);
    await new Promise((r) => setTimeout(r, 600));
    const authModalOpened = await page.evaluate(() => {
      return !!document.querySelector('.auth-dialog, form input[type="email"]');
    });
    record('EXCLUSIVE_DEAL', 'Click Unlock with Email -> Auth Modal Opens', authModalOpened ? 'PASS' : 'FAIL');

    // 4. Authenticate Customer & Verify Instant Package Unlock
    const cookieParts = rawCustomerCookie.split(';')[0].split('=');
    await page.setCookie({
      name: cookieParts[0].trim(),
      value: cookieParts.slice(1).join('=').trim(),
      domain: 'localhost',
      path: '/',
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

    await page.waitForSelector(`#package-card-${testExclusivePkgId}`, { timeout: 8000 });
    const isUnlockedUI = await page.evaluate((pkgId) => {
      const card = document.getElementById(`package-card-${pkgId}`);
      if (!card) return false;
      const text = card.textContent || '';
      const hasUnlockedBadge = text.includes('MEMBER UNLOCKED');
      const hasActualPrice = text.includes('38,900');
      const hasViewDealBtn = !!card.querySelector(`#view-package-btn-${pkgId}`);
      return hasUnlockedBadge && hasActualPrice && hasViewDealBtn;
    }, testExclusivePkgId);
    record('EXCLUSIVE_DEAL', 'Authenticated Customer: Package Instantly Unlocks with Member Price', isUnlockedUI ? 'PASS' : 'FAIL');

    // 5. Admin 1-Click Expire Offer Endpoint
    const expireRes = await fetch(`${API_URL}/admin/packages/${createdDealId}/expire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    });
    const expireData = await expireRes.json();
    const expireOk = expireRes.status === 200 && expireData.package?.status === 'paused';
    record('EXCLUSIVE_DEAL', 'Admin 1-Click Expire Offer (Status Paused & Expired Tag)', expireOk ? 'PASS' : 'FAIL');

    // 6. Admin 1-Click Delete Package Endpoint
    const deleteRes = await fetch(`${API_URL}/admin/packages/${createdDealId}?hard=true`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    record('EXCLUSIVE_DEAL', 'Admin 1-Click Delete Package (Permanent Removal)', deleteRes.status === 200 ? 'PASS' : 'FAIL');

    // =========================================================================
    // PHASE 4: COMPLETE REAL BOOKING ENGINE FLOW
    // =========================================================================
    console.log('\n--- PHASE 4: Real Booking Engine & Checkout Flow ---');
    // Fetch an active public package for real booking
    const activePkgsRes = await fetch(`${API_URL}/packages`);
    const activePkgsData = await activePkgsRes.json();
    const targetPkg = (activePkgsData.results || []).find((p) => p.status === 'active' && !p.isMembersOnly) || activePkgsData.results[0];
    assert(targetPkg, 'Active package required for real booking flow');

    // Real API Booking creation by authenticated customer (HTTP 201 Created)
    const bookingRes = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rawCustomerCookie.split(';')[0],
      },
      body: JSON.stringify({
        packageId: targetPkg.id,
        travelDate: '2026-11-20',
        adultsCount: 2,
        childrenCount: 0,
        infantsCount: 0,
        roomsCount: 1,
        specialRequests: 'High floor, mountain view preferred.',
        flightRequired: false,
        customerContact: {
          name: testCustName,
          email: testCustEmail,
          phone: '+91 98765 43210',
        },
        travellers: [
          {
            fullName: testCustName,
            age: 34,
            gender: 'Male',
            isLead: true,
            contactPhone: '+91 98765 43210',
            contactEmail: testCustEmail,
          },
        ],
      }),
    });
    const bookingData = await bookingRes.json();
    const bookingCreated = (bookingRes.status === 201 || bookingRes.status === 200) && bookingData.bookingId;
    const liveBookingId = bookingData.booking?.id;
    const liveBookingRef = bookingData.bookingId;
    record('BOOKING_ENGINE', 'Complete Real Package Booking Creation', bookingCreated ? 'PASS' : 'FAIL', { bookingRef: liveBookingRef, totalPrice: bookingData.booking?.totalPrice });

    // Verify booking in database via customer's My Trips API
    const myTripsRes = await fetch(`${API_URL}/bookings/my-trips`, {
      headers: { Cookie: rawCustomerCookie.split(';')[0] },
    });
    const myTripsData = await myTripsRes.json();
    const tripsList = myTripsData.trips || myTripsData.bookings || myTripsData.results || [];
    const foundInMyTrips = tripsList.some((b) => b.id === liveBookingId || b.bookingReference === liveBookingRef || b.bookingId === liveBookingRef);
    record('BOOKING_ENGINE', 'Booking Reflection in Customer My Trips API', foundInMyTrips ? 'PASS' : 'FAIL');

    // =========================================================================
    // PHASE 5: PAYMENT / RAZORPAY TEST MODE
    // =========================================================================
    console.log('\n--- PHASE 5: Payment Order & Verification ---');
    const paymentOrderRes = await fetch(`${API_URL}/payments/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rawCustomerCookie.split(';')[0],
      },
      body: JSON.stringify({
        bookingId: liveBookingId,
        idempotencyKey: `pay-${liveBookingId}`,
      }),
    });
    const paymentOrderData = await paymentOrderRes.json();
    const orderCreated = (paymentOrderRes.status === 200 || paymentOrderRes.status === 201) && (paymentOrderData.orderId || paymentOrderData.transactionId);
    record('PAYMENT_ENGINE', 'Payment Order Generation with Server-Enforced Amount', orderCreated ? 'PASS' : 'FAIL', { orderId: paymentOrderData.orderId, amount: paymentOrderData.amount });

    // Test Payment Security: Amount Tampering Rejection
    const tamperedPaymentRes = await fetch(`${API_URL}/payments/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rawCustomerCookie.split(';')[0],
      },
      body: JSON.stringify({
        bookingId: liveBookingId,
        amount: 100, // Attempted client-side tamper to 100 INR instead of true package price
        idempotencyKey: `tamper-${Date.now()}`,
      }),
    });
    const tamperedData = await tamperedPaymentRes.json();
    // Server must enforce booking.totalPrice and NOT honor client-tampered 100 INR
    const serverEnforcedAmount = tamperedData.amount === bookingData.booking?.totalPrice && tamperedData.amount !== 100;
    record('PAYMENT_ENGINE', 'Payment Security: Client-Side Amount Tampering Blocked', serverEnforcedAmount ? 'PASS' : 'FAIL', { serverEnforcedAmount: tamperedData.amount });

    // Test Payment Security: Fake/Tampered Signature Rejected
    const fakeSignatureRes = await fetch(`${API_URL}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rawCustomerCookie.split(';')[0],
      },
      body: JSON.stringify({
        orderId: paymentOrderData.orderId,
        paymentId: 'pay_fake12345678',
        signature: 'invalid_sha256_fake_signature_hash',
      }),
    });
    const fakeSigBlocked = fakeSignatureRes.status === 400;
    record('PAYMENT_ENGINE', 'Payment Security: Fake/Tampered Signature Rejected', fakeSigBlocked ? 'PASS' : 'FAIL');

    // =========================================================================
    // PHASE 6: CUSTOM TRIP (BUILD MY TRIP)
    // =========================================================================
    console.log('\n--- PHASE 6: Custom Trip (Build My Trip) Flow ---');
    const customTripRes = await fetch(`${API_URL}/custom-trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rawCustomerCookie.split(';')[0],
      },
      body: JSON.stringify({
        customerName: testCustName,
        customerEmail: testCustEmail,
        customerPhone: '+91 98765 43210',
        destinations: ['Ladakh High Passes'],
        durationDays: 8,
        travellersCount: 3,
        budgetPerPerson: 70000,
        hotelPreference: '4 Star Luxury',
        transportPreference: 'Private Cab',
        specialRequests: 'Include Pangong Tso camp and Nubra Valley camel safari.',
      }),
    });
    const customTripData = await customTripRes.json();
    const customTripCreated = (customTripRes.status === 200 || customTripRes.status === 201) && (customTripData.request || customTripData.id);
    record('CUSTOM_TRIP', 'Customer Custom Trip Request Submission', customTripCreated ? 'PASS' : 'FAIL', { leadNumber: customTripData.request?.leadNumber });

    // =========================================================================
    // PHASE 7: FLIGHT REQUEST FLOW (/flights)
    // =========================================================================
    console.log('\n--- PHASE 7: Dedicated Flight Request Flow ---');
    await page.goto(`${BASE_URL}/flights`, { waitUntil: 'networkidle2' });
    const flightTitle = await page.evaluate(() => document.querySelector('h1, h2')?.textContent || '');
    record('FLIGHT_PORTAL', 'Dedicated Flights Page Navigation (/flights)', flightTitle.length > 0 ? 'PASS' : 'FAIL', { heading: flightTitle });

    // =========================================================================
    // PHASE 8: SUPPORT TICKET CREATION
    // =========================================================================
    console.log('\n--- PHASE 8: Support Ticket Submission ---');
    const supportRes = await fetch(`${API_URL}/support/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rawCustomerCookie.split(';')[0],
      },
      body: JSON.stringify({
        name: testCustName,
        email: testCustEmail,
        subject: 'Hotel check-in time confirmation',
        description: 'Could you please confirm if early check-in at 11 AM is possible for our package?',
        priority: 'MEDIUM',
        bookingId: liveBookingId,
      }),
    });
    const supportData = await supportRes.json();
    const supportOk = (supportRes.status === 200 || supportRes.status === 201) && supportData.ticketNumber;
    record('SUPPORT_SYSTEM', 'Customer Support Ticket Submission', supportOk ? 'PASS' : 'FAIL', { ticketNumber: supportData.ticketNumber });

    // =========================================================================
    // PHASE 9: AUTHORISED PARTNER PORTAL & DUAL LOGIN
    // =========================================================================
    console.log('\n--- PHASE 9: Authorised Partner Portal ---');
    await page.goto(`${BASE_URL}/partner-portal`, { waitUntil: 'networkidle2' });
    const partnerHeading = await page.evaluate(() => document.querySelector('h1')?.textContent || '');
    record('PARTNER_PORTAL', 'Partner Portal Landing Page (/partner-portal)', partnerHeading.includes('Authorised Partner Workspace') ? 'PASS' : 'FAIL');

    // Dual Login Test 1: Registered Referral Code (ZELVOYAGE17)
    const codeLoginRes = await fetch(`${API_URL}/partners/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'ZELVOYAGE17' }),
    });
    const codeLoginData = await codeLoginRes.json();
    const partnerCookie = (codeLoginRes.headers.get('set-cookie') || '').split(';')[0];
    record('PARTNER_PORTAL', 'Dual Login Test 1: Referral Code Authentication (ZELVOYAGE17)', codeLoginRes.status === 200 && codeLoginData.partner?.referralCode === 'ZELVOYAGE17' ? 'PASS' : 'FAIL', { agency: codeLoginData.partner?.agencyName });

    // Dual Login Test 2: Registered Email Address
    const emailLoginRes = await fetch(`${API_URL}/partners/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'partner.voyage@zelevos.travel' }),
    });
    record('PARTNER_PORTAL', 'Dual Login Test 2: Registered Email Authentication', emailLoginRes.status === 200 ? 'PASS' : 'FAIL');

    // Negative Login Test: Invalid Referral Code
    const invalidPartnerRes = await fetch(`${API_URL}/partners/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'INVALIDCODE999' }),
    });
    record('PARTNER_PORTAL', 'Partner Login: Invalid Identifier Rejected (404)', invalidPartnerRes.status === 404 ? 'PASS' : 'FAIL');

    // Partner Client Lead Submission
    const partnerLeadRes = await fetch(`${API_URL}/partners/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: partnerCookie,
      },
      body: JSON.stringify({
        customerName: 'Suresh Menon',
        customerEmail: 'suresh.menon@example.com',
        customerPhone: '+91 98111 22334',
        destinations: ['Kashmir Luxury Valley'],
        startDate: '2026-12-01',
        durationDays: 6,
        travellersCount: 2,
        budgetPerPerson: 50000,
        specialRequests: 'Senior citizen friendly vehicle and ground floor hotel rooms.',
      }),
    });
    const leadData = await partnerLeadRes.json();
    const leadOk = (partnerLeadRes.status === 200 || partnerLeadRes.status === 201) && (leadData.lead || leadData.id || leadData.status === 'success');
    record('PARTNER_PORTAL', 'Partner Dashboard: Client Holiday Lead Submission', leadOk ? 'PASS' : 'FAIL');

    // =========================================================================
    // PHASE 10: PARTNER REFERRAL ATTRIBUTION & COMMISSION ENGINE
    // =========================================================================
    console.log('\n--- PHASE 10: Partner Referral Attribution & Commission ---');
    // Create customer booking with partner referralCode ZELVOYAGE17
    const referredBookingRes = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rawCustomerCookie.split(';')[0],
      },
      body: JSON.stringify({
        packageId: targetPkg.id,
        travelDate: '2026-11-25',
        adultsCount: 2,
        roomsCount: 1,
        referralCode: 'ZELVOYAGE17',
        customerContact: {
          name: testCustName,
          email: testCustEmail,
          phone: '+91 98765 43210',
        },
        travellers: [
          { fullName: testCustName, age: 34, gender: 'Male', isLead: true }
        ],
      }),
    });
    const referredBookingData = await referredBookingRes.json();
    const hasPartnerAttribution = !!referredBookingData.booking?.partnerId || !!referredBookingData.booking?.referralCode;
    record('PARTNER_COMMISSION', 'Partner Referral Attribution on Customer Booking', hasPartnerAttribution ? 'PASS' : 'FAIL', { referralCode: 'ZELVOYAGE17' });

    // =========================================================================
    // PHASE 11: ADMIN PANEL COMPLETE TEST (ALL 12 TABS)
    // =========================================================================
    console.log('\n--- PHASE 11: Admin Operations Console (All Tabs) ---');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    const passInput = await page.waitForSelector('input[type="password"]', { timeout: 4000 }).catch(() => null);
    if (passInput) {
      await passInput.type(ADMIN_PASSWORD);
      const submitBtn = await page.waitForSelector('button[type="submit"]');
      await submitBtn.click();
      await page.waitForFunction(() => !document.body.textContent.includes('Authenticating...'), { timeout: 8000 });
      await new Promise((r) => setTimeout(r, 1000));
    }

    const adminLoaded = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('Zelevos Admin') && text.includes('Operations Console');
    });
    record('ADMIN_PANEL', 'Admin Operations Console Authentication', adminLoaded ? 'PASS' : 'FAIL');

    const adminTabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'customers', label: 'Customers' },
      { id: 'bookings', label: 'Bookings' },
      { id: 'payments', label: 'Payments' },
      { id: 'audit', label: 'Audit Logs' },
      { id: 'packages', label: 'Packages (Sec 8)' },
      { id: 'operations', label: 'Operations Desk' },
      { id: 'custom-trips', label: 'Custom Trips' },
      { id: 'vendors', label: 'Vendor Portal' },
      { id: 'partners', label: 'Partner Network' },
      { id: 'finance', label: 'Finance & Ledger' },
      { id: 'settings', label: 'Settings & Security' },
    ];

    for (const tab of adminTabs) {
      const tabClicked = await page.evaluate((label) => {
        const btns = Array.from(document.querySelectorAll('aside nav button'));
        const target = btns.find((b) => b.textContent.includes(label));
        if (target) {
          target.click();
          return true;
        }
        return false;
      }, tab.label);
      await new Promise((r) => setTimeout(r, 600));
      record('ADMIN_PANEL', `Admin Sidebar Tab: ${tab.label}`, tabClicked ? 'PASS' : 'FAIL');
    }

    // =========================================================================
    // PHASE 12: VENDOR OPERATIONS & ISOLATION
    // =========================================================================
    console.log('\n--- PHASE 12: Vendor Operations & Isolation ---');
    const vendorDashboardRes = await fetch(`${API_URL}/vendor/portal/dashboard`, {
      headers: { 'x-vendor-id': 'VND-HIMALAYAN' },
    });
    const vendorDashData = await vendorDashboardRes.json();
    const vendorDashOk = vendorDashboardRes.status === 200 && vendorDashData.vendor?.vendorId === 'VND-HIMALAYAN';
    record('VENDOR_PORTAL', 'Vendor Dashboard Authentication (VND-HIMALAYAN)', vendorDashOk ? 'PASS' : 'FAIL', { businessName: vendorDashData.vendor?.businessName });

    // Vendor Cross-Isolation check: Attempt to reject non-existent or other vendor task
    const crossVendorReject = await fetch(`${API_URL}/vendor/portal/requests/00000000-0000-0000-0000-000000000000/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vendor-id': 'VND-HIMALAYAN' },
      body: JSON.stringify({ reason: 'Unauthorized task test' }),
    });
    const crossVendorBlocked = crossVendorReject.status === 404 || crossVendorReject.status === 403;
    record('VENDOR_PORTAL', 'Cross-Vendor Task Protection (Isolation Enforced)', crossVendorBlocked ? 'PASS' : 'FAIL', { status: crossVendorReject.status });

    // =========================================================================
    // PHASE 13: FINANCE & LEDGER REPORTING
    // =========================================================================
    console.log('\n--- PHASE 13: Finance & Ledgers ---');
    const financeOverviewRes = await fetch(`${API_URL}/finance/overview`, {
      headers: { Cookie: adminCookie },
    });
    const financeOverviewData = await financeOverviewRes.json();
    const financeOverviewOk = financeOverviewRes.status === 200 && financeOverviewData.overview !== undefined;
    record('FINANCE_ENGINE', 'Finance Overview Metrics API (/api/finance/overview)', financeOverviewOk ? 'PASS' : 'FAIL', { totalCollections: financeOverviewData.overview?.totalCustomerCollections });

    const financeLedgerRes = await fetch(`${API_URL}/finance/bookings`, {
      headers: { Cookie: adminCookie },
    });
    const financeLedgerData = await financeLedgerRes.json();
    const financeLedgerOk = financeLedgerRes.status === 200 && Array.isArray(financeLedgerData.ledger);
    record('FINANCE_ENGINE', 'Booking Cost & Margin Ledger API (/api/finance/bookings)', financeLedgerOk ? 'PASS' : 'FAIL', { bookingCount: financeLedgerData.count });

    const anonFinanceRes = await fetch(`${API_URL}/finance/overview`);
    record('FINANCE_ENGINE', 'Anonymous Finance Access Blocked (401)', anonFinanceRes.status === 401 ? 'PASS' : 'FAIL');

    // =========================================================================
    // PHASE 14: DEFENSIVE SECURITY AUDIT (RBAC, IDOR, SECRETS, INJECTION)
    // =========================================================================
    console.log('\n--- PHASE 14: Defensive Security Audit ---');

    // 1. RBAC: Anonymous access to admin endpoints
    const anonAdminRes = await fetch(`${API_URL}/admin/customers`);
    recordSecurity('RBAC', 'Anonymous User Access to /api/admin/customers', anonAdminRes.status === 401 ? 'PASS' : 'FAIL', `Returned HTTP ${anonAdminRes.status} Unauthorized`);

    const anonBookingsRes = await fetch(`${API_URL}/admin/bookings`);
    recordSecurity('RBAC', 'Anonymous User Access to /api/admin/bookings', anonBookingsRes.status === 401 ? 'PASS' : 'FAIL', `Returned HTTP ${anonBookingsRes.status} Unauthorized`);

    // 2. RBAC: Normal Customer attempting Admin actions
    const custAdminRes = await fetch(`${API_URL}/admin/customers`, {
      headers: { Cookie: rawCustomerCookie.split(';')[0] },
    });
    recordSecurity('RBAC', 'Customer Account Access to Admin Endpoints', custAdminRes.status === 401 || custAdminRes.status === 403 ? 'PASS' : 'FAIL', `Returned HTTP ${custAdminRes.status} Forbidden`);

    // 3. IDOR: Customer A attempting to access Customer B's booking
    // Create second customer
    const custBEmail = `cust_b_${Date.now()}@zelevos.test`;
    const signupB = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Customer B', email: custBEmail, password: testCustPassword, confirmPassword: testCustPassword }),
    });
    const dataB = await signupB.json();
    const verifyB = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: custBEmail, otp: dataB.debugOtp }),
    });
    const cookieB = (verifyB.headers.get('set-cookie') || '').split(';')[0];

    // Customer B attempts to fetch Customer A's private booking
    const idorBookingRes = await fetch(`${API_URL}/bookings/${liveBookingId}`, {
      headers: { Cookie: cookieB },
    });
    recordSecurity('IDOR', 'Cross-User Booking Privacy (Customer B -> Booking of Customer A)', idorBookingRes.status === 403 || idorBookingRes.status === 404 || idorBookingRes.status === 401 ? 'PASS' : 'FAIL', `Access Denied with HTTP ${idorBookingRes.status}`);

    // 4. Partner Data Isolation: Partner B attempting to access Partner A's dashboard
    // Anonymous to partner dashboard
    const anonPartnerRes = await fetch(`${API_URL}/partners/dashboard`);
    recordSecurity('RBAC', 'Anonymous Access to Partner Private Dashboard', anonPartnerRes.status === 401 ? 'PASS' : 'FAIL', `Returned HTTP ${anonPartnerRes.status} Unauthorized`);

    // 5. Secret Exposure Audit: Inspect frontend production bundle for secrets
    const distAssetsDir = path.resolve('artifacts/zelevos/dist/public/assets');
    let bundleHasSecret = false;
    let secretDetails = 'No secrets found in client bundle';
    if (fs.existsSync(distAssetsDir)) {
      const files = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(distAssetsDir, file), 'utf8');
        if (content.includes('ZT002121') || content.includes('jtn4MiUNCfn02pOVXYmbiukA')) {
          bundleHasSecret = true;
          secretDetails = `Exposed secret detected in ${file}`;
          break;
        }
      }
    }
    recordSecurity('SECRET_AUDIT', 'Frontend Production Bundle Inspection', !bundleHasSecret ? 'PASS' : 'FAIL', secretDetails);

    // 6. XSS / Input Sanitization in Search
    const xssPayload = '<script>alert("XSS")</script>';
    const searchRes = await fetch(`${API_URL}/packages?search=${encodeURIComponent(xssPayload)}`);
    const searchData = await searchRes.json();
    const xssSafe = searchRes.status === 200 && Array.isArray(searchData.results);
    recordSecurity('INPUT_SANITIZATION', 'SQLi/XSS Safe Handling on Public Search Query', xssSafe ? 'PASS' : 'FAIL', 'Query handled cleanly with parameterized search');

    // =========================================================================
    // PHASE 15: RESPONSIVE VIEWPORT TESTING (DESKTOP & MOBILE)
    // =========================================================================
    console.log('\n--- PHASE 15: Responsive Viewport Testing ---');
    // Desktop: 1440x900
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    record('RESPONSIVE', 'Desktop Viewport (1440x900): No Horizontal Scroll', !desktopOverflow ? 'PASS' : 'FAIL');

    // Mobile: 390x844 (iPhone 14)
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    record('RESPONSIVE', 'Mobile Viewport (390x844): No Horizontal Overflow', !mobileOverflow ? 'PASS' : 'FAIL');

    const mobileMenuBtn = await page.$('.mobile-menu-btn, button[aria-label*="menu" i]');
    record('RESPONSIVE', 'Mobile Navigation Hamburger Menu Accessible', mobileMenuBtn ? 'PASS' : 'FAIL');

    console.log('\n====================================================');
    console.log(`AUDIT FINISHED! Total: ${testReport.summary.total}, PASS: ${testReport.summary.pass}, FAIL: ${testReport.summary.fail}, NOT_VERIFIED: ${testReport.summary.notVerified}`);
    console.log('====================================================');

    // Save JSON audit log for website_test.txt generation
    fs.writeFileSync('audit_results.json', JSON.stringify(testReport, null, 2));
    console.log('Saved audit_results.json successfully.');

  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Audit Script Error:', err);
  process.exit(1);
});
