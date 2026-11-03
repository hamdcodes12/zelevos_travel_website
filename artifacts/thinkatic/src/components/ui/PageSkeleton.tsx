/**
 * PageSkeleton — full-page loading skeleton shown while lazy-loaded routes
 * are being fetched. Matches the dark background of the site.
 */

import { motion } from "framer-motion";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className ?? ""}`}
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(33,78,207,0.04) 50%, transparent 100%)",
        }}
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        aria-hidden="true"
      />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div
      className="min-h-[100dvh] w-full"
      style={{ background: "#FFFFFF" }}
      role="status"
      aria-label="Loading page…"
      aria-busy="true"
    >
      {/* Navbar skeleton */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10"
        style={{ height: "68px", background: "rgba(255,255,255,0.95)", borderBottom: "1px solid rgba(33,78,207,0.12)" }}
      >
        <Shimmer className="h-10 w-36" />
        <div className="hidden md:flex items-center gap-4">
          <Shimmer className="h-4 w-16" />
          <Shimmer className="h-4 w-20" />
          <Shimmer className="h-4 w-14" />
          <Shimmer className="h-4 w-12" />
        </div>
        <Shimmer className="h-8 w-32 rounded-full" />
      </div>

      {/* Hero skeleton */}
      <div className="pt-36 px-6 pb-16 max-w-5xl mx-auto">
        <Shimmer className="h-3 w-28 mb-6" />
        <Shimmer className="h-14 w-3/4 mb-4" />
        <Shimmer className="h-14 w-1/2 mb-6" />
        <Shimmer className="h-5 w-2/3 mb-3" />
        <Shimmer className="h-5 w-1/2 mb-10" />
        <div className="flex gap-3">
          <Shimmer className="h-12 w-40 rounded-full" />
          <Shimmer className="h-12 w-36 rounded-full" />
        </div>
      </div>

      {/* Content cards skeleton */}
      <div className="px-6 pb-20 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-6 flex flex-col gap-3"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(33,78,207,0.04)" }}
            >
              <Shimmer className="h-8 w-8 rounded-xl" />
              <Shimmer className="h-5 w-3/4" />
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-5/6" />
              <Shimmer className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>

      {/* Screen-reader announcement */}
      <span className="sr-only">Loading, please wait…</span>
    </div>
  );
}

/**
 * InlineSkeleton — compact shimmer for use within already-loaded pages
 * (e.g. while a section's data is loading).
 */
export function InlineSkeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="status" aria-busy="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer
          key={i}
          className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
