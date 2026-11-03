import React, { useState, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { useSEO, STRUCTURED_DATA } from "@/hooks/useSEO";
import {
  Briefcase,
  Handshake,
  Cpu,
  LayoutDashboard,
  CheckCircle2,
  ArrowRight,
  Mail,
  Globe,
  Building2,
  ShieldCheck,
  Check,
  AlertCircle,
  Loader2,
  HelpCircle,
  Sparkles,
  ExternalLink,
  Lock,
  Plus,
  Minus,
  MessageSquare,
  Zap,
  Layers,
  ArrowDown,
  ChevronRight,
  UserCheck,
  Clock,
  PhoneCall,
} from "lucide-react";

// ── Animation Variants ────────────────────────────────────────────────────────
const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease },
  },
};

// ── Form Types & Options ───────────────────────────────────────────────────────
const ENQUIRY_TYPES = [
  "Business Enquiry",
  "Technology Services",
  "AI Services",
  "Customer Experience",
  "BPO Services",
  "Partnership",
  "Existing Client",
  "General Enquiry",
] as const;

const SERVICE_AREAS = [
  "Website Development",
  "Custom Software",
  "E-commerce / Shopify",
  "Business Automation",
  "AI Chatbot",
  "AI Agent",
  "Voice AI",
  "AI Automation",
  "Customer Support",
  "BPO / Back Office",
  "Technical Support",
  "Data & Process Management",
  "Dedicated Developers",
  "Website Maintenance",
  "Other",
] as const;

const BUDGET_OPTIONS = [
  "Not Sure Yet",
  "Under $1,000",
  "$1,000 – $5,000",
  "$5,000 – $10,000",
  "$10,000 – $25,000",
  "$25,000+",
  "Prefer to Discuss",
] as const;

const TIMELINE_OPTIONS = [
  "As Soon As Possible",
  "Within 1 Month",
  "1–3 Months",
  "3–6 Months",
  "6+ Months",
  "Not Sure Yet",
] as const;

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "India",
  "Germany",
  "France",
  "Netherlands",
  "Singapore",
  "United Arab Emirates",
  "Ireland",
  "Switzerland",
  "Sweden",
  "Denmark",
  "Norway",
  "New Zealand",
  "Other International",
];

// ── Mini FAQ Data ─────────────────────────────────────────────────────────────
const MINI_FAQS = [
  {
    q: "What services does Thinkatic provide?",
    a: "Thinkatic provides services across technology, customer experience, and business process outsourcing, including custom software, web platforms, customer support teams, data operations, and AI integrations.",
  },
  {
    q: "Can Thinkatic build custom solutions?",
    a: "Yes. We work with clients to design bespoke software applications, specialized customer experience workflows, and tailored operational models based on your exact requirements.",
  },
  {
    q: "Does Thinkatic provide BPO services?",
    a: "Yes. Thinkatic connects international business requirements with structured delivery capabilities and verified India-based delivery centres for voice, chat, email, and back-office operations.",
  },
  {
    q: "Can BPO centres become partners?",
    a: "Yes. Qualified BPO centres can apply through our partner onboarding workflow, undergo verification, and complete the Partner Agreement to access structured delivery opportunities.",
  },
  {
    q: "Does Thinkatic provide AI services?",
    a: "Yes. Thinkatic offers AI chatbot and AI agent solutions, voice AI, and workflow automation. All critical partner, allocation, and business decisions remain under strict human governance.",
  },
  {
    q: "How do I start a project?",
    a: "Submit your requirement using our contact form or request a consultation. Our team will review your objectives and schedule an exploratory discussion to define scope, model, and next steps.",
  },
];

