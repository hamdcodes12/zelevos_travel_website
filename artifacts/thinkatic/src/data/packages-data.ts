// Thinkatic Enterprise Technology Transformation Service Packages & Pricing Catalog

export interface EnterprisePlan {
  id: string;
  category: "ai-automation" | "cloud-modernization" | "cybersecurity" | "data" | "product-engineering" | "managed-services";
  categoryLabel: string;
  planNumber: string;
  name: string;
  startingPriceFormatted: string;
  priceNumeric: number;
  billingPeriod?: "one-time" | "monthly";
  tag?: string;
  isPopular?: boolean;
  isFlagship?: boolean;
  shortPositioning: string;
  idealCustomer: string;
  keyOutcomes: string[];
  includes: string[];
  ctaLabel: string;
  ctaRoute?: string;
}

export interface ServiceCategoryMeta {
  id: EnterprisePlan["category"];
  title: string;
  shortTitle: string;
  badge: string;
  description: string;
  iconName: string;
}

export const SERVICE_CATEGORIES: ServiceCategoryMeta[] = [
  {
    id: "ai-automation",
    title: "AI & Automation",
    shortTitle: "AI & Automation",
    badge: "Intelligent Systems",
    description: "From targeted AI workflow launches to full enterprise-scale multi-agent autonomous ecosystems.",
    iconName: "Bot",
  },
  {
    id: "cloud-modernization",
    title: "Cloud & Modernization",
    shortTitle: "Cloud & Infra",
    badge: "Cloud-Native Scale",
    description: "Architecting resilient multi-cloud foundations, microservices transitions, and legacy modernization.",
    iconName: "Cloud",
  },
  {
    id: "cybersecurity",
    title: "Cybersecurity",
    shortTitle: "Cybersecurity",
    badge: "Zero Trust Defense",
    description: "Enterprise threat mitigation, Zero Trust architectures, and specialized defense for generative AI pipelines.",
    iconName: "ShieldCheck",
  },
  {
    id: "data",
    title: "Data & Analytics",
    shortTitle: "Data & BI",
    badge: "Data Intelligence",
    description: "Modern data warehouses, real-time streaming lakehouses, and AI-ready data infrastructure.",
    iconName: "Database",
  },
  {
    id: "product-engineering",
    title: "Product Engineering",
    shortTitle: "Engineering",
    badge: "Mission-Critical Systems",
    description: "Production-grade digital products and large-scale software platforms engineered with dedicated teams.",
    iconName: "Cpu",
  },
  {
    id: "managed-services",
    title: "Managed Services",
    shortTitle: "Managed Ops",
    badge: "24/7 Operations",
    description: "Around-the-clock operational governance, proactive optimization, and continuous SLA guarantees.",
    iconName: "Activity",
  },
];

