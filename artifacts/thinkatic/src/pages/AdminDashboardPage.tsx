import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Search,
  Download,
  Trash2,
  ChevronDown,
  X,
  Check,
  Eye,
  StickyNote,
  RefreshCw,
  Tag,
  Plus,
  Pencil,
  DollarSign,
  Star,
  Clock,
  ShieldCheck,
  Share2,
  Wallet,
  FileText,
  MessageSquare,
  Send,
  Ticket,
  FolderKanban,
  Calendar,
  Video,
  Receipt,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  BadgeCheck,
  Activity,
  Building2,
  CheckCircle2,
  CheckSquare,
  Square,
  AlertCircle,
  FileCheck,
  Filter,
  ExternalLink,
  ChevronRight,
  Landmark,
  Menu,
  MessageSquareText,
} from "lucide-react";
import BrandLogo from "@/components/layout/BrandLogo";
import AdminAgreementsPanel from "@/components/admin/AdminAgreementsPanel";
import AdminMeetingsPanel from "@/components/admin/AdminMeetingsPanel";
import AdminBillingInvoicesPanel from "@/components/admin/AdminBillingInvoicesPanel";
import AdminServicesPlansControlCentre from "@/components/admin/AdminServicesPlansControlCentre";
import AdminWithdrawalsControlCentre from "@/components/admin/AdminWithdrawalsControlCentre";
import AdminBpoApprovalsPanel from "@/components/admin/AdminBpoApprovalsPanel";
import AdminBpoConnectSection from "@/components/admin/AdminBpoConnectSection";
import AdminBpoMeetingsSection from "@/components/admin/AdminBpoMeetingsSection";

type Submission = {
  id: number;
  name: string;
  email: string;
  company: string | null;
  budget: string | null;
  message: string;
  status: string;
  notes: string | null;
  source: string | null;
  createdAt: string;
};

type Stats = {
  total: number;
  today: number;
  thisWeek: number;
  byStatus: { status: string; count: number }[];
  byBudget: { budget: string | null; count: number }[];
};

type Plan = {
  id: number;
  serviceId: string;
  serviceNumber: string;
  category: string;
  name: string;
  tier?: string;
  price: number;
  priceDisplay?: string;
  priceMax?: number | null;
  billingInterval?: string;
  deliveryTimeline?: string;
  supportDuration?: string;
  targetCustomer?: string;
  tag: string;
  description: string;
  features: string[];
  popular: boolean;
  sortOrder: number;
  enabled?: boolean;
  clientVisible?: boolean;
};

type PlanFormData = {
  serviceId: string;
  serviceNumber: string;
  category: string;
  name: string;
  tier?: string;
  price: string;
  priceDisplay?: string;
  billingInterval?: string;
  deliveryTimeline?: string;
  supportDuration?: string;
  targetCustomer?: string;
  tag: string;
  description: string;
  features: string;
  popular: boolean;
};

