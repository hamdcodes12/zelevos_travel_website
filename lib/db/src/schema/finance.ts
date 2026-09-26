import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./auth";
import { bookingsTable } from "./bookings";

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookingsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("razorpay"), // razorpay, test
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySignature: text("razorpay_signature"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("INITIATED"), // INITIATED, SUCCESSFUL, FAILED, REFUNDED, PARTIALLY_REFUNDED
  verificationStatus: text("verification_status").notNull().default("PENDING"), // PENDING, VERIFIED, FAILED
  receiptNumber: text("receipt_number"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  providerOrderIdx: uniqueIndex("payments_provider_order_idx").on(table.provider, table.razorpayOrderId),
  providerPaymentIdx: uniqueIndex("payments_provider_payment_idx").on(table.provider, table.razorpayPaymentId),
}));

export const refundsTable = pgTable("refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookingsTable.id, { onDelete: "cascade" }),
  paymentId: uuid("payment_id").references(() => paymentsTable.id, { onDelete: "set null" }),
  requestedByUserId: uuid("requested_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("REQUESTED"), // REQUESTED, APPROVED, REJECTED, PROCESSED
  approvedByAdminId: uuid("approved_by_admin_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  gatewayRefundId: text("gateway_refund_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRefundSchema = createInsertSchema(refundsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Payment = typeof paymentsTable.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Refund = typeof refundsTable.$inferSelect;
export type InsertRefund = z.infer<typeof insertRefundSchema>;
