import { pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const clientUpdatesTable = pgTable("client_updates", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  category: text("category"),
  status: text("status").notNull().default("draft"),
  createdBy: text("created_by").notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ClientUpdate = typeof clientUpdatesTable.$inferSelect;
export type InsertClientUpdate = typeof clientUpdatesTable.$inferInsert;
