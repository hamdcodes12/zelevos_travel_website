import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Link } from "wouter";
import { Cpu, Zap, Eye, FastForward, Globe, Users, Linkedin } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
};

const values = [
  { icon: Cpu, title: "AI-First Thinking", desc: "We build AI into the foundation, not as an afterthought." },
  { icon: Zap, title: "Relentless Quality", desc: "We ship work we're genuinely proud of." },
  { icon: Eye, title: "Radical Clarity", desc: "Simple, honest communication at every step." },
  { icon: FastForward, title: "Speed Without Compromise", desc: "We move fast without cutting corners." },
  { icon: Globe, title: "Global Perspective", desc: "Distributed team, global clients, universal standards." },
  { icon: Users, title: "Partnership Mindset", desc: "We treat every client like a founding team member." }
];

const team = [
  { name: "Alex Chen", role: "CEO & Co-Founder", bio: "Former ML engineer at Google Brain.", init: "AC" },
  { name: "Sarah Kim", role: "CTO & Co-Founder", bio: "Built AI systems at OpenAI and Anthropic.", init: "SK" },
  { name: "Marcus Rivera", role: "Design Director", bio: "Previously led design at Figma and Notion.", init: "MR" }
];

export default function AboutPage() {
  return (
    <Layout>
      <section className="pt-48 pb-24 bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="text-primary font-bold tracking-widest text-sm uppercase mb-6">ABOUT</div>
            <h1 className="text-5xl md:text-8xl font-display font-bold text-foreground mb-8 leading-[1.0]">
              We Are Thinkatic
            </h1>
            <p className="text-2xl text-muted-foreground max-w-3xl">
              A global team of AI engineers, designers, and strategists obsessed with building the future.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-24 bg-[#FFFFFF]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              className="rounded-2xl p-10 flex flex-col gap-5"
              style={{ background: "rgba(71,163,255,0.05)", border: "1px solid rgba(33,78,207,0.12)" }}
            >
              <p className="text-xs font-mono uppercase tracking-[0.25em]" style={{ color: "#214ECF" }}>Our Vision</p>
              <h3 className="text-foreground font-display font-bold text-2xl leading-snug">
                Becoming the world's most trusted AI partner
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                To become the world's most trusted AI development partner — enabling every forward-thinking business to harness the full power of artificial intelligence and build products that define the next decade.
              </p>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              transition={{ delay: 0.1 }}
              className="rounded-2xl p-10 flex flex-col gap-5"
              style={{ background: "rgba(71,163,255,0.05)", border: "1px solid rgba(33,78,207,0.12)" }}
            >
              <p className="text-xs font-mono uppercase tracking-[0.25em]" style={{ color: "#214ECF" }}>Our Mission</p>
              <h3 className="text-foreground font-display font-bold text-2xl leading-snug">
                Engineering intelligence that drives real growth
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                We build production-ready AI systems that drive measurable business growth — from strategy to deployment. We are the dedicated engineering team for the AI era, ensuring every system we ship is aligned with your product, your people, and your market.
              </p>
            </motion.div>
          </div>

          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            className="text-4xl md:text-6xl font-display font-medium text-foreground leading-tight italic text-center"
          >
            <span className="text-primary font-serif">"</span>We believe AI should be invisible — seamlessly embedded in products that feel like magic and work like science.<span className="text-primary font-serif">"</span>
          </motion.h2>
        </div>
      </section>

      <section className="py-32 bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-5xl font-display font-bold text-foreground mb-16 text-center"
          >
            Our Values
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {values.map((v, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={fadeUp}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border p-8 rounded-[24px]"
              >
                <v.icon className="text-primary w-10 h-10 mb-6" />
                <h3 className="text-2xl font-bold text-foreground mb-4">{v.title}</h3>
                <p className="text-muted-foreground">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-32 bg-[#FFFFFF] border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-5xl font-display font-bold text-foreground mb-16 text-center">The Minds Behind Thinkatic</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {team.map((member, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={fadeUp}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-[24px] p-8 flex flex-col items-center text-center"
              >
                <div className="w-24 h-24 rounded-full border-2 border-primary flex items-center justify-center text-3xl font-display font-bold text-primary mb-6 shadow-[0_0_20px_rgba(33,78,207,0.18)]">
                  {member.init}
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">{member.name}</h3>
                <div className="text-primary font-medium mb-4">{member.role}</div>
                <p className="text-muted-foreground mb-6">{member.bio}</p>
                <a href="https://www.linkedin.com/company/thinkatic/" target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-primary transition-colors"><Linkedin size={24} /></a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-40 bg-background text-center relative overflow-hidden">
        <div className="max-w-2xl mx-auto px-6 relative z-10">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-5xl md:text-7xl font-display font-bold text-foreground mb-8"
          >
            Join Our Team
          </motion.h2>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: 0.2 }}>
            <Link href="/contact">
              <MagneticButton variant="primary">View Open Roles</MagneticButton>
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}