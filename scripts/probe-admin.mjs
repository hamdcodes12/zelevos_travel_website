import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:\\Users\\navin\\.gemini\\antigravity-ide\\brain\\ff51c7fd-1d5c-4e3a-b4c7-e6aad8f9af04";

async function probeAdmin() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1280, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();
  page.on("console", (m) => console.log(`[BROWSER CONSOLE ${m.type()}]:`, m.text()));
  page.on("pageerror", (err) => console.log(`[BROWSER PAGE_ERROR]:`, err.message));
  page.on("request", (req) => {
    if (req.url().includes("/api/admin")) {
      console.log(`[REQUEST ${req.method()} ${req.url()}]: postData: ${req.postData()}`);
    }
  });
  page.on("response", async (res) => {
    if (res.url().includes("/api/admin")) {
      const status = res.status();
      const text = await res.text().catch(() => "");
      console.log(`[RESPONSE ${res.request().method()} ${res.url()}]: ${status} -> ${text.slice(0, 120)}`);
    }
  });
  page.on("requestfailed", (req) => {
    if (req.url().includes("/api/admin")) {
      console.log(`[REQUEST FAILED ${req.method()} ${req.url()}]: ${req.failure()?.errorText}`);
    }
  });

  await page.goto("http://localhost:3000/admin", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 1000));

  console.log("Setting admin credentials...");
  await page.evaluate(() => {
    const idInput = document.querySelector("form input[type='text']");
    const passInput = document.querySelector("form input[type='password']");
    const proto = window.HTMLInputElement.prototype;
    const valueSetter = Object.getOwnPropertyDescriptor(proto, "value").set;

    valueSetter.call(idInput, "zelevos-travelai00");
    idInput.dispatchEvent(new Event("input", { bubbles: true }));

    valueSetter.call(passInput, "ZT002121");
    passInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  console.log("Clicking submit...");
  const adminSubmit = await page.$("form button[type='submit']");
  await adminSubmit.click();

  await new Promise((r) => setTimeout(r, 4000));

  const pageText = await page.evaluate(() => document.body.innerText);
  console.log("PAGE TEXT AFTER 3s:", pageText.slice(0, 300));

  const adminScreenshot = path.join(ARTIFACTS_DIR, "flow4_admin_probe.png");
  await page.screenshot({ path: adminScreenshot });
  console.log("Saved probe screenshot:", adminScreenshot);

  await browser.close();
}

probeAdmin();
