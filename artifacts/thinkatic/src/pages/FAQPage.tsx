import React, { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { useSEO, STRUCTURED_DATA } from "@/hooks/useSEO";
import {
  Search,
  X,
  Plus,
  Minus,
  ArrowRight,
  HelpCircle,
  Building2,
  Cpu,
  Globe,
  Users,
  Briefcase,
  Zap,
  CreditCard,
  ShieldCheck,
  Mail,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  ExternalLink,
  PhoneCall,
  Check,
  Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CategoryId =
  | "all"
  | "about"
  | "services"
  | "global-delivery"
  | "bpo-partners"
  | "projects-operations"
  | "technology-ai"
  | "payments-billing"
  | "security-governance"
  | "support-contact";

export interface FAQItemData {
  id: string;
  category: CategoryId;
  categoryLabel: string;
  question: string;
  answer: string;
  bullets?: string[];
  note?: string;
  cta?: {
    label: string;
    href: string;
  };
  keywords: string[];
  isFeatured?: boolean;
  featuredTitle?: string;
}

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  description: string;
}

// ── Animation Variants ────────────────────────────────────────────────────────
const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease },
  },
};

// ── Category Definitions ───────────────────────────────────────────────────────
const CATEGORIES: CategoryMeta[] = [
  {
    id: "all",
    label: "All Questions",
    shortLabel: "ALL",
    icon: HelpCircle,
    description: "Browse the full collection of answers across all Thinkatic domains.",
  },
  {
    id: "about",
    label: "About Thinkatic",
    shortLabel: "ABOUT THINKATIC",
    icon: Building2,
    description: "Company overview, operating model, identity, and mission.",
  },
  {
    id: "services",
    label: "Services",
    shortLabel: "SERVICES",
    icon: Briefcase,
    description: "Technology solutions, customer support, and operational capabilities.",
  },
  {
    id: "global-delivery",
    label: "Global Delivery",
    shortLabel: "GLOBAL DELIVERY",
    icon: Globe,
    description: "Delivery structure, international markets, and scaling mechanisms.",
  },
  {
    id: "bpo-partners",
    label: "BPO Partners",
    shortLabel: "BPO PARTNERS",
    icon: Users,
    description: "Partner registration, verification, agreements, and project allocation.",
  },
  {
    id: "projects-operations",
    label: "Projects & Operations",
    shortLabel: "PROJECTS & OPERATIONS",
    icon: Zap,
    description: "Client project kickoff, tracking, quality management, and operations.",
  },
  {
    id: "technology-ai",
    label: "Technology & AI",
    shortLabel: "TECHNOLOGY & AI",
    icon: Cpu,
    description: "AI solutions, transparent service pricing, voice AI, and human governance.",
  },
  {
    id: "payments-billing",
    label: "Payments & Billing",
    shortLabel: "PAYMENTS & BILLING",
    icon: CreditCard,
    description: "Invoicing, verified payment workflows, and BPO partner withdrawals.",
  },
  {
    id: "security-governance",
    label: "Security & Governance",
    shortLabel: "SECURITY & GOVERNANCE",
    icon: ShieldCheck,
    description: "Tenant isolation, role-based access, document safety, and audit controls.",
  },
  {
    id: "support-contact",
    label: "Support & Contact",
    shortLabel: "SUPPORT & CONTACT",
    icon: Mail,
    description: "Connecting with enterprise sales, partnerships, and technical teams.",
  },
];

