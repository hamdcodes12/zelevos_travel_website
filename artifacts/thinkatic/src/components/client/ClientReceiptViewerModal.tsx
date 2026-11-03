import React, { useState } from "react";
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Building2,
  User,
  Calendar,
  CreditCard,
  Hash,
  ExternalLink,
  FileText,
} from "lucide-react";
import BrandLogo from "@/components/layout/BrandLogo";

export interface ClientReceipt {
  id: number;
  receiptNumber: string;
  invoiceId: number;
  invoiceNumber: string;
  paymentId: number;
  transactionId: string;
  paymentDate: string;
  paymentTime: string;
  paymentTimestamp: string;
  paymentStatus: "PAID" | string;
  paymentMethod: string;
  currency: string;
  amountPaid: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  purchase: {
    packageId: string;
    packageName: string;
    packageCategory: string;
    packageDescription: string;
    billingType: string;
    billingPeriod: string;
    orderReference: string;
  };
  client: {
    id: string;
    name: string;
    companyName: string;
    email: string;
    phone: string;
    country: string;
    accountStatus: string;
  };
  company: {
    companyName: string;
    legalName: string;
    tagline: string;
    email: string;
    phone: string;
    website: string;
    address: string;
    jurisdiction: string;
  };
}

interface ClientReceiptViewerModalProps {
  receipt: ClientReceipt | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ClientReceiptViewerModal({
  receipt,
  isOpen,
  onClose,
}: ClientReceiptViewerModalProps) {
  const [copiedReceiptNum, setCopiedReceiptNum] = useState(false);
  const [copiedTxn, setCopiedTxn] = useState(false);

  if (!isOpen || !receipt) return null;

  const handleCopyReceiptNumber = () => {
    navigator.clipboard.writeText(receipt.receiptNumber);
    setCopiedReceiptNum(true);
    setTimeout(() => setCopiedReceiptNum(false), 2000);
  };

  const handleCopyTxn = () => {
    navigator.clipboard.writeText(receipt.transactionId);
    setCopiedTxn(true);
    setTimeout(() => setCopiedTxn(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Generates an offline HTML invoice receipt document and prompts download
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Receipt - ${receipt.receiptNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #0f172a; background: #fff; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
    .logo { font-size: 24px; font-weight: 800; color: #214ECF; }
    .receipt-title { font-size: 14px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-top: 4px; }
    .rcpt-no { font-family: monospace; font-size: 18px; font-weight: 700; color: #214ECF; }
    .paid-badge { display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-top: 6px; }
    .grid { display: flex; justify-content: space-between; margin: 30px 0; gap: 40px; }
    .col { flex: 1; }
    .col-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 8px; }
    .col-body { font-size: 13px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    th { background: #f8fafc; font-size: 11px; text-transform: uppercase; color: #475569; padding: 10px 12px; text-align: left; border-bottom: 1px solid #cbd5e1; }
    td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .total-box { margin-left: auto; width: 300px; margin-top: 20px; font-size: 13px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
    .grand-total { font-size: 18px; font-weight: 800; color: #214ECF; border-top: 2px solid #e2e8f0; padding-top: 10px; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Thinkatic</div>
      <div class="receipt-title">Official Payment Receipt</div>
      <div style="font-size: 12px; color: #64748b;">Thinkatic AI Agency · thinkatic.com</div>
    </div>
    <div style="text-align: right;">
      <div class="rcpt-no">${receipt.receiptNumber}</div>
      <div class="paid-badge">✓ PAID IN FULL</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Date: ${receipt.paymentDate} ${receipt.paymentTime}</div>
    </div>
  </div>

  <div class="grid">
    <div class="col">
      <div class="col-title">Issued By</div>
      <div class="col-body">
        <strong>${receipt.company.legalName}</strong><br />
        ${receipt.company.address}<br />
        Email: ${receipt.company.email}<br />
        Phone: ${receipt.company.phone}<br />
        Web: ${receipt.company.website}
      </div>
    </div>
    <div class="col">
      <div class="col-title">Billed To</div>
      <div class="col-body">
        <strong>${receipt.client.name}</strong><br />
        ${receipt.client.companyName ? receipt.client.companyName + "<br />" : ""}
        Email: ${receipt.client.email}<br />
        Phone: ${receipt.client.phone}<br />
        Account ID: ${receipt.client.id}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Type</th>
        <th>Order Ref</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>${receipt.purchase.packageName}</strong><br />
          <span style="font-size: 11px; color: #64748b;">${receipt.purchase.packageDescription}</span>
        </td>
        <td>${receipt.purchase.billingType}</td>
        <td><code style="font-family: monospace;">${receipt.purchase.orderReference}</code></td>
        <td style="text-align: right; font-weight: 600;">$${receipt.amountPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${receipt.currency}</td>
      </tr>
    </tbody>
  </table>

  <div class="total-box">
    <div class="total-row">
      <span>Subtotal</span>
      <span>$${receipt.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${receipt.currency}</span>
    </div>
    <div class="total-row">
      <span>Taxes &amp; Fees (0%)</span>
      <span>$${receipt.taxAmount.toFixed(2)} ${receipt.currency}</span>
    </div>
    <div class="total-row grand-total">
      <span>Total Paid</span>
      <span>$${receipt.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${receipt.currency}</span>
    </div>
    <div class="total-row" style="color: #047857; font-weight: 600;">
      <span>Balance Due</span>
      <span>$0.00 ${receipt.currency}</span>
    </div>
  </div>

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-top: 30px; font-size: 12px;">
    <strong>Payment Details:</strong><br />
    Method: ${receipt.paymentMethod}<br />
    Transaction ID: <code style="font-family: monospace;">${receipt.transactionId}</code><br />
    Invoice Number: <code style="font-family: monospace;">${receipt.invoiceNumber}</code><br />
    Status: ${receipt.paymentStatus}
  </div>

  <div class="footer">
    Thank you for partnering with Thinkatic. This document is an authoritative, permanent electronic payment receipt.<br />
    All services are delivered according to your Master Services Agreement and Statement of Work.
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Thinkatic-Receipt-${receipt.receiptNumber}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Print Specific CSS to isolate the receipt document during window.print() */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thinkatic-official-receipt-print-area,
          #thinkatic-official-receipt-print-area * {
            visibility: visible !important;
          }
          #thinkatic-official-receipt-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            max-width: 100vw !important;
            padding: 30px !important;
            margin: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 999999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
          {/* Modal Header Bar (Hidden during print) */}
          <div className="no-print px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF]">
                <FileText size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Official Payment Receipt
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#214ECF] border border-blue-200">
                    {receipt.receiptNumber}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Confirmed transaction record for your Thinkatic client account
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
              >
                <Printer size={13} />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
              >
                <Download size={13} />
                <span>Download</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Printable Receipt Paper Container */}
          <div className="overflow-y-auto p-6 sm:p-8 space-y-6 flex-1 bg-white">
            <div id="thinkatic-official-receipt-print-area" className="space-y-6">
              {/* Receipt Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200/80 pb-6">
                <div>
                  <BrandLogo className="w-[140px] h-auto mb-2" />
                  <div className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                    Official Payment Receipt
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {receipt.company.tagline}
                  </div>
                </div>

                <div className="sm:text-right space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={13} />
                    <span>PAID IN FULL</span>
                  </div>
                  <div className="text-lg font-mono font-black text-[#214ECF] flex items-center sm:justify-end gap-1.5">
                    <span>{receipt.receiptNumber}</span>
                    <button
                      type="button"
                      onClick={handleCopyReceiptNumber}
                      className="no-print text-slate-400 hover:text-[#214ECF] p-0.5 transition"
                      title="Copy receipt number"
                    >
                      {copiedReceiptNum ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  </div>
                  <div className="text-xs text-slate-600 flex items-center sm:justify-end gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    <span>{receipt.paymentDate} · {receipt.paymentTime}</span>
                  </div>
                </div>
              </div>

              {/* Two Column Contact Info (Issued By vs Issued To) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/60 rounded-xl p-4 border border-slate-100 text-xs">
                {/* Issued By */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                    <Building2 size={12} className="text-[#214ECF]" />
                    <span>Issued By</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{receipt.company.legalName}</div>
                  <div className="text-slate-600 leading-relaxed">
                    {receipt.company.address}
                  </div>
                  <div className="text-slate-600 pt-1 space-y-0.5">
                    <div><span className="text-slate-400">Email:</span> {receipt.company.email}</div>
                    <div><span className="text-slate-400">Phone:</span> {receipt.company.phone}</div>
                    <div><span className="text-slate-400">Web:</span> {receipt.company.website}</div>
                  </div>
                </div>

                {/* Issued To (Client) */}
                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-6">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                    <User size={12} className="text-[#214ECF]" />
                    <span>Billed To</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    {receipt.client.name}
                  </div>
                  {receipt.client.companyName && receipt.client.companyName !== receipt.client.name && (
                    <div className="font-semibold text-slate-700">{receipt.client.companyName}</div>
                  )}
                  <div className="text-slate-600 pt-1 space-y-0.5">
                    <div><span className="text-slate-400">Email:</span> {receipt.client.email}</div>
                    <div><span className="text-slate-400">Phone:</span> {receipt.client.phone || "—"}</div>
                    <div><span className="text-slate-400">Client ID:</span> <span className="font-mono text-[11px] text-slate-700">{receipt.client.id}</span></div>
                    <div><span className="text-slate-400">Region:</span> {receipt.client.country}</div>
                  </div>
                </div>
              </div>

              {/* Purchase Summary */}
              <div className="space-y-3">
                <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                  Service &amp; Package Description
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Item &amp; Description</th>
                        <th className="py-2.5 px-3">Billing Term</th>
                        <th className="py-2.5 px-3">Order Ref</th>
                        <th className="py-2.5 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-sm">
                            {receipt.purchase.packageName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 max-w-md leading-relaxed">
                            {receipt.purchase.packageDescription}
                          </div>
                          <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded">
                            Category: {receipt.purchase.packageCategory}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {receipt.purchase.billingType}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {receipt.purchase.orderReference}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          ${receipt.amountPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {receipt.currency}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakdown & Settlement */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
                {/* Payment Gateway Audit Safe Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs space-y-2 flex-1 w-full sm:w-auto">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CreditCard size={14} className="text-[#214ECF]" />
                    <span>Transaction Settlement Record</span>
                  </div>
                  <div className="space-y-1 text-slate-600 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Payment Gateway:</span>
                      <span className="font-medium text-slate-800">{receipt.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400">Capture / TXN ID:</span>
                      <span className="font-mono font-medium text-slate-800 flex items-center gap-1 truncate max-w-[200px]">
                        {receipt.transactionId}
                        <button
                          type="button"
                          onClick={handleCopyTxn}
                          className="no-print text-slate-400 hover:text-[#214ECF]"
                          title="Copy transaction ID"
                        >
                          {copiedTxn ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        </button>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Invoice Number:</span>
                      <span className="font-mono font-medium text-slate-800">{receipt.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Settlement Status:</span>
                      <span className="font-bold text-emerald-700">COMPLETED &amp; RECONCILED</span>
                    </div>
                  </div>
                </div>

                {/* Total Summary */}
                <div className="w-full sm:w-72 space-y-2 text-xs">
                  <div className="flex justify-between py-1 text-slate-600 border-b border-slate-100">
                    <span>Subtotal:</span>
                    <span>${receipt.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {receipt.currency}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600 border-b border-slate-100">
                    <span>Taxes &amp; Fees (0%):</span>
                    <span>${receipt.taxAmount.toFixed(2)} {receipt.currency}</span>
                  </div>
                  <div className="flex justify-between py-2 text-slate-900 font-extrabold text-base border-b-2 border-slate-300">
                    <span>Total Paid:</span>
                    <span className="text-[#214ECF]">
                      ${receipt.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {receipt.currency}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-emerald-700 font-bold">
                    <span>Balance Due:</span>
                    <span>$0.00 {receipt.currency}</span>
                  </div>
                </div>
              </div>

              {/* Security Watermark & Official Note */}
              <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <ShieldCheck size={15} />
                  <span>Authoritative Thinkatic Electronic Receipt · Verified via Database Ledger</span>
                </div>
                <div className="text-slate-400 font-mono text-[10px]">
                  Generated: {receipt.paymentTimestamp ? new Date(receipt.paymentTimestamp).toISOString() : new Date().toISOString()}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Controls (Hidden during print) */}
          <div className="no-print px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Need assistance? Contact{" "}
              <a href="mailto:Thinkaticai@gmail.com" className="text-[#214ECF] font-semibold hover:underline">
                Thinkaticai@gmail.com
              </a>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs cursor-pointer"
              >
                <Printer size={14} />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#214ECF] hover:bg-blue-700 text-xs font-bold text-white transition shadow-2xs cursor-pointer"
              >
                <Download size={14} />
                <span>Download HTML / PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
