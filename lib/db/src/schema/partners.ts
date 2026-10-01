import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const partnersTable = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  partnerId: text("partner_id").notNull().unique(), // e.g. PRT-001
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  agencyName: text("agency_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  referralCode: text("referral_code").notNull().unique(), // e.g. ZELPARTNER10
  commissionRatePercent: numeric("commission_rate_percent").notNull().default("5.0"), // e.g. 5%
  status: text("status").notNull().default("pending"), // pending, approved, rejected, suspended, banned, removed
  rejectionReason: text("rejection_reason"),
  banReason: text("ban_reason"),
  suspendedFrom: timestamp("suspended_from", { withTimezone: true }),
  suspensionUntil: timestamp("suspension_until", { withTimezone: true }),
  suspensionReason: text("suspension_reason"),
  suspendedBy: text("suspended_by"),
  bankDetails: jsonb("bank_details").$type<Record<string, unknown>>().notNull().default({}),
  passwordHash: text("password_hash"),
  totalBookingsCount: integer("total_bookings_count").notNull().default(0),
  totalCommissionEarned: integer("total_commission_earned").notNull().default(0),
  totalCommissionPaid: integer("total_commission_paid").notNull().default(0),
  // Discount configuration (Task 18)
  discountType: text("discount_type").notNull().default("percent"), // 'percent' | 'flat'
  discountValue: numeric("discount_value").notNull().default("5.0"),
  discountMaxCap: integer("discount_max_cap"),
  discountFirstBookingOnly: boolean("discount_first_booking_only").notNull().default(false),
  discountEnabled: boolean("discount_enabled").notNull().default(true),
  // Archival fields (Task 2)
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const partnerSuspensionsTable = pgTable("partner_suspensions", {
  id: uuid("id").primaryKey().defaultRandom(),
  partnerId: uuid("partner_id").notNull().references(() => partnersTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'SUSPEND', 'BAN', 'REJECT', 'REMOVE'
  reason: text("reason").notNull(),
  notes: text("notes"),
  suspendedFrom: timestamp("suspended_from", { withTimezone: true }).notNull().defaultNow(),
  suspendedUntil: timestamp("suspended_until", { withTimezone: true }),
  performedBy: text("performed_by"),
  liftedAt: timestamp("lifted_at", { withTimezone: true }),
  liftedBy: text("lifted_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const partnerSessionsTable = pgTable("partner_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  partnerId: uuid("partner_id").notNull().references(() => partnersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commissionsTable = pgTable("commissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  partnerId: uuid("partner_id").notNull().references(() => partnersTable.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id").notNull(),
  bookingAmount: integer("booking_amount").notNull(),
  commissionPercent: numeric("commission_percent").notNull(),
  commissionAmount: integer("commission_amount").notNull(),
  status: text("status").notNull().default("pending"), // pending, eligible, paid, cancelled
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPartnerSchema = createInsertSchema(partnersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionSchema = createInsertSchema(commissionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartnerSessionSchema = createInsertSchema(partnerSessionsTable).omit({
  id: true,
  createdAt: true,
});

export const insertPartnerSuspensionSchema = createInsertSchema(partnerSuspensionsTable).omit({
  id: true,
  createdAt: true,
});

export type Partner = typeof partnersTable.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type PartnerSuspension = typeof partnerSuspensionsTable.$inferSelect;
export type InsertPartnerSuspension = z.infer<typeof insertPartnerSuspensionSchema>;
export type PartnerSession = typeof partnerSessionsTable.$inferSelect;
export type Commission = typeof commissionsTable.$inferSelect;
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
