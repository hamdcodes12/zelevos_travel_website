import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./auth";
import { bookingsTable } from "./bookings";

export const supportTicketsTable = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketNumber: text("ticket_number").notNull().unique(), // e.g. TKT-001
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  bookingId: uuid("booking_id").references(() => bookingsTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull().default("MEDIUM"), // LOW, MEDIUM, HIGH, URGENT
  status: text("status").notNull().default("OPEN"), // OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED
  assignedTo: text("assigned_to"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Section 21: Custom Trip Request ("Build My Trip")
export const customTripRequestsTable = pgTable("custom_trip_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadNumber: text("lead_number").notNull().unique(), // e.g. LEAD-260918-001
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  destinations: jsonb("destinations").$type<string[]>().notNull().default([]), // ['Kashmir', 'Ladakh']
  datesFlexible: boolean("dates_flexible").notNull().default(false),
  startDate: text("start_date"),
  endDate: text("end_date"),
  durationDays: integer("duration_days"),
  travellersCount: integer("travellers_count").notNull().default(2),
  budgetPerPerson: integer("budget_per_person"),
  totalBudget: integer("total_budget"),
  hotelPreference: text("hotel_preference").default("4 Star / Boutique"),
  transportPreference: text("transport_preference").default("Private Cab"),
  activitiesInterests: jsonb("activities_interests").$type<string[]>().notNull().default([]),
  specialRequests: text("special_requests"),
  // Proposal generation (Section 21 ops workflow)
  proposalPackageId: uuid("proposal_package_id"),
  proposalTitle: text("proposal_title"),
  proposalAmount: integer("proposal_amount"),
  proposalPaymentLink: text("proposal_payment_link"),
  proposalItinerary: jsonb("proposal_itinerary").$type<Array<{
    day: number;
    date?: string;
    location: string;
    activity: string;
    meal?: string;
    description: string;
  }>>().notNull().default([]),
  proposalNotes: text("proposal_notes"),
  customerAcceptedAt: timestamp("customer_accepted_at", { withTimezone: true }),
  bookingId: uuid("booking_id").references(() => bookingsTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("NEW"), // NEW, IN_REVIEW, PROPOSAL_SENT, BOOKED, LOST
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Gap 5: Admin-Configurable Operational SLA Settings (Section 22)
export const slaSettingsTable = pgTable("sla_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  settingKey: text("setting_key").notNull().unique(), // e.g. 'standard_supplier_response'
  displayName: text("display_name").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  operatingHoursOnly: boolean("operating_hours_only").notNull().default(false),
  description: text("description"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSupportTicketSchema = createInsertSchema(supportTicketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomTripRequestSchema = createInsertSchema(customTripRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSlaSettingSchema = createInsertSchema(slaSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type CustomTripRequest = typeof customTripRequestsTable.$inferSelect;
export type InsertCustomTripRequest = z.infer<typeof insertCustomTripRequestSchema>;
export type SlaSetting = typeof slaSettingsTable.$inferSelect;
export type InsertSlaSetting = z.infer<typeof insertSlaSettingSchema>;
