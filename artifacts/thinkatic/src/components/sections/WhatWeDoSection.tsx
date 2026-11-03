import React from "react";
import { Link } from "wouter";
import {
  Code2,
  Bot,
  Cpu,
  Users,
  Server,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface ServiceCategoryPreview {
  key: string;
  name: string;
  subservices: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  anchor: string;
}

const CATEGORIES: ServiceCategoryPreview[] = [
  {
    key: "BUILD",
    name: "Build",
    subservices: "Websites | E-commerce | Apps | Custom Software",
    description: "Digital foundations engineered for performance, conversion, and longevity.",
    icon: Code2,
    anchor: "build",
  },
  {
    key: "AI",
    name: "AI",
    subservices: "AI Agents | Chatbots | Voice AI | AI Automation",
    description: "Practical intelligence tailored for workflows, inbound CX, and automation.",
    icon: Bot,
    anchor: "ai",
  },
  {
    key: "AUTOMATE",
    name: "Automate",
    subservices: "Business Automation | CRM | Workflows | Integrations",
    description: "Zero manual friction. Robust multi-platform API and data synchronization.",
    icon: Cpu,
    anchor: "automate",
  },
  {
    key: "SCALE",
    name: "Scale",
    subservices: "Developers | QA Teams | BPO | Customer Support",
    description: "Vetted on-demand engineers, dedicated QA squads, and customer operations.",
    icon: Users,
    anchor: "scale",
  },
  {
    key: "OPERATE",
    name: "Operate",
    subservices: "Cloud | DevOps | Maintenance | Technical Support",
    description: "Round-the-clock site reliability, monitoring, updates, and helpdesk.",
    icon: Server,
    anchor: "operate",
  },
];

export function WhatWeDoSection() {
  return (
    <section
      className="py-20 md:py-28 bg-white border-t border-b border-slate-200/80 relative overflow-hidden"
      aria-label="Explore Our Services"
      id="services-overview"
    >
      <div className="w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Section Eyebrow, Header & Top CTA */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 md:mb-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 border border-blue-200/80 mb-3.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#214ECF]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                OUR SERVICES
              </span>
            </div>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[#0B1226] tracking-tight leading-tight mb-3">
              End-to-End Digital Solutions
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              From building your digital presence to scaling your operations, we offer a complete range of services to meet your business needs.
            </p>
          </div>

          <div className="shrink-0">
            <Link href="/services">
              <button
                type="button"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#214ECF] hover:bg-[#1A3DB3] text-white font-bold text-xs sm:text-sm tracking-wide shadow-md shadow-blue-600/20 transition-all duration-200 cursor-pointer group"
              >
                <span>View All Services</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
        </div>

        {/* 5 Categories Grid matching the reference screenshot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5">
          {CATEGORIES.map((cat, idx) => {
            const IconComponent = cat.icon;
            const isFirst = idx === 0;

            return (
              <Link
                key={cat.key}
                href={`/services#category-${cat.anchor}`}
                className="block group h-full focus:outline-hidden"
              >
                <div
                  className={`h-full rounded-2xl p-6 sm:p-7 border transition-all duration-300 flex flex-col justify-between cursor-pointer relative ${
                    isFirst
                      ? "bg-white border-[#214ECF] shadow-lg shadow-blue-500/10 ring-1 ring-[#214ECF]/20"
                      : "bg-white border-slate-200/90 shadow-2xs hover:border-[#214ECF] hover:shadow-lg hover:-translate-y-1"
                  }`}
                >
                  {isFirst && (
                    <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-[#214ECF] text-white text-[9px] font-mono font-bold uppercase tracking-wider shadow-xs flex items-center gap-1">
                      <Sparkles size={10} />
                      <span>FOUNDATION</span>
                    </div>
                  )}

                  <div>
                    {/* Icon and Title */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100/80 text-[#214ECF] flex items-center justify-center group-hover:bg-[#214ECF] group-hover:text-white group-hover:scale-105 transition-all duration-300">
                        <IconComponent size={20} />
                      </div>
                      <h3 className="font-display font-extrabold text-xl text-[#0B1226] group-hover:text-[#214ECF] transition-colors">
                        {cat.name}
                      </h3>
                    </div>

                    {/* Subservices Chip Line */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-medium text-slate-700 leading-snug mb-3">
                      {cat.subservices}
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed font-normal">
                      {cat.description}
                    </p>
                  </div>

                  {/* Bottom Link indicator */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#214ECF]">
                    <span>Explore {cat.name}</span>
                    <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom Banner Callout */}
        <div className="mt-12 p-6 sm:p-8 rounded-2xl bg-[#0B1226] text-white flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-[#47A3FF] border border-blue-400/30 flex items-center justify-center shrink-0">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Looking for a tailored solution or dedicated team?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Every business is unique. We configure bespoke technology stacks, AI agents, and dedicated BPO pods.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
            <Link href="/services" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white text-[#0B1226] font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Browse All Packages
              </button>
            </Link>
            <Link href="/contact" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Talk to Thinkatic
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
