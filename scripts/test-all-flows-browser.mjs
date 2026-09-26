import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\ff51c7fd-1d5c-4e3a-b4c7-e6aad8f9af04";

async function runBrowserTests() {
  console.log("=== STARTING LIVE BROWSER TESTS ===");
  const results = {
    customerSignup: "FAIL",
    customerLogin: "FAIL",
    partnerRegistration: "FAIL",
    adminLogin: "FAIL",
    details: {}
  };

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1280, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });

  const timestamp = Date.now();
  const testCustomerEmail = `browser_user_${timestamp}@example.com`;
  const testCustomerPassword = `SecurePass${timestamp}!`;
  const testPartnerEmail = `partner_${timestamp}@example.com`;

  // -------------------------------------------------------------
  // FLOW 1: Customer Signup
  // -------------------------------------------------------------
  try {
    console.log("\n--- Testing FLOW 1: Customer Signup ---");
    const page1 = await browser.newPage();
    await page1.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1000));

    const getStartedBtn = await page1.waitForSelector(".started-button, button.started-button", { timeout: 5000 });
    await getStartedBtn.click();
    console.log("Clicked 'Get Started' button");

    await page1.waitForSelector(".auth-card form", { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 600));

    const nameInput = await page1.waitForSelector("input[placeholder*='Sarah Jenkins'], input[autocomplete='name']");
    await nameInput.type("Live Browser User", { delay: 10 });

    const emailInput = await page1.waitForSelector("input[autocomplete='email'], input[placeholder='name@example.com']");
    await emailInput.type(testCustomerEmail, { delay: 10 });

    const passInput = await page1.waitForSelector("input[placeholder*='At least 8 characters']");
    await passInput.type(testCustomerPassword, { delay: 10 });

    const confirmPassInput = await page1.waitForSelector("input[placeholder*='Re-enter your password']");
    await confirmPassInput.type(testCustomerPassword, { delay: 10 });

    const submitBtn = await page1.waitForSelector(".auth-card button[type='submit']");
    await submitBtn.click();
    console.log("Submitted signup form");

    await page1.waitForFunction(
      () => !document.querySelector(".auth-card") || document.querySelector(".toast"),
      { timeout: 10000 }
    );
    await new Promise((r) => setTimeout(r, 1000));

    const signupScreenshot = path.join(ARTIFACTS_DIR, "flow1_customer_signup_success.png");
    await page1.screenshot({ path: signupScreenshot, fullPage: false });
    console.log("Captured screenshot:", signupScreenshot);

    const cookies1 = await page1.cookies();
    const hasSessionCookie = cookies1.some((c) => c.name.includes("session") || c.name.includes("connect.sid"));

    const errorText1 = await page1.evaluate(() => {
      const err = document.querySelector(".auth-error, .toast-error");
      return err ? err.textContent : null;
    });

    if (!errorText1 && hasSessionCookie) {
      results.customerSignup = "PASS";
      results.details.signup = `Account created successfully for ${testCustomerEmail}. Session cookie set.`;
      console.log("FLOW 1: Customer Signup -> PASS");
    } else {
      results.details.signup = `Error: ${errorText1 || "No session cookie"}`;
      console.log("FLOW 1: Customer Signup -> FAIL:", errorText1);
    }
    await page1.close();
  } catch (err) {
    console.error("FLOW 1 Error:", err);
    results.details.signup = err.message;
  }

  // -------------------------------------------------------------
  // FLOW 2: Customer Login
  // -------------------------------------------------------------
  try {
    console.log("\n--- Testing FLOW 2: Customer Login ---");
    const context2 = await browser.createBrowserContext();
    const page2 = await context2.newPage();
    await page2.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1000));

    const loginBtn = await page2.waitForSelector(".login-button, button.login-button", { timeout: 5000 });
    await loginBtn.click();
    console.log("Clicked 'Log in' button");

    await page2.waitForSelector(".auth-card", { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 500));

    const loginEmailInput = await page2.waitForSelector(".auth-card input[autocomplete='email'], .auth-card input[placeholder='name@example.com']");
    await loginEmailInput.type(testCustomerEmail, { delay: 10 });

    const loginPassInput = await page2.waitForSelector(".auth-card input[type='password']");
    await loginPassInput.type(testCustomerPassword, { delay: 10 });

    const loginSubmit = await page2.waitForSelector(".auth-card button[type='submit']");
    await loginSubmit.click();
    console.log("Submitted login form");

    await page2.waitForFunction(
      () => !document.querySelector(".auth-card") || document.querySelector(".toast"),
      { timeout: 10000 }
    );
    await new Promise((r) => setTimeout(r, 1000));

    const loginScreenshot = path.join(ARTIFACTS_DIR, "flow2_customer_login_success.png");
    await page2.screenshot({ path: loginScreenshot, fullPage: false });
    console.log("Captured screenshot:", loginScreenshot);

    const cookies2 = await context2.cookies();
    const hasSessionCookie2 = cookies2.some((c) => c.name.includes("session") || c.name.includes("connect.sid"));

    const errorText2 = await page2.evaluate(() => {
      const err = document.querySelector(".auth-error, .toast-error");
      return err ? err.textContent : null;
    });

    if (!errorText2 && hasSessionCookie2) {
      results.customerLogin = "PASS";
      results.details.login = `Logged in successfully with ${testCustomerEmail}. Session cookie set.`;
      console.log("FLOW 2: Customer Login -> PASS");
    } else {
      results.details.login = `Error: ${errorText2 || "No session cookie"}`;
      console.log("FLOW 2: Customer Login -> FAIL:", errorText2);
    }
    await page2.close();
    await context2.close();
  } catch (err) {
    console.error("FLOW 2 Error:", err);
    results.details.login = err.message;
  }

  // -------------------------------------------------------------
  // FLOW 3: Authorised Partner Registration
  // -------------------------------------------------------------
  try {
    console.log("\n--- Testing FLOW 3: Authorised Partner Registration ---");
    const context3 = await browser.createBrowserContext();
    const page3 = await context3.newPage();
    await page3.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1000));

    const partnerBtn = await page3.waitForSelector("#partner-cta-btn", { timeout: 5000 });
    await partnerBtn.scrollIntoView();
    await new Promise((r) => setTimeout(r, 400));
    await partnerBtn.click();
    console.log("Clicked Partner CTA button");

    const agencyInput = await page3.waitForSelector("input[placeholder*='Voyage Travel Collective']", { timeout: 5000 });
    await agencyInput.type(`Pinnacle Travels ${timestamp}`, { delay: 10 });

    const contactInput = await page3.waitForSelector("input[placeholder*='Vikramaditya Singh']", { timeout: 5000 });
    await contactInput.type("Sunil Gupta", { delay: 10 });

    const emailInput = await page3.waitForSelector("input[placeholder*='partner@voyage.travel']", { timeout: 5000 });
    await emailInput.type(testPartnerEmail, { delay: 10 });

    const phoneInput = await page3.waitForSelector("input[placeholder*='+91 98765 43210'], div.fixed input[type='tel']", { timeout: 5000 });
    await phoneInput.type("+91 98111 22334", { delay: 10 });

    const partnerSubmit = await page3.waitForSelector("div.fixed form button[type='submit']");
    await partnerSubmit.click();
    console.log("Submitted partner registration form");

    await page3.waitForFunction(
      () => document.body.innerText.includes("Partner Account Activated") || document.body.innerText.includes("Your Referral Code"),
      { timeout: 10000 }
    );
    await new Promise((r) => setTimeout(r, 1000));

    const partnerScreenshot = path.join(ARTIFACTS_DIR, "flow3_partner_registration_success.png");
    await page3.screenshot({ path: partnerScreenshot, fullPage: false });
    console.log("Captured screenshot:", partnerScreenshot);

    const partnerSuccessText = await page3.evaluate(() => {
      const codeEl = document.querySelector(".font-mono, [class*='referral']");
      return codeEl ? codeEl.textContent.trim() : null;
    });

    results.partnerRegistration = "PASS";
    results.details.partner = `Partner registered successfully. Referral code: ${partnerSuccessText || "Generated"}`;
    console.log("FLOW 3: Partner Registration -> PASS");
    await page3.close();
    await context3.close();
  } catch (err) {
    console.error("FLOW 3 Error:", err);
    results.details.partner = err.message;
  }

  // -------------------------------------------------------------
  // FLOW 4: Admin Login
  // -------------------------------------------------------------
  try {
    console.log("\n--- Testing FLOW 4: Admin Login ---");
    const context4 = await browser.createBrowserContext();
    const page4 = await context4.newPage();
    await page4.goto("http://localhost:3000/admin", { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1000));

    await page4.waitForSelector("form input[placeholder='zelevos-travelai00'], form input[type='text']", { timeout: 5000 });
    console.log("Found Admin login form");

    await page4.evaluate(() => {
      const idInput = document.querySelector("form input[type='text']");
      const passInput = document.querySelector("form input[type='password']");
      const proto = window.HTMLInputElement.prototype;
      const valueSetter = Object.getOwnPropertyDescriptor(proto, "value").set;

      valueSetter.call(idInput, "zelevos-travelai00");
      idInput.dispatchEvent(new Event("input", { bubbles: true }));

      valueSetter.call(passInput, "ZT002121");
      passInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const adminSubmit = await page4.$("form button[type='submit']");
    await adminSubmit.click();
    console.log("Submitted Admin login form");

    await page4.waitForFunction(
      () => document.body.innerText.includes("Operations Console") || document.body.innerText.includes("Zelevos Admin") || document.body.innerText.includes("Overview"),
      { timeout: 10000 }
    );
    await new Promise((r) => setTimeout(r, 1000));

    const adminScreenshot = path.join(ARTIFACTS_DIR, "flow4_admin_login_success.png");
    await page4.screenshot({ path: adminScreenshot, fullPage: false });
    console.log("Captured screenshot:", adminScreenshot);

    const cookies4 = await context4.cookies();
    const hasAdminCookie = cookies4.some((c) => c.name.includes("session") || c.name.includes("connect.sid"));

    const adminHasConsole = await page4.evaluate(() => {
      return document.body.innerText.includes("Operations Console") || document.body.innerText.includes("Zelevos Admin");
    });

    if (adminHasConsole && hasAdminCookie) {
      results.adminLogin = "PASS";
      results.details.admin = "Admin authenticated successfully. Operations Console rendered. Session cookie set.";
      console.log("FLOW 4: Admin Login -> PASS");
    } else {
      results.details.admin = "Admin dashboard did not render expected elements or missing session cookie.";
      console.log("FLOW 4: Admin Login -> FAIL");
    }
    await page4.close();
    await context4.close();
  } catch (err) {
    console.error("FLOW 4 Error:", err);
    results.details.admin = err.message;
  }

  await browser.close();

  console.log("\n=== FINAL TEST RESULTS ===");
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, "browser_auth_test_results.json"),
    JSON.stringify(results, null, 2)
  );

  return results;
}

runBrowserTests();
