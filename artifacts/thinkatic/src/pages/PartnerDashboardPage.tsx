import { useEffect, useState, useMemo, useRef, type FormEvent } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderKanban,
  GraduationCap,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  Video,
  WalletCards,
  CheckCircle2,
  Clock,
  Globe,
  Briefcase,
  AlertCircle,
  Sparkles,
  ChevronRight,
  X,
  Send,
  FileCheck,
  Bell,
  MoreHorizontal,
  Headphones,
  Menu,
  ChevronDown,
  ArrowUpRight,
  Check,
  CheckCheck,
  Layers,
  Eye,
  Maximize2,
  XCircle,
  MessageSquareText,
  User,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
  BarChart,
  ComposedChart,
  Line,
  LineChart,
} from "recharts";
import BrandLogo from "@/components/layout/BrandLogo";
import BpoAgentManagement from "@/components/partner/BpoAgentManagement";
import BpoTrainingSection from "@/components/partner/BpoTrainingSection";
import BpoAttendanceSection from "@/components/partner/BpoAttendanceSection";
import BpoProductionSection from "@/components/partner/BpoProductionSection";
import BpoQualitySection from "@/components/partner/BpoQualitySection";
import BpoComplianceSection from "@/components/partner/BpoComplianceSection";
import BpoReportsSection from "@/components/partner/BpoReportsSection";
import BpoPayoutsSection from "@/components/partner/BpoPayoutsSection";
import BpoCapacitySection from "@/components/partner/BpoCapacitySection";
import PartnerAgreementSection from "@/components/partner/PartnerAgreementSection";
import PartnerMeetingsSection from "@/components/partner/PartnerMeetingsSection";
import BpoCentreVerificationSection from "@/components/partner/BpoCentreVerificationSection";
import CentreVerificationRequirementCard from "@/components/partner/CentreVerificationRequirementCard";
import BpoOnboardingProgressCard from "@/components/partner/BpoOnboardingProgressCard";
import LockedModuleModal from "@/components/partner/LockedModuleModal";
import BpoConnectWithAdminSection from "@/components/partner/BpoConnectWithAdminSection";
import BpoPartnerProfileSection from "@/components/partner/BpoPartnerProfileSection";

// Operational tabs that remain locked until full BPO accreditation & activation
const OPERATIONAL_TABS = new Set([
  "projects",
  // "centres", // Centres tab removed from BPO Partner UI per spec
  "capacity",
  "agents",
  // "attendance", // Attendance tab removed from BPO Partner UI per spec
  "documents",
  "training",
  "productivity",
  "quality",
  "compliance",
  "payouts",
  // "reports", // Reports tab removed from BPO Partner UI per spec
]);

// Primary Thinkatic Brand Color
const BRAND_BLUE = "#214ECF";

// Exact Approved Project Marketplace Image Mapping (Supports custom uploaded covers + presets)
function getProjectMarketplaceImage(name?: string | null, coverUrl?: string | null): string | null {
  if (coverUrl && typeof coverUrl === "string" && coverUrl.trim().length > 0) {
    return coverUrl.trim();
  }
  if (!name) return null;
  const clean = name.trim();
  if (clean === "US Healthcare Inbound Patient Support") {
    return encodeURI("/Project Marketplace/US Healthcare Inbound Patient Support.png");
  }
  if (clean === "UK Renewable Energy Inbound & Solar Queries") {
    return encodeURI("/Project Marketplace/UK Renewable Energy Inbound & Solar Queries.png");
  }
  if (clean === "Global FinTech Tier-1 Technical Helpdesk") {
    return encodeURI("/Project Marketplace/Global FinTech Tier-1 Technical Helpdesk.png");
  }
  if (clean === "E-Commerce Omnichannel Customer Care") {
    return encodeURI("/Project Marketplace/E-Commerce Omnichannel Customer Care.png");
  }
  if (
    clean === "Global AI Customer Support Operations (TEST 2147)" ||
    clean.startsWith("Global AI Customer Support Operations")
  ) {
    return encodeURI("/Project Marketplace/Global AI Customer Support Operations (TEST 2147).png");
  }
  return null;
}

interface PartnerData {
  id?: string;
  partner_code?: string;
  name?: string;
  legal_name?: string | null;
  contact_name?: string | null;
  status?: string;
  selected_plan?: string | null;
}

interface DashboardData {
  metrics: {
    activeProjects: number;
    centres: number;
    activeAgents: number;
    todaysAttendance: number;
    openTickets: number;
    activeAssignments: number;
  };
  projects: any[];
  centres: any[];
  unavailable: string[];
  unreadNotifications: number;
}

interface Centre {
  id: number;
  name: string;
  centre_id?: string;
  display_name?: string;
  location: string | null;
  capacity: number;
  status: string;
}

interface Agent {
  id: number;
  employee_id: string;
  name: string;
  email: string | null;
  status: string;
  bpo_centres?: { name: string } | null;
}

interface MarketplaceProject {
  id: number;
  name: string;
  vertical: string;
  process_type: string;
  shift: string;
  target_geography: string;
  required_seats: number;
  payout_rate: string;
  billing_cycle: string;
  min_experience_years: number;
  requires_us_experience: boolean;
  requires_uk_experience: boolean;
  min_centre_capacity: number;
  scope: string;
  sla_details: Record<string, any>;
  status: string;
  cover_image_url?: string | null;
  coverImageUrl?: string | null;
  has_applied?: boolean;
  application_status?: string;
  application_id?: number;
  client_info?: {
    client_type?: string;
    industry_vertical?: string;
    target_market?: string;
    sla_tier?: string;
    company_tier?: string;
    industry?: string;
  };
}

interface ProjectApplication {
  id: number;
  application_number: string;
  partner_id: string;
  centre_id?: number | null;
  project_id: number;
  project_name?: string;
  project_vertical?: string;
  project_shift?: string;
  project_rate?: string;
  project_status?: string;
  project_scope?: string;
  sla_details?: Record<string, any>;
  available_seats: number;
  experienced_agents: number;
  us_experience: boolean;
  uk_experience: boolean;
  available_start_date?: string | null;
  current_projects: number;
  infrastructure_confirmed: boolean;
  status: "submitted" | "under_review" | "more_info_required" | "approved" | "rejected" | "allocated" | "accepted" | "withdrawn";
  proposal_notes?: string | null;
  reviewer_notes?: string | null;
  rejection_reason?: string | null;
  more_info_requested?: string | null;
  allocated_seats?: number | null;
  allocated_at?: string | null;
  reviewed_at?: string | null;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
  timeline?: Array<{
    id: number;
    to_status: string;
    from_status?: string | null;
    note?: string | null;
    actor_name?: string | null;
    created_at: string;
  }>;
  timeline_events?: Array<any>;
}

interface ActiveCampaign {
  id: number;
  project_id?: number;
  campaign_name?: string;
  name?: string;
  project_name?: string;
  vertical?: string;
  process_type?: string;
  shift?: string;
  target_geography?: string;
  target?: string;
  scope?: string;
  sla_details?: Record<string, any>;
  payout_rate?: string;
  billing_cycle?: string;
  status?: string;
  assigned_seats?: number;
  target_seats?: number;
  deployed_agents?: number;
  remaining_seats?: number;
  deployment_progress?: number;
  progress_percent?: number;
  assigned_at?: string;
  start_date?: string;
  centre_id?: number | null;
  centre_name?: string;
  projects?: {
    id?: number;
    name?: string;
    progress_percent?: number;
    shift?: string;
    start_date?: string;
  };
  requirements?: {
    min_experience_years?: number;
    requires_us_experience?: boolean;
    requires_uk_experience?: boolean;
    min_centre_capacity?: number;
  };
}

// Complete BPO Partner navigation items (Centres and Attendance tabs commented out from UI per spec)
const tabs = [
  ["overview", "Dashboard", Activity],
  ["projects", "Project Marketplace", FolderKanban],
  // ["centres", "Centres", Building2],
  ["capacity", "Capacity Marketplace", Sparkles],
  ["agents", "Agents", Users],
  // ["attendance", "Attendance", CalendarDays],
  ["documents", "Documents", FileText],
  ["verification", "Office Verification", CheckCircle2],
  ["agreement", "Legal & Agreements", ShieldCheck],
  ["meetings", "Meetings", Video],
  ["training", "Training", GraduationCap],
  ["productivity", "Productivity", BarChart3],
  ["quality", "Quality", ShieldCheck],
  ["compliance", "Compliance", FileCheck],
  // ["payouts", "Payouts", WalletCards], // Payouts tab commented out from BPO Partner Portal UI per user requirement
  // ["wallets", "Wallets", WalletCards], // Wallets tab commented out from BPO Partner Portal UI per requirement
  // ["withdrawals", "BPO Withdrawals", WalletCards], // BPO Withdrawals tab commented out from BPO Partner Portal UI per requirement
  // ["reports", "Reports", Layers], // Reports tab removed from BPO Partner UI per spec
  ["connect-admin", "Connect With Admin", MessageSquareText],
  ["notifications", "Notifications", Bell],
  ["tickets", "Tickets", Headphones],
  ["profile", "Profile", User],
] as const;

type PartnerTab = (typeof tabs)[number][0] | "payouts";

