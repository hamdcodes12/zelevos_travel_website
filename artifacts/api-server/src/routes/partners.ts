import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq, desc, or } from "drizzle-orm";
import {
  db,
  partnersTable,
  commissionsTable,
  usersTable,
  customTripRequestsTable,
  bookingsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { requireRole, requirePartnerScope } from "../middlewares/rbac";
import { logAuditAction } from "../services/booking-engine";

const router: IRouter = Router();

/**
 * Helper to identify partner by session cookie, header, or logged-in user
 */
async function getAuthenticatedPartner(req: any) {
  // 1. Check partner session cookie or header
  const partnerSessionId = req.cookies?.zelevos_partner_session || req.headers?.["x-partner-id"];
  if (partnerSessionId) {
    const [p] = await db
      .select()
      .from(partnersTable)
      .where(or(eq(partnersTable.id, partnerSessionId), eq(partnersTable.partnerId, partnerSessionId)))
      .limit(1);
    if (p) return p;
  }

  // 2. Check standard auth user email
  if (req.user?.email) {
    const [p] = await db
      .select()
      .from(partnersTable)
      .where(eq(partnersTable.email, req.user.email))
      .limit(1);
    if (p) return p;
  }

  return null;
}

/**
 * POST /api/partners/register
 * Public registration endpoint for travel agents and creators.
 */
router.post("/partners/register", async (req, res) => {
  const schema = z
    .object({
      agencyName: z.string().trim().min(2, "Agency or Company name required"),
      contactName: z.string().trim().min(2, "Contact person name required").optional(),
      contactPerson: z.string().trim().min(2).optional(),
      email: z.string().trim().email("Valid email required"),
      phone: z.string().trim().min(8, "Valid phone number required"),
      bankDetails: z.record(z.string(), z.unknown()).optional(),
    })
    .refine((data) => Boolean(data.contactName || data.contactPerson), {
      message: "Contact person name required",
      path: ["contactName"],
    });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide valid partner registration details.", errors: parsed.error.issues });
    return;
  }

  const { agencyName, email, phone, bankDetails } = parsed.data;
  const contactName = (parsed.data.contactName || parsed.data.contactPerson || "").trim();

  try {
    const [existing] = await db
      .select()
      .from(partnersTable)
      .where(eq(partnersTable.email, email))
      .limit(1);

    if (existing) {
      res.status(409).json({ status: "conflict", message: "A partner account with this email already exists." });
      return;
    }

    const partnerId = `PRT-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
    const sanitizedAgency = agencyName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
    const referralCode = `ZEL${sanitizedAgency}${Math.floor(10 + Math.random() * 90)}`;

    const [partner] = await db
      .insert(partnersTable)
      .values({
        partnerId,
        agencyName,
        contactName,
        email,
        phone,
        referralCode,
        commissionRatePercent: "5.0",
        status: "approved", // auto-approve for seamless onboarding demo
        bankDetails: bankDetails || {},
      })
      .returning();

    await logAuditAction({
      action: "PARTNER_REGISTERED",
      resourceType: "partner",
      resourceId: partner.id,
      actorName: contactName,
      actorRole: "partner",
      newValue: { agencyName, email, referralCode },
    });

    // Auto set partner session cookie
    res.cookie("zelevos_partner_session", partner.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      status: "success",
      partner,
      referralLink: `https://zelevos.com/?ref=${partner.referralCode}`,
      message: "Partner registered successfully. Your referral link is now active.",
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to register partner." });
  }
});

/**
 * POST /api/partners/login
 * Dedicated login for travel agents & partners via email or referral code.
 */
