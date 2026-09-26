import { eq, or, desc, like } from "drizzle-orm";
import {
  db,
  bookingsTable,
  bookingServicesTable,
  packagesTable,
  slaSettingsTable,
  auditLogsTable,
  notificationsTable,
  type Booking,
  type BookingService,
} from "@workspace/db";
import { dispatchMultiChannelNotification } from "./email-service";

/**
 * Generates centralized master booking ID in format ZL{YYMMDD}{seq} (PRD Section 11/19).
 * E.g. ZL260918001
 */
export async function generateMasterBookingId(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `ZL${yy}${mm}${dd}`;

  try {
    const latest = await db
      .select({ bookingId: bookingsTable.bookingId })
      .from(bookingsTable)
      .where(like(bookingsTable.bookingId, `${prefix}%`))
      .orderBy(desc(bookingsTable.bookingId))
      .limit(1);

    let seq = 1;
    if (latest.length > 0 && latest[0]?.bookingId) {
      const lastSeqStr = latest[0].bookingId.slice(prefix.length);
      const parsed = parseInt(lastSeqStr, 10);
      if (!isNaN(parsed)) {
        seq = parsed + 1;
      }
    }

    return `${prefix}${String(seq).padStart(3, "0")}`;
  } catch {
    // Fallback in case of DB read error
    return `${prefix}${Math.floor(100 + Math.random() * 900)}`;
  }
}

/**
 * Retrieves configurable SLA duration in minutes from sla_settings table (Gap 5).
 */
export async function getSlaDurationMinutes(settingKey: string, defaultMinutes = 120): Promise<number> {
  try {
    const [row] = await db
      .select({ durationMinutes: slaSettingsTable.durationMinutes })
      .from(slaSettingsTable)
      .where(eq(slaSettingsTable.settingKey, settingKey))
      .limit(1);
    return row?.durationMinutes ?? defaultMinutes;
  } catch {
    return defaultMinutes;
  }
}

/**
 * Logs sensitive business and operational actions to audit_logs table.
 */
export async function logAuditAction(params: {
  action: string;
  resourceType: string;
  resourceId?: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  actorUserId?: string;
  actorAdminId?: string;
  actorName?: string;
  actorRole?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      previousValue: params.previousValue ?? null,
      newValue: params.newValue ?? null,
      actorUserId: params.actorUserId,
      actorAdminId: params.actorAdminId,
      actorName: params.actorName || "System",
      actorRole: params.actorRole || "system",
      ipAddress: params.ipAddress,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error("[AuditLog] Failed to persist audit record:", err);
  }
}

/**
 * Automatically creates/initiates service-level fulfilment tasks upon payment capture (Section 12).
 */
export async function createFulfilmentTasksOnPayment(bookingRef: string): Promise<void> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingRef);
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(isUuid ? eq(bookingsTable.id, bookingRef) : eq(bookingsTable.bookingId, bookingRef))
    .limit(1);

  if (!booking) {
    console.warn(`[BookingEngine] Booking not found for reference ${bookingRef}`);
    return;
  }

  // Fetch all component services for this booking
  let services = await db
    .select()
    .from(bookingServicesTable)
    .where(eq(bookingServicesTable.bookingId, booking.id));

  const slaMinutes = await getSlaDurationMinutes("standard_supplier_response", 120);
  const now = new Date();
  const deadline = new Date(now.getTime() + slaMinutes * 60 * 1000);

  if (services.length === 0) {
    let destinationTitle = "Package Tour";
    if (booking.packageId) {
      const [foundPkg] = await db
        .select()
        .from(packagesTable)
        .where(eq(packagesTable.id, booking.packageId))
        .limit(1);
      if (foundPkg) {
        destinationTitle = foundPkg.title;
      }
    }

    const defaultServices = [
      {
        bookingId: booking.id,
        serviceType: "hotel",
        title: `Hotel Accommodation - ${destinationTitle}`,
        assignedVendorId: null,
        status: "PENDING",
        deadline,
        supplierNetCost: Math.round((booking.totalBaseCost || 0) * 0.5),
        retailPrice: Math.round((booking.totalPrice || 0) * 0.5),
        customerFacingVerified: false,
        requestedAt: null,
      },
      {
        bookingId: booking.id,
        serviceType: "transfer",
        title: `Airport & Local Transfers - ${destinationTitle}`,
        assignedVendorId: null,
        status: "PENDING",
        deadline,
        supplierNetCost: Math.round((booking.totalBaseCost || 0) * 0.25),
        retailPrice: Math.round((booking.totalPrice || 0) * 0.25),
        customerFacingVerified: false,
        requestedAt: null,
      },
      {
        bookingId: booking.id,
        serviceType: "activity",
        title: `Sightseeing & Guided Activities - ${destinationTitle}`,
        assignedVendorId: null,
        status: "PENDING",
        deadline,
        supplierNetCost: Math.round((booking.totalBaseCost || 0) * 0.25),
        retailPrice: Math.round((booking.totalPrice || 0) * 0.25),
        customerFacingVerified: false,
        requestedAt: null,
      },
    ];

    if (booking.flightRequired) {
      defaultServices.push({
        bookingId: booking.id,
        serviceType: "flight_partner",
        title: `Flight Fulfillment Desk - ${destinationTitle}`,
        assignedVendorId: null,
        status: "PENDING",
        deadline,
        supplierNetCost: 0,
        retailPrice: 0,
        customerFacingVerified: false,
        requestedAt: null,
      });
    }

    services = await db
      .insert(bookingServicesTable)
      .values(defaultServices)
      .returning();
  } else {
    // Update services to REQUESTED or ASSIGNED if vendor is linked, and assign SLA deadline
    for (const s of services) {
      const newStatus = s.assignedVendorId ? "REQUESTED" : "ASSIGNED";
      await db
        .update(bookingServicesTable)
        .set({
          status: newStatus,
          requestedAt: now,
          deadline,
          updatedAt: now,
        })
        .where(eq(bookingServicesTable.id, s.id));
    }
  }

  // Update booking timeline
  const currentTimeline = Array.isArray(booking.timeline) ? [...booking.timeline] : [];
  currentTimeline.push({
    event: "PAYMENT_CAPTURED",
    timestamp: now.toISOString(),
    actor: "Payment Gateway",
    notes: "Payment successfully captured. Local supplier fulfilment tasks generated with operational SLA deadlines.",
  });

  await db
    .update(bookingsTable)
    .set({
      status: "PROCESSING",
      paymentStatus: "SUCCESSFUL",
      timeline: currentTimeline,
      updatedAt: now,
    })
    .where(eq(bookingsTable.id, booking.id));

  await logAuditAction({
    action: "FULFILMENT_TASKS_INITIATED",
    resourceType: "booking",
    resourceId: booking.id,
    actorRole: "system",
    newValue: {
      bookingId: booking.bookingId,
      tasksCount: services.length,
      slaDeadline: deadline.toISOString(),
    },
  });
}

