import { motion } from 'framer-motion';

const cards = [
  {
    index: '/ 01',
    value: '$5M+',
    desc: 'in funding raised\nby our clients',
  },
  {
    index: '/ 02',
    value: '12+',
    desc: 'awards backing\nour excellence',
  },
  {
    index: '/ 03',
    value: '2026',
    desc: 'founded in\nKansas City, USA',
  },
  {
    index: '/ 04',
    value: 'Kansas City, USA',
    desc: 'AI development agency',
    wide: true,
  },
  {
    index: '/ 05',
    value: 'full-cycle AI development',
    desc: 'from strategy and design to production-ready AI systems',
    wide: true,
    large: true,
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: i * 0.07 },
  }),
};

export function BentoStats() {
  return (
    <section className="py-16 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        {/* Top row — 3 equal cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {cards.slice(0, 3).map((card, i) => (
            <motion.div
              key={card.index}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={cardVariants}
              className="relative bg-[#FFFFFF] rounded-2xl p-8 flex flex-col justify-between min-h-[220px] border border-border hover:border-border transition-colors group"
            >
              <span className="text-muted-foreground text-sm font-mono">{card.index}</span>
              <div>
                <p className="text-foreground font-display font-bold leading-[1.0] mb-3"
                  style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
                  {card.value}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{card.desc}</p>
              </div>
              {/* Subtle green glow on hover */}
              <div className="absolute inset-0 rounded-2xl bg-[#214ECF]/0 group-hover:bg-[#214ECF]/[0.03] transition-colors pointer-events-none" />
            </motion.div>
          ))}
        </div>

        {/* Bottom row — 2 wide cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.slice(3).map((card, i) => (
            <motion.div
              key={card.index}
              custom={i + 3}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={cardVariants}
              className="relative bg-[#FFFFFF] rounded-2xl p-8 flex flex-col justify-between min-h-[200px] border border-border hover:border-border transition-colors group"
            >
              <span className="text-muted-foreground text-sm font-mono">{card.index}</span>
              <div>
                <p
                  className="text-foreground font-display font-bold leading-[1.0] mb-3"
                  style={{ fontSize: card.large ? 'clamp(1.6rem, 3vw, 2.8rem)' : 'clamp(1.6rem, 3vw, 2.5rem)' }}
                >
                  {card.value}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">{card.desc}</p>
              </div>
              <div className="absolute inset-0 rounded-2xl bg-[#214ECF]/0 group-hover:bg-[#214ECF]/[0.03] transition-colors pointer-events-none" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
