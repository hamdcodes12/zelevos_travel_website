import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  packagesTable,
  packageDaysTable,
  destinationsTable,
  vendorsTable,
  hotelsTable,
  transfersTable,
  activitiesTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { computeTripConfidenceScore } from "../services/trip-confidence";
import { logAuditAction } from "../services/booking-engine";

const router: IRouter = Router();

// --------------------------------------------------------------------------
// 1. Browse & Search Packages (Public)
// --------------------------------------------------------------------------
router.get("/packages", async (req, res) => {
  try {
    const { destination, theme, minPrice, maxPrice, minDays, maxDays, search, sort } = req.query;

    const conditions = [eq(packagesTable.status, "active")];

    if (destination && typeof destination === "string" && destination !== "all") {
      const [dest] = await db
        .select({ id: destinationsTable.id })
        .from(destinationsTable)
        .where(
          sql`(${destinationsTable.slug} = ${destination.toLowerCase()} OR ${destinationsTable.name} ILIKE ${"%" + destination + "%"})`
        )
        .limit(1);
      if (dest) {
        conditions.push(eq(packagesTable.destinationId, dest.id));
      } else {
        conditions.push(
          sql`(${packagesTable.title} ILIKE ${"%" + destination + "%"} OR ${packagesTable.locations}::text ILIKE ${"%" + destination + "%"})`
        );
      }
    }

    if (theme && typeof theme === "string" && theme !== "all") {
      conditions.push(eq(packagesTable.theme, theme.toLowerCase()));
    }

    if (minPrice && !isNaN(Number(minPrice))) {
      conditions.push(sql`${packagesTable.sellingPrice} >= ${Number(minPrice)}`);
    }

    if (maxPrice && !isNaN(Number(maxPrice))) {
      conditions.push(sql`${packagesTable.sellingPrice} <= ${Number(maxPrice)}`);
    }

    if (minDays && !isNaN(Number(minDays))) {
      conditions.push(sql`${packagesTable.durationDays} >= ${Number(minDays)}`);
    }

    if (maxDays && !isNaN(Number(maxDays))) {
      conditions.push(sql`${packagesTable.durationDays} <= ${Number(maxDays)}`);
    }

    if (search && typeof search === "string") {
      conditions.push(
        sql`(${packagesTable.title} ILIKE ${"%" + search + "%"} OR ${packagesTable.theme} ILIKE ${"%" + search + "%"})`
      );
    }

    let orderByClause: any[] = [desc(packagesTable.featured), desc(packagesTable.createdAt)];
    if (sort === "price_asc") {
      orderByClause = [packagesTable.sellingPrice];
    } else if (sort === "price_desc") {
      orderByClause = [desc(packagesTable.sellingPrice)];
    } else if (sort === "duration_asc") {
      orderByClause = [packagesTable.durationDays];
    } else if (sort === "duration_desc") {
      orderByClause = [desc(packagesTable.durationDays)];
    }

    const packages = await db
      .select({
        package: packagesTable,
        destinationName: destinationsTable.name,
        destinationSlug: destinationsTable.slug,
      })
      .from(packagesTable)
      .leftJoin(destinationsTable, eq(packagesTable.destinationId, destinationsTable.id))
      .where(and(...conditions))
      .orderBy(...orderByClause);

    // Compute dynamic Trip Confidence Score for each package based on assigned vendors
    const results = await Promise.all(
      packages.map(async (row: any) => {
        const pkg = row.package;
        const vendorIds = Array.isArray(pkg.assignedVendorIds) ? (pkg.assignedVendorIds as string[]) : [];

        let vendorsMetrics: any[] = [];
        if (vendorIds.length > 0) {
          vendorsMetrics = await db
            .select({
              acceptanceRate: vendorsTable.acceptanceRate,
              avgResponseMinutes: vendorsTable.avgResponseMinutes,
              cancellationRate: vendorsTable.cancellationRate,
            })
            .from(vendorsTable)
            .where(sql`${vendorsTable.vendorId} IN (${sql.raw(vendorIds.map((id) => `'${id}'`).join(","))})`);
        }

        const confidence = computeTripConfidenceScore(
          vendorsMetrics.length > 0
            ? vendorsMetrics.map((v) => ({
                acceptanceRate: Number(v.acceptanceRate || 95),
                avgResponseMinutes: Number(v.avgResponseMinutes || 30),
                cancellationRate: Number(v.cancellationRate || 1),
              }))
            : { acceptanceRate: 98, avgResponseMinutes: 25, cancellationRate: 1 }
        );

        return {
          ...pkg,
          destinationName: row.destinationName,
          destinationSlug: row.destinationSlug,
          tripConfidenceScore: confidence,
        };
      })
    );

    res.json({ results });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch packages");
    res.status(500).json({ status: "error", message: "Failed to fetch packages." });
  }
});