type ClientUpdate = {
  id: number;
  userId: string;
  title: string;
  message: string;
  category: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type UpdateClient = {
  userId: string;
  clientName: string;
  email: string;
  assignedPlan: string | null;
  planPrice: number | null;
  planSeats: string | null;
  planStatus: string;
  lastUpdateSent: string | null;
  updateCount: number;
};

type UpdateFormData = {
  title: string;
  message: string;
  category: string;
  status: "draft" | "published";
};

type TicketRow = {
  id: number;
  ticket_number: string;
  requester_role: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  assigned_to: number | null;
};

type TicketStats = {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  waiting: number;
  resolved: number;
  closed: number;
  highPriority: number;
};

type ModuleSetting = { module_key: string; enabled: boolean };

type AdminProject = {
  id: number;
  client_id: string;
  name: string;
  project_type: string;
  status: string;
  progress_percent: number;
  manual_progress_percent?: number | null;
  start_date: string | null;
  expected_end_date: string | null;
  budget?: number | null;
  description: string | null;
  scope?: string | null;
  objectives?: string | null;
  technologies?: string[];
  vertical?: string | null;
  process_type?: string | null;
  target_geography?: string | null;
  required_seats?: number | null;
  shift?: string | null;
  payout_rate?: string | null;
  bpo_client_id?: string | null;
  project_milestones?: any[];
  project_tasks?: any[];
  project_deliverables?: any[];
  project_activity?: any[];
  created_at?: string;
  updated_at?: string;
};

const EMPTY_UPDATE_FORM: UpdateFormData = { title: "", message: "", category: "", status: "published" };

const EMPTY_PLAN_FORM: PlanFormData = {
  serviceId: "",
  serviceNumber: "",
  category: "",
  name: "",
  price: "",
  tag: "",
  description: "",
  features: "",
  popular: false,
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  new: { bg: "#EFF4FF", text: "#214ECF", border: "#BFDBFE" },
  contacted: { bg: "#EEF2FF", text: "#4338CA", border: "#C7D2FE" },
  qualified: { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  closed_won: { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  closed_lost: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
};

const STATUS_OPTIONS = ["new", "contacted", "qualified", "closed_won", "closed_lost"];

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

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize border shadow-2xs transition-colors"
      style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.text }} />
      {status.replace("_", " ")}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl p-5 bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all group"
    >
      <div className="text-[11px] font-bold uppercase tracking-wider mb-2 text-slate-400 group-hover:text-[#214ECF] transition-colors">
        {label}
      </div>
      <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</div>
      {sub && <div className="text-xs mt-1.5 text-slate-500 font-medium">{sub}</div>}
    </motion.div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-widest" style={{ color: "#475569" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none transition-all"
        style={{ background: "rgba(33,78,207,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
        onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(71,163,255,0.4)"; }}
        onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(33,78,207,0.14)"; }}
      />
    </div>
  );
}

import AdminClientsControlCentre from "@/components/admin/AdminClientsControlCentre";
import AdminOverviewSection from "@/components/admin/AdminOverviewSection";
import AdminLeadsSection from "@/components/admin/AdminLeadsSection";
import AdminProjectsControlCentre from "@/components/admin/AdminProjectsControlCentre";
import AdminFeatureControlCentre from "@/components/admin/AdminFeatureControlCentre";

export default function AdminDashboardPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<
    "overview" | "bpo-approvals" | "clients" | "leads" | "analytics" | "plans" | "client-updates" | "projects" | "meetings" | "billing" | "documents" | "communications" | "tickets" | "attendance" | "kyc" | "affiliates" | "wallets" | "withdrawals" | "bpo-partners" | "bpo-connect" | "bpo-meetings" | "settings"
  >("overview");
  const [leadsInitialStatus, setLeadsInitialStatus] = useState<string | undefined>();
  const [leadsInitialDate, setLeadsInitialDate] = useState<string | undefined>();
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const section = searchParams.get("section") || searchParams.get("tab");
    const disabledSections = new Set([
      "documents",
      "communications",
      "communication",
      "attendance",
      "kyc",
      "affiliates",
      "affiliate",
      "wallets",
      "wallet",
      "withdrawals",
      "withdrawal",
    ]);
    if (section && disabledSections.has(section.toLowerCase())) {
      // STANDALONE TABS DISABLED PER REQUIREMENT — Redirect to overview
      setTab("overview");
      return;
    }
    const sectionTabs: Record<string, string> = {
      "bpo-approvals": "bpo-approvals",
      "bpo-management": "bpo-approvals",
      approvals: "bpo-approvals",
      "partner-applications": "bpo-approvals",
      clients: "clients",
      leads: "leads",
      partners: "bpo-partners",
      projects: "projects",
      campaigns: "bpo-partners",
      agents: "bpo-partners",
      tickets: "tickets",
      "bpo-connect": "bpo-connect",
      connect: "bpo-connect",
      "bpo-requests": "bpo-connect",
      "bpo-meetings": "bpo-meetings",
      "bpo-sessions": "bpo-meetings",
      invoices: "billing",
      billing: "billing",
      // STANDALONE TABS DISABLED PER REQUIREMENT — PRESERVED FOR RESTORATION
      // documents: "documents",
      // communications: "communications",
      // attendance: "attendance",
      // kyc: "kyc",
      // affiliates: "affiliates",
      meetings: "meetings",
      "services-plans": "plans",
      plans: "plans",
      services: "plans",
      settings: "settings",
      features: "settings",
      "feature-controls": "settings",
    };
    const nextTab = section ? sectionTabs[section] : undefined;
    if (nextTab) setTab(nextTab as any);
  }, []);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dataError, setDataError] = useState("");
  const [bpoConnectUnreadCount, setBpoConnectUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await apiCall("/admin/bpo-connect/unread-count");
        if (res.ok) {
          const data = await res.json();
          setBpoConnectUnreadCount(data.unreadCount || 0);
        }
      } catch {}
    };
    void fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  // Plans state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [planForm, setPlanForm] = useState<PlanFormData>(EMPTY_PLAN_FORM);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Client updates state
  const [updateClients, setUpdateClients] = useState<UpdateClient[]>([]);
  const [updateClientsLoading, setUpdateClientsLoading] = useState(false);
  const [selectedUpdateClient, setSelectedUpdateClient] = useState<UpdateClient | null>(null);
  const [clientUpdateHistory, setClientUpdateHistory] = useState<ClientUpdate[]>([]);
  const [clientUpdatesLoading, setClientUpdatesLoading] = useState(false);
  const [updateForm, setUpdateForm] = useState<UpdateFormData>(EMPTY_UPDATE_FORM);
  const [editingClientUpdate, setEditingClientUpdate] = useState<ClientUpdate | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [savingClientUpdate, setSavingClientUpdate] = useState(false);

  // Attendance state
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // KYC state
  const [kycRecords, setKycRecords] = useState<any[]>([]);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycReviewModal, setKycReviewModal] = useState<{ id: number; name: string; action: "verified" | "rejected" } | null>(null);
  const [kycRejectReason, setKycRejectReason] = useState("");
  const [reviewingKyc, setReviewingKyc] = useState(false);

  // Affiliates state
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [affiliatesLoading, setAffiliatesLoading] = useState(false);

  // Wallets state
  const [walletsData, setWalletsData] = useState<{ wallets: any[]; recentTransactions: any[] }>({
    wallets: [],
    recentTransactions: [],
  });
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketStatus, setTicketStatus] = useState("all");
  const [ticketPriority, setTicketPriority] = useState("all");
  const [ticketSearch, setTicketSearch] = useState("");
  const [moduleSettings, setModuleSettings] = useState<ModuleSetting[]>([]);
  const [moduleSettingsLoading, setModuleSettingsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketReply, setTicketReply] = useState("");
  const [ticketNote, setTicketNote] = useState("");
  const [ticketAudit, setTicketAudit] = useState<any[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<AdminProject | null>(null);
  const [projectForm, setProjectForm] = useState({
    clientId: "",
    name: "",
    projectType: "Fintech & Banking Operations",
    status: "planning",
    description: "",
    scope: "",
    startDate: "",
    expectedEndDate: "",
    budget: "",
    targetGeography: "United States",
    requiredSeats: "20",
    vertical: "Fintech & Banking",
    processType: "Inbound Customer Support",
    shift: "US Shift (EST)",
    payoutRate: "$16.00 / hour / agent",
  });
  const [projectSaving, setProjectSaving] = useState(false);
  const [bpoPartners, setBpoPartners] = useState<any[]>([]);
  const [bpoPartnerDocs, setBpoPartnerDocs] = useState<any[]>([]);
  const [bpoPartnerMeetings, setBpoPartnerMeetings] = useState<any[]>([]);
  const [bpoPartnerTraining, setBpoPartnerTraining] = useState<any[]>([]);
  const [bpoPartnerQuality, setBpoPartnerQuality] = useState<any[]>([]);
  const [bpoPartnerPayouts, setBpoPartnerPayouts] = useState<any[]>([]);
  const [bpoPartnerLoading, setBpoPartnerLoading] = useState(false);
  // BPO Partner Applications & Onboarding (Phase 1)
  const [bpoApplications, setBpoApplications] = useState<any[]>([]);
  const [bpoAppCounts, setBpoAppCounts] = useState<{
    total: number;
    submitted: number;
    under_review: number;
    action_required: number;
    approved: number;
    rejected: number;
  }>({ total: 0, submitted: 0, under_review: 0, action_required: 0, approved: 0, rejected: 0 });
  const [bpoAppsLoading, setBpoAppsLoading] = useState(false);
  const [bpoAppsSearch, setBpoAppsSearch] = useState("");
  const [bpoAppsStatusFilter, setBpoAppsStatusFilter] = useState("all");
  const [selectedBpoApp, setSelectedBpoApp] = useState<any | null>(null);
  const [loadingBpoAppDetail, setLoadingBpoAppDetail] = useState(false);
  const [bpoSubTab, setBpoSubTab] = useState<"applications" | "operations" | "agreements">("applications");
  const [appChecks, setAppChecks] = useState<Record<string, { verified: boolean; notes?: string }>>({});
  const [savingCheckKey, setSavingCheckKey] = useState<string | null>(null);
  const [bpoActionModal, setBpoActionModal] = useState<"approve" | "reject" | "request_info" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [missingItemsInput, setMissingItemsInput] = useState<string[]>([]);
  const [customMissingItem, setCustomMissingItem] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");
  const [adminDocuments, setAdminDocuments] = useState<any[]>([]);
  const [adminConversations, setAdminConversations] = useState<any[]>([]);
  const [selectedAdminConversation, setSelectedAdminConversation] = useState<any | null>(null);
  const [adminMessage, setAdminMessage] = useState("");
  const [adminDocumentForm, setAdminDocumentForm] = useState({ clientId: "", projectId: "", category: "Other", visibility: "client_visible" });
  const [milestoneForm, setMilestoneForm] = useState({ name: "", status: "not_started", completionPercent: "0" });
  const [taskForm, setTaskForm] = useState({ name: "", assignedName: "", status: "todo", priority: "medium", internalNotes: "", clientVisible: true });
  const [deliverableForm, setDeliverableForm] = useState({ name: "", description: "", filePath: "", status: "submitted", clientVisible: true });
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
  const [meetingForm, setMeetingForm] = useState({ clientId: "", projectId: "", title: "", startsAt: "", endsAt: "", meetingType: "project_meeting", location: "", agenda: "" });
  // BUG 4+15 FIX: Replace uncontrolled DOM textarea with controlled React state
  const [meetingNoteBody, setMeetingNoteBody] = useState("");
  const [meetingNoteClientVisible, setMeetingNoteClientVisible] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  // BUG 9 FIX: Add action item form state
  const [actionItemForm, setActionItemForm] = useState({ title: "", description: "", assignedUserId: "", dueDate: "", priority: "medium" });
  const [addingActionItem, setAddingActionItem] = useState(false);
  const [meetingRequests, setMeetingRequests] = useState<any[]>([]);

  // Billing state
  const [adminInvoices, setAdminInvoices] = useState<any[]>([]);
  const [adminInvoicesLoading, setAdminInvoicesLoading] = useState(false);
  const [selectedAdminInvoice, setSelectedAdminInvoice] = useState<any | null>(null);
  const [billingMetrics, setBillingMetrics] = useState<any | null>(null);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [invoiceClientFilter, setInvoiceClientFilter] = useState("");
  const [invoiceForm, setInvoiceForm] = useState({
    clientId: "", projectId: "", invoiceDate: "", dueDate: "", taxRate: "0", discountAmount: "0",
    notes: "", terms: "", internalNotes: "",
    items: [{ description: "", quantity: "1", unitPrice: "" }],
  });
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [manualPaymentForm, setManualPaymentForm] = useState({ amount: "", paymentMethod: "manual", reference: "", notes: "" });
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [adminBankAccounts, setAdminBankAccounts] = useState<any[]>([]);
  const [adminBankAccountsLoading, setAdminBankAccountsLoading] = useState(false);

  const adminUsername = localStorage.getItem("admin_username") ?? "admin";

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_username");
    setLocation("/admin-login");
  };

  const loadData = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) { setLocation("/admin-login"); return; }

    setLoading(true);
    setDataError("");
    try {
      const [subRes, statRes] = await Promise.all([
        apiCall("/admin/submissions"),
        apiCall("/admin/stats"),
      ]);

      if (subRes.status === 401 || statRes.status === 401) {
        logout();
        return;
      }

      if (!subRes.ok || !statRes.ok) {
        throw new Error("Unable to load dashboard data");
      }

      setSubmissions(await subRes.json() as Submission[]);
      setStats(await statRes.json() as Stats);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const res = await apiCall("/admin/plans");
      if (res.status === 401) { logout(); return; }
      if (res.ok) {
        const json = await res.json();
        const planList = Array.isArray(json)
          ? json
          : Array.isArray(json?.plans)
          ? json.plans
          : Array.isArray(json?.data)
          ? json.data
          : [];
        setPlans(planList);
      } else {
        setPlans([]);
      }
    } catch {
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    try {
      const res = await apiCall("/admin/attendance");
      if (res.status === 401) { logout(); return; }
      if (res.ok) setAttendanceRecords(await res.json());
    } finally {
      setAttendanceLoading(false);
    }
  }, []);

  const loadKyc = useCallback(async () => {
    setKycLoading(true);
    try {
      const res = await apiCall("/admin/kyc");
      if (res.status === 401) { logout(); return; }
      if (res.ok) setKycRecords(await res.json());
    } finally {
      setKycLoading(false);
    }
  }, []);

  const loadAffiliates = useCallback(async () => {
    setAffiliatesLoading(true);
    try {
      const res = await apiCall("/admin/affiliates");
      if (res.status === 401) { logout(); return; }
      if (res.ok) setAffiliates(await res.json());
    } finally {
      setAffiliatesLoading(false);
    }
  }, []);

  const loadWallets = useCallback(async () => {
    setWalletsLoading(true);
    try {
      const res = await apiCall("/admin/wallets");
      if (res.status === 401) { logout(); return; }
      if (res.ok) setWalletsData(await res.json());
    } finally {
      setWalletsLoading(false);
    }
  }, []);

  const loadWithdrawals = useCallback(async () => {
    setWithdrawalsLoading(true);
    try {
      const res = await apiCall("/admin/withdrawals");
      if (res.status === 401) { logout(); return; }
      if (res.ok) setWithdrawals(await res.json());
    } finally {
      setWithdrawalsLoading(false);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const params = new URLSearchParams();
      if (ticketStatus !== "all") params.set("status", ticketStatus);
      if (ticketPriority !== "all") params.set("priority", ticketPriority);
      if (ticketSearch.trim()) params.set("search", ticketSearch.trim());
      const [listRes, statsRes] = await Promise.all([
        apiCall(`/admin/tickets?${params.toString()}`),
        apiCall("/admin/tickets/stats"),
      ]);
      if (listRes.status === 401 || statsRes.status === 401) { logout(); return; }
      if (listRes.ok) setTickets(await listRes.json());
      if (statsRes.ok) setTicketStats(await statsRes.json());
    } finally {
      setTicketsLoading(false);
    }
  }, [ticketPriority, ticketSearch, ticketStatus]);

  const loadModuleSettings = useCallback(async () => {
    setModuleSettingsLoading(true);
    try {
      const res = await apiCall("/admin/modules");
      if (res.status === 401) { logout(); return; }
      if (res.ok) setModuleSettings(await res.json());
    } finally { setModuleSettingsLoading(false); }
  }, []);

  const toggleModule = async (setting: ModuleSetting) => {
    const res = await apiCall(`/admin/modules/${setting.module_key}`, { method: "PATCH", body: JSON.stringify({ enabled: !setting.enabled }) });
    if (!res.ok) { setDataError("Unable to update feature setting"); return; }
    const updated = await res.json();
    setModuleSettings((previous) => previous.map((item) => item.module_key === updated.module_key ? updated : item));
  };

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try { const res = await apiCall("/admin/projects"); if (res.status === 401) { logout(); return; } if (res.ok) setProjects(await res.json()); }
    finally { setProjectsLoading(false); }
  }, []);

  const openAdminProject = async (project: AdminProject) => {
    const res = await apiCall(`/admin/projects/${project.id}`);
    if (res.ok) setSelectedProject(await res.json()); else setDataError("Unable to load project");
  };

  const createAdminProject = async (event: React.FormEvent) => {
    event.preventDefault(); setProjectSaving(true);
    try {
      const res = await apiCall("/admin/projects", { method: "POST", body: JSON.stringify(projectForm) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Unable to create project");
      }
      setProjectForm({
        clientId: "",
        name: "",
        projectType: "Fintech & Banking Operations",
        status: "planning",
        description: "",
        scope: "",
        startDate: "",
        expectedEndDate: "",
        budget: "",
        targetGeography: "United States",
        requiredSeats: "20",
        vertical: "Fintech & Banking",
        processType: "Inbound Customer Support",
        shift: "US Shift (EST)",
        payoutRate: "$16.00 / hour / agent",
      });
      await loadProjects();
    } catch (error: any) {
      setDataError(error.message);
    } finally {
      setProjectSaving(false);
    }
  };

  const deleteAdminProject = async (id: number) => {
    if (!window.confirm(`Are you sure you want to delete Project #${id}?`)) return;
    try {
      const res = await apiCall(`/admin/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedProject(null);
        await loadProjects();
      } else {
        const err = await res.json().catch(() => ({}));
        setDataError(err.message || err.error || "Failed to delete project");
      }
    } catch (err: any) {
      setDataError(err.message || "Failed to delete project");
    }
  };

  const updateAdminProject = async (patch: Record<string, unknown>) => {
    if (!selectedProject) return; const res = await apiCall(`/admin/projects/${selectedProject.id}`, { method: "PATCH", body: JSON.stringify(patch) }); if (!res.ok) { setDataError("Unable to update project"); return; } await openAdminProject(selectedProject); await loadProjects();
  };

  const createProjectChild = async (kind: "milestones" | "tasks" | "deliverables", payload: Record<string, unknown>) => {
    if (!selectedProject) return;
    const res = await apiCall(`/admin/projects/${selectedProject.id}/${kind}`, { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok) { setDataError(`Unable to create ${kind.slice(0, -1)}`); return; }
    await openAdminProject(selectedProject);
  };

  const updateProjectChild = async (kind: "milestones" | "tasks" | "deliverables", id: number, payload: Record<string, unknown>) => {
    const res = await apiCall(`/admin/${kind}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) { setDataError(`Unable to update ${kind.slice(0, -1)}`); return; }
    if (selectedProject) await openAdminProject(selectedProject);
  };

  const loadDocuments = useCallback(async () => { const response = await apiCall("/admin/documents"); if (response.status === 401) return logout(); if (response.ok) setAdminDocuments(await response.json()); }, []);
  const loadConversations = useCallback(async () => { const response = await apiCall("/admin/conversations"); if (response.status === 401) return logout(); if (response.ok) setAdminConversations(await response.json()); }, []);
  const loadMeetings = useCallback(async () => {
    const response = await apiCall("/admin/meetings");
    if (response.status === 401) return logout();
    if (response.ok) setMeetings(await response.json());
  }, []);
  const loadMeetingRequests = useCallback(async () => {
    const response = await apiCall("/admin/meeting-requests");
    if (response.status === 401) return logout();
    if (response.ok) setMeetingRequests(await response.json());
  }, []);

  const loadAdminBilling = useCallback(async () => {
    setAdminInvoicesLoading(true);
    try {
      const params = new URLSearchParams();
      if (invoiceStatusFilter !== "all") params.set("status", invoiceStatusFilter);
      if (invoiceClientFilter.trim()) params.set("clientId", invoiceClientFilter.trim());
      if (invoiceSearchQuery.trim()) params.set("search", invoiceSearchQuery.trim());
      const [invRes, metricsRes] = await Promise.all([
        apiCall(`/admin/invoices?${params.toString()}`),
        apiCall("/admin/invoices/metrics"),
      ]);
      if (invRes.status === 401) { logout(); return; }
      if (invRes.ok) {
        const invJson = await invRes.json();
        const invoices = Array.isArray(invJson)
          ? invJson
          : Array.isArray(invJson?.invoices)
          ? invJson.invoices
          : Array.isArray(invJson?.data)
          ? invJson.data
          : [];
        setAdminInvoices(invoices);
      } else {
        setAdminInvoices([]);
      }
      if (metricsRes.ok) {
        const metJson = await metricsRes.json();
        setBillingMetrics(metJson);
      }
    } catch {
      setAdminInvoices([]);
    } finally { setAdminInvoicesLoading(false); }
  }, [invoiceStatusFilter, invoiceClientFilter, invoiceSearchQuery]);

  const loadAdminBankAccounts = useCallback(async () => {
    setAdminBankAccountsLoading(true);
    try {
      const res = await apiCall("/admin/bank-accounts");
      if (res.status === 401) { logout(); return; }
      if (res.ok) {
        const json = await res.json();
        const accounts = Array.isArray(json)
          ? json
          : Array.isArray(json?.bank_accounts)
          ? json.bank_accounts
          : Array.isArray(json?.data)
          ? json.data
          : [];
        setAdminBankAccounts(accounts);
      } else {
        setAdminBankAccounts([]);
      }
    } catch {
      setAdminBankAccounts([]);
    } finally {
      setAdminBankAccountsLoading(false);
    }
  }, []);

  const toggleBankAccount = async (acc: any) => {
    try {
      const res = await apiCall(`/admin/bank-accounts/${acc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !acc.is_active }),
      });
      if (res.ok) {
        await loadAdminBankAccounts();
      } else {
        const data = await res.json();
        setDataError(data.error || "Failed to update bank account status");
      }
    } catch (err: any) {
      setDataError(err.message || "Failed to update bank account");
    }
  };

  const loadBpoPartners = useCallback(async () => {
    setBpoPartnerLoading(true);
    try {
      const [partnersRes, docsRes, meetingsRes, trainingRes, qualityRes, payoutsRes] = await Promise.all([
        apiCall("/admin/partners"),
        apiCall("/admin/partner-documents"),
        apiCall("/admin/partner-meetings"),
        apiCall("/admin/partner-training"),
        apiCall("/admin/partner-quality"),
        apiCall("/admin/partner-payout-statements"),
      ]);
      if (partnersRes.status === 401 || docsRes.status === 401 || meetingsRes.status === 401 || trainingRes.status === 401 || qualityRes.status === 401 || payoutsRes.status === 401) {
        logout();
        return;
      }
      if (partnersRes.ok) setBpoPartners(await partnersRes.json());
      if (docsRes.ok) setBpoPartnerDocs(await docsRes.json());
      if (meetingsRes.ok) setBpoPartnerMeetings(await meetingsRes.json());
      if (trainingRes.ok) setBpoPartnerTraining(await trainingRes.json());
      if (qualityRes.ok) setBpoPartnerQuality(await qualityRes.json());
      if (payoutsRes.ok) setBpoPartnerPayouts(await payoutsRes.json());
    } finally { setBpoPartnerLoading(false); }
  }, []);

  const loadBpoApplications = useCallback(async () => {
    setBpoAppsLoading(true);
    try {
      const q = new URLSearchParams();
      if (bpoAppsStatusFilter !== "all") q.set("status", bpoAppsStatusFilter);
      if (bpoAppsSearch.trim()) q.set("search", bpoAppsSearch.trim());
      const res = await apiCall(`/admin/partner-applications?${q.toString()}`);
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setBpoApplications(data.applications || []);
        if (data.counts) setBpoAppCounts(data.counts);
      }
    } catch (e) {
      console.error("Failed to load BPO applications", e);
    } finally {
      setBpoAppsLoading(false);
    }
  }, [bpoAppsStatusFilter, bpoAppsSearch]);

  const openBpoAppDetail = async (appId: number) => {
    setLoadingBpoAppDetail(true);
    try {
      const res = await apiCall(`/admin/partner-applications/${appId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedBpoApp(data);
        setAppChecks(data.verification_checks || {});
      }
    } catch (e) {
      console.error("Failed to load application detail", e);
    } finally {
      setLoadingBpoAppDetail(false);
    }
  };

  const handleToggleVerificationCheck = async (checkKey: string, currentVerified: boolean) => {
    if (!selectedBpoApp) return;
    setSavingCheckKey(checkKey);
    try {
      const newVerified = !currentVerified;
      const res = await apiCall(`/admin/partner-applications/${selectedBpoApp.id}/verification`, {
        method: "POST",
        body: JSON.stringify({ check_key: checkKey, verified: newVerified }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.verification_checks || { ...appChecks, [checkKey]: { verified: newVerified } };
        setAppChecks(updated);
        setSelectedBpoApp((prev: any) => prev ? { ...prev, verification_checks: updated } : null);
      }
    } catch (e) {
      console.error("Failed to save check", e);
    } finally {
      setSavingCheckKey(null);
    }
  };

  const [verifyingDocId, setVerifyingDocId] = useState<string | number | null>(null);

  const handleAdminVerifyDocument = async (docParam: string | number, action: "VERIFY" | "REJECT") => {
    if (!selectedBpoApp) return;
    setVerifyingDocId(docParam);
    try {
      const res = await apiCall(`/admin/accreditation/applications/${selectedBpoApp.id}/documents/${docParam}/verify`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await openBpoAppDetail(selectedBpoApp.id);
      } else {
        const err = await res.json();
        alert(err.message || "Failed to update document status");
      }
    } catch (e: any) {
      alert(e?.message || "Operation failed");
    } finally {
      setVerifyingDocId(null);
    }
  };

  const submitBpoAction = async () => {
    if (!selectedBpoApp || !bpoActionModal) return;
    setActionSubmitting(true);
    setActionSuccessMsg("");
    try {
      if (bpoActionModal === "approve") {
        const res = await apiCall(`/admin/partner-applications/${selectedBpoApp.id}/approve`, {
          method: "POST",
          body: JSON.stringify({ notes: actionNotes }),
        });
        if (res.ok) {
          const data = await res.json();
          setActionSuccessMsg(`Application Approved! Centre ID Generated: ${data.centre_id || "THK-IN-PN-XXXXX"}`);
          await loadBpoApplications();
          await openBpoAppDetail(selectedBpoApp.id);
          setTimeout(() => {
            setBpoActionModal(null);
            setActionSuccessMsg("");
          }, 2000);
        } else {
          const err = await res.json();
          alert(err.message || "Failed to approve application");
        }
      } else if (bpoActionModal === "reject") {
        if (!actionNotes.trim()) {
          alert("Rejection reason is required.");
          setActionSubmitting(false);
          return;
        }
        const res = await apiCall(`/admin/partner-applications/${selectedBpoApp.id}/reject`, {
          method: "POST",
          body: JSON.stringify({ reason: actionNotes }),
        });
        if (res.ok) {
          setActionSuccessMsg("Application has been rejected.");
          await loadBpoApplications();
          await openBpoAppDetail(selectedBpoApp.id);
          setTimeout(() => {
            setBpoActionModal(null);
            setActionSuccessMsg("");
          }, 1500);
        } else {
          const err = await res.json();
          alert(err.message || "Failed to reject application");
        }
      } else if (bpoActionModal === "request_info") {
        if (missingItemsInput.length === 0 && !actionNotes.trim()) {
          alert("Please specify missing items or add remarks.");
          setActionSubmitting(false);
          return;
        }
        const res = await apiCall(`/admin/partner-applications/${selectedBpoApp.id}/request-info`, {
          method: "POST",
          body: JSON.stringify({ missing_items: missingItemsInput, remarks: actionNotes }),
        });
        if (res.ok) {
          setActionSuccessMsg("Information request sent to partner. Status set to Action Required.");
          await loadBpoApplications();
          await openBpoAppDetail(selectedBpoApp.id);
          setTimeout(() => {
            setBpoActionModal(null);
            setActionSuccessMsg("");
          }, 1500);
        } else {
          const err = await res.json();
          alert(err.message || "Failed to request information");
        }
      }
    } catch (e: any) {
      alert(e?.message || "Operation failed");
    } finally {
      setActionSubmitting(false);
    }
  };

  const openAdminInvoice = async (inv: any) => {
    const res = await apiCall(`/admin/invoices/${inv.id}`);
    if (res.ok) setSelectedAdminInvoice(await res.json());
    else setDataError("Unable to load invoice");
  };

  const createAdminInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInvoice(true);
    try {
      const payload = {
        clientId: invoiceForm.clientId,
        projectId: invoiceForm.projectId ? Number(invoiceForm.projectId) : undefined,
        invoiceDate: invoiceForm.invoiceDate,
        dueDate: invoiceForm.dueDate,
        taxRate: Number(invoiceForm.taxRate) / 100, // UI shows %, API expects 0–1
        discountAmount: Number(invoiceForm.discountAmount),
        notes: invoiceForm.notes || undefined,
        terms: invoiceForm.terms || undefined,
        internalNotes: invoiceForm.internalNotes || undefined,
        items: invoiceForm.items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      };
      const res = await apiCall("/admin/invoices", { method: "POST", body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setDataError(data.message || data.error || "Unable to create invoice"); return; }
      setShowCreateInvoice(false);
      setInvoiceForm({ clientId: "", projectId: "", invoiceDate: "", dueDate: "", taxRate: "0", discountAmount: "0", notes: "", terms: "", internalNotes: "", items: [{ description: "", quantity: "1", unitPrice: "" }] });
      await loadAdminBilling();
    } finally { setSavingInvoice(false); }
  };

  const sendAdminInvoice = async (inv: any) => {
    const res = await apiCall(`/admin/invoices/${inv.id}/send`, { method: "POST" });
    if (!res.ok) { setDataError("Unable to send invoice"); return; }
    await loadAdminBilling();
    if (selectedAdminInvoice?.id === inv.id) await openAdminInvoice(inv);
  };

  const cancelAdminInvoice = async (inv: any, reason?: string) => {
    if (!confirm(`Cancel invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    const res = await apiCall(`/admin/invoices/${inv.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: reason || "Cancelled by admin" }) });
    if (!res.ok) { setDataError("Unable to cancel invoice"); return; }
    await loadAdminBilling();
    if (selectedAdminInvoice?.id === inv.id) setSelectedAdminInvoice(null);
  };

  const recordManualPayment = async (inv: any) => {
    if (!manualPaymentForm.amount || Number(manualPaymentForm.amount) <= 0) { setDataError("Enter a valid payment amount"); return; }
    setRecordingPayment(true);
    try {
      const res = await apiCall(`/admin/invoices/${inv.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(manualPaymentForm.amount),
          paymentMethod: manualPaymentForm.paymentMethod,
          reference: manualPaymentForm.reference || undefined,
          notes: manualPaymentForm.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setDataError(data.message || data.error || "Unable to record payment"); return; }
      setManualPaymentForm({ amount: "", paymentMethod: "manual", reference: "", notes: "" });
      await loadAdminBilling();
      await openAdminInvoice(inv);
    } finally { setRecordingPayment(false); }
  };
  const openAdminMeeting = async (meeting: any) => {
    const response = await apiCall(`/admin/meetings/${meeting.id}`);
    if (response.ok) {
      setSelectedMeeting(await response.json());
      // BUG 4+15 FIX: Reset note state when opening a new meeting
      setMeetingNoteBody("");
      setMeetingNoteClientVisible(false);
    }
  };
  // BUG 14 FIX: datetime-local inputs return "YYYY-MM-DDTHH:mm" strings.
  // Wrap in new Date().toISOString() so the API gets a valid ISO timestamp.
  const createAdminMeeting = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await apiCall("/admin/meetings", {
      method: "POST",
      body: JSON.stringify({
        ...meetingForm,
        projectId: Number(meetingForm.projectId),
        startsAt: meetingForm.startsAt ? new Date(meetingForm.startsAt).toISOString() : undefined,
        endsAt: meetingForm.endsAt ? new Date(meetingForm.endsAt).toISOString() : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setDataError(err.message || err.error || "Unable to create meeting");
      return;
    }
    setMeetingForm({ clientId: "", projectId: "", title: "", startsAt: "", endsAt: "", meetingType: "project_meeting", location: "", agenda: "" });
    await loadMeetings();
  };
  const updateAdminMeeting = async (patch: Record<string, unknown>) => {
    if (!selectedMeeting) return;
    const response = await apiCall(`/admin/meetings/${selectedMeeting.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!response.ok) { setDataError("Unable to update meeting"); return; }
    await openAdminMeeting(selectedMeeting);
    await loadMeetings();
  };
  // BUG 4+15 FIX: Add note using controlled state
  const addAdminMeetingNote = async () => {
    if (!selectedMeeting || !meetingNoteBody.trim()) return;
    setAddingNote(true);
    try {
      const response = await apiCall(`/admin/meetings/${selectedMeeting.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: meetingNoteBody, noteType: "summary", clientVisible: meetingNoteClientVisible }),
      });
      if (!response.ok) { setDataError("Unable to add meeting note"); return; }
      setMeetingNoteBody("");
      setMeetingNoteClientVisible(false);
      await openAdminMeeting(selectedMeeting);
    } finally { setAddingNote(false); }
  };
  // BUG 9 FIX: Add action item using controlled state
  const addAdminActionItem = async () => {
    if (!selectedMeeting || !actionItemForm.title.trim()) return;
    setAddingActionItem(true);
    try {
      const response = await apiCall(`/admin/meetings/${selectedMeeting.id}/action-items`, {
        method: "POST",
        body: JSON.stringify({
          ...actionItemForm,
          projectId: selectedMeeting.project_id,
          assignedUserId: actionItemForm.assignedUserId || undefined,
          dueDate: actionItemForm.dueDate || undefined,
        }),
      });
      if (!response.ok) { setDataError("Unable to add action item"); return; }
      setActionItemForm({ title: "", description: "", assignedUserId: "", dueDate: "", priority: "medium" });
      await openAdminMeeting(selectedMeeting);
    } finally { setAddingActionItem(false); }
  };
  const openAdminConversation = async (conversation: any) => { const response = await apiCall(`/admin/conversations/${conversation.id}`); if (response.ok) { const data = await response.json(); setSelectedAdminConversation(data); await apiCall(`/admin/conversations/${conversation.id}/read`, { method: "POST" }); } };
  const sendAdminMessage = async () => { if (!selectedAdminConversation || !adminMessage.trim()) return; const response = await apiCall(`/admin/conversations/${selectedAdminConversation.id}/messages`, { method: "POST", body: JSON.stringify({ body: adminMessage }) }); if (!response.ok) return setDataError("Unable to send project message"); setAdminMessage(""); await openAdminConversation(selectedAdminConversation); };
  const uploadAdminDocument = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file || !adminDocumentForm.clientId) return setDataError("Client ID and file are required"); if (file.size > 25 * 1024 * 1024) return setDataError("Documents must be 25 MB or smaller"); const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ""; for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192)); const response = await apiCall("/admin/documents", { method: "POST", body: JSON.stringify({ ...adminDocumentForm, projectId: adminDocumentForm.projectId ? Number(adminDocumentForm.projectId) : undefined, file: { fileName: file.name, contentType: file.type, data: `data:${file.type};base64,${btoa(binary)}` } }) }); if (!response.ok) return setDataError("Unable to upload document"); await loadDocuments(); };

  const updateTicket = async (ticket: TicketRow, patch: { status?: string; priority?: string }) => {
    const res = await apiCall(`/admin/tickets/${ticket.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!res.ok) { setDataError("Unable to update ticket"); return; }
    await loadTickets();
  };

  const openTicket = async (ticket: TicketRow) => {
    const [detailRes, auditRes] = await Promise.all([apiCall(`/admin/tickets/${ticket.id}`), apiCall(`/admin/tickets/${ticket.id}/audit`)]);
    if (!detailRes.ok) { setDataError("Unable to load ticket details"); return; }
    setSelectedTicket(await detailRes.json());
    if (auditRes.ok) setTicketAudit(await auditRes.json());
  };

  const addTicketMessage = async (internal: boolean) => {
    const body = (internal ? ticketNote : ticketReply).trim();
    if (!selectedTicket || !body) return;
    const path = internal ? `/admin/tickets/${selectedTicket.id}/internal-notes` : `/admin/tickets/${selectedTicket.id}/replies`;
    const res = await apiCall(path, { method: "POST", body: JSON.stringify({ body }) });
    if (!res.ok) { setDataError(internal ? "Unable to add internal note" : "Unable to send reply"); return; }
    setTicketNote(""); setTicketReply(""); await openTicket(selectedTicket);
  };

  const loadUpdateClients = useCallback(async () => {
    setUpdateClientsLoading(true);
    try {
      const res = await apiCall("/admin/client-updates/clients");
      if (res.status === 401) { logout(); return; }
      if (res.ok) setUpdateClients(await res.json());
    } finally {
      setUpdateClientsLoading(false);
    }
  }, []);

  const loadClientUpdateHistory = async (client: UpdateClient) => {
    setSelectedUpdateClient(client);
    setClientUpdatesLoading(true);
    try {
      const res = await apiCall(`/admin/client-updates/users/${client.userId}`);
      if (res.ok) setClientUpdateHistory(await res.json());
    } finally {
      setClientUpdatesLoading(false);
    }
  };

  const openClientUpdate = (client: UpdateClient, update?: ClientUpdate) => {
    setSelectedUpdateClient(client);
    setEditingClientUpdate(update ?? null);
    setUpdateForm(update
      ? { title: update.title, message: update.message, category: update.category ?? "", status: update.status }
      : EMPTY_UPDATE_FORM);
    setUpdateModalOpen(true);
  };

  const saveClientUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUpdateClient || !updateForm.title.trim() || !updateForm.message.trim()) return;
    setSavingClientUpdate(true);
    try {
      const path = editingClientUpdate
        ? `/admin/client-updates/${editingClientUpdate.id}`
        : "/admin/client-updates";
      const res = await apiCall(path, {
        method: editingClientUpdate ? "PATCH" : "POST",
        body: JSON.stringify({
          ...updateForm,
          userId: selectedUpdateClient.userId,
        }),
      });
      if (!res.ok) throw new Error("Unable to save client update");
      setUpdateModalOpen(false);
      await loadClientUpdateHistory(selectedUpdateClient);
      await loadUpdateClients();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Unable to save client update");
    } finally {
      setSavingClientUpdate(false);
    }
  };

  const deleteClientUpdate = async (update: ClientUpdate) => {
    if (!confirm("Delete this client update permanently?")) return;
    const res = await apiCall(`/admin/client-updates/${update.id}`, { method: "DELETE" });
    if (!res.ok) { setDataError("Unable to delete client update"); return; }
    if (selectedUpdateClient) {
      await loadClientUpdateHistory(selectedUpdateClient);
      await loadUpdateClients();
    }
  };

  const handleReviewKyc = async (id: number, status: "verified" | "rejected", reason?: string) => {
    setReviewingKyc(true);
    try {
      const res = await apiCall(`/admin/kyc/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      });
      if (res.ok) {
        setKycReviewModal(null);
        setKycRejectReason("");
        loadKyc();
      }
    } finally {
      setReviewingKyc(false);
    }
  };

  useEffect(() => { loadData(); loadModuleSettings(); }, [loadData, loadModuleSettings]);

  useEffect(() => {
    if (tab === "plans") loadPlans();
    if (tab === "attendance") loadAttendance();
    if (tab === "kyc") loadKyc();
    if (tab === "affiliates") loadAffiliates();
    if (tab === "wallets") loadWallets();
    if (tab === "withdrawals") loadWithdrawals();
    if (tab === "tickets") loadTickets();
    if (tab === "settings") loadModuleSettings();
    if (tab === "projects") { loadProjects(); loadUpdateClients(); }
    if (tab === "documents") loadDocuments();
    if (tab === "communications") loadConversations();
    if (tab === "meetings") { loadMeetings(); loadMeetingRequests(); loadUpdateClients(); }
    if (tab === "billing") {
      loadAdminBilling();
      loadAdminBankAccounts();
    }
    if (tab === "client-updates") loadUpdateClients();
    if (tab === "bpo-partners" || tab === "bpo-approvals") {
      loadBpoPartners();
      loadBpoApplications();
    }
  }, [tab, loadPlans, loadAttendance, loadKyc, loadAffiliates, loadWallets, loadWithdrawals, loadTickets, loadModuleSettings, loadProjects, loadUpdateClients, loadDocuments, loadConversations, loadMeetings, loadMeetingRequests, loadAdminBilling, loadAdminBankAccounts, loadBpoPartners, loadBpoApplications]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const updateSubmission = async (id: number, patch: { status?: string; notes?: string }) => {
    try {
      const res = await apiCall(`/admin/submissions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Unable to update lead");
      const updated = await res.json() as Submission;
      setSubmissions((prev) => prev.map((s) => (s.id === id ? updated : s)));
      if (selected?.id === id) setSelected(updated);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Unable to update lead");
    }
  };

  const deleteSubmission = async (id: number) => {
    if (!confirm("Delete this lead permanently?")) return;
    try {
      const res = await apiCall(`/admin/submissions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Unable to delete lead");
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Unable to delete lead");
    }
  };

  const exportCSV = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/submissions-export", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Unable to export leads");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `thinkatic-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Unable to export leads");
    }
  };

  const saveNote = async () => {
    if (!selected) return;
    setSavingNote(true);
    try {
      await updateSubmission(selected.id, { notes: noteText });
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Unable to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "New passwords do not match" });
      return;
    }
    try {
      const res = await apiCall("/admin/settings/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok) {
        setPwMessage({ type: "success", text: "Password changed successfully" });
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      } else {
        setPwMessage({ type: "error", text: data.error ?? "Failed to change password" });
      }
    } catch {
      setPwMessage({ type: "error", text: "Connection error. Please try again." });
    }
  };

  const openEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setIsAddingPlan(false);
    setPlanForm({
      serviceId: plan.serviceId,
      serviceNumber: plan.serviceNumber,
      category: plan.category,
      name: plan.name,
      price: String(plan.price),
      tag: plan.tag,
      description: plan.description,
      features: plan.features.join("\n"),
      popular: plan.popular,
    });
    setPlanMessage(null);
  };

  const openAddPlan = () => {
    setEditingPlan(null);
    setIsAddingPlan(true);
    setPlanForm(EMPTY_PLAN_FORM);
    setPlanMessage(null);
  };

  const closePlanPanel = () => {
    setEditingPlan(null);
    setIsAddingPlan(false);
    setPlanMessage(null);
  };

  const savePlan = async () => {
    setSavingPlan(true);
    setPlanMessage(null);
    try {
      const payload = {
        ...planForm,
        price: Number(planForm.price),
        features: planForm.features
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
      };

      let res: Response;
      if (isAddingPlan) {
        res = await apiCall("/admin/plans", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else if (editingPlan) {
        res = await apiCall(`/admin/plans/${editingPlan.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        return;
      }

      const data = await res.json() as Plan & { error?: string };
      if (!res.ok) {
        setPlanMessage({ type: "error", text: data.error ?? "Failed to save plan" });
        return;
      }

      if (isAddingPlan) {
        setPlans((prev) => [...prev, data]);
        setPlanMessage({ type: "success", text: "Plan added successfully" });
        setTimeout(closePlanPanel, 1000);
      } else {
        setPlans((prev) => prev.map((p) => (p.id === data.id ? data : p)));
        setPlanMessage({ type: "success", text: "Plan updated successfully" });
      }
    } finally {
      setSavingPlan(false);
    }
  };

  const deletePlan = async (id: number) => {
    if (!confirm("Delete this plan permanently? This cannot be undone.")) return;
    const res = await apiCall(`/admin/plans/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPlans((prev) => prev.filter((p) => p.id !== id));
      if (editingPlan?.id === id) closePlanPanel();
    }
  };

  const togglePlanVisibility = async (plan: Plan) => {
    const res = await apiCall(`/admin/plans/${plan.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !(plan.enabled ?? true), clientVisible: !(plan.clientVisible ?? true) }) });
    if (!res.ok) { setDataError("Unable to update plan visibility"); return; }
    const updated = await res.json() as Plan;
    setPlans((previous) => previous.map((item) => item.id === updated.id ? updated : item));
  };

  const filteredSubmissions = submissions.filter((s) => {
    const matchesStatus = filterStatus === "all" || s.status === filterStatus;
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.company ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Group plans by service category
  const safePlans = Array.isArray(plans) ? plans : [];
  const groupedPlans = safePlans.reduce((acc, plan) => {
    const groupKey = plan.category || "General";
    if (!acc[groupKey]) {
      acc[groupKey] = {
        id: groupKey,
        number: plan.serviceNumber || "01",
        category: plan.category || groupKey,
        plans: [] as Plan[],
      };
    }
    acc[groupKey].plans.push(plan);
    return acc;
  }, {} as Record<string, { id: string; number: string; category: string; plans: Plan[] }>);

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "bpo-approvals", label: "BPO Approvals", icon: ShieldCheck },
    { id: "clients", label: "Clients", icon: Building2 },
    { id: "leads", label: "Leads", icon: Users },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "plans", label: "Services & Plans", icon: Tag },
    { id: "client-updates", label: "Client Updates", icon: MessageSquare },
    { id: "projects", label: "Projects", icon: FolderKanban },
    { id: "meetings", label: "Meetings", icon: Calendar },
    { id: "billing", label: "Billing & Invoices", icon: DollarSign },
    /* STANDALONE DOCUMENTS TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
    { id: "documents", label: "Documents", icon: FileText },
    */
    /* STANDALONE COMMUNICATIONS TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
    { id: "communications", label: "Communications", icon: MessageSquare },
    */
    { id: "tickets", label: "Support / Tickets", icon: Ticket },
    /* STANDALONE ATTENDANCE TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
    { id: "attendance", label: "Attendance", icon: Clock },
    */
    /* STANDALONE KYC REVIEW TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
    { id: "kyc", label: "KYC Review", icon: ShieldCheck },
    */
    /* STANDALONE AFFILIATES TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
    { id: "affiliates", label: "Affiliates", icon: Share2 },
    */
    { id: "bpo-connect", label: "BPO Connect", icon: MessageSquareText },
    { id: "bpo-meetings", label: "BPO Meetings", icon: Video },
    /* STANDALONE WALLETS TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
    { id: "wallets", label: "Wallets", icon: Wallet },
    */
    /* STANDALONE BPO WITHDRAWALS TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
    { id: "withdrawals", label: "BPO Withdrawals", icon: Wallet },
    */
    /* STANDALONE BPO PARTNERS TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
    { id: "bpo-partners", label: "BPO Partners", icon: BadgeCheck },
    */
    { id: "settings", label: "Settings", icon: Settings },
  ] as const;

  const panelOpen = editingPlan !== null || isAddingPlan;

  const renderPartnerSection = (title: string, value: any[], field: string, emptyText: string, subtitle: (item: any) => string) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">{value.length}</span>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {value.slice(0, 4).map((item) => (
            <div key={item.id ?? `${title}-${field}-${Math.random()}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800">{item[field] || item.title || item.statement_number || item.name || "Record"}</span>
                {item.status && <StatusBadge status={item.status} />}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{subtitle(item)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-panel h-screen h-[100dvh] max-h-screen flex overflow-hidden bg-white" style={{ color: "#0F172A" }}>
      {/* Desktop Sidebar — Fixed in viewport, independent internal scroll */}
      <aside
        className="hidden md:flex w-56 flex-shrink-0 flex-col py-6 px-3.5 bg-white border-r border-slate-200/80 h-full max-h-screen overflow-hidden z-30"
      >
        <div className="px-2 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <BrandLogo compact />
          </div>
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">Admin Operations</div>
        </div>

        <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1">
          {navItems.filter(({ id }) => id !== "billing" || moduleSettings.find((setting) => setting.module_key === "billing")?.enabled !== false).map(({ id, label, icon: Icon }) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  if (id === "leads") {
                    setLeadsInitialStatus(undefined);
                    setLeadsInitialDate(undefined);
                  }
                  setTab(id);
                }}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left w-full transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-[#214ECF] text-white shadow-sm shadow-[#214ECF]/20 font-semibold"
                    : "text-slate-800 bg-transparent border-l-4 border-l-transparent hover:border-l-[#214ECF] hover:bg-blue-50/70 hover:text-[#214ECF] hover:translate-x-1"
                }`}
              >
                <Icon size={16} className={`transition-colors flex-shrink-0 ${isActive ? "text-white" : "text-[#214ECF]"}`} />
                <span className="truncate">{label}</span>
                {id === "leads" && submissions.filter((s) => s.status === "new").length > 0 && (
                  <span
                    className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-white text-[#214ECF] shadow-2xs"
                        : "bg-[#214ECF] text-white"
                    }`}
                  >
                    {submissions.filter((s) => s.status === "new").length}
                  </span>
                )}
                {id === "bpo-connect" && bpoConnectUnreadCount > 0 && (
                  <span
                    className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-white text-[#214ECF] shadow-2xs"
                        : "bg-[#214ECF] text-white"
                    }`}
                  >
                    {bpoConnectUnreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-4 mt-auto border-t border-slate-200/80">
          <div className="px-3 py-2 text-xs text-slate-500">
            Signed in as <span className="font-semibold text-slate-800">{adminUsername}</span>
          </div>
          <button
            onClick={logout}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-slate-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer"
          >
            <LogOut size={16} className="text-slate-400 group-hover:text-red-500 transition-colors" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop & Drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed top-0 bottom-0 left-0 w-64 bg-white z-50 flex flex-col py-6 px-4 shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between px-2 mb-6">
                <div className="flex items-center gap-2">
                  <BrandLogo compact />
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1">
                {navItems.filter(({ id }) => id !== "billing" || moduleSettings.find((setting) => setting.module_key === "billing")?.enabled !== false).map(({ id, label, icon: Icon }) => {
                  const isActive = tab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        if (id === "leads") {
                          setLeadsInitialStatus(undefined);
                          setLeadsInitialDate(undefined);
                        }
                        setTab(id);
                        setMobileNavOpen(false);
                      }}
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left w-full transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "bg-[#214ECF] text-white shadow-sm shadow-[#214ECF]/20 font-semibold"
                          : "text-slate-800 bg-transparent border-l-4 border-l-transparent hover:border-l-[#214ECF] hover:bg-blue-50/70 hover:text-[#214ECF]"
                      }`}
                    >
                      <Icon size={16} className={`transition-colors flex-shrink-0 ${isActive ? "text-white" : "text-[#214ECF]"}`} />
                      <span className="truncate">{label}</span>
                      {id === "leads" && submissions.filter((s) => s.status === "new").length > 0 && (
                        <span
                          className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                            isActive
                              ? "bg-white text-[#214ECF] shadow-2xs"
                              : "bg-[#214ECF] text-white"
                          }`}
                        >
                          {submissions.filter((s) => s.status === "new").length}
                        </span>
                      )}
                      {id === "bpo-connect" && bpoConnectUnreadCount > 0 && (
                        <span
                          className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                            isActive
                              ? "bg-white text-[#214ECF] shadow-2xs"
                              : "bg-[#214ECF] text-white"
                          }`}
                        >
                          {bpoConnectUnreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="pt-4 mt-auto border-t border-slate-200/80">
                <div className="px-3 py-2 text-xs text-slate-500">
                  Signed in as <span className="font-semibold text-slate-800">{adminUsername}</span>
                </div>
                <button
                  onClick={logout}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-slate-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer"
                >
                  <LogOut size={16} className="text-slate-400 group-hover:text-red-500 transition-colors" />
                  Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content — Independent vertical scroll container */}
      <main className="flex-1 h-full overflow-y-auto overflow-x-hidden bg-white min-w-0">
        {/* Header */}
        <div
          className="px-4 sm:px-6 md:px-8 py-3.5 md:py-5 flex items-center justify-between sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-700 bg-white hover:bg-blue-50/70 border border-slate-200 transition-all cursor-pointer shadow-2xs flex-shrink-0"
              title="Open navigation menu"
            >
              <Menu size={18} className="text-[#214ECF]" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight truncate">
                  {tab === "overview" ? "Dashboard Overview" : tab === "bpo-approvals" ? "BPO Approvals" : tab === "clients" ? "Clients Control Centre" : tab === "leads" ? "Lead Management" : tab === "analytics" ? "Analytics" : tab === "plans" ? "Services & Plans Control Centre" : tab === "client-updates" ? "Client Updates" : tab === "projects" ? "Projects" : tab === "meetings" ? "Meetings" : tab === "documents" ? "Documents" : tab === "communications" ? "Communications" : tab === "tickets" ? "Support / Tickets" : tab === "bpo-connect" ? "BPO Connect & Requests" : tab === "bpo-meetings" ? "BPO Meetings" : tab === "bpo-partners" ? "BPO Partner Operations" : "Settings"}
                </h1>
                {tab === "leads" && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#214ECF] border border-blue-200/60 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#214ECF] animate-pulse" />
                    Inbound Pipeline
                  </span>
                )}
                {tab === "bpo-approvals" && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Partner Onboarding
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
                {tab === "bpo-approvals"
                  ? "Inspect BPO applicant dossiers, verify private office media & walkthrough videos, and manage partner approvals."
                  : tab === "plans"
                  ? "Authoritative service catalogue & plan governance with server-side price synchronisation."
                  : tab === "clients"
                  ? "Operational client management, KYC oversight, plan status, and connected CRM."
                  : tab === "leads"
                  ? "Track, qualify, and convert incoming client proposals and consultation inquiries."
                  : tab === "overview"
                  ? "High-level metrics and recent operational activities."
                  : "Enterprise Administration & Operations Console"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            {/* ADMIN CONTROL CENTRE UI ENTRY COMMENTED OUT PER USER REQUIREMENT - PRESERVED FOR RESTORATION */}
            {/*
            <button
              onClick={() => setLocation("/admin/control-centre")}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 bg-white text-[#214ECF] hover:bg-blue-50/70 border border-[#214ECF]/30 hover:border-[#214ECF] hover:-translate-y-0.5 hover:shadow-sm cursor-pointer"
              title="Open Admin Control Centre"
            >
              <Activity size={14} className="text-[#214ECF]" />
              <span className="hidden sm:inline">Control Centre</span>
              <ChevronRight size={13} className="text-[#214ECF] hidden sm:inline" />
            </button>
            */}
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 bg-white text-[#214ECF] hover:bg-blue-50/70 border border-[#214ECF]/30 hover:border-[#214ECF] hover:-translate-y-0.5 hover:shadow-sm cursor-pointer disabled:opacity-60"
              title="Refresh Data"
            >
              <RefreshCw size={14} className={`text-[#214ECF] ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>
            {tab === "leads" && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 bg-white text-[#214ECF] hover:bg-blue-50/70 border border-[#214ECF]/40 hover:border-[#214ECF] hover:-translate-y-0.5 hover:shadow-sm cursor-pointer"
                title="Export Leads to CSV"
              >
                <Download size={14} className="text-[#214ECF]" />
                <span className="hidden xs:inline sm:inline">Export CSV</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-6 md:p-8">
          {dataError && (
            <div className="mb-6 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-700 border border-red-200">
              {dataError}
            </div>
          )}
          {loading && (tab === "overview" || tab === "analytics") && !stats ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full border-2 border-slate-200 border-t-[#214ECF] w-8 h-8" />
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {tab === "overview" && (
                <AdminOverviewSection
                  refreshTrigger={refreshKey}
                  onNavigateToLeads={(options) => {
                    const status = options?.statusFilter ?? options?.status ?? undefined;
                    const date = options?.dateFilter ?? options?.date ?? undefined;
                    setLeadsInitialStatus(status);
                    setLeadsInitialDate(date);
                    setTab("leads");
                  }}
                  onRefreshParent={refresh}
                />
              )}

              {/* BPO Approvals — Master Approvals & Verification Panel */}
              {tab === "bpo-approvals" && (
                <div className="space-y-6">
                  <AdminBpoApprovalsPanel apiCall={apiCall} />
                </div>
              )}

              {/* Clients Control Centre Tab */}
              {tab === "clients" && (
                <AdminClientsControlCentre refreshTrigger={refreshKey} />
              )}

              {/* Leads Tab */}
              {tab === "leads" && (
                <AdminLeadsSection
                  refreshTrigger={refreshKey}
                  initialStatusFilter={leadsInitialStatus}
                  initialDateFilter={leadsInitialDate}
                  onRefreshStats={refresh}
                />
              )}

              {/* Services & Plans Tab — Master Control Centre */}
              {tab === "plans" && (
                <AdminServicesPlansControlCentre />
              )}

              {/* Analytics Tab */}
              {tab === "analytics" && stats && (
                <div className="space-y-8 max-w-3xl">
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Total Leads" value={stats.total} />
                    <StatCard label="This Week" value={stats.thisWeek} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div
                      className="rounded-2xl p-6"
                      style={{ background: "rgba(244,247,255,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <h3 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "rgba(33,78,207,0.22)" }}>
                        Leads by Status
                      </h3>
                      <div className="space-y-3">
                        {stats.byStatus.map(({ status, count: c }) => {
                          const pct = stats.total > 0 ? Math.round((Number(c) / stats.total) * 100) : 0;
                          const colors = STATUS_COLORS[status] ?? { bg: "rgba(33,78,207,0.06)", text: "rgba(255,255,255,0.5)" };
                          return (
                            <div key={status}>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs capitalize font-medium" style={{ color: colors.text }}>
                                  {status.replace("_", " ")}
                                </span>
                                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{c} ({pct}%)</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(33,78,207,0.04)" }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.8, ease: "easeOut" }}
                                  className="h-full rounded-full"
                                  style={{ background: colors.text }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div
                      className="rounded-2xl p-6"
                      style={{ background: "rgba(244,247,255,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <h3 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "rgba(33,78,207,0.22)" }}>
                        Leads by Budget
                      </h3>
                      <div className="space-y-3">
                        {stats.byBudget.filter((b) => b.budget).map(({ budget, count: c }) => {
                          const pct = stats.total > 0 ? Math.round((Number(c) / stats.total) * 100) : 0;
                          return (
                            <div key={budget}>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs font-medium text-foreground">{budget}</span>
                                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{c} ({pct}%)</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(33,78,207,0.04)" }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.8, ease: "easeOut" }}
                                  className="h-full rounded-full"
                                  style={{ background: "#214ECF" }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        {stats.byBudget.filter((b) => b.budget).length === 0 && (
                          <p className="text-sm" style={{ color: "#4B5563" }}>No budget data yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Client Updates — Operational CRM Workspace */}
              {tab === "client-updates" && (
                <AdminClientsControlCentre initialTab="updates" refreshTrigger={refreshKey} />
              )}

              {tab === "bpo-partners" && (
                <div className="space-y-6">
                  {/* Top Bar with Subtabs */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">BPO Partner Management</h2>
                      <p className="text-xs text-slate-500 mt-1">Review onboarding applications, verify infrastructure & compliance documents, mint Centre IDs, and manage active operations.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                        <button
                          onClick={() => setBpoSubTab("applications")}
                          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                            bpoSubTab === "applications"
                              ? "bg-white text-primary shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <FileCheck size={14} />
                          Applications
                          {(bpoAppCounts.submitted + bpoAppCounts.under_review + bpoAppCounts.action_required) > 0 && (
                            <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                              {bpoAppCounts.submitted + bpoAppCounts.under_review + bpoAppCounts.action_required}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => setBpoSubTab("operations")}
                          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                            bpoSubTab === "operations"
                              ? "bg-white text-primary shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <Building2 size={14} />
                          Active Centres ({bpoPartners.length})
                        </button>
                        <button
                          onClick={() => setBpoSubTab("agreements")}
                          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                            bpoSubTab === "agreements"
                              ? "bg-white text-primary shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <ShieldCheck size={14} />
                          Partner Agreements
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          loadBpoApplications();
                          loadBpoPartners();
                        }}
                        className="flex items-center gap-2 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                      >
                        <RefreshCw size={13} className={bpoAppsLoading || bpoPartnerLoading ? "animate-spin" : ""} />
                        Refresh
                      </button>
                    </div>
                  </div>

                  {bpoSubTab === "applications" && (
                    <div className="space-y-6">
                      {/* Metric Summary Cards */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</div>
                          <div className="mt-1 text-2xl font-black text-slate-900">{bpoAppCounts.total}</div>
                        </div>
                        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Submitted</div>
                          <div className="mt-1 text-2xl font-black text-blue-700">{bpoAppCounts.submitted}</div>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Under Review</div>
                          <div className="mt-1 text-2xl font-black text-amber-700">{bpoAppCounts.under_review}</div>
                        </div>
                        <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 shadow-xs">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Action Req.</div>
                          <div className="mt-1 text-2xl font-black text-orange-700">{bpoAppCounts.action_required}</div>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Approved</div>
                          <div className="mt-1 text-2xl font-black text-emerald-700">{bpoAppCounts.approved}</div>
                        </div>
                        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Rejected</div>
                          <div className="mt-1 text-2xl font-black text-rose-700">{bpoAppCounts.rejected}</div>
                        </div>
                      </div>

                      {/* Filters & Search Bar */}
                      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative flex-1 max-w-md">
                          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={bpoAppsSearch}
                            onChange={(e) => setBpoAppsSearch(e.target.value)}
                            placeholder="Search by application #, company, city, contact..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Filter size={13} />
                            <span>Status:</span>
                          </div>
                          <select
                            value={bpoAppsStatusFilter}
                            onChange={(e) => setBpoAppsStatusFilter(e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="all">All Statuses</option>
                            <option value="submitted">Submitted</option>
                            <option value="under_review">Under Review</option>
                            <option value="action_required">Action Required</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="draft">Draft</option>
                          </select>
                        </div>
                      </div>

                      {/* Applications Table */}
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                        {bpoAppsLoading ? (
                          <div className="flex h-64 items-center justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                          </div>
                        ) : bpoApplications.length === 0 ? (
                          <div className="p-12 text-center">
                            <FileCheck size={36} className="mx-auto mb-3 text-slate-300" />
                            <div className="text-sm font-bold text-slate-700">No BPO partner applications found</div>
                            <p className="mt-1 text-xs text-slate-500">
                              {bpoAppsSearch || bpoAppsStatusFilter !== "all"
                                ? "Try adjusting your search query or status filter."
                                : "Applications submitted via /become-partner will appear here."}
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="border-b border-slate-200 bg-slate-50/80 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                                <tr>
                                  <th className="px-4 py-3">Application No</th>
                                  <th className="px-4 py-3">Company Name</th>
                                  <th className="px-4 py-3">Centre & Location</th>
                                  <th className="px-4 py-3">Contact Person</th>
                                  <th className="px-4 py-3">Capacity</th>
                                  <th className="px-4 py-3">Status</th>
                                  <th className="px-4 py-3">Submitted</th>
                                  <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {bpoApplications.map((app) => (
                                  <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-4 py-3.5 font-mono font-bold text-blue-700">
                                      {app.application_number || `APP-${app.id}`}
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <div className="font-bold text-slate-900">{app.company_name}</div>
                                      <div className="text-[10px] text-slate-500">{app.entity_type || "Private Limited"}</div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <div className="font-semibold text-slate-800">{app.centre_name || "Main Centre"}</div>
                                      <div className="text-[10px] text-slate-500">{app.city ? `${app.city}, ${app.state || ""}` : "Location not set"}</div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <div className="font-medium text-slate-900">{app.contact_person_name || "—"}</div>
                                      <div className="text-[10px] text-slate-500">{app.contact_email || "—"}</div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <span className="font-semibold text-slate-800">{app.seat_capacity ?? 0}</span>
                                      <span className="text-[10px] text-slate-500"> seats ({app.shift_count ?? 1} shifts)</span>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                          app.status === "approved"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : app.status === "rejected"
                                            ? "bg-rose-100 text-rose-800"
                                            : app.status === "action_required"
                                            ? "bg-orange-100 text-orange-800"
                                            : app.status === "under_review"
                                            ? "bg-amber-100 text-amber-800"
                                            : app.status === "submitted"
                                            ? "bg-blue-100 text-blue-800"
                                            : "bg-slate-100 text-slate-700"
                                        }`}
                                      >
                                        {(app.status || "draft").replace("_", " ")}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-slate-500">
                                      {app.submitted_at
                                        ? new Date(app.submitted_at).toLocaleDateString()
                                        : app.created_at
                                        ? new Date(app.created_at).toLocaleDateString()
                                        : "Draft"}
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                      <button
                                        onClick={() => openBpoAppDetail(app.id)}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-blue-600/20 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                                      >
                                        <Eye size={12} />
                                        Review
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Active Partner Operations Subtab */}
                  {bpoSubTab === "operations" && (
                    <div className="space-y-6">
                      {bpoPartnerLoading ? (
                        <div className="flex h-48 items-center justify-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
                        </div>
                      ) : bpoPartners.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                          No approved active BPO partner centres yet. Review and approve applications in the Applications tab to activate partners.
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {bpoPartners.map((partner) => {
                            const partnerDocs = bpoPartnerDocs.filter((item: any) => item.partner_id === partner.id);
                            const partnerMeetings = bpoPartnerMeetings.filter((item: any) => item.partner_id === partner.id);
                            const partnerTraining = bpoPartnerTraining.filter((item: any) => item.partner_id === partner.id);
                            const partnerQuality = bpoPartnerQuality.filter((item: any) => item.partner_id === partner.id);
                            const partnerPayouts = bpoPartnerPayouts.filter((item: any) => item.partner_id === partner.id);

                            return (
                              <div key={partner.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <div className="text-xs font-bold uppercase tracking-widest text-primary">{partner.partner_code || "BPO"}</div>
                                    <h3 className="text-xl font-black text-slate-900">{partner.name}</h3>
                                  </div>
                                  <StatusBadge status={partner.status || "active"} />
                                </div>

                                <div className="grid gap-4 xl:grid-cols-2">
                                  {renderPartnerSection("Documents", partnerDocs, "documents?.original_file_name", "No shared documents for this partner.", (item) => `${item.documents?.category || "Document"} · ${item.documents?.status || "shared"}`)}
                                  {renderPartnerSection("Meetings", partnerMeetings, "meetings?.title", "No shared meetings for this partner.", (item) => `${item.meetings?.status || "scheduled"} · ${item.meetings?.starts_at ? new Date(item.meetings.starts_at).toLocaleString() : "No start time"}`)}
                                  {renderPartnerSection("Training", partnerTraining, "title", "No training programs assigned.", (item) => `${item.status || "not_started"} · ${item.completion_percent ?? 0}% complete`)}
                                  {renderPartnerSection("Quality", partnerQuality, "status", "No quality reviews for this partner.", (item) => `${item.score ?? "n/a"}/100 · ${item.status || "submitted"}`)}
                                  {renderPartnerSection("Payout Statements", partnerPayouts, "statement_number", "No payout statements available.", (item) => `${item.status || "pending"} · ${item.reference || "No reference"}`)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Partner Agreements Subtab */}
                  {bpoSubTab === "agreements" && (
                    <AdminAgreementsPanel />
                  )}

                  {/* Application Review Modal / Drawer */}
                  {selectedBpoApp && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto">
                      <div className="relative my-8 w-full max-w-5xl rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="rounded-xl bg-blue-50 px-3 py-1 font-mono text-xs font-bold text-blue-700">
                              {selectedBpoApp.application_number}
                            </span>
                            <h3 className="text-lg font-black text-slate-900">{selectedBpoApp.company_name}</h3>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                selectedBpoApp.status === "approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : selectedBpoApp.status === "rejected"
                                  ? "bg-rose-100 text-rose-800"
                                  : selectedBpoApp.status === "action_required"
                                  ? "bg-orange-100 text-orange-800"
                                  : selectedBpoApp.status === "under_review"
                                  ? "bg-amber-100 text-amber-800"
                                  : selectedBpoApp.status === "submitted"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {selectedBpoApp.status?.replace("_", " ")}
                            </span>
                          </div>

                          <button
                            onClick={() => setSelectedBpoApp(null)}
                            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        {/* Modal Body */}
                        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
                          {/* Success Message Alert */}
                          {actionSuccessMsg && (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 flex items-center gap-2">
                              <CheckCircle2 size={18} />
                              {actionSuccessMsg}
                            </div>
                          )}

                          {/* Quick Summary Grid */}
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                              <div className="text-[10px] font-bold uppercase text-slate-400">Centre ID</div>
                              <div className="mt-1 font-mono text-sm font-bold text-blue-700">
                                {selectedBpoApp.bpo_centres?.[0]?.centre_id || (selectedBpoApp.status === "approved" ? "THK-IN-PN-00001" : "Pending Minting")}
                              </div>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                              <div className="text-[10px] font-bold uppercase text-slate-400">Total Seats</div>
                              <div className="mt-1 text-sm font-bold text-slate-900">{selectedBpoApp.seat_capacity ?? 0} seats</div>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                              <div className="text-[10px] font-bold uppercase text-slate-400">Location</div>
                              <div className="mt-1 text-sm font-bold text-slate-900">{selectedBpoApp.city || "—"}, {selectedBpoApp.state || "—"}</div>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                              <div className="text-[10px] font-bold uppercase text-slate-400">Contact</div>
                              <div className="mt-1 text-xs font-bold text-slate-900 truncate">{selectedBpoApp.contact_email || "—"}</div>
                            </div>
                          </div>

                          {/* Admin Verification Checklist */}
                          <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                  <ShieldCheck size={16} className="text-blue-600" />
                                  Admin Compliance & Infrastructure Verification Checklist
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5">Toggle verification items below. Changes are saved automatically to the application audit log.</p>
                              </div>
                            </div>

                            <div className="grid gap-2.5 sm:grid-cols-2">
                              {[
                                { key: "company_incorporation_verified", label: "Certificate of Incorporation & Legal Identity", desc: "Registrar certificate, entity registration & active business standing." },
                                { key: "tax_gst_verified", label: "GSTIN / Corporate Tax Registration", desc: "GST portal verification, active status and PAN matching." },
                                { key: "telecom_osp_verified", label: "Telecom / DOT / OSP License & Carrier Leased Lines", desc: "Regulatory DOT OSP registration, compliant PRI/SIP routing." },
                                { key: "power_internet_redundancy_verified", label: "Dual ISP Redundancy & UPS/DG Power Backup", desc: "Dual diverse paths with auto-failover, UPS + generator runtime." },
                                { key: "workstations_specs_verified", label: "Workstations Hardware & Physical Security", desc: "CCTV coverage, biometric access, clean desk & agent device specs." },
                                { key: "data_security_policy_verified", label: "Information Security, NDA & Privacy Protocols", desc: "ISO/SOC2 compliance, signed NDAs, customer data protection." },
                              ].map((item) => {
                                const isChecked = !!appChecks[item.key]?.verified;
                                return (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => handleToggleVerificationCheck(item.key, isChecked)}
                                    disabled={savingCheckKey === item.key}
                                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                                      isChecked
                                        ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
                                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                                    }`}
                                  >
                                    <div className="mt-0.5 shrink-0">
                                      {isChecked ? (
                                        <CheckCircle2 size={16} className="text-emerald-600" />
                                      ) : (
                                        <Square size={16} className="text-slate-400" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className={`text-xs font-bold ${isChecked ? "text-emerald-900" : "text-slate-800"}`}>
                                        {item.label}
                                      </div>
                                      <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.desc}</div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Detail Tabs / Sections */}
                          <div className="grid gap-6 lg:grid-cols-2">
                            {/* Company & Location Info */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Company & Location</h4>
                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Legal Entity:</span><span className="font-semibold text-slate-900">{selectedBpoApp.company_name} ({selectedBpoApp.entity_type || "Pvt Ltd"})</span></div>
                                <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Registration / CIN:</span><span className="font-semibold text-slate-900">{selectedBpoApp.registration_number || "—"}</span></div>
                                <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Year Established:</span><span className="font-semibold text-slate-900">{selectedBpoApp.year_established || "—"}</span></div>
                                <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Tax / GSTIN:</span><span className="font-semibold text-slate-900">{selectedBpoApp.tax_id || "—"}</span></div>
                                <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Website:</span><span className="font-semibold text-blue-600">{selectedBpoApp.website || "—"}</span></div>
                                <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Address:</span><span className="font-semibold text-slate-900 text-right">{selectedBpoApp.address_line1 || "—"}, {selectedBpoApp.city || "—"}</span></div>
                                <div className="flex justify-between py-1"><span className="text-slate-500">Contact Person:</span><span className="font-semibold text-slate-900">{selectedBpoApp.contact_person_name} ({selectedBpoApp.contact_phone || "—"})</span></div>
                              </div>
                            </div>

                            {/* Centre & Infrastructure Details */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Centre & Technical Infrastructure</h4>
                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Facility Type:</span><span className="font-semibold text-slate-900 capitalize">{selectedBpoApp.facility_type || "Leased Commercial"}</span></div>
                                <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Carpet Area:</span><span className="font-semibold text-slate-900">{selectedBpoApp.carpet_area_sqft ? `${selectedBpoApp.carpet_area_sqft} sq ft` : "—"}</span></div>
                                <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Seat Distribution:</span><span className="font-semibold text-slate-900">Voice: {selectedBpoApp.voice_seats ?? 0} | Non-Voice: {selectedBpoApp.non_voice_seats ?? 0} | Blended: {selectedBpoApp.blended_seats ?? 0}</span></div>
                                <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Primary ISP:</span><span className="font-semibold text-slate-900">{selectedBpoApp.primary_isp || "—"} ({selectedBpoApp.bandwidth_mbps || 0} Mbps)</span></div>
                                <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Backup Secondary ISP:</span><span className="font-semibold text-slate-900">{selectedBpoApp.secondary_isp || "—"}</span></div>
                                <div className="flex justify-between border-b border-slate-50 py-1"><span className="text-slate-500">Power & Generator:</span><span className="font-semibold text-slate-900">{selectedBpoApp.power_backup || "UPS & DG Backup"}</span></div>
                                <div className="flex justify-between py-1"><span className="text-slate-500">Dialers & CRM:</span><span className="font-semibold text-slate-900 truncate max-w-[200px]">{Array.isArray(selectedBpoApp.dialer_platforms) ? selectedBpoApp.dialer_platforms.join(", ") : selectedBpoApp.dialer_platforms || "Vicidial"}</span></div>
                              </div>
                            </div>
                          </div>

                          {/* Uploaded Documents List */}
                          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
                            {(() => {
                              const allDocs: any[] = selectedBpoApp.documents || [];
                              const regulatoryKeys = ["gst_certificate", "pan_card", "registration_cin", "gst", "pan", "cin"];
                              const regulatoryDefs = [
                                { type: "gst_certificate", label: "GST Registration Certificate", aliases: ["gst_certificate", "gst"] },
                                { type: "pan_card", label: "Company / Entity PAN Card", aliases: ["pan_card", "pan"] },
                                { type: "registration_cin", label: "Registration / CIN Document", aliases: ["registration_cin", "cin"] },
                              ];

                              const findDoc = (aliases: string[]) => {
                                return allDocs.find((d: any) => aliases.includes(d.document_type) || aliases.includes(d.documentType));
                              };

                              const otherDocs = allDocs.filter((d: any) => !regulatoryKeys.includes(d.document_type) && !regulatoryKeys.includes(d.documentType));

                              const formatBytes = (bytes?: number) => {
                                if (!bytes || bytes <= 0) return "";
                                if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                                return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                              };

                              return (
                                <>
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                    <div>
                                      <h4 className="text-sm font-black text-slate-900">Application Documents & Verification Dossier</h4>
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        Total Uploaded: <span className="font-bold text-slate-800">{allDocs.length}</span> individual document records
                                      </p>
                                    </div>
                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                      25 MB Max Per Document Slot
                                    </span>
                                  </div>

                                  {/* Section 1: REGULATORY DOCUMENTS */}
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <Receipt size={15} className="text-blue-600" />
                                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">Regulatory Documents (KYC & Tax)</h5>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-3">
                                      {regulatoryDefs.map((def) => {
                                        const doc = findDoc(def.aliases);
                                        const isVerified = doc?.status === "verified";
                                        const isRejected = doc?.status === "rejected";
                                        const isPending = doc && !isVerified && !isRejected;
                                        const docId = doc?.id || doc?.document_type || def.type;
                                        const isUpdating = verifyingDocId === docId;

                                        return (
                                          <div
                                            key={def.type}
                                            className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                                              isVerified
                                                ? "border-emerald-200 bg-emerald-50/40"
                                                : isRejected
                                                ? "border-rose-200 bg-rose-50/40"
                                                : doc
                                                ? "border-blue-200 bg-blue-50/30"
                                                : "border-slate-200 bg-slate-50/60"
                                            }`}
                                          >
                                            <div>
                                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                                <div className="font-bold text-xs text-slate-900 leading-snug">{def.label}</div>
                                                {doc ? (
                                                  <span
                                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                                                      isVerified
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : isRejected
                                                        ? "bg-rose-100 text-rose-800"
                                                        : "bg-amber-100 text-amber-800"
                                                    }`}
                                                  >
                                                    {isVerified ? "Verified" : isRejected ? "Rejected" : "Pending"}
                                                  </span>
                                                ) : (
                                                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 shrink-0">
                                                    Not Uploaded
                                                  </span>
                                                )}
                                              </div>

                                              {doc && (
                                                <div className="text-[11px] text-slate-600 space-y-0.5 mt-2">
                                                  <div className="font-mono font-medium truncate" title={doc.original_file_name || doc.file_name}>
                                                    {doc.original_file_name || doc.file_name}
                                                  </div>
                                                  <div className="text-slate-400 text-[10px]">
                                                    {formatBytes(doc.file_size_bytes || doc.file_size)}
                                                  </div>
                                                </div>
                                              )}
                                            </div>

                                            {doc && (
                                              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-1.5">
                                                <a
                                                  href={`/api/admin/accreditation/applications/${selectedBpoApp.id}/documents/${doc.id || doc.file_name}/download`}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                                                >
                                                  <ExternalLink size={11} />
                                                  View
                                                </a>

                                                <div className="flex items-center gap-1">
                                                  <button
                                                    type="button"
                                                    disabled={isUpdating || isVerified}
                                                    onClick={() => handleAdminVerifyDocument(doc.id || doc.document_type, "VERIFY")}
                                                    className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors cursor-pointer"
                                                  >
                                                    Verify
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={isUpdating || isRejected}
                                                    onClick={() => handleAdminVerifyDocument(doc.id || doc.document_type, "REJECT")}
                                                    className="rounded-lg bg-rose-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-rose-700 disabled:opacity-40 transition-colors cursor-pointer"
                                                  >
                                                    Reject
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Section 2: COMPLIANCE & INFRASTRUCTURE DOCUMENTS */}
                                  <div className="space-y-3 pt-2">
                                    <div className="flex items-center gap-2">
                                      <Building2 size={15} className="text-blue-600" />
                                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">Compliance & Infrastructure Documents</h5>
                                    </div>

                                    {otherDocs.length === 0 ? (
                                      <div className="rounded-xl bg-slate-50 p-3.5 text-center text-xs text-slate-500">
                                        No additional compliance documents uploaded.
                                      </div>
                                    ) : (
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        {otherDocs.map((doc: any) => {
                                          const isVerified = doc.status === "verified";
                                          const isRejected = doc.status === "rejected";
                                          const docId = doc.id || doc.document_type;
                                          const isUpdating = verifyingDocId === docId;

                                          return (
                                            <div
                                              key={doc.id || doc.document_type}
                                              className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                                                isVerified
                                                  ? "border-emerald-200 bg-emerald-50/40"
                                                  : isRejected
                                                  ? "border-rose-200 bg-rose-50/40"
                                                  : "border-slate-200 bg-slate-50/60"
                                              }`}
                                            >
                                              <div className="min-w-0 pr-3 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <span className="font-bold text-slate-800 text-xs truncate">
                                                    {doc.document_name || doc.document_type?.replace(/_/g, " ").toUpperCase()}
                                                  </span>
                                                  <span
                                                    className={`rounded-full px-2 py-0.2 text-[9px] font-bold ${
                                                      isVerified
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : isRejected
                                                        ? "bg-rose-100 text-rose-800"
                                                        : "bg-amber-100 text-amber-800"
                                                    }`}
                                                  >
                                                    {doc.status || "Pending"}
                                                  </span>
                                                </div>
                                                <div className="text-[11px] font-mono text-slate-600 truncate">
                                                  {doc.original_file_name || doc.file_name}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                  {formatBytes(doc.file_size_bytes || doc.file_size)}
                                                </div>
                                              </div>

                                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                <a
                                                  href={`/api/admin/accreditation/applications/${selectedBpoApp.id}/documents/${doc.id || doc.file_name}/download`}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                                                >
                                                  <ExternalLink size={11} />
                                                  View
                                                </a>
                                                <div className="flex items-center gap-1">
                                                  <button
                                                    type="button"
                                                    disabled={isUpdating || isVerified}
                                                    onClick={() => handleAdminVerifyDocument(doc.id || doc.document_type, "VERIFY")}
                                                    className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40 cursor-pointer"
                                                  >
                                                    Verify
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={isUpdating || isRejected}
                                                    onClick={() => handleAdminVerifyDocument(doc.id || doc.document_type, "REJECT")}
                                                    className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-rose-700 disabled:opacity-40 cursor-pointer"
                                                  >
                                                    Reject
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          {/* Application Timeline History */}
                          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Application Audit Trail & Events</h4>
                            {(!selectedBpoApp.timeline || selectedBpoApp.timeline.length === 0) ? (
                              <div className="text-xs text-slate-500">No timeline events logged yet.</div>
                            ) : (
                              <div className="space-y-3">
                                {selectedBpoApp.timeline.map((event: any) => (
                                  <div key={event.id} className="flex items-start gap-3 text-xs border-l-2 border-blue-500 pl-3">
                                    <div className="flex-1">
                                      <div className="font-bold text-slate-900 capitalize">{event.event_type?.replace(/_/g, " ")}</div>
                                      {event.notes && <p className="text-slate-600 mt-0.5">{event.notes}</p>}
                                      {event.metadata?.missing_items && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {event.metadata.missing_items.map((it: string) => (
                                            <span key={it} className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
                                              {it}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {new Date(event.created_at).toLocaleString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Modal Action Bar */}
                        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/90 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-xs text-slate-500">
                            Current Status: <span className="font-bold uppercase text-slate-900">{selectedBpoApp.status}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {selectedBpoApp.status === "submitted" && (
                              <button
                                onClick={async () => {
                                  const res = await apiCall(`/admin/partner-applications/${selectedBpoApp.id}/status`, {
                                    method: "PATCH",
                                    body: JSON.stringify({ status: "under_review", notes: "Review begun by administrator" }),
                                  });
                                  if (res.ok) {
                                    await loadBpoApplications();
                                    await openBpoAppDetail(selectedBpoApp.id);
                                  }
                                }}
                                className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                              >
                                Mark Under Review
                              </button>
                            )}

                            {selectedBpoApp.status !== "approved" && selectedBpoApp.status !== "rejected" && (
                              <>
                                <button
                                  onClick={() => {
                                    setBpoActionModal("request_info");
                                    setActionNotes("");
                                    setMissingItemsInput([]);
                                  }}
                                  className="rounded-xl border border-orange-300 bg-orange-50 px-3.5 py-2 text-xs font-bold text-orange-800 hover:bg-orange-100 transition-colors"
                                >
                                  Request More Information
                                </button>

                                <button
                                  onClick={() => {
                                    setBpoActionModal("reject");
                                    setActionNotes("");
                                  }}
                                  className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 transition-colors"
                                >
                                  Reject Application
                                </button>

                                <button
                                  onClick={() => {
                                    setBpoActionModal("approve");
                                    setActionNotes("");
                                  }}
                                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                                >
                                  Approve & Generate Centre ID
                                </button>
                              </>
                            )}

                            {selectedBpoApp.status === "approved" && (
                              <div className="rounded-xl bg-emerald-100 px-3.5 py-2 text-xs font-bold text-emerald-800">
                                Approved · Active Partner Centre
                              </div>
                            )}

                            {selectedBpoApp.status === "rejected" && (
                              <div className="rounded-xl bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-800">
                                Application Rejected
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sub-Modal: Action Confirmation (Approve / Reject / Request More Info) */}
                  {bpoActionModal && selectedBpoApp && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
                      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                        {bpoActionModal === "approve" && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-emerald-600">
                              <CheckCircle2 size={24} />
                              <h3 className="text-lg font-black text-slate-900">Approve BPO Partner & Centre</h3>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Approving will automatically mint a unique Centre ID (e.g. <b>THK-IN-PN-00001</b>), create the BPO centre record, and activate the partner organization account.
                            </p>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700">Approval Notes (Optional)</label>
                              <textarea
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                placeholder="e.g., Verified infrastructure and SLA compliance on call."
                                rows={3}
                                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {bpoActionModal === "reject" && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-rose-600">
                              <AlertTriangle size={24} />
                              <h3 className="text-lg font-black text-slate-900">Reject Application</h3>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Please specify the reason for rejection. This reason will be recorded and visible to the applicant.
                            </p>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700">Rejection Reason *</label>
                              <textarea
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                placeholder="Explain why the application does not meet criteria..."
                                rows={4}
                                required
                                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-rose-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {bpoActionModal === "request_info" && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-orange-600">
                              <AlertCircle size={24} />
                              <h3 className="text-lg font-black text-slate-900">Request More Information</h3>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Specify missing documents or clarifications required. The partner application status will transition to <b>Action Required</b> and the applicant can re-submit.
                            </p>

                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-700">Select Missing Items</label>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  "GST Registration Certificate",
                                  "Certificate of Incorporation",
                                  "DOT / OSP License Copy",
                                  "Dual ISP Bandwidth SLA",
                                  "UPS & Generator Load Audit",
                                  "Facility Lease Agreement",
                                  "Floor Layout Photos",
                                  "Data Security & NDA Policy",
                                ].map((item) => {
                                  const selected = missingItemsInput.includes(item);
                                  return (
                                    <button
                                      key={item}
                                      type="button"
                                      onClick={() => {
                                        if (selected) {
                                          setMissingItemsInput(missingItemsInput.filter((i) => i !== item));
                                        } else {
                                          setMissingItemsInput([...missingItemsInput, item]);
                                        }
                                      }}
                                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                                        selected
                                          ? "bg-orange-600 text-white"
                                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                      }`}
                                    >
                                      {item} {selected ? "✓" : "+"}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="flex gap-2 pt-1">
                                <input
                                  value={customMissingItem}
                                  onChange={(e) => setCustomMissingItem(e.target.value)}
                                  placeholder="Add custom required item..."
                                  className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (customMissingItem.trim() && !missingItemsInput.includes(customMissingItem.trim())) {
                                      setMissingItemsInput([...missingItemsInput, customMissingItem.trim()]);
                                      setCustomMissingItem("");
                                    }
                                  }}
                                  className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-white"
                                >
                                  Add
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700">Detailed Instructions / Remarks</label>
                              <textarea
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                placeholder="Describe specifically what is needed to complete verification..."
                                rows={3}
                                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-orange-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                          <button
                            type="button"
                            onClick={() => {
                              setBpoActionModal(null);
                              setActionNotes("");
                            }}
                            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={submitBpoAction}
                            disabled={actionSubmitting}
                            className={`rounded-xl px-4 py-2 text-xs font-bold text-white transition-colors ${
                              bpoActionModal === "approve"
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : bpoActionModal === "reject"
                                ? "bg-rose-600 hover:bg-rose-700"
                                : "bg-orange-600 hover:bg-orange-700"
                            }`}
                          >
                            {actionSubmitting ? "Processing..." : "Confirm & Send"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STANDALONE ATTENDANCE TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
              {tab === "attendance" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-foreground">Employee & User Attendance</h2>
                      <p className="text-xs" style={{ color: "#4B5563" }}>
                        Real-time audit log of user check-in/out timestamps and durations.
                      </p>
                    </div>
                    <button
                      onClick={loadAttendance}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-primary bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors"
                    >
                      <RefreshCw size={13} className={attendanceLoading ? "animate-spin" : ""} />
                      Refresh Attendance
                    </button>
                  </div>

                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">User ID</th>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Check In</th>
                            <th className="py-3 px-4">Check Out</th>
                            <th className="py-3 px-4">Duration</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {attendanceRecords.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-500">
                                No attendance records recorded in Supabase yet.
                              </td>
                            </tr>
                          ) : (
                            attendanceRecords.map((r) => (
                              <tr key={r.id} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-mono font-medium text-slate-800">{r.userId.slice(0, 8)}...</td>
                                <td className="py-3 px-4 font-semibold text-slate-900">{r.date}</td>
                                <td className="py-3 px-4 text-slate-600">{new Date(r.checkIn).toLocaleTimeString()}</td>
                                <td className="py-3 px-4 text-slate-600">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "In Progress"}</td>
                                <td className="py-3 px-4 text-slate-600">{r.durationMinutes}m</td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 capitalize">
                                    {r.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{r.notes || "—"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              */}

              {/* STANDALONE KYC REVIEW TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
              {tab === "kyc" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-foreground">KYC Identity Verification Queue</h2>
                      <p className="text-xs" style={{ color: "#4B5563" }}>
                        Review submitted passports, national IDs, and identity documents.
                      </p>
                    </div>
                    <button
                      onClick={loadKyc}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-primary bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors"
                    >
                      <RefreshCw size={13} className={kycLoading ? "animate-spin" : ""} />
                      Refresh KYC
                    </button>
                  </div>

                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">User ID</th>
                            <th className="py-3 px-4">Full Name</th>
                            <th className="py-3 px-4">Country</th>
                            <th className="py-3 px-4">Doc Type & ID</th>
                            <th className="py-3 px-4">Submitted At</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {kycRecords.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-500">
                                No KYC submissions awaiting review.
                              </td>
                            </tr>
                          ) : (
                            kycRecords.map((k) => (
                              <tr key={k.id} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-mono font-medium text-slate-800">{k.userId.slice(0, 8)}...</td>
                                <td className="py-3 px-4 font-bold text-slate-900">{k.fullName}</td>
                                <td className="py-3 px-4 text-slate-600">{k.country}</td>
                                <td className="py-3 px-4 text-slate-600">
                                  <span className="capitalize">{k.documentType}</span>: <span className="font-mono">{k.documentNumber}</span>
                                </td>
                                <td className="py-3 px-4 text-slate-500">{new Date(k.submittedAt).toLocaleDateString()}</td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                      k.status === "verified"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : k.status === "rejected"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-amber-100 text-amber-700"
                                    }`}
                                  >
                                    {k.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {k.status === "pending" && (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleReviewKyc(k.id, "verified")}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-xs cursor-pointer"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => setKycReviewModal({ id: k.id, name: k.fullName, action: "rejected" })}
                                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-[11px] border border-red-200 cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                  {k.status !== "pending" && (
                                    <span className="text-[11px] text-slate-500">Reviewed</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              */}

              {/* Billing & Invoices Control Centre Tab */}
              {tab === "billing" && (
                <AdminBillingInvoicesPanel apiCall={apiCall} />
              )}

              {/* STANDALONE AFFILIATES TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
              {tab === "affiliates" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-foreground">Affiliate & Referral Network</h2>
                      <p className="text-xs" style={{ color: "#4B5563" }}>
                        All tracked client invitation links, commission rates, and payouts.
                      </p>
                    </div>
                    <button
                      onClick={loadAffiliates}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-primary bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors"
                    >
                      <RefreshCw size={13} className={affiliatesLoading ? "animate-spin" : ""} />
                      Refresh Affiliates
                    </button>
                  </div>

                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Referral ID</th>
                            <th className="py-3 px-4">Referrer</th>
                            <th className="py-3 px-4">Referred User</th>
                            <th className="py-3 px-4">Code</th>
                            <th className="py-3 px-4">Commission %</th>
                            <th className="py-3 px-4">Total Reward</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {affiliates.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-500">
                                No affiliate referrals recorded yet.
                              </td>
                            </tr>
                          ) : (
                            affiliates.map((aff) => (
                              <tr key={aff.id} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-mono font-medium text-slate-900">#{aff.id}</td>
                                <td className="py-3 px-4 font-mono text-slate-700">{aff.referrer_id.slice(0, 8)}...</td>
                                <td className="py-3 px-4 font-mono text-slate-700">{aff.referred_user_id.slice(0, 8)}...</td>
                                <td className="py-3 px-4 font-bold text-primary uppercase">{aff.referral_code}</td>
                                <td className="py-3 px-4 text-slate-600">{aff.commission_rate}%</td>
                                <td className="py-3 px-4 font-bold text-emerald-600">${parseFloat(aff.total_reward).toFixed(2)}</td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary capitalize">
                                    {aff.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-500">{new Date(aff.created_at).toLocaleDateString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              */}

              {tab === "withdrawals" && (
                <AdminWithdrawalsControlCentre apiCall={apiCall} />
              )}

              {/* Wallets Tab */}
              {tab === "wallets" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-foreground">User Wallets & Financial Ledger</h2>
                      <p className="text-xs" style={{ color: "#4B5563" }}>
                        Global escrow balances, ledger transactions, and withdrawal requests.
                      </p>
                    </div>
                    <button
                      onClick={loadWallets}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-primary bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors"
                    >
                      <RefreshCw size={13} className={walletsLoading ? "animate-spin" : ""} />
                      Refresh Wallets
                    </button>
                  </div>

                  {/* Wallets Table */}
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs">
                    <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-900">
                      User Accounts & Balances ({walletsData.wallets.length} active)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Wallet ID</th>
                            <th className="py-3 px-4">User ID</th>
                            <th className="py-3 px-4">Available Balance</th>
                            <th className="py-3 px-4">Pending Balance</th>
                            <th className="py-3 px-4">Currency</th>
                            <th className="py-3 px-4">Security Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {walletsData.wallets.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-500">
                                No user wallets provisioned yet.
                              </td>
                            </tr>
                          ) : (
                            walletsData.wallets.map((w) => (
                              <tr key={w.id} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-mono font-medium text-slate-900">#{w.id}</td>
                                <td className="py-3 px-4 font-mono text-slate-700">{w.user_id.slice(0, 8)}...</td>
                                <td className="py-3 px-4 font-bold text-slate-900">${parseFloat(w.balance).toFixed(2)}</td>
                                <td className="py-3 px-4 text-slate-500">${parseFloat(w.pending_balance).toFixed(2)}</td>
                                <td className="py-3 px-4 font-semibold text-slate-700">{w.currency}</td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      w.is_locked ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                                    }`}
                                  >
                                    {w.is_locked ? "Locked" : "Active"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Transactions Table */}
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs">
                    <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-900">
                      Recent Ledger Transactions ({walletsData.recentTransactions.length} recorded)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">TX ID</th>
                            <th className="py-3 px-4">User ID</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Amount</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Description</th>
                            <th className="py-3 px-4">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {walletsData.recentTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-500">
                                No ledger transactions logged.
                              </td>
                            </tr>
                          ) : (
                            walletsData.recentTransactions.map((tx) => (
                              <tr key={tx.id} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-mono font-medium text-slate-900">#{tx.id}</td>
                                <td className="py-3 px-4 font-mono text-slate-700">{tx.user_id.slice(0, 8)}...</td>
                                <td className="py-3 px-4 font-semibold text-slate-800 capitalize">{tx.type}</td>
                                <td className={`py-3 px-4 font-bold ${tx.type === "deposit" || tx.type === "commission" ? "text-emerald-600" : "text-slate-900"}`}>
                                  {tx.type === "withdrawal" ? "-" : "+"}${parseFloat(tx.amount).toFixed(2)}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 capitalize">
                                    {tx.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-600 max-w-sm truncate">{tx.description}</td>
                                <td className="py-3 px-4 text-slate-500">{new Date(tx.created_at).toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Projects Master Control Centre */}
              {tab === "projects" && (
                <AdminProjectsControlCentre refreshTrigger={refreshKey} />
              )}

              {tab === "meetings" && (
                <AdminMeetingsPanel />
              )}

              {tab === "bpo-connect" && (
                <AdminBpoConnectSection
                  apiCall={apiCall}
                  onCountChange={(count) => setBpoConnectUnreadCount(count)}
                />
              )}

              {tab === "bpo-meetings" && (
                <AdminBpoMeetingsSection apiCall={apiCall} />
              )}


              {/* STANDALONE DOCUMENTS TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
              {tab === "documents" && (
                <div className="space-y-5"><div><h2 className="text-base font-bold text-slate-900">Document Centre</h2><p className="text-xs text-slate-500 mt-1">Manage private client and project documents.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-5 gap-2"><input value={adminDocumentForm.clientId} onChange={(event) => setAdminDocumentForm((value) => ({ ...value, clientId: event.target.value }))} placeholder="Client profile UUID" className="px-3 py-2 rounded-xl border border-slate-200 text-xs" /><input value={adminDocumentForm.projectId} onChange={(event) => setAdminDocumentForm((value) => ({ ...value, projectId: event.target.value }))} placeholder="Project ID" className="px-3 py-2 rounded-xl border border-slate-200 text-xs" /><select value={adminDocumentForm.category} onChange={(event) => setAdminDocumentForm((value) => ({ ...value, category: event.target.value }))} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"><option>Other</option><option>Contract</option><option>Proposal</option><option>Requirement</option><option>Project Document</option><option>Design</option><option>Technical</option><option>Deliverable</option><option>Report</option></select><select value={adminDocumentForm.visibility} onChange={(event) => setAdminDocumentForm((value) => ({ ...value, visibility: event.target.value }))} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"><option value="client_visible">Client visible</option><option value="internal_only">Internal only</option></select><label className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold text-center cursor-pointer">Upload<input type="file" className="hidden" onChange={uploadAdminDocument} /></label></div><div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Document</th><th className="p-3">Client</th><th className="p-3">Category</th><th className="p-3">Visibility</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{adminDocuments.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">No documents found.</td></tr> : adminDocuments.map((document) => <tr key={document.id}><td className="p-3 font-semibold">{document.original_file_name}<div className="text-[10px] text-slate-500">{new Date(document.created_at).toLocaleString()}</div></td><td className="p-3 font-mono text-[10px]">{document.client_id.slice(0, 8)}...</td><td className="p-3">{document.category}</td><td className="p-3">{document.visibility}</td><td className="p-3">{document.status}</td><td className="p-3 flex gap-2"><button onClick={async () => { const response = await apiCall(`/admin/documents/${document.id}/download`); if (response.ok) window.open((await response.json()).url, "_blank", "noopener,noreferrer"); }} className="text-primary font-bold">Download</button><button onClick={async () => { await apiCall(`/admin/documents/${document.id}`, { method: "PATCH", body: JSON.stringify({ status: document.status === "archived" ? "active" : "archived" }) }); await loadDocuments(); }} className="text-amber-700 font-bold">{document.status === "archived" ? "Restore" : "Archive"}</button></td></tr>)}</tbody></table></div></div>
              )}
              */}

              {/* STANDALONE COMMUNICATIONS TAB DISABLED PER REQUIREMENT — CODE PRESERVED FOR RESTORATION
              {tab === "communications" && (
                <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5"><section className="space-y-3"><h2 className="text-base font-bold text-slate-900">Project Communications</h2>{adminConversations.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-xs text-slate-500">No active conversations.</div> : adminConversations.map((conversation) => <button key={conversation.id} onClick={() => openAdminConversation(conversation)} className={`w-full text-left rounded-xl border p-3 ${selectedAdminConversation?.id === conversation.id ? "border-blue-500 bg-primary/5" : "border-slate-200 bg-white"}`}><p className="text-xs font-bold">{conversation.subject}</p><p className="text-[10px] text-slate-500">Client {conversation.client_id.slice(0, 8)}... · {conversation.status}</p></button>)}</section><section className="rounded-2xl border border-slate-200 bg-white p-5 min-h-96 flex flex-col">{!selectedAdminConversation ? <div className="m-auto text-sm text-slate-500">Select a project conversation.</div> : <><div className="border-b border-slate-100 pb-3"><h2 className="font-bold text-slate-900">{selectedAdminConversation.subject}</h2><button onClick={async () => { await apiCall(`/admin/conversations/${selectedAdminConversation.id}`, { method: "PATCH", body: JSON.stringify({ status: selectedAdminConversation.status === "open" ? "closed" : "open" }) }); await loadConversations(); }} className="text-xs text-primary font-bold">{selectedAdminConversation.status === "open" ? "Close conversation" : "Reopen conversation"}</button></div><div className="flex-1 space-y-3 py-4 overflow-y-auto">{selectedAdminConversation.messages.map((message: any) => <div key={message.id} className={`max-w-[85%] rounded-xl p-3 text-xs ${message.sender_admin_id ? "ml-auto bg-primary text-white" : "bg-slate-100"}`}><p>{message.body}</p><time className="block mt-1 text-[10px] opacity-70">{new Date(message.created_at).toLocaleString()}</time></div>)}</div><form onSubmit={(event) => { event.preventDefault(); sendAdminMessage(); }} className="flex gap-2"><input value={adminMessage} onChange={(event) => setAdminMessage(event.target.value)} placeholder="Reply to client" className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs" /><button className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold">Send</button></form></>}</section></div>
              )}
              */}

              {tab === "tickets" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ["Total", ticketStats?.total ?? 0],
                      ["Open", ticketStats?.open ?? 0],
                      ["In Progress", ticketStats?.inProgress ?? 0],
                      ["High Priority", ticketStats?.highPriority ?? 0],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
                        <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loadTickets(); }} placeholder="Search ticket ID or subject" className="min-w-56 flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                    <select value={ticketStatus} onChange={(e) => { setTicketStatus(e.target.value); }} className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                      <option value="all">All statuses</option><option value="open">Open</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="waiting_for_requester">Waiting</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
                    </select>
                    <select value={ticketPriority} onChange={(e) => { setTicketPriority(e.target.value); }} className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                      <option value="all">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                    </select>
                    <button onClick={loadTickets} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-primary bg-primary/5 border border-primary/10"><RefreshCw size={13} className={ticketsLoading ? "animate-spin" : ""} />Refresh</button>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs">
                    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] border-b border-slate-200"><tr><th className="py-3 px-4">Ticket</th><th className="py-3 px-4">Requester</th><th className="py-3 px-4">Subject</th><th className="py-3 px-4">Priority</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Created</th><th className="py-3 px-4">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
                      {tickets.length === 0 ? <tr><td colSpan={7} className="py-8 text-center text-slate-500">No tickets match these filters.</td></tr> : tickets.map((ticket) => <tr key={ticket.id} className="hover:bg-slate-50/50"><td className="py-3 px-4 font-mono font-bold text-primary">{ticket.ticket_number}</td><td className="py-3 px-4 capitalize text-slate-600">{ticket.requester_role}</td><td className="py-3 px-4 font-semibold text-slate-900">{ticket.subject}<div className="text-[10px] font-normal text-slate-500">{ticket.category}</div></td><td className="py-3 px-4"><select value={ticket.priority} onChange={(e) => updateTicket(ticket, { priority: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] bg-white"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></td><td className="py-3 px-4"><select value={ticket.status} onChange={(e) => updateTicket(ticket, { status: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] bg-white"><option value="open">Open</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="waiting_for_requester">Waiting</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></td><td className="py-3 px-4 text-slate-500">{new Date(ticket.created_at).toLocaleString()}</td><td className="py-3 px-4"><button onClick={() => openTicket(ticket)} className="px-2.5 py-1 rounded-lg bg-primary/5 text-primary font-bold">View</button></td></tr>)}
                    </tbody></table></div>
                  </div>
                </div>
              )}

              {tab === "settings" && (
                <div className="space-y-8">
                  <AdminFeatureControlCentre onNavigateToControlCentre={() => setLocation("/admin")} />

                  <div className="pt-8 border-t border-slate-200">
                    <h3 className="text-base font-bold text-slate-900 mb-4">Account Administration & Security</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div
                        className="rounded-2xl p-6 bg-white border border-slate-200 shadow-xs"
                      >
                        <h2 className="font-semibold text-slate-900 mb-4">Change Password</h2>
                        <form onSubmit={changePassword} className="flex flex-col gap-4">
                          {["currentPassword", "newPassword", "confirmPassword"].map((field) => (
                            <div key={field} className="flex flex-col gap-1.5">
                              <label className="text-xs font-medium uppercase tracking-widest text-slate-500">
                                {field === "currentPassword" ? "Current Password" : field === "newPassword" ? "New Password" : "Confirm New Password"}
                              </label>
                              <input
                                type="password"
                                value={field === "currentPassword" ? currentPassword : field === "newPassword" ? newPassword : confirmPassword}
                                onChange={(e) => {
                                  if (field === "currentPassword") setCurrentPassword(e.target.value);
                                  else if (field === "newPassword") setNewPassword(e.target.value);
                                  else setConfirmPassword(e.target.value);
                                }}
                                required
                                className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-900 border border-slate-200 bg-slate-50/50 focus:outline-none focus:border-primary transition-all"
                              />
                            </div>
                          ))}

                          {pwMessage && (
                            <div
                              className="px-4 py-3 rounded-xl text-sm font-medium"
                              style={{
                                background: pwMessage.type === "success" ? "rgba(33,78,207,0.08)" : "rgba(239,68,68,0.08)",
                                color: pwMessage.type === "success" ? "#214ECF" : "#f87171",
                                border: `1px solid ${pwMessage.type === "success" ? "rgba(33,78,207,0.18)" : "rgba(239,68,68,0.2)"}`,
                              }}
                            >
                              {pwMessage.text}
                            </div>
                          )}

                          <button
                            type="submit"
                            className="py-2.5 rounded-xl text-sm font-bold text-white transition-all bg-primary hover:bg-primary/90 cursor-pointer"
                          >
                            Update Password
                          </button>
                        </form>
                      </div>

                      <div
                        className="rounded-2xl p-6 bg-white border border-slate-200 shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <h2 className="font-semibold text-slate-900 mb-2">Export Data</h2>
                          <p className="text-sm text-slate-500 mb-4">
                            Download all leads as a CSV file for use in CRMs or external spreadsheets.
                          </p>
                        </div>
                        <button
                          onClick={exportCSV}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 cursor-pointer"
                        >
                          <Download size={14} />
                          Export All Leads (CSV)
                        </button>
                      </div>

                      <div
                        className="rounded-2xl p-6 bg-white border border-slate-200 shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <h2 className="font-semibold text-slate-900 mb-2">Session</h2>
                          <p className="text-sm text-slate-500 mb-4">
                            Signed in as <strong className="text-slate-900">{adminUsername}</strong>. Authentication tokens expire after 7 days.
                          </p>
                        </div>
                        <button
                          onClick={logout}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                        >
                          <LogOut size={14} />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-start justify-between"><div><div className="font-mono text-xs font-bold text-primary">{selectedTicket.ticket_number}</div><h2 className="text-lg font-bold text-slate-900">{selectedTicket.subject}</h2><p className="text-xs text-slate-500">{selectedTicket.requester_role} · {selectedTicket.category}</p></div><button onClick={() => setSelectedTicket(null)} className="text-slate-500 hover:text-slate-700"><X size={18} /></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><select value={selectedTicket.status} onChange={async (e) => { const res = await apiCall(`/admin/tickets/${selectedTicket.id}`, { method: "PATCH", body: JSON.stringify({ status: e.target.value }) }); if (res.ok) { await openTicket(selectedTicket); loadTickets(); } else { const data = await res.json(); setDataError(data.error || "Unable to update status"); } }} className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"><option value="open">Open</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="waiting_for_requester">Waiting</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><select value={selectedTicket.priority} onChange={async (e) => { await updateTicket(selectedTicket, { priority: e.target.value }); openTicket(selectedTicket); }} className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select><input type="number" value={selectedTicket.assigned_to || ""} onChange={(e) => setSelectedTicket((previous: any) => ({ ...previous, assigned_to: e.target.value ? Number(e.target.value) : null }))} onBlur={async () => { const res = await apiCall(`/admin/tickets/${selectedTicket.id}`, { method: "PATCH", body: JSON.stringify({ assignedTo: selectedTicket.assigned_to }) }); if (res.ok) { await openTicket(selectedTicket); loadTickets(); } }} placeholder="Admin ID to assign" className="px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
            <div className="space-y-3">{(selectedTicket.ticket_messages || []).map((message: any) => <div key={message.id} className={`rounded-xl p-3 ${message.is_internal ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-slate-200"}`}><div className="text-[10px] uppercase font-bold text-slate-500">{message.is_internal ? "Internal note" : message.author_admin_id ? "Admin reply" : "Requester message"} · {new Date(message.created_at).toLocaleString()}</div><p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{message.body}</p></div>)}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><textarea value={ticketReply} onChange={(e) => setTicketReply(e.target.value)} rows={3} placeholder="Reply to requester" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /><button onClick={() => addTicketMessage(false)} className="mt-2 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold">Send Reply</button></div><div><textarea value={ticketNote} onChange={(e) => setTicketNote(e.target.value)} rows={3} placeholder="Internal note (never shown to requester)" className="w-full px-3 py-2 rounded-xl border border-amber-200 text-sm" /><button onClick={() => addTicketMessage(true)} className="mt-2 px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold">Add Internal Note</button></div></div>
            <div className="border-t border-slate-200 pt-4"><h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Audit history</h3><div className="mt-2 space-y-1">{ticketAudit.length === 0 ? <p className="text-xs text-slate-500">No audit events.</p> : ticketAudit.map((event: any) => <div key={event.id} className="text-xs text-slate-600">{event.action} · {new Date(event.created_at).toLocaleString()}</div>)}</div></div>
          </div>
        </div>
      )}

      {/* Client Update Composer Modal */}
      {updateModalOpen && selectedUpdateClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form onSubmit={saveClientUpdate} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{editingClientUpdate ? "Edit Client Update" : "Send Client Update"}</h3>
                <p className="text-[11px] text-slate-500 mt-1">Only {selectedUpdateClient.clientName} ({selectedUpdateClient.email})</p>
              </div>
              <button type="button" onClick={() => setUpdateModalOpen(false)} className="text-slate-500 hover:text-slate-600"><X size={18} /></button>
            </div>
            <InputField label="Update Title" value={updateForm.title} onChange={(value) => setUpdateForm((prev) => ({ ...prev, title: value }))} placeholder="Daily Progress Update" required />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-widest text-slate-500">Update Message</label>
              <textarea required rows={6} value={updateForm.message} onChange={(e) => setUpdateForm((prev) => ({ ...prev, message: e.target.value }))} placeholder="Write a client-specific project update..." className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-900 border border-slate-200 focus:outline-none focus:border-blue-400" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Category / Status" value={updateForm.category} onChange={(value) => setUpdateForm((prev) => ({ ...prev, category: value }))} placeholder="Project Update" />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-widest text-slate-500">Publish Status</label>
                <select value={updateForm.status} onChange={(e) => setUpdateForm((prev) => ({ ...prev, status: e.target.value as "draft" | "published" }))} className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-900 border border-slate-200 bg-white focus:outline-none focus:border-blue-400">
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
            <div className="text-[11px] text-slate-500">Date/time: {new Date().toLocaleString()} (recorded by the server when saved)</div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setUpdateModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button type="submit" disabled={savingClientUpdate} className="px-5 py-2 bg-primary hover:bg-primary disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer">
                {savingClientUpdate ? "Saving..." : editingClientUpdate ? "Save Changes" : "Send / Publish"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* KYC Rejection Reason Modal */}
      {kycReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Reject KYC Submission</h3>
              <button onClick={() => setKycReviewModal(null)} className="text-slate-500 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Rejecting verification for <span className="font-bold text-slate-900">{kycReviewModal.name}</span>.
              Please provide a specific reason for the client:
            </p>
            <textarea
              rows={3}
              value={kycRejectReason}
              onChange={(e) => setKycRejectReason(e.target.value)}
              placeholder="e.g. Document image is blurry or expired. Please upload a clear color scan."
              className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-red-500"
            />
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setKycReviewModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewingKyc || !kycRejectReason.trim()}
                onClick={() => handleReviewKyc(kycReviewModal.id, "rejected", kycRejectReason.trim())}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                {reviewingKyc ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
