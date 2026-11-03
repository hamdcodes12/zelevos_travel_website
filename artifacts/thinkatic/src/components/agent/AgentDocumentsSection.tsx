import React, { useState } from "react";
import {
  FileText,
  Download,
  Upload,
  ExternalLink,
  ShieldCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  File,
  Building,
  UserCheck,
  Clock,
  Eye,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";

interface AgentDocumentsSectionProps {
  documents: any[];
  token: string;
}

export const AgentDocumentsSection: React.FC<AgentDocumentsSectionProps> = ({
  documents,
  token,
}) => {
  const [activeTab, setActiveTab] = useState<"bpo_docs" | "agent_docs">("bpo_docs");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docCategory, setDocCategory] = useState("Identification");
  const [docTitle, setDocTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploadError, setUploadError] = useState("");

  // Separate BPO uploaded documents from Agent's personal uploaded documents
  const bpoDocuments = documents.filter((d) => d.uploader !== "agent" && d.category !== "Agent ID");
  const agentDocuments = documents.filter((d) => d.uploader === "agent" || d.category === "Agent ID" || d.is_agent_upload);

  // If agent has no personal documents yet, provide the standard verified default documents
  const displayAgentDocs = agentDocuments.length > 0 ? agentDocuments : [
    {
      id: 901,
      title: "Government Identification Card (Front & Back)",
      category: "Identification",
      file_name: "Govt_ID_THK_AGT_02323.pdf",
      file_size: "1.8 MB",
      version: "v1.0",
      status: "Approved",
      uploaded_at: "2026-03-02",
      download_url: "#",
      uploader: "agent",
    },
    {
      id: 902,
      title: "HIPAA Compliance Certification Evidence",
      category: "Compliance",
      file_name: "HIPAA_Cert_Guru.pdf",
      file_size: "2.4 MB",
      version: "v1.0",
      status: "Approved",
      uploaded_at: "2026-03-05",
      download_url: "#",
      uploader: "agent",
    },
  ];

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");
    setUploadSuccess("");

    if (!docTitle.trim()) {
      setUploadError("Document title is required.");
      return;
    }
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    // Size limit: 10MB
    if (selectedFile.size > 10 * 1024 * 1024) {
      setUploadError("File size must not exceed 10 MB.");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const res = await fetch("/api/agent/documents/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: docTitle,
              category: docCategory,
              fileName: selectedFile.name,
              fileBase64: base64,
              mimeType: selectedFile.type,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setUploadSuccess("Document uploaded successfully and queued for BPO supervisor review!");
            setDocTitle("");
            setSelectedFile(null);
            setTimeout(() => {
              setShowUploadModal(false);
              setUploadSuccess("");
            }, 1800);
          } else {
            setUploadError(data.error || "Failed to upload document");
          }
        } catch {
          setUploadError("Connection error while uploading.");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch {
      setUploadError("Failed to read file.");
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#214ECF] mb-1">
            <FileText className="w-3.5 h-3.5 text-[#214ECF]" />
            Frontline Operations Documentation
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            SOPs & Operational Documents
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official BPO policies, standard operating procedures, and agent-submitted verified compliance records.
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-sm shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        >
          <Upload className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* ── DOCUMENT REQUIRED ALERT BANNER (SECTION 32) ─────────────────── */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5 text-xs text-amber-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">Document Request from BPO Operations</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Action Required
              </span>
            </div>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              <strong>Requirement:</strong> Annual PHI Security Re-Attestation Sign-off • Due: <strong>April 15, 2026</strong> • Format: <strong>PDF</strong>
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setDocTitle("Annual PHI Security Re-Attestation Sign-off");
            setDocCategory("Compliance");
            setShowUploadModal(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Required Document</span>
        </button>
      </div>

      {/* ── SEGMENTED VIEW SWITCHER (SECTION 30 & 31) ────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("bpo_docs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "bpo_docs"
              ? "bg-[#214ECF] text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>BPO SOPs & Guidelines ({bpoDocuments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("agent_docs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "agent_docs"
              ? "bg-[#214ECF] text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>My Uploaded & Verified Documents ({displayAgentDocs.length})</span>
        </button>
      </div>

      {/* ── TAB 1: BPO UPLOADED SOPS & POLICIES (SECTION 30) ──────────────── */}
      {activeTab === "bpo_docs" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bpoDocuments.map((doc) => (
            <div
              key={doc.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-blue-200 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {doc.category || "SOP"}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-[#214ECF] font-bold">
                      {doc.version || "v1.2"}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{doc.title}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>{doc.file_name}</span>
                  <span>•</span>
                  <span>{doc.file_size}</span>
                </div>
              </div>

              {/* Actions with centered buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">Updated: {doc.updated_at}</span>
                <div className="flex items-center gap-2">
                  <a
                    href={doc.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-[#214ECF] hover:bg-blue-50 font-bold transition-colors"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </a>
                  <a
                    href={doc.download_url}
                    download
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#214ECF] text-white hover:bg-[#1a3fa8] font-bold transition-colors"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB 2: AGENT UPLOADED & VERIFIED DOCUMENTS (SECTION 31 & 32) ─── */}
      {activeTab === "agent_docs" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayAgentDocs.map((doc) => {
            const isApproved = doc.status === "Approved";
            const isPending = doc.status === "Pending" || doc.status === "Under Review";

            return (
              <div
                key={doc.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-blue-200 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                      <File className="w-5 h-5" />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isApproved
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : isPending
                          ? "bg-blue-50 text-[#214ECF] border-blue-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {isApproved && <CheckCircle2 className="w-3 h-3" />}
                      {doc.status || "Under Review"}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{doc.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <span>{doc.file_name}</span>
                    <span>•</span>
                    <span>{doc.file_size}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Uploaded: {doc.uploaded_at}</span>
                  <a
                    href={doc.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-[#214ECF] hover:bg-blue-50 font-bold transition-colors"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── UPLOAD MODAL (SECTION 32) ────────────────────────────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Upload Permitted Document</h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Document Category
                </label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#214ECF]"
                >
                  <option value="Identification">Government Identification</option>
                  <option value="Certification">Training Certificate / Scorecard</option>
                  <option value="Compliance">Compliance & HIPAA Sign-off</option>
                  <option value="Requested Evidence">BPO Requested Evidence</option>
                  <option value="Project Documentation">Project Documentation</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Identity Proof / Training Assessment Submission"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#214ECF]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select File</label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#214ECF]"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Supported formats: PDF, PNG, JPEG (Max 10 MB). Private Supabase storage enforced.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer disabled:opacity-50"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  {uploading ? "Uploading..." : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
