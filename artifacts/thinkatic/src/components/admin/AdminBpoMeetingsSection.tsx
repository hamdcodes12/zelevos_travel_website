import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  Video,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Building2,
  FolderKanban,
  Eye,
  Edit2,
  Ban,
  X,
  Check,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Briefcase,
  Copy,
  UserCheck,
} from "lucide-react";

interface AdminBpoMeetingsSectionProps {
  apiCall: (path: string, options?: RequestInit) => Promise<Response>;
}

export interface BpoMeetingItem {
  id: number;
  title: string;
  bpoPartnerId: string;
  bpoPartnerName: string;
  centreId: string;
  projectId: number | null;
  projectName: string | null;
  meetingDate: string;
  startTime: string;
  endTime: string;
  duration: number;
  timezone: string;
  meetingType: string;
  status: "SCHEDULED" | "TODAY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  rawStatus?: string;
  meetingUrl: string;
  hasPassword: boolean;
  agenda: string | null;
  description: string | null;
  additionalInfo: string | null;
  createdBy: string;
  createdAt: string;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
}

interface PartnerOption {
  id: string;
  partnerCode: string;
  centreId: string;
  name: string;
  contactName: string;
  email: string;
  status: string;
}

interface ProjectOption {
  id: number;
  name: string;
  allocatedPartnerId: string | null;
  status: string;
  vertical?: string;
}

interface Kpis {
  upcoming: number;
  today: number;
  completed: number;
  cancelled: number;
  total: number;
}

const BRAND_BLUE = "#214ECF";

const BPO_MEETING_TYPES = [
  "Operational Review",
  "Project Review",
  "Payment Discussion",
  "Training",
  "Compliance",
  "General",
  "Other",
] as const;

let _cachedAdminMeetings: BpoMeetingItem[] | null = null;
let _cachedAdminKpis: Kpis | null = null;
let _cachedAdminMeta: { partners: PartnerOption[]; projects: ProjectOption[] } | null = null;
let _cachedAdminMeetingsTime = 0;

