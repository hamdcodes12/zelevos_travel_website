import { Building2, Users, Briefcase, Globe, Award } from "lucide-react";

interface StatItem {
  value: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const STATS: StatItem[] = [
  {
    value: "100+",
    label: "Verified BPO Centres",
    icon: Building2,
  },
  {
    value: "1,000+",
    label: "Trained Agents",
    icon: Users,
  },
  {
    value: "50+",
    label: "Active Projects",
    icon: Briefcase,
  },
  {
    value: "2",
    label: "Countries (US & UK)",
    icon: Globe,
  },
  {
    value: "99%",
    label: "Client Satisfaction",
    icon: Award,
  },
];

export function StatisticsSection() {
  return (
    <section className="py-14 md:py-20 bg-white w-full" aria-label="Key Performance Statistics">
      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Light-blue rounded container */}
        <div className="bg-[#EEF4FF] border border-blue-200/80 rounded-3xl p-6 sm:p-8 md:p-10 lg:p-12 shadow-xs w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-0 divide-y sm:divide-y-0 lg:divide-x divide-blue-200/70 w-full">
            {STATS.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={`flex flex-col items-center text-center lg:items-start lg:text-left pt-6 sm:pt-0 lg:px-6 xl:px-8 w-full ${
                    idx === 0 ? "lg:pl-2" : ""
                  } ${idx === STATS.length - 1 ? "lg:pr-2" : ""}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-blue-200/80 flex items-center justify-center text-[#214ECF] mb-3 shadow-2xs shrink-0">
                    <Icon size={18} className="text-[#214ECF]" />
                  </div>

                  <p className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900 leading-none mb-1.5 tracking-tight">
                    {stat.value}
                  </p>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider leading-snug">
                    {stat.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
