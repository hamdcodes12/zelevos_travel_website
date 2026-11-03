import { Router, type Request, type Response } from "express";
import { plansRepository, type Plan, type PlanStatus } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

type AuthenticatedAdminRequest = Request & {
  admin?: { id: number; username: string };
};

let plansCatalogCache: { data: any; timestamp: number } | null = null;
let plansCatalogInFlight: Promise<any> | null = null;
const PLANS_CACHE_TTL_MS = 60000;

export function invalidatePlansCache() {
  plansCatalogCache = null;
  plansCatalogInFlight = null;
}

// ─── 1. CLIENT PORTAL PUBLIC / AUTHENTICATED CATALOGUE ────────────────────────
// Returns authoritative, client-visible plans (PUBLISHED or WAITING, not DRAFT, not ARCHIVED)
router.get(["/plans", "/plans/catalogue"], async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (plansCatalogCache && (now - plansCatalogCache.timestamp < PLANS_CACHE_TTL_MS)) {
      res.json(plansCatalogCache.data);
      return;
    }
    if (!plansCatalogInFlight) {
      plansCatalogInFlight = plansRepository.getClientVisible().then((plans) => {
        plansCatalogCache = { data: plans, timestamp: Date.now() };
        return plans;
      }).finally(() => {
        plansCatalogInFlight = null;
      });
    }
    const plans = await plansCatalogInFlight;
    res.json(plans);
    return;
  } catch (error: any) {
    console.error("[Plans] Client catalogue query failed:", error);
    res.status(503).json({ error: "Plans are temporarily unavailable.", details: error?.message });
    return;
  }
});

// ─── 2. ADMIN MASTER SERVICES & PLANS DASHBOARD ──────────────────────────────
// Returns all plans (including DRAFT, WAITING, PUBLISHED, ARCHIVED) + authoritative KPIs
async function handleGetAdminPlans(_req: Request, res: Response) {
  try {
    const plans = await plansRepository.getAll();

    // Authoritative KPI statistics
    const stats = {
      total: plans.length,
      published: plans.filter((p) => p.status === "PUBLISHED").length,
      waiting: plans.filter((p) => p.status === "WAITING").length,
      drafts: plans.filter((p) => p.status === "DRAFT").length,
      paymentEnabled: plans.filter((p) => p.paymentEnabled).length,
      paymentDisabled: plans.filter((p) => !p.paymentEnabled).length,
      archived: plans.filter((p) => p.status === "ARCHIVED").length,
    };

    // Category breakdown counts
    const categories: Record<string, number> = {
      ALL: plans.length,
      BUILD: plans.filter((p) => p.category === "BUILD").length,
      AI: plans.filter((p) => p.category === "AI").length,
      AUTOMATE: plans.filter((p) => p.category === "AUTOMATE").length,
      SCALE: plans.filter((p) => p.category === "SCALE").length,
      OPERATE: plans.filter((p) => p.category === "OPERATE").length,
    };

    res.json({ plans, stats, categories });
  } catch (error: any) {
    console.error("[Admin Plans] Query failed:", error);
    res.status(503).json({ error: "Failed to load master catalogue", details: error?.message });
  }
}

router.get("/admin/plans", requireAuth, handleGetAdminPlans);
router.get("/admin/services-plans", requireAuth, handleGetAdminPlans);

