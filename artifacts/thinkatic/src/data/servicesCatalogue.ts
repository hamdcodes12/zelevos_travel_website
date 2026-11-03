// Centralized Authoritative Services & Pricing Catalogue for Thinkatic
import { useState, useEffect, useCallback } from "react";

export type ServiceCategoryKey = "BUILD" | "AI" | "AUTOMATE" | "SCALE" | "OPERATE";
export type PriceType = "FIXED" | "STARTING_FROM" | "RANGE" | "CUSTOM";
export type BillingCycle = "one_time" | "monthly";

export interface ServiceCategory {
  key: ServiceCategoryKey;
  title: string;
  subtitle: string;
  tagline: string;
  chips: string[];
  icon: string;
}

export interface ServicePackage {
  id: string; // Authoritative database serviceId (e.g. 'web-starter', 'ai-starter')
  slug: string; // URL-safe slug for /services/:serviceSlug/:packageSlug
  serviceSlug: string;
  category: ServiceCategoryKey;
  serviceName: string;
  packageName: string;
  description: string;
  price: number; // 0 for custom
  priceDisplay: string;
  priceType: PriceType;
  billingCycle: BillingCycle;
  features: string[];
  deliveryTimeline?: string;
  supportPeriod?: string;
  targetCustomer?: string;
  includedIntegrations?: string[];
  importantNotes?: string;
  isPopular?: boolean;
  isFeatured?: boolean;
  ctaLabel: string;
  ctaType: "checkout" | "consultation";
  sortOrder: number;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    key: "BUILD",
    title: "BUILD",
    subtitle: "Build the digital foundation your business needs.",
    tagline: "Custom websites, high-converting e-commerce, and bespoke software platforms.",
    chips: ["Websites", "E-commerce", "Apps", "Custom Software"],
    icon: "Code2",
  },
  {
    key: "AI",
    title: "AI",
    subtitle: "Build practical AI capabilities around your business workflows.",
    tagline: "Autonomous AI agents, customer support chatbots, and voice AI integrations.",
    chips: ["AI Agents", "Chatbots", "Voice AI", "AI Automation"],
    icon: "Bot",
  },
  {
    key: "AUTOMATE",
    title: "AUTOMATE",
    subtitle: "Streamline repetitive business operations and eliminate manual friction.",
    tagline: "Multi-system CRM, ERP, and API workflow automation pipelines.",
    chips: ["Business Automation", "CRM", "Workflows", "Integrations"],
    icon: "Workflow",
  },
  {
    key: "SCALE",
    title: "SCALE",
    subtitle: "Expand technical throughput with dedicated developers and QA engineers.",
    tagline: "On-demand talent, full engineering squads, and continuous QA testing.",
    chips: ["Developers", "QA Teams", "BPO", "Customer Support"],
    icon: "Users",
  },
  {
    key: "OPERATE",
    title: "OPERATE",
    subtitle: "Keep your digital systems resilient and customer operations responsive.",
    tagline: "Proactive maintenance, continuous monitoring, and 24/7 technical support.",
    chips: ["Cloud", "DevOps", "Maintenance", "Technical Support"],
    icon: "Server",
  },
];

