import React, { useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  FileUp,
  ShieldCheck,
  ArrowRight,
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
} from "lucide-react";
import { useLocation } from "wouter";

interface UploadedDoc {
  title: string;
  documentType: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
}

export function BecomeSupplierPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"register" | "status">("register");

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

  // Status Check State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [applicationResult, setApplicationResult] = useState<any | null>(null);
  const [statusError, setStatusError] = useState("");

  // Resubmission State (if changes requested)
  const [resubmitNotes, setResubmitNotes] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitSuccess, setResubmitSuccess] = useState("");

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

  const toggleCategory = (catId: string) => {
    if (selectedCategories.includes(catId)) {
      if (selectedCategories.length === 1) return; // Keep at least one
      setSelectedCategories(selectedCategories.filter((c) => c !== catId));
    } else {
      setSelectedCategories([...selectedCategories, catId]);
    }
  };

  // Real Document Upload to Server
  const handleUploadDocument = async () => {
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
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

  // Real Application Submission
  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!formData.businessName.trim()) {
      setSubmitError("Company or Business Name is required.");
      return;
    }
    if (!formData.contactName.trim()) {
      setSubmitError("Contact Person Name is required.");
      return;
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      setSubmitError("A valid business email address is required.");
      return;
    }
    if (!formData.phone.trim()) {
      setSubmitError("Phone number is required.");
      return;
    }
    if (selectedCategories.length === 0) {
      setSubmitError("Please select at least one service category.");
      return;
    }
    if (formData.password && formData.password.length < 8) {
      setSubmitError("Password must be at least 8 characters.");
      return;
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }
    if (!formData.agreeTerms) {
      setSubmitError("Please confirm your agreement to Zelevos Partner Quality Standards.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        businessName: formData.businessName.trim(),
        businessType: formData.businessType,
        contactName: formData.contactName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        website: formData.website.trim() || undefined,
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
        temporaryPassword: formData.password || "SupplierPass123!",
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

      setRegisteredVendor(data.vendor);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit supplier application.");
    } finally {
      setSubmitting(false);
    }
  };

  // Check Application Status
  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setStatusLoading(true);
    setStatusError("");
    setApplicationResult(null);
    setResubmitSuccess("");

    try {
      const queryParam = searchQuery.includes("@")
        ? `email=${encodeURIComponent(searchQuery.trim().toLowerCase())}`
        : `vendorId=${encodeURIComponent(searchQuery.trim().toUpperCase())}`;

      const res = await fetch(`/api/suppliers/application-status?${queryParam}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "No application found for the provided details.");
      }

      setApplicationResult(data.application);
    } catch (err: any) {
      setStatusError(err.message || "Failed to retrieve application status.");
    } finally {
      setStatusLoading(false);
    }
  };

  // Resubmit Application if Changes Requested
  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationResult) return;

    setResubmitting(true);
    setResubmitSuccess("");

    try {
      const res = await fetch(`/api/suppliers/application/${applicationResult.id}/resubmit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resubmissionNotes: resubmitNotes.trim(),
          documents: uploadedDocuments.map((doc) => ({
            title: doc.title,
            documentType: doc.documentType,
            fileUrl: doc.fileUrl,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to resubmit application.");
      }

      setResubmitSuccess("Your application has been updated and resubmitted for admin review!");
      setApplicationResult(data.application);
      setUploadedDocuments([]);
      setResubmitNotes("");
    } catch (err: any) {
      alert(err.message || "Resubmission failed.");
    } finally {
      setResubmitting(false);
    }
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
            <img src="/brand/logo.png" alt="Zelevos" style={{ width: "32px", height: "32px", borderRadius: "8px" }} onError={(e) => { (e.currentTarget as any).style.display = "none"; }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "-0.02em", color: "#0f172a" }}>Zelevos</span>
              <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "#6366f1", letterSpacing: "0.08em" }}>Supplier & Partner Onboarding</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "register" ? "status" : "register")}
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
        {/* Tab 1: Registration Form */}
        {activeTab === "register" && !registeredVendor && (
          <div>
            {/* Hero Header */}
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
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
                <span>OFFICIAL SUPPLIER ONBOARDING</span>
              </div>
              <h1 style={{ fontSize: "34px", fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.03em" }}>
                Partner With Zelevos. Grow Your Travel Business.
              </h1>
              <p style={{ fontSize: "16px", color: "#64748b", maxWidth: "680px", margin: "0 auto", lineHeight: 1.6 }}>
                Direct fulfillment for verified hotels, cabs, activities, guides, and tour operators across India.
                Guaranteed direct bookings, automated operations assignments, and timely payments.
              </p>
            </div>

            {/* Application Form Card */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "20px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
                overflow: "hidden",
              }}
            >
              <form onSubmit={handleSubmitApplication} style={{ display: "grid", gap: "32px", padding: "36px" }}>
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

                {/* 1. Business Information */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#eff6ff", color: "#2563eb", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "13px" }}>
                      1
                    </div>
                    <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>Business Information</h2>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Company / Business Legal Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Royal Himalaya Adventures Pvt Ltd"
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Business Entity Type *
                      </label>
                      <select
                        value={formData.businessType}
                        onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#ffffff" }}
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
                        type="text"
                        required
                        placeholder="e.g. Vikramaditya Singh"
                        value={formData.contactName}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Business Email (Will be your Login ID) *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="supplier@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Phone / WhatsApp (With Country Code) *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Official Website (Optional)
                      </label>
                      <input
                        type="url"
                        placeholder="https://yourwebsite.com"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Location & Tax Information */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#eff6ff", color: "#2563eb", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "13px" }}>
                      2
                    </div>
                    <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>Location & Tax Details</h2>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Head Office / Dispatch Address *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Plot 45, Commercial Complex, Sector 18"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Manali, Srinagar, Goa, Jaipur"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        State / Province *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Himachal Pradesh, Goa, Rajasthan"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        GSTIN / Tax ID Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 02AAAAA0000A1Z5"
                        value={formData.taxId}
                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Business Registration / CIN / License No.
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. U63040HP2022PTC123456"
                        value={formData.registrationNumber}
                        onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Service Categories */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#eff6ff", color: "#2563eb", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "13px" }}>
                      3
                    </div>
                    <div>
                      <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>Service Categories *</h2>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>Select all services you can directly fulfill for Zelevos travellers.</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                    {serviceCategories.map((cat) => {
                      const isSelected = selectedCategories.includes(cat.id);
                      return (
                        <div
                          key={cat.id}
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

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Operating Locations / Destinations
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Manali, Solang, Rohtang, Kasol (comma separated)"
                        value={formData.operatingLocations}
                        onChange={(e) => setFormData({ ...formData, operatingLocations: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Brief Fleet / Property / Capacity Overview
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 24 premium rooms + 8 Innova Crysta cabs"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Real Verification Document Upload */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#eff6ff", color: "#2563eb", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "13px" }}>
                      4
                    </div>
                    <div>
                      <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>Verification Documents</h2>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>Upload real business proof (GST, Incorporation, Permits). Documents are encrypted and private.</span>
                    </div>
                  </div>

                  {/* Upload Box */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "2px dashed #cbd5e1",
                      borderRadius: "14px",
                      padding: "20px",
                      display: "grid",
                      gap: "14px",
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                          Document Type
                        </label>
                        <select
                          value={uploadDocType}
                          onChange={(e) => setUploadDocType(e.target.value)}
                          style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#ffffff" }}
                        >
                          {Object.entries(docTypeLabels).map(([k, label]) => (
                            <option key={k} value={k}>{label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                          Document Title
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. GST Registration Copy"
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          style={{ width: "100%", height: "38px", padding: "0 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                          Select File (PDF, PNG, JPG - Max 10MB)
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
                        onClick={handleUploadDocument}
                        disabled={isUploading}
                        style={{
                          background: "#4f46e5",
                          color: "#ffffff",
                          border: "none",
                          padding: "8px 18px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: isUploading ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          opacity: isUploading ? 0.7 : 1,
                        }}
                      >
                        <Upload size={14} />
                        <span>{isUploading ? "Uploading Document..." : "Attach Document"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Uploaded Documents List */}
                  {uploadedDocuments.length > 0 && (
                    <div style={{ marginTop: "14px", display: "grid", gap: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>Attached Documents ({uploadedDocuments.length}):</span>
                      {uploadedDocuments.map((doc, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "#ffffff",
                            padding: "10px 14px",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <FileText size={18} color="#4f46e5" />
                            <div>
                              <strong style={{ fontSize: "13px", display: "block" }}>{doc.title}</strong>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>
                                {docTypeLabels[doc.documentType] || doc.documentType} • {doc.fileName}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeUploadedDoc(idx)}
                            style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                            title="Remove document"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Account Security (Password) */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#eff6ff", color: "#2563eb", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "13px" }}>
                      5
                    </div>
                    <div>
                      <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>Portal Password & Agreement</h2>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>Set your password for accessing the Vendor Portal once approved.</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Portal Password (Min 8 Characters) *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="••••••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="••••••••••••"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        style={{ width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      />
                    </div>
                  </div>

                  <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", fontSize: "13px", color: "#334155" }}>
                    <input
                      type="checkbox"
                      required
                      checked={formData.agreeTerms}
                      onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                      style={{ marginTop: "2px", width: "16px", height: "16px" }}
                    />
                    <span>
                      I certify that all provided business details and verification documents are genuine. I agree to comply with Zelevos Quality SLAs, guest safety protocols, and transparent fulfillment terms.
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "24px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      background: "#0f172a",
                      color: "#ffffff",
                      border: "none",
                      padding: "14px 36px",
                      borderRadius: "10px",
                      fontSize: "15px",
                      fontWeight: 700,
                      cursor: submitting ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      opacity: submitting ? 0.7 : 1,
                      boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
                    }}
                  >
                    <span>{submitting ? "Submitting Real Application..." : "Submit Supplier Application"}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Success Screen after Registration */}
        {activeTab === "register" && registeredVendor && (
          <div
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
                <span style={{ color: "#64748b" }}>Application ID:</span>
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
                  PENDING_APPROVAL
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
                Enter your registered business email or Application ID (e.g. VND-...) to inspect live verification status.
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
              <form onSubmit={handleCheckStatus} style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  required
                  placeholder="Enter business email or Application ID"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    height: "44px",
                    padding: "0 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                  }}
                />
                <button
                  type="submit"
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
                style={{
                  background: "#ffffff",
                  borderRadius: "20px",
                  padding: "32px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
                  maxWidth: "760px",
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
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>EMAIL</span>
                    <strong>{applicationResult.email}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 700 }}>LOCATION</span>
                    <strong>{applicationResult.city ? `${applicationResult.city}, ${applicationResult.state || ""}` : "Not specified"}</strong>
                  </div>
                </div>

                {/* Action Banners */}
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

                {/* Changes Requested Banner & Resubmission Form */}
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
                      <span>Changes Requested by Compliance Team</span>
                    </h3>
                    {applicationResult.disciplinaryNotes && (
                      <div
                        style={{
                          background: "#ffffff",
                          border: "1px solid #fcd34d",
                          padding: "12px 16px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          color: "#78350f",
                          margin: "12px 0 16px",
                          whiteSpace: "pre-line",
                        }}
                      >
                        {applicationResult.disciplinaryNotes}
                      </div>
                    )}

                    {/* Inline Resubmission Form */}
                    <form onSubmit={handleResubmit} style={{ display: "grid", gap: "14px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#92400e", marginBottom: "4px" }}>
                          Notes / Clarifications for Compliance Review
                        </label>
                        <textarea
                          rows={3}
                          required
                          placeholder="Explain what documents or information have been corrected..."
                          value={resubmitNotes}
                          onChange={(e) => setResubmitNotes(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "13px",
                          }}
                        />
                      </div>

                      {/* Attach New Document */}
                      <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "8px" }}>
                          Upload Additional Verification Documents:
                        </span>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                          <input
                            type="text"
                            placeholder="Document title"
                            value={uploadTitle}
                            onChange={(e) => setUploadTitle(e.target.value)}
                            style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                          />
                          <select
                            value={uploadDocType}
                            onChange={(e) => setUploadDocType(e.target.value)}
                            style={{ height: "36px", padding: "0 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", background: "#ffffff" }}
                          >
                            {Object.entries(docTypeLabels).map(([k, label]) => (
                              <option key={k} value={k}>{label}</option>
                            ))}
                          </select>
                          <input
                            id="resubmit-file-input"
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp"
                            onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                            style={{ fontSize: "11px", alignSelf: "center" }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleUploadDocument}
                          disabled={isUploading}
                          style={{
                            background: "#4f46e5",
                            color: "#ffffff",
                            border: "none",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {isUploading ? "Uploading..." : "Attach File"}
                        </button>
                      </div>

                      {uploadedDocuments.length > 0 && (
                        <div style={{ display: "grid", gap: "6px" }}>
                          {uploadedDocuments.map((d, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "#ffffff", padding: "6px 10px", borderRadius: "6px", fontSize: "12px" }}>
                              <span>✓ {d.title} ({d.fileName})</span>
                              <button type="button" onClick={() => removeUploadedDoc(i)} style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer" }}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {resubmitSuccess && (
                        <div style={{ color: "#166534", fontSize: "13px", fontWeight: 700 }}>
                          {resubmitSuccess}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={resubmitting}
                        style={{
                          background: "#b45309",
                          color: "#ffffff",
                          border: "none",
                          padding: "10px 24px",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: 700,
                          cursor: resubmitting ? "not-allowed" : "pointer",
                          justifySelf: "start",
                        }}
                      >
                        {resubmitting ? "Resubmitting..." : "Resubmit Application for Review"}
                      </button>
                    </form>
                  </div>
                )}

                {/* Documents list */}
                {applicationResult.documents && applicationResult.documents.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 10px" }}>Uploaded Documents</h4>
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
                          </div>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              textTransform: "uppercase",
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
