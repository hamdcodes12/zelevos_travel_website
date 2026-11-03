import { useState, useEffect, useRef, useId } from "react";
import {
  FileText,
  Download,
  Eye,
  Upload,
  CheckCircle,
  Clock,
  History,
  Shield,
  PenLine,
  RefreshCw,
  AlertCircle,
  Lock,
  Building2,
  FileCheck,
  X,
  FileUp,
} from "lucide-react";

interface AgreementSubmission {
  id: number;
  agreementId: number;
  partnerId?: string | null;
  centreId?: string | null;
  submissionNumber: number;
  version: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType?: string;
  storageBucket?: string;
  storagePath?: string;
  status: "pending_review" | "approved" | "rejected";
  rejectionReason: string | null;
  issuedAt?: string | null;
  uploadedAt: string;
  submittedAt: string;
  submittedBy: string;
  reviewedAt: string | null;
  reviewedByAdminId: number | null;
  reviewedByAdminName?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AgreementData {
  id: number;
  agreementCode: string;
  version: string;
  status: string;
  partnerLegalName: string;
  partnerTradeName: string;
  centreId: string | null;
  termMonths: number;
  royaltyPercentage: number;
  effectiveDate?: string;
  templateReference?: string;
  generatedDocumentUrl?: string;
  generatedDocumentFileName?: string;
  generatedAt?: string;
  thinkaticLegalEntity: string;
  thinkaticSignatoryName: string;
  thinkaticSignatoryDesignation: string;
  signedDocumentUrl: string | null;
  signedDocumentFileName: string | null;
  signedDocumentFileSize?: number | null;
  signedSubmittedAt: string | null;
  signedSubmittedBy?: string | null;
  approvedAt: string | null;
  approvedByAdminName?: string | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  isImmutable: boolean;
  issuedAt?: string;
  createdAt: string;
  updatedAt?: string;
  submissions?: AgreementSubmission[];
}

export default function PartnerAgreementSection({ onStatusChange }: { onStatusChange?: () => void }) {
  const [agreement, setAgreement] = useState<AgreementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isViewOriginalOpen, setIsViewOriginalOpen] = useState(false);
  const [isViewSignedOpen, setIsViewSignedOpen] = useState(false);
  const [signedViewerUrl, setSignedViewerUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const token = localStorage.getItem("user_token") || localStorage.getItem("token") || "";

  const fetchAgreement = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bpo/agreement", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.hasAgreement && data.agreement) {
        setAgreement(data.agreement);
      } else {
        setAgreement(null);
      }
    } catch (err) {
      console.error("Failed to fetch agreement", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgreement();
  }, []);

  const handleDownloadOriginal = () => {
    const downloadUrl = `/api/bpo/agreement/download?token=${encodeURIComponent(token)}`;
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "Thinkatic-BPO-Partner-Agreement.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleDownloadSigned = () => {
    const downloadUrl = `/api/bpo/agreement/download-signed?token=${encodeURIComponent(token)}`;
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = agreement?.signedDocumentFileName || "Signed-BPO-Partner-Agreement.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleViewOriginal = () => {
    setIsViewOriginalOpen(true);
  };

  const handleViewSigned = (customUrl?: string) => {
    const url = customUrl || `/api/bpo/agreement/view-signed?token=${encodeURIComponent(token)}`;
    setSignedViewerUrl(url);
    setIsViewSignedOpen(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadError(null);
    setUploadSuccess(null);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    validateAndSetFile(files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;
    validateAndSetFile(files[0]);
  };

  const validateAndSetFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setUploadError("Invalid file type. Signed Agreement must strictly be uploaded in PDF format (.pdf).");
      setSelectedFile(null);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setUploadError("File size exceeds 25MB limit. Please upload an optimized PDF under 25MB.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      setUploadError("Please select a signed PDF document first.");
      return;
    }

    setUploading(true);
    setUploadProgress(15);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        setUploadProgress(45);
        const fileDataUrl = reader.result as string;

        try {
          const res = await fetch("/api/bpo/agreement/upload-signed", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              fileName: selectedFile.name,
              fileSizeBytes: selectedFile.size,
              mimeType: "application/pdf",
              fileData: fileDataUrl,
            }),
          });

          setUploadProgress(85);
          const data = await res.json();

          if (res.ok && data.success) {
            setUploadProgress(100);
            setUploadSuccess("Signed agreement uploaded successfully. It is now pending Thinkatic Admin review.");
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            await fetchAgreement();
            if (onStatusChange) onStatusChange();
          } else {
            setUploadError(data.error || data.message || "Failed to upload signed agreement.");
          }
        } catch (postErr: any) {
          setUploadError(postErr.message || "Network error uploading signed agreement.");
        } finally {
          setUploading(false);
          setTimeout(() => setUploadProgress(0), 1000);
        }
      };

      reader.onerror = () => {
        setUploadError("Failed to read the local file. Please try selecting the file again.");
        setUploading(false);
        setUploadProgress(0);
      };

      reader.readAsDataURL(selectedFile);
    } catch (err: any) {
      setUploadError(err.message || "An unexpected error occurred during upload.");
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Pending";
    try {
      return new Date(dateStr).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // Determine upload status enum
  const getUploadStatus = () => {
    if (uploading) return "UPLOADING";
    if (!agreement?.signedDocumentFileName) return "NOT_UPLOADED";
    if (agreement.status === "approved") return "APPROVED";
    if (agreement.status === "rejected") return "REJECTED";
    if (agreement.status === "signed_agreement_submitted" || agreement.status === "admin_review") {
      return "UNDER_REVIEW";
    }
    return "SUBMITTED";
  };

  const uploadState = getUploadStatus();

  // Loading Screen
  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#214ECF]" />
        <p className="mt-4 text-sm font-semibold text-slate-700">Loading Legal & Agreement details...</p>
      </div>
    );
  }

  // Initial State: Pending Issuance
  if (!agreement) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Legal & Agreements</h1>
            <p className="mt-1 text-xs text-slate-500">
              Master BPO Delivery Partner accreditation agreement and legal compliance documentation.
            </p>
          </div>
        </div>

        {/* STATUS CARD: Pending Issuance */}
        <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-100 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-[#214ECF]">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Agreement Status</p>
                <h3 className="text-lg font-black text-slate-900">Pending Issuance</h3>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3.5 py-1 text-xs font-bold text-[#214ECF]">
              <Clock className="h-3.5 w-3.5" /> Awaiting Review
            </span>
          </div>

          <div className="mt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-[#214ECF] mt-0.5" />
            <p className="text-sm font-medium text-slate-700 leading-relaxed">
              Your Thinkatic Global Delivery Partner Agreement will be issued here after your onboarding and centre verification details are reviewed.
            </p>
          </div>
        </div>

        {/* Journey Timeline preview */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
          <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF]">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Agreement Journey</h3>
              <p className="text-xs text-slate-500">End-to-end partner accreditation agreement lifecycle</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-7 gap-3">
            {[
              { num: "01", name: "Pending Issuance", status: "Active Stage", desc: "Operations verification" },
              { num: "02", name: "Agreement Issued", status: "Upcoming", desc: "Generated master PDF" },
              { num: "03", name: "Ready for Signature", status: "Upcoming", desc: "Partner download" },
              { num: "04", name: "Signed PDF Uploaded", status: "Upcoming", desc: "External signing" },
              { num: "05", name: "Under Admin Review", status: "Upcoming", desc: "Legal compliance check" },
              { num: "06", name: "Approved / Rejected", status: "Upcoming", desc: "Human decision" },
              { num: "07", name: "Partner Activation", status: "Upcoming", desc: "All gates complete" },
            ].map((step, idx) => (
              <div
                key={step.num}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  idx === 0
                    ? "border-blue-300 bg-blue-50/70 shadow-xs"
                    : "border-slate-200/70 bg-slate-50/40 text-slate-400"
                }`}
              >
                <span
                  className={`inline-block font-mono text-[11px] font-bold ${
                    idx === 0 ? "text-[#214ECF]" : "text-slate-400"
                  }`}
                >
                  {step.num}
                </span>
                <p
                  className={`mt-1 text-xs font-bold leading-tight ${
                    idx === 0 ? "text-slate-900" : "text-slate-600"
                  }`}
                >
                  {step.name}
                </p>
                <p className="mt-1 text-[10px] text-slate-500 leading-normal">{step.desc}</p>
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      idx === 0 ? "bg-[#214ECF] text-white" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Agreement has been issued! Render complete production workflow
  const isApproved = agreement.status === "approved";
  const isRejected = agreement.status === "rejected";
  const isSubmitted =
    agreement.status === "signed_agreement_submitted" || agreement.status === "admin_review";
  const isReady = agreement.status === "agreement_ready" && !agreement.signedDocumentFileName;

  const currentDisplayStatus = isApproved
    ? "APPROVED"
    : isRejected
    ? "REJECTED"
    : isSubmitted
    ? "UNDER ADMIN REVIEW"
    : "AGREEMENT READY FOR SIGNATURE";

  return (
    <div className="space-y-8">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. HEADER & STATUS CARD                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Legal & Agreements</h1>
          <p className="mt-1 text-xs text-slate-500">
            Master BPO Delivery Partner accreditation agreement and legal compliance documentation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-[#214ECF]">
            <Shield className="h-3.5 w-3.5" /> Official Master Agreement
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-700">
            v{agreement.version || "1.0"}
          </span>
        </div>
      </div>

      {/* TOP STATUS CARD */}
      <div className="rounded-3xl border border-blue-100 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#214ECF] border border-blue-100 shadow-2xs">
              <FileSignatureIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Agreement Status</p>
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                {isApproved
                  ? "Agreement Approved"
                  : isRejected
                  ? "Agreement Rejected"
                  : isSubmitted
                  ? "Signed Agreement Under Review"
                  : "Agreement Ready for Signature"}
              </h2>
            </div>
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2 text-xs font-bold tracking-wider text-[#214ECF]">
              <span className="h-2 w-2 rounded-full bg-[#214ECF] animate-pulse" />
              {currentDisplayStatus}
            </span>
          </div>
        </div>

        {/* METADATA GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 text-xs">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Agreement ID</p>
            <p className="mt-1 font-mono font-bold text-slate-900 text-sm">{agreement.agreementCode}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Agreement Version</p>
            <p className="mt-1 font-bold text-slate-900 text-sm">v{agreement.version || "1.0"}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Issue Date</p>
            <p className="mt-1 font-bold text-slate-900 text-sm">
              {formatDate(agreement.issuedAt || agreement.createdAt)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Effective Date</p>
            <p className="mt-1 font-bold text-slate-900 text-sm">
              {agreement.effectiveDate || formatDate(agreement.createdAt)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Centre ID</p>
            <p className="mt-1 font-mono font-bold text-[#214ECF] text-sm">
              {agreement.centreId || "Assigned on verification"}
            </p>
          </div>
        </div>

        {/* REJECTION MESSAGE NOTICE */}
        {isRejected && agreement.rejectionReason && (
          <div className="rounded-2xl border border-slate-300 bg-slate-50 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-slate-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Reason for Agreement Rejection
              </h3>
            </div>
            <p className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl p-3.5">
              {agreement.rejectionReason}
            </p>
            <p className="text-[11px] text-slate-500">
              Please review the reason above, make the required corrections outside the portal, and upload the corrected signed PDF below.
            </p>
          </div>
        )}

        {/* PRIMARY & SECONDARY ACTIONS */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleDownloadOriginal}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#214ECF] px-6 py-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1a3eb0] active:scale-[0.99] cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Download Agreement PDF</span>
          </button>

          <button
            type="button"
            onClick={handleViewOriginal}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-blue-50/50 hover:border-blue-200 hover:text-[#214ECF] cursor-pointer"
          >
            <Eye className="h-4 w-4 text-[#214ECF]" />
            <span>View Agreement</span>
          </button>

          {agreement.signedDocumentFileName && (
            <button
              type="button"
              onClick={() => handleViewSigned()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/60 px-6 py-3.5 text-xs font-bold text-[#214ECF] shadow-2xs transition hover:bg-blue-100/60 cursor-pointer"
            >
              <FileCheck className="h-4 w-4" />
              <span>View Uploaded Agreement</span>
            </button>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. BPO PARTNER INSTRUCTIONS                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-blue-100 bg-blue-50/40 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-blue-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#214ECF]">
            <PenLine className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">Review, Sign & Upload Your Agreement</h3>
            <p className="text-xs text-slate-500">
              Complete steps to execute your Thinkatic Global Delivery Partner Agreement
            </p>
          </div>
        </div>

        {/* 6 Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              step: "01",
              title: "Download the Agreement PDF",
              desc: "Click [Download Agreement PDF] above to obtain the official master contract.",
            },
            {
              step: "02",
              title: "Read carefully",
              desc: "Read the complete agreement carefully, including all 58 clauses and attached schedules.",
            },
            {
              step: "03",
              title: "Complete Details",
              desc: "Complete the required partner/company/signatory details wherever applicable.",
            },
            {
              step: "04",
              title: "Sign Outside Portal",
              desc: "Sign the designated signature section outside the Thinkatic portal with your authorized signatory.",
            },
            {
              step: "05",
              title: "Save as PDF",
              desc: "Save the fully executed and signed agreement as a PDF file (under 25MB).",
            },
            {
              step: "06",
              title: "Upload Signed PDF",
              desc: "Return here and upload the signed PDF below for Thinkatic administrative review.",
            },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-blue-100 bg-white p-4.5 shadow-2xs">
              <span className="font-mono text-xs font-black text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded-md">
                {item.step}
              </span>
              <h4 className="mt-2 text-xs font-bold text-slate-900">{item.title}</h4>
              <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Important Notice */}
        <div className="rounded-2xl border border-blue-200 bg-white p-4.5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-[#214ECF] mt-0.5" />
          <div className="text-xs leading-relaxed text-slate-700">
            <span className="font-bold text-slate-900">Important Notice: </span>
            Thinkatic does not perform online electronic signing in this workflow. The partner must sign the agreement externally and upload the completed signed PDF.
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. SIGNED AGREEMENT UPLOAD SECTION                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF]">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {isRejected ? "Upload Corrected Agreement" : "Upload Signed Agreement"}
              </h3>
              <p className="text-xs text-slate-500">Supported format: PDF only (maximum 25MB)</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-mono text-[11px] font-bold text-slate-700">
            Status: {uploadState}
          </span>
        </div>

        {/* Current Uploaded Details if available */}
        {agreement.signedDocumentFileName && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Signed Agreement Submission
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                v{agreement.version || "1.0"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">File Name</p>
                <p className="font-bold text-slate-900 truncate mt-0.5">{agreement.signedDocumentFileName}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">File Size</p>
                <p className="font-bold text-slate-900 mt-0.5">{formatFileSize(agreement.signedDocumentFileSize)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Submitted Date/Time</p>
                <p className="font-bold text-slate-900 mt-0.5">{formatDate(agreement.signedSubmittedAt)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Review Status</p>
                <p className="font-bold text-[#214ECF] mt-0.5">
                  {isApproved
                    ? "Approved"
                    : isRejected
                    ? "Rejected"
                    : "Pending Admin Review"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleViewSigned()}
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5 text-[#214ECF]" />
                View Uploaded Agreement
              </button>

              <button
                type="button"
                onClick={handleDownloadSigned}
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#214ECF]" />
                Download Signed Copy
              </button>
            </div>
          </div>
        )}

        {/* Upload Drop Zone — Disabled if agreement is approved/immutable */}
        {isApproved ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-6 text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-[#214ECF] mx-auto">
              <Lock className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Signed Agreement Is Legally Approved & Immutable</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              This agreement has been approved by Thinkatic Operations. In accordance with legal compliance rules, approved signed agreements cannot be modified or replaced.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                isDragging
                  ? "border-[#214ECF] bg-blue-50/60"
                  : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id={fileInputId}
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#214ECF] border border-blue-100">
                  <FileUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Drag and drop your signed agreement PDF here, or{" "}
                    <label
                      htmlFor={fileInputId}
                      className="text-[#214ECF] underline cursor-pointer hover:text-[#1a3eb0]"
                    >
                      browse your files
                    </label>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">PDF format only • Up to 25MB</p>
                </div>
              </div>
            </div>

            {/* Selected File Details */}
            {selectedFile && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 truncate">
                  <FileText className="h-5 w-5 text-[#214ECF] shrink-0" />
                  <div className="truncate text-xs">
                    <p className="font-bold text-slate-900 truncate">{selectedFile.name}</p>
                    <p className="text-slate-500 font-mono text-[11px]">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleUploadSubmit}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#1a3eb0] cursor-pointer disabled:opacity-60"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Uploading ({uploadProgress}%)</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        <span>
                          {agreement.signedDocumentFileName
                            ? isRejected
                              ? "Upload Corrected Agreement"
                              : "Replace Agreement"
                            : "Upload Signed Agreement"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Upload Progress Bar */}
            {uploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                  <span>Uploading to Thinkatic Secure Storage...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#214ECF] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div className="flex items-center gap-2 rounded-2xl bg-blue-50/80 border border-blue-200 p-4 text-xs font-semibold text-blue-900">
                <AlertCircle className="h-4 w-4 shrink-0 text-[#214ECF]" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Success Message */}
            {uploadSuccess && (
              <div className="flex items-center gap-2 rounded-2xl bg-blue-50 border border-blue-200 p-4 text-xs font-semibold text-blue-900">
                <CheckCircle className="h-4 w-4 shrink-0 text-[#214ECF]" />
                <span>{uploadSuccess}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. AGREEMENT JOURNEY TIMELINE                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF]">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">Agreement Journey</h3>
            <p className="text-xs text-slate-500">Live progression through accreditation compliance gates</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            {
              step: "01",
              title: "Agreement Pending",
              isComplete: true,
              date: formatDate(agreement.createdAt),
              actor: "System",
            },
            {
              step: "02",
              title: "Agreement Issued",
              isComplete: true,
              date: formatDate(agreement.issuedAt || agreement.createdAt),
              actor: "Operations Admin",
            },
            {
              step: "03",
              title: "Ready for Signature",
              isComplete: true,
              date: formatDate(agreement.createdAt),
              actor: "Partner Download",
            },
            {
              step: "04",
              title: "Signed PDF Uploaded",
              isComplete: Boolean(agreement.signedDocumentFileName),
              date: formatDate(agreement.signedSubmittedAt),
              actor: agreement.signedSubmittedBy || "Partner Signatory",
            },
            {
              step: "05",
              title: "Under Admin Review",
              isComplete: isSubmitted || isApproved || isRejected,
              date: agreement.signedSubmittedAt ? formatDate(agreement.signedSubmittedAt) : "Pending Upload",
              actor: "Operations Team",
            },
            {
              step: "06",
              title: isRejected ? "Agreement Rejected" : "Approved / Review",
              isComplete: isApproved || isRejected,
              date: isApproved
                ? formatDate(agreement.approvedAt)
                : isRejected
                ? formatDate(agreement.rejectedAt)
                : "Awaiting Review",
              actor: agreement.approvedByAdminName || "Operations Admin",
            },
            {
              step: "07",
              title: "Partner Activation",
              isComplete: isApproved,
              date: isApproved ? formatDate(agreement.approvedAt) : "Pending All Gates",
              actor: "Compliance Gateway",
            },
          ].map((item) => (
            <div
              key={item.step}
              className={`rounded-2xl border p-4 transition-all ${
                item.isComplete
                  ? "border-blue-200 bg-blue-50/40 shadow-2xs"
                  : "border-slate-100 bg-slate-50/50 text-slate-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-xs font-bold ${
                    item.isComplete ? "text-[#214ECF]" : "text-slate-400"
                  }`}
                >
                  {item.step}
                </span>
                {item.isComplete ? (
                  <CheckCircle className="h-4 w-4 text-[#214ECF]" />
                ) : (
                  <Clock className="h-4 w-4 text-slate-300" />
                )}
              </div>

              <h4
                className={`mt-2 text-xs font-bold ${
                  item.isComplete ? "text-slate-900" : "text-slate-500"
                }`}
              >
                {item.title}
              </h4>
              <p className="mt-1 text-[10px] text-slate-500 leading-normal truncate">{item.date}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-slate-600 truncate">{item.actor}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. AGREEMENT SUBMISSION HISTORY                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#214ECF]">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Agreement History</h3>
              <p className="text-xs text-slate-500">Historical versions and audit records</p>
            </div>
          </div>

          <span className="text-xs font-semibold text-slate-500">
            Total Submissions: {agreement.submissions ? agreement.submissions.length : 0}
          </span>
        </div>

        {agreement.submissions && agreement.submissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="pb-3 pl-2">Version</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Uploaded Date</th>
                  <th className="pb-3">Submitted By</th>
                  <th className="pb-3">Reviewed By</th>
                  <th className="pb-3">Reviewed Date</th>
                  <th className="pb-3">Rejection Reason</th>
                  <th className="pb-3 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agreement.submissions.map((sub, idx) => (
                  <tr key={sub.id || idx} className="hover:bg-slate-50/60">
                    <td className="py-3.5 pl-2 font-mono font-bold text-slate-900">
                      v{sub.version || `1.${idx}`}
                    </td>
                    <td className="py-3.5">
                      <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase text-[#214ECF]">
                        {sub.status === "approved"
                          ? "Approved"
                          : sub.status === "rejected"
                          ? "Rejected"
                          : "Pending Review"}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-600 font-medium">
                      {formatDate(sub.submittedAt || sub.uploadedAt)}
                    </td>
                    <td className="py-3.5 text-slate-700 font-medium truncate max-w-[140px]">
                      {sub.submittedBy || "Partner Signatory"}
                    </td>
                    <td className="py-3.5 text-slate-700 font-medium">
                      {sub.reviewedByAdminName || (sub.reviewedAt ? "Operations Admin" : "—")}
                    </td>
                    <td className="py-3.5 text-slate-600 font-medium">
                      {sub.reviewedAt ? formatDate(sub.reviewedAt) : "—"}
                    </td>
                    <td className="py-3.5 text-slate-600 max-w-[200px] truncate">
                      {sub.rejectionReason || "—"}
                    </td>
                    <td className="py-3.5 pr-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleViewSigned()}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#214ECF] hover:underline cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
            No signed agreement submissions recorded yet. Download the master agreement above to begin.
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: VIEW ORIGINAL MASTER AGREEMENT                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isViewOriginalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#214ECF]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Thinkatic Global Delivery Partner Agreement
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official Master Source: Agreement/BPO Agreement.pdf (23 Pages) • ID: {agreement.agreementCode}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadOriginal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#1a3eb0] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsViewOriginalOpen(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 h-[72vh] p-4 bg-slate-100/50">
              <iframe
                src={`/api/bpo/agreement/view?token=${encodeURIComponent(token)}`}
                className="w-full h-full rounded-2xl border border-slate-200 bg-white"
                title="Thinkatic Master BPO Agreement PDF"
              />
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: VIEW UPLOADED SIGNED AGREEMENT                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isViewSignedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#214ECF]">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Uploaded Signed Partner Agreement
                  </h3>
                  <p className="text-xs text-slate-500">
                    File: {agreement.signedDocumentFileName || "Signed-Agreement.pdf"} • Submitted: {formatDate(agreement.signedSubmittedAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSigned}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#1a3eb0] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Signed PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsViewSignedOpen(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 h-[72vh] p-4 bg-slate-100/50">
              <iframe
                src={signedViewerUrl || `/api/bpo/agreement/view-signed?token=${encodeURIComponent(token)}`}
                className="w-full h-full rounded-2xl border border-slate-200 bg-white"
                title="Uploaded Signed Partner Agreement PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileSignatureIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 19.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5L20 7.5V11" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M18.42 9.61a2.1 2.1 0 1 1 2.97 2.97L16.95 17 13 18l.99-3.95 4.43-4.44Z" />
    </svg>
  );
}
