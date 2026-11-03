import React from "react";
import Layout from "@/components/layout/Layout";
import { Hero } from "@/components/sections/Hero";
import { FeatureIconRow } from "@/components/sections/FeatureIconRow";
import { IntroOutcomeSection } from "@/components/sections/IntroOutcomeSection";
import { WhatWeDoSection } from "@/components/sections/WhatWeDoSection";
import { AdvantagePillarsSection } from "@/components/sections/AdvantagePillarsSection";
import { BuiltAroundBusinessSection } from "@/components/sections/BuiltAroundBusinessSection";
import { ScaleWithoutComplexitySection } from "@/components/sections/ScaleWithoutComplexitySection";
import { ExtensionOfTeamSection } from "@/components/sections/ExtensionOfTeamSection";
import { IndustriesGridSection } from "@/components/sections/IndustriesGridSection";
import { MeasureWhatMattersSection } from "@/components/sections/MeasureWhatMattersSection";
import { FinalHomeCTASection } from "@/components/sections/FinalHomeCTASection";
import { useSEO } from "@/hooks/useSEO";

export default function Home() {
  useSEO({
    title: "Thinkatic — Your Global BPO Delivery Partner",
    description:
      "Thinkatic connects verified BPO centres with international business opportunities across the US and UK. From talent to technology, Thinkatic powers your global growth.",
    path: "/",
  });

  return (
    <Layout>
      {/* 1. Full-Width Hero (Current approved UI, completely untouched) */}
      <Hero />

      {/* 2. Value Strip (6 refined cards below Hero) */}
      <FeatureIconRow />

      {/* 3. Introduction Section (Your Business. Our Expertise. Better Outcomes.) */}
      <IntroOutcomeSection />

      {/* 4. What We Do (3 premium service cards) */}
      <WhatWeDoSection />

      {/* 5. Technology + People + Process (The Thinkatic Advantage) */}
      <AdvantagePillarsSection />

      {/* 6. Built Around Your Business (6-step process timeline) */}
      <BuiltAroundBusinessSection />

      {/* 7. Scale Without the Complexity (Dark-blue 4-card section) */}
      <ScaleWithoutComplexitySection />

      {/* 8. More Than an Outsourcing Partner (We Become an Extension of Your Team) */}
      <ExtensionOfTeamSection />

      {/* 9. Industries We Serve (8 industry cards) */}
      <IndustriesGridSection />

      {/* 10. Built to Measure What Matters (7 performance metric categories) */}
      <MeasureWhatMattersSection />

      {/* 11. Final CTA (Ready to Build a Smarter Operation? Let's Talk.) */}
      <FinalHomeCTASection />
    </Layout>
  );
}
