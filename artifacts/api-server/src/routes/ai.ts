/**
 * CLASSIFICATION: PARK / FUTURE (Auxiliary AI Planner & Chat Routes)
 * 
 * Status: PARKED. Not part of the active V1 API-Free Curated Marketplace customer journey.
 * PRD Reference: Wayora_PRD_Without_APIs Section 1 & Section 7.1
 * Preserved for future AI features per directive's "park, don't delete" rule.
 */

import { Router, type IRouter } from "express";
import {
  checkGeminiConnection,
  generateGeminiText,
  GeminiError,
  getGeminiConfig,
  type GeminiMessage,
} from "../services/gemini";
import { z } from "zod/v4";

const router: IRouter = Router();

const plannerInputSchema = z.object({
  destination: z.string().trim().min(1).max(200),
  dates: z.string().trim().min(1).max(200),
  durationDays: z.number().int().min(1).max(365),
  travellers: z.number().int().min(1).max(100),
  budget: z.string().trim().min(1).max(100),
  preferences: z.array(z.string().trim().min(1).max(80)).max(20),
});

const plannerOutputSchema = z.object({
  summary: z.string().trim().min(1).max(4_000),
  itinerary: z.array(
    z.object({
      day: z.number().int().min(1).max(365),
      title: z.string().trim().min(1).max(200),
      activities: z.array(z.string().trim().min(1).max(500)).max(20),
    }),
  ).max(365),
  estimatedCosts: z.record(z.string(), z.unknown()),
  transportInfo: z.record(z.string(), z.unknown()).nullable(),
  hotelInfo: z.record(z.string(), z.unknown()).nullable(),
  reasoning: z.string().trim().min(1).max(20_000),
});

function failureResponse(error: unknown) {
  if (error instanceof GeminiError) {
    return {
      status: error.statusCode,
      body: {
        configured: getGeminiConfig().apiKey.length > 0,
        provider: "gemini",
        status: error.code,
        message: error.message,
      },
    };
  }
  return {
    status: 502,
    body: {
      configured: getGeminiConfig().apiKey.length > 0,
      provider: "gemini",
      status: "network_failure",
      message: "The AI service is temporarily unavailable.",
    },
  };
}

function demoPlanner(input: z.infer<typeof plannerInputSchema>) {
  const activities = [
    `Arrive in ${input.destination} and settle into a comfortable base.`,
    `Explore a local neighbourhood with a relaxed ${input.preferences[0] || "culture"} focus.`,
    `Take a guided day trip with time for an unplanned local stop.`,
    `Enjoy a signature meal and a slower evening.`,
    `Keep the final day flexible for a favourite revisit and departure.`,
  ];
  return {
    summary: `A ${input.durationDays}-day ${input.preferences[0] || "balanced"} escape to ${input.destination}`,
    itinerary: Array.from({ length: input.durationDays }, (_, index) => ({
      day: index + 1,
      title: index === 0 ? "Arrive softly" : index === input.durationDays - 1 ? "Leave room for one more moment" : `Day ${index + 1} · Explore at your pace`,
      activities: [activities[index % activities.length]],
    })),
    estimatedCosts: { total: input.budget, travellers: input.travellers, note: "DEMO estimate based on your stated budget." },
    transportInfo: { arrival: "Use a pre-booked airport transfer or verified local taxi." },
    hotelInfo: { recommendation: "Choose a well-reviewed central stay with flexible cancellation." },
    reasoning: `This demo plan balances ${input.preferences.join(", ") || "your priorities"} across ${input.durationDays} days while keeping the stated budget visible for review.`,
    model: "zelevos-demo-ai",
    provider: "demo",
    mode: "DEMO",
  };
}

function demoChat(message: string) {
  return {
    response: `DEMO AI: For “${message.slice(0, 240)}”, start with a flexible route, one anchor experience per day, and a protected budget buffer. Gemini is not configured, so this is a local planning response and no booking has been made.`,
    model: "zelevos-demo-ai",
    provider: "demo",
    mode: "DEMO",
  };
}

