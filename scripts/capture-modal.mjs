import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox"],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });

  const pass = await page.waitForSelector('input[type="password"]', { timeout: 4000 }).catch(() => null);
  if (pass) {
    await pass.type("ZT002121");
    const sub = await page.waitForSelector('button[type="submit"]');
    await sub.click();
    await page.waitForFunction(() => !document.body.textContent.includes("Authenticating..."));
    await new Promise((r) => setTimeout(r, 1200));
  }

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("aside nav button"));
    const target = btns.find((b) => b.textContent.includes("Packages"));
    if (target) target.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const createBtn = btns.find((b) => b.textContent.includes("Create New Package"));
    if (createBtn) createBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Check the checkbox to show expiry date picker
  await page.evaluate(() => {
    const cb = document.getElementById("admin-pkg-members-only");
    if (cb && !cb.checked) cb.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  await page.screenshot({ path: "admin_modal_exclusive_deal_fields.png" });
  await browser.close();
  console.log("✓ Modal screenshot saved: admin_modal_exclusive_deal_fields.png");
}

main().catch(console.error);
