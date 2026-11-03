import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  ChevronRight, ArrowRight, Loader2, FileText,
  CheckCircle2, Zap, BarChart3, Shield, Clock,
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
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};
const slideIn = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.42, ease } },
  exit:    { opacity: 0, x: -24, transition: { duration: 0.28, ease } },
};

// ─── Schemas ─────────────────────────────────────────────────────────────────

const s1 = z.object({
  firstName:   z.string().min(2, "First name is required"),
  lastName:    z.string().min(1, "Last name is required"),
  email:       z.string().email("Invalid email address"),
  phone:       z.string().optional(),
  company:     z.string().min(1, "Company is required"),
  jobTitle:    z.string().optional(),
  country:     z.string().min(1, "Please select your country"),
  companySize: z.string().optional(),
});

const s2 = z.object({
  services:      z.array(z.string()).min(1, "Select at least one service"),
  teamSize:      z.string().min(1, "Expected team size is required"),
  startDate:     z.date({ required_error: "Please select a start date" }).optional().nullable(),
  budget:        z.string().min(1, "Please select a budget range"),
  projectGoal:   z.string().min(20, "Please describe your goal (min 20 chars)"),
  existingStack: z.string().optional(),
});

const s3 = z.object({
  additionalNotes: z.string().optional(),
  termsAgreed:     z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
});

type S1 = z.infer<typeof s1>;
type S2 = z.infer<typeof s2>;
type S3 = z.infer<typeof s3>;

// ─── Service options ──────────────────────────────────────────────────────────

const SERVICE_OPTIONS = [
  { id: "healthcare-bpo",      label: "Healthcare BPO",         group: "BPO" },
  { id: "customer-support",    label: "Customer Support Ops",   group: "BPO" },
  { id: "sales-lead-gen",      label: "Sales & Lead Generation",group: "BPO" },
  { id: "back-office",         label: "Back Office Operations", group: "BPO" },
  { id: "ai-bpo",              label: "AI-Powered BPO",         group: "BPO" },
  { id: "ai-dev",              label: "AI Development",         group: "Tech" },
  { id: "custom-software",     label: "Custom Software",        group: "Tech" },
  { id: "automation-rpa",      label: "Automation & RPA",       group: "Tech" },
  { id: "ai-consulting",       label: "AI Consulting",          group: "Tech" },
  { id: "cloud-infra",         label: "Cloud & Infrastructure", group: "Tech" },
];

// ─── Why Thinkatic sidebar ────────────────────────────────────────────────────

const highlights = [
  { icon: Zap,         label: "70% Cost Reduction",   desc: "vs. in-house teams" },
  { icon: Clock,       label: "14-Day Onboarding",    desc: "from signed agreement" },
  { icon: Shield,      label: "SOC 2 Compliant",      desc: "enterprise-grade security" },
  { icon: BarChart3,   label: "98.6% CSAT",           desc: "across all accounts" },
];

