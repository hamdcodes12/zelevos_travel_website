/**
 * App.tsx — Root application component.
 *
 * Optimisations applied here:
 * - All page components are lazy-loaded (code splitting per route)
 * - Suspense boundary shows PageSkeleton while chunks load
 * - ErrorBoundary wraps the whole router
 * - CookieBanner rendered outside router (global)
 * - Analytics page-view tracking via usePageTracking()
 * - Admin routes are excluded from preloading
 */

import { Suspense, lazy } from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { HelpSupportDesk } from "@/components/HelpSupportDesk";
import CookieBanner from "@/components/CookieBanner";
import { usePageTracking, initAnalytics } from "@/lib/analytics";
import { useEffect } from "react";

// ── Lazy-loaded page components ───────────────────────────────────────────────
// Each import() call creates a separate JS chunk (code splitting).
// Heavy 3-D / Three.js pages get their own chunks automatically via manualChunks.

const Home               = lazy(() => import("@/pages/Home"));
const ServicesPage       = lazy(() => import("@/pages/ServicesPage"));
const GlobalDeliveryPage = lazy(() => import("@/pages/GlobalDeliveryPage"));
const BPOPartnerBenefitsPage = lazy(() => import("@/pages/BPOPartnerBenefitsPage"));
const ServiceDetailPage  = lazy(() => import("@/pages/ServiceDetailPage"));
const CaseStudiesPage    = lazy(() => import("@/pages/CaseStudiesPage"));
const ProcessPage        = lazy(() => import("@/pages/ProcessPage"));
const AboutPage          = lazy(() => import("@/pages/AboutPage"));
const ContactPage        = lazy(() => import("@/pages/ContactPage"));
const PricingPage        = lazy(() => import("@/pages/PricingPage"));
const LegalPage          = lazy(() => import("@/pages/LegalPage"));
const PrivacyPolicyPage  = lazy(() => import("@/pages/PrivacyPolicyPage"));
const TermsPage          = lazy(() => import("@/pages/TermsPage"));
const CookiePolicyPage   = lazy(() => import("@/pages/CookiePolicyPage"));
const FAQPage            = lazy(() => import("@/pages/FAQPage"));
const BlogPage           = lazy(() => import("@/pages/BlogPage"));
const CareersPage        = lazy(() => import("@/pages/CareersPage"));
const TechnologyAIPage   = lazy(() => import("@/pages/TechnologyAIPage"));
const TechnologyPage     = lazy(() => import("@/pages/TechnologyPage"));
const NetworkPage        = lazy(() => import("@/pages/NetworkPage"));
const RequestProposalPage = lazy(() => import("@/pages/RequestProposalPage"));
const ApplyOnlinePage    = lazy(() => import("@/pages/ApplyOnlinePage"));
const PublicTicketPage   = lazy(() => import("@/pages/PublicTicketPage"));
const NotFound           = lazy(() => import("@/pages/not-found"));

// Admin pages — only loaded when explicitly navigated to
const AdminLoginPage     = lazy(() => import("@/pages/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("@/pages/AdminDashboardPage"));
const AdminControlCentrePage = lazy(() => import("@/pages/AdminControlCentrePage"));

// Client Portal & Dashboard pages
const UserAuthPage       = lazy(() => import("@/pages/UserAuthPage"));
const UserDashboardPage  = lazy(() => import("@/pages/UserDashboardPage"));
const ClientPortalPage   = lazy(() => import("@/pages/ClientPortalPage"));
const PartnerDashboardPage = lazy(() => import("@/pages/PartnerDashboardPage"));
const BPOPartnerWizardPage = lazy(() => import("@/pages/BPOPartnerWizardPage"));
const BPOApplicationStatusPage = lazy(() => import("@/pages/BPOApplicationStatusPage"));

// Thinkatic Agent Portal & Activation pages
const AgentLoginPage     = lazy(() => import("@/pages/AgentLoginPage"));
const AgentActivationPage= lazy(() => import("@/pages/AgentActivationPage"));
const AgentPortalPage    = lazy(() => import("@/pages/AgentPortalPage"));

// ── React Query client ────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5-min stale time prevents redundant re-fetches on tab focus
      staleTime: 5 * 60 * 1000,
      // Retry once on error with exponential back-off
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
  },
});

// ── Router with analytics tracking ───────────────────────────────────────────

