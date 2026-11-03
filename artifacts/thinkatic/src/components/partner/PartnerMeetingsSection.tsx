import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  Video,
  Copy,
  Check,
  Search,
  Lock,
  Unlock,
  Building2,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  X,
  Eye,
  ShieldCheck,
  UserCheck,
  ChevronRight,
  HelpCircle,
} from "lucide-react";

interface PartnerMeetingsSectionProps {
  api: (path: string, options?: RequestInit) => Promise<Response>;
  initialMeetingId?: number | string;
  onMeetingViewed?: (meetingId: number | string) => void;
}

const BRAND_BLUE = "#214ECF";

const MEETING_TYPE_LABELS: Record<string, string> = {
  client_meeting: "Client Meeting",
  bpo_partner_meeting: "BPO Partner Sync",
  operations_meeting: "Operations Review",
  project_meeting: "Project Meeting",
  requirement_discussion: "Requirement Discussion",
  demo: "Platform Demo",
  uat: "UAT Walkthrough",
  training: "Agent Training",
  general_meeting: "General Operations Sync",
  planning: "Sprint Planning",
  review: "Deliverable Review",
  support: "Support Sync",
  other: "Authorized Session",
};

let _cachedPartnerMeetings: any[] | null = null;
let _cachedPartnerMeetingsTime = 0;

