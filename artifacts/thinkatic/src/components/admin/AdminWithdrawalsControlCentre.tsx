import React, { useState, useEffect, useMemo } from "react";
import {
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Check,
  X,
  Play,
  CreditCard,
  Building2,
  Copy,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  FileText,
  User,
  ShieldCheck,
  Calendar,
  ArrowUpRight,
  SlidersHorizontal,
} from "lucide-react";

export interface WithdrawalItem {
  id: number;
  requestId: string;
  userId: string;
  partnerId: string;
  partnerCode: string;
  centreName: string;
  centreId: number;
  userEmail: string;
  userFullName: string;
  amount: number;
  currency: string;
  method: string;
  payoutDetailsId: number;
  destinationMasked: string;
  status: "REQUESTED" | "UNDER_REVIEW" | "APPROVED" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED";
  dbStatus: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  processedBy?: number | null;
  processedAt?: string | null;
  paidBy?: number | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  rejectionReason?: string | null;
  adminNote?: string | null;
  note?: string | null;
  statementId?: number | string | null;
  auditHistory: Array<{
    status: string;
    timestamp: string;
    actor: string;
    note?: string | null;
    adminId?: number | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ControlCentreKPIs {
  availableRequests: number;
  pendingReview: number;
  approved: number;
  processing: number;
  paid: number;
  rejected: number;
  totalPendingAmount: number;
  totalPaidAmount: number;
}

interface AdminWithdrawalsControlCentreProps {
  apiCall: (endpoint: string, options?: RequestInit) => Promise<Response>;
}

export default function AdminWithdrawalsControlCentre({ apiCall }: AdminWithdrawalsControlCentreProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [kpis, setKpis] = useState<ControlCentreKPIs>({
    availableRequests: 0,
    pendingReview: 0,
    approved: 0,
    processing: 0,
    paid: 0,
    rejected: 0,
    totalPendingAmount: 0,
    totalPaidAmount: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currencyFilter, setCurrencyFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Drawer & Modals
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalItem | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [financialBreakdown, setFinancialBreakdown] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action Modals
  const [actionTarget, setActionTarget] = useState<WithdrawalItem | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "process" | "pay" | "review" | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load Withdrawals from API
  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (currencyFilter !== "ALL") params.set("currency", currencyFilter);

      const res = await apiCall(`/admin/withdrawals?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals || []);
        if (data.kpis) {
          setKpis(data.kpis);
        }
      }
    } catch (err: any) {
      console.error("Failed to load admin withdrawals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [statusFilter, currencyFilter]);

  // Open Details Drawer
  const handleOpenDetails = async (w: WithdrawalItem) => {
    setSelectedWithdrawal(w);
    setDetailDrawerOpen(true);
    setDetailLoading(true);
    try {
      const res = await apiCall(`/admin/withdrawals/${w.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedWithdrawal(data.withdrawal);
        setFinancialBreakdown(data.financialBreakdown);
      }
    } catch (err) {
      console.error("Failed to fetch full withdrawal details:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Action Modal
  const handleOpenActionModal = (
    w: WithdrawalItem,
    type: "approve" | "reject" | "process" | "pay" | "review"
  ) => {
    setActionTarget(w);
    setActionType(type);
    setAdminNote("");
    setRejectionReason("");
    setPaymentReference(`WIRE-THK-${Date.now().toString().slice(-6)}`);
    setPaidDate(new Date().toISOString().slice(0, 10));
    setActionError(null);
  };

  // Submit Transition Action
  const handleExecuteAction = async () => {
    if (!actionTarget || !actionType) return;
    setActionSubmitting(true);
    setActionError(null);

    try {
      let endpoint = `/admin/withdrawals/${actionTarget.id}/${actionType}`;
      let body: any = { adminNote: adminNote.trim() || undefined };

      if (actionType === "reject") {
        if (!rejectionReason.trim()) {
          setActionError("A specific rejection reason is mandatory.");
          setActionSubmitting(false);
          return;
        }
        body.rejectionReason = rejectionReason.trim();
      } else if (actionType === "pay") {
        if (!paymentReference.trim()) {
          setActionError("A valid transaction/payment reference is required.");
          setActionSubmitting(false);
          return;
        }
        body.paymentReference = paymentReference.trim();
        body.paidDate = paidDate;
      }

      const res = await apiCall(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || resData.message || "Failed to update withdrawal state");
      }

      setToastMessage(
        `Withdrawal ${actionTarget.requestId} successfully transitioned to ${actionType.toUpperCase()}`
      );
      setActionType(null);
      setActionTarget(null);

      // Refresh data
      await loadData();

      // If drawer is open, refresh drawer
      if (selectedWithdrawal?.id === actionTarget.id) {
        await handleOpenDetails(actionTarget);
      }
    } catch (err: any) {
      setActionError(err.message || "Action failed");
    } finally {
      setActionSubmitting(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, idStr: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idStr);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "PAID":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: CheckCircle2,
          label: "Paid",
        };
      case "PROCESSING":
        return {
          bg: "bg-blue-50 text-[#214ECF] border-blue-200 animate-pulse",
          icon: RefreshCw,
          label: "Processing",
        };
      case "APPROVED":
        return {
          bg: "bg-sky-50 text-sky-800 border-sky-200",
          icon: Check,
          label: "Approved",
        };
      case "UNDER_REVIEW":
        return {
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
          icon: Eye,
          label: "Under Review",
        };
      case "REQUESTED":
      case "PENDING":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          icon: Clock,
          label: "Requested",
        };
      case "REJECTED":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          icon: XCircle,
          label: "Rejected",
        };
      default:
        return {
          bg: "bg-slate-50 text-slate-700 border-slate-200",
          icon: AlertCircle,
          label: status,
        };
    }
  };

  // Filtered withdrawals list
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          w.requestId.toLowerCase().includes(q) ||
          w.centreName.toLowerCase().includes(q) ||
          w.partnerCode.toLowerCase().includes(q) ||
          w.userEmail.toLowerCase().includes(q) ||
          w.userFullName.toLowerCase().includes(q) ||
          String(w.amount).includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [withdrawals, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── TOP TOAST NOTIFICATION ────────────────────────────────────────── */}
      {toastMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="rounded p-1 hover:bg-emerald-100 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100 shadow-2xs">
              <Wallet size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                BPO Withdrawals & Payout Control Centre
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Authoritative disbursement lifecycle, fraud audits, and bank settlement verification.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:border-[#214ECF]/50 hover:bg-blue-50/30 hover:text-[#214ECF] transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[#214ECF]" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── 8 DASHBOARD KPIS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* KPI 1: Available Requests */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-[#214ECF]/40 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Available</span>
            <Clock size={13} className="text-amber-500" />
          </div>
          <p className="mt-1.5 text-xl font-black text-slate-900">{kpis.availableRequests}</p>
          <p className="text-[10px] text-slate-400 font-medium">To action</p>
        </div>

        {/* KPI 2: Pending Review */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-indigo-400 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Reviewing</span>
            <Eye size={13} className="text-indigo-500" />
          </div>
          <p className="mt-1.5 text-xl font-black text-indigo-700">{kpis.pendingReview}</p>
          <p className="text-[10px] text-slate-400 font-medium">Under review</p>
        </div>

        {/* KPI 3: Approved */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-sky-400 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Approved</span>
            <Check size={13} className="text-sky-500" />
          </div>
          <p className="mt-1.5 text-xl font-black text-sky-700">{kpis.approved}</p>
          <p className="text-[10px] text-slate-400 font-medium">Ready to process</p>
        </div>

        {/* KPI 4: Processing */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-blue-400 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Processing</span>
            <RefreshCw size={13} className="text-[#214ECF]" />
          </div>
          <p className="mt-1.5 text-xl font-black text-[#214ECF]">{kpis.processing}</p>
          <p className="text-[10px] text-slate-400 font-medium">In transit</p>
        </div>

        {/* KPI 5: Paid */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Paid</span>
            <CheckCircle2 size={13} className="text-emerald-500" />
          </div>
          <p className="mt-1.5 text-xl font-black text-emerald-700">{kpis.paid}</p>
          <p className="text-[10px] text-slate-400 font-medium">Completed</p>
        </div>

        {/* KPI 6: Rejected */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-rose-400 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Rejected</span>
            <XCircle size={13} className="text-rose-500" />
          </div>
          <p className="mt-1.5 text-xl font-black text-rose-700">{kpis.rejected}</p>
          <p className="text-[10px] text-slate-400 font-medium">Declined</p>
        </div>

        {/* KPI 7: Total Pending Amount */}
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending $</span>
            <DollarSign size={13} />
          </div>
          <p className="mt-1.5 text-lg font-black text-amber-900">
            ${kpis.totalPendingAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-amber-700/80 font-medium">Active queue</p>
        </div>

        {/* KPI 8: Total Paid Amount */}
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Paid</span>
            <TrendingUp size={13} />
          </div>
          <p className="mt-1.5 text-lg font-black text-emerald-900">
            ${kpis.totalPaidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-emerald-700/80 font-medium">Total disbursed</p>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ──────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by partner name, code, request ID, email, or amount..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#214ECF] focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-[#214ECF] focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="REQUESTED">Requested</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="PROCESSING">Processing</option>
            <option value="PAID">Paid</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Currency filter */}
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-[#214ECF] focus:outline-none"
          >
            <option value="ALL">All Currencies</option>
            <option value="USD">USD ($)</option>
            <option value="INR">INR (₹)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>

          {(searchQuery || statusFilter !== "ALL" || currencyFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
                setCurrencyFilter("ALL");
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1"
            >
              <X size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ── WITHDRAWALS TABLE / EMPTY STATE ───────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw size={24} className="mx-auto animate-spin text-[#214ECF]" />
            <p className="mt-3 text-xs font-semibold text-slate-600">Loading BPO withdrawal requests from Supabase...</p>
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          /* ── REQUIREMENT 12: PREMIUM EMPTY STATE ── */
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#214ECF] border border-blue-100 shadow-2xs">
              <Wallet size={26} />
            </div>
            <h3 className="mt-4 text-base font-black text-slate-900 tracking-tight">
              No withdrawal requests yet.
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto font-medium">
              BPO partner withdrawal requests will appear here when submitted. All financial verifications, reviews, and payment executions are centralized in this control centre.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                onClick={() => void loadData()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1b3fa8] transition-colors"
              >
                <RefreshCw size={13} />
                <span>Refresh Queue</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-mono text-[10px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">BPO Partner</th>
                  <th className="py-3 px-4">Centre / Email</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payout Method</th>
                  <th className="py-3 px-4">Requested Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWithdrawals.map((w) => {
                  const badge = getStatusBadge(w.status);
                  const BadgeIcon = badge.icon;

                  return (
                    <tr key={w.id} className="hover:bg-blue-50/20 transition-colors group">
                      {/* Request ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{w.requestId}</span>
                          <button
                            onClick={() => handleCopy(w.requestId, `req-${w.id}`)}
                            title="Copy Request ID"
                            className="text-slate-400 hover:text-slate-700 transition"
                          >
                            <Copy size={11} />
                          </button>
                          {copiedId === `req-${w.id}` && (
                            <span className="text-[9px] font-bold text-emerald-600 font-sans">Copied!</span>
                          )}
                        </div>
                      </td>

                      {/* Partner Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{w.centreName}</div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                          <Building2 size={11} className="text-slate-400" />
                          <span>{w.partnerCode}</span>
                        </div>
                      </td>

                      {/* Centre & Email */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-700">{w.userFullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{w.userEmail}</div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 text-sm">
                          ${w.amount.toFixed(2)}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{w.currency}</span>
                      </td>

                      {/* Payout Method */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          {w.method === "indian_bank" ? (
                            <Building2 size={13} className="text-blue-600 shrink-0" />
                          ) : (
                            <CreditCard size={13} className="text-indigo-600 shrink-0" />
                          )}
                          <span className="truncate max-w-[140px]">{w.destinationMasked}</span>
                        </div>
                      </td>

                      {/* Requested Date */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {new Date(w.requestedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg}`}
                        >
                          <BadgeIcon size={11} />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* REVIEW: If REQUESTED */}
                          {w.status === "REQUESTED" && (
                            <button
                              onClick={() => handleOpenActionModal(w, "review")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                              title="Start Review"
                            >
                              <Eye size={12} />
                              <span>Review</span>
                            </button>
                          )}

                          {/* APPROVE: If REQUESTED or UNDER_REVIEW */}
                          {(w.status === "REQUESTED" || w.status === "UNDER_REVIEW") && (
                            <button
                              onClick={() => handleOpenActionModal(w, "approve")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                              title="Approve Withdrawal"
                            >
                              <Check size={12} />
                              <span>Approve</span>
                            </button>
                          )}

                          {/* REJECT: If REQUESTED or UNDER_REVIEW */}
                          {(w.status === "REQUESTED" || w.status === "UNDER_REVIEW") && (
                            <button
                              onClick={() => handleOpenActionModal(w, "reject")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
                              title="Reject Withdrawal"
                            >
                              <X size={12} />
                              <span>Reject</span>
                            </button>
                          )}

                          {/* PROCESS: If APPROVED */}
                          {w.status === "APPROVED" && (
                            <button
                              onClick={() => handleOpenActionModal(w, "process")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-[#214ECF] bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                              title="Begin Bank Processing"
                            >
                              <Play size={12} />
                              <span>Process</span>
                            </button>
                          )}

                          {/* PAY: If PROCESSING or APPROVED */}
                          {(w.status === "PROCESSING" || w.status === "APPROVED") && (
                            <button
                              onClick={() => handleOpenActionModal(w, "pay")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 hover:bg-emerald-200 transition-colors"
                              title="Confirm Payment & Enter Reference"
                            >
                              <CheckCircle2 size={12} />
                              <span>Mark Paid</span>
                            </button>
                          )}

                          {/* VIEW DETAILS */}
                          <button
                            onClick={() => void handleOpenDetails(w)}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="View Full Detail Drawer"
                          >
                            <ChevronRight size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── REQUIREMENT 4: ADMIN REQUEST DETAIL DRAWER ─────────────────────── */}
      {detailDrawerOpen && selectedWithdrawal && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-xl bg-white shadow-2xl h-full flex flex-col overflow-hidden animate-slideInRight">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100 shadow-2xs">
                  <Wallet size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Withdrawal {selectedWithdrawal.requestId}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Requested on {new Date(selectedWithdrawal.requestedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailDrawerOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-800">
              {detailLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw size={20} className="mx-auto animate-spin text-[#214ECF]" />
                  <p className="mt-2 text-xs text-slate-500 font-medium">Loading authoritative records...</p>
                </div>
              ) : (
                <>
                  {/* Status Banner */}
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 bg-slate-50/60">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Current Lifecycle State
                      </span>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                            getStatusBadge(selectedWithdrawal.status).bg
                          }`}
                        >
                          {selectedWithdrawal.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Requested Amount
                      </span>
                      <p className="mt-0.5 text-2xl font-black text-slate-900">
                        ${selectedWithdrawal.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* 1. BPO DETAILS */}
                  <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-white">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#214ECF] flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <Building2 size={14} />
                      <span>BPO Partner Details</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Partner Centre</span>
                        <span className="font-bold text-slate-900">{selectedWithdrawal.centreName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Partner Code</span>
                        <span className="font-mono font-bold text-slate-800">{selectedWithdrawal.partnerCode}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Partner UUID</span>
                        <span className="font-mono text-[10px] text-slate-600 truncate block">
                          {selectedWithdrawal.partnerId}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Contact Lead / Email</span>
                        <span className="font-medium text-slate-800 block truncate">
                          {selectedWithdrawal.userEmail}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. PAYOUT DETAILS */}
                  <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-white">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#214ECF] flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <CreditCard size={14} />
                      <span>Payout Destination Details</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Payout Method</span>
                        <span className="font-bold text-slate-900 uppercase">
                          {selectedWithdrawal.method === "indian_bank" ? "Direct Bank Transfer (NEFT/RTGS)" : "PayPal"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Masked Destination</span>
                        <span className="font-semibold text-slate-800">{selectedWithdrawal.destinationMasked}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Currency</span>
                        <span className="font-mono font-bold text-slate-800">{selectedWithdrawal.currency}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Payment Reference</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {selectedWithdrawal.paymentReference || "— Awaiting disbursement —"}
                        </span>
                      </div>
                      {selectedWithdrawal.note && (
                        <div className="col-span-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700">
                          <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Partner Note:</span>
                          {selectedWithdrawal.note}
                        </div>
                      )}
                      {selectedWithdrawal.rejectionReason && (
                        <div className="col-span-2 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                          <span className="text-[10px] font-bold text-rose-700 block mb-0.5">Rejection Reason:</span>
                          {selectedWithdrawal.rejectionReason}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. FINANCIAL DETAILS */}
                  {financialBreakdown && (
                    <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-white">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-[#214ECF] flex items-center gap-1.5 border-b border-slate-100 pb-2">
                        <TrendingUp size={14} />
                        <span>Financial Balances & Settlement Source</span>
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                          <span className="text-slate-500 text-[10px] block">Total Lifetime Earnings</span>
                          <span className="font-black text-slate-900 text-sm">
                            ${financialBreakdown.totalEarnings.toFixed(2)}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                          <span className="text-slate-500 text-[10px] block">Total Paid Out</span>
                          <span className="font-black text-emerald-700 text-sm">
                            ${financialBreakdown.paidAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                          <span className="text-slate-500 text-[10px] block">Currently Available Balance</span>
                          <span className="font-black text-[#214ECF] text-sm">
                            ${financialBreakdown.availableBalance.toFixed(2)}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                          <span className="text-slate-500 text-[10px] block">Disputed / Held Amount</span>
                          <span className="font-black text-rose-700 text-sm">
                            ${financialBreakdown.disputedAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. AUDIT TRAIL */}
                  <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-white">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#214ECF] flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <ShieldCheck size={14} />
                      <span>Immutable Audit Trail</span>
                    </h4>
                    <div className="space-y-3">
                      {selectedWithdrawal.auditHistory?.map((audit, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs">
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">{audit.status}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(audit.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              by <span className="font-semibold text-slate-800">{audit.actor}</span>
                            </p>
                            {audit.note && (
                              <p className="mt-0.5 text-[11px] text-slate-500 italic bg-slate-50 rounded p-1">
                                {audit.note}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="border-t border-slate-200 p-4 bg-slate-50 flex items-center justify-between gap-2">
              <button
                onClick={() => setDetailDrawerOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Close Drawer
              </button>

              <div className="flex items-center gap-2">
                {selectedWithdrawal.status === "REQUESTED" && (
                  <button
                    onClick={() => handleOpenActionModal(selectedWithdrawal, "review")}
                    className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
                  >
                    Start Review
                  </button>
                )}

                {(selectedWithdrawal.status === "REQUESTED" || selectedWithdrawal.status === "UNDER_REVIEW") && (
                  <>
                    <button
                      onClick={() => handleOpenActionModal(selectedWithdrawal, "reject")}
                      className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleOpenActionModal(selectedWithdrawal, "approve")}
                      className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                    >
                      Approve
                    </button>
                  </>
                )}

                {selectedWithdrawal.status === "APPROVED" && (
                  <button
                    onClick={() => handleOpenActionModal(selectedWithdrawal, "process")}
                    className="rounded-xl bg-[#214ECF] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1b3fa8] transition"
                  >
                    Move to Processing
                  </button>
                )}

                {(selectedWithdrawal.status === "PROCESSING" || selectedWithdrawal.status === "APPROVED") && (
                  <button
                    onClick={() => handleOpenActionModal(selectedWithdrawal, "pay")}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                  >
                    Confirm & Mark Paid
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── REQUIREMENT 5: ADMIN ACTION CONFIRMATION MODALS ───────────────── */}
      {actionType && actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-scaleUp">
            {/* Modal Title */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    actionType === "approve"
                      ? "bg-emerald-50 text-emerald-700"
                      : actionType === "reject"
                      ? "bg-rose-50 text-rose-700"
                      : actionType === "pay"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-blue-50 text-[#214ECF]"
                  }`}
                >
                  {actionType === "approve" ? (
                    <Check size={16} />
                  ) : actionType === "reject" ? (
                    <X size={16} />
                  ) : actionType === "pay" ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </div>
                <h3 className="text-sm font-black text-slate-900 capitalize">
                  {actionType === "pay"
                    ? "Confirm Final Payment"
                    : actionType === "approve"
                    ? "Approve Withdrawal"
                    : actionType === "reject"
                    ? "Reject Withdrawal"
                    : actionType === "process"
                    ? "Move to Processing"
                    : "Review Withdrawal"}
                </h3>
              </div>
              <button
                onClick={() => setActionType(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error Message if any */}
            {actionError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Modal Info Summary */}
            <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1.5 border border-slate-200/60">
              <div className="flex justify-between">
                <span className="text-slate-500">Request:</span>
                <span className="font-bold font-mono text-slate-900">{actionTarget.requestId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">BPO Centre:</span>
                <span className="font-bold text-slate-900">{actionTarget.centreName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-black text-slate-900 text-sm">
                  ${actionTarget.amount.toFixed(2)} {actionTarget.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Destination:</span>
                <span className="font-medium text-slate-700">{actionTarget.destinationMasked}</span>
              </div>
            </div>

            {/* Form Fields Depending on Action */}
            {actionType === "reject" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Mandatory Rejection Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this withdrawal cannot be approved (e.g. pending audit, discrepancy in billable hours)..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-600 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400">
                  This reason will be recorded in the audit log and notified to the partner. Funds will remain in their eligible balance.
                </p>
              </div>
            )}

            {actionType === "pay" && (
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Actual Payment / Transaction Reference <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. WIRE-2026-9812, UTR-491203, TXN-9982"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#214ECF] focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400">
                    Enter the authoritative bank wire reference or payment gateway transaction ID.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Payment Date</label>
                  <input
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#214ECF] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Optional Admin Note */}
            {actionType !== "reject" && (
              <div className="space-y-1 text-xs">
                <label className="font-bold text-slate-700">Optional Internal Note</label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Optional internal remarks for the audit trail..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-[#214ECF] focus:outline-none"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActionType(null)}
                disabled={actionSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={actionSubmitting}
                className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 ${
                  actionType === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : actionType === "reject"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : actionType === "pay"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-[#214ECF] hover:bg-[#1b3fa8]"
                }`}
              >
                {actionSubmitting ? "Executing..." : `Confirm ${actionType.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
