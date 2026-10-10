import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('[Puppeteer] Launching Chrome headful on desktop...');
  
  // Use a temporary user data dir so it never conflicts with already running Chrome instances
  const userDataDir = path.resolve(process.cwd(), 'scratch/chrome-profile');
  fs.mkdirSync(userDataDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    userDataDir,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--auto-open-devtools-for-tabs',
      '--window-size=1400,900',
    ],
  });

  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  page.on('console', (msg) => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });

  page.on('request', (req) => {
    if (req.url().includes('/api/auth/')) {
      console.log(`[Browser Network >>] ${req.method()} ${req.url()}`);
      // Do NOT log post data to protect credentials
    }
  });

  page.on('response', async (res) => {
    if (res.url().includes('/api/auth/')) {
      const status = res.status();
      console.log(`[Browser Network <<] ${status} ${res.url()}`);
      try {
        const text = await res.text();
        console.log(`[Browser Response Body] ${text}`);
      } catch (e) {
        console.log(`[Browser Response Read Error]`, e.message);
      }
    }
  });

  console.log('[Puppeteer] Navigating to http://localhost:8080/ ...');
  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('[Puppeteer] Waiting for .started-button...');
  await page.waitForSelector('.started-button', { timeout: 15000 });

  console.log('[Puppeteer] Opening registration dialog...');
  await page.click('.started-button');

  // Verify registration form is visible
  await page.waitForSelector('#login-submit-btn', { timeout: 10000 });
  const buttonText = await page.$eval('#login-submit-btn', (el) => el.innerText.trim());
  console.log(`[Puppeteer] Form visible. Submit button text: "${buttonText}"`);

  // Ensure it is in signup mode
  if (buttonText.includes('Log in')) {
    const signupTab = await page.$('#auth-tab-signup');
    if (signupTab) {
      await signupTab.click();
      console.log('[Puppeteer] Switched to Sign up tab.');
    }
  }

  console.log('================================================================');
  console.log('REGISTRATION FORM IS READY FOR MANUAL USER ENTRY.');
  console.log('Awaiting manual submission of signup / Send OTP by user.');
  console.log('================================================================');

  // Keep process alive so browser remains open for user manual entry
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('[Puppeteer Error]', err);
  process.exit(1);
});
