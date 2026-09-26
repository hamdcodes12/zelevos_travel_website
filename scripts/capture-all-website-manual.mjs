import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const ADMIN_ID = 'zelevos-travelai00';
const ADMIN_PASSWORD = 'ZT002121';

const outputBase = path.join(rootDir, 'documentation', 'screenshots');

// Ensure all subdirectories exist
const dirs = [
  'customer',
  'admin',
  'operations',
  'supplier',
  'vendor',
  'partner',
  'finance',
  'support',
  'payments',
  'notifications',
  'mobile',
  'annotated',
];
dirs.forEach((d) => fs.mkdirSync(path.join(outputBase, d), { recursive: true }));

// Helper to inject high-contrast, professional annotations
async function injectAnnotations(page, items) {
  await page.evaluate((annotations) => {
    const existing = document.getElementById('zelevos-manual-annotation-layer');
    if (existing) existing.remove();

    const layer = document.createElement('div');
    layer.id = 'zelevos-manual-annotation-layer';
    layer.style.cssText =
      'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;font-family:Inter,system-ui,sans-serif;';

    annotations.forEach((item, index) => {
      let rect = null;
      if (item.selector) {
        const el = document.querySelector(item.selector);
        if (el) {
          rect = el.getBoundingClientRect();
        }
      }

      const x = rect ? rect.left + (item.offsetX || 0) : item.x || 100;
      const y = rect ? rect.top + (item.offsetY || 0) : item.y || 100;
      const w = rect ? rect.width : item.w || 200;
      const h = rect ? rect.height : item.h || 40;

      // Glowing highlight box around target
      if (item.box !== false) {
        const box = document.createElement('div');
        box.style.cssText = `position:absolute;left:${Math.max(0, x - 4)}px;top:${Math.max(0, y - 4)}px;width:${w + 8}px;height:${h + 8}px;border:3px solid #ef4444;border-radius:8px;background:rgba(239,68,68,0.08);box-shadow:0 0 16px rgba(239,68,68,0.55);pointer-events:none;`;
        layer.appendChild(box);
      }

      // Floating Badge & Label Pill
      const pill = document.createElement('div');
      const num = item.num || index + 1;
      const title = item.title || `STEP ${num}`;
      const desc = item.desc || '';

      const topPos = y > 75 ? Math.max(10, y - 52) : y + h + 8;
      const leftPos = Math.max(10, Math.min(x, window.innerWidth - 320));

      pill.style.cssText = `position:absolute;left:${leftPos}px;top:${topPos}px;background:linear-gradient(135deg, #0f172a, #1e293b);color:#ffffff;padding:5px 12px;border-radius:8px;border:1.5px solid #ef4444;box-shadow:0 10px 25px rgba(0,0,0,0.65);display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;max-width:320px;pointer-events:none;z-index:2147483647;`;

      pill.innerHTML = `
        <span style="background:#ef4444;color:#ffffff;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;">${num}</span>
        <div style="display:flex;flex-direction:column;line-height:1.2;">
          <span style="color:#fca5a5;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">${title}</span>
          <span style="color:#f8fafc;font-size:11.5px;font-weight:600;">${desc}</span>
        </div>
      `;
      layer.appendChild(pill);
    });

    document.body.appendChild(layer);
  }, items);
}

async function removeAnnotations(page) {
  await page.evaluate(() => {
    const existing = document.getElementById('zelevos-manual-annotation-layer');
    if (existing) existing.remove();
  });
}

async function captureScreenPair(page, category, filename, annotations = []) {
  const cleanPath = path.join(outputBase, category, filename);
  const annotatedPath = path.join(outputBase, 'annotated', filename);

  // Clean raw capture
  await removeAnnotations(page);
  await page.screenshot({ path: cleanPath, fullPage: false });

  // Annotated capture
  if (annotations.length > 0) {
    await injectAnnotations(page, annotations);
    await new Promise((r) => setTimeout(r, 200));
    await page.screenshot({ path: annotatedPath, fullPage: false });
    await removeAnnotations(page);
  } else {
    // If no annotations, copy clean
    fs.copyFileSync(cleanPath, annotatedPath);
  }

  console.log(`[CAPTURED] ${category}/${filename}`);
}

