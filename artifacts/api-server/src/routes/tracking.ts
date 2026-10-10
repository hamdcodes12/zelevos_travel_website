import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, or, sql, ilike } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  bookingsTable,
  usersTable,
  customersTable,
  vendorsTable,
  tripFulfillmentsTable,
  tripFulfillmentItemsTable,
  tripTrackingSessionsTable,
  tripLocationUpdatesTable,
  tripTrackingEventsTable,
  adminNotificationsTable,
  type TripTrackingSession,
} from "@workspace/db";
import { requireAuth, requireAuthOrAdmin } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/rbac";
import {
  calculateHaversineDistanceKm,
  evaluateDeviceStatus,
  logTrackingEvent,
  realtimeBroadcaster,
  stopTrackingSession,
  TRACKING_CONFIG,
} from "../services/tracking-service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(val: string): boolean {
  return UUID_REGEX.test(val);
}

// Helper: Ensure a tracking session exists for an active paid booking with a cab component
async function ensureTrackingSessionForBooking(booking: any): Promise<TripTrackingSession | null> {
  // 1. Check for existing session
  const [existing] = await db
    .select()
    .from(tripTrackingSessionsTable)
    .where(eq(tripTrackingSessionsTable.bookingId, booking.id))
    .orderBy(desc(tripTrackingSessionsTable.createdAt))
    .limit(1);

  if (existing) {
    return existing;
  }

  // 2. Look for assigned or approved CAB fulfillment item
  const [fulfillment] = await db
    .select()
    .from(tripFulfillmentsTable)
    .where(eq(tripFulfillmentsTable.bookingId, booking.id))
    .limit(1);

  let cabItem: any = null;
  if (fulfillment) {
    const items = await db
      .select()
      .from(tripFulfillmentItemsTable)
      .where(
        and(
          eq(tripFulfillmentItemsTable.fulfillmentId, fulfillment.id),
          eq(tripFulfillmentItemsTable.componentType, "CAB")
        )
      )
      .limit(1);
    cabItem = items[0] || null;
  }

  const cabDetails = (cabItem?.details as Record<string, any>) || {};

  // Create initial tracking session
  const [created] = await db
    .insert(tripTrackingSessionsTable)
    .values({
      bookingId: booking.id,
      customerId: booking.customerId || booking.ownerId,
      vendorId: cabItem?.vendorId || null,
      fulfillmentItemId: cabItem?.id || null,
      status: "READY",
      driverName: cabDetails.driverName || null,
      driverPhone: cabDetails.driverPhone || null,
      vehicleRegistration: cabDetails.vehicleRegistrationNumber || null,
      vehicleModel: cabDetails.vehicleModel || null,
      pickupLocation: cabDetails.pickupPoint || null,
      destinationLocation: cabDetails.dropPoint || null,
    })
    .returning();

  await logTrackingEvent({
    trackingSessionId: created.id,
    bookingId: booking.id,
    eventType: "TRACKING_SESSION_CREATED",
    actorType: "SYSTEM",
    actorName: "Zelevos Fulfillment Desk",
    metadata: {
      bookingId: booking.bookingId || booking.id,
      driverName: created.driverName,
      vehicleRegistration: created.vehicleRegistration,
    },
  });

  return created;
}

