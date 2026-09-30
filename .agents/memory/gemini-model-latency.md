---
name: Gemini model latency
description: Runtime behavior observed when verifying Gemini REST generateContent models in this workspace
---

For interactive Wayora requests, prefer a model that has been verified with a small generateContent request and returns text within the endpoint timeout. Some Gemini 3.x models can consume a small output budget on internal reasoning, producing an empty candidate or exceeding a short health-check timeout even though authentication and model discovery succeed.

**Why:** The configured key and API endpoint were valid, but a minimal request against a reasoning-heavy model did not return usable text within the service health timeout; a verified lite model returned the exact test response promptly.

**How to apply:** Re-run the server-side health request when changing `GEMINI_MODEL`; never infer usability from model-list availability alone.