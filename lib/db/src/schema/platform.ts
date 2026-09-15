import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { bookingsTable } from "./bookings";
import { adminUsersTable, usersTable } from "./auth";

export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id").references(() => bookingsTable.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  providerOrderId: text("provider_order_id"),
  providerPaymentId: text("provider_payment_id"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  requestedAmount: integer("requested_amount").notNull(),
  capturedAmount: integer("captured_amount"),
  status: text("status").notNull().default("CREATED"),
  refundStatus: text("refund_status").notNull().default("NONE"),
  refundAmount: integer("refund_amount").notNull().default(0),
  failureReason: text("failure_reason"),
  webhookEventId: text("webhook_event_id"),
  webhookEventType: text("webhook_event_type"),
  idempotencyKey: text("idempotency_key"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  userIdempotencyIdx: uniqueIndex("payment_transactions_user_idempotency_idx").on(table.userId, table.idempotencyKey),
  providerOrderIdx: uniqueIndex("payment_transactions_provider_order_idx").on(table.provider, table.providerOrderId),
  webhookEventIdx: uniqueIndex("payment_transactions_webhook_event_idx").on(table.webhookEventId),
}));

export const notificationsTable = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  actorAdminId: uuid("actor_admin_id").references(() => adminUsersTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authTokensTable = pgTable("auth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  purpose: text("purpose").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export const insertAuthTokenSchema = createInsertSchema(authTokensTable).omit({ id: true, createdAt: true });

export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type AuthToken = typeof authTokensTable.$inferSelect;
