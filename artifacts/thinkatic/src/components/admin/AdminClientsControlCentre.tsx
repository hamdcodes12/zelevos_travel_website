import React, { useState, useEffect, useCallback } from "react";
import AnimatedCounter from "./AnimatedCounter";
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Mail,
  Phone,
  Globe,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
  FolderKanban,
  FileText,
  DollarSign,
  CreditCard,
  MessageSquare,
  Ticket,
  Activity,
  Send,
  Eye,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  Plus,
  Check,
  X,
  Lock,
  Unlock,
  AlertTriangle,
  UserCheck,
  Bell,
  User,
  Copy,
  Layers,
} from "lucide-react";

interface ClientListItem {
  id: string;
  clientId: string;
  email: string;
  name: string;
  fullName: string;
  company: string;
  companyName: string;
  phone: string;
  country: string;
  businessDetails: Record<string, any>;
  accountStatus: string;
  isActive: boolean;
  kycStatus: string;
  activePlan: string;
  selectedPlan: string | null;
  activeProjectsCount: number;
  totalProjectsCount: number;
  meetingsCount: number;
  totalBilled: number;
  totalPaid: number;
  balanceDue: number;
  unreadCount?: number;
  unreadTicketsCount?: number;
  unreadNotificationsCount?: number;
  updatesCount?: number;
  lastUpdateSent?: string | null;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

interface ClientDetail {
  id: string;
  email: string;
  name: string;
  fullName: string;
  company: string;
  companyName: string;
  phone: string;
  country: string;
  businessDetails: Record<string, any>;
  accountStatus: string;
  isActive: boolean;
  selectedPlan: string | null;
  createdAt: string;
  updatedAt: string;
  kyc: any;
  projects: any[];
  invoices: any[];
  payments: any[];
  documents: any[];
  meetings: any[];
  tickets: any[];
  updates: any[];
  chat: { conversations: any[]; messages: any[] };
  attendance: any[];
  auditLogs: any[];
  financialSummary: { totalBilled: number; totalPaid: number; balanceDue: number };
}

export default function AdminClientsControlCentre({
  refreshTrigger,
  initialTab,
}: {
  refreshTrigger?: number;
  initialTab?: string;
} = {}) {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kycFilter, setKycFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [kpis, setKpis] = useState({
    registeredClients: 0,
    activeClients: 0,
    kycPending: 0,
    kycApproved: 0,
    clientsWithActivePlans: 0,
    clientsWithProjects: 0,
    outstandingBalance: 0,
  });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<
    | "overview"
    | "projects"
    | "plan"
    | "documents"
    | "kyc"
    | "meetings"
    | "billing"
    | "payments"
    | "chat"
    | "updates"
    | "support"
    | "contact"
    | "attendance"
    | "audit"
  >((initialTab as any) || "overview");

  // Operational Client Update State (Admin -> Client)
  const [updateCategory, setUpdateCategory] = useState("Progress");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [sendingUpdate, setSendingUpdate] = useState(false);
  const [opUpdateModalOpen, setOpUpdateModalOpen] = useState(false);

  // Project cancellation state
  const [cancellingProject, setCancellingProject] = useState<any | null>(null);
  const [cancellationReason, setCancellationReason] = useState("Client requested cancellation");
  const [cancellationNotes, setCancellationNotes] = useState("");
  const [submittingCancellation, setSubmittingCancellation] = useState(false);
  const [cancellationFeedback, setCancellationFeedback] = useState<string | null>(null);

  // Notification modal
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifType, setNotifType] = useState("admin_update");
  const [sendingNotif, setSendingNotif] = useState(false);

  // KYC Review modal
  const [kycModalOpen, setKycModalOpen] = useState(false);
  const [kycAction, setKycAction] = useState<"approved" | "rejected" | "changes_requested">("approved");
  const [kycReason, setKycReason] = useState("");
  const [submittingKycReview, setSubmittingKycReview] = useState(false);

