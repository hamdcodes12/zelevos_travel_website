import {
  Shield,
  FileText,
  Handshake,
  Briefcase,
  Lock,
  Database,
  CheckCircle,
  BadgeCheck,
  CreditCard,
  AlertTriangle,
  MessageSquare,
  Cookie,
  type LucideIcon,
} from "lucide-react";

export interface LegalSubSection {
  title?: string;
  body?: string;
  bullets?: string[];
  note?: string;
  highlight?: boolean;
}

export interface LegalSection {
  number: string;
  title: string;
  body?: string;
  bullets?: string[];
  subsections?: LegalSubSection[];
  callout?: string;
  highlight?: boolean;
  type?: "default" | "prohibited" | "steps" | "cards" | "checklist";
}

export interface LegalDocument {
  slug: string;
  path: string;
  title: string;
  shortTitle: string;
  badge: "POLICY" | "AGREEMENT" | "STANDARDS" | "TERMS";
  icon: LucideIcon;
  effectiveDate: string;
  subtitle: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  disclaimer?: string;
  intro?: string;
  sections: LegalSection[];
  closingNote?: string;
}

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    slug: "privacy-policy",
    path: "/legal/privacy-policy",
    title: "Privacy Policy",
    shortTitle: "Privacy Policy",
    badge: "POLICY",
    icon: Shield,
    effectiveDate: "19 September 2026",
    subtitle: "How Thinkatic collects, uses, stores, protects, and shares data across our BPO platform.",
    description: "This Privacy Policy explains how Thinkatic (“Thinkatic”, “we”, “us” or “our”) collects, uses, stores, protects and shares information relating to visitors, BPO clients, partner centres, centre owners, administrators, agents, applicants and users of the Thinkatic website and BPO portal.",
    seoTitle: "Thinkatic Privacy Policy | Global BPO & Enterprise Technology",
    seoDescription: "Official Privacy Policy for Thinkatic BPO services, client portals, partner onboarding, and global delivery systems. Effective 19 September 2026.",
    intro: "This Privacy Policy explains how Thinkatic (“Thinkatic”, “we”, “us” or “our”) collects, uses, stores, protects and shares information relating to visitors, BPO clients, partner centres, centre owners, administrators, agents, applicants and users of the Thinkatic website and BPO portal.",
    sections: [
      {
        number: "1",
        title: "Scope",
        body: "This Policy applies to the Thinkatic website, partner portal, client portal, applications, forms, communications and related BPO services. It does not automatically govern data processing performed by a client or partner centre under its own independent legal obligations.",
      },
      {
        number: "2",
        title: "Information We May Collect",
        body: "We may collect business and contact information such as name, company/centre name, email, telephone number, address, designation and registration information. For partner-centre onboarding, we may collect centre infrastructure details, experience, workforce information, documents required for verification, bank/payment information, authorized-user information and compliance records. For portal use, we may collect login credentials, access logs, device information, IP address, activity logs, project assignments, performance records and support communications. Where projects require it, client-provided or agent-related information may be processed only for authorized business purposes.",
      },
      {
        number: "3",
        title: "How We Use Information",
        body: "We use information to provide BPO services, evaluate applications, onboard centres and clients, coordinate projects, verify operations, manage access, process payments, monitor quality, detect fraud, investigate incidents, comply with laws and communicate about operations.",
      },
      {
        number: "4",
        title: "Sharing",
        body: "We do not sell personal data. Information may be shared between Thinkatic, clients and partner centres only to the extent necessary for project execution, quality management, billing and compliance. Information may also be shared with service providers (such as hosting, communications, verification, payment and legal/accounting providers), or where required by law, subpoena, regulatory inquiry or to protect rights and safety.",
      },
      {
        number: "5",
        title: "Data Security",
        body: "Thinkatic implements reasonable technical, organizational and operational safeguards appropriate to its business. Users must protect login credentials and report unauthorized access immediately.",
      },
      {
        number: "6",
        title: "Retention",
        body: "Information is retained for as long as necessary to provide services, administer contracts, resolve disputes, maintain audit trails and satisfy statutory retention obligations.",
      },
      {
        number: "7",
        title: "International Processing",
        body: "Because Thinkatic may work with US/UK clients and international projects, information may be processed or accessed across jurisdictions where necessary for the contracted service, subject to applicable contractual and legal safeguards.",
      },
      {
        number: "8",
        title: "Rights and Requests",
        body: "Subject to applicable law, individuals may request access, correction, deletion or other available rights regarding their personal information. Requests can be submitted through the contact/grievance channel published by Thinkatic. Identity verification may be required.",
      },
      {
        number: "9",
        title: "Children",
        body: "Thinkatic's BPO services are business services and are not directed to children. We do not knowingly request unnecessary personal information from children.",
      },
      {
        number: "10",
        title: "Changes",
        body: "Thinkatic may update this Policy from time to time. The revised version will be published with an updated effective date.",
      },
      {
        number: "11",
        title: "Contact",
        body: "Privacy-related questions should be sent to the official Thinkatic support/privacy contact published on the website.",
      },
    ],
    closingNote: "This document is a business-policy template and should be reviewed against the exact Thinkatic entity, jurisdictions, client contracts and applicable data-protection laws before publication.",
  },
  {
    slug: "terms",
    path: "/legal/terms",
    title: "Terms & Conditions",
    shortTitle: "Terms & Conditions",
    badge: "TERMS",
    icon: FileText,
    effectiveDate: "19 September 2026",
    subtitle: "Rules and conditions governing access to the Thinkatic website, BPO portal, and services.",
    description: "These Terms & Conditions govern access to the Thinkatic website, BPO portal and related services.",
    seoTitle: "Thinkatic Terms & Conditions | Official Platform Terms",
    seoDescription: "Official Terms and Conditions for access to the Thinkatic website, BPO partner portal, client portal, and related services. Effective 19 September 2026.",
    intro: "These Terms & Conditions govern access to the Thinkatic website, BPO portal and related services.",
    sections: [
      {
        number: "1",
        title: "Acceptance",
        body: "By accessing or using Thinkatic services, a user confirms that they are authorized to act for themselves or their organization and agree to these Terms and any applicable project-specific agreement.",
      },
      {
        number: "2",
        title: "Thinkatic's Role",
        body: "Thinkatic operates as a BPO global delivery partner and may facilitate relationships between clients and verified partner centres. The exact role, responsibilities and commercial model for a project are governed by the applicable Client Agreement and Partner Agreement.",
      },
      {
        number: "3",
        title: "Account Registration",
        body: "Users must provide accurate information and maintain the confidentiality of login credentials. Accounts may not be transferred without authorization. Organizations are responsible for activity conducted through their authorized accounts.",
      },
      {
        number: "4",
        title: "Portal Use",
        body: "Users must use the portal only for legitimate business purposes and only for projects and functions they are authorized to access.",
      },
      {
        number: "5",
        title: "Project Instructions",
        body: "Partner centres must follow approved project instructions, scripts, quality standards, security procedures, client requirements and Thinkatic communications.",
      },
      {
        number: "6",
        title: "Prohibited Conduct",
        body: "Users may not misuse client data; share credentials; bypass access controls; copy or distribute confidential project materials without authorization; submit false information; manipulate performance data; engage in fraudulent activity; use project data for personal purposes; or interfere with the portal.",
        highlight: true,
      },
      {
        number: "7",
        title: "Intellectual Property",
        body: "Thinkatic, clients and third parties retain ownership of their respective trademarks, software, documents, scripts, databases and other intellectual property unless an agreement expressly states otherwise.",
      },
      {
        number: "8",
        title: "Third-Party Services",
        body: "Thinkatic may use third-party technology, communication, cloud, analytics, payment or verification services. Their availability may depend on third-party systems.",
      },
      {
        number: "9",
        title: "Suspension",
        body: "Thinkatic may restrict access where reasonably necessary for security, compliance, suspected misuse, non-payment, breach of contract, client requirements or operational risk.",
      },
      {
        number: "10",
        title: "Liability",
        body: "To the extent permitted by law and the applicable contract, Thinkatic is not responsible for indirect losses, third-party failures or events outside its reasonable control. Project-specific liability is governed by the applicable agreement.",
      },
      {
        number: "11",
        title: "Changes",
        body: "Thinkatic may update website or portal terms. Material changes should be communicated through the portal or other reasonable means.",
      },
      {
        number: "12",
        title: "Governing Law",
        body: "The governing law, jurisdiction and dispute-resolution mechanism should be specified in the final executed agreement based on Thinkatic's legal entity and transaction structure.",
      },
      {
        number: "13",
        title: "Contact",
        body: "Questions regarding these Terms should be sent to Thinkatic through the official contact channel.",
      },
    ],
  },
  {
    slug: "partner-agreement",
    path: "/legal/partner-agreement",
    title: "Partner BPO Centre Agreement",
    shortTitle: "Partner Agreement",
    badge: "AGREEMENT",
    icon: Handshake,
    effectiveDate: "19 September 2026",
    subtitle: "Standard contractual framework between Thinkatic and independent BPO delivery partners.",
    description: "This Agreement is intended for Thinkatic and an independent BPO/call-centre partner for the delivery of authorized BPO projects.",
    seoTitle: "Thinkatic Partner BPO Centre Agreement | Standard Terms",
    seoDescription: "Informational overview of Thinkatic's standard Partner BPO Centre Agreement, operational obligations, agent management, and compliance standards.",
    intro: "This Agreement is intended for Thinkatic and an independent BPO/call-centre partner for the delivery of authorized BPO projects.",
    sections: [
      {
        number: "1",
        title: "Parties",
        body: "Thinkatic and the partner centre identified in the onboarding records enter into this Agreement for the delivery of authorized BPO projects.",
      },
      {
        number: "2",
        title: "Appointment",
        body: "Thinkatic may appoint the Partner as a delivery centre for specific projects. Appointment does not guarantee any minimum volume, project duration or earnings unless expressly stated in writing.",
      },
      {
        number: "3",
        title: "Centre Responsibilities",
        body: "The Partner shall maintain suitable premises, internet connectivity, computers, headsets, power backup, trained personnel, supervision, quality controls and other infrastructure required for each assigned process.",
      },
      {
        number: "4",
        title: "Agents",
        body: "The Partner is responsible for recruitment, employment/engagement, attendance, payroll, discipline, training and lawful management of its agents unless a project agreement states otherwise.",
      },
      {
        number: "5",
        title: "Project Compliance",
        body: "The Partner shall follow project SOPs, scripts, approved calling hours, quality requirements, security controls, client instructions and Thinkatic policies.",
      },
      {
        number: "6",
        title: "Data and Confidentiality",
        body: "Partner shall access only the data required for assigned work, shall not download or copy data without authorization, shall not disclose project information and shall immediately report suspected data loss or security incidents.",
        highlight: true,
      },
      {
        number: "7",
        title: "Monitoring and Quality",
        body: "Thinkatic and/or the client may monitor service quality, productivity, attendance, call outcomes and compliance subject to applicable law and project requirements.",
      },
      {
        number: "8",
        title: "Credentials",
        body: "Centre IDs and user credentials are personal to authorized users. Sharing credentials or allowing unauthorized access is prohibited.",
      },
      {
        number: "9",
        title: "Payments",
        body: "Partner compensation will be determined by the applicable project commercial terms. Payment may depend on verified production, quality, attendance, approved outcomes, client acceptance and compliance.",
      },
      {
        number: "10",
        title: "No Guaranteed Work",
        body: "Unless expressly agreed, Thinkatic does not guarantee continuous projects, minimum call volume, minimum agents or minimum revenue.",
      },
      {
        number: "11",
        title: "Audit",
        body: "Thinkatic may conduct reasonable operational, security and compliance checks. The Partner shall cooperate and provide relevant records.",
      },
      {
        number: "12",
        title: "Subcontracting",
        body: "The Partner may not subcontract project work or transfer client data to another centre without written authorization.",
        highlight: true,
      },
      {
        number: "13",
        title: "Non-Solicitation and Direct Dealings",
        body: "Any restrictions relating to direct solicitation of Thinkatic clients, agents or projects should be stated in the project-specific contract and drafted to comply with applicable law.",
      },
      {
        number: "14",
        title: "Term and Termination",
        body: "Either party may terminate in accordance with the agreed notice period. Thinkatic may suspend or terminate immediately where there is serious security risk, fraud, unauthorized data disclosure, material breach or client-directed termination, subject to applicable law and contract.",
      },
      {
        number: "15",
        title: "Return/Deletion",
        body: "On project completion or termination, the Partner shall return or securely delete project materials and data as instructed, subject to legal retention requirements.",
      },
      {
        number: "16",
        title: "Independent Contractor",
        body: "The Partner operates as an independent business and is responsible for its personnel, taxes, licenses and employment obligations unless otherwise agreed.",
      },
      {
        number: "17",
        title: "Disputes",
        body: "Dispute resolution, governing law and jurisdiction should be completed in the signed version.",
      },
      {
        number: "18",
        title: "Signatures",
        body: "The final agreement should identify the legal names, addresses, authorized representatives, project schedules and commercial annexures.",
      },
    ],
    closingNote: "Notice: This public page contains the informational standard policy framework. Individual partner onboarding utilizes project-specific executed agreements and schedules.",
  },
  {
    slug: "client-agreement",
    path: "/legal/client-agreement",
    title: "Client BPO Service Agreement",
    shortTitle: "Client Agreement",
    badge: "AGREEMENT",
    icon: Briefcase,
    effectiveDate: "19 September 2026",
    subtitle: "Enterprise service terms governing BPO coordination, delivery, SLAs, and data security.",
    description: "This Agreement governs the relationship between Thinkatic and enterprise BPO clients for project coordination, delivery, and workforce operations.",
    seoTitle: "Thinkatic Client BPO Service Agreement | Master Service Terms",
    seoDescription: "Standard Client BPO Service Agreement framework outlining scope, Statements of Work, client responsibilities, SLAs, and security standards.",
    sections: [
      {
        number: "1",
        title: "Services",
        body: "Thinkatic may provide BPO project coordination, partner-centre sourcing, workforce allocation, quality oversight, technology access and operational management as described in an applicable Statement of Work (SOW).",
      },
      {
        number: "2",
        title: "Statement of Work",
        body: "Each engagement will be defined in a written SOW specifying scope, volume, pricing, service levels, agent profiles, systems and project rules.",
      },
      {
        number: "3",
        title: "Client Responsibilities",
        body: "The Client shall provide accurate project information, lawful instructions, approved scripts/materials, required systems or access, training information and timely operational feedback.",
      },
      {
        number: "4",
        title: "Project Data",
        body: "The Client determines the permitted use of its customer and project data and shall provide only data it is legally entitled to provide. The parties shall define controller/processor roles and responsibilities for each project.",
      },
      {
        number: "5",
        title: "Partner Centre Delivery",
        body: "Thinkatic may allocate work to one or more approved partner centres unless the SOW requires a named centre.",
      },
      {
        number: "6",
        title: "Quality and KPIs",
        body: "KPIs, SLAs, quality thresholds, service credits and escalation procedures should be stated in the SOW rather than assumed.",
      },
      {
        number: "7",
        title: "Fees",
        body: "Fees may be based on agents, hours, productive hours, calls, qualified outcomes, sales, collections or another agreed metric.",
      },
      {
        number: "8",
        title: "Confidentiality",
        body: "Both parties shall protect confidential information and use it only for the agreed business purpose.",
      },
      {
        number: "9",
        title: "Security",
        body: "The parties shall maintain reasonable security controls appropriate to the project and promptly cooperate on security incidents.",
      },
      {
        number: "10",
        title: "Intellectual Property",
        body: "Pre-existing IP remains with its owner. Ownership of custom work product, scripts, reports, configurations and other deliverables should be expressly stated in the SOW.",
      },
      {
        number: "11",
        title: "Audit and Reporting",
        body: "Thinkatic may provide agreed operational reports. Client audit rights should be reasonable and must protect other clients' confidential information.",
      },
      {
        number: "12",
        title: "Termination",
        body: "The agreement should specify notice periods and immediate termination events including material breach, fraud, unlawful activity, security incidents or insolvency.",
      },
      {
        number: "13",
        title: "Liability",
        body: "Liability caps, exclusions and indemnities should be negotiated and stated clearly in the executed agreement.",
      },
      {
        number: "14",
        title: "Force Majeure",
        body: "Neither party should be liable for delays caused by events beyond reasonable control, subject to contractual notice and mitigation obligations.",
      },
      {
        number: "15",
        title: "Governing Law and Dispute Resolution",
        body: "Complete this section based on the final legal entity and commercial arrangement.",
      },
    ],
  },
  {
    slug: "nda",
    path: "/legal/nda",
    title: "Mutual Confidentiality Agreement (NDA)",
    shortTitle: "NDA / Confidentiality",
    badge: "AGREEMENT",
    icon: Lock,
    effectiveDate: "19 September 2026",
    subtitle: "Mutual commitments protecting proprietary data, business plans, and project materials.",
    description: "This Mutual Non-Disclosure Agreement governs confidential information exchanged between Thinkatic, enterprise clients, and BPO partners.",
    seoTitle: "Thinkatic Mutual Confidentiality Agreement (NDA) | Master Terms",
    seoDescription: "Standard Mutual Confidentiality Agreement (NDA) for Thinkatic BPO evaluations, partnerships, client projects, and operations.",
    sections: [
      {
        number: "1",
        title: "Purpose",
        body: "The parties may exchange confidential information to evaluate, establish or perform a BPO relationship.",
      },
      {
        number: "2",
        title: "Confidential Information",
        body: "Confidential Information includes client lists, customer information, scripts, call flows, pricing, business plans, technology, credentials, training material, performance data, reports, project documentation and other information identified or reasonably understood as confidential.",
      },
      {
        number: "3",
        title: "Obligations",
        body: "The receiving party shall use Confidential Information only for the authorized purpose; restrict access to personnel with a need to know; apply reasonable security measures; and not disclose information to unauthorized third parties.",
      },
      {
        number: "4",
        title: "Exclusions",
        body: "Information is not confidential if it is publicly available without breach, already lawfully known, independently developed without use of confidential information, or lawfully received from another source without confidentiality obligations.",
      },
      {
        number: "5",
        title: "Required Disclosure",
        body: "Disclosure required by law or a valid authority may be made to the extent legally required, preferably after notice where legally permitted.",
      },
      {
        number: "6",
        title: "Data",
        body: "Personal data shall be handled in accordance with applicable data-protection requirements and the applicable Data Processing Agreement or project terms.",
      },
      {
        number: "7",
        title: "Return and Destruction",
        body: "Upon request or termination, confidential material shall be returned or securely destroyed subject to lawful retention obligations.",
      },
      {
        number: "8",
        title: "Duration",
        body: "Confidentiality obligations should continue for the period specified in the signed agreement, with trade secrets protected for as long as they remain legally protected.",
      },
      {
        number: "9",
        title: "No License",
        body: "Disclosure does not transfer ownership or grant an IP license except as expressly agreed.",
      },
      {
        number: "10",
        title: "Remedies",
        body: "The parties may seek contractual and lawful remedies for unauthorized disclosure, subject to applicable law.",
      },
    ],
  },
  {
    slug: "data-protection",
    path: "/legal/data-protection",
    title: "Data Protection & Processing Policy",
    shortTitle: "Data Protection",
    badge: "POLICY",
    icon: Database,
    effectiveDate: "19 September 2026",
    subtitle: "Baseline operational and technical requirements for processing customer and project data.",
    description: "This Policy establishes baseline requirements for handling personal and project data in Thinkatic BPO operations.",
    seoTitle: "Thinkatic Data Protection & Processing Policy | Global Standards",
    seoDescription: "Official data protection and processing requirements for Thinkatic global delivery operations, access control, encryption, and subprocessors.",
    sections: [
      {
        number: "1",
        title: "Purpose",
        body: "This Policy establishes baseline requirements for handling personal and project data in Thinkatic BPO operations.",
      },
      {
        number: "2",
        title: "Roles",
        body: "For each project, the contract should identify whether Thinkatic, the Client or another party acts as data controller/business and whether Thinkatic or a Partner acts as processor/service provider. Roles must not be assumed solely from job titles.",
      },
      {
        number: "3",
        title: "Data Minimization",
        body: "Only data necessary for the authorized process may be accessed, collected, viewed, recorded or transferred.",
      },
      {
        number: "4",
        title: "Access Control",
        body: "Access shall be role-based where practical. Shared credentials are prohibited. Access should be removed when personnel leave or no longer require it.",
      },
      {
        number: "5",
        title: "Security",
        body: "Partners should maintain reasonable controls including secure devices, password protection, endpoint protection, restricted physical access, clean-desk practices and appropriate network security.",
      },
      {
        number: "6",
        title: "Recording and Monitoring",
        body: "Call recordings, screenshots, monitoring logs and quality records may be created only where authorized and lawful for the project.",
      },
      {
        number: "7",
        title: "Data Transfer",
        body: "Data must be transferred only through approved systems and channels. Personal email, consumer messaging applications, removable media or unauthorized cloud storage should not be used for project data unless expressly approved.",
        highlight: true,
      },
      {
        number: "8",
        title: "Incident Reporting",
        body: "Any suspected unauthorized access, disclosure, malware event, lost device, credential compromise or accidental transmission must be reported promptly through the designated incident channel.",
      },
      {
        number: "9",
        title: "Retention and Deletion",
        body: "Project data shall be retained only as instructed by the Client/Thinkatic and applicable law. At project end, data must be returned or securely deleted where required.",
      },
      {
        number: "10",
        title: "Subprocessors",
        body: "Partners may not appoint additional processors or transfer project data to another centre without authorization.",
      },
      {
        number: "11",
        title: "Cross-Border Processing",
        body: "US/UK projects may involve international data flows. Contractual safeguards and applicable legal requirements should be addressed project-by-project.",
      },
      {
        number: "12",
        title: "Training",
        body: "Personnel handling project data should receive appropriate confidentiality, security and process training before access is granted.",
      },
      {
        number: "13",
        title: "Audit",
        body: "Thinkatic may require reasonable evidence of compliance, including policies, training records, access lists and security checks.",
      },
    ],
  },
  {
    slug: "acceptable-use",
    path: "/legal/acceptable-use",
    title: "Acceptable Use Policy",
    shortTitle: "Acceptable Use",
    badge: "STANDARDS",
    icon: CheckCircle,
    effectiveDate: "19 September 2026",
    subtitle: "Clear standards separating authorized operations from strictly prohibited conduct.",
    description: "Standards and guidelines defining permitted operations and prohibited behavior on all Thinkatic systems and projects.",
    seoTitle: "Thinkatic Acceptable Use Policy | Platform Standards",
    seoDescription: "Permitted operations, compliance obligations, and strictly prohibited activities across Thinkatic BPO portals and enterprise tools.",
    sections: [
      {
        number: "1",
        title: "Required & Permitted Conduct",
        body: "Users of Thinkatic systems and projects must adhere to the following operational standards:",
        bullets: [
          "Use credentials only for authorized access.",
          "Use client data only for the assigned project.",
          "Follow approved scripts, SOPs and calling rules.",
          "Protect customer information and confidential materials.",
          "Use approved systems, dialers and communication channels.",
          "Report suspected fraud, security incidents or data leakage.",
          "Maintain accurate attendance, production and quality records.",
        ],
        type: "checklist",
      },
      {
        number: "2",
        title: "Prohibited Activities",
        body: "The following activities are strictly prohibited across all Thinkatic networks, systems, and partner centres:",
        bullets: [
          "Sharing login credentials.",
          "Copying, selling or exporting client/customer data.",
          "Using project data for personal purposes.",
          "Manipulating calls, leads, dispositions, sales or performance records.",
          "Misrepresenting Thinkatic, a client or a project.",
          "Unauthorized recording or disclosure of calls.",
          "Circumventing security controls.",
          "Installing unauthorized software on project systems where prohibited.",
          "Subcontracting work without approval.",
          "Using client information to solicit customers independently.",
          "Attempting to access another centre's data or projects.",
          "Engaging in unlawful, fraudulent or abusive activity.",
        ],
        type: "prohibited",
      },
      {
        number: "3",
        title: "Enforcement & Consequences",
        body: "Violations may result in investigation, access restriction, suspension, termination, recovery of losses where contractually permitted and referral to authorities where required.",
        callout: "Zero Tolerance Policy: Data theft, unauthorized external export, credential brokering, and fraudulent dialer manipulations result in immediate termination and legal action.",
      },
    ],
  },
  {
    slug: "partner-eligibility",
    path: "/legal/partner-eligibility",
    title: "Partner Eligibility & Compliance",
    shortTitle: "Eligibility & Compliance",
    badge: "STANDARDS",
    icon: BadgeCheck,
    effectiveDate: "19 September 2026",
    subtitle: "Operational, infrastructure, and legal criteria required for BPO delivery centre accreditation.",
    description: "Criteria and continuous compliance standards required for an independent BPO partner centre to receive and maintain accreditation.",
    seoTitle: "Thinkatic Partner Eligibility & Compliance | Accreditation Criteria",
    seoDescription: "Legal, technical, infrastructure, and staffing criteria for Thinkatic BPO delivery partners and global partner centres.",
    intro: "A prospective partner centre should satisfy requirements appropriate to the assigned process before approval and project assignment.",
    sections: [
      {
        number: "1",
        title: "Legal and Business Criteria",
        bullets: [
          "Valid legal/business identity and contact details.",
          "Authorized representative.",
          "Applicable registrations, licenses and tax documentation.",
          "Valid bank/payment details.",
        ],
        type: "checklist",
      },
      {
        number: "2",
        title: "Infrastructure Standards",
        bullets: [
          "Suitable operational premises.",
          "Reliable internet connectivity.",
          "Computers/workstations appropriate for the process.",
          "Headsets and communication equipment.",
          "Power backup where required.",
          "Secure environment for client data.",
        ],
        type: "checklist",
      },
      {
        number: "3",
        title: "Workforce Requirements",
        bullets: [
          "Sufficient trained agents.",
          "Supervisors/team leaders.",
          "Quality monitoring capability.",
          "Attendance and workforce management.",
        ],
        type: "checklist",
      },
      {
        number: "4",
        title: "Technology & Tooling",
        bullets: [
          "Approved dialer/CRM/project tools.",
          "Compatible devices and browsers.",
          "Security controls required by the client.",
          "Ability to support approved monitoring/reporting.",
        ],
        type: "checklist",
      },
      {
        number: "5",
        title: "Compliance Commitments",
        bullets: [
          "Confidentiality commitments.",
          "Data-protection training.",
          "No unauthorized subcontracting.",
          "Compliance with applicable calling, employment, consumer and data laws.",
          "Cooperation with audits and incident investigations.",
        ],
        type: "checklist",
      },
      {
        number: "6",
        title: "Verification Process",
        body: "Thinkatic may conduct onboarding verification, document checks, calls/video verification, infrastructure review or other due diligence before assigning projects.",
      },
      {
        number: "7",
        title: "Ongoing Compliance",
        body: "Approval is not permanent. Thinkatic may periodically review centre performance, security, staffing, infrastructure and compliance.",
      },
      {
        number: "8",
        title: "Partner Status",
        body: "Thinkatic may classify a centre as pending, approved, active, suspended or terminated based on documented operational requirements.",
      },
    ],
  },
  {
    slug: "payment-commission",
    path: "/legal/payment-commission",
    title: "Payment & Commission Policy",
    shortTitle: "Payment & Commission",
    badge: "POLICY",
    icon: CreditCard,
    effectiveDate: "19 September 2026",
    subtitle: "Commercial structures, reconciliation timelines, deductions, and payout guidelines.",
    description: "Commercial terms, payment cycles, verification rules, and financial procedures governing Thinkatic partner compensation.",
    seoTitle: "Thinkatic Payment & Commission Policy | Financial Terms",
    seoDescription: "Payment models, verification procedures, quality adjustments, and billing reconciliation policies for Thinkatic BPO delivery partners.",
    sections: [
      {
        number: "1",
        title: "Commercial Basis",
        body: "Each project will have written commercial terms stating the payment model, rate, measurement period and eligibility conditions.",
      },
      {
        number: "2",
        title: "Possible Commercial Models",
        body: "Compensation may be based on productive hours, verified calls, qualified leads, approved sales, collections, appointments, completed transactions or other project-specific metrics.",
      },
      {
        number: "3",
        title: "Verification",
        body: "Production may be reconciled against Thinkatic/client reports, system records, quality results, attendance and approved outcomes.",
      },
      {
        number: "4",
        title: "Quality Adjustments",
        body: "Where the project terms allow, payment may be adjusted for rejected transactions, quality failures, fraud, invalid records, policy violations or client reversals.",
      },
      {
        number: "5",
        title: "Payment Cycle",
        body: "The project schedule should specify the cut-off date, invoice/payment date and required supporting documents.",
      },
      {
        number: "6",
        title: "Taxes",
        body: "Applicable taxes, withholding and statutory deductions shall be handled according to law and the commercial structure.",
      },
      {
        number: "7",
        title: "Disputes",
        body: "Partners must raise payment discrepancies within the period stated in the project terms and provide supporting records.",
      },
      {
        number: "8",
        title: "No Guaranteed Revenue",
        body: "Unless expressly agreed, project availability and earnings are not guaranteed.",
      },
      {
        number: "9",
        title: "Chargebacks and Recoveries",
        body: "Any recovery or deduction must be based on the signed project terms and applicable law. Thinkatic should provide reasonable supporting information for material disputes.",
      },
      {
        number: "10",
        title: "Bank Details",
        body: "Payments will be made only to verified accounts. Changes to bank details require appropriate verification.",
        callout: "Security Notice: Thinkatic never requests passwords, OTPs, or private banking secrets. Official payouts are processed exclusively to verified business accounts registered in the portal.",
      },
    ],
  },
  {
    slug: "termination-suspension",
    path: "/legal/termination-suspension",
    title: "Termination & Suspension Policy",
    shortTitle: "Termination & Suspension",
    badge: "POLICY",
    icon: AlertTriangle,
    effectiveDate: "19 September 2026",
    subtitle: "Clear grounds and procedures governing operational suspensions and contract terminations.",
    description: "Procedures and grounds for temporary suspension or permanent termination of partner centres, client accounts, or project access.",
    seoTitle: "Thinkatic Termination & Suspension Policy | Contract Terms",
    seoDescription: "Contractual grounds for suspension or termination, emergency restrictions, exit handovers, and account reconciliation procedures.",
    intro: "Thinkatic may suspend or terminate a partner, client account, user or project in accordance with the applicable agreement.",
    sections: [
      {
        number: "1",
        title: "Grounds for Suspension or Termination",
        body: "Possible suspension/termination grounds include:",
        bullets: [
          "Material contractual breach.",
          "Unauthorized disclosure or misuse of data.",
          "Fraud or suspected fraudulent activity.",
          "Credential sharing or unauthorized access.",
          "Repeated quality or performance failure.",
          "Failure to maintain required infrastructure.",
          "False onboarding information.",
          "Unauthorized subcontracting.",
          "Non-payment by a client where contractually applicable.",
          "Client instruction or project closure.",
          "Legal or regulatory requirement.",
          "Security risk.",
        ],
        type: "cards",
      },
      {
        number: "2",
        title: "Emergency Suspension",
        body: "Emergency suspension may occur where immediate restriction is reasonably necessary to protect data, systems, clients or users.",
        highlight: true,
      },
      {
        number: "3",
        title: "Post-Termination Obligations",
        body: "Following termination, access should be disabled, credentials revoked and project information returned or deleted as instructed. Outstanding payment obligations will be reconciled under the applicable agreement.",
      },
      {
        number: "4",
        title: "Opportunity to Remedy",
        body: "Where appropriate, Thinkatic may provide an opportunity to explain or remedy a breach, except where immediate action is justified.",
      },
    ],
  },
  {
    slug: "grievance",
    path: "/legal/grievance",
    title: "Grievance Redressal Policy",
    shortTitle: "Grievance Redressal",
    badge: "POLICY",
    icon: MessageSquare,
    effectiveDate: "19 September 2026",
    subtitle: "Structured 5-step process for resolving operational, payment, and contractual complaints.",
    description: "Official procedure for submitting, investigating, escalating, and resolving grievances from partner centres, clients, and users.",
    seoTitle: "Thinkatic Grievance Redressal Policy | Dispute Resolution",
    seoDescription: "Step-by-step grievance resolution framework for Thinkatic BPO partners, clients, and agents. Transparent investigation and escalation.",
    sections: [
      {
        number: "1",
        title: "Purpose",
        body: "Thinkatic provides a structured process for complaints and operational grievances from clients, partner centres and authorized users.",
      },
      {
        number: "2",
        title: "Issues Covered",
        body: "Examples include payment disputes, project allocation, access problems, conduct concerns, data/security incidents, quality disputes and contractual complaints.",
      },
      {
        number: "3",
        title: "The 5-Step Resolution Process",
        body: "Grievances are processed transparently through five clear operational stages:",
        bullets: [
          "Step 1: Submit — The complainant should submit the issue through Thinkatic's official support/grievance channel with centre/client ID, project information, description, dates and supporting evidence.",
          "Step 2: Acknowledge — Thinkatic should acknowledge the complaint within a reasonable operational period and provide a reference number where practical.",
          "Step 3: Investigate — Thinkatic may review portal logs, project records, communications, quality reports, payment records and statements from relevant parties.",
          "Step 4: Escalate — Unresolved matters may be escalated to the designated grievance officer/management contact published by Thinkatic.",
          "Step 5: Resolve — Final resolution, findings, and agreed corrective actions are communicated in writing to the complainant.",
        ],
        type: "steps",
      },
      {
        number: "4",
        title: "Data and Confidentiality",
        body: "Complaint information will be shared only with people who need it for investigation and resolution, subject to applicable law.",
      },
      {
        number: "5",
        title: "No Retaliation",
        body: "Good-faith complaints should not result in retaliation. This does not prevent Thinkatic from taking action against knowingly false, fraudulent or abusive complaints.",
      },
      {
        number: "6",
        title: "Emergency Security Issues",
        body: "Suspected data breaches, credential compromise or active security incidents should be reported immediately through the designated security channel rather than waiting for ordinary grievance processing.",
        callout: "Immediate Escalation: For urgent data-leak or security emergencies, contact security@thinkatic.com immediately for 24/7 incident response triage.",
      },
    ],
  },
  {
    slug: "cookie-policy",
    path: "/legal/cookie-policy",
    title: "Cookie Policy",
    shortTitle: "Cookie Policy",
    badge: "POLICY",
    icon: Cookie,
    effectiveDate: "19 September 2026",
    subtitle: "Information on cookies, session storage, and analytics technologies used by Thinkatic.",
    description: "How Thinkatic uses cookies and similar technologies on its website and portals to support functionality, security, and performance.",
    seoTitle: "Thinkatic Cookie Policy | Privacy & Technical Cookies",
    seoDescription: "How Thinkatic uses essential, preference, security, and analytics cookies across its public websites and authenticated BPO portals.",
    intro: "Thinkatic may use cookies and similar technologies on its website and portal to deliver secure, responsive, and reliable BPO services.",
    sections: [
      {
        number: "1",
        title: "Essential Cookies (Required)",
        body: "These may be required for login sessions, authentication, security, load balancing and core portal functionality. These cookies cannot be disabled as the site cannot function properly without them.",
        highlight: true,
      },
      {
        number: "2",
        title: "Preference Cookies",
        body: "These may remember settings such as language, session or interface preferences to deliver a customized experience on return visits.",
      },
      {
        number: "3",
        title: "Analytics Technologies",
        body: "Thinkatic may use analytics tools to understand website traffic, performance and usage trends. Where required, appropriate consent or controls should be implemented.",
      },
      {
        number: "4",
        title: "Security Technologies",
        body: "Cookies or similar technologies may be used to detect suspicious activity, protect user accounts against credential theft, and prevent brute-force intrusions.",
      },
      {
        number: "5",
        title: "Third-Party Technologies",
        body: "Some functions may use third-party services. Their technologies may operate according to their own policies and the configuration selected by Thinkatic.",
      },
      {
        number: "6",
        title: "Managing Cookies",
        body: "Users can control cookies through browser settings and, where provided, Thinkatic's cookie preference mechanism. Disabling essential cookies may affect portal functionality.",
      },
      {
        number: "7",
        title: "Updates",
        body: "Thinkatic may update this Cookie Policy when its technologies or legal requirements change.",
      },
    ],
  },
];

export const LEGAL_DISCLAIMER_TEXT =
  "These documents are business-policy and contract templates and should be reviewed against the applicable Thinkatic entity, jurisdictions, client contracts and applicable law before publication or signature.";

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find(
    (d) => d.slug.toLowerCase() === slug.toLowerCase() || d.path.toLowerCase() === slug.toLowerCase()
  );
}
