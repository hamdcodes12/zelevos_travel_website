import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  Search,
  Plus,
  RefreshCw,
  Eye,
  Pencil,
  Copy,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  DollarSign,
  ShieldCheck,
  Tag,
  Check,
  X,
  CreditCard,
  Ban,
  Archive,
  ArrowUpRight,
  Filter,
  Sparkles,
  ChevronDown,
  LayoutGrid,
  Table as TableIcon,
  HelpCircle,
  History,
  Lock,
  Unlock,
  Loader2,
} from "lucide-react";

export type PlanStatus = "DRAFT" | "WAITING" | "PUBLISHED" | "ARCHIVED";

export interface Plan {
  id: number;
  serviceId: string;
  serviceNumber: string;
  category: "BUILD" | "AI" | "AUTOMATE" | "SCALE" | "OPERATE" | string;
  serviceName?: string;
  packageName?: string;
  packageSlug?: string;
  name: string;
  tier?: string;
  price: number;
  priceMax?: number | null;
  priceDisplay?: string;
  pricingType?: "fixed" | "range" | "custom";
  currency?: string;
  billingInterval?: "one_time" | "monthly";
  tag: string;
  description: string;
  targetCustomer?: string;
  features: string[];
  deliveryTimeline?: string;
  supportDuration?: string;
  includedUnits?: string | null;
  popular: boolean;
  sortOrder: number;
  status: PlanStatus;
  paymentEnabled: boolean;
  enabled?: boolean;
  clientVisible?: boolean;
  publicVisible?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  published: number;
  waiting: number;
  drafts: number;
  paymentEnabled: number;
  paymentDisabled: number;
  archived: number;
}

interface AuditLog {
  id: number;
  actor_admin_id: number | null;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, any>;
  created_at: string;
}

const CATEGORIES = ["BUILD", "AI", "AUTOMATE", "SCALE", "OPERATE"] as const;

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  BUILD: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  AI: { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" },
  AUTOMATE: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
  SCALE: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  OPERATE: { bg: "#F8FAFC", text: "#334155", border: "#E2E8F0" },
};

function apiCall(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("admin_token");
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}

