import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { supabase } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { requireUserAuth } from "./user.js";
import {
  encryptMeetingPassword,
  decryptMeetingPassword,
  validateMeetingUrl,
} from "../lib/meetingCrypto.js";

const router: IRouter = Router();

const STATUSES = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "rescheduled", "no_show", "archived"];
const TYPES = [
  "project_meeting",
  "client_meeting",
  "bpo_partner_meeting",
  "operations_meeting",
  "training",
  "review",
  "general_meeting",
  "requirement_discussion",
  "demo",
  "uat",
  "planning",
  "support",
  "other",
];
const RSVP = ["pending", "accepted", "declined", "tentative"];
const NOTE_TYPES = ["summary", "discussion", "decision", "next_steps"];
const ACTION_STATUSES = ["open", "in_progress", "completed", "cancelled"];
const PRIORITIES = ["low", "medium", "high", "critical"];

type UserRequest = Request & { user?: { id: string; email: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

function fail(res: Response, status: number, message: string, details?: any): void {
  res.status(status).json({ success: false, error: message, message, details });
}

function id(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function iso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function validTimezone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

async function moduleGuard(_req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase.from("module_settings").select("enabled").eq("module_key", "meetings").maybeSingle();
    if (error) {
      if (process.env.NODE_ENV !== "production") return next();
      return res.status(500).json({ error: "Unable to verify meetings module" });
    }
    if (data?.enabled === false) return fail(res, 503, "meetings is currently disabled");
    return next();
  } catch {
    if (process.env.NODE_ENV !== "production") return next();
    return res.status(500).json({ error: "Unable to verify meetings module" });
  }
}

async function audit(actor: { userId?: string; adminId?: number }, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  try {
    await supabase.from("audit_logs").insert({
      actor_user_id: actor.userId ?? null,
      actor_admin_id: actor.adminId ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  } catch {}
}

async function notifyUser(userId: string, type: string, title: string, body: string, entityId: string) {
  try {
    await supabase.from("notifications").insert({
      recipient_user_id: userId,
      type,
      title,
      body,
      entity_type: "meeting",
      entity_id: entityId,
    });
  } catch {}
}

async function notifyAdmins(type: string, title: string, body: string, entityId: string) {
  try {
    const { data } = await supabase.from("admin_users").select("id");
    if (data?.length) {
      await supabase.from("notifications").insert(
        data.map((admin: any) => ({
          recipient_admin_id: admin.id,
          type,
          title,
          body,
          entity_type: "meeting",
          entity_id: entityId,
        }))
      );
    }
  } catch {}
}

async function notifyPartnerUsers(partnerId: string, type: string, title: string, body: string, entityId: string) {
  try {
    const { data: memberships } = await supabase
      .from("bpo_partner_users")
      .select("user_id")
      .eq("partner_id", partnerId)
      .eq("status", "active");
    if (memberships?.length) {
      await supabase.from("notifications").insert(
        memberships.map((membership: any) => ({
          recipient_user_id: membership.user_id,
          type,
          title,
          body,
          entity_type: "meeting",
          entity_id: entityId,
        }))
      );
    }
  } catch {}
}

/**
 * Helper to resolve partner details for an authenticated user.
 */
async function resolvePartnerForUser(userId: string) {
  try {
    // 1. Direct active membership in bpo_partner_users
    const { data: member } = await supabase
      .from("bpo_partner_users")
      .select("id, partner_id, role, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (member?.partner_id) {
      const { data: partner } = await supabase
        .from("bpo_partners")
        .select("id, name, partner_code, status")
        .eq("id", member.partner_id)
        .maybeSingle();
      return {
        partnerId: member.partner_id,
        partnerUserId: member.id,
        role: member.role,
        partner: partner || { id: member.partner_id, name: "BPO Partner", partner_code: "BPO-ACTIVE", status: "active" },
      };
    }

    // 2. Check profile role
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, account_type, email, bpo_status")
      .eq("id", userId)
      .maybeSingle();

    if (profile && (profile.account_type === "BPO" || ["partner", "bpo_partner"].includes(profile.role))) {
      if (profile.email) {
        const { data: partnerByEmail } = await supabase
          .from("bpo_partners")
          .select("id, name, partner_code, status")
          .eq("email", profile.email)
          .maybeSingle();
        if (partnerByEmail) {
          return {
            partnerId: partnerByEmail.id,
            partnerUserId: 1,
            role: "partner_admin",
            partner: partnerByEmail,
          };
        }
      }

      // Check partner applications
      const { data: app } = await supabase
        .from("bpo_partner_applications")
        .select("id, company_name, centre_id")
        .eq("user_id", userId)
        .maybeSingle();

      const fallbackPartnerId = userId.startsWith("usr_") ? `partner_${userId}` : userId;
      return {
        partnerId: fallbackPartnerId,
        partnerUserId: 1,
        role: "partner_admin",
        partner: {
          id: fallbackPartnerId,
          name: app?.company_name || "Authorized BPO Partner",
          partner_code: "BPO-PARTNER",
          status: "active",
        },
      };
    }

    // 3. Direct check if userId is a valid bpo_partners.id
    const { data: directPartner } = await supabase
      .from("bpo_partners")
      .select("id, name, partner_code, status")
      .eq("id", userId)
      .maybeSingle();

    if (directPartner) {
      return {
        partnerId: directPartner.id,
        partnerUserId: 1,
        role: "partner_admin",
        partner: directPartner,
      };
    }
  } catch {}

  return null;
}

function toDbMeetingType(type: string): string {
  const legacyAllowed = ["project_meeting", "requirement_discussion", "review", "demo", "uat", "planning", "support", "other"];
  if (legacyAllowed.includes(type)) return type;
  if (type === "client_meeting") return "project_meeting";
  if (type === "bpo_partner_meeting") return "other";
  if (type === "operations_meeting") return "planning";
  if (type === "training") return "other";
  if (type === "general_meeting") return "other";
  return "other";
}

/**
 * Parses and decodes meeting metadata safely.
 */
function parseMeetingMetadata(meeting: any): Record<string, any> {
  let meta: Record<string, any> = {};
  if (meeting.description && typeof meeting.description === "string") {
    try {
      if (meeting.description.trim().startsWith("{") && meeting.description.trim().endsWith("}")) {
        meta = JSON.parse(meeting.description);
      }
    } catch {}
  }

  const meetingLink = meeting.meeting_link || meta.meetingLink || meeting.location || "";
  const passwordEncrypted = meeting.meeting_password_encrypted || meta.passwordEncrypted || "";
  const hasPassword = Boolean(passwordEncrypted);
  const audienceType = meeting.audience_type || meta.audienceType || "client";
  const meetingType = meta.meetingType || meeting.meeting_type || "project_meeting";
  const notes = meeting.notes || meta.notes || "";
  const scope = meta.scope || (meeting.project_id ? "project" : "general");
  const targetClientIds: string[] = meta.targetClientIds || (meeting.client_id ? [meeting.client_id] : []);
  const targetPartnerIds: string[] = meta.targetPartnerIds || [];

  return {
    ...meta,
    meetingLink,
    passwordEncrypted,
    hasPassword,
    audienceType,
    meetingType,
    notes,
    scope,
    targetClientIds,
    targetPartnerIds,
    bpoPartnerId: meta.bpoPartnerId || null,
    bpoPartnerName: meta.bpoPartnerName || null,
    centreId: meta.centreId || null,
    projectId: meta.projectId || null,
    additionalInfo: meta.additionalInfo || "",
  };
}

async function projectById(projectId: number) {
  const { data, error } = await supabase.from("projects").select("id,client_id,name").eq("id", projectId).maybeSingle();
  if (error) throw error;
  return data;
}

async function createReminders(meeting: any) {
  try {
    const offsets = [1440, 60, 15];
    await supabase.from("meeting_reminders").upsert(
      offsets.map((minutes_before) => ({
        meeting_id: meeting.id,
        minutes_before,
        sent_at: null,
        notify_at: new Date(new Date(meeting.starts_at).getTime() - minutes_before * 60000).toISOString(),
      })),
      { onConflict: "meeting_id,minutes_before" }
    );
  } catch {}
}

async function dispatchDueReminders() {
  try {
    const now = new Date().toISOString();
    const { data: claimed } = await supabase
      .from("meeting_reminders")
      .update({ sent_at: now })
      .is("sent_at", null)
      .lte("notify_at", now)
      .select("*, meetings(client_id,title,status,starts_at)")
      .limit(100);

    for (const reminder of claimed || []) {
      if (!reminder.meetings) continue;
      if (!["cancelled", "completed", "archived"].includes(reminder.meetings.status)) {
        if (reminder.meetings.client_id) {
          await notifyUser(
            reminder.meetings.client_id,
            "meeting_reminder",
            "Meeting reminder",
            `${reminder.meetings.title} starts in ${reminder.minutes_before} minutes`,
            String(reminder.meeting_id)
          );
        }
      }
    }
  } catch {}
}

async function meetingView(meeting: any, actor?: { userId?: string; isClient?: boolean; isPartner?: boolean; partnerId?: string }) {
  const meta = parseMeetingMetadata(meeting);

  const { data: participants } = await supabase
    .from("meeting_participants")
    .select("id,user_id,admin_id,participant_role,rsvp_status,responded_at,client_visible")
    .eq("meeting_id", meeting.id);

  const visibleParticipants = actor?.isClient
    ? (participants || [])
        .filter((p: any) => p.client_visible || p.user_id === actor.userId)
        .map(({ admin_id: _adminId, ...rest }: any) => rest)
    : participants || [];

  let notesQuery = supabase
    .from("meeting_notes")
    .select("id,meeting_id,note_type,body,client_visible,partner_visible,created_at,updated_at")
    .eq("meeting_id", meeting.id)
    .order("created_at", { ascending: false });

  if (actor?.isClient) notesQuery = notesQuery.eq("client_visible", true);
  if (actor?.isPartner) notesQuery = notesQuery.eq("partner_visible", true);
  const { data: notes } = await notesQuery;

  let actionQuery = supabase
    .from("meeting_action_items")
    .select("*")
    .eq("meeting_id", meeting.id)
    .order("due_date", { ascending: true });
  if (actor?.isClient) actionQuery = actionQuery.eq("assigned_user_id", actor.userId);
  const { data: actionItems } = await actionQuery;

  // Query partner assignments
  const { data: partnerMeetings } = await supabase
    .from("bpo_partner_meetings")
    .select("id, partner_id, bpo_partners(id, name, partner_code)")
    .eq("meeting_id", meeting.id);

  // Compute duration in minutes
  const startTime = new Date(meeting.starts_at).getTime();
  const endTime = new Date(meeting.ends_at).getTime();
  const durationMinutes = Math.max(15, Math.round((endTime - startTime) / 60000));

  return {
    ...meeting,
    meeting_type: meta.meetingType,
    meetingType: meta.meetingType,
    start_time: meeting.starts_at,
    end_time: meeting.ends_at,
    meeting_link: meta.meetingLink,
    location: meeting.location || meta.meetingLink,
    has_password: meta.hasPassword,
    hasPassword: meta.hasPassword,
    audience_type: meta.audienceType,
    audienceType: meta.audienceType,
    notes: meta.notes,
    scope: meta.scope,
    durationMinutes,
    participants: visibleParticipants,
    notesList: notes || [],
    action_items: actionItems || [],
    bpo_partners: (partnerMeetings || []).map((pm: any) => pm.bpo_partners).filter(Boolean),
  };
}

async function batchMeetingViews(
  meetings: any[],
  actor?: { userId?: string; isClient?: boolean; isPartner?: boolean; partnerId?: string }
) {
  if (!meetings || meetings.length === 0) return [];
  const meetingIds = meetings.map((m: any) => m.id);

  let notesQuery = supabase
    .from("meeting_notes")
    .select("id,meeting_id,note_type,body,client_visible,partner_visible,created_at,updated_at")
    .in("meeting_id", meetingIds)
    .order("created_at", { ascending: false });

  if (actor?.isClient) notesQuery = notesQuery.eq("client_visible", true);
  if (actor?.isPartner) notesQuery = notesQuery.eq("partner_visible", true);

  let actionQuery = supabase
    .from("meeting_action_items")
    .select("*")
    .in("meeting_id", meetingIds)
    .order("due_date", { ascending: true });
  if (actor?.isClient) actionQuery = actionQuery.eq("assigned_user_id", actor.userId);

  const [
    { data: allParticipants },
    { data: allNotes },
    { data: allActionItems },
    { data: allPartnerMeetings },
  ] = await Promise.all([
    supabase
      .from("meeting_participants")
      .select("id,meeting_id,user_id,admin_id,participant_role,rsvp_status,responded_at,client_visible")
      .in("meeting_id", meetingIds),
    notesQuery,
    actionQuery,
    supabase
      .from("bpo_partner_meetings")
      .select("id, meeting_id, partner_id, bpo_partners(id, name, partner_code)")
      .in("meeting_id", meetingIds),
  ]);

  const participantsMap = new Map<number, any[]>();
  for (const p of allParticipants || []) {
    const list = participantsMap.get(p.meeting_id) || [];
    list.push(p);
    participantsMap.set(p.meeting_id, list);
  }

  const notesMap = new Map<number, any[]>();
  for (const n of allNotes || []) {
    const list = notesMap.get(n.meeting_id) || [];
    list.push(n);
    notesMap.set(n.meeting_id, list);
  }

  const actionItemsMap = new Map<number, any[]>();
  for (const a of allActionItems || []) {
    const list = actionItemsMap.get(a.meeting_id) || [];
    list.push(a);
    actionItemsMap.set(a.meeting_id, list);
  }

  const partnerMeetingsMap = new Map<number, any[]>();
  for (const pm of allPartnerMeetings || []) {
    const list = partnerMeetingsMap.get(pm.meeting_id) || [];
    list.push(pm);
    partnerMeetingsMap.set(pm.meeting_id, list);
  }

  return meetings.map((meeting: any) => {
    const meta = parseMeetingMetadata(meeting);
    const rawParticipants = participantsMap.get(meeting.id) || [];
    const visibleParticipants = actor?.isClient
      ? rawParticipants
          .filter((p: any) => p.client_visible || p.user_id === actor.userId)
          .map(({ admin_id: _adminId, ...rest }: any) => rest)
      : rawParticipants;

    const notes = notesMap.get(meeting.id) || [];
    const actionItems = actionItemsMap.get(meeting.id) || [];
    const partnerList = partnerMeetingsMap.get(meeting.id) || [];

    const startTime = new Date(meeting.starts_at).getTime();
    const endTime = new Date(meeting.ends_at).getTime();
    const durationMinutes = Math.max(15, Math.round((endTime - startTime) / 60000));

    return {
      ...meeting,
      meeting_type: meta.meetingType,
      meetingType: meta.meetingType,
      start_time: meeting.starts_at,
      end_time: meeting.ends_at,
      meeting_link: meta.meetingLink,
      location: meeting.location || meta.meetingLink,
      has_password: meta.hasPassword,
      hasPassword: meta.hasPassword,
      audience_type: meta.audienceType,
      audienceType: meta.audienceType,
      notes: meta.notes,
      scope: meta.scope,
      durationMinutes,
      participants: visibleParticipants,
      notesList: notes,
      action_items: actionItems,
      bpo_partners: partnerList.map((pm: any) => pm.bpo_partners).filter(Boolean),
    };
  });
}

async function meetingActivity(meetingId: number) {
  try {
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("entity_type", "meeting")
      .eq("entity_id", String(meetingId))
      .order("created_at", { ascending: false });
    return data || [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 0. ADMIN BPO MEETINGS SYSTEM (ADMIN CREATES, BPO VIEWS/JOINS ONLY)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/bpo-meetings/partners-and-projects
 * Retrieves authorized active BPO partners (with auto-derived Centre ID) and active projects.
 */
router.get("/admin/bpo-meetings/partners-and-projects", requireAuth, moduleGuard, async (_req: AdminRequest, res: Response) => {
  try {
    const { data: partners, error: partnerErr } = await supabase
      .from("bpo_partners")
      .select("id, partner_code, name, legal_name, contact_name, email, phone, status")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (partnerErr) throw partnerErr;

    const { data: applications } = await supabase
      .from("bpo_partner_applications")
      .select("id, company_name, centre_id, user_id, status");

    const appMapByCompany = new Map<string, string>();
    for (const app of applications || []) {
      if (app.centre_id && app.company_name) {
        appMapByCompany.set(app.company_name.toLowerCase(), app.centre_id);
      }
    }

    const formattedPartners = (partners || []).map((p: any) => {
      const centreId = p.partner_code || appMapByCompany.get(p.name?.toLowerCase()) || `THK-CTR-${p.id.slice(0, 6).toUpperCase()}`;
      return {
        id: p.id,
        partnerCode: p.partner_code || centreId,
        centreId,
        name: p.name,
        contactName: p.contact_name || p.email || "Operations Lead",
        email: p.email,
        status: p.status || "active",
      };
    });

    const { data: projects, error: projErr } = await supabase
      .from("projects")
      .select("id, name, client_id, status, allocated_partner_id, required_seats, vertical")
      .not("status", "in", '("cancelled")')
      .order("name", { ascending: true });

    if (projErr) throw projErr;

    const formattedProjects = (projects || []).map((proj: any) => ({
      id: proj.id,
      name: proj.name,
      allocatedPartnerId: proj.allocated_partner_id,
      status: proj.status,
      vertical: proj.vertical,
    }));

    res.json({
      success: true,
      partners: formattedPartners,
      projects: formattedProjects,
    });
  } catch (err: any) {
    fail(res, 500, "Failed to load partners and projects for meeting scheduling", err?.message);
  }
});

/**
 * GET /api/admin/bpo-meetings
 * Retrieves all meetings assigned to BPO partners with live KPI counts.
 */
router.get("/admin/bpo-meetings", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const [
      { data: allMeetings, error: mErr },
      { data: partnerMeetings, error: pmErr },
      { data: allProjects },
      { data: allPartners },
    ] = await Promise.all([
      supabase
        .from("meetings")
        .select("id, client_id, project_id, title, description, meeting_type, status, starts_at, ends_at, timezone, location, agenda, cancellation_reason, organizer_admin_id, created_at, updated_at")
        .not("status", "eq", "archived")
        .order("starts_at", { ascending: false }),
      supabase
        .from("bpo_partner_meetings")
        .select("meeting_id, partner_id, partner_project_id, bpo_partners(id, name, partner_code, email)"),
      supabase.from("projects").select("id, name"),
      supabase.from("bpo_partners").select("id, name, partner_code"),
    ]);

    if (mErr) throw mErr;
    if (pmErr) throw pmErr;

    const partnerMeetingMap = new Map<number, any>();
    for (const pm of partnerMeetings || []) {
      partnerMeetingMap.set(pm.meeting_id, pm);
    }

    const projectMap = new Map<number, string>();
    for (const pr of allProjects || []) {
      projectMap.set(pr.id, pr.name);
    }

    const partnersById = new Map<string, any>();
    for (const p of allPartners || []) {
      partnersById.set(p.id, p);
    }

    const now = new Date();
    const todayStr = now.toDateString();

    let upcomingCount = 0;
    let todayCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    const bpoMeetingList: any[] = [];

    for (const m of allMeetings || []) {
      const meta = parseMeetingMetadata(m);
      const pm = partnerMeetingMap.get(m.id);

      const isBpoMeeting = Boolean(
        pm ||
        meta.bpoPartnerId ||
        (Array.isArray(meta.targetPartnerIds) && meta.targetPartnerIds.length > 0) ||
        ["bpo_partner", "bpo_partners", "all_bpo_partners"].includes(meta.audienceType)
      );

      if (!isBpoMeeting) continue;

      const startsAt = new Date(m.starts_at);
      const endsAt = new Date(m.ends_at);
      const durationMinutes = Math.max(15, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000));

      const isCancelled = m.status === "cancelled";
      const isCompleted = m.status === "completed" || (endsAt < now && !isCancelled);
      const isToday = startsAt.toDateString() === todayStr && !isCancelled;
      const isUpcoming = startsAt >= now && !isCancelled && !isCompleted;

      if (isCancelled) cancelledCount++;
      else if (isCompleted) completedCount++;
      else if (isToday) {
        todayCount++;
        upcomingCount++;
      } else if (isUpcoming) {
        upcomingCount++;
      }

      let calculatedStatus = "SCHEDULED";
      if (isCancelled) calculatedStatus = "CANCELLED";
      else if (isCompleted) calculatedStatus = "COMPLETED";
      else if (now >= startsAt && now <= endsAt) calculatedStatus = "IN_PROGRESS";
      else if (isToday) calculatedStatus = "TODAY";
      else calculatedStatus = "SCHEDULED";

      const partnerId = pm?.partner_id || meta.bpoPartnerId || meta.targetPartnerIds?.[0] || null;
      const partnerRecord = partnerId ? partnersById.get(partnerId) : null;
      const partnerName = pm?.bpo_partners?.name || partnerRecord?.name || meta.bpoPartnerName || "Authorized BPO Partner";
      const centreId = pm?.bpo_partners?.partner_code || partnerRecord?.partner_code || meta.centreId || "THK-BPO-0001";

      const projId = m.project_id || pm?.partner_project_id || meta.projectId || null;
      const projectName = projId ? projectMap.get(projId) || `Project #${projId}` : "Operational Alignment";

      bpoMeetingList.push({
        id: m.id,
        title: m.title,
        bpoPartnerId: partnerId,
        bpoPartnerName: partnerName,
        centreId,
        projectId: projId,
        projectName,
        meetingDate: m.starts_at ? m.starts_at.slice(0, 10) : "",
        startTime: m.starts_at,
        endTime: m.ends_at,
        duration: durationMinutes,
        timezone: m.timezone || "UTC",
        meetingType: meta.meetingType || "Operational Review",
        status: calculatedStatus,
        rawStatus: m.status,
        meetingUrl: meta.meetingLink || m.location || "",
        hasPassword: meta.hasPassword,
        agenda: m.agenda || null,
        description: meta.notes || null,
        additionalInfo: meta.additionalInfo || null,
        createdBy: "Thinkatic Admin",
        createdAt: m.created_at,
        cancelledAt: m.cancellation_reason ? m.updated_at : null,
        cancellationReason: m.cancellation_reason || null,
      });
    }

    const totalCount = bpoMeetingList.length;

    let filtered = bpoMeetingList;
    const statusParam = req.query.status as string;
    if (statusParam && statusParam !== "all") {
      const upperStatus = statusParam.toUpperCase();
      if (upperStatus === "UPCOMING") {
        filtered = filtered.filter((m) => m.status === "SCHEDULED" || m.status === "TODAY");
      } else {
        filtered = filtered.filter((m) => m.status === upperStatus);
      }
    }

    const searchParam = req.query.search as string;
    if (searchParam && searchParam.trim()) {
      const q = searchParam.toLowerCase().trim();
      filtered = filtered.filter(
        (m) =>
          m.title?.toLowerCase().includes(q) ||
          m.bpoPartnerName?.toLowerCase().includes(q) ||
          m.centreId?.toLowerCase().includes(q) ||
          m.projectName?.toLowerCase().includes(q) ||
          m.meetingType?.toLowerCase().includes(q)
      );
    }

    res.json({
      success: true,
      meetings: filtered,
      kpis: {
        upcoming: upcomingCount,
        today: todayCount,
        completed: completedCount,
        cancelled: cancelledCount,
        total: totalCount,
      },
    });
  } catch (err: any) {
    fail(res, 500, "Failed to load admin BPO meetings", err?.message);
  }
});

/**
 * POST /api/admin/bpo-meetings
 * Admin creates and schedules an authorized meeting with a verified BPO Partner.
 */
router.post("/admin/bpo-meetings", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const {
      bpoPartnerId,
      title,
      description,
      projectId,
      meetingDate,
      startTime,
      endTime,
      meetingUrl,
      meetingPassword,
      agenda,
      additionalInfo,
      meetingType = "Operational Review",
      timezone = "UTC",
    } = req.body ?? {};

    // 1. Mandatory server-side validations
    if (!bpoPartnerId || typeof bpoPartnerId !== "string" || !bpoPartnerId.trim()) {
      return fail(res, 400, "BPO Partner is required");
    }

    const { data: partner, error: partnerErr } = await supabase
      .from("bpo_partners")
      .select("id, name, partner_code, email, status")
      .eq("id", bpoPartnerId.trim())
      .maybeSingle();

    if (partnerErr || !partner) {
      return fail(res, 404, "Authorized BPO Partner not found in records");
    }
    if (partner.status !== "active") {
      return fail(res, 400, "Selected BPO Partner is not currently active");
    }

    const centreId = partner.partner_code || `THK-CTR-${partner.id.slice(0, 6).toUpperCase()}`;

    if (!title || typeof title !== "string" || !title.trim()) {
      return fail(res, 400, "Meeting Title / Topic is required");
    }

    if (!meetingDate || typeof meetingDate !== "string" || !meetingDate.trim()) {
      return fail(res, 400, "Meeting Date is required");
    }
    if (!startTime || typeof startTime !== "string" || !startTime.trim()) {
      return fail(res, 400, "Start Time is required");
    }
    if (!endTime || typeof endTime !== "string" || !endTime.trim()) {
      return fail(res, 400, "End Time / Duration is required");
    }

    let startsAtStr = startTime;
    let endsAtStr = endTime;

    if (startTime.length <= 5 && startTime.includes(":")) {
      startsAtStr = `${meetingDate.trim()}T${startTime.trim()}:00`;
    }
    if (endTime.length <= 5 && endTime.includes(":")) {
      endsAtStr = `${meetingDate.trim()}T${endTime.trim()}:00`;
    }

    const starts = iso(startsAtStr);
    const ends = iso(endsAtStr);

    if (!starts || !ends) {
      return fail(res, 400, "Invalid date or time values provided");
    }
    if (new Date(ends) <= new Date(starts)) {
      return fail(res, 400, "End time must be after start time");
    }

    if (!meetingUrl || typeof meetingUrl !== "string" || !meetingUrl.trim()) {
      return fail(res, 400, "Meeting URL is required");
    }
    const urlValidation = validateMeetingUrl(meetingUrl.trim());
    if (!urlValidation.valid) {
      return fail(res, 400, urlValidation.error || "Valid meeting URL (Zoom, Google Meet, Teams, Webex) is required");
    }
    const safeMeetingUrl = urlValidation.normalized || meetingUrl.trim();

    const ALLOWED_BPO_MEETING_TYPES = [
      "Project Review",
      "Operational Review",
      "Payment Discussion",
      "Training",
      "Compliance",
      "General",
      "Other",
    ];
    const normalizedType = ALLOWED_BPO_MEETING_TYPES.find(
      (t) => t.toLowerCase() === (meetingType || "").toLowerCase()
    ) || "Operational Review";

    let validatedProjectId: number | null = null;
    let validatedProjectName: string | null = null;
    if (projectId && id(projectId)) {
      const { data: proj } = await supabase
        .from("projects")
        .select("id, name, allocated_partner_id")
        .eq("id", id(projectId)!)
        .maybeSingle();

      if (proj) {
        validatedProjectId = proj.id;
        validatedProjectName = proj.name;
      }
    }

    let encryptedPassword = "";
    if (meetingPassword && typeof meetingPassword === "string" && meetingPassword.trim()) {
      encryptedPassword = encryptMeetingPassword(meetingPassword.trim());
    }

    const { data: fallbackClient } = await supabase
      .from("profiles")
      .select("id")
      .eq("account_type", "USER")
      .limit(1)
      .maybeSingle();
    const primaryClientId = fallbackClient?.id || "3f38e13f-cf73-4dad-aee3-a70239de9e31";

    const metadataPayload = {
      meetingType: normalizedType,
      audienceType: "bpo_partner",
      meetingLink: safeMeetingUrl,
      passwordEncrypted: encryptedPassword,
      hasPassword: Boolean(encryptedPassword),
      bpoPartnerId: partner.id,
      bpoPartnerName: partner.name,
      centreId,
      projectId: validatedProjectId,
      projectName: validatedProjectName,
      notes: description?.trim() || null,
      additionalInfo: additionalInfo?.trim() || null,
      targetPartnerIds: [partner.id],
      scope: validatedProjectId ? "project" : "operational",
    };

    const meetingRow: Record<string, any> = {
      client_id: primaryClientId,
      project_id: validatedProjectId || 5,
      title: title.trim(),
      description: JSON.stringify(metadataPayload),
      starts_at: starts,
      ends_at: ends,
      timezone: validTimezone(timezone) ? timezone : "UTC",
      meeting_type: toDbMeetingType(normalizedType),
      status: "scheduled",
      location: safeMeetingUrl,
      agenda: agenda?.trim() || null,
      organizer_admin_id: req.admin!.id,
    };

    const { data: createdMeeting, error: insertError } = await supabase
      .from("meetings")
      .insert(meetingRow)
      .select()
      .single();

    if (insertError) throw insertError;

    const meetingId = createdMeeting.id;

    try {
      await supabase.from("bpo_partner_meetings").upsert(
        {
          meeting_id: meetingId,
          partner_id: partner.id,
          partner_project_id: validatedProjectId,
        },
        { onConflict: "meeting_id,partner_id" }
      );
    } catch (pmErr) {
      console.warn("Notice inserting bpo_partner_meetings:", pmErr);
    }

    const recipientUserIds: string[] = [];
    const { data: partnerUsers } = await supabase
      .from("bpo_partner_users")
      .select("user_id")
      .eq("partner_id", partner.id)
      .eq("status", "active");

    for (const pu of partnerUsers || []) {
      if (pu.user_id && !recipientUserIds.includes(pu.user_id)) {
        recipientUserIds.push(pu.user_id);
      }
    }

    if (recipientUserIds.length === 0 && partner.email) {
      const { data: prof } = await supabase.from("profiles").select("id").eq("email", partner.email).maybeSingle();
      if (prof?.id) recipientUserIds.push(prof.id);
    }
    if (recipientUserIds.length === 0) {
      const { data: app } = await supabase.from("bpo_partner_applications").select("user_id").eq("centre_id", centreId).maybeSingle();
      if (app?.user_id) recipientUserIds.push(app.user_id);
    }

    for (const uId of recipientUserIds) {
      try {
        await supabase.from("bpo_partner_meeting_users").upsert(
          {
            meeting_id: meetingId,
            partner_id: partner.id,
            user_id: uId,
            rsvp_status: "pending",
          },
          { onConflict: "meeting_id,user_id" }
        );

        await supabase.from("notifications").insert({
          recipient_user_id: uId,
          type: "meeting_scheduled",
          title: "New Meeting Scheduled",
          body: `Thinkatic Admin scheduled a meeting with you: "${title.trim()}" on ${new Date(starts).toLocaleDateString()} at ${new Date(starts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
          entity_type: "meeting",
          entity_id: String(meetingId),
          read_at: null,
        });
      } catch (notifErr) {
        console.warn("Notice notifying BPO partner user:", notifErr);
      }
    }

    await audit(
      { adminId: req.admin!.id },
      "bpo_meeting_created",
      "meeting",
      String(meetingId),
      {
        title: title.trim(),
        bpoPartnerId: partner.id,
        bpoPartnerName: partner.name,
        centreId,
        meetingType: normalizedType,
        startsAt: starts,
        endsAt: ends,
        projectId: validatedProjectId,
        hasPassword: Boolean(encryptedPassword),
      }
    );

    const formatted = {
      id: meetingId,
      title: title.trim(),
      bpoPartnerId: partner.id,
      bpoPartnerName: partner.name,
      centreId,
      projectId: validatedProjectId,
      projectName: validatedProjectName || "Operational Alignment",
      meetingDate: meetingDate.trim(),
      startTime: starts,
      endTime: ends,
      duration: Math.max(15, Math.round((new Date(ends).getTime() - new Date(starts).getTime()) / 60000)),
      timezone: validTimezone(timezone) ? timezone : "UTC",
      meetingType: normalizedType,
      status: "SCHEDULED",
      meetingUrl: safeMeetingUrl,
      hasPassword: Boolean(encryptedPassword),
      agenda: agenda?.trim() || null,
      description: description?.trim() || null,
      additionalInfo: additionalInfo?.trim() || null,
      createdBy: "Thinkatic Admin",
      createdAt: createdMeeting.created_at,
    };

    res.status(201).json({
      success: true,
      message: "Meeting Created",
      meeting: formatted,
    });
  } catch (err: any) {
    console.error("Admin BPO Meeting Creation error:", err);
    fail(res, 500, "Unable to create meeting. Please try again.", err?.message);
  }
});

/**
 * PATCH /api/admin/bpo-meetings/:id
 * Admin updates an existing BPO meeting.
 */
router.patch("/admin/bpo-meetings/:id", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    if (!meetingId) return fail(res, 400, "Invalid meeting ID");

    const { data: existing, error: existErr } = await supabase.from("meetings").select("*").eq("id", meetingId).maybeSingle();
    if (existErr || !existing) return fail(res, 404, "Meeting not found");

    const existingMeta = parseMeetingMetadata(existing);

    let updatedStarts = existing.starts_at;
    let updatedEnds = existing.ends_at;

    if (req.body.startTime || req.body.startsAt) {
      const s = iso(req.body.startTime || req.body.startsAt);
      if (s) updatedStarts = s;
    }
    if (req.body.endTime || req.body.endsAt) {
      const e = iso(req.body.endTime || req.body.endsAt);
      if (e) updatedEnds = e;
    }

    if (new Date(updatedEnds) <= new Date(updatedStarts)) {
      return fail(res, 400, "End time must be after start time");
    }

    let updatedLink = existingMeta.meetingLink;
    if (req.body.meetingUrl !== undefined || req.body.meetingLink !== undefined) {
      const u = (req.body.meetingUrl ?? req.body.meetingLink ?? "").trim();
      const v = validateMeetingUrl(u);
      if (!v.valid) return fail(res, 400, v.error || "Invalid meeting URL");
      updatedLink = v.normalized || u;
    }

    let updatedPassword = existingMeta.passwordEncrypted;
    if (req.body.meetingPassword !== undefined) {
      updatedPassword = req.body.meetingPassword.trim() ? encryptMeetingPassword(req.body.meetingPassword.trim()) : "";
    }

    const updatedMeta = {
      ...existingMeta,
      meetingType: req.body.meetingType || existingMeta.meetingType,
      meetingLink: updatedLink,
      passwordEncrypted: updatedPassword,
      hasPassword: Boolean(updatedPassword),
      notes: req.body.description !== undefined ? req.body.description : existingMeta.notes,
      additionalInfo: req.body.additionalInfo !== undefined ? req.body.additionalInfo : existingMeta.additionalInfo,
    };

    const patch: Record<string, any> = {
      description: JSON.stringify(updatedMeta),
      starts_at: updatedStarts,
      ends_at: updatedEnds,
      location: updatedLink,
    };

    if (req.body.title !== undefined) patch.title = req.body.title.trim();
    if (req.body.agenda !== undefined) patch.agenda = req.body.agenda;
    if (req.body.status !== undefined) patch.status = req.body.status.toLowerCase();

    const { data: updated, error: updateError } = await supabase
      .from("meetings")
      .update(patch)
      .eq("id", meetingId)
      .select()
      .single();

    if (updateError) throw updateError;

    await audit({ adminId: req.admin!.id }, "bpo_meeting_updated", "meeting", String(meetingId), { changes: patch });

    // Notify partner users of update
    const partnerId = existingMeta.bpoPartnerId || existingMeta.targetPartnerIds?.[0];
    if (partnerId) {
      await notifyPartnerUsers(
        partnerId,
        "meeting_updated",
        "Meeting Details Updated",
        `Admin updated meeting details for "${updated.title}".`,
        String(meetingId)
      );
    }

    res.json({ success: true, message: "Meeting updated successfully", meeting: updated });
  } catch (err: any) {
    fail(res, 500, "Failed to update meeting", err?.message);
  }
});

/**
 * POST /api/admin/bpo-meetings/:id/cancel
 * Admin cancels an existing BPO meeting.
 */
router.post("/admin/bpo-meetings/:id/cancel", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    if (!meetingId) return fail(res, 400, "Invalid meeting ID");

    const reason = req.body?.reason || "Cancelled by Thinkatic Administrator";
    const { data: updated, error } = await supabase
      .from("meetings")
      .update({ status: "cancelled", cancellation_reason: reason })
      .eq("id", meetingId)
      .select()
      .single();

    if (error || !updated) return fail(res, 404, "Meeting not found");

    const meta = parseMeetingMetadata(updated);
    await audit({ adminId: req.admin!.id }, "bpo_meeting_cancelled", "meeting", String(meetingId), { reason });

    const partnerId = meta.bpoPartnerId || meta.targetPartnerIds?.[0];
    if (partnerId) {
      await notifyPartnerUsers(
        partnerId,
        "meeting_cancelled",
        "Meeting Cancelled",
        `Meeting "${updated.title}" has been cancelled: ${reason}.`,
        String(meetingId)
      );
    }

    res.json({ success: true, message: "Meeting cancelled successfully", meeting: updated });
  } catch (err: any) {
    fail(res, 500, "Failed to cancel meeting", err?.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. ADMIN METADATA & RECIPIENT SELECTOR DATA
// ─────────────────────────────────────────────────────────────────────────────

router.get("/admin/meetings/recipients-data", requireAuth, moduleGuard, async (_req: AdminRequest, res: Response) => {
  try {
    // 1. Fetch eligible active Clients
    const { data: clientProfiles, error: clientError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, account_type, is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (clientError) throw clientError;

    // Filter to client accounts (role=user, client, or account_type=USER)
    const eligibleClients = (clientProfiles || [])
      .filter((p: any) => p.account_type === "USER" || ["user", "client"].includes(p.role))
      .map((p: any) => ({
        id: p.id,
        name: p.full_name || p.email?.split("@")[0] || "Client User",
        companyName: p.company_name || p.full_name || "Independent Client",
        email: p.email,
        status: "active",
      }));

    // 2. Fetch eligible active BPO Partners
    const { data: partners, error: partnerError } = await supabase
      .from("bpo_partners")
      .select("id, partner_code, name, legal_name, contact_name, email, phone, status")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (partnerError) throw partnerError;

    const eligiblePartners = (partners || []).map((p: any) => ({
      id: p.id,
      partnerCode: p.partner_code,
      name: p.name,
      contactName: p.contact_name || p.email || "Operations Lead",
      email: p.email,
      status: p.status || "active",
    }));

    // 3. Fetch active Projects
    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select("id, name, client_id, status, allocated_partner_id")
      .not("status", "in", '("cancelled","completed")')
      .order("name", { ascending: true });

    if (projectError) throw projectError;

    const eligibleProjects = (projects || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      clientId: p.client_id,
      allocatedPartnerId: p.allocated_partner_id,
      status: p.status,
    }));

    res.json({
      success: true,
      clients: eligibleClients,
      bpoPartners: eligiblePartners,
      projects: eligibleProjects,
      counts: {
        activeClients: eligibleClients.length,
        activePartners: eligiblePartners.length,
        activeProjects: eligibleProjects.length,
      },
    });
  } catch (error: any) {
    fail(res, 500, "Failed to load recipient targeting data", error?.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ADMIN MEETING CRUD & MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

router.get("/admin/meetings", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    await dispatchDueReminders();
    let query = supabase.from("meetings").select("*").order("starts_at", { ascending: true });

    const statusParam = req.query.status as string;
    if (statusParam && STATUSES.includes(statusParam)) {
      query = query.eq("status", statusParam);
    } else if (statusParam === "upcoming") {
      query = query.gte("starts_at", new Date().toISOString()).not("status", "in", '("cancelled","completed","archived")');
    } else if (statusParam === "today") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      query = query.gte("starts_at", startOfDay.toISOString()).lte("starts_at", endOfDay.toISOString());
    }

    if (typeof req.query.clientId === "string") query = query.eq("client_id", req.query.clientId);
    if (typeof req.query.projectId === "string" && id(req.query.projectId)) query = query.eq("project_id", id(req.query.projectId)!);
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      query = query.ilike("title", `%${req.query.search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = await batchMeetingViews(data || []);

    // Client-side audience filter if requested
    const audienceFilter = req.query.audience as string;
    if (audienceFilter && audienceFilter !== "all") {
      results = results.filter((m: any) => {
        if (audienceFilter === "client") return ["client", "clients", "all_clients", "everyone"].includes(m.audience_type);
        if (audienceFilter === "bpo_partner") return ["bpo_partner", "bpo_partners", "all_bpo_partners", "everyone"].includes(m.audience_type);
        return m.audience_type === audienceFilter;
      });
    }

    res.json(results);
  } catch (error: any) {
    fail(res, 500, "Failed to load admin meetings", error?.message);
  }
});

router.get("/admin/meetings/:id", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    if (!meetingId) return fail(res, 400, "Invalid meeting ID");

    const { data: meeting, error } = await supabase.from("meetings").select("*").eq("id", meetingId).maybeSingle();
    if (error) throw error;
    if (!meeting) return fail(res, 404, "Meeting not found");

    const view = await meetingView(meeting);
    const meta = parseMeetingMetadata(meeting);

    // Decrypt password for admin inspection
    const decryptedPassword = meta.passwordEncrypted ? decryptMeetingPassword(meta.passwordEncrypted) : "";

    res.json({
      ...view,
      password: decryptedPassword,
      activity: await meetingActivity(meetingId),
    });
  } catch (error: any) {
    fail(res, 500, "Failed to load admin meeting", error?.message);
  }
});

router.post("/admin/meetings", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const {
      title,
      meetingType = "project_meeting",
      startsAt,
      endsAt,
      timezone = "UTC",
      meetingLink,
      meetingPassword,
      location,
      agenda,
      notes,
      audienceType = "client", // 'client', 'clients', 'all_clients', 'bpo_partner', 'bpo_partners', 'all_bpo_partners', 'everyone'
      targetClientIds = [],
      targetPartnerIds = [],
      scope = "general", // 'general' | 'project'
      projectId,
      status = "scheduled",
      fromRequestId,
    } = req.body ?? {};

    // 1. Server-side validation
    if (!title?.trim()) return fail(res, 400, "Meeting title is required");
    const starts = iso(startsAt);
    const ends = iso(endsAt);
    if (!starts || !ends) return fail(res, 400, "Valid start and end times are required");
    if (new Date(ends) <= new Date(starts)) return fail(res, 400, "End time must be after start time");
    if (!validTimezone(timezone)) return fail(res, 422, "Invalid timezone identifier");
    if (!TYPES.includes(meetingType)) return fail(res, 400, `Invalid meeting type: ${meetingType}`);
    if (!STATUSES.includes(status)) return fail(res, 400, `Invalid meeting status: ${status}`);

    // Validate meeting link protocol
    const urlValidation = validateMeetingUrl(meetingLink);
    if (!urlValidation.valid) {
      return fail(res, 400, urlValidation.error || "Invalid meeting link URL");
    }
    const safeMeetingLink = urlValidation.normalized || "";

    // Validate scope & project
    let validatedProject: any = null;
    if (scope === "project" || id(projectId)) {
      if (!id(projectId)) return fail(res, 400, "Project ID is required for project-specific meetings");
      validatedProject = await projectById(id(projectId)!);
      if (!validatedProject) return fail(res, 404, "Target project not found");
    }

    // Encrypt meeting password if provided
    const encryptedPassword = meetingPassword?.trim() ? encryptMeetingPassword(meetingPassword.trim()) : "";

    // Resolve primary client_id and project_id for database constraints
    let primaryClientId: string | null = null;
    if (Array.isArray(targetClientIds) && targetClientIds.length > 0 && typeof targetClientIds[0] === "string") {
      primaryClientId = targetClientIds[0];
    } else if (validatedProject?.client_id) {
      primaryClientId = validatedProject.client_id;
    } else {
      // Find an existing client profile as valid foreign key fallback
      const { data: firstClient } = await supabase
        .from("profiles")
        .select("id")
        .eq("account_type", "USER")
        .limit(1)
        .maybeSingle();
      primaryClientId = firstClient?.id || "3f38e13f-cf73-4dad-aee3-a70239de9e31";
    }

    let primaryProjectId: number | null = validatedProject?.id || null;
    if (!primaryProjectId) {
      const { data: firstProj } = await supabase.from("projects").select("id").limit(1).maybeSingle();
      primaryProjectId = firstProj?.id || 5;
    }

    // Prepare JSON metadata payload to store in description
    const metadataPayload = {
      meetingType,
      audienceType,
      meetingLink: safeMeetingLink,
      passwordEncrypted: encryptedPassword,
      hasPassword: Boolean(encryptedPassword),
      notes: notes?.trim() || null,
      scope,
      targetClientIds: Array.isArray(targetClientIds) ? targetClientIds : [],
      targetPartnerIds: Array.isArray(targetPartnerIds) ? targetPartnerIds : [],
    };

    const meetingRow: Record<string, any> = {
      client_id: primaryClientId,
      project_id: primaryProjectId,
      title: title.trim(),
      description: JSON.stringify(metadataPayload),
      starts_at: starts,
      ends_at: ends,
      timezone,
      meeting_type: toDbMeetingType(meetingType),
      status,
      location: safeMeetingLink || location || null,
      agenda: agenda?.trim() || null,
      organizer_admin_id: req.admin!.id,
    };

    // Attempt insertion into public.meetings
    const { data: meeting, error: insertError } = await supabase
      .from("meetings")
      .insert(meetingRow)
      .select()
      .single();

    if (insertError) throw insertError;

    // 2. Persist Recipient Mappings
    const createdMeetingId = meeting.id;

    // A. BPO Partners
    const partnerIdsToTarget: string[] = [];
    if (audienceType === "all_bpo_partners" || audienceType === "everyone") {
      const { data: allPartners } = await supabase.from("bpo_partners").select("id").eq("status", "active");
      (allPartners || []).forEach((p: any) => partnerIdsToTarget.push(p.id));
    } else if (Array.isArray(targetPartnerIds)) {
      targetPartnerIds.filter((pid: any) => typeof pid === "string" && pid.trim()).forEach((pid: string) => partnerIdsToTarget.push(pid));
    }

    if (partnerIdsToTarget.length > 0) {
      const uniquePartnerIds = Array.from(new Set(partnerIdsToTarget));
      try {
        const partnerMeetingRows = uniquePartnerIds.map((pId) => ({
          meeting_id: createdMeetingId,
          partner_id: pId,
          partner_project_id: validatedProject?.id || null,
        }));
        await supabase.from("bpo_partner_meetings").upsert(partnerMeetingRows, { onConflict: "meeting_id,partner_id" });

        // Query all partner users in a single round-trip
        const { data: pUsers } = await supabase
          .from("bpo_partner_users")
          .select("user_id, partner_id")
          .in("partner_id", uniquePartnerIds)
          .eq("status", "active");

        if (pUsers && pUsers.length > 0) {
          const userRows = pUsers.map((pu: any) => ({
            meeting_id: createdMeetingId,
            partner_id: pu.partner_id,
            user_id: pu.user_id,
            rsvp_status: "pending",
          }));
          await supabase.from("bpo_partner_meeting_users").upsert(userRows, { onConflict: "meeting_id,user_id" });

          const notifRows = pUsers.map((pu: any) => ({
            recipient_user_id: pu.user_id,
            type: "meeting_scheduled",
            title: "New Authorized Meeting Scheduled",
            body: `${meeting.title} scheduled for ${new Date(starts).toLocaleString()}`,
            entity_type: "meeting",
            entity_id: String(createdMeetingId),
          }));
          await supabase.from("notifications").insert(notifRows);
        }
      } catch (err) {
        console.error("Error persisting partner meeting recipients:", err);
      }
    }

    // B. Clients
    const clientIdsToTarget: string[] = [];
    if (audienceType === "all_clients" || audienceType === "everyone") {
      const { data: allClients } = await supabase.from("profiles").select("id").eq("is_active", true);
      (allClients || []).forEach((c: any) => clientIdsToTarget.push(c.id));
    } else if (Array.isArray(targetClientIds)) {
      targetClientIds.filter((cid: any) => typeof cid === "string" && cid.trim()).forEach((cid: string) => clientIdsToTarget.push(cid));
    }

    if (clientIdsToTarget.length > 0) {
      const uniqueClientIds = Array.from(new Set(clientIdsToTarget));
      try {
        const participantRows = uniqueClientIds.map((cId) => ({
          meeting_id: createdMeetingId,
          user_id: cId,
          participant_role: "client",
          client_visible: true,
          rsvp_status: "pending",
        }));
        await supabase.from("meeting_participants").upsert(participantRows, { onConflict: "meeting_id,user_id" });

        const notifRows = uniqueClientIds.map((cId) => ({
          recipient_user_id: cId,
          type: "meeting_scheduled",
          title: "New Meeting Scheduled",
          body: `${meeting.title} scheduled for ${new Date(starts).toLocaleString()}`,
          entity_type: "meeting",
          entity_id: String(createdMeetingId),
        }));
        await supabase.from("notifications").insert(notifRows);
      } catch (err) {
        console.error("Error persisting client meeting participants:", err);
      }
    }

    // Add admin organizer participant
    try {
      await supabase.from("meeting_participants").upsert(
        {
          meeting_id: createdMeetingId,
          admin_id: req.admin!.id,
          participant_role: "organizer",
          client_visible: false,
          rsvp_status: "accepted",
        },
        { onConflict: "meeting_id,admin_id" }
      );
    } catch {}

    // Record meeting_recipients if table exists
    try {
      await supabase.from("meeting_recipients").insert([
        ...partnerIdsToTarget.map((pid) => ({
          meeting_id: createdMeetingId,
          recipient_type: "BPO_PARTNER",
          recipient_id: pid,
          delivery_status: "delivered",
        })),
        ...clientIdsToTarget.map((cid) => ({
          meeting_id: createdMeetingId,
          recipient_type: "CLIENT",
          recipient_id: cid,
          delivery_status: "delivered",
        })),
      ]);
    } catch {}

    // Set reminders
    await createReminders(meeting);

    // Audit log
    await audit(
      { adminId: req.admin!.id },
      "meeting_created",
      "meeting",
      String(createdMeetingId),
      {
        title: meeting.title,
        audienceType,
        clientCount: clientIdsToTarget.length,
        partnerCount: partnerIdsToTarget.length,
        hasPassword: Boolean(encryptedPassword),
      }
    );

    // Auto-resolve meeting request if originating from one
    if (id(fromRequestId)) {
      try {
        await supabase
          .from("meeting_requests")
          .update({ meeting_id: createdMeetingId, status: "scheduled", reviewed_by_admin_id: req.admin!.id })
          .eq("id", id(fromRequestId)!);
      } catch {}
    }

    const createdView = await meetingView(meeting);
    res.status(201).json(createdView);
  } catch (error: any) {
    fail(res, 500, "Failed to schedule meeting", error?.message);
  }
});

router.patch("/admin/meetings/:id", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    if (!meetingId) return fail(res, 400, "Invalid meeting ID");

    const { data: existing, error: existingError } = await supabase.from("meetings").select("*").eq("id", meetingId).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return fail(res, 404, "Meeting not found");

    const existingMeta = parseMeetingMetadata(existing);

    const nextStarts = req.body.startsAt === undefined ? existing.starts_at : iso(req.body.startsAt);
    const nextEnds = req.body.endsAt === undefined ? existing.ends_at : iso(req.body.endsAt);
    if (!nextStarts || !nextEnds || new Date(nextEnds) <= new Date(nextStarts)) {
      return fail(res, 400, "End time must be after start time");
    }

    if (req.body.status !== undefined && !STATUSES.includes(req.body.status)) return fail(res, 400, "Invalid meeting status");
    if (req.body.meetingType !== undefined && !TYPES.includes(req.body.meetingType)) return fail(res, 400, "Invalid meeting type");

    let updatedMeetingLink = existingMeta.meetingLink;
    if (req.body.meetingLink !== undefined) {
      const v = validateMeetingUrl(req.body.meetingLink);
      if (!v.valid) return fail(res, 400, v.error || "Invalid meeting URL");
      updatedMeetingLink = v.normalized || "";
    }

    let updatedEncryptedPassword = existingMeta.passwordEncrypted;
    if (req.body.meetingPassword !== undefined) {
      updatedEncryptedPassword = req.body.meetingPassword.trim() ? encryptMeetingPassword(req.body.meetingPassword.trim()) : "";
    }

    const updatedMeta: Record<string, any> = {
      ...existingMeta,
      meetingLink: updatedMeetingLink,
      passwordEncrypted: updatedEncryptedPassword,
      hasPassword: Boolean(updatedEncryptedPassword),
      notes: req.body.notes !== undefined ? req.body.notes : existingMeta.notes,
    };

    const patch: Record<string, unknown> = {
      description: JSON.stringify(updatedMeta),
      starts_at: nextStarts,
      ends_at: nextEnds,
    };

    if (req.body.title !== undefined) patch.title = req.body.title.trim();
    if (req.body.location !== undefined || updatedMeetingLink) patch.location = updatedMeetingLink || req.body.location;
    if (req.body.agenda !== undefined) patch.agenda = req.body.agenda;
    if (req.body.timezone !== undefined && validTimezone(req.body.timezone)) patch.timezone = req.body.timezone;
    if (req.body.meetingType !== undefined) {
      patch.meeting_type = toDbMeetingType(req.body.meetingType);
      updatedMeta.meetingType = req.body.meetingType;
    }
    if (req.body.status !== undefined) patch.status = req.body.status;
    if (req.body.cancellationReason !== undefined) patch.cancellation_reason = req.body.cancellationReason;

    const { data: updated, error: updateError } = await supabase
      .from("meetings")
      .update(patch)
      .eq("id", meetingId)
      .select()
      .single();

    if (updateError) throw updateError;

    const rescheduled = existing.starts_at !== updated.starts_at || existing.ends_at !== updated.ends_at;
    await createReminders(updated);

    await audit(
      { adminId: req.admin!.id },
      rescheduled ? "meeting_rescheduled" : patch.status ? "meeting_status_changed" : "meeting_updated",
      "meeting",
      String(meetingId),
      { previous: { startsAt: existing.starts_at, status: existing.status }, changes: patch }
    );

    // Notify participants
    const notifMsg = rescheduled
      ? `Meeting "${updated.title}" was rescheduled to ${new Date(nextStarts).toLocaleString()}`
      : `Meeting "${updated.title}" was updated.`;

    if (existing.client_id) {
      await notifyUser(existing.client_id, "meeting_updated", "Meeting Updated", notifMsg, String(meetingId));
    }

    const { data: partnerLinks } = await supabase.from("bpo_partner_meetings").select("partner_id").eq("meeting_id", meetingId);
    for (const pl of partnerLinks || []) {
      await notifyPartnerUsers(pl.partner_id, "meeting_updated", "Meeting Updated", notifMsg, String(meetingId));
    }

    res.json(await meetingView(updated));
  } catch (error: any) {
    fail(res, 500, "Failed to update meeting", error?.message);
  }
});

router.post("/admin/meetings/:id/cancel", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    if (!meetingId) return fail(res, 400, "Invalid meeting ID");

    const reason = req.body?.reason || "Meeting cancelled by Admin";
    const { data: updated, error } = await supabase
      .from("meetings")
      .update({ status: "cancelled", cancellation_reason: reason })
      .eq("id", meetingId)
      .select()
      .single();

    if (error) throw error;

    await audit({ adminId: req.admin!.id }, "meeting_cancelled", "meeting", String(meetingId), { reason });

    const cancelMsg = `Meeting "${updated.title}" was cancelled: ${reason}`;
    if (updated.client_id) {
      await notifyUser(updated.client_id, "meeting_cancelled", "Meeting Cancelled", cancelMsg, String(meetingId));
    }

    const { data: partnerLinks } = await supabase.from("bpo_partner_meetings").select("partner_id").eq("meeting_id", meetingId);
    for (const pl of partnerLinks || []) {
      await notifyPartnerUsers(pl.partner_id, "meeting_cancelled", "Meeting Cancelled", cancelMsg, String(meetingId));
    }

    res.json(await meetingView(updated));
  } catch (error: any) {
    fail(res, 500, "Failed to cancel meeting", error?.message);
  }
});

