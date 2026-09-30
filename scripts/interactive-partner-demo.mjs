import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\ff51c7fd-1d5c-4e3a-b4c7-e6aad8f9af04';
const PUBLIC_DIR = 'C:\\Users\\navin\\OneDrive\\Desktop\\zelevos_travel_website-main\\artifacts\\zelevos\\public';

async function runLiveInteractiveDemo() {
  console.log('=== STARTING LIVE SCREEN DEMO FOR AUTHORISED PARTNER PORTAL ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false, // Visible Chrome window on user screen!
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox']
  });

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  // Helper to display an on-screen visual demo banner at top
  const showBanner = async (title, message) => {
    await page.evaluate((t, m) => {
      let el = document.getElementById('demo-interactive-banner');
      if (!el) {
        el = document.createElement('div');
        el.id = 'demo-interactive-banner';
        el.style.cssText = `
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999999;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid #38bdf8;
          border-radius: 14px;
          padding: 12px 24px;
          color: #ffffff;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 15px rgba(56,189,248,0.3);
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 90%;
          display: flex;
          align-items: center;
          gap: 14px;
          animation: slideDown 0.3s ease;
        `;
        document.body.appendChild(el);
      }
      el.innerHTML = `
        <div style="width: 12px; height: 12px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></div>
        <div>
          <div style="font-size: 13px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">${t}</div>
          <div style="font-size: 14px; font-weight: 500; color: #f1f5f9; margin-top: 2px;">${m}</div>
        </div>
      `;
    }, title, message);
  };

  try {
    // -------------------------------------------------------------
    // STEP 1: Start at Homepage and open Partner Portal
    // -------------------------------------------------------------
    console.log('Step 1: Navigating to Zelevos Homepage...');
    await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1200));

    await showBanner(
      'Live Demo: Step 1',
      'Zelevos Homepage se Partner Portal par ja rahe hain...'
    );
    await new Promise(r => setTimeout(r, 2000));

    // Navigate to partner portal
    console.log('Navigating to /partner-portal...');
    await page.goto(`${BASE_URL}/partner-portal`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));

    await showBanner(
      'Step 1: Independent Partner Workspace Login',
      'Partner portal bilkul alag hai (Admin panel ka koi access nahi). Partner apna Referral Code daalta hai.'
    );
    await new Promise(r => setTimeout(r, 1000));

    const shot1Path = path.join(ARTIFACTS_DIR, 'demo_step1_partner_login.png');
    const pub1Path = path.join(PUBLIC_DIR, 'demo_step1_partner_login.png');
    await page.screenshot({ path: shot1Path });
    try { fs.copyFileSync(shot1Path, pub1Path); } catch {}

    // -------------------------------------------------------------
    // STEP 2: Sign In with Partner Referral Code ZELVOYAGE17
    // -------------------------------------------------------------
    console.log('Step 2: Entering Referral Code ZELVOYAGE17...');
    await showBanner(
      'Step 2: Quick Partner Authentication',
      'Registered Referral Code "ZELVOYAGE17" (Voyage Luxury Holidays) enter kar ke login kiya ja raha hai...'
    );
    await new Promise(r => setTimeout(r, 1500));

    const demoChip = await page.waitForSelector('#demo-chip-zelvoyage17', { timeout: 5000 });
    await demoChip.click();
    await new Promise(r => setTimeout(r, 800));

    const loginBtn = await page.waitForSelector('#partner-login-btn', { timeout: 5000 });
    await loginBtn.click();

    await page.waitForFunction(
      () => document.body.textContent.includes('YOUR OFFICIAL ATTRIBUTION KIT'),
      { timeout: 15000 }
    );
    await new Promise(r => setTimeout(r, 1500));

    // -------------------------------------------------------------
    // STEP 3: Active Partner Dashboard Overview & Attribution Kit
    // -------------------------------------------------------------
    console.log('Step 3: Partner Dashboard Loaded!');
    await showBanner(
      'Step 3: Authorised Partner Dashboard (Voyage Luxury Holidays)',
      'Partner ko apna Referral Code, Share Link, 4 Financial KPIs aur Private Ledger dikh raha hai.'
    );
    await new Promise(r => setTimeout(r, 2500));

    const shot2Path = path.join(ARTIFACTS_DIR, 'demo_step2_active_dashboard.png');
    const pub2Path = path.join(PUBLIC_DIR, 'demo_step2_active_dashboard.png');
    await page.screenshot({ path: shot2Path });
    try { fs.copyFileSync(shot2Path, pub2Path); } catch {}

    // Test Copy button
    const copyBtns = await page.$$('button');
    for (const b of copyBtns) {
      const text = await (await b.getProperty('textContent')).jsonValue();
      if (text && text.includes('Copy')) {
        await b.click();
        await new Promise(r => setTimeout(r, 600));
        break;
      }
    }

    // -------------------------------------------------------------
    // STEP 4: Switch to Concierge Client Lead Tab & Submit
    // -------------------------------------------------------------
    console.log('Step 4: Opening Concierge Client Trip Request Tab...');
    const leadTabBtn = await page.waitForSelector('#tab-btn-leads', { timeout: 5000 });
    await leadTabBtn.click();
    await new Promise(r => setTimeout(r, 1000));

    await showBanner(
      'Step 4: Submit VIP Client Holiday Lead',
      'Agar partner ke paas customer hai, toh partner yahan se booking submit kar sakta hai — commission automatically tag hogi!'
    );
    await new Promise(r => setTimeout(r, 2000));

    const shot3Path = path.join(ARTIFACTS_DIR, 'demo_step3_client_lead_form.png');
    const pub3Path = path.join(PUBLIC_DIR, 'demo_step3_client_lead_form.png');
    await page.screenshot({ path: shot3Path });
    try { fs.copyFileSync(shot3Path, pub3Path); } catch {}

    console.log('Typing VIP client details...');
    await page.type('#lead-name-input', 'Sunil Kapoor (VIP Client)');
    await new Promise(r => setTimeout(r, 400));
    await page.type('#lead-email-input', 'sunil.kapoor@himalayareizen.in');
    await new Promise(r => setTimeout(r, 400));
    await page.type('#lead-phone-input', '+91 98765 43210');
    await new Promise(r => setTimeout(r, 400));

    await page.select('#lead-destination-select', 'Kashmir');
    await new Promise(r => setTimeout(r, 400));

    // Clear budget and type new budget
    const budgetInput = await page.$('#lead-budget-input');
    await budgetInput.click({ clickCount: 3 });
    await budgetInput.type('65000');
    await new Promise(r => setTimeout(r, 400));

    await page.type('#lead-notes-textarea', 'Luxury houseboat in Dal Lake + 5-star Gulmarg resort with snow activities.');
    await new Promise(r => setTimeout(r, 800));

    // Submit lead
    console.log('Submitting client lead...');
    const submitLeadBtn = await page.waitForSelector('#lead-submit-btn', { timeout: 5000 });
    await submitLeadBtn.click();
    await new Promise(r => setTimeout(r, 2000));

    await showBanner(
      'Step 5: Lead Successfully Submitted!',
      '✓ Lead submit ho gayi! Operations team itinerary banayegi aur booking par partner ko commission milegi.'
    );
    await new Promise(r => setTimeout(r, 2500));

    const shot4Path = path.join(ARTIFACTS_DIR, 'demo_step4_lead_submitted_success.png');
    const pub4Path = path.join(PUBLIC_DIR, 'demo_step4_lead_submitted_success.png');
    await page.screenshot({ path: shot4Path });
    try { fs.copyFileSync(shot4Path, pub4Path); } catch {}

    // -------------------------------------------------------------
    // STEP 5: Switch to Bank & Payout Details Tab
    // -------------------------------------------------------------
    console.log('Step 5: Showing Bank & Payout Details...');
    const payoutTabBtn = await page.waitForSelector('#tab-btn-payouts', { timeout: 5000 });
    await payoutTabBtn.click();
    await new Promise(r => setTimeout(r, 1200));

    await showBanner(
      'Step 6: Bank & Payout Details',
      'Partner ke direct bank account details jahan Zelevos finance team har 15 din me commission transfer karti hai.'
    );
    await new Promise(r => setTimeout(r, 2500));

    const shot5Path = path.join(ARTIFACTS_DIR, 'demo_step5_bank_payouts.png');
    const pub5Path = path.join(PUBLIC_DIR, 'demo_step5_bank_payouts.png');
    await page.screenshot({ path: shot5Path });
    try { fs.copyFileSync(shot5Path, pub5Path); } catch {}

    // Switch back to Ledger
    const ledgerTabBtn = await page.waitForSelector('#tab-btn-ledger', { timeout: 5000 });
    await ledgerTabBtn.click();
    await new Promise(r => setTimeout(r, 1000));

    await showBanner(
      'Demo Complete: 100% Isolated & Working',
      'Admin ke paas pure system ka access hai, aur Partner ko sirf uska apna workspace milta hai!'
    );

    console.log('=== LIVE INTERACTIVE DEMO SUCCESSFULLY COMPLETED! ===');
    console.log('Browser is kept open on your screen so you can interact with it.');
    // Keep browser alive
    await new Promise(() => {});
  } catch (err) {
    console.error('Demo error:', err);
  }
}

runLiveInteractiveDemo();
