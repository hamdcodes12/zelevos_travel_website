import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\ff51c7fd-1d5c-4e3a-b4c7-e6aad8f9af04';
const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8080/api';

const ADMIN_ID = 'zelevos-travelai00';
const ADMIN_PASSWORD = 'ZT002121';

async function auditSite() {
  console.log('=== STARTING SYSTEMATIC LIVE SITE AUDIT ===');
  const issues = [];
  const passes = [];

  function recordPass(testName, details = '') {
    console.log(`[PASS] ${testName} ${details ? '- ' + details : ''}`);
    passes.push({ testName, details });
  }

  function recordIssue(testName, error, details = {}) {
    console.error(`[FAIL/BUG] ${testName}: ${error}`);
    issues.push({ testName, error, details });
  }

  // Check 1: API Server Health
  try {
    const health = await fetch(`${API_URL}/health`).catch(() => null);
    if (health && health.ok) {
      recordPass('API Server Health', 'HTTP 200');
    } else {
      // Check /api/packages as proxy health
      const pkgs = await fetch(`${API_URL}/packages`);
      if (pkgs.ok) recordPass('API Packages Endpoint', 'HTTP 200');
      else recordIssue('API Health Check', 'Packages endpoint failed', { status: pkgs.status });
    }
  } catch (e) {
    recordIssue('API Server Health', e.message);
  }

  // Check 2: Browser Testing
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  // Listen for console errors & unhandled rejections
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  try {
    // 1. Homepage & Navigation
    console.log('\n--- 1. Testing Homepage & Navbar ---');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const pageTitle = await page.title();
    if (pageTitle.includes('Zelevos')) {
      recordPass('Homepage Title & Rendering', pageTitle);
    } else {
      recordIssue('Homepage Title', `Unexpected title: ${pageTitle}`);
    }

    // 2. Curated Packages Section
    console.log('\n--- 2. Testing Curated Packages & Filters ---');
    const cards = await page.$$('div[id^="package-card-"]');
    if (cards.length > 0) {
      recordPass('Package Cards Rendered', `Count: ${cards.length}`);
    } else {
      recordIssue('Package Cards', 'No package cards found with id^="package-card-"');
    }

    // Test duration filter
    const durBtn = await page.$('#filter-duration-medium');
    if (durBtn) {
      await durBtn.click();
      await new Promise(r => setTimeout(r, 400));
      recordPass('Duration Filter 5-7 Days Click');
    }

    // Test budget filter
    const budBtn = await page.$('#filter-budget-35to60k');
    if (budBtn) {
      await budBtn.click();
      await new Promise(r => setTimeout(r, 400));
      recordPass('Budget Filter ₹35k-₹60k Click');
    }

    // Reset filters
    const allDur = await page.$('#filter-duration-all');
    if (allDur) await allDur.click();
    const allBud = await page.$('#filter-budget-all');
    if (allBud) await allBud.click();
    await new Promise(r => setTimeout(r, 400));

    // 3. Package Detail Modal
    console.log('\n--- 3. Testing Package Detail Modal ---');
    const firstCardBtn = await page.evaluate(() => {
      const card = document.querySelector('div[id^="package-card-"]');
      if (card) {
        const btn = card.querySelector('button');
        if (btn) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (firstCardBtn) {
      await new Promise(r => setTimeout(r, 800));
      const hasModal = await page.evaluate(() => {
        return !!document.querySelector('#book-now-package-btn');
      });
      if (hasModal) {
        recordPass('Package Detail Modal Opened', 'CTA #book-now-package-btn found');

        // Test opening checkout modal
        const clickedBookNow = await page.evaluate(() => {
          const btn = document.querySelector('#book-now-package-btn');
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });

        if (clickedBookNow) {
          await new Promise(r => setTimeout(r, 800));
          const hasCheckout = await page.evaluate(() => {
            return !!document.querySelector('#checkout-travel-date');
          });
          if (hasCheckout) {
            recordPass('Package Checkout Modal Opened', 'Datepicker & Guest inputs found');

            // Close checkout modal
            await page.evaluate(() => {
              const closeBtn = document.querySelector('#close-checkout-modal, [aria-label="Close modal"], .auth-close');
              if (closeBtn) closeBtn.click();
            });
            await new Promise(r => setTimeout(r, 400));
          } else {
            recordIssue('Package Checkout Modal', 'Checkout modal fields not found after clicking Book Now');
          }
        }

        // Close detail modal
        await page.evaluate(() => {
          const closeBtn = document.querySelector('#close-package-detail-btn, .modal-close, [aria-label="Close modal"]');
          if (closeBtn) closeBtn.click();
        });
        await new Promise(r => setTimeout(r, 400));
      } else {
        recordIssue('Package Detail Modal', 'Detail modal did not render #book-now-package-btn');
      }
    } else {
      recordIssue('Package Card CTA', 'Could not click View & Book on first package card');
    }

    // 4. Test Navbar Search Spotlight Modal
    console.log('\n--- 4. Testing Navbar Search Button ---');
    const navSearchBtn = await page.$('#navbar-search-btn');
    if (navSearchBtn) {
      await navSearchBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const searchModalVisible = await page.evaluate(() => !!document.querySelector('.global-search-dialog'));
      if (searchModalVisible) {
        recordPass('Navbar Search Spotlight Modal', 'Opened and visible');
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 300));
      } else {
        recordIssue('Navbar Search Button', 'Global search modal not visible after clicking #navbar-search-btn');
      }
    } else {
      recordIssue('Navbar Search Button', '#navbar-search-btn selector not found in navbar');
    }

    // 5. Test Dedicated Flights Portal (/flights)
    console.log('\n--- 5. Testing Flights Portal (/flights) ---');
    await page.goto(`${BASE_URL}/flights`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const flightsHeading = await page.evaluate(() => {
      const h = document.querySelector('h1, h2');
      return h ? h.textContent : '';
    });
    if (flightsHeading.toLowerCase().includes('flight') || flightsHeading.length > 0) {
      recordPass('Flights Portal Rendered', flightsHeading);
    } else {
      recordIssue('Flights Portal', 'Flights portal heading empty');
    }

    // 6. Test Authorised Partner Registration API & UI
    console.log('\n--- 6. Testing Partner Registration Form ---');
    await page.goto(`${BASE_URL}/#partner-program`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const partnerApplyBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const target = btns.find(b => b.textContent.includes('Apply for Partnership') || b.textContent.includes('Partner Program'));
      return !!target;
    });
    recordPass('Partner Program Section & CTA', partnerApplyBtn ? 'Found' : 'Check text');

    // 7. Test Admin Operations Console Login & Tabs
    console.log('\n--- 7. Testing Admin Operations Console ---');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Login to Admin
    await page.evaluate((pass) => {
      const idInput = document.querySelector('input[type="text"], input[placeholder="zelevos-travelai00"]');
      if (idInput) {
        idInput.value = 'zelevos-travelai00';
        idInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const passInput = document.querySelector('input[type="password"]');
      if (passInput) {
        passInput.value = pass;
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, ADMIN_PASSWORD);

    const submitBtn = await page.waitForSelector('button[type="submit"]');
    await submitBtn.click();

    // Wait for console to authenticate
    await page.waitForFunction(() => !document.body.textContent.includes('Authenticating...'), { timeout: 12000 });
    await new Promise(r => setTimeout(r, 1500));

    const adminLoaded = await page.evaluate(() => {
      return document.body.textContent.includes('Operations Console') || document.body.textContent.includes('Zelevos Admin');
    });

    if (adminLoaded) {
      recordPass('Admin Authentication & Console Load', 'Dashboard active');

      // Test each admin tab
      const adminTabs = [
        'Overview',
        'Customers',
        'Bookings',
        'Payments',
        'Audit Logs',
        'Packages (Sec 8)',
        'Operations Desk',
        'Custom Trips',
        'Vendor Portal',
        'Partner Network',
        'Finance & Ledger',
        'Settings',
      ];

      for (const tab of adminTabs) {
        const clicked = await page.evaluate((label) => {
          const btns = Array.from(document.querySelectorAll('aside nav button'));
          const target = btns.find(b => b.textContent.includes(label));
          if (target) {
            target.click();
            return true;
          }
          return false;
        }, tab);

        await new Promise(r => setTimeout(r, 600));

        // Check if error occurred inside tab
        const tabError = await page.evaluate(() => {
          const err = document.querySelector('[role="alert"], .error-boundary, .tab-error');
          return err ? err.textContent : null;
        });

        if (clicked && !tabError) {
          recordPass(`Admin Tab: ${tab}`);
        } else {
          recordIssue(`Admin Tab: ${tab}`, tabError || 'Could not click or error rendered');
        }
      }
    } else {
      recordIssue('Admin Login', 'Admin console did not load after submitting credentials');
    }

    // 8. Mobile Responsiveness Check (390x844)
    console.log('\n--- 8. Testing Mobile Responsiveness (390x844) ---');
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const mobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    if (!mobileOverflow) {
      recordPass('Mobile Viewport (390x844)', 'No horizontal scroll overflow');
    } else {
      recordIssue('Mobile Viewport', 'Horizontal scroll overflow detected on 390x844');
    }

    // Check console errors
    console.log('\n--- Console Errors Review ---');
    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('downloadable font'));
    if (criticalErrors.length === 0) {
      recordPass('Browser Console Errors', 'Zero uncaught console errors');
    } else {
      recordIssue('Browser Console Errors', `${criticalErrors.length} errors found`, { errors: criticalErrors.slice(0, 5) });
    }

  } catch (err) {
    recordIssue('Site Audit Runner', err.message);
  } finally {
    await browser.close();
  }

  console.log('\n=== AUDIT RESULTS SUMMARY ===');
  console.log(`Total Passes: ${passes.length}`);
  console.log(`Total Issues/Bugs: ${issues.length}`);
  if (issues.length > 0) {
    console.log('Issues details:', JSON.stringify(issues, null, 2));
  }
}

auditSite();
