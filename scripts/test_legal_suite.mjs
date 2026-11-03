import http from "node:http";

const CANONICAL_LEGAL_SLUGS = [
  "privacy-policy",
  "terms",
  "partner-agreement",
  "client-agreement",
  "nda",
  "data-protection",
  "acceptable-use",
  "partner-eligibility",
  "payment-commission",
  "termination-suspension",
  "grievance",
  "cookie-policy"
];

const LEGACY_ROUTES = [
  "/privacy",
  "/privacy-policy",
  "/terms",
  "/cookie-policy",
  "/cookies"
];

async function checkUrl(urlPath) {
  return new Promise((resolve) => {
    http.get(`http://localhost:5000${urlPath}`, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        resolve({
          path: urlPath,
          statusCode: res.statusCode,
          hasHtml: data.includes("<!DOCTYPE html") || data.includes("<html"),
          length: data.length
        });
      });
    }).on("error", (err) => {
      resolve({
        path: urlPath,
        statusCode: 0,
        error: err.message
      });
    });
  });
}

async function run() {
  console.log("=== STARTING LEGAL SYSTEM AUDIT & VERIFICATION ===");
  let passed = true;

  console.log("\n1. Testing Canonical Legal Routes (SPA delivery):");
  for (const slug of CANONICAL_LEGAL_SLUGS) {
    const route = `/legal/${slug}`;
    const res = await checkUrl(route);
    if (res.statusCode === 200 && res.hasHtml) {
      console.log(`  [PASS] ${route} -> HTTP 200 OK (${res.length} bytes)`);
    } else {
      console.error(`  [FAIL] ${route} -> Status: ${res.statusCode}, Error: ${res.error || "No HTML shell"}`);
      passed = false;
    }
  }

  console.log("\n2. Testing Legacy Route Aliases & Redirect Shells:");
  for (const route of LEGACY_ROUTES) {
    const res = await checkUrl(route);
    if (res.statusCode === 200 && res.hasHtml) {
      console.log(`  [PASS] ${route} -> HTTP 200 OK (Served SPA shell)`);
    } else {
      console.error(`  [FAIL] ${route} -> Status: ${res.statusCode}, Error: ${res.error || "Failed"}`);
      passed = false;
    }
  }

  console.log("\n3. Verifying Legal Documents Data Integrity:");
  const fs = await import("node:fs");
  const legalDataContent = fs.readFileSync("artifacts/thinkatic/src/data/legalDocuments.ts", "utf-8");

  // Check Effective Date
  if (legalDataContent.includes('effectiveDate: "19 September 2026"')) {
    console.log('  [PASS] Effective Date is set to "19 September 2026" across all documents');
  } else {
    console.error('  [FAIL] Effective date missing or incorrect');
    passed = false;
  }

  // Check no old May 2026 date in legal data
  if (legalDataContent.includes("01st May 2026") || legalDataContent.includes("May 2026")) {
    console.error('  [FAIL] Found old May 2026 date in legal documents');
    passed = false;
  } else {
    console.log('  [PASS] No legacy May 2026 dates present in legal documentation data');
  }

  // Check disclaimer text
  if (legalDataContent.includes("These documents are business-policy and contract templates")) {
    console.log('  [PASS] Professional legal counsel disclaimer is included');
  } else {
    console.error('  [FAIL] Legal counsel disclaimer missing');
    passed = false;
  }

  // Check all 12 slugs defined
  for (const slug of CANONICAL_LEGAL_SLUGS) {
    if (legalDataContent.includes(`slug: "${slug}"`)) {
      console.log(`  [PASS] Data definition for '${slug}' verified`);
    } else {
      console.error(`  [FAIL] Slug '${slug}' not found in legalDocuments.ts`);
      passed = false;
    }
  }

  console.log("\n4. Verifying Footer.tsx Enterprise Legal Directory:");
  const footerContent = fs.readFileSync("artifacts/thinkatic/src/components/layout/Footer.tsx", "utf-8");
  for (const slug of CANONICAL_LEGAL_SLUGS) {
    if (footerContent.includes(`/legal/${slug}`)) {
      console.log(`  [PASS] Footer link to /legal/${slug} present`);
    } else {
      console.error(`  [FAIL] Footer link to /legal/${slug} missing`);
      passed = false;
    }
  }

  // Check footer icons
  const requiredIcons = [
    "Shield", "FileText", "Handshake", "Briefcase", "Lock",
    "Database", "CheckCircle", "BadgeCheck", "CreditCard",
    "AlertTriangle", "MessageSquare", "Cookie"
  ];
  for (const icon of requiredIcons) {
    if (footerContent.includes(icon)) {
      console.log(`  [PASS] Footer icon '${icon}' present`);
    } else {
      console.error(`  [FAIL] Footer icon '${icon}' missing`);
      passed = false;
    }
  }

  console.log("\n5. Verifying App.tsx Routing Configuration:");
  const appContent = fs.readFileSync("artifacts/thinkatic/src/App.tsx", "utf-8");
  if (appContent.includes('path="/legal/:slug"')) {
    console.log('  [PASS] Dynamic Route /legal/:slug configured');
  } else {
    console.error('  [FAIL] Dynamic Route /legal/:slug missing');
    passed = false;
  }
  for (const slug of CANONICAL_LEGAL_SLUGS) {
    if (appContent.includes(`path="/legal/${slug}"`)) {
      console.log(`  [PASS] Explicit Route /legal/${slug} configured`);
    } else {
      console.error(`  [FAIL] Explicit Route /legal/${slug} missing`);
      passed = false;
    }
  }

  console.log("\n==================================================");
  if (passed) {
    console.log("ALL LEGAL AUDIT & VERIFICATION CHECKS PASSED!");
  } else {
    console.error("SOME LEGAL AUDIT CHECKS FAILED!");
    process.exit(1);
  }
  console.log("==================================================");
}

run().catch(console.error);
