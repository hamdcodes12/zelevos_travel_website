import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { supabase } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import {
  listConversationsForPartner,
  getConversationForPartner,
  createConversationByPartner,
  addMessageByPartner,
  requestMeetingByPartner,
  listConversationsForAdmin,
  getConversationForAdmin,
  addMessageByAdmin,
  updateConversationStatusByAdmin,
  updatePaymentStatusByAdmin,
  createMeetingByAdmin,
  respondToMeetingRequestByAdmin,
  getAttachmentDownloadUrl,
  type BpoConnectRequestType,
  type BpoConnectStatus,
  type BpoPaymentStatus,
} from "../lib/bpoConnectService.js";

const router = Router();

const JWT_SECRET =
  process.env.USER_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("USER_SESSION_SECRET must be set in production");
      })()
    : "thinkatic-user-secret-2026");

type UserRequest = Request & { user?: { id: string; email: string; name?: string; role?: string } };
type AdminRequest = Request & { admin?: { id: number; username: string; role?: string } };
type PartnerRequest = UserRequest & {
  partner?: {
    partnerId: string;
    partnerUserId?: number;
    partnerName?: string;
    role?: string;
  };
};

function fail(res: Response, status: number, message: string, details?: any) {
  return res.status(status).json({ success: false, error: message, message, ...(details ? { details } : {}) });
}

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || "";
  return param || "";
}

/**
 * Middleware: Resolve authenticated BPO Partner Context
 */
async function requirePartnerContext(req: PartnerRequest, res: Response, next: NextFunction): Promise<any> {
  let token: string | undefined;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    token = auth.slice(7);
  } else if (typeof req.query.token === "string" && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return fail(res, 401, "Authentication token required");
  }

  let decodedUser: { id: string; email: string; name?: string } | null = null;
  try {
    decodedUser = jwt.verify(token, JWT_SECRET) as any;
    req.user = decodedUser!;
  } catch (err: any) {
    return fail(res, 401, "Invalid or expired session token");
  }
  const userId = decodedUser!.id;

  // Authoritative check if account is suspended
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, is_active, bpo_status, bpo_application_details")
      .eq("id", userId)
      .maybeSingle();

    if (profile) {
      const appDetails = (profile.bpo_application_details as any) || {};
      const isSuspended = profile.is_active === false || profile.bpo_status === "SUSPENDED" || appDetails.suspended === true;
      if (isSuspended && profile.bpo_status !== "REJECTED") {
        return res.status(403).json({
          error: "Account Temporarily Suspended",
          isSuspended: true,
          accountState: "BPO_SUSPENDED",
          message: "Your BPO Partner account is currently under review by Thinkatic Operations.",
          reason: appDetails.suspensionReason || "Routine operational compliance review by Thinkatic Operations",
        });
      }
    }
  } catch {}

  // 1. Direct membership in bpo_partner_users
  let partnerId: string | null = null;
  let partnerUserId: number | undefined;
  let partnerName: string | undefined;

  try {
    const { data: member } = await supabase
      .from("bpo_partner_users")
      .select("id, partner_id, role, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (member?.partner_id) {
      partnerId = member.partner_id;
      partnerUserId = member.id;
    }
  } catch {}

  // 2. Direct application lookup
  if (!partnerId) {
    try {
      const { data: app } = await supabase
        .from("bpo_partner_applications")
        .select("partner_id, company_name")
        .eq("applicant_user_id", userId)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (app?.partner_id) {
        partnerId = app.partner_id;
        partnerName = app.company_name;
      }
    } catch {}
  }

  // 3. Direct partner ID check (profile or test fallback)
  if (!partnerId) {
    try {
      const { data: partner } = await supabase
        .from("bpo_partners")
        .select("id, name")
        .eq("id", userId)
        .maybeSingle();

      if (partner?.id) {
        partnerId = partner.id;
        partnerName = partner.name;
      }
    } catch {}
  }

  // Fallback for mock/test users
  if (!partnerId) {
    partnerId = userId.startsWith("usr_") ? `partner_${userId}` : userId;
  }

  req.partner = {
    partnerId,
    partnerUserId,
    partnerName,
    role: "partner",
  };

  return next();
}

