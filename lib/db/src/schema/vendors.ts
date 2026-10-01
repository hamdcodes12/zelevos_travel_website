import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const vendorsTable = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: text("vendor_id").notNull().unique(), // e.g. VND-001 or SUP-001
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  businessName: text("business_name").notNull(),
  businessType: text("business_type").default("Private Limited"),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  website: text("website"),
  hasWebsite: boolean("has_website").default(false),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country").notNull().default("India"),
  registrationNumber: text("registration_number"),
  taxId: text("tax_id"),
  description: text("description"),
  serviceCategories: jsonb("service_categories").$type<string[]>().notNull().default([]), // ['hotel', 'cab', 'bus', 'activity', 'sightseeing', 'guide', 'meals', 'tour_operator', 'other']
  operatingLocations: jsonb("operating_locations").$type<string[]>().notNull().default([]), // ['Kashmir', 'Ladakh', 'Goa']
  kycStatus: text("kyc_status").notNull().default("pending"), // pending, verified, rejected
  approvalStatus: text("approval_status").notNull().default("pending"), // pending, approved, rejected, suspended
  status: text("status").notNull().default("PENDING_APPROVAL"), // PENDING_APPROVAL, APPROVED, REJECTED, SUSPENDED, REMOVED
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  changeRequestAreas: jsonb("change_request_areas").$type<string[]>().default([]),
  changeRequestMessage: text("change_request_message"),
  onboardingStep: integer("onboarding_step").default(1),
  suspensionType: text("suspension_type").notNull().default("NONE"), // 'NONE', 'TEMPORARY', 'PERMANENT'
  suspensionReason: text("suspension_reason"),
  suspensionUntil: timestamp("suspension_until", { withTimezone: true }),
  suspendedFrom: timestamp("suspended_from", { withTimezone: true }),
  suspendedBy: text("suspended_by"),
  misbehaviorStrikes: integer("misbehavior_strikes").notNull().default(0),
  disciplinaryNotes: text("disciplinary_notes"),
  netRateTerms: text("net_rate_terms"),
  blackoutDates: jsonb("blackout_dates").$type<string[]>().notNull().default([]), // ['2026-12-25', '2026-12-31']
  temporaryPassword: text("temporary_password"),
  // Performance metrics feeding Trip Confidence Score:
  acceptanceRate: numeric("acceptance_rate").notNull().default("100"), // 0 - 100%
  avgResponseMinutes: numeric("avg_response_minutes").notNull().default("30"), // minutes vs SLA
  cancellationRate: numeric("cancellation_rate").notNull().default("0"), // 0 - 100%
  customerIssuesCount: integer("customer_issues_count").notNull().default(0),
  totalBookingsCompleted: integer("total_bookings_completed").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const supplierSuspensionsTable = pgTable("supplier_suspensions", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "cascade" }),
  suspensionType: text("suspension_type").notNull().default("TEMPORARY"), // 'TEMPORARY', 'PERMANENT'
  reason: text("reason").notNull(),
  notes: text("notes"),
  suspendedFrom: timestamp("suspended_from", { withTimezone: true }).notNull().defaultNow(),
  suspendedUntil: timestamp("suspended_until", { withTimezone: true }),
  suspendedBy: text("suspended_by"),
  liftedAt: timestamp("lifted_at", { withTimezone: true }),
  liftedBy: text("lifted_by"),
  liftReason: text("lift_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vendorDocumentsTable = pgTable("vendor_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(), // business_registration, gst_vat, license, id_verification, service_document, contract_agreement, other
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size").default(0),
  mimeType: text("mime_type").default("application/pdf"),
  status: text("status").notNull().default("pending"), // pending, verified, rejected
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const vendorServicesTable = pgTable("vendor_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "cascade" }),
  serviceType: text("service_type").notNull(), // hotel, cab, bus, activity, sightseeing, guide, meals, tour_operator, other
  title: text("title").notNull(),
  location: text("location").notNull(),
  rate: integer("rate").notNull().default(0), // Net cost in INR
  capacity: integer("capacity").notNull().default(1),
  availability: text("availability").notNull().default("Available"), // Available, Unavailable, On Request
  description: text("description"),
  details: jsonb("details").$type<Record<string, any>>().notNull().default({}),
  status: text("status").notNull().default("active"), // active, inactive, draft
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const vendorInvoicesTable = pgTable("vendor_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id"),
  bookingServiceId: uuid("booking_service_id"),
  invoiceNumber: text("invoice_number").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("submitted"), // submitted, approved, paid, disputed
  documentUrl: text("document_url"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVendorSchema = createInsertSchema(vendorsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorDocumentSchema = createInsertSchema(vendorDocumentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorServiceSchema = createInsertSchema(vendorServicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorInvoiceSchema = createInsertSchema(vendorInvoicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupplierSuspensionSchema = createInsertSchema(supplierSuspensionsTable).omit({
  id: true,
  createdAt: true,
});

export type Vendor = typeof vendorsTable.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type SupplierSuspension = typeof supplierSuspensionsTable.$inferSelect;
export type InsertSupplierSuspension = z.infer<typeof insertSupplierSuspensionSchema>;
export type VendorDocument = typeof vendorDocumentsTable.$inferSelect;
export type InsertVendorDocument = z.infer<typeof insertVendorDocumentSchema>;
export type VendorService = typeof vendorServicesTable.$inferSelect;
export type InsertVendorService = z.infer<typeof insertVendorServiceSchema>;
export type VendorInvoice = typeof vendorInvoicesTable.$inferSelect;
export type InsertVendorInvoice = z.infer<typeof insertVendorInvoiceSchema>;

