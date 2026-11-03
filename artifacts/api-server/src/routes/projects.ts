import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { supabase, userProfileRepository, AI_EXCLUDED_PLANS } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { requireFeature, requireUserAuth } from "./user.js";

const router: IRouter = Router();
const PROJECT_STATUSES = ["planning", "review", "ready", "ready_for_bpo", "open", "allocated", "design", "development", "ai_training", "integration", "testing", "uat", "deployment", "in_progress", "active", "completed", "on_hold", "cancelled"];
const MILESTONE_STATUSES = ["not_started", "in_progress", "at_risk", "completed", "on_hold"];
const TASK_PRIORITIES = ["low", "medium", "high", "critical"];
const TASK_STATUSES = ["todo", "in_progress", "blocked", "review", "completed"];
const DELIVERABLE_STATUSES = ["submitted", "under_review", "pending_review", "changes_requested", "resubmitted", "approved"];
const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

type UserRequest = Request & { user?: { id: string; email: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };

function fail(res: Response, status: number, message: string) {
  return res.status(status).json({ success: false, message, error: message });
}

function numberId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function safeFileName(value: unknown) {
  const name = typeof value === "string" ? value.normalize("NFKC").replace(/[\\/\0\r\n]/g, "_").trim() : "";
  return name.replace(/[^a-zA-Z0-9._ ()-]/g, "_").slice(0, 180) || "upload";
}

export function normalizeProjectStatus(rawStatus?: string): string {
  const allowed = [
    "draft", "open", "allocated", "active", "closed",
    "planning", "design", "development", "ai_training", 
    "integration", "testing", "uat", "deployment", "completed", 
    "on_hold", "cancelled"
  ];
  if (!rawStatus) return "planning";
  const s = String(rawStatus).toLowerCase().trim();
  if (allowed.includes(s)) return s;
  if (s === "ready_for_bpo" || s === "review" || s === "ready") return "open";
  if (s === "in_progress") return "active";
  if (s === "assigned") return "allocated";
  return "planning";
}

function parseUpload(input: any, maxBytes: number = MAX_DOCUMENT_BYTES) {
  if (!input || typeof input.fileName !== "string" || typeof input.data !== "string") return null;
  const encoded = input.data.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/=_-]+$/.test(encoded)) return null;
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > maxBytes) return null;
  return {
    fileName: safeFileName(input.fileName),
    contentType: input.contentType || "application/octet-stream",
    bytes,
  };
}

export function resolveProjectCoverImage(name?: string | null, slaDetails?: any): string | null {
  if (slaDetails && typeof slaDetails === "object" && slaDetails.cover_image_url) {
    return slaDetails.cover_image_url;
  }
  if (!name) return null;
  const clean = name.trim();
  if (clean.includes("Healthcare")) {
    return encodeURI("/Project Marketplace/US Healthcare Inbound Patient Support.png");
  }
  if (clean.includes("Energy") || clean.includes("Solar")) {
    return encodeURI("/Project Marketplace/UK Renewable Energy Inbound & Solar Queries.png");
  }
  if (clean.includes("FinTech") || clean.includes("Technical Helpdesk") || clean.includes("Banking")) {
    return encodeURI("/Project Marketplace/Global FinTech Tier-1 Technical Helpdesk.png");
  }
  if (clean.includes("E-Commerce") || clean.includes("Omnichannel")) {
    return encodeURI("/Project Marketplace/E-Commerce Omnichannel Customer Care.png");
  }
  if (clean.includes("AI Customer Support") || clean.includes("TEST 2147")) {
    return encodeURI("/Project Marketplace/Global AI Customer Support Operations (TEST 2147).png");
  }
  return null;
}

async function projectForUser(id: number, userId: string) {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).eq("client_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function recordActivity(projectId: number, action: string, description: string, actor: { userId?: string; adminId?: number }, metadata: Record<string, unknown> = {}) {
  const { error } = await supabase.from("project_activity").insert({ project_id: projectId, actor_user_id: actor.userId ?? null, actor_admin_id: actor.adminId ?? null, action, description, metadata });
  if (error) throw error;
}

async function notifyProjectClient(clientId: string, type: string, title: string, body: string, projectId: number) {
  const { error } = await supabase.from("notifications").insert({ recipient_user_id: clientId, type, title, body, entity_type: "project", entity_id: String(projectId) });
  if (error) throw error;
}

async function recalculateProgress(projectId: number) {
  const { data: project, error: projectError } = await supabase.from("projects").select("manual_progress_percent").eq("id", projectId).single();
  if (projectError) throw projectError;
  if (project.manual_progress_percent !== null) return Number(project.manual_progress_percent);
  const { data: milestones, error: milestoneError } = await supabase.from("project_milestones").select("completion_percent").eq("project_id", projectId);
  if (milestoneError) throw milestoneError;
  const { data: tasks, error: taskError } = await supabase.from("project_tasks").select("completion_percent").eq("project_id", projectId);
  if (taskError) throw taskError;
  const values = (milestones || []).map((item: any) => Number(item.completion_percent));
  if (!values.length) values.push(...(tasks || []).map((item: any) => Number(item.completion_percent)));
  const progress = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  await supabase.from("projects").update({ progress_percent: progress }).eq("id", projectId);
  return progress;
}

