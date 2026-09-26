import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  CreditCard,
  Fuel,
  Heart,
  Hotel,
  Luggage,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plane,
  Plus,
  Route,
  Search,
  Send,
  ShieldCheck,
  Settings,
  Sparkles,
  Star,
  Ticket,
  TrainFront,
  TrendingDown,
  Users,
  Wallet,
  UserRound,
  UsersRound,
  X,
  Award,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Route as WouterRoute, Switch, Router as WouterRouter, useLocation, useRoute } from 'wouter';
import { TravelHub, type FlightSearchPrefill } from '@/components/travel-hub';
import { detectHomepageIntent } from '@/lib/intent';
import { AuthDialog, type AuthUser } from '@/components/auth-dialog';
import { FlightsPage } from '@/pages/flights';
import { AdminPage } from '@/pages/admin';
import { LocationAutocomplete } from '@/components/location-autocomplete';
import { PackageDetailModal, type PackageDetail } from '@/components/package-detail-modal';
import { PackageCheckoutModal } from '@/components/package-checkout-modal';
import { CustomTripModal } from '@/components/custom-trip-modal';
import { SupportTicketModal } from '@/components/support-ticket-modal';
import { CuratedPackagesSection } from '@/components/curated-packages-section';
import { PartnerRegistrationModal } from '@/components/partner-modal';
import { GlobalSearchModal } from '@/components/global-search-modal';
import { PartnerPortalPage } from '@/pages/partner-portal';
import { BecomeSupplierPage } from '@/pages/become-supplier';
import { VendorPortalPage } from '@/pages/vendor-portal';

const queryClient = new QueryClient();

async function askZelevos(message: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []) {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  const payload = (await response.json()) as { response?: string; message?: string };
  if (!response.ok || !payload.response) {
    throw new Error(payload.message || 'Zelevos AI is temporarily unavailable.');
  }
  return payload.response;
}

type TripDraft = {
  destination: string;
  dates: string;
  durationDays: number;
  travellers: number;
  budget: string;
  preferences: string[];
  itinerary: ItineraryDay[];
  estimatedCosts: Record<string, unknown>;
  transportInfo: Record<string, unknown> | null;
  hotelInfo: Record<string, unknown> | null;
  reasoning: string;
};

type ItineraryDay = {
  day: number;
  title: string;
  activities: string[];
};

type PlannerResult = {
  summary: string;
  itinerary: ItineraryDay[];
  estimatedCosts: Record<string, unknown>;
  transportInfo: Record<string, unknown> | null;
  hotelInfo: Record<string, unknown> | null;
  reasoning: string;
  model: string;
};

type TripRecord = TripDraft & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

async function currentUser() {
  const response = await fetch('/api/auth/user', { credentials: 'include' });
  if (response.status === 401) return null;
  const text = await response.text();
  let payload: { user?: AuthUser; message?: string } = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
  if (!response.ok || !payload.user) throw new Error(payload.message || 'Account status could not be loaded.');
  return payload.user;
}

async function authRequest(path: string, credentials: { email: string; password: string }) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const text = await response.text();
  let payload: { user?: AuthUser; message?: string } = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `Account action failed with status ${response.status}`);
  }
  if (!response.ok || !payload.user) throw new Error(payload.message || 'Account action could not be completed.');
  return payload.user;
}

async function logout() {
  const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  if (!response.ok) {
    const text = await response.text();
    let payload: { message?: string } = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {}
    throw new Error(payload.message || 'Logout could not be completed.');
  }
}

async function tripRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'include' });
  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `Trip request failed with status ${response.status}`);
  }
  if (!response.ok) throw new Error(payload.message || 'Zelevos could not complete that trip action.');
  return payload as T & { message?: string };
}

async function createTrip(draft: TripDraft) {
  return tripRequest<TripRecord>('/api/trips', { method: 'POST', body: JSON.stringify(draft) });
}

async function listTrips() {
  return tripRequest<TripRecord[]>('/api/trips');
}

async function updateTrip(id: string, changes: Partial<TripDraft>) {
  return tripRequest<TripRecord>(`/api/trips/${id}`, { method: 'PUT', body: JSON.stringify(changes) });
}

async function deleteTrip(id: string) {
  await tripRequest<unknown>(`/api/trips/${id}`, { method: 'DELETE' });
}

type TravellerProfile = {
  displayName: string;
  homeCity: string;
  avatarInitials: string;
  budgetStyle: string;
  hotelStyle: string;
  travelStyle: string;
  foodPreferences: string[];
  activityPreferences: string[];
  savedDestinations: string[];
  crowdTolerance: string;
};

async function profileRequest<T>(path: string, init: RequestInit = {}) {
  return tripRequest<T>(path, init);
}

async function askConcierge(message: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []) {
  const response = await fetch('/api/concierge', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  const text = await response.text();
  let payload: { response?: string; message?: string } = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `Concierge request failed with status ${response.status}`);
  }
  if (!response.ok || !payload.response) throw new Error(payload.message || 'The trip concierge is temporarily unavailable.');
  return payload.response;
}

async function planTrip(input: Omit<TripDraft, 'itinerary' | 'estimatedCosts' | 'transportInfo' | 'hotelInfo' | 'reasoning'>) {
  const response = await fetch('/api/ai/planner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const text = await response.text();
  let payload: PlannerResult & { message?: string } = {} as any;
  try {
    payload = text ? JSON.parse(text) : ({} as any);
  } catch {
    throw new Error(text || `Trip planner failed with status ${response.status}`);
  }
  if (!response.ok || !payload.itinerary || !payload.reasoning) {
    throw new Error(payload.message || 'Zelevos could not build your itinerary.');
  }
  return payload;
}

const imageSources = {
  hero: '/kashmir-dawn.jpg',
  ladakh: '/ladakh-road.jpg',
  kerala: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=900&q=85',
  udaipur: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=85',
  goa: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=85',
  rajasthan: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=900&q=85',
  bali: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=85',
};

const services = [
  { icon: Sparkles, label: 'AI Trip Planner', copy: 'Personalized trips in seconds' },
  { icon: Plane, label: 'Flights', copy: 'Best prices & flexible options' },
  { icon: Hotel, label: 'Hotels', copy: 'Verified stays & real reviews' },
  { icon: Fuel, label: 'Transport', copy: 'Local & private options' },
  { icon: Compass, label: 'Experiences', copy: 'Tours, activities & more' },
  { icon: ShieldCheck, label: 'Travel Insurance', copy: 'Stay protected' },
  { icon: Wallet, label: 'Zelevos Wallet', copy: 'Secure & seamless payments' },
];

const destinations = [
  { name: 'Kerala', category: 'Nature & wellness', price: '₹52,000', image: imageSources.kerala },
  { name: 'Kashmir', category: 'Mountains', price: '₹58,000', image: imageSources.hero },
  { name: 'Udaipur', category: 'Heritage', price: '₹46,000', image: imageSources.udaipur },
  { name: 'Goa', category: 'Beaches', price: '₹42,000', image: imageSources.goa },
  { name: 'Rajasthan', category: 'Culture', price: '₹48,000', image: imageSources.rajasthan },
];

const plannerSuggestions = [
  'Take me to the mountains',
  'A beach trip under ₹50,000',
  'A food-first weekend',
];

const dashboardTabs = [
  { id: 'trip', label: 'Trip OS', icon: Route },
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'price', label: 'Price intelligence', icon: TrendingDown },
  { id: 'safety', label: 'Travel safety', icon: ShieldCheck },
];

function Logo() {
  const [, setLocation] = useLocation();
  return (
    <a
      href="/"
      onClick={(e) => {
        e.preventDefault();
        setLocation('/');
      }}
      className="brand"
      aria-label="Zelevos home"
    >
      <img
        src="/icon_zelevos_transparent.png"
        alt="Zelevos"
        className="brand-logo-img"
        width="34"
        height="34"
      />
      <span className="brand-word">Zelevos</span>
    </a>
  );
}

function Button({
  children,
  variant = 'primary',
  onClick,
  className = '',
  type = 'button',
  disabled = false,
  id,
}: {
  children: ReactNode;
  variant?: 'primary' | 'outline' | 'soft' | 'ghost';
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button id={id} type={type} onClick={onClick} disabled={disabled} className={`button button-${variant} ${className}`}>
      {children}
    </button>
  );
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: ReactNode; copy?: string }) {
  return (
    <div className="section-heading">
      <div className="eyebrow"><span className="eyebrow-line" />{eyebrow}</div>
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
    </div>
  );
}