// --------------------------------------------------------------------------
// 2. Package Detail (Public)
// --------------------------------------------------------------------------
router.get("/packages/:idOrSlug", async (req, res) => {
  const { idOrSlug } = req.params;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const [row] = await db
      .select({
        package: packagesTable,
        destination: destinationsTable,
      })
      .from(packagesTable)
      .leftJoin(destinationsTable, eq(packagesTable.destinationId, destinationsTable.id))
      .where(
        isUuid
          ? eq(packagesTable.id, idOrSlug)
          : sql`(${packagesTable.slug} = ${idOrSlug} OR ${packagesTable.packageId} = ${idOrSlug})`
      )
      .limit(1);

    if (!row) {
      res.status(404).json({ status: "not_found", message: "Package not found." });
      return;
    }

    const pkg = row.package;

    // Fetch day-by-day itinerary
    const days = await db
      .select()
      .from(packageDaysTable)
      .where(eq(packageDaysTable.packageId, pkg.id))
      .orderBy(packageDaysTable.dayNumber);

    // Fetch separate hotels, transfers, activities per Gap 1
    const hotels = await db.select().from(hotelsTable).where(eq(hotelsTable.packageId, pkg.id));
    const transfers = await db.select().from(transfersTable).where(eq(transfersTable.packageId, pkg.id));
    const activities = await db.select().from(activitiesTable).where(eq(activitiesTable.packageId, pkg.id));

    // Dynamic Trip Confidence Score (Step 3)
    const vendorIds = Array.isArray(pkg.assignedVendorIds) ? (pkg.assignedVendorIds as string[]) : [];
    let vendorsMetrics: any[] = [];
    if (vendorIds.length > 0) {
      vendorsMetrics = await db
        .select({
          vendorId: vendorsTable.vendorId,
          businessName: vendorsTable.businessName,
          acceptanceRate: vendorsTable.acceptanceRate,
          avgResponseMinutes: vendorsTable.avgResponseMinutes,
          cancellationRate: vendorsTable.cancellationRate,
        })
        .from(vendorsTable)
        .where(sql`${vendorsTable.vendorId} IN (${sql.raw(vendorIds.map((id) => `'${id}'`).join(","))})`);
    }

    const confidence = computeTripConfidenceScore(
      vendorsMetrics.length > 0
        ? vendorsMetrics.map((v) => ({
            acceptanceRate: Number(v.acceptanceRate || 95),
            avgResponseMinutes: Number(v.avgResponseMinutes || 30),
            cancellationRate: Number(v.cancellationRate || 1),
          }))
        : { acceptanceRate: 98, avgResponseMinutes: 25, cancellationRate: 1 }
    );

    res.json({
      package: {
        ...pkg,
        destination: row.destination,
        days,
        components: {
          hotels,
          transfers,
          activities,
        },
        assignedVendors: vendorsMetrics,
        tripConfidenceScore: confidence,
      },
    });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch package detail");
    res.status(500).json({ status: "error", message: "Failed to fetch package detail." });
  }
});

// --------------------------------------------------------------------------
// 3. Admin Package CRUD & Component Association (Section 8 & Gap 1)
// --------------------------------------------------------------------------
const hotelInputSchema = z.object({
  name: z.string().trim().min(1, "Hotel name is required"),
  starRating: z.coerce.number().default(4),
  roomType: z.string().default("Deluxe Room"),
  mealPlan: z.string().default("CP (Breakfast Included)"),
  address: z.string().default("Main City Area"),
  city: z.string().default("Destination City"),
  checkinTime: z.string().default("14:00"),
  checkoutTime: z.string().default("11:00"),
  amenities: z.array(z.string()).default([]),
  baseCostPerNight: z.coerce.number().int().default(0),
  sellingPricePerNight: z.coerce.number().int().default(0),
});

const transferInputSchema = z.object({
  transferType: z.string().default("private"),
  vehicleType: z.string().default("Sedan"),
  pickupLocation: z.string().trim().min(1, "Pickup location is required"),
  dropLocation: z.string().trim().min(1, "Drop location is required"),
  durationMinutes: z.coerce.number().int().default(60),
  luggageCapacity: z.string().default("2 Large Bags"),
  inclusions: z.array(z.string()).default([]),
  baseCost: z.coerce.number().int().default(0),
  sellingPrice: z.coerce.number().int().default(0),
});

