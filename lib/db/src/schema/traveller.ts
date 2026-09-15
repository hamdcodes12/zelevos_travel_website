import { createInsertSchema } from "drizzle-zod";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const travellerProfilesTable = pgTable("traveller_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull().default("Wayora traveller"),
  homeCity: text("home_city").notNull().default("Pune"),
  avatarInitials: text("avatar_initials").notNull().default("WT"),
  budgetStyle: text("budget_style").notNull().default("Value-conscious"),
  hotelStyle: text("hotel_style").notNull().default("Boutique stays"),
  travelStyle: text("travel_style").notNull().default("Slow and curious"),
  foodPreferences: jsonb("food_preferences").$type<string[]>().notNull().default([]),
  activityPreferences: jsonb("activity_preferences").$type<string[]>().notNull().default([]),
  savedDestinations: jsonb("saved_destinations").$type<string[]>().notNull().default([]),
  crowdTolerance: text("crowd_tolerance").notNull().default("Prefer quieter places"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTravellerProfileSchema = createInsertSchema(travellerProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTravellerProfile = z.infer<typeof insertTravellerProfileSchema>;
export type TravellerProfile = typeof travellerProfilesTable.$inferSelect;