function Navbar({
  user,
  authLoading,
  onLogin,
  onLogout,
  onOpenBuildMyTrip,
  onOpenSupport,
  onSelectPackage,
  onSearchDestination,
}: {
  user: AuthUser | null;
  authLoading: boolean;
  onLogin: (mode?: 'login' | 'signup') => void;
  onLogout: () => void;
  onOpenBuildMyTrip?: () => void;
  onOpenSupport?: () => void;
  onSelectPackage?: (slug: string) => void;
  onSearchDestination?: (destination: string) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [selectedNotifModal, setSelectedNotifModal] = useState<any | null>(null);
  const [customerNotifs, setCustomerNotifs] = useState<any[]>([]);
  const [notifCategoryFilter, setNotifCategoryFilter] = useState<string>("ALL");
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [location, setLocation] = useLocation();
  const isFlights = location === '/flights';

  const fetchCustomerNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.results) {
        setCustomerNotifs(data.results);
        setUnreadNotifCount(data.results.filter((n: any) => n.unread).length);
      }
    } catch {}
  };

  useEffect(() => {
    if (user) {
      fetchCustomerNotifications();
      const interval = setInterval(fetchCustomerNotifications, 12000);
      return () => clearInterval(interval);
    } else {
      setCustomerNotifs([]);
      setUnreadNotifCount(0);
      return undefined;
    }
  }, [user]);

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST', credentials: 'include' });
      setCustomerNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false, readAt: new Date().toISOString() } : n)));
      setUnreadNotifCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
      setCustomerNotifs((prev) => prev.map((n) => ({ ...n, unread: false, readAt: new Date().toISOString() })));
      setUnreadNotifCount(0);
    } catch {}
  };

  const handleNotificationCtaClick = async (notif: any) => {
    try {
      await fetch(`/api/notifications/${notif.id}/click`, { method: 'POST', credentials: 'include' });
      setCustomerNotifs((prev) => prev.map((n) => (n.id === notif.id ? { ...n, unread: false, clickedAt: new Date().toISOString() } : n)));
      setUnreadNotifCount((c) => Math.max(0, c - 1));
    } catch {}
    setNotifDrawerOpen(false);
    if (notif.actionUrl) {
      if (notif.actionUrl.startsWith('/')) {
        setLocation(notif.actionUrl);
      } else {
        window.location.href = notif.actionUrl;
      }
    }
  };

  // Global Ctrl+K / Cmd+K search shortcut listener
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // 1. Transparent to White navbar scroll detection
  const [isScrolled, setIsScrolled] = useState(() => {
    if (typeof window !== 'undefined') {
      return location !== '/' || window.scrollY > 40;
    }
    return false;
  });

  // 2. Active section detection (Underline & highlight indicator)
  const [activeSection, setActiveSection] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/flights') return 'Flights';
      const hash = window.location.hash;
      if (hash.includes('curated-packages')) return 'Packages';
      if (hash.includes('why-zelevos')) return 'Why Zelevos';
      if (hash.includes('travel-hub')) return 'Travel Hub';
      if (hash.includes('partner-program')) return 'Partner Program';
      if (hash.includes('my-trips')) return 'Trips';
    }
    return 'Home';
  });

  useEffect(() => {
    const handleScrollAndSection = () => {
      const scrollY = window.scrollY;
      const scrolled = location !== '/' || scrollY > 40;
      setIsScrolled(scrolled);

      if (location === '/flights') {
        setActiveSection('Flights');
        return;
      }

      if (location === '/') {
        if (scrollY < 220) {
          setActiveSection('Home');
          return;
        }

        const sections = [
          { id: 'my-trips', label: 'Trips' },
          { id: 'partner-program', label: 'Partner Program' },
          { id: 'travel-hub', label: 'Travel Hub' },
          { id: 'why-zelevos', label: 'Why Zelevos' },
          { id: 'curated-packages', label: 'Packages' },
        ];

        for (const sec of sections) {
          const el = document.getElementById(sec.id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= 260 && rect.bottom >= 100) {
              setActiveSection(sec.label);
              return;
            }
          }
        }
      }
    };

    window.addEventListener('scroll', handleScrollAndSection, { passive: true });
    handleScrollAndSection();
    return () => window.removeEventListener('scroll', handleScrollAndSection);
  }, [location]);

  const navItems = [
    {
      label: 'Home',
      href: '/',
      active: activeSection === 'Home',
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        setActiveSection('Home');
        if (location !== '/') {
          setLocation('/');
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
    },
    {
      label: 'Packages',
      href: '/#curated-packages',
      active: activeSection === 'Packages',
      onClick: (e: React.MouseEvent) => {
        setActiveSection('Packages');
        if (location !== '/') {
          e.preventDefault();
          setLocation('/');
          setTimeout(() => document.querySelector('#curated-packages')?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else {
          document.querySelector('#curated-packages')?.scrollIntoView({ behavior: 'smooth' });
        }
      },
    },
    {
      label: 'Why Zelevos',
      href: '/#why-zelevos',
      active: activeSection === 'Why Zelevos',
      onClick: (e: React.MouseEvent) => {
        setActiveSection('Why Zelevos');
        if (location !== '/') {
          e.preventDefault();
          setLocation('/');
          setTimeout(() => document.querySelector('#why-zelevos')?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else {
          document.querySelector('#why-zelevos')?.scrollIntoView({ behavior: 'smooth' });
        }
      },
    },
    {
      label: 'Partner Program',
      href: '/#partner-program',
      active: activeSection === 'Partner Program',
      onClick: (e: React.MouseEvent) => {
        setActiveSection('Partner Program');
        if (location !== '/') {
          e.preventDefault();
          setLocation('/');
          setTimeout(() => document.querySelector('#partner-program')?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else {
          document.querySelector('#partner-program')?.scrollIntoView({ behavior: 'smooth' });
        }
      },
    },
    {
      label: 'Trips',
      href: '/#my-trips',
      active: activeSection === 'Trips',
      onClick: (e: React.MouseEvent) => {
        setActiveSection('Trips');
        if (location !== '/') {
          e.preventDefault();
          setLocation('/');
          setTimeout(() => document.querySelector('#my-trips')?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else {
          document.querySelector('#my-trips')?.scrollIntoView({ behavior: 'smooth' });
        }
      },
    },
    {
      label: 'Flights',
      href: '/flights',
      active: activeSection === 'Flights',
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        setActiveSection('Flights');
        if (location !== '/flights' || window.location.search) {
          window.history.pushState(null, '', '/flights');
          setLocation('/flights');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      },
    },
    {
      label: 'Build My Trip',
      href: '#build-my-trip',
      active: false,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        onOpenBuildMyTrip?.();
      },
    },
    {
      label: 'Support',
      href: '#support',
      active: false,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        onOpenSupport?.();
      },
    },
  ];

  return (
    <>
      <header className={`navbar ${isScrolled ? 'navbar--scrolled' : ''}`}>
      <div className="nav-inner">
        <Logo />
        <nav className="desktop-nav">
          {navItems.map(({ label, href, active, onClick }) => (
            <a
              className={active ? 'active' : ''}
              href={href}
              key={label}
              onClick={onClick}
            >
              {label}
            </a>
          ))}
          <button
            className={`more-link ${activeSection === 'Travel Hub' ? 'active' : ''}`}
            onClick={() => setMoreOpen(!moreOpen)}
          >
            More <ChevronDown size={14} />
          </button>
          <AnimatePresence>
            {moreOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="more-menu"
              >
                <a
                  href="/#travel-hub"
                  className={activeSection === 'Travel Hub' ? 'active' : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    setMoreOpen(false);
                    setActiveSection('Travel Hub');
                    if (location !== '/') {
                      setLocation('/');
                      setTimeout(() => {
                        document.querySelector('#travel-hub')?.scrollIntoView({ behavior: 'smooth' });
                      }, 120);
                    } else {
                      document.querySelector('#travel-hub')?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  Travel Hub
                </a>
                <a
                  href="/become-a-supplier"
                  style={{ color: '#4f46e5', fontWeight: 700 }}
                  onClick={(e) => {
                    e.preventDefault();
                    setMoreOpen(false);
                    setLocation('/become-a-supplier');
                  }}
                >
                  Become a Supplier
                </a>
                <a
                  href="/vendor-portal"
                  onClick={(e) => {
                    e.preventDefault();
                    setMoreOpen(false);
                    setLocation('/vendor-portal');
                  }}
                >
                  Vendor Portal
                </a>
                <a
                  href="/partner-portal"
                  onClick={(e) => {
                    e.preventDefault();
                    setMoreOpen(false);
                    setLocation('/partner-portal');
                  }}
                >
                  Partner Portal Login
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
        <div className="nav-actions">
          <button
            id="navbar-search-btn"
            className="search-button"
            aria-label="Search destinations and packages"
            title="Search destinations and packages (Ctrl+K)"
            onClick={() => setSearchModalOpen(true)}
          >
            <Search size={17} />
          </button>

          {!user ? (
            <>
              <Button
                variant="outline"
                className="login-button"
                onClick={() => onLogin('login')}
              >
                {authLoading ? 'Checking...' : 'Log in'}
              </Button>
              <Button
                className="started-button"
                onClick={() => onLogin('signup')}
              >
                <span>Get Started</span>
                <ArrowRight size={14} />
              </Button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Notification Bell Button */}
              <button
                id="navbar-notifications-btn"
                type="button"
                onClick={() => setNotifDrawerOpen(!notifDrawerOpen)}
                style={{
                  position: 'relative',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  border: isScrolled ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.25)',
                  background: isScrolled ? '#f8fafc' : 'rgba(255,255,255,0.18)',
                  color: isScrolled ? '#1e293b' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                aria-label="Notification center"
                title="Customer Notification Center"
              >
                <Bell size={18} />
                {unreadNotifCount > 0 && (
                  <span
                    id="navbar-notifications-badge"
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      background: '#ef4444',
                      color: '#ffffff',
                      borderRadius: '10px',
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '1px 5px',
                      lineHeight: '14px',
                      border: '2px solid #ffffff',
                      boxShadow: '0 2px 4px rgba(239,68,68,0.4)',
                    }}
                  >
                    {unreadNotifCount}
                  0</span>
                )}
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  id="user-profile-dropdown-btn"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="user-profile-button"
                >
                  <div className="user-avatar-badge">
                    {user.fullName ? user.fullName[0].toUpperCase() : user.email[0].toUpperCase()}
                  </div>
                  <span className="user-name-label">
                    {user.fullName ? user.fullName.split(' ')[0] : user.email.split('@')[0]}
                  </span>
                  <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.7)' }} />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="user-menu-dropdown"
                    >
                      <div className="user-menu-header">
                        <strong className="user-menu-title">
                          {user.fullName || 'Zelevos Traveller'}
                        </strong>
                        <span className="user-menu-subtitle">
                          {user.email}
                        </span>
                        <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>User ID:</span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7', background: '#f0f9ff', padding: '1px 6px', borderRadius: '4px', border: '1px solid #bae6fd' }}>
                            {user.customerId || 'ZLV-CUS-000001'}
                          </span>
                        </div>
                      </div>

                      <a
                        href="#my-trips"
                        onClick={() => setUserMenuOpen(false)}
                        className="user-menu-item"
                      >
                        <Luggage size={14} style={{ color: '#3b82f6' }} />
                        My Trips & Bookings
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout();
                        }}
                        className="user-menu-logout"
                      >
                        <X size={14} />
                        Log out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          <button
            className="mobile-menu"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="mobile-nav"
          >
            <div className="mobile-nav-links">
              {navItems.map(({ label, href, active, onClick }) => (
                <a
                  href={href}
                  onClick={(e) => {
                    onClick?.(e);
                    setMobileOpen(false);
                  }}
                  key={label}
                  className={`mobile-nav-link ${active ? 'active' : ''}`}
                >
                  <span>{label}</span>
                  <ChevronRight size={15} style={{ opacity: 0.4 }} />
                </a>
              ))}
              <a
                href="/#travel-hub"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileOpen(false);
                  setActiveSection('Travel Hub');
                  if (location !== '/') {
                    setLocation('/');
                    setTimeout(() => {
                      document.querySelector('#travel-hub')?.scrollIntoView({ behavior: 'smooth' });
                    }, 120);
                  } else {
                    document.querySelector('#travel-hub')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className={`mobile-nav-link ${activeSection === 'Travel Hub' ? 'active' : ''}`}
              >
                <span>Travel Hub</span>
                <ChevronRight size={15} style={{ opacity: 0.4 }} />
              </a>
              <a
                href="/become-a-supplier"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileOpen(false);
                  setLocation('/become-a-supplier');
                }}
                className="mobile-nav-link"
                style={{ color: '#4f46e5', fontWeight: 700 }}
              >
                <span>Become a Supplier</span>
                <ChevronRight size={15} style={{ opacity: 0.4 }} />
              </a>
              <a
                href="/vendor-portal"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileOpen(false);
                  setLocation('/vendor-portal');
                }}
                className="mobile-nav-link"
              >
                <span>Vendor Portal</span>
                <ChevronRight size={15} style={{ opacity: 0.4 }} />
              </a>
            </div>

            {user ? (
              <div className="mobile-user-section">
                <span className="mobile-user-tag">
                  Signed in as <strong>{user.fullName || user.email}</strong>
                </span>
                <a href="#my-trips" onClick={() => setMobileOpen(false)} className="mobile-nav-link">
                  <span>My Trips</span>
                  <Luggage size={14} style={{ color: '#3b82f6' }} />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onLogout();
                  }}
                  className="mobile-logout-btn"
                >
                  <X size={14} /> Log out
                </button>
              </div>
            ) : (
              <div className="mobile-auth-actions">
                <Button
                  variant="outline"
                  className="mobile-login-btn"
                  onClick={() => {
                    setMobileOpen(false);
                    onLogin('login');
                  }}
                >
                  Log in
                </Button>
                <Button
                  className="mobile-started-btn"
                  onClick={() => {
                    setMobileOpen(false);
                    onLogin('signup');
                  }}
                >
                  <span>Get Started</span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>

    {/* Customer Notification Center Drawer */}
    <AnimatePresence>
      {notifDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNotifDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(3px)',
              zIndex: 9998,
            }}
          />
          {/* Drawer */}
          <motion.aside
            id="customer-notifications-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              maxWidth: '440px',
              background: '#ffffff',
              boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.18)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bell size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Notifications</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    {unreadNotifCount > 0 ? `${unreadNotifCount} unread alert${unreadNotifCount > 1 ? 's' : ''}` : 'You are all caught up!'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {unreadNotifCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllNotificationsRead}
                    style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  id="close-notifications-btn"
                  onClick={() => setNotifDrawerOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                  aria-label="Close notifications"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '6px', overflowX: 'auto' }}>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'ANNOUNCEMENT', label: '📢 Announcements' },
                { id: 'OFFER', label: '🏷️ Offers' },
                { id: 'PAYMENT', label: '💳 Payments' },
                { id: 'BOOKING', label: '🧳 Bookings' },
                { id: 'SUPPORT', label: '💬 Support' },
                { id: 'IMPORTANT', label: '⚠️ Important' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setNotifCategoryFilter(cat.id)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    border: notifCategoryFilter === cat.id ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    background: notifCategoryFilter === cat.id ? '#eff6ff' : '#ffffff',
                    color: notifCategoryFilter === cat.id ? '#2563eb' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Notification List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(() => {
                const filtered = customerNotifs.filter((n) => {
                  if (notifCategoryFilter === 'ALL') return true;
                  return (n.category || 'ANNOUNCEMENT').toUpperCase() === notifCategoryFilter;
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f8fafc', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <Bell size={24} />
                      </div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#475569' }}>No notifications in this category</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Updates, trip alerts and special offers will appear here.</p>
                    </div>
                  );
                }

                return filtered.map((notif) => {
                  const isUnread = !!notif.unread;
                  const messageText = notif.message || notif.body || '';
                  const titleText = notif.title || notif.category || 'Notification';
                  return (
                    <div
                      key={notif.id}
                      id={`notification-card-${notif.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedNotifModal(notif);
                        if (isUnread) void handleMarkNotificationRead(notif.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedNotifModal(notif);
                          if (isUnread) void handleMarkNotificationRead(notif.id);
                        }
                      }}
                      style={{
                        borderRadius: '12px',
                        border: isUnread ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
                        background: isUnread ? '#f8faff' : '#ffffff',
                        boxShadow: isUnread ? '0 3px 12px rgba(59, 130, 246, 0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                        overflow: 'hidden',
                        transition: 'all 0.18s ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 6px 18px rgba(37, 99, 235, 0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isUnread ? '#93c5fd' : '#e2e8f0';
                        e.currentTarget.style.boxShadow = isUnread ? '0 3px 12px rgba(59, 130, 246, 0.08)' : '0 1px 3px rgba(0,0,0,0.03)';
                      }}
                    >
                      {notif.imageUrl && (
                        <div style={{ width: '100%', height: '140px', background: '#0f172a', overflow: 'hidden' }}>
                          <img
                            src={notif.imageUrl}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      )}
                      <div style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isUnread && (
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
                            )}
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                background: (notif.category || '').toUpperCase() === 'OFFER' ? '#fef3c7' : (notif.category || '').toUpperCase() === 'PAYMENT' ? '#dcfce7' : (notif.category || '').toUpperCase() === 'IMPORTANT' ? '#fee2e2' : '#f1f5f9',
                                color: (notif.category || '').toUpperCase() === 'OFFER' ? '#b45309' : (notif.category || '').toUpperCase() === 'PAYMENT' ? '#15803d' : (notif.category || '').toUpperCase() === 'IMPORTANT' ? '#b91c1c' : '#475569',
                              }}
                            >
                              {notif.category || 'Announcement'}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        <h4 style={{ margin: '0 0 5px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{titleText}</h4>
                        <p style={{
                          margin: 0,
                          fontSize: '13px',
                          color: '#475569',
                          lineHeight: 1.45,
                          whiteSpace: 'pre-line',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {messageText || 'Click to view full message.'}
                        </p>

                        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            View full message <ChevronRight size={13} />
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {notif.actionButton && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleNotificationCtaClick(notif);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '7px',
                                  background: '#2563eb',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <span>{notif.actionButton}</span>
                                <ArrowRight size={12} />
                              </button>
                            )}

                            {isUnread && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleMarkNotificationRead(notif.id);
                                }}
                                style={{
                                  fontSize: '11px',
                                  color: '#64748b',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                }}
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>

    {/* Full Notification Detail Modal */}
    <AnimatePresence>
      {selectedNotifModal && (
        <div
          id="notification-detail-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10002,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
          }}
          onClick={() => setSelectedNotifModal(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
              border: '1px solid #e2e8f0',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Banner Image */}
            {selectedNotifModal.imageUrl && (
              <div style={{ position: 'relative', width: '100%', height: '220px', background: '#0f172a', overflow: 'hidden' }}>
                <img
                  src={selectedNotifModal.imageUrl}
                  alt={selectedNotifModal.title || 'Notification Banner'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={() => setSelectedNotifModal(null)}
                  style={{
                    position: 'absolute',
                    top: '14px',
                    right: '14px',
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: 'rgba(0, 0, 0, 0.65)',
                    color: '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                    transition: 'all 0.15s ease',
                  }}
                  aria-label="Close message"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div style={{ padding: '24px' }}>
              {/* Header without image */}
              {!selectedNotifModal.imageUrl && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bell size={18} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Notification Details</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNotifModal(null)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    aria-label="Close message"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              {/* Category & Timestamp */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    background: (selectedNotifModal.category || '').toUpperCase() === 'OFFER' ? '#fef3c7' : (selectedNotifModal.category || '').toUpperCase() === 'PAYMENT' ? '#dcfce7' : (selectedNotifModal.category || '').toUpperCase() === 'IMPORTANT' ? '#fee2e2' : '#eff6ff',
                    color: (selectedNotifModal.category || '').toUpperCase() === 'OFFER' ? '#b45309' : (selectedNotifModal.category || '').toUpperCase() === 'PAYMENT' ? '#15803d' : (selectedNotifModal.category || '').toUpperCase() === 'IMPORTANT' ? '#b91c1c' : '#1d4ed8',
                  }}
                >
                  {selectedNotifModal.category || 'Announcement'}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                  {selectedNotifModal.createdAt ? new Date(selectedNotifModal.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>

              {/* Title */}
              <h3 style={{ margin: '0 0 12px', fontSize: '19px', fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>
                {selectedNotifModal.title || selectedNotifModal.category || 'Notification'}
              </h3>

              {/* Full Message Body */}
              <div style={{
                fontSize: '14px',
                color: '#334155',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                background: '#f8fafc',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #f1f5f9',
                marginBottom: '20px',
                maxHeight: '280px',
                overflowY: 'auto',
              }}>
                {selectedNotifModal.message || selectedNotifModal.body || 'No message content available.'}
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedNotifModal(null)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                {selectedNotifModal.actionButton && (
                  <button
                    type="button"
                    onClick={() => {
                      const notif = selectedNotifModal;
                      setSelectedNotifModal(null);
                      void handleNotificationCtaClick(notif);
                    }}
                    style={{
                      padding: '9px 20px',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#2563eb',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                    }}
                  >
                    <span>{selectedNotifModal.actionButton}</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    <GlobalSearchModal
      isOpen={searchModalOpen}
      onClose={() => setSearchModalOpen(false)}
      onSelectPackage={onSelectPackage}
      onSearchDestination={onSearchDestination}
      onOpenBuildMyTrip={onOpenBuildMyTrip}
    />
  </>
  );
}

function Hero({ onSearch }: { onSearch: (destination: string) => void }) {
  const [destination, setDestination] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (destination.trim()) {
      onSearch(destination.trim());
      document.querySelector('#curated-packages')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const popular = ['Kashmir', 'Ladakh', 'Kerala', 'Rajasthan', 'Goa', 'Himachal'];

  return (
    <section id="top" className="hero">
      <div className="hero-photo" />
      <div className="hero-scrim" />
      <div className="hero-content page-shell">
        <div className="hero-copy">
          <div className="hero-eyebrow">CURATED TRAVEL MARKETPLACE · INDIA</div>
          <h1>Discover Handcrafted<br />Travel Packages.<br /><span>Fulfilled by Verified Local Suppliers.</span></h1>
          <p>Multi-day holiday packages with transparent pricing, guaranteed fulfillment, and dedicated operations support.</p>

          <form className="hero-search-bar" onSubmit={handleSearch}>
            <div className="hero-search-field">
              <MapPin size={18} className="hero-search-icon" />
              <input
                id="hero-destination-input"
                name="hero-destination-input"
                data-alias-id="hero-input"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Where do you want to go? (e.g. Kashmir, Ladakh, Kerala)"
                aria-label="Where do you want to go?"
              />
              <span id="hero-input" style={{ display: 'none' }} />
            </div>
            <button id="hero-search-btn" type="submit" className="hero-search-submit">
              <Search size={16} />
              <span>Search Packages</span>
            </button>
          </form>

          <div className="popular-searches">
            <span>Popular destinations:</span>
            {popular.map((item) => (
              <button
                key={item}
                type="button"
                className="popular-pill"
                onClick={() => {
                  setDestination(item);
                  onSearch(item);
                  document.querySelector('#curated-packages')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="hero-stats">
          <div><ShieldCheck size={18} /><div><strong>Verified Suppliers</strong><span>100% manually vetted</span></div></div>
          <div><Award size={18} /><div><strong>Confidence Score</strong><span>Dynamic vendor tracking</span></div></div>
          <div><Compass size={18} /><div><strong>Dedicated Ops</strong><span>24/7 ground assistance</span></div></div>
        </div>
      </div>
    </section>
  );
}

function WhyZelevosSection() {
  const pillars = [
    {
      icon: Ticket,
      title: "One Centralized Booking",
      desc: "Hotels, transfers, activities, and sightseeing unified under a single Zelevos Booking ID (ZL...) with one transparent digital itinerary.",
    },
    {
      icon: Compass,
      title: "Curated Experiences",
      desc: "Handcrafted multi-day itineraries designed and vetted by destination specialists, not generic unverified listings.",
    },
    {
      icon: Users,
      title: "Dedicated Local Support",
      desc: "Our real-time operations desk coordinates with local suppliers on the ground 24/7 to guarantee smooth travel fulfillment.",
    },
    {
      icon: ShieldCheck,
      title: "Transparent Inclusions",
      desc: "Clear day-wise inclusions and exclusions with real-time Trip Confidence Scores based on verified supplier metrics.",
    },
  ];

  return (
    <section className="why-zelevos-section page-shell" id="why-zelevos" style={{ padding: '64px 0' }}>
      <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 40px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--blue)', textTransform: 'uppercase', marginBottom: '8px' }}>
          The Zelevos Standard
        </div>
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>
          Why Zelevos?
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.6 }}>
          An API-free curated marketplace designed for reliability, verified supplier accountability, and complete peace of mind.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        {pillars.map((p) => (
          <div key={p.title} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#eff6ff', color: 'var(--blue)', display: 'grid', placeItems: 'center', marginBottom: '16px' }}>
              <p.icon size={22} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>{p.title}</h3>
            <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PartnerCTASection({ onOpenPartner }: { onOpenPartner: () => void }) {
  return (
    <section className="partner-cta-section page-shell" id="partner-program" style={{ padding: '32px 0 64px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        color: 'white',
        borderRadius: '24px',
        padding: '40px',
        border: '1px solid #1e293b',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
      }}>
        <div style={{ maxWidth: '560px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.15em', color: '#818cf8', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Zelevos Partner Network
          </span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'white', lineHeight: 1.3 }}>
            Partner With Zelevos
          </h2>
          <p style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '10px', lineHeight: 1.6 }}>
            Earn commissions as a Travel Agent or onboard directly as a verified local Supplier (Hotels, Cabs, Activities, Guides) with guaranteed direct bookings and automated fulfillment.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a
            href="/become-a-supplier"
            style={{
              padding: '14px 24px',
              background: '#4f46e5',
              color: 'white',
              fontWeight: 700,
              fontSize: '13px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)',
              textDecoration: 'none',
            }}
          >
            Become a Supplier <ArrowRight size={16} />
          </a>
          <button
            type="button"
            id="partner-cta-btn"
            onClick={onOpenPartner}
            style={{
              padding: '14px 24px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              fontWeight: 700,
              fontSize: '13px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'transform 0.15s ease',
            }}
          >
            Travel Agent Partner <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function ServiceStrip({ onSelectService }: { onSelectService?: (service: string) => void }) {
  const handleClick = (event: React.MouseEvent, label: string) => {
    if (label === 'Flights' || label === 'Hotels' || label === 'Transport' || label === 'Experiences') {
      event.preventDefault();
      onSelectService?.(label);
    }
  };

  return (
    <section className="services-strip page-shell" aria-label="Zelevos services">
      {services.map(({ icon: Icon, label, copy }) => {
        const href = label === 'AI Trip Planner'
          ? '#planner'
          : label === 'Zelevos Wallet'
          ? '#wallet'
          : '#travel-hub';

        return (
          <a
            href={href}
            onClick={(e) => handleClick(e, label)}
            className="service-item"
            key={label}
          >
            <span className="service-icon"><Icon size={20} /></span>
            <span><strong>{label}</strong><small>{copy}</small></span>
          </a>
        );
      })}
    </section>
  );
}

function DestinationCard({ destination, onSave }: { destination: typeof destinations[number]; onSave: (name: string) => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <article className="destination-card">
      <img src={destination.image} alt={`${destination.name} destination`} />
      <div className="destination-gradient" />
      <span className="destination-badge">{destination.category}</span>
      <button className={`save-destination ${saved ? 'saved' : ''}`} aria-label={`Save ${destination.name}`} onClick={() => { setSaved(!saved); onSave(saved ? `${destination.name} removed from saved trips` : `${destination.name} saved to your trips`); }}>{saved ? <Check size={15} /> : <Heart size={15} />}</button>
      <div className="destination-meta"><div><h3>{destination.name}</h3><span>From {destination.price}</span></div><span className="circle-arrow"><ArrowRight size={17} /></span></div>
    </article>
  );
}

function AITravelOS({ onStart }: { onStart: () => void }) {
  const features = [
    ['Personalized recommendations', 'Based on your preferences & past trips', Compass],
    ['Real-time trip management', 'Alerts, changes & 24/7 support', Bell],
    ['Smart budget planner', 'Get the best value, always', BarChart3],
    ['Exclusive deals', 'Only on Zelevos', Star],
  ] as const;
  return (
    <aside className="ai-os-panel">
      <div className="ai-panel-label"><Sparkles size={15} /> YOUR AI TRAVEL OS</div>
      <h3>More than a booking platform.<br /><span>Your complete travel companion.</span></h3>
      <div className="ai-features">
        {features.map(([title, copy, Icon]) => <div className="ai-feature" key={title}><span className="feature-icon"><Icon size={17} /></span><span><strong>{title}</strong><small>{copy}</small></span></div>)}
      </div>
      <div className="ai-bot-visual"><div className="bot-orbit orbit-one" /><div className="bot-orbit orbit-two" /><div className="bot-face"><Bot size={36} /></div><span className="bot-dot dot-one" /><span className="bot-dot dot-two" /></div>
      <Button onClick={onStart} className="full-button">Start Planning with AI <ArrowRight size={15} /></Button>
    </aside>
  );
}

function Discover({ onSave, onStart }: { onSave: (message: string) => void; onStart: () => void }) {
  const [category, setCategory] = useState('Stays');
  const categories = [
    ['Stays', Hotel], ['Flights', Plane], ['Trains', TrainFront], ['Buses', Building2], ['Cabs', Fuel],
    ['Experiences', Compass], ['Attractions', Star], ['Restaurants', MoreHorizontal], ['Wellness', Heart], ['Adventure', Route], ['More', Plus],
  ] as const;
  return (
    <>
      <section className="discover page-shell">
        <div className="discover-header"><SectionHeading eyebrow="DISCOVER YOUR NEXT" title={<>Popular <span>destinations</span></>} copy="Handpicked destinations for your next adventure" /><a href="#marketplace">View all destinations <ArrowRight size={14} /></a></div>
        <div className="discover-grid"><div className="destination-grid">{destinations.map((destination) => <DestinationCard key={destination.name} destination={destination} onSave={onSave} />)}</div><AITravelOS onStart={onStart} /></div>
      </section>
      <section className="category-strip">
        <div className="page-shell"><div className="category-title"><strong>Explore by category</strong><span>Everything you need for the perfect trip</span></div><div className="category-scroll">{categories.map(([label, Icon]) => <button className={category === label ? 'selected' : ''} onClick={() => { setCategory(label); onSave(`${label} selected`); }} key={label}><span><Icon size={18} /></span>{label}</button>)}</div></div>
      </section>
    </>
  );
}

function Planner({ onToast, onSaved, user, onLogin }: { onToast: (message: string) => void; onSaved: () => void; user: AuthUser | null; onLogin: () => void }) {
  const [destination, setDestination] = useState('Kashmir');
  const [dates, setDates] = useState('October 2026');
  const [durationDays, setDurationDays] = useState(5);
  const [travellers, setTravellers] = useState(2);
  const [budget, setBudget] = useState('₹70,000');
  const [preferences, setPreferences] = useState(['Nature']);
  const [tripPlan, setTripPlan] = useState<PlannerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const generateTrip = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const response = await planTrip({ destination, dates, durationDays, travellers, budget, preferences });
      setTripPlan(response);
      onToast('Your itinerary is ready to review.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Zelevos AI is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };
  const saveTrip = async () => {
    if (!tripPlan || saving) return;
    if (!user) {
      onLogin();
      onToast('Please log in to save your trip.');
      return;
    }
    setSaving(true);
    try {
      await createTrip({
        destination,
        dates,
        durationDays,
        travellers,
        budget,
        preferences,
         itinerary: tripPlan.itinerary,
         estimatedCosts: tripPlan.estimatedCosts,
         transportInfo: tripPlan.transportInfo,
         hotelInfo: tripPlan.hotelInfo,
         reasoning: tripPlan.reasoning,
      });
      setSaved(true);
      onSaved();
      onToast('Trip saved to My Trips.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Trip could not be saved.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <section id="planner" className="planner-section">
      <div className="page-shell planner-layout">
        <div className="planner-intro"><SectionHeading eyebrow="ZELEVOS AI PLANNER" title={<>From a thought<br />to a <span>trip.</span></>} copy="Tell Zelevos what you want. The planner asks the right questions, explains its recommendations, and keeps every decision editable." /><div className="planner-proof"><div className="proof-avatars"><span>MS</span><span>AK</span><span>JL</span></div><span>Built with 14,230 curious travellers</span></div></div>
        <div className="planner-card">
          <div className="planner-card-top"><div><span className="mini-label">YOUR TRIP BRIEF</span><h3>Let’s make this yours.</h3></div><span className="planner-status"><span /> AI ready</span></div>
          <div className="planner-fields">
             <label><span>Where do you want to go?</span><div className="field-input"><LocationAutocomplete id="planner-destination-input" value={destination} onChange={setDestination} placeholder="Search a city, hotel or landmark..." /></div></label>
             <label><span>When are you going?</span><div className="field-input"><CalendarDays size={17} /><input value={dates} onChange={(event) => setDates(event.target.value)} /></div></label>
             <div className="planner-inline-fields"><label><span>Days</span><div className="field-input"><Clock3 size={17} /><input type="number" min="1" max="365" value={durationDays} onChange={(event) => setDurationDays(Math.max(1, Number(event.target.value) || 1))} /></div></label><label><span>Travellers</span><div className="field-input"><Users size={17} /><input type="number" min="1" max="100" value={travellers} onChange={(event) => setTravellers(Math.max(1, Number(event.target.value) || 1))} /></div></label></div>
             <label><span>What matters most?</span><div className="choice-row">{['Nature', 'Food', 'Slow travel', 'Adventure', 'Culture', 'Wellness', 'Beaches', 'Mountains'].map((item) => <button key={item} className={preferences.includes(item) ? 'chosen' : ''} onClick={() => setPreferences((items) => items.includes(item) ? items.filter((value) => value !== item) : [...items, item])}>{item}</button>)}</div></label>
            <label><span>Your budget</span><div className="field-input"><Wallet size={17} /><input value={budget} onChange={(event) => setBudget(event.target.value)} /></div></label>
          </div>
          <div className="planner-bottom"><span><ShieldCheck size={15} /> Every recommendation has a reason</span><Button onClick={generateTrip}>{loading ? 'Thinking...' : 'Generate my trip'} {!loading && <ArrowRight size={15} />}</Button></div>
           <AnimatePresence>{tripPlan && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="planner-result"><div className="result-check"><Check size={17} /></div><div><strong>{tripPlan.summary}</strong><span>{tripPlan.reasoning}</span><small>{tripPlan.itinerary.length} days planned · {Object.keys(tripPlan.estimatedCosts).length} cost estimates</small><div className="planner-result-actions"><Button variant="outline" onClick={saveTrip}>{saving ? 'Saving...' : saved ? 'Saved to My Trips' : 'Save Trip'} {!saving && !saved && <ArrowRight size={15} />}</Button></div></div><ChevronRight size={18} /></motion.div>}</AnimatePresence>
        </div>
      </div>
      <div className="page-shell suggestion-row">{plannerSuggestions.map((suggestion) => <button key={suggestion} onClick={() => onToast(`Zelevos is exploring: ${suggestion}`)}><Sparkles size={14} />{suggestion}<ArrowRight size={14} /></button>)}</div>
    </section>
  );
}

function MyTrips({
  refreshKey,
  user,
  onLogin,
  onToast,
  onOpenSupport,
}: {
  refreshKey: number;
  user: AuthUser | null;
  onLogin: () => void;
  onToast: (message: string) => void;
  onOpenSupport?: (bookingId?: string) => void;
}) {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [packageTrips, setPackageTrips] = useState<any[]>([]);
  const [customRequests, setCustomRequests] = useState<any[]>([]);
  const [selected, setSelected] = useState<TripRecord | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [selectedPackageTrip, setSelectedPackageTrip] = useState<any | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PACKAGES' | 'FLIGHTS' | 'ITINERARIES'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedTrips, bookingsRes, pkgTripsRes, customRequestsRes] = await Promise.all([
        listTrips().catch(() => []),
        fetch('/api/bookings', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { results: [] })).catch(() => ({ results: [] })),
        fetch('/api/bookings/my-trips', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { trips: [] })).catch(() => ({ trips: [] })),
        fetch('/api/custom-trips/my-requests', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { requests: [] })).catch(() => ({ requests: [] })),
      ]);
      setTrips(loadedTrips);
      const bList = Array.isArray(bookingsRes.results) ? bookingsRes.results : [];
      setBookings(bList);
      const pList = Array.isArray(pkgTripsRes.trips) ? pkgTripsRes.trips : [];
      setPackageTrips(pList);
      setCustomRequests(Array.isArray(customRequestsRes.requests) ? customRequestsRes.requests : []);

      setSelected((current) => (current ? loadedTrips.find((trip: TripRecord) => trip.id === current.id) || null : null));
      setSelectedBooking((current: any) => (current ? bList.find((b: any) => b.id === current.id) || null : null));
      setSelectedPackageTrip((current: any) => (current ? pList.find((p: any) => p.bookingId === current.bookingId || p.id === current.id) || null : null));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Saved trips could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void loadData();
    else {
      setTrips([]);
      setBookings([]);
      setPackageTrips([]);
      setCustomRequests([]);
      setSelected(null);
      setSelectedBooking(null);
      setSelectedPackageTrip(null);
      setLoading(false);
      setError('');
    }
  }, [refreshKey, user]);

  const saveChanges = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const updated = await updateTrip(selected.id, {
        destination: selected.destination,
        dates: selected.dates,
        durationDays: selected.durationDays,
        travellers: selected.travellers,
        budget: selected.budget,
        preferences: selected.preferences,
      });
      setTrips((items) => items.map((trip) => (trip.id === updated.id ? updated : trip)));
      setSelected(updated);
      setEditing(false);
      onToast('Trip changes saved.');
    } catch (saveError) {
      onToast(saveError instanceof Error ? saveError.message : 'Trip could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  const removeTrip = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await deleteTrip(selected.id);
      setTrips((items) => items.filter((trip) => trip.id !== selected.id));
      setSelected(null);
      onToast('Trip deleted.');
    } catch (deleteError) {
      onToast(deleteError instanceof Error ? deleteError.message : 'Trip could not be deleted.');
    } finally {
      setSaving(false);
    }
  };

  const cancelFlightBooking = async (booking: any) => {
    if (!confirm(`Cancel flight booking ${booking.pnr || booking.bookingReference}?`)) return;
    setCancellingId(booking.id);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: 'User requested cancellation from My Trips' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Could not cancel booking.');
      }
      onToast(data.message);
      void loadData();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Cancellation failed.');
    } finally {
      setCancellingId(null);
    }
  };

  const cancelPackageTrip = async (p: any) => {
    const targetId = p.bookingId || p.id;
    setCancellingId(targetId);
    try {
      const res = await fetch(`/api/bookings/${targetId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: 'Customer requested cancellation from My Trips' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Could not cancel booking.');
      }
      onToast('Cancellation request submitted to finance.');
      void loadData();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Cancellation request failed.');
    } finally {
      setCancellingId(null);
    }
  };

  const acceptCustomProposal = async (request: any) => {
    try {
      const response = await fetch(`/api/custom-trips/${request.id}/accept`, { method: 'POST', credentials: 'include' });
      const payload = await response.json();
      if (!response.ok || !payload.booking) throw new Error(payload.message || 'Proposal could not be accepted.');
      onToast(`Proposal accepted. Booking ${payload.booking.bookingId} is ready for secure payment.`);
      await loadData();
    } catch (acceptError) {
      onToast(acceptError instanceof Error ? acceptError.message : 'Proposal could not be accepted.');
    }
  };

  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);

  const resendBookingEmail = async (booking: any) => {
    setResendingEmailId(booking.id);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Could not resend email.');
      }
      onToast(data.message || 'Email sent successfully.');
      void loadData();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to send email.');
    } finally {
      setResendingEmailId(null);
    }
  };

  const flightBookings = bookings.filter((b) => b.kind === 'FLIGHT');
  const visibleItems = [
    ...(filter === 'ALL' || filter === 'PACKAGES' ? packageTrips.map((p) => ({ type: 'PACKAGE' as const, data: p, id: p.id || p.bookingId })) : []),
    ...(filter === 'ALL' || filter === 'FLIGHTS' ? flightBookings.map((b) => ({ type: 'FLIGHT' as const, data: b, id: b.id })) : []),
    ...(filter === 'ALL' || filter === 'ITINERARIES' ? trips.map((t) => ({ type: 'TRIP' as const, data: t, id: t.id })) : []),
  ];

  return (
    <section id="my-trips" className="my-trips-section">
      <div className="page-shell">
        <div className="my-trips-heading">
          <SectionHeading eyebrow="MY TRIPS & BOOKINGS" title={<>Keep every <span>confirmed piece.</span></>} copy="Your booked holidays, flights with live PNRs, and saved AI plans stay manageable here in one place." />
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* <Button variant="outline" onClick={() => (document.getElementById('curated-packages') || document.querySelector('#curated-packages'))?.scrollIntoView({ behavior: 'smooth' })}>Browse Packages <Luggage size={15} /></Button> */}
            <Button variant="outline" onClick={() => document.querySelector('#travel-hub')?.scrollIntoView({ behavior: 'smooth' })}>Book Flights <Plane size={15} /></Button>
            {/* <Button variant="outline" onClick={() => document.querySelector('#planner')?.scrollIntoView({ behavior: 'smooth' })}>Plan AI Itinerary <Plus size={15} /></Button> */}
          </div>
        </div>

        {/* Filter Bar */}
        {user && (packageTrips.length > 0 || flightBookings.length > 0 || trips.length > 0) && (
          <div style={{ display: 'flex', gap: '8px', margin: '20px 0 10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilter('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: filter === 'ALL' ? '1px solid var(--blue)' : '1px solid var(--border)',
                background: filter === 'ALL' ? 'var(--blue)' : 'white',
                color: filter === 'ALL' ? 'white' : 'var(--muted)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              All Items ({packageTrips.length + flightBookings.length + trips.length})
            </button>
            <button
              onClick={() => setFilter('PACKAGES')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: filter === 'PACKAGES' ? '1px solid var(--blue)' : '1px solid var(--border)',
                background: filter === 'PACKAGES' ? 'var(--blue)' : 'white',
                color: filter === 'PACKAGES' ? 'white' : 'var(--muted)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Holidays ({packageTrips.length})
            </button>
            <button
              onClick={() => setFilter('FLIGHTS')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: filter === 'FLIGHTS' ? '1px solid var(--blue)' : '1px solid var(--border)',
                background: filter === 'FLIGHTS' ? 'var(--blue)' : 'white',
                color: filter === 'FLIGHTS' ? 'white' : 'var(--muted)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Booked Flights ({flightBookings.length})
            </button>
            <button
              onClick={() => setFilter('ITINERARIES')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: filter === 'ITINERARIES' ? '1px solid var(--blue)' : '1px solid var(--border)',
                background: filter === 'ITINERARIES' ? 'var(--blue)' : 'white',
                color: filter === 'ITINERARIES' ? 'white' : 'var(--muted)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              AI Itineraries ({trips.length})
            </button>
          </div>
        )}

        {loading && <div className="trip-library-state"><span className="typing"><i /><i /><i /></span> Loading your saved trips and tickets...</div>}
        {!loading && !user && <div className="trip-library-state"><ShieldCheck size={22} /><strong>Log in to see My Trips.</strong><span>Your holiday bookings, flight tickets, and saved plans are private to your account.</span><Button onClick={onLogin}>Log in <ArrowRight size={15} /></Button></div>}
        {!loading && error && <div className="trip-library-state trip-library-error"><strong>We couldn't load My Trips.</strong><span>{error}</span><Button variant="outline" onClick={() => void loadData()}>Try again</Button></div>}
        {!loading && !error && visibleItems.length === 0 && (
          <div className="trip-library-state">
            <Compass size={22} />
            <strong>No trips or bookings yet.</strong>
            <span>Explore our curated packages, search flights, or generate an AI itinerary above.</span>
            <Button
              id="explore-packages-empty-btn"
              onClick={() => {
                const target = document.getElementById('curated-packages') || document.querySelector('#curated-packages');
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                  window.location.hash = '#curated-packages';
                }
              }}
            >
              Explore Packages <ArrowRight size={15} />
            </Button>
          </div>
        )}

        {!loading && !error && customRequests.length > 0 && (
          <section style={{ marginTop: '18px', display: 'grid', gap: '10px' }}>
            <span className="mini-label">CUSTOM TRIP PROPOSALS</span>
            {customRequests.map((request: any) => (
              <article key={request.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'start' }}>
                  <div><strong>{request.proposalTitle || 'Custom trip request'}</strong><span style={{ display: 'block', color: 'var(--muted)', fontSize: '11px', marginTop: '4px' }}>{request.leadNumber} · {request.status}</span></div>
                  {request.proposalAmount && <strong>₹{Number(request.proposalAmount).toLocaleString('en-IN')}</strong>}
                </div>
                {request.proposalItinerary?.length > 0 && <div style={{ display: 'grid', gap: '6px', marginTop: '12px' }}>{request.proposalItinerary.map((day: any) => <div key={`${request.id}-${day.day}`} style={{ padding: '8px', background: 'var(--soft)', borderRadius: '7px', fontSize: '11px' }}><strong>Day {day.day}: {day.location}</strong><span style={{ display: 'block' }}>{day.activity} · {day.meal || 'Meal details pending'}</span><small style={{ display: 'block', color: 'var(--muted)', marginTop: '3px' }}>{day.description}</small></div>)}</div>}
                {request.status === 'PROPOSAL_SENT' && <Button onClick={() => void acceptCustomProposal(request)}>Accept proposal <ArrowRight size={14} /></Button>}
                {request.status === 'ACCEPTED' && <span style={{ display: 'block', marginTop: '10px', color: 'var(--success)', fontSize: '11px', fontWeight: 700 }}>Accepted. Complete secure payment from the linked pending booking.</span>}
              </article>
            ))}
          </section>
        )}

        {!loading && !error && visibleItems.length > 0 && (
          <div className="trip-library">
            <div className="saved-trip-list">
              {visibleItems.map((item) => {
                if (item.type === 'PACKAGE') {
                  const p = item.data;
                  const isSelected = selectedPackageTrip?.bookingId === p.bookingId || selectedPackageTrip?.id === p.id;
                  const isConfirmed = p.status === 'CONFIRMED';
                  return (
                    <button
                      className={`saved-trip-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => { setSelectedPackageTrip(p); setSelectedBooking(null); setSelected(null); }}
                      key={p.bookingId || p.id}
                      style={{ textAlign: 'left' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="mini-label" style={{ color: isConfirmed ? 'var(--success)' : p.status === 'CANCEL_REQUESTED' ? '#d97706' : 'var(--blue)' }}>
                          {isConfirmed ? '✓ CONFIRMED HOLIDAY' : p.status === 'CANCEL_REQUESTED' ? 'CANCEL PENDING' : `HOLIDAY · ${p.status}`}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--blue)' }}>
                          {p.bookingId}
                        </span>
                      </div>
                      <strong>{p.packageTitle || 'Curated Holiday'}</strong>
                      <span>Date: {p.travelDate || 'Flexible'} · {p.adultsCount || 1} Adult(s)</span>
                      <small>₹{(p.totalPrice || 0).toLocaleString('en-IN')} · Score: {p.tripConfidenceScore || 94}%</small>
                      <ChevronRight size={16} />
                    </button>
                  );
                }

                if (item.type === 'FLIGHT') {
                  const b = item.data;
                  const isSelected = selectedBooking?.id === b.id;
                  const isConfirmed = b.status === 'CONFIRMED';
                  const seg = b.segments && b.segments[0];

                  return (
                    <button
                      className={`saved-trip-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => { setSelectedBooking(b); setSelectedPackageTrip(null); setSelected(null); }}
                      key={b.id}
                      style={{ textAlign: 'left' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="mini-label" style={{ color: isConfirmed ? 'var(--success)' : 'var(--blue)' }}>
                          {isConfirmed ? '✓ CONFIRMED FLIGHT' : `FLIGHT · ${b.status}`}
                        </span>
                        {b.pnr && (
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--blue)' }}>
                            PNR: {b.pnr}
                          </span>
                        )}
                      </div>
                      <strong>{seg ? `${seg.origin} → ${seg.destination}` : b.bookingReference}</strong>
                      <span>{seg ? `${seg.carrier} ${seg.flightNumber} · ${seg.departureTime}` : 'Airline flight'}</span>
                      <small>₹{b.amount.toLocaleString('en-IN')} · Ticket: {b.ticketNumber || 'Pending'}</small>
                      <ChevronRight size={16} />
                    </button>
                  );
                }

                const trip = item.data;
                return (
                  <button
                    className={`saved-trip-card ${selected?.id === trip.id ? 'selected' : ''}`}
                    onClick={() => { setSelected(trip); setSelectedBooking(null); setSelectedPackageTrip(null); setEditing(false); }}
                    key={trip.id}
                  >
                    <span className="mini-label">AI ITINERARY</span>
                    <strong>{trip.destination}</strong>
                    <span>{trip.dates} · {trip.durationDays} days</span>
                    <small>{trip.travellers} travellers · {trip.budget}</small>
                    <ChevronRight size={16} />
                  </button>
                );
              })}
            </div>

            {/* Right-hand Detail Panel for Package Trips */}
            {selectedPackageTrip && (
              <article className="saved-trip-detail">
                <div className="saved-trip-detail-top">
                  <div>
                    <span className="mini-label" style={{ color: selectedPackageTrip.status === 'CONFIRMED' ? 'var(--success)' : selectedPackageTrip.status === 'CANCEL_REQUESTED' ? '#d97706' : 'var(--blue)' }}>
                      HOLIDAY RESERVATION ({selectedPackageTrip.status})
                    </span>
                    <h3>{selectedPackageTrip.packageTitle || 'Curated Holiday Experience'}</h3>
                    <p>Booking ID: <strong style={{ color: 'var(--blue)' }}>{selectedPackageTrip.bookingId}</strong></p>
                  </div>
                  <button aria-label="Close booking preview" onClick={() => setSelectedPackageTrip(null)}><X size={17} /></button>
                </div>

                <div style={{ background: 'var(--soft)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)', display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border)', paddingBottom: '10px' }}>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--muted)' }}>TRAVEL DATE</span>
                      <div style={{ fontSize: '15px', fontWeight: 700 }}>{selectedPackageTrip.travelDate || 'Flexible'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--muted)' }}>TRIP CONFIDENCE</span>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#047857', background: '#ecfdf5', padding: '3px 8px', borderRadius: '12px', border: '1px solid #a7f3d0', display: 'inline-block' }}>
                        {selectedPackageTrip.tripConfidenceScore || 94}% High Confidence
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
                    <div><strong>Guests:</strong> {selectedPackageTrip.adultsCount || 1} Adult(s), {selectedPackageTrip.childrenCount || 0} Child(ren)</div>
                    <div><strong>Rooms:</strong> {selectedPackageTrip.roomsCount || 1} Room(s)</div>
                    {selectedPackageTrip.flightRequired && (
                      <div style={{ color: 'var(--blue)', fontWeight: 600 }}>✈ Flights requested — assigned to operations desk</div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>Total Paid</span>
                    <strong style={{ fontSize: '16px', color: 'var(--blue)' }}>₹{(selectedPackageTrip.totalPrice || 0).toLocaleString('en-IN')}</strong>
                  </div>

                  {/* Timeline */}
                  {selectedPackageTrip.timeline && Array.isArray(selectedPackageTrip.timeline) && selectedPackageTrip.timeline.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                        BOOKING TIMELINE & AUDIT LOG
                      </span>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {selectedPackageTrip.timeline.map((evt: any, idx: number) => (
                          <div key={idx} style={{ fontSize: '11px', background: 'white', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                              <span style={{ color: 'var(--blue)' }}>{evt.event}</span>
                              <span style={{ color: 'var(--muted)', fontSize: '10px' }}>{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            {evt.notes && <div style={{ color: 'var(--text)', marginTop: '2px' }}>{evt.notes}</div>}
                            <div style={{ color: 'var(--muted)', fontSize: '10px', marginTop: '2px' }}>By: {evt.actor || 'System'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPackageTrip.status === 'CANCEL_REQUESTED' && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '10px', borderRadius: '8px', color: '#b45309', fontSize: '12px' }}>
                      <strong>Cancellation Pending:</strong> Your refund request has been submitted to finance. Status: {selectedPackageTrip.status}.
                    </div>
                  )}

                  {selectedPackageTrip.status === 'REFUNDED' && (
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '10px', borderRadius: '8px', color: '#047857', fontSize: '12px' }}>
                      ✓ <strong>Refund Approved:</strong> ₹{(selectedPackageTrip.refundAmount || selectedPackageTrip.totalPrice || 0).toLocaleString('en-IN')} has been refunded.
                    </div>
                  )}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: '8px', fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                    <strong>Cancellation & Refund Policy:</strong> Free cancellation within 24 hours of booking, or up to 7 days before departure. Refund requests processed within 48 hours.
                  </div>
                </div>

                <div className="saved-trip-actions" style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <a
                    id="my-trips-download-itinerary-btn"
                    href={`/api/bookings/${selectedPackageTrip.bookingId || selectedPackageTrip.id}/itinerary`}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-outline"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', fontWeight: 600 }}
                  >
                    Download Digital Itinerary
                  </a>
                  <button
                    type="button"
                    id="my-trips-contact-support-btn"
                    className="button button-outline"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', fontWeight: 600 }}
                    onClick={() => onOpenSupport?.(selectedPackageTrip.bookingId || selectedPackageTrip.id)}
                  >
                    <MessageCircle size={14} /> Contact Concierge / Support
                  </button>
                  {selectedPackageTrip.status !== 'CANCELLED' && selectedPackageTrip.status !== 'CANCEL_REQUESTED' && selectedPackageTrip.status !== 'REFUNDED' && (
                    <button
                      type="button"
                      id="my-trips-cancel-booking-btn"
                      className="button button-ghost"
                      style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 600 }}
                      disabled={cancellingId === (selectedPackageTrip.bookingId || selectedPackageTrip.id)}
                      onClick={() => void cancelPackageTrip(selectedPackageTrip)}
                    >
                      {cancellingId === (selectedPackageTrip.bookingId || selectedPackageTrip.id) ? 'Submitting Cancel Request...' : 'Cancel Holiday Booking'}
                    </button>
                  )}
                </div>
              </article>
            )}

            {/* Right-hand Detail Panel for Flight Reservations */}
            {selectedBooking && (
              <article className="saved-trip-detail">
                <div className="saved-trip-detail-top">
                  <div>
                    <span className="mini-label" style={{ color: selectedBooking.status === 'CONFIRMED' ? 'var(--success)' : 'var(--blue)' }}>
                      FLIGHT RESERVATION ({selectedBooking.status})
                    </span>
                    <h3>
                      {selectedBooking.segments && selectedBooking.segments[0]
                        ? `${selectedBooking.segments[0].origin} → ${selectedBooking.segments[0].destination}`
                        : selectedBooking.bookingReference}
                    </h3>
                    <p>Booking Reference: {selectedBooking.bookingReference}</p>
                  </div>
                  <button aria-label="Close booking preview" onClick={() => setSelectedBooking(null)}><X size={17} /></button>
                </div>

                <div style={{ background: 'var(--soft)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)', display: 'grid', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border)', paddingBottom: '10px' }}>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--muted)' }}>AIRLINE PNR</span>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--blue)' }}>{selectedBooking.pnr || 'N/A'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--muted)' }}>E-TICKET NUMBER</span>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{selectedBooking.ticketNumber || 'N/A'}</div>
                    </div>
                  </div>

                  {selectedBooking.segments && selectedBooking.segments.length > 0 && (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>Flight Segment:</span>
                      {selectedBooking.segments.map((s: any, idx: number) => (
                        <div key={idx} style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                          <span><strong>{s.carrier} {s.flightNumber}</strong> ({s.origin} → {s.destination})</span>
                          <span>{s.departureTime} - {s.arrivalTime}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedBooking.passengers && selectedBooking.passengers.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', display: 'block' }}>Passengers:</span>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        {selectedBooking.passengers.map((p: any, idx: number) => (
                          <div key={idx}>{p.title} {p.firstName} {p.lastName} ({p.type})</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>Total Paid</span>
                    <strong style={{ fontSize: '14px', color: 'var(--blue)' }}>₹{selectedBooking.amount.toLocaleString('en-IN')}</strong>
                  </div>

                  {selectedBooking.emailStatus && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', fontSize: '11px', color: selectedBooking.emailStatus === 'SENT' || selectedBooking.emailStatus === 'MOCK_SENT' ? 'var(--success)' : '#e11d48' }}>
                      <strong>✉ Client Email:</strong> {selectedBooking.emailStatus === 'SENT' || selectedBooking.emailStatus === 'MOCK_SENT' ? 'Delivered to operations' : selectedBooking.emailStatus}
                      {selectedBooking.clientEmail ? ` (${selectedBooking.clientEmail})` : ''}
                    </div>
                  )}

                  {selectedBooking.status === 'CANCELLED' && typeof selectedBooking.refundAmount === 'number' && (
                    <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '6px', color: 'var(--success)', fontSize: '11px' }}>
                      ✓ Booking cancelled. Refund of ₹{selectedBooking.refundAmount.toLocaleString('en-IN')} issued.
                    </div>
                  )}
                </div>

                <div className="saved-trip-actions" style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                  <Button variant="outline" onClick={() => window.print()}>Print Ticket Slip</Button>
                  {selectedBooking.status === 'CONFIRMED' && (
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={resendingEmailId === selectedBooking.id}
                      onClick={() => void resendBookingEmail(selectedBooking)}
                    >
                      {resendingEmailId === selectedBooking.id ? 'Sending Email...' : 'Resend Email'}
                    </button>
                  )}
                  {selectedBooking.status === 'CONFIRMED' && (
                    <button
                      type="button"
                      className="button button-ghost"
                      style={{ color: 'var(--danger)' }}
                      disabled={cancellingId === selectedBooking.id}
                      onClick={() => void cancelFlightBooking(selectedBooking)}
                    >
                      {cancellingId === selectedBooking.id ? 'Cancelling...' : 'Cancel Flight Booking'}
                    </button>
                  )}
                </div>
              </article>
            )}

            {selected && (
              <article className="saved-trip-detail">
                <div className="saved-trip-detail-top"><div><span className="mini-label">TRIP PREVIEW</span><h3>{selected.destination}</h3><p>{selected.dates} · {selected.durationDays} days · {selected.travellers} travellers</p></div><button aria-label="Close trip preview" onClick={() => setSelected(null)}><X size={17} /></button></div>
                {editing ? <div className="saved-trip-edit">
                  <label><span>Destination</span><input value={selected.destination} onChange={(event) => setSelected({ ...selected, destination: event.target.value })} /></label>
                  <label><span>Dates</span><input value={selected.dates} onChange={(event) => setSelected({ ...selected, dates: event.target.value })} /></label>
                  <div className="planner-inline-fields"><label><span>Days</span><input type="number" min="1" value={selected.durationDays} onChange={(event) => setSelected({ ...selected, durationDays: Math.max(1, Number(event.target.value) || 1) })} /></label><label><span>Travellers</span><input type="number" min="1" value={selected.travellers} onChange={(event) => setSelected({ ...selected, travellers: Math.max(1, Number(event.target.value) || 1) })} /></label></div>
                  <label><span>Budget</span><input value={selected.budget} onChange={(event) => setSelected({ ...selected, budget: event.target.value })} /></label>
                  <label><span>Preferences</span><div className="choice-row">{['Nature', 'Food', 'Slow travel'].map((item) => <button type="button" key={item} className={selected.preferences.includes(item) ? 'chosen' : ''} onClick={() => setSelected({ ...selected, preferences: selected.preferences.includes(item) ? selected.preferences.filter((value) => value !== item) : [...selected.preferences, item] })}>{item}</button>)}</div></label>
                  <div className="saved-trip-actions"><Button onClick={() => void saveChanges()}>{saving ? 'Saving...' : 'Save changes'}</Button><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></div>
                  </div> : (
                    <>
                      <p className="saved-trip-reasoning">{selected.reasoning}</p>
                      <div className="saved-trip-itinerary">
                        {selected.itinerary.map((item) => (
                          <div key={`${item.day}-${item.title}`}>
                            <span>DAY {item.day}</span>
                            <strong>{item.title}</strong>
                            <ul>{item.activities.map((activity) => <li key={activity}>{activity}</li>)}</ul>
                          </div>
                        ))}
                      </div>
                      <div className="saved-trip-info">
                        <div>
                          <span>Estimated costs</span>
                          <strong>{Object.entries(selected.estimatedCosts).map(([key, value]) => `${key}: ${String(value)}`).join(' · ') || 'See itinerary'}</strong>
                        </div>
                        {selected.transportInfo && <div><span>Transport</span><strong>{Object.values(selected.transportInfo).map(String).join(' · ')}</strong></div>}
                        {selected.hotelInfo && <div><span>Stay</span><strong>{Object.values(selected.hotelInfo).map(String).join(' · ')}</strong></div>}
                      </div>
                      <div className="saved-trip-meta">
                        <span>{selected.preferences.join(' · ') || 'Balanced travel'}</span>
                        <span>{selected.itinerary.length} itinerary day{selected.itinerary.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className="saved-trip-actions">
                        <Button variant="outline" onClick={() => setEditing(true)}>Edit trip</Button>
                        <Button variant="ghost" onClick={() => void removeTrip()}>{saving ? 'Deleting...' : 'Delete'}</Button>
                      </div>
                    </>
                  )}
              </article>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function TripDashboard({ onToast, user }: { onToast: (message: string) => void; user: AuthUser | null }) {
  const [tab, setTab] = useState('trip');
  const [day, setDay] = useState(1);
  const [replanned, setReplanned] = useState(false);
  const [activeTrip, setActiveTrip] = useState<TripRecord | null>(null);
  const [flightBookings, setFlightBookings] = useState<any[]>([]);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [userStats, setUserStats] = useState<{ totalSpend: number; confirmedBookings: number; savedTrips: number; totalBookings: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoadingTrip(true);
    void Promise.all([
      listTrips(),
      fetch('/api/bookings', { credentials: 'include' }).then(r => r.ok ? r.json() : { results: [] }),
      fetch('/api/user/stats', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]).then(([trips, bookingsPayload, stats]) => {
      const mostRecent = (trips as TripRecord[])[0] ?? null;
      setActiveTrip(mostRecent);
      const allBookings = Array.isArray((bookingsPayload as any)?.results) ? (bookingsPayload as any).results : [];
      setFlightBookings(allBookings.filter((b: any) => b.kind === 'FLIGHT' && b.status === 'CONFIRMED'));
      if (stats) setUserStats(stats as any);
    }).catch(() => {}).finally(() => setLoadingTrip(false));
  }, [user]);

  const itinerary = (activeTrip?.itinerary || []) as ItineraryDay[];
  const currentDay = itinerary[day - 1];

  return (
    <section id="trip-os" className="trip-section">
      <div className="page-shell">
        <div className="dashboard-heading">
          <SectionHeading eyebrow="THE TRIP OPERATING SYSTEM" title={<>Your trip is <span>alive.</span></>} copy="One living view for the route, the money, the changes, and everything you need while you're moving." />
          <div className="dashboard-health">
            {userStats ? (
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}><strong style={{ fontSize: '22px', color: 'var(--blue)' }}>{userStats.confirmedBookings}</strong><small style={{ display: 'block', fontSize: '10px', color: 'var(--muted)' }}>CONFIRMED</small></div>
                <div style={{ textAlign: 'center' }}><strong style={{ fontSize: '22px', color: 'var(--blue)' }}>{userStats.savedTrips}</strong><small style={{ display: 'block', fontSize: '10px', color: 'var(--muted)' }}>SAVED TRIPS</small></div>
                <div style={{ textAlign: 'center' }}><strong style={{ fontSize: '16px', color: 'var(--blue)' }}>₹{(userStats.totalSpend || 0).toLocaleString('en-IN')}</strong><small style={{ display: 'block', fontSize: '10px', color: 'var(--muted)' }}>TOTAL SPEND</small></div>
              </div>
            ) : (
              <div className="dashboard-health"><span className="health-ring">—</span><div><strong>Log in</strong><small>to see your trips</small></div></div>
            )}
          </div>
        </div>
        <div className="dashboard-tabs">{dashboardTabs.map(({ id, label, icon: Icon }) => <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}><Icon size={16} />{label}</button>)}</div>
        <div className="dashboard-body">
          {tab === 'trip' && (
            <div className="trip-dashboard">
              {!user ? (
                <div className="trip-library-state" style={{ gridColumn: '1 / -1' }}>
                  <Compass size={22} /><strong>Log in to see your Trip OS.</strong>
                  <span>Your saved itineraries and bookings will appear here.</span>
                </div>
              ) : loadingTrip ? (
                <div className="trip-library-state" style={{ gridColumn: '1 / -1' }}><span className="typing"><i /><i /><i /></span> Loading your trips...</div>
              ) : !activeTrip ? (
                <div className="trip-library-state" style={{ gridColumn: '1 / -1' }}>
                  <Compass size={22} /><strong>No saved trips yet.</strong>
                  <span>Generate an AI itinerary above and save it to see it in your Trip OS.</span>
                  <Button onClick={() => document.querySelector('#planner')?.scrollIntoView({ behavior: 'smooth' })}>Plan a trip <ArrowRight size={15} /></Button>
                </div>
              ) : (
                <>
                  <div className="trip-sidebar">
                    <div className="trip-route">
                      <div>
                        <span className="mini-label">ACTIVE TRIP</span>
                        <h3>{activeTrip.destination}</h3>
                        <span>{activeTrip.dates} · {activeTrip.travellers} travellers</span>
                      </div>
                      <button onClick={() => onToast('Trip sharing link copied')}><MoreHorizontal size={18} /></button>
                    </div>
                    <div className="trip-progress">
                      <span><strong>Budget: {activeTrip.budget}</strong></span>
                      <span>{activeTrip.durationDays} days</span>
                    </div>
                    <div className="day-list">
                      {itinerary.slice(0, 5).map((dayItem, idx) => (
                        <button key={dayItem.day} onClick={() => setDay(idx + 1)} className={day === idx + 1 ? 'selected' : ''}>
                          <span>DAY {dayItem.day}</span>
                          <strong>{dayItem.title}</strong>
                          <small>{dayItem.activities[0]?.slice(0, 60) || 'Explore'}</small>
                        </button>
                      ))}
                    </div>
                    {flightBookings.length > 0 && (
                      <div style={{ marginTop: '12px', padding: '10px', background: '#eff6ff', borderRadius: '8px', fontSize: '11px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--blue)' }}>✈ {flightBookings.length} confirmed flight{flightBookings.length > 1 ? 's' : ''}</span>
                        {flightBookings.slice(0, 2).map((b: any) => (
                          <div key={b.id} style={{ color: 'var(--muted)', marginTop: '4px' }}>PNR: {b.pnr || b.bookingReference} · ₹{(b.amount || 0).toLocaleString('en-IN')}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="itinerary">
                    <div className="itinerary-top">
                      <div>
                        <span className="mini-label">DAY {currentDay?.day ?? day} · {activeTrip.destination.toUpperCase()}</span>
                        <h3>{currentDay?.title ?? 'Day plan'}</h3>
                      </div>
                    </div>
                    <div className="timeline">
                      {(currentDay?.activities || ['Explore at your pace']).map((activity, index) => (
                        <div className="timeline-row" key={`${activity}-${index}`}>
                          <span className="timeline-time">{`${(9 + index * 3).toString().padStart(2, '0')}:00`}</span>
                          <span className={`timeline-dot ${index === 0 ? 'active' : ''}`} />
                          <div>
                            <strong>{activity}</strong>
                            <span><MapPin size={12} /> {activeTrip.destination}</span>
                            <em>Itinerary plan</em>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="itinerary-tags">
                      <span><Check size={13} /> {currentDay?.activities?.length ?? 0} activities</span>
                      <span><ShieldCheck size={13} /> {activeTrip.preferences.join(' · ') || 'Balanced travel'}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {tab === 'budget' && <BudgetPanel trip={activeTrip} />}
          {tab === 'price' && <PricePanel />}
          {tab === 'safety' && <SafetyPanel />}
        </div>
        {activeTrip && user && (
          <div className="replan-banner">
            <div className="replan-icon"><Bell size={18} /></div>
            <div><strong>Trip OS · {activeTrip.destination}</strong><span>Use AI monitoring to simulate disruptions and re-plan automatically.</span></div>
            <Button variant="soft" onClick={() => { setReplanned(true); onToast('Itinerary updated. Navigate to Operations to approve changes.'); }}>{replanned ? 'Monitoring active' : 'Start monitoring'} <ArrowRight size={14} /></Button>
          </div>
        )}
      </div>
    </section>
  );
}

function BudgetPanel({ trip }: { trip?: TripRecord | null }) {
  const costs = trip?.estimatedCosts || {};
  const budget = trip?.budget || '—';
  const rows: [string, string, number][] = Object.keys(costs).length > 1
    ? Object.entries(costs).filter(([k]) => k !== 'note' && k !== 'travellers').slice(0, 5).map(([key, val]) => [key.charAt(0).toUpperCase() + key.slice(1), String(val), 25])
    : [['Flights', '₹22,000', 45], ['Hotels', '₹14,500', 30], ['Food', '₹6,200', 13], ['Activities', '₹5,720', 12]];
  return <div className="analytics-panel"><div className="budget-ring"><span>{typeof costs.total === 'string' ? costs.total : budget}<small>{trip ? 'estimated budget' : 'of ₹70,000 spent'}</small></span></div><div className="analytics-copy"><span className="mini-label">SMART BUDGET ENGINE</span><h3>{trip ? `${trip.destination} budget` : 'Within your comfort zone.'}</h3><p>{trip ? `Budget: ${trip.budget} for ${trip.travellers} travellers across ${trip.durationDays} days.` : 'You\'ve protected ₹6,580 for the moments you can\'t plan for.'}</p>{rows.map(([label, value, width]) => <div className="bar-row" key={label}><span>{label}<b>{value}</b></span><div><i style={{ width: `${width}%` }} /></div></div>)}</div></div>;
}

function PricePanel() {
  return <div className="analytics-panel price-panel"><div className="price-score"><span>92</span><small>Zelevos price score</small><strong>Best time to book</strong></div><div className="analytics-copy"><span className="mini-label">PRICE INTELLIGENCE · BALI (DPS)</span><h3>₹18,500 <del>₹20,100</del></h3><p><TrendingDown size={15} /> You’re saving ₹1,600 against the market average.</p><svg className="trend-chart" viewBox="0 0 500 120" preserveAspectRatio="none"><path d="M0 88 C60 80 75 100 120 72 S185 68 225 82 S275 28 330 53 S410 15 500 20" fill="none" stroke="#214ECF" strokeWidth="4" /><path d="M0 88 C60 80 75 100 120 72 S185 68 225 82 S275 28 330 53 S410 15 500 20 V120 H0Z" fill="url(#chartFade)" opacity=".5" /><defs><linearGradient id="chartFade" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#214ECF" /><stop offset="1" stopColor="#214ECF" stopOpacity="0" /></linearGradient></defs></svg><div className="similar-flights"><span>Similar flights</span><span>IndiGo <b>₹32,450</b></span><span>Air India <b>₹34,200</b></span></div></div></div>;
}

function SafetyPanel() {
  const factors = [['Health & safety', 'Low risk'], ['Political stability', 'Low risk'], ['Weather', 'Moderate'], ['Natural disasters', 'Low risk']];
  return <div className="analytics-panel safety-panel"><div className="trust-score"><span>8.7</span><small>Trust score / 10</small><strong>LOW RISK</strong></div><div className="analytics-copy"><span className="mini-label">TRAVEL RISK + TRUST</span><h3>Feel prepared, not worried.</h3><p>Zelevos watches the signals that matter and keeps emergency help one tap away.</p><div className="risk-list">{factors.map(([name, risk]) => <div key={name}><span><ShieldCheck size={15} />{name}</span><b className={risk === 'Moderate' ? 'moderate' : ''}>{risk}</b></div>)}</div></div></div>;
}

function Marketplace({ user, onLogin, onToast }: { user: AuthUser | null; onLogin: () => void; onToast: (message: string) => void }) {
  const cards = [
    { id: 'experience-2', name: 'Meera', role: 'Jaipur food & culture host', detail: '4-hour local food walk', price: 2200, rating: '4.9', image: imageSources.rajasthan },
    { id: 'experience-4', name: 'Arjun', role: 'Rajasthan photographer', detail: 'Sunrise couple photography', price: 3200, rating: '4.8', image: imageSources.udaipur },
    { id: 'experience-3', name: 'Sana', role: 'Kerala slow travel guide', detail: 'Backwater day with a local', price: 2400, rating: '5.0', image: imageSources.kerala },
  ];
  const book = async (card: typeof cards[number]) => {
    if (!user) { onLogin(); return; }
    try {
      const response = await fetch('/api/bookings', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'ACTIVITY', itemId: card.id, amount: card.price, payload: { name: card.name, detail: card.detail, mode: 'DEMO' } }) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Demo experience booking failed.');
      onToast(payload.message || 'Demo experience booked.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Demo experience booking failed.');
    }
  };
  return <section id="marketplace" className="marketplace"><div className="page-shell"><div className="marketplace-heading"><SectionHeading eyebrow="ZELEVOS MARKETPLACE" title={<>Go beyond the <span>guidebook.</span></>} copy="Meet local people, trusted suppliers, and experiences worth making room for." /><Button variant="outline" onClick={() => document.querySelector('#travel-hub')?.scrollIntoView({ behavior: 'smooth' })}>Browse all experiences <ArrowRight size={15} /></Button></div><div className="marketplace-grid">{cards.map((card) => <article className="hero-card" key={card.name}><img src={card.image} alt={card.role} /><div className="hero-card-content"><div className="hero-avatar">{card.name.slice(0, 1)}</div><div><strong>{card.name}</strong><span>{card.role}</span></div><span className="rating"><Star size={13} fill="currentColor" /> {card.rating}</span><p>{card.detail}</p><div><strong>₹{card.price.toLocaleString('en-IN')}</strong> <span>/ person · DEMO</span><Button onClick={() => void book(card)}>Book now</Button></div></div></article>)}</div></div></section>;
}

function WalletSection({ onToast }: { onToast: (message: string) => void }) {
  return <section id="wallet" className="wallet-section"><div className="page-shell wallet-layout"><div><SectionHeading eyebrow="ZELEVOS WALLET" title={<>Travel money,<br /><span>made simple.</span></>} copy="Keep your trip budget, committed bookings, and spending forecast in one calm view." /><Button onClick={() => onToast('Wallet top-up flow opened')}>Open wallet <ArrowRight size={15} /></Button></div><div className="wallet-card"><div className="wallet-card-top"><span><Wallet size={18} /> Available balance</span><span>•••• 0482</span></div><strong>₹32,560</strong><div className="wallet-actions"><button onClick={() => onToast('Add money flow opened')}><Plus size={15} /> Add money</button><button onClick={() => onToast('Withdraw flow opened')}><ArrowRight size={15} /> Withdraw</button></div><div className="transactions"><span>Recent transactions</span><div><span><span className="transaction-icon"><Hotel size={14} /></span>Hotel booking</span><b>− ₹14,500</b></div><div><span><span className="transaction-icon"><Plane size={14} /></span>Flight booking</span><b>− ₹22,000</b></div><div><span><span className="transaction-icon plus"><Plus size={14} /></span>Add money</span><b className="positive">+ ₹50,000</b></div></div></div></div></section>;
}

function Copilot({ open, onClose, onToast, user }: { open: boolean; onClose: () => void; onToast: (message: string) => void; user: AuthUser | null }) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<string[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const send = async () => {
    const nextMessage = message.trim();
    if (!nextMessage || loading) return;
    const history = sent.map((item) => ({ role: 'user' as const, content: item }));
    setSent((items) => [...items, nextMessage]);
    setMessage('');
    setLoading(true);
      try {
        setReply(user ? await askConcierge(nextMessage, history) : await askZelevos(nextMessage, history));
    } catch (error) {
    onToast(error instanceof Error ? error.message : 'Zelevos AI is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };
  return <AnimatePresence>{open && <motion.aside initial={{ opacity: 0, y: 20, x: 20 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, y: 20, x: 20 }} className="copilot"><div className="copilot-head"><span className="copilot-avatar"><Sparkles size={17} /></span><div><strong>Ask Zelevos</strong><small>AI travel copilot · online</small></div><button onClick={onClose} aria-label="Close copilot"><X size={17} /></button></div><div className="copilot-body"><p className="copilot-message">What can I help you with today?</p>{sent.map((item, index) => <p className="copilot-sent" key={`${item}-${index}`}>{item}</p>)}{reply && <p className="copilot-message">{reply}</p>}{loading && <p className="copilot-message"><span className="typing"><i /><i /><i /></span></p>}<div className="quick-actions">{['Change my hotel to a sea view room', 'Find cheaper flights', 'Suggest 3 more activities', "What's the weather like?"].map((item) => <button onClick={() => setMessage(item)} key={item}>{item}</button>)}</div></div><div className="copilot-input"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && send()} placeholder="Ask me anything..." /><button onClick={send} aria-label="Send message"><Send size={15} /></button></div></motion.aside>}</AnimatePresence>;
}

function OperationsPanel({ user, onLogin, onToast }: { user: AuthUser | null; onLogin: () => void; onToast: (message: string) => void }) {
  const [profile, setProfile] = useState<TravellerProfile | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; title: string; body: string; unread: boolean }>>([]);
  const [monitoring, setMonitoring] = useState(false);
  const [proposal, setProposal] = useState<{ tripId: string; title: string; changes: string[] } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setNotifications([]);
      return;
    }
    void Promise.all([
      profileRequest<{ profile: TravellerProfile }>('/api/profile'),
      profileRequest<{ results: typeof notifications }>('/api/notifications'),
    ]).then(([profileResult, notificationsResult]) => {
      setProfile(profileResult.profile);
      setNotifications(notificationsResult.results);
    }).catch(() => onToast('Traveller operations could not be loaded.'));
  }, [user]);

  const simulateMonitoring = async () => {
    if (!user) {
      onLogin();
      return;
    }
    setMonitoring(true);
    try {
      const trips = await listTrips();
      if (!trips[0]) {
        onToast('Save a trip first so Zelevos can monitor it.');
        return;
      }
      const response = await profileRequest<{ tripId: string; proposal: { title: string; changes: string[] } }>(`/api/trips/${trips[0].id}/monitor`, { method: 'POST' });
      setProposal({ tripId: response.tripId, ...response.proposal });
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Monitoring simulation failed.');
    } finally {
      setMonitoring(false);
    }
  };

  const approveReplan = async () => {
    if (!proposal) return;
    try {
      await profileRequest(`/api/trips/${proposal.tripId}/replan`, { method: 'POST', body: JSON.stringify({ approved: true }) });
      setProposal(null);
      onToast('Demo itinerary updated. No live booking was changed.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The re-plan could not be applied.');
    }
  };

  const saveProfile = async () => {
    if (!profile || profileSaving) return;
    setProfileSaving(true);
    try {
      const result = await profileRequest<{ profile: TravellerProfile }>('/api/profile', { method: 'PUT', body: JSON.stringify(profile) });
      setProfile(result.profile);
      onToast('Zelevos remembers your travel style.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Profile could not be saved.');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <section className="operations-section" id="operations">
      <div className="page-shell">
        <div className="operations-heading">
          <SectionHeading eyebrow="TRAVELLER OPERATIONS" title={<>The details that make a trip <span>yours.</span></>} copy="Zelevos connects your preferences, alerts, budget and decisions so the trip can adapt without losing your intent." />
          <div className="operations-status"><span className="status-pulse" /> {user ? 'Account systems connected' : 'Log in to activate your Trip OS'}</div>
        </div>
        {!user ? (
          <div className="operations-login"><UserRound size={23} /><strong>Your traveller graph starts here.</strong><span>Sign in to save preferences, receive alerts and approve itinerary changes.</span><Button onClick={onLogin}>Log in to Zelevos <ArrowRight size={15} /></Button></div>
        ) : (
          <div className="operations-grid">
            <article className="operation-card memory-card">
              <div className="operation-card-top"><span className="mini-label">TRAVELLER MEMORY</span><span className="operation-icon"><UserRound size={16} /></span></div>
              {profile && <><div className="memory-profile"><span className="memory-avatar">{profile.avatarInitials}</span><div><strong>{profile.displayName}</strong><small>Based in {profile.homeCity}</small></div></div><div className="memory-tags"><span>{profile.travelStyle}</span><span>{profile.budgetStyle}</span><span>{profile.hotelStyle}</span>{profile.foodPreferences.slice(0, 2).map((item) => <span key={item}>{item}</span>)}</div><div className="memory-edit"><label>Display name<input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} /></label><label>Home city<input value={profile.homeCity} onChange={(event) => setProfile({ ...profile, homeCity: event.target.value })} /></label><label>Travel style<select value={profile.travelStyle} onChange={(e) => setProfile({ ...profile, travelStyle: e.target.value })}><option>Slow and curious</option><option>Fast and packed</option><option>Adventure first</option><option>Budget focused</option><option>Luxury</option><option>Digital nomad</option></select></label><label>Budget style<select value={profile.budgetStyle} onChange={(e) => setProfile({ ...profile, budgetStyle: e.target.value })}><option>Value-conscious</option><option>Mid-range comfort</option><option>Luxury</option><option>Backpacker</option></select></label><label>Hotel style<select value={profile.hotelStyle} onChange={(e) => setProfile({ ...profile, hotelStyle: e.target.value })}><option>Boutique stays</option><option>Business hotels</option><option>Hostels</option><option>Resorts</option><option>Homestays</option></select></label><label>Crowd tolerance<select value={profile.crowdTolerance} onChange={(e) => setProfile({ ...profile, crowdTolerance: e.target.value })}><option>Prefer quieter places</option><option>Comfortable with crowds</option><option>Love the buzz</option></select></label></div><Button variant="outline" onClick={() => void saveProfile()}>{profileSaving ? 'Saving...' : 'Save traveller memory'} <Check size={14} /></Button></>}
            </article>
            <article className="operation-card alert-card">
              <div className="operation-card-top"><span className="mini-label">LIVE TRIP MONITORING</span><span className="operation-icon warning-icon"><AlertTriangle size={16} /></span></div>
              <h3>Watch the moving parts.</h3><p>Simulate a flight delay and let Zelevos check the itinerary, rest time and budget before asking you to approve a change.</p>
              <div className="monitor-event"><span className="event-dot" /><div><strong>Provider status</strong><small>Demo monitor · live feeds not configured</small></div><span className="provider-badge">DEMO / TEST</span></div>
              <Button onClick={() => void simulateMonitoring()}>{monitoring ? 'Checking your trip...' : 'Simulate flight delay'} <ArrowRight size={14} /></Button>
              {proposal && <div className="replan-proposal"><strong>{proposal.title}</strong>{proposal.changes.map((change) => <span key={change}><Check size={12} /> {change}</span>)}<div><Button onClick={() => void approveReplan()}>Approve re-plan</Button><Button variant="ghost" onClick={() => setProposal(null)}>Keep current plan</Button></div></div>}
            </article>
            <article className="operation-card notification-card">
              <div className="operation-card-top"><span className="mini-label">NOTIFICATION CENTRE</span><span className="operation-icon"><Bell size={16} /></span></div>
              <h3>{notifications.filter((item) => item.unread).length || 'No'} new signals.</h3>
              <div className="notification-list">{notifications.slice(0, 6).map((item) => <button key={item.id} className={item.unread ? 'unread' : ''} onClick={() => { setNotifications((items) => items.map((notification) => notification.id === item.id ? { ...notification, unread: false } : notification)); void profileRequest(`/api/notifications/${item.id}/read`, { method: 'POST' }); }}><span className="notification-type">{item.type.replace(/_/g, ' ')}</span><strong>{item.title}</strong><small>{item.body}</small></button>)}</div>
              {notifications.some((n) => n.unread) && (
                <button
                  style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}
                  onClick={() => {
                    setNotifications((items) => items.map((n) => ({ ...n, unread: false })));
                    void profileRequest('/api/notifications/read-all', { method: 'POST' });
                  }}
                >
                  Mark all as read
                </button>
              )}
              <a className="text-link" href="#operations">View all notifications <ArrowRight size={13} /></a>
            </article>
            <article className="operation-card emergency-card">
              <div><span className="mini-label">EMERGENCY ASSISTANCE</span><h3>Help when the plan changes fast.</h3><p>Keep your trip details, booking references and human concierge escalation in one place.</p></div>
              <Button variant="soft" onClick={() => onToast('Human concierge escalation is ready for live support setup.')}>Open emergency help <ArrowRight size={14} /></Button>
            </article>
          </div>
        )}
      </div>
    </section>
  );
}

function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [, setLocation] = useLocation();

  // Read token from URL query
  const token = typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('token') || '' : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setMessage('Passwords do not match.'); setStatus('error'); return; }
    if (!token) { setMessage('Invalid or missing reset token.'); setStatus('error'); return; }
    setStatus('loading');
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword: confirm }),
      });
      const data = await res.json() as { status?: string; message?: string };
      if (!res.ok) throw new Error(data.message || 'Reset failed.');
      setMessage('Password updated. You can now log in.');
      setStatus('done');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Password reset failed.');
      setStatus('error');
    }
  };

  return (
    <div className="account-page">
      <Navbar user={null} authLoading={false} onLogin={() => setLocation('/login')} onLogout={() => {}} />
      <main className="account-main page-shell">
        <SectionHeading eyebrow="SET NEW PASSWORD" title={<>Choose a <span>new password.</span></>} copy="Your new password must be at least 8 characters." />
        <div style={{ maxWidth: '400px', marginTop: '32px' }}>
          {status !== 'done' ? (
            <form onSubmit={(e) => void submit(e)} style={{ display: 'grid', gap: '16px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                New password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </label>
              <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                Confirm new password
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" required minLength={8} style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </label>
              <Button type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Updating...' : 'Set new password'}</Button>
              {status === 'error' && <p style={{ color: '#e11d48', fontSize: '13px' }}>{message}</p>}
            </form>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ padding: '16px', background: '#ecfdf5', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <p style={{ fontSize: '13px', color: '#166534', margin: 0 }}>{message}</p>
              </div>
              <Button onClick={() => setLocation('/login')}>Log in <ArrowRight size={15} /></Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json() as { status?: string; message?: string; resetUrl?: string; devMode?: boolean };
      setMessage(data.message || 'Check your email for a reset link.');
      if (data.resetUrl) setResetUrl(data.resetUrl);
      setStatus('done');
    } catch {
      setMessage('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div className="account-page">
      <Navbar user={null} authLoading={false} onLogin={() => setLocation('/login')} onLogout={() => {}} />
      <main className="account-main page-shell">
        <button className="back-link" onClick={() => setLocation('/login')} style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to login
        </button>
        <SectionHeading eyebrow="ACCOUNT RECOVERY" title={<>Reset your <span>password.</span></>} copy="Enter the email you signed up with. We'll generate a reset link." />
        <div style={{ maxWidth: '400px', marginTop: '32px' }}>
          {status !== 'done' ? (
            <form onSubmit={(e) => void submit(e)} style={{ display: 'grid', gap: '16px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                />
              </label>
              <Button type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Generating reset link...' : 'Send reset link'} {status !== 'loading' && <ArrowRight size={15} />}
              </Button>
              {status === 'error' && <p style={{ color: '#e11d48', fontSize: '13px' }}>{message}</p>}
            </form>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ padding: '16px', background: '#ecfdf5', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <p style={{ fontSize: '13px', color: '#166534', margin: 0 }}><strong>✓ Reset link generated.</strong></p>
                <p style={{ fontSize: '13px', color: '#166534', margin: '6px 0 0' }}>{message}</p>
              </div>
              {resetUrl && (
                <div style={{ padding: '14px', background: '#fef3c7', borderRadius: '10px', border: '1px solid #fcd34d' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', margin: '0 0 8px' }}>DEV MODE — No email configured. Use this link directly:</p>
                  <a href={resetUrl} style={{ fontSize: '12px', color: '#1d4ed8', wordBreak: 'break-all' }}>{resetUrl}</a>
                </div>
              )}
              <Button variant="outline" onClick={() => setLocation('/login')}>Back to login <ArrowRight size={15} /></Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function AccountPage({ kind }: { kind: 'profile' | 'settings' | 'notifications' | 'business' }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [, setLocation] = useLocation();
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3000); };
  useEffect(() => { void currentUser().then(setUser).catch(() => setUser(null)); }, []);
  const titles = {
    profile: ['YOUR TRAVELLER PROFILE', 'Zelevos remembers how you travel.'],
    settings: ['ACCOUNT SETTINGS', 'Keep your travel system in your control.'],
    notifications: ['NOTIFICATION CENTRE', 'The signals that matter, in one calm place.'],
    business: ['ZELEVOS FOR BUSINESS', 'One view for customers, bookings and performance.'],
  } as const;
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'login' | 'signup' }>({ open: false, mode: 'login' });
  const [eyebrow, title] = titles[kind] || ['ACCOUNT', 'Your Account'];
  return <div className="account-page"><Navbar user={user} authLoading={false} onLogin={(mode = 'login') => setAuthModal({ open: true, mode })} onLogout={() => { void logout().then(() => setUser(null)); }} /><main className="account-main page-shell"><button className="back-link" onClick={() => setLocation('/')}><ArrowRight size={14} className="back-arrow" /> Back to Zelevos</button><SectionHeading eyebrow={eyebrow} title={<>{title}</>} copy={kind === 'business' ? 'Supplier and operator tools are separated from traveller data and clearly marked as an operations workspace.' : 'Your private Zelevos workspace keeps decisions, preferences and trip signals together.'} />{kind === 'business' ? <BusinessPanel onToast={showToast} /> : <AccountPanel kind={kind} user={user} onLogin={() => setAuthModal({ open: true, mode: 'login' })} onToast={showToast} />}</main>{authModal.open && <AuthDialog initialMode={authModal.mode} onClose={() => setAuthModal((prev) => ({ ...prev, open: false }))} onAuthenticated={(nextUser) => { setUser(nextUser); setAuthModal((prev) => ({ ...prev, open: false })); showToast('You are signed in.'); }} />}{toast && <div className="toast"><Check size={16} />{toast}</div>}</div>;
}

function AccountPanel({ kind, user, onLogin, onToast }: { kind: 'profile' | 'settings' | 'notifications'; user: AuthUser | null; onLogin: () => void; onToast: (message: string) => void }) {
  if (!user) return <div className="operations-login account-login"><ShieldCheck size={24} /><strong>Log in to open this private workspace.</strong><span>Your profile and notifications are only visible to your account.</span><Button onClick={onLogin}>Log in <ArrowRight size={15} /></Button></div>;
  if (kind === 'notifications') return <OperationsPanel user={user} onLogin={onLogin} onToast={onToast} />;
  return <OperationsPanel user={user} onLogin={onLogin} onToast={onToast} />;
}

function BusinessPanel({ onToast }: { onToast: (message: string) => void }) {
  const metrics = [['Active bookings', '128', '+18% this month'], ['Gross booking value', '₹18.4L', '+12% this month'], ['Customers served', '492', '+26% this month'], ['Supplier rating', '4.9 / 5', 'Across 84 reviews']];
  return <div className="business-panel"><div className="business-metrics">{metrics.map(([label, value, detail]) => <div className="business-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}</div><div className="business-columns"><article className="operation-card"><span className="mini-label">RECENT BOOKINGS</span>{['Meera · Jaipur food walk', 'Arjun · Gulmarg sunrise', 'Sana · Kerala slow day'].map((item, index) => <div className="business-row" key={item}><span className="business-row-avatar">{item[0]}</span><div><strong>{item}</strong><small>{index === 0 ? 'Today · Confirmed' : 'Tomorrow · Pending review'}</small></div><b>{['₹1,800', '₹3,500', '₹2,400'][index]}</b></div>)}<Button variant="outline" onClick={() => onToast('Bookings workspace is ready for live supplier data.')}>View bookings <ArrowRight size={14} /></Button></article><article className="operation-card"><span className="mini-label">SUPPLIER HEALTH</span><h3>Keep the local network strong.</h3><p>Review verification, availability, reviews and support requests before connecting a live marketplace provider.</p><div className="health-lines"><span><b>84</b> verified suppliers</span><span><b>96%</b> availability this week</span><span><b>12</b> reviews to respond</span></div><Button onClick={() => onToast('Supplier analytics are ready for your next connection.')}>Open analytics <BarChart3 size={14} /></Button></article></div></div>;
}

function Footer() {
  const footerSub = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = (e.currentTarget.elements.namedItem('email') as HTMLInputElement)?.value;
    if (input) alert(`Thanks! We'll be in touch at ${input}`);
  };
  return (
    <footer>
      <div className="page-shell footer-grid">
        <div>
          <Logo />
          <h2>Your next trip<br /><span>starts here.</span></h2>
          <p>Handcrafted holiday packages fulfilled by verified local suppliers across India.</p>
        </div>
        <div>
          <strong>Explore</strong>
          <a href="#curated-packages">Holiday Packages</a>
          <a href="#why-zelevos">Why Zelevos</a>
          <a href="#partner-program">Partner Program</a>
          <a href="/partner-portal">Partner Portal</a>
        </div>
        <div>
          <strong>Suppliers & Vendors</strong>
          <a href="/become-a-supplier" style={{ color: '#6366f1', fontWeight: 700 }}>Become a Supplier</a>
          <a href="/vendor-portal">Vendor Portal Login</a>
          <a href="/become-a-supplier">Check Application Status</a>
        </div>
        <div>
          <strong>For travellers</strong>
          <a href="#my-trips">My Bookings</a>
          <a href="mailto:support@zelevos.com">Help Centre</a>
          <a href="/forgot-password">Reset Password</a>
        </div>
        <div>
          <strong>Stay in the loop</strong>
          <p>Curated itineraries, seasonal updates, and destination guides.</p>
          <form className="footer-email" onSubmit={footerSub}>
            <input name="email" type="email" placeholder="Your email" />
            <button type="submit" aria-label="Subscribe"><ArrowRight size={16} /></button>
          </form>
        </div>
      </div>
      <div className="page-shell footer-bottom">
        <span>© 2026 Zelevos</span>
        <span>Curated holiday packages fulfilled by verified local suppliers.</span>
        <span>India · English · ₹ INR</span>
      </div>
    </footer>
  );
}

function Home() {
  const [toast, setToast] = useState('');
  const [tripRefreshKey, setTripRefreshKey] = useState(0);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: 'login' | 'signup';
    notice?: string | null;
    onSuccess?: () => void;
  }>({ open: false, mode: 'login' });

  // Package & Section 8/14 modals state
  const [selectedPackageSlug, setSelectedPackageSlug] = useState<string | null>(null);
  const [checkoutPackage, setCheckoutPackage] = useState<any | null>(null);
  const [customTripModalOpen, setCustomTripModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportBookingId, setSupportBookingId] = useState<string | undefined>();

  const [matchPkg, paramsPkg] = useRoute('/packages/:slug');
  const [matchDest, paramsDest] = useRoute('/destinations/:slug');

  useEffect(() => {
    if (matchPkg && paramsPkg?.slug) {
      setSelectedPackageSlug(paramsPkg.slug);
    }
  }, [matchPkg, paramsPkg?.slug]);

  useEffect(() => {
    if (matchDest && paramsDest?.slug) {
      setDestinationSearch(paramsDest.slug);
    }
  }, [matchDest, paramsDest?.slug]);

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3000); };

  const openAuth = (mode: 'login' | 'signup' = 'login', notice: string | null = null, onSuccess?: () => void) => {
    setAuthModal({ open: true, mode, notice, onSuccess });
  };

  const openBuildMyTrip = () => {
    if (user) {
      setCustomTripModalOpen(true);
      return;
    }
    openAuth('login', 'Log in to submit and track your private custom trip request.', () => setCustomTripModalOpen(true));
  };

  useEffect(() => {
    void currentUser().then(setUser).catch(() => showToast('Account status could not be loaded.')).finally(() => setAuthLoading(false));
  }, []);

  // Preserve partner referral attribution from the URL.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const refParam = url.searchParams.get('ref');
      if (refParam) {
        sessionStorage.setItem('zelevos_partner_ref', refParam);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setTripRefreshKey((value) => value + 1);
      showToast('You are logged out.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Logout could not be completed.');
    }
  };

  const [destinationSearch, setDestinationSearch] = useState('');
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [travelHubTab, setTravelHubTab] = useState<'flights' | 'hotels' | 'experiences' | 'transport' | 'bookings'>('hotels');

  useEffect(() => {
    document.title = 'Zelevos — Curated Holiday Packages & Travel Marketplace';
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash) {
        setTimeout(() => {
          const el = document.querySelector(hash);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          }
        }, 150);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  return (
    <div className="zelevos-app">
      <Navbar
        user={user}
        authLoading={authLoading}
        onLogin={(mode = 'login') => openAuth(mode)}
        onLogout={() => void handleLogout()}
        onOpenBuildMyTrip={openBuildMyTrip}
        onOpenSupport={() => setSupportModalOpen(true)}
        onSelectPackage={(slug) => setSelectedPackageSlug(slug)}
        onSearchDestination={(dest) => {
          setDestinationSearch(dest);
          setTimeout(() => {
            document.querySelector('#curated-packages')?.scrollIntoView({ behavior: 'smooth' });
          }, 80);
        }}
      />
      <main>
        {/* PARKED (Phase 1, 2026-09-19): Old AI Travel OS Hero with AI prompt box and AI TRAVEL OS badge. Replaced by plain destination-search hero below per Wayora_PRD_Without_APIs Section 7.1. Do not re-enable without explicit instruction.
        <Hero onSend={sendIdea} />
        */}
        <Hero onSearch={(query) => setDestinationSearch(query)} />

        {/* PRIMARY CONTENT: PRD Section 7.1 Curated Packages Section with Themes Filter Bar */}
        <CuratedPackagesSection
          searchFilter={destinationSearch}
          onSelectPackage={(slug: string) => setSelectedPackageSlug(slug)}
          onOpenBuildMyTrip={openBuildMyTrip}
          onToast={showToast}
          user={user}
          onOpenAuth={() => openAuth('login')}
        />

        {/* PARKED (Phase 1, 2026-09-19): AI Travel OS panel in Discover section is parked per Wayora_PRD_Without_APIs. Do not re-enable without explicit instruction.
        <Discover onSave={showToast} onStart={() => setCustomTripModalOpen(true)} />
        */}

        {/* PRD Section 7.1 Value Pillars */}
        <WhyZelevosSection />

        {/* Travel Hub: Multi-Modal Travel Marketplace (Flights, Hotels, Experiences, Transport, My Bookings) */}
        <TravelHub
          user={user}
          onLogin={() => openAuth('login')}
          onToast={showToast}
          activeTab={travelHubTab}
          onTabChange={setTravelHubTab}
        />

        {/* PRD Section 7.1 Partner Call-to-Action */}
        <PartnerCTASection onOpenPartner={() => setPartnerModalOpen(true)} />

        {/* PRD Section 11 Customer Bookings Management */}
        <MyTrips
          refreshKey={tripRefreshKey}
          user={user}
          onLogin={() => openAuth('login')}
          onToast={showToast}
          onOpenSupport={(bId) => {
            setSupportBookingId(bId);
            setSupportModalOpen(true);
          }}
        />

        {/* PARKED (Phase 1, 2026-09-19): AI Travel OS feature (<Marketplace>), out of scope for current API-Free V1 per Wayora_PRD_Without_APIs. Do not re-enable without explicit instruction.
        <Marketplace user={user} onLogin={() => openAuth('login')} onToast={showToast} />
        */}

        {/* PARKED (Phase 1, 2026-09-19): AI Travel OS feature (<Copilot> "Ask Zelevos" floating button), out of scope for current API-Free V1 per Wayora_PRD_Without_APIs. Do not re-enable without explicit instruction.
        <Copilot open={copilot} onClose={() => setCopilot(false)} onToast={showToast} user={user} />
        */}
      </main>
      <Footer />
      {partnerModalOpen && (
        <PartnerRegistrationModal
          onClose={() => setPartnerModalOpen(false)}
          onToast={showToast}
        />
      )}
      {authModal.open && (
        <AuthDialog
          initialMode={authModal.mode}
          contextNotice={authModal.notice}
          onClose={() => setAuthModal((prev) => ({ ...prev, open: false }))}
          onAuthenticated={(authenticatedUser) => {
            setUser(authenticatedUser);
            setTripRefreshKey((value) => value + 1);
            showToast(`Welcome, ${authenticatedUser.fullName || authenticatedUser.email.split('@')[0]}!`);
            const pendingCallback = authModal.onSuccess;
            setAuthModal({ open: false, mode: 'login' });
            if (pendingCallback) {
              pendingCallback();
            }
          }}
        />
      )}
      {selectedPackageSlug && (
        <PackageDetailModal
          packageIdOrSlug={selectedPackageSlug}
          onClose={() => setSelectedPackageSlug(null)}
          user={user}
          onOpenAuth={() => openAuth('login')}
          onBook={(pkg: PackageDetail) => {
            if (!user) {
              openAuth('login', 'Please log in or create an account to book your holiday package.', () => {
                setSelectedPackageSlug(null);
                setCheckoutPackage(pkg);
              });
              return;
            }
            setSelectedPackageSlug(null);
            setCheckoutPackage(pkg);
          }}
        />
      )}
      {checkoutPackage && (
        <PackageCheckoutModal
          pkg={checkoutPackage}
          user={user}
          onLogin={() => openAuth('login')}
          onClose={() => setCheckoutPackage(null)}
          onSuccess={(bookingId: string) => {
            setTripRefreshKey((value) => value + 1);
            showToast(`Booking ${bookingId} confirmed! Check My Trips.`);
          }}
        />
      )}
      {customTripModalOpen && (
        <CustomTripModal
          onClose={() => setCustomTripModalOpen(false)}
        />
      )}
      {supportModalOpen && (
        <SupportTicketModal
          bookingId={supportBookingId}
          onClose={() => {
            setSupportModalOpen(false);
            setSupportBookingId(undefined);
          }}
        />
      )}
      {toast && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="toast"><Check size={16} />{toast}<button onClick={() => setToast('')}><X size={14} /></button></motion.div>}
    </div>
  );
}

function FlightsRoute() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: 'login' | 'signup';
    notice?: string | null;
    onSuccess?: () => void;
  }>({ open: false, mode: 'login' });
  const [toast, setToast] = useState('');

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    void currentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      showToast('You are logged out.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Logout failed.');
    }
  };

  return (
    <div className="zelevos-app flights-page-wrapper">
      <Navbar
        user={user}
        authLoading={authLoading}
        onLogin={(mode = 'login') => setAuthModal({ open: true, mode })}
        onLogout={() => void handleLogout()}
      />
      <FlightsPage
        user={user}
        authLoading={authLoading}
        onLogin={(mode = 'login', notice, onSuccess) => setAuthModal({ open: true, mode, notice, onSuccess })}
        onLogout={() => void handleLogout()}
      />
      <Footer />
      {authModal.open && (
        <AuthDialog
          initialMode={authModal.mode}
          contextNotice={authModal.notice}
          onClose={() => setAuthModal((prev) => ({ ...prev, open: false }))}
          onAuthenticated={(authenticatedUser) => {
            setUser(authenticatedUser);
            showToast(`Welcome, ${authenticatedUser.fullName || authenticatedUser.email.split('@')[0]}!`);
            const pendingCallback = authModal.onSuccess;
            setAuthModal({ open: false, mode: 'login' });
            if (pendingCallback) {
              pendingCallback();
            }
          }}
        />
      )}
      {toast && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="toast">
          <Check size={16} />{toast}
          <button onClick={() => setToast('')}><X size={14} /></button>
        </motion.div>
      )}
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <WouterRoute path="/" component={Home} />
      <WouterRoute path="/packages" component={Home} />
      <WouterRoute path="/packages/:slug" component={Home} />
      <WouterRoute path="/destinations" component={Home} />
      <WouterRoute path="/destinations/:slug" component={Home} />
      <WouterRoute path="/login" component={() => <AccountPage kind="profile" />} />
      <WouterRoute path="/signup" component={() => <AccountPage kind="profile" />} />
      <WouterRoute path="/forgot-password" component={ForgotPasswordPage} />
      <WouterRoute path="/reset-password" component={ResetPasswordPage} />
      <WouterRoute path="/profile" component={() => <AccountPage kind="profile" />} />
      <WouterRoute path="/settings" component={() => <AccountPage kind="settings" />} />
      <WouterRoute path="/notifications" component={() => <AccountPage kind="notifications" />} />
      <WouterRoute path="/business" component={() => <AccountPage kind="business" />} />
      <WouterRoute path="/business/dashboard" component={() => <AccountPage kind="business" />} />
      <WouterRoute path="/business/bookings" component={() => <AccountPage kind="business" />} />
      <WouterRoute path="/business/customers" component={() => <AccountPage kind="business" />} />
      <WouterRoute path="/business/analytics" component={() => <AccountPage kind="business" />} />
      <WouterRoute path="/discover" component={Home} />
      <WouterRoute path="/destinations" component={Home} />
      <WouterRoute path="/stays" component={Home} />
      <WouterRoute path="/flights" component={FlightsRoute} />
      <WouterRoute path="/admin" component={AdminPage} />
      <WouterRoute path="/admin/:section*" component={AdminPage} />
      <WouterRoute path="/operations" component={AdminPage} />
      <WouterRoute path="/become-a-supplier" component={BecomeSupplierPage} />
      <WouterRoute path="/supplier-register" component={BecomeSupplierPage} />
      <WouterRoute path="/vendor-portal" component={VendorPortalPage} />
      <WouterRoute path="/vendor" component={VendorPortalPage} />
      <WouterRoute path="/partner" component={PartnerPortalPage} />
      <WouterRoute path="/partner/dashboard" component={PartnerPortalPage} />
      <WouterRoute path="/partner-portal" component={PartnerPortalPage} />
      <WouterRoute path="/finance" component={AdminPage} />
      <WouterRoute path="/experiences" component={Home} />
      <WouterRoute path="/guides" component={Home} />
      <WouterRoute path="/concierge" component={Home} />
      <WouterRoute path="/ai-planner" component={Home} />
      <WouterRoute path="/planner" component={Home} />
      <WouterRoute path="/dashboard" component={Home} />
      <WouterRoute path="/trips" component={Home} />
      <WouterRoute path="/trips/:id" component={Home} />
      <WouterRoute path="/marketplace" component={Home} />
      <WouterRoute path="/hotels" component={Home} />
      <WouterRoute path="/transport" component={Home} />
      <WouterRoute path="/wallet" component={Home} />
      <WouterRoute component={NotFound} />
    </Switch>
  );
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><Router /></ErrorBoundary></WouterRouter></TooltipProvider></QueryClientProvider>;
}

export default App;