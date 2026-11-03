import { useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ChevronDown, MessageCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";

// ─── Data ─────────────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Services", "Technology", "Process", "Security"] as const;
type Category = typeof CATEGORIES[number];

const FAQS: { q: string; a: string; category: Exclude<Category, "All"> }[] = [
  {
    category: "Services",
    q: "What BPO services does Thinkatic provide?",
    a: "We offer five core pillars: Healthcare BPO (medical coding, patient outreach, RCM), Customer Support (voice, chat, WhatsApp), Sales & Lead Generation (outbound calling, appointment setting), Back Office Operations (data entry, CRM management, document processing), and Digital Operations (intelligent workflow automation, CRM integrations, multichannel routing). Each pillar combines trained human teams with modern enterprise tooling.",
  },
  {
    category: "Services",
    q: "Do you work with startups or only enterprises?",
    a: "Both. We help high-growth startups build their core BPO infrastructure and operational capabilities, and we help established enterprises modernize legacy operations at scale. Our engagement models are flexible — whether you need 5 agents or 500.",
  },
  {
    category: "Services",
    q: "What industries do you specialize in?",
    a: "Our primary verticals are Healthcare & Life Sciences, Financial Services & Banking, Technology & SaaS, Insurance & Risk, and Retail & E-Commerce. These are the sectors where data density is highest and modernized outsourcing drives the most measurable ROI.",
  },
  {
    category: "Technology",
    q: "What technologies power your BPO operations?",
    a: "We deploy enterprise-grade infrastructure tailored for your domain, combined with modern workflow orchestration, CRM connectors, and structured human-evaluated quality governance frameworks.",
  },
  {
    category: "Technology",
    q: "Can you integrate AI into our existing software?",
    a: "Yes — this is one of our core specialties. We design AI middleware and secure API layers that connect seamlessly to your current CRM, ERP, ticketing platform, or custom stack. We work with Salesforce, HubSpot, Zendesk, ServiceNow, SAP, and dozens of other enterprise platforms.",
  },
  {
    category: "Process",
    q: "How long does a typical engagement take?",
    a: "MVP deployments with AI agents and basic BPO workflows typically go live in 4–8 weeks. Full enterprise integrations — including data engineering, model fine-tuning, system integration, and scaled team deployment — generally take 3–6 months. Timeline depends heavily on your data readiness and scope.",
  },
  {
    category: "Process",
    q: "What does onboarding look like?",
    a: "We start with a structured Discovery & Strategy phase (1–2 weeks): stakeholder interviews, ROI modeling, feasibility analysis, and alignment on KPIs. We then move into architecture design, data engineering, and iterative development sprints — with weekly reviews and demos at every checkpoint.",
  },
  {
    category: "Security",
    q: "How do you ensure data privacy and security?",
    a: "Security is foundational, not an afterthought. We are ISO 27001 certified, HIPAA compliant, and SOC 2 Type II audited. For AI workloads, we can deploy open-source models inside your private VPC or use enterprise API agreements with zero-data-retention clauses. Your proprietary data never trains public foundation models.",
  },
  {
    category: "Security",
    q: "Are you HIPAA compliant for healthcare data?",
    a: "Yes. All healthcare engagements are handled under signed BAAs. Our healthcare BPO team is HIPAA-trained, our infrastructure uses encrypted data transport and storage, and we enforce strict access controls with full audit logging for every data interaction.",
  },
];

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

// ─── FAQ item ─────────────────────────────────────────────────────────────────

function FAQItem({ faq, index }: { faq: typeof FAQS[0]; index: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease, delay: (index % 5) * 0.06 }}
      className="border-b"
      style={{ borderColor: "rgba(33,78,207,0.12)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-4 py-6 text-left group"
        aria-expanded={open}
      >
        {/* Category pill */}
        <span
          className="mt-0.5 flex-shrink-0 hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: "rgba(33,78,207,0.09)",
            color: "#214ECF",
            border: "1px solid rgba(33,78,207,0.15)",
          }}
        >
          {faq.category}
        </span>

        <span
          className="flex-1 text-base md:text-lg font-semibold leading-snug transition-colors duration-200"
          style={{ color: open ? "#0F172A" : "#334155" }}
        >
          {faq.q}
        </span>

        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.35, ease }}
          className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center border"
          style={{
            borderColor: open ? "rgba(37,99,235,0.5)" : "rgba(33,78,207,0.12)",
            background: open ? "rgba(33,78,207,0.12)" : "transparent",
            transition: "background 0.3s, border-color 0.3s",
          }}
        >
          <ChevronDown size={14} style={{ color: open ? "#214ECF" : "#64748B" }} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease }}
            className="overflow-hidden"
          >
            <p
              className="text-base leading-relaxed pb-7 pl-0 sm:pl-[80px] pr-10"
              style={{ color: "#475569" }}
            >
              {faq.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Section ───────────────────────────────────────────────────────────────────

export function FAQ() {
  const headingRef = useRef<HTMLDivElement>(null);
  const inView = useInView(headingRef, { once: true, margin: "-80px" });
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const filtered = activeCategory === "All" ? FAQS : FAQS.filter((f) => f.category === activeCategory);

  return (
    <section
      className="relative py-28 md:py-36 overflow-hidden"
      style={{ background: "#FFFFFF", borderTop: "1px solid rgba(33,78,207,0.08)" }}
    >
      {/* Ambient glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.05) 0%, transparent 70%)", filter: "blur(60px)" }} />

      <div className="max-w-4xl mx-auto px-6 md:px-12">

        {/* ── Header ── */}
        <div ref={headingRef} className="mb-14 text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease }}
            className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] mb-5"
            style={{ color: "#214ECF" }}
          >
            FAQ
          </motion.p>

          <div className="overflow-hidden mb-5">
            <motion.h2
              initial={{ y: "100%", opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.85, ease, delay: 0.05 }}
              className="font-display font-bold text-foreground leading-[1.05]"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3.8rem)" }}
            >
              Frequently asked questions
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease, delay: 0.2 }}
            className="text-base max-w-xl mx-auto"
            style={{ color: "#475569" }}
          >
            Everything you need to know about working with Thinkatic. Can't find an answer? Contact us directly.
          </motion.p>
        </div>

        {/* ── Category filter tabs ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease, delay: 0.3 }}
          className="flex flex-wrap gap-2 justify-center mb-12"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="relative px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all duration-200 cursor-pointer"
              style={{
                background: activeCategory === cat ? "rgba(33,78,207,0.08)" : "#F8FAFF",
                border: `1px solid ${activeCategory === cat ? "rgba(33,78,207,0.25)" : "rgba(33,78,207,0.12)"}`,
                color: activeCategory === cat ? "#214ECF" : "#475569",
              }}
            >
              {activeCategory === cat && (
                <motion.div
                  layoutId="faq-active-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: "rgba(33,78,207,0.09)" }}
                  transition={{ duration: 0.3, ease }}
                />
              )}
              <span className="relative z-10">{cat}</span>
            </button>
          ))}
        </motion.div>

        {/* ── FAQ list ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease }}
          >
            {filtered.map((faq, i) => (
              <FAQItem key={faq.q} faq={faq} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* ── Bottom CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, ease }}
          className="mt-16 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border p-8"
          style={{ background: "rgba(37,99,235,0.06)", borderColor: "rgba(33,78,207,0.15)" }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(33,78,207,0.12)", border: "1px solid rgba(37,99,235,0.3)" }}
            >
              <MessageCircle size={18} style={{ color: "#214ECF" }} />
            </div>
            <div>
              <p className="text-slate-900 font-semibold text-sm mb-1">Still have questions?</p>
              <p className="text-sm" style={{ color: "#475569" }}>
                Our team typically responds within 2 hours during business days.
              </p>
            </div>
          </div>
          <Link href="/contact">
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: "0 0 40px rgba(33,78,207,0.25)" }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2.5 px-7 py-3 rounded-full font-bold text-sm text-foreground flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #214ECF 0%, #214ECF 100%)", boxShadow: "0 0 24px rgba(33,78,207,0.15)" }}
            >
              Talk to Us
              <ArrowRight size={15} />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
