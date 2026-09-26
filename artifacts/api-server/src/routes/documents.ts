import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import multer from "multer";
import { z } from "zod/v4";
import { eq, or } from "drizzle-orm";
import { db, vouchersTable, bookingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/rbac";
import {
  generateSignedDocumentToken,
  verifySignedDocumentToken,
} from "../services/document-service";
import { logAuditAction } from "../services/booking-engine";

const router: IRouter = Router();
const ticketUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

function storageHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, apikey: key };
}

function requireDocumentAuth(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]) {
  if (!req.isAuthenticated() && !req.isAdminAuthenticated()) {
    res.status(401).json({ status: "unauthorized", message: "Please log in to continue." });
    return;
  }
  next();
}

router.post("/documents/tickets/upload", requireRole(["admin", "operations_manager", "booking_executive"]), ticketUpload.single("ticket"), async (req, res): Promise<void> => {
  const bookingId = typeof req.body?.bookingId === "string" ? req.body.bookingId.trim() : "";
  if (!bookingId || !req.file) {
    res.status(400).json({ status: "invalid_request", message: "A booking ID and PDF/image ticket file are required." });
    return;
  }
  const config = storageConfig();
  if (!config.url || !config.key) {
    res.status(503).json({ status: "storage_not_configured", message: "Private document storage is not configured." });
    return;
  }
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);
  const [booking] = await db.select().from(bookingsTable).where(isUuid ? eq(bookingsTable.id, bookingId) : eq(bookingsTable.bookingId, bookingId)).limit(1);
  if (!booking) {
    res.status(404).json({ status: "not_found", message: "Booking not found." });
    return;
  }
  const extension = req.file.mimetype === "application/pdf" ? "pdf" : req.file.mimetype.split("/")[1];
  const objectPath = `tickets/${booking.id}/${crypto.randomUUID()}.${extension}`;
  const uploadResponse = await fetch(`${config.url}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "POST",
    headers: { ...storageHeaders(config.key), "Content-Type": req.file.mimetype, "x-upsert": "false" },
    body: new Uint8Array(req.file.buffer),
  });
  if (!uploadResponse.ok) {
    await uploadResponse.text();
    res.status(502).json({ status: "storage_error", message: "Ticket could not be uploaded to private storage." });
    return;
  }
  const [updated] = await db.update(bookingsTable).set({ flightTicketUrl: objectPath, flightStatus: "TICKETED", updatedAt: new Date() }).where(eq(bookingsTable.id, booking.id)).returning();
  res.status(201).json({ status: "success", booking: updated, objectPath, message: "Ticket uploaded to private storage." });
});

router.get("/documents/tickets/:bookingId", requireAuth, async (req, res): Promise<void> => {
  const reference = typeof req.params.bookingId === "string" ? req.params.bookingId : "";
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference);
  const [booking] = await db.select().from(bookingsTable).where(isUuid ? eq(bookingsTable.id, reference) : eq(bookingsTable.bookingId, reference)).limit(1);
  const isAdmin = Boolean(req.admin);
  if (!booking || (!isAdmin && booking.ownerId !== req.user!.id && booking.customerId !== req.user!.id) || !booking.flightTicketUrl) {
    res.status(404).json({ status: "not_found", message: "Ticket not found." });
    return;
  }
  const config = storageConfig();
  if (!config.url || !config.key) {
    res.status(503).json({ status: "storage_not_configured", message: "Private document storage is not configured." });
    return;
  }
  const signedResponse = await fetch(`${config.url}/storage/v1/object/sign/${config.bucket}/${booking.flightTicketUrl}`, {
    method: "POST",
    headers: { ...storageHeaders(config.key), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 600 }),
  });
  if (!signedResponse.ok) {
    await signedResponse.text();
    res.status(502).json({ status: "storage_error", message: "Ticket access could not be generated." });
    return;
  }
  const signed = await signedResponse.json() as { signedURL?: string };
  if (!signed.signedURL) {
    res.status(502).json({ status: "storage_error", message: "Ticket access URL was not returned." });
    return;
  }
  res.json({ status: "success", url: `${config.url}/storage/v1${signed.signedURL}`, expiresInSeconds: 600 });
});

/**
 * POST /api/documents/sign
 * Authenticated endpoint to generate a short-lived HMAC-SHA256 URL for a document.
 * Validity: 15 minutes (900 seconds).
 */
router.post("/documents/sign", requireDocumentAuth, async (req, res) => {
  const actor = req.user || req.admin;
  if (!actor) {
    res.status(401).json({ status: "unauthorized", message: "Please log in to continue." });
    return;
  }

  const schema = z.object({
    documentId: z.string().min(1),
    documentType: z.enum(["voucher", "invoice", "ticket", "itinerary"]),
    bookingId: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid_request", message: "Invalid document sign parameters.", errors: parsed.error.issues });
    return;
  }

  const { documentId, documentType, bookingId } = parsed.data;
  const isAdmin = Boolean(req.admin);

  if (!isAdmin) {
    if (!bookingId) {
      res.status(400).json({ status: "invalid_request", message: "A booking reference is required for customer documents." });
      return;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);
    const [ownedBooking] = await db
      .select({ id: bookingsTable.id, ownerId: bookingsTable.ownerId, customerId: bookingsTable.customerId })
      .from(bookingsTable)
      .where(isUuid ? or(eq(bookingsTable.id, bookingId), eq(bookingsTable.bookingId, bookingId)) : eq(bookingsTable.bookingId, bookingId))
      .limit(1);

    if (!ownedBooking || (ownedBooking.ownerId !== req.user!.id && ownedBooking.customerId !== req.user!.id)) {
      res.status(404).json({ status: "not_found", message: "Booking document not found." });
      return;
    }
  }

  const token = generateSignedDocumentToken({
    documentId,
    documentType,
    bookingId,
    userId: actor.id,
    role: "role" in actor ? (actor.role as string) : "customer",
  }, 900);

  const signedUrl = `/api/documents/signed-view?token=${token}`;

  const isAdminActor = "adminId" in actor || ("role" in actor && actor.role === "admin");
  await logAuditAction({
    action: "DOCUMENT_TOKEN_GENERATED",
    resourceType: documentType,
    resourceId: documentId,
    actorAdminId: isAdminActor ? actor.id : undefined,
    actorUserId: isAdminActor ? undefined : actor.id,
    actorRole: "role" in actor ? (actor.role as string) : "customer",
    metadata: { bookingId, expiresInSeconds: 900 },
  });

  res.json({
    status: "success",
    signedUrl,
    token,
    expiresInSeconds: 900,
    expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
  });
});

/**
 * GET /api/documents/signed-view
 * Publicly callable endpoint with valid HMAC short-lived token. Never public static URLs.
 */
router.get("/documents/signed-view", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(401).json({ status: "unauthorized", message: "Missing document access token." });
    return;
  }

  const payload = verifySignedDocumentToken(token);
  if (!payload) {
    res.status(403).json({ status: "forbidden", message: "Invalid or expired document link. Please request a new signed link." });
    return;
  }

  const isPayloadAdmin = payload.role === "admin";
  await logAuditAction({
    action: "DOCUMENT_VIEWED",
    resourceType: payload.documentType,
    resourceId: payload.documentId,
    actorAdminId: isPayloadAdmin ? payload.userId : undefined,
    actorUserId: isPayloadAdmin ? undefined : payload.userId,
    actorRole: payload.role || "anonymous",
    metadata: { tokenExpiresAt: new Date(payload.expiresAt).toISOString() },
  });

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");

  const docTypeLabel = payload.documentType.toUpperCase();
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Zelevos Document — ${docTypeLabel} #${payload.documentId}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #0f172a; }
    .card { max-width: 720px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem; }
    .badge { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 0.25rem 0.75rem; border-radius: 999px; font-weight: 700; margin-bottom: 1rem; }
    strong { color: #0f172a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${docTypeLabel}</div>
    <h1>Zelevos Document Access</h1>
    <p><strong>Document ID:</strong> ${payload.documentId}</p>
    <p><strong>Booking ID:</strong> ${payload.bookingId || "N/A"}</p>
    <p><strong>Valid until:</strong> ${new Date(payload.expiresAt).toISOString()}</p>
    <p>This secure preview was generated for authorized Zelevos users only.</p>
  </div>
</body>
</html>`;

  res.type("html").send(html);
});

export default router;
