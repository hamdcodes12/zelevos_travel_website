import React, { useState, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { useSEO, STRUCTURED_DATA } from "@/hooks/useSEO";
import {
  LifeBuoy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Upload,
  X,
  FileText,
  ShieldCheck,
  Headphones,
  Clock,
  Send,
  MessageSquare,
  HelpCircle,
} from "lucide-react";

const REQUEST_TYPES = [
  "General Enquiry",
  "Technical Issue",
  "Service Question",
  "Project Question",
  "Billing Question",
  "BPO Partnership",
  "Other",
] as const;

export default function PublicTicketPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    companyName: "",
    phone: "",
    requestType: "General Enquiry",
    subject: "",
    message: "",
    honeypot: "",
  });

  const [attachment, setAttachment] = useState<{
    name: string;
    size: number;
    contentType: string;
    data: string;
  } | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useSEO({
    title: "Create a Support Request | Thinkatic Public Support",
    description: "Submit a support request to Thinkatic. Our team can review your request and follow up promptly.",
    path: "/public-ticket",
    structuredData: STRUCTURED_DATA.organization,
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, attachment: "File size exceeds 10 MB limit" }));
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
      "text/plain",
      "application/zip",
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        attachment: "Please attach a PDF, PNG, JPEG, TXT, or ZIP file",
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        size: file.size,
        contentType: file.type,
        data: reader.result as string,
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next.attachment;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      newErrors.fullName = "Please enter your full name (minimum 2 characters).";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid work or personal email address.";
    }

    if (!formData.requestType) {
      newErrors.requestType = "Please select a request type.";
    }

    if (!formData.subject.trim() || formData.subject.trim().length < 3) {
      newErrors.subject = "Subject must be at least 3 characters.";
    }

    if (!formData.message.trim() || formData.message.trim().length < 10) {
      newErrors.message = "Message must be at least 10 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/public-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          companyName: formData.companyName || undefined,
          phone: formData.phone || undefined,
          requestType: formData.requestType,
          subject: formData.subject,
          message: formData.message,
          attachment: attachment || undefined,
          honeypot: formData.honeypot || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit support request. Please try again.");
      }

      setSubmittedTicketId(data.ticketId);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50/60 pt-28 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb / Category Tag */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-[#214ECF] text-xs font-mono font-bold uppercase tracking-wider">
              <LifeBuoy size={13} />
              Public Support Portal
            </span>
          </div>

          <AnimatePresence mode="wait">
            {submittedTicketId ? (
              /* ============================================================= */
              /* SUCCESS STATE (Section 20)                                   */
              /* ============================================================= */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 shadow-xl text-center space-y-6"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 size={36} />
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
                    Request Submitted
                  </h1>
                  <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed">
                    Your request has been submitted successfully. Our operations and technical support team will review
                    your request and respond directly to your provided email address.
                  </p>
                </div>

                {/* Real Database Ticket Reference Badge */}
                <div className="inline-flex flex-col items-center gap-1 px-6 py-4 rounded-2xl bg-blue-50/80 border border-blue-100 shadow-xs">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] font-bold text-[#214ECF]">
                    Ticket ID
                  </span>
                  <span className="text-2xl sm:text-3xl font-mono font-black text-[#0F172A] tracking-wider">
                    {submittedTicketId}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    Please retain this ticket reference for your records.
                  </span>
                </div>

                <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedTicketId(null);
                      setFormData({
                        fullName: "",
                        email: "",
                        companyName: "",
                        phone: "",
                        requestType: "General Enquiry",
                        subject: "",
                        message: "",
                        honeypot: "",
                      });
                      setAttachment(null);
                    }}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Submit Another Request
                  </button>
                  <Link
                    href="/"
                    className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#214ECF] text-xs font-bold text-white shadow-md shadow-[#214ECF]/20 hover:bg-[#1A3DB3] transition-all inline-flex items-center justify-center gap-2"
                  >
                    <span>Back to Thinkatic</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </motion.div>
            ) : (
              /* ============================================================= */
              /* SUPPORT REQUEST FORM (Section 12)                            */
              /* ============================================================= */
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden"
              >
                {/* Header Banner */}
                <div className="bg-[#071426] text-white p-8 sm:p-10 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
                  <div className="relative z-10 space-y-2">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                      Create a Support Request
                    </h1>
                    <p className="text-sm text-[#AAB8CC] max-w-xl leading-relaxed">
                      Tell us what you need help with and our team can review your request.
                    </p>
                  </div>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} noValidate className="p-6 sm:p-10 space-y-6">
                  {errorMessage && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-3">
                      <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Submission Error</span>
                        <span>{errorMessage}</span>
                      </div>
                    </div>
                  )}

                  {/* Anti-spam Honeypot field (hidden) */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="hp_ticket_field">Do not fill this</label>
                    <input
                      id="hp_ticket_field"
                      name="honeypot"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={formData.honeypot}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* Full Name & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="fullName" className="block text-xs font-bold text-slate-800 mb-1.5">
                        Full Name <span className="text-[#214ECF]">*</span>
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={handleInputChange}
                        placeholder="Alex Morgan"
                        className={`w-full h-11 px-3.5 rounded-xl border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden transition-all ${
                          errors.fullName
                            ? "border-rose-400 focus:ring-2 focus:ring-rose-100"
                            : "border-slate-200 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10"
                        }`}
                      />
                      {errors.fullName && (
                        <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.fullName}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-xs font-bold text-slate-800 mb-1.5">
                        Email <span className="text-[#214ECF]">*</span>
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="alex@company.com"
                        className={`w-full h-11 px-3.5 rounded-xl border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden transition-all ${
                          errors.email
                            ? "border-rose-400 focus:ring-2 focus:ring-rose-100"
                            : "border-slate-200 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10"
                        }`}
                      />
                      {errors.email && (
                        <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Company Name & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="companyName" className="block text-xs font-bold text-slate-800 mb-1.5">
                        Company Name
                      </label>
                      <input
                        id="companyName"
                        name="companyName"
                        type="text"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        placeholder="Organization or Entity"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10 transition-all"
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-xs font-bold text-slate-800 mb-1.5">
                        Phone
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+1 (555) 000-0000"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* Request Type */}
                  <div>
                    <label htmlFor="requestType" className="block text-xs font-bold text-slate-800 mb-1.5">
                      Request Type <span className="text-[#214ECF]">*</span>
                    </label>
                    <select
                      id="requestType"
                      name="requestType"
                      required
                      value={formData.requestType}
                      onChange={handleInputChange}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-hidden focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10 transition-all cursor-pointer"
                    >
                      {REQUEST_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subject */}
                  <div>
                    <label htmlFor="subject" className="block text-xs font-bold text-slate-800 mb-1.5">
                      Subject <span className="text-[#214ECF]">*</span>
                    </label>
                    <input
                      id="subject"
                      name="subject"
                      type="text"
                      required
                      value={formData.subject}
                      onChange={handleInputChange}
                      placeholder="Brief summary of your question or issue"
                      className={`w-full h-11 px-3.5 rounded-xl border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden transition-all ${
                        errors.subject
                          ? "border-rose-400 focus:ring-2 focus:ring-rose-100"
                          : "border-slate-200 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10"
                      }`}
                    />
                    {errors.subject && (
                      <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.subject}</p>
                    )}
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="message" className="block text-xs font-bold text-slate-800 mb-1.5">
                      Message <span className="text-[#214ECF]">*</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Please describe your enquiry or issue with relevant details..."
                      className={`w-full p-3.5 rounded-xl border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden transition-all ${
                        errors.message
                          ? "border-rose-400 focus:ring-2 focus:ring-rose-100"
                          : "border-slate-200 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10"
                      }`}
                    />
                    {errors.message && (
                      <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.message}</p>
                    )}
                  </div>

                  {/* Optional Attachment */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Attachment <span className="text-slate-400 font-normal">(Optional, max 10 MB)</span>
                    </label>

                    {attachment ? (
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/70 border border-blue-100">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText size={18} className="text-[#214ECF] shrink-0" />
                          <div className="truncate">
                            <span className="text-xs font-semibold text-slate-900 block truncate">
                              {attachment.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {(attachment.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={removeAttachment}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white transition-colors"
                          title="Remove attachment"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-[#214ECF] hover:bg-blue-50/30 transition-all cursor-pointer group"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.txt,.zip"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 group-hover:text-[#214ECF]">
                          <Upload size={14} />
                          <span>Click to attach PDF, PNG, JPG, TXT, or ZIP</span>
                        </div>
                      </div>
                    )}
                    {errors.attachment && (
                      <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.attachment}</p>
                    )}
                  </div>

                  {/* Security / Privacy Assurance */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600">
                    <ShieldCheck size={16} className="text-[#214ECF] shrink-0 mt-0.5" />
                    <span>
                      Public requests are securely routed to our Operations Command Centre. Requests and private data are
                      protected in accordance with enterprise confidentiality standards.
                    </span>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-12 rounded-xl bg-[#214ECF] hover:bg-[#1A3DB3] text-white text-sm font-bold shadow-lg shadow-[#214ECF]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Submitting Request...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Request</span>
                          <Send size={15} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