export default function AdminServicesPlansControlCentre() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    published: 0,
    waiting: 0,
    drafts: 0,
    paymentEnabled: 0,
    paymentDisabled: 0,
    archived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [archiving, setArchiving] = useState(false);

  const setPlanActionLoading = (key: string, isLoading: boolean) => {
    setActionLoading((prev) => ({ ...prev, [key]: isLoading }));
  };

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [billingFilter, setBillingFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Modals & Panels
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [viewDetailsPlan, setViewDetailsPlan] = useState<Plan | null>(null);
  const [archiveModalPlan, setArchiveModalPlan] = useState<Plan | null>(null);
  const [auditLogsOpen, setAuditLogsOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Form State
  const [formValues, setFormValues] = useState<{
    serviceName: string;
    name: string;
    serviceId: string;
    serviceNumber: string;
    category: string;
    tier: string;
    price: string;
    priceDisplay: string;
    priceMax: string;
    pricingType: "fixed" | "range" | "custom";
    currency: string;
    billingInterval: "one_time" | "monthly";
    deliveryTimeline: string;
    supportDuration: string;
    targetCustomer: string;
    tag: string;
    description: string;
    features: string;
    status: PlanStatus;
    paymentEnabled: boolean;
    clientVisible: boolean;
    sortOrder: string;
    popular: boolean;
  }>({
    serviceName: "",
    name: "",
    serviceId: "",
    serviceNumber: "01",
    category: "BUILD",
    tier: "STARTER",
    price: "499",
    priceDisplay: "$499",
    priceMax: "",
    pricingType: "fixed",
    currency: "USD",
    billingInterval: "one_time",
    deliveryTimeline: "5–7 days",
    supportDuration: "7 days support",
    targetCustomer: "",
    tag: "Small Business Entry",
    description: "",
    features: "",
    status: "DRAFT",
    paymentEnabled: false,
    clientVisible: false,
    sortOrder: "1",
    popular: false,
  });
  const [savingPlan, setSavingPlan] = useState(false);

  const showNotification = (type: "success" | "error", text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4500);
  };

  const loadCatalogue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall("/admin/services-plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
        if (data.stats) setStats(data.stats);
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification("error", err.error || "Failed to load master catalogue");
      }
    } catch (e: any) {
      showNotification("error", e.message || "Network error loading catalogue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogue();
  }, [loadCatalogue]);

  const loadAuditLogs = async (planId?: number) => {
    setLoadingAudit(true);
    try {
      const q = planId ? `?planId=${planId}` : "";
      const res = await apiCall(`/admin/services-plans/audit-logs${q}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data || []);
      }
    } finally {
      setLoadingAudit(false);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setIsCreating(true);
    setSelectedPlan(null);
    setFormValues({
      serviceName: "Business Website Development",
      name: "STARTER",
      serviceId: `plan-${Date.now().toString().slice(-4)}`,
      serviceNumber: String(plans.length + 1).padStart(2, "0"),
      category: "BUILD",
      tier: "STARTER",
      price: "499",
      priceDisplay: "$499",
      priceMax: "",
      pricingType: "fixed",
      currency: "USD",
      billingInterval: "one_time",
      deliveryTimeline: "5–7 days",
      supportDuration: "7 days support",
      targetCustomer: "Small businesses & startups",
      tag: "Standard Plan",
      description: "Deliver a high-converting, modern digital foundation.",
      features: "Custom responsive design\nMobile optimization\nBasic on-page SEO\nContact form integration",
      status: "DRAFT",
      paymentEnabled: false,
      clientVisible: false,
      sortOrder: String(plans.length + 1),
      popular: false,
    });
    setEditModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (plan: Plan) => {
    setIsCreating(false);
    setSelectedPlan(plan);
    setFormValues({
      serviceName: plan.serviceName || plan.name,
      name: plan.name,
      serviceId: plan.serviceId,
      serviceNumber: plan.serviceNumber,
      category: plan.category,
      tier: plan.tier || "Standard",
      price: String(plan.price),
      priceDisplay: plan.priceDisplay || `$${plan.price.toLocaleString()}`,
      priceMax: plan.priceMax ? String(plan.priceMax) : "",
      pricingType: plan.pricingType || "fixed",
      currency: plan.currency || "USD",
      billingInterval: plan.billingInterval || "one_time",
      deliveryTimeline: plan.deliveryTimeline || "",
      supportDuration: plan.supportDuration || "",
      targetCustomer: plan.targetCustomer || "",
      tag: plan.tag || "",
      description: plan.description || "",
      features: (plan.features || []).join("\n"),
      status: plan.status || "PUBLISHED",
      paymentEnabled: Boolean(plan.paymentEnabled),
      clientVisible: Boolean(plan.clientVisible),
      sortOrder: String(plan.sortOrder || 0),
      popular: Boolean(plan.popular),
    });
    setEditModalOpen(true);
  };

  // Save Plan (Create or Update)
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);

    try {
      const payload = {
        serviceName: formValues.serviceName.trim(),
        name: formValues.name.trim(),
        serviceId: formValues.serviceId.trim().toLowerCase(),
        serviceNumber: formValues.serviceNumber.trim(),
        category: formValues.category,
        tier: formValues.tier.trim(),
        price: Number(formValues.price) || 0,
        priceDisplay: formValues.priceDisplay.trim(),
        priceMax: formValues.priceMax ? Number(formValues.priceMax) : null,
        pricingType: formValues.pricingType,
        currency: formValues.currency,
        billingInterval: formValues.billingInterval,
        deliveryTimeline: formValues.deliveryTimeline.trim(),
        supportDuration: formValues.supportDuration.trim(),
        targetCustomer: formValues.targetCustomer.trim(),
        tag: formValues.tag.trim(),
        description: formValues.description.trim(),
        features: formValues.features.split("\n").map((f) => f.trim()).filter(Boolean),
        status: formValues.status,
        paymentEnabled: formValues.status === "PUBLISHED" ? formValues.paymentEnabled : false,
        clientVisible: formValues.status === "PUBLISHED" || formValues.status === "WAITING" ? formValues.clientVisible : false,
        sortOrder: Number(formValues.sortOrder) || 0,
        popular: formValues.popular,
      };

      const url = isCreating ? "/admin/services-plans" : `/admin/services-plans/${selectedPlan?.id}`;
      const method = isCreating ? "POST" : "PATCH";

      const res = await apiCall(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }

      showNotification("success", isCreating ? "Package created successfully." : "Package updated successfully.");
      setEditModalOpen(false);
      await loadCatalogue();
    } catch (err: any) {
      showNotification("error", err.message || "Failed to save plan");
    } finally {
      setSavingPlan(false);
    }
  };

  // Quick Action Handlers
  const handleQuickPublish = async (plan: Plan) => {
    const actionKey = `publish-${plan.id}`;
    if (actionLoading[actionKey]) return;
    setPlanActionLoading(actionKey, true);
    try {
      const res = await apiCall(`/admin/services-plans/${plan.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ paymentEnabled: plan.pricingType === "fixed" && plan.price > 0 }),
      });
      if (res.ok) {
        showNotification("success", `Package "${plan.name}" published successfully.`);
        await loadCatalogue();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification("error", err.error || "Publish failed");
      }
    } catch (e: any) {
      showNotification("error", e.message || "Action failed");
    } finally {
      setPlanActionLoading(actionKey, false);
    }
  };

  const handleQuickUnpublish = async (plan: Plan) => {
    const actionKey = `unpublish-${plan.id}`;
    if (actionLoading[actionKey]) return;
    setPlanActionLoading(actionKey, true);
    try {
      const res = await apiCall(`/admin/services-plans/${plan.id}/unpublish`, {
        method: "POST",
        body: JSON.stringify({ targetStatus: "DRAFT" }),
      });
      if (res.ok) {
        showNotification("success", `Package "${plan.name}" unpublished successfully.`);
        await loadCatalogue();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification("error", err.error || "Unpublish failed");
      }
    } catch (e: any) {
      showNotification("error", e.message || "Action failed");
    } finally {
      setPlanActionLoading(actionKey, false);
    }
  };

  const handleQuickSetWaiting = async (plan: Plan) => {
    const actionKey = `waiting-${plan.id}`;
    if (actionLoading[actionKey]) return;
    setPlanActionLoading(actionKey, true);
    try {
      const res = await apiCall(`/admin/services-plans/${plan.id}/waiting`, { method: "POST" });
      if (res.ok) {
        showNotification("success", `Package "${plan.name}" set to WAITING (Coming Soon).`);
        await loadCatalogue();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification("error", err.error || "Action failed");
      }
    } catch (e: any) {
      showNotification("error", e.message || "Action failed");
    } finally {
      setPlanActionLoading(actionKey, false);
    }
  };

  const handleQuickSetDraft = async (plan: Plan) => {
    const actionKey = `draft-${plan.id}`;
    if (actionLoading[actionKey]) return;
    setPlanActionLoading(actionKey, true);
    try {
      const res = await apiCall(`/admin/services-plans/${plan.id}/draft`, { method: "POST" });
      if (res.ok) {
        showNotification("success", `Package "${plan.name}" moved to DRAFT. Hidden from Client Portal.`);
        await loadCatalogue();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification("error", err.error || "Action failed");
      }
    } catch (e: any) {
      showNotification("error", e.message || "Action failed");
    } finally {
      setPlanActionLoading(actionKey, false);
    }
  };

  const handleTogglePayment = async (plan: Plan) => {
    if (plan.status !== "PUBLISHED") {
      showNotification("error", `Cannot enable checkout for a plan in '${plan.status}' status. Plan must be PUBLISHED first.`);
      return;
    }
    const actionKey = `payment-${plan.id}`;
    if (actionLoading[actionKey]) return;
    setPlanActionLoading(actionKey, true);
    try {
      const res = await apiCall(`/admin/services-plans/${plan.id}/payment`, {
        method: "POST",
        body: JSON.stringify({ enabled: !plan.paymentEnabled }),
      });
      if (res.ok) {
        showNotification("success", `Payment ${!plan.paymentEnabled ? "enabled" : "disabled"} for "${plan.name}".`);
        await loadCatalogue();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification("error", err.error || "Action failed");
      }
    } catch (e: any) {
      showNotification("error", e.message || "Action failed");
    } finally {
      setPlanActionLoading(actionKey, false);
    }
  };

  const handleDuplicate = async (plan: Plan) => {
    const actionKey = `duplicate-${plan.id}`;
    if (actionLoading[actionKey]) return;
    setPlanActionLoading(actionKey, true);
    try {
      const res = await apiCall(`/admin/services-plans/${plan.id}/duplicate`, { method: "POST" });
      if (res.ok) {
        showNotification("success", `Package "${plan.name}" duplicated successfully.`);
        await loadCatalogue();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification("error", err.error || "Duplicate failed");
      }
    } catch (e: any) {
      showNotification("error", e.message || "Duplicate failed");
    } finally {
      setPlanActionLoading(actionKey, false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archiveModalPlan || archiving) return;
    setArchiving(true);
    try {
      const res = await apiCall(`/admin/services-plans/${archiveModalPlan.id}/archive`, { method: "POST" });
      if (res.ok) {
        showNotification("success", `Package "${archiveModalPlan.name}" archived successfully.`);
        setArchiveModalPlan(null);
        await loadCatalogue();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification("error", err.error || "Archive failed");
      }
    } catch (e: any) {
      showNotification("error", e.message || "Archive failed");
    } finally {
      setArchiving(false);
    }
  };

  // Filtered plans calculation
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      // Search filter
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.serviceName || "").toLowerCase().includes(q) ||
        p.serviceId.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tag.toLowerCase().includes(q);

      // Category filter
      const matchesCategory = categoryFilter === "ALL" || p.category === categoryFilter;

      // Status filter
      const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;

      // Payment filter
      const matchesPayment =
        paymentFilter === "ALL" ||
        (paymentFilter === "ENABLED" && p.paymentEnabled) ||
        (paymentFilter === "DISABLED" && !p.paymentEnabled);

      // Billing filter
      const matchesBilling =
        billingFilter === "ALL" ||
        (billingFilter === "ONE_TIME" && p.billingInterval === "one_time") ||
        (billingFilter === "MONTHLY" && p.billingInterval === "monthly");

      return matchesSearch && matchesCategory && matchesStatus && matchesPayment && matchesBilling;
    });
  }, [plans, search, categoryFilter, statusFilter, paymentFilter, billingFilter]);

  // Dynamic Category Counts from live DB records
  const dynamicCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: plans.length };
    CATEGORIES.forEach((c) => {
      counts[c] = plans.filter((p) => p.category === c).length;
    });
    return counts;
  }, [plans]);

  return (
    <div className="space-y-6">
      {/* ── Action Notification Toast ────────────────────────────────────── */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-sm ${
              actionMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{actionMessage.text}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="cursor-pointer text-slate-400 hover:text-slate-700">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Header & Actions ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#214ECF]/10 text-[#214ECF] flex items-center justify-center">
              <Layers size={18} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Services &amp; Plans Control Centre</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative master catalogue for Thinkatic. All price changes immediately sync to Client Portal and PayPal orders.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => {
              loadAuditLogs();
              setAuditLogsOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
          >
            <History size={14} className="text-[#214ECF]" />
            Audit Logs
          </button>

          <button
            onClick={() => {
              setRefreshing(true);
              loadCatalogue();
            }}
            disabled={refreshing || loading}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer shadow-2xs disabled:opacity-60"
          >
            <RefreshCw size={14} className={`text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>+ Create Service / Plan</span>
          </button>
        </div>
      </div>

      {/* ── Top 7 KPI Cards ──────────────────────────────────────────────── */}
      {loading && plans.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs animate-pulse">
              <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
              <div className="h-7 w-10 bg-slate-200 rounded mb-1.5" />
              <div className="h-2.5 w-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Services</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Authoritative Catalogue</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Published</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{stats.published}</div>
            <div className="text-[10px] text-emerald-600/80 mt-0.5">Client Visible</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Waiting</div>
            <div className="text-2xl font-black text-amber-700 mt-1">{stats.waiting}</div>
            <div className="text-[10px] text-amber-600/80 mt-0.5">Coming Soon</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Drafts</div>
            <div className="text-2xl font-black text-slate-700 mt-1">{stats.drafts}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Admin Only</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-blue-200/80 bg-blue-50/20 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#214ECF]">Payment Enabled</div>
            <div className="text-2xl font-black text-[#214ECF] mt-1">{stats.paymentEnabled}</div>
            <div className="text-[10px] text-blue-600/80 mt-0.5">Checkout Active</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment Disabled</div>
            <div className="text-2xl font-black text-slate-700 mt-1">{stats.paymentDisabled}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Consultation / Quote</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-rose-200/80 bg-rose-50/20 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Archived</div>
            <div className="text-2xl font-black text-rose-700 mt-1">{stats.archived}</div>
            <div className="text-[10px] text-rose-600/80 mt-0.5">Historical Preserved</div>
          </div>
        </div>
      )}

      {/* ── Search, Filters, and View Switcher ────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plans, services, features, slugs..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#214ECF] focus:bg-white transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Dropdowns & View Mode */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:border-[#214ECF]"
            >
              <option value="ALL">Status: All</option>
              <option value="PUBLISHED">Published ({stats.published})</option>
              <option value="WAITING">Waiting ({stats.waiting})</option>
              <option value="DRAFT">Draft ({stats.drafts})</option>
              <option value="ARCHIVED">Archived ({stats.archived})</option>
            </select>

            {/* Payment Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:border-[#214ECF]"
            >
              <option value="ALL">Payment: All</option>
              <option value="ENABLED">Payment Enabled ({stats.paymentEnabled})</option>
              <option value="DISABLED">Payment Disabled ({stats.paymentDisabled})</option>
            </select>

            {/* Billing Filter */}
            <select
              value={billingFilter}
              onChange={(e) => setBillingFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:border-[#214ECF]"
            >
              <option value="ALL">Billing: All</option>
              <option value="ONE_TIME">One-time</option>
              <option value="MONTHLY">Monthly</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "table" ? "bg-white text-[#214ECF] shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
                title="Table View"
              >
                <TableIcon size={14} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "grid" ? "bg-white text-[#214ECF] shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
                title="Grid / Card View"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Pills (Exact Live Counts) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase tracking-wider">Categories:</span>
          {["ALL", ...CATEGORIES].map((cat) => {
            const count = dynamicCategoryCounts[cat] ?? 0;
            const isSelected = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isSelected
                    ? "bg-[#214ECF] text-white shadow-2xs"
                    : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{cat}</span>
                {loading && plans.length === 0 ? (
                  <span className="w-4 h-3 bg-slate-200 rounded animate-pulse inline-block" />
                ) : (
                  <span>({count})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Table or Grid View ───────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Loading authoritative master catalogue...</p>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
          <Layers size={36} className="text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Services or Plans Match Your Filter</h3>
          <p className="text-xs text-slate-500 mt-1">Try resetting the category or status filter, or create a new plan.</p>
          <button
            onClick={() => {
              setSearch("");
              setCategoryFilter("ALL");
              setStatusFilter("ALL");
              setPaymentFilter("ALL");
              setBillingFilter("ALL");
            }}
            className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      ) : viewMode === "table" ? (
        /* ── TABLE VIEW ─────────────────────────────────────────────────── */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">Plan / Service</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Tier</th>
                  <th className="py-3.5 px-4">Price</th>
                  <th className="py-3.5 px-4">Billing</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Client Visibility</th>
                  <th className="py-3.5 px-4 text-center">Payment</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredPlans.map((plan) => {
                  const catColor = CATEGORY_COLORS[plan.category] || { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" };
                  const isFixed = plan.pricingType === "fixed" && plan.price > 0;

                  return (
                    <tr key={plan.id} className="hover:bg-blue-50/30 transition-colors group">
                      {/* Name & Service ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-[10px] font-bold text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">
                            #{plan.serviceNumber}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              {plan.name}
                              {plan.popular && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold">
                                  Popular
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-normal">
                              {plan.serviceName || plan.category} · <span className="font-mono text-[10px]">{plan.serviceId}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                          style={{ backgroundColor: catColor.bg, color: catColor.text, borderColor: catColor.border }}
                        >
                          {plan.category}
                        </span>
                      </td>

                      {/* Tier */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {plan.tier || "Standard"}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {plan.priceDisplay || (plan.price > 0 ? `$${plan.price.toLocaleString()}` : "Custom Pricing")}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">
                          {plan.pricingType || (isFixed ? "fixed" : "custom")}
                        </div>
                      </td>

                      {/* Billing */}
                      <td className="py-3 px-4">
                        <span className="text-[11px] text-slate-600 font-medium">
                          {plan.billingInterval === "monthly" ? "Monthly" : "One-time"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {plan.status === "PUBLISHED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            PUBLISHED
                          </span>
                        ) : plan.status === "WAITING" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock size={10} />
                            WAITING
                          </span>
                        ) : plan.status === "DRAFT" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            DRAFT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Archive size={10} />
                            ARCHIVED
                          </span>
                        )}
                      </td>

                      {/* Client Visibility */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            if (plan.status === "DRAFT" || plan.status === "ARCHIVED") {
                              showNotification("error", `Plan is in '${plan.status}' status. Publish or set Waiting to make it visible to clients.`);
                              return;
                            }
                            handleQuickSetDraft(plan);
                          }}
                          disabled={actionLoading[`draft-${plan.id}`]}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all mx-auto flex items-center justify-center gap-1 ${
                            plan.clientVisible && (plan.status === "PUBLISHED" || plan.status === "WAITING")
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                              : "bg-slate-100 text-slate-500 cursor-pointer"
                          }`}
                          title={plan.clientVisible ? "Click to move to Draft (hide)" : "Hidden from client"}
                        >
                          {actionLoading[`draft-${plan.id}`] ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : null}
                          <span>{plan.clientVisible && (plan.status === "PUBLISHED" || plan.status === "WAITING") ? "Visible" : "Hidden"}</span>
                        </button>
                      </td>

                      {/* Payment */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleTogglePayment(plan)}
                          disabled={plan.status !== "PUBLISHED" || actionLoading[`payment-${plan.id}`]}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all mx-auto flex items-center justify-center gap-1 ${
                            plan.status !== "PUBLISHED"
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : plan.paymentEnabled
                              ? "bg-blue-50 text-[#214ECF] hover:bg-blue-100 cursor-pointer"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                          }`}
                          title={plan.status !== "PUBLISHED" ? "Payment can only be enabled on PUBLISHED plans" : "Click to toggle payment"}
                        >
                          {actionLoading[`payment-${plan.id}`] ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : null}
                          <span>{plan.paymentEnabled ? "Enabled" : "Disabled"}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                          <button
                            onClick={() => setViewDetailsPlan(plan)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="View Full Specifications"
                          >
                            <Eye size={14} />
                          </button>

                          <button
                            onClick={() => openEditModal(plan)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#214ECF] hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Edit Plan & Pricing"
                          >
                            <Pencil size={14} />
                          </button>

                          {/* Quick Status Toggles (Publish / Unpublish) */}
                          {plan.status !== "PUBLISHED" ? (
                            <button
                              onClick={() => handleQuickPublish(plan)}
                              disabled={actionLoading[`publish-${plan.id}`] || actionLoading[`unpublish-${plan.id}`]}
                              className="h-7 px-2.5 rounded-lg text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                              title="Publish Plan"
                            >
                              {actionLoading[`publish-${plan.id}`] ? (
                                <>
                                  <Loader2 size={11} className="animate-spin" />
                                  <span>Publishing...</span>
                                </>
                              ) : (
                                <span>Publish</span>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleQuickUnpublish(plan)}
                              disabled={actionLoading[`publish-${plan.id}`] || actionLoading[`unpublish-${plan.id}`]}
                              className="h-7 px-2.5 rounded-lg text-[10px] font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-2xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                              title="Unpublish Plan (Revert to Draft)"
                            >
                              {actionLoading[`unpublish-${plan.id}`] ? (
                                <>
                                  <Loader2 size={11} className="animate-spin" />
                                  <span>Unpublishing...</span>
                                </>
                              ) : (
                                <span>Unpublish</span>
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => handleDuplicate(plan)}
                            disabled={actionLoading[`duplicate-${plan.id}`]}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                            title="Duplicate Plan (Creates DRAFT copy)"
                          >
                            {actionLoading[`duplicate-${plan.id}`] ? (
                              <Loader2 size={13} className="animate-spin text-slate-600" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>

                          <button
                            onClick={() => setArchiveModalPlan(plan)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Archive Plan"
                          >
                            <Archive size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── GRID / CARD VIEW ───────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPlans.map((plan) => {
            const catColor = CATEGORY_COLORS[plan.category] || { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" };
            return (
              <div
                key={plan.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all group"
              >
                <div>
                  {/* Header Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                      #{plan.serviceNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                        style={{ backgroundColor: catColor.bg, color: catColor.text, borderColor: catColor.border }}
                      >
                        {plan.category}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {plan.tier || "Standard"}
                      </span>
                    </div>
                  </div>

                  {/* Title & Service Name */}
                  <h3 className="font-bold text-slate-900 text-base leading-snug">{plan.name}</h3>
                  <div className="text-xs text-slate-400 mb-2 font-medium">{plan.serviceName || plan.category}</div>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">{plan.description}</p>

                  {/* Price Block */}
                  <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-xl font-extrabold text-slate-900">
                        {plan.priceDisplay || (plan.price > 0 ? `$${plan.price.toLocaleString()}` : "Custom Pricing")}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {plan.billingInterval === "monthly" ? "Monthly Billing" : (plan.pricingType === "custom" ? "Custom Scope" : "One-Time Project")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Authoritative Price</div>
                      <div className="text-xs font-mono font-bold text-[#214ECF]">
                        {plan.price > 0 ? `$${plan.price.toLocaleString()} USD` : (plan.priceDisplay || "Custom / Quote")}
                      </div>
                    </div>
                  </div>

                  {/* Badges: Status & Payment */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="p-2 rounded-xl border border-slate-100 bg-white">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Status</div>
                      <div className="font-bold mt-0.5">
                        {plan.status === "PUBLISHED" ? (
                          <span className="text-emerald-700">PUBLISHED</span>
                        ) : plan.status === "WAITING" ? (
                          <span className="text-amber-700">WAITING</span>
                        ) : plan.status === "DRAFT" ? (
                          <span className="text-slate-600">DRAFT</span>
                        ) : (
                          <span className="text-rose-700">ARCHIVED</span>
                        )}
                      </div>
                    </div>

                    <div className="p-2 rounded-xl border border-slate-100 bg-white">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Payment</div>
                      <div className="font-bold mt-0.5">
                        {plan.paymentEnabled ? (
                          <span className="text-[#214ECF]">Checkout Enabled</span>
                        ) : (
                          <span className="text-slate-500">Disabled / Quote</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Specifications */}
                  {(plan.deliveryTimeline || plan.supportDuration) && (
                    <div className="space-y-1 text-[11px] text-slate-500 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 mb-4">
                      {plan.deliveryTimeline && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">⏱ Timeline:</span>
                          <span className="font-semibold text-slate-700">{plan.deliveryTimeline}</span>
                        </div>
                      )}
                      {plan.supportDuration && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">🛡 Support:</span>
                          <span className="font-semibold text-slate-700">{plan.supportDuration}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setViewDetailsPlan(plan)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="View Details"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={() => openEditModal(plan)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[#214ECF] hover:bg-blue-50 transition-colors cursor-pointer"
                      title="Edit Plan"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDuplicate(plan)}
                      disabled={actionLoading[`duplicate-${plan.id}`]}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                      title="Duplicate"
                    >
                      {actionLoading[`duplicate-${plan.id}`] ? (
                        <Loader2 size={14} className="animate-spin text-slate-600" />
                      ) : (
                        <Copy size={15} />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {plan.status !== "PUBLISHED" ? (
                      <button
                        onClick={() => handleQuickPublish(plan)}
                        disabled={actionLoading[`publish-${plan.id}`] || actionLoading[`unpublish-${plan.id}`]}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {actionLoading[`publish-${plan.id}`] ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Publishing...</span>
                          </>
                        ) : (
                          <span>Publish</span>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleQuickUnpublish(plan)}
                        disabled={actionLoading[`publish-${plan.id}`] || actionLoading[`unpublish-${plan.id}`]}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {actionLoading[`unpublish-${plan.id}`] ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Unpublishing...</span>
                          </>
                        ) : (
                          <span>Unpublish</span>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setArchiveModalPlan(plan)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Archive Plan"
                    >
                      <Archive size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CREATE & EDIT PLAN MODAL                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {editModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 sm:p-7 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#214ECF]/10 text-[#214ECF] flex items-center justify-center font-bold">
                    {isCreating ? <Plus size={18} /> : <Pencil size={16} />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {isCreating ? "Create New Service / Plan" : `Edit Plan: ${selectedPlan?.name}`}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Authoritative configuration. Updates immediately sync to database and PayPal.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSavePlan} className="space-y-4 pt-4 text-xs">
                {/* Row 1: Service Name & Plan Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Service Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formValues.serviceName}
                      onChange={(e) => setFormValues({ ...formValues, serviceName: e.target.value })}
                      placeholder="e.g. Business Website Development"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#214ECF] text-slate-900 font-medium focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Plan / Package Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formValues.name}
                      onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                      placeholder="e.g. STARTER or PROFESSIONAL"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#214ECF] text-slate-900 font-medium focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 2: Category, Tier, and Service Number */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formValues.category}
                      onChange={(e) => setFormValues({ ...formValues, category: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#214ECF] text-slate-900 font-semibold focus:outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Tier
                    </label>
                    <input
                      type="text"
                      value={formValues.tier}
                      onChange={(e) => setFormValues({ ...formValues, tier: e.target.value })}
                      placeholder="e.g. STARTER, PRO, ENTERPRISE"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#214ECF] text-slate-900 font-medium focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Service #
                    </label>
                    <input
                      type="text"
                      value={formValues.serviceNumber}
                      onChange={(e) => setFormValues({ ...formValues, serviceNumber: e.target.value })}
                      placeholder="01"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#214ECF] text-slate-900 font-mono font-medium focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 3: Authoritative Price, Pricing Type, and Price Display */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-3.5 bg-blue-50/40 rounded-2xl border border-blue-100">
                  <div>
                    <label className="block text-[11px] font-bold text-[#214ECF] uppercase tracking-wider mb-1">
                      Authoritative Price ($) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={formValues.price}
                        onChange={(e) => setFormValues({ ...formValues, price: e.target.value })}
                        className="w-full pl-8 pr-3.5 py-2 rounded-xl border border-blue-200 bg-white focus:border-[#214ECF] text-slate-900 font-bold focus:outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Sent directly to PayPal</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Pricing Type
                    </label>
                    <select
                      value={formValues.pricingType}
                      onChange={(e) =>
                        setFormValues({ ...formValues, pricingType: e.target.value as "fixed" | "range" | "custom" })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:border-[#214ECF] text-slate-900 font-semibold focus:outline-none"
                    >
                      <option value="fixed">FIXED (PayPal Checkout)</option>
                      <option value="range">FROM / RANGE (Consultation)</option>
                      <option value="custom">CUSTOM (Quote Flow)</option>
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">Fixed allows online checkout</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Price Display Label
                    </label>
                    <input
                      type="text"
                      value={formValues.priceDisplay}
                      onChange={(e) => setFormValues({ ...formValues, priceDisplay: e.target.value })}
                      placeholder="e.g. $499 or From $5,000+"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:border-[#214ECF] text-slate-900 font-medium focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Visible to clients in portal</span>
                  </div>
                </div>

                {/* Row 4: Billing Type, Delivery Timeline, and Support Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Billing Type
                    </label>
                    <select
                      value={formValues.billingInterval}
                      onChange={(e) =>
                        setFormValues({ ...formValues, billingInterval: e.target.value as "one_time" | "monthly" })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#214ECF] text-slate-900 font-semibold focus:outline-none"
                    >
                      <option value="one_time">One-time Project</option>
                      <option value="monthly">Monthly Subscription</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Delivery Timeline
                    </label>
                    <input
                      type="text"
                      value={formValues.deliveryTimeline}
                      onChange={(e) => setFormValues({ ...formValues, deliveryTimeline: e.target.value })}
                      placeholder="e.g. 5–7 days"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#214ECF] text-slate-900 font-medium focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Support Duration
                    </label>
                    <input
                      type="text"
                      value={formValues.supportDuration}
                      onChange={(e) => setFormValues({ ...formValues, supportDuration: e.target.value })}
                      placeholder="e.g. 30 days support"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#214ECF] text-slate-900 font-medium focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 5: Tag & Target Customer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Tag / Badge
                    </label>
                    <input
                      type="text"
                      value={formValues.tag}
                      onChange={(e) => setFormValues({ ...formValues, tag: e.target.value })}
                      placeholder="e.g. Small Business Entry, Most Popular"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#214ECF] text-slate-900 font-medium focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Target Customer / Fit
                    </label>
                    <input
                      type="text"
                      value={formValues.targetCustomer}
                      onChange={(e) => setFormValues({ ...formValues, targetCustomer: e.target.value })}
                      placeholder="e.g. Small businesses, consultants"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#214ECF] text-slate-900 font-medium focus:outline-none"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Short Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formValues.description}
                    onChange={(e) => setFormValues({ ...formValues, description: e.target.value })}
                    placeholder="Clear summary of what this plan delivers..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#214ECF] text-slate-900 font-medium focus:outline-none resize-none"
                  />
                </div>

                {/* Features (One per line) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Features / Key Deliverables (One per line)
                  </label>
                  <textarea
                    rows={4}
                    value={formValues.features}
                    onChange={(e) => setFormValues({ ...formValues, features: e.target.value })}
                    placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#214ECF] text-slate-900 font-mono text-xs focus:outline-none"
                  />
                </div>

                {/* Status & Governance Controls */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Master Status &amp; Governance
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Lifecycle Status
                      </label>
                      <select
                        value={formValues.status}
                        onChange={(e) =>
                          setFormValues({
                            ...formValues,
                            status: e.target.value as PlanStatus,
                            clientVisible: e.target.value === "PUBLISHED" || e.target.value === "WAITING",
                            paymentEnabled: e.target.value === "PUBLISHED" ? formValues.paymentEnabled : false,
                          })
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 focus:outline-none"
                      >
                        <option value="DRAFT">DRAFT (Hidden, preparation)</option>
                        <option value="WAITING">WAITING (Coming Soon, no checkout)</option>
                        <option value="PUBLISHED">PUBLISHED (Live on Client Portal)</option>
                        <option value="ARCHIVED">ARCHIVED (Soft-deleted, history intact)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Sort / Display Order
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formValues.sortOrder}
                        onChange={(e) => setFormValues({ ...formValues, sortOrder: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Checkboxes: Payment & Visibility */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-4 border-t border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formValues.paymentEnabled}
                        disabled={formValues.status !== "PUBLISHED"}
                        onChange={(e) => setFormValues({ ...formValues, paymentEnabled: e.target.checked })}
                        className="w-4 h-4 rounded text-[#214ECF] focus:ring-[#214ECF]"
                      />
                      <span className={`text-xs font-semibold ${formValues.status !== "PUBLISHED" ? "text-slate-400" : "text-slate-800"}`}>
                        Payment Enabled (Direct PayPal checkout)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formValues.clientVisible}
                        disabled={formValues.status === "DRAFT" || formValues.status === "ARCHIVED"}
                        onChange={(e) => setFormValues({ ...formValues, clientVisible: e.target.checked })}
                        className="w-4 h-4 rounded text-[#214ECF] focus:ring-[#214ECF]"
                      />
                      <span className={`text-xs font-semibold ${formValues.status === "DRAFT" || formValues.status === "ARCHIVED" ? "text-slate-400" : "text-slate-800"}`}>
                        Client Visible
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formValues.popular}
                        onChange={(e) => setFormValues({ ...formValues, popular: e.target.checked })}
                        className="w-4 h-4 rounded text-[#214ECF] focus:ring-[#214ECF]"
                      />
                      <span className="text-xs font-semibold text-slate-800">Popular / Highlight Badge</span>
                    </label>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPlan}
                    className="px-5 py-2.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {savingPlan ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>{isCreating ? "Create & Save (DRAFT)" : "Save & Synchronize Price"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* VIEW PLAN SPECIFICATIONS MODAL                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {viewDetailsPlan && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-xl w-full p-6 sm:p-7 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    #{viewDetailsPlan.serviceNumber}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{viewDetailsPlan.name}</h3>
                    <div className="text-xs text-slate-400">{viewDetailsPlan.serviceName || viewDetailsPlan.category}</div>
                  </div>
                </div>
                <button
                  onClick={() => setViewDetailsPlan(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 pt-4 text-xs">
                {/* Status & Pricing Banner */}
                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-black text-slate-900">
                      {viewDetailsPlan.priceDisplay || (viewDetailsPlan.price > 0 ? `$${viewDetailsPlan.price.toLocaleString()}` : "Custom Pricing")}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      {viewDetailsPlan.billingInterval === "monthly" ? "Monthly Subscription" : "One-Time Project"} · Authoritative: {viewDetailsPlan.price > 0 ? `$${viewDetailsPlan.price} USD` : (viewDetailsPlan.priceDisplay || "Custom Quote")}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-[#214ECF] border border-blue-200 block">
                      {viewDetailsPlan.status}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 block">
                      Payment: {viewDetailsPlan.paymentEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</div>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                    {viewDetailsPlan.description}
                  </p>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-2 gap-3 text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Category</span>
                    <span className="font-semibold">{viewDetailsPlan.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Tier</span>
                    <span className="font-semibold">{viewDetailsPlan.tier || "Standard"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Timeline</span>
                    <span className="font-semibold">{viewDetailsPlan.deliveryTimeline || "Standard"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Support</span>
                    <span className="font-semibold">{viewDetailsPlan.supportDuration || "Standard"}</span>
                  </div>
                  {viewDetailsPlan.targetCustomer && (
                    <div className="col-span-2 pt-1 border-t border-slate-200/60">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Fit</span>
                      <span className="font-semibold">{viewDetailsPlan.targetCustomer}</span>
                    </div>
                  )}
                </div>

                {/* Features Checklist */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Key Deliverables</div>
                  <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    {(viewDetailsPlan.features || []).map((feat, i) => (
                      <div key={i} className="flex items-start gap-2 text-slate-700">
                        <Check size={14} className="text-[#214ECF] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setViewDetailsPlan(null);
                      openEditModal(viewDetailsPlan);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    Edit This Plan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ARCHIVE / DELETE CONFIRMATION MODAL                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {archiveModalPlan && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3.5 border border-rose-100">
                <Archive size={22} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Archive "{archiveModalPlan.name}"?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Archiving removes this plan from the Client Portal and disables new checkouts.
                <br /><br />
                <strong className="text-slate-700">Historical Integrity Guarantee:</strong> Any past client purchases, contracts, and invoices referencing this plan will remain 100% intact.
              </p>

              <div className="mt-6 flex items-center justify-center gap-2.5">
                <button
                  onClick={() => setArchiveModalPlan(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchiveConfirm}
                  disabled={archiving}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {archiving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Archiving...</span>
                    </>
                  ) : (
                    <span>Confirm Archive</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* AUDIT LOGS MODAL / DRAWER                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {auditLogsOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <History size={18} className="text-[#214ECF]" />
                  <h3 className="text-base font-bold text-slate-900">Services &amp; Plans Audit Trail</h3>
                </div>
                <button onClick={() => setAuditLogsOpen(false)} className="p-1 rounded text-slate-400 hover:text-slate-700">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs">
                {loadingAudit ? (
                  <p className="text-center py-8 text-slate-400">Loading audit history...</p>
                ) : auditLogs.length === 0 ? (
                  <p className="text-center py-8 text-slate-400">No audit records found yet.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#214ECF]">{log.action}</span>
                          <span className="text-[10px] text-slate-400">Plan #{log.entity_id}</span>
                        </div>
                        {log.metadata?.plan_name && (
                          <div className="font-medium text-slate-800 mt-0.5">{log.metadata.plan_name}</div>
                        )}
                        {log.action === "PRICE_CHANGED" && (
                          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
                            Price modified: ${log.metadata?.old_price} → ${log.metadata?.new_price}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 shrink-0 text-right">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