async function projectDetails(projectId: number, clientId?: string) {
  let projectQuery = supabase.from("projects").select("*").eq("id", projectId);
  if (clientId) projectQuery = projectQuery.eq("client_id", clientId);
  const { data: project, error: projectError } = await projectQuery.maybeSingle();
  if (projectError) throw projectError;
  if (!project) return null;

  const [members, milestones, tasks, deliverables, activity, meetings, docsRes, clientProfileRes, partnerRes, centreRes] = await Promise.all([
    supabase.from("project_members").select("*").eq("project_id", projectId).eq("active", true),
    supabase.from("project_milestones").select("*").eq("project_id", projectId).order("due_date", { ascending: true }),
    supabase.from("project_tasks").select("*").eq("project_id", projectId).order("due_date", { ascending: true }),
    supabase.from("project_deliverables").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("project_activity").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100),
    supabase.from("meetings").select("id,title,status,starts_at,ends_at,timezone,location").eq("project_id", projectId).order("starts_at", { ascending: true }),
    supabase.from("documents").select("*").eq("project_id", projectId).neq("status", "deleted").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, email, full_name, role, account_status, selected_plan, bpo_application_details").eq("id", project.client_id).maybeSingle(),
    project.allocated_partner_id
      ? supabase.from("bpo_partners").select("id, partner_code, name, legal_name, contact_name, email, phone, address, status").eq("id", project.allocated_partner_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    project.allocated_centre_id
      ? supabase.from("bpo_centres").select("id, partner_id, name, location, contact_name, contact_phone, capacity, status").eq("id", project.allocated_centre_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  for (const result of [members, milestones, tasks, deliverables, activity, meetings]) {
    if (result.error) throw result.error;
  }

  const rawDocs = docsRes.data || [];
  const enrichedDocs = await Promise.all(rawDocs.map(async (doc: any) => {
    let downloadUrl = null;
    try {
      const signed = await supabase.storage.from("project-documents").createSignedUrl(doc.storage_path, 3600);
      downloadUrl = signed.data?.signedUrl || null;
    } catch {}
    return {
      id: doc.id,
      fileName: doc.original_file_name || doc.file_name,
      file_name: doc.original_file_name || doc.file_name,
      original_file_name: doc.original_file_name || doc.file_name,
      fileType: doc.file_type || "file",
      file_type: doc.file_type || "file",
      mimeType: doc.mime_type,
      mime_type: doc.mime_type,
      fileSize: doc.file_size,
      file_size: doc.file_size,
      category: doc.category || "Project Document",
      description: doc.description,
      visibility: doc.visibility,
      status: doc.status,
      downloadUrl,
      download_url: downloadUrl,
      createdAt: doc.created_at,
      created_at: doc.created_at,
      uploadedByAdminId: doc.uploaded_by_admin_id,
      uploadedByUserId: doc.uploaded_by_user_id,
    };
  }));

  const clientTasks = clientId ? (tasks.data || []).filter((item: any) => item.client_visible).map((item: any) => {
    const { internal_notes: _internalNotes, ...visibleTask } = item;
    return visibleTask;
  }) : tasks.data || [];

  const clientActivity = clientId ? (activity.data || []).map((item: any) => {
    if (!item.metadata?.changes || (!Object.prototype.hasOwnProperty.call(item.metadata.changes, "internalNotes") && !Object.prototype.hasOwnProperty.call(item.metadata.changes, "internal_notes"))) return item;
    const { internalNotes: _internalNotes, internal_notes: _internalNotesDb, ...visibleChanges } = item.metadata.changes;
    return { ...item, metadata: { ...item.metadata, changes: visibleChanges } };
  }) : activity.data || [];

  const projectMembers = clientId ? (members.data || []).filter((item: any) => item.client_visible) : members.data || [];
  const projectDeliverables = clientId ? (deliverables.data || []).filter((item: any) => item.client_visible) : deliverables.data || [];
  const projectMilestones = milestones.data || [];
  const projectMeetings = clientId ? (meetings.data || []).filter((item: any) => item.status !== "cancelled") : meetings.data || [];

  const assignmentHistory = (activity.data || []).filter((act: any) =>
    ["bpo_assigned", "bpo_reassigned", "bpo_notification_sent", "project_created", "project_status_changed"].includes(act.action)
  );

  const changeRequests = (activity.data || []).filter((act: any) =>
    ["project_change_requested", "project_change_applied", "project_change_rejected"].includes(act.action)
  );

  const coverImageUrl = resolveProjectCoverImage(project.name, project.sla_details);

  const clientProfile = clientProfileRes.data ? {
    id: clientProfileRes.data.id,
    name: clientProfileRes.data.full_name || clientProfileRes.data.email?.split("@")[0] || "Client",
    fullName: clientProfileRes.data.full_name || "Client",
    email: clientProfileRes.data.email,
    company: clientProfileRes.data.bpo_application_details?.companyName || clientProfileRes.data.bpo_application_details?.company || "-",
    phone: clientProfileRes.data.bpo_application_details?.phone || "-",
    country: clientProfileRes.data.bpo_application_details?.country || "-",
    selectedPlan: clientProfileRes.data.selected_plan || null,
  } : null;

  return {
    ...project,
    cover_image_url: coverImageUrl,
    coverImageUrl,
    client: clientProfile,
    client_profile: clientProfile,
    bpo_partner: partnerRes.data,
    bpo_centre: centreRes.data,
    assigned_bpo_name: partnerRes.data?.name || (project.allocated_partner_id ? "Assigned BPO Partner" : "Pending Allocation"),
    project_members: projectMembers,
    members: projectMembers,
    project_milestones: projectMilestones,
    milestones: projectMilestones,
    project_tasks: clientTasks,
    tasks: clientTasks,
    project_deliverables: projectDeliverables,
    deliverables: projectDeliverables,
    project_activity: clientActivity,
    activity: clientActivity,
    project_meetings: projectMeetings,
    meetings: projectMeetings,
    documents: enrichedDocs,
    project_documents: enrichedDocs,
    assignment_history: assignmentHistory,
    change_requests: changeRequests,
  };
}

router.get("/projects", requireUserAuth, requireFeature("projects"), async (req: UserRequest, res) => {
  try {
    const { data, error } = await supabase.from("projects").select("*").eq("client_id", req.user!.id).order("updated_at", { ascending: false });
    if (error) throw error;

    // Enrich with BPO partner and centre details where allocated
    const projects = await Promise.all((data || []).map(async (p: any) => {
      let bpoPartner = null;
      let bpoCentre = null;
      if (p.allocated_partner_id) {
        const { data: partner } = await supabase.from("bpo_partners").select("id, partner_code, name, legal_name, contact_name, email, phone, address, status").eq("id", p.allocated_partner_id).maybeSingle();
        bpoPartner = partner;
      }
      if (p.allocated_centre_id) {
        const { data: centre } = await supabase.from("bpo_centres").select("id, partner_id, name, location, contact_name, contact_phone, capacity, status").eq("id", p.allocated_centre_id).maybeSingle();
        bpoCentre = centre;
      }
      const coverImageUrl = resolveProjectCoverImage(p.name, p.sla_details);
      return {
        ...p,
        cover_image_url: coverImageUrl,
        coverImageUrl,
        bpo_partner: bpoPartner,
        bpo_centre: bpoCentre,
        assigned_bpo_name: bpoPartner?.name || bpoCentre?.name || (p.allocated_partner_id ? "Assigned BPO Delivery Centre" : "Pending Allocation"),
      };
    }));

    return res.json(projects);
  } catch (error: any) { console.error("Client projects list error:", error?.message); return res.status(500).json({ error: "Failed to load projects" }); }
});

router.get("/projects/:id", requireUserAuth, requireFeature("projects"), async (req: UserRequest, res) => {
  try {
    const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid project ID");
    const project = await projectDetails(id, req.user!.id);
    if (!project) return fail(res, 404, "Project not found");

    let bpoPartner = null;
    let bpoCentre = null;
    if (project.allocated_partner_id) {
      const { data: partner } = await supabase.from("bpo_partners").select("id, partner_code, name, legal_name, contact_name, email, phone, address, status").eq("id", project.allocated_partner_id).maybeSingle();
      bpoPartner = partner;
    }
    if (project.allocated_centre_id) {
      const { data: centre } = await supabase.from("bpo_centres").select("id, partner_id, name, location, contact_name, contact_phone, capacity, status").eq("id", project.allocated_centre_id).maybeSingle();
      bpoCentre = centre;
    }

    return res.json({
      ...project,
      bpo_partner: bpoPartner,
      bpo_centre: bpoCentre,
      assigned_bpo_name: bpoPartner?.name || bpoCentre?.name || (project.allocated_partner_id ? "Assigned BPO Delivery Centre" : "Pending Allocation"),
    });
  } catch (error: any) { console.error("Client project detail error:", error?.message); return res.status(500).json({ error: "Failed to load project" }); }
});

router.post("/projects", requireUserAuth, requireFeature("projects"), async (req: UserRequest, res) => {
  try {
    const userId = req.user!.id;
    // 1. Fetch user profile for Plan & Account gate
    const profile = await userProfileRepository.getById(userId);
    if (!profile) return fail(res, 404, "User profile not found");

    if (profile.isActive === false) {
      return fail(res, 403, "Account is currently inactive. Please contact support.");
    }

    if (!profile.selectedPlan || AI_EXCLUDED_PLANS.has(profile.selectedPlan)) {
      return res.status(403).json({
        success: false,
        error: "Please activate an eligible paid plan before submitting a project.",
        message: "Please activate an eligible paid plan before submitting a project.",
        code: "PLAN_REQUIRED",
      });
    }

    // Verify user has an active paid plan purchase
    const { data: paidPurchases } = await supabase
      .from("purchases")
      .select("id, package_id, status")
      .eq("user_id", userId)
      .in("status", ["PAID", "paid"]);

    const hasValidPaidPurchase = (paidPurchases || []).some(
      (p: any) => !AI_EXCLUDED_PLANS.has(p.package_id)
    );

    if (!hasValidPaidPurchase) {
      return res.status(403).json({
        success: false,
        error: "An active paid plan with verified payment capture is required before submitting a project.",
        message: "An active paid plan with verified payment capture is required before submitting a project.",
        code: "PLAN_REQUIRED",
      });
    }

    // 2. Fetch KYC verification for KYC gate
    let isKycApproved = false;
    const profileKyc = String((profile as any).kycStatus || (profile as any).kyc_status || "").toLowerCase();
    if (profileKyc === "approved" || profileKyc === "verified") {
      isKycApproved = true;
    } else {
      const { data: kyc } = await supabase
        .from("kyc_verifications")
        .select("status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const kycStatus = String(kyc?.status || "").toLowerCase();
      isKycApproved = kycStatus === "approved" || kycStatus === "verified";
    }

    if (!isKycApproved) {
      return res.status(403).json({
        success: false,
        error: "Complete KYC verification before submitting a project.",
        message: "Complete KYC verification before submitting a project.",
        code: "KYC_REQUIRED",
      });
    }

    // 3. Validate project payload
    const {
      name,
      projectType = "Custom Project",
      vertical = "General",
      processType,
      process_type,
      shift = "US Shift (EST)",
      targetGeography,
      target_geography,
      requiredSeats,
      required_seats,
      budget,
      startDate,
      expectedEndDate,
      description,
      scope,
      objectives,
    } = req.body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return fail(res, 400, "Project name is required");
    }

    const insertPayload: Record<string, unknown> = {
      client_id: userId,
      name: name.trim(),
      project_type: projectType,
      vertical: vertical || "General",
      process_type: processType || process_type || "Inbound Customer Support",
      shift: shift || "US Shift (EST)",
      target_geography: targetGeography || target_geography || "United States",
      required_seats: requiredSeats ? Number(requiredSeats) : (required_seats ? Number(required_seats) : 10),
      budget: budget !== undefined && budget !== "" ? Number(budget) : null,
      start_date: startDate || null,
      expected_end_date: expectedEndDate || null,
      description: description || null,
      scope: scope || null,
      objectives: objectives || null,
      status: "planning",
      progress_percent: 0,
      technologies: [],
      client_visible_team: true,
    };

    const { data: project, error: insertErr } = await supabase
      .from("projects")
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Record activity
    await recordActivity(project.id, "project_submitted", `Project "${project.name}" was submitted by client`, { userId });

    // Notify Admins
    const { data: admins } = await supabase.from("admin_users").select("id");
    if (admins && admins.length > 0) {
      await supabase.from("notifications").insert(
        admins.map((adm: any) => ({
          recipient_admin_id: adm.id,
          type: "project_submitted",
          title: "New Client Project Submission",
          body: `Client "${profile.fullName || profile.email}" submitted project: "${project.name}"`,
          entity_type: "project",
          entity_id: String(project.id),
        }))
      );
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      actor_user_id: userId,
      action: "client_project_submit",
      entity_type: "project",
      entity_id: String(project.id),
      metadata: { name: project.name, required_seats: project.required_seats },
    });

    return res.status(201).json(project);
  } catch (error: any) {
    console.error("Client project submit error:", error?.message);
    return res.status(500).json({ error: "Failed to submit project", details: error?.message });
  }
});

router.get("/admin/projects", requireAuth, async (req: AdminRequest, res) => {
  try {
    let query = supabase.from("projects").select("*").order("updated_at", { ascending: false });
    if (typeof req.query.status === "string" && PROJECT_STATUSES.includes(req.query.status)) query = query.eq("status", req.query.status);
    if (typeof req.query.clientId === "string") query = query.eq("client_id", req.query.clientId);
    if (typeof req.query.search === "string" && req.query.search.trim()) query = query.ilike("name", `%${req.query.search.trim()}%`);
    const { data: rawProjects, error } = await query;
    if (error) throw error;

    // Fetch related client profiles, bpo partners, and bpo centres in parallel
    const clientIds = [...new Set((rawProjects || []).map((p: any) => p.client_id).filter(Boolean))];
    const partnerIds = [...new Set((rawProjects || []).map((p: any) => p.allocated_partner_id).filter(Boolean))];
    const centreIds = [...new Set((rawProjects || []).map((p: any) => p.allocated_centre_id).filter(Boolean))];

    const [clientsRes, partnersRes, centresRes, docsCountRes] = await Promise.all([
      clientIds.length > 0
        ? supabase.from("profiles").select("id, email, full_name, selected_plan, bpo_application_details").in("id", clientIds)
        : Promise.resolve({ data: [] }),
      partnerIds.length > 0
        ? supabase.from("bpo_partners").select("id, partner_code, name, email, phone, address, status").in("id", partnerIds)
        : Promise.resolve({ data: [] }),
      centreIds.length > 0
        ? supabase.from("bpo_centres").select("id, partner_id, name, location, capacity, status").in("id", centreIds)
        : Promise.resolve({ data: [] }),
      supabase.from("documents").select("project_id").neq("status", "deleted").not("project_id", "is", null),
    ]);

    const clientMap = new Map((clientsRes.data || []).map((c: any) => [c.id, c]));
    const partnerMap = new Map((partnersRes.data || []).map((p: any) => [p.id, p]));
    const centreMap = new Map((centresRes.data || []).map((c: any) => [c.id, c]));

    // Count documents per project
    const docCounts: Record<number, number> = {};
    for (const d of (docsCountRes.data || [])) {
      if (d.project_id) {
        docCounts[d.project_id] = (docCounts[d.project_id] || 0) + 1;
      }
    }

    const projects = (rawProjects || []).map((p: any) => {
      const client = p.client_id ? clientMap.get(p.client_id) : null;
      const partner = p.allocated_partner_id ? partnerMap.get(p.allocated_partner_id) : null;
      const centre = p.allocated_centre_id ? centreMap.get(p.allocated_centre_id) : null;
      const coverImageUrl = resolveProjectCoverImage(p.name, p.sla_details);

      const clientInfo = client ? {
        id: client.id,
        name: client.full_name || client.email?.split("@")[0] || "Client",
        fullName: client.full_name || "Client",
        email: client.email,
        company: client.bpo_application_details?.companyName || client.bpo_application_details?.company || "-",
        phone: client.bpo_application_details?.phone || "-",
      } : null;

      return {
        ...p,
        cover_image_url: coverImageUrl,
        coverImageUrl,
        client: clientInfo,
        client_profile: clientInfo,
        client_name: clientInfo?.name || "Client",
        client_email: clientInfo?.email || "",
        client_company: clientInfo?.company || "-",
        bpo_partner: partner,
        bpo_centre: centre,
        assigned_bpo_name: partner?.name || (p.allocated_partner_id ? "Assigned BPO Partner" : "Pending Allocation"),
        documents_count: docCounts[p.id] || 0,
      };
    });

    return res.json(projects);
  } catch (error: any) {
    console.error("Admin projects list error:", error?.message);
    return res.status(500).json({ error: "Failed to load projects" });
  }
});

router.get("/admin/projects/:id", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id);
    if (!id) return fail(res, 400, "Invalid project ID");
    const project = await projectDetails(id);
    if (!project) return fail(res, 404, "Project not found");
    return res.json(project);
  } catch (error: any) {
    console.error("Admin project detail error:", error?.message);
    return res.status(500).json({ error: "Failed to load project" });
  }
});

