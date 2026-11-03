import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

interface BlogPost {
  tag: string;
  date: string;
  readTime: string;
  title: string;
  intro: string;
  outline: string[];
}

const posts: BlogPost[] = [
  {
    tag: "AI + BPO",
    date: "June 2026",
    readTime: "6 min read",
    title: "Why AI-Augmented BPO Outperforms Traditional Outsourcing — Every Time",
    intro:
      "The global BPO industry is at an inflection point. For decades, outsourcing meant trading quality for cost savings — a necessary compromise most enterprises accepted reluctantly. That era is over. AI-augmented BPO — where trained human agents work alongside intelligent automation — is delivering outcomes that neither humans nor AI could achieve alone. At Thinkatic, we've seen this firsthand: clients who switch from traditional BPO models to AI-augmented operations typically see a 40–70% reduction in manual processing time, error rates that drop below 1%, and CSAT scores that improve measurably within the first quarter.",
    outline: [
      "The limits of traditional BPO: why cost arbitrage alone is no longer enough",
      "How AI co-pilot tools change what's possible for frontline agents",
      "Real-world benchmarks: AI-augmented vs. traditional BPO across key metrics",
      "What to look for when evaluating an AI-first BPO partner",
    ],
  },
  {
    tag: "Healthcare BPO",
    date: "May 2026",
    readTime: "7 min read",
    title: "The Hidden Cost of Healthcare Administrative Inefficiency — And How to Fix It",
    intro:
      "Healthcare organizations lose an estimated 25–30% of revenue to administrative inefficiency — denied claims, billing errors, manual data entry, and slow prior authorization cycles that delay both cash flow and patient care. The irony is that most of these losses are preventable. Modern healthcare BPO, powered by AI-assisted workflows and compliance-trained teams, can recover significant revenue while simultaneously improving the patient experience. This article breaks down where the leakage happens, why it's getting worse, and the operational changes that eliminate it — without requiring expensive in-house infrastructure.",
    outline: [
      "Where healthcare revenue actually disappears: a breakdown by process area",
      "Why manual claims processing is the single biggest risk factor",
      "How AI-assisted billing and coding reduces denial rates and accelerates reimbursement",
      "Building a compliant healthcare BPO operation: what good looks like",
      "Case snapshot: recovering $480K in denied claims through process redesign",
    ],
  },
  {
    tag: "AI Strategy",
    date: "April 2026",
    readTime: "5 min read",
    title: "AI Adoption in the Enterprise: What Separates Early Winners from Everyone Else",
    intro:
      "Most enterprises are now experimenting with AI. Few are winning with it. The gap between organizations that deploy AI successfully and those that struggle isn't about which models they use — it's about how they integrate AI into existing processes, teams, and decision-making structures. Based on our work with clients across healthcare, finance, and operations, we've identified the three most common failure modes in enterprise AI adoption, and the strategic patterns that consistently produce measurable, sustainable outcomes. If your AI initiatives feel like pilot programs that never graduate to production, this is for you.",
    outline: [
      "Failure mode #1: AI as a standalone product rather than a workflow layer",
      "Failure mode #2: Skipping the data and process audit before model selection",
      "Failure mode #3: No human escalation path for edge cases",
      "The three strategic patterns behind successful enterprise AI rollouts",
      "How to scope your first high-ROI AI use case in under 30 days",
    ],
  },
];

export default function BlogPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-44 pb-24 bg-background border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#214ECF05_1px,transparent_1px),linear-gradient(to_bottom,#214ECF05_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(71,163,255,0.09) 0%, transparent 65%)" }}
        />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <p className="text-xs font-mono uppercase tracking-[0.25em] mb-5" style={{ color: "#214ECF" }}>
              Thinkatic Insights
            </p>
            <h1
              className="font-display font-bold text-foreground leading-[1.0] mb-6"
              style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)" }}
            >
              Intelligence Meets<br />Practical Operations
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-xl">
              Perspectives on AI, BPO, and the future of enterprise operations — written by the team building it.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Posts */}
      <section className="py-24 bg-[#FFFFFF]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col gap-10">
            {posts.map((post, index) => (
              <motion.article
                key={post.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeUp}
                transition={{ delay: index * 0.06 }}
                className="rounded-2xl p-10 group"
                style={{ background: "#FFFFFF", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                {/* Meta */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: "rgba(71,163,255,0.10)", border: "1px solid rgba(33,78,207,0.18)", color: "#214ECF" }}
                  >
                    {post.tag}
                  </span>
                  <span className="text-muted-foreground text-xs">{post.date}</span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-muted-foreground text-xs">{post.readTime}</span>
                </div>

                {/* Title */}
                <h2 className="font-display font-bold text-foreground text-2xl md:text-3xl leading-snug mb-6">
                  {post.title}
                </h2>

                {/* Intro */}
                <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-3xl">
                  {post.intro}
                </p>

                {/* Outline */}
                <div>
                  <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">In this article</p>
                  <ul className="flex flex-col gap-2.5">
                    {post.outline.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#214ECF]/50" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA — coming soon state */}
                <div className="mt-8 pt-6 border-t" style={{ borderColor: "rgba(33,78,207,0.04)" }}>
                  <span className="text-xs text-foreground/20 font-mono">Full article coming soon — subscribe for updates</span>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