function Router() {
  usePageTracking();

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/services" component={ServicesPage} />
        <Route path="/global-delivery" component={GlobalDeliveryPage} />
        <Route path="/bpo-partner-benefits" component={BPOPartnerBenefitsPage} />
        <Route path="/services/:serviceSlug/:packageSlug" component={ServiceDetailPage} />
        <Route path="/services/:slug" component={ServiceDetailPage} />
        <Route path="/case-studies" component={CaseStudiesPage} />
        <Route path="/process" component={ProcessPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/pricing" component={PricingPage} />
        {/* ── Thinkatic Legal Center: 12 Canonical Policies & Agreements (19 Sep 2026) ── */}
        <Route path="/legal/:slug" component={LegalPage} />
        <Route path="/legal/privacy-policy" component={LegalPage} />
        <Route path="/legal/terms" component={LegalPage} />
        <Route path="/legal/partner-agreement" component={LegalPage} />
        <Route path="/legal/client-agreement" component={LegalPage} />
        <Route path="/legal/nda" component={LegalPage} />
        <Route path="/legal/data-protection" component={LegalPage} />
        <Route path="/legal/acceptable-use" component={LegalPage} />
        <Route path="/legal/partner-eligibility" component={LegalPage} />
        <Route path="/legal/payment-commission" component={LegalPage} />
        <Route path="/legal/termination-suspension" component={LegalPage} />
        <Route path="/legal/grievance" component={LegalPage} />
        <Route path="/legal/cookie-policy" component={LegalPage} />
        <Route path="/legal">{() => <Redirect to="/legal/privacy-policy" />}</Route>

        {/* Legacy legal routes redirected to canonical routes */}
        <Route path="/privacy-policy">{() => <Redirect to="/legal/privacy-policy" />}</Route>
        <Route path="/privacy">{() => <Redirect to="/legal/privacy-policy" />}</Route>
        <Route path="/terms">{() => <Redirect to="/legal/terms" />}</Route>
        <Route path="/cookie-policy">{() => <Redirect to="/legal/cookie-policy" />}</Route>
        <Route path="/cookies">{() => <Redirect to="/legal/cookie-policy" />}</Route>
        <Route path="/faqs" component={FAQPage} />
        <Route path="/faq" component={FAQPage} />
        <Route path="/blog" component={BlogPage} />
        <Route path="/careers" component={CareersPage} />
        <Route path="/technology-ai" component={TechnologyAIPage} />
        <Route path="/technology" component={TechnologyAIPage} />
        <Route path="/network" component={NetworkPage} />
        <Route path="/request-proposal" component={RequestProposalPage} />
        <Route path="/apply-online" component={ApplyOnlinePage} />
        <Route path="/public-ticket" component={PublicTicketPage} />
        <Route path="/admin-login" component={AdminLoginPage} />
        {/* ADMIN CONTROL CENTRE / CRM ROUTE COMMENTED OUT PER USER REQUIREMENT - PRESERVED FOR RESTORATION */}
        {/* <Route path="/admin/control-centre" component={AdminControlCentrePage} /> */}
        <Route path="/admin/control-centre">{() => <Redirect to="/admin" />}</Route>
        {/* ADMIN CLIENTS CONTROL CENTRE ROUTE COMMENTED OUT PER USER REQUIREMENT - PRESERVED FOR RESTORATION */}
        {/* <Route path="/admin/clients" component={AdminControlCentrePage} /> */}
        <Route path="/admin/clients">{() => <Redirect to="/admin" />}</Route>
        {/* ADMIN BPO PARTNERS CONTROL CENTRE ROUTE COMMENTED OUT PER USER REQUIREMENT - PRESERVED FOR RESTORATION */}
        {/* <Route path="/admin/partners" component={AdminControlCentrePage} /> */}
        {/* <Route path="/admin/bpo-partners" component={AdminControlCentrePage} /> */}
        <Route path="/admin/partners">{() => <Redirect to="/admin" />}</Route>
        <Route path="/admin/bpo-partners">{() => <Redirect to="/admin" />}</Route>
        <Route path="/admin/centre-verification" component={AdminControlCentrePage} />
        <Route path="/admin/office-verification" component={AdminControlCentrePage} />
        {/* ADMIN BPO APPROVALS ROUTE - SAFELY MAPS TO CLASSIC DASHBOARD BPO APPROVALS */}
        <Route path="/admin/bpo-approvals">{() => <Redirect to="/admin?section=bpo-approvals" />}</Route>
        <Route path="/admin/bpo-management">{() => <Redirect to="/admin?section=bpo-approvals" />}</Route>
        <Route path="/admin/public-tickets" component={AdminControlCentrePage} />
        <Route path="/admin/features" component={AdminControlCentrePage} />
        {/* BPO CONNECT & ADMIN ROUTES */}
        <Route path="/admin/bpo-connect">{() => <Redirect to="/admin?section=bpo-connect" />}</Route>
        <Route path="/admin/connect">{() => <Redirect to="/admin?section=bpo-connect" />}</Route>
        <Route path="/admin/bpo-meetings">{() => <Redirect to="/admin?section=bpo-meetings" />}</Route>
        <Route path="/admin" component={AdminDashboardPage} />
        <Route path="/login" component={UserAuthPage} />
        <Route path="/signup" component={UserAuthPage} />
        <Route path="/auth" component={UserAuthPage} />
        <Route path="/dashboard" component={UserDashboardPage} />
        <Route path="/client" component={ClientPortalPage} />
        <Route path="/client/portal" component={ClientPortalPage} />
        <Route path="/bpo/connect-admin">{() => <Redirect to="/partner?tab=connect-admin" />}</Route>
        <Route path="/bpo/connect">{() => <Redirect to="/partner?tab=connect-admin" />}</Route>
        <Route path="/partner" component={PartnerDashboardPage} />
        <Route path="/partner/apply" component={BPOPartnerWizardPage} />
        <Route path="/partner/application-status" component={BPOApplicationStatusPage} />
        <Route path="/become-partner" component={BPOPartnerWizardPage} />

        {/* Thinkatic Agent Portal Routes */}
        <Route path="/agent/login" component={AgentLoginPage} />
        <Route path="/agent/activate" component={AgentActivationPage} />
        <Route path="/agent/setup-password" component={AgentActivationPage} />
        <Route path="/agent" component={AgentPortalPage} />
        <Route path="/agent/:tab" component={AgentPortalPage} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────

function App() {
  // Initialise analytics on mount (consent-gated — only fires if user has
  // previously accepted cookies, or after they do so via CookieBanner)
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          {/* Global overlays — rendered outside the page tree */}
          <CookieBanner />
          {/* <HelpSupportDesk /> — Globally disabled per UI requirements. Implementation preserved in components/HelpSupportDesk.tsx */}
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
