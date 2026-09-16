import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { getIgnavConfig, IgnavError, IgnavFlightProvider, type IgnavFlexibleSlice } from "../services/ignav";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function safeFailure(error: unknown) {
  return error instanceof IgnavError ? error : new IgnavError(502, "Ignav is temporarily unavailable.");
}

// ---------------------------------------------------------------------------
// GET /api/ignav/health
// ---------------------------------------------------------------------------
router.get("/ignav/health", async (_req, res): Promise<void> => {
  if (!getIgnavConfig().apiKey) {
    res.status(503).json({ connected: false, provider: "ignav", service: "flight-api" });
    return;
  }
  try {
    res.json(await new IgnavFlightProvider().health());
  } catch (error) {
    const failure = safeFailure(error);
    logger.warn({ err: error }, "Ignav health check failed");
    res.status(failure.statusCode).json({ connected: false, provider: "ignav", service: "flight-api" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/ignav/airports?q=<query>
// ---------------------------------------------------------------------------
router.get("/ignav/airports", async (req, res): Promise<void> => {
  try {
    const query = z.string().trim().max(100).optional().parse(typeof req.query.q === "string" ? req.query.q : undefined);
    const airports = await new IgnavFlightProvider().airports(query);
    res.json({ provider: "ignav", airports });
  } catch (error) {
    const failure = safeFailure(error);
    logger.warn({ err: error }, "Ignav airport search failed");
    res.status(failure.statusCode).json({ provider: "ignav", airports: [], message: failure.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ignav/search
// Handles one-way, round-trip, and flexible/multi-city searches.
// tripType: "one-way" | "round-trip" | "flexible"
// ---------------------------------------------------------------------------
const searchSchema = z.discriminatedUnion("tripType", [
  z.object({
    tripType: z.literal("one-way"),
    from: z.string().trim().min(2).max(10).transform((v) => v.toUpperCase()),
    to: z.string().trim().min(2).max(10).transform((v) => v.toUpperCase()),
    departure: z.string().trim().min(7).max(10),
    travellers: z.coerce.number().int().min(1).max(12).default(1),
    cabin: z.string().trim().default("Economy"),
  }),
  z.object({
    tripType: z.literal("round-trip"),
    from: z.string().trim().min(2).max(10).transform((v) => v.toUpperCase()),
    to: z.string().trim().min(2).max(10).transform((v) => v.toUpperCase()),
    departure: z.string().trim().min(7).max(10),
    returnDate: z.string().trim().min(7).max(10),
    travellers: z.coerce.number().int().min(1).max(12).default(1),
    cabin: z.string().trim().default("Economy"),
  }),
  z.object({
    tripType: z.literal("flexible"),
    slices: z.array(z.object({
      origin: z.string().trim().min(2).max(10).transform((v) => v.toUpperCase()),
      destination: z.string().trim().min(2).max(10).transform((v) => v.toUpperCase()),
      departure: z.string().trim().min(7).max(10),
    })).min(1).max(6),
    travellers: z.coerce.number().int().min(1).max(12).default(1),
    cabin: z.string().trim().default("Economy"),
  }),
]);

router.post("/ignav/search", async (req, res): Promise<void> => {
  if (!getIgnavConfig().apiKey) {
    res.status(503).json({ status: "not_configured", provider: "ignav", results: [], message: "Ignav API key is not configured." });
    return;
  }

  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Invalid search parameters.", results: [] });
    return;
  }

  try {
    const provider = new IgnavFlightProvider();
    const data = parsed.data;

    let results;
    if (data.tripType === "flexible") {
      results = await provider.flexibleSearch(data.slices as IgnavFlexibleSlice[], { travellers: data.travellers, cabin: data.cabin });
    } else {
      results = await provider.search({
        from: data.from,
        to: data.to,
        departure: data.departure,
        returnDate: data.tripType === "round-trip" ? data.returnDate : undefined,
        travellers: data.travellers,
        cabin: data.cabin,
      });
    }

    res.json({
      provider: "Ignav Flight API",
      mode: "LIVE",
      dataSource: "LIVE_FARE_DATA",
      bookingType: "EXTERNAL_BOOKING",
      notice: "These are live fare results from Ignav. Booking opens the airline or OTA website. Zelevos does not issue PNRs or tickets through Ignav.",
      count: results.length,
      results,
    });
  } catch (error) {
    const failure = safeFailure(error);
    logger.warn({ err: error }, "Ignav flight search failed");
    res.status(failure.statusCode).json({
      provider: "ignav",
      mode: "LIVE",
      dataSource: "LIVE_FARE_DATA",
      bookingType: "EXTERNAL_BOOKING",
      results: [],
      message: failure.message,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ignav/booking-links
// ---------------------------------------------------------------------------
router.post("/ignav/booking-links", async (req, res): Promise<void> => {
  const parsed = z.object({ ignavId: z.string().trim().min(1).max(300) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "An Ignav fare id is required." });
    return;
  }
  try {
    const result = await new IgnavFlightProvider().bookingLink(parsed.data.ignavId);
    logger.info({ status: 200, ok: true }, "Ignav booking-links request succeeded");
    res.json({
      provider: "ignav",
      mode: "EXTERNAL_BOOKING",
      notice: "This link opens the airline or OTA booking page. Zelevos does not process this booking.",
      ...result,
    });
  } catch (error) {
    const failure = safeFailure(error);
    logger.warn({ status: failure.statusCode, ok: false, message: failure.message }, "Ignav booking-links failed");
    res.status(failure.statusCode).json({ provider: "ignav", mode: "EXTERNAL_BOOKING", message: failure.message });
  }
});

export default router;
