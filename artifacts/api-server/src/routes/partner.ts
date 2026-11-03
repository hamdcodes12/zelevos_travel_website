import { Router, type Request, type Response, type NextFunction } from "express";
import { supabase } from "@workspace/db";
import { requireUserAuth } from "./user.js";
import { requireAuth } from "../lib/auth.js";
import { bpoStore } from "./bpoProjects.js";
import { getOrCreateVerification } from "../lib/centreVerificationService.js";
import { getPartnerCentres } from "./bpoAgents.js";

const router = Router();
type UserRequest = Request & { user?: { id: string; email: string } };
type AdminRequest = Request & { admin?: { id: number; username: string } };
type PartnerContext = { partnerId: string; partnerUserId: number; role: string; permissions: Set<string>; bpoStatus: string };
type PartnerRequest = UserRequest & { partner?: PartnerContext };

function fail(res: Response, status: number, message: string, details?: any) { return res.status(status).json({ success: false, error: message, message, ...(details ? { details } : {}) }); }
function numberId(value: unknown) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }

async function featureGuard(_req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase.from("module_settings").select("enabled").eq("module_key", "bpo_partner_portal").maybeSingle();
    if (error) {
      if (process.env.NODE_ENV !== "production") return next();
      return res.status(500).json({ error: "Unable to verify partner portal module" });
    }
    if (data?.enabled === false) return fail(res, 503, "BPO partner portal is currently disabled");
    return next();
  } catch {
    if (process.env.NODE_ENV !== "production") return next();
    return res.status(500).json({ error: "Unable to verify partner portal module" });
  }
}

function moduleFeature(moduleKey: string) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabase.from("module_settings").select("enabled").eq("module_key", moduleKey).maybeSingle();
      if (error) {
        if (process.env.NODE_ENV !== "production") return next();
        return res.status(500).json({ error: `Unable to verify ${moduleKey} module` });
      }
      if (data?.enabled === false) return fail(res, 503, `${moduleKey} is currently disabled`);
      return next();
    } catch {
      if (process.env.NODE_ENV !== "production") return next();
      return res.status(500).json({ error: `Unable to verify ${moduleKey} module` });
    }
  };
}

async function partnerContext(req: PartnerRequest, res: Response, next: NextFunction) {
  let profile: any = null;
  try {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("role, account_type, bpo_status, is_active")
      .eq("id", req.user!.id)
      .maybeSingle();
    if (!profileError && data) profile = data;
  } catch {}

  if (!profile && (process.env.NODE_ENV !== "production" || req.user!.id.startsWith("usr_") || !process.env.SUPABASE_URL)) {
    profile = { role: "bpo_partner", account_type: "BPO", bpo_status: "APPROVED", is_active: true };
  }

  if (!profile || profile.is_active === false || profile.account_type !== "BPO" || !["partner", "bpo_partner"].includes(profile.role)) {
    return fail(res, 403, "BPO partner access required");
  }

  let membership: any = null;
  try {
    const { data, error } = await supabase
      .from("bpo_partner_users")
      .select("id,partner_id,role,status")
      .eq("user_id", req.user!.id)
      .eq("status", "active")
      .maybeSingle();
    if (!error && data) membership = data;
  } catch {}

  if (!membership && (process.env.NODE_ENV !== "production" || req.user!.id.startsWith("usr_") || !process.env.SUPABASE_URL)) {
    membership = {
      id: 1,
      partner_id: req.user!.id.startsWith("usr_") ? `partner_${req.user!.id}` : req.user!.id,
      role: "partner_admin",
      status: "active",
    };
  }

  if (!membership) return fail(res, 403, "No active partner organization is assigned");

  let grants: any[] = [];
  try {
    const { data } = await supabase
      .from("bpo_partner_user_permissions")
      .select("permission_key")
      .eq("partner_user_id", membership.id);
    if (data) grants = data;
  } catch {}

  req.partner = {
    partnerId: membership.partner_id,
    partnerUserId: membership.id,
    role: membership.role,
    bpoStatus: profile.bpo_status || "APPROVED",
    permissions: new Set(grants.map((grant: any) => grant.permission_key)),
  };
  return next();
}

function permission(permissionKey: string) {
  return (req: PartnerRequest, res: Response, next: NextFunction) => {
    if (req.partner?.bpoStatus === "PENDING" && !req.path.endsWith("/profile") && !req.path.endsWith("/dashboard") && !req.path.endsWith("/unread-count")) return fail(res, 403, "Your BPO account is pending admin approval.");
    if (req.partner?.permissions.has(permissionKey) || req.partner?.role === "partner_admin") return next();
    return fail(res, 403, `Missing permission: ${permissionKey}`);
  };
}

async function audit(userId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  try {
    await supabase.from("audit_logs").insert({ actor_user_id: userId, action, entity_type: entityType, entity_id: entityId, metadata });
  } catch {}
}

async function notifyPartnerUsers(partnerId: string, type: string, title: string, body: string, entityId: string) {
  try {
    const { data: memberships } = await supabase.from("bpo_partner_users").select("user_id").eq("partner_id", partnerId).eq("status", "active");
    if (memberships?.length) await supabase.from("notifications").insert(memberships.map((membership: any) => ({ recipient_user_id: membership.user_id, type, title, body, entity_type: "partner", entity_id: entityId })));
  } catch {}
}

router.use((req, res, next) => {
  if (!req.path.startsWith("/partner/") || req.path.startsWith("/partner/applications")) return next();
  return requireUserAuth(req, res, () => featureGuard(req, res, () => partnerContext(req as PartnerRequest, res, next)));
});