/**
 * Reevaluates customer-facing booking status based on supplier task confirmation and operations verification gates (Section 12).
 */
export async function reevaluateBookingStatus(bookingRef: string): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingRef);
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(isUuid ? eq(bookingsTable.id, bookingRef) : eq(bookingsTable.bookingId, bookingRef))
    .limit(1);

  if (!booking) {
    return "UNKNOWN";
  }

  const services = await db
    .select()
    .from(bookingServicesTable)
    .where(eq(bookingServicesTable.bookingId, booking.id));

  if (services.length === 0) {
    return booking.status;
  }

  // Operations verification gate: A service is only truly customer-confirmed if verified by ops
  const verifiedServices = services.filter((s: any) => s.customerFacingVerified && (s.status === "VERIFIED" || s.status === "CONFIRMED"));
  const rejectedServices = services.filter((s: any) => s.status === "REJECTED");
  const cancelledServices = services.filter((s: any) => s.status === "CANCELLED");

  let nextStatus = booking.status;

  if (rejectedServices.length > 0) {
    nextStatus = "ACTION_REQUIRED";
  } else if (cancelledServices.length === services.length) {
    nextStatus = "CANCELLED";
  } else if (verifiedServices.length === services.length) {
    nextStatus = "CONFIRMED";
  } else if (verifiedServices.length > 0) {
    nextStatus = "PARTIALLY_CONFIRMED";
  } else {
    nextStatus = "PROCESSING";
  }

  if (nextStatus !== booking.status) {
    const now = new Date();
    const currentTimeline = Array.isArray(booking.timeline) ? [...booking.timeline] : [];
    currentTimeline.push({
      event: `STATUS_UPDATED_${nextStatus}`,
      timestamp: now.toISOString(),
      actor: "Operations Engine",
      notes: `Booking status transitioned to ${nextStatus} based on verified supplier task states.`,
    });

    await db
      .update(bookingsTable)
      .set({
        status: nextStatus,
        timeline: currentTimeline,
        updatedAt: now,
      })
      .where(eq(bookingsTable.id, booking.id));

    await logAuditAction({
      action: "BOOKING_STATUS_REEVALUATED",
      resourceType: "booking",
      resourceId: booking.id,
      previousValue: { status: booking.status },
      newValue: { status: nextStatus },
      actorRole: "operations",
    });

    // If fully confirmed, notify customer with Section 17 FINAL_TRIP_CONFIRMED event
    if (nextStatus === "CONFIRMED" && booking.customerContact?.email) {
      await dispatchMultiChannelNotification({
        type: "FINAL_TRIP_CONFIRMED",
        recipientEmail: booking.customerContact.email,
        customerName: booking.customerContact.name,
        bookingId: booking.bookingId,
        message: "All flight, stay, transfer, and activity components have been confirmed by our local partners.",
      });
    }
  }

  return nextStatus;
}