// --------------------------------------------------------------------------
// 1. CUSTOMER: GET MY ACTIVE TRIP TRACKING SESSION
// --------------------------------------------------------------------------
router.get("/tracking/my-trip/:idOrBookingId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const idOrBookingId = typeof req.params.idOrBookingId === "string" ? req.params.idOrBookingId : String(req.params.idOrBookingId || "");

  try {
    const isStaff =
      Boolean(req.admin) ||
      req.user?.role === "admin" ||
      req.user?.role === "operations_manager";

    // Lookup booking
    const bookingQuery = isUuid(idOrBookingId)
      ? eq(bookingsTable.id, idOrBookingId)
      : eq(bookingsTable.bookingId, idOrBookingId);

    const [booking] = await db.select().from(bookingsTable).where(bookingQuery).limit(1);

    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    // IDOR Enforcement: Must be customer's own booking unless staff
    if (!isStaff && booking.customerId !== req.user!.id && booking.ownerId !== req.user!.id) {
      res.status(404).json({ status: "not_found", message: "Booking not found." });
      return;
    }

    const session = await ensureTrackingSessionForBooking(booking);

    if (!session) {
      res.status(404).json({ status: "not_found", message: "Tracking session not available for this booking." });
      return;
    }

    // Evaluate live/stale/offline status using server timestamps
    const nowMs = Date.now();
    const customerStatus = evaluateDeviceStatus(session.customerTrackingEnabled, session.lastCustomerUpdateAt, nowMs);
    const driverStatus = evaluateDeviceStatus(session.driverTrackingEnabled, session.lastDriverUpdateAt, nowMs);

    const [customerUser] = await db
      .select({ fullName: usersTable.fullName, customerId: usersTable.customerId })
      .from(usersTable)
      .where(eq(usersTable.id, session.customerId))
      .limit(1);

    res.json({
      status: "success",
      session: {
        id: session.id,
        bookingId: booking.bookingId || booking.id,
        customerName: customerUser?.fullName || "Traveler",
        customerIdCode: customerUser?.customerId || session.customerId,
        status: session.status,
        customerTrackingEnabled: session.customerTrackingEnabled,
        driverTrackingEnabled: session.driverTrackingEnabled,
        driverName: session.driverName,
        driverPhone: session.driverPhone,
        vehicleRegistration: session.vehicleRegistration,
        vehicleRegistrationNumber: session.vehicleRegistration,
        vehicleModel: session.vehicleModel,
        pickupLocation: session.pickupLocation,
        destinationLocation: session.destinationLocation,
        lastCustomerLocation: session.lastCustomerLatitude && session.lastCustomerLongitude
          ? {
              latitude: session.lastCustomerLatitude,
              longitude: session.lastCustomerLongitude,
              accuracy: session.lastCustomerAccuracy,
              updatedAt: session.lastCustomerUpdateAt,
              status: customerStatus.status,
              secondsAgo: customerStatus.secondsAgo,
            }
          : null,
        lastDriverLocation: session.lastDriverLatitude && session.lastDriverLongitude
          ? {
              latitude: session.lastDriverLatitude,
              longitude: session.lastDriverLongitude,
              accuracy: session.lastDriverAccuracy,
              heading: session.lastDriverHeading,
              speed: session.lastDriverSpeed,
              updatedAt: session.lastDriverUpdateAt,
              status: driverStatus.status,
              secondsAgo: driverStatus.secondsAgo,
            }
          : null,
        calculatedDistanceKm: session.calculatedDistanceKm,
        distanceUpdatedAt: session.distanceUpdatedAt,
        emergencyAlertActive: session.emergencyAlertActive,
        emergencyAlertAt: session.emergencyAlertAt,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to get customer tracking session");
    res.status(500).json({ status: "error", message: "Could not load tracking details." });
  }
});

// --------------------------------------------------------------------------
// 2. CUSTOMER: START / ALLOW LOCATION SHARING
// --------------------------------------------------------------------------
router.post("/tracking/:sessionId/customer/start", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId : String(req.params.sessionId || "");

  try {
    const [session] = await db
      .select()
      .from(tripTrackingSessionsTable)
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ status: "not_found", message: "Tracking session not found." });
      return;
    }

    // IDOR Check
    if (session.customerId !== req.user!.id && req.user!.role !== "admin" && req.user!.role !== "operations_manager") {
      res.status(403).json({ status: "forbidden", message: "Not authorized for this tracking session." });
      return;
    }

    if (session.status === "COMPLETED" || session.status === "CANCELLED") {
      res.status(400).json({ status: "invalid_state", message: "Cannot activate tracking for an ended trip." });
      return;
    }

    const [updated] = await db
      .update(tripTrackingSessionsTable)
      .set({
        customerTrackingEnabled: true,
        status: "ACTIVE",
        startedAt: session.startedAt || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .returning();

    await logTrackingEvent({
      trackingSessionId: sessionId,
      bookingId: session.bookingId,
      eventType: "CUSTOMER_TRACKING_STARTED",
      actorType: "CUSTOMER",
      actorId: req.user!.id,
      actorName: req.user!.fullName || "Customer",
    });

    realtimeBroadcaster.broadcast(sessionId, "customer_status_changed", {
      customerTrackingEnabled: true,
      status: updated.status,
    });

    res.json({
      status: "success",
      message: "Customer location sharing enabled for this active trip.",
      session: {
        id: updated.id,
        customerTrackingEnabled: updated.customerTrackingEnabled,
        status: updated.status,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to start customer tracking");
    res.status(500).json({ status: "error", message: "Could not activate customer location sharing." });
  }
});

// --------------------------------------------------------------------------
// 3. CUSTOMER: STOP LOCATION SHARING
// --------------------------------------------------------------------------
router.post("/tracking/:sessionId/customer/stop", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId : String(req.params.sessionId || "");

  try {
    const [session] = await db
      .select()
      .from(tripTrackingSessionsTable)
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ status: "not_found", message: "Tracking session not found." });
      return;
    }

    // IDOR Check
    if (session.customerId !== req.user!.id && req.user!.role !== "admin" && req.user!.role !== "operations_manager") {
      res.status(403).json({ status: "forbidden", message: "Not authorized for this tracking session." });
      return;
    }

    const [updated] = await db
      .update(tripTrackingSessionsTable)
      .set({
        customerTrackingEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .returning();

    await logTrackingEvent({
      trackingSessionId: sessionId,
      bookingId: session.bookingId,
      eventType: "CUSTOMER_TRACKING_STOPPED",
      actorType: "CUSTOMER",
      actorId: req.user!.id,
      actorName: req.user!.fullName || "Customer",
    });

    realtimeBroadcaster.broadcast(sessionId, "customer_status_changed", {
      customerTrackingEnabled: false,
    });

    res.json({
      status: "success",
      message: "Customer location sharing stopped.",
      session: {
        id: updated.id,
        customerTrackingEnabled: updated.customerTrackingEnabled,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to stop customer tracking");
    res.status(500).json({ status: "error", message: "Could not stop location sharing." });
  }
});

// --------------------------------------------------------------------------
// 4. DRIVER / VENDOR: START TRIP & ACTIVATE GPS
// --------------------------------------------------------------------------
router.post("/tracking/:sessionId/driver/start", requireAuthOrAdmin, async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId : String(req.params.sessionId || "");

  try {
    const [session] = await db
      .select()
      .from(tripTrackingSessionsTable)
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ status: "not_found", message: "Tracking session not found." });
      return;
    }

    const isStaff = Boolean(req.admin) || req.user?.role === "admin" || req.user?.role === "operations_manager";
    const isAssignedVendor = req.user?.role === "vendor" && session.vendorId && session.vendorId === req.user?.vendorId;
    const isAssignedDriver = session.driverId && session.driverId === req.user?.id;

    if (!isStaff && !isAssignedVendor && !isAssignedDriver) {
      res.status(403).json({ status: "forbidden", message: "Not authorized to start this trip as driver." });
      return;
    }

    if (session.status === "COMPLETED" || session.status === "CANCELLED") {
      res.status(400).json({ status: "invalid_state", message: "Trip has already concluded." });
      return;
    }

    const [updated] = await db
      .update(tripTrackingSessionsTable)
      .set({
        driverTrackingEnabled: true,
        driverId: req.user?.id || session.driverId,
        status: "ACTIVE",
        startedAt: session.startedAt || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .returning();

    await logTrackingEvent({
      trackingSessionId: sessionId,
      bookingId: session.bookingId,
      eventType: "DRIVER_STARTED_TRIP",
      actorType: "DRIVER",
      actorId: req.user?.id,
      actorName: updated.driverName || req.user?.fullName || "Chauffeur",
      metadata: { vehicleRegistration: updated.vehicleRegistration },
    });

    realtimeBroadcaster.broadcast(sessionId, "driver_status_changed", {
      driverTrackingEnabled: true,
      status: updated.status,
    });

    res.json({
      status: "success",
      message: "Driver started trip. Live GPS activated.",
      session: {
        id: updated.id,
        driverTrackingEnabled: updated.driverTrackingEnabled,
        status: updated.status,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to start driver tracking");
    res.status(500).json({ status: "error", message: "Could not start trip." });
  }
});

// --------------------------------------------------------------------------
// 5. DRIVER / VENDOR: END TRIP & STOP GPS
// --------------------------------------------------------------------------
router.post("/tracking/:sessionId/driver/stop", requireAuthOrAdmin, async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId : String(req.params.sessionId || "");

  try {
    const [session] = await db
      .select()
      .from(tripTrackingSessionsTable)
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ status: "not_found", message: "Tracking session not found." });
      return;
    }

    const isStaff = Boolean(req.admin) || req.user?.role === "admin" || req.user?.role === "operations_manager";
    const isAssignedVendor = req.user?.role === "vendor" && session.vendorId && session.vendorId === req.user?.vendorId;
    const isAssignedDriver = session.driverId && session.driverId === req.user?.id;

    if (!isStaff && !isAssignedVendor && !isAssignedDriver) {
      res.status(403).json({ status: "forbidden", message: "Not authorized to end this trip." });
      return;
    }

    const ended = await stopTrackingSession(
      sessionId,
      "DRIVER_ENDED",
      req.user?.fullName || session.driverName || "Driver"
    );

    res.json({
      status: "success",
      message: "Trip concluded and GPS tracking stopped.",
      session: ended,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to stop driver tracking");
    res.status(500).json({ status: "error", message: "Could not end trip." });
  }
});

// --------------------------------------------------------------------------
// 6. SUBMIT REAL GPS COORDINATES (Customer or Driver)
// --------------------------------------------------------------------------
const locationUpdateBodySchema = z.object({
  latitude: z.number().min(TRACKING_CONFIG.COORDINATE_BOUNDS.MIN_LAT).max(TRACKING_CONFIG.COORDINATE_BOUNDS.MAX_LAT),
  longitude: z.number().min(TRACKING_CONFIG.COORDINATE_BOUNDS.MIN_LON).max(TRACKING_CONFIG.COORDINATE_BOUNDS.MAX_LON),
  accuracy: z.number().nonnegative().optional(),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().nonnegative().optional(),
  recordedAt: z.string().datetime().optional(),
  actorTypeOverride: z.enum(["CUSTOMER", "DRIVER"]).optional(), // only usable by admin/ops staff
});

router.post("/tracking/:sessionId/location", requireAuthOrAdmin, async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId : String(req.params.sessionId || "");
  const parsed = locationUpdateBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      status: "invalid_request",
      message: "Invalid GPS coordinates: latitude (-90..90) and longitude (-180..180) are required.",
      errors: parsed.error.issues,
    });
    return;
  }

  const { latitude, longitude, accuracy, heading, speed, recordedAt } = parsed.data;

  try {
    const [session] = await db
      .select()
      .from(tripTrackingSessionsTable)
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ status: "not_found", message: "Tracking session not found." });
      return;
    }

    if (session.status === "COMPLETED" || session.status === "CANCELLED") {
      res.status(400).json({ status: "session_closed", message: "This trip tracking session has already ended." });
      return;
    }

    // Resolve Actor Type securely from session identity
    const isStaff = Boolean(req.admin) || req.user?.role === "admin" || req.user?.role === "operations_manager";
    let actorType: "CUSTOMER" | "DRIVER";
    let actorId: string;

    if (req.user && req.user.id === session.customerId) {
      actorType = "CUSTOMER";
      actorId = req.user.id;
    } else if (
      req.user &&
      ((session.driverId && session.driverId === req.user.id) ||
        (session.vendorId && session.vendorId === req.user.vendorId))
    ) {
      actorType = "DRIVER";
      actorId = req.user.id;
    } else if (isStaff) {
      // Ground Operations Control override for field testing
      actorType = parsed.data.actorTypeOverride || "CUSTOMER";
      actorId = req.user?.id || (session.customerId as string);
    } else {
      res.status(403).json({ status: "forbidden", message: "You are not authorized to send location updates for this trip." });
      return;
    }

    const recordedDate = recordedAt ? new Date(recordedAt) : new Date();

    // 1. Insert into historical location updates table
    await db.insert(tripLocationUpdatesTable).values({
      trackingSessionId: session.id,
      bookingId: session.bookingId,
      actorType,
      actorId,
      latitude,
      longitude,
      accuracy: accuracy || null,
      heading: heading || null,
      speed: speed || null,
      recordedAt: recordedDate,
      source: "browser_geolocation",
    });

    // 2. Update tracking session latest coordinates and compute Haversine distance
    let calculatedDistanceKm = session.calculatedDistanceKm;
    let distanceUpdatedAt = session.distanceUpdatedAt;

    const sessionUpdate: Partial<typeof session> = {
      updatedAt: new Date(),
    };

    if (actorType === "CUSTOMER") {
      sessionUpdate.lastCustomerLatitude = latitude;
      sessionUpdate.lastCustomerLongitude = longitude;
      sessionUpdate.lastCustomerAccuracy = accuracy || null;
      sessionUpdate.lastCustomerUpdateAt = recordedDate;
      sessionUpdate.customerTrackingEnabled = true;

      if (session.lastDriverLatitude && session.lastDriverLongitude) {
        calculatedDistanceKm = calculateHaversineDistanceKm(
          latitude,
          longitude,
          session.lastDriverLatitude,
          session.lastDriverLongitude
        );
        distanceUpdatedAt = new Date();
        sessionUpdate.calculatedDistanceKm = calculatedDistanceKm;
        sessionUpdate.distanceUpdatedAt = distanceUpdatedAt;
      }
    } else {
      sessionUpdate.lastDriverLatitude = latitude;
      sessionUpdate.lastDriverLongitude = longitude;
      sessionUpdate.lastDriverAccuracy = accuracy || null;
      sessionUpdate.lastDriverHeading = heading || null;
      sessionUpdate.lastDriverSpeed = speed || null;
      sessionUpdate.lastDriverUpdateAt = recordedDate;
      sessionUpdate.driverTrackingEnabled = true;

      if (session.lastCustomerLatitude && session.lastCustomerLongitude) {
        calculatedDistanceKm = calculateHaversineDistanceKm(
          session.lastCustomerLatitude,
          session.lastCustomerLongitude,
          latitude,
          longitude
        );
        distanceUpdatedAt = new Date();
        sessionUpdate.calculatedDistanceKm = calculatedDistanceKm;
        sessionUpdate.distanceUpdatedAt = distanceUpdatedAt;
      }
    }

    // Auto-advance READY session to ACTIVE
    if (session.status === "READY") {
      sessionUpdate.status = "ACTIVE";
      sessionUpdate.startedAt = session.startedAt || new Date();
    }

    const [updatedSession] = await db
      .update(tripTrackingSessionsTable)
      .set(sessionUpdate)
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .returning();

    // 3. Broadcast real-time update to session subscribers
    const broadcastPayload = {
      actorType,
      latitude,
      longitude,
      accuracy,
      heading,
      speed,
      recordedAt: recordedDate.toISOString(),
      calculatedDistanceKm,
      distanceUpdatedAt: distanceUpdatedAt ? new Date(distanceUpdatedAt).toISOString() : null,
      customerStatus: evaluateDeviceStatus(updatedSession.customerTrackingEnabled, updatedSession.lastCustomerUpdateAt).status,
      driverStatus: evaluateDeviceStatus(updatedSession.driverTrackingEnabled, updatedSession.lastDriverUpdateAt).status,
    };

    realtimeBroadcaster.broadcast(sessionId, "location_update", broadcastPayload);

    res.json({
      status: "success",
      actorType,
      recordedAt: recordedDate.toISOString(),
      calculatedDistanceKm,
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        customerTrackingEnabled: updatedSession.customerTrackingEnabled,
        driverTrackingEnabled: updatedSession.driverTrackingEnabled,
        lastCustomerLatitude: updatedSession.lastCustomerLatitude,
        lastCustomerLongitude: updatedSession.lastCustomerLongitude,
        lastDriverLatitude: updatedSession.lastDriverLatitude,
        lastDriverLongitude: updatedSession.lastDriverLongitude,
        calculatedDistanceKm: updatedSession.calculatedDistanceKm,
        emergencyAlertActive: updatedSession.emergencyAlertActive,
      },
      message: "GPS coordinate recorded.",
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to process location update");
    res.status(500).json({ status: "error", message: "Failed to record location." });
  }
});

