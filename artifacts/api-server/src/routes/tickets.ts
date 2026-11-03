import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { supabase, userProfileRepository } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { requireUserAuth } from "./user.js";
import { getInMemoryAuditLogs } from "../lib/security.js";

const router: IRouter = Router();
const USER_CATEGORIES = ["Technical Issue", "Billing Issue", "Project Issue", "Feature Request", "General Support"];
const PARTNER_CATEGORIES = ["Process Issue", "Technical Issue", "Payment Issue", "Project Issue", "Employee Issue", "Training", "General Support"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUSES = ["open", "assigned", "in_progress", "waiting_for_requester", "resolved", "closed"];
const ATTACHMENT_TYPES = new Set(["image/jpeg", "image/png", "application/pdf", "text/plain", "application/zip"]);
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ["assigned", "in_progress", "waiting_for_requester", "resolved", "closed"],
  assigned: ["open", "in_progress", "waiting_for_requester", "resolved", "closed"],
  in_progress: ["open", "assigned", "waiting_for_requester", "resolved", "closed"],
  waiting_for_requester: ["open", "in_progress", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: ["open"],
};

type UserRequest = Request & { user?: { id: string; email: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

async function requireTicketModule(_req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase.from("module_settings").select("enabled").eq("module_key", "tickets").maybeSingle();
    if (error) throw error;
    if (data && data.enabled === false) { fail(res, 503, "Support tickets are temporarily disabled"); return; }
    next();
  } catch (error: any) { res.status(500).json({ error: "Unable to verify ticket module status", details: error?.message }); }
}

function fail(res: Response, status: number, error: string) {
  res.status(status).json({ error });
}

async function audit(actor: { userId?: string; adminId?: number }, action: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await supabase.from("audit_logs").insert({
    actor_user_id: actor.userId ?? null, actor_admin_id: actor.adminId ?? null,
    action, entity_type: "ticket", entity_id: entityId, metadata,
  });
}

async function notifyUser(userId: string, type: string, title: string, body: string, ticketId: string) {
  await supabase.from("notifications").insert({
    recipient_user_id: userId, type, title, body, entity_type: "ticket", entity_id: ticketId,
  });
}

async function getTicket(id: string, userId?: string, admin = false) {
  let query = supabase.from("tickets").select("*, ticket_messages(*), ticket_attachments(*)").eq("id", id);
  if (userId && !admin) query = query.eq("requester_id", userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!admin) data.ticket_messages = (data.ticket_messages || []).filter((message: any) => !message.is_internal);
  return data;
}

async function notifyAdmins(type: string, title: string, body: string, ticketId: string) {
  const { data: admins, error } = await supabase.from("admin_users").select("id");
  if (error) throw error;
  if (admins?.length) {
    const { error: notificationError } = await supabase.from("notifications").insert(admins.map((admin: any) => ({
      recipient_admin_id: admin.id, type, title, body, entity_type: "ticket", entity_id: ticketId,
    })));
    if (notificationError) throw notificationError;
  }
}

function parseAttachment(input: any): { fileName: string; contentType: string; bytes: Buffer } | null {
  if (!input || typeof input.fileName !== "string" || typeof input.contentType !== "string" || typeof input.data !== "string") return null;
  if (!ATTACHMENT_TYPES.has(input.contentType)) return null;
  const encoded = input.data.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES) return null;
  return { fileName: input.fileName.trim().slice(0, 180), contentType: input.contentType, bytes };
}

router.post("/tickets", requireUserAuth, requireTicketModule, async (req: UserRequest, res) => {
  try {
    const { subject, category, priority = "medium", description, relatedProjectId, relatedInvoiceId, relatedPlanId, attachments = [] } = req.body ?? {};
    if (typeof subject !== "string" || subject.trim().length < 3 || typeof description !== "string" || !description.trim()) return fail(res, 400, "Subject and description are required");
    if (!PRIORITIES.includes(priority)) return fail(res, 400, "Invalid priority");
    if (!Array.isArray(attachments) || attachments.length > 5 || attachments.some((item: any) => !parseAttachment(item))) return fail(res, 400, "Attachments must be PDF, PNG, JPEG, TXT, or ZIP files under 10 MB each");
    const profile = await userProfileRepository.getById(req.user!.id);
    if (!profile) return fail(res, 404, "Profile not found");
    const role = profile.role === "partner" || profile.role === "bpo_partner" ? "partner" : "client";
    const categories = role === "partner" ? PARTNER_CATEGORIES : USER_CATEGORIES;
    if (!categories.includes(category)) return fail(res, 400, "Invalid category for this account");
    const { data: ticket, error } = await supabase.from("tickets").insert({
      requester_id: req.user!.id, requester_role: role, subject: subject.trim(), category, priority,
      description: description.trim(), related_project_id: relatedProjectId ?? null, related_invoice_id: relatedInvoiceId ?? null,
      related_plan_id: relatedPlanId ?? null,
    }).select().single();
    if (error) throw error;
    const ticketNumber = `TKT-${new Date().getFullYear()}-${String(ticket.id).padStart(6, "0")}`;
    const { data: updated, error: updateError } = await supabase.from("tickets").update({ ticket_number: ticketNumber }).eq("id", ticket.id).select().single();
    if (updateError) throw updateError;
    const { data: initialMessage, error: messageError } = await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, author_user_id: req.user!.id, body: description.trim(), is_internal: false }).select().single();
    if (messageError) throw messageError;
    for (const attachment of attachments.map(parseAttachment)) {
      if (!attachment) continue;
      const storagePath = `${req.user!.id}/${ticket.id}/${crypto.randomUUID()}-${attachment.fileName}`;
      const { error: uploadError } = await supabase.storage.from("ticket-attachments").upload(storagePath, attachment.bytes, { contentType: attachment.contentType, upsert: false });
      if (uploadError) throw uploadError;
      const { error: attachmentError } = await supabase.from("ticket_attachments").insert({ ticket_id: ticket.id, message_id: initialMessage.id, uploaded_by_user_id: req.user!.id, storage_path: storagePath, file_name: attachment.fileName, content_type: attachment.contentType, file_size: attachment.bytes.length });
      if (attachmentError) throw attachmentError;
    }
    await notifyAdmins("ticket_created", "New support ticket", `${ticketNumber}: ${subject.trim()}`, String(ticket.id));
    await audit({ userId: req.user!.id }, "ticket_created", String(ticket.id), { ticketNumber, role });
    res.status(201).json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create ticket", details: error?.message });
  }
});

