import puppeteer from "puppeteer-core";
import assert from "node:assert";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const API_URL = "http://localhost:8080";

async function main() {
  console.log("=== RUNNING UI VERIFICATION & SCREENSHOT CAPTURE ===");

  // 1. Create an active exclusive package via admin API
  console.log("1. Creating active exclusive package via admin API...");
  const adminLoginRes = await fetch(`${API_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminId: "zelevos-travelai00",
      password: "ZT" + "002121",
    }),
  });
  const rawCookie = adminLoginRes.headers.get("set-cookie") || "";
  const adminCookie = rawCookie.split(";")[0];

  const destRes = await fetch(`${API_URL}/api/destinations`);
  const destData = await destRes.json();
  const destList = Array.isArray(destData.results) ? destData.results : destData.destinations || [];
  const destId = destList[0]?.id;

  const pkgId = `ZL-VIP-${Date.now().toString().slice(-4)}`;
  const pkgSlug = `vip-exclusive-kashmir-${Date.now().toString().slice(-4)}`;

  const createPkgRes = await fetch(`${API_URL}/api/admin/packages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      packageId: pkgId,
      title: "Royal Kashmir Luxury Houseboat & Shikara Deal",
      slug: pkgSlug,
      destinationId: destId,
      locations: ["Srinagar", "Gulmarg", "Pahalgam"],
      durationDays: 5,
      durationNights: 4,
      theme: "luxury",
      travellerSuitability: "Couples & VIPs",
      baseCost: 28000,
      sellingPrice: 42500,
      markupType: "percentage",
      markupValue: 51.7,
      serviceFee: 1200,
      inventory: 8,
      inclusions: ["5-Star Luxury Houseboat", "Private Shikara with Sunset Tea", "All Luxury Transfers"],
      exclusions: ["Personal Expenses"],
      status: "active",
      featured: true,
      isMembersOnly: true,
      offerExpiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      days: [
        { dayNumber: 1, title: "Dal Lake Sunset & Royal Welcome", description: "Traditional Kashmiri Kahwa and private shikara excursion.", mealsIncluded: "Dinner" }
      ],
      media: {
        heroImage: "/kashmir-dawn.jpg",
        gallery: ["/kashmir-dawn.jpg"]
      }
    }),
  });

  const pkgData = await createPkgRes.json();
  console.log(`✓ Created test exclusive package: ${pkgData.package.packageId}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  try {
    // 2. Visit homepage as Guest (Non-logged-in)
    console.log("2. Navigating to homepage as Guest...");
    await page.goto(BASE_URL, { waitUntil: "networkidle2" });
    await page.waitForSelector(`#package-card-${pkgId}`, { timeout: 10000 });

    // Verify Locked elements
    const lockBadge = await page.$(`#exclusive-badge-${pkgId}`);
    assert(lockBadge, "Exclusive badge must be visible");
    const unlockBtn = await page.$(`#unlock-package-btn-${pkgId}`);
    assert(unlockBtn, "Unlock with Email button must be visible for guest");

    // Scroll to package card
    await page.evaluate((id) => {
      const el = document.getElementById(`package-card-${id}`);
      if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
    }, pkgId);
    await new Promise((r) => setTimeout(r, 600));

    await page.screenshot({ path: "guest_view_locked_exclusive_deal.png" });
    console.log("✓ Captured screenshot: guest_view_locked_exclusive_deal.png");

    // 3. Click Unlock with Email button -> Check Auth Modal opens
    console.log("3. Clicking Unlock with Email button...");
    await unlockBtn.click();
    await page.waitForSelector("form", { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: "auth_modal_triggered_by_unlock.png" });
    console.log("✓ Captured screenshot: auth_modal_triggered_by_unlock.png");

    // 4. Authenticate customer and set session
    console.log("4. Authenticating verified customer session...");
    const customerEmail = `member_${Date.now()}@zelevos.test`;
    const customerPass = "MemberPass123!";

    const signupRes = await fetch(`${API_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Aarav Singhania (VIP Member)",
        email: customerEmail,
        password: customerPass,
        confirmPassword: customerPass,
      }),
    });
    const signupData = await signupRes.json();
    const otp = signupData.debugOtp;

    const verifyRes = await fetch(`${API_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: customerEmail, otp }),
    });
    const rawCustCookie = verifyRes.headers.get("set-cookie") || "";
    if (rawCustCookie) {
      const cookieParts = rawCustCookie.split(";")[0].split("=");
      await page.setCookie({
        name: cookieParts[0].trim(),
        value: cookieParts.slice(1).join("=").trim(),
        domain: "localhost",
        path: "/",
      });
    }

    // Now reload homepage as authenticated customer
    await page.goto(BASE_URL, { waitUntil: "networkidle2" });
    await page.waitForSelector(`#package-card-${pkgId}`, { timeout: 10000 });
    await page.evaluate((id) => {
      const el = document.getElementById(`package-card-${id}`);
      if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
    }, pkgId);
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: "customer_view_unlocked_deal.png" });
    console.log("✓ Captured screenshot: customer_view_unlocked_deal.png");

    // 5. Check Admin Packages Tab
    console.log("5. Checking Admin Packages Tab...");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
    const passInput = await page.waitForSelector('input[type="password"]', { timeout: 5000 }).catch(() => null);
    if (passInput) {
      await passInput.type("ZT002121");
      const submitBtn = await page.waitForSelector('button[type="submit"]');
      await submitBtn.click();
      await page.waitForFunction(() => !document.body.textContent.includes('Authenticating...'), { timeout: 10000 });
      await new Promise(r => setTimeout(r, 1200));
    }

    // Switch to Packages tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('aside nav button'));
      const target = btns.find(b => b.textContent.includes('Packages'));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // Verify row for created package
    await page.waitForSelector(`#package-row-${pkgData.package.id}`, { timeout: 10000 });
    const exclusiveTag = await page.$(`#exclusive-tag-${pkgData.package.id}`);
    assert(exclusiveTag, "Admin row must show MEMBER EXCLUSIVE tag");
    const expireBtn = await page.$(`#expire-btn-${pkgData.package.id}`);
    assert(expireBtn, "Admin row must have Expire button");
    const deleteBtn = await page.$(`#delete-btn-${pkgData.package.id}`);
    assert(deleteBtn, "Admin row must have Delete button");

    await page.screenshot({ path: "admin_packages_exclusive_controls.png" });
    console.log("✓ Captured screenshot: admin_packages_exclusive_controls.png");

    console.log("\nALL UI CHECKS & SCREENSHOTS COMPLETED SUCCESSFULLY!");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("UI Verification error:", err);
  process.exit(1);
});