router.post("/admin/meetings/:id/archive", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    if (!meetingId) return fail(res, 400, "Invalid meeting ID");

    const { data: updated, error } = await supabase
      .from("meetings")
      .update({ status: "archived" })
      .eq("id", meetingId)
      .select()
      .single();

    if (error) throw error;
    await audit({ adminId: req.admin!.id }, "meeting_archived", "meeting", String(meetingId));
    res.json(await meetingView(updated));
  } catch (error: any) {
    fail(res, 500, "Failed to archive meeting", error?.message);
  }
});

router.post("/admin/meetings/:id/resend-notifications", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    if (!meetingId) return fail(res, 400, "Invalid meeting ID");

    const { data: meeting, error } = await supabase.from("meetings").select("*").eq("id", meetingId).maybeSingle();
    if (error || !meeting) return fail(res, 404, "Meeting not found");

    const msg = `Reminder: Meeting "${meeting.title}" is scheduled for ${new Date(meeting.starts_at).toLocaleString()}`;
    if (meeting.client_id) {
      await notifyUser(meeting.client_id, "meeting_notification", "Meeting Reminder", msg, String(meetingId));
    }

    const { data: partnerLinks } = await supabase.from("bpo_partner_meetings").select("partner_id").eq("meeting_id", meetingId);
    for (const pl of partnerLinks || []) {
      await notifyPartnerUsers(pl.partner_id, "meeting_notification", "Meeting Reminder", msg, String(meetingId));
    }

    await audit({ adminId: req.admin!.id }, "meeting_notifications_resent", "meeting", String(meetingId));
    res.json({ success: true, message: "Notifications resent successfully" });
  } catch (error: any) {
    fail(res, 500, "Failed to resend notifications", error?.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SECURE PASSWORD REVEAL (SERVER-SIDE AUTHORIZATION & AUDIT)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/meetings/:id/password", async (req: Request, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    if (!meetingId) return fail(res, 400, "Invalid meeting ID");

    // Authenticate caller (either admin token or user token)
    let isAdmin = false;
    let userId: string | null = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      // Check Admin
      try {
        const adminPayload = jwt.verify(
          token,
          process.env.SESSION_SECRET || "dev-admin-secret"
        ) as any;
        if (adminPayload?.id) {
          isAdmin = true;
        }
      } catch {}

      // Check Client / User
      if (!isAdmin) {
        try {
          const userPayload = jwt.verify(
            token,
            process.env.USER_SESSION_SECRET || "thinkatic-user-secret-2026"
          ) as any;
          if (userPayload?.id) {
            userId = userPayload.id;
          }
        } catch {}
      }
    }

    if (!isAdmin && !userId) {
      return fail(res, 401, "Authentication required to view meeting password");
    }

    const { data: meeting, error } = await supabase.from("meetings").select("*").eq("id", meetingId).maybeSingle();
    if (error || !meeting) return fail(res, 404, "Meeting not found");

    const meta = parseMeetingMetadata(meeting);
    if (!meta.passwordEncrypted) {
      return res.json({ success: true, password: "" });
    }

    // Server-Side Authorization check
    let authorized = false;
    if (isAdmin) {
      authorized = true;
    } else if (userId) {
      // Check Client access
      if (
        meeting.client_id === userId ||
        meta.targetClientIds.includes(userId) ||
        meta.audienceType === "all_clients" ||
        meta.audienceType === "everyone"
      ) {
        authorized = true;
      }

      // Check Participant row
      if (!authorized) {
        const { data: p } = await supabase
          .from("meeting_participants")
          .select("id")
          .eq("meeting_id", meetingId)
          .eq("user_id", userId)
          .maybeSingle();
        if (p) authorized = true;
      }

      // Check BPO Partner access
      if (!authorized) {
        const partnerInfo = await resolvePartnerForUser(userId);
        if (partnerInfo) {
          if (
            meta.audienceType === "all_bpo_partners" ||
            meta.audienceType === "everyone" ||
            meta.targetPartnerIds.includes(partnerInfo.partnerId)
          ) {
            authorized = true;
          } else {
            const { data: pm } = await supabase
              .from("bpo_partner_meetings")
              .select("id")
              .eq("meeting_id", meetingId)
              .eq("partner_id", partnerInfo.partnerId)
              .maybeSingle();
            if (pm) authorized = true;
          }
        }
      }
    }

    if (!authorized) {
      await audit({ userId: userId || undefined }, "unauthorized_password_reveal_attempt", "meeting", String(meetingId));
      return fail(res, 403, "You are not authorized to view the credentials for this meeting");
    }

    // Decrypt password
    const plainPassword = decryptMeetingPassword(meta.passwordEncrypted);

    // Audit sensitive credential reveal
    await audit(
      isAdmin ? { adminId: (req as any).admin.id } : { userId: userId! },
      "meeting_password_revealed",
      "meeting",
      String(meetingId)
    );

    res.json({
      success: true,
      password: plainPassword,
    });
  } catch (error: any) {
    fail(res, 500, "Unable to retrieve password", error?.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. BPO PARTNER MEETINGS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/partner/meetings", requireUserAuth, moduleGuard, async (req: UserRequest, res: Response) => {
  try {
    const partnerInfo = await resolvePartnerForUser(req.user!.id);
    if (!partnerInfo) {
      return fail(res, 403, "BPO partner credentials required");
    }

    // 1. Get meetings directly mapped to this partner in bpo_partner_meetings
    const { data: partnerMeetings, error: pmErr } = await supabase
      .from("bpo_partner_meetings")
      .select("meeting_id")
      .eq("partner_id", partnerInfo.partnerId);

    if (pmErr) throw pmErr;
    const directMeetingIds = (partnerMeetings || []).map((pm: any) => pm.meeting_id);

    // 2. Query all scheduled meetings
    const { data: allMeetings, error: mErr } = await supabase
      .from("meetings")
      .select("*")
      .not("status", "eq", "archived")
      .order("starts_at", { ascending: true });

    if (mErr) throw mErr;

    // Filter to meetings authorized for this partner
    const authorized = (allMeetings || []).filter((m: any) => {
      if (directMeetingIds.includes(m.id)) return true;
      const meta = parseMeetingMetadata(m);
      if (meta.targetPartnerIds.includes(partnerInfo.partnerId)) return true;
      if (["all_bpo_partners", "everyone"].includes(meta.audienceType)) return true;
      return false;
    });

    // Enrich view with RSVP status for this user in batch
    const meetingIds = authorized.map((m: any) => m.id);
    const [baseViews, { data: userRsvps }] = await Promise.all([
      batchMeetingViews(authorized, { isPartner: true, partnerId: partnerInfo.partnerId }),
      meetingIds.length > 0
        ? supabase
            .from("bpo_partner_meeting_users")
            .select("meeting_id, rsvp_status, responded_at")
            .in("meeting_id", meetingIds)
            .eq("user_id", req.user!.id)
        : Promise.resolve({ data: [] }),
    ]);

    const rsvpMap = new Map<number, any>();
    for (const r of userRsvps || []) {
      rsvpMap.set(r.meeting_id, r);
    }

    const views = baseViews.map((baseView: any) => {
      const userRsvp = rsvpMap.get(baseView.id);
      return {
        ...baseView,
        rsvpStatus: userRsvp?.rsvp_status || "pending",
        respondedAt: userRsvp?.responded_at || null,
      };
    });

    res.json(views);
  } catch (error: any) {
    fail(res, 500, "Failed to load partner meetings", error?.message);
  }
});

