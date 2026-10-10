import { createInsertSchema } from "drizzle-zod";
import { boolean, doublePrecision, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./auth";
import { bookingsTable } from "./bookings";
import { vendorsTable } from "./vendors";
import { tripFulfillmentItemsTable } from "./operations";

export const TRACKING_SESSION_STATUSES = [
  "PENDING",
  "READY",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type TrackingSessionStatus = typeof TRACKING_SESSION_STATUSES[number];

export const ACTOR_TYPES = ["CUSTOMER", "DRIVER"] as const;
export type TrackingActorType = typeof ACTOR_TYPES[number];

export const tripTrackingSessionsTable = pgTable("trip_tracking_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookingsTable.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  driverId: uuid("driver_id").references(() => usersTable.id, { onDelete: "set null" }),
  vendorId: uuid("vendor_id").references(() => vendorsTable.id, { onDelete: "set null" }),
  fulfillmentItemId: uuid("fulfillment_item_id").references(() => tripFulfillmentItemsTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("READY"), // PENDING, READY, ACTIVE, PAUSED, COMPLETED, CANCELLED, EXPIRED
  customerTrackingEnabled: boolean("customer_tracking_enabled").notNull().default(false),
  driverTrackingEnabled: boolean("driver_tracking_enabled").notNull().default(false),

  // Chauffeur & Vehicle details snapshot (for fast non-blocking lookup)
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  vehicleRegistration: text("vehicle_registration"),
  vehicleModel: text("vehicle_model"),
  pickupLocation: text("pickup_location"),
  destinationLocation: text("destination_location"),

  // Latest Customer Coordinates
  lastCustomerLatitude: doublePrecision("last_customer_latitude"),
  lastCustomerLongitude: doublePrecision("last_customer_longitude"),
  lastCustomerAccuracy: doublePrecision("last_customer_accuracy"),
  lastCustomerUpdateAt: timestamp("last_customer_update_at", { withTimezone: true }),

  // Latest Driver Coordinates
  lastDriverLatitude: doublePrecision("last_driver_latitude"),
  lastDriverLongitude: doublePrecision("last_driver_longitude"),
  lastDriverAccuracy: doublePrecision("last_driver_accuracy"),
  lastDriverHeading: doublePrecision("last_driver_heading"),
  lastDriverSpeed: doublePrecision("last_driver_speed"),
  lastDriverUpdateAt: timestamp("last_driver_update_at", { withTimezone: true }),

  // Geospatial calculations
  calculatedDistanceKm: doublePrecision("calculated_distance_km"),
  distanceUpdatedAt: timestamp("distance_updated_at", { withTimezone: true }),

  // Safety & Emergency
  emergencyAlertActive: boolean("emergency_alert_active").notNull().default(false),
  emergencyAlertAt: timestamp("emergency_alert_at", { withTimezone: true }),
  emergencyAlertResolvedAt: timestamp("emergency_alert_resolved_at", { withTimezone: true }),
  emergencyAlertResolvedBy: text("emergency_alert_resolved_by"),
  emergencyAlertNotes: text("emergency_alert_notes"),

  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  endReason: text("end_reason"), // DRIVER_ENDED, TRIP_COMPLETED, BOOKING_CANCELLED, SESSION_EXPIRED, ADMIN_TERMINATED, AUTO_STOPPED
  endedBy: text("ended_by"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const tripLocationUpdatesTable = pgTable("trip_location_updates", {
  id: uuid("id").primaryKey().defaultRandom(),
  trackingSessionId: uuid("tracking_session_id").notNull().references(() => tripTrackingSessionsTable.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id").notNull().references(() => bookingsTable.id, { onDelete: "cascade" }),
  actorType: text("actor_type").notNull(), // 'CUSTOMER' | 'DRIVER'
  actorId: uuid("actor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  accuracy: doublePrecision("accuracy"),
  heading: doublePrecision("heading"),
  speed: doublePrecision("speed"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").notNull().default("browser_geolocation"),
});

export const tripTrackingEventsTable = pgTable("trip_tracking_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  trackingSessionId: uuid("tracking_session_id").notNull().references(() => tripTrackingSessionsTable.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id").notNull().references(() => bookingsTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  actorType: text("actor_type").notNull().default("SYSTEM"), // 'CUSTOMER' | 'DRIVER' | 'VENDOR' | 'ADMIN' | 'OPERATIONS' | 'SYSTEM'
  actorId: uuid("actor_id"),
  actorName: text("actor_name"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripTrackingSessionSchema = createInsertSchema(tripTrackingSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTripLocationUpdateSchema = createInsertSchema(tripLocationUpdatesTable).omit({
  id: true,
  receivedAt: true,
});

export const insertTripTrackingEventSchema = createInsertSchema(tripTrackingEventsTable).omit({
  id: true,
  createdAt: true,
});

export type TripTrackingSession = typeof tripTrackingSessionsTable.$inferSelect;
export type InsertTripTrackingSession = z.infer<typeof insertTripTrackingSessionSchema>;
export type TripLocationUpdate = typeof tripLocationUpdatesTable.$inferSelect;
export type InsertTripLocationUpdate = z.infer<typeof insertTripLocationUpdateSchema>;
export type TripTrackingEvent = typeof tripTrackingEventsTable.$inferSelect;
export type InsertTripTrackingEvent = z.infer<typeof insertTripTrackingEventSchema>;
