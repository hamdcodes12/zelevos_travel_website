import { pgTable, text, integer, numeric, boolean, timestamp, jsonb, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bpoPartnerAgreementsTable = pgTable("bpo_partner_agreements", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  agreementCode: text("agreement_code").notNull().unique(),
  partnerId: text("partner_id"),
  applicationId: bigint("application_id", { mode: "number" }),
  centreId: text("centre_id"),
  version: text("version").notNull().default("1.0"),
  status: text("status").notNull().default("agreement_ready"),
  
  partnerLegalName: text("partner_legal_name").notNull(),
  partnerTradeName: text("partner_trade_name"),
  registrationNumber: text("registration_number"),
  registeredAddress: text("registered_address"),
  authorizedSignatoryName: text("authorized_signatory_name"),
  authorizedSignatoryDesignation: text("authorized_signatory_designation"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),

  thinkaticLegalEntity: text("thinkatic_legal_entity").notNull().default("Healweal LLC"),
  thinkaticSignatoryName: text("thinkatic_signatory_name").notNull().default("Harshad Chavandke"),
  thinkaticSignatoryDesignation: text("thinkatic_signatory_designation").notNull().default("Director"),

  termMonths: integer("term_months").notNull().default(11),
  royaltyPercentage: numeric("royalty_percentage", { precision: 5, scale: 2 }).notNull().default("25.00"),

  signedDocumentUrl: text("signed_document_url"),
  signedDocumentFileName: text("signed_document_file_name"),
  signedDocumentFileSize: integer("signed_document_file_size"),
  signedSubmittedAt: timestamp("signed_submitted_at"),
  signedSubmittedBy: text("signed_submitted_by"),

  approvedAt: timestamp("approved_at"),
  approvedByAdminId: bigint("approved_by_admin_id", { mode: "number" }),
  approvedByAdminName: text("approved_by_admin_name"),
  rejectionReason: text("rejection_reason"),
  rejectedAt: timestamp("rejected_at"),
  rejectedByAdminId: bigint("rejected_by_admin_id", { mode: "number" }),

  isImmutable: boolean("is_immutable").notNull().default(false),
  templateData: jsonb("template_data").notNull().default({}),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bpoAgreementSubmissionsTable = pgTable("bpo_agreement_submissions", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  agreementId: bigint("agreement_id", { mode: "number" }).notNull(),
  submissionNumber: integer("submission_number").notNull().default(1),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("pending_review"),
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  submittedBy: text("submitted_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedByAdminId: bigint("reviewed_by_admin_id", { mode: "number" }),
});

export const insertBpoPartnerAgreementSchema = createInsertSchema(bpoPartnerAgreementsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBpoPartnerAgreement = z.infer<typeof insertBpoPartnerAgreementSchema>;
export type BpoPartnerAgreement = typeof bpoPartnerAgreementsTable.$inferSelect;
export type BpoAgreementSubmission = typeof bpoAgreementSubmissionsTable.$inferSelect;
