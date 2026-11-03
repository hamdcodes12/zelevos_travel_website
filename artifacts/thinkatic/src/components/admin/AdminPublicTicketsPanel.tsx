import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  Ticket,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Lock,
  ArrowRight,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Send,
  Building2,
  Mail,
  Phone,
  FileText,
  Calendar,
  X,
  History,
  ShieldCheck,
  Tag,
  Paperclip,
} from "lucide-react";

interface PublicTicket {
  id: string;
  ticketNumber: string;
  fullName: string;
  email: string;
  companyName: string | null;
  phone: string | null;
  requestType: string;
  subject: string;
  message: string;
  status: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_CUSTOMER" | "RESOLVED" | "CLOSED";
  priority: "low" | "medium" | "high" | "urgent";
  assignedAdminId: number | null;
  assignedAdminName: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  attachmentData: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: "customer" | "admin";
  senderName: string;
  senderEmail: string | null;
  message: string;
  createdAt: string;
}

interface TicketInternalNote {
  id: string;
  ticketId: string;
  adminId: number;
  adminName: string;
  note: string;
  createdAt: string;
}

interface TicketAuditLog {
  id: string;
  ticketId: string;
  actorType: "system" | "public" | "admin";
  actorId: string | null;
  actorName: string | null;
  action: string;
  details: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

interface Stats {
  newCount: number;
  openCount: number;
  inProgressCount: number;
  waitingCount: number;
  resolvedCount: number;
  closedCount: number;
  totalCount: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  NEW: { label: "NEW", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  OPEN: { label: "OPEN", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  IN_PROGRESS: {
    label: "IN PROGRESS",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
  },
  WAITING_FOR_CUSTOMER: {
    label: "WAITING",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  RESOLVED: {
    label: "RESOLVED",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  CLOSED: { label: "CLOSED", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300" },
};

const PRIORITY_CONFIG: Record<string, { label: string; badge: string }> = {
  low: { label: "Low", badge: "bg-slate-100 text-slate-700 border-slate-200" },
  medium: { label: "Medium", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  high: { label: "High", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  urgent: { label: "Urgent", badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

export default function AdminPublicTicketsPanel({
  apiCall,
}: {
  apiCall: (path: string, options?: RequestInit) => Promise<Response>;
}) {
  const [stats, setStats] = useState<Stats>({
    newCount: 0,
    openCount: 0,
    inProgressCount: 0,
    waitingCount: 0,
    resolvedCount: 0,
    closedCount: 0,
    totalCount: 0,
  });

  const [tickets, setTickets] = useState<PublicTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Selected Ticket Detail View
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<{
    ticket: PublicTicket;
    messages: TicketMessage[];
    internalNotes: TicketInternalNote[];
    auditLogs: TicketAuditLog[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Actions
  const [replyText, setReplyText] = useState("");
  const [internalNoteText, setInternalNoteText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await apiCall("/admin/public-tickets/stats");
      if (res.ok) {
        const body = await res.json();
        if (body.stats) setStats(body.stats);
      }
    } catch (e) {
      console.error("Error fetching ticket stats:", e);
    }
  }, [apiCall]);

  // Fetch Tickets List
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "15",
        status: statusFilter,
        requestType: typeFilter,
        priority: priorityFilter,
        search,
      });

      const res = await apiCall(`/admin/public-tickets?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        setTickets(body.tickets || []);
        setTotal(body.total || 0);
        setTotalPages(body.totalPages || 1);
      }
    } catch (e) {
      console.error("Error listing public tickets:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiCall, page, statusFilter, typeFilter, priorityFilter, search]);

  // Fetch Single Ticket Detail
  const fetchTicketDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      try {
        const res = await apiCall(`/admin/public-tickets/${id}`);
        if (res.ok) {
          const body = await res.json();
          setTicketDetail(body);
        }
      } catch (e) {
        console.error("Error fetching ticket detail:", e);
      } finally {
        setDetailLoading(false);
      }
    },
    [apiCall]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (selectedTicketId) {
      fetchTicketDetail(selectedTicketId);
    } else {
      setTicketDetail(null);
    }
  }, [selectedTicketId, fetchTicketDetail]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchTickets()]);
    if (selectedTicketId) await fetchTicketDetail(selectedTicketId);
  };

  // Submit Reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyText.trim() || actionLoading) return;
    setActionLoading(true);

    try {
      const res = await apiCall(`/admin/public-tickets/${selectedTicketId}/replies`, {
        method: "POST",
        body: JSON.stringify({ message: replyText.trim() }),
      });
      if (res.ok) {
        setReplyText("");
        await fetchTicketDetail(selectedTicketId);
        await fetchStats();
        await fetchTickets();
      }
    } catch (e) {
      console.error("Error sending reply:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Internal Note
  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !internalNoteText.trim() || actionLoading) return;
    setActionLoading(true);

    try {
      const res = await apiCall(`/admin/public-tickets/${selectedTicketId}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: internalNoteText.trim() }),
      });
      if (res.ok) {
        setInternalNoteText("");
        await fetchTicketDetail(selectedTicketId);
      }
    } catch (e) {
      console.error("Error adding internal note:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Update Status / Priority
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicketId || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/public-tickets/${selectedTicketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchTicketDetail(selectedTicketId);
        await fetchStats();
        await fetchTickets();
      }
    } catch (e) {
      console.error("Error updating ticket status:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePriority = async (newPriority: string) => {
    if (!selectedTicketId || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/public-tickets/${selectedTicketId}`, {
        method: "PATCH",
        body: JSON.stringify({ priority: newPriority }),
      });
      if (res.ok) {
        await fetchTicketDetail(selectedTicketId);
        await fetchTickets();
      }
    } catch (e) {
      console.error("Error updating priority:", e);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <Ticket className="h-6 w-6 text-[#214ECF]" />
            <span>Public Support Tickets</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage, review, reply, and resolve public support requests and enquiries.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#214ECF] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-[#214ECF]" : "text-slate-500"} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Section 17) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {[
          { label: "NEW", count: stats.newCount, color: "text-blue-600", bg: "bg-blue-50/80", border: "border-blue-100", statusKey: "NEW" },
          { label: "OPEN", count: stats.openCount, color: "text-amber-600", bg: "bg-amber-50/80", border: "border-amber-100", statusKey: "OPEN" },
          { label: "IN PROGRESS", count: stats.inProgressCount, color: "text-indigo-600", bg: "bg-indigo-50/80", border: "border-indigo-100", statusKey: "IN_PROGRESS" },
          { label: "WAITING", count: stats.waitingCount, color: "text-purple-600", bg: "bg-purple-50/80", border: "border-purple-100", statusKey: "WAITING_FOR_CUSTOMER" },
          { label: "RESOLVED", count: stats.resolvedCount, color: "text-emerald-600", bg: "bg-emerald-50/80", border: "border-emerald-100", statusKey: "RESOLVED" },
        ].map((card) => {
          const isActive = statusFilter === card.statusKey;
          return (
            <div
              key={card.label}
              onClick={() => {
                setStatusFilter(isActive ? "ALL" : card.statusKey);
                setPage(1);
              }}
              className={`rounded-2xl border p-4 transition-all cursor-pointer ${card.bg} ${card.border} ${
                isActive ? "ring-2 ring-[#214ECF] shadow-md" : "hover:shadow-xs hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  {card.label}
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {isActive ? "Active Filter" : "Filter"}
                </span>
              </div>
              <div className={`mt-2 text-2xl sm:text-3xl font-black ${card.color}`}>
                {card.count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Area: Split View when ticket is selected */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Tickets Table & Filters */}
        <div className={selectedTicketId ? "lg:col-span-6 space-y-4" : "lg:col-span-12 space-y-4"}>
          {/* Search & Filter Toolbar */}
          <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Field */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Ticket ID, Name, Email, Company, Subject..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/10"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-hidden focus:border-[#214ECF] cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="NEW">NEW</option>
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="WAITING_FOR_CUSTOMER">WAITING FOR CUSTOMER</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>

              {/* Priority Filter */}
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-hidden focus:border-[#214ECF] cursor-pointer"
              >
                <option value="ALL">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-bold">Ticket ID</th>
                    <th className="py-3 px-4 font-bold">Requester</th>
                    <th className="py-3 px-4 font-bold">Subject</th>
                    <th className="py-3 px-4 font-bold">Type</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold">Priority</th>
                    <th className="py-3 px-4 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-3.5 px-4"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="h-4 w-28 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="h-4 w-40 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
                        <td className="py-3.5 px-4"><div className="h-4 w-16 bg-slate-200 rounded-full" /></td>
                        <td className="py-3.5 px-4"><div className="h-4 w-14 bg-slate-100 rounded-full" /></td>
                        <td className="py-3.5 px-4"><div className="h-4 w-16 bg-slate-100 rounded" /></td>
                      </tr>
                    ))
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Ticket className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        <span className="font-semibold text-slate-600 block text-sm">No Tickets Found</span>
                        <span className="text-xs">Try adjusting your search query or filters.</span>
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t) => {
                      const isSelected = selectedTicketId === t.id;
                      const statusStyle = STATUS_CONFIG[t.status] || STATUS_CONFIG.NEW;
                      const priorityStyle = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;

                      return (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTicketId(isSelected ? null : t.id)}
                          className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${
                            isSelected ? "bg-blue-50/80 font-medium border-l-4 border-l-[#214ECF]" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-[#214ECF]">
                            {t.ticketNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block truncate max-w-[130px]">
                              {t.fullName}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[130px]">
                              {t.email}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800 block truncate max-w-[180px]">
                              {t.subject}
                            </span>
                            {t.companyName && (
                              <span className="text-[10px] text-slate-400 block truncate">
                                {t.companyName}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            {t.requestType}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                            >
                              {statusStyle.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${priorityStyle.badge}`}
                            >
                              {priorityStyle.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                            {new Date(t.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                Showing {tickets.length} of {total} tickets
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-semibold text-slate-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Ticket Detail View (Section 18) */}
        {selectedTicketId && (
          <div className="lg:col-span-6 space-y-4">
            {detailLoading || !ticketDetail ? (
              <div className="p-8 rounded-2xl border border-slate-200 bg-white text-center animate-pulse space-y-4">
                <div className="h-6 w-48 bg-slate-200 rounded mx-auto" />
                <div className="h-24 bg-slate-100 rounded" />
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/90 bg-white shadow-lg overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-[#214ECF]">
                        {ticketDetail.ticket.ticketNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          STATUS_CONFIG[ticketDetail.ticket.status]?.bg
                        } ${STATUS_CONFIG[ticketDetail.ticket.status]?.text} ${
                          STATUS_CONFIG[ticketDetail.ticket.status]?.border
                        }`}
                      >
                        {ticketDetail.ticket.status}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                          PRIORITY_CONFIG[ticketDetail.ticket.priority]?.badge
                        }`}
                      >
                        {ticketDetail.ticket.priority}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {ticketDetail.ticket.subject}
                    </h3>
                  </div>

                  <button
                    onClick={() => setSelectedTicketId(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
                    title="Close detail"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Requester & Meta Overview */}
                <div className="p-5 bg-slate-50/40 border-b border-slate-100 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                      Requester
                    </span>
                    <span className="font-bold text-slate-900 block">{ticketDetail.ticket.fullName}</span>
                    <span className="text-slate-500 block truncate">{ticketDetail.ticket.email}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                      Company &amp; Phone
                    </span>
                    <span className="font-semibold text-slate-800 block">
                      {ticketDetail.ticket.companyName || "N/A"}
                    </span>
                    <span className="text-slate-500 block">{ticketDetail.ticket.phone || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                      Request Type
                    </span>
                    <span className="font-semibold text-slate-800 block">
                      {ticketDetail.ticket.requestType}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                      Created
                    </span>
                    <span className="text-slate-600 block">
                      {new Date(ticketDetail.ticket.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Status & Priority Action Bar */}
                <div className="p-3.5 bg-blue-50/40 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Status:</span>
                    <select
                      value={ticketDetail.ticket.status}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      disabled={actionLoading}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-bold text-xs text-slate-800 focus:outline-hidden focus:border-[#214ECF]"
                    >
                      <option value="NEW">NEW</option>
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="WAITING_FOR_CUSTOMER">WAITING FOR CUSTOMER</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Priority:</span>
                    <select
                      value={ticketDetail.ticket.priority}
                      onChange={(e) => handleUpdatePriority(e.target.value)}
                      disabled={actionLoading}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-bold text-xs text-slate-800 focus:outline-hidden focus:border-[#214ECF]"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  {ticketDetail.ticket.status !== "RESOLVED" && ticketDetail.ticket.status !== "CLOSED" && (
                    <button
                      onClick={() => handleUpdateStatus("RESOLVED")}
                      disabled={actionLoading}
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 shadow-xs transition-colors"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>

                {/* Conversation History & Notes Scroll Area */}
                <div className="p-5 max-h-[420px] overflow-y-auto space-y-4">
                  {/* Messages Timeline */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                      Conversation History
                    </span>

                    {ticketDetail.messages.map((m) => {
                      const isAdmin = m.senderType === "admin";
                      return (
                        <div
                          key={m.id}
                          className={`p-4 rounded-2xl text-xs space-y-1.5 ${
                            isAdmin
                              ? "bg-blue-50/70 border border-blue-100 ml-6"
                              : "bg-slate-50 border border-slate-200/80 mr-6"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-bold ${isAdmin ? "text-[#214ECF]" : "text-slate-900"}`}>
                              {m.senderName} {isAdmin && "(Thinkatic Support)"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(m.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {m.message}
                          </p>
                        </div>
                      );
                    })}

                    {/* Attachment preview if exists */}
                    {ticketDetail.ticket.attachmentName && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Paperclip size={14} className="text-[#214ECF]" />
                          <span className="font-semibold text-slate-800">
                            {ticketDetail.ticket.attachmentName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {ticketDetail.ticket.attachmentSize
                              ? `${(ticketDetail.ticket.attachmentSize / 1024).toFixed(1)} KB`
                              : ""}
                          </span>
                        </div>
                        {ticketDetail.ticket.attachmentData && (
                          <a
                            href={ticketDetail.ticket.attachmentData}
                            download={ticketDetail.ticket.attachmentName}
                            className="text-[#214ECF] font-bold text-[11px] hover:underline"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Internal Notes Section (Admin Only) */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Lock size={12} className="text-amber-600" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-700 font-bold">
                        Internal Notes (Admin Only — Hidden from Customer)
                      </span>
                    </div>

                    {ticketDetail.internalNotes.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No internal notes yet.</p>
                    ) : (
                      ticketDetail.internalNotes.map((n) => (
                        <div
                          key={n.id}
                          className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/80 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-900">{n.adminName}</span>
                            <span className="text-[10px] text-amber-600">
                              {new Date(n.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-amber-800 whitespace-pre-wrap">{n.note}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Audit Trail */}
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <History size={12} className="text-slate-400" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                        Audit Trail
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {ticketDetail.auditLogs.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between text-[11px] text-slate-500 py-1 border-b border-slate-50"
                        >
                          <span className="truncate pr-2">
                            <strong className="text-slate-700">{a.action}:</strong> {a.details}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Forms: Reply & Internal Note */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/70 space-y-3">
                  {/* Reply Form */}
                  <form onSubmit={handleSendReply} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Reply to Requester</span>
                      <span className="text-[10px] text-slate-400">Sent directly to customer email</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type customer reply message..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="flex-1 h-9 px-3 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 focus:outline-hidden focus:border-[#214ECF]"
                      />
                      <button
                        type="submit"
                        disabled={actionLoading || !replyText.trim()}
                        className="h-9 px-4 rounded-xl bg-[#214ECF] text-white text-xs font-bold shadow-xs hover:bg-[#1A3DB3] disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Send size={12} />
                        <span>Reply</span>
                      </button>
                    </div>
                  </form>

                  {/* Internal Note Form */}
                  <form onSubmit={handleAddInternalNote} className="pt-2 border-t border-slate-200/60 flex gap-2">
                    <input
                      type="text"
                      placeholder="Add private internal note (admin-only)..."
                      value={internalNoteText}
                      onChange={(e) => setInternalNoteText(e.target.value)}
                      className="flex-1 h-8 px-3 rounded-xl border border-amber-200 bg-amber-50/30 text-xs text-amber-900 placeholder:text-amber-500/70 focus:outline-hidden focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={actionLoading || !internalNoteText.trim()}
                      className="h-8 px-3 rounded-xl bg-amber-600 text-white text-[11px] font-bold shadow-xs hover:bg-amber-700 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Lock size={10} />
                      <span>Note</span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