// ─── 3. CREATE NEW SERVICE / PLAN ─────────────────────────────────────────────
// Default status is DRAFT, payment_enabled is false, client cannot see until published
async function handleCreateAdminPlan(req: AuthenticatedAdminRequest, res: Response) {
  try {
    const adminId = req.admin?.id ?? null;
    const body = req.body || {};

    const name = String(body.name || "").trim();
    const serviceName = String(body.serviceName || body.name || "").trim();
    const category = String(body.category || "BUILD").trim().toUpperCase();
    const rawPrice = body.price !== undefined && body.price !== "" ? Number(body.price) : 0;

    if (!name || isNaN(rawPrice)) {
      res.status(400).json({ error: "Plan name and valid numerical price are required" });
      return;
    }

    const serviceId = (
      body.serviceId ||
      body.packageSlug ||
      `${category.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`
    ).trim().toLowerCase();

    const status: PlanStatus = body.status && ["DRAFT", "WAITING", "PUBLISHED", "ARCHIVED"].includes(body.status.toUpperCase())
      ? (body.status.toUpperCase() as PlanStatus)
      : "DRAFT";

    const paymentEnabled = status === "PUBLISHED" && Boolean(body.paymentEnabled);
    const clientVisible = status === "PUBLISHED" || status === "WAITING";

    const plan = await plansRepository.create({
      serviceId,
      serviceNumber: body.serviceNumber || "99",
      category,
      serviceName,
      name,
      tier: body.tier || "Standard",
      price: rawPrice,
      priceMax: body.priceMax ? Number(body.priceMax) : null,
      priceDisplay: body.priceDisplay || (body.pricingType === "custom" ? "Custom Pricing" : `$${rawPrice.toLocaleString()}`),
      pricingType: body.pricingType || (rawPrice > 0 ? "fixed" : "custom"),
      currency: body.currency || "USD",
      billingInterval: body.billingInterval === "monthly" ? "monthly" : "one_time",
      tag: body.tag || body.tier || "Standard",
      description: body.description || "",
      targetCustomer: body.targetCustomer || "",
      features: Array.isArray(body.features)
        ? body.features
        : typeof body.features === "string"
        ? body.features.split("\n").map((f: string) => f.trim()).filter(Boolean)
        : [],
      deliveryTimeline: body.deliveryTimeline || "Standard",
      supportDuration: body.supportDuration || "Standard",
      includedUnits: body.includedUnits || null,
      popular: Boolean(body.popular),
      sortOrder: Number(body.sortOrder) || 0,
      status,
      paymentEnabled,
      clientVisible,
    });

    // Audit log
    await plansRepository.logAudit(adminId, "CREATE", plan.id, {
      plan_name: plan.name,
      service_id: plan.serviceId,
      price: plan.price,
      status: plan.status,
      payment_enabled: plan.paymentEnabled,
    });

    res.status(201).json(plan);
  } catch (error: any) {
    console.error("[Admin Plans] Create error:", error);
    res.status(500).json({ error: "Failed to create plan", details: error?.message });
  }
}

router.post("/admin/plans", requireAuth, handleCreateAdminPlan);
router.post("/admin/services-plans", requireAuth, handleCreateAdminPlan);

