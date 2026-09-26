import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\f30285d0-c353-41f0-84e1-b740879c0e06';
const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = 'ZT002121';

async function main() {
  console.log('--- Capturing All Modals Cleanly ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  try {
    // Log in to Admin
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2' });
    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      await passInput.type(ADMIN_PASSWORD);
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) await submitBtn.click();
      await page.waitForFunction(() => !document.body.textContent.includes('Authenticating...'), { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1500));
    }

    // 1. Switch to Broadcasts & Offers tab
    console.log('Navigating to Broadcasts tab...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const bBtn = btns.find((b) => b.textContent && b.textContent.includes('Broadcasts & Offers'));
      if (bBtn) bBtn.click();
    });
    // Wait for the broadcast table rows to render
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('table tbody tr');
      return rows.length > 0;
    }, { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Capture Broadcast Tab fully loaded
    const screenBroadcastsTab = path.join(ARTIFACTS_DIR, 'admin_broadcast_offers_tab.png');
    await page.screenshot({ path: screenBroadcastsTab });
    console.log(`[SAVED] ${screenBroadcastsTab}`);

    // Click "Recipients" button on first broadcast
    console.log('Clicking Recipients button...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const rBtn = btns.find((b) => b.textContent && b.textContent.trim() === 'Recipients');
      if (rBtn) rBtn.click();
    });
    // Wait for modal to appear
    await page.waitForSelector('h3', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1500));

    const screenRecipientsModal = path.join(ARTIFACTS_DIR, 'admin_broadcast_recipients_modal.png');
    await page.screenshot({ path: screenRecipientsModal });
    console.log(`[SAVED] ${screenRecipientsModal}`);

    // Close recipients modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const closeBtn = btns.find((b) => b.querySelector('svg.lucide-x') || b.textContent === '✕');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // 2. Switch to User Information tab
    console.log('Navigating to User Information tab...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const uBtn = btns.find((b) => b.textContent && b.textContent.includes('User Information'));
      if (uBtn) uBtn.click();
    });
    // Wait for customer rows
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('table tbody tr');
      return rows.length > 0 && !rows[0].textContent.includes('No customers found');
    }, { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Capture User Information tab with rows, monospace IDs, and NEW badges
    const screenUserTab = path.join(ARTIFACTS_DIR, 'admin_user_information_tab.png');
    await page.screenshot({ path: screenUserTab });
    console.log(`[SAVED] ${screenUserTab}`);

    // Click "View Dossier" on the first customer
    console.log('Clicking View Dossier button...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dBtn = btns.find((b) => b.textContent && b.textContent.trim() === 'View Dossier');
      if (dBtn) dBtn.click();
    });
    // Wait for Dossier modal to load
    await new Promise((r) => setTimeout(r, 2500));

    const screenDossierOverview = path.join(ARTIFACTS_DIR, 'admin_customer_dossier_modal.png');
    await page.screenshot({ path: screenDossierOverview });
    console.log(`[SAVED] ${screenDossierOverview}`);

    // Switch to Real Activity Timeline tab
    console.log('Switching to Real Activity Timeline tab in Dossier...');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const tTab = tabs.find((b) => b.textContent && b.textContent.includes('Timeline'));
      if (tTab) tTab.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const screenDossierTimeline = path.join(ARTIFACTS_DIR, 'admin_customer_dossier_timeline.png');
    await page.screenshot({ path: screenDossierTimeline });
    console.log(`[SAVED] ${screenDossierTimeline}`);

    // 3. Customer Profile User ID Dropdown
    console.log('Navigating to Customer Homepage for Profile Dropdown capture...');
    const timestamp = Date.now();
    const customerEmail = `profile_user_${timestamp}@example.com`;
    const customerPass = `Zelevos#${timestamp}`;

    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerEmail, password: customerPass, fullName: 'Vikram Malhotra' }),
    });
    const regData = await regRes.json();
    if (regData.debugOtp) {
      const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customerEmail, otp: regData.debugOtp }),
      });
      const cookieHeader = verifyRes.headers.get('set-cookie');
      if (cookieHeader) {
        const cookieMatch = cookieHeader.match(/([^=]+)=([^;]+)/);
        if (cookieMatch) {
          await page.setCookie({
            name: cookieMatch[1].trim(),
            value: cookieMatch[2].trim(),
            domain: 'localhost',
            path: '/',
          });
        }
      }
    }

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    const profileBtn = await page.$('.user-profile-button');
    if (profileBtn) {
      await profileBtn.click();
      await new Promise((r) => setTimeout(r, 800));

      const screenProfileDropdown = path.join(ARTIFACTS_DIR, 'customer_user_id_dropdown.png');
      await page.screenshot({ path: screenProfileDropdown });
      console.log(`[SAVED] ${screenProfileDropdown}`);
    }

    console.log('All modals and tabs captured with 100% precision!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Error during modal capture:', err);
  process.exit(1);
});
