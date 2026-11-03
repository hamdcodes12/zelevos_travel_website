import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: i * 0.1 },
  }),
};

const stats = [
  { value: '$500M', label: 'in funding secured\nowing to our designs', index: '/ 001' },
  { value: '+1 million', label: 'increase\nin customer base', index: '/ 002' },
  { value: '1,000,000+', label: 'of active\nmarketplace users', index: '/ 003' },
];

export function SuccessStories() {
  return (
    <section className="py-32 bg-background border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-20 items-start">
          {/* Left — heading */}
          <motion.h2
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="font-display font-bold text-foreground leading-[1.05]"
            style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)' }}
          >
            Success stories shaped by our AI development agency
          </motion.h2>

          {/* Right — two text blocks */}
          <div className="flex flex-col gap-10">
            <motion.div
              custom={1}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
            >
              <p className="text-muted-foreground text-xs font-mono uppercase tracking-widest mb-4">Partnership Mentality</p>
              <p className="text-muted-foreground text-base leading-relaxed">
                Along with taking the lead in designing AI-powered solutions, we embody a partnership mentality. This exact commitment has been the bedrock of our clients' successes. When you choose to collaborate with us, we promise to be right where your audience's changing desires meet your ambitious business goals. We don't settle for mediocrity; we strive for excellence in every sprint, every touchpoint, and every user interaction.
              </p>
            </motion.div>

            <motion.div
              custom={2}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
            >
              <p className="text-muted-foreground text-xs font-mono uppercase tracking-widest mb-4">Results</p>
              <p className="text-muted-foreground text-base leading-relaxed">
                That is how we've built 50+ sustainable AI products and helped 400+ brands secure millions in funding, achieve successful acquisitions, and establish themselves as globally recognized companies.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Bottom stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border pt-12">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.index}
              custom={i + 3}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              className="bg-[#FFFFFF] border border-border rounded-2xl p-8 flex flex-col justify-between min-h-[160px] hover:border-border transition-colors group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[#214ECF]/0 group-hover:bg-[#214ECF]/[0.03] transition-colors rounded-2xl pointer-events-none" />
              <p
                className="font-display font-bold leading-tight mb-4"
                style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', color: '#214ECF' }}
              >
                {stat.value}
              </p>
              <div className="flex items-end justify-between">
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{stat.label}</p>
                <span className="text-foreground/20 text-xs font-mono ml-4 flex-shrink-0">{stat.index}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
