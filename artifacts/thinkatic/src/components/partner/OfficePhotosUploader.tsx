// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — CATEGORIZED OFFICE PHOTOS UPLOADER
// Allows BPO Partners to upload clear categorized photographs of their actual centre.
// Reception, Workstations, Operations, Infrastructure, Network, Power Backup, Security.
// ==============================================================================

import { useState, useRef } from "react";
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Camera,
  RotateCcw,
  Loader2,
  Building2,
  X,
  FileCheck,
} from "lucide-react";

export interface PhotoCategory {
  id: string;
  label: string;
  required: boolean;
  description: string;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const PHOTO_CATEGORIES: PhotoCategory[] = [
  {
    id: "reception_entrance",
    label: "Reception / Entrance",
    required: true,
    description: "Main office entrance, company reception desk, signage, and waiting lobby.",
  },
  {
    id: "workstation_area",
    label: "Workstation Area",
    required: true,
    description: "Ergonomic workstations, agent desk clusters, PC setups, and seating rows.",
  },
  {
    id: "operations_area",
    label: "Operations Floor",
    required: true,
    description: "Broad panoramic view of the active calling floor and operational layout.",
  },
  {
    id: "management_area",
    label: "Management / Supervisor Area",
    required: false,
    description: "Team leader monitoring stations, QA room, and conference/training area.",
  },
  {
    id: "infrastructure_equipment",
    label: "Infrastructure & Equipment",
    required: true,
    description: "Agent desktop specs, noise-canceling headsets, and server hardware.",
  },
  {
    id: "network_setup",
    label: "Internet / Network Setup",
    required: true,
    description: "Server rack, network switches, routers, and primary/secondary ISP termination.",
  },
  {
    id: "power_backup",
    label: "Power Backup (UPS / DG Set)",
    required: true,
    description: "Online industrial UPS battery banks, switchgear panel, or diesel generator set.",
  },
  {
    id: "security_access",
    label: "Security & Access Control",
    required: false,
    description: "Biometric fingerprint scanner, RFID card entry, CCTV camera coverage, fire exits.",
  },
];

interface OfficePhotosUploaderProps {
  verificationId?: number | null;
  applicationId?: number | null;
  media: any[];
  onPhotoUploaded: (media: any) => void;
  readOnly?: boolean;
}

export default function OfficePhotosUploader({
  verificationId,
  applicationId,
  media = [],
  onPhotoUploaded,
  readOnly = false,
}: OfficePhotosUploaderProps) {
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [categoryErrors, setCategoryErrors] = useState<Record<string, string | null>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [previewMedia, setPreviewMedia] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeCategoryRef = useRef<string | null>(null);

  const token =
    localStorage.getItem("user_token") ||
    localStorage.getItem("thinkatic_user_token") ||
    localStorage.getItem("bpo_applicant_token") ||
    localStorage.getItem("token") ||
    "";

  // Get active or reviewed photo for category
  function getMediaForCategory(catId: string) {
    const matching = media.filter(
      (m) => m.mediaType === "photo" && m.category === catId && m.status !== "superseded" && m.status !== "archived"
    );
    return matching[matching.length - 1] || null;
  }

  function handleTriggerUpload(catId: string) {
    if (readOnly) return;
    activeCategoryRef.current = catId;
    setErrorMsg("");
    setCategoryErrors((prev) => ({ ...prev, [catId]: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const category = activeCategoryRef.current;
    if (!file || !category) {
      activeCategoryRef.current = null;
      return;
    }

    // Validate size: 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      const err = "Selected photograph exceeds the 10MB maximum file size limit.";
      setErrorMsg(err);
      setCategoryErrors((prev) => ({ ...prev, [category]: err }));
      activeCategoryRef.current = null;
      return;
    }

    // Validate MIME
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimes.includes(file.type.toLowerCase())) {
      const err = "Invalid file format. Please upload JPG, PNG, or WEBP images.";
      setErrorMsg(err);
      setCategoryErrors((prev) => ({ ...prev, [category]: err }));
      activeCategoryRef.current = null;
      return;
    }

    setUploadingCategory(category);
    setErrorMsg("");
    setCategoryErrors((prev) => ({ ...prev, [category]: null }));

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;

          const res = await fetch("/api/bpo/centre-verification/photo", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              category,
              fileName: file.name,
              mimeType: file.type || "image/jpeg",
              fileData: base64Data,
              verificationId: verificationId || undefined,
              applicationId: applicationId || undefined,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.message || data.error || "Failed to upload photo.");
          }

          onPhotoUploaded(data.media);
          setUploadingCategory(null);
          activeCategoryRef.current = null;
        } catch (postErr: any) {
          console.error("Photo upload error:", postErr);
          const msg = postErr.message || "Failed to upload photo.";
          setErrorMsg(msg);
          setCategoryErrors((prev) => ({ ...prev, [category]: msg }));
          setUploadingCategory(null);
          activeCategoryRef.current = null;
        }
      };

