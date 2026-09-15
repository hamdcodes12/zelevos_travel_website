import assert from "node:assert/strict";
import { test } from "node:test";
import { checkGeminiConnection } from "../src/services/gemini";

test("optional live Gemini smoke test", { skip: process.env.WAYORA_LIVE_GEMINI !== "1" }, async () => {
  const result = await checkGeminiConnection();
  assert.equal(result.text, "WAYORA_GEMINI_OK");
  assert.equal(typeof result.model, "string");
});