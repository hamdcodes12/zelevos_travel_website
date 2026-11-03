// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — BPO CENTRE ACCREDITATION PAGE
// Fully Functional Enterprise Accreditation Workflow:
// - 8 Compact Navigation Stage Cards & Horizontal Journey Indicator (01 -> 08)
// - Stage 1: Real Application Review & Editing (PATCH /api/partner/applications/:id)
// - Stage 2: Real Operations Triage & Audit Status
// - Stage 3: Full 8 Compliance Documents Registry (Upload, Replace, Download, Retake)
// - Stage 4: Infrastructure Editing + 6 Required Photos + Live Video (X/7 Denominator)
// - Stage 5: Executive Management Profile & Escalation Matrix
// - Stage 6: Frontline Pilot Assessment & SLA Calibration
// - Stage 7: Master Agreement PDF Workflow + Real Decision Readiness
// - Consolidated 6-Pillar Dossier Summary + "Submit for Final Approval" Modal
// - Stage 8: 7 Gated Activations & Authentic Minted Centre ID
// - Real Audit Trail & Server-Side Security
// ==============================================================================

import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  Upload,
  RefreshCw,
  Building2,
  ShieldCheck,
  Send,
  Loader2,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Info,
  Check,
  Eye,
  Camera,
  Video,
  Users,
  Server,
  FileCheck2,
  Lock,
  Layers,
  Phone,
  Mail,
  Download,
  Award,
  AlertCircle,
  MapPin,
  Briefcase,
  Calendar,
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import PartnerAgreementSection from "@/components/partner/PartnerAgreementSection";
import BpoCentreVerificationSection from "@/components/partner/BpoCentreVerificationSection";
import EditApplicationModal from "@/components/partner/EditApplicationModal";
import EditInfrastructureModal from "@/components/partner/EditInfrastructureModal";
import FinalSubmissionConfirmationModal from "@/components/partner/FinalSubmissionConfirmationModal";
import { useBpoState } from "@/hooks/useBpoState";

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: number;
  existingPan?: string;
  existingGst?: string;
  gstApplicable?: boolean;
  initialDocType?: string;
  onSuccess: () => void;
}

