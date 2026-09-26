import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\f30285d0-c353-41f0-84e1-b740879c0e06';
const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = 'ZT002121';

async function main() {
  console.log('--- Launching Puppeteer for Modal Captures ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    // Login if password prompt present
    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      await passInput.type(ADMIN_PASSWORD);
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) await submitBtn.click();
      await page.waitForFunction(() => !document.body.textContent.includes('Authenticating...'), { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1500));
    }

    // 1. Broadcast Recipients Modal
    console.log('Switching to Broadcasts & Offers tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const broadcastBtn = buttons.find((b) => b.textContent && b.textContent.includes('Broadcasts & Offers'));
      if (broadcastBtn) broadcastBtn.click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    console.log('Finding and clicking Recipients button...');
    const clickedRecipients = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const rBtn = buttons.find((b) => b.textContent && b.textContent.trim() === 'Recipients');
      if (rBtn) {
        rBtn.click();
        return true;
      }
      return false;
    });

    if (clickedRecipients) {
      console.log('Waiting for Recipients Modal...');
      await new Promise((r) => setTimeout(r, 2000));
      const screenPath = path.join(ARTIFACTS_DIR, 'admin_broadcast_recipients_modal.png');
      await page.screenshot({ path: screenPath, fullPage: false });
      console.log(`[SAVED] ${screenPath}`);

      // Close modal
      await page.evaluate(() => {
        const closeBtn = document.querySelector('div[class*="fixed"] button');
        if (closeBtn) closeBtn.click();
      });
      await new Promise((r) => setTimeout(r, 800));
    }

    // 2. User Information Tab & Dossier Modal
    console.log('Switching to User Information tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const userBtn = buttons.find((b) => b.textContent && b.textContent.includes('User Information'));
      if (userBtn) userBtn.click();
    });
    await new Promise((r) => setTimeout(r, 2500));

    console.log('Finding and clicking View Dossier button...');
    const clickedDossier = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const dBtn = buttons.find((b) => b.textContent && b.textContent.trim() === 'View Dossier');
      if (dBtn) {
        dBtn.click();
        return true;
      }
      return false;
    });

    if (clickedDossier) {
      console.log('Waiting for Customer Dossier Modal...');
      await new Promise((r) => setTimeout(r, 2500));
      const screenDossierOverview = path.join(ARTIFACTS_DIR, 'admin_customer_dossier_modal.png');
      await page.screenshot({ path: screenDossierOverview, fullPage: false });
      console.log(`[SAVED] ${screenDossierOverview}`);

      // 3. Switch to Activity Timeline Tab in Dossier
      console.log('Switching to Activity Timeline tab in Dossier...');
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const timelineTab = tabs.find((b) => b.textContent && (b.textContent.includes('Timeline') || b.textContent.includes('Activity')));
        if (timelineTab) timelineTab.click();
      });
      await new Promise((r) => setTimeout(r, 1500));

      const screenTimeline = path.join(ARTIFACTS_DIR, 'admin_customer_dossier_timeline.png');
      await page.screenshot({ path: screenTimeline, fullPage: false });
      console.log(`[SAVED] ${screenTimeline}`);
    }

    console.log('Modal captures completed!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Error in capture-modals:', err);
  process.exit(1);
});