// --------------------------------------------------------------------------
// 7. CUSTOMER SAFETY: EMERGENCY SOS ALERT
// --------------------------------------------------------------------------
router.post("/tracking/:sessionId/emergency", requireAuthOrAdmin, async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId : String(req.params.sessionId || "");
  const { notes, currentLatitude, currentLongitude } = req.body || {};

  try {
    const [session] = await db
      .select()
      .from(tripTrackingSessionsTable)
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ status: "not_found", message: "Tracking session not found." });
      return;
    }

    // Fetch booking context for emergency dispatch
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, session.bookingId)).limit(1);
    const [customer] = await db.select().from(usersTable).where(eq(usersTable.id, session.customerId)).limit(1);

    const [updated] = await db
      .update(tripTrackingSessionsTable)
      .set({
        emergencyAlertActive: true,
        emergencyAlertAt: new Date(),
        emergencyAlertNotes: notes || "SOS button pressed by customer",
        updatedAt: new Date(),
      })
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .returning();

    // Log critical audit event
    await logTrackingEvent({
      trackingSessionId: sessionId,
      bookingId: session.bookingId,
      eventType: "EMERGENCY_CREATED",
      actorType: "CUSTOMER",
      actorId: req.user?.id,
      actorName: req.user?.fullName || customer?.fullName || "Customer",
      metadata: {
        bookingRef: booking?.bookingId || session.bookingId,
        customerName: customer?.fullName,
        driverName: session.driverName,
        vehicleReg: session.vehicleRegistration,
        notes: notes || "Emergency SOS activated",
        coordinates: currentLatitude && currentLongitude ? { currentLatitude, currentLongitude } : null,
      },
    });

    // Notify Admin & Operations Desk immediately
    try {
      await db.insert(adminNotificationsTable).values({
        type: "EMERGENCY_ALERT",
        module: "operations",
        relatedId: sessionId,
        title: `🚨 EMERGENCY SOS: ${booking?.bookingId || "Trip"}`,
        message: `Customer ${customer?.fullName || "Traveller"} triggered emergency SOS. Driver: ${session.driverName || "Assigned Driver"} (${session.vehicleRegistration || "Vehicle"}). Immediate ops response required.`,
        priority: "URGENT",
        actionRequired: true,
        actionUrl: `/admin?tab=live-trips&session=${sessionId}`,
      });
    } catch (notifErr) {
      logger.warn({ err: notifErr }, "Failed to write admin emergency notification");
    }

    // Realtime SOS broadcast
    realtimeBroadcaster.broadcast(sessionId, "emergency_alert", {
      active: true,
      alertAt: updated.emergencyAlertAt,
      notes: updated.emergencyAlertNotes,
      customerName: customer?.fullName || "Customer",
      customerPhone: customer?.phone,
      bookingId: booking?.bookingId,
      driverName: session.driverName,
      driverPhone: session.driverPhone,
    });

    res.json({
      status: "success",
      message: "Emergency alert sent to Zelevos 24/7 Operations Desk. Support concierge is actively tracking.",
      session: {
        id: updated.id,
        emergencyAlertActive: updated.emergencyAlertActive,
        emergencyAlertAt: updated.emergencyAlertAt,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to trigger emergency alert");
    res.status(500).json({ status: "error", message: "Failed to record emergency alert." });
  }
});