async function uploadCoverToStorage(storagePath: string, bytes: Buffer, contentType: string): Promise<{ url: string; storagePath: string }> {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://kajeoxbyyokauddoiumf.supabase.co").replace(/\/+$/, "");
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

  // 1. Direct Supabase Storage REST API (guarantees fast, error-free streaming in Node.js)
  try {
    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/project-documents/${storagePath}`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    });

    if (uploadRes.ok) {
      // 10 years signed URL (315360000 seconds)
      const signRes = await fetch(`${supabaseUrl}/storage/v1/object/sign/project-documents/${storagePath}`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 315360000 }),
      });

      if (signRes.ok) {
        const signData = (await signRes.json()) as { signedURL?: string } | null;
        if (signData?.signedURL) {
          const fullUrl = `${supabaseUrl}/storage/v1${signData.signedURL}`;
          return { url: fullUrl, storagePath };
        }
      }
    } else {
      const errText = await uploadRes.text();
      console.warn("Direct storage REST upload notice:", uploadRes.status, errText);
    }
  } catch (err: any) {
    console.warn("Direct storage REST upload exception:", err.message);
  }

  // 2. Fallback to supabase SDK
  const { error: uploadError } = await supabase.storage
    .from("project-documents")
    .upload(storagePath, bytes, { contentType, upsert: true });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from("project-documents")
    .createSignedUrl(storagePath, 315360000);

  if (signError || !signedData?.signedUrl) {
    throw new Error(signError?.message || "Failed to generate signed URL");
  }

  return { url: signedData.signedUrl, storagePath };
}

router.post("/admin/projects/upload-cover", requireAuth, async (req: AdminRequest, res) => {
  try {
    const rawFile = req.body?.file || req.body;
    if (!rawFile || typeof rawFile !== "object") {
      return fail(res, 400, "No image file provided");
    }

    const fileName = typeof rawFile.fileName === "string" ? rawFile.fileName : (typeof rawFile.name === "string" ? rawFile.name : "cover.jpg");
    const ext = fileName.toLowerCase().split(".").pop() || "";
    const allowedExts = ["jpg", "jpeg", "png", "webp"];
    if (!allowedExts.includes(ext)) {
      return fail(res, 400, "Invalid image format. Allowed formats: JPG, JPEG, PNG, WEBP");
    }

    const contentType = rawFile.contentType || (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimes.includes(contentType)) {
      return fail(res, 400, "Invalid image content type. Allowed formats: JPG, JPEG, PNG, WEBP");
    }

    const maxBytes = 10 * 1024 * 1024; // 10MB
    const upload = parseUpload({ fileName, data: rawFile.data || rawFile.base64, contentType }, maxBytes);
    if (!upload) {
      return fail(res, 400, "Invalid or oversized image. Maximum size is 10MB");
    }

    const safeName = safeFileName(upload.fileName);
    const storagePath = `covers/${crypto.randomUUID()}-${safeName}`;

    const { url: accessUrl } = await uploadCoverToStorage(storagePath, upload.bytes, upload.contentType);

    return res.status(200).json({
      success: true,
      url: accessUrl,
      storagePath,
      fileName: upload.fileName,
      contentType: upload.contentType,
      fileSize: upload.bytes.length,
    });
  } catch (error: any) {
    console.error("Cover image upload route error:", error?.message);
    return res.status(500).json({ error: "Failed to upload cover image", details: error?.message });
  }
});

router.post("/admin/projects", requireAuth, async (req: AdminRequest, res) => {
  try {
    const {
      clientId,
      name,
      projectType = "Custom Project",
      status = "planning",
      startDate,
      expectedEndDate,
      budget,
      description,
      scope,
      objectives,
      technologies = [],
      vertical,
      processType,
      process_type,
      targetGeography,
      target_geography,
      requiredSeats,
      required_seats,
      shift,
      payoutRate,
      payout_rate,
      billingCycle,
      billing_cycle,
      slaDetails,
      sla_details,
      coverImageUrl,
      coverImageStoragePath,
      cover_image_storage_path,
      coverImageFile,
      attachments = [],
      bpoClientId,
      bpo_client_id,
    } = req.body ?? {};

    if (typeof clientId !== "string" || !name?.trim()) return fail(res, 400, "clientId and name are required");
    if (!PROJECT_STATUSES.includes(status)) return fail(res, 400, "Invalid project status");
    const { data: client, error: clientError } = await supabase.from("profiles").select("id, full_name, email").eq("id", clientId).maybeSingle();
    if (clientError) throw clientError;
    if (!client) return fail(res, 404, "Client not found");

    const resolvedSla = typeof slaDetails === "object" && slaDetails !== null ? { ...slaDetails } : (typeof sla_details === "object" && sla_details !== null ? { ...sla_details } : {});
    if (coverImageUrl) {
      resolvedSla.cover_image_url = coverImageUrl;
    }
    if (coverImageStoragePath || cover_image_storage_path) {
      resolvedSla.cover_image_storage_path = coverImageStoragePath || cover_image_storage_path;
    }
    if (coverImageFile && typeof coverImageFile === "object") {
      const upload = parseUpload(coverImageFile, 10 * 1024 * 1024);
      if (upload) {
        const storagePath = `covers/${crypto.randomUUID()}-${safeFileName(upload.fileName)}`;
        const { error: upErr } = await supabase.storage.from("project-documents").upload(storagePath, upload.bytes, { contentType: upload.contentType, upsert: false });
        if (!upErr) {
          const { data: signed } = await supabase.storage.from("project-documents").createSignedUrl(storagePath, 315360000);
          if (signed?.signedUrl) {
            resolvedSla.cover_image_url = signed.signedUrl;
            resolvedSla.cover_image_storage_path = storagePath;
          }
        }
      }
    }

    const insertPayload: Record<string, unknown> = {
      client_id: clientId,
      name: name.trim(),
      project_type: projectType,
      status: normalizeProjectStatus(status),
      start_date: startDate || null,
      expected_end_date: expectedEndDate || null,
      budget: budget === undefined || budget === "" ? null : Number(budget),
      description: description || null,
      scope: scope || null,
      objectives: objectives || null,
      technologies: Array.isArray(technologies) ? technologies : [],
      created_by: req.admin!.id,
      vertical: vertical || "General",
      process_type: processType || process_type || "Inbound Customer Support",
      target_geography: targetGeography || target_geography || "United States",
      required_seats: requiredSeats ? Number(requiredSeats) : (required_seats ? Number(required_seats) : 10),
      shift: shift || "US Shift (EST)",
      payout_rate: payoutRate || payout_rate || "$16.00 / hr",
      billing_cycle: billingCycle || billing_cycle || "Bi-Weekly Net 15",
      sla_details: resolvedSla,
      bpo_client_id: bpoClientId || bpo_client_id || null,
    };

    const { data, error } = await supabase.from("projects").insert(insertPayload).select().single();
    if (error) throw error;

    // Process attachments if any were provided
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const item of attachments) {
        const upload = parseUpload(item);
        if (upload) {
          const storagePath = `admin/${clientId}/${data.id}/${crypto.randomUUID()}-${upload.fileName}`;
          const { error: uploadError } = await supabase.storage.from("project-documents").upload(storagePath, upload.bytes, { contentType: upload.contentType, upsert: false });
          if (!uploadError) {
            await supabase.from("documents").insert({
              file_name: upload.fileName,
              original_file_name: upload.fileName,
              file_type: upload.fileName.includes(".") ? upload.fileName.split(".").pop() : "file",
              mime_type: upload.contentType,
              file_size: upload.bytes.length,
              storage_path: storagePath,
              category: item.category || "Project Document",
              description: item.description || "Uploaded during project creation",
              project_id: data.id,
              client_id: clientId,
              uploaded_by_admin_id: req.admin!.id,
              visibility: "client_visible",
              status: "active",
            });
          }
        }
      }
    }

    await recordActivity(data.id, "project_created", `Project "${data.name}" was created by Admin`, { adminId: req.admin!.id });
    await notifyProjectClient(clientId, "project_assigned", "New project created", data.name, data.id);
    await supabase.from("audit_logs").insert({
      actor_admin_id: req.admin!.id,
      action: "project_create",
      entity_type: "project",
      entity_id: String(data.id),
      metadata: { name: data.name, clientId, status: data.status, required_seats: data.required_seats, target_geography: data.target_geography },
    });

    const fullProject = await projectDetails(data.id);
    return res.status(201).json(fullProject || data);
  } catch (error: any) {
    console.error("Admin project create error:", error?.message);
    return res.status(500).json({ error: "Failed to create project" });
  }
});

router.patch("/admin/projects/:id", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id);
    if (!id) return fail(res, 400, "Invalid project ID");
    const {
      status,
      progressPercent,
      manualProgressPercent,
      name,
      projectType,
      startDate,
      expectedEndDate,
      budget,
      description,
      scope,
      objectives,
      technologies,
      vertical,
      processType,
      process_type,
      targetGeography,
      target_geography,
      requiredSeats,
      required_seats,
      shift,
      payoutRate,
      payout_rate,
      billingCycle,
      billing_cycle,
      slaDetails,
      sla_details,
      coverImageUrl,
      coverImageStoragePath,
      cover_image_storage_path,
      coverImageFile,
      allocatedPartnerId,
      allocated_partner_id,
      allocatedCentreId,
      allocated_centre_id,
    } = req.body ?? {};

    if (status !== undefined && !PROJECT_STATUSES.includes(status)) return fail(res, 400, "Invalid project status");
    const { data: existing, error: existingError } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return fail(res, 404, "Project not found");

    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = String(name).trim();
    if (projectType !== undefined) patch.project_type = projectType;
    if (status !== undefined) patch.status = normalizeProjectStatus(status);
    if (progressPercent !== undefined || manualProgressPercent !== undefined) {
      const value = manualProgressPercent ?? progressPercent;
      if (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 100) return fail(res, 400, "Progress must be between 0 and 100");
      patch.manual_progress_percent = Number(value);
      patch.progress_percent = Number(value);
    }
    if (manualProgressPercent === null) {
      patch.manual_progress_percent = null;
      patch.progress_percent = await recalculateProgress(id);
    }
    if (startDate !== undefined) patch.start_date = startDate || null;
    if (expectedEndDate !== undefined) patch.expected_end_date = expectedEndDate || null;
    if (budget !== undefined) patch.budget = budget === "" || budget === null ? null : Number(budget);
    if (description !== undefined) patch.description = description;
    if (scope !== undefined) patch.scope = scope;
    if (objectives !== undefined) patch.objectives = objectives;
    if (technologies !== undefined) patch.technologies = Array.isArray(technologies) ? technologies : [];
    if (vertical !== undefined) patch.vertical = vertical || null;
    if (processType !== undefined || process_type !== undefined) patch.process_type = processType || process_type || null;
    if (targetGeography !== undefined || target_geography !== undefined) patch.target_geography = targetGeography || target_geography || null;
    if (requiredSeats !== undefined || required_seats !== undefined) {
      const seats = requiredSeats ?? required_seats;
      patch.required_seats = seats ? Number(seats) : null;
    }
    if (shift !== undefined) patch.shift = shift || null;
    if (payoutRate !== undefined || payout_rate !== undefined) patch.payout_rate = payoutRate || payout_rate || null;
    if (billingCycle !== undefined || billing_cycle !== undefined) patch.billing_cycle = billingCycle || billing_cycle || null;

    if (
      slaDetails !== undefined ||
      sla_details !== undefined ||
      coverImageUrl !== undefined ||
      coverImageStoragePath !== undefined ||
      cover_image_storage_path !== undefined ||
      coverImageFile !== undefined
    ) {
      const currentSla = typeof existing.sla_details === "object" && existing.sla_details !== null ? { ...existing.sla_details } : {};
      const newSla = slaDetails || sla_details || {};
      const mergedSla = { ...currentSla, ...(typeof newSla === "object" ? newSla : {}) };
      if (coverImageUrl !== undefined) {
        mergedSla.cover_image_url = coverImageUrl;
      }
      if (coverImageStoragePath !== undefined || cover_image_storage_path !== undefined) {
        mergedSla.cover_image_storage_path = coverImageStoragePath || cover_image_storage_path;
      }
      if (coverImageFile && typeof coverImageFile === "object") {
        const upload = parseUpload(coverImageFile, 10 * 1024 * 1024);
        if (upload) {
          const storagePath = `covers/${crypto.randomUUID()}-${safeFileName(upload.fileName)}`;
          const { error: upErr } = await supabase.storage.from("project-documents").upload(storagePath, upload.bytes, { contentType: upload.contentType, upsert: false });
          if (!upErr) {
            const { data: signed } = await supabase.storage.from("project-documents").createSignedUrl(storagePath, 315360000);
            if (signed?.signedUrl) {
              mergedSla.cover_image_url = signed.signedUrl;
              mergedSla.cover_image_storage_path = storagePath;
            }
          }
        }
      }
      patch.sla_details = mergedSla;
    }

    if (allocatedPartnerId !== undefined || allocated_partner_id !== undefined) {
      patch.allocated_partner_id = allocatedPartnerId || allocated_partner_id || null;
    }
    if (allocatedCentreId !== undefined || allocated_centre_id !== undefined) {
      patch.allocated_centre_id = allocatedCentreId || allocated_centre_id || null;
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from("projects").update(patch).eq("id", id).select().single();
    if (error) throw error;

    if (status && status !== existing.status) {
      await notifyProjectClient(existing.client_id, "project_status_changed", "Project status changed", `${data.name}: ${status}`, id);
    }
    if (patch.progress_percent !== undefined) {
      await notifyProjectClient(existing.client_id, "project_progress_changed", "Project progress updated", `${data.name}: ${data.progress_percent}%`, id);
    }
    await recordActivity(id, status && status !== existing.status ? "project_status_changed" : "project_updated", `Project ${data.name} was updated`, { adminId: req.admin!.id }, { changes: patch });
    await supabase.from("audit_logs").insert({
      actor_admin_id: req.admin!.id,
      action: "project_update",
      entity_type: "project",
      entity_id: String(id),
      metadata: { changes: patch },
    });

    const fullProject = await projectDetails(id);
    return res.json(fullProject || data);
  } catch (error: any) {
    console.error("Admin project update error:", error?.message);
    return res.status(500).json({ error: "Failed to update project" });
  }
});

// POST /admin/projects/:id/assign-bpo - Admin manually selects and assigns a BPO Partner
router.post("/admin/projects/:id/assign-bpo", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id);
    if (!id) return fail(res, 400, "Invalid project ID");
    const { partnerId, centreId, notes } = req.body ?? {};
    if (!partnerId) return fail(res, 400, "BPO Partner ID is required");

    const { data: project, error: projError } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (projError) throw projError;
    if (!project) return fail(res, 404, "Project not found");

    const { data: partner, error: partnerError } = await supabase.from("bpo_partners").select("id, name, partner_code, email").eq("id", partnerId).maybeSingle();
    if (partnerError) throw partnerError;
    if (!partner) return fail(res, 404, "Selected BPO Partner not found");

    let centreName = null;
    if (centreId) {
      const { data: centre } = await supabase.from("bpo_centres").select("id, name").eq("id", centreId).maybeSingle();
      centreName = centre?.name || null;
    }

    const assignedAt = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      allocated_partner_id: partnerId,
      allocated_centre_id: centreId ? Number(centreId) : null,
      allocated_at: assignedAt,
      status: "allocated",
      updated_at: assignedAt,
    };

    const { data: updated, error: updateError } = await supabase.from("projects").update(updatePayload).eq("id", id).select().single();
    if (updateError) throw updateError;

    // Record activity with full metadata
    await recordActivity(
      id,
      "bpo_assigned",
      `Project assigned and dispatched to BPO Partner: ${partner.name}${centreName ? ` (Centre: ${centreName})` : ""}`,
      { adminId: req.admin!.id },
      {
        partner_id: partnerId,
        partner_name: partner.name,
        partner_code: partner.partner_code,
        centre_id: centreId || null,
        centre_name: centreName,
        notes: notes?.trim() || null,
        assigned_at: assignedAt,
        previous_partner_id: project.allocated_partner_id || null,
      }
    );

    // Immutable audit log
    await supabase.from("audit_logs").insert({
      actor_admin_id: req.admin!.id,
      action: "project_bpo_assign",
      entity_type: "project",
      entity_id: String(id),
      metadata: {
        project_name: project.name,
        partner_id: partnerId,
        partner_name: partner.name,
        centre_id: centreId || null,
        notes: notes?.trim() || null,
      },
    });

    // Notify selected BPO Partner only (never automatic blast)
    await supabase.from("notifications").insert({
      recipient_user_id: partnerId,
      type: "new_project_assignment",
      title: `New Project Assignment: ${project.name}`,
      body: `You have been selected and assigned project "${project.name}" (PRJ-${id}). Seats: ${project.required_seats || "N/A"}, Shift: ${project.shift || "N/A"}. Please review project scope and operational deliverables.`,
      entity_type: "project",
      entity_id: String(id),
    });

    // Notify client that their project was allocated to an authorized delivery centre
    await notifyProjectClient(
      project.client_id,
      "project_assigned_to_bpo",
      "Project Assigned to Delivery Partner",
      `Your project "${project.name}" has been assigned to an authorized Thinkatic BPO delivery team and is entering operational onboarding.`,
      id
    );

    const fullProject = await projectDetails(id);
    return res.json({ success: true, project: fullProject || updated, message: `Project assigned to ${partner.name}` });
  } catch (error: any) {
    console.error("Assign BPO error:", error?.message);
    return res.status(500).json({ error: "Failed to assign BPO", details: error?.message });
  }
});

// POST /admin/projects/:id/resend-bpo-notification - Resend project assignment notification to the assigned BPO Partner
router.post("/admin/projects/:id/resend-bpo-notification", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id);
    if (!id) return fail(res, 400, "Invalid project ID");

    const { data: project, error: projError } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (projError) throw projError;
    if (!project) return fail(res, 404, "Project not found");
    if (!project.allocated_partner_id) return fail(res, 400, "No BPO Partner is currently assigned to this project");

    const { data: partner } = await supabase.from("bpo_partners").select("id, name").eq("id", project.allocated_partner_id).maybeSingle();

    await supabase.from("notifications").insert({
      recipient_user_id: project.allocated_partner_id,
      type: "project_assignment_reminder",
      title: `Project Notification Reminder: ${project.name}`,
      body: `Operational reminder: Project "${project.name}" (PRJ-${id}) is assigned to your organisation and pending review/operational start.`,
      entity_type: "project",
      entity_id: String(id),
    });

    await recordActivity(
      id,
      "bpo_notification_resent",
      `Resent project assignment notification to BPO Partner: ${partner?.name || project.allocated_partner_id}`,
      { adminId: req.admin!.id },
      { partner_id: project.allocated_partner_id, resent_at: new Date().toISOString() }
    );

    return res.json({ success: true, message: `Notification successfully resent to ${partner?.name || "BPO Partner"}` });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to resend BPO notification", details: error?.message });
  }
});

// POST /admin/projects/:id/change-bpo - Reassign to another BPO Partner with reason
router.post("/admin/projects/:id/change-bpo", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id);
    if (!id) return fail(res, 400, "Invalid project ID");
    const { newPartnerId, newCentreId, reason } = req.body ?? {};
    if (!newPartnerId) return fail(res, 400, "New BPO Partner ID is required");

    const { data: project, error: projError } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (projError) throw projError;
    if (!project) return fail(res, 404, "Project not found");

    const oldPartnerId = project.allocated_partner_id;
    const { data: oldPartner } = oldPartnerId ? await supabase.from("bpo_partners").select("id, name").eq("id", oldPartnerId).maybeSingle() : { data: null };
    const { data: newPartner, error: newPartnerError } = await supabase.from("bpo_partners").select("id, name, partner_code").eq("id", newPartnerId).maybeSingle();
    if (newPartnerError || !newPartner) return fail(res, 404, "New BPO Partner not found");

    const changedAt = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      allocated_partner_id: newPartnerId,
      allocated_centre_id: newCentreId ? Number(newCentreId) : null,
      allocated_at: changedAt,
      status: "allocated",
      updated_at: changedAt,
    };

    const { data: updated, error: updateError } = await supabase.from("projects").update(updatePayload).eq("id", id).select().single();
    if (updateError) throw updateError;

    // Record activity with previous details preserved
    await recordActivity(
      id,
      "bpo_reassigned",
      `BPO assignment transferred from ${oldPartner?.name || "Unassigned"} to ${newPartner.name}. Reason: ${reason || "Operational re-allocation"}`,
      { adminId: req.admin!.id },
      {
        previous_partner_id: oldPartnerId,
        previous_partner_name: oldPartner?.name,
        new_partner_id: newPartnerId,
        new_partner_name: newPartner.name,
        reason: reason?.trim() || "Operational re-allocation",
        changed_at: changedAt,
      }
    );

    // Audit log
    await supabase.from("audit_logs").insert({
      actor_admin_id: req.admin!.id,
      action: "project_bpo_reassign",
      entity_type: "project",
      entity_id: String(id),
      metadata: {
        previous_partner_id: oldPartnerId,
        new_partner_id: newPartnerId,
        reason: reason?.trim() || null,
      },
    });

    // Notify new BPO partner
    await supabase.from("notifications").insert({
      recipient_user_id: newPartnerId,
      type: "new_project_assignment",
      title: `Project Assigned: ${project.name}`,
      body: `Project "${project.name}" (PRJ-${id}) has been assigned to your organisation.`,
      entity_type: "project",
      entity_id: String(id),
    });

    const fullProject = await projectDetails(id);
    return res.json({ success: true, project: fullProject || updated, message: `BPO re-assigned to ${newPartner.name}` });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to reassign BPO", details: error?.message });
  }
});

// POST /admin/projects/:id/change-request - Submit a structured change request
router.post("/admin/projects/:id/change-request", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id);
    if (!id) return fail(res, 400, "Invalid project ID");
    const { requestedChanges, previousDetails, reason, requesterName } = req.body ?? {};

    const { data: project, error: projError } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (projError) throw projError;
    if (!project) return fail(res, 404, "Project not found");

    const requestedAt = new Date().toISOString();
    await recordActivity(
      id,
      "project_change_requested",
      `Project change requested by ${requesterName || "Admin"}: ${reason || "Scope / specifications adjustment"}`,
      { adminId: req.admin!.id },
      {
        requested_changes: requestedChanges || {},
        previous_details: previousDetails || {},
        reason: reason || "Adjustment",
        requester: requesterName || "Admin",
        requested_at: requestedAt,
        status: "pending_review",
      }
    );

    await supabase.from("audit_logs").insert({
      actor_admin_id: req.admin!.id,
      action: "project_change_request",
      entity_type: "project",
      entity_id: String(id),
      metadata: { requested_changes: requestedChanges, reason },
    });

    const fullProject = await projectDetails(id);
    return res.json({ success: true, project: fullProject, message: "Change request logged successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to submit change request", details: error?.message });
  }
});

// POST /admin/projects/:id/apply-change-request - Review & apply change request
router.post("/admin/projects/:id/apply-change-request", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id);
    if (!id) return fail(res, 400, "Invalid project ID");
    const { approvedChanges, approved_changes, updatedFields, adminNotes, admin_notes, reviewNotes } = req.body ?? {};
    const changes = approvedChanges || approved_changes || updatedFields;
    const notes = adminNotes || admin_notes || reviewNotes || "";
    if (!changes || typeof changes !== "object") return fail(res, 400, "Approved changes object is required");

    const { data: project, error: projError } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (projError) throw projError;
    if (!project) return fail(res, 404, "Project not found");

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (changes.requiredSeats !== undefined || changes.required_seats !== undefined) {
      patch.required_seats = Number(changes.requiredSeats ?? changes.required_seats);
    }
    if (changes.shift !== undefined) patch.shift = changes.shift;
    if (changes.budget !== undefined) patch.budget = Number(changes.budget);
    if (changes.status !== undefined) patch.status = normalizeProjectStatus(changes.status);
    if (changes.scope !== undefined) patch.scope = changes.scope;
    if (changes.description !== undefined) patch.description = changes.description;

    const { data: updated, error: updateError } = await supabase.from("projects").update(patch).eq("id", id).select().single();
    if (updateError) throw updateError;

    await recordActivity(
      id,
      "project_change_applied",
      `Project change request applied and approved: ${adminNotes || "Updates active"}`,
      { adminId: req.admin!.id },
      { approved_changes: approvedChanges, admin_notes: adminNotes, applied_at: new Date().toISOString() }
    );

    // Notify client
    await notifyProjectClient(
      project.client_id,
      "project_change_applied",
      "Project Change Request Approved & Applied",
      `Admin has reviewed and applied updates to your project "${project.name}". Review the latest specifications.`,
      id
    );

    const fullProject = await projectDetails(id);
    return res.json({ success: true, project: fullProject || updated, message: "Changes applied and client notified" });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to apply change request", details: error?.message });
  }
});

// POST /admin/projects/:id/documents - Attach file(s) to project
router.post("/admin/projects/:id/documents", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id);
    if (!id) return fail(res, 400, "Invalid project ID");
    const { file, category = "Project Document", description, visibility = "client_visible" } = req.body ?? {};

    const { data: project, error: projError } = await supabase.from("projects").select("id, client_id, name").eq("id", id).maybeSingle();
    if (projError) throw projError;
    if (!project) return fail(res, 404, "Project not found");

    const upload = parseUpload(file);
    if (!upload) return fail(res, 400, "Invalid or oversized file");

    const storagePath = `admin/${project.client_id}/${project.id}/${crypto.randomUUID()}-${upload.fileName}`;
    const { error: uploadError } = await supabase.storage.from("project-documents").upload(storagePath, upload.bytes, { contentType: upload.contentType, upsert: false });
    if (uploadError) throw uploadError;

    const { data: doc, error: docError } = await supabase.from("documents").insert({
      file_name: upload.fileName,
      original_file_name: upload.fileName,
      file_type: upload.fileName.includes(".") ? upload.fileName.split(".").pop() : "file",
      mime_type: upload.contentType,
      file_size: upload.bytes.length,
      storage_path: storagePath,
      category,
      description: typeof description === "string" ? description.trim() : null,
      project_id: project.id,
      client_id: project.client_id,
      uploaded_by_admin_id: req.admin!.id,
      visibility,
      status: "active",
    }).select().single();
    if (docError) throw docError;

    await recordActivity(
      project.id,
      "document_uploaded",
      `Document "${upload.fileName}" attached to project by Admin`,
      { adminId: req.admin!.id },
      { document_id: doc.id, file_name: upload.fileName, file_size: upload.bytes.length }
    );

    // Get signed URL for immediate view
    let downloadUrl = null;
    try {
      const signed = await supabase.storage.from("project-documents").createSignedUrl(storagePath, 3600);
      downloadUrl = signed.data?.signedUrl || null;
    } catch {}

    return res.status(201).json({
      success: true,
      document: {
        ...doc,
        downloadUrl,
        download_url: downloadUrl,
      },
    });
  } catch (error: any) {
    console.error("Project document upload error:", error?.message);
    return res.status(500).json({ error: "Failed to upload project document", details: error?.message });
  }
});

// GET /admin/projects/:id/documents - List all documents attached to project
router.get("/admin/projects/:id/documents", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id);
    if (!id) return fail(res, 400, "Invalid project ID");

    const { data: docs, error } = await supabase
      .from("documents")
      .select("*")
      .eq("project_id", id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const enriched = await Promise.all((docs || []).map(async (doc: any) => {
      let downloadUrl = null;
      try {
        const signed = await supabase.storage.from("project-documents").createSignedUrl(doc.storage_path, 3600);
        downloadUrl = signed.data?.signedUrl || null;
      } catch {}
      return {
        id: doc.id,
        fileName: doc.original_file_name || doc.file_name,
        fileType: doc.file_type || "file",
        mimeType: doc.mime_type,
        fileSize: doc.file_size,
        category: doc.category,
        description: doc.description,
        downloadUrl,
        download_url: downloadUrl,
        createdAt: doc.created_at,
      };
    }));

    return res.json(enriched);
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to load project documents", details: error?.message });
  }
});

// DELETE /admin/projects/:id/documents/:docId - Remove document from project
router.delete("/admin/projects/:id/documents/:docId", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id);
    const docId = numberId(req.params.docId);
    if (!id || !docId) return fail(res, 400, "Invalid ID");

    const { data: doc, error: docError } = await supabase.from("documents").update({ status: "deleted" }).eq("id", docId).eq("project_id", id).select().maybeSingle();
    if (docError) throw docError;
    if (!doc) return fail(res, 404, "Document not found");

    await recordActivity(
      id,
      "document_deleted",
      `Document "${doc.original_file_name || doc.file_name}" removed from project by Admin`,
      { adminId: req.admin!.id },
      { document_id: docId }
    );

    return res.json({ success: true, message: "Document removed successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to delete document", details: error?.message });
  }
});

router.post("/admin/projects/:id/cancel", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id);
    if (!id) return fail(res, 400, "Invalid project ID");
    const { reason, note } = req.body || {};
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return fail(res, 400, "Cancellation reason is required");
    }

    const { data: existing, error: findError } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (findError) throw findError;
    if (!existing) return fail(res, 404, "Project not found");

    if (existing.status === "cancelled") {
      return fail(res, 400, "Project is already cancelled");
    }

    const cancelledAt = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: "cancelled",
      updated_at: cancelledAt,
    };

    const { data: updated, error: updateError } = await supabase.from("projects").update(patch).eq("id", id).select().single();
    if (updateError) throw updateError;

    // Record activity with full preservation of metadata
    await recordActivity(
      id,
      "project_cancelled",
      `Project cancelled: ${reason.trim()}`,
      { adminId: req.admin!.id },
      {
        cancellation_reason: reason.trim(),
        note: note?.trim() || null,
        cancelled_at: cancelledAt,
        cancelled_by: req.admin!.id,
        previous_status: existing.status,
      }
    );

    // Create immutable audit log
    await supabase.from("audit_logs").insert({
      actor_admin_id: req.admin!.id,
      action: "project_cancel",
      entity_type: "project",
      entity_id: String(id),
      metadata: {
        project_name: existing.name,
        client_id: existing.client_id,
        cancellation_reason: reason.trim(),
        note: note?.trim() || null,
        cancelled_at: cancelledAt,
        cancelled_by: req.admin!.id,
      },
    });

    // Notify client securely
    await notifyProjectClient(
      existing.client_id,
      "project_cancelled",
      "Project Cancelled",
      `Project "${existing.name}" has been cancelled. Reason: ${reason.trim()}`,
      id
    );

    return res.json({ success: true, project: updated });
  } catch (error: any) {
    console.error("Admin project cancel error:", error?.message);
    return res.status(500).json({ error: "Failed to cancel project", details: error?.message });
  }
});

router.delete("/admin/projects/:id", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id);
    if (!id) return fail(res, 400, "Invalid project ID");
    const { data: existing, error: findError } = await supabase.from("projects").select("id, name, client_id").eq("id", id).maybeSingle();
    if (findError) throw findError;
    if (!existing) return fail(res, 404, "Project not found");

    // Cleanly delete child entities
    await Promise.all([
      supabase.from("project_deliverables").delete().eq("project_id", id),
      supabase.from("project_tasks").delete().eq("project_id", id),
      supabase.from("project_milestones").delete().eq("project_id", id),
      supabase.from("project_activity").delete().eq("project_id", id),
      supabase.from("project_members").delete().eq("project_id", id),
    ]);

    const { error: delError } = await supabase.from("projects").delete().eq("id", id);
    if (delError) throw delError;

    await supabase.from("audit_logs").insert({
      actor_admin_id: req.admin!.id,
      action: "project_delete",
      entity_type: "project",
      entity_id: String(id),
      metadata: { name: existing.name, clientId: existing.client_id },
    });

    return res.json({ success: true, message: `Project #${id} deleted successfully` });
  } catch (error: any) {
    console.error("Admin project delete error:", error?.message);
    return res.status(500).json({ error: "Failed to delete project" });
  }
});

