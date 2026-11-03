import { useState, useEffect } from "react";
import {
  CircleDollarSign,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Plus,
  RefreshCw,
  X,
  Send,
  Eye,
  CreditCard,
  ShieldCheck,
  Check,
  Ban,
  Clock,
  ArrowUpRight,
  Receipt,
  FileText,
} from "lucide-react";

interface AdminFinancePanelProps {
  initialTab?: "invoices" | "payouts" | "disputes";
  apiCall: (path: string, options?: RequestInit) => Promise<Response>;
}

export default function AdminOperationsFinancePanel({
  initialTab = "invoices",
  apiCall,
}: AdminFinancePanelProps) {
  const [activeTab, setActiveTab] = useState<"invoices" | "payouts" | "disputes">(initialTab);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Selected Detail Drawers
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedPayout, setSelectedPayout] = useState<any>(null);

  // Modals
  const [generateInvoiceOpen, setGenerateInvoiceOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    bpo_client_id: "00000000-0000-0000-0000-000000000101",
    period_start: "2026-09-01",
    period_end: "2026-09-15",
    tax_rate: 0,
    discount_amount: 0,
    currency: "USD",
  });

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_method: "BANK_TRANSFER",
    payment_reference: "",
    notes: "",
  });

  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    type: "CREDIT",
    amount: 0,
    reason: "BILLING_CORRECTION",
    description: "",
  });

  const [generatePayoutOpen, setGeneratePayoutOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    bpo_partner_id: "00000000-0000-0000-0000-000000000001",
    period_start: "2026-09-01",
    period_end: "2026-09-15",
  });

  const [payPayoutModalOpen, setPayPayoutModalOpen] = useState(false);
  const [payPayoutForm, setPayPayoutForm] = useState({
    payment_method: "WIRE_TRANSFER",
    payment_reference: "",
    notes: "",
  });

  const [disputeModalTarget, setDisputeModalTarget] = useState<any>(null);
  const [disputeAction, setDisputeAction] = useState<"RESOLVE" | "REJECT">("RESOLVE");
  const [disputeResolutionNotes, setDisputeResolutionNotes] = useState("");
  const [disputeAdjustmentAmount, setDisputeAdjustmentAmount] = useState<number>(0);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, invRes, payRes, dspRes] = await Promise.all([
        apiCall("/admin/billing/summary"),
        apiCall("/admin/billing/invoices"),
        apiCall("/admin/billing/payouts"),
        apiCall("/admin/billing/disputes"),
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (invRes.ok) {
        const d = await invRes.json();
        setInvoices(d.invoices || []);
      }
      if (payRes.ok) {
        const d = await payRes.json();
        setPayouts(d.payouts || []);
      }
      if (dspRes.ok) {
        const d = await dspRes.json();
        setDisputes(d.disputes || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load financial operations data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleExport = (type: string) => {
    const token = localStorage.getItem("admin_token");
    window.open(`/api/admin/billing/reports/export?type=${type}&format=csv&token=${encodeURIComponent(token || "")}`, "_blank");
  };

  // ── INVOICE ACTIONS ──
  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      const res = await apiCall("/admin/billing/invoices/generate", {
        method: "POST",
        body: JSON.stringify(invoiceForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to generate invoice");
      }
      const data = await res.json();
      setSuccessMsg(`Invoice ${data.invoice?.invoice_number} generated successfully as DRAFT.`);
      setGenerateInvoiceOpen(false);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssueInvoice = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/billing/invoices/${id}/issue`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to issue invoice");
      }
      setSuccessMsg("Invoice successfully issued and made immutable.");
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidInvoice = async (id: string) => {
    if (!confirm("Are you sure you want to void this invoice? This action is irrevocable.")) return;
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/billing/invoices/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: "Admin voided invoice" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to void invoice");
      }
      setSuccessMsg("Invoice successfully voided.");
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/billing/invoices/${selectedInvoice.id}/payments`, {
        method: "POST",
        body: JSON.stringify(paymentForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to record payment");
      }
      setSuccessMsg("Payment recorded successfully.");
      setPaymentModalOpen(false);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/billing/invoices/${selectedInvoice.id}/adjustments`, {
        method: "POST",
        body: JSON.stringify(adjustmentForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to add adjustment");
      }
      setSuccessMsg("Financial adjustment applied successfully.");
      setAdjustmentModalOpen(false);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── PAYOUT ACTIONS ──
  const handleGeneratePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      const res = await apiCall("/admin/billing/payouts/generate", {
        method: "POST",
        body: JSON.stringify(payoutForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to generate payout");
      }
      const data = await res.json();
      setSuccessMsg(`Payout ${data.payout?.statement_number} generated successfully as PENDING.`);
      setGeneratePayoutOpen(false);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovePayout = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/billing/payouts/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to approve payout");
      }
      setSuccessMsg("Payout successfully approved.");
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessPayout = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/billing/payouts/${id}/process`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to process payout");
      }
      setSuccessMsg("Payout sent to payment processor.");
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayout) return;
    setActionLoading(true);
    try {
      const res = await apiCall(`/admin/billing/payouts/${selectedPayout.id}/pay`, {
        method: "POST",
        body: JSON.stringify(payPayoutForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to confirm payout release");
      }
      setSuccessMsg("Payout remittance confirmed as PAID.");
      setPayPayoutModalOpen(false);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── DISPUTE ACTIONS ──
  const handleResolveOrRejectDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModalTarget) return;
    setActionLoading(true);
    try {
      const endpoint =
        disputeAction === "RESOLVE"
          ? `/admin/billing/disputes/${disputeModalTarget.id}/resolve`
          : `/admin/billing/disputes/${disputeModalTarget.id}/reject`;

      const body =
        disputeAction === "RESOLVE"
          ? { resolution_notes: disputeResolutionNotes, adjustment_amount: Number(disputeAdjustmentAmount || 0) }
          : { resolution_notes: disputeResolutionNotes };

      const res = await apiCall(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to update dispute status");
      }

      setSuccessMsg(`Dispute ${disputeModalTarget.dispute_number} marked as ${disputeAction === "RESOLVE" ? "RESOLVED" : "REJECTED"}.`);
      setDisputeModalTarget(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <CircleDollarSign size={24} />
            </span>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Finance & Billing Operations</h2>
              <p className="text-xs text-slate-500">
                Authoritative Client Invoices, Centre Payout Reconciliation, and Dispute Resolution (Zero AI Financial Authority).
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExport("invoices")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <Download size={13} /> Export Invoices CSV
          </button>
          <button
            onClick={() => handleExport("payouts")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <Download size={13} /> Export Payouts CSV
          </button>
          <button
            onClick={() => void loadAll()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-primary" : ""} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-600" size={18} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-950">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-rose-600" size={18} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-950">
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Billed</p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            ${Number(summary?.invoices?.totalBilled || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">All issued enterprise invoices</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Collected</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">
            ${Number(summary?.invoices?.totalPaid || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">Verified cash in bank</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Outstanding AR</p>
          <p className="mt-2 text-2xl font-black text-amber-600">
            ${Number(summary?.invoices?.totalOutstanding || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">Client balance pending</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending Payouts AP</p>
          <p className="mt-2 text-2xl font-black text-purple-600">
            ${Number(summary?.payouts?.totalPending || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">Centre remittances due</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Open Disputes</p>
          <p className="mt-2 text-2xl font-black text-rose-600">
            {Number(summary?.disputes?.openCount || 0)}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">Require audit determination</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === "invoices"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Receipt size={14} /> Client Invoices ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab("payouts")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === "payouts"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Wallet size={14} /> Centre Payout Runs ({payouts.length})
        </button>

        <button
          onClick={() => setActiveTab("disputes")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === "disputes"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <AlertTriangle size={14} /> Financial Disputes ({disputes.length})
        </button>
      </div>

      {/* ── INVOICES TAB ────────────────────────────────────────── */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500 font-medium">
              Client invoices with exact-precision rate calculation, line items, and audit trails.
            </p>
            <button
              onClick={() => setGenerateInvoiceOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition"
            >
              <Plus size={14} /> Generate Client Invoice
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Period</th>
                  <th className="p-4">Total Amount</th>
                  <th className="p-4">Balance Due</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                    <td className="p-4 font-semibold text-slate-800">
                      {inv.bpo_clients?.company_name || inv.bpo_client_id.slice(0, 8)}
                    </td>
                    <td className="p-4 text-slate-600">
                      {inv.period_start} → {inv.period_end}
                    </td>
                    <td className="p-4 font-bold text-slate-900">${Number(inv.total_amount).toFixed(2)}</td>
                    <td className="p-4 font-bold text-rose-600">
                      ${Number(inv.balance_due ?? inv.total_amount).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          inv.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : inv.status === "ISSUED"
                            ? "bg-blue-100 text-blue-800 border-blue-300"
                            : inv.status === "DRAFT"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : inv.status === "VOID"
                            ? "bg-slate-100 text-slate-600 border-slate-300"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          View
                        </button>
                        {inv.status === "DRAFT" && (
                          <button
                            onClick={() => handleIssueInvoice(inv.id)}
                            disabled={actionLoading}
                            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700"
                          >
                            Issue
                          </button>
                        )}
                        {(inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID") && (
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setPaymentForm({
                                amount: Number(inv.balance_due || inv.total_amount),
                                payment_method: "BANK_TRANSFER",
                                payment_reference: "",
                                notes: "",
                              });
                              setPaymentModalOpen(true);
                            }}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Pay
                          </button>
                        )}
                        {inv.status === "DRAFT" && (
                          <button
                            onClick={() => handleVoidInvoice(inv.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PAYOUTS TAB ─────────────────────────────────────────── */}
      {activeTab === "payouts" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500 font-medium">
              BPO Centre remittance runs, approval pipeline, and wire settlement records.
            </p>
            <button
              onClick={() => setGeneratePayoutOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition"
            >
              <Plus size={14} /> Generate Centre Payout Run
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-4">Statement #</th>
                  <th className="p-4">Centre Partner</th>
                  <th className="p-4">Period</th>
                  <th className="p-4">Logged Hours</th>
                  <th className="p-4">Net Remittance</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((py) => (
                  <tr key={py.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-mono font-bold text-slate-900">{py.statement_number}</td>
                    <td className="p-4 font-semibold text-slate-800">
                      {py.partner_name || py.bpo_partners?.name || py.bpo_partner_id?.slice(0, 8)}
                    </td>
                    <td className="p-4 text-slate-600">
                      {py.period_start} → {py.period_end}
                    </td>
                    <td className="p-4 font-medium text-slate-700">{Number(py.logged_hours || 0).toFixed(1)} hrs</td>
                    <td className="p-4 font-black text-slate-900 text-sm">
                      ${Number(py.approved_amount || 0).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          py.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : py.status === "PROCESSING"
                            ? "bg-purple-100 text-purple-800 border-purple-300 animate-pulse"
                            : py.status === "APPROVED"
                            ? "bg-blue-100 text-blue-800 border-blue-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}
                      >
                        {py.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedPayout(py)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          Audit
                        </button>
                        {py.status === "PENDING" && (
                          <button
                            onClick={() => handleApprovePayout(py.id)}
                            disabled={actionLoading}
                            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700"
                          >
                            Approve
                          </button>
                        )}
                        {py.status === "APPROVED" && (
                          <button
                            onClick={() => handleProcessPayout(py.id)}
                            disabled={actionLoading}
                            className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-700"
                          >
                            Process
                          </button>
                        )}
                        {py.status === "PROCESSING" && (
                          <button
                            onClick={() => {
                              setSelectedPayout(py);
                              setPayPayoutForm({
                                payment_method: "WIRE_TRANSFER",
                                payment_reference: "",
                                notes: "",
                              });
                              setPayPayoutModalOpen(true);
                            }}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DISPUTES TAB ────────────────────────────────────────── */}
      {activeTab === "disputes" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 font-medium">
            Client billing discrepancies & centre payout adjustments requiring administrative determination.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-4">Dispute #</th>
                  <th className="p-4">Target Type & Ref</th>
                  <th className="p-4">Disputed Amount</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {disputes.map((dsp) => (
                  <tr key={dsp.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-mono font-bold text-slate-900">{dsp.dispute_number}</td>
                    <td className="p-4">
                      <span className="font-semibold text-slate-800">{dsp.reference_type}</span>
                      <span className="block font-mono text-[11px] text-slate-500">{dsp.reference_id}</span>
                    </td>
                    <td className="p-4 font-bold text-rose-600">${Number(dsp.disputed_amount).toFixed(2)}</td>
                    <td className="p-4 font-semibold text-slate-800">{dsp.reason.replaceAll("_", " ")}</td>
                    <td className="p-4 max-w-xs truncate text-slate-600">{dsp.description}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          dsp.status === "RESOLVED"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : dsp.status === "REJECTED"
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}
                      >
                        {dsp.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {(dsp.status === "OPEN" || dsp.status === "UNDER_REVIEW") && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setDisputeModalTarget(dsp);
                              setDisputeAction("RESOLVE");
                              setDisputeAdjustmentAmount(dsp.disputed_amount);
                              setDisputeResolutionNotes("");
                            }}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => {
                              setDisputeModalTarget(dsp);
                              setDisputeAction("REJECT");
                              setDisputeResolutionNotes("");
                            }}
                            className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-700"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {dsp.status !== "OPEN" && dsp.status !== "UNDER_REVIEW" && (
                        <span className="text-[11px] text-slate-400 italic">Determined</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GENERATE INVOICE MODAL ── */}
      {generateInvoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Generate Client Invoice</h3>
              <button onClick={() => setGenerateInvoiceOpen(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleGenerateInvoice} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-500">Target Client Account *</label>
                <select
                  value={invoiceForm.bpo_client_id}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, bpo_client_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none font-semibold"
                >
                  <option value="00000000-0000-0000-0000-000000000101">Aura Health (THK-CLI-00001)</option>
                  <option value="00000000-0000-0000-0000-000000000102">Helios Energy (THK-CLI-00002)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold uppercase text-slate-500">Period Start *</label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.period_start}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, period_start: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-500">Period End *</label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.period_end}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, period_end: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold uppercase text-slate-500">Tax Rate %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={invoiceForm.tax_rate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, tax_rate: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-500">Discount USD</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={invoiceForm.discount_amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, discount_amount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setGenerateInvoiceOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-primary px-5 py-2 font-bold text-white shadow-xs hover:bg-primary/90"
                >
                  {actionLoading ? "Generating..." : "Generate Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── GENERATE PAYOUT MODAL ── */}
      {generatePayoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Generate Centre Payout Run</h3>
              <button onClick={() => setGeneratePayoutOpen(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleGeneratePayout} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-500">BPO Partner Centre *</label>
                <select
                  value={payoutForm.bpo_partner_id}
                  onChange={(e) => setPayoutForm({ ...payoutForm, bpo_partner_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none font-semibold"
                >
                  <option value="00000000-0000-0000-0000-000000000001">Aura Global BPO Centre (Centre 1)</option>
                  <option value="00000000-0000-0000-0000-000000000002">Apex BPO Solutions (Centre 99)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold uppercase text-slate-500">Period Start *</label>
                  <input
                    type="date"
                    required
                    value={payoutForm.period_start}
                    onChange={(e) => setPayoutForm({ ...payoutForm, period_start: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-500">Period End *</label>
                  <input
                    type="date"
                    required
                    value={payoutForm.period_end}
                    onChange={(e) => setPayoutForm({ ...payoutForm, period_end: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setGeneratePayoutOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-purple-600 px-5 py-2 font-bold text-white shadow-xs hover:bg-purple-700"
                >
                  {actionLoading ? "Generating..." : "Generate Payout Run"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RECORD PAYMENT MODAL ── */}
      {paymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">
                Record Payment for {selectedInvoice.invoice_number}
              </h3>
              <button onClick={() => setPaymentModalOpen(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-500">Payment Amount (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none font-bold"
                />
              </div>
              <div>
                <label className="block font-bold uppercase text-slate-500">Payment Method *</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none font-semibold"
                >
                  <option value="BANK_TRANSFER">Bank Wire / Electronic Transfer</option>
                  <option value="ACH">ACH Direct Debit</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="CHECK">Corporate Check</option>
                </select>
              </div>
              <div>
                <label className="block font-bold uppercase text-slate-500">Payment Reference *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WIRE-8849202"
                  value={paymentForm.payment_reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_reference: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white shadow-xs hover:bg-emerald-700"
                >
                  {actionLoading ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DISPUTE RESOLVE/REJECT MODAL ── */}
      {disputeModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">
                {disputeAction === "RESOLVE" ? "Resolve Dispute" : "Reject Dispute"}
              </h3>
              <button onClick={() => setDisputeModalTarget(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleResolveOrRejectDispute} className="mt-4 space-y-3.5 text-xs">
              <p className="text-slate-600">
                Dispute: <span className="font-mono font-bold text-slate-900">{disputeModalTarget.dispute_number}</span>
                <br />
                Claimed: <span className="font-bold text-rose-600">${Number(disputeModalTarget.disputed_amount).toFixed(2)}</span>
              </p>
              {disputeAction === "RESOLVE" && (
                <div>
                  <label className="block font-bold uppercase text-slate-500">Approved Credit Adjustment USD</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={disputeAdjustmentAmount}
                    onChange={(e) => setDisputeAdjustmentAmount(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none font-bold"
                  />
                </div>
              )}
              <div>
                <label className="block font-bold uppercase text-slate-500">Formal Resolution Notes *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Operational determination justification..."
                  value={disputeResolutionNotes}
                  onChange={(e) => setDisputeResolutionNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setDisputeModalTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`rounded-xl px-5 py-2 font-bold text-white shadow-xs ${
                    disputeAction === "RESOLVE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {actionLoading ? "Processing..." : disputeAction === "RESOLVE" ? "Confirm Resolution" : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PAY PAYOUT MODAL ── */}
      {payPayoutModalOpen && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Confirm Payout Remittance</h3>
              <button onClick={() => setPayPayoutModalOpen(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePayPayout} className="mt-4 space-y-3.5 text-xs">
              <p className="text-slate-600">
                Statement: <span className="font-mono font-bold text-slate-900">{selectedPayout.statement_number}</span>
                <br />
                Net Remittance: <span className="font-bold text-emerald-600">${Number(selectedPayout.approved_amount).toFixed(2)}</span>
              </p>
              <div>
                <label className="block font-bold uppercase text-slate-500">Remittance Method *</label>
                <select
                  value={payPayoutForm.payment_method}
                  onChange={(e) => setPayPayoutForm({ ...payPayoutForm, payment_method: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none font-semibold"
                >
                  <option value="WIRE_TRANSFER">Direct Wire Transfer</option>
                  <option value="ACH">ACH Direct Remittance</option>
                  <option value="LOCAL_SETTLEMENT">Local Clearing House</option>
                </select>
              </div>
              <div>
                <label className="block font-bold uppercase text-slate-500">Transaction Reference ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TX-WIRE-992019"
                  value={payPayoutForm.payment_reference}
                  onChange={(e) => setPayPayoutForm({ ...payPayoutForm, payment_reference: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 outline-none font-mono font-bold"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setPayPayoutModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white shadow-xs hover:bg-emerald-700"
                >
                  {actionLoading ? "Confirming..." : "Confirm & Mark Paid"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── INVOICE DETAILS DRAWER ── */}
      {selectedInvoice && !paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Client Invoice</span>
                <h3 className="text-xl font-black text-slate-900">{selectedInvoice.invoice_number}</h3>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Issue Date</p>
                  <p className="font-bold text-slate-800">{selectedInvoice.issue_date || "DRAFT"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Due Date</p>
                  <p className="font-bold text-slate-800">{selectedInvoice.due_date || "Upon Issuance"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                  <p className="font-bold text-slate-800 uppercase">{selectedInvoice.status}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Grand Total</p>
                  <p className="font-black text-slate-900 text-sm">${Number(selectedInvoice.total_amount).toFixed(2)}</p>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <p className="font-bold text-slate-900 uppercase text-[11px] mb-2">Audited Line Items</p>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Hours</th>
                        <th className="p-2.5">Rate</th>
                        <th className="p-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedInvoice.items || []).map((it: any) => (
                        <tr key={it.id}>
                          <td className="p-2.5 font-semibold text-slate-800">{it.description}</td>
                          <td className="p-2.5">{Number(it.quantity).toFixed(1)}</td>
                          <td className="p-2.5">${Number(it.unit_price).toFixed(2)}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">
                            ${Number(it.total_amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-1 bg-slate-50">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">${Number(selectedInvoice.subtotal_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax ({Number(selectedInvoice.tax_rate || 0)}%):</span>
                  <span className="font-semibold">${Number(selectedInvoice.tax_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discounts / Adjustments:</span>
                  <span className="font-semibold">-${Number(selectedInvoice.discount_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-black text-slate-900">
                  <span>Balance Due:</span>
                  <span className="text-rose-600">
                    ${Number(selectedInvoice.balance_due ?? selectedInvoice.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
