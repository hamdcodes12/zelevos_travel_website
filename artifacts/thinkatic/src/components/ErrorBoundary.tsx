/**
 * ErrorBoundary — catches JS render errors and shows a graceful fallback.
 * Works as a class component (required by React error boundary API).
 */

import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // In production, send to your error tracking service here:
    // e.g. Sentry.captureException(error, { contexts: { react: errorInfo } });
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-[100dvh] flex items-center justify-center p-6"
          style={{ background: "#FFFFFF" }}
        >
          <div className="max-w-lg w-full text-center">
            {/* Icon */}
            <div
              className="mx-auto mb-8 w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)" }}
            >
              <AlertTriangle size={28} className="text-red-400" aria-hidden="true" />
            </div>

            {/* Heading */}
            <h1 className="font-display font-black text-foreground text-2xl sm:text-3xl mb-3 leading-tight">
              Something went wrong
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed mb-2 max-w-sm mx-auto">
              An unexpected error occurred. This has been logged and we'll look into it.
            </p>

            {/* Error detail — dev only */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4 mb-8 text-left rounded-xl border p-4 max-h-40 overflow-auto"
                style={{ background: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.15)" }}>
                <summary className="text-xs text-red-400 font-mono cursor-pointer mb-2">
                  Error details (dev only)
                </summary>
                <pre className="text-xs text-red-300/70 whitespace-pre-wrap break-all">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-white/25 transition-all"
              >
                <RefreshCw size={14} aria-hidden="true" />
                Try Again
              </button>
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-foreground transition-all"
                style={{ background: "linear-gradient(135deg,#214ECF,#214ECF)", boxShadow: "0 0 20px rgba(71,163,255,0.25)" }}
              >
                <Home size={14} aria-hidden="true" />
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * withErrorBoundary — HOC wrapper for functional components
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  const Wrapped = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `withErrorBoundary(${Component.displayName ?? Component.name})`;
  return Wrapped;
}
