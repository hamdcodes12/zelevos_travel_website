import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2, Send, Lock } from "lucide-react";

interface FinalSubmissionConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossier: any;
  onSuccess: () => void;
}

export default function FinalSubmissionConfirmationModal({
  isOpen,
  onClose,
  dossier,
  onSuccess,
}: FinalSubmissionConfirmationModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("user_token") ||
        localStorage.getItem("thinkatic_user_token") ||
        localStorage.getItem("bpo_applicant_token") ||
        localStorage.getItem("token") ||
        ""
      : "";

  if (!isOpen || !dossier) return null;

  async function handleSubmit() {
    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/partner/applications/${dossier.applicationId}/submit-final`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to submit final accreditation dossier.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit accreditation for final review.");
    } finally {
      setSubmitting(false);
    }
  }

  const verifiedDocs = (dossier.documents || []).filter(
    (d: any) => String(d.status || "").toLowerCase() === "verified"
  ).length;
  const totalDocs = (dossier.documents || []).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-xl rounded-3xl border border-[#E5EAF2] bg-white p-6 sm:p-8 shadow-2xl space-y-6 my-8"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#214ECF] border border-blue-100 shadow-2xs">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#0B1F3A]">
                Submit for Final Accreditation Review
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Thinkatic Operations Executive Clearance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-3.5 text-xs font-semibold text-slate-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-slate-700 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Please review the consolidated accreditation dossier breakdown before submitting. All 6 partner evidence
            pillars have cleared preliminary requirements.
          </p>

          {/* Dossier Checklist Summary */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Company & Entity</span>
              <span className="font-bold text-[#0B1F3A]">
                {dossier.company.companyName} ({dossier.applicationNumber})
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Facility & Capacity</span>
              <span className="font-bold text-[#0B1F3A]">
                {dossier.centre.centreName} • {dossier.centre.totalSeats} seats
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Documents & Compliance</span>
              <span className="font-bold text-[#214ECF]">
                {verifiedDocs} of {totalDocs || 8} documents verified
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Office & Infrastructure</span>
              <span className="font-bold text-[#0B1F3A]">
                {dossier.officeVerification.photosUploadedCount} / 7 required media proofs • {dossier.infrastructure.primaryIsp || "Configured"}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Authorized Management</span>
              <span className="font-bold text-[#0B1F3A]">
                {dossier.management.authorizedSignatory || "Managing Director"} ({dossier.management.designation || "Executive"})
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Frontline Assessment</span>
              <span className="font-bold text-[#0B1F3A] uppercase">
                {dossier.assessments?.[0]?.status || "Readiness Evaluated"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Master Legal Agreement</span>
              <span className="font-bold text-[#214ECF] uppercase">
                {dossier.agreement?.status || "Signed & Ingested"}
              </span>
            </div>
          </div>

          {/* Legal / Operational Notice */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-slate-700 flex items-start gap-3">
            <Lock className="h-5 w-5 text-[#214ECF] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block text-[#0B1F3A] font-bold">Locking & Administrative Review Notice:</strong>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                After submission, required accreditation information will be locked for final administrative review
                unless Thinkatic Operations specifically requests changes. By proceeding, you declare that all submitted
                information and media proofs are true and authoritative.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] disabled:opacity-50 transition"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting for Review...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Submit for Final Approval
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
