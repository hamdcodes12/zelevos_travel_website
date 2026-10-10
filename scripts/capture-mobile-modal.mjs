import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'artifacts/screenshots');

async function captureMobileModal() {
  console.log('--- Launching Chrome for Mobile Viewport Capture (375x812) ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

    // Login as Customer A
    await page.goto('http://127.0.0.1:8080/auth', { waitUntil: 'networkidle2' });
    await page.evaluate(async () => {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'aarav108@gmail.com', password: 'navin0044' }),
      });
    });

    await page.goto('http://127.0.0.1:8080/my-trips', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Click VIEW LIVE TRIP button
    const liveTripBtn = await page.$('#view-live-trip-header-btn') || await page.$('button[id*="view-live-trip"]');
    if (liveTripBtn) {
      await liveTripBtn.click();
    } else {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.innerText, btn);
        if (text && text.includes('LIVE TRIP')) {
          await btn.click();
          break;
        }
      }
    }

    await new Promise(r => setTimeout(r, 3000));

    // Screenshot mobile view
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_live_trip_mobile_375x812.png') });
    console.log('✓ Successfully saved: customer_live_trip_mobile_375x812.png');
  } finally {
    await browser.close();
  }
}

captureMobileModal().catch(err => {
  console.error('Error capturing mobile modal:', err);
  process.exit(1);
});
