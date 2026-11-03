import { Globe, Award, Layers, Cpu, ShieldCheck, Users } from "lucide-react";

interface FeatureItem {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: Globe,
    title: "GLOBAL DELIVERY",
    description: "US & UK business opportunities through verified BPO centres.",
  },
  {
    icon: Award,
    title: "BPO PARTNER BENEFITS",
    description: "Structured opportunities, transparent operations and continuous support.",
  },
  {
    icon: Layers,
    title: "STREAMLINED PROCESSES",
    description: "From onboarding to operations, manage everything through one platform.",
  },
  {
    icon: Cpu,
    title: "TECHNOLOGY & AI",
    description: "Technology-enabled operations, systems and intelligent business solutions.",
  },
  {
    icon: ShieldCheck,
    title: "QUALITY & COMPLIANCE",
    description: "Structured processes, measurable performance and reliable delivery.",
  },
  {
    icon: Users,
    title: "OUR NETWORK",
    description: "A growing network of businesses, BPO centres and operational talent.",
  },
];

export function FeatureIconRow() {
  return (
    <section className="bg-white border-b border-slate-200/80 relative z-20 py-8 md:py-10 shadow-xs w-full" aria-label="Core Value Pillars">
      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x lg:divide-x divide-slate-200/80 gap-y-6 sm:gap-y-8">
          {FEATURES.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`flex flex-col items-start text-left px-3 sm:px-4 lg:px-4 xl:px-6 group transition-all duration-200 ${
                  idx === 0 ? "lg:pl-0" : ""
                } ${idx === FEATURES.length - 1 ? "lg:pr-0" : ""}`}
              >
                {/* Circular light-blue icon container */}
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] mb-3.5 shrink-0 transition-transform duration-200 group-hover:scale-105 group-hover:bg-blue-100/60 shadow-2xs">
                  <Icon size={20} className="text-[#214ECF]" />
                </div>

                <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug tracking-wider uppercase mb-1.5 font-display">
                  {item.title}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
