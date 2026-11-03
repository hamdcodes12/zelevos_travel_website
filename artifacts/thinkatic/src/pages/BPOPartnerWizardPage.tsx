import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Building,
  Scale,
  Globe,
  User,
  Mail,
  Phone,
  MapPin,
  Map,
  Receipt,
  CreditCard,
  FileCheck2,
  ChevronDown,
  Cpu,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  ArrowRight,
  ArrowLeft,
  Save,
  Send,
  Loader2,
  ShieldCheck,
  Headphones,
  Server,
  Layers,
  PhoneCall,
  ChevronRight,
  Info,
  Clock,
  Sparkles,
  ExternalLink,
  Wifi,
  Network,
  Zap,
  Monitor,
  Camera,
  Download,
  Eye,
  FileSignature,
  FileCheck,
  Check,
  X,
  ClipboardCheck,
  Users,
  Gauge,
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useAutosaveForm } from "@/hooks/useAutosaveForm";
import AutosaveStatusBadge from "@/components/common/AutosaveStatusBadge";

interface WizardData {
  companyData: {
    companyName: string;
    legalEntity: string;
    website: string;
    ownerName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    country: string;
    gstNumber: string;
    panNumber: string;
    registrationNumber: string;
  };
  centreData: {
    centreName: string;
    centreAddress: string;
    totalSeats: string;
    availableSeats: string;
    activeAgents: string;
    numberOfFloors: string;
    workingHours: string;
    languagesSupported: string[];
    usExperience: boolean;
    ukExperience: boolean;
    domesticExperience: boolean;
  };
  infrastructureData: {
    internetBandwidth: string;
    backupInternet: string;
    powerBackup: string;
    computers: string;
    headsets: string;
    cctv: string;
    accessControl: string;
    dialer: string;
    crm: string;
    serverInfrastructure: string;
  };
  processExperience: string[];
  declarationAgreed: boolean;
}

const INITIAL_DATA: WizardData = {
  companyData: {
    companyName: "",
    legalEntity: "Private Limited",
    website: "",
    ownerName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    gstNumber: "",
    panNumber: "",
    registrationNumber: "",
  },
  centreData: {
    centreName: "",
    centreAddress: "",
    totalSeats: "50",
    availableSeats: "20",
    activeAgents: "30",
    numberOfFloors: "2",
    workingHours: "24/7",
    languagesSupported: ["English", "Hindi"],
    usExperience: true,
    ukExperience: false,
    domesticExperience: true,
  },
  infrastructureData: {
    internetBandwidth: "1 Gbps Leased Line (1:1)",
    backupInternet: "500 Mbps Secondary ISP Fiber",
    powerBackup: "Online UPS 30 kVA + 125 kVA DG Set",
    computers: "i5 12th Gen, 16GB RAM, SSD",
    headsets: "Jabra Noise Cancelling USB",
    cctv: "100% Floor & Server Room Coverage (90 Days retention)",
    accessControl: "Biometric Fingerprint + RFID Card Access",
    dialer: "Vicidial Enterprise / Cloud Asterisk",
    crm: "Salesforce / Custom CRM",
    serverInfrastructure: "Hybrid Cloud AWS + Local Redundant NAS",
  },
  processExperience: [
    "Customer Support",
    "Telecalling",
    "Sales",
    "Lead Generation",
  ],
  declarationAgreed: false,
};

const PROCESS_OPTIONS = [
  "Sales",
  "Customer Support",
  "Telecalling",
  "Collections",
  "Healthcare",
  "Banking",
  "Insurance",
  "Lead Generation",
  "Appointment Setting",
  "Technical Support",
  "Data Annotation",
  "Other",
];

const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MiB = 26,214,400 bytes

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const REQUIRED_DOCUMENTS = [
  {
    type: "incorporation_certificate",
    label: "Certificate of Incorporation",
    description: "ROC Certificate, Partnership Deed, or Business Registration Proof",
    icon: Building2,
  },
  {
    type: "gst_certificate",
    label: "GST Registration Certificate",
    description: "Official GST Certificate showing legal name and registered address",
    icon: Receipt,
  },
  {
    type: "pan_card",
    label: "Company / Entity PAN Card",
    description: "Valid PAN document of the company or legal business entity",
    icon: CreditCard,
  },
  {
    type: "registration_cin",
    label: "Registration / CIN Document",
    description: "ROC Certificate of Incorporation / CIN / Corporate Registry Filing Proof",
    icon: FileCheck2,
  },
  {
    type: "centre_floor_plan",
    label: "Centre Floor Plan & Facility Photos",
    description: "Photos of operational floor, server rack, training room, and premises",
    icon: MapPin,
  },
  {
    type: "isp_sla",
    label: "ISP SLA & Infrastructure Proof",
    description: "Bandwidth allocation letter, secondary ISP invoice, and UPS warranty",
    icon: Server,
  },
  {
    type: "company_profile",
    label: "Corporate Company Profile / Capability Deck",
    description: "Overview of your past client campaigns, team size, and domain expertise",
    icon: FileText,
  },
];

const STEPS = [
  { title: "Company", icon: Building2 },
  { title: "Office", icon: MapPin },
  { title: "Documents", icon: FileText },
  { title: "Verification", icon: ShieldCheck },
  { title: "Capacity", icon: Cpu },
  { title: "Agreement", icon: FileSignature },
  { title: "Review & Submit", icon: ClipboardCheck },
  { title: "Activation", icon: Sparkles },
];

const ONBOARDING_STAGES = [
  { stepNumber: "01", title: "Company", subtitle: "Legal Profile", icon: Building2, stepIndex: 0 },
  { stepNumber: "02", title: "Office", subtitle: "Centre Setup", icon: MapPin, stepIndex: 1 },
  { stepNumber: "03", title: "Documents", subtitle: "Compliance KYC", icon: FileText, stepIndex: 2 },
  { stepNumber: "04", title: "Verification", subtitle: "Infra Audit", icon: ShieldCheck, stepIndex: 3 },
  { stepNumber: "05", title: "Capacity", subtitle: "Capabilities", icon: Cpu, stepIndex: 4 },
  { stepNumber: "06", title: "Agreement", subtitle: "Master SLA", icon: FileSignature, stepIndex: 5 },
  { stepNumber: "07", title: "Review", subtitle: "Final Submit", icon: ClipboardCheck, stepIndex: 6 },
  { stepNumber: "08", title: "Activation", subtitle: "24-Hr Review", icon: Sparkles, stepIndex: 7 },
];