const activityInputSchema = z.object({
  name: z.string().trim().min(1, "Activity name is required"),
  durationHours: z.coerce.number().default(2.0),
  difficultyLevel: z.string().default("Easy"),
  ageSuitability: z.string().default("All ages"),
  meetingPoint: z.string().trim().min(1, "Meeting point is required"),
  inclusions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  scheduleNotes: z.string().optional(),
  baseCost: z.coerce.number().int().default(0),
  sellingPrice: z.coerce.number().int().default(0),
});

const dayInputSchema = z.object({
  dayNumber: z.number().int(),
  title: z.string().trim().min(1, "Day title is required"),
  description: z.string().trim().min(1, "Day description is required"),
  timings: z.string().optional(),
  activitiesDescription: z.string().optional(),
  mealsIncluded: z.string().optional(),
  hotelDetails: z.string().optional(),
});

const packageCreateSchema = z.object({
  packageId: z.string().trim().min(1, "Package ID is required"),
  title: z.string().trim().min(1, "Title is required"),
  slug: z.string().trim().min(1, "Slug is required"),
  destinationId: z.string().uuid("Valid destination ID required"),
  locations: z.array(z.string()).default([]),
  durationDays: z.coerce.number().int().min(1),
  durationNights: z.coerce.number().int().min(0),
  theme: z.string().trim().min(1),
  travellerSuitability: z.string().optional(),
  baseCost: z.coerce.number().int().min(0),
  sellingPrice: z.coerce.number().int().min(1),
  markupType: z.enum(["fixed", "percentage"]).default("fixed"),
  markupValue: z.coerce.number().default(0),
  serviceFee: z.coerce.number().int().default(0),
  inventory: z.coerce.number().int().default(10),
  inclusions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  policies: z.record(z.string(), z.any()).default({}),
  media: z.record(z.string(), z.any()).default({}),
  status: z.enum(["draft", "active", "paused", "archived"]).default("active"),
  assignedVendorIds: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  isMembersOnly: z.boolean().default(false),
  offerExpiresAt: z.string().nullable().optional(),
  days: z.array(dayInputSchema).optional(),
  hotels: z.array(hotelInputSchema).optional(),
  transfers: z.array(transferInputSchema).optional(),
  activities: z.array(activityInputSchema).optional(),
});