export const ENTERPRISE_PLANS: EnterprisePlan[] = [
  // ─── A. AI & AUTOMATION ───────────────────────────────────────────────────────
  {
    id: "ai-starter",
    category: "ai-automation",
    categoryLabel: "AI & Automation",
    planNumber: "PLAN 01",
    name: "AI Starter",
    startingPriceFormatted: "$999",
    priceNumeric: 999,
    billingPeriod: "one-time",
    tag: "Essential",
    isFlagship: true,
    shortPositioning: "A practical AI chatbot solution for businesses starting their AI journey.",
    idealCustomer: "Businesses looking for website FAQ automation and lead capture.",
    keyOutcomes: [
      "Rapid AI chatbot deployment in 7–10 days",
      "Company knowledge base and FAQ automation",
      "Lead collection and conversation analytics",
      "Email notifications on customer inquiries",
    ],
    includes: [
      "Website AI chatbot",
      "Company knowledge base",
      "FAQ automation",
      "Lead collection",
      "Basic conversation flows",
      "Email notifications",
      "Analytics",
      "Deployment",
    ],
    ctaLabel: "Start with AI Starter",
    ctaRoute: "/contact?service=ai-starter",
  },
  {
    id: "ai-business",
    category: "ai-automation",
    categoryLabel: "AI & Automation",
    planNumber: "PLAN 02",
    name: "AI Business",
    startingPriceFormatted: "$2,499",
    priceNumeric: 2499,
    billingPeriod: "one-time",
    tag: "Most Popular",
    isPopular: true,
    isFlagship: true,
    shortPositioning: "Advanced AI agent capabilities with document integration and multi-channel workflows.",
    idealCustomer: "Growing businesses with CRM, WhatsApp, and appointment booking automation needs.",
    keyOutcomes: [
      "Deep document and knowledge-base integration",
      "Automated lead qualification and appointment scheduling",
      "Bidirectional CRM and WhatsApp integrations",
      "End-to-end conversation analytics",
    ],
    includes: [
      "Everything in AI Starter",
      "Advanced AI agent",
      "Document/knowledge-base integration",
      "Lead qualification",
      "Appointment booking",
      "CRM integration",
      "WhatsApp integration",
      "Email integration",
      "Conversation analytics",
      "Custom business workflows",
    ],
    ctaLabel: "Explore AI Business",
    ctaRoute: "/contact?service=ai-business",
  },
  {
    id: "ai-enterprise",
    category: "ai-automation",
    categoryLabel: "AI & Automation",
    planNumber: "PLAN 03",
    name: "AI Enterprise",
    startingPriceFormatted: "From $5,000+",
    priceNumeric: 5000,
    billingPeriod: "one-time",
    tag: "Enterprise Scale",
    shortPositioning: "Multiple AI agents, Voice AI, CRM/ERP integrations, and customer-support automation.",
    idealCustomer: "Enterprises requiring complex multi-agent architectures, voice AI, and custom integrations.",
    keyOutcomes: [
      "Multiple coordinated AI agents and Voice AI integration",
      "Customer-support and sales workflow automation",
      "Enterprise CRM/ERP integration and admin dashboard",
      "Human handoff protocols and continuous monitoring",
    ],
    includes: [
      "Multiple AI agents",
      "Voice AI",
      "Customer-support automation",
      "Sales automation",
      "CRM/ERP integration",
      "Custom APIs",
      "Advanced workflows",
      "Admin dashboard",
      "Human handoff",
      "Monitoring",
      "Ongoing optimization",
    ],
    ctaLabel: "Discuss Enterprise AI",
    ctaRoute: "/contact?service=ai-enterprise",
  },

  // ─── B. CLOUD & MODERNIZATION ────────────────────────────────────────────────
  {
    id: "cloud-modernization",
    category: "cloud-modernization",
    categoryLabel: "Cloud & Modernization",
    planNumber: "PLAN 04",
    name: "Cloud Modernization",
    startingPriceFormatted: "$100,000",
    priceNumeric: 100000,
    billingPeriod: "one-time",
    tag: "Infrastructure Scale",
    shortPositioning: "Migrate, re-architect, and optimize infrastructure across AWS, Azure, and Google Cloud.",
    idealCustomer: "Organizations transitioning from legacy on-prem or optimizing multi-cloud environments.",
    keyOutcomes: [
      "Resilient cloud-native architecture backed by 99.99% uptime guarantees",
      "Modern CI/CD and infrastructure-as-code accelerating shipping velocity",
      "Comprehensive cloud security hardening and cost optimization",
      "Automated multi-region disaster recovery and failover pipelines",
    ],
    includes: [
      "Infrastructure assessment",
      "Cloud strategy",
      "AWS / Azure / Google Cloud architecture",
      "Application migration",
      "Database migration",
      "API modernization",
      "DevOps implementation",
      "CI/CD",
      "Infrastructure automation",
      "Security hardening",
      "Monitoring",
      "Disaster recovery",
      "Performance optimization",
    ],
    ctaLabel: "Modernize Our Infrastructure",
    ctaRoute: "/contact?plan=cloud-modernization",
  },
  {
    id: "legacy-transformation",
    category: "cloud-modernization",
    categoryLabel: "Cloud & Modernization",
    planNumber: "PLAN 05",
    name: "Legacy Transformation",
    startingPriceFormatted: "$150,000",
    priceNumeric: 150000,
    billingPeriod: "one-time",
    tag: "System Modernization",
    shortPositioning: "Deconstruct monoliths, modernize legacy codebases, and eliminate critical technical debt.",
    idealCustomer: "Enterprises whose agility and scale are bottlenecked by dated core systems.",
    keyOutcomes: [
      "Zero-downtime transition from legacy monoliths to modular microservices",
      "Modernized responsive UI/UX and high-performance database tier",
      "Full API enablement connecting legacy data with modern digital tools",
      "Comprehensive knowledge transfer and long-term maintainability",
    ],
    includes: [
      "Legacy application audit",
      "Architecture redesign",
      "Code modernization",
      "Database modernization",
      "API development",
      "Cloud migration",
      "UI modernization",
      "Testing automation",
      "Security modernization",
      "AI integration",
      "Deployment",
      "Knowledge transfer",
      "Long-term support",
    ],
    ctaLabel: "Modernize Our Technology",
    ctaRoute: "/contact?plan=legacy-transformation",
  },
  {
    id: "enterprise-transformation",
    category: "cloud-modernization",
    categoryLabel: "Cloud & Modernization",
    planNumber: "PLAN 06",
    name: "Enterprise Transformation",
    startingPriceFormatted: "$300,000+",
    priceNumeric: 300000,
    billingPeriod: "one-time",
    tag: "Flagship Strategic Engagement",
    isFlagship: true,
    shortPositioning: "For organizations requiring a complete technology transformation.",
    idealCustomer: "Enterprises seeking a single, strategic transformation partner across all technology layers.",
    keyOutcomes: [
      "Holistic reinvention across cloud, AI, data platforms, and cybersecurity",
      "Dedicated multi-disciplinary transformation squad embedded for 12 months",
      "Elimination of siloed systems and radical acceleration of digital agility",
      "Milestone-based delivery aligned with board-level enterprise objectives",
    ],
    includes: [
      "Technology assessment",
      "Digital transformation strategy",
      "Legacy modernization",
      "Cloud transformation",
      "AI implementation",
      "Data modernization",
      "Cybersecurity",
      "Enterprise integrations",
      "DevOps",
      "Custom software engineering",
      "Technology governance",
      "Dedicated transformation team",
      "12-month roadmap",
    ],
    ctaLabel: "Plan Our Transformation",
    ctaRoute: "/contact?plan=enterprise-transformation",
  },

  // ─── C. CYBERSECURITY ────────────────────────────────────────────────────────
  {
    id: "cybersecurity-foundation",
    category: "cybersecurity",
    categoryLabel: "Cybersecurity",
    planNumber: "PLAN 07",
    name: "Cybersecurity Foundation",
    startingPriceFormatted: "$50,000",
    priceNumeric: 50000,
    billingPeriod: "one-time",
    tag: "Essential Defense",
    shortPositioning: "Establish formal enterprise security controls, IAM, and risk mitigation baseline.",
    idealCustomer: "Mid-market businesses needing formal compliance baselines and security audits.",
    keyOutcomes: [
      "Identification and structured remediation of critical vulnerability gaps",
      "Hardened IAM, cloud posture, and endpoint security perimeter",
      "Executive risk assessment and multi-quarter security roadmap",
      "Audit preparation for SOC 2, HIPAA, and ISO 27001 compliance",
    ],
    includes: [
      "Security assessment",
      "Vulnerability assessment",
      "IAM",
      "Endpoint security",
      "Network security",
      "Cloud security",
      "Security policies",
      "Risk assessment",
      "Security roadmap",
    ],
    ctaLabel: "Secure Our Baseline",
    ctaRoute: "/contact?plan=cybersecurity-foundation",
  },
  {
    id: "enterprise-security",
    category: "cybersecurity",
    categoryLabel: "Cybersecurity",
    planNumber: "PLAN 08",
    name: "Enterprise Security",
    startingPriceFormatted: "$125,000",
    priceNumeric: 125000,
    billingPeriod: "one-time",
    tag: "Zero Trust Architecture",
    shortPositioning: "Implement complete Zero Trust architecture, SIEM integration, and incident response.",
    idealCustomer: "Regulated enterprises requiring end-to-end security orchestration and continuous protection.",
    keyOutcomes: [
      "Validated Zero Trust architecture enforced across users, devices, and cloud",
      "Centralized SIEM telemetry with automated threat containment workflows",
      "Comprehensive incident response playbooks and security automation",
      "Continuous compliance support for strict regulatory frameworks",
    ],
    includes: [
      "Zero Trust architecture",
      "Cloud security",
      "Identity & access management",
      "SIEM",
      "Security monitoring",
      "Vulnerability management",
      "Incident response",
      "Security automation",
      "Compliance support",
      "Security operations",
    ],
    ctaLabel: "Architect Zero Trust",
    ctaRoute: "/contact?plan=enterprise-security",
  },
  {
    id: "ai-security",
    category: "cybersecurity",
    categoryLabel: "Cybersecurity",
    planNumber: "PLAN 09",
    name: "AI Security",
    startingPriceFormatted: "$100,000",
    priceNumeric: 100000,
    billingPeriod: "one-time",
    tag: "LLM & GenAI Defense",
    shortPositioning: "Harden LLMs, agents, and generative systems against prompt injection and data leaks.",
    idealCustomer: "Enterprises deploying AI assistants, RAG pipelines, or autonomous agent frameworks.",
    keyOutcomes: [
      "Defense against prompt injection, model jailbreaking, and data poisoning",
      "Strict data-leakage prevention ensuring proprietary enterprise data remains safe",
      "Granular AI model access controls, telemetry, and output auditing",
      "Enterprise AI security architecture aligned with NIST AI RMF",
    ],
    includes: [
      "AI security assessment",
      "LLM security",
      "Data-leakage prevention",
      "Prompt-injection protection",
      "AI access controls",
      "Model security",
      "AI monitoring",
      "AI governance",
      "Security testing",
      "Enterprise AI security architecture",
    ],
    ctaLabel: "Protect Our AI Systems",
    ctaRoute: "/contact?plan=ai-security",
  },

  // ─── D. DATA & ANALYTICS ──────────────────────────────────────────────────────
  {
    id: "data-foundation",
    category: "data",
    categoryLabel: "Data & Analytics",
    planNumber: "PLAN 10",
    name: "Data Foundation",
    startingPriceFormatted: "$75,000",
    priceNumeric: 75000,
    billingPeriod: "one-time",
    tag: "Single Source of Truth",
    shortPositioning: "Unify fragmented data sources into a modern data warehouse with automated ETL.",
    idealCustomer: "Organizations struggling with siloed business data and manual reporting cycles.",
    keyOutcomes: [
      "Automated ETL/ELT pipelines replacing manual reporting spreadsheets",
      "Centralized cloud data warehouse providing accurate single source of truth",
      "Executive and operational BI dashboards updating in real time",
      "Data validation rules ensuring high integrity and reliability",
    ],
    includes: [
      "Data architecture",
      "Data warehouse",
      "Data pipelines",
      "ETL/ELT",
      "Data integration",
      "Data quality",
      "Business dashboards",
      "Reporting",
    ],
    ctaLabel: "Build Our Data Foundation",
    ctaRoute: "/contact?plan=data-foundation",
  },
  {
    id: "enterprise-data-platform",
    category: "data",
    categoryLabel: "Data & Analytics",
    planNumber: "PLAN 11",
    name: "Enterprise Data Platform",
    startingPriceFormatted: "$150,000",
    priceNumeric: 150000,
    billingPeriod: "one-time",
    tag: "Lakehouse & Real-Time",
    shortPositioning: "Build an AI-ready data lakehouse capable of real-time analytics and predictive ML pipelines.",
    idealCustomer: "Enterprises with high data velocity, complex governance, or advanced analytics needs.",
    keyOutcomes: [
      "Scalable lakehouse architecture processing real-time streaming data",
      "AI-ready data pipelines and feature stores ready for predictive ML",
      "Enterprise data governance and automated access policy enforcement",
      "High-throughput query performance across terabyte-to-petabyte datasets",
    ],
    includes: [
      "Data lake/lakehouse",
      "Real-time data",
      "Enterprise data warehouse",
      "Data governance",
      "Data engineering",
      "Advanced analytics",
      "BI",
      "AI-ready data architecture",
      "Cloud data infrastructure",
    ],
    ctaLabel: "Engineer Our Data Platform",
    ctaRoute: "/contact?plan=enterprise-data-platform",
  },

  // ─── E. PRODUCT ENGINEERING ──────────────────────────────────────────────────
  {
    id: "digital-product-development",
    category: "product-engineering",
    categoryLabel: "Product Engineering",
    planNumber: "PLAN 12",
    name: "Digital Product Development",
    startingPriceFormatted: "$50,000",
    priceNumeric: 50000,
    billingPeriod: "one-time",
    tag: "Full-Lifecycle Build",
    shortPositioning: "Engineer mission-critical digital products from architecture through production deployment.",
    idealCustomer: "Companies launching new SaaS platforms, mobile applications, or digital portals.",
    keyOutcomes: [
      "Modern, responsive web and mobile digital application with intuitive UX",
      "Scalable, documented backend APIs with automated CI/CD and QA",
      "Cloud-native deployment ready for rapid enterprise user adoption",
      "Robust security architecture and automated test coverage",
    ],
    includes: [
      "Product strategy",
      "UX/UI",
      "Architecture",
      "Web application",
      "Mobile application",
      "Backend",
      "APIs",
      "Cloud infrastructure",
      "QA",
      "Security",
      "Deployment",
    ],
    ctaLabel: "Build Our Digital Product",
    ctaRoute: "/contact?plan=digital-product-development",
  },
  {
    id: "enterprise-product-engineering",
    category: "product-engineering",
    categoryLabel: "Product Engineering",
    planNumber: "PLAN 13",
    name: "Enterprise Product Engineering",
    startingPriceFormatted: "$150,000",
    priceNumeric: 150000,
    billingPeriod: "one-time",
    tag: "Dedicated Squad",
    shortPositioning: "Deploy a dedicated senior engineering team to architect and build complex systems.",
    idealCustomer: "Enterprises requiring sustained, high-velocity engineering for multi-tiered platforms.",
    keyOutcomes: [
      "Dedicated multi-disciplinary engineering squad integrated with internal teams",
      "Enterprise API ecosystem bridging modern and core legacy platforms",
      "Native AI integration, microservices architecture, and DevOps automation",
      "Automated QA framework guaranteeing 99.9% release stability",
    ],
    includes: [
      "Product discovery",
      "Enterprise architecture",
      "UX/UI",
      "Web & mobile",
      "Backend systems",
      "API ecosystem",
      "Cloud",
      "Data",
      "AI integration",
      "Cybersecurity",
      "DevOps",
      "QA automation",
      "Dedicated engineering team",
    ],
    ctaLabel: "Assemble Engineering Team",
    ctaRoute: "/contact?plan=enterprise-product-engineering",
  },

  // ─── F. MANAGED SERVICES ─────────────────────────────────────────────────────
  {
    id: "managed-ai",
    category: "managed-services",
    categoryLabel: "Managed Services",
    planNumber: "PLAN 14",
    name: "Managed AI",
    startingPriceFormatted: "$10,000/month",
    priceNumeric: 10000,
    billingPeriod: "monthly",
    tag: "Continuous AI Ops",
    shortPositioning: "Ongoing AI agent optimization, model management, infrastructure, and latency monitoring.",
    idealCustomer: "Organizations operating production AI systems that require continuous oversight.",
    keyOutcomes: [
      "Guaranteed model accuracy, latency SLAs, and automated drift detection",
      "Compute cost optimization preventing token overspend and latency spikes",
      "Immediate incident triage and automated fallback model routing",
      "Continuous prompt enhancements and model version upgrades",
    ],
    includes: [
      "AI monitoring",
      "Agent optimization",
      "Model management",
      "AI infrastructure",
      "Performance monitoring",
      "Security monitoring",
      "Continuous improvements",
      "Support",
    ],
    ctaLabel: "Manage Our AI Operations",
    ctaRoute: "/contact?plan=managed-ai",
  },
  {
    id: "managed-cloud",
    category: "managed-services",
    categoryLabel: "Managed Services",
    planNumber: "PLAN 15",
    name: "Managed Cloud",
    startingPriceFormatted: "$10,000/month",
    priceNumeric: 10000,
    billingPeriod: "monthly",
    tag: "24/7 Cloud Operations",
    shortPositioning: "24/7 cloud monitoring, infrastructure management, disaster recovery, and cost governance.",
    idealCustomer: "Enterprises wanting SLA-backed cloud operations without expanding internal headcount.",
    keyOutcomes: [
      "24/7 cloud surveillance with 99.99% uptime SLA commitments",
      "20–35% average reduction in monthly cloud infrastructure spend",
      "Automated daily backups and validated disaster recovery failover",
      "Proactive security patching and automated DevOps pipelines",
    ],
    includes: [
      "Cloud monitoring",
      "Infrastructure management",
      "DevOps",
      "Security",
      "Backup",
      "Disaster recovery",
      "Cost optimization",
      "24/7 monitoring",
    ],
    ctaLabel: "Operate Our Cloud",
    ctaRoute: "/contact?plan=managed-cloud",
  },
  {
    id: "managed-cybersecurity",
    category: "managed-services",
    categoryLabel: "Managed Services",
    planNumber: "PLAN 16",
    name: "Managed Cybersecurity",
    startingPriceFormatted: "$15,000/month",
    priceNumeric: 15000,
    billingPeriod: "monthly",
    tag: "SOC & Threat Hunting",
    shortPositioning: "Continuous security monitoring, threat detection, vulnerability management, and incident response.",
    idealCustomer: "Enterprises demanding continuous SOC surveillance and dedicated security operations.",
    keyOutcomes: [
      "Round-the-clock threat detection with sub-15 minute triage SLA",
      "Proactive vulnerability management across all endpoints and cloud",
      "Rapid incident containment and digital forensics readiness",
      "Monthly executive security posture and compliance scorecards",
    ],
    includes: [
      "Security monitoring",
      "Threat detection",
      "Vulnerability management",
      "Incident response",
      "Security reporting",
      "Security operations",
      "Continuous risk assessment",
    ],
    ctaLabel: "Activate 24/7 Security",
    ctaRoute: "/contact?plan=managed-cybersecurity",
  },
];