function api(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined"
    ? (localStorage.getItem("user_token") || localStorage.getItem("thinkatic_user_token") || localStorage.getItem("bpo_applicant_token"))
    : null;
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

// Subtle enterprise status pill
function Status({ value }: { value: string }) {
  const v = (value || "").toLowerCase();
  let badgeColor = "bg-blue-50 text-[#214ECF] border-blue-200/80";
  if (v === "allocated") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold animate-pulse";
  else if (v === "accepted" || v === "active" || v === "approved") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
  else if (v === "more_info_required" || v === "pending" || v === "under_review" || v === "submitted") badgeColor = "bg-amber-50 text-amber-800 border-amber-200";
  else if (v === "rejected" || v === "failed") badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
  else if (v === "open") badgeColor = "bg-blue-50 text-[#214ECF] border-blue-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide capitalize ${badgeColor}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

// Custom Tooltip for Recharts Donut Charts
function DonutTooltip({ active, payload, total }: any) {
  if (active && payload && payload.length) {
    const data = payload[0];
    const val = Number(data.value || 0);
    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs z-50">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: data.payload.color || BRAND_BLUE }} />
          <span>{data.name}</span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-4 font-mono text-slate-600">
          <span className="text-sm font-black text-slate-900">{val}</span>
          <span className="rounded-md bg-blue-50 px-1.5 py-0.5 font-bold text-[#214ECF]">{pct}%</span>
        </div>
      </div>
    );
  }
  return null;
}

// Reusable animated mini sparkline for KPI cards with real historical time-series
function KpiSparkline({
  data,
  color = BRAND_BLUE,
  height = 34,
}: {
  data?: Array<{ date: string; value: number }>;
  color?: string;
  height?: number;
}) {
  if (!data || data.length < 2) return null;
  const gradientId = `kpi-grad-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className="h-9 w-full mt-2" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <RechartsTooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-md text-[10px] font-bold text-slate-800 pointer-events-none">
                    <span className="text-slate-500">{payload[0].payload.date}: </span>
                    <span style={{ color }}>{payload[0].value}</span>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            isAnimationActive={true}
            animationDuration={800}
            dot={false}
            activeDot={{ r: 3, fill: color, stroke: "#FFFFFF", strokeWidth: 1.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Custom Tooltip for Combined Project Activity ComposedChart
function ActivityTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl text-xs z-50">
        <p className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 mb-2">
          {item.fullDate || item.label || item.date}
        </p>
        <div className="space-y-1.5 font-mono">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#214ECF]" />
              <span className="font-medium text-slate-600">Projects Created:</span>
            </div>
            <span className="font-bold text-slate-900">{item.projectsCreated ?? 0}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#60A5FA]" />
              <span className="font-medium text-slate-600">Applications:</span>
            </div>
            <span className="font-bold text-[#214ECF]">{item.applicationsSubmitted ?? item.applications ?? 0}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export default function PartnerDashboardPage() {
  const [, setLocation] = useLocation();
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Prevent document/body from vertically scrolling while inside BPO Partner Portal application shell
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // Initialize active tab from URL search parameters (?tab=...)
  const [tab, setTab] = useState<PartnerTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab");
      const valid = tabs.find((t) => t[0] === urlTab);
      return valid ? (valid[0] as PartnerTab) : urlTab === "payouts" ? "payouts" : "overview";
    } catch {
      return "overview";
    }
  });

  // Reset main scroll position to top when navigating between BPO Partner Portal tabs
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [tab]);

  // Track which subtabs have loaded their data to avoid duplicate fetches
  const loadedTabsRef = useRef<Set<string>>(new Set(["overview", "projects"]));

  const changeTab = (newTab: PartnerTab) => {
    if (bpoStatusData?.isOperationalLocked && OPERATIONAL_TABS.has(newTab)) {
      const match = tabs.find((t) => (t[0] as string) === newTab);
      setLockedModuleName(match ? match[1] : (newTab as string));
      setLockedModalOpen(true);
      return;
    }
    setTab(newTab);
    try {
      const url = new URL(window.location.href);
      if (newTab === "overview") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", newTab);
      }
      window.history.replaceState({}, "", url.toString());
    } catch {}
    void loadTabData(newTab);
  };

  useEffect(() => {
    function handlePopState() {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlTab = params.get("tab");
        const valid = tabs.find((t) => t[0] === urlTab);
        const selected = valid ? (valid[0] as PartnerTab) : urlTab === "payouts" ? "payouts" : "overview";
        setTab(selected);
        void loadTabData(selected);
      } catch {}
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [partner, setPartner] = useState<PartnerData | null>(() => {
    try {
      const stored = localStorage.getItem("user_profile");
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          id: parsed.partner_id || parsed.id || "",
          partner_code: parsed.partner_code || "THK-BPO",
          name: parsed.company_name || parsed.name || "BPO Partner",
          legal_name: parsed.legal_name || parsed.company_name || parsed.name || "",
          contact_name: parsed.contact_name || parsed.name || "Partner",
          email: parsed.email || "",
          phone: parsed.phone || "",
          status: parsed.status || "active",
          selected_plan: parsed.selected_plan || null,
        } as PartnerData;
      }
    } catch {}
    return null;
  });
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [training, setTraining] = useState<any[]>([]);
  const [productivity, setProductivity] = useState<any | null>(null);
  const [quality, setQuality] = useState<any | null>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [reports, setReports] = useState<any | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadBadgeCount, setUnreadBadgeCount] = useState<number>(0);
  const [targetMeetingId, setTargetMeetingId] = useState<number | string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markAllSuccess, setMarkAllSuccess] = useState(false);
  const [readingNotificationIds, setReadingNotificationIds] = useState<Set<number>>(new Set());
  const [notificationActionError, setNotificationActionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [centreForm, setCentreForm] = useState({ name: "", location: "", capacity: "" });
  const [agentForm, setAgentForm] = useState({ employeeId: "", name: "", email: "", centreId: "" });
  const [saving, setSaving] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [verificationSummary, setVerificationSummary] = useState<any>(null);
  const [bpoStatusData, setBpoStatusData] = useState<any>(null);
  const [lockedModalOpen, setLockedModalOpen] = useState(false);
  const [lockedModuleName, setLockedModuleName] = useState("");

  // Sidebar controls & Persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("bpo_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [threeDotMenuOpen, setThreeDotMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Human Support ticket modal state
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    category: "Technical Issue",
    priority: "medium",
    description: "",
  });
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // Global keyboard shortcuts (Ctrl+K, Esc) & Dropdown outside-click listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setThreeDotMenuOpen(false);
        setProfileMenuOpen(false);
        setTicketModalOpen(false);
        setLightboxImage(null);
        setSelectedProject(null);
        setSelectedApplication(null);
        setSelectedCampaign(null);
        setApplyingModalOpen(false);
      }
    }
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-dropdown]")) {
        setThreeDotMenuOpen(false);
        setProfileMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Live dynamic clock & local date
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Persist sidebar state
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("bpo_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Phase 2: Project Marketplace State
  const [projectSubTab, setProjectSubTab] = useState<"marketplace" | "applications" | "active">("marketplace");
  const [marketplaceProjects, setMarketplaceProjects] = useState<MarketplaceProject[]>([]);
  const [myApplications, setMyApplications] = useState<ProjectApplication[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<ActiveCampaign[]>([]);
  const [selectedProject, setSelectedProject] = useState<MarketplaceProject | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<ProjectApplication | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<ActiveCampaign | null>(null);
  const [projectDetailsLoading, setProjectDetailsLoading] = useState(false);
  const [applicationDetailsLoading, setApplicationDetailsLoading] = useState(false);
  const [applyingModalOpen, setApplyingModalOpen] = useState(false);
  const [applyModalError, setApplyModalError] = useState("");
  const [submittingApp, setSubmittingApp] = useState(false);
  const [acceptingAppId, setAcceptingAppId] = useState<number | null>(null);
  const [marketplaceVerticalFilter, setMarketplaceVerticalFilter] = useState("all");
  const [marketplaceShiftFilter, setMarketplaceShiftFilter] = useState("all");
  const [notificationMsg, setNotificationMsg] = useState("");
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string } | null>(null);

  // Phase 3: Agent & Training State
  const [bpoAgents, setBpoAgents] = useState<any[]>([]);
  const [bpoAgentStats, setBpoAgentStats] = useState({
    total: 0,
    active: 0,
    training: 0,
    pending: 0,
    certified: 0,
  });
  const [bpoTrainingPrograms, setBpoTrainingPrograms] = useState<any[]>([]);
  const [bpoCertifications, setBpoCertifications] = useState<any[]>([]);
  const [viewCertificate, setViewCertificate] = useState<any | null>(null);

  const [applyForm, setApplyForm] = useState({
    available_seats: 20,
    experienced_agents: 15,
    us_experience: true,
    uk_experience: false,
    available_start_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    current_projects: 1,
    infrastructure_confirmed: true,
    proposal_notes: "",
    centre_id: "",
  });

  // Real Analytics & Sparklines state
  const [activityRange, setActivityRange] = useState<"7d" | "30d" | "6m" | "1y">("6m");
  const [analyticsData, setAnalyticsData] = useState<{
    intervals: Array<{ label: string; fullDate: string; projectsCreated: number; applicationsSubmitted: number; activeCampaigns: number }>;
    sparklines?: {
      activeProjects: Array<{ date: string; value: number }>;
      applications: Array<{ date: string; value: number }>;
      marketplace: Array<{ date: string; value: number }>;
    };
    trends?: {
      applications: number | null;
      projects: number | null;
    };
  } | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  async function loadAnalytics(range: "7d" | "30d" | "6m" | "1y" = activityRange) {
    try {
      setLoadingAnalytics(true);
      const res = await api(`/bpo/analytics/project-activity?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch {}
    finally {
      setLoadingAnalytics(false);
    }
  }

  const handleRangeChange = (newRange: "7d" | "30d" | "6m" | "1y") => {
    setActivityRange(newRange);
    void loadAnalytics(newRange);
  };

  // Dynamic Greeting based on browser local time
  const dynamicGreeting = useMemo(() => {
    const hour = currentTime.getHours();
    const userName = partner?.contact_name || partner?.name || "Partner";
    if (hour >= 5 && hour < 12) {
      return `Good morning, ${userName} 👋`;
    } else if (hour >= 12 && hour < 17) {
      return `Good afternoon, ${userName} 👋`;
    } else {
      return `Good evening, ${userName} 👋`;
    }
  }, [currentTime, partner]);

  // Formatted date string
  const formattedDate = useMemo(() => {
    return currentTime.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [currentTime]);

  // Formatted live time string (09:24 AM format)
  const formattedTime = useMemo(() => {
    return currentTime.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, [currentTime]);

  async function handleCreateTicket(e: FormEvent) {
    e.preventDefault();
    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      setError("Subject and description are required.");
      return;
    }
    setSubmittingTicket(true);
    setError("");
    try {
      const res = await api("/tickets", {
        method: "POST",
        body: JSON.stringify(ticketForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to submit ticket");
      }
      setNotificationMsg(`Support ticket ${data.ticket_number || ""} submitted successfully.`);
      setTimeout(() => setNotificationMsg(""), 5000);
      setTicketModalOpen(false);
      setTicketForm({ subject: "", category: "Technical Issue", priority: "medium", description: "" });
      const tRes = await api("/partner/tickets");
      if (tRes.ok) setTickets(await tRes.json());
    } catch (err: any) {
      setError(err.message || "Failed to create ticket");
    } finally {
      setSubmittingTicket(false);
    }
  }

  // Lazy tab data loader to prevent secondary subtabs from blocking the main dashboard
  async function loadTabData(targetTab: string, force = false) {
    if (!force && loadedTabsRef.current.has(targetTab)) return;
    loadedTabsRef.current.add(targetTab);

    try {
      if (targetTab === "centres") {
        const res = await api("/partner/centres");
        if (res.ok) setCentres(await res.json());
      } else if (targetTab === "agents") {
        const [agentsRes, statsRes, trainingRes, certsRes, centresRes] = await Promise.all([
          api("/bpo/agents"),
          api("/bpo/agents/stats"),
          api("/bpo/training/programs"),
          api("/bpo/certifications"),
          api("/partner/centres"),
        ]);
        if (centresRes.ok) {
          const body = await centresRes.json();
          if (Array.isArray(body)) setCentres(body);
        }
        if (agentsRes.ok) {
          const body = await agentsRes.json();
          const list = Array.isArray(body.agents) ? body.agents : Array.isArray(body) ? body : [];
          setBpoAgents(list);
          setAgents(list);
        }
        if (statsRes.ok) {
          const statsBody = await statsRes.json();
          setBpoAgentStats({
            total: Number(statsBody.total || 0),
            active: Number(statsBody.active || 0),
            training: Number(statsBody.training || 0),
            pending: Number(statsBody.pending || statsBody.pending_verification || 0),
            certified: Number(statsBody.certified || 0),
          });
        }
        if (trainingRes.ok) {
          const body = await trainingRes.json();
          setBpoTrainingPrograms(Array.isArray(body) ? body : []);
        }
        if (certsRes.ok) {
          const body = await certsRes.json();
          setBpoCertifications(Array.isArray(body.certifications) ? body.certifications : Array.isArray(body) ? body : []);
        }
      } else if (targetTab === "attendance") {
        const [attendRes, agentsRes] = await Promise.all([
          api("/partner/attendance"),
          bpoAgents.length === 0 ? api("/bpo/agents") : Promise.resolve(null),
        ]);
        if (attendRes.ok) setAttendance(await attendRes.json());
        if (agentsRes && agentsRes.ok) {
          const body = await agentsRes.json();
          const list = Array.isArray(body.agents) ? body.agents : Array.isArray(body) ? body : [];
          setBpoAgents(list);
          setAgents(list);
        }
      } else if (targetTab === "documents") {
        const res = await api("/partner/documents");
        if (res.ok) setDocuments(await res.json());
      } else if (targetTab === "meetings") {
        const res = await api("/partner/meetings");
        if (res.ok) setMeetings(await res.json());
      } else if (targetTab === "training") {
        const [trainingRes, agentsRes, certsRes] = await Promise.all([
          api("/bpo/training/programs"),
          bpoAgents.length === 0 ? api("/bpo/agents") : Promise.resolve(null),
          bpoCertifications.length === 0 ? api("/bpo/certifications") : Promise.resolve(null),
        ]);
        if (trainingRes.ok) {
          const body = await trainingRes.json();
          setBpoTrainingPrograms(Array.isArray(body) ? body : []);
        }
        if (agentsRes && agentsRes.ok) {
          const body = await agentsRes.json();
          const list = Array.isArray(body.agents) ? body.agents : Array.isArray(body) ? body : [];
          setBpoAgents(list);
          setAgents(list);
        }
        if (certsRes && certsRes.ok) {
          const body = await certsRes.json();
          setBpoCertifications(Array.isArray(body.certifications) ? body.certifications : Array.isArray(body) ? body : []);
        }
      } else if (targetTab === "notifications") {
        if (force || notifications.length === 0) {
          const res = await api("/partner/notifications");
          if (res.ok) {
            const body = await res.json();
            setNotifications(Array.isArray(body) ? body : []);
          }
        }
      } else if (targetTab === "tickets") {
        if (force || tickets.length === 0) {
          const res = await api("/partner/tickets");
          if (res.ok) {
            const body = await res.json();
            setTickets(Array.isArray(body) ? body : []);
          }
        }
      } else if (targetTab === "overview") {
        const bpoStatusRes = await api("/bpo/status");
        if (bpoStatusRes.ok) {
          const bpoStatusBody = await bpoStatusRes.json();
          if (bpoStatusBody) setBpoStatusData(bpoStatusBody);
        }
      }
    } catch {}
  }

  async function load(isManualRefresh = false) {
    const token = typeof window !== "undefined"
      ? (localStorage.getItem("user_token") || localStorage.getItem("thinkatic_user_token") || localStorage.getItem("bpo_applicant_token"))
      : null;
    const adminToken = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

    if (!token && !adminToken) {
      setLocation("/login?returnTo=/partner");
      return;
    }

    if (adminToken && !token) {
      setLocation("/admin");
      return;
    }

    try {
      const rawUser = localStorage.getItem("user_profile");
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed.role === "admin") {
          setLocation("/admin");
          return;
        }
        if (parsed.accountType === "USER" || parsed.role === "client" || parsed.role === "user") {
          setLocation("/client");
          return;
        }
      }
    } catch {}

    if (isManualRefresh) {
      setRefreshing(true);
      loadedTabsRef.current.clear();
      loadedTabsRef.current.add(tab);
    } else {
      if (!dashboard && tab === "overview") setLoading(true);
    }
    setError("");

    try {
      // Step 1: Lightweight authentication & status check (parallel)
      const [profileRes, bpoStatusRes, notifCountRes] = await Promise.all([
        api("/partner/profile"),
        api("/bpo/status"),
        api("/partner/notifications/unread-count"),
      ]);

      const [profileBody, bpoStatusBody, notifCountBody] = await Promise.all([
        profileRes.json().catch(() => ({})),
        bpoStatusRes.json().catch(() => null),
        notifCountRes.json().catch(() => ({})),
      ]);

      if (bpoStatusBody) {
        if (bpoStatusBody.accountState === "CLIENT") {
          setLocation("/client");
          return;
        }
        setBpoStatusData(bpoStatusBody);
      }

      if (profileRes.status === 401) {
        localStorage.removeItem("user_token");
        localStorage.removeItem("user_profile");
        localStorage.removeItem("agent_token");
        localStorage.removeItem("agent_profile");
        setLocation("/login?returnTo=/partner");
        return;
      }
      if (profileRes.status === 403) {
        setLocation("/client");
        return;
      }
      if (profileRes.status === 503) {
        setDisabled(true);
        setError(profileBody.error || profileBody.message || "BPO partner portal is currently disabled");
        return;
      }
      if (profileBody.status === "PENDING") {
        setPending(true);
      }
      if (profileBody.status === "VERIFICATION_REQUIRED") {
        setVerificationRequired(true);
        setVerificationSummary(profileBody.verificationSummary);
      }

      setPartner(profileBody);
      if (notifCountBody?.unread_count !== undefined) {
        setUnreadBadgeCount(Number(notifCountBody.unread_count));
      }

      // Step 2: Tab-specific loading without blocking page shell
      if (tab === "overview") {
        const [dashRes, marketplaceRes] = await Promise.all([
          api("/partner/dashboard"),
          api("/bpo/marketplace/projects"),
        ]);
        const [dashBody, marketplaceBody] = await Promise.all([
          dashRes.json().catch(() => ({})),
          marketplaceRes.json().catch(() => ({ projects: [] })),
        ]);
        const safeDashboard: DashboardData = (dashBody && dashBody.metrics) ? dashBody : {
          metrics: {
            activeProjects: 0,
            centres: 0,
            activeAgents: 0,
            todaysAttendance: 0,
            openTickets: 0,
            activeAssignments: 0,
          },
          projects: [],
          centres: [],
          unavailable: [],
          unreadNotifications: notifCountBody?.unread_count ?? 0,
        };
        setDashboard(safeDashboard);
        if (Array.isArray(dashBody.centres) && dashBody.centres.length) {
          setCentres(dashBody.centres);
        }
        if (Array.isArray(dashBody.projects) && dashBody.projects.length) {
          setProjects(dashBody.projects);
        }
        setMarketplaceProjects(marketplaceBody.projects || []);
        void loadAnalytics(activityRange);
      } else if (tab === "projects") {
        const [marketplaceRes, myAppsRes, activeCampaignsRes] = await Promise.all([
          api("/bpo/marketplace/projects"),
          api("/bpo/marketplace/my-applications"),
          api("/bpo/marketplace/active-campaigns"),
        ]);
        const [marketplaceBody, myAppsBody, activeCampaignsBody] = await Promise.all([
          marketplaceRes.json().catch(() => ({ projects: [] })),
          myAppsRes.json().catch(() => ({ applications: [] })),
          activeCampaignsRes.json().catch(() => ({ campaigns: [] })),
        ]);
        setMarketplaceProjects(marketplaceBody.projects || []);
        setMyApplications(myAppsBody.applications || []);
        if (activeCampaignsBody.campaigns) {
          setActiveCampaigns(activeCampaignsBody.campaigns);
        }
      } else {
        void loadTabData(tab, isManualRefresh);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load partner operations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCentre(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await api("/partner/centres", { method: "POST", body: JSON.stringify(centreForm) });
    if (!response.ok) setError((await response.json()).error || "Unable to create centre");
    else {
      setCentreForm({ name: "", location: "", capacity: "" });
      void loadTabData("centres", true);
      void load();
    }
    setSaving(false);
  }

  async function createAgent(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await api("/partner/agents", { method: "POST", body: JSON.stringify(agentForm) });
    if (!response.ok) setError((await response.json()).error || "Unable to create agent");
    else {
      setAgentForm({ employeeId: "", name: "", email: "", centreId: "" });
      void loadTabData("agents", true);
      void load();
    }
    setSaving(false);
  }

  // Optimistic instantaneous notification read handler:
  // Updates UI in 0ms, persists in Supabase, reconciles unread count, rolls back on error.
  const handleNotificationRead = async (targetId: number) => {
    if (readingNotificationIds.has(targetId)) return;
    const now = new Date().toISOString();

    setReadingNotificationIds((prev) => new Set(prev).add(targetId));
    setNotificationActionError("");
    setNotifications((items) =>
      items.map((item) => (item.id === targetId ? { ...item, read_at: item.read_at || now } : item))
    );
    setDashboard((prev) =>
      prev ? { ...prev, unreadNotifications: Math.max(0, (prev.unreadNotifications || 1) - 1) } : prev
    );

    try {
      const res = await api(`/partner/notifications/${targetId}/read`, { method: "POST" });
      if (!res.ok) {
        throw new Error("Unable to mark notification as read. Please try again.");
      }
    } catch (err: any) {
      setNotifications((items) =>
        items.map((item) => (item.id === targetId ? { ...item, read_at: null } : item))
      );
      setDashboard((prev) =>
        prev ? { ...prev, unreadNotifications: (prev.unreadNotifications || 0) + 1 } : prev
      );
      setNotificationActionError(err.message || "Unable to mark notification as read. Please try again.");
    } finally {
      setReadingNotificationIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  // Optimistic instantaneous Mark All Read handler:
  const handleMarkAllNotificationsRead = async () => {
    if (markingAllRead || unreadCount === 0) return;
    const now = new Date().toISOString();

    setMarkingAllRead(true);
    setNotificationActionError("");
    setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || now })));
    setDashboard((prev) => (prev ? { ...prev, unreadNotifications: 0 } : prev));
    setMarkAllSuccess(true);

    try {
      const res = await api("/partner/notifications/read-all", { method: "POST" });
      if (!res.ok) {
        throw new Error("Unable to mark notifications as read. Please try again.");
      }
      setTimeout(() => setMarkAllSuccess(false), 4000);
    } catch (err: any) {
      const refetch = await api("/partner/notifications").catch(() => null);
      if (refetch && refetch.ok) {
        const body = await refetch.json().catch(() => []);
        setNotifications(Array.isArray(body) ? body : []);
      }
      setMarkAllSuccess(false);
      setNotificationActionError(err.message || "Unable to mark notifications as read. Please try again.");
    } finally {
      setMarkingAllRead(false);
    }
  };

  // Phase 2: Open Project Details (Fetches latest SLA & Specs from API)
  const handleOpenProjectDetails = async (proj: MarketplaceProject) => {
    setSelectedProject(proj);
    setApplyingModalOpen(false);
    setApplyModalError("");
    setProjectDetailsLoading(true);
    try {
      const res = await api(`/bpo/marketplace/projects/${proj.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.project) {
          setSelectedProject({
            ...proj,
            ...data.project,
            has_applied: Boolean(data.caller_application) || proj.has_applied,
            application_status: data.caller_application?.status || proj.application_status,
            application_id: data.caller_application?.id || proj.application_id,
          });
        }
      }
    } catch {
      // Retain optimistic card data
    } finally {
      setProjectDetailsLoading(false);
    }
  };

  const handleOpenApplyModal = (proj: MarketplaceProject) => {
    setSelectedProject(proj);
    setApplyModalError("");
    setApplyForm({
      ...applyForm,
      available_seats: proj.required_seats,
      us_experience: proj.requires_us_experience,
      uk_experience: proj.requires_uk_experience,
      proposal_notes: "",
    });
    setApplyingModalOpen(true);
  };

  // Phase 2: Submit Project Application with Capacity Validation & Inline Feedback
  async function handleApplySubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;
    setApplyModalError("");

    const requestedSeats = Number(applyForm.available_seats);
    if (!requestedSeats || requestedSeats <= 0) {
      setApplyModalError("Please specify a valid number of committed seats (at least 1 seat required).");
      return;
    }

    if (!applyForm.infrastructure_confirmed) {
      setApplyModalError("You must confirm that your facility meets technical & infrastructure standards.");
      return;
    }

    // Capacity validation against chosen centre if selected
    if (applyForm.centre_id) {
      const chosenCentre = centres.find((c) => String(c.id) === String(applyForm.centre_id));
      if (chosenCentre && chosenCentre.capacity > 0 && requestedSeats > chosenCentre.capacity) {
        setApplyModalError(
          `Committed seats (${requestedSeats}) exceed the provisioned capacity (${chosenCentre.capacity} workstations) of ${chosenCentre.name}. Please adjust your capacity or select another facility.`
        );
        return;
      }
    }

    setSubmittingApp(true);
    try {
      const res = await api(`/bpo/marketplace/projects/${selectedProject.id}/apply`, {
        method: "POST",
        body: JSON.stringify({
          available_seats: requestedSeats,
          experienced_agents: Number(applyForm.experienced_agents),
          us_experience: applyForm.us_experience,
          uk_experience: applyForm.uk_experience,
          available_start_date: applyForm.available_start_date,
          current_projects: Number(applyForm.current_projects),
          infrastructure_confirmed: applyForm.infrastructure_confirmed,
          proposal_notes: applyForm.proposal_notes,
          centre_id: applyForm.centre_id ? Number(applyForm.centre_id) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setApplyModalError(data.message || data.error || "Failed to submit project application");
        return;
      }

      setApplyingModalOpen(false);
      setSelectedProject(null);
      setNotificationMsg(`Application ${data.application.application_number} submitted successfully! Thinkatic operations will review your capacity.`);
      setTimeout(() => setNotificationMsg(""), 7000);
      await load();
      setProjectSubTab("applications");
    } catch (err: any) {
      setApplyModalError(err.message || "Failed to submit application");
    } finally {
      setSubmittingApp(false);
    }
  }

  // Phase 2: Open Application Details
  const handleOpenApplicationDetails = async (app: ProjectApplication) => {
    setSelectedApplication(app);
    setApplicationDetailsLoading(true);
    try {
      const res = await api(`/bpo/marketplace/applications/${app.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.application) {
          setSelectedApplication({ ...app, ...data.application });
        }
      }
    } catch {
      // Retain optimistic application data
    } finally {
      setApplicationDetailsLoading(false);
    }
  };

  // Phase 2: Accept Project Allocation
  async function handleAcceptAllocation(appId: number) {
    setAcceptingAppId(appId);
    setError("");
    try {
      const res = await api(`/bpo/marketplace/applications/${appId}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "Failed to accept allocation");
        return;
      }

      setNotificationMsg(`Congratulations! Project "${data.project?.name || "Campaign"}" has been accepted and is now ACTIVE.`);
      setTimeout(() => setNotificationMsg(""), 7000);
      setSelectedApplication(null);
      await load();
      setProjectSubTab("active");
    } catch (err: any) {
      setError(err.message || "Failed to accept project allocation");
    } finally {
      setAcceptingAppId(null);
    }
  }

  // Phase 2: Open Campaign Details
  const handleOpenCampaignDetails = (camp: ActiveCampaign) => {
    setSelectedCampaign(camp);
  };

  function logout() {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_profile");
    localStorage.removeItem("agent_token");
    localStorage.removeItem("agent_profile");
    window.location.href = "/login?loggedOut=true";
  }

  // Real Donut 1: Project Overview automated calculations
  const projectChartData = useMemo(() => {
    const active = dashboard?.metrics?.activeProjects || 0;
    const applied = myApplications.length || 0;
    const available = marketplaceProjects.length || 0;
    return [
      { name: "Active Projects", value: active, color: BRAND_BLUE },
      { name: "My Applications", value: applied, color: "#60A5FA" },
      { name: "Marketplace Available", value: available, color: "#93C5FD" },
    ].filter((d) => d.value > 0);
  }, [dashboard, myApplications, marketplaceProjects]);

  const totalProjectsInSystem = useMemo(() => {
    return (dashboard?.metrics?.activeProjects || 0) + myApplications.length + marketplaceProjects.length;
  }, [dashboard, myApplications, marketplaceProjects]);

  // Real Donut 2: Agent Status automated calculations
  const agentChartData = useMemo(() => {
    const active = bpoAgentStats.active || dashboard?.metrics?.activeAgents || 0;
    const training = bpoAgentStats.training || 0;
    const pendingCount = bpoAgentStats.pending || 0;
    const inactive = (bpoAgentStats as any).inactive || 0;
    return [
      { name: "Active Deployed", value: active, color: BRAND_BLUE },
      { name: "In Training", value: training, color: "#818CF8" },
      { name: "Pending Verification", value: pendingCount, color: "#F59E0B" },
      { name: "Inactive / Standby", value: inactive, color: "#94A3B8" },
    ].filter((d) => d.value > 0);
  }, [bpoAgentStats, dashboard]);

  const totalAgentsCount = useMemo(() => {
    return (
      (bpoAgentStats.active || dashboard?.metrics?.activeAgents || 0) +
      (bpoAgentStats.training || 0) +
      (bpoAgentStats.pending || 0) +
      ((bpoAgentStats as any).inactive || 0)
    );
  }, [bpoAgentStats, dashboard]);

  // Real Timeline/Activity Chart data based on actual applications and projects
  const displayActivityData = useMemo(() => {
    if (analyticsData?.intervals && analyticsData.intervals.length > 0) {
      return analyticsData.intervals;
    }
    if (!myApplications.length && !marketplaceProjects.length) return [];
    return [
      {
        label: "Current",
        fullDate: "Current Period",
        projectsCreated: marketplaceProjects.length,
        applicationsSubmitted: myApplications.length,
        activeCampaigns: projects.length,
      },
    ];
  }, [analyticsData, myApplications, marketplaceProjects, projects]);

  // Real Upcoming Deadlines based on verification, agreements, training, and active campaigns
  const upcomingDeadlines = useMemo(() => {
    const list: Array<{ id: string; title: string; ref: string; dueDate: string; status: string; icon: any }> = [];

    if (partner?.status === "pending_verification") {
      list.push({
        id: "centre-verif",
        title: "Centre Physical Verification",
        ref: partner.partner_code || "THK-BPO",
        dueDate: "Action Required",
        status: "Pending Audit",
        icon: Building2,
      });
    }

    bpoTrainingPrograms.forEach((prog) => {
      if (prog.status === "in_progress" || prog.status === "active") {
        list.push({
          id: `train-${prog.id}`,
          title: prog.name || "Campaign Readiness Training",
          ref: `TRN-${prog.id}`,
          dueDate: prog.target_date ? new Date(prog.target_date).toLocaleDateString() : "Ongoing",
          status: prog.status,
          icon: GraduationCap,
        });
      }
    });

    projects.forEach((p) => {
      if (p.projects?.expected_end_date) {
        list.push({
          id: `prj-${p.id}`,
          title: `${p.projects?.name || p.campaign_name || "Campaign"} SLA Review`,
          ref: `PRJ-${p.project_id || p.id}`,
          dueDate: new Date(p.projects.expected_end_date).toLocaleDateString(),
          status: p.status || "active",
          icon: Briefcase,
        });
      }
    });

    return list;
  }, [partner, bpoTrainingPrograms, projects]);

  // Single source of truth for unread notifications count:
  // Derived directly from notifications array; accurately updates whenever notifications change.
  // Falls back to dashboard unread count only before notifications array is populated.
  const unreadCount = useMemo(() => {
    if (Array.isArray(notifications) && notifications.length > 0) {
      return notifications.filter((n) => !n.read_at).length;
    }
    return unreadBadgeCount || (dashboard?.unreadNotifications ?? 0);
  }, [notifications, unreadBadgeCount, dashboard?.unreadNotifications]);

  if (disabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] px-5 text-center text-slate-900 font-sans">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <ShieldCheck className="mx-auto text-[#214ECF]" size={36} />
          <h1 className="mt-4 text-xl font-black text-slate-900">Partner Portal Unavailable</h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{error}</p>
          <button
            onClick={() => void load()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1b3fa8] transition"
          >
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      </div>
    );
  }



  // Filtered Marketplace Projects
  const filteredMarketplace = marketplaceProjects.filter((p) => {
    if (marketplaceVerticalFilter !== "all" && p.vertical.toLowerCase() !== marketplaceVerticalFilter.toLowerCase()) return false;
    if (marketplaceShiftFilter !== "all" && !p.shift.toLowerCase().includes(marketplaceShiftFilter.toLowerCase())) return false;
    return true;
  });

  // ── SUSPENDED / HOLD ACCOUNT GUARD (PART 13) ──────────────────────────
  if (bpoStatusData?.isSuspended || bpoStatusData?.accountState === "BPO_SUSPENDED") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
        <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo compact />
            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-700 border border-amber-200">
              OPERATIONAL HOLD
            </span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 mb-6 shadow-inner">
              <Clock className="h-8 w-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3.5 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Status: UNDER REVIEW
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ACCOUNT TEMPORARILY SUSPENDED
            </h1>

            <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed max-w-md mx-auto">
              Your BPO Partner account is temporarily under review by Thinkatic Operations. Please review the information below and wait for further instructions.
            </p>

            {bpoStatusData?.suspensionReason && (
              <div className="mt-6 p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-left">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                  Reason for Review:
                </span>
                <p className="text-xs text-amber-900 leading-relaxed font-medium">
                  {bpoStatusData.suspensionReason}
                </p>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void load(true)}
                disabled={refreshing}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin text-[#214ECF]" : ""} />
                <span>Check Status</span>
              </button>
              <a
                href="mailto:operations@thinkatic.com?subject=BPO%20Account%20Review%20Inquiry"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#214ECF] text-xs font-bold text-white hover:bg-[#1A3DB3] transition shadow-xs cursor-pointer"
              >
                <Send size={14} />
                <span>Contact Operations</span>
              </a>
            </div>
          </div>
        </main>

        <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
          Thinkatic Global BPO Network · Production Operations Control
        </footer>
      </div>
    );
  }

  return (
    <div className="bpo-portal h-screen h-[100dvh] max-h-screen min-h-screen flex flex-col overflow-hidden bg-[#FFFFFF] text-slate-900 font-sans">
      {/* ── TOP HEADER (Stable across top of application shell) ───────────────── */}
      <header className="shrink-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 w-full">
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Mobile Hamburger Drawer Trigger */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 lg:hidden transition cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu size={18} className="shrink-0" />
            </button>

            {/* Desktop Brand Logo */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <BrandLogo compact />
              <span className="hidden sm:inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#214ECF] border border-blue-100 select-none">
                BPO PARTNER
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-[#214ECF]/30 hover:text-[#214ECF] hover:bg-blue-50/50 transition cursor-pointer shrink-0 disabled:opacity-50"
              title="Refresh live data"
              aria-label="Refresh live data"
            >
              <RefreshCw size={16} className={`shrink-0 block ${refreshing ? "animate-spin text-[#214ECF]" : ""}`} />
            </button>

            {/* Notifications Bell */}
            <button
              type="button"
              onClick={() => changeTab("notifications")}
              className="relative h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-[#214ECF]/30 hover:text-[#214ECF] hover:bg-blue-50/50 transition cursor-pointer shrink-0"
              title="View notifications"
              aria-label="View notifications"
            >
              <Bell size={16} className="shrink-0 block" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#214ECF] px-1 text-[9px] font-black text-white ring-2 ring-white pointer-events-none select-none">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Centre / Company Identity Pill */}
            <div className="hidden xl:flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-xs shrink-0 select-none">
              <Building2 size={14} className="text-[#214ECF] shrink-0" />
              <span className="font-bold text-slate-900 truncate max-w-[140px] leading-none">{partner?.name || "BPO Partner"}</span>
              <span className="font-mono text-[10px] text-slate-500 border-l border-slate-200 pl-2 leading-none">
                {partner?.partner_code || "THK-BPO"}
              </span>
            </div>

            {/* Authenticated BPO Header Action Buttons */}
            <div className="hidden lg:flex items-center gap-2">
              {/* "BPO Dashboard" button disabled/commented out per UI requirement
              <button
                type="button"
                onClick={() => changeTab("overview")}
                className={`h-9 px-3.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center justify-center leading-none ${
                  tab === "overview"
                    ? "bg-blue-50 text-[#214ECF] border-blue-200"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                BPO Dashboard
              </button>
              */}

              {/* "Open BPO Partner Portal" button disabled/commented out per UI requirement
              {bpoStatusData?.accountState === "BPO_ACTIVE" ? (
                <button
                  type="button"
                  onClick={() => changeTab("projects")}
                  className="h-9 px-3.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 leading-none"
                >
                  <Sparkles size={13} className="shrink-0" />
                  <span>Open BPO Partner Portal</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("bpo-onboarding-progress");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                    else changeTab("overview");
                  }}
                  className="h-9 px-3.5 rounded-xl text-xs font-bold text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 leading-none"
                >
                  <Clock size={13} className="shrink-0" />
                  <span>Continue Onboarding</span>
                </button>
              )}
              */}

              {/* "Talk to Thinkatic" button disabled/commented out per UI requirement
              <button
                type="button"
                onClick={() => setTicketModalOpen(true)}
                className="h-9 px-3.5 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer flex items-center justify-center leading-none"
              >
                Talk to Thinkatic
              </button>
              */}
            </div>

            {/* Profile Menu & Sign Out */}
            <div className="relative shrink-0" data-dropdown="profile">
              <button
                type="button"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="h-9 px-2 flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:border-[#214ECF]/30 hover:bg-slate-50 transition cursor-pointer"
                aria-label="Partner account menu"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#214ECF] text-xs font-black text-white shrink-0 select-none">
                  {(partner?.contact_name || partner?.name || "P").charAt(0).toUpperCase()}
                </div>
                <ChevronDown size={14} className="text-slate-400 shrink-0 hidden sm:block" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50">
                  <div className="border-b border-slate-100 p-3">
                    <p className="text-xs font-bold text-slate-900 truncate">{partner?.contact_name || partner?.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{partner?.partner_code || "BPO Partner"}</p>
                    <span className="inline-block mt-2 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#214ECF]">
                      BPO Partner Account
                    </span>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => { changeTab("profile"); setProfileMenuOpen(false); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50/60 hover:text-[#214ECF] transition"
                    >
                      <User size={14} /> Profile
                    </button>
                    <button
                      onClick={() => { changeTab("verification"); setProfileMenuOpen(false); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50/60 hover:text-[#214ECF] transition"
                    >
                      <CheckCircle2 size={14} /> Centre Verification
                    </button>
                    <button
                      onClick={() => { changeTab("agreement"); setProfileMenuOpen(false); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50/60 hover:text-[#214ECF] transition"
                    >
                      <ShieldCheck size={14} /> Legal Agreement
                    </button>
                    {/* Human Support profile menu item disabled/commented out per UI requirement
                    <button
                      onClick={() => { changeTab("tickets"); setProfileMenuOpen(false); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50/60 hover:text-[#214ECF] transition"
                    >
                      <Headphones size={14} /> Human Support
                    </button>
                    */}
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={logout}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN LAYOUT (SIDEBAR + CONTENT) ─────────────────────────────── */}
      <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden relative">
        {/* ── DESKTOP WHITE SIDEBAR (Fixed / Stationary, Independent Internal Navigation Scroll) ── */}
        <aside
          className={`hidden lg:flex flex-col border-r border-slate-200 bg-white shrink-0 select-none h-full max-h-full overflow-hidden z-20 ${
            sidebarCollapsed ? "w-20" : "w-64"
          }`}
          style={{ transition: "width 180ms ease, padding 180ms ease" }}
        >
          {/* Sidebar Control Header with Centered Three-Dot Control */}
          <div
            className={`flex h-14 items-center border-b border-slate-100 shrink-0 select-none ${
              sidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
            }`}
          >
            {!sidebarCollapsed && (
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 select-none leading-none">
                Operations Menu
              </span>
            )}

            {/* Three-Dot Expand/Collapse Control — Perfectly Centered 32x32 Button */}
            <div className="relative" data-dropdown="three-dot">
              <button
                type="button"
                onClick={toggleSidebar}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer shrink-0 select-none"
                title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                aria-label={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <MoreHorizontal size={18} className="shrink-0 block" />
              </button>
            </div>
          </div>

          {/* Navigation Items */}
          <nav
            className={`flex-1 overflow-y-auto min-h-0 ${
              sidebarCollapsed ? "px-2 py-3 space-y-1.5" : "p-3 space-y-1"
            }`}
          >
            {tabs.map(([id, label, Icon]) => {
              const isActive = tab === id;
              const isLocked = Boolean(bpoStatusData?.isOperationalLocked && OPERATIONAL_TABS.has(id));
              const hasAction = id === "projects" && myApplications.filter((a) => a.status === "allocated").length > 0;
              return (
                <div key={id} className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      if (isLocked) {
                        setLockedModuleName(label);
                        setLockedModalOpen(true);
                      } else {
                        changeTab(id);
                      }
                    }}
                    className={`relative flex items-center rounded-xl text-xs font-semibold cursor-pointer select-none ${
                      sidebarCollapsed
                        ? "w-10 h-10 mx-auto p-0 justify-center"
                        : "w-full h-10 px-3 justify-start gap-3"
                    } ${
                      isActive
                        ? "bg-[#214ECF] text-white shadow-sm shadow-blue-500/20 font-bold"
                        : isLocked
                        ? "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                        : "text-slate-600 hover:bg-blue-50/60 hover:text-[#214ECF]"
                    }`}
                    style={{
                      transition: "all 180ms ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    }}
                    title={sidebarCollapsed ? `${label}${isLocked ? " (Locked)" : ""}` : undefined}
                  >
                    {/* Left Accent Bar on Hover (only when expanded, NOT active, and NOT locked) */}
                    {!sidebarCollapsed && !isActive && !isLocked && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[#214ECF] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                    )}

                    {/* Icon container with strict fixed 20x20 sizing for pixel-perfect vertical and horizontal alignment */}
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      <Icon
                        size={18}
                        className={`shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                          isActive ? "text-white" : isLocked ? "text-slate-400" : "text-slate-500 group-hover:text-[#214ECF]"
                        }`}
                      />
                    </div>

                    {!sidebarCollapsed && (
                      <span className="truncate flex-1 text-left leading-none font-semibold">
                        {label}
                      </span>
                    )}

                    {!sidebarCollapsed && isLocked && (
                      <LockKeyhole size={14} className="ml-auto text-slate-400 group-hover:text-amber-500 transition-colors shrink-0" />
                    )}

                    {!sidebarCollapsed && !isLocked && hasAction && (
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black text-white animate-pulse shrink-0">
                        Action
                      </span>
                    )}
                  </button>

                  {/* Collapsed Mode Floating Tooltip */}
                  {sidebarCollapsed && (
                    <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden group-hover:flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#214ECF] shadow-lg whitespace-nowrap">
                      {label} {isLocked ? "🔒" : ""}
                      {hasAction && !isLocked && (
                        <span className="ml-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] text-white">
                          Action
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Sidebar Footer Support Hint — disabled/commented out per UI requirement
          {!sidebarCollapsed && (
            <div className="border-t border-slate-100 p-4 shrink-0 mt-auto">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-[#214ECF]">
                  <Headphones size={15} />
                  <span>Human Support</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                  Dedicated operational coordination.
                </p>
                <button
                  onClick={() => changeTab("tickets")}
                  className="mt-2.5 inline-flex items-center text-[11px] font-bold text-[#214ECF] hover:underline"
                >
                  Open Ticket Flow →
                </button>
              </div>
            </div>
          )}
          */}
        </aside>

        {/* ── MOBILE OFF-CANVAS DRAWER ─────────────────────────────────── */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div
              onClick={() => setMobileDrawerOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
            />

            {/* Slide-In Drawer */}
            <div className="fixed inset-y-0 left-0 w-72 bg-white p-5 shadow-2xl flex flex-col transform transition-transform duration-200 ease-in-out">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <BrandLogo compact />
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close navigation drawer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-2 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Navigation</p>
              </div>

              <nav className="flex-1 overflow-y-auto space-y-1 pr-1">
                {tabs.map(([id, label, Icon]) => {
                  const isActive = tab === id;
                  const isLocked = Boolean(bpoStatusData?.isOperationalLocked && OPERATIONAL_TABS.has(id));
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        if (isLocked) {
                          setMobileDrawerOpen(false);
                          setLockedModuleName(label);
                          setLockedModalOpen(true);
                        } else {
                          changeTab(id);
                          setMobileDrawerOpen(false);
                        }
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold transition ${
                        isActive
                          ? "bg-[#214ECF] text-white font-bold shadow-sm"
                          : isLocked
                          ? "text-slate-400 hover:bg-slate-50"
                          : "text-slate-700 hover:bg-blue-50/60 hover:text-[#214ECF]"
                      }`}
                    >
                      <Icon size={18} />
                      <span className="truncate flex-1 text-left">{label}</span>
                      {isLocked && <LockKeyhole size={14} className="ml-auto text-slate-400" />}
                    </button>
                  );
                })}
              </nav>

              <div className="border-t border-slate-100 pt-4 mt-2">
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT AREA (Independently Scrollable Container) ───────────────── */}
        <main
          ref={mainScrollRef}
          className="flex-1 min-w-0 min-h-0 h-full overflow-y-auto overflow-x-hidden bg-slate-50/40 p-4 sm:p-6 lg:p-8"
        >
          {/* Global Notification Banner */}
          {notificationMsg && (
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 shadow-sm">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />
                <span>{notificationMsg}</span>
              </div>
              <button onClick={() => setNotificationMsg("")} className="text-emerald-700 hover:text-emerald-950 p-1">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Clean Error Banner (no internal SQL/traces exposed) */}
          {error && (
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 shadow-sm">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={18} className="text-red-500 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => void load()}
                className="rounded-lg bg-white border border-red-200 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-100/50 transition"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Loading Skeleton States */}
          {loading && tab === "overview" && !dashboard ? (
            <div className="space-y-6">
              {/* Header Skeleton */}
              <div className="h-14 w-1/3 rounded-2xl bg-slate-200/70 animate-pulse" />

              {/* KPI Skeletons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-32 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse space-y-3">
                    <div className="h-4 w-28 bg-slate-200 rounded" />
                    <div className="h-8 w-16 bg-slate-200 rounded" />
                    <div className="h-3 w-20 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>

              {/* Charts Skeleton */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="h-72 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse" />
                <div className="h-72 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse" />
              </div>
            </div>
          ) : (
            <>
              {/* ── OVERVIEW TAB ──────────────────────────────────────────── */}
              {tab === "overview" && dashboard && (
                <section className="space-y-6">
                  {/* Dynamic Greeting & Live Date/Time Bar */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200/80 pb-6">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#214ECF]">
                        Partner Delivery Operations
                      </p>
                      <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {dynamicGreeting}
                      </h1>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-2xs text-right">
                        <p className="font-semibold text-slate-700">{formattedDate}</p>
                        <p className="font-mono text-[11px] font-bold text-[#214ECF]">{formattedTime}</p>
                      </div>
                      <button
                        onClick={() => void load(true)}
                        disabled={refreshing}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-2xs hover:border-[#214ECF]/30 hover:text-[#214ECF] hover:bg-blue-50/50 transition"
                        title="Refresh data"
                        aria-label="Refresh data"
                      >
                        <RefreshCw size={16} className={refreshing ? "animate-spin text-[#214ECF]" : ""} />
                      </button>
                    </div>
                  </div>

                  {/* Executive BPO Onboarding & Accreditation Progress Card */}
                  {bpoStatusData && (bpoStatusData.isOperationalLocked || bpoStatusData.accountState !== "BPO_ACTIVE") && (
                    <div id="bpo-onboarding-progress" className="space-y-6">
                      <BpoOnboardingProgressCard
                        summary={bpoStatusData.onboardingSummary}
                        accountState={bpoStatusData.accountState}
                        companyName={partner?.name}
                        onNavigateToTab={(targetTab) => {
                          if (targetTab === "apply") {
                            window.location.href = "/partner/apply";
                          } else {
                            changeTab(targetTab as any);
                          }
                        }}
                      />

                      {/* Centre Verification Requirement Card — Rendered ONLY inside authenticated BPO Dashboard */}
                      {bpoStatusData.centreVerification &&
                        bpoStatusData.centreVerification.status !== "APPROVED" && (
                          <div id="office-verification-overview">
                            <CentreVerificationRequirementCard
                              centreVerification={bpoStatusData.centreVerification}
                              applicationNumber={bpoStatusData.application?.applicationNumber}
                              onCompleteClick={() => changeTab("verification")}
                            />
                          </div>
                        )}
                    </div>
                  )}

                  {/* Allocation Banner Alert if Partner has Allocated Campaigns */}
                  {myApplications
                    .filter((a) => a.status === "allocated")
                    .map((app) => (
                      <div
                        key={app.id}
                        className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/80 p-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                              <Sparkles size={12} /> Project Allocated to Your Centre
                            </span>
                            <h3 className="mt-2 text-lg font-black text-emerald-950">{app.project_name}</h3>
                            <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                              Thinkatic operations has allocated this campaign to your facility. Click below to accept and begin production deployment.
                            </p>
                          </div>
                          <button
                            onClick={() => handleAcceptAllocation(app.id)}
                            disabled={acceptingAppId === app.id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                          >
                            <CheckCircle2 size={16} />
                            {acceptingAppId === app.id ? "Activating..." : "Accept Allocation"}
                          </button>
                        </div>
                      </div>
                    ))}

                  {/* 6 KPI CARDS (Real Database Values & Animated Real Sparklines) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* 1. Active Projects */}
                    <div data-testid="kpi-card" className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-[#214ECF]/30 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Projects</span>
                          <div className="rounded-xl bg-blue-50 p-2.5 text-[#214ECF]">
                            <FolderKanban size={18} />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <p className="text-3xl font-black text-slate-900 tracking-tight">
                            {dashboard.metrics.activeProjects}
                          </p>
                          {analyticsData?.trends?.projects !== null && analyticsData?.trends?.projects !== undefined ? (
                            <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold font-mono ${
                              analyticsData.trends.projects >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            }`}>
                              {analyticsData.trends.projects >= 0 ? "↑" : "↓"} {Math.abs(analyticsData.trends.projects)}%
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">Current total</span>
                          )}
                        </div>
                      </div>
                      <KpiSparkline data={analyticsData?.sparklines?.activeProjects} color={BRAND_BLUE} />
                    </div>

                    {/* 2. Centres */}
                    <div data-testid="kpi-card" className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-[#214ECF]/30 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Centres</span>
                          <div className="rounded-xl bg-blue-50 p-2.5 text-[#214ECF]">
                            <Building2 size={18} />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <p className="text-3xl font-black text-slate-900 tracking-tight">
                            {dashboard.metrics.centres}
                          </p>
                          <span className="text-[11px] text-slate-400 font-medium">Provisioned facilities</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Operational Capacity</span>
                        <span className="font-mono font-bold text-slate-800">
                          {centres.reduce((acc, c) => acc + (c.capacity || 0), 0)} Seats
                        </span>
                      </div>
                    </div>

                    {/* 3. Active Agents */}
                    <div data-testid="kpi-card" className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-[#214ECF]/30 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Agents</span>
                          <div className="rounded-xl bg-blue-50 p-2.5 text-[#214ECF]">
                            <Users size={18} />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <p className="text-3xl font-black text-slate-900 tracking-tight">
                            {bpoAgentStats.active || dashboard.metrics.activeAgents || 0}
                          </p>
                          <span className="text-[11px] text-slate-400 font-medium">Currently deployed</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Training Roster</span>
                        <span className="font-mono font-bold text-indigo-600">
                          {bpoAgentStats.training || 0} Agents
                        </span>
                      </div>
                    </div>

                    {/* 4. Available Marketplace Projects */}
                    <div data-testid="kpi-card" className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-[#214ECF]/30 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Available Marketplace</span>
                          <div className="rounded-xl bg-blue-50 p-2.5 text-[#214ECF]">
                            <Globe size={18} />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <p className="text-3xl font-black text-slate-900 tracking-tight">
                            {marketplaceProjects.length}
                          </p>
                          <span className="text-[11px] text-slate-400 font-medium">Available now</span>
                        </div>
                      </div>
                      <KpiSparkline data={analyticsData?.sparklines?.marketplace} color="#60A5FA" />
                    </div>

                    {/* 5. My Project Applications */}
                    <div data-testid="kpi-card" className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-[#214ECF]/30 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">My Project Applications</span>
                          <div className="rounded-xl bg-blue-50 p-2.5 text-[#214ECF]">
                            <FileText size={18} />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <p className="text-3xl font-black text-slate-900 tracking-tight">
                            {myApplications.length}
                          </p>
                          {analyticsData?.trends?.applications !== null && analyticsData?.trends?.applications !== undefined ? (
                            <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold font-mono ${
                              analyticsData.trends.applications >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            }`}>
                              {analyticsData.trends.applications >= 0 ? "↑" : "↓"} {Math.abs(analyticsData.trends.applications)}%
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">Submitted proposals</span>
                          )}
                        </div>
                      </div>
                      <KpiSparkline data={analyticsData?.sparklines?.applications} color={BRAND_BLUE} />
                    </div>

                    {/* 6. Today's Attendance */}
                    <div data-testid="kpi-card" className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-[#214ECF]/30 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Today's Attendance</span>
                          <div className="rounded-xl bg-blue-50 p-2.5 text-[#214ECF]">
                            <CalendarDays size={18} />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <p className="text-3xl font-black text-slate-900 tracking-tight">
                            {dashboard.metrics.todaysAttendance}
                          </p>
                          <span className="text-[11px] text-slate-400 font-medium">Marked today</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Roster Check-in Status</span>
                        <span className="font-mono font-bold text-slate-800">
                          {dashboard.metrics.todaysAttendance > 0 ? "Active Check-ins" : "Standby"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── REAL INTERACTIVE CHARTS ROW ───────────────────────── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Donut Chart 1: Project Overview */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-[#214ECF]/30 transition duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-black text-slate-900">Project Overview</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Current distribution of portfolio projects</p>
                        </div>
                        <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#214ECF]">
                          Total: {totalProjectsInSystem}
                        </span>
                      </div>

                      {projectChartData.length > 0 ? (
                        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-6">
                          <div className="h-52 w-52 relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={projectChartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={55}
                                  outerRadius={80}
                                  paddingAngle={4}
                                  dataKey="value"
                                  isAnimationActive={true}
                                  animationDuration={800}
                                >
                                  {projectChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <RechartsTooltip content={<DonutTooltip total={totalProjectsInSystem} />} />
                              </PieChart>
                            </ResponsiveContainer>
                            {/* Center Summary Counter */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                              <span className="text-2xl font-black text-slate-900 tracking-tight">{totalProjectsInSystem}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Projects</span>
                            </div>
                          </div>

                          {/* Legend with exact calculated percentages */}
                          <div className="space-y-3 text-xs flex-1">
                            {projectChartData.map((item) => {
                              const pct = totalProjectsInSystem > 0 ? Math.round((item.value / totalProjectsInSystem) * 100) : 0;
                              return (
                                <div key={item.name} className="flex items-center justify-between rounded-xl bg-slate-50/70 p-2.5 border border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="font-semibold text-slate-700">{item.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-900">{item.value}</span>
                                    <span className="font-mono text-[11px] font-bold text-[#214ECF]">({pct}%)</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="h-52 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                          <FolderKanban size={32} className="text-slate-300 mb-2" />
                          <p className="text-xs font-semibold">No project data to visualize</p>
                          <p className="text-[11px] text-slate-400 mt-1">Explore the Marketplace to apply for live campaigns.</p>
                        </div>
                      )}
                    </div>

                    {/* Donut Chart 2: Agent Status */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-[#214ECF]/30 transition duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-black text-slate-900">Agent Roster Status</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Real-time deployment & training capacity</p>
                        </div>
                        <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#214ECF]">
                          Total: {totalAgentsCount}
                        </span>
                      </div>

                      {agentChartData.length > 0 ? (
                        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-6">
                          <div className="h-52 w-52 relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={agentChartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={55}
                                  outerRadius={80}
                                  paddingAngle={4}
                                  dataKey="value"
                                  isAnimationActive={true}
                                  animationDuration={800}
                                >
                                  {agentChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <RechartsTooltip content={<DonutTooltip total={totalAgentsCount} />} />
                              </PieChart>
                            </ResponsiveContainer>
                            {/* Center Summary Counter */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                              <span className="text-2xl font-black text-slate-900 tracking-tight">{totalAgentsCount}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Agents</span>
                            </div>
                          </div>

                          {/* Legend with exact calculated percentages */}
                          <div className="space-y-3 text-xs flex-1">
                            {agentChartData.map((item) => {
                              const pct = totalAgentsCount > 0 ? Math.round((item.value / totalAgentsCount) * 100) : 0;
                              return (
                                <div key={item.name} className="flex items-center justify-between rounded-xl bg-slate-50/70 p-2.5 border border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="font-semibold text-slate-700">{item.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-900">{item.value}</span>
                                    <span className="font-mono text-[11px] font-bold text-[#214ECF]">({pct}%)</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="h-52 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                          <Users size={32} className="text-slate-300 mb-2" />
                          <p className="text-xs font-semibold">No agent roster records</p>
                          <p className="text-[11px] text-slate-400 mt-1">Add agents in the Agents tab to track operational status.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── PROJECT ACTIVITY TIMELINE & MARKETPLACE CTA ROW ──── */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Combined Activity Graph (2 cols) */}
                    <div id="project-activity-graph" className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-[#214ECF]/30 transition duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div>
                          <h3 className="text-base font-black text-slate-900">Project Activity</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Projects created and partner applications submitted</p>
                        </div>

                        {/* Functional Time Filter Tabs */}
                        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                          {[
                            ["7d", "Last 7 Days"],
                            ["30d", "Last 30 Days"],
                            ["6m", "Last 6 Months"],
                            ["1y", "This Year"],
                          ].map(([val, text]) => (
                            <button
                              key={val}
                              data-range={val}
                              onClick={() => handleRangeChange(val as any)}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all duration-150 ${
                                activityRange === val
                                  ? "bg-[#214ECF] text-white shadow-xs"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                              }`}
                            >
                              {text}
                            </button>
                          ))}
                        </div>
                      </div>

                      {displayActivityData.length > 0 ? (
                        <div>
                          <div className="h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={displayActivityData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
                                <RechartsTooltip content={<ActivityTooltip />} />
                                <Bar
                                  dataKey="projectsCreated"
                                  name="Projects Created"
                                  fill={BRAND_BLUE}
                                  radius={[4, 4, 0, 0]}
                                  maxBarSize={32}
                                  isAnimationActive={true}
                                  animationDuration={800}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="applicationsSubmitted"
                                  name="Applications Submitted"
                                  stroke="#60A5FA"
                                  strokeWidth={2.5}
                                  dot={{ r: 4, fill: "#60A5FA", stroke: "#FFFFFF", strokeWidth: 2 }}
                                  activeDot={{ r: 6, fill: BRAND_BLUE, stroke: "#FFFFFF", strokeWidth: 2 }}
                                  isAnimationActive={true}
                                  animationDuration={1000}
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex items-center justify-end gap-5 text-xs font-semibold text-slate-600 mt-3 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-xs bg-[#214ECF]" />
                              <span>Projects Created</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#60A5FA]" />
                              <span>Applications Submitted</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-56 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                          <BarChart3 size={32} className="text-slate-300 mb-2" />
                          <p className="text-xs font-semibold">No project activity yet</p>
                          <p className="text-[11px] text-slate-400 mt-1">Your project activity will appear here once projects are created.</p>
                        </div>
                      )}
                    </div>

                    {/* Marketplace CTA Card (1 col) */}
                    <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/50 to-white p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="inline-flex rounded-xl bg-[#214ECF] p-3 text-white shadow-sm shadow-blue-500/20">
                          <Sparkles size={20} />
                        </div>
                        <h3 className="mt-4 text-xl font-black text-slate-900">Find Your Next Project</h3>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          Explore available opportunities from global clients. Scale your contact centre headcount with enterprise SLA-backed accounts.
                        </p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-blue-100">
                        <button
                          onClick={() => {
                            changeTab("projects");
                            setProjectSubTab("marketplace");
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#214ECF] px-5 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#1b3fa8] transition"
                        >
                          <span>Browse Marketplace</span>
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── ASSIGNED CAMPAIGNS & RECENT APPLICATIONS ROW ─────── */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Assigned & Active Campaigns */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                          <h3 className="text-base font-black text-slate-900">Assigned & Active Campaigns</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Allocated contact centre accounts</p>
                        </div>
                        <button
                          onClick={() => { changeTab("projects"); setProjectSubTab("active"); }}
                          className="text-xs font-bold text-[#214ECF] hover:underline inline-flex items-center gap-1"
                        >
                          View all <ChevronRight size={14} />
                        </button>
                      </div>

                      <div className="mt-4 divide-y divide-slate-100">
                        {dashboard.projects.length ? (
                          dashboard.projects.slice(0, 5).map((item) => (
                            <div
                              key={item.id}
                              onClick={() => { changeTab("projects"); setProjectSubTab("active"); }}
                              className="group relative flex items-center justify-between py-3.5 px-2 hover:bg-slate-50/80 rounded-xl transition cursor-pointer"
                            >
                              {/* Left Blue Hover Accent Bar */}
                              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[#214ECF] opacity-0 group-hover:opacity-100 transition-opacity" />

                              <div className="flex items-center gap-3 pl-2">
                                <div className="rounded-xl bg-blue-50 p-2.5 text-[#214ECF] group-hover:bg-[#214ECF] group-hover:text-white transition">
                                  <Briefcase size={16} />
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-slate-900 group-hover:text-[#214ECF] transition">
                                    {item.projects?.name || item.campaign_name || "Assigned Campaign"}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    ID: PRJ-{item.project_id || item.projects?.id || item.id} · {item.target || "Enterprise BPO"} · Start: {item.projects?.start_date || (item.assigned_at ? new Date(item.assigned_at).toLocaleDateString() : "Active")}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Status value={item.status} />
                                <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-1 group-hover:text-[#214ECF] transition-transform" />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center">
                            <FolderKanban size={28} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-xs font-bold text-slate-700">No active projects yet</p>
                            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                              Explore the marketplace to find available opportunities and apply for client accounts.
                            </p>
                            <button
                              onClick={() => { changeTab("projects"); setProjectSubTab("marketplace"); }}
                              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#214ECF] hover:bg-blue-50/50 transition"
                            >
                              Explore Marketplace →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent Applications */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                          <h3 className="text-base font-black text-slate-900">Recent Applications</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Submitted capacity proposals</p>
                        </div>
                        <button
                          onClick={() => { changeTab("projects"); setProjectSubTab("applications"); }}
                          className="text-xs font-bold text-[#214ECF] hover:underline inline-flex items-center gap-1"
                        >
                          View all <ChevronRight size={14} />
                        </button>
                      </div>

                      <div className="mt-4 divide-y divide-slate-100">
                        {myApplications.length ? (
                          myApplications.slice(0, 5).map((app) => (
                            <div
                              key={app.id}
                              onClick={() => { changeTab("projects"); setProjectSubTab("applications"); }}
                              className="group relative flex items-center justify-between py-3.5 px-2 hover:bg-slate-50/80 rounded-xl transition cursor-pointer"
                            >
                              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[#214ECF] opacity-0 group-hover:opacity-100 transition-opacity" />

                              <div className="pl-2">
                                <p className="font-bold text-sm text-slate-900 group-hover:text-[#214ECF] transition">{app.project_name}</p>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">
                                  {app.application_number} · {app.available_seats} seats committed · {new Date(app.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Status value={app.status} />
                                {app.status === "allocated" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAcceptAllocation(app.id);
                                    }}
                                    disabled={acceptingAppId === app.id}
                                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition"
                                  >
                                    Accept
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center">
                            <FileText size={28} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-xs font-bold text-slate-700">No project applications submitted yet</p>
                            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                              Submit applications for campaigns matching your centre's shift and language capability.
                            </p>
                            <button
                              onClick={() => { changeTab("projects"); setProjectSubTab("marketplace"); }}
                              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#214ECF] hover:bg-blue-50/50 transition"
                            >
                              Browse Campaigns →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── UPCOMING DEADLINES WIDGET ─────────────────────────── */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-base font-black text-slate-900">Upcoming Deadlines</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Facility verification, compliance, & training milestones</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      {upcomingDeadlines.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {upcomingDeadlines.map((item) => (
                            <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex items-start gap-3">
                              <div className="rounded-lg bg-blue-50 p-2 text-[#214ECF]">
                                <item.icon size={16} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{item.ref}</p>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-[11px] text-slate-500">{item.dueDate}</span>
                                  <Status value={item.status} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-400">
                          <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1.5" />
                          <p className="text-xs font-bold text-slate-700">No upcoming deadlines</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">All operational compliance milestones are up to date.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* ── PHASE 2: PROJECTS & MARKETPLACE TAB ───────────────────── */}
              {tab === "projects" && (
                <section>
                  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#214ECF]">Thinkatic BPO Exchange</p>
                      <h2 className="mt-1 text-2xl font-black text-slate-900">Project Marketplace & Campaigns</h2>
                      <p className="mt-1 text-xs text-slate-500">Discover live enterprise campaigns, evaluate SLA specifications, and deploy verified partner capacity.</p>
                    </div>

                    {/* Sub-tab pills */}
                    <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                      <button
                        onClick={() => setProjectSubTab("marketplace")}
                        className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                          projectSubTab === "marketplace" ? "bg-[#214ECF] text-white shadow-xs" : "text-slate-600 hover:text-slate-950"
                        }`}
                      >
                        Marketplace ({marketplaceProjects.length})
                      </button>
                      <button
                        onClick={() => setProjectSubTab("applications")}
                        className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                          projectSubTab === "applications" ? "bg-[#214ECF] text-white shadow-xs" : "text-slate-600 hover:text-slate-950"
                        }`}
                      >
                        My Applications ({myApplications.length})
                      </button>
                      <button
                        onClick={() => setProjectSubTab("active")}
                        className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                          projectSubTab === "active" ? "bg-[#214ECF] text-white shadow-xs" : "text-slate-600 hover:text-slate-950"
                        }`}
                      >
                        Active Campaigns ({activeCampaigns.length})
                      </button>
                    </div>
                  </div>

                  {/* 1. MARKETPLACE SUBTAB */}
                  {projectSubTab === "marketplace" && (
                    <div className="space-y-5">
                      {/* Filter Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 self-center mr-1">Vertical:</span>
                          {["all", "Healthcare", "Energy & Utilities", "Fintech & Banking", "E-commerce", "Telecom"].map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setMarketplaceVerticalFilter(cat)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                marketplaceVerticalFilter === cat
                                  ? "bg-[#214ECF] text-white shadow-xs"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                              }`}
                            >
                              {cat === "all" ? "All Verticals" : cat}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Shift:</span>
                          <select
                            value={marketplaceShiftFilter}
                            onChange={(e) => setMarketplaceShiftFilter(e.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold bg-white text-slate-800 focus:outline-none focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 transition"
                          >
                            <option value="all">All Shifts</option>
                            <option value="US">US Shifts</option>
                            <option value="UK">UK Shifts</option>
                            <option value="Rotational">24/7 Rotational</option>
                          </select>
                        </div>
                      </div>

                      {/* Project Cards Grid */}
                      <div className="grid gap-6 md:grid-cols-2">
                        {filteredMarketplace.map((proj, idx) => {
                          const projectImg = getProjectMarketplaceImage(proj.name, proj.cover_image_url || proj.coverImageUrl);
                          return (
                            <div
                              key={proj.id}
                              style={{ animationDelay: `${idx * 60}ms` }}
                              onClick={() => handleOpenProjectDetails(proj)}
                              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_35px_rgba(33,78,207,0.16)] hover:border-[#214ECF]/40 cursor-pointer"
                            >
                              <div>
                                {/* Card Hero Banner (Strict 16:9 Aspect Ratio) */}
                                <div className="relative w-full aspect-video overflow-hidden bg-slate-900">
                                  {projectImg ? (
                                    <img
                                      src={projectImg}
                                      alt={proj.name}
                                      loading="lazy"
                                      className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                                    />
                                  ) : (
                                    <div className="relative h-full w-full bg-gradient-to-br from-[#0c1a40] via-[#162e6e] to-[#214ECF] flex flex-col items-center justify-center p-6 text-center">
                                      <Building2 size={36} className="text-white/20 mb-2" />
                                      <span className="text-xs font-bold tracking-wider uppercase text-blue-200/80">Enterprise Campaign</span>
                                    </div>
                                  )}

                                  {/* Subtle dark gradient overlay */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent pointer-events-none" />

                                  {/* Floating Category Badge (Top-Left) */}
                                  <div className="absolute top-3.5 left-3.5">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-[#214ECF] shadow-sm backdrop-blur-md">
                                      {proj.vertical}
                                    </span>
                                  </div>

                                  {/* Real Status Pill (Top-Right) */}
                                  <div className="absolute top-3.5 right-3.5">
                                    <div className="rounded-full bg-white/95 px-1 py-0.5 shadow-sm backdrop-blur-md">
                                      <Status value={proj.has_applied ? (proj.application_status || "Applied") : proj.status} />
                                    </div>
                                  </div>

                                  {/* Lightbox Trigger (Bottom-Right) */}
                                  {projectImg && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLightboxImage({ src: projectImg, title: proj.name });
                                      }}
                                      className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-slate-900/75 hover:bg-slate-900 text-white px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition shadow-xs opacity-90 group-hover:opacity-100"
                                      aria-label={`Preview full image for ${proj.name}`}
                                    >
                                      <Maximize2 size={12} />
                                      <span className="hidden sm:inline">Preview</span>
                                    </button>
                                  )}

                                  {/* Process Type Pill (Bottom-Left) */}
                                  <div className="absolute bottom-3 left-3.5 pointer-events-none">
                                    <span className="text-[11px] font-medium text-slate-200/90 tracking-wide drop-shadow-xs">
                                      {proj.process_type || "Dedicated Operations"}
                                    </span>
                                  </div>
                                </div>

                                {/* Card Body */}
                                <div className="p-5 sm:p-6">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-black text-slate-950 group-hover:text-[#214ECF] transition-colors line-clamp-1">
                                      {proj.name}
                                    </h3>
                                    <span className="text-[10px] font-mono text-slate-400">PRJ-{proj.id}</span>
                                  </div>

                                  <p className="mt-2 text-xs leading-5 text-slate-600 line-clamp-2 min-h-[2.5rem]">
                                    {proj.scope}
                                  </p>

                                  {/* 2x2 Information Grid */}
                                  <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl bg-slate-50/80 border border-slate-100 p-3.5 text-xs">
                                    <div>
                                      <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Shift / Geography</span>
                                      <p className="mt-0.5 font-bold text-slate-800 truncate" title={`${proj.shift} (${proj.target_geography})`}>
                                        {proj.shift} ({proj.target_geography})
                                      </p>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Headcount Demand</span>
                                      <p className="mt-0.5 font-bold text-slate-800">
                                        {proj.required_seats} Seats
                                      </p>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Payout Rate</span>
                                      <p className="mt-0.5 font-black text-[#214ECF]">
                                        {proj.payout_rate}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Billing Terms</span>
                                      <p className="mt-0.5 font-bold text-slate-800">
                                        {proj.billing_cycle}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Requirement Tags */}
                                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                                    {proj.requires_us_experience && (
                                      <span className="rounded-md bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                        US Experience Req.
                                      </span>
                                    )}
                                    {proj.requires_uk_experience && (
                                      <span className="rounded-md bg-sky-50 border border-sky-200/60 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                                        UK Experience Req.
                                      </span>
                                    )}
                                    <span className="rounded-md bg-slate-100 border border-slate-200/60 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                      Min {proj.min_experience_years}yr Exp
                                    </span>
                                    {proj.min_centre_capacity > 0 && (
                                      <span className="rounded-md bg-blue-50/70 border border-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#214ECF]">
                                        Min {proj.min_centre_capacity} Seats Floor
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Card Footer / Actions */}
                              <div className="px-5 sm:px-6 pb-5 pt-0">
                                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenProjectDetails(proj);
                                    }}
                                    className="group/link inline-flex items-center gap-1 text-xs font-bold text-[#214ECF] hover:text-[#1b3fa8] transition-colors"
                                  >
                                    <span>View SLA & Specs</span>
                                    <ChevronRight size={14} className="group-hover/link:translate-x-0.5 transition-transform" />
                                  </button>

                                  {proj.has_applied ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const app = myApplications.find((a) => a.project_id === proj.id);
                                        if (app) {
                                          handleOpenApplicationDetails(app);
                                        } else {
                                          handleOpenProjectDetails(proj);
                                        }
                                      }}
                                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition shadow-2xs ${
                                        proj.application_status === "allocated"
                                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 animate-pulse"
                                          : proj.application_status === "accepted"
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                          : proj.application_status === "rejected"
                                          ? "border-rose-200 bg-rose-50 text-rose-700"
                                          : "border-blue-200 bg-blue-50 text-[#214ECF] hover:bg-blue-100"
                                      }`}
                                    >
                                      <FileCheck size={14} />
                                      {proj.application_status === "allocated"
                                        ? "Allocated (Action Required)"
                                        : proj.application_status === "accepted"
                                        ? "Accepted & Active"
                                        : proj.application_status === "rejected"
                                        ? "Application Rejected"
                                        : "Application Submitted"}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenApplyModal(proj);
                                      }}
                                      className="group/btn inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1b3fa8] active:scale-[0.98] transition-all"
                                    >
                                      <span>Apply for Campaign</span>
                                      <span className="transition-transform duration-200 group-hover/btn:translate-x-0.5">→</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {!filteredMarketplace.length && (
                          <div className="col-span-2">
                            <Empty text="No open campaigns match the selected filters." />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 2. MY APPLICATIONS SUBTAB */}
                  {projectSubTab === "applications" && (
                    <div className="space-y-4">
                      {myApplications.map((app) => (
                        <div
                          key={app.id}
                          onClick={() => handleOpenApplicationDetails(app)}
                          className={`group relative rounded-2xl border p-6 shadow-sm transition cursor-pointer hover:shadow-md ${
                            app.status === "allocated"
                              ? "border-2 border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50/70"
                              : "border-slate-200 bg-white hover:border-[#214ECF]/40"
                          }`}
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold text-slate-500">
                                  {app.application_number}
                                </span>
                                <Status value={app.status} />
                              </div>
                              <h3 className="mt-2 text-xl font-black text-slate-900 group-hover:text-[#214ECF] transition-colors">
                                {app.project_name}
                              </h3>
                              <p className="mt-1 text-xs text-slate-500">
                                Submitted on {new Date(app.created_at).toLocaleDateString()} · {app.available_seats} Seats Committed ({app.experienced_agents} experienced agents)
                              </p>

                              {/* More Info Requested Alert */}
                              {app.status === "more_info_required" && (
                                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
                                  <p className="font-black uppercase tracking-wider">Action Required from Operations Team:</p>
                                  <p className="mt-1 font-medium">{app.more_info_requested || app.reviewer_notes}</p>
                                </div>
                              )}

                              {/* Reviewer Notes if Approved or Allocated */}
                              {app.reviewer_notes && (app.status === "approved" || app.status === "allocated") && (
                                <p className="mt-3 text-xs text-emerald-800 bg-emerald-50 rounded-lg p-2.5 font-medium">
                                  Reviewer note: {app.reviewer_notes}
                                </p>
                              )}

                              {/* Rejection Notes */}
                              {app.status === "rejected" && app.rejection_reason && (
                                <p className="mt-3 text-xs text-rose-800 bg-rose-50 rounded-lg p-2.5 font-medium">
                                  Rejection feedback: {app.rejection_reason}
                                </p>
                              )}
                            </div>

                            {/* Actions Column */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-end md:self-auto">
                              {app.status === "allocated" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptAllocation(app.id);
                                  }}
                                  disabled={acceptingAppId === app.id}
                                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-700 transition"
                                >
                                  <CheckCircle2 size={16} />
                                  {acceptingAppId === app.id ? "Activating..." : "Accept Project Allocation"}
                                </button>
                              )}

                              {app.status === "accepted" && (
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
                                  <CheckCircle2 size={14} /> Active & Accepted
                                </span>
                              )}

                              {app.status === "submitted" && (
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                                  <Clock size={14} /> In Queue for Review
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenApplicationDetails(app);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#214ECF] hover:underline"
                              >
                                <span>Details</span>
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {!myApplications.length && (
                        <Empty text="You have not submitted any project applications yet. Browse the Marketplace to apply." />
                      )}
                    </div>
                  )}

                  {/* 3. ACTIVE CAMPAIGNS SUBTAB */}
                  {projectSubTab === "active" && (
                    <div className="space-y-4">
                      {activeCampaigns.length ? (
                        <div className="grid gap-5 md:grid-cols-2">
                          {activeCampaigns.map((item) => {
                            const assigned = item.assigned_seats || item.target_seats || 0;
                            const deployed = item.deployed_agents || 0;
                            const remaining = Math.max(0, assigned - deployed);
                            const progressPercent = typeof item.progress_percent === "number"
                              ? item.progress_percent
                              : (assigned > 0 ? Math.min(100, Math.round((deployed / assigned) * 100)) : 0);

                            return (
                              <div
                                key={item.id}
                                onClick={() => handleOpenCampaignDetails(item)}
                                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-[#214ECF]/50 hover:shadow-md transition-all cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        PRJ-{item.project_id || item.projects?.id || item.id}
                                      </span>
                                      <h3 className="font-black text-lg text-slate-900 group-hover:text-[#214ECF] transition-colors">
                                        {item.campaign_name || item.name || item.projects?.name || "Active Campaign"}
                                      </h3>
                                    </div>
                                    <Status value={item.status || "active"} />
                                  </div>

                                  <p className="mt-2 text-xs text-slate-600 line-clamp-2">
                                    {item.scope || item.target || "Enterprise campaign operations active."}
                                  </p>

                                  {/* Metrics HUD */}
                                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                                    <div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned</span>
                                      <p className="mt-0.5 text-sm font-black text-slate-900">{assigned} Seats</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deployed</span>
                                      <p className="mt-0.5 text-sm font-black text-emerald-600">{deployed} Agents</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remaining</span>
                                      <p className="mt-0.5 text-sm font-black text-amber-600">{remaining} Seats</p>
                                    </div>
                                  </div>

                                  {/* Animated Deployment Progress */}
                                  <div className="mt-4">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                      <span className="text-slate-500">Deployment Progress</span>
                                      <span className="text-[#214ECF] font-mono">{progressPercent}%</span>
                                    </div>
                                    <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-700 ease-out"
                                        style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5 text-xs">
                                  <span className="text-slate-400">
                                    Shift: <strong className="text-slate-700 font-semibold">{item.shift || item.projects?.shift || "Standard"}</strong>
                                  </span>
                                  <span className="inline-flex items-center gap-1 font-bold text-[#214ECF] group-hover:translate-x-0.5 transition-transform">
                                    <span>View Campaign Details</span>
                                    <ChevronRight size={14} />
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <Empty text="No active campaigns are running. Accept an allocated project from My Applications to activate." />
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* ── OTHER PRESERVED TABS ─────────────────────────────────── */}
              {/* Centres tab disabled/commented out from BPO Partner Portal UI per spec */}
              {/* {(tab as string) === "centres" && (
                <section>
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-2xl font-black">Centres</h2>
                    <span className="text-sm text-slate-500">{centres.length} assigned</span>
                  </div>
                  <form onSubmit={createCentre} className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
                    <input required placeholder="Centre name" value={centreForm.name} onChange={(event) => setCentreForm({ ...centreForm, name: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    <input placeholder="Location" value={centreForm.location} onChange={(event) => setCentreForm({ ...centreForm, location: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    <input type="number" min="0" placeholder="Capacity" value={centreForm.capacity} onChange={(event) => setCentreForm({ ...centreForm, capacity: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    <button disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-[#214ECF] px-3 py-2 text-sm font-bold text-white shadow-xs hover:bg-[#1b3fa8]">
                      <Plus size={15} /> Add centre
                    </button>
                  </form>
                  <div className="grid gap-4 md:grid-cols-2">
                    {centres.map((centre) => (
                      <div key={centre.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                        <div className="flex justify-between">
                          <h3 className="font-black">{centre.name}</h3>
                          <Status value={centre.status} />
                        </div>
                        <p className="mt-2 text-sm text-slate-500">{centre.location || "Location not provided"}</p>
                        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">Capacity: {centre.capacity}</p>
                      </div>
                    ))}
                  </div>
                  {!centres.length && <Empty text="No centres assigned yet." />}
                </section>
              )} */}

              {tab === "capacity" && (
                <section>
                  <BpoCapacitySection apiCall={api} />
                </section>
              )}

              {tab === "agents" && (
                <section>
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">Agent Roster & Onboarding</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Add, manage, and onboard your agents. Complete profiles ensure faster verification and project deployment.
                      </p>
                    </div>
                  </div>
                  <BpoAgentManagement
                    agents={bpoAgents}
                    stats={bpoAgentStats}
                    activeProjects={myApplications.filter(
                      (a) => a.status === "accepted" || a.status === "allocated"
                    )}
                    centres={centres}
                    api={api}
                    onRefresh={() => load(true)}
                    onViewCertificate={(cert) => setViewCertificate(cert)}
                  />
                </section>
              )}

              {/* Attendance tab disabled/commented out from BPO Partner Portal UI per spec */}
              {/* {(tab as string) === "attendance" && (
                <section>
                  <BpoAttendanceSection
                    api={api}
                    agents={bpoAgents.length ? bpoAgents : agents}
                    centres={centres}
                  />
                </section>
              )} */}

              {tab === "documents" && (
                <section>
                  <h2 className="mb-5 text-2xl font-black">Partner documents</h2>
                  {documents.length ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {documents.map((document) => (
                        <div key={document.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                          <h3 className="font-black">{document.original_file_name}</h3>
                          <p className="mt-2 text-sm text-slate-500">{document.category} · Shared with this partner</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty text="No documents have been explicitly shared with this partner." />
                  )}
                </section>
              )}

              {tab === "verification" && (
                <section>
                  <BpoCentreVerificationSection onStatusChange={() => void load()} />
                </section>
              )}

              {tab === "agreement" && (
                <section>
                  <PartnerAgreementSection onStatusChange={() => void load()} />
                </section>
              )}

              {tab === "meetings" && (
                <section>
                  <PartnerMeetingsSection
                    api={api}
                    initialMeetingId={targetMeetingId || undefined}
                    onMeetingViewed={(mId) => {
                      const matchingNotif = notifications.find(
                        (n) => n.entity_type === "meeting" && String(n.entity_id) === String(mId) && !n.read_at
                      );
                      if (matchingNotif) {
                        void handleNotificationRead(matchingNotif.id);
                      }
                    }}
                  />
                </section>
              )}

              {tab === "training" && (
                <section>
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">Training & Certification Engine</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Client campaign readiness curriculum, sequential module completion, server-graded assessments, and accredited credentials (THK-CERT-XXXXX).
                      </p>
                    </div>
                  </div>
                  <BpoTrainingSection
                    programs={bpoTrainingPrograms}
                    agents={bpoAgents}
                    certifications={bpoCertifications}
                    api={api}
                    onRefresh={load}
                    viewCertificate={viewCertificate}
                    setViewCertificate={setViewCertificate}
                  />
                </section>
              )}

              {tab === "productivity" && (
                <section>
                  <BpoProductionSection
                    api={api}
                    agents={bpoAgents.length ? bpoAgents : agents}
                    projects={marketplaceProjects.length ? marketplaceProjects : projects}
                  />
                </section>
              )}

              {tab === "quality" && (
                <section>
                  <BpoQualitySection api={api} />
                </section>
              )}

              {tab === "compliance" && (
                <section>
                  <BpoComplianceSection api={api} />
                </section>
              )}

              {tab === "payouts" && (
                <section>
                  <BpoPayoutsSection api={api} />
                </section>
              )}

              {/* Reports tab commented out from BPO Partner Portal UI per spec */}
              {(tab as string) === "reports" && (
                <section>
                  <BpoReportsSection api={api} />
                </section>
              )}

              {tab === "connect-admin" && (
                <section>
                  <BpoConnectWithAdminSection api={api} />
                </section>
              )}

              {tab === "notifications" && (
                <section>
                  <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Notifications</h2>
                        {unreadCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 text-xs font-bold text-[#214ECF]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#214ECF] animate-pulse" />
                            {unreadCount} unread
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            All caught up
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Operational alerts, project milestones, compliance notices, and financial ledger events.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {markAllSuccess && (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 transition-all">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          All notifications marked as read
                        </span>
                      )}
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          disabled={markingAllRead}
                          onClick={() => void handleMarkAllNotificationsRead()}
                          className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-bold text-[#214ECF] shadow-2xs hover:bg-blue-50/60 hover:border-[#214ECF]/40 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {markingAllRead ? (
                            <>
                              <RefreshCw size={13} className="animate-spin text-[#214ECF]" />
                              Marking as read...
                            </>
                          ) : (
                            <>
                              <CheckCheck size={14} />
                              Mark all read
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {notificationActionError && (
                    <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs font-medium text-rose-800">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={15} className="text-rose-600 shrink-0" />
                        <span>{notificationActionError}</span>
                      </div>
                      <button onClick={() => setNotificationActionError("")} className="text-rose-500 hover:text-rose-700 font-bold ml-3 cursor-pointer">
                        Dismiss
                      </button>
                    </div>
                  )}

                  {notifications.length ? (
                    <div className="space-y-3">
                      {notifications.map((notification) => {
                        const isUnread = !notification.read_at;
                        const isBeingRead = readingNotificationIds.has(notification.id);
                        return (
                          <div
                            key={notification.id}
                            onClick={() => {
                              if (notification.entity_type === "meeting" && notification.entity_id) {
                                if (isUnread && !isBeingRead) {
                                  void handleNotificationRead(notification.id);
                                }
                                setTargetMeetingId(notification.entity_id);
                                changeTab("meetings");
                                return;
                              }
                              if (isUnread && !isBeingRead) {
                                void handleNotificationRead(notification.id);
                              }
                            }}
                            className={`group relative rounded-2xl border p-4 sm:p-5 text-left transition-all duration-150 ${
                              isUnread
                                ? "border-blue-200/90 bg-[#F4F8FF] hover:bg-[#EEF5FF] hover:border-[#214ECF]/50 shadow-2xs cursor-pointer"
                                : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 cursor-default"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                  {notification.type ? notification.type.replace(/_/g, " ") : "System"}
                                </span>
                                {isUnread && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-[#214ECF] px-2 py-0.5 text-[9px] font-black text-white tracking-wide shadow-2xs">
                                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                    NEW
                                  </span>
                                )}
                                {notification.entity_type && (
                                  <span className="text-[10px] font-mono text-slate-400">
                                    ref: {notification.entity_type}{notification.entity_id ? ` #${notification.entity_id}` : ""}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="text-xs text-slate-400 font-mono">
                                  {new Date(notification.created_at).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {isUnread ? (
                                  <button
                                    type="button"
                                    disabled={isBeingRead}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isBeingRead) {
                                        void handleNotificationRead(notification.id);
                                      }
                                    }}
                                    className="text-[11px] font-bold text-[#214ECF] hover:underline flex items-center gap-1 cursor-pointer"
                                    title="Mark as read"
                                  >
                                    {isBeingRead ? (
                                      <RefreshCw size={11} className="animate-spin text-[#214ECF]" />
                                    ) : (
                                      <Check size={12} />
                                    )}
                                    <span className="hidden sm:inline">Mark read</span>
                                  </button>
                                ) : (
                                  <span className="text-emerald-600 flex items-center gap-0.5 text-[11px] font-medium" title="Read">
                                    <CheckCircle2 size={12} />
                                    <span className="hidden sm:inline text-slate-400">Read</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <h3 className={`mt-2 text-sm sm:text-base ${isUnread ? "font-black text-slate-900" : "font-semibold text-slate-800"}`}>
                              {notification.title}
                            </h3>

                            <p className={`mt-1.5 text-xs sm:text-sm leading-relaxed ${isUnread ? "text-slate-700" : "text-slate-500"}`}>
                              {notification.body}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Empty text="No partner notifications yet." />
                  )}
                </section>
              )}

              {tab === "tickets" && (
                <section>
                  <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">Partner Support Tickets</h2>
                      <p className="text-xs text-slate-500 mt-1">Direct human coordination with Thinkatic operations desk.</p>
                    </div>
                    <button
                      onClick={() => setTicketModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1b3fa8] transition"
                    >
                      <Plus size={15} /> Create Support Ticket
                    </button>
                  </div>
                  {tickets.length ? (
                    <div className="space-y-3">
                      {tickets.map((ticket) => (
                        <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-mono text-xs font-bold text-[#214ECF]">{ticket.ticket_number}</span>
                              <h3 className="text-sm font-black text-slate-900 mt-0.5">{ticket.subject}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                                {ticket.priority}
                              </span>
                              <Status value={ticket.status} />
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
                            <span>Category: {ticket.category}</span>
                            <span>{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : ""}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
                      <Headphones size={36} className="mx-auto text-[#214ECF] mb-3" />
                      <h3 className="font-bold text-slate-900 text-base">No support tickets</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Connect directly with Thinkatic human operations for campaign onboarding, technical assistance, or payouts support.
                      </p>
                      <button
                        onClick={() => setTicketModalOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1b3fa8] transition"
                      >
                        <Plus size={14} /> Create Support Ticket
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* ── PROFILE TAB ───────────────────────────────────────────── */}
              {tab === "profile" && (
                <section>
                  <BpoPartnerProfileSection api={api} />
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── FLOATING HUMAN SUPPORT BUTTON (Globally disabled per UI requirements) ─────────────────── */}
      {/* <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => changeTab("tickets")}
          className="flex items-center gap-2.5 rounded-full bg-[#214ECF] px-4 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-[#1b3fa8] hover:scale-105 transition-all duration-200"
          title="Connect with Human Support"
          aria-label="Human Support"
        >
          <Headphones size={18} />
          <span className="hidden sm:inline-block tracking-wide">Human Support</span>
        </button>
      </div> */}

      {/* ── PROJECT DETAILS / APPLICATION MODAL ───────────────────────── */}
      {selectedProject && (() => {
        const modalImg = getProjectMarketplaceImage(selectedProject.name, selectedProject.cover_image_url || selectedProject.coverImageUrl);
        const selectedCentreObj = centres.find((c) => String(c.id) === String(applyForm.centre_id));
        const capacityWarning = selectedCentreObj && selectedCentreObj.capacity > 0 && applyForm.available_seats > selectedCentreObj.capacity;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto"
            onClick={() => { setSelectedProject(null); setApplyingModalOpen(false); }}
            role="dialog"
            aria-modal="true"
            aria-label="Project Details Modal"
          >
            <div
              className="my-8 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#214ECF]">
                      {selectedProject.vertical}
                    </span>
                    <span className="font-mono text-xs text-slate-400">PRJ-{selectedProject.id}</span>
                    {projectDetailsLoading && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#214ECF] animate-pulse">
                        <RefreshCw size={11} className="animate-spin" /> Fetching live specs...
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-slate-900">{selectedProject.name}</h2>
                </div>
                <button
                  onClick={() => { setSelectedProject(null); setApplyingModalOpen(false); }}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 transition"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Hero Banner (Strict 16:9 Aspect Ratio) */}
              {modalImg ? (
                <div className="relative mt-4 w-full aspect-video overflow-hidden rounded-2xl bg-slate-900 shadow-inner group">
                  <img
                    src={modalImg}
                    alt={selectedProject.name}
                    className="h-full w-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-[#214ECF] shadow-sm backdrop-blur-md">
                      {selectedProject.process_type || "Dedicated Campaign"} · {selectedProject.shift}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLightboxImage({ src: modalImg, title: selectedProject.name })}
                      className="flex items-center gap-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 text-xs font-medium backdrop-blur-md transition shadow-sm"
                    >
                      <Maximize2 size={13} />
                      <span>Full Image</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative mt-4 h-24 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1a40] via-[#162e6e] to-[#214ECF] p-4 flex flex-col justify-end text-white shadow-inner">
                  <span className="self-start rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white">
                    {selectedProject.vertical}
                  </span>
                  <p className="mt-1 text-xs text-blue-100 font-medium">{selectedProject.target_geography} Market · {selectedProject.shift}</p>
                </div>
              )}

            {!applyingModalOpen ? (
              /* Detail View with All 15 Required Specifications */
              <div className="mt-6 space-y-5">
                {/* Applied Notice Banner */}
                {selectedProject.has_applied && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-[#214ECF] p-2 text-white shrink-0">
                        <FileCheck size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Application on Record</p>
                        <p className="text-[11px] text-slate-600">
                          Status: <strong className="font-bold text-[#214ECF] uppercase">{selectedProject.application_status || "Submitted"}</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const app = myApplications.find((a) => a.project_id === selectedProject.id);
                        setSelectedProject(null);
                        if (app) {
                          handleOpenApplicationDetails(app);
                        } else {
                          setProjectSubTab("applications");
                        }
                      }}
                      className="rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1b3fa8] transition"
                    >
                      View Application Details →
                    </button>
                  </div>
                )}

                {/* Scope & Workflow */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Process Scope & Operational Workflow</h4>
                  <p className="mt-1.5 text-sm text-slate-700 leading-6">{selectedProject.scope}</p>
                </div>

                {/* Client / Project Verification Info (Authorized for BPO) */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-[#214ECF]" />
                      <span className="text-xs font-bold text-slate-900">
                        {selectedProject.client_info?.company_tier || "Enterprise Tier Account"}
                      </span>
                    </div>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      Thinkatic Escrow Protected
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Industry: <strong>{selectedProject.client_info?.industry || selectedProject.vertical}</strong> · Commercial contracts & SLA guarantees are underwritten directly via Thinkatic. Confidential client identity is protected under NDA.
                  </p>
                </div>

                {/* 2x2 Core Commercial Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-xs">
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Headcount Demand</span>
                    <p className="mt-0.5 text-sm font-black text-slate-900">{selectedProject.required_seats} Dedicated Seats</p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Shift & Geography</span>
                    <p className="mt-0.5 text-sm font-black text-slate-900">{selectedProject.shift} ({selectedProject.target_geography})</p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Payout Rate</span>
                    <p className="mt-0.5 text-sm font-black text-[#214ECF]">{selectedProject.payout_rate}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Billing Terms</span>
                    <p className="mt-0.5 text-sm font-black text-slate-900">{selectedProject.billing_cycle}</p>
                  </div>
                </div>

                {/* Target SLA Benchmarks */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Target SLA Benchmarks</h4>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {selectedProject.sla_details && Object.keys(selectedProject.sla_details).length > 0 ? (
                      Object.entries(selectedProject.sla_details).map(([metric, val]) => (
                        <div key={metric} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400">{metric.replace("target_", "").replace("_", " ")}</span>
                          <p className="mt-1 font-black text-[#214ECF] text-base">{String(val)}</p>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400">CSAT Score</span>
                          <p className="mt-1 font-black text-[#214ECF] text-base">≥ 90%</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400">First Call Res</span>
                          <p className="mt-1 font-black text-[#214ECF] text-base">≥ 80%</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400">QA Score</span>
                          <p className="mt-1 font-black text-[#214ECF] text-base">≥ 92%</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Network SLA</span>
                          <p className="mt-1 font-black text-[#214ECF] text-base">99.9%</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Required Skills & Domain Experience */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Required Agent Skills</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["Inbound Voice & Chat", "CRM Systems & Escalations", "English Native / Neutral", "Problem Solving", "QA Adherence", "Compliance Recording"].map((skill) => (
                      <span key={skill} className="rounded-lg bg-blue-50/70 border border-blue-200/60 px-2.5 py-1 text-xs font-bold text-[#214ECF]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Eligibility & Capacity Floor Requirements */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Eligibility & Capacity Floor</h4>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600 list-disc pl-5">
                    <li>Minimum <strong>{selectedProject.min_experience_years} years</strong> operational contact centre track record.</li>
                    <li>Minimum facility capacity floor of <strong>{selectedProject.min_centre_capacity} workstations</strong> required.</li>
                    {selectedProject.requires_us_experience && (
                      <li className="font-bold text-amber-900">Proven track record handling US native English consumer interactions.</li>
                    )}
                    {selectedProject.requires_uk_experience && (
                      <li className="font-bold text-sky-900">Proven track record handling UK consumer and commercial accounts.</li>
                    )}
                    <li>Redundant dual leased line internet with automated failover and UPS backup.</li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5">
                  <button
                    onClick={() => { setSelectedProject(null); }}
                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Close
                  </button>
                  {!selectedProject.has_applied && (
                    <button
                      onClick={() => {
                        setApplyForm({
                          ...applyForm,
                          available_seats: selectedProject.required_seats,
                          us_experience: selectedProject.requires_us_experience,
                          uk_experience: selectedProject.requires_uk_experience,
                        });
                        setApplyModalError("");
                        setApplyingModalOpen(true);
                      }}
                      className="rounded-xl bg-[#214ECF] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1b3fa8] transition"
                    >
                      Apply for Campaign →
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Application Form View with Real-time Capacity Check & Inline Feedback */
              <form onSubmit={handleApplySubmit} className="mt-6 space-y-4">
                {applyModalError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                    <div>
                      <p className="font-bold">Validation Error</p>
                      <p className="mt-0.5">{applyModalError}</p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4 text-xs text-[#214ECF] font-medium">
                  Applying for: <b>{selectedProject.name}</b> · Headcount needed: <b>{selectedProject.required_seats} Seats</b>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Available Seats to Deploy *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={applyForm.available_seats}
                      onChange={(e) => setApplyForm({ ...applyForm, available_seats: Number(e.target.value) })}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#214ECF]"
                    />
                    {capacityWarning && (
                      <p className="mt-1 text-[11px] text-rose-600 font-bold">
                        ⚠️ Committed seats ({applyForm.available_seats}) exceed facility capacity ({selectedCentreObj.capacity} seats).
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Experienced Agents Available *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={applyForm.experienced_agents}
                      onChange={(e) => setApplyForm({ ...applyForm, experienced_agents: Number(e.target.value) })}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#214ECF]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Target Go-Live Date *</label>
                    <input
                      type="date"
                      required
                      value={applyForm.available_start_date}
                      onChange={(e) => setApplyForm({ ...applyForm, available_start_date: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#214ECF]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Select Centre Facility</label>
                    <select
                      value={applyForm.centre_id}
                      onChange={(e) => setApplyForm({ ...applyForm, centre_id: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#214ECF] bg-white"
                    >
                      <option value="">Primary Registered Facility</option>
                      {centres.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.capacity} seats capacity)
                        </option>
                      ))}
                    </select>
                    {selectedCentreObj && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Facility Capacity: <strong>{selectedCentreObj.capacity} workstations</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Confirmations */}
                <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={applyForm.us_experience}
                      onChange={(e) => setApplyForm({ ...applyForm, us_experience: e.target.checked })}
                      className="rounded text-[#214ECF]"
                    />
                    Centre has active experience handling US customer campaigns
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={applyForm.uk_experience}
                      onChange={(e) => setApplyForm({ ...applyForm, uk_experience: e.target.checked })}
                      className="rounded text-[#214ECF]"
                    />
                    Centre has experience handling UK regulatory and dialect standards
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      required
                      checked={applyForm.infrastructure_confirmed}
                      onChange={(e) => setApplyForm({ ...applyForm, infrastructure_confirmed: e.target.checked })}
                      className="mt-0.5 rounded text-[#214ECF]"
                    />
                    <span>
                      I confirm our facility meets all mandatory Thinkatic infrastructure standards (Generator backup, dual leased lines, and ISO/HIPAA compliant call recording). *
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Proposal / Deployment Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe your team's readiness, dialer setup, and quality leadership for this campaign..."
                    value={applyForm.proposal_notes}
                    onChange={(e) => setApplyForm({ ...applyForm, proposal_notes: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={() => { setApplyModalError(""); setApplyingModalOpen(false); }}
                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Back to Specs
                  </button>
                  <button
                    type="submit"
                    disabled={submittingApp}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1b3fa8] disabled:opacity-50 transition"
                  >
                    <Send size={14} />
                    {submittingApp ? "Submitting Application..." : "Submit Formal Application"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        );
      })()}

      {/* ── APPLICATION DETAILS MODAL ─────────────────────────────────── */}
      {selectedApplication && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto"
          onClick={() => setSelectedApplication(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Application Details Modal"
        >
          <div
            className="my-8 w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {selectedApplication.application_number}
                  </span>
                  <Status value={selectedApplication.status} />
                  {applicationDetailsLoading && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#214ECF] animate-pulse">
                      <RefreshCw size={11} className="animate-spin" />
                    </span>
                  )}
                </div>
                <h3 className="mt-1.5 text-xl font-black text-slate-900">{selectedApplication.project_name}</h3>
              </div>
              <button
                onClick={() => setSelectedApplication(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {/* Proposal Summary Grid */}
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Committed Seats</span>
                  <p className="mt-0.5 text-sm font-black text-slate-900">{selectedApplication.available_seats} Seats</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Experienced Agents</span>
                  <p className="mt-0.5 text-sm font-black text-slate-900">{selectedApplication.experienced_agents} Agents</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Submitted Date</span>
                  <p className="mt-0.5 text-sm font-black text-slate-900">
                    {new Date(selectedApplication.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Target Start Date</span>
                  <p className="mt-0.5 text-sm font-black text-slate-900">
                    {selectedApplication.available_start_date || "Immediate"}
                  </p>
                </div>
              </div>

              {/* Status Alert if Allocated */}
              {selectedApplication.status === "allocated" && (
                <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/70 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      <p className="text-xs font-black uppercase tracking-wider">Project Allocation Approved!</p>
                    </div>
                    <span className="rounded-full bg-emerald-200/60 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 uppercase">
                      Action Required
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-emerald-900">
                    Thinkatic operations has allocated {selectedApplication.allocated_seats || selectedApplication.available_seats} seats for this campaign. Click below to accept and transition directly to active deployment.
                  </p>
                  <div className="mt-3.5 flex justify-end">
                    <button
                      onClick={() => handleAcceptAllocation(selectedApplication.id)}
                      disabled={acceptingAppId === selectedApplication.id}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} />
                      {acceptingAppId === selectedApplication.id ? "Activating Campaign..." : "Accept Project Allocation"}
                    </button>
                  </div>
                </div>
              )}

              {/* Reviewer / Decision Notes */}
              {selectedApplication.reviewer_notes && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reviewer Notes</span>
                  <p className="mt-1 text-slate-700 font-medium">{selectedApplication.reviewer_notes}</p>
                </div>
              )}

              {selectedApplication.rejection_reason && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Rejection Decision</span>
                  <p className="mt-1 font-medium">{selectedApplication.rejection_reason}</p>
                </div>
              )}

              {selectedApplication.proposal_notes && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Partner Proposal Notes</h4>
                  <p className="mt-1.5 text-xs text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    {selectedApplication.proposal_notes}
                  </p>
                </div>
              )}

              {/* Audit Timeline */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Application Audit Timeline</h4>
                <div className="mt-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-emerald-100 p-1.5 text-emerald-600 shrink-0">
                      <Check size={12} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Proposal Submitted</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(selectedApplication.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className={`rounded-full p-1.5 shrink-0 ${
                      selectedApplication.status !== "submitted"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-blue-100 text-[#214ECF]"
                    }`}>
                      <Clock size={12} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Compliance & Capacity Evaluation</p>
                      <p className="text-[10px] text-slate-400">
                        {selectedApplication.reviewed_at
                          ? new Date(selectedApplication.reviewed_at).toLocaleString()
                          : selectedApplication.status === "submitted"
                          ? "In queue for Thinkatic operations review"
                          : "Review completed"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className={`rounded-full p-1.5 shrink-0 ${
                      selectedApplication.status === "allocated" || selectedApplication.status === "accepted"
                        ? "bg-emerald-100 text-emerald-600"
                        : selectedApplication.status === "rejected"
                        ? "bg-rose-100 text-rose-600"
                        : "bg-slate-100 text-slate-400"
                    }`}>
                      {selectedApplication.status === "rejected" ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Campaign Allocation Decision</p>
                      <p className="text-[10px] text-slate-400">
                        {selectedApplication.status === "allocated"
                          ? "Approved & allocated to centre"
                          : selectedApplication.status === "accepted"
                          ? "Accepted by BPO partner"
                          : selectedApplication.status === "rejected"
                          ? "Declined by operations"
                          : "Pending allocation"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
                <button
                  onClick={() => setSelectedApplication(null)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CAMPAIGN DETAILS MODAL ────────────────────────────────────── */}
      {selectedCampaign && (() => {
        const assigned = selectedCampaign.assigned_seats || selectedCampaign.target_seats || 0;
        const deployed = selectedCampaign.deployed_agents || 0;
        const remaining = Math.max(0, assigned - deployed);
        const progressPercent = typeof selectedCampaign.progress_percent === "number"
          ? selectedCampaign.progress_percent
          : (assigned > 0 ? Math.min(100, Math.round((deployed / assigned) * 100)) : 0);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto"
            onClick={() => setSelectedCampaign(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Campaign Details Modal"
          >
            <div
              className="my-8 w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">
                      PRJ-{selectedCampaign.project_id || selectedCampaign.projects?.id || selectedCampaign.id}
                    </span>
                    <Status value={selectedCampaign.status || "active"} />
                  </div>
                  <h3 className="mt-1.5 text-xl font-black text-slate-900">
                    {selectedCampaign.campaign_name || selectedCampaign.name || selectedCampaign.projects?.name || "Active Campaign"}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 space-y-5">
                {/* Deployment HUD */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 uppercase tracking-wider text-[11px]">Deployment Progress</span>
                    <span className="font-mono text-sm font-black text-[#214ECF]">{progressPercent}%</span>
                  </div>
                  <div className="mt-2.5 h-3 w-full rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-700 ease-out"
                      style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-white p-2.5 border border-slate-100 shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Assigned Target</span>
                      <p className="mt-0.5 text-sm font-black text-slate-900">{assigned} Seats</p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 border border-slate-100 shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Active Deployed</span>
                      <p className="mt-0.5 text-sm font-black text-emerald-600">{deployed} Agents</p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 border border-slate-100 shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Remaining</span>
                      <p className="mt-0.5 text-sm font-black text-amber-600">{remaining} Seats</p>
                    </div>
                  </div>
                </div>

                {/* Campaign Operational Parameters */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Shift Window</span>
                    <p className="mt-0.5 font-bold text-slate-800">{selectedCampaign.shift || selectedCampaign.projects?.shift || "24/7 Rotational"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Market Geography</span>
                    <p className="mt-0.5 font-bold text-slate-800">{selectedCampaign.target_geography || selectedCampaign.target || "US/UK Markets"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Assigned Date</span>
                    <p className="mt-0.5 font-bold text-slate-800">
                      {selectedCampaign.assigned_at ? new Date(selectedCampaign.assigned_at).toLocaleDateString() : (selectedCampaign.start_date || "Active")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Quality Standard</span>
                    <p className="mt-0.5 font-bold text-emerald-700">92% QA Score Target</p>
                  </div>
                </div>

                {/* Operational Scope */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Campaign Scope</h4>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                    {selectedCampaign.scope || selectedCampaign.target || "Dedicated enterprise delivery operations active."}
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCampaign(null);
                        changeTab("agents");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1b3fa8] transition"
                    >
                      <Users size={14} />
                      Roster Agents →
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCampaign(null);
                        changeTab("tickets");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Headphones size={14} />
                      Support Desk
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectedCampaign(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── CREATE SUPPORT TICKET MODAL ──────────────────────────────── */}
      {ticketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="my-8 w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#214ECF]">
                  Human Operations Support
                </span>
                <h3 className="mt-2 text-xl font-black text-slate-900">New Support Ticket</h3>
              </div>
              <button
                onClick={() => setTicketModalOpen(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Subject</label>
                <input
                  type="text"
                  required
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  placeholder="Brief summary of operational query..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-[#214ECF] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Category</label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#214ECF] focus:outline-none bg-white"
                  >
                    {["Process Issue", "Technical Issue", "Payment Issue", "Project Issue", "Employee Issue", "Training", "General Support"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Priority</label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#214ECF] focus:outline-none bg-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Description</label>
                <textarea
                  required
                  rows={4}
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  placeholder="Detailed description of your support request..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-[#214ECF] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTicketModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTicket}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1b3fa8] transition disabled:opacity-50"
                >
                  {submittingTicket ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── IMAGE LIGHTBOX MODAL ────────────────────────────────────── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image Lightbox"
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 text-white">
              <div className="flex items-center gap-2 min-w-0 pr-4">
                <span className="h-2 w-2 rounded-full bg-[#214ECF] shrink-0" />
                <h3 className="font-bold text-sm truncate">{lightboxImage.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition shrink-0"
                aria-label="Close lightbox"
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black w-full max-h-[75vh] flex items-center justify-center">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.title}
                className="w-full h-auto max-h-[75vh] object-contain select-none"
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">Press ESC or click anywhere outside to close</p>
          </div>
        </div>
      )}

      {/* Locked Module Modal */}
      <LockedModuleModal
        isOpen={lockedModalOpen}
        moduleName={lockedModuleName}
        summary={bpoStatusData?.onboardingSummary}
        onClose={() => setLockedModalOpen(false)}
        onContinueOnboarding={() => {
          setLockedModalOpen(false);
          const summ = bpoStatusData?.onboardingSummary;
          if (summ?.centreVerificationStatus !== "approved" && summ?.centreVerificationStatus !== "submitted") {
            window.location.href = "/partner/apply";
          } else if (summ?.agreementStatus !== "submitted" && summ?.agreementStatus !== "approved") {
            changeTab("agreement");
          } else {
            window.location.href = "/partner/apply";
          }
        }}
      />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
      <p>{text}</p>
    </div>
  );
}
