import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Briefcase,
  Clock,
  PhoneCall,
  TrendingUp,
  GraduationCap,
  FileText,
  Bell,
  LifeBuoy,
  UserCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Plus,
  ShieldCheck,
  MessageCircle,
  Building,
} from "lucide-react";

import { AgentDashboardSection } from "../components/agent/AgentDashboardSection";
import { AgentProjectsSection } from "../components/agent/AgentProjectsSection";
import { AgentAttendanceSection } from "../components/agent/AgentAttendanceSection";
import { AgentWorkLogSection } from "../components/agent/AgentWorkLogSection";
import { AgentCallLogModal } from "../components/agent/AgentCallLogModal";
import { AgentProductivitySection } from "../components/agent/AgentProductivitySection";
import { AgentTrainingSection } from "../components/agent/AgentTrainingSection";
import { AgentDocumentsSection } from "../components/agent/AgentDocumentsSection";
import { AgentNotificationsSection } from "../components/agent/AgentNotificationsSection";
import { AgentConversationSection } from "../components/agent/AgentConversationSection";
// Support section disabled for Agent Portal per strict BPO-centric rule:
// import { AgentSupportSection } from "../components/agent/AgentSupportSection";
import { AgentProfileSection } from "../components/agent/AgentProfileSection";

export default function AgentPortalPage() {
  const [location, setLocation] = useLocation();

  // Navigation state
  const activeTab = useMemo(() => {
    const parts = location.split("/").filter(Boolean);
    if (parts.length > 1 && parts[0] === "agent") {
      return parts[1];
    }
    return "dashboard";
  }, [location]);

  const setTab = (tab: string) => {
    setLocation(tab === "dashboard" ? "/agent" : `/agent/${tab}`);
  };

  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Authentication & agent profile state
  const [agent, setAgent] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Live timer & attendance state
  const [todayShift, setTodayShift] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [attendanceActionLoading, setAttendanceActionLoading] = useState(false);
  const [isRefreshingAttendance, setIsRefreshingAttendance] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const dashboardReqSeq = useRef(0);
  const isLoggingOutRef = useRef(false);

  // Data states for tabs
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [callsData, setCallsData] = useState<any[]>([]);
  const [productivityData, setProductivityData] = useState<any>(null);
  const [trainingData, setTrainingData] = useState<any[]>([]);
  const [documentsData, setDocumentsData] = useState<any[]>([]);
  const [notificationsData, setNotificationsData] = useState<any[]>([]);
  const [ticketsData, setTicketsData] = useState<any[]>([]);

  // Modals state
  const [showCallLogModal, setShowCallLogModal] = useState(false);
  const [callSubmitting, setCallSubmitting] = useState(false);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [showFirstLoginNotice, setShowFirstLoginNotice] = useState(true);
  const [bpoUnreadCount, setBpoUnreadCount] = useState(0);

  const token = localStorage.getItem("agent_token");

  // Greeting calculation based on local time
  const greeting = useMemo(() => {
    const hours = new Date().getHours();
    if (hours < 12) return "Good Morning";
    if (hours < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  // Prevent bfcache from restoring stale authenticated view if token was removed
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && !localStorage.getItem("agent_token")) {
        setLocation("/agent/login");
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [setLocation]);

  // 1. Authenticate & load agent session
  useEffect(() => {
    // If the agent initiated an intentional logout, do not trigger the unauthenticated route guard
    if (isLoggingOutRef.current) return;

    if (!token) {
      setLocation("/agent/login");
      return;
    }

    async function fetchSession() {
      try {
        const res = await fetch("/api/agent/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          localStorage.removeItem("agent_token");
          localStorage.removeItem("agent_profile");
          localStorage.removeItem("user_token");
          localStorage.removeItem("user_profile");
          setLocation("/agent/login");
          return;
        }
        const data = await res.json();
        setAgent(data.agent);
      } catch {
        localStorage.removeItem("agent_token");
        localStorage.removeItem("agent_profile");
        localStorage.removeItem("user_token");
        localStorage.removeItem("user_profile");
        setLocation("/agent/login");
      } finally {
        setAuthLoading(false);
      }
    }

    fetchSession();
  }, [token, setLocation]);

  // Helper to synchronize shift session and stopwatch
  const applyShiftSession = (shift: any) => {
    setTodayShift(shift);
    if (!shift) {
      setElapsedSeconds(0);
      return;
    }

    const state = shift.state || shift.current_state;

    if (state === "checked_out") {
      setElapsedSeconds(0);
    } else if (state === "on_break") {
      // ON BREAK: The working timer MUST be frozen.
      // Net worked seconds computed before break started is authoritative
      if (typeof shift.net_worked_seconds === "number") {
        setElapsedSeconds(shift.net_worked_seconds);
      } else if (typeof shift.total_working_seconds === "number") {
        setElapsedSeconds(shift.total_working_seconds);
      } else if (shift.check_in_time && shift.break_start_time) {
        const checkInMs = new Date(shift.check_in_time).getTime();
        const breakStartMs = new Date(shift.break_start_time).getTime();
        const totalBreakSec =
          typeof shift.total_break_seconds === "number"
            ? shift.total_break_seconds
            : (shift.total_break_minutes || 0) * 60;
        const grossSec = Math.max(0, Math.floor((breakStartMs - checkInMs) / 1000));
        setElapsedSeconds(Math.max(0, grossSec - totalBreakSec));
      }
    } else if (state === "checked_in") {
      // CHECKED IN: Working timer is active.
      if (typeof shift.net_worked_seconds === "number") {
        setElapsedSeconds(shift.net_worked_seconds);
      } else if (shift.check_in_time) {
        const checkInMs = new Date(shift.check_in_time).getTime();
        const totalBreakSec =
          typeof shift.total_break_seconds === "number"
            ? shift.total_break_seconds
            : (shift.total_break_minutes || 0) * 60;
        const grossSec = Math.max(0, Math.floor((Date.now() - checkInMs) / 1000));
        setElapsedSeconds(Math.max(0, grossSec - totalBreakSec));
      }
    }
  };

  // 2. Fetch Dashboard & Live Shift Status
  const refreshDashboard = async () => {
    if (!token) return;
    const reqSeq = ++dashboardReqSeq.current;
    try {
      const res = await fetch("/api/agent/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // If a newer request or action occurred while this was in-flight, discard stale result
        if (reqSeq !== dashboardReqSeq.current) return;
        setDashboardData(data);
        if (data.today_shift) {
          applyShiftSession(data.today_shift);
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (agent) {
      refreshDashboard();
    }
  }, [agent]);

  // 3. Live stopwatch interval based on authoritative server timestamps
  useEffect(() => {
    let interval: any;
    const currentState = todayShift?.state || todayShift?.current_state;

    if (currentState === "checked_in" && todayShift?.check_in_time) {
      const checkInMs = new Date(todayShift.check_in_time).getTime();
      const totalBreakSec =
        typeof todayShift.total_break_seconds === "number"
          ? todayShift.total_break_seconds
          : (todayShift.total_break_minutes || 0) * 60;

      const updateTimer = () => {
        const grossSec = Math.max(0, Math.floor((Date.now() - checkInMs) / 1000));
        const netSec = Math.max(0, grossSec - totalBreakSec);
        setElapsedSeconds(netSec);
      };

      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }

    return () => clearInterval(interval);
  }, [
    todayShift?.state,
    todayShift?.current_state,
    todayShift?.check_in_time,
    todayShift?.total_break_seconds,
    todayShift?.total_break_minutes,
  ]);

  // Format elapsed time as HH:MM:SS
  const formatStopwatch = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // 4. Tab-specific data loaders
  const loadTabContent = () => {
    if (!token || !agent) return;

    if (activeTab === "project") {
      fetch("/api/agent/projects", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setProjectsList(d.projects || []))
        .catch(() => {});
    } else if (activeTab === "attendance") {
      // Fetch authoritative today shift status first
      fetch("/api/agent/attendance/today", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => {
          if (d.attendance) {
            applyShiftSession(d.attendance);
          }
        })
        .catch(() => {});

      fetch("/api/agent/attendance/history", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setAttendanceHistory(d.history || []))
        .catch(() => {});
    } else if (activeTab === "work-log") {
      fetch("/api/agent/calls", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setCallsData(d.calls || []))
        .catch(() => {});
    } else if (activeTab === "productivity") {
      fetch("/api/agent/productivity", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then(setProductivityData)
        .catch(() => {});
    } else if (activeTab === "training") {
      fetch("/api/agent/training", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setTrainingData(d.programs || []))
        .catch(() => {});
    } else if (activeTab === "documents") {
      fetch("/api/agent/documents", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setDocumentsData(d.documents || []))
        .catch(() => {});
    } else if (activeTab === "notifications") {
      fetch("/api/agent/notifications", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setNotificationsData(d.notifications || []))
        .catch(() => {});
    }
  };

  // Poll / fetch BPO conversation unread count
  useEffect(() => {
    if (!token) return;
    const fetchUnread = () => {
      fetch("/api/agent/conversations/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => setBpoUnreadCount(d.unreadCount ?? d.unread_count ?? 0))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [token, activeTab]);

  useEffect(() => {
    loadTabContent();
  }, [activeTab, token, agent]);

  // Manual Attendance Refresh function
  const handleRefreshAttendance = async () => {
    if (!token || isRefreshingAttendance) return;
    dashboardReqSeq.current++;
    setIsRefreshingAttendance(true);
    try {
      const [todayRes, histRes] = await Promise.all([
        fetch("/api/agent/attendance/today", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/agent/attendance/history", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (todayRes.ok) {
        const todayData = await todayRes.json();
        if (todayData.attendance) {
          applyShiftSession(todayData.attendance);
        }
      }
      if (histRes.ok) {
        const histData = await histRes.json();
        setAttendanceHistory(histData.history || []);
      }
      setLastRefreshedAt(new Date());
      // Reconcile dashboard KPIs in the background
      refreshDashboard();
    } catch (err) {
      console.error("Attendance refresh error:", err);
    } finally {
      setIsRefreshingAttendance(false);
    }
  };

  // Attendance actions
  const handleAttendance = async (action: "start-shift" | "start-break" | "end-break" | "end-shift") => {
    dashboardReqSeq.current++;
    setAttendanceActionLoading(true);
    try {
      const res = await fetch(`/api/agent/attendance/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        if (action === "end-shift") {
          // Immediately reset active shift card to checked out state
          setTodayShift({
            state: "checked_out",
            current_state: "checked_out",
            check_in_time: null,
            check_out_time: null,
            total_working_seconds: 0,
            total_working_minutes: 0,
            total_break_seconds: 0,
            total_break_minutes: 0,
            worked_duration_formatted: "00:00:00",
            worked_hours: "00h 00m",
          });
          setElapsedSeconds(0);
        } else if (data.session) {
          applyShiftSession(data.session);
        }

        // Always refresh attendance history so completed shifts immediately appear
        fetch("/api/agent/attendance/history", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((d) => setAttendanceHistory(d.history || []))
          .catch(() => {});

        setLastRefreshedAt(new Date());
        refreshDashboard().catch(() => {});
      } else if (res.status === 409) {
        refreshDashboard().catch(() => {});
      }
    } catch {
    } finally {
      setAttendanceActionLoading(false);
    }
  };

  // Submit manual call/work log
  const handleLogCallSubmit = async (callData: {
    callType: "inbound" | "outbound";
    duration: number;
    customerReference: string;
    outcome: string;
    notes: string;
    nextFollowupDate: string | null;
    projectId: number;
  }) => {
    setCallSubmitting(true);
    try {
      const res = await fetch("/api/agent/calls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(callData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to log call");
      }
      setShowCallLogModal(false);
      refreshDashboard();

      // Refresh call log if on work-log tab
      if (activeTab === "work-log") {
        const cRes = await fetch("/api/agent/calls", { headers: { Authorization: `Bearer ${token}` } });
        const cData = await cRes.json();
        setCallsData(cData.calls || []);
      }
    } finally {
      setCallSubmitting(false);
    }
  };

  // Submit support ticket
  const handleCreateTicketSubmit = async (ticketData: {
    subject: string;
    category: string;
    priority: string;
    description: string;
    projectId?: number;
  }) => {
    setTicketSubmitting(true);
    try {
      const res = await fetch("/api/agent/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(ticketData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create support ticket");
      }
      // Refresh tickets
      const tRes = await fetch("/api/agent/tickets", { headers: { Authorization: `Bearer ${token}` } });
      const tData = await tRes.json();
      setTicketsData(tData.tickets || []);
    } finally {
      setTicketSubmitting(false);
    }
  };

  // Complete training module
  const handleCompleteTrainingModule = async (programId: number, moduleId: number) => {
    const res = await fetch(`/api/agent/training/${programId}/module/${moduleId}/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      // Refresh training list and dashboard
      const tRes = await fetch("/api/agent/training", { headers: { Authorization: `Bearer ${token}` } });
      const tData = await tRes.json();
      setTrainingData(tData.programs || []);
      refreshDashboard();
    }
  };

  // Mark single notification as read
  const handleMarkNotificationRead = async (id: string) => {
    const res = await fetch(`/api/agent/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setNotificationsData((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      refreshDashboard();
    }
  };

  // Mark all notifications as read
  const handleMarkAllNotificationsRead = async () => {
    const res = await fetch("/api/agent/notifications/read-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setNotificationsData((prev) => prev.map((n) => ({ ...n, read: true })));
      refreshDashboard();
    }
  };

  const handleLogout = async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    // 1. Invalidate authenticated session on server
    const currentToken = localStorage.getItem("agent_token");
    if (currentToken) {
      try {
        await fetch("/api/agent/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch {}
    }

    // 2. Clear client-side authentication and session storage
    localStorage.removeItem("agent_token");
    localStorage.removeItem("agent_profile");
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_profile");
    sessionStorage.removeItem("agent_token");
    sessionStorage.removeItem("agent_profile");

    // 3. Clear component states and cached agent data
    setAgent(null);
    setDashboardData(null);
    setProjectsList([]);
    setAttendanceHistory([]);
    setCallsData([]);
    setProductivityData(null);
    setTrainingData([]);
    setDocumentsData([]);
    setNotificationsData([]);
    setTicketsData([]);
    setTodayShift(null);

    // 4. Navigate directly to PUBLIC HOME PAGE (/) using replace navigation
    setLocation("/", { replace: true });
  };

  // Navigation links definition
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "project", label: "My Project", icon: Briefcase },
    { id: "attendance", label: "Attendance", icon: Clock },
    { id: "work-log", label: "Work / Call Log", icon: PhoneCall },
    { id: "productivity", label: "Productivity", icon: TrendingUp },
    { id: "training", label: "Training", icon: GraduationCap },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "bpo-conversation", label: "Conversation with BPO", icon: MessageCircle },
    // Support tab is disabled/commented out for Agent Portal per strict BPO-centric architecture rule:
    // { id: "support", label: "Support", icon: LifeBuoy },
    { id: "profile", label: "My Profile", icon: UserCheck },
  ];

  if (isLoggingOutRef.current) {
    return null;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/Thinkatic.png"
            alt="Thinkatic Logo"
            width={32}
            height={32}
            className="w-8 h-8 max-w-[32px] max-h-[32px] object-contain animate-pulse"
            style={{ width: "32px", height: "32px", maxWidth: "32px", maxHeight: "32px" }}
          />
          <p className="text-xs text-slate-400 font-medium tracking-wider uppercase">Loading Agent Workspace...</p>
        </div>
      </div>
    );
  }

  const unreadNotifsCount = notificationsData.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen flex bg-white text-slate-900 selection:bg-blue-100 selection:text-[#214ECF]">
      {/* ── DESKTOP FIXED SIDEBAR ────────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col border-r border-slate-200/80 bg-white fixed top-0 bottom-0 left-0 z-30 transition-all duration-300 shadow-2xs ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/Thinkatic.png"
              alt="Thinkatic Logo"
              width={28}
              height={28}
              className="w-7 h-7 max-w-[28px] max-h-[28px] object-contain flex-shrink-0"
              style={{ width: "28px", height: "28px", maxWidth: "28px", maxHeight: "28px" }}
            />
            {!collapsed && (
              <span className="font-bold text-sm tracking-tight text-slate-900 truncate">
                Agent Portal
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-[#214ECF] hover:bg-blue-50/80 transition-colors cursor-pointer"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const itemUnread =
              item.id === "bpo-conversation"
                ? bpoUnreadCount
                : item.id === "notifications"
                ? unreadNotifsCount
                : 0;

            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`group relative w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                  collapsed ? "justify-center px-0" : "px-3"
                } ${
                  isActive
                    ? "bg-[#214ECF] text-white shadow-md shadow-blue-600/20 font-semibold"
                    : "text-slate-700 hover:text-[#214ECF] hover:bg-blue-50/70 border-l-4 border-l-transparent hover:border-l-[#214ECF] hover:translate-x-1"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <div className="relative flex-shrink-0">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? "text-white" : "text-[#214ECF] group-hover:text-[#214ECF]"
                    }`}
                  />
                  {collapsed && itemUnread > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
                  )}
                </div>
                {!collapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
                {!collapsed && itemUnread > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-white text-[#214ECF]"
                        : "bg-[#214ECF] text-white animate-pulse"
                    }`}
                  >
                    {itemUnread}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50/60">
          <div
            className={`flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200/80 hover:border-blue-200 hover:bg-blue-50/40 transition-all ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <div
              onClick={() => setTab("profile")}
              className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] font-bold text-xs flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-[#214ECF] hover:text-white transition-colors"
              title="View Profile"
            >
              {agent?.name ? agent.name.charAt(0) : "A"}
            </div>
            {!collapsed && (
              <div
                onClick={() => setTab("profile")}
                className="flex-1 min-w-0 cursor-pointer"
                title="View Profile"
              >
                <div className="text-xs font-bold text-slate-900 truncate hover:text-[#214ECF] transition-colors">
                  {agent?.name || "Guru Agent"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {agent?.agentCode || "THK-AGT-02323"}
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              title="Log Out"
              aria-label="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MOBILE DRAWER ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileDrawerOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 left-0 w-72 bg-white border-r border-slate-200 z-50 flex flex-col md:hidden shadow-xl"
            >
              <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/80">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/Thinkatic.png"
                    alt="Thinkatic Logo"
                    width={28}
                    height={28}
                    className="w-7 h-7 max-w-[28px] max-h-[28px] object-contain flex-shrink-0"
                    style={{ width: "28px", height: "28px", maxWidth: "28px", maxHeight: "28px" }}
                  />
                  <span className="font-bold text-sm text-slate-900">Agent Portal</span>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const itemUnread =
                    item.id === "bpo-conversation"
                      ? bpoUnreadCount
                      : item.id === "notifications"
                      ? unreadNotifsCount
                      : 0;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setTab(item.id);
                        setMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#214ECF] text-white font-semibold shadow-sm"
                          : "text-slate-700 hover:text-[#214ECF] hover:bg-blue-50/70 border-l-4 border-l-transparent hover:border-l-[#214ECF]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-[#214ECF]"}`} />
                        <span>{item.label}</span>
                      </div>
                      {itemUnread > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? "bg-white text-[#214ECF]"
                              : "bg-[#214ECF] text-white animate-pulse"
                          }`}
                        >
                          {itemUnread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/60">
                <div>
                  <div className="text-xs font-bold text-slate-900">{agent?.name || "Guru Agent"}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{agent?.agentCode || "THK-AGT-02323"}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  aria-label="Log Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT AREA (FULL SCREEN ENTERPRISE WORKSPACE) ──────────────── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? "md:pl-20" : "md:pl-64"}`}>
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 md:hidden cursor-pointer"
              aria-label="Open Navigation"
            >
              <Menu className="w-5 h-5 text-[#214ECF]" />
            </button>
            <div>
              <div className="text-xs font-medium text-slate-500">
                {greeting},{" "}
                <span className="font-bold text-slate-900">{agent?.name?.split(" ")[0] || "Guru"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="font-mono text-[11px] font-bold text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                  {agent?.agentCode || "THK-AGT-02323"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="hidden sm:inline-block font-medium text-slate-600">
                    {agent?.department || "Inbound Voice Operations"}
                  </span>
                </span>
                <span className="hidden md:inline-block text-slate-300">•</span>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Building className="w-3 h-3 text-slate-400" />
                  <strong className="text-slate-700">
                    {agent?.bpoPartnerName || agent?.companyName || "Thinkatic Delivery BPO"}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Log Call Action - Centered */}
            <button
              onClick={() => setShowCallLogModal(true)}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-sm shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Log Work / Call</span>
              <span className="sm:hidden">Log Call</span>
            </button>

            {/* BPO Messages Shortcut */}
            <button
              onClick={() => setTab("bpo-conversation")}
              className="relative p-2.5 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 text-slate-600 hover:text-[#214ECF] transition-all cursor-pointer"
              title="Conversation with BPO"
              aria-label="Conversation with BPO"
            >
              <MessageCircle className="w-4 h-4 text-[#214ECF]" />
              {bpoUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-[#214ECF] text-white text-[9px] font-bold rounded-full ring-2 ring-white animate-pulse">
                  {bpoUnreadCount}
                </span>
              )}
            </button>

            {/* Notifications Button */}
            <button
              onClick={() => setTab("notifications")}
              className="relative p-2.5 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 text-slate-600 hover:text-[#214ECF] transition-all cursor-pointer"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-[#214ECF]" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#214ECF] ring-2 ring-white animate-ping" />
              )}
            </button>

            {/* Avatar Profile Shortcut */}
            <button
              onClick={() => setTab("profile")}
              className="w-9 h-9 rounded-xl bg-blue-50 text-[#214ECF] border border-blue-200 hover:border-[#214ECF] font-bold text-xs flex items-center justify-center cursor-pointer transition-colors"
              title="My Profile"
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {agent?.name ? agent.name.charAt(0) : "A"}
            </button>
          </div>
        </header>

        {/* Subpage Content Container (Full Width, No Huge Unused Margins) */}
        <main className="flex-1 p-4 sm:p-8 w-full max-w-[1600px] mx-auto space-y-6">
          {/* Optional First Login Notice Banner */}
          {!agent?.passwordChangedAt && !agent?.password_changed_at && showFirstLoginNotice && (
            <div className="rounded-2xl border border-blue-200 bg-[#EFF4FF] p-4 text-xs text-slate-700 shadow-xs flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#214ECF] text-white shadow-xs">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Account Configured by BPO Administrator</p>
                  <p className="mt-0.5 text-slate-600 leading-relaxed">
                    Your account credentials have been verified. You can update your portal password anytime from{" "}
                    <button
                      type="button"
                      onClick={() => setTab("profile")}
                      className="font-bold text-[#214ECF] underline hover:text-[#1a3fa8] cursor-pointer"
                    >
                      My Profile
                    </button>
                    .
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFirstLoginNotice(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-blue-100/50 transition-colors cursor-pointer"
                title="Dismiss notice"
                aria-label="Dismiss notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && (
            <AgentDashboardSection
              greeting={greeting}
              agent={agent}
              dashboardData={dashboardData}
              todayShift={todayShift}
              elapsedSeconds={elapsedSeconds}
              formatStopwatch={formatStopwatch}
              attendanceActionLoading={attendanceActionLoading}
              handleAttendance={handleAttendance}
              onOpenCallLog={() => setShowCallLogModal(true)}
              onNavigateTab={setTab}
            />
          )}

          {/* TAB 2: MY PROJECT */}
          {activeTab === "project" && (
            <AgentProjectsSection
              projects={projectsList}
              agent={agent}
              onOpenCallLog={() => setShowCallLogModal(true)}
            />
          )}

          {/* TAB 3: ATTENDANCE */}
          {activeTab === "attendance" && (
            <AgentAttendanceSection
              todayShift={todayShift}
              elapsedSeconds={elapsedSeconds}
              formatStopwatch={formatStopwatch}
              attendanceActionLoading={attendanceActionLoading}
              handleAttendance={handleAttendance}
              attendanceHistory={attendanceHistory}
              agent={agent}
              isRefreshingAttendance={isRefreshingAttendance}
              onRefreshAttendance={handleRefreshAttendance}
              lastRefreshedAt={lastRefreshedAt}
            />
          )}

          {/* TAB 4: WORK / CALL LOG */}
          {activeTab === "work-log" && (
            <AgentWorkLogSection
              calls={callsData}
              onOpenCallLog={() => setShowCallLogModal(true)}
              projects={projectsList}
            />
          )}

          {/* TAB 5: PRODUCTIVITY */}
          {activeTab === "productivity" && (
            <AgentProductivitySection
              productivityData={productivityData}
            />
          )}

          {/* TAB 6: TRAINING */}
          {activeTab === "training" && (
            <AgentTrainingSection
              trainingData={trainingData}
              onCompleteModule={handleCompleteTrainingModule}
              token={token!}
            />
          )}

          {/* TAB 7: DOCUMENTS */}
          {activeTab === "documents" && (
            <AgentDocumentsSection
              documents={documentsData}
              token={token!}
            />
          )}

          {/* TAB 8: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <AgentNotificationsSection
              notifications={notificationsData}
              onMarkAsRead={handleMarkNotificationRead}
              onMarkAllAsRead={handleMarkAllNotificationsRead}
              onNavigateTab={setTab}
            />
          )}

          {/* TAB 9: CONVERSATION WITH BPO (NEW SECTION 13) */}
          {activeTab === "bpo-conversation" && (
            <AgentConversationSection
              token={token!}
              agent={agent}
              onNavigateTab={setTab}
            />
          )}

          {/* TAB 10: MY PROFILE */}
          {activeTab === "profile" && (
            <AgentProfileSection
              agent={agent}
              token={token!}
              onPasswordChangeSuccess={() => {
                setShowFirstLoginNotice(false);
              }}
            />
          )}
        </main>
      </div>

      {/* ── GLOBAL MODAL: MANUAL CALL / WORK LOG ────────────────────────────── */}
      <AgentCallLogModal
        isOpen={showCallLogModal}
        onClose={() => setShowCallLogModal(false)}
        onSubmit={handleLogCallSubmit}
        submitting={callSubmitting}
        projects={projectsList}
        defaultProjectId={agent?.assignedProjects?.[0] || 105}
      />
    </div>
  );
}