  // Chat message state
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChatMessage, setSendingChatMessage] = useState(false);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [newChatProjectId, setNewChatProjectId] = useState<number | null>(null);
  const [newChatSubject, setNewChatSubject] = useState("");
  const [creatingChat, setCreatingChat] = useState(false);

  // Meeting edit & password reveal state
  const [editingMeeting, setEditingMeeting] = useState<any | null>(null);
  const [meetingLinkInput, setMeetingLinkInput] = useState("");
  const [meetingPasswordInput, setMeetingPasswordInput] = useState("");
  const [meetingStartsAt, setMeetingStartsAt] = useState("");
  const [meetingEndsAt, setMeetingEndsAt] = useState("");
  const [meetingAgendaInput, setMeetingAgendaInput] = useState("");
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [revealedMeetingPassword, setRevealedMeetingPassword] = useState<{ id: number; password?: string; loading?: boolean } | null>(null);

  // Document download & status review state
  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);

  // Support ticket detail modal state
  const [selectedAdminTicket, setSelectedAdminTicket] = useState<any | null>(null);
  const [adminTicketReply, setAdminTicketReply] = useState("");
  const [adminTicketIsInternal, setAdminTicketIsInternal] = useState(false);
  const [sendingAdminTicketReply, setSendingAdminTicketReply] = useState(false);

  const token = localStorage.getItem("admin_token");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const fetchClients = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (kycFilter !== "all") params.set("kyc", kycFilter);
      if (planFilter !== "all") params.set("plan", planFilter);

      const res = await fetch(`/api/admin/clients?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setClients(json.data || json.clients || []);
        if (json.kpis) {
          setKpis(json.kpis);
        }
      }
    } catch (e) {
      console.error("Failed to load clients:", e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, kycFilter, planFilter, token]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchClients(true);
    }
  }, [refreshTrigger, fetchClients]);

  const loadClientDetail = useCallback(
    async (id: string) => {
      try {
        setDetailLoading(true);
        setSelectedClientId(id);
        const res = await fetch(`/api/admin/clients/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setClientDetail(json);
        }
      } catch (e) {
        console.error("Failed to load client detail:", e);
      } finally {
        setDetailLoading(false);
      }
    },
    [token]
  );

  const toggleClientStatus = async () => {
    if (!clientDetail) return;
    const newStatus = clientDetail.isActive ? "deactivated" : "active";
    try {
      const res = await fetch(`/api/admin/clients/${clientDetail.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus, isActive: !clientDetail.isActive }),
      });
      if (res.ok) {
        await loadClientDetail(clientDetail.id);
        fetchClients();
      }
    } catch (e) {
      console.error("Status toggle error:", e);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientDetail || !notifTitle || !notifBody) return;
    try {
      setSendingNotif(true);
      const res = await fetch(`/api/admin/clients/${clientDetail.id}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: notifTitle,
          body: notifBody,
          type: notifType,
        }),
      });
      if (res.ok) {
        setNotifTitle("");
        setNotifBody("");
        setNotifModalOpen(false);
        await loadClientDetail(clientDetail.id);
      }
    } catch (e) {
      console.error("Send notification error:", e);
    } finally {
      setSendingNotif(false);
    }
  };

  const handleSendClientUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientDetail || !updateTitle.trim() || !updateMessage.trim()) return;
    try {
      setSendingUpdate(true);
      const res = await fetch("/api/admin/client-updates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: clientDetail.id,
          title: updateTitle.trim(),
          message: updateMessage.trim(),
          category: updateCategory,
          status: "published",
        }),
      });
      if (res.ok) {
        setUpdateTitle("");
        setUpdateMessage("");
        setOpUpdateModalOpen(false);
        await loadClientDetail(clientDetail.id);
        fetchClients(true);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to dispatch client update.");
      }
    } catch (e: any) {
      alert(e.message || "Failed to dispatch client update.");
    } finally {
      setSendingUpdate(false);
    }
  };

  const handleMarkClientRead = async (clientId: string, targetTab: string = "updates") => {
    try {
      await fetch(`/api/admin/clients/${clientId}/mark-read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setClients((prev) =>
        prev.map((c) =>
          c.id === clientId
            ? { ...c, unreadCount: 0, unreadNotificationsCount: 0, unreadTicketsCount: 0 }
            : c
        )
      );
      await loadClientDetail(clientId);
      setDetailTab(targetTab as any);
    } catch (e) {
      console.error("Failed to mark notifications read:", e);
    }
  };

  const handleReviewKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientDetail) return;
    try {
      setSubmittingKycReview(true);
      const res = await fetch(`/api/admin/clients/${clientDetail.id}/kyc/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: kycAction,
          reason: kycReason,
        }),
      });
      if (res.ok) {
        setKycReason("");
        setKycModalOpen(false);
        await loadClientDetail(clientDetail.id);
        fetchClients();
      }
    } catch (e) {
      console.error("KYC review error:", e);
    } finally {
      setSubmittingKycReview(false);
    }
  };

  const handleCancelProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingProject) return;
    try {
      setSubmittingCancellation(true);
      const res = await fetch(`/api/admin/projects/${cancellingProject.id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: cancellationReason,
          notes: cancellationNotes,
        }),
      });
      if (res.ok) {
        setCancellingProject(null);
        setCancellationReason("Client requested cancellation");
        setCancellationNotes("");
        setCancellationFeedback("Project was cancelled successfully and recorded in audit log.");
        setTimeout(() => setCancellationFeedback(null), 4000);
        if (clientDetail) {
          await loadClientDetail(clientDetail.id);
        }
        fetchClients();
      } else {
        const err = await res.json();
        alert(`Project cancellation failed: ${err.error || "Unknown error"}`);
      }
    } catch (err: any) {
      console.error("Cancellation error:", err);
      alert(`Cancellation error: ${err.message}`);
    } finally {
      setSubmittingCancellation(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientDetail || !chatMessage.trim()) return;
    try {
      setSendingChatMessage(true);
      const conv = clientDetail.chat?.conversations?.[0];
      if (!conv) {
        if (!clientDetail.projects || clientDetail.projects.length === 0) {
          alert("This client does not have any projects to anchor a conversation. Please allocate or create a project first.");
          return;
        }
        const createRes = await fetch("/api/admin/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            projectId: clientDetail.projects[0].id,
            clientId: clientDetail.id,
            subject: `Project ${clientDetail.projects[0].name} Communications`,
          }),
        });
        if (!createRes.ok) throw new Error("Failed to create conversation");
        const newConv = await createRes.json();
        const res = await fetch(`/api/admin/conversations/${newConv.id}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ body: chatMessage }),
        });
        if (res.ok) {
          setChatMessage("");
          await loadClientDetail(clientDetail.id);
        }
        return;
      }

      const res = await fetch(`/api/admin/conversations/${conv.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: chatMessage }),
      });
      if (res.ok) {
        setChatMessage("");
        await loadClientDetail(clientDetail.id);
      }
    } catch (e) {
      console.error("Chat error:", e);
    } finally {
      setSendingChatMessage(false);
    }
  };

  const handleStartProjectConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientDetail || !newChatProjectId || !newChatSubject.trim()) return;
    try {
      setCreatingChat(true);
      const res = await fetch("/api/admin/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: newChatProjectId,
          clientId: clientDetail.id,
          subject: newChatSubject.trim(),
        }),
      });
      if (res.ok) {
        setNewChatModalOpen(false);
        setNewChatSubject("");
        setNewChatProjectId(null);
        await loadClientDetail(clientDetail.id);
      }
    } catch (e) {
      console.error("Create conversation error:", e);
    } finally {
      setCreatingChat(false);
    }
  };

  const handleApproveMeeting = async (meetingId: number) => {
    try {
      const res = await fetch(`/api/admin/meetings/${meetingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "confirmed" }),
      });
      if (res.ok && clientDetail) {
        await loadClientDetail(clientDetail.id);
      }
    } catch (e) {
      console.error("Approve meeting error:", e);
    }
  };

  const handleCancelMeeting = async (meetingId: number) => {
    if (!window.confirm("Are you sure you want to cancel this meeting?")) return;
    try {
      const res = await fetch(`/api/admin/meetings/${meetingId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: "Cancelled by Administrator" }),
      });
      if (res.ok && clientDetail) {
        await loadClientDetail(clientDetail.id);
      }
    } catch (e) {
      console.error("Cancel meeting error:", e);
    }
  };

  const handleSaveMeetingDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeeting || !clientDetail) return;
    try {
      setSavingMeeting(true);
      const payload: Record<string, any> = {};
      if (meetingLinkInput.trim()) payload.meetingLink = meetingLinkInput.trim();
      if (meetingPasswordInput.trim()) payload.meetingPassword = meetingPasswordInput.trim();
      if (meetingStartsAt) payload.startsAt = new Date(meetingStartsAt).toISOString();
      if (meetingEndsAt) payload.endsAt = new Date(meetingEndsAt).toISOString();
      if (meetingAgendaInput.trim()) payload.agenda = meetingAgendaInput.trim();

      const res = await fetch(`/api/admin/meetings/${editingMeeting.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditingMeeting(null);
        await loadClientDetail(clientDetail.id);
      }
    } catch (e) {
      console.error("Save meeting details error:", e);
    } finally {
      setSavingMeeting(false);
    }
  };

  const handleRevealMeetingPassword = async (meetingId: number) => {
    try {
      setRevealedMeetingPassword({ id: meetingId, loading: true });
      const res = await fetch(`/api/meetings/${meetingId}/password`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setRevealedMeetingPassword({ id: meetingId, password: json.password || "(No password set)", loading: false });
      } else {
        setRevealedMeetingPassword({ id: meetingId, password: "Unavailable", loading: false });
      }
    } catch (e) {
      console.error("Reveal password error:", e);
      setRevealedMeetingPassword({ id: meetingId, password: "Error retrieving password", loading: false });
    }
  };

  const handleDownloadDocument = async (docId: number) => {
    try {
      setDownloadingDocId(docId);
      const res = await fetch(`/api/admin/documents/${docId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.url) {
          window.open(json.url, "_blank");
        }
      }
    } catch (e) {
      console.error("Download document error:", e);
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleToggleDocumentStatus = async (docId: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "archived" : "active";
      const res = await fetch(`/api/admin/documents/${docId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok && clientDetail) {
        await loadClientDetail(clientDetail.id);
      }
    } catch (e) {
      console.error("Toggle doc status error:", e);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: number, status: string) => {
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok && clientDetail) {
        await loadClientDetail(clientDetail.id);
        if (selectedAdminTicket && selectedAdminTicket.id === ticketId) {
          setSelectedAdminTicket((prev: any) => prev ? { ...prev, status } : null);
        }
      }
    } catch (e) {
      console.error("Ticket status error:", e);
    }
  };

  const handleUpdateTicketPriority = async (ticketId: number, priority: string) => {
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ priority }),
      });
      if (res.ok && clientDetail) {
        await loadClientDetail(clientDetail.id);
        if (selectedAdminTicket && selectedAdminTicket.id === ticketId) {
          setSelectedAdminTicket((prev: any) => prev ? { ...prev, priority } : null);
        }
      }
    } catch (e) {
      console.error("Ticket priority error:", e);
    }
  };

  const handleSendTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminTicket || !adminTicketReply.trim()) return;
    try {
      setSendingAdminTicketReply(true);
      const url = adminTicketIsInternal
        ? `/api/admin/tickets/${selectedAdminTicket.id}/internal-notes`
        : `/api/admin/tickets/${selectedAdminTicket.id}/replies`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: adminTicketReply }),
      });
      if (res.ok) {
        const newMessage = await res.json();
        setAdminTicketReply("");
        if (clientDetail) {
          await loadClientDetail(clientDetail.id);
        }
        setSelectedAdminTicket((prev: any) => {
          if (!prev) return null;
          return {
            ...prev,
            ticket_messages: [...(prev.ticket_messages || []), newMessage],
          };
        });
      }
    } catch (e) {
      console.error("Ticket reply error:", e);
    } finally {
      setSendingAdminTicketReply(false);
    }
  };

  // Badges
  const renderKycBadge = (status: string) => {
    const s = String(status || "unsubmitted").toLowerCase();
    if (s === "approved" || s === "verified") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={12} /> Approved
        </span>
      );
    }
    if (s === "pending" || s === "submitted" || s === "in_review" || s === "under_review") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock size={12} /> Under Review
        </span>
      );
    }
    if (s === "changes_requested" || s === "resubmission_required") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <AlertCircle size={12} /> Resubmission Req
        </span>
      );
    }
    if (s === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <XCircle size={12} /> Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
        Unsubmitted
      </span>
    );
  };

  const renderStatusBadge = (isActive: boolean, status: string) => {
    if (!isActive || status === "deactivated") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          Deactivated
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Active
      </span>
    );
  };

  // CRM DETAIL VIEW
  if (selectedClientId && clientDetail) {
    return (
      <div className="space-y-6">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => {
              setSelectedClientId(null);
              setClientDetail(null);
              fetchClients();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft size={16} /> Back to Clients List
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleClientStatus}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                clientDetail.isActive
                  ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              {clientDetail.isActive ? (
                <>
                  <Lock size={14} /> Deactivate Account
                </>
              ) : (
                <>
                  <Unlock size={14} /> Activate Account
                </>
              )}
            </button>
            <button
              onClick={() => setKycModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <ShieldCheck size={14} className="text-[#214ECF]" /> Review KYC
            </button>
            <button
              onClick={() => setNotifModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#214ECF] text-white hover:bg-blue-700 transition-colors shadow-2xs"
            >
              <Send size={14} /> Send Update / Notice
            </button>
          </div>
        </div>

        {/* Client Master Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-xl text-[#214ECF] shadow-inner">
                {clientDetail.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">{clientDetail.name}</h2>
                  {renderStatusBadge(clientDetail.isActive, clientDetail.accountStatus)}
                  {renderKycBadge(clientDetail.kyc?.status)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Mail size={13} className="text-slate-400" /> {clientDetail.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 size={13} className="text-slate-400" /> {clientDetail.company || "No Company"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe size={13} className="text-slate-400" /> {clientDetail.country || "Global"}
                  </span>
                  <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    ID: {clientDetail.id}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs text-slate-400 font-medium">Active Plan</div>
                <div className="text-sm font-bold text-[#214ECF] uppercase tracking-wide">
                  {clientDetail.selectedPlan || "No Plan"}
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-right">
                <div className="text-xs text-slate-400 font-medium">Balance Due</div>
                <div className="text-sm font-bold text-slate-900">
                  ${clientDetail.financialSummary.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* CRM Navigation Subtabs */}
          <div className="flex items-center gap-1 mt-6 overflow-x-auto pb-1 scrollbar-none border-b border-slate-100">
            {[
              { id: "overview", label: "Overview", icon: Building2 },
              { id: "projects", label: `Projects (${clientDetail.projects.length})`, icon: FolderKanban },
              { id: "billing", label: `Payments / Billing (${clientDetail.invoices.length})`, icon: DollarSign },
              { id: "updates", label: `Updates (${clientDetail.updates.length})`, icon: AlertCircle },
              { id: "support", label: `Tickets (${clientDetail.tickets.length})`, icon: Ticket },
              { id: "chat", label: "Messages / Communication", icon: MessageSquare },
              { id: "documents", label: `Documents (${clientDetail.documents.length})`, icon: FileText },
              { id: "contact", label: "Contact Details", icon: User },
              { id: "audit", label: `Activity / Audit (${clientDetail.auditLogs.length + clientDetail.updates.length + clientDetail.projects.length})`, icon: Activity },
              { id: "plan", label: "Plan", icon: Tag },
              { id: "kyc", label: "KYC Verification", icon: ShieldCheck },
              { id: "meetings", label: `Meetings (${clientDetail.meetings.length})`, icon: Calendar },
              { id: "attendance", label: `Attendance (${clientDetail.attendance.length})`, icon: Clock },
            ].map(({ id, label, icon: Icon }) => {
              const active = detailTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setDetailTab(id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? "bg-[#214ECF] text-white shadow-2xs"
                      : "text-slate-600 hover:text-[#214ECF] hover:bg-blue-50/60"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* SUBTAB CONTENTS */}
        {detailTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Profile & Contact</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">Full Name</span>
                  <span className="font-semibold text-slate-800">{clientDetail.fullName}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Company Name</span>
                  <span className="font-semibold text-slate-800">{clientDetail.company}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Email Address</span>
                  <span className="font-semibold text-slate-800">{clientDetail.email}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Phone</span>
                  <span className="font-semibold text-slate-800">{clientDetail.phone}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Country</span>
                  <span className="font-semibold text-slate-800">{clientDetail.country}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Account & Gating</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">Account Status</span>
                  {renderStatusBadge(clientDetail.isActive, clientDetail.accountStatus)}
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">KYC Status</span>
                  {renderKycBadge(clientDetail.kyc?.status)}
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Selected Active Plan</span>
                  <span className="font-bold text-[#214ECF]">{clientDetail.selectedPlan || "None"}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Project Submission Gate</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      clientDetail.selectedPlan && (clientDetail.kyc?.status === "approved" || clientDetail.kyc?.status === "verified") && clientDetail.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {clientDetail.selectedPlan && (clientDetail.kyc?.status === "approved" || clientDetail.kyc?.status === "verified") && clientDetail.isActive
                      ? "Eligible to Submit Projects"
                      : "Gated (Plan or KYC Required)"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Account Created</span>
                  <span className="text-slate-600 font-mono text-xs">{new Date(clientDetail.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Financial Snapshot</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">Total Invoiced</span>
                  <span className="font-bold text-slate-900 text-base">
                    ${clientDetail.financialSummary.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Total Paid</span>
                  <span className="font-bold text-emerald-600 text-base">
                    ${clientDetail.financialSummary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Outstanding Balance Due</span>
                  <span className="font-bold text-amber-600 text-base">
                    ${clientDetail.financialSummary.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Total Invoices</span>
                  <span className="font-semibold text-slate-800">{clientDetail.invoices.length} invoices</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROJECTS TAB */}
        {detailTab === "projects" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Client Projects</h3>
                <p className="text-xs text-slate-500">Live operational workspaces, delivery status, and lifecycle management</p>
              </div>
              <span className="text-xs text-slate-500 font-medium">Strict BPO separation enforced</span>
            </div>

            {cancellationFeedback && (
              <div className="px-4 py-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-600" />
                {cancellationFeedback}
              </div>
            )}

            {clientDetail.projects.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No projects submitted by this client yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {clientDetail.projects.map((proj) => {
                  const isCancelled = proj.status === "cancelled";
                  return (
                    <div key={proj.id} className="py-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-base">{proj.name}</span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                            isCancelled
                              ? "bg-red-50 text-red-700 border-red-200"
                              : proj.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-blue-50 text-[#214ECF] border-blue-200"
                          }`}>
                            {proj.status ? proj.status.toUpperCase() : "ACTIVE"}
                          </span>
                          {proj.vertical && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              {proj.vertical}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Assigned BPO</span>
                            <span className="font-semibold text-slate-800">{proj.assigned_bpo_name || "Pending Admin Allocation"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Allocated Agents</span>
                            <span className="font-semibold text-slate-800">{proj.required_seats || proj.headcount || 0} seats</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Start Date</span>
                            <span className="font-semibold text-slate-800">
                              {proj.start_date || proj.startDate ? new Date(proj.start_date || proj.startDate).toLocaleDateString() : "Immediate"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Budget / Billing</span>
                            <span className="font-semibold text-slate-800">
                              {proj.budget ? `$${Number(proj.budget).toLocaleString()}` : "Plan Included"}
                            </span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span>Project Progress</span>
                            <span className="font-bold text-slate-800">{proj.progress_percent || proj.progress || 0}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${isCancelled ? "bg-red-400" : "bg-[#214ECF]"}`}
                              style={{ width: `${Math.min(100, Math.max(0, proj.progress_percent || proj.progress || 0))}%` }}
                            />
                          </div>
                        </div>

                        {isCancelled && proj.metadata?.cancellation_reason && (
                          <div className="mt-3 p-3 bg-red-50/60 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                            <div className="font-semibold flex items-center gap-1.5">
                              <AlertTriangle size={13} className="text-red-600" />
                              Cancelled on {proj.metadata.cancelled_at ? new Date(proj.metadata.cancelled_at).toLocaleDateString() : "N/A"}
                            </div>
                            <p><strong>Reason:</strong> {proj.metadata.cancellation_reason}</p>
                            {proj.metadata.cancellation_notes && (
                              <p className="text-red-700 italic">"{proj.metadata.cancellation_notes}"</p>
                            )}
                          </div>
                        )}

                        {proj.description && <p className="mt-2 text-xs text-slate-600 line-clamp-2">{proj.description}</p>}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-xs text-slate-400 font-mono">ID: {proj.id}</span>
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => setCancellingProject(proj)}
                            className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <AlertTriangle size={12} />
                            Cancel Project
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PLAN TAB */}
        {detailTab === "plan" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Services & Plan Subscription</h3>
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Current Active Plan</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{clientDetail.selectedPlan || "No Active Plan"}</div>
                <p className="text-xs text-slate-500 mt-1">
                  Enables project submission and access to dedicated BPO delivery management.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#214ECF] text-white">
                {clientDetail.selectedPlan ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {detailTab === "documents" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Uploaded Client Documents</h3>
                <p className="text-xs text-slate-500">Stored in private Supabase bucket with anti-IDOR isolation</p>
              </div>
            </div>
            {clientDetail.documents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No documents uploaded by this client.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {clientDetail.documents.map((doc) => (
                  <div key={doc.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] shrink-0">
                        <FileText size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{doc.file_name || doc.original_file_name}</div>
                        <div className="text-xs text-slate-400">
                          {doc.category || "General"} · {doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : ""} · {new Date(doc.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        doc.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-700"
                      }`}>
                        {doc.status || "Uploaded"}
                      </span>
                      <button
                        onClick={() => handleDownloadDocument(doc.id)}
                        disabled={downloadingDocId === doc.id}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#214ECF] text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        <ExternalLink size={12} /> {downloadingDocId === doc.id ? "Loading..." : "Secure Download"}
                      </button>
                      <button
                        onClick={() => handleToggleDocumentStatus(doc.id, doc.status)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                      >
                        {doc.status === "active" ? "Archive" : "Set Active"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* KYC TAB */}
        {detailTab === "kyc" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">KYC Verification Record</h3>
                <p className="text-xs text-slate-500">Authoritative verification gate for project submission</p>
              </div>
              <button
                onClick={() => setKycModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#214ECF] text-white hover:bg-blue-700 transition-colors shadow-2xs"
              >
                Take Decision
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50/70 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-xs text-slate-400 block">Current Status</span>
                <div className="mt-1">{renderKycBadge(clientDetail.kyc?.status)}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Submitted At</span>
                <span className="font-semibold text-slate-800">
                  {clientDetail.kyc?.submitted_at ? new Date(clientDetail.kyc.submitted_at).toLocaleString() : "Not submitted"}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Legal Entity Name</span>
                <span className="font-semibold text-slate-800">{clientDetail.kyc?.legal_name || clientDetail.company || "-"}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Business Reg / Tax ID</span>
                <span className="font-semibold text-slate-800">{clientDetail.kyc?.tax_id || clientDetail.kyc?.id_number || "-"}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Document Type</span>
                <span className="font-semibold text-slate-800">{clientDetail.kyc?.document_type || "Business License"}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Rejection / Review Notes</span>
                <span className="font-semibold text-slate-800">{clientDetail.kyc?.rejection_reason || "None"}</span>
              </div>
            </div>
          </div>
        )}

        {/* MEETINGS TAB */}
        {detailTab === "meetings" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Client Meetings & Consultations</h3>
                <p className="text-xs text-slate-500">Manage links, review requests, update passwords, and track sessions</p>
              </div>
            </div>
            {clientDetail.meetings.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No meetings or requests on record for this client.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {clientDetail.meetings.map((m) => (
                  <div key={m.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{m.title || "Meeting"}</span>
                        {m.is_request && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Client Request
                          </span>
                        )}
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          m.status === "confirmed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : m.status === "cancelled"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-blue-50 text-[#214ECF] border-blue-200"
                        }`}>
                          {m.status || "scheduled"}
                        </span>
                        {m.has_password && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 flex items-center gap-1">
                            <Lock size={10} /> Password Protected
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 flex flex-wrap gap-4">
                        <span>Project: <strong>{m.project_id ? `Project #${m.project_id}` : "General Consultation"}</strong></span>
                        <span>Start: <strong>{new Date(m.start_time).toLocaleString()}</strong></span>
                        {m.end_time && <span>End: <strong>{new Date(m.end_time).toLocaleString()}</strong></span>}
                        {m.created_at && <span>Created: <strong>{new Date(m.created_at).toLocaleDateString()}</strong></span>}
                      </div>

                      {m.agenda && (
                        <p className="text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 mt-1">
                          <strong>Agenda / Reason:</strong> {m.agenda}
                        </p>
                      )}

                      {m.meeting_link && (
                        <div className="pt-1">
                          <a href={m.meeting_link} target="_blank" rel="noreferrer" className="text-[#214ECF] hover:underline flex items-center gap-1 text-xs font-semibold">
                            Join Link: <span className="font-mono text-slate-700">{m.meeting_link}</span> <ExternalLink size={11} />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {m.has_password && (
                        <button
                          onClick={() => handleRevealMeetingPassword(m.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1"
                        >
                          <Eye size={12} /> View Password
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setEditingMeeting(m);
                          setMeetingLinkInput(m.meeting_link || "");
                          setMeetingPasswordInput("");
                          setMeetingStartsAt(m.start_time ? new Date(m.start_time).toISOString().slice(0, 16) : "");
                          setMeetingEndsAt(m.end_time ? new Date(m.end_time).toISOString().slice(0, 16) : "");
                          setMeetingAgendaInput(m.agenda || "");
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-[#214ECF] text-xs font-semibold hover:bg-blue-100 transition-colors"
                      >
                        Edit / Credentials
                      </button>

                      {m.status !== "confirmed" && m.status !== "cancelled" && (
                        <button
                          onClick={() => handleApproveMeeting(m.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1"
                        >
                          <Check size={12} /> Confirm / Approve
                        </button>
                      )}

                      {m.status !== "cancelled" && (
                        <button
                          onClick={() => handleCancelMeeting(m.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors flex items-center gap-1"
                        >
                          <X size={12} /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BILLING TAB */}
        {detailTab === "billing" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Invoices</h3>
            {clientDetail.invoices.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No invoices issued for this client yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Total</th>
                      <th className="py-2.5 px-3">Paid</th>
                      <th className="py-2.5 px-3">Balance Due</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientDetail.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-3 px-3 font-semibold text-slate-800">{inv.invoice_number || `INV-${inv.id}`}</td>
                        <td className="py-3 px-3 text-xs text-slate-500">{new Date(inv.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-3 font-semibold">${Number(inv.total || 0).toFixed(2)}</td>
                        <td className="py-3 px-3 text-emerald-600 font-semibold">${Number(inv.amount_paid || 0).toFixed(2)}</td>
                        <td className="py-3 px-3 text-amber-600 font-semibold">${Number(inv.balance_due || 0).toFixed(2)}</td>
                        <td className="py-3 px-3">
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700">
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* PAYMENTS TAB */}
        {detailTab === "payments" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Recorded Payments</h3>
            {clientDetail.payments.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No payment records found.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {clientDetail.payments.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-semibold text-slate-900">${Number(p.amount || 0).toFixed(2)}</span>
                      <span className="text-xs text-slate-400 ml-2">via {p.payment_method || "Direct Bank / Gateway"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 font-mono">{new Date(p.created_at).toLocaleString()}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700">
                        {p.status || "Completed"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CHAT TAB */}
        {detailTab === "chat" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Project Chat & Direct Communications</h3>
                <p className="text-xs text-slate-500">Human Admin Support only. Real messages recorded to Supabase.</p>
              </div>
              {clientDetail.projects && clientDetail.projects.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setNewChatProjectId(clientDetail.projects[0].id);
                    setNewChatSubject(`Project ${clientDetail.projects[0].name} Chat`);
                    setNewChatModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#214ECF] text-white hover:bg-blue-700 transition-colors shadow-2xs flex items-center gap-1.5"
                >
                  <Plus size={14} /> Start New Conversation
                </button>
              )}
            </div>

            <div className="h-64 overflow-y-auto border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3">
              {clientDetail.chat.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 space-y-2">
                  <p>No conversation messages yet.</p>
                  {clientDetail.projects && clientDetail.projects.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewChatProjectId(clientDetail.projects[0].id);
                        setNewChatSubject(`Project ${clientDetail.projects[0].name} Chat`);
                        setNewChatModalOpen(true);
                      }}
                      className="px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
                    >
                      Initialize Project Chat
                    </button>
                  )}
                </div>
              ) : (
                clientDetail.chat.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender_type === "admin" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-md p-3 rounded-2xl text-xs ${
                        msg.sender_type === "admin"
                          ? "bg-[#214ECF] text-white rounded-br-none"
                          : "bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-2xs"
                      }`}
                    >
                      <p>{msg.content}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 font-mono">
                      {msg.sender_type === "admin" ? "Admin" : "Client"} · {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendChatMessage} className="flex gap-2">
              <input
                type="text"
                placeholder="Type reply to client..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
              />
              <button
                type="submit"
                disabled={sendingChatMessage || !chatMessage.trim()}
                className="px-4 py-2 bg-[#214ECF] text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send size={14} /> Send Reply
              </button>
            </form>
          </div>
        )}

        {/* UPDATES TAB */}
        {detailTab === "updates" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Operational Updates & Client CRM Broadcasts</h3>
                <p className="text-xs text-slate-500">
                  Send progress reports, completed milestones, pending deliverables, or operational notices. Dispatches directly to the client dashboard.
                </p>
              </div>
              <button
                onClick={() => setOpUpdateModalOpen(true)}
                className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold bg-[#214ECF] text-white hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer flex-shrink-0"
              >
                <Plus size={14} /> Send Operational Update
              </button>
            </div>

            {clientDetail.updates.length === 0 ? (
              <div className="py-16 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 p-6">
                <AlertCircle size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-700">No operational updates issued yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Click "Send Operational Update" to publish progress or milestone notices.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clientDetail.updates.map((u) => (
                  <div key={u.id} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#214ECF]/30 transition-colors shadow-2xs space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{u.title}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#214ECF] border border-blue-200 capitalize">
                          {u.category || "Operational Update"}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(u.created_at || u.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {u.message || u.body}
                    </p>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Sender: <strong className="text-slate-600">Admin Operations</strong></span>
                      <span className="capitalize text-emerald-600 font-semibold">● Published & Notified</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONTACT DETAILS TAB */}
        {detailTab === "contact" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">Complete Client Profile & Contact Dossier</h3>
                <p className="text-xs text-slate-500">Official registered profile and enterprise contact details stored in Supabase</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Identity & Organization</h4>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Full Name:</span>
                      <span className="font-bold text-slate-900 text-sm mt-0.5 block">{clientDetail.fullName || clientDetail.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Company / Organization:</span>
                      <span className="font-bold text-slate-900 text-sm mt-0.5 block">{clientDetail.company || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Account Status:</span>
                      <div className="mt-1">{renderStatusBadge(clientDetail.isActive, clientDetail.accountStatus)}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Communication & Location</h4>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Primary Email Address:</span>
                      <span className="font-semibold text-slate-900 text-sm mt-0.5 block">{clientDetail.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Direct Phone Number:</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">{clientDetail.phone || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Country of Incorporation:</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">{clientDetail.country || "Global"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Security & Account Identifiers</h4>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Client Unique Identifier (UUID):</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-mono text-[11px] bg-slate-100 px-2 py-1 rounded-lg text-slate-700 select-all font-semibold">
                          {clientDetail.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(clientDetail.id);
                            alert("Copied Client UUID to clipboard!");
                          }}
                          className="p-1 text-slate-400 hover:text-[#214ECF]"
                          title="Copy UUID"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block">KYC Verification Standing:</span>
                      <div className="mt-1">{renderKycBadge(clientDetail.kyc?.status)}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Registration Timestamp:</span>
                      <span className="font-mono text-slate-600 mt-0.5 block">
                        {new Date(clientDetail.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUPPORT TICKETS TAB */}
        {detailTab === "support" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Support Tickets</h3>
                <p className="text-xs text-slate-500">Track inquiries, provide replies, manage internal notes, and change status</p>
              </div>
            </div>
            {clientDetail.tickets.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No support tickets opened by this client.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {clientDetail.tickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedAdminTicket(t);
                      setAdminTicketReply("");
                      setAdminTicketIsInternal(false);
                    }}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 p-3 rounded-xl transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">{t.subject}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {t.ticket_number || `TKT-${t.id}`}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-3">
                        <span>Category: <strong>{t.category || "General"}</strong></span>
                        <span>Priority: <strong className="capitalize">{t.priority}</strong></span>
                        <span>Date: <strong>{new Date(t.created_at).toLocaleDateString()}</strong></span>
                        <span>Replies: <strong>{(t.ticket_messages || []).length}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                        t.status === "open"
                          ? "bg-blue-50 text-[#214ECF] border-blue-200"
                          : t.status === "resolved" || t.status === "closed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {t.status}
                      </span>
                      <button
                        type="button"
                        className="px-3 py-1 bg-[#214ECF] text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Open Ticket →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {detailTab === "attendance" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Authorized BPO Workforce Attendance</h3>
                <p className="text-xs text-slate-500">Real verified attendance aggregated from active delivery centres</p>
              </div>
            </div>
            {clientDetail.attendance.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No attendance records logged for this client's projects.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">BPO Partner</th>
                      <th className="py-2.5 px-3">Delivery Centre</th>
                      <th className="py-2.5 px-3">Worked Duration</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientDetail.attendance.map((att) => {
                      const mins = Math.floor((att.durationSeconds || 0) / 60);
                      const hrs = Math.floor(mins / 60);
                      const remMins = mins % 60;
                      return (
                        <tr key={att.id}>
                          <td className="py-3 px-3 text-xs text-slate-700 font-mono">{att.date}</td>
                          <td className="py-3 px-3 font-semibold text-slate-800">{att.partnerName}</td>
                          <td className="py-3 px-3 text-xs text-slate-500">{att.centreName}</td>
                          <td className="py-3 px-3 text-xs font-semibold text-slate-800">
                            {hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`}
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700">
                              {att.status || "Completed"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* COMPLETE CHRONOLOGICAL ACTIVITY / AUDIT TIMELINE TAB */}
        {detailTab === "audit" && (() => {
          // Synthesize full chronological activity timeline from real Supabase records
          const timeline: Array<{
            id: string;
            timestamp: string;
            type: string;
            title: string;
            description: string;
            badge?: string;
            badgeColor?: string;
            tabLink?: string;
          }> = [];

          // 1. Account Creation
          if (clientDetail.createdAt) {
            timeline.push({
              id: "account_created",
              timestamp: clientDetail.createdAt,
              type: "account",
              title: "Account Registered & Activated",
              description: `Client account created for ${clientDetail.fullName || clientDetail.name} (${clientDetail.company || "Direct"}).`,
              badge: "Account",
              badgeColor: "bg-blue-100 text-blue-800",
              tabLink: "contact",
            });
          }

          // 2. Projects Created / Status
          (clientDetail.projects || []).forEach((p: any) => {
            timeline.push({
              id: `prj_${p.id}`,
              timestamp: p.created_at || p.createdAt || clientDetail.createdAt,
              type: "project",
              title: `Project Submitted: ${p.name}`,
              description: `Submitted ${p.process_type || p.project_type || "Operations"} campaign requiring ${p.required_seats || 20} seats. Status: ${p.status}.`,
              badge: "Project",
              badgeColor: "bg-indigo-100 text-indigo-800",
              tabLink: "projects",
            });
          });

          // 3. Updates Sent by Admin
          (clientDetail.updates || []).forEach((u: any) => {
            timeline.push({
              id: `update_${u.id}`,
              timestamp: u.created_at || u.createdAt,
              type: "update",
              title: `Operational Update: ${u.title}`,
              description: u.message || u.body || "Update dispatched to client portal.",
              badge: u.category || "Update",
              badgeColor: "bg-emerald-100 text-emerald-800",
              tabLink: "updates",
            });
          });

          // 4. Support Tickets
          (clientDetail.tickets || []).forEach((t: any) => {
            timeline.push({
              id: `ticket_${t.id}`,
              timestamp: t.created_at,
              type: "ticket",
              title: `Ticket Created: ${t.subject}`,
              description: `Priority: ${t.priority} · Status: ${t.status} · ${(t.ticket_messages || []).length} message(s).`,
              badge: "Ticket",
              badgeColor: "bg-amber-100 text-amber-800",
              tabLink: "support",
            });
          });

          // 5. Invoices & Billing
          (clientDetail.invoices || []).forEach((inv: any) => {
            timeline.push({
              id: `inv_${inv.id}`,
              timestamp: inv.created_at || inv.invoice_date,
              type: "billing",
              title: `Invoice Generated: ${inv.invoice_number || `INV-${inv.id}`}`,
              description: `Total Amount: $${(inv.total_amount || 0).toLocaleString()} · Status: ${inv.status}.`,
              badge: "Billing",
              badgeColor: "bg-teal-100 text-teal-800",
              tabLink: "billing",
            });
          });

          // 6. Payments
          (clientDetail.payments || []).forEach((pmt: any) => {
            timeline.push({
              id: `pmt_${pmt.id}`,
              timestamp: pmt.created_at || pmt.payment_date,
              type: "payment",
              title: `Payment Recorded: $${(pmt.amount || 0).toLocaleString()}`,
              description: `Method: ${pmt.payment_method || "Manual"} · Reference: ${pmt.reference || "None"}.`,
              badge: "Payment",
              badgeColor: "bg-emerald-100 text-emerald-800",
              tabLink: "payments",
            });
          });

          // 7. Documents
          (clientDetail.documents || []).forEach((doc: any) => {
            timeline.push({
              id: `doc_${doc.id}`,
              timestamp: doc.created_at,
              type: "document",
              title: `Document Uploaded: ${doc.original_file_name}`,
              description: `Category: ${doc.category || "General"} · Status: ${doc.status || "active"}.`,
              badge: "Document",
              badgeColor: "bg-purple-100 text-purple-800",
              tabLink: "documents",
            });
          });

          // 8. Meetings
          (clientDetail.meetings || []).forEach((m: any) => {
            timeline.push({
              id: `meeting_${m.id}`,
              timestamp: m.created_at || m.starts_at,
              type: "meeting",
              title: `Meeting Scheduled: ${m.title}`,
              description: `Status: ${m.status || "scheduled"} · Starts: ${m.starts_at ? new Date(m.starts_at).toLocaleString() : "TBD"}.`,
              badge: "Meeting",
              badgeColor: "bg-sky-100 text-sky-800",
              tabLink: "meetings",
            });
          });

          // 9. KYC Events
          if (clientDetail.kyc?.submitted_at) {
            timeline.push({
              id: "kyc_submitted",
              timestamp: clientDetail.kyc.submitted_at,
              type: "kyc",
              title: `KYC Submission: ${clientDetail.kyc.document_type || "Government ID"}`,
              description: `Status: ${clientDetail.kyc.status} · Country: ${clientDetail.kyc.country || "—"}.`,
              badge: "KYC",
              badgeColor: "bg-amber-100 text-amber-800",
              tabLink: "kyc",
            });
          }

          // 10. Raw Audit Logs
          (clientDetail.auditLogs || []).forEach((log: any) => {
            timeline.push({
              id: `log_${log.id}`,
              timestamp: log.created_at,
              type: "audit",
              title: `Audit: ${log.action}`,
              description: `Initiated by ${log.actor_admin_id ? "System Admin" : "User Client"}.`,
              badge: "System",
              badgeColor: "bg-slate-100 text-slate-700",
            });
          });

          // Sort chronologically descending
          timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          return (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Chronological Client Lifecycle & Audit Timeline</h3>
                  <p className="text-xs text-slate-500">
                    Comprehensive chronological record across projects, updates, communications, billing, documents, and KYC.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#214ECF]">
                  {timeline.length} Total Events
                </span>
              </div>

              {timeline.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">No lifecycle activity logged for this client yet.</div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {timeline.map((event) => (
                    <div key={event.id} className="relative group">
                      <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 border-white bg-[#214ECF] shadow-xs group-hover:scale-125 transition-transform" />
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-[#214ECF]/30 hover:bg-slate-50/50 transition-all shadow-2xs space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{event.title}</span>
                            {event.badge && (
                              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${event.badgeColor || "bg-slate-100 text-slate-600"}`}>
                                {event.badge}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{event.description}</p>
                        {event.tabLink && (
                          <button
                            type="button"
                            onClick={() => setDetailTab(event.tabLink as any)}
                            className="text-[11px] font-bold text-[#214ECF] hover:underline inline-flex items-center gap-1 pt-1"
                          >
                            <span>Open {event.badge || "Tab"} Details</span> →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* MODAL: Send Operational Progress Update */}
        {opUpdateModalOpen && clientDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center border border-blue-100">
                    <Activity size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">Send Operational Update</h4>
                    <p className="text-[11px] text-slate-500">
                      Dispatches to <strong className="text-slate-800">{clientDetail.fullName || clientDetail.name}</strong> ({clientDetail.company || "No Company"})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpUpdateModalOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSendClientUpdate} className="space-y-4 mt-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Update Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={updateCategory}
                    onChange={(e) => setUpdateCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="Progress">Progress Update</option>
                    <option value="Completed Work">Completed Work</option>
                    <option value="Pending Work">Pending Work / Blockers</option>
                    <option value="Scope Change">Scope / Requirements Change</option>
                    <option value="Milestone">Milestone Achieved</option>
                    <option value="Payment / Billing">Payment / Billing Status</option>
                    <option value="Notice">Operational Notice</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Update Title / Headline <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sprint 2 Inbound Agent Onboarding Complete"
                    value={updateTitle}
                    onChange={(e) => setUpdateTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Details & Operations Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe progress, completed deliverables, upcoming tasks, or operational updates for the client..."
                    value={updateMessage}
                    onChange={(e) => setUpdateMessage(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-[#214ECF] flex items-start gap-2">
                  <Bell size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Publishing this operational update creates a real Supabase record and sends a direct real-time notification to the client's notification center.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpUpdateModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingUpdate || !updateTitle.trim() || !updateMessage.trim()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#214ECF] text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    <Send size={13} />
                    {sendingUpdate ? "Dispatching..." : "Publish & Notify Client"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Send Notification / Notice */}
        {notifModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-base">Send Notice to Client</h4>
                <button onClick={() => setNotifModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSendNotification} className="space-y-4 mt-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Subject / Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Notice title..."
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Message Body</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Enter details..."
                    value={notifBody}
                    onChange={(e) => setNotifBody(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={notifType}
                    onChange={(e) => setNotifType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="admin_update">Admin Operational Update</option>
                    <option value="project_update">Project Notice</option>
                    <option value="billing_update">Billing Notice</option>
                    <option value="kyc_update">KYC Notice</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setNotifModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingNotif}
                    className="px-4 py-2 bg-[#214ECF] text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {sendingNotif ? "Sending..." : "Dispatch Notice"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: KYC Review */}
        {kycModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-base">KYC Verification Review</h4>
                <button onClick={() => setKycModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleReviewKyc} className="space-y-4 mt-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Decision</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "approved", label: "Approve", color: "emerald" },
                      { id: "changes_requested", label: "Resubmit", color: "amber" },
                      { id: "rejected", label: "Reject", color: "red" },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => setKycAction(btn.id as any)}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                          kycAction === btn.id
                            ? "bg-[#214ECF] text-white border-[#214ECF] shadow-2xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Reason / Instructions for Client</label>
                  <textarea
                    rows={3}
                    placeholder="Reason or instructions if rejected or requesting resubmission..."
                    value={kycReason}
                    onChange={(e) => setKycReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setKycModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingKycReview}
                    className="px-4 py-2 bg-[#214ECF] text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submittingKycReview ? "Saving..." : "Confirm Review"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Cancel Project */}
        {cancellingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                    <AlertTriangle size={16} />
                  </div>
                  <h4 className="font-bold text-slate-900 text-base">Cancel Project?</h4>
                </div>
                <button
                  onClick={() => setCancellingProject(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Project:</span>
                  <span className="font-bold text-slate-900">{cancellingProject.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Client:</span>
                  <span className="font-semibold text-slate-800">{clientDetail.fullName || clientDetail.name} ({clientDetail.company || "No Company"})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Status:</span>
                  <span className="font-semibold text-blue-600 uppercase">{cancellingProject.status}</span>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                This will transition the project to <strong className="text-red-600">CANCELLED</strong> status, record the reason in immutable audit logs, and notify the client. Historical invoices, payments, and documents will be fully preserved.
              </p>

              <form onSubmit={handleCancelProject} className="space-y-4 mt-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Cancellation Reason <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="Client requested cancellation">Client requested cancellation</option>
                    <option value="Scope discontinued / strategic pivot">Scope discontinued / strategic pivot</option>
                    <option value="Budget cut / funding changes">Budget cut / funding changes</option>
                    <option value="Contract breach or non-payment">Contract breach or non-payment</option>
                    <option value="Mutual termination agreement">Mutual termination agreement</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Internal Notes / Audit Details (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide additional context for operations and audit trail..."
                    value={cancellationNotes}
                    onChange={(e) => setCancellationNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCancellingProject(null)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCancellation}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {submittingCancellation ? "Cancelling..." : "Confirm Cancellation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Edit Meeting Details & Credentials */}
        {editingMeeting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-base">Edit Meeting & Access Credentials</h4>
                  <p className="text-xs text-slate-400">Update conference link, encrypted password, and schedule</p>
                </div>
                <button onClick={() => setEditingMeeting(null)} className="text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveMeetingDetails} className="space-y-4 mt-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Meeting Link (Google Meet / Zoom / Teams)</label>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/... or https://zoom.us/j/..."
                    value={meetingLinkInput}
                    onChange={(e) => setMeetingLinkInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Meeting Access Password (Optional)</label>
                  <input
                    type="text"
                    placeholder="Enter passkey / PIN (will be securely encrypted)"
                    value={meetingPasswordInput}
                    onChange={(e) => setMeetingPasswordInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Never stored in plaintext. Encrypted server-side with AES-256 before Supabase persistence.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Starts At</label>
                    <input
                      type="datetime-local"
                      value={meetingStartsAt}
                      onChange={(e) => setMeetingStartsAt(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Ends At</label>
                    <input
                      type="datetime-local"
                      value={meetingEndsAt}
                      onChange={(e) => setMeetingEndsAt(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Agenda / Meeting Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Meeting objectives and discussion points..."
                    value={meetingAgendaInput}
                    onChange={(e) => setMeetingAgendaInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingMeeting(null)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingMeeting}
                    className="px-4 py-2 bg-[#214ECF] text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {savingMeeting ? "Saving..." : "Save Meeting Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Revealed Meeting Password */}
        {revealedMeetingPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm">Meeting Passcode</h4>
                <button onClick={() => setRevealedMeetingPassword(null)} className="text-slate-400 hover:text-slate-700">
                  <X size={16} />
                </button>
              </div>
              <div className="py-4 text-center">
                {revealedMeetingPassword.loading ? (
                  <p className="text-xs text-slate-400">Decrypting credentials...</p>
                ) : (
                  <div className="space-y-3">
                    <span className="text-xs text-slate-500 block">Authorized Access Key:</span>
                    <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-[#214ECF] tracking-wider select-all">
                      {revealedMeetingPassword.password}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setRevealedMeetingPassword(null)}
                  className="w-full py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Start New Project Conversation */}
        {newChatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-base">Start Project Conversation</h4>
                <button onClick={() => setNewChatModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleStartProjectConversation} className="space-y-4 mt-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Select Client Project</label>
                  <select
                    required
                    value={newChatProjectId || ""}
                    onChange={(e) => setNewChatProjectId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="">Select project...</option>
                    {(clientDetail.projects || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (ID: {p.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Conversation Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Operations & Milestone Check-in"
                    value={newChatSubject}
                    onChange={(e) => setNewChatSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setNewChatModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingChat || !newChatProjectId || !newChatSubject.trim()}
                    className="px-4 py-2 bg-[#214ECF] text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {creatingChat ? "Starting..." : "Start Chat"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Ticket Detail & Reply Thread */}
        {selectedAdminTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-base">{selectedAdminTicket.subject}</h4>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {selectedAdminTicket.ticket_number || `TKT-${selectedAdminTicket.id}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Category: {selectedAdminTicket.category} · Opened on {new Date(selectedAdminTicket.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => setSelectedAdminTicket(null)} className="text-slate-400 hover:text-slate-700">
                  <X size={20} />
                </button>
              </div>

              {/* Status and Priority Controls */}
              <div className="grid grid-cols-2 gap-4 py-3 bg-slate-50/70 px-4 rounded-xl border border-slate-100 mt-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Ticket Status</label>
                  <select
                    value={selectedAdminTicket.status}
                    onChange={(e) => handleUpdateTicketStatus(selectedAdminTicket.id, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="open">OPEN</option>
                    <option value="in_progress">IN PROGRESS</option>
                    <option value="waiting_for_requester">WAITING FOR CLIENT</option>
                    <option value="resolved">RESOLVED</option>
                    <option value="closed">CLOSED</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Priority</label>
                  <select
                    value={selectedAdminTicket.priority}
                    onChange={(e) => handleUpdateTicketPriority(selectedAdminTicket.id, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#214ECF]"
                  >
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                    <option value="urgent">URGENT</option>
                  </select>
                </div>
              </div>

              {/* Issue Description */}
              <div className="mt-3 p-3 bg-blue-50/40 border border-blue-100 rounded-xl text-xs space-y-1">
                <span className="font-bold text-slate-700 block">Initial Issue Description:</span>
                <p className="text-slate-700 whitespace-pre-wrap">{selectedAdminTicket.description}</p>
              </div>

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto my-3 space-y-3 pr-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">
                  Conversation & Internal Notes ({((selectedAdminTicket.ticket_messages || []).length)})
                </div>
                {(!selectedAdminTicket.ticket_messages || selectedAdminTicket.ticket_messages.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">No replies recorded yet.</p>
                ) : (
                  selectedAdminTicket.ticket_messages.map((m: any) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        m.is_internal
                          ? "bg-amber-50/60 border-amber-200 text-amber-900"
                          : m.author_admin_id
                          ? "bg-blue-50/60 border-blue-200 text-blue-950"
                          : "bg-white border-slate-200 text-slate-800 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                          {m.is_internal ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 uppercase">
                              Internal Admin Note
                            </span>
                          ) : m.author_admin_id ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#214ECF] text-white">
                              Admin Staff Reply
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              Client Message
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(m.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendTicketReply} className="pt-3 border-t border-slate-100 space-y-2">
                <textarea
                  required
                  rows={3}
                  placeholder={adminTicketIsInternal ? "Add internal note (only visible to Thinkatic staff)..." : "Write reply to client..."}
                  value={adminTicketReply}
                  onChange={(e) => setAdminTicketReply(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminTicketIsInternal}
                      onChange={(e) => setAdminTicketIsInternal(e.target.checked)}
                      className="rounded text-[#214ECF] focus:ring-0"
                    />
                    <span>Post as Internal Admin Note</span>
                  </label>

                  <button
                    type="submit"
                    disabled={sendingAdminTicketReply || !adminTicketReply.trim()}
                    className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                      adminTicketIsInternal ? "bg-amber-600 hover:bg-amber-700" : "bg-[#214ECF] hover:bg-blue-700"
                    }`}
                  >
                    <Send size={12} /> {sendingAdminTicketReply ? "Posting..." : adminTicketIsInternal ? "Add Internal Note" : "Send Client Reply"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Filter clients by project status
  const displayedClients = clients.filter((c) => {
    if (projectFilter === "with_projects") {
      return (c.activeProjectsCount || 0) > 0 || (c.totalProjectsCount || 0) > 0;
    }
    if (projectFilter === "no_projects") {
      return (c.activeProjectsCount || 0) === 0 && (c.totalProjectsCount || 0) === 0;
    }
    return true;
  });

  // CLIENTS LIST TABLE VIEW
  return (
    <div className="space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Clients Control Centre</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational client management, KYC oversight, plan status, project eligibility and financial visibility.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#214ECF] border border-blue-100">
            {clients.length} Registered Clients
          </span>
          <button
            onClick={() => fetchClients()}
            disabled={loading}
            className="p-2 rounded-xl text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Client List"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-[#214ECF]" : ""} />
          </button>
        </div>
      </div>

      {/* 7 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Registered</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
              <Users size={14} />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900">
            <AnimatedCounter value={kpis.registeredClients} />
          </div>
          <span className="text-[10px] text-slate-400">Total accounts</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck size={14} />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600">
            <AnimatedCounter value={kpis.activeClients} />
          </div>
          <span className="text-[10px] text-slate-400">Authorized & active</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">KYC Pending</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={14} />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-600">
            <AnimatedCounter value={kpis.kycPending} />
          </div>
          <span className="text-[10px] text-slate-400">Needs review</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">KYC Approved</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
              <ShieldCheck size={14} />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900">
            <AnimatedCounter value={kpis.kycApproved} />
          </div>
          <span className="text-[10px] text-slate-400">Verified status</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Plans</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Tag size={14} />
            </div>
          </div>
          <div className="text-xl font-bold text-indigo-600">
            <AnimatedCounter value={kpis.clientsWithActivePlans} />
          </div>
          <span className="text-[10px] text-slate-400">Subscribed clients</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">With Projects</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FolderKanban size={14} />
            </div>
          </div>
          <div className="text-xl font-bold text-purple-600">
            <AnimatedCounter value={kpis.clientsWithProjects} />
          </div>
          <span className="text-[10px] text-slate-400">Allocated projects</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Balance Due</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <DollarSign size={14} />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900">
            <AnimatedCounter value={kpis.outstandingBalance} prefix="$" />
          </div>
          <span className="text-[10px] text-slate-400">Outstanding balance</span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, company, or ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#214ECF]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl text-slate-700 bg-white focus:outline-none focus:border-[#214ECF]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="deactivated">Deactivated</option>
        </select>

        <select
          value={kycFilter}
          onChange={(e) => setKycFilter(e.target.value)}
          className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl text-slate-700 bg-white focus:outline-none focus:border-[#214ECF]"
        >
          <option value="all">All KYC Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Under Review</option>
          <option value="unsubmitted">Unsubmitted</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl text-slate-700 bg-white focus:outline-none focus:border-[#214ECF]"
        >
          <option value="all">All Plans</option>
          <option value="enterprise">Enterprise</option>
          <option value="cloud">Cloud</option>
          <option value="modernization">Modernization</option>
          <option value="data">Data</option>
          <option value="cybersecurity">Cybersecurity</option>
          <option value="none">No Plan</option>
        </select>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl text-slate-700 bg-white focus:outline-none focus:border-[#214ECF]"
        >
          <option value="all">All Project States</option>
          <option value="with_projects">Has Projects</option>
          <option value="no_projects">No Projects</option>
        </select>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full border-2 border-slate-200 border-t-[#214ECF] w-8 h-8" />
            <span className="text-xs text-slate-500 font-medium">Loading Thinkatic Clients...</span>
          </div>
        ) : displayedClients.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            No clients match the specified search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">KYC</th>
                  <th className="py-3 px-4">Active Plan</th>
                  <th className="py-3 px-4 text-center">Projects</th>
                  <th className="py-3 px-4 text-center">Meetings</th>
                  <th className="py-3 px-4">Financials</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedClients.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => loadClientDetail(c.id)}
                    className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100 flex items-center justify-center font-bold text-xs group-hover:bg-[#214ECF] group-hover:text-white transition-colors">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          {((c.unreadCount ?? 0) > 0 || (c.unreadNotificationsCount ?? 0) > 0 || (c.unreadTicketsCount ?? 0) > 0) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkClientRead(c.id, "updates");
                              }}
                              title={`${(c.unreadCount || c.unreadNotificationsCount || 0) + (c.unreadTicketsCount || 0)} unread items. Click to mark as read.`}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-white animate-pulse hover:scale-125 transition-transform"
                            >
                              {(c.unreadCount || c.unreadNotificationsCount || 0) + (c.unreadTicketsCount || 0)}
                            </button>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 group-hover:text-[#214ECF] transition-colors">
                              {c.name}
                            </span>
                            {((c.unreadCount ?? 0) > 0 || (c.unreadTicketsCount ?? 0) > 0) && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                                New Activity
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                      {c.company || "-"}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(c.isActive, c.accountStatus)}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderKycBadge(c.kycStatus)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800">
                        {c.activePlan || "None"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-xs text-slate-700">
                      {c.activeProjectsCount}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-xs text-slate-700">
                      {c.meetingsCount}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <div className="font-semibold text-slate-800">
                        ${c.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      </div>
                      {c.balanceDue > 0 && (
                        <div className="text-[11px] text-amber-600 font-medium">
                          Due: ${c.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {((c.unreadCount ?? 0) > 0 || (c.unreadTicketsCount ?? 0) > 0) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkClientRead(c.id, "updates");
                            }}
                            className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                            title="Mark notifications read and open CRM"
                          >
                            <Bell size={13} className="text-amber-600 animate-bounce" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadClientDetail(c.id);
                          }}
                          className="inline-flex items-center justify-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold bg-[#214ECF] text-white hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                        >
                          <Eye size={12} /> View CRM
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
