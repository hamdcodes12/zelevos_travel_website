import { motion } from 'framer-motion';

const industries = [
  "Healthcare AI", "FinTech AI", "E-Commerce AI", "EdTech AI", 
  "Legal AI", "Manufacturing AI", "Real Estate AI", "Logistics AI"
];

export function Industries() {
  return (
    <section className="py-24 border-y border-border bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-sm font-bold tracking-widest text-muted-foreground uppercase mb-12 text-center">Industries We Transform</h2>
        
        <div className="flex flex-wrap justify-center gap-4">
          {industries.map((industry, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="px-6 py-3 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/10 transition-all cursor-default text-sm md:text-base whitespace-nowrap"
            >
              {industry}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
