import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\ff51c7fd-1d5c-4e3a-b4c7-e6aad8f9af04';
const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = 'ZT002121';

async function runDemo() {
  console.log('=== STARTING PARTNER DASHBOARD AUTOMATED CAPTURE ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true, // We will also take crisp screenshots
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  // 1. Admin Login
  console.log('1. Navigating to Admin Login...');
  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="password"]');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_partner_admin_login.png') });

  console.log('2. Entering Admin password and signing in...');
  await page.type('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForFunction(
    () => !document.body.textContent.includes('Authenticating...') && document.body.textContent.includes('Zelevos Admin'),
    { timeout: 12000 }
  );
  await new Promise(r => setTimeout(r, 1200));

  // 2. Click Partner Network Tab
  console.log('3. Clicking Partner Network tab...');
  const partnerTabBtn = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('aside button, .admin-nav button, button'));
    return buttons.find(b => b.textContent && b.textContent.includes('Partner Network'));
  });

  if (partnerTabBtn) {
    await partnerTabBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('4. Capturing Partner Dashboard overview...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02_partner_dashboard_overview.png') });

  // 3. Register a test partner
  console.log('5. Filling Partner Registration form...');
  const agencyInput = await page.$('#partner-agency-name');
  if (agencyInput) {
    await page.evaluate(() => {
      const el = document.querySelector('#partner-agency-name');
      if (el) el.value = '';
    });
    await agencyInput.type('Voyage Luxury Holidays');

    const contactInput = await page.$('#partner-contact-name');
    if (contactInput) {
      await page.evaluate(() => {
        const el = document.querySelector('#partner-contact-name');
        if (el) el.value = '';
      });
      await contactInput.type('Rahul Sharma');
    }

    const emailInput = await page.$('#partner-email');
    if (emailInput) {
      await page.evaluate(() => {
        const el = document.querySelector('#partner-email');
        if (el) el.value = '';
      });
      await emailInput.type(`rahul.sharma.${Date.now().toString().slice(-4)}@voyageholidays.in`);
    }

    const phoneInput = await page.$('#partner-phone');
    if (phoneInput) {
      await page.evaluate(() => {
        const el = document.querySelector('#partner-phone');
        if (el) el.value = '';
      });
      await phoneInput.type('+91 98765 43210');
    }

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_partner_form_filled.png') });

    console.log('6. Submitting Partner Registration...');
    const submitBtn = await page.$('#submit-partner-register-btn, button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('7. Capturing generated Referral Code and Activation Banner...');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04_partner_activated_referral_banner.png') });
  }

  // 4. Capture Commission Ledger Table
  console.log('8. Capturing Partner Commission Ledger...');
  await page.evaluate(() => window.scrollBy(0, 300));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05_partner_commission_ledger.png') });

  // 5. Public Homepage Partner Section
  console.log('9. Navigating to Homepage to capture public partner section...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hero');

  const partnerSec = await page.$('#partner-program, .partner-section, .partner-banner');
  if (partnerSec) {
    await page.evaluate(() => {
      const el = document.querySelector('#partner-program') || document.querySelector('.partner-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '06_public_partner_banner.png') });

    // Open public partner modal
    const partnerBtn = await page.$('button[id*="partner"], .partner-cta-btn, button');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('Become a Zelevos Authorised Partner'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '07_public_partner_application_modal.png') });
  }

  console.log('=== PARTNER DEMO SCREENSHOTS CAPTURED SUCCESSFULLY! ===');
  await browser.close();
}

runDemo().catch(err => {
  console.error('Demo error:', err);
  process.exit(1);
});