// ─── 3 Flagship Engagements for Homepage ─────────────────────────────────────
export const FLAGSHIP_ENGAGEMENTS: EnterprisePlan[] = [
  ENTERPRISE_PLANS.find((p) => p.id === "ai-starter") || ENTERPRISE_PLANS[0],
  ENTERPRISE_PLANS.find((p) => p.id === "ai-business") || ENTERPRISE_PLANS[1],
  ENTERPRISE_PLANS.find((p) => p.id === "ai-enterprise") || ENTERPRISE_PLANS[2],
];

// ─── ScaleOS BPO partnership plans ──────────────────────────────────────────
export interface BPOPlan {
  id: string;
  name: "Starter" | "Growth" | "Enterprise";
  priceFormatted: string;
  priceNumeric: number;
  seatRange: string;
  partnershipTerm: string;
  isPopular?: boolean;
  includes: string[];
  featureGroups: { title: string; items: string[] }[];
  portfolioAccess: string;
}

const STARTER_BPO_FEATURE_GROUPS = [
  { title: "Build", items: ["Process discovery", "Process mapping", "SOP creation", "Workflow design", "Outsourcing roadmap"] },
  { title: "Build the Team", items: ["BPO partner allocation", "Recruitment coordination", "Candidate screening support", "Agent onboarding", "Training coordination"] },
  { title: "Build the Operation", items: ["CRM / workflow setup", "Basic technology configuration", "KPI framework", "QA framework", "Reporting structure & escalation matrix"] },
  { title: "Launch", items: ["Go-live support", "Initial performance monitoring", "Process stabilization", "Monthly performance review"] },
];