router.get("/tickets", requireUserAuth, requireTicketModule, async (req: UserRequest, res) => {
  try {
    const { data, error } = await supabase.from("tickets").select("*, ticket_messages(*), ticket_attachments(*)").eq("requester_id", req.user!.id).order("created_at", { ascending: false });
    if (error) throw error;
    res.json((data || []).map((ticket: any) => ({ ...ticket, ticket_messages: (ticket.ticket_messages || []).filter((message: any) => !message.is_internal) })));
  } catch (error: any) { res.status(500).json({ error: "Failed to load tickets", details: error?.message }); }
});

router.get("/tickets/:id", requireUserAuth, requireTicketModule, async (req: UserRequest, res) => {
  try {
    const ticket = await getTicket(String(req.params.id), req.user!.id);
    if (!ticket) return fail(res, 404, "Ticket not found");
    res.json(ticket);
  } catch (error: any) { res.status(500).json({ error: "Failed to load ticket", details: error?.message }); }
});

router.post("/tickets/:id/replies", requireUserAuth, requireTicketModule, async (req: UserRequest, res) => {
  try {
    const { body, attachments = [] } = req.body ?? {};
    if (typeof body !== "string" || !body.trim()) return fail(res, 400, "Reply body is required");
    if (!Array.isArray(attachments) || attachments.length > 5 || attachments.some((item: any) => !parseAttachment(item))) return fail(res, 400, "Attachments must be PDF, PNG, JPEG, TXT, or ZIP files under 10 MB each");
    const ticket = await getTicket(String(req.params.id), req.user!.id);
    if (!ticket) return fail(res, 404, "Ticket not found");
    if (ticket.status === "closed") return fail(res, 409, "Closed tickets cannot receive replies");
    const { data, error } = await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, author_user_id: req.user!.id, body: body.trim(), is_internal: false }).select().single();
    if (error) throw error;
    for (const attachment of attachments.map(parseAttachment)) {
      if (!attachment) continue;
      const storagePath = `${req.user!.id}/${ticket.id}/${crypto.randomUUID()}-${attachment.fileName}`;
      const { error: uploadError } = await supabase.storage.from("ticket-attachments").upload(storagePath, attachment.bytes, { contentType: attachment.contentType, upsert: false });
      if (uploadError) throw uploadError;
      const { error: attachmentError } = await supabase.from("ticket_attachments").insert({ ticket_id: ticket.id, message_id: data.id, uploaded_by_user_id: req.user!.id, storage_path: storagePath, file_name: attachment.fileName, content_type: attachment.contentType, file_size: attachment.bytes.length });
      if (attachmentError) throw attachmentError;
    }
    await supabase.from("tickets").update({ status: "open" }).eq("id", ticket.id);
    await notifyAdmins("client_replied", "Requester replied to a ticket", ticket.ticket_number, String(ticket.id));
    await audit({ userId: req.user!.id }, "ticket_replied", String(ticket.id));
    res.status(201).json(data);
  } catch (error: any) { res.status(500).json({ error: "Failed to reply to ticket", details: error?.message }); }
});

