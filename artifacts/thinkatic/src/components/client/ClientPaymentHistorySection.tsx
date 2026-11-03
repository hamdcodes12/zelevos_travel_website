import React from "react";
import {
  Receipt,
  Eye,
  Printer,
  Download,
  CheckCircle2,
  CreditCard,
  Calendar,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { ClientReceipt } from "./ClientReceiptViewerModal";

interface ClientPaymentHistorySectionProps {
  receipts: ClientReceipt[];
  onViewReceipt: (receipt: ClientReceipt) => void;
  onNavigateToPlans?: () => void;
}

export default function ClientPaymentHistorySection({
  receipts,
  onViewReceipt,
  onNavigateToPlans,
}: ClientPaymentHistorySectionProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] shadow-2xs">
            <Receipt size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Payment History &amp; Receipts</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#214ECF] border border-blue-200">
                {receipts.length} Confirmed
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Official payment receipts and transaction records for confirmed purchases
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full font-semibold">
            <ShieldCheck size={13} />
            <span>Database Reconciled</span>
          </span>
        </div>
      </div>

      {/* Content Area */}
      {receipts.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-xl bg-slate-50/70 border border-dashed border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Receipt size={24} />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800">No Payment Receipts Yet</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Once you complete a purchase through PayPal or bank wire transfer, your permanent official payment receipts will be recorded here automatically.
            </p>
          </div>
          {onNavigateToPlans && (
            <button
              type="button"
              onClick={onNavigateToPlans}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#214ECF] hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <span>Explore Available Plans</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Plan / Service</th>
                <th className="py-3 px-3">Date &amp; Time</th>
                <th className="py-3 px-3">Method</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receipts.map((rcpt) => (
                <tr key={rcpt.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-mono font-bold text-[#214ECF] bg-blue-50/60 border border-blue-100 px-2 py-0.5 rounded text-[11px]">
                      {rcpt.receiptNumber}
                    </span>
                    <div className="text-[10px] font-mono text-slate-400 mt-1 truncate max-w-[140px]" title={rcpt.transactionId}>
                      Ref: {rcpt.transactionId}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 text-xs">
                      {rcpt.purchase?.packageName || "Enterprise Service Plan"}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-500">
                        {rcpt.purchase?.packageCategory || "AI Operations"}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[10px] text-slate-400">
                        {rcpt.purchase?.billingType || "One-Time"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <div className="font-semibold text-slate-800">{rcpt.paymentDate}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{rcpt.paymentTime}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="inline-flex items-center gap-1 text-[11px] text-slate-700 font-medium">
                      <CreditCard size={12} className="text-slate-400 shrink-0" />
                      <span>{rcpt.paymentMethod || "PayPal"}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="font-bold text-slate-900 text-sm">
                      ${rcpt.amountPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">
                      {rcpt.currency || "USD"}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={11} />
                      <span>{rcpt.paymentStatus || "PAID"}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onViewReceipt(rcpt)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#214ECF] hover:bg-blue-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>View Receipt</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