export default function BPOPartnerWizardPage() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<WizardData>(INITIAL_DATA);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [applicationNumber, setApplicationNumber] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { fileName: string; status: string; url?: string; fileSize?: number; error?: string }>>({});
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Agreement State & Activation
  const [agreement, setAgreement] = useState<any | null>(null);
  const [loadingAgreement, setLoadingAgreement] = useState(false);
  const [uploadingAgreement, setUploadingAgreement] = useState(false);
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const [agreementSuccess, setAgreementSuccess] = useState<string | null>(null);
  const [selectedAgreementFile, setSelectedAgreementFile] = useState<File | null>(null);
  const [isViewAgreementOpen, setIsViewAgreementOpen] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string>("draft");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);

  const token = localStorage.getItem("user_token");

  const hasSignedAgreement = Boolean(
    agreement?.signedDocumentFileName ||
    agreement?.signedDocumentUrl ||
    agreement?.status === "signed_agreement_submitted" ||
    agreement?.status === "approved"
  );

  const fetchAgreement = async () => {
    if (!token) return;
    setLoadingAgreement(true);
    try {
      const res = await fetch("/api/bpo/agreement", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hasAgreement && data.agreement) {
          setAgreement(data.agreement);
        }
      }
    } catch (err) {
      console.error("Failed to fetch agreement", err);
    } finally {
      setLoadingAgreement(false);
    }
  };

  const handleDownloadAgreement = () => {
    const downloadUrl = `/api/bpo/agreement/download?token=${encodeURIComponent(token || "")}`;
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "Thinkatic-BPO-Partner-Agreement.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleUploadSignedAgreement = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setAgreementError("Invalid file type. Signed Agreement must strictly be uploaded in PDF format (.pdf).");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setAgreementError("File size exceeds 25MB limit. Please upload a PDF under 25MB.");
      return;
    }

    setUploadingAgreement(true);
    setAgreementError(null);
    setAgreementSuccess(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileDataUrl = reader.result as string;

        try {
          const res = await fetch("/api/bpo/agreement/upload-signed", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              fileName: file.name,
              fileSizeBytes: file.size,
              mimeType: "application/pdf",
              fileData: fileDataUrl,
            }),
          });

          const data = await res.json();
          if (res.ok && data.success) {
            setAgreementSuccess("Signed agreement uploaded successfully. It is now saved in Supabase and pending Thinkatic Admin review.");
            setSelectedAgreementFile(null);
            await fetchAgreement();
          } else {
            setAgreementError(data.error || data.message || "Failed to upload signed agreement.");
          }
        } catch {
          setAgreementError("Failed to upload signed agreement. Please check network connection.");
        } finally {
          setUploadingAgreement(false);
        }
      };
      reader.onerror = () => {
        setAgreementError("Failed to read file from disk.");
        setUploadingAgreement(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setAgreementError("Error processing file upload.");
      setUploadingAgreement(false);
    }
  };

  // Load existing draft or application
  useEffect(() => {
    if (!token) {
      setLocation("/login?returnTo=/partner/apply");
      return;
    }

    try {
      const rawUser = localStorage.getItem("user_profile");
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed.role === "admin") {
          setLocation("/admin");
          return;
        }
        if (parsed.accountType === "USER" || parsed.role === "client" || parsed.role === "user") {
          setLocation("/client");
          return;
        }
      }
    } catch {}

    void fetchAgreement();

    // Check URL parameters for explicit step or tab navigation
    let requestedStep: number | null = null;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const stepParam = searchParams.get("step");
      const tabParam = searchParams.get("tab");
      if (stepParam !== null && !isNaN(Number(stepParam))) {
        requestedStep = Math.max(0, Math.min(7, parseInt(stepParam, 10)));
      } else if (tabParam) {
        const tabMap: Record<string, number> = {
          company: 0,
          office: 1,
          centre: 1,
          documents: 2,
          docs: 2,
          kyc: 2,
          verification: 3,
          infrastructure: 3,
          infra: 3,
          capacity: 4,
          experience: 4,
          agreement: 5,
          review: 6,
          activation: 7,
        };
        if (tabParam.toLowerCase() in tabMap) {
          requestedStep = tabMap[tabParam.toLowerCase()];
        }
      }
    } catch {}

    async function fetchMyApplication() {
      setLoading(true);
      try {
        const res = await fetch("/api/partner/applications/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.application) {
            setApplicationId(data.application.id);
            setApplicationNumber(data.application.application_number);
            setApplicationStatus(data.application.status || "draft");
            setSubmittedAt(data.application.submitted_at || null);
            setApprovedAt(data.application.approved_at || null);

            // Populate draft data
            setFormData((prev) => ({
              ...prev,
              companyData: { ...prev.companyData, ...(data.application.company_data || {}) },
              centreData: { ...prev.centreData, ...(data.application.centre_data || {}) },
              infrastructureData: { ...prev.infrastructureData, ...(data.application.infrastructure_data || {}) },
              processExperience: data.application.process_experience?.length ? data.application.process_experience : prev.processExperience,
            }));

            // Populate docs map
            if (data.documents?.length) {
              const docMap: Record<string, any> = {};
              data.documents.forEach((d: any) => {
                docMap[d.document_type] = {
                  fileName: d.file_name,
                  status: d.status,
                  url: d.file_url,
                  fileSize: d.file_size ? Number(d.file_size) : (d.file_size_bytes ? Number(d.file_size_bytes) : undefined),
                };
              });
              setUploadedDocs(docMap);
            }

            // Determine authoritative step to open
            if (requestedStep !== null) {
              setCurrentStep(requestedStep);
            } else if (["submitted", "under_review", "infrastructure_check", "management_check", "trial_assessment", "approved"].includes(data.application.status)) {
              // If already submitted/under review/approved, default to Activation (24-Hour Review)
              setCurrentStep(7);
            } else {
              // Intelligently resume from first incomplete step
              const cd = data.application.company_data || {};
              const ctd = data.application.centre_data || {};
              const inf = data.application.infrastructure_data || {};
              const hasCompany = Boolean(cd.companyName?.trim() && cd.ownerName?.trim() && cd.email?.trim() && (cd.phone?.trim() || cd.address?.trim()));
              const hasCentre = Boolean(ctd.centreName?.trim() && ctd.centreAddress?.trim() && ctd.totalSeats);
              const docsCount = data.documents?.length || 0;
              const hasInfra = Boolean(inf.internetBandwidth?.trim() && (inf.powerBackup?.trim() || inf.backupInternet?.trim() || inf.computers?.trim()));
              const hasExp = Boolean(data.application.process_experience?.length > 0);

              if (!hasCompany) {
                setCurrentStep(0); // Company
              } else if (!hasCentre) {
                setCurrentStep(1); // Office
              } else if (docsCount < 3) {
                setCurrentStep(2); // Documents
              } else if (!hasInfra) {
                setCurrentStep(3); // Infrastructure
              } else if (!hasExp) {
                setCurrentStep(4); // Capacity & Experience
              } else {
                setCurrentStep(5); // Agreement
              }
            }
          } else {
            // Fresh draft
            if (requestedStep !== null) {
              setCurrentStep(requestedStep);
            } else {
              setCurrentStep(0);
            }
          }
        }
      } catch (err: any) {
        setErrorMsg("Unable to load saved application state. Starting a fresh draft.");
        if (requestedStep !== null) setCurrentStep(requestedStep);
      } finally {
        setLoading(false);
      }
    }

    fetchMyApplication();
  }, [token, setLocation]);

  // Sync currentStep to URL search query for resilient browser refresh & deep linking
  useEffect(() => {
    if (!loading) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("step", String(currentStep));
        window.history.replaceState(null, "", url.toString());
      } catch {}
    }
  }, [currentStep, loading]);

  // 5-Second Debounced Autosave Hook (Authoritative DB Persistence)
  const {
    status: autosaveStatus,
    error: autosaveError,
    retry: retryAutosave,
    flush: flushAutosave,
    resetSavedState,
    isSaving: isAutosaving,
  } = useAutosaveForm(formData, {
    debounceMs: 5000,
    isInitialLoading: loading,
    onSave: async (dataToSave) => {
      if (!token) return { success: false, error: "Authentication required" };
      try {
        if (applicationId) {
          const res = await fetch(`/api/partner/applications/${applicationId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              companyData: dataToSave.companyData,
              centreData: dataToSave.centreData,
              infrastructureData: dataToSave.infrastructureData,
              processExperience: dataToSave.processExperience,
              currentStage: "registration",
              lastKnownUpdatedAt: new Date().toISOString(),
            }),
          });
          const resData = await res.json();
          if (res.ok) {
            if (resData.application) {
              setApplicationNumber(resData.application.application_number);
            }
            return { success: true, data: resData };
          }
          return { success: false, error: resData.error || resData.message || "Failed to save draft" };
        } else {
          const res = await fetch("/api/partner/applications", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              companyData: dataToSave.companyData,
              centreData: dataToSave.centreData,
              infrastructureData: dataToSave.infrastructureData,
              processExperience: dataToSave.processExperience,
              isDraft: true,
            }),
          });
          const resData = await res.json();
          if (res.ok || res.status === 409) {
            if (resData.application) {
              setApplicationId(resData.application.id);
              setApplicationNumber(resData.application.application_number);
              if (res.status === 409 && resData.application.status !== "draft") {
                setLocation("/partner/application-status");
              }
            }
            return { success: true, data: resData };
          }
          return { success: false, error: resData.error || resData.message || "Failed to save draft" };
        }
      } catch (err: any) {
        return { success: false, error: err?.message || "Connection error during autosave" };
      }
    },
    onSuccess: (resData) => {
      if (resData?.application) {
        setApplicationNumber(resData.application.application_number);
      }
    },
    onError: (err) => {
      console.warn("[Autosave Warning]", err);
    },
  });

  // Explicit Save Draft helper: immediately flushes pending changes without waiting 5 seconds
  async function saveDraft(showToast = true) {
    if (!token) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const ok = await flushAutosave();
      if (ok && showToast) {
        setSuccessMsg(`Draft saved successfully (${applicationNumber || "THK-APP"}). You can return and complete anytime.`);
        setTimeout(() => setSuccessMsg(""), 3500);
      }
    } catch {
      setErrorMsg("Failed to save draft. Please check your connection.");
    } finally {
      setSaving(false);
    }
  }

  // Handle document upload (Independent 25 MB Limit per slot)
  async function handleFileUpload(type: string, file: File) {
    if (!token) return;

    // Reset error on this slot
    setUploadedDocs((prev) => ({
      ...prev,
      [type]: {
        ...(prev[type] || { fileName: "", status: "idle" }),
        error: undefined,
      },
    }));

    // 1. Client-side size check: strictly <= 25 MiB (25 * 1024 * 1024 bytes) per file
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setUploadedDocs((prev) => ({
        ...prev,
        [type]: {
          ...(prev[type] || { fileName: file.name, status: "error" }),
          error: "This document exceeds the 25 MB limit.",
        },
      }));
      return;
    }

    // 2. Client-side format check: PDF, PNG, JPG, JPEG, DOCX
    const dotIdx = file.name.lastIndexOf(".");
    const ext = dotIdx !== -1 ? file.name.slice(dotIdx).toLowerCase() : "";
    const allowedExts = [".pdf", ".png", ".jpg", ".jpeg", ".docx"];
    if (!allowedExts.includes(ext)) {
      setUploadedDocs((prev) => ({
        ...prev,
        [type]: {
          ...(prev[type] || { fileName: file.name, status: "error" }),
          error: "This file type is not supported. Please upload PDF, PNG, JPG, JPEG, or DOCX.",
        },
      }));
      return;
    }

    setUploadingDoc(type);
    setErrorMsg("");

    try {
      // Ensure application exists first
      let activeId = applicationId;
      if (!activeId) {
        const createRes = await fetch("/api/partner/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            companyData: formData.companyData,
            centreData: formData.centreData,
            infrastructureData: formData.infrastructureData,
            processExperience: formData.processExperience,
            isDraft: true,
          }),
        });
        const created = await createRes.json();
        if (createRes.ok || createRes.status === 409) {
          activeId = created.application?.id;
          if (activeId) {
            setApplicationId(activeId);
            setApplicationNumber(created.application.application_number);
          }
        }
      }

      // Read file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const uploadRes = await fetch(`/api/partner/applications/${activeId}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              documentType: type,
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              fileData: base64Data,
              fileSizeBytes: file.size,
            }),
          });

          const docRes = await uploadRes.json();

          if (uploadRes.ok) {
            setUploadedDocs((prev) => ({
              ...prev,
              [type]: {
                fileName: file.name,
                status: "pending",
                url: docRes.document?.file_url,
                fileSize: file.size,
                error: undefined,
              },
            }));
            setSuccessMsg(`Uploaded ${file.name} successfully.`);
            setTimeout(() => setSuccessMsg(""), 3500);
          } else {
            const serverMsg = docRes.error || docRes.message || "Upload failed. Please try again.";
            setUploadedDocs((prev) => ({
              ...prev,
              [type]: {
                ...(prev[type] || { fileName: file.name, status: "error" }),
                error: serverMsg,
              },
            }));
          }
        } catch {
          setUploadedDocs((prev) => ({
            ...prev,
            [type]: {
              ...(prev[type] || { fileName: file.name, status: "error" }),
              error: "Upload failed. Please try again.",
            },
          }));
        } finally {
          setUploadingDoc(null);
        }
      };
      reader.onerror = () => {
        setUploadedDocs((prev) => ({
          ...prev,
          [type]: {
            ...(prev[type] || { fileName: file.name, status: "error" }),
            error: "Failed to read file from disk.",
          },
        }));
        setUploadingDoc(null);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadedDocs((prev) => ({
        ...prev,
        [type]: {
          ...(prev[type] || { fileName: file.name, status: "error" }),
          error: "Upload failed. Please try again.",
        },
      }));
      setUploadingDoc(null);
    }
  }

  // Next Step validation & state progression with authoritative flush before transition
  async function handleNextStep() {
    setErrorMsg("");
    if (currentStep === 0) {
      if (
        !formData.companyData.companyName.trim() ||
        !formData.companyData.ownerName.trim() ||
        !formData.companyData.email.trim() ||
        !formData.companyData.phone.trim()
      ) {
        setErrorMsg("Please complete all required fields in Step 1 (Company Name, Authorized Contact, Email, Phone).");
        return;
      }
      await flushAutosave();
      setCurrentStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (currentStep === 1) {
      if (
        !formData.centreData.centreName.trim() ||
        !formData.centreData.centreAddress.trim() ||
        !formData.centreData.totalSeats
      ) {
        setErrorMsg("Please complete all required fields in Step 2 (Centre Name, Physical Address, Total Seats).");
        return;
      }
      await flushAutosave();
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (currentStep === 2) {
      // Step 3 Documents -> advance to Step 4 Verification
      await flushAutosave();
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (currentStep === 3) {
      // Step 4 Verification -> advance to Step 5 Capacity
      await flushAutosave();
      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (currentStep === 4) {
      // Step 5 Capacity -> NEXT STEP MUST OPEN STEP 6 (AGREEMENT, index 5). NEVER SKIP TO REVIEW!
      await flushAutosave();
      setCurrentStep(5);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (currentStep === 5) {
      // Step 6 Agreement -> strictly validate signed agreement before opening Step 7 (Review)
      if (!hasSignedAgreement) {
        setErrorMsg("Please download, sign, and upload your signed Global Delivery Partner Agreement PDF before proceeding to Review.");
        return;
      }
      await flushAutosave();
      setCurrentStep(6);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (currentStep === 6) {
      // Step 7 Review -> Final Submit
      await handleSubmit();
      return;
    }
  }

  // Final submission
  async function handleSubmit() {
    if (!token) return;
    setErrorMsg("");

    // Verification before final submit
    if (!formData.companyData.companyName || !formData.companyData.ownerName || !formData.companyData.email || !formData.companyData.phone) {
      setErrorMsg("Please complete all required fields in Step 1 (Company Information).");
      setCurrentStep(0);
      return;
    }
    if (!formData.centreData.centreName || !formData.centreData.totalSeats || !formData.centreData.availableSeats) {
      setErrorMsg("Please complete all required fields in Step 2 (Centre Information).");
      setCurrentStep(1);
      return;
    }
    if (!hasSignedAgreement) {
      setErrorMsg("Please upload your signed Agreement in Step 6 before final submission.");
      setCurrentStep(5);
      return;
    }
    if (!formData.declarationAgreed) {
      setErrorMsg("Please review the declaration and check the confirmation box to proceed.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Save latest state
      let activeId = applicationId;
      if (!activeId) {
        const createRes = await fetch("/api/partner/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            companyData: formData.companyData,
            centreData: formData.centreData,
            infrastructureData: formData.infrastructureData,
            processExperience: formData.processExperience,
            isDraft: true,
          }),
        });
        const created = await createRes.json();
        if (createRes.ok || createRes.status === 409) {
          activeId = created.application?.id;
          if (activeId) {
            setApplicationId(activeId);
            setApplicationNumber(created.application.application_number);
          }
        }
      } else {
        await fetch(`/api/partner/applications/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            companyData: formData.companyData,
            centreData: formData.centreData,
            infrastructureData: formData.infrastructureData,
            processExperience: formData.processExperience,
          }),
        });
      }

      // 2. Submit formally
      const submitRes = await fetch(`/api/partner/applications/${activeId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      if (submitRes.ok) {
        const subData = await submitRes.json();
        setApplicationStatus("submitted");
        setSubmittedAt(subData.application?.submitted_at || new Date().toISOString());
        setCurrentStep(7); // Advance to Step 8: Activation / 24-Hour Review!
        setSuccessMsg("Application submitted successfully. It is now under 24-hour operations review.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const err = await submitRes.json();
        console.error("[handleSubmit] Submit failed:", err);
        setErrorMsg(err.message || err.error || "Failed to submit application.");
      }
    } catch (e) {
      console.error("[handleSubmit] Exception:", e);
      setErrorMsg("Network error occurred during submission. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const toggleProcess = (proc: string) => {
    setFormData((prev) => {
      const exists = prev.processExperience.includes(proc);
      return {
        ...prev,
        processExperience: exists
          ? prev.processExperience.filter((p) => p !== proc)
          : [...prev.processExperience, proc],
      };
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#214ECF]" />
            <p className="text-sm font-semibold text-slate-500">Loading BPO Partner Wizard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Authoritative real data-driven stage completion evaluation
  const validDocsCount = Object.values(uploadedDocs).filter((d) => d && d.status !== "error" && d.status !== "rejected").length;
  const isCompanyStageDone = Boolean(
    formData.companyData.companyName?.trim() &&
    formData.companyData.companyName.trim().toLowerCase() !== "none" &&
    formData.companyData.ownerName?.trim() &&
    formData.companyData.email?.trim() &&
    formData.companyData.phone?.trim()
  );
  const isCentreStageDone = Boolean(
    formData.centreData.centreName?.trim() &&
    formData.centreData.centreAddress?.trim() &&
    formData.centreData.totalSeats
  );
  const isDocsStageDone = validDocsCount >= 3;
  const isVerificationStageDone = Boolean(
    formData.infrastructureData.internetBandwidth?.trim() &&
    (formData.infrastructureData.powerBackup?.trim() ||
      formData.infrastructureData.backupInternet?.trim() ||
      formData.infrastructureData.computers?.trim())
  );
  const isCapacityStageDone = Boolean(
    formData.processExperience.length > 0 ||
    (formData.centreData.activeAgents && Number(formData.centreData.activeAgents) > 0)
  );
  const isAgreementStageDone = Boolean(hasSignedAgreement);
  const isFinalSubmitted = applicationStatus === "submitted" || applicationStatus === "under_review" || applicationStatus === "approved" || currentStep === 7;
  const isActivated = applicationStatus === "approved";

  const completedStagesList = [
    isCompanyStageDone,
    isCentreStageDone,
    isDocsStageDone,
    isVerificationStageDone,
    isCapacityStageDone,
    isAgreementStageDone,
    isFinalSubmitted,
    isActivated,
  ];
  const totalCompletedStages = completedStagesList.filter(Boolean).length;
  const calculatedOverallProgressPct = Math.min(100, Math.round((totalCompletedStages / 8) * 100));

  return (
    <Layout>
      <div className="min-h-screen bg-[#F6F8FC] pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Header Banner */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E2E8F0] pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#214ECF]/10 px-3 py-1 text-xs font-bold text-[#214ECF] uppercase tracking-wider">
                  BPO Global Delivery Network
                </span>
                {applicationNumber && (
                  <span className="rounded-full bg-slate-200 px-3 py-1 font-mono text-xs font-bold text-slate-800">
                    {applicationNumber}
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-black text-[#0B1F3A] tracking-tight">
                BPO Partner Application Wizard
              </h1>
              <p className="mt-1 text-sm text-[#64748B]">
                Register your contact centre, certify infrastructure, and unlock verified enterprise client contracts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
              <AutosaveStatusBadge
                status={autosaveStatus}
                onRetry={retryAutosave}
                errorMessage={autosaveError}
              />
              <button
                type="button"
                onClick={async () => {
                  await flushAutosave();
                  setLocation("/partner");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 text-slate-500" />
                Back to Dashboard
              </button>
              <button
                id="header-save-draft-btn"
                type="button"
                onClick={() => saveDraft(true)}
                disabled={saving || isAutosaving}
                className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-bold text-[#0F172A] shadow-xs hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving || isAutosaving ? <Loader2 className="h-4 w-4 animate-spin text-[#214ECF]" /> : <Save className="h-4 w-4 text-[#214ECF]" />}
                Save Draft
              </button>
            </div>
          </div>

          {/* Feedback alerts */}
          {errorMsg && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 8-Stage Enterprise Onboarding Progress Indicator */}
          <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#214ECF]/10 text-[#214ECF]">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A]">
                  BPO Onboarding Journey
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  8 Stages
                </span>
              </div>
              <div className="flex items-center gap-3">
                <AutosaveStatusBadge
                  status={autosaveStatus}
                  onRetry={retryAutosave}
                  errorMessage={autosaveError}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Overall Progress:</span>
                  <span className="font-mono text-xs font-black text-[#214ECF]">
                    {calculatedOverallProgressPct}%
                  </span>
                </div>
              </div>
            </div>

            {/* Steps grid / mobile horizontal scroll */}
            <div className="flex overflow-x-auto pb-1.5 sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-2 no-scrollbar">
              {ONBOARDING_STAGES.map((s) => {
                const Icon = s.icon;
                const stageMap: Record<number, boolean> = {
                  0: isCompanyStageDone,
                  1: isCentreStageDone,
                  2: isDocsStageDone,
                  3: isVerificationStageDone,
                  4: isCapacityStageDone,
                  5: isAgreementStageDone,
                  6: isFinalSubmitted,
                  7: isActivated,
                };
                
                const isStageComplete = stageMap[s.stepIndex] || false;
                let stageStatusText = "Pending";
                let isCurrent = s.stepIndex === currentStep;
                let isDone = isStageComplete;

                if (isFinalSubmitted) {
                  if (s.stepIndex < 7) {
                    isDone = isStageComplete;
                    stageStatusText = isStageComplete ? "Completed" : "Incomplete";
                  } else {
                    isCurrent = true;
                    stageStatusText = applicationStatus === "approved" ? "Approved" : "Under Review";
                  }
                } else {
                  if (isCurrent) {
                    stageStatusText = isDone ? "Completed" : "In Progress";
                  } else if (isDone) {
                    stageStatusText = "Completed";
                  } else {
                    stageStatusText = "Pending";
                  }
                }

                const isClickable = !isFinalSubmitted && (s.stepIndex <= currentStep || (hasSignedAgreement && s.stepIndex === 6));

                return (
                  <button
                    key={s.stepNumber}
                    type="button"
                    disabled={!isClickable}
                    onClick={async () => {
                      if (isClickable) {
                        await flushAutosave();
                        setCurrentStep(s.stepIndex);
                      }
                    }}
                    className={`group flex flex-col items-start gap-1 rounded-xl p-2.5 text-left transition-all duration-150 min-w-[105px] shrink-0 sm:min-w-0 sm:shrink ${
                      isCurrent
                        ? "bg-[#214ECF] text-white shadow-md shadow-[#214ECF]/20 ring-1 ring-[#214ECF]"
                        : isDone
                        ? "bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200/70"
                        : "bg-slate-50/50 text-slate-400 hover:text-slate-600 border border-slate-100"
                    } ${!isClickable ? "cursor-default opacity-60" : "cursor-pointer"}`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={`font-mono text-[10px] font-bold ${
                          isCurrent ? "text-blue-100" : isDone ? "text-[#214ECF]" : "text-slate-400"
                        }`}
                      >
                        {s.stepNumber}
                      </span>
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isCurrent ? "text-white" : isDone ? "text-[#214ECF]" : "text-slate-400"
                        }`}
                      />
                    </div>
                    <span className="truncate text-xs font-bold w-full leading-tight">
                      {s.title}
                    </span>
                    <span
                      className={`text-[9px] truncate w-full font-medium ${
                        isCurrent ? "text-blue-200" : isDone ? "text-slate-600" : "text-slate-400"
                      }`}
                    >
                      {stageStatusText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wizard Body Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-10 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]">
            <AnimatePresence mode="wait">
              {/* STEP 1: COMPANY INFORMATION */}
              {currentStep === 0 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="space-y-8"
                >
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#214ECF]/10 via-[#214ECF]/15 to-[#214ECF]/5 border border-[#214ECF]/20 text-[#214ECF] shadow-xs">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#214ECF]">
                            Enterprise Onboarding
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-[11px] font-semibold text-slate-500">
                            Initial Accreditation
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight">
                          Step 1: Company Information
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                          Provide your legal registered organization and leadership details.
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pt-2 sm:pt-0">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1 border border-slate-200/80">
                        <span className="font-mono text-xs font-bold text-[#214ECF]">01</span>
                        <span className="text-[10px] font-medium text-slate-400">/</span>
                        <span className="font-mono text-xs font-semibold text-slate-500">08</span>
                      </div>
                      <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-[12.5%] rounded-full bg-[#214ECF] transition-all duration-500" />
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Legal Entity & Organization */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-1">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#214ECF]/10 text-[#214ECF]">
                        <Building className="h-3 w-3" />
                      </div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                        Legal Entity & Organization
                      </h3>
                    </div>

                    <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
                      {/* Company Name */}
                      <div className="group space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 group-focus-within:text-[#214ECF] transition-colors flex items-center gap-1">
                            Company Name
                            <span className="text-red-500 font-semibold">*</span>
                          </label>
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-[#214ECF] transition-colors">
                            <Building2 className="h-4 w-4 shrink-0" />
                          </div>
                          <input
                            type="text"
                            required
                            value={formData.companyData.companyName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyData: { ...formData.companyData, companyName: e.target.value },
                              })
                            }
                            placeholder="e.g. Apex Global Solutions Pvt Ltd"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#214ECF] focus:bg-white focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                          />
                        </div>
                      </div>

                      {/* Legal Entity Type */}
                      <div className="group space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 group-focus-within:text-[#214ECF] transition-colors flex items-center gap-1">
                            Legal Entity Type
                            <span className="text-red-500 font-semibold">*</span>
                          </label>
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-[#214ECF] transition-colors">
                            <Scale className="h-4 w-4 shrink-0" />
                          </div>
                          <select
                            value={formData.companyData.legalEntity}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyData: { ...formData.companyData, legalEntity: e.target.value },
                              })
                            }
                            className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-10 py-2.5 text-sm font-medium text-slate-900 hover:border-slate-300 hover:bg-white focus:border-[#214ECF] focus:bg-white focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200 cursor-pointer"
                          >
                            <option value="Private Limited">Private Limited (Pvt Ltd)</option>
                            <option value="Public Limited">Public Limited</option>
                            <option value="LLP">Limited Liability Partnership (LLP)</option>
                            <option value="Partnership">Partnership Firm</option>
                            <option value="Sole Proprietorship">Sole Proprietorship</option>
                            <option value="Corporation (US/Intl)">Corporation (US / International)</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 group-focus-within:text-[#214ECF] transition-colors">
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      </div>

                      {/* Company Website */}
                      <div className="group space-y-1.5 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 group-focus-within:text-[#214ECF] transition-colors flex items-center gap-1">
                            Company Website
                            <span className="text-[11px] font-normal text-slate-400 lowercase tracking-normal">(optional)</span>
                          </label>
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-[#214ECF] transition-colors">
                            <Globe className="h-4 w-4 shrink-0" />
                          </div>
                          <input
                            type="url"
                            value={formData.companyData.website}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyData: { ...formData.companyData, website: e.target.value },
                              })
                            }
                            placeholder="https://yourcompany.com"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#214ECF] focus:bg-white focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Primary Leadership & Contact */}
                  <div className="border-t border-slate-100 pt-6 space-y-4">
                    <div className="flex items-center gap-2 pb-1">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#214ECF]/10 text-[#214ECF]">
                        <User className="h-3 w-3" />
                      </div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                        Primary Leadership & Direct Contact
                      </h3>
                    </div>

                    <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
                      {/* Owner / Primary Contact Person */}
                      <div className="group space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 group-focus-within:text-[#214ECF] transition-colors flex items-center gap-1">
                            Owner / Primary Contact Person
                            <span className="text-red-500 font-semibold">*</span>
                          </label>
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-[#214ECF] transition-colors">
                            <User className="h-4 w-4 shrink-0" />
                          </div>
                          <input
                            type="text"
                            required
                            value={formData.companyData.ownerName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyData: { ...formData.companyData, ownerName: e.target.value },
                              })
                            }
                            placeholder="Full Name"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#214ECF] focus:bg-white focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                          />
                        </div>
                      </div>

                      {/* Official Business Email */}
                      <div className="group space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 group-focus-within:text-[#214ECF] transition-colors flex items-center gap-1">
                            Official Business Email
                            <span className="text-red-500 font-semibold">*</span>
                          </label>
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-[#214ECF] transition-colors">
                            <Mail className="h-4 w-4 shrink-0" />
                          </div>
                          <input
                            type="email"
                            required
                            value={formData.companyData.email}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyData: { ...formData.companyData, email: e.target.value },
                              })
                            }
                            placeholder="contact@yourcompany.com"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#214ECF] focus:bg-white focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                          />
                        </div>
                      </div>

                      {/* Primary Phone / Mobile */}
                      <div className="group space-y-1.5 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 group-focus-within:text-[#214ECF] transition-colors flex items-center gap-1">
                            Primary Phone / Mobile
                            <span className="text-red-500 font-semibold">*</span>
                          </label>
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-[#214ECF] transition-colors">
                            <Phone className="h-4 w-4 shrink-0" />
                          </div>
                          <input
                            type="tel"
                            required
                            value={formData.companyData.phone}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyData: { ...formData.companyData, phone: e.target.value },
                              })
                            }
                            placeholder="+91 9876543210"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#214ECF] focus:bg-white focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Registered Office Location */}
                  <div className="border-t border-slate-100 pt-6 space-y-4">
                    <div className="flex items-center gap-2 pb-1">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#214ECF]/10 text-[#214ECF]">
                        <MapPin className="h-3 w-3" />
                      </div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                        Registered Office Location
                      </h3>
                    </div>

                    <div className="grid gap-4 sm:gap-5 sm:grid-cols-3">
                      {/* Registered Address */}
                      <div className="group space-y-1.5 sm:col-span-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 group-focus-within:text-[#214ECF] transition-colors flex items-center gap-1">
                            Registered Address
                            <span className="text-red-500 font-semibold">*</span>
                          </label>
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-[#214ECF] transition-colors">
                            <MapPin className="h-4 w-4 shrink-0" />
                          </div>
                          <input
                            type="text"
                            required
                            value={formData.companyData.address}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyData: { ...formData.companyData, address: e.target.value },
                              })
                            }
                            placeholder="Building, Street, Landmark"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#214ECF] focus:bg-white focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                          />
                        </div>
                      </div>

                      {/* City */}
                      <div className="group space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 group-focus-within:text-[#214ECF] transition-colors flex items-center gap-1">
                            City
                            <span className="text-[11px] font-normal text-slate-400 lowercase tracking-normal">(optional)</span>
                          </label>
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-[#214ECF] transition-colors">
                            <Building className="h-4 w-4 shrink-0" />
                          </div>
                          <input
                            type="text"
                            value={formData.companyData.city}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyData: { ...formData.companyData, city: e.target.value },
                              })
                            }
                            placeholder="e.g. Pune, Bangalore, Manila"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#214ECF] focus:bg-white focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                          />
                        </div>
                      </div>

                      {/* State / Province */}
                      <div className="group space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 group-focus-within:text-[#214ECF] transition-colors flex items-center gap-1">
                            State / Province
                            <span className="text-[11px] font-normal text-slate-400 lowercase tracking-normal">(optional)</span>
                          </label>
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-[#214ECF] transition-colors">
                            <Map className="h-4 w-4 shrink-0" />
                          </div>
                          <input
                            type="text"
                            value={formData.companyData.state}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyData: { ...formData.companyData, state: e.target.value },
                              })
                            }
                            placeholder="e.g. Maharashtra, Karnataka"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#214ECF] focus:bg-white focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                          />
                        </div>
                      </div>

                      {/* Country */}
                      <div className="group space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 group-focus-within:text-[#214ECF] transition-colors flex items-center gap-1">
                            Country
                            <span className="text-[11px] font-normal text-slate-400 lowercase tracking-normal">(optional)</span>
                          </label>
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-[#214ECF] transition-colors">
                            <Globe className="h-4 w-4 shrink-0" />
                          </div>
                          <input
                            type="text"
                            value={formData.companyData.country}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                companyData: { ...formData.companyData, country: e.target.value },
                              })
                            }
                            placeholder="e.g. India, Philippines"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-[#214ECF] focus:bg-white focus:ring-2 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                          />
                          {formData.companyData.country && (
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                              <span className="inline-flex items-center rounded-md bg-[#214ECF]/10 px-2 py-0.5 text-[10px] font-bold text-[#214ECF]">
                                Primary Region
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </motion.div>
              )}

              {/* STEP 2: OFFICE & CENTRE SETUP */}
              {currentStep === 1 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="space-y-8"
                >
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#214ECF]/10 via-[#214ECF]/15 to-[#214ECF]/5 border border-[#214ECF]/20 text-[#214ECF] shadow-xs">
                        <MapPin className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#214ECF]">
                            Facility Details
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-[11px] font-semibold text-slate-500">
                            Centre Setup
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight">
                          Step 2: Office & Centre Setup
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                          Capacity, physical centre location, operating shifts, and seating infrastructure.
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pt-2 sm:pt-0">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1 border border-slate-200/80">
                        <span className="font-mono text-xs font-bold text-[#214ECF]">02</span>
                        <span className="text-[10px] font-medium text-slate-400">/</span>
                        <span className="font-mono text-xs font-semibold text-slate-500">08</span>
                      </div>
                      <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-[25%] rounded-full bg-[#214ECF] transition-all duration-500" />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Centre Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.centreData.centreName}
                        onChange={(e) => setFormData({ ...formData, centreData: { ...formData.centreData, centreName: e.target.value } })}
                        placeholder="e.g. Hinjewadi Tech Centre 1"
                        className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium focus:border-[#214ECF] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Physical Centre Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.centreData.centreAddress}
                        onChange={(e) => setFormData({ ...formData, centreData: { ...formData.centreData, centreAddress: e.target.value } })}
                        placeholder="Centre Location / IT Park"
                        className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium focus:border-[#214ECF] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Total Seats Installed <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="5"
                        required
                        value={formData.centreData.totalSeats}
                        onChange={(e) => setFormData({ ...formData, centreData: { ...formData.centreData, totalSeats: e.target.value } })}
                        placeholder="e.g. 50"
                        className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium focus:border-[#214ECF] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Immediately Available Seats <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.centreData.availableSeats}
                        onChange={(e) => setFormData({ ...formData, centreData: { ...formData.centreData, availableSeats: e.target.value } })}
                        placeholder="e.g. 20"
                        className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium focus:border-[#214ECF] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Currently Active Agents
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.centreData.activeAgents}
                        onChange={(e) => setFormData({ ...formData, centreData: { ...formData.centreData, activeAgents: e.target.value } })}
                        placeholder="e.g. 30"
                        className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium focus:border-[#214ECF] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Operating Shift / Working Hours
                      </label>
                      <select
                        value={formData.centreData.workingHours}
                        onChange={(e) => setFormData({ ...formData, centreData: { ...formData.centreData, workingHours: e.target.value } })}
                        className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-medium focus:border-[#214ECF] focus:outline-none"
                      >
                        <option value="24/7">24/7 Round the clock</option>
                        <option value="US Shift">US Shift (Night IST / EST-PST)</option>
                        <option value="UK Shift">UK / EMEA Shift (GMT)</option>
                        <option value="APAC Shift">APAC / Australia Shift (AEST)</option>
                        <option value="Domestic Day">Domestic Day Shift (9 AM - 6 PM)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 pt-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                        International Dialing Experience
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${formData.centreData.usExperience ? "border-[#214ECF] bg-[#214ECF]/5" : "border-slate-200"}`}>
                          <input
                            type="checkbox"
                            checked={formData.centreData.usExperience}
                            onChange={(e) => setFormData({ ...formData, centreData: { ...formData.centreData, usExperience: e.target.checked } })}
                            className="h-4 w-4 rounded border-slate-300 text-[#214ECF] focus:ring-[#214ECF]"
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-900">US Experience</p>
                            <p className="text-[11px] text-slate-500">Outbound/Inbound USA campaigns</p>
                          </div>
                        </label>

                        <label className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${formData.centreData.ukExperience ? "border-[#214ECF] bg-[#214ECF]/5" : "border-slate-200"}`}>
                          <input
                            type="checkbox"
                            checked={formData.centreData.ukExperience}
                            onChange={(e) => setFormData({ ...formData, centreData: { ...formData.centreData, ukExperience: e.target.checked } })}
                            className="h-4 w-4 rounded border-slate-300 text-[#214ECF] focus:ring-[#214ECF]"
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-900">UK Experience</p>
                            <p className="text-[11px] text-slate-500">UK / Europe process expertise</p>
                          </div>
                        </label>

                        <label className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${formData.centreData.domesticExperience ? "border-[#214ECF] bg-[#214ECF]/5" : "border-slate-200"}`}>
                          <input
                            type="checkbox"
                            checked={formData.centreData.domesticExperience}
                            onChange={(e) => setFormData({ ...formData, centreData: { ...formData.centreData, domesticExperience: e.target.checked } })}
                            className="h-4 w-4 rounded border-slate-300 text-[#214ECF] focus:ring-[#214ECF]"
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-900">Domestic Experience</p>
                            <p className="text-[11px] text-slate-500">Tier 1 & 2 regional language delivery</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: COMPLIANCE & LEGAL DOCUMENTS */}
              {currentStep === 2 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="space-y-8"
                >
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#214ECF]/10 via-[#214ECF]/15 to-[#214ECF]/5 border border-[#214ECF]/20 text-[#214ECF] shadow-xs">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#214ECF]">
                            KYC & Accreditation
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-[11px] font-semibold text-slate-500">
                            Independent 25 MB Limit
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight">
                          Step 3: Compliance & Legal Documents
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                          Upload official regulatory and business verification documents. Each document slot is validated independently up to 25 MB.
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pt-2 sm:pt-0">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1 border border-slate-200/80">
                        <span className="font-mono text-xs font-bold text-[#214ECF]">03</span>
                        <span className="text-[10px] font-medium text-slate-400">/</span>
                        <span className="font-mono text-xs font-semibold text-slate-500">08</span>
                      </div>
                      <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-[37.5%] rounded-full bg-[#214ECF] transition-all duration-500" />
                      </div>
                    </div>
                  </div>

                  {/* Documents List */}
                  <div className="space-y-4">
                    {REQUIRED_DOCUMENTS.map((doc) => {
                      const upload = uploadedDocs[doc.type];
                      const isUploading = uploadingDoc === doc.type;
                      const Icon = doc.icon || FileText;
                      const isSuccess = upload && upload.status !== "error" && upload.status !== "rejected";

                      return (
                        <div
                          key={doc.type}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4.5 transition-all ${
                            upload?.error
                              ? "border-red-300 bg-red-50/40"
                              : isSuccess
                              ? "border-emerald-200 bg-emerald-50/30"
                              : "border-[#E2E8F0] bg-slate-50/60"
                          }`}
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <div
                              className={`p-2.5 rounded-xl shrink-0 ${
                                isSuccess ? "bg-emerald-100 text-emerald-700" : "bg-[#214ECF]/10 text-[#214ECF]"
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-sm text-[#0B1F3A]">{doc.label}</h3>
                                {isSuccess ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                    Uploaded
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                                    Required
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#64748B] mt-0.5">{doc.description}</p>

                              {isSuccess && (
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                  <span className="font-mono font-bold text-slate-800 truncate">
                                    File: {upload.fileName}
                                  </span>
                                  {upload.fileSize ? (
                                    <span className="font-semibold text-slate-500">
                                      Size: {formatFileSize(upload.fileSize)}
                                    </span>
                                  ) : null}
                                </div>
                              )}

                              {upload?.error && (
                                <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-red-100/90 px-3 py-2 text-xs font-semibold text-red-700 border border-red-200">
                                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                                  <span>{upload.error}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <label
                              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs cursor-pointer transition-all ${
                                isSuccess
                                  ? "bg-white border border-slate-300 text-slate-800 hover:bg-slate-100"
                                  : "bg-[#214ECF] text-white hover:bg-[#1A3DB3] shadow-md shadow-[#214ECF]/20"
                              }`}
                            >
                              {isUploading ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="h-3.5 w-3.5" />
                                  <span>{isSuccess ? "Replace / Re-upload" : "Upload Document"}</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.docx"
                                className="hidden"
                                disabled={isUploading}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleFileUpload(doc.type, f);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* STEP 4: TECHNICAL & PHYSICAL INFRASTRUCTURE */}
              {currentStep === 3 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="space-y-8"
                >
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#214ECF]/10 via-[#214ECF]/15 to-[#214ECF]/5 border border-[#214ECF]/20 text-[#214ECF] shadow-xs">
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#214ECF]">
                            Technical Accreditation
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-[11px] font-semibold text-slate-500">
                            Infrastructure Audit
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight">
                          Step 4: Technical & Physical Infrastructure
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                          Audited hardware, power, connectivity, and security capabilities for enterprise BPO operations.
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pt-2 sm:pt-0">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1 border border-slate-200/80">
                        <span className="font-mono text-xs font-bold text-[#214ECF]">04</span>
                        <span className="text-[10px] font-medium text-slate-400">/</span>
                        <span className="font-mono text-xs font-semibold text-slate-500">08</span>
                      </div>
                      <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-[50%] rounded-full bg-[#214ECF] transition-all duration-500" />
                      </div>
                    </div>
                  </div>

                  {/* Infrastructure Fields Grid with in-input icons */}
                  <div className="grid gap-6 sm:grid-cols-2">
                    {/* 1. Primary Internet Bandwidth */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Primary Internet Bandwidth
                      </label>
                      <div className="relative flex items-center group">
                        <div className="absolute left-2.5 flex h-9.5 w-9.5 items-center justify-center rounded-lg bg-[#214ECF]/10 text-[#214ECF] pointer-events-none transition-colors duration-200 group-focus-within:bg-[#214ECF]/15">
                          <Wifi className="h-[18px] w-[18px] text-[#214ECF]" />
                        </div>
                        <input
                          type="text"
                          value={formData.infrastructureData.internetBandwidth}
                          onChange={(e) => setFormData({ ...formData, infrastructureData: { ...formData.infrastructureData, internetBandwidth: e.target.value } })}
                          placeholder="1 Gbps Leased Line (1:1)"
                          className="w-full rounded-[14px] border border-slate-200/90 bg-white pl-14 pr-4 py-3 text-sm font-semibold text-[#0B1F3A] shadow-2xs placeholder:text-slate-400 hover:border-slate-300 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* 2. Backup Internet Line */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Backup Internet Line
                      </label>
                      <div className="relative flex items-center group">
                        <div className="absolute left-2.5 flex h-9.5 w-9.5 items-center justify-center rounded-lg bg-[#214ECF]/10 text-[#214ECF] pointer-events-none transition-colors duration-200 group-focus-within:bg-[#214ECF]/15">
                          <Network className="h-[18px] w-[18px] text-[#214ECF]" />
                        </div>
                        <input
                          type="text"
                          value={formData.infrastructureData.backupInternet}
                          onChange={(e) => setFormData({ ...formData, infrastructureData: { ...formData.infrastructureData, backupInternet: e.target.value } })}
                          placeholder="500 Mbps Secondary ISP Fiber"
                          className="w-full rounded-[14px] border border-slate-200/90 bg-white pl-14 pr-4 py-3 text-sm font-semibold text-[#0B1F3A] shadow-2xs placeholder:text-slate-400 hover:border-slate-300 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* 3. Power Backup (UPS + DG Generator) */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Power Backup (UPS + DG Generator)
                      </label>
                      <div className="relative flex items-center group">
                        <div className="absolute left-2.5 flex h-9.5 w-9.5 items-center justify-center rounded-lg bg-[#214ECF]/10 text-[#214ECF] pointer-events-none transition-colors duration-200 group-focus-within:bg-[#214ECF]/15">
                          <Zap className="h-[18px] w-[18px] text-[#214ECF]" />
                        </div>
                        <input
                          type="text"
                          value={formData.infrastructureData.powerBackup}
                          onChange={(e) => setFormData({ ...formData, infrastructureData: { ...formData.infrastructureData, powerBackup: e.target.value } })}
                          placeholder="Online UPS 30 kVA + 125 kVA DG Set"
                          className="w-full rounded-[14px] border border-slate-200/90 bg-white pl-14 pr-4 py-3 text-sm font-semibold text-[#0B1F3A] shadow-2xs placeholder:text-slate-400 hover:border-slate-300 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* 4. Computer Hardware Specifications */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Computer Hardware Specifications
                      </label>
                      <div className="relative flex items-center group">
                        <div className="absolute left-2.5 flex h-9.5 w-9.5 items-center justify-center rounded-lg bg-[#214ECF]/10 text-[#214ECF] pointer-events-none transition-colors duration-200 group-focus-within:bg-[#214ECF]/15">
                          <Monitor className="h-[18px] w-[18px] text-[#214ECF]" />
                        </div>
                        <input
                          type="text"
                          value={formData.infrastructureData.computers}
                          onChange={(e) => setFormData({ ...formData, infrastructureData: { ...formData.infrastructureData, computers: e.target.value } })}
                          placeholder="i5 12th Gen, 16GB RAM, SSD"
                          className="w-full rounded-[14px] border border-slate-200/90 bg-white pl-14 pr-4 py-3 text-sm font-semibold text-[#0B1F3A] shadow-2xs placeholder:text-slate-400 hover:border-slate-300 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* 5. Headsets & Audio Hardware */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Headsets & Audio Hardware
                      </label>
                      <div className="relative flex items-center group">
                        <div className="absolute left-2.5 flex h-9.5 w-9.5 items-center justify-center rounded-lg bg-[#214ECF]/10 text-[#214ECF] pointer-events-none transition-colors duration-200 group-focus-within:bg-[#214ECF]/15">
                          <Headphones className="h-[18px] w-[18px] text-[#214ECF]" />
                        </div>
                        <input
                          type="text"
                          value={formData.infrastructureData.headsets}
                          onChange={(e) => setFormData({ ...formData, infrastructureData: { ...formData.infrastructureData, headsets: e.target.value } })}
                          placeholder="Jabra Noise Cancelling USB"
                          className="w-full rounded-[14px] border border-slate-200/90 bg-white pl-14 pr-4 py-3 text-sm font-semibold text-[#0B1F3A] shadow-2xs placeholder:text-slate-400 hover:border-slate-300 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* 6. CCTV Surveillance Coverage */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        CCTV Surveillance Coverage
                      </label>
                      <div className="relative flex items-center group">
                        <div className="absolute left-2.5 flex h-9.5 w-9.5 items-center justify-center rounded-lg bg-[#214ECF]/10 text-[#214ECF] pointer-events-none transition-colors duration-200 group-focus-within:bg-[#214ECF]/15">
                          <Camera className="h-[18px] w-[18px] text-[#214ECF]" />
                        </div>
                        <input
                          type="text"
                          value={formData.infrastructureData.cctv}
                          onChange={(e) => setFormData({ ...formData, infrastructureData: { ...formData.infrastructureData, cctv: e.target.value } })}
                          placeholder="100% Floor & Server Room Coverage (90 Days retention)"
                          className="w-full rounded-[14px] border border-slate-200/90 bg-white pl-14 pr-4 py-3 text-sm font-semibold text-[#0B1F3A] shadow-2xs placeholder:text-slate-400 hover:border-slate-300 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* 7. Access Control Security */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Access Control Security
                      </label>
                      <div className="relative flex items-center group">
                        <div className="absolute left-2.5 flex h-9.5 w-9.5 items-center justify-center rounded-lg bg-[#214ECF]/10 text-[#214ECF] pointer-events-none transition-colors duration-200 group-focus-within:bg-[#214ECF]/15">
                          <ShieldCheck className="h-[18px] w-[18px] text-[#214ECF]" />
                        </div>
                        <input
                          type="text"
                          value={formData.infrastructureData.accessControl}
                          onChange={(e) => setFormData({ ...formData, infrastructureData: { ...formData.infrastructureData, accessControl: e.target.value } })}
                          placeholder="Biometric Fingerprint + RFID Card Access"
                          className="w-full rounded-[14px] border border-slate-200/90 bg-white pl-14 pr-4 py-3 text-sm font-semibold text-[#0B1F3A] shadow-2xs placeholder:text-slate-400 hover:border-slate-300 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* 8. Dialer Platform */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        Dialer Platform
                      </label>
                      <div className="relative flex items-center group">
                        <div className="absolute left-2.5 flex h-9.5 w-9.5 items-center justify-center rounded-lg bg-[#214ECF]/10 text-[#214ECF] pointer-events-none transition-colors duration-200 group-focus-within:bg-[#214ECF]/15">
                          <PhoneCall className="h-[18px] w-[18px] text-[#214ECF]" />
                        </div>
                        <input
                          type="text"
                          value={formData.infrastructureData.dialer}
                          onChange={(e) => setFormData({ ...formData, infrastructureData: { ...formData.infrastructureData, dialer: e.target.value } })}
                          placeholder="Vicidial Enterprise / Cloud Asterisk"
                          className="w-full rounded-[14px] border border-slate-200/90 bg-white pl-14 pr-4 py-3 text-sm font-semibold text-[#0B1F3A] shadow-2xs placeholder:text-slate-400 hover:border-slate-300 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/15 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 5: CAPACITY & DELIVERY CAPABILITIES */}
              {currentStep === 4 && (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="space-y-8"
                >
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#214ECF]/10 via-[#214ECF]/15 to-[#214ECF]/5 border border-[#214ECF]/20 text-[#214ECF] shadow-xs">
                        <Cpu className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#214ECF]">
                            Operational Bandwidth
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-[11px] font-semibold text-slate-500">
                            Seat & Process Capacity
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight">
                          Step 5: Capacity & Delivery Capabilities
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                          Confirm your active process capabilities, campaigns, and delivery capacity before proceeding to the agreement.
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pt-2 sm:pt-0">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1 border border-slate-200/80">
                        <span className="font-mono text-xs font-bold text-[#214ECF]">05</span>
                        <span className="text-[10px] font-medium text-slate-400">/</span>
                        <span className="font-mono text-xs font-semibold text-slate-500">08</span>
                      </div>
                      <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-[62.5%] rounded-full bg-[#214ECF] transition-all duration-500" />
                      </div>
                    </div>
                  </div>

                  {/* Centre Capacity Overview Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Installed Seats</span>
                      <p className="text-xl font-black text-[#0B1F3A] mt-1">{formData.centreData.totalSeats || "0"} Seats</p>
                      <span className="text-[10px] text-slate-400">Fully equipped positions</span>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Available Seats</span>
                      <p className="text-xl font-black text-emerald-800 mt-1">{formData.centreData.availableSeats || "0"} Ready</p>
                      <span className="text-[10px] text-emerald-600 font-medium">Ready for deployment</span>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Agents</span>
                      <p className="text-xl font-black text-[#0B1F3A] mt-1">{formData.centreData.activeAgents || "0"} Agents</p>
                      <span className="text-[10px] text-slate-400">Current active headcount</span>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Operating Shift</span>
                      <p className="text-sm font-black text-[#0B1F3A] mt-1 truncate">{formData.centreData.workingHours}</p>
                      <span className="text-[10px] text-slate-400">Coverage window</span>
                    </div>
                  </div>

                  {/* Process / Campaign Experience */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                        Campaign Domains & Process Experience
                      </h3>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        Select all active campaigns and domains your team has proven delivery experience in.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {PROCESS_OPTIONS.map((proc) => {
                        const selected = formData.processExperience.includes(proc);
                        return (
                          <button
                            key={proc}
                            type="button"
                            onClick={() => toggleProcess(proc)}
                            className={`flex items-center justify-between rounded-2xl border p-4 text-left font-bold text-sm transition-all ${
                              selected
                                ? "border-[#214ECF] bg-[#214ECF]/5 text-[#214ECF] ring-1 ring-[#214ECF]"
                                : "border-[#E2E8F0] bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <span>{proc}</span>
                            {selected ? (
                              <CheckCircle2 className="h-4 w-4 text-[#214ECF] shrink-0" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border border-slate-300 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notice about Step 6 Agreement */}
                  <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 text-xs">
                    <Info className="h-5 w-5 text-[#214ECF] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-[#0B1F3A]">Next: Global Delivery Partner Agreement</h4>
                      <p className="text-[#475569] mt-0.5">
                        Clicking <strong>Next Step</strong> will open Step 6 (Agreement), where you will download the authoritative Master Delivery Agreement, sign it outside the portal, and upload the signed PDF.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 6: GLOBAL DELIVERY PARTNER AGREEMENT */}
              {currentStep === 5 && (
                <motion.div
                  key="step6"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="space-y-8"
                >
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#214ECF]/10 via-[#214ECF]/15 to-[#214ECF]/5 border border-[#214ECF]/20 text-[#214ECF] shadow-xs">
                        <FileSignature className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#214ECF]">
                            Legal Execution
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-[11px] font-semibold text-slate-500">
                            Master Delivery Agreement
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight">
                          Step 6: Global Delivery Partner Agreement
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                          Download, review, sign externally, and upload the signed Master Global Delivery Partner Agreement.
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pt-2 sm:pt-0">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1 border border-slate-200/80">
                        <span className="font-mono text-xs font-bold text-[#214ECF]">06</span>
                        <span className="text-[10px] font-medium text-slate-400">/</span>
                        <span className="font-mono text-xs font-semibold text-slate-500">08</span>
                      </div>
                      <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-[75%] rounded-full bg-[#214ECF] transition-all duration-500" />
                      </div>
                    </div>
                  </div>

                  {/* Prominent Agreement Card */}
                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/40 to-blue-50/20 p-6 sm:p-8 shadow-xs">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200/80 pb-6">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#214ECF] text-white shadow-md shadow-[#214ECF]/20">
                          <FileSignature className="h-7 w-7" />
                        </div>
                        <div>
                          <span className="text-[11px] font-black uppercase tracking-wider text-[#214ECF]">
                            Authoritative Master SLA Template
                          </span>
                          <h3 className="text-xl font-black text-[#0B1F3A] mt-0.5">
                            GLOBAL DELIVERY PARTNER AGREEMENT
                          </h3>
                          <p className="text-xs text-slate-600 mt-1">
                            Agreement Ready for Signature & Operational Delivery Certification
                          </p>
                        </div>
                      </div>

                      {/* Metadata badges */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agreement ID</span>
                          <span className="font-mono text-xs font-black text-[#0B1F3A]">
                            THK-GDP-{applicationNumber ? applicationNumber.replace("THK-", "") : "PARTNER"}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Version</span>
                          <span className="text-xs font-black text-[#0B1F3A]">1.0 (Master SLA)</span>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                          {hasSignedAgreement ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Signed Uploaded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                              <Clock className="h-3.5 w-3.5 text-amber-600" />
                              Awaiting Upload
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: View and Download */}
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsViewAgreementOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#214ECF]/30 bg-white px-5 py-2.5 text-xs font-bold text-[#214ECF] shadow-xs hover:bg-[#214ECF]/5 transition cursor-pointer"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View Agreement</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadAgreement}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#214ECF] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#214ECF]/20 hover:bg-[#1A3EB8] transition cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download Agreement PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Instructions Card */}
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-[#214ECF]" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Partner Signing Instructions
                      </h4>
                    </div>
                    <ol className="grid gap-2 sm:grid-cols-2 text-xs font-medium text-slate-700">
                      <li className="flex items-start gap-2 bg-white rounded-xl p-3 border border-slate-200/70">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#214ECF]/10 text-[11px] font-black text-[#214ECF]">1</span>
                        <span>Download the Global Delivery Partner Agreement using the button above.</span>
                      </li>
                      <li className="flex items-start gap-2 bg-white rounded-xl p-3 border border-slate-200/70">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#214ECF]/10 text-[11px] font-black text-[#214ECF]">2</span>
                        <span>Carefully read all terms, SLA commitments, and data privacy clauses.</span>
                      </li>
                      <li className="flex items-start gap-2 bg-white rounded-xl p-3 border border-slate-200/70">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#214ECF]/10 text-[11px] font-black text-[#214ECF]">3</span>
                        <span>Sign the agreement outside the portal (authorized signatory signature + company stamp).</span>
                      </li>
                      <li className="flex items-start gap-2 bg-white rounded-xl p-3 border border-slate-200/70">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#214ECF]/10 text-[11px] font-black text-[#214ECF]">4</span>
                        <span>Save or scan the signed agreement as a PDF file.</span>
                      </li>
                      <li className="flex items-start gap-2 bg-white rounded-xl p-3 border border-slate-200/70">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#214ECF]/10 text-[11px] font-black text-[#214ECF]">5</span>
                        <span>Upload the signed PDF in the box below (max 25MB).</span>
                      </li>
                      <li className="flex items-start gap-2 bg-white rounded-xl p-3 border border-slate-200/70">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#214ECF]/10 text-[11px] font-black text-[#214ECF]">6</span>
                        <span>Thinkatic Operations/Admin will review and verify your signed agreement.</span>
                      </li>
                    </ol>
                  </div>

                  {/* Upload Signed Agreement Zone */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-wider text-[#0B1F3A]">
                          Upload Signed Agreement
                        </h4>
                        <p className="text-xs text-slate-500">
                          Select and upload your signed PDF (Strictly PDF format, max 25MB).
                        </p>
                      </div>
                      {hasSignedAgreement && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Signed Agreement Uploaded
                        </span>
                      )}
                    </div>

                    {/* Upload Alerts */}
                    {agreementError && (
                      <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                        <span>{agreementError}</span>
                      </div>
                    )}
                    {agreementSuccess && (
                      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{agreementSuccess}</span>
                      </div>
                    )}

                    {/* File Drop / Selector */}
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <label className="flex-1 w-full flex items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#214ECF] bg-slate-50/50 p-6 text-center cursor-pointer transition">
                        <Upload className="h-5 w-5 text-[#214ECF]" />
                        <div className="text-left">
                          <span className="text-xs font-bold text-slate-900 block">
                            {selectedAgreementFile ? selectedAgreementFile.name : "Choose Signed Agreement PDF"}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {selectedAgreementFile ? `${(selectedAgreementFile.size / (1024 * 1024)).toFixed(2)} MB` : "PDF only, up to 25MB"}
                          </span>
                        </div>
                        <input
                          id="signed-agreement-upload-input"
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          disabled={uploadingAgreement}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setSelectedAgreementFile(file);
                              setAgreementError(null);
                            }
                            e.target.value = "";
                          }}
                        />
                      </label>

                      <button
                        id="upload-signed-agreement-btn"
                        type="button"
                        onClick={() => {
                          if (selectedAgreementFile) {
                            handleUploadSignedAgreement(selectedAgreementFile);
                          }
                        }}
                        disabled={!selectedAgreementFile || uploadingAgreement}
                        className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-[#214ECF] px-6 py-4 text-xs font-bold text-white shadow-md shadow-[#214ECF]/20 hover:bg-[#1A3EB8] transition disabled:opacity-50 cursor-pointer"
                      >
                        {uploadingAgreement ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Uploading to Supabase...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            <span>Upload Signed Agreement</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Details if already uploaded */}
                    {hasSignedAgreement && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 mt-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <span className="font-bold text-emerald-900">Signed Agreement Successfully Submitted</span>
                            </div>
                            <p className="text-slate-600 mt-1 font-mono text-[11px]">
                              File: {agreement?.signedDocumentFileName || "Signed_Agreement.pdf"}
                              {agreement?.signedUploadedAt ? ` • Uploaded: ${new Date(agreement.signedUploadedAt).toLocaleString()}` : ""}
                            </p>
                          </div>
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800 shrink-0">
                            Status: Under Operations Review
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* STEP 7: REVIEW & FINAL SUBMIT */}
              {currentStep === 6 && (
                <motion.div
                  key="step7"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="space-y-8"
                >
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#214ECF]/10 via-[#214ECF]/15 to-[#214ECF]/5 border border-[#214ECF]/20 text-[#214ECF] shadow-xs">
                        <ClipboardCheck className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#214ECF]">
                            Final Verification
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-[11px] font-semibold text-slate-500">
                            Pre-Submission Audit
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight">
                          Step 7: Review & Final Submit
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                          Review your complete BPO Partner application before submitting to Thinkatic Operations.
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pt-2 sm:pt-0">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1 border border-slate-200/80">
                        <span className="font-mono text-xs font-bold text-[#214ECF]">
                          {String(totalCompletedStages).padStart(2, "0")}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">/</span>
                        <span className="font-mono text-xs font-semibold text-slate-500">08</span>
                      </div>
                      <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#214ECF] transition-all duration-500"
                          style={{ width: `${calculatedOverallProgressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 6 Summary Cards */}
                  <div className="grid gap-5 md:grid-cols-2">
                    {/* 1. Company Information */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-[#214ECF]" />
                          <span className="text-xs font-black uppercase tracking-wider text-[#214ECF]">Company Information</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCompanyStageDone ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Complete
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                              <AlertCircle className="h-3 w-3 text-amber-600" />
                              Incomplete
                            </span>
                          )}
                          <button type="button" onClick={() => setCurrentStep(0)} className="text-xs font-bold text-[#214ECF] hover:underline cursor-pointer">
                            Edit
                          </button>
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        <div><dt className="text-slate-500 font-medium">Name</dt><dd className="font-bold text-slate-900">{formData.companyData.companyName || "—"}</dd></div>
                        <div><dt className="text-slate-500 font-medium">Entity</dt><dd className="font-bold text-slate-900">{formData.companyData.legalEntity}</dd></div>
                        <div><dt className="text-slate-500 font-medium">Contact</dt><dd className="font-bold text-slate-900">{formData.companyData.ownerName || "—"}</dd></div>
                        <div><dt className="text-slate-500 font-medium">Phone</dt><dd className="font-bold text-slate-900">{formData.companyData.phone || "—"}</dd></div>
                        <div><dt className="text-slate-500 font-medium">Email</dt><dd className="font-bold text-slate-900 truncate">{formData.companyData.email || "—"}</dd></div>
                        <div><dt className="text-slate-500 font-medium">Location</dt><dd className="font-bold text-slate-900">{formData.companyData.city ? `${formData.companyData.city}, ${formData.companyData.state}` : "—"}</dd></div>
                      </dl>
                    </div>

                    {/* 2. Centre Information */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-[#214ECF]" />
                          <span className="text-xs font-black uppercase tracking-wider text-[#214ECF]">Office / Centre Information</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCentreStageDone ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Complete
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                              <AlertCircle className="h-3 w-3 text-amber-600" />
                              Incomplete
                            </span>
                          )}
                          <button type="button" onClick={() => setCurrentStep(1)} className="text-xs font-bold text-[#214ECF] hover:underline cursor-pointer">
                            Edit
                          </button>
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        <div><dt className="text-slate-500 font-medium">Centre Name</dt><dd className="font-bold text-slate-900">{formData.centreData.centreName || "—"}</dd></div>
                        <div><dt className="text-slate-500 font-medium">Address</dt><dd className="font-bold text-slate-900 truncate">{formData.centreData.centreAddress || "—"}</dd></div>
                        <div><dt className="text-slate-500 font-medium">Total Seats</dt><dd className="font-bold text-slate-900">{formData.centreData.totalSeats} Installed</dd></div>
                        <div><dt className="text-slate-500 font-medium">Available Seats</dt><dd className="font-bold text-emerald-700">{formData.centreData.availableSeats} Ready</dd></div>
                        <div><dt className="text-slate-500 font-medium">Shifts</dt><dd className="font-bold text-slate-900">{formData.centreData.workingHours}</dd></div>
                        <div><dt className="text-slate-500 font-medium">Experience</dt><dd className="font-bold text-slate-900">{[formData.centreData.usExperience ? "US" : null, formData.centreData.ukExperience ? "UK" : null, formData.centreData.domesticExperience ? "Domestic" : null].filter(Boolean).join(", ") || "None"}</dd></div>
                      </dl>
                    </div>

                    {/* 3. Regulatory Documents */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#214ECF]" />
                          <span className="text-xs font-black uppercase tracking-wider text-[#214ECF]">Regulatory Documents</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isDocsStageDone ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Ready ({validDocsCount} docs)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                              <AlertCircle className="h-3 w-3 text-amber-600" />
                              {validDocsCount}/3 Uploaded
                            </span>
                          )}
                          <button type="button" onClick={() => setCurrentStep(2)} className="text-xs font-bold text-[#214ECF] hover:underline cursor-pointer">
                            Edit
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2 text-xs">
                        {REQUIRED_DOCUMENTS.map((doc) => {
                          const up = uploadedDocs[doc.type];
                          const isUploaded = up && up.status !== "error" && up.status !== "rejected";
                          return (
                            <div key={doc.type} className="flex items-center justify-between p-2 rounded-xl border border-slate-200/70 bg-white">
                              <span className="font-semibold text-slate-800 truncate pr-2 text-[11px]">{doc.label}</span>
                              {isUploaded ? (
                                <span className="text-[10px] font-bold text-emerald-700">✓ Ready</span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-600">Pending</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. Technical Infrastructure */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-[#214ECF]" />
                          <span className="text-xs font-black uppercase tracking-wider text-[#214ECF]">Office Verification</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isVerificationStageDone ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Audited
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                              <AlertCircle className="h-3 w-3 text-amber-600" />
                              Incomplete
                            </span>
                          )}
                          <button type="button" onClick={() => setCurrentStep(3)} className="text-xs font-bold text-[#214ECF] hover:underline cursor-pointer">
                            Edit
                          </button>
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        <div><dt className="text-slate-500 font-medium">Primary Bandwidth</dt><dd className="font-bold text-slate-900 truncate">{formData.infrastructureData.internetBandwidth || "—"}</dd></div>
                        <div><dt className="text-slate-500 font-medium">Backup Line</dt><dd className="font-bold text-slate-900 truncate">{formData.infrastructureData.backupInternet || "—"}</dd></div>
                        <div><dt className="text-slate-500 font-medium">Power Backup</dt><dd className="font-bold text-slate-900 truncate">{formData.infrastructureData.powerBackup || "—"}</dd></div>
                        <div><dt className="text-slate-500 font-medium">Hardware</dt><dd className="font-bold text-slate-900 truncate">{formData.infrastructureData.computers || "—"}</dd></div>
                        <div><dt className="text-slate-500 font-medium">CCTV</dt><dd className="font-bold text-slate-900 truncate">{formData.infrastructureData.cctv || "—"}</dd></div>
                        <div><dt className="text-slate-500 font-medium">Dialer Platform</dt><dd className="font-bold text-slate-900 truncate">{formData.infrastructureData.dialer || "—"}</dd></div>
                      </dl>
                    </div>

                    {/* 5. Capacity & Capabilities */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-[#214ECF]" />
                          <span className="text-xs font-black uppercase tracking-wider text-[#214ECF]">Capacity & Domains</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCapacityStageDone ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Complete
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                              <AlertCircle className="h-3 w-3 text-amber-600" />
                              Incomplete
                            </span>
                          )}
                          <button type="button" onClick={() => setCurrentStep(4)} className="text-xs font-bold text-[#214ECF] hover:underline cursor-pointer">
                            Edit
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {formData.processExperience.map((p) => (
                          <span key={p} className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-800">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 6. Global Delivery Partner Agreement */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <FileSignature className="h-4 w-4 text-[#214ECF]" />
                          <span className="text-xs font-black uppercase tracking-wider text-[#214ECF]">Agreement</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAgreementStageDone ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Signed Uploaded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                              <AlertCircle className="h-3 w-3 text-amber-600" />
                              Pending
                            </span>
                          )}
                          <button type="button" onClick={() => setCurrentStep(5)} className="text-xs font-bold text-[#214ECF] hover:underline cursor-pointer">
                            Edit
                          </button>
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        <div><dt className="text-slate-500 font-medium">Document</dt><dd className="font-bold text-slate-900 truncate">Global Delivery Partner SLA</dd></div>
                        <div><dt className="text-slate-500 font-medium">Version</dt><dd className="font-bold text-slate-900">1.0</dd></div>
                        <div className="col-span-2">
                          <dt className="text-slate-500 font-medium">Signed PDF</dt>
                          <dd className="font-mono text-[11px] font-bold text-slate-800 truncate">
                            {agreement?.signedDocumentFileName || (hasSignedAgreement ? "Signed_Agreement.pdf" : "Not yet uploaded")}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Declaration & Confirmation */}
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        id="declaration-agreed-checkbox"
                        type="checkbox"
                        checked={formData.declarationAgreed}
                        onChange={(e) => setFormData({ ...formData, declarationAgreed: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-amber-300 text-[#214ECF] focus:ring-[#214ECF]"
                      />
                      <p className="text-xs font-semibold text-amber-950 leading-relaxed">
                        I hereby declare that all information, center infrastructure capacities, compliance documents, and the signed Global Delivery Partner Agreement provided in this application are true, complete, and legally binding. I authorize Thinkatic Operations to verify these details through independent audits and technical tests.
                      </p>
                    </label>
                  </div>

                  {/* Submit Application Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      id="final-submit-application-btn"
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting || !formData.declarationAgreed || !hasSignedAgreement}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-xl bg-[#16A34A] px-10 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                          <span>Submitting to Thinkatic Operations...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5" />
                          <span>SUBMIT APPLICATION FOR FINAL REVIEW</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 8: ACTIVATION / 24-HOUR OPERATIONS REVIEW */}
              {currentStep === 7 && (
                <motion.div
                  key="step8"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="space-y-8"
                >
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#214ECF]/10 via-[#214ECF]/15 to-[#214ECF]/5 border border-[#214ECF]/20 text-[#214ECF] shadow-xs">
                        <Sparkles className="h-6 w-6 text-[#214ECF]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#214ECF]">
                            Accreditation Pending
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-[11px] font-semibold text-slate-500">
                            Operations Audit
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight">
                          Step 8: Activation & 24-Hour Review
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                          Your complete BPO Partner application has been received and is under active manual review by Thinkatic Operations.
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pt-2 sm:pt-0">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 border border-emerald-200 text-emerald-800">
                        <span className="font-mono text-xs font-bold text-emerald-700">08</span>
                        <span className="text-[10px] font-medium text-emerald-400">/</span>
                        <span className="font-mono text-xs font-semibold text-emerald-600">08</span>
                      </div>
                      <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-full rounded-full bg-[#16A34A] transition-all duration-500" />
                      </div>
                    </div>
                  </div>

                  {/* Premium Status Screen matching User Mockup */}
                  <div className="rounded-3xl border border-blue-200/80 bg-gradient-to-b from-blue-50/40 via-white to-white p-6 sm:p-10 shadow-md shadow-blue-500/5 space-y-8">
                    {/* Top Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-100 pb-6">
                      <div
                        id="operations-review-badge"
                        className="inline-flex items-center gap-2 rounded-full bg-[#214ECF]/10 px-4 py-1.5 text-xs font-black text-[#214ECF] border border-[#214ECF]/20"
                      >
                        <Clock className="h-4 w-4 text-[#214ECF] animate-pulse" />
                        <span>UNDER OPERATIONS REVIEW</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-medium text-slate-500 block">Application Reference</span>
                        <span className="font-mono text-sm font-black text-slate-900">{applicationNumber || "THK-APP"}</span>
                      </div>
                    </div>

                    {/* Main Announcement */}
                    <div className="max-w-2xl space-y-3">
                      <h3 className="text-2xl sm:text-3xl font-black text-[#0B1F3A] tracking-tight">
                        Application Submitted Successfully
                      </h3>
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">
                        Your complete BPO Partner application has been submitted to Thinkatic Operations. Our compliance and infrastructure team is reviewing your company information, office verification, documents, capacity, and signed partner agreement.
                      </p>
                    </div>

                    {/* Estimated Turnaround Banner */}
                    <div className="rounded-2xl border border-blue-200 bg-[#214ECF]/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-xs font-black uppercase tracking-wider text-[#214ECF]">
                          Estimated Review Time
                        </span>
                        <p className="text-xl sm:text-2xl font-black text-[#0B1F3A]">
                          Within 24 Hours
                        </p>
                        <p className="text-xs text-slate-500">
                          {submittedAt ? `Submitted: ${new Date(submittedAt).toLocaleString()}` : "Submitted recently"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white border border-blue-200/80 px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs">
                        <span>Status: </span>
                        <span className="text-[#214ECF] font-black">Awaiting Admin Review</span>
                      </div>
                    </div>

                    {/* Verified Checklist */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-6 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Submitted Application Components
                      </h4>
                      <div className="grid gap-2.5 sm:grid-cols-2 text-xs font-semibold text-slate-800">
                        <div className="flex items-center gap-2.5 bg-white rounded-xl p-3 border border-slate-200/80">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>✓ Company Verified</span>
                        </div>
                        <div className="flex items-center gap-2.5 bg-white rounded-xl p-3 border border-slate-200/80">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>✓ Centre Details Submitted</span>
                        </div>
                        <div className="flex items-center gap-2.5 bg-white rounded-xl p-3 border border-slate-200/80">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>✓ Documents Submitted</span>
                        </div>
                        <div className="flex items-center gap-2.5 bg-white rounded-xl p-3 border border-slate-200/80">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>✓ Capacity Submitted</span>
                        </div>
                        <div className="flex items-center gap-2.5 bg-white rounded-xl p-3 border border-slate-200/80 sm:col-span-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>✓ Signed Agreement Submitted</span>
                        </div>
                      </div>
                    </div>

                    {/* Next Steps / Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-slate-200/80">
                      <div className="text-xs text-slate-500">
                        You will receive an email notification when Thinkatic Operations updates your application status.
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href="/partner/application-status"
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                        >
                          <Eye className="h-4 w-4 text-[#214ECF]" />
                          <span>View Detailed Status</span>
                        </Link>
                        <Link
                          href="/partner"
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#214ECF] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#214ECF]/20 hover:bg-[#1A3EB8] transition cursor-pointer"
                        >
                          <span>Partner Dashboard</span>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Wizard Navigation Footer */}
            {currentStep < 7 ? (
              <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-slate-200/80 pt-6">
                <button
                  type="button"
                  onClick={async () => {
                    setErrorMsg("");
                    await flushAutosave();
                    setCurrentStep((prev) => Math.max(0, prev - 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={currentStep === 0}
                  className="inline-flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-700 shadow-2xs hover:border-slate-300 hover:bg-slate-50/80 hover:text-slate-900 active:scale-[0.98] transition-all duration-150 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4 text-slate-500" />
                  <span>Previous</span>
                </button>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <AutosaveStatusBadge
                    status={autosaveStatus}
                    onRetry={retryAutosave}
                    errorMessage={autosaveError}
                  />
                  <button
                    type="button"
                    onClick={() => saveDraft(true)}
                    disabled={saving || isAutosaving}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                  >
                    {saving || isAutosaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#214ECF]" />
                    ) : (
                      <Save className="h-3.5 w-3.5 text-[#214ECF]" />
                    )}
                    <span>Save Draft</span>
                  </button>

                  {currentStep < 6 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#214ECF] px-8 py-2.5 text-sm font-bold text-white shadow-md shadow-[#214ECF]/20 hover:bg-[#1A3EB8] hover:shadow-lg hover:shadow-[#214ECF]/30 active:scale-[0.98] transition-all duration-150 cursor-pointer"
                    >
                      <span>Next Step</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting || !formData.declarationAgreed || !hasSignedAgreement}
                      className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#16A34A] px-8 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                          <span>Submitting Application...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Submit Application</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Inline PDF Preview Modal */}
      {isViewAgreementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6">
          <div className="relative flex flex-col h-[90vh] w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#214ECF]/10 text-[#214ECF]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0B1F3A]">
                    Thinkatic Global Delivery Partner Agreement
                  </h3>
                  <p className="text-xs text-slate-500">
                    Master Service Level Agreement & Operational Delivery Terms (v1.0)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadAgreement}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#214ECF] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1A3EB8] transition cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  id="close-agreement-modal-btn"
                  type="button"
                  onClick={() => setIsViewAgreementOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: iframe */}
            <div className="flex-1 bg-slate-100 p-2 overflow-hidden">
              <iframe
                src={`/api/bpo/agreement/view?token=${encodeURIComponent(token || "")}`}
                className="h-full w-full rounded-lg border border-slate-200 bg-white"
                title="Thinkatic Partner Agreement Preview"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-slate-50 text-xs">
              <span className="text-slate-500">
                Sign this document outside the portal, scan/save as PDF, and upload in Step 6.
              </span>
              <button
                type="button"
                onClick={() => setIsViewAgreementOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
