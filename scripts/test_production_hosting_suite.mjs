import puppeteer from "puppeteer-core";

process.env.PORT = "3005";
process.env.NODE_ENV = "production";

console.log("==================================================");
console.log("STARTING PRODUCTION HOSTING VERIFICATION SUITE");
console.log("==================================================");

console.log("\n1. Starting production server in-process on port 3005...");
const startTime = Date.now();
await import("../artifacts/api-server/dist/index.mjs");

// Allow server 2 seconds to establish socket
await new Promise((r) => setTimeout(r, 2000));

console.log("\n2. Executing HTTP Endpoint & Routing Tests...");

const tests = [
  { name: "Root /", url: "http://localhost:3005/", check: (r, b) => r.status === 200 && b.includes("<!DOCTYPE html>") },
  { name: "Root /healthz", url: "http://localhost:3005/healthz", check: (r, b) => r.status === 200 && b.includes("ok") },
  { name: "Root /health", url: "http://localhost:3005/health", check: (r, b) => r.status === 200 && b.includes("ok") },
  { name: "API /api/healthz", url: "http://localhost:3005/api/healthz", check: (r, b) => r.status === 200 && b.includes("ok") },
  { name: "Favicon /favicon.ico", url: "http://localhost:3005/favicon.ico", check: (r) => r.status === 200 },
  { name: "Favicon /favicon.png", url: "http://localhost:3005/favicon.png", check: (r) => r.status === 200 },
  { name: "Deep link /login", url: "http://localhost:3005/login", check: (r, b) => r.status === 200 && b.includes("<!DOCTYPE html>") },
  { name: "Deep link /admin", url: "http://localhost:3005/admin", check: (r, b) => r.status === 200 && b.includes("<!DOCTYPE html>") },
  { name: "Deep link /bpo", url: "http://localhost:3005/bpo", check: (r, b) => r.status === 200 && b.includes("<!DOCTYPE html>") },
  { name: "Deep link /agent", url: "http://localhost:3005/agent", check: (r, b) => r.status === 200 && b.includes("<!DOCTYPE html>") },
  { name: "Deep link /client", url: "http://localhost:3005/client", check: (r, b) => r.status === 200 && b.includes("<!DOCTYPE html>") },
  { name: "Deep link /services", url: "http://localhost:3005/services", check: (r, b) => r.status === 200 && b.includes("<!DOCTYPE html>") },
  { name: "Deep link /global-delivery", url: "http://localhost:3005/global-delivery", check: (r, b) => r.status === 200 && b.includes("<!DOCTYPE html>") },
  { name: "Deep link /bpo-partner-benefits", url: "http://localhost:3005/bpo-partner-benefits", check: (r, b) => r.status === 200 && b.includes("<!DOCTYPE html>") },
  { name: "Deep link /technology-ai", url: "http://localhost:3005/technology-ai", check: (r, b) => r.status === 200 && b.includes("<!DOCTYPE html>") },
  { name: "Deep link /network", url: "http://localhost:3005/network", check: (r, b) => r.status === 200 && b.includes("<!DOCTYPE html>") },
  { name: "Deep link /faqs", url: "http://localhost:3005/faqs", check: (r, b) => r.status === 200 && b.includes("<!DOCTYPE html>") },
  { name: "API /api/plans", url: "http://localhost:3005/api/plans", check: (r) => r.status === 200 },
];

let passed = 0;
for (const t of tests) {
  try {
    const res = await fetch(t.url);
    const body = await res.text();
    const ok = t.check(res, body);
    if (ok) {
      console.log(`✅ ${t.name} -> status: ${res.status}`);
      passed++;
    } else {
      console.error(`❌ ${t.name} -> status: ${res.status}, body: ${body.slice(0, 120)}`);
    }
  } catch (err) {
    console.error(`❌ ${t.name} -> error: ${err.message}`);
  }
}

// Header checks
const rootRes = await fetch("http://localhost:3005/");
const rootCache = rootRes.headers.get("cache-control");
console.log(`\n📋 Index.html Cache-Control: ${rootCache} (Expected: no-cache, no-store, must-revalidate)`);

// CORS check
const corsRes = await fetch("http://localhost:3005/api/healthz", {
  headers: { Origin: "https://thinkatic.com" },
});
const corsAllow = corsRes.headers.get("access-control-allow-origin");
console.log(`📋 CORS for https://thinkatic.com: ${corsAllow}`);

console.log(`\n3. Executing Real Browser Smoke QA with Microsoft Edge...`);
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const browserRoutes = [
  { path: "/", name: "Homepage" },
  { path: "/services", name: "Services" },
  { path: "/global-delivery", name: "Global Delivery" },
  { path: "/bpo-partner-benefits", name: "BPO Partner Benefits" },
  { path: "/technology-ai", name: "Technology AI" },
  { path: "/network", name: "Network" },
  { path: "/faqs", name: "FAQs" },
  { path: "/login", name: "User Login" },
  { path: "/signup", name: "User Signup" },
  { path: "/admin-login", name: "Admin Login" },
  { path: "/agent/login", name: "Agent Login" },
  { path: "/become-partner", name: "Become Partner" },
];

let passedBrowserRoutes = 0;
for (const r of browserRoutes) {
  try {
    await page.goto(`http://localhost:3005${r.path}`, { waitUntil: "networkidle2", timeout: 15000 });
    const title = await page.title();
    const content = await page.content();
    if (content.length > 500 && !content.includes("Cannot GET") && title.includes("Thinkatic")) {
      console.log(`✅ [Browser] ${r.name} (${r.path}) rendered properly (title: "${title}")`);
      passedBrowserRoutes++;
    } else {
      console.error(`❌ [Browser] ${r.name} (${r.path}) failed check`);
    }
  } catch (e) {
    console.error(`❌ [Browser] ${r.name} error: ${e.message}`);
  }
}

// Deep-link reload test
console.log("\n4. Testing Deep-Link Browser Refresh...");
await page.goto("http://localhost:3005/bpo-partner-benefits", { waitUntil: "networkidle2" });
await page.reload({ waitUntil: "networkidle2" });
const reloadContent = await page.content();
const reloadOk = reloadContent.length > 1000 && !reloadContent.includes("Cannot GET");
console.log(reloadOk ? "✅ [Browser] Deep-link reload PASSED" : "❌ [Browser] Deep-link reload FAILED");

await browser.close();

const totalHttp = tests.length;
const totalBrowser = browserRoutes.length;
console.log("\n==================================================");
console.log(`FINAL REPORT:`);
console.log(`  HTTP Endpoints & Deep Links: ${passed} / ${totalHttp} PASS`);
console.log(`  Browser Render & Routes:     ${passedBrowserRoutes} / ${totalBrowser} PASS`);
console.log(`  Deep-Link Refresh:           ${reloadOk ? "PASS" : "FAIL"}`);
console.log("==================================================");

const allOk = passed === totalHttp && passedBrowserRoutes === totalBrowser && reloadOk;
process.exit(allOk ? 0 : 1);