router.patch("/tickets/:id/reopen", requireUserAuth, requireTicketModule, async (req: UserRequest, res) => {
  try {
    const ticket = await getTicket(String(req.params.id), req.user!.id);
    if (!ticket) return fail(res, 404, "Ticket not found");
    if (!["resolved", "closed"].includes(ticket.status)) return fail(res, 409, "Only resolved or closed tickets can be reopened");
    const { data, error } = await supabase.from("tickets").update({ status: "open", resolved_at: null, closed_at: null }).eq("id", ticket.id).select().single();
    if (error) throw error;
    await audit({ userId: req.user!.id }, "ticket_reopened", String(ticket.id));
    res.json(data);
  } catch (error: any) { res.status(500).json({ error: "Failed to reopen ticket", details: error?.message }); }
});

router.get("/user/notifications", requireUserAuth, async (req: UserRequest, res) => {
  try {
    const { data, error } = await supabase.from("notifications").select("*").eq("recipient_user_id", req.user!.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) { res.status(500).json({ error: "Failed to load notifications", details: error?.message }); }
});

router.post("/user/notifications/:id/read", requireUserAuth, async (req: UserRequest, res) => {
  try {
    const { data, error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", Number(req.params.id)).eq("recipient_user_id", req.user!.id).select().maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ error: "Notification not found" }); return; }
    res.json(data);
  } catch (error: any) { res.status(500).json({ error: "Failed to mark notification read", details: error?.message }); }
});

router.post("/user/notifications/read-all", requireUserAuth, async (req: UserRequest, res) => {
  try {
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_user_id", req.user!.id).is("read_at", null);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: "Failed to mark notifications read", details: error?.message }); }
});

router.get("/admin/modules", requireAuth, async (_req: AdminRequest, res) => {
  try {
    const { data, error } = await supabase.from("module_settings").select("*").order("module_key");
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) { res.status(500).json({ error: "Failed to load module settings", details: error?.message }); }
});

router.patch("/admin/modules/:moduleKey", requireAuth, async (req: AdminRequest, res) => {
  try {
    if (typeof req.body?.enabled !== "boolean") return fail(res, 400, "enabled must be boolean");
    const { data, error } = await supabase.from("module_settings").upsert({ module_key: String(req.params.moduleKey), enabled: req.body.enabled, updated_by: req.admin!.id, updated_at: new Date().toISOString() }).select().single();
    if (error) throw error;
    await supabase.from("audit_logs").insert({ actor_admin_id: req.admin!.id, action: "module_changed", entity_type: "module", entity_id: String(req.params.moduleKey), metadata: { enabled: req.body.enabled } });
    res.json(data);
  } catch (error: any) { res.status(500).json({ error: "Failed to update module setting", details: error?.message }); }
});

router.get("/admin/platform-settings", requireAuth, async (_req: AdminRequest, res) => {
  try {
    const { data, error } = await supabase.from("platform_settings").select("*").order("setting_key");
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) { res.status(500).json({ error: "Failed to load platform settings", details: error?.message }); }
});

router.patch("/admin/platform-settings/:settingKey", requireAuth, async (req: AdminRequest, res) => {
  try {
    if (req.body?.value === undefined) return fail(res, 400, "value is required");
    const { data, error } = await supabase.from("platform_settings").upsert({ setting_key: String(req.params.settingKey), setting_value: req.body.value, updated_by: req.admin!.id, updated_at: new Date().toISOString() }).select().single();
    if (error) throw error;
    await supabase.from("audit_logs").insert({ actor_admin_id: req.admin!.id, action: "platform_setting_changed", entity_type: "setting", entity_id: String(req.params.settingKey), metadata: { value: req.body.value } });
    res.json(data);
  } catch (error: any) { res.status(500).json({ error: "Failed to update platform setting", details: error?.message }); }
});

router.get("/admin/tickets/stats", requireAuth, requireTicketModule, async (_req: AdminRequest, res) => {
  try {
    const { data, error } = await supabase.from("tickets").select("status, priority, sla_due_at");
    if (error) throw error;
    const rows = data || [];
    const count = (predicate: (row: any) => boolean) => rows.filter(predicate).length;
    res.json({ total: rows.length, open: count((r) => r.status === "open"), assigned: count((r) => r.status === "assigned"), inProgress: count((r) => r.status === "in_progress"), waiting: count((r) => r.status === "waiting_for_requester"), resolved: count((r) => r.status === "resolved"), closed: count((r) => r.status === "closed"), highPriority: count((r) => ["high", "urgent"].includes(r.priority)), slaBreached: count((r) => r.sla_due_at && new Date(r.sla_due_at).getTime() < Date.now() && !["resolved", "closed"].includes(r.status)) });
  } catch (error: any) { res.status(500).json({ error: "Failed to load ticket statistics", details: error?.message }); }
});

router.get("/admin/tickets", requireAuth, requireTicketModule, async (req: AdminRequest, res) => {
  try {
    const { status, priority, search, sortBy = "created_at", sortDirection = "desc", limit = "50", offset = "0" } = req.query as Record<string, string | undefined>;
    if (status && !STATUSES.includes(status)) return fail(res, 400, "Invalid status filter");
    if (priority && !PRIORITIES.includes(priority)) return fail(res, 400, "Invalid priority filter");
    if (!["created_at", "priority", "status", "subject"].includes(sortBy)) return fail(res, 400, "Invalid sort field");
    if (sortDirection !== "asc" && sortDirection !== "desc") return fail(res, 400, "Invalid sort direction");
    let query = supabase.from("tickets").select("*", { count: "exact" }).order(sortBy, { ascending: sortDirection === "asc" }).range(Number(offset) || 0, (Number(offset) || 0) + Math.min(Number(limit) || 50, 100) - 1);
    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (search) query = query.or(`ticket_number.ilike.%${search}%,subject.ilike.%${search}%`);
    const { data, error, count: total } = await query;
    if (error) throw error;
    res.setHeader("X-Total-Count", String(total ?? 0));
    res.json(data || []);
  } catch (error: any) { res.status(500).json({ error: "Failed to load tickets", details: error?.message }); }
});

router.get("/admin/tickets/:id", requireAuth, requireTicketModule, async (req: AdminRequest, res) => {
  try { const ticket = await getTicket(String(req.params.id), undefined, true); if (!ticket) return fail(res, 404, "Ticket not found"); res.json(ticket); }
  catch (error: any) { res.status(500).json({ error: "Failed to load ticket", details: error?.message }); }
});

router.post("/admin/tickets/:id/replies", requireAuth, requireTicketModule, async (req: AdminRequest, res) => {
  try {
    const { body, attachments = [] } = req.body ?? {};
    if (typeof body !== "string" || !body.trim()) return fail(res, 400, "Reply body is required");
    if (!Array.isArray(attachments) || attachments.length > 5 || attachments.some((item: any) => !parseAttachment(item))) return fail(res, 400, "Attachments must be PDF, PNG, JPEG, TXT, or ZIP files under 10 MB each");
    const ticket = await getTicket(String(req.params.id), undefined, true); if (!ticket) return fail(res, 404, "Ticket not found");
    const { data, error } = await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, author_admin_id: req.admin!.id, body: body.trim(), is_internal: false }).select().single();
    if (error) throw error;
    for (const attachment of attachments.map(parseAttachment)) {
      if (!attachment) continue;
      const storagePath = `admin/${ticket.id}/${crypto.randomUUID()}-${attachment.fileName}`;
      const { error: uploadError } = await supabase.storage.from("ticket-attachments").upload(storagePath, attachment.bytes, { contentType: attachment.contentType, upsert: false });
      if (uploadError) throw uploadError;
      const { error: attachmentError } = await supabase.from("ticket_attachments").insert({ ticket_id: ticket.id, message_id: data.id, uploaded_by_admin_id: req.admin!.id, storage_path: storagePath, file_name: attachment.fileName, content_type: attachment.contentType, file_size: attachment.bytes.length });
      if (attachmentError) throw attachmentError;
    }
    await notifyUser(ticket.requester_id, "admin_replied", "Support replied to your ticket", ticket.ticket_number, String(ticket.id));
    await audit({ adminId: req.admin!.id }, "admin_reply", String(ticket.id));
    res.status(201).json(data);
  } catch (error: any) { res.status(500).json({ error: "Failed to reply to ticket", details: error?.message }); }
});

router.post("/admin/tickets/:id/reply", requireAuth, requireTicketModule, (req, res, next) => {
  req.url = req.url.replace(/\/reply$/, "/replies");
  (router as any).handle(req, res, next);
});

router.post("/admin/tickets/:id/internal-notes", requireAuth, requireTicketModule, async (req: AdminRequest, res) => {
  try {
    const body = req.body?.body; if (typeof body !== "string" || !body.trim()) return fail(res, 400, "Note body is required");
    const ticket = await getTicket(String(req.params.id), undefined, true); if (!ticket) return fail(res, 404, "Ticket not found");
    const { data, error } = await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, author_admin_id: req.admin!.id, body: body.trim(), is_internal: true }).select().single();
    if (error) throw error; await audit({ adminId: req.admin!.id }, "internal_note_added", String(ticket.id)); res.status(201).json(data);
  } catch (error: any) { res.status(500).json({ error: "Failed to add internal note", details: error?.message }); }
});

