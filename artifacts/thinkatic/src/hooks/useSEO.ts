/**
 * useSEO — per-page metadata, Open Graph, Twitter Card, canonical URL,
 * and JSON-LD structured data injection.
 *
 * Usage:
 *   useSEO({
 *     title: "Contact Us",
 *     description: "Get in touch with Thinkatic...",
 *     path: "/contact",
 *   });
 */

import { useEffect } from "react";

const SITE_NAME = "Thinkatic";
const BASE_URL = "https://thinkatic.com";
const DEFAULT_OG_IMAGE = `${BASE_URL}/opengraph.jpg`;

export interface SEOProps {
  /** Page-specific title — appended with " | Thinkatic" */
  title?: string;
  description?: string;
  /** Path without domain, e.g. "/contact" */
  path?: string;
  /** Override OG image URL */
  ogImage?: string;
  /** "website" | "article" */
  ogType?: "website" | "article";
  /** Prevent search engine indexing */
  noIndex?: boolean;
  /** Structured data (JSON-LD) object — serialised automatically */
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
  /** Article published date (ISO 8601) */
  articlePublishedTime?: string;
  /** Article modified date (ISO 8601) */
  articleModifiedTime?: string;
}

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  const existing = document.querySelector(`meta[${attr}="${name}"]`);
  if (existing) {
    existing.setAttribute("content", content);
  } else {
    const el = document.createElement("meta");
    el.setAttribute(attr, name);
    el.setAttribute("content", content);
    document.head.appendChild(el);
  }
}

function setLink(rel: string, href: string) {
  const existing = document.querySelector(`link[rel="${rel}"]`);
  if (existing) {
    existing.setAttribute("href", href);
  } else {
    const el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute("href", href);
    document.head.appendChild(el);
  }
}

function setJsonLd(data: Record<string, unknown> | Record<string, unknown>[]) {
  const id = "structured-data-script";
  const existing = document.getElementById(id);
  const script = existing ?? document.createElement("script");
  script.setAttribute("type", "application/ld+json");
  script.id = id;
  script.textContent = JSON.stringify(Array.isArray(data) ? data : data);
  if (!existing) document.head.appendChild(script);
}

export function useSEO({
  title,
  description,
  path = "/",
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  noIndex = false,
  structuredData,
  articlePublishedTime,
  articleModifiedTime,
}: SEOProps = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Enterprise Technology Transformation Partner`;
    const canonical = `${BASE_URL}${path === "/" ? "" : path}`;
    const absOgImage = ogImage.startsWith("http") ? ogImage : `${BASE_URL}${ogImage}`;

    // ── Document title ──────────────────────────────────────────────────────
    document.title = fullTitle;

    // ── Primary meta ────────────────────────────────────────────────────────
    if (description) setMeta("description", description);
    setMeta("robots", noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large");

    // ── Canonical ───────────────────────────────────────────────────────────
    setLink("canonical", canonical);

    // ── Open Graph ──────────────────────────────────────────────────────────
    setMeta("og:type", ogType, "property");
    setMeta("og:site_name", SITE_NAME, "property");
    setMeta("og:url", canonical, "property");
    setMeta("og:title", fullTitle, "property");
    if (description) setMeta("og:description", description, "property");
    setMeta("og:image", absOgImage, "property");
    setMeta("og:image:width", "1200", "property");
    setMeta("og:image:height", "630", "property");
    setMeta("og:image:alt", `${SITE_NAME} — ${title ?? "Enterprise Technology Transformation"}`, "property");
    setMeta("og:locale", "en_US", "property");

    if (articlePublishedTime) setMeta("article:published_time", articlePublishedTime, "property");
    if (articleModifiedTime) setMeta("article:modified_time", articleModifiedTime, "property");

    // ── Twitter Card ────────────────────────────────────────────────────────
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:site", "@thinkatic");
    setMeta("twitter:title", fullTitle);
    if (description) setMeta("twitter:description", description);
    setMeta("twitter:image", absOgImage);
    setMeta("twitter:image:alt", `${SITE_NAME} — ${title ?? "AI-Powered BPO"}`);

    // ── JSON-LD ─────────────────────────────────────────────────────────────
    if (structuredData) {
      setJsonLd(structuredData);
    } else {
      // Default Organisation schema on every page
      setJsonLd({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Thinkatic",
        url: BASE_URL,
        sameAs: [
          "https://www.linkedin.com/company/thinkatic",
          "https://twitter.com/thinkatic",
        ],
        contactPoint: {
          "@type": "ContactPoint",
          telephone: "+91-726-387-4459",
          contactType: "customer service",
          areaServed: "Worldwide",
          availableLanguage: "English",
        },
        address: {
          "@type": "PostalAddress",
          streetAddress: "Tower B, Magarpatta City, Hadapsar",
          addressLocality: "Pune",
          addressRegion: "Maharashtra",
          postalCode: "411028",
          addressCountry: "IN",
        },
      });
    }

    return () => {
      // Reset to defaults on unmount (SPA navigation)
      document.title = `${SITE_NAME} — AI-Powered BPO & Enterprise Technology Solutions`;
    };
  }, [title, description, path, ogImage, ogType, noIndex, structuredData, articlePublishedTime, articleModifiedTime]);
}

// ─── Pre-built structured data helpers ───────────────────────────────────────

export const STRUCTURED_DATA = {
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Thinkatic",
    url: BASE_URL,
    description: "AI-Powered Business Process Outsourcing & Enterprise Technology Solutions",
    sameAs: [
      "https://www.linkedin.com/company/thinkatic",
      "https://twitter.com/thinkatic",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+91-726-387-4459",
      contactType: "customer service",
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: "Tower B, Magarpatta City, Hadapsar",
      addressLocality: "Pune",
      addressRegion: "Maharashtra",
      postalCode: "411028",
      addressCountry: "IN",
    },
  },

  localBusiness: {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${BASE_URL}/#business`,
    name: "Thinkatic",
    image: `${BASE_URL}/opengraph.jpg`,
    url: BASE_URL,
    telephone: "+91-726-387-4459",
    email: "Thinkaticai@gmail.com",
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Tower B, Magarpatta City, Hadapsar",
      addressLocality: "Pune",
      addressRegion: "Maharashtra",
      postalCode: "411028",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 18.5167,
      longitude: 73.9311,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "19:00",
    },
  },

  website: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    url: BASE_URL,
    name: "Thinkatic",
    description: "AI-Powered BPO & Enterprise Technology Solutions",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${BASE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  },

  faqPage: (faqs: Array<{ question: string; answer: string }>) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  }),

  jobPosting: (job: {
    title: string; description: string; datePosted: string;
    employmentType: string; location: string;
  }) => ({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.datePosted,
    employmentType: job.employmentType,
    hiringOrganization: { "@type": "Organization", name: "Thinkatic", sameAs: BASE_URL },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: job.location, addressCountry: "IN" },
    },
  }),

  breadcrumb: (items: Array<{ name: string; path: string }>) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${BASE_URL}${item.path}`,
    })),
  }),

  service: (svc: { name: string; description: string; url: string }) => ({
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: svc.name,
    description: svc.description,
    url: `${BASE_URL}${svc.url}`,
    provider: { "@type": "Organization", name: "Thinkatic", url: BASE_URL },
  }),
};
