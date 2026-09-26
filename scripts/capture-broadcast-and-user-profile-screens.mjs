import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\f30285d0-c353-41f0-84e1-b740879c0e06';
const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = 'ZT002121';

async function main() {
  console.log('--- Launching Chrome via Puppeteer ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  try {
    // -------------------------------------------------------------
    // SCREEN 1: Admin Broadcasts & Offers Tab
    // -------------------------------------------------------------
    console.log('Navigating to Admin Portal...');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    // Admin login if on login screen
    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      await passInput.type(ADMIN_PASSWORD);
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) await submitBtn.click();
      await page.waitForFunction(() => !document.body.textContent.includes('Authenticating...'), { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Click "📢 Broadcasts & Offers" tab
    console.log('Switching to Broadcasts & Offers tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const broadcastBtn = buttons.find((b) => b.textContent && b.textContent.includes('Broadcasts & Offers'));
      if (broadcastBtn) broadcastBtn.click();
    });
    try {
      await page.waitForFunction(() => !document.body.textContent.includes('Loading broadcast records...') && document.querySelector('table'), { timeout: 15000 });
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
    await new Promise((r) => setTimeout(r, 1000));

    const screen1Path = path.join(ARTIFACTS_DIR, 'admin_broadcast_offers_tab.png');
    await page.screenshot({ path: screen1Path, fullPage: false });
    console.log(`[SAVED] ${screen1Path}`);

    // -------------------------------------------------------------
    // SCREEN 2: Admin Broadcast Recipients Engagement Modal
    // -------------------------------------------------------------
    console.log('Opening Broadcast Engagement Modal...');
    const openedRecipientsModal = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const targetBtn = btns.find((b) => b.textContent && (b.textContent.includes('Engagement') || b.textContent.includes('Recipients')));
      if (targetBtn) {
        targetBtn.click();
        return true;
      }
      return false;
    });

    if (openedRecipientsModal) {
      try {
        await page.waitForFunction(() => document.body.textContent.includes('Delivery & Engagement Roster') && !document.body.textContent.includes('Loading recipients...'), { timeout: 15000 });
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
      await new Promise((r) => setTimeout(r, 800));
      const screen2Path = path.join(ARTIFACTS_DIR, 'admin_broadcast_recipients_modal.png');
      await page.screenshot({ path: screen2Path, fullPage: false });
      console.log(`[SAVED] ${screen2Path}`);

      // Close modal
      await page.evaluate(() => {
        const closeBtn = document.querySelector('button[aria-label="Close modal"]') || document.querySelector('button svg.lucide-x')?.parentElement;
        if (closeBtn) closeBtn.click();
      });
      await new Promise((r) => setTimeout(r, 800));
    }

    // -------------------------------------------------------------
    // SCREEN 3: Admin User Information Tab (Search by ZLV-CUS)
    // -------------------------------------------------------------
    console.log('Switching to User Information tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const userBtn = buttons.find((b) => b.textContent && b.textContent.includes('User Information'));
      if (userBtn) userBtn.click();
    });
    try {
      await page.waitForFunction(() => {
        const hasRows = document.querySelectorAll('tbody tr').length > 0;
        const notLoading = !document.body.textContent.includes('Loading customer records...');
        return hasRows && notLoading;
      }, { timeout: 15000 });
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
    await new Promise((r) => setTimeout(r, 1000));

    // Type in search box to filter by ZLV-CUS and press Enter
    const searchInput = await page.$('input[placeholder*="Search by User ID"]');
    if (searchInput) {
      await searchInput.type('ZLV-CUS');
      await page.keyboard.press('Enter');
      try {
        await page.waitForFunction(() => !document.body.textContent.includes('Loading customer records...'), { timeout: 10000 });
      } catch {}
      await new Promise((r) => setTimeout(r, 1200));
    }

    const screen3Path = path.join(ARTIFACTS_DIR, 'admin_user_information_tab.png');
    await page.screenshot({ path: screen3Path, fullPage: false });
    console.log(`[SAVED] ${screen3Path}`);

    // -------------------------------------------------------------
    // SCREEN 4: Admin Customer Dossier Modal (Overview)
    // -------------------------------------------------------------
    console.log('Opening Customer Dossier Modal...');
    const openedDossier = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dossierBtn = btns.find((b) => b.textContent && b.textContent.includes('View Dossier'));
      if (dossierBtn) {
        dossierBtn.click();
        return true;
      }
      return false;
    });
    console.log('Dossier button clicked:', openedDossier);

    if (openedDossier) {
      try {
        await page.waitForFunction(() => {
          return document.body.textContent.includes('Customer Dossier Reference') ||
            document.body.textContent.includes('ACCOUNT CREDENTIALS & VERIFICATION') ||
            (document.querySelector('button[aria-label="Close dossier"]') && !document.body.textContent.includes('Loading complete customer dossier...'));
        }, { timeout: 25000 });
      } catch {
        await new Promise((r) => setTimeout(r, 4000));
      }
      await new Promise((r) => setTimeout(r, 1200));
      const screen4Path = path.join(ARTIFACTS_DIR, 'admin_customer_dossier_modal.png');
      await page.screenshot({ path: screen4Path, fullPage: false });
      console.log(`[SAVED] ${screen4Path}`);

      // -------------------------------------------------------------
      // SCREEN 5: Admin Customer Dossier Timeline Tab
      // -------------------------------------------------------------
      console.log('Switching to Real Activity Timeline tab...');
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const timelineTab = tabs.find((b) => b.textContent && b.textContent.includes('Timeline'));
        if (timelineTab) timelineTab.click();
      });
      try {
        await page.waitForFunction(() => {
          return document.body.textContent.includes('Strict Integrity Mode') ||
            document.body.textContent.includes('Account Registered') ||
            document.body.textContent.includes('Customer Login');
        }, { timeout: 15000 });
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
      await new Promise((r) => setTimeout(r, 1000));

      const screen5Path = path.join(ARTIFACTS_DIR, 'admin_customer_dossier_timeline.png');
      await page.screenshot({ path: screen5Path, fullPage: false });
      console.log(`[SAVED] ${screen5Path}`);

      // Close dossier modal
      await page.evaluate(() => {
        const closeBtn = document.querySelector('button[aria-label="Close dossier"]') || document.querySelector('button svg.lucide-x')?.parentElement;
        if (closeBtn) closeBtn.click();
      });
      await new Promise((r) => setTimeout(r, 800));
    }

    // -------------------------------------------------------------
    // SCREEN 6 & 7: Customer UI Notification Drawer & User ID
    // -------------------------------------------------------------
    console.log('Navigating to Customer Homepage...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    // Sign in as customer or check navbar
    const loginBtn = await page.$('.login-button');
    if (loginBtn) {
      console.log('Signing in customer on homepage...');
      const timestamp = Date.now();
      const customerEmail = `cus_ui_${timestamp}@example.com`;
      const customerPass = `ZelevosPass#${timestamp}`;

      // Register quick customer via API to get auth cookie
      const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customerEmail, password: customerPass, fullName: 'Tanya Sengupta' }),
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
      await page.reload({ waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Click Notification bell button
    console.log('Clicking notification bell in navbar...');
    const notifBtn = await page.$('#navbar-notifications-btn');
    if (notifBtn) {
      await notifBtn.click();
      await new Promise((r) => setTimeout(r, 1200));

      const screen6Path = path.join(ARTIFACTS_DIR, 'customer_notification_drawer.png');
      await page.screenshot({ path: screen6Path, fullPage: false });
      console.log(`[SAVED] ${screen6Path}`);

      // Close drawer
      const closeNotifBtn = await page.$('#close-notifications-btn');
      if (closeNotifBtn) {
        await closeNotifBtn.click();
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Open User profile dropdown
    console.log('Opening User profile menu dropdown...');
    const profileBtn = await page.$('#user-profile-dropdown-btn') || await page.$('.user-profile-button');
    if (profileBtn) {
      await profileBtn.click();
      try {
        await page.waitForSelector('.user-menu-dropdown', { visible: true, timeout: 5000 });
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }

      const screen7Path = path.join(ARTIFACTS_DIR, 'customer_user_id_dropdown.png');
      await page.screenshot({ path: screen7Path, fullPage: false });
      console.log(`[SAVED] ${screen7Path}`);
    }

    // -------------------------------------------------------------
    // SCREEN 8: Vendor Portal Header (Vendor ID: ZLV-VND-XXXXXX)
    // -------------------------------------------------------------
    console.log('Navigating to Vendor Portal...');
    await page.goto(`${BASE_URL}/vendor-portal`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    const screen8Path = path.join(ARTIFACTS_DIR, 'vendor_portal_header_vendor_id.png');
    await page.screenshot({ path: screen8Path, fullPage: false });
    console.log(`[SAVED] ${screen8Path}`);

    console.log('All visual screen captures completed successfully!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Error during screen capture:', err);
  process.exit(1);
});
