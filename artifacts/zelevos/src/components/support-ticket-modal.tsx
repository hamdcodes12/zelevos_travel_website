import React, { useState } from "react";
import { X, MessageSquare, CheckCircle2, AlertCircle, ArrowRight, Clock } from "lucide-react";

export function SupportTicketModal({
  onClose,
  bookingId,
  initialSubject,
}: {
  onClose: () => void;
  bookingId?: string;
  initialSubject?: string;
}) {
  const [step, setStep] = useState<"form" | "submitting" | "success">("form");

  const [name, setName] = useState("Aarav Sharma");
  const [email, setEmail] = useState("aarav.sharma@example.com");
  const [subject, setSubject] = useState(
    initialSubject || (bookingId ? `Support inquiry for Booking ${bookingId}` : "Question about trip itinerary or transfer")
  );
  const [description, setDescription] = useState(
    "Could we please request assistance regarding our itinerary schedule and pickup coordination?"
  );
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");

  const [ticketNumber, setTicketNumber] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          email,
          subject,
          description,
          priority,
          bookingId: bookingId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ticketNumber) {
        throw new Error(data.message || "Failed to submit support ticket.");
      }

      setTicketNumber(data.ticketNumber);
      setStep("success");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit support request.");
      setStep("form");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden relative my-auto">
        <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} />
            <h3 className="text-base font-bold">Zelevos 24/7 Concierge & Support</h3>
          </div>
          <button
            onClick={onClose}
            id="close-support-modal-btn"
            className="p-1 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={15} /> {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Your Name</label>
                <input
                  type="text"
                  id="support-name-input"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  id="support-email-input"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                id="support-subject-input"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
              <select
                id="support-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="LOW">Low — General Inquiry</option>
                <option value="MEDIUM">Medium — Active Trip Planning</option>
                <option value="HIGH">High — Booking Change</option>
                <option value="URGENT">Urgent — Live On-Ground Support</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">How can we help?</label>
              <textarea
                rows={3}
                id="support-description-input"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-blue-50 rounded-xl flex items-center gap-2 text-xs text-blue-900">
              <Clock size={15} className="text-blue-600 flex-shrink-0" />
              <span>Dedicated operations team response SLA: &lt; 15 minutes.</span>
            </div>

            <button
              type="submit"
              id="submit-support-ticket-btn"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-sm transition"
            >
              Submit Support Ticket <ArrowRight size={16} />
            </button>
          </form>
        )}

        {step === "submitting" && (
          <div className="p-10 text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mx-auto" />
            <p className="font-semibold text-slate-800 text-sm">Opening support ticket...</p>
          </div>
        )}

        {step === "success" && (
          <div id="support-ticket-success-view" className="p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900">Support Ticket Created</h4>
              <p className="text-xs text-slate-600 mt-1">Our team is actively reviewing your request.</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
                Ticket Number
              </span>
              <span id="support-ticket-number" className="text-xl font-mono font-extrabold text-blue-900 mt-0.5 block">
                {ticketNumber}
              </span>
            </div>
            <button
              onClick={onClose}
              id="close-support-success-btn"
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl transition text-xs"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
