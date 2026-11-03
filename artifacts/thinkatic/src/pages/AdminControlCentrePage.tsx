import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  Plus,
  Clock,
  Sparkles,
  X,
  Check,
  Send,
  Cable,
  RefreshCw,
  Headset,
  ChevronLeft,
  ChevronRight,
  Menu,
  UserPlus,
  Factory,
  Ticket,
  FileCheck,
  Receipt,
  CreditCard,
  Trash2,
  MessageSquareText,
  Video,
} from "lucide-react";
import BpoOperationsCommandCentre from "@/components/admin/BpoOperationsCommandCentre";
import AdminOperationsFinancePanel from "@/components/admin/AdminOperationsFinancePanel";
import AdminCapacityMarketplacePanel from "@/components/admin/AdminCapacityMarketplacePanel";
import AdminIntegrationsPanel from "@/components/admin/AdminIntegrationsPanel";
import AdminAgreementsPanel from "@/components/admin/AdminAgreementsPanel";
import AdminCentreVerificationPanel from "@/components/admin/AdminCentreVerificationPanel";
// BPO Approvals moved to Classic Dashboard per user requirement.
// import AdminBpoApprovalsPanel from "@/components/admin/AdminBpoApprovalsPanel";
import AdminPublicTicketsPanel from "@/components/admin/AdminPublicTicketsPanel";
import AdminFeatureControlCentre from "@/components/admin/AdminFeatureControlCentre";
import AdminBpoConnectSection from "@/components/admin/AdminBpoConnectSection";
import AdminBpoMeetingsSection from "@/components/admin/AdminBpoMeetingsSection";

function AnimatedCounter({ value, isCurrency = false }: { value: number; isCurrency?: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }

    if (value === 0) {
      setDisplayValue(0);
      return;
    }

    const duration = 600;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(easeProgress * value);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };

    const animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  if (isCurrency) {
    return <span>${displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
  }
  return <span>{displayValue.toLocaleString()}</span>;
}

function getActivityMeta(action: string) {
  switch (action) {
    case "admin_login":
      return {
        title: "Admin Session Authenticated",
        description: "Administrative console access verified",
        icon: ShieldCheck,
        bgClass: "bg-blue-50 text-[#214ECF]",
      };
    case "module_changed":
      return {
        title: "Operations Module Accessed",
        description: "Control centre navigation event",
        icon: Activity,
        bgClass: "bg-indigo-50 text-indigo-600",
      };
    case "bpo_approved":
      return {
        title: "BPO Application Approved",
        description: "Partner credentials verified & activated",
        icon: CheckCircle2,
        bgClass: "bg-emerald-50 text-emerald-600",
      };
    case "bpo_rejected":
      return {
        title: "BPO Application Rejected",
        description: "Application rejected with reason",
        icon: AlertTriangle,
        bgClass: "bg-rose-50 text-rose-600",
      };
    case "bpo_resubmission_required":
      return {
        title: "Resubmission Requested",
        description: "Clarifications requested for applicant",
        icon: Clock,
        bgClass: "bg-amber-50 text-amber-600",
      };
    case "bpo_suspended":
      return {
        title: "BPO Partner Suspended / Hold",
        description: "Operational access placed on administrative hold",
        icon: AlertTriangle,
        bgClass: "bg-amber-50 text-amber-600",
      };
    case "bpo_restored":
      return {
        title: "BPO Partner Access Restored",
        description: "Operational access restored by Administrator",
        icon: CheckCircle2,
        bgClass: "bg-emerald-50 text-emerald-600",
      };
    case "lead_deleted":
      return {
        title: "Lead Record Removed",
        description: "Inbound proposal deleted from CRM",
        icon: Trash2,
        bgClass: "bg-slate-100 text-slate-600",
      };
    default:
      return {
        title: action ? action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Audit Event",
        description: "Platform operational audit log",
        icon: Activity,
        bgClass: "bg-slate-100 text-slate-600",
      };
  }
}

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

const navItems = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  /* CRM NAVIGATION ENTRY COMMENTED OUT PER USER REQUIREMENT - PRESERVED FOR RESTORATION
  { key: "crm", label: "CRM", icon: Users },
  */
  /* CLIENTS NAVIGATION ENTRY COMMENTED OUT PER USER REQUIREMENT - PRESERVED FOR RESTORATION
  { key: "clients", label: "Clients", icon: BriefcaseBusiness },
  */
  /* BPO PARTNERS NAVIGATION ENTRY COMMENTED OUT PER USER REQUIREMENT - PRESERVED FOR RESTORATION
  { key: "partners", label: "BPO Partners", icon: Building2 },
  */
  /* BPO APPROVALS NAVIGATION ENTRY MOVED TO CLASSIC DASHBOARD PER USER REQUIREMENT - PRESERVED FOR RESTORATION
  { key: "bpo-management", label: "BPO Approvals", icon: ShieldCheck },
  */
  { key: "centre-verification", label: "Office Verification", icon: Building2 },
  { key: "agreements", label: "Partner Agreements", icon: FileText },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "capacity-marketplace", label: "Capacity Marketplace", icon: Sparkles },
  { key: "operations", label: "BPO Operations", icon: Activity },
  { key: "public-tickets", label: "Public Tickets", icon: Ticket },
  { key: "bpo-connect", label: "BPO Connect", icon: MessageSquareText },
  { key: "bpo-meetings", label: "BPO Meetings", icon: Video },
  { key: "integrations", label: "Dialer & CRM", icon: Cable },
  { key: "approvals", label: "Approvals", icon: CheckCircle2 },
  { key: "finance", label: "Finance", icon: CircleDollarSign },
  { key: "payouts", label: "Payouts", icon: Wallet },
  { key: "users", label: "Users & Roles", icon: Users },
  { key: "audit", label: "Audit Logs", icon: ShieldCheck },
  { key: "notifications", label: "Notifications", icon: AlertTriangle },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "feature-controls", label: "Feature Controls", icon: ListFilter },
] as const;

type NavKey = (typeof navItems)[number]["key"] | "crm" | "clients" | "partners" | "centre-verification" | "bpo-management";

