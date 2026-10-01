import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq, desc } from "drizzle-orm";
import {
  db,
  bookingsTable,
  bookingServicesTable,
  refundsTable,
  paymentsTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { logAuditAction } from "../services/booking-engine";
import { dispatchMultiChannelNotification } from "../services/email-service";

const router: IRouter = Router();
const requireFinance = requireRole(["admin", "finance"]);

/**
 * GET /api/finance/overview
 * Financial dashboard high-level metrics (Section 15/23).
 */
router.get("/finance/overview", requireFinance, async (_req, res) => {
  try {
    const bookings = await db.select().from(bookingsTable);
    const refunds = await db.select().from(refundsTable);

    let totalCustomerCollections = 0;
    let totalSupplierBaseCost = 0;
    let totalRealizedGrossMargin = 0;
    let activeBookingsCount = 0;

    for (const b of bookings) {
      if (b.paymentStatus === "SUCCESSFUL" || b.status === "PAID" || b.status === "CONFIRMED") {
        totalCustomerCollections += b.totalPrice || 0;
        totalSupplierBaseCost += b.actualSupplierCost || b.totalBaseCost || 0;
        totalRealizedGrossMargin += (b.totalPrice || 0) - (b.actualSupplierCost || b.totalBaseCost || 0);
        activeBookingsCount++;
      }
    }

    const pendingRefunds = refunds.filter((r: any) => r.status === "REQUESTED");
    const totalRefundedAmount = refunds
      .filter((r: any) => r.status === "PROCESSED" || r.status === "APPROVED")
      .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    res.json({
      status: "success",
      overview: {
        totalCustomerCollections,
        totalSupplierBaseCost,
        totalRealizedGrossMargin,
        activeBookingsCount,
        pendingRefundsCount: pendingRefunds.length,
        totalRefundedAmount,
        marginPercent: totalCustomerCollections > 0
          ? Number(((totalRealizedGrossMargin / totalCustomerCollections) * 100).toFixed(1))
          : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to load financial overview." });
  }
});

/**
 * GET /api/finance/bookings
 * Margin & cost ledger per booking (Section 15).
 */
router.get(["/finance/bookings", "/finance/bookings-ledger"], requireFinance, async (_req, res) => {
  try {
    const bookings = await db
      .select({
        id: bookingsTable.id,
        bookingId: bookingsTable.bookingId,
        status: bookingsTable.status,
        paymentStatus: bookingsTable.paymentStatus,
        travelDate: bookingsTable.travelDate,
        totalPrice: bookingsTable.totalPrice,
        totalBaseCost: bookingsTable.totalBaseCost,
        totalMarkup: bookingsTable.totalMarkup,
        actualSupplierCost: bookingsTable.actualSupplierCost,
        actualGrossMargin: bookingsTable.actualGrossMargin,
        createdAt: bookingsTable.createdAt,
      })
      .from(bookingsTable)
      .orderBy(desc(bookingsTable.createdAt));

    const ledger = bookings.map((b: any) => {
      const supplierCost = b.actualSupplierCost ?? b.totalBaseCost;
      const margin = (b.totalPrice || 0) - (supplierCost || 0);
      const marginPercent = b.totalPrice > 0 ? Number(((margin / b.totalPrice) * 100).toFixed(1)) : 0;
      return {
        ...b,
        computedSupplierCost: supplierCost,
        computedMargin: margin,
        computedMarginPercent: marginPercent,
      };
    });

    res.json({ status: "success", count: ledger.length, ledger });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to load booking ledger." });
  }
});

/**
 * GET /api/finance/refunds
 * List all refund requests and states.
 */
router.get("/finance/refunds", requireFinance, async (_req, res) => {
  try {
    const refunds = await db
      .select()
      .from(refundsTable)
      .orderBy(desc(refundsTable.createdAt));

    res.json({ status: "success", count: refunds.length, refunds });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to load refunds." });
  }
});

/**
 * POST /api/finance/refunds/:id/process & /api/finance/refunds/:id/approve
 * Finance officer approves or rejects a customer refund request (Section 26).
 */
router.post(["/finance/refunds/:id/process", "/finance/refunds/:id/approve"], requireFinance, async (req, res) => {
  const schema = z.object({
    action: z.enum(["APPROVE", "REJECT"]).default("APPROVE"),
    notes: z.string().optional(),
    refundAmount: z.number().int().positive().optional(),
  });

  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Action must be APPROVE or REJECT.", errors: parsed.error.issues });
    return;
  }

  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const { action, notes, refundAmount } = parsed.data;

  try {
    const [refund] = await db
      .select()
      .from(refundsTable)
      .where(eq(refundsTable.id, id))
      .limit(1);

    if (!refund) {
      res.status(404).json({ status: "not_found", message: "Refund request not found." });
      return;
    }

    const now = new Date();
    const finalAmount = refundAmount || refund.amount;
    const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

    const [updatedRefund] = await db
      .update(refundsTable)
      .set({
        status: newStatus,
        amount: finalAmount,
        notes: notes || refund.notes,
        approvedAt: now,
        processedAt: action === "APPROVE" ? now : undefined,
        updatedAt: now,
      })
      .where(eq(refundsTable.id, id))
      .returning();

    // Update associated booking
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, refund.bookingId))
      .limit(1);

    if (booking) {
      const currentTimeline = Array.isArray(booking.timeline) ? [...booking.timeline] : [];
      currentTimeline.push({
        event: `REFUND_${newStatus}`,
        timestamp: now.toISOString(),
        actor: "Finance Team",
        notes: `Refund of ₹${finalAmount.toLocaleString("en-IN")} was ${newStatus.toLowerCase()}. Notes: ${notes || "No notes"}`,
      });

      await db
        .update(bookingsTable)
        .set({
          status: action === "APPROVE" ? "REFUNDED" : booking.status,
          paymentStatus: action === "APPROVE" ? "REFUNDED" : booking.paymentStatus,
          refundAmount: action === "APPROVE" ? finalAmount : booking.refundAmount,
          timeline: currentTimeline,
          updatedAt: now,
        })
        .where(eq(bookingsTable.id, booking.id));

      // Notify customer
      if (booking.customerContact?.email) {
        await dispatchMultiChannelNotification({
          type: "CANCELLATION_REFUND_UPDATE",
          recipientEmail: booking.customerContact.email,
          customerName: booking.customerContact.name,
          bookingId: booking.bookingId || booking.id,
          message: action === "APPROVE"
            ? `Your refund of ₹${finalAmount.toLocaleString("en-IN")} has been approved and processed to your original payment method.`
            : `Your refund request could not be approved: ${notes || "Contact customer support for details."}`,
        });
      }
    }

    await logAuditAction({
      action: `REFUND_${action}`,
      resourceType: "refund",
      resourceId: id,
      actorUserId: req.user?.id,
      actorRole: req.user?.role || "finance",
      newValue: { status: newStatus, amount: finalAmount, notes },
    });

    res.json({
      status: "success",
      refund: updatedRefund,
      message: `Refund ${action.toLowerCase()}d successfully.`,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Failed to process refund." });
  }
});

export default router;
