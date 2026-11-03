// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — AUTOSAVE STATUS BADGE
// Small professional indicator displaying real-time autosave states without
// obstructing or freezing the form interface.
// ==============================================================================

import React from "react";
import { Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";
import type { AutosaveStatus } from "@/hooks/useAutosaveForm";

interface AutosaveStatusBadgeProps {
  status: AutosaveStatus;
  onRetry?: () => void;
  className?: string;
  errorMessage?: string | null;
}

export default function AutosaveStatusBadge({
  status,
  onRetry,
  className = "",
  errorMessage,
}: AutosaveStatusBadgeProps) {
  if (status === "idle") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 shadow-2xs backdrop-blur-xs transition-all ${className}`}
        aria-live="polite"
        title="Form state is synchronized with server"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        <span>Ready</span>
      </div>
    );
  }

  if (status === "unsaved") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50/90 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 shadow-2xs backdrop-blur-xs transition-all animate-in fade-in duration-200 ${className}`}
        aria-live="polite"
        title="Unsaved changes will automatically save after 5 seconds of inactivity"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span>Unsaved changes</span>
      </div>
    );
  }

  if (status === "saving") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/90 px-2.5 py-0.5 text-[11px] font-medium text-[#214ECF] shadow-2xs backdrop-blur-xs transition-all animate-in fade-in duration-200 ${className}`}
        aria-live="assertive"
        title="Persisting data authoritatively to PostgreSQL/Supabase"
      >
        <Loader2 size={12} className="animate-spin text-[#214ECF]" />
        <span>Saving...</span>
      </div>
    );
  }

  if (status === "saved") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 shadow-2xs backdrop-blur-xs transition-all animate-in fade-in duration-200 ${className}`}
        aria-live="polite"
        title="Authoritatively saved to database"
      >
        <Check size={12} className="text-emerald-600 stroke-[2.5]" />
        <span>Saved just now</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700 shadow-2xs transition-all animate-in fade-in duration-200 ${className}`}
        aria-live="assertive"
        title={errorMessage || "Unable to save to database"}
      >
        <AlertCircle size={12} className="text-rose-600 shrink-0" />
        <span>Unable to save —</span>
        {onRetry && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRetry();
            }}
            className="inline-flex items-center gap-1 font-bold underline hover:text-rose-900 cursor-pointer focus:outline-hidden"
          >
            <RefreshCw size={10} className="shrink-0" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return null;
}
