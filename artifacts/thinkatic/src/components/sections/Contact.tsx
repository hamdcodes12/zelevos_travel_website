import { MagneticButton } from '../ui/MagneticButton';
import { motion } from 'framer-motion';

export function Contact() {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <motion.h2 
          className="text-5xl md:text-7xl font-display font-bold mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Let's Build the <span className="text-gradient">Future</span>
        </motion.h2>
        
        <motion.form 
          className="glass-panel p-8 md:p-12 rounded-3xl mt-12 text-left space-y-6"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <input type="text" className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-primary transition-colors" placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <input type="email" className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-primary transition-colors" placeholder="john@company.com" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Company</label>
            <input type="text" className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-primary transition-colors" placeholder="Acme Inc" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Project Details</label>
            <textarea className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 h-32 focus:outline-none focus:border-primary transition-colors" placeholder="Tell us what you want to build..."></textarea>
          </div>
          <MagneticButton className="w-full justify-center text-lg mt-4">Submit Inquiry</MagneticButton>
        </motion.form>
      </div>
    </section>
  );
}
