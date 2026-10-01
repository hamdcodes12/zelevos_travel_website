import React, { useState, useEffect } from "react";
import {
  MapPin,
  Calendar,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Heart,
  Check,
  RefreshCw,
  Award,
  Lock,
  Unlock,
  Clock,
} from "lucide-react";

export function CuratedPackagesSection({
  onSelectPackage,
  onOpenBuildMyTrip,
  onToast,
  searchFilter = "",
  user,
  onOpenAuth,
}: {
  onSelectPackage: (packageIdOrSlug: string) => void;
  onOpenBuildMyTrip: () => void;
  onToast: (msg: string) => void;
  searchFilter?: string;
  user?: any;
  onOpenAuth?: () => void;
}) {
  const [packages, setPackages] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [selectedDest, setSelectedDest] = useState<string>("all");
  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [selectedDuration, setSelectedDuration] = useState<string>("all");
  const [selectedBudget, setSelectedBudget] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("featured");
  const [loading, setLoading] = useState(true);

  const travelThemes = [
    { id: "all", label: "All Themes" },
    { id: "honeymoon", label: "Honeymoon" },
    { id: "family", label: "Family" },
    { id: "adventure", label: "Adventure" },
    { id: "luxury", label: "Luxury" },
    { id: "budget", label: "Budget" },
    { id: "weekend", label: "Weekend" },
    { id: "pilgrimage", label: "Pilgrimage" },
  ];

  const loadPackages = async () => {
    setLoading(true);
    try {
      const [pkgsRes, destsRes] = await Promise.all([
        fetch("/api/packages").then((r) => r.json()),
        fetch("/api/destinations").then((r) => r.json()),
      ]);
      setPackages(Array.isArray(pkgsRes.results) ? pkgsRes.results : []);
      setDestinations(
        Array.isArray(destsRes.results)
          ? destsRes.results
          : Array.isArray(destsRes.destinations)
          ? destsRes.destinations
          : []
      );
    } catch (err) {
      onToast("Failed to load curated packages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  useEffect(() => {
    if (searchFilter) {
      setSelectedDest(searchFilter.toLowerCase().trim());
    }
  }, [searchFilter]);

  const filtered = packages
    .filter((pkg) => {
      const matchesDest =
        selectedDest === "all" ||
        pkg.destinationSlug === selectedDest ||
        pkg.destinationName?.toLowerCase().includes(selectedDest.toLowerCase()) ||
        pkg.locations?.some((loc: string) => loc.toLowerCase().includes(selectedDest.toLowerCase()));

      const matchesTheme =
        selectedTheme === "all" ||
        pkg.theme?.toLowerCase().includes(selectedTheme.toLowerCase()) ||
        (pkg.tags && pkg.tags.some((t: string) => t.toLowerCase().includes(selectedTheme.toLowerCase())));

      const matchesDuration =
        selectedDuration === "all" ||
        (selectedDuration === "short" && pkg.durationDays <= 4) ||
        (selectedDuration === "medium" && pkg.durationDays >= 5 && pkg.durationDays <= 7) ||
        (selectedDuration === "long" && pkg.durationDays >= 8);

      const matchesBudget =
        selectedBudget === "all" ||
        (selectedBudget === "under35k" && pkg.sellingPrice < 35000) ||
        (selectedBudget === "35to60k" && pkg.sellingPrice >= 35000 && pkg.sellingPrice <= 60000) ||
        (selectedBudget === "above60k" && pkg.sellingPrice > 60000);

      return matchesDest && matchesTheme && matchesDuration && matchesBudget;
    })
    .sort((a, b) => {
      if (sortBy === "price_asc") return (a.sellingPrice || 0) - (b.sellingPrice || 0);
      if (sortBy === "price_desc") return (b.sellingPrice || 0) - (a.sellingPrice || 0);
      if (sortBy === "duration_asc") return (a.durationDays || 0) - (b.durationDays || 0);
      if (sortBy === "duration_desc") return (b.durationDays || 0) - (a.durationDays || 0);
      return 0;
    });

  return (
    <section id="curated-packages" className="page-shell py-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest mb-1">
            <span className="w-5 h-0.5 bg-blue-600 inline-block" /> Curated Marketplace · Verified Suppliers
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Featured <span className="text-blue-600">Curated Tours</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Every stay, transfer, and excursion verified by Zelevos Operations with dynamic confidence scoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="curated-build-my-trip-btn"
            onClick={onOpenBuildMyTrip}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition"
          >
            <Sparkles size={14} className="text-amber-300" /> Build My Trip
          </button>
        </div>
      </div>

      {/* Travel Themes Filter (PRD Section 7.1) */}
      <div className="mb-4">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Travel Themes
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar">
          {travelThemes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => setSelectedTheme(theme.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                selectedTheme === theme.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      {/* Destination Filter Tabs (PRD Section 7.1) */}
      <div className="mb-6">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Destinations
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-3 no-scrollbar">
          <button
            type="button"
            id="filter-dest-all"
            onClick={() => setSelectedDest("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
              selectedDest === "all"
                ? "bg-slate-900 text-white shadow"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Destinations ({packages.length})
          </button>
          {destinations.map((d) => (
            <button
              key={d.id}
              type="button"
              id={`filter-dest-${d.slug}`}
              onClick={() => setSelectedDest(d.slug)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                selectedDest === d.slug
                  ? "bg-blue-600 text-white shadow"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* Duration, Budget & Sort Filter Controls (PRD Section 20) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
        {/* Duration Filter */}
        <div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar size={13} className="text-blue-600" /> Duration
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "all", label: "All Durations" },
              { id: "short", label: "1–4 Days" },
              { id: "medium", label: "5–7 Days" },
              { id: "long", label: "8+ Days" },
            ].map((dur) => (
              <button
                key={dur.id}
                type="button"
                id={`filter-duration-${dur.id}`}
                onClick={() => setSelectedDuration(dur.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedDuration === dur.id
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {dur.label}
              </button>
            ))}
          </div>
        </div>

        {/* Budget Filter */}
        <div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Award size={13} className="text-emerald-600" /> Budget
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "all", label: "All Budgets" },
              { id: "under35k", label: "< ₹35,000" },
              { id: "35to60k", label: "₹35k–₹60k" },
              { id: "above60k", label: "₹60,000+" },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                id={`filter-budget-${b.id}`}
                onClick={() => setSelectedBudget(b.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedBudget === b.id
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Selector */}
        <div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Sort Packages By
          </div>
          <select
            id="filter-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="featured">Curated Priority</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="duration_asc">Duration: Short to Long</option>
            <option value="duration_desc">Duration: Long to Short</option>
          </select>
        </div>
      </div>

      {/* Packages Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mx-auto mb-2" />
          Loading curated holidays...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-sm bg-slate-50 rounded-2xl border border-slate-200 p-8">
          No packages matching this destination yet. Try another destination or use "Build My Trip".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((pkg) => {
            const score = pkg.tripConfidenceScore?.score ?? 96;
            const scoreLabel = pkg.tripConfidenceScore?.label ?? "High confidence";
            const isMembersOnly = Boolean(pkg.isMembersOnly);
            const isLocked = isMembersOnly && !user;
            const isExpired = pkg.offerExpiresAt && new Date(pkg.offerExpiresAt) < new Date();

            return (
              <div
                key={pkg.id}
                id={`package-card-${pkg.packageId}`}
                onClick={() => {
                  if (isLocked) {
                    if (onOpenAuth) onOpenAuth();
                    else onToast("Please log in with your email to unlock this exclusive deal.");
                  } else {
                    onSelectPackage(pkg.slug || pkg.packageId);
                  }
                }}
                className={`group bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-xl transition duration-200 cursor-pointer flex flex-col ${
                  isLocked
                    ? "border-amber-300 ring-2 ring-amber-400/20 hover:border-amber-500"
                    : isMembersOnly
                    ? "border-emerald-300 hover:border-emerald-500"
                    : "border-slate-200 hover:border-blue-400"
                }`}
              >
                {/* Photo Thumbnail */}
                <div className="relative h-52 bg-slate-900 overflow-hidden">
                  <img
                    src={pkg.media?.heroImage || "/kashmir-dawn.jpg"}
                    alt={pkg.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                    {isMembersOnly && (
                      <span
                        id={`exclusive-badge-${pkg.packageId}`}
                        className={`px-2.5 py-1 text-white text-[11px] font-extrabold rounded-lg shadow-sm flex items-center gap-1.5 ${
                          isLocked
                            ? "bg-gradient-to-r from-amber-500 to-amber-600 animate-pulse"
                            : "bg-gradient-to-r from-emerald-600 to-teal-600"
                        }`}
                      >
                        {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                        {isLocked ? "EXCLUSIVE MEMBER DEAL" : "MEMBER UNLOCKED"}
                      </span>
                    )}
                    {isExpired && (
                      <span className="px-2.5 py-1 bg-red-600/90 text-white text-[11px] font-bold rounded-lg flex items-center gap-1">
                        <Clock size={12} /> Offer Expired
                      </span>
                    )}
                    <span className="px-2.5 py-1 bg-slate-900/80 backdrop-blur text-white text-[11px] font-bold rounded-lg uppercase">
                      {pkg.theme}
                    </span>
                    <span className="px-2.5 py-1 bg-emerald-600/90 text-white text-[11px] font-bold rounded-lg">
                      {pkg.durationDays}D / {pkg.durationNights}N
                    </span>
                  </div>

                  {/* Trip Confidence Score Pill (Crucial acceptance criteria) */}
                  <div
                    id={`package-confidence-pill-${pkg.packageId}`}
                    className="absolute top-3 right-3 px-2.5 py-1 bg-white/95 backdrop-blur text-blue-700 text-[11px] font-extrabold rounded-lg shadow flex items-center gap-1 z-10"
                  >
                    <ShieldCheck size={14} className="text-blue-600" />
                    <span>{score}% Confidence</span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider block">
                      {pkg.destinationName || "India"}
                    </span>
                    <h3 className="text-base font-extrabold text-white leading-snug line-clamp-2">
                      {pkg.title}
                    </h3>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-blue-600 flex-shrink-0" />
                      <span className="truncate">
                        {pkg.locations && pkg.locations.length > 0
                          ? pkg.locations.join(" • ")
                          : "Curated Circuit"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                      <span>Trip Confidence:</span>
                      <strong className="text-blue-700">{scoreLabel} ({score}%)</strong>
                    </div>
                  </div>

                  {/* Price & CTA */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    {isLocked ? (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-amber-600 flex items-center gap-1">
                          <Lock size={10} /> Exclusive Deal
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="blur-[4px] select-none text-slate-400 font-mono font-bold text-base">₹99,999</span>
                          <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Locked
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">Login with Email to unlock</span>
                      </div>
                    ) : isMembersOnly ? (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-600 flex items-center gap-1">
                          <Check size={10} /> Member Price
                        </span>
                        <span className="text-lg font-extrabold text-slate-900">
                          ₹{(pkg.sellingPrice || 0).toLocaleString("en-IN")}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">/ person</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          From
                        </span>
                        <span className="text-lg font-extrabold text-slate-900">
                          ₹{(pkg.sellingPrice || 0).toLocaleString("en-IN")}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">/ person</span>
                      </div>
                    )}

                    {isLocked ? (
                      <button
                        type="button"
                        id={`unlock-package-btn-${pkg.packageId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenAuth) {
                            onOpenAuth();
                          } else {
                            onToast("Please log in with your email to view this exclusive member deal.");
                          }
                        }}
                        className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition transform hover:-translate-y-0.5"
                      >
                        <Lock size={13} /> Unlock with Email
                      </button>
                    ) : (
                      <button
                        type="button"
                        id={`view-package-btn-${pkg.packageId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPackage(pkg.slug || pkg.packageId);
                        }}
                        className={`px-3.5 py-2 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1 transition ${
                          isMembersOnly
                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                            : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        {isMembersOnly ? "View Member Deal" : "View & Book"} <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
