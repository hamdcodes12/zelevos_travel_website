import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Receipt,
  CreditCard,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Landmark,
  Wallet,
  ShieldAlert,
  Download,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Plus,
  Eye,
  EyeOff,
  X,
  Send,
  Ban,
  Check,
  ShieldCheck,
  ArrowUpRight,
  Filter,
  DollarSign,
  ChevronDown,
  Building,
  Info,
} from "lucide-react";

interface AdminBillingInvoicesPanelProps {
  apiCall: (path: string, options?: RequestInit) => Promise<Response>;
}

export default function AdminBillingInvoicesPanel({ apiCall }: AdminBillingInvoicesPanelProps) {
  // Navigation sub-tab
  const [activeSubTab, setActiveSubTab] = useState<"invoices" | "bank_accounts" | "payouts" | "disputes" | "payments">("invoices");

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data States
  const [metrics, setMetrics] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");

  // Modals & Drawers
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedInvoiceLoading, setSelectedInvoiceLoading] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState<any>(null);
  const [showCancelInvoice, setShowCancelInvoice] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [revealedBankId, setRevealedBankId] = useState<string | null>(null);
  const [revealedBankData, setRevealedBankData] = useState<any>(null);
  const [bankRevealModal, setBankRevealModal] = useState<any>(null);
  const [disputeModalTarget, setDisputeModalTarget] = useState<any>(null);
  const [disputeAction, setDisputeAction] = useState<"RESOLVE" | "REJECT">("RESOLVE");
  const [disputeResolutionNotes, setDisputeResolutionNotes] = useState("");
  const [disputeAdjustmentAmount, setDisputeAdjustmentAmount] = useState<number>(0);

  const getTodayIso = () => new Date().toISOString().split("T")[0];
  const getDefaultDueIso = () => new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

  // Create Invoice Form State
  const [newInvoice, setNewInvoice] = useState({
    clientId: "",
    projectId: "",
    currency: "USD",
    invoiceDate: getTodayIso(),
    dueDate: getDefaultDueIso(),
    taxRate: 0,
    discountAmount: 0,
    notes: "Payment due within 14 days of invoice date.",
    terms: "Wire / Bank Transfer to HEALWEAL LLC as specified on invoice.",
    items: [
      { description: "Dedicated BPO Operations Services", quantity: 1, unitPrice: 2500 },
    ],
  });

  const [dateError, setDateError] = useState<string | null>(null);

  // Record Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    paymentMethod: "wire",
    reference: "",
    notes: "",
  });

  // Action Loading
  const [submittingAction, setSubmittingAction] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. DATA LOADERS
  // ─────────────────────────────────────────────────────────────────────────────

  const loadBillingData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const [metRes, invRes, bankRes, payoutRes, dispRes] = await Promise.all([
        apiCall("/admin/invoices/metrics"),
        apiCall(`/admin/invoices?${params.toString()}`),
        apiCall("/admin/bank-accounts"),
        apiCall("/admin/billing/payouts").catch(() => null),
        apiCall("/admin/billing/disputes").catch(() => null),
      ]);

      if (metRes.ok) {
        const metData = await metRes.json();
        setMetrics(metData);
        if (metData.recentPayments) setRecentPayments(metData.recentPayments);
      }

      if (invRes.ok) {
        const invData = await invRes.json();
        const normInvoices = Array.isArray(invData)
          ? invData
          : Array.isArray(invData?.invoices)
          ? invData.invoices
          : Array.isArray(invData?.data)
          ? invData.data
          : [];
        setInvoices(normInvoices);
      }

      if (bankRes.ok) {
        const bankData = await bankRes.json();
        const normBanks = Array.isArray(bankData)
          ? bankData
          : Array.isArray(bankData?.bank_accounts)
          ? bankData.bank_accounts
          : Array.isArray(bankData?.data)
          ? bankData.data
          : [];
        setBankAccounts(normBanks);
      }

      if (payoutRes && payoutRes.ok) {
        const payData = await payoutRes.json();
        const normPayouts = Array.isArray(payData)
          ? payData
          : Array.isArray(payData?.payouts)
          ? payData.payouts
          : Array.isArray(payData?.data)
          ? payData.data
          : [];
        setPayouts(normPayouts);
      }

      if (dispRes && dispRes.ok) {
        const dspData = await dispRes.json();
        const normDisputes = Array.isArray(dspData)
          ? dspData
          : Array.isArray(dspData?.disputes)
          ? dspData.disputes
          : Array.isArray(dspData?.data)
          ? dspData.data
          : [];
        setDisputes(normDisputes);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load billing records.");
    } finally {
      setLoading(false);
    }
  }, [apiCall, statusFilter, searchQuery]);

  // Load clients and projects for invoice creation
  const loadRecipientOptions = useCallback(async () => {
    try {
      const res = await apiCall("/admin/meetings/recipients-data");
      if (res.ok) {
        const data = await res.json();
        if (data.clients) setAvailableClients(data.clients);
        if (data.projects) setAvailableProjects(data.projects);
      }
    } catch {
      // Non-critical background load
    }
  }, [apiCall]);

  useEffect(() => {
    void loadBillingData();
    void loadRecipientOptions();
  }, [loadBillingData, loadRecipientOptions]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. BANK ACCOUNT ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  const toggleBankAccount = async (acc: any) => {
    const currentActive = acc.isActive ?? acc.is_active;
    try {
      const res = await apiCall(`/admin/bank-accounts/${acc.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: !currentActive,
          is_active: !currentActive,
        }),
      });
      if (res.ok) {
        setSuccessMsg(`Bank account ${acc.currency} status updated to ${!currentActive ? "Active" : "Inactive"}.`);
        setTimeout(() => setSuccessMsg(null), 3500);
        await loadBillingData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to toggle bank account status.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to update bank account.");
    }
  };

  const handleRevealBankDetails = async (acc: any) => {
    try {
      setSubmittingAction(true);
      const fullAcc = bankAccounts.find((b) => b.id === acc.id);
      if (fullAcc) {
        setRevealedBankId(acc.id);
        setRevealedBankData(fullAcc);
        setBankRevealModal(null);
        setSuccessMsg(`Sensitive credentials for ${acc.currency} unmasked. Action logged to audit trail.`);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to reveal bank account details.");
    } finally {
      setSubmittingAction(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. INVOICE ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  const openInvoiceDetails = async (inv: any) => {
    setSelectedInvoice(inv);
    setSelectedInvoiceLoading(true);
    try {
      const res = await apiCall(`/admin/invoices/${inv.id}`);
      if (res.ok) {
        const fullData = await res.json();
        setSelectedInvoice(fullData);
      }
    } catch {
      // Keep basic info if detail call fails
    } finally {
      setSelectedInvoiceLoading(false);
    }
  };

  const handleSendInvoice = async (inv: any) => {
    try {
      setSubmittingAction(true);
      const res = await apiCall(`/admin/invoices/${inv.id}/send`, { method: "POST" });
      if (res.ok) {
        setSuccessMsg(`Invoice ${inv.invoice_number || inv.invoice_code} sent to client successfully.`);
        setTimeout(() => setSuccessMsg(null), 3500);
        await loadBillingData();
        if (selectedInvoice?.id === inv.id) {
          openInvoiceDetails(inv);
        }
      } else {
        const err = await res.json();
        setError(err.error || "Failed to send invoice.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to send invoice.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!showCancelInvoice) return;
    try {
      setSubmittingAction(true);
      const res = await apiCall(`/admin/invoices/${showCancelInvoice.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason || "Cancelled by Finance Admin" }),
      });
      if (res.ok) {
        setSuccessMsg(`Invoice ${showCancelInvoice.invoice_number} cancelled.`);
        setTimeout(() => setSuccessMsg(null), 3500);
        setShowCancelInvoice(null);
        setCancelReason("");
        await loadBillingData();
        if (selectedInvoice?.id === showCancelInvoice.id) {
          setSelectedInvoice(null);
        }
      } else {
        const err = await res.json();
        setError(err.error || "Failed to cancel invoice.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to cancel invoice.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRecordPayment) return;
    if (paymentForm.amount <= 0) {
      setError("Please enter a valid payment amount greater than 0.");
      return;
    }
    try {
      setSubmittingAction(true);
      const res = await apiCall(`/admin/invoices/${showRecordPayment.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: paymentForm.amount,
          paymentMethod: paymentForm.paymentMethod,
          reference: paymentForm.reference,
          notes: paymentForm.notes,
        }),
      });
      if (res.ok) {
        setSuccessMsg(`Payment of $${paymentForm.amount.toFixed(2)} recorded for ${showRecordPayment.invoice_number || showRecordPayment.invoice_code}.`);
        setTimeout(() => setSuccessMsg(null), 3500);
        setShowRecordPayment(null);
        setPaymentForm({ amount: 0, paymentMethod: "wire", reference: "", notes: "" });
        await loadBillingData();
        if (selectedInvoice?.id === showRecordPayment.id) {
          openInvoiceDetails(showRecordPayment);
        }
      } else {
        const err = await res.json();
        setError(err.error || "Failed to record payment.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to record payment.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingAction) return;
    if (!newInvoice.clientId) {
      setError("Please select a target client profile.");
      return;
    }
    if (!newInvoice.invoiceDate) {
      setError("Please specify an invoice date.");
      return;
    }
    if (!newInvoice.dueDate) {
      setError("Please specify a payment due date.");
      return;
    }
    if (newInvoice.dueDate < newInvoice.invoiceDate) {
      setError("Payment due date must be on or after the invoice date.");
      return;
    }
    if (newInvoice.items.length === 0 || !newInvoice.items[0].description) {
      setError("Please enter at least one line item with description.");
      return;
    }
    try {
      setSubmittingAction(true);
      setError(null);
      const taxRatePercent = Number(newInvoice.taxRate) || 0;
      const taxRateFraction = taxRatePercent > 1 ? taxRatePercent / 100 : taxRatePercent;

      const payload = {
        clientId: newInvoice.clientId,
        client_id: newInvoice.clientId,
        projectId: newInvoice.projectId ? Number(newInvoice.projectId) || newInvoice.projectId : undefined,
        project_id: newInvoice.projectId ? Number(newInvoice.projectId) || newInvoice.projectId : undefined,
        invoiceDate: newInvoice.invoiceDate,
        invoice_date: newInvoice.invoiceDate,
        dueDate: newInvoice.dueDate,
        due_date: newInvoice.dueDate,
        currency: newInvoice.currency,
        taxRate: taxRateFraction,
        tax_rate: taxRateFraction,
        discountAmount: Number(newInvoice.discountAmount) || 0,
        discount: Number(newInvoice.discountAmount) || 0,
        notes: newInvoice.notes,
        terms: newInvoice.terms,
        items: newInvoice.items.map((item, idx) => ({
          sortOrder: idx + 1,
          sort_order: idx + 1,
          description: item.description,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          unit_price: Number(item.unitPrice) || 0,
        })),
        lineItems: newInvoice.items.map((item, idx) => ({
          sortOrder: idx + 1,
          description: item.description,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
        })),
      };

      const res = await apiCall("/admin/invoices", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = await res.json();
        const invNum = created.invoice_number || created.invoice_code || (created.id ? `INV-${created.id}` : "");
        setSuccessMsg(`Invoice ${invNum} created successfully.`);
        setTimeout(() => setSuccessMsg(null), 4000);
        setShowCreateInvoice(false);
        // Reset form for next creation
        setNewInvoice({
          clientId: "",
          projectId: "",
          currency: "USD",
          invoiceDate: getTodayIso(),
          dueDate: getDefaultDueIso(),
          taxRate: 0,
          discountAmount: 0,
          notes: "Payment due within 14 days of invoice date.",
          terms: "Wire / Bank Transfer to HEALWEAL LLC as specified on invoice.",
          items: [
            { description: "Dedicated BPO Operations Services", quantity: 1, unitPrice: 2500 },
          ],
        });
        setDateError(null);
        await loadBillingData();
      } else {
        const err = await res.json();
        setError(err.error || err.message || "Failed to create invoice.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to create invoice.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const addLineItem = () => {
    setNewInvoice((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: 1, unitPrice: 0 }],
    }));
  };

  const removeLineItem = (index: number) => {
    if (newInvoice.items.length <= 1) return;
    setNewInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    setNewInvoice((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const calculatedCreateSubtotal = useMemo(() => {
    return newInvoice.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  }, [newInvoice.items]);

  const calculatedCreateTax = useMemo(() => {
    return calculatedCreateSubtotal * ((Number(newInvoice.taxRate) || 0) / 100);
  }, [calculatedCreateSubtotal, newInvoice.taxRate]);

  const calculatedCreateTotal = useMemo(() => {
    return Math.max(0, calculatedCreateSubtotal + calculatedCreateTax - (Number(newInvoice.discountAmount) || 0));
  }, [calculatedCreateSubtotal, calculatedCreateTax, newInvoice.discountAmount]);

  const handleResolveDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModalTarget) return;
    try {
      setSubmittingAction(true);
      const isReject = disputeAction === "REJECT";
      const path = isReject
        ? `/admin/billing/disputes/${disputeModalTarget.id}/reject`
        : `/admin/billing/disputes/${disputeModalTarget.id}/resolve`;

      const payload = isReject
        ? { rejection_reason: disputeResolutionNotes }
        : {
            resolution_notes: disputeResolutionNotes,
            adjustment_amount: disputeAdjustmentAmount,
            adjustment_type: "CREDIT",
          };

      const res = await apiCall(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMsg(`Dispute ${disputeModalTarget.dispute_code || disputeModalTarget.dispute_number} ${isReject ? "rejected" : "resolved"}.`);
        setTimeout(() => setSuccessMsg(null), 3500);
        setDisputeModalTarget(null);
        setDisputeResolutionNotes("");
        setDisputeAdjustmentAmount(0);
        await loadBillingData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to process dispute resolution.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to resolve dispute.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleExport = (type: string) => {
    const token = localStorage.getItem("admin_token");
    window.open(`/api/admin/billing/reports/export?type=${type}&format=csv&token=${encodeURIComponent(token || "")}`, "_blank");
  };

  const displayInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b.created_at || b.invoice_date).getTime() - new Date(a.created_at || a.invoice_date).getTime();
      if (sortBy === "date_asc") return new Date(a.created_at || a.invoice_date).getTime() - new Date(b.created_at || b.invoice_date).getTime();
      if (sortBy === "amount_desc") return Number(b.total || 0) - Number(a.total || 0);
      if (sortBy === "amount_asc") return Number(a.total || 0) - Number(b.total || 0);
      return 0;
    });
  }, [invoices, sortBy]);

  const getClientDisplayName = (clientId: string) => {
    const c = availableClients.find((cl) => cl.id === clientId);
    if (c) return c.name || c.email || c.company_name;
    return clientId ? `${clientId.slice(0, 10)}...` : "—";
  };

  return (
    <div className="space-y-6">
      {/* Toast Messages */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold shadow-xs animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#214ECF]/10 text-[#214ECF] flex items-center justify-center font-bold">
              <Receipt size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Billing & Invoices Control Centre</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Corporate wire receiving accounts (HEALWEAL LLC), client invoicing, payments ledger & BPO partner payouts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExport("invoices")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Export Invoices CSV"
          >
            <FileSpreadsheet size={13} className="text-slate-500" />
            Export CSV
          </button>

          <button
            onClick={loadBillingData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#214ECF] bg-[#214ECF]/5 border border-[#214ECF]/20 hover:bg-[#214ECF]/10 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={() => {
              setNewInvoice((prev) => ({
                ...prev,
                invoiceDate: getTodayIso(),
                dueDate: prev.dueDate || getDefaultDueIso(),
              }));
              setDateError(null);
              setShowCreateInvoice(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#214ECF] hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            Create Invoice
          </button>
        </div>
      </div>

      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Total Invoiced */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-[#214ECF]/30 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Invoiced</span>
            <FileText size={14} className="text-[#214ECF]" />
          </div>
          <div className="text-lg font-black text-slate-900">
            ${Number(metrics?.totalInvoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{metrics?.totalCount || invoices.length} invoices</div>
        </div>

        {/* Paid / Collected */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Collected</span>
            <CheckCircle2 size={14} className="text-emerald-600" />
          </div>
          <div className="text-lg font-black text-emerald-700">
            ${Number(metrics?.totalPaid ?? metrics?.totalCollected ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">{metrics?.paidCount || 0} fully paid</div>
        </div>

        {/* Pending / Awaiting */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3.5 shadow-xs hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending</span>
            <Clock size={14} className="text-amber-600" />
          </div>
          <div className="text-lg font-black text-amber-700">
            ${Number(metrics?.pendingAmount ?? metrics?.totalOutstanding ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-amber-600 mt-0.5">{metrics?.pendingCount || 0} awaiting</div>
        </div>

        {/* Overdue */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-3.5 shadow-xs hover:border-rose-300 transition-colors">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Overdue</span>
            <AlertTriangle size={14} className="text-rose-600" />
          </div>
          <div className="text-lg font-black text-rose-700">
            ${Number(metrics?.totalOverdue ?? metrics?.overdueAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-rose-600 mt-0.5">{metrics?.overdueCount || 0} past due</div>
        </div>

        {/* Outstanding Net */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Outstanding</span>
            <CreditCard size={14} className="text-slate-600" />
          </div>
          <div className="text-lg font-black text-slate-800">
            ${Number(metrics?.totalOutstanding ?? metrics?.pendingAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Net receivables</div>
        </div>

        {/* Payments Logged */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Payments</span>
            <Receipt size={14} className="text-emerald-600" />
          </div>
          <div className="text-lg font-black text-slate-900">
            {metrics?.recentPayments?.length || recentPayments.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Recorded logs</div>
        </div>

        {/* Partner Payouts */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Payouts</span>
            <Wallet size={14} className="text-[#214ECF]" />
          </div>
          <div className="text-lg font-black text-slate-900">
            ${Number(metrics?.totalPayouts || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{metrics?.payoutCount || payouts.length} statements</div>
        </div>

        {/* Disputes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Disputes</span>
            <ShieldAlert size={14} className="text-amber-600" />
          </div>
          <div className="text-lg font-black text-amber-700">
            {metrics?.disputeCount || disputes.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Under review</div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-1 bg-white px-2 pt-2 rounded-t-2xl shadow-xs">
        <button
          onClick={() => setActiveSubTab("invoices")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeSubTab === "invoices"
              ? "border-[#214ECF] text-[#214ECF]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Receipt size={14} />
          Invoices & Receivables
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700 font-bold">
            {invoices.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("bank_accounts")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeSubTab === "bank_accounts"
              ? "border-[#214ECF] text-[#214ECF]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Landmark size={14} />
          Corporate Bank Accounts
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-[#214ECF] font-bold">
            HEALWEAL LLC
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("payouts")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeSubTab === "payouts"
              ? "border-[#214ECF] text-[#214ECF]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Wallet size={14} />
          Partner Payout Statements
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700 font-bold">
            {payouts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("disputes")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeSubTab === "disputes"
              ? "border-[#214ECF] text-[#214ECF]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <ShieldAlert size={14} />
          Disputes & Resolution
          {disputes.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
              {disputes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("payments")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            activeSubTab === "payments"
              ? "border-[#214ECF] text-[#214ECF]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <CreditCard size={14} />
          Payments & Gateways
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 1: INVOICES & RECEIVABLES                                       */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "invoices" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 flex-1">
              <div className="relative min-w-56 flex-1">
                <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") loadBillingData(); }}
                  placeholder="Search invoice number, client ID, or notes..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#214ECF] bg-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-semibold focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent / Pending</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-semibold focus:outline-none"
              >
                <option value="date_desc">Sort: Newest First</option>
                <option value="date_asc">Sort: Oldest First</option>
                <option value="amount_desc">Sort: Highest Amount</option>
                <option value="amount_asc">Sort: Lowest Amount</option>
              </select>

              <button
                onClick={loadBillingData}
                className="px-3.5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Filter
              </button>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-900">{displayInvoices.length}</span> invoices
            </div>
          </div>

          {/* Invoices Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 uppercase font-mono text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Issue Date</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Balance Due</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-[#214ECF]" />
                        Loading invoices from Supabase ledger...
                      </td>
                    </tr>
                  ) : displayInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <Receipt size={24} className="mx-auto mb-2 text-slate-300" />
                        No invoices found matching criteria.
                        <div className="mt-2">
                          <button
                            onClick={() => setShowCreateInvoice(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#214ECF] text-white font-bold text-xs hover:bg-blue-700 cursor-pointer"
                          >
                            <Plus size={13} /> Create First Invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayInvoices.map((inv) => {
                      const totalNum = Number(inv.total || inv.total_amount || 0);
                      const paidNum = Number(inv.amount_paid || inv.paid_amount || 0);
                      const balanceNum = Number(inv.balance_due ?? (totalNum - paidNum));

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => openInvoiceDetails(inv)}
                              className="font-mono font-bold text-[#214ECF] hover:underline cursor-pointer text-left"
                            >
                              {inv.invoice_number || inv.invoice_code || `INV-${inv.id}`}
                            </button>
                            {inv.currency && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-600">
                                {inv.currency}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            {getClientDisplayName(inv.client_id)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            ${totalNum.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 font-bold">
                            {balanceNum <= 0 ? (
                              <span className="text-emerald-700 font-mono">$0.00</span>
                            ) : (
                              <span className="text-amber-700 font-mono">${balanceNum.toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                inv.status === "paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : inv.status === "sent"
                                  ? "bg-blue-100 text-blue-800"
                                  : inv.status === "partially_paid"
                                  ? "bg-amber-100 text-amber-800"
                                  : inv.status === "overdue"
                                  ? "bg-rose-100 text-rose-800"
                                  : inv.status === "cancelled"
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {inv.status?.replace("_", " ") || "Draft"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openInvoiceDetails(inv)}
                                className="px-2.5 py-1 rounded-lg bg-[#214ECF]/5 text-[#214ECF] hover:bg-[#214ECF]/10 font-bold transition-colors cursor-pointer"
                                title="View Detail Drawer"
                              >
                                View
                              </button>

                              {inv.status === "draft" && (
                                <button
                                  onClick={() => handleSendInvoice(inv)}
                                  disabled={submittingAction}
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold transition-colors cursor-pointer"
                                  title="Send to client"
                                >
                                  Send
                                </button>
                              )}

                              {inv.status !== "paid" && inv.status !== "cancelled" && (
                                <button
                                  onClick={() => {
                                    setShowRecordPayment(inv);
                                    setPaymentForm({
                                      amount: balanceNum,
                                      paymentMethod: "wire",
                                      reference: "",
                                      notes: "",
                                    });
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold transition-colors cursor-pointer"
                                  title="Record Payment"
                                >
                                  + Pay
                                </button>
                              )}

                              {inv.status !== "cancelled" && inv.status !== "paid" && (
                                <button
                                  onClick={() => setShowCancelInvoice(inv)}
                                  className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold transition-colors cursor-pointer"
                                  title="Cancel invoice"
                                >
                                  <Ban size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 2: CORPORATE WIRE & BANK ACCOUNTS (HEALWEAL LLC)                */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "bank_accounts" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center font-bold">
                  <Landmark size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900">Corporate Wire Transfer Accounts</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#214ECF] text-white">
                      Beneficiary: HEALWEAL LLC
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configured payment accounts presented on client invoices. Protected with AES-256-GCM encryption at rest. Unmasking triggers immutable audit logs.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <ShieldCheck size={14} className="text-amber-600" />
                  Masked by Default · AES-256-GCM
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 uppercase font-mono text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Currency</th>
                    <th className="py-3 px-4">Bank Name</th>
                    <th className="py-3 px-4">Beneficiary</th>
                    <th className="py-3 px-4">Account / IBAN (Masked)</th>
                    <th className="py-3 px-4">Routing / SWIFT / Sort Code</th>
                    <th className="py-3 px-4">Country</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && bankAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-[#214ECF]" />
                        Loading corporate bank accounts...
                      </td>
                    </tr>
                  ) : bankAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No bank accounts configured in system.
                      </td>
                    </tr>
                  ) : (
                    bankAccounts.map((acc: any) => {
                      const isActive = acc.isActive ?? acc.is_active;
                      const bankName = acc.bankName || acc.bank_name;
                      const beneficiary = acc.beneficiary || acc.beneficiary_name;
                      const maskedAcct = acc.accountNumberMasked || acc.account_number_masked || acc.ibanMasked || acc.iban_masked || "—";
                      const routing = acc.routingAba || acc.routing_number;
                      const swift = acc.swift || acc.swift_code;
                      const sortCode = acc.sortCode || acc.sort_code;
                      const country =
                        acc.country ||
                        (acc.currency === "USD"
                          ? "United States"
                          : acc.currency === "GBP"
                          ? "United Kingdom"
                          : acc.currency === "EUR"
                          ? "Luxembourg"
                          : "India");

                      const isRevealed = revealedBankId === acc.id;

                      return (
                        <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                                acc.currency === "USD"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : acc.currency === "GBP"
                                  ? "bg-purple-100 text-purple-800"
                                  : acc.currency === "EUR"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {acc.currency}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            {bankName}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            <span className="font-bold text-[#214ECF]">{beneficiary}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                            {isRevealed && revealedBankData ? (
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                                {revealedBankData.accountNumber || revealedBankData.iban || maskedAcct}
                              </span>
                            ) : (
                              maskedAcct
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {routing ? `Routing: ${routing}` : ""}
                            {swift ? ` | SWIFT: ${swift}` : ""}
                            {sortCode ? ` | Sort: ${sortCode}` : ""}
                            {!routing && !swift && !sortCode ? "—" : ""}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {country}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Unmask button */}
                              {acc.currency !== "INR" && (
                                <button
                                  onClick={() => {
                                    if (isRevealed) {
                                      setRevealedBankId(null);
                                      setRevealedBankData(null);
                                    } else {
                                      setBankRevealModal(acc);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                                  title="Unmask Credentials"
                                >
                                  {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                              )}

                              {/* Toggle Active */}
                              <button
                                onClick={() => toggleBankAccount(acc)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  isActive
                                    ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {isActive ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* INR notice footer */}
            <div className="p-4 bg-amber-50/50 border-t border-amber-100 flex items-start gap-2.5">
              <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <span className="font-bold">Indian Rupee (INR) Transfer Account:</span> Currently unconfigured and marked inactive by default per Thinkatic corporate governance. Clients selecting INR are provided the verified guidance notice: <em>&quot;INR payment account details are currently unavailable. Please contact Thinkatic Finance.&quot;</em>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 3: PARTNER PAYOUT STATEMENTS                                    */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "payouts" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Wallet size={18} className="text-[#214ECF]" />
                <h3 className="font-bold text-sm text-slate-900">BPO Partner Payout Statements</h3>
              </div>
              <button
                onClick={() => handleExport("payouts")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <Download size={13} /> Export Payouts CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Statement #</th>
                    <th className="py-3 px-4">Partner</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Billable Units</th>
                    <th className="py-3 px-4">Gross Amount</th>
                    <th className="py-3 px-4">Net Payout</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Payout Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payouts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <Wallet size={24} className="mx-auto mb-2 text-slate-300" />
                        No partner payout statements found.
                      </td>
                    </tr>
                  ) : (
                    payouts.map((pay: any) => (
                      <tr key={pay.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#214ECF]">
                          {pay.statement_number || pay.payout_code || `PAY-${pay.id}`}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {pay.bpo_partners?.name || pay.partner_name || pay.partner_id || "BPO Partner"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {pay.period_start ? `${new Date(pay.period_start).toLocaleDateString()} - ${new Date(pay.period_end).toLocaleDateString()}` : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono">
                          {pay.billable_units ? `${pay.billable_units} ${pay.unit_type || "hrs"}` : "—"}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          ${Number(pay.gross_amount || pay.payable_amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700 font-mono">
                          ${Number(pay.net_amount || pay.paid_amount || pay.payable_amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              pay.status === "paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : pay.status === "approved"
                                ? "bg-blue-100 text-blue-800"
                                : pay.status === "processing"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {pay.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {pay.payout_date ? new Date(pay.payout_date).toLocaleDateString() : "Pending"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 4: FINANCIAL DISPUTES & RESOLUTION                              */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "disputes" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={18} className="text-amber-600" />
                <h3 className="font-bold text-sm text-slate-900">Invoice & Payout Financial Disputes</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Dispute #</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Disputed Amount</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date Filed</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {disputes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <ShieldCheck size={24} className="mx-auto mb-2 text-emerald-500" />
                        No active financial disputes on record. All billing is reconciled.
                      </td>
                    </tr>
                  ) : (
                    disputes.map((dsp: any) => (
                      <tr key={dsp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#214ECF]">
                          {dsp.dispute_code || dsp.dispute_number || `DSP-${dsp.id}`}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {dsp.dispute_type || dsp.reference_type || "Invoice"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                          ${Number(dsp.disputed_amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate">
                          {dsp.reason || dsp.dispute_reason || "—"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              dsp.status === "resolved"
                                ? "bg-emerald-100 text-emerald-800"
                                : dsp.status === "rejected"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {dsp.status?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {dsp.created_at ? new Date(dsp.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {dsp.status !== "resolved" && dsp.status !== "rejected" && (
                            <button
                              onClick={() => {
                                setDisputeModalTarget(dsp);
                                setDisputeAction("RESOLVE");
                                setDisputeAdjustmentAmount(Number(dsp.disputed_amount || 0));
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#214ECF] text-white font-bold text-xs hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                              Review & Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 5: PAYMENTS LOG & GATEWAYS                                      */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeSubTab === "payments" && (
        <div className="space-y-6">
          {/* Payment Gateways Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PayPal */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">PayPal Server SDK Integration</h4>
                    <p className="text-xs text-slate-500">Live Card & PayPal Wallet Checkout</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                  Connected (Live)
                </span>
              </div>
              <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mode:</span>
                  <span className="font-bold text-slate-900">Live Production</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Client ID:</span>
                  <span>ATEEcuGQZgoYdPdybH_...NGaKt</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Webhook Sync:</span>
                  <span className="text-emerald-700 font-bold">Active</span>
                </div>
              </div>
            </div>

            {/* Wire Transfer Receiving */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                    <Landmark size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Corporate Wire & Bank Transfer</h4>
                    <p className="text-xs text-slate-500">Citibank USA, Citibank UK, Banking Circle</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 uppercase">
                  3 Active Accounts
                </span>
              </div>
              <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Beneficiary:</span>
                  <span className="font-bold text-[#214ECF]">HEALWEAL LLC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Currencies Supported:</span>
                  <span>USD, GBP, EUR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Verification:</span>
                  <span className="text-emerald-700 font-bold">Manual Admin Confirmation</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Payments Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 bg-slate-50/60 font-bold text-xs text-slate-900">
              Recent Logged Payments
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Transaction ID</th>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No recent payments recorded.
                      </td>
                    </tr>
                  ) : (
                    recentPayments.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          TXN-{p.id}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#214ECF]">
                          {p.invoices?.invoice_number || `INV-${p.invoice_id}`}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-700 font-mono">
                          ${Number(p.amount || 0).toFixed(2)} {p.currency || "USD"}
                        </td>
                        <td className="py-3 px-4 capitalize text-slate-700">
                          {p.payment_method?.replace("_", " ") || "Wire"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                            {p.status || "Successful"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {p.paid_at || p.created_at ? new Date(p.paid_at || p.created_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: INVOICE DETAIL DRAWER                                          */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-black text-[#214ECF]">
                    {selectedInvoice.invoice_number || selectedInvoice.invoice_code}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      selectedInvoice.status === "paid"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedInvoice.status === "sent"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {selectedInvoice.status?.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Client: <span className="font-semibold text-slate-800">{getClientDisplayName(selectedInvoice.client_id)}</span> · Due Date: {selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : "—"}
                </p>
              </div>

              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {selectedInvoiceLoading ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#214ECF]" />
                Loading complete invoice statement...
              </div>
            ) : (
              <>
                {/* Line Items Table */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800">
                    Statement Line Items
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/50 text-slate-500 text-[10px] uppercase font-mono border-b border-slate-100">
                      <tr>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedInvoice.items || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-500">
                            Fixed contract billing items
                          </td>
                        </tr>
                      ) : (
                        (selectedInvoice.items || []).map((item: any, idx: number) => (
                          <tr key={item.id || idx}>
                            <td className="py-2.5 px-3 font-medium text-slate-900">{item.description}</td>
                            <td className="py-2.5 px-3 text-center">{item.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono">${Number(item.unit_price).toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right font-bold font-mono">${Number(item.amount).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Financial Math Breakdown */}
                <div className="flex justify-end">
                  <div className="w-72 space-y-1.5 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span>${Number(selectedInvoice.subtotal || selectedInvoice.total || 0).toFixed(2)}</span>
                    </div>
                    {Number(selectedInvoice.tax_amount || 0) > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Tax ({((Number(selectedInvoice.tax_rate) || 0) * 100).toFixed(0)}%):</span>
                        <span>+${Number(selectedInvoice.tax_amount).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(selectedInvoice.discount_amount || 0) > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Discount:</span>
                        <span>-${Number(selectedInvoice.discount_amount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-slate-900 text-sm">
                      <span>Total:</span>
                      <span>${Number(selectedInvoice.total || selectedInvoice.total_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Amount Paid:</span>
                      <span>${Number(selectedInvoice.amount_paid || selectedInvoice.paid_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-amber-700 font-bold border-t border-slate-200 pt-1.5">
                      <span>Balance Due:</span>
                      <span>${Number(selectedInvoice.balance_due ?? (Number(selectedInvoice.total || 0) - Number(selectedInvoice.amount_paid || 0))).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Terms & Notes */}
                {(selectedInvoice.notes || selectedInvoice.terms) && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                    {selectedInvoice.notes && <p><span className="font-bold text-slate-800">Notes:</span> {selectedInvoice.notes}</p>}
                    {selectedInvoice.terms && <p><span className="font-bold text-slate-800">Terms:</span> {selectedInvoice.terms}</p>}
                  </div>
                )}

                {/* Drawer Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {selectedInvoice.status === "draft" && (
                      <button
                        onClick={() => handleSendInvoice(selectedInvoice)}
                        disabled={submittingAction}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#214ECF] text-white font-bold text-xs rounded-xl hover:bg-blue-700 cursor-pointer"
                      >
                        <Send size={13} /> Send to Client
                      </button>
                    )}

                    {selectedInvoice.status !== "paid" && selectedInvoice.status !== "cancelled" && (
                      <button
                        onClick={() => {
                          const bal = Number(selectedInvoice.balance_due ?? (Number(selectedInvoice.total || 0) - Number(selectedInvoice.amount_paid || 0)));
                          setShowRecordPayment(selectedInvoice);
                          setPaymentForm({
                            amount: bal,
                            paymentMethod: "wire",
                            reference: "",
                            notes: "",
                          });
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 cursor-pointer"
                      >
                        <CreditCard size={13} /> Record Payment
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: RECORD PAYMENT                                                 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {showRecordPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleRecordPayment} className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Record Incoming Payment</h3>
              <button onClick={() => setShowRecordPayment(null)} type="button" className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl text-xs text-blue-900 space-y-1">
              <div className="font-bold">Invoice: {showRecordPayment.invoice_number || showRecordPayment.invoice_code}</div>
              <div>Outstanding Balance: <span className="font-mono font-bold">${Number(showRecordPayment.balance_due ?? (Number(showRecordPayment.total || 0) - Number(showRecordPayment.amount_paid || 0))).toFixed(2)}</span></div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount ($ USD)*</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Method*</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-semibold focus:outline-none"
                >
                  <option value="wire">Corporate Wire Transfer (Citibank / Banking Circle)</option>
                  <option value="bank_transfer">ACH / Local Bank Transfer</option>
                  <option value="paypal">PayPal Gateway</option>
                  <option value="card">Credit / Debit Card</option>
                  <option value="manual">Manual Settlement / Offset</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Reference / Wire Transaction ID</label>
                <input
                  type="text"
                  placeholder="e.g. CITI-WIRE-889104"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#214ECF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  placeholder="Verification details from banking portal..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#214ECF]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRecordPayment(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAction}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {submittingAction ? "Recording..." : "Confirm & Settle"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: CANCEL INVOICE                                                 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {showCancelInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Cancel Invoice</h3>
              <button onClick={() => setShowCancelInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to cancel invoice <span className="font-bold font-mono text-slate-900">{showCancelInvoice.invoice_number || showCancelInvoice.invoice_code}</span>? This locks the statement and stops payment processing.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Cancellation Reason*</label>
              <input
                type="text"
                placeholder="e.g. Scope change or revised terms"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCancelInvoice(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Keep Invoice
              </button>
              <button
                type="button"
                onClick={handleCancelInvoice}
                disabled={submittingAction}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                {submittingAction ? "Cancelling..." : "Cancel Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: CREATE INVOICE                                                 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {showCreateInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateInvoice} className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-[#214ECF]" />
                <h3 className="font-bold text-sm text-slate-900">Create New Client Invoice</h3>
              </div>
              <button onClick={() => setShowCreateInvoice(false)} type="button" className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                <AlertTriangle size={15} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Client*</label>
                <select
                  id="create-invoice-client-select"
                  required
                  value={newInvoice.clientId}
                  onChange={(e) => setNewInvoice({ ...newInvoice, clientId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:border-[#214ECF]"
                >
                  <option value="">Select accredited client profile...</option>
                  {availableClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.email} ({c.id.slice(0, 8)}...)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Project Scope</label>
                <select
                  id="create-invoice-project-select"
                  value={newInvoice.projectId}
                  onChange={(e) => setNewInvoice({ ...newInvoice, projectId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:border-[#214ECF]"
                >
                  <option value="">General Corporate Deliverables</option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Invoice Date*</label>
                <input
                  id="create-invoice-date-input"
                  type="date"
                  required
                  value={newInvoice.invoiceDate}
                  onChange={(e) => {
                    const nextInvDate = e.target.value;
                    const nextDue = newInvoice.dueDate;
                    let err = null;
                    if (!nextInvDate) err = "Invoice date is required.";
                    else if (nextDue && nextDue < nextInvDate) err = "Payment due date must be on or after invoice date.";
                    setDateError(err);
                    setNewInvoice({ ...newInvoice, invoiceDate: nextInvDate });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF] focus:ring-1 focus:ring-[#214ECF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Due Date*</label>
                <input
                  id="create-invoice-due-date-input"
                  type="date"
                  required
                  value={newInvoice.dueDate}
                  onChange={(e) => {
                    const nextDue = e.target.value;
                    let err = null;
                    if (!nextDue) err = "Payment due date is required.";
                    else if (newInvoice.invoiceDate && nextDue < newInvoice.invoiceDate) err = "Payment due date must be on or after invoice date.";
                    setDateError(err);
                    setNewInvoice({ ...newInvoice, dueDate: nextDue });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF] focus:ring-1 focus:ring-[#214ECF]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Currency</label>
                <select
                  id="create-invoice-currency-select"
                  value={newInvoice.currency}
                  onChange={(e) => setNewInvoice({ ...newInvoice, currency: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-bold focus:outline-none focus:border-[#214ECF]"
                >
                  <option value="USD">USD ($) — Citibank USA</option>
                  <option value="GBP">GBP (£) — Citibank UK</option>
                  <option value="EUR">EUR (€) — Banking Circle Luxembourg</option>
                </select>
              </div>
            </div>

            {dateError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                <AlertTriangle size={15} className="shrink-0 text-red-500" />
                <span>{dateError}</span>
              </div>
            )}

            {/* Dynamic Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700">Line Items & Deliverables*</label>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="text-xs text-[#214ECF] font-bold hover:underline cursor-pointer"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-2">
                {newInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      placeholder="Service / item description..."
                      value={item.description}
                      onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(idx, "quantity", parseFloat(e.target.value) || 1)}
                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-center font-mono"
                    />
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-mono">$</span>
                      <input
                        type="number"
                        placeholder="Rate"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-right font-mono font-bold"
                      />
                    </div>
                    <div className="w-24 text-right font-mono font-bold text-slate-900 text-xs">
                      ${((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toFixed(2)}
                    </div>
                    {newInvoice.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Tax Rate (%)</label>
                <input
                  id="create-invoice-tax-rate"
                  type="number"
                  min="0"
                  max="100"
                  value={newInvoice.taxRate}
                  onChange={(e) => setNewInvoice({ ...newInvoice, taxRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Discount ($)</label>
                <input
                  id="create-invoice-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newInvoice.discountAmount}
                  onChange={(e) => setNewInvoice({ ...newInvoice, discountAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>

              <div className="col-span-2 flex flex-col justify-end text-right font-mono">
                <span className="text-[10px] uppercase font-bold text-slate-500">Calculated Total</span>
                <span className="text-base font-black text-[#214ECF]">${calculatedCreateTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateInvoice(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                id="create-invoice-submit-btn"
                type="submit"
                disabled={submittingAction || Boolean(dateError)}
                className="px-5 py-2 bg-[#214ECF] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                {submittingAction && <RefreshCw size={13} className="animate-spin" />}
                {submittingAction ? "Generating..." : "Generate Invoice"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 5: UNMASK BANK ACCOUNT DETAILS                                    */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {bankRevealModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <ShieldAlert size={20} />
              <h3 className="font-bold text-sm text-slate-900">Authorize Bank Credential Unmasking</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to reveal full account and routing credentials for corporate account <span className="font-bold text-slate-900">{bankRevealModal.currency} — {bankRevealModal.bankName || bankRevealModal.bank_name}</span>.
            </p>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
              <span className="font-bold">Security Notice:</span> This action is authorized strictly for Finance Administrators and is automatically recorded to the audit log (<span className="font-mono">bank_account_reveal</span>).
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBankRevealModal(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRevealBankDetails(bankRevealModal)}
                disabled={submittingAction}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                {submittingAction ? "Decrypting..." : "Unmask Credentials"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 6: RESOLVE DISPUTE                                                */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {disputeModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleResolveDispute} className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Review Dispute: {disputeModalTarget.dispute_code || disputeModalTarget.dispute_number}
              </h3>
              <button onClick={() => setDisputeModalTarget(null)} type="button" className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
              <div><span className="font-bold">Disputed Amount:</span> <span className="font-mono text-[#214ECF]">${Number(disputeModalTarget.disputed_amount || 0).toFixed(2)}</span></div>
              <div><span className="font-bold">Reason:</span> {disputeModalTarget.reason || disputeModalTarget.dispute_reason}</div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Decision</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDisputeAction("RESOLVE")}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors ${
                    disputeAction === "RESOLVE"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  Accept & Resolve
                </button>
                <button
                  type="button"
                  onClick={() => setDisputeAction("REJECT")}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors ${
                    disputeAction === "REJECT"
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  Reject Dispute
                </button>
              </div>
            </div>

            {disputeAction === "RESOLVE" && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Adjustment Credit Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={disputeAdjustmentAmount}
                  onChange={(e) => setDisputeAdjustmentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {disputeAction === "RESOLVE" ? "Resolution Notes*" : "Documented Rejection Reason*"}
              </label>
              <textarea
                required
                rows={3}
                placeholder={disputeAction === "RESOLVE" ? "Auditable settlement explanation..." : "Reason why dispute was rejected..."}
                value={disputeResolutionNotes}
                onChange={(e) => setDisputeResolutionNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDisputeModalTarget(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAction}
                className={`px-4 py-2 text-white font-bold text-xs rounded-xl shadow-xs ${
                  disputeAction === "RESOLVE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {submittingAction ? "Processing..." : disputeAction === "RESOLVE" ? "Confirm Resolution" : "Confirm Rejection"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