      reader.onerror = () => {
        const msg = "Failed to read image file.";
        setErrorMsg(msg);
        setCategoryErrors((prev) => ({ ...prev, [category]: msg }));
        setUploadingCategory(null);
        activeCategoryRef.current = null;
      };
    } catch (err: any) {
      console.error("Photo upload error:", err);
      const msg = err.message || "Error uploading photo.";
      setErrorMsg(msg);
      setCategoryErrors((prev) => ({ ...prev, [category]: msg }));
      setUploadingCategory(null);
      activeCategoryRef.current = null;
    }
  }

  const uploadedCount = PHOTO_CATEGORIES.filter((cat) => {
    const m = getMediaForCategory(cat.id);
    return Boolean(m && (m.status === "active" || m.status === "approved"));
  }).length;
  const requiredCount = PHOTO_CATEGORIES.filter((cat) => cat.required).length;
  const requiredUploaded = PHOTO_CATEGORIES.filter((cat) => {
    const m = getMediaForCategory(cat.id);
    return cat.required && Boolean(m && (m.status === "active" || m.status === "approved"));
  }).length;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <h4 className="text-sm font-black text-[#0B1F3A]">Categorized Office Evidence</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload current, clear photographs corresponding to key operational zones of your centre.
          </p>
          <div className="flex items-center gap-3 mt-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#214ECF]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#214ECF]" />
              6 Required Categories
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              2 Optional Categories (Supervisor Area, Security)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs font-bold text-slate-500">Required Uploads</span>
            <p className="text-sm font-black text-[#0B1F3A]">
              {requiredUploaded} / {requiredCount} Complete
            </p>
          </div>
          <div
            className="h-10 w-10 rounded-xl bg-[#214ECF]/10 text-[#214ECF] font-black text-xs"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {requiredCount > 0 ? Math.round((requiredUploaded / requiredCount) * 100) : 0}%
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PHOTO_CATEGORIES.map((category) => {
          const existing = getMediaForCategory(category.id);
          const isUploading = uploadingCategory === category.id;
          const catError = categoryErrors[category.id];
          const isRejected = existing?.status === "rejected" || existing?.status === "resubmission_required";

          return (
            <div
              key={category.id}
              className={`rounded-2xl border p-5 transition relative flex flex-col justify-between ${
                isRejected
                  ? "border-rose-300 bg-rose-50/30"
                  : existing
                  ? "border-emerald-200 bg-emerald-50/20"
                  : catError
                  ? "border-rose-200 bg-rose-50/20"
                  : category.required
                  ? "border-slate-300 bg-white"
                  : "border-slate-200 bg-slate-50/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-[#0B1F3A] flex items-center gap-1.5">
                    {category.label}
                    {category.required ? (
                      <span className="rounded-md bg-blue-100 text-[#214ECF] text-[10px] font-bold px-1.5 py-0.5">
                        Required
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5">
                        Optional
                      </span>
                    )}
                  </span>

                  {existing ? (
                    existing.status === "approved" ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Approved ✓
                      </span>
                    ) : existing.status === "rejected" ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Rejected
                      </span>
                    ) : existing.status === "resubmission_required" ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Resubmission Requested
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Uploaded ✓
                      </span>
                    )
                  ) : isUploading ? (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Loader2 className="h-3 w-3 animate-spin text-[#214ECF]" />
                      Uploading...
                    </span>
                  ) : catError ? (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Upload failed
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      Not Uploaded
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {category.description}
                </p>

                {/* Reviewer Feedback / Rejection Notice */}
                {isRejected && existing?.rejectionReason && (
                  <div className="mt-2.5 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                    <span className="font-bold">Reviewer Feedback:</span> {existing.rejectionReason}
                  </div>
                )}
              </div>

              {/* Photo Card Preview / Action */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                {existing ? (
                  <div className="flex items-center justify-between gap-3 w-full">
                    {/* Left side: Thumbnail + File details */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-200 overflow-hidden shrink-0"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <img
                          src={`/api/bpo/centre-verification/media/${existing.id}?token=${token}`}
                          alt={category.label}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate" title={existing.originalFileName}>
                          {existing.originalFileName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {formatFileSize(existing.fileSize)} · {existing.status.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    {/* Right side: Action buttons centered with flex */}
                    <div className="flex items-center gap-1.5 shrink-0" style={{ display: "flex", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => setPreviewMedia(existing)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#214ECF] hover:border-[#214ECF]/30 hover:bg-blue-50/50 transition shrink-0 cursor-pointer shadow-2xs"
                        title="View Full Photo"
                      >
                        <Eye className="h-4 w-4 shrink-0" />
                      </button>

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleTriggerUpload(category.id)}
                          disabled={isUploading}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                          className={`inline-flex items-center justify-center h-8 w-8 rounded-lg border transition shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs ${
                            isRejected
                              ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-slate-200 bg-white text-slate-600 hover:text-[#214ECF] hover:border-[#214ECF]/30 hover:bg-blue-50/50"
                          }`}
                          title={isRejected ? "Upload Corrected Photo" : "Replace Photo"}
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#214ECF]" />
                          ) : (
                            <RotateCcw className="h-4 w-4 shrink-0" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ) : catError ? (
                  <div className="w-full flex items-center justify-between gap-2 p-2 rounded-xl bg-rose-50 border border-rose-200">
                    <span className="text-xs font-semibold text-rose-700 truncate" title={catError}>
                      {catError}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleTriggerUpload(category.id)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                        className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-white border border-rose-300 rounded-lg hover:bg-rose-100 transition shrink-0 cursor-pointer"
                      >
                        Try Again
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="w-full">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleTriggerUpload(category.id)}
                        disabled={isUploading}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#214ECF]/50 bg-blue-50/40 px-3 py-2.5 text-xs font-bold text-[#214ECF] hover:bg-blue-50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 shrink-0" />
                            Upload Photo
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden p-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-white">
              <span className="text-xs font-bold">{previewMedia.originalFileName}</span>
              <button
                type="button"
                onClick={() => setPreviewMedia(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="py-4 flex items-center justify-center max-h-[75vh]">
              <img
                src={`/api/bpo/centre-verification/media/${previewMedia.id}?token=${token}`}
                alt="Enlarged evidence"
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
