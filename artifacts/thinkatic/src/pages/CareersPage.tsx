import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowRight, MapPin, Clock, Briefcase, Cpu, Users,
  HeadphonesIcon, Activity, ChevronRight, Search, X,
  Zap, Code2, BarChart3, Building2, UserCheck,
} from "lucide-react";
import Layout from "@/components/layout/Layout";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];
const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};

// ─── Department data ──────────────────────────────────────────────────────────

const departments = [
  { id: "all",          label: "All Departments", icon: Briefcase,     color: "#ffffff" },
  { id: "Customer Support", label: "Customer Support", icon: HeadphonesIcon, color: "#214ECF" },
  { id: "Healthcare BPO",   label: "Healthcare BPO",   icon: Activity,      color: "#34d399" },
  { id: "Operations",       label: "Operations",        icon: BarChart3,     color: "#fb923c" },
  { id: "Sales",            label: "Sales",             icon: Users,         color: "#a78bfa" },
  { id: "Technology",       label: "Technology",        icon: Cpu,           color: "#38bdf8" },
  { id: "Strategy & Operations", label: "Strategy & Ops", icon: BarChart3,  color: "#f472b6" },
  { id: "Human Resources",  label: "Human Resources",  icon: UserCheck,     color: "#fbbf24" },
];

// ─── Jobs data ────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  mode: "On-site" | "Hybrid" | "Remote";
  description: string;
  requirements: string[];
  tags: string[];
}

const jobs: Job[] = [
  {
    id: "customer-support-exec",
    title: "Customer Support Executive",
    department: "Customer Support",
    location: "Magarpatta City, Pune",
    type: "Full-Time",
    mode: "Hybrid",
    description: "Be the first point of contact for our enterprise clients' customers. Deliver high-quality support across voice, email, and chat using AI-assisted tools to consistently hit CSAT targets.",
    requirements: ["1+ years in customer support or BPO", "Strong English communication", "CRM platform experience (Freshdesk, Zendesk)", "Rotational shift availability"],
    tags: ["Customer Support", "AI Tools", "Voice & Chat"],
  },
  {
    id: "healthcare-process-assoc",
    title: "Healthcare Process Associate",
    department: "Healthcare BPO",
    location: "Magarpatta City, Pune",
    type: "Full-Time",
    mode: "On-site",
    description: "Process and review medical claims, insurance verifications, and patient records within HIPAA-aligned workflows. Work with specialized healthcare software for accuracy and compliance.",
    requirements: ["Healthcare admin or medical billing background", "ICD-10 / CPT coding knowledge preferred", "High attention to detail", "eClinicalWorks or Kareo experience a plus"],
    tags: ["Healthcare", "HIPAA", "Medical Billing"],
  },
  {
    id: "call-transfer-specialist",
    title: "Call Transfer Specialist",
    department: "Operations",
    location: "Magarpatta City, Pune",
    type: "Full-Time",
    mode: "On-site",
    description: "Manage inbound and outbound call routing, ensuring customers reach the right agent or department. Maintain call quality, compliance, and accurate call dispositions.",
    requirements: ["6+ months call center experience", "Clear spoken English", "VoIP and call routing familiarity", "Compliance-conscious mindset"],
    tags: ["VoIP", "Call Center", "Operations"],
  },
  {
    id: "sdr",
    title: "Sales Development Representative",
    department: "Sales",
    location: "Remote / Pune",
    type: "Full-Time",
    mode: "Remote",
    description: "Drive outbound prospecting for Thinkatic and clients. Research target accounts, run multi-touch sequences, qualify leads, and book discovery meetings for senior sales stakeholders.",
    requirements: ["1+ years B2B sales or SDR role", "Strong cold outreach writing skills", "HubSpot or Salesforce experience", "Metrics-driven pipeline mindset"],
    tags: ["Sales", "Outbound", "HubSpot"],
  },
  {
    id: "ai-engineer",
    title: "AI Engineer",
    department: "Technology",
    location: "Remote / Pune",
    type: "Full-Time",
    mode: "Hybrid",
    description: "Build and deploy AI-powered automation systems, LLM integrations, and intelligent workflows for enterprise clients. Own end-to-end development from model evaluation to production.",
    requirements: ["Python and ML/AI frameworks proficiency", "LLM experience (OpenAI, Gemini, Anthropic)", "REST API and cloud deployment experience", "Vector databases and RAG architecture knowledge"],
    tags: ["AI/ML", "Python", "LLMs", "Cloud"],
  },
  {
    id: "software-developer",
    title: "Software Developer",
    department: "Technology",
    location: "Remote / Pune",
    type: "Full-Time",
    mode: "Hybrid",
    description: "Develop scalable web applications and internal tools. Work across the stack on React frontends, Node.js or Python backends, and cloud-hosted APIs in a fast-moving engineering team.",
    requirements: ["2+ years professional development", "React and Node.js / Python proficiency", "REST API design and integration", "Git and clean code practices"],
    tags: ["React", "Node.js", "Full Stack"],
  },
  {
    id: "business-analyst",
    title: "Business Analyst",
    department: "Strategy & Operations",
    location: "Pune",
    type: "Full-Time",
    mode: "Hybrid",
    description: "Bridge business requirements and technical delivery. Analyze client operations, document process gaps, define solution specs, and partner with engineering and BPO teams.",
    requirements: ["2+ years BA, consulting, or process improvement", "Requirement gathering and stakeholder communication", "Process mapping, user stories, BRD/FRD docs", "Excel / Google Sheets; Jira familiarity"],
    tags: ["Business Analysis", "Process Design", "Jira"],
  },
  {
    id: "operations-manager",
    title: "Operations Manager",
    department: "Operations",
    location: "Magarpatta City, Pune",
    type: "Full-Time",
    mode: "On-site",
    description: "Oversee day-to-day BPO operations across multiple client accounts. Manage team performance, SLA adherence, quality metrics, and continuous improvement initiatives.",
    requirements: ["4+ years BPO or process management", "Experience managing 20+ agent teams", "Performance dashboards and reporting skills", "Client-facing escalation management"],
    tags: ["Operations", "Team Lead", "SLA"],
  },
  {
    id: "hr-executive",
    title: "HR Executive",
    department: "Human Resources",
    location: "Magarpatta City, Pune",
    type: "Full-Time",
    mode: "On-site",
    description: "Own end-to-end recruitment, drive onboarding, maintain records, and lead engagement initiatives. A key partner in scaling Thinkatic's team rapidly and sustainably.",
    requirements: ["1–3 years HR, talent acquisition, or people ops", "LinkedIn Recruiter and ATS tools experience", "Strong interpersonal skills", "Labour compliance and HR practices knowledge"],
    tags: ["Recruitment", "HR", "Talent Acquisition"],
  },
];

