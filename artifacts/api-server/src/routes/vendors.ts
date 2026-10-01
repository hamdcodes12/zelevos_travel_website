import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  vendorsTable,
  vendorDocumentsTable,
  vendorServicesTable,
  vendorInvoicesTable,
  bookingServicesTable,
  bookingsTable,
  usersTable,
  auditLogsTable,
  notificationsTable,
  supplierSuspensionsTable,
} from "@workspace/db";
import { requireRole, requireVendorScope } from "../middlewares/rbac";
import { requireAuthOrAdmin } from "../middlewares/authMiddleware";
import { logAuditAction } from "../services/booking-engine";
import { createSession, generateNextVendorId, hashPassword, publicUser, verifyPassword } from "../lib/auth";
import { generateSignedDocumentToken } from "../services/document-service";

const router: IRouter = Router();

// Helper to check if a string is a valid UUID
function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// --------------------------------------------------------------------------
// Supplier credential helpers (passwords are stored hashed only; nothing here ever returns a secret)
// --------------------------------------------------------------------------
const PASSWORD_HASH_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{128}$/;
// Verifying against a throw-away hash keeps "unknown application" and "wrong password" indistinguishable
const DUMMY_PASSWORD_HASH = hashPassword(crypto.randomBytes(16).toString("hex"));

/** A supplier who did not choose a password gets an unguessable random one and uses "forgot password" after approval. */
function hashSupplierPassword(chosen?: string | null): string {
  return hashPassword(chosen && chosen.length > 0 ? chosen : crypto.randomBytes(24).toString("base64url"));
}

function verifySupplierPassword(vendor: { temporaryPassword: string | null }, candidate: unknown): boolean {
  const stored = vendor.temporaryPassword && PASSWORD_HASH_PATTERN.test(vendor.temporaryPassword) ? vendor.temporaryPassword : DUMMY_PASSWORD_HASH;
  const matches = typeof candidate === "string" && candidate.length > 0 && verifyPassword(candidate, stored);
  return matches && stored !== DUMMY_PASSWORD_HASH;
}

function isApprovedVendor(vendor: { status?: string | null; approvalStatus?: string | null }): boolean {
  return (vendor.status || vendor.approvalStatus || "").toUpperCase() === "APPROVED";
}

/**
 * Automatically checks and lifts temporary vendor suspensions if the suspensionUntil date has passed.
 */
export async function checkAutoLiftVendorSuspension(vendor: any): Promise<any> {
  if (!vendor) return vendor;
  const statusUpper = (vendor.status || vendor.approvalStatus || "").toUpperCase();
  if (
    statusUpper === "SUSPENDED" &&
    vendor.suspensionType === "TEMPORARY" &&
    vendor.suspensionUntil &&
    new Date(vendor.suspensionUntil) <= new Date()
  ) {
    try {
      const [updated] = await db
        .update(vendorsTable)
        .set({
          status: "APPROVED",
          approvalStatus: "approved",
          suspensionType: "NONE",
          suspensionReason: null,
          suspensionUntil: null,
          suspendedFrom: null,
          suspendedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(vendorsTable.id, vendor.id))
        .returning();

      await db
        .update(supplierSuspensionsTable)
        .set({
          liftedAt: new Date(),
          liftedBy: "SYSTEM_AUTO_EXPIRY",
          liftReason: "Temporary suspension duration elapsed",
        })
        .where(and(eq(supplierSuspensionsTable.vendorId, vendor.id), isNull(supplierSuspensionsTable.liftedAt)));

      return updated || vendor;
    } catch {
      return vendor;
    }
  }
  return vendor;
}

/** Only what the applicant needs: never internal notes, strikes, suspension data or any credential. */
function publicApplication(vendor: any) {
  return {
    id: vendor.id,
    vendorId: vendor.vendorId,
    businessName: vendor.businessName,
    businessType: vendor.businessType || "Private Limited",
    contactName: vendor.contactName,
    email: vendor.email,
    phone: vendor.phone,
    hasWebsite: vendor.hasWebsite ?? Boolean(vendor.website),
    website: vendor.website || null,
    address: vendor.address || null,
    city: vendor.city,
    state: vendor.state,
    country: vendor.country,
    registrationNumber: vendor.registrationNumber || null,
    taxId: vendor.taxId || null,
    description: vendor.description || null,
    serviceCategories: vendor.serviceCategories,
    operatingLocations: vendor.operatingLocations,
    status: vendor.status || vendor.approvalStatus,
    approvalStatus: vendor.approvalStatus,
    kycStatus: vendor.kycStatus,
    approvedAt: vendor.approvedAt || null,
    onboardingStep: vendor.onboardingStep || 1,
    changeRequestAreas: vendor.changeRequestAreas || [],
    changeRequestMessage: vendor.changeRequestMessage || null,
    submittedAt: vendor.createdAt,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  };
}

/** Applicant-facing part of the review trail (change requests and their own resubmissions), without internal notes. */
function applicantVisibleNotes(notes: string | null | undefined): string {
  return (notes || "")
    .split("\n")
    .filter((line) => /CHANGES REQUESTED:|RESUBMITTED BY SUPPLIER:/.test(line))
    .join("\n");
}

/** Vendor row without fields that are internal to Zelevos. */
function vendorForOwner(vendor: any) {
  const { temporaryPassword, disciplinaryNotes, misbehaviorStrikes, customerIssuesCount, ...rest } = vendor;
  return rest;
}

// Documents may only point at files uploaded through this API or at ordinary http(s) URLs; never javascript:/data: URLs
function isSafeDocumentUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return false;
  return value.startsWith("/api/suppliers/documents/file/") || /^https?:\/\/[^\s]+$/i.test(value);
}

// Real file type from the first bytes, never from the client-declared type
function sniffDocumentType(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.subarray(0, 1024).toString("latin1").includes("%PDF-")) return { mime: "application/pdf", ext: "pdf" };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

const SERVED_DOCUMENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// --------------------------------------------------------------------------
// 0. Storage & Document Upload Configuration
// --------------------------------------------------------------------------

const supplierUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, callback) => {
    callback(null, ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

function storageConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bucket = (process.env.SUPABASE_PRIVATE_DOCUMENT_BUCKET || "private-documents").trim();
  return { url, key, bucket };
}

// --------------------------------------------------------------------------
// Public Supplier Self-Registration, Status Check & Document Upload
// --------------------------------------------------------------------------

const selfRegistrationSchema = z
  .object({
    businessName: z.string().trim().min(2, "Company / Business name must be at least 2 characters"),
    businessType: z.string().trim().default("Private Limited"),
    contactName: z.string().trim().min(2, "Contact person name is required"),
    email: z.string().trim().email("A valid email address is required"),
    phone: z.string().trim().min(8, "Phone number is required"),
    hasWebsite: z.union([z.boolean(), z.string().transform((v) => v === "true" || v === "yes")]).optional().default(false),
    website: z.string().trim().optional(),
    address: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    country: z.string().trim().default("India"),
    registrationNumber: z.string().trim().optional(),
    taxId: z.string().trim().optional(),
    description: z.string().trim().optional(),
    serviceCategories: z.array(z.string()).min(1, "At least one service category is required"),
    operatingLocations: z.array(z.string()).default([]),
    password: z.string().min(8, "Password must be at least 8 characters").max(128).optional(),
    temporaryPassword: z.string().min(8, "Password must be at least 8 characters").max(128).optional(),
    documents: z
      .array(
        z.object({
          documentType: z.string().default("business_registration"),
          title: z.string().min(1, "Document title is required"),
          fileName: z.string().default("document.pdf"),
          fileUrl: z.string().min(1, "Document URL or path is required"),
          fileSize: z.number().optional(),
          mimeType: z.string().optional(),
        })
      )
      .optional(),
  })
  .superRefine((val, ctx) => {
    // If supplier indicated they have an official website, validate URL properly
    if (val.hasWebsite) {
      if (!val.website || val.website.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Official Website URL is required when website option is Yes.",
          path: ["website"],
        });
      } else {
        const raw = val.website.trim();
        try {
          const parsedUrl = new URL(raw);
          if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Website URL must begin with http:// or https://",
              path: ["website"],
            });
          }
          if (!parsedUrl.hostname || !parsedUrl.hostname.includes(".")) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Please enter a valid website domain name.",
              path: ["website"],
            });
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please provide a valid website URL (e.g. https://yourbusiness.com).",
            path: ["website"],
          });
        }
      }
    }
  });

// Real Public Supplier Self-Registration Endpoint
router.post(["/suppliers/register", "/vendor/register"], async (req, res): Promise<void> => {
  const parsed = selfRegistrationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Validation failed", errors: parsed.error.issues });
    return;
  }

  try {
    const data = parsed.data;
    const cleanEmail = data.email.toLowerCase().trim();

    // Check duplicate among suppliers
    const [existing] = await db.select().from(vendorsTable).where(eq(vendorsTable.email, cleanEmail)).limit(1);
    if (existing) {
      res.status(409).json({
        status: "conflict",
        message: "A supplier with this email address already exists. Please check your application status or login.",
      });
      return;
    }

    // Task 11: Check if email already belongs to a customer account
    const [existingCustomer] = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.email, cleanEmail))
      .limit(1);
    if (existingCustomer && (existingCustomer.role === "customer" || !existingCustomer.role || existingCustomer.role === "user")) {
      res.status(400).json({
        status: "email_in_use",
        message: "This email is already used for a customer account. Please use a different email to register as a supplier.",
      });
      return;
    }

    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedVendorId = `SUP-${year}-${randomSuffix}`;
    // Only a hash is stored. No default password exists: without a chosen one the applicant must use "forgot password" after approval.
    const passwordHash = hashSupplierPassword(data.password || data.temporaryPassword);

    const hasWebsite = Boolean(data.hasWebsite);
    const cleanWebsite = hasWebsite && data.website ? data.website.trim() : null;

    const [vendor] = await db
      .insert(vendorsTable)
      .values({
        vendorId: generatedVendorId,
        businessName: data.businessName,
        businessType: data.businessType || "Private Limited",
        contactName: data.contactName,
        email: cleanEmail,
        phone: data.phone,
        hasWebsite,
        website: cleanWebsite,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || "India",
        registrationNumber: data.registrationNumber || null,
        taxId: data.taxId || null,
        description: data.description || (cleanWebsite ? `Website: ${cleanWebsite}` : null),
        serviceCategories: data.serviceCategories,
        operatingLocations: data.operatingLocations.length ? data.operatingLocations : [data.city || "All India"],
        status: "PENDING_APPROVAL",
        approvalStatus: "pending",
        kycStatus: "pending",
        onboardingStep: 5,
        temporaryPassword: passwordHash,
        acceptanceRate: "100",
        avgResponseMinutes: "30",
        cancellationRate: "0",
      })
      .returning();

    // Insert attached verification documents
    if (data.documents && data.documents.length > 0) {
      for (const doc of data.documents) {
        await db.insert(vendorDocumentsTable).values({
          vendorId: vendor.id,
          documentType: doc.documentType || "other",
          title: doc.title,
          fileName: doc.fileName || `${doc.title.replace(/\s+/g, "_")}.pdf`,
          fileUrl: doc.fileUrl,
          fileSize: doc.fileSize || 0,
          mimeType: doc.mimeType || "application/pdf",
          status: "pending",
        });
      }
    }

    // Real audit log
    await logAuditAction({
      action: "SUPPLIER_APPLICATION_SUBMITTED",
      resourceType: "vendor",
      resourceId: vendor.id,
      newValue: {
        vendorId: vendor.vendorId,
        businessName: vendor.businessName,
        email: vendor.email,
        serviceCategories: vendor.serviceCategories,
        documentsCount: data.documents?.length || 0,
        hasWebsite,
        website: cleanWebsite,
      },
      actorName: vendor.contactName,
      actorRole: "supplier_applicant",
    });

    // Real notification for admin
    try {
      await db.insert(notificationsTable).values({
        type: "SUPPLIER_APPLICATION_SUBMITTED",
        title: "New Supplier Onboarding Application",
        body: `Supplier "${vendor.businessName}" (${vendor.vendorId}) submitted self-registration for categories: ${vendor.serviceCategories.join(", ")}.`,
        channel: "email",
        status: "SENT",
        metadata: {
          vendorId: vendor.id,
          supplierNumber: vendor.vendorId,
          businessName: vendor.businessName,
          email: vendor.email,
        },
      });
    } catch {
      // non-fatal
    }

    res.status(201).json({
      status: "success",
      message: "Supplier application submitted successfully. Your application is under review by the Zelevos team.",
      application: publicApplication(vendor),
      vendor: publicApplication(vendor),
      supplier: publicApplication(vendor),
      trackingId: vendor.vendorId,
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      res.status(409).json({
        status: "conflict",
        message: "A supplier with this email or supplier ID already exists.",
      });
      return;
    }
    res.status(500).json({ status: "error", message: "We couldn't complete this action right now. Please try again." });
  }
});

