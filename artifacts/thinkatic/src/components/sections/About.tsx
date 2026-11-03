import { motion } from 'framer-motion';

export function About() {
  return (
    <section id="about" className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
              We engineer <span className="text-gradient">intelligence</span>.
            </h2>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              Thinkatic is not just another development agency. We are a specialized collective of AI researchers, machine learning engineers, and product designers dedicated to pushing the boundaries of what software can do.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              From Silicon Valley to global hubs, we partner with visionaries to build systems that don't just compute—they think, adapt, and scale. Our mission is to democratize frontier intelligence for businesses ready to lead their industries.
            </p>
          </motion.div>

          <motion.div
            className="relative h-[600px] rounded-2xl overflow-hidden glass-panel group"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-secondary/20 opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Abstract geometric representation of a brain/network */}
              <svg viewBox="0 0 100 100" className="w-full h-full p-12 opacity-80" stroke="currentColor" strokeWidth="0.5" fill="none">
                <motion.path 
                  d="M50 10 L85 30 L85 70 L50 90 L15 70 L15 30 Z" 
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  className="text-primary"
                />
                <motion.path 
                  d="M50 10 L50 50 M15 30 L50 50 M85 30 L50 50 M15 70 L50 50 M85 70 L50 50 M50 90 L50 50" 
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  transition={{ duration: 2, ease: "easeInOut", delay: 0.5 }}
                  className="text-secondary"
                />
              </svg>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
