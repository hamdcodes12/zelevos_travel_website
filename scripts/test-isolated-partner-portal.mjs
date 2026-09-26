import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\ff51c7fd-1d5c-4e3a-b4c7-e6aad8f9af04';
const BASE_URL = 'http://localhost:3000';

async function testPartnerPortal() {
  console.log('=== STARTING INDEPENDENT PARTNER PORTAL LIVE TEST ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    page.on('response', async res => {
      if (res.url().includes('/api/partners')) {
        let body = '';
        try { body = await res.text(); } catch {}
        console.log(`API RESP [${res.status()}] ${res.url()} -> ${body.slice(0, 150)}`);
      }
    });

    // 1. Visit /partner-portal as an unauthenticated partner
    console.log('1. Navigating to /partner-portal...');
    await page.goto(`${BASE_URL}/partner-portal`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));

    const portalHeading = await page.evaluate(() => document.querySelector('h1')?.textContent || '');
    console.log('Portal Heading:', portalHeading);
    if (!portalHeading.includes('Authorised Partner Workspace')) {
      throw new Error(`Expected Authorised Partner Workspace, found: ${portalHeading}`);
    }

    // Ensure NO admin sidebar / tabs are present
    const hasAdminSidebar = await page.evaluate(() => !!document.querySelector('.admin-nav, aside.admin-sidebar'));
    console.log('Has Admin Sidebar (Should be false):', hasAdminSidebar);
    if (hasAdminSidebar) throw new Error('Security flaw: Partner portal is showing Admin sidebar!');

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'partner_portal_login.png') });
    console.log('Saved screenshot: partner_portal_login.png');

    // 2. Log in using referral code ZELVOYAGE17 by clicking demo chip
    console.log('2. Signing in to Partner Portal using referral code ZELVOYAGE17...');
    const demoChip = await page.waitForSelector('#demo-chip-zelvoyage17', { timeout: 5000 });
    await demoChip.click();
    await new Promise(r => setTimeout(r, 200));

    const typedVal = await page.evaluate(() => document.querySelector('#partner-login-input')?.value);
    console.log('Input value after clicking chip:', typedVal);

    const submitBtn = await page.waitForSelector('#partner-login-btn', { timeout: 5000 });
    await submitBtn.click();

    await page.waitForFunction(
      () => document.body.textContent.includes('YOUR OFFICIAL ATTRIBUTION KIT'),
      { timeout: 10000 }
    );
    await new Promise(r => setTimeout(r, 800));

    console.log('3. Verifying Partner Dashboard elements...');
    const partnerData = await page.evaluate(() => {
      const code = document.querySelector('strong[style*="monospace"]')?.textContent || '';
      const text = document.body.textContent || '';
      return {
        code,
        hasReferralKit: text.includes('YOUR OFFICIAL ATTRIBUTION KIT'),
        hasCommissionTable: text.includes('Private Commission Ledger'),
        hasSubmitLeadTab: text.includes('Submit Client Holiday Request'),
      };
    });
    console.log('Partner Dashboard Data:', JSON.stringify(partnerData, null, 2));

    if (!partnerData.code.includes('ZELVOYAGE17')) {
      throw new Error(`Expected referral code ZELVOYAGE17, got: ${partnerData.code}`);
    }

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'partner_portal_active_dashboard.png') });
    console.log('Saved screenshot: partner_portal_active_dashboard.png');

    // 3. Test submitting a client lead from partner portal
    console.log('4. Testing client lead submission tab...');
    const leadTabBtn = await page.waitForSelector('#tab-btn-leads', { timeout: 5000 });
    await leadTabBtn.click();
    await new Promise(r => setTimeout(r, 600));

    await page.type('#lead-name-input', 'Ananya Verma');
    await page.type('#lead-email-input', 'ananya.verma@example.com');
    await page.type('#lead-phone-input', '+91 98222 33445');

    const submitLeadBtn = await page.waitForSelector('#lead-submit-btn', { timeout: 5000 });
    await submitLeadBtn.click();
    await new Promise(r => setTimeout(r, 1500));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'partner_portal_lead_submitted.png') });
    console.log('Saved screenshot: partner_portal_lead_submitted.png');

    console.log('=== ALL INDEPENDENT PARTNER PORTAL TESTS PASSED! ===');
  } finally {
    await browser.close();
  }
}

testPartnerPortal().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
