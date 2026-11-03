import { pgTable, text, integer, numeric, timestamp, jsonb, bigint, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bpoCentreVerificationTable = pgTable("bpo_centre_verification", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  partnerId: uuid("partner_id"),
  applicationId: bigint("application_id", { mode: "number" }),
  centreId: text("centre_id"),
  applicantUserId: text("applicant_user_id").notNull(),

  // Office Attributes
  officeName: text("office_name").notNull(),
  addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull().default("India"),
  postalCode: text("postal_code").notNull(),
  landmark: text("landmark"),
  contactNumber: text("contact_number").notNull(),
  centreType: text("centre_type").notNull().default("Dedicated BPO Facility"),
  ownershipType: text("ownership_type").notNull().default("Commercial Lease"),
  operatingSince: text("operating_since").notNull(),
  totalAreaSqft: numeric("total_area_sqft", { precision: 10, scale: 2 }),
  numberOfFloors: integer("number_of_floors").default(1),

  // Lifecycle
  status: text("status").notNull().default("NOT_STARTED"),
  submittedAt: timestamp("submitted_at"),
  submissionCount: integer("submission_count").notNull().default(0),

  // Human Review
  reviewedAt: timestamp("reviewed_at"),
  reviewedByAdminId: bigint("reviewed_by_admin_id", { mode: "number" }),
  reviewedByAdminName: text("reviewed_by_admin_name"),
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bpoCentreMediaTable = pgTable("bpo_centre_media", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  verificationId: bigint("verification_id", { mode: "number" }).notNull(),
  partnerId: uuid("partner_id"),
  applicantUserId: text("applicant_user_id").notNull(),
  centreId: text("centre_id"),

  mediaType: text("media_type").notNull(), // 'photo' | 'video'
  category: text("category").notNull(),
  storageKey: text("storage_key").notNull(),
  originalFileName: text("original_file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  durationSeconds: integer("duration_seconds"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  status: text("status").notNull().default("active"),
});

export const bpoCentreVerificationHistoryTable = pgTable("bpo_centre_verification_history", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  verificationId: bigint("verification_id", { mode: "number" }).notNull(),
  submissionRound: integer("submission_round").notNull().default(1),
  action: text("action").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  actorId: text("actor_id").notNull(),
  actorRole: text("actor_role").notNull().default("partner"),
  actorName: text("actor_name"),
  notes: text("notes"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBpoCentreVerificationSchema = createInsertSchema(bpoCentreVerificationTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBpoCentreMediaSchema = createInsertSchema(bpoCentreMediaTable).omit({
  id: true,
  uploadedAt: true,
});

export type InsertBpoCentreVerification = z.infer<typeof insertBpoCentreVerificationSchema>;
export type BpoCentreVerification = typeof bpoCentreVerificationTable.$inferSelect;
export type BpoCentreMedia = typeof bpoCentreMediaTable.$inferSelect;
export type BpoCentreVerificationHistory = typeof bpoCentreVerificationHistoryTable.$inferSelect;
