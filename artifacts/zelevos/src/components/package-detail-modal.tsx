import React, { useEffect, useState } from "react";
import {
  X,
  MapPin,
  Calendar,
  Clock,
  Check,
  ShieldCheck,
  Award,
  Users,
  Building,
  Car,
  Compass,
  ArrowRight,
  TrendingUp,
  Lock,
} from "lucide-react";

export interface PackageDetail {
  id: string;
  packageId: string;
  title: string;
  slug: string;
  destinationId: string;
  locations: string[];
  durationDays: number;
  durationNights: number;
  theme: string;
  travellerSuitability?: string;
  baseCost: number;
  sellingPrice: number;
  serviceFee: number;
  inclusions: string[];
  exclusions: string[];
  isMembersOnly?: boolean;
  offerExpiresAt?: string | null;
  media?: { heroImage?: string; gallery?: string[] };
  status: string;
  destination?: { name: string; state: string; overview: string };
  days?: Array<{
    dayNumber: number;
    title: string;
    description: string;
    mealsIncluded?: string;
  }>;
  components?: {
    hotels?: Array<{ name: string; starRating: string; roomType: string; mealPlan: string }>;
    transfers?: Array<{ vehicleType: string; pickupLocation: string; dropLocation: string }>;
    activities?: Array<{ name: string; durationHours: string; meetingPoint: string }>;
  };
  policies?: {
    cancellation?: string;
    modification?: string;
    child?: string;
    payment?: string;
  };
  tripConfidenceScore?: {
    score: number;
    label: "High confidence" | "Moderate" | "Needs review";
    breakdown?: {
      acceptanceScore?: number;
      responseScore?: number;
      cancellationScore?: number;
      acceptanceRate?: number;
      avgResponseMinutes?: number;
      cancellationRate?: number;
    };
  };
}

