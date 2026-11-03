import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;
const apiTarget = process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? "4317"}`;
const basePath = process.env.BASE_PATH ?? "/";
const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  base: basePath,
  envDir: path.resolve(import.meta.dirname, "../.."),

  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          runtimeErrorOverlay(),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({ root: path.resolve(import.meta.dirname, "..") }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom", "framer-motion"],
  },

  root: path.resolve(import.meta.dirname),

  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Target modern browsers — smaller bundles, no unnecessary polyfills
    target: "es2020",
    // Show bundle size warnings at 500 KB
    chunkSizeWarningLimit: 500,
    // Minification
    minify: "esbuild",
    cssMinify: true,
    // Source maps only in non-production (or set VITE_SOURCEMAP=true to enable)
    sourcemap: process.env.VITE_SOURCEMAP === "true" ? "hidden" : false,
    rollupOptions: {
      output: {
        // ── Manual chunk splitting for optimal caching ────────────────────
        manualChunks: {
          // React + router — rarely changes
          "vendor-react": ["react", "react-dom", "wouter"],
          // Animation — large, shared across pages
          "vendor-motion": ["framer-motion"],
          // 3D / heavy visual — only loaded when needed
          "vendor-three": ["three", "@react-three/fiber", "@react-three/drei"],
          // Radix UI primitives — shared across all form pages
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-accordion",
            "@radix-ui/react-tabs",
          ],
          // Form utilities
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          // Data / charting
          "vendor-charts": ["recharts"],
          // TanStack Query
          "vendor-query": ["@tanstack/react-query"],
          // GSAP + Lenis (scroll)
          "vendor-scroll": ["gsap", "lenis"],
        },
        // Content-hash based filenames for long-term caching
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const ext = assetInfo.name?.split(".").pop() ?? "";
          if (/png|jpe?g|svg|gif|webp|ico|avif/.test(ext)) {
            return "assets/img/[name]-[hash][extname]";
          }
          if (/woff2?|ttf|otf|eot/.test(ext)) {
            return "assets/fonts/[name]-[hash][extname]";
          }
          if (ext === "css") {
            return "assets/css/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
      // Tree-shake anything that sets "sideEffects: false"
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
    },
  },

  // ── Optimise dependencies during development ───────────────────────────────
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "framer-motion",
      "wouter",
      "lucide-react",
      "@tanstack/react-query",
    ],
    exclude: ["three", "@react-three/fiber", "@react-three/drei"],
  },

  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    fs: { strict: true },
    watch: {
      ignored: ["**/dist/**", "**/.git/**", "**/node_modules/**"],
    },
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },

  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
    headers: {
      // Security headers for the preview server
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
});
