import { EventEmitter } from "node:events";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  tripTrackingSessionsTable,
  tripLocationUpdatesTable,
  tripTrackingEventsTable,
  adminNotificationsTable,
  notificationsTable,
  auditLogsTable,
  bookingsTable,
  usersTable,
  type TripTrackingSession,
  type TripLocationUpdate,
} from "@workspace/db";
import { logger } from "../lib/logger";

// ============================================================================
// CENTRAL CONFIGURATION (Section 15: Configurable update & status intervals)
// ============================================================================
export const TRACKING_CONFIG = {
  LOCATION_UPDATE_INTERVAL_MS: 5000, // 5s recommended client send rate
  HEARTBEAT_INTERVAL_MS: 15000, // 15s heartbeat
  STALE_THRESHOLD_MS: 60000, // 60s -> STALE
  OFFLINE_THRESHOLD_MS: 120000, // 120s -> OFFLINE
  LARGE_DISTANCE_ALERT_KM: 50, // 50 km distance threshold
  MAX_VALID_ACCURACY_METERS: 1000, // Reject or flag > 1km accuracy
  COORDINATE_BOUNDS: {
    MIN_LAT: -90,
    MAX_LAT: 90,
    MIN_LON: -180,
    MAX_LON: 180,
  },
};

// ============================================================================
// HAVERSINE DISTANCE CALCULATION (Section 17: Real Geographic Distance)
// ============================================================================
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number" ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    throw new Error("Invalid coordinates provided to Haversine calculation.");
  }

  const R = 6371; // Earth's mean radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Round to 2 decimal places (e.g. 2.45 km)
  return Math.round(distance * 100) / 100;
}

// ============================================================================
// STATUS DETERMINATION (Section 16: LIVE / STALE / OFFLINE)
// ============================================================================
export type DeviceTrackingStatus = "LIVE" | "STALE" | "OFFLINE" | "DISABLED";

export function evaluateDeviceStatus(
  isEnabled: boolean,
  lastUpdateAt: Date | string | null | undefined,
  nowMs: number = Date.now()
): { status: DeviceTrackingStatus; secondsAgo: number | null } {
  if (!isEnabled || !lastUpdateAt) {
    return { status: "DISABLED", secondsAgo: null };
  }

  const updateMs = new Date(lastUpdateAt).getTime();
  if (isNaN(updateMs)) {
    return { status: "DISABLED", secondsAgo: null };
  }

  const diffMs = Math.max(0, nowMs - updateMs);
  const secondsAgo = Math.floor(diffMs / 1000);

  if (diffMs > TRACKING_CONFIG.OFFLINE_THRESHOLD_MS) {
    return { status: "OFFLINE", secondsAgo };
  }
  if (diffMs > TRACKING_CONFIG.STALE_THRESHOLD_MS) {
    return { status: "STALE", secondsAgo };
  }
  return { status: "LIVE", secondsAgo };
}

// ============================================================================
// REALTIME SESSION BROADCASTER (Scoped to session ID, SSE / Realtime channel)
// ============================================================================
class TrackingRealtimeBroadcaster {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(2000);
  }

  subscribe(sessionId: string, listener: (data: any) => void): () => void {
    const channel = `session:${sessionId}`;
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  broadcast(sessionId: string, event: string, payload: any): void {
    const channel = `session:${sessionId}`;
    this.emitter.emit(channel, {
      event,
      payload,
      timestamp: new Date().toISOString(),
    });
  }
}

export const realtimeBroadcaster = new TrackingRealtimeBroadcaster();

// ============================================================================
// TRACKING AUDIT & EVENT LOGGING (Section 14: Tracking Events / Audit)
// ============================================================================
export async function logTrackingEvent(params: {
  trackingSessionId: string;
  bookingId: string;
  eventType: string;
  actorType: "CUSTOMER" | "DRIVER" | "VENDOR" | "ADMIN" | "OPERATIONS" | "SYSTEM";
  actorId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(tripTrackingEventsTable).values({
      trackingSessionId: params.trackingSessionId,
      bookingId: params.bookingId,
      eventType: params.eventType,
      actorType: params.actorType,
      actorId: params.actorId || null,
      actorName: params.actorName || null,
      metadata: params.metadata || {},
    });

    // Also register in main platform audit log for unified compliance audit
    await db.insert(auditLogsTable).values({
      actorUserId: params.actorType === "CUSTOMER" || params.actorType === "DRIVER" ? (params.actorId || null) : null,
      actorAdminId: params.actorType === "ADMIN" || params.actorType === "OPERATIONS" ? (params.actorId || null) : null,
      actorName: params.actorName || params.actorType,
      actorRole: params.actorType.toLowerCase(),
      action: params.eventType,
      resourceType: "trip_tracking_session",
      resourceId: params.trackingSessionId,
      metadata: {
        bookingId: params.bookingId,
        ...(params.metadata || {}),
      },
    });
  } catch (error) {
    logger.warn({ err: error, params }, "[Tracking Audit Log Warning] Failed to persist tracking event");
  }
}

// ============================================================================
// AUTO-STOP ENFORCEMENT (Section 30: Server-Enforced Auto-Stop)
// ============================================================================
export async function stopTrackingSession(
  sessionId: string,
  reason: "TRIP_COMPLETED" | "DRIVER_ENDED" | "BOOKING_CANCELLED" | "SESSION_EXPIRED" | "ADMIN_TERMINATED" | "AUTO_STOPPED",
  endedBy: string
): Promise<TripTrackingSession | null> {
  const [existing] = await db
    .select()
    .from(tripTrackingSessionsTable)
    .where(eq(tripTrackingSessionsTable.id, sessionId))
    .limit(1);

  if (!existing || existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    return existing || null;
  }

  const [updated] = await db
    .update(tripTrackingSessionsTable)
    .set({
      status: reason === "BOOKING_CANCELLED" ? "CANCELLED" : "COMPLETED",
      customerTrackingEnabled: false,
      driverTrackingEnabled: false,
      endedAt: new Date(),
      endReason: reason,
      endedBy,
      updatedAt: new Date(),
    })
    .where(eq(tripTrackingSessionsTable.id, sessionId))
    .returning();

  await logTrackingEvent({
    trackingSessionId: sessionId,
    bookingId: updated.bookingId,
    eventType: reason,
    actorType: "SYSTEM",
    actorName: endedBy,
    metadata: { reason, endedBy },
  });

  // Notify customer
  try {
    await db.insert(notificationsTable).values({
      userId: updated.customerId,
      type: "TRACKING_ENDED",
      category: "BOOKING",
      title: "Trip Tracking Concluded",
      body: "Live GPS tracking for your trip has ended.",
      channel: "in_app",
      status: "SENT",
      bookingId: updated.bookingId,
    });
  } catch {}

  // Broadcast realtime event
  realtimeBroadcaster.broadcast(sessionId, "session_ended", {
    status: updated.status,
    reason,
    endedBy,
    endedAt: updated.endedAt,
  });

  return updated;
}
