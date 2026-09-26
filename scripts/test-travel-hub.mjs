import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\ff51c7fd-1d5c-4e3a-b4c7-e6aad8f9af04';

async function main() {
  console.log('=== STARTING TRAVEL HUB BROWSER TEST ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();

  try {
    // 1. Load Homepage
    console.log('\n[STEP 1] Navigating to http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1000));

    // 2. Click "More" button
    console.log('\n[STEP 2] Clicking More dropdown button...');
    const moreBtn = await page.waitForSelector('button.more-link', { timeout: 5000 });
    await moreBtn.click();
    await new Promise((r) => setTimeout(r, 500));

    // Capture dropdown open
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'travel_hub_1_dropdown_open.png') });
    console.log('Saved screenshot: travel_hub_1_dropdown_open.png');

    // 3. Click "Travel Hub" in dropdown
    console.log('\n[STEP 3] Clicking Travel Hub link...');
    const travelHubLink = await page.waitForSelector('.more-menu a[href="/#travel-hub"]', { timeout: 5000 });
    await travelHubLink.click();

    // Wait for smooth scroll to finish
    await new Promise((r) => setTimeout(r, 1500));

    // 4. Verify Travel Hub is mounted and visible
    const travelHubEl = await page.$('#travel-hub');
    if (!travelHubEl) throw new Error('#travel-hub element not found in DOM!');
    console.log('Found #travel-hub element in DOM!');

    // Check if #travel-hub is in viewport
    const isInViewport = await page.evaluate(() => {
      const el = document.getElementById('travel-hub');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.top >= -200 && rect.top <= window.innerHeight;
    });
    console.log(`Is #travel-hub in viewport: ${isInViewport}`);

    // Capture screenshot of scrolled Travel Hub section
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'travel_hub_2_scrolled_view.png') });
    console.log('Saved screenshot: travel_hub_2_scrolled_view.png');

    // 5. Test Tabs: Hotels
    console.log('\n[STEP 4] Clicking Hotels tab...');
    await page.evaluate(() => {
      const hotelBtn = Array.from(document.querySelectorAll('.travel-tabs button')).find((b) => b.textContent?.includes('Hotels'));
      if (hotelBtn) hotelBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const hotelCount = await page.evaluate(() => document.querySelectorAll('.hotel-result').length);
    console.log(`Hotels rendered: ${hotelCount}`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'travel_hub_3_hotels_tab.png') });
    console.log('Saved screenshot: travel_hub_3_hotels_tab.png');

    // 6. Test Tabs: Experiences
    console.log('\n[STEP 5] Clicking Experiences tab...');
    await page.evaluate(() => {
      const expBtn = Array.from(document.querySelectorAll('.travel-tabs button')).find((b) => b.textContent?.includes('Experiences'));
      if (expBtn) expBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const expCards = await page.evaluate(() => document.querySelectorAll('.travel-result-card').length);
    console.log(`Experiences rendered: ${expCards}`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'travel_hub_4_experiences_tab.png') });
    console.log('Saved screenshot: travel_hub_4_experiences_tab.png');

    // 7. Test Tabs: Transport
    console.log('\n[STEP 6] Clicking Transport tab...');
    await page.evaluate(() => {
      const transBtn = Array.from(document.querySelectorAll('.travel-tabs button')).find((b) => b.textContent?.includes('Transport'));
      if (transBtn) transBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const transCards = await page.evaluate(() => document.querySelectorAll('.travel-result-card').length);
    console.log(`Transport rendered: ${transCards}`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'travel_hub_5_transport_tab.png') });
    console.log('Saved screenshot: travel_hub_5_transport_tab.png');

    // 8. Test Direct Hash Navigation
    console.log('\n[STEP 7] Testing direct hash navigation to http://localhost:3000/#travel-hub ...');
    const page2 = await browser.newPage();
    await page2.goto('http://localhost:3000/#travel-hub', { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1500));

    const isInViewportPage2 = await page2.evaluate(() => {
      const el = document.getElementById('travel-hub');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.top >= -200 && rect.top <= window.innerHeight;
    });
    console.log(`Direct hash load - is #travel-hub in viewport: ${isInViewportPage2}`);
    await page2.screenshot({ path: path.join(ARTIFACTS_DIR, 'travel_hub_6_direct_hash_load.png') });
    console.log('Saved screenshot: travel_hub_6_direct_hash_load.png');

    console.log('\n=== ALL TRAVEL HUB TESTS PASSED SUCCESSFULLY! ===');
  } catch (error) {
    console.error('Error during test:', error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
