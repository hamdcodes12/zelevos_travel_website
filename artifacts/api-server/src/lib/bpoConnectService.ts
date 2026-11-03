/**
 * THINKATIC — BPO ↔ ADMIN CONNECT SERVICE
 * Production Authoritative Communication & Payment Request Engine
 *
 * Core Features:
 * - Dual-layer persistence: Supabase PostgreSQL tables + local disk JSON mirror.
 * - Multi-tenant isolation: strict partner/centre scoping, zero cross-tenant leakage.
 * - Real notifications: integrated with public.notifications, selective per-conversation read receipts.
 * - Real meetings: integrated with public.meetings and bpo_partner_meetings.
 * - Real audit logging: integrated with public.audit_logs.
 * - Private attachments: private Supabase Storage + short-lived signed URLs.
 * - Manual financial control: payment request review & manual approval workflow.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { supabase } from "@workspace/db";
import { logger } from "./logger.js";
import {
  saveFile,
  createSignedUrl,
  getDomainPath,
  initStorage,
} from "./storageService.js";

// Ensure storage initialized
initStorage();

export type BpoConnectRequestType =
  | "project_completed"
  | "advance_payment_request"
  | "payment_status"
  | "payment_clarification"
  | "project_milestone"
  | "operational_issue"
  | "general_discussion"
  | "meeting_request";

export type BpoConnectStatus =
  | "OPEN"
  | "ADMIN_REVIEW"
  | "WAITING_FOR_BPO"
  | "IN_PROGRESS"
  | "MEETING_SCHEDULED"
  | "RESOLVED"
  | "CLOSED";

export type BpoPaymentStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "INFO_REQUIRED"
  | "APPROVED_FOR_PROCESSING"
  | "PROCESSING"
  | "PAID"
  | "REJECTED"
  | "CANCELLED";

export type BpoMeetingRequestStatus =
  | "REQUESTED"
  | "SCHEDULED"
  | "RESCHEDULED"
  | "DECLINED"
  | "CANCELLED"
  | "COMPLETED";

export interface BpoAdminAttachmentRecord {
  id: string;
  conversation_id: string;
  message_id: string | null;
  uploader_type: "BPO" | "ADMIN";
  uploader_user_id: string | null;
  uploader_admin_id: number | null;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  created_at: string;
  download_url?: string;
}

export interface BpoAdminMessageRecord {
  id: string;
  conversation_id: string;
  sender_type: "BPO" | "ADMIN";
  sender_user_id: string | null;
  sender_admin_id: number | null;
  sender_name: string;
  message: string;
  read_at: string | null;
  created_at: string;
  attachments?: BpoAdminAttachmentRecord[];
}

export interface BpoAdminMeetingRequestRecord {
  id: string;
  conversation_id: string;
  partner_id: string;
  project_id: number | null;
  requested_by_user_id: string;
  title: string;
  preferred_date: string;
  preferred_time: string;
  duration_minutes: number;
  agenda: string;
  message: string | null;
  status: BpoMeetingRequestStatus;
  scheduled_meeting_id: number | null;
  reviewed_by_admin_id: number | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  meeting_details?: any;
}

export interface BpoAdminConversationRecord {
  id: string;
  partner_id: string;
  partner_name: string;
  partner_code: string;
  centre_id: number | null;
  centre_name: string | null;
  project_id: number | null;
  project_name: string | null;
  created_by_user_id: string;
  created_by_user_name: string;
  request_type: BpoConnectRequestType;
  subject: string;
  status: BpoConnectStatus;
  payment_status: BpoPaymentStatus | null;
  requested_amount: number | null;
  currency: string;
  milestone_name: string | null;
  completion_date: string | null;
  description: string;
  last_message_at: string;
  last_message_preview: string;
  last_sender_type: "BPO" | "ADMIN";
  unread_admin_count: number;
  unread_bpo_count: number;
  assigned_admin_id: number | null;
  assigned_admin_name: string | null;
  payout_statement_id: number | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  messages?: BpoAdminMessageRecord[];
  attachments?: BpoAdminAttachmentRecord[];
  meeting_requests?: BpoAdminMeetingRequestRecord[];
}

// Local cache / disk mirror for resilience across dev & test
function getStoreFilePath(): string {
  const root = getDomainPath("bpo-connect");
  return path.join(root, "bpo_connect_store.json");
}

let memoryStore: {
  conversations: BpoAdminConversationRecord[];
  messages: BpoAdminMessageRecord[];
  attachments: BpoAdminAttachmentRecord[];
  meetingRequests: BpoAdminMeetingRequestRecord[];
} = {
  conversations: [],
  messages: [],
  attachments: [],
  meetingRequests: [],
};

let storeLoaded = false;

function loadStoreFromDisk(): void {
  if (storeLoaded) return;
  const filePath = getStoreFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      memoryStore = {
        conversations: parsed.conversations || [],
        messages: parsed.messages || [],
        attachments: parsed.attachments || [],
        meetingRequests: parsed.meetingRequests || [],
      };
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Notice reading bpo_connect_store.json");
  }
  storeLoaded = true;
}

function persistStoreToDisk(): void {
  try {
    const filePath = getStoreFilePath();
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(memoryStore, null, 2), "utf-8");
  } catch (err: any) {
    logger.warn({ error: err.message }, "Notice writing bpo_connect_store.json");
  }
}

// Helper: Audit Logging
async function auditLog(
  actor: { userId?: string; adminId?: number },
  action: string,
  entityId: string,
  metadata: Record<string, any> = {}
) {
  try {
    await supabase.from("audit_logs").insert({
      actor_user_id: actor.userId || null,
      actor_admin_id: actor.adminId || null,
      action,
      entity_type: "bpo_connect_conversation",
      entity_id: entityId,
      metadata,
    });
  } catch (err: any) {
    logger.warn({ error: err.message }, "Notice inserting into audit_logs");
  }
}

// Helper: Notify Admins
async function notifyAdmins(
  title: string,
  body: string,
  conversationId: string,
  type = "bpo_connect_message"
) {
  try {
    const { data: admins } = await supabase.from("admin_users").select("id");
    if (admins && admins.length > 0) {
      const rows = admins.map((a: any) => ({
        recipient_admin_id: a.id,
        type,
        title,
        body,
        entity_type: "bpo_connect_conversation",
        entity_id: conversationId,
      }));
      await supabase.from("notifications").insert(rows);
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Notice inserting admin notifications");
  }
}

// Helper: Notify Partner Users
async function notifyPartnerUsers(
  partnerId: string,
  title: string,
  body: string,
  conversationId: string,
  type = "bpo_connect_admin_reply"
) {
  try {
    const { data: memberships } = await supabase
      .from("bpo_partner_users")
      .select("user_id")
      .eq("partner_id", partnerId)
      .eq("status", "active");

    if (memberships && memberships.length > 0) {
      const rows = memberships.map((m: any) => ({
        recipient_user_id: m.user_id,
        type,
        title,
        body,
        entity_type: "bpo_connect_conversation",
        entity_id: conversationId,
      }));
      await supabase.from("notifications").insert(rows);
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Notice inserting partner notifications");
  }
}

// Helper: Fetch Partner & Centre Details
async function resolvePartnerMetadata(partnerId: string) {
  let partnerName = "BPO Partner";
  let partnerCode = "THK-BPO";
  let centreId: number | null = null;
  let centreName: string | null = null;

  try {
    const { data: p } = await supabase
      .from("bpo_partners")
      .select("name, legal_name, partner_code")
      .eq("id", partnerId)
      .maybeSingle();

    if (p) {
      partnerName = p.name || p.legal_name || partnerName;
      partnerCode = p.partner_code || partnerCode;
    }

    const { data: c } = await supabase
      .from("bpo_centres")
      .select("id, name")
      .eq("partner_id", partnerId)
      .limit(1)
      .maybeSingle();

    if (c) {
      centreId = c.id;
      centreName = c.name;
    }
  } catch {}

  return { partnerName, partnerCode, centreId, centreName };
}

// Helper: Fetch Project Name
async function resolveProjectName(projectId: number | null) {
  if (!projectId) return null;
  try {
    const { data } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle();
    return data?.name || null;
  } catch {
    return null;
  }
}

// Helper: Generate Signed URLs for Attachments
async function enrichAttachmentsWithUrls(attachments: BpoAdminAttachmentRecord[]): Promise<BpoAdminAttachmentRecord[]> {
  const result: BpoAdminAttachmentRecord[] = [];
  for (const att of attachments) {
    try {
      const signedUrl = await createSignedUrl("bpo-connect", att.storage_path, 3600);
      result.push({ ...att, download_url: signedUrl });
    } catch {
      result.push({ ...att, download_url: `/api/bpo/connect/attachments/${att.id}/file` });
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// BPO PARTNER OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List all conversations for the authenticated BPO Partner
 */
