export const BLUE = "#214ECF";
export const BLUE_DIM = "rgba(33,78,207,0.1)";
export const BLUE_BORDER = "rgba(33,78,207,0.14)";

export type ServiceCategoryType = 
  | "ai-automation"
  | "cloud-modernization"
  | "cybersecurity"
  | "data"
  | "product-engineering"
  | "managed-services";

export type ServiceItem = {
  id: string;
  number: string;
  category: ServiceCategoryType;
  categoryLabel: string;
  title: string;
  tagline: string;
  startingPrice: string;
  description: string;
  whatWeBuild: { title: string; desc: string }[];
  process?: string[];
  technologies?: string[];
  whyUs?: string[];
  benefits?: string[];
  industries?: string[];
  principles?: string[];
  fullServices?: string[];
  trustBadges?: { icon: string; label: string; description: string }[];
  icon: string;
};

export const services: ServiceItem[] = [
  // ─── A. AI & AUTOMATION ───────────────────────────────────────────────────────
  {
    id: "ai-launch",
    number: "01",
    category: "ai-automation",
    categoryLabel: "AI & Automation",
    startingPrice: "Starting at $25,000",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    title: "AI Launch",
    tagline: "Targeted Operational AI Deployment in 30 Days",
    description:
      "Designed for enterprises and mid-market organizations ready to introduce production AI into one high-leverage business function. We deliver an end-to-end AI workflow, enterprise RAG knowledge engine, and robust security baseline with validated ROI within 30 days.",
    whatWeBuild: [
      { title: "AI Readiness Assessment", desc: "Comprehensive audit of your data, infrastructure, and workflows to pinpoint the highest-impact AI insertion point." },
      { title: "Production AI Workflow", desc: "Automate an operational business process with custom prompt orchestration and human-in-the-loop validation." },
      { title: "Enterprise RAG Knowledge Base", desc: "Secure retrieval-augmented generation engine grounded strictly in your proprietary documentation." },
      { title: "Business System Integration", desc: "Seamless bidirectional connectors to your CRM, ERP, messaging, and operational databases." },
      { title: "Executive Analytics Dashboard", desc: "Real-time visibility into agent execution metrics, response times, and token cost economics." },
      { title: "Security Baseline Hardening", desc: "Isolated environment with strict data boundaries, prompt guardrails, and role-based access." },
    ],
    process: ["Readiness Assessment", "Roadmap & Architecture", "Workflow Development", "RAG Ingestion", "Security Hardening", "Deployment & 30-Day Support"],
    technologies: ["OpenAI", "Anthropic", "LangChain", "LlamaIndex", "Pinecone", "pgvector", "Python", "FastAPI", "React", "AWS"],
    whyUs: ["30-day speed to production", "Strict enterprise data isolation", "Clear ROI measurement", "Dedicated AI engineering support"],
    benefits: ["Eliminate 100s of manual task hours", "Zero hallucinations via RAG", "Defensible data boundary", "Immediate organizational momentum"],
    industries: ["Healthcare", "Financial Services", "Supply Chain", "B2B SaaS", "Professional Services"],
  },
  {
    id: "ai-transformation",
    number: "02",
    category: "ai-automation",
    categoryLabel: "AI & Automation",
    startingPrice: "Starting at $75,000",
    icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2",
    title: "AI Transformation",
    tagline: "Cross-Functional AI Automation & Internal Copilot",
    description:
      "For growing US businesses looking to automate multiple business processes with AI. We deploy 3 to 5 multi-agent workflows, integrate deep CRM/ERP connections, build an internal AI copilot, and establish an enterprise-wide AI governance framework.",
    whatWeBuild: [
      { title: "3–5 Autonomous AI Workflows", desc: "Automate customer support triage, sales lead enrichment, contract analysis, and operational reporting." },
      { title: "Internal Enterprise Copilot", desc: "Role-aware AI assistant empowering staff with instant access to company knowledge and automations." },
      { title: "Deep CRM & ERP Integrations", desc: "Bidirectional sync with Salesforce, HubSpot, SAP, NetSuite, and custom relational backends." },
      { title: "Document Intelligence Pipeline", desc: "Automated OCR, semantic extraction, and structured classification for invoices, claims, and PDFs." },
      { title: "AI Governance & RBAC Framework", desc: "Comprehensive audit logs, approval checkpoints, data residency controls, and compliance monitoring." },
      { title: "Production Infrastructure & Scale", desc: "High-throughput cloud architecture with automatic fallbacks, rate limiting, and caching." },
    ],
    process: ["Enterprise Process Discovery", "Copilot & Agent Architecture", "Model Fine-Tuning & Integration", "Governance Implementation", "Departmental Rollout", "90 Days Optimization"],
    technologies: ["GPT-4o", "Claude 3.5 Sonnet", "CrewAI", "LangGraph", "Docker", "Kubernetes", "Redis", "PostgreSQL", "Snowflake", "Azure AI"],
    whyUs: ["Comprehensive multi-department footprint", "Enterprise-grade governance", "90 days of iterative tuning", "Tangible operational cost reduction"],
    benefits: ["Up to 40% reduction in cycle times", "Accelerate sales response under 2 minutes", "Audit-proof AI governance", "Empowered internal teams"],
    industries: ["Fintech", "Logistics", "Healthcare", "Legal & Compliance", "Insurance"],
  },
  {
    id: "enterprise-ai",
    number: "03",
    category: "ai-automation",
    categoryLabel: "AI & Automation",
    startingPrice: "Starting at $150,000",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    title: "Enterprise AI",
    tagline: "Private Sovereign AI Environment & Multi-Agent Systems",
    description:
      "Engineered for large enterprises with complex regulatory, data privacy, and infrastructural environments. We architect private on-premise or sovereign cloud AI clusters, multi-agent autonomous swarms, continuous evaluation pipelines, and assign a dedicated senior AI engineering squad for 6 months.",
    whatWeBuild: [
      { title: "Private Sovereign AI Environment", desc: "Self-hosted or VPC-isolated LLM deployments guaranteeing zero data egress or third-party training." },
      { title: "Multi-Agent Autonomous Ecosystem", desc: "Coordinated agent architectures with specialized reasoning, planning, tool-calling, and verification loops." },
      { title: "Enterprise RAG with Graph Search", desc: "Hybrid vector and knowledge graph retrieval delivering pin-point accuracy across millions of documents." },
      { title: "Continuous Model Evaluation & CI/CD", desc: "Automated test suites for drift detection, hallucination scoring, regression testing, and fine-tuning." },
      { title: "Compliance-Ready Security Architecture", desc: "HIPAA, SOC 2 Type II, ISO 27001, and NIST AI RMF certified deployment blueprints." },
      { title: "Dedicated Engineering Squad", desc: "Embedded principal AI architects, ML engineers, and full-stack integration specialists for 6 months." },
    ],
    process: ["Enterprise AI Blueprint", "Sovereign Infrastructure Provisioning", "Multi-Agent System Orchestration", "Data Pipeline Engineering", "Red Teaming & Security Validation", "6 Months Production Optimization"],
    technologies: ["vLLM", "Ollama", "Triton", "NVIDIA NeMo", "LangGraph", "Weaviate", "AWS Bedrock", "Azure OpenAI", "Kubernetes", "Kafka"],
    whyUs: ["Complete data sovereignty", "Principal-level engineering caliber", "Mission-critical reliability", "6-month embedded partnership"],
    benefits: ["Zero external data transmission", "Autonomous operations at enterprise scale", "Measurable millions in annual savings", "Future-proof proprietary IP"],
    industries: ["Aerospace & Defense", "Healthcare & Life Sciences", "Banking & Capital Markets", "Government & Public Sector", "Telecommunications"],
  },

  // ─── B. CLOUD & MODERNIZATION ────────────────────────────────────────────────
  {
    id: "cloud-modernization",
    number: "04",
    category: "cloud-modernization",
    categoryLabel: "Cloud & Modernization",
    startingPrice: "Starting at $100,000",
    icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z",
    title: "Cloud Modernization",
    tagline: "Resilient Multi-Cloud Architecture & DevOps Automation",
    description:
      "Transform rigid infrastructure into resilient, scalable, cloud-native architectures across AWS, Azure, and Google Cloud. We deliver database and application migrations, automated CI/CD pipelines, security hardening, and disaster recovery backed by 99.99% uptime SLAs.",
    whatWeBuild: [
      { title: "Multi-Cloud Strategy & Architecture", desc: "Well-Architected frameworks optimizing compute, storage, networking, and governance across cloud providers." },
      { title: "Application & Database Migration", desc: "Zero-downtime database and container migrations with automated failover validation." },
      { title: "Modern API & Microservices Tier", desc: "Decompose monolithic bottlenecks into performant, auto-scaling GraphQL and REST microservices." },
      { title: "Infrastructure as Code (IaC)", desc: "100% reproducible environments provisioned via Terraform, OpenTofu, and Pulumi." },
      { title: "Automated CI/CD Release Pipelines", desc: "Production release pipelines with automated integration testing, canary deployments, and rollbacks." },
      { title: "Disaster Recovery & 99.99% SLA", desc: "Active-active multi-region replication and continuous observability with PagerDuty integration." },
    ],
    process: ["Infrastructure Audit", "Cloud Blueprint", "Migration Sandbox", "Zero-Downtime Cutover", "Observability Implementation", "Cost & Performance Optimization"],
    technologies: ["AWS", "Microsoft Azure", "Google Cloud", "Kubernetes", "Terraform", "Docker", "Datadog", "ArgoCD", "PostgreSQL", "Kafka"],
    whyUs: ["Certified AWS/Azure Solutions Architects", "Zero-downtime migration record", "Built-in FinOps cost reduction", "SLA-backed infrastructure reliability"],
    benefits: ["99.99% system availability", "25–40% infrastructure cost savings", "Deploy 10x faster with CI/CD", "Instant multi-region disaster recovery"],
    industries: ["Financial Services", "Healthcare", "E-Commerce", "SaaS", "Manufacturing"],
  },
  {
    id: "legacy-transformation",
    number: "05",
    category: "cloud-modernization",
    categoryLabel: "Cloud & Modernization",
    startingPrice: "Starting at $150,000",
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    title: "Legacy Transformation",
    tagline: "Deconstruct Monoliths, Modernize Code, and Eradicate Tech Debt",
    description:
      "Eliminate technical debt and modernize mission-critical systems without halting operations. We audit legacy architectures, refactor or rewrite core logic into modern tech stacks, update database schemas, modernize user interfaces, and train your internal team.",
    whatWeBuild: [
      { title: "Comprehensive Legacy Audit", desc: "Deep code analysis, dependency mapping, data flow tracing, and vulnerability audit of existing monoliths." },
      { title: "Modern Modular Architecture", desc: "Domain-Driven Design (DDD) migration path decoupling legacy spaghetti code into maintainable services." },
      { title: "Database & Data Schema Modernization", desc: "Migrate legacy databases (Oracle, DB2, SQL Server) to scalable cloud-native databases." },
      { title: "Modern Enterprise UI/UX", desc: "Replace dated interfaces with high-performance, accessible React and Tailwind enterprise applications." },
      { title: "API Gateway & Legacy Interop", desc: "Build strangler-fig API layers ensuring legacy and new systems operate in parallel during transition." },
      { title: "Knowledge Transfer & Documentation", desc: "Comprehensive system documentation, architectural blueprints, and engineering team enablement." },
    ],
    process: ["Code & Dependency Audit", "Strangler-Fig Modernization Plan", "Microservices & API Engineering", "UI/UX Overhaul", "Parallel Verification", "Knowledge Transfer"],
    technologies: ["TypeScript", "Node.js", "Go", "Python", "React", "PostgreSQL", "Kafka", "Docker", "AWS", "GraphQL"],
    whyUs: ["Proven strangler-fig pattern methodology", "Zero business downtime", "Full IP and codebase transfer", "Decades of complex enterprise experience"],
    benefits: ["Eradicate crippling technical debt", "Slash feature development cycle times", "Attract top engineering talent", "Eliminate legacy licensing overhead"],
    industries: ["Insurance", "Banking", "Supply Chain", "Retail", "Government"],
  },
  {
    id: "enterprise-transformation",
    number: "06",
    category: "cloud-modernization",
    categoryLabel: "Cloud & Modernization",
    startingPrice: "Starting at $300,000+",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    title: "Enterprise Transformation",
    tagline: "Holistic Technology Reinvention Across AI, Cloud, Data & Security",
    description:
      "Our flagship strategic partnership. We embed a dedicated multi-disciplinary engineering squad to execute a 12-month transformation roadmap—re-architecting legacy systems, deploying enterprise AI, migrating to modern cloud, establishing real-time data platforms, and hardening cybersecurity.",
    whatWeBuild: [
      { title: "360° Technology & Digital Audit", desc: "Holistic evaluation of organizational infrastructure, data assets, team velocity, and technical architecture." },
      { title: "12-Month Strategic Transformation Roadmap", desc: "Phased, milestone-driven execution plan directly linked to board-level business and efficiency metrics." },
      { title: "Enterprise Cloud & AI Foundation", desc: "Unified cloud-native infrastructure, multi-agent AI ecosystems, and automated data pipelines." },
      { title: "Zero Trust Cybersecurity Posture", desc: "Enterprise-wide security architecture, identity management, SIEM observability, and compliance." },
      { title: "Dedicated Transformation Squad", desc: "Cross-functional team of principal architects, cloud engineers, AI researchers, and DevOps leads." },
      { title: "Executive Technology Governance", desc: "Continuous sprint reviews, architectural advisory board meetings, and board-level progress reporting." },
    ],
    process: ["Discovery & Board Alignment", "Architectural Blueprint", "Phase 1: Foundation & Cloud", "Phase 2: Data & AI Automation", "Phase 3: Ecosystem Scale", "12-Month Ongoing Strategic Advisory"],
    technologies: ["Full Cloud-Native Ecosystem", "Multi-Cloud (AWS/Azure/GCP)", "Kubernetes", "AI/LLM Infrastructure", "Snowflake", "Databricks", "Terraform", "Zero Trust IAM"],
    whyUs: ["Single accountable partner for your entire tech stack", "Outcome-driven milestone contracts", "Executive-level strategic guidance", "Unmatched multi-disciplinary depth"],
    benefits: ["Complete digital modernization", "Decades of future-proof technological leverage", "Substantial operational margin expansion", "Total alignment across engineering and business"],
    industries: ["Fortune 1000 Enterprises", "Multi-Billion Dollar Conglomerates", "Global Logistics", "National Financial Institutions", "Healthcare Systems"],
  },

  // ─── C. CYBERSECURITY ────────────────────────────────────────────────────────
  {
    id: "cybersecurity-foundation",
    number: "07",
    category: "cybersecurity",
    categoryLabel: "Cybersecurity",
    startingPrice: "Starting at $50,000",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    title: "Cybersecurity Foundation",
    tagline: "Baseline Defense, Identity Hardening & Compliance Readiness",
    description:
      "Establish essential enterprise security controls, IAM policies, and vulnerability management. Designed for mid-market organizations preparing for SOC 2, HIPAA, or ISO audits, this engagement closes critical attack vectors across endpoints, networks, and cloud assets.",
    whatWeBuild: [
      { title: "Vulnerability & Threat Assessment", desc: "Comprehensive scanning and penetration testing across cloud infrastructure, APIs, and networks." },
      { title: "Identity & Access Management (IAM)", desc: "Enforce least-privilege RBAC, multi-factor authentication (MFA), and single sign-on (SSO)." },
      { title: "Endpoint & Network Security", desc: "Hardened firewall rules, endpoint protection, and encrypted communication tunnels." },
      { title: "Cloud Security Posture Management", desc: "Automated configuration auditing across AWS, Azure, and GCP to prevent misconfigurations." },
      { title: "Executive Security Policies & Playbooks", desc: "Formalized compliance-ready security documentation, incident playbooks, and disaster plans." },
      { title: "Strategic Security Roadmap", desc: "Risk-prioritized remediation roadmap for technical leadership and audit committees." },
    ],
    process: ["Threat Surface Discovery", "Vulnerability Testing", "IAM & Access Hardening", "Policy Framework Creation", "Remediation Verification", "Audit Readiness Review"],
    technologies: ["Okta", "CrowdStrike", "AWS IAM", "Azure AD / Entra ID", "Cloudflare", "Wiz", "Tenable", "HashiCorp Vault"],
    whyUs: ["Audit-proven frameworks", "Pragmatic mid-market focus", "Certified CISSPs and security architects", "Fast remediation turnarounds"],
    benefits: ["Pass SOC 2 and HIPAA audits cleanly", "Eradicate exposed credentials and open ports", "Executive confidence in security posture", "Clear, prioritized action plan"],
    industries: ["Fintech", "Healthcare Tech", "B2B SaaS", "E-Commerce", "Professional Services"],
  },
  {
    id: "enterprise-security",
    number: "08",
    category: "cybersecurity",
    categoryLabel: "Cybersecurity",
    startingPrice: "Starting at $125,000",
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    title: "Enterprise Security",
    tagline: "Zero Trust Architecture, SIEM & Automated Incident Response",
    description:
      "Engineered for highly regulated enterprises requiring continuous protection and Zero Trust architectures. We deploy automated SIEM telemetry, continuous vulnerability management, active incident response automation, and SOC operations support.",
    whatWeBuild: [
      { title: "Zero Trust Architecture Implementation", desc: "Never trust, always verify: contextual access control, micro-segmentation, and device health verification." },
      { title: "Centralized SIEM & Telemetry Hub", desc: "Aggregate logs, metrics, and security telemetry into unified real-time detection platforms." },
      { title: "Automated Incident Response (SOAR)", desc: "Automate threat containment, isolating compromised endpoints and revoking tokens in milliseconds." },
      { title: "Continuous Vulnerability Management", desc: "Automated CI/CD security scanning, container image scanning, and dynamic penetration testing." },
      { title: "Regulatory Compliance Support", desc: "End-to-end audit readiness and evidentiary support for SOC 2 Type II, ISO 27001, FedRAMP, and PCI-DSS." },
      { title: "Security Operations Center (SOC) Setup", desc: "Operational workflows, escalation tiers, and alerting runbooks for enterprise security teams." },
    ],
    process: ["Zero Trust Architecture Planning", "SIEM & Log Pipeline Integration", "Micro-Segmentation Deployment", "SOAR Playbook Automation", "Red Teaming Simulation", "Operational Handoff"],
    technologies: ["Splunk", "Datadog Security", "Palo Alto Networks", "CrowdStrike Falcon", "SentinelOne", "AWS Security Hub", "HashiCorp Vault", "SonarQube"],
    whyUs: ["End-to-end Zero Trust mastery", "Defense-in-depth engineering", "Proven containment automation", "Comprehensive audit coverage"],
    benefits: ["Zero breach propagation via micro-segmentation", "Sub-minute threat detection and automated isolation", "Audit-proof compliance telemetry", "Drastic reduction in cyber insurance premiums"],
    industries: ["Banking & Financial Institutions", "Defense Contractors", "Hospital Networks", "Critical Infrastructure", "Global Telecommunications"],
  },
  {
    id: "ai-security",
    number: "09",
    category: "cybersecurity",
    categoryLabel: "Cybersecurity",
    startingPrice: "Starting at $100,000",
    icon: "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18",
    title: "AI Security",
    tagline: "LLM Hardening, Prompt Injection Defense & Data Leak Prevention",
    description:
      "Protect your enterprise LLM and generative AI investments against adversarial attacks, prompt injection, model extraction, and accidental proprietary data leakage. We architect secure AI gateways, data masking pipelines, and automated prompt guardrails.",
    whatWeBuild: [
      { title: "AI Threat & Vulnerability Assessment", desc: "Adversarial red-teaming evaluating LLM prompts, RAG retrieval boundaries, and agentic tool permissions." },
      { title: "Prompt-Injection & Jailbreak Protection", desc: "Multi-layered semantic firewalls detecting and deflecting direct and indirect prompt-injection vectors." },
      { title: "Proprietary Data-Leakage Prevention", desc: "Automated PII/IP redaction and real-time masking before user inputs reach inference endpoints." },
      { title: "Granular AI Access Controls & RBAC", desc: "Role-based retrieval boundaries ensuring employees only access data their security clearance permits." },
      { title: "Model Monitoring & Anomaly Detection", desc: "Continuous logging of prompt embeddings, response distributions, and automated alerts for anomalous inference." },
      { title: "Enterprise AI Security Architecture", desc: "Comprehensive compliance documentation aligned with OWASP Top 10 for LLMs and NIST AI RMF." },
    ],
    process: ["AI Red Teaming & Audit", "Semantic Firewall Architecture", "PII & Data Masking Integration", "Role-Based Vector Security", "Adversarial Stress Testing", "Production Gateways Deployment"],
    technologies: ["Llama Guard", "NeMo Guardrails", "Presidio", "Langfuse", "OpenAI Moderation API", "Cloudflare AI Gateway", "Pinecone RBAC", "Python"],
    whyUs: ["Specialized GenAI security expertise", "Real-world adversarial red teaming experience", "Zero latency penalty architectures", "Compliance with evolving AI regulations"],
    benefits: ["Protect proprietary trade secrets from LLM leaks", "Neutralize brand damage from rogue model outputs", "Ensure compliant RAG retrieval permissions", "Confidently deploy customer-facing AI agents"],
    industries: ["Healthcare & Biotech", "Financial Services", "Legal & Compliance", "Enterprise Software", "Retail & Customer Support"],
  },

  // ─── D. DATA & ANALYTICS ──────────────────────────────────────────────────────
  {
    id: "data-foundation",
    number: "10",
    category: "data",
    categoryLabel: "Data & Analytics",
    startingPrice: "Starting at $75,000",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
    title: "Data Foundation",
    tagline: "Single Source of Truth, Automated ETL & Business Dashboards",
    description:
      "Transform fragmented, siloed company data into an automated, highly reliable cloud data warehouse. We build robust ETL/ELT pipelines, enforce data validation rules, and craft executive dashboards that give leadership clear visibility into operational performance.",
    whatWeBuild: [
      { title: "Modern Data Architecture Design", desc: "Clean data models and schemas optimized for fast analytical queries and reliable storage." },
      { title: "Automated ETL/ELT Pipelines", desc: "Extract data from CRMs, ERPs, databases, and third-party APIs with automated scheduling and error alerts." },
      { title: "Cloud Data Warehouse Implementation", desc: "Scalable centralized repository built on Snowflake, BigQuery, or Amazon Redshift." },
      { title: "Data Quality & Validation Rules", desc: "Automated tests catching schema drift, duplicate records, and invalid values before reporting." },
      { title: "Executive Business Dashboards", desc: "Interactive Tableau, Power BI, or Looker dashboards delivering actionable KPIs to leadership." },
      { title: "Operational & Financial Reporting", desc: "Automated weekly and monthly stakeholder reports distributed automatically via email and Slack." },
    ],
    process: ["Data Source Audit", "Warehouse Schema Design", "Pipeline Engineering", "Data Quality Testing", "Dashboard Development", "Training & Documentation"],
    technologies: ["Snowflake", "Google BigQuery", "AWS Redshift", "dbt", "Fivetran", "Airflow", "PostgreSQL", "Power BI", "Tableau", "Looker"],
    whyUs: ["Clean, scalable dbt modeling", "Automated error recovery pipelines", "Executive-focused dashboard design", "Complete data ownership"],
    benefits: ["Eliminate dozens of manual Excel spreadsheets", "Reliable single source of truth for leadership", "Decisions backed by verified data", "Instant visibility into key metrics"],
    industries: ["B2B SaaS", "E-Commerce & Retail", "Real Estate", "Professional Services", "Healthcare"],
  },
  {
    id: "enterprise-data-platform",
    number: "11",
    category: "data",
    categoryLabel: "Data & Analytics",
    startingPrice: "Starting at $150,000",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    title: "Enterprise Data Platform",
    tagline: "Real-Time Streaming Lakehouse & AI-Ready Data Infrastructure",
    description:
      "Architected for data-intensive enterprises requiring petabyte-scale throughput, sub-second streaming analytics, and unified lakehouse architectures. We deliver AI-ready feature pipelines, automated data governance, and scalable distributed compute.",
    whatWeBuild: [
      { title: "Modern Data Lakehouse Architecture", desc: "Unified lakehouse on Databricks or Snowflake combining the scalability of data lakes with data warehouse ACID transactions." },
      { title: "Real-Time Event Streaming Pipelines", desc: "Sub-second event processing using Apache Kafka and Spark Streaming for real-time analytics." },
      { title: "AI-Ready Feature Stores & Pipelines", desc: "Curated, versioned data features ready for high-velocity machine learning model training and inference." },
      { title: "Automated Data Governance & Lineage", desc: "Data cataloging, automated lineage tracking, and compliance enforcement (GDPR, CCPA, HIPAA)." },
      { title: "Advanced Predictive BI & ML Modeling", desc: "Custom predictive models identifying churn, forecasting demand, and modeling customer lifetime value." },
      { title: "Cloud Data Infrastructure & FinOps", desc: "Automated compute scaling and storage tiering optimizing data infrastructure operating costs." },
    ],
    process: ["Data Landscape Discovery", "Lakehouse Architecture Blueprint", "Streaming Pipeline Implementation", "Data Governance & RBAC", "Feature Store Integration", "Production Verification"],
    technologies: ["Databricks", "Apache Spark", "Apache Kafka", "Snowflake", "Delta Lake", "dbt", "Kubernetes", "AWS Glue", "Python", "Great Expectations"],
    whyUs: ["Petabyte-scale distributed systems experience", "Real-time streaming mastery", "Native integration with ML workflows", "Rigorous enterprise governance"],
    benefits: ["Real-time business insights in milliseconds", "Accelerate ML deployment from months to days", "Eliminate redundant data storage costs", "Complete data compliance auditability"],
    industries: ["Financial Markets & Trading", "Global Logistics & Freight", "Healthcare & Genomics", "Telecom", "Large-Scale Media"],
  },

  // ─── E. PRODUCT ENGINEERING ──────────────────────────────────────────────────
  {
    id: "digital-product-development",
    number: "12",
    category: "product-engineering",
    categoryLabel: "Product Engineering",
    startingPrice: "Starting at $50,000",
    icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
    title: "Digital Product Development",
    tagline: "High-Performance Web & Mobile Products Built for Scale",
    description:
      "Transform product concepts into production-grade digital applications. From UX/UI design and system architecture to full-stack engineering and cloud deployment, we build robust, high-performance web and mobile platforms with clean code and automated QA.",
    whatWeBuild: [
      { title: "Product Strategy & Technical Architecture", desc: "Clear product specifications, user journey mapping, scalable system designs, and database schemas." },
      { title: "Modern Responsive Web Applications", desc: "Blazing-fast React/Next.js frontend applications engineered for conversion, performance, and accessibility." },
      { title: "Cross-Platform Mobile Applications", desc: "Native-performance iOS and Android mobile apps engineered with React Native or Flutter." },
      { title: "Scalable Backend & REST/GraphQL APIs", desc: "Reliable, typed backend services with automated validation, caching, and rate limiting." },
      { title: "Cloud Infrastructure & CI/CD", desc: "Automated Docker deployments on AWS/Vercel with zero-downtime blue/green deployment workflows." },
      { title: "Automated QA & Security Testing", desc: "Comprehensive end-to-end (Playwright) and unit test suites ensuring defect-free releases." },
    ],
    process: ["Product Discovery & Wireframing", "UI/UX High-Fidelity Design", "Sprint-Based Engineering", "QA Automation & Testing", "Production Deployment", "Post-Launch Monitoring"],
    technologies: ["React", "Next.js", "TypeScript", "Node.js", "React Native", "Tailwind CSS", "PostgreSQL", "Redis", "AWS", "Docker"],
    whyUs: ["Design-led technical excellence", "Strict type-safe code standards", "Transparent sprint delivery", "Full intellectual property ownership"],
    benefits: ["Launch production digital product in 8–12 weeks", "Flawless performance across all devices", "Scalable foundation ready for venture or enterprise scale", "Intuitive, modern user experience"],
    industries: ["B2B SaaS", "Fintech", "Healthtech", "Marketplaces", "Enterprise Portals"],
  },
  {
    id: "enterprise-product-engineering",
    number: "13",
    category: "product-engineering",
    categoryLabel: "Product Engineering",
    startingPrice: "Starting at $150,000",
    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    title: "Enterprise Product Engineering",
    tagline: "Dedicated Senior Engineering Squads for Complex Systems",
    description:
      "Deploy a senior, dedicated engineering team to architect, build, and scale complex multi-tiered enterprise software systems. We handle deep API integrations, microservices, native AI capabilities, DevOps automation, and rigorous quality assurance.",
    whatWeBuild: [
      { title: "Dedicated Engineering Squad", desc: "Full-time senior staff architects, frontend/backend leads, QA automation engineers, and technical PMs." },
      { title: "Enterprise Microservices Architecture", desc: "Decoupled services built for high concurrency, fault isolation, and independent scalability." },
      { title: "Complex API Ecosystem & Gateway", desc: "Enterprise integration hub bridging modern web/mobile products with internal core systems." },
      { title: "Embedded AI & Intelligence Features", desc: "Native integration of predictive analytics, smart search, and automated workflows within products." },
      { title: "Automated QA & Release Engineering", desc: "Test-driven development (TDD), automated regression test suites, and continuous delivery pipelines." },
      { title: "Enterprise Security & Governance", desc: "End-to-end encryption, audit logs, granular RBAC, and adherence to enterprise compliance frameworks." },
    ],
    process: ["Discovery & Architecture Sprint", "Dedicated Squad Allocation", "Agile Bi-Weekly Releases", "Automated QA Verification", "Security & Load Testing", "Continuous Evolution & Support"],
    technologies: ["Go", "Node.js", "TypeScript", "Python", "React", "Kubernetes", "Kafka", "PostgreSQL", "Elasticsearch", "AWS/Azure"],
    whyUs: ["Senior-only engineering talent", "Embedded team velocity", "Enterprise-grade architectural rigor", "Guaranteed delivery milestones"],
    benefits: ["Radically scale engineering throughput", "Accelerate time-to-market for flagship products", "Zero-defect enterprise release stability", "Retain complete code and IP ownership"],
    industries: ["Financial Platforms", "Enterprise SaaS", "Healthcare Systems", "Global Logistics", "Telecommunications"],
  },

  // ─── F. MANAGED SERVICES ─────────────────────────────────────────────────────
  {
    id: "managed-ai",
    number: "14",
    category: "managed-services",
    categoryLabel: "Managed Services",
    startingPrice: "$10,000/month",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    title: "Managed AI",
    tagline: "24/7 AI Operations, Model Supervision & Continuous Optimization",
    description:
      "Keep your production AI systems accurate, performant, and cost-effective. Our team actively monitors agent execution, manages LLM versions, prevents prompt drift, optimizes token spending, and implements continuous accuracy improvements around the clock.",
    whatWeBuild: [
      { title: "24/7 AI Health & Latency Monitoring", desc: "Continuous surveillance of inference latency, error rates, agent completion percentages, and uptime." },
      { title: "Continuous Model & Prompt Optimization", desc: "Regular fine-tuning, prompt refinement, and automated regression testing against business benchmarks." },
      { title: "LLM Version & Provider Management", desc: "Seamless migration to newer LLM versions (OpenAI, Anthropic, open-weights) with automated fallbacks." },
      { title: "Token Spend & Compute FinOps", desc: "Semantic caching, context window pruning, and model routing to slash recurring API costs by up to 40%." },
      { title: "Drift & Hallucination Mitigation", desc: "Real-time automated evaluation detecting quality degradation and hallucinations before users notice." },
      { title: "Dedicated AI Engineer on Retainer", desc: "Direct access to senior AI architects for rapid adjustments, new feature rollouts, and ongoing support." },
    ],
    process: ["AI Environment Onboarding", "Telemetry & Monitor Setup", "Baseline Performance Benchmark", "Weekly Optimization Cycles", "Monthly Executive Scorecard", "24/7 Incident Support"],
    technologies: ["Langfuse", "Helicone", "OpenAI", "Anthropic", "vLLM", "Datadog", "Redis Semantic Cache", "Python", "FastAPI"],
    whyUs: ["Dedicated AI operations specialists", "SLA-backed incident response", "Proven 30-40% token cost reductions", "Continuous performance elevation"],
    benefits: ["Zero AI operational headaches", "Guaranteed agent reliability and uptime", "Optimized inference economics", "Always running on state-of-the-art models"],
    industries: ["Customer Support", "Fintech", "Healthcare AI", "E-Commerce", "SaaS"],
  },
  {
    id: "managed-cloud",
    number: "15",
    category: "managed-services",
    categoryLabel: "Managed Services",
    startingPrice: "$10,000/month",
    icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z",
    title: "Managed Cloud",
    tagline: "24/7 Cloud Infrastructure Operations, FinOps & 99.99% Uptime",
    description:
      "Ensure your cloud infrastructure is perpetually secure, fast, and cost-optimized. We provide 24/7 monitoring, automated patch management, multi-region backup verification, disaster recovery failover, and continuous cloud spend governance across AWS, Azure, and GCP.",
    whatWeBuild: [
      { title: "24/7/365 Infrastructure Surveillance", desc: "Round-the-clock monitoring with 15-minute response SLA for critical infrastructure anomalies." },
      { title: "DevOps & CI/CD Pipeline Management", desc: "Maintain and optimize automated deployment pipelines, Docker container registries, and clusters." },
      { title: "Continuous Cloud Cost Optimization (FinOps)", desc: "Reserved instance planning, rightsizing compute, and storage tiering saving 20–35% monthly." },
      { title: "Automated Backup & Disaster Recovery", desc: "Daily automated snapshots, multi-region replication, and quarterly disaster recovery failover drills." },
      { title: "Security Patching & Hardening", desc: "Zero-downtime kernel updates, vulnerability patching, and security group audits." },
      { title: "Monthly SLA & Performance Scorecard", desc: "Detailed executive reports detailing uptime, performance metrics, and cost optimizations." },
    ],
    process: ["Infrastructure Audit & Tagging", "Monitoring & Alert Routing Setup", "Cost Optimization Sprint", "Automated Playbook Deployment", "24/7 Surveillance Activation", "Monthly Executive Reviews"],
    technologies: ["AWS", "Azure", "GCP", "Kubernetes", "Terraform", "Datadog", "PagerDuty", "ArgoCD", "CloudWatch", "Grafana"],
    whyUs: ["99.99% SLA commitment", "Guaranteed cloud cost reductions", "Certified DevOps & Cloud Engineers", "Proactive issue prevention"],
    benefits: ["Eliminate infrastructure downtime", "Reduce internal ops overhead", "Predictable, controlled monthly cloud bills", "Complete disaster readiness"],
    industries: ["E-Commerce", "Financial Services", "Healthcare", "SaaS", "Media"],
  },
  {
    id: "managed-cybersecurity",
    number: "16",
    category: "managed-services",
    categoryLabel: "Managed Services",
    startingPrice: "$15,000/month",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    title: "Managed Cybersecurity",
    tagline: "Continuous SOC Surveillance, Threat Hunting & Incident Response",
    description:
      "Full-spectrum Managed Detection and Response (MDR). We protect your enterprise against ransomware, credential theft, cloud breaches, and insider threats with round-the-clock SOC surveillance, active threat hunting, and sub-15-minute containment SLAs.",
    whatWeBuild: [
      { title: "24/7 Security Operations Center (SOC)", desc: "Dedicated security analysts monitoring alerts, telemetry, and network traffic across the clock." },
      { title: "Active Threat Hunting & Detection", desc: "Proactive identification of sophisticated threat actors and anomalous behavior across endpoints." },
      { title: "Sub-15-Minute Incident Containment", desc: "Rapid automated and manual isolation of compromised accounts, devices, and network segments." },
      { title: "Continuous Vulnerability Management", desc: "Weekly automated scanning and prioritization of new CVEs affecting your tech stack." },
      { title: "Regulatory Compliance & Audit Support", desc: "Continuous evidence gathering and audit reporting for SOC 2, HIPAA, PCI-DSS, and ISO 27001." },
      { title: "Executive Threat Intelligence Briefings", desc: "Monthly threat surface reports and actionable cybersecurity advisory for leadership." },
    ],
    process: ["SOC Telemetry Onboarding", "Detection Rule Configuration", "SOAR Containment Playbooks", "Baseline Threat Hunting", "24/7 Active MDR Launch", "Continuous Posture Evaluation"],
    technologies: ["CrowdStrike Falcon", "SentinelOne", "Splunk", "Wiz", "Palo Alto Cortex", "AWS GuardDuty", "Cloudflare", "Tenable"],
    whyUs: ["Sub-15 minute threat triage SLA", "Elite threat hunting analysts", "Comprehensive compliance reporting", "Proven ransomware containment"],
    benefits: ["Neutralize cyber attacks before data loss occurs", "Satisfy strict cyber insurance prerequisites", "Peace of mind with 24/7 professional surveillance", "Board-ready security posture reporting"],
    industries: ["Banking & Financial Services", "Healthcare Networks", "Critical Supply Chain", "Government Contractors", "High-Tech Enterprises"],
  },
];
