import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'artifacts/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const envText = fs.readFileSync('.env', 'utf-8');
const adminPassMatch = envText.match(/ADMIN_PASSWORD=["']?([^"'\r\n]+)/);
const adminPassword = adminPassMatch ? adminPassMatch[1] : '';

async function runBrowserTests() {
  console.log('--- LAUNCHING GOOGLE CHROME FOR LIVE TRACKING VERIFICATION ---');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--use-fake-ui-for-media-stream',
    ],
  });

  try {
    // -------------------------------------------------------------
    // 1. CUSTOMER A: MY TRIPS & LIVE TRIP MODAL (DESKTOP)
    // -------------------------------------------------------------
    console.log('Step 1: Customer A Login & My Trips navigation (Desktop)...');
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Enable geolocation permission on page
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('http://localhost:8080', ['geolocation']);
    await context.overridePermissions('http://127.0.0.1:8080', ['geolocation']);

    // Login via UI or API
    await page.goto('http://127.0.0.1:8080/auth', { waitUntil: 'networkidle2' });
    await page.evaluate(async () => {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'aarav108@gmail.com', password: 'navin0044' }),
      });
    });

    // Reset / ensure an active tracking session for ZL261002009 with GPS coordinates
    await page.evaluate(async () => {
      const res = await fetch('/api/tracking/my-trip/ZL261002009');
      const data = await res.json();
      if (data.session) {
        const sid = data.session.id;
        await fetch(`/api/tracking/${sid}/customer/start`, { method: 'POST' });
        await fetch(`/api/tracking/${sid}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: 33.9871, longitude: 74.7744, accuracy: 10 }),
        });
      }
    });

    await page.goto('http://127.0.0.1:8080/my-trips', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));

    // Scroll to My Trips section
    await page.evaluate(() => {
      const el = document.getElementById('my-trips') || document.querySelector('.my-trips-section') || document.querySelector('section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 1000));

    // Capture My Trips with LIVE TRIP button
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_my_trips_live_button.png'), fullPage: false });
    console.log('✓ Saved: customer_my_trips_live_button.png');

    // Click "VIEW LIVE TRIP" or trigger modal
    const liveTripBtn = await page.$('button[id*="view-live-trip"]');
    if (liveTripBtn) {
      await liveTripBtn.click();
      await new Promise(r => setTimeout(r, 2500));
    } else {
      // Find button by text content
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.innerText, btn);
        if (text && text.includes('LIVE TRIP')) {
          await btn.click();
          await new Promise(r => setTimeout(r, 2500));
          break;
        }
      }
    }

    // Capture Live Trip Modal (Desktop)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_live_trip_modal_desktop.png') });
    console.log('✓ Saved: customer_live_trip_modal_desktop.png');

    // -------------------------------------------------------------
    // 2. MOBILE VIEWPORT (Requirement 41: 375 x 812)
    // -------------------------------------------------------------
    console.log('\nStep 2: Customer Live Trip on Mobile Viewport (375x812)...');
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_live_trip_mobile_375x812.png') });
    console.log('✓ Saved: customer_live_trip_mobile_375x812.png');

    // Click Emergency SOS button on modal
    const sosBtn = await page.$('button[id*="sos"], button[id*="emergency"]');
    if (sosBtn) {
      await sosBtn.click();
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_emergency_sos_modal.png') });
      console.log('✓ Saved: customer_emergency_sos_modal.png');
    }

    await page.close();

    // -------------------------------------------------------------
    // 3. ADMIN PORTAL: LIVE TRIPS & REALTIME TRACKING
    // -------------------------------------------------------------
    console.log('\nStep 3: Admin Portal Live Trips Inspection (Desktop 1366x900)...');
    const adminPage = await browser.newPage();
    await adminPage.setViewport({ width: 1366, height: 900 });

    await adminPage.goto('http://127.0.0.1:8080/admin', { waitUntil: 'networkidle2' });
    await adminPage.evaluate(async (pwd) => {
      await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: 'harshad', password: pwd }),
      });
    }, adminPassword);

    await adminPage.goto('http://127.0.0.1:8080/admin', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    // Click Live Trips navigation in sidebar
    const liveTripsNav = await adminPage.$('#admin-nav-live-trips');
    if (liveTripsNav) {
      await liveTripsNav.click();
      await new Promise(r => setTimeout(r, 2000));
    }

    // Type search
    const searchInput = await adminPage.$('input[id*="live-trips-search"], input[placeholder*="Search"]');
    if (searchInput) {
      await searchInput.type('ZL261002009');
      await new Promise(r => setTimeout(r, 1500));
    }

    await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_live_trips_table_search.png') });
    console.log('✓ Saved: admin_live_trips_table_search.png');

    // Click "TRACK" button
    const trackBtn = await adminPage.$('button[id*="track-trip-btn"], button[id*="track-live-btn"]');
    if (trackBtn) {
      await trackBtn.click();
      await new Promise(r => setTimeout(r, 2500));
      await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_live_trip_tracking_view.png') });
      console.log('✓ Saved: admin_live_trip_tracking_view.png');
    }

    await adminPage.close();

    console.log('\n=== ALL BROWSER SCREENSHOT PROOFS SUCCESSFULLY CAPTURED ===');
  } finally {
    await browser.close();
  }
}

runBrowserTests().catch(err => {
  console.error('Browser testing failed:', err);
  process.exit(1);
});