router.get("/ai/health", async (_req, res) => {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    res.status(503).json({
      configured: false,
      provider: "gemini",
      status: "missing_secret",
    });
    return;
  }

  try {
    const result = await checkGeminiConnection();
    res.json({
      configured: true,
      provider: "gemini",
      status: result.text === "ZELEVOS_GEMINI_OK" ? "connected" : "unexpected_response",
      model: result.model,
    });
  } catch (error) {
    const failure = failureResponse(error);
    res.status(failure.status).json({
      ...failure.body,
      model,
    });
  }
});

router.post("/ai/planner", async (req, res) => {
  const parsedInput = plannerInputSchema.safeParse(req.body);
  if (!parsedInput.success) {
    res.status(400).json({
      status: "invalid_request",
      message: "Provide a destination, dates, duration, travellers, budget, and preferences.",
    });
    return;
  }

  const input = parsedInput.data;
  try {
    if (!getGeminiConfig().apiKey) {
      res.json(demoPlanner(input));
      return;
    }
    const result = await generateGeminiText([
      {
        role: "user",
        content: [
          "You are Zelevos AI's trip planner. Return only valid JSON, with no markdown fences or extra text.",
          "Use exactly this shape:",
          JSON.stringify({
            summary: "short preview of the recommended trip",
            itinerary: [{ day: 1, title: "day title", activities: ["activity"] }],
            estimatedCosts: { total: "₹0", breakdown: "brief breakdown" },
            transportInfo: { arrival: "brief guidance" },
            hotelInfo: { recommendation: "brief guidance" },
            reasoning: "why this plan fits the traveller",
          }),
          `Plan a ${input.durationDays}-day trip to ${input.destination} for ${input.travellers} travellers during ${input.dates}.`,
          `Budget: ${input.budget}. Priorities: ${input.preferences.join(", ") || "balanced travel"}.`,
          "Include one itinerary entry per day, realistic estimated costs, transport and hotel guidance, and a clear recommendation rationale.",
        ].join("\n"),
      },
    ]);

    const jsonCandidate = result.text.match(/\{[\s\S]*\}/)?.[0];
    let plannerData: unknown;
    if (jsonCandidate) {
      try {
        plannerData = JSON.parse(jsonCandidate) as unknown;
      } catch {
        plannerData = undefined;
      }
    }
    const parsedOutput = plannerOutputSchema.safeParse(plannerData);
    if (!parsedOutput.success) {
      plannerData = {
        summary: result.text.slice(0, 4_000),
        itinerary: [{
          day: 1,
          title: "AI-generated itinerary",
          activities: [result.text.slice(0, 1_000)],
        }],
        estimatedCosts: { budget: input.budget, note: "See the AI recommendation for the detailed estimate." },
        transportInfo: null,
        hotelInfo: null,
        reasoning: result.text.slice(0, 20_000),
      };
    }

    res.json({ ...plannerData as object, model: result.model });
  } catch (error) {
    const failure = failureResponse(error);
    res.status(failure.status).json(failure.body);
  }
});

router.post("/ai/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
  const history = rawHistory
    .filter(
      (item: unknown): item is GeminiMessage =>
        typeof item === "object" &&
        item !== null &&
        ((item as GeminiMessage).role === "user" ||
          (item as GeminiMessage).role === "assistant") &&
        typeof (item as GeminiMessage).content === "string",
    )
    .slice(-10);

  if (!message || message.length > 4000) {
    res.status(400).json({
      status: "invalid_request",
      message: "Please send a message between 1 and 4,000 characters.",
    });
    return;
  }

  try {
    if (!getGeminiConfig().apiKey) {
      res.json(demoChat(message));
      return;
    }
    const result = await generateGeminiText([
      {
        role: "user",
        content:
          "You are Zelevos, a trustworthy India-first AI travel operating system. Be concise, practical, and transparent that bookings are not completed by this demo. Help with trip planning, destinations, itineraries, comparisons, budgets, replanning, and travel questions.",
      },
      ...history,
      { role: "user", content: message },
    ]);
    res.json({ response: result.text, model: result.model });
  } catch (error) {
    const failure = failureResponse(error);
    res.status(failure.status).json(failure.body);
  }
});

export default router;