router.post("/admin/projects/:id/milestones", requireAuth, async (req: AdminRequest, res) => {
  try {
    const projectId = numberId(req.params.id); if (!projectId) return fail(res, 400, "Invalid project ID");
    const { name, description, startDate, dueDate, status = "not_started", completionPercent = 0, notes } = req.body ?? {};
    if (!name?.trim() || !MILESTONE_STATUSES.includes(status)) return fail(res, 400, "Valid milestone name and status are required");
    if (!Number.isInteger(Number(completionPercent)) || Number(completionPercent) < 0 || Number(completionPercent) > 100) return fail(res, 400, "Completion must be between 0 and 100");
    const project = await supabase.from("projects").select("client_id,name").eq("id", projectId).maybeSingle();
    if (project.error) throw project.error; if (!project.data) return fail(res, 404, "Project not found");
    const { data, error } = await supabase.from("project_milestones").insert({ project_id: projectId, name: name.trim(), description: description || null, start_date: startDate || null, due_date: dueDate || null, status, completion_percent: Number(completionPercent), notes: notes || null }).select().single();
    if (error) throw error;
    await recalculateProgress(projectId); await recordActivity(projectId, "milestone_created", `Milestone ${data.name} was created`, { adminId: req.admin!.id }); await notifyProjectClient(project.data.client_id, "milestone_created", "New project milestone", `${project.data.name}: ${data.name}`, projectId);
    return res.status(201).json(data);
  } catch (error: any) { console.error("Milestone create error:", error?.message); return res.status(500).json({ error: "Failed to create milestone" }); }
});

