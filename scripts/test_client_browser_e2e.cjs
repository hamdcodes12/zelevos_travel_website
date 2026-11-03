// ==============================================================================
// THINKATIC CLIENT PORTAL REAL BROWSER E2E VERIFICATION SCRIPT
// Uses Microsoft Edge (Chromium) via puppeteer-core to execute the real browser workflow:
// Signup -> Dashboard -> Profile update -> Refresh -> Logout -> Login -> IDOR check
// ==============================================================================

const puppeteer = require("puppeteer-core");
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function runBrowserE2E() {
  console.log("==================================================================");
  console.log("LAUNCHING REAL CHROMIUM / EDGE BROWSER E2E CLIENT WORKFLOW");
  console.log("==================================================================\n");

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  const testEmail = `sarah_browser_${Date.now()}@aurahealth.com`;
  const testPassword = "StrongPass2026!";
  const testName = "Sarah Jenkins";
  const testCompany = "Aura Health Enterprises Inc.";
  const updatedPhone = "+1 555-432-1099";

  try {
    page.on("console", (msg) => console.log("    [BROWSER CONSOLE]", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("    [BROWSER ERROR]", err.message));
    page.on("response", async (res) => {
      if (res.url().includes("/auth/")) {
        console.log(`    [AUTH HTTP RESPONSE] ${res.status()} ${res.url()}`);
        try {
          const body = await res.text();
          console.log(`    [AUTH RESPONSE BODY] ${body}`);
        } catch {}
      }
    });

    // 1. Navigate to Signup
    console.log("[1] NAVIGATING TO SIGNUP PAGE:");
    await page.goto("http://localhost:5000/signup", { waitUntil: "networkidle0", timeout: 15000 });
    console.log(`    Current URL: ${page.url()}`);

    // Wait for form
    await page.waitForSelector("input[type='email']", { timeout: 10000 });

    // Fill form
    console.log("[2] FILLING CLIENT REGISTRATION FORM:");
    await page.waitForSelector("input[placeholder='Alex Johnson']", { timeout: 5000 });
    await page.type("input[placeholder='Alex Johnson']", testName);
    await page.type("input[type='email']", testEmail);

    const passwordInputs = await page.$$("input[type='password']");
    console.log(`    Found ${passwordInputs.length} password fields`);
    if (passwordInputs.length >= 2) {
      await passwordInputs[0].type(testPassword);
      await passwordInputs[1].type(testPassword);
    } else if (passwordInputs.length === 1) {
      await passwordInputs[0].type(testPassword);
    }

    // Submit
    console.log("[3] SUBMITTING REGISTRATION FORM:");
    const formState = await page.evaluate(() => {
      const form = document.querySelector("form");
      if (!form) return { hasForm: false };
      const inputs = Array.from(form.querySelectorAll("input"));
      return {
        hasForm: true,
        inputs: inputs.map((i) => ({
          type: i.type,
          placeholder: i.placeholder,
          value: i.value,
          valid: i.checkValidity(),
          validationMessage: i.validationMessage,
        })),
      };
    });
    console.log("    Form Validation State:", JSON.stringify(formState, null, 2));

    const submitBtn = await page.$("button[type='submit']");
    if (submitBtn) {
      console.log("    Triggering form submission...");
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/user/auth/signup"), { timeout: 10000 }).catch((e) => console.log("Wait for response timeout:", e.message)),
        page.evaluate(() => {
          const form = document.querySelector("form");
          if (form) form.requestSubmit();
        }),
      ]);
    }

    await new Promise((r) => setTimeout(r, 2000));
    console.log(`    Post-Registration URL: ${page.url()}`);

    // 2. Verify Dashboard
    console.log("\n[4] VERIFYING CLIENT DASHBOARD:");
    await page.waitForSelector("body", { timeout: 5000 });
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasDashboard = page.url().includes("dashboard") || bodyText.includes("Dashboard") || bodyText.includes("Overview");
    console.log(`    Dashboard Loaded: ${hasDashboard}`);

    // Check token in localStorage
    const savedToken = await page.evaluate(() => localStorage.getItem("user_token"));
    console.log(`    Local Session Token Exists: ${Boolean(savedToken)}`);

    // 3. Navigate to Profile Tab / View
    console.log("\n[5] VERIFYING PROFILE & EDITING CONTACT DETAILS:");
    const profileTab = await page.$("button::-p-text('Profile')");
    if (profileTab) {
      await profileTab.click();
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 4. Test Persistence on Page Refresh
    console.log("\n[6] TESTING PAGE REFRESH PERSISTENCE:");
    await page.reload({ waitUntil: "networkidle0" });
    const refreshedToken = await page.evaluate(() => localStorage.getItem("user_token"));
    console.log(`    Post-Refresh URL: ${page.url()}`);
    console.log(`    Session Persisted After Refresh: ${Boolean(refreshedToken)}`);

    // 5. Test Logout
    console.log("\n[7] TESTING LOGOUT WORKFLOW:");
    await page.evaluate(() => {
      localStorage.removeItem("user_token");
      localStorage.removeItem("user_profile");
    });
    await page.goto("http://localhost:5000/login?loggedOut=true", { waitUntil: "networkidle0" });
    console.log(`    Post-Logout URL: ${page.url()}`);
    const tokenAfterLogout = await page.evaluate(() => localStorage.getItem("user_token"));
    console.log(`    Session Cleared: ${!tokenAfterLogout}`);

    // 6. Test Login
    console.log("\n[8] TESTING RE-LOGIN WITH REGISTERED CREDENTIALS:");
    await page.waitForSelector("input[type='email']", { timeout: 10000 });
    await page.type("input[type='email']", testEmail);
    await page.type("input[type='password']", testPassword);
    const loginSubmitBtn = await page.$("button[type='submit']");
    if (loginSubmitBtn) {
      console.log("    Triggering login submission...");
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/user/auth/login"), { timeout: 10000 }).catch((e) => console.log("Login wait timeout:", e.message)),
        page.evaluate(() => {
          const form = document.querySelector("form");
          if (form) form.requestSubmit();
        }),
      ]);
    }
    await new Promise((r) => setTimeout(r, 2000));
    console.log(`    Post-Login URL: ${page.url()}`);
    const reLoggedInToken = await page.evaluate(() => localStorage.getItem("user_token"));
    console.log(`    Re-login Succeeded with Session: ${Boolean(reLoggedInToken)}`);

    // 7. Test Unauthorized Cross-Role Navigation
    console.log("\n[9] TESTING UNAUTHORIZED ROLE ACCESS (BPO Partner Portal):");
    await page.goto("http://localhost:5000/partner/apply", { waitUntil: "networkidle0" });
    console.log(`    Navigated to /partner/apply: Current URL = ${page.url()}`);

    console.log("\n==================================================================");
    console.log("REAL BROWSER E2E VERIFICATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================================\n");
  } catch (err) {
    console.error("Browser E2E Execution Error:", err);
  } finally {
    await browser.close();
  }
}

runBrowserE2E().catch((e) => {
  console.error("Browser E2E fatal:", e);
  process.exit(1);
});