export const SERVICE_PACKAGES: ServicePackage[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. BUILD CATEGORY (9 Packages)
  // ─────────────────────────────────────────────────────────────────────────────
  // 1.1 Business Website Development
  {
    id: "web-starter",
    slug: "starter",
    serviceSlug: "business-website",
    category: "BUILD",
    serviceName: "Business Website Development",
    packageName: "STARTER",
    description: "Ideal for small businesses, consultants, and local businesses establishing a modern, high-converting digital presence.",
    price: 499,
    priceDisplay: "$499",
    priceType: "FIXED",
    billingCycle: "one_time",
    targetCustomer: "Small businesses, consultants, local businesses",
    features: [
      "3–4 custom pages",
      "Custom responsive design",
      "Mobile + desktop optimization",
      "Interactive contact form",
      "WhatsApp & call integration",
      "Google Maps integration",
      "Basic on-page SEO setup",
      "Social media links",
      "SSL certificate setup",
      "7 days post-launch support",
    ],
    deliveryTimeline: "5–7 days",
    supportPeriod: "7 days post-launch support",
    includedIntegrations: ["Google Maps", "WhatsApp", "Contact Forms", "Social Channels"],
    isPopular: false,
    isFeatured: true,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 1,
  },
  {
    id: "web-professional",
    slug: "professional",
    serviceSlug: "business-website",
    category: "BUILD",
    serviceName: "Business Website Development",
    packageName: "PROFESSIONAL",
    description: "For growing businesses requiring premium UI/UX, conversion animations, lead forms, and search console optimization.",
    price: 999,
    priceDisplay: "$999",
    priceType: "FIXED",
    billingCycle: "one_time",
    targetCustomer: "Growing businesses",
    features: [
      "Everything in Starter",
      "5–8 custom pages",
      "Premium enterprise UI/UX",
      "Custom micro-animations",
      "Blog / news section",
      "Lead-generation forms",
      "Google Analytics setup",
      "Google Search Console configuration",
      "Technical SEO foundation",
      "Speed & Core Web Vitals optimization",
      "30 days dedicated support",
    ],
    deliveryTimeline: "7–14 days",
    supportPeriod: "30 days support",
    includedIntegrations: ["Google Analytics", "Search Console", "Lead Forms", "Blog Engine"],
    isPopular: true,
    isFeatured: false,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 2,
  },
  {
    id: "web-premium",
    slug: "premium",
    serviceSlug: "business-website",
    category: "BUILD",
    serviceName: "Business Website Development",
    packageName: "PREMIUM",
    description: "For established companies needing 10–15 fully custom pages, CRM integration, advanced SEO, and ongoing performance tuning.",
    price: 1999,
    priceDisplay: "$1,999",
    priceType: "FIXED",
    billingCycle: "one_time",
    targetCustomer: "Established companies",
    features: [
      "Everything in Professional",
      "10–15 fully custom pages",
      "Bespoke interactive architecture",
      "Advanced motion design",
      "Interactive product/service sections",
      "Advanced SEO structure & schema",
      "Conversion rate optimization (CRO)",
      "CRM & email marketing integration",
      "Third-party API connectors",
      "Performance & security hardening",
      "90 days dedicated support",
    ],
    deliveryTimeline: "14–21 days",
    supportPeriod: "90 days support",
    importantNotes: "Website Maintenance available at $99–$299/month.",
    includedIntegrations: ["HubSpot/CRM", "Email Marketing", "Custom APIs", "Schema.org"],
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 3,
  },

  // 1.2 Shopify / E-commerce
  {
    id: "shopify-launch",
    slug: "launch",
    serviceSlug: "shopify-ecommerce",
    category: "BUILD",
    serviceName: "Shopify / E-commerce",
    packageName: "LAUNCH",
    description: "Complete turnkey e-commerce store launch on Shopify with payments, shipping, and core product catalogue setup.",
    price: 999,
    priceDisplay: "$999",
    priceType: "FIXED",
    billingCycle: "one_time",
    targetCustomer: "Brands launching an online store",
    features: [
      "Shopify account & store setup",
      "Theme selection & customization",
      "Up to 20 products configured",
      "Payment gateway setup (Stripe/PayPal)",
      "Shipping rates & zones configuration",
      "Essential policy & content pages",
      "Mobile checkout optimization",
      "Analytics & pixel tracking setup",
      "Basic on-page e-commerce SEO",
    ],
    deliveryTimeline: "7–10 days",
    supportPeriod: "14 days post-launch support",
    includedIntegrations: ["Shopify Payments", "PayPal", "Shipping Carriers", "Meta Pixel"],
    isPopular: false,
    isFeatured: true,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 4,
  },
  {
    id: "shopify-grow",
    slug: "grow",
    serviceSlug: "shopify-ecommerce",
    category: "BUILD",
    serviceName: "Shopify / E-commerce",
    packageName: "GROW",
    description: "Custom storefront design, expanded catalogue, reviews integration, and abandoned cart automation to scale sales.",
    price: 1999,
    priceDisplay: "$1,999",
    priceType: "FIXED",
    billingCycle: "one_time",
    targetCustomer: "Growing e-commerce retailers",
    features: [
      "Everything in Launch",
      "Bespoke custom storefront styling",
      "Up to 100 products configured",
      "Advanced product filtering & search",
      "Customer reviews & social proof setup",
      "Klaviyo / email marketing integration",
      "Automated abandoned-cart recovery",
      "Comprehensive e-commerce analytics",
      "Conversion rate optimization (CRO)",
    ],
    deliveryTimeline: "2–3 weeks",
    supportPeriod: "30 days support",
    includedIntegrations: ["Klaviyo", "Judge.me/Reviews", "Google Shopping", "Advanced Filters"],
    isPopular: true,
    isFeatured: false,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 5,
  },
  {
    id: "shopify-scale",
    slug: "scale",
    serviceSlug: "shopify-ecommerce",
    category: "BUILD",
    serviceName: "Shopify / E-commerce",
    packageName: "SCALE",
    description: "Enterprise e-commerce architecture for high-volume catalogues, custom apps, ERP connectors, and advanced automation.",
    price: 3999,
    priceDisplay: "$3,999+",
    priceType: "STARTING_FROM",
    billingCycle: "one_time",
    targetCustomer: "High-volume e-commerce brands",
    features: [
      "Premium custom theme engineering",
      "Large product catalogue architecture",
      "Custom checkout & functionality",
      "ERP & warehouse inventory sync",
      "CRM & customer data platform sync",
      "Automated order routing workflows",
      "Advanced e-commerce BI analytics",
      "Conversion optimization audits",
      "90 days dedicated technical support",
    ],
    deliveryTimeline: "3–6 weeks",
    supportPeriod: "90 days dedicated support",
    includedIntegrations: ["ERP/NetSuite", "Custom Private Apps", "Klaviyo VIP", "Multi-Currency"],
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Request Custom Plan",
    ctaType: "consultation",
    sortOrder: 6,
  },

  // 1.3 Custom Software Development
  {
    id: "custom-mvp",
    slug: "mvp",
    serviceSlug: "custom-software",
    category: "BUILD",
    serviceName: "Custom Software Development",
    packageName: "MVP",
    description: "Turn an idea into a tested, production-ready minimum viable product built with modern cloud architecture.",
    price: 3999,
    priceDisplay: "$3,999+",
    priceType: "STARTING_FROM",
    billingCycle: "one_time",
    targetCustomer: "Startups testing a software product idea",
    features: [
      "Technical requirements analysis",
      "UI/UX product design & prototyping",
      "Modern React / TypeScript frontend",
      "Scalable Node.js / Python backend",
      "Relational database design (PostgreSQL)",
      "Secure authentication & RBAC",
      "Administrative control panel",
      "Third-party API integrations",
      "Automated cloud deployment (AWS/Vercel)",
      "Functional QA testing & handover",
    ],
    deliveryTimeline: "4–8 weeks",
    supportPeriod: "30 days support",
    includedIntegrations: ["Auth0/Supabase Auth", "Stripe Checkout", "Cloud Databases", "CI/CD"],
    isPopular: false,
    isFeatured: true,
    ctaLabel: "Get Started",
    ctaType: "consultation",
    sortOrder: 7,
  },
  {
    id: "custom-business",
    slug: "business",
    serviceSlug: "custom-software",
    category: "BUILD",
    serviceName: "Custom Software Development",
    packageName: "BUSINESS",
    description: "Comprehensive bespoke web application engineered for core business workflows, multi-tenant users, and automated reporting.",
    price: 9999,
    priceDisplay: "$9,999+",
    priceType: "STARTING_FROM",
    billingCycle: "one_time",
    targetCustomer: "Growing businesses replacing manual systems",
    features: [
      "Custom business web application",
      "Advanced management dashboard",
      "Multi-tier user role permissions",
      "Automated payment & billing integration",
      "REST / GraphQL internal & partner APIs",
      "Push & email notification engine",
      "Administrative audit log system",
      "Operational analytics & reporting",
      "Security hardening & encryption",
      "End-to-end QA regression testing",
      "High-availability cloud deployment",
    ],
    deliveryTimeline: "8–16 weeks",
    supportPeriod: "60 days support",
    includedIntegrations: ["Payment Gateways", "SendGrid/Twilio", "Enterprise S3", "Analytics Engine"],
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Get Started",
    ctaType: "consultation",
    sortOrder: 8,
  },
  {
    id: "custom-enterprise",
    slug: "enterprise",
    serviceSlug: "custom-software",
    category: "BUILD",
    serviceName: "Custom Software Development",
    packageName: "ENTERPRISE",
    description: "Mission-critical enterprise software platform with complex workflows, AI capabilities, strict security, and dedicated engineering squad.",
    price: 20000,
    priceDisplay: "$20,000+",
    priceType: "STARTING_FROM",
    billingCycle: "one_time",
    targetCustomer: "Enterprise organizations requiring custom software",
    features: [
      "Complex multi-service software architecture",
      "Granular user roles & enterprise SSO",
      "Advanced automated business workflows",
      "Deep third-party ERP/CRM integrations",
      "Integrated AI agents & LLM capabilities",
      "Enterprise security & SOC2 compliance prep",
      "Auto-scaling cloud infrastructure",
      "DevOps pipelines & infrastructure-as-code",
      "Comprehensive automated test suites",
      "Dedicated senior project engineering squad",
    ],
    deliveryTimeline: "Scope-dependent (12–24 weeks)",
    supportPeriod: "180 days support",
    includedIntegrations: ["Enterprise SSO", "SAP/Salesforce", "Private AI Endpoints", "Kubernetes"],
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Request Enterprise Consultation",
    ctaType: "consultation",
    sortOrder: 9,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. AI CATEGORY (5 Packages)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "ai-starter",
    slug: "ai-starter",
    serviceSlug: "ai-solutions",
    category: "AI",
    serviceName: "AI Solutions",
    packageName: "AI STARTER",
    description: "Deploy an intelligent, 24/7 conversational AI assistant on your website grounded in your company's knowledge base.",
    price: 999,
    priceDisplay: "$999",
    priceType: "FIXED",
    billingCycle: "one_time",
    targetCustomer: "Businesses needing automated 24/7 web chat & FAQ answering",
    features: [
      "Website AI chatbot widget",
      "Company knowledge base ingestion",
      "Automated FAQ resolution",
      "Lead capture & qualification flows",
      "Basic multi-turn conversation flows",
      "Instant email notifications for leads",
      "Conversation analytics dashboard",
      "Fast production deployment",
    ],
    deliveryTimeline: "7–10 days",
    supportPeriod: "14 days post-launch tuning",
    includedIntegrations: ["Website Widget", "OpenAI / Anthropic", "Email Alerts", "Knowledge Base"],
    isPopular: true,
    isFeatured: true,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 10,
  },
  {
    id: "ai-business",
    slug: "ai-business",
    serviceSlug: "ai-solutions",
    category: "AI",
    serviceName: "AI Solutions",
    packageName: "AI BUSINESS",
    description: "Advanced autonomous AI agent with document intelligence, appointment booking, CRM sync, and multi-channel messaging.",
    price: 2499,
    priceDisplay: "$2,499",
    priceType: "FIXED",
    billingCycle: "one_time",
    targetCustomer: "Organizations automating customer conversations & appointment scheduling",
    features: [
      "Everything in AI Starter",
      "Advanced autonomous AI agent logic",
      "Live document & vector knowledge-base sync",
      "Dynamic lead qualification & scoring",
      "Automated calendar & appointment booking",
      "Bidirectional CRM integration (HubSpot/Salesforce)",
      "WhatsApp & omnichannel connector",
      "Email triage & drafted responses",
      "Deep conversation sentiment analytics",
      "Custom business rule workflows",
    ],
    deliveryTimeline: "2–3 weeks",
    supportPeriod: "30 days support",
    includedIntegrations: ["CRM (HubSpot/Salesforce)", "Calendly/Google Cal", "WhatsApp API", "Vector RAG"],
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 11,
  },
  {
    id: "ai-enterprise",
    slug: "ai-enterprise",
    serviceSlug: "ai-solutions",
    category: "AI",
    serviceName: "AI Solutions",
    packageName: "AI ENTERPRISE",
    description: "Multi-agent autonomous systems, voice AI telephony, CRM/ERP pipelines, human handoff, and ongoing model optimization.",
    price: 5000,
    priceDisplay: "From $5,000+",
    priceType: "STARTING_FROM",
    billingCycle: "one_time",
    targetCustomer: "Enterprises needing comprehensive cross-functional AI infrastructure",
    importantNotes: "Recurring model management: $299–$1,500+/month depending on usage volume.",
    features: [
      "Multiple specialized AI agents",
      "Voice AI conversational integration",
      "Customer-support automation pipeline",
      "Sales qualification automation",
      "Deep CRM & ERP bi-directional sync",
      "Custom REST APIs & webhook listeners",
      "Advanced orchestration workflows",
      "Administrative supervisory dashboard",
      "Seamless human escalation handoff",
      "Real-time token & latency monitoring",
      "Ongoing prompt tuning & optimization",
    ],
    deliveryTimeline: "4–8 weeks",
    supportPeriod: "60 days support",
    includedIntegrations: ["ERP/SAP", "Voice AI Telephony", "Vector DBs", "Slack/Teams"],
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Request AI Consultation",
    ctaType: "consultation",
    sortOrder: 12,
  },
  {
    id: "ai-automation",
    slug: "ai-automation",
    serviceSlug: "ai-solutions",
    category: "AI",
    serviceName: "AI Solutions",
    packageName: "AI AUTOMATION",
    description: "End-to-end AI-powered workflow automation, intelligent document processing, approval flows, and ERP/CRM integrations.",
    price: 0,
    priceDisplay: "Custom Pricing",
    priceType: "CUSTOM",
    billingCycle: "one_time",
    targetCustomer: "Organizations automating high-volume manual operational workflows",
    features: [
      "AI workflow automation",
      "AI-powered business processes",
      "CRM/ERP integrations",
      "Automated reporting",
      "Document processing",
      "Approval workflows",
      "Advanced API integrations",
      "Monitoring",
    ],
    deliveryTimeline: "Scope dependent",
    supportPeriod: "Included with implementation SLA",
    includedIntegrations: ["Document Parsers", "CRM/ERP Systems", "Approval Portals", "Custom Webhooks"],
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Talk to Thinkatic",
    ctaType: "consultation",
    sortOrder: 13,
  },
  {
    id: "voice-ai",
    slug: "voice-ai",
    serviceSlug: "ai-solutions",
    category: "AI",
    serviceName: "AI Solutions",
    packageName: "VOICE AI",
    description: "Sub-second latency voice AI agents for inbound customer service and outbound conversational qualification. Included in AI Enterprise or available via Custom Scope.",
    price: 0,
    priceDisplay: "Custom Pricing / Included in AI Enterprise",
    priceType: "CUSTOM",
    billingCycle: "one_time",
    targetCustomer: "Companies requiring high-volume inbound/outbound phone automation",
    importantNotes: "Included in applicable AI Enterprise engagements or available via standalone custom scope.",
    features: [
      "Voice AI",
      "Included in AI Enterprise",
      "Customer support automation",
      "Sales automation",
      "Human handoff",
      "Monitoring",
      "Integration options",
    ],
    deliveryTimeline: "Scope dependent",
    supportPeriod: "Included with implementation SLA",
    includedIntegrations: ["Twilio / SIP Trunking", "CRM Platforms", "Audio AI Models", "Transcript DB"],
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Talk to Thinkatic",
    ctaType: "consultation",
    sortOrder: 14,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. AUTOMATE CATEGORY (3 Packages)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "auto-starter",
    slug: "starter",
    serviceSlug: "business-automation",
    category: "AUTOMATE",
    serviceName: "Business Automation",
    packageName: "AUTOMATE STARTER",
    description: "Automate a core repetitive business process to eliminate data entry mistakes and save valuable weekly team hours.",
    price: 499,
    priceDisplay: "$499",
    priceType: "FIXED",
    billingCycle: "one_time",
    targetCustomer: "Businesses looking to automate their first key workflow",
    features: [
      "1 targeted business process automated",
      "Lead / contact form automation",
      "Automated email confirmations & alerts",
      "Basic internal notifications (Slack/Email)",
      "Google Sheets / Airtable / CRM sync",
      "Error notification & recovery setup",
      "Documentation & video walkthrough",
      "14 days post-launch support",
    ],
    deliveryTimeline: "3–5 days",
    supportPeriod: "14 days support",
    includedIntegrations: ["Zapier/Make", "Google Sheets", "Email Service", "Slack"],
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 15,
  },
  {
    id: "auto-business",
    slug: "business",
    serviceSlug: "business-automation",
    category: "AUTOMATE",
    serviceName: "Business Automation",
    packageName: "AUTOMATE BUSINESS",
    description: "Comprehensive operational automation connecting CRM, sales pipelines, messaging, and internal databases.",
    price: 1499,
    priceDisplay: "$1,499",
    priceType: "FIXED",
    billingCycle: "one_time",
    targetCustomer: "Growing businesses seeking seamless cross-app data synchronization",
    features: [
      "3–5 automated multi-step workflows",
      "Full CRM automation & pipeline stages",
      "Lead management & automated routing",
      "Triggered multi-channel Email/SMS flows",
      "Bi-directional data synchronization",
      "Automated summary reporting dashboards",
      "Custom webhooks & API connectors",
      "Security & credential isolation",
      "30 days dedicated support",
    ],
    deliveryTimeline: "7–14 days",
    supportPeriod: "30 days support",
    includedIntegrations: ["HubSpot/Pipedrive", "Twilio SMS", "Stripe", "Make / n8n"],
    isPopular: true,
    isFeatured: false,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 16,
  },
  {
    id: "auto-pro",
    slug: "pro",
    serviceSlug: "business-automation",
    category: "AUTOMATE",
    serviceName: "Business Automation",
    packageName: "AUTOMATE PRO",
    description: "Enterprise workflow automation with AI document processing, CRM + ERP integrations, approval trees, and 24/7 monitoring.",
    price: 3499,
    priceDisplay: "$3,499+",
    priceType: "STARTING_FROM",
    billingCycle: "one_time",
    targetCustomer: "Scale-ups with complex operational handoffs across multiple enterprise tools",
    features: [
      "10+ integrated operational workflows",
      "AI-driven classification & automation",
      "Complex CRM + ERP system synchronization",
      "Automated executive reporting generation",
      "Intelligent invoice & document parsing",
      "Multi-stakeholder approval workflows",
      "Advanced custom API integrations",
      "Automated health checks & uptime monitoring",
      "60 days dedicated engineering support",
    ],
    deliveryTimeline: "2–4 weeks",
    supportPeriod: "60 days support",
    includedIntegrations: ["ERP Systems", "Salesforce", "Document AI", "Custom Microservices"],
    isPopular: false,
    isFeatured: true,
    ctaLabel: "Request Automation Consultation",
    ctaType: "consultation",
    sortOrder: 17,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SCALE CATEGORY (6 Packages)
  // ─────────────────────────────────────────────────────────────────────────────
  // 4.1 QA & Software Testing
  {
    id: "qa-starter",
    slug: "qa-starter",
    serviceSlug: "qa-testing",
    category: "SCALE",
    serviceName: "QA & Software Testing",
    packageName: "QA STARTER",
    description: "Comprehensive manual testing pass across devices and browsers with an actionable bug report and test summary.",
    price: 499,
    priceDisplay: "$499",
    priceType: "FIXED",
    billingCycle: "one_time",
    targetCustomer: "Teams launching a website, web app, or feature sprint",
    features: [
      "Full website or app test coverage",
      "Functional end-to-end user flow testing",
      "Responsive layout testing (Mobile/Tablet/Desktop)",
      "Cross-browser compatibility testing",
      "Detailed bug report with reproduction steps",
      "Screen recordings & console logs",
      "Executive test summary & recommendations",
    ],
    deliveryTimeline: "3–5 days",
    supportPeriod: "Includes 1 re-test verification pass",
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 18,
  },
  {
    id: "qa-business",
    slug: "qa-business",
    serviceSlug: "qa-testing",
    category: "SCALE",
    serviceName: "QA & Software Testing",
    packageName: "QA BUSINESS",
    description: "Continuous monthly QA testing support covering regression, mobile releases, API verification, and test documentation.",
    price: 999,
    priceDisplay: "$999/month",
    priceType: "FIXED",
    billingCycle: "monthly",
    targetCustomer: "SaaS and software teams with active sprint cycles",
    features: [
      "Ongoing manual QA testing hours",
      "Continuous regression testing per release",
      "iOS and Android mobile app testing",
      "Cross-browser verification testing",
      "REST API endpoint testing (Postman)",
      "Living test case documentation",
      "Weekly QA reports & sprint syncs",
    ],
    deliveryTimeline: "Ongoing monthly sprint allocation",
    supportPeriod: "Active monthly subscription",
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 19,
  },
  {
    id: "qa-team",
    slug: "qa-team",
    serviceSlug: "qa-testing",
    category: "SCALE",
    serviceName: "QA & Software Testing",
    packageName: "QA TEAM",
    description: "Dedicated QA engineering resources, automated test scripts (Playwright/Cypress), CI/CD pipelines, and a QA manager.",
    price: 2499,
    priceDisplay: "$2,499+/month",
    priceType: "STARTING_FROM",
    billingCycle: "monthly",
    targetCustomer: "Engineering teams requiring dedicated automated & manual test squads",
    features: [
      "Dedicated QA engineers assigned to your team",
      "Manual + automated testing suites",
      "Playwright / Cypress test script creation",
      "API & performance load testing",
      "Automated regression in CI/CD pipelines",
      "Continuous testing across staging & prod",
      "Dedicated QA Lead / Manager oversight",
    ],
    deliveryTimeline: "Onboarding within 1 week",
    supportPeriod: "Dedicated ongoing team",
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Request QA Team",
    ctaType: "consultation",
    sortOrder: 20,
  },

  // 4.2 Dedicated Developers
  {
    id: "dev-developer",
    slug: "developer",
    serviceSlug: "dedicated-developers",
    category: "SCALE",
    serviceName: "Dedicated Developers",
    packageName: "DEVELOPER",
    description: "Hire a vetted full-time developer (160 hours/month) embedded directly into your codebase, workflow, and daily standups.",
    price: 1999,
    priceDisplay: "$1,999–$3,499/month",
    priceType: "RANGE",
    billingCycle: "monthly",
    targetCustomer: "Companies looking to scale developer capacity cost-effectively",
    features: [
      "1 Dedicated full-time software developer",
      "160 guaranteed working hours / month",
      "Daily communication & standup participation",
      "Direct Git / GitHub workflow integration",
      "Weekly productivity & timesheet reporting",
      "Thinkatic technical account management",
      "Replacement guarantee within 5 business days",
    ],
    deliveryTimeline: "Candidate matching within 48–72 hours",
    supportPeriod: "Active monthly contract",
    isPopular: true,
    isFeatured: true,
    ctaLabel: "Hire a Developer",
    ctaType: "consultation",
    sortOrder: 21,
  },
  {
    id: "dev-team",
    slug: "development-team",
    serviceSlug: "dedicated-developers",
    category: "SCALE",
    serviceName: "Dedicated Developers",
    packageName: "DEVELOPMENT TEAM",
    description: "Multi-developer pod (2–4 engineers) with technical project manager, UI/UX, and QA support aligned to your sprint goals.",
    price: 5999,
    priceDisplay: "$5,999–$9,999/month",
    priceType: "RANGE",
    billingCycle: "monthly",
    targetCustomer: "Growing businesses building major product features or platforms",
    features: [
      "2–4 Dedicated software engineers",
      "Dedicated Technical Project Manager",
      "Integrated QA testing support",
      "Part-time UI/UX design support",
      "Weekly milestone & progress reporting",
      "Dedicated Slack / Microsoft Teams channel",
      "Sprint planning & backlog grooming",
    ],
    deliveryTimeline: "Pod deployment within 1–2 weeks",
    supportPeriod: "Active monthly contract",
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Build a Development Team",
    ctaType: "consultation",
    sortOrder: 22,
  },
  {
    id: "dev-product-team",
    slug: "product-team",
    serviceSlug: "dedicated-developers",
    category: "SCALE",
    serviceName: "Dedicated Developers",
    packageName: "PRODUCT TEAM",
    description: "Autonomous product squad with Product Manager, Senior UI/UX, Full-Stack Engineers, QA, and DevOps engineers.",
    price: 10000,
    priceDisplay: "$10,000–$20,000+/month",
    priceType: "RANGE",
    billingCycle: "monthly",
    targetCustomer: "Enterprises needing an end-to-end engineering squad to deliver full software initiatives",
    features: [
      "Lead Product Manager / Technical Director",
      "Senior UI/UX Product Designer",
      "Multiple Full-Stack & Backend Developers",
      "Dedicated QA Automation Engineer",
      "DevOps & Cloud Infrastructure Engineer",
      "Full agile delivery management",
      "Quarterly roadmap execution reviews",
    ],
    deliveryTimeline: "Squad kickoff within 2 weeks",
    supportPeriod: "Long-term dedicated partnership",
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Build a Product Team",
    ctaType: "consultation",
    sortOrder: 23,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. OPERATE CATEGORY (6 Packages)
  // ─────────────────────────────────────────────────────────────────────────────
  // 5.1 Website Maintenance
  {
    id: "maint-basic",
    slug: "basic",
    serviceSlug: "website-maintenance",
    category: "OPERATE",
    serviceName: "Website Maintenance",
    packageName: "BASIC",
    description: "Essential monthly uptime monitoring, cloud backups, security patches, and minor technical fixes.",
    price: 99,
    priceDisplay: "$99/month",
    priceType: "FIXED",
    billingCycle: "monthly",
    targetCustomer: "Small websites requiring peace of mind and security updates",
    features: [
      "24/7 Automated website uptime monitoring",
      "Weekly automated cloud backups",
      "Core, theme & plugin security updates",
      "Minor bug & text fixes",
      "1 hour dedicated developer time / month",
      "Monthly health check summary",
    ],
    deliveryTimeline: "Immediate setup upon subscription",
    supportPeriod: "Monthly recurring service",
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 24,
  },
  {
    id: "maint-business",
    slug: "business",
    serviceSlug: "website-maintenance",
    category: "OPERATE",
    serviceName: "Website Maintenance",
    packageName: "BUSINESS",
    description: "Active website maintenance with 3 hours development, regular content updates, speed checks, and SEO audits.",
    price: 199,
    priceDisplay: "$199/month",
    priceType: "FIXED",
    billingCycle: "monthly",
    targetCustomer: "Growing business websites with active marketing and regular updates",
    features: [
      "Everything in Basic",
      "3 hours dedicated developer time / month",
      "Content, banner, and image updates",
      "Monthly performance & speed checks",
      "Technical SEO health audit",
      "Database clean-up & optimization",
      "Monthly analytical report",
    ],
    deliveryTimeline: "Immediate setup upon subscription",
    supportPeriod: "Monthly recurring service",
    isPopular: true,
    isFeatured: false,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 25,
  },
  {
    id: "maint-premium",
    slug: "premium",
    serviceSlug: "website-maintenance",
    category: "OPERATE",
    serviceName: "Website Maintenance",
    packageName: "PREMIUM",
    description: "High-priority support with 8 hours development, security defense monitoring, CRO improvements, and rapid turnaround.",
    price: 399,
    priceDisplay: "$399/month",
    priceType: "FIXED",
    billingCycle: "monthly",
    targetCustomer: "High-traffic websites, e-commerce stores, and mission-critical portals",
    features: [
      "Everything in Business",
      "8 hours dedicated developer time / month",
      "Priority same-day emergency support",
      "Advanced speed & Core Web Vitals tuning",
      "Continuous firewall & malware scanning",
      "Conversion improvements & A/B suggestions",
      "Bi-weekly performance review meetings",
    ],
    deliveryTimeline: "Immediate setup upon subscription",
    supportPeriod: "Monthly recurring service",
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Get Started",
    ctaType: "checkout",
    sortOrder: 26,
  },

  // 5.2 BPO / Customer Support
  {
    id: "bpo-agent",
    slug: "customer-support-agent",
    serviceSlug: "bpo-customer-support",
    category: "SCALE",
    serviceName: "BPO / Customer Support",
    packageName: "CUSTOMER SUPPORT AGENT",
    description: "Dedicated support agent for email, live chat, and ticket resolution with defined shifts and daily performance metrics.",
    price: 699,
    priceDisplay: "$699–$1,199/agent/month",
    priceType: "RANGE",
    billingCycle: "monthly",
    targetCustomer: "Businesses needing dedicated customer support",
    features: [
      "Email support",
      "Chat support",
      "Ticket management",
      "Customer queries",
      "Basic reporting",
      "Defined working hours",
    ],
    deliveryTimeline: "3–5 days onboarding",
    supportPeriod: "Monthly ongoing",
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Discuss Support Requirements",
    ctaType: "consultation",
    sortOrder: 27,
  },
  {
    id: "bpo-premium-support",
    slug: "premium-support",
    serviceSlug: "bpo-customer-support",
    category: "SCALE",
    serviceName: "BPO / Customer Support",
    packageName: "PREMIUM SUPPORT",
    description: "Senior agent providing voice, chat, and email support with dedicated supervisor, QA scorecards, and CRM pipeline management.",
    price: 1200,
    priceDisplay: "$1,200–$1,800/agent/month",
    priceType: "RANGE",
    billingCycle: "monthly",
    targetCustomer: "Multi-channel high-touch customer operations",
    features: [
      "Voice + chat + email",
      "CRM management",
      "Escalation management",
      "Quality monitoring",
      "Reporting",
      "Dedicated supervisor",
    ],
    deliveryTimeline: "5–7 days onboarding",
    supportPeriod: "Dedicated supervisor",
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Discuss Premium Support",
    ctaType: "consultation",
    sortOrder: 28,
  },
  {
    id: "bpo-team",
    slug: "bpo-team",
    serviceSlug: "bpo-customer-support",
    category: "SCALE",
    serviceName: "BPO / Customer Support",
    packageName: "BPO TEAM",
    description: "Scalable squad of 5+ agents, dedicated Team Leader, QA Analyst, and Operations Manager under strict SLA governance.",
    price: 0,
    priceDisplay: "Custom Pricing",
    priceType: "CUSTOM",
    billingCycle: "monthly",
    targetCustomer: "Large-scale customer service operations",
    features: [
      "5+ agents",
      "Team leader",
      "QA",
      "Operations manager",
      "Performance dashboard",
      "SLA-based delivery",
    ],
    deliveryTimeline: "1–2 weeks onboarding",
    supportPeriod: "SLA-based delivery",
    isPopular: false,
    isFeatured: false,
    ctaLabel: "Build a BPO Team",
    ctaType: "consultation",
    sortOrder: 29,
  },
];

// Helper functions for lookup
export function getPackageById(id: string): ServicePackage | undefined {
  return SERVICE_PACKAGES.find((p) => p.id === id || p.slug === id);
}

export function getPackageBySlugs(serviceSlug: string, packageSlug: string): ServicePackage | undefined {
  return SERVICE_PACKAGES.find(
    (p) => p.serviceSlug.toLowerCase() === serviceSlug.toLowerCase() && p.slug.toLowerCase() === packageSlug.toLowerCase()
  );
}

export function getPackagesByCategory(category: ServiceCategoryKey): ServicePackage[] {
  return SERVICE_PACKAGES.filter((p) => p.category === category);
}

export function getFeaturedPackages(): ServicePackage[] {
  return SERVICE_PACKAGES.filter((p) => p.isFeatured);
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Authoritative Database Synchronization
// ─────────────────────────────────────────────────────────────────────────────
export function mapPlanToServicePackage(plan: any): ServicePackage {
  const isCustom =
    plan.pricingType === "custom" ||
    plan.priceDisplay?.toLowerCase().includes("custom") ||
    (!plan.price && plan.price !== 0);
  const isRange =
    plan.pricingType === "range" ||
    plan.priceDisplay?.includes("–") ||
    plan.priceDisplay?.includes("-");
  const isStarting =
    plan.priceDisplay?.includes("+") ||
    plan.priceDisplay?.toLowerCase().startsWith("from ");

  let priceType: PriceType = "FIXED";
  if (isCustom) priceType = "CUSTOM";
  else if (isStarting) priceType = "STARTING_FROM";
  else if (isRange) priceType = "RANGE";

  const ctaType: "checkout" | "consultation" =
    plan.paymentEnabled && plan.price > 0 && !isCustom ? "checkout" : "consultation";
  const ctaLabel = ctaType === "checkout" ? "Get Started" : "Request Scope";

  const fallback = SERVICE_PACKAGES.find(
    (p) => p.id === plan.serviceId || p.slug === plan.packageSlug || p.id === String(plan.id)
  );

  return {
    id: plan.serviceId || (fallback ? fallback.id : String(plan.id)),
    slug: plan.packageSlug || fallback?.slug || plan.serviceId,
    serviceSlug: fallback?.serviceSlug || plan.serviceId,
    category: (plan.category || fallback?.category || "BUILD").toUpperCase() as ServiceCategoryKey,
    serviceName: plan.serviceName || fallback?.serviceName || plan.name,
    packageName: plan.name || plan.packageName || fallback?.packageName || "Package",
    description: plan.description || fallback?.description || "",
    price: Number(plan.price) || 0,
    priceDisplay:
      plan.priceDisplay ||
      (isCustom ? "Custom Pricing" : `$${Number(plan.price).toLocaleString()}`),
    priceType,
    billingCycle:
      plan.billingInterval === "monthly" || fallback?.billingCycle === "monthly"
        ? "monthly"
        : "one_time",
    features: Array.isArray(plan.features) && plan.features.length > 0 ? plan.features : fallback?.features || [],
    deliveryTimeline: plan.deliveryTimeline || fallback?.deliveryTimeline,
    supportPeriod: plan.supportDuration || fallback?.supportPeriod,
    targetCustomer: plan.targetCustomer || fallback?.targetCustomer,
    includedIntegrations: fallback?.includedIntegrations,
    importantNotes: fallback?.importantNotes,
    isPopular: plan.popular !== undefined ? Boolean(plan.popular) : fallback?.isPopular,
    isFeatured: fallback?.isFeatured,
    ctaLabel,
    ctaType,
    sortOrder: Number(plan.sortOrder) || fallback?.sortOrder || 0,
  };
}

export function useAuthoritativePlans() {
  const [packages, setPackages] = useState<ServicePackage[]>(SERVICE_PACKAGES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/plans");
      if (!res.ok) {
        throw new Error(`Failed to fetch plans: ${res.statusText}`);
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data
          .filter((p: any) => p.clientVisible !== false && (p.status === "PUBLISHED" || p.status === "WAITING"))
          .map(mapPlanToServicePackage);
        setPackages(mapped);
      }
    } catch (err: any) {
      console.warn("[Catalogue] Live plans fetch error, using authoritative defaults:", err.message);
      setError(err.message || "Failed to load live catalogue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return {
    packages,
    loading,
    error,
    refetch: fetchPlans,
  };
}