// --------------------------------------------------------------------------
// 8. ADMIN / OPS: RESOLVE EMERGENCY SOS ALERT
// --------------------------------------------------------------------------
router.post("/tracking/:sessionId/emergency/resolve", requireRole(["admin", "operations_manager"]), async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId : String(req.params.sessionId || "");
  const { resolutionNotes } = req.body || {};

  try {
    const [session] = await db
      .select()
      .from(tripTrackingSessionsTable)
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ status: "not_found", message: "Tracking session not found." });
      return;
    }

    const resolverName = (req as any).admin?.adminId || req.user?.fullName || "Operations Desk";

    const [updated] = await db
      .update(tripTrackingSessionsTable)
      .set({
        emergencyAlertActive: false,
        emergencyAlertResolvedAt: new Date(),
        emergencyAlertResolvedBy: resolverName,
        emergencyAlertNotes: resolutionNotes ? `${session.emergencyAlertNotes || ""}\n[Resolved: ${resolutionNotes}]` : session.emergencyAlertNotes,
        updatedAt: new Date(),
      })
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .returning();

    await logTrackingEvent({
      trackingSessionId: sessionId,
      bookingId: session.bookingId,
      eventType: "EMERGENCY_RESOLVED",
      actorType: "ADMIN",
      actorName: resolverName,
      metadata: { resolutionNotes, resolverName },
    });

    realtimeBroadcaster.broadcast(sessionId, "emergency_resolved", {
      active: false,
      resolvedAt: updated.emergencyAlertResolvedAt,
      resolvedBy: resolverName,
    });

    res.json({
      status: "success",
      message: "Emergency alert marked resolved.",
      session: updated,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to resolve emergency alert");
    res.status(500).json({ status: "error", message: "Failed to resolve emergency alert." });
  }
});

