import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MessageCircle,
  Send,
  User,
  Building,
  Clock,
  Check,
  CheckCheck,
  RotateCw,
  Plus,
  Search,
  AlertCircle,
  FileText,
  ChevronRight,
  X,
  Sparkles,
  ShieldCheck,
  Paperclip,
} from "lucide-react";

interface AgentConversationSectionProps {
  agent: any;
  token: string;
  onUnreadChange?: (count: number) => void;
  onNavigateTab?: (tab: string) => void;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_type: "agent" | "bpo_supervisor";
  sender_id: string;
  sender_name: string;
  message: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  read_at?: string | null;
  created_at: string;
}

interface Conversation {
  id: number;
  agent_id: number;
  partner_id: string;
  centre_id: number;
  subject: string;
  status: "open" | "resolved" | "archived";
  last_message_at: string;
  last_message_preview?: string;
  unread_agent_count: number;
  unread_bpo_count: number;
  created_at: string;
  updated_at: string;
  agent_name?: string;
  agent_code?: string;
  bpo_name?: string;
}

export const AgentConversationSection: React.FC<AgentConversationSectionProps> = ({
  agent,
  token,
  onUnreadChange,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [newTopicSubject, setNewTopicSubject] = useState("");
  const [newTopicMessage, setNewTopicMessage] = useState("");
  const [newTopicSubmitting, setNewTopicSubmitting] = useState(false);
  const [newTopicError, setNewTopicError] = useState("");
  const [sendError, setSendError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Fetch Conversations List
  const fetchConversations = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/agent/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const convList: Conversation[] = data.conversations || [];
        setConversations(convList);

        if (onUnreadChange && typeof data.unread_count === "number") {
          onUnreadChange(data.unread_count);
        }

        // Set default active conversation if none selected
        if (!activeConvId && convList.length > 0) {
          setActiveConvId(convList[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // 2. Fetch Messages for Active Conversation
  const fetchMessages = async (convId: number, silent = false) => {
    if (!token || !convId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/agent/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const incoming: Message[] = data.messages || [];
        setMessages((prev) => {
          const map = new Map();
          for (const m of prev) map.set(m.id, m);
          for (const m of incoming) map.set(m.id, m);
          return Array.from(map.values()).sort(
            (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });

        // Update local conversation unread count to 0
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unread_agent_count: 0 } : c))
        );

        if (!silent) {
          setTimeout(scrollToBottom, 100);
        }
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [token]);

  // When active conversation changes, load messages
  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
    }
  }, [activeConvId]);

  // Periodic polling for live message updates (every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(true);
      if (activeConvId) {
        fetchMessages(activeConvId, true);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeConvId, token]);

  const activeConv = useMemo(() => {
    return conversations.find((c) => c.id === activeConvId) || conversations[0] || null;
  }, [conversations, activeConvId]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text || !activeConvId || sending) return;

    setSending(true);
    setSendError("");

    try {
      const res = await fetch(`/api/agent/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessageText("");
        if (data.message) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === data.message.id);
            if (exists) return prev;
            return [...prev, data.message];
          });
          setTimeout(scrollToBottom, 50);
        }
        // Refresh conversations list to update preview and timestamp
        fetchConversations(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        setSendError(errData.error || "Message could not be sent. Please retry.");
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setSendError("Message could not be sent. Please retry.");
    } finally {
      setSending(false);
    }
  };

  // Create new conversation topic
  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewTopicError("");
    if (!newTopicSubject.trim()) {
      setNewTopicError("Subject is required.");
      return;
    }

    setNewTopicSubmitting(true);
    try {
      const res = await fetch("/api/agent/conversations/new", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: newTopicSubject.trim(),
          initial_message: newTopicMessage.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowNewTopicModal(false);
        setNewTopicSubject("");
        setNewTopicMessage("");
        await fetchConversations();
        if (data.conversation?.id) {
          setActiveConvId(data.conversation.id);
        }
      } else {
        const errData = await res.json();
        setNewTopicError(errData.error || "Failed to start conversation.");
      }
    } catch {
      setNewTopicError("Connection error while creating conversation.");
    } finally {
      setNewTopicSubmitting(false);
    }
  };

  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    const lower = searchTerm.toLowerCase();
    return conversations.filter(
      (c) =>
        c.subject.toLowerCase().includes(lower) ||
        c.last_message_preview?.toLowerCase().includes(lower)
    );
  }, [conversations, searchTerm]);

  return (
    <div className="space-y-6">
      {/* ── 1. HEADER BANNER ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#214ECF] mb-1">
            <MessageCircle className="w-3.5 h-3.5 text-[#214ECF]" />
            BPO Operations Communications
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Conversation with BPO
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Direct operational channel between you and your assigned BPO Partner supervisor. Real-time, secure, and logged for operational continuity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setRefreshing(true);
              fetchConversations().finally(() => setRefreshing(false));
            }}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh messages"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#214ECF] ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setShowNewTopicModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-sm shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Inquiry</span>
          </button>
        </div>
      </div>

      {/* ── 2. TWO-COLUMN OPERATIONAL CONVERSATION WORKSPACE ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Column: Conversation Threads (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col">
          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-[#214ECF] transition-all"
            />
          </div>

          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
            Active Topics ({filteredConversations.length})
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[560px] pr-1">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <RotateCw className="w-5 h-5 mx-auto animate-spin text-[#214ECF] mb-2" />
                Loading conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <MessageCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-700">No conversations found</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Start an operational inquiry with your BPO supervisor.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = activeConv?.id === conv.id;
                const hasUnread = (conv.unread_agent_count || 0) > 0;

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? "bg-blue-50/70 border-[#214ECF] shadow-xs"
                        : "bg-white border-slate-200/80 hover:border-blue-200 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-bold text-xs text-slate-900 truncate flex-1">
                        {conv.subject}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                        {conv.last_message_at
                          ? new Date(conv.last_message_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
                      {conv.last_message_preview || "No message history"}
                    </p>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                        <Building className="w-3 h-3 text-[#214ECF]" />
                        {conv.bpo_name || "BPO Supervisor"}
                      </span>

                      {hasUnread && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#214ECF] text-white font-bold text-[10px] animate-pulse">
                          {conv.unread_agent_count} new
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Room & Messages (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/90 bg-white shadow-xs flex flex-col overflow-hidden">
          {/* Chat Room Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-100/70 text-[#214ECF] flex items-center justify-center flex-shrink-0 font-bold">
                <Building className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {activeConv?.subject || "Operations Support & Shift Coordination"}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    BPO Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  Assigned Delivery Centre:{" "}
                  <strong className="text-slate-700">
                    Thinkatic Partner Centre #{agent?.centreId || 1}
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-[11px] font-bold text-[#214ECF] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full shadow-2xs">
                Conversation ID: #{activeConv?.id || 10005}
              </span>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[460px] bg-slate-50/30">
            {loadingMessages ? (
              <div className="py-20 text-center text-xs text-slate-400">
                <RotateCw className="w-6 h-6 mx-auto animate-spin text-[#214ECF] mb-2" />
                Loading conversation messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="py-20 text-center">
                <MessageCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No messages in this topic yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Type a message below to communicate directly with your BPO supervisor.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isAgent = msg.sender_type === "agent";

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2.5 ${isAgent ? "justify-end" : "justify-start"}`}
                  >
                    {!isAgent && (
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs">
                        <User className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[80%] sm:max-w-[70%] rounded-2xl p-4 text-xs shadow-xs leading-relaxed ${
                        isAgent
                          ? "bg-[#214ECF] text-white rounded-br-xs"
                          : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs"
                      }`}
                    >
                      <div
                        className={`text-[10px] font-bold mb-1 flex items-center justify-between gap-4 ${
                          isAgent ? "text-blue-100" : "text-[#214ECF]"
                        }`}
                      >
                        <span>{isAgent ? "You (Agent)" : msg.sender_name || "BPO Supervisor"}</span>
                        <span className={`font-mono text-[9px] ${isAgent ? "text-blue-200" : "text-slate-400"}`}>
                          {msg.created_at
                            ? new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>

                      <p className="whitespace-pre-wrap">{msg.message}</p>

                      {msg.attachment_url && (
                        <div
                          className={`mt-2 p-2 rounded-xl border flex items-center gap-2 text-[11px] ${
                            isAgent
                              ? "bg-blue-700/60 border-blue-400/40 text-white"
                              : "bg-slate-50 border-slate-200 text-slate-700"
                          }`}
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span className="truncate flex-1 font-mono">
                            {msg.attachment_name || "attachment_document"}
                          </span>
                        </div>
                      )}

                      <div
                        className={`mt-1.5 flex items-center justify-end gap-1 text-[9px] ${
                          isAgent ? "text-blue-200" : "text-slate-400"
                        }`}
                      >
                        {isAgent && (
                          <span className="inline-flex items-center gap-0.5">
                            {msg.read_at ? (
                              <>
                                <CheckCheck className="w-3 h-3 text-emerald-300" />
                                <span>Read by supervisor</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3 text-blue-200" />
                                <span>Sent</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Response Chips */}
          <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase flex-shrink-0">
              Quick Inquiries:
            </span>
            {[
              "Shift update completed",
              "Need SOP clarification on HIPAA",
              "Customer call escalated",
              "Attendance check-in inquiry",
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setMessageText(chip)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-blue-300 hover:text-[#214ECF] text-slate-600 font-medium transition-all whitespace-nowrap cursor-pointer shadow-2xs"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Message Input Box */}
          <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-slate-200/80 bg-white space-y-1.5">
            {sendError && (
              <div className="text-[11px] text-red-600 font-medium px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <span>{sendError}</span>
                <button type="button" onClick={() => setSendError("")} className="text-red-400 hover:text-red-700 font-bold">✕</button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Type your message to BPO operations supervisor... (Enter to send)"
                className="flex-1 px-4 py-3 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-[#214ECF] focus:ring-1 focus:ring-[#214ECF] transition-all"
                disabled={sending}
              />

              <button
                type="submit"
                disabled={!messageText.trim() || sending}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {sending ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send</span>
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── 3. NEW CONVERSATION TOPIC MODAL ─────────────────────────── */}
      {showNewTopicModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Start New Operational Topic</h3>
              </div>
              <button
                onClick={() => setShowNewTopicModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {newTopicError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{newTopicError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTopic} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject / Category <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shift Rescheduling Request, SOP Clarification"
                  value={newTopicSubject}
                  onChange={(e) => setNewTopicSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-[#214ECF]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Message (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide context or explanation for your supervisor..."
                  value={newTopicMessage}
                  onChange={(e) => setNewTopicMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-[#214ECF] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewTopicModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newTopicSubmitting || !newTopicSubject.trim()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                >
                  {newTopicSubmitting ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Topic</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
