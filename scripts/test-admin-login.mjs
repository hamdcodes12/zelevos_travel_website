import puppeteer from 'puppeteer-core';

async function test() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/admin', { waitUntil: 'networkidle2' });
  const pass = await page.$('input[type="password"]');
  if (pass) {
    await pass.type('ZT002121');
    const btn = await page.$('button[type="submit"]');
    await btn.click();
    await page.waitForSelector('#admin-nav-suppliers', { timeout: 8000 });
    console.log('SUCCESS: Admin Dashboard reached!');
  }
  await browser.close();
}

test().catch(err => {
  console.error('Login failed:', err);
  process.exit(1);
});
