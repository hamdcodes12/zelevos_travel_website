import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  MessageSquareText,
  Search,
  Filter,
  Paperclip,
  Send,
  Loader2,
  Calendar,
  Clock,
  DollarSign,
  Building2,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  Download,
  Video,
  ChevronRight,
  RefreshCw,
  X,
  User,
  ShieldAlert,
  ArrowLeft,
  Check,
  Ban,
  Eye,
  CreditCard,
  AlertTriangle,
} from "lucide-react";

interface AdminConversation {
  id: string;
  partner_id: string;
  partner_name: string;
  partner_code: string;
  centre_name: string | null;
  project_id: number | null;
  project_name: string | null;
  request_type: string;
  subject: string;
  status: string;
  payment_status: string | null;
  requested_amount: number | null;
  currency: string;
  milestone_name: string | null;
  completion_date: string | null;
  description: string;
  last_message_at: string;
  last_message_preview: string;
  last_sender_type: "BPO" | "ADMIN";
  unread_admin_count: number;
  assigned_admin_name: string | null;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: "BPO" | "ADMIN";
  sender_name: string;
  message: string;
  created_at: string;
  attachments?: Array<{
    id: string;
    file_name: string;
    file_size: number;
    file_type: string;
    download_url?: string;
  }>;
}

interface MeetingRequest {
  id: string;
  conversation_id: string;
  title: string;
  preferred_date: string;
  preferred_time: string;
  duration_minutes: number;
  agenda: string;
  message: string | null;
  status: string;
  scheduled_meeting_id: number | null;
}

interface AdminBpoConnectSectionProps {
  apiCall?: (path: string, options?: RequestInit) => Promise<Response>;
  onCountChange?: (count: number) => void;
}