export default function AdminControlCentrePage() {
  const [location, setLocation] = useLocation();
  const searchTab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;
  const normalizedSearchTab = (searchTab === "office-verification" || searchTab === "centre-verification") ? "centre-verification" : searchTab;
  const initialTab: NavKey = (normalizedSearchTab && normalizedSearchTab !== "crm" && normalizedSearchTab !== "clients" && normalizedSearchTab !== "partners" && normalizedSearchTab !== "bpo-management" && normalizedSearchTab !== "bpo-approvals" ? (normalizedSearchTab as NavKey) : null) || (location.includes("centre-verification") || location.includes("office-verification") ? "centre-verification" : (location.includes("public-tickets") ? "public-tickets" : (location.includes("feature") ? "feature-controls" : "overview")));
  const [activeTab, setActiveTab] = useState<NavKey>(initialTab);
  const [overview, setOverview] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [bpoApplications, setBpoApplications] = useState<any[]>([]);
  const [bpoStatusFilter, setBpoStatusFilter] = useState("PENDING");
  const [selectedBpo, setSelectedBpo] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [userPagination, setUserPagination] = useState<any>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userRole, setUserRole] = useState("all");
  const [userStatus, setUserStatus] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [featureControls, setFeatureControls] = useState<any[]>([]);
  const [adminReports, setAdminReports] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  // Phase 2: BPO Project Campaigns & Allocation state
  const [bpoProjects, setBpoProjects] = useState<any[]>([]);
  const [selectedBpoProject, setSelectedBpoProject] = useState<any>(null);
  const [projectApplicants, setProjectApplicants] = useState<any[]>([]);
  const [createCampaignModal, setCreateCampaignModal] = useState(false);
  const [reviewAppModal, setReviewAppModal] = useState<any>(null);
  const [infoRequestText, setInfoRequestText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    vertical: "Healthcare",
    process_type: "Inbound Customer Support",
    shift: "US Shift (EST)",
    target_geography: "United States",
    required_seats: 20,
    payout_rate: "$16.00 / hour / agent",
    billing_cycle: "Bi-weekly Net 15",
    min_experience_years: 2,
    requires_us_experience: true,
    requires_uk_experience: false,
    min_centre_capacity: 25,
    scope: "",
  });

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_username");
    setLocation("/admin-login");
  };

  const loadOverview = useCallback(async () => {
    const response = await apiCall("/admin/control-centre/overview");
    if (response.status === 401) {
      logout();
      return;
    }
    if (response.ok) setOverview(await response.json());
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadOverview(),
        loadApprovals(),
        loadBpoApplications(),
        loadAuditLogs(),
        loadNotifications(),
        loadFinance(),
        loadReports(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadApprovals = useCallback(async () => {
    const response = await apiCall("/admin/approvals");
    if (response.ok) setApprovals(await response.json());
  }, []);

  const loadBpoApplications = useCallback(async () => {
    const response = await apiCall(`/admin/bpo-applications?status=${bpoStatusFilter}`);
    if (response.ok) setBpoApplications(await response.json());
  }, [bpoStatusFilter]);

  const loadBpoProjects = useCallback(async () => {
    const response = await apiCall("/admin/bpo/projects");
    if (response.ok) {
      const data = await response.json();
      setBpoProjects(data.projects || []);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const query = new URLSearchParams({ page: String(userPage), pageSize: "20", search: userSearch, role: userRole, status: userStatus });
    const response = await apiCall(`/admin/users?${query}`);
    if (response.ok) {
      const result = await response.json();
      setUsers(result.data || []);
      setUserPagination(result.pagination || null);
    }
  }, [userPage, userSearch, userRole, userStatus]);

  const loadRoles = useCallback(async () => {
    const response = await apiCall("/admin/roles");
    if (response.ok) setRoles(await response.json());
  }, []);

  const loadNotifications = useCallback(async () => {
    const response = await apiCall("/admin/notifications");
    if (response.ok) { const body = await response.json(); setNotifications(body.data || body); }
  }, []);

  const loadReports = useCallback(async () => {
    const response = await apiCall("/admin/reports?report=overview&page=1&pageSize=25");
    if (response.ok) setAdminReports(await response.json());
  }, []);

  const loadAuditLogs = useCallback(async () => {
    const response = await apiCall("/admin/audit-logs?limit=25");
    if (response.ok) setAuditLogs(await response.json());
  }, []);

  const loadFinance = useCallback(async () => {
    const response = await apiCall("/admin/finance");
    if (response.ok) setFinance(await response.json());
  }, []);

  const loadSettings = useCallback(async () => {
    const [settingsResponse, controlsResponse] = await Promise.all([apiCall("/admin/settings"), apiCall("/admin/feature-controls")]);
    if (settingsResponse.ok) setSettings(await settingsResponse.json());
    if (controlsResponse.ok) setFeatureControls(await controlsResponse.json());
  }, []);

  const runSearch = useCallback(async () => {
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }
    const response = await apiCall(`/admin/search?q=${encodeURIComponent(search)}`);
    if (response.ok) setSearchResults(await response.json());
  }, [search]);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setLocation("/admin-login");
      return;
    }

    Promise.all([
      loadOverview(),
      loadApprovals(),
      loadBpoApplications(),
      loadBpoProjects(),
      loadUsers(),
      loadRoles(),
      loadNotifications(),
      loadAuditLogs(),
      loadFinance(),
      loadSettings(),
      loadReports(),
    ]).finally(() => setLoading(false));
  }, [loadOverview, loadApprovals, loadBpoApplications, loadBpoProjects, loadUsers, loadRoles, loadNotifications, loadAuditLogs, loadFinance, loadSettings, loadReports, setLocation]);

  useEffect(() => {
    if (!loading) loadUsers();
  }, [loadUsers, loading]);

  useEffect(() => {
    if (activeTab === "users") loadUsers();
    if (activeTab === "bpo-management") loadBpoApplications();
    if (activeTab === "projects") loadBpoProjects();
    if (activeTab === "settings" || activeTab === "feature-controls") loadSettings();
  }, [activeTab, loadUsers, loadBpoApplications, loadBpoProjects, loadSettings]);

  useEffect(() => { loadBpoApplications(); }, [loadBpoApplications]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      runSearch();
    }, 350);
    return () => clearTimeout(timeout);
  }, [runSearch]);

  const statCards = useMemo(() => {
    if (!overview?.totals) return [];
    const totals = overview.totals;
    return [
      {
        id: "total-clients",
        label: "Total Clients",
        value: totals.totalClients ?? 0,
        icon: BriefcaseBusiness,
        subtitle: "Enterprise client accounts",
        /* CLIENTS TAB DISABLED PER REQUIREMENT — Redirecting to overview
        targetTab: "clients" as NavKey,
        */
        targetTab: "overview" as NavKey,
        badge: "Accounts",
      },
      {
        id: "active-clients",
        label: "Active Clients",
        value: totals.activeClients ?? 0,
        icon: CheckCircle2,
        subtitle: "Active service engagements",
        /* CLIENTS TAB DISABLED PER REQUIREMENT — Redirecting to overview
        targetTab: "clients" as NavKey,
        */
        targetTab: "overview" as NavKey,
        badge: "Live",
      },
      {
        id: "leads",
        label: "Leads",
        value: totals.leads ?? 0,
        icon: UserPlus,
        subtitle: "Inbound proposals & RFPs",
        targetUrl: "/admin?section=leads",
        badge: "Inbound",
      },
      {
        id: "total-partners",
        label: "Total Partners",
        value: totals.totalPartners ?? 0,
        icon: Building2,
        subtitle: "Global BPO organizations",
        /* BPO PARTNERS TAB DISABLED PER REQUIREMENT — Redirecting to overview
        targetTab: "partners" as NavKey,
        */
        targetTab: "overview" as NavKey,
        badge: "Network",
      },
      {
        id: "active-partners",
        label: "Active Partners",
        value: totals.activePartners ?? 0,
        icon: BadgeCheck,
        subtitle: "Certified delivery centres",
        /* BPO PARTNERS TAB DISABLED PER REQUIREMENT — Redirecting to overview
        targetTab: "partners" as NavKey,
        */
        targetTab: "overview" as NavKey,
        badge: "Verified",
      },
      {
        id: "centres",
        label: "Centres",
        value: totals.centres ?? 0,
        icon: Factory,
        subtitle: "Physical delivery facilities",
        /* Office Verification Admin UI temporarily disabled — backend preserved. */
        targetTab: "overview" as NavKey,
        badge: "Audited",
      },
      {
        id: "agents",
        label: "Agents",
        value: totals.agents ?? 0,
        icon: Users,
        subtitle: "Frontline workforce roster",
        targetTab: "operations" as NavKey,
        badge: "Frontline",
      },
      {
        id: "active-projects",
        label: "Active Projects",
        value: totals.activeProjects ?? 0,
        icon: FolderKanban,
        subtitle: "Running campaign allocations",
        targetTab: "projects" as NavKey,
        badge: "Delivery",
      },
      {
        id: "open-tickets",
        label: "Open Tickets",
        value: totals.openTickets ?? 0,
        icon: Ticket,
        subtitle: "Operational escalations",
        targetTab: "operations" as NavKey,
        badge: (totals.openTickets ?? 0) > 0 ? "Attention" : "Healthy",
      },
      {
        id: "pending-approvals",
        label: "Pending Approvals",
        value: totals.pendingApprovals ?? 0,
        icon: ShieldCheck,
        subtitle: "Partner & dossier reviews",
        targetUrl: "/admin?section=bpo-approvals",
        badge: (totals.pendingApprovals ?? 0) > 0 ? "Action Req" : "Cleared",
      },
      {
        id: "pending-kyc",
        label: "Pending KYC",
        value: totals.pendingKyc ?? 0,
        icon: FileCheck,
        subtitle: "Facility compliance checks",
        /* Office Verification Admin UI temporarily disabled — backend preserved. */
        targetTab: "overview" as NavKey,
        badge: (totals.pendingKyc ?? 0) > 0 ? "Pending" : "Cleared",
      },
      {
        id: "outstanding-invoices",
        label: "Outstanding Invoices",
        value: totals.outstandingInvoices ?? 0,
        isCurrency: true,
        icon: Receipt,
        subtitle: "Unsettled client billables",
        targetTab: "finance" as NavKey,
        badge: "Receivables",
      },
      {
        id: "pending-payments",
        label: "Pending Payments",
        value: totals.pendingPayments ?? 0,
        icon: CreditCard,
        subtitle: "In-flight payment orders",
        targetTab: "finance" as NavKey,
        badge: "Processing",
      },
      {
        id: "pending-partner-payouts",
        label: "Pending Partner Payouts",
        value: totals.pendingPartnerPayouts ?? 0,
        icon: Wallet,
        subtitle: "BPO delivery settlements",
        targetTab: "payouts" as NavKey,
        badge: "Disbursements",
      },
    ];
  }, [overview]);

  const renderOverview = () => (
    <div className="space-y-8">
      {/* 14 Premium Metric KPI Cards Grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#214ECF]" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">System Metrics & KPIs</span>
          </div>
          <span className="text-xs text-slate-400">Click any card to inspect module</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => {
                  if (card.targetUrl) {
                    setLocation(card.targetUrl);
                  } else if (card.targetTab) {
                    setActiveTab(card.targetTab);
                  }
                }}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:bg-blue-50/20 border-l-4 border-l-transparent hover:border-l-[#214ECF] cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50/80 text-[#214ECF] border border-blue-100/60 transition-colors group-hover:bg-[#214ECF] group-hover:text-white shadow-xs">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600 group-hover:text-[#214ECF] transition-colors">
                        {card.label}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {card.subtitle}
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 group-hover:bg-blue-100 group-hover:text-[#214ECF] transition-colors">
                    {card.badge}
                  </span>
                </div>

                <div className="mt-5 flex items-baseline justify-between">
                  <div className="text-3xl font-black tracking-tight text-[#0F172A]">
                    <AnimatedCounter value={card.value} isCurrency={card.isCurrency} />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-[#214ECF] opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>View</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2-Column Section: Recent Activity & Pending Approvals */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Recent Activity Timeline */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#214ECF]">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-900">Recent Activity</h2>
                  <p className="text-xs text-slate-500">Live operational audit feed</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("audit")}
                className="flex items-center gap-1 text-xs font-bold text-[#214ECF] hover:underline cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {(!overview?.recentActivity || overview.recentActivity.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Activity className="h-8 w-8 text-slate-300" />
                  <div className="mt-2 text-sm font-semibold text-slate-700">No activity recorded yet</div>
                  <div className="text-xs text-slate-400">System actions will appear here in real-time.</div>
                </div>
              ) : (
                overview.recentActivity.slice(0, 7).map((item: any) => {
                  const meta = getActivityMeta(item.action);
                  const ActivityIcon = meta.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setActiveTab("audit")}
                      className="group flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition-all duration-200 hover:bg-blue-50/70 hover:translate-x-0.5 border-l-4 border-l-transparent hover:border-l-[#214ECF] cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bgClass}`}>
                          <ActivityIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 group-hover:text-[#214ECF] transition-colors">
                            {meta.title}
                          </div>
                          <div className="text-xs text-slate-500">
                            {meta.description} {item.entityType ? `• ${item.entityType}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="text-[11px] font-semibold text-slate-600">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(item.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Pending Approvals Widget */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#214ECF]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-900">Pending Approvals</h2>
                  <p className="text-xs text-slate-500">Compliance & partner governance</p>
                </div>
              </div>
              <button
                onClick={() => setLocation("/admin?section=bpo-approvals")}
                className="flex items-center gap-1 text-xs font-bold text-[#214ECF] hover:underline cursor-pointer"
              >
                <span>Review All</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {(!overview?.pendingApprovalsList || overview.pendingApprovalsList.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl bg-emerald-50/40 border border-emerald-100 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3 shadow-xs">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="text-base font-bold text-slate-900">No Pending Approvals</div>
                  <div className="mt-1 text-xs text-slate-500 max-w-sm">
                    Everything is up to date. All BPO applications, centre verifications, and compliance milestones have been reviewed.
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    System Status: Cleared
                  </div>
                </div>
              ) : (
                overview.pendingApprovalsList.slice(0, 6).map((item: any, index: number) => (
                  <div
                    key={`${item.type}-${item.id || index}`}
                    className="group flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition-all duration-200 hover:bg-blue-50/70 hover:translate-x-0.5 border-l-4 border-l-transparent hover:border-l-[#214ECF]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{item.type}</div>
                        <div className="text-xs text-slate-500">{item.entity}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                        {item.status}
                      </span>
                      <button
                        onClick={() => item.type === "KYC" ? setLocation("/admin?section=bpo-approvals") : item.type.includes("payout") ? setActiveTab("payouts") : setActiveTab("approvals")}
                        className="flex items-center gap-1 text-xs font-bold text-[#214ECF] hover:underline cursor-pointer"
                      >
                        <span>Review</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3 Secondary Operational Alert Cards */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Recent Tickets */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-[#214ECF]" />
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-900">Recent Tickets</span>
              </div>
              <button onClick={() => setActiveTab("operations")} className="text-xs font-bold text-[#214ECF] hover:underline cursor-pointer">
                Operations →
              </button>
            </div>
            <div className="space-y-2.5">
              {(!overview?.recentTickets || overview.recentTickets.length === 0) ? (
                <div className="py-6 text-center text-xs text-slate-400">No open tickets. All operational tickets resolved.</div>
              ) : (
                overview.recentTickets.slice(0, 5).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3 border border-slate-100">
                    <div>
                      <div className="text-xs font-bold text-slate-800">{item.subject}</div>
                      <div className="text-[11px] text-slate-500">Priority: {item.priority}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      {item.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Finance Alerts */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-[#214ECF]" />
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-900">Finance Alerts</span>
              </div>
              <button onClick={() => setActiveTab("finance")} className="text-xs font-bold text-[#214ECF] hover:underline cursor-pointer">
                Finance →
              </button>
            </div>
            <div className="space-y-2.5">
              {(!overview?.financeAlerts || overview.financeAlerts.length === 0) ? (
                <div className="py-6 text-center text-xs text-slate-400">No financial alerts. Invoices and payments up to date.</div>
              ) : (
                overview.financeAlerts.slice(0, 5).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3 border border-slate-100">
                    <div>
                      <div className="text-xs font-bold text-slate-800">{item.label}</div>
                      <div className="text-[11px] text-slate-500">{item.type}</div>
                    </div>
                    <div className="text-xs font-bold text-rose-600">${Number(item.amount || 0).toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* BPO Operational Alerts */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#214ECF]" />
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-900">BPO Operational Alerts</span>
              </div>
              <button onClick={() => setActiveTab("operations")} className="text-xs font-bold text-[#214ECF] hover:underline cursor-pointer">
                Command →
              </button>
            </div>
            <div className="space-y-2.5">
              {(!overview?.bpoAlerts || overview.bpoAlerts.length === 0) ? (
                <div className="py-6 text-center text-xs text-slate-400">All partner pipelines and delivery shifts operating normally.</div>
              ) : (
                overview.bpoAlerts.slice(0, 5).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3 border border-slate-100">
                    <div>
                      <div className="text-xs font-bold text-slate-800">{item.label}</div>
                      <div className="text-[11px] text-slate-500">{item.type}</div>
                    </div>
                    <div className="text-xs font-bold text-amber-600">${Number(item.amount || 0).toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderApprovals = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Approval centre</div>
      <div className="space-y-3">
        {approvals.length === 0 ? <div className="text-sm text-slate-500">No pending approvals.</div> : approvals.map((item) => (
          <div key={`${item.type}-${item.id}`} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-bold text-slate-800">{item.type}</div>
              <div className="mt-1 text-xs text-slate-500">{item.entity} · {item.requester}</div>
              <div className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">{item.status}</span>
              <button onClick={() => apiCall(`/admin/approvals/${encodeURIComponent(item.id)}/decision`, { method: "POST", body: JSON.stringify({ status: "APPROVED", comment: "Approved by admin" }) }).then(loadApprovals)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Approve</button>
              <button onClick={() => apiCall(`/admin/approvals/${encodeURIComponent(item.id)}/decision`, { method: "POST", body: JSON.stringify({ status: "CHANGES_REQUESTED", comment: "Changes requested by admin" }) }).then(loadApprovals)} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white">Request changes</button>
              <button onClick={() => apiCall(`/admin/approvals/${encodeURIComponent(item.id)}/decision`, { method: "POST", body: JSON.stringify({ status: "REJECTED", comment: "Rejected by admin" }) }).then(loadApprovals)} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderBpoManagement = () => (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div><div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">BPO management</div><p className="mt-1 text-sm text-slate-600">Review submitted BPO applications and account status.</p></div>
        <select value={bpoStatusFilter} onChange={(event) => setBpoStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="all">All statuses</option></select>
      </div>
      <div className="space-y-3">{bpoApplications.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No BPO applications in this status.</div> : bpoApplications.map((application) => <div key={application.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="text-lg font-black text-slate-900">{application.name}</div><div className="mt-1 text-sm text-slate-500">{application.email} · Submitted {new Date(application.createdAt).toLocaleString()}</div><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-700">{application.status}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">{application.isActive ? "Active" : "Disabled"}</span></div></div><div className="flex flex-wrap gap-2"><button onClick={async () => { const response = await apiCall(`/admin/bpo-applications/${application.id}`); if (response.ok) setSelectedBpo(await response.json()); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">View details</button>{application.status === "PENDING" && <><button onClick={() => apiCall(`/admin/bpo-applications/${application.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "APPROVED" }) }).then(loadBpoApplications)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Approve</button><button onClick={() => apiCall(`/admin/bpo-applications/${application.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "REJECTED" }) }).then(loadBpoApplications)} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white">Reject</button></>}</div></div></div>)}</div>
      {selectedBpo && <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-center justify-between"><h3 className="text-lg font-black">Application details</h3><button onClick={() => setSelectedBpo(null)} className="text-xs font-bold text-primary">Close</button></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><b>Name:</b> {selectedBpo.full_name || selectedBpo.email}</div><div><b>Email:</b> {selectedBpo.email}</div><div><b>Status:</b> {selectedBpo.bpo_status}</div><div><b>Submitted:</b> {new Date(selectedBpo.created_at).toLocaleString()}</div>{Object.entries(selectedBpo.applicationDetails || {}).map(([key, value]) => <div key={key}><b>{key}:</b> {String(value || "Not provided")}</div>)}</div></div>}
    </div>
  );

  const renderUsers = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Users & roles</div>
        <div className="flex flex-wrap gap-2">
          <input value={userSearch} onChange={(event) => { setUserPage(1); setUserSearch(event.target.value); }} placeholder="Search users" className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" />
          <select value={userRole} onChange={(event) => { setUserPage(1); setUserRole(event.target.value); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="all">All roles</option><option value="user">Client</option><option value="client">Client</option><option value="bpo_partner">BPO partner</option></select>
          <select value={userStatus} onChange={(event) => { setUserPage(1); setUserStatus(event.target.value); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="all">All statuses</option><option value="active">Active</option><option value="deactivated">Deactivated</option></select>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-bold text-slate-700">User</th>
              <th className="px-4 py-3 font-bold text-slate-700">Email</th>
              <th className="px-4 py-3 font-bold text-slate-700">Role</th>
              <th className="px-4 py-3 font-bold text-slate-700">Status</th>
              <th className="px-4 py-3 font-bold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(users || []).map((user: any) => (
              <tr key={user.id} className="border-t border-slate-200">
                <td className="px-4 py-3 font-semibold text-slate-800">{user.name}</td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3 text-slate-600"><div className="flex items-center gap-2"><select defaultValue={user.role === "bpo_partner" ? "BPO_PARTNER" : user.role === "admin" ? "ADMIN" : "CLIENT"} aria-label={`Role for ${user.email}`} onChange={(event) => apiCall(`/admin/users/${user.id}/role`, { method: "PATCH", body: JSON.stringify({ role: event.target.value }) }).then(loadUsers)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs"><option value="CLIENT">CLIENT</option><option value="BPO_PARTNER">BPO_PARTNER</option><option value="ADMIN">ADMIN</option></select></div></td>
                <td className="px-4 py-3 text-slate-600">{user.status}</td>
                <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => apiCall(`/admin/users/${user.id}`, {}).then((response) => response.ok ? response.json() : null).then(setSelectedUser)} className="text-xs font-semibold text-primary">Details</button><button onClick={() => apiCall(`/admin/users/${user.id}/status`, { method: "PATCH", body: JSON.stringify({ status: user.status === "active" ? "deactivated" : "active" }) }).then(loadUsers)} className="text-xs font-semibold text-slate-700">{user.status === "active" ? "Deactivate" : "Activate"}</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{userPagination?.total || 0} users</span><div className="flex gap-2"><button disabled={userPage <= 1} onClick={() => setUserPage((page) => page - 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">Previous</button><span className="px-2 py-1">Page {userPagination?.page || userPage} of {userPagination?.totalPages || 1}</span><button disabled={userPage >= (userPagination?.totalPages || 1)} onClick={() => setUserPage((page) => page + 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">Next</button></div></div>
      {selectedUser && <div className="mt-4 rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm"><div className="font-bold text-slate-900">{selectedUser.name || selectedUser.full_name}</div><div className="mt-1 text-slate-600">{selectedUser.email} · {selectedUser.role} · {selectedUser.status}</div><div className="mt-3 space-y-2">{(selectedUser.memberships || []).map((membership: any) => <div key={membership.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2"><span className="mr-auto text-xs text-slate-600">{membership.bpo_partners?.name || membership.partner_id}</span><select defaultValue={membership.role} onChange={(event) => apiCall(`/admin/partner-memberships/${membership.id}`, { method: "PATCH", body: JSON.stringify({ role: event.target.value }) })} className="rounded border border-slate-200 px-2 py-1 text-xs"><option value="partner_admin">Partner admin</option><option value="operations_manager">Operations manager</option><option value="centre_manager">Centre manager</option><option value="team_leader">Team leader</option><option value="agent">Agent</option></select><button onClick={() => apiCall(`/admin/partner-memberships/${membership.id}`, { method: "PATCH", body: JSON.stringify({ status: membership.status === "active" ? "inactive" : "active" }) }).then(() => apiCall(`/admin/users/${selectedUser.id}`).then((response) => response.json()).then(setSelectedUser))} className="text-xs font-semibold text-slate-700">{membership.status === "active" ? "Deactivate" : "Activate"}</button></div>)}</div>{!(selectedUser.memberships || []).length && <div className="mt-2 text-xs text-slate-600">No partner memberships.</div>}<button onClick={() => setSelectedUser(null)} className="mt-3 text-xs font-semibold text-primary">Close details</button></div>}
    </div>
  );

  const renderRoles = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {(roles || []).map((role: any) => (
        <div key={role.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{role.name}</div>
          <div className="mt-3 text-lg font-black text-slate-900">{role.description}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(role.permissions || []).map((permission: string) => (
              <span key={permission} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">{permission}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderNotifications = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Admin notifications</div><button onClick={() => apiCall("/admin/notifications/read-all", { method: "POST" }).then(loadNotifications)} className="text-xs font-semibold text-primary">Mark all read</button></div>
      <div className="space-y-3">
        {(notifications || []).map((notification: any) => (
          <button key={notification.id} onClick={() => apiCall(`/admin/notifications/${notification.id}/read`, { method: "POST" }).then(loadNotifications)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
            <div>
              <div className="text-sm font-semibold text-slate-800">{notification.title}</div>
              <div className="text-xs text-slate-500">{notification.body}</div>
            </div>
            <div className="text-[11px] font-semibold text-slate-500">{notification.read ? "Read" : "Unread"}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderReports = () => <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Admin reports</div>{!adminReports ? <div className="text-sm text-slate-500">No report data available.</div> : <div className="space-y-2"><div className="text-sm text-slate-700">Report: {adminReports.report}</div><div className="text-xs text-slate-500">{adminReports.pagination?.total || 0} records</div>{(adminReports.data || []).slice(0, 10).map((row: any, index: number) => <div key={row.id || index} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{row.name || row.subject || row.invoice_number || row.statement_number || row.title || row.action || `Record ${row.id}`}</div>)}</div>}</div>;

  const renderAudit = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Audit logs</div>
      <div className="space-y-3">
        {(auditLogs || []).map((entry: any) => (
          <div key={entry.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800">{entry.action}</div>
              <div className="text-xs text-slate-500">{entry.entity_type} · {entry.entity_id}</div>
            </div>
            <div className="text-[11px] text-slate-500">{new Date(entry.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderFinance = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Paid invoices</div>
        <div className="mt-3 text-3xl font-black text-slate-900">{finance?.paidInvoices ?? 0}</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Unpaid invoices</div>
        <div className="mt-3 text-3xl font-black text-slate-900">{finance?.unpaidInvoices ?? 0}</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Outstanding amount</div>
        <div className="mt-3 text-3xl font-black text-slate-900">${Number(finance?.outstandingAmount || 0).toFixed(2)}</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Partner payable</div>
        <div className="mt-3 text-3xl font-black text-slate-900">${Number(finance?.partnerPayable || 0).toFixed(2)}</div>
      </div>
    </div>
  );

  /* EMPTY CRM PAGE SEARCH PANEL COMMENTED OUT PER USER REQUIREMENT - PRESERVED FOR RESTORATION
  const renderSearch = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <Search className="h-4 w-4 text-slate-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients, leads, partners, projects, tickets, invoices, documents" className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500" />
      </div>
      {!searchResults ? <div className="text-sm text-slate-500">Enter a search query to find authorized records.</div> : (
        <div className="space-y-4">
          {Object.entries(searchResults).map(([group, items]) => (
            <div key={group}>
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{group}</div>
              {(items as any[]).length === 0 ? <div className="text-xs text-slate-500">No matches.</div> : <div className="space-y-2">{(items as any[]).slice(0, 5).map((item: any, index: number) => <button key={`${group}-${item.id || index}`} onClick={() => setLocation(`/admin?section=${group}`)} className="block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-sm text-slate-700 hover:border-blue-300">{item.name || item.email || item.subject || item.invoice_number || item.file_name || item.partner_code || item.title || `Record ${item.id}`}</button>)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
  */

  const renderSettings = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">System settings</div>
      <div className="mb-4 flex flex-wrap gap-2">{(settings?.sections || []).map((section: string) => <span key={section} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{section}</span>)}</div>
      <div className="space-y-2 text-sm text-slate-700">{(settings?.settings || []).map((setting: any) => <div key={setting.setting_key} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"><span>{setting.setting_key}</span><div className="flex gap-2"><input defaultValue={JSON.stringify(setting.setting_value)} aria-label={`Setting ${setting.setting_key}`} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" /><button onClick={(event) => { const input = (event.currentTarget.previousElementSibling as HTMLInputElement); let value: unknown = input.value; try { value = JSON.parse(input.value); } catch {} apiCall(`/admin/settings/${encodeURIComponent(setting.setting_key)}`, { method: "PATCH", body: JSON.stringify({ value }) }); }} className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-bold text-white">Save</button></div></div>)}{(!settings?.settings || settings.settings.length === 0) && <div className="rounded-xl bg-slate-50 p-3">No platform settings are configured.</div>}</div>
    </div>
  );

  const renderFeatureControls = () => (
    <div className="py-1">
      <AdminFeatureControlCentre onNavigateToControlCentre={() => setActiveTab("overview")} />
    </div>
  );

  const handlePublishProject = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/bpo/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "open" }),
      });
      if (res.ok) await loadBpoProjects();
    } finally {
      setActionLoading(false);
    }
  };

  const handleInspectApplicants = async (proj: any) => {
    setSelectedBpoProject(proj);
    const res = await apiCall(`/admin/bpo/projects/${proj.id}`);
    if (res.ok) {
      const data = await res.json();
      setProjectApplicants(data.applications || []);
    }
  };

  const handleAllocateApplication = async (appId: number) => {
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/bpo/project-applications/${appId}/allocate`, {
        method: "POST",
      });
      if (res.ok) {
        if (selectedBpoProject) await handleInspectApplicants(selectedBpoProject);
        await loadBpoProjects();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewApplication = async (appId: number, decision: "approve" | "reject" | "request_info", extraNote?: string) => {
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/bpo/project-applications/${appId}/review`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          notes: extraNote || "Reviewed by administrator",
          more_info_requested: decision === "request_info" ? (extraNote || "Additional details required") : undefined,
        }),
      });
      if (res.ok) {
        setReviewAppModal(null);
        setInfoRequestText("");
        if (selectedBpoProject) await handleInspectApplicants(selectedBpoProject);
        await loadBpoProjects();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await apiCall("/admin/bpo/projects", {
        method: "POST",
        body: JSON.stringify(campaignForm),
      });
      if (res.ok) {
        setCreateCampaignModal(false);
        setCampaignForm({
          name: "",
          vertical: "Healthcare",
          process_type: "Inbound Customer Support",
          shift: "US Shift (EST)",
          target_geography: "United States",
          required_seats: 20,
          payout_rate: "$16.00 / hour / agent",
          billing_cycle: "Bi-weekly Net 15",
          min_experience_years: 2,
          requires_us_experience: true,
          requires_uk_experience: false,
          min_centre_capacity: 25,
          scope: "",
        });
        await loadBpoProjects();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const renderBpoProjects = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Thinkatic Exchange</div>
          <h2 className="mt-1 text-2xl font-black text-slate-900">BPO Project Campaigns & Allocations</h2>
          <p className="mt-1 text-xs text-slate-500">Create, publish, and review centre applications for client campaigns.</p>
        </div>
        <button
          onClick={() => setCreateCampaignModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition"
        >
          <Plus size={16} />
          Create BPO Campaign
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Total Campaigns</div>
          <div className="mt-2 text-3xl font-black text-slate-900">{bpoProjects.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Open in Marketplace</div>
          <div className="mt-2 text-3xl font-black text-blue-600">{bpoProjects.filter((p) => p.status === "open").length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Allocated / Active</div>
          <div className="mt-2 text-3xl font-black text-emerald-600">
            {bpoProjects.filter((p) => p.status === "allocated" || p.status === "active").length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Draft Campaigns</div>
          <div className="mt-2 text-3xl font-black text-slate-600">{bpoProjects.filter((p) => p.status === "draft").length}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h3 className="font-bold text-slate-900">Campaign Registry</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {bpoProjects.map((p) => (
            <div key={p.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                    {p.vertical}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    p.status === "open" ? "bg-blue-100 text-blue-800" :
                    p.status === "active" ? "bg-emerald-100 text-emerald-800" :
                    p.status === "allocated" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-600"
                  }`}>
                    {p.status}
                  </span>
                </div>
                <h4 className="mt-1.5 text-base font-black text-slate-900">{p.name}</h4>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{p.shift}</span>
                  <span>·</span>
                  <span>{p.required_seats} Seats</span>
                  <span>·</span>
                  <span className="font-semibold text-emerald-700">{p.payout_rate}</span>
                  <span>·</span>
                  <span>{p.total_applications || 0} Applications</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {p.status === "draft" && (
                  <button
                    onClick={() => handlePublishProject(p.id)}
                    disabled={actionLoading}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                  >
                    Publish to Marketplace
                  </button>
                )}
                <button
                  onClick={() => handleInspectApplicants(p)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Applicants ({p.total_applications || 0}) →
                </button>
              </div>
            </div>
          ))}
          {!bpoProjects.length && (
            <div className="p-8 text-center text-sm text-slate-500">No campaigns found. Create your first campaign.</div>
          )}
        </div>
      </div>

      {/* Applicants Drawer / View Modal */}
      {selectedBpoProject && (
        <div className="rounded-2xl border border-primary/20 bg-white p-6 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Campaign Applicants</span>
              <h3 className="text-xl font-black text-slate-900">{selectedBpoProject.name}</h3>
            </div>
            <button onClick={() => setSelectedBpoProject(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {projectApplicants.length === 0 ? (
              <p className="text-sm text-slate-500">No centres have applied to this campaign yet.</p>
            ) : (
              projectApplicants.map((app) => (
                <div key={app.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-600">{app.application_number}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 border border-slate-200">
                          {app.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-800">
                        Committed: {app.available_seats} Seats ({app.experienced_agents} Experienced Agents)
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Start: {app.available_start_date || "Immediate"} · US Exp: {app.us_experience ? "Yes" : "No"} · UK Exp: {app.uk_experience ? "Yes" : "No"}
                      </p>
                      {app.proposal_notes && <p className="mt-2 text-xs italic text-slate-600">"{app.proposal_notes}"</p>}
                      {app.more_info_requested && (
                        <p className="mt-2 text-xs font-medium text-amber-800 bg-amber-50 rounded-lg p-2">
                          Info requested: {app.more_info_requested}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {app.status !== "allocated" && app.status !== "accepted" && app.status !== "rejected" && (
                        <>
                          <button
                            onClick={() => { setReviewAppModal(app); }}
                            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900"
                          >
                            Request Info
                          </button>
                          <button
                            onClick={() => handleReviewApplication(app.id, "reject")}
                            disabled={actionLoading}
                            className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleAllocateApplication(app.id)}
                            disabled={actionLoading}
                            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                          >
                            Approve & Allocate Project
                          </button>
                        </>
                      )}
                      {app.status === "allocated" && (
                        <span className="rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-bold text-purple-800">
                          Allocated (Pending Centre Acceptance)
                        </span>
                      )}
                      {app.status === "accepted" && (
                        <span className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
                          Active & Operational
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Request Info Modal */}
      {reviewAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-black text-slate-900">Request Information</h3>
            <p className="mt-1 text-xs text-slate-500">
              Application: {reviewAppModal.application_number}
            </p>
            <textarea
              rows={3}
              placeholder="Specify the clarification or documentation required from the BPO centre..."
              value={infoRequestText}
              onChange={(e) => setInfoRequestText(e.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-primary"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setReviewAppModal(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReviewApplication(reviewAppModal.id, "request_info", infoRequestText)}
                disabled={!infoRequestText.trim() || actionLoading}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Campaign Modal */}
      {createCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="my-8 w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-black text-slate-900">Create BPO Project Campaign</h3>
              <button onClick={() => setCreateCampaignModal(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCampaignSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Campaign Name *</label>
                <input
                  required
                  placeholder="e.g. North American Healthcare Telehealth Support"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Vertical</label>
                  <select
                    value={campaignForm.vertical}
                    onChange={(e) => setCampaignForm({ ...campaignForm, vertical: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                  >
                    <option value="Healthcare">Healthcare</option>
                    <option value="Fintech & Banking">Fintech & Banking</option>
                    <option value="Energy & Utilities">Energy & Utilities</option>
                    <option value="E-commerce">E-commerce</option>
                    <option value="Telecom">Telecom</option>
                    <option value="Logistics">Logistics</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Process Type</label>
                  <input
                    value={campaignForm.process_type}
                    onChange={(e) => setCampaignForm({ ...campaignForm, process_type: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Shift Window</label>
                  <select
                    value={campaignForm.shift}
                    onChange={(e) => setCampaignForm({ ...campaignForm, shift: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                  >
                    <option value="US Shift (EST)">US Shift (EST)</option>
                    <option value="US Shift (PST)">US Shift (PST)</option>
                    <option value="UK Shift (GMT)">UK Shift (GMT)</option>
                    <option value="24/7 Rotational">24/7 Rotational</option>
                    <option value="Australian Shift">Australian Shift</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Target Geography</label>
                  <input
                    value={campaignForm.target_geography}
                    onChange={(e) => setCampaignForm({ ...campaignForm, target_geography: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Required Headcount (Seats) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={campaignForm.required_seats}
                    onChange={(e) => setCampaignForm({ ...campaignForm, required_seats: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Payout Rate</label>
                  <input
                    value={campaignForm.payout_rate}
                    onChange={(e) => setCampaignForm({ ...campaignForm, payout_rate: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-4 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={campaignForm.requires_us_experience}
                    onChange={(e) => setCampaignForm({ ...campaignForm, requires_us_experience: e.target.checked })}
                  />
                  Requires US Experience
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={campaignForm.requires_uk_experience}
                    onChange={(e) => setCampaignForm({ ...campaignForm, requires_uk_experience: e.target.checked })}
                  />
                  Requires UK Experience
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Scope & Overview</label>
                <textarea
                  rows={3}
                  placeholder="Describe the interaction flow, customer persona, and expectations..."
                  value={campaignForm.scope}
                  onChange={(e) => setCampaignForm({ ...campaignForm, scope: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setCreateCampaignModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-primary px-6 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90"
                >
                  Save as Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return renderOverview();
      /* EMPTY CRM PAGE CASE COMMENTED OUT PER USER REQUIREMENT - PRESERVED FOR RESTORATION
      case "crm": return renderSearch();
      */
      /* CLIENTS TAB RENDERING COMMENTED OUT PER USER REQUIREMENT - PRESERVED FOR RESTORATION
      case "clients": setLocation("/admin?section=clients"); return null;
      */
      case "clients": return renderOverview();
      /* BPO PARTNERS TAB RENDERING COMMENTED OUT PER USER REQUIREMENT - PRESERVED FOR RESTORATION
      case "partners": setLocation("/admin?section=partners"); return null;
      */
      case "partners": return renderOverview();
      /* BPO APPROVALS MOVED TO CLASSIC DASHBOARD PER USER REQUIREMENT - SAFELY REDIRECT */
      case "bpo-management": setLocation("/admin?section=bpo-approvals"); return null;
      case "centre-verification": return <AdminCentreVerificationPanel />;
      case "agreements": return <AdminAgreementsPanel />;
      case "projects": return renderBpoProjects();
      case "capacity-marketplace": return <AdminCapacityMarketplacePanel apiCall={apiCall} />;
      case "operations": return <BpoOperationsCommandCentre />;
      case "public-tickets": return <AdminPublicTicketsPanel apiCall={apiCall} />;
      case "bpo-connect": return <AdminBpoConnectSection apiCall={apiCall} />;
      case "bpo-meetings": return <AdminBpoMeetingsSection apiCall={apiCall} />;
      case "integrations": return <AdminIntegrationsPanel adminToken={localStorage.getItem("admin_token") || ""} />;
      case "approvals": return renderApprovals();
      case "finance": return <AdminOperationsFinancePanel initialTab="invoices" apiCall={apiCall} />;
      case "payouts": return <AdminOperationsFinancePanel initialTab="payouts" apiCall={apiCall} />;
      case "users": return renderUsers();
      case "audit": return renderAudit();
      case "notifications": return renderNotifications();
      case "reports": return renderReports();
      case "settings": return renderSettings();
      case "feature-controls": return renderFeatureControls();
      default: return renderOverview();
    }
  };

  return (
    <div className="flex h-screen h-[100dvh] max-h-screen overflow-hidden bg-white text-slate-900">
      {/* Mobile Slide-over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex w-80 max-w-[85vw] flex-col border-r border-slate-200 bg-white p-5 shadow-2xl z-10">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50/80 border border-blue-100/60 p-1 shadow-xs">
                  <img
                    src="/Thinkatic.png"
                    alt="Thinkatic Logo"
                    className="h-full w-full object-contain block select-none"
                  />
                </div>
                <div className="flex flex-col min-w-0 overflow-hidden">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#214ECF] leading-tight whitespace-nowrap">
                    CONSOLE
                  </span>
                  <span className="text-base font-black tracking-tight text-slate-900 leading-tight whitespace-nowrap">
                    Thinkatic
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
                aria-label="Close Mobile Navigation"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto">
              {navItems.map(({ key, label, icon: Icon }) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setActiveTab(key);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? "bg-[#214ECF] text-white shadow-md shadow-[#214ECF]/20"
                        : "text-slate-700 hover:bg-blue-50/70 hover:text-[#214ECF]"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-[#214ECF]"}`} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-4 border-t border-slate-100 pt-4 space-y-1">
              <button
                onClick={() => {
                  setLocation("/admin");
                  setMobileMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#214ECF]"
              >
                <LayoutDashboard className="h-4 w-4 text-[#214ECF]" />
                <span>Classic Dashboard</span>
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4 text-rose-500" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Collapsible Left Sidebar — Fixed in viewport, independent scroll */}
      <aside
        className={`hidden lg:flex shrink-0 flex-col border-r border-slate-200/80 bg-white h-full max-h-screen overflow-hidden transition-all duration-300 ease-in-out z-30 ${
          isCollapsed ? "w-20 p-3" : "w-72 p-5"
        }`}
      >
        {/* Logo & Header with Collapse Toggle - 2-column flex layout */}
        <div
          className={`mb-6 flex ${
            isCollapsed
              ? "flex-col items-center gap-3"
              : "items-center justify-between gap-3"
          } min-w-0`}
        >
          {/* LEFT: Thinkatic logo + brand identity */}
          <div
            className={`flex items-center gap-3 min-w-0 ${
              isCollapsed ? "justify-center" : "flex-1 overflow-hidden"
            }`}
          >
            {/* Thinkatic Logo Icon */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50/80 border border-blue-100/60 p-1 shadow-xs">
              <img
                src="/Thinkatic.png"
                alt="Thinkatic Logo"
                className="h-full w-full object-contain block select-none"
              />
            </div>

            {/* Brand text: CONSOLE + Thinkatic */}
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 overflow-hidden">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#214ECF] leading-tight whitespace-nowrap">
                  CONSOLE
                </span>
                <span className="text-base font-black tracking-tight text-slate-900 leading-tight whitespace-nowrap">
                  Thinkatic
                </span>
              </div>
            )}
          </div>

          {/* RIGHT: Dedicated Collapse Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-[#214ECF] shadow-xs hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation list with clearly visible #214ECF hover and active styling */}
        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {navItems.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                title={isCollapsed ? label : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-[#214ECF] text-white shadow-md shadow-[#214ECF]/20 border-l-4 border-l-[#214ECF]"
                    : "border-l-4 border-l-transparent text-slate-700 hover:bg-blue-50/70 hover:border-l-[#214ECF] hover:text-[#214ECF] hover:translate-x-1"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                    isActive ? "text-white" : "text-[#214ECF] group-hover:text-[#214ECF]"
                  }`}
                />
                {!isCollapsed && <span className="truncate">{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="mt-4 border-t border-slate-200/80 pt-4 space-y-1">
          <button
            onClick={() => setLocation("/admin")}
            title={isCollapsed ? "Classic Dashboard" : undefined}
            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50/70 hover:text-[#214ECF] border-l-4 border-l-transparent hover:border-l-[#214ECF] transition-all duration-200 cursor-pointer ${
              isCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <LayoutDashboard className="h-[18px] w-[18px] shrink-0 text-[#214ECF]" />
            {!isCollapsed && <span>Classic Dashboard</span>}
          </button>
          <button
            onClick={logout}
            title={isCollapsed ? "Sign out" : undefined}
            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-rose-50/70 hover:text-rose-600 border-l-4 border-l-transparent hover:border-l-rose-500 transition-all duration-200 cursor-pointer ${
              isCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0 text-slate-500 group-hover:text-rose-600" />
            {!isCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main Viewport Content Area — Independent vertical scroll container */}
      <main className="flex-1 h-full overflow-y-auto overflow-x-hidden bg-white p-4 sm:p-6 lg:p-8 min-w-0">
        {/* Mobile menu drawer toggle button */}
        <div className="lg:hidden mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:text-[#214ECF] cursor-pointer shadow-xs"
            aria-label="Open Navigation Menu"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* ADMIN CONTROL CENTRE TOP HEADER COMMENTED OUT PER USER REQUIREMENT - PRESERVED FOR RESTORATION */}
        {/*
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:text-[#214ECF] cursor-pointer shadow-xs"
              aria-label="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#214ECF] border border-blue-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Operations Console
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">• Live System</span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A]">
                Admin Control Centre
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setLocation("/admin")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200/90 bg-white text-slate-700 hover:bg-blue-50/60 hover:text-[#214ECF] hover:border-[#214ECF]/30 shadow-xs transition-all cursor-pointer"
              title="Switch to Classic Admin Dashboard"
            >
              <LayoutDashboard size={14} className="text-[#214ECF]" />
              <span>Classic Dashboard</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200/90 bg-white text-slate-700 hover:bg-blue-50/60 hover:text-[#214ECF] hover:border-[#214ECF]/30 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Live Dashboard Data"
            >
              <RefreshCw size={14} className={`text-[#214ECF] ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </button>

            <div className="relative flex items-center">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 shadow-xs transition-all focus-within:border-[#214ECF] focus-within:ring-2 focus-within:ring-[#214ECF]/20">
                <Search className="h-4 w-4 text-[#214ECF]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Global search records..."
                  className="w-48 sm:w-60 bg-transparent text-xs font-medium text-slate-700 outline-none placeholder:text-slate-400"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        */}

        {/* Mobile Horizontal Module Slider */}
        <nav className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden" aria-label="Admin modules">
          {navItems.map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[#214ECF] text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Dynamic Tab Body with Skeleton Loader */}
        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-14 w-full rounded-2xl bg-slate-100/80" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl border border-slate-200/70 bg-white p-4 space-y-3">
                  <div className="h-4 w-28 rounded bg-slate-100" />
                  <div className="h-8 w-16 rounded bg-slate-200" />
                </div>
              ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="h-72 rounded-2xl border border-slate-200/70 bg-white p-5" />
              <div className="h-72 rounded-2xl border border-slate-200/70 bg-white p-5" />
            </div>
          </div>
        ) : (
          <div>{renderTab()}</div>
        )}
      </main>

      {/* Floating Human Support CTA Button (Globally disabled per UI requirements) */}
      {/* <button
        onClick={() => setSupportModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#214ECF] px-4 py-3.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-200 hover:bg-blue-700 hover:scale-105 active:scale-95 cursor-pointer group"
        title="Admin Human Support"
      >
        <Headset className="h-5 w-5" />
        <span className="hidden sm:inline">Human Support</span>
      </button> */}

      {/* Support Information Modal */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Headset className="h-5 w-5 text-[#214ECF]" />
                <h3 className="text-base font-bold text-slate-900">Admin Operations Support</h3>
              </div>
              <button
                onClick={() => setSupportModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>Direct priority support channel for Thinkatic Enterprise Administrators.</p>
              <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-3.5 space-y-1.5">
                <div className="text-xs font-bold text-[#214ECF] uppercase tracking-wider">Priority Operations Desk</div>
                <div className="font-semibold text-slate-900">support@thinkatic.com</div>
                <div className="text-xs text-slate-500">Response SLA: &lt; 15 minutes for Tier 1 incidents</div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSupportModalOpen(false)}
                className="rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
