import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\f30285d0-c353-41f0-84e1-b740879c0e06';
const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = 'ZT002121';

async function main() {
  console.log('--- Capturing Final Proof Screenshots ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  try {
    console.log('Logging in to Admin...');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      await passInput.type(ADMIN_PASSWORD);
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) await submitBtn.click();
      await page.waitForFunction(() => !document.body.textContent.includes('Authenticating...'), { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1500));
    }

    // -----------------------------------------------------------------
    // 1. Admin Broadcasts & Offers Tab
    // -----------------------------------------------------------------
    console.log('1. Navigating to Broadcasts & Offers Tab...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const bBtn = btns.find((b) => b.textContent && b.textContent.includes('Broadcasts & Offers'));
      if (bBtn) bBtn.click();
    });
    // Wait 4 seconds for broadcast API call to resolve
    await new Promise((r) => setTimeout(r, 4000));

    const screen1 = path.join(ARTIFACTS_DIR, 'admin_broadcast_offers_tab.png');
    await page.screenshot({ path: screen1, fullPage: false });
    console.log(`[SAVED] ${screen1}`);

    // -----------------------------------------------------------------
    // 2. Broadcast Recipients Engagement Modal
    // -----------------------------------------------------------------
    console.log('2. Opening Recipients Engagement Modal...');
    const clickedR = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const rBtn = btns.find((b) => b.textContent && b.textContent.trim() === 'Recipients');
      if (rBtn) {
        rBtn.click();
        return true;
      }
      return false;
    });

    if (clickedR) {
      await new Promise((r) => setTimeout(r, 3000));
      const screen2 = path.join(ARTIFACTS_DIR, 'admin_broadcast_recipients_modal.png');
      await page.screenshot({ path: screen2, fullPage: false });
      console.log(`[SAVED] ${screen2}`);
    } else {
      console.log('Could not find Recipients button on broadcasts list.');
    }

    // -----------------------------------------------------------------
    // 3. User Information Tab (Monospace IDs & NEW tags)
    // -----------------------------------------------------------------
    console.log('3. Navigating to User Information Tab...');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const uBtn = btns.find((b) => b.textContent && b.textContent.includes('User Information'));
      if (uBtn) uBtn.click();
    });
    // Wait 4 seconds for customers API call to populate rows
    await new Promise((r) => setTimeout(r, 4000));

    const screen3 = path.join(ARTIFACTS_DIR, 'admin_user_information_tab.png');
    await page.screenshot({ path: screen3, fullPage: false });
    console.log(`[SAVED] ${screen3}`);

    // -----------------------------------------------------------------
    // 4. Customer Dossier Modal (Overview)
    // -----------------------------------------------------------------
    console.log('4. Opening Customer Dossier Modal...');
    const clickedD = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dBtn = btns.find((b) => b.textContent && b.textContent.trim() === 'View Dossier');
      if (dBtn) {
        dBtn.click();
        return true;
      }
      return false;
    });

    if (clickedD) {
      await new Promise((r) => setTimeout(r, 3500));
      const screen4 = path.join(ARTIFACTS_DIR, 'admin_customer_dossier_modal.png');
      await page.screenshot({ path: screen4, fullPage: false });
      console.log(`[SAVED] ${screen4}`);

      // -----------------------------------------------------------------
      // 5. Customer Dossier Modal (Activity Timeline Tab)
      // -----------------------------------------------------------------
      console.log('5. Switching to Real Activity Timeline Tab in Dossier...');
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const tTab = tabs.find((b) => b.textContent && b.textContent.includes('Timeline'));
        if (tTab) tTab.click();
      });
      await new Promise((r) => setTimeout(r, 2000));

      const screen5 = path.join(ARTIFACTS_DIR, 'admin_customer_dossier_timeline.png');
      await page.screenshot({ path: screen5, fullPage: false });
      console.log(`[SAVED] ${screen5}`);
    } else {
      console.log('Could not find View Dossier button.');
    }

    console.log('All admin proof screenshots completed successfully!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
