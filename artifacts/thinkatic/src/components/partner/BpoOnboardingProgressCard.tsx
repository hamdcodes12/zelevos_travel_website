// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — BPO ONBOARDING PROGRESS CARD
// World-class enterprise card displaying progressive setup status, weighted milestones,
// 24-hour final review state, and resume actions. Authoritative data from Supabase.
// ==============================================================================

import { useState } from "react";
import { useLocation } from "wouter";
import {
  Building2,
  MapPin,
  Cpu,
  Layers,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Clock,
  Lock,
  FileCheck,
  AlertTriangle,
  Info,
} from "lucide-react";

export interface Milestone {
  key: string;
  label: string;
  status: "Complete" | "In Progress" | "Required" | "Pending" | "Needs Correction" | "Locked" | string;
  completed: boolean;
  isRequired?: boolean;
  isLocked?: boolean;
  actionUrl?: string | null;
  correctionReason?: string | null;
  description?: string;
}

export interface OnboardingSummary {
  progressPercent: number;
  progressPercentage?: number;
  completedStages?: number;
  totalStages?: number;
  currentStage?: string;
  nextActionStage?: string;
  isComplete: boolean;
  isUnder24HourReview: boolean;
  reviewNotice?: string;
  milestones: Milestone[];
  stages?: Milestone[];
  missingItems?: string[];
  nextStepUrl?: string;
  primaryCorrection?: {
    stage: string;
    label: string;
    reason: string;
    actionUrl: string;
  } | null;
}

interface Props {
  summary?: OnboardingSummary | null;
  accountState?: string;
  companyName?: string;
  onNavigateToTab?: (tab: string) => void;
}

const MILESTONE_ICONS: Record<string, any> = {
  account: CheckCircle2,
  company: Building2,
  centre: MapPin,
  infrastructure: Cpu,
  experience: Layers,
  documents: FileText,
  verification: ShieldCheck,
  agreement: FileCheck,
  approval: Sparkles,
};