router.patch("/admin/milestones/:id", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid milestone ID");
    const { name, description, startDate, dueDate, status, completionPercent, notes } = req.body ?? {};
    if (status !== undefined && !MILESTONE_STATUSES.includes(status)) return fail(res, 400, "Invalid milestone status");
    const { data: existing, error: existingError } = await supabase.from("project_milestones").select("*, projects(client_id,name)").eq("id", id).maybeSingle();
    if (existingError) throw existingError; if (!existing) return fail(res, 404, "Milestone not found");
    const patch: Record<string, unknown> = {}; if (name !== undefined) patch.name = String(name).trim(); if (description !== undefined) patch.description = description; if (startDate !== undefined) patch.start_date = startDate || null; if (dueDate !== undefined) patch.due_date = dueDate || null; if (status !== undefined) patch.status = status; if (completionPercent !== undefined) { if (Number(completionPercent) < 0 || Number(completionPercent) > 100) return fail(res, 400, "Completion must be between 0 and 100"); patch.completion_percent = Number(completionPercent); } if (notes !== undefined) patch.notes = notes;
    const { data, error } = await supabase.from("project_milestones").update(patch).eq("id", id).select().single(); if (error) throw error;
    await recalculateProgress(existing.project_id); await recordActivity(existing.project_id, "milestone_updated", `Milestone ${data.name} was updated`, { adminId: req.admin!.id }, { changes: patch }); return res.json(data);
  } catch (error: any) { console.error("Milestone update error:", error?.message); return res.status(500).json({ error: "Failed to update milestone" }); }
});

