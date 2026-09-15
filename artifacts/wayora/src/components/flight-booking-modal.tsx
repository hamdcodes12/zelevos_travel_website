import { useEffect, useState } from "react";
import {
  ArrowRight,
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Luggage,
  Mail,
  Phone,
  Plane,
  ShieldAlert,
  ShieldCheck,
  User,
  Utensils,
  X,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export type FlightOffer = {
  id: string;
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  stops: number;
  baggage: string;
  price: number;
  baseFare?: number;
  taxes?: number;
  provider: string;
  mode: "DEMO" | "LIVE";
  refundable?: boolean;
  cabinClass?: string;
  seatsAvailable?: number;
  segments?: Array<{
    carrier: string;
    flightNumber: string;
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    cabin: string;
    aircraft?: string;
  }>;
  fareRules?: {
    cancellationFee: number;
    changeFee: number;
  };
};

export type PassengerInput = {
  type: "ADULT" | "CHILD" | "INFANT";
  title: "Mr" | "Mrs" | "Ms" | "Dr" | "Master" | "Miss";
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  nationality: string;
  passportNumber?: string;
  passportExpiry?: string;
};

type Step = "revalidate" | "passengers" | "addons" | "review" | "payment" | "confirmed";

interface FlightBookingModalProps {
  flight: FlightOffer;
  travellerCount: number;
  initialStep?: Step;
  user?: any;
  onRequireAuth?: (onSuccess?: () => void, notice?: string) => void;
  onClose: () => void;
  onBookingSuccess: (booking: any) => void;
  onToast: (message: string) => void;
}

export function FlightBookingModal({
  flight,
  travellerCount = 1,
  initialStep = "revalidate",
  user = null,
  onRequireAuth,
  onClose,
  onBookingSuccess,
  onToast,
}: FlightBookingModalProps) {
  const [step, setStep] = useState<Step>(initialStep);
  const [revalidating, setRevalidating] = useState(true);
  const [revalResult, setRevalResult] = useState<any>(null);
  const [revalError, setRevalError] = useState("");
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

  // Price tracking (in case of reprice)
  const [currentPrice, setCurrentPrice] = useState(flight.price);
  const [extraBaggageKg, setExtraBaggageKg] = useState<number>(0);
  const [extraBaggagePrice, setExtraBaggagePrice] = useState<number>(0);
  const [mealPreference, setMealPreference] = useState<string>("Standard");
  const [seatPreference, setSeatPreference] = useState<string>("Any");

  // Passengers list initialized to travellerCount
  const [passengers, setPassengers] = useState<PassengerInput[]>(() => {
    const count = Math.max(1, travellerCount);
    return Array.from({ length: count }, (_, i) => ({
      type: i === 0 ? "ADULT" : "ADULT",
      title: "Mr",
      firstName: "",
      lastName: "",
      dateOfBirth: i === 0 ? "1992-05-15" : "1994-08-20",
      gender: "MALE",
      nationality: "IN",
    }));
  });

  // Contact Info
  const [contact, setContact] = useState({
    email: user?.email || "",
    phone: "",
    countryCode: "+91",
  });

  useEffect(() => {
    if (user?.email && !contact.email) {
      setContact((prev) => ({ ...prev, email: user.email }));
    }
  }, [user]);

  // Persist pending flight into sessionStorage for social OAuth survival
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "wayora_pending_flight",
        JSON.stringify({ flight, travellerCount })
      );
    } catch {
      // ignore
    }
  }, [flight, travellerCount]);

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [idempotencyKey] = useState(() => `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  // Step 1: Revalidate flight on open
  useEffect(() => {
    let isMounted = true;
    async function checkFlight() {
      setRevalidating(true);
      setRevalError("");
      try {
        const res = await fetch("/api/flights/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ offerId: flight.id, expectedPrice: flight.price }),
        });
        const data = await res.json();
        if (!res.ok || !data.valid) {
          throw new Error(data.message || "Flight is no longer available.");
        }
        if (isMounted) {
          setRevalResult(data);
          if (data.priceChanged && data.newPrice) {
            setCurrentPrice(data.newPrice);
          }
        }
      } catch (err) {
        if (isMounted) {
          setRevalError(err instanceof Error ? err.message : "Revalidation failed.");
        }
      } finally {
        if (isMounted) setRevalidating(false);
      }
    }
    void checkFlight();
    return () => { isMounted = false; };
  }, [flight.id]);

  const handlePassengerChange = (index: number, field: keyof PassengerInput, value: any) => {
    setPassengers(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addPassenger = () => {
    if (passengers.length >= 9) return;
    setPassengers(prev => [
      ...prev,
      {
        type: "ADULT",
        title: "Mr",
        firstName: "",
        lastName: "",
        dateOfBirth: "1995-01-01",
        gender: "MALE",
        nationality: "IN",
      },
    ]);
  };

  const removePassenger = (index: number) => {
    if (passengers.length <= 1) return;
    setPassengers(prev => prev.filter((_, i) => i !== index));
  };

  // Validate passenger age and required fields
  const validateTravellersAndContact = (): boolean => {
    const errors: string[] = [];
    const today = new Date();

    const adultCount = passengers.filter(p => p.type === "ADULT").length;
    const infantCount = passengers.filter(p => p.type === "INFANT").length;

    if (adultCount === 0) {
      errors.push("At least one Adult (12+ years) passenger is required.");
    }

    if (infantCount > adultCount) {
      errors.push("Number of infants cannot exceed the number of adult passengers.");
    }

    passengers.forEach((p, idx) => {
      const num = idx + 1;
      if (!p.firstName.trim()) errors.push(`Passenger ${num}: First name is required.`);
      if (!p.lastName.trim()) errors.push(`Passenger ${num}: Last name is required.`);
      if (!p.dateOfBirth) errors.push(`Passenger ${num}: Date of birth is required.`);

      const dob = new Date(p.dateOfBirth);
      if (isNaN(dob.getTime())) {
        errors.push(`Passenger ${num}: Invalid date of birth.`);
      } else {
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;

        if (p.type === "ADULT" && age < 12) {
          errors.push(`Passenger ${num} (${p.firstName || "Traveler"}): Adults must be 12 years or older (Age: ${age}).`);
        }
        if (p.type === "CHILD" && (age < 2 || age >= 12)) {
          errors.push(`Passenger ${num} (${p.firstName || "Traveler"}): Children must be between 2 and 11 years (Age: ${age}).`);
        }
        if (p.type === "INFANT" && age >= 2) {
          errors.push(`Passenger ${num} (${p.firstName || "Traveler"}): Infants must be under 2 years (Age: ${age}).`);
        }
      }
    });

    if (!contact.email.trim() || !contact.email.includes("@")) {
      errors.push("Please enter a valid contact email address.");
    }
    if (!contact.phone.trim() || contact.phone.replace(/\D/g, "").length < 7) {
      errors.push("Please enter a valid contact phone number.");
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleNextFromPassengers = () => {
    if (validateTravellersAndContact()) {
      setStep("addons");
    }
  };

  const handleBaggageChange = (kg: number, price: number) => {
    setExtraBaggageKg(kg);
    setExtraBaggagePrice(price);
  };

  const totalPayable = (currentPrice * passengers.length) + extraBaggagePrice;

  // Execute payment & booking confirmation
  const handlePaymentAndBooking = async () => {
    setProcessingPayment(true);
    setValidationErrors([]);
    let createdOrderId = "";
    let paymentVerified = false;

    try {
      // 1. Create payment order
      const orderRes = await fetch("/api/payments/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount: totalPayable,
          currency: "INR",
            offerId: flight.id,
            travellerCount: passengers.length,
            extraBaggageKg,
            idempotencyKey,
          notes: {
            flightNumber: flight.flightNumber,
            from: flight.from,
            to: flight.to,
              offerId: flight.id,
          },
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.message || "Failed to initiate payment order.");
      }
      createdOrderId = orderData.orderId;

      // 2. Handle payment flow (Live Razorpay vs Test Mode)
      let paymentDetails: { orderId: string; paymentId: string; signature: string };

      if (orderData.provider === "razorpay") {
        if (!orderData.keyId) {
          throw new Error("Razorpay public Key ID was not returned by the server. Please check backend credentials in .env.");
        }

        // Dynamically ensure Razorpay script is loaded if not already present
        if (!window.Razorpay) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Unable to load Razorpay checkout SDK. Please verify your internet connection."));
            document.head.appendChild(script);
          });
        }

        if (!window.Razorpay) {
          throw new Error("Razorpay payment SDK is unavailable.");
        }

        // Open native Razorpay modal - strictly requires valid Razorpay response, no mock fallback
        paymentDetails = await new Promise<{ orderId: string; paymentId: string; signature: string }>((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: orderData.keyId,
            amount: orderData.amountSubunits,
            currency: orderData.currency,
            name: "Zelevos Flights",
            description: `${flight.airline} ${flight.flightNumber} · ${flight.from} to ${flight.to}`,
            order_id: orderData.orderId,
            prefill: {
              name: `${passengers[0].firstName} ${passengers[0].lastName}`,
              email: contact.email,
              contact: contact.phone,
            },
            theme: { color: "#214ecf" },
            handler: function (response: any) {
              if (!response?.razorpay_payment_id || !response?.razorpay_signature) {
                reject(new Error("Incomplete payment response from Razorpay."));
                return;
              }
              resolve({
                orderId: response.razorpay_order_id || orderData.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
            },
             payment: {
               failed: function (response: any) {
                 reject(new Error(response?.error?.description || "Razorpay could not complete the payment."));
               },
             },
            modal: {
              ondismiss: function () {
                 reject(new Error("Payment checkout was cancelled before completing the transaction."));
              },
            },
          });
          rzp.open();
        });
      } else {
        // Test payment provider
        paymentDetails = {
          orderId: orderData.orderId,
          paymentId: `pay_test_${Date.now()}`,
          signature: "sig_test_valid",
        };
      }

      // 3. Verify the checkout response server-side before booking anything.
      // The backend checks the Razorpay HMAC and the account-owned order.
      const verifyRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(paymentDetails),
      });
      const verifyData = await verifyRes.json() as { verified?: boolean; message?: string };
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.message || "Payment verification failed. No booking was created.");
      }
      paymentVerified = true;

      // 4. Confirm Flight Booking on Backend
      const bookRes = await fetch("/api/flights/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          offerId: flight.id,
          passengers,
          contact,
          addons: {
            extraBaggageKg,
            extraBaggagePrice,
            mealPreference,
            seatPreference,
          },
          payment: paymentDetails,
          idempotencyKey,
        }),
      });

      const bookData = await bookRes.json();
      if (!bookRes.ok || !bookData.success) {
        throw new Error(bookData.message || "Airline booking could not be completed.");
      }

      setConfirmedBooking(bookData);
      setStep("confirmed");
      try {
        sessionStorage.removeItem("wayora_pending_flight");
      } catch {
        // ignore
      }
      onBookingSuccess(bookData);
      onToast(`Flight booked! PNR: ${bookData.pnr}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment or booking failed.";
      if (createdOrderId && !paymentVerified) {
        void fetch("/api/payments/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orderId: createdOrderId, reason: msg }),
        }).catch(() => undefined);
      }
      setValidationErrors([msg]);
      onToast(msg);
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div className="auth-backdrop" style={{ zIndex: 9999, overflowY: "auto", padding: "20px 10px" }}>
      <div
        className="auth-card"
        style={{
          width: "min(100%, 640px)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <button
          className="auth-close"
          aria-label="Close booking modal"
          onClick={onClose}
          style={{ position: "absolute", top: "16px", right: "16px" }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div>
          <div className="eyebrow" style={{ marginBottom: "6px" }}>
            <span className="eyebrow-line" />
            FLIGHT CHECKOUT · {flight.airline}
          </div>
          <h3 style={{ margin: "0 0 6px", fontSize: "22px" }}>
            {flight.from} → {flight.to}
          </h3>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "12px" }}>
            {flight.flightNumber} · Departure: {flight.departure} · Duration: {flight.duration} · {flight.baggage}
          </p>
        </div>

        {/* Step Tabs / Progress indicator */}
        <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
          {[
            { key: "revalidate", label: "1. Fare Details" },
            { key: "passengers", label: "2. Travellers" },
            { key: "addons", label: "3. Add-ons" },
            { key: "review", label: "4. Review & Pay" },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={step === "confirmed"}
              onClick={() => {
                if (s.key !== "revalidate" && !user) {
                  onRequireAuth?.(
                    () => setStep(s.key as Step),
                    "Please log in or create an account to continue with your flight booking."
                  );
                  return;
                }
                if (s.key === "review" && !validateTravellersAndContact()) return;
                setStep(s.key as Step);
              }}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "11px",
                fontWeight: step === s.key ? 800 : 500,
                color: step === s.key ? "var(--blue)" : "var(--muted)",
                borderBottom: step === s.key ? "2px solid var(--blue)" : "none",
                padding: "4px 8px",
                cursor: step === "confirmed" ? "not-allowed" : "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Validation Errors Notice */}
        {validationErrors.length > 0 && (
          <div className="auth-error" style={{ display: "grid", gap: "4px" }}>
            {validationErrors.map((err, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        {/* ---------------- STEP 1: REVALIDATE ---------------- */}
        {step === "revalidate" && (
          <div style={{ display: "grid", gap: "16px" }}>
            {revalidating ? (
              <div className="travel-state" style={{ padding: "30px 10px" }}>
                <span className="typing"><i /><i /><i /></span>
                <p style={{ marginTop: "12px" }}>Verifying live seat inventory & fare lock with airline...</p>
              </div>
            ) : revalError ? (
              <div className="auth-error">
                <AlertCircle size={16} />
                <strong>Flight Unavailable</strong>
                <p>{revalError}</p>
                <button className="button button-outline" onClick={onClose} style={{ marginTop: "8px" }}>
                  Choose another flight
                </button>
              </div>
            ) : (
              <>
                {revalResult?.priceChanged && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "12px", borderRadius: "8px", color: "#92400e" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
                      <AlertCircle size={16} /> Fare Update Notice
                    </div>
                    <p style={{ fontSize: "11px", margin: "4px 0 0" }}>{revalResult.message}</p>
                  </div>
                )}

                <div style={{ background: "var(--soft)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>Base Fare per Passenger</span>
                    <strong style={{ fontSize: "13px" }}>₹{Math.round(currentPrice * 0.82).toLocaleString("en-IN")}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>Taxes & Airline Fees</span>
                    <strong style={{ fontSize: "13px" }}>₹{Math.round(currentPrice * 0.18).toLocaleString("en-IN")}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>Cabin Class</span>
                    <strong style={{ fontSize: "13px" }}>{flight.cabinClass || "Economy"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>Baggage Allowance</span>
                    <strong style={{ fontSize: "13px" }}>{flight.baggage}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700 }}>Total per Traveller</span>
                    <strong style={{ fontSize: "15px", color: "var(--blue)" }}>₹{currentPrice.toLocaleString("en-IN")}</strong>
                  </div>
                </div>

                <div style={{ background: "var(--blue-surface)", padding: "12px", borderRadius: "8px", fontSize: "11px", color: "#1e3a8a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                  <span>
                    Price and seat locked. Refundable: {flight.refundable ? "Yes (standard airline fees apply)" : "Non-refundable"}.
                  </span>
                </div>

                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    if (!user) {
                      onRequireAuth?.(
                        () => setStep("passengers"),
                        "Please log in or create an account to continue with your flight booking."
                      );
                      return;
                    }
                    setStep("passengers");
                  }}
                  style={{ width: "100%", marginTop: "10px" }}
                >
                  Continue to Traveller Details <ArrowRight size={15} />
                </button>
              </>
            )}
          </div>
        )}

        {/* ---------------- STEP 2: PASSENGERS & CONTACT ---------------- */}
        {step === "passengers" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#344054" }}>
                TRAVELLERS ({passengers.length})
              </span>
              {passengers.length < 9 && (
                <button
                  type="button"
                  onClick={addPassenger}
                  style={{ border: "none", background: "none", color: "var(--blue)", fontSize: "11px", fontWeight: 700 }}
                >
                  + Add Another Traveller
                </button>
              )}
            </div>

            {passengers.map((p, idx) => (
              <div
                key={idx}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "14px",
                  background: "var(--soft)",
                  display: "grid",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--blue)" }}>
                    TRAVELLER {idx + 1}
                  </span>
                  {passengers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePassenger(idx)}
                      style={{ border: "none", background: "none", color: "var(--danger)", fontSize: "10px", fontWeight: 700 }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <label>
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px" }}>Passenger Type</span>
                    <select
                      value={p.type}
                      onChange={(e) => handlePassengerChange(idx, "type", e.target.value)}
                      style={{ width: "100%", height: "38px", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 8px", background: "white", fontSize: "11px" }}
                    >
                      <option value="ADULT">Adult (12+ years)</option>
                      <option value="CHILD">Child (2-11 years)</option>
                      <option value="INFANT">Infant (under 2 years)</option>
                    </select>
                  </label>

                  <label>
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px" }}>Title</span>
                    <select
                      value={p.title}
                      onChange={(e) => handlePassengerChange(idx, "title", e.target.value)}
                      style={{ width: "100%", height: "38px", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 8px", background: "white", fontSize: "11px" }}
                    >
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                      <option value="Master">Master</option>
                      <option value="Miss">Miss</option>
                      <option value="Dr">Dr</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <label>
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px" }}>First Name *</span>
                    <input
                      placeholder="e.g. Rohan"
                      value={p.firstName}
                      onChange={(e) => handlePassengerChange(idx, "firstName", e.target.value)}
                      style={{ width: "100%", height: "38px", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 10px", background: "white", fontSize: "11px" }}
                    />
                  </label>

                  <label>
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px" }}>Last Name *</span>
                    <input
                      placeholder="e.g. Kapoor"
                      value={p.lastName}
                      onChange={(e) => handlePassengerChange(idx, "lastName", e.target.value)}
                      style={{ width: "100%", height: "38px", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 10px", background: "white", fontSize: "11px" }}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <label>
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px" }}>Date of Birth (YYYY-MM-DD) *</span>
                    <input
                      type="date"
                      value={p.dateOfBirth}
                      onChange={(e) => handlePassengerChange(idx, "dateOfBirth", e.target.value)}
                      style={{ width: "100%", height: "38px", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 10px", background: "white", fontSize: "11px" }}
                    />
                  </label>

                  <label>
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px" }}>Gender</span>
                    <select
                      value={p.gender}
                      onChange={(e) => handlePassengerChange(idx, "gender", e.target.value)}
                      style={{ width: "100%", height: "38px", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 8px", background: "white", fontSize: "11px" }}
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}

            {/* Contact Details Section */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px", display: "grid", gap: "10px" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#344054" }}>
                TICKET & BOOKING CONTACT
              </span>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px" }}>
                <label>
                  <span style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px" }}>Email for E-Ticket *</span>
                  <div style={{ position: "relative" }}>
                    <input
                      type="email"
                      placeholder="traveller@zelevos.com"
                      value={contact.email}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })}
                      style={{ width: "100%", height: "38px", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 10px", background: "white", fontSize: "11px" }}
                    />
                  </div>
                </label>

                <label>
                  <span style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px" }}>Mobile Number *</span>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={contact.phone}
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    style={{ width: "100%", height: "38px", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 10px", background: "white", fontSize: "11px" }}
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              className="button button-primary"
              onClick={handleNextFromPassengers}
              style={{ width: "100%", marginTop: "8px" }}
            >
              Continue to Add-ons & Baggage <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* ---------------- STEP 3: ADD-ONS & SEATS ---------------- */}
        {step === "addons" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#344054", display: "block", marginBottom: "8px" }}>
                EXTRA CHECK-IN BAGGAGE
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                {[
                  { kg: 0, price: 0, label: "Standard (15 kg)" },
                  { kg: 5, price: 1200, label: "+5 kg (₹1,200)" },
                  { kg: 10, price: 2200, label: "+10 kg (₹2,200)" },
                ].map(opt => (
                  <button
                    key={opt.kg}
                    type="button"
                    onClick={() => handleBaggageChange(opt.kg, opt.price)}
                    style={{
                      padding: "12px 8px",
                      borderRadius: "8px",
                      border: extraBaggageKg === opt.kg ? "2px solid var(--blue)" : "1px solid var(--border)",
                      background: extraBaggageKg === opt.kg ? "var(--blue-surface)" : "white",
                      color: extraBaggageKg === opt.kg ? "var(--blue)" : "var(--text)",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Luggage size={16} style={{ margin: "0 auto 4px", display: "block" }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#344054", display: "block", marginBottom: "8px" }}>
                SEAT PREFERENCE
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                {["Window", "Aisle", "Extra Legroom", "Any"].map(seat => (
                  <button
                    key={seat}
                    type="button"
                    onClick={() => setSeatPreference(seat)}
                    style={{
                      padding: "10px 6px",
                      borderRadius: "8px",
                      border: seatPreference === seat ? "2px solid var(--blue)" : "1px solid var(--border)",
                      background: seatPreference === seat ? "var(--blue-surface)" : "white",
                      color: seatPreference === seat ? "var(--blue)" : "var(--text)",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {seat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#344054", display: "block", marginBottom: "8px" }}>
                MEAL PREFERENCE
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {["Vegetarian", "Non-Vegetarian", "Jain Meal", "Vegan", "Standard"].map(meal => (
                  <button
                    key={meal}
                    type="button"
                    onClick={() => setMealPreference(meal)}
                    style={{
                      padding: "10px 6px",
                      borderRadius: "8px",
                      border: mealPreference === meal ? "2px solid var(--blue)" : "1px solid var(--border)",
                      background: mealPreference === meal ? "var(--blue-surface)" : "white",
                      color: mealPreference === meal ? "var(--blue)" : "var(--text)",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Utensils size={14} style={{ margin: "0 auto 4px", display: "block" }} />
                    {meal}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                className="button button-outline"
                onClick={() => setStep("passengers")}
                style={{ flex: 1 }}
              >
                Back
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => setStep("review")}
                style={{ flex: 2 }}
              >
                Review Booking <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ---------------- STEP 4: REVIEW & PAY ---------------- */}
        {step === "review" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ background: "var(--soft)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border)", display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                <div>
                  <strong style={{ fontSize: "14px" }}>{flight.airline} · {flight.flightNumber}</strong>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                    {flight.from} → {flight.to} · {flight.departure} ({flight.duration})
                  </div>
                </div>
                <span className={`provider-badge ${flight.mode === "LIVE" ? "live" : ""}`}>
                  {flight.mode}
                </span>
              </div>

              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block" }}>Travellers:</span>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>
                  {passengers.map((p, i) => `${p.title} ${p.firstName} ${p.lastName} (${p.type})`).join(", ")}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block" }}>Contact:</span>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>
                  {contact.email} · {contact.phone}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block" }}>Add-ons:</span>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>
                  {extraBaggageKg > 0 ? `Extra baggage: +${extraBaggageKg} kg` : "Standard baggage"} · Seat: {seatPreference} · Meal: {mealPreference}
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            <div style={{ background: "var(--soft)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px" }}>
                <span>Flight fare ({passengers.length} × ₹{currentPrice.toLocaleString("en-IN")})</span>
                <strong>₹{(currentPrice * passengers.length).toLocaleString("en-IN")}</strong>
              </div>
              {extraBaggagePrice > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px" }}>
                  <span>Extra baggage (+{extraBaggageKg} kg)</span>
                  <strong>₹{extraBaggagePrice.toLocaleString("en-IN")}</strong>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid var(--border)", fontSize: "14px" }}>
                <strong>Total Payable Amount</strong>
                <strong style={{ color: "var(--blue)", fontSize: "16px" }}>₹{totalPayable.toLocaleString("en-IN")}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
              <button
                type="button"
                className="button button-outline"
                disabled={processingPayment}
                onClick={() => setStep("addons")}
                style={{ flex: 1 }}
              >
                Back
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={processingPayment}
                onClick={handlePaymentAndBooking}
                style={{ flex: 2 }}
              >
                {processingPayment ? (
                  <>Processing Payment...</>
                ) : (
                  <>
                    <CreditCard size={15} /> Pay ₹{totalPayable.toLocaleString("en-IN")} & Issue Ticket
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ---------------- STEP 5: CONFIRMED TICKET & PNR ---------------- */}
        {step === "confirmed" && confirmedBooking && (
          <div style={{ display: "grid", gap: "16px", textAlign: "center", padding: "10px 0" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#ecfdf5", color: "var(--success)", display: "grid", placeItems: "center", margin: "0 auto" }}>
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 style={{ margin: "0 0 6px", fontSize: "22px", color: "var(--text)" }}>
                Flight Confirmed! E-Ticket Issued
              </h3>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "12px" }}>
                Your airline reservation has been confirmed and saved to your Zelevos account.
              </p>
            </div>

            {/* Ticket Card */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "20px",
                background: "white",
                textAlign: "left",
                display: "grid",
                gap: "12px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed var(--border)", paddingBottom: "12px" }}>
                <div>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--muted)", letterSpacing: "0.1em" }}>AIRLINE PNR</span>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--blue)", letterSpacing: "0.05em" }}>
                    {confirmedBooking.pnr}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--muted)", letterSpacing: "0.1em" }}>E-TICKET #</span>
                  <div style={{ fontSize: "13px", fontWeight: 700 }}>
                    {confirmedBooking.ticketNumber}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "10px" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Departing</span>
                  <div style={{ fontSize: "16px", fontWeight: 800 }}>{flight.from}</div>
                  <div style={{ fontSize: "12px" }}>{flight.departure}</div>
                </div>
                <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
                  <Plane size={18} style={{ margin: "0 auto 4px", color: "var(--blue)" }} />
                  {flight.duration}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Arriving</span>
                  <div style={{ fontSize: "16px", fontWeight: 800 }}>{flight.to}</div>
                  <div style={{ fontSize: "12px" }}>{flight.arrival}</div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px", fontSize: "11px", color: "var(--muted)" }}>
                <div><strong>Airline:</strong> {flight.airline} ({flight.flightNumber})</div>
                <div><strong>Passengers:</strong> {passengers.map(p => `${p.title} ${p.firstName} ${p.lastName}`).join(", ")}</div>
                <div><strong>Total Paid:</strong> ₹{confirmedBooking.amount?.toLocaleString("en-IN") || totalPayable.toLocaleString("en-IN")}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  window.print();
                }}
                style={{ flex: 1 }}
              >
                Print Ticket Slip
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  onClose();
                  // scroll to My Trips
                  const myTripsEl = document.querySelector("#my-trips") || document.querySelector("#travel-hub");
                  myTripsEl?.scrollIntoView({ behavior: "smooth" });
                }}
                style={{ flex: 1 }}
              >
                View in My Bookings <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
