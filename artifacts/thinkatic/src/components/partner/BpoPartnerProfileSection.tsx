import { useEffect, useState } from "react";
import { User, Building2, Phone, Mail, RefreshCw, AlertCircle, ShieldCheck } from "lucide-react";

interface ProfileData {
  partnerName: string;
  centreName: string;
  mobileNumber: string;
  email: string;
  partner_code?: string | null;
  status?: string | null;
}

interface BpoPartnerProfileSectionProps {
  api: (path: string, options?: RequestInit) => Promise<Response>;
}

export default function BpoPartnerProfileSection({ api }: BpoPartnerProfileSectionProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // Authoritative authenticated profile endpoint (strict tenant isolation, real database data)
      const res = await api("/bpo/profile");
      if (!res.ok) {
        // Fallback to /partner/profile if necessary
        const fallbackRes = await api("/partner/profile");
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          setProfile({
            partnerName: data.contact_name || data.partnerName || data.name || "BPO Partner",
            centreName: data.company_name || data.centreName || data.name || "Primary BPO Centre",
            mobileNumber: data.phone || data.mobileNumber || "",
            email: data.email || "",
            partner_code: data.partner_code || null,
            status: data.status || "active",
          });
          return;
        }
        throw new Error("Unable to load profile data");
      }
      const data = await res.json();
      setProfile({
        partnerName: data.partnerName || data.contact_name || data.name || "BPO Partner",
        centreName: data.centreName || data.company_name || data.name || "Primary BPO Centre",
        mobileNumber: data.mobileNumber || data.phone || "",
        email: data.email || "",
        partner_code: data.partner_code || null,
        status: data.status || "active",
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load partner profile");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── SECTION HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#214ECF]">
              Account Profile
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <ShieldCheck size={11} className="text-emerald-600" />
              Verified Identity
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Profile
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Authenticated enterprise credentials and registered delivery contact information.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => void fetchProfile(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:border-[#214ECF]/30 hover:text-[#214ECF] hover:bg-blue-50/50 transition cursor-pointer disabled:opacity-50"
            title="Refresh profile details"
          >
            <RefreshCw size={14} className={`text-[#214ECF] ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── ERROR ALERT ────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchProfile()}
            className="rounded-lg bg-white border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100/50 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── LOADING SKELETON ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-6">
          {/* Header Card Skeleton */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs animate-pulse">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-200 shrink-0" />
              <div className="space-y-2.5 flex-1">
                <div className="h-4 w-24 bg-slate-200 rounded-full" />
                <div className="h-7 w-56 bg-slate-200 rounded-lg" />
                <div className="h-4 w-44 bg-slate-200 rounded" />
              </div>
            </div>
          </div>

          {/* Details Card Skeleton */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs animate-pulse">
            <div className="h-5 w-32 bg-slate-200 rounded mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-20 bg-slate-200 rounded" />
                    <div className="h-5 w-40 bg-slate-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : profile ? (
        <div className="space-y-6">
          {/* ── PREMIUM PROFILE HEADER CARD ──────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
              {/* Profile / Avatar Icon with brand styling */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-50/90 border border-blue-100 flex items-center justify-center text-[#214ECF] shrink-0 select-none shadow-2xs">
                <User size={32} className="text-[#214ECF]" strokeWidth={2.2} />
              </div>

              {/* Partner Name, BPO Partner badge, and Centre / Company */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#214ECF] select-none">
                    BPO Partner
                  </span>
                  {profile.partner_code && (
                    <span className="font-mono text-[11px] font-semibold text-slate-500 select-none">
                      {profile.partner_code}
                    </span>
                  )}
                </div>

                {/* Partner Name prominently displayed */}
                <h2 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight break-words">
                  {profile.partnerName}
                </h2>

                {/* Centre / Company Name below */}
                <p className="mt-1 text-sm sm:text-base font-semibold text-slate-600 break-words flex items-center gap-1.5">
                  <Building2 size={15} className="text-[#214ECF] shrink-0" strokeWidth={2} />
                  <span>{profile.centreName}</span>
                </p>
              </div>
            </div>
          </div>

          {/* ── DETAILS SECTION CARD ────────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-2xs">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Partner Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* 1. Partner Name */}
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50/90 border border-blue-100 flex items-center justify-center text-[#214ECF] shrink-0 select-none">
                  <User size={20} className="text-[#214ECF]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Partner Name
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900 break-words">
                    {profile.partnerName}
                  </p>
                </div>
              </div>

              {/* 2. Centre / Company Name */}
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50/90 border border-blue-100 flex items-center justify-center text-[#214ECF] shrink-0 select-none">
                  <Building2 size={20} className="text-[#214ECF]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Centre / Company
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900 break-words">
                    {profile.centreName}
                  </p>
                </div>
              </div>

              {/* 3. Mobile / Contact Number */}
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50/90 border border-blue-100 flex items-center justify-center text-[#214ECF] shrink-0 select-none">
                  <Phone size={20} className="text-[#214ECF]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Mobile Number
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900 break-words font-mono">
                    {profile.mobileNumber || "Not provided"}
                  </p>
                </div>
              </div>

              {/* 4. Work Email / Gmail */}
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50/90 border border-blue-100 flex items-center justify-center text-[#214ECF] shrink-0 select-none">
                  <Mail size={20} className="text-[#214ECF]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Email Address
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900 break-words font-mono">
                    {profile.email || "Not provided"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
