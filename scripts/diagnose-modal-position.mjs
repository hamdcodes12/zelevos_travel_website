import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1536, height: 826 },
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#navbar-search-btn');

  // Test 1: Unscrolled
  await page.click('#navbar-search-btn');
  await new Promise(r => setTimeout(r, 600));
  const data1 = await page.evaluate(() => {
    const backdrop = document.querySelector('.global-search-backdrop');
    const dialog = document.querySelector('.global-search-dialog');
    const header = document.querySelector('header.navbar');
    return {
      headerRect: header ? header.getBoundingClientRect().toJSON() : null,
      backdropRect: backdrop ? backdrop.getBoundingClientRect().toJSON() : null,
      dialogRect: dialog ? dialog.getBoundingClientRect().toJSON() : null,
      backdropParent: backdrop ? backdrop.parentElement.tagName + '.' + backdrop.parentElement.className : null
    };
  });
  console.log('UNSCROLLED MODAL RECT:', JSON.stringify(data1, null, 2));

  // Test 2: Scrolled down 600px
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => window.scrollTo(0, 600));
  await new Promise(r => setTimeout(r, 400));
  await page.click('#navbar-search-btn');
  await new Promise(r => setTimeout(r, 600));
  const data2 = await page.evaluate(() => {
    const backdrop = document.querySelector('.global-search-backdrop');
    const dialog = document.querySelector('.global-search-dialog');
    const header = document.querySelector('header.navbar');
    return {
      headerRect: header ? header.getBoundingClientRect().toJSON() : null,
      backdropRect: backdrop ? backdrop.getBoundingClientRect().toJSON() : null,
      dialogRect: dialog ? dialog.getBoundingClientRect().toJSON() : null,
      backdropParent: backdrop ? backdrop.parentElement.tagName + '.' + backdrop.parentElement.className : null
    };
  });
  console.log('SCROLLED MODAL RECT:', JSON.stringify(data2, null, 2));

  const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\ff51c7fd-1d5c-4e3a-b4c7-e6aad8f9af04';
  await page.screenshot({ path: ARTIFACTS_DIR + '\\search_modal_fixed_full.png' });
  console.log('Saved screenshot: search_modal_fixed_full.png');

  await browser.close();
})();
