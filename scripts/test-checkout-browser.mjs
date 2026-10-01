import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\ff51c7fd-1d5c-4e3a-b4c7-e6aad8f9af04';

async function testBookingFlow() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/#curated-packages', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));

  // 1. Click View & Book on first package
  console.log('Clicking View & Book...');
  await page.evaluate(() => {
    const card = document.querySelector('div[id^="package-card-"]');
    if (card) {
      const btn = card.querySelector('button');
      if (btn) btn.click();
    }
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'customer_flow_1_detail_modal.png') });

  // 2. Click Book This Holiday inside Package Detail Modal
  console.log('Clicking Book This Holiday inside detail modal...');
  const bookBtn = await page.waitForSelector('#book-now-package-btn');
  await bookBtn.click();
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'customer_flow_2_checkout_modal.png') });

  // 3. In Checkout Modal, verify fields and submit
  const checkoutFields = await page.evaluate(() => {
    const dateInput = document.querySelector('#checkout-travel-date');
    const guestInput = document.querySelector('#checkout-guest-name');
    const payBtn = document.querySelector('#confirm-pay-btn');
    return {
      hasDate: !!dateInput,
      hasGuest: !!guestInput,
      hasPayBtn: !!payBtn,
      payBtnText: payBtn ? payBtn.textContent.trim() : null
    };
  });
  console.log('Checkout fields:', checkoutFields);

  // Click pay button
  const confirmBtn = await page.$('#confirm-pay-btn');
  if (confirmBtn) {
    await confirmBtn.click();
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'customer_flow_3_payment_step.png') });
  }

  await browser.close();
  console.log('Customer booking flow test completed!');
}

testBookingFlow();