router.get("/partner/meetings/:id", requireUserAuth, moduleGuard, async (req: UserRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    if (!meetingId) return fail(res, 400, "Invalid meeting ID");

    const partnerInfo = await resolvePartnerForUser(req.user!.id);
    if (!partnerInfo) return fail(res, 403, "BPO partner credentials required");

    const { data: meeting, error } = await supabase.from("meetings").select("*").eq("id", meetingId).maybeSingle();
    if (error || !meeting) return fail(res, 404, "Meeting not found");

    const meta = parseMeetingMetadata(meeting);
    const { data: pm } = await supabase
      .from("bpo_partner_meetings")
      .select("id")
      .eq("meeting_id", meetingId)
      .eq("partner_id", partnerInfo.partnerId)
      .maybeSingle();

    const isAuthorized = Boolean(
      pm ||
      meta.targetPartnerIds.includes(partnerInfo.partnerId) ||
      ["all_bpo_partners", "everyone"].includes(meta.audienceType)
    );

    if (!isAuthorized) {
      return fail(res, 403, "You do not have access to this meeting");
    }

    // Requirements 18 & 20: Mark corresponding notification as read once meeting is viewed
    try {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_user_id", req.user!.id)
        .eq("entity_type", "meeting")
        .eq("entity_id", String(meetingId))
        .is("read_at", null);
    } catch (notifErr) {
      console.warn("Notice marking notification read:", notifErr);
    }

    const view = await meetingView(meeting, { isPartner: true, partnerId: partnerInfo.partnerId });
    res.json(view);
  } catch (error: any) {
    fail(res, 500, "Failed to load partner meeting", error?.message);
  }
});