router.post("/admin/projects/:id/tasks", requireAuth, async (req: AdminRequest, res) => {
  try {
    const projectId = numberId(req.params.id); if (!projectId) return fail(res, 400, "Invalid project ID");
    const { milestoneId, name, description, assignedUserId, assignedName, priority = "medium", status = "todo", startDate, dueDate, estimatedEffort, internalNotes, clientVisible = true, completionPercent = 0 } = req.body ?? {};
    if (!name?.trim() || !TASK_PRIORITIES.includes(priority) || !TASK_STATUSES.includes(status)) return fail(res, 400, "Valid task name, priority, and status are required");
    if (!Number.isInteger(Number(completionPercent)) || Number(completionPercent) < 0 || Number(completionPercent) > 100) return fail(res, 400, "Completion must be between 0 and 100");
    const { data: project, error: projectError } = await supabase.from("projects").select("client_id,name").eq("id", projectId).maybeSingle(); if (projectError) throw projectError; if (!project) return fail(res, 404, "Project not found");
    const { data, error } = await supabase.from("project_tasks").insert({ project_id: projectId, milestone_id: numberId(milestoneId), name: name.trim(), description: description || null, assigned_user_id: assignedUserId || null, assigned_name: assignedName || null, priority, status, start_date: startDate || null, due_date: dueDate || null, estimated_effort: estimatedEffort || null, internal_notes: internalNotes || null, client_visible: Boolean(clientVisible), completion_percent: Number(completionPercent) }).select().single(); if (error) throw error;
    await recalculateProgress(projectId); await recordActivity(projectId, "task_created", `Task ${data.name} was created`, { adminId: req.admin!.id }); await notifyProjectClient(project.client_id, "project_task_created", "New project task", `${project.name}: ${data.name}`, projectId); return res.status(201).json(data);
  } catch (error: any) { console.error("Task create error:", error?.message); return res.status(500).json({ error: "Failed to create task" }); }
});