// Check Supplier Application Status: needs the applicant's own password (proof of ownership)
const applicationLookupSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(200),
});

async function findApplicationByIdentifier(identifier: string) {
  const key = identifier.trim();
  const condition = key.includes("@")
    ? eq(vendorsTable.email, key.toLowerCase())
    : or(eq(vendorsTable.vendorId, key.toUpperCase()), isUuid(key) ? eq(vendorsTable.id, key) : sql`false`);
  const [vendor] = await db.select().from(vendorsTable).where(condition).limit(1);
  return vendor;
}

router.get("/suppliers/application-status", (_req, res): void => {
  res.status(405).json({
    status: "method_not_allowed",
    message: "Checking an application now requires your password. Send a POST request with your e-mail or tracking ID and your password.",
  });
});

router.post("/suppliers/application-status", async (req, res): Promise<void> => {
  const parsed = applicationLookupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Enter your e-mail or tracking ID and your password." });
    return;
  }

  try {
    const vendor = await findApplicationByIdentifier(parsed.data.identifier);
    // One generic answer for "unknown application" and "wrong password"
    if (!vendor || !verifySupplierPassword(vendor, parsed.data.password)) {
      if (!vendor) verifyPassword(parsed.data.password, DUMMY_PASSWORD_HASH);
      res.status(401).json({ status: "unauthorized", message: "Invalid application details or password." });
      return;
    }

    const docs = await db.select().from(vendorDocumentsTable).where(eq(vendorDocumentsTable.vendorId, vendor.id));

    res.json({
      status: "success",
      application: {
        ...publicApplication(vendor),
        disciplinaryNotes: applicantVisibleNotes(vendor.disciplinaryNotes),
        documents: docs.map((d: any) => ({
          id: d.id,
          title: d.title,
          documentType: d.documentType,
          fileName: d.fileName,
          fileUrl: d.fileUrl,
          fileSize: d.fileSize,
          mimeType: d.mimeType,
          status: d.status,
          rejectionReason: d.rejectionReason,
          expiryDate: d.expiryDate,
          uploadedAt: d.uploadedAt || d.createdAt,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to check application status." });
  }
});

// Supplier Resubmit Application when Changes Requested: password proof + only from CHANGES_REQUESTED
const resubmitSchema = z
  .object({
    password: z.string().min(1).max(200),
    businessName: z.string().trim().min(2).max(200).optional(),
    businessType: z.string().trim().max(100).optional(),
    contactName: z.string().trim().min(2).max(200).optional(),
    phone: z.string().trim().min(8).max(40).optional(),
    hasWebsite: z.union([z.boolean(), z.string().transform((v) => v === "true" || v === "yes")]).optional(),
    website: z.string().trim().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    city: z.string().trim().max(120).nullable().optional(),
    state: z.string().trim().max(120).nullable().optional(),
    country: z.string().trim().max(120).nullable().optional(),
    registrationNumber: z.string().trim().max(120).nullable().optional(),
    taxId: z.string().trim().max(120).nullable().optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    serviceCategories: z.array(z.string().max(120)).max(30).optional(),
    operatingLocations: z.array(z.string().max(120)).max(60).optional(),
    resubmissionNotes: z.string().trim().max(2000).optional(),
    documents: z
      .array(
        z.object({
          documentType: z.string().max(60).optional(),
          title: z.string().min(1).max(200),
          fileName: z.string().max(255).optional(),
          fileUrl: z.string().refine(isSafeDocumentUrl, "Invalid document URL"),
          fileSize: z.number().optional(),
          mimeType: z.string().max(100).optional(),
        })
      )
      .max(20)
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.hasWebsite && val.website) {
      try {
        const u = new URL(val.website.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Website URL must begin with http:// or https://", path: ["website"] });
        }
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please provide a valid website URL.", path: ["website"] });
      }
    }
  });

router.put("/suppliers/application/:id/resubmit", async (req, res): Promise<void> => {
  const paramId = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const parsed = resubmitSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const missingPassword = parsed.error.issues.some((issue) => issue.path[0] === "password");
    res.status(missingPassword ? 401 : 400).json({
      status: missingPassword ? "unauthorized" : "invalid_request",
      message: missingPassword ? "Your application password is required to resubmit." : "Some of the submitted details are invalid.",
    });
    return;
  }
  const input = parsed.data;

  try {
    const vendor = await findApplicationByIdentifier(paramId);
    if (!vendor || !verifySupplierPassword(vendor, input.password)) {
      if (!vendor) verifyPassword(input.password, DUMMY_PASSWORD_HASH);
      res.status(401).json({ status: "unauthorized", message: "Invalid application details or password." });
      return;
    }

    if ((vendor.status || "").toUpperCase() !== "CHANGES_REQUESTED") {
      res.status(409).json({
        status: "invalid_transition",
        message: "This application can only be resubmitted after the Zelevos team has requested changes.",
      });
      return;
    }

    const timestampStr = new Date().toISOString();
    const updatedNotes = `${vendor.disciplinaryNotes ? vendor.disciplinaryNotes + "\n" : ""}[${timestampStr}] RESUBMITTED BY SUPPLIER: ${input.resubmissionNotes || "Updated details and documents submitted for re-review."}`;

    const hasWeb = input.hasWebsite !== undefined ? Boolean(input.hasWebsite) : vendor.hasWebsite;
    const cleanWeb = hasWeb ? (input.website ? input.website.trim() : vendor.website) : null;

    const [updated] = await db
      .update(vendorsTable)
      .set({
        businessName: input.businessName || vendor.businessName,
        businessType: input.businessType || vendor.businessType,
        contactName: input.contactName || vendor.contactName,
        phone: input.phone || vendor.phone,
        hasWebsite: hasWeb,
        website: cleanWeb,
        address: input.address !== undefined ? input.address : vendor.address,
        city: input.city !== undefined ? input.city : vendor.city,
        state: input.state !== undefined ? input.state : vendor.state,
        country: input.country !== undefined && input.country !== null ? input.country : vendor.country,
        registrationNumber: input.registrationNumber !== undefined ? input.registrationNumber : vendor.registrationNumber,
        taxId: input.taxId !== undefined ? input.taxId : vendor.taxId,
        description: input.description !== undefined ? input.description : vendor.description,
        serviceCategories: input.serviceCategories ?? vendor.serviceCategories,
        operatingLocations: input.operatingLocations ?? vendor.operatingLocations,
        status: "UNDER_REVIEW",
        approvalStatus: "under_review",
        disciplinaryNotes: updatedNotes,
        changeRequestAreas: [],
        changeRequestMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(vendorsTable.id, vendor.id))
      .returning();

    for (const doc of input.documents ?? []) {
      await db.insert(vendorDocumentsTable).values({
        vendorId: vendor.id,
        documentType: doc.documentType || "other",
        title: doc.title,
        fileName: doc.fileName || `${doc.title.replace(/\s+/g, "_")}.pdf`,
        fileUrl: doc.fileUrl,
        fileSize: doc.fileSize || 0,
        mimeType: doc.mimeType || "application/pdf",
        status: "pending",
      });
    }

    await logAuditAction({
      action: "SUPPLIER_APPLICATION_RESUBMITTED",
      resourceType: "vendor",
      resourceId: vendor.id,
      newValue: {
        status: "UNDER_REVIEW",
        resubmissionNotes: input.resubmissionNotes,
      },
      actorName: vendor.contactName,
      actorRole: "supplier_applicant",
    });

    try {
      await db.insert(notificationsTable).values({
        type: "SUPPLIER_APPLICATION_RESUBMITTED",
        title: "Supplier Application Resubmission",
        body: `Supplier "${vendor.businessName}" (${vendor.vendorId}) resubmitted application for re-evaluation.`,
        channel: "email",
        status: "SENT",
        metadata: { vendorId: vendor.id, supplierNumber: vendor.vendorId },
      });
    } catch {
      // non-fatal
    }

    res.json({
      status: "success",
      message: "Application resubmitted successfully. Status set to UNDER_REVIEW.",
      application: { ...publicApplication(updated), disciplinaryNotes: applicantVisibleNotes(updated.disciplinaryNotes) },
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to resubmit application." });
  }
});

// Real Document Upload for Supplier Onboarding & Verification
router.post(["/suppliers/upload-document", "/vendor/upload-document"], supplierUpload.single("document"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ status: "invalid_request", message: "A document file (PDF, PNG, JPG, WEBP) is required." });
    return;
  }

  // The client-declared type is not trusted: the stored type and extension come from the real file content
  const detected = sniffDocumentType(req.file.buffer);
  if (!detected) {
    res.status(400).json({ status: "invalid_request", message: "The file is not a valid PDF, PNG, JPG or WEBP document." });
    return;
  }

  try {
    const config = storageConfig();
    let fileUrl = "";

    if (config.url && config.key) {
      const objectPath = `suppliers/${crypto.randomUUID()}.${detected.ext}`;
      const uploadResponse = await fetch(`${config.url}/storage/v1/object/${config.bucket}/${objectPath}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.key}`,
          apikey: config.key,
          "Content-Type": detected.mime,
          "x-upsert": "false",
        },
        body: new Uint8Array(req.file.buffer),
      });

      if (uploadResponse.ok) {
        fileUrl = `${config.url}/storage/v1/object/public/${config.bucket}/${objectPath}`;
      }
    }

    // Local secure storage fallback if Supabase Storage is not reachable or in local dev
    if (!fileUrl) {
      const uploadsDir = path.resolve(process.cwd(), "artifacts/api-server/uploads/supplier-documents");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname)).replace(/[^a-zA-Z0-9-]/g, "_").slice(0, 60) || "document";
      const safeName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${baseName}.${detected.ext}`;
      fs.writeFileSync(path.join(uploadsDir, safeName), req.file.buffer);
      fileUrl = `/api/suppliers/documents/file/${safeName}`;
    }

    res.status(201).json({
      status: "success",
      fileUrl,
      fileName: path.basename(req.file.originalname).slice(0, 200),
      fileSize: req.file.size,
      mimeType: detected.mime,
      message: "Document uploaded successfully.",
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to process document upload." });
  }
});

// Secure Document File Serving: supplier KYC files are private. Staff (admin portal or staff role) may open any;
// an approved vendor may only open files that are attached to their own record.
router.get("/suppliers/documents/file/:filename", requireAuthOrAdmin, async (req, res) => {
  const filename = path.basename(String(req.params.filename));
  const uploadsDir = path.resolve(process.cwd(), "artifacts/api-server/uploads/supplier-documents");
  const filePath = path.join(uploadsDir, filename);

  const isStaff = req.user?.role === "admin" || req.user?.role === "operations_manager" || Boolean(req.admin);
  if (!isStaff) {
    if (req.user?.role !== "vendor" || !req.user?.vendorId) {
      res.status(403).json({ status: "forbidden", message: "Access denied." });
      return;
    }
    const [doc] = await db.select({ id: vendorDocumentsTable.id })
      .from(vendorDocumentsTable)
      .where(and(
        eq(vendorDocumentsTable.vendorId, req.user.vendorId),
        eq(vendorDocumentsTable.fileUrl, `/api/suppliers/documents/file/${filename}`)
      ))
      .limit(1);
    if (!doc) {
      res.status(404).json({ status: "not_found", message: "Document not found." });
      return;
    }
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ status: "not_found", message: "Document file not found." });
    return;
  }

  // Always a download, never rendered by the browser, never sniffed into HTML
  const contentType = SERVED_DOCUMENT_TYPES[path.extname(filename).toLowerCase()] || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(filePath);
});

// --------------------------------------------------------------------------
// 1. Admin Supplier / Vendor Management APIs (Section 9 & PRD Supplier Onboarding)
// --------------------------------------------------------------------------

// List All Suppliers / Vendors with Filtering & Search
router.get(["/admin/suppliers", "/admin/vendors"], requireRole(["admin", "operations_manager"]), async (req, res) => {
  try {
    const { search, status, serviceType } = req.query;

    const allVendors = await db.select().from(vendorsTable).orderBy(desc(vendorsTable.createdAt));
    const processedVendors = await Promise.all(allVendors.map((v: any) => checkAutoLiftVendorSuspension(v)));

    let filtered = processedVendors;

    // Search filter: matches vendorId, businessName, contactName, email, phone, city
    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (v: any) =>
          v.vendorId?.toLowerCase().includes(q) ||
          v.businessName?.toLowerCase().includes(q) ||
          v.contactName?.toLowerCase().includes(q) ||
          v.email?.toLowerCase().includes(q) ||
          v.phone?.toLowerCase().includes(q) ||
          v.city?.toLowerCase().includes(q)
      );
    }

    // Status filter: All, Pending Approval, Approved, Rejected, Suspended
    if (status && typeof status === "string" && status.toLowerCase() !== "all") {
      const st = status.trim().toUpperCase();
      filtered = filtered.filter((v: any) => {
        const vStatus = (v.status || v.approvalStatus || "").toUpperCase();
        if (st === "PENDING_APPROVAL" || st === "PENDING") {
          return vStatus === "PENDING_APPROVAL" || vStatus === "PENDING";
        }
        if (st === "APPROVED") return vStatus === "APPROVED";
        if (st === "REJECTED") return vStatus === "REJECTED";
        if (st === "SUSPENDED") return vStatus === "SUSPENDED";
        return vStatus === st;
      });
    }

    // Service type filter
    if (serviceType && typeof serviceType === "string" && serviceType.toLowerCase() !== "all") {
      const st = serviceType.trim().toLowerCase();
      filtered = filtered.filter((v: any) => {
        const cats = Array.isArray(v.serviceCategories) ? v.serviceCategories : [];
        return cats.some((c: any) => c.toLowerCase() === st || c.toLowerCase().includes(st));
      });
    }

    res.json({
      suppliers: filtered,
      vendors: filtered,
      totalCount: filtered.length,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to fetch suppliers." });
  }
});

const supplierCreateSchema = z.object({
  vendorId: z.string().trim().optional(),
  businessName: z.string().trim().min(1, "Company / Supplier name is required"),
  contactName: z.string().trim().min(1, "Contact person name is required"),
  email: z.string().trim().email("Valid email is required"),
  phone: z.string().trim().min(1, "Phone number is required"),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().default("India"),
  registrationNumber: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
  description: z.string().trim().optional(),
  serviceCategories: z.array(z.string()).min(1, "At least one service type is required"),
  operatingLocations: z.array(z.string()).default([]),
  netRateTerms: z.string().optional(),
  temporaryPassword: z.string().min(8, "Password must be at least 8 characters").max(128).optional(),
  acceptanceRate: z.coerce.number().default(100),
  avgResponseMinutes: z.coerce.number().default(30),
  cancellationRate: z.coerce.number().default(0),
  documents: z
    .array(
      z.object({
        documentType: z.string().default("other"),
        title: z.string().default("Document"),
        fileName: z.string().default("document.pdf"),
        fileUrl: z.string(),
      })
    )
    .optional(),
});

// Create New Supplier / Vendor
router.post(["/admin/suppliers", "/admin/vendors"], requireRole(["admin"]), async (req, res) => {
  const parsed = supplierCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", errors: parsed.error.issues });
    return;
  }

  try {
    const data = parsed.data;
    const generatedVendorId = data.vendorId || `SUP-${Date.now().toString().slice(-4)}`;
    // No default password: an admin either chooses one or receives a random one exactly once in the response
    const generatedPassword = data.temporaryPassword ? null : crypto.randomBytes(12).toString("base64url");
    const initialPasswordHash = hashSupplierPassword(data.temporaryPassword || generatedPassword);

    const [vendor] = await db
      .insert(vendorsTable)
      .values({
        vendorId: generatedVendorId,
        businessName: data.businessName,
        contactName: data.contactName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || "India",
        registrationNumber: data.registrationNumber || null,
        taxId: data.taxId || null,
        description: data.description || null,
        serviceCategories: data.serviceCategories,
        operatingLocations: data.operatingLocations.length ? data.operatingLocations : [data.city || "All India"],
        netRateTerms: data.netRateTerms || null,
        temporaryPassword: initialPasswordHash,
        status: "PENDING_APPROVAL",
        approvalStatus: "pending",
        kycStatus: "pending",
        acceptanceRate: String(data.acceptanceRate),
        avgResponseMinutes: String(data.avgResponseMinutes),
        cancellationRate: String(data.cancellationRate),
      })
      .returning();

    // Insert attached documents if provided
    if (data.documents && data.documents.length > 0) {
      for (const doc of data.documents) {
        await db.insert(vendorDocumentsTable).values({
          vendorId: vendor.id,
          documentType: doc.documentType,
          title: doc.title,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          status: "pending",
        });
      }
    }

    await logAuditAction({
      action: "SUPPLIER_CREATED",
      resourceType: "vendor",
      resourceId: vendor.id,
      newValue: {
        vendorId: vendor.vendorId,
        businessName: vendor.businessName,
        email: vendor.email,
        serviceCategories: vendor.serviceCategories,
      },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.status(201).json({
      status: "success",
      supplier: vendor,
      vendor,
      ...(generatedPassword ? { generatedPassword } : {}),
      message: generatedPassword
        ? "Supplier created successfully in PENDING_APPROVAL status. Share the generated password with the supplier now: it is shown only once."
        : "Supplier created successfully in PENDING_APPROVAL status.",
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      res.status(409).json({
        status: "conflict",
        message: "A supplier with this email or supplier ID already exists.",
      });
      return;
    }
    res.status(500).json({ status: "error", message: error.message || "Failed to create supplier." });
  }
});

// Get Full Supplier Profile (Admin)
router.get(["/admin/suppliers/:id", "/admin/vendors/:id"], requireRole(["admin", "operations_manager"]), async (req, res, next) => {
  const paramId = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  if (paramId === "search") {
    next();
    return;
  }
  try {
    const condition = isUuid(paramId)
      ? or(eq(vendorsTable.id, paramId), eq(vendorsTable.vendorId, paramId))
      : eq(vendorsTable.vendorId, paramId);

    let [vendor] = await db.select().from(vendorsTable).where(condition).limit(1);

    if (!vendor) {
      res.status(404).json({ status: "not_found", message: "Supplier not found." });
      return;
    }

    vendor = await checkAutoLiftVendorSuspension(vendor);

    // Load related documents, services, bookings, invoices, audit history, suspension history
    const [documents, services, tasks, invoices, auditLogs, suspensionHistory] = await Promise.all([
      db.select().from(vendorDocumentsTable).where(eq(vendorDocumentsTable.vendorId, vendor.id)).orderBy(desc(vendorDocumentsTable.createdAt)),
      db.select().from(vendorServicesTable).where(eq(vendorServicesTable.vendorId, vendor.id)).orderBy(desc(vendorServicesTable.createdAt)),
      db
        .select({
          task: bookingServicesTable,
          bookingRef: bookingsTable.bookingId,
          travelDate: bookingsTable.travelDate,
          customerContact: bookingsTable.customerContact,
        })
        .from(bookingServicesTable)
        .leftJoin(bookingsTable, eq(bookingServicesTable.bookingId, bookingsTable.id))
        .where(eq(bookingServicesTable.assignedVendorId, vendor.id))
        .orderBy(desc(bookingServicesTable.createdAt)),
      db.select().from(vendorInvoicesTable).where(eq(vendorInvoicesTable.vendorId, vendor.id)).orderBy(desc(vendorInvoicesTable.createdAt)),
      db
        .select()
        .from(auditLogsTable)
        .where(and(eq(auditLogsTable.resourceType, "vendor"), eq(auditLogsTable.resourceId, vendor.id)))
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(20),
      db
        .select()
        .from(supplierSuspensionsTable)
        .where(eq(supplierSuspensionsTable.vendorId, vendor.id))
        .orderBy(desc(supplierSuspensionsTable.createdAt))
        .catch(() => []),
    ]);

    // Financial calculations for supplier
    const totalInvoiced = invoices.reduce((acc: number, inv: any) => acc + (inv.amount || 0), 0);
    const totalPaid = invoices.filter((i: any) => i.status === "paid").reduce((acc: number, inv: any) => acc + (inv.amount || 0), 0);
    const approvedPayables = invoices.filter((i: any) => i.status === "approved").reduce((acc: number, inv: any) => acc + (inv.amount || 0), 0);
    const expectedPayable = tasks.reduce((acc: number, t: any) => acc + (t.task?.supplierNetCost || 0), 0);
    const outstanding = totalInvoiced - totalPaid;

    // Vendor account if linked to user
    let vendorAccount: any = null;
    if (vendor.userId) {
      const [u] = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          fullName: usersTable.fullName,
          phone: usersTable.phone,
          role: usersTable.role,
          status: usersTable.status,
          createdAt: usersTable.createdAt,
          lastLoginAt: usersTable.lastLoginAt,
        })
        .from(usersTable)
        .where(eq(usersTable.id, vendor.userId))
        .limit(1);
      if (u) {
        vendorAccount = {
          userId: u.id,
          loginEmail: u.email,
          fullName: u.fullName,
          phone: u.phone,
          role: u.role,
          accountStatus: u.status || "active",
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
          provisioned: true,
        };
      }
    }

    // Dynamic document checklist generated from real vendor documents
    const standardChecklistItems = [
      { id: "business_registration", label: "Business Registration / Incorporation", types: ["business_registration", "incorporation"] },
      { id: "gst_certificate", label: "GST / Tax Registration Certificate", types: ["gst_certificate", "gst_vat", "tax_certificate"] },
      { id: "id_proof", label: "Owner / Director Identity Proof", types: ["id_proof", "id_verification", "aadhaar", "passport", "pan"] },
      { id: "address_proof", label: "Address Proof / Tourism License", types: ["address_proof", "tourism_license", "license"] },
      { id: "service_contract", label: "Agreement / Rate Contract", types: ["service_contract", "contract_agreement", "agreement"] },
    ];

    const documentChecklist = standardChecklistItems.map((item) => {
      const matchingDocs = documents.filter((d: any) =>
        item.types.includes(d.documentType?.toLowerCase()) ||
        item.types.some((t) => d.title?.toLowerCase().includes(t.replace("_", " ")))
      );
      if (matchingDocs.length === 0) {
        return {
          id: item.id,
          label: item.label,
          status: "missing",
          statusLabel: "Missing",
          documentId: null,
          fileName: null,
          uploadedAt: null,
        };
      }
      const verifiedDoc = matchingDocs.find((d: any) => d.status === "verified");
      if (verifiedDoc) {
        return {
          id: item.id,
          label: item.label,
          status: "verified",
          statusLabel: "Verified",
          documentId: verifiedDoc.id,
          fileName: verifiedDoc.fileName,
          uploadedAt: verifiedDoc.createdAt,
        };
      }
      const pendingDoc = matchingDocs.find((d: any) => d.status === "pending");
      if (pendingDoc) {
        return {
          id: item.id,
          label: item.label,
          status: "pending_verification",
          statusLabel: "Pending Verification",
          documentId: pendingDoc.id,
          fileName: pendingDoc.fileName,
          uploadedAt: pendingDoc.createdAt,
        };
      }
      const rejectedDoc = matchingDocs.find((d: any) => d.status === "rejected");
      return {
        id: item.id,
        label: item.label,
        status: "rejected",
        statusLabel: "Rejected",
        documentId: rejectedDoc?.id || matchingDocs[0].id,
        fileName: rejectedDoc?.fileName || matchingDocs[0].fileName,
        uploadedAt: rejectedDoc?.createdAt || matchingDocs[0].createdAt,
        rejectionReason: rejectedDoc?.rejectionReason,
      };
    });

    const { temporaryPassword, ...safeVendor } = vendor;

    res.json({
      supplier: {
        ...safeVendor,
        hasWebsite: vendor.hasWebsite ?? Boolean(vendor.website),
        website: vendor.website || null,
        businessType: vendor.businessType || "Private Limited",
        documents,
        services,
        bookings: tasks,
        invoices,
        auditLogs,
        suspensionHistory,
        vendorAccount,
        documentChecklist,
        finance: {
          expectedPayable,
          totalInvoiced,
          approvedPayables,
          totalPaid,
          outstanding,
        },
      },
      vendor: safeVendor,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to fetch supplier profile." });
  }
});

// Secure Authenticated Document Viewer Route (Admin & Operations)
router.get(
  ["/admin/suppliers/:id/documents/:docId/view", "/admin/vendors/:id/documents/:docId/view"],
  requireRole(["admin", "operations_manager"]),
  async (req, res): Promise<void> => {
    const vendorId = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
    const docId = typeof req.params.docId === "string" ? req.params.docId : String(req.params.docId || "");
    try {
      const condition = isUuid(vendorId)
        ? or(eq(vendorsTable.id, vendorId), eq(vendorsTable.vendorId, vendorId))
        : eq(vendorsTable.vendorId, vendorId);
      const [vendor] = await db.select({ id: vendorsTable.id }).from(vendorsTable).where(condition).limit(1);
      if (!vendor) {
        res.status(404).json({ status: "not_found", message: "Supplier not found." });
        return;
      }
      const [doc] = await db
        .select()
        .from(vendorDocumentsTable)
        .where(and(eq(vendorDocumentsTable.vendorId, vendor.id), eq(vendorDocumentsTable.id, docId)))
        .limit(1);
      if (!doc) {
        res.status(404).json({ status: "not_found", message: "Document not found." });
        return;
      }

      await logAuditAction({
        action: "VENDOR_DOCUMENT_VIEWED",
        resourceType: "vendor_document",
        resourceId: doc.id,
        newValue: { documentId: doc.id, title: doc.title, fileName: doc.fileName },
        actorAdminId: (req as any).admin?.id,
        actorRole: "admin",
      });

      // If local file
      if (doc.fileUrl.startsWith("/api/suppliers/documents/file/")) {
        const filename = path.basename(doc.fileUrl);
        const uploadsDir = path.resolve(process.cwd(), "artifacts/api-server/uploads/supplier-documents");
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
          const contentType = SERVED_DOCUMENT_TYPES[path.extname(filename).toLowerCase()] || doc.mimeType || "application/pdf";
          res.setHeader("Content-Type", contentType);
          res.setHeader("Content-Disposition", `inline; filename="${doc.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`);
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("Cache-Control", "private, no-store");
          res.sendFile(filePath);
          return;
        }
      }

      // If Supabase Storage
      const config = storageConfig();
      if (config.url && config.key && (doc.fileUrl.includes(`/${config.bucket}/`) || doc.fileUrl.startsWith("supabase:"))) {
        const parts = doc.fileUrl.split(`/${config.bucket}/`);
        const objectPath = parts.length > 1 ? parts[1] : doc.fileUrl.replace(/^supabase:/, "");
        const signedRes = await fetch(`${config.url}/storage/v1/object/sign/${config.bucket}/${objectPath}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.key}`,
            apikey: config.key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expiresIn: 900 }), // 15 mins
        });
        if (signedRes.ok) {
          const data = await signedRes.json();
          const signedURL = data.signedURL?.startsWith("http") ? data.signedURL : `${config.url}/storage/v1${data.signedURL}`;
          res.redirect(signedURL);
          return;
        }
      }

      if (isSafeDocumentUrl(doc.fileUrl)) {
        res.redirect(doc.fileUrl);
        return;
      }

      res.status(404).json({ status: "not_found", message: "Document file could not be located." });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: "Failed to access private document." });
    }
  }
);

