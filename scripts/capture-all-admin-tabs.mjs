import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\ff51c7fd-1d5c-4e3a-b4c7-e6aad8f9af04';
const ADMIN_PASSWORD = 'ZT002121';

async function captureTabs() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });

  // Login
  const passInput = await page.waitForSelector('input[type="password"]');
  await passInput.type(ADMIN_PASSWORD);
  const submitBtn = await page.waitForSelector('button[type="submit"]');
  await submitBtn.click();

  await page.waitForFunction(() => !document.body.textContent.includes('Authenticating...'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));

  const tabList = [
    { label: 'Customers', file: 'admin_tab_1_customers.png' },
    { label: 'Bookings', file: 'admin_tab_2_bookings.png' },
    { label: 'Payments', file: 'admin_tab_3_payments.png' },
    { label: 'Audit Logs', file: 'admin_tab_4_audit.png' },
    { label: 'Packages (Sec 8)', file: 'admin_tab_5_packages.png' },
    { label: 'Operations Desk', file: 'admin_tab_6_operations.png' },
    { label: 'Custom Trips', file: 'admin_tab_7_custom_trips.png' },
    { label: 'Vendor Portal', file: 'admin_tab_8_vendors.png' },
    { label: 'Partner Network', file: 'admin_tab_9_partners.png' },
    { label: 'Finance & Ledger', file: 'admin_tab_10_finance.png' },
    { label: 'Settings & Security', file: 'admin_tab_11_settings.png' },
  ];

  for (const tab of tabList) {
    console.log(`Clicking admin tab: ${tab.label}...`);
    await page.evaluate((l) => {
      const btns = Array.from(document.querySelectorAll('aside nav button'));
      const b = btns.find(btn => btn.textContent.includes(l));
      if (b) b.click();
    }, tab.label);
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, tab.file) });
    console.log(`Saved screenshot: ${tab.file}`);
  }

  await browser.close();
  console.log('All admin tabs captured successfully!');
}

captureTabs();
