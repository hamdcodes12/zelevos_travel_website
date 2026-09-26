import React, { useState } from "react";
import { X, Sparkles, Calendar, Users, Wallet, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export function CustomTripModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"form" | "submitting" | "success">("form");

  // Form Fields
  const [destinations, setDestinations] = useState("");
  const [startDate, setStartDate] = useState("");
  const [durationDays, setDurationDays] = useState(6);
  const [travellersCount, setTravellersCount] = useState(2);
  const [budgetPerPerson, setBudgetPerPerson] = useState(45000);
  const [hotelPreference, setHotelPreference] = useState("4 Star / Boutique");
  const [transportPreference, setTransportPreference] = useState("Private Cab");
  const [specialRequests, setSpecialRequests] = useState("");

  // Contact
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [leadNumber, setLeadNumber] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/custom-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          destinations: destinations.split(",").map((d) => d.trim()).filter(Boolean),
          startDate,
          durationDays: Number(durationDays),
          travellersCount: Number(travellersCount),
          budgetPerPerson: Number(budgetPerPerson),
          hotelPreference,
          transportPreference,
          activitiesInterests: ["Nature", "Local Dining", "Scenic Drives"],
          specialRequests,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.request) {
        throw new Error(data.message || "Failed to submit custom request.");
      }

      setLeadNumber(data.request.leadNumber || `LEAD-${Date.now().toString().slice(-6)}`);
      setStep("success");
    } catch (err: any) {
      setErrorMessage(err.message || "Could not submit custom trip request.");
      setStep("form");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden relative my-auto">
        <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-amber-300" />
            <div>
              <h3 className="text-lg font-bold">Build My Trip — Custom Itinerary</h3>
              <p className="text-xs text-blue-200">Curated specifically for your travel style</p>
            </div>
          </div>
          <button
            onClick={onClose}
            id="close-custom-trip-btn"
            className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} /> {errorMessage}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Where would you like to travel?
              </label>
              <input
                type="text"
                id="custom-destinations-input"
                required
                value={destinations}
                onChange={(e) => setDestinations(e.target.value)}
                placeholder="e.g. Kashmir, Ladakh, Kerala, Rajasthan"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Travel Date</label>
                <input
                  type="date"
                  id="custom-start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  id="custom-duration-days"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Travellers Count</label>
                <input
                  type="number"
                  min={1}
                  id="custom-travellers-count"
                  value={travellersCount}
                  onChange={(e) => setTravellersCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Budget / Person (₹)</label>
                <input
                  type="number"
                  step={5000}
                  id="custom-budget-input"
                  value={budgetPerPerson}
                  onChange={(e) => setBudgetPerPerson(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Stay Preference</label>
                <select
                  value={hotelPreference}
                  onChange={(e) => setHotelPreference(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option>4 Star / Boutique</option>
                  <option>5 Star Luxury / Heritage</option>
                  <option>Homestays / Eco Cottages</option>
                  <option>Comfort 3 Star</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transport</label>
                <select
                  value={transportPreference}
                  onChange={(e) => setTransportPreference(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option>Private Cab</option>
                  <option>Self Drive SUV</option>
                  <option>Luxury Innova Crysta</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Special Requests</label>
              <textarea
                rows={2}
                id="custom-special-requests"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <span className="text-xs font-bold uppercase text-slate-500 tracking-wider block">
                Your Contact Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Your Name"
                  id="custom-contact-name"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <input
                  type="email"
                  placeholder="Email"
                  id="custom-contact-email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  id="custom-contact-phone"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              id="submit-custom-trip-btn"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-base transition"
            >
              Submit Custom Trip Request <ArrowRight size={18} />
            </button>
          </form>
        )}

        {step === "submitting" && (
          <div className="p-12 text-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mx-auto" />
            <p className="font-bold text-slate-800">Assigning to Zelevos Travel Specialist...</p>
          </div>
        )}

        {step === "success" && (
          <div id="custom-trip-success-view" className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h4 className="text-xl font-extrabold text-slate-900">Custom Trip Request Received!</h4>
              <p className="text-xs text-slate-600 mt-1">
                Your request has been logged and assigned to our curated operations desk.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block">
                Lead Reference Number
              </span>
              <span id="custom-trip-lead-number" className="text-2xl font-mono font-extrabold text-blue-900 mt-1 block">
                {leadNumber}
              </span>
            </div>
            <button
              onClick={onClose}
              id="close-custom-trip-success-btn"
              className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition text-sm"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
