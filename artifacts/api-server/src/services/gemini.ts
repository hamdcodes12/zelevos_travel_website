/**
 * CLASSIFICATION: PARK / FUTURE (Auxiliary AI Client)
 * 
 * Status: PARKED. Not part of the active V1 API-Free Curated Marketplace customer journey.
 * PRD Reference: Wayora_PRD_Without_APIs Section 1 (Executive Summary) & Section 3 (Non-goals)
 * Preserved for future AI concierge features per directive's "park, don't delete" rule.
 */

const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

export type GeminiFailureCode =
  | "missing_secret"
  | "authentication_failed"
  | "quota_or_rate_limit"
  | "model_unavailable"
  | "network_failure"
  | "malformed_response";

export class GeminiError extends Error {
  readonly code: GeminiFailureCode;
  readonly statusCode: number;

  constructor(code: GeminiFailureCode, statusCode: number, message: string) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function getGeminiConfig() {
  return {
    apiKey: process.env["GEMINI_API_KEY"]?.trim() ?? "",
    model: process.env["GEMINI_MODEL"]?.trim() || DEFAULT_MODEL,
  };
}

function classifyFailure(status: number, message: string): GeminiError {
  if (status === 401 || status === 403) {
    return new GeminiError("authentication_failed", 502, "Gemini authentication failed.");
  }
  if (status === 429) {
    return new GeminiError("quota_or_rate_limit", 429, "Gemini is temporarily rate limited.");
  }
  if (status === 404) {
    return new GeminiError("model_unavailable", 502, "The configured Gemini model is unavailable.");
  }
  return new GeminiError(
    "network_failure",
    502,
    message || "Gemini could not be reached.",
  );
}

export async function generateGeminiText(
  messages: GeminiMessage[],
  options: { timeoutMs?: number } = {},
) {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    throw new GeminiError("missing_secret", 503, "Gemini is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);

  try {
    const response = await fetch(`${API_ROOT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as GeminiResponse;
    if (!response.ok) {
      throw classifyFailure(
        response.status,
        payload.error?.message ?? response.statusText,
      );
    }
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) {
      throw new GeminiError(
        "malformed_response",
        502,
        "Gemini returned an empty response.",
      );
    }
    return { text, model };
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GeminiError("network_failure", 504, "Gemini took too long to respond.");
    }
    throw new GeminiError("network_failure", 502, "Gemini could not be reached.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkGeminiConnection() {
  return generateGeminiText(
    [{ role: "user", content: "Reply with exactly: ZELEVOS_GEMINI_OK" }],
    { timeoutMs: 15_000 },
  );
}