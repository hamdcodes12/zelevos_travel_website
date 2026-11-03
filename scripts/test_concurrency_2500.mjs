/**
 * High-Concurrency Production Load-Testing Suite for Thinkatic Platform
 * 
 * Progressively benchmarks concurrency tiers:
 *   - 100 concurrent requests
 *   - 250 concurrent requests
 *   - 500 concurrent requests
 *   - 1,000 concurrent requests
 *   - 1,500 concurrent requests
 *   - 2,500 concurrent requests
 * 
 * Tests realistic user traffic profiles:
 *   1. Health check & static readiness (/healthz)
 *   2. Public catalog read (/api/plans/catalogue)
 *   3. Authenticated Admin BPO applications paginated list (/api/admin/bpo-applications?page=1&pageSize=25)
 *   4. Authenticated Partner status query (/api/bpo/status)
 *   5. Dossier metadata load (verifying unblocked by storage media)
 */

import http from "http";
import https from "https";

const BASE_URL = process.env.BASE_URL || "http://localhost:4317";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "bpo.test@thinkatic.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "256b2#bpo";

// Reuse HTTP Agent with keep-alive for accurate high-concurrency connection pooling
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 3000,
  maxFreeSockets: 500,
  timeout: 30000,
});

async function makeRequest(url, options = {}) {
  const start = performance.now();
  return new Promise((resolve) => {
    const fullUrl = new URL(url, BASE_URL);
    const reqOptions = {
      method: options.method || "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "x-benchmark-token": "thinkatic-load-test-secret",
        ...(options.headers || {}),
      },
      agent: httpAgent,
      timeout: options.timeout || 15000,
    };

    const req = http.request(fullUrl, reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        const duration = performance.now() - start;
        resolve({
          status: res.statusCode,
          duration,
          data,
          headers: res.headers,
        });
      });
    });

    req.on("error", (err) => {
      const duration = performance.now() - start;
      resolve({
        status: 0,
        duration,
        error: err.message,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      const duration = performance.now() - start;
      resolve({
        status: 408,
        duration,
        error: "Request Timeout (15s)",
      });
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { min: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = sum / sorted.length;

  const p = (pct) => {
    const index = Math.min(Math.floor((pct / 100) * sorted.length), sorted.length - 1);
    return sorted[index];
  };

  return {
    min: sorted[0],
    avg: Number(avg.toFixed(2)),
    p50: Number(p(50).toFixed(2)),
    p90: Number(p(90).toFixed(2)),
    p95: Number(p(95).toFixed(2)),
    p99: Number(p(99).toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
  };
}

async function runConcurrencyTier(name, concurrencyLevel, targetEndpoint, options = {}) {
  process.stdout.write(`  [${name}] Firing ${concurrencyLevel} concurrent requests... `);
  const startTime = performance.now();

  const promises = [];
  for (let i = 0; i < concurrencyLevel; i++) {
    promises.push(makeRequest(targetEndpoint, options));
  }

  const results = await Promise.all(promises);
  const totalDuration = (performance.now() - startTime) / 1000; // in seconds

  const latencies = results.map((r) => r.duration);
  const successCount = results.filter((r) => r.status >= 200 && r.status < 400).length;
  const errorCount = results.filter((r) => r.status >= 500 || r.status === 0 || r.status === 408).length;
  const blockedCount = results.filter((r) => r.status === 401 || r.status === 403 || r.status === 429).length;

  const stats = calculatePercentiles(latencies);
  const rps = Number((concurrencyLevel / totalDuration).toFixed(1));

  console.log(`Done in ${totalDuration.toFixed(2)}s (${rps} req/sec)`);
  console.log(`    Success: ${successCount}/${concurrencyLevel} | Errors (5xx/Timeout): ${errorCount} | Auth/Sec/Blocked: ${blockedCount}`);
  console.log(`    Latency: Min ${stats.min.toFixed(1)}ms | Avg ${stats.avg}ms | p50 ${stats.p50}ms | p95 ${stats.p95}ms | p99 ${stats.p99}ms | Max ${stats.max}ms\n`);

  return {
    tier: concurrencyLevel,
    totalDuration,
    rps,
    successCount,
    errorCount,
    blockedCount,
    stats,
  };
}

async function main() {
  console.log("==============================================================================");
  console.log("🚀 THINKATIC HIGH-CONCURRENCY STRESS & PERFORMANCE BENCHMARK (100 -> 2500)");
  console.log("==============================================================================");
  console.log(`Target Host: ${BASE_URL}`);
  console.log(`Process Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB\n`);

  // 1. Authenticate Admin session
  console.log("1. Authenticating Admin User...");
  const loginRes = await makeRequest("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  let adminToken = "";
  if (loginRes.status === 200) {
    try {
      const parsed = JSON.parse(loginRes.data);
      adminToken = parsed.token || "";
      console.log(`  ✅ Admin session authenticated successfully (Token length: ${adminToken.length})`);
    } catch {}
  } else {
    console.log(`  ⚠️ Notice: Admin login returned status ${loginRes.status}. Continuing with public/endpoint tests.`);
  }

  // 2. Discover an applicant ID for dossier load testing
  let targetApplicantId = "929290f3-98a6-4edb-ac69-43db5d504faa";
  if (adminToken) {
    const appsRes = await makeRequest("/api/admin/bpo-applications?page=1&pageSize=5&envelope=true", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (appsRes.status === 200) {
      try {
        const parsed = JSON.parse(appsRes.data);
        if (parsed.data && parsed.data[0]) {
          targetApplicantId = parsed.data[0].id;
        }
      } catch {}
    }
  }

  const tiers = [100, 250, 500, 1000, 1500, 2500];
  const reportResults = [];

  for (const tier of tiers) {
    console.log(`------------------------------------------------------------------------------`);
    console.log(`📊 CONCURRENCY LEVEL: ${tier} SIMULTANEOUS CLIENTS`);
    console.log(`------------------------------------------------------------------------------`);

    // Scenario A: Health & Static API
    const resA = await runConcurrencyTier(`Tier-${tier} Healthz`, tier, "/healthz");

    // Scenario B: Public Plans & Catalog
    const resB = await runConcurrencyTier(`Tier-${tier} Catalog Read`, tier, "/api/plans/catalogue");

    // Scenario C: Admin Paginated BPO Applications (if token available)
    let resC = null;
    if (adminToken) {
      resC = await runConcurrencyTier(
        `Tier-${tier} Admin BPO Paginated List`,
        tier,
        "/api/admin/bpo-applications?page=1&pageSize=25&envelope=true",
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
    }

    // Scenario D: Dossier Metadata (Metadata load without 70-media blocking)
    let resD = null;
    if (adminToken && targetApplicantId) {
      resD = await runConcurrencyTier(
        `Tier-${tier} BPO Dossier Metadata`,
        tier,
        `/api/admin/bpo-applications/${targetApplicantId}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
    }

    reportResults.push({
      tier,
      healthz: resA,
      catalog: resB,
      adminBpoList: resC,
      bpoDossier: resD,
    });
  }

  console.log("==============================================================================");
  console.log("📈 SUMMARY MATRIX ACROSS ALL TESTED TIERS (100 -> 2500 CONCURRENT USERS)");
  console.log("==============================================================================");
  console.log(`Tier\tHealthz Avg (p95)\tCatalog Avg (p95)\tAdmin BPO Avg (p95)\tThroughput (RPS)`);
  for (const r of reportResults) {
    const h = `${r.healthz.stats.avg}ms (${r.healthz.stats.p95}ms)`;
    const c = `${r.catalog.stats.avg}ms (${r.catalog.stats.p95}ms)`;
    const a = r.adminBpoList ? `${r.adminBpoList.stats.avg}ms (${r.adminBpoList.stats.p95}ms)` : "N/A";
    console.log(`${r.tier}\t${h.padEnd(20)}\t${c.padEnd(20)}\t${a.padEnd(20)}\t${r.catalog.rps} req/s`);
  }
  console.log("==============================================================================");
}

main().catch(console.error);