export default function AdminBpoMeetingsSection({ apiCall }: AdminBpoMeetingsSectionProps) {
  // Data state
  const [meetings, setMeetings] = useState<BpoMeetingItem[]>(() => _cachedAdminMeetings || []);
  const [kpis, setKpis] = useState<Kpis>(() => _cachedAdminKpis || { upcoming: 0, today: 0, completed: 0, cancelled: 0, total: 0 });
  const [loading, setLoading] = useState(!_cachedAdminMeetings);
  const [error, setError] = useState<string | null>(null);

  // Selector data
  const [partners, setPartners] = useState<PartnerOption[]>(() => _cachedAdminMeta?.partners || []);
  const [projects, setProjects] = useState<ProjectOption[]>(() => _cachedAdminMeta?.projects || []);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UPCOMING" | "TODAY" | "COMPLETED" | "CANCELLED">("ALL");

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewMeeting, setViewMeeting] = useState<BpoMeetingItem | null>(null);
  const [editMeeting, setEditMeeting] = useState<BpoMeetingItem | null>(null);
  const [cancelModalMeeting, setCancelModalMeeting] = useState<BpoMeetingItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Create form state
  const [formPartnerId, setFormPartnerId] = useState("");
  const [formPartnerSearch, setFormPartnerSearch] = useState("");
  const [formCentreId, setFormCentreId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formProjectId, setFormProjectId] = useState<number | "">("");
  const [formMeetingDate, setFormMeetingDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("10:00");
  const [formEndTime, setFormEndTime] = useState("11:00");
  const [formMeetingUrl, setFormMeetingUrl] = useState("");
  const [formMeetingPassword, setFormMeetingPassword] = useState("");
  const [formAgenda, setFormAgenda] = useState("");
  const [formAdditionalInfo, setFormAdditionalInfo] = useState("");
  const [formMeetingType, setFormMeetingType] = useState<string>("Operational Review");

  // Action states
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [cancelling, setCancelling] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealingPassword, setRevealingPassword] = useState(false);

  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch meetings & KPIs with SWR caching
  const loadMeetings = async (force = false) => {
    if (!force && _cachedAdminMeetings && _cachedAdminKpis) {
      setMeetings(_cachedAdminMeetings);
      setKpis(_cachedAdminKpis);
      setLoading(false);
      if (Date.now() - _cachedAdminMeetingsTime < 15000) return;
    } else {
      if (!_cachedAdminMeetings) setLoading(true);
    }
    setError(null);
    try {
      const res = await apiCall("/admin/bpo-meetings");
      if (!res.ok) {
        throw new Error("Unable to load meetings.");
      }
      const data = await res.json();
      const loadedList = data.meetings || [];
      const loadedKpis = data.kpis || { upcoming: 0, today: 0, completed: 0, cancelled: 0, total: 0 };
      setMeetings(loadedList);
      setKpis(loadedKpis);
      _cachedAdminMeetings = loadedList;
      _cachedAdminKpis = loadedKpis;
      _cachedAdminMeetingsTime = Date.now();
    } catch (err: any) {
      console.error("Error loading BPO meetings:", err);
      if (!_cachedAdminMeetings) setError("Unable to load meetings.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch partners and projects metadata
  const loadMeta = async (force = false) => {
    if (!force && _cachedAdminMeta) {
      setPartners(_cachedAdminMeta.partners);
      setProjects(_cachedAdminMeta.projects);
      return;
    }
    setLoadingMeta(true);
    try {
      const res = await apiCall("/admin/bpo-meetings/partners-and-projects");
      if (res.ok) {
        const data = await res.json();
        const pts = data.partners || [];
        const prs = data.projects || [];
        setPartners(pts);
        setProjects(prs);
        _cachedAdminMeta = { partners: pts, projects: prs };
      }
    } catch (err) {
      console.error("Failed to load metadata:", err);
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    void loadMeetings();
    void loadMeta();
  }, []);

  // Update Centre ID when Partner changes
  const handlePartnerSelect = (partnerId: string) => {
    setFormPartnerId(partnerId);
    const selected = partners.find((p) => p.id === partnerId);
    if (selected) {
      setFormCentreId(selected.centreId || selected.partnerCode || "THK-CTR-00001");
    } else {
      setFormCentreId("");
    }
  };

  // Filter projects available for selected BPO partner
  const availableProjects = useMemo(() => {
    if (!formPartnerId) return projects;
    return projects.filter(
      (p) => !p.allocatedPartnerId || p.allocatedPartnerId === formPartnerId
    );
  }, [projects, formPartnerId]);

  // Search filtered partners for create modal
  const filteredPartnerOptions = useMemo(() => {
    if (!formPartnerSearch.trim()) return partners;
    const q = formPartnerSearch.toLowerCase();
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.centreId.toLowerCase().includes(q) ||
        p.partnerCode.toLowerCase().includes(q)
    );
  }, [partners, formPartnerSearch]);

  // Handle Create Meeting Submit
  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    // Frontend validation
    if (!formPartnerId) {
      setCreateError("Please select a verified BPO Partner.");
      return;
    }
    if (!formTitle.trim()) {
      setCreateError("Meeting Topic / Title is required.");
      return;
    }
    if (!formMeetingDate) {
      setCreateError("Meeting Date is required.");
      return;
    }
    if (!formStartTime || !formEndTime) {
      setCreateError("Start time and End time are required.");
      return;
    }
    if (!formMeetingUrl.trim()) {
      setCreateError("Meeting URL is required.");
      return;
    }

    try {
      new URL(formMeetingUrl.trim());
    } catch {
      setCreateError("Please enter a valid URL (e.g. https://meet.google.com/xyz).");
      return;
    }

    setCreating(true);

    try {
      const payload = {
        bpoPartnerId: formPartnerId,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        projectId: formProjectId ? Number(formProjectId) : undefined,
        meetingDate: formMeetingDate,
        startTime: formStartTime,
        endTime: formEndTime,
        meetingUrl: formMeetingUrl.trim(),
        meetingPassword: formMeetingPassword.trim() || undefined,
        agenda: formAgenda.trim() || undefined,
        additionalInfo: formAdditionalInfo.trim() || undefined,
        meetingType: formMeetingType,
      };

      const res = await apiCall("/admin/bpo-meetings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || errData.error || "Unable to create meeting. Please try again.");
      }

      setCreateSuccess(true);
      showToast("success", "Meeting Created successfully and BPO notified!");

      // Refresh list & reset after short delay
      setTimeout(async () => {
        setCreateModalOpen(false);
        setCreateSuccess(false);
        setFormPartnerId("");
        setFormCentreId("");
        setFormTitle("");
        setFormDescription("");
        setFormProjectId("");
        setFormMeetingDate("");
        setFormMeetingUrl("");
        setFormMeetingPassword("");
        setFormAgenda("");
        setFormAdditionalInfo("");
        await loadMeetings(true);
      }, 900);
    } catch (err: any) {
      console.error("Create meeting error:", err);
      setCreateError(err.message || "Unable to create meeting. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // Handle Cancel Meeting
  const handleCancelMeetingConfirm = async () => {
    if (!cancelModalMeeting) return;
    setCancelling(true);
    try {
      const res = await apiCall(`/admin/bpo-meetings/${cancelModalMeeting.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason || "Cancelled by Administrator" }),
      });
      if (!res.ok) {
        throw new Error("Failed to cancel meeting");
      }
      showToast("success", "Meeting has been cancelled.");
      setCancelModalMeeting(null);
      setCancelReason("");
      if (viewMeeting?.id === cancelModalMeeting.id) {
        setViewMeeting((prev) => (prev ? { ...prev, status: "CANCELLED" } : null));
      }
      await loadMeetings(true);
    } catch (err: any) {
      showToast("error", err.message || "Unable to cancel meeting");
    } finally {
      setCancelling(false);
    }
  };

  // Handle Edit Meeting Submit
  const handleEditMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMeeting) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await apiCall(`/admin/bpo-meetings/${editMeeting.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editMeeting.title,
          meetingType: editMeeting.meetingType,
          meetingUrl: editMeeting.meetingUrl,
          agenda: editMeeting.agenda,
          description: editMeeting.description,
          startTime: editMeeting.startTime,
          endTime: editMeeting.endTime,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to update meeting");
      }
      showToast("success", "Meeting updated successfully.");
      setEditMeeting(null);
      await loadMeetings(true);
    } catch (err: any) {
      setEditError(err.message || "Unable to update meeting");
    } finally {
      setSavingEdit(false);
    }
  };

  // Secure Password Reveal in View Drawer
  const handleRevealPassword = async (meetingId: number) => {
    setRevealingPassword(true);
    try {
      const res = await apiCall(`/meetings/${meetingId}/password`);
      if (res.ok) {
        const data = await res.json();
        setRevealedPassword(data.password || "No passcode set");
      } else {
        showToast("error", "Failed to retrieve meeting passcode");
      }
    } catch {
      showToast("error", "Network error retrieving passcode");
    } finally {
      setRevealingPassword(false);
    }
  };

  // Client-side filtering
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      // Status filter
      if (statusFilter === "UPCOMING" && !(m.status === "SCHEDULED" || m.status === "TODAY")) {
        return false;
      }
      if (statusFilter !== "ALL" && statusFilter !== "UPCOMING" && m.status !== statusFilter) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = m.title?.toLowerCase().includes(q);
        const partnerMatch = m.bpoPartnerName?.toLowerCase().includes(q);
        const centreMatch = m.centreId?.toLowerCase().includes(q);
        const projMatch = m.projectName?.toLowerCase().includes(q);
        const typeMatch = m.meetingType?.toLowerCase().includes(q);
        if (!titleMatch && !partnerMatch && !centreMatch && !projMatch && !typeMatch) {
          return false;
        }
      }

      return true;
    });
  }, [meetings, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-bold transition-all ${
            toastMessage.type === "success"
              ? "bg-white text-emerald-800 border-emerald-200"
              : "bg-white text-red-800 border-red-200"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* HEADER SECTION */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">BPO Meetings</h1>
          <p className="text-xs text-slate-500 mt-1">
            Schedule and manage operational meetings with verified BPO partners.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadMeetings(true)}
            disabled={loading}
            className="inline-flex items-center justify-center p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-300 transition-colors cursor-pointer"
            title="Refresh meetings"
            aria-label="Refresh meetings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#214ECF]" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setCreateModalOpen(true);
              setCreateError(null);
              setCreateSuccess(false);
              if (partners.length === 0) void loadMeta();
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
            id="create-bpo-meeting-btn"
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span>+ Create BPO Meeting</span>
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* KPI METRIC CARDS */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {loading ? (
          // Skeleton loader
          Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4.5 animate-pulse space-y-2">
              <div className="h-3 w-20 bg-slate-100 rounded-md" />
              <div className="h-7 w-12 bg-slate-200 rounded-md" />
            </div>
          ))
        ) : error ? (
          <div className="col-span-full rounded-2xl border border-rose-200 bg-rose-50 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3 text-rose-800 text-xs font-bold">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => void loadMeetings()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : (
          [
            { label: "Upcoming Meetings", value: kpis.upcoming, icon: Calendar, color: "text-[#214ECF]", bg: "bg-blue-50" },
            { label: "Today's Meetings", value: kpis.today, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Completed", value: kpis.completed, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Cancelled", value: kpis.cancelled, icon: Ban, color: "text-rose-600", bg: "bg-rose-50" },
            { label: "Total Meetings", value: kpis.total, icon: Video, color: "text-slate-700", bg: "bg-slate-100" },
          ].map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-4.5 transition-all shadow-2xs hover:shadow-xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                  <div className={`w-7 h-7 rounded-xl ${kpi.bg} ${kpi.color} flex items-center justify-center`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">{kpi.value}</div>
              </div>
            );
          })
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* FILTER BAR & SEARCH */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Status subtabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "ALL", label: "All Sessions", count: kpis.total },
            { id: "UPCOMING", label: "Upcoming", count: kpis.upcoming },
            { id: "TODAY", label: "Today", count: kpis.today },
            { id: "COMPLETED", label: "Completed", count: kpis.completed },
            { id: "CANCELLED", label: "Cancelled", count: kpis.cancelled },
          ].map((sub) => (
            <button
              key={sub.id}
              onClick={() => setStatusFilter(sub.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                statusFilter === sub.id
                  ? "bg-[#214ECF] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{sub.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  statusFilter === sub.id ? "bg-white/20 text-white" : "bg-white text-slate-700"
                }`}
              >
                {sub.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic, BPO, Centre ID, project..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF] bg-white text-slate-900"
          />
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ADMIN MEETING LIST (TABLE / CARDS) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#214ECF]" />
          Loading BPO scheduled sessions...
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#214ECF] flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No scheduled sessions in this view</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {statusFilter === "UPCOMING"
              ? "No upcoming sessions currently scheduled with BPO partners."
              : statusFilter === "TODAY"
              ? "No operational meetings scheduled for today."
              : "Thinkatic administration can schedule authorized operational sessions with verified BPO partners here."}
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs mx-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create First Meeting
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">BPO Partner</th>
                  <th className="py-3 px-4">Centre ID</th>
                  <th className="py-3 px-4">Meeting Topic</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredMeetings.map((meeting) => {
                  const isCancelled = meeting.status === "CANCELLED";
                  const isCompleted = meeting.status === "COMPLETED";

                  return (
                    <tr
                      key={meeting.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* BPO Partner */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold text-xs shrink-0">
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 line-clamp-1">{meeting.bpoPartnerName}</div>
                            <div className="text-[10px] text-slate-400">Created by {meeting.createdBy}</div>
                          </div>
                        </div>
                      </td>

                      {/* Centre ID */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {meeting.centreId}
                        </span>
                      </td>

                      {/* Meeting Topic */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs">
                        <div className="line-clamp-1 font-bold text-slate-900">{meeting.title}</div>
                        {meeting.agenda && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 italic mt-0.5">
                            "{meeting.agenda}"
                          </div>
                        )}
                      </td>

                      {/* Project */}
                      <td className="py-3.5 px-4">
                        {meeting.projectId ? (
                          <div className="flex items-center gap-1.5 font-medium text-slate-700">
                            <FolderKanban className="w-3.5 h-3.5 text-[#214ECF] shrink-0" />
                            <span className="line-clamp-1">{meeting.projectName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">Operational</span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          {new Date(meeting.startTime).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          {new Date(meeting.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (
                          {meeting.duration}m)
                        </div>
                      </td>

                      {/* Meeting Type */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 whitespace-nowrap">
                          {meeting.meetingType}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCancelled
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : isCompleted
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : meeting.status === "TODAY"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : meeting.status === "IN_PROGRESS"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse"
                              : "bg-blue-50 text-[#214ECF] border border-blue-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isCancelled
                                ? "bg-rose-600"
                                : isCompleted
                                ? "bg-emerald-600"
                                : meeting.status === "TODAY"
                                ? "bg-amber-600"
                                : "bg-[#214ECF]"
                            }`}
                          />
                          {meeting.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setViewMeeting(meeting);
                              setRevealedPassword(null);
                            }}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-colors text-[11px] cursor-pointer"
                            title="View Meeting Details"
                          >
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                            <span>View</span>
                          </button>

                          {!isCancelled && !isCompleted && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditMeeting({ ...meeting });
                                setEditError(null);
                              }}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-colors text-[11px] cursor-pointer"
                              title="Edit Meeting"
                            >
                              <Edit2 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                              <span>Edit</span>
                            </button>
                          )}

                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelModalMeeting(meeting);
                                setCancelReason("");
                              }}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg border border-rose-200 bg-white text-rose-600 font-bold hover:bg-rose-50 transition-colors text-[11px] cursor-pointer"
                              title="Cancel Meeting"
                            >
                              <Ban className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* CREATE BPO MEETING MODAL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="rounded-3xl border border-slate-200 bg-white w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#214ECF] flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Schedule BPO Partner Meeting</h3>
                  <p className="text-xs text-slate-500">Official alignment session with verified BPO organization</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateMeeting} className="p-6 space-y-4">
              {createError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* 1. BPO Partner Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    BPO Partner <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formPartnerId}
                    onChange={(e) => handlePartnerSelect(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="">-- Select Verified BPO Partner --</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.centreId || p.partnerCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Auto-populated Centre ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Centre ID <span className="text-slate-400 font-normal">(Auto-populated)</span>
                  </label>
                  <div className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-700 font-bold flex items-center justify-between">
                    <span>{formCentreId || "Select a BPO Partner first"}</span>
                    {formCentreId && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-sans font-bold">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Topic & Meeting Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Meeting Topic / Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Q4 Inbound SLA Review & Payout Clearance"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Meeting Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formMeetingType}
                    onChange={(e) => setFormMeetingType(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                  >
                    {BPO_MEETING_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Project association (optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Associated Project <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                >
                  <option value="">-- General / Operational Alignment (No Project) --</option>
                  {availableProjects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} ({proj.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Date, Start Time, End Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Meeting Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formMeetingDate}
                    onChange={(e) => setFormMeetingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
              </div>

              {/* 5. Meeting URL & Passcode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Meeting URL Bridge <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Video className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="url"
                      required
                      value={formMeetingUrl}
                      onChange={(e) => setFormMeetingUrl(e.target.value)}
                      placeholder="https://meet.google.com/xyz-abcd-efg"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Passcode / PIN <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={formMeetingPassword}
                      onChange={(e) => setFormMeetingPassword(e.target.value)}
                      placeholder="e.g. 849201"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>
                </div>
              </div>

              {/* 6. Agenda & Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Agenda Outline <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={formAgenda}
                  onChange={(e) => setFormAgenda(e.target.value)}
                  placeholder="1. Weekly agent attendance compliance&#10;2. Performance QA metrics&#10;3. Next milestone requirements"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Additional Information / Briefing Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Additional context or briefing instructions for the BPO team..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={creating}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors text-xs cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating || createSuccess}
                  className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md cursor-pointer ${
                    createSuccess
                      ? "bg-emerald-600"
                      : creating
                      ? "bg-blue-400 cursor-not-allowed"
                      : "bg-[#214ECF] hover:bg-blue-700"
                  }`}
                  style={{ minWidth: 160 }}
                >
                  {createSuccess ? (
                    <>
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Meeting Created</span>
                    </>
                  ) : creating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>Creating Meeting...</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 shrink-0" />
                      <span>Create Meeting</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* VIEW MEETING DETAIL DRAWER / MODAL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {viewMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="rounded-3xl border border-slate-200 bg-white w-full max-w-xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#214ECF] flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 line-clamp-1">{viewMeeting.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {viewMeeting.meetingType}
                    </span>
                    <span
                      className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase ${
                        viewMeeting.status === "CANCELLED"
                          ? "bg-rose-50 text-rose-700"
                          : viewMeeting.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-blue-50 text-[#214ECF]"
                      }`}
                    >
                      {viewMeeting.status}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewMeeting(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4">
              {/* Partner info */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">BPO Partner Organization</span>
                  <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {viewMeeting.centreId}
                  </span>
                </div>
                <div className="font-bold text-slate-900 text-sm">{viewMeeting.bpoPartnerName}</div>
                {viewMeeting.projectName && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                    <FolderKanban className="w-3.5 h-3.5 text-[#214ECF]" />
                    <span>Project: {viewMeeting.projectName}</span>
                  </div>
                )}
              </div>

              {/* Schedule time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase mb-1">
                    <Calendar className="w-3 h-3 text-slate-400" /> Date
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    {new Date(viewMeeting.startTime).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase mb-1">
                    <Clock className="w-3 h-3 text-slate-400" /> Time & Duration
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    {new Date(viewMeeting.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {new Date(viewMeeting.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (
                    {viewMeeting.duration}m)
                  </div>
                </div>
              </div>

              {/* Meeting Link & Passcode */}
              <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">Video Bridge Access</span>
                  <a
                    href={viewMeeting.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#214ECF] hover:underline"
                  >
                    <span>Open Bridge</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={viewMeeting.meetingUrl}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-700 select-all"
                  />
                </div>

                {/* Passcode reveal */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Passcode:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {revealedPassword !== null ? revealedPassword : "••••••••"}
                    </span>
                  </div>

                  {revealedPassword === null && (
                    <button
                      type="button"
                      onClick={() => handleRevealPassword(viewMeeting.id)}
                      disabled={revealingPassword}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#214ECF] hover:underline cursor-pointer"
                    >
                      {revealingPassword ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                      <span>{revealingPassword ? "Decrypting..." : "Reveal"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Agenda */}
              {viewMeeting.agenda && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Agenda</span>
                  <div className="p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 whitespace-pre-line">
                    {viewMeeting.agenda}
                  </div>
                </div>
              )}

              {/* Description / Notes */}
              {viewMeeting.description && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Briefing Notes</span>
                  <div className="p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-600">
                    {viewMeeting.description}
                  </div>
                </div>
              )}

              {/* Cancellation Reason if cancelled */}
              {viewMeeting.status === "CANCELLED" && viewMeeting.cancellationReason && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <span className="font-bold">Cancellation Reason: </span>
                  {viewMeeting.cancellationReason}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                Created: {new Date(viewMeeting.createdAt).toLocaleDateString()}
              </div>

              <div className="flex items-center gap-2">
                {viewMeeting.status !== "CANCELLED" && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelModalMeeting(viewMeeting);
                      setCancelReason("");
                    }}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 font-bold hover:bg-rose-50 transition-colors text-xs cursor-pointer"
                  >
                    Cancel Meeting
                  </button>
                )}

                {viewMeeting.status !== "CANCELLED" && viewMeeting.status !== "COMPLETED" && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditMeeting({ ...viewMeeting });
                      setViewMeeting(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#214ECF] text-white font-bold hover:bg-blue-700 transition-colors text-xs cursor-pointer"
                  >
                    Edit Meeting
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* EDIT MEETING MODAL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {editMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="rounded-3xl border border-slate-200 bg-white w-full max-w-lg shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Edit BPO Meeting</h3>
              <button
                type="button"
                onClick={() => setEditMeeting(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditMeetingSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Meeting Topic</label>
                <input
                  type="text"
                  required
                  value={editMeeting.title}
                  onChange={(e) => setEditMeeting({ ...editMeeting, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Meeting Type</label>
                <select
                  value={editMeeting.meetingType}
                  onChange={(e) => setEditMeeting({ ...editMeeting, meetingType: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900"
                >
                  {BPO_MEETING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Meeting URL Bridge</label>
                <input
                  type="url"
                  required
                  value={editMeeting.meetingUrl}
                  onChange={(e) => setEditMeeting({ ...editMeeting, meetingUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Agenda</label>
                <textarea
                  rows={2}
                  value={editMeeting.agenda || ""}
                  onChange={(e) => setEditMeeting({ ...editMeeting, agenda: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditMeeting(null)}
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#214ECF] text-white font-bold text-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{savingEdit ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* CANCEL MEETING CONFIRMATION MODAL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {cancelModalMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="rounded-3xl border border-slate-200 bg-white w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-black text-slate-900">Cancel BPO Meeting?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to cancel "{cancelModalMeeting.title}" with {cancelModalMeeting.bpoPartnerName}?
                A cancellation notice will be recorded.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for cancellation</label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Operational schedule adjustment..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalMeeting(null)}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
              >
                Keep Meeting
              </button>
              <button
                type="button"
                onClick={handleCancelMeetingConfirm}
                disabled={cancelling}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                <span>{cancelling ? "Cancelling..." : "Confirm Cancellation"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