// Update Supplier Details (Admin)
router.put(["/admin/suppliers/:id", "/admin/vendors/:id"], requireRole(["admin"]), async (req, res) => {
  const paramId = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  try {
    const condition = isUuid(paramId)
      ? or(eq(vendorsTable.id, paramId), eq(vendorsTable.vendorId, paramId))
      : eq(vendorsTable.vendorId, paramId);

    const [existing] = await db.select().from(vendorsTable).where(condition).limit(1);
    if (!existing) {
      res.status(404).json({ status: "not_found", message: "Supplier not found." });
      return;
    }

    const {
      businessName,
      contactName,
      email,
      phone,
      address,
      city,
      state,
      country,
      registrationNumber,
      taxId,
      description,
      serviceCategories,
      operatingLocations,
      netRateTerms,
    } = req.body;

    const [updated] = await db
      .update(vendorsTable)
      .set({
        businessName: businessName?.trim() || existing.businessName,
        contactName: contactName?.trim() || existing.contactName,
        email: email?.trim().toLowerCase() || existing.email,
        phone: phone?.trim() || existing.phone,
        address: address !== undefined ? address : existing.address,
        city: city !== undefined ? city : existing.city,
        state: state !== undefined ? state : existing.state,
        country: country !== undefined ? country : existing.country,
        registrationNumber: registrationNumber !== undefined ? registrationNumber : existing.registrationNumber,
        taxId: taxId !== undefined ? taxId : existing.taxId,
        description: description !== undefined ? description : existing.description,
        serviceCategories: Array.isArray(serviceCategories) ? serviceCategories : existing.serviceCategories,
        operatingLocations: Array.isArray(operatingLocations) ? operatingLocations : existing.operatingLocations,
        netRateTerms: netRateTerms !== undefined ? netRateTerms : existing.netRateTerms,
        updatedAt: new Date(),
      })
      .where(eq(vendorsTable.id, existing.id))
      .returning();

    await logAuditAction({
      action: "SUPPLIER_UPDATED",
      resourceType: "vendor",
      resourceId: existing.id,
      previousValue: { businessName: existing.businessName, email: existing.email },
      newValue: { businessName: updated.businessName, email: updated.email },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({ status: "success", supplier: updated, vendor: updated, message: "Supplier updated successfully." });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to update supplier." });
  }
});

// Supplier Approval Workflow: Approve, Reject, Suspend, Reactivate (Admin)
// Supplier Approval & Disciplinary Workflow: Approve, Reject, Temporary Suspend, Permanent Suspend, Reactivate, Record Incident, Remove (Admin)
router.post(["/admin/suppliers/:id/status", "/admin/vendors/:id/status"], requireRole(["admin"]), async (req, res) => {
  const paramId = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const { action, reason, durationDays, suspensionUntil, notes, incidentType, areas } = req.body;

  try {
    const condition = isUuid(paramId)
      ? or(eq(vendorsTable.id, paramId), eq(vendorsTable.vendorId, paramId))
      : eq(vendorsTable.vendorId, paramId);

    const [vendor] = await db.select().from(vendorsTable).where(condition).limit(1);
    if (!vendor) {
      res.status(404).json({ status: "not_found", message: "Supplier not found." });
      return;
    }

    const currentStatus = (vendor.status || vendor.approvalStatus || "PENDING_APPROVAL").toUpperCase();
    const act = (action || "").toLowerCase().trim();

    let newStatus = vendor.status;
    let newApprovalStatus = vendor.approvalStatus;
    let newKycStatus = vendor.kycStatus;
    let newSuspensionType = vendor.suspensionType || "NONE";
    let newSuspensionReason = vendor.suspensionReason;
    let newSuspensionUntil: Date | null = vendor.suspensionUntil;
    let newSuspendedFrom: Date | null = vendor.suspendedFrom || null;
    let newSuspendedBy: string | null = vendor.suspendedBy || null;
    let newMisbehaviorStrikes = vendor.misbehaviorStrikes || 0;
    let newCustomerIssuesCount = vendor.customerIssuesCount || 0;
    let newDisciplinaryNotes = vendor.disciplinaryNotes || "";
    let newChangeRequestAreas = vendor.changeRequestAreas || [];
    let newChangeRequestMessage = vendor.changeRequestMessage || null;
    let newApprovedAt = vendor.approvedAt || null;

    const actorAdmin = (req as any).admin?.name || (req as any).admin?.email || (req as any).user?.fullName || "Admin";

    // Validate state transitions
    if (act === "approve") {
      if (currentStatus === "APPROVED") {
        res.status(400).json({ status: "invalid_transition", message: "Supplier is already approved." });
        return;
      }
      newStatus = "APPROVED";
      newApprovalStatus = "approved";
      newKycStatus = "verified";
      newSuspensionType = "NONE";
      newSuspensionReason = null;
      newSuspensionUntil = null;
      newSuspendedFrom = null;
      newSuspendedBy = null;
      newApprovedAt = new Date();
      newChangeRequestAreas = [];
      newChangeRequestMessage = null;
    } else if (act === "reject") {
      if (currentStatus !== "PENDING_APPROVAL" && currentStatus !== "PENDING" && currentStatus !== "UNDER_REVIEW" && currentStatus !== "CHANGES_REQUESTED") {
        res.status(400).json({
          status: "invalid_transition",
          message: `Cannot reject a supplier that is currently ${currentStatus}. Only pending or under-review suppliers can be rejected.`,
        });
        return;
      }
      newStatus = "REJECTED";
      newApprovalStatus = "rejected";
    } else if (act === "request_changes" || act === "request-changes" || act === "changes_requested") {
      if (currentStatus === "APPROVED" || currentStatus === "REMOVED") {
        res.status(400).json({
          status: "invalid_transition",
          message: `Cannot request changes for a supplier that is ${currentStatus}.`,
        });
        return;
      }
      newStatus = "CHANGES_REQUESTED";
      newApprovalStatus = "changes_requested";
      newChangeRequestAreas = Array.isArray(areas) ? areas : (areas ? [areas] : []);
      newChangeRequestMessage = reason || notes || "Additional verification documents or information required.";
      const timestampStr = new Date().toISOString();
      newDisciplinaryNotes = `${newDisciplinaryNotes ? newDisciplinaryNotes + "\n" : ""}[${timestampStr}] CHANGES REQUESTED: ${newChangeRequestMessage}`;
    } else if (act === "under_review" || act === "review") {
      newStatus = "UNDER_REVIEW";
      newApprovalStatus = "under_review";
    } else if (act === "suspend" || act === "temporary_suspend" || act === "suspend_temporary") {
      if (currentStatus !== "APPROVED") {
        res.status(400).json({
          status: "invalid_transition",
          message: `Cannot suspend a supplier that is ${currentStatus}. Only approved suppliers can be suspended.`,
        });
        return;
      }
      const isPermanentRequest = req.body?.suspensionType === "PERMANENT";
      newStatus = "SUSPENDED";
      newApprovalStatus = "suspended";
      newSuspensionType = isPermanentRequest ? "PERMANENT" : "TEMPORARY";
      newSuspensionReason = reason || (isPermanentRequest ? "Permanent administrative suspension" : "Temporary administrative suspension");
      const startDate = req.body?.startDate || req.body?.suspendedFrom ? new Date(req.body.startDate || req.body.suspendedFrom) : new Date();
      newSuspendedFrom = startDate;
      newSuspendedBy = actorAdmin;

      if (isPermanentRequest) {
        newSuspensionUntil = null;
      } else if (suspensionUntil) {
        newSuspensionUntil = new Date(suspensionUntil);
      } else if (durationDays && Number(durationDays) > 0) {
        newSuspensionUntil = new Date(startDate.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000);
      } else {
        newSuspensionUntil = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // default 7 days
      }

      await db.insert(supplierSuspensionsTable).values({
        vendorId: vendor.id,
        suspensionType: newSuspensionType,
        reason: newSuspensionReason,
        notes: notes || null,
        suspendedFrom: newSuspendedFrom,
        suspendedUntil: newSuspensionUntil,
        suspendedBy: newSuspendedBy,
      });

      const timestampStr = new Date().toISOString();
      newDisciplinaryNotes = `${newDisciplinaryNotes ? newDisciplinaryNotes + "\n" : ""}[${timestampStr}] ${newSuspensionType} SUSPENSION (${reason || "No reason"}): ${notes || ""}`;
    } else if (act === "permanent_suspend" || act === "blacklist" || act === "permanent_ban") {
      if (currentStatus !== "APPROVED" && currentStatus !== "SUSPENDED") {
        res.status(400).json({
          status: "invalid_transition",
          message: `Cannot permanently suspend a supplier that is ${currentStatus}.`,
        });
        return;
      }
      newStatus = "SUSPENDED";
      newApprovalStatus = "suspended";
      newSuspensionType = "PERMANENT";
      newSuspensionReason = reason || "Permanent blacklist due to repeated violations or serious misbehavior";
      newSuspensionUntil = null;
      newSuspendedFrom = new Date();
      newSuspendedBy = actorAdmin;

      await db.insert(supplierSuspensionsTable).values({
        vendorId: vendor.id,
        suspensionType: "PERMANENT",
        reason: newSuspensionReason,
        notes: notes || null,
        suspendedFrom: newSuspendedFrom,
        suspendedUntil: null,
        suspendedBy: newSuspendedBy,
      });

      const timestampStr = new Date().toISOString();
      newDisciplinaryNotes = `${newDisciplinaryNotes ? newDisciplinaryNotes + "\n" : ""}[${timestampStr}] PERMANENT BLACKLIST (${reason || "Violations"}): ${notes || "Vendor permanently banned from platform"}`;
    } else if (act === "reactivate" || act === "lift_suspension" || act === "lift-suspension") {
      if (currentStatus !== "SUSPENDED" && currentStatus !== "REJECTED") {
        res.status(400).json({
          status: "invalid_transition",
          message: `Cannot reactivate a supplier that is ${currentStatus}. Only suspended or rejected suppliers can be reactivated.`,
        });
        return;
      }
      newStatus = "APPROVED";
      newApprovalStatus = "approved";
      newKycStatus = "verified";
      newSuspensionType = "NONE";
      newSuspensionReason = null;
      newSuspensionUntil = null;
      newSuspendedFrom = null;
      newSuspendedBy = null;
      newApprovedAt = vendor.approvedAt || new Date();

      try {
        await db
          .update(supplierSuspensionsTable)
          .set({
            liftedAt: new Date(),
            liftedBy: actorAdmin,
            liftReason: reason || "Suspension lifted by admin",
          })
          .where(and(eq(supplierSuspensionsTable.vendorId, vendor.id), isNull(supplierSuspensionsTable.liftedAt)));
      } catch {
        // non-fatal
      }

      const timestampStr = new Date().toISOString();
      newDisciplinaryNotes = `${newDisciplinaryNotes ? newDisciplinaryNotes + "\n" : ""}[${timestampStr}] REINSTATED: Supplier reactivated by ${actorAdmin}.`;
    } else if (act === "record_incident" || act === "strike") {
      newMisbehaviorStrikes += 1;
      newCustomerIssuesCount += 1;
      const incType = incidentType || "VENDOR_MISBEHAVIOR";
      const timestampStr = new Date().toISOString();
      newDisciplinaryNotes = `${newDisciplinaryNotes ? newDisciplinaryNotes + "\n" : ""}[${timestampStr}] STRIKE #${newMisbehaviorStrikes} [${incType}]: ${reason || notes || "Misbehavior logged against vendor"}`;
    } else if (act === "remove") {
      newStatus = "REMOVED";
      newApprovalStatus = "removed";
      newSuspensionType = "PERMANENT";
      newSuspensionReason = reason || "Vendor offboarded and removed from platform";
      const timestampStr = new Date().toISOString();
      newDisciplinaryNotes = `${newDisciplinaryNotes ? newDisciplinaryNotes + "\n" : ""}[${timestampStr}] REMOVED: ${reason || "Removed by admin"}`;
    } else {
      res.status(400).json({
        status: "invalid_action",
        message: "Invalid action. Supported actions: approve, reject, request_changes, under_review, suspend, temporary_suspend, permanent_suspend, reactivate, record_incident, remove.",
      });
      return;
    }

    // When approving, ensure a corresponding User record exists with role 'vendor' so they can login immediately
    let userId = vendor.userId;
    if (newStatus === "APPROVED" && !userId) {
      const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, vendor.email.toLowerCase())).limit(1);
      if (existingUser && existingUser.role !== "vendor") {
        // The applicant never proved ownership of this e-mail address, so a real customer account must not be
        // upgraded (and force-verified) just because someone applied as a supplier with that address.
        res.status(409).json({
          status: "email_in_use",
          message: "This e-mail address already belongs to a customer account. Ask the supplier to apply with a different business e-mail.",
        });
        return;
      }
      if (existingUser) {
        userId = existingUser.id;
        await db
          .update(usersTable)
          .set({ vendorId: vendor.id })
          .where(eq(usersTable.id, existingUser.id));
      } else {
        const provisionedHash = vendor.temporaryPassword && PASSWORD_HASH_PATTERN.test(vendor.temporaryPassword)
          ? vendor.temporaryPassword
          : hashSupplierPassword(vendor.temporaryPassword);
        const [newUser] = await db
          .insert(usersTable)
          .values({
            email: vendor.email.toLowerCase(),
            fullName: vendor.contactName || vendor.businessName,
            phone: vendor.phone,
            passwordHash: provisionedHash,
            role: "vendor",
            vendorId: vendor.id,
            emailVerified: true,
            status: "active",
          })
          .returning();
        userId = newUser.id;
      }
    }

    let finalVendorId = vendor.vendorId;
    if (act === "approve" && (!finalVendorId || !finalVendorId.startsWith("ZLV-VND-"))) {
      finalVendorId = await generateNextVendorId();
    }

    const [updated] = await db
      .update(vendorsTable)
      .set({
        vendorId: finalVendorId,
        status: newStatus,
        approvalStatus: newApprovalStatus,
        kycStatus: newKycStatus,
        suspensionType: newSuspensionType,
        suspensionReason: newSuspensionReason,
        suspensionUntil: newSuspensionUntil,
        suspendedFrom: newSuspendedFrom,
        suspendedBy: newSuspendedBy,
        misbehaviorStrikes: newMisbehaviorStrikes,
        customerIssuesCount: newCustomerIssuesCount,
        disciplinaryNotes: newDisciplinaryNotes,
        changeRequestAreas: newChangeRequestAreas,
        changeRequestMessage: newChangeRequestMessage,
        approvedAt: newApprovedAt,
        userId: userId || vendor.userId,
        updatedAt: new Date(),
      })
      .where(eq(vendorsTable.id, vendor.id))
      .returning();

    await logAuditAction({
      action: `SUPPLIER_${act.toUpperCase()}`,
      resourceType: "vendor",
      resourceId: vendor.id,
      previousValue: { status: currentStatus, approvalStatus: vendor.approvalStatus, suspensionType: vendor.suspensionType },
      newValue: {
        status: newStatus,
        approvalStatus: newApprovalStatus,
        suspensionType: newSuspensionType,
        suspensionUntil: newSuspensionUntil,
        misbehaviorStrikes: newMisbehaviorStrikes,
        action: act,
        reason,
        areas: newChangeRequestAreas,
      },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    try {
      let notifTitle = `Supplier Application Status: ${newStatus}`;
      let notifBody = `Supplier "${vendor.businessName}" status changed to ${newStatus}.`;
      if (newStatus === "APPROVED") {
        notifTitle = "Supplier Application Approved!";
        notifBody = `Supplier "${vendor.businessName}" (${vendor.vendorId}) has been approved and activated for vendor portal access.`;
      } else if (newStatus === "CHANGES_REQUESTED") {
        notifTitle = "Supplier Changes Requested";
        notifBody = `Changes requested for supplier "${vendor.businessName}": ${newChangeRequestMessage || "Please update required documents."}`;
      } else if (newStatus === "REJECTED") {
        notifTitle = "Supplier Application Rejected";
        notifBody = `Application for "${vendor.businessName}" was rejected: ${reason || "Does not meet verification criteria."}`;
      }

      await db.insert(notificationsTable).values({
        userId: userId || vendor.userId || null,
        type: `SUPPLIER_${newStatus}`,
        title: notifTitle,
        body: notifBody,
        channel: "email",
        status: "SENT",
        metadata: {
          vendorId: vendor.id,
          supplierNumber: vendor.vendorId,
          email: vendor.email,
          newStatus,
          reason: newChangeRequestMessage || reason,
          areas: newChangeRequestAreas,
        },
      });
    } catch {
      // non-fatal
    }

    const { temporaryPassword: _, ...safeSupplier } = updated;
    res.json({
      status: "success",
      supplier: safeSupplier,
      vendor: safeSupplier,
      message: `Supplier successfully transitioned: action ${act} applied (${newStatus}).`,
    });
  } catch (error: any) {
    console.error("[Supplier Status Update Error]", error);
    res.status(500).json({ status: "error", message: "Failed to update supplier status. Please try again." });
  }
});

// Remove / Delete Vendor (Admin)
router.delete(["/admin/suppliers/:id", "/admin/vendors/:id"], requireRole(["admin"]), async (req, res) => {
  const paramId = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const force = req.query.force === "true";

  try {
    const condition = isUuid(paramId)
      ? or(eq(vendorsTable.id, paramId), eq(vendorsTable.vendorId, paramId))
      : eq(vendorsTable.vendorId, paramId);

    const [vendor] = await db.select().from(vendorsTable).where(condition).limit(1);
    if (!vendor) {
      res.status(404).json({ status: "not_found", message: "Supplier not found." });
      return;
    }

    // Check for active assigned tasks
    const activeTasks = await db
      .select()
      .from(bookingServicesTable)
      .where(
        and(
          eq(bookingServicesTable.assignedVendorId, vendor.id),
          or(eq(bookingServicesTable.status, "REQUESTED"), eq(bookingServicesTable.status, "ACCEPTED"))
        )
      );

    if (activeTasks.length > 0 && !force) {
      res.status(400).json({
        status: "has_active_bookings",
        message: `Cannot remove vendor with ${activeTasks.length} active booking fulfillment tasks. Please reassign the tasks first or use force remove.`,
        activeTasksCount: activeTasks.length,
      });
      return;
    }

    // Unassign pending tasks if force
    if (activeTasks.length > 0 && force) {
      await db
        .update(bookingServicesTable)
        .set({ assignedVendorId: null, status: "PENDING" })
        .where(eq(bookingServicesTable.assignedVendorId, vendor.id));
    }

    // Soft-remove by setting status to REMOVED
    const [updated] = await db
      .update(vendorsTable)
      .set({
        status: "REMOVED",
        approvalStatus: "removed",
        suspensionType: "PERMANENT",
        suspensionReason: "Vendor removed / offboarded by admin",
        updatedAt: new Date(),
      })
      .where(eq(vendorsTable.id, vendor.id))
      .returning();

    await logAuditAction({
      action: "SUPPLIER_REMOVED",
      resourceType: "vendor",
      resourceId: vendor.id,
      previousValue: { status: vendor.status, businessName: vendor.businessName },
      newValue: { status: "REMOVED", removedAt: new Date() },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({
      status: "success",
      message: `Vendor ${vendor.businessName} (${vendor.vendorId}) has been safely removed from active operations.`,
      supplier: updated,
      vendor: updated,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to remove supplier." });
  }
});

// Update vendor metrics (recalculates Trip Confidence Score)
router.put(["/admin/suppliers/:id/metrics", "/admin/vendors/:id/metrics"], requireRole(["admin", "operations_manager"]), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const { acceptanceRate, avgResponseMinutes, cancellationRate, customerIssuesCount } = req.body;

  try {
    const condition = isUuid(id)
      ? or(eq(vendorsTable.id, id), eq(vendorsTable.vendorId, id))
      : eq(vendorsTable.vendorId, id);

    const [updated] = await db
      .update(vendorsTable)
      .set({
        acceptanceRate: acceptanceRate !== undefined ? String(acceptanceRate) : undefined,
        avgResponseMinutes: avgResponseMinutes !== undefined ? String(avgResponseMinutes) : undefined,
        cancellationRate: cancellationRate !== undefined ? String(cancellationRate) : undefined,
        customerIssuesCount: customerIssuesCount !== undefined ? Number(customerIssuesCount) : undefined,
        updatedAt: new Date(),
      })
      .where(condition)
      .returning();

    if (!updated) {
      res.status(404).json({ status: "not_found", message: "Vendor not found." });
      return;
    }

    await logAuditAction({
      action: "VENDOR_METRICS_UPDATED",
      resourceType: "vendor",
      resourceId: updated.id,
      newValue: { acceptanceRate, avgResponseMinutes, cancellationRate },
      actorRole: "operations",
    });

    res.json({ vendor: updated, supplier: updated });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to update vendor metrics." });
  }
});

// --------------------------------------------------------------------------
// 2. Supplier Documents Management (Admin & Vendor)
// --------------------------------------------------------------------------

// Admin: Get Supplier Documents
router.get("/admin/suppliers/:id/documents", requireRole(["admin", "operations_manager"]), async (req, res) => {
  const paramId = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  try {
    const condition = isUuid(paramId)
      ? or(eq(vendorsTable.id, paramId), eq(vendorsTable.vendorId, paramId))
      : eq(vendorsTable.vendorId, paramId);

    const [vendor] = await db.select().from(vendorsTable).where(condition).limit(1);
    if (!vendor) {
      res.status(404).json({ status: "not_found", message: "Supplier not found." });
      return;
    }

    const docs = await db
      .select()
      .from(vendorDocumentsTable)
      .where(eq(vendorDocumentsTable.vendorId, vendor.id))
      .orderBy(desc(vendorDocumentsTable.createdAt));

    res.json({ documents: docs });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to fetch documents." });
  }
});

// Admin: Upload Document for Supplier
router.post("/admin/suppliers/:id/documents", requireRole(["admin"]), async (req, res) => {
  const paramId = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const { documentType, title, fileName, fileUrl, fileSize, mimeType } = req.body;

  if (!title || !fileUrl) {
    res.status(400).json({ status: "invalid_request", message: "Title and file URL are required." });
    return;
  }

  try {
    const condition = isUuid(paramId)
      ? or(eq(vendorsTable.id, paramId), eq(vendorsTable.vendorId, paramId))
      : eq(vendorsTable.vendorId, paramId);

    const [vendor] = await db.select().from(vendorsTable).where(condition).limit(1);
    if (!vendor) {
      res.status(404).json({ status: "not_found", message: "Supplier not found." });
      return;
    }

    const [doc] = await db
      .insert(vendorDocumentsTable)
      .values({
        vendorId: vendor.id,
        documentType: documentType || "other",
        title: title.trim(),
        fileName: fileName || `${title.replace(/\s+/g, "_")}.pdf`,
        fileUrl,
        fileSize: fileSize || 0,
        mimeType: mimeType || "application/pdf",
        status: "verified",
        verifiedBy: (req as any).admin?.adminId || "Admin",
        verifiedAt: new Date(),
      })
      .returning();

    await logAuditAction({
      action: "SUPPLIER_DOCUMENT_UPLOADED",
      resourceType: "vendor_document",
      resourceId: doc.id,
      newValue: { title: doc.title, documentType: doc.documentType },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.status(201).json({ status: "success", document: doc, message: "Document uploaded and verified." });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to upload document." });
  }
});

// Admin: Verify Document
router.post("/admin/suppliers/:id/documents/:docId/verify", requireRole(["admin"]), async (req, res) => {
  const docId = typeof req.params.docId === "string" ? req.params.docId : String(req.params.docId || "");
  try {
    const [doc] = await db.select().from(vendorDocumentsTable).where(eq(vendorDocumentsTable.id, docId)).limit(1);
    if (!doc) {
      res.status(404).json({ status: "not_found", message: "Document not found." });
      return;
    }

    const [updated] = await db
      .update(vendorDocumentsTable)
      .set({
        status: "verified",
        verifiedBy: (req as any).admin?.adminId || "Admin",
        verifiedAt: new Date(),
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(vendorDocumentsTable.id, docId))
      .returning();

    await logAuditAction({
      action: "SUPPLIER_DOCUMENT_VERIFIED",
      resourceType: "vendor_document",
      resourceId: docId,
      newValue: { status: "verified" },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({ status: "success", document: updated, message: "Document verified successfully." });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to verify document." });
  }
});

// Admin: Reject Document
router.post("/admin/suppliers/:id/documents/:docId/reject", requireRole(["admin"]), async (req, res) => {
  const docId = typeof req.params.docId === "string" ? req.params.docId : String(req.params.docId || "");
  const { reason } = req.body;
  try {
    const [doc] = await db.select().from(vendorDocumentsTable).where(eq(vendorDocumentsTable.id, docId)).limit(1);
    if (!doc) {
      res.status(404).json({ status: "not_found", message: "Document not found." });
      return;
    }

    const [updated] = await db
      .update(vendorDocumentsTable)
      .set({
        status: "rejected",
        rejectionReason: reason || "Document rejected by admin.",
        updatedAt: new Date(),
      })
      .where(eq(vendorDocumentsTable.id, docId))
      .returning();

    await logAuditAction({
      action: "SUPPLIER_DOCUMENT_REJECTED",
      resourceType: "vendor_document",
      resourceId: docId,
      newValue: { status: "rejected", reason },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.json({ status: "success", document: updated, message: "Document marked rejected." });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to reject document." });
  }
});

// --------------------------------------------------------------------------
// 3. Supplier Services Management (Admin & Vendor)
// --------------------------------------------------------------------------

// Admin: List Supplier Services
router.get("/admin/suppliers/:id/services", requireRole(["admin", "operations_manager"]), async (req, res) => {
  const paramId = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  try {
    const condition = isUuid(paramId)
      ? or(eq(vendorsTable.id, paramId), eq(vendorsTable.vendorId, paramId))
      : eq(vendorsTable.vendorId, paramId);

    const [vendor] = await db.select().from(vendorsTable).where(condition).limit(1);
    if (!vendor) {
      res.status(404).json({ status: "not_found", message: "Supplier not found." });
      return;
    }

    const services = await db
      .select()
      .from(vendorServicesTable)
      .where(eq(vendorServicesTable.vendorId, vendor.id))
      .orderBy(desc(vendorServicesTable.createdAt));

    res.json({ services });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to fetch services." });
  }
});

// Admin: Add Supplier Service
router.post("/admin/suppliers/:id/services", requireRole(["admin"]), async (req, res) => {
  const paramId = typeof req.params.id === "string" ? req.params.id : String(req.params.id || "");
  const { serviceType, title, location, rate, capacity, availability, description, details } = req.body;

  if (!serviceType || !title || !location) {
    res.status(400).json({ status: "invalid_request", message: "Service type, title, and location are required." });
    return;
  }

  try {
    const condition = isUuid(paramId)
      ? or(eq(vendorsTable.id, paramId), eq(vendorsTable.vendorId, paramId))
      : eq(vendorsTable.vendorId, paramId);

    const [vendor] = await db.select().from(vendorsTable).where(condition).limit(1);
    if (!vendor) {
      res.status(404).json({ status: "not_found", message: "Supplier not found." });
      return;
    }

    const [svc] = await db
      .insert(vendorServicesTable)
      .values({
        vendorId: vendor.id,
        serviceType: serviceType.toLowerCase(),
        title: title.trim(),
        location: location.trim(),
        rate: Number(rate) || 0,
        capacity: Number(capacity) || 1,
        availability: availability || "Available",
        description: description || null,
        details: details || {},
        status: "active",
      })
      .returning();

    await logAuditAction({
      action: "SUPPLIER_SERVICE_ADDED",
      resourceType: "vendor_service",
      resourceId: svc.id,
      newValue: { title: svc.title, serviceType: svc.serviceType, rate: svc.rate },
      actorAdminId: (req as any).admin?.id,
      actorRole: "admin",
    });

    res.status(201).json({ status: "success", service: svc, message: "Service added successfully." });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to add service." });
  }
});

// Admin: Get Approved Supplier Services (For Package Creation Integration)
router.get("/admin/supplier-services/approved", requireRole(["admin", "operations_manager"]), async (_req, res) => {
  try {
    // Only return services from APPROVED suppliers
    const approvedServices = await db
      .select({
        service: vendorServicesTable,
        supplierName: vendorsTable.businessName,
        supplierId: vendorsTable.vendorId,
        supplierEmail: vendorsTable.email,
        supplierPhone: vendorsTable.phone,
        approvalStatus: vendorsTable.approvalStatus,
      })
      .from(vendorServicesTable)
      .innerJoin(vendorsTable, eq(vendorServicesTable.vendorId, vendorsTable.id))
      .where(
        and(
          or(eq(vendorsTable.status, "APPROVED"), eq(vendorsTable.approvalStatus, "approved")),
          eq(vendorServicesTable.status, "active")
        )
      )
      .orderBy(desc(vendorServicesTable.createdAt));

    res.json({ services: approvedServices });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Failed to fetch approved supplier services." });
  }
});

// --------------------------------------------------------------------------
// 4. Vendor Authentication & Portal APIs (Section 9: Vendor Role)
// --------------------------------------------------------------------------

// Dedicated Vendor Login Endpoint
const vendorLoginSchema = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(200),
});

router.post("/vendor/login", async (req, res): Promise<void> => {
  const parsedLogin = vendorLoginSchema.safeParse(req.body);
  if (!parsedLogin.success) {
    res.status(400).json({ status: "invalid_request", message: "Email and password are required." });
    return;
  }
  const { email, password } = parsedLogin.data;

  try {
    const cleanEmail = email.toLowerCase();
    let [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.email, cleanEmail)).limit(1);

    const rejectCredentials = () =>
      res.status(401).json({ status: "invalid_credentials", message: "Invalid email or password." });

    if (!vendor) {
      verifyPassword(password, DUMMY_PASSWORD_HASH);
      rejectCredentials();
      return;
    }

    // 1. Prove the password first, so nothing about an account's state is revealed to anyone who does not know it
    let userVerified = false;
    let userRecord: any = null;

    if (vendor.userId) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, vendor.userId)).limit(1);
      if (u && u.passwordHash && verifyPassword(password, u.passwordHash)) {
        userVerified = true;
        userRecord = u;
      }
    }

    if (!userVerified) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);
      if (u) {
        if (u.passwordHash && verifyPassword(password, u.passwordHash)) {
          userVerified = true;
          userRecord = u;
        }
      } else if (verifySupplierPassword(vendor, password)) {
        userVerified = true; // no user row yet: the application password is the proof
      }
    }

    if (!userVerified) {
      rejectCredentials();
      return;
    }

    // Auto-lift if temporary suspension duration has passed
    vendor = await checkAutoLiftVendorSuspension(vendor);

    // 2. ALLOWLIST: only an APPROVED supplier may log in. Every other state (present or future) is denied.
    const currentStatus = (vendor.status || vendor.approvalStatus || "").toUpperCase();
    if (currentStatus !== "APPROVED") {
      if (currentStatus === "REJECTED") {
        res.status(403).json({
          status: "account_rejected",
          message: "Your supplier registration was rejected. Please contact administrator.",
        });
        return;
      }
      if (currentStatus === "SUSPENDED" || currentStatus === "REMOVED") {
        const isPermanent = vendor.suspensionType === "PERMANENT" || currentStatus === "REMOVED";
        const untilStr = vendor.suspensionUntil ? new Date(vendor.suspensionUntil).toLocaleDateString() : "";
        const msg = isPermanent
          ? `Your supplier account has been permanently suspended or blacklisted. Reason: ${vendor.suspensionReason || "Violation of supplier code of conduct"}`
          : `Your supplier account has been temporarily suspended${untilStr ? ` until ${untilStr}` : ""}. Reason: ${vendor.suspensionReason || "Administrative review"}`;
        res.status(403).json({
          status: "account_suspended",
          suspensionType: vendor.suspensionType || (isPermanent ? "PERMANENT" : "TEMPORARY"),
          suspensionUntil: vendor.suspensionUntil,
          suspensionReason: vendor.suspensionReason,
          message: msg,
        });
        return;
      }
      res.status(403).json({
        status: "pending_approval",
        message: "Your supplier account is not approved yet. You will receive portal access once approved by admin.",
      });
      return;
    }

    // 3. Ensure a user record exists with role 'vendor'
    if (!userRecord) {
      const provisionedHash = vendor.temporaryPassword && PASSWORD_HASH_PATTERN.test(vendor.temporaryPassword)
        ? vendor.temporaryPassword
        : hashSupplierPassword(password);
      const [newUser] = await db
        .insert(usersTable)
        .values({
          email: cleanEmail,
          fullName: vendor.contactName || vendor.businessName,
          phone: vendor.phone,
          passwordHash: provisionedHash,
          role: "vendor",
          vendorId: vendor.id,
          emailVerified: true,
          status: "active",
        })
        .returning();
      userRecord = newUser;
      await db.update(vendorsTable).set({ userId: newUser.id }).where(eq(vendorsTable.id, vendor.id));
    } else {
      await db
        .update(usersTable)
        .set({ role: "vendor", vendorId: vendor.id, lastLoginAt: new Date() })
        .where(eq(usersTable.id, userRecord.id));
    }

    await createSession(userRecord.id, res);

    await logAuditAction({
      action: "VENDOR_LOGIN_SUCCESS",
      resourceType: "vendor",
      resourceId: vendor.id,
      actorName: vendor.businessName,
      actorRole: "vendor",
    });

    res.json({
      status: "success",
      user: publicUser(userRecord),
      vendor: vendorForOwner(vendor),
      message: "Supplier login successful.",
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: "Login request failed." });
  }
});

// Helper to resolve current vendor's record with strict authentication and IDOR protection (ZEL-04)
async function resolveCurrentVendor(req: any) {
  const isInternalStaff = Boolean(
    (req as any).admin ||
    (req.user && (req.user.role === "admin" || req.user.role === "operations_manager"))
  );

  // 1. Internal staff (admin/operations) can inspect a specific vendor via query or header
  if (isInternalStaff) {
    const headerVendorId = req.headers["x-vendor-id"];
    const targetVendorKey = (req.query?.vendorId || headerVendorId) as string | undefined;
    if (targetVendorKey && typeof targetVendorKey === "string") {
      const condition = isUuid(targetVendorKey)
        ? or(eq(vendorsTable.id, targetVendorKey), eq(vendorsTable.vendorId, targetVendorKey))
        : eq(vendorsTable.vendorId, targetVendorKey);
      const [v] = await db.select().from(vendorsTable).where(condition).limit(1);
      if (v) return v;
    }

    const [firstApproved] = await db.select().from(vendorsTable).where(eq(vendorsTable.approvalStatus, "approved")).limit(1);
    if (firstApproved) return firstApproved;

    const [anyVendor] = await db.select().from(vendorsTable).limit(1);
    return anyVendor || null;
  }

  // 2. Authenticated vendor user: strictly resolved from their own account
  // Reject cross-tenant header spoofing attempts
  if (req.user && req.user.role === "vendor") {
    const requestedVendor = (req.query?.vendorId || req.headers["x-vendor-id"]) as string | undefined;
    if (requestedVendor && req.user.vendorId && requestedVendor !== req.user.vendorId) {
      return null;
    }

    if (req.user.vendorId) {
      let [v] = await db
        .select()
        .from(vendorsTable)
        .where(or(eq(vendorsTable.id, req.user.vendorId), eq(vendorsTable.vendorId, req.user.vendorId)))
        .limit(1);
      if (v) {
        v = await checkAutoLiftVendorSuspension(v);
        const st = (v.status || v.approvalStatus || "").toUpperCase();
        if (st === "APPROVED" || st === "SUSPENDED") return v;
        return null;
      }
    }

    if (req.user.email) {
      let [v] = await db.select().from(vendorsTable).where(eq(vendorsTable.email, req.user.email)).limit(1);
      if (v) {
        v = await checkAutoLiftVendorSuspension(v);
        const st = (v.status || v.approvalStatus || "").toUpperCase();
        if (st === "APPROVED" || st === "SUSPENDED") return v;
        return null;
      }
    }
  }

  return null;
}

// Vendor Dashboard Summary (strictly scoped)
router.get(["/vendor/portal/dashboard", "/vendor/dashboard"], requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      if (!req.user && !(req as any).admin) {
        res.status(401).json({ status: "unauthorized", message: "Vendor authentication required." });
        return;
      }
      res.status(403).json({ status: "forbidden", message: "Vendor profile not found or access denied." });
      return;
    }

    // Pending requests
    const [pendingRequestsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookingServicesTable)
      .where(and(eq(bookingServicesTable.assignedVendorId, vendor.id), eq(bookingServicesTable.status, "REQUESTED")));

    // Active accepted tasks
    const [activeTasksCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookingServicesTable)
      .where(and(eq(bookingServicesTable.assignedVendorId, vendor.id), eq(bookingServicesTable.status, "ACCEPTED")));

    // Completed & verified tasks
    const [completedTasksCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookingServicesTable)
      .where(and(eq(bookingServicesTable.assignedVendorId, vendor.id), eq(bookingServicesTable.status, "VERIFIED")));

    // Total invoiced
    const [invoiceSummary] = await db
      .select({
        totalAmount: sql<number>`coalesce(sum(${vendorInvoicesTable.amount}), 0)`,
      })
      .from(vendorInvoicesTable)
      .where(eq(vendorInvoicesTable.vendorId, vendor.id));

    // Active services count
    const [servicesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vendorServicesTable)
      .where(and(eq(vendorServicesTable.vendorId, vendor.id), eq(vendorServicesTable.status, "active")));

    // Documents count
    const [documentsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vendorDocumentsTable)
      .where(eq(vendorDocumentsTable.vendorId, vendor.id));

    res.json({
      status: "success",
      vendor,
      stats: {
        pendingRequests: Number(pendingRequestsCount?.count || 0),
        activeTasks: Number(activeTasksCount?.count || 0),
        completedTasks: Number(completedTasksCount?.count || 0),
        totalInvoiced: Number(invoiceSummary?.totalAmount || 0),
        activeServices: Number(servicesCount?.count || 0),
        totalDocuments: Number(documentsCount?.count || 0),
        performanceMetrics: {
          acceptanceRate: Number(vendor.acceptanceRate || 100),
          avgResponseMinutes: Number(vendor.avgResponseMinutes || 30),
          cancellationRate: Number(vendor.cancellationRate || 0),
          customerIssuesCount: Number(vendor.customerIssuesCount || 0),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to fetch vendor dashboard." });
  }
});

// Vendor Booking Request Inbox (strictly scoped)
router.get(["/vendor/portal/requests", "/vendor/portal/tasks", "/vendor/requests"], requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor profile not found or access denied." });
      return;
    }

    const rows = await db
      .select({
        task: bookingServicesTable,
        bookingRef: bookingsTable.bookingId,
        travelDate: bookingsTable.travelDate,
        adults: bookingsTable.adultsCount,
        children: bookingsTable.childrenCount,
      })
      .from(bookingServicesTable)
      .leftJoin(bookingsTable, eq(bookingServicesTable.bookingId, bookingsTable.id))
      .where(eq(bookingServicesTable.assignedVendorId, vendor.id))
      .orderBy(desc(bookingServicesTable.createdAt));

    const requests = rows.map((r: any) => ({
      ...r.task,
      task: r.task,
      bookingRef: r.bookingRef,
      travelDate: r.travelDate,
      adults: r.adults,
      children: r.children,
    }));

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to fetch vendor requests." });
  }
});

// Vendor Accept Request Workflow (with IDOR protection)
router.post(["/vendor/portal/requests/:taskId/accept", "/vendor/requests/:taskId/accept"], requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  const taskId = typeof req.params.taskId === "string" ? req.params.taskId : String(req.params.taskId || "");
  const confirmationRef =
    req.body?.confirmationRef || req.body?.confirmationReference || req.body?.supplierConfirmationRef;
  const notes = req.body?.notes;

  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor authorization required." });
      return;
    }

    const [task] = await db
      .select()
      .from(bookingServicesTable)
      .where(eq(bookingServicesTable.id, taskId))
      .limit(1);

    if (!task) {
      res.status(404).json({ status: "not_found", message: "Task not found." });
      return;
    }

    // Strict IDOR Check: Ensure task is assigned to THIS vendor
    if (task.assignedVendorId !== vendor.id) {
      res.status(403).json({ status: "forbidden", message: "Not authorized to access tasks assigned to another vendor." });
      return;
    }

    // Task 10: Suspended suppliers cannot accept tasks
    const effectiveVendor = await checkAutoLiftVendorSuspension(vendor);
    const vendorStatus = (effectiveVendor.status || effectiveVendor.approvalStatus || "").toUpperCase();
    if (vendorStatus === "SUSPENDED" || effectiveVendor.suspensionType === "TEMPORARY" || effectiveVendor.suspensionType === "PERMANENT") {
      res.status(403).json({
        status: "account_suspended",
        message: "Your supplier account is currently suspended and cannot accept tasks.",
      });
      return;
    }

    const [updated] = await db
      .update(bookingServicesTable)
      .set({
        status: "ACCEPTED",
        supplierConfirmationRef: confirmationRef || `CONF-${Date.now().toString().slice(-6)}`,
        acceptedAt: new Date(),
        notes: notes ? `${task.notes || ""}\nVendor Note: ${notes}` : task.notes,
        updatedAt: new Date(),
      })
      .where(eq(bookingServicesTable.id, taskId))
      .returning();

    await logAuditAction({
      action: "VENDOR_ACCEPTED_REQUEST",
      resourceType: "booking_service",
      resourceId: taskId,
      newValue: { status: "ACCEPTED", confirmationRef: updated.supplierConfirmationRef },
      actorName: vendor?.businessName || "Vendor",
      actorRole: "vendor",
    });

    res.json({
      status: "success",
      task: updated,
      message: "Booking request accepted. Awaiting Operations verification.",
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error?.message || "Failed to accept booking request." });
  }
});

