import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  MessageSquareText,
  Plus,
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
} from "lucide-react";

interface Conversation {
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
  unread_bpo_count: number;
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
  meeting_details?: {
    location?: string;
    starts_at?: string;
  };
}

interface ProjectOption {
  id: number;
  name: string;
  status?: string;
}

interface BpoConnectWithAdminSectionProps {
  api: (path: string, options?: RequestInit) => Promise<Response>;
}

export default function BpoConnectWithAdminSection({ api }: BpoConnectWithAdminSectionProps) {
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Message composer
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [composerAttachment, setComposerAttachment] = useState<{
    fileName: string;
    fileData: string;
    mimeType: string;
    fileSize: number;
  } | null>(null);

  // Modals
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);

  // New Request Form
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [requestForm, setRequestForm] = useState({
    requestType: "general_discussion",
    projectId: "",
    subject: "",
    message: "",
    amount: "",
    currency: "USD",
    milestone: "",
    completionDate: "",
  });
  const [requestAttachment, setRequestAttachment] = useState<{
    fileName: string;
    fileData: string;
    mimeType: string;
    fileSize: number;
  } | null>(null);

  // Meeting Request Form
  const [sendingMeetingReq, setSendingMeetingReq] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    title: "",
    preferredDate: "",
    preferredTime: "14:00",
    durationMinutes: 30,
    agenda: "",
    message: "",
  });

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const composerFileInputRef = useRef<HTMLInputElement>(null);
  const requestFileInputRef = useRef<HTMLInputElement>(null);

  // Load conversations
  const fetchConversations = async (keepSelected = true) => {
    try {
      setError(null);
      const res = await api("/bpo/connect/conversations");
      if (!res.ok) throw new Error("Unable to load conversations.");
      const data = await res.json();
      const list: Conversation[] = data.data || [];
      setConversations(list);

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

  // Load conversation detail
  const fetchConversationDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await api(`/bpo/connect/conversations/${id}`);
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

  // Load projects for dropdown
  const fetchProjects = async () => {
    try {
      const res = await api("/bpo/connect/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.data || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchConversations(false);
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      fetchConversationDetail(selectedConvId);
    } else {
      setActiveConversation(null);
    }
  }, [selectedConvId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  // Handle composer attachment file selection
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

  // Handle request form attachment file selection
  const handleRequestFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Attachment size must be under 15MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRequestAttachment({
        fileName: file.name,
        fileData: reader.result as string,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  // Submit new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !messageText.trim() || sendingMessage) return;

    setSendingMessage(true);
    try {
      const payload: any = {
        message: messageText.trim(),
      };
      if (composerAttachment) {
        payload.attachments = [composerAttachment];
      }

      const res = await api(`/bpo/connect/conversations/${selectedConvId}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Message could not be sent.");
      }

      setMessageText("");
      setComposerAttachment(null);
      if (composerFileInputRef.current) composerFileInputRef.current.value = "";

      // Refresh conversation
      await fetchConversationDetail(selectedConvId);
      await fetchConversations(true);
    } catch (err: any) {
      alert(err.message || "Failed to send message. Please retry.");
    } finally {
      setSendingMessage(false);
    }
  };

  // Submit new request
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingRequest) return;

    if (!requestForm.subject.trim() || !requestForm.message.trim()) {
      alert("Please fill in both Subject and Message.");
      return;
    }

    setCreatingRequest(true);
    try {
      const payload: any = {
        requestType: requestForm.requestType,
        subject: requestForm.subject.trim(),
        message: requestForm.message.trim(),
        projectId: requestForm.projectId ? Number(requestForm.projectId) : null,
        requestedAmount: requestForm.amount ? Number(requestForm.amount) : null,
        currency: requestForm.currency || "USD",
        milestoneName: requestForm.milestone.trim() || null,
        completionDate: requestForm.completionDate || null,
      };

      if (requestAttachment) {
        payload.attachments = [requestAttachment];
      }

      const res = await api("/bpo/connect/conversations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to create request.");
      }

      const data = await res.json();
      setShowNewRequestModal(false);
      setRequestForm({
        requestType: "general_discussion",
        projectId: "",
        subject: "",
        message: "",
        amount: "",
        currency: "USD",
        milestone: "",
        completionDate: "",
      });
      setRequestAttachment(null);

      // Select new conversation
      if (data.data?.id) {
        setSelectedConvId(data.data.id);
      }
      await fetchConversations(true);
    } catch (err: any) {
      alert(err.message || "Failed to submit request.");
    } finally {
      setCreatingRequest(false);
    }
  };

  // Submit meeting request
  const handleRequestMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || sendingMeetingReq) return;

    if (!meetingForm.title.trim() || !meetingForm.preferredDate || !meetingForm.preferredTime) {
      alert("Title, Date, and Time are required.");
      return;
    }

    setSendingMeetingReq(true);
    try {
      const res = await api(`/bpo/connect/conversations/${selectedConvId}/meeting-requests`, {
        method: "POST",
        body: JSON.stringify({
          title: meetingForm.title.trim(),
          preferredDate: meetingForm.preferredDate,
          preferredTime: meetingForm.preferredTime,
          durationMinutes: Number(meetingForm.durationMinutes) || 30,
          agenda: meetingForm.agenda.trim() || "Operational Discussion",
          message: meetingForm.message.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Unable to request meeting.");
      }

      setShowMeetingModal(false);
      setMeetingForm({
        title: "",
        preferredDate: "",
        preferredTime: "14:00",
        durationMinutes: 30,
        agenda: "",
        message: "",
      });

      await fetchConversationDetail(selectedConvId);
      await fetchConversations(true);
    } catch (err: any) {
      alert(err.message || "Unable to request meeting.");
    } finally {
      setSendingMeetingReq(false);
    }
  };

  // Helper for request type label
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

  // Helper for status badge
  const renderStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    let bg = "bg-blue-50 text-[#214ECF] border-blue-200";
    if (s === "OPEN") bg = "bg-blue-50 text-[#214ECF] border-blue-200";
    else if (s === "ADMIN_REVIEW") bg = "bg-purple-50 text-purple-700 border-purple-200";
    else if (s === "WAITING_FOR_BPO") bg = "bg-amber-50 text-amber-800 border-amber-200 animate-pulse";
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

  // Helper for payment status badge
  const renderPaymentBadge = (status: string | null) => {
    if (!status) return null;
    const s = status.toUpperCase();
    let bg = "bg-amber-50 text-amber-800 border-amber-200";
    if (s === "PAID") bg = "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold";
    else if (s === "APPROVED_FOR_PROCESSING") bg = "bg-blue-50 text-[#214ECF] border-blue-200 font-semibold";
    else if (s === "PROCESSING") bg = "bg-indigo-50 text-indigo-700 border-indigo-200";
    else if (s === "REJECTED" || s === "CANCELLED") bg = "bg-rose-50 text-rose-700 border-rose-200";

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${bg}`}>
        <DollarSign size={11} /> {s.replace(/_/g, " ")}
      </span>
    );
  };

  // Filtered conversation list
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchesSearch =
        !searchQuery.trim() ||
        c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.project_name && c.project_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" || c.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [conversations, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
              <MessageSquareText size={18} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Connect With Thinkatic Admin</h1>
          </div>
          <p className="text-xs text-slate-500">
            Discuss project completion, payment requests, operational questions and other important matters with the Thinkatic team.
          </p>
        </div>

        <button
          onClick={() => setShowNewRequestModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#214ECF] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>New Request</span>
        </button>
      </div>

      {/* Main 2-Column Workplace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Column: Requests & Conversations List (4 cols) */}
        <div className={`lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col h-[700px] shadow-xs ${selectedConvId ? "hidden lg:flex" : "flex"}`}>
          {/* Top Search & Filter Bar */}
          <div className="space-y-2 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter size={13} className="text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#214ECF]"
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
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs">
                <Loader2 size={24} className="animate-spin text-[#214ECF] mb-2" />
                <span>Loading conversations...</span>
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
                <p className="text-xs font-semibold text-slate-700">No conversations yet</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                  Submit a new request to connect with Thinkatic Admin.
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = selectedConvId === c.id;
                const hasUnread = c.unread_bpo_count > 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConvId(c.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-left relative ${
                      isSelected
                        ? "bg-blue-50/70 border-[#214ECF] shadow-xs"
                        : hasUnread
                        ? "bg-blue-50/30 border-blue-200 hover:bg-slate-50"
                        : "bg-white border-slate-200/80 hover:bg-slate-50/80"
                    }`}
                  >
                    {/* Unread indicator */}
                    {hasUnread && (
                      <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#214ECF]" />
                    )}

                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {formatRequestType(c.request_type)}
                      </span>
                      {renderStatusBadge(c.status)}
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1">{c.subject}</h4>

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
                        Requested: {c.currency} {Number(c.requested_amount).toLocaleString()}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                      {c.last_message_preview || "No messages yet"}
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

        {/* Right Column: Active Conversation Thread (8 cols) */}
        <div className={`lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 flex flex-col h-[700px] shadow-xs overflow-hidden ${!selectedConvId ? "hidden lg:flex" : "flex"}`}>
          {selectedConvId && activeConversation ? (
            <>
              {/* Conversation Top Header */}
              <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setSelectedConvId(null)}
                    className="lg:hidden p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer mt-0.5"
                    title="Back to conversations list"
                  >
                    <ArrowLeft size={16} />
                  </button>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                        {formatRequestType(activeConversation.request_type)}
                      </span>
                      {renderStatusBadge(activeConversation.status)}
                      {activeConversation.payment_status && renderPaymentBadge(activeConversation.payment_status)}
                    </div>
                    <h2 className="text-sm font-bold text-slate-900 line-clamp-1">{activeConversation.subject}</h2>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                      {activeConversation.project_name && (
                        <span className="flex items-center gap-1">
                          <FolderKanban size={12} className="text-slate-400" />
                          {activeConversation.project_name}
                        </span>
                      )}
                      <span>
                        Created: {new Date(activeConversation.created_at).toLocaleDateString()}
                      </span>
                      {activeConversation.assigned_admin_name && (
                        <span className="text-[#214ECF] font-medium">
                          Rep: {activeConversation.assigned_admin_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowMeetingModal(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-white text-[#214ECF] hover:bg-blue-50 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    <Video size={14} />
                    <span>Request Meeting</span>
                  </button>
                  <button
                    onClick={() => fetchConversationDetail(selectedConvId)}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer shadow-2xs"
                    title="Refresh conversation"
                  >
                    <RefreshCw size={13} className={loadingDetail ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {/* Payment Details Banner (if applicable) */}
              {activeConversation.requested_amount && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-4 py-2.5 flex items-center justify-between text-xs shrink-0">
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-[#214ECF]" />
                    <span className="font-semibold text-slate-700">Requested Payment Amount:</span>
                    <span className="font-extrabold text-[#214ECF]">
                      {activeConversation.currency} {Number(activeConversation.requested_amount).toLocaleString()}
                    </span>
                    {activeConversation.milestone_name && (
                      <span className="text-slate-500">· Milestone: {activeConversation.milestone_name}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Payment is manually reviewed and disbursed by Thinkatic Finance.
                  </div>
                </div>
              )}

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20">
                {activeConversation.messages && activeConversation.messages.length > 0 ? (
                  activeConversation.messages.map((m: Message) => {
                    const isBpo = m.sender_type === "BPO";
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isBpo ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-700">{m.sender_name}</span>
                          <span>·</span>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>

                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3.5 shadow-2xs text-xs whitespace-pre-wrap ${
                            isBpo
                              ? "bg-[#214ECF] text-white rounded-tr-none"
                              : "bg-white border border-slate-200/90 text-slate-800 rounded-tl-none"
                          }`}
                        >
                          <p className="leading-relaxed">{m.message}</p>

                          {/* Message Attachments */}
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-white/20 space-y-1.5">
                              {m.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={att.download_url || "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`flex items-center gap-2 p-2 rounded-lg text-[11px] transition-colors ${
                                    isBpo
                                      ? "bg-blue-700/60 hover:bg-blue-700 text-white"
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
                    Start the conversation with Thinkatic Admin.
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200/80 bg-white shrink-0">
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
                      placeholder="Write your message to Thinkatic Admin..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
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
                    disabled={(!messageText.trim() && !composerAttachment) || sendingMessage}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#214ECF] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {sendingMessage ? (
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
              <h3 className="text-sm font-bold text-slate-700">Select a conversation</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Choose a request from the left list to review updates, message Admin, or schedule a project meeting.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: New Request */}
      {showNewRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg p-6 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">New Request to Thinkatic Admin</h3>
                <p className="text-xs text-slate-500 mt-0.5">Submit payment requests, project milestone completions, or questions.</p>
              </div>
              <button
                onClick={() => setShowNewRequestModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Request Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={requestForm.requestType}
                  onChange={(e) => setRequestForm({ ...requestForm, requestType: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF]"
                >
                  <option value="project_completed">Project Completed</option>
                  <option value="advance_payment_request">Advance Payment Request</option>
                  <option value="payment_status">Payment Status</option>
                  <option value="payment_clarification">Payment Clarification</option>
                  <option value="project_milestone">Project Milestone</option>
                  <option value="operational_issue">Operational Issue</option>
                  <option value="general_discussion">General Discussion</option>
                  <option value="meeting_request">Meeting Request</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Project (Authorized Projects Only)
                </label>
                <select
                  value={requestForm.projectId}
                  onChange={(e) => setRequestForm({ ...requestForm, projectId: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF]"
                >
                  <option value="">-- General / Non-Project Specific --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.status ? `(${p.status})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Subject <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project Alpha Milestone 2 Completed - Payout Request"
                  value={requestForm.subject}
                  onChange={(e) => setRequestForm({ ...requestForm, subject: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF]"
                />
              </div>

              {/* Conditional Payment Fields */}
              {(requestForm.requestType.includes("payment") ||
                requestForm.requestType === "project_completed" ||
                requestForm.requestType === "project_milestone") && (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                  <div className="text-[11px] font-bold text-[#214ECF] uppercase tracking-wider">
                    Financial Details (Optional)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 5000"
                        value={requestForm.amount}
                        onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })}
                        className="w-full text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Currency
                      </label>
                      <select
                        value={requestForm.currency}
                        onChange={(e) => setRequestForm({ ...requestForm, currency: e.target.value })}
                        className="w-full text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="INR">INR (₹)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Milestone Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sprint 3 Delivery"
                        value={requestForm.milestone}
                        onChange={(e) => setRequestForm({ ...requestForm, milestone: e.target.value })}
                        className="w-full text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Completion Date
                      </label>
                      <input
                        type="date"
                        value={requestForm.completionDate}
                        onChange={(e) => setRequestForm({ ...requestForm, completionDate: e.target.value })}
                        className="w-full text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Message Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide comprehensive details, operational context, or payment questions..."
                  value={requestForm.message}
                  onChange={(e) => setRequestForm({ ...requestForm, message: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF] resize-none"
                />
              </div>

              {/* Attachment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supporting Attachment (Optional, Max 15MB)
                </label>
                <input
                  type="file"
                  ref={requestFileInputRef}
                  onChange={handleRequestFileChange}
                  className="hidden"
                />
                {requestAttachment ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-blue-200 bg-blue-50/60 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip size={14} className="text-[#214ECF] shrink-0" />
                      <span className="font-semibold truncate">{requestAttachment.fileName}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        ({(requestAttachment.fileSize / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRequestAttachment(null)}
                      className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => requestFileInputRef.current?.click()}
                    className="w-full py-3 px-4 border border-dashed border-slate-300 rounded-xl bg-slate-50/50 hover:bg-blue-50/40 hover:border-blue-300 text-xs text-slate-600 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Paperclip size={14} className="text-[#214ECF]" />
                    <span>Upload invoice, timesheet, or proof document</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewRequestModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRequest}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#214ECF] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {creatingRequest ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Request Meeting */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <Video size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Request Meeting</h3>
                  <p className="text-xs text-slate-500">Propose a virtual meeting with Thinkatic Admin.</p>
                </div>
              </div>
              <button
                onClick={() => setShowMeetingModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRequestMeeting} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Meeting Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project Delivery & Payment Review"
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Preferred Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={meetingForm.preferredDate}
                    onChange={(e) => setMeetingForm({ ...meetingForm, preferredDate: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Preferred Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={meetingForm.preferredTime}
                    onChange={(e) => setMeetingForm({ ...meetingForm, preferredTime: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Duration
                </label>
                <select
                  value={meetingForm.durationMinutes}
                  onChange={(e) => setMeetingForm({ ...meetingForm, durationMinutes: Number(e.target.value) })}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF]"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Meeting Agenda
                </label>
                <textarea
                  rows={3}
                  placeholder="Outline key discussion items..."
                  value={meetingForm.agenda}
                  onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#214ECF] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMeetingModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingMeetingReq}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#214ECF] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {sendingMeetingReq ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Sending Request...</span>
                    </>
                  ) : (
                    <span>Submit Meeting Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
