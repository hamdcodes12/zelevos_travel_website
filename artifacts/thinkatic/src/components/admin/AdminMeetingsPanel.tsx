import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar,
  Clock,
  Video,
  Copy,
  Check,
  Search,
  Filter,
  Plus,
  Lock,
  Unlock,
  Users,
  Building2,
  Globe,
  FolderKanban,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Send,
  Trash2,
  Edit3,
  MoreVertical,
  X,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckSquare,
  FileText,
  UserCheck,
  Bell,
  Archive,
} from "lucide-react";

interface AdminMeetingsPanelProps {
  onOpenMeeting?: (meeting: any) => void;
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
  general_meeting: "General Alignment",
  planning: "Sprint Planning",
  review: "Deliverable Review",
  support: "Support Sync",
  other: "General Meeting",
};

export default function AdminMeetingsPanel({}: AdminMeetingsPanelProps) {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("auth_token") || "";

  // Data states
  const [meetings, setMeetings] = useState<any[]>([]);
  const [meetingRequests, setMeetingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipientsData, setRecipientsData] = useState<{
    clients: any[];
    bpoPartners: any[];
    projects: any[];
  }>({ clients: [], bpoPartners: [], projects: [] });

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");

  // Schedule / Edit Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [editingMeetingId, setEditingMeetingId] = useState<number | null>(null);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    meetingType: "client_meeting",
    startsAt: "",
    endsAt: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    meetingLink: "",
    meetingPassword: "",
    location: "",
    agenda: "",
    notes: "",
    audienceType: "client", // 'client' | 'clients' | 'all_clients' | 'bpo_partner' | 'bpo_partners' | 'all_bpo_partners' | 'everyone'
    targetClientIds: [] as string[],
    targetPartnerIds: [] as string[],
    scope: "general", // 'general' | 'project'
    projectId: "" as string | number,
    fromRequestId: null as number | null,
  });

  // Selected meeting detail drawer / modal
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealingPassword, setRevealingPassword] = useState(false);
  const [detailTab, setDetailTab] = useState<"details" | "notes" | "actions" | "activity">("details");

  // Meeting Notes form state
  const [noteBody, setNoteBody] = useState("");
  const [noteClientVisible, setNoteClientVisible] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // Action items form state
  const [actionTitle, setActionTitle] = useState("");
  const [actionDesc, setActionDesc] = useState("");
  const [actionAssignee, setActionAssignee] = useState("");
  const [actionDue, setActionDue] = useState("");
  const [actionPriority, setActionPriority] = useState("medium");
  const [savingAction, setSavingAction] = useState(false);

  // Cancellation modal
  const [cancelModalMeeting, setCancelModalMeeting] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // UI feedback states
  const [copyFeedback, setCopyFeedback] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);

  // Search filter for recipient picker in modal
  const [recipientSearch, setRecipientSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");

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

  // 1. Load initial data
  const loadRecipientsData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/meetings/recipients-data", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecipientsData({
          clients: data.clients || [],
          bpoPartners: data.bpoPartners || [],
          projects: data.projects || [],
        });
      }
    } catch (err) {
      console.error("Failed to load recipients data:", err);
    }
  }, [token]);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (audienceFilter !== "all") params.set("audience", audienceFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const [mRes, rRes] = await Promise.all([
        fetch(`/api/admin/meetings?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/meeting-requests", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (mRes.ok) {
        const mData = await mRes.json();
        setMeetings(Array.isArray(mData) ? mData : []);
      }
      if (rRes.ok) {
        const rData = await rRes.json();
        setMeetingRequests(Array.isArray(rData) ? rData : []);
      }
    } catch (err) {
      console.error("Failed to load meetings:", err);
      showToast("error", "Failed to load meetings data");
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, audienceFilter, searchQuery]);

  useEffect(() => {
    loadRecipientsData();
    loadMeetings();
  }, [loadRecipientsData, loadMeetings]);

  // Open single meeting details
  const openMeetingDetails = async (meetingId: number) => {
    try {
      setRevealedPassword(null);
      const res = await fetch(`/api/admin/meetings/${meetingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedMeeting(data);
      } else {
        showToast("error", "Unable to load meeting details");
      }
    } catch {
      showToast("error", "Network error loading meeting details");
    }
  };

  // Reveal meeting password
  const revealPassword = async (meetingId: number) => {
    setRevealingPassword(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/password`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRevealedPassword(data.password || "No password set");
        showToast("success", "Password decrypted and revealed");
      } else {
        showToast("error", "Failed to reveal meeting password");
      }
    } catch {
      showToast("error", "Network error retrieving password");
    } finally {
      setRevealingPassword(false);
    }
  };

  // Open Schedule Modal (New or Edit)
  const openScheduleModal = (meetingToEdit?: any, fromRequest?: any) => {
    setFormError("");
    setModalStep(1);
    setShowPassword(false);

    if (meetingToEdit) {
      setEditingMeetingId(meetingToEdit.id);
      const starts = meetingToEdit.starts_at ? new Date(meetingToEdit.starts_at).toISOString().slice(0, 16) : "";
      const ends = meetingToEdit.ends_at ? new Date(meetingToEdit.ends_at).toISOString().slice(0, 16) : "";

      let targetClientIds: string[] = [];
      let targetPartnerIds: string[] = [];
      try {
        if (meetingToEdit.description && meetingToEdit.description.startsWith("{")) {
          const meta = JSON.parse(meetingToEdit.description);
          targetClientIds = meta.targetClientIds || [];
          targetPartnerIds = meta.targetPartnerIds || [];
        }
      } catch {}

      if (targetClientIds.length === 0 && meetingToEdit.client_id) {
        targetClientIds = [meetingToEdit.client_id];
      }

      setFormData({
        title: meetingToEdit.title || "",
        meetingType: meetingToEdit.meetingType || meetingToEdit.meeting_type || "client_meeting",
        startsAt: starts,
        endsAt: ends,
        timezone: meetingToEdit.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        meetingLink: meetingToEdit.meeting_link || meetingToEdit.location || "",
        meetingPassword: "",
        location: meetingToEdit.location || "",
        agenda: meetingToEdit.agenda || "",
        notes: meetingToEdit.notes || "",
        audienceType: meetingToEdit.audience_type || meetingToEdit.audienceType || "client",
        targetClientIds,
        targetPartnerIds,
        scope: meetingToEdit.project_id ? "project" : "general",
        projectId: meetingToEdit.project_id || "",
        fromRequestId: null,
      });
    } else if (fromRequest) {
      setEditingMeetingId(null);
      const starts = fromRequest.preferred_starts_at ? new Date(fromRequest.preferred_starts_at).toISOString().slice(0, 16) : "";
      const ends = fromRequest.preferred_ends_at ? new Date(fromRequest.preferred_ends_at).toISOString().slice(0, 16) : "";

      setFormData({
        title: fromRequest.subject ? `Meeting: ${fromRequest.subject}` : "Client Discussion",
        meetingType: "client_meeting",
        startsAt: starts,
        endsAt: ends,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        meetingLink: "https://meet.google.com/new",
        meetingPassword: "",
        location: "",
        agenda: fromRequest.reason || "",
        notes: "Scheduled in response to client request",
        audienceType: "client",
        targetClientIds: fromRequest.client_id ? [fromRequest.client_id] : [],
        targetPartnerIds: [],
        scope: fromRequest.project_id ? "project" : "general",
        projectId: fromRequest.project_id || "",
        fromRequestId: fromRequest.id,
      });
    } else {
      // Default new meeting: set start to tomorrow 10:00 AM, end 11:00 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(11, 0, 0, 0);

      setEditingMeetingId(null);
      setFormData({
        title: "",
        meetingType: "client_meeting",
        startsAt: tomorrow.toISOString().slice(0, 16),
        endsAt: tomorrowEnd.toISOString().slice(0, 16),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        meetingLink: "https://meet.google.com/new",
        meetingPassword: "",
        location: "",
        agenda: "",
        notes: "",
        audienceType: "client",
        targetClientIds: recipientsData.clients.length > 0 ? [recipientsData.clients[0].id] : [],
        targetPartnerIds: [],
        scope: "general",
        projectId: "",
        fromRequestId: null,
      });
    }

    setModalOpen(true);
  };

  // Submit Meeting Form
  const handleSubmitMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Validations
    if (!formData.title.trim()) {
      setFormError("Meeting title is required.");
      setModalStep(1);
      return;
    }
    if (!formData.startsAt || !formData.endsAt) {
      setFormError("Valid start and end times are required.");
      setModalStep(1);
      return;
    }
    if (new Date(formData.endsAt) <= new Date(formData.startsAt)) {
      setFormError("End time must be strictly after start time.");
      setModalStep(1);
      return;
    }

    // Audience targeting validation
    if (formData.audienceType === "client" && formData.targetClientIds.length === 0) {
      setFormError("Please select a target client.");
      setModalStep(2);
      return;
    }
    if (formData.audienceType === "clients" && formData.targetClientIds.length === 0) {
      setFormError("Please select at least one client.");
      setModalStep(2);
      return;
    }
    if (formData.audienceType === "bpo_partner" && formData.targetPartnerIds.length === 0) {
      setFormError("Please select a target BPO partner.");
      setModalStep(2);
      return;
    }
    if (formData.audienceType === "bpo_partners" && formData.targetPartnerIds.length === 0) {
      setFormError("Please select at least one BPO partner.");
      setModalStep(2);
      return;
    }

    // Project scope validation
    if (formData.scope === "project" && !formData.projectId) {
      setFormError("Please choose a target project for project-specific meetings.");
      setModalStep(3);
      return;
    }

    setSavingMeeting(true);

    try {
      const payload: Record<string, any> = {
        title: formData.title.trim(),
        meetingType: formData.meetingType,
        startsAt: new Date(formData.startsAt).toISOString(),
        endsAt: new Date(formData.endsAt).toISOString(),
        timezone: formData.timezone,
        meetingLink: formData.meetingLink.trim(),
        location: formData.location.trim() || formData.meetingLink.trim(),
        agenda: formData.agenda.trim(),
        notes: formData.notes.trim(),
        audienceType: formData.audienceType,
        targetClientIds: formData.targetClientIds,
        targetPartnerIds: formData.targetPartnerIds,
        scope: formData.scope,
        projectId: formData.scope === "project" && formData.projectId ? Number(formData.projectId) : undefined,
        fromRequestId: formData.fromRequestId || undefined,
      };

      if (formData.meetingPassword.trim()) {
        payload.meetingPassword = formData.meetingPassword.trim();
      }

      let res: Response;
      if (editingMeetingId) {
        res = await fetch(`/api/admin/meetings/${editingMeetingId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/meetings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || data.message || "Failed to save meeting");
        return;
      }

      showToast("success", editingMeetingId ? "Meeting updated successfully" : "Meeting scheduled and invitations dispatched!");
      setModalOpen(false);
      await loadMeetings();
      if (editingMeetingId && selectedMeeting?.id === editingMeetingId) {
        await openMeetingDetails(editingMeetingId);
      }
    } catch (err: any) {
      setFormError(err.message || "Network error saving meeting");
    } finally {
      setSavingMeeting(false);
    }
  };

  // Resend notifications
  const handleResendNotifications = async (meetingId: number) => {
    setResendingId(meetingId);
    try {
      const res = await fetch(`/api/admin/meetings/${meetingId}/resend-notifications`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", `Notifications resent to ${data.notifiedCount || 0} participants!`);
      } else {
        showToast("error", data.error || "Failed to resend notifications");
      }
    } catch {
      showToast("error", "Network error resending notifications");
    } finally {
      setResendingId(null);
    }
  };

  // Cancel Meeting
  const handleCancelMeeting = async () => {
    if (!cancelModalMeeting) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/admin/meetings/${cancelModalMeeting.id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason || "Cancelled by Administrator" }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Meeting cancelled and participants notified");
        setCancelModalMeeting(null);
        setCancelReason("");
        await loadMeetings();
        if (selectedMeeting?.id === cancelModalMeeting.id) {
          await openMeetingDetails(cancelModalMeeting.id);
        }
      } else {
        showToast("error", data.error || "Failed to cancel meeting");
      }
    } catch {
      showToast("error", "Network error cancelling meeting");
    } finally {
      setCancelling(false);
    }
  };

  // Archive Meeting
  const handleArchiveMeeting = async (meetingId: number) => {
    if (!window.confirm("Archive this meeting? Archived meetings remain saved in your records.")) return;
    try {
      const res = await fetch(`/api/admin/meetings/${meetingId}/archive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("success", "Meeting archived");
        await loadMeetings();
        if (selectedMeeting?.id === meetingId) {
          setSelectedMeeting(null);
        }
      } else {
        showToast("error", "Failed to archive meeting");
      }
    } catch {
      showToast("error", "Network error archiving meeting");
    }
  };

  // Add Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting || !noteBody.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/admin/meetings/${selectedMeeting.id}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          body: noteBody.trim(),
          noteType: "summary",
          clientVisible: noteClientVisible,
        }),
      });
      if (res.ok) {
        setNoteBody("");
        setNoteClientVisible(false);
        showToast("success", "Meeting note added");
        await openMeetingDetails(selectedMeeting.id);
      } else {
        showToast("error", "Failed to add meeting note");
      }
    } catch {
      showToast("error", "Network error adding note");
    } finally {
      setSavingNote(false);
    }
  };

  // Add Action Item
  const handleAddActionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting || !actionTitle.trim()) return;
    setSavingAction(true);
    try {
      const res = await fetch(`/api/admin/meetings/${selectedMeeting.id}/action-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: actionTitle.trim(),
          description: actionDesc.trim() || undefined,
          priority: actionPriority,
          assignedUserId: actionAssignee.trim() || undefined,
          dueDate: actionDue || undefined,
          projectId: selectedMeeting.project_id || undefined,
        }),
      });
      if (res.ok) {
        setActionTitle("");
        setActionDesc("");
        setActionAssignee("");
        setActionDue("");
        setActionPriority("medium");
        showToast("success", "Action item added");
        await openMeetingDetails(selectedMeeting.id);
      } else {
        showToast("error", "Failed to add action item");
      }
    } catch {
      showToast("error", "Network error adding action item");
    } finally {
      setSavingAction(false);
    }
  };

  // Filtered clients & partners for modal picker
  const filteredModalClients = useMemo(() => {
    const q = recipientSearch.toLowerCase().trim();
    if (!q) return recipientsData.clients;
    return recipientsData.clients.filter(
      (c) =>
        (c.full_name && c.full_name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.id && c.id.toLowerCase().includes(q))
    );
  }, [recipientsData.clients, recipientSearch]);

  const filteredModalPartners = useMemo(() => {
    const q = recipientSearch.toLowerCase().trim();
    if (!q) return recipientsData.bpoPartners;
    return recipientsData.bpoPartners.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.partner_code && p.partner_code.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q))
    );
  }, [recipientsData.bpoPartners, recipientSearch]);

  const filteredModalProjects = useMemo(() => {
    const q = projectSearch.toLowerCase().trim();
    if (!q) return recipientsData.projects;
    return recipientsData.projects.filter(
      (p) => (p.name && p.name.toLowerCase().includes(q)) || String(p.id).includes(q)
    );
  }, [recipientsData.projects, projectSearch]);

  // Meeting Metrics Counters
  const metrics = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    let total = meetings.length;
    let scheduled = 0;
    let today = 0;
    let past = 0;
    let cancelled = 0;

    for (const m of meetings) {
      if (["cancelled", "archived"].includes(m.status)) {
        cancelled++;
      } else {
        const start = new Date(m.starts_at);
        if (start.toDateString() === todayStr) {
          today++;
        }
        if (start > now) {
          scheduled++;
        } else {
          past++;
        }
      }
    }

    return { total, scheduled, today, past, cancelled };
  }, [meetings]);

  // Recipient Audience Badges generator
  const renderAudienceBadge = (meeting: any) => {
    const aud = meeting.audience_type || meeting.audienceType || "client";
    const partnerCount = (meeting.bpo_partners || []).length;
    const participantCount = (meeting.participants || []).length;

    if (aud === "all_bpo_partners") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#214ECF] border border-blue-200">
          <Building2 className="w-3.5 h-3.5" /> All BPO Partners ({recipientsData.bpoPartners.length})
        </span>
      );
    }
    if (aud === "all_clients") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Users className="w-3.5 h-3.5" /> All Clients ({recipientsData.clients.length})
        </span>
      );
    }
    if (aud === "everyone") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <Globe className="w-3.5 h-3.5" /> Everyone / All Authorized
        </span>
      );
    }
    if (aud === "bpo_partner" || aud === "bpo_partners") {
      const partnerName = meeting.bpo_partners?.[0]?.name || "BPO Partner";
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
          <Building2 className="w-3.5 h-3.5" /> {partnerCount > 1 ? `${partnerCount} BPO Partners` : partnerName}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <Users className="w-3.5 h-3.5" /> {participantCount > 1 ? `${participantCount} Participants` : "Client Meeting"}
      </span>
    );
  };

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
          {toastMessage.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header & Primary Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Meetings Master Centre</h2>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative scheduling and multi-tenant dispatch for Clients, BPO Partners, and Enterprise Project teams.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadMeetings()}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-300 transition-colors"
            title="Refresh Meetings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#214ECF]" : ""}`} />
          </button>
          <button
            onClick={() => openScheduleModal()}
            className="px-4 py-2.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Schedule Meeting
          </button>
        </div>
      </div>

      {/* Metric Counters Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Meetings</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Upcoming</p>
          <p className="text-2xl font-black text-[#214ECF] mt-1">{metrics.scheduled}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Today's Sessions</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{metrics.today}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completed</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{metrics.past}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cancelled / Archived</p>
          <p className="text-2xl font-black text-slate-400 mt-1">{metrics.cancelled}</p>
        </div>
      </div>

      {/* Pending Client Requests Section */}
      {meetingRequests.filter((r) => r.status === "requested").length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-900">
                Action Required: Pending Client Requests ({meetingRequests.filter((r) => r.status === "requested").length})
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {meetingRequests
              .filter((r) => r.status === "requested")
              .map((req) => (
                <div key={req.id} className="rounded-xl border border-amber-200 bg-white p-3.5 flex flex-col justify-between gap-3 shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{req.subject}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{req.reason || "No detailed reason provided."}</p>
                    <p className="text-[11px] text-slate-400 mt-2 font-mono">
                      📅 {new Date(req.preferred_starts_at).toLocaleString()} · Client {req.client_id?.slice(0, 8)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => openScheduleModal(undefined, req)}
                      className="px-3 py-1.5 rounded-lg bg-[#214ECF] text-white text-[11px] font-bold hover:bg-blue-700 transition-colors"
                    >
                      Schedule Session
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`/api/admin/meeting-requests/${req.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ status: "rejected", reviewNotes: "Declined by admin" }),
                        });
                        loadMeetings();
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search meetings by title, agenda, location, or recipient..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#214ECF]"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>

            {/* Audience Filter */}
            <select
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#214ECF]"
            >
              <option value="all">All Audiences</option>
              <option value="client">Client Only</option>
              <option value="bpo_partner">BPO Partners Only</option>
              <option value="everyone">Everyone</option>
            </select>
          </div>
        </div>
      </div>

      {/* Meetings List / Cards */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#214ECF]" />
          Loading scheduled sessions...
        </div>
      ) : meetings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No meetings match your filter</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Get started by scheduling a meeting for a specific client, a BPO partner, or broadcasting to all stakeholders.
          </p>
          <button
            onClick={() => openScheduleModal()}
            className="px-4 py-2 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-colors"
          >
            Schedule First Meeting
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => {
            const isCancelled = meeting.status === "cancelled";
            const isCompleted = meeting.status === "completed";
            const isScheduled = meeting.status === "scheduled" || meeting.status === "confirmed";

            return (
              <div
                key={meeting.id}
                className={`rounded-2xl border bg-white p-5 transition-all shadow-2xs hover:shadow-md ${
                  selectedMeeting?.id === meeting.id
                    ? "border-[#214ECF] ring-2 ring-[#214ECF]/10"
                    : isCancelled
                    ? "border-red-200 opacity-75"
                    : isCompleted
                    ? "border-slate-200"
                    : "border-slate-200 border-l-4 border-l-[#214ECF]"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Info & Badges */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900 tracking-tight">{meeting.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {MEETING_TYPE_LABELS[meeting.meetingType || meeting.meeting_type] || meeting.meeting_type}
                      </span>
                      {renderAudienceBadge(meeting)}
                      {meeting.hasPassword && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Lock className="w-3 h-3 text-amber-600" /> Password Protected
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
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(meeting.starts_at).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(meeting.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                        {new Date(meeting.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (
                        {meeting.durationMinutes || 60}m)
                      </span>
                      {meeting.scope === "project" && meeting.project_id && (
                        <span className="flex items-center gap-1.5 font-medium text-slate-700">
                          <FolderKanban className="w-3.5 h-3.5 text-[#214ECF]" />
                          Project #{meeting.project_id}
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
                        <a
                          href={meeting.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                          <Video className="w-3.5 h-3.5" /> Join
                        </a>
                        <button
                          onClick={() => copyToClipboard(meeting.meeting_link, `link-${meeting.id}`)}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:border-slate-300 transition-colors flex items-center gap-1"
                          title="Copy Meeting Link"
                        >
                          {copyFeedback[`link-${meeting.id}`] ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span className="hidden sm:inline">Copy Link</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => openMeetingDetails(meeting.id)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                    >
                      View Details
                    </button>

                    <button
                      onClick={() => openScheduleModal(meeting)}
                      disabled={isCancelled || isCompleted}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                      title="Edit Meeting"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleResendNotifications(meeting.id)}
                      disabled={isCancelled || isCompleted || resendingId === meeting.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 transition-colors"
                      title="Resend Invitations & Reminder"
                    >
                      <Send className={`w-4 h-4 ${resendingId === meeting.id ? "animate-spin text-[#214ECF]" : ""}`} />
                    </button>

                    {!isCancelled && !isCompleted && (
                      <button
                        onClick={() => {
                          setCancelModalMeeting(meeting);
                          setCancelReason("");
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Cancel Meeting"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}

                    {isCompleted && (
                      <button
                        onClick={() => handleArchiveMeeting(meeting.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="Archive Meeting"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. SCHEDULE / EDIT MEETING MULTI-STEP MODAL */}
      {/* ======================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="rounded-3xl border border-slate-200 bg-white w-full max-w-2xl shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingMeetingId ? "Edit Meeting Session" : "Schedule New Meeting"}
                </h3>
                <p className="text-xs text-slate-500">
                  Step {modalStep} of 3 —{" "}
                  {modalStep === 1
                    ? "Basic Session Info"
                    : modalStep === 2
                    ? "Audience & Recipient Targeting"
                    : "Project Scope"}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setModalStep(1)}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  modalStep === 1 ? "border-[#214ECF] text-[#214ECF] bg-white" : "border-transparent"
                }`}
              >
                1. Info & Link
              </button>
              <button
                type="button"
                onClick={() => setModalStep(2)}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  modalStep === 2 ? "border-[#214ECF] text-[#214ECF] bg-white" : "border-transparent"
                }`}
              >
                2. Target Audience
              </button>
              <button
                type="button"
                onClick={() => setModalStep(3)}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  modalStep === 3 ? "border-[#214ECF] text-[#214ECF] bg-white" : "border-transparent"
                }`}
              >
                3. Project Scope
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmitMeeting} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* STEP 1: Basic Session Info */}
              {modalStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Meeting Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g. Weekly Campaign Alignment Sync"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Meeting Type</label>
                      <select
                        value={formData.meetingType}
                        onChange={(e) => setFormData((prev) => ({ ...prev, meetingType: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:border-[#214ECF]"
                      >
                        <option value="client_meeting">Client Meeting</option>
                        <option value="bpo_partner_meeting">BPO Partner Sync</option>
                        <option value="operations_meeting">Operations Review</option>
                        <option value="project_meeting">Project Meeting</option>
                        <option value="requirement_discussion">Requirement Discussion</option>
                        <option value="demo">Platform Demo</option>
                        <option value="uat">UAT Walkthrough</option>
                        <option value="training">Agent Training</option>
                        <option value="general_meeting">General Alignment</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Timezone</label>
                      <input
                        type="text"
                        value={formData.timezone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, timezone: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Starts At <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="datetime-local"
                        value={formData.startsAt}
                        onChange={(e) => setFormData((prev) => ({ ...prev, startsAt: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Ends At <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="datetime-local"
                        value={formData.endsAt}
                        onChange={(e) => setFormData((prev) => ({ ...prev, endsAt: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Meeting Link (Google Meet / Zoom / Teams)</label>
                    <div className="relative">
                      <Video className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="url"
                        value={formData.meetingLink}
                        onChange={(e) => setFormData((prev) => ({ ...prev, meetingLink: e.target.value }))}
                        placeholder="https://meet.google.com/xxx-yyyy-zzz"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Meeting Password (AES-256-GCM Encrypted at rest)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.meetingPassword}
                        onChange={(e) => setFormData((prev) => ({ ...prev, meetingPassword: e.target.value }))}
                        placeholder={editingMeetingId ? "(Leave empty to keep existing password)" : "Optional access passcode"}
                        className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Passcodes are never exposed in public responses; authorized participants reveal them on demand.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Agenda & Session Goals</label>
                    <textarea
                      rows={2}
                      value={formData.agenda}
                      onChange={(e) => setFormData((prev) => ({ ...prev, agenda: e.target.value }))}
                      placeholder="Outline topics, objectives, and discussion points..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Internal Admin Notes</label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Private notes (confidentiality, preparation requirements)..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Audience & Recipient Targeting */}
              {modalStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Who is this meeting for?</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { id: "client", label: "Selected Client", desc: "Target a specific enterprise client" },
                        { id: "clients", label: "Multiple Clients", desc: "Select specific client profiles" },
                        { id: "all_clients", label: `All Clients (${recipientsData.clients.length})`, desc: "Dispatch to all active client accounts" },
                        { id: "bpo_partner", label: "Selected BPO Partner", desc: "Target a single authorized partner" },
                        { id: "bpo_partners", label: "Multiple BPO Partners", desc: "Select several BPO partners" },
                        { id: "all_bpo_partners", label: `All BPO Partners (${recipientsData.bpoPartners.length})`, desc: "Dispatch to all verified partners" },
                        { id: "everyone", label: "Everyone / All Stakeholders", desc: "Broadcast across both Clients and Partners" },
                      ].map((item) => (
                        <label
                          key={item.id}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                            formData.audienceType === item.id
                              ? "border-[#214ECF] bg-blue-50/40 ring-1 ring-[#214ECF]"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="audienceType"
                            value={item.id}
                            checked={formData.audienceType === item.id}
                            onChange={() => setFormData((prev) => ({ ...prev, audienceType: item.id }))}
                            className="mt-0.5 text-[#214ECF] focus:ring-[#214ECF]"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{item.label}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{item.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Recipient Picker if targeting specific Client(s) */}
                  {(formData.audienceType === "client" || formData.audienceType === "clients") && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">
                          {formData.audienceType === "client" ? "Select Target Client" : "Select Target Clients"}
                        </label>
                        <span className="text-[10px] font-bold text-[#214ECF]">
                          {formData.targetClientIds.length} selected
                        </span>
                      </div>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={recipientSearch}
                          onChange={(e) => setRecipientSearch(e.target.value)}
                          placeholder="Filter clients by name or email..."
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 p-2 bg-slate-50/50">
                        {filteredModalClients.map((client) => {
                          const isSelected = formData.targetClientIds.includes(client.id);
                          return (
                            <div
                              key={client.id}
                              onClick={() => {
                                if (formData.audienceType === "client") {
                                  setFormData((prev) => ({ ...prev, targetClientIds: [client.id] }));
                                } else {
                                  setFormData((prev) => ({
                                    ...prev,
                                    targetClientIds: isSelected
                                      ? prev.targetClientIds.filter((id) => id !== client.id)
                                      : [...prev.targetClientIds, client.id],
                                  }));
                                }
                              }}
                              className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors text-xs ${
                                isSelected ? "bg-[#214ECF] text-white" : "hover:bg-white text-slate-800"
                              }`}
                            >
                              <div>
                                <p className="font-semibold">{client.full_name || "Client"}</p>
                                <p className={`text-[10px] font-mono ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                                  {client.email} · {client.id.slice(0, 8)}...
                                </p>
                              </div>
                              {isSelected && <Check className="w-4 h-4 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Recipient Picker if targeting specific Partner(s) */}
                  {(formData.audienceType === "bpo_partner" || formData.audienceType === "bpo_partners") && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">
                          {formData.audienceType === "bpo_partner" ? "Select Target BPO Partner" : "Select Target BPO Partners"}
                        </label>
                        <span className="text-[10px] font-bold text-[#214ECF]">
                          {formData.targetPartnerIds.length} selected
                        </span>
                      </div>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={recipientSearch}
                          onChange={(e) => setRecipientSearch(e.target.value)}
                          placeholder="Filter partners by name or code..."
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 p-2 bg-slate-50/50">
                        {filteredModalPartners.map((partner) => {
                          const isSelected = formData.targetPartnerIds.includes(partner.id);
                          return (
                            <div
                              key={partner.id}
                              onClick={() => {
                                if (formData.audienceType === "bpo_partner") {
                                  setFormData((prev) => ({ ...prev, targetPartnerIds: [partner.id] }));
                                } else {
                                  setFormData((prev) => ({
                                    ...prev,
                                    targetPartnerIds: isSelected
                                      ? prev.targetPartnerIds.filter((id) => id !== partner.id)
                                      : [...prev.targetPartnerIds, partner.id],
                                  }));
                                }
                              }}
                              className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors text-xs ${
                                isSelected ? "bg-[#214ECF] text-white" : "hover:bg-white text-slate-800"
                              }`}
                            >
                              <div>
                                <p className="font-semibold">{partner.name}</p>
                                <p className={`text-[10px] font-mono ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                                  {partner.partner_code} · {partner.status}
                                </p>
                              </div>
                              {isSelected && <Check className="w-4 h-4 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Broadcast Banner Confirmation */}
                  {(formData.audienceType === "all_clients" ||
                    formData.audienceType === "all_bpo_partners" ||
                    formData.audienceType === "everyone") && (
                    <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3">
                      <Globe className="w-5 h-5 text-[#214ECF] shrink-0" />
                      <div className="text-xs text-slate-700">
                        <p className="font-bold text-slate-900">Broadcasting session invitations</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {formData.audienceType === "all_clients"
                            ? `This meeting will be accessible by all ${recipientsData.clients.length} active client profiles.`
                            : formData.audienceType === "all_bpo_partners"
                            ? `This meeting will be linked to all ${recipientsData.bpoPartners.length} active BPO partner accounts.`
                            : `This meeting will be visible across both all clients (${recipientsData.clients.length}) and all BPO partners (${recipientsData.bpoPartners.length}).`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Project Scope */}
              {modalStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Session Project Scope</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          formData.scope === "general"
                            ? "border-[#214ECF] bg-blue-50/40 ring-1 ring-[#214ECF]"
                            : "border-slate-200 bg-white hover:border-blue-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="scope"
                          value="general"
                          checked={formData.scope === "general"}
                          onChange={() => setFormData((prev) => ({ ...prev, scope: "general" }))}
                          className="mt-0.5 text-[#214ECF]"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">General Meeting</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Not tied to a specific project. Perfect for corporate alignment, onboarding, or platform demos.
                          </p>
                        </div>
                      </label>

                      <label
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          formData.scope === "project"
                            ? "border-[#214ECF] bg-blue-50/40 ring-1 ring-[#214ECF]"
                            : "border-slate-200 bg-white hover:border-blue-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="scope"
                          value="project"
                          checked={formData.scope === "project"}
                          onChange={() => setFormData((prev) => ({ ...prev, scope: "project" }))}
                          className="mt-0.5 text-[#214ECF]"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">Project-Specific Meeting</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Directly linked to an active client project, campaign deliverables, or SLA milestone.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {formData.scope === "project" && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">Select Linked Project</label>
                        {formData.projectId && (
                          <span className="text-[10px] font-bold text-[#214ECF]">
                            Project #{formData.projectId} Selected
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={projectSearch}
                          onChange={(e) => setProjectSearch(e.target.value)}
                          placeholder="Search projects by name or ID..."
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 p-2 bg-slate-50/50">
                        {filteredModalProjects.map((project) => {
                          const isSelected = String(formData.projectId) === String(project.id);
                          return (
                            <div
                              key={project.id}
                              onClick={() => setFormData((prev) => ({ ...prev, projectId: project.id }))}
                              className={`p-2.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors text-xs ${
                                isSelected ? "bg-[#214ECF] text-white" : "hover:bg-white text-slate-800"
                              }`}
                            >
                              <div>
                                <p className="font-semibold">
                                  #{project.id} · {project.name}
                                </p>
                                <p className={`text-[10px] ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                                  Client: {project.client_id?.slice(0, 8)}... · Status: {project.status}
                                </p>
                              </div>
                              {isSelected && <Check className="w-4 h-4 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Navigation Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  {modalStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setModalStep((s) => (s - 1) as any)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                    >
                      Back
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-500 text-xs font-bold hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  {modalStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => setModalStep((s) => (s + 1) as any)}
                      className="px-4 py-2 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                    >
                      Next Step <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={savingMeeting}
                      className="px-5 py-2 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md flex items-center gap-2"
                    >
                      {savingMeeting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {editingMeetingId ? "Save Changes" : "Schedule & Dispatch"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MEETING DETAIL DRAWER / MODAL */}
      {/* ======================================================== */}
      {selectedMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="rounded-3xl border border-slate-200 bg-white w-full max-w-3xl shadow-2xl overflow-hidden my-8">
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
                  ID #{selectedMeeting.id} · Created {new Date(selectedMeeting.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedMeeting(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subtabs */}
            <div className="flex border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-600">
              <button
                onClick={() => setDetailTab("details")}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  detailTab === "details" ? "border-[#214ECF] text-[#214ECF] bg-white" : "border-transparent"
                }`}
              >
                Overview & Access
              </button>
              <button
                onClick={() => setDetailTab("notes")}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  detailTab === "notes" ? "border-[#214ECF] text-[#214ECF] bg-white" : "border-transparent"
                }`}
              >
                Notes ({(selectedMeeting.notesList || []).length})
              </button>
              <button
                onClick={() => setDetailTab("actions")}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  detailTab === "actions" ? "border-[#214ECF] text-[#214ECF] bg-white" : "border-transparent"
                }`}
              >
                Action Items ({(selectedMeeting.action_items || []).length})
              </button>
              <button
                onClick={() => setDetailTab("activity")}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  detailTab === "activity" ? "border-[#214ECF] text-[#214ECF] bg-white" : "border-transparent"
                }`}
              >
                Audit Log ({(selectedMeeting.activity || []).length})
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {detailTab === "details" && (
                <div className="space-y-4">
                  {/* Join Link & Password Card */}
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Live Session Link</p>
                        <p className="text-xs text-slate-600 font-mono mt-0.5 break-all">
                          {selectedMeeting.meeting_link || selectedMeeting.location || "No URL provided"}
                        </p>
                      </div>
                      {selectedMeeting.meeting_link && (
                        <div className="flex items-center gap-2">
                          <a
                            href={selectedMeeting.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-2xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Join Room
                          </a>
                          <button
                            onClick={() => copyToClipboard(selectedMeeting.meeting_link, "detail-link")}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                          >
                            {copyFeedback["detail-link"] ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Password Reveal Section */}
                    {selectedMeeting.has_password && (
                      <div className="pt-3 border-t border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-bold text-slate-800">Meeting Password:</span>
                          <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-900 font-bold">
                            {revealedPassword || (selectedMeeting.password ? selectedMeeting.password : "••••••••••••")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!revealedPassword && !selectedMeeting.password && (
                            <button
                              onClick={() => revealPassword(selectedMeeting.id)}
                              disabled={revealingPassword}
                              className="px-3 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1"
                            >
                              <Unlock className="w-3.5 h-3.5" /> {revealingPassword ? "Decrypting..." : "Reveal Password"}
                            </button>
                          )}
                          {(revealedPassword || selectedMeeting.password) && (
                            <button
                              onClick={() => copyToClipboard(revealedPassword || selectedMeeting.password, "detail-pass")}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1"
                            >
                              {copyFeedback["detail-pass"] ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              Copy
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Date</p>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        {new Date(selectedMeeting.starts_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Duration</p>
                      <p className="text-xs font-bold text-slate-800 mt-1">{selectedMeeting.durationMinutes || 60} mins</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Audience</p>
                      <p className="text-xs font-bold text-slate-800 mt-1">{selectedMeeting.audience_type || "Client"}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Scope</p>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        {selectedMeeting.project_id ? `Project #${selectedMeeting.project_id}` : "General"}
                      </p>
                    </div>
                  </div>

                  {/* Agenda */}
                  {selectedMeeting.agenda && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                      <p className="text-xs font-bold text-slate-900 mb-1">Agenda</p>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap">{selectedMeeting.agenda}</p>
                    </div>
                  )}

                  {/* Notes / Internal */}
                  {selectedMeeting.notes && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                      <p className="text-xs font-bold text-slate-900 mb-1">Admin Internal Notes</p>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap">{selectedMeeting.notes}</p>
                    </div>
                  )}

                  {/* Participants & RSVP table */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Authorized Participants & Recipients
                    </h4>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                          <tr>
                            <th className="p-2.5">Participant</th>
                            <th className="p-2.5">Role</th>
                            <th className="p-2.5">RSVP Status</th>
                            <th className="p-2.5">Responded</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(selectedMeeting.participants || []).map((p: any) => (
                            <tr key={p.id}>
                              <td className="p-2.5 font-mono text-[11px]">
                                {p.user_id ? `User ${p.user_id.slice(0, 8)}...` : `Admin #${p.admin_id}`}
                              </td>
                              <td className="p-2.5 capitalize">{p.participant_role}</td>
                              <td className="p-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    p.rsvp_status === "accepted"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : p.rsvp_status === "declined"
                                      ? "bg-red-50 text-red-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {p.rsvp_status}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-400 text-[10px]">
                                {p.responded_at ? new Date(p.responded_at).toLocaleString() : "Pending"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* NOTES TAB */}
              {detailTab === "notes" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {(selectedMeeting.notesList || []).length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No notes recorded yet.</p>
                    ) : (
                      (selectedMeeting.notesList || []).map((note: any) => (
                        <div key={note.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {note.note_type}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                note.client_visible ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {note.client_visible ? "Client Visible" : "Internal Only"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 whitespace-pre-wrap">{note.body}</p>
                          <p className="text-[10px] text-slate-400">{new Date(note.created_at).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add note form */}
                  <form onSubmit={handleAddNote} className="space-y-2 pt-3 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700">Add Session Note</label>
                    <textarea
                      required
                      rows={2}
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      placeholder="Add summary note or key takeaway..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={noteClientVisible}
                          onChange={(e) => setNoteClientVisible(e.target.checked)}
                          className="rounded text-[#214ECF] focus:ring-[#214ECF]"
                        />
                        <span>Visible to client</span>
                      </label>
                      <button
                        type="submit"
                        disabled={savingNote || !noteBody.trim()}
                        className="px-3 py-1.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {savingNote ? "Saving..." : "Add Note"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ACTION ITEMS TAB */}
              {detailTab === "actions" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {(selectedMeeting.action_items || []).length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No action items recorded.</p>
                    ) : (
                      (selectedMeeting.action_items || []).map((action: any) => (
                        <div
                          key={action.id}
                          className="rounded-xl border border-slate-200 bg-white p-3 flex items-start justify-between gap-3"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-900">{action.title}</p>
                            {action.description && <p className="text-xs text-slate-600 mt-0.5">{action.description}</p>}
                            <p className="text-[10px] text-slate-400 mt-1 font-mono">
                              Priority: {action.priority} · Due: {action.due_date || "Not set"}
                            </p>
                          </div>
                          <select
                            value={action.status}
                            onChange={async (e) => {
                              await fetch(`/api/admin/action-items/${action.id}`, {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ status: e.target.value }),
                              });
                              openMeetingDetails(selectedMeeting.id);
                            }}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add action item form */}
                  <form onSubmit={handleAddActionItem} className="space-y-3 pt-3 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700">New Action Item</label>
                    <input
                      required
                      type="text"
                      value={actionTitle}
                      onChange={(e) => setActionTitle(e.target.value)}
                      placeholder="Task or deliverable title..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={actionPriority}
                        onChange={(e) => setActionPriority(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium"
                      >
                        <option value="low">Low Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="high">High Priority</option>
                        <option value="critical">Critical</option>
                      </select>
                      <input
                        type="date"
                        value={actionDue}
                        onChange={(e) => setActionDue(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingAction || !actionTitle.trim()}
                      className="px-3 py-1.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {savingAction ? "Saving..." : "Add Action Item"}
                    </button>
                  </form>
                </div>
              )}

              {/* AUDIT LOG TAB */}
              {detailTab === "activity" && (
                <div className="space-y-2">
                  {(selectedMeeting.activity || []).length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No audit logs recorded for this meeting.</p>
                  ) : (
                    (selectedMeeting.activity || []).map((entry: any) => (
                      <div key={entry.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-mono text-[#214ECF] font-bold">{entry.action.replaceAll("_", " ")}</span>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            By {entry.actor_admin_id ? `Admin #${entry.actor_admin_id}` : entry.actor_user_id ? `User ${entry.actor_user_id.slice(0, 8)}...` : "System"}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. CANCELLATION MODAL */}
      {/* ======================================================== */}
      {cancelModalMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="rounded-3xl border border-slate-200 bg-white w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Cancel Meeting</h3>
                <p className="text-xs text-slate-500">Participants will receive a cancellation notice.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium">
              Are you sure you want to cancel <span className="font-bold">"{cancelModalMeeting.title}"</span>?
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cancellation Reason</label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Schedule conflict, client request, or rescheduled..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalMeeting(null)}
                className="px-4 py-2 rounded-xl text-slate-500 text-xs font-bold hover:text-slate-800 transition-colors"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleCancelMeeting}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors shadow-md flex items-center gap-2"
              >
                {cancelling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