const GROWTH_BPO_FEATURE_GROUPS = [
  ...STARTER_BPO_FEATURE_GROUPS,
  { title: "Advanced Operations", items: ["Dedicated account manager", "Advanced SOPs", "Detailed workforce planning", "Multi-level escalation system", "Advanced QA framework", "Weekly performance reporting"] },
  { title: "Technology", items: ["Advanced CRM / workflow configuration", "Automated reporting", "Productivity dashboards", "Performance analytics", "Call / chat QA integration"] },
  { title: "People", items: ["Structured recruitment pipeline", "Training framework", "Mock-process assessment", "Replacement coordination", "Attrition management support"] },
  { title: "Growth", items: ["Capacity planning", "Additional seat deployment", "Process optimization", "Monthly strategy review", "Expansion support"] },
];

const ENTERPRISE_BPO_FEATURE_GROUPS = [
  ...GROWTH_BPO_FEATURE_GROUPS,
  { title: "Enterprise Implementation", items: ["Multi-process implementation", "Multi-team, multi-shift deployment", "Large-scale workforce planning", "Enterprise SOP architecture", "Department-level KPI framework"] },
  { title: "Technology & Analytics", items: ["Enterprise reporting & dashboards", "Workflow automation", "AI-assisted QA where applicable", "Performance analytics", "Integration support"] },
  { title: "Enterprise Management", items: ["Dedicated enterprise account team", "Priority escalation", "Monthly business reviews", "Capacity & workforce optimization", "Scale-up support"] },
  { title: "Lifetime Strategic Support", items: ["Process & outsourcing advisory", "BPO partner coordination", "Expansion discussions", "Technology guidance", "Operational troubleshooting", "Lifetime Strategic Support"] },
];