// --------------------------------------------------------------------------
// 9. REALTIME STREAM (Server-Sent Events scoped to session ID)
// --------------------------------------------------------------------------
router.get("/tracking/:sessionId/stream", requireAuthOrAdmin, async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId : String(req.params.sessionId || "");

  try {
    const [session] = await db
      .select()
      .from(tripTrackingSessionsTable)
      .where(eq(tripTrackingSessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ status: "not_found", message: "Session not found." });
      return;
    }

    // Access control
    const isStaff = Boolean(req.admin) || req.user?.role === "admin" || req.user?.role === "operations_manager";
    const isCustomer = req.user && req.user.id === session.customerId;
    const isAssignedDriver = req.user && ((session.driverId && session.driverId === req.user.id) || (session.vendorId && session.vendorId === req.user.vendorId));

    if (!isStaff && !isCustomer && !isAssignedDriver) {
      res.status(403).json({ status: "forbidden", message: "Not authorized to stream this trip's tracking data." });
      return;
    }

    // Setup SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Send initial snapshot
    const initialPayload = {
      sessionId: session.id,
      status: session.status,
      customerTrackingEnabled: session.customerTrackingEnabled,
      driverTrackingEnabled: session.driverTrackingEnabled,
      lastCustomerLatitude: session.lastCustomerLatitude,
      lastCustomerLongitude: session.lastCustomerLongitude,
      lastCustomerAccuracy: session.lastCustomerAccuracy,
      lastCustomerUpdateAt: session.lastCustomerUpdateAt,
      lastDriverLatitude: session.lastDriverLatitude,
      lastDriverLongitude: session.lastDriverLongitude,
      lastDriverAccuracy: session.lastDriverAccuracy,
      lastDriverHeading: session.lastDriverHeading,
      lastDriverSpeed: session.lastDriverSpeed,
      lastDriverUpdateAt: session.lastDriverUpdateAt,
      calculatedDistanceKm: session.calculatedDistanceKm,
      emergencyAlertActive: session.emergencyAlertActive,
    };

    res.write(`event: init\ndata: ${JSON.stringify(initialPayload)}\n\n`);

    // Subscribe to session channel
    const unsubscribe = realtimeBroadcaster.subscribe(sessionId, (message: any) => {
      res.write(`event: ${message.event}\ndata: ${JSON.stringify(message.payload)}\n\n`);
    });

    // Heartbeat every 15s
    const heartbeatTimer = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, TRACKING_CONFIG.HEARTBEAT_INTERVAL_MS);

    req.on("close", () => {
      clearInterval(heartbeatTimer);
      unsubscribe();
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to initialize SSE stream");
    if (!res.headersSent) {
      res.status(500).json({ status: "error", message: "Stream unavailable." });
    }
  }
});

