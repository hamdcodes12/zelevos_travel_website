import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { getIgnavConfig, IgnavError, IgnavFlightProvider } from "../services/ignav";

const router: IRouter = Router();

function safeFailure(error: unknown) {
  return error instanceof IgnavError ? error : new IgnavError(502, "Ignav is temporarily unavailable.");
}

router.get("/ignav/health", async (_req, res): Promise<void> => {
  if (!getIgnavConfig().apiKey) {
    res.status(503).json({ connected: false, provider: "ignav", service: "flight-api" });
    return;
  }
  try {
    res.json(await new IgnavFlightProvider().health());
  } catch (error) {
    const failure = safeFailure(error);
    res.status(failure.statusCode).json({ connected: false, provider: "ignav", service: "flight-api" });
  }
});

router.get("/ignav/airports", async (req, res): Promise<void> => {
  try {
    const query = z.string().trim().max(100).optional().parse(typeof req.query.q === "string" ? req.query.q : undefined);
    const airports = await new IgnavFlightProvider().airports(query);
    res.json({ provider: "ignav", airports });
  } catch (error) {
    const failure = safeFailure(error);
    res.status(failure.statusCode).json({ provider: "ignav", airports: [], message: failure.message });
  }
});

router.post("/ignav/booking-links", async (req, res): Promise<void> => {
  const parsed = z.object({ ignavId: z.string().trim().min(1).max(300) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "An Ignav fare id is required." });
    return;
  }
  try {
    const result = await new IgnavFlightProvider().bookingLink(parsed.data.ignavId);
    res.json({ provider: "ignav", mode: "EXTERNAL_BOOKING", ...result });
  } catch (error) {
    const failure = safeFailure(error);
    res.status(failure.statusCode).json({ provider: "ignav", mode: "EXTERNAL_BOOKING", message: failure.message });
  }
});

export default router;