const flattenBPOFeatures = (groups: { title: string; items: string[] }[]) => groups.flatMap((group) => group.items);
const BPO_PORTFOLIO_ACCESS = "Access to the available project portfolio according to the existing system.";

export const BPO_PLANS: BPOPlan[] = [
  {
    id: "bpo-agent",
    name: "Customer Support Agent" as any,
    priceFormatted: "$699–$1,199/agent/month",
    priceNumeric: 699,
    seatRange: "1 dedicated agent",
    partnershipTerm: "Monthly ongoing",
    includes: [
      "Email support",
      "Chat support",
      "Ticket management",
      "Customer queries",
      "Basic reporting",
      "Defined working hours",
    ],
    featureGroups: [
      {
        title: "Agent Scope",
        items: [
          "Email support",
          "Chat support",
          "Ticket management",
          "Customer queries",
          "Basic reporting",
          "Defined working hours",
        ],
      },
    ],
    portfolioAccess: "Dedicated agent allocated with monitored delivery SLA.",
  },
  {
    id: "bpo-premium-support",
    name: "Premium Support" as any,
    priceFormatted: "$1,200–$1,800/agent/month",
    priceNumeric: 1200,
    seatRange: "1 senior agent + supervisor",
    partnershipTerm: "Monthly ongoing",
    isPopular: true,
    includes: [
      "Voice + chat + email",
      "CRM management",
      "Escalation management",
      "Quality monitoring",
      "Reporting",
      "Dedicated supervisor",
    ],
    featureGroups: [
      {
        title: "Omnichannel Scope",
        items: [
          "Voice + chat + email",
          "CRM management",
          "Escalation management",
          "Quality monitoring",
          "Reporting",
          "Dedicated supervisor",
        ],
      },
    ],
    portfolioAccess: "Senior agent and supervisor oversight with custom SLA adherence.",
  },
  {
    id: "bpo-team",
    name: "BPO Team" as any,
    priceFormatted: "Custom Pricing",
    priceNumeric: 0,
    seatRange: "5+ agents pod",
    partnershipTerm: "SLA-based delivery",
    includes: [
      "5+ agents",
      "Team leader",
      "QA",
      "Operations manager",
      "Performance dashboard",
      "SLA-based delivery",
    ],
    featureGroups: [
      {
        title: "Turnkey Squad",
        items: [
          "5+ agents",
          "Team leader",
          "QA",
          "Operations manager",
          "Performance dashboard",
          "SLA-based delivery",
        ],
      },
    ],
    portfolioAccess: "Complete managed pod with Team Leader, QA, and Operations Manager.",
  },
];

