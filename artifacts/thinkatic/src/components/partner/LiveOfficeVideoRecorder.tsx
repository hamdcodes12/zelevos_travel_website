// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — LIVE OFFICE VIDEO RECORDER
// In-browser live camera & microphone walkthrough recording.
// Explicit confirmation required before submission (No silent uploads).
// Review, Retake, and Playback preview before submission.
// ==============================================================================

import { useState, useRef, useEffect } from "react";
import {
  Video,
  Play,
  Square,
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Eye,
  Camera,
  Mic,
  FileCheck,
  Loader2,
  Info,
  CloudUpload,
} from "lucide-react";
import { formatFileSize } from "./OfficePhotosUploader";

interface LiveOfficeVideoRecorderProps {
  verificationId?: number | null;
  applicationId?: number | null;
  onVideoSubmitted?: (media: any) => void;
  existingVideo?: {
    id: number;
    originalFileName: string;
    fileSize: number;
    durationSeconds?: number | null;
    uploadedAt: string;
    status: string;
  } | null;
  readOnly?: boolean;
}

const WALKTHROUGH_STEPS = [
  "1. Office entrance & company signage",
  "2. Reception area & visitor logging",
  "3. Main operational workstations & agent seats",
  "4. Active production floor & acoustic layout",
  "5. Supervisor & team leader monitoring desks",
  "6. Server rack & network switch equipment",
  "7. Online UPS battery banks & DG generator backup",
  "8. Security access control / biometric entry",
];

