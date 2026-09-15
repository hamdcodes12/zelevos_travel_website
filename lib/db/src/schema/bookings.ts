import { createInsertSchema } from "drizzle-zod";
import { jsonb, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const bookingsTable = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("SEARCHED"),
  providerMode: text("provider_mode").notNull().default("DEMO"),
  providerReference: text("provider_reference").notNull(),
  bookingReference: text("booking_reference").notNull(),
  pnr: text("pnr"),
  ticketNumber: text("ticket_number"),
  flightOfferId: text("flight_offer_id"),
  amount: integer("amount").notNull(),
  fareSnapshot: jsonb("fare_snapshot").$type<Record<string, unknown>>(),
  passengers: jsonb("passengers").$type<unknown[]>(),
  contact: jsonb("contact").$type<Record<string, unknown>>(),
  segments: jsonb("segments").$type<unknown[]>(),
  addons: jsonb("addons").$type<Record<string, unknown>>(),
  paymentId: text("payment_id"),
  paymentOrderId: text("payment_order_id"),
  paymentStatus: text("payment_status"),
  idempotencyKey: text("idempotency_key"),
  cancellationDetails: jsonb("cancellation_details").$type<Record<string, unknown>>(),
  refundAmount: integer("refund_amount"),
  emailStatus: text("email_status").notNull().default("NOT_SENT"),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  emailError: text("email_error"),
  clientEmail: text("client_email"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  ownerIdempotencyIdx: uniqueIndex("bookings_owner_idempotency_idx").on(table.ownerId, table.idempotencyKey),
}));

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;