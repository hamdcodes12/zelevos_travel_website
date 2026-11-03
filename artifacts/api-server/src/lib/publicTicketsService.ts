import fs from "fs";
import path from "path";
import crypto from "crypto";
import { supabase } from "@workspace/db";
import { logger } from "./logger.js";
import nodemailer from "nodemailer";

export type PublicTicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

export type PublicTicketPriority = "low" | "medium" | "high" | "urgent";

export const REQUEST_TYPES = [
  "General Enquiry",
  "Technical Issue",
  "Service Question",
  "Project Question",
  "Billing Question",
  "BPO Partnership",
  "Other",
] as const;

export type PublicTicketRequestType = (typeof REQUEST_TYPES)[number];

export interface PublicTicket {
  id: string;
  ticketNumber: string;
  fullName: string;
  email: string;
  companyName: string | null;
  phone: string | null;
  requestType: PublicTicketRequestType;
  subject: string;
  message: string;
  status: PublicTicketStatus;
  priority: PublicTicketPriority;
  assignedAdminId: number | null;
  assignedAdminName: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  attachmentContentType: string | null;
  attachmentData: string | null; // base64 representation if provided
  createdAt: string;
  updatedAt: string;
}

export interface PublicTicketMessage {
  id: string;
  ticketId: string;
  senderType: "customer" | "admin";
  senderName: string;
  senderEmail: string | null;
  message: string;
  createdAt: string;
}

export interface PublicTicketInternalNote {
  id: string;
  ticketId: string;
  adminId: number;
  adminName: string;
  note: string;
  createdAt: string;
}