// Admin List All Packages (Across draft, active, paused, archived)
router.get("/admin/packages", requireRole(["admin"]), async (req, res) => {
  try {
    const statusQuery = typeof req.query.status === "string" ? req.query.status.toLowerCase() : "all";

    const conditions: any[] = [];
    if (statusQuery && statusQuery !== "all") {
      conditions.push(eq(packagesTable.status, statusQuery));
    }

    const rows = await db
      .select({
        package: packagesTable,
        destinationName: destinationsTable.name,
        destinationSlug: destinationsTable.slug,
      })
      .from(packagesTable)
      .leftJoin(destinationsTable, eq(packagesTable.destinationId, destinationsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(packagesTable.createdAt));

    const results = await Promise.all(
      rows.map(async (row: any) => {
        const pkg = row.package;

        // Fetch component counts for backoffice display
        const [daysCount, hotelsCount, transfersCount, activitiesCount] = await Promise.all([
          db.select({ count: sql<number>`count(*)` }).from(packageDaysTable).where(eq(packageDaysTable.packageId, pkg.id)),
          db.select({ count: sql<number>`count(*)` }).from(hotelsTable).where(eq(hotelsTable.packageId, pkg.id)),
          db.select({ count: sql<number>`count(*)` }).from(transfersTable).where(eq(transfersTable.packageId, pkg.id)),
          db.select({ count: sql<number>`count(*)` }).from(activitiesTable).where(eq(activitiesTable.packageId, pkg.id)),
        ]);

        const vendorIds = Array.isArray(pkg.assignedVendorIds) ? (pkg.assignedVendorIds as string[]) : [];
        let vendorsMetrics: any[] = [];
        if (vendorIds.length > 0) {
          vendorsMetrics = await db
            .select({
              acceptanceRate: vendorsTable.acceptanceRate,
              avgResponseMinutes: vendorsTable.avgResponseMinutes,
              cancellationRate: vendorsTable.cancellationRate,
            })
            .from(vendorsTable)
            .where(sql`${vendorsTable.vendorId} IN (${sql.raw(vendorIds.map((id) => `'${id}'`).join(","))})`);
        }

        const confidence = computeTripConfidenceScore(
          vendorsMetrics.length > 0
            ? vendorsMetrics.map((v) => ({
                acceptanceRate: Number(v.acceptanceRate || 95),
                avgResponseMinutes: Number(v.avgResponseMinutes || 30),
                cancellationRate: Number(v.cancellationRate || 1),
              }))
            : { acceptanceRate: 98, avgResponseMinutes: 25, cancellationRate: 1 }
        );

        return {
          ...pkg,
          destinationName: row.destinationName,
          destinationSlug: row.destinationSlug,
          daysCount: Number(daysCount[0]?.count || 0),
          hotelsCount: Number(hotelsCount[0]?.count || 0),
          transfersCount: Number(transfersCount[0]?.count || 0),
          activitiesCount: Number(activitiesCount[0]?.count || 0),
          tripConfidenceScore: confidence,
        };
      })
    );

    res.json({ results });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch admin packages");
    res.status(500).json({ status: "error", message: "Failed to fetch admin packages." });
  }
});

router.post("/admin/packages", requireRole(["admin"]), async (req, res) => {
  const parsed = packageCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", errors: parsed.error.issues });
    return;
  }

  const { days, hotels, transfers, activities, ...pkgData } = parsed.data;

  try {
    const offerExpiresAtDate = pkgData.offerExpiresAt ? new Date(pkgData.offerExpiresAt) : null;
    const [created] = await db
      .insert(packagesTable)
      .values({
        ...pkgData,
        offerExpiresAt: offerExpiresAtDate,
        markupValue: String(pkgData.markupValue),
      })
      .returning();

    if (days && days.length > 0) {
      for (const d of days) {
        await db.insert(packageDaysTable).values({
          packageId: created.id,
          ...d,
        });
      }
    }

    if (hotels && hotels.length > 0) {
      for (const h of hotels) {
        await db.insert(hotelsTable).values({
          packageId: created.id,
          ...h,
          starRating: String(h.starRating),
        });
      }
    }

    if (transfers && transfers.length > 0) {
      for (const t of transfers) {
        await db.insert(transfersTable).values({
          packageId: created.id,
          ...t,
        });
      }
    }

    if (activities && activities.length > 0) {
      for (const a of activities) {
        await db.insert(activitiesTable).values({
          packageId: created.id,
          ...a,
          durationHours: String(a.durationHours),
        });
      }
    }

    await logAuditAction({
      action: "PACKAGE_CREATED",
      resourceType: "package",
      resourceId: created.id,
      newValue: { packageId: created.packageId, title: created.title, sellingPrice: created.sellingPrice, status: created.status },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.status(201).json({
      package: created,
      days: days || [],
      hotels: hotels || [],
      transfers: transfers || [],
      activities: activities || [],
    });
  } catch (error: any) {
    req.log?.error({ err: error }, "Failed to create package");
    res.status(500).json({ status: "error", message: error.message || "Failed to create package." });
  }
});

router.put("/admin/packages/:id", requireRole(["admin"]), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const parsed = packageCreateSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", errors: parsed.error.issues });
    return;
  }

  try {
    const [existing] = await db.select().from(packagesTable).where(eq(packagesTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ status: "not_found", message: "Package not found." });
      return;
    }

    const { days, hotels, transfers, activities, ...updateData } = parsed.data;

    const valuesToUpdate: any = { ...updateData, updatedAt: new Date() };
    if (updateData.offerExpiresAt !== undefined) {
      valuesToUpdate.offerExpiresAt = updateData.offerExpiresAt ? new Date(updateData.offerExpiresAt) : null;
    }
    if (updateData.markupValue !== undefined) {
      valuesToUpdate.markupValue = String(updateData.markupValue);
    }

    const [updated] = await db
      .update(packagesTable)
      .set(valuesToUpdate)
      .where(eq(packagesTable.id, id))
      .returning();

    if (days !== undefined) {
      await db.delete(packageDaysTable).where(eq(packageDaysTable.packageId, id));
      for (const d of days) {
        await db.insert(packageDaysTable).values({
          packageId: id,
          ...d,
        });
      }
    }

    if (hotels !== undefined) {
      await db.delete(hotelsTable).where(eq(hotelsTable.packageId, id));
      for (const h of hotels) {
        await db.insert(hotelsTable).values({
          packageId: id,
          ...h,
          starRating: String(h.starRating),
        });
      }
    }

    if (transfers !== undefined) {
      await db.delete(transfersTable).where(eq(transfersTable.packageId, id));
      for (const t of transfers) {
        await db.insert(transfersTable).values({
          packageId: id,
          ...t,
        });
      }
    }

    if (activities !== undefined) {
      await db.delete(activitiesTable).where(eq(activitiesTable.packageId, id));
      for (const a of activities) {
        await db.insert(activitiesTable).values({
          packageId: id,
          ...a,
          durationHours: String(a.durationHours),
        });
      }
    }

    await logAuditAction({
      action: "PACKAGE_UPDATED",
      resourceType: "package",
      resourceId: id,
      previousValue: { title: existing.title, sellingPrice: existing.sellingPrice, status: existing.status },
      newValue: { title: updated.title, sellingPrice: updated.sellingPrice, status: updated.status },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({ package: updated });
  } catch (error: any) {
    req.log?.error({ err: error }, "Failed to update package");
    res.status(500).json({ status: "error", message: error.message || "Failed to update package." });
  }
});

// Explicit Status Lifecycle Endpoint (DRAFT -> ACTIVE -> PAUSED -> ARCHIVED)
router.patch("/admin/packages/:id/status", requireRole(["admin"]), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const statusSchema = z.object({
    status: z.enum(["draft", "active", "paused", "archived"]),
  });

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Invalid status value. Must be draft, active, paused, or archived." });
    return;
  }

  const newStatus = parsed.data.status;

  try {
    const [existing] = await db.select().from(packagesTable).where(eq(packagesTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ status: "not_found", message: "Package not found." });
      return;
    }

    const currentStatus = existing.status;

    // Rule: Archived packages cannot be transitioned to active/paused/draft
    if (currentStatus === "archived") {
      res.status(400).json({
        status: "invalid_transition",
        message: "Archived packages cannot be transitioned to another status.",
      });
      return;
    }

    const [updated] = await db
      .update(packagesTable)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(packagesTable.id, id))
      .returning();

    await logAuditAction({
      action: "PACKAGE_STATUS_CHANGED",
      resourceType: "package",
      resourceId: id,
      previousValue: { status: currentStatus },
      newValue: { status: newStatus },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({ package: updated, message: `Package status transitioned from ${currentStatus} to ${newStatus}.` });
  } catch (error: any) {
    req.log?.error({ err: error }, "Failed to transition package status");
    res.status(500).json({ status: "error", message: error.message || "Failed to transition status." });
  }
});

