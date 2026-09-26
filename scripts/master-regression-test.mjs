import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8080/api';

const ADMIN_ID = 'zelevos-travelai00';
const ADMIN_PASSWORD = 'ZT002121';

async function runMasterRegression() {
  console.log('=== ZELEVOS MASTER REGRESSION TEST SUITE ===');
  const results = [];
  function log(name, status, details = '') {
    console.log(`[${status}] ${name} ${details ? '(' + details + ')' : ''}`);
    results.push({ name, status, details });
  }

  // 1. API Health & Endpoints
  console.log('\n--- 1. Core API Endpoints ---');
  try {
    const pkgsRes = await fetch(`${API_URL}/packages`);
    log('API /packages', pkgsRes.ok ? 'PASS' : 'FAIL', `Status: ${pkgsRes.status}`);

    const destsRes = await fetch(`${API_URL}/destinations`);
    log('API /destinations', destsRes.ok ? 'PASS' : 'FAIL', `Status: ${destsRes.status}`);

    // Admin Auth
    const adminLoginRes = await fetch(`${API_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: ADMIN_ID, password: ADMIN_PASSWORD }),
    });
    const adminCookie = adminLoginRes.headers.get('set-cookie')?.split(';')[0] || '';
    log('Admin Authentication API', adminLoginRes.ok ? 'PASS' : 'FAIL', `Status: ${adminLoginRes.status}`);

    if (adminCookie) {
      const adminCustRes = await fetch(`${API_URL}/admin/customers`, { headers: { Cookie: adminCookie } });
      log('Admin /customers', adminCustRes.ok ? 'PASS' : 'FAIL', `Status: ${adminCustRes.status}`);

      const adminBookingsRes = await fetch(`${API_URL}/admin/bookings`, { headers: { Cookie: adminCookie } });
      log('Admin /bookings', adminBookingsRes.ok ? 'PASS' : 'FAIL', `Status: ${adminBookingsRes.status}`);

      const adminPartnersRes = await fetch(`${API_URL}/admin/partners`, { headers: { Cookie: adminCookie } });
      log('Admin /partners', adminPartnersRes.ok ? 'PASS' : 'FAIL', `Status: ${adminPartnersRes.status}`);
    }

    // RBAC & IDOR checks
    const unauthAdmin = await fetch(`${API_URL}/admin/customers`);
    log('RBAC: Anonymous user blocked from /admin/customers', unauthAdmin.status === 401 || unauthAdmin.status === 403 ? 'PASS' : 'FAIL', `Status: ${unauthAdmin.status}`);

    const unauthBooking = await fetch(`${API_URL}/bookings/f9999999-0000-0000-0000-000000000000`);
    log('IDOR: Anonymous user blocked from private booking', unauthBooking.status === 401 || unauthBooking.status === 404 ? 'PASS' : 'FAIL', `Status: ${unauthBooking.status}`);
  } catch (err) {
    log('Core API Endpoints', 'FAIL', err.message);
  }

  // 2. Browser Testing
  console.log('\n--- 2. Browser Verification ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();

    // 2.1 Homepage
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    log('Homepage Loaded', title.includes('Zelevos') ? 'PASS' : 'FAIL', title);

    // 2.2 BUG-001 Verification: Navbar Search Button
    const searchBtn = await page.waitForSelector('#navbar-search-btn');
    await searchBtn.click();
    await new Promise(r => setTimeout(r, 400));
    const searchModalVisible = await page.evaluate(() => !!document.querySelector('.global-search-dialog'));
    log('BUG-001 Retest: Global Search Modal opens on search button click', searchModalVisible ? 'PASS' : 'FAIL');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));

    // 2.3 Curated Packages Cards
    await page.waitForSelector('div[id^="package-card-"]', { timeout: 10000 });
    const cardsCount = await page.evaluate(() => document.querySelectorAll('div[id^="package-card-"]').length);
    log('Curated Packages Rendering', cardsCount > 0 ? 'PASS' : 'FAIL', `Count: ${cardsCount}`);

    // 2.4 BUG-002 Verification: Package Detail -> Book Now Auth Gate
    const firstCard = await page.$('div[id^="package-card-"]');
    await firstCard.click();
    await new Promise(r => setTimeout(r, 1000));

    const bookBtn = await page.waitForSelector('#book-now-package-btn');
    await bookBtn.click();
    await new Promise(r => setTimeout(r, 600));

    const authPrompt = await page.evaluate(() => {
      return document.body.textContent.includes('Please log in or create an account to book your holiday package.');
    });
    log('BUG-002 Retest: Unauthenticated guest prompted to log in upon Book Now', authPrompt ? 'PASS' : 'FAIL');

    // Close auth modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.auth-close, [aria-label="Close"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 300));

    // 2.5 Dedicated Flights Portal (/flights)
    await page.goto(`${BASE_URL}/flights`, { waitUntil: 'domcontentloaded' });
    const flightsTitle = await page.evaluate(() => document.querySelector('h1, h2')?.textContent || '');
    log('Flights Portal Navigation (/flights)', flightsTitle.length > 0 ? 'PASS' : 'FAIL', flightsTitle);

    // 2.6 Admin Operations Console UI
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    const passInput = await page.waitForSelector('input[type="password"]');
    await passInput.type(ADMIN_PASSWORD);
    const submitBtn = await page.waitForSelector('button[type="submit"]');
    await submitBtn.click();

    await page.waitForFunction(() => !document.body.textContent.includes('Authenticating...'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1200));

    const adminLoaded = await page.evaluate(() => {
      return document.body.textContent.includes('Zelevos Admin') && document.body.textContent.includes('Operations Console');
    });
    log('Admin Operations Console Dashboard Loaded', adminLoaded ? 'PASS' : 'FAIL');

    // Test Admin Tabs
    const testTabs = ['Customers', 'Bookings', 'Packages (Sec 8)', 'Operations Desk', 'Partner Network', 'Finance & Ledger'];
    for (const tab of testTabs) {
      const tabClicked = await page.evaluate((label) => {
        const btns = Array.from(document.querySelectorAll('aside nav button'));
        const target = btns.find(b => b.textContent.includes(label));
        if (target) {
          target.click();
          return true;
        }
        return false;
      }, tab);
      await new Promise(r => setTimeout(r, 500));
      log(`Admin Tab: ${tab}`, tabClicked ? 'PASS' : 'FAIL');
    }

    // 2.7 Mobile Viewport (390x844)
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    log('Mobile Responsiveness (390x844) No Horizontal Scroll', !mobileOverflow ? 'PASS' : 'FAIL');

  } catch (err) {
    log('Browser Suite Error', 'FAIL', err.message);
  } finally {
    await browser.close();
  }

  console.log('\n=== MASTER REGRESSION RESULTS ===');
  const passes = results.filter(r => r.status === 'PASS').length;
  const fails = results.filter(r => r.status === 'FAIL').length;
  console.log(`Total Tests: ${results.length}`);
  console.log(`PASS: ${passes}`);
  console.log(`FAIL: ${fails}`);
  return { results, passes, fails };
}

runMasterRegression();
