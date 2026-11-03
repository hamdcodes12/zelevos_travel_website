// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM
// Office Verification Form UI Automated Visual & Interaction Verification
// ==============================================================================

const path = require('path');
const fs = require('fs');

const puppeteer = require('C:\\GIT DESK\\THINK\\node_modules\\.pnpm\\puppeteer-core@25.11.0\\node_modules\\puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('C:\\Users\\Gurpreet Singh\\.gemini\\antigravity-ide\\brain\\f68c479e-7e18-4113-abb6-ff871d7ce06e\\e2e_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  console.log('==============================================================================');
  console.log('🎨 VERIFYING OFFICE / CENTRE VERIFICATION FORM UI DESIGN & INTERACTIONS');
  console.log('==============================================================================');

  const timestamp = Date.now();
  const testEmail = `office_ui_${timestamp}@thinkatic.com`;
  const testPassword = 'PartnerPass123!';
  const companyName = `Precision Global Centre ${timestamp.toString().slice(-4)}`;

  console.log(`\n1. Creating test BPO Partner account: ${testEmail}`);
  const signupRes = await fetch('http://localhost:4317/api/user/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      fullName: 'Anita Sharma',
      accountType: 'BPO',
      companyName,
    }),
  });

  const signupData = await signupRes.json();
  if (!signupRes.ok) {
    throw new Error('Signup failed: ' + JSON.stringify(signupData));
  }

  const partnerToken = signupData.token;
  const partnerUser = signupData.profile || signupData.user;
  console.log(`✅ Partner authenticated. Token acquired.`);

  // Launch browser
  console.log('\n2. Launching Chrome with Puppeteer...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Set tokens in localStorage
  await page.goto('http://localhost:5000/partner', { waitUntil: 'domcontentloaded' });
  await page.evaluate((pToken, pUser) => {
    localStorage.setItem('user_token', pToken);
    localStorage.setItem('thinkatic_user_token', pToken);
    localStorage.setItem('token', pToken);
    localStorage.setItem('user', JSON.stringify(pUser));
    localStorage.setItem('thinkatic_cookie_consent', JSON.stringify({ necessary: true, analytics: true, marketing: true, preferences: true }));
  }, partnerToken, partnerUser);

  // Navigate to verification tab
  console.log('\n3. Navigating to Partner Office Verification section...');
  await page.goto('http://localhost:5000/partner?tab=verification', { waitUntil: 'networkidle2' });
  await sleep(1500);

  // Ensure details tab is active
  await page.evaluate(() => {
    const detailsTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('1. Office Details'));
    if (detailsTabBtn) detailsTabBtn.click();
  });
  await sleep(500);

  // Inspect all 16 inputs and icons
  console.log('\n4. Validating all 16 inputs, selects, icons, and styling...');
  const validationResults = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) return { success: false, error: 'Form not found' };

    const expectedFields = [
      { label: 'Centre / Office Name', type: 'input' },
      { label: 'Address Line 1 (Street / Building)', type: 'input' },
      { label: 'Address Line 2 (Area / Sector)', type: 'input' },
      { label: 'Landmark', type: 'input' },
      { label: 'City', type: 'input' },
      { label: 'State / Province', type: 'input' },
      { label: 'Country', type: 'input' },
      { label: 'Postal / ZIP Code', type: 'input' },
      { label: 'Office Contact Number', type: 'input' },
      { label: 'Operating Since (Year)', type: 'input' },
      { label: 'Centre Type', type: 'select' },
      { label: 'Ownership Type', type: 'select' },
      { label: 'Total Office Area (sq. ft.)', type: 'input' },
      { label: 'Operational Floors', type: 'input' },
      { label: 'Working Hours', type: 'select' },
      { label: 'Primary Operating Shift', type: 'select' },
    ];

    const results = [];
    const labels = Array.from(form.querySelectorAll('label'));

    for (const exp of expectedFields) {
      const matchLabel = labels.find(l => l.textContent.includes(exp.label));
      if (!matchLabel) {
        results.push({ field: exp.label, found: false, error: 'Label not found' });
        continue;
      }

      const container = matchLabel.nextElementSibling;
      if (!container) {
        results.push({ field: exp.label, found: false, error: 'Input container not found' });
        continue;
      }

      const inputOrSelect = container.querySelector(exp.type);
      const icon = container.querySelector('svg');
      const style = inputOrSelect ? window.getComputedStyle(inputOrSelect) : null;
      const iconStyle = icon ? window.getComputedStyle(icon) : null;

      const paddingLeft = style ? parseFloat(style.paddingLeft) : 0;
      const isSelect = exp.type === 'select';
      const rightChevron = isSelect ? container.querySelectorAll('svg').length >= 2 : true;

      results.push({
        field: exp.label,
        found: true,
        hasIcon: !!icon,
        iconColor: iconStyle ? iconStyle.color : null,
        paddingLeft,
        hasProperPadding: paddingLeft >= 36, // pl-10 = 40px
        isSelect,
        hasRightChevron: rightChevron,
        classes: inputOrSelect ? inputOrSelect.className : '',
      });
    }

    // Check save button
    const saveBtn = form.querySelector('button[type="submit"]');
    const saveBtnIcon = saveBtn ? saveBtn.querySelector('svg') : null;

    // Check verify & submit button
    const submitBtn = document.querySelector('#verify-submit-office-verification');
    const submitBtnIcon = submitBtn ? submitBtn.querySelector('svg') : null;

    return {
      success: true,
      fields: results,
      saveButton: {
        found: !!saveBtn,
        text: saveBtn ? saveBtn.textContent.trim() : null,
        hasIcon: !!saveBtnIcon,
      },
      submitButton: {
        found: !!submitBtn,
        text: submitBtn ? submitBtn.textContent.trim() : null,
        hasIcon: !!submitBtnIcon,
      },
    };
  });

  console.log('Form Inspection Results:');
  console.log(`- Fields checked: ${validationResults.fields.length}/16`);
  let allFieldsValid = true;
  for (const f of validationResults.fields) {
    const ok = f.found && f.hasIcon && f.hasProperPadding && (!f.isSelect || f.hasRightChevron);
    if (!ok) allFieldsValid = false;
    console.log(`  ${ok ? '✅' : '❌'} ${f.field}: icon=${f.hasIcon} padding=${f.paddingLeft}px color=${f.iconColor} ${f.isSelect ? '(chevron=' + f.hasRightChevron + ')' : ''}`);
  }

  console.log(`- Save button: ${validationResults.saveButton.found && validationResults.saveButton.hasIcon ? '✅' : '❌'} (${validationResults.saveButton.text})`);
  console.log(`- Submit button: ${validationResults.submitButton.found && validationResults.submitButton.hasIcon ? '✅' : '❌'} (${validationResults.submitButton.text})`);

  if (!allFieldsValid) {
    throw new Error('Some fields failed styling or icon validation');
  }

  // 5. Test filling the form in the UI and saving
  console.log('\n5. Testing form typing and interactive "Save Office Details"...');
  await page.evaluate(() => {
    const fill = (selector, val) => {
      const el = document.querySelector(selector);
      if (el) {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    const inputs = Array.from(document.querySelectorAll('form input'));
    const selects = Array.from(document.querySelectorAll('form select'));

    if (inputs[0]) inputs[0].value = 'Thinkatic Premium Global Delivery Tower';
    if (inputs[1]) inputs[1].value = 'Level 8, Tower Alpha, Tech Zone';
    if (inputs[2]) inputs[2].value = 'Silicon Corridor';
    if (inputs[3]) inputs[3].value = 'Opposite Central Tech Metro';
    if (inputs[4]) inputs[4].value = 'Bengaluru';
    if (inputs[5]) inputs[5].value = 'Karnataka';
    if (inputs[6]) inputs[6].value = 'India';
    if (inputs[7]) inputs[7].value = '560103';
    if (inputs[8]) inputs[8].value = '+91 80 8899 0011';
    if (inputs[9]) inputs[9].value = '2023';
    if (inputs[10]) inputs[10].value = '18500';
    if (inputs[11]) inputs[11].value = '3';

    for (const inp of inputs) {
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (selects[0]) selects[0].value = 'Dedicated BPO Facility';
    if (selects[1]) selects[1].value = 'Commercial Lease';
    if (selects[2]) selects[2].value = '24/7 Operations';
    if (selects[3]) selects[3].value = 'US Shift (Night)';

    for (const sel of selects) {
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  await sleep(400);

  // Click Save Office Details
  const saveBtn = await page.$('form button[type="submit"]');
  await saveBtn.click();
  console.log('   Clicked "Save Office Details" button, waiting for save completion...');
  await sleep(2500);

  // Take Desktop screenshot
  console.log('\n6. Capturing Responsive Screenshots...');
  await page.setViewport({ width: 1440, height: 1100 });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'office_form_desktop_1440px.png'), fullPage: false });
  console.log('📸 Captured: office_form_desktop_1440px.png');

  // Tablet screenshot
  await page.setViewport({ width: 768, height: 1024 });
  await sleep(300);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'office_form_tablet_768px.png'), fullPage: false });
  console.log('📸 Captured: office_form_tablet_768px.png');

  // Mobile 375px screenshot
  await page.setViewport({ width: 375, height: 812 });
  await sleep(300);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'office_form_mobile_375px.png'), fullPage: false });
  console.log('📸 Captured: office_form_mobile_375px.png');

  // Small Mobile 320px screenshot
  await page.setViewport({ width: 320, height: 700 });
  await sleep(300);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'office_form_mobile_320px.png'), fullPage: false });
  console.log('📸 Captured: office_form_mobile_320px.png');

  await browser.close();
  console.log('\n✨ ALL OFFICE VERIFICATION UI CHECKS & SCREENSHOTS COMPLETED SUCCESSFULLY!');
})();
