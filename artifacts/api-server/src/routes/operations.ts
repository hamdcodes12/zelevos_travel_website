import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { bookingsTable, db, generatedTripsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { generateGeminiText, GeminiError } from "../services/gemini";
import { getGeminiConfig } from "../services/gemini";

const router: IRouter = Router();

router.get("/concierge/context", requireAuth, async (req, res): Promise<void> => {
  try {
    const [trips, bookings] = await Promise.all([
      db.select().from(generatedTripsTable).where(eq(generatedTripsTable.ownerId, req.user!.id)).orderBy(desc(generatedTripsTable.updatedAt)).limit(5),
      db.select().from(bookingsTable).where(eq(bookingsTable.ownerId, req.user!.id)).orderBy(desc(bookingsTable.createdAt)).limit(10),
    ]);
    res.json({
      context: {
        traveller: { email: req.user!.email },
        trips: trips.map(({ ownerId: _ownerId, ...trip }: any) => trip),
        bookings,
      },
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to build concierge context");
    res.status(500).json({ status: "database_error", message: "Trip context could not be loaded." });
  }
});

router.post("/concierge", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({
    message: z.string().trim().min(1).max(4000),
    history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(10).optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Send a message between 1 and 4,000 characters." });
    return;
  }
  try {
    const [trip] = await db.select().from(generatedTripsTable).where(eq(generatedTripsTable.ownerId, req.user!.id)).orderBy(desc(generatedTripsTable.updatedAt)).limit(1);
    if (!getGeminiConfig().apiKey) {
      res.json({
        response: `DEMO CONCIERGE: I would review your ${trip?.destination || "saved trip"} plan for timing, budget, and breathing room. Gemini is not configured, so this is a local recommendation and no booking change was made.`,
        model: "wayora-demo-ai",
        provider: "demo",
        mode: "DEMO",
        context: trip ? { tripId: trip.id, destination: trip.destination } : null,
      });
      return;
    }
    const result = await generateGeminiText([
      {
        role: "user",
        content: "You are Wayora's trip-aware concierge. Be concise, practical, and transparent that demo bookings are not live. Use the supplied trip context, never invent booking confirmations, and ask for approval before consequential changes.",
      },
      {
        role: "user",
        content: `Current trip context: ${JSON.stringify(trip ? { destination: trip.destination, dates: trip.dates, itinerary: trip.itinerary, budget: trip.budget } : { noTrip: true })}`,
      },
      ...(parsed.data.history ?? []),
      { role: "user", content: parsed.data.message },
    ]);
    res.json({ response: result.text, model: result.model, context: trip ? { tripId: trip.id, destination: trip.destination } : null });
  } catch (error) {
    if (error instanceof GeminiError) {
      res.status(error.statusCode).json({ status: error.code, message: error.message });
      return;
    }
    req.log.error({ err: error }, "Concierge request failed");
    res.status(502).json({ status: "ai_unavailable", message: "The concierge is temporarily unavailable." });
  }
});

router.post("/trips/:id/monitor", requireAuth, async (req, res): Promise<void> => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ status: "invalid_request", message: "Trip id must be a UUID." });
    return;
  }
  try {
    const [trip] = await db.select().from(generatedTripsTable).where(and(eq(generatedTripsTable.id, parsedId.data), eq(generatedTripsTable.ownerId, req.user!.id)));
    if (!trip) {
      res.status(404).json({ status: "not_found", message: "Trip not found." });
      return;
    }
    res.json({
      event: { type: "FLIGHT_DELAYED", severity: "warning", title: "Flight delayed by 2h 15m", message: "Your museum booking is now at risk.", demo: true },
      proposal: { title: "Protect the afternoon", changes: ["Move the museum visit to 5:30 PM", "Keep the dinner reservation unchanged"], requiresApproval: true },
      tripId: trip.id,
    });
  } catch (error) {
    req.log.error({ err: error }, "Trip monitoring failed");
    res.status(500).json({ status: "database_error", message: "Trip monitoring could not run." });
  }
});

router.post("/trips/:id/replan", requireAuth, async (req, res): Promise<void> => {
  const parsedId = z.string().uuid().safeParse(req.params.id);
  const action = z.object({ approved: z.boolean() }).safeParse(req.body);
  if (!parsedId.success || !action.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide a valid trip id and approval decision." });
    return;
  }
  try {
    const [trip] = await db.select().from(generatedTripsTable).where(and(eq(generatedTripsTable.id, parsedId.data), eq(generatedTripsTable.ownerId, req.user!.id)));
    if (!trip) {
      res.status(404).json({ status: "not_found", message: "Trip not found." });
      return;
    }
    if (!action.data.approved) {
      res.json({ approved: false, message: "The proposed changes were left untouched.", trip: { id: trip.id } });
      return;
    }
    const itinerary = Array.isArray(trip.itinerary) ? trip.itinerary.map((day: any, index: number) => {
      if (!day || typeof day !== "object") return day;
      const record = day as { day?: number; title?: string; activities?: string[] };
      if (index !== 1 || !Array.isArray(record.activities)) return day;
      return { ...record, activities: [...record.activities.slice(0, 1), "Museum visit · 5:30 PM (replanned)"] };
    }) : trip.itinerary;
    const [updated] = await db.update(generatedTripsTable).set({ itinerary, updatedAt: new Date() }).where(and(eq(generatedTripsTable.id, trip.id), eq(generatedTripsTable.ownerId, req.user!.id))).returning();
    res.json({ approved: true, message: "Demo itinerary updated. No live booking was changed.", trip: updated });
  } catch (error) {
    req.log.error({ err: error }, "Trip replanning failed");
    res.status(500).json({ status: "database_error", message: "Trip could not be replanned." });
  }
});

export default router;