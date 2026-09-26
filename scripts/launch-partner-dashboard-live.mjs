import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function openLiveDashboard() {
  console.log('=== OPENING LIVE CHROME BROWSER FOR INDEPENDENT PARTNER PORTAL DEMO ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false, // Opens visible Chrome window on user's screen!
    defaultViewport: null, // Fits maximized screen
    args: ['--start-maximized', '--no-sandbox']
  });

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  console.log('1. Opening Independent Partner Portal (/partner-portal)...');
  await page.goto(`${BASE_URL}/partner-portal`, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 800));

  console.log('2. Signing in as partner using referral code ZELVOYAGE17...');
  const demoChip = await page.waitForSelector('#demo-chip-zelvoyage17', { timeout: 5000 });
  await demoChip.click();
  await new Promise(r => setTimeout(r, 300));

  const submitBtn = await page.waitForSelector('#partner-login-btn', { timeout: 5000 });
  await submitBtn.click();

  await page.waitForFunction(
    () => document.body.textContent.includes('YOUR OFFICIAL ATTRIBUTION KIT'),
    { timeout: 15000 }
  );
  await new Promise(r => setTimeout(r, 1200));

  console.log('=== INDEPENDENT PARTNER WORKSPACE IS NOW LIVE ON YOUR SCREEN! ===');
  console.log('Route: http://localhost:3000/partner-portal');
  console.log('Completely isolated from Admin panel. Only partner data visible!');
  // Keep process alive for demonstration
  await new Promise(() => {});
}

openLiveDashboard().catch(console.error);