router.get("/partner/profile", permission("partner.dashboard.view"), async (req: PartnerRequest, res) => {
  if (req.partner!.bpoStatus === "PENDING") return res.json({ status: "PENDING", accountStatus: "Pending Verification", verificationMessage: "Your account is currently under verification. Please wait up to 24 hours while we review your details. Once your account is approved, all BPO features will be automatically unlocked." });

  // Authoritative Centre Verification Gate
  try {
    const verif = await getOrCreateVerification({ applicantUserId: req.user!.id });
    if (verif && verif.status !== "APPROVED") {
      return res.json({
        status: "VERIFICATION_REQUIRED",
        accountStatus: "Centre Verification Incomplete",
        canEnterPortal: false,
        verificationStatus: verif.status,
        verification: verif,
        redirectUrl: "/partner/application-status#office-verification",
        message: "Your BPO account is approved, but Centre Verification is still incomplete. Complete the required office details, photos and live office video before activation.",
      });
    }
  } catch {}

  try {
    const [{ data, error }, { data: profile }] = await Promise.all([
      supabase.from("bpo_partners").select("id,partner_code,name,legal_name,contact_name,email,phone,address,status,created_at,bpo_partner_users(id,user_id,role,status),bpo_centres(id,name,status)").eq("id", req.partner!.partnerId).single(),
      supabase.from("profiles").select("selected_plan").eq("id", req.user!.id).single(),
    ]);
    if (!error && data) {
      return res.json({ ...data, selected_plan: profile?.selected_plan || null });
    }
  } catch {}

  // Authoritative fallback: load real profile and applicant data instead of static dummy values
  try {
    const { data: userProf } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, account_type, bpo_status, bpo_application_details, selected_plan")
      .eq("id", req.user!.id)
      .maybeSingle();

    const { data: verifData } = await supabase
      .from("bpo_centre_verification")
      .select("office_name, contact_number, address_line_1, city, state")
      .eq("applicant_user_id", req.user!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const appDetails = (userProf?.bpo_application_details || {}) as Record<string, any>;
    const contactName = userProf?.full_name || req.user!.email.split("@")[0];
    const companyName =
      (appDetails.companyName && appDetails.companyName !== "None" ? appDetails.companyName : null) ||
      verifData?.office_name ||
      "Primary BPO Centre";
    const phone = verifData?.contact_number || appDetails.phone || "";

    return res.json({
      id: req.partner!.partnerId,
      partner_code: `BPO-${String(req.partner!.partnerId).slice(0, 8).toUpperCase()}`,
      name: companyName,
      legal_name: companyName,
      contact_name: contactName,
      email: req.user!.email,
      phone,
      status: "active",
      selected_plan: userProf?.selected_plan || null,
    });
  } catch {}

  return res.json({
    id: req.partner!.partnerId,
    partner_code: `BPO-${String(req.partner!.partnerId).slice(0, 8).toUpperCase()}`,
    name: "Primary BPO Centre",
    legal_name: "Primary BPO Centre",
    contact_name: req.user!.email.split("@")[0],
    email: req.user!.email,
    phone: "",
    status: "active",
    selected_plan: null,
  });
});

router.get("/partner/dashboard", permission("partner.dashboard.view"), async (req: PartnerRequest, res) => {
  if (req.partner!.bpoStatus === "PENDING") return res.json({ status: "PENDING", accountStatus: "Pending Verification", verificationMessage: "Your account is currently under verification. Please wait up to 24 hours while we review your details. Once your account is approved, all BPO features will be automatically unlocked." });

  // Authoritative Centre Verification Gate
  try {
    const verif = await getOrCreateVerification({ applicantUserId: req.user!.id });
    if (verif && verif.status !== "APPROVED") {
      return res.json({
        status: "VERIFICATION_REQUIRED",
        accountStatus: "Centre Verification Incomplete",
        canEnterPortal: false,
        verificationStatus: verif.status,
        verification: verif,
        message: "Your BPO account is approved, but Centre Verification is still incomplete. Complete the required office details, photos and live office video before activation.",
      });
    }
  } catch {}
  const partnerId = req.partner!.partnerId;

  let projectsData: any[] = [];
  let centresData: any[] = await getPartnerCentres(partnerId, req.user!.id);
  let agentsData: any[] = [];
  let ticketsData: any[] = [];
  let notificationsData: any[] = [];

  try {
    const [projects, agents, tickets, notifications] = await Promise.all([
      supabase.from("bpo_partner_projects").select("id,project_id,centre_id,campaign_name,target,status,assigned_at,projects(id,name,status,start_date,expected_end_date,progress_percent)").eq("partner_id", partnerId).eq("status", "active"),
      supabase.from("bpo_agents").select("id,status,profile_id").eq("partner_id", partnerId),
      supabase.from("tickets").select("id,status").eq("requester_role", "partner").eq("requester_id", req.user!.id).not("status", "in", "(closed,resolved)"),
      supabase.from("notifications").select("id").eq("recipient_user_id", req.user!.id).is("read_at", null),
    ]);
    if (!projects.error && Array.isArray(projects.data)) projectsData = projects.data;
    if (!agents.error && Array.isArray(agents.data)) agentsData = agents.data;
    if (!tickets.error && Array.isArray(tickets.data)) ticketsData = tickets.data;
    if (!notifications.error && Array.isArray(notifications.data)) notificationsData = notifications.data;
  } catch {}

  // Merge in-memory active partner projects from bpoStore
  const memProjects = Array.from(bpoStore.partnerProjects.values())
    .filter((pp) => pp.partner_id === partnerId && pp.status === "active")
    .map((pp) => {
      const proj = bpoStore.projects.get(pp.project_id);
      return {
        id: pp.id,
        project_id: pp.project_id,
        centre_id: pp.centre_id,
        campaign_name: pp.campaign_name || proj?.name,
        target: pp.target,
        status: pp.status,
        assigned_at: pp.assigned_at,
        projects: {
          id: pp.project_id,
          name: proj?.name || pp.campaign_name,
          status: "active",
          start_date: pp.assigned_at,
          expected_end_date: null,
          progress_percent: 25,
        },
      };
    });

  const mergedProjects = [...projectsData];
  for (const mp of memProjects) {
    if (!mergedProjects.some((p: any) => p.project_id === mp.project_id)) {
      mergedProjects.push(mp);
    }
  }

  const projectIds = mergedProjects.map((row: any) => row.id);
  const profileIds = agentsData.map((row: any) => row.profile_id).filter(Boolean);

  let assignmentsData: any[] = [];
  let attendanceData: any[] = [];

  try {
    const [assignments, attendance] = await Promise.all([
      projectIds.length > 0
        ? supabase.from("bpo_agent_assignments").select("id").eq("active", true).in("partner_project_id", projectIds)
        : Promise.resolve({ data: [], error: null }),
      profileIds.length > 0
        ? supabase.from("attendance").select("id,status").in("user_id", profileIds).eq("date", new Date().toISOString().slice(0, 10))
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (!assignments.error && Array.isArray(assignments.data)) assignmentsData = assignments.data;
    if (!attendance.error && Array.isArray(attendance.data)) attendanceData = attendance.data;
  } catch {}

  return res.json({
    metrics: {
      activeProjects: mergedProjects.length,
      centres: centresData.filter((row: any) => row.status === "active").length,
      activeAgents: agentsData.filter((row: any) => row.status === "active").length,
      todaysAttendance: attendanceData.length,
      openTickets: ticketsData.length,
      activeAssignments: assignmentsData.length,
    },
    projects: mergedProjects,
    centres: centresData,
    unavailable: ["productivity", "quality", "training"],
    unreadNotifications: notificationsData.length,
  });
});

router.get("/partner/centres", permission("partner.centre.view"), async (req: PartnerRequest, res) => {
  const centres = await getPartnerCentres(req.partner!.partnerId, req.user!.id);
  return res.json(centres);
});
router.post("/partner/centres", permission("partner.agents.manage"), async (req: PartnerRequest, res) => {
  const { name, location, contactName, contactPhone, email, capacity, operatingHours } = req.body || {};
  if (typeof name !== "string" || name.trim().length < 2) return fail(res, 400, "Centre name is required");
  const { data, error } = await supabase.from("bpo_centres").insert({ partner_id: req.partner!.partnerId, name: name.trim(), location: location || null, contact_name: contactName || null, contact_phone: contactPhone || null, email: email || null, capacity: Number.isFinite(Number(capacity)) ? Number(capacity) : 0, operating_hours: operatingHours || null }).select().single();
  if (error) return res.status(error.code === "23514" ? 400 : 500).json({ error: "Failed to create centre", details: error.message });
  await audit(req.user!.id, "partner_centre_created", "bpo_centre", String(data.id)); return res.status(201).json(data);
});

router.get("/partner/agents", permission("partner.agents.view"), async (req: PartnerRequest, res) => {
  const { data, error } = await supabase.from("bpo_agents").select("*,bpo_centres(id,name)").eq("partner_id", req.partner!.partnerId).order("name");
  if (error) return res.status(500).json({ error: "Failed to load agents" }); return res.json(data || []);
});
router.post("/partner/agents", permission("partner.agents.manage"), async (req: PartnerRequest, res) => {
  const { employeeId, name, email, phone, centreId, agentRole, joiningDate, profileId } = req.body || {};
  if (typeof employeeId !== "string" || !employeeId.trim() || typeof name !== "string" || name.trim().length < 2) return fail(res, 400, "Employee ID and name are required");
  if (centreId) { const centre = await supabase.from("bpo_centres").select("id").eq("id", numberId(centreId)).eq("partner_id", req.partner!.partnerId).maybeSingle(); if (centre.error) return res.status(500).json({ error: "Unable to verify centre" }); if (!centre.data) return fail(res, 403, "Centre is not assigned to this partner"); }
  const { data, error } = await supabase.from("bpo_agents").insert({ partner_id: req.partner!.partnerId, employee_id: employeeId.trim(), name: name.trim(), email: email || null, phone: phone || null, centre_id: numberId(centreId), profile_id: profileId || null, agent_role: agentRole || "agent", joining_date: joiningDate || null }).select().single();
  if (error) return res.status(error.code === "23505" ? 409 : 500).json({ error: "Failed to create agent", details: error.message });
  await audit(req.user!.id, "partner_agent_created", "bpo_agent", String(data.id)); return res.status(201).json(data);
});

router.get("/partner/projects", permission("partner.projects.view"), async (req: PartnerRequest, res) => {
  const partnerId = req.partner!.partnerId;
  const { data, error } = await supabase.from("bpo_partner_projects").select("id,centre_id,campaign_name,target,status,assigned_at,projects(id,name,status,start_date,expected_end_date,progress_percent)").eq("partner_id", partnerId).order("assigned_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Failed to load partner projects" });

  const memProjects = Array.from(bpoStore.partnerProjects.values())
    .filter((pp) => pp.partner_id === partnerId && pp.status === "active")
    .map((pp) => {
      const proj = bpoStore.projects.get(pp.project_id);
      return {
        id: pp.id,
        project_id: pp.project_id,
        centre_id: pp.centre_id,
        campaign_name: pp.campaign_name || proj?.name,
        target: pp.target,
        status: pp.status,
        assigned_at: pp.assigned_at,
        projects: {
          id: pp.project_id,
          name: proj?.name || pp.campaign_name,
          status: "active",
          start_date: pp.assigned_at,
          expected_end_date: null,
          progress_percent: 25,
        },
      };
    });

  const merged: any[] = [...(data || [])];
  for (const mp of memProjects) {
    if (!merged.some((p: any) => p.project_id === mp.project_id)) {
      merged.push(mp);
    }
  }

  return res.json(merged);
});

router.post("/partner/projects/:partnerProjectId/agents", permission("partner.agents.manage"), async (req: PartnerRequest, res) => {
  const partnerProjectId = numberId(req.params.partnerProjectId);
  const agentId = numberId(req.body?.agentId);
  if (!partnerProjectId || !agentId) return fail(res, 400, "Partner project and agent IDs are required");
  const { data: project } = await supabase.from("bpo_partner_projects").select("id").eq("id", partnerProjectId).eq("partner_id", req.partner!.partnerId).maybeSingle();
  if (!project) return fail(res, 404, "Partner project not found");
  const { data: agent } = await supabase.from("bpo_agents").select("id").eq("id", agentId).eq("partner_id", req.partner!.partnerId).maybeSingle();
  if (!agent) return fail(res, 404, "Agent not found");
  const { data, error } = await supabase.from("bpo_agent_assignments").insert({ agent_id: agentId, partner_project_id: partnerProjectId }).select().single();
  if (error) return res.status(error.code === "23505" ? 409 : 500).json({ error: "Failed to assign agent", details: error.message });
  await audit(req.user!.id, "partner_agent_assigned", "bpo_agent_assignment", String(data.id), { agentId, partnerProjectId });
  return res.status(201).json(data);
});

router.get("/partner/attendance", permission("partner.attendance.view"), async (req: PartnerRequest, res) => {
  const profiles = await supabase.from("bpo_agents").select("profile_id").eq("partner_id", req.partner!.partnerId).not("profile_id", "is", null);
  if (profiles.error) return res.status(500).json({ error: "Failed to load partner attendance" });
  const ids = (profiles.data || []).map((row: any) => row.profile_id); if (!ids.length) return res.json([]);
  const { data, error } = await supabase.from("attendance").select("id,user_id,date,check_in,check_out,status,duration_minutes").in("user_id", ids).order("date", { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: "Failed to load partner attendance" }); return res.json(data || []);
});

router.get("/partner/tickets", permission("partner.tickets.view"), async (req: PartnerRequest, res) => {
  const { data, error } = await supabase.from("tickets").select("id,ticket_number,subject,category,priority,status,created_at").eq("requester_id", req.user!.id).eq("requester_role", "partner").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Failed to load partner tickets" }); return res.json(data || []);
});

router.get("/partner/notifications", permission("partner.notifications.view"), async (req: PartnerRequest, res) => {
  const { data, error } = await supabase.from("notifications").select("id,type,title,body,entity_type,entity_id,read_at,created_at").eq("recipient_user_id", req.user!.id).order("created_at", { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: "Failed to load partner notifications" });
  return res.json(data || []);
});

router.get("/partner/notifications/unread-count", permission("partner.notifications.view"), async (req: PartnerRequest, res) => {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", req.user!.id)
      .is("read_at", null);
    if (error) throw error;
    return res.json({ success: true, unread_count: count ?? 0 });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to count unread notifications", details: error?.message });
  }
});

const handlePartnerNotificationRead = async (req: PartnerRequest, res: Response) => {
  try {
    const notificationId = numberId(req.params.id);
    if (!notificationId) return fail(res, 400, "Invalid notification ID");
    const now = new Date().toISOString();

    // Verify ownership and update atomically
    const { data, error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("id", notificationId)
      .eq("recipient_user_id", req.user!.id)
      .select("id,type,title,body,entity_type,entity_id,read_at,created_at")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // Check if notification exists under another user to prevent IDOR / give clear 403 vs 404
      const { data: exists } = await supabase.from("notifications").select("id").eq("id", notificationId).maybeSingle();
      if (exists) {
        return res.status(403).json({ success: false, error: "Forbidden: You do not own this notification" });
      }
      return res.status(404).json({ success: false, error: "Notification not found" });
    }

    return res.json({
      success: true,
      notification: data,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to mark notification read", details: error?.message });
  }
};

router.post("/partner/notifications/:id/read", permission("partner.notifications.view"), handlePartnerNotificationRead);
router.patch("/partner/notifications/:id/read", permission("partner.notifications.view"), handlePartnerNotificationRead);

router.post("/partner/notifications/read-all", permission("partner.notifications.view"), async (req: PartnerRequest, res: Response) => {
  try {
    const now = new Date().toISOString();
    // Update ONLY where recipient_user_id === req.user!.id AND read_at IS NULL
    const { data, error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_user_id", req.user!.id)
      .is("read_at", null)
      .select("id");

    if (error) throw error;

    return res.json({
      success: true,
      updated_count: data?.length ?? 0,
      unread_count: 0,
      read_at: now,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to mark all notifications as read", details: error?.message });
  }
});

router.post("/partner/notifications/test-create", permission("partner.notifications.view"), async (req: PartnerRequest, res: Response) => {
  try {
    const { title, body, type, count = 1 } = req.body || {};
    const n = Math.min(50, Math.max(1, Number(count) || 1));
    const rows = [];
    for (let i = 0; i < n; i++) {
      rows.push({
        recipient_user_id: req.user!.id,
        type: type || "operational_alert",
        title: n > 1 ? `${title || "Operational Alert"} #${i + 1}` : (title || "Operational Notice"),
        body: body || "Real-time notification notice generated for partner operations desk.",
        created_at: new Date(Date.now() + i * 100).toISOString(),
      });
    }
    const { data, error } = await supabase.from("notifications").insert(rows).select("id,title,read_at");
    if (error) throw error;
    return res.json({ success: true, count: data?.length ?? 0, notifications: data });
  } catch (err: any) {
    return fail(res, 500, "Failed to create test notifications", err?.message);
  }
});

router.get("/partner/documents", moduleFeature("partner_documents"), permission("partner.documents.view"), async (req: PartnerRequest, res) => {
  const { data, error } = await supabase.from("bpo_partner_documents").select("id,partner_project_id,created_at,documents(id,original_file_name,category,description,project_id,status,created_at)").eq("partner_id", req.partner!.partnerId).order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Failed to load partner documents" });
  return res.json((data || []).filter((row: any) => row.documents?.status === "active").map((row: any) => ({ ...row.documents, access_id: row.id, partner_project_id: row.partner_project_id, shared_at: row.created_at })));
});

router.get("/partner/documents/:id", moduleFeature("partner_documents"), permission("partner.documents.view"), async (req: PartnerRequest, res) => {
  const documentId = numberId(req.params.id); if (!documentId) return fail(res, 400, "Invalid document ID");
  const { data, error } = await supabase.from("bpo_partner_documents").select("partner_project_id,documents(id,original_file_name,category,description,project_id,status,created_at)").eq("partner_id", req.partner!.partnerId).eq("document_id", documentId).maybeSingle();
  if (error) return res.status(500).json({ error: "Failed to load partner document" });
  const document = (data as any)?.documents;
  if (!data || !document || document.status !== "active") return fail(res, 404, "Document not found");
  return res.json({ ...document, partner_project_id: (data as any).partner_project_id });
});

router.get("/partner/documents/:id/download", moduleFeature("partner_documents"), permission("partner.documents.view"), async (req: PartnerRequest, res) => {
  const documentId = numberId(req.params.id); if (!documentId) return fail(res, 400, "Invalid document ID");
  const { data } = await supabase.from("bpo_partner_documents").select("documents(id,original_file_name,mime_type,storage_path,status)").eq("partner_id", req.partner!.partnerId).eq("document_id", documentId).maybeSingle();
  const document = (data as any)?.documents;
  if (!document || document.status !== "active") return fail(res, 404, "Document not found");
  const signed = await supabase.storage.from("project-documents").createSignedUrl(document.storage_path, 300);
  if (signed.error || !signed.data?.signedUrl) return fail(res, 404, "Document unavailable");
  await supabase.from("document_activity").insert({ document_id: documentId, actor_user_id: req.user!.id, action: "partner_document_downloaded" });
  return res.json({ url: signed.data.signedUrl, fileName: document.original_file_name, mimeType: document.mime_type });
});

router.get("/partner/meetings", moduleFeature("partner_meetings"), permission("partner.meetings.view"), async (req: PartnerRequest, res) => {
  const { data, error } = await supabase.from("bpo_partner_meetings").select("id,partner_project_id,meetings(id,title,description,status,starts_at,ends_at,timezone,location,agenda,project_id)").eq("partner_id", req.partner!.partnerId).order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Failed to load partner meetings" });
  const meetings = [];
  for (const row of data || []) {
    if (!(row as any).meetings) continue;
    const { data: notes } = await supabase.from("meeting_notes").select("id,note_type,body,created_at").eq("meeting_id", (row as any).meetings.id).eq("partner_visible", true).order("created_at", { ascending: false });
    const { data: rsvp } = await supabase.from("bpo_partner_meeting_users").select("rsvp_status,responded_at").eq("meeting_id", (row as any).meetings.id).eq("user_id", req.user!.id).maybeSingle();
    meetings.push({ ...(row as any).meetings, partner_project_id: (row as any).partner_project_id, notes: notes || [], rsvp: rsvp || { rsvp_status: "pending", responded_at: null } });
  }
  return res.json(meetings);
});

router.get("/partner/meetings/:id", moduleFeature("partner_meetings"), permission("partner.meetings.view"), async (req: PartnerRequest, res) => {
  const meetingId = numberId(req.params.id); if (!meetingId) return fail(res, 400, "Invalid meeting ID");
  const { data: access } = await supabase.from("bpo_partner_meetings").select("partner_project_id").eq("partner_id", req.partner!.partnerId).eq("meeting_id", meetingId).maybeSingle();
  if (!access) return fail(res, 404, "Meeting not found");
  const { data: meeting, error } = await supabase.from("meetings").select("id,title,description,status,starts_at,ends_at,timezone,location,agenda,project_id").eq("id", meetingId).maybeSingle();
  if (error) return res.status(500).json({ error: "Failed to load partner meeting" });
  if (!meeting) return fail(res, 404, "Meeting not found");
  const { data: notes } = await supabase.from("meeting_notes").select("id,note_type,body,created_at").eq("meeting_id", meetingId).eq("partner_visible", true).order("created_at", { ascending: false });
  const { data: rsvp } = await supabase.from("bpo_partner_meeting_users").select("rsvp_status,responded_at").eq("meeting_id", meetingId).eq("user_id", req.user!.id).maybeSingle();
  return res.json({ ...meeting, partner_project_id: access.partner_project_id, notes: notes || [], rsvp: rsvp || { rsvp_status: "pending", responded_at: null } });
});

router.patch("/partner/meetings/:id/rsvp", moduleFeature("partner_meetings"), permission("partner.meetings.rsvp"), async (req: PartnerRequest, res) => {
  const meetingId = numberId(req.params.id); const rsvpStatus = req.body?.status;
  if (!meetingId || !["pending", "accepted", "declined", "tentative"].includes(rsvpStatus)) return fail(res, 400, "Valid meeting and RSVP status are required");
  const { data: access } = await supabase.from("bpo_partner_meetings").select("partner_id").eq("partner_id", req.partner!.partnerId).eq("meeting_id", meetingId).maybeSingle();
  if (!access) return fail(res, 404, "Meeting not found");
  const { data, error } = await supabase.from("bpo_partner_meeting_users").upsert({ meeting_id: meetingId, partner_id: req.partner!.partnerId, user_id: req.user!.id, rsvp_status: rsvpStatus, responded_at: new Date().toISOString() }, { onConflict: "meeting_id,user_id" }).select().single();
  if (error) return res.status(500).json({ error: "Failed to update meeting RSVP" });
  await audit(req.user!.id, "partner_meeting_rsvp", "meeting", String(meetingId), { status: rsvpStatus });
  return res.json(data);
});

router.get("/partner/training", moduleFeature("bpo_operations"), moduleFeature("partner_training"), permission("partner.training.view"), async (req: PartnerRequest, res) => {
  const { data, error } = await supabase.from("bpo_training_programs").select("id,title,description,starts_at,ends_at,status,completion_percent,partner_project_id,centre_id,bpo_training_assignments(id,agent_id,status,completion_percent,bpo_agents(employee_id,name))").eq("partner_id", req.partner!.partnerId).order("starts_at", { ascending: true });
  if (error) return res.status(500).json({ error: "Failed to load partner training" }); return res.json(data || []);
});

router.patch("/partner/training/assignments/:id", moduleFeature("bpo_operations"), moduleFeature("partner_training"), permission("partner.training.manage"), async (req: PartnerRequest, res) => {
  const assignmentId = numberId(req.params.id); const status = req.body?.status; const completionPercent = Number(req.body?.completionPercent);
  if (!assignmentId || !["not_started", "scheduled", "in_progress", "completed", "failed"].includes(status) || !Number.isInteger(completionPercent) || completionPercent < 0 || completionPercent > 100) return fail(res, 400, "Valid training status and completion percentage are required");
  const { data: assignment } = await supabase.from("bpo_training_assignments").select("id,bpo_training_programs!inner(partner_id)").eq("id", assignmentId).eq("bpo_training_programs.partner_id", req.partner!.partnerId).maybeSingle();
  if (!assignment) return fail(res, 404, "Training assignment not found");
  const { data, error } = await supabase.from("bpo_training_assignments").update({ status, completion_percent: completionPercent, updated_at: new Date().toISOString() }).eq("id", assignmentId).select().single();
  if (error) return res.status(500).json({ error: "Failed to update training assignment" }); return res.json(data);
});

router.get("/partner/quality", moduleFeature("bpo_operations"), moduleFeature("partner_quality"), permission("partner.quality.view"), async (req: PartnerRequest, res) => {
  const { data, error } = await supabase.from("bpo_quality_evaluations").select("id,agent_id,partner_project_id,score,status,evaluation_date,bpo_agents(employee_id,name)").eq("partner_id", req.partner!.partnerId).eq("partner_visible", true).order("evaluation_date", { ascending: false });
  if (error) return res.status(500).json({ error: "Failed to load partner quality" });
  const scores = (data || []).map((row: any) => Number(row.score));
  return res.json({ dataAvailable: scores.length > 0, averageScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length * 100) / 100 : null, evaluations: data || [] });
});

router.get("/partner/payout-statements", moduleFeature("partner_payouts"), permission("partner.payouts.view"), async (req: PartnerRequest, res) => {
  const { data, error } = await supabase.from("bpo_payout_statements").select("id,statement_number,period_start,period_end,payable_amount,approved_amount,paid_amount,pending_amount,payout_date,reference,status,created_at").eq("partner_id", req.partner!.partnerId).order("period_end", { ascending: false });
  if (error) return res.status(500).json({ error: "Failed to load payout statements" }); return res.json(data || []);
});

router.get("/partner/payout-statements/:id", moduleFeature("partner_payouts"), permission("partner.payouts.view"), async (req: PartnerRequest, res) => {
  const statementId = numberId(req.params.id); if (!statementId) return fail(res, 400, "Invalid statement ID");
  const { data, error } = await supabase.from("bpo_payout_statements").select("id,statement_number,period_start,period_end,payable_amount,approved_amount,paid_amount,pending_amount,payout_date,reference,status,created_at").eq("partner_id", req.partner!.partnerId).eq("id", statementId).maybeSingle();
  if (error) return res.status(500).json({ error: "Failed to load payout statement" }); if (!data) return fail(res, 404, "Payout statement not found"); return res.json(data);
});

router.get("/partner/productivity", moduleFeature("bpo_operations"), moduleFeature("partner_productivity"), permission("partner.productivity.view"), async (req: PartnerRequest, res) => {
  const { data: agents } = await supabase.from("bpo_agents").select("id,profile_id,name,employee_id").eq("partner_id", req.partner!.partnerId);
  const profileIds = (agents || []).map((agent: any) => agent.profile_id).filter(Boolean);
  const projectIds = (await supabase.from("bpo_partner_projects").select("project_id").eq("partner_id", req.partner!.partnerId)).data?.map((row: any) => row.project_id) || [];
  const [attendance, tasks, tickets] = await Promise.all([
    profileIds.length ? supabase.from("attendance").select("user_id,duration_minutes,status,date").in("user_id", profileIds) : Promise.resolve({ data: [], error: null } as any),
    projectIds.length ? supabase.from("project_tasks").select("id,status,completion_percent,project_id").in("project_id", projectIds) : Promise.resolve({ data: [], error: null } as any),
    supabase.from("tickets").select("id,status,created_at").eq("requester_role", "partner").eq("requester_id", req.user!.id),
  ]);
  if (attendance.error || tasks.error || tickets.error) return res.status(500).json({ error: "Failed to load productivity data" });
  const hasData = Boolean((attendance.data || []).length || (tasks.data || []).length || (tickets.data || []).length);
  return res.json({ dataAvailable: hasData, source: hasData ? ["attendance", "tasks", "tickets"].filter((source, index) => [attendance.data, tasks.data, tickets.data][index]?.length) : [], totals: { workingMinutes: (attendance.data || []).reduce((sum: number, row: any) => sum + Number(row.duration_minutes || 0), 0), tasksCompleted: (tasks.data || []).filter((row: any) => row.status === "completed").length, ticketsHandled: (tickets.data || []).length }, agents: agents || [] });
});

router.get("/partner/reports", moduleFeature("bpo_operations"), moduleFeature("partner_reports"), permission("partner.reports.view"), async (req: PartnerRequest, res) => {
  const [productivity, quality, training, tickets, payouts] = await Promise.all([
    supabase.from("bpo_agents").select("id").eq("partner_id", req.partner!.partnerId),
    supabase.from("bpo_quality_evaluations").select("id").eq("partner_id", req.partner!.partnerId).eq("partner_visible", true),
    supabase.from("bpo_training_programs").select("id").eq("partner_id", req.partner!.partnerId),
    supabase.from("tickets").select("id").eq("requester_id", req.user!.id).eq("requester_role", "partner"),
    supabase.from("bpo_payout_statements").select("id").eq("partner_id", req.partner!.partnerId),
  ]);
  if ([productivity, quality, training, tickets, payouts].some((result) => result.error)) return res.status(500).json({ error: "Failed to load partner reports" });
  return res.json({ reports: { attendance: { dataAvailable: false, reason: "No linked attendance records" }, productivity: { dataAvailable: false, reason: "Use the productivity endpoint for source-backed totals" }, quality: { dataAvailable: Boolean(quality.data?.length), count: quality.data?.length || 0 }, training: { dataAvailable: Boolean(training.data?.length), count: training.data?.length || 0 }, tickets: { dataAvailable: Boolean(tickets.data?.length), count: tickets.data?.length || 0 }, payouts: { dataAvailable: Boolean(payouts.data?.length), count: payouts.data?.length || 0 } } });
});

router.get("/admin/partner-documents", requireAuth, moduleFeature("partner_documents"), async (_req: AdminRequest, res) => {
  const { data, error } = await supabase.from("bpo_partner_documents").select("id,partner_id,partner_project_id,created_at,bpo_partners(partner_code,name),documents(id,original_file_name,category,status)").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Failed to load partner document shares" }); return res.json(data || []);
});
router.delete("/admin/partner-documents/:id", requireAuth, moduleFeature("partner_documents"), async (req: AdminRequest, res) => {
  const accessId = numberId(req.params.id); if (!accessId) return fail(res, 400, "Invalid document share ID");
  const { data, error } = await supabase.from("bpo_partner_documents").delete().eq("id", accessId).select("id,partner_id,document_id").maybeSingle();
  if (error) return res.status(500).json({ error: "Failed to revoke partner document access" }); if (!data) return fail(res, 404, "Document share not found"); return res.json({ success: true });
});
router.get("/admin/partner-meetings", requireAuth, moduleFeature("partner_meetings"), async (_req: AdminRequest, res) => {
  const { data, error } = await supabase.from("bpo_partner_meetings").select("id,meeting_id,partner_id,partner_project_id,created_at,bpo_partners(partner_code,name),meetings(title,status,starts_at)").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Failed to load partner meeting shares" }); return res.json(data || []);
});
router.delete("/admin/partner-meetings/:id", requireAuth, moduleFeature("partner_meetings"), async (req: AdminRequest, res) => {
  const accessId = numberId(req.params.id); if (!accessId) return fail(res, 400, "Invalid meeting share ID");
  const { data, error } = await supabase.from("bpo_partner_meetings").delete().eq("id", accessId).select("id").maybeSingle();
  if (error) return res.status(500).json({ error: "Failed to revoke partner meeting access" }); if (!data) return fail(res, 404, "Meeting share not found"); return res.json({ success: true });
});
router.get("/admin/partner-training", requireAuth, moduleFeature("partner_training"), async (_req: AdminRequest, res) => {
  const { data, error } = await supabase.from("bpo_training_programs").select("id,partner_id,title,status,completion_percent,starts_at,ends_at,bpo_partners(partner_code,name),bpo_training_assignments(id,agent_id,status,completion_percent,bpo_agents(name,employee_id))").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Failed to load partner training" }); return res.json(data || []);
});
router.get("/admin/partner-quality", requireAuth, moduleFeature("partner_quality"), async (_req: AdminRequest, res) => {
  const { data, error } = await supabase.from("bpo_quality_evaluations").select("id,partner_id,agent_id,partner_project_id,score,status,evaluation_date,partner_visible,internal_notes,bpo_partners(partner_code,name),bpo_agents(name,employee_id)").order("evaluation_date", { ascending: false });
  if (error) return res.status(500).json({ error: "Failed to load partner quality evaluations" }); return res.json(data || []);
});
router.get("/admin/partner-payout-statements", requireAuth, moduleFeature("partner_payouts"), async (_req: AdminRequest, res) => {
  const { data, error } = await supabase.from("bpo_payout_statements").select("id,partner_id,statement_number,period_start,period_end,payable_amount,approved_amount,paid_amount,pending_amount,payout_date,reference,status,bpo_partners(partner_code,name)").order("period_end", { ascending: false });
  if (error) return res.status(500).json({ error: "Failed to load partner payout statements" }); return res.json(data || []);
});

router.post("/admin/partner-documents", requireAuth, moduleFeature("partner_documents"), async (req: AdminRequest, res) => {
  const documentId = numberId(req.body?.documentId); const partnerProjectId = numberId(req.body?.partnerProjectId);
  if (!documentId || !partnerProjectId) return fail(res, 400, "Document and partner project IDs are required");
  const { data: document } = await supabase.from("documents").select("id,status").eq("id", documentId).maybeSingle(); if (!document || document.status === "deleted") return fail(res, 404, "Document not found");
  const { data: project } = await supabase.from("bpo_partner_projects").select("id,partner_id").eq("id", partnerProjectId).maybeSingle(); if (!project) return fail(res, 404, "Partner project not found");
  const { data, error } = await supabase.from("bpo_partner_documents").insert({ document_id: documentId, partner_id: project.partner_id, partner_project_id: partnerProjectId }).select().single();
  if (error) return res.status(error.code === "23505" ? 409 : 500).json({ error: "Failed to share document", details: error.message });
  await notifyPartnerUsers(project.partner_id, "partner_document_shared", "Document shared", "A document was shared with your partner workspace", String(documentId));
  return res.status(201).json(data);
});

router.post("/admin/partner-meetings", requireAuth, moduleFeature("partner_meetings"), async (req: AdminRequest, res) => {
  const meetingId = numberId(req.body?.meetingId); const partnerProjectId = numberId(req.body?.partnerProjectId);
  if (!meetingId || !partnerProjectId) return fail(res, 400, "Meeting and partner project IDs are required");
  const { data: meeting } = await supabase.from("meetings").select("id").eq("id", meetingId).maybeSingle(); if (!meeting) return fail(res, 404, "Meeting not found");
  const { data: project } = await supabase.from("bpo_partner_projects").select("id,partner_id").eq("id", partnerProjectId).maybeSingle(); if (!project) return fail(res, 404, "Partner project not found");
  const { data, error } = await supabase.from("bpo_partner_meetings").insert({ meeting_id: meetingId, partner_id: project.partner_id, partner_project_id: partnerProjectId }).select().single();
  if (error) return res.status(error.code === "23505" ? 409 : 500).json({ error: "Failed to share meeting", details: error.message });
  await notifyPartnerUsers(project.partner_id, "partner_meeting_scheduled", "Partner meeting scheduled", "A meeting was added to your partner workspace", String(meetingId));
  return res.status(201).json(data);
});

router.post("/admin/partner-training", requireAuth, moduleFeature("partner_training"), async (req: AdminRequest, res) => {
  const { partnerId, partnerProjectId, centreId, title, description, startsAt, endsAt, status = "not_started" } = req.body || {};
  if (typeof partnerId !== "string" || typeof title !== "string" || title.trim().length < 3) return fail(res, 400, "Partner ID and training title are required");
  if (!["not_started", "scheduled", "in_progress", "completed", "failed"].includes(status)) return fail(res, 400, "Invalid training status");
  const { data: partner } = await supabase.from("bpo_partners").select("id").eq("id", partnerId).maybeSingle(); if (!partner) return fail(res, 404, "Partner not found");
  if (partnerProjectId) { const { data: project } = await supabase.from("bpo_partner_projects").select("id").eq("id", numberId(partnerProjectId)).eq("partner_id", partnerId).maybeSingle(); if (!project) return fail(res, 403, "Partner project is not assigned"); }
  const { data, error } = await supabase.from("bpo_training_programs").insert({ partner_id: partnerId, partner_project_id: numberId(partnerProjectId), centre_id: numberId(centreId), title: title.trim(), description: description || null, starts_at: startsAt || null, ends_at: endsAt || null, status, created_by_admin_id: req.admin!.id }).select().single();
  if (error) return res.status(500).json({ error: "Failed to create training program", details: error.message });
  await notifyPartnerUsers(partnerId, "partner_training_assigned", "Training assigned", data.title, String(data.id)); return res.status(201).json(data);
});

router.post("/admin/partner-training/:programId/assignments", requireAuth, moduleFeature("partner_training"), async (req: AdminRequest, res) => {
  const programId = numberId(req.params.programId); const agentId = numberId(req.body?.agentId); if (!programId || !agentId) return fail(res, 400, "Program and agent IDs are required");
  const { data: program } = await supabase.from("bpo_training_programs").select("id,partner_id").eq("id", programId).maybeSingle(); if (!program) return fail(res, 404, "Training program not found");
  const { data: agent } = await supabase.from("bpo_agents").select("id").eq("id", agentId).eq("partner_id", program.partner_id).maybeSingle(); if (!agent) return fail(res, 403, "Agent is not assigned to this partner");
  const { data, error } = await supabase.from("bpo_training_assignments").insert({ program_id: programId, agent_id: agentId }).select().single(); if (error) return res.status(error.code === "23505" ? 409 : 500).json({ error: "Failed to assign training", details: error.message }); return res.status(201).json(data);
});

router.post("/admin/partner-quality", requireAuth, moduleFeature("partner_quality"), async (req: AdminRequest, res) => {
  const { partnerId, agentId, partnerProjectId, score, status = "submitted", evaluationDate, partnerVisible = true, internalNotes } = req.body || {};
  if (typeof partnerId !== "string" || !numberId(agentId) || !Number.isFinite(Number(score)) || Number(score) < 0 || Number(score) > 100) return fail(res, 400, "Partner, agent, and score are required");
  const { data: agent } = await supabase.from("bpo_agents").select("id").eq("id", numberId(agentId)).eq("partner_id", partnerId).maybeSingle(); if (!agent) return fail(res, 403, "Agent is not assigned to this partner");
  const { data, error } = await supabase.from("bpo_quality_evaluations").insert({ partner_id: partnerId, agent_id: numberId(agentId), partner_project_id: numberId(partnerProjectId), score: Number(score), status, evaluation_date: evaluationDate || undefined, partner_visible: Boolean(partnerVisible), internal_notes: internalNotes || null, created_by_admin_id: req.admin!.id }).select().single(); if (error) return res.status(500).json({ error: "Failed to create quality evaluation", details: error.message }); return res.status(201).json({ id: data.id, status: data.status });
});

router.post("/admin/partner-payout-statements", requireAuth, moduleFeature("partner_payouts"), async (req: AdminRequest, res) => {
  const { partnerId, statementNumber, periodStart, periodEnd, payableAmount = 0, approvedAmount = 0, paidAmount = 0, pendingAmount = 0, payoutDate, reference, status = "pending" } = req.body || {};
  if (typeof partnerId !== "string" || typeof statementNumber !== "string" || !periodStart || !periodEnd) return fail(res, 400, "Partner, statement number, and period are required");
  const { data: partner } = await supabase.from("bpo_partners").select("id").eq("id", partnerId).maybeSingle(); if (!partner) return fail(res, 404, "Partner not found");
  const amounts = [payableAmount, approvedAmount, paidAmount, pendingAmount].map(Number); if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) return fail(res, 400, "Payout amounts must be non-negative numbers");
  const { data, error } = await supabase.from("bpo_payout_statements").insert({ partner_id: partnerId, statement_number: statementNumber.trim(), period_start: periodStart, period_end: periodEnd, payable_amount: amounts[0], approved_amount: amounts[1], paid_amount: amounts[2], pending_amount: amounts[3], payout_date: payoutDate || null, reference: reference || null, status, created_by_admin_id: req.admin!.id }).select("id,statement_number,status").single(); if (error) return res.status(error.code === "23505" ? 409 : 500).json({ error: "Failed to create payout statement", details: error.message }); await notifyPartnerUsers(partnerId, "partner_payout_status", "Payout statement updated", `Statement ${data.statement_number} is ${data.status}`, String(data.id)); return res.status(201).json(data);
});

// Admin assignment endpoints use existing admin authentication and never return client financial fields.
router.get("/admin/partners", requireAuth, async (_req: AdminRequest, res) => { const { data, error } = await supabase.from("bpo_partners").select("id,partner_code,name,legal_name,status,created_at,bpo_partner_users(user_id,role,status),bpo_centres(id,name,status)").order("created_at", { ascending: false }); if (error) return res.status(500).json({ error: "Failed to load partners" }); return res.json(data || []); });
router.post("/admin/partners", requireAuth, async (req: AdminRequest, res) => { const { name, legalName, partnerCode, email, contactName } = req.body || {}; if (typeof name !== "string" || name.trim().length < 2 || typeof partnerCode !== "string" || !partnerCode.trim()) return fail(res, 400, "Partner name and code are required"); const { data, error } = await supabase.from("bpo_partners").insert({ name: name.trim(), legal_name: legalName || null, partner_code: partnerCode.trim(), email: email || null, contact_name: contactName || null }).select().single(); if (error) return res.status(error.code === "23505" ? 409 : 500).json({ error: "Failed to create partner", details: error.message }); return res.status(201).json(data); });
router.post("/admin/partners/:partnerId/users", requireAuth, async (req: AdminRequest, res) => {
  const partnerId = req.params.partnerId;
  const { userId, role = "partner_admin" } = req.body || {};
  if (typeof userId !== "string") return fail(res, 400, "User ID is required");
  if (!["partner_admin", "operations_manager", "centre_manager", "team_leader", "agent"].includes(role)) return fail(res, 400, "Invalid partner role");
  const { data: partner } = await supabase.from("bpo_partners").select("id").eq("id", partnerId).maybeSingle();
  if (!partner) return fail(res, 404, "Partner not found");
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!profile) return fail(res, 404, "User not found");
  const { data, error } = await supabase.from("bpo_partner_users").insert({ partner_id: partnerId, user_id: userId, role }).select().single();
  if (error) return res.status(error.code === "23505" ? 409 : 500).json({ error: "Failed to assign partner user", details: error.message });
  const { error: roleError } = await supabase.from("profiles").update({ role: "bpo_partner" }).eq("id", userId);
  if (roleError) return res.status(500).json({ error: "Partner membership created but role update failed" });
  const defaultPermissions = role === "partner_admin" ? [] : ["partner.dashboard.view", "partner.projects.view", "partner.centre.view", "partner.agents.view", "partner.attendance.view", "partner.tickets.view", "partner.notifications.view"];
  if (defaultPermissions.length) await supabase.from("bpo_partner_user_permissions").insert(defaultPermissions.map((permission_key) => ({ partner_user_id: data.id, permission_key })));
  return res.status(201).json(data);
});
router.patch("/admin/partner-memberships/:id", requireAuth, async (req: AdminRequest, res) => {
  const membershipId = numberId(req.params.id);
  const role = req.body?.role;
  const status = req.body?.status;
  if (!membershipId) return fail(res, 400, "Membership ID is required");
  if (role !== undefined && !["partner_admin", "operations_manager", "centre_manager", "team_leader", "agent"].includes(role)) return fail(res, 400, "Invalid partner role");
  if (status !== undefined && !["active", "inactive", "suspended"].includes(status)) return fail(res, 400, "Invalid membership status");
  const patch: Record<string, string> = {};
  if (role !== undefined) patch.role = role;
  if (status !== undefined) patch.status = status;
  if (!Object.keys(patch).length) return fail(res, 400, "A role or status is required");
  const { data, error } = await supabase.from("bpo_partner_users").update(patch).eq("id", membershipId).select("id, partner_id, user_id, role, status").maybeSingle();
  if (error) return res.status(500).json({ error: "Failed to update partner membership", details: error.message });
  if (!data) return fail(res, 404, "Membership not found");
  await supabase.from("audit_logs").insert({ actor_admin_id: req.admin!.id, action: "partner_membership_changed", entity_type: "partner_membership", entity_id: String(membershipId), metadata: { role: data.role, status: data.status, result: "success" } });
  return res.json(data);
});
router.post("/admin/partners/:partnerId/projects", requireAuth, async (req: AdminRequest, res) => {
  const projectId = numberId(req.body?.projectId); const centreId = numberId(req.body?.centreId);
  if (!projectId) return fail(res, 400, "Project ID is required");
  const { data: partner } = await supabase.from("bpo_partners").select("id").eq("id", req.params.partnerId).maybeSingle();
  if (!partner) return fail(res, 404, "Partner not found");
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!project) return fail(res, 404, "Project not found");
  if (centreId) { const { data: centre } = await supabase.from("bpo_centres").select("id").eq("id", centreId).eq("partner_id", req.params.partnerId).maybeSingle(); if (!centre) return fail(res, 403, "Centre is not assigned to this partner"); }
  const { data, error } = await supabase.from("bpo_partner_projects").insert({ partner_id: req.params.partnerId, project_id: projectId, centre_id: centreId, campaign_name: req.body?.campaignName || null, target: req.body?.target || null }).select().single();
  if (error) return res.status(error.code === "23505" ? 409 : 500).json({ error: "Failed to assign project", details: error.message });
  return res.status(201).json(data);
});

export default router;
