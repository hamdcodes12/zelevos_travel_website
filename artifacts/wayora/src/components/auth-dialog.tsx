import { useState, useEffect } from "react";
import {
  X,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Plane,
  Lock,
  User,
  CheckCircle2,
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

type ProviderStatus = {
  google: { enabled: boolean; message?: string };
  facebook: { enabled: boolean; message?: string };
};

export function AuthDialog({
  initialMode = "login",
  contextNotice = null,
  onClose,
  onAuthenticated,
}: AuthDialogProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderStatus>({
    google: { enabled: false },
    facebook: { enabled: false },
  });

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Fetch available OAuth providers on mount
  useEffect(() => {
    let active = true;
    fetch("/api/auth/providers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setProviders({
            google: { enabled: Boolean(data.google?.enabled), message: data.google?.message },
            facebook: { enabled: Boolean(data.facebook?.enabled), message: data.facebook?.message },
          });
        }
      })
      .catch(() => {
        // Silent fallback
      });
    return () => {
      active = false;
    };
  }, []);

  const handleOAuthClick = (provider: "google" | "facebook") => {
    setError("");
    const provInfo = providers[provider];
    if (!provInfo || !provInfo.enabled) {
      setOauthNotice(
        provider === "google"
          ? "Google OAuth is not configured yet. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend .env to enable real Google Sign-In."
          : "Facebook Login is not configured yet. Please set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in backend .env to enable real Facebook Login."
      );
      return;
    }

    // Real OAuth is configured, initiate redirect
    window.location.href = `/api/auth/${provider}`;
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setError("");
    setOauthNotice(null);

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

      const data = (await response.json()) as { user?: AuthUser; message?: string };

      if (!response.ok || !data.user) {
        throw new Error(data.message || "Authentication request failed. Please try again.");
      }

      onAuthenticated(data.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account action could not be completed.");
    } finally {
      setLoading(false);
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

        {/* Tab switch: [ Log in ] [ Sign up ] (PRIMARY authentication choice at top of modal) */}
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
              setOauthNotice(null);
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
              setOauthNotice(null);
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

        {/* Optional Context Notice (e.g. Flight Booking lock) */}
        {contextNotice && (
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

        {/* Header Titles */}
        <span className="mini-label">
          {mode === "login" ? "WELCOME BACK TO WAYORA" : "JOIN WAYORA TRAVEL"}
        </span>
        <h3 style={{ margin: "6px 0 6px", fontSize: "24px" }}>
          {mode === "login" ? "Log in to your account" : "Create your account"}
        </h3>
        <p style={{ margin: "0 0 18px", color: "var(--muted)", fontSize: "12px" }}>
          {mode === "login"
            ? "Access your saved trips, flight reservations, and traveller graph."
            : "Sign up to book flights, track real-time itineraries, and access private trips."}
        </p>

        {/* Social OAuth Buttons */}
        <div style={{ display: "grid", gap: "9px", marginBottom: "18px" }}>
          <button
            type="button"
            onClick={() => handleOAuthClick("google")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              width: "100%",
              height: "42px",
              padding: "0 14px",
              borderRadius: "9px",
              border: "1px solid var(--border)",
              background: "white",
              color: "var(--text)",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "var(--soft)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "white")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.86c2.26-2.09 3.68-5.17 3.68-9.09z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.37 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.98-3.1z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.61l3.98 3.09c.95-2.85 3.6-4.95 6.73-4.95z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            onClick={() => handleOAuthClick("facebook")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              width: "100%",
              height: "42px",
              padding: "0 14px",
              borderRadius: "9px",
              border: "1px solid var(--border)",
              background: "white",
              color: "var(--text)",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "var(--soft)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "white")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>Continue with Facebook</span>
          </button>
        </div>

        {/* OAuth Information Notice if not configured */}
        {oauthNotice && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              padding: "10px 12px",
              marginBottom: "16px",
              background: "#fffbeb",
              border: "1px solid #fef3c7",
              borderRadius: "8px",
              color: "#92400e",
              fontSize: "11px",
              lineHeight: 1.4,
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>{oauthNotice}</span>
          </div>
        )}

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            margin: "4px 0 16px",
            color: "var(--muted)",
            fontSize: "11px",
          }}
        >
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          <span>or continue with email</span>
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        </div>

        {/* Main Email / Password Form */}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px" }}>
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
              ? "Authenticating..."
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
            setOauthNotice(null);
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
      </div>
    </div>
  );
}
