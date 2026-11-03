import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  UserPlus,
  ShieldCheck,
  Briefcase,
  UserCheck,
  TrendingUp,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

interface StepItem {
  number: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

const STEPS: StepItem[] = [
  {
    number: "1",
    title: "Onboard",
    desc: "BPO centres register and submit their details.",
    icon: UserPlus,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    number: "2",
    title: "Verify",
    desc: "We validate credentials, infrastructure and capabilities.",
    icon: ShieldCheck,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  {
    number: "3",
    title: "Get Projects",
    desc: "Approved centres get access to global projects.",
    icon: Briefcase,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  {
    number: "4",
    title: "Deploy Agents",
    desc: "We train and deploy agents for your projects.",
    icon: UserCheck,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  {
    number: "5",
    title: "Grow Together",
    desc: "Monitor performance, ensure quality and scale with confidence.",
    icon: TrendingUp,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
];

export function HowItWorksProcess() {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-white w-full" aria-label="How It Works">
      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10 xl:gap-14 w-full">
          {/* Left Column: Heading, Description, Learn More button */}
          <div className="w-full lg:w-[28%] xl:w-[26%] flex flex-col items-start text-left shrink-0 pr-0 lg:pr-6 xl:pr-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 border border-blue-200/80 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#214ECF]" aria-hidden="true" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#214ECF] font-bold">
                HOW IT WORKS
              </span>
            </div>

            <h2 className="font-display font-black text-slate-900 text-3xl sm:text-4xl leading-tight mb-4">
              A Simple 5-Step Process
            </h2>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6 font-normal">
              From registration to active operations, our streamlined process connects BPO
              centres with international business opportunities quickly and securely.
            </p>

            <Link href="/process">
              <button
                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all shadow-xs hover:shadow-sm cursor-pointer"
              >
                <span>Learn More</span>
                <ArrowRight size={14} />
              </button>
            </Link>
          </div>

          {/* Right Column: 5 process cards using full available horizontal space */}
          <div className="w-full lg:w-[72%] xl:w-[74%] flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 xl:gap-4.5 relative w-full">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isLast = idx === STEPS.length - 1;

                return (
                  <div key={step.title} className="relative flex flex-col h-full">
                    {/* Card */}
                    <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all flex flex-col">
                      {/* Step Number & Icon Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className={`w-11 h-11 rounded-full ${step.bgColor} ${step.borderColor} border flex items-center justify-center ${step.color} shrink-0`}
                        >
                          <Icon size={19} />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          0{step.number}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 mb-1.5 leading-snug">
                        {step.title}
                      </h3>

                      <p className="text-xs text-slate-500 leading-relaxed font-normal">
                        {step.desc}
                      </p>
                    </div>

                    {/* Arrow connector between steps (desktop only) */}
                    {!isLast && (
                      <div className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-300">
                        <ChevronRight size={16} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