// ─── 4. EDIT PLAN & PRICE SYNCHRONIZATION ────────────────────────────────────
async function handleUpdateAdminPlan(req: AuthenticatedAdminRequest, res: Response) {
  try {
    const adminId = req.admin?.id ?? null;
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid plan ID" });
      return;
    }

    const current = await plansRepository.getById(id);
    if (!current) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    const body = req.body || {};
    const updates: Partial<Plan> = {};

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.serviceName !== undefined) updates.serviceName = String(body.serviceName).trim();
    if (body.serviceNumber !== undefined) updates.serviceNumber = String(body.serviceNumber).trim();
    if (body.category !== undefined) updates.category = String(body.category).trim().toUpperCase();
    if (body.tier !== undefined) updates.tier = String(body.tier).trim();
    if (body.tag !== undefined) updates.tag = String(body.tag).trim();
    if (body.description !== undefined) updates.description = String(body.description);
    if (body.targetCustomer !== undefined) updates.targetCustomer = String(body.targetCustomer);
    if (body.currency !== undefined) updates.currency = String(body.currency);
    if (body.deliveryTimeline !== undefined) updates.deliveryTimeline = String(body.deliveryTimeline);
    if (body.supportDuration !== undefined) updates.supportDuration = String(body.supportDuration);
    if (body.includedUnits !== undefined) updates.includedUnits = body.includedUnits;
    if (body.priceDisplay !== undefined) updates.priceDisplay = String(body.priceDisplay);
    if (body.pricingType !== undefined) updates.pricingType = body.pricingType;
    if (body.billingInterval !== undefined) updates.billingInterval = body.billingInterval;
    if (body.popular !== undefined) updates.popular = Boolean(body.popular);
    if (body.sortOrder !== undefined) updates.sortOrder = Number(body.sortOrder);
    if (body.priceMax !== undefined) updates.priceMax = body.priceMax ? Number(body.priceMax) : null;

    if (body.features !== undefined) {
      updates.features = Array.isArray(body.features)
        ? body.features
        : typeof body.features === "string"
        ? body.features.split("\n").map((f: string) => f.trim()).filter(Boolean)
        : [];
    }

    // Status management
    if (body.status !== undefined) {
      const newStatus = String(body.status).toUpperCase() as PlanStatus;
      if (["DRAFT", "WAITING", "PUBLISHED", "ARCHIVED"].includes(newStatus)) {
        updates.status = newStatus;
      }
    }

    // Payment enabled management
    if (body.paymentEnabled !== undefined) {
      updates.paymentEnabled = Boolean(body.paymentEnabled);
    }

    // Client visible management
    if (body.clientVisible !== undefined) {
      updates.clientVisible = Boolean(body.clientVisible);
    }

    // Authoritative Price Change detection
    let priceChanged = false;
    let oldPrice = current.price;
    let newPrice = current.price;

    if (body.price !== undefined && body.price !== "") {
      newPrice = Number(body.price);
      if (!isNaN(newPrice) && newPrice !== current.price) {
        updates.price = newPrice;
        priceChanged = true;
      }
    }

    const updatedPlan = await plansRepository.update(id, updates);
    if (!updatedPlan) {
      res.status(404).json({ error: "Plan could not be updated" });
      return;
    }

    // Audit logs
    if (priceChanged) {
      await plansRepository.logAudit(adminId, "PRICE_CHANGED", id, {
        plan_name: updatedPlan.name,
        service_id: updatedPlan.serviceId,
        old_price: oldPrice,
        new_price: newPrice,
      });
    }

    await plansRepository.logAudit(adminId, "EDIT", id, {
      plan_name: updatedPlan.name,
      service_id: updatedPlan.serviceId,
      updates_keys: Object.keys(updates),
    });

    res.json(updatedPlan);
  } catch (error: any) {
    console.error("[Admin Plans] Update error:", error);
    res.status(500).json({ error: "Failed to update plan", details: error?.message });
  }
}

router.patch("/admin/plans/:id", requireAuth, handleUpdateAdminPlan);
router.patch("/admin/services-plans/:id", requireAuth, handleUpdateAdminPlan);

// ─── 5. SPECIFIC FAST ACTION ENDPOINTS ───────────────────────────────────────