export default function LiveOfficeVideoRecorder({
  verificationId,
  applicationId,
  onVideoSubmitted,
  existingVideo,
  readOnly = false,
}: LiveOfficeVideoRecorderProps) {
  const [stage, setStage] = useState<"idle" | "requesting" | "preview" | "recording" | "review" | "submitting" | "success">("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const playbackRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingRef = useRef(false);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  const token =
    localStorage.getItem("user_token") ||
    localStorage.getItem("thinkatic_user_token") ||
    localStorage.getItem("bpo_applicant_token") ||
    localStorage.getItem("token") ||
    "";

  // Cleanup media stream and pending network requests on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (activeXhrRef.current) activeXhrRef.current.abort();
    };
  }, [previewUrl]);

  function stopCameraStream() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }

  const [cameraBlocked, setCameraBlocked] = useState(false);

  // Request camera and microphone access
  async function startCamera() {
    setErrorMsg("");
    setCameraBlocked(false);
    setStage("requesting");

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support in-browser media recording. Please use modern Chrome, Edge, or Safari, or upload a video file below.");
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      setStream(mediaStream);
      setStage("preview");
      setCameraBlocked(false);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = mediaStream;
        videoPreviewRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      let msg = "Could not access camera or microphone.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraBlocked(true);
        msg = "Camera and microphone permissions were denied. Please allow camera permissions in your browser settings, or upload a recorded walkthrough file.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No webcam or microphone found on your device. You can upload a recorded video file below.";
      }
      setErrorMsg(msg);
      setStage("idle");
    }
  }

  // Start recording
  function startRecording() {
    if (!stream) return;
    setErrorMsg("");

    try {
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        setRecordedBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setPreviewUrl(url);
        setStage("review");
        stopCameraStream();
      };

      recorder.start(1000); // 1-second timeslices
      setMediaRecorder(recorder);
      setStage("recording");
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= 600) {
            // Auto stop at 10 minutes (600s)
            stopRecording();
            return 600;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("Recording start error:", err);
      setErrorMsg("Failed to start video recording: " + err.message);
      setStage("preview");
    }
  }

  // Stop recording
  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }

  // Retake video
  function handleRetake() {
    if (isUploading) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setRecordedBlob(null);
    setPreviewUrl(null);
    setDuration(0);
    setModalError(null);
    setConfirmModalOpen(false);
    startCamera();
  }

  // Handle fallback file upload
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      setErrorMsg("Selected video exceeds the 100MB maximum size limit.");
      return;
    }

    setRecordedBlob(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStage("review");
  }

  // Submit recorded/selected video (Explicit confirmation)
  async function submitVideo() {
    if (isSubmittingRef.current || isUploading) {
      console.warn("Upload already in progress, ignoring duplicate submit request.");
      return;
    }
    if (!recordedBlob) return;

    isSubmittingRef.current = true;
    setIsUploading(true);
    setModalError(null);
    setUploadPercent(null);
    setErrorMsg("");

    try {
      // Step 1: Read blob as Base64 Data URL
      const reader = new FileReader();
      reader.readAsDataURL(recordedBlob);

      reader.onerror = () => {
        isSubmittingRef.current = false;
        setIsUploading(false);
        setUploadPercent(null);
        setModalError("Video upload failed. Please try again.");
      };

      reader.onloadend = () => {
        try {
          const base64Data = reader.result as string;
          const fileName = `office_walkthrough_${Date.now()}.${
            recordedBlob.type && recordedBlob.type.includes("mp4") ? "mp4" : "webm"
          }`;

          const payload = {
            fileData: base64Data,
            fileName,
            mimeType: recordedBlob.type || "video/webm",
            durationSeconds: duration > 0 ? duration : null,
            confirmed: true,
            verificationId: verificationId || undefined,
            applicationId: applicationId || undefined,
          };

          const xhr = new XMLHttpRequest();
          activeXhrRef.current = xhr;
          xhr.open("POST", "/api/bpo/centre-verification/video");
          xhr.setRequestHeader("Content-Type", "application/json");
          if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          }

          if (xhr.upload) {
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable && event.total > 0) {
                const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
                setUploadPercent(percent);
              }
            };
          }

          xhr.onload = async () => {
            activeXhrRef.current = null;
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                if (data.success || data.media) {
                  // Real upload succeeded!
                  setUploadPercent(100);

                  // Cleanup preview blob
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }
                  setRecordedBlob(null);

                  // Close confirmation modal automatically
                  setConfirmModalOpen(false);
                  setIsUploading(false);
                  isSubmittingRef.current = false;
                  setModalError(null);
                  setStage("idle");

                  // Refresh authoritative verification state from backend
                  if (onVideoSubmitted) {
                    await onVideoSubmitted(data.media);
                  }
                  return;
                }
              } catch (parseErr) {
                console.error("Error parsing upload response:", parseErr);
              }
            }

            // Failure handling - keep modal open and display error with Try Again
            let errText = "Video upload failed. Please try again.";
            try {
              const errObj = JSON.parse(xhr.responseText);
              if (errObj.message || errObj.error) {
                errText = errObj.message || errObj.error;
              }
            } catch {}

            setModalError(errText);
            setIsUploading(false);
            isSubmittingRef.current = false;
            setUploadPercent(null);
          };

          xhr.onerror = () => {
            activeXhrRef.current = null;
            setModalError("Video upload failed. Please try again.");
            setIsUploading(false);
            isSubmittingRef.current = false;
            setUploadPercent(null);
          };

          xhr.ontimeout = () => {
            activeXhrRef.current = null;
            setModalError("Video upload timed out. Please try again.");
            setIsUploading(false);
            isSubmittingRef.current = false;
            setUploadPercent(null);
          };

          xhr.send(JSON.stringify(payload));
        } catch (err: any) {
          activeXhrRef.current = null;
          setModalError(err.message || "Video upload failed. Please try again.");
          setIsUploading(false);
          isSubmittingRef.current = false;
          setUploadPercent(null);
        }
      };
    } catch (err: any) {
      console.error("Video submission error:", err);
      setModalError(err.message || "Video upload failed. Please try again.");
      setIsUploading(false);
      isSubmittingRef.current = false;
      setUploadPercent(null);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="space-y-6">
      {/* Existing Submitted Video Badge (Displayed at top when on file) */}
      {existingVideo && stage === "idle" && (
        <div
          className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            existingVideo.status === "approved"
              ? "border-emerald-300 bg-emerald-50/70"
              : existingVideo.status === "rejected" || existingVideo.status === "resubmission_required"
              ? "border-rose-300 bg-rose-50/70"
              : "border-blue-200 bg-blue-50/50"
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl shrink-0 ${
                existingVideo.status === "approved"
                  ? "bg-emerald-100 text-emerald-700"
                  : existingVideo.status === "rejected" || existingVideo.status === "resubmission_required"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-blue-100 text-[#214ECF]"
              }`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {existingVideo.status === "approved" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : existingVideo.status === "rejected" || existingVideo.status === "resubmission_required" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-black text-slate-900">
                  Office Walkthrough Video On File
                </p>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    existingVideo.status === "approved"
                      ? "bg-emerald-100 text-emerald-800"
                      : existingVideo.status === "rejected"
                      ? "bg-rose-100 text-rose-800"
                      : existingVideo.status === "resubmission_required"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-blue-100 text-[#214ECF]"
                  }`}
                >
                  {(existingVideo.status || "active").replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {(existingVideo.originalFileName || (existingVideo as any).original_file_name || "office_walkthrough.mp4")} · {formatFileSize(existingVideo.fileSize || (existingVideo as any).file_size || 0)}
                {(existingVideo.durationSeconds || (existingVideo as any).duration_seconds) ? ` · ${formatTime(existingVideo.durationSeconds || (existingVideo as any).duration_seconds)}` : ""}
              </p>
              {(existingVideo.status === "rejected" || existingVideo.status === "resubmission_required") && (existingVideo as any).rejectionReason && (
                <p className="text-xs font-bold text-rose-700 mt-1">
                  Reviewer Notes: {(existingVideo as any).rejectionReason}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/api/bpo/centre-verification/media/${existingVideo.id}?token=${token}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <Eye className="h-3.5 w-3.5" />
              View Current Video
            </a>
          </div>
        </div>
      )}

      {/* Walkthrough Instructions Guide */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-[#214ECF] shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h4 className="text-sm font-black text-[#0B1F3A]">
              Live Office Walkthrough Instructions
            </h4>
            <p className="text-xs leading-5 text-slate-700">
              Please record a continuous, clear live video walkthrough of your actual operating facility. This video is used by Thinkatic Operations during manual accreditation to verify physical presence, capacity, and infrastructure.
            </p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-800">
              {WALKTHROUGH_STEPS.map((step, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#214ECF]" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 italic mt-2">
              Note: No AI or automated analysis is performed. This recording serves as confidential evidence strictly for Thinkatic Operations human audit.
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Recording Workspace */}
      <div className="rounded-2xl border border-slate-200 bg-slate-900 overflow-hidden shadow-sm relative min-h-[380px] flex flex-col justify-center items-center text-white">
        {/* Stage: Idle */}
        {stage === "idle" && (
          <div className="p-8 text-center max-w-lg space-y-4">
            {cameraBlocked ? (
              <div className="space-y-4 text-left bg-slate-800/80 border border-amber-400/30 rounded-2xl p-6 shadow-xl backdrop-blur-xs">
                <div className="flex items-center gap-3 text-amber-400">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                    <Camera className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      Camera Access Blocked by Browser
                    </h3>
                    <p className="text-[11px] text-amber-300 font-medium">
                      Live verification requires webcam & microphone access
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Thinkatic international clients require authentic, real-time live facility walkthrough recordings to validate physical infrastructure and seat capacity.
                </p>

                <div className="rounded-xl bg-black/40 border border-white/10 p-3.5 space-y-2 text-xs">
                  <p className="font-bold text-slate-200 text-[11px] uppercase tracking-wider">
                    How to enable camera access:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                    <li>Click the lock 🔒 or camera 📷 icon in your browser's address bar.</li>
                    <li>Change <span className="font-bold text-white">Camera</span> & <span className="font-bold text-white">Microphone</span> permissions to <span className="font-bold text-emerald-400">Allow</span>.</li>
                    <li>Click the button below to re-initialize your camera.</li>
                  </ol>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#214ECF] hover:bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Allow Camera Access / Try Again
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-xs font-bold text-slate-200 transition cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload Video File
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mx-auto h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center text-blue-400">
                  <Video className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-black">Record Live Office Walkthrough</h3>
                <p className="text-xs text-slate-400">
                  Click below to grant camera access and record your walkthrough directly inside your browser. You will be able to review and confirm before submitting.
                </p>

                {!readOnly && (
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#214ECF] px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-600 transition"
                    >
                      <Camera className="h-4 w-4" />
                      START LIVE OFFICE VERIFICATION
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-white/10 transition"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Video File
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/webm,video/mp4,video/quicktime,video/x-matroska"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Stage: Requesting Permissions */}
        {stage === "requesting" && (
          <div className="p-8 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#214ECF] mx-auto" />
            <p className="text-sm font-bold">Requesting camera & microphone access...</p>
            <p className="text-xs text-slate-400">Please click "Allow" in your browser prompt.</p>
          </div>
        )}

        {/* Stage: Live Camera Preview & Ready to Record */}
        {stage === "preview" && (
          <div className="relative w-full h-[440px] flex flex-col items-center justify-center bg-black">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            <div className="absolute top-4 left-4 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 flex items-center gap-2 text-xs font-bold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Camera Ready
            </div>

            <div className="absolute bottom-6 flex items-center gap-4">
              <button
                type="button"
                onClick={startRecording}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 px-7 py-3 text-sm font-black text-white shadow-xl transition transform active:scale-95"
              >
                <span className="h-3 w-3 rounded-full bg-white" />
                START RECORDING
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setStage("idle");
                }}
                className="rounded-full bg-white/20 hover:bg-white/30 p-3 text-white backdrop-blur-sm"
                title="Cancel"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Stage: Actively Recording */}
        {stage === "recording" && (
          <div className="relative w-full h-[440px] flex flex-col items-center justify-center bg-black">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Recording Timer & Status Overlay */}
            <div className="absolute top-4 left-4 rounded-full bg-red-600/90 backdrop-blur-md px-3.5 py-1.5 flex items-center gap-2 text-xs font-black text-white shadow-lg">
              <span className="h-2.5 w-2.5 rounded-full bg-white animate-ping" />
              RECORDING {formatTime(duration)} / 10:00
            </div>

            <div className="absolute top-4 right-4 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs text-slate-300">
              Walk through all operational areas
            </div>

            <div className="absolute bottom-6 flex items-center gap-3">
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 border-2 border-white hover:bg-slate-800 px-7 py-3 text-sm font-black text-white shadow-2xl transition"
              >
                <Square className="h-4 w-4 fill-red-500 text-red-500" />
                STOP RECORDING
              </button>
            </div>
          </div>
        )}

        {/* Stage: Review Video Recording */}
        {stage === "review" && previewUrl && (
          <div className="relative w-full flex flex-col bg-slate-950 p-4">
            <div className="relative rounded-xl overflow-hidden bg-black max-h-[380px] flex items-center justify-center">
              <video
                ref={playbackRef}
                src={previewUrl}
                controls
                playsInline
                className="w-full max-h-[360px] object-contain"
              />
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/5 p-4 rounded-xl">
              <div>
                <p className="text-xs font-black text-white">Review Walkthrough Recording</p>
                <p className="text-[11px] text-slate-400">
                  {recordedBlob ? `${(recordedBlob.size / (1024 * 1024)).toFixed(1)} MB` : ""} · Verify that workstations, server rack, and office entrance are clearly visible.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  RETAKE
                </button>

                <button
                  type="button"
                  id="open-video-confirm-modal-btn"
                  disabled={isUploading}
                  onClick={() => {
                    setModalError(null);
                    setConfirmModalOpen(true);
                  }}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3eb3] active:bg-[#15328f] px-5 py-2.5 text-xs font-black text-white hover:bg-blue-600 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  SUBMIT OFFICE VIDEO
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stage: Submitting */}
        {stage === "submitting" && (
          <div className="p-8 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-[#214ECF] mx-auto" />
            <p className="text-sm font-black">{uploadProgress}</p>
            <p className="text-xs text-slate-400">Please do not close this window.</p>
          </div>
        )}

        {/* Stage: Success */}
        {stage === "success" && (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-black text-white">Video Submitted Successfully</h3>
            <p className="text-xs text-slate-300 max-w-sm mx-auto">
              Your live office walkthrough video has been securely stored for Thinkatic Admin manual verification.
            </p>
            <button
              type="button"
              onClick={() => setStage("idle")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal before Submit */}
      {confirmModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-slate-900 space-y-4 animate-in fade-in zoom-in-95">
            {isUploading ? (
              /* State 2: Uploading in Progress (Replaces Modal Content) */
              <div className="py-4 text-center space-y-5">
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 text-[#214ECF]">
                  <CloudUpload className="h-8 w-8 text-[#214ECF] animate-bounce" />
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-base font-black text-[#0B1F3A]">Uploading Live Office Video...</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Please wait while your video is securely uploaded to the Thinkatic private evidence storage.
                  </p>
                </div>

                {/* Animated Progress Indicator / Real Percentage */}
                <div className="space-y-2 max-w-xs mx-auto">
                  {uploadPercent !== null ? (
                    <>
                      <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                        <span className="flex items-center gap-1.5 text-[#214ECF]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </span>
                        <span className="font-mono text-[#214ECF] font-black">{uploadPercent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                        <div
                          className="h-full bg-[#214ECF] transition-all duration-150 ease-out rounded-full"
                          style={{ width: `${uploadPercent}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#214ECF] py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Encrypting &amp; transferring video evidence...</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-[11px] text-slate-500 flex items-center justify-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#214ECF] shrink-0" />
                  <span>Confidential transfer · Do not close this window</span>
                </div>
              </div>
            ) : modalError ? (
              /* State 3: Upload Failed (Modal Stays Open with Try Again) */
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">Video Upload Failed</h4>
                    <p className="text-xs text-slate-500">Live Office Walkthrough Verification</p>
                  </div>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 space-y-1">
                  <p className="font-bold">Video upload failed. Please try again.</p>
                  {modalError && modalError !== "Video upload failed. Please try again." && (
                    <p className="text-rose-600 text-[11px] font-normal">{modalError}</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setModalError(null);
                      setConfirmModalOpen(false);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    id="video-upload-try-again-btn"
                    data-testid="video-upload-try-again-btn"
                    onClick={() => {
                      setModalError(null);
                      submitVideo();
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3eb3] active:bg-[#15328f] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:shadow transition cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              /* State 1: Initial Confirm Modal */
              <>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-[#214ECF]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black">Confirm Video Submission</h4>
                    <p className="text-xs text-slate-500">Live Office Walkthrough Verification</p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3.5 text-xs space-y-1.5 border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recorded Size:</span>
                    <span className="font-bold">{recordedBlob ? `${(recordedBlob.size / (1024 * 1024)).toFixed(1)} MB` : "N/A"}</span>
                  </div>
                  {duration > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Duration:</span>
                      <span className="font-bold">{formatTime(duration)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destination:</span>
                    <span className="font-bold text-[#214ECF]">Private Thinkatic Evidence Vault</span>
                  </div>
                </div>

                <p className="text-xs leading-5 text-slate-600">
                  By confirming, this video will be securely uploaded and attached to your BPO Centre Verification application for manual review by Thinkatic Operations.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => setConfirmModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Back to Review
                  </button>

                  <button
                    type="button"
                    id="confirm-submit-video-btn"
                    data-testid="confirm-submit-video-btn"
                    disabled={isUploading}
                    onClick={submitVideo}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] hover:bg-[#1a3eb3] active:bg-[#15328f] px-5 py-2.5 text-xs font-black text-white hover:bg-blue-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm &amp; Submit Video
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