export default function BpoOnboardingProgressCard({
  summary,
  accountState,
  companyName,
  onNavigateToTab,
}: Props) {
  const [, setLocation] = useLocation();
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);

  if (!summary) return null;

  // Real dynamic percentage calculated from backend state (never hardcoded)
  const progressPercent = summary.progressPercentage ?? summary.progressPercent ?? 0;
  const { isUnder24HourReview, nextStepUrl = "/partner/apply", primaryCorrection } = summary;
  const milestones = summary.stages || summary.milestones || [];
  const completedStages = summary.completedStages ?? milestones.filter((m) => m.completed).length;
  const totalStages = summary.totalStages ?? 9;

  // Handle intelligent navigation
  const navigateToUrl = (targetUrl?: string | null) => {
    if (!targetUrl) return;

    if (targetUrl.includes("?tab=")) {
      const targetTab = targetUrl.split("?tab=")[1];
      if (onNavigateToTab) {
        onNavigateToTab(targetTab);
        return;
      }
    }

    if (targetUrl.startsWith("/partner/apply")) {
      window.location.href = targetUrl;
      return;
    }

    setLocation(targetUrl);
  };

  const handleContinue = () => {
    navigateToUrl(nextStepUrl);
  };

  const handleCardClick = (m: Milestone) => {
    if (m.status === "Locked" || m.isLocked) {
      setLockedNotice(`"${m.label}" is currently locked. Complete the earlier stages to unlock.`);
      setTimeout(() => setLockedNotice(null), 4000);
      return;
    }

    if (m.key === "approval") {
      if (isUnder24HourReview || accountState === "FINAL_REVIEW") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    navigateToUrl(m.actionUrl || nextStepUrl);
  };

  // ── 24-HOUR FINAL REVIEW STATE ─────────────────────────────────────────────
  if (isUnder24HourReview || accountState === "FINAL_REVIEW" || accountState === "AGREEMENT_SUBMITTED") {
    return (
      <div className="relative overflow-hidden rounded-3xl border-2 border-blue-600/30 bg-gradient-to-br from-[#0c1a40] via-[#10245a] to-[#214ECF] p-7 sm:p-9 text-white shadow-xl">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/20 px-3.5 py-1 text-xs font-bold text-blue-200 backdrop-blur-md border border-blue-300/30">
              <Clock size={13} className="animate-spin text-blue-300" />
              APPLICATION SUBMITTED • UNDER OPERATIONS REVIEW
            </span>
            <span className="text-xs font-mono text-blue-200/80">Estimated Review: Within 24 Hours</span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-3xl font-black tracking-tight text-white">
            Application Submitted for Final Review
          </h2>
          <p className="mt-2 text-sm sm:text-base text-blue-100/90 leading-relaxed max-w-3xl">
            Your signed Global Delivery Partner Agreement and complete facility details have been submitted to Thinkatic Operations.
            Estimated Review: Within 24 Hours. Once verified, your operational modules will unlock automatically.
          </p>

          {/* Timeline Stages (Data-Driven from Real Backend Milestones) */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {(milestones.length > 0 ? milestones.slice(0, 6) : [
              { label: "Account", completed: true, status: "Complete" },
              { label: "Company & Centre", completed: (summary.completedStages || 0) >= 2, status: "In Progress" },
              { label: "Physical Verification", completed: (summary.completedStages || 0) >= 4, status: "Pending" },
              { label: "Signed Agreement", completed: (summary.completedStages || 0) >= 6, status: "Pending" },
              { label: "Operations Review", completed: false, status: "In Progress" },
              { label: "Portal Activation", completed: false, status: "Pending" },
            ]).map((st: any, i: number) => {
              const isDone = Boolean(st.completed || st.status === "Complete" || st.status === "VERIFIED" || st.status === "APPROVED");
              const isActive = !isDone && (st.status === "In Progress" || st.status === "UNDER_REVIEW" || st.status === "active");
              return (
                <div
                  key={st.key || i}
                  className={`rounded-2xl border p-3.5 text-center transition-all ${
                    isDone
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : isActive
                      ? "border-blue-400 bg-blue-500/25 text-white ring-2 ring-blue-400/30"
                      : "border-white/10 bg-white/5 text-blue-200/60"
                  }`}
                >
                  <div className="flex justify-center mb-1.5">
                    {isDone ? (
                      <CheckCircle2 size={16} className="text-emerald-300" />
                    ) : isActive ? (
                      <Clock size={16} className="text-blue-300 animate-pulse" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-white/30 text-[10px] flex items-center justify-center">
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold truncate">{st.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-80 uppercase tracking-wider font-semibold">
                    {isDone ? "Verified" : isActive ? "In Progress" : st.status === "Needs Correction" ? "Action Required" : "Pending"}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-5 text-xs text-blue-200/80">
            <span className="flex items-center gap-2">
              <Lock size={14} className="text-blue-300" />
              All operational modules remain safely locked until accreditation is complete.
            </span>
            <span className="font-mono">Reference: {companyName || "BPO Partner"}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── PROGRESSIVE SETUP INCOMPLETE CARD ──────────────────────────────────────
  return (
    <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/30 to-blue-50/60 p-6 sm:p-8 shadow-[0_12px_45px_rgba(33,78,207,0.08)]">
      {/* PRIORITY 1: NEEDS CORRECTION BANNER */}
      {primaryCorrection && (
        <div className="mb-6 rounded-2xl border-2 border-rose-400 bg-rose-50/90 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <AlertTriangle size={20} />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-900">
                  ACTION REQUIRED • NEEDS CORRECTION
                </span>
                <h3 className="mt-1 text-base font-black text-rose-950">
                  {primaryCorrection.label}: Correction Required
                </h3>
                <p className="mt-0.5 text-xs font-medium text-rose-800 leading-relaxed">
                  Reason: {primaryCorrection.reason}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigateToUrl(primaryCorrection.actionUrl)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition shrink-0 cursor-pointer"
            >
              <span>Fix {primaryCorrection.label}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Locked Stage Notice Toast */}
      {lockedNotice && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs font-semibold text-amber-900 flex items-center gap-2.5 animate-fadeIn">
          <Lock size={15} className="text-amber-600 shrink-0" />
          <span>{lockedNotice}</span>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-100 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100/70 px-3 py-0.5 text-[11px] font-bold text-[#214ECF] mb-2">
            <Sparkles size={12} />
            BPO PARTNER ONBOARDING DASHBOARD
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
            Complete Your BPO Partner Setup
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            Progress is automatically verified from your saved records in Supabase. Complete each stage to unlock your operational modules.
          </p>
        </div>

        {/* Dynamic Progress Metric & Continue Button */}
        <div className="flex items-center gap-4 self-start md:self-auto rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Setup Progress</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-[#214ECF]" data-testid="onboarding-progress-percent">
                {progressPercent}%
              </span>
              <span className="text-xs font-bold text-slate-500 font-mono">({completedStages}/{totalStages})</span>
            </div>
          </div>
          <button
            onClick={handleContinue}
            data-testid="continue-onboarding-button"
            className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-[#1a3eb3] transition-all hover:gap-2.5 cursor-pointer"
          >
            <span>Continue Onboarding</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Dynamic Progress Bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
          <span>Onboarding Readiness ({completedStages} of {totalStages} Stages Completed)</span>
          <span className="text-[#214ECF] font-mono">{progressPercent}% Completed</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#214ECF] to-[#3B82F6] transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 9 Live Status Cards Grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {milestones.map((m) => {
          const Icon = MILESTONE_ICONS[m.key] || CheckCircle2;
          const isDone = m.status === "Complete" || m.completed;
          const isCorrection = m.status === "Needs Correction";
          const isLocked = m.status === "Locked" || m.isLocked;
          const isInProgress = m.status === "In Progress";
          const isRequired = m.status === "Required";
          const isPending = m.status === "Pending";

          return (
            <div
              key={m.key}
              onClick={() => handleCardClick(m)}
              data-testid={`stage-card-${m.key}`}
              className={`group flex items-center justify-between gap-3 rounded-2xl border p-4 transition-all select-none ${
                isDone
                  ? "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300 hover:shadow-xs cursor-pointer"
                  : isCorrection
                  ? "border-rose-300 bg-rose-50/70 hover:border-rose-400 hover:shadow-sm ring-1 ring-rose-300/50 cursor-pointer"
                  : isInProgress
                  ? "border-blue-300 bg-blue-50/60 hover:border-blue-400 hover:shadow-xs cursor-pointer"
                  : isRequired
                  ? "border-indigo-200 bg-indigo-50/30 hover:border-indigo-300 hover:shadow-xs cursor-pointer"
                  : isLocked
                  ? "border-slate-200/70 bg-slate-50/60 text-slate-400 cursor-not-allowed opacity-75"
                  : "border-amber-200/80 bg-amber-50/30 hover:border-amber-300 cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                    isDone
                      ? "bg-emerald-100 text-emerald-700"
                      : isCorrection
                      ? "bg-rose-100 text-rose-700"
                      : isInProgress
                      ? "bg-blue-100 text-[#214ECF]"
                      : isRequired
                      ? "bg-indigo-100 text-indigo-700"
                      : isLocked
                      ? "bg-slate-200/70 text-slate-400"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isLocked ? <Lock size={16} /> : isCorrection ? <AlertTriangle size={16} /> : <Icon size={16} />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate text-slate-900 group-hover:text-[#214ECF] transition-colors">
                    {m.label}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500 truncate">
                    {isCorrection
                      ? (m.correctionReason || "Action Required")
                      : m.description || m.status}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {isDone ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    <CheckCircle2 size={11} />
                    Complete
                  </span>
                ) : isCorrection ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800">
                    <AlertTriangle size={10} />
                    Needs Correction
                  </span>
                ) : isInProgress ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-[#214ECF]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#214ECF] animate-pulse" />
                    In Progress
                  </span>
                ) : isLocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
                    <Lock size={10} />
                    Locked
                  </span>
                ) : isRequired ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800">
                    <Info size={10} />
                    Required
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                    <Clock size={10} />
                    {m.status || "Pending"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Auto-Save Assurance & "Continue from last step" */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100/80 pt-4 text-xs text-slate-500">
        <span className="flex items-center gap-2 text-slate-600">
          <CheckCircle2 size={14} className="text-emerald-600" />
          <span>Authoritative state saved in Supabase. Real-time progress is preserved across sessions.</span>
        </span>
        <button
          onClick={handleContinue}
          data-testid="continue-from-last-step-button"
          className="text-xs font-bold text-[#214ECF] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>Continue from last step</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
