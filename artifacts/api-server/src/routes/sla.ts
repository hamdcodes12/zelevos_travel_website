import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db, slaSettingsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { logAuditAction } from "../services/booking-engine";

const router: IRouter = Router();
const requireSlaAdmin = requireRole(["admin", "operations_manager"]);

/**
 * GET /api/admin/sla-settings
 * List all configurable operational SLA definitions.
 */
router.get("/admin/sla-settings", requireSlaAdmin, async (_req, res) => {
  try {
    const settings = await db.select().from(slaSettingsTable);
    res.json({
      status: "success",
      count: settings.length,
      settings,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to load SLA settings." });
  }
});

/**
 * PUT /api/admin/sla-settings/:settingKey
 * Updates the SLA duration in minutes for an operational threshold (Gap 5).
 */
router.put("/admin/sla-settings/:settingKey", requireSlaAdmin, async (req, res) => {
  const schema = z.object({
    durationMinutes: z.number().int().min(5).max(10080), // 5 mins to 7 days
    displayName: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide a valid duration in minutes (5 to 10080).", errors: parsed.error.issues });
    return;
  }

  const settingKey = typeof req.params.settingKey === "string" ? req.params.settingKey : String(req.params.settingKey || "");
  const { durationMinutes, displayName } = parsed.data;

  try {
    const [existing] = await db
      .select()
      .from(slaSettingsTable)
      .where(eq(slaSettingsTable.settingKey, settingKey))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(slaSettingsTable)
        .set({
          durationMinutes,
          ...(displayName ? { displayName } : {}),
          updatedAt: new Date(),
        })
        .where(eq(slaSettingsTable.settingKey, settingKey))
        .returning();

      await logAuditAction({
        action: "SLA_SETTING_UPDATED",
        resourceType: "sla_setting",
        resourceId: settingKey,
        previousValue: { durationMinutes: existing.durationMinutes },
        newValue: { durationMinutes },
        actorUserId: req.user?.id,
        actorRole: req.user?.role || "admin",
      });

      res.json({ status: "success", setting: updated });
    } else {
      const [created] = await db
        .insert(slaSettingsTable)
        .values({
          settingKey,
          displayName: displayName || settingKey.replace(/_/g, " ").toUpperCase(),
          durationMinutes,
        })
        .returning();

      await logAuditAction({
        action: "SLA_SETTING_CREATED",
        resourceType: "sla_setting",
        resourceId: settingKey,
        newValue: { durationMinutes },
        actorUserId: req.user?.id,
        actorRole: req.user?.role || "admin",
      });

      res.status(201).json({ status: "success", setting: created });
    }
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to update SLA setting." });
  }
});

export default router;
