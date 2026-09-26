import { useState, useEffect, useRef } from "react";
import {
  X,
  ArrowRight,
  Plane,
  Mail,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Lock,
} from "lucide-react";

export type AuthUser = {
  id: string;
  customerId?: string | null;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  authProvider?: string;
  emailVerified?: boolean;
  status?: string;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

interface AuthDialogProps {
  initialMode?: "login" | "signup";
  contextNotice?: string | null;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

export function AuthDialog({
  initialMode = "login",
  contextNotice = null,
  onClose,
  onAuthenticated,
}: AuthDialogProps) {
  const [mode, setMode] = useState<"login" | "signup" | "verify_otp">(initialMode);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // OTP Verification state
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [resending, setResending] = useState(false);
  const [otpInfoMessage, setOtpInfoMessage] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Auto-focus OTP input when entering verify_otp mode
  useEffect(() => {
    if (mode === "verify_otp") {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    }
  }, [mode]);

  const validate = (): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return "Please enter a valid email address.";
    }

    if (password.length < 8) {
      return "Password must be at least 8 characters long.";
    }

    if (mode === "signup") {
      if (fullName.trim().length < 2) {
        return "Please enter your full name (at least 2 characters).";
      }
      if (password !== confirmPassword) {
        return "Passwords do not match. Please re-enter.";
      }
    }

    return null;
  };

  const handleSignupOrLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setError("");
    setSuccessNotice("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload =
        mode === "signup"
          ? { fullName: fullName.trim(), phone: phone.trim() || undefined, email: email.trim(), password, confirmPassword }
          : { email: email.trim(), password };

      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }

      // Check if server asks for OTP verification (on signup or unverified login)
      if (data.status === "otp_sent" || data.status === "email_not_verified") {
        setPendingEmail(data.email || email.trim());
        setMode("verify_otp");
        setOtp("");
        setResendTimer(45);
        if (data.debugOtp) {
          setDebugOtp(data.debugOtp);
        }
        setOtpInfoMessage(
          data.message || `We sent a 6-digit verification code to ${data.email || email.trim()}.`
        );
        return;
      }

      if (!response.ok || !data.user) {
        // Specific error handling
        if (response.status === 409) {
          throw new Error(data.message || "An account with this email is already registered and verified. Please log in.");
        }
        throw new Error(
          data.message ||
          (response.status === 401 ? "Email or password is incorrect." : "Authentication request failed. Please try again.")
        );
      }

      onAuthenticated(data.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account action could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const cleanOtp = otp.trim().replace(/\D/g, "");
    if (cleanOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingEmail || email.trim(),
          otp: cleanOtp,
        }),
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }

      if (!response.ok || !data.user) {
        throw new Error(data.message || "Verification code is invalid or has expired.");
      }

      setSuccessNotice("Email verified successfully! Signing you in...");
      setTimeout(() => {
        onAuthenticated(data.user);
        onClose();
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || resending) return;

    setError("");
    setSuccessNotice("");
    setResending(true);

    try {
      const targetEmail = pendingEmail || email.trim();
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.message || "Failed to resend verification code.");
      }

      setResendTimer(45);
      if (data.debugOtp) {
        setDebugOtp(data.debugOtp);
      }
      setSuccessNotice(`New verification code sent to ${targetEmail}`);
      setTimeout(() => setSuccessNotice(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend verification code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="auth-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="auth-card"
        style={{
          width: "min(100%, 440px)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <button
          className="auth-close"
          type="button"
          aria-label="Close authentication dialog"
          onClick={onClose}
        >
          <X size={17} />
        </button>

        {/* Tab switch: [ Log in ] [ Sign up ] (Hidden when in verify_otp view) */}
        {mode !== "verify_otp" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "var(--soft)",
              padding: "4px",
              borderRadius: "10px",
              marginBottom: contextNotice ? "14px" : "18px",
              border: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              style={{
                padding: "8px 12px",
                border: "none",
                borderRadius: "7px",
                background: mode === "login" ? "white" : "transparent",
                color: mode === "login" ? "var(--text)" : "var(--muted)",
                fontWeight: mode === "login" ? 800 : 600,
                fontSize: "12px",
                boxShadow: mode === "login" ? "0 2px 6px rgba(16,24,40,.08)" : "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
              }}
              style={{
                padding: "8px 12px",
                border: "none",
                borderRadius: "7px",
                background: mode === "signup" ? "white" : "transparent",
                color: mode === "signup" ? "var(--text)" : "var(--muted)",
                fontWeight: mode === "signup" ? 800 : 600,
                fontSize: "12px",
                boxShadow: mode === "signup" ? "0 2px 6px rgba(16,24,40,.08)" : "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Sign up
            </button>
          </div>
        )}

        {/* Optional Context Notice (e.g. Flight Booking lock) */}
        {contextNotice && mode !== "verify_otp" && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "12px 14px",
              marginBottom: "16px",
              background: "#eff4ff",
              border: "1px solid #c7d7fe",
              borderRadius: "10px",
              color: "#1e40af",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            <Plane size={18} style={{ flexShrink: 0, marginTop: "2px", color: "var(--blue)" }} />
            <div>
              <strong style={{ display: "block", marginBottom: "2px", color: "#1e3a8a" }}>
                Flight Booking in Progress
              </strong>
              <span>{contextNotice}</span>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* OTP VERIFICATION VIEW */}
        {/* ------------------------------------------------------------- */}
        {mode === "verify_otp" ? (
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                color: "#2563eb",
                marginBottom: "16px",
                border: "1px solid #bfdbfe",
              }}
            >
              <Mail size={24} />
            </div>

            <span className="mini-label" style={{ color: "#2563eb", fontWeight: 800 }}>
              SECURITY VERIFICATION
            </span>
            <h3 style={{ margin: "6px 0 8px", fontSize: "22px", letterSpacing: "-0.04em" }}>
              Verify your email address
            </h3>
            <p style={{ margin: "0 0 20px", color: "var(--muted)", fontSize: "13px", lineHeight: 1.5 }}>
              We've sent a 6-digit verification code to{" "}
              <strong style={{ color: "#0f172a", wordBreak: "break-all" }}>
                {pendingEmail || email}
              </strong>
              . Enter the code below to complete registration and sign in.
            </p>

            <form onSubmit={handleVerifyOtp} style={{ display: "grid", gap: "16px" }}>
              <div>
                <label style={{ margin: 0, display: "block" }}>
                  <span
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      color: "#344054",
                      fontSize: "11px",
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                    }}
                  >
                    ENTER 6-DIGIT CODE
                  </span>
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtp(val);
                      setError("");
                    }}
                    placeholder="• • • • • •"
                    required
                    style={{
                      width: "100%",
                      height: "54px",
                      padding: "0 16px",
                      border: "2px solid #2563eb",
                      borderRadius: "12px",
                      outline: "none",
                      color: "#1e3a8a",
                      background: "#f8faff",
                      fontSize: "26px",
                      fontWeight: 800,
                      letterSpacing: "14px",
                      textAlign: "center",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      boxShadow: "0 4px 14px rgba(37, 99, 235, 0.12)",
                    }}
                  />
                </label>
              </div>

              {/* Development debug hint if email is sandbox-restricted */}
              {debugOtp && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: "#92400e",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>
                    Sandbox test code: <strong>{debugOtp}</strong>
                  </span>
                </div>
              )}

              {error && (
                <div className="auth-error" role="alert" style={{ margin: 0 }}>
                  {error}
                </div>
              )}

              {successNotice && (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#065f46",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{successNotice}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.trim().length !== 6}
                className="button button-primary"
                style={{
                  width: "100%",
                  height: "46px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontWeight: 800,
                  fontSize: "13px",
                  borderRadius: "10px",
                  opacity: otp.trim().length === 6 && !loading ? 1 : 0.7,
                }}
              >
                {loading ? "Verifying code..." : "Verify & Complete Registration"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            {/* Resend OTP & Change Email options */}
            <div
              style={{
                marginTop: "20px",
                paddingTop: "16px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {resendTimer > 0 ? (
                  <span>
                    Resend code in <strong style={{ color: "#2563eb" }}>{resendTimer}s</strong>
                  </span>
                ) : (
                  <span>
                    Didn't receive the email?{" "}
                    <button
                      type="button"
                      disabled={resending}
                      onClick={handleResendOtp}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#2563eb",
                        fontWeight: 800,
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: 0,
                      }}
                    >
                      {resending ? "Sending..." : "Resend Code"}
                    </button>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setSuccessNotice("");
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--muted)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <RotateCcw size={12} />
                Change email address or back to Sign up
              </button>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* LOGIN & SIGNUP VIEW */
          /* ------------------------------------------------------------- */
          <>
            {/* Header Titles */}
            <span className="mini-label">
              {mode === "login" ? "WELCOME BACK TO ZELEVOS" : "JOIN ZELEVOS TRAVEL"}
            </span>
            <h3 style={{ margin: "6px 0 6px", fontSize: "24px" }}>
              {mode === "login" ? "Log in to your account" : "Create your account"}
            </h3>
            <p style={{ margin: "0 0 18px", color: "var(--muted)", fontSize: "12px" }}>
              {mode === "login"
                ? "Access your saved trips, flight reservations, and traveller graph."
                : "Sign up to book flights, track real-time itineraries, and access private trips."}
            </p>

            {/* Main Email / Password Form */}
            <form onSubmit={handleSignupOrLogin} style={{ display: "grid", gap: "12px" }}>
              {mode === "signup" && (
                <label style={{ margin: 0 }}>
                  <span style={{ display: "block", marginBottom: "6px", color: "#344054", fontSize: "10px", fontWeight: 800 }}>
                    Full Name
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    autoComplete="name"
                    required
                    style={{
                      width: "100%",
                      height: "43px",
                      padding: "0 12px",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      outline: 0,
                      color: "var(--text)",
                      background: "var(--soft)",
                      fontSize: "12px",
                    }}
                  />
                </label>
              )}

              {mode === "signup" && (
                <label style={{ margin: 0 }}>
                  <span style={{ display: "block", marginBottom: "6px", color: "#344054", fontSize: "10px", fontWeight: 800 }}>
                    Phone Number (Optional)
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    autoComplete="tel"
                    style={{
                      width: "100%",
                      height: "43px",
                      padding: "0 12px",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      outline: 0,
                      color: "var(--text)",
                      background: "var(--soft)",
                      fontSize: "12px",
                    }}
                  />
                </label>
              )}

              <label style={{ margin: 0 }}>
                <span style={{ display: "block", marginBottom: "6px", color: "#344054", fontSize: "10px", fontWeight: 800 }}>
                  Email Address
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                  style={{
                    width: "100%",
                    height: "43px",
                    padding: "0 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    outline: 0,
                    color: "var(--text)",
                    background: "var(--soft)",
                    fontSize: "12px",
                  }}
                />
              </label>

              <label style={{ margin: 0 }}>
                <span style={{ display: "block", marginBottom: "6px", color: "#344054", fontSize: "10px", fontWeight: 800 }}>
                  Password (min 8 characters)
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={8}
                  required
                  style={{
                    width: "100%",
                    height: "43px",
                    padding: "0 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    outline: 0,
                    color: "var(--text)",
                    background: "var(--soft)",
                    fontSize: "12px",
                  }}
                />
              </label>

              {mode === "signup" && (
                <label style={{ margin: 0 }}>
                  <span style={{ display: "block", marginBottom: "6px", color: "#344054", fontSize: "10px", fontWeight: 800 }}>
                    Confirm Password
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    style={{
                      width: "100%",
                      height: "43px",
                      padding: "0 12px",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      outline: 0,
                      color: "var(--text)",
                      background: "var(--soft)",
                      fontSize: "12px",
                    }}
                  />
                </label>
              )}

              {error && (
                <div className="auth-error" role="alert" style={{ marginTop: "4px" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="button button-primary"
                style={{
                  width: "100%",
                  marginTop: "8px",
                  height: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontWeight: 800,
                }}
              >
                {loading
                  ? "Processing..."
                  : mode === "login"
                  ? "Log in"
                  : "Create account / Sign up"}
                {!loading && <ArrowRight size={15} />}
              </button>
            </form>

            {/* Bottom Switch Link */}
            <button
              className="auth-switch"
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
              style={{ cursor: "pointer", textAlign: "center", marginTop: "18px" }}
            >
              {mode === "login" ? (
                <>
                  Don't have an account? <strong style={{ textDecoration: "underline" }}>Sign up</strong>
                </>
              ) : (
                <>
                  Already have an account? <strong style={{ textDecoration: "underline" }}>Log in</strong>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
