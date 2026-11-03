import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  serviceId: text("service_id").notNull(),
  serviceNumber: text("service_number").notNull(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  tag: text("tag").notNull(),
  description: text("description").notNull(),
  features: jsonb("features").notNull().$type<string[]>().default([]),
  popular: boolean("popular").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Plan = typeof plansTable.$inferSelect;
export type InsertPlan = typeof plansTable.$inferInsert;
