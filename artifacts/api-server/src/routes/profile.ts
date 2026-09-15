import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { db, travellerProfilesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

const profileFields = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  homeCity: z.string().trim().min(2).max(80).optional(),
  avatarInitials: z.string().trim().min(1).max(4).optional(),
  budgetStyle: z.string().trim().min(1).max(80).optional(),
  hotelStyle: z.string().trim().min(1).max(80).optional(),
  travelStyle: z.string().trim().min(1).max(80).optional(),
  foodPreferences: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  activityPreferences: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  savedDestinations: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  crowdTolerance: z.string().trim().min(1).max(80).optional(),
});

const defaults = (userId: string) => ({
  userId,
  displayName: "Wayora traveller",
  homeCity: "Pune",
  avatarInitials: "WT",
  budgetStyle: "Value-conscious",
  hotelStyle: "Boutique stays",
  travelStyle: "Slow and curious",
  foodPreferences: ["Local food"],
  activityPreferences: ["Nature", "Culture"],
  savedDestinations: ["Kashmir", "Kerala"],
  crowdTolerance: "Prefer quieter places",
});

async function getOrCreateProfile(userId: string) {
  const [existing] = await db.select().from(travellerProfilesTable).where(eq(travellerProfilesTable.userId, userId));
  if (existing) return existing;
  const [created] = await db.insert(travellerProfilesTable).values(defaults(userId)).returning();
  return created;
}

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  try {
    res.json({ profile: await getOrCreateProfile(req.user!.id) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load traveller profile");
    res.status(500).json({ status: "database_error", message: "Traveller profile could not be loaded." });
  }
});

router.put("/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = profileFields.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ status: "invalid_request", message: "Provide at least one valid profile field." });
    return;
  }
  try {
    await getOrCreateProfile(req.user!.id);
    const [profile] = await db.update(travellerProfilesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(travellerProfilesTable.userId, req.user!.id))
      .returning();
    res.json({ profile });
  } catch (error) {
    req.log.error({ err: error }, "Failed to update traveller profile");
    res.status(500).json({ status: "database_error", message: "Traveller profile could not be updated." });
  }
});

router.get("/preferences", requireAuth, async (req, res): Promise<void> => {
  try {
    const profile = await getOrCreateProfile(req.user!.id);
    res.json({
      preferences: {
        budgetStyle: profile.budgetStyle,
        hotelStyle: profile.hotelStyle,
        travelStyle: profile.travelStyle,
        foodPreferences: profile.foodPreferences,
        activityPreferences: profile.activityPreferences,
        savedDestinations: profile.savedDestinations,
        crowdTolerance: profile.crowdTolerance,
      },
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load traveller preferences");
    res.status(500).json({ status: "database_error", message: "Traveller preferences could not be loaded." });
  }
});

router.put("/preferences", requireAuth, async (req, res): Promise<void> => {
  const parsed = profileFields.pick({
    budgetStyle: true,
    hotelStyle: true,
    travelStyle: true,
    foodPreferences: true,
    activityPreferences: true,
    savedDestinations: true,
    crowdTolerance: true,
  }).safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ status: "invalid_request", message: "Provide at least one valid preference." });
    return;
  }
  try {
    await getOrCreateProfile(req.user!.id);
    const [profile] = await db.update(travellerProfilesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(travellerProfilesTable.userId, req.user!.id))
      .returning();
    res.json({ preferences: profile });
  } catch (error) {
    req.log.error({ err: error }, "Failed to update traveller preferences");
    res.status(500).json({ status: "database_error", message: "Traveller preferences could not be updated." });
  }
});

export default router;