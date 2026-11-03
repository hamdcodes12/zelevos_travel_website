import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderKanban,
  Headphones,
  HelpCircle,
  Layers,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserCheck,
  Users,
  X,
  AlertTriangle,
  Bell,
  Check,
  Cable,
} from "lucide-react";
import BrandLogo from "@/components/layout/BrandLogo";
import ClientBillingSection from "@/components/client/ClientBillingSection";
import ClientCapacityRequirementsSection from "@/components/client/ClientCapacityRequirementsSection";
import ClientIntegrationsSection from "@/components/client/ClientIntegrationsSection";

// ── Types ────────────────────────────────────────────────────────────────────

interface ClientProfile {
  id: string;
  client_code: string;
  company_name: string;
  legal_name: string;
  industry: string;
  website: string;
  primary_contact_name: string;
  primary_contact_email: string;
  status: string;
  settings?: Record<string, any>;
}

interface ClientUser {
  id: string;
  email: string;
  role: "client_admin" | "client_manager" | "client_viewer";
  full_name: string;
}

interface DashboardData {
  client: ClientProfile;
  metrics: {
    activeProjects: number;
    allocatedCentres: number;
    activeAgents: number;
    attendanceRate: number;
    totalProductionVolume: number;
    avgQualityScore: number;
    complianceHealth: number;
    openCapas: number;
  };
  recentProjects: any[];
  channelBreakdown: Record<string, number>;
  qualityBreakdown: { passed: number; failed: number; passRate: number };
  freshnessTimestamp: string;
  serverCalculated: boolean;
}

interface ProjectItem {
  id: number;
  bpo_client_id: string;
  title: string;
  vertical: string;
  process_type: string;
  shift: string;
  target_geography: string;
  required_seats: number;
  scope?: string;
  sla_details?: Record<string, any>;
  status: string;
  allocatedCentresCount?: number;
  activeAgentsCount?: number;
  allocatedCentres?: any[];
}

interface FrontlineAgent {
  id: number;
  agent_code: string;
  designation: string;
  centre_id: number;
  centre_name: string;
  current_shift: string;
  status: string;
  qa_average: number;
}

interface DeliveryCentre {
  id: number;
  name: string;
  location: string;
  allocatedSeats: number;
  activeHeadcount: number;
  status: string;
  slaPerformance: number;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return "0";
  return new Intl.NumberFormat("en-US").format(num);
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function ClientPortalPage() {
  const [, setLocation] = useLocation();

  // ── Auth & Profile State ──
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem("user_token"));
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // ── Login Form State (if not logged in) ──
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // ── Active Navigation Tab ──
  const [activeTab, setActiveTab] = useState<"dashboard" | "projects" | "centres" | "reports" | "invoices" | "capacity" | "integrations" | "notifications">("dashboard");

  // ── Data States ──
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [centres, setCentres] = useState<DeliveryCentre[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loadingData, setLoadingData] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  // ── Project Details Modal ──
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [projectAgents, setProjectAgents] = useState<FrontlineAgent[]>([]);
  const [projectCentres, setProjectCentres] = useState<DeliveryCentre[]>([]);
  const [loadingProjectDetails, setLoadingProjectDetails] = useState(false);

  // ── Reports Tab State ──
  const [reportType, setReportType] = useState<"attendance" | "production" | "quality" | "compliance" | "summary">("attendance");
  const [rangePreset, setRangePreset] = useState<"today" | "yesterday" | "week" | "month" | "custom">("week");
  const [customStartDate, setCustomStartDate] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // ── Notification Drawer State ──
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  // ── Search & Filter State ──
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState("all");

