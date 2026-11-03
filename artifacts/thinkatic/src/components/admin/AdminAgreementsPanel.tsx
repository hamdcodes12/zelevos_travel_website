import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building2,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  FileCheck,
  ExternalLink,
} from "lucide-react";

interface AgreementRow {
  id: number;
  partnerName: string;
  tradeName: string;
  partnerId: string | null;
  applicationId: number | null;
  centreId: string | null;
  agreementId: string;
  version: string;
  status: string;
  issuedDate: string;
  submittedDate: string | null;
  submittedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectionReason: string | null;
  isImmutable: boolean;
  hasSignedDocument: boolean;
  signedFileName: string | null;
  submissionsCount: number;
}

export default function AdminAgreementsPanel() {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementRow | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Manual Review Checklist state (Human verification, strictly NO AI)
  const [checklist, setChecklist] = useState({
    correctPartner: false,
    requiredFieldsCompleted: false,
    agreementSigned: false,
    requiredSignaturePresent: false,
    requiredDatePresent: false,
    companySealAffixed: false,
    documentReadable: false,
    correctVersion: false,
    noMissingPages: false,
    correspondsToIssued: false,
  });

  const [reviewTab, setReviewTab] = useState<"checklist" | "preview_signed" | "preview_generated">("checklist");
  const token = localStorage.getItem("admin_token") || localStorage.getItem("auth_token") || "";

  const fetchAgreements = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/agreements?status=${filterStatus}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.agreements)) {
        setAgreements(data.agreements);
      }
    } catch (err) {
      console.error("Failed to load partner agreements for admin", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgreements();
  }, [filterStatus]);

  const handleViewTemplate = () => {
    window.open(`/api/admin/agreements/template?token=${encodeURIComponent(token)}`, "_blank");
  };

  const handleViewGenerated = (agr: AgreementRow) => {
    window.open(`/api/admin/agreements/${agr.id}/generated-document?token=${encodeURIComponent(token)}`, "_blank");
  };

  const handleViewSigned = (agr: AgreementRow) => {
    window.open(`/api/admin/agreements/${agr.id}/signed-document?token=${encodeURIComponent(token)}`, "_blank");
  };

  const handleDownloadSigned = (agr: AgreementRow) => {
    window.open(`/api/admin/agreements/${agr.id}/download-signed?token=${encodeURIComponent(token)}`, "_blank");
  };

  const handleOpenReview = (agr: AgreementRow) => {
    setSelectedAgreement(agr);
    setReviewTab("checklist");
    setChecklist({
      correctPartner: false,
      requiredFieldsCompleted: false,
      agreementSigned: false,
      requiredSignaturePresent: false,
      requiredDatePresent: false,
      companySealAffixed: false,
      documentReadable: false,
      correctVersion: false,
      noMissingPages: false,
      correspondsToIssued: false,
    });
    setActionError(null);
    setActionSuccess(null);
    setReviewModalOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedAgreement) return;
    setProcessing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/agreements/${selectedAgreement.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Agreement ${selectedAgreement.agreementId} approved. Partner activated!`);
        setApproveConfirmOpen(false);
        setReviewModalOpen(false);
        await fetchAgreements();
      } else {
        setActionError(data.error || "Failed to approve agreement.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to approve agreement.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedAgreement) return;
    if (!rejectReason.trim()) {
      setActionError("A rejection reason is strictly required.");
      return;
    }
    setProcessing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/agreements/${selectedAgreement.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Agreement ${selectedAgreement.agreementId} rejected. Partner notified.`);
        setRejectModalOpen(false);
        setReviewModalOpen(false);
        setRejectReason("");
        await fetchAgreements();
      } else {
        setActionError(data.error || "Failed to reject agreement.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to reject agreement.");
    } finally {
      setProcessing(false);
    }
  };

  const filtered = agreements.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.partnerName.toLowerCase().includes(q) ||
      a.agreementId.toLowerCase().includes(q) ||
      (a.centreId && a.centreId.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#214ECF]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#214ECF]">
              <ShieldCheck className="h-3.5 w-3.5" /> Legal Governance
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-700">
              Healweal LLC
            </span>
          </div>
          <h2 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">
            Partner Agreements Ledger
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Manual Human Admin Verification • Offline Signed PDF Review • Strict Zero AI Policy
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleViewTemplate}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-sm"
          >
            <FileText className="h-4 w-4 text-[#214ECF]" />
            View Original Template (23 Pages)
          </button>

          <button
            type="button"
            onClick={fetchAgreements}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Global Action Message */}
      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Partner, Trade, Centre ID, or Agreement ID..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:border-[#214ECF] focus:bg-white focus:outline-none transition"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "all", label: "All Agreements" },
            { id: "signed_agreement_submitted", label: "Pending Review" },
            { id: "approved", label: "Approved" },
            { id: "rejected", label: "Rejected" },
            { id: "agreement_ready", label: "Awaiting Upload" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterStatus(f.id)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition whitespace-nowrap ${
                filterStatus === f.id
                  ? "bg-[#214ECF] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Agreements Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4">Partner Name & Trade</th>
                <th className="px-4 py-4">Partner / App ID</th>
                <th className="px-4 py-4">Centre ID</th>
                <th className="px-4 py-4">Agreement ID</th>
                <th className="px-3 py-4">Ver</th>
                <th className="px-4 py-4">Issued Date</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Submitted Date</th>
                <th className="px-4 py-4">Submitted By</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#214ECF]" />
                    <p className="mt-2 text-xs font-semibold">Loading Agreements...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                    <FileText className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-xs font-semibold">No agreements match your criteria.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((agr) => {
                  const isApproved = agr.status === "approved";
                  const isRejected = agr.status === "rejected";
                  const isPending = agr.status === "signed_agreement_submitted" || agr.status === "admin_review";

                  return (
                    <tr key={agr.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">{agr.partnerName}</p>
                        {agr.tradeName && agr.tradeName !== agr.partnerName ? (
                          <p className="text-[10px] text-slate-400">Trade: {agr.tradeName}</p>
                        ) : (
                          <p className="text-[10px] text-slate-400">Global Delivery Partner</p>
                        )}
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] text-slate-600">
                        {agr.partnerId ? `UID:${agr.partnerId.slice(0, 8)}` : agr.applicationId ? `APP#${agr.applicationId}` : "—"}
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-slate-800">
                        {agr.centreId || "—"}
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-[#214ECF]">
                        {agr.agreementId}
                      </td>
                      <td className="px-3 py-4 font-medium text-slate-600">
                        v{agr.version}
                      </td>
                      <td className="px-4 py-4 text-[11px] text-slate-500 whitespace-nowrap">
                        {agr.issuedDate ? new Date(agr.issuedDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-4">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" /> Approved
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold text-rose-800">
                            <AlertTriangle className="h-3 w-3" /> Rejected
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                            <Clock className="h-3 w-3" /> Pending Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800">
                            <FileCheck className="h-3 w-3" /> Awaiting Upload
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-[11px] text-slate-500 whitespace-nowrap">
                        {agr.submittedDate
                          ? new Date(agr.submittedDate).toLocaleDateString()
                          : "Not submitted"}
                      </td>
                      <td className="px-4 py-4 text-[11px] text-slate-600">
                        {agr.submittedBy || "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewGenerated(agr)}
                            title="View Generated 23-Page PDF"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                          >
                            <FileText className="h-3 w-3 text-slate-500" /> Gen PDF
                          </button>

                          {agr.hasSignedDocument && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleViewSigned(agr)}
                                title="View Signed PDF"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                              >
                                <Eye className="h-3 w-3 text-[#214ECF]" /> Signed
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDownloadSigned(agr)}
                                title="Download Signed PDF"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                              >
                                <Download className="h-3 w-3 text-slate-500" />
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenReview(agr)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition ${
                              isApproved
                                ? "bg-slate-600 hover:bg-slate-700"
                                : "bg-[#214ECF] hover:bg-[#1a3eb0]"
                            }`}
                          >
                            {isApproved ? "Inspect" : "Review"}
                          </button>

                          {!agr.isImmutable && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAgreement(agr);
                                setRejectReason("");
                                setRejectModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Manual Review Modal */}
      {reviewModalOpen && selectedAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 p-6 bg-slate-50 gap-3">
              <div>
                <span className="rounded-full bg-[#214ECF]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#214ECF]">
                  Manual Human Review (Strictly Zero AI)
                </span>
                <h3 className="mt-1 text-lg font-black text-slate-900">
                  Review Agreement — {selectedAgreement.agreementId}
                </h3>
                <p className="text-xs text-slate-500">
                  Partner: <span className="font-semibold text-slate-800">{selectedAgreement.partnerName}</span> • Centre ID: {selectedAgreement.centreId || "—"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl bg-slate-200/70 p-1">
                  <button
                    type="button"
                    onClick={() => setReviewTab("checklist")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      reviewTab === "checklist"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Checklist & Decision
                  </button>
                  {selectedAgreement.hasSignedDocument && (
                    <button
                      type="button"
                      onClick={() => setReviewTab("preview_signed")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        reviewTab === "preview_signed"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Signed PDF
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setReviewTab("preview_generated")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      reviewTab === "preview_generated"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Generated PDF (23p)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {reviewTab === "preview_signed" ? (
              <div className="flex flex-col p-4 flex-1 h-[70vh]">
                <div className="flex items-center justify-between pb-2 text-xs text-slate-500">
                  <span>Uploaded Partner Signed Document ({selectedAgreement.signedFileName || "Signed_Agreement.pdf"})</span>
                  <a
                    href={`/api/admin/agreements/${selectedAgreement.id}/signed-document?token=${encodeURIComponent(token)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#214ECF] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
                  </a>
                </div>
                <iframe
                  src={`/api/admin/agreements/${selectedAgreement.id}/signed-document?token=${encodeURIComponent(token)}`}
                  className="w-full flex-1 rounded-2xl border border-slate-200 bg-slate-100"
                  title="Signed Agreement Document"
                />
              </div>
            ) : reviewTab === "preview_generated" ? (
              <div className="flex flex-col p-4 flex-1 h-[70vh]">
                <div className="flex items-center justify-between pb-2 text-xs text-slate-500">
                  <span>Populated Global Delivery Partner Agreement (Preserving all 23 Pages)</span>
                  <a
                    href={`/api/admin/agreements/${selectedAgreement.id}/generated-document?token=${encodeURIComponent(token)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#214ECF] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
                  </a>
                </div>
                <iframe
                  src={`/api/admin/agreements/${selectedAgreement.id}/generated-document?token=${encodeURIComponent(token)}`}
                  className="w-full flex-1 rounded-2xl border border-slate-200 bg-slate-100"
                  title="Generated 23-Page Agreement PDF"
                />
              </div>
            ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
              {/* Document Overview Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="font-bold text-slate-900">Official Agreement Documents</p>
                  <p className="text-slate-500 text-[11px]">
                    {selectedAgreement.hasSignedDocument ? `Uploaded: ${selectedAgreement.signedFileName}` : "Signed document pending upload from Partner"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedAgreement.hasSignedDocument && (
                    <a
                      href={`/api/admin/agreements/${selectedAgreement.id}/signed-document?token=${encodeURIComponent(token)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#214ECF] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#1a3eb0]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View Signed PDF
                    </a>
                  )}
                  <a
                    href={`/api/admin/agreements/${selectedAgreement.id}/generated-document?token=${encodeURIComponent(token)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100"
                  >
                    <FileText className="h-3.5 w-3.5 text-slate-500" /> View Gen PDF (23p)
                  </a>
                  <a
                    href={`/api/admin/agreements/template?token=${encodeURIComponent(token)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100"
                  >
                    <FileText className="h-3.5 w-3.5 text-[#214ECF]" /> View Template
                  </a>
                </div>
              </div>

              {/* Strict Manual Verification Checklist (Explicit Human Inspection Rules) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#214ECF]" />
                  <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider">
                    Admin Verification Checklist (Strictly Human Verified)
                  </h4>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Confirm each requirement before executing formal approval. Automated/AI approvals are prohibited.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  {[
                    { key: "correctPartner", label: "Correct Partner & Legal Entity Name" },
                    { key: "requiredFieldsCompleted", label: "Required Partner Fields Completed" },
                    { key: "agreementSigned", label: "Agreement Signed by Authorized Signatory" },
                    { key: "requiredSignaturePresent", label: "Physical/Digital Signature Clear & Valid" },
                    { key: "requiredDatePresent", label: "Execution Date Present and Accurate" },
                    { key: "companySealAffixed", label: "Company Seal / Official Stamp Affixed" },
                    { key: "documentReadable", label: "Document is Completely Readable & Legible" },
                    { key: "correctVersion", label: "Correct Agreement Version (v1.0)" },
                    { key: "noMissingPages", label: "No Obvious Missing Pages or Blank Sections" },
                    { key: "correspondsToIssued", label: "Corresponds to Issued Template & 58 Clauses" },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(checklist as any)[item.key]}
                        onChange={(e) =>
                          setChecklist({ ...checklist, [item.key]: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#214ECF] focus:ring-[#214ECF]"
                      />
                      <span className="font-medium text-slate-800">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Error */}
              {actionError && (
                <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}
            </div>
            )}

            {/* Modal Footer with Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50">
              <span className="text-[11px] text-slate-500">
                Decision is legally binding and recorded in immutable audit logs.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(true)}
                  disabled={selectedAgreement.isImmutable}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                >
                  Reject Agreement
                </button>

                <button
                  type="button"
                  onClick={() => setApproveConfirmOpen(true)}
                  disabled={selectedAgreement.isImmutable}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md transition disabled:opacity-50"
                >
                  Approve Agreement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {approveConfirmOpen && selectedAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Approve Global Delivery Partner Agreement?</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Approve this signed Global Delivery Partner Agreement and activate the Partner according to onboarding requirements?
              </p>
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] space-y-1 text-slate-600">
                <p>• Agreement Code: <span className="font-mono font-bold text-slate-900">{selectedAgreement.agreementId}</span></p>
                <p>• Partner Name: <span className="font-bold text-slate-900">{selectedAgreement.partnerName}</span></p>
                <p>• Status will become <span className="font-bold text-emerald-700">APPROVED</span> (Immutable)</p>
                <p>• Partner will be granted active BPO Partner Dashboard access</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApproveConfirmOpen(false)}
                disabled={processing}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={processing}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
              >
                {processing ? "Approving..." : "Confirm & Activate Partner"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal with Mandatory Reason */}
      {rejectModalOpen && selectedAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Reject Signed Agreement</h3>
              <p className="mt-1 text-xs text-slate-600">
                A rejection reason is strictly required so the Partner can review and rectify the document.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Rejection Reason (Required)
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Signature missing on Partner signature page, or document illegible..."
                className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-900 focus:border-rose-500 focus:bg-white focus:outline-none transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                disabled={processing}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-sm disabled:opacity-50"
              >
                {processing ? "Rejecting..." : "Submit Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