router.post("/partner/meetings/:id/rsvp", requireUserAuth, moduleGuard, async (req: UserRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    const status = req.body?.status;
    if (!meetingId || !RSVP.includes(status)) return fail(res, 400, "Invalid meeting or RSVP status");

    const partnerInfo = await resolvePartnerForUser(req.user!.id);
    if (!partnerInfo) return fail(res, 403, "BPO partner credentials required");

    const { data, error } = await supabase
      .from("bpo_partner_meeting_users")
      .upsert(
        {
          meeting_id: meetingId,
          partner_id: partnerInfo.partnerId,
          user_id: req.user!.id,
          rsvp_status: status,
          responded_at: new Date().toISOString(),
        },
        { onConflict: "meeting_id,user_id" }
      )
      .select()
      .single();

    if (error) throw error;
    await audit({ userId: req.user!.id }, "partner_meeting_rsvp_updated", "meeting", String(meetingId), { status });
    res.json(data);
  } catch (error: any) {
    fail(res, 500, "Failed to update RSVP", error?.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CLIENT MEETINGS ENDPOINTS (MULTI-TENANT ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/meetings", requireUserAuth, moduleGuard, async (req: UserRequest, res: Response) => {
  try {
    await dispatchDueReminders();
    const userId = req.user!.id;

    // Fetch candidate meetings
    const { data: allMeetings, error } = await supabase
      .from("meetings")
      .select("*")
      .not("status", "eq", "archived")
      .order("starts_at", { ascending: true });

    if (error) throw error;

    // Filter to meetings authorized for this client
    const authorized = (allMeetings || []).filter((m: any) => {
      if (m.client_id === userId) return true;
      const meta = parseMeetingMetadata(m);
      if (meta.targetClientIds.includes(userId)) return true;
      if (["all_clients", "everyone"].includes(meta.audienceType)) return true;
      return false;
    });

    const views = await batchMeetingViews(authorized, { userId, isClient: true });
    res.json(views);
  } catch (error: any) {
    fail(res, 500, "Failed to load meetings", error?.message);
  }
});

router.get("/meetings/:id", requireUserAuth, moduleGuard, async (req: UserRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    if (!meetingId) return fail(res, 400, "Invalid meeting ID");

    const userId = req.user!.id;
    const { data: meeting, error } = await supabase.from("meetings").select("*").eq("id", meetingId).maybeSingle();
    if (error || !meeting) return fail(res, 404, "Meeting not found");

    const meta = parseMeetingMetadata(meeting);
    const isAuthorized =
      meeting.client_id === userId ||
      meta.targetClientIds.includes(userId) ||
      ["all_clients", "everyone"].includes(meta.audienceType);

    if (!isAuthorized) {
      return fail(res, 403, "You do not have permission to view this meeting");
    }

    res.json({
      ...(await meetingView(meeting, { userId, isClient: true })),
      activity: await meetingActivity(meetingId),
    });
  } catch (error: any) {
    fail(res, 500, "Failed to load meeting", error?.message);
  }
});

router.post("/meetings/:id/rsvp", requireUserAuth, moduleGuard, async (req: UserRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    if (!meetingId || !RSVP.includes(req.body?.status)) return fail(res, 400, "Invalid meeting or RSVP status");

    const userId = req.user!.id;
    const { data: meeting, error: mErr } = await supabase.from("meetings").select("*").eq("id", meetingId).maybeSingle();
    if (mErr || !meeting) return fail(res, 404, "Meeting not found");

    const { data, error } = await supabase
      .from("meeting_participants")
      .upsert(
        {
          meeting_id: meetingId,
          user_id: userId,
          participant_role: "client",
          client_visible: true,
          rsvp_status: req.body.status,
          responded_at: new Date().toISOString(),
        },
        { onConflict: "meeting_id,user_id" }
      )
      .select()
      .single();

    if (error) throw error;
    await audit({ userId }, "meeting_rsvp_changed", "meeting", String(meetingId), { status: req.body.status });
    res.json(data);
  } catch (error: any) {
    fail(res, 500, "Failed to update RSVP", error?.message);
  }
});

