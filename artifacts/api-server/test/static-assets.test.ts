import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ??= "static-assets-test-session";
process.env.CORS_ALLOWED_ORIGINS = "https://allowed.example";

const frontendRootCandidates = [
  path.resolve(process.cwd(), "artifacts/wayora/dist/public"),
  path.resolve(process.cwd(), "../wayora/dist/public"),
  path.resolve(process.cwd(), "../../artifacts/wayora/dist/public"),
];
const frontendRoot = frontendRootCandidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html")));
assert.ok(frontendRoot, "The production frontend build must exist before static asset tests run.");
const assetNames = fs.readdirSync(path.join(frontendRoot, "assets"));
const jsAsset = assetNames.find((name) => name.endsWith(".js"));
const cssAsset = assetNames.find((name) => name.endsWith(".css"));
assert.ok(jsAsset, "The production build must contain a JavaScript asset.");
assert.ok(cssAsset, "The production build must contain a CSS asset.");

const { default: app } = await import("../src/app");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";

before(() => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

async function request(route: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${route}`, { ...init, redirect: "manual" });
}

describe("production static frontend serving", () => {
  it("serves the real frontend shell without caching it", async () => {
    const response = await request("/");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /text\/html/);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
    assert.match(await response.text(), /id="root"/);
  });

  it("serves real hashed assets with or without browser Origin", async () => {
    for (const asset of [jsAsset, cssAsset]) {
      for (const headers of [{}, { Origin: "http://localhost:3000" }]) {
        const response = await request(`/assets/${asset}`, { headers });
        assert.equal(response.status, 200, asset);
        assert.ok((await response.arrayBuffer()).byteLength > 0, asset);
        assert.match(response.headers.get("cache-control") || "", /immutable/);
      }
    }
  });

  it("returns 404 for missing assets instead of index.html or 500", async () => {
    const response = await request("/assets/does-not-exist.js", { headers: { Origin: "http://localhost:3000" } });
    assert.equal(response.status, 404);
  });

  it("uses the SPA fallback for frontend routes", async () => {
    for (const route of ["/flights", "/hotels", "/dashboard"]) {
      const response = await request(route);
      assert.equal(response.status, 200, route);
      assert.match(await response.text(), /id="root"/);
    }
  });

  it("keeps API CORS scoped and restricted", async () => {
    const allowed = await request("/api/healthz", { headers: { Origin: "https://allowed.example" } });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://allowed.example");

    const unauthorized = await request("/api/healthz", { headers: { Origin: "https://unauthorized.example" } });
    assert.notEqual(unauthorized.status, 200);
  });
});