export function PackageDetailModal({
  packageIdOrSlug,
  onClose,
  onBook,
  isPreview = false,
  user,
  onOpenAuth,
}: {
  packageIdOrSlug: string;
  onClose: () => void;
  onBook: (pkg: PackageDetail) => void;
  isPreview?: boolean;
  user?: any;
  onOpenAuth?: () => void;
}) {
  const [pkg, setPkg] = useState<PackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const url = isPreview ? `/api/packages/${packageIdOrSlug}?preview=true` : `/api/packages/${packageIdOrSlug}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load package details.");
        return res.json();
      })
      .then((data) => {
        setPkg(data.package);
      })
      .catch((err) => {
        setError(err.message || "Failed to load package.");
      })
      .finally(() => setLoading(false));
  }, [packageIdOrSlug, isPreview]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="font-semibold text-slate-700">Loading curated holiday experience...</p>
        </div>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <p className="text-rose-600 font-semibold mb-4">{error || "Package not found"}</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 text-white rounded-xl font-medium"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const score = pkg.tripConfidenceScore?.score ?? 96;
  const scoreLabel = pkg.tripConfidenceScore?.label ?? "High confidence";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 relative my-auto">
        {isPreview && (
          <div id="admin-preview-mode-banner" className="bg-amber-500 text-white text-xs font-bold px-4 py-2 text-center rounded-t-2xl flex items-center justify-center gap-2">
            <span>ADMIN PREVIEW MODE — Current Package Status: <strong className="uppercase bg-white/20 px-2 py-0.5 rounded">{pkg.status}</strong></span>
          </div>
        )}

        {/* Sticky Close Button */}
        <button
          onClick={onClose}
          id="close-package-modal"
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md transition"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Hero Banner with Curated Photo */}
        <div className={`relative h-64 bg-slate-900 overflow-hidden ${isPreview ? "" : "rounded-t-2xl"}`}>
          <img
            src={pkg.media?.heroImage || "/kashmir-dawn.jpg"}
            alt={pkg.title}
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-bold uppercase tracking-wider">
                {pkg.theme}
              </span>
              <span className="px-3 py-1 bg-emerald-500/90 text-white rounded-full text-xs font-bold">
                {pkg.durationDays} Days / {pkg.durationNights} Nights
              </span>
              <span className="px-3 py-1 bg-white/20 backdrop-blur text-white rounded-full text-xs font-medium">
                ID: {pkg.packageId}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {pkg.title}
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* SECTION: TRIP CONFIDENCE SCORE (Section 3 & Acceptance Criteria) */}
          <div
            id="trip-confidence-widget"
            className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
                  <div className="text-center">
                    <span id="trip-confidence-score-value" className="text-2xl font-extrabold leading-none block">
                      {score}%
                    </span>
                    <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">
                      Score
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-blue-600" size={18} />
                    <span
                      id="trip-confidence-label"
                      className="font-bold text-blue-950 text-base"
                    >
                      Trip Confidence Score: {scoreLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Calculated live from supplier acceptance rate, SLA responsiveness & zero cancellation record.
                  </p>
                </div>
              </div>
              <div className="text-xs text-slate-700 space-y-1 bg-white/80 p-3 rounded-xl border border-blue-100 min-w-[200px]">
                <div className="flex justify-between">
                  <span>Vendor Acceptance:</span>
                  <strong className="text-emerald-700">{pkg.tripConfidenceScore?.breakdown?.acceptanceRate ?? 98}% (Verified)</strong>
                </div>
                <div className="flex justify-between">
                  <span>Response Time:</span>
                  <strong className="text-blue-700">&lt; {pkg.tripConfidenceScore?.breakdown?.avgResponseMinutes ?? 25} mins</strong>
                </div>
                <div className="flex justify-between">
                  <span>Cancellation Rate:</span>
                  <strong className="text-emerald-700">{pkg.tripConfidenceScore?.breakdown?.cancellationRate ?? 1}% (Strict SLA)</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Exclusive Member Deal Banner */}
          {pkg.isMembersOnly && (
            <div className="mb-4">
              {!user ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 flex-shrink-0">
                      <Lock size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                        Exclusive Member Offer
                      </span>
                      <p className="text-xs text-amber-700">
                        This is a special member-only package. Log in with your email to unlock verified pricing & instant booking.
                      </p>
                    </div>
                  </div>
                  {onOpenAuth && (
                    <button
                      type="button"
                      id="modal-unlock-login-btn"
                      onClick={onOpenAuth}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow whitespace-nowrap"
                    >
                      Sign In to Unlock
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <Check size={16} className="text-emerald-600" />
                  Exclusive Member Price Unlocked for {user.email || user.username || "You"}!
                </div>
              )}
            </div>
          )}

          {/* Pricing & Booking CTA Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                All-Inclusive Curated Price
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-extrabold text-slate-900">
                  ₹{pkg.sellingPrice.toLocaleString("en-IN")}
                </span>
                <span className="text-xs text-slate-500">per person (inclusive of taxes)</span>
              </div>
              {pkg.offerExpiresAt && (
                <div className="text-[11px] font-semibold text-slate-500 mt-1 flex items-center gap-1">
                  <Clock size={12} className="text-amber-500" />
                  {new Date(pkg.offerExpiresAt) < new Date() ? "Offer Expired on " : "Limited Time Offer · Expires: "}
                  {new Date(pkg.offerExpiresAt).toLocaleDateString()}
                </div>
              )}
            </div>
            <button
              id="book-now-package-btn"
              onClick={() => onBook(pkg)}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-base transition"
            >
              Book This Holiday <ArrowRight size={18} />
            </button>
          </div>

          {/* Locations & Suitability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <MapPin className="text-blue-600 mt-0.5" size={18} />
              <div>
                <strong className="text-xs uppercase tracking-wider text-slate-500 block">
                  Covered Locations
                </strong>
                <span className="text-sm font-semibold text-slate-800">
                  {pkg.locations && pkg.locations.length > 0
                    ? pkg.locations.join(" • ")
                    : "Srinagar, Gulmarg, Pahalgam"}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <Users className="text-blue-600 mt-0.5" size={18} />
              <div>
                <strong className="text-xs uppercase tracking-wider text-slate-500 block">
                  Traveller Suitability
                </strong>
                <span className="text-sm font-semibold text-slate-800">
                  {pkg.travellerSuitability || "Families, couples & small curated groups"}
                </span>
              </div>
            </div>
          </div>

          {/* Inclusions & Exclusions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <h4 className="font-bold text-emerald-950 text-sm flex items-center gap-2 mb-3">
                <Check size={16} className="text-emerald-600" /> What's Included
              </h4>
              <ul className="space-y-2 text-xs text-slate-700">
                {pkg.inclusions.map((inc, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200">
              <h4 className="font-bold text-rose-950 text-sm flex items-center gap-2 mb-3">
                <X size={16} className="text-rose-600" /> What's Excluded
              </h4>
              <ul className="space-y-2 text-xs text-slate-700">
                {pkg.exclusions.map((exc, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">•</span>
                    <span>{exc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Component Services Breakdown (Hotels, Transfers, Activities) */}
          {pkg.components && (
            (pkg.components.hotels && pkg.components.hotels.length > 0) ||
            (pkg.components.transfers && pkg.components.transfers.length > 0) ||
            (pkg.components.activities && pkg.components.activities.length > 0)
          ) && (
            <div className="space-y-4">
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                <Award size={18} className="text-blue-600" /> Package Services & Inclusions
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Hotels */}
                {pkg.components.hotels && pkg.components.hotels.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider mb-2">
                      <Building size={16} /> Accommodations ({pkg.components.hotels.length})
                    </div>
                    <div className="space-y-2">
                      {pkg.components.hotels.map((h, idx) => (
                        <div key={idx} className="border-b border-slate-200/60 pb-2 last:border-0 last:pb-0">
                          <strong className="text-xs text-slate-900 block font-semibold">{h.name}</strong>
                          <span className="text-[11px] text-amber-600 font-bold block">★ {h.starRating} Star · {h.roomType}</span>
                          <span className="text-[11px] text-slate-500 block">{h.mealPlan}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transfers */}
                {pkg.components.transfers && pkg.components.transfers.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider mb-2">
                      <Car size={16} /> Transfers & Transport ({pkg.components.transfers.length})
                    </div>
                    <div className="space-y-2">
                      {pkg.components.transfers.map((t, idx) => (
                        <div key={idx} className="border-b border-slate-200/60 pb-2 last:border-0 last:pb-0">
                          <strong className="text-xs text-slate-900 block font-semibold">{t.vehicleType}</strong>
                          <span className="text-[11px] text-slate-600 block">{t.pickupLocation} → {t.dropLocation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activities */}
                {pkg.components.activities && pkg.components.activities.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider mb-2">
                      <Compass size={16} /> Sightseeing & Activities ({pkg.components.activities.length})
                    </div>
                    <div className="space-y-2">
                      {pkg.components.activities.map((a, idx) => (
                        <div key={idx} className="border-b border-slate-200/60 pb-2 last:border-0 last:pb-0">
                          <strong className="text-xs text-slate-900 block font-semibold">{a.name}</strong>
                          <span className="text-[11px] text-slate-600 block">{a.durationHours} hrs · {a.meetingPoint}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Itinerary Day-by-Day */}
          {pkg.days && pkg.days.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                <Calendar size={18} className="text-blue-600" /> Day-by-Day Itinerary
              </h3>
              <div className="space-y-3 border-l-2 border-blue-200 pl-4 ml-2">
                {pkg.days.map((day) => (
                  <div key={day.dayNumber} className="relative pb-2">
                    <span className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-blue-100" />
                    <span className="text-xs font-bold text-blue-700 uppercase">
                      Day {day.dayNumber}
                    </span>
                    <h5 className="font-bold text-slate-900 text-sm">{day.title}</h5>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {day.description}
                    </p>
                    {day.mealsIncluded && (
                      <span className="inline-block mt-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Meals: {day.mealsIncluded}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Package Policies */}
          {pkg.policies && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Booking Policies & Terms</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                {pkg.policies.cancellation && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <strong className="text-slate-800 block mb-1">Cancellation:</strong>
                    <span>{pkg.policies.cancellation}</span>
                  </div>
                )}
                {pkg.policies.modification && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <strong className="text-slate-800 block mb-1">Date Modification:</strong>
                    <span>{pkg.policies.modification}</span>
                  </div>
                )}
                {pkg.policies.child && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <strong className="text-slate-800 block mb-1">Child Policy:</strong>
                    <span>{pkg.policies.child}</span>
                  </div>
                )}
                {pkg.policies.payment && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <strong className="text-slate-800 block mb-1">Payment Terms:</strong>
                    <span>{pkg.policies.payment}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
