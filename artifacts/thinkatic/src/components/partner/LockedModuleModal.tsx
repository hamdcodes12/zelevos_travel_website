// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — LOCKED MODULE REQUIREMENT MODAL
// Shown when a partner attempts to access locked operational modules prior to full
// accreditation and activation. Explicitly lists remaining requirements with CTAs.
// ==============================================================================

import { X, LockKeyhole, ArrowRight, CheckCircle2, AlertCircle, Building2 } from "lucide-react";

interface Milestone {
  key: string;
  label: string;
  status: string;
  completed: boolean;
}

interface Props {
  isOpen: boolean;
  moduleName: string;
  onClose: () => void;
  onContinue?: () => void;
  onContinueOnboarding?: () => void;
  summary?: any;
  milestones?: Milestone[];
  progressPercent?: number;
}

export default function LockedModuleModal({
  isOpen,
  moduleName,
  onClose,
  onContinue,
  onContinueOnboarding,
  summary,
  milestones,
  progressPercent,
}: Props) {
  if (!isOpen) return null;

  const effectiveMilestones: Milestone[] =
    summary?.milestones ||
    milestones ||
    [];

  const effectiveProgress =
    summary?.progressPercent ??
    progressPercent ??
    15;

  const handleAction = onContinueOnboarding || onContinue || onClose;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="locked-modal-title"
    >
      <div
        className="relative max-w-lg w-full rounded-3xl border border-blue-100 bg-white p-6 sm:p-8 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient Bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#214ECF] via-blue-500 to-indigo-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 shadow-sm">
            <LockKeyhole size={22} />
          </div>
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100/60 px-2.5 py-0.5 rounded-full mb-1">
              Access Restricted
            </span>
            <h3 id="locked-modal-title" className="text-xl font-black text-slate-900 tracking-tight">
              Complete BPO Onboarding First
            </h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-800">{moduleName}</strong> is an operational module available once your BPO Partner onboarding, centre accreditation, and signed agreement are verified.
            </p>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-slate-600">Onboarding Readiness</span>
            <span className="text-[#214ECF] font-mono">{effectiveProgress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#214ECF] transition-all duration-500"
              style={{ width: `${effectiveProgress}%` }}
            />
          </div>
        </div>

        {/* Requirements Checklist */}
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
            Required Activation Checklist
          </p>
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {effectiveMilestones.length > 0 ? (
              effectiveMilestones.map((m) => (
                <div
                  key={m.key}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 text-xs transition-colors ${
                    m.completed
                      ? "border-emerald-100 bg-emerald-50/50 text-slate-800"
                      : "border-slate-200/80 bg-white text-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {m.completed ? (
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 shrink-0" />
                    )}
                    <span className="font-semibold truncate">{m.label}</span>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                      m.completed
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-xs text-slate-400">Loading requirement checklist...</div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={handleAction}
            className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#1a3eb3] transition"
          >
            <span>Continue Onboarding</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