function SidebarPanel({ step }: { step: number }) {
  return (
    <div className="hidden lg:flex flex-col justify-between h-full py-2">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] mb-4" style={{ color: "#214ECF" }}>
          Why Thinkatic
        </p>
        <div className="flex flex-col gap-3">
          {highlights.map((h, i) => {
            const Icon = h.icon;
            return (
              <motion.div
                key={h.label}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.4, ease }}
                className="flex items-start gap-3 p-3.5 rounded-2xl border"
                style={{ background: "rgba(244,247,255,0.8)", borderColor: "rgba(255,255,255,0.07)" }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(71,163,255,0.10)" }}>
                  <Icon size={14} className="text-[#214ECF]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground/85 leading-none mb-1">{h.label}</p>
                  <p className="text-xs text-muted-foreground">{h.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Progress visual */}
      <div className="mt-8">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">Proposal Steps</p>
        {["Your Details", "Project Scope", "Final Review"].map((label, i) => (
          <div key={label} className="flex items-center gap-3 mb-2.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all duration-300"
              style={{
                background: i < step ? "linear-gradient(135deg,#214ECF,#214ECF)" : i === step ? "rgba(33,78,207,0.12)" : "rgba(33,78,207,0.04)",
                color: i < step ? "#fff" : i === step ? "#214ECF" : "rgba(33,78,207,0.16)",
                border: `1px solid ${i <= step ? "rgba(71,163,255,0.4)" : "rgba(33,78,207,0.06)"}`,
              }}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span className={`text-xs transition-colors ${i === step ? "text-muted-foreground" : i < step ? "text-muted-foreground" : "text-foreground/20"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RequestProposalPage() {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [s1Data, setS1Data] = useState<S1 | null>(null);
  const [s2Data, setS2Data] = useState<S2 | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);

  const form1 = useForm<S1>({ resolver: zodResolver(s1), defaultValues: { firstName: "", lastName: "", email: "", phone: "", company: "", jobTitle: "", country: "", companySize: "" } });
  const form2 = useForm<S2>({ resolver: zodResolver(s2), defaultValues: { services: [], teamSize: "", budget: "", projectGoal: "", existingStack: "" } });
  const form3 = useForm<S3>({ resolver: zodResolver(s3), defaultValues: { additionalNotes: "", termsAgreed: undefined } });

  const toggleService = (id: string) => {
    const next = selectedServices.includes(id)
      ? selectedServices.filter(s => s !== id)
      : [...selectedServices, id];
    setSelectedServices(next);
    form2.setValue("services", next, { shouldValidate: true });
  };

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
          company: s1Data.company,
          country: s1Data.country,
          budget: s2Data.budget,
          serviceInterest: s2Data.services.join(", "),
          message: `[Proposal Request]\n\nGoal: ${s2Data.projectGoal}\n\nTeam size: ${s2Data.teamSize}\nStart: ${startDate?.toLocaleDateString() ?? "TBD"}\nStack: ${s2Data.existingStack ?? "N/A"}\n\nNotes: ${data.additionalNotes ?? ""}`,
          source: "proposal_form",
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
    setSelectedServices([]); setStartDate(null); setAttachments([]);
  };

  const stepLabels = ["Details", "Scope", "Review"];

  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-40 pb-16 overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[#FFFFFF]" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(71,163,255,0.09) 0%, transparent 65%)" }}
        />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)", backgroundSize: "64px 64px" }} />

        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
            <motion.p variants={fadeUp} className="text-xs font-mono uppercase tracking-[0.22em] mb-5" style={{ color: "#214ECF" }}>
              Request a Proposal
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="font-display font-black text-foreground leading-[1.0] mb-5"
              style={{ fontSize: "clamp(2.5rem,5vw,4rem)" }}
            >
              Get a Custom Proposal<br />
              <span className="text-gradient">Built for Your Business</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-muted-foreground text-base leading-relaxed max-w-xl mx-auto">
              Tell us about your goals and we'll prepare a detailed scope, pricing breakdown, and implementation roadmap — no obligation.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Form section */}
      <section className="py-16 bg-[#FFFFFF]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12">

            {/* Sidebar */}
            <div className="lg:sticky lg:top-32 lg:self-start">
              <SidebarPanel step={step} />
            </div>

            {/* Form card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2, ease }}
              className="rounded-3xl border p-8 sm:p-10"
              style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(33,78,207,0.06)" }}
            >
              {/* Mobile step indicator */}
              <div className="lg:hidden mb-8">
                <StepIndicator step={step} total={3} labels={stepLabels} />
              </div>

              <AnimatePresence mode="wait">

                {status === "success" ? (
                  <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <SuccessState
                      title="Proposal Request Received"
                      message="Our team will review your requirements and send a tailored proposal within 2 business days."
                      onReset={reset}
                      resetLabel="Submit another request"
                    />
                  </motion.div>

                ) : step === 0 ? (
                  <motion.div key="s1" {...slideIn}>
                    <h2 className="font-display font-bold text-foreground text-2xl mb-1">About You</h2>
                    <p className="text-muted-foreground text-sm mb-8">Step 1 of 3 — your contact information</p>

                    <form onSubmit={form1.handleSubmit(onStep1)} className="flex flex-col gap-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormInput label="First Name" required placeholder="Jane" error={form1.formState.errors.firstName?.message} {...form1.register("firstName")} />
                        <FormInput label="Last Name" required placeholder="Smith" error={form1.formState.errors.lastName?.message} {...form1.register("lastName")} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormInput label="Work Email" required type="email" placeholder="jane@company.com" error={form1.formState.errors.email?.message} {...form1.register("email")} />
                        <FormInput label="Phone" type="tel" placeholder="+1 (555) 000-0000" {...form1.register("phone")} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormInput label="Company" required placeholder="Acme Corp" error={form1.formState.errors.company?.message} {...form1.register("company")} />
                        <FormInput label="Job Title" placeholder="Head of Operations" {...form1.register("jobTitle")} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <CountrySelector
                          label="Country" required
                          value={form1.watch("country")}
                          onChange={code => form1.setValue("country", code, { shouldValidate: true })}
                          error={form1.formState.errors.country?.message}
                        />
                        <FormSelect label="Company Size" {...form1.register("companySize")}>
                          <option value="">Select size</option>
                          <option value="1-10">1–10 employees</option>
                          <option value="11-50">11–50 employees</option>
                          <option value="51-200">51–200 employees</option>
                          <option value="201-1000">201–1,000 employees</option>
                          <option value="1000+">1,000+ employees</option>
                        </FormSelect>
                      </div>

                      <div className="flex justify-end pt-2">
                        <motion.button type="submit" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm text-foreground"
                          style={{ background: "linear-gradient(135deg,#214ECF,#214ECF)", boxShadow: "0 0 24px rgba(71,163,255,0.22)" }}>
                          Next: Project Scope <ArrowRight size={14} />
                        </motion.button>
                      </div>
                    </form>
                  </motion.div>

                ) : step === 1 ? (
                  <motion.div key="s2" {...slideIn}>
                    <h2 className="font-display font-bold text-foreground text-2xl mb-1">Project Scope</h2>
                    <p className="text-muted-foreground text-sm mb-8">Step 2 of 3 — what do you need?</p>

                    <form onSubmit={form2.handleSubmit(onStep2)} className="flex flex-col gap-6">

                      {/* Service multi-select cards */}
                      <div>
                        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">
                          Services Needed <span className="text-[#214ECF]">*</span>
                        </p>
                        {["BPO", "Tech"].map(group => (
                          <div key={group} className="mb-4">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">{group}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {SERVICE_OPTIONS.filter(s => s.group === group).map(svc => {
                                const active = selectedServices.includes(svc.id);
                                return (
                                  <motion.button
                                    key={svc.id} type="button"
                                    onClick={() => toggleService(svc.id)}
                                    whileTap={{ scale: 0.96 }}
                                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 text-left"
                                    style={{
                                      background: active ? "rgba(71,163,255,0.10)" : "rgba(255,255,255,0.03)",
                                      borderColor: active ? "rgba(71,163,255,0.40)" : "rgba(33,78,207,0.06)",
                                      color: active ? "#fff" : "rgba(255,255,255,0.45)",
                                    }}
                                  >
                                    <div className="w-3.5 h-3.5 rounded-[4px] border shrink-0 flex items-center justify-center transition-all"
                                      style={{
                                        borderColor: active ? "#214ECF" : "rgba(255,255,255,0.2)",
                                        background: active ? "#214ECF" : "transparent",
                                      }}>
                                      {active && <svg viewBox="0 0 8 6" fill="none" className="w-2 h-2"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                    </div>
                                    {svc.label}
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {form2.formState.errors.services && (
                          <p className="text-[11px] text-red-400 mt-1">⚠ {form2.formState.errors.services.message}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormSelect label="Team Size Needed" required error={form2.formState.errors.teamSize?.message} {...form2.register("teamSize")}>
                          <option value="">Select size</option>
                          <option value="1-5">1–5 people</option>
                          <option value="6-15">6–15 people</option>
                          <option value="16-50">16–50 people</option>
                          <option value="50+">50+ people</option>
                        </FormSelect>
                        <FormSelect label="Monthly Budget" required error={form2.formState.errors.budget?.message} {...form2.register("budget")}>
                          <option value="">Select budget</option>
                          <option value="Under $2k">Under $2,000 / mo</option>
                          <option value="$2k–$5k">$2,000–$5,000 / mo</option>
                          <option value="$5k–$15k">$5,000–$15,000 / mo</option>
                          <option value="$15k–$50k">$15,000–$50,000 / mo</option>
                          <option value="$50k+">$50,000+ / mo</option>
                        </FormSelect>
                      </div>

                      <DatePickerField
                        label="Desired Start Date"
                        value={startDate}
                        onChange={d => { setStartDate(d); form2.setValue("startDate", d ?? undefined); }}
                        disablePast
                        placeholder="Pick a start date"
                      />

                      <FormTextarea label="Project Goal" required rows={5}
                        placeholder="Describe what you want to achieve, key challenges, and any specific requirements…"
                        error={form2.formState.errors.projectGoal?.message}
                        {...form2.register("projectGoal")} />

                      <FormInput label="Existing Tech Stack (optional)"
                        placeholder="e.g. Salesforce, AWS, React, PostgreSQL"
                        {...form2.register("existingStack")} />

                      <FileUpload
                        label="Supporting Documents (optional)"
                        hint="RFP, brief, NDAs, or any relevant docs"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                        multiple
                        maxSizeMB={20}
                        value={attachments}
                        onChange={setAttachments}
                      />

                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setStep(0)}
                          className="flex items-center gap-1.5 px-5 py-3.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-white/25 transition-all">
                          ← Back
                        </button>
                        <motion.button type="submit" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                          className="flex-1 flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm text-foreground"
                          style={{ background: "linear-gradient(135deg,#214ECF,#214ECF)", boxShadow: "0 0 24px rgba(71,163,255,0.22)" }}>
                          Next: Review &amp; Submit <ArrowRight size={14} />
                        </motion.button>
                      </div>
                    </form>
                  </motion.div>

                ) : (
                  <motion.div key="s3" {...slideIn}>
                    <h2 className="font-display font-bold text-foreground text-2xl mb-1">Review &amp; Submit</h2>
                    <p className="text-muted-foreground text-sm mb-8">Step 3 of 3 — confirm and send your proposal request</p>

                    {/* Review summary */}
                    <div className="rounded-2xl border p-5 mb-6 space-y-4"
                      style={{ background: "rgba(71,163,255,0.04)", borderColor: "rgba(71,163,255,0.14)" }}>
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Summary</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        {[
                          ["Name", s1Data ? `${s1Data.firstName} ${s1Data.lastName}` : "—"],
                          ["Email", s1Data?.email ?? "—"],
                          ["Company", s1Data?.company ?? "—"],
                          ["Country", s1Data?.country ?? "—"],
                          ["Services", selectedServices.length ? `${selectedServices.length} selected` : "—"],
                          ["Budget", s2Data?.budget ?? "—"],
                          ["Team Size", s2Data?.teamSize ?? "—"],
                          ["Start Date", startDate?.toLocaleDateString() ?? "TBD"],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">{k}</p>
                            <p className="text-sm text-muted-foreground">{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={form3.handleSubmit(onSubmit)} className="flex flex-col gap-5">
                      <FormTextarea label="Additional Notes (optional)"
                        placeholder="Anything else we should know before preparing your proposal?"
                        rows={4}
                        {...form3.register("additionalNotes")} />

                      <FormCheckbox
                        label={<>I agree to Thinkatic's <Link href="/terms" className="text-[#214ECF] underline underline-offset-2">Terms of Service</Link> and <Link href="/privacy-policy" className="text-[#214ECF] underline underline-offset-2">Privacy Policy</Link>, and consent to being contacted about my proposal.</>}
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
                            : <><FileText size={14} /> Submit Proposal Request</>}
                        </motion.button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
