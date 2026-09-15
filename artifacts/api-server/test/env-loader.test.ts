import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

const { loadEnvironment } = await import("../src/lib/env.ts");

describe("loadEnvironment", () => {
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };

  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wayora-env-"));
    process.chdir(tempDir);
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads Gemini values from a hidden ..env file at the workspace root", () => {
    fs.writeFileSync(path.join(tempDir, "..env"), "GEMINI_API_KEY=env-test-key\nGEMINI_MODEL=gemini-test-model\n");

    loadEnvironment();

    assert.equal(process.env.GEMINI_API_KEY, "env-test-key");
    assert.equal(process.env.GEMINI_MODEL, "gemini-test-model");
  });
});