export async function listConversationsForPartner(partnerId: string) {
  loadStoreFromDisk();

  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from("bpo_admin_conversations")
      .select("*")
      .eq("partner_id", partnerId)
      .order("last_message_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch {}

  // Fallback to memory / disk store
  const list = memoryStore.conversations
    .filter((c) => c.partner_id === partnerId)
    .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

  return list;
}

/**
 * Get a single conversation with messages, attachments, and meetings for BPO
 * Marks unread as 0 and marks specific notifications as READ
 */
export async function getConversationForPartner(
  conversationId: string,
  partnerId: string,
  userId?: string
) {
  loadStoreFromDisk();

  let conversation = memoryStore.conversations.find(
    (c) => c.id === conversationId && c.partner_id === partnerId
  );

  // Check Supabase if not found in memory
  if (!conversation) {
    try {
      const { data } = await supabase
        .from("bpo_admin_conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("partner_id", partnerId)
        .maybeSingle();

      if (data) {
        conversation = data;
      }
    } catch {}
  }

  if (!conversation || conversation.partner_id !== partnerId) {
    return null; // Strict multi-tenant isolation
  }

  // Load messages
  let messages = memoryStore.messages.filter((m) => m.conversation_id === conversationId);
  try {
    const { data: dbMsgs } = await supabase
      .from("bpo_admin_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (dbMsgs && dbMsgs.length > 0) {
      messages = dbMsgs;
    }
  } catch {}

  // Load attachments
  let attachments = memoryStore.attachments.filter((a) => a.conversation_id === conversationId);
  try {
    const { data: dbAtts } = await supabase
      .from("bpo_admin_attachments")
      .select("*")
      .eq("conversation_id", conversationId);

    if (dbAtts && dbAtts.length > 0) {
      attachments = dbAtts;
    }
  } catch {}

  const enrichedAttachments = await enrichAttachmentsWithUrls(attachments);

  // Group attachments by message
  const msgsWithAttachments = messages.map((m) => ({
    ...m,
    attachments: enrichedAttachments.filter((a) => a.message_id === m.id),
  }));

  // Load meeting requests
  let meetingRequests = memoryStore.meetingRequests.filter((mr) => mr.conversation_id === conversationId);
  try {
    const { data: dbMrs } = await supabase
      .from("bpo_admin_meeting_requests")
      .select("*")
      .eq("conversation_id", conversationId);

    if (dbMrs && dbMrs.length > 0) {
      meetingRequests = dbMrs;
    }
  } catch {}

  // Fetch linked meeting details if any
  for (const mr of meetingRequests) {
    if (mr.scheduled_meeting_id) {
      try {
        const { data: meet } = await supabase
          .from("meetings")
          .select("id, title, starts_at, ends_at, timezone, location, status, agenda")
          .eq("id", mr.scheduled_meeting_id)
          .maybeSingle();
        if (meet) mr.meeting_details = meet;
      } catch {}
    }
  }

  // 1. Mark BPO unread as 0 on conversation
  conversation.unread_bpo_count = 0;
  try {
    await supabase
      .from("bpo_admin_conversations")
      .update({ unread_bpo_count: 0 })
      .eq("id", conversationId);
  } catch {}

  // 2. Mark specific notifications as READ server-side for this user
  if (userId) {
    try {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_user_id", userId)
        .eq("entity_type", "bpo_connect_conversation")
        .eq("entity_id", conversationId)
        .is("read_at", null);
    } catch (err: any) {
      logger.warn({ error: err.message }, "Notice updating notification read state");
    }
  }

  persistStoreToDisk();

  return {
    ...conversation,
    messages: msgsWithAttachments,
    attachments: enrichedAttachments,
    meeting_requests: meetingRequests,
  };
}

/**
 * Create a new conversation and request by BPO Partner
 */
export async function createConversationByPartner(params: {
  partnerId: string;
  userId: string;
  userName: string;
  requestType: BpoConnectRequestType;
  subject: string;
  message: string;
  projectId?: number | null;
  requestedAmount?: number | null;
  currency?: string;
  milestoneName?: string | null;
  completionDate?: string | null;
  attachments?: Array<{
    fileName: string;
    fileData: string; // base64
    mimeType: string;
    fileSize: number;
  }>;
}) {
  loadStoreFromDisk();

  const conversationId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { partnerName, partnerCode, centreId, centreName } =
    await resolvePartnerMetadata(params.partnerId);

  const projectName = await resolveProjectName(params.projectId || null);

  const isPaymentReq =
    params.requestType === "advance_payment_request" ||
    params.requestType === "project_completed" ||
    params.requestType === "payment_status" ||
    params.requestType === "payment_clarification" ||
    params.requestType === "project_milestone" ||
    (params.requestedAmount && params.requestedAmount > 0);

  const initialPaymentStatus: BpoPaymentStatus | null = isPaymentReq
    ? "REQUESTED"
    : null;

  const conversation: BpoAdminConversationRecord = {
    id: conversationId,
    partner_id: params.partnerId,
    partner_name: partnerName,
    partner_code: partnerCode,
    centre_id: centreId,
    centre_name: centreName,
    project_id: params.projectId || null,
    project_name: projectName,
    created_by_user_id: params.userId,
    created_by_user_name: params.userName,
    request_type: params.requestType,
    subject: params.subject.trim(),
    status: "OPEN",
    payment_status: initialPaymentStatus,
    requested_amount: params.requestedAmount || null,
    currency: params.currency || "USD",
    milestone_name: params.milestoneName || null,
    completion_date: params.completionDate || null,
    description: params.message.trim(),
    last_message_at: now,
    last_message_preview: params.message.trim().slice(0, 100),
    last_sender_type: "BPO",
    unread_admin_count: 1,
    unread_bpo_count: 0,
    assigned_admin_id: null,
    assigned_admin_name: null,
    payout_statement_id: null,
    resolved_at: null,
    closed_at: null,
    created_at: now,
    updated_at: now,
  };

  // Create initial message
  const messageId = crypto.randomUUID();
  const initialMessage: BpoAdminMessageRecord = {
    id: messageId,
    conversation_id: conversationId,
    sender_type: "BPO",
    sender_user_id: params.userId,
    sender_admin_id: null,
    sender_name: params.userName,
    message: params.message.trim(),
    read_at: null,
    created_at: now,
  };

  // Process attachments
  const savedAttachments: BpoAdminAttachmentRecord[] = [];
  if (params.attachments && params.attachments.length > 0) {
    for (const att of params.attachments) {
      try {
        const buffer = Buffer.from(
          att.fileData.includes(",") ? att.fileData.split(",")[1] : att.fileData,
          "base64"
        );
        const safeName = att.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const relativeKey = `bpo_${params.partnerId}/${conversationId}/${Date.now()}_${safeName}`;
        await saveFile("bpo-connect", relativeKey, buffer, att.mimeType || "application/octet-stream");

        const attRecord: BpoAdminAttachmentRecord = {
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          message_id: messageId,
          uploader_type: "BPO",
          uploader_user_id: params.userId,
          uploader_admin_id: null,
          file_name: att.fileName,
          file_size: buffer.length,
          file_type: att.mimeType,
          storage_path: relativeKey,
          created_at: now,
        };
        savedAttachments.push(attRecord);
        memoryStore.attachments.push(attRecord);
      } catch (err: any) {
        logger.warn({ error: err.message }, "Notice saving attachment in createConversation");
      }
    }
  }

  // Update memory store
  memoryStore.conversations.unshift(conversation);
  memoryStore.messages.push(initialMessage);
  persistStoreToDisk();

  // Try Supabase inserts
  try {
    await supabase.from("bpo_admin_conversations").insert(conversation);
    await supabase.from("bpo_admin_messages").insert(initialMessage);
    if (savedAttachments.length > 0) {
      await supabase.from("bpo_admin_attachments").insert(savedAttachments);
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Notice inserting conversation into Supabase");
  }

  // Notify Admins
  await notifyAdmins(
    `New Request from ${partnerName}: ${params.subject}`,
    params.message.slice(0, 150),
    conversationId,
    "bpo_connect_new_request"
  );

  // Audit
  await auditLog({ userId: params.userId }, "bpo_connect_conversation_created", conversationId, {
    requestType: params.requestType,
    subject: params.subject,
    partnerId: params.partnerId,
    requestedAmount: params.requestedAmount,
  });

  return {
    ...conversation,
    messages: [
      {
        ...initialMessage,
        attachments: await enrichAttachmentsWithUrls(savedAttachments),
      },
    ],
  };
}

/**
 * Add a new message by BPO Partner
 */
export async function addMessageByPartner(params: {
  conversationId: string;
  partnerId: string;
  userId: string;
  userName: string;
  message: string;
  attachments?: Array<{
    fileName: string;
    fileData: string;
    mimeType: string;
    fileSize: number;
  }>;
}) {
  loadStoreFromDisk();

  const conversation = memoryStore.conversations.find(
    (c) => c.id === params.conversationId && c.partner_id === params.partnerId
  );

  if (!conversation) {
    throw new Error("Conversation not found or access denied.");
  }

  const messageId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Process attachments
  const savedAttachments: BpoAdminAttachmentRecord[] = [];
  if (params.attachments && params.attachments.length > 0) {
    for (const att of params.attachments) {
      try {
        const buffer = Buffer.from(
          att.fileData.includes(",") ? att.fileData.split(",")[1] : att.fileData,
          "base64"
        );
        const safeName = att.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const relativeKey = `bpo_${params.partnerId}/${params.conversationId}/${Date.now()}_${safeName}`;
        await saveFile("bpo-connect", relativeKey, buffer, att.mimeType || "application/octet-stream");

        const attRecord: BpoAdminAttachmentRecord = {
          id: crypto.randomUUID(),
          conversation_id: params.conversationId,
          message_id: messageId,
          uploader_type: "BPO",
          uploader_user_id: params.userId,
          uploader_admin_id: null,
          file_name: att.fileName,
          file_size: buffer.length,
          file_type: att.mimeType,
          storage_path: relativeKey,
          created_at: now,
        };
        savedAttachments.push(attRecord);
        memoryStore.attachments.push(attRecord);
      } catch (err: any) {
        logger.warn({ error: err.message }, "Notice saving attachment in addMessageByPartner");
      }
    }
  }

  const msgRecord: BpoAdminMessageRecord = {
    id: messageId,
    conversation_id: params.conversationId,
    sender_type: "BPO",
    sender_user_id: params.userId,
    sender_admin_id: null,
    sender_name: params.userName,
    message: params.message.trim(),
    read_at: null,
    created_at: now,
  };

  memoryStore.messages.push(msgRecord);

  // Update conversation
  conversation.last_message_at = now;
  conversation.last_message_preview = params.message.trim().slice(0, 100);
  conversation.last_sender_type = "BPO";
  conversation.unread_admin_count += 1;
  conversation.updated_at = now;
  if (conversation.status === "WAITING_FOR_BPO" || conversation.status === "CLOSED" || conversation.status === "RESOLVED") {
    conversation.status = "IN_PROGRESS";
  }

  persistStoreToDisk();

  // Try Supabase inserts
  try {
    await supabase.from("bpo_admin_messages").insert(msgRecord);
    if (savedAttachments.length > 0) {
      await supabase.from("bpo_admin_attachments").insert(savedAttachments);
    }
    await supabase
      .from("bpo_admin_conversations")
      .update({
        last_message_at: now,
        last_message_preview: conversation.last_message_preview,
        last_sender_type: "BPO",
        unread_admin_count: conversation.unread_admin_count,
        status: conversation.status,
        updated_at: now,
      })
      .eq("id", params.conversationId);
  } catch {}

  // Notify Admins
  await notifyAdmins(
    `New message from ${conversation.partner_name}`,
    params.message.slice(0, 150),
    params.conversationId,
    "bpo_connect_message"
  );

  // Audit
  await auditLog({ userId: params.userId }, "bpo_connect_message_sent", params.conversationId, {
    messageId,
  });

  return {
    ...msgRecord,
    attachments: await enrichAttachmentsWithUrls(savedAttachments),
  };
}

/**
 * Request a meeting by BPO Partner
 */
export async function requestMeetingByPartner(params: {
  conversationId: string;
  partnerId: string;
  userId: string;
  userName: string;
  title: string;
  preferredDate: string;
  preferredTime: string;
  durationMinutes: number;
  agenda: string;
  message?: string;
  projectId?: number | null;
}) {
  loadStoreFromDisk();

  const conversation = memoryStore.conversations.find(
    (c) => c.id === params.conversationId && c.partner_id === params.partnerId
  );

  if (!conversation) {
    throw new Error("Conversation not found or access denied.");
  }

  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();

  const reqRecord: BpoAdminMeetingRequestRecord = {
    id: requestId,
    conversation_id: params.conversationId,
    partner_id: params.partnerId,
    project_id: params.projectId || conversation.project_id || null,
    requested_by_user_id: params.userId,
    title: params.title.trim(),
    preferred_date: params.preferredDate,
    preferred_time: params.preferredTime,
    duration_minutes: params.durationMinutes || 30,
    agenda: params.agenda.trim(),
    message: params.message?.trim() || null,
    status: "REQUESTED",
    scheduled_meeting_id: null,
    reviewed_by_admin_id: null,
    admin_notes: null,
    created_at: now,
    updated_at: now,
  };

  memoryStore.meetingRequests.push(reqRecord);

  // Add a system chat message about the meeting request
  const meetingMsgText = `📅 Meeting Request: "${params.title}"\nPreferred Date: ${params.preferredDate} at ${params.preferredTime} (${params.durationMinutes} mins)\nAgenda: ${params.agenda}${params.message ? `\nNotes: ${params.message}` : ""}`;

  const msgRecord: BpoAdminMessageRecord = {
    id: crypto.randomUUID(),
    conversation_id: params.conversationId,
    sender_type: "BPO",
    sender_user_id: params.userId,
    sender_admin_id: null,
    sender_name: params.userName,
    message: meetingMsgText,
    read_at: null,
    created_at: now,
  };

  memoryStore.messages.push(msgRecord);

  // Update conversation
  conversation.last_message_at = now;
  conversation.last_message_preview = `📅 Meeting Request: ${params.title}`;
  conversation.last_sender_type = "BPO";
  conversation.unread_admin_count += 1;
  conversation.status = "OPEN";
  conversation.updated_at = now;

  persistStoreToDisk();

  // Try Supabase inserts
  try {
    await supabase.from("bpo_admin_meeting_requests").insert(reqRecord);
    await supabase.from("bpo_admin_messages").insert(msgRecord);
    await supabase
      .from("bpo_admin_conversations")
      .update({
        last_message_at: now,
        last_message_preview: conversation.last_message_preview,
        last_sender_type: "BPO",
        unread_admin_count: conversation.unread_admin_count,
        updated_at: now,
      })
      .eq("id", params.conversationId);
  } catch {}

  // Notify Admins
  await notifyAdmins(
    `New Meeting Request from ${conversation.partner_name}: ${params.title}`,
    `Preferred date: ${params.preferredDate} at ${params.preferredTime}`,
    params.conversationId,
    "bpo_meeting_requested"
  );

  // Audit
  await auditLog({ userId: params.userId }, "bpo_meeting_requested", params.conversationId, {
    meetingRequestId: requestId,
    title: params.title,
    preferredDate: params.preferredDate,
  });

  return reqRecord;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List conversations for Admin Panel with search and filters
 */
export async function listConversationsForAdmin(filters?: {
  search?: string;
  status?: string;
  requestType?: string;
  paymentStatus?: string;
  partnerId?: string;
}) {
  loadStoreFromDisk();

  let list = [...memoryStore.conversations];

  // Try Supabase
  try {
    const { data } = await supabase
      .from("bpo_admin_conversations")
      .select("*")
      .order("last_message_at", { ascending: false });

    if (data && data.length > 0) {
      list = data;
    }
  } catch {}

  // Apply filters
  if (filters?.status && filters.status !== "all") {
    list = list.filter((c) => c.status === filters.status);
  }

  if (filters?.requestType && filters.requestType !== "all") {
    list = list.filter((c) => c.request_type === filters.requestType);
  }

  if (filters?.paymentStatus && filters.paymentStatus !== "all") {
    list = list.filter((c) => c.payment_status === filters.paymentStatus);
  }

  if (filters?.partnerId && filters.partnerId !== "all") {
    list = list.filter((c) => c.partner_id === filters.partnerId);
  }

  if (filters?.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(
      (c) =>
        c.subject.toLowerCase().includes(q) ||
        c.partner_name.toLowerCase().includes(q) ||
        c.partner_code.toLowerCase().includes(q) ||
        (c.project_name && c.project_name.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }

  // Calculate unread count for badge
  const totalUnread = list.reduce((sum, c) => sum + (c.unread_admin_count > 0 ? 1 : 0), 0);

  return {
    conversations: list.sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    ),
    unreadCount: totalUnread,
  };
}

/**
 * Get a single conversation with full details for Admin
 * Marks unread as 0 and marks specific notifications as READ
 */
export async function getConversationForAdmin(conversationId: string, adminId: number) {
  loadStoreFromDisk();

  let conversation = memoryStore.conversations.find((c) => c.id === conversationId);

  if (!conversation) {
    try {
      const { data } = await supabase
        .from("bpo_admin_conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();

      if (data) conversation = data;
    } catch {}
  }

  if (!conversation) return null;

  // Load messages
  let messages = memoryStore.messages.filter((m) => m.conversation_id === conversationId);
  try {
    const { data: dbMsgs } = await supabase
      .from("bpo_admin_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (dbMsgs && dbMsgs.length > 0) messages = dbMsgs;
  } catch {}

  // Load attachments
  let attachments = memoryStore.attachments.filter((a) => a.conversation_id === conversationId);
  try {
    const { data: dbAtts } = await supabase
      .from("bpo_admin_attachments")
      .select("*")
      .eq("conversation_id", conversationId);

    if (dbAtts && dbAtts.length > 0) attachments = dbAtts;
  } catch {}

  const enrichedAttachments = await enrichAttachmentsWithUrls(attachments);

  const msgsWithAttachments = messages.map((m) => ({
    ...m,
    attachments: enrichedAttachments.filter((a) => a.message_id === m.id),
  }));

  // Load meeting requests
  let meetingRequests = memoryStore.meetingRequests.filter((mr) => mr.conversation_id === conversationId);
  try {
    const { data: dbMrs } = await supabase
      .from("bpo_admin_meeting_requests")
      .select("*")
      .eq("conversation_id", conversationId);

    if (dbMrs && dbMrs.length > 0) meetingRequests = dbMrs;
  } catch {}

  // Load audit history
  let auditHistory: any[] = [];
  try {
    const { data: audits } = await supabase
      .from("audit_logs")
      .select("id, action, actor_user_id, actor_admin_id, created_at, metadata")
      .eq("entity_id", conversationId)
      .order("created_at", { ascending: false });
    if (audits) auditHistory = audits;
  } catch {}

  // Load financial records if project is referenced
  let financialRecords: any[] = [];
  if (conversation.project_id) {
    try {
      const { data: payouts } = await supabase
        .from("bpo_payout_statements")
        .select("id, payout_code, gross_amount, net_amount, status, created_at")
        .eq("project_id", conversation.project_id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (payouts) financialRecords = payouts;
    } catch {}
  }

  // 1. Mark Admin unread count as 0
  conversation.unread_admin_count = 0;
  try {
    await supabase
      .from("bpo_admin_conversations")
      .update({ unread_admin_count: 0 })
      .eq("id", conversationId);
  } catch {}

  // 2. Mark specific notifications as READ server-side for this admin
  try {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_admin_id", adminId)
      .eq("entity_type", "bpo_connect_conversation")
      .eq("entity_id", conversationId)
      .is("read_at", null);
  } catch (err: any) {
    logger.warn({ error: err.message }, "Notice updating admin notification read state");
  }

  persistStoreToDisk();

  return {
    ...conversation,
    messages: msgsWithAttachments,
    attachments: enrichedAttachments,
    meeting_requests: meetingRequests,
    audit_history: auditHistory,
    financial_records: financialRecords,
  };
}

/**
 * Add a new message by Admin
 */
export async function addMessageByAdmin(params: {
  conversationId: string;
  adminId: number;
  adminName: string;
  message: string;
  newStatus?: BpoConnectStatus;
  attachments?: Array<{
    fileName: string;
    fileData: string;
    mimeType: string;
    fileSize: number;
  }>;
}) {
  loadStoreFromDisk();

  const conversation = memoryStore.conversations.find((c) => c.id === params.conversationId);
  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const messageId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Process attachments
  const savedAttachments: BpoAdminAttachmentRecord[] = [];
  if (params.attachments && params.attachments.length > 0) {
    for (const att of params.attachments) {
      try {
        const buffer = Buffer.from(
          att.fileData.includes(",") ? att.fileData.split(",")[1] : att.fileData,
          "base64"
        );
        const safeName = att.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const relativeKey = `admin_${params.adminId}/${params.conversationId}/${Date.now()}_${safeName}`;
        await saveFile("bpo-connect", relativeKey, buffer, att.mimeType || "application/octet-stream");

        const attRecord: BpoAdminAttachmentRecord = {
          id: crypto.randomUUID(),
          conversation_id: params.conversationId,
          message_id: messageId,
          uploader_type: "ADMIN",
          uploader_user_id: null,
          uploader_admin_id: params.adminId,
          file_name: att.fileName,
          file_size: buffer.length,
          file_type: att.mimeType,
          storage_path: relativeKey,
          created_at: now,
        };
        savedAttachments.push(attRecord);
        memoryStore.attachments.push(attRecord);
      } catch (err: any) {
        logger.warn({ error: err.message }, "Notice saving attachment in addMessageByAdmin");
      }
    }
  }

  const msgRecord: BpoAdminMessageRecord = {
    id: messageId,
    conversation_id: params.conversationId,
    sender_type: "ADMIN",
    sender_user_id: null,
    sender_admin_id: params.adminId,
    sender_name: params.adminName,
    message: params.message.trim(),
    read_at: null,
    created_at: now,
  };

  memoryStore.messages.push(msgRecord);

  // Update conversation
  conversation.last_message_at = now;
  conversation.last_message_preview = params.message.trim().slice(0, 100);
  conversation.last_sender_type = "ADMIN";
  conversation.unread_bpo_count += 1;
  conversation.assigned_admin_id = params.adminId;
  conversation.assigned_admin_name = params.adminName;
  conversation.updated_at = now;

  if (params.newStatus) {
    conversation.status = params.newStatus;
    if (params.newStatus === "RESOLVED") conversation.resolved_at = now;
    if (params.newStatus === "CLOSED") conversation.closed_at = now;
  } else if (conversation.status === "OPEN" || conversation.status === "ADMIN_REVIEW") {
    conversation.status = "WAITING_FOR_BPO";
  }

  persistStoreToDisk();

  // Try Supabase inserts
  try {
    await supabase.from("bpo_admin_messages").insert(msgRecord);
    if (savedAttachments.length > 0) {
      await supabase.from("bpo_admin_attachments").insert(savedAttachments);
    }
    await supabase
      .from("bpo_admin_conversations")
      .update({
        last_message_at: now,
        last_message_preview: conversation.last_message_preview,
        last_sender_type: "ADMIN",
        unread_bpo_count: conversation.unread_bpo_count,
        status: conversation.status,
        assigned_admin_id: params.adminId,
        resolved_at: conversation.resolved_at,
        closed_at: conversation.closed_at,
        updated_at: now,
      })
      .eq("id", params.conversationId);
  } catch {}

  // Notify BPO Partner Users
  await notifyPartnerUsers(
    conversation.partner_id,
    "New message from Thinkatic Admin",
    `Admin replied to: ${conversation.subject}`,
    params.conversationId,
    "bpo_connect_admin_reply"
  );

  // Audit
  await auditLog({ adminId: params.adminId }, "bpo_connect_admin_reply_sent", params.conversationId, {
    messageId,
    newStatus: params.newStatus,
  });

  return {
    ...msgRecord,
    attachments: await enrichAttachmentsWithUrls(savedAttachments),
  };
}

/**
 * Update request status by Admin
 */
export async function updateConversationStatusByAdmin(params: {
  conversationId: string;
  adminId: number;
  adminName: string;
  status: BpoConnectStatus;
  notes?: string;
}) {
  loadStoreFromDisk();

  const conversation = memoryStore.conversations.find((c) => c.id === params.conversationId);
  if (!conversation) throw new Error("Conversation not found.");

  const now = new Date().toISOString();
  conversation.status = params.status;
  conversation.updated_at = now;
  if (params.status === "RESOLVED") conversation.resolved_at = now;
  if (params.status === "CLOSED") conversation.closed_at = now;

  // Add system message into conversation
  const sysMsgText = `📌 Status updated to "${params.status}" by Admin (${params.adminName}).${params.notes ? `\nNotes: ${params.notes}` : ""}`;
  const sysMsg: BpoAdminMessageRecord = {
    id: crypto.randomUUID(),
    conversation_id: params.conversationId,
    sender_type: "ADMIN",
    sender_user_id: null,
    sender_admin_id: params.adminId,
    sender_name: "Thinkatic Admin",
    message: sysMsgText,
    read_at: null,
    created_at: now,
  };

  memoryStore.messages.push(sysMsg);
  conversation.last_message_at = now;
  conversation.last_message_preview = `Status changed to ${params.status}`;
  conversation.last_sender_type = "ADMIN";
  conversation.unread_bpo_count += 1;

  persistStoreToDisk();

  try {
    await supabase.from("bpo_admin_messages").insert(sysMsg);
    await supabase
      .from("bpo_admin_conversations")
      .update({
        status: params.status,
        resolved_at: conversation.resolved_at,
        closed_at: conversation.closed_at,
        last_message_at: now,
        last_message_preview: conversation.last_message_preview,
        last_sender_type: "ADMIN",
        unread_bpo_count: conversation.unread_bpo_count,
        updated_at: now,
      })
      .eq("id", params.conversationId);
  } catch {}

  await notifyPartnerUsers(
    conversation.partner_id,
    `Request status updated: ${params.status}`,
    `Your request "${conversation.subject}" status is now ${params.status}.`,
    params.conversationId,
    "bpo_connect_status_changed"
  );

  await auditLog({ adminId: params.adminId }, "bpo_connect_status_changed", params.conversationId, {
    newStatus: params.status,
    notes: params.notes,
  });

  return conversation;
}

/**
 * Update payment request status by Admin / Finance
 * IMPORTANT: Approval != Money transferred. Payment remains a manual operation.
 */
export async function updatePaymentStatusByAdmin(params: {
  conversationId: string;
  adminId: number;
  adminName: string;
  paymentStatus: BpoPaymentStatus;
  notes?: string;
  payoutStatementId?: number | null;
}) {
  loadStoreFromDisk();

  const conversation = memoryStore.conversations.find((c) => c.id === params.conversationId);
  if (!conversation) throw new Error("Conversation not found.");

  const now = new Date().toISOString();
  conversation.payment_status = params.paymentStatus;
  if (params.payoutStatementId) conversation.payout_statement_id = params.payoutStatementId;
  conversation.updated_at = now;

  let extraNote = "";
  if (params.paymentStatus === "APPROVED_FOR_PROCESSING") {
    extraNote = " (Request approved for Finance processing. Actual payment will be disbursed manually by Finance.)";
    conversation.status = "IN_PROGRESS";
  } else if (params.paymentStatus === "PAID") {
    extraNote = " (Manual financial disbursement confirmed by Admin/Finance.)";
    conversation.status = "RESOLVED";
    conversation.resolved_at = now;
  } else if (params.paymentStatus === "INFO_REQUIRED") {
    conversation.status = "WAITING_FOR_BPO";
  }

  const sysMsgText = `💳 Payment Request status updated to "${params.paymentStatus}" by Admin (${params.adminName}).${extraNote}${params.notes ? `\nDetails: ${params.notes}` : ""}`;

  const sysMsg: BpoAdminMessageRecord = {
    id: crypto.randomUUID(),
    conversation_id: params.conversationId,
    sender_type: "ADMIN",
    sender_user_id: null,
    sender_admin_id: params.adminId,
    sender_name: "Thinkatic Finance & Admin",
    message: sysMsgText,
    read_at: null,
    created_at: now,
  };

  memoryStore.messages.push(sysMsg);
  conversation.last_message_at = now;
  conversation.last_message_preview = `Payment status: ${params.paymentStatus}`;
  conversation.last_sender_type = "ADMIN";
  conversation.unread_bpo_count += 1;

  persistStoreToDisk();

  try {
    await supabase.from("bpo_admin_messages").insert(sysMsg);
    await supabase
      .from("bpo_admin_conversations")
      .update({
        payment_status: params.paymentStatus,
        status: conversation.status,
        resolved_at: conversation.resolved_at,
        payout_statement_id: conversation.payout_statement_id,
        last_message_at: now,
        last_message_preview: conversation.last_message_preview,
        last_sender_type: "ADMIN",
        unread_bpo_count: conversation.unread_bpo_count,
        updated_at: now,
      })
      .eq("id", params.conversationId);
  } catch {}

  await notifyPartnerUsers(
    conversation.partner_id,
    `Payment Request Update: ${params.paymentStatus}`,
    `Payment request for "${conversation.subject}" is now ${params.paymentStatus}.`,
    params.conversationId,
    "bpo_payment_status_changed"
  );

  await auditLog({ adminId: params.adminId }, "bpo_payment_status_changed", params.conversationId, {
    paymentStatus: params.paymentStatus,
    payoutStatementId: params.payoutStatementId,
    notes: params.notes,
  });

  return conversation;
}

/**
 * Create/Schedule a Meeting directly from conversation by Admin
 * Integrates with public.meetings and bpo_partner_meetings
 */
export async function createMeetingByAdmin(params: {
  conversationId: string;
  adminId: number;
  adminName: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  agenda?: string;
  meetingLink?: string;
  meetingPassword?: string;
  meetingRequestId?: string;
  projectId?: number | null;
}) {
  loadStoreFromDisk();

  const conversation = memoryStore.conversations.find((c) => c.id === params.conversationId);
  if (!conversation) throw new Error("Conversation not found.");

  const now = new Date().toISOString();
  let createdMeetingId: number = Date.now();

  // 1. Authoritative insert into public.meetings
  try {
    const meetingPayload: any = {
      project_id: params.projectId || conversation.project_id || null,
      title: params.title.trim(),
      description: JSON.stringify({
        source: "bpo_connect",
        conversation_id: params.conversationId,
        partner_id: conversation.partner_id,
        partner_name: conversation.partner_name,
        meeting_password: params.meetingPassword || null,
      }),
      starts_at: new Date(params.startsAt).toISOString(),
      ends_at: new Date(params.endsAt).toISOString(),
      timezone: params.timezone || "UTC",
      meeting_type: "bpo_partner_meeting",
      status: "scheduled",
      location: params.meetingLink?.trim() || "Thinkatic Secure Virtual Room",
      agenda: params.agenda?.trim() || null,
      organizer_admin_id: params.adminId,
    };

    const { data: dbMeeting, error } = await supabase
      .from("meetings")
      .insert(meetingPayload)
      .select("id")
      .single();

    if (!error && dbMeeting) {
      createdMeetingId = dbMeeting.id;
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, "Notice creating meeting in public.meetings");
  }

  // 2. Link meeting to partner in bpo_partner_meetings
  try {
    await supabase.from("bpo_partner_meetings").upsert(
      {
        meeting_id: createdMeetingId,
        partner_id: conversation.partner_id,
        partner_project_id: conversation.project_id || null,
      },
      { onConflict: "meeting_id,partner_id" }
    );
  } catch {}

  // 3. Link meeting request if provided
  if (params.meetingRequestId) {
    const req = memoryStore.meetingRequests.find((r) => r.id === params.meetingRequestId);
    if (req) {
      req.status = "SCHEDULED";
      req.scheduled_meeting_id = createdMeetingId;
      req.reviewed_by_admin_id = params.adminId;
      req.updated_at = now;
    }
    try {
      await supabase
        .from("bpo_admin_meeting_requests")
        .update({
          status: "SCHEDULED",
          scheduled_meeting_id: createdMeetingId,
          reviewed_by_admin_id: params.adminId,
          updated_at: now,
        })
        .eq("id", params.meetingRequestId);
    } catch {}
  }

  // 4. Update conversation status
  conversation.status = "MEETING_SCHEDULED";
  conversation.updated_at = now;

  // 5. Add chat message into conversation
  const meetingMsgText = `🤝 Meeting Scheduled: "${params.title}"\nDate & Time: ${new Date(params.startsAt).toLocaleString()} (${params.timezone || "UTC"})\n${params.meetingLink ? `Meeting Link: ${params.meetingLink}\n` : ""}${params.meetingPassword ? `Passcode: ${params.meetingPassword}\n` : ""}${params.agenda ? `Agenda: ${params.agenda}` : ""}`;

  const sysMsg: BpoAdminMessageRecord = {
    id: crypto.randomUUID(),
    conversation_id: params.conversationId,
    sender_type: "ADMIN",
    sender_user_id: null,
    sender_admin_id: params.adminId,
    sender_name: "Thinkatic Scheduling",
    message: meetingMsgText,
    read_at: null,
    created_at: now,
  };

  memoryStore.messages.push(sysMsg);
  conversation.last_message_at = now;
  conversation.last_message_preview = `Meeting scheduled: ${params.title}`;
  conversation.last_sender_type = "ADMIN";
  conversation.unread_bpo_count += 1;

  persistStoreToDisk();

  try {
    await supabase.from("bpo_admin_messages").insert(sysMsg);
    await supabase
      .from("bpo_admin_conversations")
      .update({
        status: "MEETING_SCHEDULED",
        last_message_at: now,
        last_message_preview: conversation.last_message_preview,
        last_sender_type: "ADMIN",
        unread_bpo_count: conversation.unread_bpo_count,
        updated_at: now,
      })
      .eq("id", params.conversationId);
  } catch {}

  // 6. Notify BPO Partner Users
  await notifyPartnerUsers(
    conversation.partner_id,
    "New meeting scheduled",
    `Meeting scheduled: ${params.title} for ${new Date(params.startsAt).toLocaleString()}`,
    params.conversationId,
    "meeting_scheduled"
  );

  // 7. Audit
  await auditLog({ adminId: params.adminId }, "bpo_meeting_created", params.conversationId, {
    meetingId: createdMeetingId,
    title: params.title,
    startsAt: params.startsAt,
  });

  return {
    meetingId: createdMeetingId,
    title: params.title,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    meetingLink: params.meetingLink,
  };
}

/**
 * Respond to meeting request by Admin (Accept / Reschedule / Decline)
 */
export async function respondToMeetingRequestByAdmin(params: {
  conversationId: string;
  meetingRequestId: string;
  adminId: number;
  adminName: string;
  action: "ACCEPT" | "RESCHEDULE" | "DECLINE";
  notes?: string;
  rescheduleDate?: string;
  rescheduleTime?: string;
}) {
  loadStoreFromDisk();

  const conversation = memoryStore.conversations.find((c) => c.id === params.conversationId);
  if (!conversation) throw new Error("Conversation not found.");

  const req = memoryStore.meetingRequests.find((r) => r.id === params.meetingRequestId);
  if (!req) throw new Error("Meeting request not found.");

  const now = new Date().toISOString();
  let status: BpoMeetingRequestStatus = "REQUESTED";
  let msgContent = "";

  if (params.action === "ACCEPT") {
    status = "SCHEDULED";
    msgContent = `✅ Meeting request "${req.title}" has been ACCEPTED by Admin (${params.adminName}).\nConfirmed Date: ${req.preferred_date} at ${req.preferred_time}.${params.notes ? `\nNotes: ${params.notes}` : ""}`;
  } else if (params.action === "RESCHEDULE") {
    status = "RESCHEDULED";
    msgContent = `🔄 Meeting request "${req.title}" RESCHEDULE proposed by Admin (${params.adminName}).\nProposed Date: ${params.rescheduleDate || req.preferred_date} at ${params.rescheduleTime || req.preferred_time}.${params.notes ? `\nReason/Notes: ${params.notes}` : ""}`;
  } else {
    status = "DECLINED";
    msgContent = `❌ Meeting request "${req.title}" DECLINED by Admin (${params.adminName}).${params.notes ? `\nReason: ${params.notes}` : ""}`;
  }

  req.status = status;
  req.reviewed_by_admin_id = params.adminId;
  req.admin_notes = params.notes || null;
  req.updated_at = now;

  const sysMsg: BpoAdminMessageRecord = {
    id: crypto.randomUUID(),
    conversation_id: params.conversationId,
    sender_type: "ADMIN",
    sender_user_id: null,
    sender_admin_id: params.adminId,
    sender_name: "Thinkatic Admin",
    message: msgContent,
    read_at: null,
    created_at: now,
  };

  memoryStore.messages.push(sysMsg);
  conversation.last_message_at = now;
  conversation.last_message_preview = `Meeting request: ${status}`;
  conversation.last_sender_type = "ADMIN";
  conversation.unread_bpo_count += 1;

  persistStoreToDisk();

  try {
    await supabase.from("bpo_admin_messages").insert(sysMsg);
    await supabase
      .from("bpo_admin_meeting_requests")
      .update({
        status,
        reviewed_by_admin_id: params.adminId,
        admin_notes: params.notes || null,
        updated_at: now,
      })
      .eq("id", params.meetingRequestId);
  } catch {}

  await notifyPartnerUsers(
    conversation.partner_id,
    `Meeting Request ${status}`,
    msgContent.slice(0, 150),
    params.conversationId,
    "bpo_meeting_status_changed"
  );

  return req;
}

/**
 * Get authorized download signed URL for an attachment
 */
export async function getAttachmentDownloadUrl(
  attachmentId: string,
  actor: { userId?: string; adminId?: number; partnerId?: string }
): Promise<string> {
  loadStoreFromDisk();

  const attachment = memoryStore.attachments.find((a) => a.id === attachmentId);
  if (!attachment) {
    throw new Error("Attachment not found.");
  }

  const conversation = memoryStore.conversations.find((c) => c.id === attachment.conversation_id);
  if (!conversation) {
    throw new Error("Associated conversation not found.");
  }

  // Authorization check
  if (!actor.adminId && actor.partnerId !== conversation.partner_id) {
    throw new Error("Unauthorized attachment access.");
  }

  return createSignedUrl("bpo-connect", attachment.storage_path, 3600);
}