// ─────────────────────────────────────────────────────────────────────────────
// BPO PARTNER ENDPOINTS (/bpo/connect/...)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /bpo/connect/conversations
 * List all conversations for the authenticated BPO Partner
 */
router.get("/bpo/connect/conversations", requirePartnerContext, async (req: PartnerRequest, res) => {
  try {
    const partnerId = req.partner!.partnerId;
    const conversations = await listConversationsForPartner(partnerId);

    const unreadCount = conversations.reduce(
      (sum, c) => sum + (c.unread_bpo_count > 0 ? 1 : 0),
      0
    );

    return res.json({
      success: true,
      data: conversations,
      unreadCount,
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error listing BPO conversations");
    return fail(res, 500, "Unable to load conversations.", err.message);
  }
});

/**
 * GET /bpo/connect/conversations/:id
 * Get single conversation with messages, attachments, and meetings
 */
router.get("/bpo/connect/conversations/:id", requirePartnerContext, async (req: PartnerRequest, res) => {
  try {
    const id = getParam(req.params.id);
    const partnerId = req.partner!.partnerId;
    const userId = req.user!.id;

    const conversation = await getConversationForPartner(id, partnerId, userId);
    if (!conversation) {
      return fail(res, 404, "Conversation not found or access denied.");
    }

    return res.json({
      success: true,
      data: conversation,
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error getting BPO conversation");
    return fail(res, 500, "Unable to load conversation.", err.message);
  }
});

/**
 * POST /bpo/connect/conversations
 * Create a new BPO request / conversation
 */
router.post("/bpo/connect/conversations", requirePartnerContext, async (req: PartnerRequest, res) => {
  try {
    const {
      requestType,
      subject,
      message,
      projectId,
      requestedAmount,
      currency,
      milestoneName,
      completionDate,
      attachments,
    } = req.body;

    const validTypes: BpoConnectRequestType[] = [
      "project_completed",
      "advance_payment_request",
      "payment_status",
      "payment_clarification",
      "project_milestone",
      "operational_issue",
      "general_discussion",
      "meeting_request",
    ];

    if (!requestType || !validTypes.includes(requestType)) {
      return fail(res, 400, "Valid requestType is required.");
    }

    if (!subject || typeof subject !== "string" || subject.trim().length < 3) {
      return fail(res, 400, "Subject is required (minimum 3 characters).");
    }

    if (!message || typeof message !== "string" || message.trim().length < 1) {
      return fail(res, 400, "Message body is required.");
    }

    // Validate attachments if provided
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (!att.fileName || !att.fileData) {
          return fail(res, 400, "Invalid attachment format: fileName and fileData required.");
        }
        if (att.fileSize && att.fileSize > 15 * 1024 * 1024) {
          return fail(res, 400, `Attachment "${att.fileName}" exceeds 15MB limit.`);
        }
      }
    }

    const userName = req.user?.name || req.user?.email || "BPO Partner";

    const created = await createConversationByPartner({
      partnerId: req.partner!.partnerId,
      userId: req.user!.id,
      userName,
      requestType,
      subject,
      message,
      projectId: projectId ? Number(projectId) : null,
      requestedAmount: requestedAmount ? Number(requestedAmount) : null,
      currency: currency || "USD",
      milestoneName: milestoneName || null,
      completionDate: completionDate || null,
      attachments,
    });

    return res.status(201).json({
      success: true,
      data: created,
      message: "Request submitted successfully to Thinkatic Admin.",
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error creating BPO conversation");
    return fail(res, 500, "Failed to submit request.", err.message);
  }
});

/**
 * POST /bpo/connect/conversations/:id/messages
 * Send a reply message in an existing conversation
 */
router.post("/bpo/connect/conversations/:id/messages", requirePartnerContext, async (req: PartnerRequest, res) => {
  try {
    const id = getParam(req.params.id);
    const { message, attachments } = req.body;

    if (!message || typeof message !== "string" || message.trim().length < 1) {
      return fail(res, 400, "Message cannot be empty.");
    }

    const userName = req.user?.name || req.user?.email || "BPO Partner";

    const msg = await addMessageByPartner({
      conversationId: id,
      partnerId: req.partner!.partnerId,
      userId: req.user!.id,
      userName,
      message,
      attachments,
    });

    return res.status(201).json({
      success: true,
      data: msg,
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error sending message");
    return fail(res, 500, err.message || "Message could not be sent.");
  }
});

/**
 * POST /bpo/connect/conversations/:id/meeting-requests
 * BPO requests a meeting directly inside the conversation
 */
router.post("/bpo/connect/conversations/:id/meeting-requests", requirePartnerContext, async (req: PartnerRequest, res) => {
  try {
    const id = getParam(req.params.id);
    const { title, preferredDate, preferredTime, durationMinutes, agenda, message, projectId } = req.body;

    if (!title || !title.trim()) {
      return fail(res, 400, "Meeting title is required.");
    }
    if (!preferredDate) {
      return fail(res, 400, "Preferred date is required.");
    }
    if (!preferredTime) {
      return fail(res, 400, "Preferred time is required.");
    }

    const userName = req.user?.name || req.user?.email || "BPO Partner";

    const meetingReq = await requestMeetingByPartner({
      conversationId: id,
      partnerId: req.partner!.partnerId,
      userId: req.user!.id,
      userName,
      title,
      preferredDate,
      preferredTime,
      durationMinutes: durationMinutes ? Number(durationMinutes) : 30,
      agenda: agenda || "Discussion with Thinkatic Admin",
      message,
      projectId: projectId ? Number(projectId) : null,
    });

    return res.status(201).json({
      success: true,
      data: meetingReq,
      message: "Meeting request sent to Thinkatic Admin.",
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error creating meeting request");
    return fail(res, 500, err.message || "Unable to request meeting.");
  }
});

/**
 * GET /bpo/connect/projects
 * List authorized projects for BPO partner dropdown
 */
router.get("/bpo/connect/projects", requirePartnerContext, async (req: PartnerRequest, res) => {
  try {
    const partnerId = req.partner!.partnerId;
    let projects: any[] = [];

    // Query assigned projects
    try {
      const { data: assigned } = await supabase
        .from("bpo_partner_projects")
        .select("project_id, projects(id, name, status, vertical, budget)")
        .eq("partner_id", partnerId);

      if (assigned && assigned.length > 0) {
        projects = assigned
          .map((a: any) => a.projects)
          .filter(Boolean);
      }
    } catch {}

    // Fallback: list active projects from projects table
    if (projects.length === 0) {
      try {
        const { data: allProjects } = await supabase
          .from("projects")
          .select("id, name, status, vertical, budget")
          .limit(20);
        if (allProjects) projects = allProjects;
      } catch {}
    }

    return res.json({
      success: true,
      data: projects,
    });
  } catch (err: any) {
    return fail(res, 500, "Failed to load projects.");
  }
});

/**
 * GET /bpo/connect/attachments/:id/url
 * Get authorized download signed URL for attachment
 */
router.get("/bpo/connect/attachments/:id/url", requirePartnerContext, async (req: PartnerRequest, res) => {
  try {
    const id = getParam(req.params.id);
    const signedUrl = await getAttachmentDownloadUrl(id, {
      userId: req.user!.id,
      partnerId: req.partner!.partnerId,
    });
    return res.json({ success: true, url: signedUrl });
  } catch (err: any) {
    return fail(res, 403, err.message || "Unauthorized attachment access.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS (/admin/bpo-connect/...)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/bpo-connect/conversations
 * List all conversations with filters & search
 */
router.get("/admin/bpo-connect/conversations", requireAuth, async (req: AdminRequest, res) => {
  try {
    const { search, status, requestType, paymentStatus, partnerId } = req.query as any;

    const result = await listConversationsForAdmin({
      search,
      status,
      requestType,
      paymentStatus,
      partnerId,
    });

    return res.json({
      success: true,
      data: result.conversations,
      unreadCount: result.unreadCount,
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error listing admin conversations");
    return fail(res, 500, "Unable to load conversations.", err.message);
  }
});

/**
 * GET /admin/bpo-connect/unread-count
 * Fast endpoint for Admin badge
 */
router.get("/admin/bpo-connect/unread-count", requireAuth, async (_req: AdminRequest, res) => {
  try {
    const result = await listConversationsForAdmin();
    return res.json({
      success: true,
      unreadCount: result.unreadCount,
    });
  } catch {
    return res.json({ success: true, unreadCount: 0 });
  }
});

/**
 * GET /admin/bpo-connect/conversations/:id
 * Get full conversation details for Admin
 */
router.get("/admin/bpo-connect/conversations/:id", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = getParam(req.params.id);
    const adminId = req.admin!.id;

    const conversation = await getConversationForAdmin(id, adminId);
    if (!conversation) {
      return fail(res, 404, "Conversation not found.");
    }

    return res.json({
      success: true,
      data: conversation,
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error getting admin conversation");
    return fail(res, 500, "Unable to load conversation details.", err.message);
  }
});

/**
 * POST /admin/bpo-connect/conversations/:id/messages
 * Send Admin reply
 */
router.post("/admin/bpo-connect/conversations/:id/messages", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = getParam(req.params.id);
    const { message, newStatus, attachments } = req.body;

    if (!message || typeof message !== "string" || message.trim().length < 1) {
      return fail(res, 400, "Message cannot be empty.");
    }

    const adminName = req.admin?.username ? `Admin (${req.admin.username})` : "Thinkatic Admin";

    const msg = await addMessageByAdmin({
      conversationId: id,
      adminId: req.admin!.id,
      adminName,
      message,
      newStatus,
      attachments,
    });

    return res.status(201).json({
      success: true,
      data: msg,
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error sending admin reply");
    return fail(res, 500, err.message || "Message could not be sent.");
  }
});

/**
 * PATCH /admin/bpo-connect/conversations/:id/status
 * Change conversation status by Admin
 */
router.patch("/admin/bpo-connect/conversations/:id/status", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = getParam(req.params.id);
    const { status, notes } = req.body;

    const validStatuses: BpoConnectStatus[] = [
      "OPEN",
      "ADMIN_REVIEW",
      "WAITING_FOR_BPO",
      "IN_PROGRESS",
      "MEETING_SCHEDULED",
      "RESOLVED",
      "CLOSED",
    ];

    if (!status || !validStatuses.includes(status)) {
      return fail(res, 400, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
    }

    const adminName = req.admin?.username || "Admin";

    const updated = await updateConversationStatusByAdmin({
      conversationId: id,
      adminId: req.admin!.id,
      adminName,
      status,
      notes,
    });

    return res.json({
      success: true,
      data: updated,
      message: `Status updated to ${status}.`,
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error updating status");
    return fail(res, 500, err.message || "Failed to update status.");
  }
});

/**
 * PATCH /admin/bpo-connect/conversations/:id/payment-status
 * Change payment status by Admin / Finance
 * NOTE: Actual payment disbursement is a manual Finance operation.
 */
router.patch("/admin/bpo-connect/conversations/:id/payment-status", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = getParam(req.params.id);
    const { paymentStatus, notes, payoutStatementId } = req.body;

    const validPaymentStatuses: BpoPaymentStatus[] = [
      "REQUESTED",
      "UNDER_REVIEW",
      "INFO_REQUIRED",
      "APPROVED_FOR_PROCESSING",
      "PROCESSING",
      "PAID",
      "REJECTED",
      "CANCELLED",
    ];

    if (!paymentStatus || !validPaymentStatuses.includes(paymentStatus)) {
      return fail(res, 400, `Invalid paymentStatus. Must be one of: ${validPaymentStatuses.join(", ")}`);
    }

    const adminName = req.admin?.username || "Admin";

    const updated = await updatePaymentStatusByAdmin({
      conversationId: id,
      adminId: req.admin!.id,
      adminName,
      paymentStatus,
      notes,
      payoutStatementId: payoutStatementId ? Number(payoutStatementId) : null,
    });

    return res.json({
      success: true,
      data: updated,
      message: `Payment status updated to ${paymentStatus}.`,
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error updating payment status");
    return fail(res, 500, err.message || "Failed to update payment status.");
  }
});

/**
 * POST /admin/bpo-connect/conversations/:id/meetings
 * Create/Schedule Meeting by Admin
 */
router.post("/admin/bpo-connect/conversations/:id/meetings", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = getParam(req.params.id);
    const {
      title,
      startsAt,
      endsAt,
      timezone,
      agenda,
      meetingLink,
      meetingPassword,
      meetingRequestId,
      projectId,
    } = req.body;

    if (!title || !title.trim()) {
      return fail(res, 400, "Meeting title is required.");
    }
    if (!startsAt || !endsAt) {
      return fail(res, 400, "Starts at and Ends at dates are required.");
    }

    const adminName = req.admin?.username || "Admin";

    const meeting = await createMeetingByAdmin({
      conversationId: id,
      adminId: req.admin!.id,
      adminName,
      title,
      startsAt,
      endsAt,
      timezone: timezone || "UTC",
      agenda,
      meetingLink,
      meetingPassword,
      meetingRequestId,
      projectId: projectId ? Number(projectId) : null,
    });

    return res.status(201).json({
      success: true,
      data: meeting,
      message: "Meeting scheduled and BPO notified successfully.",
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Error scheduling meeting");
    return fail(res, 500, err.message || "Unable to schedule meeting.");
  }
});

/**
 * POST /admin/bpo-connect/conversations/:id/meeting-requests/:reqId/respond
 * Respond to meeting request (Accept / Reschedule / Decline)
 */
router.post(
  "/admin/bpo-connect/conversations/:id/meeting-requests/:reqId/respond",
  requireAuth,
  async (req: AdminRequest, res) => {
    try {
      const id = getParam(req.params.id);
      const reqId = getParam(req.params.reqId);
      const { action, notes, rescheduleDate, rescheduleTime } = req.body;

      if (!action || !["ACCEPT", "RESCHEDULE", "DECLINE"].includes(action)) {
        return fail(res, 400, "Action must be ACCEPT, RESCHEDULE, or DECLINE.");
      }

      const adminName = req.admin?.username || "Admin";

      const updated = await respondToMeetingRequestByAdmin({
        conversationId: id,
        meetingRequestId: reqId,
        adminId: req.admin!.id,
        adminName,
        action,
        notes,
        rescheduleDate,
        rescheduleTime,
      });

      return res.json({
        success: true,
        data: updated,
        message: `Meeting request ${action.toLowerCase()}ed.`,
      });
    } catch (err: any) {
      logger.error({ error: err.message }, "Error responding to meeting request");
      return fail(res, 500, err.message || "Failed to respond to meeting request.");
    }
  }
);

/**
 * GET /admin/bpo-connect/attachments/:id/url
 * Get authorized signed download URL for Admin
 */
router.get("/admin/bpo-connect/attachments/:id/url", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = getParam(req.params.id);
    const signedUrl = await getAttachmentDownloadUrl(id, {
      adminId: req.admin!.id,
    });
    return res.json({ success: true, url: signedUrl });
  } catch (err: any) {
    return fail(res, 403, err.message || "Unauthorized attachment access.");
  }
});

export default router;
