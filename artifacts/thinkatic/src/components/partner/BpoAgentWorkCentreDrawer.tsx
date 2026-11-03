import { useState, useEffect, useRef } from "react";
import {
  X,
  Briefcase,
  PhoneCall,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MessageSquare,
  FileText,
  GraduationCap,
  FolderKanban,
  TrendingUp,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Eye,
  Download,
  Send,
  Building2,
  ShieldCheck,
  Check,
  ChevronRight,
  ExternalLink,
  ChevronLeft,
  ChevronDown,
} from "lucide-react";
import type { AgentDetail } from "./BpoAgentManagement";

interface BpoAgentWorkCentreDrawerProps {
  agent: AgentDetail | null;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
  onOpenProfile?: (agent: AgentDetail) => void;
}

export default function BpoAgentWorkCentreDrawer({
  agent,
  isOpen,
  onClose,
  initialTab = "overview",
  onOpenProfile,
}: BpoAgentWorkCentreDrawerProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "calls" | "attendance" | "productivity" | "projects" | "training" | "documents" | "conversation"
  >("overview");

  // Summary State
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);

  // Calls State
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [callsList, setCallsList] = useState<any[]>([]);
  const [callsTotal, setCallsTotal] = useState(0);
  const [callsPage, setCallsPage] = useState(1);
  const [callsLimit] = useState(15);
  const [callsTotalPages, setCallsTotalPages] = useState(1);
  const [callSearch, setCallSearch] = useState("");
  const [callDirection, setCallDirection] = useState("all");
  const [callOutcome, setCallOutcome] = useState("all");
  const [callDate, setCallDate] = useState("");

  // Call Detail Drawer
  const [selectedCall, setSelectedCall] = useState<any | null>(null);

  // New Work / Call Modal
  const [newCallModalOpen, setNewCallModalOpen] = useState(false);
  const [submittingNewCall, setSubmittingNewCall] = useState(false);
  const [newCallError, setNewCallError] = useState("");
  const [newCallSuccess, setNewCallSuccess] = useState("");
  const [newCallForm, setNewCallForm] = useState({
    customerReference: "",
    callType: "inbound",
    durationMinutes: 3,
    durationSeconds: 35,
    outcome: "Resolved",
    workStatus: "Completed",
    notes: "",
    nextFollowupDate: "",
    projectId: 105,
  });

  // Attendance State
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceData, setAttendanceData] = useState<{
    today_session: any;
    history: any[];
  }>({ today_session: null, history: [] });

  // Productivity State
  const [loadingProductivity, setLoadingProductivity] = useState(false);
  const [productivityData, setProductivityData] = useState<any>(null);

  // Projects State
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsList, setProjectsList] = useState<any[]>([]);

  // Training State
  const [loadingTraining, setLoadingTraining] = useState(false);
  const [trainingData, setTrainingData] = useState<{
    modules: any[];
    live_sessions: any[];
  }>({ modules: [], live_sessions: [] });

  // Documents State
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docsList, setDocsList] = useState<any[]>([]);

  // Conversation State
  const [loadingConv, setLoadingConv] = useState(false);
  const [conversation, setConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync initial tab when drawer opens
  useEffect(() => {
    if (isOpen) {
      if (
        initialTab &&
        ["overview", "calls", "attendance", "productivity", "projects", "training", "documents", "conversation"].includes(
          initialTab
        )
      ) {
        setActiveTab(initialTab as any);
      } else {
        setActiveTab("overview");
      }
    }
  }, [isOpen, initialTab]);

  // Auth token helper
  const getHeaders = () => {
    const token = localStorage.getItem("user_token") || localStorage.getItem("token") || "";
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Fetch summary
  const fetchSummary = async () => {
    if (!agent) return;
    setLoadingSummary(true);
    try {
      const res = await fetch(`/api/bpo/agents/${agent.id}/work-summary`, {
        headers: getHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setSummaryData(json);
      }
    } catch (err) {
      console.error("[WorkCentre] Error fetching summary", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Fetch Calls
  const fetchCalls = async (page = 1) => {
    if (!agent) return;
    setLoadingCalls(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(callsLimit),
        search: callSearch,
        direction: callDirection,
        outcome: callOutcome,
        date: callDate,
      });
      const res = await fetch(`/api/bpo/agents/${agent.id}/calls?${query.toString()}`, {
        headers: getHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setCallsList(json.calls || []);
        setCallsTotal(json.total || 0);
        setCallsPage(json.page || 1);
        setCallsTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error("[WorkCentre] Error fetching calls", err);
    } finally {
      setLoadingCalls(false);
    }
  };

  // Fetch Attendance
  const fetchAttendance = async () => {
    if (!agent) return;
    setLoadingAttendance(true);
    try {
      const res = await fetch(`/api/bpo/agents/${agent.id}/attendance-history`, {
        headers: getHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setAttendanceData({
          today_session: json.today_session || null,
          history: json.history || [],
        });
      }
    } catch (err) {
      console.error("[WorkCentre] Error fetching attendance", err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  // Fetch Productivity
  const fetchProductivity = async () => {
    if (!agent) return;
    setLoadingProductivity(true);
    try {
      const res = await fetch(`/api/bpo/agents/${agent.id}/productivity-stats`, {
        headers: getHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setProductivityData(json.stats || null);
      }
    } catch (err) {
      console.error("[WorkCentre] Error fetching productivity", err);
    } finally {
      setLoadingProductivity(false);
    }
  };

  // Fetch Projects
  const fetchProjects = async () => {
    if (!agent) return;
    setLoadingProjects(true);
    try {
      const res = await fetch(`/api/bpo/agents/${agent.id}/projects-work`, {
        headers: getHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setProjectsList(json.projects || []);
      }
    } catch (err) {
      console.error("[WorkCentre] Error fetching projects", err);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Fetch Training
  const fetchTraining = async () => {
    if (!agent) return;
    setLoadingTraining(true);
    try {
      const res = await fetch(`/api/bpo/agents/${agent.id}/training-status`, {
        headers: getHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setTrainingData({
          modules: json.modules || [],
          live_sessions: json.live_sessions || [],
        });
      }
    } catch (err) {
      console.error("[WorkCentre] Error fetching training", err);
    } finally {
      setLoadingTraining(false);
    }
  };

  // Fetch Documents
  const fetchDocs = async () => {
    if (!agent) return;
    setLoadingDocs(true);
    try {
      const res = await fetch(`/api/bpo/agents/${agent.id}/documents-list`, {
        headers: getHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setDocsList(json.documents || []);
      }
    } catch (err) {
      console.error("[WorkCentre] Error fetching documents", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Fetch Conversation
  const fetchConversation = async () => {
    if (!agent) return;
    setLoadingConv(true);
    try {
      const res = await fetch(`/api/bpo/agents/${agent.id}/conversations`, {
        headers: getHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        const convs = json.conversations || [];
        if (convs.length > 0) {
          const mainConv = convs[0];
          setConversation(mainConv);
          // fetch messages
          const msgRes = await fetch(`/api/bpo/conversations/${mainConv.id}/messages`, {
            headers: getHeaders(),
            credentials: "include",
          });
          if (msgRes.ok) {
            const msgJson = await msgRes.json();
            setMessages(msgJson.messages || []);
          }
        }
      }
    } catch (err) {
      console.error("[WorkCentre] Error fetching conversation", err);
    } finally {
      setLoadingConv(false);
    }
  };

  // Trigger data fetch on tab switch or open
  useEffect(() => {
    if (!isOpen || !agent) return;
    fetchSummary();

    if (activeTab === "overview") {
      fetchSummary();
    } else if (activeTab === "calls") {
      fetchCalls(1);
    } else if (activeTab === "attendance") {
      fetchAttendance();
    } else if (activeTab === "productivity") {
      fetchProductivity();
    } else if (activeTab === "projects") {
      fetchProjects();
    } else if (activeTab === "training") {
      fetchTraining();
    } else if (activeTab === "documents") {
      fetchDocs();
    } else if (activeTab === "conversation") {
      fetchConversation();
    }
  }, [isOpen, agent, activeTab]);

  // Real-time polling for conversation tab every 3 seconds with deduplication
  useEffect(() => {
    if (!isOpen || !conversation || activeTab !== "conversation") return;
    const interval = setInterval(async () => {
      try {
        const msgRes = await fetch(`/api/bpo/conversations/${conversation.id}/messages`, {
          headers: getHeaders(),
          credentials: "include",
        });
        if (msgRes.ok) {
          const msgJson = await msgRes.json();
          if (Array.isArray(msgJson.messages)) {
            setMessages((prev) => {
              const map = new Map();
              for (const m of prev) map.set(m.id, m);
              for (const m of msgJson.messages) map.set(m.id, m);
              return Array.from(map.values()).sort(
                (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          }
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen, conversation, activeTab]);

  // Scroll to bottom of messages
  useEffect(() => {
    if (activeTab === "conversation") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  // Submit BPO message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text || !conversation || sendingMessage) return;
    setSendingMessage(true);
    setSendError("");
    try {
      const res = await fetch(`/api/bpo/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.message) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === json.message.id);
            if (exists) return prev;
            return [...prev, json.message];
          });
        }
        setMessageText("");
      } else {
        const errJson = await res.json().catch(() => ({}));
        setSendError(errJson.error || "Message could not be sent. Please retry.");
      }
    } catch (err) {
      console.error("[WorkCentre] Error sending message", err);
      setSendError("Message could not be sent. Please retry.");
    } finally {
      setSendingMessage(false);
    }
  };

  // Submit New Work / Call
  const handleCreateCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;
    setSubmittingNewCall(true);
    setNewCallError("");
    setNewCallSuccess("");

    const totalDurationSec =
      (Number(newCallForm.durationMinutes) || 0) * 60 + (Number(newCallForm.durationSeconds) || 0);

    try {
      const res = await fetch(`/api/bpo/agents/${agent.id}/calls`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          customerReference: newCallForm.customerReference || `CUST-${Date.now().toString().slice(-4)}`,
          callType: newCallForm.callType,
          duration: totalDurationSec,
          outcome: newCallForm.outcome,
          workStatus: newCallForm.workStatus,
          notes: newCallForm.notes,
          nextFollowupDate: newCallForm.nextFollowupDate || null,
          projectId: newCallForm.projectId,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to create work record");
      }

      setNewCallSuccess("Work/Call record logged and assigned successfully!");
      setTimeout(() => {
        setNewCallModalOpen(false);
        setNewCallSuccess("");
        fetchCalls(1);
        fetchSummary();
      }, 1000);
    } catch (err: any) {
      setNewCallError(err.message || "Error submitting call");
    } finally {
      setSubmittingNewCall(false);
    }
  };

  // Export Calls to CSV
  const handleExportCSV = () => {
    if (!callsList.length) return;
    const headers = ["Call ID", "Date", "Direction", "Customer Ref", "Duration", "Outcome", "Status", "Notes"];
    const rows = callsList.map((c) => [
      c.call_code,
      c.start_time ? new Date(c.start_time).toLocaleString() : "",
      c.call_direction,
      `"${c.customer_reference || ""}"`,
      c.duration_formatted,
      c.outcome,
      c.work_status,
      `"${(c.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `agent_${agent?.id}_work_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || !agent) return null;

  const agentName = agent.name || "Agent";
  const agentCode = agent.agent_code || `THK-AGT-${String(agent.id).padStart(5, "0")}`;
  const empId = agent.employee_id || `EMP-${agent.id}`;
  const dept = agent.department || "Customer Operations";
  const designation = agent.designation || "Operations Specialist";
  const shift = agent.shift_preference || "General Day Shift";
  const centreName = summaryData?.agent?.bpo_centre || "Thinkatic Global Delivery Centre – NY-01";
  const currentProject = summaryData?.agent?.current_project || "North American Telehealth Patient Support";
  const accountStatus = (agent.account_status || agent.status || "ACTIVE").toUpperCase();

  const today = summaryData?.today || {
    calls_count: 0,
    work_completed: 0,
    worked_seconds: 0,
    worked_time_formatted: "00h 00m",
    attendance_status: "Not Checked In",
    productivity_score: 0,
    performance: "No Activity",
    target_calls: 40,
    target_progress_pct: 0,
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300">
      {/* Drawer Container */}
      <div className="flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl animate-in slide-in-from-right duration-300">
        {/* ── HEADER ────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: Agent Avatar & Identity */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#214ECF] to-[#123088] font-mono text-xl font-black text-white shadow-md shadow-blue-500/20">
                  {agentName.slice(0, 2).toUpperCase()}
                </div>
                <span
                  className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${
                    today.attendance_status === "Present"
                      ? "bg-emerald-500 ring-2 ring-emerald-200"
                      : today.attendance_status === "On Break"
                      ? "bg-amber-500 ring-2 ring-amber-200"
                      : "bg-slate-400"
                  }`}
                  title={`Status: ${today.attendance_status}`}
                />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-slate-900">{agentName}</h2>
                  <span className="font-mono text-xs font-bold text-[#214ECF] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                    {agentCode}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                    {empId}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      accountStatus === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {accountStatus}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                  <span className="font-semibold text-slate-800">{designation}</span>
                  <span className="text-slate-300">·</span>
                  <span>{dept}</span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Building2 size={12} /> {centreName}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                    <FolderKanban size={12} className="text-[#214ECF]" /> Project: <b>{currentProject}</b>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} className="text-slate-400" /> Shift: <b>{shift}</b>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Quick Action Buttons & Close */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("conversation")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                className="h-10 rounded-xl bg-blue-50 px-3.5 text-xs font-bold text-[#214ECF] hover:bg-blue-100 transition cursor-pointer border border-blue-200"
                title="Message Agent"
              >
                <MessageSquare size={14} className="stroke-[2.5]" />
                Message Agent
              </button>

              {onOpenProfile && (
                <button
                  type="button"
                  onClick={() => onOpenProfile(agent)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                  title="View Full Profile"
                >
                  <Eye size={14} />
                  Profile
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  fetchSummary();
                  if (activeTab === "calls") fetchCalls(callsPage);
                  if (activeTab === "attendance") fetchAttendance();
                  if (activeTab === "productivity") fetchProductivity();
                  if (activeTab === "projects") fetchProjects();
                  if (activeTab === "training") fetchTraining();
                  if (activeTab === "documents") fetchDocs();
                  if (activeTab === "conversation") fetchConversation();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition cursor-pointer"
                title="Refresh All Data"
              >
                <RefreshCw size={15} />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                title="Close Work Centre"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── 8 TABS NAVIGATION ──────────────────────────── */}
          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 pt-3">
            {[
              { id: "overview", label: "Overview", icon: TrendingUp },
              { id: "calls", label: "Work / Calls", icon: PhoneCall, badge: callsTotal || today.calls_count },
              { id: "attendance", label: "Attendance", icon: Clock },
              { id: "productivity", label: "Productivity", icon: TrendingUp },
              { id: "projects", label: "Projects", icon: FolderKanban },
              { id: "training", label: "Training", icon: GraduationCap },
              { id: "documents", label: "Documents", icon: FileText },
              { id: "conversation", label: "Conversation", icon: MessageSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                  className={`h-9 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? "bg-[#214ECF] text-white shadow-xs shadow-blue-500/20"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        isActive ? "bg-white/20 text-white" : "bg-blue-100 text-[#214ECF]"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SCROLLABLE BODY ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Operational KPI Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Today's Calls</span>
                    <PhoneCall size={16} className="text-[#214ECF]" />
                  </div>
                  <p className="mt-2 text-2xl font-black text-slate-900">{today.calls_count}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Assigned Daily Target: 40</p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Work Completed</span>
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  </div>
                  <p className="mt-2 text-2xl font-black text-slate-900">{today.work_completed}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                    {today.calls_count > 0
                      ? `${Math.round((today.work_completed / today.calls_count) * 100)}% resolution rate`
                      : "Zero calls logged today"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Worked Time</span>
                    <Clock size={16} className="text-indigo-600" />
                  </div>
                  <p className="mt-2 text-2xl font-black text-slate-900">{today.worked_time_formatted}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Net active logged shift</p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Attendance</span>
                    <ShieldCheck size={16} className="text-blue-600" />
                  </div>
                  <p className="mt-2 text-xl font-black text-slate-900">{today.attendance_status}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Shift: {shift}</p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Productivity</span>
                    <TrendingUp size={16} className="text-purple-600" />
                  </div>
                  <p className="mt-2 text-2xl font-black text-slate-900">{today.productivity_score}%</p>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full"
                      style={{ width: `${Math.min(100, today.productivity_score)}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Performance</span>
                    <Check size={16} className="text-emerald-600" />
                  </div>
                  <p className="mt-2 text-xl font-black text-slate-900">{today.performance}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Calculated from activity</p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs col-span-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Project Work</span>
                    <FolderKanban size={16} className="text-[#214ECF]" />
                  </div>
                  <p className="mt-2 text-sm font-black text-slate-900 truncate">{currentProject}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Target progress: <b>{today.calls_count} / 40</b> calls
                    </span>
                    <span className="font-bold text-[#214ECF]">{today.target_progress_pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-[#214ECF] rounded-full transition-all"
                      style={{ width: `${today.target_progress_pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Direct Operational Work Actions</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Log new assigned customer calls, inspect real-time call records, or message this agent.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCallModalOpen(true)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    className="h-10 rounded-xl bg-[#214ECF] px-4 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer shadow-xs"
                  >
                    <Plus size={14} className="stroke-[3]" />
                    + New Work / Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("calls")}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    View All Calls ({callsTotal || today.calls_count})
                  </button>
                </div>
              </div>

              {/* Recent Agent Activity Feed */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <TrendingUp size={16} className="text-[#214ECF]" />
                    Recent Agent Activity Feed
                  </h3>
                  <span className="text-xs text-slate-400">Real operational timeline</span>
                </div>

                <div className="mt-4 space-y-3">
                  {summaryData?.recent_activity && summaryData.recent_activity.length > 0 ? (
                    summaryData.recent_activity.map((act: any) => (
                      <div
                        key={act.id}
                        className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 hover:bg-slate-50 transition"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-[#214ECF]">
                            {act.type === "call" ? <PhoneCall size={14} /> : <Clock size={14} />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">{act.title}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{act.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-block rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {act.badge || "Recorded"}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {act.time ? new Date(act.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Today"}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400">
                      <PhoneCall size={28} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-600">No work recorded today</p>
                      <p className="mt-1">
                        Agent has not logged calls yet today. When they do in Agent Portal, they will appear here live.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WORK / CALLS (MOST IMPORTANT) */}
          {activeTab === "calls" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Action and Filter Toolbar */}
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <PhoneCall size={18} className="text-[#214ECF]" />
                      Individual Work & Call Records
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Each call/work item is shown as an authoritative individual row. Agent logged calls sync automatically.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      disabled={!callsList.length}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer shadow-2xs"
                    >
                      <Download size={14} />
                      Export Work
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewCallModalOpen(true)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                      className="h-10 rounded-xl bg-[#214ECF] px-4 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer shadow-xs shadow-blue-500/20"
                    >
                      <Plus size={14} className="stroke-[3]" />
                      + New Work / Call
                    </button>
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search Call ID / Customer Ref..."
                      value={callSearch}
                      onChange={(e) => setCallSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchCalls(1)}
                      className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#214ECF] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <select
                    value={callDirection}
                    onChange={(e) => {
                      setCallDirection(e.target.value);
                      setTimeout(() => fetchCalls(1), 50);
                    }}
                    className="h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-700 focus:border-[#214ECF] focus:bg-white focus:outline-none"
                  >
                    <option value="all">All Directions</option>
                    <option value="inbound">Inbound</option>
                    <option value="outbound">Outbound</option>
                  </select>

                  <select
                    value={callOutcome}
                    onChange={(e) => {
                      setCallOutcome(e.target.value);
                      setTimeout(() => fetchCalls(1), 50);
                    }}
                    className="h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-700 focus:border-[#214ECF] focus:bg-white focus:outline-none"
                  >
                    <option value="all">All Outcomes</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Follow-up Required">Follow-up Required</option>
                    <option value="Escalated">Escalated</option>
                  </select>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={callDate}
                      onChange={(e) => {
                        setCallDate(e.target.value);
                        setTimeout(() => fetchCalls(1), 50);
                      }}
                      className="h-9 flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-700 focus:border-[#214ECF] focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCallSearch("");
                        setCallDirection("all");
                        setCallOutcome("all");
                        setCallDate("");
                        setTimeout(() => fetchCalls(1), 50);
                      }}
                      className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                      title="Reset Filters"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Table of Individual Records */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Call ID</th>
                        <th className="px-4 py-3">Date & Time</th>
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3">Customer / Contact</th>
                        <th className="px-4 py-3">Direction</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Outcome</th>
                        <th className="px-4 py-3">Work Status</th>
                        <th className="px-4 py-3">Follow-up</th>
                        <th className="px-4 py-3">Notes</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {callsList.map((call) => {
                        const isResolved = call.outcome === "Resolved";
                        const isEscalated = call.outcome === "Escalated";
                        const isFollowup = call.outcome === "Follow-up Required";
                        const isBpoAssigned = call.source === "bpo_assigned";

                        return (
                          <tr key={call.id} className="hover:bg-slate-50/70 transition">
                            {/* Call ID + Tag */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono font-bold text-[#214ECF]">{call.call_code}</div>
                              <span
                                className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold mt-0.5 ${
                                  isBpoAssigned
                                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                {isBpoAssigned ? "BPO Assigned" : "Agent Logged"}
                              </span>
                            </td>

                            {/* Date & Time */}
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                              {call.start_time
                                ? new Date(call.start_time).toLocaleDateString([], {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </td>

                            {/* Project */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-semibold text-slate-800" title={call.project_name || currentProject}>
                                {(call.project_name || currentProject).length > 20
                                  ? `${(call.project_name || currentProject).slice(0, 20)}...`
                                  : call.project_name || currentProject}
                              </span>
                            </td>

                            {/* Customer / Contact */}
                            <td className="px-4 py-3 whitespace-nowrap font-mono font-semibold text-slate-800">
                              {call.customer_reference || "—"}
                            </td>

                            {/* Direction */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  call.call_direction === "inbound"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {call.call_direction === "inbound" ? (
                                  <ArrowDownLeft size={10} className="stroke-[3]" />
                                ) : (
                                  <ArrowUpRight size={10} className="stroke-[3]" />
                                )}
                                {call.call_direction === "inbound" ? "Inbound" : "Outbound"}
                              </span>
                            </td>

                            {/* Duration */}
                            <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-slate-800">
                              {call.duration_formatted || "00m 00s"}
                            </td>

                            {/* Outcome */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isResolved
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : isEscalated
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {call.outcome}
                              </span>
                            </td>

                            {/* Work Status */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-semibold text-slate-700">
                                {call.work_status || (isResolved ? "Completed" : "Pending")}
                              </span>
                            </td>

                            {/* Follow-up */}
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                              {call.next_followup_date || "—"}
                            </td>

                            {/* Notes */}
                            <td className="px-4 py-3 max-w-[180px] truncate text-slate-500" title={call.notes}>
                              {call.notes || "—"}
                            </td>

                            {/* Action Button */}
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedCall(call)}
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:border-[#214ECF] hover:bg-[#214ECF]/5 hover:text-[#214ECF] transition cursor-pointer shadow-2xs"
                              >
                                <Eye size={12} />
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {!callsList.length && !loadingCalls && (
                    <div className="py-12 text-center text-xs text-slate-400">
                      <PhoneCall size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-600">No work records found</p>
                      <p className="mt-1">
                        Agent has not logged calls matching these filters, or no calls have been recorded yet.
                      </p>
                      <button
                        type="button"
                        onClick={() => setNewCallModalOpen(true)}
                        className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        <Plus size={12} /> Log First Work / Call
                      </button>
                    </div>
                  )}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-500">
                  <span>
                    Showing {callsList.length > 0 ? (callsPage - 1) * callsLimit + 1 : 0}–
                    {Math.min(callsPage * callsLimit, callsTotal)} of {callsTotal} calls
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={callsPage <= 1}
                      onClick={() => fetchCalls(callsPage - 1)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="font-bold text-slate-800">
                      {callsPage} / {callsTotalPages || 1}
                    </span>
                    <button
                      type="button"
                      disabled={callsPage >= callsTotalPages}
                      onClick={() => fetchCalls(callsPage + 1)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ATTENDANCE */}
          {activeTab === "attendance" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Today's Live Attendance Banner */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Today's Live Shift Session</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time attendance clocked by the agent</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      today.attendance_status === "Present"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : today.attendance_status === "On Break"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {today.attendance_status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Shift</span>
                    <p className="text-sm font-bold text-slate-800 mt-1">{shift}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Check-in</span>
                    <p className="text-sm font-bold text-slate-800 mt-1">
                      {attendanceData.today_session?.check_in_time
                        ? new Date(attendanceData.today_session.check_in_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Not Checked In"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Worked Time</span>
                    <p className="text-sm font-mono font-bold text-[#214ECF] mt-1">{today.worked_time_formatted}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Break Duration</span>
                    <p className="text-sm font-bold text-slate-800 mt-1">
                      {attendanceData.today_session?.total_break_minutes
                        ? `${attendanceData.today_session.total_break_minutes}m`
                        : "0m"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Attendance History Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Attendance History</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Shift</th>
                        <th className="px-4 py-3">Check-in</th>
                        <th className="px-4 py-3">Break</th>
                        <th className="px-4 py-3">Check-out</th>
                        <th className="px-4 py-3">Worked Time</th>
                        <th className="px-4 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {attendanceData.history.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">{rec.date}</td>
                          <td className="px-4 py-3 text-slate-600">{rec.shift}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {rec.check_in
                              ? new Date(rec.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{rec.break_display || "0m"}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {rec.check_out
                              ? new Date(rec.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "Active"}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-[#214ECF]">{rec.worked_time}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {rec.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {!attendanceData.history.length && (
                    <div className="py-8 text-center text-xs text-slate-400">
                      <Clock size={28} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-600">No attendance history recorded</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRODUCTIVITY */}
          {activeTab === "productivity" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {productivityData ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Calls Logged</span>
                      <p className="mt-2 text-2xl font-black text-slate-900">{productivityData.total_calls}</p>
                      <p className="text-[11px] text-slate-500 mt-1">Authoritative database records</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Avg Handle Time (AHT)</span>
                      <p className="mt-2 text-2xl font-black text-slate-900">{productivityData.average_handle_time}</p>
                      <p className="text-[11px] text-slate-500 mt-1">Target benchmark: 03m 30s</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">First Call Resolution (FCR)</span>
                      <p className="mt-2 text-2xl font-black text-emerald-600">{productivityData.first_call_resolution}</p>
                      <p className="text-[11px] text-slate-500 mt-1">High satisfaction metric</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Productivity Score</span>
                      <p className="mt-2 text-2xl font-black text-purple-600">{productivityData.productivity_score}</p>
                      <p className="text-[11px] text-slate-500 mt-1">Target achievement</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <h3 className="text-sm font-bold text-slate-900">Performance By Project</h3>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                          <tr>
                            <th className="px-4 py-2.5">Project</th>
                            <th className="px-4 py-2.5">Calls</th>
                            <th className="px-4 py-2.5">Daily Target</th>
                            <th className="px-4 py-2.5">Progress</th>
                            <th className="px-4 py-2.5">AHT</th>
                            <th className="px-4 py-2.5">FCR</th>
                            <th className="px-4 py-2.5 text-right">Productivity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="px-4 py-3 font-semibold text-slate-800">{currentProject}</td>
                            <td className="px-4 py-3 font-mono font-bold">{productivityData.total_calls}</td>
                            <td className="px-4 py-3 text-slate-500">40 calls/day</td>
                            <td className="px-4 py-3 font-bold text-[#214ECF]">{productivityData.target_achievement_pct}%</td>
                            <td className="px-4 py-3 font-mono">{productivityData.average_handle_time}</td>
                            <td className="px-4 py-3 font-bold text-emerald-600">{productivityData.first_call_resolution}</td>
                            <td className="px-4 py-3 text-right font-bold text-purple-600">{productivityData.productivity_score}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  <TrendingUp size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-slate-600">No sufficient operational data yet</p>
                  <p className="mt-1">Metrics calculate automatically as calls and tasks are recorded.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PROJECTS */}
          {activeTab === "projects" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Assigned Operational Projects</h3>
                <span className="text-xs text-slate-500">1 active assignment</span>
              </div>

              {projectsList.map((prj) => (
                <div key={prj.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] font-bold text-[#214ECF] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        {prj.campaign}
                      </span>
                      <h4 className="mt-2 text-base font-black text-slate-900">{prj.name}</h4>
                      <p className="text-xs text-slate-600 mt-0.5">Role: {prj.role}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {prj.status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100 pt-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] font-medium">Daily Target</span>
                      <p className="font-bold text-slate-800">{prj.target}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] font-medium">Completed Today</span>
                      <p className="font-bold text-emerald-600">{prj.completed} calls</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] font-medium">Worked Time</span>
                      <p className="font-mono font-bold text-slate-800">{prj.worked_time}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] font-medium">Productivity</span>
                      <p className="font-bold text-purple-600">{prj.productivity}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Target Completion</span>
                      <span className="font-bold text-[#214ECF]">{prj.completion_pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-[#214ECF] rounded-full" style={{ width: `${prj.completion_pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 6: TRAINING */}
          {activeTab === "training" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Assigned Training & Certifications</h3>
                <span className="text-xs text-slate-500">Mandatory BPO compliance</span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Training Module</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Progress</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trainingData.modules.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{m.title}</td>
                        <td className="px-4 py-3 text-slate-500">{m.type}</td>
                        <td className="px-4 py-3 text-slate-600">{m.project}</td>
                        <td className="px-4 py-3 text-slate-500">{m.due_date}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full bg-[#214ECF]" style={{ width: `${m.progress}%` }} />
                            </div>
                            <span className="font-bold text-slate-700">{m.progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">{m.score ? `${m.score}/100` : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              m.status === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: DOCUMENTS */}
          {activeTab === "documents" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Verified Agent Documents</h3>
                <span className="text-xs text-slate-500">Secured Supabase Storage</span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Document Title</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Uploaded By</th>
                      <th className="px-4 py-3">Uploaded Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {docsList.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-2">
                          <FileText size={14} className="text-[#214ECF]" />
                          {doc.document_name}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{doc.category}</td>
                        <td className="px-4 py-3 text-slate-600">{doc.uploaded_by}</td>
                        <td className="px-4 py-3 text-slate-500">{doc.uploaded_at}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => window.open(doc.file_url || "#", "_blank")}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#214ECF] hover:underline mr-3"
                          >
                            <Eye size={12} /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => window.open(doc.file_url || "#", "_blank")}
                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900"
                          >
                            <Download size={12} /> Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: CONVERSATION */}
          {activeTab === "conversation" && (
            <div className="flex flex-col h-[520px] rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden animate-in fade-in duration-200">
              {/* Chat Top Banner */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {agentName}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 font-semibold bg-slate-200/70 px-1.5 py-0.2 rounded">
                        {agentCode}
                      </span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold px-1.5 py-0.2 rounded-full">
                        ● Online / Active
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">BPO Operations Channel</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[#214ECF] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full shadow-2xs">
                    Conversation ID: #{conversation?.id || 10005}
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">Real-time synchronized</span>
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                {messages.map((m) => {
                  const isSupervisor = m.sender_type === "bpo_supervisor";
                  return (
                    <div key={m.id} className={`flex flex-col ${isSupervisor ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                        <span className="font-bold text-slate-600">{m.sender_name || (isSupervisor ? "Supervisor" : agentName)}</span>
                        <span>·</span>
                        <span>
                          {m.created_at
                            ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "Just now"}
                        </span>
                      </div>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs ${
                          isSupervisor
                            ? "bg-[#214ECF] text-white rounded-tr-xs"
                            : "bg-white text-slate-800 border border-slate-200 rounded-tl-xs"
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Form */}
              <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white p-3 space-y-1.5">
                {sendError && (
                  <div className="text-[11px] text-red-600 font-medium px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                    <span>{sendError}</span>
                    <button type="button" onClick={() => setSendError("")} className="text-red-400 hover:text-red-700 font-bold">✕</button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Send direct instructions to ${agentName}... (Enter to send)`}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    disabled={sendingMessage}
                    className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#214ECF] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage || !messageText.trim()}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    className="h-10 rounded-xl bg-[#214ECF] px-4 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    {sendingMessage ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send size={13} />
                        <span>Send</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* ── CALL DETAIL MODAL / DRAWER ─────────────────────────────── */}
        {selectedCall && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <PhoneCall size={18} className="text-[#214ECF]" />
                  <h3 className="text-base font-black text-slate-900">Work / Call Record Details</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCall(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                {/* CALL INFORMATION */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">CALL INFORMATION</h4>
                  <div className="mt-2 grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
                    <div>
                      <span className="text-slate-400">Call ID:</span>
                      <p className="font-mono font-bold text-[#214ECF]">{selectedCall.call_code}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Source:</span>
                      <p className="font-bold text-slate-800">
                        {selectedCall.source === "bpo_assigned" ? "BPO Created / Assigned" : "Agent Portal Logged"}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Direction:</span>
                      <p className="font-bold text-slate-800 capitalize">{selectedCall.call_direction}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Duration:</span>
                      <p className="font-mono font-bold text-slate-800">{selectedCall.duration_formatted}</p>
                    </div>
                  </div>
                </div>

                {/* CUSTOMER / CONTACT */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">CUSTOMER / CONTACT</h4>
                  <div className="mt-2 grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
                    <div>
                      <span className="text-slate-400">Customer Reference:</span>
                      <p className="font-mono font-bold text-slate-800">{selectedCall.customer_reference || "—"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Project:</span>
                      <p className="font-bold text-slate-800">{selectedCall.project_name || currentProject}</p>
                    </div>
                  </div>
                </div>

                {/* WORK OUTCOME */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">WORK OUTCOME</h4>
                  <div className="mt-2 grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
                    <div>
                      <span className="text-slate-400">Outcome:</span>
                      <p className="font-bold text-emerald-600">{selectedCall.outcome}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Work Status:</span>
                      <p className="font-bold text-slate-800">{selectedCall.work_status}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">Follow-up:</span>
                      <p className="font-bold text-slate-800">{selectedCall.next_followup_date || "None required"}</p>
                    </div>
                  </div>
                </div>

                {/* NOTES */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">NOTES & DESCRIPTION</h4>
                  <div className="mt-2 bg-slate-50 p-3 rounded-xl text-slate-700 leading-relaxed">
                    {selectedCall.notes || "No additional operational notes."}
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-3 text-right">
                <button
                  type="button"
                  onClick={() => setSelectedCall(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: + NEW WORK / CALL ───────────────────────────────── */}
        {newCallModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded">
                    BPO Operational Assignment
                  </span>
                  <h3 className="mt-1 text-base font-black text-slate-900">Log / Assign New Work or Call</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setNewCallModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateCall} className="mt-4 space-y-3.5 text-xs">
                {newCallError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{newCallError}</div>
                )}
                {newCallSuccess && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
                    {newCallSuccess}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer / Patient Reference</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PT-PAT-88392"
                    value={newCallForm.customerReference}
                    onChange={(e) => setNewCallForm({ ...newCallForm, customerReference: e.target.value })}
                    className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:border-[#214ECF] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Direction</label>
                    <select
                      value={newCallForm.callType}
                      onChange={(e) => setNewCallForm({ ...newCallForm, callType: e.target.value })}
                      className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:border-[#214ECF] focus:outline-none"
                    >
                      <option value="inbound">Inbound</option>
                      <option value="outbound">Outbound</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Duration (Min / Sec)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        placeholder="Min"
                        value={newCallForm.durationMinutes}
                        onChange={(e) => setNewCallForm({ ...newCallForm, durationMinutes: Number(e.target.value) })}
                        className="h-9 w-full rounded-xl border border-slate-200 px-2 text-xs text-center"
                      />
                      <span>:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        placeholder="Sec"
                        value={newCallForm.durationSeconds}
                        onChange={(e) => setNewCallForm({ ...newCallForm, durationSeconds: Number(e.target.value) })}
                        className="h-9 w-full rounded-xl border border-slate-200 px-2 text-xs text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Outcome</label>
                    <select
                      value={newCallForm.outcome}
                      onChange={(e) => setNewCallForm({ ...newCallForm, outcome: e.target.value })}
                      className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:border-[#214ECF] focus:outline-none"
                    >
                      <option value="Resolved">Resolved</option>
                      <option value="Follow-up Required">Follow-up Required</option>
                      <option value="Escalated">Escalated</option>
                      <option value="Scheduled">Scheduled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Work Status</label>
                    <select
                      value={newCallForm.workStatus}
                      onChange={(e) => setNewCallForm({ ...newCallForm, workStatus: e.target.value })}
                      className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:border-[#214ECF] focus:outline-none"
                    >
                      <option value="Completed">Completed</option>
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Next Follow-up Date (Optional)</label>
                  <input
                    type="date"
                    value={newCallForm.nextFollowupDate}
                    onChange={(e) => setNewCallForm({ ...newCallForm, nextFollowupDate: e.target.value })}
                    className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:border-[#214ECF] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes & Instructions</label>
                  <textarea
                    rows={3}
                    placeholder="Enter customer verification notes or assigned task instructions..."
                    value={newCallForm.notes}
                    onChange={(e) => setNewCallForm({ ...newCallForm, notes: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-[#214ECF] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setNewCallModalOpen(false)}
                    className="h-9 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingNewCall}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    className="h-9 rounded-xl bg-[#214ECF] px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-xs"
                  >
                    <Plus size={14} />
                    {submittingNewCall ? "Saving..." : "Save & Assign Record"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
