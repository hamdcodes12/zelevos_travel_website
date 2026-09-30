import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  console.log('1. Authenticating customer via API...');
  const loginRes = await fetch('http://localhost:8080/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'traveler99@zelevos.com', password: 'TravelerPass99!' })
  });

  const cookieHeader = loginRes.headers.get('set-cookie');
  let sessionValue = '';
  if (cookieHeader) {
    const match = cookieHeader.match(/zelevos_session=([^;]+)/);
    if (match) sessionValue = match[1];
  }

  console.log('2. Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,960']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 960 });

  page.on('console', msg => {
    const txt = msg.text();
    if (txt.includes('Razorpay') || txt.includes('Payment') || txt.includes('error') || txt.includes('Error')) {
      console.log('Browser Console:', txt);
    }
  });

  if (sessionValue) {
    await page.setCookie({
      name: 'zelevos_session',
      value: sessionValue,
      domain: 'localhost',
      path: '/',
      httpOnly: true
    });
  }

  console.log('3. Navigating to package page...');
  await page.goto('http://localhost:8080/packages/vip-exclusive-kashmir-6726', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#book-now-package-btn', { timeout: 15000 });

  console.log('4. Opening checkout modal...');
  await page.click('#book-now-package-btn');
  await page.waitForSelector('#confirm-pay-btn', { timeout: 15000 });

  console.log('5. Clicking Pay with Razorpay button (#confirm-pay-btn)...');
  await page.click('#confirm-pay-btn');

  console.log('6. Waiting 20 seconds for Booking + Email + Razorpay Order + Razorpay Modal to open...');
  for (let i = 1; i <= 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    // Check if Razorpay iframe is present in DOM
    const hasIframe = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.some(f => f.src.includes('razorpay') || f.name.includes('razorpay') || f.className.includes('razorpay'));
    });
    if (hasIframe) {
      console.log(`Razorpay iframe detected at second ${i}! Waiting 3 more seconds for full paint...`);
      await new Promise(r => setTimeout(r, 3000));
      break;
    }
  }

  const gatewayPath = path.join(rootDir, 'screenshots', 'real_live_razorpay_gateway.png');
  await page.screenshot({ path: gatewayPath });
  console.log('Saved screenshots/real_live_razorpay_gateway.png');

  await browser.close();
  console.log('Done!');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
