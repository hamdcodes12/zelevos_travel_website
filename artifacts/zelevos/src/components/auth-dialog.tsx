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
  KeyRound,
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

export type AuthDialogMode =
  | "login"
  | "signup"
  | "verify_otp"
  | "forgot_password"
  | "reset_otp"
  | "new_password"
  | "reset_success";

interface AuthDialogProps {
  initialMode?: "login" | "signup" | "forgot_password";
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
  const [mode, setMode] = useState<AuthDialogMode>(initialMode);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Registration OTP Verification state
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [resending, setResending] = useState(false);
  const [otpInfoMessage, setOtpInfoMessage] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  // Forgot Password / Password Reset state
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetOtpTimer, setResetOtpTimer] = useState(0); // 10-minute expiry countdown
  const [resetResendTimer, setResetResendTimer] = useState(0); // 60s cooldown timer
  const [resetResending, setResetResending] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  const otpInputRef = useRef<HTMLInputElement>(null);
  const resetOtpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Countdown timer for registration OTP resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Countdown timer for Password Reset Resend cooldown (60s)
  useEffect(() => {
    if (resetResendTimer <= 0) return;
    const interval = setInterval(() => {
      setResetResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resetResendTimer]);

  // Countdown timer for Password Reset OTP validity (10m = 600s)
  useEffect(() => {
    if (resetOtpTimer <= 0) return;
    const interval = setInterval(() => {
      setResetOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resetOtpTimer]);

  // Auto-focus OTP inputs when entering respective OTP modes
  useEffect(() => {
    if (mode === "verify_otp") {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    } else if (mode === "reset_otp") {
      setTimeout(() => {
        resetOtpInputRef.current?.focus();
      }, 100);
    }
  }, [mode]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

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
        setDebugOtp(data.debugOtp || "");
        setOtpInfoMessage(
          data.message || `We sent a 6-digit verification code to ${data.email || email.trim()}.`
        );
        return;
      }

      if (!response.ok || !data.user) {
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
      setDebugOtp(data.debugOtp || "");
      setSuccessNotice(`New verification code sent to ${targetEmail}`);
      setTimeout(() => setSuccessNotice(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend verification code.");
    } finally {
      setResending(false);
    }
  };

  // --- PASSWORD RESET HANDLERS ---

  const handleSendResetOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const targetEmail = forgotEmail.trim();
    if (!emailRegex.test(targetEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setSuccessNotice("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/password/forgot", {
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
        throw new Error(data.message || "Unable to send verification code. Please try again.");
      }

      setMode("reset_otp");
      setResetOtp("");
      setResetResendTimer(60);
      setResetOtpTimer(600); // 10 minutes
      setDebugOtp(data.debugOtp || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const cleanOtp = resetOtp.trim().replace(/\D/g, "");
    if (cleanOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/password/verify-otp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim(),
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

      if (!response.ok || !data.resetToken) {
        throw new Error(data.message || "The verification code is invalid or expired.");
      }

      setResetToken(data.resetToken);
      setMode("new_password");
      setNewPassword("");
      setConfirmNewPassword("");
      setError("");
      setSuccessNotice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The verification code is invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetOtp = async () => {
    if (resetResendTimer > 0 || resetResending) return;

    setError("");
    setSuccessNotice("");
    setResetResending(true);

    try {
      const response = await fetch("/api/auth/password/resend-otp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not resend verification code.");
      }

      setResetResendTimer(60);
      setResetOtpTimer(600);
      setDebugOtp(data.debugOtp || "");
      setSuccessNotice(`Verification code sent to ${forgotEmail.trim()}`);
      setTimeout(() => setSuccessNotice(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend verification code.");
    } finally {
      setResetResending(false);
    }
  };

  const handleSetNewPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetToken,
          password: newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.message || "Your password could not be updated. Please try again.");
      }

      setMode("reset_success");
      setError("");
      setSuccessNotice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your password could not be updated. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isAuthTabVisible = mode === "login" || mode === "signup";

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

        {/* Tab switch: [ Log in ] [ Sign up ] (Visible only on login / signup screens) */}
        {isAuthTabVisible && (
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
              id="auth-tab-login"
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
              id="auth-tab-signup"
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
        {contextNotice && isAuthTabVisible && (
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

        {/* ============================================================= */}
        {/* VIEW 1: FORGOT PASSWORD (Enter Registered Email) */}
        {/* ============================================================= */}
        {mode === "forgot_password" && (
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
              <KeyRound size={22} />
            </div>

            <span className="mini-label" style={{ color: "#2563eb", fontWeight: 800 }}>
              ACCOUNT RECOVERY
            </span>
            <h3 style={{ margin: "6px 0 8px", fontSize: "22px", letterSpacing: "-0.04em" }}>
              Forgot your password?
            </h3>
            <p style={{ margin: "0 0 20px", color: "var(--muted)", fontSize: "13px", lineHeight: 1.5 }}>
              Enter the email address associated with your Zelevos account.
            </p>

            <form onSubmit={handleSendResetOtp} style={{ display: "grid", gap: "14px" }}>
              <label style={{ margin: 0 }}>
                <span style={{ display: "block", marginBottom: "6px", color: "#344054", fontSize: "11px", fontWeight: 800 }}>
                  Email Address
                </span>
                <input
                  id="forgot-email-input"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => {
                    setForgotEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    outline: 0,
                    color: "var(--text)",
                    background: "var(--soft)",
                    fontSize: "13px",
                  }}
                />
              </label>

              {error && (
                <div className="auth-error" role="alert" style={{ margin: 0 }}>
                  {error}
                </div>
              )}

              <button
                id="send-otp-btn"
                type="submit"
                disabled={loading || !forgotEmail.trim()}
                className="button button-primary"
                style={{
                  width: "100%",
                  height: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontWeight: 800,
                  fontSize: "13px",
                  borderRadius: "10px",
                  marginTop: "4px",
                }}
              >
                {loading ? "Sending OTP..." : "Send OTP"}
                {!loading && <ArrowRight size={15} />}
              </button>
            </form>

            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <button
                id="back-to-login-from-forgot"
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setSuccessNotice("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#2563eb",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 8px",
                }}
              >
                <RotateCcw size={13} />
                Back to Login
              </button>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* VIEW 2: VERIFY PASSWORD RESET OTP */}
        {/* ============================================================= */}
        {mode === "reset_otp" && (
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
              Verify your email
            </h3>
            <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "13px", lineHeight: 1.5 }}>
              We sent a 6-digit verification code to{" "}
              <strong style={{ color: "#0f172a", wordBreak: "break-all" }}>{forgotEmail}</strong>.
            </p>

            <form onSubmit={handleVerifyResetOtp} style={{ display: "grid", gap: "16px" }}>
              <div>
                <label style={{ margin: 0, display: "block" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span
                      style={{
                        color: "#344054",
                        fontSize: "11px",
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                      }}
                    >
                      ENTER 6-DIGIT CODE
                    </span>
                    {resetOtpTimer > 0 && (
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        Expires in <strong style={{ color: "#2563eb" }}>{formatTimer(resetOtpTimer)}</strong>
                      </span>
                    )}
                  </div>
                  <input
                    id="reset-otp-input"
                    ref={resetOtpInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={resetOtp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setResetOtp(val);
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
                id="verify-reset-otp-btn"
                type="submit"
                disabled={loading || resetOtp.trim().length !== 6}
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
                  opacity: resetOtp.trim().length === 6 && !loading ? 1 : 0.7,
                }}
              >
                {loading ? "Verifying..." : "Verify OTP"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            {/* Resend OTP, Change Email & Back to Login */}
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
                {resetResendTimer > 0 ? (
                  <span>
                    Resend OTP in <strong style={{ color: "#2563eb" }}>{resetResendTimer}s</strong>
                  </span>
                ) : (
                  <span>
                    Didn't receive the code?{" "}
                    <button
                      id="resend-reset-otp-btn"
                      type="button"
                      disabled={resetResending}
                      onClick={handleResendResetOtp}
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
                      {resetResending ? "Sending..." : "Resend OTP"}
                    </button>
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot_password");
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
                  Change email
                </button>
                <span style={{ color: "var(--border)" }}>•</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
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
                  }}
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* VIEW 3: CREATE NEW PASSWORD */}
        {/* ============================================================= */}
        {mode === "new_password" && (
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
              <Lock size={22} />
            </div>

            <span className="mini-label" style={{ color: "#2563eb", fontWeight: 800 }}>
              NEW CREDENTIALS
            </span>
            <h3 style={{ margin: "6px 0 8px", fontSize: "22px", letterSpacing: "-0.04em" }}>
              Create a new password
            </h3>
            <p style={{ margin: "0 0 20px", color: "var(--muted)", fontSize: "13px", lineHeight: 1.5 }}>
              Choose a secure password of at least 8 characters.
            </p>

            <form onSubmit={handleSetNewPassword} style={{ display: "grid", gap: "14px" }}>
              <label style={{ margin: 0 }}>
                <span style={{ display: "block", marginBottom: "6px", color: "#344054", fontSize: "11px", fontWeight: 800 }}>
                  New Password
                </span>
                <input
                  id="new-password-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    outline: 0,
                    color: "var(--text)",
                    background: "var(--soft)",
                    fontSize: "13px",
                  }}
                />
              </label>

              <label style={{ margin: 0 }}>
                <span style={{ display: "block", marginBottom: "6px", color: "#344054", fontSize: "11px", fontWeight: 800 }}>
                  Confirm New Password
                </span>
                <input
                  id="confirm-new-password-input"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => {
                    setConfirmNewPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    outline: 0,
                    color: "var(--text)",
                    background: "var(--soft)",
                    fontSize: "13px",
                  }}
                />
              </label>

              {/* Password Requirements Checklist */}
              <div
                style={{
                  padding: "10px 12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "11px",
                  color: "#64748b",
                  display: "grid",
                  gap: "4px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: newPassword.length >= 8 ? "#16a34a" : "#64748b" }}>
                  <span>{newPassword.length >= 8 ? "✓" : "○"}</span>
                  <span>Minimum 8 characters</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: newPassword.length >= 8 && newPassword === confirmNewPassword ? "#16a34a" : "#64748b" }}>
                  <span>{newPassword.length >= 8 && newPassword === confirmNewPassword ? "✓" : "○"}</span>
                  <span>Passwords match</span>
                </div>
              </div>

              {error && (
                <div className="auth-error" role="alert" style={{ margin: 0 }}>
                  {error}
                </div>
              )}

              <button
                id="reset-password-submit-btn"
                type="submit"
                disabled={loading || newPassword.length < 8 || newPassword !== confirmNewPassword}
                className="button button-primary"
                style={{
                  width: "100%",
                  height: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontWeight: 800,
                  fontSize: "13px",
                  borderRadius: "10px",
                  marginTop: "4px",
                }}
              >
                {loading ? "Updating..." : "Reset Password"}
                {!loading && <ArrowRight size={15} />}
              </button>
            </form>
          </div>
        )}

        {/* ============================================================= */}
        {/* VIEW 4: PASSWORD RESET SUCCESS */}
        {/* ============================================================= */}
        {mode === "reset_success" && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
                color: "#059669",
                marginBottom: "20px",
                border: "1px solid #a7f3d0",
              }}
            >
              <CheckCircle2 size={30} />
            </div>

            <span className="mini-label" style={{ color: "#059669", fontWeight: 800 }}>
              ALL SET
            </span>
            <h3 style={{ margin: "8px 0 10px", fontSize: "24px", letterSpacing: "-0.04em" }}>
              Password Reset Successful
            </h3>
            <p style={{ margin: "0 0 24px", color: "var(--muted)", fontSize: "13px", lineHeight: 1.6 }}>
              Your Zelevos password has been updated successfully.
            </p>

            <button
              id="continue-to-login-btn"
              type="button"
              onClick={() => {
                setEmail(forgotEmail);
                setPassword("");
                setConfirmPassword("");
                setMode("login");
                setError("");
                setSuccessNotice("Password updated! Please log in with your new password.");
              }}
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
              }}
            >
              Continue to Login
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* ============================================================= */}
        {/* VIEW 5: REGISTRATION EMAIL OTP VERIFICATION */}
        {/* ============================================================= */}
        {mode === "verify_otp" && (
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
        )}

        {/* ============================================================= */}
        {/* VIEW 6: STANDARD LOGIN & SIGNUP */}
        {/* ============================================================= */}
        {(mode === "login" || mode === "signup") && (
          <>
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

            {successNotice && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#065f46",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <CheckCircle2 size={16} />
                <span>{successNotice}</span>
              </div>
            )}

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
                  id="login-email-input"
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ color: "#344054", fontSize: "10px", fontWeight: 800 }}>
                    Password (min 8 characters)
                  </span>
                  {mode === "login" && (
                    <button
                      id="forgot-password-link"
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setMode("forgot_password");
                        setError("");
                        setSuccessNotice("");
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "#2563eb",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="login-password-input"
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
                id="login-submit-btn"
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
