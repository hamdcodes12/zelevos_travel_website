import React, { useState } from "react";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  Briefcase,
  GraduationCap,
  AlertCircle,
  ShieldCheck,
  MessageCircle,
  Target,
  FileText,
  XCircle,
  Volume2,
} from "lucide-react";

interface AgentNotificationsSectionProps {
  notifications: any[];
  onMarkAsRead: (id: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onNavigateTab?: (tab: string) => void;
}

export const AgentNotificationsSection: React.FC<AgentNotificationsSectionProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateTab,
}) => {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleRead = async (id: string) => {
    setLoadingAction(id);
    try {
      await onMarkAsRead(id);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReadAll = async () => {
    setLoadingAction("all");
    try {
      await onMarkAllAsRead();
    } finally {
      setLoadingAction(null);
    }
  };

  const handleNotificationClick = async (item: any) => {
    if (!item.read) {
      await handleRead(item.id);
    }
    if (onNavigateTab) {
      if (item.type === "bpo_message") {
        onNavigateTab("bpo-conversation");
      } else if (item.type === "project_assignment" || item.type === "target_update") {
        onNavigateTab("project");
      } else if (item.type === "training_reminder" || item.type === "new_training") {
        onNavigateTab("training");
      } else if (item.type === "document_request" || item.type === "document_published") {
        onNavigateTab("documents");
      } else if (item.type === "attendance_reminder" || item.type === "attendance_verified") {
        onNavigateTab("attendance");
      }
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "bpo_message":
        return <MessageCircle className="w-4 h-4 text-[#214ECF]" />;
      case "project_assignment":
        return <Briefcase className="w-4 h-4 text-[#214ECF]" />;
      case "training_reminder":
      case "new_training":
        return <GraduationCap className="w-4 h-4 text-purple-600" />;
      case "document_request":
        return <FileText className="w-4 h-4 text-amber-600" />;
      case "document_published":
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case "document_rejected":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "attendance_reminder":
      case "attendance_verified":
        return <Clock className="w-4 h-4 text-amber-600" />;
      case "target_update":
        return <Target className="w-4 h-4 text-indigo-600" />;
      case "bpo_announcement":
        return <Volume2 className="w-4 h-4 text-[#214ECF]" />;
      default:
        return <Bell className="w-4 h-4 text-[#214ECF]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#214ECF] mb-1">
            <Bell className="w-3.5 h-3.5 text-[#214ECF]" />
            Frontline Operational Alerts
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Notifications Feed
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative operational alerts sent by your BPO partner, supervisor, and compliance team.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleReadAll}
              disabled={loadingAction === "all"}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-[#214ECF] hover:bg-[#214ECF] hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            >
              <CheckCheck className="w-4 h-4" />
              <span>{loadingAction === "all" ? "Marking All..." : "Mark All as Read"}</span>
            </button>
          )}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                filter === "all" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                filter === "unread" ? "bg-white text-[#214ECF] shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>
      </div>

      {/* ── NOTIFICATIONS LIST ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-700">No Notifications</div>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {filter === "unread"
                ? "You have caught up with all active alerts!"
                : "No operational alerts have been dispatched to your account yet."}
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNotificationClick(item)}
              className={`p-5 flex items-start justify-between gap-4 transition-colors cursor-pointer ${
                !item.read ? "bg-blue-50/40 hover:bg-blue-50/60" : "bg-white hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    !item.read ? "bg-blue-100/70" : "bg-slate-100"
                  }`}
                >
                  {getIconForType(item.type)}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm ${!item.read ? "font-black text-slate-900" : "font-bold text-slate-800"}`}>
                      {item.title}
                    </h3>
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-[#214ECF] animate-pulse" title="Unread notification" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.message}</p>
                  <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-2 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.created_at ? new Date(item.created_at).toLocaleString() : "Just now"}
                    </span>
                    <span className="text-[#214ECF] hover:underline font-sans font-semibold">
                      Click to view →
                    </span>
                  </div>
                </div>
              </div>

              {!item.read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRead(item.id);
                  }}
                  disabled={loadingAction === item.id}
                  className="text-xs font-semibold text-[#214ECF] hover:underline p-1.5 flex-shrink-0 cursor-pointer"
                >
                  {loadingAction === item.id ? "..." : "Mark Read"}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
