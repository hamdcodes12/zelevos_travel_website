import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'artifacts/screenshots');

const envText = fs.readFileSync('.env', 'utf-8');
const adminPassMatch = envText.match(/ADMIN_PASSWORD=["']?([^"'\r\n]+)/);
const adminPassword = adminPassMatch ? adminPassMatch[1] : '';

async function captureAdminProof() {
  console.log('--- CAPTURING ADMIN LIVE TRIPS SCREENSHOTS ---');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // Login as admin
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

    // Click sidebar button
    const liveTripsBtn = await page.$('#admin-nav-live-trips');
    if (liveTripsBtn) {
      await liveTripsBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }

    // Capture Table View
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_live_trips_table.png') });
    console.log('✓ Saved: admin_live_trips_table.png');

    // Click "TRACK" button on active row
    const trackBtn = await page.$('button[id*="track-trip-btn-"], button[id*="track-live-btn-"]');
    if (trackBtn) {
      console.log('Clicking TRACK button...');
      await trackBtn.click();
      await new Promise(r => setTimeout(r, 3000));

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_live_trip_tracking_view.png') });
      console.log('✓ Saved: admin_live_trip_tracking_view.png');
    } else {
      // Find track button in table
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.innerText, btn);
        if (text && text.trim() === 'TRACK') {
          console.log('Clicking TRACK button by text...');
          await btn.click();
          await new Promise(r => setTimeout(r, 3000));
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_live_trip_tracking_view.png') });
          console.log('✓ Saved: admin_live_trip_tracking_view.png');
          break;
        }
      }
    }
  } finally {
    await browser.close();
  }
}

captureAdminProof().catch(err => {
  console.error('Admin capture failed:', err);
  process.exit(1);
});
