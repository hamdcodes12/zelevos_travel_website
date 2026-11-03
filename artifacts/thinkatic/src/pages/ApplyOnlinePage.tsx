import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowRight, Loader2, Send, Briefcase,
  ChevronRight, User, MapPin, FileText,
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import {
  FormInput, FormTextarea, FormSelect, FormCheckbox,
  StepIndicator, SuccessState, ErrorBanner,
} from "@/components/forms/FormField";
import { CountrySelector } from "@/components/forms/CountrySelector";
import { DatePickerField } from "@/components/forms/DatePickerField";
import { FileUpload } from "@/components/forms/FileUpload";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];
const slideIn = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.42, ease } },
  exit:    { opacity: 0, x: -24, transition: { duration: 0.28, ease } },
};
const fadeUp = {
  hidden:   { opacity: 0, y: 20 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

// ─── Schemas ─────────────────────────────────────────────────────────────────

const s1 = z.object({
  firstName:    z.string().min(2, "First name required"),
  lastName:     z.string().min(1, "Last name required"),
  email:        z.string().email("Invalid email"),
  phone:        z.string().min(6, "Phone number required"),
  country:      z.string().min(1, "Select your country"),
  city:         z.string().min(1, "City is required"),
  linkedIn:     z.string().url("Enter a valid LinkedIn URL").optional().or(z.literal("")),
  portfolio:    z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

const s2 = z.object({
  position:           z.string().min(1, "Select the position you're applying for"),
  department:         z.string().min(1, "Select a department"),
  employmentType:     z.string().min(1, "Select employment type"),
  experienceYears:    z.string().min(1, "Select years of experience"),
  currentRole:        z.string().optional(),
  availability:       z.date().optional().nullable(),
  expectedSalary:     z.string().optional(),
  coverLetter:        z.string().min(50, "Cover letter must be at least 50 characters"),
});

const s3 = z.object({
  skills:      z.string().min(5, "List your key skills"),
  whyUs:       z.string().min(30, "Tell us why you want to join (min 30 chars)"),
  heardFrom:   z.string().optional(),
  termsAgreed: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
});

type S1 = z.infer<typeof s1>;
type S2 = z.infer<typeof s2>;
type S3 = z.infer<typeof s3>;

// ─── Job positions ────────────────────────────────────────────────────────────

const POSITIONS = [
  { value: "customer-support-exec",    label: "Customer Support Executive",    dept: "Customer Support" },
  { value: "healthcare-process-assoc", label: "Healthcare Process Associate",  dept: "Healthcare BPO" },
  { value: "call-transfer-specialist", label: "Call Transfer Specialist",      dept: "Operations" },
  { value: "sdr",                      label: "Sales Development Representative", dept: "Sales" },
  { value: "ai-engineer",              label: "AI Engineer",                   dept: "Technology" },
  { value: "software-developer",       label: "Software Developer",            dept: "Technology" },
  { value: "business-analyst",         label: "Business Analyst",              dept: "Strategy & Ops" },
  { value: "operations-manager",       label: "Operations Manager",            dept: "Operations" },
  { value: "hr-executive",             label: "HR Executive",                  dept: "Human Resources" },
  { value: "open-application",         label: "Open Application",              dept: "General" },
];

const DEPARTMENTS = [...new Set(POSITIONS.map(p => p.dept))];

// ─── Step icon chips ──────────────────────────────────────────────────────────

const stepMeta = [
  { icon: User,     label: "Personal Info" },
  { icon: Briefcase,label: "Experience" },
  { icon: FileText, label: "Final Details" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ApplyOnlinePage() {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [s1Data, setS1Data] = useState<S1 | null>(null);
  const [s2Data, setS2Data] = useState<S2 | null>(null);
  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [coverLetterFiles, setCoverLetterFiles] = useState<File[]>([]);
  const [availability, setAvailability] = useState<Date | null>(null);

  // Pre-fill position from query string (linked from CareersPage)
  const form1 = useForm<S1>({ resolver: zodResolver(s1), defaultValues: { firstName: "", lastName: "", email: "", phone: "", country: "", city: "", linkedIn: "", portfolio: "" } });
  const form2 = useForm<S2>({ resolver: zodResolver(s2), defaultValues: { position: "", department: "", employmentType: "", experienceYears: "", currentRole: "", expectedSalary: "", coverLetter: "" } });
  const form3 = useForm<S3>({ resolver: zodResolver(s3), defaultValues: { skills: "", whyUs: "", heardFrom: "", termsAgreed: undefined } });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pos = params.get("position");
    const dept = params.get("department");
    if (pos) form2.setValue("position", pos);
    if (dept) form2.setValue("department", dept);
  }, [form2]);

  const onStep1 = (data: S1) => { setS1Data(data); setStep(1); };
  const onStep2 = (data: S2) => { setS2Data(data); setStep(2); };

  const onSubmit = async (data: S3) => {
    if (!s1Data || !s2Data) return;
    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${s1Data.firstName} ${s1Data.lastName}`,
          email: s1Data.email,
          phone: s1Data.phone,
          company: `Applicant — ${s2Data.position}`,
          country: s1Data.country,
          serviceInterest: s2Data.department,
          message: [
            `[Job Application: ${s2Data.position}]`,
            `Department: ${s2Data.department}`,
            `Experience: ${s2Data.experienceYears} years`,
            `Current Role: ${s2Data.currentRole || "N/A"}`,
            `Availability: ${availability?.toLocaleDateString() ?? "ASAP"}`,
            `Expected Salary: ${s2Data.expectedSalary || "N/A"}`,
            `LinkedIn: ${s1Data.linkedIn || "N/A"}`,
            `Skills: ${data.skills}`,
            `Cover Letter:\n${s2Data.coverLetter}`,
            `Why Thinkatic:\n${data.whyUs}`,
            `Heard from: ${data.heardFrom || "N/A"}`,
          ].join("\n\n"),
          source: "apply_online_form",
        }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Failed");
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  const reset = () => {
    form1.reset(); form2.reset(); form3.reset();
    setStep(0); setStatus("idle"); setErrorMsg("");
    setS1Data(null); setS2Data(null);
    setCvFiles([]); setCoverLetterFiles([]); setAvailability(null);
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-40 pb-16 overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[#FFFFFF]" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(33,78,207,0.08) 0%, transparent 65%)" }} />

        <div className="max-w-4xl mx-auto px-6 relative z-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono mb-10">
            <Link href="/" className="hover:text-muted-foreground transition-colors">Home</Link>
            <ChevronRight size={11} />
            <Link href="/careers" className="hover:text-muted-foreground transition-colors">Careers</Link>
            <ChevronRight size={11} />
            <span className="text-muted-foreground">Apply</span>
          </nav>

          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
            <motion.p variants={fadeUp} className="text-xs font-mono uppercase tracking-[0.22em] mb-5" style={{ color: "#214ECF" }}>
              Apply Online
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="font-display font-black text-foreground leading-[1.0] mb-5"
              style={{ fontSize: "clamp(2.2rem,4.5vw,3.5rem)" }}
            >
              Join the Thinkatic Team
            </motion.h1>
            <motion.p variants={fadeUp} className="text-muted-foreground text-base leading-relaxed max-w-xl">
              We're building the future of AI-powered operations. Apply below and our team will review your application within 3–5 business days.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 bg-[#FFFFFF]">
        <div className="max-w-3xl mx-auto px-6">

          {/* Step indicator */}
          <div className="mb-10">
            {/* Desktop chips */}
            <div className="hidden sm:flex items-center justify-center gap-0 mb-2">
              {stepMeta.map((s, i) => (
                <div key={s.label} className="flex items-center">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300"
                    style={{
                      background: i === step ? "rgba(33,78,207,0.1)" : "transparent",
                      border: `1px solid ${i === step ? "rgba(71,163,255,0.35)" : "transparent"}`,
                    }}>
                    <s.icon size={13} className={i === step ? "text-[#214ECF]" : i < step ? "text-muted-foreground" : "text-foreground/20"} />
                    <span className={`text-xs font-medium ${i === step ? "text-muted-foreground" : i < step ? "text-muted-foreground" : "text-foreground/20"}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < stepMeta.length - 1 && (
                    <div className="w-8 h-px mx-1" style={{ background: i < step ? "rgba(71,163,255,0.4)" : "rgba(33,78,207,0.06)" }} />
                  )}
                </div>
              ))}
            </div>
            {/* Mobile */}
            <div className="sm:hidden">
              <StepIndicator step={step} total={3} labels={stepMeta.map(s => s.label)} />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="rounded-3xl border p-7 sm:p-10"
            style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(33,78,207,0.06)" }}
          >
            <AnimatePresence mode="wait">

              {status === "success" ? (
                <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <SuccessState
                    title="Application Submitted!"
                    message={`Thanks${s1Data ? `, ${s1Data.firstName}` : ""}. We've received your application and our HR team will be in touch within 3–5 business days.`}
                    onReset={reset}
                    resetLabel="Submit another application"
                  />
                </motion.div>

              ) : step === 0 ? (
                /* ── Step 1: Personal Info ── */
                <motion.div key="s1" {...slideIn}>
                  <h2 className="font-display font-bold text-foreground text-2xl mb-1">Personal Information</h2>
                  <p className="text-muted-foreground text-sm mb-8">Step 1 of 3 — your contact details</p>

                  <form onSubmit={form1.handleSubmit(onStep1)} className="flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-4">
                      <FormInput label="First Name" required placeholder="Jane" error={form1.formState.errors.firstName?.message} {...form1.register("firstName")} />
                      <FormInput label="Last Name" required placeholder="Smith" error={form1.formState.errors.lastName?.message} {...form1.register("lastName")} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormInput label="Email Address" required type="email" placeholder="jane@email.com" error={form1.formState.errors.email?.message} {...form1.register("email")} />
                      <FormInput label="Phone Number" required type="tel" placeholder="+91 98765 43210" error={form1.formState.errors.phone?.message} {...form1.register("phone")} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <CountrySelector
                        label="Country of Residence" required
                        value={form1.watch("country")}
                        onChange={code => form1.setValue("country", code, { shouldValidate: true })}
                        error={form1.formState.errors.country?.message}
                      />
                      <FormInput label="City" required placeholder="Pune" error={form1.formState.errors.city?.message} {...form1.register("city")} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormInput label="LinkedIn Profile" type="url" placeholder="https://linkedin.com/in/jane" error={form1.formState.errors.linkedIn?.message} {...form1.register("linkedIn")} />
                      <FormInput label="Portfolio / Website" type="url" placeholder="https://jane.dev" error={form1.formState.errors.portfolio?.message} {...form1.register("portfolio")} />
                    </div>

                    {/* CV Upload */}
                    <FileUpload
                      label="Upload Your CV / Resume"
                      required
                      accept=".pdf,.doc,.docx"
                      maxSizeMB={5}
                      value={cvFiles}
                      onChange={setCvFiles}
                      hint="PDF or Word · Max 5 MB"
                    />

                    <div className="flex justify-end pt-2">
                      <motion.button type="submit" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm text-foreground"
                        style={{ background: "linear-gradient(135deg,#214ECF,#214ECF)", boxShadow: "0 0 24px rgba(71,163,255,0.22)" }}>
                        Next: Experience <ArrowRight size={14} />
                      </motion.button>
                    </div>
                  </form>
                </motion.div>

              ) : step === 1 ? (
                /* ── Step 2: Experience ── */
                <motion.div key="s2" {...slideIn}>
                  <h2 className="font-display font-bold text-foreground text-2xl mb-1">Experience & Role</h2>
                  <p className="text-muted-foreground text-sm mb-8">Step 2 of 3 — tell us about your background</p>

                  <form onSubmit={form2.handleSubmit(onStep2)} className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormSelect label="Position Applying For" required error={form2.formState.errors.position?.message} {...form2.register("position")}>
                        <option value="">Select a role</option>
                        {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </FormSelect>
                      <FormSelect label="Department" required error={form2.formState.errors.department?.message} {...form2.register("department")}>
                        <option value="">Select department</option>
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </FormSelect>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormSelect label="Employment Type" required error={form2.formState.errors.employmentType?.message} {...form2.register("employmentType")}>
                        <option value="">Select type</option>
                        <option value="full-time">Full-Time</option>
                        <option value="part-time">Part-Time</option>
                        <option value="contract">Contract</option>
                        <option value="internship">Internship</option>
                      </FormSelect>
                      <FormSelect label="Years of Experience" required error={form2.formState.errors.experienceYears?.message} {...form2.register("experienceYears")}>
                        <option value="">Select range</option>
                        <option value="0-1">0–1 years (Fresher)</option>
                        <option value="1-3">1–3 years</option>
                        <option value="3-5">3–5 years</option>
                        <option value="5-10">5–10 years</option>
                        <option value="10+">10+ years</option>
                      </FormSelect>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormInput label="Current Job Title (optional)" placeholder="e.g. Support Executive" {...form2.register("currentRole")} />
                      <FormInput label="Expected Salary (optional)" placeholder="e.g. ₹6 LPA or $48k" {...form2.register("expectedSalary")} />
                    </div>

                    <DatePickerField
                      label="Earliest Availability"
                      value={availability}
                      onChange={d => { setAvailability(d); form2.setValue("availability", d); }}
                      disablePast
                      placeholder="When can you start?"
                    />

                    <FormTextarea
                      label="Cover Letter"
                      required
                      rows={6}
                      placeholder="Write a short cover letter — who you are, why this role, and what makes you a great fit for Thinkatic…"
                      error={form2.formState.errors.coverLetter?.message}
                      {...form2.register("coverLetter")}
                    />

                    <FileUpload
                      label="Supporting Documents (optional)"
                      hint="Cover letter PDF, certifications, portfolio samples"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      multiple
                      maxSizeMB={10}
                      value={coverLetterFiles}
                      onChange={setCoverLetterFiles}
                    />

                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setStep(0)}
                        className="flex items-center gap-1.5 px-5 py-3.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-white/25 transition-all">
                        ← Back
                      </button>
                      <motion.button type="submit" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                        className="flex-1 flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm text-foreground"
                        style={{ background: "linear-gradient(135deg,#214ECF,#214ECF)", boxShadow: "0 0 24px rgba(71,163,255,0.22)" }}>
                        Next: Final Details <ArrowRight size={14} />
                      </motion.button>
                    </div>
                  </form>
                </motion.div>

              ) : (
                /* ── Step 3: Final Details ── */
                <motion.div key="s3" {...slideIn}>
                  <h2 className="font-display font-bold text-foreground text-2xl mb-1">Final Details</h2>
                  <p className="text-muted-foreground text-sm mb-8">Step 3 of 3 — almost done!</p>

                  {/* Application summary */}
                  <div className="rounded-2xl border p-5 mb-6"
                    style={{ background: "rgba(71,163,255,0.04)", borderColor: "rgba(71,163,255,0.14)" }}>
                    <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">Your Application</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["Name", s1Data ? `${s1Data.firstName} ${s1Data.lastName}` : "—"],
                        ["Email", s1Data?.email ?? "—"],
                        ["Position", POSITIONS.find(p => p.value === s2Data?.position)?.label ?? s2Data?.position ?? "—"],
                        ["Department", s2Data?.department ?? "—"],
                        ["Experience", s2Data?.experienceYears ? `${s2Data.experienceYears} yrs` : "—"],
                        ["Availability", availability?.toLocaleDateString() ?? "ASAP"],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">{k}</p>
                          <p className="text-sm text-muted-foreground truncate">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={form3.handleSubmit(onSubmit)} className="flex flex-col gap-5">
                    <FormTextarea
                      label="Key Skills"
                      required
                      rows={3}
                      placeholder="e.g. Customer support, Freshdesk, Healthcare billing, ICD-10, Python, React…"
                      error={form3.formState.errors.skills?.message}
                      {...form3.register("skills")}
                    />

                    <FormTextarea
                      label="Why do you want to join Thinkatic?"
                      required
                      rows={4}
                      placeholder="Tell us what excites you about this role and why you'd thrive at Thinkatic…"
                      error={form3.formState.errors.whyUs?.message}
                      {...form3.register("whyUs")}
                    />

                    <FormSelect label="How did you hear about us?" {...form3.register("heardFrom")}>
                      <option value="">Select source</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="indeed">Indeed / Naukri</option>
                      <option value="glassdoor">Glassdoor</option>
                      <option value="referral">Employee Referral</option>
                      <option value="google">Google Search</option>
                      <option value="social">Social Media</option>
                      <option value="other">Other</option>
                    </FormSelect>

                    <FormCheckbox
                      label={<>I certify that the information provided is accurate and agree to Thinkatic's <Link href="/privacy-policy" className="text-[#214ECF] underline underline-offset-2">Privacy Policy</Link>.</>}
                      checked={form3.watch("termsAgreed") === true}
                      onChange={e => form3.setValue("termsAgreed", e.target.checked as true, { shouldValidate: true })}
                      error={form3.formState.errors.termsAgreed?.message}
                    />

                    {status === "error" && <ErrorBanner message={errorMsg} />}

                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setStep(1)}
                        className="flex items-center gap-1.5 px-5 py-3.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-white/25 transition-all">
                        ← Back
                      </button>
                      <motion.button type="submit" disabled={status === "submitting"} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                        className="flex-1 flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm text-foreground disabled:opacity-60"
                        style={{ background: "linear-gradient(135deg,#214ECF,#214ECF)", boxShadow: "0 0 24px rgba(71,163,255,0.22)" }}>
                        {status === "submitting"
                          ? <><Loader2 size={14} className="animate-spin" /> Submitting…</>
                          : <><Send size={14} /> Submit Application</>}
                      </motion.button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Back to careers */}
          <div className="mt-8 text-center">
            <Link href="/careers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-muted-foreground transition-colors">
              <ChevronRight size={13} className="rotate-180" />
              View all open positions
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
