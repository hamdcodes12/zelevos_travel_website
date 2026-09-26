import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function testAuthGate() {
  console.log('=== TESTING CHECKOUT AUTH GATE ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  // Wait for packages to load
  await page.waitForSelector('div[id^="package-card-"]', { timeout: 10000 });
  console.log('Package card found!');

  // Click on first package card
  const firstCard = await page.$('div[id^="package-card-"]');
  await firstCard.click();
  await new Promise(r => setTimeout(r, 1000));

  // Click Book This Holiday as guest
  const bookBtn = await page.waitForSelector('#book-now-package-btn');
  console.log('Clicking "Book This Holiday" as unauthenticated guest...');
  await bookBtn.click();
  await new Promise(r => setTimeout(r, 800));

  // Verify auth dialog opens
  const authDialogOpen = await page.evaluate(() => {
    const dialog = document.querySelector('.auth-dialog, [role="dialog"], .auth-modal');
    const notice = document.body.textContent.includes('Please log in or create an account to book your holiday package.');
    return { hasDialog: !!dialog, hasNotice: notice };
  });

  console.log('Auth dialog opened on guest book attempt:', authDialogOpen);

  await browser.close();
  console.log('=== TEST COMPLETED ===');
}

testAuthGate();
