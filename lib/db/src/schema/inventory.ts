import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const destinationsTable = pgTable("destinations", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // e.g. 'kashmir', 'ladakh', 'kerala'
  name: text("name").notNull(),
  country: text("country").notNull().default("India"),
  state: text("state").notNull(),
  city: text("city"),
  overview: text("overview").notNull(),
  bestTravelPeriod: text("best_travel_period").notNull(),
  heroImage: text("hero_image").notNull(),
  gallery: jsonb("gallery").$type<string[]>().notNull().default([]),
  highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
  faqs: jsonb("faqs").$type<Array<{ question: string; answer: string }>>().notNull().default([]),
  status: text("status").notNull().default("active"), // active, draft, archived
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const packagesTable = pgTable("packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: text("package_id").notNull().unique(), // e.g. ZEL-KASH-001
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  destinationId: uuid("destination_id").notNull().references(() => destinationsTable.id, { onDelete: "cascade" }),
  locations: jsonb("locations").$type<string[]>().notNull().default([]), // ['Srinagar', 'Gulmarg', 'Pahalgam']
  durationDays: integer("duration_days").notNull(),
  durationNights: integer("duration_nights").notNull(),
  theme: text("theme").notNull(), // honeymoon, family, adventure, luxury, budget, weekend, pilgrimage
  travellerSuitability: text("traveller_suitability").default("Suitable for families, couples and small groups"),
  baseCost: integer("base_cost").notNull(), // Total supplier cost in INR
  sellingPrice: integer("selling_price").notNull(), // Retail price in INR
  markupType: text("markup_type").notNull().default("fixed"), // fixed, percentage
  markupValue: numeric("markup_value").notNull().default("0"),
  serviceFee: integer("service_fee").notNull().default(0),
  inventory: integer("inventory").notNull().default(10), // Sellable slots
  inclusions: jsonb("inclusions").$type<string[]>().notNull().default([]),
  exclusions: jsonb("exclusions").$type<string[]>().notNull().default([]),
  policies: jsonb("policies").$type<{
    cancellation: string;
    modification: string;
    child: string;
    payment: string;
  }>().notNull().default({
    cancellation: "Free cancellation up to 7 days before departure.",
    modification: "One free date modification allowed up to 48 hours before departure.",
    child: "Children below 5 years complimentary without extra bed.",
    payment: "100% advance payment required for confirmed booking.",
  }),
  media: jsonb("media").$type<{ heroImage: string; gallery: string[] }>().notNull().default({
    heroImage: "/kashmir-dawn.jpg",
    gallery: ["/kashmir-dawn.jpg", "/ladakh-road.jpg"],
  }),
  status: text("status").notNull().default("active"), // draft, active, paused, archived
  assignedVendorIds: jsonb("assigned_vendor_ids").$type<string[]>().notNull().default([]),
  featured: boolean("featured").notNull().default(false),
  isMembersOnly: boolean("is_members_only").notNull().default(false),
  offerExpiresAt: timestamp("offer_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const packageDaysTable = pgTable("package_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id").notNull().references(() => packagesTable.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  timings: text("timings"),
  activitiesDescription: text("activities_description"),
  mealsIncluded: text("meals_included").default("Breakfast"),
  hotelDetails: text("hotel_details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const servicesTable = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id").references(() => packagesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  serviceType: text("service_type").notNull(), // hotel, transfer, activity, guide, sightseeing, meals
  baseCost: integer("base_cost").notNull().default(0),
  sellingPrice: integer("selling_price").notNull().default(0),
  vendorId: uuid("vendor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Gap 1: Dedicated Hotels Table
export const hotelsTable = pgTable("hotels", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id").references(() => servicesTable.id, { onDelete: "cascade" }),
  packageId: uuid("package_id").references(() => packagesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  starRating: numeric("star_rating").notNull().default("4.0"),
  roomType: text("room_type").notNull().default("Deluxe Room"),
  mealPlan: text("meal_plan").notNull().default("CP (Breakfast Included)"),
  address: text("address").notNull(),
  city: text("city").notNull(),
  checkinTime: text("checkin_time").default("14:00"),
  checkoutTime: text("checkout_time").default("11:00"),
  amenities: jsonb("amenities").$type<string[]>().notNull().default([]),
  baseCostPerNight: integer("base_cost_per_night").notNull().default(0),
  sellingPricePerNight: integer("selling_price_per_night").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Gap 1: Dedicated Transfers Table
export const transfersTable = pgTable("transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id").references(() => servicesTable.id, { onDelete: "cascade" }),
  packageId: uuid("package_id").references(() => packagesTable.id, { onDelete: "cascade" }),
  transferType: text("transfer_type").notNull().default("private"), // private, shared, airport, intercity
  vehicleType: text("vehicle_type").notNull().default("Sedan"), // Sedan, SUV, Innova, Tempo Traveller
  pickupLocation: text("pickup_location").notNull(),
  dropLocation: text("drop_location").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  luggageCapacity: text("luggage_capacity").default("2 Large Bags"),
  inclusions: jsonb("inclusions").$type<string[]>().notNull().default([]),
  baseCost: integer("base_cost").notNull().default(0),
  sellingPrice: integer("selling_price").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Gap 1: Dedicated Activities Table
export const activitiesTable = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id").references(() => servicesTable.id, { onDelete: "cascade" }),
  packageId: uuid("package_id").references(() => packagesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  durationHours: numeric("duration_hours").notNull().default("2.0"),
  difficultyLevel: text("difficulty_level").default("Easy"), // Easy, Moderate, Strenuous
  ageSuitability: text("age_suitability").default("All ages"),
  meetingPoint: text("meeting_point").notNull(),
  inclusions: jsonb("inclusions").$type<string[]>().notNull().default([]),
  exclusions: jsonb("exclusions").$type<string[]>().notNull().default([]),
  scheduleNotes: text("schedule_notes"),
  baseCost: integer("base_cost").notNull().default(0),
  sellingPrice: integer("selling_price").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDestinationSchema = createInsertSchema(destinationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPackageSchema = createInsertSchema(packagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPackageDaySchema = createInsertSchema(packageDaysTable).omit({ id: true, createdAt: true });
export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true, createdAt: true });
export const insertHotelSchema = createInsertSchema(hotelsTable).omit({ id: true, createdAt: true });
export const insertTransferSchema = createInsertSchema(transfersTable).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true });

export type Destination = typeof destinationsTable.$inferSelect;
export type Package = typeof packagesTable.$inferSelect;
export type PackageDay = typeof packageDaysTable.$inferSelect;
export type Service = typeof servicesTable.$inferSelect;
export type Hotel = typeof hotelsTable.$inferSelect;
export type Transfer = typeof transfersTable.$inferSelect;
export type Activity = typeof activitiesTable.$inferSelect;