router.patch("/admin/tasks/:id", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid task ID");
    const { name, description, milestoneId, assignedUserId, assignedName, priority, status, startDate, dueDate, estimatedEffort, internalNotes, clientVisible, completionPercent } = req.body ?? {};
    if (priority !== undefined && !TASK_PRIORITIES.includes(priority)) return fail(res, 400, "Invalid task priority"); if (status !== undefined && !TASK_STATUSES.includes(status)) return fail(res, 400, "Invalid task status");
    const { data: existing, error: existingError } = await supabase.from("project_tasks").select("*, projects(client_id,name)").eq("id", id).maybeSingle(); if (existingError) throw existingError; if (!existing) return fail(res, 404, "Task not found");
    const patch: Record<string, unknown> = {}; if (name !== undefined) patch.name = String(name).trim(); if (description !== undefined) patch.description = description; if (milestoneId !== undefined) patch.milestone_id = numberId(milestoneId); if (assignedUserId !== undefined) patch.assigned_user_id = assignedUserId || null; if (assignedName !== undefined) patch.assigned_name = assignedName; if (priority !== undefined) patch.priority = priority; if (status !== undefined) patch.status = status; if (startDate !== undefined) patch.start_date = startDate || null; if (dueDate !== undefined) patch.due_date = dueDate || null; if (estimatedEffort !== undefined) patch.estimated_effort = estimatedEffort; if (internalNotes !== undefined) patch.internal_notes = internalNotes; if (clientVisible !== undefined) patch.client_visible = Boolean(clientVisible); if (completionPercent !== undefined) { if (Number(completionPercent) < 0 || Number(completionPercent) > 100) return fail(res, 400, "Completion must be between 0 and 100"); patch.completion_percent = Number(completionPercent); }
    const { data, error } = await supabase.from("project_tasks").update(patch).eq("id", id).select().single(); if (error) throw error; await recalculateProgress(existing.project_id); await recordActivity(existing.project_id, status ? "task_status_changed" : "task_updated", `Task ${data.name} was updated`, { adminId: req.admin!.id }, { changes: patch }); if (status === "completed") await notifyProjectClient(existing.projects.client_id, "project_task_completed", "Project task completed", `${existing.projects.name}: ${data.name}`, existing.project_id); return res.json(data);
  } catch (error: any) { console.error("Task update error:", error?.message); return res.status(500).json({ error: "Failed to update task" }); }
});