router.patch("/admin/tickets/:id", requireAuth, requireTicketModule, async (req: AdminRequest, res) => {
  try {
    let { status, priority, assignedTo, category } = req.body ?? {};
    if (typeof status === "string") {
      const lower = status.toLowerCase().trim();
      if (lower === "waiting_for_client") status = "waiting_for_requester";
      else if (STATUSES.includes(lower)) status = lower;
    }
    if (typeof priority === "string") {
      const lowerP = priority.toLowerCase().trim();
      if (PRIORITIES.includes(lowerP)) priority = lowerP;
    }
    if (status !== undefined && !STATUSES.includes(status)) return fail(res, 400, "Invalid status");
    if (priority !== undefined && !PRIORITIES.includes(priority)) return fail(res, 400, "Invalid priority");
    const existing = await getTicket(String(req.params.id), undefined, true); if (!existing) return fail(res, 404, "Ticket not found");
    if (status !== undefined && status !== existing.status && !VALID_TRANSITIONS[existing.status]?.includes(status)) return fail(res, 409, `Invalid transition from ${existing.status} to ${status}`);
    if (category !== undefined && (typeof category !== "string" || !category.trim())) return fail(res, 400, "Category is required");
    if (assignedTo !== undefined && assignedTo !== null && (!Number.isInteger(Number(assignedTo)) || Number(assignedTo) <= 0)) return fail(res, 400, "Invalid assignee");
    const patch: Record<string, unknown> = {};
    if (status !== undefined) { patch.status = status; if (status === "resolved") patch.resolved_at = new Date().toISOString(); if (status === "closed") patch.closed_at = new Date().toISOString(); }
    if (priority !== undefined) patch.priority = priority;
    if (assignedTo !== undefined) { patch.assigned_to = assignedTo || null; if (assignedTo && status === undefined && existing.status === "open") patch.status = "assigned"; }
    if (category !== undefined) patch.category = category;
    const { data, error } = await supabase.from("tickets").update(patch).eq("id", existing.id).select().single();
    if (error) throw error;
    const effectiveStatus = String(patch.status || status || existing.status);
    if (effectiveStatus !== existing.status) await notifyUser(existing.requester_id, effectiveStatus === "resolved" ? "ticket_resolved" : effectiveStatus === "closed" ? "ticket_closed" : "status_changed", "Ticket status updated", `${existing.ticket_number}: ${effectiveStatus}`, String(existing.id));
    if (priority && priority !== existing.priority) await notifyUser(existing.requester_id, "priority_changed", "Ticket priority updated", existing.ticket_number, String(existing.id));
    if (assignedTo !== undefined && Number(assignedTo || 0) !== Number(existing.assigned_to || 0)) await notifyUser(existing.requester_id, "ticket_assigned", "Ticket assignment updated", existing.ticket_number, String(existing.id));
    await audit({ adminId: req.admin!.id }, "ticket_updated", String(existing.id), { patch });
    res.json(data);
  } catch (error: any) { res.status(500).json({ error: "Failed to update ticket", details: error?.message }); }
});

