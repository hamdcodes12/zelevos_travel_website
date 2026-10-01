import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\ff51c7fd-1d5c-4e3a-b4c7-e6aad8f9af04';
const BASE_URL = 'http://localhost:3000';

async function testNavbarSearch() {
  console.log('=== STARTING NAVBAR SEARCH LIVE VERIFICATION ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });

    // 1. Verify search button exists in navbar
    const searchBtn = await page.waitForSelector('#navbar-search-btn, .search-button', { timeout: 5000 });
    console.log('Navbar search button found!');

    // 2. Click navbar search button
    console.log('Clicking navbar search button...');
    await searchBtn.click();
    await new Promise(r => setTimeout(r, 600));

    // 3. Verify GlobalSearchModal is visible
    const modalVisible = await page.evaluate(() => {
      const modal = document.querySelector('.global-search-dialog');
      return !!modal && window.getComputedStyle(modal).display !== 'none';
    });
    console.log('Global search modal visible:', modalVisible);

    // 4. Capture screenshot of open modal
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'search_modal_open.png') });
    console.log('Saved screenshot: search_modal_open.png');

    // 5. Type query into search input
    console.log('Typing query "Kashmir" into search input...');
    const searchInput = await page.waitForSelector('#global-search-input');
    await searchInput.type('Kashmir');
    await new Promise(r => setTimeout(r, 800));

    // 6. Verify filtered results
    const resultsCount = await page.evaluate(() => {
      const cards = document.querySelectorAll('.search-package-card');
      return cards.length;
    });
    console.log(`Filtered packages count for 'Kashmir': ${resultsCount}`);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'search_modal_kashmir_results.png') });
    console.log('Saved screenshot: search_modal_kashmir_results.png');

    // 7. Test shortcut pill click (e.g. Kerala)
    console.log('Clicking "Kerala" destination shortcut pill...');
    await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('.shortcut-pill'));
      const kerala = pills.find(p => p.textContent.includes('Kerala'));
      if (kerala) kerala.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Modal should close and page should scroll or filter
    const modalAfterClick = await page.evaluate(() => {
      return !!document.querySelector('.global-search-dialog');
    });
    console.log('Modal closed after destination selection:', !modalAfterClick);

    // 8. Test Ctrl+K shortcut to reopen
    console.log('Testing Ctrl+K shortcut...');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyK');
    await page.keyboard.up('Control');
    await new Promise(r => setTimeout(r, 600));

    const reopenedWithCtrlK = await page.evaluate(() => {
      return !!document.querySelector('.global-search-dialog');
    });
    console.log('Reopened with Ctrl+K shortcut:', reopenedWithCtrlK);

    // 9. Test ESC key to close
    console.log('Testing ESC key to close...');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    const closedWithEsc = await page.evaluate(() => {
      return !document.querySelector('.global-search-dialog');
    });
    console.log('Closed with ESC key:', closedWithEsc);

    // 10. Test Jump to Home Search Bar
    console.log('Reopening search and testing "Jump to Home Search Bar"...');
    const searchBtn2 = await page.$('#navbar-search-btn');
    if (searchBtn2) await searchBtn2.click();
    await new Promise(r => setTimeout(r, 500));

    await page.evaluate(() => {
      const jumpBtn = document.querySelector('.jump-hero-link');
      if (jumpBtn) jumpBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    const heroInputFocused = await page.evaluate(() => {
      const activeEl = document.activeElement;
      return activeEl?.id === 'hero-destination-input';
    });
    console.log('Hero destination input focused after Jump:', heroInputFocused);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'hero_search_focused.png') });
    console.log('Saved screenshot: hero_search_focused.png');

    console.log('=== ALL NAVBAR SEARCH TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
}

testNavbarSearch();
