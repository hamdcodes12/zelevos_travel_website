import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  MapPin,
  Calendar,
  Sparkles,
  Plane,
  ArrowRight,
  TrendingUp,
  Compass,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPackage?: (slug: string) => void;
  onSearchDestination?: (destination: string) => void;
  onOpenBuildMyTrip?: () => void;
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  onSelectPackage,
  onSearchDestination,
  onOpenBuildMyTrip,
}: GlobalSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Load packages once on open
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/packages')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.results)) {
            setPackages(data.results);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));

      // Auto focus input after short mount delay
      setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const popularDestinations = [
    'Kashmir',
    'Ladakh',
    'Kerala',
    'Rajasthan',
    'Goa',
    'Himachal',
    'Andaman',
  ];

  const trimmed = searchTerm.trim().toLowerCase();

  // Filter packages based on query
  const filteredPackages = trimmed
    ? packages.filter((pkg) => {
        const titleMatch = pkg.title?.toLowerCase().includes(trimmed);
        const destMatch = pkg.destinationName?.toLowerCase().includes(trimmed);
        const themeMatch = pkg.theme?.toLowerCase().includes(trimmed);
        const locMatch = Array.isArray(pkg.locations) &&
          pkg.locations.some((l: string) => l.toLowerCase().includes(trimmed));
        return titleMatch || destMatch || themeMatch || locMatch;
      })
    : packages.slice(0, 4); // Show top 4 featured when query is empty

  const handleDestinationClick = (dest: string) => {
    onClose();
    if (onSearchDestination) {
      onSearchDestination(dest);
    } else {
      window.location.href = `/#curated-packages`;
    }
  };

  const handlePackageClick = (slug: string) => {
    onClose();
    if (onSelectPackage) {
      onSelectPackage(slug);
    } else {
      window.location.href = `/packages/${slug}`;
    }
  };

  const handleJumpToHero = () => {
    onClose();
    const heroInput = document.querySelector<HTMLInputElement>(
      '#hero-destination-input, #hero-input'
    );
    if (heroInput) {
      heroInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      heroInput.focus();
      heroInput.classList.add('hero-input-highlight');
      setTimeout(() => heroInput.classList.remove('hero-input-highlight'), 2000);
    } else {
      window.location.href = '/#top';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trimmed) {
      handleDestinationClick(searchTerm.trim());
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="global-search-backdrop" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -16 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="global-search-dialog"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header & Search Bar Input */}
          <form className="global-search-header" onSubmit={handleSubmit}>
            <Search className="global-search-icon" size={20} />
            <input
              ref={inputRef}
              id="global-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search destinations, holiday packages, flights... (e.g. Kashmir, Kerala)"
              aria-label="Search destinations and packages"
            />
            {searchTerm && (
              <button
                type="button"
                className="global-search-clear"
                onClick={() => {
                  setSearchTerm('');
                  inputRef.current?.focus();
                }}
                aria-label="Clear search text"
              >
                <X size={15} />
              </button>
            )}
            <button
              type="button"
              className="global-search-close"
              onClick={onClose}
              aria-label="Close search"
            >
              <kbd>ESC</kbd>
            </button>
          </form>

          {/* Quick Shortcuts Bar */}
          <div className="global-search-shortcuts">
            <span className="shortcuts-label">
              <Compass size={13} />
              <span>Explore:</span>
            </span>
            <div className="shortcuts-pills">
              {popularDestinations.map((dest) => (
                <button
                  key={dest}
                  type="button"
                  className="shortcut-pill"
                  onClick={() => handleDestinationClick(dest)}
                >
                  <MapPin size={11} />
                  <span>{dest}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Portal Action Buttons */}
          <div className="global-search-actions">
            <a
              href="/flights"
              onClick={(e) => {
                e.preventDefault();
                onClose();
                window.location.href = '/flights';
              }}
              className="search-action-card"
            >
              <div className="action-icon plane-icon">
                <Plane size={16} />
              </div>
              <div>
                <strong>Flights Concierge</strong>
                <span>Instant domestic & international airfare assist</span>
              </div>
              <ArrowUpRight size={14} className="action-arrow" />
            </a>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBuildMyTrip?.();
              }}
              className="search-action-card"
            >
              <div className="action-icon sparkles-icon">
                <Sparkles size={16} />
              </div>
              <div>
                <strong>Build My Trip</strong>
                <span>Tailored multi-city holiday planner</span>
              </div>
              <ArrowUpRight size={14} className="action-arrow" />
            </button>
          </div>

          {/* Results List */}
          <div className="global-search-results">
            <div className="results-header">
              <span>
                {trimmed
                  ? `Matching Packages (${filteredPackages.length})`
                  : 'Featured Curated Packages'}
              </span>
              <button
                type="button"
                className="jump-hero-link"
                onClick={handleJumpToHero}
              >
                <span>Jump to Home Search Bar</span>
                <ArrowRight size={12} />
              </button>
            </div>

            {loading ? (
              <div className="global-search-loading">
                <div className="search-spinner" />
                <span>Searching curated packages...</span>
              </div>
            ) : filteredPackages.length > 0 ? (
              <div className="search-packages-grid">
                {filteredPackages.map((pkg) => (
                  <div
                    key={pkg.id || pkg.packageId}
                    className="search-package-card"
                    onClick={() => handlePackageClick(pkg.slug)}
                  >
                    <div className="package-thumb">
                      <img
                        src={pkg.media?.heroImage || '/kashmir-dawn.jpg'}
                        alt={pkg.title}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/kashmir-dawn.jpg';
                        }}
                      />
                    </div>
                    <div className="package-info">
                      <div className="package-badges">
                        <span className="dest-badge">
                          <MapPin size={10} />
                          {pkg.destinationName || 'India'}
                        </span>
                        <span className="duration-badge">
                          <Calendar size={10} />
                          {pkg.durationDays}D / {pkg.durationNights || pkg.durationDays - 1}N
                        </span>
                      </div>
                      <h4 className="package-title">{pkg.title}</h4>
                      <div className="package-footer">
                        <div className="package-price">
                          <strong>₹{Number(pkg.sellingPrice || 0).toLocaleString('en-IN')}</strong>
                          <span>/ person</span>
                        </div>
                        <span className="view-link">
                          View & Book <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="global-search-empty">
                <p>No holiday packages found matching &quot;{searchTerm}&quot;.</p>
                <div className="empty-suggestions">
                  <span>Try searching for:</span>
                  <button type="button" onClick={() => setSearchTerm('Kashmir')}>Kashmir</button>
                  <button type="button" onClick={() => setSearchTerm('Kerala')}>Kerala</button>
                  <button type="button" onClick={() => setSearchTerm('Rajasthan')}>Rajasthan</button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="global-search-footer">
            <span className="footer-tip">
              Tip: Press <kbd>↵ Enter</kbd> to filter on page, or click any package to view full itinerary & hotels.
            </span>
            <button
              type="button"
              className="explore-all-btn"
              onClick={() => {
                onClose();
                window.location.href = '/#curated-packages';
              }}
            >
              Explore All Packages
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