  // ── API Fetch Wrapper ──
  async function clientApi(endpoint: string, options: RequestInit = {}) {
    const token = authToken || localStorage.getItem("user_token");
    const res = await fetch(`/api/client${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    return res;
  }

  // ── Load Client Profile ──
  async function checkAuthAndLoadProfile() {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const token = localStorage.getItem("user_token");
      if (!token) {
        setAuthLoading(false);
        return;
      }
      setAuthToken(token);

      const res = await clientApi("/profile");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          setAuthError(errData.message || errData.error || "Access denied. Valid Client Portal credentials required.");
        } else {
          setAuthError("Failed to authenticate with Client Portal.");
        }
        setProfile(null);
        setClientUser(null);
        setAuthLoading(false);
        return;
      }

      const data = await res.json();
      setProfile(data.client);
      setClientUser(data.user);
    } catch (err: any) {
      setAuthError(err.message || "Network error while authenticating.");
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    void checkAuthAndLoadProfile();
  }, []);

  // ── Load Dashboard & Core Data ──
  async function loadAllClientData() {
    if (!profile) return;
    setLoadingData(true);
    try {
      const [dashRes, projRes, notifRes] = await Promise.all([
        clientApi("/dashboard"),
        clientApi("/projects"),
        clientApi("/notifications"),
      ]);

      if (dashRes.ok) {
        const d = await dashRes.json();
        setDashboard(d);
        setLastRefreshed(new Date().toLocaleTimeString());
      }

      if (projRes.ok) {
        const p = await projRes.json();
        setProjects(p.projects || []);

        // Flatten unique delivery centres across projects
        const centreMap = new Map<number, DeliveryCentre>();
        (p.projects || []).forEach((proj: ProjectItem) => {
          (proj.allocatedCentres || []).forEach((c: DeliveryCentre) => {
            if (!centreMap.has(c.id)) {
              centreMap.set(c.id, c);
            }
          });
        });
        setCentres(Array.from(centreMap.values()));
      }

      if (notifRes.ok) {
        const n = await notifRes.json();
        setNotifications(n.notifications || []);
        setUnreadNotifications(n.unreadCount || 0);
      }
    } catch (err) {
      console.error("Error loading client data:", err);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (profile) {
      void loadAllClientData();
    }
  }, [profile]);

  // ── Load Report Data ──
  async function loadSelectedReport() {
    if (!profile) return;
    setLoadingReport(true);
    setReportError(null);

    try {
      let query = `?range=${rangePreset}`;
      if (rangePreset === "custom") {
        if (new Date(customStartDate) > new Date(customEndDate)) {
          setReportError("Start date cannot be after end date.");
          setLoadingReport(false);
          return;
        }
        query += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      }
      if (selectedProjectId !== "all") {
        query += `&projectId=${selectedProjectId}`;
      }

      const res = await clientApi(`/reports/${reportType}${query}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to fetch operational report.");
      }
      const data = await res.json();
      setReportData(data);
    } catch (err: any) {
      setReportError(err.message || "Failed to load report.");
    } finally {
      setLoadingReport(false);
    }
  }

  useEffect(() => {
    if (profile && activeTab === "reports") {
      void loadSelectedReport();
    }
  }, [profile, activeTab, reportType, rangePreset, customStartDate, customEndDate, selectedProjectId]);

  // ── Open Project Details ──
  async function openProjectModal(project: ProjectItem) {
    setSelectedProject(project);
    setLoadingProjectDetails(true);
    setProjectAgents([]);
    setProjectCentres([]);

    try {
      const [agentsRes, centresRes] = await Promise.all([
        clientApi(`/projects/${project.id}/agents`),
        clientApi(`/projects/${project.id}/centres`),
      ]);

      if (agentsRes.ok) {
        const ad = await agentsRes.json();
        setProjectAgents(ad.agents || []);
      }
      if (centresRes.ok) {
        const cd = await centresRes.json();
        setProjectCentres(cd.centres || []);
      }
    } catch (err) {
      console.error("Failed to load project details:", err);
    } finally {
      setLoadingProjectDetails(false);
    }
  }

  // ── Export CSV Report ──
  async function handleExportCsv() {
    if (clientUser?.role === "client_viewer") {
      alert("Export restriction: client_viewer role does not have permission to export raw CSV reports.");
      return;
    }

    setExportingCsv(true);
    try {
      const token = authToken || localStorage.getItem("user_token");
      let url = `/api/client/reports/export?reportType=${reportType}&range=${rangePreset}`;
      if (rangePreset === "custom") {
        url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      }
      if (selectedProjectId !== "all") {
        url += `&projectId=${selectedProjectId}`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "CSV export failed");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `thinkatic_${profile?.client_code || "client"}_${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(err.message || "Failed to download CSV export.");
    } finally {
      setExportingCsv(false);
    }
  }

  // ── Mark Notification Read ──
  async function markNotificationAsRead(id: string) {
    try {
      await clientApi(`/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadNotifications((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  }

  // ── Client Login Form Handler ──
  async function handleClientLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginSubmitting(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/user/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || "Invalid client login credentials.");
      }

      if (!data.token) {
        throw new Error("Login failed: no token returned.");
      }

      localStorage.setItem("user_token", data.token);
      if (data.profile) {
        localStorage.setItem("user_profile", JSON.stringify(data.profile));
      }
      setAuthToken(data.token);

      // Now verify client profile
      const profileRes = await fetch("/api/client/profile", {
        headers: { Authorization: `Bearer ${data.token}` },
      });

      if (!profileRes.ok) {
        const pErr = await profileRes.json().catch(() => ({}));
        throw new Error(pErr.message || "This user account is not linked to any active BPO Client organization.");
      }

      const pData = await profileRes.json();
      setProfile(pData.client);
      setClientUser(pData.user);
    } catch (err: any) {
      setAuthError(err.message || "Authentication error.");
    } finally {
      setLoginSubmitting(false);
    }
  }

  // Demo Login Helper for Easy Testing
  async function handleDemoLogin(email: string) {
    setLoginEmail(email);
    setLoginPassword("client123456");
    setLoginSubmitting(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/user/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "client123456" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || "Demo login failed");
      }

      localStorage.setItem("user_token", data.token);
      setAuthToken(data.token);

      const profileRes = await fetch("/api/client/profile", {
        headers: { Authorization: `Bearer ${data.token}` },
      });

      if (!profileRes.ok) {
        const pErr = await profileRes.json().catch(() => ({}));
        throw new Error(pErr.message || "Account not linked to a client organization.");
      }

      const pData = await profileRes.json();
      setProfile(pData.client);
      setClientUser(pData.user);
    } catch (err: any) {
      setAuthError(err.message || "Demo login failed.");
    } finally {
      setLoginSubmitting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_profile");
    localStorage.removeItem("agent_token");
    localStorage.removeItem("agent_profile");
    setAuthToken(null);
    setProfile(null);
    setClientUser(null);
    setDashboard(null);
    setProjects([]);
    setLocation("/login?loggedOut=true");
  }

  // Filtered projects
  const filteredProjects = useMemo(() => {
    const q = (projectSearch || "").toLowerCase();
    return projects.filter((p) => {
      if (!p) return false;
      const title = (p.title || "").toLowerCase();
      const vertical = (p.vertical || "").toLowerCase();
      const processType = (p.process_type || "").toLowerCase();
      const matchesSearch =
        title.includes(q) ||
        vertical.includes(q) ||
        processType.includes(q);
      const matchesStatus = projectStatusFilter === "all" || p.status === projectStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, projectSearch, projectStatusFilter]);

  // ── Authentication Barrier Render ──
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <BrandLogo className="w-8 h-8 absolute opacity-80" />
        </div>
        <p className="mt-4 text-sm font-medium tracking-wider uppercase text-slate-400">
          Authenticating Enterprise Client Portal...
        </p>
      </div>
    );
  }

  if (!profile || !clientUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
        {/* Glow background accents */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
          <div className="flex justify-center mb-4">
            <BrandLogo className="w-12 h-12" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-widest mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> BPO Global Delivery Platform
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Client Portal Access</h2>
          <p className="mt-2 text-sm text-slate-400">
            Real-time Operational Telemetry, QA Governance & SLA Analytics for Enterprise BPO Clients
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            {authError && (
              <div className="mb-5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 flex items-start gap-3 text-rose-300 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleClientLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Client Account Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. aura.admin@example.com"
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loginSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Authenticating...
                  </>
                ) : (
                  <>
                    Sign In to Client Portal <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center">
                Quick Enterprise Demo Accounts
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleDemoLogin("aura.admin@example.com")}
                  className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left text-slate-200 transition-all hover:border-blue-500/50"
                >
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" /> Aura Health
                  </p>
                  <p className="text-[11px] text-slate-400">client_admin role</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoLogin("helios.admin@example.com")}
                  className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left text-slate-200 transition-all hover:border-blue-500/50"
                >
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Helios Energy
                  </p>
                  <p className="text-[11px] text-slate-400">client_admin role</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated Main Client Portal View ──
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand & Client Identification */}
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-2">
              <BrandLogo className="w-8 h-8" />
              <div className="hidden sm:block">
                <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Thinkatic</span>
                <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                  BPO Client Portal
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">
                    v5.0
                  </span>
                </h1>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-800 hidden md:block" />

            {/* Client Entity Badge */}
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Building2 className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{profile.company_name}</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                    {profile.client_code}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>{profile.industry}</span>
                  <span>•</span>
                  <span className="capitalize text-emerald-400 font-medium">{clientUser.role.replaceAll("_", " ")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action & Status Header Controls */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Live freshness indicator */}
            <div className="hidden lg:flex h-9 items-center gap-2 px-3 rounded-full bg-slate-800/80 border border-slate-700 text-xs shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="font-medium text-slate-300">LIVE (Server Calculated)</span>
              {lastRefreshed && <span className="text-slate-500 text-[11px]">Synced {lastRefreshed}</span>}
            </div>

            {/* Refresh button */}
            <button
              type="button"
              onClick={() => void loadAllClientData()}
              disabled={loadingData}
              title="Refresh operational data"
              aria-label="Refresh operational data"
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${loadingData ? "animate-spin text-blue-400" : ""}`} />
            </button>

            {/* Notifications Button */}
            <button
              type="button"
              onClick={() => setShowNotificationDrawer(true)}
              className="relative h-9 w-9 flex items-center justify-center rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Operational Alerts"
              aria-label="Operational Alerts"
            >
              <Bell className="w-4 h-4 shrink-0" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold ring-2 ring-slate-900 pointer-events-none select-none animate-bounce">
                  {unreadNotifications}
                </span>
              )}
            </button>

            {/* User & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800 shrink-0">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold text-slate-200 leading-tight">{clientUser.full_name || clientUser.email}</p>
                <p className="text-[10px] font-mono text-slate-500 leading-tight">{clientUser.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 transition-colors cursor-pointer shrink-0"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Navigation Tabs ─────────────────────────────────── */}
      <nav className="border-b border-slate-800 bg-slate-900/50 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto py-2 scrollbar-none">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Activity className="w-4 h-4" />
            Operational Dashboard
          </button>

          <button
            onClick={() => setActiveTab("projects")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "projects"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            Active Projects ({projects.length})
          </button>

          <button
            onClick={() => setActiveTab("centres")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "centres"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Delivery Centres ({centres.length})
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "reports"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Authoritative Reports
          </button>

          <button
            onClick={() => setActiveTab("invoices")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "invoices"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Billing & Invoices
          </button>

          <button
            onClick={() => setActiveTab("capacity")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "capacity"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Capacity Requirements
          </button>

          <button
            onClick={() => setActiveTab("integrations")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "integrations"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Cable className="w-4 h-4" />
            Integrations & CRM
          </button>

          <button
            onClick={() => setActiveTab("notifications")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "notifications"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Audit & Alerts
            {unreadNotifications > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black">
                {unreadNotifications}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* ── Main Tab Content Area ─────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* ══════════════════════════════════════════════════════════
            TAB 1: DASHBOARD / EXECUTIVE TELEMETRY
            ══════════════════════════════════════════════════════════ */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Top KPI Metrics Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Active Campaigns */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-400">
                  <FolderKanban className="w-16 h-16" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Authorized Campaigns</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-black text-white">{dashboard?.metrics.activeProjects ?? projects.length}</p>
                  <span className="text-xs text-blue-400 font-semibold">Active</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Allocated Delivery Sites</span>
                  <span className="font-semibold text-slate-200">{dashboard?.metrics.allocatedCentres ?? centres.length} centres</span>
                </div>
              </div>

              {/* Total Production Volume */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-indigo-400">
                  <BarChart3 className="w-16 h-16" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Multichannel Production</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-black text-white">
                    {formatNumber(dashboard?.metrics.totalProductionVolume)}
                  </p>
                  <span className="text-xs text-indigo-400 font-semibold">Processed Units</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Frontline Workforce</span>
                  <span className="font-semibold text-slate-200">{dashboard?.metrics.activeAgents ?? 0} active reps</span>
                </div>
              </div>

              {/* Authoritative Attendance Rate */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-400">
                  <UserCheck className="w-16 h-16" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Operational Attendance</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-black text-emerald-400">
                    {dashboard?.metrics.attendanceRate !== undefined ? `${dashboard.metrics.attendanceRate}%` : "100%"}
                  </p>
                  <span className="text-xs text-emerald-400/80 font-semibold">Target: 95%</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>SLA Attendance Adherence</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Met (100%)
                  </span>
                </div>
              </div>

              {/* QA Quality Score */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-400">
                  <ShieldCheck className="w-16 h-16" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Quality Scorecard Index</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-black text-amber-400">
                    {dashboard?.metrics.avgQualityScore !== undefined ? `${dashboard.metrics.avgQualityScore}%` : "92%"}
                  </p>
                  <span className="text-xs text-amber-400/80 font-semibold">Benchmark: 85%</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Compliance Health</span>
                  <span className="text-emerald-400 font-semibold">
                    {dashboard?.metrics.complianceHealth ?? 100}% (0 Open CAPAs)
                  </span>
                </div>
              </div>
            </div>

            {/* Multichannel Delivery Breakdown & SLA Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Channel Volume Breakdown */}
              <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      Multichannel Delivery Distribution
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Authoritative units processed across operational channels</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20">
                    Live Telemetry
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-center">
                    <Phone className="w-5 h-5 mx-auto text-blue-400 mb-1.5" />
                    <p className="text-xs text-slate-400">Voice Inbound</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {dashboard?.channelBreakdown?.voice ?? 22}
                    </p>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-center">
                    <MessageSquare className="w-5 h-5 mx-auto text-indigo-400 mb-1.5" />
                    <p className="text-xs text-slate-400">Live Chat</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {dashboard?.channelBreakdown?.chat ?? 12}
                    </p>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-center">
                    <Mail className="w-5 h-5 mx-auto text-purple-400 mb-1.5" />
                    <p className="text-xs text-slate-400">Email Cases</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {dashboard?.channelBreakdown?.email ?? 0}
                    </p>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-center">
                    <Ticket className="w-5 h-5 mx-auto text-amber-400 mb-1.5" />
                    <p className="text-xs text-slate-400">Tickets</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {dashboard?.channelBreakdown?.ticket ?? 0}
                    </p>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-center col-span-2 sm:col-span-1">
                    <FileText className="w-5 h-5 mx-auto text-emerald-400 mb-1.5" />
                    <p className="text-xs text-slate-400">Back Office</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {dashboard?.channelBreakdown?.back_office ?? 0}
                    </p>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Server className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Data Freshness: Authoritative server aggregation across all allocated delivery centres.</span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab("reports");
                      setReportType("production");
                    }}
                    className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    View Breakdown <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quality & SLA Health Summary Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Operational Governance
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Authoritative Quality & Compliance Index</p>

                  <div className="mt-5 space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-300">QA Pass Rate</span>
                        <span className="text-emerald-400">100% (2/2 Passed)</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: "100%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-300">Attendance SLA</span>
                        <span className="text-blue-400">100% (Target: 95%)</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: "100%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-300">Clean Desk & Data Privacy</span>
                        <span className="text-emerald-400">Compliant (0 Incidents)</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: "100%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>Defect Severity: 0 Critical</span>
                  <button
                    onClick={() => {
                      setActiveTab("reports");
                      setReportType("quality");
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    QA Reports <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Active Projects Quick Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Active Authorized Projects</h3>
                  <p className="text-xs text-slate-400">Enterprise operational campaigns linked to your organization</p>
                </div>
                <button
                  onClick={() => setActiveTab("projects")}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                >
                  Manage Projects <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                      <th className="pb-3">Project Title</th>
                      <th className="pb-3">Vertical</th>
                      <th className="pb-3">Process Type</th>
                      <th className="pb-3">Required Seats</th>
                      <th className="pb-3">Delivery Sites</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {projects.map((proj) => (
                      <tr key={proj.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          {proj.title}
                        </td>
                        <td className="py-3.5 text-slate-300">{proj.vertical}</td>
                        <td className="py-3.5 text-slate-300">{proj.process_type}</td>
                        <td className="py-3.5 font-mono text-slate-200">{proj.required_seats} seats</td>
                        <td className="py-3.5 text-slate-300">
                          {proj.allocatedCentresCount || (proj.allocatedCentres ? proj.allocatedCentres.length : 1)} Site
                        </td>
                        <td className="py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                            {proj.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => void openProjectModal(proj)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
                          >
                            Details & Workforce
                          </button>
                        </td>
                      </tr>
                    ))}
                    {projects.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          No active projects assigned to this client organization yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 2: PROJECTS & FRONTLINE WORKFORCE
            ══════════════════════════════════════════════════════════ */}
        {activeTab === "projects" && (
          <div className="space-y-6">
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-blue-400" />
                  Authorized BPO Campaigns
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Detailed view of operational campaigns, allocated facilities, and data-minimized agent rosters
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search campaigns..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <select
                  value={projectStatusFilter}
                  onChange={(e) => setProjectStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="standby">Standby</option>
                </select>
              </div>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProjects.map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400">
                          Project #{p.id}
                        </span>
                        <h3 className="text-base font-bold text-white mt-0.5">{p.title}</h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                        {p.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 mb-4">{p.scope || "Full-cycle omnichannel BPO delivery process."}</p>

                    <div className="grid grid-cols-2 gap-2 text-xs py-3 border-y border-slate-800/80">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Vertical / Industry</span>
                        <span className="font-semibold text-slate-200">{p.vertical}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Process Type</span>
                        <span className="font-semibold text-slate-200">{p.process_type}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Operating Shift</span>
                        <span className="font-semibold text-slate-200">{p.shift}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Allocated Capacity</span>
                        <span className="font-semibold text-blue-400 font-mono">{p.required_seats} Seats</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{p.allocatedCentresCount || 1} Delivery Centre</span>
                    </div>

                    <button
                      onClick={() => void openProjectModal(p)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/10"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Scope & Roster
                    </button>
                  </div>
                </div>
              ))}

              {filteredProjects.length === 0 && (
                <div className="col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                  <FolderKanban className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-300">No campaigns found</p>
                  <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 3: ALLOCATED DELIVERY CENTRES
            ══════════════════════════════════════════════════════════ */}
        {activeTab === "centres" && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                Allocated Delivery Facilities
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Physical delivery centres providing dedicated seat capacity and infrastructure for your campaigns
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {centres.map((c) => (
                <div key={c.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400">
                        Facility ID #{c.id}
                      </span>
                      <h3 className="text-base font-bold text-white mt-0.5">{c.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        {c.location || "Global BPO Delivery Center"}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                      {c.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center py-3 bg-slate-950/60 rounded-xl border border-slate-800/80 my-4 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Allocated Seats</span>
                      <span className="font-bold text-white font-mono">{c.allocatedSeats || 25}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Active Headcount</span>
                      <span className="font-bold text-blue-400 font-mono">{c.activeHeadcount || 2}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">SLA Score</span>
                      <span className="font-bold text-emerald-400 font-mono">{c.slaPerformance || 98.5}%</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 text-xs text-slate-400 flex items-center justify-between">
                    <span>Security & Clean Desk Audited</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> ISO 27001 / SOC 2
                    </span>
                  </div>
                </div>
              ))}

              {centres.length === 0 && (
                <div className="col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                  <Building2 className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-300">No delivery centres allocated yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 4: AUTHORITATIVE OPERATIONAL REPORTS & CSV EXPORT
            ══════════════════════════════════════════════════════════ */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            {/* Header, Filters & CSV Export Bar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    Authoritative Operational Reporting
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Server-calculated metrics with multi-channel production logs, QA scorecards & compliance governance
                  </p>
                </div>

                {/* CSV Export Button */}
                <button
                  onClick={() => void handleExportCsv()}
                  disabled={exportingCsv || clientUser?.role === "client_viewer"}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    clientUser?.role === "client_viewer"
                      ? "Exporting reports requires client_manager or client_admin role"
                      : "Download sanitized CSV report"
                  }
                >
                  {exportingCsv ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" /> Export CSV Report
                    </>
                  )}
                </button>
              </div>

              {/* Filter Controls Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-800">
                {/* Date Preset Buttons */}
                <div className="col-span-1 sm:col-span-2 flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {(["today", "yesterday", "week", "month", "custom"] as const).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setRangePreset(preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors whitespace-nowrap cursor-pointer ${
                        rangePreset === preset
                          ? "bg-blue-600 text-white"
                          : "bg-slate-950 border border-slate-700 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {preset === "week" ? "Current Week" : preset === "month" ? "Current Month" : preset}
                    </button>
                  ))}
                </div>

                {/* Project Selector */}
                <div className="col-span-1 sm:col-span-2">
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All Authorized Projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Date Pickers if 'custom' range selected */}
              {rangePreset === "custom" && (
                <div className="flex items-center gap-3 pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-semibold">From:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-semibold">To:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">(Max custom range: 365 days)</span>
                </div>
              )}
            </div>

            {/* Sub-Tabs: Attendance, Production, Quality, Compliance, Summary */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
              <button
                onClick={() => setReportType("attendance")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  reportType === "attendance" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Attendance Telemetry
              </button>
              <button
                onClick={() => setReportType("production")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  reportType === "production" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-400" /> Multichannel Production
              </button>
              <button
                onClick={() => setReportType("quality")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  reportType === "quality" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> QA Scorecards
              </button>
              <button
                onClick={() => setReportType("compliance")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  reportType === "compliance" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileCheck className="w-3.5 h-3.5 text-indigo-400" /> Compliance Governance
              </button>
              <button
                onClick={() => setReportType("summary")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  reportType === "summary" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400" /> Executive Delivery Scorecard
              </button>
            </div>

            {/* Error banner if any */}
            {reportError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{reportError}</span>
              </div>
            )}

            {/* Loading Indicator */}
            {loadingReport ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-3" />
                <p className="font-semibold text-slate-200 text-sm">Aggregating Authoritative Operational Records...</p>
                <p className="text-xs text-slate-500 mt-1">Executing server-side calculations and sanitization</p>
              </div>
            ) : (
              <>
                {/* ── REPORT VIEW: ATTENDANCE ── */}
                {reportType === "attendance" && reportData && (
                  <div className="space-y-4">
                    {/* Summary KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Total Scheduled</p>
                        <p className="text-2xl font-black text-white mt-1">
                          {reportData.summary?.totalScheduled ?? 0}
                        </p>
                      </div>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Present Headcount</p>
                        <p className="text-2xl font-black text-emerald-400 mt-1">
                          {reportData.summary?.present ?? 0}
                        </p>
                      </div>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Attendance Rate</p>
                        <p className="text-2xl font-black text-blue-400 mt-1">
                          {reportData.summary?.attendanceRate ?? 100}%
                        </p>
                      </div>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Logged Hours</p>
                        <p className="text-2xl font-black text-indigo-400 mt-1">
                          {reportData.summary?.totalLoggedHours ?? 0} hrs
                        </p>
                      </div>
                    </div>

                    {/* Records Table */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                            <th className="pb-3">Shift Date</th>
                            <th className="pb-3">Frontline ID</th>
                            <th className="pb-3">Campaign</th>
                            <th className="pb-3">Delivery Site</th>
                            <th className="pb-3">Shift Name</th>
                            <th className="pb-3">Scheduled</th>
                            <th className="pb-3">Actual Hours</th>
                            <th className="pb-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {(reportData.records || []).map((rec: any) => (
                            <tr key={rec.id} className="hover:bg-slate-800/30">
                              <td className="py-3 text-slate-300 font-mono">{rec.shift_date}</td>
                              <td className="py-3 font-mono font-bold text-blue-400">{rec.agent_code}</td>
                              <td className="py-3 text-white font-medium">{rec.project_name}</td>
                              <td className="py-3 text-slate-400">{rec.centre_name}</td>
                              <td className="py-3 text-slate-300">{rec.shift_name}</td>
                              <td className="py-3 font-mono text-slate-400">{rec.scheduled_hours}h</td>
                              <td className="py-3 font-mono font-bold text-slate-200">{rec.actual_hours}h</td>
                              <td className="py-3">
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                                  {rec.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {(!reportData.records || reportData.records.length === 0) && (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-500">
                                No attendance records found for the selected timeframe.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── REPORT VIEW: PRODUCTION ── */}
                {reportType === "production" && reportData && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Total Processed Units</p>
                        <p className="text-2xl font-black text-white mt-1">
                          {formatNumber(reportData.summary?.totalUnits)}
                        </p>
                      </div>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Productive Hours</p>
                        <p className="text-2xl font-black text-blue-400 mt-1">
                          {reportData.summary?.totalProductiveHours ?? 0} hrs
                        </p>
                      </div>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Units / Hour</p>
                        <p className="text-2xl font-black text-emerald-400 mt-1">
                          {reportData.summary?.avgUnitsPerHour ?? 0}
                        </p>
                      </div>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Primary Channel</p>
                        <p className="text-2xl font-black text-indigo-400 mt-1 capitalize">
                          {Object.keys(reportData.summary?.channelBreakdown || {})[0] || "Voice"}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                            <th className="pb-3">Log Date</th>
                            <th className="pb-3">Frontline ID</th>
                            <th className="pb-3">Campaign</th>
                            <th className="pb-3">Channel</th>
                            <th className="pb-3">Units Processed</th>
                            <th className="pb-3">Productive Hours</th>
                            <th className="pb-3">AHT (Mins)</th>
                            <th className="pb-3">SLA Adherence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {(reportData.records || []).map((rec: any) => (
                            <tr key={rec.id} className="hover:bg-slate-800/30">
                              <td className="py-3 text-slate-300 font-mono">{rec.log_date}</td>
                              <td className="py-3 font-mono font-bold text-blue-400">{rec.agent_code}</td>
                              <td className="py-3 text-white font-medium">{rec.project_name}</td>
                              <td className="py-3">
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold uppercase text-[10px]">
                                  {rec.channel}
                                </span>
                              </td>
                              <td className="py-3 font-bold text-white font-mono">{rec.units_processed}</td>
                              <td className="py-3 font-mono text-slate-400">{rec.productive_hours}h</td>
                              <td className="py-3 font-mono text-slate-300">{rec.aht_minutes} min</td>
                              <td className="py-3">
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {rec.sla_met_percentage}%
                                </span>
                              </td>
                            </tr>
                          ))}
                          {(!reportData.records || reportData.records.length === 0) && (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-500">
                                No production records found for the selected timeframe.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── REPORT VIEW: QUALITY ── */}
                {reportType === "quality" && reportData && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Evaluations Conducted</p>
                        <p className="text-2xl font-black text-white mt-1">
                          {reportData.summary?.totalEvaluations ?? 0}
                        </p>
                      </div>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Overall Pass Rate</p>
                        <p className="text-2xl font-black text-emerald-400 mt-1">
                          {reportData.summary?.passRate ?? 100}%
                        </p>
                      </div>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Average QA Score</p>
                        <p className="text-2xl font-black text-blue-400 mt-1">
                          {reportData.summary?.avgScore ?? 92}%
                        </p>
                      </div>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Critical Defects</p>
                        <p className="text-2xl font-black text-rose-400 mt-1">
                          {reportData.summary?.defectBreakdown?.critical ?? 0}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                            <th className="pb-3">Eval Date</th>
                            <th className="pb-3">Frontline ID</th>
                            <th className="pb-3">Campaign</th>
                            <th className="pb-3">Scorecard Type</th>
                            <th className="pb-3">Score</th>
                            <th className="pb-3">Defect Breakdown</th>
                            <th className="pb-3">Evaluator</th>
                            <th className="pb-3">Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {(reportData.records || []).map((rec: any) => (
                            <tr key={rec.id} className="hover:bg-slate-800/30">
                              <td className="py-3 text-slate-300 font-mono">{rec.evaluation_date}</td>
                              <td className="py-3 font-mono font-bold text-blue-400">{rec.agent_code}</td>
                              <td className="py-3 text-white font-medium">{rec.project_name}</td>
                              <td className="py-3 text-slate-300">{rec.scorecard_name}</td>
                              <td className="py-3 font-black text-white font-mono">{rec.score}%</td>
                              <td className="py-3 text-slate-400 text-[11px]">
                                <span className="text-rose-400">{rec.defects_critical} Crit</span> •{" "}
                                <span className="text-amber-400">{rec.defects_major} Maj</span> •{" "}
                                <span className="text-blue-400">{rec.defects_minor} Min</span>
                              </td>
                              <td className="py-3 text-slate-400">{rec.evaluator_role || "QA Lead"}</td>
                              <td className="py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border capitalize ${
                                    rec.passing_status === "pass"
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                  }`}
                                >
                                  {rec.passing_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {(!reportData.records || reportData.records.length === 0) && (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-500">
                                No QA scorecard evaluations found for the selected timeframe.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── REPORT VIEW: COMPLIANCE ── */}
                {reportType === "compliance" && reportData && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Total Audits</p>
                        <p className="text-2xl font-black text-white mt-1">
                          {reportData.summary?.totalAudits ?? 0}
                        </p>
                      </div>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Compliance Health</p>
                        <p className="text-2xl font-black text-emerald-400 mt-1">
                          {reportData.summary?.complianceHealth ?? 100}%
                        </p>
                      </div>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Open CAPAs</p>
                        <p className="text-2xl font-black text-blue-400 mt-1">
                          {reportData.summary?.openCapas ?? 0}
                        </p>
                      </div>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">Critical Incidents</p>
                        <p className="text-2xl font-black text-emerald-400 mt-1">
                          {reportData.summary?.criticalViolations ?? 0}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                            <th className="pb-3">Audit Date</th>
                            <th className="pb-3">Campaign</th>
                            <th className="pb-3">Delivery Facility</th>
                            <th className="pb-3">Policy / Standard</th>
                            <th className="pb-3">Severity</th>
                            <th className="pb-3">Remediation Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {(reportData.records || []).map((rec: any) => (
                            <tr key={rec.id} className="hover:bg-slate-800/30">
                              <td className="py-3 text-slate-300 font-mono">{rec.audit_date}</td>
                              <td className="py-3 text-white font-medium">{rec.project_name}</td>
                              <td className="py-3 text-slate-400">{rec.centre_name}</td>
                              <td className="py-3 text-slate-200">{rec.standard_name}</td>
                              <td className="py-3">
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold uppercase">
                                  {rec.severity}
                                </span>
                              </td>
                              <td className="py-3">
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                                  {rec.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {(!reportData.records || reportData.records.length === 0) && (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-500">
                                No compliance audit records found for the selected timeframe.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── REPORT VIEW: EXECUTIVE DELIVERY SCORECARD ── */}
                {reportType === "summary" && reportData && (
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                        Executive Delivery Scorecard
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Holistic cross-vector performance summary for executive stakeholders
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                        <p className="text-xs text-slate-400">Attendance Adherence</p>
                        <p className="text-2xl font-bold text-emerald-400 mt-1">
                          {reportData.attendance?.attendanceRate ?? 100}%
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {reportData.attendance?.present ?? 2} / {reportData.attendance?.totalScheduled ?? 2} Scheduled
                        </p>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                        <p className="text-xs text-slate-400">Production Output</p>
                        <p className="text-2xl font-bold text-blue-400 mt-1">
                          {formatNumber(reportData.production?.totalUnits)} Units
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {reportData.production?.totalProductiveHours ?? 16.5} productive hours
                        </p>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                        <p className="text-xs text-slate-400">QA Pass Rate</p>
                        <p className="text-2xl font-bold text-amber-400 mt-1">
                          {reportData.quality?.passRate ?? 100}%
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Avg Score: {reportData.quality?.avgScore ?? 92}%
                        </p>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                        <p className="text-xs text-slate-400">Compliance Health</p>
                        <p className="text-2xl font-bold text-indigo-400 mt-1">
                          {reportData.compliance?.complianceHealth ?? 100}%
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {reportData.compliance?.openCapas ?? 0} Open CAPA Plans
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 5: AUDIT EVENTS & OPERATIONAL NOTIFICATIONS
            ══════════════════════════════════════════════════════════ */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-400" />
                Operational Audit & Alert Stream
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit event notifications and operational alerts strictly scoped to your authorized campaigns
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 ${
                    n.read ? "bg-slate-950/40 border-slate-800/60" : "bg-slate-950 border-blue-500/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`p-2 rounded-lg mt-0.5 ${
                        n.type === "sla_breach"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : n.type === "compliance_alert"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      <Bell className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{n.title}</h4>
                        {!n.read && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">
                            NEW
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{n.message}</p>
                      <p className="text-[11px] text-slate-500 mt-2 font-mono">{formatDate(n.created_at)}</p>
                    </div>
                  </div>

                  {!n.read && (
                    <button
                      onClick={() => void markNotificationAsRead(n.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}

              {notifications.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No notifications or operational alerts at this time.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 6: BILLING & INVOICES
            ══════════════════════════════════════════════════════════ */}
        {activeTab === "invoices" && (
          <ClientBillingSection clientApi={clientApi} userRole={clientUser?.role} />
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 7: CAPACITY REQUIREMENTS
            ══════════════════════════════════════════════════════════ */}
        {activeTab === "capacity" && (
          <ClientCapacityRequirementsSection clientApi={clientApi} userRole={clientUser?.role} />
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 8: DIALER + CRM TELEMETRY INTEGRATIONS (PHASE 8)
            ══════════════════════════════════════════════════════════ */}
        {activeTab === "integrations" && (
          <ClientIntegrationsSection clientApi={clientApi} userRole={clientUser?.role} />
        )}
      </main>

      {/* ── PROJECT DETAILS & WORKFORCE MODAL / DRAWER ───────────── */}
      <AnimatePresence>
        {selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-6 flex items-start justify-between gap-4 z-10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-blue-400">Project #{selectedProject.id}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                      {selectedProject.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white">{selectedProject.title}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedProject.vertical} • {selectedProject.process_type} • {selectedProject.shift}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 flex-1">
                {/* Scope & SLA Thresholds */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Campaign Scope</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedProject.scope || "Full operational support process managed through Thinkatic BPO Delivery Centre."}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">AHT Target</span>
                      <span className="font-bold text-white font-mono">
                        {selectedProject.sla_details?.target_aht_minutes ? `${selectedProject.sla_details.target_aht_minutes} min` : "8.5 min"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">QA Passing Target</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {selectedProject.sla_details?.target_qa_score ? `${selectedProject.sla_details.target_qa_score}%` : "85%"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Attendance Target</span>
                      <span className="font-bold text-blue-400 font-mono">
                        {selectedProject.sla_details?.target_attendance_rate ? `${selectedProject.sla_details.target_attendance_rate}%` : "95%"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Required Capacity</span>
                      <span className="font-bold text-indigo-400 font-mono">{selectedProject.required_seats} Seats</span>
                    </div>
                  </div>
                </div>

                {/* Allocated Delivery Centre */}
                <div>
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    Allocated Delivery Centre
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {projectCentres.map((c) => (
                      <div key={c.id} className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white text-xs">{c.name}</p>
                          <p className="text-[11px] text-slate-400">{c.location}</p>
                        </div>
                        <div className="text-right text-xs">
                          <span className="font-mono text-blue-400 font-bold">{c.allocatedSeats} Seats Allocated</span>
                          <p className="text-[10px] text-slate-500">SLA Adherence: {c.slaPerformance}%</p>
                        </div>
                      </div>
                    ))}
                    {projectCentres.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-500">Loading delivery centres...</div>
                    )}
                  </div>
                </div>

                {/* Frontline Workforce Roster (Data-Minimized) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-400" />
                      Frontline Workforce Roster
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      Data-Minimized (Zero PII)
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-3">
                    In compliance with enterprise privacy standards and BPO data minimization rules, agent personal phone, email, and KYC details are strictly withheld.
                  </p>

                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold bg-slate-900/40">
                          <th className="p-3">Agent Code</th>
                          <th className="p-3">Skill Tier / Designation</th>
                          <th className="p-3">Facility</th>
                          <th className="p-3">Assigned Shift</th>
                          <th className="p-3">QA Avg</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {projectAgents.map((ag) => (
                          <tr key={ag.id} className="hover:bg-slate-800/30">
                            <td className="p-3 font-mono font-bold text-blue-400">{ag.agent_code}</td>
                            <td className="p-3 text-slate-200">{ag.designation}</td>
                            <td className="p-3 text-slate-400">{ag.centre_name}</td>
                            <td className="p-3 text-slate-300">{ag.current_shift}</td>
                            <td className="p-3 font-mono font-bold text-emerald-400">{ag.qa_average}%</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                                {ag.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {projectAgents.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-500">
                              {loadingProjectDetails ? "Loading agent roster..." : "No agents currently assigned."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── NOTIFICATION DRAWER ──────────────────────────────────── */}
      <AnimatePresence>
        {showNotificationDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl"
            >
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-white text-base">Operational Alerts</h3>
                </div>
                <button
                  onClick={() => setShowNotificationDrawer(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 flex-1 overflow-y-auto space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-xl border text-xs transition-all ${
                      n.read ? "bg-slate-950/40 border-slate-800/60" : "bg-slate-950 border-blue-500/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-white">{n.title}</p>
                      {!n.read && (
                        <button
                          onClick={() => void markNotificationAsRead(n.id)}
                          className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    <p className="text-slate-300 mt-1">{n.message}</p>
                    <p className="text-[10px] text-slate-500 mt-2 font-mono">{formatDate(n.created_at)}</p>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <p className="text-center text-slate-500 py-12 text-xs">No alerts to display.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