router.post("/admin/projects/:id/deliverables", requireAuth, async (req: AdminRequest, res) => {
  try {
    const projectId = numberId(req.params.id); if (!projectId) return fail(res, 400, "Invalid project ID"); const { milestoneId, name, description, filePath, status = "submitted", clientVisible = true } = req.body ?? {}; if (!name?.trim() || !DELIVERABLE_STATUSES.includes(status)) return fail(res, 400, "Valid deliverable name and status are required"); const { data: project, error: projectError } = await supabase.from("projects").select("client_id,name").eq("id", projectId).maybeSingle(); if (projectError) throw projectError; if (!project) return fail(res, 404, "Project not found"); const { data, error } = await supabase.from("project_deliverables").insert({ project_id: projectId, milestone_id: numberId(milestoneId), name: name.trim(), description: description || null, file_path: filePath || null, status, client_visible: Boolean(clientVisible) }).select().single(); if (error) throw error; await recordActivity(projectId, "deliverable_submitted", `Deliverable ${data.name} was submitted`, { adminId: req.admin!.id }); await notifyProjectClient(project.client_id, "deliverable_submitted", "New project deliverable", `${project.name}: ${data.name}`, projectId); return res.status(201).json(data);
  } catch (error: any) { console.error("Deliverable create error:", error?.message); return res.status(500).json({ error: "Failed to create deliverable" }); }
});

router.patch("/admin/deliverables/:id", requireAuth, async (req: AdminRequest, res) => {
  try {
    const id = numberId(req.params.id); if (!id) return fail(res, 400, "Invalid deliverable ID"); const { name, description, filePath, status, reviewNotes, clientVisible } = req.body ?? {}; if (status !== undefined && !DELIVERABLE_STATUSES.includes(status)) return fail(res, 400, "Invalid deliverable status"); const { data: existing, error: existingError } = await supabase.from("project_deliverables").select("*, projects(client_id,name)").eq("id", id).maybeSingle(); if (existingError) throw existingError; if (!existing) return fail(res, 404, "Deliverable not found"); const patch: Record<string, unknown> = {}; if (name !== undefined) patch.name = String(name).trim(); if (description !== undefined) patch.description = description; if (filePath !== undefined) patch.file_path = filePath; if (status !== undefined) { patch.status = status; patch.reviewed_at = ["approved", "changes_requested"].includes(status) ? new Date().toISOString() : null; } if (reviewNotes !== undefined) patch.review_notes = reviewNotes; if (clientVisible !== undefined) patch.client_visible = Boolean(clientVisible); const { data, error } = await supabase.from("project_deliverables").update(patch).eq("id", id).select().single(); if (error) throw error; await recordActivity(existing.project_id, status === "approved" ? "deliverable_approved" : status === "changes_requested" ? "deliverable_changes_requested" : "deliverable_updated", `Deliverable ${data.name} was updated`, { adminId: req.admin!.id }, { changes: patch }); if (status) await notifyProjectClient(existing.projects.client_id, status === "approved" ? "deliverable_approved" : "deliverable_updated", "Deliverable status changed", `${existing.projects.name}: ${data.name}`, existing.project_id); return res.json(data);
  } catch (error: any) { console.error("Deliverable update error:", error?.message); return res.status(500).json({ error: "Failed to update deliverable" }); }
});

export default router;