router.post("/partners/login", async (req, res) => {
  const schema = z.object({
    identifier: z.string().trim().min(2, "Enter your registered email or referral code."),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Enter your registered email or referral code." });
    return;
  }

  const { identifier } = parsed.data;

  try {
    const [partner] = await db
      .select()
      .from(partnersTable)
      .where(
        or(
          eq(partnersTable.email, identifier.toLowerCase()),
          eq(partnersTable.referralCode, identifier.toUpperCase()),
          eq(partnersTable.partnerId, identifier.toUpperCase())
        )
      )
      .limit(1);

    if (!partner) {
      res.status(404).json({ status: "not_found", message: "No partner account found with this email or referral code." });
      return;
    }

    if (partner.status === "suspended") {
      res.status(403).json({ status: "suspended", message: "This partner account has been suspended. Please contact Zelevos support." });
      return;
    }

    // Set partner session cookie
    res.cookie("zelevos_partner_session", partner.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const commissions = await db
      .select()
      .from(commissionsTable)
      .where(eq(commissionsTable.partnerId, partner.id))
      .orderBy(desc(commissionsTable.createdAt));

    res.json({
      status: "success",
      partner: {
        ...partner,
        referralLink: `https://zelevos.com/?ref=${partner.referralCode}`,
      },
      commissions,
      message: `Welcome back, ${partner.agencyName}!`,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Partner login failed." });
  }
});

/**
 * POST /api/partners/logout
 */
router.post("/partners/logout", async (_req, res) => {
  res.clearCookie("zelevos_partner_session");
  res.json({ status: "success", message: "Partner logged out successfully." });
});

/**
 * GET /api/partners/dashboard
 * Authenticated dashboard for the partner: metrics, referral link, commission ledger.
 */
router.get("/partners/dashboard", async (req, res) => {
  try {
    const partner = await getAuthenticatedPartner(req);

    if (!partner) {
      res.status(401).json({ status: "unauthorized", message: "Please log in to your partner account." });
      return;
    }

    const commissions = await db
      .select()
      .from(commissionsTable)
      .where(eq(commissionsTable.partnerId, partner.id))
      .orderBy(desc(commissionsTable.createdAt));

    res.json({
      status: "success",
      partner: {
        ...partner,
        referralLink: `https://zelevos.com/?ref=${partner.referralCode}`,
      },
      commissions,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to load partner dashboard." });
  }
});

/**
 * POST /api/partners/leads
 * Partner submits a custom trip request on behalf of a client.
 */
router.post("/partners/leads", async (req, res) => {
  const schema = z.object({
    customerName: z.string().trim().min(2),
    customerEmail: z.string().trim().email(),
    customerPhone: z.string().trim().min(8),
    destinations: z.array(z.string()).min(1),
    startDate: z.string().optional(),
    durationDays: z.number().int().positive().optional(),
    travellersCount: z.number().int().positive().default(2),
    budgetPerPerson: z.number().int().positive().optional(),
    specialRequests: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Provide valid client lead details.", errors: parsed.error.issues });
    return;
  }

  const partner = await getAuthenticatedPartner(req);
  if (!partner) {
    res.status(403).json({ status: "forbidden", message: "Only registered partners can submit client leads." });
    return;
  }

  const leadNumber = `LEAD-PRT-${Date.now().toString().slice(-4)}`;

  const [lead] = await db
    .insert(customTripRequestsTable)
    .values({
      leadNumber,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      destinations: parsed.data.destinations,
      startDate: parsed.data.startDate,
      durationDays: parsed.data.durationDays,
      travellersCount: parsed.data.travellersCount,
      budgetPerPerson: parsed.data.budgetPerPerson,
      totalBudget: parsed.data.budgetPerPerson ? parsed.data.budgetPerPerson * parsed.data.travellersCount : undefined,
      specialRequests: parsed.data.specialRequests,
      status: "NEW",
    })
    .returning();

  await logAuditAction({
    action: "PARTNER_LEAD_SUBMITTED",
    resourceType: "custom_trip_request",
    resourceId: lead.id,
    actorUserId: (req as any).user?.id || partner.userId || undefined,
    actorName: partner.agencyName,
    actorRole: "partner",
    metadata: { partnerId: partner.id, partnerCode: partner.referralCode },
  });

  res.status(201).json({
    status: "success",
    lead,
    message: "Client lead submitted to Zelevos operations. You will earn commission when this booking completes.",
  });
});

/**
 * GET /api/admin/partners
 * Admin list and management of partners and commission rates.
 */
router.get("/admin/partners", requireRole(["admin", "finance"]), async (_req, res) => {
  try {
    const partners = await db.select().from(partnersTable).orderBy(desc(partnersTable.createdAt));
    res.json({
      status: "success",
      count: partners.length,
      partners,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to load partners." });
  }
});

/**
 * GET /api/partners/ledger
 * Real-time partner commission ledger joined with booking and partner details (Section 13 & 23).
 */
router.get(["/partners/ledger", "/admin/partners/ledger"], async (_req, res) => {
  try {
    const rawCommissions = await db
      .select({
        id: commissionsTable.id,
        partnerId: commissionsTable.partnerId,
        bookingId: commissionsTable.bookingId,
        bookingAmount: commissionsTable.bookingAmount,
        commissionPercent: commissionsTable.commissionPercent,
        commissionAmount: commissionsTable.commissionAmount,
        status: commissionsTable.status,
        createdAt: commissionsTable.createdAt,
        agencyName: partnersTable.agencyName,
        contactName: partnersTable.contactName,
        referralCode: partnersTable.referralCode,
        bookingRef: bookingsTable.bookingId,
      })
      .from(commissionsTable)
      .leftJoin(partnersTable, eq(commissionsTable.partnerId, partnersTable.id))
      .leftJoin(bookingsTable, eq(commissionsTable.bookingId, bookingsTable.id))
      .orderBy(desc(commissionsTable.createdAt));

    res.json({
      status: "success",
      count: rawCommissions.length,
      commissions: rawCommissions,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to load commission ledger.",
      commissions: [],
    });
  }
});

/**
 * POST /api/admin/partners/:id/approve
 * Admin approval workflow for registered partner accounts.
 */
router.post(["/admin/partners/:id/approve", "/partners/:id/approve"], requireRole(["admin", "finance"]), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const commissionRate = req.body?.commissionRate || req.body?.commissionRatePercent;
  try {
    const updateValues: Record<string, any> = { status: "approved", updatedAt: new Date() };
    if (commissionRate !== undefined && commissionRate !== null) {
      updateValues.commissionRatePercent = String(commissionRate);
    }

    const [partner] = await db
      .update(partnersTable)
      .set(updateValues)
      .where(eq(partnersTable.id, id))
      .returning();

    if (!partner) {
      res.status(404).json({ status: "not_found", message: "Partner not found." });
      return;
    }

    await logAuditAction({
      action: "PARTNER_APPROVED",
      resourceType: "partner",
      resourceId: partner.id,
      actorUserId: req.user?.id,
      actorRole: req.user?.role || "admin",
      newValue: { status: "approved" },
    });

    res.json({
      status: "success",
      partner,
      message: `Partner ${partner.agencyName} approved successfully.`,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to approve partner." });
  }
});

export default router;

