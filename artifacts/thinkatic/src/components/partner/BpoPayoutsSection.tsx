import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  Wallet,
  FileText,
  CheckCircle2,
  Clock,
  Loader,
  ShieldAlert,
  Briefcase,
  CreditCard,
  Download,
  Search,
  SlidersHorizontal,
  RefreshCw,
  X,
  AlertTriangle,
  Send,
  Printer,
  Calendar,
  ChevronRight,
  Info,
  DollarSign,
  Building2,
  ArrowUpRight,
  ArrowDownToLine,
  Copy,
  Check,
  ExternalLink,
  Eye,
  HelpCircle,
} from "lucide-react";

export interface PayoutStatement {
  id: string | number;
  statement_number: string;
  payout_code?: string;
  bpo_partner_id: string;
  partner_name?: string;
  centre_id?: number;
  centre_name?: string;
  project_id?: number | null;
  project_name?: string;
  period_start: string;
  period_end: string;
  billing_period?: string;
  logged_hours?: number;
  billable_units?: number;
  unit_type?: "hour" | "unit" | "seat" | "fixed";
  unit_rate?: number;
  gross_amount: number;
  quality_bonus?: number;
  sla_deductions?: number;
  adjustments_amount?: number;
  deductions_amount?: number;
  approved_amount: number;
  net_amount?: number;
  currency?: string;
  status: "PENDING" | "APPROVED" | "PROCESSING" | "PAID" | "FAILED" | "ON_HOLD" | "DISPUTED" | "CANCELLED";
  raw_status?: string;
  payout_date?: string | null;
  payment_date?: string | null;
  payment_reference?: string | null;
  payment_method?: string | null;
  internal_notes?: string | null;
  source_records_summary?: Record<string, any>;
  is_disputed?: boolean;
  active_dispute_id?: number | null;
  active_dispute_code?: string | null;
  dispute_status?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ProjectEarningItem {
  projectId: number | null;
  projectName: string;
  agentsCount: number;
  period: string;
  completedUnits: number;
  unitType: string;
  unitRate: number;
  grossEarnings: number;
  adjustments: number;
  netPayout: number;
  currency: string;
  status: string;
  payoutCode?: string;
  payoutDate?: string | null;
  paymentReference?: string | null;
}

export interface DisputeRecord {
  id: string | number;
  dispute_number: string;
  dispute_code?: string;
  reference_type: "INVOICE" | "PAYOUT";
  reference_id: string;
  target_id?: number;
  target_code?: string;
  project_id?: number | null;
  disputed_amount: number;
  currency?: string;
  reason: string;
  description: string;
  evidence_text?: string;
  evidence_url?: string | null;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  resolution_notes?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export interface WithdrawalItem {
  id: string | number;
  request_code?: string;
  amount: number;
  currency: string;
  method: string;
  status: "REQUESTED" | "UNDER_REVIEW" | "APPROVED" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED";
  raw_status?: string;
  requested_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  processing_at?: string | null;
  paid_at?: string | null;
  payment_reference?: string | null;
  rejection_reason?: string | null;
  admin_note?: string | null;
  destination_masked?: string | null;
  partner_notes?: string | null;
  audit_history?: Array<{
    status: string;
    changed_at: string;
    changed_by?: string;
    notes?: string;
    reference?: string;
  }>;
}

export interface PayoutMethod {
  id: string;
  type: "bank_wire" | "paypal" | "ach" | "other";
  title: string;
  maskedAccount: string;
  isDefault?: boolean;
  currency?: string;
}

interface BpoPayoutsSectionProps {
  api: (path: string, options?: RequestInit) => Promise<Response>;
}

export default function BpoPayoutsSection({ api }: BpoPayoutsSectionProps) {
  // Navigation & Sub-views
  const [activeSubTab, setActiveSubTab] = useState<"statements" | "withdrawals" | "projects" | "disputes">("statements");

  // Data State
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<any>(null);
  const [statements, setStatements] = useState<PayoutStatement[]>([]);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [withdrawalSummary, setWithdrawalSummary] = useState<any>(null);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter State (Statements)
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Search & Filter State (Withdrawals)
  const [withdrawalSearch, setWithdrawalSearch] = useState("");
  const [withdrawalFilter, setWithdrawalFilter] = useState<string>("ALL");

  // Drawer & Modal State (Statements)
  const [selectedStatement, setSelectedStatement] = useState<PayoutStatement | null>(null);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeTarget, setDisputeTarget] = useState<PayoutStatement | null>(null);
  const [disputeReason, setDisputeReason] = useState("HOURS_MISMATCH");
  const [disputedAmount, setDisputedAmount] = useState<number>(0);
  const [disputeDesc, setDisputeDesc] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Drawer & Modal State (Withdrawals)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawCurrency] = useState("USD");
  const [selectedPayoutMethodId, setSelectedPayoutMethodId] = useState<string>("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load Authoritative Real Data from Supabase
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [earningsRes, payoutsRes, disputesRes, withdrawalsRes, summaryRes] = await Promise.all([
        api("/bpo/earnings"),
        api("/bpo/payouts"),
        api("/bpo/disputes"),
        api("/bpo/withdrawals").catch(() => null),
        api("/bpo/withdrawals/summary").catch(() => null),
      ]);

      if (earningsRes.ok) {
        const eData = await earningsRes.json();
        setEarnings(eData);
      }
      if (payoutsRes.ok) {
        const pData = await payoutsRes.json();
        setStatements(pData.statements || pData.payouts || []);
      }
      if (disputesRes.ok) {
        const dData = await disputesRes.json();
        setDisputes(dData.disputes || []);
      }
      if (withdrawalsRes && withdrawalsRes.ok) {
        const wData = await withdrawalsRes.json();
        setWithdrawals(wData.withdrawals || []);
        if (wData.payoutMethods && Array.isArray(wData.payoutMethods)) {
          setPayoutMethods(wData.payoutMethods);
          if (!selectedPayoutMethodId && wData.payoutMethods.length > 0) {
            const def = wData.payoutMethods.find((pm: PayoutMethod) => pm.isDefault) || wData.payoutMethods[0];
            setSelectedPayoutMethodId(def.id);
          }
        }
      }
      if (summaryRes && summaryRes.ok) {
        const sData = await summaryRes.json();
        setWithdrawalSummary(sData.financialSummary || null);
        if (sData.payoutMethods && Array.isArray(sData.payoutMethods) && payoutMethods.length === 0) {
          setPayoutMethods(sData.payoutMethods);
          const def = sData.payoutMethods.find((pm: PayoutMethod) => pm.isDefault) || sData.payoutMethods[0];
          if (def) setSelectedPayoutMethodId(def.id);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load authoritative payout statements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Copy ID helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Safe Financial Numbers (using server-provided Decimal values)
  const availableBalance = Number(
    withdrawalSummary?.availableBalance ??
      earnings?.summary?.availableBalance ??
      earnings?.metrics?.availableBalance ??
      0
  );
  const processingAmount = Number(
    withdrawalSummary?.processingAmount ??
      earnings?.summary?.processingAmount ??
      earnings?.metrics?.processingAmount ??
      0
  );
  const totalEarnings = Number(
    withdrawalSummary?.totalEarnings ??
      earnings?.metrics?.totalEarnings ??
      earnings?.summary?.totalEarnings ??
      0
  );
  const pendingEarnings = Number(
    withdrawalSummary?.pendingEarnings ??
      earnings?.metrics?.pendingEarnings ??
      earnings?.summary?.pendingEarnings ??
      0
  );
  const paidEarnings = Number(
    withdrawalSummary?.paidEarnings ??
      earnings?.metrics?.paidEarnings ??
      earnings?.summary?.paidEarnings ??
      0
  );
  const upcomingPayout = Number(
    withdrawalSummary?.upcomingPayout ??
      earnings?.metrics?.upcomingPayout ??
      earnings?.summary?.upcomingPayout ??
      0
  );
  const openDisputesCount = Number(
    withdrawalSummary?.openDisputes ??
      earnings?.metrics?.openDisputes ??
      disputes.filter((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW").length
  );
  const projectEarningsTotal = Number(
    earnings?.metrics?.projectEarningsTotal ?? earnings?.summary?.projectEarningsTotal ?? totalEarnings
  );
  const thisMonthEarnings = Number(earnings?.metrics?.thisMonthEarnings ?? totalEarnings);
  const lastMonthEarnings = Number(earnings?.metrics?.lastMonthEarnings ?? 0);
  const adjustmentsTotal = Number(earnings?.metrics?.adjustmentsTotal ?? 0);

  const projectList: ProjectEarningItem[] = earnings?.projectEarnings || earnings?.projectBreakdown || [];

  // Filtered statements based on Search & Status
  const filteredStatements = useMemo(() => {
    return statements.filter((st) => {
      const statementNum = (st.statement_number || st.payout_code || "").toLowerCase();
      const projName = (st.project_name || "").toLowerCase();
      const period = `${st.period_start || ""} ${st.period_end || ""}`.toLowerCase();
      const stStatus = (st.status || "").toUpperCase();

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        statementNum.includes(query) ||
        projName.includes(query) ||
        period.includes(query) ||
        stStatus.includes(query);

      let matchesStatus = true;
      if (statusFilter === "PENDING") {
        matchesStatus = stStatus === "PENDING" || stStatus === "APPROVED";
      } else if (statusFilter === "PROCESSING") {
        matchesStatus = stStatus === "PROCESSING";
      } else if (statusFilter === "PAID") {
        matchesStatus = stStatus === "PAID";
      } else if (statusFilter === "DISPUTED") {
        matchesStatus = stStatus === "DISPUTED" || Boolean(st.is_disputed);
      } else if (statusFilter === "FAILED") {
        matchesStatus = stStatus === "FAILED" || stStatus === "CANCELLED";
      }

      return matchesSearch && matchesStatus;
    });
  }, [statements, searchQuery, statusFilter]);

  // Filtered withdrawals based on Search & Status
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      const idStr = String(w.id || "").toLowerCase();
      const codeStr = (w.request_code || "").toLowerCase();
      const methodStr = (w.method || "").toLowerCase();
      const refStr = (w.payment_reference || "").toLowerCase();
      const notesStr = (w.partner_notes || "").toLowerCase();
      const statusStr = (w.status || "").toUpperCase();

      const query = withdrawalSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        idStr.includes(query) ||
        codeStr.includes(query) ||
        methodStr.includes(query) ||
        refStr.includes(query) ||
        notesStr.includes(query) ||
        statusStr.includes(query);

      let matchesStatus = true;
      if (withdrawalFilter !== "ALL") {
        matchesStatus = statusStr === withdrawalFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [withdrawals, withdrawalSearch, withdrawalFilter]);

  // Handle CSV Export
  const handleExportCsv = () => {
    const token = localStorage.getItem("user_token");
    window.open(`/api/bpo/reports/payouts/export?format=csv&token=${encodeURIComponent(token || "")}`, "_blank");
  };

  // Open Dispute Modal for a specific Statement
  const handleOpenDispute = (statement: PayoutStatement) => {
    setDisputeTarget(statement);
    const amount = Number(statement.net_amount ?? statement.approved_amount ?? statement.gross_amount ?? 0);
    setDisputedAmount(amount > 0 ? amount : 100);
    setDisputeReason("HOURS_MISMATCH");
    setDisputeDesc("");
    setEvidenceText("");
    setDisputeModalOpen(true);
  };

  // Submit Formal Dispute
  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeTarget) return;

    setSubmittingDispute(true);
    setError(null);
    try {
      const res = await api(`/bpo/payouts/${disputeTarget.id}/dispute`, {
        method: "POST",
        body: JSON.stringify({
          reason: disputeReason,
          disputed_amount: Number(disputedAmount),
          description: disputeDesc.trim(),
          evidence_text: evidenceText.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || "Failed to submit dispute.");
      }

      const data = await res.json();
      setSuccessMsg(
        `Dispute ${data.dispute?.dispute_number || data.dispute?.dispute_code || ""} submitted successfully. Thinkatic Finance will review your justification.`
      );
      setDisputeModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  // Submit Withdrawal Request
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(withdrawAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid withdrawal amount greater than 0.");
      return;
    }

    if (amountNum > availableBalance) {
      setError(`Requested amount ($${amountNum.toFixed(2)}) exceeds your available balance ($${availableBalance.toFixed(2)}).`);
      return;
    }

    const selectedMethod = payoutMethods.find((pm) => pm.id === selectedPayoutMethodId) || payoutMethods[0];
    const destinationMasked = selectedMethod ? selectedMethod.maskedAccount : "••••4892";
    const methodType = selectedMethod ? selectedMethod.type : "bank_wire";

    setSubmittingWithdrawal(true);
    setError(null);

    try {
      const res = await api("/bpo/withdrawals", {
        method: "POST",
        body: JSON.stringify({
          amount: amountNum,
          currency: withdrawCurrency,
          payoutMethodId: selectedMethod?.id || "pm-default-bank",
          payoutMethodType: methodType,
          destinationMasked,
          partnerNotes: withdrawNotes.trim() || undefined,
          idempotencyKey: `wd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to submit withdrawal request.");
      }

      setSuccessMsg(
        `Withdrawal request of $${amountNum.toFixed(2)} ${withdrawCurrency} submitted successfully (ID: ${data.withdrawal?.request_code || data.withdrawal?.id}). It is now under review by Thinkatic Finance.`
      );
      setWithdrawModalOpen(false);
      setWithdrawAmount("");
      setWithdrawNotes("");
      setActiveSubTab("withdrawals");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to request withdrawal.");
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  // Badge Styling per Payment Status
  const getStatusBadge = (status: string, isDisputed?: boolean) => {
    if (isDisputed && status !== "PAID") {
      return "bg-rose-50 text-rose-700 border-rose-200 font-bold";
    }
    switch (status?.toUpperCase()) {
      case "PAID":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold";
      case "PROCESSING":
        return "bg-blue-50 text-[#214ECF] border-blue-200 font-bold animate-pulse";
      case "APPROVED":
        return "bg-sky-50 text-sky-800 border-sky-200 font-bold";
      case "REQUESTED":
      case "PENDING":
        return "bg-amber-50 text-amber-800 border-amber-200 font-medium";
      case "UNDER_REVIEW":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 font-medium";
      case "DISPUTED":
      case "REJECTED":
        return "bg-rose-50 text-rose-700 border-rose-200 font-bold";
      case "ON_HOLD":
        return "bg-orange-50 text-orange-800 border-orange-200 font-medium";
      case "FAILED":
      case "CANCELLED":
        return "bg-slate-100 text-slate-700 border-slate-300";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="bg-white min-h-full space-y-6 text-slate-900 pb-12">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF] border border-blue-100 shadow-2xs">
              <Wallet size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Partner Payouts & Operational Earnings
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Authoritative campaign remittances, SLA reconciliations, and wire disbursements for{" "}
                <span className="font-bold text-slate-800">
                  {earnings?.centre?.centreName || "Aura Global BPO Centre"}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary Withdraw Funds Button */}
          <button
            onClick={() => {
              setWithdrawAmount(availableBalance > 0 ? String(availableBalance) : "");
              setWithdrawModalOpen(true);
            }}
            disabled={availableBalance <= 0}
            className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#1a3fa8] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            title={availableBalance <= 0 ? "No available balance eligible to withdraw" : "Request payout of available earnings"}
          >
            <ArrowUpRight size={14} />
            <span>Withdraw Funds</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:border-[#214ECF]/50 hover:bg-blue-50/30 hover:text-[#214ECF] transition-all duration-200"
            title="Download CSV report of authorized payout statements"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => void loadData()}
            className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-[#214ECF]/50 hover:bg-blue-50/30 hover:text-[#214ECF] shadow-2xs transition-all duration-200"
            title="Refresh financial data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[#214ECF]" : ""} />
          </button>
        </div>
      </div>

      {/* ── NOTIFICATIONS & ALERTS ──────────────────────────────────────── */}
      {successMsg && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs font-semibold text-emerald-900 shadow-2xs transition-all animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 transition"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs font-semibold text-rose-800 shadow-2xs transition-all animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="text-rose-600 shrink-0" size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="rounded-lg p-1 text-rose-700 hover:bg-rose-100 transition"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── 2. BPO PAYOUT DASHBOARD — 7 REAL FINANCIAL KPI CARDS ─────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
        {/* KPI 1: Available Balance (PRIMARY CALL-TO-ACTION) */}
        <div className="group rounded-2xl border-2 border-[#214ECF]/30 bg-blue-50/30 p-4 shadow-2xs hover:border-[#214ECF] hover:shadow-xs transition-all duration-200 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#214ECF]">Available to Withdraw</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#214ECF] text-white shadow-xs">
              <Wallet size={15} />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-black text-[#214ECF] tracking-tight">
            ${availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-medium">Ready for payout</span>
            {availableBalance > 0 && (
              <button
                onClick={() => {
                  setWithdrawAmount(String(availableBalance));
                  setWithdrawModalOpen(true);
                }}
                className="text-[10px] font-bold text-[#214ECF] hover:underline"
              >
                Withdraw →
              </button>
            )}
          </div>
        </div>

        {/* KPI 2: Total Earnings */}
        <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-[#214ECF]/40 hover:shadow-xs transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Earnings</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#214ECF] group-hover:bg-[#214ECF] group-hover:text-white transition-colors duration-200">
              <TrendingUp size={15} />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-black text-slate-900 tracking-tight">
            ${totalEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 font-medium">Cumulative gross & net</p>
        </div>

        {/* KPI 3: Pending Earnings */}
        <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-amber-400/50 hover:shadow-xs transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-200">
              <Clock size={15} />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-black text-amber-600 tracking-tight">
            ${pendingEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 font-medium">Under finance approval</p>
        </div>

        {/* KPI 4: Processing Amount */}
        <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-blue-400/50 hover:shadow-xs transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">In Processing</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-700 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-200">
              <CreditCard size={15} />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-black text-sky-700 tracking-tight">
            ${processingAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 font-medium">Active bank disbursement</p>
        </div>

        {/* KPI 5: Paid Earnings */}
        <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-emerald-400/50 hover:shadow-xs transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Paid Earnings</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-black text-emerald-600 tracking-tight">
            ${paidEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 font-medium">Directly settled to bank</p>
        </div>

        {/* KPI 6: Upcoming Payout */}
        <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-[#214ECF]/40 hover:shadow-xs transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Upcoming</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-[#214ECF] group-hover:bg-[#214ECF] group-hover:text-white transition-colors duration-200">
              <Calendar size={15} />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-black text-[#214ECF] tracking-tight">
            ${upcomingPayout.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 font-medium">Scheduled batch cycle</p>
        </div>

        {/* KPI 7: Open Disputes */}
        <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-rose-400/50 hover:shadow-xs transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Open Disputes</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition-colors duration-200">
              <ShieldAlert size={15} />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-black text-rose-600 tracking-tight">{openDisputesCount}</p>
          <p className="mt-1 text-[11px] text-slate-400 font-medium">Held in reconciliation</p>
        </div>
      </div>

      {/* ── 3. EARNINGS SUMMARY BREAKDOWN (Exact Decimal Math) ──────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3.5 mb-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <TrendingUp className="text-[#214ECF]" size={16} />
              Earnings Summary Breakdown (PostgreSQL Decimal-Exact)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly calculated server-side using Decimal.js and PostgreSQL NUMERIC(14,2) without floating-point drift.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
            <Building2 size={12} className="text-[#214ECF]" />
            Centre ID: {earnings?.centre?.centreId || 1} • Currency: USD
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-xs">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Earnings</p>
            <p className="mt-1 text-base font-black text-slate-900">
              ${totalEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Cumulative net payout</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">This Month</p>
            <p className="mt-1 text-base font-black text-[#214ECF]">
              ${thisMonthEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">September 2026</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Last Month</p>
            <p className="mt-1 text-base font-black text-slate-700">
              ${lastMonthEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">August 2026</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending</p>
            <p className="mt-1 text-base font-black text-amber-600">
              ${pendingEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Scheduled disbursements</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Paid</p>
            <p className="mt-1 text-base font-black text-emerald-600">
              ${paidEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Wire confirmed</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Adjustments</p>
            <p
              className={`mt-1 text-base font-black ${
                adjustmentsTotal >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {adjustmentsTotal >= 0 ? "+" : "-"}$
              {Math.abs(adjustmentsTotal).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Quality bonus & deductions</p>
          </div>
        </div>
      </div>

      {/* ── SUB-TAB NAVIGATION ───────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("statements")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all duration-200 ${
            activeSubTab === "statements"
              ? "border-[#214ECF] text-[#214ECF]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileText size={15} />
          Payout Statements ({statements.length})
        </button>

        <button
          onClick={() => setActiveSubTab("withdrawals")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all duration-200 ${
            activeSubTab === "withdrawals"
              ? "border-[#214ECF] text-[#214ECF]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ArrowDownToLine size={15} />
          Withdrawal Requests ({withdrawals.length})
        </button>

        <button
          onClick={() => setActiveSubTab("projects")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all duration-200 ${
            activeSubTab === "projects"
              ? "border-[#214ECF] text-[#214ECF]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Briefcase size={15} />
          Project Allocations ({projectList.length})
        </button>

        <button
          onClick={() => setActiveSubTab("disputes")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all duration-200 ${
            activeSubTab === "disputes"
              ? "border-[#214ECF] text-[#214ECF]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ShieldAlert size={15} />
          Disputes & Resolution ({disputes.length})
        </button>
      </div>

      {/* ── 4. WITHDRAWAL REQUESTS TAB VIEW ─────────────────────────────── */}
      {activeSubTab === "withdrawals" && (
        <div className="space-y-4">
          {/* Search, Filter & Quick Action Bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search by Request ID, notes, reference..."
                value={withdrawalSearch}
                onChange={(e) => setWithdrawalSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#214ECF] focus:ring-1 focus:ring-[#214ECF]"
              />
              {withdrawalSearch && (
                <button
                  onClick={() => setWithdrawalSearch("")}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
                <SlidersHorizontal size={13} />
                Status:
              </span>
              {["ALL", "REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "PAID", "REJECTED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setWithdrawalFilter(st)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
                    withdrawalFilter === st
                      ? "bg-[#214ECF] text-white shadow-2xs"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {st.replaceAll("_", " ")}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setWithdrawAmount(availableBalance > 0 ? String(availableBalance) : "");
                setWithdrawModalOpen(true);
              }}
              disabled={availableBalance <= 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#1a3fa8] disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
            >
              <ArrowUpRight size={13} />
              <span>Request Payout</span>
            </button>
          </div>

          {/* Table Container or Premium Empty State */}
          {filteredWithdrawals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500 shadow-2xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#214ECF] mb-4">
                <ArrowDownToLine size={28} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">No withdrawal requests yet</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                BPO partner withdrawal requests will appear here when submitted.
                {availableBalance > 0 ? (
                  <span className="block mt-1 font-bold text-[#214ECF]">
                    You have ${availableBalance.toFixed(2)} USD eligible and available to withdraw right now.
                  </span>
                ) : (
                  <span className="block mt-1 text-slate-400">
                    Earnings from active production campaigns become eligible once approved.
                  </span>
                )}
              </p>
              {availableBalance > 0 && (
                <div className="mt-5">
                  <button
                    onClick={() => {
                      setWithdrawAmount(String(availableBalance));
                      setWithdrawModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1a3fa8] transition"
                  >
                    <ArrowUpRight size={14} />
                    <span>Withdraw ${availableBalance.toFixed(2)} USD</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-4">Request ID</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Currency</th>
                    <th className="p-4">Payout Method</th>
                    <th className="p-4">Destination</th>
                    <th className="p-4">Requested Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Payment Ref / Notes</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWithdrawals.map((w) => (
                    <tr
                      key={w.id}
                      className="hover:bg-blue-50/30 hover:border-l-2 hover:border-l-[#214ECF] transition-all duration-150"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                          <span>{w.request_code || `REQ-${w.id}`}</span>
                          <button
                            onClick={() => copyToClipboard(w.request_code || String(w.id), String(w.id))}
                            className="text-slate-400 hover:text-slate-700 transition"
                            title="Copy Request ID"
                          >
                            {copiedId === String(w.id) ? (
                              <Check size={13} className="text-emerald-600" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="p-4 font-black text-slate-900 text-sm">
                        ${Number(w.amount).toFixed(2)}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-500">
                        {w.currency || "USD"}
                      </td>
                      <td className="p-4 capitalize font-medium text-slate-700">
                        {w.method ? w.method.replaceAll("_", " ") : "Bank Wire"}
                      </td>
                      <td className="p-4 font-mono text-slate-600">
                        {w.destination_masked || "••••4892"}
                      </td>
                      <td className="p-4 text-slate-600 whitespace-nowrap">
                        {w.requested_at ? new Date(w.requested_at).toLocaleDateString() : "Today"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                            w.status
                          )}`}
                        >
                          {w.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 max-w-[200px]">
                        {w.status === "PAID" && w.payment_reference ? (
                          <div>
                            <span className="font-mono text-[10px] font-bold text-emerald-700 block truncate">
                              Ref: {w.payment_reference}
                            </span>
                            {w.paid_at && (
                              <span className="text-[10px] text-slate-400 block">
                                Paid {new Date(w.paid_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : w.status === "REJECTED" && w.rejection_reason ? (
                          <span className="text-[11px] font-medium text-rose-700 line-clamp-1" title={w.rejection_reason}>
                            {w.rejection_reason}
                          </span>
                        ) : w.admin_note ? (
                          <span className="text-[11px] text-slate-600 line-clamp-1" title={w.admin_note}>
                            {w.admin_note}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No notes</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedWithdrawal(w)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-[#214ECF]/50 hover:bg-blue-50/50 hover:text-[#214ECF] transition-all duration-150 shadow-2xs"
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 5. STATEMENTS VIEW & SEARCH / FILTER ─────────────────────────── */}
      {activeSubTab === "statements" && (
        <div className="space-y-4">
          {/* Search & Status Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search by Statement #, Project, Period, Status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#214ECF] focus:ring-1 focus:ring-[#214ECF]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
                <SlidersHorizontal size={13} />
                Filter:
              </span>
              {["ALL", "PENDING", "PROCESSING", "PAID", "DISPUTED", "FAILED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
                    statusFilter === st
                      ? "bg-[#214ECF] text-white shadow-2xs"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          {filteredStatements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500 shadow-2xs">
              <p className="font-bold text-slate-800 text-base">No payout statements yet</p>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                Approved project earnings will appear here when payout records are generated.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-4">Statement #</th>
                    <th className="p-4">Project</th>
                    <th className="p-4">Billing Period</th>
                    <th className="p-4">Gross</th>
                    <th className="p-4">Adjustments</th>
                    <th className="p-4">Net Payout</th>
                    <th className="p-4">Currency</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Payment Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStatements.map((st) => (
                    <tr
                      key={st.id}
                      className="hover:bg-blue-50/30 hover:border-l-2 hover:border-l-[#214ECF] transition-all duration-150"
                    >
                      <td className="p-4 font-mono font-bold text-slate-900">
                        {st.statement_number || st.payout_code}
                      </td>
                      <td className="p-4 font-medium text-slate-800 flex items-center gap-1.5">
                        <Briefcase size={13} className="text-slate-400 shrink-0" />
                        <span className="max-w-[160px] truncate">{st.project_name || "Operational Delivery"}</span>
                      </td>
                      <td className="p-4 text-slate-600 whitespace-nowrap">
                        {st.period_start} → {st.period_end}
                      </td>
                      <td className="p-4 font-medium text-slate-700">
                        ${Number(st.gross_amount || 0).toFixed(2)}
                      </td>
                      <td className="p-4">
                        {Number(st.adjustments_amount || st.quality_bonus || 0) > 0 ||
                        Number(st.deductions_amount || st.sla_deductions || 0) > 0 ? (
                          <div className="space-y-0.5 text-[11px]">
                            {Number(st.adjustments_amount || st.quality_bonus || 0) > 0 && (
                              <span className="font-semibold text-emerald-600">
                                +${Number(st.adjustments_amount || st.quality_bonus).toFixed(2)}
                              </span>
                            )}
                            {Number(st.deductions_amount || st.sla_deductions || 0) > 0 && (
                              <span className="block font-semibold text-rose-600">
                                -${Number(st.deductions_amount || st.sla_deductions).toFixed(2)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">$0.00</span>
                        )}
                      </td>
                      <td className="p-4 font-black text-slate-900 text-sm">
                        ${Number(st.net_amount ?? st.approved_amount ?? 0).toFixed(2)}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-500">
                        {st.currency || "USD"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                            st.status,
                            st.is_disputed
                          )}`}
                        >
                          {st.is_disputed && st.status !== "PAID" ? "DISPUTED" : st.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 whitespace-nowrap">
                        {st.payout_date || st.payment_date ? (
                          <div>
                            <span className="font-medium text-slate-800">{st.payout_date || st.payment_date}</span>
                            {st.payment_reference && (
                              <span className="block text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                                Ref: {st.payment_reference}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pending approval</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedStatement(st)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-[#214ECF]/50 hover:bg-blue-50/50 hover:text-[#214ECF] transition-all duration-150 shadow-2xs"
                            title="View Statement Details"
                          >
                            <span>View</span>
                          </button>
                          <button
                            onClick={handleExportCsv}
                            className="inline-flex items-center justify-center p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-[#214ECF]/50 hover:bg-blue-50/50 hover:text-[#214ECF] transition-all duration-150 shadow-2xs"
                            title="Download CSV"
                          >
                            <Download size={13} />
                          </button>
                          {st.status !== "CANCELLED" && (
                            <button
                              onClick={() => handleOpenDispute(st)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-all duration-150"
                              title="Dispute this Statement"
                            >
                              <ShieldAlert size={12} />
                              <span>Dispute</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 6. PROJECT-WISE EARNINGS ALLOCATION ──────────────────────────── */}
      {activeSubTab === "projects" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3.5 mb-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Briefcase className="text-[#214ECF]" size={16} />
                Project-Wise Earnings & Campaign Allocation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Earnings linked strictly to the authenticated partner centre. Partner isolation is enforced at the database level.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {projectList.length} Active Project Allocation{projectList.length === 1 ? "" : "s"}
            </span>
          </div>

          {projectList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-xs text-slate-500">
              No project allocations recorded yet. When campaign shifts or production transactions are approved, earnings will populate here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectList.map((proj, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-[#214ECF]/50 hover:bg-blue-50/10 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] font-bold text-[#214ECF] uppercase tracking-wider">
                        {proj.payoutCode || `PROJ-ALLOC-0${proj.projectId || 1}`}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 mt-0.5">{proj.projectName}</h4>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                        proj.status
                      )}`}
                    >
                      {proj.status}
                    </span>
                  </div>

                  <div className="mt-3.5 grid grid-cols-3 gap-2.5 rounded-lg bg-slate-50 p-2.5 text-[11px] border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Agents</span>
                      <span className="font-bold text-slate-800">{proj.agentsCount} Dedicated</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Billing Units</span>
                      <span className="font-bold text-slate-800">
                        {Number(proj.completedUnits).toFixed(1)} {proj.unitType}s
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Contract Rate</span>
                      <span className="font-bold text-slate-800">${Number(proj.unitRate).toFixed(2)}/{proj.unitType}</span>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Billing Period</span>
                      <span className="font-medium text-slate-800">{proj.period}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Gross Earnings</span>
                      <span className="font-medium text-slate-800">${Number(proj.grossEarnings).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Adjustments</span>
                      <span className={proj.adjustments >= 0 ? "text-emerald-700 font-semibold" : "text-rose-700 font-semibold"}>
                        {proj.adjustments >= 0 ? "+" : "-"}${Math.abs(proj.adjustments).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2 font-black text-slate-900">
                      <span>Net Payout Remittance</span>
                      <span className="text-sm text-[#214ECF]">${Number(proj.netPayout).toFixed(2)} {proj.currency}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 7. DISPUTES TAB ─────────────────────────────────────────────── */}
      {activeSubTab === "disputes" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <ShieldAlert className="text-rose-600" size={16} />
                Audit Disputes & Resolution History
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every dispute is logged with formal audit tracking (`THK-DSP-XXXXX`). Admin resolutions update your statement adjustments directly.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                {openDisputesCount} Active Dispute{openDisputesCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {disputes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500 shadow-2xs">
              <p className="font-bold text-slate-800 text-base">No disputes on file</p>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                No disputes have been submitted by this centre. If you identify discrepancies in billable units or rates, you can file a dispute directly from any statement.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-4">Dispute #</th>
                    <th className="p-4">Target Statement</th>
                    <th className="p-4">Disputed Amount</th>
                    <th className="p-4">Reason Category</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Admin Resolution / Response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {disputes.map((dsp) => (
                    <tr key={dsp.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-mono font-bold text-slate-900">
                        {dsp.dispute_number || dsp.dispute_code}
                      </td>
                      <td className="p-4 font-mono font-semibold text-[#214ECF]">
                        {dsp.reference_id || dsp.target_code}
                      </td>
                      <td className="p-4 font-black text-rose-600">
                        ${Number(dsp.disputed_amount).toFixed(2)}
                      </td>
                      <td className="p-4 font-semibold text-slate-800">
                        {dsp.reason.replaceAll("_", " ")}
                      </td>
                      <td className="p-4 max-w-xs truncate text-slate-600" title={dsp.description || dsp.evidence_text}>
                        {dsp.description || dsp.evidence_text}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            dsp.status === "RESOLVED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : dsp.status === "REJECTED"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {dsp.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-700">
                        {dsp.resolution_notes || dsp.rejection_reason ? (
                          <div className="rounded-lg bg-slate-50 p-2 border border-slate-200 text-[11px] font-medium text-slate-800">
                            {dsp.resolution_notes || dsp.rejection_reason}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pending Admin Review</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 8. WITHDRAW FUNDS MODAL ─────────────────────────────────────── */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs transition-opacity animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF]">
                  <ArrowUpRight size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Request Withdrawal / Payout</h3>
                  <p className="text-xs text-slate-500">Disburse eligible settled funds to your partner account</p>
                </div>
              </div>
              <button
                onClick={() => setWithdrawModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Financial Summary Card */}
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Available Balance:</span>
                <span className="font-mono text-base font-black text-[#214ECF]">
                  ${availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">In Processing</span>
                  <span className="font-bold text-slate-700">${processingAmount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Pending</span>
                  <span className="font-bold text-slate-700">${pendingEarnings.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Held / Disputes</span>
                  <span className="font-bold text-rose-600">{openDisputesCount} item{openDisputesCount === 1 ? "" : "s"}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitWithdrawal} className="mt-4 space-y-4 text-xs">
              {/* Amount input */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block font-bold uppercase tracking-wider text-slate-600 text-[10px]">
                    Withdrawal Amount (USD) *
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Max: ${availableBalance.toFixed(2)}
                  </span>
                </div>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={availableBalance}
                    required
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 pl-7 pr-4 py-2 text-sm font-mono font-bold text-slate-900 outline-none focus:border-[#214ECF] focus:ring-1 focus:ring-[#214ECF]"
                  />
                </div>

                {/* Quick percentage buttons */}
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Quick:</span>
                  {[0.25, 0.5, 0.75, 1.0].map((pct) => {
                    const label = pct === 1.0 ? "Max (100%)" : `${pct * 100}%`;
                    const val = (availableBalance * pct).toFixed(2);
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setWithdrawAmount(val)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:border-[#214ECF] hover:bg-blue-50/50 hover:text-[#214ECF] transition"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payout Method Selector */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 text-[10px]">
                  Disbursement Payout Method *
                </label>
                <div className="mt-1.5 space-y-2">
                  {payoutMethods.length > 0 ? (
                    payoutMethods.map((pm) => (
                      <label
                        key={pm.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                          selectedPayoutMethodId === pm.id
                            ? "border-[#214ECF] bg-blue-50/30"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="payoutMethod"
                            value={pm.id}
                            checked={selectedPayoutMethodId === pm.id}
                            onChange={() => setSelectedPayoutMethodId(pm.id)}
                            className="text-[#214ECF] focus:ring-[#214ECF]"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{pm.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Account Ending: {pm.maskedAccount} {pm.isDefault && "• Default"}
                            </span>
                          </div>
                        </div>
                        <CreditCard size={16} className="text-slate-400" />
                      </label>
                    ))
                  ) : (
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CreditCard size={18} className="text-[#214ECF]" />
                        <div>
                          <span className="font-bold text-slate-900 block text-xs">Direct Corporate Bank Wire</span>
                          <span className="text-[10px] text-slate-500 font-mono">Verified Payout Account ••••4892</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Verified
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Reference / Notes */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 text-[10px]">
                  Optional Partner Reference / Memo
                </label>
                <input
                  type="text"
                  placeholder="e.g. Campaign Q3 Settlement, Team Ops Allocation..."
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>

              {/* Security & Verification Notice */}
              <div className="rounded-xl bg-blue-50/70 border border-blue-200 p-3 text-[11px] text-blue-950">
                <p className="font-bold flex items-center gap-1.5 text-[#214ECF]">
                  <Info size={13} />
                  Enterprise Wire Security Notice
                </p>
                <p className="mt-0.5 text-slate-600">
                  Withdrawal requests undergo automated eligibility checks and manual reconciliation by Thinkatic Finance before funds disbursement. Full account credentials are never transmitted in cleartext.
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setWithdrawModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWithdrawal || availableBalance <= 0}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-5 py-2 font-bold text-white shadow-2xs hover:bg-[#1a3fa8] disabled:opacity-50 transition"
                >
                  {submittingWithdrawal ? (
                    <>
                      <Loader size={13} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Submit Withdrawal Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 9. WITHDRAWAL DETAIL DRAWER (SLIDE-OVER / MODAL) ─────────────── */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/40 backdrop-blur-xs transition-opacity animate-fadeIn">
          <div className="h-full w-full max-w-lg bg-white p-6 shadow-2xl border-l border-slate-200 overflow-y-auto flex flex-col justify-between animate-slideLeft">
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="font-mono text-xs font-bold text-[#214ECF] uppercase tracking-wider">
                    Withdrawal Request Lifecycle
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <h3 className="text-xl font-black text-slate-900">
                      {selectedWithdrawal.request_code || `REQ-${selectedWithdrawal.id}`}
                    </h3>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          selectedWithdrawal.request_code || String(selectedWithdrawal.id),
                          "drawer-id"
                        )
                      }
                      className="text-slate-400 hover:text-slate-700 transition"
                      title="Copy Request ID"
                    >
                      {copiedId === "drawer-id" ? (
                        <Check size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedWithdrawal(null)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status Stepper */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Current Stage
                  </span>
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                      selectedWithdrawal.status
                    )}`}
                  >
                    {selectedWithdrawal.status.replaceAll("_", " ")}
                  </span>
                </div>

                {/* Progress Pipeline */}
                {selectedWithdrawal.status === "REJECTED" ? (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900">
                    <p className="font-bold flex items-center gap-1.5 text-rose-800">
                      <AlertTriangle size={14} />
                      Request Rejected by Finance
                    </p>
                    <p className="mt-1 text-[11px]">
                      Reason:{" "}
                      <span className="font-semibold">
                        {selectedWithdrawal.rejection_reason || "Eligibility or documentation mismatch."}
                      </span>
                    </p>
                    <p className="mt-1 text-[10px] text-rose-700">
                      The requested amount has been fully retained in your available balance.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-1 text-center text-[9px] font-bold uppercase tracking-wider">
                    {["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "PAID"].map((st, idx) => {
                      const stages = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "PAID"];
                      const currentIdx = stages.indexOf(selectedWithdrawal.status);
                      const isComplete = currentIdx >= idx;
                      const isCurrent = currentIdx === idx;

                      return (
                        <div key={st} className="flex flex-col items-center">
                          <div
                            className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] mb-1 font-bold ${
                              isComplete
                                ? "bg-[#214ECF] text-white"
                                : "bg-slate-200 text-slate-500"
                            } ${isCurrent ? "ring-2 ring-[#214ECF] ring-offset-2 animate-pulse" : ""}`}
                          >
                            {isComplete ? "✓" : idx + 1}
                          </div>
                          <span
                            className={
                              isComplete ? "text-[#214ECF]" : "text-slate-400"
                            }
                          >
                            {st.replace("_", " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Financial & Destination Details */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs">
                <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <DollarSign size={14} className="text-[#214ECF]" />
                  Disbursement Financial Details
                </p>
                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Requested Amount</span>
                    <span className="text-base font-black text-slate-900">
                      ${Number(selectedWithdrawal.amount).toFixed(2)} {selectedWithdrawal.currency || "USD"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Payout Method</span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {selectedWithdrawal.method ? selectedWithdrawal.method.replaceAll("_", " ") : "Bank Wire"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Destination Account</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedWithdrawal.destination_masked || "••••4892"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Requested Date</span>
                    <span className="font-semibold text-slate-800">
                      {selectedWithdrawal.requested_at
                        ? new Date(selectedWithdrawal.requested_at).toLocaleString()
                        : "Today"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bank Payment Confirmation (if PAID) */}
              {selectedWithdrawal.status === "PAID" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-1.5 text-xs text-emerald-950">
                  <p className="font-bold text-[11px] uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    Payment Settled & Disbursed
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-emerald-700 block">Payment Date</span>
                      <span className="font-bold text-emerald-950">
                        {selectedWithdrawal.paid_at
                          ? new Date(selectedWithdrawal.paid_at).toLocaleDateString()
                          : "Settled"}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-700 block">Transaction Reference</span>
                      <span className="font-mono font-bold text-emerald-950">
                        {selectedWithdrawal.payment_reference || "WIRE-CONFIRMED"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Notes / Partner Notes */}
              {(selectedWithdrawal.admin_note || selectedWithdrawal.partner_notes) && (
                <div className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                  <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <FileText size={14} className="text-[#214ECF]" />
                    Audit Notes & Reference
                  </p>
                  {selectedWithdrawal.partner_notes && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Your Reference Memo</span>
                      <p className="text-slate-700 mt-0.5">{selectedWithdrawal.partner_notes}</p>
                    </div>
                  )}
                  {selectedWithdrawal.admin_note && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Finance Administration Note</span>
                      <p className="text-slate-800 mt-0.5 font-medium">{selectedWithdrawal.admin_note}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Audit History Timeline */}
              {selectedWithdrawal.audit_history && selectedWithdrawal.audit_history.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs">
                  <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Clock size={14} className="text-[#214ECF]" />
                    Immutable Audit Trail
                  </p>
                  <div className="space-y-2 pt-1">
                    {selectedWithdrawal.audit_history.map((log, lIdx) => (
                      <div key={lIdx} className="flex items-start justify-between border-b border-slate-100 pb-1.5 text-[11px]">
                        <div>
                          <span className="font-bold uppercase tracking-wider text-slate-800">
                            {log.status.replaceAll("_", " ")}
                          </span>
                          {log.notes && <p className="text-slate-500 mt-0.5">{log.notes}</p>}
                          {log.reference && (
                            <p className="font-mono text-[10px] text-emerald-700">Ref: {log.reference}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {new Date(log.changed_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="border-t border-slate-100 pt-4 mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedWithdrawal(null)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 10. PAYOUT STATEMENT DETAIL DRAWER ───────────────────────────── */}
      {selectedStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/40 backdrop-blur-xs transition-opacity animate-fadeIn">
          <div className="h-full w-full max-w-lg bg-white p-6 shadow-2xl border-l border-slate-200 overflow-y-auto flex flex-col justify-between animate-slideLeft">
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="font-mono text-xs font-bold text-[#214ECF] uppercase tracking-wider">
                    Authoritative Payout Statement
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mt-0.5">
                    {selectedStatement.statement_number || selectedStatement.payout_code}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedStatement(null)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status & Timing Banner */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remittance Status</p>
                  <span
                    className={`inline-block mt-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                      selectedStatement.status,
                      selectedStatement.is_disputed
                    )}`}
                  >
                    {selectedStatement.is_disputed && selectedStatement.status !== "PAID"
                      ? "DISPUTED"
                      : selectedStatement.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Remittance</p>
                  <p className="text-lg font-black text-[#214ECF]">
                    ${Number(selectedStatement.net_amount ?? selectedStatement.approved_amount ?? 0).toFixed(2)}{" "}
                    {selectedStatement.currency || "USD"}
                  </p>
                </div>
              </div>

              {/* Project & Partner Info */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs">
                <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Briefcase size={14} className="text-[#214ECF]" />
                  Campaign & Scope Allocation
                </p>
                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Project Name</span>
                    <span className="font-semibold text-slate-800">
                      {selectedStatement.project_name || "Operational Delivery"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">BPO Partner</span>
                    <span className="font-semibold text-slate-800">
                      {selectedStatement.partner_name || earnings?.centre?.centreName || "Aura Global BPO Centre"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Period Start</span>
                    <span className="font-semibold text-slate-800">{selectedStatement.period_start}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Period End</span>
                    <span className="font-semibold text-slate-800">{selectedStatement.period_end}</span>
                  </div>
                </div>
              </div>

              {/* Work Summary (Units, Agents, Compliance) */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Clock size={14} className="text-[#214ECF]" />
                  Operational Telemetry & Work Summary
                </p>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Verified Billable Units</span>
                  <span className="font-semibold text-slate-800">
                    {Number(selectedStatement.billable_units ?? selectedStatement.logged_hours ?? 0).toFixed(2)}{" "}
                    {selectedStatement.unit_type || "hour"}s
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Contract Rate</span>
                  <span className="font-semibold text-slate-800">
                    ${Number(selectedStatement.unit_rate || 14.0).toFixed(2)} / {selectedStatement.unit_type || "hour"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Active Frontline Agents</span>
                  <span className="font-semibold text-slate-800">
                    {Number(selectedStatement.source_records_summary?.total_agents || 10)} Agents
                  </span>
                </div>
                {selectedStatement.source_records_summary?.attendance_compliance && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Attendance Compliance</span>
                    <span className="font-semibold text-emerald-600">
                      {selectedStatement.source_records_summary.attendance_compliance}
                    </span>
                  </div>
                )}
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <DollarSign size={14} className="text-[#214ECF]" />
                  Calculation Audit Breakdown
                </p>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Gross Calculated Earnings</span>
                  <span className="font-semibold text-slate-800">
                    ${Number(selectedStatement.gross_amount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700">
                  <span>Quality Bonus / Adjustments</span>
                  <span className="font-semibold">
                    +${Number(selectedStatement.adjustments_amount ?? selectedStatement.quality_bonus ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-rose-700">
                  <span>SLA Deductions / Penalties</span>
                  <span className="font-semibold">
                    -${Number(selectedStatement.deductions_amount ?? selectedStatement.sla_deductions ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 text-sm font-black text-slate-900">
                  <span>Total Net Payout Remittance</span>
                  <span className="text-[#214ECF]">
                    ${Number(selectedStatement.net_amount ?? selectedStatement.approved_amount ?? 0).toFixed(2)}{" "}
                    {selectedStatement.currency || "USD"}
                  </span>
                </div>
              </div>

              {/* Payment Settlement Details (If Paid) */}
              {selectedStatement.status === "PAID" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-1.5 text-xs text-emerald-950">
                  <p className="font-bold text-[11px] uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CreditCard size={14} className="text-emerald-600" />
                    Direct Bank Remittance Confirmation
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-emerald-700 block">Payment Date</span>
                      <span className="font-bold text-emerald-950">
                        {selectedStatement.payout_date || selectedStatement.payment_date || "Confirmed"}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-700 block">Disbursement Method</span>
                      <span className="font-bold text-emerald-950">
                        {selectedStatement.payment_method || "Direct Bank Wire"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-emerald-700 block">Bank Transaction Reference</span>
                      <span className="font-mono font-bold text-emerald-950">
                        {selectedStatement.payment_reference || "WIRE-REM-CONFIRMED"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Dispute Status if Disputed */}
              {selectedStatement.is_disputed && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-1 text-xs text-rose-950">
                  <p className="font-bold text-[11px] uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-rose-600" />
                    Formal Dispute Under Review
                  </p>
                  <p className="text-[11px] text-rose-800">
                    A formal dispute ({selectedStatement.active_dispute_code || "THK-DSP"}) is active for this statement. Thinkatic Finance operations is auditing telemetry records.
                  </p>
                </div>
              )}
            </div>

            {/* Drawer Actions */}
            <div className="border-t border-slate-100 pt-4 mt-6 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  <Download size={13} />
                  <span>CSV</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {selectedStatement.status !== "CANCELLED" && (
                  <button
                    type="button"
                    onClick={() => {
                      const st = selectedStatement;
                      setSelectedStatement(null);
                      handleOpenDispute(st);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-2xs"
                  >
                    <ShieldAlert size={13} />
                    <span>Raise Dispute</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedStatement(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 11. DISPUTE SUBMISSION MODAL ─────────────────────────────────── */}
      {disputeModalOpen && disputeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs transition-opacity animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-rose-600 uppercase tracking-wider">
                  Formal Audit Escalation
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  Dispute Statement {disputeTarget.statement_number || disputeTarget.payout_code}
                </h3>
              </div>
              <button
                onClick={() => setDisputeModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitDispute} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 text-[10px]">
                  Dispute Reason Category *
                </label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#214ECF]"
                >
                  <option value="HOURS_MISMATCH">Production Hours Mismatch (Telemetry Discrepancy)</option>
                  <option value="RATE_MISMATCH">Contract Commercial Rate Discrepancy</option>
                  <option value="UNAPPROVED_DEDUCTION">Unapproved Attendance or SLA Penalty</option>
                  <option value="MISSING_BONUS">Missing CSAT / QA Performance Bonus</option>
                  <option value="OTHER">Other Operational Discrepancy</option>
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 text-[10px]">
                  Disputed Amount (USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={disputedAmount}
                  onChange={(e) => setDisputedAmount(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 text-[10px]">
                  Detailed Operational Justification *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide shift dates, agent roster IDs, and specific discrepancies..."
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 text-[10px]">
                  Supporting Evidence / Incident Report Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Attendance sheet ref #ATT-2026-09-04 or ticket #TCK-981"
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#214ECF]"
                />
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <Info size={13} />
                  Authoritative Audit Trail Notice
                </p>
                <p className="mt-0.5">
                  Submitting this dispute registers an official ticket (THK-DSP-XXXXX). Thinkatic Finance Operations will review raw agent shift logs and communicate the resolution directly to this portal.
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setDisputeModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 font-bold text-white shadow-2xs hover:bg-rose-700 disabled:opacity-50 transition"
                >
                  <Send size={13} />
                  <span>{submittingDispute ? "Submitting..." : "Submit Formal Dispute"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