// CORE SECURITY ENFORCEMENT: BPO PARTNERS CANNOT CREATE MEETINGS
router.post("/partner/meetings", requireUserAuth, moduleGuard, async (_req: UserRequest, res: Response) => {
  return fail(res, 403, "BPO partners are not authorized to create or schedule meetings. Meetings are scheduled by Thinkatic Administration.");
});

router.post("/meetings", requireUserAuth, moduleGuard, async (req: UserRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // CORE SECURITY RULE: Enforce that BPO partner users cannot schedule meetings via this endpoint
    const partnerCheck = await resolvePartnerForUser(userId);
    if (partnerCheck) {
      return fail(res, 403, "BPO partners are not authorized to create or schedule meetings. Meetings are scheduled by Thinkatic Administration.");
    }

    const {
      title,
      subject,
      startTime,
      startsAt,
      endTime,
      endsAt,
      description,
      agenda,
      reason,
      timezone = "UTC",
      projectId,
      meetingLink,
    } = req.body ?? {};

    const meetingTitle = (title || subject || "").trim();
    if (!meetingTitle) return fail(res, 400, "Meeting subject or title is required");

    const rawStart = startTime || startsAt;
    const rawEnd = endTime || endsAt;
    const starts = iso(rawStart);
    let ends = iso(rawEnd);

    if (!starts) return fail(res, 400, "Valid start date/time is required");
    if (!ends) {
      // Default to 1 hour duration
      ends = new Date(new Date(starts).getTime() + 60 * 60 * 1000).toISOString();
    }
    if (new Date(ends) <= new Date(starts)) {
      return fail(res, 400, "End time must be after start time");
    }

    // Resolve or anchor project for meeting (FK constraint in meetings table)
    let targetProjectId = id(projectId);
    if (targetProjectId) {
      const proj = await projectById(targetProjectId);
      if (!proj || proj.client_id !== userId) {
        targetProjectId = null;
      }
    }

    if (!targetProjectId) {
      // Find client's first existing project
      const { data: userProjects } = await supabase
        .from("projects")
        .select("id")
        .eq("client_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (userProjects && userProjects.length > 0) {
        targetProjectId = userProjects[0].id;
      } else {
        // Create an onboarding consultation project for the client so meetings can be anchored
        const { data: newProj, error: projErr } = await supabase
          .from("projects")
          .insert({
            client_id: userId,
            name: "Client Consultation & Alignment",
            description: "General enterprise consultation and project alignment session",
            vertical: "Customer Support",
            status: "planning",
            required_seats: 1,
          })
          .select("id")
          .single();

        if (projErr) throw projErr;
        targetProjectId = newProj.id;
      }
    }

    const meetingAgenda = (agenda || description || reason || "").trim();
    const meetingMeta = {
      audienceType: "client",
      targetClientIds: [userId],
      meetingType: "client_meeting",
      scope: targetProjectId ? "project" : "general",
      meetingLink: meetingLink || "",
      reason: meetingAgenda,
    };

    // Insert into meetings table
    const { data: meeting, error: meetErr } = await supabase
      .from("meetings")
      .insert({
        client_id: userId,
        project_id: targetProjectId,
        title: meetingTitle,
        starts_at: starts,
        ends_at: ends,
        timezone: validTimezone(timezone) ? timezone : "UTC",
        agenda: meetingAgenda,
        description: JSON.stringify(meetingMeta),
        status: "scheduled",
        created_by_user_id: userId,
        location: meetingLink || "Thinkatic Executive Video Bridge",
      })
      .select()
      .single();

    if (meetErr) throw meetErr;

    // Add participant
    await supabase.from("meeting_participants").insert({
      meeting_id: meeting.id,
      user_id: userId,
      participant_role: "client",
      rsvp_status: "accepted",
      client_visible: true,
      responded_at: new Date().toISOString(),
    });

    // Also record in meeting_requests for audit & history
    await supabase.from("meeting_requests").insert({
      client_id: userId,
      project_id: targetProjectId,
      subject: meetingTitle,
      preferred_starts_at: starts,
      preferred_ends_at: ends,
      timezone: validTimezone(timezone) ? timezone : "UTC",
      reason: meetingAgenda || "Client requested consultation",
      status: "scheduled",
      meeting_id: meeting.id,
    });

    await createReminders(meeting);

    // Real persistent admin notification
    await notifyAdmins(
      "meeting_requested",
      "New Client Meeting Scheduled",
      `${meetingTitle} (${new Date(starts).toLocaleString()})`,
      String(meeting.id)
    );

    // Audit log
    await audit({ userId }, "meeting_requested", "meeting", String(meeting.id), {
      title: meetingTitle,
      startsAt: starts,
      endsAt: ends,
      projectId: targetProjectId,
    });

    const view = await meetingView(meeting, { userId, isClient: true });
    return res.status(201).json(view);
  } catch (error: any) {
    fail(res, 500, "Failed to schedule meeting", error?.message);
  }
});

