import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  console.log('Launching Chrome to capture live payment & checkout...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,960']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 960 });

  // 1. First ensure user exists in DB
  await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(async () => {
    try {
      await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: 'rahul.verma@example.com',
          password: 'Password123!',
          fullName: 'Rahul Verma',
          phone: '+91 98765 12345',
          role: 'CUSTOMER'
        })
      });
    } catch (e) {}
  });

  // 2. Click "Log in" button on navbar
  console.log('Clicking Log in button on navbar...');
  const loginClicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Log in');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Login button clicked:', loginClicked);
  await new Promise(r => setTimeout(r, 1500));

  // 3. Fill login credentials in modal
  console.log('Filling login credentials...');
  await page.evaluate(() => {
    const emailInput = document.querySelector('input[type="email"]');
    if (emailInput) {
      emailInput.value = 'rahul.verma@example.com';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const passInput = document.querySelector('input[type="password"]');
    if (passInput) {
      passInput.value = 'Password123!';
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
      passInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const form = document.querySelector('form');
    const submitBtn = form?.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Log In') || b.innerText.includes('Sign In'));
    if (submitBtn) submitBtn.click();
  });

  console.log('Submitted login form, awaiting user session...');
  await new Promise(r => setTimeout(r, 3000));

  // 4. Open package modal
  console.log('Opening package: vip-exclusive-kashmir-6726...');
  await page.goto('http://localhost:8080/packages/vip-exclusive-kashmir-6726', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // 5. Click "Book This Holiday" button
  console.log('Clicking #book-now-package-btn...');
  const bookBtnClicked = await page.evaluate(() => {
    const btn = document.querySelector('#book-now-package-btn') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Book This Holiday'));
    if (btn) {
      btn.click();
      return btn.innerText;
    }
    return null;
  });
  console.log('Book button clicked:', bookBtnClicked);
  await new Promise(r => setTimeout(r, 2500));

  // 6. Capture real Checkout Modal with price breakdown & Razorpay button!
  const checkoutScreenshot = path.join(rootDir, 'screenshots', 'real_live_checkout_modal.png');
  await page.screenshot({ path: checkoutScreenshot });
  console.log('Saved real_live_checkout_modal.png');

  // 7. Click "Pay securely with Razorpay" button (#confirm-pay-btn)
  console.log('Clicking Pay securely with Razorpay button (#confirm-pay-btn)...');
  const payClicked = await page.evaluate(() => {
    const btn = document.querySelector('#confirm-pay-btn');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Pay button clicked:', payClicked);

  // Await Razorpay iframe or modal to open (takes 2-4 seconds to load from Razorpay CDN)
  await new Promise(r => setTimeout(r, 6000));

  // 8. Capture the payment gateway screen / popup!
  const gatewayScreenshot = path.join(rootDir, 'screenshots', 'real_live_razorpay_gateway.png');
  await page.screenshot({ path: gatewayScreenshot });
  console.log('Saved real_live_razorpay_gateway.png');

  await browser.close();
  console.log('DONE! Real payment photos captured successfully.');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
