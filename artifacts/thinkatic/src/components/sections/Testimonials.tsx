import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Star, Quote, CheckCircle2, TrendingUp, Shield } from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    index: "01",
    quote:
      "Thinkatic completely transformed how we approach AI in our product. Their team didn't just build features — they thought through the entire user experience from first principles. Delivery was fast, communication was flawless, and the results speak for themselves.",
    name: "Ryan Mitchell",
    title: "Chief Product Officer",
    company: "Aether Labs",
    photo: "https://randomuser.me/api/portraits/men/32.jpg",
    metric: "68%",
    metricLabel: "reduction in support tickets",
    accent: "#214ECF",
    benchmarkTag: "Ticket Deflection",
  },
  {
    index: "02",
    quote:
      "I've worked with a lot of agencies, and Thinkatic stands apart. They shipped our AI SaaS MVP in six weeks, handled all the complexity under the hood, and our users love it. The quality of work is genuinely world-class.",
    name: "Samantha Brooks",
    title: "Co-founder & CEO",
    company: "Stackline AI",
    photo: "https://randomuser.me/api/portraits/women/44.jpg",
    metric: "6 wks",
    metricLabel: "from kickoff to launch",
    accent: "#214ECF",
    benchmarkTag: "Time-to-Market",
  },
  {
    index: "03",
    quote:
      "What impressed me most was how quickly they understood our domain. We're in healthcare AI — a very nuanced space — and within days they were proposing solutions our own team hadn't thought of. Highly recommend.",
    name: "Dr. James Whitfield",
    title: "Head of Product",
    company: "MedLogic Systems",
    photo: "https://randomuser.me/api/portraits/men/67.jpg",
    metric: "98.4%",
    metricLabel: "medical coding accuracy",
    accent: "#059669",
    benchmarkTag: "Precision Rate",
  },
  {
    index: "04",
    quote:
      "They care about the outcome, not just the deliverable. Thinkatic pushed back when something wouldn't work and offered smarter alternatives. That kind of partnership is rare and incredibly valuable.",
    name: "Ashley Norwood",
    title: "VP of Engineering",
    company: "Forge Analytics",
    photo: "https://randomuser.me/api/portraits/women/23.jpg",
    metric: "45%",
    metricLabel: "operational cost reduction",
    accent: "#7C3AED",
    benchmarkTag: "Opex Compression",
  },
  {
    index: "05",
    quote:
      "Our conversion rate jumped 40% after Thinkatic rebuilt our onboarding flow with AI personalization. They're not just designers or engineers — they think like growth partners.",
    name: "Tyler Garrison",
    title: "Growth Lead",
    company: "Beacon Commerce",
    photo: "https://randomuser.me/api/portraits/men/41.jpg",
    metric: "40%",
    metricLabel: "conversion rate increase",
    accent: "#D97706",
    benchmarkTag: "Conversion Lift",
  },
];

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

// ─── Individual Slide ──────────────────────────────────────────────────────────