router.post("/admin/packages/:id/expire", requireRole(["admin"]), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  try {
    const [existing] = await db.select().from(packagesTable).where(eq(packagesTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ status: "not_found", message: "Package not found." });
      return;
    }

    const pastDate = new Date(Date.now() - 60000);
    const [updated] = await db
      .update(packagesTable)
      .set({
        offerExpiresAt: pastDate,
        status: "paused",
        updatedAt: new Date(),
      })
      .where(eq(packagesTable.id, id))
      .returning();

    await logAuditAction({
      action: "PACKAGE_OFFER_EXPIRED",
      resourceType: "package",
      resourceId: id,
      previousValue: { status: existing.status, offerExpiresAt: existing.offerExpiresAt },
      newValue: { status: "paused", offerExpiresAt: pastDate },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({
      status: "success",
      message: `Offer for "${existing.title}" has been expired and paused.`,
      package: updated,
    });
  } catch (error: any) {
    req.log?.error({ err: error }, "Failed to expire package offer");
    res.status(500).json({ status: "error", message: error.message || "Failed to expire package offer." });
  }
});

router.delete("/admin/packages/:id", requireRole(["admin"]), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const isHardDelete = req.query.hard === "true" || req.query.purge === "true";
  try {
    const [existing] = await db.select().from(packagesTable).where(eq(packagesTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ status: "not_found", message: "Package not found." });
      return;
    }

    if (isHardDelete) {
      await db.delete(packagesTable).where(eq(packagesTable.id, id));
      await logAuditAction({
        action: "PACKAGE_DELETED",
        resourceType: "package",
        resourceId: id,
        previousValue: { packageId: existing.packageId, title: existing.title },
        actorAdminId: (req as any).admin?.id,
        actorRole: "admin",
      });
      res.json({ status: "success", message: `Package ${existing.packageId} permanently deleted.` });
      return;
    }

    const [updated] = await db
      .update(packagesTable)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(packagesTable.id, id))
      .returning();

    await logAuditAction({
      action: "PACKAGE_ARCHIVED",
      resourceType: "package",
      resourceId: id,
      previousValue: { status: existing.status },
      newValue: { status: "archived" },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({ status: "success", message: "Package archived successfully.", package: updated });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to archive package." });
  }
});

export default router;
