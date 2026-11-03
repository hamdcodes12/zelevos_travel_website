import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Link } from "wouter";

const BLUE = "#214ECF";
const BLUE_DIM = "rgba(33,78,207,0.1)";
const BLUE_BORDER = "rgba(33,78,207,0.14)";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

// ── Data ─────────────────────────────────────────────────────────────────────

const servicePillars = [
  {
    id: "artificial-intelligence",
    number: "01",
    title: "Artificial Intelligence",
    description: "Custom AI systems built for enterprise use cases — from private LLMs to computer vision.",
    items: [
      { title: "Custom AI Solutions", desc: "Bespoke AI models engineered for your specific workflows and data." },
      { title: "LLM Integration", desc: "Integrate large language models into your products and internal tools." },
      { title: "Private AI", desc: "Secure, on-premise AI deployments that keep your data in-house." },
      { title: "Generative AI", desc: "Content, code, and media generation powered by state-of-the-art models." },
      { title: "AI Agents", desc: "Autonomous agents that reason, plan, and act across your business processes." },
      { title: "Computer Vision", desc: "Image recognition, object detection, and visual inspection systems." },
      { title: "Natural Language Processing", desc: "Text analysis, summarization, sentiment, and language understanding." },
      { title: "Machine Learning", desc: "Predictive models and ML pipelines tailored to your data and goals." },
    ],
  },
  {
    id: "software-development",
    number: "02",
    title: "Software Development",
    description: "Production-grade applications built with modern stacks — scalable, secure, and maintainable.",
    items: [
      { title: "Custom Software", desc: "End-to-end software development aligned to your business requirements." },
      { title: "Enterprise Applications", desc: "Large-scale platforms built for complex organizational needs." },
      { title: "CRM Development", desc: "Custom CRM systems that fit your sales and support processes." },
      { title: "ERP Solutions", desc: "Integrated enterprise resource planning platforms built to scale." },
      { title: "SaaS Platforms", desc: "Multi-tenant SaaS products with billing, auth, and usage metering." },
      { title: "Web Applications", desc: "Fast, responsive web apps built with React, Next.js, and modern tooling." },
      { title: "Mobile Applications", desc: "Cross-platform iOS and Android apps built with React Native or Flutter." },
      { title: "API Development", desc: "RESTful and GraphQL APIs designed for reliability and developer experience." },
    ],
  },
  {
    id: "cloud-devops",
    number: "03",
    title: "Cloud & DevOps",
    description: "Infrastructure that ships fast, scales automatically, and stays observable.",
    items: [
      { title: "Cloud Migration", desc: "Lift-and-shift or re-architect workloads to cloud-native infrastructure." },
      { title: "AWS", desc: "Architecture, deployment, and optimization across the full AWS ecosystem." },
      { title: "Azure", desc: "Enterprise Azure solutions including Active Directory and Azure AI." },
      { title: "Google Cloud", desc: "GCP-native infrastructure with Vertex AI and BigQuery integration." },
      { title: "CI/CD", desc: "Automated pipelines that deliver tested, production-ready code on every push." },
      { title: "Infrastructure Automation", desc: "Terraform, Pulumi, and IaC to provision and manage infrastructure as code." },
      { title: "Monitoring", desc: "Observability stacks with alerting, dashboards, and incident response." },
      { title: "Containerization", desc: "Docker and Kubernetes deployments for consistent, portable workloads." },
    ],
  },
  {
    id: "automation",
    number: "04",
    title: "Automation",
    description: "Eliminate manual work and connect your tools with intelligent automation.",
    items: [
      { title: "Business Process Automation", desc: "Automate approvals, reporting, and operational workflows end-to-end." },
      { title: "Robotic Process Automation", desc: "Software robots that handle repetitive tasks across legacy systems." },
      { title: "Workflow Automation", desc: "No-code / low-code flows that integrate your SaaS stack seamlessly." },
      { title: "Enterprise Integration", desc: "Connect ERPs, CRMs, and data systems with reliable middleware." },
    ],
  },
  {
    id: "data-analytics",
    number: "05",
    title: "Data & Analytics",
    description: "Turn raw data into decisions with modern BI, warehousing, and predictive analytics.",
    items: [
      { title: "Business Intelligence", desc: "BI strategy, tool selection, and dashboard rollouts for leadership teams." },
      { title: "Dashboards", desc: "Real-time, interactive dashboards that surface the metrics that matter." },
      { title: "Data Warehousing", desc: "Centralized data warehouses built on Snowflake, BigQuery, or Redshift." },
      { title: "Predictive Analytics", desc: "Forecast demand, churn, and risk with ML-powered predictive models." },
      { title: "Reporting", desc: "Automated reports delivered to the right stakeholders on schedule." },
    ],
  },
];