// A. PUBLISH
async function handlePublishPlan(req: AuthenticatedAdminRequest, res: Response) {
  try {
    const adminId = req.admin?.id ?? null;
    const id = parseInt(req.params.id as string, 10);
    const plan = await plansRepository.getById(id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    // Validate required catalogue fields before publishing
    if (!plan.name || !plan.category || (plan.pricingType === "fixed" && plan.price <= 0)) {
      return res.status(400).json({
        error: "Plan must have a valid name, category, and price before publishing.",
      });
    }

    const paymentEnabled = req.body?.paymentEnabled !== undefined
      ? Boolean(req.body.paymentEnabled)
      : plan.pricingType === "fixed" && plan.price > 0;

    const updated = await plansRepository.update(id, {
      status: "PUBLISHED",
      clientVisible: true,
      paymentEnabled,
    });

    await plansRepository.logAudit(adminId, "PUBLISHED", id, {
      plan_name: plan.name,
      payment_enabled: paymentEnabled,
    });

    return res.json({ success: true, plan: updated });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to publish plan", details: error?.message });
  }
}
router.post("/admin/plans/:id/publish", requireAuth, handlePublishPlan);
router.post("/admin/services-plans/:id/publish", requireAuth, handlePublishPlan);

// B. UNPUBLISH (Transitions to WAITING or DRAFT)
async function handleUnpublishPlan(req: AuthenticatedAdminRequest, res: Response) {
  try {
    const adminId = req.admin?.id ?? null;
    const id = parseInt(req.params.id as string, 10);
    const targetStatus: PlanStatus = req.body?.targetStatus === "DRAFT" ? "DRAFT" : "WAITING";

    const updated = await plansRepository.update(id, {
      status: targetStatus,
      clientVisible: targetStatus === "WAITING",
      paymentEnabled: false,
    });
    if (!updated) return res.status(404).json({ error: "Plan not found" });

    await plansRepository.logAudit(adminId, "UNPUBLISHED", id, {
      target_status: targetStatus,
    });

    return res.json({ success: true, plan: updated });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to unpublish plan", details: error?.message });
  }
}
router.post("/admin/plans/:id/unpublish", requireAuth, handleUnpublishPlan);
router.post("/admin/services-plans/:id/unpublish", requireAuth, handleUnpublishPlan);

// C. SET WAITING (Visible to client, but checkout disabled: "Coming Soon")
async function handleSetWaiting(req: AuthenticatedAdminRequest, res: Response) {
  try {
    const adminId = req.admin?.id ?? null;
    const id = parseInt(req.params.id as string, 10);
    const updated = await plansRepository.update(id, {
      status: "WAITING",
      clientVisible: true,
      paymentEnabled: false,
    });
    if (!updated) return res.status(404).json({ error: "Plan not found" });

    await plansRepository.logAudit(adminId, "WAITING", id, {
      plan_name: updated.name,
    });

    return res.json({ success: true, plan: updated });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to set plan to waiting", details: error?.message });
  }
}
router.post("/admin/plans/:id/waiting", requireAuth, handleSetWaiting);
router.post("/admin/services-plans/:id/waiting", requireAuth, handleSetWaiting);

// D. SET DRAFT (Hidden from client, preparation mode)
async function handleSetDraft(req: AuthenticatedAdminRequest, res: Response) {
  try {
    const adminId = req.admin?.id ?? null;
    const id = parseInt(req.params.id as string, 10);
    const updated = await plansRepository.update(id, {
      status: "DRAFT",
      clientVisible: false,
      paymentEnabled: false,
    });
    if (!updated) return res.status(404).json({ error: "Plan not found" });

    await plansRepository.logAudit(adminId, "DRAFT", id, {
      plan_name: updated.name,
    });

    return res.json({ success: true, plan: updated });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to set plan to draft", details: error?.message });
  }
}
router.post("/admin/plans/:id/draft", requireAuth, handleSetDraft);
router.post("/admin/services-plans/:id/draft", requireAuth, handleSetDraft);

// E. TOGGLE PAYMENT AVAILABILITY
async function handleTogglePayment(req: AuthenticatedAdminRequest, res: Response) {
  try {
    const adminId = req.admin?.id ?? null;
    const id = parseInt(req.params.id as string, 10);
    const current = await plansRepository.getById(id);
    if (!current) return res.status(404).json({ error: "Plan not found" });

    const newPaymentEnabled = req.body?.enabled !== undefined ? Boolean(req.body.enabled) : !current.paymentEnabled;

    if (newPaymentEnabled && current.status !== "PUBLISHED") {
      return res.status(400).json({
        error: `Cannot enable payment for plan in '${current.status}' status. Plan must be PUBLISHED first.`,
      });
    }

    const updated = await plansRepository.update(id, {
      paymentEnabled: newPaymentEnabled,
    });

    await plansRepository.logAudit(
      adminId,
      newPaymentEnabled ? "PAYMENT_ENABLED" : "PAYMENT_DISABLED",
      id,
      { plan_name: current.name, payment_enabled: newPaymentEnabled }
    );

    return res.json({ success: true, plan: updated });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to update payment status", details: error?.message });
  }
}
router.post("/admin/plans/:id/payment", requireAuth, handleTogglePayment);
router.post("/admin/services-plans/:id/payment", requireAuth, handleTogglePayment);

// F. ARCHIVE PLAN (Soft-delete: preserves historical orders and invoices)
async function handleArchivePlan(req: AuthenticatedAdminRequest, res: Response) {
  try {
    const adminId = req.admin?.id ?? null;
    const id = parseInt(req.params.id as string, 10);
    const plan = await plansRepository.getById(id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const updated = await plansRepository.archive(id);

    await plansRepository.logAudit(adminId, "ARCHIVED", id, {
      plan_name: plan.name,
      service_id: plan.serviceId,
    });

    return res.json({ success: true, plan: updated, message: "Plan archived successfully. Historical records preserved." });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to archive plan", details: error?.message });
  }
}
router.post("/admin/plans/:id/archive", requireAuth, handleArchivePlan);
router.post("/admin/services-plans/:id/archive", requireAuth, handleArchivePlan);

// G. DUPLICATE PLAN (Creates DRAFT copy with unique ID)
async function handleDuplicatePlan(req: AuthenticatedAdminRequest, res: Response) {
  try {
    const adminId = req.admin?.id ?? null;
    const id = parseInt(req.params.id as string, 10);
    const newCopy = await plansRepository.duplicate(id);
    if (!newCopy) return res.status(404).json({ error: "Source plan not found" });

    await plansRepository.logAudit(adminId, "CREATE", newCopy.id, {
      plan_name: newCopy.name,
      service_id: newCopy.serviceId,
      duplicated_from_id: id,
      status: "DRAFT",
    });

    return res.status(201).json(newCopy);
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to duplicate plan", details: error?.message });
  }
}
router.post("/admin/plans/:id/duplicate", requireAuth, handleDuplicatePlan);
router.post("/admin/services-plans/:id/duplicate", requireAuth, handleDuplicatePlan);

// ─── 6. DELETE / SAFE REMOVAL ────────────────────────────────────────────────
// If historical references (purchases, profiles) exist, safe archive is enforced
async function handleDeleteAdminPlan(req: AuthenticatedAdminRequest, res: Response) {
  try {
    const adminId = req.admin?.id ?? null;
    const id = parseInt(req.params.id as string, 10);
    const plan = await plansRepository.getById(id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const result = await plansRepository.delete(id);

    if (result.archivedInstead) {
      await plansRepository.logAudit(adminId, "ARCHIVED", id, {
        plan_name: plan.name,
        reason: "Referenced by existing orders/invoices",
      });
      return res.json({
        success: true,
        archivedInstead: true,
        message: result.message,
      });
    }

    await plansRepository.logAudit(adminId, "ARCHIVED", id, {
      plan_name: plan.name,
      hard_deleted: true,
    });

    return res.json({ success: true, message: "Plan removed permanently" });
  } catch (error: any) {
    console.error("[Admin Plans] Delete error:", error);
    return res.status(500).json({ error: "Failed to delete plan", details: error?.message });
  }
}

router.delete("/admin/plans/:id", requireAuth, handleDeleteAdminPlan);
router.delete("/admin/services-plans/:id", requireAuth, handleDeleteAdminPlan);

// ─── 7. AUDIT LOGS ────────────────────────────────────────────────────────────
async function handleGetAuditLogs(req: Request, res: Response) {
  try {
    const planId = req.query.planId ? String(req.query.planId) : undefined;
    const logs = await plansRepository.getAuditLogs(planId);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to load audit logs", details: error?.message });
  }
}

async function handleGetPlanAudit(req: Request, res: Response) {
  try {
    const planId = req.params.id as string;
    const logs = await plansRepository.getAuditLogs(planId);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to load audit logs", details: error?.message });
  }
}

router.get("/admin/plans/audit-logs", requireAuth, handleGetAuditLogs);
router.get("/admin/services-plans/audit-logs", requireAuth, handleGetAuditLogs);
router.get("/admin/plans/:id/audit", requireAuth, handleGetPlanAudit);
router.get("/admin/services-plans/:id/audit", requireAuth, handleGetPlanAudit);

export default router;
