import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

export default function AgentActivationPage() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ agentCode: string; email: string } | null>(null);

  useEffect(() => {
    // Extract token from URL query string
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    if (urlToken) {
      setToken(urlToken);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token.trim()) {
      setError("An invitation or activation token is required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters in length.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/agent/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Account activation failed. The link may have expired.");
        setLoading(false);
        return;
      }

      // Auto-store session token and show success state
      if (data.token) {
        localStorage.setItem("user_token", data.token);
        localStorage.setItem("agent_token", data.token);
      }
      if (data.agent) {
        localStorage.setItem("agent_profile", JSON.stringify(data.agent));
      }

      setSuccess({
        agentCode: data.agent?.agent_code || "THK-AGT-AGENT",
        email: data.agent?.email || "",
      });
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-[#214ECF]">
      {/* Top Header */}
      <header className="w-full border-b border-slate-200 bg-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/Thinkatic.png"
              alt="Thinkatic Logo"
              width={32}
              height={32}
              className="w-8 h-8 max-w-[32px] max-h-[32px] object-contain flex-shrink-0"
              style={{ width: "32px", height: "32px", maxWidth: "32px", maxHeight: "32px" }}
            />
            <span className="hidden sm:inline-block text-xs font-semibold uppercase tracking-wider text-slate-400 border-l border-slate-200 pl-3">
              Account Activation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-[#214ECF] border border-blue-200/60">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure Onboarding
            </span>
          </div>
        </div>
      </header>

      {/* Main Activation Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 p-8 sm:p-10">
            {success ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-5 ring-8 ring-emerald-50/50">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Account Activated!</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Your Thinkatic Agent credentials have been configured. You are ready to access your assigned campaigns and portal.
                </p>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left mb-6 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Agent ID:</span>
                    <span className="font-mono font-bold text-slate-900">{success.agentCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Login Email:</span>
                    <span className="font-medium text-slate-900">{success.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account Status:</span>
                    <span className="font-semibold text-emerald-600">Active</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setLocation("/agent")}
                  className="w-full py-3 px-4 rounded-xl bg-[#214ECF] hover:bg-blue-700 text-white font-medium text-sm shadow-md shadow-blue-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Enter Agent Portal
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mx-auto mb-4 ring-8 ring-blue-50/50">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Activate Your Account</h1>
                  <p className="text-sm text-slate-500 mt-1.5">
                    Set up your secure password to complete your profile
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
                    <div className="flex-1 font-medium">{error}</div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {!token && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                        Invitation Token
                      </label>
                      <input
                        type="text"
                        required
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Paste invitation token here"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                      New Password (min 6 characters)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#214ECF]/20 focus:border-[#214ECF]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-[#214ECF] hover:bg-blue-700 text-white font-medium text-sm shadow-md shadow-blue-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Set Password & Activate Account
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-500">
                    Already activated your account?{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/agent/login")}
                      className="font-medium text-[#214ECF] hover:underline"
                    >
                      Sign In Here
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </main>

      <footer className="w-full border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
        Thinkatic Enterprise BPO Platform • Account Activation Portal
      </footer>
    </div>
  );
}
