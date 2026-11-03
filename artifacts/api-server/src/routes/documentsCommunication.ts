import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { supabase, userProfileRepository } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { requireUserAuth } from "./user.js";

const router: IRouter = Router();
const DOCUMENT_CATEGORIES = ["Contract", "Proposal", "Invoice", "Requirement", "Project Document", "Design", "Technical", "KYC", "Deliverable", "Report", "Other"];
const DOCUMENT_VISIBILITIES = ["client_visible", "internal_only"];
const DOCUMENT_STATUSES = ["active", "archived", "deleted"];
const CONVERSATION_STATUSES = ["open", "closed", "archived"];
const FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "text/csv", "application/zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
const FILE_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp", "txt", "csv", "zip", "docx", "xlsx"]);
const MIME_EXTENSIONS: Record<string, string[]> = { "application/pdf": ["pdf"], "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "text/plain": ["txt"], "text/csv": ["csv"], "application/zip": ["zip"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"] };
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const MAX_MESSAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

type UserRequest = Request & { user?: { id: string; email: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

function fail(res: Response, status: number, message: string): void { res.status(status).json({ success: false, error: message, message }); }
function numberId(value: unknown): number | null { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : null; }
function safeFileName(value: unknown) { const name = typeof value === "string" ? value.normalize("NFKC").replace(/[\\/\0\r\n]/g, "_").trim() : ""; return name.replace(/[^a-zA-Z0-9._ ()-]/g, "_").slice(0, 180) || "upload"; }
function parseUpload(input: any, maxBytes: number) {
  if (!input || typeof input.fileName !== "string" || typeof input.contentType !== "string" || typeof input.data !== "string" || !FILE_TYPES.has(input.contentType)) return null;
  const originalExtension = input.fileName.trim().split(".").pop()?.toLowerCase() || "";
  if (!FILE_EXTENSIONS.has(originalExtension) || !MIME_EXTENSIONS[input.contentType]?.includes(originalExtension)) return null;
  const encoded = input.data.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/=_-]+$/.test(encoded)) return null;
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > maxBytes) return null;
  return { fileName: safeFileName(input.fileName), contentType: input.contentType, bytes };
}
function exceedsUploadLimit(input: any, maxBytes: number) { if (!input || typeof input.data !== "string") return false; const encoded = input.data.replace(/^data:[^;]+;base64,/, ""); return Math.floor(encoded.length * 3 / 4) > maxBytes; }
function rejectOversizedDocument(req: Request, res: Response, next: NextFunction) { if (exceedsUploadLimit(req.body?.file, MAX_DOCUMENT_BYTES)) return fail(res, 413, "Document exceeds the 25 MB limit"); next(); }
async function moduleEnabled(key: string, res: Response) {
  const { data, error } = await supabase.from("module_settings").select("enabled").eq("module_key", key).maybeSingle();
  if (error) throw error;
  if (data?.enabled === false) { fail(res, 503, `${key} is currently disabled`); return false; }
  return true;
}
async function audit(actor: { userId?: string; adminId?: number }, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await supabase.from("audit_logs").insert({ actor_user_id: actor.userId ?? null, actor_admin_id: actor.adminId ?? null, action, entity_type: entityType, entity_id: entityId, metadata });
}
async function notifyUser(userId: string, type: string, title: string, body: string, entityType: string, entityId: string) {
  await supabase.from("notifications").insert({ recipient_user_id: userId, type, title, body, entity_type: entityType, entity_id: entityId });
}
async function notifyAdmins(type: string, title: string, body: string, entityType: string, entityId: string) {
  const { data: admins, error } = await supabase.from("admin_users").select("id");
  if (error) throw error;
  if (admins?.length) await supabase.from("notifications").insert(admins.map((admin: any) => ({ recipient_admin_id: admin.id, type, title, body, entity_type: entityType, entity_id: entityId })));
}
async function projectForClient(projectId: number, clientId: string) {
  const { data, error } = await supabase.from("projects").select("id,client_id,name").eq("id", projectId).eq("client_id", clientId).maybeSingle();
  if (error) throw error;
  return data;
}
async function documentView(row: any) {
  const { storage_path: _storagePath, ...visible } = row;
  const [uploader, admin] = await Promise.all([
    row.uploaded_by_user_id ? userProfileRepository.getById(row.uploaded_by_user_id) : null,
    row.uploaded_by_admin_id ? supabase.from("admin_users").select("username").eq("id", row.uploaded_by_admin_id).maybeSingle() : null,
  ]);
  return { ...visible, uploaded_by: uploader?.fullName || uploader?.email || admin?.data?.username || "System" };
}
async function documentForActor(id: number, actor: { userId?: string; adminId?: number }) {
  let query = supabase.from("documents").select("*").eq("id", id).eq("status", "active");
  if (actor.userId) query = query.eq("client_id", actor.userId).eq("visibility", "client_visible");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function requireDocuments(_req: Request, res: Response, next: NextFunction) { try { if (await moduleEnabled("documents", res)) return next(); } catch (error: any) { res.status(500).json({ error: "Unable to verify documents module", details: error?.message }); return; } }
async function requireCommunication(_req: Request, res: Response, next: NextFunction) { try { if (await moduleEnabled("communication", res)) return next(); } catch (error: any) { res.status(500).json({ error: "Unable to verify communication module", details: error?.message }); return; } }

router.get("/documents", requireUserAuth, requireDocuments, async (req: UserRequest, res) => {
  try {
    let query = supabase.from("documents").select("*").eq("client_id", req.user!.id).eq("visibility", "client_visible").neq("status", "deleted").order("created_at", { ascending: false });
    if (typeof req.query.category === "string" && DOCUMENT_CATEGORIES.includes(req.query.category)) query = query.eq("category", req.query.category);
    if (typeof req.query.projectId === "string" && numberId(req.query.projectId)) query = query.eq("project_id", numberId(req.query.projectId)!);
    if (typeof req.query.search === "string" && req.query.search.trim()) query = query.ilike("original_file_name", `%${req.query.search.trim()}%`);
    const { data, error } = await query; if (error) throw error;
    return res.json(await Promise.all((data || []).map(documentView)));
  } catch (error: any) { return res.status(500).json({ error: "Failed to load documents", details: error?.message }); }
});

router.get("/documents/:id", requireUserAuth, requireDocuments, async (req: UserRequest, res) => {
  try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid document ID"); const document = await documentForActor(id, { userId: req.user!.id }); if (!document) return fail(res, 404, "Document not found"); res.json(await documentView(document)); }
  catch (error: any) { return res.status(500).json({ error: "Failed to load document", details: error?.message }); }
});

async function handleDocumentUpload(req: UserRequest, res: Response) {
  try {
    const { projectId, milestoneId, category = "Other", description, file } = req.body ?? {};
    const project = numberId(projectId) ? await projectForClient(numberId(projectId)!, req.user!.id) : null;
    if (projectId && !project) return fail(res, 403, "A document must belong to your project");
    if (!DOCUMENT_CATEGORIES.includes(category)) return fail(res, 400, "Invalid document category");
    const upload = parseUpload(file, MAX_DOCUMENT_BYTES);
    if (!upload) return fail(res, 400, "Unsupported or invalid file");
    const storagePath = project
      ? `${req.user!.id}/${project.id}/${crypto.randomUUID()}-${upload.fileName}`
      : `${req.user!.id}/general/${crypto.randomUUID()}-${upload.fileName}`;
    const { error: uploadError } = await supabase.storage.from("project-documents").upload(storagePath, upload.bytes, { contentType: upload.contentType, upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase.from("documents").insert({
      file_name: upload.fileName,
      original_file_name: upload.fileName,
      file_type: upload.fileName.includes(".") ? upload.fileName.split(".").pop() : "file",
      mime_type: upload.contentType,
      file_size: upload.bytes.length,
      storage_path: storagePath,
      category,
      description: typeof description === "string" ? description.trim() : null,
      project_id: project ? project.id : null,
      milestone_id: numberId(milestoneId),
      client_id: req.user!.id,
      uploaded_by_user_id: req.user!.id,
    }).select().single();
    if (error) throw error;
    await supabase.from("document_activity").insert({ document_id: data.id, actor_user_id: req.user!.id, action: "document_uploaded" });
    await audit({ userId: req.user!.id }, "document_uploaded", "document", String(data.id), { projectId: project ? project.id : null });
    await notifyAdmins("document_uploaded", "New client document", `${project ? project.name + ": " : ""}${upload.fileName}`, "document", String(data.id));
    res.status(201).json(await documentView(data));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to upload document", details: error?.message });
  }
}

router.post("/documents", requireUserAuth, requireDocuments, rejectOversizedDocument, handleDocumentUpload);
router.post("/documents/upload", requireUserAuth, requireDocuments, rejectOversizedDocument, handleDocumentUpload);

router.get("/documents/:id/download", requireUserAuth, requireDocuments, async (req: UserRequest, res) => {
  try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid document ID"); const document = await documentForActor(id, { userId: req.user!.id }); if (!document) return fail(res, 404, "Document not found"); const { data, error } = await supabase.storage.from("project-documents").createSignedUrl(document.storage_path, 300); if (error || !data?.signedUrl) return fail(res, 404, "Document unavailable"); await supabase.from("document_activity").insert({ document_id: id, actor_user_id: req.user!.id, action: "document_downloaded" }); res.json({ url: data.signedUrl, fileName: document.original_file_name, mimeType: document.mime_type }); }
  catch (error: any) { res.status(500).json({ error: "Failed to download document", details: error?.message }); }
});

router.get("/admin/documents", requireAuth, requireDocuments, async (req: AdminRequest, res) => {
  try { let query = supabase.from("documents").select("*").neq("status", "deleted").order("created_at", { ascending: false }); if (typeof req.query.category === "string" && DOCUMENT_CATEGORIES.includes(req.query.category)) query = query.eq("category", req.query.category); if (typeof req.query.visibility === "string" && DOCUMENT_VISIBILITIES.includes(req.query.visibility)) query = query.eq("visibility", req.query.visibility); if (typeof req.query.clientId === "string") query = query.eq("client_id", req.query.clientId); if (typeof req.query.projectId === "string" && numberId(req.query.projectId)) query = query.eq("project_id", numberId(req.query.projectId)!); if (typeof req.query.search === "string" && req.query.search.trim()) query = query.ilike("original_file_name", `%${req.query.search.trim()}%`); const { data, error } = await query; if (error) throw error; res.json(await Promise.all((data || []).map(documentView))); }
  catch (error: any) { res.status(500).json({ error: "Failed to load admin documents", details: error?.message }); }
});

router.post("/admin/documents", requireAuth, requireDocuments, rejectOversizedDocument, async (req: AdminRequest, res) => {
  try { const { clientId, projectId, milestoneId, category = "Other", visibility = "client_visible", description, file } = req.body ?? {}; if (typeof clientId !== "string" || !clientId) return fail(res, 400, "clientId is required"); if (!DOCUMENT_CATEGORIES.includes(category) || !DOCUMENT_VISIBILITIES.includes(visibility)) return fail(res, 400, "Invalid category or visibility"); const project = numberId(projectId) ? await supabase.from("projects").select("id,client_id,name").eq("id", numberId(projectId)!).eq("client_id", clientId).maybeSingle() : { data: null, error: null }; if (project.error) throw project.error; if (projectId && !project.data) return fail(res, 403, "Project does not belong to client"); const upload = parseUpload(file, MAX_DOCUMENT_BYTES); if (!upload) return fail(res, 400, "Unsupported or invalid file"); const storagePath = `admin/${clientId}/${crypto.randomUUID()}-${upload.fileName}`; const { error: uploadError } = await supabase.storage.from("project-documents").upload(storagePath, upload.bytes, { contentType: upload.contentType, upsert: false }); if (uploadError) throw uploadError; const { data, error } = await supabase.from("documents").insert({ file_name: upload.fileName, original_file_name: upload.fileName, file_type: upload.fileName.includes(".") ? upload.fileName.split(".").pop() : "file", mime_type: upload.contentType, file_size: upload.bytes.length, storage_path: storagePath, category, visibility, description: typeof description === "string" ? description.trim() : null, project_id: numberId(projectId), milestone_id: numberId(milestoneId), client_id: clientId, uploaded_by_admin_id: req.admin!.id }).select().single(); if (error) throw error; await supabase.from("document_activity").insert({ document_id: data.id, actor_admin_id: req.admin!.id, action: "document_uploaded" }); await audit({ adminId: req.admin!.id }, "document_uploaded", "document", String(data.id)); if (visibility === "client_visible") await notifyUser(clientId, "document_uploaded", "New project document", data.original_file_name, "document", String(data.id)); res.status(201).json(await documentView(data)); }
  catch (error: any) { res.status(500).json({ error: "Failed to upload admin document", details: error?.message }); }
});

router.get("/admin/documents/:id", requireAuth, requireDocuments, async (req: AdminRequest, res) => {
  try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid document ID"); const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle(); if (error) throw error; if (!data || data.status === "deleted") return fail(res, 404, "Document not found"); const { data: activity, error: activityError } = await supabase.from("document_activity").select("*").eq("document_id", id).order("created_at", { ascending: false }); if (activityError) throw activityError; res.json({ ...(await documentView(data)), activity: activity || [] }); }
  catch (error: any) { res.status(500).json({ error: "Failed to load admin document", details: error?.message }); }
});

router.get("/admin/documents/:id/download", requireAuth, requireDocuments, async (req: AdminRequest, res) => {
  try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid document ID"); const { data, error } = await supabase.from("documents").select("*").eq("id", id).neq("status", "deleted").maybeSingle(); if (error) throw error; if (!data) return fail(res, 404, "Document not found"); const signed = await supabase.storage.from("project-documents").createSignedUrl(data.storage_path, 300); if (signed.error || !signed.data?.signedUrl) return fail(res, 404, "Document unavailable"); await supabase.from("document_activity").insert({ document_id: id, actor_admin_id: req.admin!.id, action: "document_downloaded" }); res.json({ url: signed.data.signedUrl, fileName: data.original_file_name, mimeType: data.mime_type }); }
  catch (error: any) { res.status(500).json({ error: "Failed to download document", details: error?.message }); }
});

router.patch("/admin/documents/:id", requireAuth, requireDocuments, async (req: AdminRequest, res) => {
  try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid document ID"); const { visibility, category, description, status } = req.body ?? {}; if (visibility !== undefined && !DOCUMENT_VISIBILITIES.includes(visibility)) return fail(res, 400, "Invalid visibility"); if (category !== undefined && !DOCUMENT_CATEGORIES.includes(category)) return fail(res, 400, "Invalid category"); if (status !== undefined && !DOCUMENT_STATUSES.includes(status)) return fail(res, 400, "Invalid status"); const { data: existing, error: existingError } = await supabase.from("documents").select("*").eq("id", id).maybeSingle(); if (existingError) throw existingError; if (!existing || existing.status === "deleted") return fail(res, 404, "Document not found"); const patch: Record<string, unknown> = {}; if (visibility !== undefined) patch.visibility = visibility; if (category !== undefined) patch.category = category; if (description !== undefined) patch.description = description; if (status !== undefined) patch.status = status; const { data, error } = await supabase.from("documents").update(patch).eq("id", id).select().single(); if (error) throw error; const action = status === "archived" ? "document_archived" : status === "active" && existing.status === "archived" ? "document_restored" : visibility !== undefined && visibility !== existing.visibility ? "document_visibility_changed" : "document_updated"; await supabase.from("document_activity").insert({ document_id: id, actor_admin_id: req.admin!.id, action, metadata: { changes: patch } }); await audit({ adminId: req.admin!.id }, action, "document", String(id), { changes: patch }); if (visibility === "client_visible" && existing.visibility !== "client_visible") await notifyUser(existing.client_id, "document_visible", "Document is now available", existing.original_file_name, "document", String(id)); res.json(await documentView(data)); }
  catch (error: any) { res.status(500).json({ error: "Failed to update document", details: error?.message }); }
});

router.delete("/admin/documents/:id", requireAuth, requireDocuments, async (req: AdminRequest, res) => { try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid document ID"); const { data, error } = await supabase.from("documents").update({ status: "deleted" }).eq("id", id).neq("status", "deleted").select().maybeSingle(); if (error) throw error; if (!data) return fail(res, 404, "Document not found"); await supabase.from("document_activity").insert({ document_id: id, actor_admin_id: req.admin!.id, action: "document_deleted" }); await audit({ adminId: req.admin!.id }, "document_deleted", "document", String(id)); res.json({ success: true }); } catch (error: any) { res.status(500).json({ error: "Failed to delete document", details: error?.message }); } });

async function conversationForActor(id: number, actor: { userId?: string; adminId?: number }) {
  const { data, error } = await supabase.from("project_conversations").select("*").eq("id", id).maybeSingle(); if (error) throw error; if (!data) return null;
  if (actor.adminId) return data;
  const profile = await userProfileRepository.getById(actor.userId!);
  if (profile?.role === "partner" || profile?.role === "bpo_partner") { const participant = await supabase.from("conversation_participants").select("id").eq("conversation_id", id).eq("user_id", actor.userId!).maybeSingle(); return participant.data ? data : null; }
  return data.client_id === actor.userId ? data : null;
}
async function conversationView(conversation: any, actor: { userId?: string; adminId?: number }) {
  const { data: messages, error } = await supabase.from("conversation_messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true }); if (error) throw error;
  const { data: attachments, error: attachmentError } = await supabase.from("conversation_message_attachments").select("id,message_id,file_name,mime_type,file_size,created_at").in("message_id", (messages || []).map((message: any) => message.id)); if (attachmentError) throw attachmentError;
  const readQuery = supabase.from("conversation_message_reads").select("message_id").in("message_id", (messages || []).map((message: any) => message.id));
  const { data: reads, error: readError } = actor.adminId ? await readQuery.eq("admin_id", actor.adminId) : await readQuery.eq("user_id", actor.userId!); if (readError) throw readError;
  const readIds = new Set((reads || []).map((read: any) => read.message_id));
  return { ...conversation, messages: (messages || []).map((message: any) => ({ ...message, body: message.deleted_at ? "Message deleted" : message.body, attachments: (attachments || []).filter((attachment: any) => attachment.message_id === message.id), read: readIds.has(message.id) })) };
}
async function markMessagesRead(messageIds: number[], actor: { userId?: string; adminId?: number }) {
  for (const messageId of messageIds) {
    const payload: Record<string, unknown> = actor.adminId ? { message_id: messageId, admin_id: actor.adminId } : { message_id: messageId, user_id: actor.userId };
    const { error } = await supabase.from("conversation_message_reads").insert(payload);
    if (error && error.code !== "23505") throw error;
  }
}

router.get("/conversations", requireUserAuth, requireCommunication, async (req: UserRequest, res) => { try { const { data, error } = await supabase.from("project_conversations").select("*").eq("client_id", req.user!.id).neq("status", "archived").order("updated_at", { ascending: false }); if (error) throw error; const results = []; for (const row of data || []) results.push(await conversationView(row, { userId: req.user!.id })); res.json(results); } catch (error: any) { res.status(500).json({ error: "Failed to load conversations", details: error?.message }); } });
router.get("/conversations/:id", requireUserAuth, requireCommunication, async (req: UserRequest, res) => { try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid conversation ID"); const conversation = await conversationForActor(id, { userId: req.user!.id }); if (!conversation) return fail(res, 404, "Conversation not found"); res.json(await conversationView(conversation, { userId: req.user!.id })); } catch (error: any) { res.status(500).json({ error: "Failed to load conversation", details: error?.message }); } });
router.post("/conversations", requireUserAuth, requireCommunication, async (req: UserRequest, res) => {
  try {
    const { projectId, subject } = req.body ?? {};
    if (typeof subject !== "string" || subject.trim().length < 3) return fail(res, 400, "Subject is required");

    let targetProjectId = numberId(projectId);
    let projectName = "Client Project";
    if (targetProjectId) {
      const proj = await projectForClient(targetProjectId, req.user!.id);
      if (!proj) {
        targetProjectId = null;
      } else {
        projectName = proj.name;
      }
    }

    if (!targetProjectId) {
      const { data: userProjects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("client_id", req.user!.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (userProjects && userProjects.length > 0) {
        targetProjectId = userProjects[0].id;
        projectName = userProjects[0].name;
      } else {
        const { data: newProj, error: projErr } = await supabase
          .from("projects")
          .insert({
            client_id: req.user!.id,
            name: "Client Consultation & Alignment",
            description: "General enterprise consultation and project alignment",
            vertical: "Customer Support",
            status: "planning",
            required_seats: 1,
          })
          .select("id, name")
          .single();

        if (projErr) throw projErr;
        targetProjectId = newProj.id;
        projectName = newProj.name;
      }
    }

    const { data, error } = await supabase
      .from("project_conversations")
      .insert({
        project_id: targetProjectId,
        client_id: req.user!.id,
        subject: subject.trim(),
        created_by_user_id: req.user!.id,
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.from("conversation_participants").insert({ conversation_id: data.id, user_id: req.user!.id });
    await audit({ userId: req.user!.id }, "conversation_created", "conversation", String(data.id));
    await notifyAdmins("conversation_created", "New project conversation", `${projectName}: ${data.subject}`, "conversation", String(data.id));
    res.status(201).json(await conversationView(data, { userId: req.user!.id }));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create conversation", details: error?.message });
  }
});

router.post("/conversations/:id/messages", requireUserAuth, requireCommunication, async (req: UserRequest, res) => { try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid conversation ID"); const conversation = await conversationForActor(id, { userId: req.user!.id }); if (!conversation) return fail(res, 404, "Conversation not found"); if (conversation.status !== "open") return fail(res, 409, "Conversation is not open"); const body = typeof req.body?.body === "string" ? req.body.body.trim() : typeof req.body?.content === "string" ? req.body.content.trim() : typeof req.body?.message === "string" ? req.body.message.trim() : ""; if (!body) return fail(res, 400, "Message body is required"); const rawAttachments = Array.isArray(req.body?.attachments) ? req.body.attachments : []; if (rawAttachments.length > 5 || rawAttachments.some((item: any) => !parseUpload(item, MAX_MESSAGE_ATTACHMENT_BYTES))) return fail(res, 400, "Invalid message attachment"); const { data: message, error } = await supabase.from("conversation_messages").insert({ conversation_id: id, sender_user_id: req.user!.id, body }).select().single(); if (error) throw error; for (const raw of rawAttachments) { const attachment = parseUpload(raw, MAX_MESSAGE_ATTACHMENT_BYTES)!; const storagePath = `${conversation.client_id}/${id}/${crypto.randomUUID()}-${attachment.fileName}`; const upload = await supabase.storage.from("project-communication").upload(storagePath, attachment.bytes, { contentType: attachment.contentType, upsert: false }); if (upload.error) throw upload.error; await supabase.from("conversation_message_attachments").insert({ message_id: message.id, uploaded_by_user_id: req.user!.id, storage_path: storagePath, file_name: attachment.fileName, mime_type: attachment.contentType, file_size: attachment.bytes.length }); } await supabase.from("project_conversations").update({ updated_at: new Date().toISOString() }).eq("id", id); await notifyAdmins("conversation_message", "New project message", conversation.subject, "conversation", String(id)); await audit({ userId: req.user!.id }, "message_sent", "conversation", String(id)); res.status(201).json(message); } catch (error: any) { res.status(500).json({ error: "Failed to send message", details: error?.message }); } });

router.post("/conversations/:id/read", requireUserAuth, requireCommunication, async (req: UserRequest, res) => { try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid conversation ID"); const conversation = await conversationForActor(id, { userId: req.user!.id }); if (!conversation) return fail(res, 404, "Conversation not found"); const { data: messages, error } = await supabase.from("conversation_messages").select("id").eq("conversation_id", id); if (error) throw error; await markMessagesRead((messages || []).map((message: any) => message.id), { userId: req.user!.id }); res.json({ success: true }); } catch (error: any) { res.status(500).json({ error: "Failed to mark conversation read", details: error?.message }); } });

router.get("/admin/conversations", requireAuth, requireCommunication, async (_req: AdminRequest, res) => { try { const { data, error } = await supabase.from("project_conversations").select("*").neq("status", "archived").order("updated_at", { ascending: false }); if (error) throw error; res.json(data || []); } catch (error: any) { res.status(500).json({ error: "Failed to load admin conversations", details: error?.message }); } });
router.get("/admin/conversations/:id", requireAuth, requireCommunication, async (req: AdminRequest, res) => { try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid conversation ID"); const conversation = await conversationForActor(id, { adminId: req.admin!.id }); if (!conversation) return fail(res, 404, "Conversation not found"); res.json(await conversationView(conversation, { adminId: req.admin!.id })); } catch (error: any) { res.status(500).json({ error: "Failed to load admin conversation", details: error?.message }); } });
router.post("/admin/conversations", requireAuth, requireCommunication, async (req: AdminRequest, res) => {
  try {
    const { projectId, clientId, subject } = req.body ?? {};
    if (typeof clientId !== "string" || !clientId) return fail(res, 400, "clientId is required");
    if (typeof subject !== "string" || subject.trim().length < 3) return fail(res, 400, "Subject is required");

    let targetProjectId = numberId(projectId);
    let projectName = "Client Project";
    if (targetProjectId) {
      const { data: proj, error: projErr } = await supabase.from("projects").select("id,client_id,name").eq("id", targetProjectId).maybeSingle();
      if (projErr) throw projErr;
      if (!proj || proj.client_id !== clientId) {
        targetProjectId = null;
      } else {
        projectName = proj.name;
      }
    }

    if (!targetProjectId) {
      const { data: clientProjects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (clientProjects && clientProjects.length > 0) {
        targetProjectId = clientProjects[0].id;
        projectName = clientProjects[0].name;
      } else {
        const { data: newProj, error: projErr } = await supabase
          .from("projects")
          .insert({
            client_id: clientId,
            name: "Client Consultation & Alignment",
            description: "General enterprise consultation and project alignment",
            vertical: "Customer Support",
            status: "planning",
            required_seats: 1,
          })
          .select("id, name")
          .single();

        if (projErr) throw projErr;
        targetProjectId = newProj.id;
        projectName = newProj.name;
      }
    }

    const { data, error } = await supabase
      .from("project_conversations")
      .insert({
        project_id: targetProjectId,
        client_id: clientId,
        subject: subject.trim(),
        created_by_admin_id: req.admin!.id,
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.from("conversation_participants").insert({ conversation_id: data.id, admin_id: req.admin!.id });
    await notifyUser(clientId, "conversation_created", "New project conversation", `${projectName}: ${data.subject}`, "conversation", String(data.id));
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create admin conversation", details: error?.message });
  }
});
router.post("/admin/conversations/:id/messages", requireAuth, requireCommunication, async (req: AdminRequest, res) => { try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid conversation ID"); const conversation = await conversationForActor(id, { adminId: req.admin!.id }); if (!conversation) return fail(res, 404, "Conversation not found"); if (conversation.status !== "open") return fail(res, 409, "Conversation is not open"); const body = typeof req.body?.body === "string" ? req.body.body.trim() : typeof req.body?.content === "string" ? req.body.content.trim() : typeof req.body?.message === "string" ? req.body.message.trim() : ""; if (!body) return fail(res, 400, "Message body is required"); const { data, error } = await supabase.from("conversation_messages").insert({ conversation_id: id, sender_admin_id: req.admin!.id, body }).select().single(); if (error) throw error; await supabase.from("project_conversations").update({ updated_at: new Date().toISOString() }).eq("id", id); await notifyUser(conversation.client_id, "conversation_message", "New project message", conversation.subject, "conversation", String(id)); await audit({ adminId: req.admin!.id }, "message_sent", "conversation", String(id)); res.status(201).json(data); } catch (error: any) { res.status(500).json({ error: "Failed to send admin message", details: error?.message }); } });
router.post("/admin/conversations/:id/read", requireAuth, requireCommunication, async (req: AdminRequest, res) => { try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid conversation ID"); const conversation = await conversationForActor(id, { adminId: req.admin!.id }); if (!conversation) return fail(res, 404, "Conversation not found"); const { data: messages, error } = await supabase.from("conversation_messages").select("id").eq("conversation_id", id); if (error) throw error; await markMessagesRead((messages || []).map((message: any) => message.id), { adminId: req.admin!.id }); res.json({ success: true }); } catch (error: any) { res.status(500).json({ error: "Failed to mark admin conversation read", details: error?.message }); } });
router.patch("/admin/conversations/:id", requireAuth, requireCommunication, async (req: AdminRequest, res) => { try { const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid conversation ID"); const conversation = await conversationForActor(id, { adminId: req.admin!.id }); if (!conversation) return fail(res, 404, "Conversation not found"); if (!CONVERSATION_STATUSES.includes(req.body?.status)) return fail(res, 400, "Invalid conversation status"); const { data, error } = await supabase.from("project_conversations").update({ status: req.body.status }).eq("id", id).select().single(); if (error) throw error; await audit({ adminId: req.admin!.id }, "conversation_status_changed", "conversation", String(id), { status: req.body.status }); res.json(data); } catch (error: any) { res.status(500).json({ error: "Failed to update conversation", details: error?.message }); } });

router.get("/conversations/:id/attachments/:attachmentId", requireUserAuth, requireCommunication, async (req: UserRequest, res) => { try { const id = numberId(req.params.id); const attachmentId = numberId(req.params.attachmentId); if (!id || !attachmentId) return fail(res, 400, "Invalid attachment ID"); const conversation = await conversationForActor(id, { userId: req.user!.id }); if (!conversation) return fail(res, 404, "Conversation not found"); const { data, error } = await supabase.from("conversation_message_attachments").select("*").eq("id", attachmentId).maybeSingle(); if (error) throw error; if (!data) return fail(res, 404, "Attachment not found"); const signed = await supabase.storage.from("project-communication").createSignedUrl(data.storage_path, 300); if (signed.error || !signed.data?.signedUrl) return fail(res, 404, "Attachment unavailable"); res.json({ url: signed.data.signedUrl, fileName: data.file_name, mimeType: data.mime_type }); } catch (error: any) { res.status(500).json({ error: "Failed to download communication attachment", details: error?.message }); } });

router.get("/admin/conversations/:id/attachments/:attachmentId", requireAuth, requireCommunication, async (req: AdminRequest, res) => { try { const id = numberId(req.params.id); const attachmentId = numberId(req.params.attachmentId); if (!id || !attachmentId) return fail(res, 400, "Invalid attachment ID"); const conversation = await conversationForActor(id, { adminId: req.admin!.id }); if (!conversation) return fail(res, 404, "Conversation not found"); const { data, error } = await supabase.from("conversation_message_attachments").select("*").eq("id", attachmentId).maybeSingle(); if (error) throw error; if (!data) return fail(res, 404, "Attachment not found"); const signed = await supabase.storage.from("project-communication").createSignedUrl(data.storage_path, 300); if (signed.error || !signed.data?.signedUrl) return fail(res, 404, "Attachment unavailable"); res.json({ url: signed.data.signedUrl, fileName: data.file_name, mimeType: data.mime_type }); } catch (error: any) { res.status(500).json({ error: "Failed to download communication attachment", details: error?.message }); } });

export default router;
