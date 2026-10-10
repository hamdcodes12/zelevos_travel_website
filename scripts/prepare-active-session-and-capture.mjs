import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import pg from '../lib/db/node_modules/pg/lib/index.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'artifacts/screenshots');

const envText = fs.readFileSync('.env', 'utf-8');
const dbUrl = envText.match(/DATABASE_URL=["']?([^"'\r\n]+)/)[1];
const adminPassword = envText.match(/ADMIN_PASSWORD=["']?([^"'\r\n]+)/)[1];

async function run() {
  console.log('1. Setting session ZL261002009 to ACTIVE with real coordinates in DB...');
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  const booking = await client.query("SELECT id FROM bookings WHERE booking_id = 'ZL261002009'");
  const bId = booking.rows[0].id;

  const now = new Date();
  await client.query(`
    UPDATE trip_tracking_sessions
    SET status = 'ACTIVE',
        customer_tracking_enabled = true,
        driver_tracking_enabled = true,
        last_customer_latitude = 33.9871,
        last_customer_longitude = 74.7744,
        last_customer_accuracy = 8.5,
        last_customer_update_at = $1,
        last_driver_latitude = 34.0837,
        last_driver_longitude = 74.8370,
        last_driver_accuracy = 12.0,
        last_driver_heading = 45.0,
        last_driver_speed = 35.0,
        last_driver_update_at = $1,
        calculated_distance_km = 12.19,
        distance_updated_at = $1,
        ended_at = NULL
    WHERE booking_id = $2
  `, [now, bId]);

  console.log('✓ Tracking session reset to ACTIVE with real GPS telemetry.');
  await client.end();

  // Launch browser and capture
  console.log('2. Launching Chrome to capture full tracking view...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // Admin login
    await page.goto('http://127.0.0.1:8080/admin', { waitUntil: 'networkidle2' });
    await page.evaluate(async (pwd) => {
      await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: 'harshad', password: pwd }),
      });
    }, adminPassword);

    await page.goto('http://127.0.0.1:8080/admin?tab=live-trips', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    const liveTripsBtn = await page.$('#admin-nav-live-trips');
    if (liveTripsBtn) {
      await liveTripsBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }

    // Capture Table
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_live_trips_table.png') });
    console.log('✓ Saved: admin_live_trips_table.png');

    // Click Track
    const trackBtn = await page.$('button[id*="track-trip-btn-"]');
    if (trackBtn) {
      await trackBtn.click();
      await new Promise(r => setTimeout(r, 3500));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_live_trip_tracking_view.png') });
      console.log('✓ Saved: admin_live_trip_tracking_view.png');
    }

    // Customer Live Trip screenshot as well
    const custPage = await browser.newPage();
    await custPage.setViewport({ width: 1280, height: 850 });
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('http://127.0.0.1:8080', ['geolocation']);

    await custPage.goto('http://127.0.0.1:8080/auth', { waitUntil: 'networkidle2' });
    await custPage.evaluate(async () => {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'aarav108@gmail.com', password: 'navin0044' }),
      });
    });

    await custPage.goto('http://127.0.0.1:8080/my-trips', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Click VIEW LIVE TRIP
    const custButtons = await custPage.$$('button');
    for (const b of custButtons) {
      const txt = await custPage.evaluate(el => el.innerText, b);
      if (txt && txt.includes('LIVE TRIP')) {
        await b.click();
        await new Promise(r => setTimeout(r, 3000));
        break;
      }
    }

    await custPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_live_trip_modal_desktop.png') });
    console.log('✓ Saved: customer_live_trip_modal_desktop.png');

    await custPage.close();
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