router.post("/meeting-requests", requireUserAuth, moduleGuard, async (req: UserRequest, res: Response) => {
  try {
    const { projectId, subject, preferredStartsAt, preferredEndsAt, timezone = "UTC", reason } = req.body ?? {};
    const project = id(projectId) ? await projectById(id(projectId)!) : null;
    const starts = iso(preferredStartsAt);
    const ends = iso(preferredEndsAt);
    if (!project) return fail(res, 403, "Request must belong to a valid project");
    if (!subject?.trim() || !starts || !ends) return fail(res, 400, "Valid subject, preferred start and end time are required");
    if (new Date(ends) <= new Date(starts)) return fail(res, 400, "Preferred end time must be after start time");
    if (!validTimezone(timezone)) return fail(res, 422, "Invalid timezone identifier");
    if (!reason?.trim()) return fail(res, 400, "A reason for the meeting request is required");

    const { data, error } = await supabase.from("meeting_requests").insert({
      client_id: req.user!.id,
      project_id: project.id,
      subject: subject.trim(),
      preferred_starts_at: starts,
      preferred_ends_at: ends,
      timezone,
      reason: reason.trim(),
      status: "requested",
    }).select().single();

    if (error) throw error;
    await notifyAdmins("meeting_requested", "New meeting request", `${project.name}: ${data.subject}`, String(data.id));
    await audit({ userId: req.user!.id }, "meeting_requested", "meeting_request", String(data.id));
    res.status(201).json(data);
  } catch (error: any) {
    fail(res, 500, "Failed to request meeting", error?.message);
  }
});

