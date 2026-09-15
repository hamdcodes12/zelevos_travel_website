import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.GEMINI_API_KEY = "test-only-key";
process.env.GEMINI_MODEL = "test-model";

const originalFetch = globalThis.fetch;
const { default: app } = await import("../src/app");

let server: ReturnType<typeof app.listen>;
let baseUrl = "";

before(() => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server.close();
  globalThis.fetch = originalFetch;
});

function mockGemini(text: string) {
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (!url.startsWith("https://generativelanguage.googleapis.com/")) {
      return originalFetch(input, init);
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

async function request(path: string, init?: RequestInit) {
  const response = await originalFetch(`${baseUrl}${path}`, init);
  const body = await response.json();
  return { response, body };
}

describe("AI API contract", () => {
  it("returns the expected health response structure", async () => {
    mockGemini("WAYORA_GEMINI_OK");
    const { response, body } = await request("/api/ai/health");
    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      configured: true,
      provider: "gemini",
      status: "connected",
      model: "test-model",
    });
    assert.equal(JSON.stringify(body).includes("test-only-key"), false);
  });

  it("proxies a copilot request without exposing the API key", async () => {
    mockGemini("Travel answer");
    const { response, body } = await request("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Suggest a quiet weekend in Kerala." }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(body, { response: "Travel answer", model: "test-model" });
    assert.equal(JSON.stringify(body).includes("GEMINI_API_KEY"), false);
  });

  it("proxies an AI planner request with the same response contract", async () => {
    mockGemini(JSON.stringify({
      summary: "A calm Kashmir route",
      itinerary: [{ day: 1, title: "Arrive softly", activities: ["Dal Lake shikara"] }],
      estimatedCosts: { total: "₹70,000" },
      transportInfo: { arrival: "Fly into Srinagar" },
      hotelInfo: { recommendation: "Stay near Dal Lake" },
      reasoning: "It keeps the first day light and fits the budget.",
    }));
    const { response, body } = await request("/api/ai/planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: "Kashmir",
        dates: "October 2026",
        durationDays: 5,
        travellers: 2,
        budget: "₹70,000",
        preferences: ["Nature"],
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(body.summary, "A calm Kashmir route");
    assert.equal(body.itinerary[0].day, 1);
    assert.deepEqual(body.itinerary[0].activities, ["Dal Lake shikara"]);
    assert.equal(body.estimatedCosts.total, "₹70,000");
    assert.equal(body.transportInfo.arrival, "Fly into Srinagar");
    assert.equal(body.hotelInfo.recommendation, "Stay near Dal Lake");
    assert.equal(typeof body.reasoning, "string");
    assert.equal(typeof body.model, "string");
    assert.equal(JSON.stringify(body).includes("test-only-key"), false);
  });
});