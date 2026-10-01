import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { adminUsersTable, usersTable } from "./auth";

export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id"),
  provider: text("provider").notNull().default("razorpay"),
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

export const broadcastsTable = pgTable("broadcasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  category: text("category").notNull().default("ANNOUNCEMENT"), // ANNOUNCEMENT, OFFER, ALERT, UPDATE, POLICY
  imageUrl: text("image_url"),
  actionButton: text("action_button"),
  actionUrl: text("action_url"),
  targetAudience: text("target_audience").notNull().default("ALL_CUSTOMERS"), // ALL_CUSTOMERS, SPECIFIC_USER, UPCOMING_TRIPS, PAST_BOOKINGS, PAYMENT_PENDING
  targetUserId: uuid("target_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  targetCustomerId: text("target_customer_id"),
  priority: text("priority").notNull().default("NORMAL"), // LOW, NORMAL, HIGH, URGENT
  status: text("status").notNull().default("SENT"), // DRAFT, SCHEDULED, SENT, CANCELLED, EXPIRED, REVOKED
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedByAdminId: uuid("revoked_by_admin_id").references(() => adminUsersTable.id, { onDelete: "set null" }),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedByAdminId: uuid("archived_by_admin_id").references(() => adminUsersTable.id, { onDelete: "set null" }),
  totalRecipients: integer("total_recipients").notNull().default(0),
  readCount: integer("read_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  createdByAdminId: uuid("created_by_admin_id").references(() => adminUsersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const notificationsTable = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  recipientEmail: text("recipient_email"),
  type: text("type").notNull(), // Section 17 notification events or ANNOUNCEMENT, OFFER, etc.
  category: text("category").notNull().default("ANNOUNCEMENT"), // ANNOUNCEMENT, OFFER, PAYMENT, BOOKING, SUPPORT, IMPORTANT
  title: text("title").notNull(),
  body: text("body").notNull(),
  channel: text("channel").notNull().default("email"), // email, in_app, sms, whatsapp
  status: text("status").notNull().default("SENT"), // SENT, DELIVERED, FAILED, COMING_SOON
  bookingId: uuid("booking_id"),
  broadcastId: uuid("broadcast_id").references(() => broadcastsTable.id, { onDelete: "set null" }),
  ticketId: uuid("ticket_id"),
  imageUrl: text("image_url"),
  actionButton: text("action_button"),
  actionUrl: text("action_url"),
  isCleared: boolean("is_cleared").notNull().default(false),
  clearedAt: timestamp("cleared_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  clickedAt: timestamp("clicked_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminNotificationsTable = pgTable("admin_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(), // SUPPORT_TICKET, SUPPORT_REPLY, SUPPLIER_APPLICATION, BOOKING, PAYMENT
  module: text("module").notNull(), // support, suppliers, bookings, payments, operations
  relatedId: text("related_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("NORMAL"), // NORMAL, HIGH, URGENT
  actionRequired: boolean("action_required").notNull().default(false),
  actionUrl: text("action_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminNotificationReadsTable = pgTable("admin_notification_reads", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => adminUsersTable.id, { onDelete: "cascade" }),
  notificationId: uuid("notification_id").notNull().references(() => adminNotificationsTable.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
});

export const broadcastRecipientsTable = pgTable("broadcast_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  broadcastId: uuid("broadcast_id").notNull().references(() => broadcastsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  notificationId: uuid("notification_id").references(() => notificationsTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("DELIVERED"), // DELIVERED, READ, CLICKED
  readAt: timestamp("read_at", { withTimezone: true }),
  clickedAt: timestamp("clicked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  actorAdminId: uuid("actor_admin_id").references(() => adminUsersTable.id, { onDelete: "set null" }),
  actorName: text("actor_name"),
  actorRole: text("actor_role").notNull().default("customer"),
  action: text("action").notNull(), // e.g. 'BOOKING_STATE_CHANGE', 'TASK_ASSIGNED', 'PAYMENT_CAPTURED'
  resourceType: text("resource_type").notNull(), // 'booking', 'booking_service', 'payment', 'refund', 'vendor'
  resourceId: text("resource_id"),
  previousValue: jsonb("previous_value").$type<Record<string, unknown> | null>(),
  newValue: jsonb("new_value").$type<Record<string, unknown> | null>(),
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
  attemptCount: integer("attempt_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBroadcastSchema = createInsertSchema(broadcastsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export const insertAdminNotificationSchema = createInsertSchema(adminNotificationsTable).omit({ id: true, createdAt: true });
export const insertAdminNotificationReadSchema = createInsertSchema(adminNotificationReadsTable).omit({ id: true });
export const insertBroadcastRecipientSchema = createInsertSchema(broadcastRecipientsTable).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export const insertAuthTokenSchema = createInsertSchema(authTokensTable).omit({ id: true, createdAt: true });

export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type Broadcast = typeof broadcastsTable.$inferSelect;
export type InsertBroadcast = z.infer<typeof insertBroadcastSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type AdminNotification = typeof adminNotificationsTable.$inferSelect;
export type InsertAdminNotification = z.infer<typeof insertAdminNotificationSchema>;
export type AdminNotificationRead = typeof adminNotificationReadsTable.$inferSelect;
export type InsertAdminNotificationRead = z.infer<typeof insertAdminNotificationReadSchema>;
export type BroadcastRecipient = typeof broadcastRecipientsTable.$inferSelect;
export type InsertBroadcastRecipient = z.infer<typeof insertBroadcastRecipientSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type AuthToken = typeof authTokensTable.$inferSelect;