const frameworkStages = [
  { step: "01", label: "Discover", desc: "Understand your business goals, data landscape, and technical constraints." },
  { step: "02", label: "Analyze", desc: "Audit existing processes and identify the highest-value AI opportunities." },
  { step: "03", label: "Design", desc: "Architect the solution — models, data pipelines, and system integration." },
  { step: "04", label: "Develop", desc: "Build, train, and iterate with your team in fast feedback loops." },
  { step: "05", label: "Deploy", desc: "Ship to production with monitoring, observability, and rollback plans." },
  { step: "06", label: "Optimize", desc: "Continuously improve performance, accuracy, and business impact." },
];

const industries = [
  "Healthcare", "Finance", "Insurance", "Retail",
  "Manufacturing", "Technology", "Education", "Real Estate", "Government",
];

const engagementModels = [
  {
    title: "Dedicated Teams",
    desc: "A full-time, embedded team that works exclusively on your product as an extension of your org.",
    icon: "👥",
  },
  {
    title: "Managed Services",
    desc: "Ongoing operational ownership of your technology — infrastructure, monitoring, and improvements.",
    icon: "⚙️",
  },
  {
    title: "Project-Based",
    desc: "Fixed-scope delivery with defined milestones, timeline, and budget. Ideal for greenfield builds.",
    icon: "📋",
  },
  {
    title: "Outcome-Based",
    desc: "We tie our fees to measurable business results — cost savings, revenue, or efficiency gains.",
    icon: "🎯",
  },
  {
    title: "Staff Augmentation",
    desc: "Supplement your team with senior engineers and AI specialists on a flexible engagement.",
    icon: "🔧",
  },
];

// ── Components ────────────────────────────────────────────────────────────────