// --------------------------------------------------------------------------
// 10. ADMIN: LIST ALL LIVE TRIPS (Scalable search & pagination)
// --------------------------------------------------------------------------
router.get("/admin/live-trips", requireRole(["admin", "operations_manager"]), async (req: Request, res: Response): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const filter = typeof req.query.filter === "string" ? req.query.filter.trim().toUpperCase() : "ALL";
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
  const offset = (page - 1) * limit;

  try {
    // Join trip_tracking_sessions with bookings and users for searchable fields
    const query = db
      .select({
        id: tripTrackingSessionsTable.id,
        bookingDbId: bookingsTable.id,
        bookingId: bookingsTable.bookingId,
        customerId: tripTrackingSessionsTable.customerId,
        customerCustomId: usersTable.customerId,
        customerName: usersTable.fullName,
        customerEmail: usersTable.email,
        customerPhone: usersTable.phone,
        driverName: tripTrackingSessionsTable.driverName,
        driverPhone: tripTrackingSessionsTable.driverPhone,
        vehicleRegistration: tripTrackingSessionsTable.vehicleRegistration,
        vehicleModel: tripTrackingSessionsTable.vehicleModel,
        status: tripTrackingSessionsTable.status,
        customerTrackingEnabled: tripTrackingSessionsTable.customerTrackingEnabled,
        driverTrackingEnabled: tripTrackingSessionsTable.driverTrackingEnabled,
        lastCustomerUpdateAt: tripTrackingSessionsTable.lastCustomerUpdateAt,
        lastDriverUpdateAt: tripTrackingSessionsTable.lastDriverUpdateAt,
        calculatedDistanceKm: tripTrackingSessionsTable.calculatedDistanceKm,
        emergencyAlertActive: tripTrackingSessionsTable.emergencyAlertActive,
        emergencyAlertAt: tripTrackingSessionsTable.emergencyAlertAt,
        startedAt: tripTrackingSessionsTable.startedAt,
        createdAt: tripTrackingSessionsTable.createdAt,
      })
      .from(tripTrackingSessionsTable)
      .innerJoin(bookingsTable, eq(tripTrackingSessionsTable.bookingId, bookingsTable.id))
      .innerJoin(usersTable, eq(tripTrackingSessionsTable.customerId, usersTable.id));

    const whereConditions: any[] = [];

    // Search query matches Customer Name, Customer ID, Booking ID, Driver Name, or Vehicle
    if (q) {
      const searchPattern = `%${q}%`;
      whereConditions.push(
        or(
          ilike(usersTable.fullName, searchPattern),
          ilike(usersTable.customerId, searchPattern),
          ilike(usersTable.email, searchPattern),
          ilike(bookingsTable.bookingId, searchPattern),
          ilike(tripTrackingSessionsTable.driverName, searchPattern),
          ilike(tripTrackingSessionsTable.vehicleRegistration, searchPattern)
        )
      );
    }

    if (filter === "EMERGENCY") {
      whereConditions.push(eq(tripTrackingSessionsTable.emergencyAlertActive, true));
    } else if (filter === "COMPLETED") {
      whereConditions.push(eq(tripTrackingSessionsTable.status, "COMPLETED"));
    } else if (filter === "LIVE") {
      whereConditions.push(
        and(
          eq(tripTrackingSessionsTable.status, "ACTIVE"),
          sql`${tripTrackingSessionsTable.lastCustomerUpdateAt} > NOW() - INTERVAL '60 seconds'`
        )
      );
    } else if (filter === "STALE") {
      whereConditions.push(
        and(
          eq(tripTrackingSessionsTable.status, "ACTIVE"),
          sql`${tripTrackingSessionsTable.lastCustomerUpdateAt} <= NOW() - INTERVAL '60 seconds'`,
          sql`${tripTrackingSessionsTable.lastCustomerUpdateAt} > NOW() - INTERVAL '120 seconds'`
        )
      );
    } else if (filter === "OFFLINE") {
      whereConditions.push(
        and(
          eq(tripTrackingSessionsTable.status, "ACTIVE"),
          or(
            sql`${tripTrackingSessionsTable.lastCustomerUpdateAt} IS NULL`,
            sql`${tripTrackingSessionsTable.lastCustomerUpdateAt} <= NOW() - INTERVAL '120 seconds'`
          )
        )
      );
    }

    const trips = await query
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(
        desc(tripTrackingSessionsTable.emergencyAlertActive),
        desc(tripTrackingSessionsTable.updatedAt)
      )
      .limit(limit)
      .offset(offset);

    // Evaluate live status for each item
    const nowMs = Date.now();
    const formatted = trips.map((t: any) => {
      const customerStatus = evaluateDeviceStatus(t.customerTrackingEnabled, t.lastCustomerUpdateAt, nowMs);
      const driverStatus = evaluateDeviceStatus(t.driverTrackingEnabled, t.lastDriverUpdateAt, nowMs);

      return {
        ...t,
        customerStatus: customerStatus.status,
        customerSecondsAgo: customerStatus.secondsAgo,
        driverStatus: driverStatus.status,
        driverSecondsAgo: driverStatus.secondsAgo,
      };
    });

    res.json({
      status: "success",
      page,
      limit,
      trips: formatted,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch admin live trips");
    res.status(500).json({ status: "error", message: "Failed to load live trips." });
  }
});

// --------------------------------------------------------------------------
// 11. ADMIN: GET SPECIFIC LIVE TRIP DETAIL
// --------------------------------------------------------------------------
router.get("/admin/live-trips/:sessionIdOrBookingId", requireRole(["admin", "operations_manager"]), async (req: Request, res: Response): Promise<void> => {
  const param = typeof req.params.sessionIdOrBookingId === "string" ? req.params.sessionIdOrBookingId : String(req.params.sessionIdOrBookingId || "");

  try {
    const isIdUuid = isUuid(param);
    let session: any = null;

    if (isIdUuid) {
      const [found] = await db
        .select()
        .from(tripTrackingSessionsTable)
        .where(or(eq(tripTrackingSessionsTable.id, param), eq(tripTrackingSessionsTable.bookingId, param)))
        .limit(1);
      session = found;
    } else {
      // Lookup booking by bookingId string
      const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.bookingId, param)).limit(1);
      if (booking) {
        const [found] = await db.select().from(tripTrackingSessionsTable).where(eq(tripTrackingSessionsTable.bookingId, booking.id)).limit(1);
        session = found;
      }
    }

    if (!session) {
      res.status(404).json({ status: "not_found", message: "Tracking session not found." });
      return;
    }

    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, session.bookingId)).limit(1);
    const [customer] = await db.select().from(usersTable).where(eq(usersTable.id, session.customerId)).limit(1);

    // Get recent location trail (last 20 points)
    const recentTrail = await db
      .select()
      .from(tripLocationUpdatesTable)
      .where(eq(tripLocationUpdatesTable.trackingSessionId, session.id))
      .orderBy(desc(tripLocationUpdatesTable.recordedAt))
      .limit(30);

    // Get recent events (last 15)
    const events = await db
      .select()
      .from(tripTrackingEventsTable)
      .where(eq(tripTrackingEventsTable.trackingSessionId, session.id))
      .orderBy(desc(tripTrackingEventsTable.createdAt))
      .limit(15);

    const nowMs = Date.now();
    const customerStatus = evaluateDeviceStatus(session.customerTrackingEnabled, session.lastCustomerUpdateAt, nowMs);
    const driverStatus = evaluateDeviceStatus(session.driverTrackingEnabled, session.lastDriverUpdateAt, nowMs);

    res.json({
      status: "success",
      session: {
        ...session,
        bookingRef: booking?.bookingId || session.bookingId,
        customerName: customer?.fullName,
        customerEmail: customer?.email,
        customerPhone: customer?.phone,
        customerCustomId: customer?.customerId,
        customerStatus: customerStatus.status,
        customerSecondsAgo: customerStatus.secondsAgo,
        driverStatus: driverStatus.status,
        driverSecondsAgo: driverStatus.secondsAgo,
      },
      trail: recentTrail,
      events,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to get admin live trip detail");
    res.status(500).json({ status: "error", message: "Failed to load live trip details." });
  }
});