// Vendor Reject Request Workflow (with IDOR protection)
router.post(["/vendor/portal/requests/:taskId/reject", "/vendor/requests/:taskId/reject"], requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  const taskId = typeof req.params.taskId === "string" ? req.params.taskId : String(req.params.taskId || "");
  const { reason } = req.body;

  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor authorization required." });
      return;
    }

    const [task] = await db
      .select()
      .from(bookingServicesTable)
      .where(eq(bookingServicesTable.id, taskId))
      .limit(1);

    if (!task) {
      res.status(404).json({ status: "not_found", message: "Task not found." });
      return;
    }

    // Strict IDOR Check
    if (task.assignedVendorId !== vendor.id) {
      res.status(403).json({ status: "forbidden", message: "Not authorized to access tasks assigned to another vendor." });
      return;
    }

    const [updated] = await db
      .update(bookingServicesTable)
      .set({
        status: "REJECTED",
        rejectionReason: reason || "Vendor unavailable",
        updatedAt: new Date(),
      })
      .where(eq(bookingServicesTable.id, taskId))
      .returning();

    await logAuditAction({
      action: "VENDOR_REJECTED_REQUEST",
      resourceType: "booking_service",
      resourceId: taskId,
      newValue: { status: "REJECTED", rejectionReason: reason },
      actorName: vendor?.businessName || "Vendor",
      actorRole: "vendor",
    });

    res.json({
      status: "success",
      task: updated,
      message: "Booking request rejected. Operations will reassign.",
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error?.message || "Failed to reject booking request." });
  }
});

