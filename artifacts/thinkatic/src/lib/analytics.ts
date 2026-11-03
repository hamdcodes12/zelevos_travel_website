/**
 * analytics.ts — Privacy-respecting analytics setup.
 *
 * - Only fires after explicit cookie consent
 * - Supports Google Analytics 4 (GA4) via gtag.js
 * - Provides typed event tracking helpers
 * - Consent-gated: no cookies/network requests until user accepts
 *
 * Setup:
 *   1. Replace MEASUREMENT_ID with your GA4 ID (e.g. "G-XXXXXXXXXX")
 *   2. The script tag is injected dynamically only after consent
 *   3. Listen for 'cookie-consent' CustomEvent (fired by CookieBanner)
 */

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID ?? "";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let initialized = false;

// ─── Init ─────────────────────────────────────────────────────────────────────

function initGA() {
  if (initialized || !MEASUREMENT_ID) return;
  initialized = true;

  // Inject gtag script
  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  script.async = true;
  document.head.appendChild(script);

  // Init dataLayer
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function (...args: unknown[]) {
    window.dataLayer.push(args);
  };

  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: false, // We handle page views manually via SPA routing
  });
}

// ─── Consent listener ────────────────────────────────────────────────────────

export function initAnalytics() {
  // Re-check stored consent on app load
  try {
    const stored = localStorage.getItem("thinkatic_cookie_consent");
    if (stored) {
      const prefs = JSON.parse(stored) as { analytics?: boolean };
      if (prefs.analytics) initGA();
    }
  } catch { /* ignore */ }

  // Listen for runtime consent changes (from CookieBanner)
  window.addEventListener("cookie-consent", (e: Event) => {
    const ev = e as CustomEvent<{ analytics?: boolean }>;
    if (ev.detail?.analytics) initGA();
  });
}

// ─── Page view tracking ───────────────────────────────────────────────────────

export function trackPageView(path: string, title?: string) {
  if (!initialized || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title ?? document.title,
    page_location: window.location.href,
  });
}

// ─── Event tracking helpers ───────────────────────────────────────────────────

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>
) {
  if (!initialized || !window.gtag) return;
  window.gtag("event", name, params);
}

// Typed helpers for common events
export const analytics = {
  /** Track form submission */
  formSubmit: (formName: string, success: boolean) =>
    trackEvent("form_submit", { form_name: formName, success }),

  /** Track CTA button clicks */
  ctaClick: (label: string, location: string) =>
    trackEvent("cta_click", { cta_label: label, cta_location: location }),

  /** Track outbound link clicks */
  outboundLink: (url: string) =>
    trackEvent("click", { event_category: "outbound", event_label: url }),

  /** Track file downloads */
  download: (fileName: string) =>
    trackEvent("file_download", { file_name: fileName }),

  /** Track video plays */
  videoPlay: (videoTitle: string) =>
    trackEvent("video_play", { video_title: videoTitle }),

  /** Track scroll depth */
  scrollDepth: (percent: number) =>
    trackEvent("scroll", { percent_scrolled: percent }),

  /** Track contact page views */
  contactView: (source?: string) =>
    trackEvent("contact_page_view", { source: source ?? "direct" }),

  /** Track job application starts */
  applicationStart: (position: string) =>
    trackEvent("application_start", { position }),

  /** Track proposal requests */
  proposalRequest: (step: number) =>
    trackEvent("proposal_request", { step }),
};

// ─── SPA route change tracking ────────────────────────────────────────────────

/**
 * Call this hook in your router to track page views on navigation.
 * Usage in App.tsx: usePageTracking()
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

export function usePageTracking() {
  const [location] = useLocation();

  useEffect(() => {
    trackPageView(location, document.title);
  }, [location]);
}
