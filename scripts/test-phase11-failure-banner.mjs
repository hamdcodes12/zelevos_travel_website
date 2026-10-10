import puppeteer from 'puppeteer-core';
import pg from '../lib/db/node_modules/pg/lib/index.js';
import path from 'node:path';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env');
  } catch {}
}

const { Client } = pg;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DB_URL = 'postgresql://postgres.hvsvqwrrkxjgrxiozjgz:e5nQzAKmnMQHRRoH@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
const SCREENSHOTS_DIR = path.resolve('artifacts', 'screenshots');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('=== TEST 5: FORCE FAILURE & ADMIN RED BANNER ===\n');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1024'],
    defaultViewport: { width: 1440, height: 1024 },
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(35000);

  let bookingId = null;
  let userId = null;
  const invalidEmail = `invalid-customer-email-test-${Date.now()}`;

  try {
    // 1. Get package
    const pkgRes = await client.query('SELECT id FROM packages LIMIT 1');
    const pkgId = pkgRes.rows[0].id;

    // 2. Insert test user with invalid email format (no @)
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, status)
       VALUES ($1, 'salt:hash', 'Failure Test Customer', 'user', 'active')
       RETURNING id`,
      [invalidEmail]
    );
    userId = userRes.rows[0].id;

    // 3. Insert confirmed booking with pnr and booking_reference
    const bookingRef = `ZL-FAIL-${Date.now()}`;
    const bookRes = await client.query(
      `INSERT INTO bookings (booking_id, booking_reference, pnr, customer_id, owner_id, package_id, status, payment_status, travel_date, total_price, customer_contact, kind, provider_mode)
       VALUES ($1, $1, $1, $2, $2, $3, 'CONFIRMED', 'CAPTURED', '2026-10-25', 45000, $4, 'PACKAGE', 'LIVE')
       RETURNING id`,
      [bookingRef, userId, pkgId, JSON.stringify({ name: 'Failure Test Customer', email: invalidEmail })]
    );
    bookingId = bookRes.rows[0].id;

    // 4. Admin login via browser
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
    await page.evaluate(async () => {
      await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ adminId: 'harshad', password: 'harshad@10' }),
      });
    });

    // 5. Initialize fulfillment & approve components
    const initRes = await page.evaluate(async (bId) => {
      const res = await fetch(`/api/admin/bookings/${bId}/fulfillment`, { credentials: 'include' });
      return res.json();
    }, bookingId);

    for (const item of initRes.items || []) {
      await page.evaluate(async (bId, itemId) => {
        await fetch(`/api/admin/bookings/${bId}/fulfillment/items/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'APPROVED' }),
        });
      }, bookingId, item.id);
    }

    // 6. Click Send to Customer (Fails because email has no @ symbol)
    console.log('Triggering Send Fulfillment to:', invalidEmail);
    const sendRes = await page.evaluate(async (bId) => {
      const res = await fetch(`/api/admin/bookings/${bId}/fulfillment/send`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.json();
    }, bookingId);

    console.log('Send Result:', JSON.stringify(sendRes, null, 2));

    // 7. Refresh admin page so auth session is loaded
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
    await delay(1500);

    // 8. Click "Bookings" tab in sidebar
    await page.waitForSelector('#admin-nav-bookings', { timeout: 10000 });
    await page.click('#admin-nav-bookings');
    console.log('Clicked #admin-nav-bookings');
    await delay(2000);

    // 9. Find the booking row and click Details
    await page.waitForFunction((ref) => {
      const rows = document.querySelectorAll('tr');
      for (const row of rows) {
        if (row.textContent?.includes(ref)) return true;
      }
      return false;
    }, { timeout: 15000 }, bookingRef);

    const clicked = await page.evaluate((ref) => {
      const rows = document.querySelectorAll('tr');
      for (const row of rows) {
        if (row.textContent?.includes(ref)) {
          const btns = row.querySelectorAll('button');
          for (const btn of btns) {
            if (btn.textContent?.includes('Details')) {
              btn.click();
              return true;
            }
          }
        }
      }
      return false;
    }, bookingRef);

    console.log('Clicked Details button:', clicked);
    await delay(3000);

    // 10. Wait for the red failure banner
    await page.waitForSelector('#fulfillment-email-failed-banner', { timeout: 10000 });

    // Scroll failure banner into view inside modal
    await page.evaluate(() => {
      const banner = document.getElementById('fulfillment-email-failed-banner');
      if (banner) {
        banner.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });
    await delay(1000);

    const shotFail = path.join(SCREENSHOTS_DIR, 'admin_email_failed_banner.png');
    await page.screenshot({ path: shotFail, fullPage: false });
    console.log('✓ Admin Failure Banner Screenshot Saved:', shotFail);

  } finally {
    if (bookingId) {
      await client.query(`DELETE FROM audit_logs WHERE resource_id = $1`, [bookingId]);
      await client.query(`DELETE FROM trip_fulfillment_items WHERE fulfillment_id IN (SELECT id FROM trip_fulfillments WHERE booking_id = $1)`, [bookingId]);
      await client.query(`DELETE FROM trip_fulfillments WHERE booking_id = $1`, [bookingId]);
      await client.query(`DELETE FROM bookings WHERE id = $1`, [bookingId]);
    }
    if (userId) {
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    }
    console.log('Cleaned up failure test booking & user');
    await client.end();
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
