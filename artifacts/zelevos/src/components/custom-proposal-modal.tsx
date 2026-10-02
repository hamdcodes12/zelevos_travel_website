import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Calendar,
  Users,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Clock,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

async function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return;
  const existing = document.querySelector<HTMLScriptElement>(
    'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
  );
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Unable to load Razorpay Checkout.")),
        { once: true }
      );
    });
  } else {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () =>
        reject(
          new Error("Unable to load Razorpay Checkout. Check your internet connection.")
        );
      document.body.appendChild(script);
    });
  }
  if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");
}

export type CustomProposalModalProps = {
  request: any;
  onClose: () => void;
  onSuccess?: (bookingId: string) => void;
  onToast: (msg: string) => void;
  user?: any;
};

export function CustomProposalModal({
  request,
  onClose,
  onSuccess,
  onToast,
  user,
}: CustomProposalModalProps) {
  const [currentStatus, setCurrentStatus] = useState<string>(request.status || "PROPOSAL_SENT");
  const [linkedBooking, setLinkedBooking] = useState<any>(request.booking || null);
  const [accepting, setAccepting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentSuccessDetails, setPaymentSuccessDetails] = useState<{
    receiptNumber?: string;
    paymentId?: string;
    bookingId?: string;
    amount?: number;
  } | null>(null);

  // If already paid:
  const isPaid = currentStatus === "PAID" || request.status === "PAID" || paymentSuccessDetails !== null;
  const isAccepted = currentStatus === "ACCEPTED" || currentStatus === "ACCEPTED_PENDING_PAYMENT";

  const handleAcceptProposal = async () => {
    setAccepting(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/custom-trips/${request.id}/accept`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.booking) {
        throw new Error(data.message || "Failed to accept trip proposal.");
      }
      setLinkedBooking(data.booking);
      setCurrentStatus("ACCEPTED");
      onToast("Proposal accepted! You can now proceed to secure payment.");
    } catch (err: any) {
      setErrorMessage(err.message || "Could not accept proposal. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const [cancelling, setCancelling] = useState(false);

  const handleCancelProposal = async () => {
    const reason = window.prompt("Please let us know your reason for cancelling:", "Change of travel plans");
    if (reason === null) return;
    setCancelling(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/custom-trips/${request.id}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || "Cancelled by traveler" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to cancel proposal.");
      setCurrentStatus("CANCELLED");
      onToast("Custom trip request cancelled.");
    } catch (err: any) {
      setErrorMessage(err.message || "Could not cancel proposal.");
    } finally {
      setCancelling(false);
    }
  };

  const handleDeclineProposal = async () => {
    if (!confirm("Are you sure you want to decline this proposal?")) return;
    setAccepting(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/custom-trips/${request.id}/decline`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to decline proposal.");
      setCurrentStatus("DECLINED");
      onToast("Proposal marked as declined.");
    } catch (err: any) {
      setErrorMessage(err.message || "Could not decline proposal.");
    } finally {
      setAccepting(false);
    }
  };

  const handlePayNow = async () => {
    const bookingId = linkedBooking?.id || request.bookingId;
    if (!bookingId) {
      setErrorMessage("No active booking associated with this proposal. Please accept first.");
      return;
    }

    setPaying(true);
    setErrorMessage("");

    try {
      // 1. Request authoritative Razorpay order from backend
      const orderRes = await fetch("/api/payments/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bookingId,
          idempotencyKey: `custom-trip-${request.id}-${bookingId}`,
        }),
      });

      const orderData = (await orderRes.json()) as {
        orderId?: string;
        amountSubunits?: number;
        currency?: string;
        keyId?: string;
        provider?: string;
        message?: string;
      };

      if (!orderRes.ok || !orderData.orderId || !orderData.amountSubunits || !orderData.keyId) {
        throw new Error(orderData.message || "Could not initiate secure payment order.");
      }

      await loadRazorpayCheckout();
      const RazorpayCheckout = window.Razorpay;
      if (!RazorpayCheckout) throw new Error("Razorpay Checkout is unavailable.");

      // 2. Open native Razorpay modal
      const razorpayResponse = await new Promise<{
        orderId: string;
        paymentId: string;
        signature: string;
      }>((resolve, reject) => {
        const checkout = new RazorpayCheckout({
          key: orderData.keyId,
          amount: orderData.amountSubunits,
          currency: orderData.currency || "INR",
          name: "Zelevos",
          description: request.proposalTitle || "Custom Trip Package",
          order_id: orderData.orderId,
          prefill: {
            name: request.customerName || user?.fullName || "",
            email: request.customerEmail || user?.email || "",
            contact: request.customerPhone || user?.phone || "",
          },
          theme: { color: "#2563eb" },
          handler: (response: {
            razorpay_order_id?: string;
            razorpay_payment_id?: string;
            razorpay_signature?: string;
          }) => {
            if (!response.razorpay_payment_id || !response.razorpay_signature) {
              reject(new Error("Razorpay returned an incomplete payment response."));
              return;
            }
            resolve({
              orderId: response.razorpay_order_id || orderData.orderId!,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
          },
          modal: {
            ondismiss: () => reject(new Error("Payment was cancelled. You can retry whenever you are ready.")),
          },
        });
        checkout.open();
      });

      // 3. Verify payment HMAC signature server-side
      const verifyRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(razorpayResponse),
      });

      const verifyData = (await verifyRes.json()) as {
        verified?: boolean;
        message?: string;
        booking?: any;
      };

      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.message || "Payment verification failed. No booking confirmed.");
      }

      setCurrentStatus("PAID");
      setPaymentSuccessDetails({
        receiptNumber: `REC-${linkedBooking?.bookingId || request.leadNumber}`,
        paymentId: razorpayResponse.paymentId,
        bookingId: linkedBooking?.bookingId || request.bookingId,
        amount: request.proposalAmount,
      });

      onToast("Payment verified successfully! Receipt has been generated.");
      if (onSuccess) {
        onSuccess(linkedBooking?.bookingId || request.bookingId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Payment could not be completed.");
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const bookingRef = linkedBooking?.bookingId || request.masterBookingId || request.bookingId;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden relative my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-300" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-200">
                {request.leadNumber}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold mt-1">
              {request.proposalTitle || "Custom Trip Itinerary & Proposal"}
            </h2>
          </div>
          <button
            onClick={onClose}
            id="close-custom-proposal-modal"
            className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* CANCELLATION BANNER */}
          {currentStatus === "CANCELLED" && (
            <div className="p-4 bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle size={18} className="text-slate-500 shrink-0" />
              <span>This custom trip request has been cancelled.</span>
            </div>
          )}

          {/* PAYMENT SUCCESS CARD */}
          {isPaid && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
                <CheckCircle2 size={22} className="text-emerald-600" />
                Payment Successful & Booking Confirmed!
              </div>
              <p className="text-xs sm:text-sm text-emerald-700">
                Your payment has been server-verified. Your personalized trip is now fully secured.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-white rounded-lg border border-emerald-100 text-xs">
                <div>
                  <span className="text-slate-500 block">Booking Reference</span>
                  <strong className="font-mono text-slate-800">{bookingRef || "Confirmed"}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Payment ID</span>
                  <strong className="font-mono text-slate-800">
                    {paymentSuccessDetails?.paymentId || request.paymentId || "Verified"}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Amount Paid</span>
                  <strong className="text-emerald-700 font-bold">
                    ₹{Number(request.proposalAmount || 0).toLocaleString("en-IN")}
                  </strong>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {bookingRef && (
                  <>
                    <a
                      href={`/api/bookings/${bookingRef}/receipt/download?download=true`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                    >
                      <Download size={14} /> Download Payment Receipt
                    </a>
                    <a
                      href={`/api/bookings/${bookingRef}/receipt`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold transition"
                    >
                      <ExternalLink size={14} /> View Tax Invoice
                    </a>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ACCEPTED / PAYMENT REQUIRED CARD */}
          {!isPaid && isAccepted && (
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm sm:text-base">
                  <CreditCard size={20} className="text-amber-600" />
                  Payment Required
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                  Accepted
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-700">
                Your custom trip proposal has been accepted! Please complete secure payment to lock in your reservations.
              </p>
              <div className="p-3 bg-white rounded-lg border border-amber-200 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-500 block">Amount Payable</span>
                  <span className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    ₹{Number(request.proposalAmount || 0).toLocaleString("en-IN")}
                  </span>
                  <span className="text-[11px] text-slate-400 block">Inclusive of applicable taxes & fees</span>
                </div>
                <button
                  type="button"
                  id="custom-trip-pay-now-btn"
                  disabled={paying}
                  onClick={handlePayNow}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 text-sm transition"
                >
                  <CreditCard size={16} />
                  {paying ? "Processing..." : "Pay Now"}
                </button>
              </div>
            </div>
          )}

          {/* Quick Specs Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                <MapPin size={14} className="text-blue-600" /> Destination
              </div>
              <div className="text-sm font-bold text-slate-800 mt-1">
                {request.destinations?.join(", ") || "Custom Destination"}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                <Calendar size={14} className="text-blue-600" /> Travel Date
              </div>
              <div className="text-sm font-bold text-slate-800 mt-1">
                {request.startDate || "Flexible Schedule"}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                <Clock size={14} className="text-blue-600" /> Duration
              </div>
              <div className="text-sm font-bold text-slate-800 mt-1">
                {request.durationDays ? `${request.durationDays} Days` : "6 Days"}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                <Users size={14} className="text-blue-600" /> Guests
              </div>
              <div className="text-sm font-bold text-slate-800 mt-1">
                {request.travellersCount ? `${request.travellersCount} Travellers` : "2 Travellers"}
              </div>
            </div>
          </div>

          {/* NOTE FROM ZELEVOS (ADMIN NOTE) - FULL TEXT */}
          {request.proposalNotes && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
                <Sparkles size={14} className="text-blue-600" /> Note from Zelevos
              </div>
              <p
                id="proposal-customer-admin-note"
                className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words"
              >
                {request.proposalNotes}
              </p>
            </div>
          )}

          {/* DAY-WISE ITINERARY */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>Day-Wise Travel Itinerary</span>
              <span className="text-xs text-slate-500 font-normal">
                {request.proposalItinerary?.length || 0} Days Planned
              </span>
            </h3>

            {(!request.proposalItinerary || request.proposalItinerary.length === 0) ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                Itinerary details are being polished by our team.
              </p>
            ) : (
              <div className="space-y-2">
                {request.proposalItinerary.map((day: any) => (
                  <div
                    key={day.day}
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs transition"
                  >
                    <div className="flex justify-between items-start">
                      <strong className="text-slate-900 font-bold text-sm">
                        Day {day.day}: {day.location || "Arrival & Discovery"}
                      </strong>
                      {day.date && <span className="text-slate-500">{day.date}</span>}
                    </div>
                    <div className="mt-1 text-slate-700 font-medium">
                      {day.activity || "Sightseeing & Experiences"}
                      {day.meal && (
                        <span className="ml-2 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {day.meal}
                        </span>
                      )}
                    </div>
                    {day.description && (
                      <p className="mt-2 text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {day.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PRICING BREAKDOWN */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pricing & Inclusions
            </h4>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600">Curated Trip Package</span>
              <span className="font-semibold text-slate-900">
                ₹{Number(request.proposalAmount || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>Taxes & GST</span>
              <span className="text-emerald-700 font-medium">Inclusive</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-base font-extrabold text-slate-900">
              <span>Final Total</span>
              <span className="text-blue-900">
                ₹{Number(request.proposalAmount || 0).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-white text-xs sm:text-sm font-semibold transition"
            >
              Close
            </button>
            {currentStatus !== "CANCELLED" && !isPaid && (
              <button
                type="button"
                id="custom-proposal-cancel-btn"
                disabled={cancelling || accepting || paying}
                onClick={handleCancelProposal}
                className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs sm:text-sm font-semibold transition"
              >
                {cancelling ? "Cancelling..." : "Cancel Request"}
              </button>
            )}
          </div>

          <div className="flex gap-2.5">
            {/* If PROPOSAL_SENT: can Decline or Accept */}
            {currentStatus === "PROPOSAL_SENT" && (
              <>
                <button
                  type="button"
                  id="custom-proposal-decline-btn"
                  disabled={accepting}
                  onClick={handleDeclineProposal}
                  className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs sm:text-sm font-semibold transition"
                >
                  Decline
                </button>
                <button
                  type="button"
                  id="custom-proposal-accept-btn"
                  disabled={accepting}
                  onClick={handleAcceptProposal}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 transition"
                >
                  {accepting ? "Accepting..." : "Accept Proposal"}
                  <ArrowRight size={15} />
                </button>
              </>
            )}

            {/* If ACCEPTED and not paid: Pay Now */}
            {isAccepted && !isPaid && (
              <button
                type="button"
                id="custom-proposal-footer-pay-btn"
                disabled={paying}
                onClick={handlePayNow}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 transition"
              >
                <CreditCard size={15} />
                {paying ? "Processing..." : `Pay Now (₹${Number(request.proposalAmount || 0).toLocaleString("en-IN")})`}
              </button>
            )}

            {/* If PAID: Done / View My Trips */}
            {isPaid && (
              <button
                type="button"
                id="custom-proposal-done-btn"
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-bold rounded-xl transition"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