export interface PublicTicketAuditLog {
  id: string;
  ticketId: string;
  actorType: "system" | "public" | "admin";
  actorId: string | null;
  actorName: string | null;
  action: string;
  details: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

interface PublicTicketStoreData {
  lastSequence: number;
  tickets: PublicTicket[];
  messages: PublicTicketMessage[];
  internalNotes: PublicTicketInternalNote[];
  auditLogs: PublicTicketAuditLog[];
}

const STORE_DIR = path.resolve(process.cwd(), "data", "storage", "public_tickets");
const STORE_PATH = path.join(STORE_DIR, "public_tickets_store.json");

// In-memory rate limiting map: ip -> [timestamp1, timestamp2, ...]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 10; // max 10 submissions per 10 mins per IP

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

function ensureStore(): PublicTicketStoreData {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_PATH)) {
    const initial: PublicTicketStoreData = {
      lastSequence: 0,
      tickets: [],
      messages: [],
      internalNotes: [],
      auditLogs: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }

  try {
    const content = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(content) as PublicTicketStoreData;
  } catch (error) {
    logger.error({ error }, "Error reading public tickets store, restoring empty store");
    const initial: PublicTicketStoreData = {
      lastSequence: 0,
      tickets: [],
      messages: [],
      internalNotes: [],
      auditLogs: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
}

function saveStore(data: PublicTicketStoreData): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
  const tempPath = `${STORE_PATH}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tempPath, STORE_PATH);
}

function sanitizeText(str: string): string {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Generate formatted sequential ticket ID: THK-TKT-000001
 */
function generateTicketId(sequence: number): string {
  return `THK-TKT-${String(sequence).padStart(6, "0")}`;
}

export class PublicTicketsService {
  /**
   * Create a new public ticket
   */
  static async createTicket(input: {
    fullName: string;
    email: string;
    companyName?: string | null;
    phone?: string | null;
    requestType: string;
    subject: string;
    message: string;
    attachment?: {
      name: string;
      size: number;
      contentType: string;
      data: string;
    } | null;
    clientIp?: string;
  }): Promise<{ ticket: PublicTicket; ticketNumber: string }> {
    // 1. Validation
    const fullName = sanitizeText(input.fullName || "");
    const email = (input.email || "").trim().toLowerCase();
    const companyName = input.companyName ? sanitizeText(input.companyName) : null;
    const phone = input.phone ? sanitizeText(input.phone) : null;
    const requestType = input.requestType as PublicTicketRequestType;
    const subject = sanitizeText(input.subject || "");
    const message = sanitizeText(input.message || "");

    if (!fullName || fullName.length < 2 || fullName.length > 100) {
      throw new Error("Full Name must be between 2 and 100 characters");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || email.length > 150) {
      throw new Error("A valid email address is required");
    }

    if (!REQUEST_TYPES.includes(requestType)) {
      throw new Error(`Invalid request type. Must be one of: ${REQUEST_TYPES.join(", ")}`);
    }

    if (!subject || subject.length < 3 || subject.length > 200) {
      throw new Error("Subject must be between 3 and 200 characters");
    }

    if (!message || message.length < 10 || message.length > 5000) {
      throw new Error("Message must be between 10 and 5,000 characters");
    }

    // 2. Validate Attachment if provided
    let attachmentName: string | null = null;
    let attachmentSize: number | null = null;
    let attachmentContentType: string | null = null;
    let attachmentData: string | null = null;

    if (input.attachment) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "application/pdf",
        "text/plain",
        "application/zip",
      ];
      if (!allowedTypes.includes(input.attachment.contentType)) {
        throw new Error("Attachments must be PDF, PNG, JPEG, TXT, or ZIP files");
      }
      if (input.attachment.size > 10 * 1024 * 1024) {
        throw new Error("Attachment size cannot exceed 10 MB");
      }
      attachmentName = sanitizeText(input.attachment.name).slice(0, 150);
      attachmentSize = input.attachment.size;
      attachmentContentType = input.attachment.contentType;
      attachmentData = input.attachment.data;
    }

    // 3. Atomically assign sequence and create ticket
    const store = ensureStore();
    store.lastSequence += 1;
    const ticketNumber = generateTicketId(store.lastSequence);
    const ticketId = crypto.randomUUID();
    const now = new Date().toISOString();

    const ticket: PublicTicket = {
      id: ticketId,
      ticketNumber,
      fullName,
      email,
      companyName,
      phone,
      requestType,
      subject,
      message,
      status: "NEW",
      priority: "medium",
      assignedAdminId: null,
      assignedAdminName: null,
      attachmentName,
      attachmentSize,
      attachmentContentType,
      attachmentData,
      createdAt: now,
      updatedAt: now,
    };

    // Customer first message
    const initialMessage: PublicTicketMessage = {
      id: crypto.randomUUID(),
      ticketId,
      senderType: "customer",
      senderName: fullName,
      senderEmail: email,
      message,
      createdAt: now,
    };

    // Audit log
    const auditLog: PublicTicketAuditLog = {
      id: crypto.randomUUID(),
      ticketId,
      actorType: "public",
      actorId: null,
      actorName: fullName,
      action: "TICKET_CREATED",
      details: `Public support ticket created: ${ticketNumber} (${requestType})`,
      oldValue: null,
      newValue: "NEW",
      createdAt: now,
    };

    store.tickets.unshift(ticket);
    store.messages.push(initialMessage);
    store.auditLogs.unshift(auditLog);
    saveStore(store);

    // 4. Trigger Admin Notifications in Supabase
    try {
      const { data: admins } = await supabase.from("admin_users").select("id, email, username");
      if (admins && admins.length > 0) {
        const notifications = admins.map((admin: any) => ({
          recipient_admin_id: admin.id,
          type: "public_ticket",
          title: "New Public Ticket",
          body: `New public support request received: ${ticketNumber} from ${fullName} (${requestType})`,
          entity_type: "public_ticket",
          entity_id: ticketNumber,
        }));
        await supabase.from("notifications").insert(notifications);
      }
    } catch (err: any) {
      logger.warn({ error: err?.message }, "Non-fatal: could not create Supabase admin notification");
    }

    // 5. Trigger Supabase Audit Log
    try {
      await supabase.from("audit_logs").insert({
        action: "public_ticket_created",
        entity_type: "public_ticket",
        entity_id: ticketNumber,
        metadata: {
          ticketId,
          ticketNumber,
          requestType,
          email,
          fullName,
        },
      });
    } catch (err: any) {
      logger.warn({ error: err?.message }, "Non-fatal: could not create Supabase audit log");
    }

    // 6. Optional Email Notification (if SMTP configured)
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const port = parseInt(process.env.SMTP_PORT || "587", 10);
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port,
          secure: process.env.SMTP_SECURE === "true" || port === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const notifyEmail = process.env.ADMIN_NOTIFY_EMAIL || "Thinkaticai@gmail.com";
        await transporter.sendMail({
          from: `"Thinkatic Support" <${process.env.SMTP_USER}>`,
          to: notifyEmail,
          subject: `[New Ticket] ${ticketNumber}: ${subject}`,
          text: `A new public support request has been received.\n\nTicket: ${ticketNumber}\nRequester: ${fullName} (${email})\nCompany: ${companyName || "N/A"}\nRequest Type: ${requestType}\nSubject: ${subject}\n\nMessage:\n${message}\n\nLog in to Admin Control Centre to review and respond: /admin/control-centre`,
        });
      }
    } catch (emailErr: any) {
      logger.warn({ error: emailErr?.message }, "Non-fatal: email dispatch skipped or failed");
    }

    return { ticket, ticketNumber };
  }

  /**
   * Get stats for Admin Dashboard KPI cards
   */
  static getStats(): {
    newCount: number;
    openCount: number;
    inProgressCount: number;
    waitingCount: number;
    resolvedCount: number;
    closedCount: number;
    totalCount: number;
  } {
    const store = ensureStore();
    const tickets = store.tickets;

    let newCount = 0;
    let openCount = 0;
    let inProgressCount = 0;
    let waitingCount = 0;
    let resolvedCount = 0;
    let closedCount = 0;

    for (const t of tickets) {
      switch (t.status) {
        case "NEW":
          newCount++;
          break;
        case "OPEN":
          openCount++;
          break;
        case "IN_PROGRESS":
          inProgressCount++;
          break;
        case "WAITING_FOR_CUSTOMER":
          waitingCount++;
          break;
        case "RESOLVED":
          resolvedCount++;
          break;
        case "CLOSED":
          closedCount++;
          break;
      }
    }

    return {
      newCount,
      openCount,
      inProgressCount,
      waitingCount,
      resolvedCount,
      closedCount,
      totalCount: tickets.length,
    };
  }

  /**
   * List tickets with filtering, search, and pagination (Admin only)
   */
  static listTickets(params: {
    status?: string;
    requestType?: string;
    priority?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): {
    tickets: PublicTicket[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } {
    const store = ensureStore();
    let result = [...store.tickets];

    // Filter by status
    if (params.status && params.status !== "ALL") {
      result = result.filter((t) => t.status === params.status);
    }

    // Filter by request type
    if (params.requestType && params.requestType !== "ALL") {
      result = result.filter((t) => t.requestType === params.requestType);
    }

    // Filter by priority
    if (params.priority && params.priority !== "ALL") {
      result = result.filter((t) => t.priority === params.priority);
    }

    // Filter by search query (Ticket ID, Name, Email, Company, Subject)
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.ticketNumber.toLowerCase().includes(q) ||
          t.fullName.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          (t.companyName && t.companyName.toLowerCase().includes(q)) ||
          t.subject.toLowerCase().includes(q)
      );
    }

    // Date range filtering
    if (params.startDate) {
      const start = new Date(params.startDate).getTime();
      result = result.filter((t) => new Date(t.createdAt).getTime() >= start);
    }
    if (params.endDate) {
      const end = new Date(params.endDate).getTime();
      result = result.filter((t) => new Date(t.createdAt).getTime() <= end);
    }

    const total = result.length;
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (page - 1) * pageSize;

    const paginated = result.slice(offset, offset + pageSize);

    return {
      tickets: paginated,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get single ticket detail with messages, internal notes, and audit history (Admin only)
   */
  static getTicketDetail(idOrNumber: string): {
    ticket: PublicTicket;
    messages: PublicTicketMessage[];
    internalNotes: PublicTicketInternalNote[];
    auditLogs: PublicTicketAuditLog[];
  } | null {
    const store = ensureStore();
    const ticket = store.tickets.find(
      (t) => t.id === idOrNumber || t.ticketNumber === idOrNumber
    );

    if (!ticket) return null;

    const messages = store.messages
      .filter((m) => m.ticketId === ticket.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const internalNotes = store.internalNotes
      .filter((n) => n.ticketId === ticket.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const auditLogs = store.auditLogs
      .filter((a) => a.ticketId === ticket.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      ticket,
      messages,
      internalNotes,
      auditLogs,
    };
  }

  /**
   * Add Admin reply to ticket
   */
  static addAdminReply(
    ticketId: string,
    admin: { id: number; username: string },
    replyText: string
  ): { message: PublicTicketMessage; ticket: PublicTicket } {
    const cleanReply = sanitizeText(replyText);
    if (!cleanReply || cleanReply.length < 2) {
      throw new Error("Reply message cannot be empty");
    }

    const store = ensureStore();
    const ticket = store.tickets.find((t) => t.id === ticketId || t.ticketNumber === ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const now = new Date().toISOString();
    const msg: PublicTicketMessage = {
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      senderType: "admin",
      senderName: admin.username || "Thinkatic Support",
      senderEmail: null,
      message: cleanReply,
      createdAt: now,
    };

    // If status was NEW or WAITING_FOR_CUSTOMER, update to IN_PROGRESS or WAITING_FOR_CUSTOMER
    const oldStatus = ticket.status;
    if (ticket.status === "NEW") {
      ticket.status = "IN_PROGRESS";
    }
    ticket.updatedAt = now;

    // Audit log
    const audit: PublicTicketAuditLog = {
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      actorType: "admin",
      actorId: String(admin.id),
      actorName: admin.username,
      action: "ADMIN_REPLY",
      details: `Admin replied: "${cleanReply.slice(0, 80)}${cleanReply.length > 80 ? "..." : ""}"`,
      oldValue: oldStatus,
      newValue: ticket.status,
      createdAt: now,
    };

    store.messages.push(msg);
    store.auditLogs.unshift(audit);
    saveStore(store);

    return { message: msg, ticket };
  }

  /**
   * Add Admin internal note (Admin only, never shown to customer)
   */
  static addInternalNote(
    ticketId: string,
    admin: { id: number; username: string },
    noteText: string
  ): { note: PublicTicketInternalNote; ticket: PublicTicket } {
    const cleanNote = sanitizeText(noteText);
    if (!cleanNote || cleanNote.length < 2) {
      throw new Error("Internal note cannot be empty");
    }

    const store = ensureStore();
    const ticket = store.tickets.find((t) => t.id === ticketId || t.ticketNumber === ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const now = new Date().toISOString();
    const note: PublicTicketInternalNote = {
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      adminId: admin.id,
      adminName: admin.username || "Thinkatic Admin",
      note: cleanNote,
      createdAt: now,
    };

    ticket.updatedAt = now;

    const audit: PublicTicketAuditLog = {
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      actorType: "admin",
      actorId: String(admin.id),
      actorName: admin.username,
      action: "INTERNAL_NOTE_ADDED",
      details: `Internal note added by ${admin.username}`,
      oldValue: null,
      newValue: null,
      createdAt: now,
    };

    store.internalNotes.push(note);
    store.auditLogs.unshift(audit);
    saveStore(store);

    return { note, ticket };
  }

  /**
   * Update ticket status, priority, or assigned admin (Audited)
   */
  static updateTicket(
    ticketId: string,
    admin: { id: number; username: string },
    updates: {
      status?: PublicTicketStatus;
      priority?: PublicTicketPriority;
      assignedAdminId?: number | null;
      assignedAdminName?: string | null;
    }
  ): PublicTicket {
    const store = ensureStore();
    const ticket = store.tickets.find((t) => t.id === ticketId || t.ticketNumber === ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const now = new Date().toISOString();

    if (updates.status && updates.status !== ticket.status) {
      const validStatuses: PublicTicketStatus[] = [
        "NEW",
        "OPEN",
        "IN_PROGRESS",
        "WAITING_FOR_CUSTOMER",
        "RESOLVED",
        "CLOSED",
      ];
      if (!validStatuses.includes(updates.status)) {
        throw new Error(`Invalid status: ${updates.status}`);
      }

      const audit: PublicTicketAuditLog = {
        id: crypto.randomUUID(),
        ticketId: ticket.id,
        actorType: "admin",
        actorId: String(admin.id),
        actorName: admin.username,
        action: "STATUS_CHANGED",
        details: `Status changed from ${ticket.status} to ${updates.status}`,
        oldValue: ticket.status,
        newValue: updates.status,
        createdAt: now,
      };
      store.auditLogs.unshift(audit);
      ticket.status = updates.status;
    }

    if (updates.priority && updates.priority !== ticket.priority) {
      const validPriorities: PublicTicketPriority[] = ["low", "medium", "high", "urgent"];
      if (!validPriorities.includes(updates.priority)) {
        throw new Error(`Invalid priority: ${updates.priority}`);
      }

      const audit: PublicTicketAuditLog = {
        id: crypto.randomUUID(),
        ticketId: ticket.id,
        actorType: "admin",
        actorId: String(admin.id),
        actorName: admin.username,
        action: "PRIORITY_CHANGED",
        details: `Priority changed from ${ticket.priority} to ${updates.priority}`,
        oldValue: ticket.priority,
        newValue: updates.priority,
        createdAt: now,
      };
      store.auditLogs.unshift(audit);
      ticket.priority = updates.priority;
    }

    if (updates.assignedAdminId !== undefined) {
      const oldAssigned = ticket.assignedAdminName || "Unassigned";
      const newAssigned = updates.assignedAdminName || "Unassigned";
      ticket.assignedAdminId = updates.assignedAdminId;
      ticket.assignedAdminName = updates.assignedAdminName ?? null;

      const audit: PublicTicketAuditLog = {
        id: crypto.randomUUID(),
        ticketId: ticket.id,
        actorType: "admin",
        actorId: String(admin.id),
        actorName: admin.username,
        action: "ASSIGNED_CHANGED",
        details: `Assignment changed from ${oldAssigned} to ${newAssigned}`,
        oldValue: oldAssigned,
        newValue: newAssigned,
        createdAt: now,
      };
      store.auditLogs.unshift(audit);
    }

    ticket.updatedAt = now;
    saveStore(store);
    return ticket;
  }
}
