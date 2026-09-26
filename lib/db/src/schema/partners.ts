import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
  status: text("status").notNull().default("pending"), // pending, approved, suspended
  bankDetails: jsonb("bank_details").$type<Record<string, unknown>>().notNull().default({}),
  totalBookingsCount: integer("total_bookings_count").notNull().default(0),
  totalCommissionEarned: integer("total_commission_earned").notNull().default(0),
  totalCommissionPaid: integer("total_commission_paid").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
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

export type Partner = typeof partnersTable.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Commission = typeof commissionsTable.$inferSelect;
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