// Vendor Request Change Workflow (with IDOR protection)
router.post(["/vendor/portal/requests/:taskId/request-change", "/vendor/requests/:taskId/request-change"], requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  const taskId = typeof req.params.taskId === "string" ? req.params.taskId : String(req.params.taskId || "");
  const { notes, changeDetails } = req.body;

  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor authorization required." });
      return;
    }

    const [task] = await db
      .select()
      .from(bookingServicesTable)
      .where(eq(bookingServicesTable.id, taskId))
      .limit(1);

    if (!task) {
      res.status(404).json({ status: "not_found", message: "Task not found." });
      return;
    }

    if (task.assignedVendorId !== vendor.id) {
      res.status(403).json({ status: "forbidden", message: "Not authorized to access tasks assigned to another vendor." });
      return;
    }

    const noteEntry = `Vendor Change Request: ${notes || "Vendor requested modification to dates or capacity."}`;
    const [updated] = await db
      .update(bookingServicesTable)
      .set({
        notes: task.notes ? `${task.notes}\n${noteEntry}` : noteEntry,
        updatedAt: new Date(),
      })
      .where(eq(bookingServicesTable.id, taskId))
      .returning();

    await logAuditAction({
      action: "VENDOR_REQUESTED_CHANGE",
      resourceType: "booking_service",
      resourceId: taskId,
      newValue: { notes: noteEntry, changeDetails },
      actorName: vendor?.businessName || "Vendor",
      actorRole: "vendor",
    });

    res.json({
      status: "success",
      task: updated,
      message: "Change request submitted to Operations team.",
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error?.message || "Failed to submit change request." });
  }
});