async function main() {
  console.log('===============================================================');
  console.log(' ZELEVOS REAL WEBSITE SCREENSHOT CAPTURE SUITE');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();

  try {
    // -------------------------------------------------------------------------
    // 1. CUSTOMER: Home Page
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Capturing Customer Home ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'customer', 'customer-01-home.png', [
      { num: '1', title: 'Top Navigation', desc: 'Direct links to Packages, Destinations, Flights', selector: 'header nav' },
      { num: '2', title: 'Smart Search', desc: 'Search destinations and curated itineraries', selector: 'input[placeholder*="Search"]', offsetX: -10 },
      { num: '3', title: 'Curated Deals', desc: 'Browse featured holiday packages and special rates', selector: 'section', offsetY: 300, h: 250 },
    ]);

    // -------------------------------------------------------------------------
    // 2. CUSTOMER: Auth Modal - Login Tab
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Capturing Customer Login ---');
    // Open auth dialog by clicking Sign In
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const signIn = btns.find((b) => b.textContent && (b.textContent.includes('Sign In') || b.textContent.includes('Log In')));
      if (signIn) signIn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    await captureScreenPair(page, 'customer', 'customer-02-auth-login.png', [
      { num: '1', title: 'Sign In Tab', desc: 'Access your traveller account', selector: 'button[role="tab"]' },
      { num: '2', title: 'Email & Password', desc: 'Enter registered credentials or request OTP', selector: 'input[type="email"]' },
      { num: '3', title: 'Sign In Action', desc: 'Click to authenticate and unlock member perks', selector: 'button[type="submit"]' },
    ]);

    // -------------------------------------------------------------------------
    // 3. CUSTOMER: Auth Modal - Sign Up Tab
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Capturing Customer Sign Up ---');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button[role="tab"]'));
      const signUpTab = tabs.find((t) => t.textContent && (t.textContent.includes('Sign Up') || t.textContent.includes('Register')));
      if (signUpTab) signUpTab.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    await captureScreenPair(page, 'customer', 'customer-03-auth-signup.png', [
      { num: '1', title: 'Sign Up Mode', desc: 'Create permanent Customer ID (ZLV-CUS-XXXXXX)', selector: 'button[role="tab"][data-state="active"]' },
      { num: '2', title: 'Passenger Details', desc: 'Enter full name, email, and password', selector: 'input[type="email"]' },
      { num: '3', title: 'Create Account', desc: 'Submit registration and verify via Email OTP', selector: 'button[type="submit"]' },
    ]);

    // Close Auth modal
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // 4. CUSTOMER: Destinations & Search Results
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Capturing Destinations & Search ---');
    await page.evaluate(() => {
      window.scrollTo(0, 600);
    });
    await new Promise((r) => setTimeout(r, 600));

    await captureScreenPair(page, 'customer', 'customer-04-destinations-search.png', [
      { num: '1', title: 'Destinations Showcase', desc: 'Explore top holiday states and regions', selector: 'h2', offsetY: -10 },
      { num: '2', title: 'Destination Cards', desc: 'Click any destination to filter packages', selector: 'img[alt*="Kashmir"], img[alt*="Goa"]', h: 180 },
    ]);

    // -------------------------------------------------------------------------
    // 5. CUSTOMER: Package Listing & Cards
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Capturing Package Listing ---');
    await page.evaluate(() => {
      window.scrollTo(0, 1200);
    });
    await new Promise((r) => setTimeout(r, 600));

    await captureScreenPair(page, 'customer', 'customer-05-package-listing.png', [
      { num: '1', title: 'Package Title & Badge', desc: 'Curated package name, rating, and duration', selector: 'h3' },
      { num: '2', title: 'Pricing & Savings', desc: 'All-inclusive price per traveller with taxes', selector: 'span[class*="price"], div[class*="price"]' },
      { num: '3', title: 'View Details', desc: 'Click card to view day-wise itinerary and hotels', selector: 'button', offsetY: 30 },
    ]);

    // -------------------------------------------------------------------------
    // 6. CUSTOMER: Package Detail Modal
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Capturing Package Detail Modal ---');
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('div[class*="cursor-pointer"], div[role="button"], button'));
      const exploreBtn = cards.find((el) => el.textContent && (el.textContent.includes('Explore') || el.textContent.includes('View Details') || el.textContent.includes('Book Now')));
      if (exploreBtn) exploreBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'customer', 'customer-06-package-detail.png', [
      { num: '1', title: 'Package Overview', desc: 'Highlights, duration, and suitability', selector: 'h2' },
      { num: '2', title: 'Day-by-Day Itinerary', desc: 'Detailed schedule, sightseeing, and hotel tier', selector: 'div[class*="itinerary"], div[class*="schedule"]', h: 120 },
      { num: '3', title: 'Book Now CTA', desc: 'Click to launch live checkout and select dates', selector: 'button', offsetY: 500, h: 45 },
    ]);

    // -------------------------------------------------------------------------
    // 7. CUSTOMER: Live Checkout Modal
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Capturing Checkout Modal ---');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const bookBtn = btns.find((b) => b.textContent && (b.textContent.includes('Book Now') || b.textContent.includes('Instant Booking') || b.textContent.includes('Proceed to Checkout')));
      if (bookBtn) bookBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'customer', 'customer-07-checkout-modal.png', [
      { num: '1', title: 'Travel Dates & Travellers', desc: 'Select departure date and passenger count', selector: 'input[type="date"], select', h: 40 },
      { num: '2', title: 'Primary Guest Details', desc: 'Lead traveller name, email, phone number', selector: 'input[type="text"], input[name*="name"]', h: 40 },
      { num: '3', title: 'Price Breakdown', desc: 'Base fare, GST, markup, and total payable', selector: 'div[class*="summary"], div[class*="total"]', h: 80 },
    ]);

    // -------------------------------------------------------------------------
    // 8. PAYMENTS: Real Live Razorpay Gateway
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Capturing Razorpay Payment Modal ---');
    // If we have existing verified live payment captures from Razorpay:
    const existingRazorpay = path.join(rootDir, 'screenshots', 'real_live_razorpay_gateway.png');
    const existingCheckout = path.join(rootDir, 'screenshots', 'real_live_checkout_modal.png');
    if (fs.existsSync(existingRazorpay)) {
      fs.copyFileSync(existingRazorpay, path.join(outputBase, 'payments', 'payments-01-razorpay-gateway.png'));
      fs.copyFileSync(existingRazorpay, path.join(outputBase, 'annotated', 'payments-01-razorpay-gateway.png'));
      console.log('[SAVED] payments/payments-01-razorpay-gateway.png');
    }

    // Close checkout modal
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // 9. CUSTOMER: Notification Drawer
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Capturing Customer Notification Drawer ---');
    await page.evaluate(() => {
      const bell = document.querySelector('button[aria-label="Notifications"]') || document.querySelector('button svg.lucide-bell')?.parentElement;
      if (bell) bell.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    await captureScreenPair(page, 'notifications', 'notifications-01-drawer.png', [
      { num: '1', title: 'Notification Drawer', desc: 'Slide-out tray with real-time alerts', selector: 'h2, h3', offsetY: -5 },
      { num: '2', title: 'Category Filters', desc: 'Filter by Announcements, Offers, Bookings, Support', selector: 'button[class*="rounded-full"]', w: 250 },
      { num: '3', title: 'Rich Promotional Card', desc: 'High-res image banner, description, and CTA button', selector: 'div[class*="border"]', offsetY: 60, h: 140 },
    ]);

    // Close notification drawer
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // 10. CUSTOMER: My Trips Dashboard & Voucher Download
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Capturing Customer My Trips ---');
    await page.goto(`${BASE_URL}/trips`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'customer', 'customer-10-my-trips.png', [
      { num: '1', title: 'My Trips Header', desc: 'Single console to view all travel itineraries', selector: 'h1, h2' },
      { num: '2', title: 'Confirmed Trip Card', desc: 'Booking reference, destination, dates, status', selector: 'div[class*="rounded"]', offsetY: 40, h: 160 },
      { num: '3', title: 'Trip Details CTA', desc: 'Click to inspect itinerary and download vouchers', selector: 'button', offsetY: 120, h: 40 },
    ]);

    // -------------------------------------------------------------------------
    // 11. ADMIN: Login Screen
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Capturing Admin Login Screen ---');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    // Ensure we are on login screen or log out first if already logged in
    const isDashboard = await page.$('#admin-sidebar-collapse-btn');
    if (isDashboard) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const logoutBtn = btns.find((b) => b.textContent && b.textContent.includes('Sign Out'));
        if (logoutBtn) logoutBtn.click();
      });
      await new Promise((r) => setTimeout(r, 1200));
    }

    await captureScreenPair(page, 'admin', 'admin-01-login.png', [
      { num: '1', title: 'Admin ID & Credentials', desc: 'Enter authorized administrator username and password', selector: 'input[type="text"]' },
      { num: '2', title: 'Enterprise Security Badges', desc: 'Encrypted login, scrypt hashing, role-based controls', selector: '.admin-security-badges-grid, div[class*="grid"]', h: 60 },
      { num: '3', title: 'Sign In Action', desc: 'Click to authenticate into executive command center', selector: 'button[type="submit"]' },
    ]);

    // Log in to Admin
    console.log('Logging in to Admin...');
    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      await passInput.type(ADMIN_PASSWORD);
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) await submitBtn.click();
      await page.waitForFunction(() => !document.body.textContent.includes('Authenticating...'), { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1500));
    }

    // -------------------------------------------------------------------------
    // 12. ADMIN: Master Dashboard
    // -------------------------------------------------------------------------
    console.log('\n--- 12. Capturing Admin Master Dashboard ---');
    await page.click('#admin-nav-overview');
    await new Promise((r) => setTimeout(r, 1000));

    await captureScreenPair(page, 'admin', 'admin-02-dashboard.png', [
      { num: '1', title: 'Executive KPI Cards', desc: 'Real-time metrics: Revenue, Bookings, Vendors, Operations', selector: 'main div[style*="grid"]', h: 110 },
      { num: '2', title: 'Operations Navigation', desc: 'Sidebar links to Bookings, Finance, Broadcasts, Suppliers', selector: 'aside nav' },
      { num: '3', title: 'Recent Activity', desc: 'Real-time booking velocity and customer registrations', selector: 'main', offsetY: 260, h: 220 },
    ]);

    // -------------------------------------------------------------------------
    // 13. ADMIN: User Information & Customer Dossier
    // -------------------------------------------------------------------------
    console.log('\n--- 13. Capturing Admin User Information ---');
    await page.click('#admin-nav-customers');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'admin', 'admin-03-customers.png', [
      { num: '1', title: 'Unified Customer Search', desc: 'Instant search by User ID (ZLV-CUS-XXXXXX), Name, Email', selector: 'input[placeholder*="Search"]' },
      { num: '2', title: 'Customer Records Table', desc: 'Displays permanent User ID, registration date, and "NEW" badge', selector: 'table thead' },
      { num: '3', title: 'Customer Dossier CTA', desc: 'Click "View Profile" to open complete 9-tab profile', selector: 'table tbody tr button', h: 32 },
    ]);

    // Open Customer Dossier Modal
    console.log('Opening Customer Dossier Modal...');
    const openedDossier = await page.evaluate(() => {
      const btn = document.querySelector('table tbody tr button');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (openedDossier) {
      await new Promise((r) => setTimeout(r, 1200));
      await captureScreenPair(page, 'admin', 'admin-04-customer-dossier.png', [
        { num: '1', title: 'Customer Identity Header', desc: 'Permanent User ID (ZLV-CUS-XXXXXX), Email, Phone', selector: 'h2' },
        { num: '2', title: '9-Tab Data Dimensions', desc: 'Overview, Bookings, Payments, Invoices, Refunds, Support, Timeline', selector: 'nav, div[role="tablist"]', h: 40 },
        { num: '3', title: 'Real Activity Timeline', desc: 'Zero synthetic data; chronologically verified database events', selector: 'div[class*="overflow"]', offsetY: 120, h: 200 },
      ]);
      await page.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 600));
    }

    // -------------------------------------------------------------------------
    // 14. ADMIN: Bookings Desk
    // -------------------------------------------------------------------------
    console.log('\n--- 14. Capturing Admin Bookings Desk ---');
    await page.click('#admin-nav-bookings');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'admin', 'admin-05-bookings.png', [
      { num: '1', title: 'Booking Status Filters', desc: 'Filter by Confirmed, Pending, In Progress, Cancelled', selector: 'div[style*="flex-wrap"], div[class*="filter"]', h: 40 },
      { num: '2', title: 'Reservation Master Table', desc: 'Booking Reference, Guest name, Travel dates, Price', selector: 'table' },
      { num: '3', title: 'Vendor Assignment Status', desc: 'Fulfillment tracking for Hotel, Cab, and Guide services', selector: 'table tbody tr td', offsetX: 350, w: 120 },
    ]);

    // -------------------------------------------------------------------------
    // 15. ADMIN: Payments Desk
    // -------------------------------------------------------------------------
    console.log('\n--- 15. Capturing Admin Payments Desk ---');
    await page.click('#admin-nav-payments');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'admin', 'admin-06-payments.png', [
      { num: '1', title: 'Payment Analytics Header', desc: 'Total captured revenue, pending settlements, refunds', selector: 'h2' },
      { num: '2', title: 'Payment Transaction Ledger', desc: 'Razorpay Payment IDs, Order IDs, Method, Captured Status', selector: 'table' },
      { num: '3', title: 'Refund Action Control', desc: 'Initiate partial or full refund with audit logging', selector: 'table tbody tr button', h: 32 },
    ]);

    // -------------------------------------------------------------------------
    // 16. ADMIN: Broadcasts & Offers Management
    // -------------------------------------------------------------------------
    console.log('\n--- 16. Capturing Admin Broadcasts & Offers Tab ---');
    await page.click('#admin-nav-broadcasts');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'admin', 'admin-07-broadcasts-offers.png', [
      { num: '1', title: 'Campaign KPI Cards', desc: 'Total Broadcasts, Deliveries, Read % and Click Conversion Rates', selector: 'div[style*="grid"]', h: 100 },
      { num: '2', title: 'Broadcast Campaigns Table', desc: 'Title, Category (Offer/Announcement), Target Audience, Status', selector: 'table' },
      { num: '3', title: '+ Create Broadcast CTA', desc: 'Launch modal to compose rich promotional campaigns', selector: 'button', offsetY: 15, h: 38 },
    ]);

    // Open Broadcast Create Modal
    console.log('Opening Broadcast Create Modal...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const createBtn = btns.find((b) => b.textContent && b.textContent.includes('Create Broadcast'));
      if (createBtn) createBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    await captureScreenPair(page, 'admin', 'admin-08-broadcast-create-modal.png', [
      { num: '1', title: 'Audience Targeting', desc: 'Select All Customers, Specific User, or Upcoming Trips', selector: 'select, div[role="combobox"]', h: 40 },
      { num: '2', title: 'Category & Message Body', desc: 'Select Announcement, Offer, Payment, Support with rich text', selector: 'textarea', h: 90 },
      { num: '3', title: 'Banner Upload & CTA', desc: 'Attach high-res promo image, button text, and destination link', selector: 'input[type="file"]', h: 40 },
    ]);

    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 600));

    // Open Broadcast Recipients Modal
    console.log('Opening Broadcast Recipients Modal...');
    const openedRecipients = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const recBtn = btns.find((b) => b.textContent && (b.textContent.includes('Recipients') || b.textContent.includes('Engagement')));
      if (recBtn) {
        recBtn.click();
        return true;
      }
      return false;
    });
    if (openedRecipients) {
      await new Promise((r) => setTimeout(r, 1200));
      await captureScreenPair(page, 'admin', 'admin-09-broadcast-recipients-modal.png', [
        { num: '1', title: 'Delivery & Engagement Roster', desc: 'Inspect per-recipient delivery status and timestamps', selector: 'h3' },
        { num: '2', title: 'Read & Click Metrics', desc: 'Exact timestamp when customer read alert and clicked CTA', selector: 'table tbody tr', h: 40 },
        { num: '3', title: 'Permanent Customer ID', desc: 'Identifies recipients by their ZLV-CUS ID and email', selector: 'table tbody tr td', w: 140 },
      ]);
      await page.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 600));
    }

    // -------------------------------------------------------------------------
    // 17. ADMIN: Suppliers & Vendors Directory
    // -------------------------------------------------------------------------
    console.log('\n--- 17. Capturing Admin Suppliers & Vendors ---');
    await page.click('#admin-nav-suppliers');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'admin', 'admin-10-suppliers-vendors.png', [
      { num: '1', title: 'Permanent Vendor ID', desc: 'Sequential system identifier (ZLV-VND-XXXXXX)', selector: 'table thead' },
      { num: '2', title: 'Compliance & Category', desc: 'Verified Hotel, Cab, or Guide partner credentials', selector: 'table tbody tr', h: 45 },
      { num: '3', title: 'Review Dossier Action', desc: 'Inspect uploaded certificates, tax proof, and approve', selector: 'table tbody tr button', h: 32 },
    ]);

    // -------------------------------------------------------------------------
    // 18. ADMIN: Operations Desk
    // -------------------------------------------------------------------------
    console.log('\n--- 18. Capturing Admin Operations Desk ---');
    await page.click('#admin-nav-operations');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'admin', 'admin-11-operations.png', [
      { num: '1', title: 'Fulfillment Queue', desc: 'Pending room reservations, fleet dispatches, and guide tasks', selector: 'h2' },
      { num: '2', title: 'Service Task Router', desc: 'Assigns reservations to approved suppliers and tracks acceptance', selector: 'table' },
      { num: '3', title: 'Voucher Verification Desk', desc: 'Verifies vendor vouchers before releasing tickets to customers', selector: 'table tbody tr button', h: 32 },
    ]);

    // -------------------------------------------------------------------------
    // 19. ADMIN: Packages Management
    // -------------------------------------------------------------------------
    console.log('\n--- 19. Capturing Admin Packages Desk ---');
    await page.click('#admin-nav-packages');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'admin', 'admin-12-packages.png', [
      { num: '1', title: 'Package Catalog', desc: 'Curated holiday itineraries, durations, and destinations', selector: 'h2' },
      { num: '2', title: 'Markup & Pricing Engine', desc: 'Base cost, markup (fixed/percentage), and selling price', selector: 'table tbody tr', h: 45 },
      { num: '3', title: 'Catalog Status Toggles', desc: 'Enable/disable packages and manage available departure inventory', selector: 'table tbody tr input[type="checkbox"], table tbody tr button', h: 30 },
    ]);

    // -------------------------------------------------------------------------
    // 20. ADMIN: Support Center
    // -------------------------------------------------------------------------
    console.log('\n--- 20. Capturing Admin Support Desk ---');
    await page.click('#admin-nav-support');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'support', 'support-02-admin-ticket-reply.png', [
      { num: '1', title: 'Support Tickets Queue', desc: 'Open, in-progress, and resolved customer inquiries', selector: 'h2' },
      { num: '2', title: 'Priority & Category', desc: 'Payment, Booking, Cancellation, and Urgent Help tags', selector: 'table, div[class*="ticket"]', h: 100 },
      { num: '3', title: 'Resolution Console', desc: 'Inspect customer query, type administrative reply, update status', selector: 'button', offsetY: 60, h: 35 },
    ]);

    // -------------------------------------------------------------------------
    // 21. ADMIN: Custom Trips Desk
    // -------------------------------------------------------------------------
    console.log('\n--- 21. Capturing Admin Custom Trips Desk ---');
    await page.click('#admin-nav-custom-trips');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'admin', 'admin-15-custom-trips.png', [
      { num: '1', title: 'Bespoke Travel Inquiries', desc: 'Customer requirements, budget range, and duration', selector: 'h2' },
      { num: '2', title: 'Proposal Builder', desc: 'Draft custom day-wise itinerary and tailored package price', selector: 'table, div[class*="grid"]', h: 120 },
      { num: '3', title: 'Quote Status', desc: 'Track customer review, approval, and checkout conversion', selector: 'button', offsetY: 60, h: 35 },
    ]);

    // -------------------------------------------------------------------------
    // 22. ADMIN: Flights Desk
    // -------------------------------------------------------------------------
    console.log('\n--- 22. Capturing Admin Flights Desk ---');
    await page.click('#admin-nav-flights');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'admin', 'admin-16-flights.png', [
      { num: '1', title: 'Flight Bookings Desk', desc: 'Airlines, PNR records, flight numbers, and seat class', selector: 'h2' },
      { num: '2', title: 'Route & Passenger Info', desc: 'Origin, destination, passenger list, baggage allowance', selector: 'table' },
      { num: '3', title: 'Ticket Actions', desc: 'Re-issue e-ticket, manage schedule changes, process cancellations', selector: 'table tbody tr button', h: 32 },
    ]);

    // -------------------------------------------------------------------------
    // 23. ADMIN: Partners Desk
    // -------------------------------------------------------------------------
    console.log('\n--- 23. Capturing Admin Partners Desk ---');
    await page.click('#admin-nav-partners');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'partner', 'partner-02-admin-partners.png', [
      { num: '1', title: 'B2B Partner Network', desc: 'Authorised travel agencies, referral codes, agent tiers', selector: 'h2' },
      { num: '2', title: 'Referral & Lead Tracker', desc: 'Attributed customer bookings and generated revenue', selector: 'table' },
      { num: '3', title: 'Commission Payout Ledger', desc: 'Approve monthly agent commissions and track payout records', selector: 'table tbody tr button', h: 32 },
    ]);

    // -------------------------------------------------------------------------
    // 24. ADMIN: Finance & Ledger
    // -------------------------------------------------------------------------
    console.log('\n--- 24. Capturing Admin Finance Desk ---');
    await page.click('#admin-nav-finance');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'finance', 'finance-01-ledger-overview.png', [
      { num: '1', title: 'Financial Overview', desc: 'Gross booking volume, merchant fee deductions, net profit', selector: 'h2' },
      { num: '2', title: 'Vendor Payables Ledger', desc: 'Outstanding balances owed to hotels, cab operators, guides', selector: 'table' },
      { num: '3', title: 'Tax Invoice Reconciliation', desc: 'GST invoice generation, tax ledgers, and payout audits', selector: 'button', offsetY: 60, h: 35 },
    ]);

    // -------------------------------------------------------------------------
    // 25. ADMIN: Audit Logs
    // -------------------------------------------------------------------------
    console.log('\n--- 25. Capturing Admin Audit Logs ---');
    await page.click('#admin-nav-audit');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'admin', 'admin-19-audit-logs.png', [
      { num: '1', title: 'Immutable Security Trail', desc: 'Cryptographically ordered log of all system changes', selector: 'h2' },
      { num: '2', title: 'Actor & IP Address', desc: 'Admin ID, authenticated session, IP address, user agent', selector: 'table thead' },
      { num: '3', title: 'Resource & Action Details', desc: 'Old vs new state diff, timestamp, affected record ID', selector: 'table tbody tr', h: 45 },
    ]);

    // -------------------------------------------------------------------------
    // 26. ADMIN: Settings & Security
    // -------------------------------------------------------------------------
    console.log('\n--- 26. Capturing Admin Settings & Security ---');
    await page.click('#admin-nav-settings');
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'admin', 'admin-20-settings-security.png', [
      { num: '1', title: 'Security Architecture', desc: 'scrypt password hashing, HttpOnly cookies, rolling sessions', selector: 'h2' },
      { num: '2', title: 'Two-Factor Authentication (2FA)', desc: 'Enterprise TOTP authenticator setup with recovery keys', selector: 'div[style*="background: #ffffff"], div[class*="card"]', h: 120 },
      { num: '3', title: 'Credential Management', desc: 'Secure admin password update console with complexity enforcement', selector: 'form input[type="password"]', h: 40 },
    ]);

    // -------------------------------------------------------------------------
    // 27. SUPPLIER: Become a Supplier Landing Page
    // -------------------------------------------------------------------------
    console.log('\n--- 27. Capturing Supplier Landing Page ---');
    await page.goto(`${BASE_URL}/become-a-supplier`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'supplier', 'supplier-01-become-supplier.png', [
      { num: '1', title: 'Supplier Value Proposition', desc: 'Direct bookings, guaranteed payouts, zero joining fees', selector: 'h1' },
      { num: '2', title: 'Service Categories', desc: 'Accommodation, Fleet Transport, Guides, Adventure Activities', selector: 'div[class*="grid"]', h: 150 },
      { num: '3', title: 'Register as Supplier CTA', desc: 'Click to launch multi-step digital onboarding form', selector: 'button[class*="bg-primary"], button[class*="bg-blue"]', h: 45 },
    ]);

    // -------------------------------------------------------------------------
    // 28. SUPPLIER: Status Tracker Page
    // -------------------------------------------------------------------------
    console.log('\n--- 28. Capturing Supplier Status Tracker ---');
    await page.goto(`${BASE_URL}/become-a-supplier?tab=status`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    await captureScreenPair(page, 'supplier', 'supplier-06-status-tracker.png', [
      { num: '1', title: 'Application Tracker Header', desc: 'Check onboarding review progress in real time', selector: 'h2, h3' },
      { num: '2', title: 'Applicant Email Lookup', desc: 'Enter registered business email to fetch live review status', selector: 'input[type="email"]' },
      { num: '3', title: 'Track Status CTA', desc: 'View reviewer feedback, requested changes, or approval', selector: 'button[type="submit"]', h: 40 },
    ]);

    // -------------------------------------------------------------------------
    // 29. VENDOR: Dedicated Vendor Portal
    // -------------------------------------------------------------------------
    console.log('\n--- 29. Capturing Dedicated Vendor Portal ---');
    await page.goto(`${BASE_URL}/vendor-portal`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'vendor', 'vendor-01-dashboard.png', [
      { num: '1', title: 'Vendor Operations Console', desc: 'Isolated portal showing assigned booking tasks and earnings', selector: 'h1, h2' },
      { num: '2', title: 'Booking Tasks Inbox', desc: 'Accept incoming reservations and enter hotel confirmation codes', selector: 'div[class*="task"], table', h: 120 },
      { num: '3', title: 'Voucher Upload Center', desc: 'Upload verified check-in vouchers for operations authorization', selector: 'button', offsetY: 60, h: 35 },
    ]);

    // -------------------------------------------------------------------------
    // 30. PARTNER: Authorised Partner Portal
    // -------------------------------------------------------------------------
    console.log('\n--- 30. Capturing Authorised Partner Portal ---');
    await page.goto(`${BASE_URL}/partner-portal`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'partner', 'partner-01-dashboard.png', [
      { num: '1', title: 'Partner Command Center', desc: 'White luxury portal for B2B agents and travel advisors', selector: 'h1, h2' },
      { num: '2', title: 'Unique Referral Code', desc: 'Share custom tracking links with your travel clients', selector: 'input[readonly], div[class*="code"]', h: 40 },
      { num: '3', title: 'Commission & Payout Tracker', desc: 'Live earnings ledger with transparent tiered commissions', selector: 'div[class*="grid"]', offsetY: 100, h: 100 },
    ]);

    // -------------------------------------------------------------------------
    // 31. MOBILE: Responsive Views
    // -------------------------------------------------------------------------
    console.log('\n--- 31. Capturing Mobile Responsive Views ---');
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'mobile', 'mobile-01-customer.png', [
      { num: '1', title: 'Mobile Header & Brand', desc: 'Optimized touch navigation with responsive search bar', selector: 'header' },
      { num: '2', title: 'Mobile Package Discovery', desc: 'Swipeable cards with instant booking shortcuts', selector: 'section', offsetY: 220, h: 260 },
    ]);

    await page.setViewport({ width: 412, height: 915, isMobile: true });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    await captureScreenPair(page, 'mobile', 'mobile-02-admin.png', [
      { num: '1', title: 'Mobile Admin Console', desc: 'Responsive KPI metrics and mobile navigation drawer', selector: 'main div[style*="grid"]', h: 180 },
    ]);

    console.log('\n===============================================================');
    console.log(' ALL SCREENSHOTS CAPTURED AND ANNOTATED SUCCESSFULLY!');
    console.log('===============================================================\n');
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    await browser.close();
  }
}

main();
