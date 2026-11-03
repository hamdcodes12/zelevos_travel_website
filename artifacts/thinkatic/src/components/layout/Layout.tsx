import React from "react";
import { useLenis } from "@/hooks/useLenis";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ScrollToTop from "@/components/layout/ScrollToTop";
import { useLocation } from "wouter";
import { useSEO } from "@/hooks/useSEO";

const ROUTE_SEO: Record<string, { title: string; description: string }> = {
  "/": { title: "AI-Powered BPO & Enterprise Technology Solutions", description: "Thinkatic combines AI, human expertise, and operational excellence to modernize enterprise business processes." },
  "/about": { title: "About Thinkatic", description: "Learn how Thinkatic helps enterprises scale operations with AI-powered BPO and technology solutions." },
  "/services": { title: "Thinkatic Services | Technology, AI, Automation & BPO", description: "Explore Thinkatic technology, AI, automation, software development, QA, dedicated developers, maintenance and BPO services." },
  "/global-delivery": { title: "Thinkatic | Global Delivery & Business Process Outsourcing", description: "Thinkatic provides technology-enabled global delivery, customer support, business process outsourcing, and operational solutions designed around business requirements." },
  "/bpo-partner-benefits": { title: "Thinkatic | BPO Partner Benefits & Global Delivery Partnership", description: "Partner with Thinkatic as a verified BPO delivery centre and access structured project opportunities, operational tools, capacity management, performance visibility and payout management." },
  "/case-studies": { title: "Case Studies", description: "See how Thinkatic delivers measurable outcomes through AI, technology, and BPO partnerships." },
  "/process": { title: "Our Process", description: "Discover Thinkatic's structured process for delivering secure, scalable AI and BPO solutions." },
  "/contact": { title: "Contact Thinkatic | Technology, BPO & Business Solutions", description: "Contact Thinkatic to discuss technology, AI, customer experience, BPO and business process solutions for your organization." },
  "/pricing": { title: "Pricing", description: "Review Thinkatic service packages and find the right engagement model for your business." },
  "/faqs": { title: "Thinkatic FAQs | Global BPO, Technology & Business Solutions", description: "Find answers about Thinkatic services, global delivery, BPO partnerships, technology, AI, projects, payments, security and operations." },
  "/faq": { title: "Thinkatic FAQs | Global BPO, Technology & Business Solutions", description: "Find answers about Thinkatic services, global delivery, BPO partnerships, technology, AI, projects, payments, security and operations." },
  "/blog": { title: "Insights", description: "Read Thinkatic insights on AI, outsourcing, automation, and enterprise operations." },
  "/technology-ai": { title: "Thinkatic | Technology & AI Solutions", description: "Thinkatic provides technology services, AI solutions, automation, customer experience technology and business process solutions designed around real business requirements." },
  "/technology": { title: "Thinkatic | Technology & AI Solutions", description: "Thinkatic provides technology services, AI solutions, automation, customer experience technology and business process solutions designed around real business requirements." },
  "/network": { title: "Thinkatic | Global BPO & Delivery Network", description: "Explore the Thinkatic global delivery network connecting businesses, verified BPO partners, delivery centres, skilled teams and technology-enabled operations." },
  "/request-proposal": { title: "Request a Proposal", description: "Tell Thinkatic about your goals and request a tailored AI, technology, or BPO proposal." },
  "/apply-online": { title: "Apply Online", description: "Apply to join Thinkatic's growing team of BPO, technology, and AI professionals." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  useLenis();
  const [location] = useLocation();
  const seo = ROUTE_SEO[location] ?? (location.startsWith("/services/")
    ? { title: "Service Details", description: "Explore a Thinkatic service designed for secure, scalable business transformation." }
    : { title: "Thinkatic", description: "Thinkatic delivers AI-powered BPO and enterprise technology solutions." });
  useSEO({ ...seo, path: location });

  return (
    <div className="bg-background min-h-[100dvh] text-foreground overflow-x-hidden font-sans selection:bg-primary/30 selection:text-primary">
      <ScrollToTop />
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