// Vendor Document Upload (Voucher / Invoice)
router.post(
  [
    "/vendor/portal/requests/:taskId/upload-document",
    "/vendor/requests/:taskId/voucher",
    "/vendor/portal/requests/:taskId/voucher",
  ],
  requireRole(["vendor", "admin", "operations_manager"]),
  async (req, res) => {
    const taskId = typeof req.params.taskId === "string" ? req.params.taskId : String(req.params.taskId || "");
    const documentType = req.body?.documentType;
    const docUrl = req.body?.documentUrl || req.body?.voucherUrl || req.body?.fileUrl;
    const confirmationRef =
      req.body?.confirmationRef || req.body?.confirmationReference || req.body?.supplierConfirmationRef;

    try {
      const vendor = await resolveCurrentVendor(req);
      if (!vendor) {
        res.status(403).json({ status: "forbidden", message: "Vendor authorization required." });
        return;
      }

      const [task] = await db
        .select()
        .from(bookingServicesTable)
        .where(eq(bookingServicesTable.id, taskId))
        .limit(1);

      if (!task) {
        res.status(404).json({ status: "not_found", message: "Task not found." });
        return;
      }

      if (task.assignedVendorId !== vendor.id) {
        res.status(403).json({ status: "forbidden", message: "Not authorized to access tasks assigned to another vendor." });
        return;
      }

      if (docUrl !== undefined && !isSafeDocumentUrl(docUrl)) {
        res.status(400).json({ status: "invalid_request", message: "The document URL is not valid." });
        return;
      }

      const updateFields: any = { updatedAt: new Date() };
      if (documentType === "invoice") {
        updateFields.invoiceUrl = docUrl;
      } else {
        updateFields.voucherUrl = docUrl;
      }
      if (confirmationRef) {
        updateFields.supplierConfirmationRef = confirmationRef;
      }

    const [updated] = await db
      .update(bookingServicesTable)
      .set(updateFields)
      .where(eq(bookingServicesTable.id, taskId))
      .returning();

    res.json({
      status: "success",
      task: updated,
      message: `${documentType === "invoice" ? "Invoice" : "Voucher"} uploaded successfully.`,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to upload document." });
  }
});

// Vendor Portal: Manage Services (strictly isolated)
router.get("/vendor/portal/services", requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor profile not found or access denied." });
      return;
    }

    const services = await db
      .select()
      .from(vendorServicesTable)
      .where(eq(vendorServicesTable.vendorId, vendor.id))
      .orderBy(desc(vendorServicesTable.createdAt));

    res.json({ services, serviceCategories: vendor.serviceCategories });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to fetch vendor services." });
  }
});

