import React, { useState } from "react";
import {
  X,
  CreditCard,
  CheckCircle2,
  Calendar,
  Users,
  ShieldCheck,
  Plane,
  Tag,
  ArrowRight,
  Download,
  AlertCircle,
} from "lucide-react";
import type { PackageDetail } from "./package-detail-modal";
import type { AuthUser } from "./auth-dialog";

async function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return;
  const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay Checkout.")), { once: true });
    });
  } else {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Unable to load Razorpay Checkout. Check your internet connection."));
      document.body.appendChild(script);
    });
  }
  if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");
}

export function PackageCheckoutModal({
  pkg,
  user,
  onClose,
  onSuccess,
  onLogin,
}: {
  pkg: PackageDetail;
  user?: AuthUser | null;
  onClose: () => void;
  onSuccess: (bookingId: string) => void;
  onLogin?: () => void;
}) {
  const [step, setStep] = useState<"form" | "paying" | "success">("form");

  // Form Fields
  const [travelDate, setTravelDate] = useState("2026-10-15");
  const [adultsCount, setAdultsCount] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [infantsCount, setInfantsCount] = useState(0);
  const [roomsCount, setRoomsCount] = useState(1);

  // Lead traveller
  const [fullName, setFullName] = useState(user?.fullName || "Aarav Sharma");
  const [age, setAge] = useState(32);
  const [gender, setGender] = useState("Male");

  // Contact
  const [contactEmail, setContactEmail] = useState(user?.email || "aarav.sharma@example.com");
  const [contactPhone, setContactPhone] = useState("+91 98765 43210");

  // Flights, Special Requests & Referral
  const [flightRequired, setFlightRequired] = useState(false);
  const [specialRequests, setSpecialRequests] = useState("");
  const [referralCode, setReferralCode] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get("ref");
      if (ref) return ref;
      return sessionStorage.getItem("zelevos_partner_ref") || "";
    } catch {
      return "";
    }
  });

  // Result state
  const [createdBookingId, setCreatedBookingId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Calculate pricing
  const subtotal = pkg.sellingPrice * roomsCount;
  const serviceFee = pkg.serviceFee || 0;
  const totalPrice = subtotal + serviceFee;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStep("paying");
    setErrorMessage("");

    let razorpayOrderId = "";
    try {
      // 1. Create Booking in Zelevos master engine
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          packageId: pkg.id,
          travelDate,
          adultsCount: Number(adultsCount),
          childrenCount: Number(childrenCount),
          infantsCount: Number(infantsCount),
          roomsCount: Number(roomsCount),
          specialRequests: specialRequests.trim() || undefined,
          flightRequired,
          flightRequirementDetails: flightRequired
            ? {
                preferredRoute: `${pkg.locations?.[0] || pkg.destination?.name || "DEL"} Circuit`,
                preferredDates: travelDate,
                passengerNames: [fullName],
              }
            : undefined,
          referralCode: referralCode.trim() || undefined,
          customerContact: {
            name: fullName,
            email: contactEmail,
            phone: contactPhone,
          },
          travellers: [
            {
              fullName,
              age: Number(age),
              gender,
              isLead: true,
              contactPhone,
              contactEmail,
            },
          ],
        }),
      });

      if (res.status === 401) {
        setSubmitting(false);
        setStep("form");
        if (onLogin) {
          onLogin();
        } else {
          setErrorMessage("Please log in or create an account to book your holiday package.");
        }
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.bookingId) {
        throw new Error(data.message || "Failed to create booking.");
      }

      const masterBookingId = data.bookingId;

      // 2. Create a server-priced Razorpay order for this authenticated booking.
      const orderRes = await fetch("/api/payments/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bookingId: data.booking.id, idempotencyKey: `package-${masterBookingId}` }),
      });
      const orderData = await orderRes.json() as {
        orderId?: string;
        amountSubunits?: number;
        currency?: string;
        keyId?: string;
        provider?: string;
        message?: string;
      };
      if (!orderRes.ok || !orderData.orderId || !orderData.amountSubunits || !orderData.keyId || orderData.provider !== "razorpay") {
        throw new Error(orderData.message || "Razorpay order could not be created.");
      }
      razorpayOrderId = orderData.orderId;

      await loadRazorpayCheckout();
      const RazorpayCheckout = window.Razorpay;
      if (!RazorpayCheckout) throw new Error("Razorpay Checkout is unavailable.");
      const razorpayResponse = await new Promise<{ orderId: string; paymentId: string; signature: string }>((resolve, reject) => {
        const checkout = new RazorpayCheckout({
          key: orderData.keyId,
          amount: orderData.amountSubunits,
          currency: orderData.currency || "INR",
          name: "Zelevos",
          description: pkg.title,
          order_id: orderData.orderId,
          prefill: { name: fullName, email: contactEmail, contact: contactPhone },
          theme: { color: "#214ecf" },
          handler: (response: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string }) => {
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
          modal: { ondismiss: () => reject(new Error("Payment was cancelled.")) },
        });
        checkout.open();
      });

      const verifyRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(razorpayResponse),
      });
      const verifyData = await verifyRes.json() as { verified?: boolean; message?: string };
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.message || "Payment verification failed. No booking was confirmed.");
      }

      setCreatedBookingId(masterBookingId);
      setStep("success");
      onSuccess(masterBookingId);
    } catch (err: any) {
      if (razorpayOrderId) {
        void fetch("/api/payments/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orderId: razorpayOrderId, reason: err?.message || "Checkout was cancelled." }),
        }).catch(() => undefined);
      }
      setErrorMessage(err.message || "Checkout failed. Please try again.");
      setStep("form");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden relative my-auto">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex justify-between items-center">
          <div>
            <span className="text-xs uppercase font-bold tracking-widest text-blue-200">
              Zelevos Secure Checkout
            </span>
            <h3 className="text-lg font-bold truncate max-w-md">{pkg.title}</h3>
          </div>
          <button
            onClick={onClose}
            id="close-checkout-modal-btn"
            className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={handleCheckout} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} /> {errorMessage}
              </div>
            )}

            {/* Travel Date & Party */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Travel Start Date
                </label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="date"
                    id="checkout-travel-date"
                    required
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rooms Required
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  id="checkout-rooms-count"
                  value={roomsCount}
                  onChange={(e) => setRoomsCount(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Adults (12+)</label>
                <input
                  type="number"
                  min={1}
                  id="checkout-adults-count"
                  value={adultsCount}
                  onChange={(e) => setAdultsCount(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Children (2-11)</label>
                <input
                  type="number"
                  min={0}
                  id="checkout-children-count"
                  value={childrenCount}
                  onChange={(e) => setChildrenCount(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Infants (0-2)</label>
                <input
                  type="number"
                  min={0}
                  id="checkout-infants-count"
                  value={infantsCount}
                  onChange={(e) => setInfantsCount(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Lead Passenger Details */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-bold uppercase text-blue-700 tracking-wider block mb-2">
                Lead Guest Information
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    id="checkout-guest-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Age</label>
                  <input
                    type="number"
                    id="checkout-guest-age"
                    min={18}
                    required
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email for Confirmation</label>
                <input
                  type="email"
                  id="checkout-guest-email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">WhatsApp / Phone</label>
                <input
                  type="tel"
                  id="checkout-guest-phone"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Special Requests */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Special Requests (Optional)
              </label>
              <textarea
                id="checkout-special-requests"
                rows={2}
                placeholder="Dietary requirements, ground floor room, anniversary/honeymoon setup..."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Flights-without-API Checkbox (Acceptance criteria) */}
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="checkout-flight-required"
                  checked={flightRequired}
                  onChange={(e) => setFlightRequired(e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Plane size={14} /> Include Flights (Curated by Zelevos Operations)
                  </span>
                  <p className="text-slate-600 mt-0.5">
                    Tickets will be hand-booked by our team and uploaded under My Trips (subject to confirmation).
                  </p>
                </div>
              </label>
            </div>

            {/* Partner Referral Code */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Tag size={13} className="text-blue-600" /> Partner / Agent Referral Code (Optional)
              </label>
              <input
                type="text"
                id="checkout-referral-code"
                placeholder="e.g. VOYAGE10"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm uppercase tracking-wider font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Total Price Breakdown & Payment Button */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Package Base ({roomsCount} room{roomsCount > 1 ? "s" : ""})</span>
                  <span className="font-semibold text-slate-900">₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                {serviceFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Service Fee</span>
                    <span className="font-semibold text-slate-900">₹{serviceFee.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold">
                  <span className="text-sm text-slate-800">Total Payable (INR)</span>
                  <span className="text-2xl font-extrabold text-blue-900">
                    ₹{totalPrice.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                id="confirm-pay-btn"
                disabled={submitting}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-base transition"
              >
                <CreditCard size={18} /> Pay securely with Razorpay (₹{totalPrice.toLocaleString("en-IN")})
              </button>
              <p className="text-[11px] text-center text-slate-500 mt-2 flex items-center justify-center gap-1">
                <ShieldCheck size={13} className="text-emerald-600" /> Secure payment: Razorpay verifies every transaction on the server.
              </p>
            </div>
          </form>
        )}

        {step === "paying" && (
          <div className="p-12 text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto" />
            <h4 className="text-lg font-bold text-slate-900">
              Processing Payment with Razorpay...
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Creating your master travel record and allocating fulfillment tasks across verified suppliers.
            </p>
          </div>
        )}

        {step === "success" && (
          <div id="booking-success-screen" className="p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-emerald-600">
                Payment Confirmed
              </span>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                Your Holiday is Booked!
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                A confirmation has been sent to <strong>{contactEmail}</strong>.
              </p>
            </div>

            {/* CRITICAL: Acceptance criteria Zelevos Booking ID display */}
            <div className="p-4 bg-blue-50/80 border-2 border-blue-300 rounded-2xl">
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">
                Zelevos Master Booking ID
              </span>
              <span
                id="confirmed-booking-id"
                className="text-2xl sm:text-3xl font-mono font-extrabold text-blue-950 block mt-1 tracking-wider"
              >
                {createdBookingId}
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Format: ZL{new Date().toISOString().slice(2, 10).replace(/-/g, "")}XXXX
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href={`/api/bookings/${createdBookingId}/itinerary`}
                target="_blank"
                rel="noreferrer"
                id="download-itinerary-btn"
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition"
              >
                <Download size={16} /> Download Itinerary
              </a>
              <button
                id="view-in-my-trips-btn"
                onClick={() => {
                  onClose();
                  const tripsEl = document.querySelector("#my-trips");
                  if (tripsEl) tripsEl.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-blue-600/30"
              >
                View in My Trips <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
