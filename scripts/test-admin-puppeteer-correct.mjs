import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ADMIN_PASSWORD = 'ZT002121';

async function testAdmin() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });

  // Type password directly into password input
  const passInput = await page.waitForSelector('input[type="password"]');
  await passInput.type(ADMIN_PASSWORD);

  const submitBtn = await page.waitForSelector('button[type="submit"]');
  await submitBtn.click();

  await page.waitForFunction(() => !document.body.textContent.includes('Authenticating...'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));

  const text = await page.evaluate(() => document.body.textContent);
  console.log('Page body text snippet:', text.slice(0, 300));
  const errText = await page.evaluate(() => {
    const el = document.querySelector('[style*="color: #991b1b"], .login-error, [style*="background: #fef2f2"]');
    return el ? el.textContent : null;
  });
  console.log('Error banner:', errText);
  await page.screenshot({ path: 'admin_test_debug.png' });
  await new Promise(r => setTimeout(r, 1000));

  await browser.close();
}

testAdmin();
