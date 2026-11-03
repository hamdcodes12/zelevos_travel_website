import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Lock,
  User,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isSuccess) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = (await res.json()) as { token?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("admin_token", data.token!);
      localStorage.setItem("admin_username", data.token ? username : "");

      // Premium success transition: brief card glow & state transition before navigation
      setIsSuccess(true);
      setLoading(false);

      setTimeout(() => {
        setLocation("/admin");
      }, 450);
    } catch {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden px-4 py-8 sm:py-12 select-none"
      style={{
        backgroundImage: "url('/BG Logo/Futuristic-AI-Admin.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Ambient dark & blue overlays for cinematic contrast and text readability */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-slate-950/65 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-slate-950/70 pointer-events-none" />

      {/* Decorative subtle ambient glow ring */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      {/* Premium White / Glass Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={
          isSuccess
            ? { opacity: 0.98, scale: 1.015, y: -4 }
            : { opacity: 1, y: 0, scale: 1 }
        }
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={`w-full max-w-[440px] relative z-10 rounded-3xl bg-white/95 backdrop-blur-2xl p-7 sm:p-9 border transition-all duration-300 ${
          isSuccess
            ? "border-blue-400 shadow-[0_24px_80px_rgba(33,78,207,0.35),0_0_50px_rgba(33,78,207,0.2)]"
            : "border-blue-200/80 shadow-[0_24px_70px_-12px_rgba(15,23,42,0.35),0_0_35px_rgba(33,78,207,0.12)]"
        } ring-1 ring-white/80`}
      >
        {/* Top Header: Official Thinkatic Full Logo */}
        <div className="flex flex-col items-center justify-center mb-5 sm:mb-6">
          <img
            src="/BG Logo/Thinkatic Full Logo.png"
            alt="Thinkatic"
            className="h-9 sm:h-10 w-auto object-contain drop-shadow-xs"
          />
        </div>

        {/* Console Identification & Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50/90 border border-blue-200 text-[#214ECF] text-[10px] font-mono font-bold tracking-[0.2em] uppercase mb-2 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#214ECF]" />
            <span>Secure Operations Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Admin Panel
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Sign in to manage operations, approvals, and platform data
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
          {/* Username / Email Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">
              Username or Email
            </label>
            <div className="relative group">
              <User
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#214ECF] transition-colors duration-200 pointer-events-none"
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="Enter your admin username"
                disabled={loading || isSuccess}
                className="w-full pl-11 pr-4 py-3 sm:py-3.5 rounded-2xl bg-slate-50/90 border border-slate-200 text-slate-900 text-sm font-medium placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-[#214ECF] focus:ring-4 focus:ring-[#214ECF]/10 focus:outline-none transition-all duration-200 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">
              Password
            </label>
            <div className="relative group">
              <Lock
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#214ECF] transition-colors duration-200 pointer-events-none"
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                disabled={loading || isSuccess}
                className="w-full pl-11 pr-11 py-3 sm:py-3.5 rounded-2xl bg-slate-50/90 border border-slate-200 text-slate-900 text-sm font-medium placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-[#214ECF] focus:ring-4 focus:ring-[#214ECF]/10 focus:outline-none transition-all duration-200 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading || isSuccess}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:text-[#214ECF] focus:outline-none transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error Message Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold shadow-2xs"
              >
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Premium Blue Sign In Button */}
          <motion.button
            type="submit"
            disabled={loading || isSuccess}
            whileHover={!loading && !isSuccess ? { scale: 1.015, translateY: -1 } : {}}
            whileTap={!loading && !isSuccess ? { scale: 0.985 } : {}}
            className={`relative w-full mt-2 py-3.5 px-5 rounded-2xl font-bold text-white text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 overflow-hidden shadow-md select-none ${
              isSuccess
                ? "bg-emerald-600 shadow-[0_8px_24px_rgba(5,150,105,0.35)] cursor-default"
                : "bg-gradient-to-r from-[#214ECF] via-[#1E45BF] to-[#17369B] hover:from-[#1b43b8] hover:via-[#193cb0] hover:to-[#142e85] shadow-[0_8px_24px_rgba(33,78,207,0.32)] hover:shadow-[0_12px_30px_rgba(33,78,207,0.42)] active:shadow-[0_4px_12px_rgba(33,78,207,0.25)]"
            } disabled:opacity-75 disabled:cursor-not-allowed`}
          >
            {isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white animate-scale-in" />
                <span>Access Granted · Launching Console...</span>
              </>
            ) : loading ? (
              <>
                <Loader2 className="w-4 h-4 text-white animate-spin" />
                <span>Authenticating Personnel...</span>
              </>
            ) : (
              <>
                <span>Sign In to Admin Panel</span>
                <ArrowRight className="w-4 h-4 text-white/90 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </motion.button>
        </form>

        {/* Security & Confidentiality Footer */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-semibold tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Thinkatic Central Security · Restricted Access</span>
        </div>
      </motion.div>
    </div>
  );
}