// ── Complete Master FAQ Dataset (53 Authoritative Items) ──────────────────────
const FAQ_DATABASE: FAQItemData[] = [
  // ── 1. ABOUT THINKATIC (5 items) ──
  {
    id: "about-what-is-thinkatic",
    category: "about",
    categoryLabel: "About Thinkatic",
    question: "What is Thinkatic?",
    answer:
      "Thinkatic is a technology and business process outsourcing company helping businesses operate smarter, serve customers better and scale faster through technology, skilled people and structured operational processes.",
    keywords: ["what is thinkatic", "overview", "company", "mission", "bpo", "technology", "identity"],
    isFeatured: true,
  },
  {
    id: "about-what-does-thinkatic-do",
    category: "about",
    categoryLabel: "About Thinkatic",
    question: "What does Thinkatic do?",
    answer:
      "Thinkatic provides technology services, customer experience solutions, business process outsourcing and technology-enabled operational capabilities.",
    keywords: ["what does thinkatic do", "services", "capabilities", "cx", "customer experience", "outsourcing"],
  },
  {
    id: "about-who-does-thinkatic-work-with",
    category: "about",
    categoryLabel: "About Thinkatic",
    question: "Who does Thinkatic work with?",
    answer:
      "Thinkatic works with businesses that need technology, customer experience, business process or operational support, as well as verified BPO partners that provide delivery capabilities.",
    keywords: ["clients", "partners", "who", "target audience", "businesses", "bpo centres", "collaborations"],
  },
  {
    id: "about-where-does-thinkatic-operate",
    category: "about",
    categoryLabel: "About Thinkatic",
    question: "Where does Thinkatic operate?",
    answer:
      "Thinkatic's delivery model connects businesses with India-based delivery capabilities serving international requirements, including US and UK markets.",
    note: "Thinkatic provides global delivery orchestration connecting businesses with verified Indian delivery centres without misrepresenting overseas physical office locations.",
    keywords: ["location", "india", "us", "uk", "international", "where", "presence", "operating regions"],
  },
  {
    id: "about-what-makes-thinkatic-different",
    category: "about",
    categoryLabel: "About Thinkatic",
    question: "What makes Thinkatic different?",
    answer:
      "Thinkatic combines technology, people and process into one connected operating model, allowing businesses to access technology services and structured delivery capabilities through one partner.",
    keywords: ["difference", "unique", "value", "connected operating model", "hybrid", "advantage"],
  },

  // ── 2. SERVICES (6 items) ──
  {
    id: "services-what-services",
    category: "services",
    categoryLabel: "Services",
    question: "What services does Thinkatic provide?",
    answer:
      "Thinkatic provides services across technology, customer experience and business process outsourcing.",
    bullets: [
      "Software and application support",
      "Technical support",
      "IT operations",
      "Automation",
      "Data and process management",
      "Customer support",
      "Voice support",
      "Chat and email support",
      "Back-office operations",
      "Data processing",
      "Order management",
      "Lead management",
      "Verification and validation",
      "Administrative support",
      "Process management",
      "Operational support",
    ],
    cta: {
      label: "Explore Our Services",
      href: "/services",
    },
    keywords: ["services", "list", "software", "voice", "chat", "back-office", "data processing", "support", "cx"],
    isFeatured: true,
  },
  {
    id: "services-custom-software",
    category: "services",
    categoryLabel: "Services",
    question: "Can Thinkatic build custom software?",
    answer:
      "Yes. Thinkatic offers custom software development for businesses ranging from MVP requirements to larger business and enterprise software initiatives.",
    keywords: ["custom software", "mvp", "enterprise software", "web application", "development", "build"],
  },
  {
    id: "services-website-development",
    category: "services",
    categoryLabel: "Services",
    question: "Does Thinkatic provide website development?",
    answer:
      "Yes. Website development is available through Thinkatic's technology services and service packages.",
    keywords: ["website development", "web design", "frontend", "packages", "web app"],
  },
  {
    id: "services-shopify-ecommerce",
    category: "services",
    categoryLabel: "Services",
    question: "Does Thinkatic provide Shopify or e-commerce development?",
    answer:
      "Yes. Thinkatic offers Shopify and e-commerce development packages for businesses at different stages of growth.",
    keywords: ["shopify", "ecommerce", "e-commerce", "store setup", "online store", "retail"],
  },
  {
    id: "services-business-automation",
    category: "services",
    categoryLabel: "Services",
    question: "Does Thinkatic provide business automation?",
    answer:
      "Yes. Thinkatic offers business automation services designed to streamline repetitive workflows and improve operational efficiency.",
    keywords: ["business automation", "workflows", "efficiency", "integration", "zapier", "n8n", "streamline"],
  },
  {
    id: "services-customer-support-outsourcing",
    category: "services",
    categoryLabel: "Services",
    question: "Does Thinkatic provide customer support outsourcing?",
    answer:
      "Yes. Thinkatic provides customer support capabilities including voice, chat, email, onboarding, query resolution and related customer experience operations.",
    cta: {
      label: "Explore Customer Support",
      href: "/services",
    },
    keywords: ["customer support", "outsourcing", "voice", "chat", "email", "query resolution", "cx", "onboarding"],
  },

  // ── 3. GLOBAL DELIVERY (6 items) ──
  {
    id: "delivery-model",
    category: "global-delivery",
    categoryLabel: "Global Delivery",
    question: "What is Thinkatic's global delivery model?",
    answer:
      "Thinkatic connects business requirements with structured delivery capabilities through a combination of technology, people and operational processes.",
    cta: {
      label: "Explore Global Delivery",
      href: "/global-delivery",
    },
    keywords: ["global delivery", "operating model", "delivery capabilities", "how delivery works", "framework"],
    isFeatured: true,
    featuredTitle: "How does Global Delivery work?",
  },
  {
    id: "delivery-location-based",
    category: "global-delivery",
    categoryLabel: "Global Delivery",
    question: "Where are delivery capabilities based?",
    answer:
      "Thinkatic's delivery model is built around India-based BPO delivery capabilities serving international business requirements.",
    keywords: ["india", "delivery centres", "location", "capabilities", "offshore", "bpo", "geography"],
  },
  {
    id: "delivery-us-support",
    category: "global-delivery",
    categoryLabel: "Global Delivery",
    question: "Can Thinkatic support US businesses?",
    answer:
      "Yes. Thinkatic's delivery model is designed to support international businesses, including requirements from the US market.",
    keywords: ["us", "united states", "american clients", "timezone", "international", "north america"],
  },
  {
    id: "delivery-uk-support",
    category: "global-delivery",
    categoryLabel: "Global Delivery",
    question: "Can Thinkatic support UK businesses?",
    answer:
      "Yes. Thinkatic's delivery model is designed to support international businesses, including requirements from the UK market.",
    keywords: ["uk", "united kingdom", "british clients", "international", "europe"],
  },
  {
    id: "delivery-scaling",
    category: "global-delivery",
    categoryLabel: "Global Delivery",
    question: "Can delivery scale as our business grows?",
    answer:
      "Thinkatic's operating model is designed to support changing business requirements through structured projects, workforce capabilities and delivery capacity.",
    note: "Capacity scaling is arranged through structured operational onboarding and workforce alignment rather than guaranteed instant capacity.",
    keywords: ["scale", "scaling", "business growth", "capacity", "expansion", "elasticity"],
  },
  {
    id: "delivery-247-support",
    category: "global-delivery",
    categoryLabel: "Global Delivery",
    question: "Does Thinkatic provide 24/7 support?",
    answer:
      "Service coverage depends on the project requirements, agreed operating model, workforce availability and delivery arrangement. Contact Thinkatic to discuss the required coverage.",
    note: "Thinkatic does not claim universal 24/7 operations. Shift arrangements, weekend coverage, and extended hours are formally evaluated and scheduled per project statement of work.",
    keywords: ["24/7", "round the clock", "shifts", "coverage", "hours", "night shift", "availability"],
  },

  // ── 4. BPO PARTNERS (8 items) ──
  {
    id: "bpo-how-to-become-partner",
    category: "bpo-partners",
    categoryLabel: "BPO Partners",
    question: "How can my BPO centre become a Thinkatic partner?",
    answer:
      "BPO centres can begin through the partner registration process. Required company, centre, verification, documentation, bank and operational information is collected before the centre can proceed through the approval workflow.",
    cta: {
      label: "Become a BPO Partner",
      href: "/signup?role=bpo",
    },
    keywords: ["bpo partner", "become partner", "register bpo", "onboarding", "join network", "apply as bpo"],
    isFeatured: true,
    featuredTitle: "How can I become a BPO partner?",
  },
  {
    id: "bpo-onboarding-requirements",
    category: "bpo-partners",
    categoryLabel: "BPO Partners",
    question: "What is required during BPO onboarding?",
    answer:
      "Depending on the onboarding requirements, partners may need to provide:",
    bullets: [
      "Company information",
      "Business documentation",
      "PAN",
      "GST information where applicable",
      "Address proof",
      "Bank details",
      "Authorized signatory information",
      "Centre information",
      "Centre verification evidence",
      "Workforce information",
      "Compliance documentation",
    ],
    keywords: ["onboarding", "documents", "pan", "gst", "bank details", "centre verification", "requirements", "compliance"],
  },
  {
    id: "bpo-auto-approval",
    category: "bpo-partners",
    categoryLabel: "BPO Partners",
    question: "Is every registered BPO automatically approved?",
    answer:
      "No. Registration starts the onboarding process. Required verification, documentation, centre review, agreement approval and other applicable requirements must be completed before activation.",
    keywords: ["auto approval", "approval process", "verification", "activation", "vetting", "automatic"],
  },
  {
    id: "bpo-centre-verification",
    category: "bpo-partners",
    categoryLabel: "BPO Partners",
    question: "What is Centre Verification?",
    answer:
      "Centre verification is the process of reviewing the BPO centre's operational location and supporting evidence. This can include office details, office photographs and live office video evidence.",
    keywords: ["centre verification", "office photos", "live video", "physical audit", "premises", "inspection"],
  },
  {
    id: "bpo-agreement-sign",
    category: "bpo-partners",
    categoryLabel: "BPO Partners",
    question: "Do I need to sign an agreement?",
    answer:
      "Approved onboarding partners are required to complete the applicable Thinkatic Global Delivery Partner Agreement process before partner activation.",
    keywords: ["agreement", "contract", "nda", "terms", "partner agreement", "legal", "signature"],
  },
  {
    id: "bpo-agreement-workflow",
    category: "bpo-partners",
    categoryLabel: "BPO Partners",
    question: "How does the agreement process work?",
    answer:
      "The partner receives the applicable agreement, downloads and reviews it, signs it outside the platform and uploads the signed PDF for administrative review. Activation occurs only after the required approvals are completed.",
    keywords: ["agreement process", "download agreement", "signed pdf", "administrative review", "upload", "workflow"],
  },
  {
    id: "bpo-income-guarantee",
    category: "bpo-partners",
    categoryLabel: "BPO Partners",
    question: "Will Thinkatic guarantee projects or income?",
    answer:
      "No. Project opportunities, allocation and commercial outcomes depend on business requirements, partner capabilities, capacity, project conditions and applicable approvals.",
    note: "Thinkatic does not provide income guarantees or volume guarantees. Commercial outcomes depend strictly on delivery performance, compliance standards, and client demand.",
    keywords: ["income guarantee", "project guarantee", "earnings", "assurances", "money", "minimum income"],
  },
  {
    id: "bpo-project-allocation",
    category: "bpo-partners",
    categoryLabel: "BPO Partners",
    question: "How are BPO projects allocated?",
    answer:
      "Project allocation is managed through the Thinkatic operating workflow and authorised human/admin decision-making based on applicable project requirements, partner capabilities and operational considerations.",
    note: "Thinkatic does not use fully automatic project allocation. Authorised human governance oversees matching to ensure delivery quality and operational alignment.",
    keywords: ["project allocation", "awarding projects", "human governance", "matching", "admin review", "automatic allocation"],
  },

  // ── 5. PROJECTS & OPERATIONS (6 items) ──
  {
    id: "projects-start-project",
    category: "projects-operations",
    categoryLabel: "Projects & Operations",
    question: "How does a client start a project with Thinkatic?",
    answer:
      "A business can contact Thinkatic to discuss its requirements. Thinkatic can then understand the required service, scope, capabilities, operational model and delivery requirements.",
    cta: {
      label: "Talk to Thinkatic",
      href: "/contact",
    },
    keywords: ["start project", "onboarding client", "kickoff", "talk to thinkatic", "scope", "engagement"],
  },
  {
    id: "projects-custom-requirements",
    category: "projects-operations",
    categoryLabel: "Projects & Operations",
    question: "Can clients request custom requirements?",
    answer:
      "Yes. Thinkatic can discuss custom technology, customer experience and business process requirements based on the client's operational needs.",
    keywords: ["custom requirements", "tailored", "bespoke", "custom scope", "specific needs"],
  },
  {
    id: "projects-how-managed",
    category: "projects-operations",
    categoryLabel: "Projects & Operations",
    question: "How are BPO projects managed?",
    answer:
      "Projects can be managed through structured workflows covering project requirements, partner allocation, agents, attendance, productivity, quality, reporting and financial processes where applicable.",
    keywords: ["project management", "workflows", "attendance", "productivity", "reporting", "operations"],
  },
  {
    id: "projects-workforce-tracking",
    category: "projects-operations",
    categoryLabel: "Projects & Operations",
    question: "How is workforce performance tracked?",
    answer:
      "Depending on the project configuration, operational information can include attendance, productivity, quality and other relevant performance information.",
    keywords: ["workforce tracking", "performance", "kpis", "attendance", "productivity", "metrics", "monitoring"],
  },
  {
    id: "projects-agents-customer-support",
    category: "projects-operations",
    categoryLabel: "Projects & Operations",
    question: "Can agents work on customer support projects?",
    answer:
      "Yes. Agents can participate in assigned customer support and business process operations according to the project and role requirements.",
    keywords: ["agents", "customer support projects", "csr", "voice agents", "chat support", "roles"],
  },
  {
    id: "projects-quality-handling",
    category: "projects-operations",
    categoryLabel: "Projects & Operations",
    question: "How does Thinkatic handle quality?",
    answer:
      "Quality can be managed through structured operational processes, relevant performance information, quality reviews, compliance requirements and reporting.",
    keywords: ["quality", "qa", "quality assurance", "compliance", "reviews", "benchmarks", "sla"],
  },

  // ── 6. TECHNOLOGY & AI (7 items) ──
  {
    id: "tech-does-thinkatic-provide-ai",
    category: "technology-ai",
    categoryLabel: "Technology & AI",
    question: "Does Thinkatic provide AI services?",
    answer:
      "Yes. Thinkatic offers AI-related services as part of its technology service offerings, including AI chatbot and AI agent solutions.",
    cta: {
      label: "Explore Technology & AI",
      href: "/technology-ai",
    },
    keywords: ["ai services", "artificial intelligence", "chatbots", "ai agents", "technology", "llm"],
    isFeatured: true,
  },
  {
    id: "tech-ai-services-available",
    category: "technology-ai",
    categoryLabel: "Technology & AI",
    question: "What AI services are available?",
    answer: "Current AI service offerings include:",
    bullets: [
      "AI Starter — $999",
      "AI Business — $2,499",
      "AI Enterprise — From $5,000+",
      "AI Automation — Custom Pricing",
      "Voice AI — Custom Pricing / Included in AI Enterprise",
    ],
    note: "Pricing and scope depend on actual project requirements. Custom pricing applies to deep workflow integrations, custom speech models, and specialized enterprise systems. AI Automation and Voice AI are never offered as zero-cost solutions.",
    keywords: ["ai pricing", "ai starter", "ai business", "ai enterprise", "ai automation", "voice ai", "cost", "packages"],
  },
  {
    id: "tech-voice-ai",
    category: "technology-ai",
    categoryLabel: "Technology & AI",
    question: "Does Thinkatic provide voice AI?",
    answer:
      "Yes. Voice AI capabilities are available as a custom service and can be included within applicable AI Enterprise engagements.",
    keywords: ["voice ai", "conversational voice", "speech", "telephony", "custom pricing", "ivr"],
  },
  {
    id: "tech-ai-automation",
    category: "technology-ai",
    categoryLabel: "Technology & AI",
    question: "Does Thinkatic provide AI automation?",
    answer:
      "Yes. AI automation can be implemented as a custom technology service based on the workflow, integrations, business requirements and implementation scope.",
    keywords: ["ai automation", "workflow automation", "integrations", "custom pricing", "automation"],
  },
  {
    id: "tech-custom-ai-agents",
    category: "technology-ai",
    categoryLabel: "Technology & AI",
    question: "Can Thinkatic build custom AI agents?",
    answer:
      "Yes. Thinkatic can discuss custom AI agent requirements including conversational workflows, business processes, integrations and human handoff requirements.",
    keywords: ["custom ai agents", "autonomous agents", "human handoff", "llm integration", "agentic"],
  },
  {
    id: "tech-ai-governance-approvals",
    category: "technology-ai",
    categoryLabel: "Technology & AI",
    question: "Does Thinkatic use AI to automatically approve BPO partners or allocate projects?",
    answer:
      "No. Important partner, project, allocation and operational decisions remain subject to authorised human/admin governance. Technology may provide information and workflow support, but it does not replace required human decision-making.",
    keywords: ["ai decision making", "human governance", "partner approval", "project allocation", "ethics", "admin control"],
  },
  {
    id: "tech-customization",
    category: "technology-ai",
    categoryLabel: "Technology & AI",
    question: "Can AI services be customized?",
    answer:
      "Yes. AI implementations can vary depending on the business process, integrations, channels, data requirements and desired functionality.",
    keywords: ["ai customization", "custom models", "channels", "integrations", "tailoring"],
  },

  // ── 7. PAYMENTS & BILLING (6 items) ──
  {
    id: "billing-how-it-works",
    category: "payments-billing",
    categoryLabel: "Payments & Billing",
    question: "How does Thinkatic billing work?",
    answer:
      "Billing depends on the selected service, project scope, commercial arrangement and applicable invoice terms.",
    keywords: ["billing", "how billing works", "invoicing", "terms", "payment schedule", "commercial"],
  },
  {
    id: "billing-payment-methods",
    category: "payments-billing",
    categoryLabel: "Payments & Billing",
    question: "What payment methods are supported?",
    answer:
      "Available payment methods depend on the applicable commercial and billing configuration. Clients should follow the payment instructions provided with their invoice.",
    keywords: ["payment methods", "bank transfer", "wire", "invoice payment", "payment options"],
  },
  {
    id: "billing-fixed-prices",
    category: "payments-billing",
    categoryLabel: "Payments & Billing",
    question: "Are all services available at fixed prices?",
    answer:
      "No. Some services have fixed package pricing, while custom, enterprise and certain technology services may use custom or starting-from pricing.",
    keywords: ["fixed pricing", "custom pricing", "starting from", "package rates", "tiers"],
  },
  {
    id: "billing-custom-checkout",
    category: "payments-billing",
    categoryLabel: "Payments & Billing",
    question: "Can custom-priced services be purchased directly online?",
    answer:
      "Custom-priced services generally require a discussion with Thinkatic to determine scope and commercial terms before payment.",
    note: "Custom solutions require a tailored statement of work to ensure accurate deliverable scoping and milestones before any payment obligations.",
    keywords: ["custom priced", "online checkout", "sow", "consultation", "instant purchase"],
  },
  {
    id: "billing-invoice-paid-status",
    category: "payments-billing",
    categoryLabel: "Payments & Billing",
    question: "When is an invoice considered paid?",
    answer:
      "An invoice is considered paid only after the applicable payment has been verified and recorded through the authorised financial workflow. Viewing payment or bank information does not itself mark an invoice as paid.",
    keywords: ["invoice paid", "payment verification", "financial workflow", "status", "reconciliation"],
  },
  {
    id: "billing-bpo-withdrawals",
    category: "payments-billing",
    categoryLabel: "Payments & Billing",
    question: "Can BPO partners withdraw approved earnings?",
    answer:
      "Eligible BPO partners can use the applicable payout and withdrawal workflow according to their available balance, payment status, approvals and applicable financial processes.",
    keywords: ["bpo earnings", "withdrawals", "payouts", "partner balance", "financial workflow", "disbursement"],
  },

  // ── 8. SECURITY & GOVERNANCE (6 items) ──
  {
    id: "security-user-access",
    category: "security-governance",
    categoryLabel: "Security & Governance",
    question: "How does Thinkatic protect user access?",
    answer:
      "Thinkatic uses role-based access controls and controlled workflows so users can access functionality according to their authorised role.",
    keywords: ["user access", "rbac", "roles", "permissions", "access control", "security"],
  },
  {
    id: "security-client-isolation",
    category: "security-governance",
    categoryLabel: "Security & Governance",
    question: "Can one client see another client's information?",
    answer:
      "Client information is designed to remain separated according to authorised access and tenant controls.",
    keywords: ["client isolation", "tenant controls", "data privacy", "multi-tenant", "separation"],
  },
  {
    id: "security-bpo-data-access",
    category: "security-governance",
    categoryLabel: "Security & Governance",
    question: "Can BPO partners access other BPO partner data?",
    answer:
      "BPO partner access is restricted to authorised information associated with their own account, centre and applicable operational workflows.",
    keywords: ["bpo partner data", "partner separation", "isolation", "operational data", "privacy"],
  },
  {
    id: "security-sensitive-documents",
    category: "security-governance",
    categoryLabel: "Security & Governance",
    question: "How are sensitive documents handled?",
    answer:
      "Sensitive documents are handled through controlled access workflows and private storage rather than public file URLs.",
    keywords: ["sensitive documents", "private storage", "document security", "controlled access", "storage"],
  },
  {
    id: "security-audit-records",
    category: "security-governance",
    categoryLabel: "Security & Governance",
    question: "Does Thinkatic maintain audit records?",
    answer:
      "Relevant administrative and operational actions can be recorded through audit and activity records to support accountability and traceability.",
    keywords: ["audit records", "audit trail", "activity logs", "traceability", "compliance", "logs"],
  },
  {
    id: "security-human-decisions",
    category: "security-governance",
    categoryLabel: "Security & Governance",
    question: "Does Thinkatic make automated high-impact business decisions?",
    answer:
      "Important partner, project, financial and operational decisions remain subject to authorised human governance.",
    note: "Human accountability is embedded into all core platform workflows, ensuring fair partner evaluations, thorough compliance checks, and secure operational alignment.",
    keywords: ["automated decisions", "human in the loop", "governance", "admin authority", "safeguards"],
  },

  // ── 9. SUPPORT & CONTACT (3 items) ──
  {
    id: "contact-how-to-contact",
    category: "support-contact",
    categoryLabel: "Support & Contact",
    question: "How can I contact Thinkatic?",
    answer:
      "You can contact Thinkatic through the Contact page to discuss services, partnerships, delivery requirements or other business enquiries.",
    cta: {
      label: "Contact Thinkatic",
      href: "/contact",
    },
    keywords: ["contact thinkatic", "reach out", "support", "email", "inquiries", "how to contact"],
  },
  {
    id: "contact-bpo-team",
    category: "support-contact",
    categoryLabel: "Support & Contact",
    question: "How can a BPO centre contact the partner team?",
    answer:
      "BPO centres can begin through the partner registration process or contact Thinkatic to discuss partnership requirements.",
    cta: {
      label: "Become a BPO Partner",
      href: "/signup?role=bpo",
    },
    keywords: ["bpo contact", "partner team", "bpo registration", "partnership inquiry", "join"],
  },
  {
    id: "contact-custom-solution",
    category: "support-contact",
    categoryLabel: "Support & Contact",
    question: "Can I request a custom solution?",
    answer:
      "Yes. Businesses can contact Thinkatic to discuss custom technology, AI, customer experience, BPO and operational requirements.",
    cta: {
      label: "Talk to Thinkatic",
      href: "/contact",
    },
    keywords: ["custom solution", "bespoke solution", "tailored requirements", "consultation", "rfp"],
  },
];

