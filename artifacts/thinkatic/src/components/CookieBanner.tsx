/**
 * CookieBanner — GDPR-compliant cookie consent banner.
 * Stores consent in localStorage. No external libraries.
 * Only loads analytics after explicit consent.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X, SlidersHorizontal, Shield, ShieldCheck, Check } from "lucide-react";
import { Link } from "wouter";

const STORAGE_KEY = "thinkatic_cookie_consent";
const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

export type ConsentState = "pending" | "accepted" | "declined" | "partial";

export interface CookiePreferences {
  necessary: true;     // always true — cannot be toggled
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

function getStoredConsent(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CookiePreferences) : null;
  } catch {
    return null;
  }
}

function storeConsent(prefs: CookiePreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

export function useConsentState() {
  const stored = getStoredConsent();
  return {
    hasConsented: stored !== null,
    consent: stored,
    acceptAll: () => {
      const prefs: CookiePreferences = { necessary: true, analytics: true, marketing: true, preferences: true };
      storeConsent(prefs);
      return prefs;
    },
    declineAll: () => {
      const prefs: CookiePreferences = { necessary: true, analytics: false, marketing: false, preferences: false };
      storeConsent(prefs);
      return prefs;
    },
  };
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
  });

  useEffect(() => {
    // Small delay so it doesn't pop instantly on page load
    const t = setTimeout(() => {
      if (!getStoredConsent()) setVisible(true);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  // Keyboard accessibility: Close on Escape key
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDecline();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible]);

  const handleAcceptAll = () => {
    const full: CookiePreferences = { necessary: true, analytics: true, marketing: true, preferences: true };
    storeConsent(full);
    setPrefs(full);
    setVisible(false);
    // Fire analytics init if accepted
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: full }));
  };

  const handleDecline = () => {
    const minimal: CookiePreferences = { necessary: true, analytics: false, marketing: false, preferences: false };
    storeConsent(minimal);
    setVisible(false);
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: minimal }));
  };

  const handleSavePrefs = () => {
    storeConsent(prefs);
    setVisible(false);
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: prefs }));
  };

  const toggle = (key: keyof Omit<CookiePreferences, "necessary">) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-title"
          aria-describedby="cookie-desc"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleDecline();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.24, ease }}
            className="relative w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/70 bg-[#0c1322] p-5 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] text-left"
            style={{
              background: "linear-gradient(180deg, #0f172a 0%, #0a0f1e 100%)",
            }}
          >
            {/* Subtle ambient glow in top-left */}
            <div className="pointer-events-none absolute -top-20 -left-20 h-40 w-40 rounded-full bg-[#214ECF]/20 blur-3xl" />

            {/* Header */}
            <div className="relative flex items-center justify-between gap-3 mb-3.5">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#214ECF]/30 bg-[#214ECF]/15 text-[#47a3ff] shadow-[0_0_12px_rgba(33,78,207,0.25)]"
                >
                  <Cookie className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="cookie-title" className="text-base font-bold tracking-tight text-white">
                    Cookie Preferences
                  </h2>
                  <span className="text-[11px] font-medium text-slate-400">
                    Privacy & Data Governance
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDecline}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700/60 bg-slate-800/50 text-slate-400 transition-all duration-150 hover:border-slate-500 hover:bg-slate-700/60 hover:text-white focus:outline-hidden focus:ring-2 focus:ring-[#214ECF]/50 active:scale-95 cursor-pointer"
                aria-label="Close cookie preferences"
              >
                <X className="h-4 w-4 shrink-0" />
              </button>
            </div>

            {/* Description */}
            <p id="cookie-desc" className="relative text-xs text-slate-300 leading-relaxed mb-4">
              We use cookies to improve your experience. Essential cookies are always active.{" "}
              <Link
                href="/legal/cookie-policy"
                className="font-medium text-[#7db4ff] underline underline-offset-2 hover:text-white transition-colors"
              >
                Learn more
              </Link>
            </p>

            {/* Expanded Preferences Drawer */}
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease }}
                  className="overflow-hidden mb-4"
                >
                  <div className="flex flex-col gap-2.5 rounded-xl border border-slate-700/50 bg-slate-900/60 p-3.5">
                    {([
                      { key: "necessary" as const, label: "Necessary", desc: "Core site functionality. Always active.", locked: true as const },
                      { key: "analytics" as const, label: "Analytics", desc: "Usage metrics to improve performance.", locked: false as const },
                      { key: "marketing" as const, label: "Marketing", desc: "Personalised services & announcements.", locked: false as const },
                      { key: "preferences" as const, label: "Preferences", desc: "Remember language and display settings.", locked: false as const },
                    ] as const).map(({ key, label, desc, locked }) => (
                      <div key={key} className="flex items-start justify-between gap-3 py-1">
                        <div className="flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-200">{label}</span>
                            {locked && (
                              <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 border border-slate-700">
                                Required
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{desc}</p>
                        </div>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            if (!locked) toggle(key as "analytics" | "marketing" | "preferences");
                          }}
                          role="switch"
                          aria-checked={prefs[key]}
                          aria-label={`${label} cookies`}
                          className="relative shrink-0 mt-0.5 flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-hidden focus:ring-2 focus:ring-[#214ECF]/50"
                          style={{
                            background: prefs[key] ? "#214ECF" : "rgba(51, 65, 85, 0.7)",
                            boxShadow: prefs[key] ? "0 0 10px rgba(33,78,207,0.4)" : "none",
                          }}
                        >
                          <span
                            className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200"
                            style={{ transform: prefs[key] ? "translateX(18px)" : "translateX(3px)" }}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions Hierarchy */}
            <div className="relative flex flex-col gap-2.5">
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="group flex flex-1 h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 text-xs font-semibold text-slate-200 transition-all duration-150 hover:border-slate-500 hover:bg-slate-800 hover:text-white active:scale-98 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#214ECF]/40"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-200 transition-colors" />
                  <span>{showDetails ? "Hide" : "Preferences"}</span>
                </button>
                {showDetails ? (
                  <button
                    type="button"
                    onClick={handleSavePrefs}
                    className="group flex flex-1 h-11 items-center justify-center gap-2 rounded-xl border border-[#214ECF]/60 bg-[#214ECF]/20 px-4 text-xs font-semibold text-[#8fc1ff] transition-all duration-150 hover:bg-[#214ECF]/30 hover:border-[#214ECF] hover:text-white active:scale-98 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#214ECF]/40"
                  >
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    <span>Save Choices</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDecline}
                    className="group flex flex-1 h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 text-xs font-semibold text-slate-200 transition-all duration-150 hover:border-rose-900/50 hover:bg-rose-950/20 hover:text-rose-200 active:scale-98 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-rose-500/40"
                  >
                    <Shield className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-rose-300 transition-colors" />
                    <span>Decline</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="group flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-[#214ECF] px-5 text-xs font-bold text-white shadow-[0_0_24px_rgba(33,78,207,0.35)] border border-[#3768f5] transition-all duration-150 hover:bg-[#1b43b8] hover:shadow-[0_0_28px_rgba(33,78,207,0.5)] active:scale-[0.99] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#214ECF]"
              >
                <Check className="h-4 w-4 stroke-[2.5] shrink-0 text-white/95 group-hover:scale-110 transition-transform duration-150" />
                <span>Accept All</span>
              </button>
            </div>

            {/* Trust Note */}
            <div className="relative flex items-center justify-center gap-1.5 pt-3.5 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
              <span>GDPR compliant · Data never sold</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