router.post("/vendor/portal/services", requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor authorization required." });
      return;
    }

    const { serviceType, title, location, rate, capacity, availability, description, details } = req.body;

    if (!serviceType || !title || !location) {
      res.status(400).json({ status: "invalid_request", message: "Service type, title, and location are required." });
      return;
    }

    const [service] = await db
      .insert(vendorServicesTable)
      .values({
        vendorId: vendor.id,
        serviceType: serviceType.toLowerCase(),
        title: title.trim(),
        location: location.trim(),
        rate: Number(rate) || 0,
        capacity: Number(capacity) || 1,
        availability: availability || "Available",
        description: description || null,
        details: details || {},
        status: "active",
      })
      .returning();

    res.status(201).json({ status: "success", service, message: "Service created successfully." });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to create service." });
  }
});

router.put("/vendor/portal/services/:serviceId", requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  const serviceId = typeof req.params.serviceId === "string" ? req.params.serviceId : String(req.params.serviceId || "");
  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor authorization required." });
      return;
    }

    const [existing] = await db.select().from(vendorServicesTable).where(eq(vendorServicesTable.id, serviceId)).limit(1);
    if (!existing) {
      res.status(404).json({ status: "not_found", message: "Service not found." });
      return;
    }

    // IDOR check: cannot edit service of another vendor
    if (existing.vendorId !== vendor.id) {
      res.status(403).json({ status: "forbidden", message: "Cross-tenant service modification must be rejected with 403 Forbidden" });
      return;
    }

    const { serviceType, title, location, rate, capacity, availability, description, details, status } = req.body;

    const [updated] = await db
      .update(vendorServicesTable)
      .set({
        serviceType: serviceType ? serviceType.toLowerCase() : existing.serviceType,
        title: title ? title.trim() : existing.title,
        location: location ? location.trim() : existing.location,
        rate: rate !== undefined ? Number(rate) : existing.rate,
        capacity: capacity !== undefined ? Number(capacity) : existing.capacity,
        availability: availability || existing.availability,
        description: description !== undefined ? description : existing.description,
        details: details !== undefined ? details : existing.details,
        status: status || existing.status,
        updatedAt: new Date(),
      })
      .where(eq(vendorServicesTable.id, serviceId))
      .returning();

    res.json({ status: "success", service: updated, message: "Service updated successfully." });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to update service." });
  }
});

