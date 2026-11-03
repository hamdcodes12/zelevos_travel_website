import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Link } from "wouter";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
};

const steps = [
  { num: "01", title: "Discovery", desc: "We dive deep into your business, users, and technical landscape. Every project starts with clarity." },
  { num: "02", title: "Research", desc: "Market analysis, competitor benchmarking, and user research to find the whitespace we'll own." },
  { num: "03", title: "Strategy", desc: "Define the product vision, architecture decisions, and success metrics before a single pixel is drawn." },
  { num: "04", title: "Design", desc: "High-fidelity UI/UX design with motion specs, component systems, and immersive prototypes." },
  { num: "05", title: "Development", desc: "Engineering execution with AI-first architecture, clean code, and rigorous testing." },
  { num: "06", title: "Launch", desc: "Phased deployment with monitoring, performance optimization, and stakeholder alignment." },
  { num: "07", title: "Optimization", desc: "Continuous improvement cycles driven by real user data and business outcomes." }
];

export default function ProcessPage() {
  return (
    <Layout>
      <section className="pt-48 pb-24 bg-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="text-primary font-bold tracking-widest text-sm uppercase mb-6">PROCESS</div>
            <h1 className="text-5xl md:text-8xl font-display font-bold text-foreground leading-[1.0]">
              How We Turn Ideas Into Reality
            </h1>
          </motion.div>
        </div>
      </section>

      <section className="py-32 bg-[#FFFFFF] relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 relative">
          {/* Vertical glowing line */}
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-[2px] bg-border -translate-x-1/2" />
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary via-primary/50 to-transparent -translate-x-1/2" />

          <div className="flex flex-col gap-24 relative z-10">
            {steps.map((step, i) => {
              const isEven = i % 2 === 0;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7 }}
                  className={`flex flex-col md:flex-row items-center gap-8 md:gap-16 ${isEven ? "" : "md:flex-row-reverse"}`}
                >
                  <div className={`w-full md:w-1/2 flex ${isEven ? "md:justify-end" : "md:justify-start"}`}>
                    <div className="bg-card border border-border p-8 rounded-[24px] max-w-md w-full">
                      <h3 className="text-3xl font-display font-bold text-foreground mb-4">{step.title}</h3>
                      <p className="text-muted-foreground text-lg">{step.desc}</p>
                    </div>
                  </div>
                  
                  {/* Number Circle */}
                  <div className="absolute left-6 md:left-1/2 w-12 h-12 rounded-full bg-background border-4 border-primary -translate-x-1/2 flex items-center justify-center text-primary font-mono font-bold shadow-[0_0_20px_rgba(33,78,207,0.38)] z-20 mt-8 md:mt-0">
                    {step.num}
                  </div>

                  <div className="w-full md:w-1/2 hidden md:block" />
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-40 bg-background text-center">
        <div className="max-w-2xl mx-auto px-6">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-5xl md:text-7xl font-display font-bold text-foreground mb-10"
          >
            Let's Start With Discovery
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ delay: 0.2 }}
          >
            <Link href="/contact">
              <MagneticButton variant="primary">Book a Call</MagneticButton>
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}