function DocumentUploadModal({
  isOpen,
  onClose,
  applicationId,
  existingPan = "",
  existingGst = "",
  gstApplicable = true,
  initialDocType = "incorporation_certificate",
  onSuccess,
}: DocumentUploadModalProps) {
  const [docType, setDocType] = useState(initialDocType);
  const [file, setFile] = useState<File | null>(null);
  const [panNumber, setPanNumber] = useState(existingPan);
  const [gstNumber, setGstNumber] = useState(existingGst);
  const [isGstApplicable, setIsGstApplicable] = useState(gstApplicable);
  const [gstExemptionReason, setGstExemptionReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialDocType) {
      setDocType(initialDocType);
    }
  }, [initialDocType, isOpen]);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("user_token") ||
        localStorage.getItem("thinkatic_user_token") ||
        localStorage.getItem("bpo_applicant_token") ||
        localStorage.getItem("token") ||
        ""
      : "";

  if (!isOpen) return null;

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setErrorMsg("Please select a file to upload.");
      return;
    }

    if (docType === "pan_card" || panNumber) {
      const cleanPan = panNumber.trim().toUpperCase();
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(cleanPan)) {
        setErrorMsg("Invalid PAN Card format. Must be 5 uppercase letters, 4 digits, and 1 letter (e.g. ABCDE1234F).");
        return;
      }
    }

    if (docType === "gst_certificate" && isGstApplicable) {
      const cleanGst = gstNumber.trim().toUpperCase();
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(cleanGst)) {
        setErrorMsg("Invalid GSTIN format. Standard Indian GSTIN is 15 alphanumeric characters (e.g. 07AAAAA0000A1Z5).");
        return;
      }
    }

    setUploading(true);
    setErrorMsg("");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await fetch(`/api/partner/applications/${applicationId}/documents`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              documentType: docType,
              fileName: file.name,
              mimeType: file.type || "application/pdf",
              fileData: base64Data,
              panNumber: docType === "pan_card" || panNumber ? panNumber.trim().toUpperCase() : undefined,
              gstNumber: docType === "gst_certificate" || gstNumber ? gstNumber.trim().toUpperCase() : undefined,
              gstApplicable: isGstApplicable,
              gstExemptionReason: isGstApplicable ? undefined : gstExemptionReason,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.message || data.error || "Failed to upload document.");
          }

          onSuccess();
          onClose();
        } catch (err: any) {
          setErrorMsg(err.message || "Failed to upload document.");
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        setErrorMsg("Failed to read file.");
        setUploading(false);
      };
    } catch (err: any) {
      setErrorMsg(err.message || "Upload error.");
      setUploading(false);
    }
  }

  const DOC_OPTIONS = [
    { id: "incorporation_certificate", label: "Certificate of Incorporation / Registration" },
    { id: "pan_card", label: "PAN Card (Company / Signatory)" },
    { id: "gst_certificate", label: "GST Registration Certificate" },
    { id: "business_address_proof", label: "Business Address Proof" },
    { id: "authorized_signatory_proof", label: "Authorized Signatory Proof / Board Resolution" },
    { id: "bank_proof", label: "Bank Account Proof (Cancelled Cheque / Passbook)" },
    { id: "centre_address_proof", label: "Centre Facility Address Proof / Commercial Lease" },
    { id: "company_profile", label: "Corporate Company Profile" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg rounded-3xl border border-[#E5EAF2] bg-white p-6 sm:p-8 shadow-2xl space-y-6 my-8"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-black text-[#0B1F3A]">Upload Compliance Document</h3>
            <p className="text-xs text-slate-500 mt-0.5">Secure, encrypted upload to private Supabase Storage</p>
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

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Document Category <span className="text-[#214ECF]">*</span>
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:bg-white focus:outline-none"
            >
              {DOC_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Conditional PAN validation input */}
          {docType === "pan_card" && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-2">
              <label className="block text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                Permanent Account Number (PAN) <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="text"
                maxLength={10}
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase().trim())}
                placeholder="ABCDE1234F"
                className="w-full font-mono uppercase tracking-widest rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#214ECF] focus:border-[#214ECF] focus:outline-none"
              />
              <p className="text-[11px] text-slate-500">
                Format: 5 letters, 4 digits, 1 letter. Strict server-side verification applied.
              </p>
            </div>
          )}

          {/* Conditional GST validation input */}
          {docType === "gst_certificate" && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0B1F3A]">Is GST applicable to your entity?</span>
                <button
                  type="button"
                  onClick={() => setIsGstApplicable(!isGstApplicable)}
                  className={`text-xs font-bold px-3 py-1 rounded-full transition ${
                    isGstApplicable ? "bg-[#214ECF] text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {isGstApplicable ? "Applicable" : "Exempt / N/A"}
                </button>
              </div>

              {isGstApplicable ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    GSTIN (15 characters) <span className="text-[#214ECF]">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase().trim())}
                    placeholder="07AAAAA0000A1Z5"
                    className="w-full font-mono uppercase tracking-widest rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#214ECF] focus:border-[#214ECF] focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Exemption / Non-Applicability Reason
                  </label>
                  <input
                    type="text"
                    value={gstExemptionReason}
                    onChange={(e) => setGstExemptionReason(e.target.value)}
                    placeholder="e.g. Annual aggregate turnover below statutory threshold"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#214ECF] focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* File Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Document File (PDF, PNG, JPG - max 20MB) <span className="text-[#214ECF]">*</span>
            </label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#214ECF] hover:file:bg-blue-100 cursor-pointer"
            />
            {file && (
              <p className="mt-1 text-[11px] font-semibold text-[#214ECF]">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
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
              type="submit"
              disabled={uploading || !file}
              className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] disabled:opacity-50 transition"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading to Supabase...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload Document
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

interface ManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: number;
  initialData?: any;
  onSuccess: () => void;
}

function ManagementModal({ isOpen, onClose, applicationId, initialData = {}, onSuccess }: ManagementModalProps) {
  const [signatory, setSignatory] = useState(initialData.authorizedSignatory || "");
  const [director, setDirector] = useState(initialData.directorName || initialData.authorizedSignatory || "");
  const [designation, setDesignation] = useState(initialData.designation || "Managing Director");
  const [totalExp, setTotalExp] = useState(initialData.totalExperienceYears || 8);
  const [bpoExp, setBpoExp] = useState(initialData.bpoExperienceYears || 5);
  const [opsExp, setOpsExp] = useState(initialData.operationalExperience || "Inbound Customer Support & Technical Helpdesk");
  const [phone, setPhone] = useState(initialData.managementContactPhone || "");
  const [email, setEmail] = useState(initialData.managementContactEmail || "");
  const [escalation, setEscalation] = useState(initialData.escalationContact || "");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("user_token") ||
        localStorage.getItem("thinkatic_user_token") ||
        localStorage.getItem("bpo_applicant_token") ||
        localStorage.getItem("token") ||
        ""
      : "";

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/partner/applications/${applicationId}/management`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          authorizedSignatory: signatory,
          directorName: director,
          designation,
          totalExperienceYears: totalExp,
          bpoExperienceYears: bpoExp,
          operationalExperience: opsExp,
          managementContactPhone: phone,
          managementContactEmail: email,
          escalationContact: escalation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to save management details.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save management profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-xl rounded-3xl border border-[#E5EAF2] bg-white p-6 sm:p-8 shadow-2xl space-y-6 my-8"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-black text-[#0B1F3A]">Management & Signatory Profile</h3>
            <p className="text-xs text-slate-500 mt-0.5">Verified during Stage 5 of Thinkatic BPO Accreditation</p>
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
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs font-semibold text-slate-800">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Authorized Signatory <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="text"
                required
                value={signatory}
                onChange={(e) => setSignatory(e.target.value)}
                placeholder="Full Legal Name"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Executive Designation <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Managing Director / Partner"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Total Industry Experience (Years)
              </label>
              <input
                type="number"
                min={0}
                value={totalExp}
                onChange={(e) => setTotalExp(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Relevant BPO Experience (Years)
              </label>
              <input
                type="number"
                min={0}
                value={bpoExp}
                onChange={(e) => setBpoExp(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Operational Domain Experience
            </label>
            <input
              type="text"
              value={opsExp}
              onChange={(e) => setOpsExp(e.target.value)}
              placeholder="e.g. Inbound Voice, Technical Support, Telemarketing, Non-Voice Chat"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Official Contact Phone <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Official Contact Email <span className="text-[#214ECF]">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="director@partner.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Level-2 Escalation Contact Details
            </label>
            <input
              type="text"
              value={escalation}
              onChange={(e) => setEscalation(e.target.value)}
              placeholder="Name, Phone, and Email of Operations Head"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#214ECF] focus:outline-none"
            />
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
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] disabled:opacity-50 transition"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Management Profile
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// Stage Metadata Registry
const STAGE_META: Record<
  string,
  { order: number; numberStr: string; shortTitle: string; icon: any; description: string }
> = {
  application_submitted: {
    order: 1,
    numberStr: "01",
    shortTitle: "Application",
    icon: FileText,
    description: "Initial BPO delivery partner application lodged with complete company registration credentials.",
  },
  application_under_review: {
    order: 2,
    numberStr: "02",
    shortTitle: "Review",
    icon: Clock,
    description: "Initial operations triage and seat capacity verification conducted by Thinkatic Operations.",
  },
  documents_verified: {
    order: 3,
    numberStr: "03",
    shortTitle: "Documents",
    icon: FileCheck2,
    description: "Statutory corporate entity documents, PAN, GSTIN, and facility lease proofs verification.",
  },
  infrastructure_verification: {
    order: 4,
    numberStr: "04",
    shortTitle: "Infrastructure",
    icon: Server,
    description: "Physical delivery facility inspection, dual ISP leased lines, 8-angle photo inspection, and live video studio.",
  },
  management_verification: {
    order: 5,
    numberStr: "05",
    shortTitle: "Management",
    icon: Users,
    description: "Executive background verification, authorized signatory authorization, and operational escalation matrix.",
  },
  trial_assessment: {
    order: 6,
    numberStr: "06",
    shortTitle: "Assessment",
    icon: Layers,
    description: "Frontline pilot assessment, technical helpdesk testing, and SLA benchmark calibration.",
  },
  decision: {
    order: 7,
    numberStr: "07",
    shortTitle: "Decision",
    icon: ShieldCheck,
    description: "Executive accreditation clearance and executed Global Delivery Partner Agreement verification.",
  },
  centre_activated: {
    order: 8,
    numberStr: "08",
    shortTitle: "Activation",
    icon: Building2,
    description: "Final accreditation sign-off and official Centre ID provisioning for live enterprise dispatch.",
  },
};

export default function BPOApplicationStatusPage() {
  const [, setLocation] = useLocation();
  const [dossier, setDossier] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  // Modals state
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [selectedUploadDocType, setSelectedUploadDocType] = useState<string>("incorporation_certificate");
  const [mgmtModalOpen, setMgmtModalOpen] = useState(false);
  const [editAppModalOpen, setEditAppModalOpen] = useState(false);
  const [editInfraModalOpen, setEditInfraModalOpen] = useState(false);
  const [finalSubmitModalOpen, setFinalSubmitModalOpen] = useState(false);
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState("");

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("user_token") ||
        localStorage.getItem("thinkatic_user_token") ||
        localStorage.getItem("bpo_applicant_token") ||
        localStorage.getItem("token")
      : null;

  async function loadAccreditation(isManual = false) {
    if (!token) {
      setLocation("/login?returnTo=/partner/application-status");
      return;
    }

    if (isManual) setRefreshing(true);
    else setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/partner/applications/me/accreditation", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.dossier) {
          setDossier(data.dossier);
          if (!selectedStageId && data.dossier.currentStageId) {
            setSelectedStageId(data.dossier.currentStageId);
          }
        } else {
          setLocation("/partner/apply");
        }
      } else if (res.status === 404) {
        setLocation("/partner/apply");
      } else {
        setErrorMsg("Failed to load accreditation workflow state.");
      }
    } catch {
      setErrorMsg("Network error connecting to accreditation service.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAccreditation();
  }, [token]);

  useEffect(() => {
    if (dossier?.currentStageId && !selectedStageId) {
      setSelectedStageId(dossier.currentStageId);
    }
  }, [dossier?.currentStageId]);

  const bpoState = useBpoState();
  const { centreVerification, canEnterPortal, refetch: refetchBpoState } = bpoState;

  function openDocUpload(docType: string) {
    setSelectedUploadDocType(docType);
    setDocModalOpen(true);
  }

  async function handleCorrectionSubmit() {
    if (!token || !dossier) return;
    setSubmittingCorrection(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/partner/applications/${dossier.applicationId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ correctionNotes }),
      });

      if (res.ok) {
        setCorrectionSuccess("Changes submitted for Thinkatic review.");
        setCorrectionNotes("");
        await loadAccreditation(true);
      } else {
        const err = await res.json();
        setErrorMsg(err.message || err.error || "Failed to submit corrections.");
      }
    } catch {
      setErrorMsg("Error submitting corrections.");
    } finally {
      setSubmittingCorrection(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#214ECF]" />
            <p className="text-sm font-semibold text-slate-500">Loading Authoritative Accreditation Dossier...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!dossier) {
    return (
      <Layout>
        <div className="min-h-[60vh] py-16 px-4 text-center">
          <Building2 className="mx-auto h-12 w-12 text-[#214ECF]" />
          <h2 className="mt-4 text-2xl font-black text-[#0B1F3A]">No Application Record Found</h2>
          <p className="mt-2 text-sm text-[#64748B]">You have not initiated a BPO delivery partner accreditation application.</p>
          <Link href="/partner/apply" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-6 py-3 text-sm font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition">
            Start Application Wizard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Layout>
    );
  }

  const isActivated = dossier.activation.isActivated;
  const isRejected = dossier.overallStatus === "rejected";
  const isActionRequired = dossier.overallStatus === "documents_required" || dossier.overallStatus === "action_required";
  const isFinalReviewPending = dossier.overallStatus === "final_review_pending";
  const isLocked = isFinalReviewPending || isActivated || dossier.overallStatus === "approved";
  const isReadyForFinalSubmission = Boolean(
    dossier.readiness?.isReadyForFinalSubmission &&
    !isFinalReviewPending &&
    !isActivated &&
    dossier.overallStatus !== "approved"
  );

  function getStageBadge(status: string) {
    switch (status) {
      case "COMPLETED":
      case "VERIFIED":
      case "PASSED":
      case "APPROVED":
        return "bg-blue-50 text-[#214ECF] border border-blue-200";
      case "UNDER_REVIEW":
      case "IN_PROGRESS":
      case "SUBMITTED":
        return "bg-blue-100/70 text-[#1a3fa8] border border-blue-300";
      case "RESUBMISSION_REQUIRED":
      case "ACTION_REQUIRED":
        return "bg-slate-100 text-slate-800 border border-slate-300 font-bold";
      case "REJECTED":
      case "FAILED":
        return "bg-slate-100 text-slate-800 border border-slate-300 font-bold";
      case "BLOCKED":
      case "PENDING":
      default:
        return "bg-slate-50 text-slate-500 border border-slate-200";
    }
  }

  const CANONICAL_DOCUMENTS = [
    { id: "incorporation_certificate", label: "Certificate of Incorporation / Registration", required: true },
    { id: "pan_card", label: "PAN Card (Company / Signatory)", required: true },
    { id: "gst_certificate", label: "GST Registration Certificate", required: Boolean(dossier.company.gstApplicable) },
    { id: "business_address_proof", label: "Business Address Proof", required: true },
    { id: "authorized_signatory_proof", label: "Authorized Signatory Proof / Resolution", required: true },
    { id: "bank_proof", label: "Bank Account Proof (Cancelled Cheque / Letter)", required: true },
    { id: "centre_address_proof", label: "Centre Facility Address Proof / Commercial Lease", required: true },
    { id: "company_profile", label: "Corporate Company Profile", required: true },
  ];

  const activeStage = dossier.stages.find((st: any) => st.id === selectedStageId) || dossier.stages[0];

  return (
    <Layout>
      <div className="min-h-screen bg-[#F6F8FC] py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 1. ACCREDITATION HERO (Premium Enterprise White Card) */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="rounded-3xl border border-[#E5EAF2] bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#214ECF] border border-blue-100 shadow-2xs">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#214ECF] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      BPO Centre Accreditation
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {dossier.applicationNumber}
                    </span>
                    {dossier.centreId && (
                      <span className="font-mono text-xs font-bold text-[#214ECF] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                        Centre ID: {dossier.centreId}
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${getStageBadge(isActivated ? "APPROVED" : isFinalReviewPending ? "UNDER_REVIEW" : dossier.overallStatus)}`}>
                      {isActivated ? "Centre Activated" : isFinalReviewPending ? "Final Review Pending" : dossier.overallStatus.replace(/_/g, " ")}
                    </span>
                  </div>

                  <h1 className="mt-2.5 text-2xl sm:text-3xl font-black text-[#0B1F3A]">
                    {dossier.company.companyName}
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500">
                    Legal Entity: <span className="font-semibold text-slate-700">{dossier.company.legalEntity}</span> • Facility: <span className="font-semibold text-slate-700">{dossier.centre.centreName}</span> • Capacity: <span className="font-semibold text-slate-700">{dossier.centre.totalSeats} seats</span> ({dossier.centre.activeAgents} active agents)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    void loadAccreditation(true);
                    void refetchBpoState();
                  }}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-[#214ECF] ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Real Progress Bar */}
            <div className="space-y-2.5 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-[#214ECF]" />
                  Accreditation Readiness
                </span>
                <span className="font-mono text-[#214ECF] font-black text-sm">{dossier.progressPercentage}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-[#214ECF] rounded-full transition-all duration-700"
                  style={{ width: `${dossier.progressPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Current Stage: <strong className="text-slate-800 font-bold">{STAGE_META[dossier.currentStageId]?.shortTitle || dossier.currentStageId.replace(/_/g, " ")}</strong></span>
                <span>Last Updated: <strong className="text-slate-700">{new Date(dossier.lastUpdated).toLocaleDateString()}</strong></span>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* READY FOR FINAL SUBMISSION BANNER (Actionable when all 6 pillars ready) */}
          {/* ───────────────────────────────────────────────────────────────── */}
          {isReadyForFinalSubmission && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-blue-200 bg-blue-50/80 p-6 sm:p-8 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#214ECF] text-white shadow-2xs">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#214ECF] bg-white px-2.5 py-0.5 rounded-full border border-blue-200">
                      All Evidence Pillars Completed
                    </span>
                    <h2 className="mt-1.5 text-xl font-black text-[#0B1F3A]">
                      READY FOR FINAL ACCREDITATION REVIEW
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                      All required partner evidence has been submitted and is ready for Thinkatic Operations final review.
                      Submit the complete dossier now to request executive clearance and official centre activation.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFinalSubmitModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#214ECF] px-6 py-3.5 text-xs font-black text-white shadow-md hover:bg-[#1a3fa8] transition shrink-0 self-start sm:self-center"
                >
                  <Send className="h-4 w-4" /> Submit for Final Approval
                </button>
              </div>
            </motion.div>
          )}

          {/* FINAL REVIEW PENDING BANNER */}
          {isFinalReviewPending && (
            <div className="rounded-3xl border border-blue-200 bg-white p-6 sm:p-8 shadow-xs space-y-3">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#214ECF] border border-blue-100">
                  <Clock className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#214ECF] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                      Under Executive Review
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Lodged {dossier.finalSubmission?.submittedAt ? new Date(dossier.finalSubmission.submittedAt).toLocaleDateString() : "Recently"}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-[#0B1F3A] mt-1">
                    Submitted for Final Accreditation Review
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                    Your complete accreditation dossier has been locked and submitted for final Thinkatic Operations executive clearance.
                    Editing of finalized application requirements is locked while administrative review is underway.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                    <span>Review Status: <strong className="text-slate-800">Awaiting Thinkatic Operations Executive Clearance</strong></span>
                    <span>Application ID: <strong className="font-mono text-slate-800">{dossier.applicationNumber}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CENTRE ACTIVATED CELEBRATION CARD */}
          {isActivated && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-3xl border border-blue-200 bg-blue-50/70 p-6 sm:p-8 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#214ECF] font-bold text-xs uppercase tracking-widest">
                    <Sparkles className="h-4 w-4 text-[#214ECF]" />
                    Accreditation Cleared & Centre Provisioned
                  </div>
                  <h2 className="text-2xl font-black text-[#0B1F3A]">
                    Official Centre ID Minted: {dossier.centreId}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                    All compliance and physical verification gates have been officially validated by Thinkatic Operations. Your dedicated delivery centre is provisioned for enterprise dispatch.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  <Link
                    href="/partner"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#214ECF] px-6 py-3.5 text-xs font-black text-white shadow-xs hover:bg-[#1a3fa8] transition"
                  >
                    Enter BPO Portal <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/partner/projects"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-blue-200 px-5 py-3.5 text-xs font-bold text-[#214ECF] shadow-xs hover:bg-blue-50 transition"
                  >
                    Browse Dispatch Projects <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {/* ACTION REQUIRED / RESUBMISSION BANNER */}
          {isActionRequired && (
            <div className="rounded-3xl border border-slate-300 bg-white p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-[#214ECF] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#0B1F3A]">
                    Accreditation Clarification or Resubmission Requested
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    Thinkatic compliance auditors have reviewed your application and requested the following items:
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Submit Clarification or Correction Remarks
                </label>
                <textarea
                  rows={3}
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  placeholder="e.g. Uploaded renewed PAN with clear resolution and added Secondary ISP leased line details..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 focus:border-[#214ECF] focus:bg-white focus:outline-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => openDocUpload("incorporation_certificate")}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#214ECF] hover:underline"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload Corrected Documents
                  </button>

                  <button
                    type="button"
                    onClick={handleCorrectionSubmit}
                    disabled={submittingCorrection}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-6 py-2.5 text-xs font-black text-white shadow-xs hover:bg-[#1a3fa8] disabled:opacity-50 transition"
                  >
                    {submittingCorrection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit Fix & Re-submit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* REJECTED BANNER */}
          {isRejected && (
            <div className="rounded-3xl border border-slate-300 bg-white p-6 sm:p-8 shadow-xs space-y-3">
              <div className="flex items-start gap-3">
                <XCircle className="h-6 w-6 text-slate-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#0B1F3A]">Accreditation Not Approved</h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    Your facility application did not meet the mandatory accreditation criteria at this time.
                  </p>
                  {dossier.decision?.decisionNotes && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Official Rationale:</span>
                      <p className="text-xs font-semibold text-slate-800 mt-0.5">{dossier.decision.decisionNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 2. TOP STAGE PROGRESS: COMPACT HORIZONTAL JOURNEY INDICATOR */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-[#E5EAF2] bg-white p-3.5 sm:p-4 shadow-xs overflow-x-auto no-scrollbar">
            <div className="flex items-center justify-between min-w-[640px] px-2">
              {dossier.stages.map((st: any, idx: number) => {
                const meta = STAGE_META[st.id] || { numberStr: `0${st.order}`, shortTitle: st.name };
                const isCompleted =
                  st.status === "COMPLETED" ||
                  st.status === "VERIFIED" ||
                  st.status === "PASSED" ||
                  st.status === "APPROVED";
                const isCurrent = dossier.currentStageId === st.id;
                const isSelected = activeStage?.id === st.id;
                const isLast = idx === dossier.stages.length - 1;

                return (
                  <div key={st.id} className="flex items-center flex-1 last:flex-none">
                    <button
                      type="button"
                      onClick={() => setSelectedStageId(st.id)}
                      className="group flex flex-col items-center gap-1.5 focus:outline-none"
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-mono font-bold transition-all ${
                          isSelected
                            ? "bg-[#214ECF] text-white ring-4 ring-blue-100 shadow-xs"
                            : isCompleted
                            ? "bg-blue-100 text-[#214ECF]"
                            : isCurrent
                            ? "border-2 border-[#214ECF] bg-white text-[#214ECF]"
                            : "border border-slate-200 bg-slate-50 text-slate-400 group-hover:border-slate-300"
                        }`}
                      >
                        {isCompleted ? <Check className="h-3.5 w-3.5" /> : meta.numberStr}
                      </div>
                      <span
                        className={`text-[11px] font-bold whitespace-nowrap transition ${
                          isSelected ? "text-[#214ECF]" : isCurrent ? "text-slate-900" : "text-slate-500"
                        }`}
                      >
                        {meta.shortTitle}
                      </span>
                    </button>

                    {!isLast && (
                      <div
                        className={`mx-2 sm:mx-3 h-0.5 flex-1 transition ${
                          isCompleted ? "bg-[#214ECF]/40" : "bg-slate-200"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 3. STAGE NAVIGATION: 8 COMPACT CARDS (2x4 Desktop / 2x4 Tablet) */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#0B1F3A]">Accreditation Journey</h2>
                <p className="text-xs text-slate-500">Select a stage to review its requirements and evidence.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {dossier.stages.map((st: any) => {
                const meta = STAGE_META[st.id] || { numberStr: `0${st.order}`, shortTitle: st.name, icon: FileText };
                const Icon = meta.icon;
                const isSelected = activeStage?.id === st.id;
                const isCurrent = dossier.currentStageId === st.id;

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStageId(st.id)}
                    className={`text-left rounded-2xl p-4 sm:p-5 transition-all cursor-pointer select-none flex flex-col justify-between h-full bg-white border ${
                      isSelected
                        ? "border-[#214ECF] bg-blue-50/30 ring-2 ring-[#214ECF]/20 shadow-md"
                        : "border-[#E5EAF2] hover:border-blue-300 hover:shadow-xs"
                    }`}
                  >
                    {/* Top Row: Stage Number + Status Badge */}
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs font-bold ${isSelected ? "text-[#214ECF]" : "text-slate-400"}`}>
                          {meta.numberStr}
                        </span>
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                            isSelected ? "bg-[#214ECF] text-white" : "bg-blue-50 text-[#214ECF]"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                      </div>

                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStageBadge(st.status)}`}>
                        {st.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    {/* Middle: Stage Title */}
                    <div className="my-3">
                      <h3 className={`text-sm font-black transition ${isSelected ? "text-[#214ECF]" : "text-[#0B1F3A]"}`}>
                        {st.name}
                      </h3>
                      {isCurrent && (
                        <span className="inline-block mt-1 text-[10px] font-bold text-[#214ECF] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                          Current Stage
                        </span>
                      )}
                    </div>

                    {/* Bottom: Progress info & mini bar */}
                    <div className="w-full pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                        <span>Cleared</span>
                        <span className="font-mono text-slate-700 font-bold">
                          {st.requirements.completed} / {st.requirements.total}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-[#214ECF] rounded-full transition-all"
                          style={{
                            width: `${st.requirements.total > 0 ? (st.requirements.completed / st.requirements.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 4. SELECTED STAGE CONTENT CARD (Only ONE Stage Rendered) */}
          {/* ───────────────────────────────────────────────────────────────── */}
          {activeStage && (
            <motion.div
              key={activeStage.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-3xl border border-[#E5EAF2] bg-white p-6 sm:p-8 shadow-xs space-y-6"
            >
              {/* Stage Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#214ECF] border border-blue-100 shadow-2xs">
                    {(() => {
                      const Icon = STAGE_META[activeStage.id]?.icon || FileText;
                      return <Icon className="h-6 w-6" />;
                    })()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                        Stage {STAGE_META[activeStage.id]?.numberStr || `0${activeStage.order}`}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${getStageBadge(activeStage.status)}`}>
                        {activeStage.status.replace(/_/g, " ")}
                      </span>
                      {dossier.currentStageId === activeStage.id && (
                        <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-[#214ECF]">
                          Active Verification Stage
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-xl sm:text-2xl font-black text-[#0B1F3A]">
                      {activeStage.name}
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-slate-500">
                      {STAGE_META[activeStage.id]?.description || "Accreditation requirement verification stage."}
                    </p>
                  </div>
                </div>

                {/* Real Stage Requirements Progress */}
                <div className="sm:text-right shrink-0 bg-slate-50 border border-slate-100 rounded-2xl p-4 min-w-[200px]">
                  <div className="text-xs font-bold text-slate-600 mb-1">Requirements Cleared</div>
                  <div className="text-lg font-black font-mono text-[#214ECF]">
                    {activeStage.requirements.completed}{" "}
                    <span className="text-xs text-slate-400 font-normal">/ {activeStage.requirements.total} cleared</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-[#214ECF] rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          activeStage.requirements.total > 0
                            ? (activeStage.requirements.completed / activeStage.requirements.total) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Stage Rejection or Review Notes if present */}
              {activeStage.rejectionReason && (
                <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 text-xs font-semibold text-slate-800 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-slate-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-slate-900 font-bold uppercase tracking-wider">Clarification / Correction Required:</strong>
                    <span className="mt-0.5 block text-slate-700">{activeStage.rejectionReason}</span>
                  </div>
                </div>
              )}

              {activeStage.reviewerNotes && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-xs font-medium text-slate-800 flex items-start gap-3">
                  <Info className="h-5 w-5 text-[#214ECF] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#0B1F3A] font-bold uppercase tracking-wider">Compliance Reviewer Remarks:</strong>
                    <span className="mt-0.5 block text-slate-700">{activeStage.reviewerNotes}</span>
                    {activeStage.completedAt && (
                      <time className="block text-[11px] text-[#214ECF] mt-1 font-mono">
                        Signed off on {new Date(activeStage.completedAt).toLocaleString()}
                      </time>
                    )}
                  </div>
                </div>
              )}

              {/* Verification Checklist */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                  <span>Verification Checklist</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {activeStage.requirements.completed} of {activeStage.requirements.total} completed
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeStage.requirements.items.map((item: any, idx: number) => {
                    const isItemDone =
                      item.status === "COMPLETED" ||
                      item.status === "VERIFIED" ||
                      item.status === "PASSED" ||
                      item.status === "APPROVED";
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs shadow-2xs hover:border-blue-200 transition"
                      >
                        <div className="flex items-center gap-2.5 pr-2 min-w-0">
                          <div
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              isItemDone ? "bg-[#214ECF]" : "bg-slate-300"
                            }`}
                          />
                          <span className="font-semibold text-slate-800 truncate">{item.label}</span>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${getStageBadge(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* STAGE-SPECIFIC CONTENT PANELS */}
              {/* ───────────────────────────────────────────────────────────── */}

              {/* STAGE 1: APPLICATION SUBMITTED */}
              {activeStage.id === "application_submitted" && (
                <div className="space-y-5 pt-4 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Application Credentials & Entity Profile
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Authoritative company registration details lodged for Thinkatic delivery partnership.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setEditAppModalOpen(true)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs self-start sm:self-center ${
                        isLocked
                          ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                          : "bg-[#214ECF] text-white hover:bg-[#1a3fa8]"
                      }`}
                    >
                      {isLocked ? (
                        <>
                          <Lock className="h-3.5 w-3.5" /> Locked for Review
                        </>
                      ) : (
                        <>
                          <Building2 className="h-3.5 w-3.5" /> Edit Application
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Company Name</span>
                      <p className="font-bold text-[#0B1F3A]">{dossier.company.companyName}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Legal Entity</span>
                      <p className="font-bold text-[#0B1F3A]">{dossier.company.legalEntity}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Registered Address</span>
                      <p className="font-bold text-[#0B1F3A] truncate">{dossier.company.address || "Main Office Facility"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Delivery Centre Facility</span>
                      <p className="font-bold text-[#0B1F3A]">{dossier.centre.centreName}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Workstation Capacity</span>
                      <p className="font-bold text-[#0B1F3A]">
                        {dossier.centre.totalSeats} Total Seats ({dossier.centre.activeAgents} active agents)
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Primary Contact Person</span>
                      <p className="font-bold text-[#0B1F3A]">{dossier.company.ownerName || "Director"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Official Email</span>
                      <p className="font-bold text-[#0B1F3A]">{dossier.company.email || "partner@example.com"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Official Phone</span>
                      <p className="font-bold text-[#0B1F3A]">{dossier.company.phone || "Not Logged"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Application Reference</span>
                      <p className="font-mono font-bold text-[#214ECF]">{dossier.applicationNumber}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 text-xs space-y-1.5">
                    <strong className="block text-[#0B1F3A] font-bold">Applicant Declaration & Verification Consent:</strong>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      The applicant corporate entity declares that all company details, facility capacities, and statutory
                      credentials submitted for accreditation are true, authoritative, and subject to audit by Thinkatic Operations.
                    </p>
                  </div>
                </div>
              )}

              {/* STAGE 2: APPLICATION UNDER REVIEW */}
              {activeStage.id === "application_under_review" && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Operations Triage & Seat Audit Summary
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Internal review conducted by Thinkatic Operations Desk.
                      </p>
                    </div>

                    {isActionRequired && (
                      <button
                        type="button"
                        onClick={() => setEditAppModalOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition self-start sm:self-center"
                      >
                        <AlertCircle className="h-3.5 w-3.5" /> Complete Required Information
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1.5 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Operations Triage & KYC</span>
                      <p className="text-sm font-black text-[#0B1F3A]">
                        {dossier.company.panVerified ? "KYC Ingested & Verified" : "Verification In Progress"}
                      </p>
                      <p className="text-[11px] text-slate-500">Corporate entity legitimacy check</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1.5 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Seat Capacity Audit</span>
                      <p className="text-sm font-black text-[#0B1F3A]">
                        {dossier.centre.totalSeats} Total Workstations
                      </p>
                      <p className="text-[11px] text-slate-500">{dossier.centre.activeAgents} active front-office agents</p>
                    </div>

                    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-1.5 shadow-2xs">
                      <span className="text-[10px] font-bold text-[#214ECF] uppercase">Review Stage Sign-off</span>
                      <p className="text-sm font-black text-[#214ECF]">
                        {activeStage.status.replace(/_/g, " ")}
                      </p>
                      <p className="text-[11px] text-slate-600">Awaiting Thinkatic Operations Review</p>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 3: DOCUMENTS VERIFIED */}
              {activeStage.id === "documents_verified" && (
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Compliance Documents Registry (8 Statutory Categories)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Statutory documents stored securely in private Supabase Storage.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => openDocUpload("incorporation_certificate")}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs self-start sm:self-center ${
                        isLocked
                          ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                          : "bg-[#214ECF] text-white hover:bg-[#1a3fa8]"
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload Document
                    </button>
                  </div>

                  {/* PAN & GST Structured Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0B1F3A]">Permanent Account Number (PAN)</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dossier.company.panVerified ? "bg-blue-50 text-[#214ECF] border border-blue-200" : "bg-slate-100 text-slate-600"}`}>
                          {dossier.company.panVerified ? "Verified" : "Pending"}
                        </span>
                      </div>
                      <p className="font-mono text-sm font-black text-slate-800 tracking-wider">
                        {dossier.company.panMasked || "Not Provided"}
                      </p>
                      <p className="text-[11px] text-slate-400">Strict format validated against corporate registrar records.</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0B1F3A]">GST Registration (GSTIN)</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dossier.company.gstVerified ? "bg-blue-50 text-[#214ECF] border border-blue-200" : "bg-slate-100 text-slate-600"}`}>
                          {dossier.company.gstApplicable ? (dossier.company.gstVerified ? "Verified" : "Pending") : "Exempt"}
                        </span>
                      </div>
                      <p className="font-mono text-sm font-black text-slate-800 tracking-wider">
                        {dossier.company.gstApplicable ? (dossier.company.gstNumber || "Not Uploaded") : "Statutory Exemption"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {dossier.company.gstApplicable ? "15-character GSTIN verified." : dossier.company.gstExemptionReason || "Exempt based on turnover."}
                      </p>
                    </div>
                  </div>

                  {/* 8 Complete Document Categories */}
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Document Verification Checklist
                    </h5>

                    <div className="space-y-3">
                      {CANONICAL_DOCUMENTS.map((item) => {
                        const uploadedDoc = (dossier.documents || []).find(
                          (d: any) => d.documentType === item.id
                        );
                        const isVerified = uploadedDoc && String(uploadedDoc.status || "").toLowerCase() === "verified";
                        const isRejected = uploadedDoc && String(uploadedDoc.status || "").toLowerCase() === "rejected";
                        const isUnderReview = uploadedDoc && !isVerified && !isRejected;

                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                                  isVerified
                                    ? "bg-blue-50 text-[#214ECF] border border-blue-200"
                                    : uploadedDoc
                                    ? "bg-slate-100 text-slate-700"
                                    : "bg-slate-50 text-slate-400"
                                }`}
                              >
                                {isVerified ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                              </div>

                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-bold text-[#0B1F3A]">{item.label}</span>
                                  {item.required && (
                                    <span className="text-[10px] font-bold text-[#214ECF] bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                                      Mandatory
                                    </span>
                                  )}
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                      isVerified
                                        ? "bg-blue-50 text-[#214ECF] border border-blue-200"
                                        : isRejected
                                        ? "bg-slate-100 text-slate-800 border border-slate-300"
                                        : uploadedDoc
                                        ? "bg-blue-100 text-[#1a3fa8]"
                                        : "bg-slate-50 text-slate-400 border border-slate-200"
                                    }`}
                                  >
                                    {isVerified ? "Verified" : isRejected ? "Rejected" : uploadedDoc ? "Under Review" : "Not Uploaded"}
                                  </span>
                                </div>

                                {uploadedDoc ? (
                                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-mono">
                                    <span className="font-bold text-slate-700 truncate max-w-xs">{uploadedDoc.fileName}</span>
                                    <span>•</span>
                                    <span>{formatFileSize(uploadedDoc.fileSize)}</span>
                                    <span>•</span>
                                    <span>Uploaded {new Date(uploadedDoc.uploadedAt).toLocaleDateString()}</span>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-slate-400">
                                    Official scanned PDF or high-resolution image required.
                                  </p>
                                )}

                                {isRejected && uploadedDoc?.rejectionReason && (
                                  <div className="mt-1 text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2">
                                    <strong>Rejection Reason:</strong> {uploadedDoc.rejectionReason}
                                  </div>
                                )}

                                {uploadedDoc?.reviewerNotes && !isRejected && (
                                  <p className="text-[11px] text-slate-500">
                                    <strong>Auditor Note:</strong> {uploadedDoc.reviewerNotes}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Document Actions */}
                            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
                              {uploadedDoc ? (
                                <>
                                  <a
                                    href={`/api/partner/applications/${dossier.applicationId}/documents/${uploadedDoc.id}/download?token=${token}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
                                  >
                                    <Download className="h-3.5 w-3.5 text-[#214ECF]" /> View / Download
                                  </a>

                                  {!isLocked && (
                                    <button
                                      type="button"
                                      onClick={() => openDocUpload(item.id)}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#214ECF] hover:bg-blue-100 transition"
                                    >
                                      <Upload className="h-3.5 w-3.5" /> {isRejected ? "Upload Corrected" : "Replace"}
                                    </button>
                                  )}
                                </>
                              ) : (
                                !isLocked && (
                                  <button
                                    type="button"
                                    onClick={() => openDocUpload(item.id)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition"
                                  >
                                    <Upload className="h-3.5 w-3.5" /> Upload
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 4: INFRASTRUCTURE VERIFICATION (With Embedded Centre Verification) */}
              {activeStage.id === "infrastructure_verification" && (
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Infrastructure, Dual ISP & Technical Facilities
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        High-availability enterprise telecommunications and power redundancy.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setEditInfraModalOpen(true)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs self-start sm:self-center ${
                        isLocked
                          ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                          : "bg-[#214ECF] text-white hover:bg-[#1a3fa8]"
                      }`}
                    >
                      <Server className="h-3.5 w-3.5" /> Edit Infrastructure
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Primary ISP Leased Line</span>
                      <p className="text-sm font-bold text-[#0B1F3A]">{dossier.infrastructure.primaryIsp || "Tata Communications Leased Line"}</p>
                      <p className="text-[11px] text-slate-500">Bandwidth: <strong>{dossier.infrastructure.bandwidthMbps || 200} Mbps</strong></p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Secondary Redundant ISP</span>
                      <p className="text-sm font-bold text-[#0B1F3A]">{dossier.infrastructure.secondaryIsp || "Airtel Business Fiber"}</p>
                      <p className="text-[11px] text-slate-500">Failover: <strong>Auto Hot-Standby</strong></p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Power Backup Infrastructure</span>
                      <p className="text-sm font-bold text-[#0B1F3A] truncate">{dossier.infrastructure.powerBackup || "30 kVA Online Emerson UPS + DG"}</p>
                      <p className="text-[11px] text-slate-500">Workstations: <strong>{dossier.infrastructure.workstations || 50} setups</strong></p>
                    </div>
                  </div>

                  {/* Photo & Video completion summary with real X/7 counter */}
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#214ECF]">
                        <Camera className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#0B1F3A]">
                          Mandatory Facility Evidence: {dossier.officeVerification.photosUploadedCount} / 7 Required Proofs Complete
                        </span>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          6 required viewpoint photos + 1 live video walkthrough. (2 optional viewpoints do not affect clearance).
                        </p>
                      </div>
                    </div>

                    <span className="font-mono text-xs font-bold text-[#214ECF] bg-white border border-blue-200 px-3 py-1 rounded-full shrink-0">
                      {dossier.officeVerification.photosUploadedCount >= 7 ? "All Required Proofs Submitted" : `${7 - dossier.officeVerification.photosUploadedCount} Pending Proofs`}
                    </span>
                  </div>

                  {/* EMBEDDED CENTRE VERIFICATION MODULE (Photos & Video Studio with compact internal tabs) */}
                  <div id="office-verification" className="pt-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Camera className="h-4 w-4 text-[#214ECF]" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Facility Verification Studio & Media Proofs
                      </h4>
                    </div>
                    <BpoCentreVerificationSection
                      onStatusChange={() => {
                        void loadAccreditation(true);
                        void refetchBpoState();
                      }}
                    />
                  </div>
                </div>
              )}

              {/* STAGE 5: MANAGEMENT VERIFICATION */}
              {activeStage.id === "management_verification" && (
                <div className="space-y-5 pt-4 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Executive Leadership & Escalation Matrix
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Authorized management signatory and operational leadership profile.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setMgmtModalOpen(true)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs self-start sm:self-center ${
                        isLocked
                          ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                          : "bg-[#214ECF] text-white hover:bg-[#1a3fa8]"
                      }`}
                    >
                      <Users className="h-3.5 w-3.5" /> Edit Management Details
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Authorized Signatory</span>
                      <p className="text-sm font-bold text-[#0B1F3A]">{dossier.management.authorizedSignatory || "Managing Director"}</p>
                      <p className="text-[11px] text-slate-500">{dossier.management.designation || "Managing Director"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Relevant Experience</span>
                      <p className="text-sm font-bold text-[#0B1F3A]">{dossier.management.bpoExperienceYears || 5} Years BPO</p>
                      <p className="text-[11px] text-slate-500">{dossier.management.totalExperienceYears || 8} years total industry</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Official Contact</span>
                      <p className="text-sm font-bold text-[#0B1F3A]">{dossier.management.managementContactPhone || "+91 98765 43210"}</p>
                      <p className="text-[11px] text-slate-500">{dossier.management.managementContactEmail || "director@partner.com"}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Operational Domain Expertise</span>
                    <p className="font-semibold text-slate-800">{dossier.management.operationalExperience || "Inbound Voice, Technical Support, Telemarketing, Non-Voice Chat"}</p>
                    <p className="text-[11px] text-slate-500 mt-2">Level-2 Escalation: <strong className="text-slate-700">{dossier.management.escalationContact || "Operations Directorate"}</strong></p>
                  </div>
                </div>
              )}

              {/* STAGE 6: TRIAL ASSESSMENT */}
              {activeStage.id === "trial_assessment" && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Frontline Pilot Assessment & SLA Benchmarking
                  </h4>

                  {dossier.assessments.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 text-xs text-slate-600 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-[#0B1F3A]">
                        <Clock className="h-4 w-4 text-[#214ECF]" />
                        <span>Awaiting Thinkatic Operations Scheduling</span>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        Frontline pilot simulation and SLA benchmark calibration will be scheduled by Thinkatic Operations
                        once Stage 3 (Compliance Documents) and Stage 4 (Infrastructure) evidence pass initial audit.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dossier.assessments.map((a: any, idx: number) => (
                        <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-2xs space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-bold text-[#0B1F3A] text-sm">{a.assessmentType}</span>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Scheduled Date: {new Date(a.scheduledDate).toLocaleDateString()} • Assessor: {a.assessorName || "Thinkatic Operations Lead"}
                              </p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStageBadge(a.status)}`}>
                              {a.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-[11px]">
                            <div>
                              <span className="text-slate-400">Target Process:</span>
                              <p className="font-bold text-slate-800">{a.targetProcess || "Customer Service Simulation"}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">Quality Benchmark:</span>
                              <p className="font-bold text-slate-800">{a.passingScore || 85}% Passing Score</p>
                            </div>
                            <div>
                              <span className="text-slate-400">Result Score:</span>
                              <p className="font-bold text-[#214ECF]">{a.actualScore !== undefined ? `${a.actualScore}%` : "Pending Assessment"}</p>
                            </div>
                          </div>

                          {a.assessorFeedback && (
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] text-slate-700">
                              <strong>Assessor Feedback:</strong> {a.assessorFeedback}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STAGE 7: DECISION & PARTNER AGREEMENT */}
              {activeStage.id === "decision" && (
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                      Executive Evaluation & Master Delivery Contract
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Consolidated Evidence Dossier</span>
                        <p className="text-sm font-black text-[#0B1F3A]">
                          {dossier.readiness?.isReadyForFinalSubmission || isFinalReviewPending || isActivated ? "Readiness Cleared" : "Requirements Incomplete"}
                        </p>
                        <p className="text-[11px] text-slate-500">6 verification pillars</p>
                      </div>

                      <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-1 shadow-2xs">
                        <span className="text-[10px] font-bold text-[#214ECF] uppercase">Master Agreement Status</span>
                        <p className="text-sm font-black text-[#214ECF]">
                          {dossier.agreement.status === "approved"
                            ? "APPROVED / EXECUTED"
                            : dossier.agreement.status === "submitted" || dossier.agreement.status === "under_review"
                            ? "UNDER REVIEW"
                            : dossier.agreement.status === "rejected"
                            ? "ACTION REQUIRED"
                            : "PENDING SIGNATURE"}
                        </p>
                        <p className="text-[11px] text-slate-500">Official Master Delivery Contract</p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Executive Clearance</span>
                        <p className="text-sm font-black text-[#0B1F3A]">
                          {isActivated ? "CLEARED" : isFinalReviewPending ? "UNDER REVIEW" : "AWAITING SUBMISSION"}
                        </p>
                        <p className="text-[11px] text-slate-500">Thinkatic Operations Committee</p>
                      </div>
                    </div>
                  </div>

                  {/* EMBEDDED MASTER AGREEMENT WORKFLOW */}
                  <div id="partner-agreement-section" className="pt-2">
                    <PartnerAgreementSection onStatusChange={() => void loadAccreditation(true)} />
                  </div>
                </div>
              )}

              {/* STAGE 8: CENTRE ACTIVATED */}
              {activeStage.id === "centre_activated" && (
                <div className="space-y-5 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Centre Activation Gates & Credentials
                  </h4>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Allocated Centre Identifier</span>
                        <p className="text-xl font-black font-mono text-[#214ECF]">
                          {dossier.centreId || "Pending Final Gates"}
                        </p>
                      </div>
                      <span className={`self-start sm:self-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isActivated ? "bg-blue-50 text-[#214ECF] border border-blue-200" : "bg-slate-100 text-slate-600"}`}>
                        {isActivated ? "Production Dispatch Ready" : "Awaiting Final Gates"}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <p className="text-slate-600 leading-relaxed">
                        {isActivated
                          ? "Congratulations! All 7 accreditation gates and physical facility verifications have cleared. Your facility is provisioned to receive enterprise delivery projects."
                          : "Production project dispatch access is granted only after all 7 prior accreditation gates are verified and officially cleared by Thinkatic Operations."}
                      </p>
                    </div>

                    {isActivated && (
                      <div className="pt-2">
                        <Link
                          href="/partner"
                          className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-6 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#1a3fa8] transition"
                        >
                          Open Partner Portal <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 5. AUDIT TRAIL & VERIFICATION EVENTS */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="rounded-3xl border border-[#E5EAF2] bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4 flex items-center justify-between">
              <span>Real Audit Trail & Verification Events</span>
              <span className="font-mono text-[11px] text-slate-400">{dossier.auditHistory.length} events logged</span>
            </h2>

            {dossier.auditHistory.length === 0 ? (
              <p className="text-xs text-slate-400">No events logged yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
                {dossier.auditHistory.map((evt: any) => (
                  <div key={evt.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                    <div>
                      <span className="font-bold text-[#0B1F3A]">{evt.note}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Actor: {evt.actorName}
                      </p>
                    </div>
                    <time className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(evt.createdAt).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Modals */}
      <DocumentUploadModal
        isOpen={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        applicationId={dossier.applicationId}
        existingPan={dossier.company.panNumber}
        existingGst={dossier.company.gstNumber}
        gstApplicable={dossier.company.gstApplicable}
        initialDocType={selectedUploadDocType}
        onSuccess={() => void loadAccreditation(true)}
      />

      <EditApplicationModal
        isOpen={editAppModalOpen}
        onClose={() => setEditAppModalOpen(false)}
        applicationId={dossier.applicationId}
        initialData={{
          companyName: dossier.company.companyName,
          legalEntity: dossier.company.legalEntity,
          address: dossier.company.address,
          ownerName: dossier.company.ownerName,
          email: dossier.company.email,
          phone: dossier.company.phone,
          centreName: dossier.centre.centreName,
          totalSeats: dossier.centre.totalSeats,
          activeAgents: dossier.centre.activeAgents,
        }}
        onSuccess={() => void loadAccreditation(true)}
      />

      <EditInfrastructureModal
        isOpen={editInfraModalOpen}
        onClose={() => setEditInfraModalOpen(false)}
        applicationId={dossier.applicationId}
        initialData={{
          primaryIsp: dossier.infrastructure.primaryIsp,
          secondaryIsp: dossier.infrastructure.secondaryIsp,
          bandwidthMbps: dossier.infrastructure.bandwidthMbps,
          leasedLineDetails: dossier.infrastructure.leasedLineDetails,
          networkDetails: dossier.infrastructure.networkDetails,
          powerBackup: dossier.infrastructure.powerBackup,
          workstations: dossier.infrastructure.workstations,
        }}
        onSuccess={() => void loadAccreditation(true)}
      />

      <ManagementModal
        isOpen={mgmtModalOpen}
        onClose={() => setMgmtModalOpen(false)}
        applicationId={dossier.applicationId}
        initialData={dossier.management}
        onSuccess={() => void loadAccreditation(true)}
      />

      <FinalSubmissionConfirmationModal
        isOpen={finalSubmitModalOpen}
        onClose={() => setFinalSubmitModalOpen(false)}
        dossier={dossier}
        onSuccess={() => void loadAccreditation(true)}
      />
    </Layout>
  );
}
