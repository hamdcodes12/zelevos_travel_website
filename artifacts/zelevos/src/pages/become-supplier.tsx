import React, { useState, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  FileUp,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  FileText,
  Plus,
  Trash2,
  MapPin,
  Mail,
  Phone,
  Globe,
  Lock,
  Layers,
  Sparkles,
  HelpCircle,
  ExternalLink,
  Search,
  RefreshCw,
  X,
  Upload,
  Check,
  FileCheck,
} from "lucide-react";
import { useLocation } from "wouter";

interface UploadedDoc {
  id?: string;
  title: string;
  documentType: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  status?: string;
  uploadedAt?: string;
}

const DRAFT_STORAGE_KEY = "zelevos_supplier_onboarding_draft";

export function BecomeSupplierPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"register" | "status">("register");

  // Multi-step Wizard State: 1: Business Info, 2: Location & Tax, 3: Services, 4: Documents, 5: Password & Agreement
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Official Website Conditional State
  const [hasWebsite, setHasWebsite] = useState<boolean>(false);

  // Registration Form State
  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "Private Limited",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    registrationNumber: "",
    taxId: "",
    description: "",
    operatingLocations: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });

  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Hotel / Accommodation"]);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDoc[]>([]);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  // Draft Banner State
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(false);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState<boolean>(false);

  // Document Upload State
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDocType, setUploadDocType] = useState("business_registration");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [registeredVendor, setRegisteredVendor] = useState<any | null>(null);

  // Resubmission Mode State (when applicant resumes to fix requested changes)
  const [resubmittingApplicationId, setResubmittingApplicationId] = useState<string | null>(null);
  const [changeRequestInfo, setChangeRequestInfo] = useState<{ message: string; areas: string[] } | null>(null);
  const [resubmitNotes, setResubmitNotes] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitSuccess, setResubmitSuccess] = useState("");

  // Status Check State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusPassword, setStatusPassword] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [applicationResult, setApplicationResult] = useState<any | null>(null);
  const [statusError, setStatusError] = useState("");

  const serviceCategories = [
    { id: "Hotel / Accommodation", label: "Hotel / Accommodation", icon: "🏨" },
    { id: "Cab / Transfer", label: "Cab / Transfer", icon: "🚕" },
    { id: "Bus / Transport", label: "Bus / Transport", icon: "🚌" },
    { id: "Activity", label: "Activity / Experience", icon: "🏄" },
    { id: "Sightseeing", label: "Sightseeing Tours", icon: "🏛️" },
    { id: "Guide", label: "Licensed Tourist Guide", icon: "🧭" },
    { id: "Tour Operator", label: "DMC / Tour Operator", icon: "🗺️" },
    { id: "Meals / Food", label: "Meals / Food / Dining", icon: "🍽️" },
    { id: "Other approved travel service", label: "Other Travel Service", icon: "✨" },
  ];

  const businessTypes = [
    "Private Limited",
    "Partnership",
    "Sole Proprietorship",
    "LLP",
    "Individual / Freelance Guide",
    "Registered Society / Trust",
    "Other",
  ];

  const docTypeLabels: Record<string, string> = {
    business_registration: "Business Registration / Incorporation",
    gst_certificate: "GST Registration Certificate",
    id_proof: "Owner / Director ID Proof (Aadhaar / Passport / PAN)",
    tourism_license: "Tourism Department License / Permit",
    service_contract: "Rate Sheet / Service Description",
    other: "Other Verification Document",
  };

  // Check for saved local draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.formData?.businessName || parsed.formData?.email)) {
          setHasSavedDraft(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-save form draft whenever form values change (if not in resubmit mode)
  useEffect(() => {
    if (!registeredVendor && !resubmittingApplicationId) {
      try {
        const draftPayload = {
          formData: {
            ...formData,
            password: "", // do not store raw passwords in localStorage
            confirmPassword: "",
          },
          hasWebsite,
          selectedCategories,
          uploadedDocuments,
          currentStep,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
      } catch {
        // storage quota
      }
    }
  }, [formData, hasWebsite, selectedCategories, uploadedDocuments, currentStep, registeredVendor, resubmittingApplicationId]);

  // Restore saved draft
  const handleRestoreDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData) {
          setFormData((prev) => ({
            ...prev,
            ...parsed.formData,
            password: "",
            confirmPassword: "",
          }));
        }
        if (typeof parsed.hasWebsite === "boolean") {
          setHasWebsite(parsed.hasWebsite);
        }
        if (Array.isArray(parsed.selectedCategories) && parsed.selectedCategories.length > 0) {
          setSelectedCategories(parsed.selectedCategories);
        }
        if (Array.isArray(parsed.uploadedDocuments)) {
          setUploadedDocuments(parsed.uploadedDocuments);
        }
        if (typeof parsed.currentStep === "number" && parsed.currentStep >= 1 && parsed.currentStep <= 5) {
          setCurrentStep(parsed.currentStep);
        }
        setDraftBannerDismissed(true);
      }
    } catch {
      // ignore
    }
  };

  // Discard saved draft
  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setHasSavedDraft(false);
      setDraftBannerDismissed(true);
    } catch {
      // ignore
    }
  };

  const toggleCategory = (catId: string) => {
    if (selectedCategories.includes(catId)) {
      if (selectedCategories.length === 1) return; // Keep at least one
      setSelectedCategories(selectedCategories.filter((c) => c !== catId));
    } else {
      setSelectedCategories([...selectedCategories, catId]);
    }
    setStepErrors((prev) => ({ ...prev, categories: "" }));
  };

  // Website URL validation helper
  const isValidUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  // Step Validation Guard
  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.businessName.trim()) {
        errors.businessName = "Company / Business Legal Name is required.";
      }
      if (!formData.contactName.trim()) {
        errors.contactName = "Owner / Primary Contact Person is required.";
      }
      if (!formData.email.trim() || !formData.email.includes("@") || !formData.email.includes(".")) {
        errors.email = "A valid business email address is required.";
      }
      if (!formData.phone.trim()) {
        errors.phone = "Phone / WhatsApp number is required.";
      }
      if (hasWebsite) {
        if (!formData.website.trim()) {
          errors.website = "Official Website URL is required when 'Yes' is selected.";
        } else if (!isValidUrl(formData.website.trim())) {
          errors.website = "Please provide a valid website URL starting with https:// or http://";
        }
      }
    } else if (step === 2) {
      if (!formData.address.trim()) {
        errors.address = "Head Office / Dispatch Address is required.";
      }
      if (!formData.city.trim()) {
        errors.city = "City is required.";
      }
      if (!formData.state.trim()) {
        errors.state = "State / Province is required.";
      }
    } else if (step === 3) {
      if (selectedCategories.length === 0) {
        errors.categories = "Please select at least one service category.";
      }
    } else if (step === 4) {
      // Verification documents: optional or checked upon final submission
    } else if (step === 5) {
      if (!resubmittingApplicationId) {
        if (!formData.password || formData.password.length < 8) {
          errors.password = "Portal password must be at least 8 characters.";
        }
        if (formData.password !== formData.confirmPassword) {
          errors.confirmPassword = "Passwords do not match.";
        }
      } else {
        if (formData.password && formData.password.length < 8) {
          errors.password = "New password must be at least 8 characters.";
        }
        if (formData.password && formData.password !== formData.confirmPassword) {
          errors.confirmPassword = "Passwords do not match.";
        }
      }
      if (!formData.agreeTerms) {
        errors.agreeTerms = "You must certify the business details and agree to Zelevos quality standards.";
      }
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step Navigation: Continue to next section
  const handleNextStep = () => {
    setSubmitError("");
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
      window.scrollTo({ top: 320, behavior: "smooth" });
    }
  };

  // Step Navigation: Back to previous section
  const handlePrevStep = () => {
    setSubmitError("");
    setStepErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 320, behavior: "smooth" });
  };

  // Jump to specific step (clicking on step indicator)
  const handleJumpToStep = (stepTarget: number) => {
    if (stepTarget === currentStep) return;
    if (stepTarget < currentStep) {
      setStepErrors({});
      setCurrentStep(stepTarget);
      window.scrollTo({ top: 320, behavior: "smooth" });
    } else {
      // If jumping forward, validate current step first
      if (validateStep(currentStep)) {
        setCurrentStep(stepTarget);
        window.scrollTo({ top: 320, behavior: "smooth" });
      }
    }
  };

  // Real Document Upload to Server
  const handleUploadDocument = async () => {
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setUploadError("File size exceeds 10MB limit. Please upload a smaller file.");
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError("Please provide a title for this document.");
      return;
    }

    setUploadError("");
    setIsUploading(true);

    try {
      const data = new FormData();
      data.append("document", selectedFile);
      data.append("documentType", uploadDocType);
      data.append("title", uploadTitle.trim());

      const res = await fetch("/api/suppliers/upload-document", {
        method: "POST",
        body: data,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to upload document.");
      }

      setUploadedDocuments((prev) => [
        ...prev,
        {
          title: uploadTitle.trim(),
          documentType: uploadDocType,
          fileUrl: json.fileUrl,
          fileName: json.fileName,
          fileSize: json.fileSize,
          mimeType: json.mimeType,
          uploadedAt: new Date().toISOString(),
          status: "pending",
        },
      ]);

      // Reset upload fields
      setSelectedFile(null);
      setUploadTitle("");
      const fileInput = document.getElementById("supplier-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err: any) {
      setUploadError(err.message || "Document upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeUploadedDoc = (index: number) => {
    setUploadedDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  // Real Application Submission (New or Resubmit)
  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!validateStep(5)) {
      return;
    }

    setSubmitting(true);

    try {
      if (resubmittingApplicationId) {
        // Resubmission flow
        const payload = {
          password: statusPassword || formData.password,
          resubmissionNotes: resubmitNotes.trim() || "Applicant updated required onboarding sections and documents.",
          businessName: formData.businessName.trim(),
          businessType: formData.businessType,
          contactName: formData.contactName.trim(),
          phone: formData.phone.trim(),
          hasWebsite: hasWebsite,
          website: hasWebsite ? formData.website.trim() : "",
          address: formData.address.trim() || undefined,
          city: formData.city.trim() || undefined,
          state: formData.state.trim() || undefined,
          country: formData.country.trim() || "India",
          registrationNumber: formData.registrationNumber.trim() || undefined,
          taxId: formData.taxId.trim() || undefined,
          description: formData.description.trim() || undefined,
          serviceCategories: selectedCategories,
          operatingLocations: formData.operatingLocations
            ? formData.operatingLocations.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
          documents: uploadedDocuments.map((doc) => ({
            title: doc.title,
            documentType: doc.documentType,
            fileUrl: doc.fileUrl,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
          })),
        };

        const res = await fetch(`/api/suppliers/application/${resubmittingApplicationId}/resubmit`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to resubmit application.");
        }

        // Clean up draft & mode
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setResubmittingApplicationId(null);
        setChangeRequestInfo(null);
        setRegisteredVendor(data.application || data.vendor);
      } else {
        // Initial Registration flow
        const payload = {
          businessName: formData.businessName.trim(),
          businessType: formData.businessType,
          contactName: formData.contactName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          hasWebsite: hasWebsite,
          website: hasWebsite ? formData.website.trim() : undefined,
          address: formData.address.trim() || undefined,
          city: formData.city.trim() || undefined,
          state: formData.state.trim() || undefined,
          country: formData.country.trim() || "India",
          registrationNumber: formData.registrationNumber.trim() || undefined,
          taxId: formData.taxId.trim() || undefined,
          description: formData.description.trim() || undefined,
          serviceCategories: selectedCategories,
          operatingLocations: formData.operatingLocations
            ? formData.operatingLocations.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
          password: formData.password,
          documents: uploadedDocuments.map((doc) => ({
            title: doc.title,
            documentType: doc.documentType,
            fileUrl: doc.fileUrl,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
          })),
        };

        const res = await fetch("/api/suppliers/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || (data.errors ? data.errors[0]?.message : "Registration failed."));
        }

        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setRegisteredVendor(data.vendor);
      }
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit supplier application. Please check details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Check Application Status
  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !statusPassword) return;

    setStatusLoading(true);
    setStatusError("");
    setApplicationResult(null);
    setResubmitSuccess("");

    try {
      const res = await fetch("/api/suppliers/application-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: searchQuery.trim(), password: statusPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "No application found for the provided details. Please verify your credentials.");
      }

      setApplicationResult(data.application);
    } catch (err: any) {
      setStatusError(err.message || "Failed to retrieve application status.");
    } finally {
      setStatusLoading(false);
    }
  };

  // Resume application from Status Screen when CHANGES_REQUESTED
  const handleStartResubmit = () => {
    if (!applicationResult) return;

    setResubmittingApplicationId(applicationResult.id);
    setChangeRequestInfo({
      message: applicationResult.changeRequestMessage || applicationResult.disciplinaryNotes || "Additional verification documents or information requested.",
      areas: applicationResult.changeRequestAreas || [],
    });

    setFormData((prev) => ({
      ...prev,
      businessName: applicationResult.businessName || "",
      businessType: applicationResult.businessType || "Private Limited",
      contactName: applicationResult.contactName || "",
      email: applicationResult.email || "",
      phone: applicationResult.phone || "",
      website: applicationResult.website || "",
      address: applicationResult.address || "",
      city: applicationResult.city || "",
      state: applicationResult.state || "",
      country: applicationResult.country || "India",
      registrationNumber: applicationResult.registrationNumber || "",
      taxId: applicationResult.taxId || "",
      description: applicationResult.description || "",
      password: "",
      confirmPassword: "",
      agreeTerms: true,
    }));

    setHasWebsite(applicationResult.hasWebsite || Boolean(applicationResult.website));

    if (Array.isArray(applicationResult.serviceCategories) && applicationResult.serviceCategories.length > 0) {
      setSelectedCategories(applicationResult.serviceCategories);
    }

    if (Array.isArray(applicationResult.documents)) {
      setUploadedDocuments(
        applicationResult.documents.map((d: any) => ({
          id: d.id,
          title: d.title || d.fileName,
          documentType: d.documentType,
          fileUrl: d.fileUrl,
          fileName: d.fileName,
          fileSize: d.fileSize,
          mimeType: d.mimeType,
          status: d.status,
          uploadedAt: d.uploadedAt,
        }))
      );
    }

    setCurrentStep(1);
    setActiveTab("register");
    window.scrollTo({ top: 200, behavior: "smooth" });
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", paddingBottom: "80px", color: "#0f172a" }}>
      {/* Top Banner Navigation */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => setLocation("/")}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)",
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                fontSize: "18px",
              }}
            >
              Z
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "-0.02em", color: "#0f172a" }}>Zelevos</span>
              <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "#6366f1", letterSpacing: "0.08em" }}>Supplier & Partner Onboarding</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              id="btn-switch-check-status"
              onClick={() => {
                setActiveTab(activeTab === "register" ? "status" : "register");
                setSubmitError("");
              }}
              style={{
                background: "transparent",
                border: "1px solid #cbd5e1",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {activeTab === "register" ? (
                <>
                  <Search size={15} /> Check Application Status
                </>
              ) : (
                <>
                  <Plus size={15} /> New Application Form
                </>
              )}
            </button>

            <button
              type="button"
              id="btn-nav-vendor-login"
              onClick={() => setLocation("/vendor-portal")}
              style={{
                background: "#0f172a",
                border: "none",
                padding: "8px 18px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>Vendor Portal Login</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main style={{ maxWidth: "1000px", margin: "40px auto 0", padding: "0 20px" }}>
        {/* Tab 1: Registration Multi-Step Wizard */}
        {activeTab === "register" && !registeredVendor && (
          <div>
            {/* Hero Header */}
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#e0e7ff",
                  color: "#4338ca",
                  padding: "6px 14px",
                  borderRadius: "9999px",
                  fontSize: "12px",
                  fontWeight: 700,
                  marginBottom: "14px",
                }}
              >
                <Sparkles size={14} />
                <span>
                  {resubmittingApplicationId ? "SUPPLIER APPLICATION UPDATE & RESUBMISSION" : "OFFICIAL SUPPLIER ONBOARDING"}
                </span>
              </div>
              <h1 style={{ fontSize: "32px", fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.03em" }}>
                {resubmittingApplicationId ? "Update Your Supplier Application" : "Partner With Zelevos. Grow Your Travel Business."}
              </h1>
              <p style={{ fontSize: "15px", color: "#64748b", maxWidth: "680px", margin: "0 auto", lineHeight: 1.6 }}>
                Direct fulfillment for verified hotels, cabs, activities, guides, and tour operators across India.
                Guaranteed direct bookings, automated operations assignments, and timely payments.
              </p>
            </div>

            {/* Changes Requested Banner (if updating existing application) */}
            {resubmittingApplicationId && changeRequestInfo && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "14px",
                  padding: "18px 22px",
                  marginBottom: "24px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <AlertCircle size={20} color="#b45309" />
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#92400e" }}>
                    Compliance Feedback & Requested Updates
                  </h3>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#78350f", lineHeight: 1.5 }}>
                  {changeRequestInfo.message}
                </p>
                {changeRequestInfo.areas && changeRequestInfo.areas.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#92400e" }}>Sections Requiring Action:</span>
                    {changeRequestInfo.areas.map((area, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: "#fef3c7",
                          color: "#b45309",
                          border: "1px solid #fcd34d",
                          padding: "2px 10px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                        }}
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Saved Draft Resumption Banner */}
            {hasSavedDraft && !draftBannerDismissed && !resubmittingApplicationId && (
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "14px",
                  padding: "16px 20px",
                  marginBottom: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Clock size={18} color="#2563eb" />
                  <div>
                    <strong style={{ fontSize: "13px", color: "#1e40af", display: "block" }}>
                      Resume In-Progress Supplier Application
                    </strong>
                    <span style={{ fontSize: "12px", color: "#3b82f6" }}>
                      We found previously entered business information saved on this device.
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={handleRestoreDraft}
                    style={{
                      background: "#2563eb",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Resume Application
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    style={{
                      background: "transparent",
                      color: "#64748b",
                      border: "1px solid #cbd5e1",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Start Fresh
                  </button>
                </div>
              </div>
            )}

            {/* 5-Step Progress Stepper Navigation */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                padding: "20px 24px",
                marginBottom: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: "12px",
                }}
              >
                {[
                  { step: 1, title: "Business Info", desc: "Identity & Website" },
                  { step: 2, title: "Location & Tax", desc: "Dispatch & GSTIN" },
                  { step: 3, title: "Services", desc: "Categories Offered" },
                  { step: 4, title: "Documents", desc: "Verification Proofs" },
                  { step: 5, title: "Password & Terms", desc: "Portal Access" },
                ].map((s) => {
                  const isActive = currentStep === s.step;
                  const isCompleted = currentStep > s.step;
                  return (
                    <div
                      key={s.step}
                      id={`stepper-step-${s.step}`}
                      onClick={() => handleJumpToStep(s.step)}
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        background: isActive ? "#f5f3ff" : "transparent",
                        borderBottom: isActive ? "3px solid #6366f1" : isCompleted ? "3px solid #10b981" : "3px solid transparent",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          background: isCompleted ? "#10b981" : isActive ? "#6366f1" : "#e2e8f0",
                          color: isCompleted || isActive ? "#ffffff" : "#64748b",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 800,
                          fontSize: "12px",
                          flexShrink: 0,
                        }}
                      >
                        {isCompleted ? <Check size={16} /> : s.step}
                      </div>
                      <div style={{ overflow: "hidden" }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: "13px",
                            fontWeight: isActive || isCompleted ? 800 : 600,
                            color: isActive ? "#4338ca" : isCompleted ? "#065f46" : "#475569",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                          }}
                        >
                          {s.title}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "10px",
                            color: "#94a3b8",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                          }}
                        >
                          {s.desc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Application Step Content Card */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "20px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
                overflow: "hidden",
              }}
            >
              <form onSubmit={handleSubmitApplication} style={{ display: "grid", gap: "28px", padding: "36px" }}>
                {submitError && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "10px",
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: "#b91c1c",
                      fontSize: "14px",
                    }}
                  >
                    <AlertCircle size={18} />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* =========================================================================
                    STEP 1 — BUSINESS INFORMATION
                    ========================================================================= */}
                {currentStep === 1 && (
                  <div style={{ display: "grid", gap: "24px" }}>
                    <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <Building2 size={20} color="#4f46e5" />
                        <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                          Step 1: Business Information
                        </h2>
                      </div>
                      <span style={{ fontSize: "13px", color: "#64748b" }}>
                        Provide your registered business details, company leadership contact, and official web presence.
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          Company / Business Legal Name *
                        </label>
                        <input
                          id="supplier-input-business-name"
                          type="text"
                          required
                          placeholder="e.g. Royal Himalaya Adventures Pvt Ltd"
                          value={formData.businessName}
                          onChange={(e) => {
                            setFormData({ ...formData, businessName: e.target.value });
                            setStepErrors((prev) => ({ ...prev, businessName: "" }));
                          }}
                          style={{
                            width: "100%",
                            height: "44px",
                            padding: "0 14px",
                            borderRadius: "8px",
                            border: stepErrors.businessName ? "1px solid #ef4444" : "1px solid #cbd5e1",
                            fontSize: "14px",
                          }}
                        />
                        {stepErrors.businessName && (
                          <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, marginTop: "4px", display: "block" }}>
                            {stepErrors.businessName}
                          </span>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          Business Entity Type *
                        </label>
                        <select
                          id="supplier-select-business-type"
                          value={formData.businessType}
                          onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                          style={{ width: "100%", height: "44px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#ffffff" }}
                        >
                          {businessTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          Owner / Primary Contact Person *
                        </label>
                        <input
                          id="supplier-input-contact-name"
                          type="text"
                          required
                          placeholder="e.g. Vikramaditya Singh"
                          value={formData.contactName}
                          onChange={(e) => {
                            setFormData({ ...formData, contactName: e.target.value });
                            setStepErrors((prev) => ({ ...prev, contactName: "" }));
                          }}
                          style={{
                            width: "100%",
                            height: "44px",
                            padding: "0 14px",
                            borderRadius: "8px",
                            border: stepErrors.contactName ? "1px solid #ef4444" : "1px solid #cbd5e1",
                            fontSize: "14px",
                          }}
                        />
                        {stepErrors.contactName && (
                          <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, marginTop: "4px", display: "block" }}>
                            {stepErrors.contactName}
                          </span>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          Business Email (Will be your Login ID) *
                        </label>
                        <input
                          id="supplier-input-email"
                          type="email"
                          required
                          placeholder="supplier@company.com"
                          value={formData.email}
                          onChange={(e) => {
                            setFormData({ ...formData, email: e.target.value });
                            setStepErrors((prev) => ({ ...prev, email: "" }));
                          }}
                          style={{
                            width: "100%",
                            height: "44px",
                            padding: "0 14px",
                            borderRadius: "8px",
                            border: stepErrors.email ? "1px solid #ef4444" : "1px solid #cbd5e1",
                            fontSize: "14px",
                          }}
                        />
                        {stepErrors.email && (
                          <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, marginTop: "4px", display: "block" }}>
                            {stepErrors.email}
                          </span>
                        )}
                      </div>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          Phone / WhatsApp (With Country Code) *
                        </label>
                        <input
                          id="supplier-input-phone"
                          type="tel"
                          required
                          placeholder="+91 98765 43210"
                          value={formData.phone}
                          onChange={(e) => {
                            setFormData({ ...formData, phone: e.target.value });
                            setStepErrors((prev) => ({ ...prev, phone: "" }));
                          }}
                          style={{
                            width: "100%",
                            height: "44px",
                            padding: "0 14px",
                            borderRadius: "8px",
                            border: stepErrors.phone ? "1px solid #ef4444" : "1px solid #cbd5e1",
                            fontSize: "14px",
                          }}
                        />
                        {stepErrors.phone && (
                          <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, marginTop: "4px", display: "block" }}>
                            {stepErrors.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Official Website Conditional Question */}
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "14px",
                        padding: "20px",
                        display: "grid",
                        gap: "14px",
                      }}
                    >
                      <div>
                        <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
                          Does your business have an official website?
                        </label>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          Having a website is completely optional and not required to partner with Zelevos.
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: "12px" }}>
                        <button
                          type="button"
                          id="btn-website-yes"
                          onClick={() => {
                            setHasWebsite(true);
                            setStepErrors((prev) => ({ ...prev, website: "" }));
                          }}
                          style={{
                            padding: "9px 24px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: "pointer",
                            border: hasWebsite ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                            background: hasWebsite ? "#eff6ff" : "#ffffff",
                            color: hasWebsite ? "#4338ca" : "#475569",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {hasWebsite && <Check size={14} />}
                          <span>Yes</span>
                        </button>

                        <button
                          type="button"
                          id="btn-website-no"
                          onClick={() => {
                            setHasWebsite(false);
                            setFormData((prev) => ({ ...prev, website: "" }));
                            setStepErrors((prev) => ({ ...prev, website: "" }));
                          }}
                          style={{
                            padding: "9px 24px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: "pointer",
                            border: !hasWebsite ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                            background: !hasWebsite ? "#eff6ff" : "#ffffff",
                            color: !hasWebsite ? "#4338ca" : "#475569",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {!hasWebsite && <Check size={14} />}
                          <span>No</span>
                        </button>
                      </div>

                      {/* Dynamic URL Field (Only visible when Yes is selected) */}
                      {hasWebsite && (
                        <div style={{ marginTop: "6px", animation: "fadeIn 0.2s ease" }}>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                            Official Website URL *
                          </label>
                          <div style={{ position: "relative" }}>
                            <div style={{ position: "absolute", left: "14px", top: "13px", color: "#94a3b8" }}>
                              <Globe size={16} />
                            </div>
                            <input
                              id="supplier-input-website-url"
                              type="url"
                              required={hasWebsite}
                              placeholder="https://example.com"
                              value={formData.website}
                              onChange={(e) => {
                                setFormData({ ...formData, website: e.target.value });
                                setStepErrors((prev) => ({ ...prev, website: "" }));
                              }}
                              style={{
                                width: "100%",
                                height: "42px",
                                padding: "0 14px 0 38px",
                                borderRadius: "8px",
                                border: stepErrors.website ? "1px solid #ef4444" : "1px solid #cbd5e1",
                                fontSize: "14px",
                              }}
                            />
                          </div>
                          {stepErrors.website && (
                            <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, marginTop: "4px", display: "block" }}>
                              {stepErrors.website}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* =========================================================================
                    STEP 2 — LOCATION & TAX DETAILS
                    ========================================================================= */}
                {currentStep === 2 && (
                  <div style={{ display: "grid", gap: "24px" }}>
                    <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <MapPin size={20} color="#4f46e5" />
                        <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                          Step 2: Location & Tax Details
                        </h2>
                      </div>
                      <span style={{ fontSize: "13px", color: "#64748b" }}>
                        Specify dispatch hubs, head office coordinates, and tax identification numbers for automated billing.
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px" }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          Head Office / Dispatch Address *
                        </label>
                        <input
                          id="supplier-input-address"
                          type="text"
                          required
                          placeholder="Plot 45, Commercial Complex, Sector 18"
                          value={formData.address}
                          onChange={(e) => {
                            setFormData({ ...formData, address: e.target.value });
                            setStepErrors((prev) => ({ ...prev, address: "" }));
                          }}
                          style={{
                            width: "100%",
                            height: "44px",
                            padding: "0 14px",
                            borderRadius: "8px",
                            border: stepErrors.address ? "1px solid #ef4444" : "1px solid #cbd5e1",
                            fontSize: "14px",
                          }}
                        />
                        {stepErrors.address && (
                          <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, marginTop: "4px", display: "block" }}>
                            {stepErrors.address}
                          </span>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          City *
                        </label>
                        <input
                          id="supplier-input-city"
                          type="text"
                          required
                          placeholder="e.g. Manali, Srinagar, Goa, Jaipur"
                          value={formData.city}
                          onChange={(e) => {
                            setFormData({ ...formData, city: e.target.value });
                            setStepErrors((prev) => ({ ...prev, city: "" }));
                          }}
                          style={{
                            width: "100%",
                            height: "44px",
                            padding: "0 14px",
                            borderRadius: "8px",
                            border: stepErrors.city ? "1px solid #ef4444" : "1px solid #cbd5e1",
                            fontSize: "14px",
                          }}
                        />
                        {stepErrors.city && (
                          <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, marginTop: "4px", display: "block" }}>
                            {stepErrors.city}
                          </span>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          State / Province *
                        </label>
                        <input
                          id="supplier-input-state"
                          type="text"
                          required
                          placeholder="e.g. Himachal Pradesh, Goa, Rajasthan"
                          value={formData.state}
                          onChange={(e) => {
                            setFormData({ ...formData, state: e.target.value });
                            setStepErrors((prev) => ({ ...prev, state: "" }));
                          }}
                          style={{
                            width: "100%",
                            height: "44px",
                            padding: "0 14px",
                            borderRadius: "8px",
                            border: stepErrors.state ? "1px solid #ef4444" : "1px solid #cbd5e1",
                            fontSize: "14px",
                          }}
                        />
                        {stepErrors.state && (
                          <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, marginTop: "4px", display: "block" }}>
                            {stepErrors.state}
                          </span>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          Country
                        </label>
                        <input
                          type="text"
                          disabled
                          value={formData.country}
                          style={{ width: "100%", height: "44px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#f1f5f9", color: "#64748b" }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          GSTIN / Tax ID Number
                        </label>
                        <input
                          id="supplier-input-taxid"
                          type="text"
                          placeholder="e.g. 02AAAAA0000A1Z5"
                          value={formData.taxId}
                          onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                          style={{ width: "100%", height: "44px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          Business Registration / CIN / License No.
                        </label>
                        <input
                          id="supplier-input-cin"
                          type="text"
                          placeholder="e.g. U63040HP2022PTC123456"
                          value={formData.registrationNumber}
                          onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                          style={{ width: "100%", height: "44px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* =========================================================================
                    STEP 3 — SERVICES
                    ========================================================================= */}
                {currentStep === 3 && (
                  <div style={{ display: "grid", gap: "24px" }}>
                    <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <Layers size={20} color="#4f46e5" />
                        <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                          Step 3: Services Offered
                        </h2>
                      </div>
                      <span style={{ fontSize: "13px", color: "#64748b" }}>
                        Select all services that your company can fulfill directly for Zelevos guests and bookings.
                      </span>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
                        Service Categories (Select all that apply) *
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px", marginBottom: "8px" }}>
                        {serviceCategories.map((cat) => {
                          const isSelected = selectedCategories.includes(cat.id);
                          return (
                            <div
                              key={cat.id}
                              id={`supplier-service-pill-${cat.id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                              onClick={() => toggleCategory(cat.id)}
                              style={{
                                padding: "14px 16px",
                                borderRadius: "12px",
                                border: isSelected ? "2px solid #4f46e5" : "1px solid #e2e8f0",
                                background: isSelected ? "#f5f3ff" : "#ffffff",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <span style={{ fontSize: "20px" }}>{cat.icon}</span>
                              <span style={{ fontSize: "13px", fontWeight: isSelected ? 700 : 500, color: isSelected ? "#4338ca" : "#334155" }}>
                                {cat.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {stepErrors.categories && (
                        <span style={{ color: "#dc2626", fontSize: "12px", fontWeight: 600 }}>{stepErrors.categories}</span>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          Operating Locations / Service Coverage
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Manali, Solang, Rohtang, Kasol (comma separated)"
                          value={formData.operatingLocations}
                          onChange={(e) => setFormData({ ...formData, operatingLocations: e.target.value })}
                          style={{ width: "100%", height: "44px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          Fleet / Capacity / Property Overview
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 24 Deluxe Rooms, 8 Innova Crysta cabs, 4 Guide Specialists"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          style={{ width: "100%", height: "44px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* =========================================================================
                    STEP 4 — VERIFICATION DOCUMENTS
                    ========================================================================= */}
                {currentStep === 4 && (
                  <div style={{ display: "grid", gap: "24px" }}>
                    <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <FileCheck size={20} color="#4f46e5" />
                        <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                          Step 4: Verification Documents
                        </h2>
                      </div>
                      <span style={{ fontSize: "13px", color: "#64748b" }}>
                        Attach real government/business proofs (GST, Incorporation, Permits, ID proofs). All files are encrypted and private.
                      </span>
                    </div>

                    {/* Upload Box */}
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "2px dashed #cbd5e1",
                        borderRadius: "14px",
                        padding: "22px",
                        display: "grid",
                        gap: "14px",
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                            Document Type *
                          </label>
                          <select
                            id="supplier-select-doc-type"
                            value={uploadDocType}
                            onChange={(e) => setUploadDocType(e.target.value)}
                            style={{ width: "100%", height: "40px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
                          >
                            {Object.entries(docTypeLabels).map(([k, label]) => (
                              <option key={k} value={k}>{label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                            Document Title *
                          </label>
                          <input
                            id="supplier-input-doc-title"
                            type="text"
                            placeholder="e.g. GST Registration Copy"
                            value={uploadTitle}
                            onChange={(e) => setUploadTitle(e.target.value)}
                            style={{ width: "100%", height: "40px", padding: "0 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                          />
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                            Select File (PDF, PNG, JPG, WEBP - Max 10MB) *
                          </label>
                          <input
                            id="supplier-file-input"
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp"
                            onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                            style={{ width: "100%", fontSize: "12px", marginTop: "4px" }}
                          />
                        </div>
                      </div>

                      {uploadError && (
                        <span style={{ color: "#dc2626", fontSize: "12px", fontWeight: 600 }}>{uploadError}</span>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          id="supplier-btn-attach-doc"
                          onClick={handleUploadDocument}
                          disabled={isUploading}
                          style={{
                            background: "#4f46e5",
                            color: "#ffffff",
                            border: "none",
                            padding: "9px 20px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: isUploading ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            opacity: isUploading ? 0.7 : 1,
                          }}
                        >
                          <Upload size={14} />
                          <span>{isUploading ? "Uploading..." : "Attach Document"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Attached Documents List */}
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", display: "block", marginBottom: "8px" }}>
                        Attached Documents ({uploadedDocuments.length})
                      </span>
                      {uploadedDocuments.length === 0 ? (
                        <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "10px", textAlign: "center", color: "#64748b", fontSize: "13px", border: "1px solid #e2e8f0" }}>
                          No documents attached yet. Attach your GST, business registration, or identity proof above.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: "8px" }}>
                          {uploadedDocuments.map((doc, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "#ffffff",
                                padding: "12px 16px",
                                borderRadius: "10px",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <FileText size={20} color="#4f46e5" />
                                <div>
                                  <strong style={{ fontSize: "13px", display: "block", color: "#0f172a" }}>{doc.title}</strong>
                                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                                    {docTypeLabels[doc.documentType] || doc.documentType} • {doc.fileName}
                                    {doc.fileSize ? ` (${Math.round(doc.fileSize / 1024)} KB)` : ""}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeUploadedDoc(idx)}
                                style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "6px" }}
                                title="Remove document"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* =========================================================================
                    STEP 5 — PORTAL PASSWORD & AGREEMENT
                    ========================================================================= */}
                {currentStep === 5 && (
                  <div style={{ display: "grid", gap: "24px" }}>
                    <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <Lock size={20} color="#4f46e5" />
                        <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                          Step 5: Portal Password & Agreement
                        </h2>
                      </div>
                      <span style={{ fontSize: "13px", color: "#64748b" }}>
                        Set your secure password to access the Vendor Portal and certify your compliance with Zelevos standards.
                      </span>
                    </div>

                    {!resubmittingApplicationId && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                            Portal Password (Min 8 Characters) *
                          </label>
                          <input
                            id="supplier-input-password"
                            type="password"
                            required
                            minLength={8}
                            placeholder="••••••••••••"
                            value={formData.password}
                            onChange={(e) => {
                              setFormData({ ...formData, password: e.target.value });
                              setStepErrors((prev) => ({ ...prev, password: "" }));
                            }}
                            style={{
                              width: "100%",
                              height: "44px",
                              padding: "0 14px",
                              borderRadius: "8px",
                              border: stepErrors.password ? "1px solid #ef4444" : "1px solid #cbd5e1",
                              fontSize: "14px",
                            }}
                          />
                          {stepErrors.password && (
                            <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, marginTop: "4px", display: "block" }}>
                              {stepErrors.password}
                            </span>
                          )}
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                            Confirm Password *
                          </label>
                          <input
                            id="supplier-input-confirm-password"
                            type="password"
                            required
                            minLength={8}
                            placeholder="••••••••••••"
                            value={formData.confirmPassword}
                            onChange={(e) => {
                              setFormData({ ...formData, confirmPassword: e.target.value });
                              setStepErrors((prev) => ({ ...prev, confirmPassword: "" }));
                            }}
                            style={{
                              width: "100%",
                              height: "44px",
                              padding: "0 14px",
                              borderRadius: "8px",
                              border: stepErrors.confirmPassword ? "1px solid #ef4444" : "1px solid #cbd5e1",
                              fontSize: "14px",
                            }}
                          />
                          {stepErrors.confirmPassword && (
                            <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, marginTop: "4px", display: "block" }}>
                              {stepErrors.confirmPassword}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Resubmission Notes if updating */}
                    {resubmittingApplicationId && (
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#92400e", marginBottom: "6px" }}>
                          Notes / Clarifications for Compliance Review *
                        </label>
                        <textarea
                          id="supplier-input-resubmit-notes"
                          rows={3}
                          required
                          placeholder="Summarize what information or documents you have updated to satisfy compliance..."
                          value={resubmitNotes}
                          onChange={(e) => setResubmitNotes(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "13px",
                            outline: "none",
                          }}
                        />
                      </div>
                    )}

                    <div style={{ background: "#f8fafc", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", fontSize: "13px", color: "#334155" }}>
                        <input
                          id="supplier-checkbox-agreement"
                          type="checkbox"
                          required
                          checked={formData.agreeTerms}
                          onChange={(e) => {
                            setFormData({ ...formData, agreeTerms: e.target.checked });
                            setStepErrors((prev) => ({ ...prev, agreeTerms: "" }));
                          }}
                          style={{ marginTop: "3px", width: "16px", height: "16px" }}
                        />
                        <span>
                          I certify that all provided business details and verification documents are genuine. I agree to comply with Zelevos Quality SLAs, guest safety protocols, and transparent fulfillment terms.
                        </span>
                      </label>
                      {stepErrors.agreeTerms && (
                        <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, marginTop: "6px", display: "block" }}>
                          {stepErrors.agreeTerms}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Wizard Bottom Controls */}
                <div
                  style={{
                    borderTop: "1px solid #e2e8f0",
                    paddingTop: "20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  {currentStep > 1 ? (
                    <button
                      type="button"
                      id="supplier-btn-prev-step"
                      onClick={handlePrevStep}
                      style={{
                        background: "#ffffff",
                        color: "#475569",
                        border: "1px solid #cbd5e1",
                        padding: "12px 24px",
                        borderRadius: "10px",
                        fontSize: "14px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {currentStep < 5 ? (
                    <button
                      type="button"
                      id="supplier-btn-continue"
                      onClick={handleNextStep}
                      style={{
                        background: "#4f46e5",
                        color: "#ffffff",
                        border: "none",
                        padding: "12px 28px",
                        borderRadius: "10px",
                        fontSize: "14px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
                      }}
                    >
                      <span>Continue</span>
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      id="supplier-btn-submit-app"
                      disabled={submitting}
                      style={{
                        background: "#0f172a",
                        color: "#ffffff",
                        border: "none",
                        padding: "13px 32px",
                        borderRadius: "10px",
                        fontSize: "14px",
                        fontWeight: 800,
                        cursor: submitting ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        opacity: submitting ? 0.7 : 1,
                        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.2)",
                      }}
                    >
                      <span>
                        {submitting
                          ? "Submitting Application..."
                          : resubmittingApplicationId
                          ? "Resubmit Application for Review"
                          : "Submit Supplier Application"}
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Success Screen after Registration */}
        {activeTab === "register" && registeredVendor && (
          <div
            id="supplier-registration-success-card"
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "48px 36px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
              textAlign: "center",
              maxWidth: "680px",
              margin: "0 auto",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#ecfdf5",
                color: "#059669",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 20px",
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: "26px", fontWeight: 800, margin: "0 0 10px" }}>
              Application Submitted Successfully!
            </h2>
            <p style={{ fontSize: "15px", color: "#64748b", margin: "0 0 24px", lineHeight: 1.6 }}>
              Thank you for applying to partner with Zelevos. Your supplier record has been created in our production database and queued for compliance verification.
            </p>

            <div
              style={{
                background: "#f8fafc",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid #e2e8f0",
                textAlign: "left",
                marginBottom: "28px",
                display: "grid",
                gap: "10px",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Application / Vendor ID:</span>
                <strong style={{ fontFamily: "monospace", fontSize: "14px", color: "#0f172a" }}>{registeredVendor.vendorId}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Company:</span>
                <strong style={{ color: "#0f172a" }}>{registeredVendor.businessName}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Login Email:</span>
                <strong style={{ color: "#0f172a" }}>{registeredVendor.email}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Initial Status:</span>
                <span
                  style={{
                    background: "#fffbeb",
                    color: "#b45309",
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  {registeredVendor.status || "PENDING_APPROVAL"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "14px" }}>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery(registeredVendor.email);
                  setActiveTab("status");
                  setRegisteredVendor(null);
                }}
                style={{
                  background: "#4f46e5",
                  color: "#ffffff",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Track Live Application Status
              </button>
              <button
                type="button"
                onClick={() => setLocation("/")}
                style={{
                  background: "transparent",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
                  padding: "12px 20px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Return to Homepage
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Check Application Status */}
        {activeTab === "status" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <h1 style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 10px" }}>
                Check Supplier Application Status
              </h1>
              <p style={{ fontSize: "15px", color: "#64748b" }}>
                Enter your registered business email or Application ID together with the password you chose when applying.
              </p>
            </div>

            {/* Search Input Box */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                maxWidth: "600px",
                margin: "0 auto 32px",
              }}
            >
              <form onSubmit={handleCheckStatus} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <input
                  id="status-search-identifier"
                  type="text"
                  required
                  placeholder="Enter business email or Application ID"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: "1 1 240px",
                    height: "44px",
                    padding: "0 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                  }}
                />
                <input
                  id="status-search-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Your application password"
                  value={statusPassword}
                  onChange={(e) => setStatusPassword(e.target.value)}
                  style={{
                    flex: "1 1 200px",
                    height: "44px",
                    padding: "0 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                  }}
                />
                <button
                  type="submit"
                  id="status-search-submit"
                  disabled={statusLoading}
                  style={{
                    background: "#0f172a",
                    color: "#ffffff",
                    border: "none",
                    padding: "0 22px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: statusLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Search size={15} />
                  <span>{statusLoading ? "Checking..." : "Search"}</span>
                </button>
              </form>

              {statusError && (
                <div style={{ marginTop: "12px", color: "#dc2626", fontSize: "13px", fontWeight: 600 }}>
                  {statusError}
                </div>
              )}
            </div>

            {/* Application Result Details */}
            {applicationResult && (
              <div
                id="supplier-status-dossier-card"
                style={{
                  background: "#ffffff",
                  borderRadius: "20px",
                  padding: "32px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
                  maxWidth: "800px",
                  margin: "0 auto",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#6366f1", letterSpacing: "0.05em" }}>
                      APPLICATION DOSSIER
                    </span>
                    <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "2px 0 0" }}>
                      {applicationResult.businessName}
                    </h2>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {(() => {
                      const st = (applicationResult.status || applicationResult.approvalStatus || "PENDING").toUpperCase();
                      if (st === "APPROVED") {
                        return (
                          <span style={{ background: "#ecfdf5", color: "#059669", padding: "6px 14px", borderRadius: "9999px", fontSize: "12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <CheckCircle2 size={15} /> Approved & Active
                          </span>
                        );
                      }
                      if (st === "CHANGES_REQUESTED") {
                        return (
                          <span style={{ background: "#fef3c7", color: "#b45309", padding: "6px 14px", borderRadius: "9999px", fontSize: "12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <AlertCircle size={15} /> Changes Requested
                          </span>
                        );
                      }
                      if (st === "UNDER_REVIEW") {
                        return (
                          <span style={{ background: "#eff6ff", color: "#2563eb", padding: "6px 14px", borderRadius: "9999px", fontSize: "12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <RefreshCw size={15} /> Under Review
                          </span>
                        );
                      }
                      if (st === "REJECTED") {
                        return (
                          <span style={{ background: "#fef2f2", color: "#dc2626", padding: "6px 14px", borderRadius: "9999px", fontSize: "12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <X size={15} /> Rejected
                          </span>
                        );
                      }
                      return (
                        <span style={{ background: "#fffbeb", color: "#d97706", padding: "6px 14px", borderRadius: "9999px", fontSize: "12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <Clock size={15} /> Pending Verification
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Visual Onboarding Lifecycle Timeline */}
                <div
                  style={{
                    background: "#f8fafc",
                    padding: "16px 20px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    marginBottom: "24px",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "12px" }}>
                    Onboarding Lifecycle Progress
                  </span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                    {[
                      { key: "submitted", label: "Application Submitted", active: true },
                      {
                        key: "review",
                        label: "Under Review",
                        active: ["UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED"].includes(
                          (applicationResult.status || "").toUpperCase()
                        ),
                      },
                      {
                        key: "compliance",
                        label:
                          (applicationResult.status || "").toUpperCase() === "CHANGES_REQUESTED"
                            ? "Changes Requested"
                            : "Compliance Check",
                        active: ["CHANGES_REQUESTED", "APPROVED"].includes((applicationResult.status || "").toUpperCase()),
                        alert: (applicationResult.status || "").toUpperCase() === "CHANGES_REQUESTED",
                      },
                      {
                        key: "approved",
                        label: "Approved & Active",
                        active: (applicationResult.status || "").toUpperCase() === "APPROVED",
                      },
                    ].map((step, idx) => (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", flex: 1, position: "relative", zIndex: 2 }}>
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            background: step.alert ? "#f59e0b" : step.active ? "#10b981" : "#cbd5e1",
                            color: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            fontSize: "12px",
                            fontWeight: 700,
                            marginBottom: "6px",
                          }}
                        >
                          {step.alert ? "!" : step.active ? "✓" : idx + 1}
                        </div>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: step.active ? 700 : 500,
                            color: step.alert ? "#b45309" : step.active ? "#065f46" : "#64748b",
                          }}
                        >
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Details Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "16px",
                    background: "#f8fafc",
                    padding: "18px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "13px",
                    marginBottom: "24px",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>SUPPLIER NUMBER</span>
                    <strong>{applicationResult.vendorId}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>PRIMARY CONTACT</span>
                    <strong>{applicationResult.contactName}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>BUSINESS EMAIL</span>
                    <strong>{applicationResult.email}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>OFFICIAL WEBSITE</span>
                    <strong>
                      {applicationResult.hasWebsite || applicationResult.website ? (
                        <a
                          href={applicationResult.website}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#2563eb", textDecoration: "underline" }}
                        >
                          {applicationResult.website || "Yes (Recorded)"}
                        </a>
                      ) : (
                        "No Official Website"
                      )}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>HEADQUARTERS</span>
                    <strong>{applicationResult.city ? `${applicationResult.city}, ${applicationResult.state || ""}` : "Not specified"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>TAX ID / GSTIN</span>
                    <strong>{applicationResult.taxId || "Not provided"}</strong>
                  </div>
                </div>

                {/* Approved Action Banner */}
                {applicationResult.status === "APPROVED" && (
                  <div
                    style={{
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      borderRadius: "12px",
                      padding: "20px",
                      textAlign: "center",
                      marginBottom: "20px",
                    }}
                  >
                    <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#065f46" }}>
                      Congratulations! Your Supplier Account is Active.
                    </h3>
                    <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#047857" }}>
                      You can now log into the Vendor Portal with your email and password to manage services, view assigned bookings, and submit fulfillment vouchers.
                    </p>
                    <button
                      type="button"
                      onClick={() => setLocation("/vendor-portal")}
                      style={{
                        background: "#059669",
                        color: "#ffffff",
                        border: "none",
                        padding: "10px 24px",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Open Vendor Portal
                    </button>
                  </div>
                )}

                {/* Changes Requested Banner & Button to Resume Application */}
                {applicationResult.status === "CHANGES_REQUESTED" && (
                  <div
                    style={{
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: "12px",
                      padding: "20px",
                      marginBottom: "20px",
                    }}
                  >
                    <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#92400e", display: "flex", alignItems: "center", gap: "8px" }}>
                      <AlertCircle size={18} />
                      <span>Changes Requested by Compliance Reviewer</span>
                    </h3>
                    <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#78350f" }}>
                      {applicationResult.changeRequestMessage || applicationResult.disciplinaryNotes || "Please update your verification documents or company details as specified."}
                    </p>

                    {applicationResult.changeRequestAreas && applicationResult.changeRequestAreas.length > 0 && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#92400e" }}>Areas to Update:</span>
                        {applicationResult.changeRequestAreas.map((area: string, i: number) => (
                          <span
                            key={i}
                            style={{
                              background: "#ffffff",
                              border: "1px solid #fcd34d",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#92400e",
                            }}
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      id="btn-resume-and-edit-application"
                      onClick={handleStartResubmit}
                      style={{
                        background: "#b45309",
                        color: "#ffffff",
                        border: "none",
                        padding: "10px 22px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>Resume & Edit Application to Resubmit</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* Submitted Documents Checklist / Table */}
                {applicationResult.documents && applicationResult.documents.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 10px" }}>Verification Documents</h4>
                    <div style={{ display: "grid", gap: "8px" }}>
                      {applicationResult.documents.map((doc: any) => (
                        <div
                          key={doc.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: "#f8fafc",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            fontSize: "13px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <FileText size={16} color="#6366f1" />
                            <span>{doc.title || doc.fileName}</span>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              ({docTypeLabels[doc.documentType] || doc.documentType})
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              background: doc.status === "verified" ? "#ecfdf5" : doc.status === "rejected" ? "#fef2f2" : "#fffbeb",
                              color: doc.status === "verified" ? "#059669" : doc.status === "rejected" ? "#dc2626" : "#d97706",
                            }}
                          >
                            {doc.status || "pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
