import { motion } from "framer-motion";
import { Layers, Bot, Zap, Users, Activity, ArrowRight, Check } from "lucide-react";
import { Link } from "wouter";

interface CapabilityCategory {
  id: string;
  category: string;
  title: string;
  badge: string;
  description: string;
  deliverablesCount: string;
  features: string[];
  ctaLabel: string;
  ctaLink: string;
  icon: typeof Layers;
}

const capabilities: CapabilityCategory[] = [
  {
    id: "build",
    category: "BUILD",
    title: "Websites, E-commerce, Apps & Custom Software",
    badge: "9 Packages",
    description: "Production-grade business websites, turn-key Shopify stores, scalable MVPs, and complex bespoke enterprise platforms.",
    deliverablesCount: "9 Standardized Packages",
    features: [
      "Websites",
      "E-commerce",
      "Apps",
      "Custom Software",
    ],
    ctaLabel: "Explore Build Packages →",
    ctaLink: "/pricing",
    icon: Layers,
  },
  {
    id: "ai",
    category: "AI",
    title: "AI Agents, Chatbots & Enterprise AI Solutions",
    badge: "5 Packages",
    description: "Production conversational AI chatbots, multi-agent workflow systems, voice AI agents, and enterprise AI automation.",
    deliverablesCount: "5 Standardized Packages",
    features: [
      "AI Agents",
      "AI Chatbots",
      "Voice AI",
      "AI Automation",
    ],
    ctaLabel: "Explore AI Packages →",
    ctaLink: "/pricing",
    icon: Bot,
  },
  {
    id: "automate",
    category: "AUTOMATE",
    title: "Business Automation, CRM & Workflows",
    badge: "3 Packages",
    description: "Eliminate manual operational bottlenecks with high-reliability event-driven integrations, intelligent document extraction, and cross-platform CRM/ERP synchronization.",
    deliverablesCount: "3 Standardized Packages",
    features: [
      "Business Automation",
      "CRM",
      "Workflows",
      "Integrations",
    ],
    ctaLabel: "Explore Automation Packages →",
    ctaLink: "/pricing",
    icon: Zap,
  },
  {
    id: "scale",
    category: "SCALE",
    title: "Developers, QA Teams, BPO & Customer Support",
    badge: "9 Packages",
    description: "Deploy dedicated squads of senior software engineers, embedded automated QA specialists, and fully managed 24/7 BPO operations with Tier 1-3 support.",
    deliverablesCount: "9 Workforce & Team Packages",
    features: [
      "Developers",
      "QA Teams",
      "BPO",
      "Customer Support",
    ],
    ctaLabel: "Explore Scale Packages →",
    ctaLink: "/pricing",
    icon: Users,
  },
  {
    id: "operate",
    category: "OPERATE",
    title: "Cloud, DevOps, Maintenance & Technical Support",
    badge: "3 Packages",
    description: "Zero-downtime AWS/GCP cloud environments, automated CI/CD deployment pipelines, proactive 24/7 SRE monitoring, and regular website upkeep.",
    deliverablesCount: "3 Retainer Packages",
    features: [
      "Cloud",
      "DevOps",
      "Maintenance",
      "Technical Support",
    ],
    ctaLabel: "Explore Operate Packages →",
    ctaLink: "/pricing",
    icon: Activity,
  },
];

export function Services() {
  return (
    <section id="services" className="py-28 relative bg-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(33,78,207,0.06),transparent_60%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="mb-16 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 mb-4">
            <span className="text-[11px] font-mono tracking-wider uppercase font-bold text-[#214ECF]">
              Authoritative Capabilities &amp; Disciplines
            </span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-black text-slate-900 tracking-tight mb-4">
            Core Enterprise Capabilities
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Our capabilities are organized into 5 structured pillars: 24 production packages across software engineering, workflow automation, dedicated delivery teams, and cloud operations, plus bespoke enterprise AI consulting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((cap, index) => {
            const Icon = cap.icon;
            const isConsultative = cap.category === "AI";

            return (
              <motion.div
                key={cap.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: index * 0.08 }}
                className={`bg-white rounded-2xl border p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-all ${
                  isConsultative
                    ? "border-purple-200/90 hover:border-purple-400 bg-gradient-to-b from-purple-50/20 to-white"
                    : "border-slate-200/90 hover:border-blue-300"
                }`}
              >
                <div>
                  {/* Category Pill & Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isConsultative
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-50 text-[#214ECF]"
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <span className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                        {cap.category}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        isConsultative
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : "bg-blue-50 text-[#214ECF] border border-blue-200"
                      }`}
                    >
                      {cap.badge}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{cap.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-5">{cap.description}</p>

                  {/* Deliverables List */}
                  <div className="space-y-2 border-t border-slate-100 pt-4 mb-6">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Deliverables &amp; Inclusions:
                    </div>
                    {cap.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2 text-xs text-slate-600">
                        <Check size={13} className="text-[#214ECF] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="pt-3 border-t border-slate-100">
                  <Link
                    href={cap.ctaLink}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${
                      isConsultative
                        ? "text-purple-700 hover:text-purple-900"
                        : "text-[#214ECF] hover:text-blue-800"
                    }`}
                  >
                    <span>{cap.ctaLabel}</span>
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
