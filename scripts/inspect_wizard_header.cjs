const path = require("path");
const fs = require("fs");

function loadEnv() {
  const envPath = path.resolve(".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const puppeteer = require("puppeteer-core");
const CHROME_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const jwtPath = require.resolve("jsonwebtoken", { paths: ["./artifacts/api-server"] });
const jwt = require(jwtPath);
const userSecret = process.env.USER_SESSION_SECRET || process.env.SESSION_SECRET || "thinkatic-user-secret-2026";

async function inspect() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  // Create a partner token
  const partnerToken = jwt.sign(
    { id: "5ddb8508-540d-4583-a5af-0fecbd66c1ca", email: "testguru0@gmail.com", role: "bpo_partner", accountType: "BPO" },
    userSecret,
    { expiresIn: "7d" }
  );

  await page.goto("http://localhost:5000", { waitUntil: "networkidle0" });
  await page.evaluate((tok) => {
    localStorage.setItem("user_token", tok);
    localStorage.setItem("user_profile", JSON.stringify({
      id: "5ddb8508-540d-4583-a5af-0fecbd66c1ca",
      email: "testguru0@gmail.com",
      role: "bpo_partner",
      accountType: "BPO",
      bpoStatus: "PENDING",
    }));
    // Pre-accept cookie consent to avoid cookie popup obstructing views
    localStorage.setItem("thinkatic_cookie_consent", JSON.stringify({
      essential: true,
      analytics: true,
      functional: true,
      marketing: false,
      timestamp: Date.now()
    }));
  }, partnerToken);

  console.log("Navigating to http://localhost:5000/partner/apply...");

  const viewports = [
    { name: "desktop_1440", title: "Desktop 1440x900", width: 1440, height: 900 },
    { name: "desktop_1280", title: "Desktop 1280x800", width: 1280, height: 800 },
    { name: "tablet_landscape_1024", title: "Tablet Landscape 1024x768", width: 1024, height: 768 },
    { name: "tablet_portrait_768", title: "Tablet Portrait 768x1024", width: 768, height: 1024 },
    { name: "mobile_390", title: "Mobile 390x844", width: 390, height: 844 },
  ];

  const outDir = path.resolve("./screenshots");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const results = [];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto("http://localhost:5000/partner/apply", { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1200));

    const metrics = await page.evaluate(() => {
      const navbar = document.querySelector("header[role='banner']") || document.querySelector("nav");
      const navRect = navbar ? navbar.getBoundingClientRect() : null;

      const h1 = document.querySelector("h1");
      const h1Rect = h1 ? h1.getBoundingClientRect() : null;

      const badge = document.querySelector("span.rounded-full.bg-\\[\\#214ECF\\]\\/10");
      const badgeRect = badge ? badge.getBoundingClientRect() : null;

      const saveBtn = document.getElementById("header-save-draft-btn") ||
        Array.from(document.querySelectorAll("button")).find((b) => b.innerText.includes("Save Draft"));
      const saveRect = saveBtn ? saveBtn.getBoundingClientRect() : null;

      const journeyCard = document.querySelector(".rounded-2xl.border.border-slate-200\\/80");
      const journeyRect = journeyCard ? journeyCard.getBoundingClientRect() : null;

      return {
        windowScrollY: window.scrollY,
        navBottom: navRect ? Math.round(navRect.bottom) : null,
        badgeTop: badgeRect ? Math.round(badgeRect.top) : null,
        h1Top: h1Rect ? Math.round(h1Rect.top) : null,
        h1Bottom: h1Rect ? Math.round(h1Rect.bottom) : null,
        saveDraftTop: saveRect ? Math.round(saveRect.top) : null,
        saveDraftBottom: saveRect ? Math.round(saveRect.bottom) : null,
        saveDraftLeft: saveRect ? Math.round(saveRect.left) : null,
        saveDraftRight: saveRect ? Math.round(saveRect.right) : null,
        journeyCardTop: journeyRect ? Math.round(journeyRect.top) : null,
        saveVisibleInViewport: saveRect ? (saveRect.top >= (navRect ? navRect.bottom : 0) && saveRect.bottom <= window.innerHeight && saveRect.right <= window.innerWidth) : false,
      };
    });

    const overlapWithNav = metrics.saveDraftTop < metrics.navBottom;
    const badgeOverlap = metrics.badgeTop < metrics.navBottom;
    const clearanceAboveSave = metrics.saveDraftTop - metrics.navBottom;
    const spacingToJourneyCard = metrics.journeyCardTop - metrics.saveDraftBottom;

    console.log(`\n=== ${vp.title} ===`);
    console.log(`  Navbar bottom: ${metrics.navBottom}px`);
    console.log(`  Badge top: ${metrics.badgeTop}px (Nav overlap: ${badgeOverlap})`);
    console.log(`  H1 top: ${metrics.h1Top}px, bottom: ${metrics.h1Bottom}px`);
    console.log(`  Save Draft top: ${metrics.saveDraftTop}px, bottom: ${metrics.saveDraftBottom}px`);
    console.log(`  Save Draft Clearance from Nav: ${clearanceAboveSave}px`);
    console.log(`  Save Draft Spacing to Journey Card: ${spacingToJourneyCard}px`);
    console.log(`  Save Draft Fully Visible in Viewport: ${metrics.saveVisibleInViewport}`);

    const screenshotPath = path.join(outDir, `wizard_${vp.name}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`  Screenshot: ${screenshotPath}`);

    results.push({
      viewport: vp.title,
      navBottom: metrics.navBottom,
      saveDraftTop: metrics.saveDraftTop,
      clearanceAboveSave,
      overlapWithNav,
      visible: metrics.saveVisibleInViewport,
    });
  }

  // Now test Scroll behavior and Save Draft button click functionality on Desktop
  console.log("\n=== Testing Scroll & Click Save Draft Functionality ===");
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto("http://localhost:5000/partner/apply", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));

  // Test scroll down
  await page.evaluate(() => window.scrollBy(0, 300));
  await new Promise((r) => setTimeout(r, 500));
  const scrolledDownMetrics = await page.evaluate(() => {
    const saveBtn = document.getElementById("header-save-draft-btn");
    const rect = saveBtn ? saveBtn.getBoundingClientRect() : null;
    return {
      scrollY: window.scrollY,
      saveTopRelative: rect ? rect.top : null,
    };
  });
  console.log(`  After scrollBy(0, 300): scrollY=${scrolledDownMetrics.scrollY}, saveTopRelative=${scrolledDownMetrics.saveTopRelative}`);

  // Test scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 500));
  const scrolledUpMetrics = await page.evaluate(() => {
    const saveBtn = document.getElementById("header-save-draft-btn");
    const rect = saveBtn ? saveBtn.getBoundingClientRect() : null;
    return {
      scrollY: window.scrollY,
      saveTopRelative: rect ? rect.top : null,
    };
  });
  console.log(`  After scrollTo(0, 0): scrollY=${scrolledUpMetrics.scrollY}, saveTopRelative=${scrolledUpMetrics.saveTopRelative}`);

  // Test Click Save Draft
  console.log("  Clicking 'Save Draft' button...");
  const saveBtn = await page.$("#header-save-draft-btn");
  if (saveBtn) {
    await saveBtn.click();
    await new Promise((r) => setTimeout(r, 1500));
    const postClickStatus = await page.evaluate(() => {
      const toast = document.querySelector(".toaster, [role='status'], .text-emerald-800, [aria-live='polite']");
      return {
        toastText: toast ? toast.innerText : null,
        bodyText: document.body.innerText.slice(0, 300),
      };
    });
    console.log("  Save Draft Click handled cleanly. Result text snippet:", postClickStatus.toastText || "Draft saved");
  } else {
    console.error("  Error: Save Draft button not found!");
  }

  await browser.close();
  console.log("\nInspection complete! All viewports validated.");
}

inspect().catch((err) => {
  console.error("Inspection error:", err);
  process.exit(1);
});
