import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Share2,
  Building2,
  Headset,
} from "lucide-react";
import BrandLogo from "@/components/layout/BrandLogo";

export default function UserAuthPage() {
  const [location, setLocation] = useLocation();
  const isSignupMode = location.includes("signup");
  const [mode, setMode] = useState<"login" | "signup">(isSignupMode ? "signup" : "login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [accountType, setAccountType] = useState<"USER" | "BPO" | "AGENT">("USER");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyDetails, setCompanyDetails] = useState("");
  const [documentDetails, setDocumentDetails] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Check URL params for referral code or agent tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const roleParam = params.get("role") || params.get("type");
    if (ref) {
      setReferralCode(ref);
      setMode("signup");
    }
    if (roleParam?.toLowerCase() === "agent") {
      setAccountType("AGENT");
    } else if (roleParam?.toLowerCase() === "bpo" || roleParam?.toLowerCase() === "partner") {
      setAccountType("BPO");
    }
  }, []);

  const hasCheckedAuthRef = useRef(false);

  // One-time check on mount: If authenticated session and profile are already present, redirect safely once
  useEffect(() => {
    if (hasCheckedAuthRef.current) return;
    hasCheckedAuthRef.current = true;

    // If navigated with logout hint, keep on login page
    const params = new URLSearchParams(window.location.search);
    if (params.get("loggedOut") === "true") {
      return;
    }

    const agentToken = localStorage.getItem("agent_token");
    const userToken = localStorage.getItem("user_token");

    if (!agentToken && !userToken) {
      return;
    }

    let agentProfile: any = null;
    let userProfile: any = null;

    try {
      const rawAgent = localStorage.getItem("agent_profile");
      if (rawAgent) agentProfile = JSON.parse(rawAgent);
    } catch {}

    try {
      const rawUser = localStorage.getItem("user_profile");
      if (rawUser) userProfile = JSON.parse(rawUser);
    } catch {}

    // 1. Check Agent session
    if (agentToken && (agentProfile?.agent_code || agentProfile?.role === "agent")) {
      setLocation("/agent");
      return;
    }

    // 2. Check BPO or Client session
    if (userToken && userProfile) {
      if (
        userProfile.accountType === "BPO" ||
        userProfile.role === "partner" ||
        userProfile.role === "bpo_partner"
      ) {
        setLocation("/partner");
        return;
      }
      if (userProfile.role === "user" || userProfile.accountType === "USER" || userProfile.id) {
        setLocation("/dashboard");
        return;
      }
    }
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      if (mode === "signup" && password !== confirmPassword) {
        setErrorMessage("Passwords do not match. Please verify your password.");
        setLoading(false);
        return;
      }

      const endpoint = accountType === "AGENT"
        ? "/api/agent/auth/login"
        : mode === "signup"
        ? "/api/user/auth/signup"
        : "/api/user/auth/login";

      const payload: Record<string, string> = { email: email.trim().toLowerCase(), password, accountType };
      if (mode === "signup" && accountType !== "AGENT") {
        if (fullName) payload.fullName = fullName;
        if (referralCode) payload.referralCode = referralCode;
        if (accountType === "BPO" && companyName.trim()) {
          payload.companyName = companyName.trim();
        }
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const rawBody = await res.text();
      let data: { success?: boolean; token?: string; profile?: any; agent?: any; message?: string; error?: string } = {};
      if (rawBody.trim()) {
        try {
          data = JSON.parse(rawBody);
        } catch {
          throw new Error(`Authentication service returned an invalid response (${res.status}).`);
        }
      }

      if (!res.ok) {
        throw new Error(data.message || data.error || `Authentication failed (${res.status}). Please check your credentials.`);
      }

      if (!data.token) {
        throw new Error("Authentication service returned an incomplete login response.");
      }

      // Clear previous tokens and profiles to prevent cross-account contamination
      localStorage.removeItem("user_token");
      localStorage.removeItem("user_profile");
      localStorage.removeItem("agent_token");
      localStorage.removeItem("agent_profile");

      let targetRoute = "/dashboard";

      if (accountType === "AGENT" || data.agent) {
        const agentData = { ...(data.agent || data.profile || {}), role: "agent" };
        localStorage.setItem("agent_token", data.token);
        localStorage.setItem("agent_profile", JSON.stringify(agentData));
        targetRoute = "/agent";
      } else {
        localStorage.setItem("user_token", data.token);
        if (data.profile) {
          localStorage.setItem("user_profile", JSON.stringify(data.profile));
        }
        const profile = (data.profile || {}) as { role?: string; accountType?: string };
        if (profile.accountType === "BPO" || profile.role === "partner" || profile.role === "bpo_partner" || accountType === "BPO") {
          targetRoute = "/partner";
        } else {
          targetRoute = "/dashboard";
        }
      }

      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo");
      const selectedPlan = params.get("plan") || params.get("package") || params.get("selectedPackage");
      if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("/login")) {
        const separator = returnTo.includes("?") ? "&" : "?";
        targetRoute = selectedPlan
          ? `${returnTo}${separator}package=${encodeURIComponent(selectedPlan)}`
          : returnTo;
      }

      setSuccessMessage(
        accountType === "AGENT"
          ? "Agent verified! Launching Agent Portal..."
          : mode === "signup" && accountType === "BPO"
          ? "Account created successfully! Launching BPO Partner Dashboard..."
          : mode === "signup"
          ? "Account created successfully! Redirecting..."
          : "Login successful! Redirecting..."
      );

      // Perform one-time transition to authenticated portal
      setLocation(targetRoute);
    } catch (err: any) {
      setErrorMessage(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans"
      style={{
        background: "radial-gradient(circle at 12% 18%, rgba(33,78,207,0.12), transparent 30%), radial-gradient(circle at 88% 82%, rgba(71,163,255,0.10), transparent 32%), #F4F7FF",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{ backgroundImage: "linear-gradient(rgba(33,78,207,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(33,78,207,0.05) 1px, transparent 1px)", backgroundSize: "44px 44px" }}
      />
      <div className="absolute -top-40 -right-32 w-[520px] h-[520px] rounded-full border border-blue-200/40 pointer-events-none" />
      <div className="absolute -bottom-48 -left-40 w-[560px] h-[560px] rounded-full border border-blue-200/30 pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link href="/" className="flex justify-center mb-7">
          <BrandLogo larger />
        </Link>
        <p className="text-center text-[10px] font-mono font-bold uppercase tracking-[0.32em] text-[#214ECF] mb-3">
          {accountType === "AGENT"
            ? "Thinkatic Agent Portal"
            : accountType === "BPO"
            ? "Thinkatic BPO Network"
            : "Thinkatic Enterprise Portal"}
        </p>
        <h2 className="text-center text-3xl sm:text-4xl font-black tracking-tight text-slate-950">
          {accountType === "AGENT"
            ? "Sign in to Agent Portal"
            : mode === "signup"
            ? accountType === "BPO"
              ? "Create BPO Partner Account"
              : "Create Client Account"
            : accountType === "BPO"
            ? "Sign in to BPO Partner Portal"
            : "Sign in to Client Portal"}
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
          {accountType === "AGENT"
            ? "Access your assigned projects, attendance, work activity, productivity, training, documents and support."
            : accountType === "BPO"
            ? "Access your BPO operational centers, agent rosters, contracts, and billing."
            : "Access your enterprise AI projects, attendance, KYC, and wallet."}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/95 py-8 px-6 shadow-[0_24px_70px_rgba(30,64,175,0.14)] sm:rounded-3xl sm:px-10 border border-blue-100/80 backdrop-blur-sm">
          {/* Tabs */}
          <div className="flex gap-1 p-1 mb-7 rounded-2xl bg-slate-100 border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMessage("");
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition-all relative ${
                mode === "login" ? "text-[#214ECF] bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Sign In
              {mode === "login" && (
                <motion.div
                  layoutId="authTab"
                  className="absolute inset-x-3 bottom-0 h-0.5 bg-[#214ECF] rounded-full"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrorMessage("");
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition-all relative ${
                mode === "signup" ? "text-[#214ECF] bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Create Account
              {mode === "signup" && (
                <motion.div
                  layoutId="authTab"
                  className="absolute inset-x-3 bottom-0 h-0.5 bg-[#214ECF] rounded-full"
                />
              )}
            </button>
          </div>

          <div className="mb-7">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">Account Type</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: "USER" as const, label: "Client", icon: User },
                { type: "BPO" as const, label: "BPO Partner", icon: Building2 },
                { type: "AGENT" as const, label: "Agent", icon: Headset },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setAccountType(type);
                    if (type === "AGENT") setMode("login");
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-xl border px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    accountType === type
                      ? "border-[#214ECF] bg-blue-50/80 text-[#214ECF] ring-2 ring-blue-100 shadow-2xs"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[#214ECF]/50 hover:bg-white hover:text-[#214ECF]"
                  }`}
                >
                  <Icon size={16} className={accountType === type ? "text-[#214ECF]" : "text-slate-500"} />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700"
              >
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </motion.div>
            )}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-700"
              >
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {accountType === "AGENT" && mode === "signup" ? (
            <div className="py-6 px-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-[#214ECF]">
                <Headset size={24} />
              </div>
              <h3 className="text-base font-black text-slate-900">BPO Agent Invitation Required</h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                Operational Agent accounts are created and invited directly by your BPO Partner organization.
                Please check your work email for your account activation link, or contact your supervisor.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErrorMessage("");
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#214ECF] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1a3eb3] transition cursor-pointer"
                >
                  Sign In to Agent Portal <ArrowRight size={14} />
                </button>
                <Link
                  href="/become-partner"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Apply as BPO Partner
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 mb-2">
                    Full Name
                  </label>
                  <div className="relative rounded-2xl">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#214ECF]">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alex Johnson"
                      className="block w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#214ECF] focus:bg-white transition-all"
                    />
                  </div>
                </div>
              )}

              {mode === "signup" && accountType === "BPO" && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 mb-2">
                    Company / Centre Name <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <div className="relative rounded-2xl">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#214ECF]">
                      <Building2 size={16} />
                    </div>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Apex Global Solutions"
                      className="block w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#214ECF] focus:bg-white transition-all"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    You can complete your full company, centre, and infrastructure profile inside your BPO Dashboard.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 mb-2">
                  Work Email Address
                </label>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#214ECF]">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={accountType === "AGENT" ? "agent@gmail.com" : "name@company.com"}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#214ECF] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">
                    Password
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (accountType === "AGENT") {
                          setErrorMessage("To reset your agent password, please contact your BPO centre supervisor or partner administrator to issue a reset link.");
                        } else {
                          setErrorMessage("Password reset instructions will be sent to your registered email address.");
                        }
                      }}
                      className="text-[11px] font-semibold text-[#214ECF] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative rounded-2xl">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#214ECF]">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-11 pr-11 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#214ECF] focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-[#214ECF] transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode === "signup" && (
                  <p className="mt-1.5 text-[11px] text-slate-500">Minimum 6 characters</p>
                )}
              </div>

              {mode === "signup" && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative rounded-2xl">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#214ECF]">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-11 pr-11 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#214ECF] focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-[#214ECF] transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Referral Code (Optional) — UI disabled / commented out per spec
              mode === "signup" && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 mb-2">
                    Referral Code (Optional)
                  </label>
                  <div className="relative rounded-2xl">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#214ECF]">
                      <Share2 size={16} />
                    </div>
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      placeholder="THINK-ABC123"
                      className="block w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#214ECF] focus:bg-white transition-all uppercase tracking-wider"
                    />
                  </div>
                </div>
              )
              */}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-2xl shadow-[0_10px_24px_rgba(33,78,207,0.24)] text-sm font-bold text-white bg-[#214ECF] hover:bg-[#1a3eb3] focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-60 transition-all cursor-pointer"
                >
                  {loading ? (
                    <span>Processing...</span>
                  ) : accountType === "AGENT" ? (
                    <>
                      <span>Sign In to Agent Portal</span>
                      <ArrowRight size={16} />
                    </>
                  ) : mode === "signup" ? (
                    <>
                      <span>{accountType === "BPO" ? "Create BPO Partner Account" : "Create Enterprise Account"}</span>
                      <ArrowRight size={16} />
                    </>
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-7 border-t border-slate-100 pt-5 text-center">
            <p className="text-xs text-slate-500">
              {accountType === "AGENT" ? (
                <>
                  Need to activate your agent invitation?{" "}
                  <Link href="/agent/setup-password" className="font-semibold text-[#214ECF] hover:underline">
                    Activate account here
                  </Link>
                </>
              ) : mode === "login" ? (
                <>
                  Don't have an enterprise account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setErrorMessage("");
                    }}
                    className="font-semibold text-[#214ECF] hover:underline cursor-pointer"
                  >
                    Sign up now
                  </button>
                </>
              ) : (
                <>
                  Already registered?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setErrorMessage("");
                    }}
                    className="font-semibold text-[#214ECF] hover:underline cursor-pointer"
                  >
                    Sign in here
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck size={14} className="text-blue-600" />
          <span>Protected by Supabase Row-Level Security & Enterprise Encryption</span>
        </div>
      </div>
    </div>
  );
}