function ServicePillar({ pillar, index }: { pillar: typeof servicePillars[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={fadeUp}
      transition={{ delay: 0.05 * index }}
      className="rounded-3xl overflow-hidden"
      style={{ background: "#FFFFFF", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Header */}
      <div
        className="px-8 md:px-12 py-10 border-b"
        style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(71,163,255,0.03)" }}
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-mono font-bold tracking-[0.2em]" style={{ color: BLUE }}>
                {pillar.number}
              </span>
              <div className="h-px flex-1 max-w-[40px]" style={{ background: BLUE_BORDER }} />
            </div>
            <h2
              className="font-display font-bold text-foreground mb-3 leading-[1.1]"
              style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)" }}
            >
              {pillar.title}
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">{pillar.description}</p>
          </div>
          <div className="flex-shrink-0">
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-foreground text-xs tracking-wider"
                style={{ background: "linear-gradient(135deg, #214ECF 0%, #214ECF 100%)" }}
              >
                GET STARTED
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </motion.button>
            </Link>
          </div>
        </div>
      </div>

      {/* Services grid */}
      <div className="px-8 md:px-12 py-10">
        <p className="text-muted-foreground text-xs font-mono uppercase tracking-[0.2em] mb-6">Services</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pillar.items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl p-5 flex flex-col gap-2 hover:border-border transition-colors"
              style={{ background: "rgba(244,247,255,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: BLUE }} />
                <p className="text-foreground font-semibold text-sm leading-snug">{item.title}</p>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed pl-3">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function FrameworkTimeline() {
  return (
    <section className="py-24 bg-[#FFFFFF] border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={fadeUp}
          className="text-center mb-16"
        >
          <p className="text-xs font-mono uppercase tracking-[0.25em] mb-4" style={{ color: BLUE }}>
            Our Methodology
          </p>
          <h2
            className="font-display font-bold text-foreground leading-[1.1]"
            style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
          >
            AI Transformation Framework
          </h2>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Connecting line */}
          <div
            className="absolute top-8 left-0 right-0 h-px hidden lg:block"
            style={{ background: "linear-gradient(90deg, transparent, rgba(33,78,207,0.24) 15%, rgba(33,78,207,0.24) 85%, transparent)" }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
            {frameworkStages.map((stage, i) => (
              <motion.div
                key={stage.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                variants={fadeUp}
                transition={{ delay: i * 0.08 }}
                className="relative flex flex-col items-center text-center lg:items-center"
              >
                {/* Step node */}
                <div
                  className="relative z-10 w-16 h-16 rounded-2xl flex flex-col items-center justify-center mb-5 flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, rgba(33,78,207,0.12) 0%, rgba(33,78,207,0.08) 100%)",
                    border: "1px solid rgba(71,163,255,0.25)",
                    boxShadow: "0 0 20px rgba(33,78,207,0.09)",
                  }}
                >
                  <span className="text-[9px] font-mono font-bold" style={{ color: BLUE }}>{stage.step}</span>
                  <span className="text-xs font-bold text-foreground mt-0.5">{stage.label}</span>
                </div>

                <p className="text-muted-foreground text-xs leading-relaxed">{stage.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function IndustriesSection() {
  return (
    <section className="py-20 bg-background border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-12"
        >
          <p className="text-xs font-mono uppercase tracking-[0.25em] mb-4" style={{ color: BLUE }}>
            Industries We Serve
          </p>
          <h2
            className="font-display font-bold text-foreground"
            style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)" }}
          >
            Technology for Every Sector
          </h2>
        </motion.div>

        <div className="flex flex-wrap gap-3">
          {industries.map((ind, i) => (
            <motion.span
              key={ind}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ delay: i * 0.05 }}
              className="px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:border-[#DCE5FF] hover:text-foreground cursor-default"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "#4B5563",
              }}
            >
              {ind}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}

function EngagementModelsSection() {
  return (
    <section className="py-24 bg-[#FFFFFF] border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-14 text-center"
        >
          <p className="text-xs font-mono uppercase tracking-[0.25em] mb-4" style={{ color: BLUE }}>
            How We Work
          </p>
          <h2
            className="font-display font-bold text-foreground"
            style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)" }}
          >
            Engagement Models
          </h2>
          <p className="text-muted-foreground text-base mt-4 max-w-xl mx-auto leading-relaxed">
            We adapt to how you work — choose the model that fits your timeline, team, and objectives.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {engagementModels.map((model, i) => (
            <motion.div
              key={model.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={fadeUp}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -4, transition: { duration: 0.22 } }}
              className="rounded-2xl p-7 flex flex-col gap-4 cursor-default"
              style={{
                background: "rgba(244,247,255,0.8)",
                border: "1px solid rgba(33,78,207,0.06)",
              }}
            >
              <span className="text-2xl">{model.icon}</span>
              <div>
                <h3 className="font-display font-bold text-foreground text-lg mb-2">{model.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{model.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TechnologyPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-48 pb-24 overflow-hidden border-b border-border"
        style={{ background: "linear-gradient(160deg, #F5F8FF 0%, #F5F8FF 50%, #F5F8FF 100%)" }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#214ECF05_1px,transparent_1px),linear-gradient(to_bottom,#214ECF05_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 55% at 30% 0%, rgba(33,78,207,0.09) 0%, transparent 65%)" }}
        />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div
              className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border mb-8"
              style={{ background: "rgba(37,99,235,0.06)", borderColor: "rgba(33,78,207,0.18)" }}
            >
              <span className="text-[10px] font-mono tracking-[0.22em] uppercase" style={{ color: BLUE }}>
                Technology &amp; IT Services
              </span>
            </div>
            <h1
              className="font-display font-bold text-foreground leading-[1.05] mb-6"
              style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)" }}
            >
              Build Intelligent Digital<br />
              <span style={{ background: "linear-gradient(135deg,#214ECF 0%,#214ECF 60%,#2D5FE8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Products
              </span>{" "}
              That Solve Real<br />Business Problems.
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mb-10">
              Thinkatic's technology division builds intelligent digital products that solve real business problems — from custom AI systems and enterprise software to cloud infrastructure and data analytics.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/contact">
                <motion.button
                  whileHover={{ scale: 1.04, boxShadow: "0 0 32px rgba(37,99,235,0.5)" }}
                  whileTap={{ scale: 0.97 }}
                  className="px-8 py-4 rounded-full font-bold text-foreground text-sm tracking-wider"
                  style={{ background: "linear-gradient(135deg,#214ECF 0%,#214ECF 50%,#2D5FE8 100%)", boxShadow: "0 0 24px rgba(33,78,207,0.3)" }}
                >
                  Book a Consultation
                </motion.button>
              </Link>
              <Link href="/services">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-8 py-4 rounded-full font-bold text-sm tracking-wider transition-all hover:bg-white/8"
                  style={{ border: "1px solid rgba(33,78,207,0.18)", color: "#4B5563", background: "rgba(71,163,255,0.05)" }}
                >
                  Explore BPO Services →
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Intro strip */}
      <section className="py-14 bg-[#FFFFFF] border-b border-border">
        <div className="max-w-6xl mx-auto px-6">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-muted-foreground text-base leading-relaxed max-w-3xl"
          >
            Visually distinct from our BPO practice, our technology services share the same commitment: measurable outcomes. We don't build technology for its own sake — every system we ship maps to a real business problem.
          </motion.p>
        </div>
      </section>

      {/* Service pillars */}
      <section className="py-20 bg-[#FFFFFF]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col gap-8">
          {servicePillars.map((pillar, i) => (
            <ServicePillar key={pillar.id} pillar={pillar} index={i} />
          ))}
        </div>
      </section>

      {/* AI Transformation Framework */}
      <FrameworkTimeline />

      {/* Industries */}
      <IndustriesSection />

      {/* Engagement Models */}
      <EngagementModelsSection />

      {/* CTA */}
      <section className="py-32 bg-background border-t border-border relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(33,78,207,0.08) 0%, transparent 70%)" }}
        />
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-xs font-mono uppercase tracking-[0.25em] mb-6"
            style={{ color: BLUE }}
          >
            Ready to Build with AI?
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ delay: 0.05 }}
            className="font-display font-bold text-foreground leading-[1.05] mb-6"
            style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)" }}
          >
            Let's Build Smarter Business Together.
          </motion.h2>
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-lg leading-relaxed mb-10"
          >
            Scalable platforms, next-generation AI products, and world-class digital experiences that drive real business growth.
          </motion.p>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="px-8 py-4 rounded-full font-bold text-foreground text-sm tracking-wider"
                style={{ background: "linear-gradient(135deg, #214ECF 0%, #214ECF 100%)", boxShadow: "0 0 30px rgba(71,163,255,0.25)" }}
              >
                START YOUR PROJECT
              </motion.button>
            </Link>
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="px-8 py-4 rounded-full font-bold text-sm tracking-wider transition-all hover:bg-white/10"
                style={{ border: "1px solid rgba(33,78,207,0.12)", color: "rgba(255,255,255,0.65)" }}
              >
                BOOK A CONSULTATION
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