// ── Reusable Accordion Card Component ──────────────────────────────────────────
function AccordionCard({
  faq,
  isOpen,
  onToggle,
}: {
  faq: FAQItemData;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const contentId = `faq-answer-${faq.id}`;
  const buttonId = `faq-btn-${faq.id}`;

  return (
    <div
      id={`faq-${faq.id}`}
      className={`rounded-xl transition-all duration-200 border scroll-mt-28 ${
        isOpen
          ? "border-[#214ECF]/40 bg-[#F0F4FE]/40 shadow-xs"
          : "border-[#E5E7EB] bg-white hover:border-[#214ECF]/40 hover:shadow-xs"
      }`}
    >
      <button
        id={buttonId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={onToggle}
        className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 cursor-pointer group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#214ECF] rounded-xl"
      >
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80">
              {faq.categoryLabel}
            </span>
            {faq.isFeatured && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#214ECF] bg-[#214ECF]/10 px-2 py-0.5 rounded-md">
                <Sparkles size={10} />
                Popular
              </span>
            )}
          </div>
          <h3
            className={`font-semibold text-base sm:text-lg leading-snug transition-colors ${
              isOpen
                ? "text-[#214ECF]"
                : "text-[#0B1226] group-hover:text-[#214ECF]"
            }`}
          >
            {faq.question}
          </h3>
        </div>

        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 mt-0.5 ${
            isOpen
              ? "bg-[#214ECF] text-white"
              : "bg-slate-100 text-slate-600 group-hover:bg-[#214ECF]/10 group-hover:text-[#214ECF]"
          }`}
          aria-hidden="true"
        >
          {isOpen ? <Minus size={16} /> : <Plus size={16} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={contentId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: { height: { duration: 0.22, ease }, opacity: { duration: 0.18, delay: 0.05 } },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: { height: { duration: 0.18, ease }, opacity: { duration: 0.12 } },
            }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6 sm:px-6 sm:pb-6 pt-1 border-t border-[#E5E7EB]/80">
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-normal">
                {faq.answer}
              </p>

              {/* Optional Bullet Points */}
              {faq.bullets && faq.bullets.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700">
                    {faq.bullets.map((bullet, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 bg-white/80 p-2.5 rounded-lg border border-slate-200/60"
                      >
                        <Check size={14} className="text-[#214ECF] mt-0.5 flex-shrink-0" />
                        <span className="leading-snug">{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional Operational / Compliance Note */}
              {faq.note && (
                <div className="mt-4 p-3 rounded-lg bg-blue-50/60 border border-blue-100/80 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                  <Info size={14} className="text-[#214ECF] mt-0.5 flex-shrink-0" />
                  <span>{faq.note}</span>
                </div>
              )}

              {/* Optional Action CTA */}
              {faq.cta && (
                <div className="mt-5 pt-3">
                  <Link
                    href={faq.cta.href}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#214ECF] hover:text-[#1A3DB3] group/btn transition-colors"
                  >
                    <span>{faq.cta.label}</span>
                    <ArrowRight
                      size={14}
                      className="group-hover/btn:translate-x-1 transition-transform"
                    />
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main FAQPage Component ────────────────────────────────────────────────────
export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(["about-what-is-thinkatic"]));
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Inject structured data for FAQPage SEO schema
  const structuredFaqs = useMemo(
    () =>
      FAQ_DATABASE.map((item) => ({
        question: item.question,
        answer: item.bullets ? `${item.answer} ${item.bullets.join("; ")}` : item.answer,
      })),
    []
  );

  useSEO({
    title: "Thinkatic FAQs | Global BPO, Technology & Business Solutions",
    description:
      "Find answers about Thinkatic services, global delivery, BPO partnerships, technology, AI, projects, payments, security and operations.",
    path: "/faqs",
    structuredData: STRUCTURED_DATA.faqPage(structuredFaqs),
  });

  // Filtered FAQs based on category and search query
  const filteredFAQs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return FAQ_DATABASE.filter((item) => {
      // Category match
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      if (!matchesCategory) return false;

      // Query match (across question, answer, keywords, and bullets)
      if (!query) return true;

      const qMatch = item.question.toLowerCase().includes(query);
      const aMatch = item.answer.toLowerCase().includes(query);
      const kMatch = item.keywords.some((k) => k.toLowerCase().includes(query));
      const bMatch = item.bullets?.some((b) => b.toLowerCase().includes(query)) ?? false;

      return qMatch || aMatch || kMatch || bMatch;
    });
  }, [activeCategory, searchQuery]);

  // Compute question counts per category respecting the current search query
  const categoryCounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const counts: Record<CategoryId, number> = {
      all: 0,
      about: 0,
      services: 0,
      "global-delivery": 0,
      "bpo-partners": 0,
      "projects-operations": 0,
      "technology-ai": 0,
      "payments-billing": 0,
      "security-governance": 0,
      "support-contact": 0,
    };

    FAQ_DATABASE.forEach((item) => {
      const matchesQuery =
        !query ||
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query) ||
        item.keywords.some((k) => k.toLowerCase().includes(query)) ||
        (item.bullets?.some((b) => b.toLowerCase().includes(query)) ?? false);

      if (matchesQuery) {
        counts.all += 1;
        counts[item.category] += 1;
      }
    });

    return counts;
  }, [searchQuery]);

  // Toggle individual FAQ item
  const toggleFAQ = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Click on a featured / popular question: switch category if needed, ensure it is open, and scroll to it
  const handleFeaturedClick = (item: FAQItemData) => {
    setSearchQuery("");
    if (activeCategory !== "all" && activeCategory !== item.category) {
      setActiveCategory("all");
    }
    setOpenIds((prev) => new Set(prev).add(item.id));

    setTimeout(() => {
      const el = document.getElementById(`faq-${item.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const activeCategoryMeta = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50/50 pb-20">
        {/* ── SECTION 4: HERO SECTION ────────────────────────────────────────── */}
        <section className="relative pt-32 sm:pt-36 lg:pt-40 pb-16 lg:pb-20 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100/60 border-b border-slate-200/70">
          {/* Subtle Grid background */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(#214ECF 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Heading & Eyebrow */}
              <div className="lg:col-span-7 xl:col-span-8">
                <motion.div initial="hidden" animate="visible" variants={fadeUp} className="inline-flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-[#214ECF] animate-pulse" />
                  <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#214ECF]">
                    THINKATIC FAQ
                  </span>
                </motion.div>

                <motion.h1
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  transition={{ delay: 0.05 }}
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#0B1226] tracking-tight leading-[1.1] mb-6"
                >
                  Questions? <br className="hidden sm:block" />
                  <span className="text-[#214ECF]">We've Got Answers.</span>
                </motion.h1>

                <motion.p
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  transition={{ delay: 0.1 }}
                  className="text-slate-600 text-base sm:text-lg lg:text-xl max-w-2xl leading-relaxed mb-8"
                >
                  Find clear answers about Thinkatic's services, global delivery model, BPO partner network,
                  technology capabilities, AI services, projects, payments and more.
                </motion.p>

                {/* Quick Trust badges */}
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  transition={{ delay: 0.15 }}
                  className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-slate-500 font-medium pt-2"
                >
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-[#214ECF]" />
                    <span>50+ Authoritative Answers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={15} className="text-[#214ECF]" />
                    <span>Human Governance Guaranteed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 size={15} className="text-[#214ECF]" />
                    <span>Enterprise & Partner Ready</span>
                  </div>
                </motion.div>
              </div>

              {/* Right Column: Hero Visual Graphic */}
              <div className="lg:col-span-5 xl:col-span-4 flex justify-center lg:justify-end">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease }}
                  className="relative w-full max-w-[340px] sm:max-w-[380px] aspect-square rounded-3xl p-8 flex items-center justify-center border border-slate-200/90 shadow-xl overflow-hidden"
                  style={{
                    background: "linear-gradient(145deg, #FFFFFF 0%, #F0F4FE 100%)",
                  }}
                >
                  {/* Subtle decorative circles & animated nodes */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-400/10 rounded-full blur-2xl" />
                    <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#214ECF]/10 rounded-full blur-2xl" />
                  </div>

                  {/* SVG Question Mark & Connected Network Nodes */}
                  <svg
                    viewBox="0 0 300 300"
                    className="w-full h-full text-[#214ECF] drop-shadow-sm select-none"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Concentric subtle radar rings */}
                    <circle cx="150" cy="150" r="130" stroke="#214ECF" strokeOpacity="0.08" strokeWidth="1.5" strokeDasharray="4 4" />
                    <circle cx="150" cy="150" r="95" stroke="#214ECF" strokeOpacity="0.12" strokeWidth="1.5" />
                    <circle cx="150" cy="150" r="60" stroke="#214ECF" strokeOpacity="0.16" strokeWidth="1" strokeDasharray="3 3" />

                    {/* Connection lines from centre to nodes */}
                    <line x1="150" y1="65" x2="225" y2="90" stroke="#214ECF" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="2 2" />
                    <line x1="150" y1="140" x2="70" y2="120" stroke="#214ECF" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="2 2" />
                    <line x1="150" y1="210" x2="230" y2="215" stroke="#214ECF" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="2 2" />
                    <line x1="150" y1="240" x2="80" y2="230" stroke="#214ECF" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="2 2" />

                    {/* Central Question Mark Outline */}
                    <path
                      d="M130 95 C130 72 142 55 160 55 C178 55 192 68 192 88 C192 108 178 120 162 135 C154 142 150 152 150 166"
                      stroke="#214ECF"
                      strokeWidth="14"
                      strokeLinecap="round"
                    />
                    <circle cx="150" cy="205" r="9" fill="#214ECF" />

                    {/* Satellite Connected Nodes */}
                    <g className="animate-pulse">
                      <circle cx="225" cy="90" r="7" fill="#214ECF" />
                      <circle cx="225" cy="90" r="14" stroke="#214ECF" strokeOpacity="0.2" strokeWidth="2" />
                    </g>
                    <g>
                      <circle cx="70" cy="120" r="6" fill="#3B82F6" />
                      <circle cx="70" cy="120" r="12" stroke="#3B82F6" strokeOpacity="0.2" strokeWidth="1.5" />
                    </g>
                    <g>
                      <circle cx="230" cy="215" r="5" fill="#1D4ED8" />
                      <circle cx="230" cy="215" r="10" stroke="#1D4ED8" strokeOpacity="0.2" strokeWidth="1.5" />
                    </g>
                    <g>
                      <circle cx="80" cy="230" r="6" fill="#214ECF" />
                      <circle cx="80" cy="230" r="12" stroke="#214ECF" strokeOpacity="0.2" strokeWidth="1.5" />
                    </g>

                    {/* Mini node icons */}
                    <text x="215" y="70" fill="#0B1226" fontSize="9" fontWeight="bold" fontFamily="monospace">BPO</text>
                    <text x="45" y="105" fill="#0B1226" fontSize="9" fontWeight="bold" fontFamily="monospace">TECH</text>
                    <text x="220" y="240" fill="#0B1226" fontSize="9" fontWeight="bold" fontFamily="monospace">AI</text>
                    <text x="50" y="250" fill="#0B1226" fontSize="9" fontWeight="bold" fontFamily="monospace">OPS</text>
                  </svg>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 5: REAL-TIME FAQ SEARCH BAR ───────────────────────────── */}
        <section className="relative -mt-8 z-20 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-lg shadow-slate-200/50">
            <div className="max-w-3xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-[#0B1226]">
                  How can we help?
                </h2>
                <span className="text-xs font-semibold text-slate-500">
                  {filteredFAQs.length} {filteredFAQs.length === 1 ? "question found" : "questions found"}
                </span>
              </div>

              {/* Search Input Box */}
              <div className="relative flex items-center">
                <Search
                  size={20}
                  className="absolute left-4 text-slate-400 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search your question..."
                  aria-label="Search your question"
                  className="w-full h-13 pl-12 pr-12 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 text-sm sm:text-base focus:bg-white focus:border-[#214ECF] focus:ring-4 focus:ring-[#214ECF]/10 focus:outline-hidden transition-all duration-150"
                />
                {searchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    aria-label="Clear search query"
                    className="absolute right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {searchQuery.trim().length > 0 && (
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Filtering results for: <strong className="text-slate-800 font-semibold">"{searchQuery}"</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-[#214ECF] hover:underline font-semibold cursor-pointer"
                  >
                    Clear search
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── SECTION 6 & 7: CATEGORY NAVIGATION & TWO-COLUMN LAYOUT ──────── */}
        <section className="pt-10 sm:pt-14 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile Category Scrollable Bar */}
          <div className="lg:hidden mb-8">
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
              Filter by Category
            </p>
            <div className="flex gap-2 overflow-x-auto pb-3 pt-1 -mx-4 px-4 scrollbar-none">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const count = categoryCounts[cat.id];
                const isActive = activeCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all duration-150 flex-shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-[#214ECF] text-white border-[#214ECF] shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={14} className={isActive ? "text-white" : "text-[#214ECF]"} />
                    <span>{cat.shortLabel}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">
            {/* ── LEFT COLUMN: STICKY CATEGORY SIDEBAR (DESKTOP) ── */}
            <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-28">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
                <div className="px-3 py-2.5 mb-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    FAQ CATEGORIES
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-400">
                    {categoryCounts.all} Total
                  </span>
                </div>

                <nav className="space-y-1" aria-label="FAQ Categories">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const count = categoryCounts[cat.id];
                    const isActive = activeCategory === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 text-left cursor-pointer group ${
                          isActive
                            ? "bg-blue-50/90 text-[#214ECF] font-bold border-l-3 border-[#214ECF]"
                            : "text-slate-700 hover:bg-slate-50 hover:text-[#214ECF]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          <Icon
                            size={16}
                            className={`flex-shrink-0 transition-colors ${
                              isActive ? "text-[#214ECF]" : "text-slate-400 group-hover:text-[#214ECF]"
                            }`}
                          />
                          <span className="truncate">{cat.label}</span>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0 ${
                            isActive
                              ? "bg-[#214ECF] text-white font-bold"
                              : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </nav>

                {/* Sidebar Helper Box */}
                <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-slate-900 to-[#0B1226] text-white">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-300 mb-1.5">
                    <Sparkles size={14} className="text-blue-300" />
                    <span>Need specific answers?</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    Connect directly with our advisory team to discuss custom services or BPO partnership requirements.
                  </p>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#214ECF] hover:bg-[#1A3DB3] px-3.5 py-2 rounded-lg transition-colors w-full justify-center"
                  >
                    <span>Talk to Thinkatic</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </aside>

            {/* ── RIGHT COLUMN: FEATURED QUESTIONS & ACCORDION LIST ── */}
            <main className="lg:col-span-8 xl:col-span-9 space-y-8">
              {/* ── SECTION 17: FEATURED FAQ / MOST ASKED QUESTIONS ── */}
              {searchQuery.trim().length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={16} className="text-[#214ECF]" />
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#214ECF]">
                      MOST ASKED QUESTIONS
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {FAQ_DATABASE.filter((f) => f.isFeatured).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleFeaturedClick(item)}
                        className="text-left p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50/60 hover:border-[#214ECF]/50 transition-all duration-150 group cursor-pointer flex flex-col justify-between h-full"
                      >
                        <span className="text-xs font-semibold text-slate-800 group-hover:text-[#214ECF] leading-snug line-clamp-2">
                          {item.featuredTitle || item.question}
                        </span>
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200/60 text-[11px] text-slate-500 font-medium">
                          <span>{item.categoryLabel}</span>
                          <ArrowRight
                            size={12}
                            className="text-slate-400 group-hover:text-[#214ECF] group-hover:translate-x-0.5 transition-transform"
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Header or Search Result Notice */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0B1226]">
                    {searchQuery.trim().length > 0 ? "Search Results" : activeCategoryMeta.label}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    {searchQuery.trim().length > 0
                      ? `Showing questions matching "${searchQuery}"`
                      : activeCategoryMeta.description}
                  </p>
                </div>

                {/* Expand All / Collapse All controls */}
                {filteredFAQs.length > 0 && (
                  <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                    <button
                      type="button"
                      onClick={() => setOpenIds(new Set(filteredFAQs.map((f) => f.id)))}
                      className="px-2.5 py-1 rounded-md text-slate-600 hover:text-[#214ECF] hover:bg-slate-100 font-medium transition-colors cursor-pointer"
                    >
                      Expand all
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setOpenIds(new Set())}
                      className="px-2.5 py-1 rounded-md text-slate-600 hover:text-[#214ECF] hover:bg-slate-100 font-medium transition-colors cursor-pointer"
                    >
                      Collapse all
                    </button>
                  </div>
                )}
              </div>

              {/* ── FAQ ACCORDION LIST ── */}
              {filteredFAQs.length > 0 ? (
                <div className="space-y-3.5">
                  {filteredFAQs.map((faq) => (
                    <AccordionCard
                      key={faq.id}
                      faq={faq}
                      isOpen={openIds.has(faq.id)}
                      onToggle={() => toggleFAQ(faq.id)}
                    />
                  ))}
                </div>
              ) : (
                /* Empty state when search produces 0 results */
                <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-12 text-center max-w-lg mx-auto shadow-xs">
                  <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4 text-[#214ECF]">
                    <AlertCircle size={26} />
                  </div>
                  <h3 className="text-lg font-bold text-[#0B1226] mb-2">
                    No matching questions found.
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Try another search term or contact our team directly for tailored guidance on your business or
                    partnership needs.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Reset Search
                    </button>
                    <Link
                      href="/contact"
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-colors inline-flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>Contact Thinkatic</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              )}
            </main>
          </div>
        </section>

        {/* ── SECTION 20 & 21: CONTACT CTA & BPO PARTNERSHIP CTA ───────────── */}
        <section className="pt-20 sm:pt-28 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* SECTION 20: Still Have Questions? (Dark Navy Enterprise Card) */}
          <div
            className="relative rounded-3xl p-8 sm:p-12 lg:p-16 overflow-hidden text-white shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #0B1226 0%, #1E293B 100%)",
            }}
          >
            {/* Subtle background SVG network lines */}
            <div className="absolute inset-0 opacity-15 pointer-events-none">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="faq-cta-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#214ECF" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#faq-cta-grid)" />
              </svg>
            </div>

            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-blue-400">
                  CONNECT WITH OUR TEAM
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-4">
                Still Have Questions?
              </h2>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl">
                Every business has different requirements. Talk to Thinkatic about your specific technology,
                customer experience, BPO or operational needs.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                <Link
                  href="/contact"
                  className="px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all duration-150 shadow-md text-center inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Talk to Thinkatic</span>
                  <ArrowRight size={15} />
                </Link>

                <Link
                  href="/services"
                  className="px-6 py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-200 border border-slate-700 hover:bg-white/10 hover:border-slate-500 transition-all duration-150 text-center inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Explore Our Services</span>
                  <ExternalLink size={14} />
                </Link>
              </div>
            </div>
          </div>

          {/* SECTION 21: BPO Partnership CTA (Clean White Card) */}
          <div className="rounded-3xl p-8 sm:p-10 lg:p-12 bg-white border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-[#214ECF] uppercase tracking-wider mb-2">
                <Users size={14} />
                <span>BPO DELIVERY PARTNERSHIP</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#0B1226] mb-3">
                Looking to Join the Thinkatic Network?
              </h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Become part of a structured delivery ecosystem built around verified BPO capabilities,
                operational visibility and global business opportunities.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Note: Commercial opportunities depend on verified capabilities, compliance, and client requirements.
                Thinkatic does not make income guarantees.
              </p>
            </div>

            <div className="flex-shrink-0">
              <Link
                href="/signup?role=bpo"
                className="px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all duration-150 shadow-sm inline-flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <span>Become a BPO Partner</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