function Slide({ t, direction }: { t: typeof TESTIMONIALS[0]; direction: number }) {
  return (
    <motion.div
      key={t.index}
      initial={{ opacity: 0, x: direction * 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction * -50 }}
      transition={{ duration: 0.45, ease }}
      className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-stretch justify-between"
    >
      {/* Left Column: Executive Endorsement */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {/* Top Verification Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
              ))}
              <span className="ml-2 text-xs font-mono font-bold text-slate-700">5.0 / 5.0</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <CheckCircle2 size={11} className="text-emerald-600" />
                Audited Enterprise Case Study
              </span>
              <span className="font-mono text-xs font-bold text-slate-600">
                CASE {t.index} / 05
              </span>
            </div>
          </div>

          {/* Large Editorial Quote */}
          <div className="relative mb-8">
            <Quote
              size={48}
              className="absolute -top-4 -left-2 text-blue-100 pointer-events-none opacity-60"
            />
            <blockquote className="relative z-10 text-xl md:text-2xl lg:text-[1.65rem] font-normal leading-relaxed tracking-tight text-slate-900">
              "{t.quote}"
            </blockquote>
          </div>
        </div>

        {/* Executive Profile Footer */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <img
              src={t.photo}
              alt={t.name}
              className="w-13 h-13 rounded-full object-cover shrink-0 ring-2 ring-[#214ECF]/20 ring-offset-2 shadow-xs"
              loading="lazy"
            />
            <div>
              <p className="text-slate-900 font-display font-bold text-base md:text-lg leading-tight">
                {t.name}
              </p>
              <p className="text-xs md:text-sm font-medium text-slate-600 mt-0.5">
                {t.title} <span className="text-slate-400 mx-1">·</span>{" "}
                <span className="text-[#214ECF] font-semibold">{t.company}</span>
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-mono text-slate-600">
            <Shield size={12} className="text-[#214ECF]" />
            <span>Verified Executive Sponsor</span>
          </div>
        </div>
      </div>

      {/* Right Column: Audited Impact Telemetry Console */}
      <div className="shrink-0 w-full lg:w-72 xl:w-80 rounded-2xl border border-slate-200 bg-slate-50/70 p-7 flex flex-col justify-between relative overflow-hidden shadow-2xs">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: "linear-gradient(rgba(30,64,175,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.04) 1px, transparent 1px)",
            backgroundSize: "20px 20px"
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
              Verified Metric
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
              <TrendingUp size={10} />
              Validated
            </span>
          </div>

          {/* Monumental Metric Display */}
          <div className="my-3">
            <p
              className="font-display font-black leading-none tracking-tight"
              style={{ fontSize: "clamp(3.2rem, 5vw, 4.4rem)", color: "#214ECF" }}
            >
              {t.metric}
            </p>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 mt-2.5">
              {t.metricLabel}
            </p>
          </div>

          {/* Benchmark Pill */}
          <div className="mt-4 p-3 rounded-xl bg-white border border-slate-200/80">
            <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
              <span className="text-slate-600">Benchmark:</span>
              <span className="font-bold text-slate-900">{t.benchmarkTag}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#214ECF] rounded-full w-4/5" />
            </div>
          </div>
        </div>

        {/* Client Footer */}
        <div className="relative z-10 pt-5 mt-5 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
            Client
          </span>
          <span className="text-xs font-mono font-bold text-[#214ECF]">
            {t.company}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export function Testimonials() {
  const headingRef = useRef<HTMLDivElement>(null);
  const inView = useInView(headingRef, { once: true, margin: "-80px" });
  const shouldReduce = useReducedMotion();

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((next: number) => {
    const clamped = ((next % TESTIMONIALS.length) + TESTIMONIALS.length) % TESTIMONIALS.length;
    setDirection(next > index ? 1 : -1);
    setIndex(clamped);
  }, [index]);

  const prev = () => goTo(index - 1);
  const next = () => goTo(index + 1);

  // Auto-advance every 7 s
  useEffect(() => {
    if (paused || shouldReduce) return;
    const id = setInterval(() => goTo(index + 1), 7000);
    return () => clearInterval(id);
  }, [index, paused, shouldReduce, goTo]);

  const current = TESTIMONIALS[index];

  return (
    <section
      className="relative py-28 md:py-36 overflow-hidden bg-white"
      data-testid="section-testimonials"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(30,64,175,0.08) 50%, transparent)" }} />

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">

        {/* ── Header Row ── */}
        <div ref={headingRef} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-14">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50/80 border border-blue-200/60 mb-4"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#214ECF]" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.28em] text-[#214ECF]">
                Client Testimonials
              </span>
            </motion.div>

            <div className="overflow-hidden">
              <motion.h2
                initial={{ y: "100%", opacity: 0 }}
                animate={inView ? { y: 0, opacity: 1 } : {}}
                transition={{ duration: 0.85, ease, delay: 0.05 }}
                className="font-display font-black text-slate-900 leading-[1.05] tracking-tight"
                style={{ fontSize: "clamp(2.2rem, 4.5vw, 4rem)" }}
              >
                What our clients
                <br />
                <span className="text-[#214ECF]">
                  say about us.
                </span>
              </motion.h2>
            </div>
          </div>

          {/* Prev / Next controls */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease, delay: 0.25 }}
            className="flex items-center gap-3 self-start sm:self-auto"
          >
            <button
              onClick={prev}
              aria-label="Previous testimonial"
              className="w-11 h-11 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center transition-all duration-200 shadow-2xs cursor-pointer active:scale-95"
            >
              <ChevronLeft size={18} className="text-slate-700" />
            </button>
            <button
              onClick={next}
              aria-label="Next testimonial"
              className="w-11 h-11 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center transition-all duration-200 shadow-2xs cursor-pointer active:scale-95"
            >
              <ChevronRight size={18} className="text-slate-700" />
            </button>
          </motion.div>
        </div>

        {/* ── Main Showcase Stage ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.75, ease, delay: 0.2 }}
          className="relative rounded-2xl border border-slate-200/90 bg-white p-8 md:p-12 lg:p-14 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.06)] overflow-hidden"
        >
          {/* Subtle micro background grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(rgba(30,64,175,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.04) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          <AnimatePresence mode="wait" custom={direction}>
            <Slide key={current.index} t={current} direction={direction} />
          </AnimatePresence>
        </motion.div>

        {/* ── Progress Indicators & Counter ── */}
        <div className="flex items-center justify-between mt-6 px-1">
          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {TESTIMONIALS.map((t, i) => (
              <button
                key={t.index}
                onClick={() => goTo(i)}
                aria-label={`Go to testimonial ${i + 1}`}
                className="relative h-2 rounded-full transition-all duration-300 overflow-hidden cursor-pointer"
                style={{
                  width: i === index ? "40px" : "10px",
                  background: i === index ? "#214ECF" : "rgba(148,163,184,0.3)",
                }}
              >
                {i === index && !paused && !shouldReduce && (
                  <motion.div
                    className="absolute top-0 left-0 h-full rounded-full bg-white/40"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 7, ease: "linear" }}
                    key={`progress-${index}`}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Counter */}
          <p className="text-xs font-mono font-bold text-slate-500">
            {String(index + 1).padStart(2, "0")} / {String(TESTIMONIALS.length).padStart(2, "0")}
          </p>
        </div>

        {/* ── Interactive Client Switcher Rail (Desktop & Tablet) ── */}
        <div className="hidden md:grid grid-cols-5 gap-3 mt-8">
          {TESTIMONIALS.map((t, i) => {
            const isSelected = i === index;
            return (
              <button
                key={t.index}
                onClick={() => goTo(i)}
                className={`p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-white border-[#214ECF] shadow-sm ring-1 ring-[#214ECF]/20"
                    : "bg-slate-50/60 border-slate-200/80 hover:bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <img
                    src={t.photo}
                    alt={t.name}
                    className={`w-7 h-7 rounded-full object-cover shrink-0 ${
                      isSelected ? "ring-2 ring-[#214ECF]" : "opacity-80"
                    }`}
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate leading-tight ${isSelected ? "text-slate-900" : "text-slate-700"}`}>
                      {t.name}
                    </p>
                    <p className="text-[10px] font-mono text-slate-600 truncate">{t.company}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold ${isSelected ? "text-[#214ECF]" : "text-slate-600"}`}>
                    {t.metric}
                  </span>
                  <span className="text-[9px] font-mono text-slate-600 uppercase truncate max-w-[80px]">
                    {t.benchmarkTag}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(30,64,175,0.08) 50%, transparent)" }} />
    </section>
  );
}
