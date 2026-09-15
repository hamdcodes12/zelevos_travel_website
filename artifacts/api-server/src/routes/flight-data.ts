import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import {
  getTravelpayoutsFlightData,
  TravelpayoutsError,
} from "../services/travelpayouts";

const router: IRouter = Router();

router.get("/flights/data", async (req, res): Promise<void> => {
  const parsed = z.object({
    from: z.string().trim().length(3).transform((value) => value.toUpperCase()),
    to: z.string().trim().length(3).transform((value) => value.toUpperCase()),
    departure: z.string().trim().min(7).max(10),
    returnDate: z.string().trim().min(7).max(10).optional(),
    currency: z.string().trim().length(3).default("INR").transform((value) => value.toUpperCase()),
  }).safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      status: "invalid_request",
      message: "Provide valid origin, destination, and departure date parameters.",
      data: [],
    });
    return;
  }
  if (parsed.data.from === parsed.data.to) {
    res.status(400).json({ status: "invalid_request", message: "Origin and destination cannot be the same.", data: [] });
    return;
  }

  try {
    const result = await getTravelpayoutsFlightData({
      origin: parsed.data.from,
      destination: parsed.data.to,
      departureAt: parsed.data.departure,
      returnAt: parsed.data.returnDate,
      currency: parsed.data.currency,
    });
    res.set("Cache-Control", "private, max-age=300");
    res.json({
      provider: "travelpayouts",
      service: "aviasales-data-api",
      mode: "DATA",
      cached: result.cached,
      count: result.data.length,
      data: result.data,
      message: "Historical and cached fare data for inspiration only. These results are not live inventory and cannot be booked here.",
    });
  } catch (error) {
    if (error instanceof TravelpayoutsError) {
      res.status(error.statusCode).json({
        provider: "travelpayouts",
        service: "aviasales-data-api",
        mode: "DATA",
        data: [],
        message: error.message,
      });
      return;
    }
    res.status(502).json({
      provider: "travelpayouts",
      service: "aviasales-data-api",
      mode: "DATA",
      data: [],
      message: "Travel data is temporarily unavailable.",
    });
  }
});

export default router;