router.delete("/vendor/portal/services/:serviceId", requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  const serviceId = typeof req.params.serviceId === "string" ? req.params.serviceId : String(req.params.serviceId || "");
  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor authorization required." });
      return;
    }

    const [existing] = await db.select().from(vendorServicesTable).where(eq(vendorServicesTable.id, serviceId)).limit(1);
    if (!existing) {
      res.status(404).json({ status: "not_found", message: "Service not found." });
      return;
    }

    // IDOR check
    if (existing.vendorId !== vendor.id) {
      res.status(403).json({ status: "forbidden", message: "You are not authorized to delete this service." });
      return;
    }

    await db.delete(vendorServicesTable).where(eq(vendorServicesTable.id, serviceId));
    res.json({ status: "success", message: "Service deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to delete service." });
  }
});

// Vendor Portal: Manage Own Documents (strictly isolated)
router.get("/vendor/portal/documents", requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor profile not found or access denied." });
      return;
    }

    const documents = await db
      .select()
      .from(vendorDocumentsTable)
      .where(eq(vendorDocumentsTable.vendorId, vendor.id))
      .orderBy(desc(vendorDocumentsTable.createdAt));

    res.json({ documents });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to fetch vendor documents." });
  }
});

router.post("/vendor/portal/documents", requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor authorization required." });
      return;
    }

    const { documentType, title, fileName, fileUrl, fileSize, mimeType } = req.body;
    if (!title || !fileUrl) {
      res.status(400).json({ status: "invalid_request", message: "Title and file URL are required." });
      return;
    }
    if (!isSafeDocumentUrl(fileUrl)) {
      res.status(400).json({ status: "invalid_request", message: "The document URL is not valid." });
      return;
    }

    const [doc] = await db
      .insert(vendorDocumentsTable)
      .values({
        vendorId: vendor.id,
        documentType: documentType || "other",
        title: title.trim(),
        fileName: fileName || `${title.replace(/\s+/g, "_")}.pdf`,
        fileUrl,
        fileSize: fileSize || 0,
        mimeType: mimeType || "application/pdf",
        status: "pending",
      })
      .returning();

    res.status(201).json({ status: "success", document: doc, message: "Document uploaded. Awaiting Admin verification." });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message || "Failed to upload document." });
  }
});

// Vendor Payment Ledger & Invoices (strictly isolated)
router.get("/vendor/portal/invoices", requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor profile not found or access denied." });
      return;
    }

    const invoices = await db
      .select()
      .from(vendorInvoicesTable)
      .where(eq(vendorInvoicesTable.vendorId, vendor.id))
      .orderBy(desc(vendorInvoicesTable.createdAt));

    res.json({ invoices });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to fetch invoices." });
  }
});

router.post("/vendor/portal/invoices", requireRole(["vendor", "admin", "operations_manager"]), async (req, res) => {
  const { bookingServiceId, invoiceNumber, amount, documentUrl, notes } = req.body;

  try {
    const vendor = await resolveCurrentVendor(req);
    if (!vendor) {
      res.status(403).json({ status: "forbidden", message: "Vendor profile not found or access denied." });
      return;
    }

    const invoiceAmount = Number(amount);
    if (!Number.isFinite(invoiceAmount) || invoiceAmount <= 0 || invoiceAmount > 10_000_000) {
      res.status(400).json({ status: "invalid_request", message: "Invoice amount must be a positive number." });
      return;
    }
    if (documentUrl && !isSafeDocumentUrl(documentUrl)) {
      res.status(400).json({ status: "invalid_request", message: "The document URL is not valid." });
      return;
    }
    if (bookingServiceId) {
      const [ownTask] = isUuid(String(bookingServiceId))
        ? await db.select({ id: bookingServicesTable.id, assignedVendorId: bookingServicesTable.assignedVendorId }).from(bookingServicesTable).where(eq(bookingServicesTable.id, String(bookingServiceId))).limit(1)
        : [];
      if (!ownTask || ownTask.assignedVendorId !== vendor.id) {
        res.status(404).json({ status: "not_found", message: "Booking service not found for this vendor." });
        return;
      }
    }

    const [invoice] = await db
      .insert(vendorInvoicesTable)
      .values({
        vendorId: vendor.id,
        bookingServiceId: bookingServiceId || null,
        invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
        amount: invoiceAmount,
        currency: "INR",
        status: "submitted",
        documentUrl: documentUrl || null,
        notes: notes || null,
      })
      .returning();

    await logAuditAction({
      action: "VENDOR_INVOICE_SUBMITTED",
      resourceType: "vendor_invoice",
      resourceId: invoice.id,
      newValue: { invoiceNumber: invoice.invoiceNumber, amount: invoice.amount },
      actorRole: "vendor",
    });

    res.status(201).json({ status: "success", invoice, message: "Invoice submitted for finance approval." });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to submit invoice." });
  }
});

export default router;