// ─── Legacy compatibility exports so existing imports don't crash ────────────
export type AIPackage = EnterprisePlan;
export type ScaleOSTier = EnterprisePlan;
export interface CatalogOverviewItem {
  id: number;
  package: string;
  isBestOverall?: boolean;
  coreService: string;
  setupPrice: string;
  monthlyPrice: string;
  bestFor: string;
}
export interface EngagementTier {
  id: string;
  name: string;
  startingPrice: string;
  description: string;
  isPopular?: boolean;
}
export interface PortfolioProject {
  id: number;
  project: string;
  region: "USA" | "UK" | "INDIA";
  payout: string;
  cycle: string;
  typeNotes: string;
}
export interface ScaleOSComparisonRow {
  feature: string;
  starter: string;
  growth: string;
  enterprise: string;
  isCheckmark?: boolean;
}
export interface AlternativeComparisonRow {
  traditional: string;
  scaleOS: string;
}

export const AI_PACKAGES = ENTERPRISE_PLANS;
export const AI_ENGAGEMENT_TIERS: EngagementTier[] = [
  { id: "ai-starter", name: "AI Starter", startingPrice: "$999", description: "Website AI chatbot with company knowledge base" },
  { id: "ai-business", name: "AI Business", startingPrice: "$2,499", description: "Advanced AI agent with CRM and document integration", isPopular: true },
  { id: "ai-enterprise", name: "AI Enterprise", startingPrice: "From $5,000+", description: "Multiple AI agents, Voice AI, and custom integrations" },
];
export const AI_CATALOG_OVERVIEW: CatalogOverviewItem[] = [];
export const SCALEOS_OVERVIEW = { title: "Enterprise Technology Architecture" };
export const SCALEOS_TIERS: EnterprisePlan[] = [];
export const SCALEOS_MATRIX: ScaleOSComparisonRow[] = [];
export const PORTFOLIO_PROJECTS: PortfolioProject[] = [];
export const ALTERNATIVE_COMPARISON: AlternativeComparisonRow[] = [];