// --------------------------------------------------------------------------
// 12. VENDOR PORTAL: GET TRACKING FOR FULFILLMENT ITEM
// --------------------------------------------------------------------------
router.get("/vendor/portal/fulfillment-tasks/:itemId/tracking", requireRole(["vendor", "admin", "operations_manager"]), async (req: Request, res: Response): Promise<void> => {
  const itemId = typeof req.params.itemId === "string" ? req.params.itemId : String(req.params.itemId || "");

  try {
    const [item] = await db
      .select()
      .from(tripFulfillmentItemsTable)
      .where(eq(tripFulfillmentItemsTable.id, itemId))
      .limit(1);

    if (!item) {
      res.status(404).json({ status: "not_found", message: "Task item not found." });
      return;
    }

    const isStaff = Boolean((req as any).admin) || req.user?.role === "admin" || req.user?.role === "operations_manager";
    if (!isStaff) {
      if (!req.user?.vendorId || item.assignedVendorId !== req.user.vendorId) {
        res.status(403).json({ status: "forbidden", message: "Not authorized to access this vendor task tracking." });
        return;
      }
    }

    const [fulfillment] = await db
      .select()
      .from(tripFulfillmentsTable)
      .where(eq(tripFulfillmentsTable.id, item.fulfillmentId))
      .limit(1);

    if (!fulfillment) {
      res.status(404).json({ status: "not_found", message: "Fulfillment record not found." });
      return;
    }

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, fulfillment.bookingId))
      .limit(1);

    if (!booking) {
      res.status(404).json({ status: "not_found", message: "Booking record not found." });
      return;
    }

    const session = await ensureTrackingSessionForBooking(booking);

    res.json({
      status: "success",
      session,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to load vendor tracking session");
    res.status(500).json({ status: "error", message: "Failed to load task tracking." });
  }
});

export default router;
