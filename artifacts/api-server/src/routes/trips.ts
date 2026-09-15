import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { db, generatedTripsTable, type GeneratedTrip } from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

const tripInputSchema = z.object({
  destination: z.string().trim().min(1).max(200),
  dates: z.string().trim().min(1).max(200),
  durationDays: z.number().int().min(1).max(365),
  travellers: z.number().int().min(1).max(100),
  budget: z.string().trim().min(1).max(100),
  preferences: z.array(z.string().trim().min(1).max(80)).max(20),
  itinerary: z.array(z.unknown()).max(100),
  estimatedCosts: z.record(z.string(), z.unknown()),
  transportInfo: z.record(z.string(), z.unknown()).nullable(),
  hotelInfo: z.record(z.string(), z.unknown()).nullable(),
  reasoning: z.string().trim().min(1).max(20_000),
});

const tripUpdateSchema = tripInputSchema.partial();

function publicTrip(trip: GeneratedTrip) {
  const { ownerId: _ownerId, ...result } = trip;
  return result;
}

function parseTripId(value: string | string[] | undefined) {
  const id = Array.isArray(value) ? value[0] : value;
  return z.string().uuid().safeParse(id);
}

router.post("/trips", requireAuth, async (req, res): Promise<void> => {
  const parsed = tripInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: parsed.error.message });
    return;
  }

  try {
    const [trip] = await db
      .insert(generatedTripsTable)
      .values({ ...parsed.data, ownerId: req.user!.id })
      .returning();
    res.status(201).json(publicTrip(trip));
  } catch (error) {
    req.log.error({ err: error }, "Failed to create generated trip");
    res.status(500).json({ status: "database_error", message: "Trip could not be saved." });
  }
});

router.get("/trips", requireAuth, async (req, res): Promise<void> => {
  try {
    const trips = await db
      .select()
      .from(generatedTripsTable)
      .where(eq(generatedTripsTable.ownerId, req.user!.id))
      .orderBy(desc(generatedTripsTable.updatedAt));
    res.json(trips.map(publicTrip));
  } catch (error) {
    req.log.error({ err: error }, "Failed to list generated trips");
    res.status(500).json({ status: "database_error", message: "Trips could not be loaded." });
  }
});

router.get("/trips/:id", requireAuth, async (req, res): Promise<void> => {
  const parsedId = parseTripId(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ status: "invalid_request", message: "Trip id must be a UUID." });
    return;
  }

  try {
    const [trip] = await db
      .select()
      .from(generatedTripsTable)
      .where(and(eq(generatedTripsTable.id, parsedId.data), eq(generatedTripsTable.ownerId, req.user!.id)));
    if (!trip) {
      res.status(404).json({ status: "not_found", message: "Trip not found." });
      return;
    }
    res.json(publicTrip(trip));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load generated trip");
    res.status(500).json({ status: "database_error", message: "Trip could not be loaded." });
  }
});

router.put("/trips/:id", requireAuth, async (req, res): Promise<void> => {
  const parsedId = parseTripId(req.params.id);
  const parsedBody = tripUpdateSchema.safeParse(req.body);
  if (!parsedId.success || !parsedBody.success || Object.keys(parsedBody.data).length === 0) {
    res.status(400).json({ status: "invalid_request", message: "Provide a valid trip id and at least one editable field." });
    return;
  }

  try {
    const [trip] = await db
      .update(generatedTripsTable)
      .set({ ...parsedBody.data, updatedAt: new Date() })
      .where(and(eq(generatedTripsTable.id, parsedId.data), eq(generatedTripsTable.ownerId, req.user!.id)))
      .returning();
    if (!trip) {
      res.status(404).json({ status: "not_found", message: "Trip not found." });
      return;
    }
    res.json(publicTrip(trip));
  } catch (error) {
    req.log.error({ err: error }, "Failed to update generated trip");
    res.status(500).json({ status: "database_error", message: "Trip could not be updated." });
  }
});

router.delete("/trips/:id", requireAuth, async (req, res): Promise<void> => {
  const parsedId = parseTripId(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ status: "invalid_request", message: "Trip id must be a UUID." });
    return;
  }

  try {
    const [trip] = await db
      .delete(generatedTripsTable)
      .where(and(eq(generatedTripsTable.id, parsedId.data), eq(generatedTripsTable.ownerId, req.user!.id)))
      .returning();
    if (!trip) {
      res.status(404).json({ status: "not_found", message: "Trip not found." });
      return;
    }
    res.status(204).send();
  } catch (error) {
    req.log.error({ err: error }, "Failed to delete generated trip");
    res.status(500).json({ status: "database_error", message: "Trip could not be deleted." });
  }
});

export default router;