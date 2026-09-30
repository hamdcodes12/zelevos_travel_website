import { createInsertSchema } from "drizzle-zod";
import {
  jsonb,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const generatedTripsTable = pgTable("generated_trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  destination: text("destination").notNull(),
  dates: text("dates").notNull(),
  durationDays: integer("duration_days").notNull(),
  travellers: integer("travellers").notNull(),
  budget: text("budget").notNull(),
  preferences: jsonb("preferences").$type<string[]>().notNull().default([]),
  itinerary: jsonb("itinerary").$type<unknown[]>().notNull().default([]),
  estimatedCosts: jsonb("estimated_costs").$type<Record<string, unknown>>().notNull().default({}),
  transportInfo: jsonb("transport_info").$type<Record<string, unknown> | null>(),
  hotelInfo: jsonb("hotel_info").$type<Record<string, unknown> | null>(),
  reasoning: text("reasoning").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGeneratedTripSchema = createInsertSchema(generatedTripsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGeneratedTrip = z.infer<typeof insertGeneratedTripSchema>;
export type GeneratedTrip = typeof generatedTripsTable.$inferSelect;