export default function PartnerMeetingsSection({ api, initialMeetingId, onMeetingViewed }: PartnerMeetingsSectionProps) {
  const [meetings, setMeetings] = useState<any[]>(() => _cachedPartnerMeetings || []);
  const [loading, setLoading] = useState(!_cachedPartnerMeetings);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"upcoming" | "today" | "past" | "all">("upcoming");

  // Selected meeting detail drawer
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealingPassword, setRevealingPassword] = useState(false);
  const [submittingRsvp, setSubmittingRsvp] = useState(false);
  const [joiningMeetingId, setJoiningMeetingId] = useState<number | null>(null);

  // UI feedback states
  const [copyFeedback, setCopyFeedback] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const copyToClipboard = async (text: string, id: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopyFeedback((prev) => ({ ...prev, [id]: false }));
      }, 2000);
      showToast("success", "Copied to clipboard!");
    } catch {
      showToast("error", "Failed to copy to clipboard");
    }
  };

  const loadMeetings = async (force = false) => {
    if (!force && _cachedPartnerMeetings) {
      setMeetings(_cachedPartnerMeetings);
      setLoading(false);
      if (Date.now() - _cachedPartnerMeetingsTime < 15000) return;
    } else {
      if (!_cachedPartnerMeetings) setLoading(true);
    }
    setLoadError(false);
    try {
      const res = await api("/partner/meetings");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setMeetings(list);
        _cachedPartnerMeetings = list;
        _cachedPartnerMeetingsTime = Date.now();
      } else {
        if (!_cachedPartnerMeetings) setLoadError(true);
        showToast("error", "Unable to load authorized meetings");
      }
    } catch (err) {
      console.error("Failed to load partner meetings:", err);
      if (!_cachedPartnerMeetings) setLoadError(true);
      showToast("error", "Network error loading meetings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  // When initialMeetingId is provided or changes, auto-open that meeting
  useEffect(() => {
    if (initialMeetingId) {
      const numericId = Number(initialMeetingId);
      if (!isNaN(numericId) && numericId > 0) {
        openMeetingDetails(numericId);
      }
    }
  }, [initialMeetingId]);

  const openMeetingDetails = async (meetingId: number) => {
    setRevealedPassword(null);
    try {
      const res = await api(`/partner/meetings/${meetingId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedMeeting(data);
        onMeetingViewed?.(meetingId);
      } else {
        showToast("error", "Unable to load session details");
      }
    } catch {
      showToast("error", "Network error retrieving details");
    }
  };

  const revealPassword = async (meetingId: number) => {
    setRevealingPassword(true);
    try {
      const res = await api(`/meetings/${meetingId}/password`);
      if (res.ok) {
        const data = await res.json();
        setRevealedPassword(data.password || "No passcode required");
        showToast("success", "Password decrypted and revealed");
      } else {
        showToast("error", "Failed to reveal meeting password");
      }
    } catch {
      showToast("error", "Network error decrypting password");
    } finally {
      setRevealingPassword(false);
    }
  };

  const handleRsvp = async (meetingId: number, status: "accepted" | "declined" | "tentative") => {
    setSubmittingRsvp(true);
    try {
      const res = await api(`/partner/meetings/${meetingId}/rsvp`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showToast("success", `RSVP marked as ${status}`);
        await loadMeetings();
        if (selectedMeeting?.id === meetingId) {
          await openMeetingDetails(meetingId);
        }
      } else {
        const data = await res.json();
        showToast("error", data.error || "Failed to update RSVP");
      }
    } catch {
      showToast("error", "Network error updating RSVP");
    } finally {
      setSubmittingRsvp(false);
    }
  };

  // Safe join url with visual processing feedback
  const joinMeetingUrl = (url?: string, meetingId?: number) => {
    if (!url) return;
    if (meetingId) {
      setJoiningMeetingId(meetingId);
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        showToast("error", "Invalid or unsafe meeting URL scheme");
        setJoiningMeetingId(null);
        return;
      }
      setTimeout(() => {
        window.open(parsed.href, "_blank", "noopener,noreferrer");
        setJoiningMeetingId(null);
      }, 400);
    } catch {
      showToast("error", "Invalid meeting link format");
      setJoiningMeetingId(null);
    }
  };

  // Subtab filtering & counts
  const { filteredMeetings, counts } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    let upcomingCount = 0;
    let todayCount = 0;
    let pastCount = 0;
    let allCount = meetings.length;

    for (const m of meetings) {
      const start = new Date(m.starts_at);
      const end = new Date(m.ends_at);
      const isCancelled = m.status === "cancelled" || m.status === "archived";

      if (start.toDateString() === todayStr && !isCancelled) {
        todayCount++;
      }
      if (start >= now && !isCancelled) {
        upcomingCount++;
      }
      if (end < now || m.status === "completed" || isCancelled) {
        pastCount++;
      }
    }

    const filtered = meetings.filter((m) => {
      const start = new Date(m.starts_at);
      const end = new Date(m.ends_at);
      const isCancelled = m.status === "cancelled" || m.status === "archived";

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = m.title?.toLowerCase().includes(q);
        const agendaMatch = m.agenda?.toLowerCase().includes(q);
        const locationMatch = m.location?.toLowerCase().includes(q);
        const projectMatch = m.project?.name?.toLowerCase().includes(q) || String(m.project_id).includes(q);
        if (!titleMatch && !agendaMatch && !locationMatch && !projectMatch) return false;
      }

      if (activeSubTab === "today") {
        return start.toDateString() === todayStr && !isCancelled;
      }
      if (activeSubTab === "upcoming") {
        return start >= now && !isCancelled;
      }
      if (activeSubTab === "past") {
        return end < now || m.status === "completed" || isCancelled;
      }
      return true;
    });

    return {
      filteredMeetings: filtered,
      counts: { upcoming: upcomingCount, today: todayCount, past: pastCount, all: allCount },
    };
  }, [meetings, activeSubTab, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center justify-center gap-3 text-sm font-bold transition-all ${
            toastMessage.type === "success"
              ? "bg-white text-emerald-800 border-emerald-200"
              : "bg-white text-red-800 border-red-200"
          }`}
        >
          {toastMessage.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Authorized Meetings</h2>
          <p className="text-xs text-slate-500 mt-1">
            Official operational reviews, project alignment sessions, and client campaign briefings scheduled by Thinkatic Administration.
          </p>
        </div>
        <button
          onClick={() => loadMeetings(true)}
          className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-300 transition-colors self-start sm:self-auto flex items-center justify-center"
          title="Refresh Meetings"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#214ECF]" : ""}`} />
        </button>
      </div>

      {/* Subtabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Subtabs */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: "upcoming", label: "Upcoming", count: counts.upcoming },
            { id: "today", label: "Today", count: counts.today },
            { id: "past", label: "Past & Completed", count: counts.past },
            { id: "all", label: "All Sessions", count: counts.all },
          ].map((sub) => (
            <button
              key={sub.id}
              onClick={() => setActiveSubTab(sub.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeSubTab === sub.id
                  ? "bg-[#214ECF] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{sub.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeSubTab === sub.id ? "bg-white/20 text-white" : "bg-white text-slate-700"
                }`}
              >
                {sub.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search meetings by title, agenda, project..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF] bg-white"
          />
        </div>
      </div>

      {/* Error state */}
      {loadError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <p className="text-sm font-bold text-rose-900">Unable to load meetings.</p>
          <button
            onClick={() => loadMeetings()}
            className="px-4 py-2 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-[#1b3fa8] transition shadow-xs inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Meeting Cards List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((skeletonIdx) => (
            <div key={skeletonIdx} className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="h-5 bg-slate-200 rounded-md w-1/3" />
                <div className="h-6 bg-slate-100 rounded-xl w-24" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 bg-slate-100 rounded-md w-1/4" />
                <div className="h-4 bg-slate-100 rounded-md w-1/4" />
              </div>
              <div className="h-3 bg-slate-100 rounded-md w-2/3" />
            </div>
          ))}
        </div>
      ) : !loadError && filteredMeetings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#214ECF] flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {meetings.length === 0
              ? "No meetings have been scheduled for your organization."
              : activeSubTab === "upcoming"
              ? "No scheduled sessions"
              : activeSubTab === "past"
              ? "No past meetings yet."
              : activeSubTab === "today"
              ? "No sessions scheduled for today."
              : "No scheduled sessions in this view"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {meetings.length === 0 || activeSubTab === "upcoming"
              ? "Thinkatic administration will schedule authorized meetings here."
              : "No meeting records found matching your filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMeetings.map((meeting) => {
            const isCancelled = meeting.status === "cancelled";
            const isCompleted = meeting.status === "completed";
            const myRsvp = meeting.userRsvp || "pending";
            const isJoining = joiningMeetingId === meeting.id;

            return (
              <div
                key={meeting.id}
                className={`rounded-2xl border bg-white p-5 transition-all shadow-2xs hover:shadow-md ${
                  isCancelled
                    ? "border-red-200 opacity-70"
                    : isCompleted
                    ? "border-slate-200"
                    : "border-slate-200 border-l-4 border-l-[#214ECF]"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-900 tracking-tight">{meeting.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {MEETING_TYPE_LABELS[meeting.meetingType || meeting.meeting_type] || meeting.meeting_type}
                      </span>
                      {meeting.hasPassword && (
                        <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Lock className="w-3 h-3 text-amber-600 shrink-0" /> Passcode Protected
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isCancelled
                            ? "bg-red-50 text-red-700"
                            : isCompleted
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-blue-50 text-[#214ECF]"
                        }`}
                      >
                        {meeting.status?.replaceAll("_", " ")}
                      </span>
                      {myRsvp !== "pending" && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            myRsvp === "accepted"
                              ? "bg-emerald-100 text-emerald-800"
                              : myRsvp === "declined"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          RSVP: {myRsvp}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center justify-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {new Date(meeting.starts_at).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="flex items-center justify-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {new Date(meeting.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                        {new Date(meeting.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (
                        {meeting.durationMinutes || 60}m) · {meeting.timezone}
                      </span>
                      {meeting.project_id && (
                        <span className="flex items-center justify-center gap-1.5 font-medium text-slate-700">
                          <FolderKanban className="w-3.5 h-3.5 text-[#214ECF] shrink-0" />
                          {meeting.project?.name ? meeting.project.name : `Project #${meeting.project_id}`}
                        </span>
                      )}
                    </div>

                    {meeting.agenda && (
                      <p className="text-xs text-slate-600 line-clamp-1 italic">
                        "{meeting.agenda}"
                      </p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {meeting.meeting_link && !isCancelled && (
                      <>
                        <button
                          disabled={isJoining}
                          onClick={() => joinMeetingUrl(meeting.meeting_link, meeting.id)}
                          className="px-4 py-2 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-70 cursor-pointer"
                        >
                          {isJoining ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                              <span>Opening Meeting...</span>
                            </>
                          ) : (
                            <>
                              <Video className="w-4 h-4 shrink-0" />
                              <span>Join Meeting</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(meeting.meeting_link, `partner-link-${meeting.id}`)}
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:border-slate-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          title="Copy Meeting Link"
                        >
                          {copyFeedback[`partner-link-${meeting.id}`] ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span className="hidden sm:inline">Copy Link</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => openMeetingDetails(meeting.id)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* DETAIL MODAL WITH PASSWORD REVEAL & RSVP */}
      {/* ======================================================== */}
      {selectedMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="rounded-3xl border border-slate-200 bg-white w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">{selectedMeeting.title}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-[#214ECF]">
                    {selectedMeeting.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Organizer: Thinkatic Administration · {selectedMeeting.timezone}
                </p>
              </div>
              <button
                onClick={() => setSelectedMeeting(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5 shrink-0" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Meeting Link & Passcode Access Card */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Virtual Room URL</p>
                    <p className="text-xs text-slate-600 font-mono mt-0.5 break-all">
                      {selectedMeeting.meeting_link || selectedMeeting.location || "No URL provided"}
                    </p>
                  </div>
                  {selectedMeeting.meeting_link && selectedMeeting.status !== "cancelled" && (
                    <div className="flex items-center gap-2">
                      <button
                        disabled={joiningMeetingId === selectedMeeting.id}
                        onClick={() => joinMeetingUrl(selectedMeeting.meeting_link, selectedMeeting.id)}
                        className="px-4 py-1.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-70"
                      >
                        {joiningMeetingId === selectedMeeting.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                            <span>Opening Meeting...</span>
                          </>
                        ) : (
                          <>
                            <Video className="w-3.5 h-3.5 shrink-0" />
                            <span>Join Meeting</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => copyToClipboard(selectedMeeting.meeting_link, "partner-detail-link")}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center cursor-pointer"
                      >
                        {copyFeedback["partner-detail-link"] ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 shrink-0" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Password Protection */}
                {selectedMeeting.has_password && (
                  <div className="pt-3 border-t border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-800">Password:</span>
                      <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-900 font-bold">
                        {revealedPassword || "••••••••••••"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!revealedPassword ? (
                        <button
                          onClick={() => revealPassword(selectedMeeting.id)}
                          disabled={revealingPassword}
                          className="px-3 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Unlock className="w-3.5 h-3.5 shrink-0" />
                          <span>{revealingPassword ? "Loading..." : "Reveal"}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => copyToClipboard(revealedPassword, "partner-pass")}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {copyFeedback["partner-pass"] ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                          <span>Copy Passcode</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* RSVP Actions Card */}
              {selectedMeeting.status !== "cancelled" && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">Attendance Confirmation (RSVP)</p>
                    {selectedMeeting.userRsvp && (
                      <span className="text-[11px] font-bold text-slate-500 uppercase">
                        Current: {selectedMeeting.userRsvp}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleRsvp(selectedMeeting.id, "accepted")}
                      disabled={submittingRsvp || selectedMeeting.userRsvp === "accepted"}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                        selectedMeeting.userRsvp === "accepted"
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-500 hover:text-emerald-700"
                      }`}
                    >
                      ✓ Accept
                    </button>
                    <button
                      onClick={() => handleRsvp(selectedMeeting.id, "tentative")}
                      disabled={submittingRsvp || selectedMeeting.userRsvp === "tentative"}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                        selectedMeeting.userRsvp === "tentative"
                          ? "bg-amber-600 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-amber-500 hover:text-amber-700"
                      }`}
                    >
                      ? Tentative
                    </button>
                    <button
                      onClick={() => handleRsvp(selectedMeeting.id, "declined")}
                      disabled={submittingRsvp || selectedMeeting.userRsvp === "declined"}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                        selectedMeeting.userRsvp === "declined"
                          ? "bg-red-600 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-red-500 hover:text-red-700"
                      }`}
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>
              )}

              {/* Schedule Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Date</p>
                  <p className="text-xs font-bold text-slate-800 mt-1">
                    {new Date(selectedMeeting.starts_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Time</p>
                  <p className="text-xs font-bold text-slate-800 mt-1">
                    {new Date(selectedMeeting.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {new Date(selectedMeeting.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Duration</p>
                  <p className="text-xs font-bold text-slate-800 mt-1">{selectedMeeting.durationMinutes || 60} minutes</p>
                </div>
              </div>

              {/* Project Scope */}
              {selectedMeeting.project_id && (
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FolderKanban className="w-4 h-4 text-[#214ECF] shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {selectedMeeting.project?.name || `Project #${selectedMeeting.project_id}`}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Campaign Status: {selectedMeeting.project?.status || "Active"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-[#214ECF]">
                    Project Specific
                  </span>
                </div>
              )}

              {/* Agenda */}
              {selectedMeeting.agenda && (
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
                  <p className="text-xs font-bold text-slate-900">Agenda & Topics</p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">{selectedMeeting.agenda}</p>
                </div>
              )}

              {/* Description */}
              {selectedMeeting.description && (
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
                  <p className="text-xs font-bold text-slate-900">Description</p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">{selectedMeeting.description}</p>
                </div>
              )}

              {/* Visible Notes */}
              {(selectedMeeting.notesList || []).filter((n: any) => n.client_visible).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-900">Meeting Notes</p>
                  {(selectedMeeting.notesList || [])
                    .filter((n: any) => n.client_visible)
                    .map((n: any) => (
                      <div key={n.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                        {n.body}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedMeeting(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors flex items-center justify-center cursor-pointer"
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
