import { motion } from 'framer-motion';
import { Link } from 'wouter';
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: i * 0.1 },
  }),
};

const projects = [
  {
    title: 'Voice AI product design: how we shipped Thinkatic\'s brand, onboarding, and agentic conversation flow',
    desc: 'Thinkatic designed a voice-first AI assistant — brand, UX, UI, onboarding, monetization — as one launch. Webby Winner, Best Visual UI in AI.',
    tag: 'Product Design · AI',
  },
  {
    title: 'How we helped a FinTech startup design an AI research product that powered $40M growth and acquisition',
    desc: 'Discover how we helped build a powerful AI research tool for analysts and VCs, setting new UX standards now used by OpenAI and other AI leaders.',
    tag: 'FinTech · Enterprise AI',
  },
];

export function FeaturedProjects() {
  return (
    <section className="py-32 bg-[#FFFFFF] border-t border-border">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16 items-end">
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
          >
            <h2
              className="font-display font-bold text-foreground leading-[1.05]"
              style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.8rem)' }}
            >
              Featured AI development projects
            </h2>
          </motion.div>

          <motion.div
            custom={1}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="flex flex-col gap-6 lg:items-start"
          >
            <p className="text-muted-foreground text-base leading-relaxed max-w-lg">
              Our portfolio spans AI SaaS platforms, voice products, and enterprise tools essential for the growth of modern businesses — from early-stage startups to global enterprises at various stages of their growth.
            </p>
            <Link href="/case-studies">
              <motion.span
                whileHover={{ scale: 1.04 }}
                className="inline-flex items-center gap-2 bg-primary text-foreground font-bold text-sm uppercase tracking-widest px-7 py-4 rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
              >
                See All Case Studies
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </motion.span>
            </Link>
          </motion.div>
        </div>

        {/* Project cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((project, i) => (
            <motion.div
              key={i}
              custom={i + 2}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              className="group relative bg-[#FFFFFF] border border-border rounded-3xl overflow-hidden flex flex-col hover:border-border transition-colors"
            >
              {/* Text content */}
              <div className="p-8 md:p-10 flex flex-col gap-5 flex-1">
                <span className="text-muted-foreground text-xs font-mono uppercase tracking-widest">{project.tag}</span>
                <h3
                  className="font-display font-bold text-foreground leading-[1.1]"
                  style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)' }}
                >
                  {project.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{project.desc}</p>
                <Link
                  href="/case-studies"
                  className="text-muted-foreground text-sm font-medium flex items-center gap-2 hover:text-foreground hover:gap-3 transition-all mt-auto w-fit"
                >
                  Read Case Study
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
