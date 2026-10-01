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
import {
  createPartnerSession,
  destroyPartnerSession,
  partnerFromRequest,
  hashPassword,
  verifyPassword,
  adminFromRequest,
} from "../lib/auth";
import { sendVerificationOtpEmail } from "../services/email-service";

const router: IRouter = Router();

// In-memory OTP storage for partner password set/reset
const partnerOtps = new Map<string, { otpHash: string; expiresAt: number; attempts: number }>();

/**
 * Helper to identify partner by session cookie or logged-in user
 * Note: x-partner-id header trust is completely eliminated (ZEL-03)
 */
async function getAuthenticatedPartner(req: any) {
  // 1. Check verified partner session cookie
  const sessionPartner = await partnerFromRequest(req);
  if (sessionPartner) return sessionPartner;

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
      password: z.string().min(8, "Password must be at least 8 characters long").optional(),
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

    const passwordHash = parsed.data.password ? hashPassword(parsed.data.password) : null;

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
        passwordHash,
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

    // Set server-verified partner session
    await createPartnerSession(partner.id, res);

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
    password: z.string().min(1, "Password is required."),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: "invalid_request",
      message: "Password is required to sign in. If you have not set a password yet, please use the Set Password option.",
      errors: parsed.error.issues,
    });
    return;
  }

  const { identifier, password } = parsed.data;

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
      res.status(401).json({ status: "unauthorized", message: "Invalid email, referral code, or password." });
      return;
    }

    if (partner.status === "suspended") {
      res.status(403).json({ status: "suspended", message: "This partner account has been suspended. Please contact Zelevos support." });
      return;
    }

    if (!partner.passwordHash || !verifyPassword(password, partner.passwordHash)) {
      res.status(401).json({ status: "unauthorized", message: "Invalid email, referral code, or password." });
      return;
    }

    // Set server-verified partner session
    await createPartnerSession(partner.id, res);

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
 * POST /api/partners/password/forgot
 * Request OTP for partner password set / reset
 */
router.post("/partners/password/forgot", async (req, res) => {
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
      // Prevent enumeration
      res.json({ status: "success", message: "If an account exists with that identifier, a verification code has been sent." });
      return;
    }

    if (partner.status === "suspended") {
      res.status(403).json({ status: "suspended", message: "This partner account has been suspended. Please contact Zelevos support." });
      return;
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    partnerOtps.set(partner.id, {
      otpHash,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });

    const emailResult = await sendVerificationOtpEmail(partner.email, otp, partner.contactName);
    if (!emailResult.success && process.env.NODE_ENV === "production") {
      res.status(502).json({
        status: "email_delivery_failed",
        message: "We could not send the verification email. Please try again shortly.",
      });
      return;
    }

    res.json({
      status: "success",
      message: "A verification code has been sent to your registered email.",
      email: partner.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
      ...(emailResult.debugOtp ? { debugOtp: emailResult.debugOtp } : {}),
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to send reset code." });
  }
});

/**
 * POST /api/partners/password/reset
 * Verify OTP and set new password
 */
router.post("/partners/password/reset", async (req, res) => {
  const schema = z.object({
    identifier: z.string().trim().min(2),
    otp: z.string().trim().length(6, "6-digit OTP code required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters long"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: "invalid_request",
      message: "Provide identifier, 6-digit OTP, and new password of at least 8 characters.",
      errors: parsed.error.issues,
    });
    return;
  }

  const { identifier, otp, newPassword } = parsed.data;

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
      res.status(400).json({ status: "invalid_request", message: "Invalid or expired verification code." });
      return;
    }

    const record = partnerOtps.get(partner.id);
    if (!record || Date.now() > record.expiresAt) {
      partnerOtps.delete(partner.id);
      res.status(400).json({ status: "invalid_request", message: "Verification code has expired. Please request a new one." });
      return;
    }

    record.attempts += 1;
    if (record.attempts > 5) {
      partnerOtps.delete(partner.id);
      res.status(429).json({ status: "too_many_attempts", message: "Too many incorrect attempts. Please request a new verification code." });
      return;
    }

    const inputHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(inputHash, "hex"), Buffer.from(record.otpHash, "hex"))) {
      res.status(400).json({ status: "invalid_otp", message: "Incorrect verification code." });
      return;
    }

    partnerOtps.delete(partner.id);
    const newHash = hashPassword(newPassword);
    await db.update(partnersTable).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(partnersTable.id, partner.id));

    res.json({ status: "success", message: "Password updated successfully. You can now log in." });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to reset password." });
  }
});

/**
 * POST /api/partners/logout
 */
router.post("/partners/logout", async (req, res) => {
  await destroyPartnerSession(req, res);
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
router.get("/admin/partners/ledger", requireRole(["admin", "finance"]), async (_req, res) => {
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

router.get("/partners/ledger", async (req, res) => {
  try {
    // 1. Allow internal staff (admin or finance)
    const adminUser = await adminFromRequest(req);
    if (adminUser || (req as any).user?.role === "admin" || (req as any).user?.role === "finance") {
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
      return;
    }

    // 2. Allow authenticated partner scoped strictly to their own partner ID (SQL filter)
    const partner = await getAuthenticatedPartner(req);
    if (!partner) {
      res.status(401).json({ status: "unauthorized", message: "Please log in to access the partner commission ledger." });
      return;
    }

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
      .where(eq(commissionsTable.partnerId, partner.id))
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