router.get("/meeting-requests", requireUserAuth, moduleGuard, async (req: UserRequest, res: Response) => {
  try {
    const { data, error } = await supabase.from("meeting_requests").select("*").eq("client_id", req.user!.id).order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    fail(res, 500, "Failed to load meeting requests", error?.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. MEETING NOTES & ACTION ITEMS (EXISTING COMPATIBILITY)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/admin/meetings/:id/notes", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    const { body, noteType = "summary", clientVisible = false, partnerVisible = false } = req.body ?? {};
    if (!meetingId || !body?.trim() || !NOTE_TYPES.includes(noteType)) return fail(res, 400, "Valid note fields are required");

    const { data: meeting } = await supabase.from("meetings").select("id,client_id").eq("id", meetingId).maybeSingle();
    if (!meeting) return fail(res, 404, "Meeting not found");

    const { data, error } = await supabase.from("meeting_notes").insert({
      meeting_id: meetingId,
      author_admin_id: req.admin!.id,
      note_type: noteType,
      body: body.trim(),
      client_visible: Boolean(clientVisible),
      partner_visible: Boolean(partnerVisible),
    }).select().single();

    if (error) throw error;
    await audit({ adminId: req.admin!.id }, "meeting_note_created", "meeting", String(meetingId), { noteId: data.id });
    if (Boolean(clientVisible) && meeting.client_id) {
      await notifyUser(meeting.client_id, "meeting_note_added", "New meeting note", `A note was added to your meeting`, String(meetingId));
    }
    res.status(201).json(data);
  } catch (error: any) {
    fail(res, 500, "Failed to create meeting note", error?.message);
  }
});

router.post("/admin/meetings/:id/action-items", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const meetingId = id(req.params.id);
    const { title, description, projectId, assignedUserId, assignedAdminId, dueDate, priority = "medium" } = req.body ?? {};
    if (!meetingId || !title?.trim() || !PRIORITIES.includes(priority)) return fail(res, 400, "Valid action item fields are required");

    const { data: meeting } = await supabase.from("meetings").select("project_id,client_id,title").eq("id", meetingId).maybeSingle();
    if (!meeting) return fail(res, 404, "Meeting not found");

    const resolvedProjectId = id(projectId) || meeting.project_id;
    if (!resolvedProjectId) return fail(res, 400, "Project ID is required for action items");

    const { data, error } = await supabase.from("meeting_action_items").insert({
      meeting_id: meetingId,
      project_id: resolvedProjectId,
      assigned_user_id: assignedUserId || null,
      assigned_admin_id: id(assignedAdminId),
      title: title.trim(),
      description: description || null,
      due_date: dueDate || null,
      priority,
      created_by_admin_id: req.admin!.id,
    }).select().single();

    if (error) throw error;
    if (assignedUserId) await notifyUser(assignedUserId, "meeting_action_item_assigned", "Meeting action item assigned", data.title, String(meetingId));
    await audit({ adminId: req.admin!.id }, "meeting_action_item_created", "meeting", String(meetingId), { actionItemId: data.id });
    res.status(201).json(data);
  } catch (error: any) {
    fail(res, 500, "Failed to create action item", error?.message);
  }
});