const modeBadge: Record<string, string> = {
  "On-site": "rgba(251,146,60,0.15)",
  "Hybrid":  "rgba(33,78,207,0.1)",
  "Remote":  "rgba(52,211,153,0.12)",
};
const modeColor: Record<string, string> = {
  "On-site": "#fb923c",
  "Hybrid":  "#214ECF",
  "Remote":  "#34d399",
};

// ─── Department card ──────────────────────────────────────────────────────────

function DeptCard({ dept, active, count, onClick }: {
  dept: typeof departments[0];
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const Icon = dept.icon;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="flex flex-col items-start gap-2.5 p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer w-full"
      style={{
        background: active ? `${dept.color}12` : "rgba(255,255,255,0.025)",
        borderColor: active ? `${dept.color}40` : "rgba(255,255,255,0.07)",
        boxShadow: active ? `0 0 18px ${dept.color}10` : "none",
      }}
    >
      <div className="flex items-center justify-between w-full">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: active ? `${dept.color}20` : "rgba(33,78,207,0.04)" }}>
          <Icon size={14} style={{ color: active ? dept.color : "rgba(33,78,207,0.22)" }} />
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{
            background: active ? `${dept.color}18` : "rgba(33,78,207,0.04)",
            color: active ? dept.color : "rgba(255,255,255,0.3)",
          }}>
          {count === 0 ? "All" : count}
        </span>
      </div>
      <span className="text-xs font-medium leading-tight"
        style={{ color: active ? "#fff" : "rgba(255,255,255,0.5)" }}>
        {dept.label}
      </span>
    </motion.button>
  );
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ job, index }: { job: Job; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const dept = departments.find(d => d.id === job.department);
  const color = dept?.color ?? "#214ECF";

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={{ ...fadeUp, visible: { ...fadeUp.visible, transition: { duration: 0.5, ease, delay: index * 0.04 } } }}
      className="rounded-2xl border overflow-hidden transition-all duration-200 group"
      style={{ background: "#FFFFFF", borderColor: "rgba(33,78,207,0.12)", boxShadow: "0 16px 40px rgba(33,78,207,0.04)" }}
    >
      <div className="p-6 sm:p-7">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{ background: `${color}12`, border: `1px solid ${color}25`, color }}>
                {job.department}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{ background: modeBadge[job.mode], border: `1px solid ${modeColor[job.mode]}25`, color: modeColor[job.mode] }}>
                {job.mode}
              </span>
              <span className="text-muted-foreground text-xs">{job.type}</span>
            </div>

            <h3 className="font-display font-bold text-foreground text-lg mb-2 group-hover:text-foreground transition-colors leading-tight">
              {job.title}
            </h3>

            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-3">
              <MapPin size={11} className="shrink-0" />
              {job.location}
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed mb-4">{job.description}</p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {job.tags.map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] text-muted-foreground font-mono"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(33,78,207,0.04)" }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="shrink-0 flex flex-row sm:flex-col items-center sm:items-end gap-3">
            <Link
              href={`/apply-online?position=${job.id}&department=${encodeURIComponent(job.department)}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm text-foreground transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg,#214ECF,#214ECF)", boxShadow: "0 0 18px rgba(33,78,207,0.14)" }}
            >
              Apply Now
              <ArrowRight size={13} />
            </Link>
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="text-xs text-muted-foreground hover:text-muted-foreground transition-colors underline underline-offset-2"
            >
              {expanded ? "Less info" : "More info"}
            </button>
          </div>
        </div>

        {/* Expandable requirements */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease }}
              className="overflow-hidden"
            >
              <div className="pt-5 mt-5 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">Key Requirements</p>
                <ul className="flex flex-col gap-2">
                  {job.requirements.map(req => (
                    <li key={req} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CareersPage() {
  const [activeDept, setActiveDept] = useState("all");
  const [search, setSearch] = useState("");

  const filteredJobs = jobs.filter(job => {
    const matchesDept = activeDept === "all" || job.department === activeDept;
    const q = search.toLowerCase();
    const matchesSearch = !q || job.title.toLowerCase().includes(q) || job.department.toLowerCase().includes(q) || job.tags.some(t => t.toLowerCase().includes(q));
    return matchesDept && matchesSearch;
  });

  const deptCounts = departments.reduce<Record<string, number>>((acc, d) => {
    acc[d.id] = d.id === "all" ? jobs.length : jobs.filter(j => j.department === d.id).length;
    return acc;
  }, {});

  return (
    <Layout>
      {/* ── Hero ── */}
      <section className="relative pt-44 pb-24 overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[#FFFFFF]" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 65% 55% at 55% 0%, rgba(71,163,255,0.09) 0%, transparent 65%)" }} />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)", backgroundSize: "64px 64px" }} />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
            <motion.p variants={fadeUp} className="text-xs font-mono uppercase tracking-[0.25em] mb-5" style={{ color: "#214ECF" }}>
              Careers at Thinkatic
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="font-display font-bold text-foreground leading-[1.0] mb-6"
              style={{ fontSize: "clamp(2.8rem,6vw,5rem)" }}
            >
              Build the Future of<br />
              <span className="text-gradient">Intelligent Work</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-muted-foreground text-base leading-relaxed max-w-xl mb-10">
              Join a team that's redefining what's possible when AI and human expertise operate together. We move fast, think big, and deliver measurable impact for enterprise clients worldwide.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span><span className="text-foreground/75 font-semibold">{jobs.length}</span> open positions</span>
              <span><span className="text-foreground/75 font-semibold">Pune, India</span> + Remote</span>
              <span><span className="text-foreground/75 font-semibold">Hybrid-first</span> culture</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Department cards ── */}
      <section className="py-16 bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#214ECF] mb-5">Browse by Department</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {departments.map(dept => (
              <DeptCard
                key={dept.id}
                dept={dept}
                active={activeDept === dept.id}
                count={deptCounts[dept.id]}
                onClick={() => setActiveDept(dept.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Job listings ── */}
      <section className="py-16 bg-[#FFFFFF]">
        <div className="max-w-6xl mx-auto px-6">

          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search roles, departments, skills…"
                className="w-full bg-white/[0.04] border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#214ECF]/50 focus:ring-1 focus:ring-[#214ECF]/20 transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <span className="font-mono">{filteredJobs.length}</span>
              <span>position{filteredJobs.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Grid */}
          <AnimatePresence mode="wait">
            {filteredJobs.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center py-20 text-muted-foreground">
                <Search size={32} className="mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium text-muted-foreground mb-2">No positions found</p>
                <p className="text-sm">Try adjusting your search or department filter</p>
              </motion.div>
            ) : (
              <motion.div key="jobs" className="flex flex-col gap-4">
                {filteredJobs.map((job, i) => <JobCard key={job.id} job={job} index={i} />)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Open application CTA */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mt-12 text-center p-10 rounded-3xl border"
            style={{ background: "rgba(71,163,255,0.04)", borderColor: "rgba(71,163,255,0.14)" }}
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] mb-3" style={{ color: "#214ECF" }}>
              Don't see your role?
            </p>
            <h3 className="font-display font-bold text-foreground text-2xl mb-3">Send an Open Application</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6 leading-relaxed">
              We're always looking for exceptional talent. Send us your details and we'll keep you in mind for future openings.
            </p>
            <Link
              href="/apply-online"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm text-foreground transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg,#214ECF,#214ECF)", boxShadow: "0 0 24px rgba(71,163,255,0.22)" }}
            >
              Apply Online
              <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