export default function AdminBpoConnectSection({ apiCall, onCountChange }: AdminBpoConnectSectionProps) {
  // Safe fetch helper
  const api = async (path: string, options: RequestInit = {}) => {
    if (apiCall) return apiCall(path, options);
    const token = localStorage.getItem("admin_token");
    return fetch(`/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  };

  // State
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Message composer
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyStatus, setReplyStatus] = useState<string>("");
  const [composerAttachment, setComposerAttachment] = useState<{
    fileName: string;
    fileData: string;
    mimeType: string;
    fileSize: number;
  } | null>(null);

  // Status and Payment actions
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulingMeeting, setSchedulingMeeting] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    title: "",
    startsAt: "",
    endsAt: "",
    timezone: "UTC",
    agenda: "",
    meetingLink: "https://meet.thinkatic.com/room-secure",
    meetingPassword: "",
    meetingRequestId: "",
  });

  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [markPaidNotes, setMarkPaidNotes] = useState("");

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const composerFileInputRef = useRef<HTMLInputElement>(null);

  // Load conversations
  const fetchConversations = async (keepSelected = true) => {
    try {
      setError(null);
      const res = await api("/admin/bpo-connect/conversations");
      if (!res.ok) throw new Error("Unable to load conversations.");
      const data = await res.json();
      const list: AdminConversation[] = data.data || [];
      setConversations(list);
      const totalUnread = list.reduce((acc, c) => acc + (c.unread_admin_count || 0), 0);
      if (onCountChange) onCountChange(totalUnread);

      if (list.length > 0) {
        if (!keepSelected || !selectedConvId) {
          setSelectedConvId(list[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load conversations.");
    } finally {
      setLoading(false);
    }
  };

  // Load conversation details
  const fetchConversationDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await api(`/admin/bpo-connect/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveConversation(data.data);
      }
    } catch (err) {
      console.error("Error loading conversation detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchConversations(false);
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      fetchConversationDetail(selectedConvId);
    } else {
      setActiveConversation(null);
    }
  }, [selectedConvId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  // Handle composer file change
  const handleComposerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Attachment size must be under 15MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setComposerAttachment({
        fileName: file.name,
        fileData: reader.result as string,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  // Send admin reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !replyText.trim() || sendingReply) return;

    setSendingReply(true);
    try {
      const payload: any = {
        message: replyText.trim(),
      };
      if (replyStatus) payload.newStatus = replyStatus;
      if (composerAttachment) payload.attachments = [composerAttachment];

      const res = await api(`/admin/bpo-connect/conversations/${selectedConvId}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Message could not be sent.");
      }

      setReplyText("");
      setReplyStatus("");
      setComposerAttachment(null);
      if (composerFileInputRef.current) composerFileInputRef.current.value = "";

      await fetchConversationDetail(selectedConvId);
      await fetchConversations(true);
    } catch (err: any) {
      alert(err.message || "Message send failure.");
    } finally {
      setSendingReply(false);
    }
  };

  // Change conversation status
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedConvId || updatingStatus) return;

    setUpdatingStatus(true);
    try {
      const res = await api(`/admin/bpo-connect/conversations/${selectedConvId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to update status.");
      }

      await fetchConversationDetail(selectedConvId);
      await fetchConversations(true);
    } catch (err: any) {
      alert(err.message || "Failed to update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Change payment status
  const handlePaymentStatusChange = async (paymentStatus: string, notes?: string) => {
    if (!selectedConvId || updatingPayment) return;

    setUpdatingPayment(true);
    try {
      const res = await api(`/admin/bpo-connect/conversations/${selectedConvId}/payment-status`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus, notes }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to update payment status.");
      }

      setShowMarkPaidModal(false);
      setMarkPaidNotes("");

      await fetchConversationDetail(selectedConvId);
      await fetchConversations(true);
    } catch (err: any) {
      alert(err.message || "Failed to update payment status.");
    } finally {
      setUpdatingPayment(false);
    }
  };

  // Respond to meeting request
  const handleMeetingRequestResponse = async (reqId: string, action: "ACCEPT" | "RESCHEDULE" | "DECLINE") => {
    if (!selectedConvId) return;

    if (action === "ACCEPT") {
      // Prefill schedule modal
      const req = activeConversation?.meeting_requests?.find((r: any) => r.id === reqId);
      if (req) {
        const startStr = `${req.preferred_date}T${req.preferred_time}:00`;
        const startDate = new Date(startStr);
        const endDate = new Date(startDate.getTime() + req.duration_minutes * 60 * 1000);

        setMeetingForm({
          title: req.title,
          startsAt: startDate.toISOString().slice(0, 16),
          endsAt: endDate.toISOString().slice(0, 16),
          timezone: "UTC",
          agenda: req.agenda || "Discussion",
          meetingLink: "https://meet.thinkatic.com/room-secure",
          meetingPassword: "",
          meetingRequestId: reqId,
        });
        setShowScheduleModal(true);
        return;
      }
    }

    try {
      const res = await api(`/admin/bpo-connect/conversations/${selectedConvId}/meeting-requests/${reqId}/respond`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error("Failed to respond to meeting request.");

      await fetchConversationDetail(selectedConvId);
      await fetchConversations(true);
    } catch (err: any) {
      alert(err.message || "Failed to update meeting request.");
    }
  };

  // Schedule meeting
  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || schedulingMeeting) return;

    if (!meetingForm.title.trim() || !meetingForm.startsAt || !meetingForm.endsAt) {
      alert("Please fill in meeting title, start time, and end time.");
      return;
    }

    setSchedulingMeeting(true);
    try {
      const res = await api(`/admin/bpo-connect/conversations/${selectedConvId}/meetings`, {
        method: "POST",
        body: JSON.stringify({
          title: meetingForm.title.trim(),
          startsAt: new Date(meetingForm.startsAt).toISOString(),
          endsAt: new Date(meetingForm.endsAt).toISOString(),
          timezone: meetingForm.timezone || "UTC",
          agenda: meetingForm.agenda.trim() || undefined,
          meetingLink: meetingForm.meetingLink.trim() || undefined,
          meetingPassword: meetingForm.meetingPassword.trim() || undefined,
          meetingRequestId: meetingForm.meetingRequestId || undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Unable to schedule meeting.");
      }

      setShowScheduleModal(false);
      setMeetingForm({
        title: "",
        startsAt: "",
        endsAt: "",
        timezone: "UTC",
        agenda: "",
        meetingLink: "https://meet.thinkatic.com/room-secure",
        meetingPassword: "",
        meetingRequestId: "",
      });

      await fetchConversationDetail(selectedConvId);
      await fetchConversations(true);
    } catch (err: any) {
      alert(err.message || "Unable to schedule meeting.");
    } finally {
      setSchedulingMeeting(false);
    }
  };

  // Helpers
  const formatRequestType = (type: string) => {
    const map: Record<string, string> = {
      project_completed: "Project Completed",
      advance_payment_request: "Advance Payment Request",
      payment_status: "Payment Status",
      payment_clarification: "Payment Clarification",
      project_milestone: "Project Milestone",
      operational_issue: "Operational Issue",
      general_discussion: "General Discussion",
      meeting_request: "Meeting Request",
    };
    return map[type] || type.replace(/_/g, " ");
  };

  const renderStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    let bg = "bg-blue-50 text-[#214ECF] border-blue-200";
    if (s === "OPEN") bg = "bg-blue-50 text-[#214ECF] border-blue-200";
    else if (s === "ADMIN_REVIEW") bg = "bg-purple-50 text-purple-700 border-purple-200 font-semibold";
    else if (s === "WAITING_FOR_BPO") bg = "bg-amber-50 text-amber-800 border-amber-200";
    else if (s === "IN_PROGRESS") bg = "bg-indigo-50 text-indigo-700 border-indigo-200";
    else if (s === "MEETING_SCHEDULED") bg = "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold";
    else if (s === "RESOLVED") bg = "bg-emerald-50 text-emerald-800 border-emerald-200";
    else if (s === "CLOSED") bg = "bg-slate-100 text-slate-600 border-slate-200";

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${bg}`}>
        {s.replace(/_/g, " ")}
      </span>
    );
  };

  const renderPaymentBadge = (status: string | null) => {
    if (!status) return null;
    const s = status.toUpperCase();
    let bg = "bg-amber-50 text-amber-800 border-amber-200";
    if (s === "PAID") bg = "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold";
    else if (s === "APPROVED_FOR_PROCESSING") bg = "bg-blue-50 text-[#214ECF] border-blue-200 font-bold";
    else if (s === "PROCESSING") bg = "bg-indigo-50 text-indigo-700 border-indigo-200";
    else if (s === "REJECTED" || s === "CANCELLED") bg = "bg-rose-50 text-rose-700 border-rose-200";

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${bg}`}>
        <DollarSign size={11} /> {s.replace(/_/g, " ")}
      </span>
    );
  };

  // Filtered list
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.subject.toLowerCase().includes(q) ||
        c.partner_name.toLowerCase().includes(q) ||
        c.partner_code.toLowerCase().includes(q) ||
        (c.project_name && c.project_name.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "all" || c.status.toLowerCase() === statusFilter.toLowerCase();

      const matchesType =
        typeFilter === "all" || c.request_type === typeFilter;

      const matchesPayment =
        paymentFilter === "all" ||
        (c.payment_status && c.payment_status.toLowerCase() === paymentFilter.toLowerCase());

      return matchesSearch && matchesStatus && matchesType && matchesPayment;
    });
  }, [conversations, searchQuery, statusFilter, typeFilter, paymentFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
              <MessageSquareText size={18} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">BPO Connect</h1>
            <span className="text-xs font-bold text-[#214ECF] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              Enterprise Operations
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Authoritative communications workspace for partner requests, project completions, payment authorisations, and scheduling.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchConversations(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[660px]">
        {/* Left Column: BPO Requests List (4 cols) */}
        <div className={`lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col h-[720px] shadow-xs ${selectedConvId ? "hidden lg:flex" : "flex"}`}>
          {/* Search and Filters */}
          <div className="space-y-2 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search BPO, Centre ID, project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-[11px] py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="ADMIN_REVIEW">Admin Review</option>
                <option value="WAITING_FOR_BPO">Waiting for Partner</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="MEETING_SCHEDULED">Meeting Scheduled</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="text-[11px] py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none"
              >
                <option value="all">All Payments</option>
                <option value="REQUESTED">Requested</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="APPROVED_FOR_PROCESSING">Approved AP</option>
                <option value="PAID">Disbursed (Paid)</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs">
                <Loader2 size={24} className="animate-spin text-[#214ECF] mb-2" />
                <span>Loading BPO communications...</span>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
                <p className="text-xs text-rose-700 mb-2">{error}</p>
                <button
                  onClick={() => fetchConversations(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 cursor-pointer"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-slate-400">
                <MessageSquareText size={32} className="text-slate-300 mb-2 stroke-1" />
                <p className="text-xs font-semibold text-slate-700">No requests found</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                  No BPO Partner requests match your active filters.
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = selectedConvId === c.id;
                const hasUnread = c.unread_admin_count > 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConvId(c.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left relative ${
                      isSelected
                        ? "bg-blue-50/70 border-[#214ECF] shadow-xs"
                        : hasUnread
                        ? "bg-blue-50/40 border-blue-300 hover:bg-blue-50/60"
                        : "bg-white border-slate-200/80 hover:bg-slate-50/80"
                    }`}
                  >
                    {hasUnread && (
                      <span className="absolute top-3.5 right-3.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-rose-500 text-white shadow-2xs">
                        NEW
                      </span>
                    )}

                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {c.partner_name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {c.partner_code}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {formatRequestType(c.request_type)}
                      </span>
                      {renderStatusBadge(c.status)}
                    </div>

                    <h4 className="text-xs font-semibold text-slate-800 line-clamp-1 mb-1">
                      {c.subject}
                    </h4>

                    {c.project_name && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1">
                        <FolderKanban size={11} className="text-slate-400 shrink-0" />
                        <span className="truncate">{c.project_name}</span>
                      </div>
                    )}

                    {c.payment_status && (
                      <div className="mb-1.5">{renderPaymentBadge(c.payment_status)}</div>
                    )}

                    {c.requested_amount && (
                      <div className="text-[11px] font-bold text-emerald-600 mb-1">
                        {c.currency} {Number(c.requested_amount).toLocaleString()}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                      {c.last_message_preview || "No message preview"}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-1.5">
                      <span>{new Date(c.last_message_at).toLocaleDateString()}</span>
                      <span>{new Date(c.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Full BPO Conversation & Controls (8 cols) */}
        <div className={`lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 flex flex-col h-[720px] shadow-xs overflow-hidden ${!selectedConvId ? "hidden lg:flex" : "flex"}`}>
          {selectedConvId && activeConversation ? (
            <>
              {/* Header with BPO & Request Details */}
              <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setSelectedConvId(null)}
                    className="lg:hidden p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer mt-0.5"
                    title="Back to list"
                  >
                    <ArrowLeft size={16} />
                  </button>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-slate-900">
                        {activeConversation.partner_name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                        Centre ID: {activeConversation.partner_code}
                      </span>
                      {renderStatusBadge(activeConversation.status)}
                      {activeConversation.payment_status && renderPaymentBadge(activeConversation.payment_status)}
                    </div>

                    <h2 className="text-sm font-bold text-slate-900 line-clamp-1">
                      {activeConversation.subject}
                    </h2>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                      <span className="font-semibold text-slate-600">
                        Type: {formatRequestType(activeConversation.request_type)}
                      </span>
                      {activeConversation.project_name && (
                        <span className="flex items-center gap-1">
                          <FolderKanban size={12} className="text-slate-400" />
                          {activeConversation.project_name}
                        </span>
                      )}
                      <span>Created: {new Date(activeConversation.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {/* Status Dropdown */}
                  <select
                    disabled={updatingStatus}
                    value={activeConversation.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="text-xs font-semibold py-1.5 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#214ECF] cursor-pointer shadow-2xs"
                  >
                    <option value="OPEN">Status: Open</option>
                    <option value="ADMIN_REVIEW">Status: Admin Review</option>
                    <option value="WAITING_FOR_BPO">Status: Waiting for Partner</option>
                    <option value="IN_PROGRESS">Status: In Progress</option>
                    <option value="MEETING_SCHEDULED">Status: Meeting Scheduled</option>
                    <option value="RESOLVED">Status: Resolved</option>
                    <option value="CLOSED">Status: Closed</option>
                  </select>

                  <button
                    onClick={() => {
                      setMeetingForm({
                        title: `Discussion with ${activeConversation.partner_name}`,
                        startsAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                        endsAt: new Date(Date.now() + 86400000 + 1800000).toISOString().slice(0, 16),
                        timezone: "UTC",
                        agenda: activeConversation.subject,
                        meetingLink: "https://meet.thinkatic.com/room-secure",
                        meetingPassword: "",
                        meetingRequestId: "",
                      });
                      setShowScheduleModal(true);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#214ECF] text-white text-xs font-bold shadow-2xs hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <Video size={13} />
                    <span>Create Meeting</span>
                  </button>

                  <button
                    onClick={() => fetchConversationDetail(selectedConvId)}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer shadow-2xs"
                    title="Refresh thread"
                  >
                    <RefreshCw size={13} className={loadingDetail ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {/* Pending Meeting Request Banner (if any) */}
              {activeConversation.meeting_requests?.some((mr: MeetingRequest) => mr.status === "REQUESTED") && (
                <div className="bg-amber-50 border-b border-amber-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shrink-0">
                  {(() => {
                    const pendingReq = activeConversation.meeting_requests.find((mr: MeetingRequest) => mr.status === "REQUESTED");
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <Video size={15} className="text-amber-700 shrink-0" />
                          <div>
                            <span className="font-bold text-amber-900">Meeting Request: </span>
                            <span className="text-amber-800">
                              "{pendingReq.title}" for {pendingReq.preferred_date} at {pendingReq.preferred_time} ({pendingReq.duration_minutes}m)
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleMeetingRequestResponse(pendingReq.id, "ACCEPT")}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Accept & Schedule
                          </button>
                          <button
                            onClick={() => handleMeetingRequestResponse(pendingReq.id, "DECLINE")}
                            className="px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-[11px] cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Payment Processing Control Banner */}
              {activeConversation.requested_amount && (
                <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border-b border-blue-100 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shrink-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CreditCard size={15} className="text-[#214ECF]" />
                      <span className="font-bold text-slate-800">Requested Amount:</span>
                      <span className="font-extrabold text-[#214ECF] text-sm">
                        {activeConversation.currency} {Number(activeConversation.requested_amount).toLocaleString()}
                      </span>
                      {activeConversation.milestone_name && (
                        <span className="text-slate-500 font-medium">({activeConversation.milestone_name})</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Payment Status: <span className="font-semibold text-slate-700">{activeConversation.payment_status || "PENDING"}</span> · Manual Finance disbursement required.
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {activeConversation.payment_status !== "APPROVED_FOR_PROCESSING" && activeConversation.payment_status !== "PAID" && (
                      <button
                        disabled={updatingPayment}
                        onClick={() => handlePaymentStatusChange("APPROVED_FOR_PROCESSING")}
                        className="px-3 py-1.5 rounded-lg bg-[#214ECF] hover:bg-blue-700 text-white font-bold text-xs shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        Approve for Processing
                      </button>
                    )}

                    {activeConversation.payment_status !== "PAID" && (
                      <button
                        disabled={updatingPayment}
                        onClick={() => setShowMarkPaidModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        Mark Paid
                      </button>
                    )}

                    <button
                      disabled={updatingPayment}
                      onClick={() => handlePaymentStatusChange("INFO_REQUIRED")}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold text-xs cursor-pointer disabled:opacity-50"
                    >
                      Request Info
                    </button>

                    {activeConversation.payment_status !== "REJECTED" && (
                      <button
                        disabled={updatingPayment}
                        onClick={() => {
                          const reason = prompt("Enter rejection reason:");
                          if (reason) handlePaymentStatusChange("REJECTED", reason);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs cursor-pointer disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Chat Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20">
                {activeConversation.messages && activeConversation.messages.length > 0 ? (
                  activeConversation.messages.map((m: Message) => {
                    const isAdmin = m.sender_type === "ADMIN";
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-700">{m.sender_name}</span>
                          <span>·</span>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>

                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3.5 shadow-2xs text-xs whitespace-pre-wrap ${
                            isAdmin
                              ? "bg-slate-900 text-white rounded-tr-none"
                              : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                          }`}
                        >
                          <p className="leading-relaxed">{m.message}</p>

                          {/* Attachments */}
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-white/20 space-y-1.5">
                              {m.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={att.download_url || "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`flex items-center gap-2 p-2 rounded-lg text-[11px] transition-colors ${
                                    isAdmin
                                      ? "bg-slate-800 hover:bg-slate-700 text-white"
                                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60"
                                  }`}
                                >
                                  <Paperclip size={13} className="shrink-0" />
                                  <span className="truncate flex-1">{att.file_name}</span>
                                  <span className="text-[10px] opacity-75 shrink-0">
                                    {(att.file_size / 1024).toFixed(0)} KB
                                  </span>
                                  <Download size={12} className="shrink-0 ml-1" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-center h-32 text-xs text-slate-400">
                    No messages in this request.
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSendReply} className="p-3 border-t border-slate-200/80 bg-white shrink-0">
                {/* Composer Attachment Preview */}
                {composerAttachment && (
                  <div className="mb-2 flex items-center justify-between p-2 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900">
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip size={13} className="text-[#214ECF] shrink-0" />
                      <span className="font-semibold truncate">{composerAttachment.fileName}</span>
                      <span className="text-[10px] text-blue-600 shrink-0">
                        ({(composerAttachment.fileSize / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setComposerAttachment(null)}
                      className="p-1 text-blue-600 hover:text-blue-900 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex-1 rounded-xl border border-slate-200 focus-within:border-[#214ECF] focus-within:ring-2 focus-within:ring-[#214ECF]/20 bg-slate-50/40 p-2">
                    <textarea
                      rows={2}
                      placeholder="Type response to BPO Partner..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply(e);
                        }
                      }}
                      className="w-full bg-transparent text-xs text-slate-900 focus:outline-none resize-none"
                    />
                  </div>

                  <input
                    type="file"
                    ref={composerFileInputRef}
                    onChange={handleComposerFileChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => composerFileInputRef.current?.click()}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                    title="Attach file (Max 15MB)"
                  >
                    <Paperclip size={16} />
                  </button>

                  <button
                    type="submit"
                    disabled={(!replyText.trim() && !composerAttachment) || sendingReply}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {sendingReply ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Send</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageSquareText size={48} className="text-slate-300 mb-3 stroke-1" />
              <h3 className="text-sm font-bold text-slate-700">Select a BPO request</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Choose a conversation from the left to review details, reply to the partner, schedule meetings, or authorize payments.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Schedule Meeting */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <Video size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Schedule Meeting</h3>
                  <p className="text-xs text-slate-500">Links to Thinkatic enterprise meetings system.</p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleScheduleMeeting} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Meeting Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Starts At <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={meetingForm.startsAt}
                    onChange={(e) => setMeetingForm({ ...meetingForm, startsAt: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ends At <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={meetingForm.endsAt}
                    onChange={(e) => setMeetingForm({ ...meetingForm, endsAt: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Meeting Virtual Link
                </label>
                <input
                  type="url"
                  placeholder="https://meet.thinkatic.com/..."
                  value={meetingForm.meetingLink}
                  onChange={(e) => setMeetingForm({ ...meetingForm, meetingLink: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Passcode (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. THK-9281"
                  value={meetingForm.meetingPassword}
                  onChange={(e) => setMeetingForm({ ...meetingForm, meetingPassword: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Agenda
                </label>
                <textarea
                  rows={2}
                  value={meetingForm.agenda}
                  onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schedulingMeeting}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#214ECF] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {schedulingMeeting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <span>Schedule Meeting</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Manual Mark Paid Confirmation */}
      {showMarkPaidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <DollarSign size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Confirm Payment Disbursement</h3>
                <p className="text-xs text-slate-500">Record manual transfer confirmation</p>
              </div>
            </div>

            <div className="my-4 text-xs text-slate-600 space-y-2">
              <p>
                You are marking this request as <span className="font-bold text-emerald-700">PAID</span>.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px]">
                <span className="font-bold">Notice:</span> Only proceed if Finance has already executed the manual bank or wire transfer for this request.
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reference / Transaction Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wire Ref #827192 - Completed by Finance"
                  value={markPaidNotes}
                  onChange={(e) => setMarkPaidNotes(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMarkPaidModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingPayment}
                onClick={() => handlePaymentStatusChange("PAID", markPaidNotes)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {updatingPayment ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <span>Confirm Paid</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