router.get("/admin/tickets/:id/audit", requireAuth, requireTicketModule, async (req: AdminRequest, res) => {
  try {
    const ticket = await getTicket(String(req.params.id), undefined, true);
    if (!ticket) return fail(res, 404, "Ticket not found");
    const { data, error } = await supabase.from("audit_logs").select("*").eq("entity_type", "ticket").eq("entity_id", String(ticket.id)).order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) { res.status(500).json({ error: "Failed to load ticket history", details: error?.message }); }
});

router.get("/admin/audit-logs", requireAuth, async (req: AdminRequest, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    let data: any = null;
    try {
      const resQuery = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
      if (!resQuery.error && resQuery.data) {
        data = resQuery.data;
      }
    } catch {
      // ignore
    }
    if (!data) {
      data = getInMemoryAuditLogs().slice(0, limit);
    }
    res.json(data || []);
  } catch (error: any) {
    const fallback = getInMemoryAuditLogs().slice(0, 100);
    res.json(fallback);
  }
});

router.get("/tickets/:id/attachments/:attachmentId", requireUserAuth, requireTicketModule, async (req: UserRequest, res) => {
  try {
    const ticket = await getTicket(String(req.params.id), req.user!.id);
    if (!ticket) return fail(res, 404, "Ticket not found");
    const attachment = (ticket.ticket_attachments || []).find((item: any) => String(item.id) === String(req.params.attachmentId));
    if (!attachment) return fail(res, 404, "Attachment not found");
    const { data, error } = await supabase.storage.from("ticket-attachments").createSignedUrl(attachment.storage_path, 300);
    if (error || !data?.signedUrl) return fail(res, 404, "Attachment unavailable");
    res.json({ url: data.signedUrl, fileName: attachment.file_name, contentType: attachment.content_type });
  } catch (error: any) { res.status(500).json({ error: "Failed to load attachment", details: error?.message }); }
});

router.get("/admin/tickets/:id/attachments/:attachmentId", requireAuth, requireTicketModule, async (req: AdminRequest, res) => {
  try {
    const ticket = await getTicket(String(req.params.id), undefined, true);
    if (!ticket) return fail(res, 404, "Ticket not found");
    const attachment = (ticket.ticket_attachments || []).find((item: any) => String(item.id) === String(req.params.attachmentId));
    if (!attachment) return fail(res, 404, "Attachment not found");
    const { data, error } = await supabase.storage.from("ticket-attachments").createSignedUrl(attachment.storage_path, 300);
    if (error || !data?.signedUrl) return fail(res, 404, "Attachment unavailable");
    res.json({ url: data.signedUrl, fileName: attachment.file_name, contentType: attachment.content_type });
  } catch (error: any) { res.status(500).json({ error: "Failed to load attachment", details: error?.message }); }
});

export default router;
