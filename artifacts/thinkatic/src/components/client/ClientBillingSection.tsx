import { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Receipt,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  Send,
  Eye,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertCircle,
  FileText,
} from "lucide-react";
import BankTransferPaymentSection from "@/components/payment/BankTransferPaymentSection";

interface ClientInvoice {
  id: string;
  invoice_number: string;
  bpo_client_id: string;
  period_start: string;
  period_end: string;
  subtotal_amount: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  balance_due: number;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID" | "CANCELLED";
  currency: string;
  issue_date?: string;
  due_date?: string;
  items?: any[];
  adjustments?: any[];
  payments?: any[];
  created_at: string;
}

interface ClientDispute {
  id: string;
  dispute_number: string;
  reference_type: string;
  reference_id: string;
  disputed_amount: number;
  reason: string;
  description: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  resolution_notes?: string;
  created_at: string;
  resolved_at?: string;
}

interface ClientBillingSectionProps {
  clientApi: (endpoint: string, options?: RequestInit) => Promise<Response>;
  userRole?: string;
}

export default function ClientBillingSection({ clientApi, userRole = "client_admin" }: ClientBillingSectionProps) {
  const [activeSubTab, setActiveSubTab] = useState<"invoices" | "disputes">("invoices");
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [disputes, setDisputes] = useState<ClientDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected Invoice Modal
  const [selectedInvoice, setSelectedInvoice] = useState<ClientInvoice | null>(null);

  // Dispute Modal
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeTarget, setDisputeTarget] = useState<ClientInvoice | null>(null);
  const [disputeReason, setDisputeReason] = useState("RATE_DISCREPANCY");
  const [disputedAmount, setDisputedAmount] = useState<number>(0);
  const [disputeDesc, setDisputeDesc] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const isViewer = userRole === "client_viewer";

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, dspRes] = await Promise.all([
        clientApi("/invoices"),
        clientApi("/disputes"),
      ]);

      if (invRes.ok) {
        const iData = await invRes.json();
        setInvoices(iData.invoices || []);
      }
      if (dspRes.ok) {
        const dData = await dspRes.json();
        setDisputes(dData.disputes || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load client billing data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleExportCsv = async () => {
    if (isViewer) {
      setError("Role 'client_viewer' has read-only access and cannot export financial reports.");
      return;
    }
    const token = localStorage.getItem("user_token");
    window.open(`/api/client/reports/billing/export?format=csv&token=${encodeURIComponent(token || "")}`, "_blank");
  };

  const handleOpenDispute = (inv: ClientInvoice) => {
    setDisputeTarget(inv);
    setDisputedAmount(inv.balance_due ?? inv.total_amount);
    setDisputeReason("RATE_DISCREPANCY");
    setDisputeDesc("");
    setDisputeModalOpen(true);
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeTarget) return;

    setSubmittingDispute(true);
    setError(null);
    try {
      const res = await clientApi(`/invoices/${disputeTarget.id}/dispute`, {
        method: "POST",
        body: JSON.stringify({
          reason: disputeReason,
          disputed_amount: Number(disputedAmount),
          description: disputeDesc,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || "Failed to submit dispute.");
      }

      const data = await res.json();
      setSuccessMsg(`Dispute ${data.dispute?.dispute_number} submitted to Thinkatic Finance.`);
      setDisputeModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  const totalBilled = invoices.reduce((acc, inv) => acc + Number(inv.total_amount || 0), 0);
  const totalOutstanding = invoices
    .filter((inv) => inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID" || inv.status === "OVERDUE")
    .reduce((acc, inv) => acc + Number(inv.balance_due ?? inv.total_amount ?? 0), 0);
  const totalPaid = invoices.filter((inv) => inv.status === "PAID").length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-400" />
            Billing & Invoices
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Enterprise campaign statements, verified operational billing hours, and dispute management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={isViewer}
            title={isViewer ? "Viewers cannot export financial reports" : "Download Billing CSV"}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => void loadData()}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Billed</p>
          <p className="mt-2 text-2xl font-black text-white">
            ${totalBilled.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Across all issued billing cycles</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Outstanding Balance</p>
          <p className="mt-2 text-2xl font-black text-amber-400">
            ${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Currently awaiting remittance</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Settled Invoices</p>
          <p className="mt-2 text-2xl font-black text-emerald-400">{totalPaid}</p>
          <p className="mt-1 text-[11px] text-slate-500">Paid in full with zero balance</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Disputes</p>
          <p className="mt-2 text-2xl font-black text-rose-400">
            {disputes.filter((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW").length}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Under finance team investigation</p>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveSubTab("invoices")}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition ${
            activeSubTab === "invoices"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Receipt size={14} /> Issued Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setActiveSubTab("disputes")}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition ${
            activeSubTab === "disputes"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <AlertTriangle size={14} /> Billing Disputes ({disputes.length})
        </button>
      </div>

      {/* ── INVOICES TABLE ── */}
      {activeSubTab === "invoices" && (
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <div className="bg-slate-900/80 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-500">
              No invoices generated for this client account yet. Invoices are generated at the end of each operational cycle.
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Billing Cycle</th>
                    <th className="p-4">Due Date</th>
                    <th className="p-4">Total Amount</th>
                    <th className="p-4">Balance Due</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-4 font-mono font-bold text-white">{inv.invoice_number}</td>
                      <td className="p-4 text-slate-300">
                        {inv.period_start} → {inv.period_end}
                      </td>
                      <td className="p-4 text-slate-400">{inv.due_date || "Upon receipt"}</td>
                      <td className="p-4 font-bold text-white">${Number(inv.total_amount).toFixed(2)}</td>
                      <td className="p-4 font-bold text-rose-400">
                        ${Number(inv.balance_due ?? inv.total_amount).toFixed(2)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            inv.status === "PAID"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : inv.status === "ISSUED"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : inv.status === "DRAFT"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                          >
                            View
                          </button>
                          {inv.status !== "CANCELLED" && inv.status !== "VOID" && !isViewer && (
                            <button
                              onClick={() => handleOpenDispute(inv)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold cursor-pointer"
                            >
                              Dispute
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

      {/* ── DISPUTES TABLE ── */}
      {activeSubTab === "disputes" && (
        <div className="space-y-4">
          {disputes.length === 0 ? (
            <div className="bg-slate-900/80 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-500">
              No disputes have been filed by your organization. If you identify hours or billing discrepancies, you can file a dispute directly from any invoice.
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4">Dispute #</th>
                    <th className="p-4">Disputed Amount</th>
                    <th className="p-4">Reason Category</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Resolution Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {disputes.map((dsp) => (
                    <tr key={dsp.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-4 font-mono font-bold text-white">{dsp.dispute_number}</td>
                      <td className="p-4 font-bold text-rose-400">${Number(dsp.disputed_amount).toFixed(2)}</td>
                      <td className="p-4 text-slate-200 font-semibold">{dsp.reason.replaceAll("_", " ")}</td>
                      <td className="p-4 max-w-xs truncate text-slate-400">{dsp.description}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            dsp.status === "RESOLVED"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : dsp.status === "REJECTED"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {dsp.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300 text-xs">
                        {dsp.resolution_notes || <span className="text-slate-500 italic">Under Review</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── INVOICE DETAIL MODAL ── */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-blue-400 uppercase">Enterprise Invoice</span>
                <h3 className="text-xl font-black text-white">{selectedInvoice.invoice_number}</h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Issue Date</p>
                  <p className="font-semibold text-white">{selectedInvoice.issue_date || "DRAFT"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Due Date</p>
                  <p className="font-semibold text-white">{selectedInvoice.due_date || "Upon Receipt"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Status</p>
                  <p className="font-bold uppercase text-blue-400">{selectedInvoice.status}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Balance Due</p>
                  <p className="font-black text-rose-400 text-sm">
                    ${Number(selectedInvoice.balance_due ?? selectedInvoice.total_amount).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Campaign Line Items</p>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Description</th>
                        <th className="p-3">Hours</th>
                        <th className="p-3">Contract Rate</th>
                        <th className="p-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(selectedInvoice.items || []).map((item: any) => (
                        <tr key={item.id}>
                          <td className="p-3 text-white font-medium">{item.description}</td>
                          <td className="p-3 font-mono">{Number(item.quantity).toFixed(1)}</td>
                          <td className="p-3 font-mono">${Number(item.unit_price).toFixed(2)}</td>
                          <td className="p-3 text-right font-black text-white font-mono">
                            ${Number(item.total_amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Calculation Summary */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="text-white font-mono">${Number(selectedInvoice.subtotal_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tax ({Number(selectedInvoice.tax_rate || 0)}%):</span>
                  <span className="text-white font-mono">${Number(selectedInvoice.tax_amount || 0).toFixed(2)}</span>
                </div>
                {Number(selectedInvoice.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount / Credits:</span>
                    <span className="font-mono">-${Number(selectedInvoice.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-black text-white">
                  <span>Grand Total:</span>
                  <span className="font-mono">${Number(selectedInvoice.total_amount).toFixed(2)}</span>
                </div>
              </div>

              {/* Bank Transfer / Wire Payment Section */}
              {selectedInvoice.status !== "PAID" && selectedInvoice.status !== "CANCELLED" && selectedInvoice.status !== "VOID" && (
                <div className="pt-2">
                  <BankTransferPaymentSection
                    invoiceId={selectedInvoice.id}
                    invoiceNumber={selectedInvoice.invoice_number}
                    defaultCurrency={selectedInvoice.currency}
                    balanceDue={Number(selectedInvoice.balance_due ?? selectedInvoice.total_amount)}
                    totalAmount={Number(selectedInvoice.total_amount)}
                    apiFetch={clientApi}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DISPUTE MODAL ── */}
      {disputeModalOpen && disputeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-rose-400 uppercase">File Formal Dispute</span>
                <h3 className="text-lg font-black text-white">Invoice {disputeTarget.invoice_number}</h3>
              </div>
              <button
                onClick={() => setDisputeModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitDispute} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">Reason Category *</label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-blue-500"
                >
                  <option value="RATE_DISCREPANCY">Contract Hourly Rate Discrepancy</option>
                  <option value="UNAPPROVED_HOURS">Unapproved Overtime / Production Hours</option>
                  <option value="SLA_BREACH">SLA Breach / Service Credit Adjustment</option>
                  <option value="INCORRECT_TAX">Incorrect Tax Rate Applied</option>
                  <option value="OTHER">Other Contractual Dispute</option>
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">Disputed Amount USD *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={disputedAmount}
                  onChange={(e) => setDisputedAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-blue-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">Justification Details *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail the shift dates, headcount variance, or contract clause in question..."
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setDisputeModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md disabled:opacity-50"
                >
                  <Send size={13} />
                  {submittingDispute ? "Filing..." : "Submit Dispute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