export default function ContactPage() {
  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    company: "",
    country: "",
    phone: "",
    website: "",
    enquiryType: "",
    serviceArea: "",
    budget: "",
    timeline: "",
    message: "",
    honeypot: "", // Anti-spam trap
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  useSEO({
    title: "Contact Thinkatic | Technology, BPO & Business Solutions",
    description:
      "Contact Thinkatic to discuss technology, AI, customer experience, BPO and business process solutions for your organization.",
    path: "/contact",
    structuredData: STRUCTURED_DATA.organization,
  });

  const scrollToForm = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const el = document.getElementById("contact-form");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      newErrors.fullName = "Please enter your full name (minimum 2 characters).";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid work email address.";
    }

    if (!formData.company.trim() || formData.company.trim().length < 2) {
      newErrors.company = "Please enter your company or organization name.";
    }

    if (!formData.country.trim()) {
      newErrors.country = "Please select your country.";
    }

    if (!formData.enquiryType.trim()) {
      newErrors.enquiryType = "Please select an enquiry type.";
    }

    if (!formData.serviceArea.trim()) {
      newErrors.serviceArea = "Please select a service or area of interest.";
    }

    if (!formData.message.trim() || formData.message.trim().length < 10) {
      newErrors.message = "Please tell us about your requirement (minimum 10 characters).";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check honeypot anti-spam
    if (formData.honeypot) {
      console.warn("Spam submission prevented via honeypot.");
      setStatus("success");
      return;
    }

    if (!validateForm()) {
      const firstErrorKey = Object.keys(errors)[0];
      const el = document.getElementsByName(firstErrorKey)[0];
      if (el) el.focus();
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      // Structure the full payload combining form fields into the message body for admin lead tracking
      const structuredMessage = [
        formData.message.trim(),
        "",
        "--- Enquiry Specifications ---",
        `Enquiry Type: ${formData.enquiryType}`,
        `Service / Area of Interest: ${formData.serviceArea}`,
        `Country: ${formData.country}`,
        formData.phone.trim() ? `Phone: ${formData.phone.trim()}` : null,
        formData.website.trim() ? `Website: ${formData.website.trim()}` : null,
        formData.timeline ? `Project Timeline: ${formData.timeline}` : null,
        formData.budget ? `Estimated Budget: ${formData.budget}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.fullName.trim(),
          email: formData.email.trim(),
          company: formData.company.trim(),
          budget: formData.budget || "Prefer to Discuss",
          message: structuredMessage,
          source: "public_contact_page",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit enquiry. Please try again.");
      }

      const result = await response.json();
      if (result && result.id) {
        setReferenceId(`THK-ENQ-${String(result.id).padStart(4, "0")}`);
      } else {
        setReferenceId(null);
      }

      setStatus("success");
    } catch (err: any) {
      console.error("Enquiry submission error:", err);
      setErrorMessage(err.message || "Something went wrong while submitting your enquiry.");
      setStatus("error");
    }
  };

  const handleResetForm = () => {
    setFormData({
      fullName: "",
      email: "",
      company: "",
      country: "",
      phone: "",
      website: "",
      enquiryType: "",
      serviceArea: "",
      budget: "",
      timeline: "",
      message: "",
      honeypot: "",
    });
    setErrors({});
    setStatus("idle");
    setReferenceId(null);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50/50 pb-20">
        {/* ── SECTION 3: HERO SECTION ────────────────────────────────────────── */}
        <section className="relative pt-32 sm:pt-36 lg:pt-40 pb-16 lg:pb-24 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100/60 border-b border-slate-200/80">
          {/* Subtle Ambient Dots */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(#214ECF 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Headline & Content */}
              <div className="lg:col-span-7 xl:col-span-8">
                <motion.div initial="hidden" animate="visible" variants={fadeUp} className="inline-flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-[#214ECF] animate-pulse" />
                  <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#214ECF]">
                    GET IN TOUCH
                  </span>
                </motion.div>

                <motion.h1
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  transition={{ delay: 0.05 }}
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#0B1226] tracking-tight leading-[1.1] mb-6"
                >
                  Let's Build What Comes Next.
                </motion.h1>

                <motion.p
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  transition={{ delay: 0.1 }}
                  className="text-slate-600 text-base sm:text-lg lg:text-xl max-w-2xl leading-relaxed mb-4"
                >
                  Tell us what you're looking to build, improve or scale. Thinkatic works with businesses across
                  technology, customer experience, business process outsourcing and technology-enabled operations.
                </motion.p>

                <motion.p
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  transition={{ delay: 0.15 }}
                  className="text-slate-500 text-sm sm:text-base max-w-2xl leading-relaxed mb-8"
                >
                  Whether you need a technology solution, customer support capability, BPO delivery or a custom
                  operational model, let's discuss your requirements.
                </motion.p>

                {/* Hero Action Buttons */}
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center"
                >
                  <button
                    type="button"
                    onClick={scrollToForm}
                    className="px-7 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all duration-150 shadow-md inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Start a Conversation</span>
                    <ArrowDown size={15} />
                  </button>

                  <Link
                    href="/services"
                    className="px-7 py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <span>Explore Our Services</span>
                    <ArrowRight size={15} />
                  </Link>
                </motion.div>
              </div>

              {/* Right Column: Hero Visual Graphic */}
              <div className="lg:col-span-5 xl:col-span-4 flex justify-center lg:justify-end">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease }}
                  className="relative w-full max-w-[340px] sm:max-w-[400px] rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl overflow-hidden bg-white"
                >
                  {/* Subtle decorative glow */}
                  <div className="absolute -top-12 -right-12 w-44 h-44 bg-[#214ECF]/10 rounded-full blur-2xl pointer-events-none" />

                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs font-mono font-bold text-slate-400">
                      <span>OPERATIONAL MODEL</span>
                      <span className="text-[#214ECF]">CONNECTED</span>
                    </div>

                    {/* Step 1: Business Requirement */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                      <div className="text-[10px] font-mono uppercase text-slate-400 font-bold mb-1">01 / INPUT</div>
                      <div className="text-xs sm:text-sm font-bold text-[#0B1226]">BUSINESS REQUIREMENT</div>
                    </div>

                    <div className="flex justify-center text-[#214ECF]">
                      <ArrowDown size={18} className="animate-bounce" />
                    </div>

                    {/* Step 2: Thinkatic Central Hub */}
                    <div className="p-4 rounded-xl text-center text-white shadow-md" style={{ background: "linear-gradient(135deg, #0B1226 0%, #1E293B 100%)" }}>
                      <div className="text-[10px] font-mono uppercase text-blue-300 font-bold mb-1">02 / ORCHESTRATION</div>
                      <div className="text-sm font-extrabold tracking-wide">THINKATIC PLATFORM</div>
                    </div>

                    <div className="flex justify-center text-[#214ECF]">
                      <ArrowDown size={18} />
                    </div>

                    {/* Step 3: Technology + People + Process */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] font-bold text-[#214ECF]">
                        TECH
                      </div>
                      <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] font-bold text-[#214ECF]">
                        PEOPLE
                      </div>
                      <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] font-bold text-[#214ECF]">
                        PROCESS
                      </div>
                    </div>

                    <div className="flex justify-center text-[#214ECF]">
                      <ArrowDown size={18} />
                    </div>

                    {/* Step 4: Scalable Delivery */}
                    <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-center">
                      <div className="text-[10px] font-mono uppercase text-emerald-600 font-bold mb-1">03 / OUTCOME</div>
                      <div className="text-xs sm:text-sm font-bold text-emerald-800">SCALABLE DELIVERY</div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 4: CONTACT OPTIONS (4 CARDS) ───────────────────────────── */}
        <section className="relative -mt-8 z-20 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Business Enquiry */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md hover:border-[#214ECF]/50 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group">
              <div>
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Briefcase size={22} />
                </div>
                <div className="text-[11px] font-mono uppercase font-bold tracking-wider text-[#214ECF] mb-1">
                  BUSINESS ENQUIRY
                </div>
                <h2 className="text-base font-bold text-[#0B1226] mb-2">Have a business requirement?</h2>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Talk to our team about technology, BPO, customer experience or operational services.
                </p>
              </div>
              <button
                type="button"
                onClick={scrollToForm}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#214ECF] hover:text-[#1A3DB3] cursor-pointer"
              >
                <span>Start a Conversation</span>
                <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Card 2: BPO Partnership */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md hover:border-[#214ECF]/50 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group">
              <div>
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Handshake size={22} />
                </div>
                <div className="text-[11px] font-mono uppercase font-bold tracking-wider text-[#214ECF] mb-1">
                  BPO PARTNERSHIP
                </div>
                <h2 className="text-base font-bold text-[#0B1226] mb-2">Operate a BPO centre?</h2>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Join the Thinkatic delivery network and access structured onboarding and delivery opportunities.
                </p>
              </div>
              <Link
                href="/signup?role=bpo"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#214ECF] hover:text-[#1A3DB3]"
              >
                <span>Become a BPO Partner</span>
                <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Card 3: Technology & AI */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md hover:border-[#214ECF]/50 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group">
              <div>
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Cpu size={22} />
                </div>
                <div className="text-[11px] font-mono uppercase font-bold tracking-wider text-[#214ECF] mb-1">
                  TECHNOLOGY & AI
                </div>
                <h2 className="text-base font-bold text-[#0B1226] mb-2">Need software or AI?</h2>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Explore software development, business automation, AI agents, AI chatbots, and voice AI.
                </p>
              </div>
              <Link
                href="/technology-ai"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#214ECF] hover:text-[#1A3DB3]"
              >
                <span>Explore Technology</span>
                <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Card 4: Existing Client */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md hover:border-[#214ECF]/50 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group">
              <div>
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <LayoutDashboard size={22} />
                </div>
                <div className="text-[11px] font-mono uppercase font-bold tracking-wider text-[#214ECF] mb-1">
                  EXISTING CLIENT
                </div>
                <h2 className="text-base font-bold text-[#0B1226] mb-2">Already working with us?</h2>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Use your authorised portal and support workflows for account-specific requests and project management.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#214ECF] hover:text-[#1A3DB3]"
              >
                <span>Client Portal</span>
                <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── SECTION 5: MAIN CONTACT FORM (#contact-form) ───────────────────── */}
        <section id="contact-form" ref={formRef} className="pt-20 sm:pt-28 scroll-mt-24 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-start">
            {/* Left Column: Context, Guidelines & Verified Channels */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
                  <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#214ECF]">
                    ENQUIRY FORM
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B1226] tracking-tight mb-4">
                  Tell Us About Your Requirement
                </h2>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                  Share a few details about your business and what you need help with. Our team can review your enquiry
                  and determine the appropriate next step.
                </p>
              </div>

              {/* What to Expect Card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  WHAT HAPPENS NEXT
                </h3>
                <div className="space-y-3.5 text-xs sm:text-sm text-slate-700">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-[#214ECF] mt-0.5 flex-shrink-0" />
                    <span>Your submission is recorded in our verified operating workflow.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-[#214ECF] mt-0.5 flex-shrink-0" />
                    <span>Our advisory team reviews your service area and operational requirements.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-[#214ECF] mt-0.5 flex-shrink-0" />
                    <span>We connect to discuss deliverables, scope, and the delivery arrangement.</span>
                  </div>
                </div>
              </div>

              {/* Verified Contact Details */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  DIRECT CONTACT CHANNELS
                </h3>
                <div className="space-y-3.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-3 text-slate-700">
                    <Mail size={16} className="text-[#214ECF] flex-shrink-0" />
                    <div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase">Official Email</div>
                      <a href="mailto:Thinkaticai@gmail.com" className="font-semibold text-[#0B1226] hover:text-[#214ECF]">
                        Thinkaticai@gmail.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 pt-2 border-t border-slate-100">
                    <PhoneCall size={16} className="text-[#214ECF] flex-shrink-0" />
                    <div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase">Phone / WhatsApp</div>
                      <a
                        href="https://wa.me/917263874459?text=Hello%20Thinkatic,%20I%20would%20like%20to%20discuss%20a%20business%20requirement."
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#0B1226] hover:text-[#214ECF] inline-flex items-center gap-1.5"
                      >
                        <span>+91 72638 74459</span>
                        <span className="text-[10px] text-[#214ECF] bg-blue-50 px-1.5 py-0.5 rounded font-mono font-bold">WhatsApp</span>
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 pt-2 border-t border-slate-100">
                    <Building2 size={16} className="text-[#214ECF] flex-shrink-0" />
                    <div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase">Office Address</div>
                      <span className="font-semibold text-[#0B1226]">Tower B, Magarpatta City, Hadapsar, Pune – 411028</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Privacy & Isolation Assurance */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100/80 flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
                <ShieldCheck size={18} className="text-[#214ECF] mt-0.5 flex-shrink-0" />
                <span>
                  Your information is processed in accordance with our enterprise confidentiality standards. Public
                  users can only create enquiries; submissions are kept strictly private.
                </span>
              </div>
            </div>

            {/* Right Column: Functional Enquiry Form / Success State */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-lg shadow-slate-200/50">
                {status === "success" ? (
                  /* ── SECTION 8: SUCCESS STATE ── */
                  <div className="py-8 text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 size={32} />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-2xl font-extrabold text-[#0B1226]">
                        Thanks for Reaching Out.
                      </h3>
                      <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
                        Your enquiry has been submitted successfully. Our team can review your requirements and follow
                        up through the appropriate business communication channel.
                      </p>
                    </div>

                    {/* Verified Reference ID */}
                    {referenceId && (
                      <div className="inline-block px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
                        Enquiry Reference: <strong className="text-[#214ECF]">{referenceId}</strong>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                      <button
                        type="button"
                        onClick={handleResetForm}
                        className="px-6 py-3 rounded-xl text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Submit Another Enquiry
                      </button>
                      <Link
                        href="/"
                        className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-colors inline-flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <span>Back to Home</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* ── ENQUIRY FORM ── */
                  <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    {/* Error Banner */}
                    {status === "error" && (
                      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
                        <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong className="font-semibold block mb-0.5">We Couldn't Submit Your Enquiry</strong>
                          <span>{errorMessage || "Something went wrong while submitting your enquiry. Please check your information and try again."}</span>
                        </div>
                      </div>
                    )}

                    {/* Honeypot Spam Trap (Hidden) */}
                    <div className="hidden" aria-hidden="true">
                      <label htmlFor="website_hp">Leave this field blank</label>
                      <input
                        id="website_hp"
                        type="text"
                        name="honeypot"
                        tabIndex={-1}
                        autoComplete="off"
                        value={formData.honeypot}
                        onChange={handleInputChange}
                      />
                    </div>

                    {/* Row 1: Full Name & Work Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          placeholder="Jane Doe"
                          aria-invalid={!!errors.fullName}
                          aria-describedby={errors.fullName ? "fullName-err" : undefined}
                          className={`w-full h-11 px-3.5 rounded-xl border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden transition-all ${
                            errors.fullName
                              ? "border-red-400 focus:ring-2 focus:ring-red-100"
                              : "border-slate-200 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10"
                          }`}
                        />
                        {errors.fullName && (
                          <p id="fullName-err" className="text-[11px] text-red-500 mt-1 font-medium">
                            {errors.fullName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-xs font-bold text-slate-800 mb-1.5">
                          Work Email <span className="text-[#214ECF]">*</span>
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="jane@company.com"
                          aria-invalid={!!errors.email}
                          aria-describedby={errors.email ? "email-err" : undefined}
                          className={`w-full h-11 px-3.5 rounded-xl border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden transition-all ${
                            errors.email
                              ? "border-red-400 focus:ring-2 focus:ring-red-100"
                              : "border-slate-200 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10"
                          }`}
                        />
                        {errors.email && (
                          <p id="email-err" className="text-[11px] text-red-500 mt-1 font-medium">
                            {errors.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Company Name & Country */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="company" className="block text-xs font-bold text-slate-800 mb-1.5">
                          Company Name <span className="text-[#214ECF]">*</span>
                        </label>
                        <input
                          id="company"
                          name="company"
                          type="text"
                          required
                          value={formData.company}
                          onChange={handleInputChange}
                          placeholder="Acme Global Inc."
                          aria-invalid={!!errors.company}
                          aria-describedby={errors.company ? "company-err" : undefined}
                          className={`w-full h-11 px-3.5 rounded-xl border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden transition-all ${
                            errors.company
                              ? "border-red-400 focus:ring-2 focus:ring-red-100"
                              : "border-slate-200 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10"
                          }`}
                        />
                        {errors.company && (
                          <p id="company-err" className="text-[11px] text-red-500 mt-1 font-medium">
                            {errors.company}
                          </p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="country" className="block text-xs font-bold text-slate-800 mb-1.5">
                          Country <span className="text-[#214ECF]">*</span>
                        </label>
                        <select
                          id="country"
                          name="country"
                          required
                          value={formData.country}
                          onChange={handleInputChange}
                          aria-invalid={!!errors.country}
                          aria-describedby={errors.country ? "country-err" : undefined}
                          className={`w-full h-11 px-3.5 rounded-xl border text-sm text-slate-900 bg-white focus:outline-hidden transition-all ${
                            errors.country
                              ? "border-red-400 focus:ring-2 focus:ring-red-100"
                              : "border-slate-200 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10"
                          }`}
                        >
                          <option value="">Select country...</option>
                          {COUNTRIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        {errors.country && (
                          <p id="country-err" className="text-[11px] text-red-500 mt-1 font-medium">
                            {errors.country}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Phone Number & Company Website (Optional) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="phone" className="block text-xs font-bold text-slate-800 mb-1.5">
                          Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="+1 (555) 000-0000"
                          className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10 focus:outline-hidden transition-all"
                        />
                      </div>

                      <div>
                        <label htmlFor="website" className="block text-xs font-bold text-slate-800 mb-1.5">
                          Company Website <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          id="website"
                          name="website"
                          type="url"
                          value={formData.website}
                          onChange={handleInputChange}
                          placeholder="https://example.com"
                          className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10 focus:outline-hidden transition-all"
                        />
                      </div>
                    </div>

                    {/* Row 4: Enquiry Type & Service / Area of Interest */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="enquiryType" className="block text-xs font-bold text-slate-800 mb-1.5">
                          Enquiry Type <span className="text-[#214ECF]">*</span>
                        </label>
                        <select
                          id="enquiryType"
                          name="enquiryType"
                          required
                          value={formData.enquiryType}
                          onChange={handleInputChange}
                          aria-invalid={!!errors.enquiryType}
                          aria-describedby={errors.enquiryType ? "enquiryType-err" : undefined}
                          className={`w-full h-11 px-3.5 rounded-xl border text-sm text-slate-900 bg-white focus:outline-hidden transition-all ${
                            errors.enquiryType
                              ? "border-red-400 focus:ring-2 focus:ring-red-100"
                              : "border-slate-200 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10"
                          }`}
                        >
                          <option value="">Select enquiry type...</option>
                          {ENQUIRY_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        {errors.enquiryType && (
                          <p id="enquiryType-err" className="text-[11px] text-red-500 mt-1 font-medium">
                            {errors.enquiryType}
                          </p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="serviceArea" className="block text-xs font-bold text-slate-800 mb-1.5">
                          Service / Area of Interest <span className="text-[#214ECF]">*</span>
                        </label>
                        <select
                          id="serviceArea"
                          name="serviceArea"
                          required
                          value={formData.serviceArea}
                          onChange={handleInputChange}
                          aria-invalid={!!errors.serviceArea}
                          aria-describedby={errors.serviceArea ? "serviceArea-err" : undefined}
                          className={`w-full h-11 px-3.5 rounded-xl border text-sm text-slate-900 bg-white focus:outline-hidden transition-all ${
                            errors.serviceArea
                              ? "border-red-400 focus:ring-2 focus:ring-red-100"
                              : "border-slate-200 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10"
                          }`}
                        >
                          <option value="">Select service area...</option>
                          {SERVICE_AREAS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {errors.serviceArea && (
                          <p id="serviceArea-err" className="text-[11px] text-red-500 mt-1 font-medium">
                            {errors.serviceArea}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 5: Estimated Budget & Project Timeline */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="budget" className="block text-xs font-bold text-slate-800 mb-1.5">
                          Estimated Budget <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <select
                          id="budget"
                          name="budget"
                          value={formData.budget}
                          onChange={handleInputChange}
                          className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10 focus:outline-hidden transition-all"
                        >
                          <option value="">Select budget range...</option>
                          {BUDGET_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="timeline" className="block text-xs font-bold text-slate-800 mb-1.5">
                          Project Timeline <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <select
                          id="timeline"
                          name="timeline"
                          value={formData.timeline}
                          onChange={handleInputChange}
                          className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10 focus:outline-hidden transition-all"
                        >
                          <option value="">Select target timeline...</option>
                          {TIMELINE_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 6: Message */}
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
                        placeholder="Tell us about your business, requirements, current challenges and what you'd like to achieve..."
                        aria-invalid={!!errors.message}
                        aria-describedby={errors.message ? "message-err" : undefined}
                        className={`w-full p-3.5 rounded-xl border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden transition-all leading-relaxed ${
                          errors.message
                            ? "border-red-400 focus:ring-2 focus:ring-red-100"
                            : "border-slate-200 focus:border-[#214ECF] focus:ring-3 focus:ring-[#214ECF]/10"
                        }`}
                      />
                      {errors.message && (
                        <p id="message-err" className="text-[11px] text-red-500 mt-1 font-medium">
                          {errors.message}
                        </p>
                      )}
                    </div>

                    {/* Privacy Notice (Section 18) */}
                    <div className="pt-2 text-xs text-slate-500 leading-relaxed">
                      By submitting this form, you agree that Thinkatic may use the information provided to respond to
                      your enquiry and discuss relevant business requirements. Read our{" "}
                      <Link href="/privacy-policy" className="text-[#214ECF] hover:underline font-semibold">
                        Privacy Policy
                      </Link>
                      .
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={status === "submitting"}
                        className="w-full h-12 rounded-xl font-bold text-sm text-white bg-[#214ECF] hover:bg-[#1A3DB3] disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-150 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {status === "submitting" ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <span>Send Enquiry</span>
                            <ArrowRight size={15} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 11: GLOBAL BUSINESS ENQUIRIES ─────────────────────────── */}
        <section className="pt-24 sm:pt-32 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#214ECF]">
                GLOBAL BUSINESS ENQUIRIES
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B1226] tracking-tight mb-4">
              Serving International Markets
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Thinkatic works with businesses across international markets and provides India-based delivery
              capabilities for international requirements.
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Note: Regional labels indicate active client service markets and operational delivery alignment, not
              claims of physical local branch offices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: United States */}
            <div className="p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#214ECF]/50 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4">
                <Globe size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#0B1226] mb-2">UNITED STATES</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Business enquiries and delivery requirements serving US enterprises, startups, and growing brands
                requiring flexible timezone shifts.
              </p>
              <div className="text-xs font-semibold text-[#214ECF] flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                <span>US Timezone & Shift Support</span>
              </div>
            </div>

            {/* Card 2: United Kingdom */}
            <div className="p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#214ECF]/50 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4">
                <Globe size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#0B1226] mb-2">UNITED KINGDOM</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Business enquiries and delivery requirements supporting UK and European organizations with aligned
                working hours and English-fluent teams.
              </p>
              <div className="text-xs font-semibold text-[#214ECF] flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                <span>GMT / BST Aligned Schedules</span>
              </div>
            </div>

            {/* Card 3: Global */}
            <div className="p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#214ECF]/50 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4">
                <Globe size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#0B1226] mb-2">GLOBAL</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Technology, BPO and operational requirements across international regions seeking modern, cost-efficient,
                technology-enabled delivery.
              </p>
              <div className="text-xs font-semibold text-[#214ECF] flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                <span>Multi-Region Delivery Operations</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 12: BPO PARTNER CTA (PREMIUM DARK SECTION) ─────────────── */}
        <section className="pt-24 sm:pt-32 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="rounded-3xl p-8 sm:p-12 lg:p-16 text-white shadow-xl relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0B1226 0%, #1E293B 100%)",
            }}
          >
            {/* Subtle background network lines */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="bpo-cta-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#214ECF" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#bpo-cta-grid)" />
              </svg>
            </div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
                  <span className="text-xs font-mono font-bold tracking-widest uppercase text-blue-400">
                    BPO PARTNERSHIP PROGRAM
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                  Are You a BPO Centre?
                </h2>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
                  If you operate a BPO centre and are interested in joining the Thinkatic delivery network, you can begin
                  the partner registration process.
                </p>

                {/* Key Benefits Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[#214ECF] flex-shrink-0" />
                    <span>Structured onboarding & centre review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[#214ECF] flex-shrink-0" />
                    <span>Centre verification (photos & live video)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[#214ECF] flex-shrink-0" />
                    <span>Partner Agreement governance workflow</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[#214ECF] flex-shrink-0" />
                    <span>Structured project opportunities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[#214ECF] flex-shrink-0" />
                    <span>Capacity & workforce operations tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[#214ECF] flex-shrink-0" />
                    <span>Authorised payout & balance visibility</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 pt-2">
                  Note: Commercial opportunities depend on verified capabilities, compliance, and client requirements.
                  Thinkatic does not make income or project guarantees.
                </p>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-3 justify-center">
                <Link
                  href="/signup?role=bpo"
                  className="px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all duration-150 shadow-md text-center inline-flex items-center justify-center gap-2"
                >
                  <span>Become a BPO Partner</span>
                  <ArrowRight size={14} />
                </Link>

                <Link
                  href="/bpo-partner-benefits"
                  className="px-6 py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-200 border border-slate-700 hover:bg-white/10 transition-all duration-150 text-center inline-flex items-center justify-center gap-2"
                >
                  <span>Learn About Partner Benefits</span>
                  <ExternalLink size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 13: TECHNOLOGY & AI CTA ───────────────────────────────── */}
        <section className="pt-24 sm:pt-32 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#214ECF]">
                  TECHNOLOGY & AI CAPABILITIES
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1226] tracking-tight mb-3">
                Have a Technology or AI Requirement?
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                From websites and custom software to AI agents, automation and technology-enabled operations, Thinkatic
                can discuss a solution around your specific requirements.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Software */}
              <div className="p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                <div className="text-xs font-mono font-bold uppercase text-[#214ECF] mb-2">SOFTWARE</div>
                <h3 className="text-base font-bold text-[#0B1226] mb-3">Digital Systems & Apps</h3>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <Check size={13} className="text-[#214ECF]" />
                    <span>Websites & Portals</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={13} className="text-[#214ECF]" />
                    <span>Web & Cloud Applications</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={13} className="text-[#214ECF]" />
                    <span>Custom Business Software</span>
                  </li>
                </ul>
              </div>

              {/* Card 2: AI */}
              <div className="p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                <div className="text-xs font-mono font-bold uppercase text-[#214ECF] mb-2">AI SOLUTIONS</div>
                <h3 className="text-base font-bold text-[#0B1226] mb-3">Intelligent Automation</h3>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <Check size={13} className="text-[#214ECF]" />
                    <span>AI Chatbots & Virtual Assistants</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={13} className="text-[#214ECF]" />
                    <span>Custom AI Agents & Workflows</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={13} className="text-[#214ECF]" />
                    <span>Voice AI Telephony & Routing</span>
                  </li>
                </ul>
              </div>

              {/* Card 3: Automation */}
              <div className="p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                <div className="text-xs font-mono font-bold uppercase text-[#214ECF] mb-2">AUTOMATION</div>
                <h3 className="text-base font-bold text-[#0B1226] mb-3">Process Orchestration</h3>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <Check size={13} className="text-[#214ECF]" />
                    <span>Business Automation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={13} className="text-[#214ECF]" />
                    <span>Workflow & Data Automation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={13} className="text-[#214ECF]" />
                    <span>API & Technology Integrations</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-start">
              <Link
                href="/technology-ai"
                className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-colors inline-flex items-center gap-2 shadow-xs"
              >
                <span>Explore Technology & AI</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── SECTION 14: WHY CONTACT THINKATIC (4 CONNECTED CAPABILITIES) ── */}
        <section className="pt-24 sm:pt-32 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#214ECF]">
                CONNECTED CAPABILITIES
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B1226] tracking-tight mb-4">
              One Conversation. Multiple Capabilities.
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Thinkatic connects digital innovation, skilled teams and operational rigor through a unified partnership.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Technology */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#214ECF]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4">
                <Cpu size={20} />
              </div>
              <h3 className="text-base font-bold text-[#0B1226] mb-2">TECHNOLOGY</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Build and improve digital products, web platforms, and automated business workflows.
              </p>
            </div>

            {/* Card 2: Customer Experience */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#214ECF]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4">
                <PhoneCall size={20} />
              </div>
              <h3 className="text-base font-bold text-[#0B1226] mb-2">CUSTOMER EXPERIENCE</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Design structured customer support operations across voice, chat, email, and ticketing.
              </p>
            </div>

            {/* Card 3: BPO */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#214ECF]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4">
                <Briefcase size={20} />
              </div>
              <h3 className="text-base font-bold text-[#0B1226] mb-2">BPO DELIVERY</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Access business process delivery capabilities, back-office operations, and data management.
              </p>
            </div>

            {/* Card 4: Operations */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#214ECF]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4">
                <Zap size={20} />
              </div>
              <h3 className="text-base font-bold text-[#0B1226] mb-2">OPERATIONS</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Build scalable technology-enabled workflows, attendance tracking, and quality management.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 15: HOW IT WORKS (4-STEP TIMELINE) ────────────────────── */}
        <section className="pt-24 sm:pt-32 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-3xl bg-slate-900 text-white shadow-xl">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-blue-400">
                  ENGAGEMENT LIFECYCLE
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-4">
                What Happens After You Contact Us?
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                A structured, transparent four-step process from initial enquiry to project planning.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <div className="text-2xl font-mono font-extrabold text-[#214ECF] mb-3">01</div>
                <div className="text-sm font-bold uppercase tracking-wider text-white mb-2">SHARE</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tell us about your business, current workflows, specific service needs, and desired outcomes.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <div className="text-2xl font-mono font-extrabold text-[#214ECF] mb-3">02</div>
                <div className="text-sm font-bold uppercase tracking-wider text-white mb-2">UNDERSTAND</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Thinkatic reviews the requirement, technical parameters, and delivery prerequisites.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <div className="text-2xl font-mono font-extrabold text-[#214ECF] mb-3">03</div>
                <div className="text-sm font-bold uppercase tracking-wider text-white mb-2">DISCUSS</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The appropriate service scope, delivery approach, or operating model is discussed with you.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <div className="text-2xl font-mono font-extrabold text-[#214ECF] mb-3">04</div>
                <div className="text-sm font-bold uppercase tracking-wider text-white mb-2">PLAN</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Next steps, milestone scope, and applicable commercial arrangements can then be formally defined.
                </p>
              </div>
            </div>

            <p className="text-[11px] text-center text-slate-400 mt-8">
              Note: Turnarounds and onboarding timelines depend on scope completeness and mutual availability.
              Thinkatic does not guarantee instant turnaround or automated project approvals.
            </p>
          </div>
        </section>

        {/* ── SECTION 16: TRUST SECTION (BUILT AROUND YOUR BUSINESS) ─────────── */}
        <section className="pt-24 sm:pt-32 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#214ECF]">
                OPERATING PRINCIPLES
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B1226] tracking-tight mb-4">
              Built Around Your Business
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              We align technology, people and process to create reliable outcomes for international businesses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4">
                <UserCheck size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#0B1226] mb-2">BUSINESS-FIRST</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Start with your actual requirements and specific operational challenges rather than forcing a rigid,
                generic package.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4">
                <Layers size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#0B1226] mb-2">STRUCTURED DELIVERY</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Technology tools, skilled personnel and verified operating processes work together seamlessly under
                disciplined governance.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-4">
                <Zap size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#0B1226] mb-2">SCALABLE APPROACH</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Solutions and capacity can evolve naturally as your business requirements expand and operational
                priorities shift.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 17: MINI FAQ (BEFORE YOU REACH OUT) ───────────────────── */}
        <section className="pt-24 sm:pt-32 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#214ECF]">
                  QUICK ANSWERS
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1226] tracking-tight mb-3">
                Before You Reach Out
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Common questions about engaging with Thinkatic for technology, customer experience and BPO services.
              </p>
            </div>

            <div className="space-y-3">
              {MINI_FAQS.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border transition-all duration-150 ${
                      isOpen
                        ? "border-[#214ECF]/40 bg-blue-50/20 shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      className="w-full text-left p-5 flex items-center justify-between gap-4 cursor-pointer focus:outline-hidden"
                    >
                      <span className={`text-sm sm:text-base font-semibold ${isOpen ? "text-[#214ECF]" : "text-[#0B1226]"}`}>
                        {faq.q}
                      </span>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                          isOpen ? "bg-[#214ECF] text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {isOpen ? <Minus size={15} /> : <Plus size={15} />}
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                            {faq.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-8">
              <Link
                href="/faqs"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#214ECF] hover:text-[#1A3DB3] group"
              >
                <span>View All FAQs</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── SECTION 32: FINAL FULL-WIDTH CTA ───────────────────────────────── */}
        <section className="pt-24 sm:pt-32 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="rounded-3xl p-8 sm:p-12 lg:p-16 text-white shadow-2xl relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0B1226 0%, #1E293B 100%)",
            }}
          >
            {/* Subtle animated network lines */}
            <div className="absolute inset-0 opacity-15 pointer-events-none">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="final-contact-cta-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#214ECF" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#final-contact-cta-grid)" />
              </svg>
            </div>

            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-blue-400">
                  START THE CONVERSATION
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-4">
                Ready to Start the Conversation?
              </h2>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl">
                Tell Thinkatic what you're building, improving or scaling. We'll start with your requirements and explore
                the right approach.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                <button
                  type="button"
                  onClick={scrollToForm}
                  className="px-7 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all duration-150 shadow-md text-center inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Start a Conversation</span>
                  <ArrowDown size={15} />
                </button>

                <Link
                  href="/services"
                  className="px-7 py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-200 border border-slate-700 hover:bg-white/10 hover:border-slate-500 transition-all duration-150 text-center inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Explore Services</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
