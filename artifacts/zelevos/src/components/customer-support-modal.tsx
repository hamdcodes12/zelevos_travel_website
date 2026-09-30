import React, { useState, useEffect } from "react";
import { X, MessageSquare, Send, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface CustomerSupportModalProps {
  ticketId: string;
  onClose: () => void;
  onToast?: (msg: string) => void;
}

export function CustomerSupportModal({ ticketId, onClose, onToast }: CustomerSupportModalProps) {
  const [loading, setLoading] = useState(true);
  const [ticketData, setTicketData] = useState<any | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadTicket = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Unable to load support conversation.");
      }
      const data = await res.json();
      setTicketData(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load support ticket.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      void loadTicket();
    }
  }, [ticketId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setReplySending(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: replyText.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send reply.");
      }

      onToast?.("Your message has been sent to Zelevos Support.");
      setReplyText("");

      if (data.newMessage && ticketData) {
        setTicketData((prev: any) => ({
          ...prev,
          ticket: {
            ...prev.ticket,
            lastMessageAt: data.newMessage.createdAt,
            lastMessageBy: "CUSTOMER",
          },
          messages: [...(prev.messages || []), data.newMessage],
        }));
      }
    } catch (err: any) {
      onToast?.(err.message || "Failed to send message.");
    } finally {
      setReplySending(false);
    }
  };

  const ticket = ticketData?.ticket;
  const messages = ticketData?.messages || [];
  const booking = ticketData?.booking;

  return (
    <div
      id="customer-support-conversation-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden relative my-auto max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
              <MessageSquare size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-blue-100">
                  {ticket?.ticketNumber || "Support Conversation"}
                </span>
                {ticket?.status && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white border border-white/30">
                    {ticket.status}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-blue-200 block">
                Zelevos 24/7 Dedicated Concierge & Trip Assistance
              </span>
            </div>
          </div>
          <button
            type="button"
            id="close-support-conversation-btn"
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span className="text-sm font-semibold">Loading conversation history...</span>
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-slate-600">
            <AlertCircle size={28} className="text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            {/* Subject & Booking banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Subject</span>
                <strong className="text-sm text-slate-900 block mt-0.5">{ticket.subject}</strong>
              </div>
              {booking?.bookingId && (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Trip Booking</span>
                  <span className="font-mono font-bold text-blue-700 block mt-0.5">{booking.bookingId}</span>
                </div>
              )}
            </div>

            {/* Conversation Thread */}
            <div className="space-y-3">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
                Messages
              </span>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                    No replies yet. Our concierge team is reviewing your query.
                  </div>
                ) : (
                  messages.map((msg: any) => {
                    const isAdmin = msg.senderType === "ADMIN";
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isAdmin ? "items-start" : "items-end"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-sm ${
                            isAdmin
                              ? "bg-blue-50/90 border border-blue-200 text-slate-900 rounded-tl-sm"
                              : "bg-slate-900 text-white rounded-tr-sm"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-[10px] font-bold ${
                                isAdmin ? "text-blue-700" : "text-blue-300"
                              }`}
                            >
                              {isAdmin ? (msg.senderName || "Zelevos Support") : "You"}
                            </span>
                            <span
                              className={`text-[9px] ${
                                isAdmin ? "text-slate-400" : "text-slate-400"
                              }`}
                            >
                              {msg.createdAt
                                ? new Date(msg.createdAt).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed m-0 select-text">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Customer Reply Box (Section 18, 43: Continue existing conversation without duplicate tickets) */}
            <form onSubmit={handleSendReply} className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Continue Conversation
              </label>
              <textarea
                id="customer-reply-textarea"
                rows={3}
                required
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your response or follow-up question here..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400">
                  Sends reply directly to the assigned operations executive.
                </span>
                <button
                  type="submit"
                  id="customer-send-reply-btn"
                  disabled={replySending || !replyText.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5 transition cursor-pointer"
                >
                  {replySending ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send size={12} />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
