import assert from "node:assert/strict";
import { test } from "node:test";
import { checkGeminiConnection } from "../src/services/gemini";

// PARKED (Phase 1, 2026-09-19): Gemini live test parked per Wayora_PRD_Without_APIs.
test("optional live Gemini smoke test", { skip: "Parked per Wayora_PRD_Without_APIs" }, async () => {
  const result = await checkGeminiConnection();
  assert.equal(result.text, "ZELEVOS_GEMINI_OK");
  assert.equal(typeof result.model, "string");
});