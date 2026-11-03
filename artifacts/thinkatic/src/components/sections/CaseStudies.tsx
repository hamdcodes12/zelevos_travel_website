import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const cases = [
  {
    title: "NexaHealth Predictive Analytics",
    metric: "40%",
    metricLabel: "Cost Reduction",
    desc: "Custom ML pipeline to predict patient admission rates and optimize staff allocation."
  },
  {
    title: "Velocify Content Engine",
    metric: "10x",
    metricLabel: "Output Increase",
    desc: "Enterprise RAG system generating technical documentation from unstructured engineering notes."
  },
  {
    title: "Lumin Finance Risk Oracle",
    metric: "8 Wks",
    metricLabel: "Time to Market",
    desc: "Real-time anomaly detection system for high-frequency trading platforms."
  }
];

export function CaseStudies() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-66%"]);

  return (
    <section id="work" ref={containerRef} className="h-[300vh] relative bg-background">
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 w-full mb-12">
          <h2 className="text-4xl md:text-5xl font-display font-bold">Featured <span className="text-gradient">Work</span></h2>
        </div>
        
        <motion.div style={{ x }} className="flex gap-8 px-6 w-[300vw] md:w-[150vw]">
          {cases.map((study, i) => (
            <div key={i} className="w-[80vw] md:w-[45vw] h-[50vh] glass-panel rounded-3xl p-12 flex flex-col justify-between shrink-0">
              <div>
                <h3 className="text-3xl font-display font-bold mb-4">{study.title}</h3>
                <p className="text-xl text-muted-foreground">{study.desc}</p>
              </div>
              <div>
                <div className="text-7xl font-display font-bold text-primary mb-2">{study.metric}</div>
                <div className="text-sm tracking-widest uppercase text-muted-foreground">{study.metricLabel}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
