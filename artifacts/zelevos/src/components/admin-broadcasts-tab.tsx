import React, { useState, useEffect, useCallback } from "react";
import {
  Megaphone,
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  ExternalLink,
  Image as ImageIcon,
  Eye,
  MousePointerClick,
  X,
  RefreshCw,
  Plus,
  Ban,
  Tag,
  Bell,
  Sparkles,
  Search,
  Archive,
  ArchiveRestore,
  Filter,
  Check,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

export type BroadcastItem = {
  id: string;
  title: string;
  message: string;
  category: "ANNOUNCEMENT" | "OFFER" | "ALERT" | "UPDATE" | "POLICY";
  imageUrl: string | null;
  actionButton: string | null;
  actionUrl: string | null;
  targetAudience: "ALL_CUSTOMERS" | "SPECIFIC_USER" | "UPCOMING_TRIPS" | "PAST_BOOKINGS" | "PAYMENT_PENDING";
  targetUserId: string | null;
  targetCustomerId: string | null;
  priority?: "NORMAL" | "HIGH" | "URGENT" | "LOW";
  status: "DRAFT" | "SCHEDULED" | "SENT" | "CANCELLED" | "EXPIRED" | "REVOKED";
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByAdminId: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  archivedByAdminId: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  readCount: number;
  clickCount: number;
  createdAt: string;
};

export type RecipientItem = {
  id: string;
  userId: string;
  customerId: string;
  fullName: string;
  email: string;
  status: string;
  readAt: string | null;
  clickedAt: string | null;
  createdAt: string;
};

type ValidatedCustomer = {
  id: string;
  customerId: string;
  fullName: string;
  email: string;
};

export function AdminBroadcastsTab({ onToast }: { onToast: (message: string) => void }) {
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBroadcastForRecipients, setSelectedBroadcastForRecipients] = useState<BroadcastItem | null>(null);
  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Tab View: "active" (normal) vs "archived"
  const [historyTab, setHistoryTab] = useState<"active" | "archived">("active");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [audienceFilter, setAudienceFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Confirmation Modals State
  const [revokeConfirmModal, setRevokeConfirmModal] = useState<BroadcastItem | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [archiveConfirmModal, setArchiveConfirmModal] = useState<BroadcastItem | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Form State for Create Broadcast
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<"ANNOUNCEMENT" | "OFFER" | "ALERT" | "UPDATE" | "POLICY">("OFFER");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT" | "LOW">("NORMAL");
  const [imageUrl, setImageUrl] = useState("");
  const [actionButton, setActionButton] = useState("Explore Now");
  const [actionUrl, setActionUrl] = useState("/#curated-packages");
  const [targetAudience, setTargetAudience] = useState<"ALL_CUSTOMERS" | "SPECIFIC_USER" | "UPCOMING_TRIPS" | "PAST_BOOKINGS" | "PAYMENT_PENDING">("ALL_CUSTOMERS");
  const [targetCustomerIdInput, setTargetCustomerIdInput] = useState("");
  const [validatedCustomer, setValidatedCustomer] = useState<ValidatedCustomer | null>(null);
  const [validatingCustomer, setValidatingCustomer] = useState(false);
  const [customerLookupError, setCustomerLookupError] = useState("");

  // Expiry state
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDateTime, setExpiryDateTime] = useState("");

  // Schedule state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");

  // Image Upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState("");

  // Fetch Broadcasts with current filters & active/archived mode
  const fetchBroadcasts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (historyTab === "archived") {
        params.set("archived", "true");
      }
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (categoryFilter !== "ALL") {
        params.set("category", categoryFilter);
      }
      if (audienceFilter !== "ALL") {
        params.set("targetAudience", audienceFilter);
      }
      if (fromDate) {
        params.set("from", fromDate);
      }
      if (toDate) {
        params.set("to", toDate);
      }

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/admin/broadcasts${queryString}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.broadcasts) {
        setBroadcasts(data.broadcasts);
      } else {
        onToast(data.message || "Failed to load broadcast history.");
      }
    } catch (err) {
      console.error("Failed loading broadcasts", err);
      onToast("Failed to load broadcast history.");
    } finally {
      setLoading(false);
    }
  }, [historyTab, searchQuery, statusFilter, categoryFilter, audienceFilter, fromDate, toDate, onToast]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  // Real-time server validation of Customer ID / User ID / Email
  const handleValidateCustomer = async (inputVal?: string) => {
    const query = (inputVal !== undefined ? inputVal : targetCustomerIdInput).trim();
    if (!query) {
      setValidatedCustomer(null);
      setCustomerLookupError("");
      return;
    }

    try {
      setValidatingCustomer(true);
      setCustomerLookupError("");
      const res = await fetch(`/api/admin/broadcasts/validate-customer/${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.customer) {
        setValidatedCustomer(data.customer);
        setCustomerLookupError("");
      } else {
        setValidatedCustomer(null);
        setCustomerLookupError(data.message || "Customer not found.");
      }
    } catch {
      setValidatedCustomer(null);
      setCustomerLookupError("Customer verification failed.");
    } finally {
      setValidatingCustomer(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/admin/broadcasts/upload-image", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setImageUrl(data.url);
        onToast("Image uploaded successfully!");
      } else {
        onToast(data.message || "Image upload failed.");
      }
    } catch (err) {
      console.error(err);
      onToast("Image upload error.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      onToast("Please fill in title and message.");
      return;
    }

    // Customer validation check for Specific Customer
    if (targetAudience === "SPECIFIC_USER") {
      if (!validatedCustomer && !targetCustomerIdInput.trim()) {
        onToast("Please enter and validate the Customer ID.");
        return;
      }
      if (!validatedCustomer) {
        onToast("Please validate the Customer ID before sending.");
        return;
      }
    }

    // Expiry validation check
    let formattedExpiresAt: string | undefined;
    if (hasExpiry && expiryDateTime) {
      const expDate = new Date(expiryDateTime);
      if (isNaN(expDate.getTime()) || expDate <= new Date()) {
        onToast("Expiry date/time must be set to a future timestamp.");
        return;
      }
      formattedExpiresAt = expDate.toISOString();
    }

    try {
      setSubmitting(true);
      const payload: any = {
        title: title.trim(),
        message: message.trim(),
        category,
        priority,
        imageUrl: imageUrl.trim() || null,
        actionButton: actionButton.trim() || null,
        actionUrl: actionUrl.trim() || null,
        targetAudience,
        targetUserId: targetAudience === "SPECIFIC_USER" ? validatedCustomer?.id : undefined,
        targetCustomerId: targetAudience === "SPECIFIC_USER" ? validatedCustomer?.customerId : undefined,
        expiresAt: formattedExpiresAt,
      };

      if (isScheduled && scheduledDate) {
        payload.scheduledAt = new Date(scheduledDate).toISOString();
      }

      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.broadcast) {
        onToast(
          isScheduled
            ? "Broadcast scheduled successfully!"
            : `Broadcast dispatched to ${data.broadcast.totalRecipients} recipient(s)!`
        );
        setShowCreateModal(false);
        // Reset form
        setTitle("");
        setMessage("");
        setImageUrl("");
        setImagePreview("");
        setActionButton("Explore Now");
        setActionUrl("/#curated-packages");
        setTargetAudience("ALL_CUSTOMERS");
        setTargetCustomerIdInput("");
        setValidatedCustomer(null);
        setCustomerLookupError("");
        setHasExpiry(false);
        setExpiryDateTime("");
        setIsScheduled(false);
        setScheduledDate("");
        fetchBroadcasts();
      } else {
        onToast(data.message || "Failed to create broadcast.");
      }
    } catch (err) {
      console.error(err);
      onToast("Network error creating broadcast.");
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke an Offer
  const handleExecuteRevoke = async () => {
    if (!revokeConfirmModal) return;
    try {
      setRevoking(true);
      const res = await fetch(`/api/admin/broadcasts/${revokeConfirmModal.id}/revoke`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        onToast("Offer revoked successfully! It will no longer appear active for customers.");
        setRevokeConfirmModal(null);
        fetchBroadcasts();
      } else {
        onToast(data.message || "Failed to revoke offer.");
      }
    } catch {
      onToast("Error revoking offer.");
    } finally {
      setRevoking(false);
    }
  };

  // Archive a Broadcast (Soft Delete)
  const handleExecuteArchive = async () => {
    if (!archiveConfirmModal) return;
    try {
      setArchiving(true);
      const res = await fetch(`/api/admin/broadcasts/${archiveConfirmModal.id}/archive`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        onToast("Campaign removed from history. It remains safely preserved in the database.");
        setArchiveConfirmModal(null);
        fetchBroadcasts();
      } else {
        onToast(data.message || "Failed to archive campaign.");
      }
    } catch {
      onToast("Error archiving campaign.");
    } finally {
      setArchiving(false);
    }
  };

  // Restore an Archived Campaign
  const handleRestoreBroadcast = async (broadcast: BroadcastItem) => {
    try {
      const res = await fetch(`/api/admin/broadcasts/${broadcast.id}/restore`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        onToast("Campaign restored to normal history.");
        fetchBroadcasts();
      } else {
        onToast(data.message || "Failed to restore campaign.");
      }
    } catch {
      onToast("Error restoring campaign.");
    }
  };

  const handleCancelBroadcast = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this scheduled broadcast?")) return;
    try {
      const res = await fetch(`/api/admin/broadcasts/${id}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        onToast("Scheduled broadcast cancelled.");
        fetchBroadcasts();
      } else {
        onToast(data.message || "Failed to cancel broadcast.");
      }
    } catch {
      onToast("Error cancelling broadcast.");
    }
  };

  const handleViewRecipients = async (broadcast: BroadcastItem) => {
    setSelectedBroadcastForRecipients(broadcast);
    setLoadingRecipients(true);
    try {
      const res = await fetch(`/api/admin/broadcasts/${broadcast.id}/recipients`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.recipients) {
        setRecipients(data.recipients);
      }
    } catch (err) {
      console.error(err);
      onToast("Failed to load recipient details.");
    } finally {
      setLoadingRecipients(false);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "OFFER":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><Tag size={11} /> OFFER</span>;
      case "ALERT":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle size={11} /> ALERT</span>;
      case "UPDATE":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"><RefreshCw size={11} /> UPDATE</span>;
      case "POLICY":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200"><Sparkles size={11} /> POLICY</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Megaphone size={11} /> ANNOUNCEMENT</span>;
    }
  };

  const getStatusBadge = (item: BroadcastItem) => {
    if (item.isArchived) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
          <Archive size={11} /> ARCHIVED
        </span>
      );
    }

    if (item.status === "REVOKED" || item.revokedAt) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <Ban size={11} /> REVOKED
        </span>
      );
    }

    const isNowExpired = item.status === "EXPIRED" || (item.expiresAt && new Date(item.expiresAt) <= new Date());
    if (isNowExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock size={11} /> EXPIRED
        </span>
      );
    }

    switch (item.status) {
      case "SENT":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><CheckCircle2 size={11} /> SENT</span>;
      case "SCHEDULED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"><Clock size={11} /> SCHEDULED</span>;
      case "CANCELLED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700"><Ban size={11} /> CANCELLED</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">{item.status}</span>;
    }
  };

  const getAudienceLabel = (item: BroadcastItem) => {
    switch (item.targetAudience) {
      case "ALL_CUSTOMERS":
        return "All Customers (Global)";
      case "SPECIFIC_USER":
        return item.targetCustomerId ? `Target: ${item.targetCustomerId}` : "Specific Customer";
      case "UPCOMING_TRIPS":
        return "Upcoming Travelers";
      case "PAST_BOOKINGS":
        return "Past Travelers";
      case "PAYMENT_PENDING":
        return "Pending Payments";
      default:
        return item.targetAudience;
    }
  };

  const hasActiveFilters = searchQuery || statusFilter !== "ALL" || categoryFilter !== "ALL" || audienceFilter !== "ALL" || fromDate || toDate;

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setAudienceFilter("ALL");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1">
            <Megaphone size={16} /> Broadcasts & Offer Control Center
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Push Announcements & Seasonal Offers</h2>
          <p className="text-indigo-200 text-sm mt-1 max-w-2xl">
            Dispatch official alerts, holiday offers, and targeted discounts with real-time delivery tracking, server-authoritative expiry, revoke controls, and soft-delete archive protection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchBroadcasts}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition"
            title="Refresh history"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            id="create-broadcast-btn"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 transition transform hover:-translate-y-0.5"
          >
            <Plus size={16} /> Create Broadcast
          </button>
        </div>
      </div>

      {/* Broadcast Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Broadcasts</span>
          <div className="text-2xl font-bold text-slate-800 mt-1">{broadcasts.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Delivered</span>
          <div className="text-2xl font-bold text-indigo-600 mt-1">
            {broadcasts.reduce((acc, b) => acc + (b.totalRecipients || 0), 0)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Reads</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {broadcasts.reduce((acc, b) => acc + (b.readCount || 0), 0)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Button Clicks</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {broadcasts.reduce((acc, b) => acc + (b.clickCount || 0), 0)}
          </div>
        </div>
      </div>

      {/* History Tabs & Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        {/* Active vs Archived Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <button
              id="tab-active-broadcasts"
              onClick={() => setHistoryTab("active")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                historyTab === "active"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Megaphone size={14} />
              Active & Sent Campaigns
            </button>
            <button
              id="tab-archived-broadcasts"
              onClick={() => setHistoryTab("archived")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                historyTab === "archived"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Archive size={14} />
              Archived History
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{broadcasts.length}</strong> {historyTab === "active" ? "active/sent" : "archived"} campaign(s)
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-1">
          {/* Search Box */}
          <div className="col-span-1 sm:col-span-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                id="broadcast-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campaign title, message..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              id="broadcast-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
            >
              <option value="ALL">Status: All</option>
              <option value="SENT">Sent</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="EXPIRED">Expired</option>
              <option value="REVOKED">Revoked</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              id="broadcast-category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
            >
              <option value="ALL">Category: All</option>
              <option value="OFFER">Offers / Discounts</option>
              <option value="ANNOUNCEMENT">Announcements</option>
              <option value="ALERT">Alerts</option>
              <option value="UPDATE">Updates</option>
              <option value="POLICY">Policy</option>
            </select>
          </div>

          {/* Target Filter */}
          <div>
            <select
              id="broadcast-audience-filter"
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
            >
              <option value="ALL">Audience: All</option>
              <option value="ALL_CUSTOMERS">All Customers</option>
              <option value="SPECIFIC_USER">Specific Customer</option>
              <option value="UPCOMING_TRIPS">Upcoming Trips</option>
              <option value="PAST_BOOKINGS">Past Bookings</option>
              <option value="PAYMENT_PENDING">Pending Payments</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-center">
            {hasActiveFilters ? (
              <button
                onClick={clearAllFilters}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition text-center"
              >
                Clear Filters
              </button>
            ) : (
              <span className="text-xs text-slate-400 pl-2">Filter ready</span>
            )}
          </div>
        </div>
      </div>

      {/* Broadcast History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Clock size={18} className="text-slate-500" />
            {historyTab === "active" ? "Broadcast History & Performance" : "Archived Campaigns Roster"}
          </h3>
          <span className="text-xs text-slate-500 font-medium">{broadcasts.length} entries</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-indigo-500" />
            <span>Loading broadcast records...</span>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Megaphone size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">
              {hasActiveFilters
                ? "No campaigns matched your search or filters."
                : historyTab === "archived"
                ? "No campaigns have been archived yet."
                : "No broadcasts have been created yet."}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {historyTab === "active"
                ? 'Click "Create Broadcast" to send your first official announcement or offer.'
                : "Removed campaigns will appear here for audit and restoration."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                  <th className="py-3 px-4">Broadcast / Campaign</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Target Audience</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Recipients</th>
                  <th className="py-3 px-4 text-center">Reads</th>
                  <th className="py-3 px-4 text-center">Clicks</th>
                  <th className="py-3 px-4">Sent / Scheduled</th>
                  <th className="py-3 px-4">Expiry</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {broadcasts.map((b) => {
                  const readRate = b.totalRecipients > 0 ? Math.round((b.readCount / b.totalRecipients) * 100) : 0;
                  const clickRate = b.readCount > 0 ? Math.round((b.clickCount / b.readCount) * 100) : 0;
                  const isRevoked = b.status === "REVOKED" || Boolean(b.revokedAt);
                  const isExpired = b.status === "EXPIRED" || (b.expiresAt && new Date(b.expiresAt) <= new Date());
                  const canRevoke = !b.isArchived && !isRevoked && !isExpired && (b.status === "SENT" || b.status === "SCHEDULED");

                  return (
                    <tr key={b.id} id={`broadcast-row-${b.id}`} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {b.imageUrl ? (
                            <img
                              src={b.imageUrl}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">
                              <Megaphone size={16} />
                            </div>
                          )}
                          <div className="max-w-xs">
                            <div className="font-semibold text-slate-800 line-clamp-1">{b.title}</div>
                            <div className="text-xs text-slate-500 line-clamp-1">{b.message}</div>
                            {b.actionButton && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-indigo-600 font-medium">
                                <ExternalLink size={10} /> CTA: {b.actionButton} ({b.actionUrl || "URL"})
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getCategoryBadge(b.category)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700">
                        <span className="font-medium">{getAudienceLabel(b)}</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(b)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center font-semibold text-slate-700">
                        {b.totalRecipients}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <span className="font-semibold text-slate-800">{b.readCount}</span>
                        <span className="text-[11px] text-slate-400 block">({readRate}%)</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <span className="font-semibold text-slate-800">{b.clickCount}</span>
                        <span className="text-[11px] text-slate-400 block">({clickRate}%)</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                        {b.status === "SCHEDULED" ? (
                          <span className="text-blue-600 font-medium">
                            <Clock size={11} className="inline mr-1" />
                            {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString() : "Scheduled"}
                          </span>
                        ) : b.sentAt ? (
                          new Date(b.sentAt).toLocaleString()
                        ) : (
                          new Date(b.createdAt).toLocaleString()
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                        {b.expiresAt ? (
                          <div>
                            <span className={isExpired ? "text-amber-700 font-semibold" : "text-slate-700 font-medium"}>
                              {new Date(b.expiresAt).toLocaleString()}
                            </span>
                            {isExpired && (
                              <span className="text-[10px] block text-amber-600 font-bold uppercase">Expired</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">No Expiry</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-1.5">
                        {/* Recipients Modal Button */}
                        <button
                          onClick={() => handleViewRecipients(b)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
                          title="View delivered recipients"
                        >
                          Recipients
                        </button>

                        {/* Scheduled broadcast cancel */}
                        {b.status === "SCHEDULED" && !b.isArchived && (
                          <button
                            onClick={() => handleCancelBroadcast(b.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium border border-rose-200 transition"
                          >
                            Cancel
                          </button>
                        )}

                        {/* Revoke Offer Button (active sent offers only) */}
                        {canRevoke && (
                          <button
                            id={`revoke-btn-${b.id}`}
                            onClick={() => setRevokeConfirmModal(b)}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200 transition"
                            title="Revoke offer from active customer view"
                          >
                            Revoke
                          </button>
                        )}

                        {/* Archive / Remove from History Button (when not archived) */}
                        {!b.isArchived ? (
                          <button
                            id={`archive-btn-${b.id}`}
                            onClick={() => setArchiveConfirmModal(b)}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-medium border border-slate-200 hover:border-rose-200 transition"
                            title="Remove campaign from normal history (soft delete)"
                          >
                            Archive
                          </button>
                        ) : (
                          /* Restore Button (when viewing archived history) */
                          <button
                            id={`restore-btn-${b.id}`}
                            onClick={() => handleRestoreBroadcast(b)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition"
                            title="Restore campaign to normal history"
                          >
                            <ArchiveRestore size={12} className="inline mr-1" />
                            Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE BROADCAST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 my-8 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone size={18} />
                <h3 className="font-bold text-lg">Create New Announcement / Offer</h3>
              </div>
              <button
                id="close-create-broadcast-modal"
                onClick={() => setShowCreateModal(false)}
                className="text-white/70 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBroadcast} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Title *</label>
                <input
                  id="broadcast-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 🌸 Kashmir Spring Festival: Flat 20% Off All Bookings!"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category</label>
                  <select
                    id="broadcast-category-select"
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  >
                    <option value="OFFER">🏷️ Promotional Offer / Discount</option>
                    <option value="ANNOUNCEMENT">📢 General Announcement</option>
                    <option value="ALERT">⚠️ Important Travel Alert</option>
                    <option value="UPDATE">🔄 Platform Update</option>
                    <option value="POLICY">📋 Policy / Operational Note</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Priority</label>
                  <select
                    id="broadcast-priority-select"
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Priority</option>
                    <option value="LOW">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Audience</label>
                  <select
                    id="broadcast-target-select"
                    value={targetAudience}
                    onChange={(e: any) => {
                      setTargetAudience(e.target.value);
                      if (e.target.value !== "SPECIFIC_USER") {
                        setValidatedCustomer(null);
                        setCustomerLookupError("");
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  >
                    <option value="ALL_CUSTOMERS">👥 All Customers (Global)</option>
                    <option value="SPECIFIC_USER">👤 Specific Customer</option>
                    <option value="UPCOMING_TRIPS">✈️ Customers With Upcoming Trips</option>
                    <option value="PAST_BOOKINGS">🧳 Customers With Past Bookings</option>
                    <option value="PAYMENT_PENDING">💳 Customers With Pending Payments</option>
                  </select>
                </div>
              </div>

              {/* Specific Customer ID Input & Server-side Validation Card */}
              {targetAudience === "SPECIFIC_USER" && (
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-indigo-900 uppercase">
                      Target Customer ID *
                    </label>
                    <span className="text-[11px] text-indigo-600 font-medium">
                      Example: ZLV-CUS-000001 or email
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      id="specific-customer-id-input"
                      type="text"
                      required
                      value={targetCustomerIdInput}
                      onChange={(e) => {
                        setTargetCustomerIdInput(e.target.value);
                        setValidatedCustomer(null);
                        setCustomerLookupError("");
                      }}
                      onBlur={() => handleValidateCustomer()}
                      placeholder="Enter Customer ID (e.g. ZLV-CUS-000001)"
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                    />
                    <button
                      id="validate-customer-btn"
                      type="button"
                      disabled={validatingCustomer || !targetCustomerIdInput.trim()}
                      onClick={() => handleValidateCustomer()}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 transition flex items-center gap-1.5"
                    >
                      {validatingCustomer ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" /> Validating...
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} /> Validate Customer
                        </>
                      )}
                    </button>
                  </div>

                  {/* Customer Found Summary Card */}
                  {validatedCustomer && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                          <Check size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                            <span>{validatedCustomer.fullName}</span>
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-emerald-200/60 text-emerald-900 font-semibold">
                              {validatedCustomer.customerId}
                            </span>
                          </div>
                          <div className="text-emerald-700 text-[11px]">{validatedCustomer.email}</div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                        Verified
                      </span>
                    </div>
                  )}

                  {/* Customer Lookup Error */}
                  {customerLookupError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-medium">
                      <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                      <span>{customerLookupError}</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Message Content *</label>
                <textarea
                  id="broadcast-message-input"
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter detailed offer terms, promo codes, or announcement instructions..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              {/* Offer Expiry Configuration */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase">Offer Expiry (Server Authoritative)</span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-indigo-700">
                    <input
                      id="enable-expiry-checkbox"
                      type="checkbox"
                      checked={hasExpiry}
                      onChange={(e) => setHasExpiry(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    Enable Offer Expiry
                  </label>
                </div>
                {hasExpiry && (
                  <div className="pt-2 space-y-1">
                    <label className="block text-xs text-slate-600">Expiry Date & Time (Offer will auto-expire):</label>
                    <input
                      id="expiry-datetime-input"
                      type="datetime-local"
                      value={expiryDateTime}
                      onChange={(e) => setExpiryDateTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                    <p className="text-[11px] text-slate-500">
                      When this time is reached, the offer will automatically transition to EXPIRED, customer action buttons will be deactivated, and redemption blocked server-side.
                    </p>
                  </div>
                )}
              </div>

              {/* Banner Image Upload & URL */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Campaign Banner Image (Optional)
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {uploadingImage && <span className="text-xs text-indigo-600 animate-pulse">Uploading...</span>}
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Or paste image URL:</span>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setImagePreview(e.target.value);
                    }}
                    placeholder="/kashmir-dawn.jpg or https://..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
                {(imagePreview || imageUrl) && (
                  <div className="relative mt-2 rounded-lg overflow-hidden border border-slate-200 max-h-40 w-full bg-slate-900">
                    <img
                      src={imagePreview || imageUrl}
                      alt="Banner Preview"
                      className="w-full h-36 object-cover"
                      onError={() => setImagePreview("")}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl("");
                        setImagePreview("");
                      }}
                      className="absolute top-2 right-2 bg-slate-900/80 text-white p-1 rounded-full hover:bg-rose-600 transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Action Button CTA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Call To Action Button Label
                  </label>
                  <input
                    id="broadcast-cta-label-input"
                    type="text"
                    value={actionButton}
                    onChange={(e) => setActionButton(e.target.value)}
                    placeholder="e.g. View Offer, Check Booking"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Destination URL
                  </label>
                  <input
                    id="broadcast-cta-url-input"
                    type="text"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="e.g. /#curated-packages, /flights"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              {/* Schedule options */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase">Scheduling</span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-indigo-700">
                    <input
                      id="enable-scheduling-checkbox"
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    Schedule for later dispatch
                  </label>
                </div>
                {isScheduled && (
                  <div className="pt-2">
                    <label className="block text-xs text-slate-600 mb-1">Date and Time for Automatic Send:</label>
                    <input
                      id="scheduled-datetime-input"
                      type="datetime-local"
                      required={isScheduled}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  id="submit-broadcast-btn"
                  type="submit"
                  disabled={submitting || (targetAudience === "SPECIFIC_USER" && !validatedCustomer)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md transition disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Processing...
                    </>
                  ) : isScheduled ? (
                    <>
                      <Clock size={15} />
                      Schedule Broadcast
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      Dispatch Broadcast Now
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVOKE CONFIRMATION MODAL */}
      {revokeConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Revoke this offer?</h3>
                <p className="text-slate-600 text-xs mt-1">
                  This will remove the offer from the targeted customers' active notification view. The campaign record will remain available for audit.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700">Campaign: </span>
              <span className="text-slate-900 font-bold">{revokeConfirmModal.title}</span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRevokeConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                id="confirm-revoke-btn"
                type="button"
                disabled={revoking}
                onClick={handleExecuteRevoke}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {revoking ? <RefreshCw size={13} className="animate-spin" /> : <Ban size={13} />}
                {revoking ? "Revoking..." : "Revoke Offer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE / REMOVE FROM HISTORY CONFIRMATION MODAL */}
      {archiveConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
                <Archive size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Remove campaign from history?</h3>
                <p className="text-slate-600 text-xs mt-1">
                  This will archive the campaign and hide it from the normal broadcast history list. All recipient records, analytics, and audit history will be safely preserved in the database.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700">Campaign: </span>
              <span className="text-slate-900 font-bold">{archiveConfirmModal.title}</span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setArchiveConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                id="confirm-archive-btn"
                type="button"
                disabled={archiving}
                onClick={handleExecuteArchive}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {archiving ? <RefreshCw size={13} className="animate-spin" /> : <Archive size={13} />}
                {archiving ? "Archiving..." : "Archive Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECIPIENTS MODAL */}
      {selectedBroadcastForRecipients && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Delivery & Engagement Roster</h3>
                <span className="text-xs text-slate-500">
                  Broadcast: "{selectedBroadcastForRecipients.title}"
                </span>
              </div>
              <button
                onClick={() => setSelectedBroadcastForRecipients(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingRecipients ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw size={24} className="animate-spin text-indigo-600" />
                  <span>Loading recipients...</span>
                </div>
              ) : recipients.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Users size={32} className="mx-auto text-slate-300 mb-2" />
                  <p>No recipient records found for this broadcast.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-semibold uppercase">
                      <th className="py-2.5 px-3">Customer ID</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Delivery Status</th>
                      <th className="py-2.5 px-3">Read At</th>
                      <th className="py-2.5 px-3">Clicked At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recipients.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-semibold text-indigo-700">
                          {r.customerId}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{r.fullName}</div>
                          <div className="text-slate-500">{r.email}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {r.readAt ? (
                            <span className="text-emerald-600 font-medium">
                              ✓ {new Date(r.readAt).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400">Unread</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {r.clickedAt ? (
                            <span className="text-amber-600 font-medium">
                              👆 {new Date(r.clickedAt).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedBroadcastForRecipients(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition"
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
