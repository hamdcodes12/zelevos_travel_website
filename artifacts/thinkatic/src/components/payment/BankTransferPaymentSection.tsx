import { useState, useEffect } from "react";
import {
  Building2,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  Globe2,
  Clock,
  ExternalLink,
  Info,
} from "lucide-react";

export type SupportedCurrency = "USD" | "GBP" | "EUR" | "INR";

interface BankAccountInfo {
  currency: SupportedCurrency;
  bank_name: string;
  bank_address: string;
  beneficiary: string;
  account_type?: string;
  account_number?: string;
  masked_account_number?: string;
  routing_aba?: string;
  swift?: string;
  sort_code?: string;
  iban?: string;
  bic?: string;
  is_available?: boolean;
  unavailable_message?: string;
}

interface BankTransferPaymentSectionProps {
  invoiceId: number | string;
  invoiceNumber: string;
  defaultCurrency?: string;
  balanceDue?: number;
  totalAmount?: number;
  apiFetch?: (endpoint: string, options?: RequestInit) => Promise<Response>;
}

export default function BankTransferPaymentSection({
  invoiceId,
  invoiceNumber,
  defaultCurrency = "USD",
  balanceDue,
  totalAmount,
  apiFetch,
}: BankTransferPaymentSectionProps) {
  const initialCurrency = (["USD", "GBP", "EUR", "INR"].includes(defaultCurrency?.toUpperCase())
    ? defaultCurrency.toUpperCase()
    : "USD") as SupportedCurrency;

  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>(initialCurrency);
  const [bankData, setBankData] = useState<BankAccountInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authenticated fetch wrapper (falls back to window.fetch with auth token)
  const doFetch = async (endpoint: string, options?: RequestInit) => {
    if (apiFetch) return apiFetch(endpoint, options);
    const token = localStorage.getItem("token") || localStorage.getItem("user_token") || localStorage.getItem("auth_token");
    return fetch(`/api${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers || {}),
      },
    });
  };

  // Load masked bank details for the selected currency
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setRevealed(false);
    setErrorMessage(null);

    const loadBankDetails = async () => {
      try {
        const res = await doFetch(
          `/invoices/${invoiceId}/bank-details?currency=${selectedCurrency}`
        );

        if (res.status === 404) {
          // Check fallback for BPO client portal route
          const bpoRes = await doFetch(
            `/client/invoices/${invoiceId}/bank-details?currency=${selectedCurrency}`
          );
          if (bpoRes.ok) {
            const data = await bpoRes.json();
            if (!isCancelled) {
              const acc = data.bank_account;
              setBankData({
                currency: acc.currency,
                bank_name: acc.bankName,
                bank_address: acc.bankAddress,
                beneficiary: acc.beneficiary,
                account_type: acc.accountType,
                masked_account_number: acc.maskedAccountNumber,
                routing_aba: acc.routingAba,
                swift: acc.swift,
                sort_code: acc.sortCode,
                iban: acc.iban,
                bic: acc.bic,
                is_available: acc.isAvailable,
                unavailable_message: acc.unavailableMessage,
              });
            }
            return;
          }
        }

        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            const acc = data.bank_account;
            setBankData({
              currency: acc.currency,
              bank_name: acc.bankName,
              bank_address: acc.bankAddress,
              beneficiary: acc.beneficiary,
              account_type: acc.accountType,
              masked_account_number: acc.maskedAccountNumber,
              routing_aba: acc.routingAba,
              swift: acc.swift,
              sort_code: acc.sortCode,
              iban: acc.iban,
              bic: acc.bic,
              is_available: acc.isAvailable,
              unavailable_message: acc.unavailableMessage,
            });
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          if (!isCancelled) {
            setErrorMessage(errData.message || errData.error || "Unable to load bank account details.");
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setErrorMessage(err.message || "Network error loading bank details.");
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadBankDetails();
    return () => {
      isCancelled = true;
    };
  }, [invoiceId, selectedCurrency]);

  // Request authorized reveal of full bank details
  const handleToggleReveal = async () => {
    if (revealed) {
      setRevealed(false);
      return;
    }

    setRevealing(true);
    setErrorMessage(null);

    try {
      let res = await doFetch(`/invoices/${invoiceId}/bank-details/reveal`, {
        method: "POST",
        body: JSON.stringify({ currency: selectedCurrency }),
      });

      if (res.status === 404) {
        res = await doFetch(`/client/invoices/${invoiceId}/bank-details/reveal`, {
          method: "POST",
          body: JSON.stringify({ currency: selectedCurrency }),
        });
      }

      if (res.ok) {
        const full = await res.json();
        setBankData((prev) =>
          prev
            ? {
                ...prev,
                account_number: full.account_number,
                iban: full.iban,
              }
            : null
        );
        setRevealed(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.message || err.error || "Failed to authorize reveal.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error revealing account number.");
    } finally {
      setRevealing(false);
    }
  };

  // Copy full/current bank details to clipboard
  const handleCopyDetails = async () => {
    if (!bankData || bankData.is_available === false) return;

    const displayAccount = revealed && bankData.account_number
      ? bankData.account_number
      : bankData.masked_account_number || "—";

    const lines = [
      `THINKATIC BPO WIRE TRANSFER DETAILS`,
      `----------------------------------------`,
      `Beneficiary Name: ${bankData.beneficiary}`,
      `Bank Name: ${bankData.bank_name}`,
      `Bank Address: ${bankData.bank_address}`,
      `Currency: ${bankData.currency}`,
      bankData.account_type ? `Account Type: ${bankData.account_type}` : null,
      bankData.routing_aba ? `Routing (ABA): ${bankData.routing_aba}` : null,
      bankData.swift ? `SWIFT / BIC: ${bankData.swift}` : null,
      bankData.sort_code ? `Sort Code: ${bankData.sort_code}` : null,
      bankData.iban ? `IBAN: ${revealed && bankData.account_number ? bankData.account_number : bankData.iban}` : null,
      bankData.bic ? `BIC: ${bankData.bic}` : null,
      `Account Number: ${displayAccount}`,
      `----------------------------------------`,
      `PAYMENT REFERENCE: ${invoiceNumber}`,
      `Important: Please include reference "${invoiceNumber}" in wire transfer remarks.`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);

      // Audit copy action (non-blocking)
      doFetch(`/invoices/${invoiceId}/bank-details/copy-audit`, {
        method: "POST",
        body: JSON.stringify({ currency: selectedCurrency }),
      }).catch(() => {
        doFetch(`/client/invoices/${invoiceId}/bank-details/copy-audit`, {
          method: "POST",
          body: JSON.stringify({ currency: selectedCurrency }),
        }).catch(() => {});
      });
    } catch {
      // Fallback
    }
  };

  const amountDisplay = balanceDue !== undefined
    ? Number(balanceDue).toFixed(2)
    : totalAmount !== undefined
    ? Number(totalAmount).toFixed(2)
    : null;

  return (
    <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-b from-blue-50/70 to-white p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header & Payment Method */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#214ECF] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Building2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                Bank Transfer / Wire Payment
              </h4>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <ShieldCheck size={11} /> Verified Account
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct institutional wire instructions for enterprise settlements.
            </p>
          </div>
        </div>

        {amountDisplay && (
          <div className="text-left sm:text-right bg-white sm:bg-transparent px-3 py-2 sm:p-0 rounded-xl border sm:border-0 border-blue-100">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
              Payable Balance
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-slate-900">
              ${amountDisplay} <span className="text-xs font-semibold text-slate-500">{defaultCurrency}</span>
            </span>
          </div>
        )}
      </div>

      {/* Prominent Payment Reference Callout */}
      <div className="rounded-xl bg-blue-900 text-white p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="space-y-0.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-blue-300 font-bold block">
            Mandatory Wire Reference
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base sm:text-lg font-black tracking-wide text-white">
              {invoiceNumber}
            </span>
          </div>
          <p className="text-[11px] text-blue-200">
            Include this exact reference in your bank transfer narration/memo to ensure automated reconciliation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(invoiceNumber);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
          <span>{copied ? "Copied" : "Copy Ref"}</span>
        </button>
      </div>

      {/* Currency Selector Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Globe2 size={13} className="text-blue-600" />
            Select Settlement Currency:
          </label>
          <span className="text-[11px] text-slate-500">
            Accounts mapped per jurisdiction
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {(["USD", "GBP", "EUR", "INR"] as SupportedCurrency[]).map((curr) => {
            const isSelected = selectedCurrency === curr;
            return (
              <button
                key={curr}
                type="button"
                onClick={() => setSelectedCurrency(curr)}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer border ${
                  isSelected
                    ? "bg-[#214ECF] text-white border-[#214ECF] shadow-sm shadow-blue-900/20"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-blue-300"
                }`}
              >
                <span className="text-sm font-black font-mono">{curr}</span>
                <span className={`text-[10px] font-normal ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                  {curr === "USD" ? "USA" : curr === "GBP" ? "UK" : curr === "EUR" ? "Luxembourg" : "India"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          <div className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
          <p>Retrieving authorized bank transfer details...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Error Loading Bank Account</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* INR Unavailable Banner */}
      {!loading && bankData && bankData.is_available === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-xs text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <Info size={16} className="text-amber-700 shrink-0" />
            <span>INR Bank Transfer Unavailable</span>
          </div>
          <p className="text-amber-800 leading-relaxed font-medium">
            {bankData.unavailable_message ||
              "INR payment account details are currently unavailable. Please contact Thinkatic Finance."}
          </p>
          <div className="pt-2">
            <a
              href="/contact"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors"
            >
              <span>Contact Finance Desk</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      {/* Active Bank Details Card */}
      {!loading && bankData && bankData.is_available !== false && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-blue-600 tracking-wider">
                {bankData.currency} Wire Settlement Account
              </span>
              <h5 className="text-base font-black text-slate-900">
                {bankData.bank_name}
              </h5>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Beneficiary
              </span>
              {/* STRICT REQUIREMENT: Must show configured beneficiary HEALWEAL LLC */}
              <span className="text-xs sm:text-sm font-black text-blue-900 font-mono">
                {bankData.beneficiary}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Bank Address
              </span>
              <p className="text-slate-700 font-medium leading-snug">
                {bankData.bank_address}
              </p>
            </div>

            {bankData.account_type && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Account Type
                </span>
                <p className="text-slate-900 font-bold font-mono">
                  {bankData.account_type}
                </p>
              </div>
            )}

            {bankData.routing_aba && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Routing (ABA)
                </span>
                <p className="text-slate-900 font-bold font-mono">
                  {bankData.routing_aba}
                </p>
              </div>
            )}

            {bankData.swift && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  SWIFT / BIC
                </span>
                <p className="text-slate-900 font-bold font-mono">
                  {bankData.swift}
                </p>
              </div>
            )}

            {bankData.sort_code && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Sort Code
                </span>
                <p className="text-slate-900 font-bold font-mono">
                  {bankData.sort_code}
                </p>
              </div>
            )}

            {bankData.bic && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  BIC
                </span>
                <p className="text-slate-900 font-bold font-mono">
                  {bankData.bic}
                </p>
              </div>
            )}

            {bankData.iban && (
              <div className="space-y-1 sm:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  IBAN
                </span>
                <p className="text-slate-900 font-bold font-mono text-sm tracking-wider">
                  {revealed && bankData.account_number ? bankData.account_number : bankData.iban}
                </p>
              </div>
            )}

            {/* Account Number with Masking / Reveal */}
            <div className="space-y-1 sm:col-span-2 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Account Number
                </span>
                <span className="text-[10px] font-medium text-slate-400">
                  {revealed ? "Full details authorized" : "Default masked for security"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 mt-1">
                <span className="font-mono text-base sm:text-lg font-black text-slate-900 tracking-wider">
                  {revealed && bankData.account_number
                    ? bankData.account_number
                    : bankData.masked_account_number || "—"}
                </span>

                <button
                  type="button"
                  onClick={handleToggleReveal}
                  disabled={revealing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {revealing ? (
                    <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  ) : revealed ? (
                    <EyeOff size={13} />
                  ) : (
                    <Eye size={13} />
                  )}
                  <span>{revealed ? "Mask Details" : "Show Full Bank Details"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons: Copy Details */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Clock size={12} className="text-blue-600" />
              <span>International wire clearance typically takes 1–3 business days.</span>
            </div>

            <button
              type="button"
              onClick={handleCopyDetails}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1A3DB3] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
              <span>{copied ? "Bank Details Copied!" : "Copy Bank Details"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Settlement Lifecycle Notice */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 text-[11px] text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700 flex items-center gap-1.5">
          <Info size={12} className="text-blue-600 shrink-0" />
          Settlement Confirmation Policy
        </p>
        <p className="leading-relaxed">
          Invoice status remains <b>Pending / Awaiting Payment</b> until Thinkatic Finance audits and reconciles the credit with our clearing institution. You will receive an automated receipt once cleared.
        </p>
      </div>
    </div>
  );
}