router.patch("/admin/action-items/:id", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const actionId = id(req.params.id);
    if (!actionId) return fail(res, 400, "Invalid action item ID");
    const { data: existing } = await supabase.from("meeting_action_items").select("*").eq("id", actionId).maybeSingle();
    if (!existing) return fail(res, 404, "Action item not found");

    const patch: Record<string, unknown> = {};
    for (const key of ["title", "description", "due_date", "priority", "status", "assigned_user_id", "assigned_admin_id"]) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }

    const { data, error } = await supabase.from("meeting_action_items").update(patch).eq("id", actionId).select().single();
    if (error) throw error;
    await audit({ adminId: req.admin!.id }, "meeting_action_item_updated", "meeting", String(existing.meeting_id), { actionItemId: actionId, changes: patch });
    res.json(data);
  } catch (error: any) {
    fail(res, 500, "Failed to update action item", error?.message);
  }
});

router.get("/admin/meeting-requests", requireAuth, moduleGuard, async (_req: AdminRequest, res: Response) => {
  try {
    const { data, error } = await supabase.from("meeting_requests").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    fail(res, 500, "Failed to load meeting requests", error?.message);
  }
});

router.patch("/admin/meeting-requests/:id", requireAuth, moduleGuard, async (req: AdminRequest, res: Response) => {
  try {
    const requestId = id(req.params.id);
    if (!requestId || !["pending_review", "rejected", "scheduled", "confirmed", "rescheduled"].includes(req.body?.status)) {
      return fail(res, 400, "Invalid request status");
    }
    const { data: existing } = await supabase.from("meeting_requests").select("*").eq("id", requestId).maybeSingle();
    if (!existing) return fail(res, 404, "Meeting request not found");

    const { data, error } = await supabase.from("meeting_requests").update({
      status: req.body.status,
      reviewed_by_admin_id: req.admin!.id,
      review_notes: req.body.reviewNotes || null,
    }).eq("id", requestId).select().single();

    if (error) throw error;
    await notifyUser(existing.client_id, "meeting_request_updated", "Meeting request updated", `${existing.subject}: ${req.body.status}`, String(requestId));
    await audit({ adminId: req.admin!.id }, "meeting_request_updated", "meeting_request", String(requestId), { status: req.body.status });
    res.json(data);
  } catch (error: any) {
    fail(res, 500, "Failed to update meeting request", error?.message);
  }
});

router.get("/admin/meetings/reminders/run", requireAuth, moduleGuard, async (_req: AdminRequest, res: Response) => {
  try {
    await dispatchDueReminders();
    res.json({ success: true });
  } catch (error: any) {
    fail(res, 500, "Failed to dispatch meeting reminders", error?.message);
  }
});

export default router;
