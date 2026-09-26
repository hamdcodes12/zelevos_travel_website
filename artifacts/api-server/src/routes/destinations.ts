import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, destinationsTable, packagesTable, vendorsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { computeTripConfidenceScore } from "../services/trip-confidence";
import { logAuditAction } from "../services/booking-engine";

const router: IRouter = Router();

// --------------------------------------------------------------------------
// 1. List Destinations (Public)
// --------------------------------------------------------------------------
router.get("/destinations", async (req, res) => {
  try {
    const destinations = await db
      .select()
      .from(destinationsTable)
      .where(eq(destinationsTable.status, "active"))
      .orderBy(destinationsTable.name);

    // Attach package count to each destination
    const results = await Promise.all(
      destinations.map(async (d: any) => {
        const pkgs = await db
          .select({ count: sql<number>`count(*)` })
          .from(packagesTable)
          .where(and(eq(packagesTable.destinationId, d.id), eq(packagesTable.status, "active")));
        return {
          ...d,
          packageCount: Number(pkgs[0]?.count || 0),
        };
      })
    );

    res.json({ results });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch destinations");
    res.status(500).json({ status: "error", message: "Failed to fetch destinations." });
  }
});

// --------------------------------------------------------------------------
// 2. Destination Detail (Section 7.2: overview, best period, packages, highlights, FAQs)
// --------------------------------------------------------------------------
router.get("/destinations/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const [destination] = await db
      .select()
      .from(destinationsTable)
      .where(eq(destinationsTable.slug, slug.toLowerCase()))
      .limit(1);

    if (!destination) {
      res.status(404).json({ status: "not_found", message: "Destination not found." });
      return;
    }

    const packages = await db
      .select()
      .from(packagesTable)
      .where(and(eq(packagesTable.destinationId, destination.id), eq(packagesTable.status, "active")))
      .orderBy(desc(packagesTable.featured), desc(packagesTable.sellingPrice));

    // Calculate Trip Confidence Score for each package
    const curatedPackages = await Promise.all(
      packages.map(async (pkg: any) => {
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
          tripConfidenceScore: confidence,
        };
      })
    );

    res.json({
      destination: {
        ...destination,
        packages: curatedPackages,
      },
    });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch destination detail");
    res.status(500).json({ status: "error", message: "Failed to fetch destination detail." });
  }
});

// --------------------------------------------------------------------------
// 3. Admin Destination CRUD
// --------------------------------------------------------------------------
const destinationSchema = z.object({
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  country: z.string().default("India"),
  state: z.string().trim().min(1),
  city: z.string().optional(),
  overview: z.string().trim().min(1),
  bestTravelPeriod: z.string().trim().min(1),
  heroImage: z.string().trim().min(1),
  gallery: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
  status: z.enum(["active", "draft", "archived"]).default("active"),
});

// Admin list all destinations (including draft/archived)
router.get("/admin/destinations", requireRole(["admin"]), async (req, res) => {
  try {
    const destinations = await db
      .select()
      .from(destinationsTable)
      .orderBy(destinationsTable.name);

    const results = await Promise.all(
      destinations.map(async (d: any) => {
        const pkgs = await db
          .select({ count: sql<number>`count(*)` })
          .from(packagesTable)
          .where(eq(packagesTable.destinationId, d.id));
        return {
          ...d,
          packageCount: Number(pkgs[0]?.count || 0),
        };
      })
    );

    res.json({ results });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch admin destinations");
    res.status(500).json({ status: "error", message: "Failed to fetch admin destinations." });
  }
});

router.post("/admin/destinations", requireRole(["admin"]), async (req, res) => {
  const parsed = destinationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", errors: parsed.error.issues });
    return;
  }

  try {
    const [created] = await db.insert(destinationsTable).values(parsed.data).returning();

    await logAuditAction({
      action: "DESTINATION_CREATED",
      resourceType: "destination",
      resourceId: created.id,
      newValue: { slug: created.slug, name: created.name },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.status(201).json({ destination: created });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to create destination." });
  }
});

router.put("/admin/destinations/:id", requireRole(["admin"]), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const parsed = destinationSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", errors: parsed.error.issues });
    return;
  }

  try {
    const [updated] = await db
      .update(destinationsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(destinationsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ status: "not_found", message: "Destination not found." });
      return;
    }

    await logAuditAction({
      action: "DESTINATION_UPDATED",
      resourceType: "destination",
      resourceId: id,
      newValue: { slug: updated.slug, name: updated.name, status: updated.status },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({ destination: updated });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to update destination." });
  }
});

router.delete("/admin/destinations/:id", requireRole(["admin"]), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  try {
    const [existing] = await db.select().from(destinationsTable).where(eq(destinationsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ status: "not_found", message: "Destination not found." });
      return;
    }

    const [updated] = await db
      .update(destinationsTable)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(destinationsTable.id, id))
      .returning();

    await logAuditAction({
      action: "DESTINATION_ARCHIVED",
      resourceType: "destination",
      resourceId: id,
      previousValue: { status: existing.status },
      newValue: { status: "archived" },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({ status: "success", message: "Destination archived successfully.", destination: updated });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to archive destination." });
  }
});

export default router;
