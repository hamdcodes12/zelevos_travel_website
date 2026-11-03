import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Link } from "wouter";

import imgFinance from "@assets/image_1778962737339.png";
import imgEnterprise from "@assets/image_1778962742633.png";
import imgCrypto from "@assets/image_1778962749135.png";
import imgHealthcare from "@assets/image_1778962753706.png";
import imgVideo from "@assets/image_1778962759114.png";
import imgRealEstate from "@assets/image_1778962763769.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
};

const projects = [
  {
    title: "Healthcare Process Optimization",
    tag: "Healthcare BPO",
    desc: "Transforming a hospital network's insurance claims operation through AI-assisted processing and dedicated BPO teams.",
    metrics: ["60% faster processing", "40% cost reduction"],
    image: imgHealthcare,
    problem: "A mid-sized hospital network was processing insurance claims manually, resulting in high error rates, delayed reimbursements, and escalating administrative costs. Their billing team was overwhelmed, with a backlog exceeding 3,000 claims monthly.",
    approach: "Thinkatic deployed a dedicated healthcare BPO team augmented with AI-assisted error detection. We automated pre-authorization checks, streamlined the billing workflow, and implemented real-time QA monitoring across all claim submissions.",
    result: "Processing time reduced by 60%, claim denials dropped by 35%, and the client recovered $480K in previously denied claims within the first quarter. Administrative costs fell by 40%, with zero compliance incidents reported.",
  },
  {
    title: "Customer Support Transformation",
    tag: "Customer Support",
    desc: "Rebuilding a telehealth platform's support operation from the ground up with AI co-pilot tools and omnichannel coverage.",
    metrics: ["45% faster response", "92% CSAT score"],
    image: imgEnterprise,
    problem: "A fast-growing telehealth platform was struggling to scale customer support. Long response times, inconsistent agent performance, and high ticket backlogs were damaging patient satisfaction scores and increasing churn.",
    approach: "Thinkatic built a dedicated omnichannel support operation — voice, chat, and email — supported by centralized knowledge base tools and clear operational routing. We standardized SOPs and implemented continuous human QA scorecards and calibration sessions across interactions.",
    result: "Average response time improved by 45%, CSAT scores climbed from 72% to 92%, and first-contact resolution reached 87%. The client scaled support capacity 3× without proportional cost increases.",
  },
  {
    title: "AI Automation for Insurance Back Office",
    tag: "AI-Powered BPO",
    desc: "Deploying custom AI workflows to eliminate 70% of manual effort in a large insurance back-office operation.",
    metrics: ["70% less manual work", "$1.2M annual savings"],
    image: imgFinance,
    problem: "A large insurance back-office operation was spending 15,000+ hours per month on repetitive data entry, document classification, and compliance reporting — with a 4% error rate creating significant regulatory exposure.",
    approach: "Thinkatic designed and deployed custom automation workflows integrating intelligent document processing, RPA bots for data entry, and streamlined compliance audit pipelines with human verification. Human agents were redeployed to handle exceptions, oversight, and edge cases.",
    result: "Manual processing effort reduced by 70%, error rates dropped to under 0.5%, and the client realized $1.2M in annualized operational savings. Compliance reporting cycle time compressed from 5 days to 6 hours.",
  },
  {
    title: "Legacy System Cloud Migration",
    tag: "Software Modernization",
    desc: "Migrating a regional healthcare provider's on-premise patient management systems to secure, scalable cloud infrastructure.",
    metrics: ["99.9% uptime achieved", "$340K infra savings/year"],
    image: imgRealEstate,
    problem: "A regional healthcare provider was running critical patient management systems on aging on-premise servers — causing frequent downtime, security vulnerabilities, and an inability to scale during peak demand periods.",
    approach: "Thinkatic conducted a full legacy system audit, designed a phased cloud migration roadmap, and executed the migration with zero data loss. We containerized core applications and implemented CI/CD pipelines for ongoing deployment reliability and rollback capability.",
    result: "All legacy systems migrated to secure, scalable cloud infrastructure. System uptime improved to 99.9%, deployment cycles accelerated 4×, and the client eliminated $340K in annual server maintenance costs while improving security posture.",
  },
];

export default function CaseStudiesPage() {
  return (
    <Layout>
      <section className="pt-48 pb-24 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="text-primary font-bold tracking-widest text-sm uppercase mb-6">CASE STUDIES</div>
            <h1 className="text-5xl md:text-8xl font-display font-bold text-foreground mb-12 leading-[1.0]">
              Work That Speaks for Itself
            </h1>

            <div className="flex flex-wrap justify-center gap-4">
              {["All", "AI Products", "SaaS", "Mobile", "Enterprise"].map((tab, i) => (
                <button key={i} className={`px-6 py-2 rounded-full border ${i === 0 ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"} transition-all font-medium`}>
                  {tab}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-32 bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="columns-1 md:columns-2 gap-8 space-y-8">
            {projects.map((project, index) => (
              <motion.div
                key={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={fadeUp}
                className="break-inside-avoid bg-card border border-border rounded-[24px] overflow-hidden group hover:border-primary/50 transition-all hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(33,78,207,0.08)]"
              >
                <div className="h-64 overflow-hidden">
                  <img
                    src={project.image}
                    alt={project.title}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-8">
                  <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-full mb-6 border border-primary/20">
                    {project.tag}
                  </div>
                  <h2 className="text-3xl font-display font-bold text-foreground mb-4">{project.title}</h2>
                  <p className="text-muted-foreground mb-6 text-base leading-relaxed">{project.desc}</p>

                  <div className="flex flex-wrap gap-3 mb-8">
                    {project.metrics.map((m, i) => (
                      <div key={i} className="bg-background px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium">
                        {m}
                      </div>
                    ))}
                  </div>

                  {/* Problem / Approach / Result */}
                  <div className="flex flex-col gap-4 mb-8 rounded-2xl p-6 bg-[#FFFFFF] border border-border">
                    {[
                      { label: "Problem", text: project.problem },
                      { label: "Approach", text: project.approach },
                      { label: "Result", text: project.result },
                    ].map(({ label, text }) => (
                      <div key={label}>
                        <p className="text-xs font-mono uppercase tracking-[0.18em] text-primary/70 mb-1.5">{label}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                      </div>
                    ))}
                  </div>

                  <Link
                    href={`/contact?project=${encodeURIComponent(project.title)}`}
                    className="text-primary font-medium hover:text-foreground transition-colors"
                  >
                    Start a Similar Project →
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
